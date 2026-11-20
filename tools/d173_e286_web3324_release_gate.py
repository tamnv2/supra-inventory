#!/usr/bin/env python3
"""D173-E286 Web3.3.24: exact-source Owner-authorized Inventory presentation-only release gate."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = "df7ae65b78005f093862ee944e71a2d757b3c49f"
MARKER = "D173-E286_WEB3324_PRODUCTION_RELEASE:"
AUTH_PATH = ROOT / "ops/d173-e286-web3324-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e283-web-ui-code-only.yml",
    ".github/workflows/deploy-beta.yml",
    "docs/OWNER_DECISIONS.md",
    "docs/D173_E286_WEB3324_RELEASE_AUTHORIZATION_2026-11-20.md",
    "ops/change-continuity/D173.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/d173-e286-web3324-release-authorization.json",
    "tests/d173-e283-inventory-preview.test.mjs",
    "tests/d173-e286-web3324-release.test.mjs",
    "tools/d173_e286_web3324_release_gate.py",
    "web/src/d173-inventory-preview.css",
    "web/src/operational-app.ts",
    "web/package.json",
    "web/src/web-version.ts",
}
PROTECTED = (
    "service/", "obpp1291/", "android/", "relay-agent/", "firebase/",
    "functions/", "pda-management/", "ops/apps-script/", "relay-agent-webview2-host/",
    "ops/change-continuity/D172.json", "docs/D172_",
)

def deny(reason: str) -> None:
    raise SystemExit("D173_E286_WEB3324_RELEASE_DENIED:" + reason)

def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        deny("GIT_" + args[0] + ":" + result.stderr.strip()[:180])
    return result.stdout.strip()

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=("worker", "web"))
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    if not AUTH_PATH.is_file():
        deny("AUTH_FILE_MISSING")
    a = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
    requirements = {
        "schema_version": 1, "project_key": "supra-inventory", "change_id": "D173-E286",
        "source_pr": 991, "owner_approval_reference": "OWNER_20261120_E286_DIRECT_PRODUCTION_WEB_VISUAL_TEST",
        "owner_code_approved": True, "owner_production_release_approved": True,
        "base_main_sha": BASE, "web_target_version": "3.3.24",
        "approved_components": ["worker", "web"], "release_marker": MARKER,
        "scope": "D173_WEB_PRESENTATION_ONLY__EXISTING_WORKER_ASSET_REPACK__NO_BUSINESS_SOURCE",
        "d172_cross_regression_required": True, "d172_pending_hold": True,
        "agent_mutation": False, "android_mutation": False, "firebase_mutation": False,
        "stable_mutation": False, "new_provider_resources": False,
        "field_pass": False, "owner_pass": False,
    }
    for key, value in requirements.items():
        if a.get(key) != value:
            deny("AUTH_" + key)
    if 'WEB_VERSION = "3.3.24"' not in (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8"):
        deny("VERSION_TS")
    if json.loads((ROOT / "web/package.json").read_text(encoding="utf-8")).get("version") != "3.3.24":
        deny("VERSION_PACKAGE")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("TWO_PARENT_MERGE_MARKER")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            deny("PROTECTED_MAIN_PUSH_ONLY")
        base = parents[1]
    if base != BASE:
        deny("BASE_DRIFT")
    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if changed - ALLOWED:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED))[:200])
    for path in changed:
        if any(path.startswith(prefix) for prefix in PROTECTED):
            deny("PROTECTED_MODULE_MUTATION:" + path)
    required = {
        "web/src/operational-app.ts", "web/src/d173-inventory-preview.css",
        "web/src/web-version.ts", "web/package.json",
        ".github/workflows/deploy-beta.yml", "tools/d173_e286_web3324_release_gate.py",
        "ops/d173-e286-web3324-release-authorization.json",
    }
    if not required.issubset(changed):
        deny("REQUIRED_SOURCE_MISSING")
    source = a.get("source_code_sha", "")
    if len(source) != 40:
        deny("SOURCE_NOT_PINNED")
    git("merge-base", "--is-ancestor", source, "HEAD")
    if git("diff", "--name-only", source, "HEAD", "--", "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("SOURCE_DRIFT_AFTER_PIN")
    if args.preflight:
        print("D173_E286_WEB3324_PREFLIGHT_PASS_NO_DEPLOY")
        return
    source_ci_sha = a.get("source_ci_sha", "")
    if len(source_ci_sha) != 40:
        deny("CI_NOT_PINNED")
    git("merge-base", "--is-ancestor", source_ci_sha, parents[2])
    if git("diff", "--name-only", source_ci_sha, parents[2], "--", "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("CODE_DRIFT_AFTER_CI")
    for flag in ("source_ci_verified", "web_build_pass", "d172_isolation_pass", "authority_guard_pass", "continuity_guard_pass"):
        if a.get(flag) is not True:
            deny("CI_" + flag)
    if a.get("required_ci_failed") != 0 or a.get("required_ci_success", 0) < 5:
        deny("REQUIRED_CI_STATUS")
    if len(a.get("required_ci_run_ids", [])) < 5:
        deny("CI_RECEIPTS_MISSING")
    print("D173_E286_WEB3324_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
