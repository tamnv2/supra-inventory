#!/usr/bin/env python3
"""D173-E185 Owner scope: guarded Agent184/Web3.3.6/Worker production; Android excluded."""
import argparse, json, os, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "ebfccfa26f3273f111b35bd5232fcec00b6d0c89"
AUTH = ROOT / "ops/d173-e185-release-authorization.json"
MARKER = "D173-E185_AGENT184_WEB336_WORKER_PRODUCTION_RELEASE:"
ALLOWED_EXACT = {
    "docs/D173_E185_AGENT184_FIELD_WEB_ROSTER_REMOTE_CONTROL_2026-11-11.md",
    "docs/OWNER_DECISIONS.md", "ops/project-state.json",
    "ops/authority-manifest.json", "ops/change-continuity/D173.json",
    "ops/d173-e185-release-authorization.json",
    "tools/d173_e185_release_gate.py",
    "tools/ui_design_guard.py",
    "tools/d173_e097_startup_regression.mjs",
    "tools/d173_e052_instrumentation_guard.py",
    "tests/d173-e185-agent184-web-kick.test.mjs",
    "tests/d170-d171-release-parity.test.mjs",
    ".github/workflows/d173-e126-badge-ci.yml",
    ".github/workflows/d173-e127-source.yml",
    "tests/d167-web-ux-consistency.test.mjs",
    "tests/d173-e032-ui-code-only.test.mjs",
    "tests/d173-e175-unified-network.test.mjs",
    "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tests/d173-e034-release-gate.test.mjs",
    "tools/android_operational_regression.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e064_agent_history_usage_guard.py",
    "tools/d173_e060_email_preservation_guard.py",
    "web/package.json",
    ".github/workflows/d173-e185-source.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    ".github/workflows/d173-e175-source.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
}
ALLOWED_PREFIX = ("relay-agent/", "relay-agent-webview2-host/",
                  "service/src/", "web/src/")
FORBIDDEN = ("android/", "obpp1291/", "pda-management/", "functions/",
             "firebase/", "ops/apps-script/", "service/wrangler.stable.toml",
             "service/wrangler.beta.toml", "ops/project-scope.json",
             "ops/resource-registry.json", ".github/workflows/release-obpp1291.yml")

def fail(reason):
    raise SystemExit("D173_E185_RELEASE_DENIED:" + reason)

def git(*args):
    run = subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    if run.returncode:
        fail("GIT_" + args[0])
    return run.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker", "web", "agent"), required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads(AUTH.read_text(encoding="utf-8"))
    required = {
        "change_id": "D173-E185",
        "owner_approval_reference": "OWNER_20261111_ITEMS_1_TO_7_CODE_AND_PRODUCTION_REPORTER_PDA_BACKLOG",
        "source_pr": 908, "base_main_sha": BASE,
        "owner_code_approved": True, "owner_protected_release_approved": True,
        "approved_components": ["worker","web","agent","agent-webview2-host"],
        "agent_target_version": 184, "web_target_version": "3.3.6",
        "android_mutation": False, "android_release": False,
        "obpp_mutation": False, "d172_pending_hold": True,
        "d172_cross_regression_required": True, "stable_mutation": False,
        "firestore_rules_mutation": False, "worker_database_schema_mutation": False,
        "new_provider_resources": False, "field_pass": False, "owner_pass": False,
        "release_marker": MARKER,
    }
    for key, value in required.items():
        if auth.get(key) != value:
            fail("OWNER_SCOPE_" + key)
    if (ROOT / "relay-agent/VERSION").read_text().strip() != "184" or (
        "AgentBuild = 184;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text()
    ) or (
        (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text().count("0.184.0.0") != 2
    ):
        fail("AGENT184_VERSION_TRIPLE")
    if 'WEB_VERSION = "3.3.6"' not in (ROOT / "web/src/web-version.ts").read_text():
        fail("WEB_VERSION")
    if json.loads((ROOT / "web/package.json").read_text())["version"] != "3.3.6":
        fail("WEB_PACKAGE_VERSION")
    if args.preflight:
        base = git("merge-base", "origin/main", "HEAD")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or not git("log", "-1", "--format=%s").startswith(MARKER):
            fail("PROTECTED_MERGE_AND_EXACT_RELEASE_MARKER_REQUIRED")
        base = parents[1]
        if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            fail("MAIN_PUSH_ONLY")
    if base != BASE:
        fail("BASE_CHANGED_REVIEW_REQUIRED")
    changed = set(git("diff", "--name-only", base, "HEAD").splitlines())
    extra = sorted(path for path in changed
                   if path not in ALLOWED_EXACT and not any(path.startswith(q) for q in ALLOWED_PREFIX))
    if extra: fail("OUT_OF_SCOPE:" + ",".join(extra)[:220])
    if any(path == root or path.startswith(root) for path in changed for root in FORBIDDEN):
        fail("ANDROID_D172_STABLE_OR_PROVIDER_MUTATION")
    expected = {
        "relay-agent/D119AgentFeatures.cs",
        "relay-agent/D173E179OverviewNoScroll.cs",
        "relay-agent-webview2-host/Program.cs",
        "service/src/index.ts", "service/src/core.ts",
        "service/src/read-model-core.ts", "service/src/firestore-projection.ts",
        "web/src/realtime-client.ts",
        "tests/d173-e185-agent184-web-kick.test.mjs",
    }
    if not expected.issubset(changed):
        fail("INCOMPLETE_BUSINESS_IMPLEMENTATION")
    if args.preflight:
        print("D173_E185_OWNER_SCOPE_PREFLIGHT_PASS__CI_RELEASE_PENDING")
        return
    if not (auth.get("source_ci_verified") is True and
            auth.get("d172_cross_regression_pass") is True and
            auth.get("native_agent_pass") is True and
            auth.get("web_build_pass") is True and
            auth.get("worker_typecheck_pass") is True and
            auth.get("required_ci_failed") == 0 and
            int(auth.get("required_ci_success") or 0) >= 20):
        fail("CI_AND_D172_REQUIRED_RECEIPTS")
    pin = auth.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch(r"[a-f0-9]{40}", pin):
        fail("SOURCE_CI_PIN")
    git("merge-base", "--is-ancestor", pin, "HEAD")
    if git("diff", "--name-only", pin, "HEAD", "--",
           "relay-agent/", "relay-agent-webview2-host/",
           "service/src/", "web/src/", "web/package.json"):
        fail("SOURCE_CHANGED_AFTER_CI")
    print("D173_E185_" + args.component.upper() + "_EXACT_SOURCE_RELEASE_AUTHORIZED")

if __name__ == "__main__":
    main()
