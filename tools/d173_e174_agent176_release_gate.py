#!/usr/bin/env python3
"""D173-E174 Owner-approved Agent176 focus-only signed OTA gate (not Stable)."""
import argparse
import json
import re
import subprocess
from pathlib import Path

BASE = "1bc53cfee8bfc554e04e6b7d7d4bdc4d90cc0bb1"
AUTH = "ops/d173-e174-agent176-release-authorization.json"
MARKER = "D173-E174_AGENT176_ONLY_RELEASE:"
ALLOWED = {
    "relay-agent/Program.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/AgentConfig.cs",
    "relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/d173-e126-badge-ci.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    "tests/d169-agent-web-tab-canary.test.mjs",
    ".github/workflows/deploy-beta.yml",
    "tools/d173_e174_agent176_release_gate.py",
    "tests/d173-e174-agent-focus.test.mjs",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/android_operational_regression.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e097_startup_regression.mjs",
    AUTH,
    "docs/D173_E174_AGENT176_LOG_PIPELINE_LAUNCHER_BACKLOG_2026-11-09.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
}
PROTECTED = [
    "relay-agent/", "relay-agent-webview2-host/", "service/", "web/",
    "android/", "obpp1291/", "firebase/", "functions/", "pda-management/",
    "ops/apps-script/", ".github/workflows/", "tools/", "tests/",
]

def deny(code):
    raise SystemExit("D173_E174_RELEASE_DENIED:" + code)

def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if result.returncode:
        deny("GIT_CHECK_FAILED:" + args[0])
    return result.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["agent"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    config = json.loads(Path(AUTH).read_text(encoding="utf-8"))
    if (config.get("change_id") != "D173-E174"
            or config.get("owner_approval_reference") != "OWNER_20261109_AGENT_FOCUS_FIX_SIGNED_RELEASE"
            or config.get("owner_code_approved") is not True
            or config.get("owner_protected_release_approved") is not True
            or config.get("agent_target_version") != 176
            or config.get("release_marker") != MARKER
            or config.get("stable_mutation") is not False
            or config.get("d172_mutation") is not False):
        deny("OWNER_OR_SCOPE_MISMATCH")
    if Path("relay-agent/VERSION").read_text(encoding="utf-8").strip() != "176":
        deny("VERSION_MISMATCH")
    if "AgentBuild = 176;" not in Path("relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD_MISMATCH")
    csproj = Path("relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if csproj.count("0.176.0.0") != 2:
        deny("ASSEMBLY_VERSION_MISMATCH")
    program = Path("relay-agent/Program.cs").read_text(encoding="utf-8")
    browser = Path("relay-agent/SupraConfirmBrowser.cs").read_text(encoding="utf-8")
    if ("_wmsTabUserHidden || _mainTabs.SelectedTab != _wmsWebTab" not in program
            or "SWP_NOACTIVATE" not in browser
            or "SWP_SHOWWINDOW" not in browser
            or "SW_SHOWNOACTIVATE" not in browser
            or "ShowWindow(host, SW_SHOW);" in browser):
        deny("FOCUS_GUARD_MISSING")
    if "RequiredHostBuild = 13" not in Path("relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"):
        deny("HOST13_GUARD_MISSING")
    changed = set(git("diff", "--name-only", BASE, "HEAD", "--").splitlines())
    extra = sorted(changed - ALLOWED)
    if extra:
        deny("UNAPPROVED_PATHS:" + ",".join(extra)[:300])
    if args.preflight:
        print("D173_E174_AGENT176_SOURCE_PREFLIGHT_PASS__NO_RELEASE")
        return
    if not git("log", "-1", "--format=%s").startswith(MARKER):
        deny("PROTECTED_MERGE_MARKER_MISSING")
    pin = config.get("source_ci_sha", "")
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9a-f]{40}", pin):
        deny("SOURCE_CI_PIN_MISSING")
    if (config.get("source_ci_verified") is not True
            or config.get("native_agent_pass") is not True
            or config.get("d172_regression_pass") is not True):
        deny("SOURCE_CI_NOT_ATTESTED")
    subprocess.run(["git", "merge-base", "--is-ancestor", pin, "HEAD"], check=True)
    touched = git("diff", "--name-only", pin, "HEAD", "--", *PROTECTED)
    if touched:
        deny("PROTECTED_SOURCE_CHANGED_AFTER_CI")
    print("D173_E174_AGENT176_OWNER_CI_RELEASE_PASS")

if __name__ == "__main__":
    main()
