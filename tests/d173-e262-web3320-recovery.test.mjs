import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
const read = p => readFileSync(new URL("../"+p, import.meta.url), "utf8");
const wf = read(".github/workflows/deploy-beta.yml");
const gate = read("tools/d173_e262_web3320_recovery_gate.py");
const auth = JSON.parse(read("ops/d173-e262-web3320-recovery-authorization.json"));
const version = read("web/src/web-version.ts");
test("E262 is Web3320 already deployed, only repairs strict postsecret probe", () => {
  assert.match(version, /WEB_VERSION = "3\.3\.20"/);
  assert.equal(auth.owner_production_release_approved,true);
  assert.equal(auth.source_pr,975);
  assert.deepEqual(auth.approved_components,["worker","web"]);
  assert.equal(auth.d172_pending_hold,true);
  assert.equal(auth.stable_mutation,false);
  assert.equal(auth.field_pass,false);
  assert.equal(auth.owner_pass,false);
  assert.match(gate,/PROTECTED_SOURCE_CHANGED/);
  assert.match(gate,/SOURCE_DRIFT_AFTER_PIN/);
  assert.match(gate,/CI_SOURCE_DRIFT/);
});
test("E262 requires two-parent merge, exact release gate and unchanged Gateway", () => {
  assert.equal(wf.split("D173-E262_WEB3320_RECOVERY_RELEASE:*").length-1,3);
  assert.match(wf,/D173_E262_UNCHANGED_WEB_WORKER_D172_GATEWAY_SOURCE_PASS/);
  assert.match(wf,/tools\/d173_e262_web3320_recovery_gate\.py --component worker/);
  assert.match(wf,/tools\/d173_e262_web3320_recovery_gate\.py --component web/);
});
test("D166 post-secret health retains fail-closed exact source check with bounded retries", () => {
  const region = wf.slice(wf.indexOf("      - name: D166 verify read-only endpoint rejects unauthenticated callers"),wf.indexOf("      - name: Verify Beta auth API routing",wf.indexOf("      - name: D166 verify read-only endpoint rejects unauthenticated callers")));
  assert.match(region,/for attempt in \$\(seq 1 30\); do/);
  assert.match(region,/\[ "\$current" = "\$expected" \]/);
  assert.match(region,/\[ "\$environment" = "beta" \]/);
  assert.match(region,/\[ "\$health_code" = "200" \]/);
  assert.match(region,/\[ "\$attempt" -lt 30 \]/);
  assert.match(region,/sleep 5/);
  assert.match(region,/D166_WORKER_BETA_UNAUTHENTICATED_FAIL_CLOSED_PASS/);
  assert.match(region,/\[ "\$code" = "401" \] && \[ "\$reason" = "AUTH_REQUIRED" \]/);
  assert.doesNotMatch(region,/\|\| true[\s\S]*D166_WORKER_SECRET_VERSION_SOURCE_AND_ENV_PASS/);
});
