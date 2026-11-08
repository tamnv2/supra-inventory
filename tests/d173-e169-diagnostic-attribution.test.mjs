import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const routes = read("service/src/d167-route-usage.ts");
const sqlAudit = read("service/src/d166-sql-usage.ts");
const recent = read("service/src/operational-v2-core.ts");
const core = read("service/src/core.ts");
const pickerLocks = read("relay-agent/FirestoreD173E140PickerLocks.cs");
const rtdb = read("relay-agent/RtdbHaLiveness.cs");
const ha = read("relay-agent/FirestoreAgentLeaderCoordinator.cs");

test("E169 DO attribution splits existing allowlisted route counters without additional provider calls or writes", () => {
  for (const family of [
    "HEALTH_PROBE", "MAINTENANCE_PLAN", "REALTIME_TICKET",
    "REALTIME_CONNECT", "REALTIME_BROADCAST", "REALTIME_CLOSE",
    "REALTIME_PRESENCE", "REALTIME_DELTA", "NOTIFY_TARGETS", "NOTIFY_CLEANUP",
  ]) assert.match(routes, new RegExp('return "' + family + '"'));
  assert.match(routes, /recordD173PersistedMetric\(state, "ROUTE", family, action/);
  assert.equal((routes.match(/recordD173PersistedMetric\(/g) || []).length, 1);
  assert.doesNotMatch(routes, /fetch\s*\(|setInterval|setTimeout|console\./);
});

test("E169 SQL shape uses an existing one-pass ACK aggregate and <= one log per isolate/hour", () => {
  const ackSql = recent.split('d166MeasuredSqlRows<SqlRow>(state, "RECENT_ACK_TOTALS",')[1]
    .split('...summaryArgs,')[0];
  assert.match(ackSql, /COUNT\(\*\) AS candidate_batches/);
  assert.match(ackSql, /missing_summaries/);
  assert.match(recent, /recordD173AckShape\(state, Number\(ackTotals\.candidate_batches/);
  assert.match(sqlAudit, /e169AckShapeHour\.get\(state\) === hour/);
  assert.match(sqlAudit, /sample=FIRST_PER_ISOLATE_HOUR/);
  assert.match(sqlAudit, /recordD173PersistedMetric\(state, "SQL", queryId/);
  assert.match(core, /D173_E128_LEGACY_HTTP_OPERATIONS = true/);
});

test("E169 denial telemetry uses fixed classifications, not raw RPC messages or identity", () => {
  assert.match(pickerLocks, /D173_E169 FIRESTORE_LISTEN_FAILURE listener=PICKER_LOCKS query=ACTIVE_LOCKS_GT_NOW/);
  assert.match(pickerLocks, /E169SafeRole/);
  assert.match(pickerLocks, /app_user_claim_present=/);
  assert.match(pickerLocks, /token_expired=/);
  assert.match(pickerLocks, /state=COOLDOWN grpc=/);
  assert.match(pickerLocks, /retry = Math\.Max\(retry, 300000\)/);
  const e169 = pickerLocks.split("D173_E169 FIRESTORE_LISTEN_FAILURE")[1]
    .split("if (ex.Status.StatusCode", 1)[0];
  assert.doesNotMatch(e169, /ex\.Message|ex\.Status\.Detail|IdToken|RefreshToken|LoginName/);
  assert.match(pickerLocks, /D173_E169 FIRESTORE_LISTEN_RECOVERED/);
});

test("E169 HA diagnostics only append to existing error/slow paths", () => {
  assert.match(rtdb, /D173_E169 RTDB_HEARTBEAT stage=ACK_SLOW/);
  assert.match(rtdb, /e169Elapsed\.ElapsedMilliseconds >= 2000/);
  assert.match(rtdb, /D173_E169 RTDB_PROBE stage=UNAVAILABLE/);
  assert.match(ha, /lease_last_ack_age_ms=/);
  assert.match(ha, /coordinator_age_ms=/);
  assert.match(ha, /PrimaryLeaseHeartbeatMs = 10000/);
  assert.match(ha, /StandbyTakeoverAgeMs = 15000/);
  assert.doesNotMatch(rtdb, /D173_E169.*IdToken|D173_E169.*session\./);
});
