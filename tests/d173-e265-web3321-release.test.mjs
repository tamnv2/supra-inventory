import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const gate = read("tools/d173_e265_web3321_release_gate.py");
const workflow = read(".github/workflows/deploy-beta.yml");
const auth = JSON.parse(read("ops/d173-e265-web3321-release-authorization.json"));
const css = read("web/src/d173-tabler.css");

test("E265: Owner authorizes only the existing Production Web3.3.21 UI release", () => {
  assert.equal(auth.change_id, "D173-E265");
  assert.equal(auth.source_pr, 977);
  assert.equal(auth.owner_production_release_approved, true);
  assert.deepEqual(auth.approved_components, ["worker", "web"]);
  assert.equal(auth.web_target_version, "3.3.21");
  assert.equal(auth.d172_pending_hold, true);
  assert.equal(auth.field_pass, false);
  assert.equal(auth.owner_pass, false);
  for (const key of ["agent_mutation","android_mutation","firebase_mutation","stable_mutation","new_provider_resources"]) {
    assert.equal(auth[key], false, key);
  }
  assert.equal(JSON.parse(read("web/package.json")).version, "3.3.21");
  assert.match(read("web/src/web-version.ts"), /WEB_VERSION = "3\.3\.21"/);
});

test("E265: protected Worker deploy requires exact-source, two-parent merge, CI and D172 guard", () => {
  assert.equal(workflow.split("D173-E265_WEB3321_PRODUCTION_RELEASE:*").length - 1, 3);
  assert.match(workflow, /d173_e265_web3321_release_gate\.py --component worker/);
  assert.match(workflow, /d173_e265_web3321_release_gate\.py --component web/);
  assert.match(workflow, /D173_E265_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY/);
  for (const token of ["TWO_PARENT_MERGE_MARKER","PROTECTED_MAIN_PUSH_ONLY","PROTECTED_MODULE_MUTATION",
                        "SOURCE_DRIFT_AFTER_PIN","CODE_DRIFT_AFTER_CI","REQUIRED_CI_STATUS","BASE_DRIFT"]) {
    assert.ok(gate.includes(token), token);
  }
  assert.match(gate, /"service\/", "obpp1291\/", "android\/", "relay-agent\/", "firebase\/"./);
});

test("E265: Web geometry is shared, no new DOM/API/query/telemetry changes", () => {
  assert.match(css, /--d173-ui-gap:\s*6px/);
  assert.match(css, /--d173-ui-card-radius:\s*5px/);
  assert.match(css, /--d173-ui-panel-radius:\s*4px/);
  assert.match(css, /--d173-ui-control-radius:\s*4px/);
  assert.match(css, /\.d173-tabler-shell \.d173-page-content \.workspace-tab/);
});
