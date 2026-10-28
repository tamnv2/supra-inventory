#!/usr/bin/env python3
"""D173-E093: Owner-scoped Worker-first/Agent156 signed release; APK forbidden."""
import argparse,json,os,re,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[1]
BASE="a015c84ea37d581a782076da819c7dc74d911415"
MARKER="D173-E093_AGENT156_WORKER_RELEASE:"
FILE=R/"ops/d173-e093-release-authorization.json"
ALLOWED={
"relay-agent/VERSION","relay-agent/AgentConfig.cs",
"relay-agent/SupraInventoryRelayAgent.csproj",
"relay-agent/SupraConfirmBrowserD160.cs",
"relay-agent/D160ConfirmPipeline.cs","relay-agent/D173VpsUsage.cs",
"relay-agent/D173E089UsageCards.cs",
"service/src/d173-vps-usage.ts","service/src/index.ts",
".github/workflows/verify-relay-agent.yml",
".github/workflows/deploy-beta.yml",
".github/workflows/deploy-beta-firestore.yml",
"tools/d167_release_gate.py","tools/d173_e093_source_test.py",
"tools/d173_e093_release_gate.py",
"tools/d173_email_release_gate.py",".github/workflows/verify-d171-agent-code-only.yml",
"tools/d173_e060_vps_usage_guard.py",
"tools/d173_e064_agent_history_usage_guard.py",
".github/workflows/verify-d171-agent-code-only.yml"
}
PROTECTED=("relay-agent/","service/","web/","android/","functions/",
"firebase/","firebase.json","obpp1291/","ops/apps-script/",
"relay-agent-webview2-host/","pda-management/",".github/workflows/","tools/")
IMMUTABLE=("android/","web/","functions/","firebase/","firebase.json",
"obpp1291/","ops/apps-script/","relay-agent-webview2-host/",
"pda-management/")
def git(*args):
 return subprocess.run(["git",*args],cwd=R,capture_output=True,
                       text=True,encoding="utf-8",check=False)
def deny(why):raise SystemExit("D173_E093_RELEASE_DENIED:"+why)
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--component",choices=["worker","agent"],required=True)
 p.add_argument("--preflight",action="store_true")
 a=p.parse_args()
 try:d=json.loads(FILE.read_text(encoding="utf-8"))
 except (OSError,ValueError):deny("RECEIPT_NOT_READABLE")
 if (d.get("checkpoint")!="D173-E093" or
     d.get("owner_approval_reference")!="OWNER_20261028_P1_CONFIRM_USAGE_AGENT_WORKER_NO_APK" or
     d.get("approved_components")!=["worker","agent"] or
     d.get("agent_target_version")!=156 or
     d.get("base_main_sha")!=BASE or
     d.get("d172_lifecycle")!="PENDING_HOLD"):
  deny("OWNER_SCOPE_OR_VERSION")
 for k in ("stable_deploy_permission","d172_business_mutation","android_mutation",
   "web_mutation","functions_mutation","firebase_rules_mutation",
   "business_schema_mutation","new_provider_resource","field_pass","owner_pass"):
  if d.get(k) is not False:deny("PROHIBITED_"+k)
 if ((R/"relay-agent/VERSION").read_text(encoding="utf-8").strip()!="156"
     or "AgentBuild = 156;" not in (R/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
     or "0.156.0.0" not in (R/"relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")):
  deny("VERSION_LOCK")
 if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:deny("BASE_NOT_ANCESTOR")
 if git("diff","--name-only",BASE,"HEAD","--",*IMMUTABLE).stdout.strip():deny("FOREIGN_BUSINESS_CHANGE")
 changed=set(git("diff","--name-only",BASE,"HEAD","--",*PROTECTED).stdout.splitlines())
 if changed-ALLOWED:deny("SOURCE_OUTSIDE_SCOPE:"+",".join(sorted(changed-ALLOWED)))
 expected={"service/src/index.ts","service/src/d173-vps-usage.ts",
   "relay-agent/D160ConfirmPipeline.cs","relay-agent/SupraConfirmBrowserD160.cs",
   "relay-agent/D173E089UsageCards.cs","relay-agent/VERSION"}
 if not expected.issubset(changed):deny("MISSING_REQUIRED_SOURCE")
 pin=d.get("approved_source_sha")
 ready=(d.get("source_ci_verified") is True and
   pin==d.get("source_ci_sha") and isinstance(pin,str) and
   re.fullmatch("[0-9a-f]{40}",pin) and d.get("required_ci_success",0)>=1 and
   d.get("required_ci_failed")==0 and
   d.get("d172_cross_regression_pass") is True and
   d.get("windows_build_test_pass") is True and
   d.get("windows_startup_smoke_pass") is True and
   d.get("service_typecheck_pass") is True)
 if not ready:
  if a.preflight:
   print("D173_E093_SOURCE_SCOPE_PREFLIGHT_PASS_PIN_PENDING")
   return
  deny("EXACT_SOURCE_CI_PIN_MISSING")
 if (git("cat-file","-e",pin+"^{commit}").returncode or
     git("merge-base","--is-ancestor",pin,"HEAD").returncode):
  deny("SOURCE_PIN_INVALID")
 if git("diff","--name-only",pin,"HEAD","--",*PROTECTED).stdout.strip():
  deny("SOURCE_CHANGED_AFTER_CI")
 if a.preflight:
  print("D173_E093_PINNED_CI_PREFLIGHT_PASS "+pin[:12]);return
 if (os.getenv("GITHUB_EVENT_NAME")!="push" or
    os.getenv("GITHUB_REF")!="refs/heads/main" or
    not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
  deny("PROTECTED_MAIN_MARKER_MISSING")
 print("D173_E093_SIGNED_RELEASE_AUTHORIZED "+a.component+" "+pin[:12])
if __name__=="__main__":main()
