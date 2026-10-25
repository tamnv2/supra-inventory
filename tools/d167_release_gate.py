#!/usr/bin/env python3
"""D167 fail-closed Beta release approval: branch PR/CI is NOT deployment."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = {"worker", "gateway", "firestore", "rtdb", "functions", "android", "agent",
              "pda-management", "usage-test-agent", "canary", "legacy-gateway-migration"}
PROTECTED = ("service/", "web/", "android/", "relay-agent/", "functions/",
             "firebase/", "firebase.json", "ops/apps-script/", ".github/workflows/",
             "tools/", "pda-management/", "usage-test-agent/", "ops/apps-script/automation-canary/",
             "ops/project-scope.json", "ops/resource-registry.json")


def fail(message):
    raise SystemExit("D167_OWNER_DEPLOY_GATE_DENIED: " + message)


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=False)


def receipt():
    # A pending D168 receipt explicitly prevents reuse of D167 release rights.
    # Historical D167 audit remains supported when no D168 receipt exists.
    path = ROOT / "ops/d171-release-authorization.json"
    if not path.is_file():
        path = ROOT / "ops/d170-release-authorization.json"
    if not path.is_file():
        path = ROOT / "ops/d169-release-authorization.json"
    if not path.is_file():
        path = ROOT / "ops/d168-release-authorization.json"
    if not path.is_file():
        path = ROOT / "ops/d167-release-authorization.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        fail("missing or corrupt authorization receipt")
    if data.get("change_id") not in ("D167", "D168", "D169", "D170", "D171"):
        fail("wrong change id")
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=sorted(COMPONENTS))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    # D173-E034: separate exact-Owner release for UI Web3.2/Agent142/Android119.
    if (args.component in ("worker", "agent", "android")
            and os.getenv("GITHUB_EVENT_NAME") == "push"
            and os.getenv("GITHUB_REF") == "refs/heads/main"
            and git("log", "-1", "--format=%s").stdout.strip().startswith("D173-E034_UI_RELEASE:")):
        outcome = subprocess.run(["python3", str(ROOT / "tools/d173_e034_release_gate.py"), "--component", args.component], cwd=ROOT, text=True, capture_output=True, check=False)
        if outcome.returncode: fail(outcome.stdout.strip() + outcome.stderr.strip())
        print(outcome.stdout.strip()); return
    # D173-E026 has its own Owner+source gate for the existing official runtime.
    # Historical D171 vc117 and D172 E048 permissions must never authorize
    # newer Worker, Agent or Android code. Fail closed on its exact merge marker.
    if (args.component in ("worker", "agent", "android")
            and os.getenv("GITHUB_EVENT_NAME") == "push"
            and os.getenv("GITHUB_REF") == "refs/heads/main"
            and git("log", "-1", "--format=%s").stdout.strip().startswith(
                "D173-E026_PHASE1_RELEASE:")):
        outcome = subprocess.run(
            ["python3", str(ROOT / "tools/d173_phase1_release_gate.py"),
             "--component", args.component],
            cwd=ROOT, text=True, capture_output=True, check=False,
        )
        if outcome.returncode:
            fail(outcome.stdout.strip() + outcome.stderr.strip())
        print(outcome.stdout.strip())
        return
    # D173-E010 approved scope: activate the previously verified no-reply sender
    # only on the existing registered production Worker after E007/E008 proof.
    # This separate exact-SHA receipt cannot bypass D172 or Stable release gates.
    if args.component == "worker" and (ROOT / "ops/d173-email-sender-activation-authorization.json").is_file():
        outcome = subprocess.run(
            ["python3", str(ROOT / "tools/d173_email_activate_gate.py"),
             "--component", "worker"],
            cwd=ROOT, text=True, capture_output=True, check=False)
        if outcome.returncode == 0:
            print(outcome.stdout.strip())
            return
    # D173-E005 approved scope: inert Email Sending binding only on the
    # existing Production Worker. This never edits or bypasses the protected
    # D172 release pin; the independent D173 gate checks a pinned source SHA,
    # D172 isolation, existing Worker identity and Gmail-still-active flag.
    if args.component == "worker" and (ROOT / "ops/d173-email-release-authorization.json").is_file():
        outcome = subprocess.run(
            ["python3", str(ROOT / "tools/d173_email_release_gate.py"),
             "--component", "worker"],
            cwd=ROOT, text=True, capture_output=True, check=False)
        if outcome.returncode == 0:
            print(outcome.stdout.strip())
            return
    # Narrow D172 Owner-approved Worker exception. D170/D171 unchanged.
    if args.component == "worker" and (ROOT / "ops/d172-release-authorization.json").is_file():
        d172 = json.loads((ROOT / "ops/d172-release-authorization.json").read_text(encoding="utf-8"))
        if d172.get("status") == "OWNER_EXPLICIT_DEPLOY_APPROVED":
            outcome = subprocess.run(["python3", str(ROOT / "tools/d172_release_gate.py"), "--component", "worker"],
                                     cwd=ROOT, text=True, capture_output=True, check=False)
            if outcome.returncode: fail(outcome.stdout.strip() + outcome.stderr.strip())
            print(outcome.stdout.strip())
            return
    data = receipt()
    if args.self_test:
        if data.get("status") == "CODE_ONLY_NOT_APPROVED_FOR_DEPLOY":
            if data.get("approved_source_sha") or data.get("approved_components"):
                fail("code-only branch incorrectly includes deployment permission")
            print(data["change_id"] + "_CODE_ONLY_RELEASE_DENIAL_PASS")
        elif data.get("status") == "OWNER_EXPLICIT_DEPLOY_APPROVED":
            sha = str(data.get("approved_source_sha") or "")
            ref = str(data.get("owner_approval_reference") or "")
            components = data.get("approved_components", [])
            if (not re.fullmatch("[0-9a-f]{40}", sha)
                    or not ref.startswith("OWNER_EXPLICIT_" + data["change_id"] + "_DEPLOY_")
                    or not isinstance(components, list)
                    or not components or not set(components) <= COMPONENTS
                    or git("merge-base", "--is-ancestor", sha, "HEAD").returncode):
                fail("Owner release receipt does not match the tested code candidate")
            print(data["change_id"] + "_OWNER_RECEIPT_PREFLIGHT_PASS")
        else:
            fail("unrecognized release status")
        return
    if not args.component:
        fail("missing release component")
    if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
        fail("manual dispatch/PR is not Owner deployment approval")
    if data.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED":
        fail("CODE READY is not approved for deployment")
    if args.component not in data.get("approved_components", []):
        fail("component outside the explicitly approved release scope")
    if data["change_id"] == "D171":
        # E064: one existing official Production. Existing technical Beta IDs
        # and the old app signer are preserved for OTA / storage compatibility.
        if data.get("code_scope") != "D170_D171_SINGLE_OFFICIAL_PRODUCTION_V115_V140_WEB312":
            fail("D171 scope must be the Owner-approved single Production cutover")
        # E071/E074: existing one-Production pipeline; new Owner authorization
        # pins signed vc117 after vc116 FIELD FAIL without granting Stable.
        owner_release_codes = {
            "OWNER_EXPLICIT_D171_DEPLOY_20261021_D170_D171_UNIFIED_PRODUCTION_E062": 115,
            "OWNER_EXPLICIT_D171_DEPLOY_20261022_P0_ALERT_REPAIR_E071": 116,
            "OWNER_EXPLICIT_D171_DEPLOY_20261022_VC117_PICKER_REPORTER_REPAIR_E074": 117,
            "OWNER_EXPLICIT_D171_DEPLOY_20261022_VC116_FIELD_FAIL_VC117_E074": 117,
        }
        expected_android_code = owner_release_codes.get(data.get("owner_approval_reference"))
        if expected_android_code is None:
            fail("D171 explicit Owner authorization missing")
        if expected_android_code == 117:
            if data.get("approved_components") != ["android"]:
                fail("D171 E074 may release only the registered Android package")
            if data.get("resource_change") != "NONE_EXISTING_SIGNED_ANDROID_ONLY":
                fail("D171 E074 may not modify Worker, Agent, Firestore or provider resources")
            if data.get("e074_vc117", {}).get("approved_by_owner") is not True:
                fail("D171 E074 missing new Owner authorization")
            if data.get("e074_vc117", {}).get("source_ci_verified") is not True:
                fail("D171 E074 requires independent verified source/authority CI before Android OTA")
        else:
            if data.get("approved_components") != ["gateway", "worker", "agent", "android", "firestore"]:
                fail("D171 approved component list is not exact")
            if data.get("resource_change") != "EXISTING_REGISTERED_GATEWAY_WORKER_AGENT_ANDROID_AND_IDENTICAL_FIRESTORE_RULES_ONLY_NO_MIGRATION":
                fail("D171 may not create, migrate or rename provider resources")
        if (data.get("host") != "inventory.supra.cc.cd" or
                data.get("agent_build") != 140 or
                data.get("android_version_code") != expected_android_code or
                data.get("web_version") != "3.1.2"):
            fail("D171 exact signed fleet or single origin mismatch")
        # Existing Firestore workflow may reapply unchanged Rules from the
        # installed signed vc114 baseline, never introduce a policy migration.
        if args.component == "firestore":
            # D171-E019 signed-vc114 was published before the latest
            # accepted Firestore Rules snapshot. Pin exact canonical
            # D171 test/base Rules instead of incorrectly using vc114.
            baseline = git("rev-parse", "c8f58ce79f0ac4d59cdf547649e3f3a412e6d073^{commit}")
            if baseline.returncode:
                fail("D171 pinned accepted Rules provenance unavailable")
            rules = ("firebase/firestore.rules", "firebase/firestore.indexes.json", "firebase.json")
            if git("diff", "--quiet", baseline.stdout.strip(), "HEAD", "--", *rules).returncode:
                fail("D171 cannot change Firebase Rules from pinned accepted source")
        for key in ("legacy_android_package_preserved", "legacy_android_tag_manifest_preserved",
                    "existing_worker_and_durable_object_preserved", "legacy_hostname_preserved",
                    "staged_release_required", "gateway_first_readback_required",
                    "authority_continuity_pass", "product_ci_pass"):
            if data.get(key) is not True:
                fail("D171 missing mandatory pass/preservation gate " + key)
        for key in ("stable_worker_deploy_permission", "stable_deploy_permission",
                    "domain_reassignment_permission", "single_official_domain_detach_permission",
                    "new_provider_resource_permission", "field_pass", "physical_field_verified"):
            if data.get(key) is not False:
                fail("D171 cannot deploy old Stable, migrate, or claim untested FIELD PASS " + key)
    if data["change_id"] == "D170":
        scope = data.get("code_scope")
        if scope == "D170_OFFICIAL_BRANDING_LEGACY_OTA_PHASE1":
            if data.get("approved_components") != ["worker", "android"]:
                fail("D170 phase1 permits only existing Worker and signed Android")
            if data.get("owner_approval_reference") != "OWNER_EXPLICIT_D170_DEPLOY_20261018_SAFE_PRODUCTION_IDENTITY_PHASE1":
                fail("D170 requires exact Owner-approved phase-1 release scope")
            if data.get("resource_change") != "NONE_EXISTING_WORKER_AND_SIGNED_ANDROID":
                fail("D170 phase1 cannot change provider resources")
            if data.get("stable_deploy_permission") is not False:
                fail("D170 phase1 cannot activate the old Stable Worker")
            for key in ("legacy_android_package_preserved", "legacy_android_tag_manifest_preserved",
                        "existing_worker_and_durable_object_preserved"):
                if data.get(key) is not True:
                    fail("D170 phase1 must preserve existing signed identity/data: " + key)
        elif scope == "D170_OFFICIAL_DOMAIN_SAME_WORKER_PHASE2":
            if data.get("approved_components") != ["worker"]:
                fail("D170 official-host cutover permits only the current Worker")
            if data.get("owner_approval_reference") != "OWNER_EXPLICIT_D170_DEPLOY_20261018_OFFICIAL_SAME_WORKER_DOMAIN_PHASE2":
                fail("D170 official-host cutover requires exact Owner direction")
            change_scope = data.get("resource_change")
            if change_scope == "EXACT_OLD_STABLE_CUSTOM_DOMAIN_BINDING_ONLY__REATTACH_SAME_LIVE_WORKER__NO_DB_OR_WORKER_DELETE":
                if data.get("single_official_domain_detach_permission") is not True:
                    fail("D170 409 repair needs exact Owner approved registered Custom Domain binding detach")
            elif change_scope != "REASSIGN_EXISTING_STABLE_HOST_ONLY__SAME_WORKER_NO_DATABASE":
                fail("D170 phase2 cannot migrate any provider or data resource")
            if data.get("domain_reassignment_permission") is not True:
                fail("D170 official-host reassignment not approved")
            if data.get("stable_worker_deploy_permission") is not False:
                fail("D170 phase2 cannot deploy old Stable Worker")
            if data.get("existing_worker_and_durable_object_preserved") is not True:
                fail("D170 phase2 must preserve existing Worker/DO SQLite identity")
            if data.get("legacy_android_package_preserved") is not True:
                fail("D170 phase2 must leave installed signed Android package intact")
        elif scope == "D170_OFFICIAL_OAUTH_CALLBACK_PHASE3B":
            # Owner 2026-10-21: exact existing Worker OAuth callback release only.
            if data.get("approved_components") != ["worker"]:
                fail("D170 OAuth Phase3B must not release Agent, Android or other resources")
            if data.get("owner_approval_reference") != "OWNER_EXPLICIT_D170_DEPLOY_20261021_OFFICIAL_OAUTH_CALLBACK_PHASE3B":
                fail("D170 OAuth Phase3B requires explicit owner deployment approval")
            if data.get("d170_oauth_official_release_authorized") is not True:
                fail("D170 OAuth Phase3B receipt permission is absent")
            if data.get("resource_change") != "EXISTING_WORKER_OAUTH_CALLBACK_ONLY":
                fail("D170 OAuth Phase3B cannot migrate or provision resources")
            for key in ("legacy_android_package_preserved", "legacy_android_tag_manifest_preserved",
                        "existing_worker_and_durable_object_preserved"):
                if data.get(key) is not True:
                    fail("D170 OAuth Phase3B must preserve installed clients and storage: " + key)
            for key in ("domain_reassignment_permission", "single_official_domain_detach_permission",
                        "stable_worker_deploy_permission", "stable_deploy_permission"):
                if data.get(key) is not False:
                    fail("D170 OAuth Phase3B cannot detach hosts or activate Stable: " + key)
        elif scope == "D170_OFFICIAL_CLIENT_HOST_PHASE3":
            components = data.get("approved_components")
            if components == ["worker", "agent"]:
                # D170-E018: latest Owner command authorizes only finishing Agent v139.
                # The existing unchanged Worker must be verified before the EXE release.
                if data.get("owner_approval_reference") != "OWNER_EXPLICIT_D170_DEPLOY_20261019_AGENT139_ONLY":
                    fail("D170 v139 repair requires exact Owner Agent-only approval")
                if data.get("resource_change") != "NONE_EXISTING_WORKER_AGENT_ONLY":
                    fail("D170 v139 repair may not change Android, Firestore or provider resources")
            elif components == ["worker", "agent", "android"]:
                if data.get("owner_approval_reference") != "OWNER_EXPLICIT_D170_DEPLOY_20261019_OFFICIAL_CLIENT_HOST_PHASE3":
                    fail("D170 Phase3 requires Owner scoped client migration approval")
                if data.get("resource_change") != "NONE_EXISTING_WORKER_ANDROID_AGENT_ONLY":
                    fail("D170 Phase3 may not change databases, resource identities or custom domains")
            else:
                fail("D170 Phase3 approved components must remain exact")
            for key in ("legacy_android_package_preserved", "legacy_android_tag_manifest_preserved",
                        "existing_worker_and_durable_object_preserved"):
                if data.get(key) is not True:
                    fail("D170 Phase3 must preserve signed OTA identity and InventoryCore " + key)
            for key in ("domain_reassignment_permission", "single_official_domain_detach_permission",
                        "stable_worker_deploy_permission"):
                if data.get(key) is not False:
                    fail("D170 Phase3 cannot detach either host or activate Stable: " + key)
        else:
            fail("D170 release is not an explicitly reviewed phase")
        if not all(data.get(k) is True for k in ("authority_continuity_pass", "product_ci_pass")):
            fail("D170 phase requires source, authority and continuity PASS")
        if data.get("field_pass") is not False or data.get("physical_field_verified") is not False:
            fail("D170 release cannot manufacture hardware field PASS")
    if data["change_id"] == "D169":
        if data.get("stable_deploy_permission") is not False:
            fail("D169 Stable is owner-gated")
        d169_components = data.get("approved_components")
        new_scope = "D169_E046_V136_VC111_CROSS_NETWORK_BETA_STAGED"
        if data.get("code_scope") == new_scope:
            if d169_components != ["worker", "firestore", "agent", "android"]:
                fail("D169 integrated release components must be exact existing Beta resources")
            if data.get("owner_approval_reference") != (
                    "OWNER_EXPLICIT_D169_DEPLOY_20261018_E046_STAGED_BETA_AGENT_ANDROID_FIRESTORE"):
                fail("D169 integrated Beta deployment requires explicit Owner E046 authority")
            if data.get("field_pass") is not False or data.get("physical_field_verified") is not False:
                fail("D169 D170 dual-network physical test cannot be claimed PASS")
            if (data.get("field_release_mode") != "OWNER_ACCEPTED_RISK_FOR_BETA_STAGED_D170_FIELD_TEST"
                    or data.get("owner_field_acceptance_reference") !=
                    "OWNER_EXPLICIT_D169_20261018_E046_BETA_ROLLOUT_D170_TEST_DEFERRED"):
                fail("D169 staged Beta-only physical test deferral not documented")
            if data.get("stable_deploy_permission") is not False or data.get("resource_change") != "EXISTING_BETA_FIRESTORE_RULES_ONLY":
                fail("D169 release must not reach Stable or new resource")
            if data.get("cross_component_compatibility_ci") is not True:
                fail("D169 mixed-version and conditional recovery compatibility CI must PASS")
        elif data.get("code_scope") == "D169_E061_ANDROID_RESUME_BETA_ONLY":
            if d169_components != ["android"]:
                fail("D169 E061 permits only the existing scoped Android Beta package")
            if data.get("owner_approval_reference") != (
                    "OWNER_EXPLICIT_D169_DEPLOY_20261018_E061_ANDROID_RESUME_BETA"):
                fail("D169 E061 requires explicit Owner Android Beta authorization")
            if data.get("stable_deploy_permission") is not False:
                fail("D169 E061 Stable remains Owner-gated")
            if data.get("resource_change") != "NONE_ANDROID_BETA_ONLY_EXISTING_RUNTIME":
                fail("D169 E061 may not provision or redeploy other providers")
            if data.get("field_pass") is not False or data.get("physical_field_verified") is not False:
                fail("D169 E061 cannot claim real-device field PASS from CI")
            if (data.get("field_release_mode") != "OWNER_ACCEPTED_RISK_FOR_ANDROID_BETA_FIELD_TEST"
                    or data.get("owner_field_acceptance_reference") !=
                    "OWNER_EXPLICIT_D169_20261018_E061_ANDROID_BETA_FIELD_TRIAL"):
                fail("D169 E061 Beta-only field-trial boundary missing")
            if data.get("cross_component_compatibility_ci") is not True:
                fail("D169 E061 must preserve deployed Agent v138 and Firestore ACK compatibility")
        elif data.get("code_scope") == "D169_E057_VPS_ACCOUNT_FIRST_DUAL_OWNER_AGENT138":
            if d169_components != ["worker", "firestore", "agent"]:
                fail("D169 VPS account-first Beta release permits only existing Worker/Firestore/Agent")
            if data.get("owner_approval_reference") != (
                    "OWNER_EXPLICIT_D169_DEPLOY_20261018_E057_VPS_ACCOUNT_FIRST"):
                fail("D169 VPS account-first release requires exact Owner E057 authorization")
            if data.get("stable_deploy_permission") is not False or data.get("resource_change") != "EXISTING_BETA_FIRESTORE_RULES_ONLY":
                fail("D169 VPS account-first must not deploy Stable or new resources")
            if data.get("field_pass") is not False or data.get("physical_field_verified") is not False:
                fail("D169 VPS account-first must not fabricate field PASS")
            if (data.get("field_release_mode") != "OWNER_ACCEPTED_RISK_FOR_BETA_E057_FIELD_VALIDATION"
                    or data.get("owner_field_acceptance_reference") !=
                    "OWNER_EXPLICIT_D169_20261018_E057_BETA_ROLLOUT_WITH_FIELD_PENDING"):
                fail("D169 E057 Beta field-trial limitation missing")
            if data.get("cross_component_compatibility_ci") is not True:
                fail("D169 E057 authenticated VPS and single-owner handoff tests not PASS")
        elif data.get("code_scope") == "D169_E054_VPS_OTP_ONLY_BETA_WORKER_GATEWAY_AGENT137":
            if d169_components != ["worker", "gateway", "agent"]:
                fail("D169 VPS OTP release limited to existing Worker, Gateway and Agent")
            if data.get("owner_approval_reference") != "OWNER_EXPLICIT_D169_DEPLOY_20261018_E054_VPS_OTP_ONLY_BETA":
                fail("D169 VPS OTP release requires exact E054 Owner authorization")
            if data.get("field_pass") is not False or data.get("physical_field_verified") is not False:
                fail("D169 VPS OTP field acceptance not proven")
            if data.get("stable_deploy_permission") is not False:
                fail("D169 VPS OTP Stable not authorized")
            if data.get("resource_change") != "NONE_EXISTING_BETA_ONLY":
                fail("D169 VPS OTP release must not provision new resources")
            if data.get("cross_component_compatibility_ci") is not True:
                fail("D169 VPS OTP Agent/Worker/Gateway regression gate missing")
        else:
            if d169_components not in (["worker"], ["worker", "agent"]):
                fail("D169 legacy component set must be an exact Owner-approved Beta release scope")
            if d169_components == ["worker", "agent"]:
                scopes = {
                    "D169_AGENT_V134_WEB_TAB_TOGGLE_WITH_UNCHANGED_BETA_WORKER",
                    "D169_AGENT_V135_NOT_PASS_TAB_LAYOUT_REPAIR_WITH_UNCHANGED_BETA_WORKER",
                }
                if data.get("code_scope") not in scopes:
                    fail("D169 Agent legacy release scope is not exact")
                if data.get("code_scope") == "D169_AGENT_V135_NOT_PASS_TAB_LAYOUT_REPAIR_WITH_UNCHANGED_BETA_WORKER":
                    if data.get("not_pass_repair") != "D169-E027_V134_TAB_HEADER_OVERLAPPED":
                        fail("D169 v135 must be a bounded NOT PASS correction of v134")
                if data.get("field_pass") is not False or data.get("physical_field_verified") is not False:
                    fail("D169 unverified physical tests must not be marked PASS")
                if (data.get("field_release_mode") != "OWNER_ACCEPTED_RISK_FOR_BETA_FIELD_VALIDATION"
                        or data.get("owner_field_acceptance_reference")
                            != "OWNER_EXPLICIT_D169_20261016_AGENT_V134_BETA_DIRECT_V132_UPGRADE"):
                    fail("D169 v134 field-trial release needs exact Owner acceptance")
        if not all(data.get(key) is True for key in ("authority_continuity_pass", "product_ci_pass")):
            fail("D169 source and authority/continuity CI not approved")
    if data["change_id"] == "D168":
        if data.get("stable_deploy_permission") is not False:
            fail("D168 Stable must remain Owner-gated")
        if not all(data.get(key) is True for key in
                   ("authority_continuity_pass", "product_ci_pass")):
            fail("D168 source, CI or continuity evidence missing")
        # Owner's explicit D168 Beta field-test release waiver is NOT a claim
        # that WLAN, WMS, real-PDA ACK or provider metering were physically tested.
        # A rollout for Owner field acceptance is allowed ONLY with the exact
        # recorded Owner waiver, on the existing scoped Beta (never Stable).
        field_verified = data.get("field_pass") is True
        owner_field_trial = (
            data.get("field_pass") is False
            and data.get("physical_field_verified") is False
            and data.get("field_release_mode") == "OWNER_ACCEPTED_RISK_FOR_BETA_FIELD_VALIDATION"
            and data.get("owner_field_acceptance_reference")
                == "OWNER_EXPLICIT_D168_20261014_BETA_FIELD_TEST_AT_RELEASE"
        )
        if not (field_verified or owner_field_trial):
            fail("D168 neither verified field proof nor explicit Owner field-trial release acceptance")
    sha = str(data.get("approved_source_sha") or "")
    ref = str(data.get("owner_approval_reference") or "")
    if not re.fullmatch("[0-9a-f]{40}", sha) or not ref.startswith("OWNER_EXPLICIT_" + data["change_id"] + "_DEPLOY_"):
        fail("approved code SHA or owner approval reference absent")
    if git("cat-file", "-e", sha + "^{commit}").returncode:
        fail("approved code SHA missing; fetch full history")
    if git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
        fail("approved code not an ancestor of release")
    # D171-E078: vc117 is Android-only, but parallel Owner-approved D172
    # independently deployed the current Worker after the approved Android SHA.
    # Verify BOTH immutable authorities instead of comparing two unrelated
    # release scopes and incorrectly rejecting their already-approved diff.
    if (data["change_id"] == "D171" and args.component == "android"
            and ref == "OWNER_EXPLICIT_D171_DEPLOY_20261022_VC117_PICKER_REPORTER_REPAIR_E074"
            and data.get("approved_components") == ["android"]):
        d172_deployed_main = "6c39e1f376e9181e8740201e037965d77cf94056"
        if git("merge-base", "--is-ancestor", d172_deployed_main, "HEAD").returncode:
            fail("D171 vc117 cannot release without the verified D172 Worker baseline")
        # The Android source must remain byte-for-byte the approved vc117
        # candidate; changes in the parallel OBPP app are never authorized here.
        if git("diff", "--quiet", sha, "HEAD", "--", "android/").returncode:
            fail("D171 vc117 Android differs from Owner-approved source")
        immutable_runtime = ("service/", "web/", "relay-agent/",
                             "relay-agent-webview2-host/", "firebase/",
                             "functions/", "ops/apps-script/", "obpp1291/",
                             "ops/project-scope.json", "ops/resource-registry.json")
        if git("diff", "--quiet", d172_deployed_main, "HEAD", "--",
               *immutable_runtime).returncode:
            fail("D171 vc117 cannot alter the current D172-deployed runtime")
        print("D171_E078_TWO_AUTHORITIES_ANDROID_EXACT_AND_D172_RUNTIME_IMMUTABLE_PASS")
    else:
        delta = git("diff", "--name-only", sha, "HEAD", "--", *PROTECTED)
        if delta.returncode or delta.stdout.strip():
            fail("executable scope differs from Owner-approved code candidate")
    print(data["change_id"] + "_OWNER_RELEASE_GATE_PASS " + args.component + " " + sha[:12])


if __name__ == "__main__":
    main()
