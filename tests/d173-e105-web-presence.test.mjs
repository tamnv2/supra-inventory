import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// D173-E105: use the actual Web source so tests cannot drift from production.
const source = readFileSync(new URL("../web/src/operational-app.ts", import.meta.url), "utf8");
const start = source.indexOf("// D173-E105: Do not bill");
const stop = source.indexOf("\nvoid bootstrap();", start);
assert.ok(start > 0 && stop > start, "Expected bounded E105 Web presence implementation");
const snippet = source.slice(start, stop)
  .replace("function refreshVisibleDashboardPresence(): void", "function refreshVisibleDashboardPresence()");

function setup(visibility = "hidden") {
  const callbacks = {};
  let ticker = null, calls = 0, patches = 0;
  const doc = { visibilityState: visibility,
    addEventListener: (name, callback) => { callbacks[name] = callback; } };
  const context = {
    document: doc,
    window: { setInterval: (callback, ms) => {
      assert.equal(ms, 30_000); ticker = callback;
    } },
    hasSession: () => true,
    profile: { role: "ADMIN" },
    roleManage: () => true,
    activeSection: "dashboard",
    getRealtimePresence: () => { calls += 1; return Promise.resolve({ online_users: calls }); },
    patchActiveSection: () => { patches += 1; },
    runtimeLogEvent: () => { throw Error("unexpected telemetry"); },
  };
  vm.runInNewContext(snippet, context);
  return { document: doc, callbacks, ticker: () => ticker(), stats: () => ({ calls, patches }), context };
}

const drain = async () => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

test("hidden dashboard must not call Durable Object presence", async () => {
  const h = setup("hidden");
  h.ticker();
  await drain();
  assert.deepEqual(h.stats(), { calls: 0, patches: 0 });
});

test("visible dashboard keeps existing 30-second presence refresh", async () => {
  const h = setup("visible");
  h.ticker();
  await drain();
  assert.deepEqual(h.stats(), { calls: 1, patches: 1 });
});

test("foreground resume refreshes immediately and never applies while hidden", async () => {
  const h = setup("hidden");
  h.document.visibilityState = "visible";
  h.callbacks.visibilitychange();
  await drain();
  assert.deepEqual(h.stats(), { calls: 1, patches: 1 });
  h.document.visibilityState = "hidden";
  h.callbacks.visibilitychange();
  h.ticker();
  await drain();
  assert.deepEqual(h.stats(), { calls: 1, patches: 1 });
});

test("in-flight same-tick requests are coalesced", async () => {
  const h = setup("visible");
  h.ticker();
  h.ticker();
  await drain();
  assert.deepEqual(h.stats(), { calls: 1, patches: 1 });
});

test("inactive dashboard and unauthorized session must not refresh", async () => {
  const h = setup("visible");
  h.context.activeSection = "operations";
  h.ticker();
  h.context.activeSection = "dashboard";
  h.context.hasSession = () => false;
  h.ticker();
  await drain();
  assert.deepEqual(h.stats(), { calls: 0, patches: 0 });
});
