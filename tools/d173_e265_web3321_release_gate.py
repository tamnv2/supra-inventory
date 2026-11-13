#!/usr/bin/env python3
"""D173-E265: exact-source, Owner-gated Web3.3.21 UI-only production release."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "d61292cf9053ca70c1a35c2a4a7b0ca179ec73a2"
MARKER = "D173-E265_WEB3321_PRODUCTION_RELEASE:"
AUTH = ROOT / "ops/d173-e265-web3321-release-authorization.json"
ALLOWED = {
    "web/src/d173-tabler.css", "web/src/web-version.ts", "web/package.json",
    "tests/d173-e264-web-global-ui-rhythm.test.mjs",
    "tests/d173-e265-web3321-release.test.mjs",
    "tests/d173-e230-web3313-field-density.test.mjs",
    "tests/d173-e237-web3315-global-layout.test.mjs",
    "tests/d173-e242-web3316-ui-consistency.test.mjs",
    "tests/d173-e252-web3318-overview.test.mjs",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e264-web-ui-code-only.yml",
    "tools/d173_e265_web3321_release_gate.py",
    "ops/d173-e265-web3321-release-authorization.json",
    "docs/D173_E264_WEB_GLOBAL_UI_RHYTHM_2026-11-13.md",
    "docs/D173_E265_WEB3321_RELEASE_AUTHORIZATION_2026-11-13.md",
    "docs/OWNER_DECISIONS.md", "docs/specs/UI_DESIGN_SYSTEM.md",
    "ops/authority-manifest.json", "ops/current-context.json",
    "ops/project-state.json", "ops/change-continuity/D173.json",
}
PROTECTED = (
    "service/", "obpp1291/", "android/", "relay-agent/", "firebase/",
    "functions/", "pda-management/", "ops/apps-script/", "relay-agent-webview2-host/",
    "ops/change-continuity/D172.json", "docs/D172_",
)

def deny(reason):
    raise SystemExit("D173_E265_RELEASE_DENIED:" + reason)

def git(*args):
    result = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        deny("GIT_" + args[0] + ":" + result.stderr.strip()[:160])
    return result.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "web"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    a = json.loads(AUTH.read_text(encoding="utf-8"))
    required = {
        "schema_version": 1,
        "project_key": "supra-inventory",
        "change_id": "D173-E265",
        "source_pr": 977,
        "owner_approval_reference": "OWNER_20261113_E264_COMPLETE_CODE_AND_PRODUCTION_RELEASE",
        "owner_code_approved": True,
        "owner_production_release_approved": True,
        "base_main_sha": BASE,
        "web_target_version": "3.3.21",
        "approved_components": ["worker", "web"],
        "release_marker": MARKER,
        "scope": "D173_WEB_UI_CSS_ONLY__EXISTING_WORKER_ASSET_REPACK_NO_SERVICE_CHANGE",
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
    for k, v in required.items():
        if a.get(k) != v:
            deny("AUTH_" + k)
    if 'WEB_VERSION = "3.3.21"' not in (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8"):
        deny("VERSION_TS")
    if json.loads((ROOT / "web/package.json").read_text(encoding="utf-8")).get("version") != "3.3.21":
        deny("VERSION_PACKAGE")
    if args.preflight:
        parent_base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("TWO_PARENT_MERGE_MARKER")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            deny("PROTECTED_MAIN_PUSH_ONLY")
        parent_base = parents[1]
    if parent_base != BASE:
        deny("BASE_DRIFT")

    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if changed - ALLOWED:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED))[:230])
    required_code = {"web/src/d173-tabler.css", "web/src/web-version.ts", "web/package.json",
                     ".github/workflows/deploy-beta.yml", "tools/d173_e265_web3321_release_gate.py"}
    if not required_code.issubset(changed):
        deny("REQUIRED_SOURCE_MISSING")
    if any(path.startswith(prefix) for path in changed for prefix in PROTECTED):
        deny("PROTECTED_MODULE_MUTATION")

    source = a.get("source_code_sha", "")
    if len(source) != 40:
        deny("SOURCE_NOT_PINNED")
    git("merge-base", "--is-ancestor", source, "HEAD")
    if git("diff", "--name-only", source, "HEAD", "--",
           "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("SOURCE_DRIFT_AFTER_PIN")
    if args.preflight:
        print("D173_E265_WEB3321_PREFLIGHT_PASS_NO_DEPLOY")
        return

    ci = a.get("source_ci_sha", "")
    if len(ci) != 40:
        deny("CI_NOT_PINNED")
    git("merge-base", "--is-ancestor", ci, parents[2])
    if git("diff", "--name-only", ci, parents[2], "--",
           "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("CODE_DRIFT_AFTER_CI")
    for flag in ("source_ci_verified", "web_build_pass", "d172_isolation_pass",
                 "authority_guard_pass", "continuity_guard_pass"):
        if a.get(flag) is not True:
            deny("CI_" + flag)
    if a.get("required_ci_failed") != 0 or a.get("required_ci_success", 0) < 4:
        deny("REQUIRED_CI_STATUS")
    if len(a.get("required_ci_run_ids", [])) < 4:
        deny("CI_RECEIPTS_MISSING")
    print("D173_E265_WEB3321_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
