#!/usr/bin/env python3
"""D173-E089 Owner-command Agent154 + bounded VPS Usage Worker source/CI/release gate."""
import argparse,json,os,re,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[1]
FILE=R/"ops/d173-e089-release-authorization.json"
MARKER="D173-E089_AGENT154_RELEASE:"
BASE="769d7a3229ddc242009caa49f381465744a836cf"
SOURCE=("relay-agent/","service/",".github/workflows/","tools/","ops/project-scope.json","ops/resource-registry.json")
UNCHANGED=("web/","android/","functions/","firebase/","firebase.json","obpp1291/",
 "pda-management/","ops/apps-script/","relay-agent-webview2-host/",
 "service/src/index.ts","service/src/core.ts","service/src/operational-v2-core.ts",
 "service/src/obpp1291-sheets.ts")
ALLOWED={
 "relay-agent/VERSION","relay-agent/AgentConfig.cs","relay-agent/SupraInventoryRelayAgent.csproj",
 "relay-agent/D173VpsUsage.cs","relay-agent/D173E089UsageCards.cs",
 "relay-agent/D173E036Theme.cs","relay-agent/D160UiHistory.cs",
 "relay-agent/D173E069ApprovedUsageUi.cs",
 "service/src/d173-vps-usage.ts","tools/d173_e064_agent_history_usage_guard.py",
 "tools/d173_e084_agent153_source_test.py","tools/d173_e071_utf8_release_guard_test.py",
 "tools/d173_e089_agent154_source_test.py","tools/d173_e089_release_gate.py",
 "tools/d167_release_gate.py","tools/d173_e060_vps_usage_guard.py",
 ".github/workflows/d173-e086-worker.yml",".github/workflows/verify-relay-agent.yml",
 ".github/workflows/deploy-beta.yml"
}
def fail(why):raise SystemExit("D173_E089_RELEASE_DENIED:"+why)
def git(*args):
 return subprocess.run(["git",*args],cwd=R,text=True,encoding="utf-8",capture_output=True,check=False)
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--component",choices=("worker","agent"),required=True)
 ap.add_argument("--preflight",action="store_true")
 args=ap.parse_args()
 try:r=json.loads(FILE.read_text(encoding="utf-8"))
 except (OSError,ValueError):fail("RECEIPT_MISSING")
 if r.get("change_id")!="D173" or r.get("checkpoint")!="D173-E089" or (
  r.get("owner_approval_reference")!="OWNER_20261028_AGENT154_USAGE_CARDS_GLOBAL_LOG_HISTORY_RELEASE"
 ) or r.get("approved_components")!=["worker","agent"] or (
  r.get("production_host")!="inventory.supra.cc.cd" or
  r.get("existing_worker_name")!="supra-inventory-beta" or
  r.get("agent_target_version")!=154 or
  r.get("d172_lifecycle")!="PENDING_HOLD"):fail("OWNER_OR_RESOURCE_SCOPE")
 for key in ("stable_deploy_permission","d172_business_mutation","android_mutation",
             "web_mutation","functions_mutation","firebase_rules_mutation",
             "business_schema_mutation","new_provider_resource","field_pass","owner_pass"):
  if r.get(key) is not False:fail("PROHIBITED_"+key)
 if (R/"relay-agent/VERSION").read_text(encoding="utf-8").strip()!="154" or (
   "AgentBuild = 154;" not in (R/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
 ) or "0.154.0.0" not in (R/"relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8"):
  fail("AGENT_VERSION")
 pin=str(r.get("approved_source_sha") or "")
 verified=(r.get("source_ci_verified") is True and pin==r.get("source_ci_sha") and
   re.fullmatch("[0-9a-f]{40}",pin) and
   r.get("required_ci_success",0)>=20 and r.get("required_ci_failed")==0 and
   r.get("windows_build_test_pass") is True and
   r.get("windows_startup_smoke_pass") is True and
   r.get("service_typecheck_pass") is True and
   r.get("d172_cross_regression_pass") is True)
 if not verified:
  if args.preflight:
   print("D173_E089_CI_SOURCE_PIN_PENDING__NO_RELEASE")
   return
  fail("SOURCE_CI_PIN_REQUIRED")
 if git("cat-file","-e",pin+"^{commit}").returncode or git("merge-base","--is-ancestor",pin,"HEAD").returncode:
  fail("SOURCE_PIN_NOT_ANCESTOR")
 if git("diff","--quiet",pin,"HEAD","--",*SOURCE).returncode:
  fail("PROTECTED_SOURCE_CHANGED_AFTER_PIN")
 if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:fail("BASELINE_MISSING")
 if git("diff","--quiet",BASE,"HEAD","--",*UNCHANGED).returncode:
  fail("D172_OR_BUSINESS_DRIFT")
 changed=set(git("diff","--name-only",BASE,"HEAD","--",*SOURCE).stdout.splitlines())
 if changed-ALLOWED:fail("UNAUTHORIZED_SOURCE:"+",".join(sorted(changed-ALLOWED)))
 expected={"relay-agent/VERSION","relay-agent/AgentConfig.cs",
   "relay-agent/SupraInventoryRelayAgent.csproj","relay-agent/D173E089UsageCards.cs",
   "relay-agent/D160UiHistory.cs","relay-agent/D173E036Theme.cs",
   "service/src/d173-vps-usage.ts","tools/d173_e089_agent154_source_test.py"}
 if not expected.issubset(changed):fail("MISSING_IMPLEMENTATION")
 if args.preflight:
  print("D173_E089_AGENT154_SOURCE_CI_PREFLIGHT_PASS "+args.component+" "+pin[:12])
  return
 if os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main" or (
   not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
  fail("EXACT_OWNER_PROTECTED_RELEASE_MARKER_REQUIRED")
 print("D173_E089_AGENT154_"+args.component.upper()+"_RELEASE_GATE_PASS "+pin[:12])
if __name__=="__main__":main()
