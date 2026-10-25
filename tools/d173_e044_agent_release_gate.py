#!/usr/bin/env python3
"""D173 E044: fail-closed Owner-approved, exact-source Agent v145 release only."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-e044-agent-release-authorization.json"
MARKER = "D173-E044_AGENT_ONLY_RELEASE:"
PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/", "service/", "web/",
    "android/", "functions/", "firebase/", "obpp1291/", "pda-management/",
    ".github/workflows/", "tools/", "ops/project-scope.json",
    "ops/resource-registry.json",
)

def deny(message):
    raise SystemExit("D173_E044_AGENT_RELEASE_DENIED: " + message)

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
        deny("missing or malformed E044 owner receipt")
    if (approval.get("change_id") != "D173"
        or approval.get("checkpoint") != "D173-E044"
        or approval.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or approval.get("owner_approval_reference") != "OWNER_EXPLICIT_D173_E044_AGENT145_THEME_REPAIR_RELEASE_20261025"
        or approval.get("approved_components") != ["agent"]
        or approval.get("agent_target_version") != 145):
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
    # E043 Web331 latest main baseline: no shared/runtime sources in Agent145.
    if git("diff", "--quiet",
           "32f6944b4af6a54492c15ff455b1a4aed75ab060", "HEAD", "--",
           "service/", "web/", "android/", "functions/", "firebase/",
           "firebase.json", "ops/apps-script/", "obpp1291/").returncode:
        deny("shared Web331/Worker/Android/D172 source drift")

    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "145":
        deny("Agent VERSION not 144")
    agent = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    project = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    if ("AgentBuild = 145;" not in agent
        or "<AssemblyVersion>0.145.0.0</AssemblyVersion>" not in project
        or "<FileVersion>0.145.0.0</FileVersion>" not in project):
        deny("signed Agent145 version identity mismatch")
    if args.preflight:
        print("D173_E044_AGENT_SOURCE_PREFLIGHT_PASS pin=" + sha[:12])
        return
    if (os.environ.get("GITHUB_EVENT_NAME") != "push"
        or os.environ.get("GITHUB_REF") != "refs/heads/main"):
        deny("not protected main push")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("Owner E038 release marker missing from protected main commit")
    print("D173_E043_AGENT145_RELEASE_OWNER_GATE_PASS pin=" + sha[:12])

if __name__ == "__main__":
    main()
