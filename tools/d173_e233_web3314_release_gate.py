#!/usr/bin/env python3
"""D173-E233: Owner-scoped Web 3.3.14 UI-only Production release; D172 remains independent."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "99da97d69490f68818a5a1e49c566a0c5e12141b"
PIN = "2707623f53b932a3cb1cf892fd88f9d0879a76e0"
MARKER = "D173-E233_WEB3314_PRODUCTION_RELEASE:"
RUNTIME = {"web/src/operational-app.ts", "web/src/d173-tabler.css", "web/src/web-version.ts", "web/package.json"}
ALLOWED = RUNTIME | {
    ".github/workflows/deploy-beta.yml", ".github/workflows/d173-e233-web3314-cache-scroll.yml",
    "tools/d173_e233_web3314_release_gate.py", "ops/d173-e233-web3314-release-authorization.json",
    "tests/d173-e227-web3312-eight-ui.test.mjs", "tests/d173-e230-web3313-field-density.test.mjs",
    "tests/d173-e233-web3314-cache-scroll.test.mjs",
    "docs/D173_E233_WEB3313_FIELD_CACHE_SCROLL_REVIEW_2026-11-12.md",
    "docs/D173_E234_WEB3314_OWNER_DEPLOY_2026-11-12.md",
    "docs/OWNER_DECISIONS.md", "ops/authority-manifest.json", "ops/current-context.json",
    "ops/change-continuity/D173.json", "ops/project-state.json", "ops/resource-registry.json",
}
PROTECTED = ("obpp1291/", "service/", "android/", "relay-agent/", "relay-agent-webview2-host/",
             "firebase/", "functions/", "pda-management/", "ops/apps-script/",
             "service/wrangler.", "docs/D172_", "ops/change-continuity/D172.json",
             "ops/project-scope.json")

def fail(s):
    raise SystemExit("D173_E233_RELEASE_DENIED:" + s)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if p.returncode:
        fail("GIT_" + args[0] + ":" + p.stderr.strip()[:150])
    return p.stdout.strip()

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--component", required=True, choices=("worker", "web"))
    a.add_argument("--preflight", action="store_true")
    args = a.parse_args()
    auth = json.loads((ROOT / "ops/d173-e233-web3314-release-authorization.json").read_text())
    fixed = {
        "schema_version":1,"project_key":"supra-inventory","change_id":"D173-E233",
        "owner_approval_reference":"OWNER_20261112_DEPLOY_WEB3314_E233_FIELD_FIX",
        "owner_code_approved":True,"owner_production_release_approved":True,"source_pr":959,
        "base_main_sha":BASE,"source_code_sha":PIN,"web_target_version":"3.3.14",
        "approved_components":["worker","web"],"release_marker":MARKER,"web_ui_only":True,
        "worker_business_mutation":False,"d172_cross_regression_required":True,"d172_pending_hold":True,
        "agent_mutation":False,"android_mutation":False,"firebase_mutation":False,
        "stable_mutation":False,"sqlite_schema_mutation":False,"new_provider_resources":False,
    }
    for k,v in fixed.items():
        if auth.get(k) != v: fail("SCOPE_" + k)
    if 'WEB_VERSION = "3.3.14"' not in (ROOT/"web/src/web-version.ts").read_text(): fail("WEB_VERSION")
    if json.loads((ROOT/"web/package.json").read_text())["version"] != "3.3.14": fail("PACKAGE_VERSION")
    if args.preflight:
        accepted = git("merge-base","origin/main","HEAD")
    else:
        parents = git("rev-list","--parents","-n","1","HEAD").split()
        if len(parents) != 3 or not git("log","-1","--format=%s").startswith(MARKER):
            fail("OWNER_TWO_PARENT_MERGE_MARKER")
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
        accepted = parents[1]
    if accepted != BASE: fail("BASE_DRIFT")
    changed = set(filter(None,git("diff","--name-only",BASE,"HEAD").splitlines()))
    if not RUNTIME.issubset(changed): fail("REQUIRED_WEB_SOURCE")
    if changed - ALLOWED: fail("UNAPPROVED_PATHS:" + ",".join(sorted(changed-ALLOWED))[:240])
    if any(path.startswith(p) for p in PROTECTED for path in changed): fail("PROTECTED_BUSINESS_SCOPE")
    git("merge-base","--is-ancestor",PIN,"HEAD")
    if git("diff","--name-only",PIN,"HEAD","--","web/"):
        fail("WEB_RUNTIME_MODIFIED_AFTER_PIN")
    if not args.preflight:
        # CI must have checked the exact merged PR HEAD, never an older pin.
        if auth.get("source_ci_sha") != parents[2]:
            fail("CI_SHA_NOT_MERGED_PR_HEAD")
    if args.preflight:
        print("D173_E233_WEB3314_PREFLIGHT_PASS_NO_PROVIDER_MUTATION")
        return
    if not all(auth.get(k) is True for k in ("source_ci_verified","web_build_pass","d172_isolation_pass")):
        fail("SOURCE_CI_NOT_VERIFIED")
    if auth.get("required_ci_failed") != 0 or int(auth.get("required_ci_success") or 0) < 3:
        fail("REQUIRED_CI")
    print("D173_E233_WEB3314_" + args.component.upper() + "_PINNED_RELEASE_ALLOWED")

if __name__ == "__main__":
    main()
