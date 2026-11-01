#!/usr/bin/env python3
"""D173-E111: exact-source owner-approved Worker+Agent163+vc123 gated release.

Read-only checks; no deployment, release, provider write or credentials.
"""
import argparse, json, os, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "0a0d2f1d8e045e66d879c37a43453b34a8d92586"
MARKER = "D173-E111_REPORTER_SKU_OVERTIME_RELEASE:"
RECEIPT = ROOT / "ops/d173-e111-release-authorization.json"
UNTOUCHED = ("obpp1291/", "firebase/", "firebase.json", "functions/", "ops/apps-script/",
             "pda-management/", "relay-agent-webview2-host/", "service/wrangler.beta.toml",
             "service/wrangler.stable.toml", "ops/project-scope.json", "ops/resource-registry.json")
SOURCE = ("service/src/d167-sku-sync-logic.ts", "service/src/business-core.ts",
          "service/src/d167-sku-sync-core.ts", "relay-agent/D167SkuCoordinator.cs",
          "relay-agent/D167SkuUi.cs", "relay-agent/AgentBusinessSchedule.cs",
          "relay-agent/Program.cs", "relay-agent/VERSION", "relay-agent/AgentConfig.cs",
          "relay-agent/SupraInventoryRelayAgent.csproj",
          "android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt",
          "android/app/src/main/java/cd/cc/supra/inventory/beta/D173CommandTransport.kt",
          "android/release-notes.json")
SCOPED = set(SOURCE) | {
    "tests/d167-three-slot-sku.test.mjs", "tests/d173-e111-sku-overtime-reporter.test.mjs",
    "tests/d173-e034-release-gate.test.mjs", "tests/d173-e026-phase1-release.test.mjs",
    "tools/d173_e097_startup_regression.mjs", "tools/d173_e060_email_preservation_guard.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d167_release_gate.py", "tools/d173_e111_release_gate.py",
    "ops/d173-e111-release-authorization.json", "ops/authority-manifest.json",
    "ops/project-state.json", "ops/change-continuity/D173.json", "docs/specs/SKU_MASTER.md",
    "docs/OWNER_DECISIONS.md", "docs/D173_E111_REPORTER_SKU_OVERTIME_2026-11-02.md",
    ".github/workflows/deploy-beta.yml", ".github/workflows/verify-apps.yml",
    ".github/workflows/verify-relay-agent.yml", ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/deploy-beta-agent-gateway.yml"
}
def deny(message):
    raise SystemExit("D173_E111_RELEASE_DENIED:" + message)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, encoding="utf-8",
                          capture_output=True, text=True, check=False)

def validate(component, preflight):
    try:
        receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        deny("RECEIPT_MISSING")
    expected = {
        "schema_version": 1, "project_key": "supra-inventory",
        "change_id": "D173", "checkpoint_id": "D173-E111",
        "source_pr": 817,
        "owner_approval_reference": "OWNER_20261102_REPORTER_SKU_05_OVERTIME_2145_CODE_AND_PROTECTED_RELEASE",
        "production_host": "inventory.supra.cc.cd", "worker_resource_key": "worker-beta",
        "base_main_sha": BASE, "release_marker": MARKER,
        "code_permission": True, "merge_permission": True,
        "worker_web_deployment_permission": True,
        "desktop_agent_signed_ota_permission": True,
        "android_signed_ota_permission": True, "agent_target_version": 163,
        "android_target_version_code": 123, "d172_business_mutation": False,
        "firebase_rules_mutation": False, "gateway_mutation": False,
        "other_provider_resource_mutation": False, "stable_deployment_permission": False,
        "sql_schema_recreation_permission": False,
        "owner_business_pass": False, "field_pass": False,
        "approved_order": ["worker_do_web", "agent163_signed_ota_after_worker_health",
                           "android123_signed_ota_after_worker_health_and_agent163"]
    }
    for k, value in expected.items():
        if receipt.get(k) != value:
            deny("OWNER_SCOPE_" + k)
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("SOURCE_BASE_ANCESTRY")
    changed = git("diff", "--name-only", BASE, "HEAD")
    if changed.returncode:
        deny("SOURCE_DIFF_UNAVAILABLE")
    paths = set(changed.stdout.splitlines())
    if paths - SCOPED:
        deny("PATH_OUTSIDE_OWNER_SCOPE:" + ",".join(sorted(paths - SCOPED)))
    if git("diff", "--quiet", BASE, "HEAD", "--", *UNTOUCHED).returncode:
        deny("SHARED_D172_FIREBASE_GATEWAY_STABLE_DRIFT")
    if not set(SOURCE).issubset(paths):
        deny("MISSING_APPROVED_EXECUTABLE_SOURCE")
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "163":
        deny("AGENT_VERSION")
    agent = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    if "AgentBuild = 163;" not in agent:
        deny("AGENT_BUILD")
    note = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    if note.get("schema_version") != 1 or not all(
        isinstance(s, str) and s.startswith("vc123:") for s in note.get("release_notes", [])):
        deny("ANDROID_RELEASE_NOTES")
    if not receipt.get("source_ci_verified"):
        if preflight:
            print("D173_E111_OWNER_SCOPE_PASS__CI_PENDING__NO_RELEASE")
            return
        deny("SOURCE_CI_NOT_VERIFIED")
    sha = receipt.get("source_ci_sha")
    if not isinstance(sha, str) or not re.fullmatch("[0-9a-f]{40}", sha):
        deny("SOURCE_CI_PIN_INVALID")
    if receipt.get("source_ci_failed") != 0 or int(receipt.get("source_ci_success") or 0) < 25:
        deny("SOURCE_CI_INCOMPLETE")
    if git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
        deny("SOURCE_CI_NOT_ANCESTOR")
    if git("diff", "--quiet", sha, "HEAD", "--", "service/", "web/", "android/",
           "relay-agent/", "firebase/", "obpp1291/", "ops/apps-script/", "functions/").returncode:
        deny("EXECUTABLE_DRIFT_AFTER_CI")
    if preflight:
        print("D173_E111_SOURCE_CI_SCOPE_PASS " + sha[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push" or
        os.getenv("GITHUB_REF") != "refs/heads/main" or
        not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        deny("PROTECTED_MAIN_RELEASE_MARKER")
    print("D173_E111_" + component.upper() + "_SCOPED_PRODUCTION_RELEASE_AUTHORIZED")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "agent", "android"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    validate(args.component, args.preflight)
