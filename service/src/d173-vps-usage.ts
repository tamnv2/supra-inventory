// D173-E060 VPS-only optional usage monitor. Read-only: no InventoryCore/Firestore writes.
// Every upstream field is provider-sourced or explicitly N/A; never relabel shared usage.
import { getServiceAccountAccessToken } from "./hr-source";

export type UsageMonitorEnv = {
  D166_CF_READ_TOKEN?: string;
  D166_CF_ACCOUNT_ID?: string;
  D173_CF_EMAIL_ANALYTICS_READ?: string;
  D173_CF_ZONE_ID?: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  FIREBASE_PROJECT_ID: string;
};
export type UsagePoint = { at: string; value: number };
export type UsageEntry = {
  id: string; label: string; provider: string; scope: string; unit: string;
  status: string; total: number | null; latest_at: string | null;
  points: UsagePoint[]; period: string; denominator: number | null;
  target_scope: string; note?: string;
  sync_minutes?: number; last_success_at?: string; cycle_start?: string; cycle_end?: string;
};
const CF_URL = "https://api.cloudflare.com/client/v4";
const GCP_MONITOR = "https://monitoring.googleapis.com/v3/projects/";
const DAY_MS = 86400000;
const MAX_WINDOW_DAYS = 30;
// Cache in Worker isolate: no extra DO/Firestore writes.
let monitoringTokenCache: {token:string; expires:number}|null=null;
let billingPeriodCache: {item:UsageEntry; expires:number}|null=null;
// Isolate-local read-through cache only. Never persists to DO SQL, Firestore or RTDB.
const d173UsageCache=new Map<string,{expires:number;entry:UsageEntry}>();
function syncMinutes(id:string):number {
  if(id==="cf_do_sql_storage"||id==="cf_worker_billed_cost")return 1440;
  if(id==="firestore_reads"||id==="firestore_writes"||id==="firestore_deletes"||
     id==="cf_do_requests"||id==="cf_do_duration"||id==="cf_do_rows_read"||
     id==="cf_do_rows_written"||id==="cf_worker_requests"||id==="cf_worker_cpu")return 5;
  if(id==="cf_d1_rows_read"||id==="rtdb_https_requests"||id==="rtdb_api_hits")return 15;
  if(id==="cf_emails_sent"||id.startsWith("cloud_run_")||id==="rtdb_sent_bytes"||
     id==="rtdb_payload_bytes"||id==="rtdb_protocol_bytes"||id==="rtdb_rules"||
     id.endsWith("_requests"))return 30;
  return 60;
}
function cachedMetric(id:string,window:string):UsageEntry|null {
  const x=d173UsageCache.get(window+":"+id);
  return x&&x.expires>Date.now()?{...x.entry}:null;
}
function storeMetric(m:UsageEntry,window:string):UsageEntry {
  const minutes=window==="24h"?syncMinutes(m.id):Math.max(60,syncMinutes(m.id));
  m.sync_minutes=minutes;
  if(m.status==="OK"||m.status==="BILLING_PERIOD") {
    m.last_success_at=new Date().toISOString();
    d173UsageCache.set(window+":"+m.id,{expires:Date.now()+minutes*60000,entry:{...m}});
  }
  return m;
}
const GOOGLE = [
  ["firestore_reads","Firestore Reads","firestore.googleapis.com/document/read_ops_count","firestore","operations"],
  ["firestore_writes","Firestore Writes","firestore.googleapis.com/document/write_ops_count","firestore","operations"],
  ["firestore_deletes","Firestore Deletes","firestore.googleapis.com/document/delete_ops_count","firestore","operations"],
  ["firestore_connections","Firestore Connections","firestore.googleapis.com/network/active_connections","firestore","connections"],
  ["firestore_listeners","Firestore Listeners","firestore.googleapis.com/network/snapshot_listeners","firestore","listeners"],
  ["firestore_rules","Firestore Rules","firestore.googleapis.com/rules/evaluation_count","firestore","operations"],
  ["firestore_storage","Firestore Storage","firestore.googleapis.com/storage/data_and_index_storage_bytes","firestore","bytes"],
  ["fcm_requests","FCM API Requests","serviceruntime.googleapis.com/api/request_count","api:fcm.googleapis.com","requests"],
  ["auth_identity_requests","Identity Toolkit API","serviceruntime.googleapis.com/api/request_count","api:identitytoolkit.googleapis.com","requests"],
  ["auth_secure_requests","Secure Token API","serviceruntime.googleapis.com/api/request_count","api:securetoken.googleapis.com","requests"],
  ["sheets_requests","Google Sheets API","serviceruntime.googleapis.com/api/request_count","api:sheets.googleapis.com","requests"],
  ["drive_requests","Google Drive API","serviceruntime.googleapis.com/api/request_count","api:drive.googleapis.com","requests"],
  ["cloud_run_requests","Cloud Run Requests (Project)","run.googleapis.com/request_count","run","requests"],
  ["cloud_run_instances","Cloud Run Instances (Project)","run.googleapis.com/container/instance_count","run","instances"],
  ["cloud_run_billable_time","Cloud Run Billable Time (Project)","run.googleapis.com/container/billable_instance_time","run","seconds"],
  ["cloud_run_agent_log_requests","Agent Log Function Requests","run.googleapis.com/request_count","run:agentloguploadwritten","requests"],
  ["rtdb_api_hits","RTDB API Hits","firebasedatabase.googleapis.com/network/api_hits_count","rtdb","requests"],
  ["rtdb_https_requests","RTDB HTTPS Requests","firebasedatabase.googleapis.com/network/https_requests_count","rtdb","requests"],
  ["rtdb_connections","RTDB Connections","firebasedatabase.googleapis.com/network/active_connections","rtdb","connections"],
  ["rtdb_monthly_sent","RTDB Monthly Sent","firebasedatabase.googleapis.com/network/monthly_sent","rtdb","bytes"],
  ["rtdb_monthly_sent_limit","RTDB Monthly Sent Limit","firebasedatabase.googleapis.com/network/monthly_sent_limit","rtdb","bytes"],
  ["rtdb_sent_bytes","RTDB Sent Bytes","firebasedatabase.googleapis.com/network/sent_bytes_count","rtdb","bytes"],
  ["rtdb_payload_bytes","RTDB Payload Bytes","firebasedatabase.googleapis.com/network/sent_payload_bytes_count","rtdb","bytes"],
  ["rtdb_protocol_bytes","RTDB Payload+Protocol Bytes","firebasedatabase.googleapis.com/network/sent_payload_and_protocol_bytes_count","rtdb","bytes"],
  ["rtdb_storage_bytes","RTDB Storage","firebasedatabase.googleapis.com/storage/total_bytes","rtdb","bytes"],
  ["rtdb_rules","RTDB Rules","firebasedatabase.googleapis.com/rules/evaluation_count","rtdb","operations"],
] as const;

