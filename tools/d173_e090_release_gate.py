#!/usr/bin/env python3
"""D173-E090: exact Owner-approved Agent155, CI and immutable release gate."""
import argparse,json,os,re,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[1]
FILE=R/"ops/d173-e090-release-authorization.json"
BASE="4e2b128a2db84db824daef7ad46581b638e87abf"
MARKER="D173-E090_AGENT155_RELEASE:"
SOURCE=("relay-agent/",".github/workflows/","tools/","tests/","service/",
        "web/","android/","functions/","firebase/","obpp1291/",
        "ops/project-scope.json","ops/resource-registry.json")
UNCHANGED=("service/","web/","android/","functions/","firebase/","firebase.json",
           "obpp1291/","pda-management/","relay-agent-webview2-host/",
           "ops/apps-script/")
ALLOWED={
 "relay-agent/VERSION","relay-agent/AgentConfig.cs","relay-agent/SupraInventoryRelayAgent.csproj",
 "relay-agent/Program.cs","relay-agent/D119AgentFeatures.cs",
 "relay-agent/D173DesktopResources.cs","relay-agent/D173E038Sidebar.cs",
 "relay-agent/D173E036Theme.cs","relay-agent/D161SupportLogControl.cs",
 "relay-agent/D173E089UsageCards.cs","relay-agent/D173VpsUsage.cs",
 "relay-agent/D160UiHistory.cs","tools/d173_e090_agent155_source_test.py",
 "tools/d173_e060_vps_usage_guard.py",
 "tools/d173_e064_agent_history_usage_guard.py",
 "tests/d173-e036-unified-presentation.test.mjs",
 "tools/d173_email_release_gate.py",
 ".github/workflows/d173-email-sender-guard.yml",
 "tools/d173_e090_release_gate.py","tools/d167_release_gate.py",
 ".github/workflows/verify-relay-agent.yml"
}
def git(*args):
 return subprocess.run(["git",*args],cwd=R,capture_output=True,
                       text=True,encoding="utf-8",check=False)
def fail(why):raise SystemExit("D173_E090_AGENT155_DENIED:"+why)
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--component",choices=["agent"],required=True)
 ap.add_argument("--preflight",action="store_true")
 a=ap.parse_args()
 try:receipt=json.loads(FILE.read_text(encoding="utf-8"))
 except (OSError,ValueError):fail("OWNER_RECEIPT_MISSING")
 if (receipt.get("change_id")!="D173" or receipt.get("checkpoint")!="D173-E090"
  or receipt.get("owner_approval_reference")!="OWNER_20261028_AGENT155_ALL_EIGHT_ITEMS_RELEASE"
  or receipt.get("approved_components")!=["agent"]
  or receipt.get("agent_target_version")!=155
  or receipt.get("d172_lifecycle")!="PENDING_HOLD"):
  fail("OWNER_SCOPE_OR_VERSION")
 for key in ("stable_deploy_permission","d172_business_mutation","worker_mutation",
             "android_mutation","web_mutation","firebase_rules_mutation",
             "business_schema_mutation","new_provider_resource","field_pass","owner_pass"):
  if receipt.get(key) is not False:fail("PROHIBITED_"+key)
 if ((R/"relay-agent/VERSION").read_text(encoding="utf-8").strip()!="155"
   or "AgentBuild = 155;" not in (R/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
   or "0.155.0.0" not in (R/"relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")):
  fail("VERSION_MISMATCH")
 if git("merge-base","--is-ancestor",BASE,"HEAD").returncode:fail("BASE_NOT_ANCESTOR")
 if git("diff","--quiet",BASE,"HEAD","--",*UNCHANGED).returncode:
  fail("SHARED_D172_OR_BUSINESS_CHANGED")
 changed=set(git("diff","--name-only",BASE,"HEAD","--",*SOURCE).stdout.splitlines())
 if changed-ALLOWED:fail("UNAUTHORIZED:"+",".join(sorted(changed-ALLOWED)))
 expected={"relay-agent/VERSION","relay-agent/Program.cs",
           "relay-agent/D119AgentFeatures.cs","relay-agent/D173DesktopResources.cs",
           "relay-agent/D173E089UsageCards.cs",
           "relay-agent/D161SupportLogControl.cs","tools/d173_e090_agent155_source_test.py"}
 if not expected.issubset(changed):fail("MISSING_SOURCE_CHANGE")
 pin=str(receipt.get("approved_source_sha") or "")
 ready=(receipt.get("source_ci_verified") is True and
        pin==receipt.get("source_ci_sha") and
        re.fullmatch("[0-9a-f]{40}",pin) and
        receipt.get("required_ci_success",0)>=1 and
        receipt.get("required_ci_failed")==0 and
        receipt.get("windows_build_test_pass") is True and
        receipt.get("windows_startup_smoke_pass") is True)
 if not ready:
  if a.preflight:
   print("D173_E090_AGENT155_SOURCE_PRECHECK_PASS_CI_PIN_PENDING")
   return
  fail("EXACT_SOURCE_CI_REQUIRED")
 if git("cat-file","-e",pin+"^{commit}").returncode or (
   git("merge-base","--is-ancestor",pin,"HEAD").returncode):
  fail("PIN_NOT_ANCESTOR")
 if git("diff","--quiet",pin,"HEAD","--",*SOURCE).returncode:
  fail("SOURCE_CHANGED_SINCE_CI_PIN")
 if a.preflight:
  print("D173_E090_AGENT155_SOURCE_PIN_PREFLIGHT_PASS "+pin[:12])
  return
 if (os.getenv("GITHUB_EVENT_NAME")!="push" or
     os.getenv("GITHUB_REF")!="refs/heads/main" or
     not git("log","-1","--format=%s").stdout.strip().startswith(MARKER)):
  fail("NO_PROTECTED_OWNER_RELEASE_MARKER")
 print("D173_E090_AGENT155_SIGNED_RELEASE_GATE_PASS "+pin[:12])
if __name__=="__main__":main()
