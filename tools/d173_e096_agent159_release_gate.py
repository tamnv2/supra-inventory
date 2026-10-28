#!/usr/bin/env python3
"""D173-E096 Agent159-only signed release; exact approved source and owner CI pin."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE="ebe14ab4c1723165cf361b2d546edd086e2764aa"
MARKER="D173-E096_AGENT159_ONLY_RELEASE:"
RECEIPT=ROOT/"ops/d173-e096-agent159-release-authorization.json"
PROTECTED=(
    "relay-agent/","relay-agent-webview2-host/","service/","web/","android/",
    "functions/","firebase/","firebase.json","obpp1291/","pda-management/",
    "ops/apps-script/",".github/workflows/","tools/"
)
IMMUTABLE=(
    "relay-agent-webview2-host/","service/","web/","android/","functions/",
    "firebase/","firebase.json","obpp1291/","pda-management/","ops/apps-script/"
)
ALLOWED={
    # Owner-reviewed PR791 native WinForms UI:
    "relay-agent/D173E036Theme.cs","relay-agent/D173E089UsageCards.cs",
    "tools/d173_e096_sidebar_progress_test.py",
    # Agent159 versioned, signed build:
    "relay-agent/VERSION","relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    # Existing GitHub release jobs and their exact Owner/source guard:
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    "tools/d167_release_gate.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    ".github/workflows/verify-d171-agent-code-only.yml",
    "tools/d173_e096_agent159_release_gate.py",
}
REQUIRED=ALLOWED.copy()
def git(*args):
    return subprocess.run(["git",*args],cwd=ROOT,text=True,encoding="utf-8",
                          errors="replace",capture_output=True,check=False)
def deny(reason):
    raise SystemExit("D173_E096_AGENT159_RELEASE_DENIED:"+reason)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--component",required=True,choices=["agent"])
    p.add_argument("--preflight",action="store_true")
    args=p.parse_args()
    try: auth=json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError,ValueError): deny("OWNER_RECEIPT_MISSING")
    expected={
        "change_id":"D173","checkpoint":"D173-E096",
        "owner_approval_reference":"OWNER_20261028_D173_E096_AGENT159_SIDEBAR_PROGRESS_SIGNED_OTA",
        "approved_components":["agent"],"agent_target_version":159,
        "base_main_sha":BASE,"production_host":"inventory.supra.cc.cd",
        "release_marker":MARKER,"d172_lifecycle":"PENDING_HOLD",
        "source_pr":791
    }
    for key,value in expected.items():
        if auth.get(key)!=value: deny("OWNER_RECEIPT_"+key)
    for key in ("stable_deploy_permission","d172_business_mutation","worker_mutation",
      "android_mutation","web_mutation","functions_mutation","firebase_rules_mutation",
      "business_schema_mutation","new_provider_resource","field_pass","owner_pass"):
        if auth.get(key) is not False: deny("SCOPE_FORBIDDEN_"+key)
    if ((ROOT/"relay-agent/VERSION").read_text(encoding="utf-8").strip()!="159"
        or "AgentBuild = 159;" not in (ROOT/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
        or "0.159.0.0" not in (ROOT/"relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")):
        deny("VERSION_MISMATCH")
    if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:
        deny("UNRECOGNIZED_BASE")
    out=git("diff","--name-only",BASE,"HEAD","--",*IMMUTABLE)
    if out.returncode or out.stdout.strip(): deny("SHARED_WORKER_D172_OR_BUSINESS_CHANGED")
    out=git("diff","--name-only",BASE,"HEAD","--",*PROTECTED)
    if out.returncode: deny("PROTECTED_DIFF_UNAVAILABLE")
    changed=set(out.stdout.splitlines())
    if changed-ALLOWED: deny("UNAUTHORIZED_SOURCE:"+",".join(sorted(changed-ALLOWED)))
    if not REQUIRED.issubset(changed): deny("REQUIRED_SOURCE_MISSING:"+",".join(sorted(REQUIRED-changed)))
    ui=(ROOT/"relay-agent/D173E089UsageCards.cs").read_text(encoding="utf-8")
    sidebar=(ROOT/"relay-agent/D173E036Theme.cs").read_text(encoding="utf-8")
    if not all(t in ui for t in (
        "metric.BarFill.BackColor=E089RiskColor(metric.DayRatio);",
        "metric.CycleBarFill.BackColor=E089RiskColor(metric.CycleRatio);",
        "E089PaintMissingTarget(card,false,args)")):
        deny("DAY_MONTH_COLOR_SOURCE_DRIFT")
    if 'Text="Agent v"+AgentConfig.AgentBuild' not in sidebar:
        deny("SIDEBAR_VERSION_SOURCE_DRIFT")
    source=str(auth.get("approved_source_sha") or "")
    pinned=(auth.get("source_ci_verified") is True
       and re.fullmatch(r"[a-f0-9]{40}",source) is not None
       and auth.get("source_ci_sha")==source
       and auth.get("required_ci_success",0)>=20
       and auth.get("required_ci_failed")==0
       and all(auth.get(k) is True for k in (
           "d172_cross_regression_pass","windows_build_test_pass",
           "windows_startup_smoke_pass","visual_source_test_pass",
           "authority_ci_pass","continuity_ci_pass")))
    if not pinned:
        if args.preflight:
            print("D173_E096_AGENT159_SCOPE_PASS_CI_PIN_PENDING")
            return
        deny("EXACT_SOURCE_CI_NOT_PINNED")
    if (git("cat-file","-e",source+"^{commit}").returncode
        or git("merge-base","--is-ancestor",source,"HEAD").returncode):
        deny("SOURCE_PIN_NOT_ANCESTOR")
    out=git("diff","--name-only",source,"HEAD","--",*PROTECTED)
    if out.returncode or out.stdout.strip():
        deny("PROTECTED_SOURCE_CHANGED_SINCE_CI")
    if args.preflight:
        print("D173_E096_AGENT159_SOURCE_CI_PASS "+source[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME")!="push" or
        os.getenv("GITHUB_REF")!="refs/heads/main" or
        not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
        deny("RELEASE_NOT_PROTECTED_MAIN_OWNER_MARKER")
    print("D173_E096_AGENT159_SIGNED_RELEASE_PASS "+source[:12])

if __name__=="__main__": main()
