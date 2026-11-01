#!/usr/bin/env node
// D173-E168: evidence consolidation only; cannot grant Production release.
import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
const out=join(process.cwd(),"artifacts/d173-e168");
mkdirSync(out,{recursive:true});
const source={
  authority_d172:process.env.E168_AUTHORITY||"missing",
  real_core_local:process.env.E168_CORE||"missing",
  web_native:process.env.E168_WEB||"missing",
  android_native:process.env.E168_ANDROID||"missing",
  windows_agent_native:process.env.E168_AGENT||"missing"
};
const checks=[
  ["Full Report/Confirm/Resolve/Correct/Withdraw/Overdue/03:00/ACK semantic data parity",false,"Not implemented and measured end-to-end on E167 candidate"],
  ["Production-grade RBAC, recipient/retention/mixed old-new protocol",false,"E167 uses synthetic identities and REPORT subset"],
  ["Real Android overlay/FCM and physical Newland/Urovo test",false,"Only native compile; on-device FIELD evidence absent"],
  ["Real Office/WMS, Agent PRIMARY/STANDBY and HA on Windows",false,"Only native compile; FIELD evidence absent"],
  ["Exact 27-Oct equivalent per-action workload, 20/60 PDA and latency",false,"E167 fixed synthetic run is not the actual 27-Oct trace"],
  ["Cloudflare billable Compute Requests and full-cycle cost <= 5 USD",false,"E167 raw DO invocation analytics not billing invoice"],
  ["Safe full-model rollback and exact-release digest",false,"No complete production candidate; deployment unauthorized"]
].map(([name,pass,evidence])=>({name,pass,evidence}));
const jobsPass=Object.values(source).every(x=>x==="success");
const report={
  schema_version:1,change_id:"D173-E168",lab_only:true,
  production_deployment_authorized:false,d172:"PENDING_HOLD_UNCHANGED",
  generated_at:new Date().toISOString(),
  source_jobs:source,source_ci_pass:jobsPass,
  semantic_field_financial_checks:checks,
  recommendation:"NO_GO",
  rationale:"Source CI is not full E2E, physical FIELD or billable financial evidence. No Production merge/deploy/OTA."
};
writeFileSync(join(out,"acceptance.json"),JSON.stringify(report,null,2));
const lines=["# D173-E168 — Full-model acceptance","",
"**Production decision: NO-GO**","",
"Native/source CI may PASS without demonstrating full Core V2 behavior. No Production mutation was requested.","",
"| Check | CI outcome |","|---|---|",
...Object.entries(source).map(([k,v])=>"| "+k+" | "+v+" |"),
"","| Missing mandatory gate | Status |","|---|---|",
...checks.map(x=>"| "+x.name+" | NOT PROVEN |"),
"","E167 is REPORT-only with synthetic Lab identities; raw DO HTTP calls cannot prove $5 billing parity.",
"D172 is PENDING/HOLD; Stable OWNER-GATED; all releases blocked until Owner GO."];
writeFileSync(join(out,"acceptance.md"),lines.join("\n")+"\n");
console.log("D173_E168_CONSOLIDATED_NO_GO",JSON.stringify({source,missing:checks.length,production:false}));
// A green build receipt cannot grant readiness when mandatory FIELD and FINANCIAL gates are absent.
process.exitCode = 1;
