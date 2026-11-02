#!/usr/bin/env python3
"""E122 owner-scoped exact tree gate: one read-only SQL diagnostic on existing Worker."""
import argparse, json, os, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE="0456901ae599c7d3405e9094c15f5876cbc74024"
ALLOWED={
 "service/src/index.ts","service/src/d173-sql-audit-auth.ts",
 "tests/d173-sql-audit.test.mjs","tools/d173_e122_preservation_guard.py",
 "tools/d173_e122_sql_audit_release_gate.py","tools/d167_release_gate.py",
 ".github/workflows/deploy-beta.yml",".github/workflows/d173-usage-readonly-collect.yml",
 ".github/workflows/d173-e060-vps-usage.yml","ops/project-state.json",
 "ops/change-continuity/D173.json","ops/d173-e122-sql-audit-release-authorization.json",
 "docs/D173_USAGE_AUDIT_READONLY_2026-11-02.md",
}
def fail(x):raise SystemExit("D173_E122_OWNER_RELEASE_DENIED:"+x)
def git(*args):
 p=subprocess.run(["git",*args],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:fail("git operation failed")
 return p.stdout.strip()
def main():
 a=argparse.ArgumentParser();a.add_argument("--component",required=True);opts=a.parse_args()
 if opts.component!="worker":fail("worker only")
 if os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main":fail("main push only")
 if not git("log","-1","--format=%s").startswith("D173-E122_SQL_AUDIT_RELEASE:"):fail("merge title missing")
 receipt=json.loads((ROOT/"ops/d173-e122-sql-audit-release-authorization.json").read_text())
 if receipt.get("owner_instruction")!="2026-11-02_SQL_QUERY_ID_COLLECT_UNTIL_DONE":fail("owner scope")
 if receipt.get("worker_release_permission") is not True or receipt.get("allowed_component")!="worker":fail("owner approval")
 if receipt.get("stable_permission") is not False or receipt.get("d172_business_permission") is not False or receipt.get("new_provider_resources_permission") is not False:fail("unexpected component authorization")
 if receipt.get("origin_main_sha")!=BASE or receipt.get("pr_number")!=826:fail("base/PR not pinned")
 blobs=receipt.get("source_blobs",{})
 if set(blobs)!={"service/src/index.ts","service/src/d173-sql-audit-auth.ts",
                   "tests/d173-sql-audit.test.mjs","tools/d173_e122_preservation_guard.py",
                   ".github/workflows/d173-usage-readonly-collect.yml"}:fail("missing source pin")
 for path,expected in blobs.items():
  if len(expected)!=40 or git("rev-parse","HEAD:"+path)!=expected:fail("source changed:"+path)
 changed=set(git("diff","--name-only",BASE,"HEAD").splitlines())
 if not changed or not changed.issubset(ALLOWED):fail("unapproved files:"+",".join(sorted(changed-ALLOWED)))
 if not {"service/src/index.ts","service/src/d173-sql-audit-auth.ts"}.issubset(changed):fail("source absent")
 # All historical protected components are unchanged from accepted E114 main.
 for folder in ("obpp1291/","firebase/","ops/apps-script/","android/","relay-agent/","web/","functions/","service/src/obpp1291-","service/wrangler.stable.toml"):
  if any(path.startswith(folder) for path in changed):fail("protected business boundary:"+folder)
 print("D173_E122_OWNER_SOURCE_TREE_RELEASE_GATE_PASS__WORKER_ONLY__D172_HOLD")
if __name__=="__main__":main()
