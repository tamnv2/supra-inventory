#!/usr/bin/env python3
"""Regression guards for Web operational P1 contracts."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    raise SystemExit(f"WEB_OPERATIONAL_REGRESSION_FAIL: {message}")


def require(text: str, marker: str, name: str) -> None:
    if marker not in text:
        fail(f"missing {name}: {marker}")


def forbid(text: str, marker: str, name: str) -> None:
    if marker in text:
        fail(f"forbidden {name}: {marker}")


def main() -> None:
    app = read("web/src/operational-app.ts")
    api = read("web/src/api.ts")
    operational_api = read("web/src/operational-api.ts")
    business_api = read("service/src/business-api.ts")
    operational_core = read("service/src/operational-v2-core.ts")
    runtime_logs = read("service/src/runtime-logs.ts")
    web_logger = read("web/src/runtime-logger.ts")
    web_realtime = read("web/src/realtime-client.ts")
    report_excel = read("web/src/report-excel.ts")
    unified_css = read("web/src/legacy-transplant/web-unified-ui.css")
    sla_auto = read("service/src/sla-automation.ts")
    users_core = read("service/src/user-management-core.ts")
    users_api = read("service/src/user-management-api.ts")
    service_index = read("service/src/index.ts")
    core = read("service/src/core.ts")
    read_model = read("service/src/read-model-core.ts")
    notifications_core = read("service/src/notifications-core.ts")

    # F08: realtime/search updates preserve active context instead of rebuilding the full shell.
    require(app, "function captureUiContext()", "UI context capture")
    require(app, "function restoreUiContext(", "UI context restore")
    require(app, "patchActiveSection(true);", "realtime active-section patch")
    require(app, "pickerSearchGeneration", "SKU search generation")
    require(app, "requestedQuery !== pickerQuery", "stale SKU response rejection")

    # F17: one session/refresh manager and cross-session stale response rejection.
    require(operational_api, 'import { authorizedFetch, readJson } from "./api";', "shared authorized client")
    forbid(operational_api, "SESSION_KEY", "second session store")
    forbid(operational_api, "function readSession", "second session reader")
    forbid(operational_api, "async function refresh(", "second refresh flow")
    require(app, "sessionViewGeneration", "session view generation")
    require(app, 'userId !== (profile?.user_id || "")', "cross-session response guard")
    require(api, "let refreshPromise: Promise<void> | null = null;", "single-flight refresh")

    # F18: no ambiguous prompt/confirm account edit semantics; password remains masked form input.
    forbid(app, "window.prompt(", "window.prompt managed-account editing")
    forbid(app, "OK = ACTIVE, Cancel = DISABLED", "cancel-means-disable behavior")
    require(app, 'id="edit-user-form"', "explicit user edit form")
    require(app, 'id="password-user-form"', "explicit password form")
    require(app, 'type="password" autocomplete="new-password"', "masked managed password input")

    # F10 carried into Web package: fetched != displayed.
    forbid(app, ".then(() => markPickerResult", "DISPLAYED chained immediately after RECEIVED")
    require(app, 'markPickerResult(visibleResult.result_event_id, visibleResult.batch_id, visibleResult.batch_version, "DISPLAYED")', "visible-result DISPLAYED stage")

    # F16: bounded server-side users query + one/many/all Picker operations.
    require(users_api, '"offset"', "user API offset forwarding")
    require(users_core, "COUNT(*) AS total", "user total query")
    require(users_core, "LIMIT ? OFFSET ?", "user SQL pagination")
    forbid(users_core, "LIMIT 1000", "fixed 1000-row user load")
    require(app, 'id="toggle-all-pickers"', "select all Picker UI")
    require(app, "updatePickerAccounts(action, ids, allPickerSelection)", "all Picker action propagation")

    # F15: approved dashboard/reporting controls.
    require(app, "renderDatePresets(", "shared date presets")
    require(app, "dashboardData?.timeline", "trend surface")
    require(app, "dashboardData?.outcomes", "outcome surface")
    require(app, "data-dashboard-sku", "dashboard drill-down")
    require(app, "async function exportReportsExcel()", "bounded Excel export")
    require(report_excel, 'XLSX.writeFile', "native Excel workbook writer")
    require(report_excel, '.xlsx', "Excel file extension")
    forbid(app, "Xuất CSV", "obsolete CSV export action")
    forbid(app, "text/csv", "obsolete CSV MIME export")
    require(app, "limit: pageSize", "chunked reporting export")

    # D067: complete queue, stable list context, confirmation guard and log de-duplication.
    require(api, "getReporterQueue(limit = 100, offset = 0)", "reporter queue client pagination")
    require(business_api, 'url.searchParams.has("offset")', "reporter queue offset forwarding")
    require(operational_core, "COUNT(*) AS total", "reporter queue total count")
    require(operational_core, "LIMIT ? OFFSET ?", "reporter queue bounded pagination")
    require(app, "async function loadCompleteReporterQueue()", "complete queue pager")
    require(app, 'data-queue-filter="ALL"', "all pending summary filter")
    require(app, 'data-queue-filter="WARNING"', "warning summary filter")
    require(app, 'data-queue-filter="ESCALATED"', "overdue summary filter")
    require(app, "mainScrollTop", "main workspace scroll preservation")
    require(app, '".fast-list"', "nested queue scroll preservation")
    require(app, "prefetchBatchDetails", "affected Picker prefetch")
    require(app, "picker-detail-row", "one Picker per row")
    require(app, "renderStockModal", "HAS_STOCK confirmation")
    require(app, "SKIP_CONFIRM_DELAY_MS = 5_000", "five-second Skip confirmation delay")
    require(app, 'id="skip-delay-setting"', "per-user Skip delay setting")
    require(web_logger, "scheduledSendInFlight", "single-flight scheduled Web log")
    require(runtime_logs, 'status: "already_uploaded"', "runtime log filename idempotency")
    forbid(app, "Beta / Logs", "internal environment log copy")
    forbid(app, "Tự gửi định kỳ", "internal log schedule copy")

    # D068: instant route feedback, browser history, toast notices and targeted SKU detail refresh.
    require(app, "function navigateToSection(", "instant section navigation")
    require(app, 'window.history.pushState({ section }', "section history push")
    require(app, 'window.addEventListener("popstate"', "browser back/forward handler")
    require(app, 'navigateToSection("reports", "push")', "dashboard drilldown history")
    forbid(app, 'void run(async () => { await loadSection(next); });', "blocking section navigation")
    require(app, "function ensureToastRoot()", "toast root")
    require(app, "toastItems = [...toastItems, item].slice(-5)", "maximum five toasts")
    require(app, "window.setTimeout(() => dismissToast(item.id), 5_000)", "five-second toast expiry")
    forbid(app, "function renderNotice()", "top notice banner")
    require(app, "function refreshFastDetailOnly()", "targeted SKU detail refresh")
    require(app, "button.classList.add(\"selected\")", "instant selected SKU state")
    forbid(app, "Service: Cloudflare", "internal header service label")
    forbid(app, "InventoryCore · Durable Object SQLite", "internal database label")
    forbid(app, "Thông tin kỹ thuật chi tiết", "raw technical UI panel")
    forbid(app, "Master SKU", "internal master-catalogue copy")
    require(app, "function renderRuntimeLogSummary()", "readable runtime log summary")
    require(app, "Tóm tắt nhật ký", "human-readable log detail title")
    forbid(app, "JSON.stringify(runtimeLogDetail.content", "raw runtime log JSON detail")
    forbid(app, "${esc(item.name)}", "raw runtime log filename")

    # D069: rich redacted diagnostics, Excel, unified UI and reduced shell rebuilds.
    require(web_logger, "export function runtimeLogMetric(", "structured runtime telemetry")
    require(web_logger, 'PerformanceObserver', "long-task observer")
    require(web_logger, '"supra:api-telemetry"', "API telemetry listener")
    require(web_logger, '"supra:realtime-telemetry"', "realtime telemetry listener")
    require(web_logger, 'document.addEventListener("click"', "safe interaction telemetry")
    require(web_logger, 'document.addEventListener("change"', "safe control-change telemetry")
    require(web_logger, "query_keys", "query-key-only resource telemetry")
    forbid(web_logger, "input.value", "typed input value logging")
    require(api, 'new CustomEvent("supra:api-telemetry"', "API timing event")
    require(web_realtime, 'new CustomEvent("supra:realtime-telemetry"', "realtime timing event")
    require(runtime_logs, "max_file_chars: 192000", "expanded bounded sanitized log envelope")
    require(runtime_logs, "content.length > 192_000", "runtime log hard size bound")
    require(app, 'renderMode: "section" | "full" | "none"', "scoped action render modes")
    require(app, 'else if (renderMode === "section")', "section-only normal action rendering")
    require(app, 'run(exportReportsExcel, "none")', "export without UI rebuild")
    require(app, './legacy-transplant/web-unified-ui.css', "final unified Web CSS layer")
    require(app, 'class="ops-route sla-workspace"', "unified SLA workspace")
    require(unified_css, "content-visibility: auto", "off-screen queue rendering containment")
    require(unified_css, ".sla-config-footer", "professional SLA save layout")

    # SLA UI/server contract must agree.
    require(app, 'warning > 1440', "SLA warning upper bound")
    require(app, 'escalation > 2880', "SLA escalation upper bound")
    require(app, 'autoSkip > 10080', "D070 automatic-Skip upper bound")
    require(app, 'autoSkip <= escalation', "D070 strict three-threshold ordering")
    require(app, 'name="autoSkipEnabled"', "D070 automatic-Skip enable control")
    require(app, 'name="autoSkipMode" value="FIRST_REPORT"', "D070 first-report mode control")
    require(app, 'name="autoSkipMode" value="PER_PICKER"', "D070 per-Picker mode control")
    require(app, "announceDeadlineEvents", "D070 foreground alert handler")
    require(app, "browserBackgroundNotice", "D070 optional browser background alerts")
    require(api, 'auto_skip_mode: AutoSkipMode', "D070 Web config model")
    require(sla_auto, 'auto_skip_mode: AutoSkipMode', "D070 service config model")
    require(unified_css, ".sla-threshold-grid", "D070 three-threshold layout")
    require(unified_css, ".sla-auto-policy", "D070 automatic-Skip policy layout")

    # D060: Root can temporarily lower its effective role, and the service—not the client—enforces it.
    require(api, "setRootEffectiveRole", "Root effective-role client API")
    require(app, 'profile.base_role === "ROOT"', "Root selector visibility guard")
    require(service_index, '"/api/auth/root-role"', "Root effective-role service route")
    require(service_index, 'actor.base_role !== "ROOT"', "Root base-role authorization")
    require(core, "role_override", "Root role override storage")
    require(core, '"/auth/root-role-override"', "Root role override core route")
    require(read_model, '"/realtime/close-user"', "role-change realtime revocation route")
    require(read_model, '"role-changed"', "role-change realtime close reason")
    require(notifications_core, "role_override", "effective-role FCM targeting")

    print("WEB_OPERATIONAL_REGRESSION_PASS")


if __name__ == "__main__":
    main()
