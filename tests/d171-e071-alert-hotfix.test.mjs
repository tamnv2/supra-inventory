import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const core = read("service/src/core.ts");
const api = read("service/src/business-api.ts");
const notifications = read("service/src/notifications-core.ts");
const fcm = read("android/app/src/main/java/cd/cc/supra/inventory/beta/StockMessagingService.kt");
const overlay = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt");
const picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt");
const telemetry = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidAlertReadiness.kt");

test("E071 report_created FCM resolves batch projection from the created ticket", () => {
  const mutation = core.split("private async d171ShortageMutation(")[1].split("private authorizedOperationalResponse(")[0];
  assert.match(mutation, /const batchId = String\(result\.batch_id \|\| \(result\.ticket as \{ batch_id\?: string \} \| undefined\)\?\.batch_id/);
  assert.match(mutation, /batch_id: batchId \|\| null/);
  assert.doesNotMatch(mutation, /batch_id: action === "create" \? null/);
  assert.match(notifications, /SELECT batch_id, sku, product_name, status, resolution FROM report_batches WHERE batch_id = \?/);
  const send = api.split("function scheduleFcm(")[1].split("function resolverRoleLabel(")[0] || api.split("function scheduleFcm(")[1].slice(0, 7500);
  assert.match(send, /prepared\?\.batch\?\.sku && prepared\.batch\.product_name/);
  assert.match(send, /!targetPayload\.batch\?\.sku \|\| !targetPayload\.batch\.product_name/);
});

test("E071 Reporter overlay never converts event body to product name", () => {
  const view = overlay.split("private fun buildReportCreatedOverlay(")[1].split("private fun buildCommandOverlay(")[0];
  assert.match(view, /item\.sku\.ifBlank \{ "—" \}/);
  assert.match(view, /item\.productName\.ifBlank \{ "Chưa xác định tên sản phẩm" \}/);
  assert.doesNotMatch(view, /item\.productName\.ifBlank \{ item\.body \}/);
});

test("E071 correction color uses the NEW typed status, not old wording", () => {
  const view = overlay.split("private fun buildResultOverlay(")[1].split("private fun buildReportCreatedOverlay(")[0];
  assert.match(view, /val isSkip = item\.resolution == "SKIP_ALLOWED"/);
  assert.match(view, /val isPending = item\.resolution == "PENDING"/);
  assert.match(view, /isPending -> R\.drawable\.bg_overlay_info/);
  assert.match(view, /item\.isCorrection -> "SỬA TRẠNG THÁI BÁO HÀNG"/);
  assert.match(view, /"Đang xử lý — chưa được phép Skip"/);
  assert.doesNotMatch(view, /body\.contains\("skip"/i);
  assert.match(fcm, /event == "batch_corrected"/);
  assert.match(fcm, /message\.data\["correction_from_status"\]/);
  assert.match(picker, /isCorrection\) "SỬA TRẠNG THÁI BÁO HÀNG"/);
});

test("E071 failed exterior overlay is observable and releases UI claim", () => {
  const next = overlay.split("private fun displayNext()")[1].split("private fun scheduleExpiry(")[0];
  assert.match(next, /catch \(error: Exception\)/);
  assert.match(next, /releaseUnacknowledgedResult\(next\)/);
  assert.match(next, /FALLBACK_POSTED/);
  assert.match(next, /OVERLAY_ATTACHED/);
  assert.match(fcm, /FCM_RECEIVED/);
  assert.match(fcm, /SERVICE_START_FAILED/);
  assert.match(telemetry, /getSharedPreferences\("runtime_logs"/);
  assert.match(telemetry, /alertId\.hashCode\(\)/);
  assert.doesNotMatch(telemetry, /\.put\("token"|\.put\("body"|\.put\("sku"/);
  assert.match(overlay, /finishActive\(userAcknowledged = true\)/);
  assert.doesNotMatch(next, /markResultStage\(.*"DISPLAYED"/);
});

test("E071 native full-screen fallback is readable and closes locally outside the app", () => {
  const wake = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalWakeActivity.kt");
  const coordinator = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalWakeCoordinator.kt");
  assert.match(wake, /getBooleanExtra\(EXTRA_FALLBACK, true\)/);
  assert.match(wake, /if \(fallback\) \{/);
  assert.match(wake, /text = "ĐÓNG THÔNG BÁO"/);
  assert.match(wake, /markResultDismissed\(applicationContext, id, owner\)/);
  assert.doesNotMatch(wake, /api\.acknowledgeResult|markResultStage\(/);
  assert.match(coordinator, /transparentWake = true/);
  assert.match(fcm, /CriticalWakeActivity\.intent\(this, title, body, resultEventId\)/);
  assert.match(overlay, /CriticalWakeActivity\.intent\(this, title, body, alertId/);
});
