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
  if(item.kind==="LOCATION")return [safe(r.code),Number(r.active)?"Đang sử dụng":"Ngừng dùng",safe(r.actor_id),safe(r.updated_at),safe(r.sheet_key||r.code),safe(r.revision)];
  return [safe(r.id),safe(r.record_id),safe(r.action),safe(r.revision),safe(r.time),safe(r.actor),safe(r.note)];
}
async function bearer(env:ObppSheetEnv):Promise<string> {
  if(!env.GOOGLE_RUNTIME_SA_JSON)throw Error("OBPP_SA_NOT_READY");
  if(token && token.expires>Date.now())return token.value;
  const got=await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON,sheetsScope);
  token={value:got.accessToken,expires:Date.now()+45*60_000};
  return token.value;
}
// Only a SHA-256 fingerprint of the exact Owner-created Sheet's random ID
// enters this public repo: no private locator or Google credential is committed.
const registeredSheetIdDigest = "dfdea4df19b9b31a90720783bbdca4028bc8e125a0c54c27f9c8d467d669ab40";
let resolvedSheet:{id:string;expires:number}|null=null;
async function digestId(id:string):Promise<string>{
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(id));
  return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join("");
}
export async function resolveObppSheetId(env:ObppSheetEnv):Promise<string>{
  if(resolvedSheet && resolvedSheet.expires>Date.now())return resolvedSheet.id;
  const configured=String(env.D172_OBPP_SHEET_ID||"").trim();
  if(configured){
    if(await digestId(configured)!==registeredSheetIdDigest)throw Error("OBPP_SHEET_ID_NOT_SCOPED");
    resolvedSheet={id:configured,expires:Date.now()+45*60_000};
    return configured;
  }
  if(!env.GOOGLE_RUNTIME_SA_JSON)throw Error("OBPP_SA_NOT_READY");
  // API lists only files accessible to the scoped service account. Require
  // exact fingerprint after title lookup; similarly titled files never match.
  const grant=await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON,
    "https://www.googleapis.com/auth/drive.metadata.readonly");
  const q="name = 'Ghi nhận hàng rớt OB x PP 1291' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  const url=new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q",q);
  url.searchParams.set("fields","nextPageToken,files(id,mimeType)");
  url.searchParams.set("pageSize","100");
  const response=await fetch(url.toString(),{headers:{authorization:"Bearer "+grant.accessToken}});
  if(!response.ok)throw Error("OBPP_DRIVE_DISCOVERY_HTTP_"+response.status);
  const result=await response.json() as {files?:Array<{id?:string}>;nextPageToken?:string};
  // Fail-closed if pagination could conceal exact candidate or any collision.
  if(result.nextPageToken)throw Error("OBPP_DRIVE_DISCOVERY_AMBIGUOUS");
  const matches:string[]=[];
  for(const entry of result.files||[])if(entry.id && await digestId(entry.id)===registeredSheetIdDigest)
    matches.push(entry.id);
  if(matches.length!==1)throw Error("OBPP_REGISTERED_SHEET_NOT_ACCESSIBLE");
  resolvedSheet={id:matches[0],expires:Date.now()+45*60_000};
  return matches[0];
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
  const uri="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(await resolveObppSheetId(env))+path;
  const response=await fetch(uri,{method,headers:{
    authorization:"Bearer "+await bearer(env),"content-type":"application/json; charset=utf-8",accept:"application/json"
  },...(payload?{body:JSON.stringify(payload)}:{})});
  if(!response.ok)throw Error("OBPP_SHEETS_HTTP_"+response.status);
  return response.json() as Promise<Record<string,unknown>>;
}
type SheetIndex = Map<string,number>;
async function indexForTab(env:ObppSheetEnv, tab:string, indexes:Map<string,SheetIndex>):Promise<SheetIndex>{
  const cached=indexes.get(tab);
  if(cached)return cached;
  const range=encodeURIComponent("'" + tab + "'!"+(tab==="Vi_tri"?"A2:F5000":"A2:A5000"));
  const result=await sheets(env,"/values/"+range+"?majorDimension=ROWS");
  const entries=(result.values||[]) as unknown[][];
  const map=new Map<string,number>();
  for(let i=0;i<entries.length;i++){
    const key=String(tab==="Vi_tri"?(entries[i]?.[4]||entries[i]?.[0]):entries[i]?.[0]??"");
    if(key && !map.has(key))map.set(key,i+2);
  }
  indexes.set(tab,map);
  return map;
}
async function syncItem(env:ObppSheetEnv,item:Item,indexes:Map<string,SheetIndex>):Promise<void>{
  const tab=tabs[item.kind],key=item.kind==="LOCATION"?String(item.row.sheet_key||item.row.code):String(item.row.id);
  const index=await indexForTab(env,tab,indexes);
  const sheetRow=index.get(key)||0;
  const row=values(item);
  const data={range:tab+"!A"+(sheetRow||""),majorDimension:"ROWS",values:[row]};
  if(sheetRow){
    await sheets(env,"/values/"+encodeURIComponent("'"+tab+"'!A"+sheetRow)+":"+
      String.fromCharCode(64+row.length)+sheetRow+"?valueInputOption=RAW","PUT",data);
  }else{
    const appended=await sheets(env,"/values/"+encodeURIComponent("'"+tab+"'!A1")+
      ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS","POST",{values:[row]});
    const updated=String((appended.updates as {updatedRange?:string}|undefined)?.updatedRange||"");
    const match=/!A(\d+)(?::|$)/i.exec(updated);
    if(match)index.set(key,Number(match[1]));
    else indexes.delete(tab); // Never guess a new row number after an uncertain append.
  }
}
let driveToken:{value:string;expires:number}|null=null;
async function driveBearer(env:ObppSheetEnv):Promise<string>{
  if(driveToken&&driveToken.expires>Date.now())return driveToken.value;
  if(!env.GOOGLE_RUNTIME_SA_JSON)throw Error("OBPP_SA_NOT_READY");
  const token=await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON,
    "https://www.googleapis.com/auth/drive.metadata.readonly");
  driveToken={value:token.accessToken,expires:Date.now()+45*60000};
  return token.accessToken;
}
/** Pull manual Google Sheet cell edits using only existing scoped Drive/Sheets
 * APIs. A persisted Drive modified-time watermark avoids full-sheet reads on
 * unchanged five-minute cron ticks; the manual Refresh bypasses the watermark.
 * Core accepts only existing IDs with exact matching SYNCED revision.
 */
