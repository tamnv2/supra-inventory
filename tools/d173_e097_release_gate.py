#!/usr/bin/env python3
"""D173-E097 Owner-approved existing Worker-only SQLite_NOMEM recovery release gate."""
import argparse, json, os, re, subprocess
from pathlib import Path

R = Path(__file__).resolve().parents[1]
BASE = "15fe01f90466629ad6351cf32b72ba6f6a443b44"
RECEIPT = R / "ops/d173-e097-worker-release-authorization.json"
MARKER = "D173-E097_SQLITE_NOMEM_WORKER_RELEASE:"
PROTECTED = ("service/", "web/", "android/", "relay-agent/", "functions/", "firebase/",
             "firebase.json", "ops/apps-script/", "obpp1291/", "pda-management/",
             ".github/workflows/", "tools/", "ops/project-scope.json", "ops/resource-registry.json")
UNCHANGED = ("web/", "android/", "relay-agent/", "functions/", "firebase/", "firebase.json",
             "ops/apps-script/", "obpp1291/", "pda-management/", "ops/project-scope.json",
             "ops/resource-registry.json", "service/src/index.ts", "service/src/business-api.ts",
             "service/src/read-model-core.ts", "service/src/operational-v2-core.ts")
ALLOWED = {
    "service/src/core.ts", "tools/d173_e086_ws_regression.mjs",
    "tools/d173_e097_startup_regression.mjs", "tools/d173_e097_release_gate.py",
    "tools/d167_release_gate.py", ".github/workflows/deploy-beta.yml",
    "ops/d173-e097-worker-release-authorization.json",
    "docs/D173_E097_SQLITE_NOMEM_INCIDENT_2026-10-29.md",
    "ops/authority-manifest.json", "ops/project-state.json",
    "ops/change-continuity/D173.json",
}

def git(*args):
    return subprocess.run(["git", *args], cwd=R, text=True, encoding="utf-8",
                          capture_output=True, check=False)

def fail(reason):
    raise SystemExit("D173_E097_WORKER_RELEASE_DENIED: " + reason)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--component", choices=("worker",), required=True)
    p.add_argument("--preflight", action="store_true")
    args = p.parse_args()
    try:
        receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        fail("MISSING_RECEIPT")
    if (receipt.get("change_id") != "D173" or
        receipt.get("checkpoint") != "D173-E097" or
        receipt.get("owner_approval_reference") != "OWNER_20261029_P0_SQLITE_NOMEM_REPAIR_AND_DEPLOY" or
        receipt.get("approved_components") != ["worker"] or
        receipt.get("existing_worker_name") != "supra-inventory-beta" or
        receipt.get("existing_core_class") != "InventoryCore" or
        receipt.get("production_host") != "inventory.supra.cc.cd" or
        receipt.get("d172_lifecycle") != "PENDING_HOLD"):
        fail("OWNER_RESOURCE_SCOPE")
    for key in ("stable_deploy_permission", "agent_mutation", "web_mutation",
                "android_mutation", "d172_business_mutation", "firebase_rules_mutation",
                "gateway_mutation", "business_schema_mutation", "new_provider_resource",
                "field_pass", "owner_pass"):
        if receipt.get(key) is not False:
            fail("UNSAFE_SCOPE_" + key)
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        fail("ACCEPTED_BASE_MISSING")
    if git("diff", "--quiet", BASE, "HEAD", "--", *UNCHANGED).returncode:
        fail("BUSINESS_OR_D172_DRIFT")
    changed = git("diff", "--name-only", BASE, "HEAD")
    if changed.returncode:
        fail("DIFF_FAILED")
    paths = set(changed.stdout.splitlines())
    if paths - ALLOWED:
        fail("EXTRA_FILES:" + repr(sorted(paths - ALLOWED)))
    if not {"service/src/core.ts", "tools/d173_e097_startup_regression.mjs"}.issubset(paths):
        fail("REPAIR_AND_FIXTURE_REQUIRED")
    wrangler = (R / "service/wrangler.beta.toml").read_text(encoding="utf-8")
    for s in ('name = "supra-inventory-beta"', 'pattern = "inventory.supra.cc.cd"',
              'class_name = "InventoryCore"'):
        if s not in wrangler:
            fail("WRANGLER_RESOURCE_SCOPE")
    if not (receipt.get("source_ci_verified") is True and
            receipt.get("d172_cross_regression_pass") is True and
            receipt.get("typecheck_pass") is True and
            receipt.get("bootstrap_fixture_pass") is True and
            receipt.get("sql_equivalence_pass") is True and
            receipt.get("sqlite_restart_pass") is True and
            receipt.get("required_ci_failed") == 0 and
            int(receipt.get("required_ci_success") or 0) >= 23):
        if args.preflight:
            print("D173_E097_SOURCE_CI_PENDING__NO_RELEASE")
            return
        fail("SOURCE_CI_AND_D172_RECEIPTS")
    sha = str(receipt.get("approved_source_sha") or "")
    if not re.fullmatch(r"[a-f0-9]{40}", sha) or sha != receipt.get("source_ci_sha"):
        fail("SOURCE_PIN_MISMATCH")
    if (git("cat-file", "-e", sha + "^{commit}").returncode or
            git("merge-base", "--is-ancestor", sha, "HEAD").returncode):
        fail("SOURCE_PIN_NOT_ANCESTOR")
    if git("diff", "--quiet", sha, "HEAD", "--", *PROTECTED).returncode:
        fail("PROTECTED_SOURCE_CHANGED_AFTER_CI")
    if args.preflight:
        print("D173_E097_SOURCE_CI_PIN_PASS " + sha[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push" or
        os.getenv("GITHUB_REF") != "refs/heads/main" or
        not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        fail("OWNER_RELEASE_MARKER_REQUIRED")
    print("D173_E097_EXISTING_WORKER_ONLY_RELEASE_PASS " + sha[:12])

if __name__ == "__main__":
    main()
