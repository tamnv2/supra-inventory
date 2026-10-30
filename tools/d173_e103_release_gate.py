#!/usr/bin/env python3
"""D173-E103 owner-approved source-pinned read-only Worker first + Agent161 release."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "66abda064f21eebc95ced7468546971bd22066e1"
MARKER = "D173-E103_AGENT161_WORKER_RELEASE:"
RECEIPT = ROOT / "ops/d173-e103-agent161-release-authorization.json"
PROTECTED = ("relay-agent/", "service/", "web/", "android/", "functions/",
             "firebase/", "firebase.json", "obpp1291/", "pda-management/",
             "ops/apps-script/", "relay-agent-webview2-host/", ".github/workflows/",
             "tools/", "tests/")
IMMUTABLE = ("web/", "android/", "functions/", "firebase/", "firebase.json",
             "obpp1291/", "pda-management/", "ops/apps-script/",
             "relay-agent-webview2-host/", "service/src/core.ts",
             "service/src/index.ts", "service/src/obpp1291-core.ts",
             "service/src/google-mail.ts", "service/src/system-reset.ts",
             "service/wrangler.beta.toml")
ALLOWED = {
    "relay-agent/Program.cs", "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173ReporterPresence.cs", "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs", "relay-agent/SupraInventoryRelayAgent.csproj",
    "service/src/read-model-core.ts",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_email_release_gate.py", "tools/d173_e103_release_gate.py",
    "tools/d167_release_gate.py",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/verify-d171-agent-code-only.yml",
    "tests/d173-e103-agent-roster-confirm.test.mjs",
    "tests/d173-e032-ui-code-only.test.mjs",
    "tests/d173-e016-a-c-logging.test.mjs",
}
REQUIRED = {
    "relay-agent/Program.cs", "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173ReporterPresence.cs", "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs", "relay-agent/SupraInventoryRelayAgent.csproj",
    "service/src/read-model-core.ts",
    "tests/d173-e103-agent-roster-confirm.test.mjs",
}

def deny(reason):
    raise SystemExit("D173_E103_AGENT161_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=["worker", "agent"])
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        auth = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("RECEIPT_MISSING")
    expected = {
        "change_id": "D173", "checkpoint": "D173-E103",
        "owner_approval_reference":
            "OWNER_20261030_D173_E103_AGENT161_WEB_PDA_ROSTER_PICKLIST_SCOPED_RELEASE",
        "approved_components": ["worker", "agent"], "agent_target_version": 161,
        "base_main_sha": BASE, "worker_resource_key": "worker-beta",
        "production_host": "inventory.supra.cc.cd",
        "release_marker": MARKER, "source_pr": 800,
        "d172_lifecycle": "PENDING_HOLD",
    }
    for key, value in expected.items():
        if auth.get(key) != value:
            deny("OWNER_SCOPE_" + key)
    for key in (
        "stable_deploy_permission", "d172_business_mutation",
        "web_mutation", "android_mutation", "functions_mutation",
        "firebase_rules_mutation", "gateway_mutation",
        "business_schema_mutation", "new_provider_resource",
        "field_pass", "owner_pass",
    ):
        if auth.get(key) is not False:
            deny("FORBIDDEN_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "161":
        deny("AGENT_VERSION")
    if "AgentBuild = 161;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD")
    if "0.161.0.0" not in (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8"):
        deny("AGENT_ASSEMBLY")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    if git("diff", "--name-only", BASE, "HEAD", "--", *IMMUTABLE).stdout.strip():
        deny("FOREIGN_D172_AUTH_OR_STABLE_MUTATION")
    changed = set(git("diff", "--name-only", BASE, "HEAD", "--", *PROTECTED).stdout.splitlines())
    if changed - ALLOWED:
        deny("UNAPPROVED_SOURCE:" + ",".join(sorted(changed - ALLOWED)))
    if not REQUIRED.issubset(changed):
        deny("MISSING_REQUIRED_SOURCE:" + ",".join(sorted(REQUIRED - changed)))
    source = (ROOT / "service/src/read-model-core.ts").read_text(encoding="utf-8")
    agent = (ROOT / "relay-agent/Program.cs").read_text(encoding="utf-8")
    if not all(s in source for s in (
        "web_session_started_at AS login_at", "android_session_started_at AS login_at",
        "AUTHENTICATED_INTERACTIVE_SESSION", 'source: "AUTHENTICATED_SESSION"',
    )):
        deny("READONLY_ROSTER_CONTRACT_MISSING")
    if not all(s in agent for s in (
        "ConfirmManualPicklist(singleAutoConfirm)", "result.Matches.Count == 1",
        "_confirmationGuard.TryBegin", "_supraBrowser.ConfirmExact",
    )):
        deny("WMS_CONFIRM_GUARD_MISSING")
    pin = auth.get("approved_source_sha")
    valid = (auth.get("source_ci_verified") is True
             and isinstance(pin, str) and re.fullmatch("[a-f0-9]{40}", pin)
             and pin == auth.get("source_ci_sha")
             and auth.get("required_ci_success", 0) >= 25
             and auth.get("required_ci_failed") == 0
             and all(auth.get(key) is True for key in (
                 "d172_cross_regression_pass", "windows_build_test_pass",
                 "windows_startup_smoke_pass", "service_typecheck_pass",
                 "email_preservation_pass",
             )))
    if not valid:
        if args.preflight:
            print("D173_E103_SCOPE_PASS_CI_PIN_PENDING")
            return
        deny("EXACT_PR_CI_NOT_VERIFIED")
    if git("cat-file", "-e", pin + "^{commit}").returncode or (
        git("merge-base", "--is-ancestor", pin, "HEAD").returncode):
        deny("CI_PIN_NOT_ANCESTOR")
    if git("diff", "--name-only", pin, "HEAD", "--", *PROTECTED).stdout.strip():
        deny("PROTECTED_RUNTIME_CHANGED_AFTER_CI")
    if args.preflight:
        print("D173_E103_SOURCE_CI_PREFLIGHT_PASS " + pin[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push" or
        os.getenv("GITHUB_REF") != "refs/heads/main" or
        not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("PROTECTED_MAIN_OWNER_MARKER_MISSING")
    print("D173_E103_OWNER_SCOPED_" + args.component.upper() + "_RELEASE_PASS " + pin[:12])

if __name__ == "__main__":
    main()
