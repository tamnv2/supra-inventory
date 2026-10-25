import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("Owner E046 historical freeze remains recorded while later limited D170/D171 closeout is authoritative", () => {
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
  // E046 describes the historical 21/10 freeze, not the current release gate.
  // The explicit 23/10 Owner-limited D170/D171 closeout superseded E046
  // without removing the historical freeze proof, Stable gate or D172 hold.
  assert.equal(rule.superseded_by,
    "D171_E062_EXPLICIT_POSTSHIFT_FULL_PRODUCTION_RELEASE_ORDER__CI_SCOPE_GATE_FIRST");
  const closeout = state.change_control.d170_d171_owner_closeout_20261023;
  assert.equal(closeout.owner_explicit, true);
  assert.match(closeout.d170, /^CLOSED_LIMITED_/);
  assert.match(closeout.d171, /^CLOSED_LIMITED_/);
  assert.match(closeout.d172, /^PENDING_HOLD_INDEPENDENT/);
  assert.equal(state.change_control.accepted_base_change_id, "D171");
  assert.equal(state.d170.owner_pass, true);
  assert.equal(state.d171.owner_pass, true);
  assert.equal(state.d172_obpp1291.owner_pass, false);
  assert.equal(state.d172_obpp1291.field_pass, false);
  assert.equal(state.change_control.stable, "LEGACY_STABLE_WORKER_OWNER_GATED_NOT_DEPLOYED__OFFICIAL_HOST_NOW_EXISTING_WORKER_BETA");
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
  assert.match(agent, new RegExp("AgentBuild = " + read("relay-agent/VERSION").trim() + ";"));
  assert.match(agent, /ApiBaseUrl = "https:\/\/inventory.supra.cc.cd"/);
  assert.match(main, /WEB_VERSION = "3.3.1"/);
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
