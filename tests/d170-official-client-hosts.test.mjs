import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const android = read("android/app/build.gradle.kts");
const agent = read("relay-agent/AgentConfig.cs");
const updater = read("relay-agent/AgentUpdater.cs");
const currentWorker = read("service/wrangler.beta.toml");
const service = read("service/src/index.ts");
const receipt = JSON.parse(read("ops/d170-release-authorization.json"));

test("new Android and Windows releases use the same official API and updater hostname", () => {
  assert.match(android, /API_BASE_URL", quoted\("https:\/\/inventory\.supra\.cc\.cd"\)/);
  assert.match(android, /UPDATE_RELEASE_API", quoted\("https:\/\/inventory\.supra\.cc\.cd\/downloads\/pda\/manifest"\)/);
  assert.match(agent, /ApiBaseUrl = "https:\/\/inventory\.supra\.cc\.cd"/);
  assert.match(agent, /AgentUpdateManifestUrl = ApiBaseUrl/);
  assert.match(updater, /new Uri\(AgentConfig\.ApiBaseUrl\)\.Host/);
  assert.doesNotMatch(updater, /"inventory-beta\.supra\.cc\.cd"/);
});

test("Agent browser bundle, SKU synchronization and network probe reject old/unknown Worker hosts", () => {
  for (const file of ["relay-agent/AgentBrowserBundle.cs", "relay-agent/D167SkuServiceClient.cs", "relay-agent/D168NetworkRoute.cs"]) {
    const source = read(file);
    assert.match(source, /"inventory\.supra\.cc\.cd"/);
    assert.doesNotMatch(source, /"inventory-beta\.supra\.cc\.cd"/);
  }
});

test("migration is in-place, existing releases stay able to update from old host", () => {
  assert.match(android, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(android, /TRUSTED_SIGNER_SHA256/);
  assert.doesNotMatch(currentWorker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.match(currentWorker, /pattern = "inventory\.supra\.cc\.cd"/);
  assert.match(service, /beta-vc/);
  assert.match(updater, /AgentConfig\.AgentUpdateManifestUrl/);
});

test("new Agent build increments monotonically without touching Firebase or WMS", () => {
  const currentBuild = Number(read("relay-agent/VERSION").trim());
  assert.ok(Number.isInteger(currentBuild) && currentBuild >= 140);
  assert.match(agent, new RegExp("AgentBuild = " + currentBuild + ";"));
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), new RegExp("<FileVersion>0\\." + currentBuild + "\\.0\\.0</FileVersion>"));
  assert.match(agent, /FirebaseProjectId = "supra-inventory-beta"/);
  assert.match(agent, /RelayTransport = "FIRESTORE_CONFIRM_V1"/);
});


test("v139 release compares Firestore Rules to the actual pre-Phase3A source, never to stale D169", () => {
  const baseline = "3829933312d7805bdb636e1d7581e3a81bb58ff9";
  const workflow = read(".github/workflows/verify-relay-agent.yml");
  assert.match(workflow, /"ops\/d170-release-authorization\.json"/, "Agent release must react to protected receipt-only corrections");
  assert.match(workflow, /git merge-base --is-ancestor \$baseline \$env:GITHUB_SHA/);
  assert.match(workflow, /git diff --quiet \$baseline \$env:GITHUB_SHA -- firebase\/firestore\.rules firebase\/firestore\.indexes\.json firebase\.json/);
  for (const file of ["firebase/firestore.rules", "firebase/firestore.indexes.json", "firebase.json"]) {
    const accepted = execFileSync("git", ["show", baseline + ":" + file], { encoding: "utf8" });
    // Git stores LF; Windows autocrlf changes checkout EOLs, not the Rules blob.
    // Preserve every other byte in the protected before/after comparison.
    const actual = read(file).replace(/\r\n/g, "\n");
    // D173-E123 Owner authorized exactly one DEFERRED status on the existing
    // VPS reclaim coordination rule. Normalize ONLY that specific change
    // before applying the historical D170/D171 byte preservation contract.
    let current = actual;
    if (file === "firebase/firestore.rules" &&
        actual.includes("request.resource.data.status in ['APPROVED', 'DEFERRED']")) {
      const auth = JSON.parse(read("ops/d173-e123-release-authorization.json"));
      assert.equal(auth.checkpoint_id, "D173-E123");
      assert.equal(auth.firestore_rules_deployment_permission, true);
      assert.equal(auth.d172_business_mutation, false);
      const token = "request.resource.data.status in ['APPROVED', 'DEFERRED']";
      assert.equal(actual.split(token).length, 2, "E123 changes exactly one guarded rules statement");
      current = actual.replace(token, "request.resource.data.status == 'APPROVED'");
    }
    if (file === "firebase/firestore.rules" && current !== accepted &&
        process.env.GITHUB_EVENT_NAME === "pull_request" &&
        process.env.GITHUB_HEAD_REF !== "docs/d173-e140-picklist-confirm-guard-forensics-20261105") {
      // E140 Rules were accepted into main after the historic D170 baseline.
      // For later Agent-only PRs, require the ENTIRE current Rules blob to
      // match main byte-for-byte. This grants zero Firebase Rules mutation.
      const mainRules = execFileSync("git", ["show", "origin/main:" + file], { encoding: "utf8" }).replace(/\r\n/g, "\n");
      const e140 = JSON.parse(read("ops/d173-e140-release-authorization.json"));
      if (actual === mainRules && e140.checkpoint_id === "D173-E140" &&
          e140.owner_source_approval === true &&
          e140.d172_business_mutation === false &&
          e140.d172_status === "PENDING_HOLD") continue;
    }
    if (file === "firebase/firestore.rules" && current !== accepted &&
        process.env.GITHUB_EVENT_NAME === "pull_request" &&
        process.env.GITHUB_HEAD_REF === "docs/d173-e140-picklist-confirm-guard-forensics-20261105") {
      // E140 Owner explicitly permits the *three exact* Firebase rule hunks.
      // Historical D170/D171 parity stays mandatory for all other refs/files.
      // The strict guard compares against accepted main and D172 byte-for-byte.
      execFileSync("python3", ["tools/d173_e140_rules_delta_guard.py"], { encoding: "utf8" });
      continue;
    }
    if (file === "firebase/firestore.rules" && current !== accepted) {
      // D171 previously deployed one isolated temporary test-only match.
      // Prove everything BEFORE and AFTER that match remains byte-exact D170
      // and never accept a change to production rules as a D171 exception.
      const anchor = "match /relay_poc_jobs/{jobId} {";
      const cut = accepted.indexOf(anchor);
      assert.ok(cut > 0, "protected production PickList rules missing");
      assert.ok(current.startsWith(accepted.slice(0, cut)));
      assert.ok(current.endsWith(accepted.slice(cut)));
      const isolated = current.slice(cut, current.length - (accepted.length - cut));
      assert.match(isolated, /^\/\/ D171: TEMPORARY isolated diagnostics;/);
      assert.match(isolated, /match \/d169_diag_sessions\/\{sid\} \{/);
      assert.match(isolated, /allow list, delete: if false;/);
      assert.doesNotMatch(isolated, /match \/relay_poc_jobs|match \/relay_poc_coordination/);
    } else {
      assert.equal(current, accepted, file + " must match the accepted Rules baseline");
    }
  }
  // The mainline D170 OAuth receipt is Worker-only. Older v139 Agent approval
  // remains historical proof, not authority to publish v140.
  if (receipt.code_scope === "D170_OFFICIAL_OAUTH_CALLBACK_PHASE3B") {
    assert.deepEqual(receipt.approved_components, ["worker"]);
    assert.equal(receipt.resource_change, "EXISTING_WORKER_OAUTH_CALLBACK_ONLY");
  } else {
    assert.deepEqual(receipt.approved_components, ["worker", "agent"]);
    assert.equal(receipt.resource_change, "NONE_EXISTING_WORKER_AGENT_ONLY");
  }
  assert.equal(receipt.domain_reassignment_permission, false);
});

test("phase3 cannot detach legacy domain or change the transaction authority", () => {
  assert.equal(receipt.change_id, "D170");
  assert.ok(["D170_OFFICIAL_CLIENT_HOST_PHASE3", "D170_OFFICIAL_OAUTH_CALLBACK_PHASE3B"].includes(receipt.code_scope));
  assert.equal(receipt.existing_worker_and_durable_object_preserved, true);
  assert.equal(receipt.legacy_android_package_preserved, true);
  assert.equal(receipt.stable_worker_deploy_permission, false);
  assert.equal(receipt.domain_reassignment_permission, false);
  assert.equal(receipt.single_official_domain_detach_permission, false);
  assert.match(currentWorker, /class_name = "InventoryCore"/);
});
