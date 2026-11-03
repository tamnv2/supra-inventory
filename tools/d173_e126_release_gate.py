#!/usr/bin/env python3
"""D173-E126: narrowly scoped, fail-closed Android vc125 signed OTA release."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "464be7af73c4896637ec309ebc498306eafe1ee1"
SOURCE = "3fbc3b69130064528f4734c2dcd07e9f76d2103b"
MARKER = "D173-E126_ANDROID125_ONLY_RELEASE:"
ALLOW = {
    ".github/workflows/d173-e126-badge-ci.yml",
    ".github/workflows/verify-apps.yml",
    ".github/workflows/deploy-beta.yml",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt",
    "android/release-notes.json",
    "docs/D173_E126_REPORTER_BADGE_CURSOR_FENCE_2026-11-04.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
    "ops/d173-e126-release-authorization.json",
    "tests/d173-e126-reporter-badge.test.mjs",
    "tools/d173_e097_startup_regression.mjs",
    "tools/d167_release_gate.py",
    "tools/d173_e126_release_gate.py",
}
FROZEN = ("service/", "web/", "relay-agent/", "firebase/", "functions/",
          "obpp1291/", "ops/apps-script/", "service/wrangler.beta.toml",
          "ops/project-scope.json", "ops/resource-registry.json")
APP_SOURCES = (
    "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt",
    "tests/d173-e126-reporter-badge.test.mjs",
)

def deny(s):
    raise SystemExit("D173_E126_ANDROID_RELEASE_DENIED:" + s)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT,
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def check(preflight):
    receipt = json.loads((ROOT / "ops/d173-e126-release-authorization.json").read_text(encoding="utf-8"))
    expected = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173", "checkpoint_id": "D173-E126",
        "source_pr": 838, "base_main_sha": BASE, "approved_source_sha": SOURCE,
        "owner_approval_reference": "OWNER_20261104_PASS_AND_DEPLOY_APPROVED_BACKLOG",
        "release_marker": MARKER, "approved_components": ["android"],
        "android_target_version_code": 125,
        "source_ci_verified": True, "source_ci_failed": 0,
        "android_native_build_pass": True, "d172_cross_regression_pass": True,
        "android_signed_ota_permission": True,
        "production_worker_deploy_permission": False,
        "firestore_rules_deploy_permission": False,
        "agent_signed_ota_permission": False,
        "web_mutation": False, "gateway_mutation": False,
        "new_provider_resource": False, "d172_business_mutation": False,
        "stable_deployment_permission": False, "field_pass": False, "owner_pass": False,
    }
    for key, value in expected.items():
        if receipt.get(key) != value:
            deny("OWNER_SCOPE_" + key)
    if int(receipt.get("source_ci_success") or 0) < 30:
        deny("CI_INSUFFICIENT")
    for sha in (BASE, SOURCE):
        if not re.fullmatch(r"[a-f0-9]{40}", sha) or git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
            deny("SOURCE_ANCESTRY")
    paths = git("diff", "--name-only", BASE, "HEAD")
    if paths.returncode:
        deny("DIFF_FAILED")
    changed = set(paths.stdout.splitlines())
    if changed - ALLOW:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOW)))
    if not set(APP_SOURCES).issubset(changed):
        deny("ANDROID_FIX_SOURCE_MISSING")
    if git("diff", "--quiet", BASE, "HEAD", "--", *FROZEN).returncode:
        deny("D172_OR_RUNTIME_MUTATION")
    if git("diff", "--quiet", SOURCE, "HEAD", "--", *APP_SOURCES).returncode:
        deny("EXECUTABLE_SOURCE_CHANGED_SINCE_CI")
    notes = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    if notes.get("schema_version") != 1 or not notes.get("release_notes") or not all(
         isinstance(v, str) and v.startswith("vc125:") for v in notes["release_notes"]):
        deny("RELEASE_NOTES")
    if preflight:
        print("D173_E126_ANDROID125_PRE_RELEASE_SCOPE_AND_SOURCE_PASS")
        return
    if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
        deny("PROTECTED_MAIN_ONLY")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("EXACT_RELEASE_MARKER")
    print("D173_E126_ANDROID125_SIGNED_RELEASE_GATE_PASS")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("android",), required=True)
    parser.add_argument("--preflight", action="store_true")
    check(parser.parse_args().preflight)
