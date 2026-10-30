#!/usr/bin/env python3
"""D173-E104: Owner-gated Agent162-only signed OTA, zero new cloud operations."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "f15b9675b7de33194dbb43980fd5934ee09958fc"
MARKER = "D173-E104_AGENT162_ONLY_RELEASE:"
RECEIPT = ROOT / "ops/d173-e104-agent162-release-authorization.json"
IMMUTABLE = (
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/",
)
PROTECTED = IMMUTABLE + ("relay-agent/", ".github/workflows/", "tools/", "tests/")
ALLOWED = {
    "relay-agent/AgentConfig.cs", "relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/D173E103Activity.cs",
    "relay-agent/FirestoreConfirmationTransport.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D168GroupPickerContact.cs",
    "relay-agent/Program.cs",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e097_startup_regression.mjs",
    ".github/workflows/verify-d171-agent-code-only.yml",
    "tools/d167_release_gate.py",
    "tools/d173_e104_agent162_release_gate.py",
}
REQUIRED = {
    "relay-agent/AgentConfig.cs", "relay-agent/VERSION",
    "relay-agent/D173E103Activity.cs",
    "relay-agent/FirestoreConfirmationTransport.cs",
    "relay-agent/D119AgentFeatures.cs",
    ".github/workflows/verify-relay-agent.yml",
}
def deny(reason):
    raise SystemExit("D173_E104_AGENT162_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True,
                          encoding="utf-8", errors="replace", check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=["agent"])
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        a = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("OWNER_RECEIPT_UNAVAILABLE")
    expected = {
        "change_id": "D173", "checkpoint": "D173-E104", "pr": 801,
        "owner_approval_reference":
            "OWNER_20261030_D173_E104_AGENT162_ZERO_NEW_CLOUD_USAGE_REPAIR_SIGNED_OTA",
        "approved_components": ["agent"], "agent_target_version": 162,
        "base_main_sha": BASE, "production_host": "inventory.supra.cc.cd",
        "release_marker": MARKER, "d172_lifecycle": "PENDING_HOLD",
    }
    for name, value in expected.items():
        if a.get(name) != value:
            deny("OWNER_RECEIPT_MISMATCH_" + name)
    for name in (
        "stable_deploy_permission", "d172_business_mutation", "worker_mutation",
        "android_mutation", "web_mutation", "functions_mutation", "gateway_mutation",
        "firebase_rules_mutation", "business_schema_mutation",
        "new_provider_resource", "field_pass", "owner_pass",
    ):
        if a.get(name) is not False:
            deny("SCOPE_FORBIDDEN_" + name)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "162":
        deny("VERSION_CHANNEL_MISMATCH")
    if "AgentBuild = 162;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("VERSION_NATIVE_MISMATCH")
    if "0.162.0.0" not in (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8"):
        deny("VERSION_ASSEMBLY_MISMATCH")
    agent = (ROOT / "relay-agent/D173E103Activity.cs").read_text(encoding="utf-8")
    transport = (ROOT / "relay-agent/FirestoreConfirmationTransport.cs").read_text(encoding="utf-8")
    program = (ROOT / "relay-agent/Program.cs").read_text(encoding="utf-8")
    if not all(x in agent for x in (
        "D173AcceptActivity", "D173PickerActivityText", "RecordD173LocalAgentActivity",
        "D173E103ActivitySelfTest", "_pickerSessionTombstones",
    )) or "_pickerTerminalActivityHandler(work, outcome)" not in transport or (
        "--e103-activity-self-test" not in program
    ):
        deny("ACTIVITY_GUARDS_OR_NATIVE_TEST_MISSING")
    for workflow in ("deploy-beta.yml", "deploy-beta-firestore.yml"):
        source = (ROOT / ".github/workflows" / workflow).read_text(encoding="utf-8")
        if source.count("startsWith(github.event.head_commit.message, '" + MARKER + "')") != 1:
            deny("NO_PROVIDER_DEPLOY_GUARD_MISSING_" + workflow)
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    immutable = git("diff", "--name-only", BASE, "HEAD", "--", *IMMUTABLE)
    if immutable.returncode or immutable.stdout.strip():
        deny("WORKER_D172_WEB_ANDROID_OR_SHARED_SOURCE_CHANGED")
    changed = git("diff", "--name-only", BASE, "HEAD", "--", *PROTECTED)
    if changed.returncode:
        deny("PROTECTED_DIFF_UNAVAILABLE")
    paths = set(changed.stdout.splitlines())
    if paths - ALLOWED:
        deny("UNAUTHORIZED_SOURCE:" + ",".join(sorted(paths - ALLOWED)))
    if not REQUIRED.issubset(paths):
        deny("REQUIRED_SOURCE_MISSING")
    source = str(a.get("approved_source_sha") or "")
    pinned = (a.get("source_ci_verified") is True
              and re.fullmatch(r"[a-f0-9]{40}", source) is not None
              and a.get("source_ci_sha") == source
              and a.get("required_ci_success", 0) >= 25
              and a.get("required_ci_failed") == 0
              and all(a.get(k) is True for k in (
                  "d172_cross_regression_pass", "windows_build_test_pass",
                  "windows_startup_smoke_pass", "native_activity_self_test_pass",
                  "authority_ci_pass", "continuity_ci_pass",
              )))
    if not pinned:
        if args.preflight:
            print("D173_E104_AGENT162_SCOPE_PASS_CI_PIN_PENDING")
            return
        deny("EXACT_SOURCE_CI_UNVERIFIED")
    if (git("cat-file", "-e", source + "^{commit}").returncode
            or git("merge-base", "--is-ancestor", source, "HEAD").returncode):
        deny("CI_SOURCE_PIN_NOT_ANCESTOR")
    drift = git("diff", "--name-only", source, "HEAD", "--", *PROTECTED)
    if drift.returncode or drift.stdout.strip():
        deny("PROTECTED_SOURCE_CHANGED_AFTER_CI")
    if args.preflight:
        print("D173_E104_AGENT162_SOURCE_CI_PASS " + source[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push"
            or os.getenv("GITHUB_REF") != "refs/heads/main"
            or not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("RELEASE_REQUIRES_PROTECTED_MAIN_MARKER")
    print("D173_E104_AGENT162_SIGNED_RELEASE_GATE_PASS " + source[:12])

if __name__ == "__main__":
    main()
