#!/usr/bin/env python3
"""D173 E165 Owner-gated integrated Worker/Web, Android and Agent174 signed release."""
import argparse
import json
import re
import subprocess
from pathlib import Path

BASE = "5c63a72dae8bb864bd242daa5e60a6afafc2eb6c"
RECEIPT = "ops/d173-e165-agent174-release-authorization.json"
MARKER = "D173-E165_FULL_PRODUCTION_RELEASE:"
HOST13_SHA = "36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694"
ALLOWED = {
    "relay-agent/Program.cs", "relay-agent/AgentLogUploadBridge.cs", "relay-agent/D173VpsUsage.cs",
    "relay-agent/D173E089UsageCards.cs", "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj", "relay-agent/VERSION",
    "tests/d173-e161-agent173-webview-recovery.test.mjs",
    "tests/d173-e165-agent-tray-usage-window.test.mjs",
    "tools/d173_daily_usage_2200.py", "tests/test_d173_daily_usage_2200.py",
    "tools/d173_e060_vps_usage_guard.py", "tools/d173_e064_agent_history_usage_guard.py",
    "tools/android_operational_regression.py",
    ".github/workflows/d173-daily-usage-2200.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    "docs/D173_E165_AGENT174_USAGE_0530_LOG_PROPOSAL_2026-11-08.md",
    "docs/OWNER_DECISIONS.md", "docs/D173_E167_LOG_2H_OWNER_APPROVED_2026-11-08.md", "ops/authority-manifest.json",
    "ops/change-continuity/D173.json", "ops/project-state.json",
    RECEIPT, "tools/d173_e165_agent174_release_gate.py",
    "service/src/index.ts", "service/src/runtime-logs.ts", "service/src/d173-background-worker.ts",
    "web/src/runtime-logger.ts", "android/app/src/main/java/cd/cc/supra/inventory/beta/D171DailyLogWorker.kt",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt",
    "tools/d173_e096_source_guard.py", "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tools/d167_release_gate.py", "android/release-notes.json", "web/src/web-version.ts",
    ".github/workflows/d173-e126-badge-ci.yml",
    ".github/workflows/d173-e127-source.yml",
    "tools/d173_e097_startup_regression.mjs",
    "tests/d173-e165-log-cadence.test.mjs",
    "tests/d167-three-slot-sku.test.mjs", "tests/d170-d171-release-parity.test.mjs",
    "tests/d173-e026-phase1-release.test.mjs", "tests/d173-e034-release-gate.test.mjs",
    "tools/d173_e052_instrumentation_guard.py", "tools/d173_e060_email_preservation_guard.py",
    "web/src/api.ts",
}
PROTECTED = (
    "relay-agent/", "relay-agent-webview2-host/",
    "tests/d173-e161-agent173-webview-recovery.test.mjs",
    "tests/d173-e165-agent-tray-usage-window.test.mjs",
    "tools/d173_daily_usage_2200.py", "tests/test_d173_daily_usage_2200.py",
    "tools/d173_e060_vps_usage_guard.py", "tools/d173_e064_agent_history_usage_guard.py",
    "tools/android_operational_regression.py",
    ".github/workflows/d173-daily-usage-2200.yml",
    ".github/workflows/verify-relay-agent.yml",
    ".github/workflows/verify-d173-e149-agent170.yml",
    "tools/d173_e165_agent174_release_gate.py",
    "service/src/index.ts", "service/src/runtime-logs.ts", "service/src/d173-background-worker.ts",
    "web/src/runtime-logger.ts", "android/app/src/main/java/cd/cc/supra/inventory/beta/D171DailyLogWorker.kt",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt",
    "tools/d173_e096_source_guard.py", "tests/d173-e149-agent170-activity-webtab.test.mjs",
    "tools/d167_release_gate.py", "android/release-notes.json", "web/src/web-version.ts",
    ".github/workflows/d173-e126-badge-ci.yml",
    ".github/workflows/d173-e127-source.yml",
    "tools/d173_e097_startup_regression.mjs",
    "tests/d173-e165-log-cadence.test.mjs",
    "tests/d167-three-slot-sku.test.mjs", "tests/d170-d171-release-parity.test.mjs",
    "tests/d173-e026-phase1-release.test.mjs", "tests/d173-e034-release-gate.test.mjs",
    "tools/d173_e052_instrumentation_guard.py", "tools/d173_e060_email_preservation_guard.py",
    "web/src/api.ts",
)

def deny(reason):
    raise SystemExit("D173_E165_AGENT174_RELEASE_DENIED:" + reason)

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)

