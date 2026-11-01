#!/usr/bin/env python3
"""D173-E110: strict owner-scoped Worker/Web -> signed Android release for PR815."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-e110-release-authorization.json"
BASE = "1ccb12a55a3104729881714953735a7654f9231b"
PIN = "6f1692bbb349dca3dad982368d8631727a7ed523"
MARKER = "D173-E110_DO_OPTIMIZATION_RELEASE:"

def deny(reason):
    raise SystemExit("D173_E110_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["worker", "android"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        auth = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("MISSING_RECEIPT")
    expected = {
        "schema_version": 1, "project_key": "supra-inventory", "change_id": "D173",
        "checkpoint_id": "D173-E110",
        "owner_approval_reference": "OWNER_20261101_PR815_CODE_VERIFIED_DEPLOY_PRODUCTION",
        "source_pr": 815, "source_code_sha": PIN,
        "source_ci_success": 40, "source_ci_failed": 0, "source_ci_run": 41317351390,
        "source_main_base_sha": BASE,
        "production_host": "inventory.supra.cc.cd", "worker_resource_key": "worker-beta",
        "release_marker": MARKER, "merge_permission": True,
        "worker_web_deployment_permission": True, "android_signed_ota_permission": True,
        "android_target_version_code": 122, "desktop_agent_release_permission": False,
        "d172_business_mutation": False, "firebase_rules_mutation": False,
        "gateway_mutation": False, "other_provider_resource_mutation": False,
        "stable_deployment_permission": False, "sql_schema_recreation_permission": False,
        "owner_business_pass": False, "field_pass": False, "release_technical_pass": False,
        "approved_order": ["worker_do_web", "android_signed_ota_after_same_sha_worker_health"],
    }
    for key, value in expected.items():
        if auth.get(key) != value:
            deny("OWNER_SCOPE_" + key)
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    if git("merge-base", "--is-ancestor", PIN, "HEAD").returncode:
        deny("EXACT_SOURCE_CI_PIN_NOT_ANCESTOR")
    # No change to tested application after green CI. New OTA changelog is metadata only.
    for names in [
        ("service/", "web/", "android/", ":!android/release-notes.json"),
        ("tools/d173_e108_snapshot_regression.mjs", "tools/d173_e109_command_regression.mjs",
         "tools/d173_e109_audience_regression.mjs", "tests/d173-e108-client-transport.test.mjs")
    ]:
        if git("diff", "--name-only", PIN, "HEAD", "--", *names).stdout.strip():
            deny("TESTED_EXECUTABLE_DRIFT")
    # Shared provider / D172 / Agent source never changed from trusted main.
    shared = ("obpp1291/", "firebase/", "firebase.json", "functions/",
              "ops/apps-script/", "relay-agent/", "relay-agent-webview2-host/",
              "pda-management/", "service/wrangler.stable.toml",
              "ops/project-scope.json", "ops/resource-registry.json")
    if git("diff", "--name-only", BASE, "HEAD", "--", *shared).stdout.strip():
        deny("SHARED_D172_AGENT_STABLE_OR_PROVIDER_DRIFT")
    notes = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    if not (notes.get("schema_version") == 1 and 1 <= len(notes.get("release_notes", [])) <= 5
            and all(isinstance(x, str) and 12 <= len(x) <= 180
                    for x in notes["release_notes"]) and
            all("vc122" in x for x in notes["release_notes"])):
        deny("ANDROID_VC122_CHANGELOG_INVALID")
    if args.preflight:
        print("D173_E110_" + args.component.upper() + "_PREMERGE_SOURCE_PIN_PASS")
        return
    if not (os.getenv("GITHUB_EVENT_NAME") == "push"
            and os.getenv("GITHUB_REF") == "refs/heads/main"
            and git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("EXACT_MAIN_MERGE_OWNER_MARKER_REQUIRED")
    print("D173_E110_" + args.component.upper() + "_SCOPED_RELEASE_PASS")

if __name__ == "__main__":
    main()
