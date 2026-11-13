#!/usr/bin/env python3
"""D173-E249 Owner-authorized Web 3.3.17 + additive D173 contractor catalog release gate."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "648cbe69d4925aa8a61c7ff978b798711d9e9ab3"
MARKER = "D173-E249_WEB3317_PRODUCTION_RELEASE:"
AUTH_PATH = ROOT / "ops/d173-e249-web3317-release-authorization.json"
RUNTIME = {
    "service/src/core.ts", "service/src/user-management-api.ts",
    "service/src/user-management-core.ts", "web/src/api.ts",
    "web/src/operational-app.ts", "web/src/hr-web-panel.ts",
    "web/src/d173-tabler.css", "web/src/web-version.ts", "web/package.json",
}
ALLOWED = RUNTIME | {
    "tests/d173-e227-web3312-eight-ui.test.mjs",
    "tests/d173-e230-web3313-field-density.test.mjs",
    "tests/d173-e233-web3314-cache-scroll.test.mjs",
    "tests/d173-e237-web3315-global-layout.test.mjs",
    "tests/d173-e242-web3316-ui-consistency.test.mjs",
    "tests/d173-e247-web3317-contractors-roster.test.mjs",
    ".github/workflows/d173-e247-web3317-source.yml",
    ".github/workflows/deploy-beta.yml",
    "tools/d173_e249_web3317_release_gate.py",
    "ops/d173-e249-web3317-release-authorization.json",
    "ops/authority-manifest.json", "ops/project-state.json",
    "ops/change-continuity/D173.json", "docs/OWNER_DECISIONS.md",
    "docs/D173_E249_WEB3317_RELEASE_AUTHORIZATION_2026-11-13.md",
}
DENY = ("obpp1291/", "android/", "relay-agent/", "relay-agent-webview2-host/",
        "firebase/", "functions/", "pda-management/", "ops/apps-script/",
        "ops/change-continuity/D172.json", "docs/D172_",
        "service/wrangler.", "ops/project-scope.json", "ops/resource-registry.json")


def fail(reason):
    raise SystemExit("D173_E249_RELEASE_DENIED:" + reason)


def git(*args):
    proc = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)
    if proc.returncode:
        fail("GIT_" + args[0] + ":" + proc.stderr.strip()[:160])
    return proc.stdout.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=("worker", "web"))
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
    fields = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173-E249", "source_pr": 968,
        "owner_approval_reference": "OWNER_20261113_DONE_CODE_PRODUCTION_WEB3317",
        "owner_code_approved": True, "owner_production_release_approved": True,
        "base_main_sha": BASE, "web_target_version": "3.3.17",
        "approved_components": ["worker", "web"], "release_marker": MARKER,
        "worker_scope": "D173_CONTRACTOR_CATALOG_ADDITIVE_ONLY",
        "d172_cross_regression_required": True, "d172_pending_hold": True,
        "agent_mutation": False, "android_mutation": False,
        "firebase_mutation": False, "stable_mutation": False,
        "new_provider_resources": False,
    }
    for key, expected in fields.items():
        if auth.get(key) != expected:
            fail("AUTH_" + key)
    if 'WEB_VERSION = "3.3.17"' not in (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8"):
        fail("WEB_VERSION")
    if json.loads((ROOT / "web/package.json").read_text(encoding="utf-8"))["version"] != "3.3.17":
        fail("PACKAGE_VERSION")

    if args.preflight:
        parent = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("TWO_PARENT_MERGE_MARKER")
        if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        parent = parents[1]
    if parent != BASE:
        fail("BASE_DRIFT")

    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if not RUNTIME.issubset(changed):
        fail("REQUIRED_RUNTIME_PATHS")
    if changed - ALLOWED:
        fail("UNAPPROVED_PATHS:" + ",".join(sorted(changed - ALLOWED))[:220])
    if any(path.startswith(prefix) for path in changed for prefix in DENY):
        fail("PROTECTED_D172_PROVIDER_PATH")
    source = str(auth.get("source_code_sha") or "")
    if len(source) != 40 or any(ch not in "0123456789abcdef" for ch in source):
        fail("SOURCE_SHA_INVALID")
    git("merge-base", "--is-ancestor", source, "HEAD")
    if git("diff", "--name-only", source, "HEAD", "--", "web/", "service/"):
        fail("SOURCE_CHANGED_AFTER_PIN")

    if args.preflight:
        print("D173_E249_WEB3317_PREFLIGHT_PASS_NO_PROVIDER_MUTATION")
        return

    ci = str(auth.get("source_ci_sha") or "")
    if len(ci) != 40 or any(ch not in "0123456789abcdef" for ch in ci):
        fail("SOURCE_CI_SHA_INVALID")
    git("merge-base", "--is-ancestor", ci, parents[2])
    if git("diff", "--name-only", ci, parents[2], "--",
           "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        fail("CODE_OR_GUARD_CHANGED_AFTER_CI")
    for k in ("source_ci_verified", "web_build_pass", "worker_typecheck_pass",
              "d172_isolation_pass", "authority_guard_pass"):
        if auth.get(k) is not True:
            fail("CI_FLAG_" + k)
    if int(auth.get("required_ci_failed", -1)) != 0:
        fail("CI_FAILED")
    if int(auth.get("required_ci_success", 0)) < 5:
        fail("CI_INCOMPLETE")
    if not isinstance(auth.get("required_ci_run_ids"), list) or len(auth["required_ci_run_ids"]) < 5:
        fail("CI_PROOF_MISSING")
    print("D173_E249_WEB3317_" + args.component.upper() + "_PINNED_RELEASE_ALLOWED")


if __name__ == "__main__":
    main()
