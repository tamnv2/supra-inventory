import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate = readFileSync(new URL("../tools/d167_release_gate.py", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/verify-apps.yml", import.meta.url), "utf8");
const auth = JSON.parse(readFileSync(new URL("../ops/d171-release-authorization.json", import.meta.url), "utf8"));

test("E078 E074 vc117 is restricted to unchanged Owner-approved signed Android", () => {
  assert.deepEqual(auth.approved_components, ["android"]);
  assert.equal(auth.android_version_code, 117);
  assert.equal(auth.e074_vc117.protected_source_sha, auth.approved_source_sha);
  assert.match(gate, /D171_E078_TWO_AUTHORITIES_ANDROID_EXACT_AND_D172_RUNTIME_IMMUTABLE_PASS/);
  assert.match(gate, /"diff", "--quiet", sha, "HEAD", "--", "android\/"/);
});

test("E078 current D172 Worker and separate OBPP runtime are immutable", () => {
  assert.match(gate, /d172_deployed_main = "6c39e1f376e9181e8740201e037965d77cf94056"/);
  assert.match(gate, /"merge-base", "--is-ancestor", d172_deployed_main, "HEAD"/);
  for (const dir of ['"service/"', '"web/"', '"relay-agent/"', '"firebase/"', '"functions/"',
                    '"ops/apps-script/"', '"obpp1291/"', '"ops/project-scope.json"',
                    '"ops/resource-registry.json"']) {
    assert.ok(gate.includes(dir), `Missing strict protection ${dir}`);
  }
  assert.match(gate, /D171 vc117 cannot alter the current D172-deployed runtime/);
  assert.match(workflow, /D171 E074 verify existing Production runtime before signed vc117/);
  assert.match(workflow, /D171_E074_ANDROID_RUNTIME_REUSED=true/);
});

test("E079 verified Agent v140, current Rules and Android-only replay bypasses obsolete same-SHA Agent check", () => {
  assert.match(workflow, /gh release view relay-agent-v140 --json targetCommitish/);
  assert.match(workflow, /git diff --quiet "\$agent_base" "\$GITHUB_SHA" -- relay-agent\/ relay-agent-webview2-host\//);
  assert.match(workflow, /39690797227/);
  assert.match(workflow, /c8f58ce79f0ac4d59cdf547649e3f3a412e6d073/);
  assert.match(workflow, /D171_E079_EXISTING_AGENT140_AND_FIRESTORE_PARITY_PASS/);
  assert.match(workflow, /env.D170_ANDROID_LEGACY_RUNTIME_COMPAT != 'true' && env.D171_E074_ANDROID_RUNTIME_REUSED != 'true'/);
});
