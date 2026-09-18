#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

WEB_MAIN = read("web/src/main.ts")
WEB_APP = read("web/src/operational-app.ts")
WEB_UI = "\n".join([WEB_MAIN, WEB_APP])
WEB_API = read("web/src/api.ts")
WEB_RT = read("web/src/realtime-client.ts")
WEB_LEGACY_BASE = read("web/src/legacy-transplant/style.css")
WEB_FAST = read("web/src/legacy-transplant/web-fast-ui.css")
WEB_DASH = read("web/src/legacy-transplant/workflow-dashboard-v5.css")
WEB_WAREHOUSE = read("web/src/legacy-transplant/warehouse-ui-v2.css")
WEB_OPS = read("web/src/legacy-transplant/ops-console.css")

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
ANDROID_COLORS = read("android/app/src/main/res/values/colors.xml")
ANDROID_STYLES = read("android/app/src/main/res/values/styles.xml")
ANDROID_ICON = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml")
ANDROID_ICON_ROUND = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml")
ANDROID_ALL = "\n".join([ANDROID_MAIN, ANDROID_PICKER, ANDROID_REPORTER])

SERVICE_OPS = read("service/src/operational-v2-core.ts")
SERVICE_BUSINESS = read("service/src/business-api.ts")
SERVICE_READ = read("service/src/read-api.ts")
SERVICE_USERS = read("service/src/user-management-core.ts")
SERVICE_INDEX = read("service/src/index.ts")
SERVICE_CORE = read("service/src/core.ts")
SERVICE_READ_MODEL = read("service/src/read-model-core.ts")
SERVICE_NOTIFICATIONS = read("service/src/notifications-core.ts")
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
    "web_d058_credit": "Xây dựng và phát triển bởi tamnv2 - Chuyên viên Pick Pack 1291" in WEB_APP,
    "web_d059_corporate_header": all(token in WEB_APP for token in [
        "CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN",
        "Website nghiệp vụ Inventory 1291",
        "Service: Cloudflare",
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
        "ROOT · Quản trị hệ thống",
        "REPORTER · Người báo hàng",
        "PICKER · Người lấy hàng",
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
    "web_legacy_dashboard_composition": all(token in WEB_APP for token in ["v5-root", "Tổng quan hôm nay", "v5-kpi-grid", "SKU ưu tiên", "Hiệu suất hôm nay"]),
    "web_legacy_reporter_workspace": all(token in WEB_APP for token in ["fast-events", "fast-workspace", "fast-list", "fast-detail", "Xử lý báo thiếu"]),
    "web_d061_nav_icons": all(token in WEB_APP for token in ["function navIcon", 'class="nav-icon"', "group-operations"]) and all(token in WEB_FAST for token in ["D061 Owner Web review", ".nav-section-label", ".nav-icon"]),
    "web_d061_generic_refresh_removed": all(token not in WEB_APP for token in ["refresh-operations", "refresh-results", "refresh-picker", "refresh-users"]),
    "web_d061_dark_surface_coverage": all(token in WEB_FAST for token in ["D061 Owner Web review", ".fast-workspace", ".fast-issue-row", ".table-wrap", "tbody tr", ".ops-status-strip"]),
    "web_d062_canonical_nav_ia": all(token in WEB_APP for token in [
        'navGroup("VẬN HÀNH"',
        'navGroup("DỮ LIỆU"',
        'navGroup("QUẢN TRỊ"',
        'navGroup("BÁO CÁO"',
        'navGroup("HỆ THỐNG"',
        '"results", "Kết quả gần đây"',
        '"hr", "Nguồn nhân sự"',
        '"account", "Tài khoản & mật khẩu"',
        'if (value.role === "PICKER") return "picker";\n  return "operations";',
    ]) and "Hạ tầng & chi phí" not in WEB_APP,
    "web_d062_dark_transient_coverage": all(token in WEB_FAST for token in [
        "D062 final Web QA",
        ".picker-chip",
        ".realtime-notice",
        '.message[data-type="error"]',
        ".badge.closed",
        ".v5-rank-row > b",
    ]),
    "web_d062_sidebar_hierarchy": all(token in WEB_FAST for token in ["font-size: 13px !important", ".nav-section-label .nav-icon", "width: 15px"]),
    "web_login_no_prefilled_root": 'value="root"' not in WEB_UI,
    "web_skip_impact_confirmation": "XÁC NHẬN CHO SKIP" in WEB_UI and "affected_picker_count" in WEB_UI,
    "web_recurrence_surface": "previous_batch_id" in WEB_API and "Tái phát" in WEB_UI,
    "web_realtime_delta": "/api/realtime/delta" in WEB_RT and "lastSeq" in WEB_RT and "location.reload" not in WEB_RT,
    "web_existing_management_preserved": all(token in WEB_API for token in ["/api/admin/hr-source-v2", "/api/admin/users/password", "/api/admin/pickers/bulk"]),
    "web_flexible_hr_mapping": all(token in WEB_UI for token in ["employeeCodeHeader", "fullNameHeader", "Tên cột Mã nhân viên", "Tên cột Họ và tên"]),
    "web_transplant_files_are_presentation_only": "fetch(" not in WEB_FAST and "fetch(" not in WEB_DASH and "fetch(" not in WEB_WAREHOUSE and "fetch(" not in WEB_OPS,

    "android_adaptive_launcher_icon": 'android:icon="@mipmap/ic_launcher"' in ANDROID_MANIFEST and 'android:roundIcon="@mipmap/ic_launcher_round"' in ANDROID_MANIFEST and "@color/inventory_icon_green" in ANDROID_ICON and "@color/inventory_icon_green" in ANDROID_ICON_ROUND,
    "android_legacy_login_xml": all(token in ANDROID_LOGIN_XML for token in ['76dp', '23sp', '@+id/etEmployeeCode', '@+id/etPassword', '@+id/btnLogin']),
    "android_legacy_main_shell_xml": all(token in ANDROID_MAIN_XML for token in ['android:layout_height="76dp"', '@+id/contentContainer', '@+id/btnLog', '@+id/btnLogout', '@+id/tvAppVersion']),
    "android_legacy_picker_xml": all(token in ANDROID_PICKER_XML for token in ['@+id/acSkuSearch', 'android:layout_height="58dp"', '@+id/btnReportShortage', 'android:layout_height="66dp"', '@+id/listMyReports']),
    "android_legacy_reporter_xml": all(token in ANDROID_INVENT_XML for token in ['HÀNG CHỜ INVENT', '@+id/btnRefreshIssues', '@+id/listIssues']),
    "android_legacy_admin_xml": all(token in ANDROID_ADMIN_XML for token in ['QUẢN TRỊ INVENT', '@+id/btnOpenInventQueue', '@+id/btnImportSku']),
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
    "android_reporter_binds_legacy_ids": all(token in ANDROID_REPORTER for token in ["R.id.tvIssueSummary", "R.id.listIssues", "R.id.btnRefreshIssues"]),
    "android_reporter_uses_legacy_row": "R.layout.row_issue" in ANDROID_REPORTER and "R.id.tvIssueSku" in ANDROID_REPORTER and "R.id.tvIssueMeta" in ANDROID_REPORTER,
    "android_picker_uses_legacy_result_overlay": "R.layout.overlay_alert" in ANDROID_PICKER and "R.id.btnOverlayAck" in ANDROID_PICKER and "R.drawable.bg_overlay_skip" in ANDROID_PICKER and "R.drawable.bg_overlay_available" in ANDROID_PICKER,
    "client_ui_has_no_internal_implementation_prose": all(token not in (WEB_UI + ANDROID_ALL) for token in ["Owner duyệt UI", "sẽ được nối sau", "đang transplant", "logic lưu sẽ"]),
    "android_picker_ack": "XÁC NHẬN ĐÃ NHẬN" in ANDROID_PICKER and "acknowledgeResult" in ANDROID_API,
    "android_reporter_skip_confirm": "XÁC NHẬN CHO SKIP" in ANDROID_REPORTER and "affectedPickerCount" in ANDROID_REPORTER,
    "android_realtime_delta": "/api/realtime/delta" in ANDROID_API and "appliedSeq" in ANDROID_RT and "streamEpoch" in ANDROID_RT and "recoverDelta" in ANDROID_RT,
    "android_update_gate_preserved": all(token in ANDROID_MAIN for token in ["UpdateGate.CHECKING", "UpdateGate.REQUIRED", "UpdateGate.FAILED", "BuildConfig.UPDATE_RELEASE_API", "loginButton?.isEnabled = updateGate == UpdateGate.CURRENT"]),

    "service_operational_v2_schema": all(token in SERVICE_OPS for token in ["realtime_events", "result_acknowledgements", "previous_batch_id", "version", "operational_sla_v1"]),
    "service_delta_api": "/api/realtime/delta" in SERVICE_READ and "/operational/realtime/delta" in SERVICE_OPS,
    "service_ack_api": "/api/picker/results/receipt" in SERVICE_BUSINESS and "RESULT_ACKNOWLEDGED" in SERVICE_OPS,
    "service_fcm_correlation": all(token in SERVICE_BUSINESS for token in ["result_event_id", "event_seq", "batch_version"]),
    "service_no_auto_skip": "AUTO_SKIP" not in SERVICE_OPS and "AUTO_SKIP" not in SERVICE_BUSINESS,
    "service_root_bootstrap_preserved": 'user.role === "ROOT" && user.user_id === "root" && env.ROOT_BOOTSTRAP_PASSWORD' in SERVICE_INDEX,
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
    "web_online_only_no_outbox": "offline outbox" not in WEB_UI.lower() and "chờ đồng bộ" not in WEB_UI.lower(),
    "android_online_only_no_outbox": "chờ đồng bộ" not in ANDROID_ALL.lower() and "outbox" not in ANDROID_ALL.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
if failed:
    raise SystemExit("UI_DESIGN_GUARD_FAIL: " + ", ".join(failed))
print("UI_DESIGN_GUARD_PASS")
