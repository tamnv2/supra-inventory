#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt"
STYLES = ROOT / "android/app/src/main/res/values/styles.xml"
STATE = ROOT / "ops/project-state.json"
REGISTRY = ROOT / "ops/resource-registry.json"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL {label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def patch_main() -> None:
    text = MAIN.read_text(encoding="utf-8")
    text = replace_once(text, 'import android.content.Intent\n', 'import android.content.Intent\nimport android.content.res.ColorStateList\n', 'import-color-state')
    text = replace_once(text, 'class MainActivity : Activity() {\n', '''class MainActivity : Activity() {
    private val conceptGreen = Color.parseColor("#087443")
    private val conceptGreenDark = Color.parseColor("#0B4D32")
    private val conceptGreenSoft = Color.parseColor("#E5F4EC")
    private val conceptSurface = Color.parseColor("#F4F8F5")
    private val conceptLine = Color.parseColor("#DBE7DF")
    private val conceptText = Color.parseColor("#15241C")
    private val conceptMuted = Color.parseColor("#66756D")
    private val conceptOrange = Color.parseColor("#B45309")
    private val conceptOrangeSoft = Color.parseColor("#FFF0D9")
''', 'class-colors')

    old_login_header = '''        root.addView(TextView(this).apply {
            text = "SUPRA Inventory"
            textSize = 27f
            setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "BÁO HÀNG · BETA"
            textSize = 13f
            setTextColor(Color.parseColor("#4F46E5"))
        })
        root.addView(TextView(this).apply {
            text = "Phiên bản ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · Android 11+"
            textSize = 12f
            setTextColor(Color.DKGRAY)
        })
'''
    new_login_header = '''        addBrandHeader(
            root,
            subtitle = "Báo hàng · Beta",
            meta = "Phiên bản ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · Android 11+",
        )
'''
    text = replace_once(text, old_login_header, new_login_header, 'login-header')

    old_login_status = '''        status = TextView(this).apply {
            text = message
            textSize = 13f
            setPadding(0, dp(12), 0, dp(8))
        }
        root.addView(status)
        setContentView(wrapScroll(root))
'''
    new_login_status = '''        status = TextView(this).apply {
            text = message
            textSize = 13f
            setTextColor(conceptGreenDark)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = roundedBackground(conceptGreenSoft, conceptLine, 10)
        }
        root.addView(status)
        applyConcept3Tree(root)
        setContentView(wrapScroll(root))
'''
    text = replace_once(text, old_login_status, new_login_status, 'login-status')

    old_home_header = '''        root.addView(TextView(this).apply {
            text = "SUPRA Inventory — Beta"
            textSize = 22f
            setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "${session.displayName} · ${session.employeeCode ?: "—"} · ${roleLabel(session.role)}"
            textSize = 13f
            setTextColor(Color.DKGRAY)
        })
'''
    new_home_header = '''        addBrandHeader(root, subtitle = "Kho vận · Báo hàng", meta = "Beta")
        val identityCard = card()
        identityCard.addView(TextView(this).apply {
            text = session.displayName
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(conceptText)
        })
        identityCard.addView(TextView(this).apply {
            text = "${session.employeeCode ?: session.userId} · ${roleLabel(session.role)}"
            textSize = 12.5f
            setTextColor(conceptMuted)
            setPadding(0, dp(3), 0, 0)
        })
        root.addView(identityCard)
'''
    text = replace_once(text, old_home_header, new_home_header, 'home-header')

    old_home_status = '''        status = TextView(this).apply {
            text = "Đã đăng nhập. Đang tải dữ liệu..."
            textSize = 13f
            setPadding(0, dp(8), 0, dp(8))
        }
        root.addView(status)
'''
    new_home_status = '''        status = TextView(this).apply {
            text = "Đã đăng nhập. Đang tải dữ liệu..."
            textSize = 13f
            setTextColor(conceptGreenDark)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = roundedBackground(conceptGreenSoft, conceptLine, 10)
        }
        root.addView(status)
'''
    text = replace_once(text, old_home_status, new_home_status, 'home-status')

    old_home_set = '''        setContentView(wrapScroll(root))
        startRealtime(session)
'''
    new_home_set = '''        applyConcept3Tree(root)
        setContentView(wrapScroll(root))
        startRealtime(session)
'''
    text = replace_once(text, old_home_set, new_home_set, 'home-style-tree')

    text = text.replace('setTextColor(Color.DKGRAY)', 'setTextColor(conceptMuted)')
    text = text.replace('setTextColor(Color.parseColor("#6B7280"))', 'setTextColor(conceptMuted)')

    text = replace_once(text,
        '''        else -> Color.parseColor("#1D4ED8")
''',
        '''        else -> conceptOrange
''',
        'pending-status-color')

    old_helpers = '''    private fun page(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(24), dp(18), dp(30))
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun wrapScroll(content: View): ScrollView = ScrollView(this).apply {
        isFillViewport = true
        addView(content)
    }

    private fun sectionTitle(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 20f
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(16), 0, dp(8))
    }

    private fun emptyState(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 13f
        setTextColor(conceptMuted)
        setPadding(dp(12), dp(16), dp(12), dp(16))
    }

    private fun card(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(12), dp(14), dp(12))
        background = GradientDrawable().apply {
            setColor(Color.WHITE)
            cornerRadius = dp(12).toFloat()
            setStroke(dp(1), Color.parseColor("#E5E7EB"))
        }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply {
            topMargin = dp(8)
            bottomMargin = dp(4)
        }
    }
'''
    new_helpers = '''    private fun roundedBackground(fill: Int, stroke: Int = conceptLine, radiusDp: Int = 12): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = dp(radiusDp).toFloat()
            setStroke(dp(1), stroke)
        }

    private fun addBrandHeader(root: LinearLayout, subtitle: String, meta: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(14))
        }
        row.addView(TextView(this).apply {
            text = "SI"
            textSize = 18f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
            background = roundedBackground(conceptGreen, conceptGreen, 11)
            layoutParams = LinearLayout.LayoutParams(dp(46), dp(46)).apply { marginEnd = dp(11) }
        })
        row.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = weightedParams()
            addView(TextView(this@MainActivity).apply {
                text = "SUPRA Inventory"
                textSize = 22f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(conceptText)
            })
            addView(TextView(this@MainActivity).apply {
                text = subtitle
                textSize = 12.5f
                setTextColor(conceptGreen)
            })
        })
        if (meta.isNotBlank()) row.addView(TextView(this).apply {
            text = meta
            textSize = 11f
            setTextColor(conceptMuted)
            gravity = Gravity.END
        })
        root.addView(row)
    }

    private fun styleButton(button: Button) {
        val label = button.text.toString().lowercase()
        val warning = label.contains("skip")
        val secondary = listOf("cập nhật", "đăng xuất", "tải lại", "đồng bộ", "xem picker", "kiểm tra cập nhật", "thu hồi", "sửa thành").any { label.contains(it) }
        val fill = when { warning -> conceptOrangeSoft; secondary -> Color.WHITE; else -> conceptGreen }
        val textColor = when { warning -> conceptOrange; secondary -> conceptGreenDark; else -> Color.WHITE }
        val stroke = when { warning -> Color.parseColor("#F2C78B"); secondary -> conceptLine; else -> conceptGreen }
        button.isAllCaps = false
        button.minHeight = dp(48)
        button.setTextColor(textColor)
        button.background = roundedBackground(fill, stroke, 10)
        button.setPadding(dp(14), dp(10), dp(14), dp(10))
    }

    private fun styleInput(input: EditText) {
        input.minHeight = dp(52)
        input.setTextColor(conceptText)
        input.setHintTextColor(Color.parseColor("#84928A"))
        input.background = roundedBackground(Color.WHITE, Color.parseColor("#CFDCD4"), 10)
        input.setPadding(dp(13), dp(10), dp(13), dp(10))
    }

    private fun applyConcept3Tree(view: View) {
        when (view) {
            is Button -> styleButton(view)
            is EditText -> styleInput(view)
            is CheckBox -> view.buttonTintList = ColorStateList.valueOf(conceptGreen)
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) applyConcept3Tree(view.getChildAt(index))
        }
    }

    private fun page(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(20), dp(18), dp(30))
        setBackgroundColor(conceptSurface)
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun wrapScroll(content: View): ScrollView = ScrollView(this).apply {
        isFillViewport = true
        setBackgroundColor(conceptSurface)
        addView(content)
    }

    private fun sectionTitle(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 19f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(conceptText)
        setPadding(0, dp(18), 0, dp(8))
    }

    private fun emptyState(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 13f
        setTextColor(conceptMuted)
        setPadding(dp(14), dp(16), dp(14), dp(16))
        background = roundedBackground(Color.parseColor("#F7FAF8"), conceptLine, 10)
    }

    private fun card(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(13), dp(14), dp(13))
        background = roundedBackground(Color.WHITE, conceptLine, 12)
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply {
            topMargin = dp(8)
            bottomMargin = dp(5)
        }
    }
'''
    text = replace_once(text, old_helpers, new_helpers, 'ui-helper-block')

    # Style controls created after initial render (lists/suggestions refreshed asynchronously).
    text = replace_once(text,
        '''        for (item in items) {
            box.addView(Button(this).apply {
                text = "${item.sku} — ${item.productName}"
                isAllCaps = false
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                setOnClickListener { selectSku(item) }
            })
        }
    }

    private fun selectSku''',
        '''        for (item in items) {
            box.addView(Button(this).apply {
                text = "${item.sku} — ${item.productName}"
                isAllCaps = false
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                setOnClickListener { selectSku(item) }
            })
        }
        applyConcept3Tree(box)
    }

    private fun selectSku''',
        'style-suggestions')

    text = replace_once(text,
        '''            box.addView(card)
        }
    }

    private fun detectPickerResultChanges''',
        '''            box.addView(card)
        }
        applyConcept3Tree(box)
    }

    private fun detectPickerResultChanges''',
        'style-picker-reports')

    text = replace_once(text,
        '''            box.addView(card)
        }
    }

    private fun renderReporterRecent''',
        '''            box.addView(card)
        }
        applyConcept3Tree(box)
    }

    private fun renderReporterRecent''',
        'style-reporter-queue')

    text = replace_once(text,
        '''            box.addView(card)
        }
    }

    private fun confirmResolve''',
        '''            box.addView(card)
        }
        applyConcept3Tree(box)
    }

    private fun confirmResolve''',
        'style-reporter-recent')

    MAIN.write_text(text, encoding="utf-8")


def patch_styles() -> None:
    STYLES.write_text('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar">
        <item name="android:fontFamily">sans</item>
        <item name="android:windowActionModeOverlay">true</item>
        <item name="android:colorAccent">#087443</item>
        <item name="android:navigationBarColor">#F4F8F5</item>
        <item name="android:statusBarColor">#F4F8F5</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
        <item name="android:windowBackground">#F4F8F5</item>
    </style>
</resources>
''', encoding='utf-8')


def update_state() -> None:
    state = json.loads(STATE.read_text(encoding='utf-8'))
    state['current_status']['android'] = 'CONCEPT3_ROLE_UI_SOURCE_BUILD_PENDING_SIGNED_OTA_CI'
    line = 'Android/PDA Concept 3 visual refactor preserving Picker/Reporter role workflows — source patched, signed Beta CI pending'
    if line not in state['completed_capabilities']: state['completed_capabilities'].append(line)
    state['next_action']['primary'] = 'Verify signed Concept 3 Android/PDA Beta release, then run load/resilience/quota testing and Owner business acceptance.'
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    registry['environments']['beta']['android_source_status'] = 'CONCEPT3_ROLE_UI_SOURCE_BUILD_PENDING_SIGNED_OTA_CI'
    registry['ui_design'] = {
      'authority': 'OWNER_SELECTED_CONCEPT_3',
      'web': 'LIGHT_GREEN_OPERATIONAL_DEPLOYED_PASS',
      'android': 'LIGHT_GREEN_OPERATIONAL_SOURCE_PENDING_SIGNED_CI',
      'scope_guard': 'VISUAL_SYSTEM_ONLY_BUSINESS_RULES_REMAIN_AUTHORITATIVE'
    }
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    patch_main(); patch_styles(); update_state(); print('CONCEPT3_ANDROID_PATCH_PASS')


if __name__ == '__main__':
    main()
