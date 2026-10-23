import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const official = "inventory.supra.cc.cd";
const oldHost = "inventory-beta.supra.cc.cd";

test("D173 E009 supported Inventory Android vc117 stays on official API and signed OTA channel", () => {
  const build = read("android/app/build.gradle.kts");
  const main = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  assert.ok(build.includes('API_BASE_URL", quoted("https://' + official + '")'));
  assert.ok(build.includes('UPDATE_RELEASE_API", quoted("https://' + official + '/downloads/pda/manifest")'));
  assert.ok(build.includes('applicationId = "cd.cc.supra.inventory.beta"'));
  assert.ok(build.includes('FIREBASE_PROJECT_ID", quoted("supra-inventory-beta")'));
  assert.ok(main.includes('^beta-vc'));
  assert.ok(main.includes("GET_SIGNING_CERTIFICATES"));
});

test("D173 E009 Agent v140 uses official API and updater, technical Firebase identity retained", () => {
  const config = read("relay-agent/AgentConfig.cs");
  assert.ok(config.includes('ApiBaseUrl = "https://' + official + '"'));
  assert.ok(config.includes('AgentUpdateManifestUrl = ApiBaseUrl + "/downloads/agent/manifest"'));
  assert.ok(config.includes('FirebaseProjectId = "supra-inventory-beta"'));
  assert.ok(config.includes('AgentReleaseTagPrefix = "relay-agent-v"'));
});

test("D173 E009 Web 3.1.2 same-origin API and websocket stay bound to official host", () => {
  const api = read("web/src/api.ts");
  const realtime = read("web/src/realtime-client.ts");
  const deploy = read(".github/workflows/deploy-beta.yml");
  assert.ok(api.includes('import.meta.env.VITE_API_BASE_URL || ""'));
  assert.ok(realtime.includes("window.location.origin"));
  assert.ok(deploy.includes('VITE_API_BASE_URL: ""'));
});

test("D173 E009 Production release health gates no longer depend on old hostname variable", () => {
  for (const path of [".github/workflows/deploy-beta.yml", ".github/workflows/verify-relay-agent.yml"]) {
    const workflow = read(path);
    assert.ok(workflow.includes("PRODUCTION_HOSTNAME: " + official), path + " official hostname missing");
    assert.ok(!workflow.includes("vars.BETA_HOSTNAME"), path + " still uses old-host GitHub variable");
    assert.ok(!workflow.includes("${BETA_HOSTNAME}"), path + " still interpolates legacy host");
    assert.ok(!workflow.includes("$env:BETA_HOSTNAME"), path + " still interpolates legacy host");
  }
});

test("D173 E009 retains current shared Worker, DO and both routes pending provider proof", () => {
  const wrangler = read("service/wrangler.beta.toml");
  assert.ok(wrangler.includes('name = "supra-inventory-beta"'));
  assert.ok(wrangler.includes('pattern = "' + official + '"'));
  assert.ok(wrangler.includes('pattern = "' + oldHost + '"'));
  assert.ok(wrangler.includes('name = "INVENTORY_CORE"'));
  assert.ok(wrangler.includes('class_name = "InventoryCore"'));
  assert.ok(wrangler.includes('APP_ENV = "beta"'));
  assert.ok(wrangler.includes('GOOGLE_DRIVE_OAUTH_REDIRECT_URI = "https://' + official + '/api/oauth/google/callback"'));
});

test("D173 E009 OBPP v8 remains separate and official-host-only for API with independent GitHub OTA", () => {
  const obpp = read("obpp1291/android/app/build.gradle.kts");
  const ota = read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppUpdateManager.kt");
  const api = read("service/src/index.ts");
  assert.ok(obpp.includes('applicationId = "cd.cc.supra.obpp1291"'));
  assert.ok(obpp.includes('OBPP_API_BASE_URL').valueOf());
  assert.ok(obpp.includes("https://" + official));
  assert.ok(ota.includes("/releases/download/obpp1291-latest/obpp1291-latest.json"));
  assert.ok(api.includes('url.pathname.startsWith("/api/obpp1291/")'));
});

test("D173 E009 preserves D170 legacy OAuth bridge negative test until separately approved detach", () => {
  const deploy = read(".github/workflows/deploy-beta.yml");
  assert.ok(deploy.includes("https://inventory-beta.supra.cc.cd/api/oauth/google/start"));
  assert.ok(deploy.includes("https://inventory-beta.supra.cc.cd/api/oauth/google/callback?code=invalid_ci_probe"));
  assert.ok(deploy.includes("D170_OFFICIAL_AND_LEGACY_SAME_WORKER_SOURCE_PASS"));
});

test("D173 E009 old-host retirement remains blocked pending a separate Owner/provider receipt", () => {
  const wrangler = read("service/wrangler.beta.toml");
  const cutover = read("tools/d170_domain_cutover.sh");
  const d170 = read("tests/d170-domain-cutover.test.mjs");
  assert.ok(wrangler.includes(oldHost));
  assert.ok(cutover.includes(oldHost));
  assert.ok(d170.includes("inventory-beta"));
  const stable = read("service/wrangler.stable.toml");
  assert.ok(stable.includes('name = "supra-inventory-stable"'));
});
