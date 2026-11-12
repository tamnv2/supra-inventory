#!/usr/bin/env python3
"""D173-E214: Web 3.3.9 + read-only Worker, exact Owner/CI/protected release gate."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "D173-E214_WEB339_FIELD_REPAIR_PRODUCTION_RELEASE:"
RUNTIME = {
    "web/src/operational-app.ts",
    "web/src/d173-tabler.css",
    "web/src/d173-e036-unified-design.css",
    "web/src/web-version.ts",
    "web/package.json",
    "service/src/operational-v2-core.ts",
}
CODE_GUARD = RUNTIME | {".github/workflows/deploy-beta.yml", "tools/d173_e214_web339_release_gate.py"}
ALLOWED = CODE_GUARD | {
    "tests/d173-e209-web-results.test.mjs",
    "tests/d173-e214-web339-field-six-issues.test.mjs",
    "tools/d173_e210_withdrawn_identity_sql.py",
    ".github/workflows/d173-e214-web339.yml",
    "ops/d173-e214-web-release-authorization.json",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
    "docs/OWNER_DECISIONS.md",
    "docs/D173_E214_WEB339_FIELD_RELEASE_2026-11-12.md",
}
PROTECTED = (
    "obpp1291/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "firebase/", "functions/", "pda-management/", "ops/apps-script/",
    "service/src/obpp1291-", "service/wrangler.", "docs/D172_",
    "ops/change-continuity/D172.json", "ops/project-scope.json", "ops/resource-registry.json",
)

def fail(message):
    raise SystemExit("D173_E214_RELEASE_DENIED:" + message)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if p.returncode:
        fail("GIT_" + args[0] + ":" + p.stderr.strip()[:160])
    return p.stdout.strip()

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--component", choices=("worker", "web"), required=True)
    p.add_argument("--preflight", action="store_true")
    args = p.parse_args()
    auth = json.loads((ROOT/"ops/d173-e214-web-release-authorization.json").read_text())
    fixed = {
        "change_id": "D173-E214",
        "owner_approval_reference": "OWNER_20261112_WEB339_RELEASE_AFTER_WEB338_FIELD_FAIL",
        "owner_code_approved": True,
        "owner_production_release_approved": True,
        "source_pr": 947,
        "base_main_sha": "4775ace79a072241ae8832d32b4781f6efefb93a",
        "web_target_version": "3.3.9",
        "approved_components": ["worker", "web"],
        "release_marker": MARKER,
        "shared_worker_read_api_only": True,
        "d172_cross_regression_required": True,
        "d172_pending_hold": True,
        "sqlite_schema_mutation": False,
        "agent_mutation": False,
        "android_mutation": False,
        "firebase_mutation": False,
        "d172_business_mutation": False,
        "stable_mutation": False,
        "new_provider_resources": False,
    }
    for key, expected in fixed.items():
        if auth.get(key) != expected:
            fail("OWNER_SCOPE_" + key)
    if 'WEB_VERSION = "3.3.9"' not in (ROOT/"web/src/web-version.ts").read_text():
        fail("WEB_VERSION")
    if json.loads((ROOT/"web/package.json").read_text())["version"] != "3.3.9":
        fail("PACKAGE_VERSION")
    base = fixed["base_main_sha"]
    if args.preflight:
        resolved_base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("PROTECTED_TWO_PARENT_MERGE_MARKER_REQUIRED")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        resolved_base = parents[1]
    if resolved_base != base:
        fail("ACCEPTED_BASE_DRIFT")
    changed = set(filter(None, git("diff", "--name-only", base, "HEAD").splitlines()))
    if not RUNTIME.issubset(changed):
        fail("INCOMPLETE_WEB339_WORKER_CODE_SCOPE")
    extra = changed - ALLOWED
    if extra:
        fail("UNAPPROVED_PATHS:" + ",".join(sorted(extra))[:260])
    if any(path == prefix or path.startswith(prefix) for path in changed for prefix in PROTECTED):
        fail("D172_OR_UNRELATED_RESOURCE_MUTATION")
    if args.preflight:
        print("D173_E214_WEB339_SOURCE_SCOPE_PREFLIGHT_PASS_NO_PROVIDER_WRITES")
        return
    for key in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass", "sql_fixture_pass", "d172_isolation_pass"):
        if auth.get(key) is not True:
            fail("CI_PROOF_" + key)
    if auth.get("required_ci_failed") != 0 or int(auth.get("required_ci_success") or 0) < 4:
        fail("REQUIRED_CI_EVIDENCE")
    sha = auth.get("source_ci_sha")
    if not isinstance(sha, str) or not re.fullmatch("[0-9a-f]{40}", sha):
        fail("SOURCE_SHA")
    git("merge-base", "--is-ancestor", sha, "HEAD")
    if git("diff", "--name-only", sha, "HEAD", "--",
           "web/src/", "web/package.json", "service/src/operational-v2-core.ts",
           ".github/workflows/deploy-beta.yml", "tools/d173_e214_web339_release_gate.py"):
        fail("RUNTIME_OR_GATE_CHANGED_AFTER_CI")
    print("D173_E214_WEB339_" + args.component.upper() + "_PINNED_RELEASE_ALLOWED")

if __name__ == "__main__":
    main()
