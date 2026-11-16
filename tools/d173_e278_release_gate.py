#!/usr/bin/env python3
"""D173-E278: Owner-authorized Agent194 + existing Worker only release gate."""
import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "910bbeb400eebcd499a356d392ae500e2320d885"
MARKER = "D173-E278_AGENT194_CONFIRM_INCIDENT_PROD_RELEASE:"
AUTH = ROOT / "ops/d173-e278-release-authorization.json"
ALLOWED = {
    "service/src/d173-confirm-incident.ts",
    "service/src/index.ts",
    "service/src/core.ts",
    "relay-agent/D173E278ConfirmIncident.cs",
    "relay-agent/Program.cs",
    "relay-agent/D160ConfirmPipeline.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/VERSION",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "tests/d173-e278-confirm-incident.test.mjs",
    ".github/workflows/d173-e278-agent194-confirm.yml",
    ".github/workflows/d173-e278-agent194-ota.yml",
    ".github/workflows/deploy-beta.yml",
    "tools/d173_e278_release_gate.py",
    "docs/D173_E278_AGENT194_HA_INCIDENT_PRODUCTION_2026-11-16.md",
    "ops/d173-e278-release-authorization.json",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
    "docs/OWNER_DECISIONS.md",
}
REQUIRED = {
    "service/src/d173-confirm-incident.ts",
    "service/src/index.ts",
    "service/src/core.ts",
    "relay-agent/D173E278ConfirmIncident.cs",
    "relay-agent/D160ConfirmPipeline.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/Program.cs",
    "relay-agent/VERSION",
    "tests/d173-e278-confirm-incident.test.mjs",
    ".github/workflows/d173-e278-agent194-confirm.yml",
    ".github/workflows/d173-e278-agent194-ota.yml",
    ".github/workflows/deploy-beta.yml",
}

def deny(code):
    raise SystemExit("D173_E278_RELEASE_DENIED:" + code)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True,
                       encoding="utf-8", errors="replace")
    if p.returncode:
        deny("GIT_" + args[0])
    return p.stdout.strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preflight", action="store_true")
    ap.add_argument("--component", choices=("worker", "agent"))
    args = ap.parse_args()
    auth = json.loads(AUTH.read_text(encoding="utf-8"))
    expected = {
        "schema_version": 1,
        "project_key": "supra-inventory",
        "change_id": "D173-E278",
        "owner_code_approved": True,
        "owner_production_release_approved": True,
        "source_main_sha": BASE,
        "approved_components": ["agent", "worker"],
        "target_agent_version": 194,
        "previous_signed_release": "relay-agent-v193",
        "host_build_unchanged": 14,
        "web_ui_source_changed": False,
        "android_changed": False,
        "d172_business_changed": False,
        "stable_changed": False,
        "new_provider_resources": False,
        "release_marker": MARKER,
        "field_pass": False,
        "owner_pass": False,
    }
    for k, v in expected.items():
        if auth.get(k) != v: deny("AUTH_" + k)
    if (ROOT / "relay-agent/VERSION").read_text().strip() != "194":
        deny("VERSION_194_REQUIRED")
    agent = (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
    project = (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8")
    host = (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8")
    if "AgentBuild = 194;" not in agent or "0.194.0.0" not in project or "RequiredHostBuild = 14;" not in host:
        deny("AGENT194_HOST14_CONSISTENCY")
    if args.preflight:
        origin = git("merge-base", "origin/main", "HEAD")
        if origin != BASE: deny("MAIN_ADVANCED_REBASE_REQUIRED")
    else:
        if args.component is None: deny("COMPONENT_REQUIRED")
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or parents[1] != BASE: deny("PROTECTED_TWO_PARENT_MERGE")
        if os.environ.get("GITHUB_REF") != "refs/heads/main" or not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("EXACT_MAIN_OWNER_MARKER")
    changed = set(git("diff", "--name-only", BASE, "HEAD").splitlines())
    if changed - ALLOWED: deny("OUT_OF_SCOPE:" + ",".join(sorted(changed - ALLOWED))[:300])
    if not REQUIRED.issubset(changed):
        deny("REQUIRED_SOURCE_MISSING:" + ",".join(sorted(REQUIRED - changed)))
    # Exact scoped D172 and Stable isolation; shared Worker hooks need D172 tests.
    if any(p.startswith(("obpp1291/", "firebase/", "android/", "web/", "pda-management/",
                         "functions/", "relay-agent-webview2-host/", "service/src/obpp1291-",
                         "tests/d172-", "tools/d172_", "docs/D172_")) for p in changed):
        deny("D172_STABLE_OR_SHARED_SCOPE")
    journal = json.loads((ROOT / "ops/change-continuity/D173.json").read_text(encoding="utf-8"))
    if journal.get("last_checkpoint", {}).get("id") != "D173-E278":
        deny("JOURNAL_CHECKPOINT")
    if args.preflight:
        print("D173_E278_SCOPED_PREFLIGHT_PASS")
        return
    sha = auth.get("source_ci_sha", "")
    if len(sha) != 40: deny("SOURCE_CI_NOT_PINNED")
    git("merge-base", "--is-ancestor", sha, "HEAD")
    if git("diff", "--name-only", sha, "HEAD", "--", "service/src/", "relay-agent/",
           "tests/", ".github/workflows/", "tools/"):
        deny("CODE_DRIFT_AFTER_CI")
    for k in ("source_ci_verified", "native_windows_pass", "worker_typecheck_pass",
              "d172_isolation_pass", "authority_guard_pass"):
        if auth.get(k) is not True: deny("UNVERIFIED_" + k)
    if auth.get("required_ci_success", 0) < 4 or len(auth.get("required_ci_run_ids", [])) < 4:
        deny("REQUIRED_CI_RECEIPTS_MISSING")
    print("D173_E278_RELEASE_AUTHORIZED:" + args.component)

if __name__ == "__main__":
    main()
