#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

WEB_MAIN = read("web/src/main.ts")
WEB_INDEX = read("web/index.html")
WEB_APP = read("web/src/operational-app.ts")
WEB_UI = "\n".join([WEB_MAIN, WEB_APP])
WEB_API = read("web/src/api.ts")
WEB_RT = read("web/src/realtime-client.ts")
WEB_LOGGER = read("web/src/runtime-logger.ts")
WEB_LEGACY_BASE = read("web/src/legacy-transplant/style.css")
WEB_FAST = read("web/src/legacy-transplant/web-fast-ui.css")
WEB_DASH = read("web/src/legacy-transplant/workflow-dashboard-v5.css")
WEB_WAREHOUSE = read("web/src/legacy-transplant/warehouse-ui-v2.css")
WEB_OPS = read("web/src/legacy-transplant/ops-console.css")
WEB_UNIFIED = read("web/src/legacy-transplant/web-unified-ui.css")
WEB_PRO = read("web/src/legacy-transplant/web-professional-v2.css")
WEB_REPORT_EXCEL = read("web/src/report-excel.ts")

ANDROID_MAIN = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt")
ANDROID_PICKER = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt")
ANDROID_REPORTER = read("android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt")
ANDROID_RT = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidRealtimeClient.kt")
ANDROID_API = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
ANDROID_MANIFEST = read("android/app/src/main/AndroidManifest.xml")
ANDROID_LOGIN_XML = read("android/app/src/main/res/layout/activity_login.xml")
ANDROID_MAIN_XML = read("android/app/src/main/res/layout/activity_main.xml")
ANDROID_PICKER_XML = read("android/app/src/main/res/layout/view_picker.xml")
ANDROID_INVENT_XML = read("android/app/src/main/res/layout/view_invent.xml")
ANDROID_ADMIN_XML = read("android/app/src/main/res/layout/view_admin.xml")
ANDROID_ROW_XML = read("android/app/src/main/res/layout/row_issue.xml")
ANDROID_REPORTER_ROW_XML = read("android/app/src/main/res/layout/row_reporter_issue.xml")
ANDROID_REPORTER_BADGE_IDLE = read("android/app/src/main/res/drawable/bg_reporter_tab_badge_idle.xml")
ANDROID_COLORS = read("android/app/src/main/res/values/colors.xml")
ANDROID_STYLES = read("android/app/src/main/res/values/styles.xml")
ANDROID_ICON = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml")
ANDROID_ICON_ROUND = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml")
ANDROID_APPROVED_ICON_EXISTS = (ROOT / "android/app/src/main/res/drawable-nodpi/app_icon_d089.png").is_file()
WEB_APPROVED_ICON_EXISTS = (ROOT / "web/public/app-icon.png").is_file()
ANDROID_ALL = "\n".join([ANDROID_MAIN, ANDROID_PICKER, ANDROID_REPORTER])

SERVICE_OPS = read("service/src/operational-v2-core.ts")
SERVICE_BUSINESS = read("service/src/business-api.ts")
SERVICE_BUSINESS_CORE = read("service/src/business-core.ts")
SERVICE_READ = read("service/src/read-api.ts")
SERVICE_USERS = read("service/src/user-management-core.ts")
SERVICE_INDEX = read("service/src/index.ts")
SERVICE_CORE = read("service/src/core.ts")
SERVICE_READ_MODEL = read("service/src/read-model-core.ts")
SERVICE_NOTIFICATIONS = read("service/src/notifications-core.ts")
SERVICE_RUNTIME_LOGS = read("service/src/runtime-logs.ts")
SERVICE_SLA_AUTO = read("service/src/sla-automation.ts")
SERVICE_SYSTEM_STATUS = read("service/src/system-status.ts")
SERVICE_SYSTEM_METRICS = read("service/src/system-metrics-core.ts")
BETA_LOAD_TEST = read("tools/beta-load-test.mjs")
BETA_LOAD_WORKFLOW = read(".github/workflows/beta-load-test.yml")
VERIFY_APPS = read(".github/workflows/verify-apps.yml")
DESIGN_SPEC = read("docs/specs/UI_DESIGN_SYSTEM.md")
DECISIONS = read("docs/OWNER_DECISIONS.md")

