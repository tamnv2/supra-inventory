#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

WEB_MAIN = read("web/src/main.ts")
WEB_APP = read("web/src/operational-app.ts")
WEB_UI = "\n".join([WEB_MAIN, WEB_APP])
WEB_API = read("web/src/api.ts")
WEB_CSS = read("web/src/legacy-operational.css")
WEB_RT = read("web/src/realtime-client.ts")
ANDROID_MAIN = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt")
ANDROID_UI = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryUi.kt")
ANDROID_PICKER = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt")
ANDROID_REPORTER = read("android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt")
ANDROID_RT = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidRealtimeClient.kt")
ANDROID_API = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
ANDROID_MANIFEST = read("android/app/src/main/AndroidManifest.xml")
ANDROID_ICON = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml")
ANDROID_ICON_ROUND = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml")
SERVICE_OPS = read("service/src/operational-v2-core.ts")
SERVICE_BUSINESS = read("service/src/business-api.ts")
SERVICE_READ = read("service/src/read-api.ts")
SERVICE_USERS = read("service/src/user-management-core.ts")
SERVICE_INDEX = read("service/src/index.ts")
VERIFY_APPS = read(".github/workflows/verify-apps.yml")
DESIGN_SPEC = read("docs/specs/UI_DESIGN_SYSTEM.md")
DECISIONS = read("docs/OWNER_DECISIONS.md")

ADMIN_LAUNCHER_PATH = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/AdminLauncherController.kt"
ANDROID_ADMIN = ADMIN_LAUNCHER_PATH.read_text(encoding="utf-8") if ADMIN_LAUNCHER_PATH.exists() else ""
ANDROID_ALL = "\n".join([ANDROID_MAIN, ANDROID_UI, ANDROID_PICKER, ANDROID_REPORTER, ANDROID_ADMIN])

WEB_CREDIT = "Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291"
ANDROID_CREDIT = "Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291"

