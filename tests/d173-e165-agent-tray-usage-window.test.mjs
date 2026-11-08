import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const form = read("relay-agent/Program.cs");
const usage = read("relay-agent/D173VpsUsage.cs");
const cards = read("relay-agent/D173E089UsageCards.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");

function section(source, from, until) {
  const start = source.indexOf(from);
  const end = source.indexOf(until, start + from.length);
  assert.ok(start >= 0 && end > start, "Missing section " + from);
  return source.slice(start, end);
}

test("tray hide/restore do not toggle ShowInTaskbar and preserve WinForms HWND", () => {
  const hide = section(form, "private void MinimizeToTray()", "private void RestoreFromTray()");
  const show = section(form, "private void RestoreFromTray()", "private void QueueNetworkStatusRefresh()");
  assert.doesNotMatch(hide, /ShowInTaskbar\s*=/);
  assert.doesNotMatch(show, /ShowInTaskbar\s*=/);
  assert.match(hide, /Hide\(\)/);
  assert.match(show, /Show\(\)/);
  assert.doesNotMatch(hide + show, /NavigateConfirm|Page\.reload|StopManagedBrowser|StartNoLock/);
  assert.match(form, /D173_E165 HWND event=CREATED/);
  assert.match(form, /D173_E165 HWND event=DESTROYED/);
  assert.match(hide, /hwnd_preserved=/);
  assert.match(show, /hwnd_preserved=/);
  assert.match(browser, /decision=DEFER reason=CDP_DOWN_HOST_ALIVE navigation=NONE/);
});

test("automatic and manual Usage provider synchronization blocked 00:00-05:59 VN", () => {
  const predicate = section(usage, "internal static bool D173E165UsageSyncAllowed", "private void TryD173VpsUsageBoundary()");
  assert.match(predicate, /nowVn\.TimeOfDay\s*>=\s*TimeSpan\.FromHours\(6\)/);
  const timer = section(usage, "private void TryD173VpsUsageBoundary()", "private void SelectD173VpsUsageWindow(");
  assert.match(timer, /DateTime\.UtcNow\.AddHours\(7\)/);
  assert.match(timer, /!D173E165UsageSyncAllowed\(now\)/);
  const refresh = section(usage, "private void TryD173VpsUsageRefresh(", "private static double");
  assert.match(refresh, /!D173E165UsageSyncAllowed\(DateTime\.UtcNow\.AddHours\(7\)\)/);
  assert.match(refresh, /06:00 lấy bù 00:00–06:00/);
});

test("all Usage charts use a literal 00:00-24:00 VN axis and real day totals", () => {
  assert.match(cards, /new\[\]\{0,6,14,22,24\}/);
  assert.match(cards, /var operationalDay=now\.Date;/);
  assert.match(cards, /var start=operationalDay;/);
  assert.match(cards, /var end=operationalDay\.AddDays\(1\);/);
  assert.match(cards, /D173ApprovedShiftForecast\(metric\)/);
  assert.match(usage, /var end=local\.Date\.AddDays\(1\);/);
  assert.doesNotMatch(section(cards, "private void E089Render()", "private static Color E090MetricAccent"), /E089End\(operationalDay/);
});

test("daily report 05:30 and approved two-hour client log cadence", () => {
  const workflow = read(".github/workflows/d173-daily-usage-2200.yml");
  const collector = read("tools/d173_daily_usage_2200.py");
  assert.match(workflow, /cron:\s*"30 22 \* \* \*"/);
  assert.match(collector, /dt\.time\(22, 0\)/);
  assert.match(collector, /log_correlation/);
  assert.match(read("relay-agent/AgentLogUploadBridge.cs"), /100, 300, 500, 700, 900/);
  assert.match(read("web/src/runtime-logger.ts"), /candidates = \[60, 180, 300, 420/);
  assert.match(read("android/app/src/main/java/cd/cc/supra/inventory/beta/D171DailyLogWorker.kt"), /"0100", "0300", "0500"/);
});
