#!/usr/bin/env python3
"""Owner-gated D173-E253 Web3.3.18 existing Inventory Worker/Web deployment."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "4ecb4cfebbddac1fc90f4aa29f2cd89e17f42a33"
MARKER = "D173-E253_WEB3318_PRODUCTION_RELEASE:"
AUTH_PATH = ROOT / "ops/d173-e253-web3318-release-authorization.json"
RUNTIME = {
    "web/src/operational-app.ts", "web/src/api.ts", "web/src/d173-overview.css",
    "web/src/web-version.ts", "web/package.json",
    "service/src/business-api.ts", "service/src/core.ts",
}
ALLOWED = RUNTIME | {
    "tests/d173-e252-web3318-overview.test.mjs",
    "tests/d167-web-ux-consistency.test.mjs",
    "tests/d173-e247-web3317-contractors-roster.test.mjs",
    "tests/d173-e242-web3316-ui-consistency.test.mjs",
    "tests/d173-e237-web3315-global-layout.test.mjs",
    "tests/d173-e233-web3314-cache-scroll.test.mjs",
    "tests/d173-e230-web3313-field-density.test.mjs",
    "tests/d173-e227-web3312-eight-ui.test.mjs",
    ".github/workflows/d173-e252-web3318-source.yml",
    ".github/workflows/deploy-beta.yml",
    "ops/d173-e253-web3318-release-authorization.json",
    "tools/d173_e253_web3318_release_gate.py",
    "docs/D173_E252_DASHBOARD_REVIEW_ONLY_2026-11-13.md",
    "docs/D173_E253_WEB3318_RELEASE_AUTHORIZATION_2026-11-13.md",
    "docs/specs/REPORTING_DASHBOARD.md", "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json", "ops/project-state.json",
    "ops/current-context.json", "ops/change-continuity/D173.json",
}
DENY = ("obpp1291/", "android/", "relay-agent/", "firebase/",
        "ops/change-continuity/D172.json", "docs/D172_", "service/wrangler.",
        "ops/project-scope.json", "ops/resource-registry.json", "pda-management/")

def fail(reason):
    raise SystemExit("D173_E253_RELEASE_DENIED:" + reason)

def git(*args):
    process = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if process.returncode:
        fail("GIT_" + args[0] + ":" + process.stderr.strip()[:160])
    return process.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=("worker", "web"))
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
    required = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173-E253", "source_pr": 970,
        "owner_approval_reference": "OWNER_20261113_HEADER_DASHBOARD_WEB3318_CODE_RELEASE",
        "owner_code_approved": True, "owner_production_release_approved": True,
        "base_main_sha": BASE, "web_target_version": "3.3.18",
        "approved_components": ["worker", "web"], "release_marker": MARKER,
        "worker_scope": "D173_READ_ONLY_ADMIN_OVERVIEW_COMBINED_EXISTING_SQL",
        "d172_cross_regression_required": True, "d172_pending_hold": True,
        "agent_mutation": False, "android_mutation": False,
        "firebase_mutation": False, "stable_mutation": False,
        "new_provider_resources": False,
    }
    for key, value in required.items():
        if auth.get(key) != value:
            fail("AUTH_" + key)
    web = (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8")
    package = json.loads((ROOT / "web/package.json").read_text(encoding="utf-8"))
    if 'WEB_VERSION = "3.3.18"' not in web or package["version"] != "3.3.18":
        fail("WRONG_WEB_VERSION")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("TWO_PARENT_MERGE_MARKER")
        if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        base = parents[1]
    if base != BASE:
        fail("BASE_DRIFT")
    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if not RUNTIME.issubset(changed):
        fail("REQUIRED_RUNTIME_PATHS")
    if changed - ALLOWED:
        fail("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED))[:240])
    if any(path.startswith(prefix) for path in changed for prefix in DENY):
        fail("CROSS_MODULE_OR_PROVIDER_CHANGE")
    source = str(auth.get("source_code_sha") or "")
    if len(source) != 40 or any(c not in "0123456789abcdef" for c in source):
        fail("SOURCE_PIN")
    git("merge-base", "--is-ancestor", source, "HEAD")
    if git("diff", "--name-only", source, "HEAD", "--", "web/", "service/"):
        fail("SOURCE_DRIFT_AFTER_PIN")
    if args.preflight:
        print("D173_E253_WEB3318_PREFLIGHT_PASS_NO_DEPLOY")
        return
    source_ci = str(auth.get("source_ci_sha") or "")
    if len(source_ci) != 40 or any(c not in "0123456789abcdef" for c in source_ci):
        fail("SOURCE_CI_NOT_PINNED")
    git("merge-base", "--is-ancestor", source_ci, parents[2])
    if git("diff", "--name-only", source_ci, parents[2], "--",
           "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        fail("CODE_DRIFT_AFTER_CI")
    for key in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass",
                "d172_isolation_pass", "authority_guard_pass"):
        if auth.get(key) is not True:
            fail("CI_" + key)
    if int(auth.get("required_ci_failed", -1)) != 0 or int(auth.get("required_ci_success", 0)) < 1:
        fail("CI_STATUS")
    if not auth.get("required_ci_run_ids"):
        fail("CI_RECEIPTS_MISSING")
    if auth.get("field_pass") is not False or auth.get("owner_pass") is not False:
        fail("OWNER_FIELD_NOT_INFERRED")
    print("D173_E253_WEB3318_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
