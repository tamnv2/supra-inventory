#!/usr/bin/env python3
"""D173-E086 existing Worker-only Owner-approved hibernation repair gate."""
import argparse, json, os, re, subprocess
from pathlib import Path

R=Path(__file__).resolve().parents[1]
BASE="8e3ae194e891063de19b0c6362dd086c8bb65fc7"
RECEIPT=R/"ops/d173-e086-worker-release-authorization.json"
MARKER="D173-E086_HIBERNATION_WORKER_RELEASE:"
PROTECTED=("service/","web/","android/","relay-agent/","functions/","firebase/",
 "firebase.json","ops/apps-script/","obpp1291/","pda-management/",
 ".github/workflows/","tools/","ops/project-scope.json","ops/resource-registry.json")
UNCHANGED=("web/","android/","relay-agent/","functions/","firebase/","firebase.json",
 "ops/apps-script/","obpp1291/","pda-management/","ops/project-scope.json",
 "ops/resource-registry.json","service/src/index.ts","service/src/business-api.ts",
 "service/src/read-model-core.ts","service/src/operational-v2-core.ts",
 "service/src/d173-vps-usage.ts")
ALLOWED={
 "service/src/core.ts","tools/d173_e086_ws_regression.mjs",
 "tools/d173_e086_release_gate.py","tools/d167_release_gate.py",
 ".github/workflows/d173-e086-worker.yml",".github/workflows/deploy-beta.yml",
 "ops/d173-e086-worker-release-authorization.json",
 "docs/D173_E086_DO_HIBERNATION_WORKER_RELEASE_2026-10-28.md",
 "docs/OWNER_DECISIONS.md","docs/specs/REALTIME_NOTIFICATIONS.md",
 "ops/authority-manifest.json","ops/project-state.json","ops/change-continuity/D173.json"
}
def git(*args):
    return subprocess.run(["git",*args],cwd=R,text=True,encoding="utf-8",
                          capture_output=True,check=False)
def fail(reason):raise SystemExit("D173_E086_WORKER_RELEASE_DENIED: "+reason)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--component",choices=("worker",),required=True)
    p.add_argument("--preflight",action="store_true")
    args=p.parse_args()
    try:r=json.loads(RECEIPT.read_text(encoding="utf8"))
    except (OSError,ValueError):fail("MISSING_RECEIPT")
    if (r.get("change_id")!="D173" or r.get("checkpoint")!="D173-E086"
       or r.get("owner_approval_reference")!="OWNER_20261028_DO_P1_SAFE_FIX_AND_CONDITIONAL_P2_PRODUCTION"
       or r.get("approved_components")!=["worker"]
       or r.get("existing_worker_name")!="supra-inventory-beta"
       or r.get("existing_core_class")!="InventoryCore"
       or r.get("production_host")!="inventory.supra.cc.cd"
       or r.get("d172_lifecycle")!="PENDING_HOLD"):fail("OWNER_RESOURCE_SCOPE")
    for key in ("stable_deploy_permission","agent_mutation","web_mutation","android_mutation",
                "d172_business_mutation","firebase_rules_mutation","gateway_mutation",
                "business_schema_mutation","new_provider_resource","field_pass","owner_pass"):
        if r.get(key) is not False:fail("UNSAFE_SCOPE_"+key)
    if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:fail("ACCEPTED_BASE_MISSING")
    if git("diff","--quiet",BASE,"HEAD","--",*UNCHANGED).returncode:fail("BUSINESS_OR_D172_DRIFT")
    diff=git("diff","--name-only",BASE,"HEAD")
    if diff.returncode:fail("DIFF_FAILED")
    paths=set(diff.stdout.splitlines())
    if paths-ALLOWED:fail("EXTRA_FILES:"+str(sorted(paths-ALLOWED)))
    if not {"service/src/core.ts","tools/d173_e086_ws_regression.mjs"}.issubset(paths):
        fail("REPAIR_AND_TEST_REQUIRED")
    w=(R/"service/wrangler.beta.toml").read_text(encoding="utf8")
    for s in ('name = "supra-inventory-beta"','pattern = "inventory.supra.cc.cd"',
              'class_name = "InventoryCore"'):
        if s not in w:fail("WRANGLER_SCOPE")
    if (r.get("source_ci_verified") is not True or
        r.get("d172_cross_regression_pass") is not True or
        r.get("typecheck_pass") is not True or
        r.get("frame_behavior_pass") is not True or
        r.get("sql_equivalence_pass") is not True or
        r.get("sqlite_restart_pass") is not True or
        r.get("required_ci_failed")!=0 or int(r.get("required_ci_success") or 0)<6):
        if args.preflight:
            print("D173_E086_SOURCE_CI_PENDING__NO_RELEASE")
            return
        fail("SOURCE_TEST_RECEIPTS")
    sha=str(r.get("approved_source_sha") or "")
    if not re.fullmatch(r"[a-f0-9]{40}",sha) or sha!=r.get("source_ci_sha"):
        fail("SOURCE_PIN_MISMATCH")
    if git("cat-file","-e",sha+"^{commit}").returncode or git("merge-base","--is-ancestor",sha,"HEAD").returncode:
        fail("SOURCE_NOT_IN_HISTORY")
    if git("diff","--quiet",sha,"HEAD","--",*PROTECTED).returncode:fail("SOURCE_CHANGED_AFTER_CI")
    if args.preflight:
        print("D173_E086_SOURCE_CI_PIN_PASS "+sha[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME")!="push" or
        os.getenv("GITHUB_REF")!="refs/heads/main" or
        not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
        fail("OWNER_MARKER_REQUIRED")
    print("D173_E086_HIBERNATION_WORKER_RELEASE_PASS "+sha[:12])
if __name__=="__main__":main()
