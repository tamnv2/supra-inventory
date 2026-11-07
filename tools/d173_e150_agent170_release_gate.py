#!/usr/bin/env python3
"""D173-E150 Agent170 + Host13: scoped Owner-gated, exact-source release.

PR preflight is CODE ONLY; main release requires explicit signed release marker,
reviewed Owner receipt, source-pinned CI and immutable non-Agent resources.
Never use this gate to promote Stable or skip D172 business isolation.
"""
import argparse
import json
import pathlib
import re
import subprocess

BASE = "b8eed46a1676ccb8113690c676fe4b28b9caa17e"
RECEIPT = "ops/d173-e150-agent170-release-authorization.json"
MARKER = "D173-E150_AGENT170_ONLY_RELEASE:"
PR_BRANCH = "fix/d173-e149-agent170-activity-webtab-20261107"
PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/", "tests/d173-e149-",
    "tests/d173-e141-agent-ha-web-shield.test.mjs",
    "tools/d173_e150_agent170_release_gate.py",
    "tools/d167_release_gate.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e097_startup_regression.mjs",
    ".github/workflows/d173-e126-badge-ci.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-beta-firestore.yml",
    ".github/workflows/verify-d171-agent-code-only.yml",
    ".github/workflows/d173-e141-agent-source.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
)
PERMITTED = (
    *PROTECTED,
    "docs/D173_E149_AGENT170_ACTIVITY_BROWSER_FIRE_BUDGET_2026-11-07.md",
    "docs/OWNER_DECISIONS.md", "ops/project-state.json",
    "docs/D173_E150_AGENT170_HOST13_SIGNED_OTA_RELEASE_RECEIPT_2026-11-07.md",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json", RECEIPT
)
MUTATION_FORBIDDEN = (
    "service/", "web/", "android/", "firebase/", "firebase.json",
    "functions/", "obpp1291/", "pda-management/", "ops/apps-script/",
    "ops/project-scope.json", "ops/resource-registry.json"
)

def deny(reason):
    raise SystemExit("D173_E150_AGENT170_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], text=True, capture_output=True)

def txt(path):
    return pathlib.Path(path).read_text(encoding="utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["agent"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        state = json.loads(txt("ops/project-state.json"))
        receipt = json.loads(txt(RECEIPT))
    except Exception as exc:
        deny("AUTHORITY_JSON_MISSING_OR_INVALID_" + type(exc).__name__)
    info = state.get("d173_e150", {})
    if info.get("owner_code_approved") is not True or info.get("owner_release_approved") is not True:
        deny("OWNER_GRANT_MISSING")
    if info.get("d172") != "INDEPENDENT_PENDING_HOLD" or info.get("stable") != "OWNER_GATED":
        deny("D172_OR_STABLE_BOUNDARY")
    if receipt.get("owner_code_approved") is not True or receipt.get("owner_protected_release_approved") is not True:
        deny("SIGNED_OWNER_RECEIPT_MISSING")
    if receipt.get("agent_target_version") != 170 or receipt.get("host_build") != 13:
        deny("VERSION_OR_HOST_RECEIPT")
    if txt("relay-agent/VERSION").strip() != "170" or "AgentBuild = 170;" not in txt("relay-agent/AgentConfig.cs"):
        deny("VERSION_NOT_ALIGNED")
    if "RequiredHostBuild = 13;" not in txt("relay-agent/AgentBrowserBundle.cs"):
        deny("REQUIRED_HOST13_MISSING")
    if not pathlib.Path("relay-agent/D173E150ActivityOutbox.cs").is_file():
        deny("DURABLE_OUTBOX_SOURCE_MISSING")
    changed = git("diff", "--name-only", BASE, "HEAD", "--")
    if changed.returncode:
        deny("SOURCE_DIFF_UNAVAILABLE")
    paths = set(changed.stdout.splitlines())
    if any(path.startswith(MUTATION_FORBIDDEN) for path in paths):
        deny("CROSS_PROJECT_PROVIDER_MUTATION")
    if any(not any(path == p or path.startswith(p) for p in PERMITTED) for path in paths):
        deny("OUT_OF_SCOPE_FILE")
    if args.preflight:
        print("D173_E150_AGENT170_OWNER_SCOPE_PREFLIGHT_PASS__NOT_A_RELEASE")
        return
    title = git("log", "-1", "--format=%s")
    if title.returncode or not title.stdout.strip().startswith(MARKER):
        deny("MAIN_RELEASE_MARKER_REQUIRED")
    pin = receipt.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9a-f]{40}", pin):
        deny("EXACT_SOURCE_CI_PIN_INVALID")
    if (receipt.get("source_ci_verified") is not True or
        receipt.get("source_ci_failed") != 0 or
        receipt.get("source_ci_success", 0) < 7 or
        receipt.get("native_agent_host13_pass") is not True or
        receipt.get("d172_isolation_pass") is not True):
        deny("EXACT_SOURCE_CI_NOT_VERIFIED")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("CI_SOURCE_NOT_ANCESTOR")
    frozen = git("diff", "--name-only", pin, "HEAD", "--", *PROTECTED)
    if frozen.returncode or frozen.stdout.strip():
        deny("AFTER_CI_PROTECTED_SOURCE_DRIFT")
    print("D173_E150_AGENT170_RELEASE_GATE_PASS: pin=" + pin[:12])

if __name__ == "__main__":
    main()
