#!/usr/bin/env python3
from pathlib import Path

# Canonical Practical Balanced guard: validate product behavior in primary source, not a DOM business patch.
ROOT = Path(__file__).resolve().parents[1]
WEB_MAIN = (ROOT / "web/src/main.ts").read_text(encoding="utf-8")
WEB_API = (ROOT / "web/src/api.ts").read_text(encoding="utf-8")
WEB_CSS = (ROOT / "web/src/styles.css").read_text(encoding="utf-8")
WEB_INDEX = (ROOT / "web/index.html").read_text(encoding="utf-8")
WEB_OPS_JS = (ROOT / "web/public/operational-ui.js").read_text(encoding="utf-8")
WEB_OPS_CSS = (ROOT / "web/public/operational-ui.css").read_text(encoding="utf-8")
ANDROID = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt").read_text(encoding="utf-8")
ANDROID_APP = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApplication.kt").read_text(encoding="utf-8")
ANDROID_MANIFEST = (ROOT / "android/app/src/main/AndroidManifest.xml").read_text(encoding="utf-8")
ANDROID_ADAPTIVE_ICON = (ROOT / "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml").read_text(encoding="utf-8")
ANDROID_ADAPTIVE_ICON_ROUND = (ROOT / "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml").read_text(encoding="utf-8")
SERVICE_USERS = (ROOT / "service/src/user-management-core.ts").read_text(encoding="utf-8")
SERVICE_INDEX = (ROOT / "service/src/index.ts").read_text(encoding="utf-8")
VERIFY_APPS = (ROOT / ".github/workflows/verify-apps.yml").read_text(encoding="utf-8")
DESIGN_SPEC = (ROOT / "docs/specs/UI_DESIGN_SYSTEM.md").read_text(encoding="utf-8")

WEB_CREDIT = "Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291"
ANDROID_CREDIT = "Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291"
NAV_LABELS = [
    "Tổng quan vận hành", "Hàng chờ xử lý", "Báo cáo vận hành",
    "Danh mục Master SKU", "Quản lý nhân sự", "Quản lý tài khoản",
]

checks = {
    "web_login_no_prefilled_root": 'value="root"' not in WEB_MAIN,
    "web_business_nav_native": all(label in WEB_MAIN for label in NAV_LABELS),
    "web_employee_code_full_label_native": "Mã nhân viên" in WEB_MAIN and "Cột MNV" not in WEB_MAIN and "/ MNV" not in WEB_MAIN,
    "web_footer_credit_native": WEB_CREDIT in WEB_MAIN,
    "web_no_reset_password": "Reset mật khẩu" not in WEB_MAIN and "resetManagedUserPassword" not in WEB_MAIN and "/reset-password" not in WEB_API,
    "web_explicit_managed_password": all(token in WEB_MAIN for token in ["Mật khẩu khởi tạo", "Đổi mật khẩu", "setManagedUserPassword"]),
    "web_root_admin_reporter_create": 'option value="REPORTER"' in WEB_MAIN and 'option value="ADMIN"' in WEB_MAIN,
    "web_picker_selection_controls": all(token in WEB_MAIN for token in ["picker-select-all", "data-picker-select", 'data-picker-action="ENABLE"', 'data-picker-action="DISABLE"', 'data-picker-action="DELETE"']),
    "web_flexible_hr_headers_native": all(token in WEB_MAIN for token in ["employeeCodeHeader", "fullNameHeader", "Tên cột Mã nhân viên", "Tên cột Họ và tên"]),
    "web_current_management_api": all(token in WEB_API for token in ["/api/admin/hr-source-v2", "/api/admin/users/password", "/api/admin/pickers/bulk"]),
    "web_visual_overlay_has_no_business_api": "BRAND_SVG" in WEB_OPS_JS and "/api/" not in WEB_OPS_JS,
    "web_business_favicon": "viewBox='0 0 64 64'" in WEB_INDEX and "%23F59E0B" in WEB_INDEX,
    "web_practical_responsive": "@media (max-width:900px)" in WEB_OPS_CSS and "Roboto" in WEB_OPS_CSS,
    "web_existing_semantic_status": "status-panel" in WEB_MAIN and ".status-panel.error" in WEB_CSS and ".status-panel.success" in WEB_CSS,
    "android_operational_application": 'android:name=".InventoryApplication"' in ANDROID_MANIFEST,
    "android_adaptive_launcher_icon": 'android:icon="@mipmap/ic_launcher"' in ANDROID_MANIFEST and 'android:roundIcon="@mipmap/ic_launcher_round"' in ANDROID_MANIFEST and "@color/inventory_icon_green" in ANDROID_ADAPTIVE_ICON and "@color/inventory_icon_green" in ANDROID_ADAPTIVE_ICON_ROUND,
    "android_footer_credit": ANDROID_CREDIT in ANDROID_APP,
    "android_employee_code_full_label": "Mã nhân viên / tên đăng nhập" in ANDROID_APP,
    "android_business_header_icon": 'current == "SI"' in ANDROID_APP and "R.drawable.ic_inventory_alert" in ANDROID_APP,
    "android_picker_report_flow_preserved": "private fun renderPicker" in ANDROID and 'replace("Báo hết hàng", "Báo SKU hết hàng")' in ANDROID_APP,
    "android_reporter_flow_preserved": "private fun renderReporter" in ANDROID and "Cho phép skip" in ANDROID,
    "android_mandatory_update_gate": all(token in ANDROID_APP for token in ["UpdateGate.CHECKING", "UpdateGate.REQUIRED", "UpdateGate.FAILED", "BuildConfig.UPDATE_RELEASE_API", "view.isEnabled = false"]),
    "android_version_meta_removed_from_header": 'text.startsWith("Phiên bản ")' in ANDROID_APP and "View.GONE" in ANDROID_APP,
    "service_root_bootstrap_preserved": 'user.role === "ROOT" && user.user_id === "root" && env.ROOT_BOOTSTRAP_PASSWORD' in SERVICE_INDEX,
    "service_legacy_picker_bootstrap": 'user.role === "PICKER"' in SERVICE_INDEX and 'env.PICKER_DEFAULT_PASSWORD || env.ROOT_BOOTSTRAP_PASSWORD || null' in SERVICE_INDEX,
    "service_root_role_hierarchy": 'actorRole === "ROOT"' in SERVICE_USERS and 'targetRole === "ADMIN" || targetRole === "REPORTER"' in SERVICE_USERS,
    "service_picker_no_auto_disable": 'reactivate: 0' in SERVICE_USERS and 'disable: 0' in SERVICE_USERS and 'absence_policy: "NO_AUTOMATIC_DISABLE"' in SERVICE_USERS,
    "service_picker_reprovision_new_identity": 'picker:${code}:${crypto.randomUUID()}' in SERVICE_USERS,
    "android_release_monotonic": all(token in VERIFY_APPS for token in ["gh release list", "latest + 1", "Refusing to overwrite existing release", "group: beta-android-release", "cancel-in-progress: false"]),
    "design_spec_practical_balanced": "Practical Balanced" in DESIGN_SPEC and "Phương án 1" in DESIGN_SPEC and "mandatory update gate" in DESIGN_SPEC.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
if failed:
    raise SystemExit("UI_DESIGN_GUARD_FAIL: " + ", ".join(failed))
print("UI_DESIGN_GUARD_PASS")
