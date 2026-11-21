#!/usr/bin/env python3
"""D173-E294: exact Web 3.3.23 tree rollback, unchanged current Worker/D172 business."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "163f05ac7db75ee232254c811c655069ec5f0638"
OLD_WEB = "70bd1f12b142642aafba02f1c9cb71b1d3a14214"
MARKER = "D173-E294_WEB3323_ROLLBACK_PRODUCTION_RELEASE:"
AUTH = ROOT / "ops/d173-e294-web3323-rollback-authorization.json"
ALLOWED = {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e294-web3323-rollback.yml",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
    "ops/d173-e294-web3323-rollback-authorization.json",
    "tools/d173_e294_web3323_rollback_gate.py",
    "tests/d173-e294-web3323-rollback.test.mjs",
    "web/src/operational-app.ts",
    "web/src/web-version.ts",
    "web/package.json",
    "web/src/pickpack-office.css",
    "web/src/d173-pickpack-business.css",
    "web/src/d173-inventory-preview.css",
}
PROTECTED = (
    "service/", "obpp1291/", "android/", "relay-agent/", "firebase/",
    "functions/", "pda-management/", "ops/apps-script/", "relay-agent-webview2-host/",
    "ops/change-continuity/D172.json", "docs/D172_",
)

def deny(reason):
    raise SystemExit("D173_E294_ROLLBACK_DENIED:" + reason)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if p.returncode:
        deny("GIT_" + args[0] + ":" + p.stderr.strip()[:150])
    return p.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "web"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    a = json.loads(AUTH.read_text(encoding="utf-8"))
    expected = {
        "schema_version": 1,
        "project_key": "supra-inventory",
        "change_id": "D173-E294",
        "owner_instruction": "2026-11-21_RESTORE_WEB_3_3_23_PRODUCTION",
        "owner_code_approved": True,
        "owner_production_release_approved": True,
        "base_main_sha": BASE,
        "previous_production_web": "3.3.25",
        "web_target_version": "3.3.23",
        "historical_web_main_sha": OLD_WEB,
        "approved_components": ["worker", "web"],
        "release_marker": MARKER,
        "scope": "D173_EXACT_WEB3323_TREE_ONLY__EXISTING_WORKER_WEB_ASSET_REPACK",
        "d172_cross_regression_required": True,
        "d172_pending_hold": True,
        "agent_mutation": False,
        "android_mutation": False,
        "firebase_mutation": False,
        "stable_mutation": False,
        "new_provider_resources": False,
        "field_pass": False,
        "owner_pass": False,
    }
    for key, value in expected.items():
        if a.get(key) != value:
            deny("AUTH_" + key)
    if not isinstance(a.get("source_pr"), int) or a["source_pr"] < 1:
        deny("SOURCE_PR_NOT_SET")
    if git("diff", "--name-only", OLD_WEB, "HEAD", "--", "web/"):
        deny("WEB_TREE_NOT_EQUAL_3_3_23")
    if 'WEB_VERSION = "3.3.23"' not in (ROOT / "web/src/web-version.ts").read_text():
        deny("VERSION_TS")
    if json.loads((ROOT / "web/package.json").read_text())["version"] != "3.3.23":
        deny("VERSION_PACKAGE")
    if args.preflight:
        actual_base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("TWO_PARENT_MERGE_MARKER")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            deny("PROTECTED_MAIN_PUSH_ONLY")
        actual_base = parents[1]
    if actual_base != BASE:
        deny("BASE_DRIFT")
    changed = set(git("diff", "--name-only", BASE, "HEAD").splitlines())
    if changed - ALLOWED:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED))[:220])
    if any(p.startswith(prefix) for p in changed for prefix in PROTECTED):
        deny("PROTECTED_MODULE_MUTATION")
    for p in ("web/src/operational-app.ts", "web/src/web-version.ts", "web/package.json",
              ".github/workflows/deploy-beta.yml", "tools/d173_e294_web3323_rollback_gate.py", ".github/workflows/d173-e294-web3323-rollback.yml",
              "ops/d173-e294-web3323-rollback-authorization.json", "tests/d173-e294-web3323-rollback.test.mjs"):
        if p not in changed:
            deny("REQUIRED_SOURCE_MISSING:" + p)
    source = a.get("source_code_sha") or ""
    if len(source) != 40:
        deny("SOURCE_NOT_PINNED")
    git("merge-base", "--is-ancestor", source, "HEAD")
    if git("diff", "--name-only", source, "HEAD", "--", "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("SOURCE_DRIFT_AFTER_PIN")
    if args.preflight:
        print("D173_E294_ROLLBACK_PREFLIGHT_PASS_NO_DEPLOY")
        return
    ci = a.get("source_ci_sha") or ""
    if len(ci) != 40:
        deny("CI_NOT_PINNED")
    git("merge-base", "--is-ancestor", ci, parents[2])
    if git("diff", "--name-only", ci, parents[2], "--", "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("CODE_DRIFT_AFTER_CI")
    for k in ("source_ci_verified", "web_build_pass", "historical_ui_tests_pass",
              "d172_isolation_pass", "authority_guard_pass", "continuity_guard_pass"):
        if a.get(k) is not True:
            deny("CI_" + k)
    if a.get("required_ci_failed") != 0 or a.get("required_ci_success", 0) < 4:
        deny("REQUIRED_CI_STATUS")
    if len(a.get("required_ci_run_ids", [])) < 4:
        deny("CI_RECEIPTS_MISSING")
    print("D173_E294_WEB3323_ROLLBACK_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
