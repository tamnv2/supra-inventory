#!/usr/bin/env python3
"""D173-E217 exact-owner/CI/protected Web 3.3.10 production gate, D172 isolated."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "75cc1b812c9491bf904c37175d8cc498105e2b5b"
MARKER = "D173-E217_WEB3310_PRODUCTION_RELEASE:"
RUNTIME = {
    "web/src/operational-app.ts", "web/src/d173-tabler.css",
    "web/src/web-version.ts", "web/package.json",
}
ALLOWED = RUNTIME | {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e216-web-search-tabs-dates.yml",
    "tools/d173_e217_web3310_release_gate.py",
    "ops/d173-e217-web-release-authorization.json",
    "tests/d173-e216-web-search-tabs-dates.test.mjs",
    "tests/d173-e214-web339-field-six-issues.test.mjs",
    "docs/D173_E216_WEB339_SEARCH_TABS_DATES_FIELD_2026-11-12.md",
    "docs/D173_E217_WEB3310_RELEASE_2026-11-12.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
}
PROTECTED = (
    "obpp1291/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "firebase/", "functions/", "pda-management/", "ops/apps-script/",
    "service/", "docs/D172_", "ops/change-continuity/D172.json",
    "ops/project-scope.json", "ops/resource-registry.json",
)

def fail(message):
    raise SystemExit("D173_E217_RELEASE_DENIED:" + message)

def git(*args):
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        fail("GIT_" + args[0] + ":" + result.stderr.strip()[:180])
    return result.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "web"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads((ROOT / "ops/d173-e217-web-release-authorization.json").read_text())
    fixed = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173-E217",
        "owner_approval_reference": "OWNER_20261112_PHAT_HANH_WEB_AFTER_E216_CODE_CI",
        "owner_code_approved": True, "owner_production_release_approved": True,
        "source_pr": 950, "base_main_sha": BASE,
        "web_target_version": "3.3.10",
        "approved_components": ["worker", "web"], "release_marker": MARKER,
        "existing_worker_web_asset_only": True,
        "d172_cross_regression_required": True, "d172_pending_hold": True,
        "sqlite_schema_mutation": False, "agent_mutation": False,
        "android_mutation": False, "firebase_mutation": False,
        "d172_business_mutation": False, "stable_mutation": False,
        "new_provider_resources": False,
    }
    for key, value in fixed.items():
        if auth.get(key) != value:
            fail("OWNER_SCOPE_" + key)
    if 'WEB_VERSION = "3.3.10"' not in (ROOT / "web/src/web-version.ts").read_text():
        fail("WEB_VERSION")
    if json.loads((ROOT / "web/package.json").read_text())["version"] != "3.3.10":
        fail("PACKAGE_VERSION")
    if args.preflight:
        merge_base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("PROTECTED_TWO_PARENT_MERGE_MARKER_REQUIRED")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        merge_base = parents[1]
    if merge_base != BASE:
        fail("BASE_DRIFT_REQUIRES_REVIEW")
    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if not RUNTIME.issubset(changed):
        fail("REQUIRED_WEB_SOURCE_MISSING")
    if changed - ALLOWED:
        fail("UNAUTHORIZED_PATHS:" + ",".join(sorted(changed - ALLOWED))[:250])
    if any(path == prefix or path.startswith(prefix) for path in changed for prefix in PROTECTED):
        fail("PROTECTED_D172_OR_SERVICE_SCOPE_CHANGED")
    if args.preflight:
        print("D173_E217_WEB3310_PREFLIGHT_PASS_NO_PROVIDER_WRITES")
        return
    for key in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass", "sql_fixture_pass", "d172_isolation_pass"):
        if auth.get(key) is not True:
            fail("CI_EVIDENCE_" + key)
    if auth.get("required_ci_failed") != 0 or int(auth.get("required_ci_success") or 0) < 4:
        fail("CI_REQUIRED_RUNS")
    sha = auth.get("source_ci_sha")
    if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha):
        fail("SOURCE_SHA")
    git("merge-base", "--is-ancestor", sha, "HEAD")
    if git("diff", "--name-only", sha, "HEAD", "--",
           "web/src/", "web/package.json", ".github/workflows/deploy-beta.yml",
           "tools/d173_e217_web3310_release_gate.py",
           ".github/workflows/d173-e216-web-search-tabs-dates.yml"):
        fail("RUNTIME_OR_RELEASE_GATE_CHANGED_AFTER_SOURCE_CI")
    print("D173_E217_WEB3310_" + args.component.upper() + "_PINNED_RELEASE_ALLOWED")

if __name__ == "__main__":
    main()
