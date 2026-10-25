#!/usr/bin/env python3
"""D173-E052 existing Production channel, exact-source multi-client release.

A PR is never deploy authorization. D172 and old Stable remain untouched.
"""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-e052-release-authorization.json"
MARKER = "D173-E052_UI_LOG_RELEASE:"
BASE = "1fd1da4f4d8febe0a9c0d937f022527e74c02315"
PROTECTED = (
    "service/", "web/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "functions/", "firebase/", "firebase.json", "obpp1291/", "pda-management/",
    ".github/workflows/", "tools/", "tests/", "ops/project-scope.json",
    "ops/resource-registry.json", "ops/apps-script/",
)
ISOLATED = (
    "service/", "relay-agent-webview2-host/", "functions/", "firebase/",
    "firebase.json", "obpp1291/", "pda-management/", "ops/apps-script/",
    "ops/project-scope.json", "ops/resource-registry.json",
)
EXPECTED_FILES = (
    "relay-agent/Program.cs", "relay-agent/D173DesktopResources.cs",
    "relay-agent/D119AgentFeatures.cs", "relay-agent/D173E036Theme.cs",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/D166UsageAudit.kt",
    "web/src/runtime-logger.ts", "web/src/web-version.ts",
    "tools/d173_e052_instrumentation_guard.py",
)
def deny(reason):
    raise SystemExit("D173_E052_RELEASE_DENIED: " + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=False)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", required=True, choices=("worker", "agent", "android"))
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    try:
        d = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        deny("missing/corrupt owner receipt")
    if (d.get("change_id") != "D173" or d.get("checkpoint") != "D173-E052"
        or d.get("owner_approval_reference") != "OWNER_EXPLICIT_D173_E052_MULTI_CLIENT_LOG_LAYOUT_RELEASE_20261026"
        or d.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or d.get("approved_components") != ["worker", "agent", "android"]
        or d.get("production_host") != "inventory.supra.cc.cd"
        or d.get("existing_worker_name") != "supra-inventory-beta"
        or d.get("existing_core_class") != "InventoryCore"
        or d.get("d172_lifecycle") != "PENDING_HOLD"):
        deny("Owner, release components, or registered resource mismatch")
    for field in ("stable_deploy_permission", "d172_business_mutation",
                  "d172_ota_mutation", "firebase_rules_mutation",
                  "new_provider_resource", "business_schema_mutation",
                  "worker_core_mutation", "mail_auth_mutation",
                  "new_telemetry_provider_calls", "field_pass", "owner_pass"):
        if d.get(field) is not False:
            deny("unapproved resource or invented PASS: " + field)
    pin = str(d.get("approved_source_sha") or "")
    if (not re.fullmatch(r"[0-9a-f]{40}", pin)
        or d.get("source_ci_verified") is not True
        or d.get("source_ci_sha") != pin
        or int(d.get("required_ci_success") or 0) < 25
        or d.get("required_ci_failed") != 0
        or d.get("d172_cross_regression_pass") is not True
        or d.get("windows_build_test_pass") is not True
        or d.get("android_build_test_pass") is not True
        or d.get("web_build_test_pass") is not True):
        deny("source-pinned complete source CI / D172 proof absent")
    if (git("cat-file", "-e", pin+"^{commit}").returncode
        or git("merge-base", "--is-ancestor", pin, "HEAD").returncode):
        deny("tested source not ancestor of release")
    if git("diff", "--quiet", pin, "HEAD", "--", *PROTECTED).returncode:
        deny("protected source or workflow drift after CI source pin")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("current released baseline absent")
    if git("diff", "--quiet", BASE, "HEAD", "--", *ISOLATED).returncode:
        deny("shared Worker/DO/D172/Firebase/Gateway/Stable resource drift")
    changed = git("diff", "--name-only", BASE, "HEAD")
    if changed.returncode:
        deny("cannot review scoped changed files")
    files = set(changed.stdout.splitlines())
    if not all(path in files for path in EXPECTED_FILES):
        deny("approved diagnostic/UI source missing")
    if any(not (p.startswith(("web/","android/","relay-agent/","docs/","tests/",
                              "tools/","ops/",".github/workflows/")) or p=="AGENTS.md")
           for p in files):
        deny("unauthorized source/resource mutation")
    config = (ROOT / "service/wrangler.beta.toml").read_text(encoding="utf-8")
    if ('name = "supra-inventory-beta"' not in config
        or 'pattern = "inventory.supra.cc.cd"' not in config
        or 'pattern = "inventory-beta.supra.cc.cd"' in config
        or 'class_name = "InventoryCore"' not in config):
        deny("official existing Worker identity mismatch")
    version = (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip()
    agent = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    proj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if version != "147" or "AgentBuild = 147;" not in agent         or "<AssemblyVersion>0.147.0.0</AssemblyVersion>" not in proj         or "<FileVersion>0.147.0.0</FileVersion>" not in proj:
        deny("Agent147 source mismatch")
    notes = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    if len(notes.get("release_notes",[])) != 3         or not all(str(n).startswith("vc121:") for n in notes["release_notes"]):
        deny("Android121 release notes mismatch")
    if 'WEB_VERSION = "3.3.2"' not in (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8"):
        deny("Web332 source mismatch")
    if args.preflight:
        print("D173_E052_SOURCE_PREFLIGHT_PASS "+args.component+" "+pin[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        deny("only protected main release can deploy")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("explicit E052 release marker absent")
    print("D173_E052_OWNER_RELEASE_GATE_PASS "+args.component+" "+pin[:12])

if __name__ == "__main__":
    main()
