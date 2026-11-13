#!/usr/bin/env python3
"""D173-E262: Owner-authorized Web3.3.20 post-secret propagation recovery only."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "099d01571399cf57615f6efbbf34f61c03d265ec"
MARKER = "D173-E262_WEB3320_RECOVERY_RELEASE:"
AUTH = ROOT / "ops/d173-e262-web3320-recovery-authorization.json"
ALLOWED = {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e262-web3320-postsecret-readback.yml",
    "tools/d173_e262_web3320_recovery_gate.py",
    "tests/d173-e262-web3320-recovery.test.mjs",
    "ops/d173-e262-web3320-recovery-authorization.json",
    "docs/D173_E262_WEB3320_POSTSECRET_RELEASE_RECOVERY_2026-11-13.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
}
PROTECTED = ("web/", "service/", "obpp1291/", "android/", "relay-agent/",
             "firebase/", "functions/", "pda-management/", "ops/apps-script/",
             "relay-agent-webview2-host/", "ops/change-continuity/D172.json", "docs/D172_")

def deny(reason):
    raise SystemExit("D173_E262_RELEASE_DENIED:" + reason)

def git(*args):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        deny("GIT_" + args[0] + ":" + r.stderr.strip()[:140])
    return r.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=("web", "worker"))
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    d = json.loads(AUTH.read_text(encoding="utf-8"))
    checks = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173-E262", "source_pr": 975,
        "owner_approval_reference": "OWNER_20261113_E260_FINISH_RELEASE__POSTSECRET_TECHNICAL_RECOVERY",
        "owner_production_release_approved": True,
        "base_main_sha": BASE, "web_target_version": "3.3.20",
        "approved_components": ["worker", "web"], "release_marker": MARKER,
        "scope": "POSTSECRET_READBACK_BOUNDED_RETRY_ONLY_NO_PRODUCT_MUTATION",
        "d172_pending_hold": True, "stable_mutation": False,
        "agent_mutation": False, "android_mutation": False,
        "firebase_mutation": False, "new_provider_resources": False,
        "field_pass": False, "owner_pass": False,
    }
    for k, v in checks.items():
        if d.get(k) != v:
            deny("AUTH_" + k)
    if 'WEB_VERSION = "3.3.20"' not in (ROOT / "web/src/web-version.ts").read_text():
        deny("WEB_VERSION_DRIFT")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("MERGE_MARKER")
        if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
            deny("MAIN_PUSH_ONLY")
        base = parents[1]
    if base != BASE:
        deny("BASE_DRIFT")
    changed = set(filter(None, git("diff", "--name-only", BASE, "HEAD").splitlines()))
    if ".github/workflows/deploy-beta.yml" not in changed or changed - ALLOWED:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED))[:180])
    if any(x.startswith(p) for x in changed for p in PROTECTED):
        deny("PROTECTED_SOURCE_CHANGED")
    source = d.get("source_code_sha", "")
    if len(source) != 40:
        deny("SOURCE_NOT_PINNED")
    git("merge-base", "--is-ancestor", source, "HEAD")
    if git("diff", "--name-only", source, "HEAD", "--",
           "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("SOURCE_DRIFT_AFTER_PIN")
    if args.preflight:
        print("D173_E262_RECOVERY_PREFLIGHT_PASS_NO_DEPLOY")
        return
    ci = d.get("source_ci_sha", "")
    if len(ci) != 40:
        deny("CI_NOT_PINNED")
    git("merge-base", "--is-ancestor", ci, parents[2])
    if git("diff", "--name-only", ci, parents[2], "--",
           "web/", "service/", "tests/", ".github/workflows/", "tools/"):
        deny("CI_SOURCE_DRIFT")
    if not all(d.get(k) is True for k in ("ci_scoped_pass", "authority_guard_pass", "d172_isolation_pass")):
        deny("CI_NOT_PASS")
    if d.get("required_ci_failed") != 0 or not d.get("required_ci_run_ids"):
        deny("REQUIRED_CI_MISSING")
    print("D173_E262_RECOVERY_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
