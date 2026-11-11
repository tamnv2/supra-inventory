#!/usr/bin/env python3
"""D173-E195 Agent188: exact v185 runtime + Owner-scoped protected release."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH = "ops/d173-e195-agent188-release-authorization.json"
BASE = "3983e9e2e6fbf724e82c60c05ea5aaac5c13cdc8"
SOURCE = "43eb0fd130f423ad40f42542770ecd5e08bac660"
TAG = "relay-agent-v185"
MARKER = "D173-E195_AGENT188_RELEASE:"
ALLOWED_AGENT = {
    "relay-agent/AgentConfig.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D161AdminControl.cs",
    "relay-agent/D168GroupPickerContact.cs",
    "relay-agent/D173E148ManualRosterRefresh.cs",
    "relay-agent/D173E179OverviewNoScroll.cs",
    "relay-agent/Program.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/VERSION",
}
RESTORED_DELETIONS = {
    "relay-agent/AgentFormE190Web.cs",
    "relay-agent/AgentTabWebView2Browser.cs",
}
ALLOWED_META = {
    "docs/OWNER_DECISIONS.md",
    "docs/specs/UI_DESIGN_SYSTEM.md",
    "docs/specs/OBSERVABILITY_LOGGING.md",
    "docs/D173_E195_AGENT188_V185_BASELINE_FIELD_RECOVERY_2026-11-11.md",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
    "ops/authority-manifest.json",
    "ops/d173-e195-agent188-release-authorization.json",
    "tests/d173-e195-agent188-v185-layout-telemetry.test.mjs",
    "tools/d173_e195_agent188_release_gate.py",
    ".github/workflows/d173-e195-agent188-release.yml",
}

def deny(code):
    raise SystemExit("D173_E195_AGENT188_DENIED:" + code)

def git(*args):
    run = subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    if run.returncode:
        deny("GIT_" + args[0] + ":" + run.stderr[-180:].strip())
    return run.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads((ROOT / AUTH).read_text(encoding="utf-8"))
    checks = {
        "project": "supra-inventory",
        "change": "D173-E195",
        "owner_release_approved": True,
        "component": "agent",
        "target_version": 188,
        "source_tag": TAG,
        "main_base_sha": BASE,
        "verified_source_sha": SOURCE,
        "existing_fixed_host_build": 14,
        "restore_runtime_from_tag": True,
        "build_injection_required": ["FIREBASE_API_KEY_BETA", "AGENT_LOG_GATEWAY_URL_BETA"],
        "host_mutation": False,
        "worker_mutation": False,
        "web_mutation": False,
        "android_mutation": False,
        "d172_mutation": False,
        "stable_mutation": False,
        "wms_business_mutation": False,
        "new_provider_resources": False,
        "release_marker": MARKER,
        "field_pass": False,
        "owner_pass": False,
    }
    for key, val in checks.items():
        if auth.get(key) != val:
            deny("OWNER_AUTH_" + key)
    cfg = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    csproj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if (ROOT / "relay-agent/VERSION").read_text().strip() != "188" or "AgentBuild = 188;" not in cfg:
        deny("WRONG_AGENT_VERSION")
    if "<AssemblyVersion>0.188.0.0</AssemblyVersion>" not in csproj:
        deny("WRONG_ASSEMBLY_VERSION")
    if "RequiredHostBuild = 14;" not in (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"):
        deny("HOST14_PIN_CHANGED")
    if (ROOT / "relay-agent/AgentFormE190Web.cs").exists() or (ROOT / "relay-agent/AgentTabWebView2Browser.cs").exists():
        deny("V187_BROWSER_PRESENT")
    git("merge-base", "--is-ancestor", SOURCE, "HEAD")
    git("merge-base", "--is-ancestor", BASE, "HEAD")
    if git("rev-parse", SOURCE + ":relay-agent") != git("rev-parse", "HEAD:relay-agent"):
        deny("AGENT_SOURCE_DRIFT_AFTER_EXACT_PIN")
    diff = set(git("diff", "--name-only", BASE, "HEAD").splitlines())
    invalid = sorted(diff - ALLOWED_AGENT - RESTORED_DELETIONS - ALLOWED_META)
    if not diff or invalid:
        deny("OUT_OF_SCOPE:" + ",".join(invalid))
    # All runtime files outside approved UI/diagnostic changes must be
    # byte-for-byte identical to the signed Agent185 source tree.
    baseline_diff = set(git("diff", "--name-only", TAG, "HEAD", "--", "relay-agent/").splitlines())
    if baseline_diff != ALLOWED_AGENT:
        deny("NOT_V185_EXACT_BASELINE:" + ",".join(sorted(baseline_diff ^ ALLOWED_AGENT)))
    if args.preflight:
        if git("merge-base", "origin/main", "HEAD") != BASE:
            deny("MAIN_ADVANCED_REBASE_REQUIRED")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or parents[1] != BASE:
            deny("MERGE_MUST_HAVE_2_PARENTS_WITH_EXACT_BASE")
        if not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("OWNER_RELEASE_MERGE_MARKER_REQUIRED")
    print("D173_E195_AGENT188_V185_TREE_SCOPE_PASS")

if __name__ == "__main__":
    main()
