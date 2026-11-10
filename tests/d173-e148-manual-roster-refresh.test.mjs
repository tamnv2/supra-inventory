import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ui = read("relay-agent/D119AgentFeatures.cs");
const refresh = read("relay-agent/D173E148ManualRosterRefresh.cs");
const fleet = read("relay-agent/FirestoreAgentLeaderCoordinator.cs");
const sync = read("relay-agent/FirestoreAgentSync.cs");
const picker = read("relay-agent/FirestorePickerPresence.cs");
const reporter = read("relay-agent/D173ReporterPresence.cs");

test("manual refresh button is on the existing roster toolbar immediately before close-60s", () => {
  assert.match(refresh, /Text = "Làm mới dữ liệu"/);
  assert.match(refresh, /Name = "D173E148RefreshAllRosterAndAgents"/);
  assert.match(ui, /InitializeD173E148ManualRefresh\(\)/);
  assert.match(ui, /_d173RosterToolbar\.Controls\.Add\(action\)/);
  assert.match(ui, /_d173RosterTech,\s*_d173E148ManualRefreshButton, _d173E140CloseAllCalls/);
  if (["178", "179", "180"].includes(read("relay-agent/VERSION").trim())) {
    const version=read("relay-agent/VERSION").trim();
    const grant=JSON.parse(read(version === "180" ?
      "ops/d173-e182-agent180-release-authorization.json" : version === "179" ?
      "ops/d173-e181-agent179-release-authorization.json" :
      "ops/d173-e179-agent178-release-authorization.json"));
    assert.equal(grant.agent_target_version,Number(version));
    assert.deepEqual(grant.approved_components,["agent"]);
    assert.equal(grant.owner_code_approved,true);
    assert.match(ui, /new Control\[\] \{ _d173E148ManualRefreshButton,\s*_d173E140CloseAllCalls/);
    assert.match(ui, /_d173RosterToolbar\.AutoScrollMinSize = Size.Empty/);
  } else {
    assert.match(ui, /new\[\] \{ _d173E148ManualRefreshButton,\s*_d173E140CloseAllCalls/);
    assert.match(ui, /_d173RosterToolbar\.AutoScrollMinSize = new Size\(x \+ 4, 0\)/);
  }
  assert.match(ui, /_d173E148ManualRefreshButton\.Enabled = authenticated/);
});

test("one click immediately reads all four existing authenticated sources with no cadence wait", () => {
  assert.match(refresh, /Task\.Run\(\(\) =>/);
  assert.match(refresh, /_agentSyncClient\.Load\(identity\)/);
  assert.match(refresh, /_pickerPresenceClient\.Load\(identity\)/);
  assert.match(refresh, /_d173ReporterClient\.Load\(identity\)/);
  assert.match(refresh, /QueryFreshFleetForOperatorRefresh\(identity\)/);
  assert.doesNotMatch(refresh, /ReconcileD134AgentSync\(/);
  assert.doesNotMatch(refresh, /RefreshD119OperationalViews\(/);
  assert.doesNotMatch(refresh, /RefreshD173ReporterIfDue\(/);
  assert.doesNotMatch(refresh, /SetInterval|System\.Windows\.Forms\.Timer|Thread\.Sleep/);
  assert.match(sync, /internal AgentSyncSnapshot Load\(AgentSession session\)/);
  assert.match(picker, /internal List<PickerPresenceView> Load\(AgentSession session\)/);
  assert.match(reporter, /internal List<ReporterOnlineView> Load\(AgentSession session\)/);
});

test("fleet refresh reads current role and heartbeat only; no failover/primary mutation", () => {
  const start = fleet.indexOf("internal List<AgentPresenceView> QueryFreshFleetForOperatorRefresh");
  const end = fleet.indexOf("internal List<AgentPresenceView> GetFreshAgentsForManualHandoff()", start);
  assert.ok(start > 0 && end > start);
  const body = fleet.slice(start, end);
  assert.match(body, /ReadRoles\(session\)\.Snapshot/);
  assert.match(body, /QueryFreshPresence\(/);
  assert.match(body, /FirestoreAgentSyncClient\.MaxAgents/);
  assert.match(body, /"PRIMARY"/);
  assert.match(body, /"NEXT_A"/);
  assert.match(body, /"NEXT_B"/);
  assert.doesNotMatch(body, /TryWriteRoles|WritePrimaryLease|SetRole|Release|Promote|Publish|SendJson|Reconcile\(/);
});

test("manual refresh is single-flight, short double-click guard, session-fenced and honest about partial results", () => {
  assert.match(refresh, /Interlocked\.CompareExchange\(ref _d173E148ManualRefreshRunning, 1, 0\)/);
  assert.match(refresh, /TimeSpan\.FromSeconds\(10\)/);
  assert.match(refresh, /_d173E148ManualRefreshButton\.Enabled = false/);
  assert.match(refresh, /identity\.RefreshToken, current\.RefreshToken/);
  assert.match(refresh, /DISCARDED_SESSION_CHANGED/);
  assert.match(refresh, /ApplyD134AgentSyncSnapshot\(sync\)/);
  assert.match(refresh, /ApplyD173E148ManualPickerPresence\(pickers\)/);
  assert.match(ui, /private void ApplyD173E148ManualPickerPresence\(/);
  assert.match(ui, /DIRECT_PRESENCE_MANUAL_READ/);
  assert.match(ui, /if \(!string\.Equals\(reason, "DIRECT_PRESENCE_MANUAL_READ"/);
  assert.match(refresh, /UpdateD173ReporterOnline\(webAndReporters\)/);
  assert.match(refresh, /UpdateAgentFleetGrid\(_leaderCoordinator\.OnlineAgents\)/);
  assert.match(refresh, /Đã làm mới đầy đủ 4\/4 nguồn/);
  assert.match(refresh, /Đã làm mới " \+ successCount \+ "\/4 nguồn · có lỗi/);
  assert.match(refresh, /provider_write=false/);
  assert.doesNotMatch(refresh, /\/auth\/revoke|\.Revoke\(|\.Kick\(|\.ResolveAllActiveCalls\(|ForceRefreshAgentTokenD160\(/);
});
