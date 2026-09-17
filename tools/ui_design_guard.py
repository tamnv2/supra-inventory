#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_MAIN = (ROOT / "web/src/main.ts").read_text(encoding="utf-8")
WEB_CSS = (ROOT / "web/src/styles.css").read_text(encoding="utf-8")
ANDROID = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt").read_text(encoding="utf-8")

checks = {
    "web_login_no_prefilled_root": 'value="root"' not in WEB_MAIN,
    "web_login_named_placeholder": 'placeholder="Tên đăng nhập / MNV"' in WEB_MAIN,
    "web_hr_human_summary": 'class="source-summary"' in WEB_MAIN and 'id="hr-result"' not in WEB_MAIN,
    "web_service_indicator": 'service-indicator' in WEB_MAIN and '.service-indicator' in WEB_CSS,
    "web_semantic_status_panel": 'status-panel' in WEB_MAIN and '.status-panel.error' in WEB_CSS and '.status-panel.success' in WEB_CSS,
    "web_responsive_tables_actions": '.table-actions' in WEB_CSS and '@media (max-width:760px)' in WEB_CSS,
    "android_concept3_tokens": all(token in ANDROID for token in ["conceptGreen", "conceptGreenSoft", "conceptOrangeSoft", "conceptRedSoft", "conceptGraySoft"]),
    "android_semantic_status_badge": 'private fun statusBadge' in ANDROID,
    "android_semantic_status_box": 'private fun setStatus(message: String)' in ANDROID and 'isError' in ANDROID and 'isAttention' in ANDROID,
    "android_consistent_controls": 'private fun styleButton' in ANDROID and 'private fun styleInput' in ANDROID and 'applyConcept3Tree' in ANDROID,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
if failed:
    raise SystemExit("UI_DESIGN_GUARD_FAIL: " + ", ".join(failed))
print("UI_DESIGN_GUARD_PASS")