checks = {
    "authority_direct_legacy_transplant": "D057" in DECISIONS and "direct legacy presentation transplant" in DESIGN_SPEC.lower(),
    "authority_d058_owner_web_review": "D058" in DECISIONS and "Owner-reviewed desktop shell refinement" in DESIGN_SPEC,
    "authority_d059_web_header_review": "D059" in DECISIONS and "Owner-reviewed header and identity refinement" in DESIGN_SPEC,
    "authority_d060_root_role_theme_review": "D060" in DECISIONS and "Owner-reviewed Root test-role and theme refinement" in DESIGN_SPEC,
    "authority_d061_dark_realtime_sidebar_review": "D061" in DECISIONS and "Owner-reviewed dark/realtime/sidebar cleanup" in DESIGN_SPEC,
    "authority_d062_web_completion_review": "D062" in DECISIONS and "Owner-reviewed completion audit and canonical navigation IA (D062)" in DESIGN_SPEC,
    "authority_d063_ops_logs_reporting_review": "D063" in DECISIONS and "Owner-reviewed consolidated operations, logs, reporting and people UI (D063)" in DESIGN_SPEC,
    "authority_d064_system_load_review": "D064" in DECISIONS and "Detailed operational system-status console (D064)" in DESIGN_SPEC,
    "authority_d065_three_group_navigation": "D065" in DECISIONS and "Owner three-group navigation refinement (D065)" in DESIGN_SPEC,
    "authority_d066_three_group_implementation": "D066" in DECISIONS and "Owner-approved three-group navigation implementation (D066)" in DESIGN_SPEC,
    "authority_d067_web_ux_refinement": "D067" in DECISIONS and "Owner-accepted Web refinement baseline (D067)" in DESIGN_SPEC,
    "authority_d068_web_navigation_toast_performance": "D068" in DECISIONS and "Owner Web interaction refinement (D068)" in DESIGN_SPEC,
    "authority_d069_web_diagnostics_excel_unification": "D069" in DECISIONS and "Owner-accepted D068 baseline and D069 unified Web refinement" in DESIGN_SPEC,
    "authority_d070_three_stage_auto_skip": "D070" in DECISIONS and "D070 three-stage timing UI" in DESIGN_SPEC,
    "authority_d072_system_status_quota_exclusion": "D072" in DECISIONS and "D072 quota guard — system-status excluded" in DESIGN_SPEC,
    "authority_d074_picker_split_relay_repair": "D074" in DECISIONS and "D074 — Picker dense split-operation navigation" in DESIGN_SPEC,
    "authority_d089_field_review_repair": "D089" in DECISIONS and "D089 field-review repair" in DESIGN_SPEC,
    "authority_ui_acceptance_distinct_from_ci": "CI/build PASS" in DESIGN_SPEC and "Owner UI" in DESIGN_SPEC,
    "authority_no_offline_mode": "D043" in DECISIONS and "No offline business mode" in DESIGN_SPEC,

    "web_entrypoint_active": 'import "./operational-app"' in WEB_MAIN,
    "web_transplanted_styles_loaded": all(token in WEB_APP for token in [
        './legacy-transplant/style.css',
        './legacy-transplant/web-fast-ui.css',
        './legacy-transplant/workflow-dashboard-v5.css',
        './legacy-transplant/warehouse-ui-v2.css',
        './legacy-transplant/ops-console.css',
    ]),
    "web_legacy_login_shell": 'class="login-shell"' in WEB_APP and 'class="login-card"' in WEB_APP and "Lấy lại mật khẩu" in WEB_APP,
    "web_legacy_admin_shell": all(token in WEB_APP for token in ['class="app-shell', 'class="topbar"', 'class="tabs"', 'class="content main"']),
    "web_d058_no_centering_shell_class": 'class="app-shell shell' not in WEB_APP,
    "web_d058_test_strip_removed": "Kiểm thử giao diện + quyền server" not in WEB_APP and 'class="test-tools"' not in WEB_APP,
    "web_d058_rejected_prose_removed": all(token not in WEB_APP for token in [
        "Realtime · cập nhật đúng SKU, không tải lại toàn màn hình.",
        "Hỗ trợ file lớn theo từng phần xử lý; dữ liệu hiện có không bị xoá chỉ vì file mới không chứa.",
        "Tạo tài khoản nghiệp vụ ngoài danh sách Picker nguồn.",
        "Theo dõi kết nối và kênh cập nhật.",
        "Log hỗ trợ chỉ chứa trạng thái kỹ thuật đã giới hạn và che thông tin nhạy cảm.",
        "Cấu hình mốc cảnh báo và mốc quá hạn.",
    ]),
    "web_d058_fixed_full_workspace": all(token in WEB_FAST for token in [
        "D058 Owner Web review",
        "grid-template-rows: auto minmax(0, 1fr)",
        "overflow-y: auto",
        ".app-footer",
        "max-width: none !important",
    ]),
    "web_d058_credit": "Phát triển hệ thống · tamnv2 | Pick Pack 1291" in WEB_APP,
    "web_d059_corporate_header": all(token in WEB_APP for token in [
        "CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN",
        "Website nghiệp vụ Inventory",
        "Dịch vụ:",
        "Cập nhật:",
    ]),
    "web_d059_role_labels": all(token in WEB_APP for token in ["Quản trị hệ thống", "Người báo hàng", "Người lấy hàng"]),
    "web_d059_identity_fields": all(token in WEB_APP for token in ['class="header-user-identity"', 'id="logout"']),
    "web_d059_no_top_password": "change-password-top" not in WEB_APP,
    "web_d059_update_timestamp_event_driven": all(token in WEB_APP for token in [
        "lastWebUpdateAt",
        "markWebUpdateReceived",
        "events.length > 0",
        "formatHeaderUpdate",
    ]),
    "web_d059_service_reachability": all(token in WEB_APP for token in [
        "serviceReachable",
        'data-state="',
        'realtimeState === "connected"',
    ]),
    "web_d089_service_realtime_separation": all(token in WEB_APP for token in [
        'id="realtime-state"',
        "realtimeStatusLabel",
        "Đồng bộ:",
    ]) and 'serviceReachable = navigator.onLine && realtimeState === "connected"' not in WEB_APP,
    "web_d059_left_nav_and_font": all(token in WEB_FAST for token in [
        "D059 Owner Web review",
        '"Segoe UI Variable Text"',
        '"Aptos"',
        "text-align: left !important",
        ".header-user-identity",
    ]),
    "web_d060_identity_compact": all(token in WEB_APP for token in [
        'class="header-user-identity"',
        "profile.display_name",
        "legacyRoleLabel(profile.role)",
    ]) and all(token not in WEB_APP for token in ["<b>Tên:</b>", "<b>User:</b>", "<b>Quyền:</b>"]),
    "web_d060_root_role_selector": all(token in WEB_APP for token in [
        'id="root-role-select"',
        'profile.base_role === "ROOT"',
        "setRootEffectiveRole(role)",
        'if (role === "ROOT") return "Quản trị hệ thống";',
        'if (role === "REPORTER") return "Người báo hàng";',
        'return "Người lấy hàng";',
    ]),
    "web_d060_theme_selector": all(token in WEB_APP for token in [
        'id="theme-mode"',
        "Tự động",
        "Sáng",
        "Tối",
        "autoThemeIsDark",
        "hour >= 18 || hour < 6",
    ]),
    "web_d060_dark_theme": all(token in WEB_FAST for token in [
        "D060 Owner Web review",
        'body[data-theme="dark"]',
        "--fast-bg: #0b1220",
        ".header-user-identity",
        ".root-role-control",
    ]),
    "web_d060_dashboard_head_simplified": "v5-head-meta" not in WEB_APP and "Mở xử lý báo thiếu" not in WEB_APP,
    "web_legacy_left_sidebar_geometry": "grid-template-columns: 216px minmax(0, 1fr)" in WEB_FAST and "flex-direction: column" in WEB_FAST and ".nav-section-label" in WEB_FAST,
    "web_legacy_dashboard_composition": all(token in WEB_APP for token in ["v5-root", "Tổng quan & báo cáo", "business-summary-grid", "Khối lượng trong kỳ", "SKU phát sinh nhiều"]),
    "web_legacy_reporter_workspace": all(token in WEB_APP for token in ["fast-events", "fast-workspace", "fast-list", "fast-detail", "Vận hành báo hàng"]),
    "web_d061_nav_icons": all(token in WEB_APP for token in ["function navIcon", 'class="nav-icon"', "group-operations"]) and all(token in WEB_FAST for token in ["D061 Owner Web review", ".nav-section-label", ".nav-icon"]),
    "web_d061_generic_refresh_removed": all(token not in WEB_APP for token in ["refresh-operations", "refresh-results", "refresh-picker", "refresh-users"]),
    "web_d061_dark_surface_coverage": all(token in WEB_FAST for token in ["D061 Owner Web review", ".fast-workspace", ".fast-issue-row", ".table-wrap", "tbody tr", ".ops-status-strip"]),
    "web_d065_three_group_nav_ia": all(token in WEB_APP for token in [
        'navGroup("VẬN HÀNH", [["operations", "Xử lý báo hàng"], ["dashboard", "Tổng quan & báo cáo"]])',
        'navGroup("QUẢN LÝ", [["sku", "Danh mục SKU"], ["users", "Nhân sự & tài khoản"], ["sla", "Thời gian xử lý"]])',
        'navGroup("HỆ THỐNG", profile.role === "ROOT" && profile.base_role === "ROOT"',
        '? [["logs", "Nhật ký"], ["tools", "Công cụ"], ["system-reset", "Đặt lại hệ thống"]]',
        ': [["logs", "Nhật ký"], ["tools", "Công cụ"]])',
        'if (value.role === "PICKER") return "picker";\n  return "operations";',
    ]) and all(token not in WEB_APP for token in [
        'navGroup("DỮ LIỆU"',
        'navGroup("QUẢN TRỊ"',
        'navGroup("BÁO CÁO"',
        'navButton("account", "Tài khoản & mật khẩu")',
        '"hr", "Nguồn nhân sự"',
    ]) and "Hạ tầng & chi phí" not in WEB_APP,
    "web_d065_personal_account_in_identity": all(token in WEB_APP for token in [
        'class="ghost header-account-action',
        'data-section="account">Tài khoản</button>',
        'id="logout"',
    ]),
    "web_d065_people_workspace_tabs": all(token in WEB_APP for token in [
        "function renderPeopleTabs",
        'data-workspace-section="users"',
        'data-workspace-section="hr"',
        "Nguồn nhân sự & đồng bộ Picker",
    ]),
    "web_d062_dark_transient_coverage": all(token in WEB_FAST for token in [
        "D062 final Web QA",
        ".picker-chip",
        ".realtime-notice",
        '.message[data-type="error"]',
        ".badge.closed",
        ".v5-rank-row > b",
    ]),
    "web_d062_sidebar_hierarchy": all(token in WEB_FAST for token in ["font-size: 13px !important", ".nav-section-label .nav-icon", "width: 15px"]),
    "web_d066_nav_children_within_owner_limit": all(token in WEB_APP for token in [
        'navGroup("VẬN HÀNH", [["operations", "Xử lý báo hàng"], ["dashboard", "Tổng quan & báo cáo"]])',
        'navGroup("QUẢN LÝ", [["sku", "Danh mục SKU"], ["users", "Nhân sự & tài khoản"], ["sla", "Thời gian xử lý"]])',
        '? [["logs", "Nhật ký"], ["tools", "Công cụ"], ["system-reset", "Đặt lại hệ thống"]]',
        ': [["logs", "Nhật ký"], ["tools", "Công cụ"]])',
        'return navGroup("VẬN HÀNH", [["operations", "Xử lý báo hàng"]]);',
    ]) and WEB_APP.count('["system-reset", "Đặt lại hệ thống"]') == 1,
    "web_d063_merged_workspaces": all(token in WEB_APP for token in [
        "renderOperationalTabs",
        "renderReportTabs",
        "Người đang online theo quyền",
        "Thời gian xử lý bình quân",
        "Picker đã nhận kết quả",
    ]) and all(token not in WEB_APP for token in ["P95", "Xử lý trung vị", "Picker ACK trễ"]),
    "web_d063_people_layout": all(token in WEB_APP for token in ["users-top-grid", "Tạo tài khoản nghiệp vụ", "Tìm và lọc tài khoản", "user-bulk-bar"]) and all(token in WEB_FAST for token in ["users-top-grid", "users-form-grid", "user-bulk-bar"]),
    "web_d063_runtime_logs": all(token in WEB_LOGGER for token in ["scheduled_", "window_error", "unhandled_promise_rejection", "maybeSendScheduledWebLog"]) and all(token in WEB_APP for token in ["Log Web", "Log Android", "send-web-log"]) and "Beta / Logs" not in WEB_APP and all(token in SERVICE_RUNTIME_LOGS for token in ["REDACTED", "LOGS_FOLDER_ID", "uploadRuntimeLog", "listRuntimeLogs"]),
    "service_d063_presence_by_role": "online_users_by_role" in SERVICE_READ_MODEL and "online_users_by_client" in SERVICE_READ_MODEL,
    "android_d063_runtime_logs": all(token in ANDROID_MAIN for token in ["currentRuntimeLogSlot", "scheduled_", "pending_crash", "android_crash", "Gửi lên Drive"]) and "uploadRuntimeLog" in ANDROID_API,
    "web_d063_dark_completion": all(token in WEB_FAST for token in ["D063 Owner operations/reporting/logs/users completion", ".business-summary-card", ".logs-layout", ".users-top-grid", 'body[data-theme="dark"]']),
    "web_d064_system_status_layout": all(token in WEB_APP for token in [
        "function renderSystem()", "Cloudflare", "Cơ sở dữ liệu nghiệp vụ", "Bài kiểm tra tải gần nhất",
    ]) and "D072" in DECISIONS,
    "web_d064_system_status_dark": all(token in WEB_FAST for token in [
        "D064 detailed system status", ".system-service-grid", ".system-limit-box", ".system-meter",
        ".system-load-grid", 'body[data-theme="dark"] .system-refresh-note',
    ]),
    "service_d064_system_metrics": all(token in (SERVICE_SYSTEM_STATUS + SERVICE_SYSTEM_METRICS + SERVICE_INDEX + SERVICE_CORE) for token in [
        "/api/admin/system-status", "/admin/system-metrics", "databaseSize", "storageQuota",
        "provider_cache_seconds", "online_users", "reports_last_10_minutes",
    ]),
    "service_d064_plan_not_inferred": all(token in SERVICE_SYSTEM_STATUS for token in [
        "plan_detected: false", "Runtime không có quyền đọc entitlement", "Project billing plan không được suy đoán",
    ]),
    "service_d064_provider_cache": "PROVIDER_CACHE_MS = 5 * 60_000" in SERVICE_SYSTEM_STATUS and "provider_cache_seconds: includeProviders ? PROVIDER_CACHE_MS / 1000 : null" in SERVICE_SYSTEM_STATUS,
    "web_d072_system_status_excluded": all(token in WEB_APP for token in [
        'navGroup("HỆ THỐNG", profile.role === "ROOT" && profile.base_role === "ROOT"',
        ': [["logs", "Nhật ký"], ["tools", "Công cụ"]])',
        '"picker", "operations", "results", "sku", "hr", "users", "sla", "dashboard", "reports", "logs", "tools", "system-reset", "account"',
    ]) and all(token not in WEB_APP for token in [
        "getSystemStatus(",
        'navButton("system"',
        '["system","devices","versions"].includes(activeSection)',
        'querySelector<HTMLButtonElement>("#refresh-system")',
    ]),
    "service_d072_system_status_quota_guard": all(token in SERVICE_INDEX for token in [
        'SYSTEM_STATUS_DISABLED_QUOTA_GUARD',
        'collectSystemStatus(env, false, false)',
    ]) and all(token in SERVICE_SYSTEM_STATUS for token in [
        'includeProviders = true',
        'providers_enabled: includeProviders',
        'D072_QUOTA_GUARD',
    ]),
    "service_d064_beta_load_gate": all(token in SERVICE_INDEX for token in [
        'env.APP_ENV !== "beta"', "LOAD_TEST_TOKEN", '"/api/__beta_load_test__/prepare"',
        '"/api/__beta_load_test__/session"', '"/api/__beta_load_test__/snapshot"', '"/api/__beta_load_test__/record"',
    ]),
    "d064_real_picker_load_generator": all(token in BETA_LOAD_TEST for token in [
        "/api/picker/reports", "authorization: `Bearer ${session.token}`", "REPORT_TARGET",
        "PICKER_TARGET", "SKU_TARGET", "DURATION_SECONDS", "D064_BETA_LOAD_TEST_PASS",
    ]),
    "d064_load_workflow_cleanup": all(token in BETA_LOAD_WORKFLOW for token in [
        "workflow_dispatch", "Generate ephemeral Beta load-test gate", "Enable temporary Beta load-test gate",
        "Run randomized real Picker load test", "Disable temporary Beta load-test gate", "Verify temporary gate is closed",
        'if: always()', 'LOAD_TEST_TOKEN:"',
    ]),
    "web_login_no_prefilled_root": 'value="root"' not in WEB_UI,
    "web_skip_impact_confirmation": "XÁC NHẬN BỎ QUA" in WEB_UI and "affected_picker_count" in WEB_UI,
    "web_recurrence_surface": "previous_batch_id" in WEB_API and "Tái phát" in WEB_UI,
    "web_realtime_delta": "/api/realtime/delta" in WEB_RT and "lastSeq" in WEB_RT and "location.reload" not in WEB_RT,
    "web_existing_management_preserved": all(token in WEB_API for token in ["/api/admin/hr-source-v2", "/api/admin/users/password", "/api/admin/pickers/bulk"]),
    "web_flexible_hr_mapping": all(token in WEB_UI for token in ["employeeCodeHeader", "fullNameHeader", "Tên cột Mã nhân viên", "Tên cột Họ và tên"]),
    "web_transplant_files_are_presentation_only": "fetch(" not in WEB_FAST and "fetch(" not in WEB_DASH and "fetch(" not in WEB_WAREHOUSE and "fetch(" not in WEB_OPS,

    "android_adaptive_launcher_icon": 'android:icon="@drawable/app_icon_d089"' in ANDROID_MANIFEST and 'android:roundIcon="@drawable/app_icon_d089"' in ANDROID_MANIFEST and ANDROID_APPROVED_ICON_EXISTS,
    "d089_shared_approved_icon": WEB_APPROVED_ICON_EXISTS and '/app-icon.png' in WEB_APP and '/app-icon.png' in WEB_INDEX,
    "android_legacy_login_xml": all(token in ANDROID_LOGIN_XML for token in ['76dp', '23sp', '@+id/etEmployeeCode', '@+id/etPassword', '@+id/btnLogin']),
    "android_legacy_main_shell_xml": all(token in ANDROID_MAIN_XML for token in ['android:layout_height="wrap_content"', 'android:minHeight="56dp"', '@+id/contentContainer', '@+id/btnTextMinus', '@+id/btnTextPlus', '@+id/btnLog', '@+id/btnLogout', '@+id/tvAppVersion']),
    "android_d074_picker_dense_split_xml": all(token in ANDROID_PICKER_XML for token in ['@+id/acSkuSearch', '@+id/btnReportShortage', '@+id/listMyReports', '@+id/panelShortage', '@+id/panelConfirmOrder', '@+id/tabShortage', '@+id/tabConfirmOrder', '@+id/etRelayPicklistSuffix', 'android:maxLength="4"', 'android:layout_height="48dp"']),
    "android_d110_reporter_pinned_tabs_xml": all(token in ANDROID_INVENT_XML for token in ['@+id/tabReporterPending', '@+id/tabReporterHasStock', '@+id/tabReporterSkip', '@+id/tabReporterWithdrawn', '@+id/badgeReporterPending', '@+id/listIssues']) and '@+id/btnRefreshIssues' not in ANDROID_INVENT_XML,
    "android_legacy_admin_xml": all(token in ANDROID_ADMIN_XML for token in ['QUẢN TRỊ BÁO HÀNG', '@+id/btnOpenInventQueue', '@+id/btnImportSku']),
    "android_legacy_row_xml": all(token in ANDROID_ROW_XML for token in ['@+id/tvIssueSku', '@+id/tvIssueProduct', '@+id/tvIssueMeta']),
    "android_legacy_palette": all(token in ANDROID_COLORS for token in ["navy_900", "navy_700", "surface_card", "text_primary", "border_strong"]),
    "android_legacy_widget_theme": "Widget.BaoHang.Button" in ANDROID_STYLES and "Widget.BaoHang.EditText" in ANDROID_STYLES,
    "android_d060_effective_role_refresh": "syncEffectiveRole()" in ANDROID_MAIN and "api.refreshProfile()" in ANDROID_MAIN and "fun refreshProfile()" in ANDROID_API,
    "android_main_inflates_legacy_xml": all(token in ANDROID_MAIN for token in [
        "setContentView(R.layout.activity_login)",
        "setContentView(R.layout.activity_main)",
        "replaceContent(R.layout.view_picker)",
        "replaceContent(R.layout.view_invent)",
        "replaceContent(R.layout.view_admin)",
    ]),
    "android_no_programmatic_operational_header": "kit.addOperationalHeader" not in ANDROID_MAIN,
    "android_picker_binds_legacy_ids": all(token in ANDROID_PICKER for token in ["R.id.acSkuSearch", "R.id.tvSelectedSku", "R.id.btnReportShortage", "R.id.listMyReports"]),
    "android_d074_picker_split_behavior": all(token in ANDROID_PICKER for token in ["showOperationTab(confirm = false)", "showOperationTab(confirm = true)", "digits.length == 4", "InputMethodManager.SHOW_IMPLICIT", "R.id.tabShortage", "R.id.tabConfirmOrder"]),
    "android_d110_reporter_binds_pinned_tabs": all(token in ANDROID_REPORTER for token in ["R.id.listIssues", "R.id.tabReporterPending", "R.id.tabReporterHasStock", "R.id.tabReporterSkip", "R.id.tabReporterWithdrawn", "R.id.badgeReporterPending"]) and "R.id.tvIssueSummary" not in ANDROID_REPORTER,
    "android_d110_reporter_direct_row": all(token in ANDROID_REPORTER_ROW_XML for token in ["@+id/tvReporterSku", "@+id/reporterActions", "@+id/btnReporterHasStock", "@+id/btnReporterSkip", "@+id/tvReporterProduct"]) and "R.layout.row_reporter_issue" in ANDROID_REPORTER,
    "android_picker_uses_legacy_result_overlay": "R.layout.overlay_alert" in ANDROID_PICKER and "R.id.btnOverlayAck" in ANDROID_PICKER and "R.drawable.bg_overlay_skip" in ANDROID_PICKER and "R.drawable.bg_overlay_available" in ANDROID_PICKER,
    "client_ui_has_no_internal_implementation_prose": all(token not in (WEB_UI + ANDROID_ALL) for token in ["Owner duyệt UI", "sẽ được nối sau", "đang transplant", "logic lưu sẽ"]),
    "android_picker_ack": "XÁC NHẬN ĐÃ NHẬN" in ANDROID_PICKER and "acknowledgeResult" in ANDROID_API,
    "android_d111_reporter_confirmed_actions": all(token in ANDROID_REPORTER for token in ["confirmResolution(row, \"HAS_STOCK\"", "confirmResolution(row, \"SKIP_ALLOWED\"", "processingBatchIds", "confirmingBatchIds", '.setPositiveButton("Xác nhận")', "scheduleMinuteTicker"]),
    "android_d110_role_gate": 'channel === "ANDROID" && (user.base_role === "ADMIN" || user.base_role === "ROOT")' in SERVICE_INDEX and "CLIENT_ROLE_NOT_ALLOWED" in SERVICE_INDEX,
    "android_d110_branding": "@drawable/app_icon_d089" in ANDROID_LOGIN_XML and "@drawable/app_icon_d089" in ANDROID_MAIN_XML and "Phát triển hệ thống · tamnv2 | Pick Pack 1291" in ANDROID_LOGIN_XML,
    "android_realtime_delta": "/api/realtime/delta" in ANDROID_API and "appliedSeq" in ANDROID_RT and "streamEpoch" in ANDROID_RT and "recoverDelta" in ANDROID_RT,
    "android_update_gate_preserved": all(token in ANDROID_MAIN for token in ["UpdateGate.CHECKING", "UpdateGate.REQUIRED", "UpdateGate.FAILED", "BuildConfig.UPDATE_RELEASE_API", "loginButton?.isEnabled = updateGate == UpdateGate.CURRENT"]),

    "service_operational_v2_schema": all(token in SERVICE_OPS for token in ["realtime_events", "result_acknowledgements", "previous_batch_id", "version", "operational_sla_v1"]),
    "service_delta_api": "/api/realtime/delta" in SERVICE_READ and "/operational/realtime/delta" in SERVICE_OPS,
    "service_ack_api": "/api/picker/results/receipt" in SERVICE_BUSINESS and "RESULT_ACKNOWLEDGED" in SERVICE_OPS,
    "service_fcm_correlation": all(token in SERVICE_BUSINESS for token in ["result_event_id", "event_seq", "batch_version"]),
    "service_d070_auto_skip_authority": all(token in (SERVICE_OPS + SERVICE_SLA_AUTO + SERVICE_CORE) for token in [
        "auto_skip_minutes", "FIRST_REPORT", "PER_PICKER", "SYSTEM_TIMEOUT",
        "scheduleNextOperationalAlarm", "async alarm(): Promise<void>", "TICKET_AUTO_SKIP_ALLOWED", "BATCH_AUTO_SKIP_ALLOWED",
    ]),
    "service_d070_alarm_runtime_guard": all(token in (SERVICE_SLA_AUTO + SERVICE_CORE) for token in [
        'recordDeadlineOnce(state, batchId, "WARNING", null, now)',
        "const MAX_DUE_PER_ALARM = 50",
        "const MIN_ALARM_DELAY_MS = 1_000",
        "Provider failure must not throw the alarm and cause platform retry storms.",
        "await scheduleNextOperationalAlarm(this.state);",
    ]),
    "service_d070_no_picker_resolve_api": "/api/picker/batches/resolve" not in SERVICE_BUSINESS and "/api/picker/skip" not in SERVICE_BUSINESS,
    "service_root_bootstrap_preserved": 'user.base_role === "ROOT" && user.user_id === "root" && env.ROOT_BOOTSTRAP_PASSWORD' in SERVICE_INDEX,
    "service_d060_root_role_override": all(token in (SERVICE_INDEX + SERVICE_CORE + SERVICE_READ_MODEL + SERVICE_NOTIFICATIONS) for token in [
        "/api/auth/root-role",
        "base_role",
        "role_override",
        "/auth/root-role-override",
        "/realtime/close-user",
        "role-changed",
    ]),
    "service_picker_no_auto_disable": 'absence_policy: "NO_AUTOMATIC_DISABLE"' in SERVICE_USERS,
    "android_release_monotonic": all(token in VERIFY_APPS for token in ["gh release list", "latest + 1", "Refusing to overwrite existing release", "group: beta-android-release", "cancel-in-progress: false"]),
    "web_d067_zoom_control": all(token in WEB_APP for token in ["UI_ZOOM_KEY", 'data-ui-zoom="-10"', 'id="ui-zoom-value"', 'data-ui-zoom="10"', "applyUiZoom"]),
    "web_d067_complete_queue": all(token in (WEB_APP + WEB_API + SERVICE_BUSINESS + SERVICE_OPS) for token in ["loadCompleteReporterQueue", "offset", "total", "LIMIT ? OFFSET ?"]) and "getReporterQueue(200)" not in WEB_APP,
    "web_d067_queue_filters": all(token in WEB_APP for token in ['data-queue-filter="ALL"', 'data-queue-filter="WARNING"', 'data-queue-filter="ESCALATED"', "filteredQueueRows"]),
    "web_d067_scroll_preservation": all(token in WEB_APP for token in ["mainScrollTop", "mainScrollLeft", '".fast-list"', 'data-active-section']),
    "web_d067_picker_rows": all(token in WEB_APP for token in ["prefetchBatchDetails", "picker-detail-list", "picker-detail-row", "Đang tải danh sách Picker"]),
    "web_d067_confirmations": all(token in WEB_APP for token in ["renderStockModal", 'id="confirm-stock"', "SKIP_CONFIRM_DELAY_MS", 'id="skip-delay-setting"', 'id="confirm-skip"']),
    "web_d067_log_dedupe": all(token in WEB_LOGGER for token in ["scheduledSendInFlight", "scheduledSendInFlight = true", "scheduledSendInFlight = false"]) and all(token in SERVICE_RUNTIME_LOGS for token in ["already_uploaded", "seenNames", "name ="]),
    "web_d067_clean_visible_copy": all(token not in WEB_APP for token in ["Beta / Logs", "Chỉ chạy trên Beta", "Beta thực tế", "D064 được ghi nhận", "Log được che mật khẩu", "Tự gửi định kỳ", "ROOT ·", "REPORTER ·", "PICKER ·"]),
    "web_d068_toast_notifications": all(token in (WEB_APP + WEB_FAST) for token in ["web-toast-stack", "toastItems", "slice(-5)", "5_000", "setNotice"]) and "renderNotice()" not in WEB_APP,
    "web_d068_browser_history": all(token in WEB_APP for token in ["history.pushState", "history.replaceState", 'window.addEventListener("popstate"', "navigateToSection", "syncSectionHistory"]),
    "web_d068_clean_log_summary": all(token in WEB_APP for token in ["renderRuntimeLogSummary", "Tóm tắt nhật ký"]) and "JSON.stringify(runtimeLogDetail.content" not in WEB_APP and "${esc(item.name)}" not in WEB_APP,
    "web_d068_immediate_navigation": all(token in WEB_APP for token in ["patchActiveSection(false)", "Mở ${next}: hiển thị", "refreshFastDetailOnly", "Chọn SKU hiển thị sau"]) and 'void run(async () => { await loadSection(next); });' not in WEB_APP,
    "web_d068_active_selection": all(token in WEB_FAST for token in ["D068 Web navigation, notifications and selection clarity", ".tabs .nav-button.active", ".workspace-tab.active", ".fast-issue-row.selected", ".nav-section-label"]),
    "web_d068_clean_visible_copy": all(token not in WEB_APP for token in [
        "Service: Cloudflare", "InventoryCore · Durable Object SQLite", "custom token", "Không polling FCM",
        "Drive · Logs / Archive / Exports", "Sheets · Nhân sự / Archive", "WebSocket · Đồng bộ trực tiếp",
        "Sequence mới nhất", "Audit log", "Thông tin kỹ thuật chi tiết", "Test ID", "Master SKU", "Quản trị cao nhất"
    ]) and "Báo hàng Beta" not in WEB_INDEX,
    "web_d069_unified_visual_layer": all(token in WEB_APP for token in ['./legacy-transplant/web-unified-ui.css', 'class="ops-route sla-workspace"', "sla-config-footer"]) and all(token in WEB_UNIFIED for token in ["--ui-surface", ".business-page-head", ".ops-panel", ".workspace-tab.active", ".table-wrap", 'body[data-theme="dark"]']),
    "web_d069_excel_export": all(token in (WEB_APP + WEB_REPORT_EXCEL) for token in ["exportReportsExcel", "downloadReportWorkbook", "XLSX.writeFile", ".xlsx"]) and "Xuất CSV" not in WEB_APP and "text/csv" not in WEB_APP,
    "web_d069_rich_safe_diagnostics": all(token in (WEB_LOGGER + WEB_API + WEB_RT + SERVICE_RUNTIME_LOGS) for token in ["runtimeLogMetric", "PerformanceObserver", "supra:api-telemetry", "supra:realtime-telemetry", "192_000", "REDACTED"]) and "input.value" not in WEB_LOGGER,
    "web_d069_scoped_rendering": all(token in WEB_APP for token in ['renderMode: "section" | "full" | "none"', 'else if (renderMode === "section")', 'run(exportReportsExcel, "none")']) and "content-visibility: auto" in WEB_UNIFIED,
    "web_d070_three_threshold_settings": all(token in WEB_APP for token in ['name="warning"', 'name="escalation"', 'name="autoSkip"', 'name="autoSkipEnabled"', 'value="FIRST_REPORT"', 'value="PER_PICKER"', "autoSkip <= escalation"]),
    "web_d070_alert_delivery": all(token in WEB_APP for token in ["announceDeadlineEvents", "SLA_WARNING", "SLA_ESCALATED", "TICKET_AUTO_SKIP_ALLOWED", "BATCH_AUTO_SKIP_ALLOWED", "browserBackgroundNotice"]),
    "web_d070_policy_layout": all(token in WEB_UNIFIED for token in [".sla-threshold-grid", ".sla-auto-policy", ".sla-mode-options"]),
    "web_d071_checkbox_normalization": all(token in WEB_UNIFIED for token in ['input[type="checkbox"]', "min-width: 16px !important", "min-height: 16px !important", "accent-color: var(--ui-primary)"]),
    "web_d071_text_baseline": all(token in WEB_APP for token in ["WEB_TEXT_BASE_SCALE = 1.05", "effectiveScale = WEB_TEXT_BASE_SCALE", "logicalUiZoom"]),
    "web_d071_compact_dates": all(token in (WEB_APP + WEB_UNIFIED) for token in ["renderCompactDateRange", "compact-date-range", "compact-date-presets", "report-filter-compact"]),
    "web_d071_immediate_reporter_actions": all(token in WEB_APP for token in ["pendingReporterResolutions", "commitReporterResolution", "reporter_resolution_immediate_feedback", "loadOperationsSnapshot", "operationsLoadPromise"]) and 'await resolveReporterBatch(batch.batch_id, "HAS_STOCK");\n      await loadOperations();' not in WEB_APP and 'await resolveReporterBatch(batch.batch_id, "SKIP_ALLOWED");\n      await loadOperations();' not in WEB_APP,
    "web_d089_tools_dark_completion": all(token in WEB_UNIFIED for token in ["D089 — Tools dark-theme completion", ".tool-icon-image", ".tools-workspace .tool-facts > div"]) and 'body[data-theme="dark"] .tools-workspace .tool-facts > div' in WEB_UNIFIED,
    "web_d107_professional_identity": all(token in WEB_APP for token in ['class="login-brand-lockup"', '/app-icon.png', "CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN", "<h1>Website nghiệp vụ Inventory</h1>"]) and all(token not in WEB_APP for token in ['<div class="brand">1291</div>', "<h1>Web nghiệp vụ</h1>", "Đăng nhập bằng tài khoản Báo hàng 1291."]),
    "web_d107_professional_layer": './legacy-transplant/web-professional-v2.css' in WEB_APP and all(token in WEB_PRO for token in ["D107 — professional Web refinement", ".login-brand-lockup", ".business-summary-grid-6", ".pro-trend-chart", ".pro-report-analysis", 'body[data-theme="dark"]']),
    "web_d107_richer_reporting": all(token in WEB_APP for token in ["affectedInPeriod", "trendRows", "pro-trend-chart", "data-dashboard-sku", "reportWarningCount", "reportOverdueCount", "open_ticket_count", "pro-report-analysis"]),
    "authority_d108_picker_resolution_refinement": "D108" in DECISIONS and "D108" in DESIGN_SPEC,
    "authority_d109_audit_pda_compact_tabs": "D109" in DECISIONS and "D109 Web audit/PDA tools and Android compact tabs" in DESIGN_SPEC,
    "authority_d110_reporter_pinned_workflow": "D110" in DECISIONS and "D110 Android Reporter visual baseline" in DESIGN_SPEC,
    "authority_d111_android_daily_compact": "D111" in DECISIONS and "D111 Android daily compact workflow" in DESIGN_SPEC,
    "web_d108_password_recovery_hidden_until_action": '.login-reset-form[hidden]' in WEB_PRO and 'display: none !important' in WEB_PRO,
    "web_d108_resolution_provenance": all(token in WEB_APP for token in ["resolutionSourceLabel", "resolutionActorLabel", "Tự động bỏ qua quá hạn", "Nguồn xử lý", "Người xử lý"]) and all(token in SERVICE_OPS for token in ["resolution_source", "resolved_by_display_name", "resolved_by_employee_code"]) and all(token in SERVICE_BUSINESS_CORE for token in ["resolution_sources", "resolved_by_display_name", "resolved_by_employee_code"]),
    "android_d108_numeric_compact_picker": all(token in ANDROID_PICKER_XML for token in ['android:digits="0123456789"', 'android:completionThreshold="3"', 'android:hint="Nhập tối thiểu 3 chữ số SKU"', 'android:text="Xác nhận"', 'android:text="Danh sách SKU đã báo hết hàng"', '@+id/pickerSelectedCard']) and "Quét hoặc nhập SKU" not in ANDROID_PICKER_XML and "SKU tôi đã báo" not in ANDROID_PICKER_XML,
    "android_d108_selection_and_status_cards": all(token in ANDROID_PICKER for token in ["selected?.sku == value", "dismissDropDown()", "kit.rounded(kit.blueSoft, kit.blue, 9)", "object : BaseAdapter()", "kit.stockFill", "kit.pendingFill", "kit.skipFill", "kit.graySoft", "alpha = if (ready) 1.0f else 0.42f"]) and "Mốc tự động:" not in ANDROID_PICKER and '"Tự động:"' not in ANDROID_PICKER,
    "android_d108_user_display_scale": all(token in (ANDROID_MAIN + ANDROID_MAIN_XML + ANDROID_PICKER) for token in ["picker_display_scale_v1", "btnTextMinus", "btnTextPlus", "displayScale", "applyDisplayScale"]) and all(token in ANDROID_MAIN for token in ["user:${session.userId}", "coerceIn(0.8f, 1.4f)"]),
    "android_d111_reporter_display_scale": all(token in (ANDROID_MAIN + ANDROID_REPORTER) for token in ["reporter_display_scale_v1", "reporterDisplayScale(session)", "displayScale", "applyDisplayScale", "currentFilterName()"]),
    "android_d111_reporter_badge_priority": '@drawable/bg_reporter_tab_badge_idle' in ANDROID_INVENT_XML and '#E5E7EB' in ANDROID_REPORTER_BADGE_IDLE and '@+id/tvIssueSummary' not in ANDROID_INVENT_XML,
    "android_d111_today_open_scope": "scope=APP_TODAY_OPEN" in ANDROID_API and 'APP_TODAY_OPEN_SCOPE = "APP_TODAY_OPEN"' in SERVICE_OPS and "reportDate(it.reportedAt) == today || isUnresolved(it)" in ANDROID_PICKER,
    "android_d111_redundant_reporter_copy_removed": all(token not in ANDROID_REPORTER for token in ["Picker đã xác nhận", "Không có SKU đang xử lý.", "đơn đã có hàng", "đơn được cho phép skip", "đơn Picker đã thu hồi"]),
    "android_d070_timeout_projection": all(token in (ANDROID_API + ANDROID_PICKER + ANDROID_REPORTER) for token in ["autoSkipDeadlineAt", "autoSkipAllowedAt", "autoSkipAt"]) and ("Hệ thống tự động do quá hạn" in ANDROID_PICKER or "Hệ thống tự động lúc:" in ANDROID_PICKER),
    "web_online_only_no_outbox": "offline outbox" not in WEB_UI.lower() and "chờ đồng bộ" not in WEB_UI.lower(),
    "android_online_only_no_outbox": "chờ đồng bộ" not in ANDROID_ALL.lower() and "outbox" not in ANDROID_ALL.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
if failed:
    raise SystemExit("UI_DESIGN_GUARD_FAIL: " + ", ".join(failed))
print("UI_DESIGN_GUARD_PASS")
