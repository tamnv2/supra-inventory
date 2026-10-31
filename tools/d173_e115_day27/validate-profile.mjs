#!/usr/bin/env node
// No live endpoint traffic. Validate the observed sample exactly and model test scale by hour.
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
const p=JSON.parse(readFileSync(new URL("./profile-anonymized.json",import.meta.url)));
const total=Object.values(p.by_route_method).reduce((a,b)=>a+b,0);
const hourly=Object.values(p.by_hour_vn).reduce((a,b)=>a+b,0);
const status=Object.values(p.by_status).reduce((a,b)=>a+b,0);
if(total!==10403||hourly!==total||status!==total||p.capture.devices!==32)throw Error("OCT27_PROFILE_TOTALS_MISMATCH");
const poll=p.by_route_method["REALTIME_DELTA|GET"], ratio=poll/total;
const plan={schema:"D173_E115_TRAFFIC_TEST_PLAN_V1",source_day:"2026-10-27",
 source_http_attempts:total,source_device_sample:p.capture.devices,
 traffic_profile_hourly:p.by_hour_vn,source_errors:p.by_status,
 source_route_counts:p.by_route_method,polling_http_attempts:poll,
 polling_share_percent:Math.round(ratio*10000)/100,
 capture_partial:true,
 benchmark_targets:{
  same_arrivals_http_vs_m2:true,
  artificial_device_levels:[25,40,60],
  load_scaling:"explicit_label_not_altered_source",
  no_real_identifiers:true,
  cold_start_reconnect_failover:true,
  php_billing:false,
  source_to_core_routes:{
    "REALTIME_TICKET|POST":"REPORT_eligible_but_attempts_include_errors",
    "REPORTER_RESOLVE|POST":"RESOLVE_eligible_but_attempts_include_errors",
    "REPORTER_CORRECT|POST":"CORRECT_eligible_but_attempts_include_errors",
    "REPORTER_QUEUE|GET":"QUEUE_eligible",
    "REALTIME_DELTA|GET":"M2_PUSH_UNMAPPED_NEED_EVENT_SEMANTICS",
    "AUTH|GET":"KEEP_HTTP",
    "CATALOG|GET":"KEEP_HTTP_CACHE"
  },
  release_gate:"FAIL_UNTIL_LIKE_FOR_LIKE_CLIENT_M2_PUSH_AND_PROVIDER_BILLING"
 },
 limitations:p.limitations
};
mkdirSync("artifacts/d173-e115",{recursive:true});
writeFileSync("artifacts/d173-e115/day27-replay-plan.json",JSON.stringify(plan,null,2));
console.log("D173_E115_27_REAL_DAY_PROFILE_PASS "+JSON.stringify({files:p.capture.bundles,devices:p.capture.devices,total,peak_hour:p.by_hour_vn["17"],polling_delta:poll,percent:plan.polling_share_percent,plan:"RUN_UNMAPPED_REALTIME_PROTOCOL_TEST_REQUIRED"}));
