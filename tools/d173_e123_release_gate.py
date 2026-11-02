#!/usr/bin/env python3
"""D173-E123 exact-owner/exact-source protected multi-component release gate.

No mutations or credential reads. Mandatory CI and immutable resource boundaries.
"""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "935a3e1b09a6753adac207ca81f4d09978567cdf"
MARKER = "D173-E123_OWNER_PRODUCTION_RELEASE:"
RECEIPT = ROOT / "ops/d173-e123-release-authorization.json"
IMMUTABLE = (
    "obpp1291/", "firebase/database.rules.json", "firebase/firestore.indexes.json",
    "functions/", "ops/apps-script/", "pda-management/", "relay-agent-webview2-host/",
    "service/wrangler.beta.toml", "service/wrangler.stable.toml",
    "ops/project-scope.json", "ops/resource-registry.json",
)
APP_DIRS = ("service/", "web/", "android/", "relay-agent/", "firebase/")
SOURCE = (
    "service/src/core.ts", "service/src/index.ts",
    "service/src/d173-picker-shift.ts", "service/src/operational-v2-core.ts",
    "web/src/operational-app.ts", "web/src/web-version.ts", "web/package.json",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt",
    "android/release-notes.json", "relay-agent/AgentConfig.cs",
    "relay-agent/VERSION", "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/Program.cs", "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D157AgentFeatures.cs", "relay-agent/FirestoreAgentSync.cs",
    "relay-agent/FirestoreVpsReclaim.cs", "relay-agent/D173E123WindowAudit.cs",
    "firebase/firestore.rules",
)
SCOPED = set(SOURCE) | {
    "docs/D173_E123_OWNER_PRODUCTION_SCOPE_2026-11-03.md",
    "docs/OWNER_DECISIONS.md", "docs/specs/ACCEPTANCE_TESTING.md",
    "docs/specs/AUTH_RBAC.md", "docs/specs/OBSERVABILITY_LOGGING.md",
    "docs/specs/ROLE_WORKFLOWS.md", "ops/authority-manifest.json",
    "ops/change-continuity/D173.json", "ops/project-state.json",
    "ops/d173-e123-release-authorization.json",
    "tests/d173-e123-shift-contract.test.mjs",
    "tools/d173_e123_release_gate.py", "tools/d167_release_gate.py",
    ".github/workflows/deploy-beta.yml", ".github/workflows/verify-apps.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/d173-e123-source.yml",
    "tests/d173-e123-sql-ack-parity.test.mjs",
}

def deny(reason):
    raise SystemExit("D173_E123_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          encoding="utf-8", capture_output=True, check=False)

def check(component, preflight):
    try:
        r = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("MISSING_RECEIPT")
    expected = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173", "checkpoint_id": "D173-E123",
        "source_pr": 828, "base_main_sha": BASE, "release_marker": MARKER,
        "owner_approval_reference": "OWNER_20261103_D173_ALL_APPROVED_PRODUCTION_PICKER_SHIFT_T15_SQL_AGENT_WEB",
        "code_permission": True, "merge_permission": True,
        "worker_web_deployment_permission": True,
        "firestore_rules_deployment_permission": True,
        "desktop_agent_signed_ota_permission": True,
        "android_signed_ota_permission": True,
        "agent_target_version": 164, "android_target_version_code": 124,
        "production_host": "inventory.supra.cc.cd",
        "worker_resource_key": "worker-beta",
        "d172_business_mutation": False,
        "new_provider_resource_permission": False,
        "gateway_mutation": False, "stable_deployment_permission": False,
        "owner_business_pass": False, "field_pass": False,
        "approved_order": [
            "existing_worker_do_web", "same_existing_firestore_rules_narrow_defer",
            "signed_agent164_after_worker_and_rules",
            "signed_android124_after_worker_and_agent164"
        ]
    }
    for k, v in expected.items():
        if r.get(k) != v:
            deny("OWNER_SCOPE_" + k)
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("NOT_BASE_DESCENDANT")
    diff = git("diff", "--name-only", BASE, "HEAD")
    if diff.returncode:
        deny("DIFF_UNAVAILABLE")
    paths = set(diff.stdout.splitlines())
    unexpected = paths - SCOPED
    if unexpected:
        deny("OUTSIDE_APPROVED_SCOPE:" + ",".join(sorted(unexpected)))
    if not set(SOURCE).issubset(paths):
        deny("MISSING_APPROVED_SOURCE")
    if git("diff", "--quiet", BASE, "HEAD", "--", *IMMUTABLE).returncode:
        deny("D172_STABLE_PROVIDER_SOURCE_DRIFT")
    rules = (ROOT / "firebase/firestore.rules").read_text(encoding="utf-8")
    if "request.resource.data.status in ['APPROVED', 'DEFERRED']" not in rules:
        deny("DEFER_NOT_RESTRICTED_APPROVER")
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "164":
        deny("AGENT_VERSION")
    if "AgentBuild = 164;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD")
    notes = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    if notes.get("schema_version") != 1 or not notes.get("release_notes") or not all(
        isinstance(x, str) and x.startswith("vc124:") for x in notes["release_notes"]
    ):
        deny("ANDROID_NOTES")
    if not r.get("source_ci_verified"):
        if preflight:
            print("D173_E123_OWNER_SCOPE_PASS__CI_PENDING__NO_PRODUCTION_RELEASE")
            return
        deny("SOURCE_CI_PENDING")
    sha = str(r.get("source_ci_sha") or "")
    if not re.fullmatch("[0-9a-f]{40}", sha) or r.get("source_ci_failed") != 0:
        deny("CI_PIN_OR_FAILURE")
    if int(r.get("source_ci_success") or 0) < 25:
        deny("INSUFFICIENT_CI_PROOF")
    if git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
        deny("CI_PIN_NOT_IN_ANCESTRY")
    if git("diff", "--quiet", sha, "HEAD", "--", *APP_DIRS).returncode:
        deny("APP_EXECUTABLE_SOURCE_CHANGED_AFTER_TEST")
    if preflight:
        print("D173_E123_CI_SOURCE_PASS:" + sha[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        deny("PROTECTED_MAIN_ONLY")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("RELEASE_MARKER_MISSING")
    print("D173_E123_" + component.upper() + "_PRODUCTION_AUTHORIZED " + sha[:12])

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "firestore", "agent", "android"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    check(args.component, args.preflight)
