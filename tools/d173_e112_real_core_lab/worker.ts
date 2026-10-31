// D173-E112: ACTUAL published InventoryCore source in an isolated LOCAL-only DO.
// This file is NEVER part of service/src/deployed Worker.
// Ephemeral lab identity is deliberately NOT production Firebase authentication.
import { InventoryCore } from "../../service/src/core";

type LabRole = string;
const roles: Record<LabRole,{uid:string,channel:string,role:string}>={
 p1:{uid:"d173lab-picker-1",channel:"WEB",role:"PICKER"},
 p2:{uid:"d173lab-picker-2",channel:"WEB",role:"PICKER"},
 r1:{uid:"d173lab-reporter-1",channel:"WEB",role:"REPORTER"},
 agent1:{uid:"d173lab-agent-1",channel:"WEB",role:"PICKPACK_ADMIN"}
};
// Synthetic independent identities; no live employee/user/device records.
for(let i=3;i<=60;i++)roles["p"+i]={uid:"d173lab-picker-"+i,channel:"WEB",role:"PICKER"};
const nowDay=()=>{
 const d=new Date(Date.now()+7*3600000);
 return d.toISOString().slice(0,10);
};
function respond(value:unknown,status=200){return Response.json(value,{status,headers:{"x-lab-only":"real-inventorycore-no-production","cache-control":"no-store"}})}
function cleanActor(x:unknown):LabRole|null{return typeof x==="string"&&Object.prototype.hasOwnProperty.call(roles,x)?x as LabRole:null;}
function cleanData(x:unknown):Record<string,unknown>{return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};}
export class LabRealCore extends InventoryCore {
 private readonly labCtx:DurableObjectState;
 constructor(ctx:DurableObjectState,env:{APP_ENV:string,PROJECT_KEY:string,FIREBASE_PROJECT_ID:string}){
  super(ctx,env);this.labCtx=ctx;
 }
 private initFixture(){
  const q=this.labCtx.storage.sql;
  for(const [name,identity] of Object.entries(roles)){
   q.exec("INSERT OR IGNORE INTO users(user_id,firebase_uid,employee_code,display_name,role,status,shortage_reporting_enabled,web_session_generation,web_session_device_id) VALUES(?,?,?,?,?,'ACTIVE',1,1,'local-lab')",
    "lab-"+name,identity.uid,"LAB-"+name.toUpperCase(),"E112 LAB "+name,identity.role);
  }
  for(let i=1;i<=40;i++){
   const sku="LAB-REAL-"+String(i).padStart(3,"0");
   q.exec("INSERT OR IGNORE INTO sku_master(sku,product_name) VALUES(?,?)",sku,"D173 Synthetic "+i);
   q.exec("INSERT OR IGNORE INTO d167_sku_active(sku,active,area,area_verified) VALUES(?,1,'LAB',1)",sku);
  }
  q.exec("UPDATE d167_sku_meta SET last_full_day=?, revision=revision+1 WHERE id=1",nowDay());
  this.e166Schema();
  return {ok:true,source:"service/src/core.ts",schema_version:17,local_only:true,actors:["p1","p2","r1","agent1"],e166_synthetic_picker_count:60};
 }

