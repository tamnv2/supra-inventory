#!/usr/bin/env python3
"""D173-E110 exact-owner scoped PR815 release: Worker/Web then signed Android vc122."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-e110-release-authorization.json"
BASE = "1ccb12a55a3104729881714953735a7654f9231b"
TESTED = "6f1692bbb349dca3dad982368d8631727a7ed523"
MARKER = "D173-E110_DO_OPTIMIZATION_RELEASE:"
SAFE_RELEASE_PATHS = {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/verify-apps.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/deploy-beta-agent-gateway.yml",
    ".github/workflows/verify-d171-agent-code-only.yml",
    "tests/d173-e034-release-gate.test.mjs",
    "tests/d173-e026-phase1-release.test.mjs",
    "tools/d167_release_gate.py",
    "tools/d173_e110_release_gate.py",
    "android/release-notes.json",
}
FROZEN_PATHS = (
    "obpp1291/", "firebase/", "firebase.json", "functions/",
    "ops/apps-script/", "relay-agent/", "relay-agent-webview2-host/",
    "pda-management/", "service/wrangler.stable.toml",
    "ops/project-scope.json", "ops/resource-registry.json",
)

def deny(reason):
    raise SystemExit("D173_E110_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT,
                          text=True, capture_output=True, check=False)

def paths_between(left, right, paths):
    r = git("diff", "--name-only", left, right, "--", *paths)
    if r.returncode:
        deny("SOURCE_DIFF_UNAVAILABLE")
    return set(r.stdout.splitlines())

def validate(component, preflight):
    try:
        receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("MISSING_OR_INVALID_APPROVAL")
    expected = {
        "schema_version": 1,
        "project_key": "supra-inventory",
        "change_id": "D173",
        "checkpoint_id": "D173-E110",
        "owner_approval_reference": "OWNER_20261101_PR815_CODE_VERIFIED_DEPLOY_PRODUCTION",
        "source_pr": 815,
        "source_code_sha": TESTED,
        "source_ci_success": 40,
        "source_ci_failed": 0,
        "source_ci_run": 41317351390,
        "source_main_base_sha": BASE,
        "production_host": "inventory.supra.cc.cd",
        "worker_resource_key": "worker-beta",
        "release_marker": MARKER,
        "merge_permission": True,
        "worker_web_deployment_permission": True,
        "android_signed_ota_permission": True,
        "android_target_version_code": 122,
        "desktop_agent_release_permission": False,
        "d172_business_mutation": False,
        "firebase_rules_mutation": False,
        "gateway_mutation": False,
        "other_provider_resource_mutation": False,
        "stable_deployment_permission": False,
        "sql_schema_recreation_permission": False,
        "owner_business_pass": False,
        "field_pass": False,
        "approved_order": [
            "worker_do_web", "android_signed_ota_after_same_sha_worker_health"
        ],
    }
    for key, value in expected.items():
        if receipt.get(key) != value:
            deny("OWNER_SCOPE_" + key)
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    if git("merge-base", "--is-ancestor", TESTED, "HEAD").returncode:
        deny("TESTED_CODE_NOT_ANCESTOR")
    if paths_between(TESTED, "HEAD", (
        "service/", "web/", "android/",
        ":!android/release-notes.json",
    )):
        deny("EXECUTABLE_CHANGED_AFTER_CODE_CI")
    if paths_between(BASE, "HEAD", FROZEN_PATHS):
        deny("AGENT_D172_FIREBASE_STABLE_OR_GATEWAY_DRIFT")
    # Shared provider workflows may gain ONLY a release-marker exclusion.
    for filename, anchor in (
        (".github/workflows/deploy-beta-firestore.yml",
         "startsWith(github.event.head_commit.message, 'D173-E104_AGENT162_ONLY_RELEASE:')"),
        (".github/workflows/deploy-beta-agent-gateway.yml",
         "startsWith(github.event.head_commit.message, 'D173-E034_UI_RELEASE:')"),
        (".github/workflows/verify-relay-agent.yml",
         "startsWith(github.event.head_commit.message, 'D170_PHASE3B_OAUTH_WORKER_ONLY:')"),
    ):
        baseline = git("show", BASE + ":" + filename)
        if baseline.returncode:
            deny("PROTECTED_WORKFLOW_BASE_UNAVAILABLE")
        candidate = (ROOT / filename).read_text(encoding="utf-8")
        addition = "startsWith(github.event.head_commit.message, 'D173-E110_DO_OPTIMIZATION_RELEASE:')"
        if baseline.stdout.count(anchor) != 1 or addition in baseline.stdout:
            deny("PROTECTED_WORKFLOW_BASE_CONFLICT")
        if candidate != baseline.stdout.replace(anchor, anchor + " || " + addition, 1):
            deny("PROTECTED_WORKFLOW_EXACT_SKIP_ONLY")
    additional = paths_between(TESTED, "HEAD", (
        ".github/workflows/", "tools/", "tests/", "android/release-notes.json",
    ))
    if additional - SAFE_RELEASE_PATHS:
        deny("UNAPPROVED_RELEASE_PATH:" + ",".join(sorted(additional - SAFE_RELEASE_PATHS)))
    try:
        notes = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("MISSING_RELEASE_NOTES")
    lines = notes.get("release_notes")
    if not (notes.get("schema_version") == 1 and isinstance(lines, list)
            and 1 <= len(lines) <= 5 and all(
                isinstance(x, str) and 12 <= len(x) <= 180 for x in lines)
            and "vc122" in " ".join(lines)):
        deny("ANDROID_VC122_RELEASE_NOTES")
    if preflight:
        print("D173_E110_" + component.upper() + "_PR_RELEASE_GATE_PASS")
        return
    if not (os.getenv("GITHUB_EVENT_NAME") == "push"
            and os.getenv("GITHUB_REF") == "refs/heads/main"
            and git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("EXPECTED_OWNER_MAIN_RELEASE_MARKER")
    print("D173_E110_" + component.upper() + "_RELEASE_AUTHORIZED")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "android"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    validate(args.component, args.preflight)
