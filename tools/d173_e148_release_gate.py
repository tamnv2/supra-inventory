#!/usr/bin/env python3
"""D173-E148 exact Owner-scoped Worker-first then Agent169 signed release gate.

Preflight proves authorization and code isolation only, never a deploy grant.
Production gate requires source-pinned CI receipt, main push release marker and
no post-CI changes to protected runtime, native, and release safety source.
"""
import argparse
import ast
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = "ops/d173-e148-agent169-release-authorization.json"
BASE = "a35243aa4bcdffbd37e7ba26be65341de8ccb17e"
MARKER = "D173-E148_WORKER_AGENT_RELEASE:"
OWNER = "OWNER_20261107_D173_E146_AGENT169_PICKER_SHIFT_AND_E148_MANUAL_REFRESH_CODE_AND_PROTECTED_RELEASE"
FROZEN = (
    "service/", "relay-agent/", "relay-agent-webview2-host/",
    "android/", "web/", "firebase/", "functions/", "obpp1291/",
    "pda-management/", "ops/apps-script/",
    ".github/workflows/", "tests/", "tools/",
    "service/wrangler.beta.toml", "service/wrangler.stable.toml",
    "ops/project-scope.json",
)
FORBIDDEN = (
    "android/", "web/", "firebase/", "firebase.json", "functions/",
    "obpp1291/", "pda-management/", "ops/apps-script/",
    "relay-agent-webview2-host/", "usage-test-agent/",
    "service/wrangler.beta.toml", "service/wrangler.stable.toml",
    "ops/project-scope.json", "ops/resource-registry.json",
)
REQUIRED = {
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D173E148ManualRosterRefresh.cs",
    "relay-agent/FirestoreAgentLeaderCoordinator.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/D173E123WindowAudit.cs",
    "relay-agent/D167SkuUi.cs",
    "service/src/core.ts",
    "service/src/index.ts",
    "service/src/firestore-projection.ts",
    "service/src/d173-picker-shift-cron.ts",
}

def deny(detail):
    raise SystemExit("D173_E148_WORKER_AGENT_RELEASE_DENIED:" + detail)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, encoding="utf-8",
        errors="replace", capture_output=True, text=True, check=False)

def contents(path):
    return (ROOT / path).read_text(encoding="utf-8")

