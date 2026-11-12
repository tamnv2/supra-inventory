#!/usr/bin/env python3
"""D173-E207 exact-source, Agent192-only protected WinForms release guard."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "385875072386c39c612ede14f813dc5ae4dfc7cc"
SOURCE = "b0aebb45d962283abaa17c112d352b6470f409cd"
MARKER = "D173-E207_AGENT192_ONLY_RELEASE:"
AUTH = "ops/d173-e207-agent192-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e207-agent192-release.yml",
    "docs/D173_E207_AGENT192_TWO_COLUMN_LAYOUT_2026-11-12.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/current-context.json",
    "ops/project-state.json",
    AUTH,
    "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/Program.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173DesktopResources.cs",
    "relay-agent/D173E179OverviewNoScroll.cs",
    "tests/d173-e207-agent192-overview-layout.test.mjs",
    "tools/d173_e207_agent192_release_gate.py",
}

def deny(reason):
    raise SystemExit("D173_E207_AGENT192_DENIED:" + reason)

def git(*args):
    result = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True,
                            encoding="utf-8", errors="replace")
    if result.returncode:
        deny("GIT_" + args[0])
    return result.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    data = json.loads((ROOT / AUTH).read_text(encoding="utf-8"))
    expected = {
        "project": "supra-inventory",
        "change": "D173-E207",
        "owner_release_approved": True,
        "component": "agent",
        "target_version": 192,
        "source_main_sha": BASE,
        "source_pin": SOURCE,
        "prior_signed_release": "relay-agent-v191",
        "previous_exe_sha256": "6cebc31af550a90b7200bffced6c3b2dacff01e71a3f65641c88ec8d08b8c00f",
        "existing_host_build": 14,
        "existing_host_sha256": "f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2",
        "host_runtime_release": False,
        "worker_release": False,
        "web_release": False,
        "android_release": False,
        "d172_mutation": False,
        "stable_mutation": False,
        "new_provider_resources": False,
        "release_marker": MARKER,
        "field_pass": False,
        "owner_pass": False,
        "outstanding": "AGENT192_HD_HDPLUS_VISUAL_FIELD_PENDING__STALE_PICKER_SHARED_AUTHORITY_UNTOUCHED",
    }
    for key, value in expected.items():
        if data.get(key) != value:
            deny("AUTH_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "192":
        deny("AGENT_VERSION")
    config = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    csproj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    browser = (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8")
    if ("AgentBuild = 192;" not in config or
            "<AssemblyVersion>0.192.0.0</AssemblyVersion>" not in csproj or
            "<FileVersion>0.192.0.0</FileVersion>" not in csproj):
        deny("AGENT_BUILD")
    if "RequiredHostBuild = 14;" not in browser:
        deny("HOST14_BASELINE")
    git("merge-base", "--is-ancestor", SOURCE, "HEAD")
    git("merge-base", "--is-ancestor", BASE, "HEAD")
    if git("rev-parse", SOURCE + ":relay-agent") != git("rev-parse", "HEAD:relay-agent"):
        deny("AGENT_SOURCE_TREE_DRIFT")
    diff = set(git("diff", "--name-only", BASE, "HEAD").splitlines())
    extra = sorted(diff - ALLOWED)
    if not diff or extra:
        deny("OUT_OF_SCOPE:" + ",".join(extra))
    registry = json.loads((ROOT / "ops/resource-registry.json").read_text(encoding="utf-8"))
    if registry.get("environments", {}).get("beta", {}).get("relay_agent_release") != "relay-agent-v191__D173_E206_SIGNED_RELEASE_PASS__FIELD_OWNER_PENDING":
        deny("AGENT191_BASELINE_DRIFT")
    journal = json.loads((ROOT / "ops/change-continuity/D173.json").read_text(encoding="utf-8"))
    if journal.get("pr") != 937 or journal.get("last_checkpoint", {}).get("id") != "D173-E207":
        deny("CHANGE_CONTINUITY_MISMATCH")
    if args.preflight:
        if git("merge-base", "origin/main", "HEAD") != BASE:
            deny("MAIN_ADVANCED_REBASE_REQUIRED")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or parents[1] != BASE:
            deny("PROTECTED_TWO_PARENT_MERGE_REQUIRED")
        if not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("RELEASE_MARKER")
    print("D173_E207_AGENT192_PIN_SCOPE_PASS")

if __name__ == "__main__":
    main()
