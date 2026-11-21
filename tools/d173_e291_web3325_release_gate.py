#!/usr/bin/env python3
"""D173-E291: exact-source Owner release gate for PickPack-based Inventory Web 3.3.25 only."""
from __future__ import annotations
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "9125244e64458b10ccbffec1744418b63b3423bd"
MARKER = "D173-E291_WEB3325_PRODUCTION_RELEASE:"
AUTH_PATH = ROOT / "ops/d173-e291-web3325-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e291-pickpack-ui.yml",
    ".github/workflows/deploy-beta.yml",
    "docs/OWNER_DECISIONS.md",
    "docs/D173_E289_WEB3324_FIELD_FAIL_FULL_UI_REBUILD_2026-11-21.md",
    "docs/D173_E291_PICKPACK_UI_INVENTORY_PRODUCTION_SCOPE_2026-11-21.md",
    "docs/specs/UI_DESIGN_SYSTEM.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/current-context.json",
    "ops/project-state.json",
    "ops/d173-e291-web3325-release-authorization.json",
    "tests/d173-e291-pickpack-live-ui.test.mjs",
    "tests/d173-e291-web3325-release.test.mjs",
    "tools/d173_e291_web3325_release_gate.py",
    "web/src/pickpack-office.css",
    "web/src/d173-pickpack-business.css",
    "web/src/operational-app.ts",
    "web/src/web-version.ts",
    "web/package.json",
}
PROTECTED = (
    "service/", "obpp1291/", "android/", "relay-agent/", "firebase/",
    "functions/", "pda-management/", "ops/apps-script/", "relay-agent-webview2-host/",
    "ops/change-continuity/D172.json", "docs/D172_",
)

def deny(reason: str) -> None:
    raise SystemExit("D173_E291_WEB3325_RELEASE_DENIED:" + reason)

def git(*args: str) -> str:
    proc = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if proc.returncode:
        deny("GIT_" + args[0] + ":" + proc.stderr.strip()[:180])
    return proc.stdout.strip()

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=("worker","web"))
    parser.add_argument("--preflight",action="store_true")
    args = parser.parse_args()
    if not AUTH_PATH.is_file():
        deny("AUTH_MISSING")
    a = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
    requirements = {
        "schema_version":1,"project_key":"supra-inventory","change_id":"D173-E291",
        "source_pr":993,"owner_approval_reference":"OWNER_20261121_E291_ACTUAL_PICKPACK_BASED_WEB_PRODUCTION_RELEASE",
        "owner_code_approved":True,"owner_production_release_approved":True,
        "base_main_sha":BASE,"web_target_version":"3.3.25",
        "approved_components":["worker","web"],"release_marker":MARKER,
        "scope":"D173_WEB_PRESENTATION_ONLY__PICKPACK_SOURCE_UI__EXISTING_WORKER_WEB_ASSET_REPACK__NO_BUSINESS_SOURCE",
        "d172_cross_regression_required":True,"d172_pending_hold":True,
        "agent_mutation":False,"android_mutation":False,"firebase_mutation":False,
        "stable_mutation":False,"new_provider_resources":False,
        "field_pass":False,"owner_pass":False,
        "pickpack_ui_source_repo":"tamnv2/pickpack",
        "pickpack_ui_source_sha":"c9a7730b4307aa085e48e0198e859a3419d1c33e",
        "pickpack_ui_css_blob":"f35a20e456355dbf6d7e065b856a6760cd355234",
    }
    for key, value in requirements.items():
        if a.get(key) != value:
            deny("AUTH_" + key)
    if 'WEB_VERSION = "3.3.25"' not in (ROOT/"web/src/web-version.ts").read_text(encoding="utf-8"):
        deny("VERSION_TS")
    if json.loads((ROOT/"web/package.json").read_text(encoding="utf-8")).get("version") != "3.3.25":
        deny("VERSION_PACKAGE")
    app = (ROOT/"web/src/operational-app.ts").read_text(encoding="utf-8")
    if 'import "./pickpack-office.css";' not in app or 'import "./d173-pickpack-business.css";' not in app:
        deny("PICKPACK_UI_IMPORT_MISSING")
    if any('import "'+p+'"' in app for p in (
        './legacy-operational.css', './d173-tabler.css', './d173-overview.css','./d173-inventory-preview.css'
    )):
        deny("LEGACY_UI_IMPORT")
    if args.preflight:
        base = git("merge-base","origin/main","HEAD")
    else:
        parents=git("rev-list","--parents","-n","1","HEAD").split()
        if len(parents)!=3 or not git("log","-1","--format=%s").startswith(MARKER):
            deny("TWO_PARENT_MERGE_MARKER")
        if os.environ.get("GITHUB_EVENT_NAME")!="push" or os.environ.get("GITHUB_REF")!="refs/heads/main":
            deny("PROTECTED_MAIN_PUSH_ONLY")
        base=parents[1]
    if base != BASE:
        deny("BASE_DRIFT")
    changed=set(filter(None,git("diff","--name-only",BASE,"HEAD").splitlines()))
    if changed-ALLOWED:
        deny("OUT_OF_SCOPE:"+",".join(sorted(changed-ALLOWED))[:240])
    for path in changed:
        if any(path.startswith(prefix) for prefix in PROTECTED):
            deny("PROTECTED_MODULE_MUTATION:"+path)
    for path in (
        "web/src/operational-app.ts","web/src/pickpack-office.css",
        "web/src/d173-pickpack-business.css","web/src/web-version.ts","web/package.json",
        ".github/workflows/deploy-beta.yml","tests/d173-e291-pickpack-live-ui.test.mjs",
        ".github/workflows/d173-e291-pickpack-ui.yml",
        "tools/d173_e291_web3325_release_gate.py",
        "ops/d173-e291-web3325-release-authorization.json",
    ):
        if path not in changed:
            deny("MISSING_REQUIRED_SOURCE:"+path)
    source=a.get("source_code_sha")
    if not isinstance(source,str) or len(source)!=40:
        deny("SOURCE_NOT_PINNED")
    git("merge-base","--is-ancestor",source,"HEAD")
    if git("diff","--name-only",source,"HEAD","--","web/","service/","tests/",".github/workflows/","tools/"):
        deny("SOURCE_DRIFT_AFTER_PIN")
    if args.preflight:
        print("D173_E291_WEB3325_PREFLIGHT_PASS_NO_DEPLOY")
        return
    source_ci=a.get("source_ci_sha")
    if not isinstance(source_ci,str) or len(source_ci)!=40:
        deny("CI_NOT_PINNED")
    git("merge-base","--is-ancestor",source_ci,parents[2])
    if git("diff","--name-only",source_ci,parents[2],"--","web/","service/","tests/",".github/workflows/","tools/"):
        deny("CODE_DRIFT_AFTER_CI")
    for flag in ("source_ci_verified","web_build_pass","real_app_browser_pass",
                 "d172_isolation_pass","authority_guard_pass","continuity_guard_pass"):
        if a.get(flag) is not True:
            deny("CI_"+flag)
    if a.get("required_ci_failed")!=0 or a.get("required_ci_success",0)<4:
        deny("REQUIRED_CI_STATUS")
    if len(a.get("required_ci_run_ids",[]))<4:
        deny("CI_RECEIPTS_MISSING")
    print("D173_E291_WEB3325_RELEASE_AUTHORIZED:"+args.component)

if __name__=="__main__":
    main()
