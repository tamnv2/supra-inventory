import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("D173-E043 Web presentation equals Tabler 3.2 without E036 override", () => {
  const web = read("web/src/operational-app.ts");
  const v = read("web/src/web-version.ts");
  const pkg = JSON.parse(read("web/package.json"));
  assert.match(web, /import "\.\/d173-tabler\.css"/);
  assert.doesNotMatch(web, /import "\.\/d173-e036-unified-design\.css"/);
  assert.match(web, /d173-tabler-shell/);
  assert.match(v, /WEB_VERSION = "3\.3\.1"/);
  assert.equal(pkg.version, "3.3.1");
});

test("D173-E043 release is Worker assets only and exact source owner gated", () => {
  const receipt = JSON.parse(read("ops/d173-e043-web-release-authorization.json"));
  assert.equal(receipt.checkpoint, "D173-E043");
  assert.deepEqual(receipt.approved_components, ["worker"]);
  assert.equal(receipt.web_version, "3.3.1");
  for(const name of [
    "agent_mutation", "android_mutation", "d172_business_mutation",
    "d172_ota_mutation", "firebase_rules_mutation", "gateway_mutation",
    "database_migration", "new_provider_resource", "field_pass", "owner_pass",
  ]) assert.equal(receipt[name], false, name);
  assert.equal(receipt.d172_lifecycle, "PENDING_HOLD");
  const gate = read("tools/d173_e043_web_release_gate.py");
  const worker = read("tools/d167_release_gate.py");
  const workflow = read(".github/workflows/deploy-beta.yml");
  for(const item of [gate, worker, workflow]) {
    assert.match(item, /D173-E043_WEB_ONLY_RELEASE:|d173_e043_web_release_gate\.py/);
  }
  for(const needle of [
    "source_ci_verified", "approved_source_sha", "protected",
    "D173_E043_WEB_RELEASE_DENIED", "mail", "D172",
  ]) assert.match(gate.toLowerCase(), new RegExp(needle.toLowerCase().replace("_", "_")));
  assert.match(read(".github/workflows/d173-email-sender-guard.yml"),
    /D173_E043_WEB331_MAIL_AUTH_BYTE_PRESERVED_AND_D172_ISOLATED_PASS/);
});
