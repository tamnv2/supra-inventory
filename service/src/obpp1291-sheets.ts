/** D172 Sheet mirror: exact least-privilege SA, bounded claims/reconciliation, no APK credentials. */
import { getServiceAccountAccessToken } from "./hr-source";

export interface ObppSheetEnv {
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  D172_OBPP_SHEET_ID?: string;
}
type Item={event_key:string;kind:"RECORD"|"LOCATION"|"AUDIT";ref_id:string;revision:number;row:Record<string,unknown>};
const ROOT="inventory-core";
const sheetsScope="https://www.googleapis.com/auth/spreadsheets";
const tabs: Record<Item["kind"],string>={RECORD:"Ghi_nhan",LOCATION:"Vi_tri",AUDIT:"Nhat_ky"};
let token:{value:string;expires:number}|null=null;

function safe(v:unknown):string {
  const s=String(v??"").replace(/[\u0000-\u001F\u007F]/g," ").slice(0,512);
  // Google Sheets USER_ENTERED / RAW still apply conservative formula-escape for exports.
  return /^[=+\-@]/.test(s)?"'"+s:s;
}
function values(item:Item):string[]{
  const r=item.row;
  if(item.kind==="RECORD")return [
    safe(r.id),safe(r.date_vn),safe(r.raw_scan),safe(r.store_code),safe(r.do_code),
    safe(r.total_parcels),safe(r.location),safe(r.time_vn),safe(r.parcel_index),
    safe(r.actor_id),Number(r.deleted)?"Đã xóa":"Đã ghi nhận",safe(r.revision),safe(r.updated_at)
  ];
  if(item.kind==="LOCATION")return [safe(r.code),Number(r.active)?"Đang sử dụng":"Ngừng dùng",safe(r.actor_id),safe(r.updated_at)];
  return [safe(r.id),safe(r.record_id),safe(r.action),safe(r.revision),safe(r.time),safe(r.actor),safe(r.note)];
}
async function bearer(env:ObppSheetEnv):Promise<string> {
  if(!env.GOOGLE_RUNTIME_SA_JSON)throw Error("OBPP_SA_NOT_READY");
  if(token && token.expires>Date.now())return token.value;
  const got=await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON,sheetsScope);
  token={value:got.accessToken,expires:Date.now()+45*60_000};
  return token.value;
}
function sheetId(env:ObppSheetEnv):string {
  const id=String(env.D172_OBPP_SHEET_ID||"").trim();
  if(!/^[a-zA-Z0-9_-]{20,180}$/.test(id))throw Error("OBPP_SHEET_NOT_CONFIGURED");
  return id;
}
function core(env:ObppSheetEnv){return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(ROOT));}
async function coreApi<T>(env:ObppSheetEnv,path:string,method="GET",body?:unknown):Promise<T>{
  const resp=await core(env).fetch("https://inventory-core.internal"+path,{
    method,headers:{"x-obpp-internal":"sync","x-obpp-user-id":"SYSTEM_OBPP","x-obpp-user-role":"ROOT",
      ...(body?{"content-type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!resp.ok)throw Error("OBPP_CORE_SYNC_"+resp.status);
  return resp.json() as Promise<T>;
}
async function sheets(env:ObppSheetEnv,path:string,method="GET",payload?:unknown){
  const uri="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(sheetId(env))+path;
  const response=await fetch(uri,{method,headers:{
    authorization:"Bearer "+await bearer(env),"content-type":"application/json; charset=utf-8",accept:"application/json"
  },...(payload?{body:JSON.stringify(payload)}:{})});
  if(!response.ok)throw Error("OBPP_SHEETS_HTTP_"+response.status);
  return response.json() as Promise<Record<string,unknown>>;
}
async function syncItem(env:ObppSheetEnv,item:Item):Promise<void>{
  const tab=tabs[item.kind],key=item.kind==="LOCATION"?String(item.row.code):String(item.row.id);
  const range=encodeURIComponent("'"+tab+"'!A2:A5000");
  const index=await sheets(env,"/values/"+range+"?majorDimension=ROWS");
  const first=(index.values||[]) as unknown[][];
  let sheetRow=0;
  for(let i=0;i<first.length;i++){if(String(first[i]?.[0]||"")===key){sheetRow=i+2;break;}}
  const row=values(item),data={range:tab+"!A"+(sheetRow||""),majorDimension:"ROWS",values:[row]};
  if(sheetRow){
    await sheets(env,"/values/"+encodeURIComponent("'"+tab+"'!A"+sheetRow)+":"
      +String.fromCharCode(64+row.length)+sheetRow+"?valueInputOption=RAW","PUT",data);
  }else{
    await sheets(env,"/values/"+encodeURIComponent("'"+tab+"'!A1")+
      ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS","POST",{values:[row]});
  }
}
/**
 * Event-driven only. Worker calls after successful mutations or user refresh.
 * Claims serialize the critical section inside the DO to avoid duplicate appends.
 * If Google returns after timeout, exact first-column event ID reconciliation
 * prevents duplicate rows before retry completes.
 */
export async function drainObppSheets(env:ObppSheetEnv):Promise<{processed:number;remaining:number}>{
  sheetId(env); // fail closed if Sheet not provisioned
  let processed=0,remaining=0;
  const claimed=await coreApi<{items:Item[]}>(env,"/obpp1291/outbox/claim","POST",{limit:10});
  for(const item of claimed.items){
    try{
      await syncItem(env,item);
      await coreApi(env,"/obpp1291/outbox/ack","POST",item);
      processed++;
    }catch{
      await coreApi(env,"/obpp1291/outbox/release","POST",{event_key:item.event_key});
      remaining++;
      break; // provider down/rate-limited: no busy retry or request flood
    }
  }
  return {processed,remaining};
}
