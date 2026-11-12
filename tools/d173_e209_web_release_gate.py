#!/usr/bin/env python3
"""D173-E209: fail-closed owner-scoped Worker/Web 3.3.7 Production gate."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
AUTH_PATH = ROOT / "ops/d173-e209-web-release-authorization.json"
MARKER = "D173-E209_WEB337_RESULTS_WORKER_PRODUCTION_RELEASE:"
RUNTIME = {
    "service/src/operational-v2-core.ts",
    "service/src/read-api.ts",
    "service/src/business-api.ts",
    "web/src/api.ts",
    "web/src/operational-app.ts",
    "web/src/d173-tabler.css",
    "web/src/web-version.ts",
    "web/package.json",
}
EXACT = RUNTIME | {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e209-web-results.yml",
    "ops/d173-e209-web-release-authorization.json",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
    "docs/OWNER_DECISIONS.md",
    "docs/specs/REPORTING_DASHBOARD.md",
    "docs/D173_WEB_RESULTS_UX_REVIEW_2026-11-12.md",
    "docs/D173_WEB_RESULTS_USAGE_FIRST_PLAN_2026-11-12.md",
    "tests/d173-e209-web-results.test.mjs",
    "tools/d173_e209_suffix_sql_regression.py",
    "tools/d173_e209_web_release_gate.py",
}
FORBIDDEN = (
    "obpp1291/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "firebase/", "functions/", "pda-management/", "ops/apps-script/",
    "service/src/obpp1291-", "service/wrangler.", "docs/D172_",
    "ops/change-continuity/D172.json", "ops/project-scope.json",
    "ops/resource-registry.json", ".github/workflows/release-obpp1291.yml",
)

def fail(message: str) -> None:
    raise SystemExit("D173_E209_RELEASE_DENIED:" + message)

def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        fail("GIT_" + args[0] + ":" + result.stderr.strip()[:140])
    return result.stdout.strip()

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "web"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
    fixed = {
        "change_id": "D173-E209",
        "owner_approval_reference": "OWNER_APPROVED_WEB_RESULT_UX_USAGE_STABILITY_SPEED_20261112",
        "owner_code_approved": True,
        "owner_production_release_approved": True,
        "source_pr": 942,
        "web_target_version": "3.3.7",
        "approved_components": ["worker", "web"],
        "release_marker": MARKER,
        "d172_pending_hold": True,
        "d172_cross_regression_required": True,
        "shared_worker_read_api_only": True,
        "sqlite_schema_mutation": False,
        "agent_mutation": False,
        "android_mutation": False,
        "d172_business_mutation": False,
        "stable_mutation": False,
        "firebase_mutation": False,
        "new_provider_resources": False,
    }
    for key, value in fixed.items():
        if auth.get(key) != value:
            fail("OWNER_SCOPE_" + key)
    if 'WEB_VERSION = "3.3.7"' not in (ROOT/"web/src/web-version.ts").read_text():
        fail("WEB_VERSION")
    if json.loads((ROOT/"web/package.json").read_text())["version"] != "3.3.7":
        fail("WEB_PACKAGE_VERSION")
    expected_base = auth.get("base_main_sha")
    if not isinstance(expected_base, str) or not re.fullmatch(r"[a-f0-9]{40}", expected_base):
        fail("BASE_INVALID")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("PROTECTED_TWO_PARENT_MERGE_MARKER_REQUIRED")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        base = parents[1]
    if base != expected_base:
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
        print("D173_E209_SCOPE_PREFLIGHT_PASS__RELEASE_STILL_GATED")
        return
    for key in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass",
                "sql_fixture_pass", "d172_isolation_pass"):
        if auth.get(key) is not True:
            fail("CI_PROOF_" + key)
    if auth.get("required_ci_failed") != 0 or int(auth.get("required_ci_success") or 0) < 4:
        fail("REQUIRED_CI_COUNTS")
    source_sha = auth.get("source_ci_sha")
    if not isinstance(source_sha, str) or not re.fullmatch(r"[a-f0-9]{40}", source_sha):
        fail("SOURCE_CI_PIN_INVALID")
    git("merge-base", "--is-ancestor", source_sha, "HEAD")
    runtime_delta = git("diff", "--name-only", source_sha, "HEAD", "--",
                        "service/src/", "web/src/", "web/package.json")
    if runtime_delta:
        fail("RUNTIME_CHANGED_AFTER_EXACT_CI:" + runtime_delta[:100])
    print("D173_E209_" + args.component.upper() + "_PINNED_WORKER_WEB_RELEASE_ALLOWED")

if __name__ == "__main__":
    main()
