import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "../service/node_modules/typescript/lib/typescript.js";

// Run actual service modules against SQLite. No network, Worker or provider.
const modules = new Map();
function load(path) {
  path = resolve(path.endsWith(".ts") ? path : path + ".ts");
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} };
  modules.set(path, module);
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }}).outputText;
  new Function("require", "module", "exports", code)(specifier => {
    assert.ok(specifier.startsWith("."), "only local service modules in fixture");
    return load(resolve(dirname(path), specifier));
  }, module, module.exports);
  return module.exports;
}

const db = new DatabaseSync(":memory:");
const statements = [];
const kv = new Map();
let savepoint = 0;
const state = {
  storage: {
    sql: { exec(sql, ...bindings) {
      statements.push(sql);
      let rows;
      if (!bindings.length && /^\s*(?:CREATE|ALTER|DROP|PRAGMA foreign_keys)/i.test(sql)) {
        db.exec(sql); rows = [];
      } else rows = db.prepare(sql).all(...bindings).map(row => ({ ...row }));
      return { toArray: () => rows, one: () => rows[0], rowsRead: rows.length,
        rowsWritten: /^\s*(?:INSERT|UPDATE|DELETE)/i.test(sql) ? 1 : 0,
        *[Symbol.iterator]() { yield* rows; } };
    }},
    transactionSync(fn) {
      const name = "fixture_" + ++savepoint;
      db.exec("SAVEPOINT " + name);
      try { const result = fn(); db.exec("RELEASE " + name); return result; }
      catch (error) { db.exec("ROLLBACK TO " + name); db.exec("RELEASE " + name); throw error; }
    },
    async get(key) { return kv.get(key); }, async put(key, value) { kv.set(key, value); },
    async delete(key) { return kv.delete(key); }, async list({ prefix = "" } = {}) { return new Map([...kv].filter(([key]) => key.startsWith(prefix))); },
    async setAlarm() {}, async deleteAlarm() {},
  },
  tasks: [], blockConcurrencyWhile(fn) { const task = fn(); this.tasks.push(task); return task; },
  getWebSockets() { return []; }, waitUntil(promise) { this.tasks.push(promise); },
};
const { InventoryCore } = load("service/src/core.ts");
const core = new InventoryCore(state, { APP_ENV: "beta", PROJECT_KEY: "fixture", FIREBASE_PROJECT_ID: "fixture" });
await Promise.all(state.tasks);
const fixedNow = Date.parse("2026-11-01T17:30:00Z"); // 00:30 VN next day.
const realNow = Date.now;
Date.now = () => fixedNow;
const operational = load("service/src/operational-v2-core.ts");
const { readD173Snapshot } = load("service/src/d173-snapshot-core.ts");
const insertUser = db.prepare(`INSERT INTO users(user_id,firebase_uid,employee_code,display_name,role,status,
  shortage_reporting_enabled,web_session_generation,android_session_generation,firebase_agent_ready)
  VALUES(?,?,?,?,?,'ACTIVE',1,3,7,1)`);
insertUser.run("fixture-reporter", "uid-reporter", "reporter", "Reporter", "REPORTER");
insertUser.run("fixture-picker", "uid-picker", "picker", "Picker", "PICKER");
insertUser.run("fixture-other", "uid-other", "other", "Other", "PICKER");
insertUser.run("fixture-admin", "uid-admin", "admin", "Admin", "ADMIN");
insertUser.run("fixture-obpp", "uid-obpp", "obpp", "OBPP", "OBPP_COORDINATOR");
db.exec(`INSERT INTO sku_master(sku,product_name) VALUES('12345678','Fixture product');`);
const batch = db.prepare(`INSERT INTO report_batches(batch_id,sku,product_name,status,first_report_at,last_report_at,
 resolved_at,resolution,version,business_day_vn,created_at,updated_at)
 VALUES(?,?,'Fixture product',?,?,?,?,?,1,?,?,?)`);
const ticket = db.prepare(`INSERT INTO report_tickets(ticket_id,batch_id,picker_user_id,picker_employee_code,sku,status,
 business_day_vn,reported_at,withdraw_deadline_at,created_at,updated_at)
 VALUES(?,?,?,?, '12345678',?,?,?, ?,?,?)`);
