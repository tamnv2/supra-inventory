#!/usr/bin/env python3
"""D173-E125 exact-source signed Agent165-only gate; fail closed."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "8e4b54f46c0f5b0afe2facc682c2ba9b8a307017"
MARKER = "D173-E125_AGENT165_ONLY_RELEASE:"
RECEIPT = ROOT / "ops/d173-e125-agent165-release-authorization.json"
IMMUTABLE = (
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/",
)
PROTECTED = IMMUTABLE + ("relay-agent/", ".github/workflows/", "tools/", "tests/")
ALLOWED = {
    "relay-agent/AgentConfig.cs", "relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/Program.cs", "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173E038Sidebar.cs", "relay-agent/D167SkuBrowserExport.cs",
    "relay-agent/D167SkuCoordinator.cs", "relay-agent/D167SkuDirectExport.cs",
    "relay-agent/D167SkuUi.cs",
    ".github/workflows/d173-e123-source.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    "tools/d167_release_gate.py",
    "tools/d173_e125_agent165_release_gate.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e060_email_preservation_guard.py",
    "tests/d167-three-slot-sku.test.mjs",
}
REQUIRED = {
    "relay-agent/AgentConfig.cs", "relay-agent/VERSION", "relay-agent/Program.cs",
    "relay-agent/D119AgentFeatures.cs", "relay-agent/D173E038Sidebar.cs",
    "relay-agent/D167SkuBrowserExport.cs", "relay-agent/D167SkuDirectExport.cs",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml", ".github/workflows/deploy-beta-firestore.yml",
    "tools/d167_release_gate.py",
}
def deny(msg):
    raise SystemExit("D173_E125_AGENT165_RELEASE_DENIED:" + msg)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          encoding="utf-8", errors="replace",
                          capture_output=True, check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=["agent"])
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        data = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("OWNER_RECEIPT_UNAVAILABLE")
    expected = {
        "change_id": "D173", "checkpoint": "D173-E125", "pr": 831,
        "owner_approval_reference": "OWNER_20261103_PR831_RESPONSIVE_60_40_SIGNED_AGENT165_ONLY",
        "approved_components": ["agent"], "agent_target_version": 165,
        "base_main_sha": BASE, "production_host": "inventory.supra.cc.cd",
        "release_marker": MARKER, "d172_lifecycle": "PENDING_HOLD",
    }
    for field, value in expected.items():
        if data.get(field) != value:
            deny("OWNER_SCOPE_MISMATCH_" + field)
    for field in ("stable_deploy_permission", "d172_business_mutation",
                  "worker_mutation", "android_mutation", "web_mutation",
                  "functions_mutation", "gateway_mutation", "firebase_rules_mutation",
                  "business_schema_mutation", "new_provider_resource",
                  "field_pass", "owner_pass"):
        if data.get(field) is not False:
            deny("FORBIDDEN_" + field)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "165":
        deny("VERSION_CHANNEL_MISMATCH")
    if "AgentBuild = 165;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("VERSION_NATIVE_MISMATCH")
    if "0.165.0.0" not in (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8"):
        deny("VERSION_ASSEMBLY_MISMATCH")
    program = (ROOT / "relay-agent/Program.cs").read_text(encoding="utf-8")
    roster = (ROOT / "relay-agent/D119AgentFeatures.cs").read_text(encoding="utf-8")
    if not all(term in program for term in (
            "D173ResponsiveTopMode", "D173ResponsiveTopMode(1030) == 2",
            "Math.Min(560, initialWorkArea.Height)",
            "SizeType.Percent, 40F", "SizeType.Percent, 60F")):
        deny("ADAPTIVE_OVERVIEW_GUARD_MISSING")
    if not all(term in roster for term in ("Height = 40f;", "Height = 60f;",
                                          "ScrollBars.Both")):
        deny("ROSTER_60_AND_NARROW_GRID_GUARD_MISSING")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    immutable = git("diff", "--name-only", BASE, "HEAD", "--", *IMMUTABLE)
    if immutable.returncode or immutable.stdout.strip():
        deny("SHARED_SOURCE_MUTATION_FORBIDDEN")
    changed = git("diff", "--name-only", BASE, "HEAD", "--", *PROTECTED)
    if changed.returncode:
        deny("SOURCE_DIFF_UNAVAILABLE")
    paths = set(changed.stdout.splitlines())
    if paths - ALLOWED:
        deny("UNAUTHORIZED_SOURCE:" + ",".join(sorted(paths - ALLOWED)))
    if not REQUIRED.issubset(paths):
        deny("REQUIRED_SOURCE_MISSING")
    source = str(data.get("approved_source_sha") or "")
    valid = (
        data.get("source_ci_verified") is True
        and re.fullmatch(r"[a-f0-9]{40}", source) is not None
        and data.get("source_ci_sha") == source
        and data.get("required_ci_success", 0) >= 25
        and data.get("required_ci_failed") == 0
        and all(data.get(k) is True for k in (
            "d172_cross_regression_pass", "windows_build_test_pass",
            "windows_startup_smoke_pass", "native_sku_cdp_test_pass",
            "authority_ci_pass", "continuity_ci_pass"))
    )
    if not valid:
        if args.preflight:
            print("D173_E125_AGENT165_SCOPE_PASS__SOURCE_CI_PIN_PENDING")
            return
        deny("EXACT_SOURCE_CI_UNVERIFIED")
    if git("cat-file", "-e", source + "^{commit}").returncode or (
            git("merge-base", "--is-ancestor", source, "HEAD").returncode):
        deny("SOURCE_PIN_NOT_ANCESTOR")
    drift = git("diff", "--name-only", source, "HEAD", "--", *PROTECTED)
    if drift.returncode or drift.stdout.strip():
        deny("PROTECTED_SOURCE_CHANGED_AFTER_CI")
    if args.preflight:
        print("D173_E125_AGENT165_SOURCE_CI_PASS " + source[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push"
            or os.getenv("GITHUB_REF") != "refs/heads/main"
            or not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("MAIN_OWNER_RELEASE_MARKER_REQUIRED")
    print("D173_E125_AGENT165_SIGNED_RELEASE_GATE_PASS " + source[:12])

if __name__ == "__main__":
    main()
