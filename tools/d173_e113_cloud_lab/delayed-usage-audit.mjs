#!/usr/bin/env node
// D173-E113: read-only Cloudflare GraphQL audit; NEVER calls Worker or modifies provider.
import {mkdirSync,writeFileSync} from "node:fs";
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!/^[0-9a-f]{32}$/i.test(account||""))throw Error("CLOUDFLARE_ANALYTICS_AUTH_MISSING");
const date="2026-10-28";
async function graphql(q){
 const resp=await fetch("https://api.cloudflare.com/client/v4/graphql",{method:"POST",headers:{Authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({query:q}),signal:AbortSignal.timeout(18000)});
 const j=await resp.json();
 if(!resp.ok||j.errors?.length)throw Error("GRAPHQL_ERROR "+JSON.stringify(j.errors||resp.status).slice(0,400));
 return j.data;
}
const q='query {viewer{accounts(filter:{accountTag:"'+account+'"}){durableObjectsInvocationsAdaptiveGroups(filter:{date_gt:"'+date+'"},limit:1000){dimensions{scriptName}sum{requests}} durableObjectsPeriodicGroups(filter:{date_gt:"'+date+'"},limit:1000){sum{rowsRead rowsWritten duration inboundWebsocketMsgCount}}}}}';
const d=(await graphql(q))?.viewer?.accounts?.[0];
if(!d)throw Error("ACCOUNT_METRICS_MISSING");
const inv=d.durableObjectsInvocationsAdaptiveGroups||[];
const per=d.durableObjectsPeriodicGroups||[];
const sum=(a,k)=>a.reduce((n,x)=>n+Number(x.sum?.[k]||0),0);
const result={source:"Cloudflare GraphQL read-only",at:new Date().toISOString(),date_gt:date,script:"supra-inventory-m2-lab",baseline:{at:"2026-10-31T05:09:52Z",requests:90138,rows_read:248553417,rows_written:315215,duration:1111.093974784},after:{requests:sum(inv,"requests"),rows_read:sum(per,"rowsRead"),rows_written:sum(per,"rowsWritten"),duration:sum(per,"duration"),ws_messages:sum(per,"inboundWebsocketMsgCount"),test_script_requests:sum(inv.filter(x=>x.dimensions?.scriptName==="supra-inventory-m2-lab"),"requests")},namespace_dimensions:{},warnings:[]};
try{
 const schema=await graphql("query {__schema{types{name}}}");
 const names=(schema?.__schema?.types||[]).map(t=>t.name).filter(n=>/DurableObjects.*(Invocations|Periodic).*Dimensions/i.test(n)).slice(0,6);
 for(const name of names){
  const fields=await graphql('query {__type(name:"'+name+'"){fields{name}}}');
  result.namespace_dimensions[name]=(fields?.__type?.fields||[]).map(f=>f.name);
 }
}catch(e){result.warnings.push("GRAPHQL_INTROSPECTION_UNAVAILABLE "+String(e.message||e).slice(0,200));}
result.delta={requests:result.after.requests-result.baseline.requests,rows_read:result.after.rows_read-result.baseline.rows_read,rows_written:result.after.rows_written-result.baseline.rows_written,duration:result.after.duration-result.baseline.duration};
result.verdict={actual_provider:true,production_test_traffic:false,billing_attributable_to_test:false,proof_of_savings:false,production_go:false,note:"Account totals include concurrent Production. Zero scriptName raw requests is not proof of zero billable M2 messages; Cloudflare metrics may lag. This audit issues only GraphQL reads."};
mkdirSync("artifacts/d173-e113",{recursive:true});
writeFileSync("artifacts/d173-e113/delayed-usage-audit.json",JSON.stringify(result,null,2));
console.log("D173_E113_DELAYED_ANALYTICS_READ_PASS "+JSON.stringify({date:result.at,delta:result.delta,test_script_raw_invocations:result.after.test_script_requests,dimensions:result.namespace_dimensions,cost_proven:false}));
