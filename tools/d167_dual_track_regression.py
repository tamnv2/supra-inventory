#!/usr/bin/env python3
"""D167 source guard: CODE-ONLY repair + zero-cadence forensic enhancements."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
def read(path: str) -> str:
    return (root / path).read_text(encoding="utf-8")

store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt")
main = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt")
picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt")
overlay = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt")
for name in ("markOverlayAckPending", "pendingOverlayAcks", "isOverlayAckPending", "clearOverlayAck"):
    assert name in store, f"missing {name}"
assert "scopedAckKey(userId" in store
assert "SHA-256" in store
assert "legacyUnscopedAckCount" in store
assert 'quarantineOverlayAck(' in store and 'RESULT_ACK_NOT_FOUND' in main
assert 'RESULT_ACK_NOT_FOUND' in picker and 'RESULT_ACK_NOT_FOUND' in overlay
assert 'owner.userId' in main and 'ownerUserId' in picker and 'ownerUserId' in overlay
assert "if (api.session?.userId != owner.userId) break" in main
assert "WindowManager.BadTokenException" in main
assert "isFinishing || isDestroyed" in main
assert "safelyShowDialog(builder.create())" in main
# Reject calls with the old two-argument signature in all ACK delivery entrypoints.
for source in (main, picker, overlay):
    for f in ("markOverlayAckPending", "pendingOverlayAcks", "isOverlayAckPending", "clearOverlayAck"):
        for match in re.finditer(r"NotificationSignalStore\." + f + r"\(([^\n]*)\)", source):
            assert match.group(1).count(",") >= 2 if f != "pendingOverlayAcks" else match.group(1).count(",") >= 1, (f, match.group(0))
print("D167_ANDROID_ACK_OWNER_SCOPE_AND_DIALOG_GUARD=PASS")

quota = read("relay-agent/FirestoreQuotaGuard.cs")
rtdb = read("relay-agent/RtdbHaLiveness.cs")
leader = read("relay-agent/FirestoreAgentLeaderCoordinator.cs")
assert "d167_ha_events=" in quota and "D167HaEvents" in quota
assert "RTDB_SSE_FAILURE" in rtdb and 'RecordHaDiagnostic("RTDB_HEARTBEAT"' in rtdb
assert 'RTDB_NOT_FRESH_FIRESTORE_FALLBACK' in leader
assert 'PRIMARY_TAKEOVER_PROBE' in leader
assert "GetResponse()" in rtdb  # existing transport, unchanged role authority
print("D167_AGENT_RTDB_HA_LOCAL_AGGREGATE=PASS")

sql = read("service/src/d166-sql-usage.ts")
oper = read("service/src/operational-v2-core.ts")
route = read("service/src/d167-route-usage.ts")
core = read("service/src/core.ts")
metrics = read("service/src/system-metrics-core.ts")
worker = read("service/src/index.ts")
for name in (
    "BATCH_SNAPSHOT", "RECENT_RESULTS_COUNT", "RECENT_RESULTS_PAGE",
    "RECENT_STATUS_TOTALS", "RECENT_ACK_TOTALS", "REPORTER_QUEUE_COUNT",
    "REPORTER_QUEUE_PAGE", "PICKER_REPORTS_PAGE", "PICKER_RESULTS_PENDING",
    "COUNTER_RECENT_TOTAL",
):
    assert name in sql and name in oper
assert "WeakMap<DurableObjectState" in sql and "WeakMap<DurableObjectState" in route
assert "recordD167DoRequest(this.state, request.method, url.pathname)" in core
assert "d167_do_request_diagnostics: snapshotD167DoRequests(state)" in metrics
assert '/diagnostics/d167/usage' in core and worker
assert 'request.json()' in worker and 'D166_PRIVILEGED_AGENT_REQUIRED' in worker
assert 'D167RouteSample' in route and "raw" not in route.split("familyForPath", 1)[1].split("export function recordD167DoRequest", 1)[0].lower()
print("D167_DO_SQL_ROUTE_SNAPSHOT_AUTH=PASS")

gateway = read("ops/apps-script/agent-log-gateway/Code.gs")
agent = read("relay-agent/D166UsageExport.cs")
assert "no_data_groups" in gateway and "unavailable_groups" in gateway
assert "PROVIDER_INTERVAL_START_WHEN_PRESENT" in gateway
assert "pointHourKey_(p)" in gateway
assert "d167_inventorycore_diagnostics" in gateway and "providers/inventorycore_d167_local.json" in agent
assert "checksums.sha256" in agent
assert "D167_DO_SQL_ROUTE_SNAPSHOT_AUTH" not in gateway
print("D167_USAGE_EXPORT_EVIDENCE_INTEGRITY=PASS")
