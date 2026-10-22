/** D172 isolated authoritative namespace: never mutates shortage/picklist tables. */
type Row = Record<string, SqlStorageValue>;
const allowedRoles = new Set(["ADMIN","PICKPACK_ADMIN","ROOT"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storeRx = /^[A-Z0-9-]{1,24}$/;
const doRx = /^[0-9]{1,24}$/;

function reply(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
const now = () => new Date().toISOString();
function dayTime(iso: string): { day: string; time: string } {
  const vn = new Date(Date.parse(iso) + 7 * 3600_000).toISOString();
  return { day: vn.slice(8,10)+"/"+vn.slice(5,7)+"/"+vn.slice(0,4), time:vn.slice(11,19) };
}
function text(v: unknown, max = 512): string { return String(v ?? "").trim().slice(0,max); }
function position(v: unknown): string {
  const value = text(v,65).toUpperCase();
  if (!value || value.length>60 || /[\r\n\u0000-\u001f]/.test(value)) throw Error("INVALID_POSITION");
  return value;
}
function int(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n<1 || n>999999) throw Error("INVALID_TOTAL");
  return n;
}
function parcel(body: Record<string, unknown>) {
  const store_code=text(body.store_code,60).toUpperCase();
  const do_code=text(body.do_code,40);
  const total_parcels=int(body.total_parcels);
  const parcel_index=body.parcel_index==null?null:int(body.parcel_index);
  const raw_scan=text(body.raw_scan,513);
  if (!storeRx.test(store_code)||!doRx.test(do_code)||raw_scan.length>512) throw Error("INVALID_FIELDS");
  if (parcel_index && parcel_index>total_parcels) throw Error("INVALID_ORDINAL");
  if(raw_scan){
    const parts=raw_scan.split("|");
    if(parts.length!==6 || parts.some(p=>!p.trim()))throw Error("INVALID_QR");
    const match=/^([0-9]+)\/([0-9]+)$/.exec(parts[5].trim());
    if(!match || int(match[1])>int(match[2]))throw Error("INVALID_QR");
    if(!storeRx.test(parts[0].trim().toUpperCase())||!doRx.test(parts[1].trim()))throw Error("INVALID_QR");
  }
  return {store_code,do_code,total_parcels,parcel_index,raw_scan,location:position(body.location)};
}
function visibleRecord(r: Row) {
  return { id:r.id,raw_scan:r.raw_scan,store_code:r.store_code,do_code:r.do_code,
    total_parcels:r.total_parcels,parcel_index:r.parcel_index, location:r.location,
    date_vn:r.date_vn,time_vn:r.time_vn,actor_id:r.actor_id,
    revision:r.revision,sync_status:r.sync_status,updated_at:r.updated_at,deleted:Boolean(r.deleted) };
}
function actor(req: Request) {
  const userId=text(req.headers.get("x-obpp-user-id"),128);
  const role=text(req.headers.get("x-obpp-user-role"),30);
  if (!userId||!allowedRoles.has(role))throw Error("UNAUTHORIZED");
  return userId;
}
function operation(body: Record<string,unknown>): string {
  const op=text(body.operation_id,70);
  if(!uuid.test(op))throw Error("INVALID_OPERATION_ID");
  return op;
}
function event(state: DurableObjectState, id: string, kind: string, ref: string, revision: number) {
  state.storage.sql.exec(
    "INSERT OR IGNORE INTO obpp_outbox(event_key,kind,ref_id,revision,status,created_at) VALUES(?,?,?,?,?,?)",
    id,kind,ref,revision,"PENDING",now());
}
function audit(state: DurableObjectState, recordId:string, action:string, revision:number, userId:string, note:string): string {
  const id=crypto.randomUUID(), timestamp=now();
  state.storage.sql.exec(
    "INSERT INTO obpp_audit(id,record_id,action,revision,time,actor,note) VALUES(?,?,?,?,?,?,?)",
    id,recordId,action,revision,timestamp,userId,note.slice(0,160));
  event(state, "AUDIT:"+id, "AUDIT", id, revision);
  return id;
}
function writeResult(state: DurableObjectState, op:string, response: unknown) {
  state.storage.sql.exec("INSERT INTO obpp_operations(op_id,response_json,created_at) VALUES(?,?,?)",op,JSON.stringify(response),now());
}
function previousResult(state:DurableObjectState,op:string):unknown|null{
  const r=state.storage.sql.exec<Row>("SELECT response_json FROM obpp_operations WHERE op_id=?",op).toArray()[0];
  return r?JSON.parse(String(r.response_json)):null;
}

export function initializeObppSchema(state:DurableObjectState):void{
  const sql=state.storage.sql;
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_sessions(uid TEXT PRIMARY KEY,generation INTEGER NOT NULL DEFAULT 0)");
  sql.exec(`CREATE TABLE IF NOT EXISTS obpp_records(
    id TEXT PRIMARY KEY, raw_scan TEXT NOT NULL, store_code TEXT NOT NULL, do_code TEXT NOT NULL,
    total_parcels INTEGER NOT NULL,parcel_index INTEGER,location TEXT NOT NULL,
    date_vn TEXT NOT NULL,time_vn TEXT NOT NULL,actor_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,sync_status TEXT NOT NULL DEFAULT 'PENDING')`);
  sql.exec(`CREATE TABLE IF NOT EXISTS obpp_locations(
    code TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL,
    actor_id TEXT NOT NULL,updated_at TEXT NOT NULL)`);
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_operations(op_id TEXT PRIMARY KEY,response_json TEXT NOT NULL,created_at TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_audit(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,action TEXT NOT NULL,revision INTEGER NOT NULL,time TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL)");
  sql.exec(`CREATE TABLE IF NOT EXISTS obpp_outbox(
    event_key TEXT PRIMARY KEY,kind TEXT NOT NULL,ref_id TEXT NOT NULL,
    revision INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',claimed_until INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`);
  sql.exec("CREATE INDEX IF NOT EXISTS obpp_recent_idx ON obpp_records(created_at DESC)");
  sql.exec("CREATE INDEX IF NOT EXISTS obpp_pending_idx ON obpp_outbox(status,created_at)");
}

export async function handleObppCoreRequest(state:DurableObjectState,request:Request):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(!path.startsWith("/obpp1291/"))return null;
  try{
    const sql=state.storage.sql;
    if(path==="/obpp1291/session/activate" && method==="POST"){
      const {uid}=await request.json() as {uid:string};
      if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))return reply({error:"INVALID_UID"},400);
      sql.exec("INSERT INTO obpp_sessions(uid,generation) VALUES(?,1) ON CONFLICT(uid) DO UPDATE SET generation=generation+1",uid);
      const row=sql.exec<Row>("SELECT generation FROM obpp_sessions WHERE uid=?",uid).toArray()[0];
      return reply({session_generation:Number(row.generation)});
    }
    if(path==="/obpp1291/session/check" && method==="POST"){
      const {uid,generation}=await request.json() as {uid:string;generation:number};
      const row=sql.exec<Row>("SELECT generation FROM obpp_sessions WHERE uid=?",uid).toArray()[0];
      return reply({valid:Boolean(row && Number(row.generation)===generation)});
    }
    const userId=actor(request);
    if(path==="/obpp1291/locations" && method==="GET"){
      const locations=sql.exec<Row>("SELECT code,active,revision,actor_id,updated_at FROM obpp_locations ORDER BY code ASC LIMIT 500").toArray()
        .map(r=>({code:r.code,active:Boolean(r.active),revision:r.revision,updated_at:r.updated_at}));
      return reply({locations});
    }
    if(path==="/obpp1291/records" && method==="GET"){
      const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||50));
      const records=sql.exec<Row>("SELECT * FROM obpp_records WHERE deleted=0 ORDER BY created_at DESC LIMIT ?",limit).toArray().map(visibleRecord);
      return reply({records});
    }
    if(path==="/obpp1291/outbox/claim" && method==="POST"){
      // Worker-to-DO only; Worker must never expose this route to external clients.
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const outbox=state.storage.transactionSync(()=>{
        const items=sql.exec<Row>("SELECT event_key,kind,ref_id,revision FROM obpp_outbox WHERE status='PENDING' OR (status='IN_FLIGHT' AND claimed_until<?) ORDER BY created_at,event_key LIMIT 10",Date.now()).toArray();
        for(const item of items) sql.exec("UPDATE obpp_outbox SET status='IN_FLIGHT',claimed_until=? WHERE event_key=?",Date.now()+60000,item.event_key);
        return items;
      });
      const items=outbox.map(o=>{
        const table=o.kind==="AUDIT"?"obpp_audit":o.kind==="LOCATION"?"obpp_locations":"obpp_records";
        const column=o.kind==="LOCATION"?"code":"id";
        const row=sql.exec<Row>(`SELECT * FROM ${table} WHERE ${column}=? LIMIT 1`,o.ref_id).toArray()[0];
        return {event_key:o.event_key,kind:o.kind,ref_id:o.ref_id,revision:o.revision,row};
      }).filter(x=>Boolean(x.row));
      return reply({items});
    }
    if(path==="/obpp1291/outbox/release" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const body=await request.json() as {event_key:string};
      sql.exec("UPDATE obpp_outbox SET status='PENDING',claimed_until=0 WHERE event_key=? AND status='IN_FLIGHT'",body.event_key);
      return reply({ok:true});
    }
    if(path==="/obpp1291/outbox/ack" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const b=await request.json() as {event_key:string;kind:string;ref_id:string;revision:number};
      sql.exec("UPDATE obpp_outbox SET status='SYNCED' WHERE event_key=? AND revision=?",b.event_key,b.revision);
      if(b.kind==="RECORD"){
        const pending=sql.exec<Row>("SELECT COUNT(*) AS n FROM obpp_outbox WHERE kind='RECORD' AND ref_id=? AND status='PENDING'",b.ref_id).toArray()[0];
        if(Number(pending.n)===0)sql.exec("UPDATE obpp_records SET sync_status='SYNCED' WHERE id=? AND revision=?",b.ref_id,b.revision);
      }
      return reply({ok:true});
    }

    const isRecord=path==="/obpp1291/records"&&method==="POST";
    const isLocation=path==="/obpp1291/locations"&&method==="POST";
    const recMatch=/^\/obpp1291\/records\/([a-f0-9-]{36})$/i.exec(path);
    const locMatch=/^\/obpp1291\/locations\/(.+)$/.exec(path);
    if(!isRecord&&!isLocation&&!recMatch&&!locMatch)return reply({error:"NOT_FOUND"},404);
    if(!["POST","PATCH","DELETE"].includes(method))return reply({error:"METHOD_NOT_ALLOWED"},405);
    const b=await request.json() as Record<string,unknown>;
    const op=operation(b);
    const old=previousResult(state,op);
    if(old)return reply(old);

    let response:Record<string,unknown>={};
    let conflict=false;
    state.storage.transactionSync(()=>{
      const replay=previousResult(state,op);
      if(replay){response=replay as Record<string,unknown>;return;}
      if(isLocation){
        const code=position(b.code);
        const existing=sql.exec<Row>("SELECT code FROM obpp_locations WHERE code=?",code).toArray()[0];
        if(existing){conflict=true;return;}
        sql.exec("INSERT INTO obpp_locations(code,active,revision,actor_id,updated_at) VALUES(?,1,1,?,?)",code,userId,now());
        event(state,"LOCATION:"+code+":1","LOCATION",code,1);
        audit(state,code,"LOCATION_ADD",1,userId,code);
        response={code,active:true,revision:1,sync_status:"PENDING"};
      }else if(locMatch && method==="PATCH"){
        const oldCode=position(decodeURIComponent(locMatch[1]));
        const before=sql.exec<Row>("SELECT * FROM obpp_locations WHERE code=?",oldCode).toArray()[0];
        if(!before){conflict=true;return;}
        const next= b.code!==undefined ? position(b.code) : oldCode;
        const active=typeof b.active==="boolean"?(b.active?1:0):Number(before.active);
        const revision=Number(before.revision)+1;
        if(next!==oldCode && sql.exec<Row>("SELECT code FROM obpp_locations WHERE code=?",next).toArray().length){conflict=true;return;}
        sql.exec("UPDATE obpp_locations SET code=?,active=?,revision=?,actor_id=?,updated_at=? WHERE code=?",next,active,revision,userId,now(),oldCode);
        sql.exec("UPDATE obpp_outbox SET ref_id=? WHERE kind='LOCATION' AND ref_id=? AND status!='SYNCED'",next,oldCode);
        event(state,"LOCATION:"+next+":"+revision,"LOCATION",next,revision);
        audit(state,next,next!==oldCode?"LOCATION_RENAME":"LOCATION_STATUS",revision,userId,oldCode);
        response={code:next,active:Boolean(active),revision,sync_status:"PENDING"};
      }else if(isRecord){
        const p=parcel(b);
        const active=sql.exec<Row>("SELECT active FROM obpp_locations WHERE code=?",p.location).toArray()[0];
        if(!active||Number(active.active)!==1){conflict=true;return;}
        const id=crypto.randomUUID(),timestamp=now(),dt=dayTime(timestamp);
        sql.exec(`INSERT INTO obpp_records(id,raw_scan,store_code,do_code,total_parcels,parcel_index,location,
          date_vn,time_vn,actor_id,revision,created_at,updated_at,deleted,sync_status)
          VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,0,'PENDING')`,
          id,p.raw_scan,p.store_code,p.do_code,p.total_parcels,p.parcel_index,p.location,
          dt.day,dt.time,userId,timestamp,timestamp);
        event(state,"RECORD:"+id+":1","RECORD",id,1);
        audit(state,id,"CREATE",1,userId,p.do_code);
        response={id,revision:1,sync_status:"PENDING"};
      }else if(recMatch && (method==="PATCH"||method==="DELETE")){
        const id=recMatch[1];
        const before=sql.exec<Row>("SELECT * FROM obpp_records WHERE id=?",id).toArray()[0];
        if(!before||Number(before.deleted)!==0 || Number(b.expected_revision)!==Number(before.revision)){conflict=true;return;}
        const revision=Number(before.revision)+1;
        if(method==="DELETE"){
          sql.exec("UPDATE obpp_records SET deleted=1,revision=?,actor_id=?,updated_at=?,sync_status='PENDING' WHERE id=?",revision,userId,now(),id);
          audit(state,id,"DELETE",revision,userId,"");
        }else{
          const p=parcel(b);
          const active=sql.exec<Row>("SELECT active FROM obpp_locations WHERE code=?",p.location).toArray()[0];
          if(!active||Number(active.active)!==1){conflict=true;return;}
          sql.exec(`UPDATE obpp_records SET raw_scan=?,store_code=?,do_code=?,total_parcels=?,parcel_index=?,
            location=?,actor_id=?,revision=?,updated_at=?,sync_status='PENDING' WHERE id=?`,
            p.raw_scan,p.store_code,p.do_code,p.total_parcels,p.parcel_index,p.location,userId,revision,now(),id);
          audit(state,id,"EDIT",revision,userId,p.do_code);
        }
        event(state,"RECORD:"+id+":"+revision,"RECORD",id,revision);
        response={id,revision,sync_status:"PENDING",deleted:method==="DELETE"};
      }
      if(!conflict)writeResult(state,op,response);
    });
    return conflict?reply({error:"CONFLICT_OR_INACTIVE_POSITION"},409):reply(response);
  }catch(error){
    const msg=error instanceof Error?error.message:"INVALID_REQUEST";
    return reply({error:/^INVALID_/.test(msg)?msg:"OBPP_REQUEST_FAILED"},/^INVALID_/.test(msg)?400:500);
  }
}
