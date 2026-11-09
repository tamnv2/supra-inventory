#!/usr/bin/env python3
"""D167 source guard: CODE-ONLY repair + zero-cadence forensic enhancements."""
from pathlib import Path
import re
import runpy

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
assert 'COMMON_LEASE_EXPIRED' in leader and 'cross_network_liveness_v1' in leader
# E175 removed RTDB probe from HA decision authority. Keep the common
# Firestore lease proof and explicit legacy-mixed-version fail-closed behavior.
import json
e175 = json.loads(read("ops/d173-e175-release-authorization.json"))
if e175["owner_approved_code"] and e175["checkpoint_id"] == "D173-E175" and e175["agent_target_version"] == 177:
    assert e175["no_stable"] and e175["d172_pending_hold"]
    assert 'LEGACY_LEASE_NO_COMMON_PROOF' in leader
    assert 'NEXT_A_LIVENESS", "COMMON_FIRESTORE"' in leader
    assert '_rtdbLiveness.WriteHeartbeat(' not in leader
    assert 'HasFreshCommonPrimaryLease()' in leader
else:
    assert 'RtdbPrimaryProbeStatus.UNAVAILABLE' in leader
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
    "BATCH_SNAPSHOT", "RECENT_RESULTS_PAGE",
    "RECENT_STATUS_TOTALS", "RECENT_ACK_TOTALS", "REPORTER_QUEUE_COUNT",
    "REPORTER_QUEUE_PAGE", "PICKER_REPORTS_PAGE", "PICKER_RESULTS_PENDING",
    "COUNTER_RECENT_TOTAL",
):
    assert name in sql and name in oper
# E055 eliminates the redundant recent count entirely; keep the historical
# query ID allowlisted for existing retained telemetry, but never execute it.
assert "RECENT_RESULTS_COUNT" in sql
assert 'd166MeasuredSqlRows<SqlRow>(state, "RECENT_RESULTS_COUNT"' not in oper
assert 'total: status === "HAS_STOCK"' in oper
assert "WeakMap<DurableObjectState" in sql and "WeakMap<DurableObjectState" in route
assert "recordD167DoRequest(this.state, request.method, url.pathname," in core
assert "d167_do_request_diagnostics: snapshotD167DoRequests(state)" in metrics
assert '/diagnostics/d167/usage' in core and worker
assert 'request.json()' in worker
if 'authorizedAgentRead(request, env, "usage-diagnostics")' in worker:
    # E109 moves the live-role/named-operator decision into the same Core read.
    # Reuse the strict verified-JWT bridge + current Core guards instead of
    # requiring the old error string to remain in the Worker source file.
    runpy.run_path(str(root / "tools/d166_cloudflare_regression.py"))
    usage_route = worker.split('url.pathname === "/api/agent/d166/usage"', 1)[1].split('url.pathname === "/api/agent/log-day-folder"', 1)[0]
    assert 'authorizedAgentRead(request, env, "usage-diagnostics")' in usage_route
    assert 'if (!diagnosticResponse.ok) return diagnosticResponse;' in usage_route
    assert usage_route.index('if (!diagnosticResponse.ok)') < usage_route.index('collectD166Cf(')
else:
    assert 'D166_PRIVILEGED_AGENT_REQUIRED' in worker
assert 'D167RouteSample' in route and "raw" not in route.split("familyForPath", 1)[1].split("export function recordD167DoRequest", 1)[0].lower()
print("D167_DO_SQL_ROUTE_SNAPSHOT_AUTH=PASS")

# E109 leaves HTTP attempt hooks at the HTTP boundary. WS activity is a
# separately labelled local observation, never a replacement billed-request
# counter. Existing exports retain both aggregates without extra I/O/cadence.
android_api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
android_transport = read("android/app/src/main/java/cd/cc/supra/inventory/beta/D173CommandTransport.kt")
android_audit = read("android/app/src/main/java/cd/cc/supra/inventory/beta/D166UsageAudit.kt")
web_api = read("web/src/api.ts")
web_logger = read("web/src/runtime-logger.ts")
assert android_api.count("D166UsageAudit.recordApi(") == 1
assert "D166UsageAudit.recordApi(" in android_api.split("private fun execute(", 1)[1]
assert "recordApi(" not in android_transport
for outcome in ("ATTEMPT", "SUCCESS", "ERROR", "TIMEOUT", "RETRY"):
    assert '"' + outcome + '"' in android_transport
assert 'D166UsageAudit.recordTransport("CLOUDFLARE_COMMAND"' in android_transport
for marker in ('"http_groups"', '"sdk_transport_groups"', "RAM_PER_ATTEMPT_NOT_PROVIDER_BILLING",
               "LOCAL_CALLBACK_COUNTS_NOT_FIREBASE_BILLED_OPERATIONS", "sdkCounts.size >= 320"):
    assert marker in android_audit, "missing distinct bounded Android metric " + marker
for marker in ('"HTTP", "WEBSOCKET", "WS_HTTP_HEDGE"', "data.http_attempts", "data.websocket_frames_sent",
               "bucket.http_attempts += httpAttempts", "bucket.websocket_frames_sent += websocketFramesSent"):
    assert marker in web_logger, "missing distinct Web metric " + marker
assert "http_attempts: httpAttempts" in web_api and "websocket_frames_sent: websocketFramesSent" in web_api
assert "ESTIMATE_NOT_BILLING" in route and 'recordD173PersistedMetric(state, "ROUTE"' in route
print("D173_HTTP_ATTEMPTS_WS_OBSERVATIONS_AND_DURABLE_ROUTE_METRICS_DISTINCT_NOT_BILLING=PASS")

gateway = read("ops/apps-script/agent-log-gateway/Code.gs")
agent = read("relay-agent/D166UsageExport.cs")
assert "no_data_groups" in gateway and "unavailable_groups" in gateway
assert "PROVIDER_INTERVAL_START_WHEN_PRESENT" in gateway
assert "pointHourKey_(p)" in gateway
assert "d167_inventorycore_diagnostics" in gateway and "providers/inventorycore_d167_local.json" in agent
assert "checksums.sha256" in agent
assert "D167_DO_SQL_ROUTE_SNAPSHOT_AUTH" not in gateway
print("D167_USAGE_EXPORT_EVIDENCE_INTEGRITY=PASS")
