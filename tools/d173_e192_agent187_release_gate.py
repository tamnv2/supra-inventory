#!/usr/bin/env python3
"""D173-E192: exact Owner-scoped Agent187 protected release guard (no provider reads)."""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH_FILE = "ops/d173-e192-agent187-release-authorization.json"
EXPECTED = {
    "project": "supra-inventory",
    "change": "D173-E192",
    "owner_instruction": "OWNER_20261111_AGENT186_FIELD_FAIL_FIX_FULL_AND_RELEASE_AGENT187",
    "owner_release_approved": True,
    "component": "agent",
    "target_version": 187,
    "main_base_sha": "cbd534092fb496497638af972c962db1784db31e",
    "verified_source_sha": "b20a9077eb8a0a98a8f623b4476e31ebbfe3f532",
    "existing_fixed_host_build": 14,
    "host_mutation": False,
    "worker_mutation": False,
    "web_mutation": False,
    "android_mutation": False,
    "d172_mutation": False,
    "stable_mutation": False,
    "wms_business_mutation": False,
    "new_provider_resources": False,
    "release_marker": "D173-E192_AGENT187_RELEASE:",
    "field_pass": False,
    "owner_pass": False,
}
ALLOWED = {
    "ops/authority-manifest.json", "ops/project-state.json",
    "ops/current-context.json", "ops/change-continuity/D173.json",
    "ops/d173-e192-agent187-release-authorization.json",
    "docs/D173_E190_AGENT_NATIVE_WEB_CONFIRM_AND_LOG_2026-11-11.md",
    "docs/D173_E192_AGENT187_ROSTER_WEB_AUTH_RELEASE_2026-11-11.md",
    "docs/OWNER_DECISIONS.md",
    "tests/d173-e190-native-tab-browser.test.mjs",
    "tests/d173-e192-agent187-roster-overlap.test.mjs",
    "tools/d173_e192_agent187_release_gate.py",
    ".github/workflows/d173-e190-native-browser.yml",
    ".github/workflows/d173-e192-agent187-release.yml",
}
PROTECTED = ("service/", "web/", "android/", "obpp1291/", "firebase/",
             "relay-agent-webview2-host/", "functions/")

def deny(reason):
    raise SystemExit("D173_E192_AGENT187_DENIED:" + reason)

def git(*args):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if r.returncode: deny("GIT_" + args[0] + ":" + r.stderr[-240:].strip())
    return r.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    a = parser.parse_args()
    o = json.loads((ROOT / AUTH_FILE).read_text(encoding="utf-8"))
    for key, expected in EXPECTED.items():
        if o.get(key) != expected: deny("OWNER_AUTH_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "187":
        deny("WRONG_AGENT_VERSION")
    if "AgentBuild = 187;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("WRONG_AGENT_BUILD")
    project = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if "<AssemblyVersion>0.187.0.0</AssemblyVersion>" not in project:
        deny("WRONG_ASSEMBLY_VERSION")
    bundle = (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8")
    if "RequiredHostBuild = 14;" not in bundle:
        deny("FIXED_RUNTIME_PROVENANCE")
    base = EXPECTED["main_base_sha"]
    source = EXPECTED["verified_source_sha"]
    git("merge-base", "--is-ancestor", source, "HEAD")
    git("merge-base", "--is-ancestor", base, "HEAD")
    if git("rev-parse", source + ":relay-agent") != git("rev-parse", "HEAD:relay-agent"):
        deny("AGENT_TREE_CHANGED_AFTER_CODE_CI_PIN")
    # Restrict the entire PR, even if a previous component's release gate is stale.
    changed = set(git("diff", "--name-only", base, "HEAD").splitlines())
    bad = sorted(x for x in changed if
                 not x.startswith("relay-agent/") and x not in ALLOWED)
    if not changed or bad: deny("OUT_OF_SCOPE:" + ",".join(bad))
    if any(x.startswith(PROTECTED) for x in changed):
        deny("PROTECTED_BUSINESS_SOURCE_CHANGED")
    if a.preflight:
        if git("merge-base", "origin/main", "HEAD") != base:
            deny("MAIN_ADVANCED_REBASE_REQUIRED")
    else:
        parts = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parts) != 3 or parts[1] != base:
            deny("MERGE_NOT_EXACT_TWO_PARENT_OR_BASE_DRIFT")
        if not git("log", "-1", "--format=%s").startswith(EXPECTED["release_marker"]):
            deny("RELEASE_MERGE_MARKER_MISSING")
    print("D173_E192_AGENT187_PROTECTED_SCOPE_PASS")

if __name__ == "__main__":
    main()
