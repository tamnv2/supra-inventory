import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const dir = "android/app/src/main/java/cd/cc/supra/inventory/beta/";
const activity = read(dir + "MainActivity.kt");
const picker = read(dir + "PickerController.kt");
const fcm = read(dir + "StockMessagingService.kt");
const overlay = read(dir + "CriticalOverlayService.kt");
const reporter = read(dir + "ReporterController.kt");
const notes = JSON.parse(read("android/release-notes.json"));

test("E074 Picker background realtime cannot reserve an invisible in-app Dialog", () => {
  assert.match(activity, /override fun onPause\(\) \{[\s\S]*?PickerForegroundState\.resumed = false[\s\S]*?pickerController\?\.onActivityPaused\(\)/);
  assert.match(activity, /override fun onResume\(\) \{[\s\S]*?PickerForegroundState\.resumed = true[\s\S]*?pickerController\?\.onActivityResumed\(\)/);
  const stage = picker.split("private fun stageAndShowNextResult()")[1].split("private fun showResultDialog(")[0];
  assert.match(stage, /!PickerForegroundState\.resumed/);
  assert.match(stage, /tryMarkResultOverlayPresented/);
  const paused = picker.split("fun onActivityPaused()")[1].split("fun onActivityResumed()")[0];
  assert.match(paused, /dialog\.dismiss\(\)/);
  assert.match(picker, /dialog\.setOnDismissListener \{[\s\S]*?clearResultOverlayPresented/);
});

test("E074 Picker FCM rejection explains skipped display and falls back in background", () => {
  assert.match(fcm, /"NO_PICKER_SESSION"/);
  assert.match(fcm, /"ALREADY_DISMISSED_OR_COMPLETED"/);
  assert.match(fcm, /"BACKGROUND_PRESENTATION_CLAIM_BUSY"/);
  assert.match(fcm, /if \(PickerForegroundState\.resumed\) return/);
  assert.match(fcm, /NOTIFICATION_FALLBACK/);
  assert.match(overlay, /"OVERLAY_REJECTED"/);
  assert.match(overlay, /"FALLBACK_POSTED"/);
  assert.match(overlay, /RESULT_DRAW_CONFIRMED/);
});

test("E074 Reporter preserves adapter identity and visible batch anchor", () => {
  const render = reporter.split("private fun renderSelected()")[1].split("private fun loadOverdue()")[0];
  assert.match(render, /target\.adapter === selectedAdapter/);
  assert.match(render, /selectedAdapter\.notifyDataSetChanged\(\)/);
  assert.match(render, /target\.setSelectionFromTop\(preservedIndex, anchorTop\)/);
  assert.doesNotMatch(render, /target\.adapter = pendingAdapter\(|target\.adapter = overdueAdapter\(|target\.adapter = recentAdapter\(/);
  assert.match(reporter, /event\.seq <= lastReporterEventSeq/);
  assert.match(reporter, /realtimeRevision != revisionAtStart/);
  assert.match(reporter, /staleSnapshotRetries == 0/);
});

test("E074 dismissed result never requires remote Picker ACK or false history prompt", () => {
  assert.doesNotMatch(picker, /Chưa xác nhận kết quả/);
  assert.match(picker, /text = resultTimeLine/);
  const click = picker.split("acknowledge.setOnClickListener")[1].split("dialog.setOnDismissListener")[0];
  assert.match(click, /markResultDismissed/);
  assert.doesNotMatch(click, /markResultStage\(|acknowledgeResult\(/);
  assert.match(notes.release_notes.join(" "), /vc117/);
});
