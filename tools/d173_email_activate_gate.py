#!/usr/bin/env python3
"""D173-E010 exact-source Owner-gated sender activation, on existing Worker only."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {
    "service/wrangler.beta.toml",
    "tests/d173-no-reply-otp.test.mjs",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/verify-d171-agent-code-only.yml",
    ".github/workflows/d173-email-sender-guard.yml",
    ".github/workflows/d173-email-delivery-canary.yml",
    ".github/workflows/d173-email-quota-readback.yml",
    "tools/d167_release_gate.py",
    "tools/d173_email_activate_gate.py",
    "ops/d173-email-sender-activation-authorization.json",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
    "ops/project-scope.json",
    "ops/resource-registry.json",
    "docs/OWNER_DECISIONS.md",
    "docs/specs/AUTH_RBAC.md",
    "docs/specs/ACCEPTANCE_TESTING.md",
}
PROTECTED = [
    "service/", "web/", "android/", "relay-agent/", "firebase/", "functions/",
    "tests/", ".github/workflows/", "tools/", "ops/project-scope.json",
    "ops/resource-registry.json", "ops/change-continuity/D173.json",
]

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)

def fail(why):
    raise SystemExit("D173_EMAIL_ACTIVATION_DENIED: " + why)

def check():
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", choices=["worker"], required=True)
    ap.add_argument("--preflight", action="store_true")
    args = ap.parse_args()
    path = ROOT / "ops/d173-email-sender-activation-authorization.json"
    if not path.exists():
        fail("missing activation receipt")
    r = json.loads(path.read_text())
    expected = {
        "change_id":"D173", "checkpoint":"D173-E010", "phase":"FOUR_TRANSACTIONAL_MAIL_SENDER_ACTIVATION",
        "status":"OWNER_EXPLICIT_DEPLOY_APPROVED",
        "owner_approval_reference":"OWNER_2026_10_23_D173_E005_NO_REPLY_FOUR_TRANSACTIONAL_TYPES",
        "resource_key":"worker-beta", "approved_components":["worker"],
        "from_address":"no-reply@supra.cc.cd", "sender_activated":True,
        "new_worker":False, "stable_mutation":False, "d172_business_mutation":False,
        "provider_canary_run":39975522367, "provider_quota_read_run":39977013883,
        "daily_quota_verified":200,
    }
    for k,v in expected.items():
        if r.get(k) != v:
            fail("receipt mismatch: " + k)
    base = r.get("accepted_main_base_sha","")
    pin = r.get("approved_source_sha","")
    if not (re.fullmatch(r"[0-9a-f]{40}",base) and re.fullmatch(r"[0-9a-f]{40}",pin)):
        fail("exact SHAs not pinned")
    if git("merge-base","--is-ancestor",base,pin).returncode:
        fail("pinned source not descended from accepted main")
    if git("merge-base","--is-ancestor",pin,"HEAD").returncode:
        fail("pinned source not included in current commit")
    if git("diff","--quiet",pin,"HEAD","--",*PROTECTED).returncode:
        fail("reviewed protected source changed after pin")
    changed = set(git("diff","--name-only",base,pin).stdout.splitlines())
    if not changed or changed - ALLOWED:
        fail("unreviewed changed paths: " + ",".join(sorted(changed-ALLOWED)))
    if "service/wrangler.beta.toml" not in changed:
        fail("no sender activation config change")
    old = git("show",base + ":service/wrangler.beta.toml")
    if old.returncode:
        fail("missing accepted production config")
    old_cfg = old.stdout
    prior = '# Activation is separate: PROJECT_MAIL_SENDER stays unset until a verified delivery test.'
    current = '# D173-E010: E007 real Gmail receipt and E008 200/day quota verified; sender activation scoped to four transactional mail types.'
    assert old_cfg.count(prior)==1 and old_cfg.count('PROJECT_MAIL_SENDER = ""')==1
    proposed = old_cfg.replace(prior,current).replace('PROJECT_MAIL_SENDER = ""','PROJECT_MAIL_SENDER = "no-reply@supra.cc.cd"')
    cfg = (ROOT/"service/wrangler.beta.toml").read_text()
    if cfg != proposed:
        fail("production config changed beyond approved sender flag")
    if cfg.count('[[send_email]]')!=1 or cfg.count('allowed_sender_addresses = ["no-reply@supra.cc.cd"]')!=1:
        fail("email sender binding was modified")
    if cfg.count('name = "supra-inventory-beta"')!=1 or 'pattern = "inventory.supra.cc.cd"' not in cfg:
        fail("existing production Worker identity/domain mismatch")
    scope = json.loads((ROOT/"ops/project-scope.json").read_text())
    if not any(x.get("key")=="cf-email-sending-prod" and x.get("worker_resource_key")=="worker-beta" for x in scope.get("resources",[])):
        fail("sender account is out of registered scope")
    journal=json.loads((ROOT/"ops/change-continuity/D173.json").read_text())
    if not any(x.get("id")=="D173-E005" and x.get("owner_approval") is True for x in journal["entries"]):
        fail("Owner E005 approval absent")
    if not any(x.get("id")=="D173-E010" and x.get("kind")=="OWNER_COMMAND" for x in journal["entries"]):
        fail("D173 E010 activation checkpoint absent")
    if not args.preflight and (os.getenv("GITHUB_EVENT_NAME")!="push" or os.getenv("GITHUB_REF")!="refs/heads/main"):
        fail("activation only from protected main push")
    print("D173_E010_PINNED_SENDER_ACTIVATION_RELEASE_PASS__EXISTING_WORKER_ONLY")

if __name__ == "__main__":
    check()