type CfSpec = readonly [string,string,string,string,string,string];
const CLOUDFLARE: readonly CfSpec[] = [
  ["cf_do_requests","DO Compute Requests","durableObjectsInvocationsAdaptiveGroups","sum","requests","requests"],
  ["cf_do_duration","DO Compute Duration","durableObjectsPeriodicGroups","sum","duration","GB-s"],
  ["cf_do_rows_read","DO Rows Read","durableObjectsPeriodicGroups","sum","rowsRead","rows"],
  ["cf_do_rows_written","DO Rows Written","durableObjectsPeriodicGroups","sum","rowsWritten","rows"],
  ["cf_worker_requests","Workers Requests","workersInvocationsAdaptive","sum","requests","requests"],
  ["cf_worker_cpu","Workers CPU","workersInvocationsAdaptive","sum","cpuTimeUs","microseconds"],
  ["cf_d1_rows_read","D1 Rows Read","d1AnalyticsAdaptiveGroups","sum","rowsRead","rows"],
  ["cf_d1_storage","D1 Storage","d1StorageAdaptiveGroups","max","databaseSizeBytes","bytes"]
];
const GAUGE = new Set(["firestore_connections","firestore_listeners","firestore_storage",
  "cloud_run_instances","rtdb_connections","rtdb_monthly_sent",
  "rtdb_monthly_sent_limit","rtdb_storage_bytes","cf_d1_storage"]);
