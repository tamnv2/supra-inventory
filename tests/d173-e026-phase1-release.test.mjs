import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(p, "utf8");

test("D173 E026 uses distinct Owner and SHA gate; D172 release guard remains intact", () => {
  const gate = read("tools/d173_phase1_release_gate.py");
  const dispatcher = read("tools/d167_release_gate.py");
  const d172 = read("tools/d172_release_gate.py");
  const backend = read(".github/workflows/d172-obpp1291-backend.yml");
  assert.match(gate, /D173-E026/);
  assert.match(gate, /OWNER_EXPLICIT_D173_DEPLOY_20261025_PHASE1_A_C_BOUNDED_LOG/);
  assert.match(gate, /D173-E026_PHASE1_RELEASE:/);
  assert.match(gate, /approved_source_sha/);
  assert.match(gate, /d172_lifecycle/);
  assert.match(gate, /PENDING_HOLD/);
  assert.match(gate, /diff", "--quiet", pin, "HEAD"/);
  assert.match(dispatcher, /tools\/d173_phase1_release_gate\.py/);
  assert.match(dispatcher, /tools\/d172_release_gate\.py/);
  assert.match(d172, /D172_RELEASE_DENIED/);
  assert.match(backend, /D172_REGRESSION_ONLY_CI__EXACT_SHA_RELEASE_GATE_PRESERVED/);
  assert.doesNotMatch(backend, /python3 tools\/d172_release_gate\.py --component worker --preflight/);
});

test("D173 E026 release remains sequenced on existing official Worker, Agent and signed Android", () => {
  const worker = read(".github/workflows/deploy-beta.yml");
  const agent = read(".github/workflows/verify-relay-agent.yml");
  const android = read(".github/workflows/verify-apps.yml");
  const firestore = read(".github/workflows/deploy-beta-firestore.yml");
  const gateway = read(".github/workflows/deploy-beta-agent-gateway.yml");
  assert.match(worker, /python3 tools\/d173_phase1_release_gate\.py --component worker/);
  assert.match(worker, /D173_GATEWAY_REUSED_VERIFIED_IMMUTABLE_SOURCE/);
  assert.match(agent, /D173_UNCHANGED_EXISTING_GATEWAY_PASS/);
  assert.match(agent, /D173_UNCHANGED_FIRESTORE_RULES_PASS/);
  assert.match(android, /D173_EXACT_AGENT141_DEPLOYED_BEFORE_ANDROID118_PASS/);
  assert.match(android, /relay-agent-v141/);
  assert.match(android, /APP_VERSION_CODE/);
  assert.match(firestore, /D173-E026_PHASE1_RELEASE:/);
  assert.match(gateway, /D173-E026_PHASE1_RELEASE:/);
  assert.match(read("service/wrangler.beta.toml"), /pattern = "inventory\.supra\.cc\.cd"/);
});

test("D173 source version updates are monotonic, 3 current notes, no D172 APK crossover", () => {
  const version = Number(read("relay-agent/VERSION").trim());
  assert.equal(version, 141);
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild = 141/);
  const notes = JSON.parse(read("android/release-notes.json"));
  assert.equal(notes.release_notes.length, 3);
  assert.ok(notes.release_notes.every(x => x.startsWith("vc118:")));
  assert.match(read(".github/workflows/release-obpp1291.yml"), /tools\/d172_release_gate\.py --component android/);
});

// D173 E027: Windows runner default cp1252 cannot decode the Vietnamese vc118 notes.
test("D173 release gate decodes Android notes using explicit UTF-8 on Windows", () => {
  const gate = read("tools/d173_phase1_release_gate.py");
  assert.match(gate, /release-notes\.json"\)\.read_text\(encoding="utf-8"\)/);
  for (const workflow of ["deploy-beta.yml", "verify-relay-agent.yml", "verify-apps.yml"]) {
    assert.match(read(`.github/workflows/${workflow}`), /ops\/d173-phase1-release-authorization\.json/);
  }
});

test("D173 E028 immutable Agent141 tag ancestry and Agent source tree, never mutable release targetCommitish", () => {
  const android = read(".github/workflows/verify-apps.yml");
  const start = android.indexOf("D173 require exact Agent v141 before signed Android vc118");
  const end = android.indexOf("Publish signed Beta auto-update release", start);
  assert.ok(start > 0 && end > start);
  const step = android.slice(start, end);
  assert.match(step, /git\/ref\/tags\/relay-agent-v141/);
  assert.match(step, /\.object\.type == "commit"/);
  assert.match(step, /git merge-base --is-ancestor/);
  assert.match(step, /git rev-parse "\$agent_sha:relay-agent"/);
  assert.match(step, /git rev-parse "\$GITHUB_SHA:relay-agent"/);
  assert.match(step, /agent_tree_matches/);
  assert.match(step, /verify-relay-agent\.yml/);
  assert.doesNotMatch(step, /gh release view relay-agent-v141 --json targetCommitish/);
  assert.match(android, /cancel-in-progress:.*E028_OTA_TAG_GUARD_REPAIR/);
  assert.doesNotMatch(android, /cancel-in-progress: true/);
});
