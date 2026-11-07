import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const sync = read("relay-agent/FirestoreAgentSync.cs");
const activity = read("relay-agent/D173E103Activity.cs");
const outbox = read("relay-agent/D173E150ActivityOutbox.cs");
const roster = read("relay-agent/D119AgentFeatures.cs");
const refresh = read("relay-agent/D173E148ManualRosterRefresh.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const host = read("relay-agent-webview2-host/Program.cs");
const form = read("relay-agent/Program.cs");

test("activity piggybacks exact existing agent_sync document without new listener or collection", () => {
  assert.match(sync, /internal string ActivityJson = ""/);
  assert.match(sync, /snapshot.ActivityJson = FieldString\(fields, "activity_json"\)/);
  assert.match(sync, /"activity_json", StringField\(snapshot.ActivityJson/);
  assert.match(sync, /"activity_json", snapshot.ActivityJson/);
  assert.match(sync, /ActivityJson = source.ActivityJson/);
  assert.match(sync, /Mutate\(session, snapshot =>/);
  assert.match(sync, /ActivityNewer\(old, entry\)/);
  assert.match(sync, /items.OrderByDescending\(a => a.AtMs\).Take\(64\)/);
  assert.match(activity, /QueueD173E150Activity\(activity\)/);
  assert.match(outbox, /_agentSyncClient.PublishActivityBatch\(session, batch\)/);
  assert.match(outbox, /File.Replace\(temp, path, null, true\)/);
  assert.match(outbox, /StartD173E150ActivityDelivery\(\)/);
  assert.match(sync, /ActivityPatchDailyHardLimit = 1500/);
  assert.match(sync, /ActivityQuotaDayNow\(\)/);
  assert.match(roster, /ApplyD173SyncedActivity\(snapshot.ActivityJson\)/);
  assert.match(refresh, /_agentSyncClient.Load\(identity\)/);
  assert.doesNotMatch(activity, /new FirestoreAgentSyncListener|new System.Windows.Forms.Timer|new HttpWebRequest/);
});

test("activity uses session generation, terminal monotonicity, and fleet display login", () => {
  assert.match(sync, /next.Generation > previous.Generation/);
  assert.match(sync, /!previous.Terminal && next.Terminal && next.AtMs >= previous.AtMs/);
  assert.match(sync, /next.AtMs > previous.AtMs/);
  assert.match(activity, /D173AcceptActivity\(old, entry.Generation, entry.RequestId/);
  assert.match(activity, /var displayLogin = string.IsNullOrWhiteSpace\(current.LoginName\)/);
  assert.match(activity, /shared.Owner, agent.AdminUserId/);
  assert.match(activity, /shared.AtMs/);
  assert.doesNotMatch(activity, /current.RefreshToken\s*\}/);
});

test("Agent170 reconnects a replaced WebView2 Host even after hiding placeholder", () => {
  const begin = form.indexOf("private void SizeEmbeddedWmsViewport()");
  const end = form.indexOf("private void ActivateEmbeddedWmsTab()", begin);
  assert.ok(begin > 0 && end > begin);
  const embed = form.slice(begin, end);
  assert.doesNotMatch(embed, /_mainTabs.SelectedTab != _wmsWebTab/);
  assert.match(embed, /TryEmbedAgentWindow\(/);
  assert.match(form, /SizeEmbeddedWmsViewport\(\);\s*if \(state.LoginMarkerDetected/);
  assert.match(form, /RestoreFromTray\(\)/);
  assert.match(form, /_d173E149WmsLoginPromptShown/);
  assert.match(form, /if \(!_wmsTabUserHidden\)/);
  assert.match(browser, /window_visibility=AWAIT_EMBED/);
  assert.match(host, /if \(options.ProtectedDefault\)/);
  assert.match(host, /ShowInTaskbar = false/);
  assert.match(host, /Location = new System.Drawing.Point\(-32000, -32000\)/);
  assert.match(browser, /ShowWindow\(host, visible && attached \? SW_SHOW : SW_HIDE\)/);
  const visibility = browser.slice(browser.indexOf("private void SetBrowserWindowsVisibleNoLock"),
    browser.indexOf("private static bool NeedsSearchRetry"));
  assert.doesNotMatch(visibility.slice(0, visibility.indexOf("// Desktop browser handling")),
    /SetForegroundWindow\(host\)/);
});

test("candidate does not silently claim production release or change D172", () => {
  const version = read("relay-agent/VERSION").trim();
  assert.ok(["170", "171", "172", "173"].includes(version), "E150/E152/E159/E161 scoped versions");
  assert.match(read("relay-agent/AgentConfig.cs"), new RegExp("AgentBuild = " + version));
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), new RegExp("0\\." + version + "\\.0\\.0"));
  if (version === "171") {
    const state = JSON.parse(read("ops/project-state.json")).d173_e152;
    assert.equal(state.owner_release_approved, false);
    assert.equal(state.candidate_agent_version, 171);
    assert.equal(state.host_reuse, 13);
    assert.match(read("docs/D173_E152_AGENT171_HOST13_OWNED_FORM_FIELD_FIX_2026-11-07.md"), /CODE ONLY/);
  }
  if (version === "172") {
    const state = JSON.parse(read("ops/project-state.json")).d173_e159;
    assert.equal(state.target_agent_version, 172);
    assert.equal(state.existing_host_build, 13);
    assert.match(state.owner_approval, /CODE_AND_CONDITIONAL/);
    assert.equal(state.owner_pass, false);
    assert.match(read("docs/D173_E159_AGENT172_OWNER_APPROVED_IMPLEMENTATION_2026-11-07.md"), /NO automatic deployment|CI\/RELEASE\/FIELD\/OWNER PASS not presumed/);
  }
  if (version === "173") {
    const state = JSON.parse(read("ops/project-state.json")).d173_e161;
    assert.equal(state.agent_target_version, 173);
    assert.equal(state.host_build, 13);
    assert.equal(state.owner_release_approved, true);
    assert.equal(state.field_pass, false);
    assert.equal(state.owner_pass, false);
    assert.match(read("docs/D173_E161_AGENT173_WEBVIEW2_TRAY_CONFIRM_FIX_2026-11-07.md"), /FIELD.*PENDING/);
  }
  const evidence = read("docs/D173_E149_AGENT170_ACTIVITY_BROWSER_FIRE_BUDGET_2026-11-07.md");
  assert.match(evidence, /CODE ONLY/);
  assert.match(evidence, /NOT YET|do not|cannot|chưa/i);
  assert.match(evidence, /D172/);
  assert.match(evidence, /80%/);
});
