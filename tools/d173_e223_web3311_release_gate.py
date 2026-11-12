#!/usr/bin/env python3
"""D173-E223: Web 3.3.11 exact Owner, CI, D172 and protected Production merge gate."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "da5f6948852777528ced565cf894b35364841ee0"
SOURCE = "1cb83f32da0e8c1d4b3f56528e0d3cbdd17c8db0"
MARKER = "D173-E223_WEB3311_PRODUCTION_RELEASE:"
RUNTIME = {"web/src/operational-app.ts", "web/src/d173-tabler.css", "web/src/web-version.ts", "web/package.json", "service/src/core.ts"}
ALLOWED = RUNTIME | {
    ".github/workflows/deploy-beta.yml", ".github/workflows/d173-e221-web-daily-local-search.yml",
    "tools/d173_e223_web3311_release_gate.py", "ops/d173-e223-web3311-release-authorization.json",
    "tests/d173-e221-web-daily-local-search.test.mjs",
    "docs/D173_E220_WEB_DAILY_CLIENT_SEARCH_REVIEW_2026-11-12.md",
    "docs/D173_E221_WEB_DAILY_LOCAL_SEARCH_IMPLEMENTATION_2026-11-12.md",
    "docs/D173_E223_WEB3311_PRODUCTION_RELEASE_2026-11-12.md", "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json", "ops/current-context.json", "ops/change-continuity/D173.json",
    "ops/project-state.json", "ops/resource-registry.json",
}
PROTECTED = ("obpp1291/", "android/", "relay-agent/", "relay-agent-webview2-host/",
             "firebase/", "functions/", "pda-management/", "ops/apps-script/",
             "service/src/obpp1291-", "service/wrangler.", "docs/D172_",
             "ops/change-continuity/D172.json", "ops/project-scope.json")

def fail(reason):
    raise SystemExit("D173_E223_RELEASE_DENIED:" + reason)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)
    if p.returncode:
        fail("GIT_" + args[0] + ":" + p.stderr.strip()[:160])
    return p.stdout.strip()

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--component", choices=("worker", "web"), required=True)
    p.add_argument("--preflight", action="store_true")
    args = p.parse_args()
    auth = json.loads((ROOT / "ops/d173-e223-web3311-release-authorization.json").read_text())
    fixed = {
        "schema_version": 1, "project_key": "supra-inventory", "change_id": "D173-E223",
        "owner_approval_reference": "OWNER_20261112_WEB3311_DEPLOY_REQUEST",
        "owner_code_approved": True, "owner_production_release_approved": True,
        "source_pr": 952, "base_main_sha": BASE, "web_target_version": "3.3.11",
        "approved_components": ["worker", "web"], "release_marker": MARKER,
        "shared_worker_bridge_only": True, "d172_cross_regression_required": True,
        "d172_pending_hold": True, "sqlite_schema_mutation": False,
        "agent_mutation": False, "android_mutation": False, "firebase_mutation": False,
        "d172_business_mutation": False, "stable_mutation": False, "new_provider_resources": False,
    }
    for key, value in fixed.items():
        if auth.get(key) != value:
            fail("SCOPE_" + key)
    if 'WEB_VERSION = "3.3.11"' not in (ROOT / "web/src/web-version.ts").read_text():
        fail("WEB_VERSION")
    if json.loads((ROOT / "web/package.json").read_text())["version"] != "3.3.11":
        fail("PACKAGE_VERSION")
    if args.preflight:
        resolved_base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("TWO_PARENT_OWNER_MARKER_REQUIRED")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        resolved_base = parents[1]
    if resolved_base != BASE:
        fail("MAIN_BASE_DRIFT")
    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if not RUNTIME.issubset(changed):
        fail("APPROVED_SOURCE_MISSING")
    if changed - ALLOWED:
        fail("UNAPPROVED_PATHS:" + ",".join(sorted(changed - ALLOWED))[:220])
    if any(path == prefix or path.startswith(prefix) for path in changed for prefix in PROTECTED):
        fail("D172_OR_PROVIDER_PROTECTED")
    if {p for p in changed if p.startswith("service/")} != {"service/src/core.ts"}:
        fail("SERVICE_CORE_BRIDGE_ONLY")
    if auth.get("source_ci_sha") != SOURCE or not re.fullmatch("[0-9a-f]{40}", SOURCE):
        fail("SOURCE_CI_PIN")
    git("merge-base", "--is-ancestor", SOURCE, "HEAD")
    if git("diff", "--name-only", SOURCE, "HEAD", "--", "web/", "service/src/core.ts", "tests/d173-e221-web-daily-local-search.test.mjs"):
        fail("CODE_CHANGED_AFTER_SCOPED_CI")
    if args.preflight:
        print("D173_E223_WEB3311_PREFLIGHT_PASS_NO_PROVIDER_WRITES")
        return
    for key in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass", "sql_fixture_pass", "d172_isolation_pass"):
        if auth.get(key) is not True:
            fail("CI_" + key)
    if auth.get("required_ci_failed") != 0 or auth.get("required_ci_success", 0) < 5:
        fail("REQUIRED_CI")
    print("D173_E223_WEB3311_" + args.component.upper() + "_PINNED_RELEASE_ALLOWED")

if __name__ == "__main__":
    main()
