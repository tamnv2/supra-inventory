#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_MAIN = (ROOT / "web/src/main.ts").read_text(encoding="utf-8")
WEB_CSS = (ROOT / "web/src/styles.css").read_text(encoding="utf-8")
WEB_INDEX = (ROOT / "web/index.html").read_text(encoding="utf-8")
WEB_OPS_JS = (ROOT / "web/public/operational-ui.js").read_text(encoding="utf-8")
WEB_OPS_CSS = (ROOT / "web/public/operational-ui.css").read_text(encoding="utf-8")
ANDROID = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt").read_text(encoding="utf-8")
ANDROID_APP = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApplication.kt").read_text(encoding="utf-8")
ANDROID_MANIFEST = (ROOT / "android/app/src/main/AndroidManifest.xml").read_text(encoding="utf-8")
DESIGN_SPEC = (ROOT / "docs/specs/UI_DESIGN_SYSTEM.md").read_text(encoding="utf-8")

CREDIT = "Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291"

checks = {
    "web_login_no_prefilled_root": 'value="root"' not in WEB_MAIN,
    "web_practical_balanced_assets": '/operational-ui.css' in WEB_INDEX and '/operational-ui.js' in WEB_INDEX,
    "web_business_nav_labels": all(label in WEB_OPS_JS for label in [
        "Tổng quan vận hành", "Hàng chờ xử lý", "Báo cáo vận hành",
        "Danh mục Master SKU", "Quản lý nhân sự", "Quản lý tài khoản",
    ]),
    "web_employee_code_full_label": "Mã nhân viên" in WEB_OPS_JS,
    "web_business_icon": "BRAND_SVG" in WEB_OPS_JS and "package" not in WEB_OPS_JS.lower(),
    "web_footer_credit": CREDIT in WEB_OPS_JS,
    "web_picker_bulk_controls": all(token in WEB_OPS_JS for token in ["data-picker-bulk", "data-picker-all", "Xóa Picker", "Ngừng tất cả"]),
    "web_flexible_hr_headers": all(token in WEB_OPS_JS for token in ["employeeCodeHeader", "fullNameHeader", "/api/admin/hr-source-v2"]),
    "web_practical_responsive": "@media (max-width:900px)" in WEB_OPS_CSS and "Roboto" in WEB_OPS_CSS,
    "web_existing_semantic_status": 'status-panel' in WEB_MAIN and '.status-panel.error' in WEB_CSS and '.status-panel.success' in WEB_CSS,
    "android_operational_application": 'android:name=".InventoryApplication"' in ANDROID_MANIFEST,
    "android_inventory_alert_icon": 'android:icon="@drawable/ic_inventory_alert"' in ANDROID_MANIFEST,
    "android_footer_credit": CREDIT in ANDROID_APP,
    "android_employee_code_full_label": "Mã nhân viên" in ANDROID_APP,
    "android_picker_report_flow_preserved": "private fun renderPicker" in ANDROID and "Báo SKU hết hàng" in ANDROID,
    "android_reporter_flow_preserved": "private fun renderReporter" in ANDROID and "Cho phép skip" in ANDROID,
    "design_spec_practical_balanced": "Practical Balanced" in DESIGN_SPEC and "Phương án 1" in DESIGN_SPEC,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
if failed:
    raise SystemExit("UI_DESIGN_GUARD_FAIL: " + ", ".join(failed))
print("UI_DESIGN_GUARD_PASS")
