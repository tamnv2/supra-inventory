#!/usr/bin/env python3
"""D172 exact Owner-scoped release gate; no D171 grants reused."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
BASELINE="8f3b691abd1c3c1ea96d84d3c819e0b152f48c5e"
ALLOWED={
    "service/src/index.ts","service/src/auth.ts","service/src/core.ts",
    "service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d172-obpp1291-android.yml",
    ".github/workflows/d172-obpp1291-backend.yml",
    ".github/workflows/release-obpp1291.yml",
    "tools/d167_release_gate.py","tools/d172_release_gate.py",
}
def git(*args):
    return subprocess.run(["git",*args],cwd=ROOT,text=True,capture_output=True,check=False)
def deny(msg):
    raise SystemExit("D172_RELEASE_DENIED: "+msg)
def check(component,preflight=False):
    path=ROOT/"ops/d172-release-authorization.json"
    if not path.is_file():deny("receipt absent")
    r=json.loads(path.read_text(encoding="utf-8"))
    if r.get("change_id")!="D172" or r.get("owner_reference")!="OWNER_EXPLICIT_D172_20261022_GITHUB_OTA_AND_COMPLETE_APP_DEPLOY":deny("wrong authority")
    if r.get("status")!="OWNER_EXPLICIT_DEPLOY_APPROVED":deny("not approved")
    if r.get("approved_components")!=["worker","android"] or component not in r["approved_components"]:deny("scope not exact")
    for key in ("stable_worker_deploy_permission","stable_deploy_permission","firebase_rules_mutation",
                "existing_inventory_ota_mutation","d170_d171_owner_pass","field_pass","owner_pass"):
        if r.get(key) is not False:deny("scope/pass status mismatch: "+key)
    if r.get("sheet_identity_mode")!="REGISTERED_PRIVATE_SHEET_SHA256_FINGERPRINT":deny("sheet identity mismatch")
    sha=str(r.get("approved_source_sha") or "")
    if not re.fullmatch("[0-9a-f]{40}",sha):deny("invalid pinned SHA")
    if git("cat-file","-e",sha+"^{commit}").returncode or git("merge-base","--is-ancestor",sha,"HEAD").returncode:deny("SHA not ancestor")
    protected=("service/","android/","web/","relay-agent/","firebase/","functions/","tools/",".github/workflows/")
    newer=git("diff","--name-only",sha,"HEAD","--",*protected)
    if newer.returncode or newer.stdout.strip():deny("source mutated since code approval")
    changed=git("diff","--name-only",BASELINE,"HEAD","--",*protected)
    if changed.returncode:deny("base comparison unavailable")
    unexpected=[p for p in changed.stdout.splitlines() if not (p in ALLOWED or p.startswith("obpp1291/"))]
    if unexpected:deny("non-D172 source changed: "+",".join(unexpected[:5]))
    if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
        deny("main protected release only")
    print("D172_SCOPED_RELEASE_GATE_PASS "+component+" "+sha[:12])
if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--component",choices=("worker","android"),required=True)
    p.add_argument("--preflight",action="store_true")
    args=p.parse_args()
    check(args.component,args.preflight)
