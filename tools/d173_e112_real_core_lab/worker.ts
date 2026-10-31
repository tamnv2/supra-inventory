// D173-E112: ACTUAL published InventoryCore source in an isolated LOCAL-only DO.
// This file is NEVER part of service/src/deployed Worker.
// Ephemeral lab identity is deliberately NOT production Firebase authentication.
import { InventoryCore } from "../../service/src/core";

type LabRole = "p1" | "p2" | "r1" | "agent1";
const roles: Record<LabRole,{uid:string,channel:string,role:string}>={
 p1:{uid:"d173lab-picker-1",channel:"WEB",role:"PICKER"},
 p2:{uid:"d173lab-picker-2",channel:"WEB",role:"PICKER"},
 r1:{uid:"d173lab-reporter-1",channel:"WEB",role:"REPORTER"},
 agent1:{uid:"d173lab-agent-1",channel:"WEB",role:"PICKPACK_ADMIN"}
};
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
  return {ok:true,source:"service/src/core.ts",schema_version:17,local_only:true,actors:Object.keys(roles)};
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
   server.serializeAttachment({actor});
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
   const result=await this.dispatch(actor,cmd);
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
  if(!["/__lab/health","/__lab/init","/__lab/command","/__lab/ws"].includes(url.pathname)){
   return respond({error:"LAB_ONLY"},404);
  }
  if(url.pathname==="/__lab/init"&&request.method!=="POST")return respond({error:"METHOD"},405);
  if(url.pathname==="/__lab/command"&&request.method!=="POST")return respond({error:"METHOD"},405);
  const id=env.LAB_REAL_CORE.idFromName("d173-e112-REAL-SOURCE-LOCAL-only");
  return env.LAB_REAL_CORE.get(id).fetch(request);
 }
};
