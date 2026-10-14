import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root = new URL('../', import.meta.url);
const load = name => readFileSync(new URL('android/app/src/main/java/cd/cc/supra/inventory/beta/' + name, root), 'utf8');
const store = load('NotificationSignalStore.kt');
const fcm = load('StockMessagingService.kt');
const picker = load('PickerController.kt');
const overlay = load('CriticalOverlayService.kt');

test('vc110 obtains one synchronized result-event presentation claim shared by both UI paths', () => {
  assert.match(store, /@Synchronized\s+fun tryMarkResultOverlayPresented\(/);
  assert.match(store, /if \(!values\.add\(eventId\)\) return false/);
  assert.match(store, /ensurePresentationStore\(context\)/);
  assert.match(fcm, /val claimedResult = if \(isPickerResult && overlayGranted\)/);
  assert.match(fcm, /if \(isPickerResult && overlayGranted && !claimedResult\) return/);
  assert.ok(fcm.indexOf('NotificationSignalStore.tryMarkResultOverlayPresented(') < fcm.indexOf('CriticalOverlayService.show('));
  const stage = picker.slice(picker.indexOf('private fun stageAndShowNextResult()'), picker.indexOf('private fun showResultDialog('));
  assert.match(stage, /if \(resultDialogShowing \|\| activity\.isFinishing\) return/);
  assert.ok(stage.indexOf('NotificationSignalStore.tryMarkResultOverlayPresented(') < stage.indexOf('showResultDialog(result)'));
});

test('vc110 preserves per-event identity, correct user ACK and post-success deduplication', () => {
  assert.match(fcm, /if \(isPickerResult\) resultEventId else/);
  assert.match(store, /scopedAckKey\(userId, KEY_OVERLAY_COMPLETED_RESULTS\)/);
  assert.match(store, /while \(completed\.size > 128\)/);
  assert.match(fcm, /NotificationSignalStore.isOverlayAckPending/);
  assert.match(fcm, /NotificationSignalStore.isResultCompleted/);
  assert.match(picker, /NotificationSignalStore.isResultCompleted/);
  const click = picker.slice(picker.indexOf('acknowledge.setOnClickListener'), picker.indexOf('dialog.setOnDismissListener'));
  assert.ok(click.indexOf('NotificationSignalStore.markOverlayAckPending(') < click.indexOf('api.acknowledgeResult(eventId)'));
  assert.match(click, /NotificationSignalStore.clearOverlayAck\(activity\.applicationContext, eventId, ownerUserId\)/);
});

test('vc110 releases UI ownership on failure, dismiss and service expiry', () => {
  assert.match(fcm, /if \(claimedResult\) NotificationSignalStore.clearResultOverlayPresented/);
  assert.match(picker, /NotificationSignalStore.clearResultOverlayPresented\(activity\.applicationContext, result\.resultEventId\)/);
  assert.match(overlay, /if \(expiresAt <= nowMs\) \{/);
  assert.match(overlay, /NotificationSignalStore.clearResultOverlayPresented\(applicationContext, alertId\)/);
  assert.match(overlay, /private fun enqueue\(item: OverlayAlert\)/);
  assert.match(overlay, /pendingAlerts\.any \{ it\.alertId == item\.alertId \}/);
});
