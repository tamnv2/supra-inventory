#!/usr/bin/env python3
"""D173-E143 Owner-scoped Agent168 signed OTA. Host12 is reused, no provider deploy."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "c72bf989f69668bad677da47ccc76faa30908aee"
MARKER = "D173-E143_AGENT168_ONLY_RELEASE:"
IMMUTABLE = (
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/", "usage-test-agent/", "relay-agent-dashboard-probe/",
)
FROZEN_CODE = IMMUTABLE + (
    "relay-agent/", ".github/workflows/", "tools/", "tests/",
)
ALLOWED_AGENT = {
    "relay-agent/AgentConfig.cs",
    "relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/Program.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D161AdminControl.cs",
    "relay-agent/D173E141VpsWebMonitor.cs",
    "relay-agent/SupraConfirmBrowser.cs",
}

def deny(why):
    raise SystemExit("D173_E143_AGENT168_RELEASE_DENIED:" + why)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True,
                          encoding="utf-8", errors="replace", check=False)

def must_file(path):
    return (ROOT / path).read_text(encoding="utf-8")

def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--component", choices=["agent"], required=True)
    cli.add_argument("--preflight", action="store_true")
    args = cli.parse_args()
    try:
        receipt = json.loads(must_file("ops/d173-e143-agent168-release-authorization.json"))
        state = json.loads(must_file("ops/project-state.json"))
    except (ValueError, OSError, KeyError):
        deny("RECEIPT_OR_STATE_MISSING")
    expected = {
        "schema_version": 1, "change_id": "D173", "checkpoint": "D173-E143",
        "pr": 849, "base_main_sha": BASE, "release_marker": MARKER,
        "owner_approval_reference": "OWNER_20261107_AGENT168_ONLY_CODE_AND_PROTECTED_RELEASE",
        "owner_code_approved": True, "owner_protected_release_approved": True,
        "approved_components": ["agent"],
        "agent_target_version": 168, "host_build": 12,
        "d172_lifecycle": "PENDING_HOLD",
    }
    for key, wanted in expected.items():
        if receipt.get(key) != wanted:
            deny("OWNER_SCOPE_" + key)
    for key in (
        "stable_deploy_permission", "worker_mutation", "android_mutation",
        "web_mutation", "firebase_rules_mutation", "functions_mutation",
        "gateway_mutation", "new_provider_resource", "d172_business_mutation",
        "field_pass", "owner_pass",
    ):
        if receipt.get(key) is not False: deny("FORBIDDEN_" + key)
    if state.get("d173_e143", {}).get("owner_field_result") != "AGENT167_NOT_PASS":
        deny("FIELD_REFERENCE_MISMATCH")
    if (state.get("d173_e143", {}).get("d172") != "PENDING_HOLD_UNCHANGED" or
        state.get("d173_e143", {}).get("stable") != "OWNER_GATED"):
        deny("PROJECT_BOUNDARY_MISMATCH")
    if must_file("relay-agent/VERSION").strip() != "168":
        deny("VERSION")
    if "AgentBuild = 168;" not in must_file("relay-agent/AgentConfig.cs"):
        deny("AGENT_BUILD")
    if ("<AssemblyVersion>0.168.0.0</AssemblyVersion>" not in
            must_file("relay-agent/SupraInventoryRelayAgent.csproj") or
        "<FileVersion>0.168.0.0</FileVersion>" not in
            must_file("relay-agent/SupraInventoryRelayAgent.csproj")):
        deny("ASSEMBLY_VERSION")
    if "RequiredHostBuild = 12;" not in must_file("relay-agent/AgentBrowserBundle.cs"):
        deny("HOST12_REQUIRED")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    immutable = git("diff", "--name-only", BASE, "HEAD", "--", *IMMUTABLE)
    if immutable.returncode or immutable.stdout.strip():
        deny("OTHER_PRODUCT_OR_D172_DRIFT")
    agent_changes = git("diff", "--name-only", BASE, "HEAD", "--", "relay-agent/")
    if agent_changes.returncode: deny("AGENT_DIFF_UNAVAILABLE")
    changed = set(agent_changes.stdout.splitlines())
    if changed - ALLOWED_AGENT or not ALLOWED_AGENT.issubset(changed):
        deny("AGENT_SCOPE_MISMATCH:" + ",".join(sorted(changed ^ ALLOWED_AGENT)))
    if args.preflight:
        print("D173_E143_AGENT168_SCOPE_PASS__NO_PROVIDER_MUTATION__CI_PIN_SEPARATE")
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push" or
        os.getenv("GITHUB_REF") != "refs/heads/main" or
        not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("MAIN_EXPLICIT_RELEASE_MARKER_REQUIRED")
    source = receipt.get("source_ci_sha") or ""
    if (receipt.get("source_ci_verified") is not True or
        not re.fullmatch(r"[0-9a-f]{40}", source) or
        receipt.get("source_ci_success", 0) < 30 or
        receipt.get("source_ci_failed") != 0 or
        receipt.get("source_ci_skipped", 0) < 0 or
        receipt.get("native_build_pass") is not True or
        receipt.get("owned_host12_build_pass") is not True or
        receipt.get("d172_isolation_pass") is not True or
        receipt.get("authority_pass") is not True):
        deny("SOURCE_CI_RECEIPT_UNVERIFIED")
    if git("merge-base", "--is-ancestor", source, "HEAD").returncode:
        deny("CI_SOURCE_PIN_NOT_ANCESTOR")
    drift = git("diff", "--name-only", source, "HEAD", "--", *FROZEN_CODE)
    if drift.returncode or drift.stdout.strip():
        deny("POST_CI_PROTECTED_SOURCE_DRIFT")
    print("D173_E143_AGENT168_SIGNED_ONLY_RELEASE_GATE_PASS:" + source[:12])

if __name__ == "__main__":
    main()
