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
  assert.doesNotMatch(worker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
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
  assert.doesNotMatch(worker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
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
  assert.match(service, /const trustedHosts = \["inventory\.supra\.cc\.cd"\]/);
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

test("D171 signed Android rollout never borrows D169-only runtime permission", () => {
  const workflow = read(".github/workflows/verify-apps.yml");
  const receipt = JSON.parse(read("ops/d171-release-authorization.json"));
  assert.equal(receipt.change_id, "D171");
  assert.equal(receipt.status, "OWNER_EXPLICIT_DEPLOY_APPROVED");
  const historical = workflow.split("- name: D169-E061 verified prior Beta runtime compatibility for Android-only release")[1].split("- name: Require successful Beta runtime gate for this source")[0];
  assert.match(historical, /d171_scope=.*ops\/d171-release-authorization\.json/);
  assert.match(historical, /python3 tools\/d167_release_gate\.py --component android/);
  assert.ok(historical.indexOf("ops/d171-release-authorization.json") < historical.indexOf("ops/d169-release-authorization.json"));
  assert.match(historical, /D169_E061_ANDROID_RESUME_BETA_ONLY/);
  const guard = workflow.split("- name: D169 require Firestore Rules and Agent v136 before Android release")[1].split("- name: Publish signed Beta auto-update release")[0];
  assert.match(guard, /c8f58ce79f0ac4d59cdf547649e3f3a412e6d073/);
  assert.match(guard, /git diff --quiet "\$agent_sha" "\$GITHUB_SHA" -- relay-agent\/ relay-agent-webview2-host\//);
  assert.match(guard, /gh run list --workflow verify-relay-agent\.yml --commit "\$GITHUB_SHA"/);
  assert.match(guard, /\[ "\$outcome" = "success" \]/);
  const worker = workflow.split("- name: Require successful Beta runtime gate for this source")[1];
  assert.match(worker, /gh run list --workflow deploy-beta\.yml --commit "\$GITHUB_SHA"/);
  const gateway = read(".github/workflows/deploy-beta-agent-gateway.yml");
  assert.match(gateway, /push:[\s\S]*?\.github\/workflows\/verify-apps\.yml/);
  const firestore = read(".github/workflows/deploy-beta-firestore.yml");
  assert.match(firestore, /push:[\s\S]*?\.github\/workflows\/verify-apps\.yml/);
});

test("D171 receipt-only release reconnects all dependency workflows without reducing Owner protection", () => {
  for (const name of [
    "deploy-beta-agent-gateway.yml",
    "deploy-beta-firestore.yml",
    "deploy-beta.yml",
    "verify-relay-agent.yml",
    "verify-apps.yml",
  ]) {
    const content = read(".github/workflows/" + name);
    assert.match(content, /push:[\s\S]*?ops\/d171-release-authorization\.json/, name + " must trigger approved same-SHA release");
  }
  const guard = read("tools/d167_release_gate.py");
  assert.match(guard, /git\("diff", "--name-only", sha, "HEAD", "--", \*PROTECTED\)/);
  const receipt = JSON.parse(read("ops/d171-release-authorization.json"));
  assert.equal(receipt.change_id, "D171");
  assert.equal(receipt.status, "OWNER_EXPLICIT_DEPLOY_APPROVED");
  assert.equal(receipt.stable_deploy_permission, false);
});