export async function reconcileObppSheetEdits(
  env:ObppSheetEnv,force=false
):Promise<{applied:number;skipped:number;unchanged?:boolean}>{
  const id=await resolveObppSheetId(env);
  const metaResponse=await fetch("https://www.googleapis.com/drive/v3/files/"+
    encodeURIComponent(id)+"?fields=id%2CmodifiedTime",{
      headers:{authorization:"Bearer "+await driveBearer(env)}
    });
  if(!metaResponse.ok)throw Error("OBPP_DRIVE_METADATA_HTTP_"+metaResponse.status);
  const metadata=await metaResponse.json() as {modifiedTime?:string};
  const modified_time=String(metadata.modifiedTime||"");
  if(!modified_time)throw Error("OBPP_DRIVE_MODIFIED_TIME_MISSING");
  const watermark=await coreApi<{changed:boolean}>(env,"/obpp1291/sheet/watermark","POST",
    {modified_time,commit:false});
  if(!force && !watermark.changed)return {applied:0,skipped:0,unchanged:true};
  const [recordsResult,locationsResult]=await Promise.all([
    sheets(env,"/values/"+encodeURIComponent("'Ghi_nhan'!A2:M5000")+"?valueRenderOption=FORMULA"),
    sheets(env,"/values/"+encodeURIComponent("'Vi_tri'!A2:F5000")+"?valueRenderOption=FORMULA")
  ]);
  const records=((recordsResult.values||[]) as unknown[][]).flatMap(row=>{
    const id=String(row[0]||"").trim();
    const revision=Number(row[11]);
    if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(revision)||revision<1)return [];
    return [{
      id,revision,
      raw_scan:String(row[2]||""),store_code:String(row[3]||""),
      do_code:String(row[4]||""),total_parcels:Number(row[5]),
      location:String(row[6]||""),
      parcel_index:row[8]===undefined||row[8]===""?null:Number(row[8])
    }];
  });
  const locations=((locationsResult.values||[]) as unknown[][]).flatMap(row=>{
    const code=String(row[0]||"").trim();
    const sheet_key=String(row[4]||"").trim();
    const revision=Number(row[5]);
    const label=String(row[1]||"");
    if(!code||!sheet_key||!Number.isSafeInteger(revision)||revision<1||
      !["Đang sử dụng","Ngừng dùng"].includes(label))return [];
    return [{sheet_key,code,revision,active:label==="Đang sử dụng"}];
  });
  let applied=0,skipped=0;
  // Avoid oversized internal DO request bodies or CPU spikes as daily rows grow.
  for(let i=0;i<records.length;i+=200){
    const response=await coreApi<{applied:number;skipped:number}>(env,
      "/obpp1291/sheet/reconcile","POST",{records:records.slice(i,i+200),locations:[]});
    applied+=response.applied;skipped+=response.skipped;
  }
  if(locations.length){
    const response=await coreApi<{applied:number;skipped:number}>(env,
      "/obpp1291/sheet/reconcile","POST",{records:[],locations});
    applied+=response.applied;skipped+=response.skipped;
  }
  await coreApi(env,"/obpp1291/sheet/watermark","POST",{modified_time,commit:true});
  return {applied,skipped};
}
/**
 * At most 30 events per invocation. A single Durable Object lease ensures
 * two concurrent PDA /refresh/POST callbacks do not append the same Sheet row.
 * Index columns are read once per tab per drain, not once per event.
 * Failed writes retain the durable outbox; existing five-minute Worker cron
 * retries even when no Android client is open.
 */
