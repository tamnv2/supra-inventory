#!/usr/bin/env python3
"""D173-E153: Owner-gated, source-pinned Agent171-only signed OTA.
PR preflight is read-only. Main release requires E153 marker and verified CI.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess

BASE = "bdbea15e9f52b2caaf6d4c42ec5a8b4493962a7d"
RECEIPT = "ops/d173-e153-agent171-release-authorization.json"
MARKER = "D173-E153_AGENT171_ONLY_RELEASE:"
SOURCE_PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/",
    "tests/d173-e146-agent-webview2-ghost-windows.test.mjs",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e153_agent171_release_gate.py",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
)
ALLOWED_EXACT = {
    "docs/D173_E152_AGENT171_HOST13_OWNED_FORM_FIELD_FIX_2026-11-07.md",
    "docs/D173_E153_AGENT171_RELEASE_2026-11-07.md",
    "docs/OWNER_DECISIONS.md",
    "ops/project-state.json", "ops/authority-manifest.json",
    "ops/change-continuity/D173.json", RECEIPT,
    "relay-agent/AgentConfig.cs", "relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/SupraConfirmBrowser.cs",
    "tests/d173-e146-agent-webview2-ghost-windows.test.mjs",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e153_agent171_release_gate.py",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
}
FORBIDDEN = ("service/", "web/", "android/", "firebase/", "functions/",
             "obpp1291/", "pda-management/", "ops/apps-script/", "firebase.json",
             "ops/project-scope.json", "ops/resource-registry.json")

def deny(reason):
    raise SystemExit("D173_E153_AGENT171_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], text=True, capture_output=True)

def read(path):
    return Path(path).read_text(encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", choices=["agent"], required=True)
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    receipt = json.loads(read(RECEIPT))
    state = json.loads(read("ops/project-state.json")).get("d173_e152", {})
    if receipt.get("owner_approval_reference") != "OWNER_20261107_D173_E153_EXPLICIT_RELEASE_AGENT171_WEB_CONFIRM_HOST13_FIELD_FIX":
        deny("OWNER_PROVENANCE_MISSING")
    if not (receipt.get("owner_code_approved") is True and
            receipt.get("owner_protected_release_approved") is True):
        deny("EXPLICIT_OWNER_RELEASE_APPROVAL_REQUIRED")
    if receipt.get("agent_target_version") != 171 or receipt.get("host_build") != 13 or receipt.get("host_arch") != "x64":
        deny("TARGET_OR_EXISTING_HOST_MISMATCH")
    if receipt.get("existing_host13_sha256") != "36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694":
        deny("HOST13_PIN_MISSING")
    if receipt.get("release_marker") != MARKER or receipt.get("release_channel") != "inventory-channel":
        deny("RELEASE_CHANNEL_OR_MARKER_MISMATCH")
    if any(receipt.get(k) is not False for k in ("new_provider_resource", "service_mutation",
          "web_mutation", "android_mutation", "firestore_rules_mutation",
          "gateway_mutation", "d172_mutation", "stable_mutation")):
        deny("SCOPE_EXPANSION")
    if state.get("id") != "D173-E152" or state.get("candidate_agent_version") != 171 or state.get("host_reuse") != 13:
        deny("STATE_CANDIDATE_MISMATCH")
    if state.get("d172") != "INDEPENDENT_PENDING_HOLD" or state.get("stable") != "OWNER_GATED":
        deny("D172_OR_STABLE_BOUNDARY")
    if read("relay-agent/VERSION").strip() != "171" or "AgentBuild = 171;" not in read("relay-agent/AgentConfig.cs"):
        deny("VERSION_DRIFT")
    if "0.171.0.0" not in read("relay-agent/SupraInventoryRelayAgent.csproj"):
        deny("WIN64_VERSION_DRIFT")
    if "RequiredHostBuild = 13;" not in read("relay-agent/AgentBrowserBundle.cs"):
        deny("EXISTING_HOST13_REQUIRED")
    browser = read("relay-agent/SupraConfirmBrowser.cs")
    for invariant in ("hasWin32Owner", "OwnedByAgentHostNoLock", "OwnedAgentBrowserTitlePrefix",
                      "GetWindowLong(host, -16", "WS_CHILD", "SendMessageTimeout(host"):
        if invariant not in browser:
            deny("OWNED_HOST_SAFE_EMBED_CONTRACT_" + invariant)
    change = git("diff", "--name-only", BASE, "HEAD", "--")
    if change.returncode:
        deny("BASE_DIFF_UNAVAILABLE")
    changed = set(change.stdout.splitlines())
    if any(p == f or p.startswith(f) for p in changed for f in FORBIDDEN):
        deny("SHARED_PROVIDER_OR_D172_MUTATION")
    if any(p not in ALLOWED_EXACT for p in changed):
        deny("UNREGISTERED_PATHS:" + ",".join(sorted(changed - ALLOWED_EXACT))[:350])
    if args.preflight:
        print("D173_E153_AGENT171_OWNER_SCOPE_PREFLIGHT_PASS__NO_RELEASE")
        return
    subject = git("log", "-1", "--format=%s")
    if subject.returncode or not subject.stdout.strip().startswith(MARKER):
        deny("RELEASE_COMMIT_MARKER_REQUIRED")
    pin = receipt.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9a-f]{40}", pin):
        deny("CI_SOURCE_PIN_MISSING")
    if receipt.get("source_ci_verified") is not True or receipt.get("source_ci_failed") != 0 or receipt.get("source_ci_success", 0) < 30:
        deny("SOURCE_CI_NOT_VERIFIED")
    if receipt.get("native_agent_pass") is not True or receipt.get("d172_isolation_pass") is not True:
        deny("WINDOWS_NATIVE_OR_D172_REGRESSION_NOT_VERIFIED")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("SOURCE_PIN_NOT_ANCESTOR")
    protected_diff = git("diff", "--name-only", pin, "HEAD", "--", *SOURCE_PROTECTED)
    if protected_diff.returncode or protected_diff.stdout.strip():
        deny("SOURCE_CHANGED_AFTER_CI_PIN")
    print("D173_E153_AGENT171_RELEASE_GATE_PASS__PIN=" + pin[:12])

if __name__ == "__main__":
    main()
