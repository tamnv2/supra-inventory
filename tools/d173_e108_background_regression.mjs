import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "../service/node_modules/typescript/lib/typescript.js";

function load(path, imports, globals = {}) {
  const result = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  vm.runInNewContext(result.outputText, { exports, require(name) {
    if (!(name in imports)) throw Error("unexpected dependency: " + name);
    return imports[name];
  }, Request, Response, URL, Headers, console, crypto, TextEncoder, Date, setTimeout, ...globals });
  return exports;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const request = (path, body) => new Request("https://inventory-core.internal" + path,
  body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });

// Moving three existing operations into one invocation preserves their order,
// missing-event fallback and the authoritative closed-window short circuit.
let calls = [], opened = true, eventAvailable = true, failEvent = false, failAttempts = false, failLogs = false, failHr = false;
const background = load("service/src/d173-background-core.ts", {
  "./alert-window-core": { readAndroidAlertWindow() { calls.push("window"); return { is_open: opened }; } },
  "./notifications-core": { async handleNotificationCoreRequest(_state, req) {
    const path = new URL(req.url).pathname; calls.push(path);
    if (path.endsWith("targets")) return json({ tokens: ["private-token"], batch: { sku: "S", product_name: "P" } });
    if (path.endsWith("delivery-attempts")) {
      if (failAttempts) throw Error("attempt storage unavailable");
      return json({ status: "recorded", recorded: 1 });
    }
    if (path.endsWith("disable-tokens")) {
      assert.deepEqual((await req.json()).tokens, ["invalid-token"]); return json({ disabled: 1 });
    }
    throw Error("unexpected notification operation");
  } },
  "./operational-v2-core": { async handleOperationalV2CoreRequest() {
    if (failEvent) throw Error("event storage unavailable");
    calls.push("event"); return eventAvailable ? json({ event: { seq: 9, batch_version: 2 } }) : json({}, 404);
  } },
  "./runtime-logs-core": { readPendingRuntimeLogArchives() {
    calls.push("logs"); if (failLogs) throw Error("storage unavailable"); return { items: [{ log_id: "local_test" }] };
  } },
});
const state = { storage: { sql: { exec() {
  calls.push("hr"); if (failHr) throw Error("storage unavailable");
  return { toArray: () => [{ value_json: JSON.stringify({ status: "WAITING_FOR_COMPLETION", wait_started_at: "2026-11-01T00:00:00Z" }) }] };
} } } };
const context = { async reconcileOperatingSchedule() { calls.push("reconcile"); } };
let prepared = await background.handleD173BackgroundCoreRequest(state, request("/notifications/prepare", { result_event_id: "event" }), context);
assert.deepEqual(calls, ["reconcile", "window", "event", "/notifications/targets"]);
assert.deepEqual(await prepared.json(), { is_open: true, tokens: ["private-token"], batch: { sku: "S", product_name: "P" }, event_seq: "9", batch_version: "2" });
opened = false; calls = [];
assert.deepEqual(await (await background.handleD173BackgroundCoreRequest(state, request("/notifications/prepare", {}), context)).json(), { is_open: false, tokens: [] });
assert.deepEqual(calls, ["reconcile", "window"]);
opened = true; eventAvailable = false;
assert.equal((await (await background.handleD173BackgroundCoreRequest(state, request("/notifications/prepare", { result_event_id: "missing" }), context)).json()).event_seq, "");
failEvent = true;
assert.equal((await (await background.handleD173BackgroundCoreRequest(state, request("/notifications/prepare", { result_event_id: "missing" }), context)).json()).tokens.length, 1);
failEvent = false;
calls = [];
await background.handleD173BackgroundCoreRequest(state, request("/notifications/delivery-complete", { invalid_tokens: ["invalid-token"] }), context);
assert.deepEqual(calls, ["/notifications/delivery-attempts", "/notifications/disable-tokens"]);
failAttempts = true; calls = [];
assert.equal((await background.handleD173BackgroundCoreRequest(state, request("/notifications/delivery-complete", { invalid_tokens: ["invalid-token"] }), context)).status, 500);
assert.deepEqual(calls, ["/notifications/delivery-attempts", "/notifications/disable-tokens"]);
failAttempts = false;
failLogs = true;
let plan = await (await background.handleD173BackgroundCoreRequest(state, request("/maintenance/plan"), context)).json();
assert.equal(plan.runtime_logs.ok, false); assert.equal(plan.hr_sync.ok, true);
failLogs = false; failHr = true;
plan = await (await background.handleD173BackgroundCoreRequest(state, request("/maintenance/plan"), context)).json();
assert.equal(plan.runtime_logs.ok, true); assert.equal(plan.hr_sync.ok, false);

