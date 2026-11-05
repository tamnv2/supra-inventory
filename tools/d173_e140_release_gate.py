#!/usr/bin/env python3
"""D173-E140 explicit Owner-scoped PRODUCTION gate; never implies FIELD/OWNER PASS."""
import argparse, json, os, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MARKER="D173-E140_OWNER_PRODUCTION_RELEASE:"
BASE="be2902ea9238f41213050978c90593ba67a5f37a"
def git(*args):
    return subprocess.run(["git",*args],cwd=ROOT,text=True,capture_output=True)
def deny(message):
    raise SystemExit("D173_E140_PRODUCTION_DENIED:"+message)
def must(expr,message):
    if not expr: deny(message)
def check(component,preflight):
    receipt=json.loads((ROOT/"ops/d173-e140-release-authorization.json").read_text(encoding="utf-8"))
    main=git("rev-parse","HEAD").stdout.strip()
    must(receipt.get("change_id")=="D173" and receipt.get("checkpoint_id")=="D173-E140", "RECEIPT")
    must(receipt.get("owner_approval_reference")==
      "OWNER_20261106_D173_E140_AGENT166_ANDROID_WORKER_FIRESTORE_SCOPED_PRODUCTION_TRIAL","OWNER_REFERENCE")
    must(receipt.get("owner_source_approval") is True and receipt.get("owner_production_deploy_permission") is True,
      "PRODUCTION_NOT_AUTHORIZED")
    must(receipt.get("release_marker")==MARKER,"MARKER_RECEIPT")
    must(receipt.get("d172_status")=="PENDING_HOLD" and receipt.get("d172_business_mutation") is False,
      "D172_HOLD")
    must(receipt.get("stable_deployment_permission") is False and receipt.get("owner_gated_release") is True,
      "STABLE_GATED")
    must(receipt.get("production_release_verified") is False and receipt.get("field_pass") is False and
         receipt.get("owner_pass") is False,"FALSE_PASS_RECEIPT")
    must(receipt.get("source_ci_verified") is True and receipt.get("source_ci_failed")==0 and
         receipt.get("source_ci_success",0)>=44,"SOURCE_CI_NOT_VERIFIED")
    pin=str(receipt.get("source_ci_sha") or "")
    must(re.fullmatch("[0-9a-f]{40}",pin) is not None,"SOURCE_PIN")
    must(git("merge-base","--is-ancestor",pin,"HEAD").returncode==0,"CI_SOURCE_NOT_ANCESTOR")
    for path in ("relay-agent/","service/","firebase/","web/"):
        must(git("diff","--quiet",pin,"HEAD","--",path).returncode==0,
             "EXECUTABLE_SOURCE_DRIFT:"+path)
    android=git("diff","--name-only",pin,"HEAD","--","android/")
    must(android.returncode==0 and all(p=="android/release-notes.json"
         for p in android.stdout.splitlines()),"ANDROID_EXECUTABLE_DRIFT")
    must((ROOT/"relay-agent/VERSION").read_text().strip()=="166","AGENT_TARGET")
    notes=json.loads((ROOT/"android/release-notes.json").read_text(encoding="utf-8"))
    must(len(notes.get("release_notes",[]))==3 and all(
         str(n).startswith("vc126:") for n in notes["release_notes"]),"ANDROID_VC126_NOTES")
    must(git("merge-base","--is-ancestor",BASE,"HEAD").returncode==0,"ACCEPTED_MAIN_BASE")
    # Existing authenticated Worker/Rules providers are shared with D172; no
    # D172 app, Stable, other provider, Gateway or project-scope mutation.
    immutable=("obpp1291/","firebase/database.rules.json","firebase/firestore.indexes.json",
      "firebase.json","functions/","ops/apps-script/","pda-management/",
      "service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
      "service/wrangler.beta.toml","service/wrangler.stable.toml",
      "ops/project-scope.json","ops/resource-registry.json","relay-agent-webview2-host/")
    for p in immutable:
        must(git("diff","--quiet",BASE,"HEAD","--",p).returncode==0,"PROTECTED_RESOURCE_DRIFT:"+p)
    must(receipt.get("approved_components")==["agent","android","worker","firestore-rules"],
      "COMPONENT_SCOPE")
    must(receipt.get("rollout_order")==["worker","agent","android","firestore-rules"],
      "ROLLOUT_SEQUENCE")
    if preflight:
        print("D173_E140_RELEASE_SOURCE_PREFLIGHT_PASS__PROVIDER_NOT_MUTATED")
        return
    must(os.getenv("GITHUB_REF")=="refs/heads/main","MAIN_ONLY")
    must(git("log","-1","--format=%s").stdout.strip().startswith(MARKER),"EXACT_MERGE_MARKER")
    event=os.getenv("GITHUB_EVENT_NAME")
    if component=="firestore":
        must(event=="workflow_dispatch" and
             os.getenv("E140_FIRESTORE_STAGE")=="true","FIRESTORE_STAGED_DISPATCH_ONLY")
        # Firestore cutoff is independent of earlier Android publishing:
        # reject any release outside the approved quiet maintenance window.
        from datetime import datetime,timezone,timedelta
        hour=datetime.now(timezone(timedelta(hours=7))).hour
        must(hour in (3,4),"OUTSIDE_03_05_VN_MAINTENANCE")
    else:
        must(event=="push","PUSH_RELEASE_ONLY")
    print("D173_E140_"+component.upper()+"_GATED_PRODUCTION_AUTHORIZED sha="+main[:12])
if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--component",choices=("worker","agent","android","firestore"),required=True)
    parser.add_argument("--preflight",action="store_true")
    args=parser.parse_args()
    check(args.component,args.preflight)
