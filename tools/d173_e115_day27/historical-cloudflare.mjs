#!/usr/bin/env node
// D173-E115. Historical 27 Oct 2026 Vietnam account/namespace metrics via Cloudflare READ ONLY.
// Never fetches or changes Worker, DO state, secrets, routes, users or production data.
import {mkdirSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!/^[a-f0-9]{32}$/i.test(account||""))throw Error("CLOUDFLARE_AUDIT_CREDENTIALS_MISSING");
const start=Date.parse("2026-10-26T17:00:00Z"),end=Date.parse("2026-10-27T17:00:00Z");
const report={schema:"D173_E115_DAY27_OFFICIAL_PROVIDERS_V1",date_vn:"2026-10-27",
 interval_utc:["2026-10-26T17:00:00Z","2026-10-27T17:00:00Z"],read_only:true,
 accounts:{},warnings:[],data_quality:{full_coverage:false,do_billed_requests_available:false}};
async function query(q){
 const response=await fetch("https://api.cloudflare.com/client/v4/graphql",{method:"POST",
  headers:{authorization:"Bearer "+token,"content-type":"application/json"},
  body:JSON.stringify({query:q}),signal:AbortSignal.timeout(18000)});
 const j=await response.json();
 if(!response.ok||j.errors?.length)throw Error("GRAPHQL "+JSON.stringify(j.errors||response.status).slice(0,280));
 return j?.data?.viewer?.accounts?.[0];
}
const h={authorization:"Bearer "+token};
const namespaces=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/workers/durable_objects/namespaces?per_page=1000",
 {headers:h,signal:AbortSignal.timeout(16000)}).then(x=>x.json());
const ns=namespaces.success&&Array.isArray(namespaces.result)?namespaces.result:[];
const known=ns.filter(x=>/supra-inventory-beta|supra-inventory-m2-lab/i.test(String(x.script||"")));
const nslookup=new Map(known.map(x=>[x.id,{kind:String(x.script||"").includes("m2-lab")?"test":"existing",
 class:String(x.class||""),label:String(x.script||"").includes("m2-lab")?"M2_LAB":"PRODUCTION_CANDIDATE"}]));
const configs=[
{label:"exact-datetime",filter:'datetime_geq:"2026-10-26T17:00:00Z",datetime_lt:"2026-10-27T17:00:00Z"'},
{label:"two-day",filter:'date_geq:"2026-10-26",date_leq:"2026-10-27"'},
{label:"three-day",filter:'date_gt:"2026-10-25",date_lt:"2026-10-28"'},
{label:"fallback-wide",filter:'date_gt:"2026-10-25"'}];
const fields=[
{key:"invocations",dataset:"durableObjectsInvocationsAdaptiveGroups",dimensions:"datetimeHour namespaceId type",sums:"requests"},
{key:"periodic",dataset:"durableObjectsPeriodicGroups",dimensions:"datetimeHour namespaceId",sums:"rowsRead rowsWritten duration inboundWebsocketMsgCount"}
];
const result={};
for(const field of fields){
 let resolved=false;
 for(const cfg of configs){
  const q='query{viewer{accounts(filter:{accountTag:"'+account+'"}){'+field.dataset+
    '(filter:{'+cfg.filter+'},limit:1000){dimensions{'+field.dimensions+'}sum{'+field.sums+'}}}}}';
  try{
    const data=await query(q),rows=data?.[field.dataset];
    if(!Array.isArray(rows))throw Error("NOT_AN_ARRAY");
    const parsed=rows.map(x=>{
      const date=x.dimensions?.datetimeHour;
      const t=Date.parse(date||"");
      return {t,ns:x.dimensions?.namespaceId||"",type:x.dimensions?.type||"",sum:x.sum||{}};
    });
    const valid=parsed.filter(x=>Number.isFinite(x.t)&&x.t>=start&&x.t<end);
    const hourly={};const groupTotals={};
    const sum=(n,v)=>n+Number(v||0);
    for(const x of valid){
      const hour=String(Math.floor((x.t-start)/3600000)).padStart(2,"0");
      const key=nslookup.get(x.ns)?.label||"OTHER_NAMESPACE";
      if(!hourly[hour])hourly[hour]={};
      if(!hourly[hour][key])hourly[hour][key]={};
      if(!groupTotals[key])groupTotals[key]={};
      const names=field.key==="invocations"?["requests"]:["rowsRead","rowsWritten","duration","inboundWebsocketMsgCount"];
      for(const name of names){
        hourly[hour][key][name]=sum(hourly[hour][key][name]||0,x.sum[name]);
        groupTotals[key][name]=sum(groupTotals[key][name]||0,x.sum[name]);
      }
      if(field.key==="invocations"){const tk="invocation_"+x.type;
        hourly[hour][key][tk]=sum(hourly[hour][key][tk]||0,x.sum.requests);
        groupTotals[key][tk]=sum(groupTotals[key][tk]||0,x.sum.requests);
      }
    }
    result[field.key]={query_variant:cfg.label,returned_rows:rows.length,valid_rows:valid.length,
      limit_reached:rows.length>=1000,hours_present:Object.keys(hourly).length,
      by_hour_from_start_utc:hourly,by_namespace_type:groupTotals};
    resolved=true;break;
  }catch(e){report.warnings.push(field.key+" "+cfg.label+": "+String(e.message||e).slice(0,140));}
 }
 if(!resolved)report.warnings.push(field.key+" DATA_UNAVAILABLE");
}
report.accounts={namespace_types:Array.from(new Set(known.map(x=>({kind:nslookup.get(x.id).label,class:x.class})).map(JSON.stringify))).map(JSON.parse),
 inventory_core_class_present:known.some(x=>String(x.class||"").toLowerCase().includes("inventorycore"))};
report.results=result;
report.data_quality.full_coverage=Object.values(result).length===2&&Object.values(result).every(x=>!x.limit_reached&&x.hours_present>=17);
report.data_quality.coverage_note=report.data_quality.full_coverage?
 "24h query has many hour groups but may not represent all namespaces with no traffic":
 "Incomplete 24h coverage or GraphQL group truncation; do not use as complete 27 Oct provider actuals";
report.data_quality.do_billed_requests_available=false;
report.limitations=[
 "Cloudflare DO raw invocations are NOT billed DO Compute Requests; hibernated WS incoming messages billed under separate 20:1 rule",
 "Account aggregates may include other services including D172 and telemetry propagation delays",
 "Only listed existing InventoryCore-like namespaces attributed as production candidate; no source file or business record accessed",
 "Cloudflare data is UTC and remapped to 2026-10-27 Asia/Ho_Chi_Minh"
];
mkdirSync("artifacts/d173-e115",{recursive:true});
writeFileSync("artifacts/d173-e115/cloudflare-27-historical.json",JSON.stringify(report,null,2));
console.log("D173_E115_CLOUDFLARE_DAY27_READONLY "+JSON.stringify({
 quality:report.data_quality,results:Object.fromEntries(Object.entries(result).map(([k,v])=>[k,{variant:v.query_variant,hours:v.hours_present,raw_groups:v.returned_rows,namespace_metrics:v.by_namespace_type}])),
 warnings:report.warnings.slice(-4)}));
