#!/usr/bin/env node
// Account-wide DO analytics only; never call raw invocations a billable invoice.
import {writeFileSync,mkdirSync} from "node:fs";
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const stage=process.argv[2]||"pre";
if(!token||!account)throw Error("PROVIDER_ANALYTICS_CREDENTIALS_MISSING");
const date=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
async function gql(query){
 const resp=await fetch("https://api.cloudflare.com/client/v4/graphql",{
  method:"POST",headers:{"Authorization":"Bearer "+token,"content-type":"application/json"},
  body:JSON.stringify({query}),signal:AbortSignal.timeout(14000)
 });
 const json=await resp.json();
 if(!resp.ok||json.errors?.length)throw Error("Cloudflare GraphQL error: "+JSON.stringify(json.errors?.map(x=>({message:x.message}))||resp.status));
 return json.data;
}
const query='query {viewer{accounts(filter:{accountTag:"'+account+'"}){durableObjectsInvocationsAdaptiveGroups(filter:{date_gt:"'+date+'"},limit:1000){sum{requests}}}}}';
const data=await gql(query);
const list=data?.viewer?.accounts?.[0]?.durableObjectsInvocationsAdaptiveGroups;
if(!Array.isArray(list))throw Error("Cloudflare DO metrics not readable; STOP BEFORE DEPLOY");
const accountDO=list.reduce((x,y)=>x+Number(y.sum?.requests||0),0);
const result={stage,at:new Date().toISOString(),date_gt:date,source:"Cloudflare GraphQL account durableObjectsInvocationsAdaptiveGroups.sum.requests",
 account_do_invocations:accountDO,scope:"ACCOUNT_AGGREGATE_NOT_PER_TEST_OR_BILLABLE_REQUEST",real_provider:true};
mkdirSync("artifacts/d173-e113",{recursive:true});
writeFileSync("artifacts/d173-e113/analytics-"+stage+".json",JSON.stringify(result,null,2));
console.log("CLOUDFLARE_ANALYTICS_READ_PASS "+JSON.stringify(result));
