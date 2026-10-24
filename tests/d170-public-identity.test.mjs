import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const strings = read("android/app/src/main/res/values/strings.xml");
const main = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
const gradle = read("android/app/build.gradle.kts");
const tools = read("web/src/operational-app.ts");
const androidCi = read(".github/workflows/verify-apps.yml");
const worker = read("service/wrangler.beta.toml");

test("official Android launcher and in-app branding hide Beta", () => {
  assert.match(manifest, /android:label="1291 Báo hàng"/);
  assert.match(strings, /<string name="app_name">1291 Báo hàng<\/string>/);
  assert.doesNotMatch(manifest, /1291 Báo hàng Beta/);
  assert.doesNotMatch(main, /1291 Báo hàng Beta|Beta vc\$\{BuildConfig/);
  assert.match(main, /"vc\$\{BuildConfig\.VERSION_CODE\}/);
});

test("official public download UI does not advertise a Beta track", () => {
  assert.doesNotMatch(tools, /Beta · hoạt động/);
  assert.match(tools, /Chính thức · hoạt động/);
  assert.match(tools, /pdaAppRelease\?\.tag.*replace\(\/\^beta/);
});

test("existing signed app and updater remain in-place compatible", () => {
  assert.match(gradle, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(gradle, /BETA_SIGNER_SHA256/);
  assert.match(gradle, /https:\/\/inventory\.supra\.cc\.cd\/downloads\/pda\/manifest/);
  assert.match(main, /\^beta-vc/);
  assert.match(main, /0\.2\.0-beta\.\$\{info\.versionCode\}/);
  assert.match(androidCi, /tag="beta-vc\$\{APP_VERSION_CODE\}"/);
});

test("two public hostnames use same-origin HTTP and WebSocket without CORS changes", () => {
  const workflow = read(".github/workflows/deploy-beta.yml");
  const api = read("web/src/api.ts");
  const realtime = read("web/src/realtime-client.ts");
  assert.match(workflow, /VITE_API_BASE_URL: ""/);
  assert.match(api, /import\.meta\.env\.VITE_API_BASE_URL \|\| ""/);
  assert.match(realtime, /import\.meta\.env\.VITE_API_BASE_URL \|\| window\.location\.origin/);
});

test("public legal pages no longer expose a Beta product identity", () => {
  const pages = read("service/src/public-pages.ts");
  assert.doesNotMatch(pages, /SUPRA Inventory Beta|Phiên bản Beta/);
  assert.match(pages, /const appName = "SUPRA Inventory"/);
});

test("same authoritative Worker and durable storage remain untouched", () => {
  assert.match(worker, /name = "supra-inventory-beta"/);
  assert.match(worker, /class_name = "InventoryCore"/);
  assert.doesNotMatch(worker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.match(worker, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.doesNotMatch(androidCi, /title="1291 Báo hàng Beta/);
});

test("main release checks protect official identity and skip stale D169 Android gating", () => {
  const workerWorkflow = read(".github/workflows/deploy-beta.yml");
  const appWorkflow = read(".github/workflows/verify-apps.yml");
  const agentWorkflow = read(".github/workflows/verify-relay-agent.yml");
  const firestoreWorkflow = read(".github/workflows/deploy-beta-firestore.yml");
  assert.match(workerWorkflow, /grep -Fq 'SUPRA Inventory' "\$tmp"/);
  assert.match(workerWorkflow, /leaks legacy Beta branding/);
  assert.match(appWorkflow, /D170_ANDROID_LEGACY_RUNTIME_COMPAT != 'true'/);
  assert.match(agentWorkflow, /D170_PHASE1_EXISTING_WORKER_ANDROID:/);
  assert.match(firestoreWorkflow, /D170_PHASE1_EXISTING_WORKER_ANDROID:/);
});
