#!/usr/bin/env python3
"""D173-E159 Owner-authorized Agent172 only; exact-source gated signed OTA.

PR preflight is read-only. Main release is denied until CI/native/D172 proof
is pinned to a reviewed immutable ancestor, and Host13 is unchanged.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess

BASE = "bbfc92b022d8ff71740fb57d7ed21cc76ee2ee63"
RECEIPT = "ops/d173-e159-agent172-release-authorization.json"
MARKER = "D173-E159_AGENT172_ONLY_RELEASE:"
SOURCE_PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tests/d173-e159-agent172-remediation.test.mjs",
    "tests/d173-e016-a-c-logging.test.mjs",
    "tests/d173-e146-agent-webview2-ghost-windows.test.mjs",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    "tools/d173_e159_agent172_release_gate.py",
)
ALLOWED_EXACT = {
    "docs/D173_E158_AGENT172_DEFERRED_FIX_PLAN_WEBVIEW2_SYNC_FIRE_2026-11-07.md",
    "docs/D173_E159_AGENT172_OWNER_APPROVED_IMPLEMENTATION_2026-11-07.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json", "ops/project-state.json",
    "ops/change-continuity/D173.json", RECEIPT,
    "relay-agent/SupraConfirmBrowser.cs", "relay-agent/D157AgentFeatures.cs",
    "relay-agent/Program.cs", "relay-agent/FirestoreD173E140PickerLocks.cs",
    "relay-agent/D173E141VpsWebMonitor.cs", "relay-agent/FirestoreAgentLeaderCoordinator.cs",
    "relay-agent/D168NetworkRoute.cs", "relay-agent/D173E103Activity.cs",
    "relay-agent/D119AgentFeatures.cs", "relay-agent/D173VpsUsage.cs",
    "relay-agent/AgentConfig.cs", "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/VERSION",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tests/d173-e159-agent172-remediation.test.mjs",
    "tests/d173-e016-a-c-logging.test.mjs",
    "tests/d173-e146-agent-webview2-ghost-windows.test.mjs",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    "tools/d173_e159_agent172_release_gate.py",
}
FORBIDDEN = ("service/", "web/", "android/", "firebase/", "functions/",
             "obpp1291/", "pda-management/", "ops/apps-script/",
             "firebase.json", "ops/project-scope.json", "ops/resource-registry.json")
HOST13_SHA = "36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694"

def deny(reason):
    raise SystemExit("D173_E159_AGENT172_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)

def read(path):
    return Path(path).read_text(encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", required=True, choices=["agent"])
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    receipt = json.loads(read(RECEIPT))
    state = json.loads(read("ops/project-state.json")).get("d173_e159", {})
    if receipt.get("owner_approval_reference") != "OWNER_20261107_E159_EXPLICIT_AGENT172_ALL_E158_SCOPE_AND_BACKGROUND":
        deny("OWNER_GRANT_NOT_EXACT")
    if receipt.get("owner_code_approved") is not True or receipt.get("owner_protected_release_approved") is not True:
        deny("OWNER_CODE_RELEASE_NOT_APPROVED")
    if receipt.get("agent_target_version") != 172 or receipt.get("host_build") != 13 or receipt.get("host_arch") != "x64":
        deny("TARGET_OR_HOST_ARCH")
    if receipt.get("existing_host13_sha256") != HOST13_SHA:
        deny("SIGNED_HOST_PIN_DRIFT")
    if receipt.get("release_marker") != MARKER or receipt.get("release_channel") != "inventory-channel":
        deny("CHANNEL_OR_MARKER")
    if any(receipt.get(k) is not False for k in ("service_mutation", "web_mutation",
            "android_mutation", "firebase_rules_mutation", "gateway_mutation",
            "d172_mutation", "stable_mutation", "new_provider_resource")):
        deny("SHARED_PROVIDER_OR_D172_SCOPE_EXPANSION")
    if state.get("id") != "D173-E159" or state.get("target_agent_version") != 172 or state.get("existing_host_build") != 13:
        deny("STATE_E159_MISMATCH")
    if state.get("d172") != "PENDING_HOLD_ISOLATED" or state.get("stable") != "OWNER_GATED":
        deny("INDEPENDENT_D172_STABLE_GUARD")
    if read("relay-agent/VERSION").strip() != "172" or "AgentBuild = 172;" not in read("relay-agent/AgentConfig.cs"):
        deny("AGENT_BUILD_MISMATCH")
    if "0.172.0.0" not in read("relay-agent/SupraInventoryRelayAgent.csproj"):
        deny("WIN64_BUILD_VERSION_MISMATCH")
    if "RequiredHostBuild = 13;" not in read("relay-agent/AgentBrowserBundle.cs"):
        deny("REUSED_HOST13_REQUIRED")
    browser = read("relay-agent/SupraConfirmBrowser.cs")
    for marker in ("OwnedByAgentHostNoLock", "hasWin32Owner",
                   "GetWindowLong(host, -16", "SendMessageTimeout(host",
                   "PassiveConfirmHealthProbe(", "existing_host=REUSED navigation=NONE"):
        if marker not in browser:
            deny("OWNED_WEBVIEW2_SAFETY_DRIFT")
    health = read("relay-agent/D157AgentFeatures.cs")
    if "PassiveConfirmHealthProbe(reason)" not in health:
        deny("HIDDEN_WEBVIEW2_RELOAD_GUARD_MISSING")
    diff = git("diff", "--name-only", BASE, "HEAD", "--")
    if diff.returncode:
        deny("SOURCE_BASE_NOT_ACCESSIBLE")
    changed = set(diff.stdout.splitlines())
    if any(path == f or path.startswith(f) for path in changed for f in FORBIDDEN):
        deny("FORBIDDEN_PROVIDER_SOURCE_DIFF")
    if changed - ALLOWED_EXACT:
        deny("PATH_NOT_APPROVED:" + ",".join(sorted(changed - ALLOWED_EXACT))[:300])
    if args.preflight:
        print("D173_E159_AGENT172_CODE_SCOPE_PREFLIGHT_PASS__RELEASE_NOT_YET_PROVEN")
        return
    subject = git("log", "-1", "--format=%s")
    if subject.returncode or not subject.stdout.strip().startswith(MARKER):
        deny("RELEASE_COMMIT_MARKER_REQUIRED")
    pin = receipt.get("source_ci_sha", "")
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9a-f]{40}", pin):
        deny("CI_PIN_REQUIRED")
    if not (receipt.get("source_ci_verified") is True and receipt.get("source_ci_failed") == 0 and
            receipt.get("source_ci_success", 0) >= 15 and
            receipt.get("native_agent_pass") is True and receipt.get("d172_isolation_pass") is True):
        deny("CI_NATIVE_D172_PROOF_REQUIRED")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("PIN_NOT_MAIN_ANCESTOR")
    srcdiff = git("diff", "--name-only", pin, "HEAD", "--", *SOURCE_PROTECTED)
    if srcdiff.returncode or srcdiff.stdout.strip():
        deny("SOURCE_DRIFT_AFTER_CI")
    print("D173_E159_AGENT172_SIGNED_RELEASE_GATE_PASS__PIN=" + pin[:12])

if __name__ == "__main__":
    main()
