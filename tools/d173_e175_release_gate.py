#!/usr/bin/env python3
"""D173-E175 Owner-authorized cross-component Beta production gate.

Source-only validation. Never accesses provider secrets or writes runtime state.
Historical Dxxx release receipts cannot authorize this change.
"""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "c7b1c43e4eea7ae879c11796bc6bc60a3e506168"
MARKER = "D173-E175_UNIFIED_PRODUCTION_RELEASE:"
RECEIPT = ROOT / "ops/d173-e175-release-authorization.json"
COMPONENTS = {"worker", "firestore", "agent", "android"}
IMMUTABLE = (
    "obpp1291/", "pda-management/", "functions/", "ops/apps-script/",
    "firebase/database.rules.json", "firebase/firestore.indexes.json",
    "firebase.json", "service/wrangler.beta.toml",
    "service/wrangler.stable.toml", "ops/project-scope.json",
    "ops/resource-registry.json", "relay-agent-webview2-host/",
)
SCOPED_EXACT = {
    "android/release-notes.json", "web/package.json", "web/src/web-version.ts",
    "firebase/firestore.rules", "ops/authority-manifest.json",
    "ops/project-state.json", "ops/change-continuity/D173.json",
    "ops/d173-e175-release-authorization.json",
    "docs/D173_E175_UNIFIED_NETWORK_LOGS_UI_2026-11-10.md",
    "tools/d165_rtdb_ha_regression.py", "tools/d167_release_gate.py",
    "tools/d173_e175_release_gate.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e052_instrumentation_guard.py",
    "tests/d169-client-code-only.test.mjs",
    "tools/d167_dual_track_regression.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e096_source_guard.py",
    "tools/d173_e097_startup_regression.mjs",
    "tests/d173-e175-unified-network.test.mjs",
    "tests/d170-d171-release-parity.test.mjs",
    "tests/d173-e032-ui-code-only.test.mjs",
    "tests/d173-e026-phase1-release.test.mjs",
    "tests/d171-log-delivery.test.mjs",
    "tests/d167-web-ux-consistency.test.mjs",
    ".github/workflows/d173-e175-source.yml",
    ".github/workflows/d171-deploy-isolated-test-rules.yml",
    ".github/workflows/d173-e127-source.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    "tests/d170-official-client-hosts.test.mjs",
    "tools/ui_design_guard.py",
    "tests/d171-single-production-freeze.test.mjs",
    "tests/d173-e034-release-gate.test.mjs",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tests/d171-usage-hotpaths.test.mjs",
    "tests/d173-e036-unified-presentation.test.mjs",
    "tools/android_operational_regression.py",
    "tests/d173-e159-agent172-remediation.test.mjs",
    "tools/d173_e060_email_preservation_guard.py",
    "tools/web_operational_regression.py",
    ".github/workflows/d173-e126-badge-ci.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d171-agent-code-only.yml",
    ".github/workflows/verify-apps.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/d173-e123-source.yml",
}
SCOPED_PREFIXES = (
    "relay-agent/", "service/src/",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/",
)
APP = ("relay-agent/", "service/src/", "web/src/", "web/package.json",
       "android/app/src/", "android/release-notes.json", "firebase/firestore.rules")

