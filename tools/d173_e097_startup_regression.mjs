import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
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