for (const [id, status, at, owner] of [
  ["b-open", "PENDING", "2026-11-01T16:00:00Z", "fixture-picker"],
  ["b-recent", "HAS_STOCK", "2026-11-01T17:10:00Z", "fixture-picker"],
  ["b-old", "CLOSED", "2026-10-31T15:00:00Z", "fixture-picker"],
  ["b-other", "PENDING", "2026-11-01T17:20:00Z", "fixture-other"],
]) {
  const resolved = status === "PENDING" ? null : at;
  db.prepare("INSERT INTO sku_master(sku,product_name) VALUES(?,?)").run("sku-" + id, "Fixture product");
  batch.run(id, "sku-" + id, status, at, at, resolved, ["HAS_STOCK", "SKIP_ALLOWED"].includes(status) ? status : null, "2026-11-02", at, at);
  ticket.run("t-" + id, id, owner, owner === "fixture-picker" ? "picker" : "other",
    status === "PENDING" ? "OPEN" : status === "CLOSED" ? "WITHDRAWN" : "RESOLVED", "2026-11-02", at, at, at, at);
}
const reporter = { user_id: "fixture-reporter", employee_code: "reporter", role: "REPORTER" };
const picker = { user_id: "fixture-picker", employee_code: "picker", role: "PICKER", shortage_reporting_enabled: 1 };
async function old(path, params) {
  const result = await operational.handleOperationalV2CoreRequest(state,
    new Request("https://inventory-core.internal/operational/" + path + "?" + new URLSearchParams(params)));
  assert.ok(result && result.ok, path);
  return result.json();
}
try {
  const from = "2026-11-01T17:00:00.000Z", to = "2026-11-02T17:00:00.000Z";
  const params = new URLSearchParams({ queue_limit: "1", queue_offset: "1", recent_limit: "1", recent_offset: "0", from, to, status: "HAS_STOCK", include_overdue: "1" });
  const before = statements.length;
  const snapshot = await readD173Snapshot(state, "REPORTER", reporter, params, fixedNow);
  assert.ok(!(snapshot instanceof Response));
  const capturedStatements = statements.slice(before);
  assert.deepEqual(snapshot.snapshot.queue, await old("reporter/queue", { limit: "1", offset: "1" }));
  assert.deepEqual(snapshot.snapshot.recent, await old("reporter/recent", { limit: "1", offset: "0", from, to, status: "HAS_STOCK" }));
  assert.deepEqual(snapshot.snapshot.counters, await old("reporter/counters", { from, to, status: "HAS_STOCK" }));
  assert.equal(capturedStatements.filter(sql => /AS has_stock_total/.test(sql)).length, 0, "reuse equal recent aggregates; no duplicate terminal count scan");
  assert.equal(capturedStatements.filter(sql => /COUNT\(\*\) AS total[\s\S]*s\.waiting_picker_count > 0/.test(sql)).length, 1, "one queue count reused for counter");
  assert.equal(snapshot.coverage.cursor_authority, false, "view snapshot is not global applied-event cursor proof");
  const today = await readD173Snapshot(state, "REPORTER", reporter, new URLSearchParams({ recent_scope: "APP_TODAY_OPEN" }), fixedNow);
  assert.equal(today.snapshot.counters.from, from, "counter day comes from server VN clock, not device date");
  assert.equal(today.snapshot.counters.to, to);
  assert.equal(today.snapshot.recent.today_start, from);
  for (const params of [new URLSearchParams({ from }), new URLSearchParams({ from: "bad", to }), new URLSearchParams({ from: to, to: from })]) {
    assert.equal((await readD173Snapshot(state, "REPORTER", reporter, params, fixedNow)).status, 400);
  }
  const own = await readD173Snapshot(state, "PICKER", picker, new URLSearchParams({ limit: "1", offset: "1", scope: "APP_TODAY_OPEN", result_limit: "50", display_only: "1", user_id: "fixture-other" }), fixedNow);
  assert.deepEqual(own.snapshot.reports, await old("picker/reports", { user_id: picker.user_id, employee_code: picker.employee_code, limit: "1", offset: "1", scope: "APP_TODAY_OPEN" }));
  assert.deepEqual(own.snapshot.results, await old("picker/results", { user_id: picker.user_id, limit: "50", display_only: "1" }));
  assert.ok(!JSON.stringify(own.snapshot.reports).includes("t-b-other"), "caller cannot substitute Picker identity");
  const disabled = await readD173Snapshot(state, "PICKER", { ...picker, shortage_reporting_enabled: 0 }, new URLSearchParams(), fixedNow);
  assert.deepEqual(disabled.snapshot.results, { items: [], count: 0, total: 0, reporting_enabled: false });

  const headers = (uid, channel = "WEB", generation = 3) => ({ "x-supra-auth-uid": uid,
    "x-supra-session-channel": channel, "x-supra-session-generation": String(generation) });
  const request = (path, h) => core.fetch(new Request("https://inventory-core.internal" + path, { headers: h }));
  assert.equal((await request("/authorized/operational/reporter/snapshot", headers("uid-reporter", "WEB", 2))).status, 401, "replaced session fails closed");
  assert.equal((await request("/authorized/operational/reporter/snapshot", headers("uid-obpp"))).status, 403, "D172 business role has no Inventory snapshot authority");
  assert.equal((await request("/authorized/agent/read?operation=reporter-online", headers("uid-admin", "WEB"))).status, 401, "Web identity is not Agent");
  assert.equal((await request("/authorized/read/realtime/presence", headers("uid-admin", "ANDROID", 7))).status, 403, "management stays Web-only");
  assert.equal((await request("/authorized/agent/read?operation=reporter-online", headers("uid-admin", ""))).status, 200, "existing channel-less Agent identity preserved");

  // A global gap belonging to another audience is explicitly covered by delta,
  // while a bounded scan still forces continuation when later rows exist.
  const insertEvent = db.prepare(`INSERT INTO realtime_events(event_id,event_type,batch_id,ticket_id,batch_version,scopes_json,payload_json,created_at)
    VALUES(?,'REPORT_CREATED',?,?,1,'["picker_reports"]','{}',?)`);
  for (const [event, batchId, ticketId] of [["gap-other-1", "b-other", "t-b-other"], ["gap-own", "b-open", "t-b-open"], ["gap-other-2", "b-other", "t-b-other"]]) {
    insertEvent.run(event, batchId, ticketId, new Date(fixedNow).toISOString());
  }
  const delta = await old("realtime/delta", { user_id: picker.user_id, role: picker.role, after_seq: "0", limit: "2" });
  assert.equal(delta.events.length, 1);
  assert.equal(delta.events[0].event_id, "gap-own");
  assert.equal(delta.cursor_seq, 2);
  assert.equal(delta.has_more, true);
  assert.deepEqual(delta.audience_coverage, { from_seq: 1, through_seq: 2, stream_epoch: delta.stream_epoch,
    user_id: picker.user_id, role: picker.role, scope: "AUTHORIZED_GLOBAL_SCAN", complete: true });
  const tail = await old("realtime/delta", { user_id: picker.user_id, role: picker.role, after_seq: "2", limit: "2" });
  assert.equal(tail.events.length, 0);
  assert.equal(tail.cursor_seq, 3);
  assert.equal(tail.has_more, false);

  const resolveInput = { batch_id: "b-open", resolution: "HAS_STOCK", request_id: "e108-fixture-resolve-0001",
    read_model: { kind: "REPORTER", params: { from, to, recent_limit: "50" } } };
  const resolveOnce = async input => {
    const response = await core.fetch(new Request("https://inventory-core.internal/authorized/business/shortage/resolve", {
      method: "POST", headers: { ...headers("uid-reporter"), "content-type": "application/json" }, body: JSON.stringify(input),
    }));
    assert.equal(response.status, 200);
    return response.json();
  };
  const firstResolve = await resolveOnce(resolveInput);
  assert.ok(firstResolve.result.read_model?.snapshot, "post-mutation projection returned without separate DO fetch");
  assert.equal(firstResolve.result.read_model.snapshot.queue.items.some(row => row.batch_id === "b-open"), false);
  const replay = await resolveOnce(resolveInput);
  assert.equal(replay.result.idempotent_replay, true);
  assert.equal(replay.result.event_id, firstResolve.result.event_id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM report_events WHERE batch_id='b-open' AND event_type='BATCH_RESOLVED'").get().n, 1,
    "post-commit snapshot and retry cannot duplicate business result/event");

  db.prepare("UPDATE users SET status='DISABLED' WHERE firebase_uid=?").run("uid-admin");
  assert.equal((await request("/authorized/agent/read?operation=reporter-online", headers("uid-admin", ""))).status, 403, "immediate disable, no auth cache");
  console.log("D173_E108_SNAPSHOT_SQLITE_PASS: projection parity, aggregate reuse, VN midnight, paging, auth isolation, audience gaps, post-mutation snapshot, atomic result replay");
} finally { Date.now = realNow; db.close(); }
