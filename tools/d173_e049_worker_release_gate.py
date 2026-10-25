#!/usr/bin/env python3
"""E049 protected existing-Worker-only durable telemetry release; D172 remains HOLD."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "c4bf717df6eb001e245030fd3e3f6e65f30ba20d"
RECEIPT = ROOT / "ops/d173-e049-worker-release-authorization.json"
MARKER = "D173-E049_EXISTING_WORKER_RELEASE:"
PROTECTED = (
    "service/", "web/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "functions/", "firebase/", "firebase.json", "obpp1291/", "pda-management/",
    ".github/workflows/", "tools/", "tests/", "ops/project-scope.json",
    "ops/resource-registry.json", "ops/apps-script/",
)
ISOLATED = (
    "web/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "functions/", "firebase/", "firebase.json", "obpp1291/", "pda-management/",
    "ops/project-scope.json", "ops/resource-registry.json", "ops/apps-script/",
)
ALLOWED = {
    "service/src/core.ts", "service/src/d166-sql-usage.ts",
    "service/src/d167-route-usage.ts", "service/src/d173-persistent-usage.ts",
    "tests/d173-e049-durable-usage.test.mjs",
    "tools/d173_e049_sqlite_fixture.py",
    "tools/d173_e049_worker_release_gate.py",
    "tools/operational_v2_regression.py",
    "tools/d167_dual_track_regression.py",
    "tools/d167_release_gate.py",
    ".github/workflows/d166-log-only-regression.yml",
    ".github/workflows/d173-email-sender-guard.yml",
    ".github/workflows/deploy-beta.yml",
    "docs/D173_E049_DO_PERSISTENT_USAGE_2026-10-25.md",
    "docs/OWNER_DECISIONS.md", "docs/specs/OBSERVABILITY_LOGGING.md",
    "docs/specs/ACCEPTANCE_TESTING.md",
    "ops/d173-e049-worker-release-authorization.json",
    "ops/authority-manifest.json", "ops/change-continuity/D173.json",
    "ops/project-state.json",
}

def deny(reason):
    raise SystemExit("D173_E049_WORKER_RELEASE_DENIED: " + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True, check=False)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", choices=("worker",), required=True)
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    try:
        data = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("missing owner authorization")
    if (data.get("change_id") != "D173" or data.get("checkpoint") != "D173-E049"
        or data.get("owner_approval_reference") != "OWNER_EXPLICIT_D173_E049_DURABLE_DO_LOG_RELEASE_20261025"
        or data.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or data.get("approved_components") != ["worker"]
        or data.get("production_host") != "inventory.supra.cc.cd"
        or data.get("existing_worker_name") != "supra-inventory-beta"
        or data.get("existing_core_class") != "InventoryCore"
        or data.get("d172_lifecycle") != "PENDING_HOLD"):
        deny("scope/Owner mismatch")
    for field in ("stable_deploy_permission", "agent_mutation",
                  "android_mutation", "d172_business_mutation",
                  "d172_ota_mutation", "firebase_rules_mutation",
                  "gateway_mutation", "new_provider_resource",
                  "business_schema_mutation", "field_pass", "owner_pass"):
        if data.get(field) is not False:
            deny("unapproved resource/Owner pass: " + field)
    if data.get("telemetry_table_additive") is not True or data.get("sql_write_budget_documented") is not True:
        deny("additive SQLite scope and extra write cost not documented")
    pin = str(data.get("approved_source_sha") or "")
    if (not re.fullmatch(r"[0-9a-f]{40}", pin)
        or data.get("source_ci_sha") != pin
        or data.get("source_ci_verified") is not True
        or int(data.get("required_ci_success") or 0) < 25
        or data.get("required_ci_failed") != 0
        or data.get("d172_cross_regression_pass") is not True
        or data.get("sqlite_restart_fixture_pass") is not True
        or data.get("service_typecheck_pass") is not True):
        deny("CI D172/SQL durability/source proof missing")
    if git("cat-file", "-e", pin + "^{commit}").returncode:
        deny("pinned CI source missing")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("released HEAD does not descend from CI source")
    if git("diff", "--quiet", pin, "HEAD", "--", *PROTECTED).returncode:
        deny("protected Worker/source/tests/CI drift after source pin")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("accepted Agent146 baseline changed")
    if git("diff", "--quiet", BASE, "HEAD", "--", *ISOLATED).returncode:
        deny("Agent146/Android/D172/Firebase/Gateway/Stable changed")
    changed = git("diff", "--name-only", BASE, "HEAD")
    if changed.returncode:
        deny("cannot check diff")
    names = set(changed.stdout.splitlines())
    if not names or names - ALLOWED:
        deny("outside authorized E049: " + repr(sorted(names - ALLOWED)))
    if not all(path in names for path in (
        "service/src/core.ts", "service/src/d173-persistent-usage.ts",
        "service/src/d166-sql-usage.ts", "service/src/d167-route-usage.ts",
    )):
        deny("required measured code missing")
    telemetry = (ROOT / "service/src/d173-persistent-usage.ts").read_text(encoding="utf-8")
    if ("CREATE TABLE IF NOT EXISTS d173_usage_counters" not in telemetry
        or "ON CONFLICT(hour_utc, metric_kind, metric_id, method) DO UPDATE" not in telemetry
        or "const RETENTION_DAYS = 35" not in telemetry):
        deny("durable schema/synchronous recording missing")
    wrangler = (ROOT / "service/wrangler.beta.toml").read_text(encoding="utf-8")
    if ('name = "supra-inventory-beta"' not in wrangler
        or 'pattern = "inventory.supra.cc.cd"' not in wrangler
        or 'class_name = "InventoryCore"' not in wrangler):
        deny("existing Worker/core binding changed")
    if args.preflight:
        print("D173_E049_WORKER_SOURCE_PREFLIGHT_PASS pin=" + pin[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push"
        or os.getenv("GITHUB_REF") != "refs/heads/main"):
        deny("not protected main push")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("exact Owner Worker-only release marker missing")
    print("D173_E049_EXISTING_WORKER_RELEASE_OWNER_GATE_PASS pin=" + pin[:12])

if __name__ == "__main__":
    main()
