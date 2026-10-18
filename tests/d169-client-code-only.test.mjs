import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const overlay = source("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt");
const activity = source("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
const coordinator = source("relay-agent/D167SkuCoordinator.cs");
test("command/chat body scrolls and acknowledgement remains outside the scroll", () => {
 const start = overlay.indexOf("private fun buildCommandOverlay(");
 assert.ok(start >= 0);
 const body = overlay.slice(start);
 assert.match(body, /val scrollingMessage = ScrollView\(this\)/);
 assert.match(body, /card\.addView\(scrollingMessage, LinearLayout\.LayoutParams\(/);
 assert.match(body, /MATCH_PARENT, 0, 1f/);
 assert.ok(body.indexOf("card.addView(scrollingMessage") < body.indexOf('text = "XÁC NHẬN"'));
});
test("orphan result overlay unblocks locally without inventing successful server ACK", () => {
 const body = overlay.slice(overlay.indexOf("private fun finishActive("), overlay.indexOf("private fun releaseUnacknowledgedResult("));
 assert.match(body, /current\.alertId\.isBlank\(\) \|\| ownerUserId\.isBlank\(\)/);
 assert.match(body, /finishActive\(userAcknowledged = false\)/);
 assert.match(body, /markOverlayAckPending\(applicationContext, current\.alertId, ownerUserId\)/);
 assert.match(body, /acknowledgeResultAsync\(current\.alertId, ownerUserId\)/);
});
test("latest signed Beta version becomes mandatory without forced in-session restart", () => {
 assert.match(activity, /verifiedMinimumVersionCode = maxOf\(verifiedMinimumVersionCode, info\.minimumVersionCode, info\.versionCode\)/);
 assert.match(activity, /val mandatory = info\.versionCode > BuildConfig\.VERSION_CODE/);
 assert.match(activity, /Tiếp tục phiên hiện tại/);
});
test("all queued SKU retries honor one bounded local wake without network polling", () => {
 const body = coordinator.slice(coordinator.indexOf("private void Queue()"), coordinator.indexOf("private void EvaluateOnce()"));
 assert.match(body, /nextWakeAtUtc > DateTime\.UtcNow\.AddMilliseconds\(250\)/);
 assert.match(body, /Interlocked\.CompareExchange\(ref running,1,0\)/);
 assert.match(body, /Arm\(TimeSpan\.FromMinutes\(15\)\)/);
});

const picker = source("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt");
const contacts = source("relay-agent/FirestorePickerContact.cs");
test("PDA displays already-confirmed as positive outcome and distinguishes WMS errors", () => {
 assert.match(picker, /"ALREADY_CONFIRMED" ->/);
 assert.match(picker, /"WMS_DATA_UNAVAILABLE" ->/);
 assert.match(picker, /"LOOKUP_ERROR" ->/);
 assert.match(picker, /result.lookupStatus == "ALREADY_CONFIRMED"/);
});
test("Active-call reconciliation does not scan unused historical alerts", () => {
 const body = contacts.slice(contacts.indexOf("internal Dictionary<string, PickerContactCommand> LoadOpen("), contacts.indexOf("private Dictionary<string, PickerContactCommand> LoadActiveCalls("));
 assert.match(body, /LoadActiveCalls\(session\)/);
 assert.doesNotMatch(body, /LoadLegacyAlerts\(session, result\)/);
});
