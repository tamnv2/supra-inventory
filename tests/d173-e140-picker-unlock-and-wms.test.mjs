import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const get = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pipeline = get("relay-agent/D160ConfirmPipeline.cs");
const browser = get("relay-agent/SupraConfirmBrowserD160.cs");
const agent = get("relay-agent/Program.cs");
const leader = get("relay-agent/FirestoreAgentLeaderCoordinator.cs");
const rates = get("relay-agent/FirestorePickerRateLimiter.cs");
const fleet = get("relay-agent/FirestoreD173E140PickerLocks.cs");
const ui = get("relay-agent/D173E140PickerUnlockUi.cs");
const android = get("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt");
const relay = get("android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt");
const rules = get("firebase/firestore.rules");

test("E140 exact single PL row disabled checkbox has two exclusive business outcomes", () => {
  assert.match(pipeline, /search\.AlreadyConfirmedFragments\.Contains\(work\.Suffix/);
  assert.match(pipeline, /"ALREADY_CONFIRMED" : "PICKLIST_NOT_READY"/);
  assert.match(browser, /boxDisabled && rowReclaimAction/);
  assert.match(browser, /matches\.length !== 1/);
  assert.match(android, /"PICKLIST_NOT_READY" -> "PickList chưa khả dụng/);
  assert.match(android, /"ALREADY_CONFIRMED" ->/);
});

test("E140 real new requests do not use a persistent full PL confirmation guard", () => {
  const pda = pipeline.split("private int D160MutateReady(")[1].split("private FirestoreConfirmationOutcome D160Outcome(")[0];
  const manual = agent.split("private void ConfirmManualPicklists(")[1].split("private void ", 1)[0];
  assert.doesNotMatch(pda, /_confirmationGuard\./);
  assert.doesNotMatch(manual, /_confirmationGuard\.TryBegin/);
  assert.match(pda, /VerifyPrimaryBeforeMutation\(session\)/);
  assert.match(pda, /D173_E140_CONFIRM no_guard=1/);
  assert.match(browser, /"WMS_CONFIRM_RESPONSE_MISSING"/);
  assert.match(browser, /"WMS_CONFIRM_ERROR_AFTER_CLICK"/);
});

test("E140 all Agent instances watch locked users, tab vanishes at zero", () => {
  assert.match(fleet, /CollectionId = "relay_poc_rate_limits"/);
  assert.match(fleet, /client\.Listen\(/);
  assert.match(ui, /if \(visible && !_mainTabs\.TabPages\.Contains\(_d173E140UnlockTab\)\)/);
  assert.match(ui, /_mainTabs\.TabPages\.Remove\(_d173E140UnlockTab\)/);
  assert.match(ui, /UnlockPickerByKey\(SnapshotSession\(\), key\)/);
  assert.match(agent, /D173E140StartPickerUnlockRealtime\(\)/);
});

test("E140 unlock is CAS only in the existing collection, no history", () => {
  assert.match(rates, /currentDocument\.updateTime=/);
  assert.match(rates, /PICKER_LOCK_RESET_CAS/);
  assert.doesNotMatch(rates, /unlock_history|history_collection/i);
  assert.match(rules, /match \/relay_poc_rate_limits\/\{pickerKey\}/);
  assert.match(rules, /resource\.data\.picker_uid == request\.auth\.uid/);
  assert.match(rules, /allow list: if isAgentOperator\(\)/);
  assert.match(relay, /fun observePickerUnlock/);
  assert.match(relay, /snapshot\.metadata\.isFromCache/);
  assert.match(android, /relayPocClient\.stopPickerUnlockListener\(\)/);
});

test("E140 explicit WMS login failure and Web-ready fenced failover", () => {
  assert.match(agent, /_d173E140WebLoginRequired = state\.LoginMarkerDetected/);
  assert.match(pipeline, /"WMS_LOGIN_REQUIRED"/);
  assert.match(leader, /urgentWebFailure = _wmsConfirmedUnavailable\(\)/);
  assert.match(leader, /QueryFreshPresence\(session, "E140_WMS_FAILOVER"/);
  assert.match(leader, /TryWriteRoles\(session, relinquish, read, false, true\)/);
  assert.match(android, /"WMS_LOGIN_REQUIRED" ->/);
});


test("E140 bulk 60s call termination uses existing CAS and role-checked Firestore docs", () => {
  const client = get("relay-agent/FirestorePickerContact.cs");
  const fleetUi = get("relay-agent/D168GroupPickerContact.cs");
  assert.match(client, /ResolveAllActiveCalls\(AgentSession session, string agentInstanceId\)/);
  assert.match(client, /ResolveActiveCall\(session, agentInstanceId, command\)/);
  assert.match(client, /currentDocument\.updateTime=/);
  assert.match(client, /EnsureSession\(session\)/);
  assert.match(fleetUi, /Kết thúc gọi 60s/);
  assert.match(fleetUi, /MessageBoxButtons\.YesNo, MessageBoxIcon\.Warning/);
  assert.match(rules, /request\.resource\.data\.resolved_by_agent_id\.size\(\) <= 160/);
  assert.match(rules, /match \/picker_active_calls\/\{targetUserId\}/);
  assert.match(rules, /allow delete: if false/);
  assert.doesNotMatch(fleetUi, /_firestoreRateLimiter\.Unlock/);
});


test("E140 shift expires on service, Firebase Rules and offline Android cold restore", () => {
  const worker = get("service/src/index.ts");
  const activity = get("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  assert.match(worker, /d173PickerShiftIsExpired\(user\.android_session_started_at, Date\.now\(\)\)/);
  assert.match(worker, /picker_shift_logout_at_ms: activated\.pickerShiftLogoutAtMs/);
  assert.match(worker, /picker_shift_logout_at_ms: d173PickerShiftLogoutAtMs\(user\.android_session_started_at\)/);
  assert.match(rules, /function pickerShiftStillValid\(\)/);
  assert.match(rules, /request\.auth\.token\.picker_shift_logout_at_ms > request\.time\.toMillis\(\)/);
  assert.match(activity, /private fun pickerShiftExpiredLocally\(\)/);
  assert.match(activity, /InteractiveSessionStore\.save\(applicationContext, null\)/);
  assert.match(activity, /logoutWithNotificationCleanup\("Không còn thông tin ca hợp lệ/);
});


test("E140 05:00 SKU-only HA never activates Picker relay or overtime", () => {
  const coord = get("relay-agent/FirestoreAgentLeaderCoordinator.cs");
  const host = get("relay-agent/Program.cs");
  assert.match(coord, /private bool HaAllowed\(\)/);
  assert.match(coord, /_skuOnlyWakeEnabled = skuOnlyWakeEnabled \?\? \(\(\) => false\)/);
  const ing = coord.split("internal bool VerifyPrimaryForBusinessIngress(")[1]
    .split("internal bool VerifyPrimaryBeforeMutation(")[0];
  assert.match(ing, /!_relayEnabled\(\)/, "SKU must not authorize PDA business ingress");
  const mutation = coord.split("internal bool VerifyPrimaryBeforeMutation(")[1]
    .split("internal bool RefreshSharedScheduleNow(")[0];
  assert.match(mutation, /!_relayEnabled\(\)/, "SKU must not authorize WMS PickList mutation");
  const skuWake = host.split("private void D173E140AutoWakeForFiveAmSku(")[1]
    .split("// Modeless decision")[0];
  assert.match(skuWake, /coordinator\.RequestRoleRefreshBeforeBusiness\(\)/);
  assert.doesNotMatch(skuWake, /PublishEarlyStartAndClaimPrimary|PublishD173CoordinationSignal/,
    "automatic SKU must not open a work-shift relay override");
  assert.match(host, /D173E140IsWebUnavailable,\s*D173E140SkuOnlyWakeAllowed\)/);
});
