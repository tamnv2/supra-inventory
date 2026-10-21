import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const core = read("service/src/core.ts");
const worker = read("service/src/business-api.ts");
const sku = read("service/src/read-api.ts");
const auth = read("service/src/auth.ts");
const notifications = read("service/src/notifications-core.ts");
const realtime = read("service/src/read-model-core.ts");

test("D171 E047 A: Worker verifies Firebase; Core verifies live generation, role, picker enable and operating window", () => {
  assert.match(worker, /const identity = await requireIdentity\(request, env\);[\s\S]*?\/authorized\/business\/shortage\//);
  assert.match(auth, /verifyFirebaseIdToken/);
  assert.match(core, /private async d171ShortageMutation\(/);
  assert.match(core, /this\.authorizeInteractiveIdentity\(request,[\s\S]*?picker \? \["PICKER"\] : \["REPORTER", "ADMIN", "ROOT"\]/);
  assert.match(core, /user\.shortage_reporting_enabled/);
  assert.match(core, /this\.reconcileOperatingScheduleExactIfClosed\(\)/);
  assert.match(core, /readAndroidAlertWindow\(this\.state\)\.is_open/);
  assert.match(core, /actor: \{[\s\S]*?user_id: user\.user_id,[\s\S]*?role: user\.role/);
  assert.match(core, /handleBusinessRequest\(this\.state/);
  assert.match(core, /session_generation/);
});

test("D171 E047 B: same-object realtime after committed transaction preserves event cursor/tags/delta, no extra Worker->DO", () => {
  assert.match(core, /const result = await transaction\.json\(\)/);
  assert.match(core, /if \(!transaction\.ok\) return response/);
  assert.match(core, /await handleReadModelCoreRequest\(this\.state, new Request\("https:\/\/inventory-core\.internal\/realtime\/broadcast"/);
  assert.match(core, /event_id: eventId \|\| null/);
  assert.match(core, /include_batch_picker_users: !picker/);
  assert.match(core, /queue_delta.*overdue_delta/);
  assert.match(core, /recent_counter/);
  assert.match(realtime, /pickerCanReceiveRealtimeEvent/);
  assert.match(realtime, /getWebSockets\(tag\)/);
  assert.match(realtime, /seq:/);
  const fast = worker.slice(worker.indexOf("const shortageAction:"), worker.indexOf("// D162 high-volume paths"));
  assert.doesNotMatch(fast, /realtimeAfter\(/);
  assert.match(fast, /"POST \/api\/picker\/reports\/withdraw"/);
  assert.match(fast, /"POST \/api\/reporter\/batches\/resolve"/);
  assert.match(fast, /"POST \/api\/reporter\/batches\/correct"/);
});

test("D171 E047 C: privately prepared FCM targets are stripped from user response, fallback and delivery audit remain", () => {
  assert.match(core, /handleNotificationCoreRequest\(this\.state/);
  assert.match(core, /event_seq: eventSeq, batch_version: batchVersion/);
  assert.match(core, /if \(action !== "withdraw"/);
  assert.match(worker, /const envelope = await raw\.clone\(\)\.json\(\)/);
  assert.match(worker, /const result = json\(envelope\.result, raw\.status\)/);
  assert.doesNotMatch(worker, /return json\(envelope, raw\.status\)/);
  assert.match(worker, /if \(prepared\) \{[\s\S]*?targetPayload = prepared/);
  assert.match(worker, /if \(!prepared && resultEventId\)/);
  assert.match(worker, /"\/notifications\/delivery-attempts"/);
  assert.match(worker, /"\/notifications\/disable-tokens"/);
  assert.match(notifications, /result_event_id/);
});

test("D171 E047 D: authenticated SKU search/catalog has one DO invocation and no persistent session cache", () => {
  assert.match(worker, /"GET \/api\/skus"[\s\S]*?\/authorized\/business\/skus\/search/);
  for (const route of ["catalog-info", "catalog-provenance", "catalog", "catalog-delta"]) {
    assert.ok(sku.includes("/authorized/read/skus/" + route));
    assert.ok(core.includes('"' + "skus/" + route + '"'));
  }
  assert.match(core, /manager && String\(request\.headers\.get\("x-supra-session-channel"/);
  assert.match(core, /this\.authorizeInteractiveIdentity/);
  assert.doesNotMatch(sku, /sessionAuthorityCache|setInterval/);
});

test("D171 E047 release and model guard: no additional provider resource or changes to clients", () => {
  const workerConfig = read("service/wrangler.beta.toml");
  const agent = read("relay-agent/VERSION").trim();
  const app = read("android/app/build.gradle.kts");
  const web = read("web/src/web-version.ts");
  assert.equal(agent, "140");
  assert.match(app, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(web, /3\.1\.2/);
  assert.match(workerConfig, /class_name = "InventoryCore"/);
  assert.match(workerConfig, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.match(workerConfig, /APP_ENV = "beta"/);
});
