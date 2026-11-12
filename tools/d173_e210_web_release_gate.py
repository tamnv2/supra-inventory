#!/usr/bin/env python3
"""D173-E210: fail-closed owner-scoped Web 3.3.8/Worker field repair release."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MARKER = "D173-E210_WEB338_FIELD_REPAIR_PRODUCTION_RELEASE:"
RUNTIME = {
    "web/src/operational-app.ts", "web/src/api.ts", "web/src/d173-tabler.css",
    "web/src/web-version.ts", "web/package.json", "service/src/operational-v2-core.ts",
}
EXACT = RUNTIME | {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e209-web-results.yml",
    ".github/workflows/d173-e210-web-field.yml",
    "ops/d173-e210-web-release-authorization.json",
    "ops/project-state.json", "ops/change-continuity/D173.json",
    "docs/OWNER_DECISIONS.md", "docs/specs/REPORTING_DASHBOARD.md",
    "docs/D173_E210_WEB337_FIELD_REPAIR_2026-11-12.md",
    "tests/d173-e209-field-ui.test.mjs",
    "tests/d173-e209-web-results.test.mjs",
    "tests/d170-d171-release-parity.test.mjs",
    "tests/d173-e032-ui-code-only.test.mjs",
    "tests/d167-web-ux-consistency.test.mjs",
    "tools/d173_e210_withdrawn_identity_sql.py",
    "tools/d173_e210_web_release_gate.py",
    "tools/d173_e052_instrumentation_guard.py",
}
FORBIDDEN = (
    "obpp1291/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "firebase/", "functions/", "pda-management/", "ops/apps-script/",
    "service/src/obpp1291-", "service/wrangler.", "docs/D172_",
    "ops/change-continuity/D172.json", "ops/project-scope.json",
    "ops/resource-registry.json",
)

def fail(message):
    raise SystemExit("D173_E210_RELEASE_DENIED:" + message)

def git(*args):
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        fail("GIT_" + args[0] + ":" + result.stderr.strip()[:130])
    return result.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "web"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads((ROOT / "ops/d173-e210-web-release-authorization.json").read_text())
    fixed = {
        "change_id": "D173-E210",
        "owner_approval_reference": "OWNER_20261112_WEB337_FIELD_REPAIR_INSTRUCTIONS__CONTINUE_PREVIOUS_APPROVED_WEB_PRODUCTION",
        "owner_code_approved": True,
        "owner_production_release_approved": True,
        "web_target_version": "3.3.8",
        "approved_components": ["worker", "web"],
        "release_marker": MARKER,
        "d172_pending_hold": True, "d172_cross_regression_required": True,
        "shared_worker_read_api_only": True, "sqlite_schema_mutation": False,
        "agent_mutation": False, "android_mutation": False,
        "d172_business_mutation": False, "stable_mutation": False,
        "firebase_mutation": False, "new_provider_resources": False,
    }
    for key, value in fixed.items():
        if auth.get(key) != value:
            fail("OWNER_SCOPE_" + key)
    if not isinstance(auth.get("source_pr"), int) or auth["source_pr"] < 1:
        fail("PR_ID_MISSING")
    if 'WEB_VERSION = "3.3.8"' not in (ROOT/"web/src/web-version.ts").read_text():
        fail("WEB_VERSION")
    if json.loads((ROOT/"web/package.json").read_text())["version"] != "3.3.8":
        fail("WEB_PACKAGE_VERSION")
    base = auth.get("base_main_sha")
    if not isinstance(base, str) or not re.fullmatch(r"[0-9a-f]{40}", base):
        fail("BASE_INVALID")
    if args.preflight:
        actual_base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("PROTECTED_TWO_PARENT_MERGE_MARKER_REQUIRED")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        actual_base = parents[1]
    if actual_base != base:
        fail("ACCEPTED_BASE_DRIFT_REVIEW_REQUIRED")
    changed = set(git("diff", "--name-only", base, "HEAD").splitlines())
    extra = sorted(changed - EXACT)
    if extra:
        fail("UNAPPROVED_PATHS:" + ",".join(extra)[:220])
    if any(path == root or path.startswith(root) for path in changed for root in FORBIDDEN):
        fail("D172_OR_OTHER_MODULE_MUTATION")
    if not RUNTIME.issubset(changed):
        fail("INCOMPLETE_OWNER_APPROVED_WEB_WORKER_SOURCE")
    if args.preflight:
        print("D173_E210_WEB338_SCOPE_PREFLIGHT_PASS_NO_PROVIDER")
        return
    for key in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass",
                "sql_fixture_pass", "d172_isolation_pass"):
        if auth.get(key) is not True:
            fail("CI_PROOF_" + key)
    if auth.get("required_ci_failed") != 0 or int(auth.get("required_ci_success") or 0) < 4:
        fail("REQUIRED_CI_COUNTS")
    sha = auth.get("source_ci_sha")
    if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha):
        fail("SOURCE_CI_SHA_INVALID")
    git("merge-base", "--is-ancestor", sha, "HEAD")
    if git("diff", "--name-only", sha, "HEAD", "--", "web/src/", "web/package.json", "service/src/"):
        fail("RUNTIME_CHANGED_AFTER_EXACT_CI")
    print("D173_E210_" + args.component.upper() + "_WEB338_PINNED_RELEASE_ALLOWED")

if __name__ == "__main__":
    main()
