#!/usr/bin/env python3
"""D173-E079 Owner-approved signed Agent152 only; block all shared runtime release."""
import argparse, json, os, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE="e17191b81d421666fa23134585c5019fb2906d0b"
MARKER="D173-E079_AGENT_ONLY_RELEASE:"
RECEIPT=ROOT/"ops/d173-e079-agent-release-authorization.json"
PROTECTED=("relay-agent/","service/","web/","android/","functions/","firebase/",
           "obpp1291/","relay-agent-webview2-host/",".github/workflows/",
           "tools/","ops/project-scope.json","ops/resource-registry.json")
FORBIDDEN=("web/","android/","functions/","firebase/","obpp1291/",
           "relay-agent-webview2-host/","pda-management/","ops/apps-script/")
def git(*args):
    return subprocess.run(["git",*args],cwd=ROOT,text=True,encoding="utf-8",capture_output=True,check=False)
def deny(reason):raise SystemExit("D173_E079_AGENT_ONLY_RELEASE_DENIED:"+reason)
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--component",choices=("agent",),required=True)
    ap.add_argument("--preflight",action="store_true")
    args=ap.parse_args()
    try:r=json.loads(RECEIPT.read_text(encoding="utf-8"))
    except Exception:deny("RECEIPT_MISSING")
    if r.get("change_id")!="D173" or r.get("checkpoint")!="D173-E079" or (
        r.get("owner_approval_reference")!="OWNER_20261027_E079_NATIVE_GROUPED_USAGE_AND_ALREADY_CONFIRMED_AGENT152_BUILD_RELEASE"
    ) or r.get("approved_components")!=["agent"] or r.get("agent_target_version")!=152 or (
        r.get("d172_lifecycle")!="PENDING_HOLD"
    ):deny("OWNER_SCOPE")
    for key in ("worker_mutation","web_mutation","android_mutation","firebase_mutation",
                "d172_business_mutation","stable_deploy_permission","new_provider_operations",
                "field_pass","owner_field_pass"):
        if r.get(key) is not False:deny("PROHIBITED_"+key)
    if r.get("source_ci_verified") is not True:
        if args.preflight:
            print("D173_E079_CODE_ONLY_RELEASE_HOLD_NO_SOURCE_PIN")
            return
        deny("SOURCE_CI_UNVERIFIED")
    pin=str(r.get("approved_source_sha") or "")
    if not re.fullmatch("[0-9a-f]{40}",pin) or (
        r.get("source_ci_sha")!=pin
    ) or r.get("required_ci_failed")!=0 or r.get("required_ci_success",0)<27 or (
        r.get("windows_net48_startup_pass") is not True
    ) or r.get("native_light_dark_smoke_pass") is not True or (
        r.get("d172_isolation_pass") is not True):
        deny("PIN_CI_VISUAL_D172")
    if git("cat-file","-e",pin+"^{commit}").returncode or (
        git("merge-base","--is-ancestor",pin,"HEAD").returncode):
        deny("PIN_NOT_ANCESTOR")
    if git("diff","--quiet",pin,"HEAD","--",*PROTECTED).returncode:
        deny("PROTECTED_SOURCE_CHANGED_AFTER_CI")
    if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:
        deny("BASELINE_MISSING")
    changes=set(git("diff","--name-only",BASE,"HEAD").stdout.splitlines())
    if any(p.startswith(FORBIDDEN) for p in changes):
        deny("FOREIGN_BUSINESS_OR_D172_CHANGE")
    if any(p.startswith("service/") for p in changes):
        deny("SHARED_WORKER_RUNTIME_CHANGED")
    if not any(p.startswith("relay-agent/") for p in changes):
        deny("AGENT_SOURCE_MISSING")
    cfg=(ROOT/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    if (ROOT/"relay-agent/VERSION").read_text().strip()!="152" or (
        "AgentBuild = 152;" not in cfg
    ):deny("AGENT_VERSION")
    if args.preflight:
        print("D173_E079_AGENT152_PIN_SOURCE_CI_NATIVE_PRECHECK_PASS "+pin[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME")!="push" or (
        os.environ.get("GITHUB_REF")!="refs/heads/main"
    ) or not git("log","-1","--format=%s").stdout.strip().startswith(MARKER):
        deny("PROTECTED_MAIN_OWNER_RELEASE_MARKER_REQUIRED")
    print("D173_E079_AGENT152_SIGNED_OTA_SCOPE_PASS "+pin[:12])
if __name__=="__main__":main()
