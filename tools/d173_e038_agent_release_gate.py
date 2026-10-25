#!/usr/bin/env python3
"""D173 E038: fail-closed Owner-approved, exact-source Agent v144 release only."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-e038-agent-release-authorization.json"
MARKER = "D173-E038_AGENT_ONLY_RELEASE:"
PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/", "service/", "web/",
    "android/", "functions/", "firebase/", "obpp1291/", "pda-management/",
    ".github/workflows/", "tools/", "ops/project-scope.json",
    "ops/resource-registry.json",
)

def deny(message):
    raise SystemExit("D173_E038_AGENT_RELEASE_DENIED: " + message)

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("agent",), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        approval = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        deny("missing or malformed E038 owner receipt")
    if (approval.get("change_id") != "D173"
        or approval.get("checkpoint") != "D173-E038"
        or approval.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or approval.get("owner_approval_reference") != "OWNER_EXPLICIT_D173_E038_AGENT144_SAMPLE2_CODE_AND_RELEASE_20261025"
        or approval.get("approved_components") != ["agent"]
        or approval.get("agent_target_version") != 144):
        deny("Agent-only Owner approval mismatch")
    if (approval.get("d172_lifecycle") != "PENDING_HOLD"
        or approval.get("stable_deploy_permission") is not False
        or approval.get("field_pass") is not False
        or approval.get("owner_pass") is not False
        or approval.get("worker_mutation") is not False
        or approval.get("android_mutation") is not False):
        deny("unauthorized D172/Stable/shared-scope or false field pass")
    sha = str(approval.get("approved_source_sha") or "")
    if (not re.fullmatch(r"[0-9a-f]{40}", sha)
        or approval.get("source_ci_verified") is not True
        or approval.get("source_ci_sha") != sha
        or int(approval.get("required_ci_success") or 0) < 20
        or approval.get("required_ci_failed") != 0):
        deny("missing exact-source all-green PR CI proof")
    if git("cat-file", "-e", sha+"^{commit}").returncode:
        deny("source SHA missing")
    if git("merge-base", "--is-ancestor", sha, "HEAD").returncode:
        deny("released HEAD must descend from Owner tested source")
    if git("diff", "--quiet", sha, "HEAD", "--", *PROTECTED).returncode:
        deny("protected source or workflow drift after CI pin")
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "144":
        deny("Agent VERSION not 144")
    agent = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    project = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if ("AgentBuild = 144;" not in agent
        or "<AssemblyVersion>0.144.0.0</AssemblyVersion>" not in project
        or "<FileVersion>0.144.0.0</FileVersion>" not in project):
        deny("signed Agent144 version identity mismatch")
    if args.preflight:
        print("D173_E038_AGENT_SOURCE_PREFLIGHT_PASS pin=" + sha[:12])
        return
    if (os.environ.get("GITHUB_EVENT_NAME") != "push"
        or os.environ.get("GITHUB_REF") != "refs/heads/main"):
        deny("not protected main push")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("Owner E038 release marker missing from protected main commit")
    print("D173_E038_AGENT144_RELEASE_OWNER_GATE_PASS pin=" + sha[:12])

if __name__ == "__main__":
    main()
