/** D172 Sheet mirror: exact least-privilege SA, bounded claims/reconciliation, no APK credentials. */
import { getServiceAccountAccessToken } from "./hr-source";

export interface ObppSheetEnv {
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  D172_OBPP_SHEET_ID?: string;
}
type Item={event_key:string;kind:"RECORD"|"LOCATION"|"AUDIT"|"RECORD_DELETE"|"LOCATION_DELETE";ref_id:string;revision:number;row:Record<string,unknown>};
const ROOT="inventory-core";
const sheetsScope="https://www.googleapis.com/auth/spreadsheets";
const tabs: Record<Item["kind"],string>={
  RECORD:"Ghi nhận Rớt", LOCATION:"Vị trí", AUDIT:"Nhật ký thao tác",
  RECORD_DELETE:"Ghi nhận Rớt", LOCATION_DELETE:"Vị trí"
};
let token:{value:string;expires:number}|null=null;

function safe(v:unknown):string {
  const s=String(v??"").replace(/[\u0000-\u001F\u007F]/g," ").slice(0,512);
  // Google Sheets USER_ENTERED / RAW still apply conservative formula-escape for exports.
  return /^[=+\-@]/.test(s)?"'"+s:s;
}
function safeNote(v:unknown):string {
  const note=String(v??"").replace(/\r\n?/g,"\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g,"").slice(0,500);
  return /^[=+\-@]/.test(note)?"'"+note:note;
}
function vnDateTime(value:unknown):string { const n=Date.parse(String(value||'')); if(!Number.isFinite(n))return safe(value); const t=new Date(n+25200000).toISOString(); return t.slice(8,10)+'/'+t.slice(5,7)+'/'+t.slice(0,4)+' '+t.slice(11,19); }
function values(item:Item):string[]{
  const r=item.row;
  if(item.kind==="RECORD")return [
    safe(r.id),safe(r.date_vn),safe(r.time_vn),safe(r.raw_scan),
    safe(r.store_code),safe(r.do_code),safe(r.total_parcels),
    safe(r.location),safe(r.actor_name||String(r.actor_id||"").split(":").pop()),
    vnDateTime(r.updated_at),safeNote(r.note)
  ];
  if(item.kind==="LOCATION")return [safe(r.code),
    safe(r.actor_name||String(r.actor_id||"").split(":").pop()),
    vnDateTime(r.updated_at),safe(r.sheet_key||r.code),safe(r.revision)];
  return [safe(r.id),safe(r.record_id),safe(r.action),safe(r.revision),vnDateTime(r.time),safe(r.actor),safe(r.note)];
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
type SheetIndex = {rows:Map<string,number>;lastBusinessRow:number};
// D172-E047: these are the ONLY business-owned physical columns per tab.
const businessWidth:Record<string,number>={
  "Ghi nhận Rớt":11,"Vị trí":5,"Nhật ký thao tác":7
};
const schemaHeaders:Record<string,string>={
  "Ghi nhận Rớt":"ID","Vị trí":"Vị trí","Nhật ký thao tác":"Mã sự kiện"
};
let noteSchemaReadyUntil=0;
/** Scope-gated, idempotent K1 migration. Never modify columns A:J or copy the header to data. */
async function ensureNoteColumn(env:ObppSheetEnv):Promise<void>{
  if(noteSchemaReadyUntil>Date.now())return;
  const tab="Ghi nhận Rớt",sheetId=await tabId(env,tab);
  const hdr=await sheets(env,"/values/"+encodeURIComponent("'"+tab+"'!A1:K1"));
  const row=((hdr.values||[]) as unknown[][])[0]||[];
  if(String(row[0]||"")!=="ID")throw Error("OBPP_SHEET_SCHEMA_MIGRATION_REQUIRED");
  const existing=String(row[10]||"");
  if(existing && existing!=="Ghi chú")throw Error("OBPP_SHEET_NOTE_K_CONFLICT");
  if(!existing){
    const meta=await sheets(env,"?fields=sheets(properties(sheetId,title,gridProperties(columnCount)))");
    const sheet=((meta.sheets||[]) as Array<{properties?:{sheetId?:number;title?:string;gridProperties?:{columnCount?:number}}}>)
      .find(s=>s.properties?.sheetId===sheetId);
    const count=Number(sheet?.properties?.gridProperties?.columnCount||0);
    if(!sheet || count<1)throw Error("OBPP_SHEET_GRID_NOT_READY");
    const requests:Record<string,unknown>[]=[];
    if(count<11)requests.push({appendDimension:{sheetId,dimension:"COLUMNS",length:11-count}});
    requests.push({copyPaste:{source:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:1},
      destination:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:10,endColumnIndex:11},pasteType:"PASTE_FORMAT"}});
    requests.push({updateCells:{start:{sheetId,rowIndex:0,columnIndex:10},
      rows:[{values:[{userEnteredValue:{stringValue:"Ghi chú"}}]}],fields:"userEnteredValue"}});
    await sheets(env,":batchUpdate","POST",{requests});
    const after=await sheets(env,"/values/"+encodeURIComponent("'"+tab+"'!K1"));
    if(String(((after.values||[]) as unknown[][])[0]?.[0]||"")!=="Ghi chú")
      throw Error("OBPP_SHEET_NOTE_K_VERIFY_FAILED");
  }
  noteSchemaReadyUntil=Date.now()+5*60_000;
}
async function ensureHeader(env:ObppSheetEnv,tab:string):Promise<void>{
  // No blind writes while the old Ghi_nhan header is still at row 7.
  const range="'"+tab+"'!A1";
  const result=await sheets(env,"/values/"+encodeURIComponent(range));
  const head=String(((result.values||[]) as unknown[][])[0]?.[0]||"");
  if(head!==schemaHeaders[tab])throw Error("OBPP_SHEET_SCHEMA_MIGRATION_REQUIRED");
  if(tab==="Ghi nhận Rớt")await ensureNoteColumn(env);
}
export async function checkObppSheetSchema(env:ObppSheetEnv):Promise<boolean>{
  await resolveObppSheetId(env);
  try{
    for(const tab of ["Ghi nhận Rớt","Vị trí","Nhật ký thao tác"])
      await ensureHeader(env,tab);
    return true;
  }catch{return false;}
}
async function indexForTab(env:ObppSheetEnv, tab:string, indexes:Map<string,SheetIndex>):Promise<SheetIndex>{
  const cached=indexes.get(tab);
  if(cached)return cached;
  await ensureHeader(env,tab);
  // Read the physical A-based grid, not the Sheets append table detected from visible columns.
  const end=tab==="Vị trí"?"E":tab==="Ghi nhận Rớt"?"K":"G";
  const range=encodeURIComponent("'"+tab+"'!A2:"+end+"50000");
  const result=await sheets(env,"/values/"+range+"?majorDimension=ROWS");
  const entries=(result.values||[]) as unknown[][];
  const map=new Map<string,number>();
  let lastBusinessRow=1; // Header at row 1; never count auxiliary columns.
  for(let i=0;i<entries.length;i++){
    // Even an unindexed/partially corrupted A:business-end row is occupied;
    // never replace it merely because its immutable ID was not recognized.
    if((entries[i]||[]).some(value=>String(value??"").length>0))lastBusinessRow=i+2;
    const cells=entries[i]||[];
    // Old values.append sometimes shifted all ten record values to B:K.
    // Index that physically shifted row by its immutable UUID, so the next
    // one-way Core repair corrects it IN PLACE instead of appending a duplicate.
    const shiftedRecord=tab==="Ghi nhận Rớt" && !cells[0] &&
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(cells[1]||"")) &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(String(cells[2]||""));
    const key=String(tab==="Vị trí"?(cells[3]||cells[0]):shiftedRecord?cells[1]:cells[0]??"");
    if(key && !map.has(key))map.set(key,i+2);
  }
  const indexed={rows:map,lastBusinessRow};
  indexes.set(tab,indexed);
  return indexed;
}
async function tabInfo(env:ObppSheetEnv,tab:string):Promise<{id:number;rowCount:number}>{
  const metadata=await sheets(env,"?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))");
  const sheetsList=(metadata.sheets||[]) as Array<{properties?:{
    title?:string;sheetId?:number;gridProperties?:{rowCount?:number}
  }}>;
  const props=sheetsList.find(row=>row.properties?.title===tab)?.properties;
  if(typeof props?.sheetId!=="number")throw Error("OBPP_SHEET_TAB_NOT_FOUND");
  const rowCount=props.gridProperties?.rowCount;
  if(!Number.isSafeInteger(rowCount)||!rowCount||rowCount<1)
    throw Error("OBPP_SHEET_GRID_NOT_READY");
  return {id:props.sheetId,rowCount};
}
async function tabId(env:ObppSheetEnv,tab:string):Promise<number>{
  return (await tabInfo(env,tab)).id;
}
async function syncItem(env:ObppSheetEnv,item:Item,indexes:Map<string,SheetIndex>):Promise<void>{
  const tab=tabs[item.kind],deleting=item.kind.endsWith("_DELETE");
  const isLocation=item.kind==="LOCATION"||item.kind==="LOCATION_DELETE";
  const key=isLocation?String(item.row.sheet_key||item.row.code):String(item.row.id);
  const index=await indexForTab(env,tab,indexes);
  const sheetRow=index.rows.get(key)||0;
  if(deleting){
    if(sheetRow){
      // Delete/move only business cells. deleteDimension(ROWS) shifted auxiliary
      // L:Z data too, so never use it on a mixed-use tab.
      await sheets(env,":batchUpdate","POST",{requests:[{deleteRange:{range:{
        sheetId:await tabId(env,tab),
        startRowIndex:sheetRow-1,endRowIndex:sheetRow,
        startColumnIndex:0,endColumnIndex:businessWidth[tab]
      },shiftDimension:"ROWS"}}]});
      indexes.delete(tab); // Business cell positions shifted: refresh mapping.
    }
    return;
  }
  const row=values(item);
  // Explicit Google GridData writes: never use values.append's table discovery,
  // which can select B instead of A after a column is hidden or table is edited.
  // Always set plain body style. Google Sheets header row 1 is never copied.
  const {id:sheetId,rowCount}=await tabInfo(env,tab);
  // D172-E041: The registered record Sheet is Core->Sheet only. When the
  // authoritative record ID is present in physical A, border each A:K cell
  // as part of the SAME GridData write. No extra Google API request or GAS.
  const recordHasId=item.kind==="RECORD" && row[0].trim().length>0;
  const thinBorder={style:"SOLID",color:{red:0.72,green:0.75,blue:0.80}};
  const plain=(text:string)=>({
    userEnteredValue:{stringValue:text},
    userEnteredFormat:{
      backgroundColor:{red:1,green:1,blue:1},
      textFormat:{bold:false},
      ...(recordHasId?{borders:{
        top:thinBorder,bottom:thinBorder,left:thinBorder,right:thinBorder
      }}:{})
    }
  });
  const cells:Record<string,unknown>[]=row.map(plain);
  if(sheetRow){
    // E034 used to clear K when repairing B:K legacy drift. K now owns
    // the Note field, so write all eleven cells explicitly and NEVER blank K.
    await sheets(env,":batchUpdate","POST",{requests:[{updateCells:{
      start:{sheetId,rowIndex:sheetRow-1,columnIndex:0},
      rows:[{values:cells}],fields:"userEnteredValue,userEnteredFormat"
    }}]});
  }else{
    // Place immediately after the last occupied business row, regardless of
    // auxiliary values in L:Z / F:Z / H:Z. Never use sheet-wide appendCells.
    const targetRow=index.lastBusinessRow+1;
    if(targetRow>50000)throw Error("OBPP_SHEET_BUSINESS_RANGE_LIMIT");
    if(row.length!==businessWidth[tab])throw Error("OBPP_SHEET_BUSINESS_WIDTH_CONFLICT");
    const requests:Record<string,unknown>[]=[];
    // Only grow the physical grid when necessary; adding blank grid rows
    // never shifts or rewrites existing auxiliary cells.
    if(targetRow>rowCount)requests.push({appendDimension:{
      sheetId,dimension:"ROWS",length:targetRow-rowCount
    }});
    requests.push({updateCells:{
      start:{sheetId,rowIndex:targetRow-1,columnIndex:0},
      rows:[{values:cells}],fields:"userEnteredValue,userEnteredFormat"
    }});
    await sheets(env,":batchUpdate","POST",{requests});
    // A subsequent event must re-read the exact physical business row index
    // (also handles uncertain Google responses and outbox ACK retries).
    indexes.delete(tab);
  }
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


/**
 * D172-E018: bounded one-way mirror repair from authoritative Core rows.
 * Sheet cells never flow into Core. Compare only and re-enqueue the exact
 * server revision; existing leased outbox performs safe idempotent writes.
 */
export async function repairObppSheetMirror(env:ObppSheetEnv):
 Promise<{requeued:number;scanned:number;partial:boolean}> {
  let requeued=0,scanned=0,partial=false;
  for(const kind of ["LOCATION","RECORD","AUDIT"] as const){
    const tab=tabs[kind];
    const last=kind==="LOCATION"?"E":kind==="RECORD"?"K":"G";
    const sheetResult=await sheets(env,"/values/"+encodeURIComponent("'"+tab+"'!A2:"+last+"50000")+
      "?valueRenderOption=UNFORMATTED_VALUE");
    const actual=new Map<string,string[]>();
    for(const row of (sheetResult.values||[]) as unknown[][]){
      const key=String(kind==="LOCATION"?(row?.[3]||row?.[0]):row?.[0]??"");
      if(key && !actual.has(key))actual.set(key,row.map(x=>String(x??"")));
    }
    const refs:Array<{id:string;revision:number}>=[];
    for(let offset=0;offset<10000;offset+=500){
      const snapshot=await coreApi<{items:Record<string,unknown>[];has_more:boolean}>(env,
        "/obpp1291/sheet/snapshot?kind="+kind+"&limit=500&offset="+offset);
      for(const row of snapshot.items){
        scanned++;
        const item:Item={kind,event_key:"",ref_id:String(row.id||row.code||""),
          revision:Number(row.revision||0),row};
        const key=kind==="LOCATION"?String(row.sheet_key||row.code||""):String(row.id||"");
        const expected=values(item);
        const got=actual.get(key);
        if(!got || expected.some((v,i)=>v!==String(got[i]??""))){
          refs.push({id:key,revision:item.revision});
        }else if(kind==="RECORD" && String(row.sync_status)!=="SYNCED"){
          // Google already contains this exact revision: an interrupted ACK
          // must not leave a yellow status forever or issue another write.
          await coreApi(env,"/obpp1291/sheet/confirm-record","POST",
            {id:String(row.id),revision:Number(row.revision)});
        }
      }
      if(!snapshot.has_more)break;
      if(offset===9500)partial=true;
    }
    for(let i=0;i<refs.length;i+=100){
      const out=await coreApi<{queued:number}>(env,"/obpp1291/sheet/requeue","POST",
        {kind,refs:refs.slice(i,i+100)});
      requeued+=out.queued;
    }
    if(kind!=="AUDIT"){
      const deletes=await coreApi<{items:Array<{kind:string;ref_id:string;sheet_key:string;revision:number}>}>(env,
        "/obpp1291/sheet/deletions");
      const orphaned=deletes.items.filter(item=>item.kind===kind&&actual.has(
        kind==="LOCATION"?item.sheet_key:item.ref_id));
      for(let i=0;i<orphaned.length;i+=100){
        const out=await coreApi<{queued:number}>(env,"/obpp1291/sheet/requeue","POST",
          {kind:kind+"_DELETE",refs:orphaned.slice(i,i+100).map(t=>({id:t.ref_id,revision:t.revision}))});
        requeued+=out.queued;
      }
    }
  }
  return {requeued,scanned,partial};
}
