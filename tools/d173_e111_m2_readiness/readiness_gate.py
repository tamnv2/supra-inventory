#!/usr/bin/env python3
"""Fail-closed production release readiness. Does NOT deploy or mutate providers."""
import json
import os
from pathlib import Path
from datetime import datetime, timezone

repo=Path(__file__).resolve().parents[2]
out=repo/"artifacts/d173-e111"
out.mkdir(parents=True,exist_ok=True)
load_path=out/"local-load-fault.json"
load=json.loads(load_path.read_text()) if load_path.exists() else {}
checks=[]
def decision(name,pass_,evidence):
    checks.append({"gate":name,"pass":bool(pass_),"evidence":evidence})
baseline=["service/src/core.ts","service/src/index.ts","service/src/operational-v2-core.ts",
          "web/src/operational-app.ts","web/src/realtime-client.ts",
          "tools/d173_e110_sandbox/worker.mjs"]
for path in baseline:
    assert (repo/path).exists(),f"missing source: {path}"

test_pass={x["name"]:x for x in load.get("checks",[])}
for k in ("60_WEBSOCKET_UPGRADE","60_CONCURRENT_SNAPSHOTS","20_COMMAND_BURST_UNDER_5S_LOCAL",
          "20_REPLAY_SAME_REQUEST_ID_NO_DUPLICATION","20_DISTINCT_LAB_BATCHES",
          "20_REPORTER_RESOLUTIONS","PICKER_ACK_AFTER_REPORTER","RECONNECT_15_VIRTUAL_SESSIONS",
          "RECOVERY_CURSOR_NO_EVENT_SKIP_201_PLUS","FIREBASE_VERIFIED_IDENTITY_AT_INGRESS",
          "PROVIDER_BILLABLE_REQUESTS_MEASURED","REAL_60_DISTINCT_PDA_END_TO_END","PRODUCTION_SOURCE_PARITY"):
    row=test_pass.get(k,{})
    decision("LAB_"+k,row.get("pass",False),row.get("observation",row))

# No real integrated M2 in service, Web, native Android or native Agent; frozen POC branch is not release source.
real_core=(repo/"service/src/core.ts").read_text(encoding="utf8")
test_worker=(repo/"tools/d173_e110_sandbox/worker.mjs").read_text(encoding="utf8")
decision("REAL_INVENTORY_CORE_INTEGRATION",False,
    "M2Sandbox is in tools/ not service/src/core.ts; schema/roles differ. Do not deploy POC Worker.")
decision("WEB_ANDROID_AGENT_RELEASED_API_PARITY",False,
    "Only standalone lab Web, Android debug app and WinForms Agent tested; production clients unchanged.")
decision("PRODUCTION_AUTH_SESSION_SECURITY",False,
    "LAB uses uid/generation in URL query, not verified Firebase Auth or live session revoke.")
decision("D172_SHARED_RUNTIME_FUNCTIONAL_REGRESSION",False,
    "Source isolation checked; actual mixed shared Worker/Core/Auth D172 regression not exercised with M2.")
decision("WMS_FIRESTORE_HA_FCM_DEADLINES",False,
    "No WMS confirm/HA or Firestore Office Agent<>PDA/FCM/overlay, scheduled alarms or real SLA.")
decision("LIFECYCLE_HIBERNATION_SLEEP_WAKE",False,
    "No real provider hibernation/resume/eviction; Wrangler local websocket is only handshake proof.")
decision("E097_SQLITE_NOMEM_ROOT_CAUSE",False,
    "Historical SQLite NOMEM unresolved; no fault-injection regression with actual published schema.")
decision("E105_AGENT162_FIELD_REGRESSION",False,
    "Known Agent162 FIELD FAIL not resolved by LAB reference tests.")
decision("FINANCIAL_ZERO_OVERAGE_ALL_PROVIDERS",False,
    "No full billing-cycle charge evidence for CF/GCP/Firebase/Workers from real M2 migration.")
decision("LIVE_FLEET_P95_P99_SLA_AND_ROLLBACK",False,
    "No realistic 25-60 distinct PDA/ca + 5-6 Agents/real networks; no canary rollback test.")
decision("OWNER_PRODUCTION_RELEASE_APPROVAL",False,
    "No explicit Owner approval to deploy M2 to Production; stable remains OWNER-GATED.")
state="PASS" if checks and all(c["pass"] for c in checks) else "FAIL"
report={
 "schema":1,"change_id":"D173-E111","at":datetime.now(timezone.utc).isoformat(),
 "decision":"PRODUCTION_M2_RELEASE_READINESS","status":state,
 "scope":"OFFLINE_ONLY_NOT_DEPLOYED","source_ref":os.environ.get("GITHUB_SHA",""),
 "source_kind":"LAB_SIMULATOR_NOT_PUBLISHED_CORE","criteria_count":len(checks),
 "criteria_pass":sum(c["pass"] for c in checks),
 "criteria_fail":sum(not c["pass"] for c in checks),
 "checks":checks,"lab":load,
 "recommendation":"STOP production rollout. Implement guarded M2 in real InventoryCore/Web/APK/Agent on isolated branch; differential parity tests and provider cost/fleet/canary evidence required. Do not close D172."
}
(out/"release-readiness.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
lines=["# D173-E111 — Release-readiness decision","","**M2 PRODUCTION RELEASE: "+state+"**",
       "","| Gate | Kết quả |","|---|---|"]
lines += ["| "+c["gate"]+" | "+("PASS" if c["pass"] else "FAIL")+" |" for c in checks]
lines+=["","## Cơ sở và quyết định",
        "- Không thay đổi Production hay Provider; D172 độc lập HOLD.",
        "- CI kiểm thử source/lab, **không phải** xác nhận chi phí Cloudflare 0 USD.",
        "- Không thể hợp thức hóa FAIL bằng 3/3 build APK/Agent hay ảnh UI.",
        "- Chỉ bắt đầu gate rollout sau khi tích hợp M2 vào source sản xuất nhưng vẫn chạy ở môi trường cô lập, full E2E + billing/fleet.",
        ""]
(out/"release-readiness.md").write_text("\n".join(lines),encoding="utf8")
print(f"D173_E111_PRODUCTION_READINESS_{state}: {report['criteria_pass']}/{len(checks)} PASS")
for c in checks:
    if not c["pass"]:print("BLOCKER",c["gate"],str(c["evidence"])[:170])
# Dedicated CI gate stays visibly red for readiness FAIL; evidence is always uploaded.
raise SystemExit(0 if state=="PASS" else 1)
