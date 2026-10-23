#!/usr/bin/env python3
"""D173-E005 Owner-scoped ONE production Email Service binding release gate.

Only authorizes the existing production Worker to receive an inert no-reply
binding while existing Gmail remains the operational sender. No D172 paths,
new workers, stable resources, or secrets may be changed.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PROTECTED = (
    "service/", "web/", "android/", "relay-agent/", "firebase/",
    "functions/", ".github/workflows/", "tools/",
    "ops/project-scope.json", "ops/resource-registry.json",
)

def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)

def deny(reason: str) -> None:
    raise SystemExit("D173_EMAIL_RELEASE_DENIED: " + reason)

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", choices=["worker"], required=True)
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    receipt_path = ROOT / "ops/d173-email-release-authorization.json"
    if not receipt_path.is_file():
        deny("missing release receipt")
    a = json.loads(receipt_path.read_text())
    expected = {
        "change_id": "D173",
        "checkpoint": "D173-E005",
        "phase": "EMAIL_BINDING_ONLY_GMAIL_REMAINS_ACTIVE",
        "status": "OWNER_EXPLICIT_DEPLOY_APPROVED",
        "owner_approval_reference": "OWNER_2026_10_23_D173_E005_NO_REPLY_FOUR_TRANSACTIONAL_TYPES",
        "approved_components": ["worker"],
        "resource_key": "worker-beta",
        "binding": "EMAIL",
        "from_address": "no-reply@supra.cc.cd",
        "sender_activated": False,
        "new_worker": False,
        "stable_mutation": False,
        "d172_business_mutation": False,
    }
    for k, v in expected.items():
        if a.get(k) != v:
            deny("receipt mismatch: " + k)
    pin = str(a.get("approved_source_sha", ""))
    base = str(a.get("accepted_main_base_sha", ""))
    if not re.fullmatch("[0-9a-f]{40}", pin) or not re.fullmatch("[0-9a-f]{40}", base):
        deny("immutable source pin/base missing")
    if git("merge-base", "--is-ancestor", base, pin).returncode:
        deny("reviewed source does not descend from accepted main")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("reviewed source pin not contained in commit")
    if git("diff", "--quiet", pin, "HEAD", "--", *PROTECTED).returncode:
        deny("protected source changed after approved source pin")
    cfg = (ROOT / "service/wrangler.beta.toml").read_text()
    if (cfg.count('name = "supra-inventory-beta"') != 1 or
        cfg.count('[[send_email]]') != 1 or
        'allowed_sender_addresses = ["no-reply@supra.cc.cd"]' not in cfg or
        re.search(r'^PROJECT_MAIL_SENDER\s*=\s*""\s*$', cfg, re.M) is None or
        'pattern = "inventory.supra.cc.cd"' not in cfg):
        deny("existing production Worker binding/empty sender invalid")
    scope = json.loads((ROOT / "ops/project-scope.json").read_text())
    binding = next((x for x in scope["resources"] if x.get("key") == "cf-email-sending-prod"), None)
    if not binding or binding.get("worker_resource_key") != "worker-beta" or binding.get("allowed_sender_addresses") != ["no-reply@supra.cc.cd"]:
        deny("provider binding not canonically scoped")
    journal = json.loads((ROOT / "ops/change-continuity/D173.json").read_text())
    if not any(x.get("id") == "D173-E005" and x.get("owner_approval") is True for x in journal["entries"]):
        deny("Owner approval missing")
    # Testable on PR as a source preflight, but only a protected push can deploy.
    if not args.preflight and (os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main"):
        deny("only protected main push may deploy, never PR or manual dispatch")
    print("D173_E005_ONE_WORKER_EMAIL_BINDING_RELEASE_PASS__GMAIL_SENDER_STAYS_ACTIVE")

if __name__ == "__main__":
    main()
