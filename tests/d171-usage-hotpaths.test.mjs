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
  // Critical result/correction may fan out to hundreds of Picker tokens.
  // Preparing only the bounded Reporter notification keeps those costs out of
  // the synchronous transaction response; other events use waitUntil fallback.
  assert.match(core, /if \(action === "create" && readAndroidAlertWindow/);
  assert.match(worker, /const envelope = await raw\.clone\(\)\.json\(\)/);
  assert.match(worker, /const result = json\(envelope\.result, raw\.status\)/);
  assert.doesNotMatch(worker, /return json\(envelope, raw\.status\)/);
  const shortagePath = worker.slice(worker.indexOf("const shortageAction:"), worker.indexOf('if (key === "GET /api/skus")'));
  assert.match(shortagePath, /D171_INVENTORY_CORE_VERSION_MISMATCH/);
  assert.doesNotMatch(shortagePath, /return publicAuthorizedResponse\(raw\)\.response;/);
  assert.match(worker, /if \(prepared\?\.tokens\?\.length === 0\) return/);
  assert.match(worker, /if \(prepared\?\.batch\?\.sku && prepared\.batch\.product_name\) \{[\s\S]*?targetPayload = prepared/);
  assert.match(worker, /!targetPayload\.batch\?\.sku \|\| !targetPayload\.batch\.product_name/);
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
  assert.ok(/^\d+$/.test(agent) && Number(agent) >= 140, "cannot regress below accepted Agent v140");
  assert.match(app, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(web, /3\.2\.0/);
  assert.match(workerConfig, /class_name = "InventoryCore"/);
  assert.match(workerConfig, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.match(workerConfig, /APP_ENV = "beta"/);
});

test("D171 P0: negative authentication, Picker-disable and window errors preserve 401/403/404 without private FCM leaks", () => {
  const mutation = core.slice(core.indexOf("private async d171ShortageMutation("), core.indexOf("private authorizedOperationalResponse("));
  const shortage = worker.slice(worker.indexOf("const shortageAction:"), worker.indexOf('if (key === "GET /api/skus")'));
  assert.ok(mutation.length > 1000, "real DO mutation source is required");
  assert.match(mutation, /if \(user instanceof Response\) \{[\s\S]*?return response\(\{ result: await user\.json\(\) \}, user\.status\);/);
  assert.match(mutation, /result: \{ error: "PICKER_SHORTAGE_REPORTING_DISABLED"/);
  assert.match(mutation, /result: \{[\s\S]*?error: "ANDROID_WINDOW_CLOSED"/);
  assert.match(mutation, /if \(!transaction\) return response\(\{ result: \{ error: "NOT_FOUND" \} \}, 404\)/);
  assert.match(mutation, /if \(!transaction\.ok\) return response\(\{ result \}, transaction\.status\)/);
  assert.match(shortage, /if \(!envelope \|\| !Object\.prototype\.hasOwnProperty\.call\(envelope, "result"\)\)/);
  assert.match(shortage, /D171_INVENTORY_CORE_VERSION_MISMATCH/);
  assert.match(shortage, /const result = json\(envelope\.result, raw\.status\)/);
  assert.doesNotMatch(shortage, /return publicAuthorizedResponse\(raw\)\.response/);
});
