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

test("E111 Agent163 reuses unchanged Firestore Rules with source-pinned gate before legacy same-SHA wait", () => {
  const workflow=read(".github/workflows/verify-relay-agent.yml");
  const firestore=workflow.split("      - name: D169 require matching Beta Firestore Rules before publishing Agent")[1].split("      - name: Resolve official Fixed WebView2 package")[0];
  assert.match(firestore,/D173-E111_REPORTER_SKU_OVERTIME_RELEASE:/);
  assert.match(firestore,/tools\/d173_e111_release_gate\.py --component agent/);
  assert.match(firestore,/git diff --quiet 0a0d2f1d8e045e66d879c37a43453b34a8d92586 HEAD -- firebase\/ firebase\.json/);
  assert.ok(firestore.indexOf("D173_E111_FIRESTORE_RULES_IMMUTABLE_REUSE_PASS") < firestore.indexOf("for ($attempt = 1; $attempt -le 120; $attempt++)"));
});

test("E113 source-pinned Agent163 reuses immutable registered Gateway and Android vc123 retains notes",()=>{
  const workflow=read(".github/workflows/verify-relay-agent.yml");
  const stage=workflow.split("      - name: D171 exact registered Gateway dependency before Agent publish")[1].split("      # E054 only updates")[0];
  assert.match(stage,/D173-E111_REPORTER_SKU_OVERTIME_RELEASE:/);
  assert.match(stage,/tools\/d173_e111_release_gate\.py --component agent/);
  assert.match(stage,/git diff --quiet 0a0d2f1d8e045e66d879c37a43453b34a8d92586 HEAD -- ops\/apps-script\//);
  assert.ok(stage.indexOf("D173_E111_AGENT_GATEWAY_IMMUTABLE_REUSE_PASS") < stage.indexOf("$receipt = Get-Content ops/d171-release-authorization.json"));
  const notes=JSON.parse(read("android/release-notes.json"));
  assert.equal(notes.schema_version,1);
  assert.ok(notes.release_notes.length>=1 && notes.release_notes.length<=5);
  assert.ok(notes.release_notes.every(x=>x.startsWith("vc123:")));
});
