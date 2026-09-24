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
    business_core = read("service/src/business-core.ts")
    operational_core = read("service/src/operational-v2-core.ts")
    runtime_logs = read("service/src/runtime-logs.ts")
    web_logger = read("web/src/runtime-logger.ts")
    web_realtime = read("web/src/realtime-client.ts")
    report_excel = read("web/src/report-excel.ts")
    unified_css = read("web/src/legacy-transplant/web-unified-ui.css")
    professional_css = read("web/src/legacy-transplant/web-professional-v2.css")
    sla_auto = read("service/src/sla-automation.ts")
    users_core = read("service/src/user-management-core.ts")
    users_api = read("service/src/user-management-api.ts")
    service_index = read("service/src/index.ts")
    system_status = read("service/src/system-status.ts")
    core = read("service/src/core.ts")
    read_model = read("service/src/read-model-core.ts")
    notifications_core = read("service/src/notifications-core.ts")
    operational_v2_core = read("service/src/operational-v2-core.ts")
    system_reset_core = read("service/src/system-reset-core.ts")
    user_management_core = read("service/src/user-management-core.ts")
    system_reset = read("service/src/system-reset.ts")
    system_reset_core = read("service/src/system-reset-core.ts")
    google_mail = read("service/src/google-mail.ts")
    app_tools = read("service/src/app-tools.ts")

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
    # D113: reference-inspired login, queue badge, independently switchable SLA controls and first-report correction window.
    require(app, 'Phát triển hệ thống · tamnv2 | Pick Pack 1291', "D113 developer footer")
    require(app, 'name="rememberLogin"', "D113 remember-login control")
    require(app, 'id="toggle-login-password"', "D113 password visibility control")
    require(app, "PasswordCredentialCtor", "D113 browser-managed password credential storage")
    forbid(app, 'localStorage.setItem("password"', "D113 forbids plaintext password localStorage")
    require(app, "nav-notice-badge", "D113 processing navigation count badge")
    require(app, 'name="warningEnabled"', "D113 warning enable control")
    require(app, 'name="escalationEnabled"', "D113 escalation enable control")
    require(app, 'name="skipToStockEnabled"', "D113 Skip-to-stock correction enable control")
    require(app, 'name="skipToStockMinutes"', "D113 Skip-to-stock correction window")
    require(app, 'autoSkipModeRaw', "D113 mandatory auto-skip mode validation")
    require(api, 'skip_to_stock_minutes: number', "D113 Web correction-window model")
    require(sla_auto, 'skip_to_stock_enabled: boolean', "D113 service correction-window switch")
    require(sla_auto, 'correctionDeadlineFromFirstReport', "D113 first-report correction deadline authority")
    require(sla_auto, 'config.warning_enabled', "D113 warning switch enforcement")
    require(sla_auto, 'config.escalation_enabled', "D113 escalation switch enforcement")
    require(app, 'const nextSla = await getAdminSla();', "D113 primary SLA config load independent of secondary insights")
    require(professional_css, "D113 — Owner refinement", "D113 final login/tools/SLA style layer")

    # D116: selected-SKU Picker detail is automatic without extra fetches; SKU and user admin are complete and safe.
    require(app, "pickerDetailMarkup(selected.batch_id, batchDetails.get(selected.batch_id), true)", "D116 automatic affected-Picker display")
    require(app, "getSkuCatalogInfo", "D116 SKU catalog metadata")
    require(app, 'id="sku-admin-search-form"', "D116 SKU search workspace")
    require(app, "excludedPickerIds", "D116 all-Picker exclusion model")
    require(app, 'user.role === "PICKER"', "D116 Picker-only bulk selection")
    require(api, "excluded_user_ids", "D116 bulk exclusion API")
    require(user_management_core, "excluded_user_ids", "D116 bulk exclusion authority")
    require(professional_css, "D116 — quota-safe admin refinement", "D116 professional admin style layer")

    # D072: quota-heavy system-status surface is excluded from normal runtime.
    require(app, 'navGroup("HỆ THỐNG", profile.role === "ROOT" && profile.base_role === "ROOT"', "D100 Root-only system group branching")
    require(app, '? [["logs", "Nhật ký"], ["tools", "Công cụ"], ["system-reset", "Đặt lại hệ thống"]]', "D100 Root-only system reset child")
    require(app, ': [["logs", "Nhật ký"], ["tools", "Công cụ"]])', "D088 non-Root system group journal and tools without quota status polling")

    # D100 OA020: failed Gmail sends must not consume the reset-code throttle, and provider failures stay safely classified.
    require(system_reset, "release_throttle: true", "D100 failed-mail throttle rollback")
    require(system_reset_core, "await state.storage.delete(`system-reset-throttle:${challenge.root_user_id}`);", "D100 reset-code throttle release")
    require(system_reset_core, "Vui lòng chờ ${retryAfterSeconds} giây", "D100 friendly reset-code retry message")
    require(google_mail, "GOOGLE_MAIL_GMAIL_API_DISABLED", "D100 Gmail API disabled classification")
    require(google_mail, "GOOGLE_MAIL_SCOPE_MISSING", "D100 Gmail scope classification")
    require(system_reset, "mailFailureMessage(detail)", "D100 safe mail-failure user message")

    # D106: managed-account creation/password must be directly usable by Agent Firebase auth.
    require(users_api, "deleteFirebaseUsers", "D106 failed-create Firebase compensation")
    require(users_api, "rollbackCreatedCredential", "D106 failed-create business rollback")
    require(users_api, "await updateFirebaseIdentity(", "D106 native Firebase password write")
    require(users_api, "{ password: plainPassword }", "D106 plaintext request-only native credential set")
    require(users_api, "signInWithFirebasePassword", "D106 direct Firebase password verification")
    require(users_api, "FIREBASE_DIRECT_PASSWORD_VERIFY_FAILED", "D106 direct Firebase UID verification guard")
    require(users_core, '"/admin/users/rollback-create"', "D106 internal create rollback route")
    require(users_core, "USER_CREATE_ROLLBACK_UNSAFE", "D106 rollback readiness safety guard")

    # D100 post-reset recovery: reset must leave the business runtime ready without a redeploy.
    require(operational_v2_core, 'url.pathname === "/operational/init"', "D100 Operational V2 self-repair route")
    require(core, "handleOperationalV2CoreRequest", "D100 Operational V2 core dispatcher")
    require(core, "const operationalV2 = await handleOperationalV2CoreRequest", "D100 Operational V2 request dispatch")
    require(system_reset_core, "initializeOperationalV2Schema(state);", "D100 runtime-reset Operational V2 rebootstrap")
    require(system_reset_core, "WHERE key <> 'realtime_stream_epoch_v1'", "D100 structural realtime epoch excluded from resettable config count")
    require(user_management_core, r'/^[^\s@]+@[^\s@]+\.[^\s@]+$/', "D100 managed-account email validation")
    forbid(user_management_core, r'/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/', "double-escaped managed-account email validation")
    require(user_management_core, "USER_CREATE_ADMIN_EMAIL_REQUIRED", "D100 actionable Admin email validation")
    require(app, 'skuImportProgress = `Đã dừng: ${message}`;', "D100 SKU import failure terminal progress")
    forbid(app, "getSystemStatus(", "D072 Web system-status API calls")
    forbid(app, '["system","devices","versions"].includes(activeSection)', "D072 system-status polling route")
    forbid(app, 'querySelector<HTMLButtonElement>("#refresh-system")', "D072 manual system-status refresh binding")
    require(service_index, "SYSTEM_STATUS_DISABLED_QUOTA_GUARD", "D072 disabled admin system-status route")
    require(service_index, "collectSystemStatus(env, false, false)", "D072 provider-free load-test snapshot")
    require(system_status, "includeProviders = true", "D072 provider gate parameter")
    require(system_status, 'D072_QUOTA_GUARD', "D072 provider-disabled marker")

    # D071: consistent controls, logical 100% = old 105%, compact dates, and immediate Reporter action feedback.
    require(app, "WEB_TEXT_BASE_SCALE = 1.05", "D071 logical 100 percent text baseline")
    require(unified_css, 'input[type="checkbox"]', "D071 global checkbox normalization")
    require(unified_css, "min-height: 16px !important", "D071 checkbox fixed geometry")
    require(app, "function renderCompactDateRange(", "D071 compact shared date range")
    require(unified_css, ".compact-date-range", "D071 compact date styling")
    require(app, "pendingReporterResolutions", "D071 per-batch Reporter pending state")
    require(app, 'runtimeLogMetric("ACTION", "reporter_resolution_immediate_feedback"', "D071 immediate feedback telemetry")
    require(app, "async function commitReporterResolution(", "D071 detached Reporter resolution flow")
    require(app, 'void commitReporterResolution(batch, "HAS_STOCK")', "D071 immediate HAS_STOCK flow")
    require(app, 'void commitReporterResolution(batch, "SKIP_ALLOWED")', "D071 immediate Skip flow")
    require(app, "pendingReporterResolutions.set(batch.batch_id, resolution);\n  stockConfirm = null;\n  skipConfirm = null;\n  patchOverlays();", "D071 synchronous modal close before request wait")
    require(app, "async function loadOperationsSnapshot()", "D071 operations snapshot loader")
    require(app, "operationsLoadPromise", "D071 coalesced operations load")
    forbid(app, 'await resolveReporterBatch(batch.batch_id, "HAS_STOCK");\n      await loadOperations();', "D071 blocking HAS_STOCK refresh chain")
    forbid(app, 'await resolveReporterBatch(batch.batch_id, "SKIP_ALLOWED");\n      await loadOperations();', "D071 blocking Skip refresh chain")

    # D088: naming, persistent single interactive session and Web tools.
    require(app, "<h1>Website nghiệp vụ Inventory</h1>", "D088 Web product name")
    require(app, '["tools", "Công cụ"]', "D088 tools navigation")
    require(app, "Agent Auto Confirm Pick Pack", "D088 Agent product surface")
    require(app, "getAgentAppRelease", "D112 dynamic Agent release metadata")
    require(app, '"/downloads/agent/latest"', "D112 stable Agent download route")
    forbid(app, "AGENT_DOWNLOAD_URL", "D112 forbids hard-coded Agent release URL in operational Web runtime")
    require(service_index, 'url.pathname === "/api/admin/agent-app"', "D112 Agent release metadata route")
    require(service_index, 'url.pathname === "/downloads/agent/latest"', "D112 stable Agent download redirect")
    require(api, 'localStorage.getItem(SESSION_KEY)', "D088 Web persistent session")
    require(api, 'client_type: "WEB"', "D088 Web session channel")
    require(core, "session_generation", "D088 server session generation")
    require(service_index, "SESSION_REPLACED", "D088 replaced-session guard")
    require(service_index, "activateInteractiveSession", "D088 login invalidates previous Web/APK session")

    # D089: field-review fixes for approved icon, independent service/realtime status and Tools dark theme.
    require(app, 'id="realtime-state"', "D089 separate realtime header state")
    require(app, "function realtimeStatusLabel()", "D089 realtime status label")
    require(app, '/app-icon.png', "D089 approved Web icon")
    forbid(app, 'serviceReachable = navigator.onLine && realtimeState === "connected"', "D089 realtime must not overwrite service health")
    require(unified_css, "D089 — Tools dark-theme completion", "D089 Tools dark-theme completion")
    require(unified_css, ".tool-icon-image", "D089 Tools approved icon styling")

    # D107: professional Web identity and richer reporting without new data authority.
    require(app, 'class="login-brand-lockup"', "D107 login brand lockup")
    require(app, "CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN", "D107 corporate login identity")
    forbid(app, '<div class="brand">1291</div>', "D107 legacy numeric login brand")
    forbid(app, "<h1>Web nghiệp vụ</h1>", "D107 legacy login title")
    forbid(app, "Đăng nhập bằng tài khoản Báo hàng 1291.", "D107 legacy login subtitle")
    require(app, './legacy-transplant/web-professional-v2.css', "D107 final professional CSS import")
    require(professional_css, ".pro-trend-chart", "D107 trend presentation")
    require(professional_css, ".pro-report-analysis", "D107 detailed report presentation")
    require(professional_css, 'body[data-theme="dark"]', "D107 dark presentation")
    require(app, "affectedInPeriod", "D107 affected-Picker overview metric")
    require(app, "reportWarningCount", "D107 report attention metric")
    require(app, "row.open_ticket_count", "D107 report open-ticket detail")
    require(app, 'data-dashboard-sku="${esc(row.sku)}"', "D107 top-SKU drilldown")

    # D108: password recovery stays collapsed until explicit action and result provenance is visible.
    require(professional_css, ".login-reset-form[hidden]", "D108 reset form hidden selector")
    require(professional_css, "display: none !important", "D108 reset form forced hidden state")
    require(app, "resolutionSourceLabel", "D108 resolution source formatter")
    require(app, "resolutionActorLabel", "D108 resolution actor formatter")
    require(app, "Tự động bỏ qua quá hạn", "D108 automatic timeout reporting")
    require(app, "Bỏ qua bởi nhân sự", "D108 human skip reporting")
    require(app, "<th>Nguồn xử lý</th><th>Người xử lý</th>", "D108 audit columns")
    require(business_core, "resolution_sources", "D108 dashboard resolution-source aggregate")
    require(business_core, "resolved_by_display_name", "D108 report resolver display name")
    require(business_core, "resolved_by_employee_code", "D108 report resolver employee code")
    require(operational_core, "b.resolution_source", "D108 recent result source")
    require(operational_core, "resolved_by_display_name", "D108 recent resolver display name")

    # D109: per-user Dashboard preference, global SLA, bounded audit history and latest-PDA tooling.
    require(app, "let dashboardFrom = dateDaysAgo(0);", "D109 Dashboard defaults to today")
    require(app, "getDashboardPreference", "D109 Dashboard preference read")
    require(app, "saveDashboardPreference", "D109 Dashboard preference write")
    require(api, '"/api/admin/dashboard-preference"', "D109 Dashboard preference API")
    require(business_core, '"dashboard_range_v1:" + userId', "D109 server per-user Dashboard preference key")
    require(app, "Cấu hình chung toàn hệ thống", "D109 global SLA user-facing authority")
    require(business_api, 'event: "sla_settings_updated"', "D109 SLA realtime event")
    require(business_api, 'scopes: ["sla_settings", "reporter_queue"]', "D109 SLA realtime scope")
    require(app, 'scopes.has("sla_settings")', "D109 SLA active-view realtime reconcile")
    require(app, "Lịch sử thao tác", "D109 management audit tab")
    require(business_core, "actor_display_name", "D109 audit actor display identity")
    require(business_core, "actor_role", "D109 audit actor role")
    require(business_core, "IN ('REPORTER','ADMIN','ROOT')", "D109 audit excludes Picker")
    require(business_core, "safeAuditMetadata", "D109 audit metadata sanitizer")
    require(app, "recent_resolutions", "D109 Dashboard recent resolutions")
    require(app, "Người xử lý", "D109 resolver identity presentation")
    require(app, "QRCode.toDataURL", "D109 local QR generation")
    require(app, "App PDA", "D109 PDA tools card")
    require(service_index, 'url.pathname === "/downloads/pda/latest"', "D109 stable latest-PDA route")
    require(service_index, 'url.pathname === "/api/admin/pda-app"', "D109 PDA release metadata route")
    forbid(app_tools, 'https://api.github.com/repos/tamnv2/supra-inventory/releases?per_page=30', "D112 forbids runtime GitHub Releases REST enumeration")
    require(app_tools, 'const CHANNEL_TAG = "inventory-channel";', "D112 fixed project release channel")
    require(app_tools, 'const PDA_MANIFEST_URL = `${CHANNEL_BASE}/pda-latest.json`;', "D112 PDA channel manifest")
    require(app_tools, 'const PDA_ASSET_NAME = "supra-inventory-beta.apk";', "D112 canonical APK asset")
    require(app_tools, 'const AGENT_MANIFEST_URL = `${CHANNEL_BASE}/agent-latest.json`;', "D112 Agent channel manifest")
    require(app_tools, 'stable_download_path: "/downloads/pda/latest"', "D109 version-independent PDA download path")
    require(app_tools, 'stable_download_path: "/downloads/agent/latest"', "D112 version-independent Agent download path")
    forbid(app, 'downloads/beta-vc', "D109 no hard-coded Beta tag in PDA tools URL")
    require(core, "const SCHEMA_VERSION = 11;", "D109 additive audit schema target")
    require(core, 'ALTER TABLE audit_log ADD COLUMN actor_role TEXT', "D109 audit role migration")
    require(core, 'ALTER TABLE audit_log ADD COLUMN actor_display_name TEXT', "D109 audit display migration")

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
