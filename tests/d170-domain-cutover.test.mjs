import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");
const live = read("service/wrangler.beta.toml");
const oldStable = read("service/wrangler.stable.toml");
const cutover = read("tools/d170_domain_cutover.sh");
const deploy = read(".github/workflows/deploy-beta.yml");
const agent = read(".github/workflows/verify-relay-agent.yml");
const firestore = read(".github/workflows/deploy-beta-firestore.yml");
const service = read("service/src/index.ts");

test("both registered public hostnames point to one existing Worker and InventoryCore", () => {
  assert.match(live, /name = "supra-inventory-beta"/);
  assert.doesNotMatch(live, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.match(live, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.match(live, /class_name = "InventoryCore"/);
  assert.match(live, /name = "INVENTORY_CORE"/);
  assert.match(live, /APP_ENV = "beta"/);
  assert.match(oldStable, /name = "supra-inventory-stable"/);
});

test("provider cutover is authenticated, scoped, and restricted to binding movement", () => {
  assert.match(cutover, /CLOUDFLARE_API_TOKEN/);
  assert.match(cutover, /OWNER_EXPLICIT_DEPLOY_APPROVED/);
  assert.match(cutover, /domain_reassignment_permission == true/);
  assert.match(cutover, /supra-inventory-stable/);
  assert.match(cutover, /supra-inventory-beta/);
  assert.match(cutover, /inventory\.supra\.cc\.cd/);
  assert.match(cutover, /-X PUT/);
  assert.match(cutover, /single_official_domain_detach_permission == true/);
  assert.match(cutover, /existing_id=.*inventory\.supra\.cc\.cd/);
  assert.match(cutover, /\[\[ "\$status" == 409 \]\]/);
  assert.match(cutover, /-X DELETE/);
  assert.match(cutover, /rollback_code/);
  assert.doesNotMatch(cutover, /DROP TABLE|DELETE FROM|wrangler delete|dns\/records/);
  assert.match(cutover, /D170_DUAL_HOST_SAME_EXISTING_WORKER_CONTROL_PLANE_PASS/);
});

test("official domain waits for same-Worker control plane and SQLite health", () => {
  assert.match(deploy, /bash tools\/d170_domain_cutover\.sh/);
  assert.match(deploy, /D170_OFFICIAL_AND_LEGACY_SAME_WORKER_SOURCE_PASS/);
  assert.match(deploy, /\.source_commit == \$sha and \.storage\.ok == true/);
  assert.match(agent, /D170_PHASE2_OFFICIAL_SAME_WORKER_DOMAIN:/);
  assert.match(firestore, /D170_PHASE2_OFFICIAL_SAME_WORKER_DOMAIN:/);
});

test("Google OAuth start uses the exact registered same-site callback and no arbitrary redirect", () => {
  assert.match(service, /const trustedHosts = \["inventory\.supra\.cc\.cd"\]/);
  assert.match(service, /url\.hostname !== callbackHost/);
  assert.match(service, /oauth_callback_host_not_allowed/);
  assert.match(service, /return startGoogleOAuth\(env\)/);
  assert.match(service, /state !== expectedState/);
});

test("phase2 cutover script changes trigger protected main Worker workflow", () => {
  assert.match(deploy, /"tools\/d170_domain_cutover\.sh"/);
  assert.match(deploy, /"ops\/d170-release-authorization\.json"/);
  assert.match(deploy, /python3 tools\/d167_release_gate\.py --component worker/);
});

test("Cloudflare E011 verified unassigned official host attaches with no additional DELETE", () => {
  assert.match(cutover, /\(\[\.result\[\] \| select\(\.hostname == "inventory\.supra\.cc\.cd"\)\] \| length\) <= 1/);
  assert.match(cutover, /case "\$official" in/);
  assert.match(cutover, /D170 unassigned official hostname attached to SAME existing Worker without deletion/);
  assert.match(cutover, /get_domains "\$after"/);
  assert.match(cutover, /supra-inventory-beta/);
  assert.match(cutover, /single_official_domain_detach_permission == true/);
});
