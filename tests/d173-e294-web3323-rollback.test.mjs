import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const git = (...args) => execFileSync("git", args, {encoding:"utf8"}).trim();
const old = "70bd1f12b142642aafba02f1c9cb71b1d3a14214";
const base = "163f05ac7db75ee232254c811c655069ec5f0638";
const auth = JSON.parse(read("ops/d173-e294-web3323-rollback-authorization.json"));
const gate = read("tools/d173_e294_web3323_rollback_gate.py");
const deploy = read(".github/workflows/deploy-beta.yml");

test("E294: Web source is exactly historical 3.3.23 tree, not just a visual imitation", () => {
  assert.equal(git("diff","--name-only",old,"HEAD","--","web/"),"");
  assert.equal(JSON.parse(read("web/package.json")).version,"3.3.23");
  assert.ok(read("web/src/web-version.ts").includes('WEB_VERSION = "3.3.23"'));
  const app=read("web/src/operational-app.ts");
  assert.ok(app.includes('import "./d173-tabler.css";'));
  assert.ok(app.includes('import "./legacy-operational.css";'));
  for(const path of ["web/src/pickpack-office.css","web/src/d173-pickpack-business.css","web/src/d173-inventory-preview.css"])
    assert.equal(existsSync(new URL("../"+path,import.meta.url)),false,path);
});

test("E294: restore only Web; shared current backend and D172 stay unchanged", () => {
  const changed=git("diff","--name-only",base,"HEAD").split("\n");
  for(const path of changed) {
    assert.ok(!["service/","android/","obpp1291/","relay-agent/","firebase/","functions/","pda-management/"].some(prefix=>path.startsWith(prefix)),path);
    assert.notEqual(path,"ops/change-continuity/D172.json");
  }
  assert.equal(auth.owner_code_approved,true);
  assert.equal(auth.owner_production_release_approved,true);
  assert.deepEqual(auth.approved_components,["worker","web"]);
  assert.equal(auth.web_target_version,"3.3.23");
  assert.equal(auth.d172_pending_hold,true);
  for(const key of ["agent_mutation","android_mutation","firebase_mutation","stable_mutation","new_provider_resources"])
    assert.equal(auth[key],false,key);
  for(const key of ["TWO_PARENT_MERGE_MARKER","PROTECTED_MAIN_PUSH_ONLY","WEB_TREE_NOT_EQUAL_3_3_23",
    "SOURCE_DRIFT_AFTER_PIN","CODE_DRIFT_AFTER_CI","BASE_DRIFT","OUT_OF_SCOPE"])
    assert.ok(gate.includes(key),key);
  assert.ok(deploy.includes("D173-E294_WEB3323_ROLLBACK_PRODUCTION_RELEASE:"));
  assert.ok(deploy.includes("D173_E294_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY"));
});
