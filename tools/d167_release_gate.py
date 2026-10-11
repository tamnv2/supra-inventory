#!/usr/bin/env python3
"""D167 fail-closed Beta release approval: branch PR/CI is NOT deployment."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = {"worker", "gateway", "firestore", "rtdb", "functions", "android", "agent"}
PROTECTED = ("service/", "web/", "android/", "relay-agent/", "functions/",
             "firebase/", "firebase.json", "ops/apps-script/", ".github/workflows/",
             "tools/", "ops/project-scope.json", "ops/resource-registry.json")


def fail(message):
    raise SystemExit("D167_OWNER_DEPLOY_GATE_DENIED: " + message)


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=False)


def receipt():
    try:
        data = json.loads((ROOT / "ops/d167-release-authorization.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        fail("missing or corrupt authorization receipt")
    if data.get("change_id") != "D167":
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
            print("D167_CODE_ONLY_RELEASE_DENIAL_PASS")
        elif data.get("status") == "OWNER_EXPLICIT_DEPLOY_APPROVED":
            sha = str(data.get("approved_source_sha") or "")
            ref = str(data.get("owner_approval_reference") or "")
            components = data.get("approved_components", [])
            if (not re.fullmatch("[0-9a-f]{40}", sha)
                    or not ref.startswith("OWNER_EXPLICIT_D167_DEPLOY_")
                    or not isinstance(components, list)
                    or not components or not set(components) <= COMPONENTS
                    or git("merge-base", "--is-ancestor", sha, "HEAD").returncode):
                fail("Owner release receipt does not match the tested code candidate")
            print("D167_OWNER_RECEIPT_PREFLIGHT_PASS")
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
    sha = str(data.get("approved_source_sha") or "")
    ref = str(data.get("owner_approval_reference") or "")
    if not re.fullmatch("[0-9a-f]{40}", sha) or not ref.startswith("OWNER_EXPLICIT_D167_DEPLOY_"):
        fail("approved code SHA or owner approval reference absent")
    if git("cat-file", "-e", sha + "^{commit}").returncode:
        fail("approved code SHA missing; fetch full history")
    if git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
        fail("approved code not an ancestor of release")
    delta = git("diff", "--name-only", sha, "HEAD", "--", *PROTECTED)
    if delta.returncode or delta.stdout.strip():
        fail("executable scope differs from Owner-approved code candidate")
    print("D167_OWNER_RELEASE_GATE_PASS " + args.component + " " + sha[:12])


if __name__ == "__main__":
    main()
