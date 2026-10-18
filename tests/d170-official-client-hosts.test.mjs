import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const android = read("android/app/build.gradle.kts");
const agent = read("relay-agent/AgentConfig.cs");
const updater = read("relay-agent/AgentUpdater.cs");
const currentWorker = read("service/wrangler.beta.toml");
const service = read("service/src/index.ts");
const receipt = JSON.parse(read("ops/d170-release-authorization.json"));

test("new Android and Windows releases use the same official API and updater hostname", () => {
  assert.match(android, /API_BASE_URL", quoted\("https:\/\/inventory\.supra\.cc\.cd"\)/);
  assert.match(android, /UPDATE_RELEASE_API", quoted\("https:\/\/inventory\.supra\.cc\.cd\/downloads\/pda\/manifest"\)/);
  assert.match(agent, /ApiBaseUrl = "https:\/\/inventory\.supra\.cc\.cd"/);
  assert.match(agent, /AgentUpdateManifestUrl = ApiBaseUrl/);
  assert.match(updater, /new Uri\(AgentConfig\.ApiBaseUrl\)\.Host/);
  assert.doesNotMatch(updater, /"inventory-beta\.supra\.cc\.cd"/);
});

test("migration is in-place, existing releases stay able to update from old host", () => {
  assert.match(android, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(android, /TRUSTED_SIGNER_SHA256/);
  assert.match(currentWorker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.match(currentWorker, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.match(service, /beta-vc/);
  assert.match(updater, /AgentConfig\.AgentUpdateManifestUrl/);
});

test("new Agent build increments monotonically without touching Firebase or WMS", () => {
  assert.match(agent, /AgentBuild = 139/);
  assert.equal(read("relay-agent/VERSION").trim(), "139");
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /<FileVersion>0\.139\.0\.0<\/FileVersion>/);
  assert.match(agent, /FirebaseProjectId = "supra-inventory-beta"/);
  assert.match(agent, /RelayTransport = "FIRESTORE_CONFIRM_V1"/);
});

test("phase3 cannot detach legacy domain or change the transaction authority", () => {
  assert.equal(receipt.change_id, "D170");
  assert.equal(receipt.code_scope, "D170_OFFICIAL_CLIENT_HOST_PHASE3");
  assert.equal(receipt.existing_worker_and_durable_object_preserved, true);
  assert.equal(receipt.legacy_android_package_preserved, true);
  assert.equal(receipt.stable_worker_deploy_permission, false);
  assert.equal(receipt.domain_reassignment_permission, false);
  assert.equal(receipt.single_official_domain_detach_permission, false);
  assert.match(currentWorker, /class_name = "InventoryCore"/);
});
