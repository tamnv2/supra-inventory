#!/usr/bin/env python3
"""D173 E130 Owner-approved Worker-only fix: standard SKU schedule vs manual jobs."""
import argparse,json,os,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE="f64386bc37659a69cc26c646a2e1da03456f2d3f"
MARKER="D173-E130_SKU_SCHEDULE_RELEASE:"
ALLOWED={
"service/src/d167-sku-sync-core.ts","tests/d173-e130-sku-schedule.test.mjs",
"tools/d173_e130_release_gate.py","tools/d167_release_gate.py",
"tools/d173_e097_startup_regression.mjs",
".github/workflows/deploy-beta.yml",".github/workflows/d173-e130-sku-schedule.yml",
"ops/d173-e130-release-authorization.json","ops/project-state.json",
"ops/change-continuity/D173.json","docs/OWNER_DECISIONS.md",
"docs/D173_E130_SKU_SCHEDULE_MANUAL_SEPARATION_2026-11-03.md",
}
IMMUTABLE=("web/","android/","relay-agent/","firebase/","firebase.json","obpp1291/","functions/","ops/apps-script/","service/src/obpp1291-","service/wrangler.beta.toml","service/wrangler.stable.toml","ops/project-scope.json","ops/resource-registry.json")
def deny(why): raise SystemExit("D173_E130_RELEASE_DENIED:"+why)
def git(*args):
    p=subprocess.run(["git",*args],cwd=ROOT,text=True,capture_output=True)
    if p.returncode: deny("GIT_"+args[0])
    return p.stdout.strip()
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--component",required=True)
    parser.add_argument("--preflight",action="store_true")
    a=parser.parse_args()
    if a.component!="worker": deny("WORKER_ONLY")
    try: r=json.loads((ROOT/"ops/d173-e130-release-authorization.json").read_text(encoding="utf8"))
    except (OSError,ValueError): deny("RECEIPT_MISSING")
    for k,v in {
      "schema_version":1,"change_id":"D173","checkpoint_id":"D173-E130",
      "origin_main_sha":BASE,"release_marker":MARKER,
      "owner_approved":True,"worker_only":True,"d172_unchanged":True,
      "no_schema_migration":True,"stable_release":False,
      "field_pass":False,"owner_pass":False,
    }.items():
        if r.get(k)!=v:deny("RECEIPT_"+k)
    if subprocess.run(["git","merge-base","--is-ancestor",BASE,"HEAD"],cwd=ROOT).returncode:deny("BASE_NOT_ANCESTOR")
    changed=set(git("diff","--name-only",BASE,"HEAD").splitlines())
    if not changed or changed-ALLOWED:deny("SCOPE:"+",".join(sorted(changed-ALLOWED)))
    if any(p.startswith(t) for p in changed for t in IMMUTABLE):deny("IMMUTABLE")
    source=(ROOT/"service/src/d167-sku-sync-core.ts").read_text(encoding="utf8")
    if "AND slot IN ('INITIAL_05','DELTA_12','DELTA_19') ORDER BY scheduled_at_ms" not in source:deny("THREE_SLOT_FILTER")
    for p,h in (r.get("source_blobs") or {}).items():
        if p not in {"service/src/d167-sku-sync-core.ts","tests/d173-e130-sku-schedule.test.mjs"} or not re.fullmatch("[0-9a-f]{40}",str(h)):deny("BAD_SOURCE_PIN")
        if git("rev-parse","HEAD:"+p)!=h:deny("SOURCE_DRIFT_"+p)
    if set(r.get("source_blobs") or {})!={"service/src/d167-sku-sync-core.ts","tests/d173-e130-sku-schedule.test.mjs"}:deny("SOURCE_PINS_INCOMPLETE")
    if not r.get("source_ci_verified"):
        if a.preflight:
            print("D173_E130_SCOPE_PASS_CI_PENDING_NO_RELEASE")
            return
        deny("CI_NOT_VERIFIED")
    ci=str(r.get("source_ci_sha") or "")
    if not re.fullmatch("[0-9a-f]{40}",ci):deny("CI_SHA")
    if r.get("required_ci_failed")!=0 or int(r.get("required_ci_success") or 0)<20:deny("CI_STATUS")
    if subprocess.run(["git","merge-base","--is-ancestor",ci,"HEAD"],cwd=ROOT).returncode:deny("CI_NOT_ANCESTOR")
    if subprocess.run(["git","diff","--quiet",ci,"HEAD","--","service/","web/","android/","relay-agent/","firebase/","functions/","ops/apps-script/","obpp1291/","tools/","tests/",".github/workflows/"],cwd=ROOT).returncode:deny("SOURCE_CHANGED_AFTER_CI")
    if a.preflight:
        print("D173_E130_PINNED_SOURCE_CI_PASS")
        return
    if os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main":deny("MAIN_PUSH_ONLY")
    if not git("log","-1","--format=%s").startswith(MARKER):deny("RELEASE_MARKER")
    print("D173_E130_WORKER_RELEASE_AUTHORIZED")
if __name__=="__main__": main()
