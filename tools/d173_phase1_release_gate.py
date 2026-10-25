#!/usr/bin/env python3
"""D173 Phase1 independent Owner release gate. Never uses D171/D172 receipts."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-phase1-release-authorization.json"
COMPONENTS = ("worker", "agent", "android")
PROTECTED = (
    "service/", "web/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "functions/", "firebase/", "firebase.json", "ops/apps-script/", "obpp1291/",
    ".github/workflows/", "tools/", "ops/project-scope.json",
    "ops/resource-registry.json", "pda-management/",
)
ISOLATED = ("obpp1291/", "firebase/", "firebase.json", "ops/apps-script/",
            "ops/project-scope.json", "ops/resource-registry.json")


def fail(reason):
    raise SystemExit("D173_PHASE1_RELEASE_DENIED: " + reason)


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=COMPONENTS, required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        data = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        fail("release authorization missing or malformed")
    if (data.get("change_id") != "D173" or data.get("checkpoint") != "D173-E026"
        or data.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or data.get("owner_approval_reference") !=
                "OWNER_EXPLICIT_D173_DEPLOY_20261025_PHASE1_A_C_BOUNDED_LOG"
        or data.get("approved_components") != list(COMPONENTS)):
        fail("exact Owner scope/component/decision receipt mismatch")
    if data.get("d172_lifecycle") != "PENDING_HOLD" or data.get("stable_deploy_permission") is not False:
        fail("D172 independence/Stable gate violated")
    if any(data.get(flag) is not False for flag in (
        "d172_ota_mutation", "d172_business_mutation", "firebase_rules_mutation",
        "new_provider_resource", "field_pass", "owner_pass")):
        fail("forbidden provider/business mutation or unproven FIELD PASS")
    pin = str(data.get("approved_source_sha") or "")
    if not re.fullmatch(r"[0-9a-f]{40}", pin):
        fail("source pin missing")
    if data.get("source_ci_verified") is not True or data.get("source_ci_sha") != pin:
        fail("exact approved source CI results not recorded")
    if git("cat-file", "-e", pin + "^{commit}").returncode:
        fail("tested source SHA not available")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        fail("approved source is not an ancestor; merge PR without squashing")
    if git("diff", "--quiet", pin, "HEAD", "--", *PROTECTED).returncode:
        fail("protected code/workflow drift after exact Owner source pin")
    baseline = str(data.get("accepted_main_base_sha") or "")
    if not re.fullmatch(r"[0-9a-f]{40}", baseline) or git("merge-base", "--is-ancestor", baseline, "HEAD").returncode:
        fail("accepted main baseline absent")
    if git("diff", "--quiet", baseline, "HEAD", "--", *ISOLATED).returncode:
        fail("D172/private Sheet/Firebase/Gateway/provider source drift")
    agent_version = (ROOT / "relay-agent/VERSION").read_text().strip()
    agent_config = (ROOT / "relay-agent/AgentConfig.cs").read_text()
    agent_project = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text()
    if (agent_version != "141" or "AgentBuild = 141;" not in agent_config
        or "<AssemblyVersion>0.141.0.0</AssemblyVersion>" not in agent_project
        or "<FileVersion>0.141.0.0</FileVersion>" not in agent_project):
        fail("Agent v141 source identity mismatch")
    notes = json.loads((ROOT / "android/release-notes.json").read_text())
    if (len(notes.get("release_notes", [])) != 3
        or not all(x.startswith("vc118:") for x in notes["release_notes"])):
        fail("Android vc118 release notes mismatch")
    config = (ROOT / "service/wrangler.beta.toml").read_text()
    if ('name = "supra-inventory-beta"' not in config
        or 'pattern = "inventory.supra.cc.cd"' not in config
        or 'pattern = "inventory-beta.supra.cc.cd"' in config
        or 'class_name = "InventoryCore"' not in config):
        fail("existing official Worker/DO identity mismatch")
    if args.preflight:
        print("D173_E026_SOURCE_PREFLIGHT_PASS " + args.component + " " + pin[:12])
        return
    if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
        fail("only protected main push can release")
    subject = git("log", "-1", "--format=%s")
    if subject.returncode or not subject.stdout.strip().startswith("D173-E026_PHASE1_RELEASE:"):
        fail("protected merge is not this exact Owner-approved D173 release")
    print("D173_E026_OWNER_RELEASE_GATE_PASS " + args.component + " " + pin[:12])


if __name__ == "__main__":
    main()
