import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const auth = JSON.parse(read("ops/d173-e270-web3323-release-authorization.json"));
const gate = read("tools/d173_e270_web3323_release_gate.py");
const workflow = read(".github/workflows/deploy-beta.yml");

test("E270: Owner-authorized Web-only release cannot mutate shared business code", () => {
  assert.equal(auth.change_id, "D173-E270");
  assert.equal(auth.owner_code_approved, true);
  assert.equal(auth.owner_production_release_approved, true);
  assert.equal(auth.web_target_version, "3.3.23");
  assert.deepEqual(auth.approved_components, ["worker", "web"]);
  for (const key of ["d172_pending_hold", "d172_cross_regression_required"]) assert.equal(auth[key], true);
  for (const key of ["agent_mutation", "android_mutation", "firebase_mutation", "stable_mutation", "new_provider_resources", "field_pass", "owner_pass"])
    assert.equal(auth[key], false, key);
  assert.equal(JSON.parse(read("web/package.json")).version, "3.3.23");
  assert.match(read("web/src/web-version.ts"), /WEB_VERSION = "3\.3\.23"/);
});

test("E270: exact-source pinned, two-parent guarded release with D172 isolation", () => {
  for (const token of ["TWO_PARENT_MERGE_MARKER", "PROTECTED_MAIN_PUSH_ONLY", "BASE_DRIFT",
    "SOURCE_DRIFT_AFTER_PIN", "CODE_DRIFT_AFTER_CI", "PROTECTED_MODULE_MUTATION", "CI_NOT_PINNED", "REQUIRED_CI_STATUS"])
    assert.ok(gate.includes(token), token);
  assert.match(workflow, /D173-E270_WEB3323_PRODUCTION_RELEASE:\*/);
  assert.match(gate, /ops\/d173-e270-web3323-release-authorization\.json/);
  assert.match(gate, /tools\/d173_e270_web3323_release_gate\.py/);
  assert.match(workflow, /d173_e270_web3323_release_gate\.py --component worker/);
  assert.match(workflow, /d173_e270_web3323_release_gate\.py --component web/);
  assert.match(workflow, /D173_E270_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY/);
});
