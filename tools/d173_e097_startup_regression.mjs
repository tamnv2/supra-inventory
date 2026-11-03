import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { execFileSync, spawnSync } from "node:child_process";
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
const e109CodeOnly = existsSync("ops/d173-e109-code-authorization.json") &&
  JSON.parse(readFileSync("ops/change-continuity/D173.json", "utf8")).deployment_gate
    .startsWith("E109_OWNER_CODE_ONLY_APPROVED");
if (e109CodeOnly) {
  // The warm/cold SQLite assertions above remain mandatory. This broader new
  // code-only source MUST NOT borrow the old E097 production release grant.
  const approval = JSON.parse(readFileSync("ops/d173-e109-code-authorization.json", "utf8"));
  assert.equal(approval.code_permission, true);
  assert.equal(approval.stop_at, "CODE_READY");
  for (const key of ["merge_main_permission", "deployment_permission", "provider_write_permission",
    "ota_publication_permission", "stable_permission", "d172_business_changes"]) assert.equal(approval[key], false);
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E109 code must not inherit an old release authorization");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED: (BUSINESS_OR_D172_DRIFT|SOURCE_PIN_DRIFT)/);
  console.log("D173_E109_CODE_ONLY_OLD_RELEASE_DENIAL_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           (process.env.GITHUB_HEAD_REF === "feat/d173-e111-reporter-sku0500-overtime2145-20261102" ||
            process.env.GITHUB_HEAD_REF === "fix/d173-e113-android123-ota-retrigger-20261102")) {
  // E111 approved new business behavior. Historical E097 Worker-only gate must
  // DENY this change, not accidentally authorize it; E111 needs its own release receipt.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E111 cannot inherit E097 source or release scope");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("D173_E111_OLD_E097_RELEASE_DENIAL_PASS");
} else if (e100AgentOnlyPr) {
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
           process.env.GITHUB_HEAD_REF === "fix/d173-e125-agent-sku-cdp-replay-20261103") {
  // Preserve ALL Worker SQLite and D172 assertions above, then require
  // Agent165's separate release preflight; historical E097 Worker grant denied.
  const receipt = JSON.parse(readFileSync("ops/d173-e125-agent165-release-authorization.json", "utf8"));
  assert.deepEqual(receipt.approved_components, ["agent"]);
  assert.equal(receipt.worker_mutation, false);
  assert.equal(receipt.d172_business_mutation, false);
  assert.equal(receipt.firebase_rules_mutation, false);
  execFileSync("git", ["diff", "--quiet", receipt.base_main_sha, "HEAD", "--",
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "obpp1291/", "ops/apps-script/", "functions/", "relay-agent-webview2-host/"],
    { stdio: "pipe" });
  execFileSync("python3", ["tools/d173_e125_agent165_release_gate.py", "--component", "agent", "--preflight"], { stdio: "pipe" });
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "Agent165 cannot inherit E097 Worker release permission");
  console.log("D173_E125_EXISTING_WORKER_REGRESSION_PASS__OLD_RELEASE_DENIED");
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
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "feat/d173-e123-owner-approved-prod-bundle-20261103") {
  // E123 changes live business/session behavior and must NEVER borrow the old
  // E097 Worker-only owner grant. Verify the new exact-scope release preflight
  // plus explicit historical grant denial, after startup assertions above.
  const auth = JSON.parse(readFileSync("ops/d173-e123-release-authorization.json", "utf8"));
  assert.equal(auth.checkpoint_id, "D173-E123");
  assert.equal(auth.worker_web_deployment_permission, true);
  assert.equal(auth.stable_deployment_permission, false);
  execFileSync("python3", ["tools/d173_e123_release_gate.py", "--component", "worker", "--preflight"], { stdio: "pipe" });
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("D173_E123_NEW_SCOPE_PASS__OLD_E097_AUTH_DENIED");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e127-log-drive-diagnostics-20261103") {
  // E127 is a distinct log-recovery candidate. Run the SQLite startup checks
  // above, then prove the historical E097 release gate DENIES this new source.
  // The E097 production authorization is not reused or bypassed.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E127 must never inherit E097 release permission");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("D173_E127_OLD_RELEASE_DENIED__SQLITE_STARTUP_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "audit/d173-readonly-usage-20261102") {
  // E122 has a NEW Owner-scoped read-only route. Never replay the historical
  // E097 Worker source pin; instead prove unchanged auth/email/D172 and one route.
  execFileSync("python3", ["tools/d173_e122_preservation_guard.py"], { stdio: "pipe" });
} else {
  execFileSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { stdio: "pipe" });
}
