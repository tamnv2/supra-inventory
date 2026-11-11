#!/usr/bin/env python3
"""D173-E187 Agent185: owner-pinned Host14 Agent-only signed release gate."""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "a00ba55b15748edd4393a15092c0c786b30b294e"
MARKER = "D173-E187_AGENT185_ONLY_RELEASE:"
AUTH = ROOT / "ops/d173-e187-agent185-release-authorization.json"
ALLOW = {
  "relay-agent-webview2-host/Program.cs",
  "relay-agent-webview2-host/SupraInventoryWebView2Host.csproj",
  "relay-agent/SupraConfirmBrowser.cs", "relay-agent/AgentBrowserBundle.cs",
  "relay-agent/AgentConfig.cs", "relay-agent/SupraInventoryRelayAgent.csproj",
  "relay-agent/VERSION", ".github/workflows/verify-relay-agent.yml",
  ".github/workflows/verify-d173-e149-agent170.yml",
  "tests/d173-e187-agent185-webview2-paint.test.mjs",
  "tools/d173_e187_agent185_release_gate.py",
  "tools/d173_e052_instrumentation_guard.py",
  "tools/d173_e060_vps_usage_guard.py",
  "tools/d173_e064_agent_history_usage_guard.py",
  "tools/ui_design_guard.py",
  "tests/d173-e175-unified-network.test.mjs",
  "tests/d173-e149-agent170-activity-webtab.test.mjs",
  "tests/d173-e159-agent172-remediation.test.mjs",
  "tests/d173-e161-agent173-webview-recovery.test.mjs",
  "tests/d173-e141-agent-ha-web-shield.test.mjs",
  "tools/android_operational_regression.py",
  ".github/workflows/d173-e175-source.yml",
  "docs/D173_E187_AGENT185_WEBVIEW2_PAINT_REPAIR_2026-11-11.md",
  "docs/OWNER_DECISIONS.md", "ops/project-state.json",
  "ops/change-continuity/D173.json", "ops/d173-e187-agent185-release-authorization.json"
}
CODE = {"relay-agent-webview2-host/Program.cs","relay-agent/SupraConfirmBrowser.cs",
"relay-agent/AgentBrowserBundle.cs","relay-agent/AgentConfig.cs",
"relay-agent/SupraInventoryRelayAgent.csproj","relay-agent/VERSION",
"relay-agent-webview2-host/SupraInventoryWebView2Host.csproj"}

def deny(msg):
    raise SystemExit("D173_E187_AGENT185_DENIED:" + msg)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, text=True,
                       encoding="utf-8", errors="replace", capture_output=True)
    if p.returncode: deny("GIT_" + args[0])
    return p.stdout.strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", choices=["agent"], required=True)
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    a = json.loads(AUTH.read_text(encoding="utf-8"))
    checks = {
      "change_id":"D173-E187",
      "owner_approval_reference":"OWNER_20261111_AGENT184_FIELD_FAIL_ADMIN_PC_WEBVIEW2_WHITE_RELEASE_AGENT185",
      "base_main_sha":BASE,"owner_code_approved":True,
      "owner_protected_release_approved":True,
      "approved_components":["agent","agent-webview2-host"],
      "agent_target_version":185, "host_target_build":14,
      "worker_mutation":False,"web_mutation":False,"android_mutation":False,
      "obpp_mutation":False,"stable_mutation":False,"firestore_rules_mutation":False,
      "new_provider_resources":False,"wms_business_mutation":False,
      "no_new_provider_requests":True,"field_pass":False,"owner_pass":False,
      "release_marker":MARKER
    }
    for k,v in checks.items():
        if a.get(k) != v: deny("OWNER_SCOPE_" + k)
    if (ROOT/"relay-agent/VERSION").read_text(encoding="utf-8").strip()!="185": deny("AGENT_VERSION")
    if "AgentBuild = 185;" not in (ROOT/"relay-agent/AgentConfig.cs").read_text(encoding="utf-8"): deny("AGENT_BUILD")
    if (ROOT/"relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8").count("0.185.0.0")!=2: deny("AGENT_ASSEMBLY")
    if "RequiredHostBuild = 14;" not in (ROOT/"relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"): deny("HOST_VERSION")
    if args.preflight:
        baseline=git("merge-base","origin/main","HEAD")
    else:
        parents=git("rev-list","--parents","-n","1","HEAD").split()
        if len(parents)!=3 or not git("log","-1","--format=%s").startswith(MARKER):
            deny("PROTECTED_TWO_PARENT_MERGE_AND_MARKER_REQUIRED")
        baseline=parents[1]
        if git("rev-parse","--abbrev-ref","HEAD")!="HEAD" and git("rev-parse","--abbrev-ref","HEAD")!="main":
            deny("NOT_MAIN")
    if baseline!=BASE: deny("BASE_CHANGED_REVIEW_REQUIRED")
    changed=set(git("diff","--name-only",baseline,"HEAD").splitlines())
    if not CODE.issubset(changed): deny("INCOMPLETE_HOST14_AGENT185_IMPLEMENTATION")
    extra=changed-ALLOW
    if extra: deny("OUT_OF_SCOPE:" + ",".join(sorted(extra))[:300])
    if args.preflight:
        print("D173_E187_AGENT185_SOURCE_SCOPE_PASS__CI_RELEASE_PENDING")
        return
    if not (a.get("source_ci_verified") is True and a.get("native_agent_pass") is True and
            a.get("native_host_pass") is True and a.get("d172_regression_pass") is True and
            a.get("required_ci_failed")==0):
        deny("CI_FIELD_UNVERIFIED_OR_MISSING")
    pin=a.get("source_ci_sha")
    if not isinstance(pin,str) or not re.fullmatch(r"[a-f0-9]{40}",pin):
        deny("SOURCE_CI_PIN")
    git("merge-base","--is-ancestor",pin,"HEAD")
    if git("diff","--name-only",pin,"HEAD","--","relay-agent/","relay-agent-webview2-host/"):
        deny("SOURCE_CHANGED_AFTER_CI")
    if git("diff","--name-only",pin,"HEAD","--",".github/workflows/verify-relay-agent.yml"):
        deny("RELEASE_WORKFLOW_CHANGED_AFTER_CI")
    print("D173_E187_AGENT185_EXACT_SIGNED_RELEASE_AUTHORIZED")

if __name__=="__main__": main()
