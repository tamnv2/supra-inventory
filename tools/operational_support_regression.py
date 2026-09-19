#!/usr/bin/env python3
"""Regression guards for F14/F19/F20/F23 operational support contracts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    raise SystemExit(f"OPERATIONAL_SUPPORT_REGRESSION_FAIL: {message}")


def require(text: str, marker: str, name: str) -> None:
    if marker not in text:
        fail(f"missing {name}: {marker}")


def forbid(text: str, marker: str, name: str) -> None:
    if marker in text:
        fail(f"forbidden {name}: {marker}")


def main() -> None:
    ops = read("service/src/operational-v2-core.ts")
    archive_core = read("service/src/archive-core.ts")
    archive = read("service/src/archive.ts")
    web = read("web/src/operational-app.ts")
    web_api = read("web/src/api.ts")
    android_api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
    android_reporter = read("android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt")
    android_main = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt")
    android_rt = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidRealtimeClient.kt")

    # F14: server-authoritative clock/deadlines; local ticking must not poll.
    require(ops, "server_now: serverNow", "queue server time")
    require(ops, "warning_at: deadlines.warning_at", "SLA warning deadline")
    require(ops, "escalation_at: deadlines.escalation_at", "SLA escalation deadline")
    require(web_api, "server_now?: string", "Web queue server clock type")
    require(web, "queueServerOffsetMs", "Web calibrated queue clock")
    require(web, "window.setInterval(updateQueueClockDom, 15_000)", "Web local SLA ticker")
    require(android_api, "val serverNow: String? = null", "Android queue server clock")
    require(android_reporter, "queueServerOffsetMs", "Android calibrated queue clock")
    require(android_reporter, "handler.postDelayed(slaTicker, 15_000L)", "Android local SLA ticker")
    ticker = android_reporter.split("private val slaTicker", 1)[1].split("fun render(", 1)[0]
    forbid(ticker, "api.", "API polling inside Android SLA ticker")

    # F20: max range + SQL aggregate, no full pending materialization in JS.
    require(ops, "REPORTING_RANGE_TOO_LARGE", "admin insights 60-day bound")
    require(ops, "SUM(CASE WHEN first_report_at <= ?", "SQL SLA aggregate")
    forbid(ops, 'SELECT batch_id, first_report_at FROM report_batches WHERE status = \'PENDING\'', "unbounded pending materialization")

    # F19: archive keeps recurrence/result/ACK evidence and cleanup removes auxiliary hot rows.
    require(archive_core, "b.version", "archived batch version")
    require(archive_core, "b.previous_batch_id", "archived previous batch link")
    require(archive_core, "acknowledgements_json", "archived ACK lifecycle")
    require(archive_core, "result_event_snapshots", "result snapshot archive/cleanup support")
    require(archive_core, 'DELETE FROM result_acknowledgements WHERE batch_id = ?', "ACK cleanup")
    require(archive_core, 'DELETE FROM result_event_snapshots WHERE batch_id = ?', "snapshot cleanup")
    require(archive_core, 'DELETE FROM realtime_events WHERE batch_id = ?', "realtime cleanup")
    require(archive_core, "notification_delivery_attempts", "delivery-attempt cleanup")
    require(archive, '"previous_batch_id"', "batch archive column")
    require(archive, '"acknowledgements_json"', "event ACK archive column")
    forbid(archive, "Archive_Acknowledgements", "new undeclared archive tab")
    forbid(archive, "Archive_Notifications", "new undeclared notification tab")

    # F23: support diagnostics are bounded/redacted and never include auth session material.
    require(web, "sanitizeDiagnosticValue", "Web diagnostics sanitizer")
    require(web, "downloadSupportDiagnostics", "Web support-log export")
    require(web, 'slice(0, 180_000)', "Web diagnostics size bound")
    require(web, "getWebRuntimeDiagnosticSnapshot", "rich redacted Web diagnostic snapshot")
    require(android_rt, "fun diagnosticSnapshot()", "Android realtime diagnostics")
    require(android_main, "buildSupportDiagnostics()", "Android support snapshot")
    require(android_main, "sanitizeDiagnosticText", "Android diagnostics sanitizer")
    require(android_main, '.take(16_000)', "Android diagnostics size bound")
    diagnostics_block = android_main.split("private fun buildSupportDiagnostics()", 1)[1].split("private fun hasValidatedInternet", 1)[0]
    for forbidden in ("idToken", "refreshToken", "password", "ROOT_BOOTSTRAP", "BETA_KEYSTORE"):
        forbid(diagnostics_block, forbidden, f"Android diagnostics credential {forbidden}")
    web_diag = web.split("function supportDiagnostics()", 1)[1].split("function downloadSupportDiagnostics", 1)[0]
    for forbidden in ("id_token", "refresh_token", "password", "sessionStorage", "localStorage"):
        forbid(web_diag, forbidden, f"Web diagnostics credential {forbidden}")

    print("OPERATIONAL_SUPPORT_REGRESSION_PASS")


if __name__ == "__main__":
    main()