 // E167 LAB-only candidate. Business/Core transaction already writes report_events,
 // which in turn inserts realtime_events via trg_v2_report_event_stream.
 // This ADDITIONAL trigger materializes test recipient references in that SAME SQLite
 // business transaction. Never use a post-commit sidecar to create mandatory events.
 private e166Schema(){
  const q=this.labCtx.storage.sql;
  q.exec("CREATE TABLE IF NOT EXISTS e166_receivers(audience TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY(audience,seq))");
  q.exec("CREATE INDEX IF NOT EXISTS e166_receivers_by_seq ON e166_receivers(seq,audience)");
  q.exec(`CREATE TRIGGER IF NOT EXISTS trg_e167_atomic_audience
   AFTER INSERT ON realtime_events BEGIN
     INSERT OR IGNORE INTO e166_receivers(audience,seq)
       VALUES('reporter', NEW.seq);
     INSERT OR IGNORE INTO e166_receivers(audience,seq)
       SELECT DISTINCT 'picker:' || lower(substr(u.employee_code,5)),NEW.seq
         FROM report_tickets t JOIN users u ON u.user_id=t.picker_user_id
        WHERE NEW.batch_id IS NOT NULL AND t.batch_id=NEW.batch_id
          AND u.role='PICKER' AND u.status='ACTIVE'
          AND u.employee_code LIKE 'LAB-P%';
   END`);
 }
 private e166Auth(actor:LabRole):boolean{
  const id=roles[actor];if(!id)return false;
  const row=this.labCtx.storage.sql.exec<{role:string,status:string,generation:number}>(
   "SELECT role,status,web_session_generation AS generation FROM users WHERE user_id=? LIMIT 1",
   "lab-"+actor).toArray()[0];
  return !!row && row.role===id.role && row.status==="ACTIVE" && Number(row.generation)===1;
 }
 private e166Read(actor:LabRole,after:number,limit:number){
  if(!this.e166Auth(actor))return {error:"SESSION_REVOKED",events:[],resync_required:true};
  if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>200)return {error:"INVALID_CURSOR",events:[]};
  const q=this.labCtx.storage.sql;
  const latest=Number(q.exec<{latest:number}>("SELECT COALESCE(MAX(seq),0) AS latest FROM realtime_events").toArray()[0]?.latest||0);
  const oldest=Number(q.exec<{oldest:number}>("SELECT COALESCE(MIN(seq),0) AS oldest FROM realtime_events").toArray()[0]?.oldest||0);
  if(after>latest || (oldest>0&&after<oldest-1))
    return {resync_required:true,reason:after>latest?"CURSOR_AHEAD":"RETENTION_GAP",events:[],covered_through:latest};
  const audience=actor==="r1"?"reporter":"picker:"+actor;
  const rows=q.exec<{seq:number,event_id:string,event_type:string,batch_id:string|null,payload_json:string|null,actor_code:string|null}>(
   `SELECT e.seq,e.event_id,e.event_type,e.batch_id,e.payload_json,u.employee_code AS actor_code
      FROM e166_receivers d JOIN realtime_events e ON e.seq=d.seq
      LEFT JOIN report_events r ON r.event_id=e.event_id
      LEFT JOIN users u ON u.user_id=r.actor_user_id
     WHERE d.audience=? AND d.seq>? ORDER BY d.seq LIMIT ?`,
   audience,after,limit+1).toArray();
  const more=rows.length>limit,visible=rows.slice(0,limit);
  const covered=more?Number(visible[visible.length-1].seq):latest;
  return {resync_required:false,events:visible.map(v=>({
   seq:Number(v.seq),event_id:v.event_id,operation:v.event_type,batch_id:v.batch_id,
   payload:{...cleanData((()=>{try{return JSON.parse(String(v.payload_json||"{}"))}catch{return {}}})()),
            actor:String(v.actor_code||"").replace(/^LAB-/,"").toLowerCase()}
  })),covered_through:covered,has_more:more,latest_seq:latest};
 }
 private async e166Dispatch(actor:LabRole,command:Record<string,unknown>){
  if(!this.e166Auth(actor))return {http_status:403,body:{error:"SESSION_REVOKED"},e166_patch:null};
  const result=await this.dispatch(actor,command);
  const operation=String(command.operation||"");
  const record=cleanData(cleanData(result.body).result);
  if(!["REPORT","RESOLVE","CORRECT","WITHDRAW"].includes(operation)
     ||result.http_status!==201&&result.http_status!==200
     ||record.idempotent_replay===true)return {...result,e166_patch:null};
  const eventId=String(record.event_id||"");
  if(!eventId)throw Error("E167_MISSING_CORE_EVENT_ID");
  // The Core event and audience index were committed atomically by SQL triggers.
  const q=this.labCtx.storage.sql;
  const row=q.exec<{seq:number}>("SELECT seq FROM realtime_events WHERE event_id=? LIMIT 1",eventId).toArray()[0];
  if(!row)throw Error("E167_MISSING_DURABLE_CORE_EVENT");
  const seq=Number(row.seq);
  const groups=q.exec<{audience:string}>("SELECT audience FROM e166_receivers WHERE seq=?",seq).toArray().map(x=>String(x.audience));
  if(!groups.length)throw Error("E167_MISSING_ATOMIC_AUDIENCE");
  const payload={type:"E166_EVENT",seq,operation,patch:record};
  for(const sock of this.labCtx.getWebSockets()){
   const a=sock.deserializeAttachment() as {actor?:string,e166?:boolean}|null;
   if(!a?.e166||!a.actor)continue;
   const group=a.actor==="r1"?"reporter":"picker:"+a.actor;
   // Filter by durable audience FIRST; only verify live session for actual recipients.
   // Avoid checking 20 unrelated Picker sessions for every report event.
   if(!groups.includes(group))continue;
   if(!this.e166Auth(a.actor))continue;
   try{sock.send(JSON.stringify(payload))}catch{}
  }
  return {...result,e166_patch:{seq,operation,patch:record},e166_audiences:groups.length,e167_atomic_core_event:true};
 }
 private commandRequest(actor:LabRole,command:Record<string,unknown>):Request|null{
  const identity=roles[actor];
  const operation=String(command.operation||"");
  const args=cleanData(command.args);
  const request_id=String(command.request_id||"");
  if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(request_id))return null;
  const headers:HeadersInit={
   "content-type":"application/json",
   "x-supra-auth-uid":identity.uid,
   "x-supra-session-channel":identity.channel,
   "x-supra-session-generation":"1"
  };
  const actorIdentity={user_id:"lab-"+actor,employee_code:"LAB-"+actor.toUpperCase(),role:identity.role,display_name:"E112 LAB "+actor};
  let path="",method="POST",body:Record<string,unknown>|undefined;
  if(operation==="REPORT"&&identity.role==="PICKER"){
   path="/authorized/business/shortage/create";body={sku:args.sku,request_id};
  }else if(operation==="WITHDRAW"&&identity.role==="PICKER"){
   path="/authorized/business/shortage/withdraw";body={batch_id:args.batch_id,ticket_id:args.ticket_id,request_id};
  }else if(operation==="RESOLVE"&&identity.role==="REPORTER"){
   path="/authorized/business/shortage/resolve";body={batch_id:args.batch_id,resolution:args.resolution,request_id};
  }else if(operation==="CORRECT"&&identity.role==="REPORTER"){
   path="/authorized/business/shortage/correct";body={batch_id:args.batch_id,resolution:args.resolution,request_id};
  }else if(operation==="QUEUE"&&["REPORTER","PICKPACK_ADMIN"].includes(identity.role)){
   path="/authorized/operational/reporter/queue";method="GET";
  }else if(operation==="PICKER_REPORTS"&&identity.role==="PICKER"){
   path="/authorized/operational/picker/reports";method="GET";
  }else if(operation==="REALTIME_DELTA"){
   // Exact current InventoryCore production authorized route; NO synthetic SQL implementation.
   path="/authorized/operational/realtime/delta?after_seq="+encodeURIComponent(String(args.after_seq??"0"))+"&limit=50";method="GET";
  }else if(operation==="PICKER_RESULTS"&&identity.role==="PICKER"){
   path="/authorized/operational/picker/results";method="GET";
  }else if(operation==="REPORTER_COUNTERS"&&["REPORTER","PICKPACK_ADMIN"].includes(identity.role)){
   // Current source requires a finite window; use server-clock fixture around the LAB day.
   const from=new Date(Date.now()-86400000).toISOString();
   const to=new Date(Date.now()+86400000).toISOString();
   path="/authorized/operational/reporter/counters?from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to);method="GET";
  }else if(operation==="REPORTER_RECENT"&&["REPORTER","PICKPACK_ADMIN"].includes(identity.role)){
   path="/authorized/operational/reporter/recent";method="GET";
  }else if(operation==="REPORTER_OVERDUE"&&["REPORTER","PICKPACK_ADMIN"].includes(identity.role)){
   path="/authorized/operational/reporter/overdue";method="GET";
  }else if(operation==="SKU_SEARCH"){
   path="/authorized/business/skus/search?query="+encodeURIComponent(String(args.query||"LAB-REAL"))+"&limit=50";method="GET";
  }else if(operation==="SKU_IMPORT"&&identity.role==="PICKPACK_ADMIN"){
   path="/business/skus/import";body={actor:actorIdentity,request_id,items:args.items};
  }else if(operation==="HEALTH"){
   path="/health";method="GET";
  }else return null;
  return new Request("https://e112-core.internal"+path,{method,headers,body:body?JSON.stringify(body):undefined});
 }
 private async dispatch(actor:LabRole,cmd:Record<string,unknown>){
  const req=this.commandRequest(actor,cmd);
  if(!req)return {http_status:403,body:{error:"LAB_OPERATION_NOT_ALLOWED"}};
  const start=Date.now();
  const result=await super.fetch(req);
  const body=await result.json().catch(()=>({error:"CORE_INVALID_RESPONSE"}));
  if(body && typeof body === "object" && "prepared" in body) delete (body as Record<string,unknown>).prepared;
  return {http_status:result.status,body,duration_ms:Date.now()-start};
 }
 async fetch(request:Request):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname==="/__lab/init"&&request.method==="POST"){
   return respond(this.initFixture());
  }
  if(url.pathname==="/__lab/e166/recover"&&request.method==="POST"){
   const cmd=cleanData(await request.json().catch(()=>null));const actor=cleanActor(cmd.actor);
   if(!actor)return respond({error:"UNKNOWN_LAB_ACTOR"},403);
   return respond(this.e166Read(actor,Number(cmd.after_seq||0),Number(cmd.limit||50)));
  }
  if(url.pathname==="/__lab/e166/command"&&request.method==="POST"){
   const cmd=cleanData(await request.json().catch(()=>null));const actor=cleanActor(cmd.actor);
   if(!actor)return respond({error:"UNKNOWN_LAB_ACTOR"},403);
   return respond({...await this.e166Dispatch(actor,cmd),actual_core:true,e166_lab_only:true});
  }
  if(url.pathname==="/__lab/e167/fault"&&request.method==="POST"){
   const body=cleanData(await request.json().catch(()=>null));
   if(body.enabled===true)this.labCtx.storage.sql.exec(
    "CREATE TRIGGER IF NOT EXISTS trg_e167_fault BEFORE INSERT ON e166_receivers BEGIN SELECT RAISE(ABORT,'E167_ATOMIC_INJECTED_FAIL'); END");
   else this.labCtx.storage.sql.exec("DROP TRIGGER IF EXISTS trg_e167_fault");
   return respond({ok:true,enabled:body.enabled===true,lab_only:true});
  }
  if(url.pathname==="/__lab/e166/audit"&&request.method==="GET"){
   const q=this.labCtx.storage.sql;
   const batches=q.exec<{sku:string,status:string,tickets:number}>(
    "SELECT b.sku,b.status,(SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id=b.batch_id) AS tickets FROM report_batches b ORDER BY b.sku"
   ).toArray();
   return respond({batches:batches.map(r=>({sku:r.sku,status:r.status,tickets:Number(r.tickets)})),lab_only:true});
  }
  if(url.pathname==="/__lab/health"){
   const real=await super.fetch(new Request("https://e112-core.internal/health"));
   return respond({status:real.status,real_core:await real.json(),lab_only:true},real.status);
  }
  if(url.pathname==="/__lab/command"&&request.method==="POST"){
   const command=cleanData(await request.json().catch(()=>null));
   const actor=cleanActor(command.actor);
   if(!actor)return respond({error:"UNKNOWN_LAB_ACTOR"},403);
   const result=await this.dispatch(actor,command);
   return respond({...result,actor,actual_core:true});
  }
  if(url.pathname==="/__lab/ws"&&request.headers.get("upgrade")?.toLowerCase()==="websocket"){
   const actor=cleanActor(url.searchParams.get("actor"));
   if(!actor)return respond({error:"UNKNOWN_LAB_ACTOR"},403);
   const pair=new WebSocketPair(),[client,server]=Object.values(pair);
   this.labCtx.acceptWebSocket(server);
   server.serializeAttachment({actor,e166:url.searchParams.get("e166")==="1"});
   server.send(JSON.stringify({type:"CONNECTED",actual_core:true,actor}));
   return new Response(null,{status:101,webSocket:client});
  }
  return respond({error:"LAB_ROUTE_DENIED"},404);
 }
 async webSocketMessage(socket:WebSocket,data:string|ArrayBuffer){
  const a=socket.deserializeAttachment() as {actor?:string}|null;
  const actor=cleanActor(a?.actor);
  const cmd=typeof data==="string"?cleanData((()=>{try{return JSON.parse(data);}catch{return null;}})()):{};
  if(!actor){socket.close(1008,"invalid session");return;}
  try{
   if(String(cmd.type||"")==="E166_RECOVER"){
    socket.send(JSON.stringify({type:"E166_RECOVERY",request_id:String(cmd.request_id||""),...this.e166Read(actor,Number(cleanData(cmd.args).after_seq||0),50)}));return;
   }
   const e166=String(cmd.type||"")==="E166_COMMAND";
   const result=e166?await this.e166Dispatch(actor,cmd):await this.dispatch(actor,cmd);
   socket.send(JSON.stringify({type:"RESULT",request_id:String(cmd.request_id||""),...result,actor,actual_core:true}));
  }catch{
   socket.send(JSON.stringify({type:"RESULT",request_id:String(cmd.request_id||""),http_status:500,error:"REAL_CORE_LAB_ERROR"}));
  }
 }
}
interface Env { LAB_REAL_CORE:DurableObjectNamespace; }
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  // The only listener is loopback via the test runner. Never make this public.
  if(!["/__lab/health","/__lab/init","/__lab/command","/__lab/ws","/__lab/e166/command","/__lab/e166/recover","/__lab/e166/audit","/__lab/e167/fault"].includes(url.pathname)){
   return respond({error:"LAB_ONLY"},404);
  }
  if(url.pathname==="/__lab/init"&&request.method!=="POST")return respond({error:"METHOD"},405);
  if(["/__lab/command","/__lab/e166/command","/__lab/e166/recover","/__lab/e167/fault"].includes(url.pathname)&&request.method!=="POST")return respond({error:"METHOD"},405);
  const id=env.LAB_REAL_CORE.idFromName("d173-e112-REAL-SOURCE-LOCAL-only");
  return env.LAB_REAL_CORE.get(id).fetch(request);
 }
};
