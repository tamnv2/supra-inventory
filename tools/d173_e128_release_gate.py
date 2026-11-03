#!/usr/bin/env python3
"""D173 E128: exact-source Owner-approved Worker HTTP rollback, no inheritance."""
import argparse,json,os,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE="e66739d92b9efdd8f63531b617fa95fa13a24240"
MARKER="D173-E128_LEGACY_HTTP_RELEASE:"
RECEIPT=ROOT/"ops/d173-e128-release-authorization.json"
ALLOWED={
"service/src/core.ts","tests/d173-e128-legacy-http-rollback.test.mjs",
"tools/d173_e097_startup_regression.mjs","tools/d173_e086_ws_regression.mjs",
"tools/d173_e128_release_gate.py","tools/d167_release_gate.py",
".github/workflows/deploy-beta.yml",
"ops/d173-e128-release-authorization.json","ops/project-state.json",
"ops/change-continuity/D173.json","ops/authority-manifest.json",
"docs/OWNER_DECISIONS.md","docs/D173_E128_LEGACY_HTTP_ROLLBACK_2026-11-03.md",
}
IMMUTABLE=("web/","android/","relay-agent/","firebase/","firebase.json","obpp1291/",
"functions/","ops/apps-script/","pda-management/","service/src/obpp1291-",
"service/wrangler.beta.toml","service/wrangler.stable.toml",
"ops/project-scope.json","ops/resource-registry.json")
def deny(why): raise SystemExit("D173_E128_OWNER_RELEASE_DENIED:"+why)
def git(*args):
    p=subprocess.run(["git",*args],cwd=ROOT,text=True,capture_output=True)
    if p.returncode: deny("GIT:"+args[0])
    return p.stdout.strip()
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--component",required=True)
    parser.add_argument("--preflight",action="store_true")
    opts=parser.parse_args()
    if opts.component!="worker":deny("WORKER_ONLY")
    try:r=json.loads(RECEIPT.read_text(encoding="utf8"))
    except (ValueError,OSError): deny("RECEIPT_MISSING")
    required={
        "schema_version":1,"project_key":"supra-inventory","change_id":"D173",
        "checkpoint_id":"D173-E128","origin_main_sha":BASE,
        "release_marker":MARKER,
        "owner_approval_reference":"OWNER_20261103_ROLLBACK_OLD_OPERATION_LOGIC_KEEP_CURRENT_PRODUCTION_BUSINESS",
        "approved_components":["worker"],"existing_worker_name":"supra-inventory-beta",
        "production_host":"inventory.supra.cc.cd",
        "owner_authorized_code":True,"owner_authorized_merge":True,
        "owner_authorized_worker_deployment":True,
        "web_source_change":False,"android_source_change":False,
        "agent_source_change":False,"firestore_rules_change":False,
        "stable_release":False,"d172_business_change":False,
        "gateway_change":False,"new_provider_resource":False,
        "database_migration":False,"field_pass":False,"owner_pass":False,
    }
    for key,want in required.items():
        if r.get(key)!=want:deny("OWNER_SCOPE_"+key)
    # "git merge-base" can return nonzero as normal assertion, unlike git().
    p=subprocess.run(["git","merge-base","--is-ancestor",BASE,"HEAD"],cwd=ROOT)
    if p.returncode:deny("BASE_NOT_ANCESTOR")
    changed=set(git("diff","--name-only",BASE,"HEAD").splitlines())
    if not changed or changed-ALLOWED:deny("UNAPPROVED_PATHS:"+",".join(sorted(changed-ALLOWED)))
    if "service/src/core.ts" not in changed:deny("NO_ROLLBACK_SOURCE")
    if any(path.startswith(boundary) for path in changed for boundary in IMMUTABLE):
        deny("D172_OR_OTHER_RESOURCE_CHANGED")
    text=(ROOT/"service/src/core.ts").read_text(encoding="utf8")
    if ("const D173_E128_LEGACY_HTTP_OPERATIONS = true;" not in text
            or 'command_protocol_disabled: D173_E128_LEGACY_HTTP_OPERATIONS ||' not in text
            or 'this.env.D173_COMMAND_TRANSPORT_DISABLED !== "1"' not in text):
        deny("LEGACY_HTTP_OR_REALTIME_CONTRACT")
    if ("d173PickerShiftIsExpired" not in text or "d173PickerShiftLogoutAtMs" not in text):
        deny("E123_SHIFT_REMOVED")
    blobs=r.get("source_blobs") or {}
    if set(blobs)!={"service/src/core.ts","tests/d173-e128-legacy-http-rollback.test.mjs"}:
        deny("SOURCE_PINS_INCOMPLETE")
    for path,expected in blobs.items():
        if not re.fullmatch(r"[0-9a-f]{40}",str(expected)):deny("INVALID_SOURCE_PIN")
        if git("rev-parse","HEAD:"+path)!=expected:deny("SOURCE_DRIFT_"+path)
    if not r.get("source_ci_verified"):
        if opts.preflight:
            print("D173_E128_SOURCE_APPROVAL_SCOPE_PASS__CI_PENDING__NO_RELEASE")
            return
        deny("SOURCE_CI_NOT_VERIFIED")
    sha=str(r.get("source_ci_sha") or "")
    if not re.fullmatch(r"[0-9a-f]{40}",sha):deny("CI_SHA_MISSING")
    if r.get("required_ci_failed")!=0 or int(r.get("required_ci_success") or 0)<25:
        deny("CI_NOT_SUCCESS")
    proc=subprocess.run(["git","merge-base","--is-ancestor",sha,"HEAD"],cwd=ROOT)
    if proc.returncode:deny("CI_SHA_NOT_ANCESTOR")
    # After exact CI, only docs / receipts can change; not deploy untested code.
    proc=subprocess.run(["git","diff","--quiet",sha,"HEAD","--","service/","web/","android/","relay-agent/","firebase/","functions/","ops/apps-script/","obpp1291/","tools/","tests/"],cwd=ROOT)
    if proc.returncode:deny("EXECUTABLE_SOURCE_AFTER_CI")
    if opts.preflight:
        print("D173_E128_SOURCE_PIN_AND_CI_PASS "+sha[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME")!="push" or os.environ.get("GITHUB_REF")!="refs/heads/main":
        deny("MAIN_PUSH_ONLY")
    if not git("log","-1","--format=%s").startswith(MARKER):
        deny("RELEASE_MARKER_MISSING")
    print("D173_E128_WORKER_SOURCE_RELEASE_AUTHORIZED "+sha[:12])
if __name__=="__main__": main()
