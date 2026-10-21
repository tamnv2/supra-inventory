import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const overlay = source("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt");
const activity = source("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
const coordinator = source("relay-agent/D167SkuCoordinator.cs");
test("command/chat body scrolls and acknowledgement remains outside the scroll", () => {
 const start = overlay.indexOf("private fun buildCommandOverlay(");
 assert.ok(start >= 0);
 const body = overlay.slice(start);
 assert.match(body, /val scrollingMessage = ScrollView\(this\)/);
 assert.match(body, /card\.addView\(scrollingMessage, LinearLayout\.LayoutParams\(/);
 assert.match(body, /MATCH_PARENT, 0, 1f/);
 assert.ok(body.indexOf("card.addView(scrollingMessage") < body.indexOf('text = "XÁC NHẬN"'));
});
test("orphan result overlay unblocks locally without inventing successful server ACK", () => {
 const body = overlay.slice(overlay.indexOf("private fun finishActive("), overlay.indexOf("private fun releaseUnacknowledgedResult("));
 assert.match(body, /markResultDismissed\(/);
 assert.match(body, /removeOverlay\(\)/);
 assert.doesNotMatch(body, /acknowledgeResultAsync|markOverlayAckPending/);
});
test("latest signed Beta version becomes mandatory without forced in-session restart", () => {
 assert.match(activity, /verifiedMinimumVersionCode = maxOf\(verifiedMinimumVersionCode, info\.minimumVersionCode, info\.versionCode\)/);
 assert.match(activity, /val mandatory = info\.versionCode > BuildConfig\.VERSION_CODE/);
 assert.match(activity, /Tiếp tục phiên hiện tại/);
});
test("all queued SKU retries honor one bounded local wake without network polling", () => {
 const body = coordinator.slice(coordinator.indexOf("private void Queue()"), coordinator.indexOf("private void EvaluateOnce()"));
 assert.match(body, /nextWakeAtUtc > DateTime\.UtcNow\.AddMilliseconds\(250\)/);
 assert.match(body, /Interlocked\.CompareExchange\(ref running,1,0\)/);
 assert.match(body, /Arm\(TimeSpan\.FromMinutes\(15\)\)/);
});

const picker = source("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt");
const contacts = source("relay-agent/FirestorePickerContact.cs");
test("PDA displays already-confirmed as positive outcome and distinguishes WMS errors", () => {
 assert.match(picker, /"ALREADY_CONFIRMED" ->/);
 assert.match(picker, /"WMS_DATA_UNAVAILABLE" ->/);
 assert.match(picker, /"LOOKUP_ERROR" ->/);
 assert.match(picker, /result.lookupStatus == "ALREADY_CONFIRMED"/);
});
test("Active-call reconciliation does not scan unused historical alerts", () => {
 const body = contacts.slice(contacts.indexOf("internal Dictionary<string, PickerContactCommand> LoadOpen("), contacts.indexOf("private Dictionary<string, PickerContactCommand> LoadActiveCalls("));
 assert.match(body, /LoadActiveCalls\(session\)/);
 assert.doesNotMatch(body, /LoadLegacyAlerts\(session, result\)/);
});

const haLiveness = source("relay-agent/RtdbHaLiveness.cs");
const haCoordinator = source("relay-agent/FirestoreAgentLeaderCoordinator.cs");
test("HA heartbeat reports real WMS readiness and does not claim ready unconditionally", () => {
 assert.match(haLiveness, /WriteHeartbeat\(AgentSession session, string generation, bool wmsReady\)/);
 assert.match(haLiveness, /\{ "wms_ready", wmsReady \}/);
 assert.doesNotMatch(haLiveness, /\{ "wms_ready", true \}/);
 assert.match(haCoordinator, /_rtdbLiveness\.WriteHeartbeat\(session, _generation, _wmsReady\(\)\)/);
});

const leader = source("relay-agent/FirestoreAgentLeaderCoordinator.cs");
const network = source("relay-agent/D168NetworkRoute.cs");
const rules = source("firebase/firestore.rules");
const relay = source("android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt");
const transport = source("relay-agent/FirestoreConfirmationTransport.cs");
const pipeline = source("relay-agent/D160ConfirmPipeline.cs");

test("D169 cross-network HA renews common lease before optional RTDB and fences WMS on lease freshness", () => {
 assert.match(leader, /WritePrimaryLease\(session\);\s*if \(D168NetworkRoute\.CurrentNetworkMode\(\) == "INTERNET"\)/);
 assert.match(leader, /cross_network_liveness_v1/);
 assert.match(leader, /HasFreshCommonPrimaryLease\(\)/);
 assert.match(leader, /if \(commonProtocolProof\)/);
 assert.match(leader, /return Math\.Max\(1000, FailoverAfterMs - \(int\)Math\.Min\(FailoverAfterMs, ageMs\)\)/);
 assert.match(leader, /RtdbPrimaryProbeStatus\.UNAVAILABLE/);
 assert.match(network, /var mode = "UNKNOWN"/);
 assert.match(network, /_cachedNetworkMode = "UNKNOWN"/);
 assert.match(network, /NotifyNetworkChange\(\)/);
 assert.match(network, /epoch == _networkModeEpoch/);
 assert.match(network, /OfficeProfiles\(\)/);
});
test("D169 VPS account-first return is CAS fenced and exact owner-approved", () => {
 const vps = source("relay-agent/FirestoreVpsReclaim.cs");
 const features = source("relay-agent/D157AgentFeatures.cs");
 const realtime = source("relay-agent/FirestoreD157Realtime.cs");
 assert.match(vps, /string\.Equals\(\(session\.LoginName/);
 assert.match(vps, /"vps", StringComparison\.OrdinalIgnoreCase/);
 assert.match(vps, /RequestCadenceMs = 15L \* 60L \* 1000L/);
 assert.match(vps, /currentDocument\.updateTime/);
 assert.match(vps, /session\.AppUserId/);
 assert.match(leader, /_vpsReclaim\.PublishReady\(session, _instanceId, _wmsReady\(\)\)/);
 assert.match(leader, /_vpsReclaim\.TryRequest\(session, _instanceId/);
 assert.match(leader, /_vpsReclaim\.GetReady\(session\)/);
 assert.match(leader, /_vpsReclaim\.GetRequest\(session\)/);
 assert.match(leader, /NowMs\(\) - _preferredReadySinceMs < 30000/);
 assert.match(leader, /TryWriteRoles\(session, next, roles, manualHold\)/);
 assert.match(leader, /_canSafelyHandoff\(\)/);
 assert.match(features, /HandleD169VpsConsentEvent/);
 assert.match(features, /new FirestoreVpsReclaim/);
 assert.match(features, /popup\.Show\(\)/);
 assert.match(leader, /D169 VPS owner REST fallback=DEFER/);
 assert.match(leader, /_adminConsentObserved\(pending\)/);
 assert.match(leader, /PublishReady\(session, _instanceId, false\)/);
 assert.match(leader, /_role != FirestoreAgentRole\.PRIMARY &&/);
 assert.match(vps, /age <= 30000/);
 assert.match(rules, /ready_at_ms >= request\.time\.toMillis\(\) - 30000/);
 assert.doesNotMatch(features, /_d169PinTargetAsVps/);
 assert.match(realtime, /FirestoreVpsReclaimDocumentName/);
 assert.match(rules, /function isExactPrimaryApprover|function isPrimaryApprover/);
 assert.match(rules, /request\.auth\.token\.email in/);
 assert.match(rules, /resource\.data\.created_at_ms \+ 900000/);
 assert.match(rules, /docId != 'vps_reclaim'/);
});
test("D169 same-ID recovery needs authenticated versioned Agent marker and preserves 20s normal wait", () => {
 assert.match(relay, /"recovery_protocol" to 1/);
 assert.match(relay, /TOTAL_WAIT_MS = 20_000L/);
 assert.match(relay, /VERIFIED_FAILOVER_WAIT_MS = 35_000L/);
 assert.match(relay, /recoveryProofSeen\.get\(\)/);
 assert.match(transport, /RecoveryProtocol == 1/);
 assert.match(transport, /TryGrantSameRequestRecovery/);
 assert.match(transport, /currentDocument\.updateTime/);
 assert.match(transport, /NormalPendingAgeMs = 20000L/);
 assert.match(pipeline, /work\.RecoveryAuthorized \? 29000L : 12000L/);
 assert.match(rules, /resource\.data\.recovery_protocol == 1/);
 assert.match(rules, /primary_agent_instance_id/);
 assert.match(rules, /recovery_granted_at_ms/);
});

test("D169 recovery never extends wait based on an unverified local Firestore cache", () => {
 assert.match(relay, /snapshot\.metadata\.isFromCache/);
 assert.match(relay, /isVerifiedRecoveryGrant\(latest, requestId, identity\)/);
 assert.match(relay, /doc\.get\(Source\.SERVER\), 4, TimeUnit\.SECONDS/);
 assert.match(relay, /recoveryServerReadAttempted = true/);
 assert.match(relay, /snapshot\.getString\("request_id"\) != requestId/);
 assert.doesNotMatch(relay, /hệ thống sẽ tự chuyển Agent dự phòng nếu cần/);
});
test("D169 existing Beta Firestore recovery update can never edit terminal ACK or unrelated fields", () => {
 assert.match(rules, /request\.resource\.data\.status == 'PENDING'/);
 assert.match(rules, /!resource\.data\.keys\(\)\.hasAny\(\['recovery_generation'\]\)/);
 assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/relay_poc_coordination\/roles\)/);
 assert.match(transport, /doc\.Work\.RecoveryProtocol != 1/);
 assert.match(transport, /VerifyPrimaryForBusinessIngress\(session\)/);
});

test("D169 WMS-session-loss handoff carries same-job CAS generation evidence, never a manual handoff guess", () => {
 assert.match(leader, /TryWriteRoles\(session, relinquish, read, false, true\)/);
 assert.match(leader, /wms_handoff_generation/);
 assert.match(leader, /IsVerifiedWmsHandoff\(snapshot, read\)/);
 assert.match(leader, /DateTimeOffset\.TryParse\(read\.UpdateTime, out when\)/);
 assert.match(leader, /_role != FirestoreAgentRole\.NEXT_A/);
 assert.match(leader, /_verifiedAutomaticTakeoverAtMs = NowMs\(\)/);
});
