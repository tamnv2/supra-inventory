import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const dir = "android/app/src/main/java/cd/cc/supra/inventory/beta/";
const audit = read(dir + "D166UsageAudit.kt");
const reporter = read(dir + "ReporterController.kt");

test("E013 Reporter-only telemetry has bounded in-memory cardinality and allowlisted reasons", () => {
  const recorder = audit.split("internal fun recordReporterUi(reason: String)")[1].split("// E016: last 32")[0];
  const frameRecorder = audit.split("internal fun recordReporterFrame(")[1].split("private var sdkOverflow")[0];
  assert.match(recorder, /reason !in reporterUiReasons/);
  assert.match(recorder, /reporterUiCounts.size >= 320/);
  assert.match(recorder, /reporterUiCounts.remove\(oldest\)/);
  assert.match(recorder, /synchronized\(metricLock\)/);
  assert.doesNotMatch(recorder, /https?:|fetch\(|\.exec\(|postDelayed|Timer|Thread\(|upload|putString|write/);
  assert.match(frameRecorder, /reporterFrames.size >= 32/);
  assert.match(frameRecorder, /reporterFramesEvicted\+\+/);
  assert.doesNotMatch(frameRecorder, /https?:|fetch\(|\.exec\(|postDelayed|Timer|Thread\(|upload|putString|write/);
  assert.match(audit, /reporter_ui_evicted_buckets/);
  assert.match(audit, /reporter_ui_omitted_old_buckets/);
  assert.match(audit, /BOUNDED_LOCAL_UI_COUNTS_NOT_PROVIDER_BILLING/);
  assert.doesNotMatch(audit.split("reporter_ui_groups")[1].split(".put(\"hourly\"")[0], /sku|user_id|device_id|batch_id|access_token|request_id/i);
});

test("E013 Reporter records stale snapshot and cross-request count races without changing source of truth", () => {
  const refresh = reporter.split("fun refresh(onComplete:")[1].split("private fun finishRefreshWaiters")[0];
  assert.match(refresh, /realtimeRevision != revisionAtStart/);
  assert.match(refresh, /recordReporterUi\("REFRESH_STALE"\)/);
  assert.match(refresh, /nextQueue.total != nextCounters.queueTotal/);
  assert.match(refresh, /recordReporterUi\("CROSS_REQUEST_COUNTER_DIFFERENCE"\)/);
  assert.match(refresh, /queueTotal = nextQueue.total/);
  assert.match(refresh, /staleSnapshotRetries == 0/);
  assert.match(refresh, /recordReporterUi\("REFRESH_ERROR"\)/);
});

test("E013 Reporter logs badge changes and scroll outcomes locally with no extra UI/navigation side effects", () => {
  const badge = reporter.split("private fun setBadge(")[1].split("private fun recentRows()")[0];
  assert.match(badge, /badge.text.toString\(\) != next/);
  assert.match(badge, /recordReporterUi\("PENDING_BADGE_CHANGE"\)/);
  assert.match(badge, /recordReporterUi\("OVERDUE_BADGE_CHANGE"\)/);
  const render = reporter.split("private fun renderSelected()")[1].split("private fun loadOverdue()")[0];
  assert.match(render, /SCROLL_ANCHOR_RETAINED/);
  assert.match(render, /SCROLL_ANCHOR_MISSING/);
  assert.match(render, /target.setSelectionFromTop\(preservedIndex, anchorTop\)/);
  const applied = reporter.split("private fun applyRealtimeEvents(")[1].split("private fun scaledSp")[0];
  assert.match(applied, /event.seq <= lastReporterEventSeq/);
  assert.match(applied, /recordReporterUi\("REALTIME_APPLIED"\)/);
});
