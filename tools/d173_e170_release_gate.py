#!/usr/bin/env python3
"""D173-E170 Owner-scoped Worker + signed Agent175 production diagnostics gate."""
import argparse
import json
import re
import subprocess
from pathlib import Path

BASE = "20038af1004f7167209fc19a32083da35500e7c1"
AUTH = "ops/d173-e170-release-authorization.json"
MARKER = "D173-E170_DIAGNOSTICS_PRODUCTION_RELEASE:"
ALLOWED = {
    "service/src/core.ts", "service/src/d166-sql-usage.ts",
    "service/src/d167-route-usage.ts", "service/src/operational-v2-core.ts",
    "service/src/index.ts", "service/src/runtime-logs.ts",
    "service/src/runtime-logs-core.ts",
    "tools/d173_daily_usage_2200.py",
    "tools/d173_e097_startup_regression.mjs",
    "tools/d173_e060_email_preservation_guard.py",
    "tools/d173_e170_release_gate.py",
    "tests/test_d173_daily_usage_2200.py",
    "tests/d173-e123-sql-ack-parity.test.mjs",
    "tests/d173-e169-diagnostic-attribution.test.mjs",
    "tests/d173-e170-daily-evidence.test.mjs",
    "tests/d173-e161-agent173-webview-recovery.test.mjs",
    "relay-agent/VERSION", "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/FirestoreD173E140PickerLocks.cs",
    "relay-agent/FirestoreAgentLeaderCoordinator.cs",
    "relay-agent/RtdbHaLiveness.cs",
    ".github/workflows/d173-daily-usage-2200.yml",
    ".github/workflows/d173-e055-usage.yml",
    ".github/workflows/d173-e127-source.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/deploy-beta.yml",
    "ops/authority-manifest.json",
    "ops/change-continuity/D173.json", "ops/project-state.json",
    "ops/d173-e170-release-authorization.json",
    "docs/OWNER_DECISIONS.md", "docs/specs/OBSERVABILITY_LOGGING.md",
    "docs/D173_E169_DIAGNOSTIC_ATTRIBUTION_2026-11-08.md",
    "docs/D173_E170_PRODUCTION_DIAGNOSTIC_CORRELATION_2026-11-08.md",
}
PROTECTED = [
    "service/", "relay-agent/", "android/", "web/", "firebase/", "functions/",
    "ops/apps-script/", "pda-management/", ".github/workflows/",
    "tools/", "tests/"
]

def deny(reason):
    raise SystemExit("D173_E170_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--component", choices=["worker", "agent"], required=True)
    p.add_argument("--preflight", action="store_true")
    arg = p.parse_args()
    a = json.loads(Path(AUTH).read_text(encoding="utf-8"))
    if (a.get("change_id") != "D173-E170" or
        a.get("owner_approval_reference") !=
            "OWNER_20261108_APPROVES_FULL_DIAGNOSTIC_LOG_CORRELATION_PRODUCTION" or
        a.get("owner_code_approved") is not True or
        a.get("owner_protected_release_approved") is not True or
        a.get("release_marker") != MARKER or
        a.get("allowed_components") != ["worker", "agent"] or
        a.get("agent_target_version") != 175 or
        a.get("host_build") != 13 or a.get("host_arch") != "x64" or
        a.get("release_channel") != "inventory-channel"):
        deny("OWNER_GRANT_VERSION_OR_COMPONENT_DRIFT")
    for field in ("provider_resource_mutation", "firebase_rules_mutation",
                  "android_mutation", "web_ui_mutation", "wms_mutation", "stable_mutation"):
        if a.get(field) is not False:
            deny("UNAPPROVED_MUTATION:" + field)
    state = json.loads(Path("ops/project-state.json").read_text(encoding="utf-8"))
    status = state.get("d173_e170_production_diagnostics", {})
    if (status.get("id") != "D173-E170" or
        status.get("owner_production_release_approved") is not True or
        status.get("agent_target_version") != 175 or
        status.get("owner_pass") is not False):
        deny("CANONICAL_STATE_DRIFT")
    if (Path("relay-agent/VERSION").read_text().strip() != "175" or
        "AgentBuild = 175;" not in Path("relay-agent/AgentConfig.cs").read_text() or
        "0.175.0.0" not in Path("relay-agent/SupraInventoryRelayAgent.csproj").read_text() or
        "RequiredHostBuild = 13;" not in Path("relay-agent/AgentBrowserBundle.cs").read_text()):
        deny("AGENT175_OR_HOST13_DRIFT")
    service = Path("service/src/index.ts").read_text(encoding="utf-8")
    report = Path("tools/d173_daily_usage_2200.py").read_text(encoding="utf-8")
    gate = Path(".github/workflows/deploy-beta.yml").read_text(encoding="utf-8")
    if (service.count('url.searchParams.get("mode") === "DAILY_EVIDENCE"') != 1 or
        "verifyD173SqlAuditSignature(request, env.D166_CF_READ_TOKEN)" not in service or
        "d173_e170_daily_evidence(ct, day, start, end)" not in report or
        "D173-E170_DIAGNOSTICS_PRODUCTION_RELEASE:" not in gate or
        'cron: "30 22 * * *"' not in Path(
            ".github/workflows/d173-daily-usage-2200.yml").read_text()):
        deny("HMAC_SERVICE_OR_0530_CONTRACT_MISSING")
    diff = git("diff", "--name-only", BASE, "HEAD", "--")
    if diff.returncode != 0:
        deny("BASE_COMMIT_UNAVAILABLE")
    touched = set(diff.stdout.splitlines())
    if touched - ALLOWED:
        deny("UNAPPROVED_PATHS:" + ",".join(sorted(touched - ALLOWED))[:300])
    if arg.preflight:
        print("D173_E170_OWNER_SCOPE_PREFLIGHT_PASS__NO_RELEASE")
        return
    msg = git("log", "-1", "--format=%s")
    if msg.returncode or not msg.stdout.strip().startswith(MARKER):
        deny("PROTECTED_MERGE_MARKER_MISSING")
    pin = a.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9a-f]{40}", pin):
        deny("SOURCE_CI_PIN_MISSING")
    for f in ("source_ci_verified", "native_agent_pass", "worker_ts_pass",
              "sql_business_parity_pass", "privacy_pass",
              "shared_resource_regression_pass"):
        if a.get(f) is not True:
            deny("CI_NOT_PROVEN:" + f)
    if a.get("source_ci_failed") != 0 or a.get("source_ci_success", 0) < 30:
        deny("CI_SUCCESS_THRESHOLD_NOT_MET")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("PIN_NOT_MERGE_ANCESTOR")
    delta = git("diff", "--name-only", pin, "HEAD", "--", *PROTECTED)
    if delta.returncode or delta.stdout.strip():
        deny("PROTECTED_SOURCE_CHANGED_AFTER_EXACT_CI")
    print("D173_E170_" + arg.component.upper() +
          "_EXACT_SOURCE_PRODUCTION_RELEASE_PASS__PIN=" + pin[:12])

if __name__ == "__main__":
    main()
