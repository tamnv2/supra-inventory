#!/usr/bin/env python3
"""D173-E213 exact-source, Agent193-only protected WinForms release guard."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "d06d1342706a77d8afb9b43b4dd7c02e77694053"
SOURCE = "5125b4750daf2a2b53f160ed979a2a279b296d18"
MARKER = "D173-E213_AGENT193_ONLY_RELEASE:"
AUTH = "ops/d173-e213-agent193-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e212-agent193-code-only.yml",
    ".github/workflows/d173-e213-agent193-release.yml",
    "docs/D173_E212_AGENT193_UI_STABILITY_2026-11-12.md",
    "docs/D173_E213_AGENT193_RELEASE_AUTHORIZATION_2026-11-12.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/d173-e213-agent193-release-authorization.json",
    "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/Program.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173E179OverviewNoScroll.cs",
    "tests/d173-e207-agent192-overview-layout.test.mjs",
    "tools/d173_e213_agent193_release_gate.py",
}

def deny(reason):
    raise SystemExit("D173_E213_AGENT193_DENIED:" + reason)

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
        "change": "D173-E213",
        "owner_release_approved": True,
        "component": "agent",
        "target_version": 193,
        "source_main_sha": BASE,
        "source_pin": SOURCE,
        "prior_signed_release": "relay-agent-v192",
        "previous_exe_sha256": "38dbabe22ef470e90dff8fa2012d65115da230fed17d0d637d8fa3000c725675",
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
        "outstanding": "AGENT193_HD_HDPLUS_DPI_REAL_DEVICE_VISUAL_FIELD_PENDING__OTHER_COMPONENTS_UNTOUCHED",
    }
    for key, value in expected.items():
        if data.get(key) != value:
            deny("AUTH_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "193":
        deny("AGENT_VERSION")
    config = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    csproj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    browser = (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8")
    if ("AgentBuild = 193;" not in config or
            "<AssemblyVersion>0.193.0.0</AssemblyVersion>" not in csproj or
            "<FileVersion>0.193.0.0</FileVersion>" not in csproj):
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
    if registry.get("environments", {}).get("beta", {}).get("relay_agent_release") != "relay-agent-v192__D173_E208_SIGNED_RELEASE_PASS__FIELD_OWNER_PENDING":
        deny("AGENT192_BASELINE_DRIFT")
    journal = json.loads((ROOT / "ops/change-continuity/D173.json").read_text(encoding="utf-8"))
    if journal.get("pr") != 945 or journal.get("last_checkpoint", {}).get("id") != "D173-E213":
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
    print("D173_E213_AGENT193_PIN_SCOPE_PASS")

if __name__ == "__main__":
    main()
