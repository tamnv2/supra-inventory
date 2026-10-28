#!/usr/bin/env python3
"""D173 E095: exact-source Owner-gated signed Agent157 only. No Worker/APK/D172."""
import argparse, json, os, re, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE="cc004b261d7167b6cd21c1bd6e43f68870322cea"
MARKER="D173-E095_AGENT157_ONLY_RELEASE:"
FILE=ROOT/"ops/d173-e095-agent157-release-authorization.json"
PROTECTED=("relay-agent/","relay-agent-webview2-host/","service/","web/",
           "android/","functions/","firebase/","firebase.json","obpp1291/",
           "pda-management/","ops/apps-script/",".github/workflows/","tools/")
IMMUTABLE=("service/","web/","android/","functions/","firebase/","firebase.json",
           "obpp1291/","pda-management/","relay-agent-webview2-host/","ops/apps-script/")
ALLOWED={
    "relay-agent/VERSION","relay-agent/AgentConfig.cs","relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/D119AgentFeatures.cs","relay-agent/D160UiHistory.cs",
    "relay-agent/D173E036Theme.cs","relay-agent/D173E038Sidebar.cs",
    "relay-agent/D173E079UsageDashboard.cs","relay-agent/D173E089UsageCards.cs",
    "relay-agent/Program.cs",".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml","tools/d173_e095_source_test.py",
    "tools/d173_e095_agent157_release_gate.py","tools/d167_release_gate.py",
}
REQUIRED={
    "relay-agent/VERSION","relay-agent/AgentConfig.cs","relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/D173E089UsageCards.cs","relay-agent/D173E036Theme.cs",
    "relay-agent/D160UiHistory.cs","tools/d173_e095_source_test.py",
    "tools/d173_e095_agent157_release_gate.py"
}
def git(*args):
    return subprocess.run(["git",*args],cwd=ROOT,text=True,encoding="utf-8",
                          capture_output=True,check=False)
def deny(reason):
    raise SystemExit("D173_E095_AGENT157_RELEASE_DENIED:"+reason)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--component",required=True,choices=["agent"])
    p.add_argument("--preflight",action="store_true")
    a=p.parse_args()
    try: receipt=json.loads(FILE.read_text(encoding="utf-8"))
    except (OSError,ValueError):deny("AUTHORIZATION_MISSING")
    if (receipt.get("change_id")!="D173" or receipt.get("checkpoint")!="D173-E095"
        or receipt.get("owner_approval_reference")!="OWNER_20261028_AGENT157_ALL_E095_REQUIREMENTS_SIGNED_OTA"
        or receipt.get("approved_components")!=["agent"]
        or receipt.get("agent_target_version")!=157
        or receipt.get("base_main_sha")!=BASE
        or receipt.get("production_host")!="inventory.supra.cc.cd"
        or receipt.get("release_marker")!=MARKER
        or receipt.get("d172_lifecycle")!="PENDING_HOLD"):
        deny("OWNER_OR_VERSION_SCOPE")
    for key in ("stable_deploy_permission","d172_business_mutation","worker_mutation",
                "android_mutation","web_mutation","functions_mutation","firebase_rules_mutation",
                "business_schema_mutation","new_provider_resource","field_pass","owner_pass"):
        if receipt.get(key) is not False:deny("PROHIBITED_"+key)
    if ((ROOT/"relay-agent/VERSION").read_text(encoding="utf-8").strip()!="157"
        or "AgentBuild = 157;" not in (ROOT/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
        or "0.157.0.0" not in (ROOT/"relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")):
        deny("VERSION_MISMATCH")
    if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:deny("BASE_NOT_ANCESTOR")
    if git("diff","--name-only",BASE,"HEAD","--",*IMMUTABLE).stdout.strip():
        deny("SHARED_OR_D172_SOURCE_DRIFT")
    changed=set(git("diff","--name-only",BASE,"HEAD","--",*PROTECTED).stdout.splitlines())
    if changed-ALLOWED:deny("UNAUTHORIZED:"+",".join(sorted(changed-ALLOWED)))
    if not REQUIRED.issubset(changed):deny("MISSING_REQUIRED_AGENT_CHANGE")
    source=str(receipt.get("approved_source_sha") or "")
    pinned=(receipt.get("source_ci_verified") is True
            and receipt.get("source_ci_sha")==source
            and re.fullmatch("[0-9a-f]{40}",source)
            and receipt.get("required_ci_success",0)>=1
            and receipt.get("required_ci_failed")==0
            and receipt.get("d172_cross_regression_pass") is True
            and receipt.get("windows_build_test_pass") is True
            and receipt.get("windows_startup_smoke_pass") is True
            and receipt.get("firestore_reset_shift_self_test_pass") is True)
    if not pinned:
        if a.preflight:
            print("D173_E095_AGENT157_SOURCE_SCOPE_PASS_PIN_PENDING")
            return
        deny("PINNED_CI_REQUIRED")
    if git("cat-file","-e",source+"^{commit}").returncode or (
            git("merge-base","--is-ancestor",source,"HEAD").returncode):
        deny("PIN_NOT_ANCESTOR")
    if git("diff","--name-only",source,"HEAD","--",*PROTECTED).stdout.strip():
        deny("PROTECTED_SOURCE_CHANGED_AFTER_CI_PIN")
    if a.preflight:
        print("D173_E095_AGENT157_SOURCE_CI_PREFLIGHT_PASS "+source[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME")!="push"
        or os.getenv("GITHUB_REF")!="refs/heads/main"
        or not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
        deny("RELEASE_MARKER_OR_MAIN_MISSING")
    print("D173_E095_AGENT157_OWNER_SIGNED_RELEASE_PASS "+source[:12])
if __name__=="__main__":main()
