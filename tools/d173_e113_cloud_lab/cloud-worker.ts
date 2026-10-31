// D173-E113: isolated Cloudflare metered TEST gate for exact InventoryCore source.
import {LabRealCore} from "../d173_e112_real_core_lab/worker";
export {LabRealCore};
interface Env {
 LAB_REAL_CORE: DurableObjectNamespace;
 M2_LAB_GATE_KEY?: string;
 M2_LAB_EXPIRES_AT?: string;
 APP_ENV:string; PROJECT_KEY:string; FIREBASE_PROJECT_ID:string;
}
const reply=(v:object,code=200)=>Response.json(v,{status:code,headers:{"cache-control":"no-store","x-supra-m2-lab":"ISOLATED"}});
const paths=new Set(["/__lab/health","/__lab/init","/__lab/command","/__lab/ws","/__lab/e166/command","/__lab/e166/recover","/__lab/e166/audit","/__lab/e167/fault"]);
function equal(a:string,b:string):boolean{
 if(!a||!b||a.length!==b.length)return false;
 let delta=0;for(let i=0;i<a.length;i++)delta|=a.charCodeAt(i)^b.charCodeAt(i);
 return delta===0;
}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const u=new URL(request.url);
  // Fail closed until both secrets are explicitly set by gated GitHub Actions.
  const validSecret=!!env.M2_LAB_GATE_KEY&&!!env.M2_LAB_EXPIRES_AT;
  const expiry=Number(env.M2_LAB_EXPIRES_AT||0);
  if(!validSecret||!Number.isSafeInteger(expiry)||Date.now()>=expiry) return reply({error:"LAB_CLOSED"},403);
  const websocket=u.pathname==="/__lab/ws"&&request.headers.get("upgrade")?.toLowerCase()==="websocket";
  const supplied=websocket?
   (request.headers.get("sec-websocket-protocol")||"").split(",").map(x=>x.trim()).find(x=>x.startsWith("m2lab."))?.slice(6)||"":
   (request.headers.get("authorization")||"").replace(/^Bearer /i,"").trim();
  if(!equal(supplied,env.M2_LAB_GATE_KEY))return reply({error:"LAB_ACCESS_DENIED"},401);
  if(!paths.has(u.pathname))return reply({error:"LAB_ROUTE_DENIED"},404);
  if(["/__lab/command","/__lab/e166/command","/__lab/e166/recover","/__lab/e167/fault"].includes(u.pathname)&&request.method!=="POST")return reply({error:"METHOD"},405);
  if(u.pathname==="/__lab/init"&&request.method!=="POST")return reply({error:"METHOD"},405);
  if(["/__lab/health","/__lab/e166/audit"].includes(u.pathname)&&request.method!=="GET")return reply({error:"METHOD"},405);
  if(u.pathname==="/__lab/ws"&&!websocket)return reply({error:"UPGRADE_REQUIRED"},426);
  const variant=u.searchParams.get("variant");
  if(!["http","m2","e166-a","e166-b","e166-c"].includes(String(variant)))return reply({error:"VARIANT_REQUIRED"},400);
  const e166=String(variant).startsWith("e166-");
  const caseId=u.searchParams.get("case")||"";
  if(e166&&!/^(local|[0-9]{8,16})$/.test(caseId))return reply({error:"E166_RUN_CASE_REQUIRED"},400);
  const objectName=e166?"D173-E166-"+caseId+"-"+variant:"D173-E115-OCT27-"+variant;
  const id=env.LAB_REAL_CORE.idFromName(objectName);
  const result=await env.LAB_REAL_CORE.get(id).fetch(request);
  if(websocket){
    const negotiated=request.headers.get("sec-websocket-protocol")||"";
    const accepted=negotiated.split(",").map(x=>x.trim()).find(x=>x.startsWith("m2lab."));
    if(!accepted)return reply({error:"LAB_PROTOCOL_REQUIRED"},400);
    const headers=new Headers(result.headers);
    headers.set("Sec-WebSocket-Protocol",accepted);
    return new Response(null,{status:101,webSocket:(result as Response&{webSocket?:WebSocket}).webSocket,headers});
  }
  const headers=new Headers(result.headers);
  headers.set("cache-control","no-store");
  headers.set("x-supra-m2-lab","ISOLATED");
  if(variant?.startsWith("e166-"))headers.set("x-e166-test-object-suffix",id.toString().slice(-8));
  return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
 }
};
