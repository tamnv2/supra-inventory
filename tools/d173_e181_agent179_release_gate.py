#!/usr/bin/env python3
"""D173-E181: Agent179-only Owner scope, exact CI source and protected signed OTA."""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH = ROOT / "ops/d173-e181-agent179-release-authorization.json"
MARKER = "D173-E181_AGENT179_ONLY_RELEASE:"
ALLOWED = {
    ".github/workflows/d173-e175-source.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    ".github/workflows/verify-relay-agent.yml",
    "docs/D173_E181_AGENT179_40_60_WEB_PRESENCE_2026-11-10.md",
    "docs/OWNER_DECISIONS.md",
    "docs/specs/UI_DESIGN_SYSTEM.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/d173-e181-agent179-release-authorization.json",
    "ops/project-state.json",
    "relay-agent/AgentConfig.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173E179OverviewNoScroll.cs",
    "relay-agent/D173ReporterPresence.cs",
    "relay-agent/Program.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/VERSION",
    "tests/d173-e036-unified-presentation.test.mjs",
    "tests/d173-e143-agent168-roster-webview.test.mjs",
    "tests/d173-e175-unified-network.test.mjs",
    "tests/d173-e179-agent178-layout.test.mjs",
    "tests/d173-e181-agent179-layout-web-presence.test.mjs",
    "tools/android_operational_regression.py",
    "tools/d173_e052_instrumentation_guard.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/ui_design_guard.py",
    "tools/d173_e181_agent179_release_gate.py",
}
IMMUTABLE = ("service/", "web/", "android/", "obpp1291/", "firebase/",
             "functions/", "pda-management/", "ops/apps-script/",
             "relay-agent-webview2-host/", "ops/project-scope.json",
             "ops/resource-registry.json")


def deny(code):
    raise SystemExit("D173_E181_AGENT179_RELEASE_DENIED:" + code)


def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                       encoding="utf-8", errors="replace")
    if p.returncode:
        deny("GIT_FAILED_" + args[0])
    return p.stdout.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=["agent"])
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads(AUTH.read_text(encoding="utf-8"))
    exact = {
        "change_id": "D173-E181",
        "owner_approval_reference": "OWNER_20261110_AGENT179_40_60_RESTORE177_WEB_ONLINE_OFFLINE_SIGNED_RELEASE",
        "owner_code_approved": True,
        "owner_protected_release_approved": True,
        "approved_components": ["agent"],
        "agent_target_version": 179,
        "release_marker": MARKER,
        "host_build": 13,
        "stable_mutation": False, "d172_mutation": False,
        "service_mutation": False, "web_mutation": False,
        "android_mutation": False, "worker_mutation": False,
        "firestore_mutation": False, "no_new_provider_requests": True,
        "field_pass": False, "owner_pass": False,
    }
    for key, value in exact.items():
        if auth.get(key) != value:
            deny("OWNER_SCOPE_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "179":
        deny("VERSION")
    if "AgentBuild = 179;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD")
    if (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8").count("0.179.0.0") != 2:
        deny("ASSEMBLY")
    if "RequiredHostBuild = 13" not in (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"):
        deny("HOST13")
    form = (ROOT / "relay-agent/Program.cs").read_text(encoding="utf-8")
    ui = (ROOT / "relay-agent/D173E179OverviewNoScroll.cs").read_text(encoding="utf-8")
    roster = (ROOT / "relay-agent/D119AgentFeatures.cs").read_text(encoding="utf-8")
    presence = (ROOT / "relay-agent/D173ReporterPresence.cs").read_text(encoding="utf-8")
    for token in ("InstallD173E179NoScrollTop(", "agentCard.AutoScroll = false;",
                  "_supraCard.AutoScroll = false;", "directCard.AutoScroll = false;"):
        if token not in form:
            deny("OVERVIEW_" + token)
    for token in ("overview.RowStyles[0].Height = 40F;",
                  "overview.RowStyles[1].Height = 60F;",
                  "viewport.AutoScroll = false;", "threeColumns.AutoScroll = false;",
                  "grid.ScrollBars = ScrollBars.Vertical;",
                  "_manualPicklistGrid.ScrollBars = ScrollBars.None;"):
        if token not in ui:
            deny("LAYOUT_" + token)
    if not all(x in roster for x in ("Online · WebSocket kết nối",
                                     "Offline · WebSocket đã ngắt",
                                     "Chưa xác định · thiếu dữ liệu kết nối")):
        deny("WEB_PRESENCE")
    if "HasConnectionEvidence" not in presence:
        deny("WEB_EVIDENCE")
    if not args.preflight and not git("log", "-1", "--format=%s").startswith(MARKER):
        deny("EXACT_RELEASE_MARKER")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3:
            deny("PROTECTED_MERGE_REQUIRED")
        base = parents[1]
    changed = set(git("diff", "--name-only", base, "HEAD").splitlines())
    extra = sorted(changed - ALLOWED)
    if extra:
        deny("OUT_OF_SCOPE:" + ",".join(extra)[:300])
    if any(path == root or path.startswith(root)
           for path in changed for root in IMMUTABLE):
        deny("D172_OR_PROVIDER_MUTATION")
    if args.preflight:
        print("D173_E181_AGENT179_OWNER_SCOPE_PREFLIGHT_PASS__RELEASE_PENDING")
        return
    pin = auth.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch(r"[a-f0-9]{40}", pin):
        deny("SOURCE_CI_PIN_MISSING")
    if not (auth.get("source_ci_verified") is True and
            auth.get("native_agent_pass") is True and
            auth.get("d172_regression_pass") is True and
            auth.get("ci_failed_count") == 0):
        deny("SOURCE_CI_NOT_PASS")
    if subprocess.run(["git", "merge-base", "--is-ancestor", pin, "HEAD"],
                      cwd=ROOT).returncode != 0:
        deny("SOURCE_CI_NOT_ANCESTOR")
    if git("diff", "--name-only", pin, "HEAD", "--",
           "relay-agent/", "relay-agent-webview2-host/"):
        deny("SIGNED_SOURCE_CHANGED_AFTER_CI")
    print("D173_E181_AGENT179_EXACT_SOURCE_SIGNED_RELEASE_GATE_PASS")


if __name__ == "__main__":
    main()
