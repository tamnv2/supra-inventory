#!/usr/bin/env python3
"""D173-E140 multi-component Owner-scoped SOURCE preflight, not release permission.

Distinct from historical E127/E130/D171 single-component release gates.
May only run on exact approved PR/branch; prevents Stable/D172 source mutations.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
def load(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))
def require(value: bool, why: str):
    if not value:
        raise SystemExit("D173_E140_SOURCE_PREFLIGHT_FAIL:" + why)

receipt = load("ops/d173-e140-release-authorization.json")
scope = load("ops/project-scope.json")
state = load("ops/project-state.json")
manifest = load("ops/authority-manifest.json")
j = load("ops/change-continuity/D173.json")
branch = "docs/d173-e140-picklist-confirm-guard-forensics-20261105"
require(os.environ.get("GITHUB_EVENT_NAME") == "pull_request", "PR_ONLY")
require(os.environ.get("GITHUB_HEAD_REF") == branch, "BRANCH_MISMATCH")
require(str(receipt.get("pr")) == "843" and receipt.get("working_branch") == branch, "PR_RECEIPT")
require(receipt.get("checkpoint_id") == "D173-E140" and receipt.get("change_id") == "D173", "CHANGE")
require(receipt.get("owner_source_approval") is True, "OWNER_SOURCE_APPROVAL")
require(receipt.get("owner_approval_reference") ==
    "OWNER_20261106_D173_E140_AGENT166_ANDROID_WORKER_FIRESTORE_SCOPED_PRODUCTION_TRIAL", "OWNER_REFERENCE")
require(receipt.get("approved_components") == ["agent","android","worker","firestore-rules"], "COMPONENTS")
for k in ("source_ci_verified","production_release_verified","field_pass","owner_pass","stable_deployment_permission","d172_business_mutation"):
    require(receipt.get(k) is False, "MUST_STAY_FAIL_CLOSED_" + k)
require(receipt.get("d172_status") == "PENDING_HOLD" and
    state["d173_e140"]["d172"] == "PENDING_HOLD_UNCHANGED", "D172_HOLD")
require(state["d173_e140"]["pr"] == 843 and state["d173_e140"]["owner_pass"] is False, "E140_STATE")
require(j["pr"] == 843 and any(x.get("id") == "D173-E140" and
    x.get("owner_approval") is True for x in j["entries"]), "CONTINUITY")
require(manifest["working_ref_discovery"]["active_working_pr"] == 843, "MANIFEST")
require(scope.get("repository") is not None, "RESOURCE_SCOPE_MISSING")
files = subprocess.check_output(
    ["git","diff","--name-only","origin/main...HEAD"],text=True,cwd=ROOT).splitlines()
require(files, "EMPTY_CHANGESET")
for path in files:
    require(not path.startswith((".github/workflows/deploy-stable","d172/", "apps/d172/")) and
            not path.endswith(".pem") and not path.endswith(".key"), "FORBIDDEN_PATH_" + path)
    # Approved E140 may touch existing shared Worker/Rules, only if independent
    # D172 backend, Firestore emulator and release gates also run on this SHA.
if "firebase/firestore.rules" in files:
    rules = (ROOT/"firebase/firestore.rules").read_text()
    require("function pickerShiftStillValid()" in rules and
        "request.auth.token.picker_shift_logout_at_ms > request.time.toMillis()" in rules,
        "SIGNED_SHIFT_RULES")
require((ROOT/"relay-agent/VERSION").read_text().strip() == "166", "AGENT_VERSION")
print("D173_E140_SOURCE_SCOPE_PASS__NO_RELEASE_AUTHORIZATION")
