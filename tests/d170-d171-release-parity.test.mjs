import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("D170 and D171 next signed fleet shares one official origin and original Firebase identity", () => {
  const android = read("android/app/build.gradle.kts");
  const agent = read("relay-agent/AgentConfig.cs");
  const web = read("web/src/web-version.ts");
  const worker = read("service/wrangler.beta.toml");
  const workflow = read(".github/workflows/verify-apps.yml");
  assert.match(android, /API_BASE_URL", quoted\("https:\/\/inventory\.supra\.cc\.cd"\)/);
  assert.match(android, /UPDATE_RELEASE_API", quoted\("https:\/\/inventory\.supra\.cc\.cd\/downloads\/pda\/manifest"\)/);
  assert.match(android, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(agent, /AgentBuild = 140/);
  assert.match(agent, /ApiBaseUrl = "https:\/\/inventory\.supra\.cc\.cd"/);
  assert.equal(read("relay-agent/VERSION").trim(), "140");
  assert.match(web, /WEB_VERSION = "3\.1\.2"/);
  assert.match(workflow, /beta-vc/);
  // D170 OAuth Worker config ships through predecessor PR657, never from D171 code-only.
  assert.match(worker, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.match(worker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.match(worker, /APP_ENV = "beta"/);
  assert.match(worker, /name = "supra-inventory-beta"/);
});

test("one Business SQLite, legacy update compatibility, no public duplicate Stable Worker", () => {
  const worker = read("service/wrangler.beta.toml");
  const receipt = JSON.parse(read("ops/d170-release-authorization.json"));
  const app = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const api = read("service/src/index.ts");
  const webUI = read("web/src/operational-app.ts");
  assert.match(worker, /class_name = "InventoryCore"/);
  assert.match(worker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.match(worker, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.doesNotMatch(worker, /name = "supra-inventory-stable"/);
  assert.match(api, /channel: "beta"/); // wire compatibility, not a public multi-mode selector
  assert.match(app, /\^beta-vc/); // signature/version gate for existing installed clients
  assert.match(webUI, /Chính thức · hoạt động/);
  assert.doesNotMatch(webUI, /Beta · hoạt động/);
  assert.equal(receipt.stable_worker_deploy_permission, false);
  assert.equal(receipt.domain_reassignment_permission, false);
});

test("D171 two slots stay integrated with official Web312 and Android WorkManager", () => {
  const log = read("relay-agent/AgentLogUploadBridge.cs");
  const worker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/D171DailyLogWorker.kt");
  const runtime = read("web/src/runtime-logger.ts");
  assert.match(log, /new TimeSpan\(13, 15, 0\)/);
  assert.match(log, /new TimeSpan\(21, 15, 0\)/);
  assert.match(worker, /listOf\("1315", "2115"\)/);
  assert.match(runtime, /"1315"/);
  assert.match(runtime, /"2115"/);
  assert.match(log, /ConfirmFallbackDriveSynced/);
});


test("D170 deployed OAuth official-origin check cannot be lost in D171 code-only source", () => {
  const service = read("service/src/index.ts");
  const android = read("android/app/build.gradle.kts");
  const web = read("web/src/operational-app.ts");
  assert.match(service, /configuredCallback\.origin === url\.origin/);
  assert.match(service, /oauth_callback_origin_mismatch/);
  assert.match(service, /state !== expectedState/);
  assert.match(service, /const trustedHosts = \["inventory\.supra\.cc\.cd", "inventory-beta\.supra\.cc\.cd"\]/);
  assert.match(android, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(web, /Chính thức · hoạt động/);
  assert.doesNotMatch(web, /Beta · hoạt động/);
});

test("D170/D171 official Gateway host and user-facing one-Production label without legacy Stable", () => {
  const gateway = read("ops/apps-script/agent-log-gateway/Code.gs");
  const webUi = read("web/src/operational-app.ts");
  assert.match(gateway, /https:\/\/inventory\.supra\.cc\.cd\/api\/agent\/support-log-request/);
  assert.match(gateway, /https:\/\/inventory\.supra\.cc\.cd\/api\/agent\/log-day-folder/);
  assert.match(gateway, /https:\/\/inventory\.supra\.cc\.cd.*\/api\/agent\/d167\/skus\//);
  assert.doesNotMatch(gateway, /inventory-beta\.supra\.cc\.cd/);
  assert.doesNotMatch(webUi, /kịch bản; Stable; tài khoản WMS/);
  assert.match(webUi, /Chính thức · hoạt động/);
});

test("D170 public manual APK download filename is Beta-free while legacy OTA asset remains stable", () => {
  const appTools = read("service/src/app-tools.ts");
  const service = read("service/src/index.ts");
  const web = read("web/src/operational-app.ts");
  const workflow = read(".github/workflows/verify-apps.yml");
  assert.match(appTools, /PDA_ASSET_NAME = "supra-inventory-beta\.apk"/);
  assert.match(appTools, /PDA_PUBLIC_ASSET_URL = .*1291-Bao-Hang\.apk/);
  assert.match(appTools, /export function redirectPublicPdaApk/);
  assert.match(service, /url\.pathname === "\/downloads\/pda\/public"/);
  assert.match(service, /return redirectPublicPdaApk\(\)/);
  assert.match(web, /\/downloads\/pda\/public/);
  assert.doesNotMatch(web, /pdaAppRelease\?\.stable_download_path \|\| "\/downloads\/pda\/latest"/);
  assert.match(workflow, /cp android\/dist\/supra-inventory-beta\.apk android\/dist\/1291-Bao-Hang\.apk/);
  assert.match(workflow, /cmp android\/dist\/supra-inventory-beta\.apk android\/dist\/1291-Bao-Hang\.apk/);
  assert.match(workflow, /gh release upload "\$channel" [^\n]*1291-Bao-Hang\.apk/);
  assert.doesNotMatch(appTools, /1291 Beta \$\{tag\}/);
});
