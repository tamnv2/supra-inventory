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
  assert.ok(["172", "173", "174", "175", "176", "177", "178", "179", "180", "181", "182", "183", "184", "185", "186"].includes(version));
  if (version === "177") {
    const e175=JSON.parse(src("ops/d173-e175-release-authorization.json"));
    assert.equal(e175.agent_target_version,177);
    assert.equal(e175.owner_approved_code,true);
    assert.equal(e175.d172_pending_hold,true);
    assert.equal(e175.no_stable,true);
  }
  if (version === "186") {
    const auth = JSON.parse(src("ops/d173-e188-agent186-release-authorization.json"));
    assert.equal(auth.owner_approval_reference,
      "OWNER_20261111_AGENT185_THREE_AGENT_FIELD_FAIL_FIX_FOUR_ISSUES_RELEASE_AGENT186");
    assert.equal(auth.agent_target_version, 186);
    assert.equal(auth.host_target_build, 14);
    assert.deepEqual(auth.approved_components, ["agent"]);
    assert.equal(auth.owner_code_approved, true);
    assert.equal(auth.owner_protected_release_approved, true);
    assert.equal(auth.no_new_provider_requests, true);
    for (const key of ["obpp_mutation","android_mutation","worker_mutation","web_mutation",
      "host_mutation","stable_mutation","firestore_rules_mutation","new_provider_resources","wms_business_mutation"])
      assert.equal(auth[key], false, key);
    assert.equal(auth.field_pass, false);
    assert.equal(auth.owner_pass, false);
  }
  if (version === "185") {
    const e187 = JSON.parse(src("ops/d173-e187-agent185-release-authorization.json"));
    assert.equal(e187.owner_approval_reference,
      "OWNER_20261111_AGENT184_FIELD_FAIL_ADMIN_PC_WEBVIEW2_WHITE_RELEASE_AGENT185");
    assert.equal(e187.agent_target_version, 185);
    assert.equal(e187.host_target_build, 14);
    assert.deepEqual(e187.approved_components, ["agent", "agent-webview2-host"]);
    assert.equal(e187.owner_code_approved, true);
    assert.equal(e187.owner_protected_release_approved, true);
    assert.equal(e187.no_new_provider_requests, true);
    for (const key of ["obpp_mutation","android_mutation","worker_mutation","web_mutation",
      "stable_mutation","firestore_rules_mutation","new_provider_resources","wms_business_mutation"])
      assert.equal(e187[key], false, key);
  }
  if (version === "184") {
    const e185 = JSON.parse(src("ops/d173-e185-release-authorization.json"));
    assert.equal(e185.owner_approval_reference,
      "OWNER_20261111_ITEMS_1_TO_7_CODE_AND_PRODUCTION_REPORTER_PDA_BACKLOG");
    assert.equal(e185.agent_target_version, 184);
    assert.equal(e185.owner_code_approved, true);
    assert.equal(e185.owner_protected_release_approved, true);
    assert.equal(e185.d172_pending_hold, true);
    assert.equal(e185.android_mutation, false);
    assert.equal(e185.stable_mutation, false);
    assert.equal(e185.new_provider_resources, false);
  }
  if (version === "183") {
    const auth = JSON.parse(src("ops/d173-e183-agent183-release-authorization.json"));
    assert.equal(auth.owner_approval_reference, "OWNER_20261111_AGENT182_FIELD_FAIL_LAYOUT_AND_WEB_WHITE_SCREEN_RELEASE_AGENT183");
    assert.equal(auth.agent_target_version, 183);
    assert.deepEqual(auth.approved_components, ["agent"]);
    assert.equal(auth.owner_code_approved, true);
    assert.equal(auth.owner_protected_release_approved, true);
    assert.equal(auth.host_build, 13);
    for (const key of ["confirm_business_mutation", "d172_mutation", "stable_mutation",
      "worker_mutation", "web_mutation", "android_mutation", "service_mutation"])
      assert.equal(auth[key], false, key);
  }
  if (version === "182") {
    const auth = JSON.parse(src("ops/d173-e182-agent182-release-authorization.json"));
    assert.equal(auth.owner_approval_reference, "OWNER_20261110_AGENT181_FIELD_FAIL_USER_EXPLICIT_RELEASE_AGENT182");
    assert.equal(auth.agent_target_version, 182);
    assert.deepEqual(auth.approved_components, ["agent"]);
    assert.equal(auth.owner_code_approved, true);
    assert.equal(auth.owner_protected_release_approved, true);
    assert.equal(auth.host_build, 13);
    for (const key of ["confirm_business_mutation", "d172_mutation", "stable_mutation",
      "worker_mutation", "web_mutation", "android_mutation", "service_mutation"])
      assert.equal(auth[key], false, key);
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
  assert.match(src("relay-agent/AgentBrowserBundle.cs"), version === "185" ? /RequiredHostBuild = 14;/ : /RequiredHostBuild = 13;/);
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
  if (["177","178","179","180","181","182","183","184","185","186"].includes(currentAgent)) {
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
  if (["177","178","179","180","181","182","183","184","185","186"].includes(currentAgent)) {
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
