#!/usr/bin/env node
// E113 isolated DO namespace attribution, official Cloudflare API GET and GraphQL POST only.
import {mkdirSync,writeFileSync} from "node:fs";
const t=process.env.CLOUDFLARE_API_TOKEN,a=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!t||!/^[a-f0-9]{32}$/i.test(a||""))throw Error("ACCOUNT_OR_TOKEN_MISSING");
const headers={authorization:"Bearer "+t};
const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+a+"/workers/durable_objects/namespaces?per_page=1000",{headers,signal:AbortSignal.timeout(16000)});
const j=await r.json();
if(!r.ok||!j.success||!Array.isArray(j.result))throw Error("NAMESPACE_LIST_UNAVAILABLE "+r.status);
const matches=j.result.filter(x=>x.class==="LabRealCore"&&String(x.script||"").includes("supra-inventory-m2-lab"));
const report={at:new Date().toISOString(),source:"Cloudflare API namespace list + GraphQL",namespace_count:j.result.length,namespace_matches:matches.map(x=>({class:x.class,script:x.script,name:x.name,id_suffix:String(x.id||"").slice(-8)})),measures:{},warnings:[],read_only:true,no_test_traffic:true};
async function query(q){const x=await fetch("https://api.cloudflare.com/client/v4/graphql",{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({query:q}),signal:AbortSignal.timeout(18000)});const d=await x.json();if(!x.ok||d.errors?.length)throw Error("GRAPHQL "+JSON.stringify(d.errors||x.status).slice(0,350));return d.data?.viewer?.accounts?.[0];}
for(const namespace of matches){
 const id=namespace.id,key=namespace.name||"LabRealCore",day="2026-10-30";
 const filter='filter:{date_gt:"'+day+'",namespaceId:"'+id+'"}';
 const acc='filter:{accountTag:"'+a+'"}';
 try{
  const d=await query('query{viewer{accounts('+acc+'){durableObjectsInvocationsAdaptiveGroups('+filter+',limit:1000){sum{requests}dimensions{type scriptName namespaceId}} durableObjectsPeriodicGroups('+filter+',limit:1000){sum{rowsRead rowsWritten duration inboundWebsocketMsgCount}}}}}');
  const inv=d?.durableObjectsInvocationsAdaptiveGroups||[],per=d?.durableObjectsPeriodicGroups||[];
  const sum=(rows,field)=>rows.reduce((x,y)=>x+Number(y.sum?.[field]||0),0);
  report.measures[key]={do_raw_invocations:sum(inv,"requests"),sql_rows_read:sum(per,"rowsRead"),sql_rows_written:sum(per,"rowsWritten"),duration_field:sum(per,"duration"),ws_messages_periodic:sum(per,"inboundWebsocketMsgCount"),by_type:inv.map(x=>({type:x.dimensions?.type||null,script:x.dimensions?.scriptName||null,requests:Number(x.sum?.requests||0)})).slice(0,30)};
 }catch(e){report.warnings.push("namespace GraphQL "+String(e.message||e).slice(0,300));}
}
report.verdict={test_namespace_observed:Object.values(report.measures).some(x=>x.do_raw_invocations>0||x.sql_rows_read>0),do_compute_requests_billed_proven:false,billed_rows_and_duration_per_variant_proven:false,m2_savings_proven:false,important:"SQL rows are grouped for both HTTP and WS in one class; two instances cannot be separated by namespace alone. DO raw invocations do not equal billed compute requests."};
mkdirSync("artifacts/d173-e113",{recursive:true});
writeFileSync("artifacts/d173-e113/namespace-attribution.json",JSON.stringify(report,null,2));
console.log("D173_E113_NAMESPACE_AUDIT "+JSON.stringify({matches:report.namespace_matches.length,measures:report.measures,warnings:report.warnings,verdict:report.verdict}));