export async function drainObppSheets(env:ObppSheetEnv):Promise<{processed:number;remaining:number;error_code?:string}>{
  let processed=0,remaining=0,error_code: string|undefined;
  const indexes=new Map<string,SheetIndex>();
  for(let batch=0;batch<3;batch++){
    const lease_token=crypto.randomUUID();
    const claimed=await coreApi<{items:Item[];busy?:boolean}>(env,
      "/obpp1291/outbox/claim","POST",{limit:10,lease_token});
    if(claimed.busy || claimed.items.length===0){
      if(!claimed.busy)await coreApi(env,"/obpp1291/outbox/finish","POST",{lease_token});
      break;
    }
    let failed=false;
    try{
      await resolveObppSheetId(env);
      for(let i=0;i<claimed.items.length;i++){
        const item=claimed.items[i];
        try{
          await syncItem(env,item,indexes);
          await coreApi(env,"/obpp1291/outbox/ack","POST",item);
          processed++;
        }catch(err){
          const code=err instanceof Error?err.message:"";
          error_code=/^OBPP_[A-Z0-9_]+$/.test(code)?code:"OBPP_SHEET_SYNC_FAILED";
          for(let j=i;j<claimed.items.length;j++)
            await coreApi(env,"/obpp1291/outbox/release","POST",{event_key:claimed.items[j].event_key});
          remaining+=claimed.items.length-i;
          failed=true;
          break;
        }
      }
    }catch(err){
      const code=err instanceof Error?err.message:"";
      error_code=/^OBPP_[A-Z0-9_]+$/.test(code)?code:"OBPP_SHEET_SYNC_FAILED";
      for(const item of claimed.items)
        await coreApi(env,"/obpp1291/outbox/release","POST",{event_key:item.event_key});
      remaining+=claimed.items.length;
      failed=true;
    }finally{
      await coreApi(env,"/obpp1291/outbox/finish","POST",{lease_token});
    }
    if(failed||claimed.items.length<10)break;
  }
  return {processed,remaining,...(error_code?{error_code}:{})};
}
