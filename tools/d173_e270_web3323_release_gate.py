#!/usr/bin/env python3
"""D173-E270: exact-source, Owner-gated Web3.3.23 UI-only production release."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "d08526b9fb549e3b8413659437d2ff2ee08a7b5a"
MARKER = "D173-E270_WEB3323_PRODUCTION_RELEASE:"
AUTH = ROOT / "ops/d173-e268-web3323-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e270-web3323-smart-lazy.yml",
    ".github/workflows/deploy-beta.yml",
    "docs/D173_E270_WEB3322_FIELD_SMART_LAZY_REVIEW_2026-11-14.md",
    "docs/OWNER_DECISIONS.md",
    "docs/specs/UI_DESIGN_SYSTEM.md",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/d173-e270-web3323-release-authorization.json",
    "tools/d173_e270_web3323_release_gate.py",
    "tests/d173-e270-release-guard.test.mjs",
    "tests/d173-e260-web-ui-layout.test.mjs",
    "tests/d173-e264-web-global-ui-rhythm.test.mjs",
    "tests/d173-e267-web-field-spacing.test.mjs",
    "tests/d173-e268-web3322-release.test.mjs",
    "tests/d173-e270-web-smart-lazy.test.mjs",
    "tests/d173-e230-web3313-field-density.test.mjs",
    "tests/d173-e237-web3315-global-layout.test.mjs",
    "tests/d173-e242-web3316-ui-consistency.test.mjs",
    "tests/d173-e252-web3318-overview.test.mjs",
    "web/package.json",
    "web/src/web-version.ts",
    "web/src/operational-app.ts",
    "web/src/d173-overview.css",
    "web/src/d173-tabler.css",
    "web/src/legacy-transplant/web-professional-v2.css",
    "web/src/legacy-transplant/web-unified-ui.css",
    "web/src/legacy-transplant/d167-web-ux-recovery.css",
    "web/src/legacy-transplant/d167-web-compact-accounts.css",
}
PROTECTED = (
    "service/", "obpp1291/", "android/", "relay-agent/", "firebase/",
    "functions/", "pda-management/", "ops/apps-script/", "relay-agent-webview2-host/",
    "ops/change-continuity/D172.json", "docs/D172_",
)

def deny(reason):
    raise SystemExit("D173_E270_RELEASE_DENIED:" + reason)

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
        "change_id": "D173-E270",
        "source_pr": 981,
        "owner_approval_reference": "OWNER_20261114_E270_SMART_LAZY_CODE_AND_PRODUCTION",
        "owner_code_approved": True,
        "owner_production_release_approved": True,
        "base_main_sha": BASE,
        "web_target_version": "3.3.23",
        "approved_components": ["worker", "web"],
        "release_marker": MARKER,
        "scope": "D173_WEB_UI_CSS_AND_PRESENTATION_ONLY__EXISTING_WORKER_ASSET_REPACK",
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
    if 'WEB_VERSION = "3.3.23"' not in (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8"):
        deny("VERSION_TS")
    if json.loads((ROOT / "web/package.json").read_text(encoding="utf-8")).get("version") != "3.3.23":
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
                     ".github/workflows/deploy-beta.yml", "tools/d173_e268_web3323_release_gate.py"}
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
        print("D173_E270_WEB3323_PREFLIGHT_PASS_NO_DEPLOY")
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
    print("D173_E270_WEB3323_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
