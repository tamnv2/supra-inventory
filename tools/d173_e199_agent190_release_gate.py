#!/usr/bin/env python3
"""D173-E199: exact-source protected Agent190 release, no Worker/D172/stable mutations."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "05135deb99b017738b453158c632c4fb53912675"
SOURCE = "18c3c0cc2367937c8649250a4e5d4f34d3df2ec0"
MARKER = "D173-E199_AGENT190_ONLY_RELEASE:"
AUTH = "ops/d173-e199-agent190-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e199-agent189-repair-code-only.yml",
    ".github/workflows/d173-e199-agent190-release.yml",
    "docs/D173_E199_AGENT189_FIELD_FAIL_REPAIR_2026-11-12.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/d173-e199-agent190-release-authorization.json",
    "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173DesktopResources.cs",
    "relay-agent/D173E036Theme.cs",
    "relay-agent/D173E179OverviewNoScroll.cs",
    "relay-agent/D173E199RosterNotices.cs",
    "relay-agent/Program.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "tests/d173-e199-agent189-field-regression.test.mjs",
    "tools/d173_e199_agent190_release_gate.py",
}

def deny(reason):
    raise SystemExit("D173_E199_AGENT190_DENIED:" + reason)

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
        "change": "D173-E199",
        "owner_release_approved": True,
        "component": "agent",
        "target_version": 190,
        "source_main_sha": BASE,
        "source_pin": SOURCE,
        "prior_signed_release": "relay-agent-v189",
        "existing_host_build": 14,
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
        "outstanding": "REMOTE_AGENT_KICK_HTTP400_NOT_FIXED__NO_FIELD_PASS",
    }
    for key, value in expected.items():
        if data.get(key) != value:
            deny("AUTH_" + key)
    if len(data.get("previous_exe_sha256", "")) != 64 or len(data.get("existing_host_sha256", "")) != 64:
        deny("BASELINE_CHECKSUMS")
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "190":
        deny("AGENT_VERSION")
    config = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    csproj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    browser = (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8")
    if "AgentBuild = 190;" not in config or "<AssemblyVersion>0.190.0.0</AssemblyVersion>" not in csproj or "<FileVersion>0.190.0.0</FileVersion>" not in csproj:
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
    if registry.get("environments", {}).get("beta", {}).get("relay_agent_release") != "relay-agent-v189__D173_E196_SIGNED_RELEASE_PASS__FIELD_OWNER_PENDING":
        deny("AGENT189_BASELINE_DRIFT")
    journal = json.loads((ROOT / "ops/change-continuity/D173.json").read_text(encoding="utf-8"))
    if journal.get("pr") != 929 or journal.get("last_checkpoint", {}).get("id") != "D173-E199":
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
    print("D173_E199_AGENT190_PIN_SCOPE_PASS")

if __name__ == "__main__":
    main()
