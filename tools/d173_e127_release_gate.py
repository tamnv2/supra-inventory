#!/usr/bin/env python3
"""D173-E127: fail-closed existing Production Worker log diagnostics release only.

The Owner authorized scoped log recovery 2026-11-03. This gate cannot
authorize Stable, new provider resources, D172 changes, Agent signing/OTA,
or untested Worker code. Run on the protected main merge marker only.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "ops/d173-e127-release-authorization.json"
ALLOWED = {
    "service/src/runtime-logs-core.ts", "service/src/runtime-logs.ts",
    "service/src/index.ts", "relay-agent/AgentLogUploadBridge.cs",
    "relay-agent/Program.cs",
    "tests/d173-e127-log-archive.test.mjs",
    "tools/d173_e097_startup_regression.mjs",
    "tools/d173_e060_email_preservation_guard.py",
    "tools/d173_e127_release_gate.py",
    "tools/d167_release_gate.py",
    ".github/workflows/d173-e127-readonly-probe.yml",
    ".github/workflows/d173-e127-postrelease-readback.yml",
    ".github/workflows/d173-e127-source.yml",
    ".github/workflows/deploy-beta.yml",
    "docs/D173_E127_LOG_DRIVE_DIAGNOSTIC_CODE_2026-11-03.md",
    "ops/d173-e127-release-authorization.json",
    "docs/OWNER_DECISIONS.md", "docs/specs/OBSERVABILITY_LOGGING.md",
    "ops/project-state.json", "ops/authority-manifest.json",
    "ops/change-continuity/D173.json",
}
IMMUTABLE = (
    "obpp1291/", "service/src/obpp1291-", "firebase/",
    "functions/", "ops/apps-script/", "android/", "web/",
    "service/wrangler.beta.toml", "service/wrangler.stable.toml",
    "ops/project-scope.json", "ops/resource-registry.json",
)
MARKER = "D173-E127_LOG_DRIVE_RECOVERY_RELEASE:"

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT,
                          capture_output=True, text=True, check=False)

def require(ok, message):
    if not ok:
        raise SystemExit("D173_E127_WORKER_RELEASE_DENIED:" + message)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=("worker",), required=True)
    parser.add_argument("--preflight", action="store_true")
    options = parser.parse_args()
    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    require(receipt.get("change_id") == "D173" and
            receipt.get("checkpoint_id") == "D173-E127" and
            receipt.get("owner_approval_reference") == "OWNER_20261103_LOG_DRIVE_RECOVERY_UNTIL_VERIFIED",
            "OWNER_SCOPE")
    for key in ("stable_permission", "d172_mutation", "new_provider_resource",
                "firebase_mutation", "database_migration", "web_mutation",
                "android_mutation", "gateway_mutation", "agent_ota_permission",
                "owner_pass", "field_pass"):
        require(receipt.get(key) is False, "FORBIDDEN_" + key)
    base = str(receipt.get("base_main_sha") or "")
    require(bool(re.fullmatch(r"[a-f0-9]{40}", base)) and
            git("merge-base", "--is-ancestor", base, "HEAD").returncode == 0, "BASE_DRIFT")
    changed = git("diff", "--name-only", base, "HEAD")
    require(changed.returncode == 0, "DIFF_UNAVAILABLE")
    paths = set(changed.stdout.splitlines())
    require(not (paths - ALLOWED), "EXTRA_SOURCE_PATHS")
    for path in IMMUTABLE:
        require(git("diff", "--quiet", base, "HEAD", "--", path).returncode == 0,
                "D172_OR_UNRELATED_MUTATION")
    require({"service/src/index.ts", "service/src/runtime-logs.ts",
             "service/src/runtime-logs-core.ts"}.issubset(paths), "MISSING_LOG_DIAGNOSTIC")
    if options.preflight and receipt.get("source_ci_verified") is not True:
        print("D173_E127_SOURCE_CI_PENDING__NO_RELEASE")
        return
    require(receipt.get("source_ci_verified") is True and
            receipt.get("d172_cross_regression_pass") is True and
            receipt.get("worker_typecheck_pass") is True and
            receipt.get("release_permission") is True, "CI_OWNER_RELEASE_MISSING")
    sha = str(receipt.get("source_ci_sha") or "")
    require(bool(re.fullmatch(r"[a-f0-9]{40}", sha)) and
            git("merge-base", "--is-ancestor", sha, "HEAD").returncode == 0,
            "SOURCE_PIN_NOT_ANCESTOR")
    protected = ("service/", "relay-agent/", "tools/", ".github/workflows/")
    require(git("diff", "--quiet", sha, "HEAD", "--", *protected).returncode == 0,
            "CODE_CHANGED_AFTER_CI")
    if options.preflight:
        print("D173_E127_WORKER_SOURCE_CI_AND_D172_SCOPE_PASS")
        return
    require(os.getenv("GITHUB_EVENT_NAME") == "push" and
            os.getenv("GITHUB_REF") == "refs/heads/main" and
            git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER),
            "OWNER_MERGE_MARKER_MISSING")
    print("D173_E127_EXISTING_PRODUCTION_WORKER_APPROVED_LOG_DIAGNOSTICS_ONLY")

if __name__ == "__main__":
    main()
