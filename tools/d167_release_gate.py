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
    path = ROOT / "ops/d168-release-authorization.json"
    if not path.is_file():
        path = ROOT / "ops/d167-release-authorization.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        fail("missing or corrupt authorization receipt")
    if data.get("change_id") not in ("D167", "D168"):
        fail("wrong change id")
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=sorted(COMPONENTS))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
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
    event = os.getenv("GITHUB_EVENT_NAME")
    if os.getenv("GITHUB_REF") != "refs/heads/main":
        fail("Beta release requires main branch")
    if event == "workflow_dispatch":
        # GitHub connector merges may not trigger Actions push runs.
        # Manual dispatch is allowed only as an Owner-triggered recovery path
        # after D168's SHA-bound, CI-verified, scoped Beta receipt is committed.
        if (data.get("change_id") != "D168"
                or os.getenv("GITHUB_ACTOR") != "tamnv2"
                or os.getenv("GITHUB_REPOSITORY") != "tamnv2/supra-inventory"):
            fail("manual release requires exact D168 repository Owner on main")
    elif event != "push":
        fail("release requires main push or explicit Owner dispatch")
    if data.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED":
        fail("CODE READY is not approved for deployment")
    if args.component not in data.get("approved_components", []):
        fail("component outside the explicitly approved release scope")
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
    delta = git("diff", "--name-only", sha, "HEAD", "--", *PROTECTED)
    if delta.returncode or delta.stdout.strip():
        fail("executable scope differs from Owner-approved code candidate")
    print(data["change_id"] + "_OWNER_RELEASE_GATE_PASS " + args.component + " " + sha[:12])


if __name__ == "__main__":
    main()
