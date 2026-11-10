#!/usr/bin/env python3
"""D173-E179: exact Owner approval + source CI pin for Agent178-only signed OTA."""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH = ROOT / "ops/d173-e179-agent178-release-authorization.json"
MARKER = "D173-E179_AGENT178_ONLY_RELEASE:"
ALLOWED = set([
    ".github/workflows/d173-e175-source.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    ".github/workflows/verify-relay-agent.yml",
    "docs/D173_E179_AGENT178_50_50_NO_SCROLL_OVERVIEW_2026-11-10.md",
    "docs/OWNER_DECISIONS.md",
    "docs/specs/UI_DESIGN_SYSTEM.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/d173-e179-agent178-release-authorization.json",
    "ops/project-state.json",
    "relay-agent/AgentConfig.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173E179OverviewNoScroll.cs",
    "relay-agent/Program.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/VERSION",
    "tests/d173-e032-ui-code-only.test.mjs",
    "tests/d173-e175-unified-network.test.mjs",
    "tests/d173-e179-agent178-layout.test.mjs",
    "tools/android_operational_regression.py",
    "tools/d173_e052_instrumentation_guard.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/ui_design_guard.py",
    "tools/d173_e179_agent178_release_gate.py"
])
IMMUTABLE = ("service/", "web/", "android/", "obpp1291/",
    "firebase/", "functions/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/", "ops/project-scope.json",
    "ops/resource-registry.json")

def deny(why):
    raise SystemExit("D173_E179_AGENT178_RELEASE_DENIED:" + why)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if p.returncode:
        deny("GIT_FAILED:" + args[0])
    return p.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["agent"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads(AUTH.read_text(encoding="utf-8"))
    exact = {
        "change_id": "D173-E179",
        "owner_approval_reference":
            "OWNER_20261110_AGENT178_OVERVIEW_50_50_UPPER_NO_SCROLL_SIGNED_RELEASE",
        "owner_code_approved": True,
        "owner_protected_release_approved": True,
        "approved_components": ["agent"],
        "agent_target_version": 178,
        "release_marker": MARKER,
        "host_build": 13,
        "stable_mutation": False, "d172_mutation": False,
        "service_mutation": False, "web_mutation": False,
        "android_mutation": False, "worker_mutation": False,
        "firestore_mutation": False, "no_new_provider_requests": True,
        "field_pass": False, "owner_pass": False,
    }
    for key, value in exact.items():
        if auth.get(key) != value: deny("OWNER_SCOPE_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "178":
        deny("VERSION")
    if "AgentBuild = 178;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD")
    if (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8").count("0.178.0.0") != 2:
        deny("ASSEMBLY")
    host = (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8")
    if "RequiredHostBuild = 13" not in host: deny("HOST13_MISMATCH")
    p = (ROOT / "relay-agent/Program.cs").read_text(encoding="utf-8")
    ui = (ROOT / "relay-agent/D173E179OverviewNoScroll.cs").read_text(encoding="utf-8")
    roster = (ROOT / "relay-agent/D119AgentFeatures.cs").read_text(encoding="utf-8")
    for marker in ("InstallD173E179NoScrollTop(", "agentCard.AutoScroll = false;",
                   "_supraCard.AutoScroll = false;", "directCard.AutoScroll = false;"):
        if marker not in p: deny("OVERVIEW:" + marker)
    for marker in ("overview.RowStyles[0].Height = 50F;",
                   "overview.RowStyles[1].Height = 50F;",
                   "viewport.AutoScroll = false;",
                   "threeColumns.AutoScroll = false;",
                   "grid.ScrollBars = ScrollBars.Vertical;"):
        if marker not in ui: deny("LAYOUT:" + marker)
    if "_pickerOnlineGrid.ScrollBars = ScrollBars.Vertical;" not in roster:
        deny("ROSTER_VERTICAL_ONLY")
    if not args.preflight:
        if not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("EXACT_RELEASE_MARKER")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3: deny("PROTECTED_MERGE_REQUIRED")
        base = parents[1]
    paths = set(git("diff", "--name-only", base, "HEAD").splitlines())
    extra = sorted(paths - ALLOWED)
    if extra: deny("OUT_OF_SCOPE:" + ",".join(extra)[:300])
    changed_immutable = sorted(path for path in paths
        if any(path.startswith(p) or path == p for p in IMMUTABLE))
    if changed_immutable: deny("D172_OR_PROVIDER_MUTATION")
    if args.preflight:
        print("D173_E179_OWNER_AGENT178_CODE_PREFLIGHT_PASS__SIGNED_OTA_STILL_GATED")
        return
    pin = auth.get("source_ci_sha")
    if not isinstance(pin,str) or not re.fullmatch(r"[a-f0-9]{40}",pin):
        deny("SOURCE_CI_SHA_MISSING")
    if not (auth.get("source_ci_verified") is True and
            auth.get("native_agent_pass") is True and
            auth.get("d172_regression_pass") is True and
            auth.get("ci_failed_count") == 0):
        deny("SOURCE_CI_NOT_PASS")
    p = subprocess.run(["git","merge-base","--is-ancestor",pin,"HEAD"],cwd=ROOT)
    if p.returncode: deny("SOURCE_CI_NOT_ANCESTOR")
    drift = git("diff","--name-only",pin,"HEAD","--",
                "relay-agent/","relay-agent-webview2-host/")
    if drift: deny("SIGNED_SOURCE_CHANGED_AFTER_CI")
    print("D173_E179_AGENT178_EXACT_OWNER_SIGNED_RELEASE_GATE_PASS")

if __name__ == "__main__":
    main()
