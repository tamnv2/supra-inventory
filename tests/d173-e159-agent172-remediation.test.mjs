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
  assert.ok(["172", "173", "174", "175", "176", "177", "178", "179", "180", "181"].includes(version));
  if (version === "177") {
    const e175=JSON.parse(src("ops/d173-e175-release-authorization.json"));
    assert.equal(e175.agent_target_version,177);
    assert.equal(e175.owner_approved_code,true);
    assert.equal(e175.d172_pending_hold,true);
    assert.equal(e175.no_stable,true);
  }
  if (version === "181") {
    const e182=JSON.parse(src("ops/d173-e182-agent181-release-authorization.json"));
    assert.equal(e182.agent_target_version, 181);
    assert.deepEqual(e182.approved_components, ["agent"]);
    assert.equal(e182.owner_code_approved, true);
    assert.equal(e182.owner_protected_release_approved, true);
    for (const key of ["confirm_business_mutation", "d172_mutation", "stable_mutation",
      "worker_mutation", "web_mutation", "android_mutation", "service_mutation"])
      assert.equal(e182[key], false, key);
  }
  if (version === "180") {
    const e182=JSON.parse(src("ops/d173-e182-agent180-release-authorization.json"));
    assert.equal(e182.agent_target_version, 180);
    assert.deepEqual(e182.approved_components, ["agent"]);
    assert.equal(e182.owner_code_approved, true);
    assert.equal(e182.confirm_business_mutation, false);
    assert.equal(e182.d172_mutation, false);
    assert.equal(e182.stable_mutation, false);
  }
  if (version === "179") {
    const e181=JSON.parse(src("ops/d173-e181-agent179-release-authorization.json"));
    assert.equal(e181.agent_target_version, 179);
    assert.deepEqual(e181.approved_components, ["agent"]);
    assert.equal(e181.owner_code_approved, true);
    assert.equal(e181.d172_mutation, false);
    assert.equal(e181.stable_mutation, false);
    assert.equal(e181.worker_mutation, false);
  }
  if (version === "178") {
    const e179=JSON.parse(src("ops/d173-e179-agent178-release-authorization.json"));
    assert.equal(e179.agent_target_version, 178);
    assert.deepEqual(e179.approved_components, ["agent"]);
    assert.equal(e179.owner_code_approved, true);
    assert.equal(e179.d172_mutation, false);
    assert.equal(e179.stable_mutation, false);
    assert.equal(e179.worker_mutation, false);
  }
  if (version === "174") {
    const grant = JSON.parse(src("ops/d173-e165-agent174-release-authorization.json"));
    assert.equal(grant.agent_target_version, 174);
    assert.equal(grant.existing_host13_sha256.length, 64);
  }
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
  const currentAgent = src("relay-agent/VERSION").trim();
  if (["177","178","179","180","181"].includes(currentAgent)) {
    const grant = JSON.parse(src("ops/d173-e175-release-authorization.json"));
    assert.equal(grant.checkpoint_id, "D173-E175");
    assert.equal(grant.owner_approved_code, true);
    assert.equal(grant.d172_pending_hold, true);
    // E175 supersedes SSID authority: only authenticated, read-only
    // Worker/Firestore reachability probes can classify network capability.
    assert.doesNotMatch(network, /string\.Equals\(profile, "\.Office@MSN"/);
    assert.match(network, /ObserveNetworkCapability\(string capability\)/);
    assert.match(network, /_observedCapabilityMode = "UNKNOWN"/);
  } else {
    assert.match(network, /string\.Equals\(profile, "\.Office@MSN"/);
  }
  if (["177","178","179","180","181"].includes(currentAgent)) {
    // E175 only disables updates after an authenticated Worker capability
    // probe establishes lack of Internet, never on SSID alone.
    assert.match(form, /verifiedBlocked = _d173E175ClassificationVerified && !_d173E175WorkerVerified/);
    assert.match(form, /Cập nhật \(cần mạng\)/);
  } else {
    assert.match(form, /Cập nhật: cần Internet/);
  }
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
