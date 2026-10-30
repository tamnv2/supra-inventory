#!/usr/bin/env python3
"""D173-E100: fail-closed, Owner-approved Agent160-only signed OTA release gate."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "b2604be32b3447655382186be17e161801efd411"
MARKER = "D173-E100_AGENT160_ONLY_RELEASE:"
RECEIPT = ROOT / "ops/d173-e100-agent160-release-authorization.json"
PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/", "service/", "web/",
    "android/", "functions/", "firebase/", "firebase.json", "obpp1291/",
    "pda-management/", "ops/apps-script/", ".github/workflows/", "tools/",
)
IMMUTABLE = (
    "relay-agent-webview2-host/", "service/", "web/", "android/",
    "functions/", "firebase/", "firebase.json", "obpp1291/",
    "pda-management/", "ops/apps-script/",
)
ALLOWED = {
    "relay-agent/D119AgentFeatures.cs", "relay-agent/D173E036Theme.cs",
    "relay-agent/Program.cs", "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs", "relay-agent/SupraInventoryRelayAgent.csproj",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/verify-d171-agent-code-only.yml",
    "tools/d167_release_gate.py", "tools/d173_e100_agent160_release_gate.py",
    "tools/d173_e097_startup_regression.mjs",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
}
REQUIRED = ALLOWED

def deny(reason):
    raise SystemExit("D173_E100_AGENT160_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=["agent"])
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        auth = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("OWNER_RECEIPT_MISSING")
    expected = {
        "change_id": "D173", "checkpoint": "D173-E100", "pr": 797,
        "owner_approval_reference": "OWNER_20261030_D173_E100_AGENT160_ROSTER_UTC_VERSION_SIGNED_OTA",
        "approved_components": ["agent"], "agent_target_version": 160,
        "base_main_sha": BASE, "production_host": "inventory.supra.cc.cd",
        "release_marker": MARKER, "d172_lifecycle": "PENDING_HOLD",
    }
    for name, value in expected.items():
        if auth.get(name) != value:
            deny("OWNER_RECEIPT_" + name)
    for name in (
        "stable_deploy_permission", "d172_business_mutation", "worker_mutation",
        "android_mutation", "web_mutation", "functions_mutation",
        "firebase_rules_mutation", "gateway_mutation",
        "business_schema_mutation", "new_provider_resource",
        "field_pass", "owner_pass",
    ):
        if auth.get(name) is not False:
            deny("SCOPE_FORBIDDEN_" + name)

    if (
        (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "160"
        or "AgentBuild = 160;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
        or "0.160.0.0" not in (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    ):
        deny("VERSION_MISMATCH")
    code = (ROOT / "relay-agent/D119AgentFeatures.cs").read_text(encoding="utf-8")
    entry = (ROOT / "relay-agent/Program.cs").read_text(encoding="utf-8")
    if not all(marker in code for marker in (
        "DateTimeStyles.AssumeUniversal", "D173PreserveSameSessionMetadata",
        "D173SetRosterSummaryCells", "D173RosterTechnicalColumns",
        "D173E100RosterSelfTest",
    )) or "--e100-roster-self-test" not in entry:
        deny("SOURCE_OR_NATIVE_TEST_MISSING")

    for file_name in (
        ".github/workflows/deploy-beta.yml",
        ".github/workflows/deploy-beta-firestore.yml",
    ):
        contents = (ROOT / file_name).read_text(encoding="utf-8")
        if contents.count("startsWith(github.event.head_commit.message, '" + MARKER + "')") != 1:
            deny("PROVIDER_NO_DEPLOY_MARKER_MISSING:" + file_name)

    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("UNRECOGNIZED_BASE")
    unchanged = git("diff", "--name-only", BASE, "HEAD", "--", *IMMUTABLE)
    if unchanged.returncode or unchanged.stdout.strip():
        deny("PROVIDER_D172_OR_BUSINESS_SOURCE_CHANGED")
    changed = git("diff", "--name-only", BASE, "HEAD", "--", *PROTECTED)
    if changed.returncode:
        deny("PROTECTED_DIFF_UNAVAILABLE")
    paths = set(changed.stdout.splitlines())
    if paths - ALLOWED:
        deny("UNAUTHORIZED_SOURCE:" + ",".join(sorted(paths - ALLOWED)))
    if not REQUIRED.issubset(paths):
        deny("REQUIRED_SOURCE_MISSING:" + ",".join(sorted(REQUIRED - paths)))

    source = str(auth.get("approved_source_sha") or "")
    pinned = (
        auth.get("source_ci_verified") is True
        and re.fullmatch(r"[a-f0-9]{40}", source) is not None
        and auth.get("source_ci_sha") == source
        and auth.get("required_ci_success", 0) >= 25
        and auth.get("required_ci_failed") == 0
        and all(auth.get(k) is True for k in (
            "d172_cross_regression_pass", "windows_build_test_pass",
            "windows_startup_smoke_pass", "native_roster_self_test_pass",
            "authority_ci_pass", "continuity_ci_pass",
        ))
    )
    if not pinned:
        if args.preflight:
            print("D173_E100_AGENT160_SCOPE_PASS_CI_PIN_PENDING")
            return
        deny("EXACT_SOURCE_CI_NOT_PINNED")
    if (git("cat-file", "-e", source + "^{commit}").returncode
            or git("merge-base", "--is-ancestor", source, "HEAD").returncode):
        deny("SOURCE_PIN_NOT_ANCESTOR")
    drift = git("diff", "--name-only", source, "HEAD", "--", *PROTECTED)
    if drift.returncode or drift.stdout.strip():
        deny("PROTECTED_SOURCE_CHANGED_SINCE_CI")
    if args.preflight:
        print("D173_E100_AGENT160_SOURCE_CI_PASS " + source[:12])
        return

    if (os.getenv("GITHUB_EVENT_NAME") != "push"
            or os.getenv("GITHUB_REF") != "refs/heads/main"
            or not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("RELEASE_NOT_PROTECTED_MAIN_OWNER_MARKER")
    print("D173_E100_AGENT160_SIGNED_RELEASE_GATE_PASS " + source[:12])

if __name__ == "__main__":
    main()
