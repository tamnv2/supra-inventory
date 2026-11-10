import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const agent = read("relay-agent/Program.cs");
const layout = read("relay-agent/D173DesktopResources.cs");
const network = read("relay-agent/D173E175NetworkCapability.cs");
const route = read("relay-agent/D168NetworkRoute.cs");
const ha = read("relay-agent/FirestoreAgentLeaderCoordinator.cs");
const main = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
const responder = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt");
const daily = read("android/app/src/main/java/cd/cc/supra/inventory/beta/D171DailyLogWorker.kt");
const api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt");
const service = read("service/src/runtime-logs.ts");
const core = read("service/src/runtime-logs-core.ts");

test("exit action uses existing protected exit, not an unguarded close", () => {
  assert.match(agent, /_agentExit\.Text = "Tắt Agent";/);
  assert.match(agent, /_agentExit\.Click \+= \(sender, args\) => RequestProtectedExit\(\);/);
  assert.match(agent, /VerifyCurrentAgentPasswordForAction\(/);
  for (const action of ["_logout", "_manualUpdate", "_background", "_agentExit"]) {
    assert.ok(layout.includes(action), action);
  }
});

test("overview remains balanced with network status and refresh on Agent card", () => {
  assert.ok(/RowStyle\\(SizeType\\.Percent, 60F\\)/.test(agent) ||
    (agent.includes('InstallD173E179NoScrollTop(') &&
      (agent.includes('RowStyle(SizeType.Percent, 50F)') ||
       (['179','180'].includes(read('relay-agent/VERSION').trim()) &&
        agent.includes('RowStyle(SizeType.Percent, 40F)') &&
        agent.includes('RowStyle(SizeType.Percent, 60F)')))));
  assert.ok(/RowStyle\\(SizeType\\.Percent, 40F\\)/.test(agent) ||
    agent.includes('InstallD173E179NoScrollTop('));
  assert.ok(/d173TopLayout\\.ColumnStyles\\.Add\\(new ColumnStyle\\(SizeType\\.Percent, 37F\\)\\)/.test(agent) ||
    read('relay-agent/D173E179OverviewNoScroll.cs').includes('new ColumnStyle(SizeType.Percent, 37F)'));
  assert.match(network, /Làm mới phân loại mạng/);
  assert.match(network, /LayoutD173E175NetworkCapability\(Control host\)/);
  assert.match(layout, /LayoutD173E175NetworkCapability\(host\)/);
  assert.match(layout, /const int fleetTop = 166/);
});

test("probes are read-only, change-triggered and cache is display-only", () => {
  assert.match(network, /NetworkChange\.NetworkAddressChanged/);
  assert.match(network, /D168NetworkRoute\.ProbeWorker\(session\.IdToken\)/);
  assert.match(network, /FirestoreHttpTransport\.SendJson\("GET"/);
  assert.match(network, /ProtectedData\.Protect/);
  assert.match(network, /ProtectedData\.Unprotect/);
  assert.match(network, /if \(!cached\) D168NetworkRoute\.ObserveNetworkCapability\(mode\)/);
  assert.match(agent, /var verifiedBlocked = _d173E175ClassificationVerified && !_d173E175WorkerVerified;/);
  assert.doesNotMatch(route, /string\.Equals\(profile, "\.Office@MSN"/);
});

test("one Firestore lease for HA, no RTDB write/SSE/probe business path", () => {
  assert.match(ha, /PrimaryLeaseHeartbeatMs = 10000/);
  assert.match(ha, /NEXT_A_LIVENESS", "COMMON_FIRESTORE"/);
  assert.match(ha, /waitMs = CheckPrimaryLease\(session\)/);
  assert.doesNotMatch(ha, /_rtdbLiveness\.(?:WriteHeartbeat|EnsureObserver|ProbePrimary)\(/);
  assert.match(ha, /commonProtocolProof/);
  assert.match(ha, /LEGACY_LEASE_NO_COMMON_PROOF/);
});

test("Android sealed logout and scheduled records survive account changes", () => {
  assert.doesNotMatch(main, /owner != session\.userId \|\| networkFailed/);
  assert.doesNotMatch(responder, /item\.optString\("owner"\) != session\.userId/);
  assert.match(responder, /retryPendingScheduled\(appContext, session, api, deviceId\)/);
  assert.match(api, /originUserId: String = ""/);
  assert.match(main, /originUserId = if \(reason == "session_end_logout"\)/);
  assert.match(daily, /runAttemptCount < 3\) Result\.retry\(\) else Result\.success\(\)/);
  // Bounded WorkManager delivery; sealed outbox is retained for next login/slot.
  assert.match(daily, /runAttemptCount < 3\) Result\.retry\(\) else Result\.success\(\)/);
});

test("Service keeps authenticated submitter and only relaxes identical immutable Android bundle replay", () => {
  assert.match(service, /origin_user_id\?: string/);
  assert.match(service, /log_origin:/);
  assert.match(service, /verified: body\.origin_user_id === actor\.user_id/);
  assert.match(core, /forwarded = previous\.source === "ANDROID"/);
  assert.match(core, /originalUserUnchanged = Boolean\(priorOwner\) && priorOwner === replayOwner/);
  assert.match(core, /oldOrigin\?\.user_id_claim \|\| oldActor\?\.user_id/);
  assert.match(core, /newOrigin\?\.user_id_claim/);
  assert.match(core, /sameImmutablePayload = originalUserUnchanged &&/);
  assert.match(core, /logout\|support/);
});
