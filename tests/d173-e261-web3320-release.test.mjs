import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const version = read("web/src/web-version.ts");
const pkg = JSON.parse(read("web/package.json"));
const worker = read(".github/workflows/deploy-beta.yml");
const source = read("web/src/operational-app.ts");
const auth = JSON.parse(read("ops/d173-e261-web3320-release-authorization.json"));
const gate = read("tools/d173_e261_web3320_release_gate.py");

test("E261 new Web3.3.20 is approved only for the five D173 UI corrections", () => {
  assert.match(version, /WEB_VERSION = "3\.3\.20"/);
  assert.equal(pkg.version, "3.3.20");
  assert.equal(auth.owner_production_release_approved, true);
  assert.equal(auth.source_pr, 974);
  assert.deepEqual(auth.approved_components, ["worker", "web"]);
  assert.equal(auth.scope, "WEB_UI_ONLY__EXISTING_WORKER_REPACK_WITHOUT_SERVICE_SOURCE_CHANGE");
  assert.equal(auth.d172_pending_hold, true);
  for (const key of ["agent_mutation","android_mutation","firebase_mutation","stable_mutation","new_provider_resources"])
    assert.equal(auth[key], false, key);
  assert.equal(auth.field_pass, false);
  assert.equal(auth.owner_pass, false);
});

test("E261 guarded Worker deploy does not reuse an obsolete E258 release", () => {
  assert.equal(worker.split("D173-E261_WEB3320_PRODUCTION_RELEASE:*").length - 1, 3);
  assert.match(worker, /D173_E261_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY/);
  assert.match(worker, /tools\/d173_e261_web3320_release_gate\.py --component worker/);
  assert.match(worker, /tools\/d173_e261_web3320_release_gate\.py --component web/);
  assert.match(gate, /SOURCE_DRIFT_AFTER_PIN/);
  assert.match(gate, /CODE_DRIFT_AFTER_CI/);
  assert.match(gate, /PROTECTED_MODULE_MUTATION/);
  assert.match(gate, /PROTECTED_MAIN_PUSH_ONLY/);
  assert.match(gate, /service\/.*obpp1291\/.*android\//s);
});

test("E261 only changes display, no extra overview call or polling cadence", () => {
  assert.match(source, /function scheduleDashboardEventRefresh\(\): void/);
  assert.match(source, /15_000 - \(Date\.now\(\) - dashboardLastLoadedAt\)/);
  assert.match(source, /style\.setProperty\("--supra-ui-zoom-factor", effectiveScale\.toFixed\(3\)\)/);
  assert.match(read("web/src/d173-tabler.css"), /height:\s*calc\(100dvh \/ var\(--supra-ui-zoom-factor, 1\)\) !important/);
});
