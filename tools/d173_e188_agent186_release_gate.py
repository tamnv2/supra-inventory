#!/usr/bin/env python3
"""D173-E188 Owner-authorized Agent186 only; reuse verified Host14 without provider mutation."""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "8048dab31c0318774926c3d8cdbbf900b26ec76e"
MARKER = "D173-E188_AGENT186_ONLY_RELEASE:"
AUTH = ROOT / "ops/d173-e188-agent186-release-authorization.json"
ALLOW = {
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/Program.cs",
    "relay-agent/D173E179OverviewNoScroll.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/VERSION",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    ".github/workflows/d173-e175-source.yml",
    "tools/android_operational_regression.py",
    "tests/d173-e188-agent186-field.test.mjs",
    "tests/d173-e187-agent185-webview2-paint.test.mjs",
    "tests/d169-agent-web-tab-canary.test.mjs",
    "tools/d173_e052_instrumentation_guard.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/ui_design_guard.py",
    "tests/d173-e175-unified-network.test.mjs",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tests/d173-e161-agent173-webview-recovery.test.mjs",
    "tests/d173-e159-agent172-remediation.test.mjs",
    "tests/d173-e141-agent-ha-web-shield.test.mjs",
    "tools/d173_e188_agent186_release_gate.py",
    "ops/d173-e188-agent186-release-authorization.json",
    "ops/change-continuity/D173.json",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "docs/OWNER_DECISIONS.md",
    "docs/D173_E187_AGENT185_FIELD_FAIL_ANALYSIS_2026-11-11.md",
    "docs/D173_E188_AGENT186_FIELD_REPAIR_2026-11-11.md",
}

def deny(reason):
    raise SystemExit("D173_E188_AGENT186_DENIED:" + reason)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, text=True,
                       encoding="utf-8", errors="replace", capture_output=True)
    if p.returncode: deny("GIT_" + args[0])
    return p.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["agent"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads(AUTH.read_text(encoding="utf-8"))
    expected = {
        "project_key": "supra-inventory", "change_id": "D173-E188",
        "owner_approval_reference": "OWNER_20261111_AGENT185_THREE_AGENT_FIELD_FAIL_FIX_FOUR_ISSUES_RELEASE_AGENT186",
        "base_main_sha": BASE, "owner_code_approved": True,
        "owner_protected_release_approved": True,
        "approved_components": ["agent"], "agent_target_version": 186,
        "host_target_build": 14, "host_mutation": False,
        "worker_mutation": False, "web_mutation": False, "android_mutation": False,
        "obpp_mutation": False, "stable_mutation": False,
        "firestore_rules_mutation": False, "wms_business_mutation": False,
        "new_provider_resources": False, "no_new_provider_requests": True,
        "field_pass": False, "owner_pass": False,
        "release_marker": MARKER
    }
    for key, value in expected.items():
        if auth.get(key) != value: deny("OWNER_SCOPE_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "186":
        deny("VERSION")
    if "AgentBuild = 186;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("BUILD")
    if (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8").count("0.186.0.0") != 2:
        deny("ASSEMBLY")
    if "RequiredHostBuild = 14;" not in (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"):
        deny("HOST14_REUSE")
    if args.preflight:
        baseline = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("PROTECTED_TWO_PARENT_MERGE_MARKER")
        baseline = parents[1]
        if git("rev-parse", "--abbrev-ref", "HEAD") not in ("HEAD", "main"):
            deny("MAIN_ONLY")
    if baseline != BASE: deny("BASE_CHANGED_NEEDS_REVIEW")
    changed = set(git("diff", "--name-only", baseline, "HEAD").splitlines())
    extra = changed - ALLOW
    if extra: deny("OUT_OF_SCOPE:" + ",".join(sorted(extra))[:300])
    if not {"relay-agent/SupraConfirmBrowser.cs",
            "relay-agent/D173E179OverviewNoScroll.cs",
            "relay-agent/D119AgentFeatures.cs",
            "relay-agent/Program.cs", "relay-agent/VERSION"}.issubset(changed):
        deny("INCOMPLETE_FOUR_ISSUES")
    if args.preflight:
        print("D173_E188_AGENT186_SOURCE_SCOPE_PASS__CI_RELEASE_PENDING")
        return
    if (auth.get("source_ci_verified") is not True or
        auth.get("native_agent_pass") is not True or
        auth.get("d172_regression_pass") is not True or
        auth.get("required_ci_failed") != 0):
        deny("CI_NOT_VERIFIED")
    pin = auth.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch("[a-f0-9]{40}", pin):
        deny("CI_SHA_MISSING")
    git("merge-base", "--is-ancestor", pin, "HEAD")
    if git("diff", "--name-only", pin, "HEAD", "--", "relay-agent/",
           "relay-agent-webview2-host/", ".github/workflows/verify-relay-agent.yml"):
        deny("CODE_CHANGED_AFTER_SOURCE_CI")
    print("D173_E188_AGENT186_EXACT_SIGNED_RELEASE_AUTHORIZED")

if __name__ == "__main__":
    main()
