#!/usr/bin/env python3
"""D173 E036: Owner-approved Web 3.3.0 / Agent143 / Android120 source-pinned release."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-e036-ui-release-authorization.json"
MARKER = "D173-E036_UI_RELEASE:"
PROTECTED = ("service/", "web/", "android/", "relay-agent/", "relay-agent-webview2-host/",
             "functions/", "firebase/", "firebase.json", "ops/apps-script/", "obpp1291/",
             ".github/workflows/", "tools/", "ops/project-scope.json",
             "ops/resource-registry.json", "pda-management/")
ISOLATED = ("obpp1291/", "service/src/obpp1291-*.ts", "firebase/", "firebase.json",
            "ops/apps-script/", "ops/project-scope.json", "ops/resource-registry.json",
            "pda-management/")
BASE = "8fb0fab3e71810fbdb0899cceefe367c541602f5"

def fail(msg):
    raise SystemExit("D173_E036_RELEASE_DENIED: " + msg)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--component", required=True, choices=("worker", "agent", "android"))
    p.add_argument("--preflight", action="store_true")
    args = p.parse_args()
    try:
        d = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        fail("missing/malformed Owner receipt")
    if (d.get("change_id") != "D173" or d.get("checkpoint") != "D173-E036"
        or d.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or d.get("owner_approval_reference") != "OWNER_EXPLICIT_D173_E036_GLOBAL_WEB_AGENT_ANDROID_DEPLOY_20261025"
        or d.get("approved_components") != ["worker", "agent", "android"]):
        fail("wrong scoped Owner authorization")
    if (d.get("production_host") != "inventory.supra.cc.cd"
        or d.get("existing_worker_name") != "supra-inventory-beta"
        or d.get("existing_core_class") != "InventoryCore"
        or d.get("d172_lifecycle") != "PENDING_HOLD"
        or d.get("stable_deploy_permission") is not False):
        fail("registered runtime / D172 or Stable policy mismatch")
    for flag in ("d172_business_mutation", "d172_ota_mutation", "firebase_rules_mutation",
                 "new_provider_resource", "field_pass", "owner_pass"):
        if d.get(flag) is not False:
            fail("forbidden scope or invented acceptance " + flag)
    pin = str(d.get("approved_source_sha") or "")
    if (not re.fullmatch(r"[0-9a-f]{40}", pin)
        or d.get("source_ci_verified") is not True
        or d.get("source_ci_sha") != pin
        or int(d.get("required_ci_success") or 0) < 32
        or d.get("required_ci_failed") != 0):
        fail("exact source CI proof absent")
    if git("cat-file", "-e", pin + "^{commit}").returncode or git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        fail("source SHA is missing or not an ancestor")
    if git("diff", "--quiet", pin, "HEAD", "--", *PROTECTED).returncode:
        fail("protected source/workflow drift after tested pin")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        fail("current supported main baseline absent")
    if git("diff", "--quiet", BASE, "HEAD", "--", *ISOLATED).returncode:
        fail("independent D172/Gateway/Rules/resource drift")
    config = (ROOT / "service/wrangler.beta.toml").read_text(encoding="utf-8")
    if ('name = "supra-inventory-beta"' not in config
        or 'pattern = "inventory.supra.cc.cd"' not in config
        or 'pattern = "inventory-beta.supra.cc.cd"' in config
        or 'class_name = "InventoryCore"' not in config):
        fail("official existing Worker identity mismatch")
    version = (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip()
    agent = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    proj = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if (version != "143" or "AgentBuild = 143;" not in agent
        or "<AssemblyVersion>0.143.0.0</AssemblyVersion>" not in proj
        or "<FileVersion>0.143.0.0</FileVersion>" not in proj):
        fail("Agent143 mismatch")
    notes = json.loads((ROOT / "android/release-notes.json").read_text(encoding="utf-8"))
    if not 1 <= len(notes.get("release_notes", [])) <= 5 or not all(
        str(n).startswith("vc120:") for n in notes["release_notes"]):
        fail("Android120 release notes mismatch")
    if 'WEB_VERSION = "3.3.0"' not in (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8"):
        fail("Web330 presentation mismatch")
    if args.preflight:
        print("D173_E036_OWNER_SOURCE_PREFLIGHT_PASS " + args.component + " " + pin[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        fail("not a protected main push")
    subject = git("log", "-1", "--format=%s").stdout.strip()
    if not subject.startswith(MARKER):
        fail("new Owner release marker not on main commit")
    print("D173_E036_OWNER_RELEASE_PASS " + args.component + " " + pin[:12])

if __name__ == "__main__":
    main()
