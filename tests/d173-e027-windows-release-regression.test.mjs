import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const text = path => readFileSync(path, "utf8");

test("D173 E027 source release gate always decodes Vietnamese notes as UTF-8 on Windows", () => {
  const gate = text("tools/d173_phase1_release_gate.py");
  for (const path of [
    "android/release-notes.json",
    "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "service/wrangler.beta.toml"
  ]) {
    assert.ok(gate.includes('(ROOT / "' + path + '").read_text(encoding="utf-8")'),
      "explicit UTF-8 decoding missing: " + path);
  }
  assert.match(gate, /OWNER_EXPLICIT_D173_DEPLOY_20261025_PHASE1_A_C_BOUNDED_LOG/);
  assert.match(gate, /source_ci_verified/);
});

test("D173 E027 email guard is valid YAML block scalar and does not loosen sender constraints", () => {
  const workflow = text(".github/workflows/d173-email-sender-guard.yml");
  assert.doesNotMatch(workflow, /route='''/);
  assert.match(workflow, /route=\(/);
  assert.match(workflow, /D173_E027_UTF8_YAML_ONLY_MAIL_SOURCE_UNCHANGED_PASS/);
  assert.match(workflow, /PROJECT_MAIL_SENDER = /);
  const start = workflow.indexOf("      - name: Exact-source E005 or E010 activation gate");
  const end = workflow.indexOf("      - name: D172 isolation regression", start);
  assert.ok(start >= 0 && end > start);
  const block = workflow.slice(start, end);
  let afterRun = false;
  for (const line of block.split("\n")) {
    if (line.startsWith("        run: |")) { afterRun = true; continue; }
    if (afterRun && line.trim()) {
      assert.ok(/^ {10}/.test(line), "YAML run scalar must remain indented 10+ spaces");
    }
  }
  assert.match(workflow, /read_bytes\(\)/);
});

test("D173 E027 receipt-only hotfix retriggers guarded Worker-Agent-Android publishing", () => {
  for (const wf of [
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-apps.yml"
  ]) {
    assert.match(text(wf), /ops\/d173-phase1-release-authorization\.json/,
      "Owner source receipt must re-trigger release job: " + wf);
  }
  assert.match(text(".github/workflows/release-obpp1291.yml"), /d172_release_gate\.py --component android/);
});
