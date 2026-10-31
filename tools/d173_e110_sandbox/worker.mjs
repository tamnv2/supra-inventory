// D173-E110 ISOLATED LAB ONLY. NOT part of deployed service/src.
// Host must bind 127.0.0.1; fixture identities are deliberately not real authentication.
const stamp = () => new Date().toISOString();
const reply = (data, status=200) => Response.json(data, {status,headers:{"cache-control":"no-store","x-m2-lab-only":"true"}});
const allowed = new Set(["p1","p2","r1","agent1"]);
function parsed(input) {try{return JSON.parse(input);}catch{return null;}}
export class M2Sandbox {
  constructor(ctx) {
    this.ctx=ctx;
    ctx.blockConcurrencyWhile(async()=>{
      const q=ctx.storage.sql;
      q.exec("CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY,role TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1)");
      q.exec("CREATE TABLE IF NOT EXISTS batches(id INTEGER PRIMARY KEY AUTOINCREMENT,sku TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN',version INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,resolved_at_ms INTEGER, result_event INTEGER)");
      q.exec("CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id INTEGER NOT NULL,uid TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN',created_at_ms INTEGER NOT NULL,UNIQUE(batch_id,uid))");
      q.exec("CREATE TABLE IF NOT EXISTS receipts(uid TEXT NOT NULL,request_id TEXT NOT NULL,body TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(uid,request_id))");
      q.exec("CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,batch_id INTEGER,recipients TEXT NOT NULL,payload TEXT NOT NULL,at TEXT NOT NULL)");
      q.exec("CREATE TABLE IF NOT EXISTS skus(sku TEXT PRIMARY KEY,name TEXT NOT NULL,location TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1)");
      q.exec("CREATE TABLE IF NOT EXISTS meters(kind TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0)");
      q.exec("INSERT OR IGNORE INTO users(uid,role) VALUES ('p1','PICKER'),('p2','PICKER'),('r1','REPORTER'),('agent1','AGENT')");
      q.exec("INSERT OR IGNORE INTO skus(sku,name,location) VALUES ('SKU-001','Sữa hộp test','A01'),('SKU-002','Bánh test','B02'),('SKU-003','Nước test','C03')");
      q.exec("INSERT OR IGNORE INTO meters(kind) VALUES ('HTTP'),('WS'),('HANDSHAKE'),('READ_SQL'),('WRITE_SQL')");
    });
  }
  meter(kind,n=1){this.ctx.storage.sql.exec("UPDATE meters SET quantity=quantity+? WHERE kind=?",n,kind);}
  auth(identity) {
    if(!allowed.has(identity.uid)||identity.generation!==1) return null;
    const v=this.ctx.storage.sql.exec("SELECT role,active,generation FROM users WHERE uid=?",identity.uid).toArray()[0];
    return v&&v.active&&Number(v.generation)===1?{uid:identity.uid,role:String(v.role)}:null;
  }
  event(kind,batchId,recipients,payload) {
    const q=this.ctx.storage.sql;
    const at=stamp();
    const result=q.exec("INSERT INTO events(kind,batch_id,recipients,payload,at) VALUES(?,?,?,?,?)",
      kind,batchId||null,JSON.stringify(recipients),JSON.stringify(payload),at);
    void result;
    const row=q.exec("SELECT last_insert_rowid() AS n").toArray()[0];
    return {seq:Number(row.n),kind,batch_id:batchId||null,recipients,payload,at};
  }
  broadcast(ev) {
    if(!ev)return;
    const frame=JSON.stringify({type:"EVENT",seq:ev.seq,kind:ev.kind,payload:ev.payload,at:ev.at});
    for(const socket of this.ctx.getWebSockets()){
      const a=socket.deserializeAttachment()||{};
      const principal=this.auth(a);
      if(principal&&(ev.recipients.includes("user:"+principal.uid)||ev.recipients.includes("role:"+principal.role)))
        try{socket.send(frame);}catch{/* reconnect will recover from SQLite */}
    }
  }
  read(actor,op,args) {
    const q=this.ctx.storage.sql;
    this.meter("READ_SQL");
    if(op==="SNAPSHOT"){
      const batches=q.exec("SELECT id,sku,status,version,created_at,result_event FROM batches ORDER BY id DESC LIMIT 200").toArray().map(x=>({...x,id:Number(x.id),version:Number(x.version)}));
      const tickets=q.exec("SELECT id,batch_id,uid,status FROM tickets ORDER BY id DESC LIMIT 400").toArray();
      const items=q.exec("SELECT sku,name,location,revision FROM skus ORDER BY sku LIMIT 100").toArray();
      const events=q.exec("SELECT seq,kind,recipients,payload,at FROM events ORDER BY seq DESC LIMIT 35").toArray().reverse().filter(e=>{
        const a=parsed(e.recipients)||[];
        return a.includes("role:"+actor.role)||a.includes("user:"+actor.uid);
      }).map(e=>({seq:Number(e.seq),kind:e.kind,payload:parsed(e.payload),at:e.at}));
      const visible=actor.role==="PICKER"?batches.filter(b=>tickets.some(t=>Number(t.batch_id)===b.id&&t.uid===actor.uid)):batches;
      return {ok:true,actor,items,batches:visible,tickets:actor.role==="PICKER"?tickets.filter(t=>t.uid===actor.uid):tickets,events,server_time:stamp()};
    }
    if(op==="RECOVER"){
      const after=Number(args.after_seq??0),limit=Math.min(100,Math.max(1,Number(args.limit??100)));
      if(!Number.isSafeInteger(after)||after<0)return {error:"INVALID_CURSOR"};
      const raw=q.exec("SELECT seq,kind,recipients,payload,at FROM events WHERE seq>? ORDER BY seq LIMIT 201",after).toArray();
      const latest=Number(q.exec("SELECT COALESCE(MAX(seq),0) AS n FROM events").toArray()[0].n);
      // Never cover an authorized event that was omitted because limit was reached.
      // Scan at most 201 global records; advance only through evaluated rows.
      const authorized=[];let covered=after;
      for(const e of raw){
        const a=parsed(e.recipients)||[];
        const visible=a.includes("role:"+actor.role)||a.includes("user:"+actor.uid);
        if(visible&&authorized.length>=limit)break;
        if(visible)authorized.push({seq:Number(e.seq),kind:e.kind,payload:parsed(e.payload),at:e.at});
        covered=Number(e.seq);
        if(visible&&authorized.length===limit)break;
      }
      if(raw.length<201&&authorized.length<limit)covered=latest;
      return {ok:true,events:authorized,covered_through:covered,latest_seq:latest};
    }
    if(op==="EXPORT_LOG"){
      // On-demand LAB-only diagnostic. No raw request body, free-text chat or token fields.
      const safe = obj => {
        const out = {};
        for (const k of ["sku","batch_id","expected_version","event_id","target","resolution","status","version","current_version","ok","ack","error","location"]) {
          const v = obj && typeof obj === "object" ? obj[k] : undefined;
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
        }
        return out;
      };
      const receipts = q.exec("SELECT uid,request_id,body,response FROM receipts ORDER BY rowid DESC LIMIT 2000").toArray().reverse().map(r => {
        const body = parsed(r.body);
        return {uid:String(r.uid),request_id:String(r.request_id),operation:Array.isArray(body)?String(body[0]):"UNKNOWN",
          args:safe(Array.isArray(body)?body[1]:null),result:safe(parsed(r.response))};
      });
      const events = q.exec("SELECT seq,kind,batch_id,recipients,payload,at FROM events ORDER BY seq DESC LIMIT 2000").toArray().reverse().map(r=>({
        seq:Number(r.seq),kind:String(r.kind),batch_id:r.batch_id===null?null:Number(r.batch_id),
        recipients:parsed(r.recipients)||[],payload:safe(parsed(r.payload)),at:String(r.at)
      }));
      const batches = q.exec("SELECT id,sku,status,version,created_at,resolved_at_ms,result_event FROM batches ORDER BY id DESC LIMIT 200").toArray();
      const meters=Object.fromEntries(q.exec("SELECT kind,quantity FROM meters").toArray().map(r=>[r.kind,Number(r.quantity)]));
      const counts={events:Number(q.exec("SELECT COUNT(*) AS n FROM events").toArray()[0].n),
        receipts:Number(q.exec("SELECT COUNT(*) AS n FROM receipts").toArray()[0].n)};
      return {ok:true,lab:"D173-E110",generated_at:stamp(),is_simulated:true,
        warning:"Local LAB only. Usage equivalent is a theoretical counter, NOT real Cloudflare billing.",
        limits:{events:2000,receipts:2000,batches:200},counts,receipts,events,batches,meters,
        billed_equivalent_estimate:meters.HTTP+meters.HANDSHAKE+Math.ceil(meters.WS/20)};
    }
    if(op==="METERS"){
      const meters=Object.fromEntries(q.exec("SELECT kind,quantity FROM meters").toArray().map(r=>[r.kind,Number(r.quantity)]));
      return {ok:true,meters,billed_equivalent_estimate:meters.HTTP+meters.HANDSHAKE+Math.ceil(meters.WS/20),note:"MÔ PHỎNG ĐƠN VỊ TÍNH PHÍ; KHÔNG PHẢI CLOUDFLARE BILLING"};
    }
    return {error:"UNSUPPORTED_READ"};
  }
  mutate(actor,op,args) {
    const q=this.ctx.storage.sql, now=Date.now();
    const batchId=Number(args.batch_id||0);
    const batch=batchId?q.exec("SELECT * FROM batches WHERE id=?",batchId).toArray()[0]:null;
    const reporter=actor.role==="REPORTER";
    const agent=actor.role==="AGENT";
    if(op==="REPORT"){
      if(actor.role!=="PICKER")return {data:{error:"ROLE_FORBIDDEN"}};
      const sku=String(args.sku||"").trim();
      if(sku.length===0||sku.length>64||!q.exec("SELECT 1 FROM skus WHERE sku=?",sku).toArray().length)return {data:{error:"SKU_UNKNOWN"}};
      let b=q.exec("SELECT id,version FROM batches WHERE sku=? AND status='OPEN' LIMIT 1",sku).toArray()[0];
      let id,version;
      if(!b){q.exec("INSERT INTO batches(sku,status,version,created_at) VALUES(?,'OPEN',0,?)",sku,stamp());id=Number(q.exec("SELECT last_insert_rowid() AS n").toArray()[0].n);version=0;}
      else{id=Number(b.id);version=Number(b.version);}
      if(q.exec("SELECT 1 FROM tickets WHERE uid=? AND batch_id=? AND status='OPEN'",actor.uid,id).toArray().length)
        return {data:{error:"ALREADY_REPORTED"}};
      q.exec("INSERT INTO tickets(batch_id,uid,created_at_ms) VALUES(?,?,?)",id,actor.uid,now);
      version++;
      q.exec("UPDATE batches SET version=? WHERE id=?",version,id);
      const ev=this.event("REPORT",id,["role:REPORTER","role:AGENT","user:"+actor.uid],{batch_id:id,sku,status:"OPEN",version});
      return {data:{ok:true,batch_id:id,sku,status:"OPEN",version,event_id:ev.seq},ev};
    }
    if(op==="WITHDRAW"){
      if(actor.role!=="PICKER"||!batch||batch.status!=="OPEN")return {data:{error:"WITHDRAW_FORBIDDEN"}};
      const t=q.exec("SELECT id,created_at_ms FROM tickets WHERE batch_id=? AND uid=? AND status='OPEN'",batchId,actor.uid).toArray()[0];
      if(!t||now-Number(t.created_at_ms)>60000)return {data:{error:"WITHDRAW_60S_EXPIRED"}};
      q.exec("UPDATE tickets SET status='WITHDRAWN' WHERE id=?",t.id);
      const version=Number(batch.version)+1;
      q.exec("UPDATE batches SET version=? WHERE id=?",version,batchId);
      const ev=this.event("WITHDRAW",batchId,["role:REPORTER","role:AGENT","user:"+actor.uid],{batch_id:batchId,status:"WITHDRAWN",version});
      return {data:{ok:true,batch_id:batchId,status:"WITHDRAWN",version,event_id:ev.seq},ev};
    }
    if(op==="RESOLVE"||op==="CORRECT"){
      if(!reporter||!batch)return {data:{error:"RESOLVE_FORBIDDEN"}};
      const expected=Number(args.expected_version);
      if(expected!==Number(batch.version))return {data:{error:"VERSION_CONFLICT",current_version:Number(batch.version)}};
      const decision=String(args.resolution||"");
      if(op==="RESOLVE"&&(batch.status!=="OPEN"||!["HAS_STOCK","SKIP_ALLOWED"].includes(decision)))
        return {data:{error:"INVALID_RESOLUTION"}};
      if(op==="CORRECT"&&(batch.status!=="SKIP_ALLOWED"||decision!=="HAS_STOCK"||now-Number(batch.resolved_at_ms)>300000))
        return {data:{error:"CORRECT_5MIN_EXPIRED"}};
      const version=Number(batch.version)+1;
      const tickets=q.exec("SELECT uid FROM tickets WHERE batch_id=? AND status='OPEN'",batchId).toArray();
      const ev=this.event(op,batchId,["role:REPORTER","role:AGENT",...tickets.map(x=>"user:"+x.uid)],{batch_id:batchId,status:decision,version});
      q.exec("UPDATE batches SET status=?,version=?,result_event=?,resolved_at_ms=? WHERE id=?",decision,version,ev.seq,now,batchId);
      return {data:{ok:true,batch_id:batchId,status:decision,version,event_id:ev.seq},ev};
    }
    if(op==="ACK"){
      if(actor.role!=="PICKER"||!batch||Number(args.event_id)!==Number(batch.result_event)||
         !q.exec("SELECT 1 FROM tickets WHERE batch_id=? AND uid=? AND status='OPEN'",batchId,actor.uid).toArray().length)
         return {data:{error:"ACK_FORBIDDEN"}};
      return {data:{ok:true,ack:true,event_id:Number(args.event_id),batch_id:batchId}};
    }
    if(op==="SKU_SYNC"){
      if(!agent)return {data:{error:"ROLE_FORBIDDEN"}};
      const sku=String(args.sku||"").trim(), name=String(args.name||"").trim(),location=String(args.location||"").trim();
      if(!sku||!name||!location||sku.length>64||name.length>120||location.length>80)return {data:{error:"SKU_INVALID"}};
      q.exec("INSERT INTO skus(sku,name,location,revision) VALUES(?,?,?,1) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,location=excluded.location,revision=skus.revision+1",sku,name,location);
      const ev=this.event("SKU_SYNC",null,["role:REPORTER","role:PICKER","role:AGENT"],{sku,name,location});
      return {data:{ok:true,sku,location,event_id:ev.seq},ev};
    }
    if(op==="CHAT"||op==="CALL_CV"){
      if(!agent)return {data:{error:"ROLE_FORBIDDEN"}};
      const target=String(args.target||"");
      if(!["p1","p2"].includes(target))return {data:{error:"TARGET_UNKNOWN"}};
      const message=op==="CALL_CV"?"Yêu cầu về gặp chuyên viên Pick Pack":String(args.message||"").trim().slice(0,160);
      if(!message)return {data:{error:"MESSAGE_REQUIRED"}};
      const ev=this.event(op,null,["user:"+target,"role:AGENT"],{target,message});
      return {data:{ok:true,target,message,event_id:ev.seq},ev};
    }
    return {data:{error:"UNSUPPORTED_MUTATION"}};
  }
  dispatch(identity,frame,transport) {
    if(transport==="HTTP")this.meter("HTTP");else this.meter("WS");
    const principal=this.auth(identity);
    if(!principal)return {error:"SANDBOX_SESSION_NOT_FOUND"};
    if(!frame||typeof frame!=="object"||Array.isArray(frame))return {error:"INVALID_FRAME"};
    const op=String(frame.operation||"");
    const args=frame.args&&typeof frame.args==="object"&&!Array.isArray(frame.args)?frame.args:{};
    if(["SNAPSHOT","RECOVER","METERS","EXPORT_LOG"].includes(op))return this.read(principal,op,args);
    const rid=String(frame.request_id||"");
    if(rid.length<1||rid.length>128)return {error:"REQUEST_ID_REQUIRED"};
    const body=JSON.stringify([op,args]);
    let event=null, result;
    result=this.ctx.storage.transactionSync(()=>{
      const q=this.ctx.storage.sql;
      const old=q.exec("SELECT body,response FROM receipts WHERE uid=? AND request_id=?",principal.uid,rid).toArray()[0];
      if(old) return old.body===body?JSON.parse(old.response):{error:"REQUEST_ID_CONFLICT"};
      const out=this.mutate(principal,op,args);
      event=out.ev||null;
      q.exec("INSERT INTO receipts(uid,request_id,body,response) VALUES(?,?,?,?)",principal.uid,rid,body,JSON.stringify(out.data));
      this.meter("WRITE_SQL");
      return out.data;
    });
    if(event)this.broadcast(event);
    return result;
  }
  async fetch(request){
    const url=new URL(request.url);
    const identity={uid:url.searchParams.get("uid")||"",generation:Number(url.searchParams.get("gen")||1)};
    if(url.pathname==="/health")return reply({lab:"D173-E110",isolated:true,production:false,live_provider:false});
    if(url.pathname==="/socket"&&request.headers.get("upgrade")?.toLowerCase()==="websocket"){
      if(!this.auth(identity))return reply({error:"SANDBOX_USER_UNKNOWN"},403);
      this.meter("HANDSHAKE");
      const pair=new WebSocketPair(),[client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(identity);
      server.send(JSON.stringify({type:"CONNECTED",lab:true,actor:identity.uid}));
      return new Response(null,{status:101,webSocket:client});
    }
    if(url.pathname==="/command"&&request.method==="POST"){
      const frame=await request.json().catch(()=>null);
      return reply(this.dispatch(identity,frame,"HTTP"));
    }
    return reply({error:"NOT_FOUND"},404);
  }
  webSocketMessage(socket,data){
    const frame=parsed(String(data));
    const identity=socket.deserializeAttachment()||{};
    const result=this.dispatch(identity,frame,"WS");
    try{socket.send(JSON.stringify({type:"RESULT",request_id:frame?.request_id||"",...result}));}catch{/* drop ACK -> recover with same id */}
  }
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(["/health","/command","/socket"].includes(url.pathname))
      return env.POC_CORE.get(env.POC_CORE.idFromName("d173-e110-private-local")).fetch(request);
    if(env.ASSETS)return env.ASSETS.fetch(request);
    return reply({error:"LAB_ASSET_MISSING"},404);
  }
};
