import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("Owner E046 freezes the current Production fleet and holds the unified candidate", () => {
  const state = JSON.parse(read("ops/project-state.json"));
  const rule = state.change_control.production_release_freeze_2026_10_21;
  assert.equal(rule.owner_approved, true);
  assert.equal(rule.code_only, true);
  assert.equal(rule.live_android_vc, 114);
  assert.equal(rule.live_agent_v, 139);
  assert.equal(rule.live_web, "3.1.1");
  assert.equal(rule.candidate_android_vc, 115);
  assert.equal(rule.candidate_agent_v, 140);
  assert.equal(rule.candidate_web, "3.1.2");
  assert.equal(rule.one_public_host, "inventory.supra.cc.cd");
  assert.equal(rule.same_existing_worker_and_sqlite, true);
  assert.equal(rule.no_beta_to_stable_promotion, true);
  assert.equal(rule.stable_worker_owner_gated, true);
  for (const prohibited of ["merge_main", "ota_publish", "worker_web_deploy", "agent_android_release", "provider_mutation"]) {
    assert.ok(rule.prohibited_until_release.includes(prohibited), prohibited);
  }
  // E046 remains a historical freeze receipt. D170/D171 were subsequently
  // accepted in a narrow scope via PR699; do not resurrect D169 as the base.
  if (state.change_control.accepted_base_change_id === "D171") {
    assert.equal(state.d170.owner_pass, true);
    assert.equal(state.d171.owner_pass, true);
    assert.equal(state.d173.owner_pass, false);
    assert.match(state.d171.status, /CLOSED_LIMITED_OWNER_ACCEPTED/);
    assert.equal(state.d173.production_deploy_approved, false);
  } else {
    assert.equal(state.change_control.accepted_base_change_id, "D169");
    assert.equal(state.d170.owner_pass, false);
  }
});

test("New production-facing source preserves one Worker, official API and signed legacy compatibility", () => {
  const worker = read("service/wrangler.beta.toml");
  const api = read("service/src/index.ts");
  const app = read("android/app/build.gradle.kts");
  const androidUi = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const web = read("web/src/operational-app.ts");
  const agent = read("relay-agent/AgentConfig.cs");
  const main = read("web/src/web-version.ts");
  assert.match(worker, /name = "supra-inventory-beta"/);
  assert.match(worker, /class_name = "InventoryCore"/);
  assert.match(worker, /pattern = "inventory.supra.cc.cd"/);
  assert.doesNotMatch(worker, /name = "supra-inventory-stable"/);
  assert.match(api, /oauth_callback_origin_mismatch/);
  assert.match(api, /configuredCallback.origin === url.origin/);
  assert.match(app, /applicationId = "cd.cc.supra.inventory.beta"/);
  assert.match(androidUi, /"1291 Báo hàng"/);
  assert.doesNotMatch(web, /Beta · hoạt động/);
  assert.match(web, /Chính thức · hoạt động/);
  assert.match(agent, /AgentBuild = 140/);
  assert.match(agent, /ApiBaseUrl = "https:\/\/inventory.supra.cc.cd"/);
  assert.match(main, /WEB_VERSION = "3.1.2"/);
});

test("Owner release authorization remains separate from passing CODE ONLY CI", () => {
  const doc = read("docs/D170_D171_SINGLE_PRODUCTION_RELEASE_ALIGNMENT_2026-10-21.md");
  const journal = JSON.parse(read("ops/change-continuity/D171.json"));
  const workflow = read(".github/workflows/verify-d171-agent-code-only.yml");
  const last = journal.entries.at(-1);
  assert.ok(journal.entries.some(entry => entry.id === "D171-E046" && entry.owner_approval === true));
  assert.ok(last.id.startsWith("D171-E"));
  assert.match(doc, /SOURCE ONLY|CODE ONLY|CODE\/CI ONLY/);
  assert.match(doc, /Không merge PR ứng viên vào/);
  assert.match(doc, /Worker.*OWNER-GATED|OWNER-GATED/);
  assert.match(workflow, /Fail-closed provider and stable release boundary/);
  assert.match(workflow, /Explicit no deployment receipt/);
});
