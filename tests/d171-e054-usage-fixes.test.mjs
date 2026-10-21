import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("D171 E054 server-created request-age guard", () => {
  const agent = read("relay-agent/D160ConfirmPipeline.cs");
  const p = agent.split("private static long D160RequestAgeMs(")[1].split("private static bool D160CanStartMutation(")[0];
  assert.ok(p.includes("work.CreatedAtMs"));
  assert.ok(!p.includes("work.ClientSentAtMs > 0"));
  assert.ok(agent.includes("29000L : 12000L"));
  assert.ok(read("firebase/firestore.rules").includes("request.resource.data.created_at == request.time"));
});

test("D171 E054 terminal result receipt is account scoped", () => {
  const ui = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt");
  assert.ok(ui.includes("quarantineResultReceipt("));
  assert.ok(ui.includes('error.code == "RESULT_ACK_NOT_FOUND"'));
  assert.ok(ui.includes("api.session?.userId != owner.userId"));
  assert.ok(store.includes('scopedAckKey(userId, "received_terminal_404")'));
  assert.ok(ui.includes('api.markResultStage(eventId, "DISPLAYED")'));
  assert.ok(!ui.includes("api.acknowledgeResult(eventId)"));
});

test("D171 E054 Reporter in-flight counters are not reused across accounts", () => {
  const api = read("web/src/api.ts");
  assert.ok(api.includes("existing.owner === owner && existing.path === path"));
  assert.ok(api.includes("reporterCountersInFlight?.promise === pending"));
});

test("D171 E056: FCM RECEIVED pending is never replayed across Picker accounts", () => {
  const store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt");
  const activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  // E058 supersedes FCM-at-arrival RECEIVED: proof starts on actual draw.
  assert.match(store, /fun markResultDisplayPending\(/);
  assert.match(store, /scopedAckKey\(userId, RESULT_RECEIPT_PENDING\)/);
  assert.match(store, /fun pendingResultEvents\(context: Context, userId: String\)/);
  assert.match(store, /scopedAckKey\(userId, RESULT_RECEIPT_PENDING\)/);
  assert.match(activity, /pendingResultEvents\(applicationContext, owner\.userId\)/);
  assert.match(activity, /clearResultEvent\(applicationContext, eventId, owner\.userId\)/);
  assert.doesNotMatch(store, /getStringSet\(KEY_RESULT_EVENTS,/);
  assert.doesNotMatch(activity, /pendingResultEvents\(applicationContext\)/);
});

test("D171 E056: single-Picker Office fallback retains exact Worker authority and request ID", () => {
  const agent = read("relay-agent/D160Resilience.cs");
  const gateway = read("ops/apps-script/agent-log-gateway/Code.gs");
  assert.match(agent, /response == null && TryD160SinglePickerRevokeThroughGateway/);
  assert.match(agent, /D165PostThroughGateway\("agent_picker_revoke_one", fields/);
  assert.match(agent, /"request_id", requestId/);
  assert.match(agent, /"revoked_generation", Math\.Max\(1L, picker\.SessionGeneration\)/);
  assert.match(agent, /"GATEWAY_REVOKE_TARGET_MISMATCH"/);
  assert.match(agent, /"GATEWAY_REVOKE_PROOF_MISSING"/);
  assert.match(gateway, /const auth = validateIdToken_\(idToken\)/);
  assert.match(gateway, /action === 'agent_picker_revoke_one'/);
  assert.match(gateway, /proxyWorkerJson_\('\/api\/agent\/picker-session\/revoke'/);
  assert.match(gateway, /Number\.isSafeInteger\(generation\)/);
  assert.match(gateway, /INVALID_SINGLE_REVOKE_REQUEST/);
});

test("D170 E056: staged APK version-name migration accepts old signed OTA, without changing release vc115", () => {
  const activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const ci = read(".github/workflows/verify-apps.yml");
  assert.match(activity, /val legacyName = "0\.2\.0-beta\.\$\{info\.versionCode\}"/);
  assert.match(activity, /val officialName = "0\.2\.0\.\$\{info\.versionCode\}"/);
  assert.match(activity, /archive\.versionName != legacyName && archive\.versionName != officialName/);
  assert.match(activity, /info\.tag != "beta-vc\$\{info\.versionCode\}"/);
  assert.match(ci, /APP_VERSION_NAME=0\.2\.0-beta\.\$next/);
  assert.match(read("android/app/src/main/res/values/strings.xml"), /1291 Báo hàng/);
});

test("D171 E062: VPS role parity and Picker online list convergence", () => {
  const agent = read("relay-agent/D161AdminControl.cs");
  const support = read("relay-agent/D161SupportLogControl.cs");
  const service = read("service/src/index.ts");
  const roster = read("relay-agent/D119AgentFeatures.cs");
  const program = read("relay-agent/Program.cs");
  assert.match(agent, /login == "admin" \|\| login == "tamnv2" \|\| login == "vps"/);
  assert.match(support, /IsD161PrivilegedAgentLogin\(session\)/);
  assert.equal((service.match(/\["admin", "tamnv2", "vps"\]\.includes\(login\)/g) || []).length, 2);
  assert.match(agent, /targetCount <= 0[\s\S]*BULK_PREVIEW_ZERO_RECONCILE/);
  assert.match(roster, /item\.SessionGeneration > Math\.Max\(0L, removedGeneration\)/);
  assert.match(roster, /"vps", StringComparison\.OrdinalIgnoreCase/);
  assert.doesNotMatch(program.split("// Kết nối")[1].split("// Nhật ký")[0], /InitializeD168WorkerWifiControls\(networkCard\)/);
  assert.match(program, /Cấu hình mạng dự phòng SKU/);
  const reclaim = read("relay-agent/FirestoreVpsReclaim.cs").split("internal static bool IsOwner")[1].split("private static bool IsRealAgentRole")[0];
  assert.doesNotMatch(reclaim, /"vps"/); // no VPS self-approval of protected PRIMARY transfer
});
