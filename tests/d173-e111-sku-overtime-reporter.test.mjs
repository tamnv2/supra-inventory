import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("E111 SKU admission and manual source use 05:00 effective day, reports keep calendar day", () => {
  const business=read("service/src/business-core.ts");
  const sku=read("service/src/d167-sku-sync-core.ts");
  const coordinator=read("relay-agent/D167SkuCoordinator.cs");
  const ui=read("relay-agent/D167SkuUi.cs");
  assert.match(business,/const dayForSku = skuEffectiveDayAt\(Date.parse\(at\)\)/);
  assert.match(business,/const businessDay = vnDayAt\(Date.parse\(at\)\)/);
  assert.match(sku,/if \(day !== skuEffectiveDayAt\(Date.now\(\)\)\)/);
  assert.match(coordinator,/VNNow\(\).AddHours\(-5\).ToString\("yyyy-MM-dd"\)/);
  assert.match(ui,/VNNow\(\).AddHours\(-5\).ToString\("yyyy-MM-dd"\)/);
  assert.match(sku,/const chosen=full\?"MANUAL_DELTA_"\+runId:"INITIAL_05"/);
});

test("E111 Reporter does not replay N-1 resolved rows or re-fetch overdue on tab switch",()=>{
  const reporter=read("android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt");
  assert.match(reporter,/if \(!isCurrentRecent\(snapshot.optString\("first_report_at"\)\)\) return null/);
  assert.match(reporter,/if \(isCurrentRecent\(snapshot.optString\("first_report_at"\)\) &&/);
  assert.match(reporter,/else if \(nextOverdue != null\) \{/);
  const tabs=reporter.split("private fun selectFilter(")[1].split("private fun scheduleMinuteTicker")[0];
  assert.doesNotMatch(tabs,/refresh\(/);
  const transport=read("android/app/src/main/java/cd/cc/supra/inventory/beta/D173CommandTransport.kt");
  assert.match(transport,/if \(method == "GET"\) 250L else 50L/);
});

test("E111 Agent prompt at 21:45 and continuous 22:15 to 00:00 without extra polling",()=>{
  const schedule=read("relay-agent/AgentBusinessSchedule.cs");
  const program=read("relay-agent/Program.cs");
  assert.match(schedule,/FirstPromptAt = new TimeSpan\(21, 45, 0\)/);
  assert.match(schedule,/boundary.Date.AddDays\(1\)/);
  assert.match(program,/ShowD173ShiftDecision\(DateTime boundary\)/);
  assert.match(program,/notice.Show\(\);/);\n  assert.match(program,/notice.Activate\(\);/);
  assert.match(program,/HasScheduleDecision\(key, OperationalMs\(promptBoundary\)\)/);
  assert.doesNotMatch(program.split("private void ShowD173ShiftDecision(")[1].split("private void CloseD173ShiftDecision()")[0],/RefreshSharedScheduleNow|ReadRoles|new Timer/);
});