import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const get = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const worker = get("service/src/index.ts");
const core = get("service/src/core.ts");
const buffered = get("service/src/runtime-logs-core.ts");
const drive = get("service/src/runtime-logs.ts");
const auth = get("service/src/d173-sql-audit-auth.ts");
const workflow = get(".github/workflows/d173-daily-usage-2200.yml");

test("E170 reuses existing owner HMAC, not a public/unauthenticated log API", () => {
  const scope = worker.split('if (url.pathname === D173_SQL_AUDIT_PATH)')[1]
    .split('if (request.method === "POST" && url.pathname === "/api/internal/d161/hr-drive-watch")')[0];
  assert.match(scope, /verifyD173SqlAuditSignature\(request, env\.D166_CF_READ_TOKEN\)/);
  assert.match(scope, /mode"\) === "DAILY_EVIDENCE"/);
  assert.match(scope, /collectD173AgentDriveEvidence/);
  assert.match(scope, /status:sql\.status/);
  assert.match(auth, /D173_SQL_AUDIT_SKEW_SECONDS = 90/);
  const newMode = scope.split('if (url.searchParams.get("mode") === "LOG_ARCHIVE")')[0];
  assert.doesNotMatch(newMode, /JSON\.stringify\(.*token/);
});

test("E170 24h bounded SQL/route read without added business-path or telemetry writes", () => {
  const scope=core.split('url.pathname === "/diagnostics/d173/daily-attribution"')[1]
    .split('url.pathname === "/d167/shift/history"')[0];
  assert.match(scope, /endMs - startMs !== 86_400_000/);
  assert.match(scope, /FROM d173_usage_counters/);
  assert.match(scope, /LIMIT 2401/);
  assert.doesNotMatch(scope, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|fetch\(/);
  assert.match(scope, /"INVENTORYCORE_HOURLY_METRICS_NOT_CLOUDFLARE_BILLING"/);
});

test("E170 archive coverage is based on original generated time with late receipts distinguished", () => {
  const scope=buffered.split('url.pathname === "/runtime-logs/d173-daily-coverage"')[1]
    .split('D173-E127: manual admin-only archive diagnosis')[0];
  assert.match(scope, /generated_at >= \? AND generated_at < \?/);
  assert.match(scope, /drive_synced/);
  assert.match(scope, /late_over_30min/);
  assert.match(scope, /complete_fleet:false/);
  assert.doesNotMatch(scope, /content_text|SELECT \*|DriveApp|fetch\(/);
});

test("E170 Drive reader keeps only source-owned folder and allowlisted anonymous code counts", () => {
  const scope=drive.split("export async function collectD173AgentDriveEvidence(")[1];
  assert.match(scope, /env\.LOGS_FOLDER_ID/);
  assert.match(scope, /driveQueryEscape\(env\.LOGS_FOLDER_ID\)/);
  assert.match(scope, /MAX_FILES = 24, MAX_BYTES = 240_000/);
  assert.match(scope, /FIRESTORE_LISTEN_DENIED/);
  assert.match(scope, /RTDB_SSE_UNAVAILABLE/);
  assert.match(scope, /fleet_coverage:"UNVERIFIED"/);
  assert.match(scope, /files_skipped:skipped/);
  assert.doesNotMatch(scope, /return.*item\.id|return.*file\.name|console\.log/);
});

test("E170 05:30 schedule and source CI not modified to extra polling", () => {
  assert.match(workflow, /cron: "30 22 \* \* \*"/);
  assert.match(worker, /DAY_OUT_OF_RANGE/);
  assert.match(worker, /DAILY_EVIDENCE/);
});
