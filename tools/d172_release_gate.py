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
    # E029: app-only compact UX / menu repair; source-only until review+pin.
    e029=r.get("e029_compact_ui")
    if e029 is not None:
        base="b319a25b3f09f7a0257f459208bb96a603fea118"
        if e029.get("checkpoint")!="D172-E029" or e029.get("status")!="CODE_ONLY_CI_PENDING":
            deny("E029 candidate is not reviewed")
        if e029.get("baseline_main")!=base or e029.get("scope")!="OBPP_ANDROID_UI_ONLY":
            deny("E029 scope mismatch")
        if not preflight:deny("E029 CODE ONLY; exact source pin and CI required")
        if git("merge-base","--is-ancestor",base,"HEAD").returncode:
            deny("E029 wrong baseline")
        protected=("service/","web/","android/","relay-agent/","firebase/","functions/",
                   "obpp1291/",".github/workflows/","tools/","tests/","ops/apps-script/")
        allowed={
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "tests/d172-e029-compact-ui.test.mjs",
            ".github/workflows/d172-obpp1291-android.yml",
            ".github/workflows/release-obpp1291.yml",
            "tools/d172_release_gate.py"
        }
        diff=git("diff","--name-only",base,"HEAD","--",*protected)
        if diff.returncode or set(diff.stdout.splitlines())-allowed:
            deny("E029 changed out-of-scope code")
        print("D172_E029_CODE_ONLY_UI_PREFLIGHT_PASS "+component)
        return
    # E026: immutable scoped source reviewed for existing Worker and OBPP app.
    # No new resources or Inventory/Agent/Stable release. Owner FIELD PASS separate.
    e026=r.get("e026_obpp_operational_fix")
    if e026 is not None:
        base="967e27ecac914a73452c4ae5af978ae161761259"
        pin="5efaa1687ecbd97d0704eabc3ca700dd97142a80"
        expected={
            "checkpoint":"D172-E026",
            "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
            "baseline_main":base,
            "approved_source_sha":pin,
            "approved_components":["worker","android"],
            "existing_worker_only":True,
            "existing_log_folder_only":True,
            "app_package":"cd.cc.supra.obpp1291",
            "no_new_provider_resource":True,
            "inventory_agent_stable_unchanged":True,
            "field_pass":False,"owner_pass":False,
        }
        for key,value in expected.items():
            if e026.get(key)!=value:deny("E026 reviewed receipt mismatch: "+key)
        for ref in (base,pin):
            if git("cat-file","-e",ref+"^{commit}").returncode or git("merge-base","--is-ancestor",ref,"HEAD").returncode:
                deny("E026 immutable source not reachable")
        protected=("service/","web/","android/","relay-agent/","firebase/","functions/",
                   "obpp1291/",".github/workflows/","tools/","tests/","ops/apps-script/")
        allowed={
            "service/src/index.ts","service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
            "obpp1291/android/app/src/main/AndroidManifest.xml",
            "obpp1291/android/app/build.gradle.kts",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppSessionStore.kt",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppDiagnostics.kt",
            "obpp1291/android/app/src/main/res/drawable/obpp_launcher.xml",
            "tests/d172-e026-session-history-logs.test.mjs",
            "tests/d172-e010-obpp-shared-fire-login.test.mjs",
            "tests/d172-e019-coordinator-mirror.test.mjs",
            ".github/workflows/d172-obpp1291-backend.yml",
            "tools/d172_release_gate.py"
        }
        changed=git("diff","--name-only",base,pin,"--",*protected)
        if changed.returncode or set(changed.stdout.splitlines())-allowed:
            deny("E026 protected source outside Owner scope")
        future=git("diff","--name-only",pin,"HEAD","--",*protected)
        if future.returncode or set(future.stdout.splitlines())-{"tools/d172_release_gate.py"}:
            deny("E026 source mutated after reviewed pin")
        if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
            deny("E026 actual release requires protected main")
        print("D172_E026_OWNER_PINNED_SCOPED_WORKER_AND_OBPP_APK_PASS "+component+" "+pin[:12])
        return
    # D172 E024 exact Owner rollout approval supersedes the E022 code-only
    # candidate solely for the bounded, reviewed existing Worker + OBPP APK.
    e024=r.get("e024_e022_release")
    if e024 is not None:
        expected={
            "checkpoint":"D172-E024",
            "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
            "owner_reference":"OWNER_20261022_D172_E022_FINISH_CODE_SHEET_APP_AND_DEPLOY",
            "baseline_main":"9609d733ce630edf8d705ce77232f6df6c1f3d7d",
            "approved_source_sha":"6cb4b8c8ad73a00ecaf1de01573f15c5426b50a1",
            "approved_components":["worker","android"],
            "app_package":"cd.cc.supra.obpp1291",
            "existing_worker_only":True,
            "existing_registered_spreadsheet_only":True,
            "registered_sheet_backup_internal_only":True,
            "prohibit_new_worker_or_database":True,
            "prohibit_firestore_rules_change":True,
            "prohibit_inventory_app_or_agent_change":True,
            "prohibit_inventory_ota_mutation":True,
            "prohibit_old_stable_mutation":True,
            "d170_d171_owner_pass":False,
            "field_pass":False,"owner_pass":False
        }
        for key,value in expected.items():
            if e024.get(key)!=value:deny("E024 receipt mismatch: "+key)
        base,pin=expected["baseline_main"],expected["approved_source_sha"]
        for ref in (base,pin):
            if git("cat-file","-e",ref+"^{commit}").returncode or git("merge-base","--is-ancestor",ref,"HEAD").returncode:
                deny("E024 source pin not reachable")
        protected=("service/","web/","android/","relay-agent/","firebase/","functions/",
                   "obpp1291/","tools/",".github/workflows/","tests/","ops/apps-script/")
        allow={
            "service/src/index.ts","service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "tools/d172_release_gate.py","tools/d172_sheet_migration_plan.mjs",
            "tests/d172-e014-obpp-sheet-contract.test.mjs",
            "tests/d172-e022-sheet-migration.test.mjs",
            ".github/workflows/d172-obpp1291-backend.yml",
        }
        changed=git("diff","--name-only",base,pin,"--",*protected)
        if changed.returncode or set(changed.stdout.splitlines())-allow:
            deny("E024 unapproved runtime paths")
        future=git("diff","--name-only",pin,"HEAD","--",*protected)
        if future.returncode or set(future.stdout.splitlines())-{"tools/d172_release_gate.py"}:
            deny("E024 runtime changed after source review")
        if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
            deny("E024 releases only from protected main")
        print("D172_E024_OWNER_PINNED_WORKER_AND_SEPARATE_OBPP_APK_PASS "+component+" "+pin[:12])
        return
    # E022 is strictly a code-only candidate: tests may review new scoped source,
    # but NEVER authorize a Worker deployment or signed GitHub OTA from this PR.
    e022=r.get("e022_code_only")
    if e022 is not None:
        base="9609d733ce630edf8d705ce77232f6df6c1f3d7d"
        if e022.get("checkpoint")!="D172-E022" or e022.get("status")!="CODE_ONLY_NOT_APPROVED_FOR_DEPLOY":
            deny("E022 not a code-only checkpoint")
        if e022.get("baseline_main")!=base or e022.get("old_v4_live_unchanged") is not True:
            deny("E022 source baseline mismatch")
        if not preflight:deny("E022 CODE ONLY; Owner release and Sheet migration gates not satisfied")
        if git("merge-base","--is-ancestor",base,"HEAD").returncode:
            deny("E022 not based on current reviewed v4")
        protected=("service/","web/","android/","relay-agent/","firebase/","functions/","obpp1291/",
                   "ops/apps-script/",".github/workflows/","tools/","tests/")
        allowed={
            "service/src/index.ts","service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "tests/d172-e014-obpp-sheet-contract.test.mjs",
            "tools/d172_release_gate.py",
            "tools/d172_sheet_migration_plan.mjs",
            "tests/d172-e022-sheet-migration.test.mjs",
            ".github/workflows/d172-obpp1291-backend.yml",
        }
        changed=git("diff","--name-only",base,"HEAD","--",*protected)
        if changed.returncode or set(changed.stdout.splitlines())-allowed:
            deny("E022 code-only PR attempts an out-of-scope protected change")
        print("D172_E022_CODE_ONLY_SAFE_PREFLIGHT__PROVIDER_RELEASE_DENIED "+component)
        return
    # E019 supersedes E016's worker-only runtime boundary without rewriting its
    # immutable historic receipt: newly reviewed Worker + standalone OBPP Android.
    e019=r.get("e019_ui_cloud_coordinator")
    if e019 is not None:
        expected={
            "checkpoint":"D172-E019",
            "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
            "owner_reference":"OWNER_20261022_D172_E019_UI_A_ONE_WAY_SHEET_OBPP_COORDINATOR_DEPLOY",
            "baseline_main":"70a484f07e30cdb2988df0844c5c675c145c9705",
            "approved_source_sha":"fc362ae65b6c8caa29ea9ed682bd45a2aae63d4b",
            "approved_components":["worker","android"],
            "app_package":"cd.cc.supra.obpp1291",
            "prohibit_inventory_business_change":True,
            "prohibit_agent_picklist_change":True,
            "prohibit_firestore_rules_change":True,
            "prohibit_new_provider_resource":True,
            "old_stable_mutation":False,
            "existing_inventory_ota_mutation":False,
            "d170_d171_owner_pass":False,
            "field_pass":False,
            "owner_pass":False,
        }
        for key,val in expected.items():
            if e019.get(key)!=val:deny("E019 Owner receipt mismatch: "+key)
        base=expected["baseline_main"]
        pin=expected["approved_source_sha"]
        for commit in (base,pin):
            if git("cat-file","-e",commit+"^{commit}").returncode or git("merge-base","--is-ancestor",commit,"HEAD").returncode:
                deny("E019 pinned provenance absent")
        protected=("service/","web/","android/","relay-agent/","firebase/","functions/",
                   "obpp1291/","tools/",".github/workflows/","tests/","ops/apps-script/")
        allowed={
            "service/src/auth.ts","service/src/core.ts","service/src/firebase-auth-admin.ts",
            "service/src/index.ts","service/src/obpp1291-core.ts",
            "service/src/obpp1291-sheets.ts","service/src/user-management-core.ts",
            "web/src/api.ts","web/src/operational-app.ts",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "tests/d172-e014-obpp-sheet-contract.test.mjs",
            "tests/d172-e019-coordinator-mirror.test.mjs",
            ".github/workflows/d172-obpp1291-backend.yml",
        }
        diff=git("diff","--name-only",base,pin,"--",*protected)
        if diff.returncode:deny("E019 scoped source comparison unavailable")
        changed=set(diff.stdout.splitlines())
        if changed-allowed:deny("E019 touches unauthorized runtime: "+",".join(sorted(changed-allowed)))
        if not {
            "service/src/index.ts","service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
            "service/src/user-management-core.ts","web/src/operational-app.ts",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "tests/d172-e019-coordinator-mirror.test.mjs",
        }.issubset(changed):deny("E019 missing scoped implementation or regression")
        future=git("diff","--name-only",pin,"HEAD","--",*protected)
        if future.returncode or set(future.stdout.splitlines())-{
            "tools/d172_release_gate.py",".github/workflows/release-obpp1291.yml",
        }:deny("E019 code changed after reviewed SHA")
        if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
            deny("E019 actual release requires protected main")
        print("D172_E019_PINNED_SCOPED_WORKER_AND_OBPP_APK_PASS "+component+" "+pin[:12])
        return
    # D172-E016 follows the same Owner-approved D172 repair, Worker only.
    # No APK rebuild: signed v3 already contains the new UI and update channel.
    e016=r.get("e016_sheet_range_fix")
    if e016 is not None:
        expected={
            "checkpoint":"D172-E016",
            "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
            "owner_reference":"OWNER_20261022_D172_REPAIR_AND_DEPLOY_GOOGLE_SHEET_SYNC",
            "baseline_main":"0e7f35bbb892408b7cfc59c940a3f9940ab796e2",
            "approved_components":["worker"],
            "existing_worker_only":True,
            "existing_android_apk_mutation":False,
            "new_google_provider":False,
            "field_pass":False,
            "owner_pass":False,
        }
        for key,val in expected.items():
            if e016.get(key)!=val:deny("E016 limited Worker receipt mismatch: "+key)
        if component=="android" and not preflight:
            deny("E016 Worker-only: do not sign or replace OBPP v3")
        base=expected["baseline_main"]
        pin=e016.get("approved_source_sha")
        if not isinstance(pin,str) or not re.fullmatch("[0-9a-f]{40}",pin):
            deny("E016 unpinned reviewed source")
        for commit in (base,pin):
            if git("cat-file","-e",commit+"^{commit}").returncode or git("merge-base","--is-ancestor",commit,"HEAD").returncode:
                deny("E016 base/source provenance missing")
        protected=("service/","web/","android/","relay-agent/","firebase/","functions/","obpp1291/","tools/",".github/workflows/","tests/")
        changed=git("diff","--name-only",base,pin,"--",*protected)
        if changed.returncode or set(changed.stdout.splitlines())-{
            "service/src/obpp1291-sheets.ts",
            "tests/d172-e014-obpp-sheet-contract.test.mjs",
            "tools/d172_release_gate.py",
            ".github/workflows/release-obpp1291.yml",
        }:deny("E016 changes outside isolated Sheets writer or regression test")
        if "service/src/obpp1291-sheets.ts" not in changed.stdout.splitlines():
            deny("E016 missing URL/body range fix")
        future=git("diff","--name-only",pin,"HEAD","--",*protected)
        if future.returncode or set(future.stdout.splitlines())-{
            "tools/d172_release_gate.py",
            ".github/workflows/release-obpp1291.yml",
        }:deny("E016 code drift after reviewed pin")
        if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
            deny("E016 Worker deploy only after protected main")
        print("D172_E016_GOOGLE_SHEET_WRITER_WORKER_ONLY_PASS "+component+" "+pin[:12])
        return
    # D172-E014 Owner approved a new scoped Sheets/Android repair, superseding
    # only the E012 Worker-only release boundary for these exact source files.
    # Historical E010/E012 receipts remain immutable and auditable.
    e014=r.get("e014_sheet_sync_fix")
    if e014 is not None:
        expected={
            "checkpoint":"D172-E014",
            "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
            "owner_reference":"OWNER_20261022_D172_E014_CODE_AND_DEPLOY_SHEET_SYNC_UI",
            "baseline_main":"17f8dc4bba09a709ea7edf8e86d4d1c552cc22a8",
            "approved_components":["worker","android"],
            "existing_worker_only":True,
            "separate_android_package":"cd.cc.supra.obpp1291",
            "existing_cron_only":True,
            "new_apps_script_resource":False,
            "inventory_agent_firebase_mutation":False,
            "old_stable_mutation":False,
            "field_pass":False,
            "owner_pass":False,
        }
        for key,val in expected.items():
            if e014.get(key)!=val:deny("E014 scoped approval mismatch: "+key)
        base=expected["baseline_main"]
        pin=e014.get("approved_source_sha")
        if not isinstance(pin,str) or not re.fullmatch("[0-9a-f]{40}",pin):
            deny("E014 missing exact source pin")
        for c in (base,pin):
            if git("cat-file","-e",c+"^{commit}").returncode or git("merge-base","--is-ancestor",c,"HEAD").returncode:
                deny("E014 protected baseline / approved source missing")
        protected=("service/","web/","android/","relay-agent/","firebase/","functions/","obpp1291/","tools/",".github/workflows/")
        permitted={
            "service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
            "service/src/index.ts","obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "tests/d172-e014-obpp-sheet-contract.test.mjs",
            ".github/workflows/d172-obpp1291-backend.yml",
            "tools/d172_release_gate.py",
        }
        changed=git("diff","--name-only",base,pin,"--",*protected,"tests/")
        if changed.returncode or set(changed.stdout.splitlines())-permitted:
            deny("E014 adds unapproved provider/client source")
        if not {"service/src/obpp1291-core.ts","service/src/obpp1291-sheets.ts",
                "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt"}.issubset(set(changed.stdout.splitlines())):
            deny("E014 mandatory scoped code repair missing")
        future=git("diff","--name-only",pin,"HEAD","--",*protected,"tests/")
        if future.returncode or set(future.stdout.splitlines())-{"tools/d172_release_gate.py"}:
            deny("E014 approved source drift after pin")
        if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
            deny("E014 requires protected main before provider release")
        print("D172_E014_SCOPED_OWNER_APPROVAL_AND_IMMUTABLE_SOURCE_PASS "+component+" "+pin[:12])
        return
    # E012 OWNER remediation: registered InventoryCore role-prefix UID includes a colon.
    # Replaces only the isolated OBPP DO session validator; Worker only, NO APK.
    uidfix=r.get("e012_obpp_session_uid_fix")
    if uidfix is not None:
        e012_expected={
            "change_id":"D172",
            "checkpoint":"D172-E012",
            "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
            "owner_reference":"OWNER_20261022_D172_E012_FIX_SESSION_ACTIVATION_AND_DEPLOY",
            "approved_source_sha":"b8f02ff2ad8e98396f34a0cf42db9b3d0709298a",
            "baseline_main":"5bea61070bfe8ad445ade6f1b66e514e793513c4",
            "approved_components":["worker"],
            "approved_runtime_source":["service/src/obpp1291-core.ts"],
            "existing_worker_only":True,
            "existing_android_apk_ota_mutation":False,
            "shared_web_agent_session_mutation":False,
            "d170_d171_owner_pass":False,
            "stable_worker_deploy_permission":False,
            "firestore_rules_mutation":False,
            "field_pass":False,
            "owner_pass":False,
        }
        for key,val in e012_expected.items():
            if uidfix.get(key)!=val:deny("E012 scoped Owner receipt mismatch "+key)
        if component!="worker" and not preflight:deny("E012 release is Worker-only; do not sign or replace APK v2")
        base=e012_expected["baseline_main"]
        pin=e012_expected["approved_source_sha"]
        for commit in (base,pin):
            if git("cat-file","-e",commit+"^{commit}").returncode or git("merge-base","--is-ancestor",commit,"HEAD").returncode:
                deny("E012 Owner pinned source history unavailable")
        protected=("service/","web/","android/","obpp1291/","relay-agent/","firebase/","functions/","tools/",".github/workflows/")
        first=git("diff","--name-only",base,pin,"--",*protected)
        if first.returncode:deny("E012 reviewed source comparison failed")
        permitted={"service/src/obpp1291-core.ts",".github/workflows/d172-obpp1291-backend.yml"}
        if set(first.stdout.splitlines())-permitted:deny("E012 expands shared runtime")
        if "service/src/obpp1291-core.ts" not in first.stdout.splitlines():
            deny("E012 requires UID validator source repair")
        future=git("diff","--name-only",pin,"HEAD","--",*protected)
        if future.returncode or set(future.stdout.splitlines())-{"tools/d172_release_gate.py"}:
            deny("E012 immutable reviewed source changed")
        previous=git("show",base+":service/src/obpp1291-core.ts")
        current=git("show",pin+":service/src/obpp1291-core.ts")
        if previous.returncode or current.returncode:deny("E012 source content unavailable")
        # Confirm no mutation of unrelated inventory business code or session logic.
        before=previous.stdout.split('    if(path==="/obpp1291/session/activate" && method==="POST"){')
        after=current.stdout.split('    if(path==="/obpp1291/session/activate" && method==="POST"){')
        if len(before)!=2 or len(after)!=2 or before[0]!=after[0]:
            deny("E012 changed OBPP non-session source")
        segment="    if(path===\"/obpp1291/session/check\" && method===\"POST\"){"
        if segment not in before[1] or segment not in after[1]:
            deny("E012 expected unchanged session check block missing")
        if before[1].split(segment,1)[1]!=after[1].split(segment,1)[1]:
            deny("E012 changed OBPP session check/CRUD/Sheet runtime")
        if "^[A-Za-z0-9_-][A-Za-z0-9._:-]{0,127}$" not in after[1].split(segment,1)[0]:
            deny("E012 expected colon-capable bounded UID check missing")
        if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
            deny("E012 release requires protected main merge")
        print("D172_E012_ROLE_PREFIX_UID_SOURCE_AND_OWNER_GATE_PASS "+component+" "+pin[:12])
        return
    # E010 FIELD-FAIL repair can be compiled/reviewed before a new exact-SHA
    # Owner release receipt is approved. This preflight can NEVER publish.
    if preflight and r.get("e010_field_login_fix") is None:
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
    # D172-E010: separately approved shared-Firebase login FIELD-FAIL repair.
    # Exact reviewed source SHA, only two scoped runtime source files.
    fix=r.get("e010_field_login_fix")
    if fix is not None:
        expected={
            "change_id":"D172",
            "checkpoint":"D172-E010",
            "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
            "owner_reference":"OWNER_EXPLICIT_20261022_D172_E010_FIX_HTTP500_AND_DEPLOY",
            "approved_source_sha":"cb29102d3cea97c4b8836b29c0931eba2524bb8d",
            "baseline_signed_v1_main":"60b38365a2f4c4d64fdd2dec6a4f290488c82076",
            "approved_components":["worker","android"],
            "allowed_runtime_source":["service/src/index.ts","obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt"],
            "app_package":"cd.cc.supra.obpp1291",
            "separate_release_channel":"obpp1291-latest",
            "do_schema_change":False,
            "existing_web_android_agent_session_generation_mutation":False,
            "existing_inventory_apk_ota_mutation":False,
            "firestore_rules_mutation":False,
            "legacy_stable_mutation":False,
            "field_pass":False,
            "owner_pass":False,
        }
        for key,value in expected.items():
            if fix.get(key)!=value:deny("E010 exact Owner scope mismatch: "+key)
        old=expected["baseline_signed_v1_main"]
        pin=expected["approved_source_sha"]
        for c in (old,pin):
            if git("cat-file","-e",c+"^{commit}").returncode or git("merge-base","--is-ancestor",c,"HEAD").returncode:
                deny("E010 approved source/accepted baseline unavailable")
        protected=("service/","android/","web/","relay-agent/","firebase/","functions/","tools/",".github/workflows/","obpp1291/")
        allowed_initial={
            "service/src/index.ts",
            "obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",
            "tools/d172_release_gate.py",
            ".github/workflows/d172-obpp1291-backend.yml",
        }
        initial=git("diff","--name-only",old,pin,"--",*protected)
        if initial.returncode:deny("E010 reviewed source diff unavailable")
        if set(initial.stdout.splitlines())-allowed_initial:
            deny("E010 reviewed source expanded beyond D172")
        subsequent=git("diff","--name-only",pin,"HEAD","--",*protected)
        if subsequent.returncode:deny("E010 pinned-source comparison unavailable")
        if set(subsequent.stdout.splitlines())-{"tools/d172_release_gate.py",".github/workflows/release-obpp1291.yml"}:
            deny("E010 source drift after Owner approved SHA")
        # New D172 Worker diff MUST be restricted inside the existing OBPP handler.
        old_text=git("show",old+":service/src/index.ts")
        new_text=git("show",pin+":service/src/index.ts")
        if old_text.returncode or new_text.returncode:deny("E010 source audit missing")
        begin="async function handleObppApp("
        end="async function setRootEffectiveRole("
        old_parts=old_text.stdout.split(begin,1)
        new_parts=new_text.stdout.split(begin,1)
        if len(old_parts)!=2 or len(new_parts)!=2 or old_parts[0]!=new_parts[0]:
            deny("E010 cannot change existing Inventory Worker login/routes outside D172")
        old_tail=old_parts[1].split(end,1)
        new_tail=new_parts[1].split(end,1)
        if len(old_tail)!=2 or len(new_tail)!=2 or old_tail[1]!=new_tail[1]:
            deny("E010 shared Worker unrelated behavior changed")
        if not preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
            deny("E010 protected main only")
        print("D172_E010_PINNED_OWNER_DEPLOY_PASS "+component+" "+pin[:12])
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
