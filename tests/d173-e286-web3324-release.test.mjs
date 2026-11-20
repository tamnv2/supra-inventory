import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFileSync(join(ROOT, path),"utf8");
const auth = JSON.parse(read("ops/d173-e286-web3324-release-authorization.json"));
const main = read("web/src/operational-app.ts");
const deploy = read(".github/workflows/deploy-beta.yml");
const gate = read("tools/d173_e286_web3324_release_gate.py");

test("D173 E286 exact Owner production Web 3.3.24 scope and independent D172", () => {
  assert.equal(auth.project_key,"supra-inventory");
  assert.equal(auth.source_pr,991);
  assert.equal(auth.change_id,"D173-E286");
  assert.equal(auth.web_target_version,"3.3.24");
  assert.equal(auth.owner_code_approved,true);
  assert.equal(auth.owner_production_release_approved,true);
  assert.deepEqual(auth.approved_components,["worker","web"]);
  assert.equal(auth.stable_mutation,false);
  assert.equal(auth.new_provider_resources,false);
  assert.equal(auth.d172_pending_hold,true);
  for(const x of ["agent_mutation","android_mutation","firebase_mutation","owner_pass","field_pass"]) assert.equal(auth[x],false,x);
  assert.match(read("web/src/web-version.ts"), /WEB_VERSION = "3\.3\.24"/);
  assert.equal(JSON.parse(read("web/package.json")).version,"3.3.24");
  assert.match(gate,/TWO_PARENT_MERGE_MARKER/);
  assert.match(gate,/PROTECTED_MAIN_PUSH_ONLY/);
  assert.match(gate,/SOURCE_DRIFT_AFTER_PIN/);
  assert.match(gate,/D173_E286_WEB3324_RELEASE_AUTHORIZED/);
  assert.equal((deploy.match(/D173-E286_WEB3324_PRODUCTION_RELEASE:\*/g)||[]).length,3);
  assert.match(deploy,/d173_e286_web3324_release_gate\.py --component worker/);
  assert.match(deploy,/d173_e286_web3324_release_gate\.py --component web/);
  assert.match(deploy,/D173_E286_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY/);
});

test("E286 real role and business handlers remain after preview Web shell redesign", () => {
  for(const x of ["function canAccessSection","function renderShell","function renderOperations",
    "function renderFastDetail","function renderStockModal","function renderSkipModal",
    "resolveReporterBatch(", "getReporterQueue(", "registerRealtimeApplier(","createPickerReport(",
    'id="logout"','id="root-role-select"', 'id="inventory-accent-color"',
    'data-shell-generation="d173-preview-ui"']) assert.ok(main.includes(x),"missing "+x);
  assert.match(read("web/src/d173-inventory-preview.css"), /grid-template-columns:254px minmax\(0,1fr\)/);
  assert.match(read(".github/workflows/d173-e283-web-ui-code-only.yml"), /d173-e283-inventory-ui-review/);
});
