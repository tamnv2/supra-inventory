#!/usr/bin/env node
// Verify account, available workers.dev subdomain and exact script nonexistence before any mutation.
import {writeFileSync,mkdirSync} from "node:fs";
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account||!/^[0-9a-f]{32}$/i.test(account))throw Error("ACCOUNT_ID_OR_API_TOKEN_MISSING");
async function cf(path){
 const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+path,{
  headers:{"Authorization":"Bearer "+token},signal:AbortSignal.timeout(14000)});
 const v=await r.json();
 return {status:r.status,value:v};
}
const sub=await cf("/workers/subdomain");
if(!sub.value?.success||!sub.value?.result?.subdomain)throw Error("WORKERS_DEV_SUBDOMAIN_NOT_AVAILABLE__ENABLE_IN_CLOUDFLARE");
const name="supra-inventory-m2-lab";
const existing=await cf("/workers/scripts/"+name);
if(existing.status!==404)throw Error("SCRIPT_ALREADY_EXISTS_OR_ACCESS_UNCLEAR__STOP_FAIL_CLOSED__"+existing.status);
const origin="https://"+name+"."+sub.value.result.subdomain+".workers.dev";
mkdirSync("artifacts/d173-e113",{recursive:true});
writeFileSync("artifacts/d173-e113/provider-preflight.json",JSON.stringify({
 status:"PASS",at:new Date().toISOString(),script_name:name,origin,isolated_script_new:true,
 subdomain_verified:true,production_untouched:true},null,2));
console.log("E113_CLOUDFLARE_SCOPE_PREFLIGHT_PASS "+origin);
