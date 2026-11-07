import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ui = read("relay-agent/D167SkuUi.cs");
const program = read("relay-agent/Program.cs");
const windows = read("relay-agent/D173E123WindowAudit.cs");
const core = read("service/src/core.ts");
const worker = read("service/src/index.ts");
const cron = read("service/src/d173-picker-shift-cron.ts");
const shift = read("service/src/d173-picker-shift.ts");
const firestore = read("service/src/firestore-projection.ts");
const rules = read("firebase/firestore.rules");
const android = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerActiveCallWatcher.kt");

test("Agent169 same version across native assembly, config and OTA channel", () => {
  assert.equal(read("relay-agent/VERSION").trim(), "169");
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild = 169;/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /<AssemblyVersion>0\.169\.0\.0<\/AssemblyVersion>/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /<FileVersion>0\.169\.0\.0<\/FileVersion>/);
});

test("SKU uses 35/35/30 responsive rows, preserving fixed header and metrics", () => {
  assert.match(ui, /RowStyle\(SizeType\.Absolute,83F\)/);
  assert.equal((ui.match(/RowStyle\(SizeType\.Percent,35F\)/g) || []).length, 2);
  assert.equal((ui.match(/RowStyle\(SizeType\.Percent,30F\)/g) || []).length, 1);
  assert.match(ui, /panel\.Controls\.Add\(scheduleGroup,0,1\)/);
  assert.match(ui, /panel\.Controls\.Add\(historyGroup,0,2\)/);
  assert.match(ui, /panel\.Controls\.Add\(detailGroup,0,4\)/);
});

test("Only own-PID .NET/GDI+ helper HWND can receive TOOLWINDOW shell style", () => {
  assert.match(windows, /SetWinEventHook\(/);
  assert.match(windows, /GetWindowThreadProcessId\(hwnd, out pid\)/);
  assert.match(windows, /pid == 0 \|\| pid != _ownPid/);
  assert.match(windows, /IsFrameworkHelper\(cls, title\)/);
  assert.match(windows, /WS_EX_TOOLWINDOW/);
  assert.match(windows, /newStyle = \(oldStyle \| WS_EX_TOOLWINDOW\) & ~WS_EX_APPWINDOW/);
  assert.match(program, /Shown \+= \(s, e\) => D173E123WindowAudit\.StartOwnedHelperVisibilityGuard/);
  assert.match(program, /D173E123WindowAudit\.StopOwnedHelperVisibilityGuard\(\)/);
});

test("Cron reuses existing five-minute tick only at VN 14:00 and 22:00", () => {
  assert.match(worker, /controller\.cron === "\*\/5 \* \* \* \*"/);
  assert.match(worker, /runD173PickerShiftCron\(env, controller\.scheduledTime\)/);
  assert.match(cron, /hour !== 7 && hour !== 15/);
  assert.match(cron, /minute > 30 \|\| minute % 5 !== 0/);
  assert.match(cron, /day \+ ":" \+ \(hour === 7 \? "14" : "22"\)/);
  assert.match(cron, /Promise\.allSettled/);
  assert.match(cron, /ack-expired-picker-android-sessions/);
});

test("Core revokes expired Picker generations atomically, not all Android/Reporter users", () => {
  assert.match(core, /auth\/revoke-expired-picker-android-sessions/);
  assert.match(core, /auth\/ack-expired-picker-android-sessions/);
  assert.match(core, /d173PickerShiftIsExpired\(row\.android_session_started_at, nowMs\)/);
  assert.match(core, /WHERE role = 'PICKER' AND status = 'ACTIVE'/);
  assert.match(core, /android_session_generation = \?/);
  assert.match(core, /android_session_started_at IS \?/);
  assert.match(core, /this\.state\.storage\.transactionSync/);
  assert.match(core, /d173_picker_shift:/);
  assert.match(shift, /minutes < 600 \? 14 \* 60 : minutes < 1320 \? 22 \* 60/);
  assert.match(rules, /picker_shift_logout_at_ms > request\.time\.toMillis\(\)/);
});

test("Old APK can consume the existing generation-controlled logout signal", () => {
  assert.match(cron, /publishPickerShiftCutoffRevocation/);
  assert.match(firestore, /maximum: \{ integerValue: String\(generation\) \}/);
  assert.match(firestore, /documents:commit/);
  assert.match(firestore, /updateTransforms/);
  assert.match(cron, /revoked_generation: target\.revoked_generation/);
  assert.match(android, /revokedGeneration >= generation/);
  assert.match(android, /onSessionRevoked\(\)/);
  assert.doesNotMatch(cron, /issued_by_user_id/);
});
