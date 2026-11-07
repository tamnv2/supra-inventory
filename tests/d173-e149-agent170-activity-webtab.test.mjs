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
  assert.match(sync, /items.OrderByDescending\(a => a.AtMs\).Take\(220\)/);
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
  assert.equal(read("relay-agent/VERSION").trim(), "170");
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild = 170/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /0\.170\.0\.0/);
  const evidence = read("docs/D173_E149_AGENT170_ACTIVITY_BROWSER_FIRE_BUDGET_2026-11-07.md");
  assert.match(evidence, /CODE ONLY/);
  assert.match(evidence, /NOT YET|do not|cannot|chưa/i);
  assert.match(evidence, /D172/);
  assert.match(evidence, /80%/);
});
