import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const get = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const agent = get("relay-agent/D119AgentFeatures.cs");
const ui = get("relay-agent/Program.cs");
const roster = get("relay-agent/D173ReporterPresence.cs");
const service = get("service/src/read-model-core.ts");

test("D173-E103: 70% native roster; 30% scrollable operational area", () => {
  assert.match(ui, /overviewLayout\.RowStyles\.Add\(new RowStyle\(SizeType\.Percent, 30F\)\);\s*overviewLayout\.RowStyles\.Add\(new RowStyle\(SizeType\.Percent, 70F\)\);/);
  assert.match(ui, /AutoScroll = true/);
});

test("D173-E103: manual unique picklist shares existing guarded confirmation", () => {
  assert.match(ui, /result\.Matches\.Count == 1 && displayCodes\.Count == 1/);
  assert.match(ui, /result\.AmbiguousFragments\.Count == 0/);
  assert.match(ui, /result\.Candidates\.TryGetValue\(fragment, out choices\)/);
  assert.match(ui, /displayCodes\.Count \+ " mã đầy đủ để xác nhận từng đơn hoặc tất cả/);
  assert.match(ui, /result\.MissingFragments\.Count == 0/);
  const search = ui.split("private void SearchManualPicklists()")[1].split("private static string ManualOutcomeText")[0];
  assert.ok(search.lastIndexOf("Interlocked.Exchange(ref _manualPicklistOperationRunning, 0)") < search.lastIndexOf("ConfirmManualPicklist(singleAutoConfirm)"));
  assert.match(ui, /_confirmationGuard\.TryBegin\(/);
  assert.match(ui, /_supraBrowser\.ConfirmExact\(/);
});

test("D173-E103: distinct Agent Web PDA channels and visible action column", () => {
  assert.match(agent, /"Tất cả", "Agent", "Web", "PDA"/);
  assert.match(agent, /"ALL", "AGENT", "WEB", "PDA"/);
  assert.match(agent, /D173SummaryActivity.*HeaderText = "Hoạt động gần nhất"/);
  assert.match(agent, /D173SessionSortKey\(/);
  assert.match(agent, /_pickerOnlineGrid\.Sort\(/);
  assert.match(agent, /CellPainting/);
});

test("D173-E103: source-backed sessions, separate socket liveness, excludes D172", () => {
  assert.match(service, /web_session_started_at AS login_at/);
  assert.match(service, /android_session_started_at AS login_at/);
  assert.match(service, /AUTHENTICATED_INTERACTIVE_SESSION/);
  assert.match(service, /state\.getWebSockets\(\)/);
  assert.match(service, /source: "AUTHENTICATED_SESSION"/);
  assert.doesNotMatch(service, /obpp_session_started_at/);
  assert.match(roster, /schema == 2 && source == "AUTHENTICATED_INTERACTIVE_SESSION"/);
  assert.match(roster, /LastActivityAt = valueOf\("last_activity_at"\)/);
});

test("D173-E103: unchanged app and version monotonic", () => {
  const version = Number(get("relay-agent/VERSION").trim());
  assert.ok(Number.isInteger(version) && version >= 161);
  assert.match(get("relay-agent/AgentConfig.cs"), new RegExp("AgentBuild\\s*=\\s*" + version + ";"));
  assert.match(get("relay-agent/SupraInventoryRelayAgent.csproj"), new RegExp("0\\." + version + "\\.0\\.0"));
});
