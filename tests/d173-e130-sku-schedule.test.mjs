import test from "node:test";
import assert from "node:assert/strict";
import { createServiceFixture, loadServiceModule } from "../tools/fixtures/d173-service-fixture.mjs";

const { handleD167SkuCoreRequest, initializeD167SkuSyncSchema } =
  loadServiceModule("service/src/d167-sku-sync-core.ts");
const { skuEffectiveDayAt } = loadServiceModule("service/src/d167-sku-sync-logic.ts");
const standard = ["INITIAL_05", "DELTA_12", "DELTA_19"];

test("E130 three scheduled slots remain separate from independent manual SKU history", async () => {
  const { db, state } = await createServiceFixture();
  initializeD167SkuSyncSchema(state);
  const day = skuEffectiveDayAt(Date.now());
  const path = "/d167/skus/schedule?day_vn=" + encodeURIComponent(day);
  const read = async () => {
    const response = await handleD167SkuCoreRequest(state, new Request("https://fixture.example" + path));
    assert.equal(response.status, 200);
    return response.json();
  };
  const before = await read();
  assert.deepEqual(before.slots.map(row => row.slot), standard);
  assert.equal(before.recent_manual.length, 0);
  const manualA = "MANUAL_DELTA_" + "a".repeat(32);
  const manualB = "MANUAL_DELTA_" + "b".repeat(32);
  const insertJob = db.prepare("INSERT INTO d167_sku_jobs (day_vn,slot,scheduled_at_ms) VALUES (?,?,?)");
  const insertAuth = db.prepare("INSERT INTO d167_sku_manual_authority (day_vn,run_id,slot,actor_id,authorized_at_ms) VALUES (?,?,?,?,?)");
  for (const [n, slot] of [manualA, manualB].entries()) {
    insertJob.run(day, slot, Date.now() + n);
    insertAuth.run(day, String(n).repeat(32), slot, "fixture-agent", Date.now() + n);
  }
  const after = await read();
  assert.deepEqual(after.slots.map(row => row.slot), standard);
  assert.equal(after.slots.length, 3, "Agent D167SkuServiceClient requires exactly 3 standard slots");
  assert.equal(after.recent_manual.length, 2, "manual history remains accessible independently");
  assert.deepEqual(new Set(after.recent_manual.map(row => row.slot)), new Set([manualA, manualB]));
  const status = await handleD167SkuCoreRequest(state, new Request("https://fixture.example/d167/skus/status?day_vn=" + day + "&slot=" + manualA));
  assert.equal(status.status, 200, "manual job status endpoint remains valid");
  assert.equal((await status.json()).slot, manualA);
});

test("E140 six-slot SKU schedule opt-in does not break original E130 callers", async () => {
  const { state } = await createServiceFixture();
  initializeD167SkuSyncSchema(state);
  const day = skuEffectiveDayAt(Date.now());
  const response = await handleD167SkuCoreRequest(state, new Request(
    "https://fixture.example/d167/skus/schedule?day_vn=" + day + "&schedule_profile=E140_6"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.slots.map(s => s.slot),
    ["INITIAL_05","DELTA_07","DELTA_10","DELTA_13","DELTA_16","DELTA_19"]);
  const times = body.slots.map(s => Number(s.scheduled_at_ms));
  assert.equal(times[0], Date.parse(day + "T00:00:00Z") - 2 * 3600_000);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] - times[i-1] >= 2*3600_000);
    assert.ok(times[i] - times[i-1] <= 3*3600_000);
  }
  assert.ok(times[5] < times[0] + 17*3600_000);
});
