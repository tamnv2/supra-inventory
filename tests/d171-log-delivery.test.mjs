import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("D171 Agent two VN slots, bounded jitter, retry and Drive-only prune", () => {
  const bridge = read("relay-agent/AgentLogUploadBridge.cs");
  const program = read("relay-agent/Program.cs");
  assert.match(bridge, /new TimeSpan\(13, 15, 0\)/);
  assert.match(bridge, /new TimeSpan\(21, 15, 0\)/);
  assert.match(bridge, /hash % 901/);
  assert.match(bridge, /MaxTimedAttemptsPerSlot = 4/);
  assert.match(bridge, /_nextUploadAttemptUtc=DateTime\.UtcNow\.AddMinutes\(15\)/);
  assert.match(bridge, /drive_confirmed=true/);
  assert.match(bridge, /Firestore acceptance is staging only/);
  assert.match(program, /ShouldRunScheduledOrRetry/);
  assert.doesNotMatch(program, /_lastD168Log2145AttemptDate/);
});

test("D171 Firestore staged logs keep 15-minute receipt retry without early prune", () => {
  const bridge = read("relay-agent/AgentLogUploadBridge.cs");
  assert.match(bridge, /bool fallbackReceiptPending = false/);
  assert.match(bridge, /fallbackReceiptPending = true/);
  assert.match(bridge, /if \(fallbackReceiptPending && _nextUploadAttemptUtc == DateTime.MinValue\)[\s\S]*?RegisterUploadFailure\(\)/);
  assert.match(bridge, /Firestore acceptance is staging only/);
  assert.match(bridge, /ConfirmFallbackDriveSynced/);
});

test("D171 Android WorkManager two daily slots and immutable Drive-bound archive", () => {
  const worker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/D171DailyLogWorker.kt");
  const responder = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt");
  const activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const gradle = read("android/app/build.gradle.kts");
  assert.match(worker, /listOf\("1315", "2115"\)/);
  assert.match(worker, /NetworkType\.CONNECTED/);
  assert.match(worker, /ExistingWorkPolicy\.KEEP/);
  assert.match(worker, /15L, TimeUnit\.MINUTES/);
  assert.match(worker, /runAttemptCount < 3/);
  assert.match(worker, /scheduleTomorrow/);
  assert.match(activity, /D171DailyLogSchedule\.schedule\(applicationContext\)/);
  assert.match(gradle, /androidx\.work:work-runtime-ktx/);
  assert.match(responder, /savedKey = "d171_daily_payload_/);
  assert.match(responder, /sealedPayload = if \(savedPayload/);
  assert.match(responder, /retryPendingLogout/);
  assert.match(responder, /archive_status"\) == "DRIVE_SYNCED"/);
  assert.doesNotMatch(worker, /AlarmManager|setExactAndAllowWhileIdle|Thread\.sleep/);
});

test("D171 Web 3.1.2 local journal retry and server-only cron with no browser", () => {
  const web = read("web/src/runtime-logger.ts");
  const ver = read("web/src/web-version.ts");
  const service = read("service/src/index.ts");
  assert.match(ver, /WEB_VERSION = "3\.2\.0"/);
  assert.match(web, /SLOT_RETRY_MS = 15 \* 60_000/);
  assert.match(web, /MAX_SLOT_ATTEMPTS = 4/);
  assert.match(web, /"2115"/);
  assert.match(web, /"1315"/);
  assert.match(web, /sealedPayload: sealed\.payload/);
  assert.match(web, /archive_status === "DRIVE_SYNCED"/);
  assert.match(service, /getUTCHours\(\) === 6/);
  assert.match(service, /getUTCHours\(\) === 14/);
  assert.match(service, /SERVER_ONLY_NO_BROWSER_SESSION/);
  assert.match(service, /uploadRuntimeLog\(env/);
});

test("D171 Office Agent transport remains Worker-authoritative and fail-closed", () => {
  const agent = read("relay-agent/D161AdminControl.cs");
  const gateway = read("ops/apps-script/agent-log-gateway/Code.gs");
  assert.match(agent, /agent_picker_revoke_all_preview/);
  assert.match(agent, /agent_picker_revoke_all/);
  assert.match(agent, /request_support_logs/);
  assert.match(agent, /A Worker[\s\S]{0,70}401\/403 never triggers this fallback/);
  assert.match(agent, /status == 200/);
  assert.match(gateway, /validateIdToken_\(idToken\)/);
  assert.match(gateway, /INVALID_BULK_REQUEST_ID/);
  assert.match(gateway, /proxyWorkerGet_\('\/api\/agent\/picker-session\/revoke-all-preview'/);
  assert.match(gateway, /proxyWorkerJson_\('\/api\/agent\/picker-session\/revoke-all'/);
});
