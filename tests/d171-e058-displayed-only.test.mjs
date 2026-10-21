import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("D171 E058: FCM cannot claim DISPLAYED before an Android overlay is shown", () => {
  const store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt");
  const service = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt");
  const picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt");
  const activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const incoming = store.split("fun markMessage(")[1].split("fun consumeDirty(")[0];
  assert.doesNotMatch(incoming, /RESULT_RECEIPT_PENDING|markResultDisplayPending/);
  assert.match(service, /windowManager\?\.addView\(view, params\)/);
  assert.match(service, /recordDisplayedAfterDraw\(item, view\)/);
  assert.match(service, /view\.isAttachedToWindow &&?\s*!view\.isShown|!view\.isAttachedToWindow \|\| !view\.isShown/);
  assert.match(service, /markResultDisplayPending\(/);
  assert.match(picker, /surface\.post \{/);
  assert.match(picker, /markResultDisplayPending\(/);
  assert.match(activity, /markResultStage\(eventId, "DISPLAYED"\)/);
  assert.doesNotMatch(activity, /markResultStage\(eventId, "RECEIVED"\)/);
});

test("D171 E058: result close must never issue an ACK or block on session/network", () => {
  const picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt");
  const service = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt");
  const activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const dialogClose = picker.split("acknowledge.setOnClickListener {")[1].split("dialog.setOnDismissListener")[0];
  assert.match(dialogClose, /markResultDismissed\(/);
  assert.match(dialogClose, /dialog\.dismiss\(\)/);
  assert.doesNotMatch(dialogClose, /acknowledgeResult|markResultStage|api\.session\?\.userId/);
  const overlayClose = service.split("private fun finishActive(")[1].split("private fun releaseUnacknowledgedResult(")[0];
  assert.match(overlayClose, /markResultDismissed\(/);
  assert.doesNotMatch(overlayClose, /acknowledgeResult|markOverlayAckPending/);
  assert.doesNotMatch(activity, /drainOverlayAcknowledgements\(\)|api\.acknowledgeResult\(/);
  assert.match(service, /ACTION_CLEAR_ALL_RESULTS/);
  assert.match(activity, /CriticalOverlayService\.clearAllResultOverlays\(/);
});

test("D171 E058: account-scoped durable display and local dismiss cannot cross Picker session", () => {
  const store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt");
  const ui = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const fcm = read("android/app/src/main/java/cd/cc/supra/inventory/beta/StockMessagingService.kt");
  assert.match(store, /scopedAckKey\(userId, RESULT_LOCAL_DISMISSED\)/);
  assert.match(store, /scopedAckKey\(userId, RESULT_RECEIPT_PENDING\)/);
  assert.match(store, /fun isResultDismissed\(/);
  assert.match(ui, /api\.session\?\.userId != owner\.userId/);
  assert.match(fcm, /NotificationSignalStore\.isResultDismissed\(/);
  assert.match(read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt"), /display_only=1/);
});

test("D171 E058: new Web only reports DISPLAYED on mounted overlay and dismisses locally", () => {
  const web = read("web/src/operational-app.ts");
  const api = read("web/src/operational-api.ts");
  assert.match(web, /queueWebDisplayed\(profile\.user_id, visibleResult\)/);
  assert.match(web, /dismissWebResult\(owner, eventId\)/);
  assert.match(web, /patchOverlays\(\)/);
  assert.doesNotMatch(web, /markPickerResult\([^\n]*"ACKNOWLEDGED"\)/);
  assert.doesNotMatch(web, /markPickerResult\([^\n]*"RECEIVED"\)/);
  assert.match(api, /display_only=1/);
  assert.match(web, /pending_displayed/);
});

test("D171 E058: strict opt-in server filter retains old vc114 ACK route", () => {
  const worker = read("service/src/business-api.ts");
  const core = read("service/src/core.ts");
  const ops = read("service/src/operational-v2-core.ts");
  assert.match(worker, /url\.searchParams\.get\("display_only"\) === "1"/);
  assert.match(core, /url\.searchParams\.get\("display_only"\) === "1"/);
  assert.match(ops, /displayOnly \? "AND a\.displayed_at IS NULL" : ""/);
  assert.match(ops, /"ACKNOWLEDGED"/); // Retain old client compatibility.
  assert.match(ops, /displayed_new: stage === "DISPLAYED"/);
  assert.match(ops, /AND displayed_at IS NULL/);
  assert.match(core, /result_displayed/);
});

test("D171 E058: Reporter analytics identify real DISPLAYED not click ACK", () => {
  const ops = read("service/src/operational-v2-core.ts");
  const web = read("web/src/operational-app.ts");
  assert.match(ops, /AS displayed_count/);
  assert.match(web, /Picker đã.*hiển thị|Đã hiển thị trên PDA\/Web/);
  assert.match(web, /recentTotals\.displayed_count/);
  assert.match(web, /Chưa xác minh hiển thị/);
});
