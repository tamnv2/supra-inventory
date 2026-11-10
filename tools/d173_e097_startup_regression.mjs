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
  "table:obpp_sessions", "table:obpp_records", "table:obpp_record_changes",
  "table:obpp_locations", "table:obpp_outbox",
  "table:obpp_migrations", "table:d167_sku_jobs", "table:d167_sku_active",
  "table:runtime_log_buffer", "table:launcher_log_folder", "table:d173_usage_counters",
  "index:idx_d167_pending_sku_day", "index:idx_d167_open_picker_sku_day",
  "index:obpp_pending_idx", "index:obpp_records_page_idx",
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
// D172-E059: an already-running v9 DO lacks the E057 history journal and
// pagination index; it MUST enter the additive schema initializer once.
assert.equal(new Probe(mock({objects:objects.filter(x=>x!=="table:obpp_record_changes")}).state).isExistingSchemaReady(), false);
assert.equal(new Probe(mock({objects:objects.filter(x=>x!=="index:obpp_records_page_idx")}).state).isExistingSchemaReady(), false);
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
if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
    process.env.GITHUB_HEAD_REF === "fix/d173-e174-agent176-focus-log-backlog-20261109") {
  // E174 is signed Agent176 ONLY. Preserve all read-only warm/cold
  // SQLite/DO startup assertions above and prove the old E097 Worker
  // release grant is denied, without triggering unrelated Worker deployment.
  const auth = JSON.parse(readFileSync("ops/d173-e174-agent176-release-authorization.json", "utf8"));
  assert.equal(auth.change_id, "D173-E174");
  assert.equal(auth.owner_protected_release_approved, true);
  assert.equal(auth.agent_target_version, 176);
  for (const k of ["d172_mutation", "stable_mutation", "service_mutation",
    "android_mutation", "web_mutation"]) assert.equal(auth[k], false);
  execFileSync("git", ["diff", "--quiet",
    execFileSync("git", ["merge-base", "origin/main", "HEAD"], { encoding: "utf8" }).trim(), "HEAD", "--",
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/"], { stdio: "pipe" });
  execFileSync("python3", ["tools/d173_e174_agent176_release_gate.py",
    "--component", "agent", "--preflight"], { stdio: "pipe" });
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py",
    "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "Agent176 cannot inherit the E097 Worker release grant");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("D173_E174_WORKER_AND_D172_UNCHANGED__OLD_WORKER_GRANT_DENIED_PASS");
} else if (e109CodeOnly) {
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
           process.env.GITHUB_HEAD_REF === "fix/d173-e143-agent168-layout-embedded-browser-20261106") {
  // Owner E143 is Agent-only. Preserve all SQLite and D172 startup assertions
  // above and explicitly DENY archived E097 Worker release authorization.
  const auth = JSON.parse(readFileSync("ops/d173-e143-agent168-release-authorization.json", "utf8"));
  assert.equal(auth.owner_approval_reference, "OWNER_20261107_AGENT168_ONLY_CODE_AND_PROTECTED_RELEASE");
  assert.deepEqual(auth.approved_components, ["agent"]);
  assert.equal(auth.agent_target_version, 168);
  assert.equal(auth.d172_business_mutation, false);
  for (const key of ["worker_mutation", "web_mutation", "android_mutation",
    "firebase_rules_mutation", "gateway_mutation", "stable_deploy_permission"]) {
    assert.equal(auth[key], false);
  }
  execFileSync("git", ["diff", "--quiet", auth.base_main_sha, "HEAD", "--",
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/"], { stdio: "pipe" });
  execFileSync("python3", ["tools/d173_e143_agent168_release_gate.py",
    "--component", "agent", "--preflight"], { stdio: "pipe" });
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py",
    "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E143 native release must never inherit E097 Worker grant");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("D173_E143_SQLITE_D172_PARITY__OLD_WORKER_RELEASE_DENIED_PASS");
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
           process.env.GITHUB_HEAD_REF === "fix/d173-e128-legacy-http-rollback-20261103") {
  // E128 restores HTTP-only issuance for NEW business sessions. It is not
  // authorized by the historical E097 Worker grant. Keep every startup/SQLite
  // assertion above and prove the legacy release permission is DENIED.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], {encoding:"utf8"});
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E128 must not inherit E097 release authority");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  assert.match(core, /command_protocol_disabled: D173_E128_LEGACY_HTTP_OPERATIONS/);
  execFileSync("python3", ["tools/d173_e128_release_gate.py","--component","worker","--preflight"], { stdio:"pipe" });
  console.log("D173_E128_OLD_RELEASE_DENIED__SQLITE_STARTUP_PARITY_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e130-sku-schedule-manual-separated-20261103") {
  // E130 adds a scoped Worker SKU schedule SQL fix; the legacy E097 owner grant
  // must stay denied, while the E130 owner-gated preflight and startup pass.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], {encoding:"utf8"});
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E130 cannot inherit E097 Worker authority");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  execFileSync("python3", ["tools/d173_e130_release_gate.py", "--component", "worker", "--preflight"], {stdio:"pipe"});
  console.log("D173_E130_OLD_RELEASE_DENIED__SKU_SCHEDULE_STARTUP_PARITY_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e146-agent169-picker-cutoff-20261107") {
  // E146 has a distinct Owner-approved Worker+Agent source. Historical E097
  // production grant MUST DENY; exact E146 scope and D172 guard must PASS.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E146 cannot inherit E097 Worker release permission");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  execFileSync("python3", ["tools/d173_e146_source_guard.py"], { stdio: "pipe" });
  console.log("D173_E146_OLD_WORKER_RELEASE_DENIED__EXACT_OWNER_SCOPE_AND_SQLITE_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "docs/d173-e140-picklist-confirm-guard-forensics-20261105") {
  // E140 multi-component source approval is NOT the old E097 Worker deploy.
  // Keep old release denied, then validate exact Owner/PR/Rules/D172 boundary.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E140 must not inherit E097 provider release permission");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  execFileSync("python3", ["tools/d173_e140_preflight.py"], { stdio: "pipe" });
  console.log("D173_E140_OLD_E097_RELEASE_DENIED__OWNER_SCOPE_AND_SQLITE_STARTUP_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e127-worker-drive-recovery-main-20261104") {
  // E127 is a distinct log-recovery candidate. Run the SQLite startup checks
  // above, then prove the historical E097 release gate DENIES this new source.
  // The E097 production authorization is not reused or bypassed.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E127 must never inherit E097 release permission");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("D173_E127_OLD_RELEASE_DENIED__SQLITE_STARTUP_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e126-reporter-badge-fence-20261104") {
  // E126 only modifies Reporter Android UI and its tests. The historical
  // E097 Worker production grant must stay DENIED; no source-pin reuse.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], {encoding:"utf8"});
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E126 Android may not inherit old E097 Worker permission");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("D173_E126_ANDROID_ONLY__OLD_E097_WORKER_RELEASE_DENIED__SQLITE_STARTUP_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "audit/d173-readonly-usage-20261102") {
  // E122 has a NEW Owner-scoped read-only route. Never replay the historical
  // E097 Worker source pin; instead prove unchanged auth/email/D172 and one route.
  execFileSync("python3", ["tools/d173_e122_preservation_guard.py"], { stdio: "pipe" });
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e149-agent170-activity-webtab-20261107") {
  // E150 is Agent170 + Host13 ONLY. Historical E097 Worker authorization
  // must remain denied; retain the SQLite, WebSocket, and D172 tests above.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py",
    "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E150 cannot inherit historical Worker release rights");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  execFileSync("git", ["diff", "--quiet", "b8eed46a1676ccb8113690c676fe4b28b9caa17e",
    "HEAD", "--", "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/"], { stdio: "pipe" });
  execFileSync("python3", ["tools/d173_e150_agent170_release_gate.py",
    "--component", "agent", "--preflight"], { stdio: "pipe" });
  console.log("E150_OLD_WORKER_GRANT_DENIED__AGENT_ONLY_SCOPE_AND_SQLITE_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "feat/d173-e165-tray-usage0530-dayline-20261108") {
  const denied=spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], {encoding:"utf8"});
  assert.equal(denied.error,undefined);
  assert.notEqual(denied.status,0,"E167 cannot inherit E097 Worker grant");
  execFileSync("python3", ["tools/d173_e165_agent174_release_gate.py", "--component", "worker", "--preflight"], {stdio:"pipe"});
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "feat/d173-e169-diagnostic-attribution-20261108") {
  // E169 changes only observability; never inherit the old E097 Worker release pin.
  // All actual SQL/WS/bootstrap fixtures above still execute before this guard.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py",
    "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E169 cannot inherit historical Worker release rights");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("E169_OLD_WORKER_RELEASE_DENIED__STARTUP_SQL_WS_TESTS_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d173-e172-agent175-release-trigger-20261108") {
  // E172 only repairs Worker same-SHA release trigger/Agent175 gate;
  // actual SQLite/WS/startup regressions above still execute, legacy
  // E097 Worker grant is proven denied, E170 new authorization required.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py",
    "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "E172 cannot inherit old E097 Worker release");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  execFileSync("python3", ["tools/d173_e170_release_gate.py",
    "--component", "worker", "--preflight"], { stdio: "pipe" });
  console.log("E172_OLD_WORKER_GRANT_DENIED__E170_EXACT_SCOPE_AND_SQLITE_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           (process.env.GITHUB_HEAD_REF === "feat/d173-e175-unified-network-logs-ui-20261110" ||
            process.env.GITHUB_HEAD_REF === "fix/d173-e175-production-release-workflow-repair-20261110" ||
            process.env.GITHUB_HEAD_REF === "fix/d173-e175-d146-ten-slot-production-20261110")) {
  // E175 owns a new Worker source authorization. Historical E097 is DENIED.
  const grant = JSON.parse(readFileSync("ops/d173-e175-release-authorization.json", "utf8"));
  assert.equal(grant.owner_approved_code, true);
  assert.equal(grant.owner_approved_deploy, true);
  assert.equal(grant.d172_pending_hold, true);
  assert.equal(grant.d172_business_mutation, false);
  execFileSync("python3", ["tools/d173_e175_release_gate.py", "--component", "worker", "--preflight"], {stdio:"pipe"});
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], {encoding:"utf8"});
  assert.notEqual(denied.status, 0, "E175 must never inherit historical E097 Worker release");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  console.log("E175_SQLITE_STARTUP_OLD_RELEASE_DENIED_NEW_OWNER_PREFLIGHT_PASS");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           (process.env.GITHUB_HEAD_REF === "fix/d173-e182-agent180-field-layout-autowidth-20261110" ||
             process.env.GITHUB_HEAD_REF === "fix/d173-e182-agent181-field-40-60-flicker-20261110")) {
  // Agent181/182 only: all SQLite/DO cold/warm/startup assertions above remain
  // mandatory. Historical Worker E097 signing cannot authorize any Agent UI.
  const is182 = process.env.GITHUB_HEAD_REF === "fix/d173-e182-agent181-field-40-60-flicker-20261110";
  const auth = JSON.parse(readFileSync(
    is182 ? "ops/d173-e182-agent182-release-authorization.json" :
      "ops/d173-e182-agent181-release-authorization.json", "utf8"));
  assert.equal(auth.owner_protected_release_approved, true);
  assert.equal(auth.agent_target_version, is182 ? 182 : 181);
  assert.deepEqual(auth.approved_components, ["agent"]);
  for (const key of ["d172_mutation","stable_mutation","service_mutation",
    "web_mutation","android_mutation","worker_mutation","firestore_mutation",
    "host_mutation","confirm_business_mutation"])
    assert.equal(auth[key], false, key);
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py",
    "--component", "worker", "--preflight"], { encoding:"utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "Agent181 cannot inherit E097 Worker permission");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED:/);
  execFileSync("git", ["diff", "--quiet",
    execFileSync("git", ["merge-base", "origin/main", "HEAD"], {encoding:"utf8"}).trim(),
    "HEAD", "--", "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/"], { stdio: "pipe" });
  console.log((is182 ? "E182_AGENT182" : "E182_AGENT181") + "_SQLITE_AND_D172_ISOLATION__OLD_WORKER_GRANT_DENIED");
} else if (process.env.GITHUB_EVENT_NAME === "pull_request" &&
           process.env.GITHUB_HEAD_REF === "fix/d172-e059-v10-history-schema-fastpath-20261109") {
  // D172-E059 repairs the pre-v10 history schema readiness path, not D173 E097.
  // Always execute the warm/cold database tests above, then require historical
  // E097 release permission to DENY the D172 code change. No provider deploy.
  const denied = spawnSync("python3", ["tools/d173_e097_release_gate.py",
    "--component", "worker", "--preflight"], { encoding: "utf8" });
  assert.equal(denied.error, undefined);
  assert.notEqual(denied.status, 0, "D172 hotfix cannot inherit D173 E097 Worker release");
  assert.match(denied.stderr, /D173_E097_WORKER_RELEASE_DENIED: (BUSINESS_OR_D172_DRIFT|SOURCE_PIN_DRIFT)/);
  console.log("D172_E059_SCHEMA_STARTUP_PASS__OLD_D173_WORKER_GRANT_DENIED");
} else {
  execFileSync("python3", ["tools/d173_e097_release_gate.py", "--component", "worker", "--preflight"], { stdio: "pipe" });
}