checks = {
    "authority_legacy_operational_v2": "Legacy Operational UI V2" in DESIGN_SPEC and "D044" in DECISIONS,
    "authority_no_offline_mode": "D043" in DECISIONS and "No offline business mode" in DESIGN_SPEC,
    "web_legacy_entrypoint_active": 'import "./operational-app"' in WEB_MAIN,
    "web_login_no_prefilled_root": 'value="root"' not in WEB_UI,
    "web_reporter_operational_first": "Hàng đang xử lý" in WEB_UI and "operation-list" in WEB_UI,
    "web_no_priority_explanatory_prose": "Ưu tiên tự động: nhiều Picker bị ảnh hưởng hơn trước" not in WEB_UI,
    "web_footer_credit": WEB_CREDIT in WEB_UI,
    "web_legacy_horizontal_nav": '<nav class="tabs"' in WEB_APP and '<aside class="sidebar">' not in WEB_APP and ".tabs{display:flex" in WEB_CSS,
    "web_legacy_topbar_composition": 'class="web-heading"' in WEB_APP and "Web nghiệp vụ" in WEB_APP and 'class="user"' in WEB_APP,
    "web_skip_impact_confirmation": "XÁC NHẬN CHO SKIP" in WEB_UI and "affected_picker_count" in WEB_UI,
    "web_sla_surface": "Cấu hình SLA" in WEB_UI and "sla_state" in WEB_UI,
    "web_recurrence_surface": "previous_batch_id" in WEB_API and "Tái phát" in WEB_UI,
    "web_realtime_delta": "/api/realtime/delta" in WEB_RT and "lastSeq" in WEB_RT and "#refresh-operations" not in WEB_RT,
    "web_realtime_preserves_context": "location.reload" not in WEB_RT and ".click()" not in WEB_RT,
    "web_existing_management_preserved": all(token in WEB_API for token in ["/api/admin/hr-source-v2", "/api/admin/users/password", "/api/admin/pickers/bulk"]),
    "web_flexible_hr_mapping": all(token in WEB_UI for token in ["employeeCodeHeader", "fullNameHeader", "Tên cột Mã nhân viên", "Tên cột Họ và tên"]),
    "web_no_superseded_overlay": "operational-ui.js" not in read("web/index.html") and "operational-ui.css" not in read("web/index.html"),
    "android_no_post_layout_application": 'android:name=".InventoryApplication"' not in ANDROID_MANIFEST,
    "android_adaptive_launcher_icon": 'android:icon="@mipmap/ic_launcher"' in ANDROID_MANIFEST and 'android:roundIcon="@mipmap/ic_launcher_round"' in ANDROID_MANIFEST and "@color/inventory_icon_green" in ANDROID_ICON and "@color/inventory_icon_green" in ANDROID_ICON_ROUND,
    "android_footer_credit": ANDROID_CREDIT in ANDROID_UI,
    "android_header_readable": "BÁO HÀNG 1291" in ANDROID_UI and "screenWidthDp" in ANDROID_UI and "LinearLayout.LayoutParams(dp(134)" not in ANDROID_UI,
    "android_legacy_fixed_header": "OperationalPage" in ANDROID_MAIN and "setContentView(page.shell)" in ANDROID_MAIN and "LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(76))" in ANDROID_UI,
    "android_picker_vertical": "Nhập / quét SKU" in ANDROID_PICKER and "BÁO HẾT HÀNG" in ANDROID_PICKER and "BÁO HÔM NAY" in ANDROID_PICKER and "one-row" not in ANDROID_PICKER.lower(),
    "android_picker_ack": "XÁC NHẬN ĐÃ NHẬN" in ANDROID_PICKER and "acknowledgeResult" in ANDROID_API,
    "android_reporter_filters": all(token in ANDROID_REPORTER for token in ["Đang xử lý", "Đã có hàng", "Đã cho skip", "Picker thu hồi"]),
    "android_reporter_skip_confirm": "XÁC NHẬN CHO SKIP" in ANDROID_REPORTER and "affectedPickerCount" in ANDROID_REPORTER,
    "android_admin_root_launcher": "class AdminLauncherController" in ANDROID_ADMIN and all(token in ANDROID_ADMIN for token in ["Vận hành", "Quản trị", "Hệ thống", "Hàng chờ xử lý"]),
    "android_admin_not_reporter_only": '\"REPORTER\", \"ADMIN\", \"ROOT\" ->' not in ANDROID_MAIN,
    "android_realtime_delta": "/api/realtime/delta" in ANDROID_API and "appliedSeq" in ANDROID_RT and "streamEpoch" in ANDROID_RT and "recoverDelta" in ANDROID_RT,
    "android_update_gate_preserved": all(token in ANDROID_MAIN for token in ["UpdateGate.CHECKING", "UpdateGate.REQUIRED", "UpdateGate.FAILED", "BuildConfig.UPDATE_RELEASE_API", "loginButton?.isEnabled = updateGate == UpdateGate.CURRENT"]),
    "service_operational_v2_schema": all(token in SERVICE_OPS for token in ["realtime_events", "result_acknowledgements", "previous_batch_id", "version", "operational_sla_v1"]),
    "service_delta_api": "/api/realtime/delta" in SERVICE_READ and "/operational/realtime/delta" in SERVICE_OPS,
    "service_ack_api": "/api/picker/results/receipt" in SERVICE_BUSINESS and "RESULT_ACKNOWLEDGED" in SERVICE_OPS,
    "service_fcm_correlation": all(token in SERVICE_BUSINESS for token in ["result_event_id", "event_seq", "batch_version"]),
    "service_no_auto_skip": "AUTO_SKIP" not in SERVICE_OPS and "AUTO_SKIP" not in SERVICE_BUSINESS,
    "service_root_bootstrap_preserved": 'user.role === "ROOT" && user.user_id === "root" && env.ROOT_BOOTSTRAP_PASSWORD' in SERVICE_INDEX,
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