// Both HTTP and WS use the same public-envelope/FCM helper. The result returns
// before the provider send resolves; tokens are only in the private scheduler.
let providerCalls = [], providerRelease;
const providerGate = new Promise(resolve => { providerRelease = resolve; });
const business = load("service/src/business-api.ts", {
  "./auth": {}, "./privileged-auth": {},
  "./fcm": { async sendFcmNotifications(_sa, _project, tokens, payload) {
    providerCalls.push({ tokens, payload }); await providerGate;
    return { attempts: [{ token: "private-token", status: "FAILED", error_code: "UNREGISTERED" }], invalidTokens: ["private-token"] };
  } },
});
const hops = [], jobs = [];
const env = { FIREBASE_PROJECT_ID: "fixture-project", GOOGLE_RUNTIME_SA_JSON: "REDACTED-FIXTURE-ONLY",
  INVENTORY_CORE: { idFromName: name => name, get: () => ({ async fetch(url, init) {
    const path = new URL(url).pathname; hops.push({ path, body: init?.body ? JSON.parse(init.body) : null });
    if (path === "/notifications/prepare") return json({ is_open: true, tokens: ["private-token"], batch: { sku: "SKU", product_name: "Product" }, event_seq: "12", batch_version: "3" });
    if (path === "/notifications/delivery-complete") return json({ recorded: 1 });
    throw Error("unexpected additional DO hop");
  } }) } };
const raw = json({ result: { batch_id: "b", event_id: "e", resolved_by_display_name: "Resolver", resolved_by_role: "REPORTER" }, prepared: null });
const result = await business.scheduleD173ShortageFcm(env, { waitUntil(job) { jobs.push(job); } }, "resolve", { resolution: "HAS_STOCK" }, raw);
assert.deepEqual(await result.json(), { batch_id: "b", event_id: "e", resolved_by_display_name: "Resolver", resolved_by_role: "REPORTER" });
for (let i = 0; i < 20 && !providerCalls.length; i++) await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(providerCalls.length, 1); assert.equal(hops.length, 1); assert.equal(hops[0].path, "/notifications/prepare");
assert.equal(providerCalls[0].payload.data.event_seq, "12");
assert.equal(providerCalls[0].payload.data.batch_version, "3");
providerRelease(); await Promise.all(jobs);
assert.equal(hops.length, 2); assert.equal(hops[1].path, "/notifications/delivery-complete");
assert.deepEqual(hops[1].body.invalid_tokens, ["private-token"]);
const hidden = await business.scheduleD173ShortageFcm(env, undefined, "create", {}, json({ prepared: { tokens: ["secret"] } }));
assert.equal(hidden.status, 503); assert.equal(JSON.stringify(await hidden.json()).includes("secret"), false);
const denied = await business.scheduleD173ShortageFcm(env, { waitUntil() { throw Error("must not schedule on denied operation"); } }, "resolve", {}, json({ result: { error: "FORBIDDEN" } }, 403));
assert.equal(denied.status, 403);

