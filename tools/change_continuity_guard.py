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
