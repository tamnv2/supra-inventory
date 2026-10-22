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
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/verify-d171-agent-code-only.yml",
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
    # E010 FIELD-FAIL repair can be compiled/reviewed before a new exact-SHA
    # Owner release receipt is approved. This preflight can NEVER publish.
    if preflight:
        e010_base="2509f02f733d657ce9c493be26d3ca7c815e174d"
        if git("cat-file","-e",e010_base+"^{commit}").returncode or git("merge-base","--is-ancestor",e010_base,"HEAD").returncode:
            deny("D172 signed-v1 source provenance missing")
        protected=("service/","android/","web/","relay-agent/","firebase/","functions/","tools/",".github/workflows/","obpp1291/")
        differences=git("diff","--name-only",e010_base,"HEAD","--",*protected)
        if differences.returncode:
            deny("E010 bounded source comparison unavailable")
        allowed={
            "service/src/index.ts",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            ".github/workflows/d172-obpp1291-backend.yml",
            "tools/d172_release_gate.py",
        }
        unexpected=[path for path in differences.stdout.splitlines() if path not in allowed]
        if unexpected:
            deny("E010 cannot modify shared unrelated source: "+",".join(unexpected[:5]))
        print("D172_E010_CODE_ONLY_SCOPED_PREFLIGHT_PASS__NO_PROVIDER_RELEASE")
        return
    sha=str(r.get("approved_source_sha") or "")
    if not re.fullmatch("[0-9a-f]{40}",sha):deny("invalid pinned SHA")
    if git("cat-file","-e",sha+"^{commit}").returncode or git("merge-base","--is-ancestor",sha,"HEAD").returncode:deny("SHA not ancestor")
    # D172 Worker was released from the registered Production resource on this exact merge.
    # D171 E074 subsequently changed only its separately authorized Android/client gates.
    # Never repin D172 Owner approval to an unrelated D171 head.
    d172_worker_main="6c39e1f376e9181e8740201e037965d77cf94056"
    d171_android_main="507b27213263eca616e6c61947e78bc355b7c2c1"
    if sha!="7f90c17e8d5305be4c9294bbb917343804e536c3":
        deny("D172 Owner-approved source receipt unexpectedly changed")
    for commit in (d172_worker_main,d171_android_main):
        if git("cat-file","-e",commit+"^{commit}").returncode or git("merge-base","--is-ancestor",commit,"HEAD").returncode:
            deny("approved D172 Worker or D171 Android checkpoint unavailable")
    # No shared provider or backend changes after the previously deployed D172 Worker.
    immutable=("service/","web/","relay-agent/","firebase/","functions/")
    backend=git("diff","--name-only",d172_worker_main,"HEAD","--",*immutable)
    if backend.returncode or backend.stdout.strip():
        deny("D172 deployed Worker / shared backend was modified")
    protected=("service/","android/","web/","relay-agent/","firebase/","functions/","tools/",".github/workflows/","obpp1291/")
    d172_pinned=git("diff","--name-only",sha,d172_worker_main,"--",*protected)
    if d172_pinned.returncode or d172_pinned.stdout.strip():
        deny("D172 source changed after Owner-pinned SHA and before Worker release")
    allowed_release_gate_fixes={
        "tools/d172_release_gate.py",
        ".github/workflows/release-obpp1291.yml",
        ".github/workflows/d172-obpp1291-backend.yml",
    }
    newer=git("diff","--name-only",d171_android_main,"HEAD","--",*protected)
    if newer.returncode:
        deny("could not compare frozen concurrent D171 baseline")
    unexpected=[p for p in newer.stdout.splitlines() if p not in allowed_release_gate_fixes]
    if unexpected:
        deny("non-D172 change after approved D171 checkpoint: "+",".join(unexpected[:5]))
    changed=git("diff","--name-only",BASELINE,d172_worker_main,"--",*protected)
    if changed.returncode:
        deny("D172 initial source comparison unavailable")
    unexpected=[p for p in changed.stdout.splitlines() if not (p in ALLOWED or p.startswith("obpp1291/"))]
    if unexpected:
        deny("D172 Worker release expanded scope: "+",".join(unexpected[:5]))
    if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
        deny("main protected release only")
    print("D172_SCOPED_RELEASE_GATE_PASS "+component+" "+sha[:12])
if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--component",choices=("worker","android"),required=True)
    p.add_argument("--preflight",action="store_true")
    args=p.parse_args()
    check(args.component,args.preflight)
