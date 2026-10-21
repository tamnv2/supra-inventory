import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("D170 E024 uses one existing production Worker and one official OAuth callback", () => {
  const config = read("service/wrangler.beta.toml");
  const scope = JSON.parse(read("ops/project-scope.json"));
  assert.match(config, /^GOOGLE_DRIVE_OAUTH_REDIRECT_URI = "https:\/\/inventory\.supra\.cc\.cd\/api\/oauth\/google\/callback"$/m);
  assert.match(config, /name = "supra-inventory-beta"/);
  assert.match(config, /APP_ENV = "beta"/);
  assert.match(config, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.match(config, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.doesNotMatch(config, /GOOGLE_DRIVE_OAUTH_CLIENT_SECRET\s*=|GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN\s*=/);
  assert.ok(scope.resources.some(r => r.key === "oauth-beta" && r.name === "inventory-beta-drive"));
  assert.ok(scope.resources.some(r => r.key === "worker-stable" && r.guard === "OWNER_GATED"));
});

test("D170 OAuth start redirects across legacy hosts; callback fails closed before token exchange", () => {
  const service = read("service/src/index.ts");
  assert.match(service, /const trustedHosts = \["inventory\.supra\.cc\.cd", "inventory-beta\.supra\.cc\.cd"\]/);
  assert.match(service, /location: `https:\/\/\$\{callbackHost\}\/api\/oauth\/google\/start`/);
  assert.match(service, /configuredCallback\.origin === url\.origin/);
  assert.match(service, /!configuredCallback\.search && !configuredCallback\.hash/);
  assert.match(service, /oauth_callback_origin_mismatch/);
  assert.match(service, /state !== expectedState/);
  assert.match(service, /SameSite=Lax/);
});

test("D170 preserves signed in-place app and Agent compatibility, never promotes old Stable", () => {
  const agent = read("relay-agent/AgentConfig.cs");
  const android = read("android/app/build.gradle.kts");
  const receipt = JSON.parse(read("ops/d170-release-authorization.json"));
  const workerFlow = read(".github/workflows/deploy-beta.yml");
  assert.match(agent, /ApiBaseUrl = "https:\/\/inventory\.supra\.cc\.cd"/);
  assert.match(android, /API_BASE_URL", quoted\("https:\/\/inventory\.supra\.cc\.cd"\)/);
  assert.match(android, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(workerFlow, /--config wrangler\.beta\.toml --keep-vars/);
  assert.equal(receipt.stable_worker_deploy_permission, false);
  assert.equal(receipt.domain_reassignment_permission, false);
  assert.equal(receipt.single_official_domain_detach_permission, false);
});

test("D170 Phase3B exact release gate prevents other clients, new providers or Stable", () => {
  const gate = read("tools/d167_release_gate.py");
  const workerFlow = read(".github/workflows/deploy-beta.yml");
  const agentFlow = read(".github/workflows/verify-relay-agent.yml");
  const receipt = JSON.parse(read("ops/d170-release-authorization.json"));
  assert.match(gate, /D170_OFFICIAL_OAUTH_CALLBACK_PHASE3B/);
  assert.match(gate, /OWNER_EXPLICIT_D170_DEPLOY_20261021_OFFICIAL_OAUTH_CALLBACK_PHASE3B/);
  assert.match(gate, /EXISTING_WORKER_OAUTH_CALLBACK_ONLY/);
  assert.match(gate, /data\.get\("approved_components"\) != \["worker"\]/);
  assert.match(workerFlow, /d170_oauth_official_release_authorized/);
  assert.match(workerFlow, /D170_OFFICIAL_OAUTH_CALLBACK_PHASE3B/);
  assert.match(agentFlow, /D170_PHASE3B_OAUTH_WORKER_ONLY:/);
  assert.equal(receipt.stable_worker_deploy_permission, false);
  assert.equal(receipt.domain_reassignment_permission, false);
  assert.equal(receipt.single_official_domain_detach_permission, false);
});
