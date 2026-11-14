import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const a = JSON.parse(read("ops/d173-e268-web3322-release-authorization.json"));
const g = read("tools/d173_e268_web3322_release_gate.py"), w = read(".github/workflows/deploy-beta.yml");
test("E268: Owner production Web3.3.22 scope only", () => {
  assert.equal(a.change_id,"D173-E268");assert.equal(a.source_pr,979);
  assert.equal(a.owner_production_release_approved,true);
  assert.equal(a.web_target_version,"3.3.22");
  assert.deepEqual(a.approved_components,["worker","web"]);
  assert.equal(a.d172_pending_hold,true);
  for(const k of ["agent_mutation","android_mutation","firebase_mutation","stable_mutation","new_provider_resources","field_pass","owner_pass"])assert.equal(a[k],false,k);
  assert.equal(JSON.parse(read("web/package.json")).version,"3.3.22");
  assert.match(read("web/src/web-version.ts"),/WEB_VERSION = "3\.3\.22"/);
});
test("E268: protected source CI and D172 release gate", () => {
  assert.equal(w.split("D173-E268_WEB3322_PRODUCTION_RELEASE:*").length-1,3);
  assert.match(w,/d173_e268_web3322_release_gate\.py --component worker/);
  assert.match(w,/d173_e268_web3322_release_gate\.py --component web/);
  assert.match(w,/D173_E268_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY/);
  for(const k of ["BASE_DRIFT","TWO_PARENT_MERGE_MARKER","SOURCE_DRIFT_AFTER_PIN","CODE_DRIFT_AFTER_CI","PROTECTED_MODULE_MUTATION","CI_NOT_PINNED"])assert.ok(g.includes(k),k);
});
