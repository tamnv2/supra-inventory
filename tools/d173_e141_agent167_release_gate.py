#!/usr/bin/env python3
"""D173-E141 Agent167 + bundled Host12 only. Exact CI/Owner-gated; no Worker/Android/Web."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "01af1c886e94c1a42fd00bb20802d4260c985cd1"
MARKER = "D173-E141_AGENT167_ONLY_RELEASE:"
RECEIPT = ROOT / "ops/d173-e141-agent167-release-authorization.json"
IMMUTABLE = (
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "usage-test-agent/", "relay-agent-dashboard-probe/",
)
PROTECTED = IMMUTABLE + ("relay-agent/", "relay-agent-webview2-host/",
                         ".github/workflows/", "tools/", "tests/")
ALLOWED = {
    "relay-agent/AgentConfig.cs", "relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/AgentBrowserBundle.cs", "relay-agent/Program.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/FirestoreAgentLeaderCoordinator.cs",
    "relay-agent/D173E141VpsWebMonitor.cs",
    "relay-agent-webview2-host/Program.cs",
    "relay-agent-webview2-host/SupraInventoryWebView2Host.csproj",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/d173-e141-agent-source.yml",
    "tools/d167_release_gate.py",
    "tools/d173_e141_agent167_release_gate.py",
    "tests/d169-agent-web-tab-canary.test.mjs",
    "tests/d173-e141-agent-ha-web-shield.test.mjs",
}
REQUIRED = {
    "relay-agent/VERSION", "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/AgentBrowserBundle.cs", "relay-agent/Program.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/FirestoreAgentLeaderCoordinator.cs",
    "relay-agent/D173E141VpsWebMonitor.cs",
    "relay-agent-webview2-host/Program.cs",
    "relay-agent-webview2-host/SupraInventoryWebView2Host.csproj",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    "tools/d167_release_gate.py",
    ".github/workflows/d173-e141-agent-source.yml",
    "tests/d173-e141-agent-ha-web-shield.test.mjs",
}

def deny(message):
    raise SystemExit("D173_E141_AGENT167_DENIED:" + message)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True, encoding="utf-8", errors="replace", check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["agent"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("RECEIPT_MISSING")
    expected = {
        "change_id": "D173", "checkpoint": "D173-E141", "pr": 844,
        "base_main_sha": BASE,
        "release_marker": MARKER,
        "approved_components": ["agent", "agent_owned_webview2_host"],
        "agent_target_version": 167, "host_build": 12,
        "owner_approval_reference": "OWNER_20261106_AGENT_ONLY_CODE_AND_DEPLOY",
        "d172_lifecycle": "PENDING_HOLD",
    }
    for key, value in expected.items():
        if receipt.get(key) != value:
            deny("OWNER_SCOPE_" + key)
    for key in (
        "stable_deploy_permission", "d172_business_mutation",
        "worker_mutation", "android_mutation", "web_mutation",
        "firebase_rules_mutation", "functions_mutation",
        "gateway_mutation", "new_provider_resource",
        "field_pass", "owner_pass",
    ):
        if receipt.get(key) is not False: deny("FORBIDDEN_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "167":
        deny("AGENT_VERSION")
    if "AgentBuild = 167;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD")
    if "0.167.0.0" not in (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8"):
        deny("AGENT_ASSEMBLY")
    if "RequiredHostBuild = 12;" not in (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"):
        deny("HOST_REQUIREMENT")
    if "1.0.12.0" not in (ROOT / "relay-agent-webview2-host/SupraInventoryWebView2Host.csproj").read_text(encoding="utf-8"):
        deny("HOST_ASSEMBLY")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    immutable = git("diff", "--name-only", BASE, "HEAD", "--", *IMMUTABLE)
    if immutable.returncode or immutable.stdout.strip():
        deny("OTHER_PRODUCT_SOURCE_CHANGED")
    paths = git("diff", "--name-only", BASE, "HEAD", "--", *PROTECTED)
    if paths.returncode: deny("SOURCE_DIFF_UNAVAILABLE")
    changed = set(paths.stdout.splitlines())
    if changed - ALLOWED:
        deny("UNAUTHORIZED_SOURCE:" + ",".join(sorted(changed - ALLOWED)))
    if not REQUIRED.issubset(changed):
        deny("MISSING_SOURCE:" + ",".join(sorted(REQUIRED - changed)))
    pinned = str(receipt.get("approved_source_sha") or "")
    complete = (
        receipt.get("source_ci_verified") is True
        and re.fullmatch("[0-9a-f]{40}", pinned) is not None
        and receipt.get("source_ci_sha") == pinned
        and receipt.get("required_ci_success", 0) >= 5
        and receipt.get("required_ci_failed") == 0
        and all(receipt.get(key) is True for key in (
            "native_agent_build_pass", "native_host_build_pass",
            "agent_startup_smoke_pass", "source_contract_pass",
            "d172_isolation_pass", "authority_ci_pass",
        ))
    )
    if not complete:
        if args.preflight:
            print("E141_AGENT167_SCOPE_PASS__CI_SOURCE_PIN_PENDING")
            return
        deny("CI_SOURCE_NOT_VERIFIED")
    if git("cat-file", "-e", pinned + "^{commit}").returncode or (
        git("merge-base", "--is-ancestor", pinned, "HEAD").returncode
    ):
        deny("CI_PIN_NOT_ANCESTOR")
    drift = git("diff", "--name-only", pinned, "HEAD", "--", *PROTECTED)
    if drift.returncode or drift.stdout.strip():
        deny("PROTECTED_CODE_DRIFT_AFTER_CI")
    if args.preflight:
        print("E141_AGENT167_SOURCE_PIN_CI_PASS:" + pinned[:12])
        return
    if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
        deny("PUSH_MAIN_REQUIRED")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("EXPLICIT_MAIN_RELEASE_MARKER_REQUIRED")
    print("E141_AGENT167_SIGNED_ONLY_RELEASE_GATE_PASS:" + pinned[:12])

if __name__ == "__main__":
    main()