// Failure of one plan section uses only that original reader. A total failure
// retains both old reads, rather than losing either maintenance task.
let maintenanceCalls = [], planResponse = { runtime_logs: { ok: true, items: [] }, hr_sync: { ok: false } };
const worker = load("service/src/d173-background-worker.ts", {
  "./runtime-logs": { async retryBufferedRuntimeLogArchives(_env, _limit, prefetched) { maintenanceCalls.push(["logs", prefetched]); } },
  "./hr-event-sync": { async retryIncompleteHrSnapshotIfDue(_env, prefetched) { maintenanceCalls.push(["hr", prefetched]); } },
});
const maintenanceEnv = { INVENTORY_CORE: { idFromName: () => "one", get: () => ({ fetch: async () => json(planResponse) }) } };
await worker.runD173ScheduledMaintenance(maintenanceEnv);
assert.equal(maintenanceCalls.length, 2); assert.equal(maintenanceCalls[0][1].items.length, 0); assert.equal(maintenanceCalls[1][1], undefined);
maintenanceCalls = []; maintenanceEnv.INVENTORY_CORE.get = () => ({ fetch: async () => { throw Error("storage unavailable"); } });
await worker.runD173ScheduledMaintenance(maintenanceEnv);
assert.equal(maintenanceCalls.length, 2); assert.equal(maintenanceCalls[0][1], undefined); assert.equal(maintenanceCalls[1][1], undefined);

// Exercise the real legacy reader and combined reader with a maximal ordinary
// 20-log batch. The combined path must not construct/parse a second JSON body.
let encodedBodies = 0;
class CountedResponse extends Response { constructor(...args) { super(...args); encodedBodies++; } }
class FixedDate extends Date { static now() { return 1793491200000; } }
const runtimeCore = load("service/src/runtime-logs-core.ts", {}, { Response: CountedResponse, Date: FixedDate });
const longContent = "x".repeat(192_000);
const rows = Array.from({ length: 20 }, (_, i) => ({ log_id: "local_" + String(i).padStart(32, "0"),
  filename: "fixture" + i, source: "ANDROID", severity: "INFO", generated_at: "2026-11-01T00:00:00Z",
  received_at: "2026-11-01T00:00:00Z", size_bytes: 192_000, content_text: longContent, last_drive_error: i % 2 ? "RETRY" : null }));
const sqlCalls = [];
const realState = { storage: { sql: { exec(sql, ...args) {
  sqlCalls.push([sql.replace(/\s+/g, " ").trim(), args]);
  if (sql.includes("d161_hr_sync_state")) return { toArray: () => [] };
  return { toArray: () => sql.includes("SELECT log_id") ? rows : [] };
} } } };
const rawPending = runtimeCore.readPendingRuntimeLogArchives(realState, 20);
assert.equal(encodedBodies, 0, "data reader performs no JSON/Response encoding");
const rawQueries = [...sqlCalls]; sqlCalls.length = 0;
const legacyResponse = await runtimeCore.handleRuntimeLogCoreRequest(realState, request("/runtime-logs/pending-drive?limit=20"));
assert.equal(encodedBodies, 1); assert.deepEqual(sqlCalls, rawQueries);
assert.equal(JSON.stringify(await legacyResponse.json()), JSON.stringify(rawPending));
const combined = load("service/src/d173-background-core.ts", {
  "./alert-window-core": {}, "./notifications-core": {}, "./operational-v2-core": {}, "./runtime-logs-core": runtimeCore,
}, { Response: CountedResponse, Date: FixedDate });
encodedBodies = 0;
const combinedResponse = await combined.handleD173BackgroundCoreRequest(realState, request("/maintenance/plan?limit=20"), context);
assert.equal(encodedBodies, 1, "combined plan encodes the 3.84 MB log content only once");
const { ok: _ok, ...combinedPending } = (await combinedResponse.json()).runtime_logs;
assert.equal(JSON.stringify(combinedPending), JSON.stringify(rawPending), "legacy and combined content/order/metadata parity");
console.log("D173_E108_BACKGROUND_PASS: private FCM/callback parity, nonblocking send, maintenance failures/fallback, 20-log raw-reader JSON/memory parity");
