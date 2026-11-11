#!/usr/bin/env python3
"""D173-E202: exact Agent191 source, Owner scope and protected release guard."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "5c208ca63d18d1ca8586ac71a6bca5dd285a26b9"
SOURCE = "673a1277ddc1592a4764b2bc57a1da7d3d482a9a"
MARKER = "D173-E202_AGENT191_ONLY_RELEASE:"
AUTH = "ops/d173-e202-agent191-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e195-agent188-release.yml",
    ".github/workflows/d173-e196-agent189-release.yml",
    ".github/workflows/d173-e199-agent190-release.yml",
    ".github/workflows/d173-e202-agent191-release.yml",
    "docs/D173_E202_AGENT190_FIELD_ROOT_CAUSE_2026-11-12.md",
    "docs/OWNER_DECISIONS.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/current-context.json",
    "ops/project-state.json",
    AUTH,
    "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/FirestoreAgentLeaderCoordinator.cs",
    "relay-agent/Program.cs",
    "tests/d173-e202-agent191-field-regression.test.mjs",
    "tools/d173_e202_agent191_release_gate.py",
}

def deny(reason):
    raise SystemExit("D173_E202_AGENT191_DENIED:" + reason)

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
        "change": "D173-E202",
        "owner_release_approved": True,
        "component": "agent",
        "target_version": 191,
        "source_main_sha": BASE,
        "source_pin": SOURCE,
        "prior_signed_release": "relay-agent-v190",
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
        "outstanding": "STALE_PICKER_SHARED_AUTHORITY_PENDING__NO_FIELD_PASS",
    }
    for key, value in expected.items():
        if data.get(key) != value:
            deny("AUTH_" + key)
    if (data.get("previous_exe_sha256") != "9cc585d951ff48272b8ae5f96c8c7311e2c9ad04701825696d7e00fef1bc0819"
            or data.get("existing_host_sha256") != "f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2"):
        deny("BASELINE_CHECKSUMS")
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "191":
        deny("AGENT_VERSION")
    config = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    csproj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    browser = (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8")
    if ("AgentBuild = 191;" not in config
            or "<AssemblyVersion>0.191.0.0</AssemblyVersion>" not in csproj
            or "<FileVersion>0.191.0.0</FileVersion>" not in csproj):
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
    if registry.get("environments", {}).get("beta", {}).get("relay_agent_release") != "relay-agent-v190__D173_E199_SIGNED_RELEASE_PASS__FIELD_OWNER_PENDING":
        deny("AGENT190_BASELINE_DRIFT")
    journal = json.loads((ROOT / "ops/change-continuity/D173.json").read_text(encoding="utf-8"))
    if journal.get("pr") != 933 or journal.get("last_checkpoint", {}).get("id") != "D173-E203":
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
    print("D173_E202_AGENT191_PIN_SCOPE_PASS")

if __name__ == "__main__":
    main()
