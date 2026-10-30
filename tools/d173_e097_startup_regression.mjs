import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "../service/node_modules/typescript/lib/typescript.js";

// D173-E097: prove the fast startup path is read-only, fail-closed, and
// refuses incomplete D172/business/operational schemas.
const core = readFileSync("service/src/core.ts", "utf8");
const begin = core.indexOf("  private hasColumn(");
const end = core.indexOf("  private initializeSchema():", begin);
assert.ok(begin > 0 && end > begin, "must keep schema guard before legacy initializer");
const method = core.slice(begin, end);
assert.match(method, /private isExistingSchemaReady\(/);
assert.match(core.slice(end, end + 600), /if \(this\.isExistingSchemaReady\(\)\) return;/);
assert.match(core, /inventorycore_bootstrap_failed/);
assert.match(core, /blockConcurrencyWhile/);
assert.doesNotMatch(method, /\b(?:DELETE|UPDATE|INSERT|ALTER|DROP|CREATE)\b/i, "readiness must never mutate SQLite");
const compiled = ts.transpileModule(
  "class Probe { constructor(state) { this.state = state; }\n" + method + "\n}",
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }, reportDiagnostics: true },
);
assert.equal(compiled.diagnostics?.filter((x) => x.category === ts.DiagnosticCategory.Error).length, 0);
let operationalReady = true;
const Probe = vm.runInNewContext(compiled.outputText + "\nProbe;", {
  SCHEMA_VERSION: 17, operationalV2Readiness: () => ({ ready: operationalReady }), Error,
});

const objects = [
  "table:users", "table:sku_master", "table:report_batches", "table:report_tickets",
  "table:idempotency_keys", "table:realtime_events", "table:result_acknowledgements",
  "table:result_event_snapshots", "table:notification_delivery_attempts", "table:batch_summaries",
  "table:obpp_sessions", "table:obpp_records", "table:obpp_locations", "table:obpp_outbox",
  "table:obpp_migrations", "table:d167_sku_jobs", "table:d167_sku_active",
  "table:runtime_log_buffer", "table:launcher_log_folder", "table:d173_usage_counters",
  "index:idx_d167_pending_sku_day", "index:idx_d167_open_picker_sku_day",
  "index:obpp_pending_idx",
];
const columns = {
  users: ["web_session_generation","android_session_generation","shortage_reporting_enabled","last_login_at"],
  report_batches: ["business_day_vn","d167_first_overdue_at"],
  report_tickets: ["business_day_vn","d167_auto_skip_minutes"],
  obpp_sessions: ["token_hash","issued_at_ms"],
  obpp_records: ["actor_name","note"],
  obpp_locations: ["sheet_key","actor_name"],
  d167_sku_jobs: ["operator_id","grant_hash"],
  runtime_log_buffer: ["bundle_id"],
  launcher_log_folder: ["last_error"],
};
const migrationKeys = ["ACTOR_DISPLAY_V1", "HARD_DELETE_LEGACY_V1", "LOCATION_SHEET_KEY_V1"];
function mock(overrides = {}) {
  const calls = [];
  const state = { storage: { sql: { exec(sql) {
    calls.push(sql);
    const rows = sql.startsWith("SELECT value FROM schema_meta")
      ? [{ value: overrides.schemaVersion ?? "17" }]
      : sql.includes("FROM sqlite_master")
      ? (overrides.objects ?? objects).map((item) => {
          const [type, name] = item.split(":"); return {type,name};
        })
      : sql.startsWith("PRAGMA table_info(")
      ? (overrides.columns ?? columns)[sql.slice(18,-1)]?.map((name) => ({name})) ?? []
      : sql.includes("FROM obpp_migrations")
      ? (overrides.migrations ?? migrationKeys).map((key) => ({key}))
      : [];
    return {toArray: () => rows};
  } } } };
  return {state,calls};
}
let ctx = mock();
assert.equal(new Probe(ctx.state).isExistingSchemaReady(), true, "ready schema must fast boot");
assert.ok(ctx.calls.every((sql) => /^(SELECT|PRAGMA)\b/.test(sql)), "warm boot has only read probes");
assert.equal(new Probe(mock({schemaVersion:"16"}).state).isExistingSchemaReady(), false);
assert.equal(new Probe(mock({objects:objects.filter(x=>x!=="table:obpp_outbox")}).state).isExistingSchemaReady(), false);
assert.equal(new Probe(mock({migrations:migrationKeys.slice(0,2)}).state).isExistingSchemaReady(), false);
assert.equal(new Probe(mock({columns:{...columns,users:columns.users.slice(0,2)}}).state).isExistingSchemaReady(), false);
operationalReady = false;
assert.equal(new Probe(mock().state).isExistingSchemaReady(), false);
operationalReady = true;
const nomem = new Error("out of memory: SQLITE_NOMEM");
const broken = {storage:{sql:{exec:()=>{throw nomem;}}}};
assert.throws(() => new Probe(broken).isExistingSchemaReady(), /SQLITE_NOMEM/);
assert.equal(new Probe({storage:{sql:{exec:()=>{throw new Error("no such table");}}}}).isExistingSchemaReady(), false);
console.log("D173_E097_CORE_STARTUP_GUARD_PASS: read-only fast path, incomplete migration fallback, SQLITE_NOMEM fail-closed");
// Exercise the protected, fail-closed E097 Worker release gate on this exact source.
execFileSync("python3", ["-m", "py_compile", "tools/d173_e097_release_gate.py"], { stdio: "pipe" });
// D173-E100 is intentionally Agent-only. The E097 Worker release gate must
// still reject E100 (not a Worker release), while the actual E097 bootstrap
// regression above remains mandatory. Skip ONLY its Worker-only preflight on
// the exact E100 PR if all shared Worker/D172 sources match the main baseline.
const e100AgentOnlyPr = process.env.GITHUB_EVENT_NAME === "pull_request" &&
  process.env.GITHUB_HEAD_REF === "fix/d173-e100-agent160-session-roster-20261030";
