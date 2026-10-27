#!/usr/bin/env python3
"""D173-E060 VPS Usage existing Worker + Agent149 only, exact CI-pinned release."""
import argparse, json, os, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RECEIPT=ROOT/"ops/d173-e060-usage-release-authorization.json"
MARKER="D173-E060_USAGE_RELEASE:"
BASE="be667eb7b54040423df74289902a5a3b4824a59a"
PROTECTED=("service/","relay-agent/",".github/workflows/","tools/","ops/project-scope.json")
UNCHANGED=("web/","android/","functions/","firebase/","firebase.json",
           "obpp1291/","pda-management/","ops/apps-script/",
           "relay-agent-webview2-host/","service/src/core.ts",
           "service/src/operational-v2-core.ts","service/src/obpp1291-sheets.ts")
EXPECTED={
    "service/src/d173-vps-usage.ts","service/src/index.ts",
    "relay-agent/D173VpsUsage.cs","relay-agent/Program.cs",
    "relay-agent/AgentConfig.cs","relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e060_usage_release_gate.py",
    "tools/d167_release_gate.py",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-e060-vps-usage.yml",
    "ops/d173-e060-usage-release-authorization.json"
}
def fail(m): raise SystemExit("D173_E060_RELEASE_DENIED:"+m)
def git(*a):
    return subprocess.run(["git",*a],cwd=ROOT,text=True,capture_output=True,check=False)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--component",required=True,choices=("worker","agent"))
    p.add_argument("--preflight",action="store_true")
    a=p.parse_args()
    try: receipt=json.loads(RECEIPT.read_text())
    except (OSError,ValueError):fail("MISSING_RECEIPT")
    if receipt.get("change_id")!="D173" or receipt.get("checkpoint")!="D173-E060" or (
        receipt.get("owner_approval_reference")!="OWNER_20261027_VPS_ONLY_AGENT_USAGE_INTEGRATION_AND_RELEASE"
    ) or receipt.get("status")!="OWNER_EXPLICIT_DEPLOY_APPROVED" or (
        receipt.get("approved_components")!=["worker","agent"]
    ) or receipt.get("production_host")!="inventory.supra.cc.cd" or (
        receipt.get("existing_worker_name")!="supra-inventory-beta"
    ) or receipt.get("agent_target_version")!=149 or (
        receipt.get("d172_lifecycle")!="PENDING_HOLD"):
        fail("SCOPE_OWNER_IDENTITY")
    for key in ("stable_deploy_permission","d172_business_mutation","android_mutation",
                "web_mutation","functions_mutation","firebase_rules_mutation",
                "new_provider_resource","business_schema_mutation","field_pass","owner_pass"):
        if receipt.get(key) is not False:fail("PROHIBITED_"+key)
    pin=str(receipt.get("approved_source_sha") or "")
    if (not re.fullmatch("[0-9a-f]{40}",pin) or
        receipt.get("source_ci_sha")!=pin or
        receipt.get("source_ci_verified") is not True or
        receipt.get("required_ci_failed")!=0 or
        receipt.get("required_ci_success",0)<15 or
        receipt.get("d172_cross_regression_pass") is not True or
        receipt.get("windows_build_test_pass") is not True or
        receipt.get("service_typecheck_pass") is not True):
        fail("SOURCE_CI_REQUIRED")
    if git("cat-file","-e",pin+"^{commit}").returncode or (
        git("merge-base","--is-ancestor",pin,"HEAD").returncode):
        fail("UNPINNED_SOURCE")
    if git("diff","--quiet",pin,"HEAD","--",*PROTECTED).returncode:
        fail("SOURCE_CHANGED_SINCE_CI")
    if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:
        fail("BASELINE_MISSING")
    if git("diff","--quiet",BASE,"HEAD","--",*UNCHANGED).returncode:
        fail("D172_OR_BUSINESS_DRIFT")
    files=set(git("diff","--name-only",BASE,"HEAD").stdout.splitlines())
    if not EXPECTED.issubset(files):fail("MISSING_SOURCE")
    allowed_prefixes=("docs/","ops/","service/src/","relay-agent/",
                      ".github/workflows/","tools/")
    if any(not f.startswith(allowed_prefixes) for f in files):fail("UNKNOWN_SCOPE_FILE")
    if (ROOT/"relay-agent/VERSION").read_text().strip()!="149":fail("WRONG_AGENT_VERSION")
    if a.preflight:
        print("D173_E060_RELEASE_SOURCE_PREFLIGHT_PASS "+a.component+" "+pin[:12])
        return
    if os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main" or not (
        git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
        fail("EXACT_OWNER_MERGE_MARKER_REQUIRED")
    print("D173_E060_EXISTING_SCOPE_RELEASE_PASS "+a.component+" "+pin[:12])
if __name__=="__main__":main()
