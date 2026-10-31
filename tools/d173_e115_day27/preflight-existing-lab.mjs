#!/usr/bin/env node
// Read-only verify that LAB Worker and DO belong to this project BEFORE replacing only the test script.
import {mkdirSync,writeFileSync} from "node:fs";
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!/^[a-f0-9]{32}$/i.test(account||""))throw Error("CLOUDFLARE_ENVIRONMENT_NOT_CONFIGURED");
const h={authorization:"Bearer "+token};
async function get(endpoint){
 const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+endpoint,{headers:h,signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.success!==true)throw Error("CLOUDFLARE_PREFLIGHT_GET_FAILED_"+r.status+"_"+endpoint.split("?")[0]);
 return data.result;
}
const checkScript=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/workers/scripts/supra-inventory-m2-lab",{headers:h,signal:AbortSignal.timeout(15000)});
if(checkScript.status!==200)throw Error("DEDICATED_LAB_WORKER_MISSING_OR_ACCESS_DENIED_"+checkScript.status);
// GET /workers/scripts/{name} returns the module source, NOT a success:true JSON envelope.
const script={verified_http_200:true};
const namespaces=await get("/workers/durable_objects/namespaces?per_page=1000");
if(!Array.isArray(namespaces)||!namespaces.some(x=>x.class==="LabRealCore"&&x.script==="supra-inventory-m2-lab")){
 throw Error("LAB_DO_NAMESPACE_NOT_VERIFIED_STOP");
}
const sub=await get("/workers/subdomain");
if(!sub?.subdomain)throw Error("NO_VERIFIED_WORKERS_DEV_DOMAIN");
const origin="https://supra-inventory-m2-lab."+sub.subdomain+".workers.dev";
mkdirSync("artifacts/d173-e115",{recursive:true});
writeFileSync("artifacts/d173-e115/preflight-existing-test-worker.json",JSON.stringify({
verified:true,at:new Date().toISOString(),script:"supra-inventory-m2-lab",
do_class:"LabRealCore",no_production_script_mutation:true,origin,existing_script:true},null,2));
console.log("D173_E115_EXISTING_TEST_WORKER_PREFLIGHT_PASS "+origin);
