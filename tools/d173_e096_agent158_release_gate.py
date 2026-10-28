#!/usr/bin/env python3
"""D173-E096: Owner-approved exact-source, read-only Worker first and signed Agent158."""
import argparse, json, os, re, subprocess
from pathlib import Path

R = Path(__file__).resolve().parents[1]
BASE = "348e8dd231604ce896271b762797dbe1684136b5"
MARKER = "D173-E096_AGENT158_WORKER_RELEASE:"
RECEIPT = R / "ops/d173-e096-agent158-release-authorization.json"
PROTECTED = ("relay-agent/","service/","web/","android/","functions/","firebase/",
             "firebase.json","obpp1291/","pda-management/","ops/apps-script/",
             "relay-agent-webview2-host/",".github/workflows/","tools/")
IMMUTABLE = ("web/","android/","functions/","firebase/","firebase.json",
             "obpp1291/","pda-management/","ops/apps-script/","relay-agent-webview2-host/")
ALLOWED = {
    "relay-agent/VERSION","relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/D119AgentFeatures.cs","relay-agent/D173DesktopResources.cs",
    "relay-agent/D173E089UsageCards.cs","relay-agent/D173E069ApprovedUsageUi.cs",
    "relay-agent/D173VpsUsage.cs","relay-agent/Program.cs",
    "service/src/index.ts",
    "tools/d173_e060_vps_usage_guard.py","tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e060_email_preservation_guard.py","tools/d173_email_release_gate.py",
    "tools/d173_e096_source_guard.py","tools/d173_e096_agent158_release_gate.py",
    "tools/d167_release_gate.py",
    ".github/workflows/d173-e060-vps-usage.yml",
    ".github/workflows/verify-relay-agent.yml",".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
}
REQUIRED = {
    "relay-agent/VERSION","relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj","relay-agent/D173VpsUsage.cs",
    "relay-agent/D173E089UsageCards.cs","relay-agent/D173DesktopResources.cs",
    "relay-agent/Program.cs","service/src/index.ts","tools/d173_e096_source_guard.py",
}
def git(*args):
    return subprocess.run(["git",*args],cwd=R,encoding="utf-8",text=True,capture_output=True,check=False)
def deny(reason):
    raise SystemExit("D173_E096_AGENT158_RELEASE_DENIED:"+reason)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--component",required=True,choices=["worker","agent"])
    p.add_argument("--preflight",action="store_true")
    args=p.parse_args()
    try: auth=json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError,ValueError): deny("RECEIPT_MISSING")
    expected={
       "change_id":"D173","checkpoint":"D173-E096",
       "owner_approval_reference":"OWNER_20261028_D173_E096_AGENT158_WORKER_USAGE_RBAC",
       "approved_components":["worker","agent"],"agent_target_version":158,
       "base_main_sha":BASE,"production_host":"inventory.supra.cc.cd",
       "worker_resource_key":"worker-beta","d172_lifecycle":"PENDING_HOLD",
       "release_marker":MARKER,"source_pr":788,
    }
    for key,value in expected.items():
        if auth.get(key)!=value:deny("OWNER_SCOPE_"+key)
    for key in ("stable_deploy_permission","d172_business_mutation","android_mutation",
      "web_mutation","functions_mutation","firebase_rules_mutation",
      "business_schema_mutation","new_provider_resource","field_pass","owner_pass"):
        if auth.get(key) is not False:deny("FORBIDDEN_"+key)
    if ((R/"relay-agent/VERSION").read_text(encoding="utf-8").strip()!="158"
        or "AgentBuild = 158;" not in (R/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
        or "0.158.0.0" not in (R/"relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")):
        deny("VERSION_MISMATCH")
    if git("merge-base","--is-ancestor",BASE,"HEAD").returncode: deny("BASE_NOT_ANCESTOR")
    if git("diff","--name-only",BASE,"HEAD","--",*IMMUTABLE).stdout.strip():
        deny("FOREIGN_BUSINESS_OR_D172_CHANGED")
    changed=set(git("diff","--name-only",BASE,"HEAD","--",*PROTECTED).stdout.splitlines())
    if changed-ALLOWED:deny("UNAPPROVED_SOURCE:"+",".join(sorted(changed-ALLOWED)))
    if not REQUIRED.issubset(changed):
        deny("REQUIRED_SOURCE_MISSING:"+",".join(sorted(REQUIRED-changed)))
    # Real base-role auth stays server-side; only exact named operators granted
    worker=(R/"service/src/index.ts").read_text(encoding="utf-8")
    agent=(R/"relay-agent/D173VpsUsage.cs").read_text(encoding="utf-8")
    if ('await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"])' not in worker
        or '!["vps", "admin", "tamnv2"].includes' not in worker
        or 'operator.base_role !== operator.role' not in worker
        or not all(name in agent for name in ('"vps"','"admin"','"tamnv2"'))):
        deny("RBAC_SCOPE")
    pin=auth.get("approved_source_sha")
    valid=(auth.get("source_ci_verified") is True
      and isinstance(pin,str) and re.fullmatch(r"[a-f0-9]{40}",pin)
      and pin==auth.get("source_ci_sha")
      and auth.get("required_ci_success",0)>=1
      and auth.get("required_ci_failed")==0
      and all(auth.get(k) is True for k in ("d172_cross_regression_pass",
        "windows_build_test_pass","windows_startup_smoke_pass",
        "service_typecheck_pass","email_preservation_pass")))
    if not valid:
        if args.preflight:
            print("D173_E096_AGENT158_SCOPE_PASS_CI_PIN_PENDING")
            return
        deny("EXACT_SOURCE_CI_NOT_PINNED")
    if (git("cat-file","-e",pin+"^{commit}").returncode or
        git("merge-base","--is-ancestor",pin,"HEAD").returncode):
        deny("SOURCE_CI_PIN_NOT_ANCESTOR")
    if git("diff","--name-only",pin,"HEAD","--",*PROTECTED).stdout.strip():
        deny("SOURCE_CHANGED_AFTER_CI")
    if args.preflight:
        print("D173_E096_AGENT158_SOURCE_CI_PREFLIGHT_PASS "+pin[:12])
        return
    if (os.getenv("GITHUB_EVENT_NAME")!="push" or
        os.getenv("GITHUB_REF")!="refs/heads/main" or
        not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
        deny("OWNER_MERGE_RELEASE_MARKER_MISSING")
    print("D173_E096_AGENT158_RELEASE_AUTHORIZED_"+args.component.upper()+" "+pin[:12])

if __name__=="__main__":
    main()
