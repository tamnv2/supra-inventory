import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const wrangler = read("service/wrangler.beta.toml");
const service = read("service/src/index.ts");
const script = read("tools/d173_e019_detach_custom_domain.sh");
const gate = read("tools/d173_e019_release_gate.py");
const flow = read(".github/workflows/d173-e019-host-only-retirement.yml");

test("Only legacy custom domain is retired in source, not the Production Worker, DO, Firebase, or signer", () => {
  assert.match(wrangler, /^name = "supra-inventory-beta"$/m);
  assert.match(wrangler, /^pattern = "inventory.supra.cc.cd"$/m);
  assert.doesNotMatch(wrangler, /^pattern = "inventory-beta.supra.cc.cd"$/m);
  assert.match(wrangler, /name = "INVENTORY_CORE"/);
  assert.match(wrangler, /class_name = "InventoryCore"/);
  assert.match(wrangler, /APP_ENV = "beta"/);
  assert.match(wrangler, /FIREBASE_PROJECT_ID = "supra-inventory-beta"/);
  assert.match(wrangler, /PROJECT_MAIL_SENDER = "no-reply@supra.cc.cd"/);
  assert.match(wrangler, /GOOGLE_DRIVE_OAUTH_REDIRECT_URI = "https:\/\/inventory.supra.cc.cd\/api\/oauth\/google\/callback"/);
  const android = read("android/app/build.gradle.kts");
  assert.match(android, /applicationId = "cd.cc.supra.inventory.beta"/);
});

test("Google OAuth continues same-origin only on official host with no code exchange on wrong origin", () => {
  assert.match(service, /const trustedHosts = \["inventory.supra.cc.cd"\]/);
  assert.match(service, /configuredCallback.origin === url.origin/);
  assert.match(service, /oauth_callback_origin_mismatch/);
  assert.match(service, /state !== expectedState/);
});

test("Current deployment, Android, Agent and D161 checks no longer depend on old hostname", () => {
  for (const path of [
    ".github/workflows/d161-runtime-readiness.yml",
    ".github/workflows/d161-phase0a-continuation.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/verify-apps.yml",
    ".github/workflows/verify-d166-postrelease-channel.yml",
  ]) {
    const content = read(path);
    assert.match(content, /inventory.supra.cc.cd/);
    assert.doesNotMatch(content, /BETA_HOSTNAME: \$\{\{ vars.BETA_HOSTNAME \}\}/);
    if (!path.includes("deploy-beta.yml")) {
      assert.doesNotMatch(content, /https:\/\/inventory-beta.supra.cc.cd/);
    }
  }
});

test("E019 release is one exact Owner-scoped old-host DETACH, not Worker deploy/DO/DNS deletion", () => {
  assert.match(flow, /ops\/d173-e019-host-detach-authorization.json/);
  assert.match(flow, /python3 tools\/d173_e019_release_gate.py/);
  assert.match(flow, /node --test tests\/d173-e019-host-sunset.test.mjs/);
  assert.match(flow, /github.event_name == 'push' && github.ref == 'refs\/heads\/main'/);
  assert.match(flow, /D173_E019_APPLY: "yes"/);
  assert.match(gate, /"approved_source_sha"/);
  assert.match(gate, /"approved_components": \["host-beta"\]/);
  assert.match(gate, /"keep_d172_pending_hold": True/);
  assert.match(gate, /"worker_script_deploy_permission": False/);
  assert.match(gate, /"stable_deploy_permission": False/);
  assert.match(script, /\$base\/\$old_id/);
  assert.match(script, /-X DELETE/);
  assert.match(script, /-X PUT/);
  assert.match(script, /D173_E019_PROVIDER_DETACH_PASS/);
  assert.match(script, /D173_E019_ROLLBACK/);
  assert.doesNotMatch(script, /workers\/scripts\/.+DELETE|dns\/records|DROP TABLE|wrangler delete/);
});

test("Read-only Cloudflare audit does not call /health or mutate data", () => {
  const early = script.split('if [[ "${D173_E019_APPLY:-no}" != "yes" ]]')[0];
  assert.match(early, /GET unavailable/);
  assert.doesNotMatch(early, /-X DELETE|-X PUT|\/health|d1\/|sqlite/);
  assert.match(flow, /D173_E019_APPLY=no bash/);
  assert.match(flow, /D173_E019_READONLY_PASS/);
});
