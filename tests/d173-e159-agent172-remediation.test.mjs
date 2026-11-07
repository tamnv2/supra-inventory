import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const browser = src("relay-agent/SupraConfirmBrowser.cs");
const health = src("relay-agent/D157AgentFeatures.cs");
const form = src("relay-agent/Program.cs");
const ha = src("relay-agent/FirestoreAgentLeaderCoordinator.cs");
const presence = src("relay-agent/D119AgentFeatures.cs");
const locks = src("relay-agent/FirestoreD173E140PickerLocks.cs");
const activity = src("relay-agent/D173E103Activity.cs");
const monitor = src("relay-agent/D173E141VpsWebMonitor.cs");
const network = src("relay-agent/D168NetworkRoute.cs");
const usage = src("relay-agent/D173VpsUsage.cs");
const sync = src("relay-agent/FirestoreAgentSync.cs");

const between = (s, first, last) => {
  const a = s.indexOf(first);
  const b = s.indexOf(last, a + first.length);
  assert.ok(a >= 0 && b > a, "Missing method bounds: " + first);
  return s.slice(a, b);
};

test("Agent172 baseline and Agent173 hotfix retain the signed Host13 generation", () => {
  const version = src("relay-agent/VERSION").trim();
  assert.ok(["172", "173"].includes(version));
  assert.match(src("relay-agent/AgentConfig.cs"), new RegExp("AgentBuild = " + version + ";"));
  assert.match(src("relay-agent/SupraInventoryRelayAgent.csproj"), new RegExp(String.raw`0\.` + version + String.raw`\.0\.0`));
  assert.match(src("relay-agent/AgentBrowserBundle.cs"), /RequiredHostBuild = 13;/);
});

test("regular WebView2 tray and session health preserve the actual browser page", () => {
  const tray = between(form, "private void MinimizeToTray()", "private void QueueNetworkStatusRefresh()");
  assert.match(tray, /TRAY event=HIDE/);
  assert.match(tray, /TRAY event=RESTORE/);
  assert.doesNotMatch(tray, /Page\.reload|NavigateConfirmNoLock|StopManagedBrowserNoLock/);

  const open = between(browser, "internal SupraBrowserState OpenAgentBackground()", "internal bool IsAgentOwnedMode()");
  assert.match(open, /if \(newHost\)/);
  assert.match(open, /NavigateConfirmNoLock\(\)/);
  assert.match(open, /existing_host=REUSED navigation=NONE/);
  assert.doesNotMatch(open, /NavigateConfirmNoLock\(\);[\s\S]*if \(newHost\)/);

  const passive = between(browser, "internal bool PassiveConfirmHealthProbe(", "internal bool ReloadConfirmForHealthCheck(");
  assert.match(passive, /BuildReadinessScript\(\)/);
  assert.doesNotMatch(passive, /Page\.reload|Page\.navigate|IssueConfirmReloadNowNoLock/);
  const scheduled = between(health, "private void TickD157SessionHealth()", "private bool ProbeD157TargetWmsForTakeover()");
  assert.match(scheduled, /PassiveConfirmHealthProbe\(reason\)/);
  assert.doesNotMatch(scheduled, /ReloadConfirmForHealthCheck\(/);
  assert.doesNotMatch(scheduled, /RefreshSupraBrowserStatus\(\)/);
});

test("fleet uses a single shared <=5m presence cadence and one listener", () => {
  assert.match(ha, /PresenceHeartbeatIntervalMs = 300000/);
  assert.match(ha, /PresenceReadIntervalMs = 300000/);
  assert.match(ha, /PresenceFreshMs = 390000/);
  assert.match(presence, /var interval = TimeSpan\.FromMinutes\(5\)/);
  assert.match(presence, /_agentSyncClient\.Reconcile\(/);
  assert.match(sync, /ReconcileInterval = TimeSpan\.FromMinutes\(5\)/);
  assert.match(sync, /ActivityPatchDailyHardLimit = 1500/);
  assert.match(sync, /ActivityNewer\(old, entry\)/);
});

test("Firestore permanent permission failures pause without retry storms", () => {
  assert.match(locks, /StatusCode\.PermissionDenied/);
  assert.match(locks, /retry = Math\.Max\(retry, 300000\)/);
  assert.match(locks, /state=COOLDOWN/);
  assert.doesNotMatch(locks, /allow list: if true/);
});

test("Web monitor is observable for all sessions, toggle only exact Owner/VPS operators", () => {
  assert.match(monitor, /FirestoreVpsReclaim\.IsVps\(session\)/);
  assert.match(monitor, /FirestoreVpsReclaim\.IsOwner\(session\)/);
  assert.match(monitor, /_e141WebMonitorEnabled = HasAgentSession\(\)/);
  assert.match(monitor, /_e141WebMonitorButton.Visible = permitted/);
  assert.match(monitor, /if \(!E141AuthorizedVps\(\)\) return/);
  assert.match(monitor, /scope=AUTHORIZED_AGENT local_only=true/);
});

test("Office respects real WMS/Firestore, disables only unavailable Internet requests", () => {
  assert.match(network, /string\.Equals\(profile, "\.Office@MSN"/);
  assert.match(form, /Cập nhật: cần Internet/);
  assert.match(form, /UPDATE result=SKIP reason=OFFICE_REQUIRES_INTERNET/);
  assert.match(usage, /Mạng Office · chỉ xem dữ liệu đã lưu/);
});

test("Picker activity accepts newer session generation without attributing old sessions", () => {
  assert.match(activity, /picker\.SessionGeneration > generation/);
  assert.match(activity, /work\.CreatedAtMs > now \+ 5000L/);
  assert.match(activity, /Math\.Min\(now, work\.CreatedAtMs\)/);
  assert.match(activity, /QueueD173E150Activity\(activity\)/);
});

test("VPS automatic return does not interrupt WMS/Picker or manual input", () => {
  assert.match(ha, /D169_VPS_AUTOMATIC_SAFE_RETURN/);
  assert.match(ha, /D169_VPS_OWNER_APPROVED_SAFE_RETURN/);
  assert.match(ha, /manualHold/);
  assert.match(ha, /var isNewGeneration =/);
  assert.match(ha, /else if \(isNewGeneration\)\s*fields\["manual_holder_agent_instance_id"\] = StringField\(""/);
  assert.match(ha, /else if \(isNewGeneration\)\s*fields\["wms_handoff_generation"\] = StringField\(""/);
  assert.match(form, /_d157SessionValidationRunning, 0L, 0L/);
  assert.match(form, /!InteractiveTextEntryActive\(\)/);
  assert.match(form, /_supraBrowser\.AgentInputProtected/);
});

test("Usage retains exact privileged UI+Worker access and no new provider resource", () => {
  assert.match(src("relay-agent/D173VpsUsage.cs"), /string\.Equals\(user,"admin"/);
  assert.match(src("relay-agent/D173VpsUsage.cs"), /string\.Equals\(user,"tamnv2"/);
  assert.match(src("relay-agent/D173VpsUsage.cs"), /string\.Equals\(user,"vps"/);
  assert.match(src("service/src/index.ts"), /"VPS_USAGE_FORBIDDEN"/);
  assert.match(src("ops/project-scope.json"), /"unknown_resource": "FAIL_CLOSED_RECONCILE_BEFORE_MUTATION"/);
});