def deny(reason):
    raise SystemExit("D173_E175_PRODUCTION_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          encoding="utf-8", errors="replace", capture_output=True)

def strip_comments(source):
    source = re.sub(r"/\*[\s\S]*?\*/", "", source)
    source = re.sub(r"(?m)^\s*//.*(?:\n|$)", "", source)
    return re.sub(r"\s+", "", source)

def check(component, preflight):
    if component not in COMPONENTS:
        deny("COMPONENT_OUT_OF_SCOPE")
    try:
        auth = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except Exception:
        deny("MISSING_AUTHORIZATION")
    exact = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173", "checkpoint_id": "D173-E175",
        "source_pr": 889, "base_main_sha": BASE,
        "release_marker": MARKER,
        "owner_approval_reference": "OWNER_20261110_D173_E175_ALL_UNIFIED_BAO_HANG_PRODUCTION",
        "owner_approved_code": True, "owner_approved_deploy": True,
        "approved_components": ["worker", "firestore", "agent", "android"],
        "worker_web_deployment_permission": True,
        "firebase_rules_republish_existing_scope_only": True,
        "agent_target_version": 177, "android_target_version_code": 128,
        "web_target_version": "3.3.5",
        "production_host": "inventory.supra.cc.cd",
        "no_new_provider_resources": True, "no_stable": True,
        "d172_pending_hold": True, "d172_business_mutation": False,
        "owner_pass": False, "field_pass": False,
    }
    for key, expected in exact.items():
        if auth.get(key) != expected:
            deny("OWNER_SCOPE_" + key)
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("BASE_NOT_ANCESTOR")
    diff = git("diff", "--name-only", BASE, "HEAD")
    if diff.returncode:
        deny("CANNOT_CHECK_SCOPE")
    changed = [x for x in diff.stdout.splitlines() if x]
    unexpected = [x for x in changed if x not in SCOPED_EXACT
                  and not any(x.startswith(p) for p in SCOPED_PREFIXES)]
    if unexpected:
        deny("OUT_OF_SCOPE:" + ",".join(sorted(unexpected)))
    if git("diff", "--quiet", BASE, "HEAD", "--", *IMMUTABLE).returncode:
        deny("D172_STABLE_PROVIDER_OR_INFRA_MUTATION")
    # E140 deployed source contains the strict per-role Agent operator rule;
    # redeploying identical semantics may heal provider-rule drift, but this
    # change cannot add broad reads or alter any D172 unrelated permissions.
    original = git("show", BASE + ":firebase/firestore.rules")
    rules = (ROOT / "firebase/firestore.rules").read_text(encoding="utf-8")
    if original.returncode or strip_comments(original.stdout) != strip_comments(rules):
        deny("FIRESTORE_PERMISSION_SEMANTIC_CHANGE")
    for marker in ("match /relay_poc_rate_limits/{pickerKey}",
                   "allow list: if isAgentOperator();",
                   "function isAgentOperator()", "allow get: if isAgentOperator()"):
        if marker not in rules:
            deny("FIRESTORE_AGENT_RULES_MISSING")
    if (ROOT / "relay-agent/VERSION").read_text().strip() != "177":
        deny("AGENT_VERSION")
    if "AgentBuild = 177;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text():
        deny("AGENT_BUILD_MISMATCH")
    if "0.177.0.0" not in (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text():
        deny("AGENT_ASSEMBLY_VERSION")
    if 'WEB_VERSION = "3.3.5"' not in (ROOT / "web/src/web-version.ts").read_text():
        deny("WEB_VERSION")
    notes = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    if notes.get("schema_version") != 1 or not notes.get("release_notes") or not all(
        isinstance(x, str) and x.startswith("vc128:") for x in notes["release_notes"]
    ):
        deny("ANDROID_NOTES")
    # No signing/publishing until an immutable source commit was checked.
    if not auth.get("source_ci_verified"):
        if preflight:
            print("D173_E175_OWNER_SCOPE_CODE_PREFLIGHT_PASS__CI_AND_RELEASE_PENDING")
            return
        deny("CI_NOT_VERIFIED")
    sha = str(auth.get("source_ci_sha") or "")
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        deny("CI_SHA_MISSING")
    if auth.get("source_ci_failed") != 0 or int(auth.get("source_ci_success") or 0) < 10:
        deny("CI_REQUIRED_GATES_NOT_PASSED")
    if git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
        deny("SOURCE_CI_SHA_NOT_ANCESTOR")
    if git("diff", "--quiet", sha, "HEAD", "--", *APP).returncode:
        deny("APPLICATION_CHANGED_AFTER_SOURCE_CI")
    if preflight:
        print("D173_E175_SOURCE_CI_PINNED_PASS:" + sha[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        deny("MAIN_PUSH_ONLY")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("EXACT_RELEASE_MERGE_MARKER_MISSING")
    print("D173_E175_" + component.upper() + "_BETA_PRODUCTION_AUTHORIZED:" + sha[:12])

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=sorted(COMPONENTS), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    check(args.component, args.preflight)
