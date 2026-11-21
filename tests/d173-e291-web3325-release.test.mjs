import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../"+p, import.meta.url), "utf8");
const auth = JSON.parse(read("ops/d173-e291-web3325-release-authorization.json"));
const gate = read("tools/d173_e291_web3325_release_gate.py");
const deploy = read(".github/workflows/deploy-beta.yml");
test("D173 E291 Owner authorizes only real Inventory Web3.3.25 release, does not approve FIELD",()=>{
  assert.equal(auth.change_id,"D173-E291");
  assert.equal(auth.source_pr,993);
  assert.equal(auth.web_target_version,"3.3.25");
  assert.equal(auth.owner_code_approved,true);
  assert.equal(auth.owner_production_release_approved,true);
  assert.equal(auth.field_pass,false);
  assert.equal(auth.owner_pass,false);
  assert.deepEqual(auth.approved_components,["worker","web"]);
  for(const flag of ["agent_mutation","android_mutation","firebase_mutation","stable_mutation","new_provider_resources"])assert.equal(auth[flag],false,flag);
  assert.equal(auth.d172_pending_hold,true);
  assert.equal((deploy.match(/D173-E291_WEB3325_PRODUCTION_RELEASE:\*/g)||[]).length,3);
  assert.match(deploy,/d173_e291_web3325_release_gate\.py --component worker/);
  assert.match(deploy,/d173_e291_web3325_release_gate\.py --component web/);
  assert.match(deploy,/D173_E291_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY/);
  for(const x of ["TWO_PARENT_MERGE_MARKER","PROTECTED_MAIN_PUSH_ONLY","SOURCE_DRIFT_AFTER_PIN",
    "D172_PENDING","CI_RECEIPTS_MISSING","WEB3325_RELEASE_AUTHORIZED"])assert.ok(gate.includes(x.replace("D172_PENDING","d172_pending_hold")),x);
});
