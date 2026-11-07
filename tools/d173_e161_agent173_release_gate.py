#!/usr/bin/env python3
"""D173-E161 Owner-gated Agent173 signed release; no shared-provider or D172 mutations."""
import argparse
import json
import re
import subprocess
from pathlib import Path

BASE = "edff22d5c07278f0c7375faf1098e28e7da2b79d"
RECEIPT = "ops/d173-e161-agent173-release-authorization.json"
MARKER = "D173-E161_AGENT173_ONLY_RELEASE:"
HOST13_SHA = "36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694"
ALLOWED = {
    "relay-agent/Program.cs", "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/D160ConfirmPipeline.cs", "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj", "relay-agent/VERSION",
    "tests/d173-e161-agent173-webview-recovery.test.mjs",
    "tests/d173-e159-agent172-remediation.test.mjs",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tests/d173-e146-agent-webview2-ghost-windows.test.mjs",
    "tools/android_operational_regression.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    "docs/D173_E161_AGENT173_WEBVIEW2_TRAY_CONFIRM_FIX_2026-11-07.md",
    "docs/D173_E162_AGENT173_SIGNED_OTA_TECH_RELEASE_RECEIPT_2026-11-07.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
    RECEIPT, "tools/d173_e161_agent173_release_gate.py",
}
PROTECTED = ("relay-agent/", "relay-agent-webview2-host/",
             "tests/d173-e161-agent173-webview-recovery.test.mjs",
             "tests/d173-e159-agent172-remediation.test.mjs",
             "tests/d173-e149-agent170-activity-webtab.test.mjs",
             "tests/d173-e146-agent-webview2-ghost-windows.test.mjs",
             "tools/android_operational_regression.py",
             "tools/d173_e060_vps_usage_guard.py",
             "tools/d173_e064_agent_history_usage_guard.py",
             ".github/workflows/verify-relay-agent.yml",
             ".github/workflows/verify-d173-e149-agent170.yml",
             "tools/d173_e161_agent173_release_gate.py")

def deny(reason):
    raise SystemExit("D173_E161_AGENT173_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)

def read(path):
    return Path(path).read_text(encoding="utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["agent"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    receipt = json.loads(read(RECEIPT))
    state = json.loads(read("ops/project-state.json")).get("d173_e161", {})
    if (receipt.get("owner_approval_reference") != "OWNER_20261107_E161_AGENT173_TRAY_CDP_CONFIRM_FIX"
            or receipt.get("owner_code_approved") is not True
            or receipt.get("owner_protected_release_approved") is not True):
        deny("OWNER_GRANT_NOT_EXACT")
    if (receipt.get("agent_target_version") != 173 or receipt.get("host_build") != 13
            or receipt.get("host_arch") != "x64"
            or receipt.get("existing_host13_sha256") != HOST13_SHA
            or receipt.get("release_marker") != MARKER
            or receipt.get("release_channel") != "inventory-channel"):
        deny("AGENT_VERSION_OR_SIGNED_HOST_PIN_DRIFT")
    if any(receipt.get(k) is not False for k in (
        "service_mutation", "web_mutation", "android_mutation",
        "firebase_rules_mutation", "gateway_mutation", "d172_mutation",
        "stable_mutation", "new_provider_resource")):
        deny("PROVIDER_OR_D172_SCOPE_EXPANSION")
    if (state.get("id") != "D173-E161" or state.get("agent_target_version") != 173
            or state.get("host_build") != 13 or state.get("owner_pass") is not False):
        deny("AUTHORITY_STATE_MISMATCH")
    if (read("relay-agent/VERSION").strip() != "173"
            or "AgentBuild = 173;" not in read("relay-agent/AgentConfig.cs")
            or "0.173.0.0" not in read("relay-agent/SupraInventoryRelayAgent.csproj")
            or "RequiredHostBuild = 13;" not in read("relay-agent/AgentBrowserBundle.cs")):
        deny("WIN64_AGENT173_HOST13_MISMATCH")
    browser = read("relay-agent/SupraConfirmBrowser.cs")
    form = read("relay-agent/Program.cs")
    pipeline = read("relay-agent/D160ConfirmPipeline.cs")
    for marker in ("CDP_DOWN_HOST_ALIVE navigation=NONE", "CDP_RECONNECTING",
                   "decision=RESTART reason=HOST_EXIT_CONFIRMED",
                   "HY1_SFT3_AMBIGUOUS", "D173_E161 DASHBOARD_SELECT",
                   "SetAgentInputProtectionNoLock(true)"):
        if marker not in browser: deny("WEBVIEW2_OR_SFT3_GUARD_MISSING")
    for marker in ("D173_E161 TRAY event=HIDDEN", "command == 0xF020"):
        if marker not in form: deny("TRAY_PARENT_LIFECYCLE_DRIFT")
    if ("CLICKED_RESULT_UNKNOWN" not in pipeline or
            "VerifyExactAlreadyConfirmedReadOnly" not in pipeline):
        deny("WMS_UNKNOWN_RESULT_GUARD_DRIFT")
    change = git("diff", "--name-only", BASE, "HEAD", "--")
    if change.returncode:
        deny("BASE_COMMIT_UNAVAILABLE")
    touched = set(change.stdout.splitlines())
    if touched - ALLOWED:
        deny("UNAPPROVED_PATHS:" + ",".join(sorted(touched - ALLOWED))[:320])
    if args.preflight:
        print("D173_E161_AGENT173_SOURCE_SCOPE_PREFLIGHT_PASS__NOT_RELEASE")
        return
    msg = git("log", "-1", "--format=%s")
    if msg.returncode or not msg.stdout.strip().startswith(MARKER):
        deny("PROTECTED_MERGE_MARKER_MISSING")
    pin = receipt.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9a-f]{40}", pin):
        deny("EXACT_CI_SOURCE_PIN_MISSING")
    if (receipt.get("source_ci_verified") is not True or
            receipt.get("source_ci_failed") != 0 or
            receipt.get("source_ci_success", 0) < 15 or
            receipt.get("native_agent_pass") is not True or
            receipt.get("d172_isolation_pass") is not True):
        deny("CI_NATIVE_D172_NOT_PROVEN")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("PIN_NOT_MERGE_ANCESTOR")
    source_diff = git("diff", "--name-only", pin, "HEAD", "--", *PROTECTED)
    if source_diff.returncode or source_diff.stdout.strip():
        deny("SOURCE_DRIFT_AFTER_CI")
    print("D173_E161_AGENT173_SIGNED_RELEASE_GATE_PASS__SOURCE=" + pin[:12])

if __name__ == "__main__":
    main()