if (e100AgentOnlyPr) {
  const receipt = JSON.parse(readFileSync("ops/d173-e100-agent160-release-authorization.json", "utf8"));
  assert.equal(receipt.owner_approval_reference,
    "OWNER_20261030_D173_E100_AGENT160_ROSTER_UTC_VERSION_SIGNED_OTA");
  assert.deepEqual(receipt.approved_components, ["agent"]);
  for (const guard of ["worker_mutation", "d172_business_mutation", "firebase_rules_mutation"]) {
    assert.equal(receipt[guard], false);
  }
  const immutablePaths = ["service/", "web/", "android/", "firebase/", "firebase.json",
    "obpp1291/", "ops/apps-script/", "functions/", "relay-agent-webview2-host/"];
  execFileSync("git", ["diff", "--quiet", receipt.base_main_sha, "HEAD", "--", ...immutablePaths],
    { stdio: "pipe" });
  console.log("D173_E097_WORKER_RELEASE_PREFLIGHT_NOT_APPLICABLE_TO_E100_AGENT_ONLY");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e103-agent162-zero-usage-activity-20261030") {
  // Agent-only repair does not replay the historical E097 Worker release grant.
  const receipt = JSON.parse(readFileSync("ops/d173-e104-agent162-release-authorization.json", "utf8"));
  assert.deepEqual(receipt.approved_components, ["agent"]);
  for (const key of ["worker_mutation", "d172_business_mutation", "firebase_rules_mutation"]) {
    assert.equal(receipt[key], false);
  }
  execFileSync("git", ["diff", "--quiet", receipt.base_main_sha, "HEAD", "--",
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "obpp1291/", "ops/apps-script/", "functions/", "relay-agent-webview2-host/"],
    { stdio: "pipe" });
  execFileSync("python3", ["tools/d173_e104_agent162_release_gate.py", "--component", "agent", "--preflight"], { stdio: "pipe" });
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "feat/d173-e103-agent161-roster-confirm-20261030") {
  const receipt = JSON.parse(readFileSync("ops/d173-e103-agent161-release-authorization.json", "utf8"));
  assert.equal(receipt.owner_approval_reference, "OWNER_20261030_D173_E103_AGENT161_WEB_PDA_ROSTER_PICKLIST_SCOPED_RELEASE");
  assert.deepEqual(receipt.approved_components, ["worker", "agent"]);
  assert.equal(receipt.d172_business_mutation, false);
  assert.equal(receipt.business_schema_mutation, false);
  assert.equal(receipt.stable_deploy_permission, false);
  execFileSync("git", ["diff", "--quiet", receipt.base_main_sha, "HEAD", "--",
    "service/src/core.ts", "service/src/index.ts", "web/", "android/",
    "firebase/", "firebase.json", "obpp1291/", "ops/apps-script/"],
    { stdio: "pipe" });
  execFileSync("python3", ["tools/d173_e103_release_gate.py", "--component", "worker", "--preflight"], { stdio: "pipe" });
} else {
  execFileSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { stdio: "pipe" });
}
