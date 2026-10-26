#!/usr/bin/env python3
"""Owner-scoped D173-E055 existing Worker-only release, fail closed on CI/drift."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "353b0559578792fd75c50abdc717b0affb06a453"
RECEIPT = ROOT / "ops/d173-e055-worker-release-authorization.json"
MARKER = "D173-E055_EXISTING_WORKER_RELEASE:"
PROTECTED = ("service/", "web/", "android/", "relay-agent/", "functions/",
             "firebase/", "firebase.json", "obpp1291/", "pda-management/",
             ".github/workflows/", "tools/", "tests/", "ops/project-scope.json",
             "ops/resource-registry.json", "ops/apps-script/")
UNCHANGED = ("web/", "android/", "relay-agent/", "functions/", "firebase/",
             "firebase.json", "obpp1291/", "pda-management/",
             "ops/project-scope.json", "ops/resource-registry.json", "ops/apps-script/")
ALLOWED = {
 "service/src/operational-v2-core.ts", "service/src/d167-route-usage.ts",
 "tools/d173_e055_usage_regression.py", "tools/d173_e055_worker_release_gate.py",
 "tools/d167_dual_track_regression.py", "tools/operational_v2_regression.py",
 "tools/d167_release_gate.py",
 ".github/workflows/d173-e055-usage.yml", ".github/workflows/deploy-beta.yml",
 "docs/D173_E055_USAGE_OPTIMIZATION_2026-10-27.md",
 "docs/OWNER_DECISIONS.md", "docs/specs/OBSERVABILITY_LOGGING.md",
 "docs/specs/ACCEPTANCE_TESTING.md",
 "ops/d173-e055-worker-release-authorization.json",
 "ops/authority-manifest.json", "ops/project-state.json",
 "ops/change-continuity/D173.json",
}

def fail(msg):
    raise SystemExit("D173_E055_WORKER_RELEASE_DENIED: " + msg)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", choices=("worker",), required=True)
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    try:
        r = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        fail("receipt unavailable")
    if (r.get("change_id") != "D173"
        or r.get("checkpoint") != "D173-E055"
        or r.get("owner_approval_reference") != "OWNER_20261027_IMPLEMENT_GROUP1_THEN_GROUP2_USAGE"
        or r.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or r.get("approved_components") != ["worker"]
        or r.get("production_host") != "inventory.supra.cc.cd"
        or r.get("existing_worker_name") != "supra-inventory-beta"
        or r.get("existing_core_class") != "InventoryCore"
        or r.get("d172_lifecycle") != "PENDING_HOLD"):
        fail("owner/production scope mismatch")
    for key in ("stable_deploy_permission", "android_mutation", "agent_mutation",
                "d172_business_mutation", "firebase_rules_mutation",
                "gateway_mutation", "business_schema_mutation",
                "new_provider_resource", "field_pass", "owner_pass"):
        if r.get(key) is not False:
            fail("unsafe release or acceptance " + key)
    sha = str(r.get("approved_source_sha") or "")
    if (not re.fullmatch(r"[0-9a-f]{40}", sha)
        or sha != r.get("source_ci_sha")
        or r.get("source_ci_verified") is not True
        or r.get("d172_cross_regression_pass") is not True
        or r.get("sql_equivalence_pass") is not True
        or r.get("sqlite_restart_fixture_pass") is not True
        or r.get("service_typecheck_pass") is not True
        or r.get("required_ci_failed") != 0
        or int(r.get("required_ci_success") or 0) < 15):
        fail("exact-source CI, D172 or SQL proof missing")
    if git("cat-file", "-e", sha + "^{commit}").returncode:
        fail("approved source commit absent")
    if git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
        fail("release not descendant of approved source")
    if git("diff", "--quiet", sha, "HEAD", "--", *PROTECTED).returncode:
        fail("protected source changed after CI pin")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        fail("source baseline unavailable")
    if git("diff", "--quiet", BASE, "HEAD", "--", *UNCHANGED).returncode:
        fail("out-of-scope existing infrastructure modified")
    changed = git("diff", "--name-only", BASE, "HEAD")
    if changed.returncode:
        fail("unable to verify scoped diff")
    names = set(changed.stdout.splitlines())
    if not names or names - ALLOWED:
        fail("unauthorized file changed: " + str(sorted(names - ALLOWED)))
    for path in ("service/src/operational-v2-core.ts",
                 "service/src/d167-route-usage.ts",
                 "tools/d173_e055_usage_regression.py"):
        if path not in names:
            fail("missing approved change " + path)
    wrangler = (ROOT / "service/wrangler.beta.toml").read_text(encoding="utf-8")
    if ('name = "supra-inventory-beta"' not in wrangler
        or 'pattern = "inventory.supra.cc.cd"' not in wrangler
        or 'class_name = "InventoryCore"' not in wrangler):
        fail("registered Worker/DO scope mismatch")
    if args.preflight:
        print("D173_E055_SOURCE_PIN_PREFLIGHT_PASS " + sha[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME") != "push"
        or os.getenv("GITHUB_REF") != "refs/heads/main"
        or not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER)):
        fail("main push or Owner merge marker missing")
    print("D173_E055_EXISTING_WORKER_RELEASE_PASS " + sha[:12])

if __name__ == "__main__":
    main()
