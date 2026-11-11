#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def fail(msg: str) -> None:
    print(f"AUTHORITY_GUARD_FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

def load_json(path: str) -> dict:
    p = ROOT / path
    if not p.exists(): fail(f"missing {path}")
    try: return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc: fail(f"invalid JSON {path}: {exc}")

def main() -> None:
    manifest = load_json("ops/authority-manifest.json")
    state = load_json("ops/project-state.json")
    scope = load_json("ops/project-scope.json")
    if manifest.get("authority_model") != "REPO_NATIVE_COMPLETE": fail("authority model mismatch")
    if state.get("state_model") != "REPO_NATIVE_CONTINUITY_COMPLETE": fail("project state model mismatch")
    keys = {manifest.get("project_key"), state.get("project_key"), scope.get("project_key")}
    if keys != {"supra-inventory"}: fail(f"project key mismatch: {keys}")
    repo = scope.get("repository", {})
    if str(repo.get("id")) != "1372407002" or repo.get("name") != "tamnv2/supra-inventory": fail("repository scope mismatch")
    for path in manifest.get("bootstrap_order", []):
        if path in {"recent_commits_and_ci", "relevant_live_source"}: continue
        p = ROOT / path
        if path.endswith("/"):
            if not p.is_dir(): fail(f"missing directory {path}")
        elif not p.exists(): fail(f"missing bootstrap source {path}")
    specs = manifest.get("canonical_sources", {}).get("product_specs", [])
    if len(specs) < 9: fail("full spec coverage missing")
    spec_index = (ROOT / "docs/specs/README.md").read_text(encoding="utf-8")
    for path in specs:
        if not (ROOT / path).exists(): fail(f"missing canonical spec {path}")
        if Path(path).name not in spec_index: fail(f"spec index missing {path}")
    resources = scope.get("resources", [])
    if not resources: fail("project scope resources empty")
    seen = set()
    for r in resources:
        key = r.get("key")
        if not key or key in seen: fail(f"invalid/duplicate resource key {key}")
        seen.add(key)
        if not r.get("id") and not r.get("name"): fail(f"resource lacks id/name: {key}")
        if "secret_value" in r: fail(f"secret value field forbidden: {key}")
    for s in scope.get("secret_references", []):
        if s.get("value_in_repo") is not False: fail(f"secret reference must assert value_in_repo=false: {s.get('name')}")
    setup = state.get("authority_setup", {})
    if setup.get("status") != "PASS_COMPLETE": fail("authority setup not complete")
    for n in range(1, 6):
        if "PASS" not in str(next((v for k,v in setup.items() if k.startswith(f"requirement_{n}_")), "")): fail(f"requirement {n} not PASS")
    if not isinstance(state.get("workboard"), dict): fail("workboard missing")
    # The slim bootstrap is intentional. Historical source paths remain searchable
    # through canonical_sources and Git history, not an ever-growing default list.
    boot = manifest.get("bootstrap_order", [])
    if not isinstance(boot, list) or len(boot) > 24 or len(set(boot)) != len(boot):
        fail("bootstrap must contain <=24 unique current sources")
    for required in ("AGENTS.md", "docs/AI_WORKING_CONTRACT.md",
                     "docs/CHANGE_CONTINUITY_PROTOCOL.md", "ops/current-context.json",
                     "ops/project-scope.json", "ops/project-state.json",
                     "ops/change-continuity/D173.json", "docs/OWNER_DECISIONS.md"):
        if required not in boot:
            fail(f"missing current bootstrap source: {required}")

    # Compact index is an evidence-pinned convenience, never a replacement for
    # live GitHub PR/release checks. Fail if copied runtime pointers go stale.
    snapshot = load_json("ops/current-context.json")
    if snapshot.get("project_key") != "supra-inventory":
        fail("current-context project mismatch")
    if snapshot.get("active_change_id") != state.get("change_control", {}).get("current_change_id"):
        fail("active Dxxx mismatch in current-context")
    if snapshot.get("accepted_base_change_id") != state.get("change_control", {}).get("accepted_base_change_id"):
        fail("accepted base mismatch in current-context")
    if snapshot.get("as_of_vn", "") < state.get("last_updated", ""):
        fail("current-context older than project-state")
    work = snapshot.get("current_governance_work", {})
    ptr = manifest.get("working_ref_discovery", {})
    continuity = state.get("change_continuity", {})
    if work.get("pr") != ptr.get("active_working_pr") or work.get("pr") != continuity.get("working_pr"):
        fail("working PR pointer mismatch; check live GitHub separately")
    if work.get("checkpoint_id") != continuity.get("latest_checkpoint_id"):
        fail("latest checkpoint mismatch")

    production = snapshot.get("production", {})
    cs = state.get("current_status", {})
    beta = load_json("ops/resource-registry.json").get("environments", {}).get("beta", {})
    agent = production.get("agent", {}).get("tag", "")
    web_version = production.get("web", {}).get("version", "")
    android = production.get("android", {}).get("tag", "")
    apk_hash = production.get("android", {}).get("apk_sha256", "")
    if not agent.startswith("relay-agent-v") or agent not in beta.get("relay_agent_release", ""):
        fail("agent signed release mismatch with registry")
    agent_number = agent.removeprefix("relay-agent-v")
    if f"AGENT{agent_number}" not in cs.get("agent", ""):
        fail("agent top-level status stale")
    if agent == "relay-agent-v185":
        proof = state.get("d173_e187", {}).get("release_evidence", {})
        if (proof.get("tag") != agent or proof.get("exe_sha256") != production.get("agent", {}).get("sha256")
                or proof.get("host_build") != 14 or proof.get("run_id") != 42970510030):
            fail("latest verified D173-E187 Agent185 release proof mismatch")
    elif agent == "relay-agent-v188":
        proof = state.get("d173_e195_agent188", {}).get("release_evidence", {})
        if (proof.get("tag") != agent or proof.get("exe_sha256") != production.get("agent", {}).get("sha256")
                or proof.get("host_build") != 14 or proof.get("run_id") != 43044971567
                or proof.get("main_merge_sha") != "a8ff7fa267702655558ffcb1acd53b159ff1f2a6"
                or proof.get("field_pass") is not False or proof.get("owner_pass") is not False):
            fail("latest verified D173-E195 Agent188 release proof mismatch")
    elif agent == "relay-agent-v189":
        proof = state.get("d173_e196_agent189", {}).get("release_evidence", {})
        if (proof.get("tag") != agent or proof.get("exe_sha256") != production.get("agent", {}).get("sha256")
                or proof.get("exe_sha256") != "679065c708ee8856d023fe80b740b5ef71be92f84c6717a9a1acafdd2e907ba2"
                or proof.get("host_build") != 14 or proof.get("run_id") != 43070569628
                or proof.get("main_merge_sha") != "174572136cfe68d8bf7a0055edc5fec776dc60b8"
                or proof.get("field_pass") is not False or proof.get("owner_pass") is not False):
            fail("latest verified D173-E196 Agent189 release proof mismatch")
    elif agent == "relay-agent-v190":
        proof = state.get("d173_e201_agent190_release_receipt", {}).get("release_evidence", {})
        if (proof.get("tag") != agent or proof.get("exe_sha256") != production.get("agent", {}).get("sha256")
                or proof.get("exe_sha256") != "9cc585d951ff48272b8ae5f96c8c7311e2c9ad04701825696d7e00fef1bc0819"
                or proof.get("host_build") != 14 or proof.get("run_id") != 43086165497
                or proof.get("main_merge_sha") != "a92d7a30007493ba31f82da3c1e608b87c69491c"
                or proof.get("field_pass") is not False or proof.get("owner_pass") is not False):
            fail("latest verified D173-E201 Agent190 release proof mismatch")
    elif state.get("d173_e185", {}).get("agent_release_tag") != agent:
        fail("latest verified D173-E185 historical Agent release proof mismatch")
    if not web_version or f"WEB_{web_version.replace('.', '_')}" not in cs.get("web", ""):
        fail("web top-level version stale")
    if f"WEB_{web_version.replace('.', '_')}" not in beta.get("web_source_status", ""):
        fail("web registry version stale")
    if android != beta.get("latest_signed_beta_release"):
        fail("Android signed tag mismatch with registry")
    if android not in cs.get("latest_beta_apk", "") or "ANDROID_VC" + android.split("vc")[-1] not in cs.get("android", ""):
        fail("Android top-level status stale")
    if not apk_hash or apk_hash != beta.get("latest_signed_beta_apk_sha256"):
        fail("Android release artifact SHA mismatch")
    if cs.get("beta") != beta.get("status"):
        fail("Production environment status mismatch")
    if "OWNER_GATED" not in snapshot.get("stable", "") or "OWNER_GATED" not in cs.get("stable", ""):
        fail("Stable Owner gate lost")
    d172 = snapshot.get("d172", {})
    if d172.get("status") != "PENDING_HOLD__OWNER_CLOSE_REQUIRED" or d172.get("business_and_releases") != "INDEPENDENT":
        fail("D172 independent pending boundary lost")
    receipt = production.get("receipt", "")
    if not receipt or not (ROOT / receipt).is_file():
        fail("current Production release evidence missing")

    # Legacy handover/readiness views are derived historical exports; don't
    # reject newer canonical state merely because old prose was not regenerated.
    for derived in manifest.get("derived_views", []):
        path = ROOT / derived
        if not path.is_file() or "ops/project-state.json" not in path.read_text(encoding="utf-8"):
            fail(f"derived view lacks canonical state pointer: {derived}")
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for marker in ("ops/project-scope.json","docs/PROJECT_CONTEXT.md","ops/authority-manifest.json","docs/OPERATING_PROTOCOL.md"):
        if marker not in agents: fail(f"AGENTS bootstrap missing {marker}")
    decisions = (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8")
    for did in ("D027","D028","D029","D030","D031","D032"):
        if did not in decisions: fail(f"decision ledger missing {did}")
    print("AUTHORITY_GUARD_PASS")

if __name__ == "__main__": main()
