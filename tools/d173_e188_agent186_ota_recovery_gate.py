#!/usr/bin/env python3
"""D173-E188 Agent186 OTA recovery: immutable source, Owner scope and protected merge."""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = "6de3aed4465563a9818652afe03ee1203efd4188"
SOURCE = "61c056edba95597ce76a2fd6978c615958060754"
MARKER = "D173-E188_AGENT186_OTA_RECOVERY:"
ALLOWED = {
    ".github/workflows/d173-e188-agent186-ota-recovery.yml",
    "tools/d173_e188_agent186_ota_recovery_gate.py",
    "ops/d173-e188-agent186-ota-recovery-authorization.json",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
    "docs/D173_E188_AGENT186_OTA_RECOVERY_2026-11-11.md",
}
PROTECTED = ("relay-agent/", "relay-agent-webview2-host/", "service/", "web/",
             "android/", "obpp1291/", "firebase/", "functions/")

def deny(message):
    raise SystemExit("E188_AGENT186_OTA_RECOVERY_DENIED:" + message)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if p.returncode:
        deny("GIT_" + args[0] + ":" + p.stderr.strip()[-240:])
    return p.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    original = json.loads((ROOT / "ops/d173-e188-agent186-release-authorization.json").read_text(encoding="utf-8"))
    auth = json.loads((ROOT / "ops/d173-e188-agent186-ota-recovery-authorization.json").read_text(encoding="utf-8"))
    expected = {
        "project": "supra-inventory",
        "change": "D173-E188",
        "owner_instruction": "OWNER_20261111_AGENT186_RELEASE_RECOVERY_AFTER_MERGED_NO_TAG",
        "owner_release_approved": True,
        "target_version": 186,
        "unchanged_main_source": MAIN,
        "verified_source_sha": SOURCE,
        "reuse_host14": True,
        "web_worker_android_d172_stable_mutation": False,
        "provider_operations": False,
        "field_pass": False,
        "owner_pass": False,
    }
    for key, value in expected.items():
        if auth.get(key) != value:
            deny("AUTH_" + key)
    for key, value in {
        "change_id": "D173-E188", "owner_code_approved": True,
        "owner_protected_release_approved": True, "source_ci_verified": True,
        "native_agent_pass": True, "d172_regression_pass": True,
        "required_ci_failed": 0, "source_ci_sha": SOURCE,
        "agent_target_version": 186, "host_target_build": 14,
        "host_mutation": False, "worker_mutation": False, "web_mutation": False,
        "android_mutation": False, "obpp_mutation": False, "stable_mutation": False,
        "no_new_provider_requests": True
    }.items():
        if original.get(key) != value:
            deny("SOURCE_AUTH_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "186":
        deny("VERSION")
    if "AgentBuild = 186;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD")
    if "RequiredHostBuild = 14;" not in (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"):
        deny("HOST_BUILD")
    # The accepted original source is a merge ancestor; no runtime/provider
    # change is allowed between it and the recovery release.
    git("merge-base", "--is-ancestor", SOURCE, "HEAD")
    if git("diff", "--name-only", SOURCE, "HEAD", "--", *PROTECTED):
        deny("PROTECTED_SOURCE_CHANGED")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
        if base != MAIN:
            deny("MAIN_BASE_DRIFT")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or parents[1] != MAIN:
            deny("EXACT_TWO_PARENT_MERGE_BASE")
        if not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("MISSING_PROTECTED_RELEASE_MARKER")
        if git("rev-parse", "--abbrev-ref", "HEAD") not in ("HEAD", "main"):
            deny("MAIN_ONLY")
    changed = set(git("diff", "--name-only", MAIN, "HEAD").splitlines())
    if not changed or changed - ALLOWED:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED)))
    if ".github/workflows/d173-e188-agent186-ota-recovery.yml" not in changed:
        deny("RECOVERY_WORKFLOW_NOT_CHANGED")
    print("E188_AGENT186_OTA_RECOVERY_SCOPE_PASS_SOURCE_IMMUTABLE_HOST14_REUSED")

if __name__ == "__main__":
    main()
