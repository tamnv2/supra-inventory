#!/usr/bin/env python3
"""D173-E261: exact-source Web3.3.20 UI-only release through the registered Worker."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "c4e6dca074cf0a73369c659a4e90e83f929b119f"
MARKER = "D173-E261_WEB3320_PRODUCTION_RELEASE:"
AUTH = ROOT / "ops/d173-e261-web3320-release-authorization.json"
WEB = {
    "web/src/operational-app.ts", "web/src/d173-tabler.css",
    "web/src/d173-overview.css", "web/src/web-version.ts", "web/package.json",
}
ALLOWED = WEB | {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e260-web-ui-code-only.yml",
    "tools/d173_e261_web3320_release_gate.py",
    "tests/d173-e260-web-ui-layout.test.mjs",
    "tests/d173-e261-web3320-release.test.mjs",
    "tests/d173-e252-web3318-overview.test.mjs",
    "tests/d173-e237-web3315-global-layout.test.mjs",
    "tests/d173-e247-web3317-contractors-roster.test.mjs",
    "tests/d173-e242-web3316-ui-consistency.test.mjs",
    "tests/d173-e233-web3314-cache-scroll.test.mjs",
    "tests/d173-e230-web3313-field-density.test.mjs",
    "tests/d173-e227-web3312-eight-ui.test.mjs",
    "docs/D173_E260_WEB3319_FIELD_LAYOUT_CODE_ONLY_2026-11-13.md",
    "docs/D173_E261_WEB3320_RELEASE_AUTHORIZATION_2026-11-13.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
    "ops/d173-e261-web3320-release-authorization.json",
}
PROTECTED = (
    "service/", "obpp1291/", "android/", "relay-agent/", "firebase/",
    "functions/", "pda-management/", "ops/apps-script/", "relay-agent-webview2-host/",
    "ops/change-continuity/D172.json", "docs/D172_",
)

def deny(why):
    raise SystemExit("D173_E261_RELEASE_DENIED:" + why)

def git(*args):
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        deny("GIT_" + args[0] + ":" + result.stderr.strip()[:150])
    return result.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "web"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()

    auth = json.loads(AUTH.read_text(encoding="utf-8"))
    required = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173-E261", "source_pr": 974,
        "owner_code_approved": True, "owner_production_release_approved": True,
        "owner_approval_reference": "OWNER_20261113_E260_CONTINUE_FINISH_CODE_AND_RELEASE",
        "base_main_sha": BASE, "web_target_version": "3.3.20",
        "approved_components": ["worker", "web"], "release_marker": MARKER,
        "scope": "WEB_UI_ONLY__EXISTING_WORKER_REPACK_WITHOUT_SERVICE_SOURCE_CHANGE",
        "d172_cross_regression_required": True, "d172_pending_hold": True,
        "agent_mutation": False, "android_mutation": False, "firebase_mutation": False,
        "stable_mutation": False, "new_provider_resources": False,
        "field_pass": False, "owner_pass": False,
    }
    for name, value in required.items():
        if auth.get(name) != value:
            deny("AUTH_" + name)
    if 'WEB_VERSION = "3.3.20"' not in (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8"):
        deny("VERSION_TS")
    if json.loads((ROOT / "web/package.json").read_text(encoding="utf-8"))["version"] != "3.3.20":
        deny("VERSION_PACKAGE")

    if args.preflight:
        origin = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("TWO_PARENT_MERGE_MARKER")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            deny("PROTECTED_MAIN_PUSH_ONLY")
        origin = parents[1]
    if origin != BASE:
        deny("BASE_DRIFT")

    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if not WEB.issubset(changed):
        deny("WEB_SOURCE_NOT_PINNED")
    if changed - ALLOWED:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED))[:240])
    if any(path.startswith(prefix) for prefix in PROTECTED for path in changed):
        deny("PROTECTED_MODULE_MUTATION")

    source = auth.get("source_code_sha", "")
    if len(source) != 40:
        deny("SOURCE_NOT_PINNED")
    git("merge-base", "--is-ancestor", source, "HEAD")
    if git("diff", "--name-only", source, "HEAD", "--", "web/", "service/"):
        deny("SOURCE_DRIFT_AFTER_PIN")
    if args.preflight:
        print("D173_E261_WEB3320_PREFLIGHT_PASS_NO_DEPLOY")
        return

    ci = auth.get("source_ci_sha", "")
    if len(ci) != 40:
        deny("CI_NOT_PINNED")
    git("merge-base", "--is-ancestor", ci, parents[2])
    if git("diff", "--name-only", ci, parents[2], "--", "web/", "service/", "tests/",
           ".github/workflows/", "tools/"):
        deny("CODE_DRIFT_AFTER_CI")
    for flag in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass",
                 "d172_isolation_pass", "authority_guard_pass"):
        if auth.get(flag) is not True:
            deny("CI_" + flag)
    if auth.get("required_ci_failed") != 0 or auth.get("required_ci_success", 0) < 1:
        deny("REQUIRED_CI_STATUS")
    if not auth.get("required_ci_run_ids"):
        deny("CI_RECEIPTS_MISSING")
    print("D173_E261_WEB3320_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