def permitted():
    # Parse the E146 exact allowlist instead of maintaining a second stale list.
    source = ast.parse(contents("tools/d173_e146_source_guard.py"))
    for node in source.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "APPROVED" for target in node.targets
        ):
            return set(ast.literal_eval(node.value))
    deny("EXACT_SOURCE_ALLOWLIST_MISSING")

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=["worker","agent"])
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        receipt = json.loads(contents(RECEIPT))
        state = json.loads(contents("ops/project-state.json"))
    except (OSError, ValueError):
        deny("OWNER_RECEIPT_MISSING")
    for key, value in {
        "schema_version": 1,
        "change_id": "D173",
        "checkpoint": "D173-E148",
        "date_vn": "2026-11-07",
        "pr": 853,
        "base_main_sha": BASE,
        "owner_approval_reference": OWNER,
        "owner_code_approved": True,
        "owner_protected_release_approved": True,
        "approved_components": ["worker","agent"],
        "worker_release_marker": MARKER,
        "agent_target_version": 169,
        "host_build": 12,
        "release_channel": "inventory-channel",
        "resource_change": "NONE_EXISTING_WORKER_AND_AGENT_CHANNEL_ONLY",
        "d172_lifecycle": "PENDING_HOLD",
        "stable_deploy_permission": False,
        "android_mutation": False,
        "web_mutation": False,
        "firebase_rules_mutation": False,
        "functions_mutation": False,
        "gateway_mutation": False,
        "obpp_business_mutation": False,
        "new_provider_resource": False,
        "field_pass": False,
        "owner_pass": False,
    }.items():
        if receipt.get(key) != value:
            deny("RECEIPT_" + key)
    e146 = state.get("d173_e146", {})
    e148 = state.get("d173_e148", {})
    if (e146.get("owner_approved") is not True
        or e148.get("owner_approved") is not True
        or e148.get("pr") != 853
        or e148.get("owner_pass") is not False
        or e148.get("stable") != "OWNER_GATED"
        or e148.get("d172") != "INDEPENDENT_PENDING_HOLD"):
        deny("OWNER_STATE_OR_D172_BOUNDARY")
    if (contents("relay-agent/VERSION").strip() != "169"
        or "AgentBuild = 169;" not in contents("relay-agent/AgentConfig.cs")
        or "<AssemblyVersion>0.169.0.0</AssemblyVersion>" not in
            contents("relay-agent/SupraInventoryRelayAgent.csproj")
        or "<FileVersion>0.169.0.0</FileVersion>" not in
            contents("relay-agent/SupraInventoryRelayAgent.csproj")
        or "RequiredHostBuild = 12;" not in contents("relay-agent/AgentBrowserBundle.cs")):
        deny("AGENT169_OR_HOST12_VERSION")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode != 0:
        deny("D172_V9_MAIN_BASE_NOT_ANCESTOR")
    diff = git("diff", "--name-only", BASE, "HEAD", "--",
        "service/", "relay-agent/", "relay-agent-webview2-host/",
        "android/", "web/", "firebase/", "firebase.json", "functions/",
        "obpp1291/", "pda-management/", "ops/apps-script/",
        ".github/workflows/", "tools/", "tests/",
        "ops/project-scope.json", "ops/resource-registry.json")
    if diff.returncode != 0: deny("SOURCE_DIFF_UNAVAILABLE")
    changed = set(diff.stdout.splitlines())
    if changed.difference(permitted()):
        deny("OUT_OF_OWNER_SCOPE:" + ",".join(sorted(changed.difference(permitted()))))
    if not REQUIRED.issubset(changed):
        deny("MISSING_E146_E148_REQUIRED_SOURCE")
    if any(path.startswith(prefix) for path in changed for prefix in FORBIDDEN):
        deny("D172_ANDROID_WEB_RULES_OR_PROVIDER_DRIFT")
    if args.preflight:
        if os.environ.get("GITHUB_EVENT_NAME") == "pull_request":
            if os.environ.get("GITHUB_HEAD_REF") != "fix/d173-e146-agent169-picker-cutoff-20261107":
                deny("WRONG_SOURCE_BRANCH")
            proof = subprocess.run(["python3","tools/d173_e146_source_guard.py"],
                cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
            if proof.returncode != 0: deny("SOURCE_SCOPE_GUARD:" + proof.stderr.strip()[:240])
        if receipt.get("source_ci_verified") is not False and receipt.get("source_ci_verified") is not True:
            deny("CI_PIN_STATUS")
        print("D173_E148_OWNER_SCOPE_PRECHECK_PASS__PRODUCTION_NOT_AUTHORIZED_BY_PREFLIGHT")
        return
    if (os.environ.get("GITHUB_EVENT_NAME") != "push"
        or os.environ.get("GITHUB_REF") != "refs/heads/main"
        or not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
        deny("MAIN_EXPLICIT_RELEASE_MARKER_REQUIRED")
    pin = receipt.get("source_ci_sha") or ""
    if (receipt.get("source_ci_verified") is not True
        or not re.fullmatch("[0-9a-f]{40}", pin)
        or receipt.get("source_ci_success", 0) < 35
        or receipt.get("source_ci_failed") != 0
        or receipt.get("source_ci_skipped", 0) < 0
        or receipt.get("native_build_pass") is not True
        or receipt.get("d172_isolation_pass") is not True
        or receipt.get("authority_pass") is not True):
        deny("EXACT_CI_RECEIPT_NOT_PASS")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("CI_SOURCE_SHA_NOT_ANCESTOR")
    drift = git("diff", "--name-only", pin, "HEAD", "--", *FROZEN)
    if drift.returncode or drift.stdout.strip():
        deny("POST_CI_RUNTIME_OR_GUARD_DRIFT")
    print("D173_E148_RELEASE_OWNER_SCOPE_AND_CI_PIN_PASS component="
        + args.component + " source=" + pin[:12])

if __name__ == "__main__":
    run()
