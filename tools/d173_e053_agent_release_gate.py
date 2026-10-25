#!/usr/bin/env python3
"""D173-E053: scoped Agent148 owner-approved signed release; fail closed."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "D173-E053_AGENT_ONLY_RELEASE:"
RECEIPT = ROOT / "ops/d173-e053-agent-release-authorization.json"
PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/", "service/", "web/", "android/",
    "functions/", "firebase/", "firebase.json", "obpp1291/", "pda-management/",
    ".github/workflows/", "tools/", "tests/", "ops/project-scope.json",
    "ops/resource-registry.json",
)
SHARED = (
    "service/", "web/", "android/", "functions/", "firebase/", "firebase.json",
    "obpp1291/", "relay-agent-webview2-host/", "pda-management/",
    "ops/apps-script/", "ops/project-scope.json", "ops/resource-registry.json",
)
BASE = "e45eafd8fbc69edf6a75c750f61ad9808237394f"  # Agent147/Web332/Android121

def deny(message):
    raise SystemExit("D173_E053_AGENT_RELEASE_DENIED: " + message)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=("agent",))
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        data = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("missing/corrupt Owner receipt")
    if (data.get("change_id") != "D173" or data.get("checkpoint") != "D173-E053"
        or data.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or data.get("owner_approval_reference") != "OWNER_20261026_AGENT147_FIELD_FAIL_FIX_AND_RELEASE"
        or data.get("approved_components") != ["agent"]
        or data.get("agent_target_version") != 148):
        deny("wrong Owner scope, version or change")
    for field in ("stable_deploy_permission", "d172_business_mutation", "worker_mutation",
                  "android_mutation", "web_mutation", "firebase_mutation",
                  "new_provider_operations", "field_pass", "owner_pass"):
        if data.get(field) is not False:
            deny("resource or FIELD/Owner guard: " + field)
    if data.get("d172_lifecycle") != "PENDING_HOLD":
        deny("D172 MUST remain independent PENDING/HOLD")
    pin = str(data.get("approved_source_sha") or "")
    if (not re.fullmatch("[0-9a-f]{40}", pin)
        or data.get("source_ci_verified") is not True
        or data.get("source_ci_sha") != pin
        or int(data.get("required_ci_success") or 0) < 20
        or data.get("required_ci_failed") != 0
        or data.get("windows_agent_build_pass") is not True
        or data.get("d172_isolation_pass") is not True):
        deny("exact source Windows/CI/D172 proof missing")
    if git("cat-file", "-e", pin + "^{commit}").returncode:
        deny("CI source commit unavailable")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("release does not descend from tested source")
    if git("diff", "--quiet", pin, "HEAD", "--", *PROTECTED).returncode:
        deny("protected source drift after CI")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("Agent147 accepted baseline missing")
    if git("diff", "--quiet", BASE, "HEAD", "--", *SHARED).returncode:
        deny("Worker/Web/Android/D172/Firebase source unexpectedly changed")
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "148":
        deny("wrong Agent monotonic version")
    cfg = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    proj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if ("AgentBuild = 148;" not in cfg
        or "<AssemblyVersion>0.148.0.0</AssemblyVersion>" not in proj
        or "<FileVersion>0.148.0.0</FileVersion>" not in proj):
        deny("Agent148 version mismatch")
    if args.preflight:
        print("D173_E053_AGENT_SOURCE_PREFLIGHT_PASS " + pin[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        deny("signed publication requires protected main push")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("scoped Owner release marker absent")
    print("D173_E053_AGENT148_OWNER_RELEASE_GATE_PASS " + pin[:12])

if __name__ == "__main__":
    main()