def read(path):
    return Path(path).read_text(encoding="utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", choices=["agent","android","worker"], required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    receipt = json.loads(read(RECEIPT))
    state = json.loads(read("ops/project-state.json")).get("d173_e165", {})
    if (receipt.get("owner_approval_reference") !=
            "OWNER_20261108_E165_FOUR_SCOPES_TRAY_USAGE0530_DAYLINE_LOGS_2H_PRODUCTION"
            or receipt.get("owner_code_approved") is not True
            or receipt.get("owner_protected_release_approved") is not True
            or receipt.get("log_protocol_approved") is not True):
        deny("OWNER_GRANT_NOT_EXACT_OR_LOG_SCOPE_CHANGED")
    if (receipt.get("agent_target_version") != 174
            or receipt.get("host_build") != 13
            or receipt.get("host_arch") != "x64"
            or receipt.get("existing_host13_sha256") != HOST13_SHA
            or receipt.get("release_marker") != MARKER
            or receipt.get("release_channel") != "inventory-channel"):
        deny("AGENT174_HOST13_OR_CHANNEL_PIN_DRIFT")
    for field in ("firebase_rules_mutation", "gateway_mutation",
                  "d172_mutation", "stable_mutation", "new_provider_resource"):
        if receipt.get(field) is not False:
            deny("UNAPPROVED_MUTATION:" + field)
    for field in ("service_mutation","web_mutation","android_mutation"):
        if receipt.get(field) is not True:
            deny("APPROVED_PRODUCTION_COMPONENT_MISSING:"+field)
    if (state.get("id") != "D173-E165" or
            state.get("agent_target_version") != 174 or
            state.get("host_build") != 13 or
            state.get("owner_pass") is not False or
            state.get("log_protocol") != "OWNER_APPROVED_2H_VN_0100_TO_2300_CUTOFF_0500_STAGGER_10M_SERVICE_30M"):
        deny("AUTHORITY_STATE_MISMATCH")
    if (read("relay-agent/VERSION").strip() != "174" or
            "AgentBuild = 174;" not in read("relay-agent/AgentConfig.cs") or
            "0.174.0.0" not in read("relay-agent/SupraInventoryRelayAgent.csproj") or
            "RequiredHostBuild = 13;" not in read("relay-agent/AgentBrowserBundle.cs")):
        deny("AGENT174_HOST13_SOURCE_DRIFT")
    form = read("relay-agent/Program.cs")
    hiding = form.split("private void MinimizeToTray()", 1)[1].split(
        "private void RestoreFromTray()", 1)[0]
    restoring = form.split("private void RestoreFromTray()", 1)[1].split(
        "private void QueueNetworkStatusRefresh()", 1)[0]
    if ("ShowInTaskbar =" in hiding + restoring or
            "D173_E165 TRAY hwnd_preserved=" not in hiding or
            "D173_E165 TRAY hwnd_preserved=" not in restoring):
        deny("TRAY_WNDPROC_HANDLE_PERSISTENCE_GUARD_MISSING")
    usage = read("relay-agent/D173VpsUsage.cs")
    cards = read("relay-agent/D173E089UsageCards.cs")
    if ("D173E165UsageSyncAllowed" not in usage or
            "var end=local.Date.AddDays(1);" not in usage or
            "new[]{0,6,14,22,24}" not in cards):
        deny("VN_CALENDAR_DAY_AND_SYNC_GUARD_MISSING")
    workflow = read(".github/workflows/d173-daily-usage-2200.yml")
    script = read("tools/d173_daily_usage_2200.py")
    if ('cron: "30 22 * * *"' not in workflow or
            'dt.time(22, 0)' not in script or
            "log_correlation" not in script):
        deny("REPORT_0530_OR_LOG_SCOPE_DRIFT")
    if ("DeliverySlots" not in read("relay-agent/AgentLogUploadBridge.cs") or
            "CORE_STAGED" not in read("service/src/runtime-logs.ts") or
            "CORE_STAGED" not in read("web/src/runtime-logger.ts") or
            "runD173ScheduledMaintenance(env, logDrainTime.getUTCMinutes() % 30 === 0)" not in read("service/src/index.ts")):
        deny("APPROVED_TWO_HOUR_LOG_PROTOCOL_INCOMPLETE")
    diff = git("diff", "--name-only", BASE, "HEAD", "--")
    if diff.returncode:
        deny("BASE_COMMIT_UNAVAILABLE")
    touched = set(diff.stdout.splitlines())
    if touched - ALLOWED:
        deny("UNAPPROVED_PATHS:" + ",".join(sorted(touched - ALLOWED))[:300])
    if args.preflight:
        print("D173_E165_AGENT174_SOURCE_SCOPE_PREFLIGHT_PASS__NO_RELEASE")
        return
    msg = git("log", "-1", "--format=%s")
    if msg.returncode or not msg.stdout.strip().startswith(MARKER):
        deny("PROTECTED_MERGE_MARKER_MISSING")
    pin = receipt.get("source_ci_sha")
    if not isinstance(pin, str) or not re.fullmatch(r"[0-9a-f]{40}", pin):
        deny("EXACT_CI_SOURCE_PIN_MISSING")
    if (receipt.get("source_ci_verified") is not True or
            receipt.get("source_ci_failed") != 0 or
            receipt.get("source_ci_success", 0) < 15 or
            receipt.get("native_agent_pass") is not True or
            receipt.get("d172_isolation_pass") is not True):
        deny("CI_NATIVE_OR_D172_NOT_PROVEN")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("PIN_NOT_MERGE_ANCESTOR")
    source_diff = git("diff", "--name-only", pin, "HEAD", "--", *PROTECTED)
    if source_diff.returncode or source_diff.stdout.strip():
        deny("PROTECTED_SOURCE_DRIFT_AFTER_CI")
    print("D173_E165_AGENT174_SIGNED_RELEASE_GATE_PASS__SOURCE=" + pin[:12])

if __name__ == "__main__":
    main()
