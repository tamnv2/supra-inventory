#!/usr/bin/env python3
"""Fail-closed, read-only schema/authority guard for active Dxxx discussion memory.

No network, provider mutation, write, secrets or background execution.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"OWNER_COMMAND", "DISCUSSION", "PROPOSAL", "DECISION",
         "TECHNICAL_FINDING", "TEST", "BLOCKER", "STATUS"}


def fail(reason: str) -> None:
    print("CHANGE_CONTINUITY_GUARD_FAIL: " + reason, file=sys.stderr)
    raise SystemExit(1)


def load(path: str) -> dict:
    target = ROOT / path
    if not target.is_file():
        fail("missing " + path)
    try:
        value = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        fail("invalid JSON " + path + ": " + str(exc))
    if not isinstance(value, dict):
        fail("not JSON object: " + path)
    return value


def main() -> None:
    manifest = load("ops/authority-manifest.json")
    state = load("ops/project-state.json")
    if state.get("project_key") != "supra-inventory":
        fail("project mismatch")

    change = state.get("change_control", {}).get("current_change_id")
    if not isinstance(change, str) or not re.fullmatch(r"D[0-9]{3,}", change):
        fail("invalid active Dxxx")
    journal_path = f"ops/change-continuity/{change}.json"

    if journal_path not in manifest.get("bootstrap_order", []):
        fail("active journal absent from complete working bootstrap")
    if "docs/CHANGE_CONTINUITY_PROTOCOL.md" not in manifest.get("bootstrap_order", []):
        fail("continuity policy absent from bootstrap")
    source_map = manifest.get("canonical_sources", {})
    if source_map.get("active_change_discussion") != journal_path:
        fail("manifest active journal pointer mismatch")
    if source_map.get("discussion_continuity_protocol") != "docs/CHANGE_CONTINUITY_PROTOCOL.md":
        fail("manifest policy pointer mismatch")
    if manifest.get("working_ref_discovery", {}).get("active_working_change_id") != change:
        fail("working PR resolution absent/mismatched")

    journal = load(journal_path)
    if journal.get("schema_version") != 1 or journal.get("project_key") != "supra-inventory":
        fail("invalid journal schema/project")
    if journal.get("source_repo") != "tamnv2/supra-inventory" or journal.get("change_id") != change:
        fail("journal repo/change mismatch")
    if journal.get("accepted_base") != state.get("change_control", {}).get("accepted_base_change_id") + "_LIMITED_OWNER_PASS":
        # Other Dxxx can have different Owner-PASS detail strings: for D167 the string is locked.
        if change == "D167":
            fail("accepted base mismatch")
    if journal.get("pr") != manifest.get("working_ref_discovery", {}).get("active_working_pr"):
        fail("PR pointer mismatch")
    if not journal.get("working_branch"):
        fail("missing active branch")

    entries = journal.get("entries")
    if not isinstance(entries, list) or not entries:
        fail("entries absent")
    seen = set()
    prev_date = ""
    for n, entry in enumerate(entries):
        if not isinstance(entry, dict):
            fail(f"non-object entry {n}")
        ident = entry.get("id")
        if not isinstance(ident, str) or not re.fullmatch(re.escape(change) + r"-E[0-9]{3,}", ident):
            fail(f"invalid entry id {ident}")
        if ident in seen:
            fail(f"duplicate entry {ident}")
        seen.add(ident)
        date = entry.get("date_vn")
        if not isinstance(date, str) or not re.fullmatch(r"20[0-9]{2}-[0-9]{2}-[0-9]{2}", date):
            fail(f"invalid entry date {ident}")
        if date < prev_date:
            fail("entries are out of VN-date order")
        prev_date = date
        if entry.get("kind") not in KINDS or not entry.get("status"):
            fail(f"kind/status missing: {ident}")
        if entry.get("owner_approval", "MISSING") not in (True, False, None):
            fail(f"owner approval invalid: {ident}")
        for field in ("topic", "next_action", "evidence"):
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                fail(f"missing {field}: {ident}")
        facts = entry.get("facts")
        if not isinstance(facts, list) or not facts or not all(isinstance(x, str) and x.strip() for x in facts):
            fail(f"facts missing: {ident}")
        if entry.get("kind") == "PROPOSAL" and entry.get("owner_approval") is True:
            fail(f"proposal falsely approved: {ident}")
        for older in entry.get("supersedes", []):
            if older not in seen:
                fail(f"supersedes nonexistent/future entry: {ident}->{older}")
    if not isinstance(journal.get("last_checkpoint"), dict) or journal["last_checkpoint"].get("date_vn") != prev_date:
        fail("stale last checkpoint date")
    resume = journal.get("resume", {})
    for key in ("approved", "implemented", "in_progress", "pending_approval", "blocked", "next_actions"):
        if not isinstance(resume.get(key), list):
            fail("resume missing " + key)
    if not isinstance(resume.get("release_boundary"), str):
        fail("resume release boundary missing")

    if change == "D167":
        gate = journal.get("deployment_gate", {})
        owner_latest = gate.get("owner_latest")
        if owner_latest == "2026-10-12 CODE_PASS_ONLY":
            if any(gate.get(x) is not False for x in ("merge_permission", "beta_deploy_permission", "stable_deploy_permission")):
                fail("Owner CODE PASS ONLY release gate violated")
            if state.get("d167", {}).get("pr559_owner_latest_2026_10_12", {}).get("owner_deploy_approval") is not False:
                fail("D167 state release gate mismatch")
        elif owner_latest == "2026-10-12 BETA_DEPLOY_APPROVED":
            authorization = load("ops/d167-release-authorization.json")
            if not gate.get("merge_permission") or not gate.get("beta_deploy_permission") or gate.get("stable_deploy_permission") is not False:
                fail("D167 Beta-only approval scope mismatch")
            if state.get("d167", {}).get("pr559_owner_latest_2026_10_12", {}).get("owner_deploy_approval") is not True:
                fail("D167 Owner approval missing")
            if authorization.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED":
                fail("D167 release receipt missing")
        elif owner_latest == "2026-10-13 AGENT_V128_BETA_ONLY_APPROVED":
            authorization = load("ops/d167-release-authorization.json")
            expected_ref = "OWNER_EXPLICIT_D167_DEPLOY_20261013_AGENT_V128_UI_SAFE_DIAGNOSTIC_BETA"
            if journal.get("pr") != 568 or journal.get("working_branch") != "d167-agent-tabs-order-20261013":
                fail("D167 Agent v128 PR scope mismatch")
            if gate.get("code_permission") is not True or gate.get("merge_permission") is not True or gate.get("beta_deploy_permission") is not True:
                fail("D167 Agent v128 Owner Beta approval missing")
            if gate.get("stable_deploy_permission") is not False or gate.get("new_owner_approval_required") is not False:
                fail("D167 Agent v128 stable/Owner gate mismatch")
            if gate.get("approved_components") != ["agent"]:
                fail("D167 Agent v128 component scope mismatch")
            if (authorization.get("schema_version") != 1 or authorization.get("change_id") != "D167"
                    or authorization.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
                    or authorization.get("approved_at_vn") != "2026-10-13"
                    or authorization.get("owner_approval_reference") != expected_ref
                    or authorization.get("approved_components") != ["agent"]
                    or not isinstance(authorization.get("approved_source_sha"), str)
                    or not re.fullmatch(r"[0-9a-f]{40}", authorization["approved_source_sha"])
                    or authorization["approved_source_sha"] != gate.get("approved_source_sha")):
                fail("D167 Agent v128 exact Owner authorization mismatch")
            if state.get("change_control", {}).get("pr568_release_gate") != expected_ref + "__STABLE_UNTOUCHED":
                fail("D167 Agent v128 state gate mismatch")
            approved = {e.get("id"): e for e in entries if e.get("owner_approval") is True}
            for ident in ("D167-E032", "D167-E033"):
                if approved.get(ident, {}).get("kind") != "OWNER_COMMAND" or approved[ident].get("date_vn") != "2026-10-13":
                    fail("D167 Agent v128 Owner decision journal missing")
            if "## D167 2026-10-13 — Owner xác nhận triển khai Agent Beta" not in (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
                fail("D167 Agent v128 Owner decision spec missing")
        elif owner_latest == "2026-10-13 SKU_WEB_PROVENANCE_BETA_APPROVED":
            authorization = load("ops/d167-release-authorization.json")
            expected_ref = "OWNER_EXPLICIT_D167_DEPLOY_20261013_WEB_SKU_PROVENANCE_BETA"
            if journal.get("pr") != 577 or journal.get("working_branch") != "d167-web-sku-provenance-layout-20261013":
                fail("D167 SKU catalog provenance PR/branch mismatch")
            if (gate.get("code_permission") is not True or gate.get("merge_permission") is not True
                    or gate.get("beta_deploy_permission") is not True or gate.get("stable_deploy_permission") is not False
                    or gate.get("approved_components") != ["worker"]
                    or gate.get("new_owner_approval_required") is not False):
                fail("D167 SKU catalog Owner-approved Beta scope mismatch")
            sha = authorization.get("approved_source_sha")
            if (authorization.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
                    or authorization.get("change_id") != "D167"
                    or authorization.get("approved_at_vn") != "2026-10-13"
                    or authorization.get("owner_approval_reference") != expected_ref
                    or authorization.get("approved_components") != ["worker"]
                    or not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha)
                    or sha != gate.get("approved_source_sha")):
                fail("D167 SKU Web/Worker receipt source/role mismatch")
            owner = {e.get("id"): e for e in entries}.get("D167-E049", {})
            if (owner.get("kind") != "OWNER_COMMAND" or owner.get("owner_approval") is not True
                    or owner.get("date_vn") != "2026-10-13"):
                fail("D167 SKU Web approval checkpoint missing")
            if state.get("change_control", {}).get("pr577_release_gate") != expected_ref + "__STABLE_UNTOUCHED":
                fail("D167 Web/Worker state gate mismatch")
            if "## D167 — Web Danh mục SKU nguồn xác thực (Owner 2026-10-13)" not in (
                    ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
                fail("D167 SKU Web approved decision not recorded")
        elif owner_latest == "2026-10-13 WEB_UI_ACCOUNT_MEAL_BETA_APPROVED":
            authorization = load("ops/d167-release-authorization.json")
            expected_ref = "OWNER_EXPLICIT_D167_DEPLOY_20261013_WEB_310_ACCOUNT_MEAL_BETA"
            if journal.get("pr") != 578 or journal.get("working_branch") != "d167-web-impact-analysis-20261013":
                fail("D167 Web 3.1.0 exact PR scope mismatch")
            if (gate.get("code_permission") is not True or gate.get("merge_permission") is not True
                    or gate.get("beta_deploy_permission") is not True or gate.get("stable_deploy_permission") is not False
                    or gate.get("approved_components") != ["worker"] or gate.get("new_owner_approval_required") is not False):
                fail("D167 Web 3.1.0 explicit Beta-only permission mismatch")
            sha = authorization.get("approved_source_sha")
            if (authorization.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
                    or authorization.get("change_id") != "D167"
                    or authorization.get("owner_approval_reference") != expected_ref
                    or authorization.get("approved_at_vn") != "2026-10-13"
                    or authorization.get("approved_components") != ["worker"]
                    or not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha)
                    or sha != gate.get("approved_source_sha")):
                fail("D167 Web 3.1.0 SHA/Owner receipt mismatch")
            checkpoint = {e.get("id"): e for e in entries}.get("D167-E053", {})
            if (checkpoint.get("kind") != "OWNER_COMMAND" or checkpoint.get("owner_approval") is not True
                    or checkpoint.get("date_vn") != "2026-10-13"):
                fail("D167 Web 3.1.0 full Owner approval not journaled")
            if state.get("change_control", {}).get("pr578_release_gate") != expected_ref + "__STABLE_UNTOUCHED":
                fail("D167 Web 3.1.0 state release boundary mismatch")
            if "## D167 — Web 3.1.0, lịch sử ca và Danh sách tài khoản thống nhất (Owner 2026-10-13)" not in (
                    ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
                fail("D167 Web 3.1.0 decision/spec not durable")
        elif owner_latest == "2026-10-13 WEB311_REPAIR_UNDER_E053_BETA_SCOPE":
            authorization = load("ops/d167-release-authorization.json")
            expected_ref = "OWNER_EXPLICIT_D167_DEPLOY_20261013_WEB_311_NOTPASS_REPAIR_BETA"
            if journal.get("pr") != 580 or journal.get("working_branch") != "d167-web-ux-notpass-comprehensive-20261013":
                fail("D167 Web 3.1.1 exact repair PR/branch mismatch")
            if (gate.get("code_permission") is not True or gate.get("merge_permission") is not True
                    or gate.get("beta_deploy_permission") is not True or gate.get("stable_deploy_permission") is not False
                    or gate.get("approved_components") != ["worker"] or gate.get("new_owner_approval_required") is not False):
                fail("D167 Web 3.1.1 not within Owner E053 Beta worker scope")
            sha = authorization.get("approved_source_sha")
            if (authorization.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED" or authorization.get("change_id") != "D167"
                    or authorization.get("owner_approval_reference") != expected_ref
                    or authorization.get("approved_components") != ["worker"]
                    or authorization.get("approved_at_vn") != "2026-10-13"
                    or not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha)
                    or sha != gate.get("approved_source_sha")):
                fail("D167 Web 3.1.1 source/beta receipt mismatch")
            checkpoints = {e.get("id"): e for e in entries}
            prior = checkpoints.get("D167-E053", {})
            not_pass = checkpoints.get("D167-E055", {})
            if (prior.get("kind") != "OWNER_COMMAND" or prior.get("owner_approval") is not True
                    or not_pass.get("kind") != "OWNER_COMMAND" or not_pass.get("owner_approval") is not False
                    or not_pass.get("date_vn") != "2026-10-13"):
                fail("D167 Web 3.1.1 original approval or latest NOT PASS missing")
            if state.get("change_control", {}).get("pr580_release_gate") != expected_ref + "__BETA_WORKER_ONLY_STABLE_UNTOUCHED":
                fail("D167 Web 3.1.1 state release scope mismatch")
            if "## D167 — Owner NOT PASS Web 3.1.0: khôi phục đồng nhất Web 3.1.1 (2026-10-13)" not in (
                    ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
                fail("D167 Web 3.1.1 Owner NOT PASS decision/spec missing")
        elif owner_latest == "2026-10-13 AGENT_V130_BETA_ONLY_APPROVED":
            # Subsequent explicit Owner command: Agent-only fixes from 12 October logs,
            # with combined code+Beta deployment. This is NOT an authorization for Web,
            # Service, Android, Firebase/RTDB rule changes or Stable.
            authorization = load("ops/d167-release-authorization.json")
            expected_ref = "OWNER_EXPLICIT_D167_DEPLOY_20261013_AGENT_V130_NONSKU_BETA"
            active_scope = (journal.get("pr"), journal.get("working_branch"))
            if active_scope not in (
                    (574, "d167-log-review-20261012-20261013"),
                    (576, "d167-agent-v130-release-evidence-20261013")):
                fail("D167 Agent v130 exact PR scope mismatch")
            if active_scope[0] == 576:
                # Post-release evidence is docs-only; technical release PASS never
                # implies physical Agent installation or D167 Owner/business PASS.
                released = {e.get("id"): e for e in entries}.get("D167-E048", {})
                if (released.get("kind") != "TEST"
                        or released.get("date_vn") != "2026-10-13"
                        or released.get("owner_approval") is not True
                        or journal.get("last_checkpoint", {}).get("id") != "D167-E048"
                        or gate.get("technical_release_pass") is not True
                        or gate.get("field_pass") is not False):
                    fail("D167 postrelease E048 evidence/field boundary mismatch")
            if (gate.get("code_permission") is not True or gate.get("merge_permission") is not True
                    or gate.get("beta_deploy_permission") is not True or gate.get("stable_deploy_permission") is not False
                    or gate.get("new_owner_approval_required") is not False
                    or gate.get("approved_components") != ["agent"]):
                fail("D167 Agent v130 component/Owner gate mismatch")
            sha = authorization.get("approved_source_sha")
            if (authorization.get("schema_version") != 1 or authorization.get("change_id") != "D167"
                    or authorization.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
                    or authorization.get("approved_at_vn") != "2026-10-13"
                    or authorization.get("owner_approval_reference") != expected_ref
                    or authorization.get("approved_components") != ["agent"]
                    or not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha)
                    or sha != gate.get("approved_source_sha")):
                fail("D167 Agent v130 exact approved source/receipt mismatch")
            if state.get("change_control", {}).get("pr574_release_gate") != expected_ref + "__STABLE_UNTOUCHED":
                fail("D167 Agent v130 change state release gate mismatch")
            approved = {e.get("id"): e for e in entries if e.get("owner_approval") is True}
            entry = approved.get("D167-E047", {})
            if entry.get("kind") != "OWNER_COMMAND" or entry.get("date_vn") != "2026-10-13":
                fail("D167 Agent v130 Owner command checkpoint missing")
            if "## D167 — Agent-only non-SKU v130 (Owner 2026-10-13)" not in (
                    ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
                fail("D167 Agent v130 Owner decision ledger missing")
        elif owner_latest == "2026-10-13 D167_OWNER_LIMITED_PASS_CLOSEOUT":
            # Owner accepts deployed D167 with no observed errors; docs-only transition.
            auth = load("ops/d167-release-authorization.json")
            if journal.get("pr") != 581 or journal.get("working_branch") != "d167-web-v311-release-evidence-20261013":
                fail("D167 closeout PR continuity mismatch")
            if (gate.get("code_permission") is not False or gate.get("beta_deploy_permission") is not False
                    or gate.get("stable_deploy_permission") is not False or gate.get("approved_components") != []):
                fail("D167 closeout cannot authorize any new deployment")
            if (auth.get("status") != "CODE_ONLY_NOT_APPROVED_FOR_DEPLOY"
                    or auth.get("approved_components") != [] or auth.get("approved_source_sha") is not None):
                fail("D167 closeout old release permission was not revoked")
            cp = {entry.get("id"): entry for entry in entries}
            if (cp.get("D167-E057", {}).get("kind") != "OWNER_COMMAND"
                    or cp["D167-E057"].get("owner_approval") is not True
                    or journal.get("last_checkpoint", {}).get("id") != "D167-E057"):
                fail("D167 Owner explicit limited PASS missing")
            control = state.get("change_control", {})
            if (control.get("accepted_base_change_id") != "D167"
                    or control.get("current_change_id") != "D167"
                    or control.get("next_change_allowed") is not True):
                fail("D167 next-change gate opened without accepted base")
            action = next((a for a in load("ops/owner-actions.json").get("actions", [])
                           if a.get("id") == "OA103"), {})
            if action.get("closed") is not True or action.get("owner_field_pass") is not False:
                fail("D167 limited PASS must close Owner action without inventing full field proof")
            if "## D167 — Owner PASS phạm vi Beta đã triển khai, mở D168 (2026-10-13)" not in (
                    ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
                fail("D167 owner signoff decision missing")
        elif owner_latest == "2026-10-13 PROCESS_POLICY_ONLY_NO_DEPLOY":
            # A later D167 Owner process/scope decision updates the active
            # journal but does NOT authorize any new executable deployment.
            # Historical v129 authorization is a completed prior release.
            if gate.get("code_permission") is not False or gate.get("merge_permission") is not False:
                fail("D167 process-only gate cannot authorize executable code/merge")
            if gate.get("beta_deploy_permission") is not False or gate.get("stable_deploy_permission") is not False:
                fail("D167 process-only gate cannot authorize Beta or Stable")
            if gate.get("approved_components") != [] or gate.get("new_owner_approval_required") is not True:
                fail("D167 process-only gate resource/approval mismatch")
            approved = {e.get("id"): e for e in entries if e.get("owner_approval") is True}
            owner_item = approved.get("D167-E046", {})
            if owner_item.get("kind") != "OWNER_COMMAND" or owner_item.get("date_vn") != "2026-10-13":
                fail("D167 latest Owner five-point command decision missing")
            scope = state.get("d167_owner_scope_commands_20261013", {})
            if scope.get("status") != "OWNER_APPROVED_PROCESS_AND_SCOPE__NO_RUNTIME_CHANGE":
                fail("D167 policy-only state marker missing")
            if scope.get("code_released_by_this_decision") is not False:
                fail("D167 policy-only decision falsely marked release")
            decisions = (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8")
            if "## D167 — Owner chốt lại danh sách pending và cách hiểu lệnh code/triển khai (2026-10-13)" not in decisions:
                fail("D167 Owner command semantics missing from decision ledger")
        elif owner_latest == "2026-10-13 P0_AGENT129_WORKER_BETA_APPROVED":
            authorization = load("ops/d167-release-authorization.json")
            expected_ref = "OWNER_EXPLICIT_D167_DEPLOY_20261013_P0_AGENT_V129_WORKER_BETA"
            if journal.get("pr") != 572 or journal.get("working_branch") != "d167-p0-ha-sku-v129-vietnamese-20261013":
                fail("D167 P0 Agent/Worker PR scope mismatch")
            if (gate.get("code_permission") is not True or gate.get("merge_permission") is not True
                    or gate.get("beta_deploy_permission") is not True or gate.get("stable_deploy_permission") is not False
                    or gate.get("new_owner_approval_required") is not False):
                fail("D167 P0 Agent/Worker Owner Beta approval mismatch")
            if gate.get("approved_components") != ["worker", "agent"]:
                fail("D167 P0 Agent/Worker component scope mismatch")
            if (authorization.get("schema_version") != 1 or authorization.get("change_id") != "D167"
                    or authorization.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
                    or authorization.get("approved_at_vn") != "2026-10-13"
                    or authorization.get("owner_approval_reference") != expected_ref
                    or authorization.get("approved_components") != ["worker", "agent"]
                    or not isinstance(authorization.get("approved_source_sha"), str)
                    or not re.fullmatch(r"[0-9a-f]{40}", authorization["approved_source_sha"])
                    or authorization["approved_source_sha"] != gate.get("approved_source_sha")):
                fail("D167 P0 exact Owner authorization mismatch")
            if state.get("change_control", {}).get("pr572_release_gate") != expected_ref + "__STABLE_OWNER_GATED":
                fail("D167 P0 state release gate mismatch")
            approved = {e.get("id"): e for e in entries if e.get("owner_approval") is True}
            if approved.get("D167-E042", {}).get("kind") != "OWNER_COMMAND":
                fail("D167 P0 Owner approval missing from continuity")
            if "## D167 — P0 Agent SKU authority and Vietnamese feedback (Owner 2026-10-13)" not in (
                    ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
                fail("D167 P0 Owner decision missing")
        else:
            fail("D167 latest Owner instruction missing")
        if "#559" not in (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8"):
            fail("Owner decision PR marker absent")

    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    protocol = (ROOT / "docs/OPERATING_PROTOCOL.md").read_text(encoding="utf-8")
    if "docs/CHANGE_CONTINUITY_PROTOCOL.md" not in agents or "docs/CHANGE_CONTINUITY_PROTOCOL.md" not in protocol:
        fail("mandatory repo-first rule not linked from bootstrap policies")
    print(f"CHANGE_CONTINUITY_GUARD_PASS change={change} entries={len(entries)} branch={journal['working_branch']}")


if __name__ == "__main__":
    main()