function validNumber(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n=Number(v); return Number.isFinite(n) && n>=0 ? n : null;
}
function empty(id:string,label:string,provider:string,scope:string,unit:string,status="UNAVAILABLE",period="24h"): UsageEntry {
  return {id,label,provider,scope,unit,status,total:null,latest_at:null,points:[],
    denominator:null,target_scope:"NONE",period};
}
function pointStamp(window:string,v:string):string {
  if (window==="30d") return v.slice(0,10);
  return v.slice(0,16);
}
function dateFloorUTC(time:number):string {return new Date(time).toISOString().slice(0,10);}
function safeStatus(status:number):string{
  if(status===401||status===403)return "PERMISSION";
  if(status===429)return "RATE_LIMIT";
  if(status===404)return "NOT_FOUND";
  return "HTTP_"+status;
}
async function boundedJson(url:string, init:RequestInit, timeoutMs=14000):Promise<{code:number;data:any}> {
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try {
    const response=await fetch(url,{...init,signal:ctrl.signal});
    if(!response.ok)return {code:response.status,data:null};
    return {code:200,data:await response.json()};
  }catch{return {code:0,data:null};}
  finally{clearTimeout(timer);}
}
async function googleMetric(spec:typeof GOOGLE[number],bearer:string,start:Date,end:Date,window:string):Promise<UsageEntry>{
  const [id,label,type,group,unit]=spec;
  const scope=group==="run"?"GCP_PROJECT_SHARED":group.startsWith("run:")?"GOOGLE_FUNCTION":"GCP_PROJECT";
  const result=empty(id,label,"GOOGLE",scope,unit,"NO_DATA",window);
  if(!bearer){result.status="AUTH_UNAVAILABLE";return result;}
  const resource=group==="firestore"
    ? 'resource.type="firestore.googleapis.com/Database" AND resource.labels.database_id="(default)"'
    : group==="rtdb"?'resource.type="firebase_namespace"'
    : group.startsWith("api:")?'resource.type="consumed_api" AND resource.labels.service="'+group.slice(4)+'"'
    : group.startsWith("run:")?'resource.type="cloud_run_revision" AND resource.labels.service_name="'+group.slice(4)+'"'
    : 'resource.type="cloud_run_revision"';
  const gauge=GAUGE.has(id);
  const params=new URLSearchParams({
    filter:'metric.type="'+type+'" AND '+resource,
    "interval.startTime":start.toISOString(),"interval.endTime":end.toISOString(),
    view:"FULL",pageSize:"1000", "aggregation.alignmentPeriod":window==="24h"?"300s":window==="7d"?"3600s":"86400s",
    "aggregation.perSeriesAligner":gauge?"ALIGN_MAX":"ALIGN_SUM",
    "aggregation.crossSeriesReducer":gauge?"REDUCE_MAX":"REDUCE_SUM"
  });
  const grouped=new Map<string,number>();
  let lastAt="";
  let page=0, next="";
  do{
    if(next)params.set("pageToken",next);
    const response=await boundedJson(GCP_MONITOR+"supra-inventory-beta/timeSeries?"+params.toString(),
      {headers:{authorization:"Bearer "+bearer,"X-Goog-User-Project":"supra-inventory-beta"}});
    if(response.code!==200){result.status=response.code?safeStatus(response.code):"PROVIDER_TIMEOUT";return result;}
    const data=response.data as {timeSeries?:Array<{points?:Array<{interval?:{endTime?:string};value?:{int64Value?:string;doubleValue?:number}}>}>,nextPageToken?:string};
    if(!data||!Array.isArray(data.timeSeries||[])){result.status="MALFORMED";return result;}
    for(const series of data.timeSeries){
      for(const p of series.points||[]){
        const t=p.interval?.endTime||"";
        const value=validNumber(p.value?.int64Value??p.value?.doubleValue);
        if(!t||value===null)continue;
        const key=pointStamp(window,t);
        grouped.set(key,gauge?Math.max(grouped.get(key)??0,value):(grouped.get(key)||0)+value);
        if(t>lastAt)lastAt=t;
      }
    }
    next=String(data.nextPageToken||"");
    page++;
  }while(next&&page<4);
  if(next){result.status="TRUNCATED";return result;}
  result.points=[...grouped.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([at,value])=>({at,value}));
  result.latest_at=lastAt||null;
  result.total=result.points.length?(gauge?Math.max(...result.points.map(p=>p.value)):result.points.reduce((n,p)=>n+p.value,0)):null;
  result.status=result.points.length?"OK":"NO_DATA";
  return result;
}
async function cfMetric(spec:CfSpec, token:string, account:string,start:Date,end:Date,window:string):Promise<UsageEntry> {
  const [id,label,dataset,field,metric,unit]=spec;
  const scope=id.startsWith("cf_worker")?"CF_WORKER":"CF_ACCOUNT_SHARED";
  const r=empty(id,label,"CLOUDFLARE",scope,unit,"NO_DATA",window);
  if(!token||!account){r.status="AUTH_UNAVAILABLE";return r;}
  const timeKey=window==="24h"?"datetimeFiveMinutes":window==="7d"?"datetimeHour":"date";
  const timeFilter=dataset==="workersInvocationsAdaptive"
    ? 'datetime_geq:"'+start.toISOString()+'",datetime_leq:"'+end.toISOString()+'",scriptName:"supra-inventory-beta"'
    : 'date_geq:"'+dateFloorUTC(start.getTime())+'",date_leq:"'+dateFloorUTC(end.getTime())+'"';
  const selection=field+"{"+metric+"}";
  const query='{viewer{accounts(filter:{accountTag:"'+account+
    '"}){x:'+dataset+'(filter:{'+timeFilter+'},limit:1000){dimensions{'+timeKey+'} '+selection+'}}}}';
  const response=await boundedJson(CF_URL+"/graphql",{
    method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},
    body:JSON.stringify({query})});
  if(response.code!==200){r.status=response.code?safeStatus(response.code):"PROVIDER_TIMEOUT";return r;}
  if(response.data?.errors?.length){r.status="SCHEMA_OR_PERMISSION";return r;}
  const acc=response.data?.data?.viewer?.accounts;
  if(!Array.isArray(acc)||acc.length!==1||!Array.isArray(acc[0].x)){r.status="NO_SCOPE_DATA";return r;}
  if(acc[0].x.length>=1000){r.status="TRUNCATED";return r;}
  const map=new Map<string,number>();
  for(const row of acc[0].x){
    const at=String(row?.dimensions?.[timeKey]||"");
    const v=validNumber(row?.[field]?.[metric]);
    if(!at||v===null)continue;
    // Remove UTC calendar spillover from day-scoped provider queries.
    if(window==="24h"&&Date.parse(at)<start.getTime())continue;
    const k=pointStamp(window,at);
    map.set(k,(map.get(k)||0)+v);
  }
  r.points=[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([at,value])=>({at,value}));
  r.latest_at=r.points.length?r.points[r.points.length-1].at:null;
  r.total=r.points.length?(GAUGE.has(id)?Math.max(...r.points.map(p=>p.value)):r.points.reduce((n,p)=>n+p.value,0)):null;
  r.status=r.points.length?"OK":"NO_DATA";
  return r;
}
async function emailMetric(token:string,zone:string,start:Date,end:Date,window:string):Promise<UsageEntry>{
  const r=empty("cf_emails_sent","Emails Sent","CLOUDFLARE","CF_ZONE","emails","NO_DATA",window);
  if(!token||!zone){r.status="AUTH_UNAVAILABLE";return r;}
  const key=window==="24h"?"datetimeFiveMinutes":window==="7d"?"datetimeHour":"date";
  const f=window==="24h"
    ? 'datetimeFiveMinutes_geq:"'+start.toISOString().slice(0,16)+':00Z"'
    : 'date_geq:"'+dateFloorUTC(start.getTime())+'"';
  const q='{viewer{zones(filter:{zoneTag:"'+zone+'"}){x:emailSendingAdaptiveGroups(filter:{'+f+
    '},limit:1000){count dimensions{'+key+'}}}}}';
  const response=await boundedJson(CF_URL+"/graphql",{
    method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},
    body:JSON.stringify({query:q})});
  if(response.code!==200){r.status=response.code?safeStatus(response.code):"PROVIDER_TIMEOUT";return r;}
  if(response.data?.errors?.length){r.status="SCHEMA_OR_PERMISSION";return r;}
  const rows=response.data?.data?.viewer?.zones?.[0]?.x;
  if(!Array.isArray(rows)){r.status="NO_SCOPE_DATA";return r;}
  if(rows.length>=1000){r.status="TRUNCATED";return r;}
  const map=new Map<string,number>();
  for(const row of rows){
    const v=validNumber(row?.count), at=String(row?.dimensions?.[key]||"");
    if(!at||v===null)continue;
    map.set(pointStamp(window,at),(map.get(pointStamp(window,at))||0)+v);
  }
  r.points=[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([at,value])=>({at,value}));
  r.total=r.points.length?r.points.reduce((n,p)=>n+p.value,0):null;
  r.latest_at=r.points.length?r.points[r.points.length-1].at:null;
  r.status=r.points.length?"OK":"NO_DATA";
  return r;
}
async function billingStorage(token:string,account:string,window:string):Promise<UsageEntry>{
  if(billingPeriodCache&&billingPeriodCache.expires>Date.now())
    return {...billingPeriodCache.item,period:window};
  const r=empty("cf_do_sql_storage","DO SQL Storage (Billing)","CLOUDFLARE","CF_ACCOUNT_SHARED","GB-month","NO_DATA",window);
  r.target_scope="MONTHLY_BILLING_ONLY";
  if(!token||!account){r.status="AUTH_UNAVAILABLE";return r;}
  const response=await boundedJson(CF_URL+"/accounts/"+account+"/billable-usage",
    {headers:{authorization:"Bearer "+token}});
  if(response.code!==200){r.status=response.code?safeStatus(response.code):"PROVIDER_TIMEOUT";return r;}
  const list=response.data?.result;
  if(!Array.isArray(list)){r.status="MALFORMED";return r;}
  const rows=list.filter((line:any)=>
    /durable/i.test(String(line.ServiceName||"")+" "+String(line.ServiceFamilyName||"")) &&
    /storage|stored/i.test(String(line.ChargeDescription||"")+" "+String(line.x_BillableMetricId||"")));
  if(rows.length){
    let total=0, valid=false;
    let exactUnit="";
    for(const row of rows){
      const n=validNumber(row.ConsumedQuantity);
      if(n!==null){
        const unit=String(row.ConsumedUnit||"").trim();
        if(!unit||exactUnit&&unit!==exactUnit){r.status="UNVERIFIED_UNIT";return r;}
        exactUnit=unit;total+=n;valid=true;
      }
    }
    if(valid){r.total=total;r.unit=exactUnit;r.status="BILLING_PERIOD";r.latest_at=new Date().toISOString();}
    billingPeriodCache={item:r,expires:Date.now()+24*60*60*1000};
  }
  r.note="Định kỳ theo Billing, account shared; không dựng biểu đồ 5 phút.";
  return r;
}
// One GraphQL request for three source-defined groups: DO periodic, DO invocations,
// Inventory Worker invocations. Group scope and time filters match the older probes.
async function groupedCloudflare(specs:readonly CfSpec[],token:string,account:string,
  start:Date,end:Date,window:string):Promise<Record<string,UsageEntry>> {
  if(!token||!account)throw Error("CF_CREDENTIAL_UNAVAILABLE");
  const key=window==="24h"?"datetimeFiveMinutes":window==="7d"?"datetimeHour":"date";
  const day='date_geq:"'+dateFloorUTC(start.getTime())+'",date_leq:"'+dateFloorUTC(end.getTime())+'"';
  const workers='scriptName:"supra-inventory-beta",datetime_geq:"'+start.toISOString()+'",datetime_leq:"'+end.toISOString()+'"';
  const q='{viewer{accounts(filter:{accountTag:"'+account+'"}){'+
    'd:durableObjectsPeriodicGroups(filter:{'+day+'},limit:1000){dimensions{'+key+'} sum{rowsRead rowsWritten duration}} '+
    'r:durableObjectsInvocationsAdaptiveGroups(filter:{'+day+'},limit:1000){dimensions{'+key+'} sum{requests}} '+
    'w:workersInvocationsAdaptive(filter:{'+workers+'},limit:1000){dimensions{'+key+'} sum{requests cpuTimeUs}}}}}';
  const response=await boundedJson(CF_URL+"/graphql",{method:"POST",headers:{
    "content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify({query:q})});
  if(response.code!==200||response.data?.errors?.length)throw Error("CF_GROUP_PROVIDER");
  const accounts=response.data?.data?.viewer?.accounts;
  if(!Array.isArray(accounts)||accounts.length!==1)throw Error("CF_GROUP_SCOPE");
  const out:Record<string,UsageEntry>={};
  for(const spec of specs){
    const [id,label,dataset,field,metric,unit]=spec;
    const alias=dataset==="durableObjectsPeriodicGroups"?"d":
      dataset==="durableObjectsInvocationsAdaptiveGroups"?"r":"w";
    const rows=accounts[0][alias];
    if(!Array.isArray(rows)||rows.length>=1000)throw Error("CF_GROUP_TRUNCATED");
    const value=empty(id,label,"CLOUDFLARE",id.startsWith("cf_worker")?"CF_WORKER":"CF_ACCOUNT_SHARED",unit,"NO_DATA",window);
    const points=new Map<string,number>();
    for(const row of rows){
      const at=String(row?.dimensions?.[key]||"");
      const sample=validNumber(row?.[field]?.[metric]);
      if(!at||sample===null)continue;
      if(window==="24h"&&Date.parse(at)<start.getTime())continue;
      const stamp=pointStamp(window,at);
      points.set(stamp,(points.get(stamp)||0)+sample);
    }
    value.points=[...points.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([at,v])=>({at,value:v}));
    value.total=value.points.length?value.points.reduce((n,p)=>n+p.value,0):null;
    value.latest_at=value.points.length?value.points[value.points.length-1].at:null;
    value.status=value.points.length?"OK":"NO_DATA";
    out[id]=value;
  }
  return out;
}
// Google Monitoring permits exactly one metric.type per request. Preserve the
// consumed_api resource label: cross-series reduction would erase attribution.
async function groupedConsumedApis(specs:readonly (typeof GOOGLE)[number][],bearer:string,
  start:Date,end:Date,window:string):Promise<Record<string,UsageEntry>> {
  if(!bearer)throw Error("GCP_CREDENTIAL_UNAVAILABLE");
  const params=new URLSearchParams({filter:'metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api"',
    "interval.startTime":start.toISOString(),"interval.endTime":end.toISOString(),view:"FULL",pageSize:"1000",
    "aggregation.alignmentPeriod":window==="24h"?"300s":window==="7d"?"3600s":"86400s",
    "aggregation.perSeriesAligner":"ALIGN_SUM"});
  const allow=new Map<string,string>();
  const out:Record<string,UsageEntry>={};
  for(const spec of specs){
    allow.set(spec[3].slice(4),spec[0]);
    out[spec[0]]=empty(spec[0],spec[1],"GOOGLE","GCP_PROJECT",spec[4],"NO_DATA",window);
  }
  const maps=new Map<string,Map<string,number>>();
  for(const spec of specs)maps.set(spec[0],new Map());
  let page=0,next="";
  do{
    if(next)params.set("pageToken",next);
    const response=await boundedJson(GCP_MONITOR+"supra-inventory-beta/timeSeries?"+params,
      {headers:{authorization:"Bearer "+bearer,"X-Goog-User-Project":"supra-inventory-beta"}});
    if(response.code!==200||!Array.isArray(response.data?.timeSeries||[]))throw Error("GCP_BATCH_PROVIDER");
    for(const series of response.data.timeSeries||[]){
      const id=allow.get(String(series?.resource?.labels?.service||""));
      if(!id)continue;
      for(const point of series.points||[]){
        const at=String(point?.interval?.endTime||"");
        const n=validNumber(point?.value?.int64Value??point?.value?.doubleValue);
        if(!at||n===null)continue;
        const k=pointStamp(window,at),m=maps.get(id)!;
        m.set(k,(m.get(k)||0)+n);
      }
    }
    next=String(response.data?.nextPageToken||"");
  }while(next&&++page<8);
  if(next)throw Error("GCP_BATCH_TRUNCATED");
  for(const spec of specs){
    const value=out[spec[0]];
    value.points=[...maps.get(spec[0])!.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([at,value])=>({at,value}));
    value.total=value.points.length?value.points.reduce((n,p)=>n+p.value,0):null;
    value.latest_at=value.points.length?value.points[value.points.length-1].at:null;
    value.status=value.points.length?"OK":"NO_DATA";
  }
  return out;
}

function firestoreDailyTargets(m:UsageEntry):void{
  // Provider published daily free allowance; counts are NOT an internal per-project spend cap.
  const daily:Record<string,number>={firestore_reads:50000,firestore_writes:20000,firestore_deletes:20000};
  if(Object.prototype.hasOwnProperty.call(daily,m.id)){
    m.denominator=daily[m.id]; m.target_scope="PROVIDER_DAILY_FREE";
  }
}
export async function collectVpsUsage(env:UsageMonitorEnv,window:string):Promise<{schema:string;collected_at:string;window:string;items:UsageEntry[];notes:string[]}> {
  if(!["24h","7d","30d"].includes(window))throw new Error("INVALID_WINDOW");
  const start=new Date(Date.now()-(window==="24h"?DAY_MS:window==="7d"?7*DAY_MS:MAX_WINDOW_DAYS*DAY_MS));
  const end=new Date();
  let bearer=monitoringTokenCache&&monitoringTokenCache.expires>Date.now()?monitoringTokenCache.token:"";
  try{
    if(!bearer&&env.GOOGLE_RUNTIME_SA_JSON){
      bearer=(await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON,
        "https://www.googleapis.com/auth/monitoring.read")).accessToken;
      monitoringTokenCache={token:bearer,expires:Date.now()+45*60*1000};
    }
  }catch{ /* all GCP metrics will report AUTH_UNAVAILABLE */ }
  const groupedCfIds=new Set(["cf_do_requests","cf_do_duration","cf_do_rows_read",
    "cf_do_rows_written","cf_worker_requests","cf_worker_cpu"]);
  const dueCf=CLOUDFLARE.filter(s=>groupedCfIds.has(s[0])&&!cachedMetric(s[0],window));
  const dueApis=GOOGLE.filter(s=>s[3].startsWith("api:")&&!cachedMetric(s[0],window));
  const special:Record<string,UsageEntry>={};
  if(dueCf.length){
    try{Object.assign(special,await groupedCloudflare(dueCf,env.D166_CF_READ_TOKEN||"",
      env.D166_CF_ACCOUNT_ID||"",start,end,window));}
    catch{ /* Provider schema/freshness failure: preserve original scoped queries. */ }
  }
  if(dueApis.length){
    try{Object.assign(special,await groupedConsumedApis(dueApis,bearer,start,end,window));}
    catch{ /* Provider error: use existing per-service Monitoring routes. */ }
  }
  const all: Array<()=>Promise<UsageEntry>> = [
    ...GOOGLE.map(spec=>()=>googleMetric(spec,bearer,start,end,window)),
    ...CLOUDFLARE.map(spec=>()=>cfMetric(spec,env.D166_CF_READ_TOKEN||"",env.D166_CF_ACCOUNT_ID||"",start,end,window)),
    ()=>emailMetric(env.D173_CF_EMAIL_ANALYTICS_READ||"",env.D173_CF_ZONE_ID||"",start,end,window),
    ()=>billingStorage(env.D166_CF_READ_TOKEN||"",env.D166_CF_ACCOUNT_ID||"",window)
  ];
  const identities=[...GOOGLE.map(s=>s[0]),...CLOUDFLARE.map(s=>s[0]),"cf_emails_sent","cf_do_sql_storage"];
  const result:UsageEntry[]=new Array(all.length);
  let pos=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(pos<all.length){
      const i=pos++;
      const id=identities[i];
      const old=cachedMetric(id,window);
      if(old){result[i]=old;continue;}
      if(special[id]){result[i]=storeMetric(special[id],window);continue;}
      try{result[i]=storeMetric(await all[i](),window);}
      catch{result[i]=storeMetric(empty(id,id,"UNKNOWN","NONE","","PROVIDER_ERROR",window),window);}
    }
  }));
  result.forEach(firestoreDailyTargets);
  return {schema:"D173_VPS_USAGE_V1",collected_at:end.toISOString(),window,items:result,notes:[
    "Cloudflare account-wide quotas are shared with other SUPRA projects; 50% Inventory is an internal planning allocation of included Cloudflare pools; not a USD charge cap.",
    "DO SQL Storage is period billing only, no 5-minute chart.",
    "GCP Cloud Run project totals cannot be relabeled as Picker Alert service.",
    "Unattributed/partial data is N/A, never 0. Provider metrics may lag."]};
}
