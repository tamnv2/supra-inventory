import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const activity = readFileSync(
  new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt", import.meta.url),
  "utf8"
);

test("warm foreground does not redraw the signed-current operational view", () => {
  assert.match(activity, /if \(restoringSessionScreen\)\s*\{\s*val current = api\.session/);
  assert.match(activity, /Warm resume: never reconstruct Picker\/Reporter controllers/);
  assert.doesNotMatch(activity, /restored != null -> renderHome\(restored\)\s*\n/);
  assert.match(activity, /UPDATE_FOREGROUND_CHECK_INTERVAL_MS = 6 \* 60 \* 60 \* 1000L/);
});
test("foreground resumes preserve DISPLAYED recovery and role reconciliation when a silent check starts", () => {
  assert.match(activity, /!restoringSessionScreen\s*&&\s*updateGate != UpdateGate\.FAILED/);
  assert.match(activity, /reconcileNotificationSignal\(\)/);
  assert.match(activity, /drainNotificationReceipts\(\)/);
  assert.doesNotMatch(activity, /drainOverlayAcknowledgements\(\)/);
  assert.match(activity, /syncEffectiveRole\(\)/);
});
test("identity profile changes update header only, never tear down tab/controllers", () => {
  assert.match(activity, /if \(api\.session\?\.userId != next\.userId\) return@runOnUiThread/);
  assert.match(activity, /if \(roleChanged \|\| activeSession == null\)/);
  assert.match(activity, /findViewById<TextView>\(R\.id\.tvHeaderUser\)\?\.text = sessionHeaderLabel\(next\)/);
});
test("cold restore and genuine login remain distinct and security gate persists", () => {
  assert.match(activity, /private fun renderHome\(session: AppSession, reason: String = "session_restore"\)/);
  assert.match(activity, /renderHome\(session, reason = "login"\)/);
  assert.match(activity, /if \(reason == "login"\)/);
  assert.match(activity, /D169 activity_created saved_state=/);
  assert.match(activity, /D169 warm_foreground_return count=/);
  assert.match(activity, /verifiedMinimumVersionCode = maxOf\(verifiedMinimumVersionCode, info\.minimumVersionCode, info\.versionCode\)/);
});