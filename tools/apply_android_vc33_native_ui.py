#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt"
APP = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApplication.kt"
MANIFEST = ROOT / "android/app/src/main/AndroidManifest.xml"
GUARD = ROOT / "tools/ui_design_guard.py"
DECISIONS = ROOT / "docs/OWNER_DECISIONS.md"
DESIGN = ROOT / "docs/specs/UI_DESIGN_SYSTEM.md"
STATE = ROOT / "ops/project-state.json"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"ANCHOR_NOT_FOUND:{label}")
    return text.replace(old, new, 1)


def remove_once(text: str, old: str, label: str) -> str:
    return replace_once(text, old, "", label)


main = MAIN.read_text(encoding="utf-8")

main = replace_once(
    main,
    "import android.widget.EditText\nimport android.widget.LinearLayout\n",
    "import android.widget.EditText\nimport android.widget.ImageView\nimport android.widget.LinearLayout\n",
    "imageview_import",
)

main = replace_once(
    main,
    "    private lateinit var status: TextView\n    private lateinit var updateButton: Button\n    private var realtimeClient: AndroidRealtimeClient? = null\n",
    "    private enum class UpdateGate { CHECKING, CURRENT, REQUIRED, FAILED }\n\n    private lateinit var status: TextView\n    private lateinit var updateButton: Button\n    private var loginButton: Button? = null\n    @Volatile private var updateGate = UpdateGate.CHECKING\n    @Volatile private var updateCheckRunning = false\n    private var realtimeClient: AndroidRealtimeClient? = null\n",
    "update_gate_fields",
)

main = replace_once(
    main,
    "        ui.post(withdrawTicker)\n        renderLogin()\n        checkForUpdate(silent = true)\n",
    "        ui.post(withdrawTicker)\n        renderLogin()\n",
    "oncreate_single_update_path",
)

main = replace_once(
    main,
    "    override fun onResume() {\n        super.onResume()\n        val pending = pendingInstallFile ?: return\n        if (packageManager.canRequestPackageInstalls()) {\n            pendingInstallFile = null\n            launchInstaller(pending)\n        }\n    }\n\n    private fun renderLogin(message: String = \"Sẵn sàng đăng nhập Beta.\") {\n",
    "    override fun onResume() {\n        super.onResume()\n        val pending = pendingInstallFile\n        if (pending != null) {\n            if (packageManager.canRequestPackageInstalls()) {\n                pendingInstallFile = null\n                launchInstaller(pending)\n            }\n            return\n        }\n        if (::api.isInitialized && api.session == null && updateGate != UpdateGate.CURRENT && !updateCheckRunning) {\n            checkForUpdate(silent = true)\n        }\n    }\n\n    private fun renderLogin(message: String = \"Đang kiểm tra phiên bản...\") {\n",
    "onresume_and_login_default",
)

main = replace_once(
    main,
    "        val root = page()\n        addBrandHeader(\n            root,\n            subtitle = \"Báo hàng · Beta\",\n            meta = \"Phiên bản ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · Android 11+\",\n        )\n",
    "        val root = page()\n        addBrandHeader(root, subtitle = \"Báo hàng · Beta\")\n",
    "login_header_no_meta",
)

main = replace_once(
    main,
    "        val username = EditText(this).apply {\n            hint = \"MNV / tên đăng nhập\"\n",
    "        val username = EditText(this).apply {\n            hint = \"Mã nhân viên / tên đăng nhập\"\n",
    "native_employee_label",
)

main = replace_once(
    main,
    "        val showPassword = CheckBox(this).apply { text = \"Hiện mật khẩu\" }\n        val loginButton = Button(this).apply { text = \"Đăng nhập\" }\n        loginCard.addView(username)\n        loginCard.addView(password)\n        loginCard.addView(showPassword)\n        loginCard.addView(loginButton)\n",
    "        val showPassword = CheckBox(this).apply { text = \"Hiện mật khẩu\" }\n        val login = Button(this).apply {\n            text = \"Đăng nhập\"\n            isEnabled = false\n        }\n        loginButton = login\n        loginCard.addView(username)\n        loginCard.addView(password)\n        loginCard.addView(showPassword)\n        loginCard.addView(login)\n",
    "native_login_button",
)

main = replace_once(
    main,
    "        root.addView(status)\n        applyConcept3Tree(root)\n        setContentView(wrapScroll(root))\n",
    "        root.addView(status)\n        addFooter(root)\n        applyOperationalStyles(root)\n        setContentView(wrapScroll(root))\n        applyUpdateGateUi(message)\n        checkForUpdate(silent = true)\n",
    "login_footer_styles_gate",
)

main = replace_once(
    main,
    "        loginButton.setOnClickListener {\n            val user = username.text.toString().trim().lowercase()\n",
    "        login.setOnClickListener {\n            if (updateGate != UpdateGate.CURRENT) {\n                setStatus(updateGateMessage())\n                return@setOnClickListener\n            }\n            val user = username.text.toString().trim().lowercase()\n",
    "login_gate_click",
)

main = replace_once(
    main,
    "            loginButton.isEnabled = false\n            setStatus(\"Đang đăng nhập...\")\n",
    "            login.isEnabled = false\n            setStatus(\"Đang đăng nhập...\")\n",
    "login_disable_direct",
)

main = replace_once(
    main,
    "                        loginButton.isEnabled = true\n                        setStatus(friendlyError(error))\n",
    "                        login.isEnabled = updateGate == UpdateGate.CURRENT\n                        setStatus(friendlyError(error))\n",
    "login_reenable_guarded",
)

main = replace_once(
    main,
    "        updateButton.setOnClickListener { checkForUpdate(silent = false) }\n    }\n\n    private fun renderHome(session: AppSession) {\n",
    "        updateButton.setOnClickListener { checkForUpdate(silent = false) }\n    }\n\n    private fun renderHome(session: AppSession) {\n        loginButton = null\n",
    "clear_login_button_home",
)

main = replace_once(
    main,
    "        val root = page()\n        addBrandHeader(root, subtitle = \"Kho vận · Báo hàng\", meta = \"Beta\")\n",
    "        val root = page()\n        addBrandHeader(root, subtitle = \"Kho vận · Báo hàng · Beta\")\n",
    "home_header_no_meta",
)

main = replace_once(
    main,
    "        applyConcept3Tree(root)\n        setContentView(wrapScroll(root))\n        startRealtime(session)\n",
    "        addFooter(root)\n        applyOperationalStyles(root)\n        setContentView(wrapScroll(root))\n        startRealtime(session)\n",
    "home_footer_styles",
)

main = remove_once(
    main,
    "        root.addView(TextView(this).apply {\n            text = \"Nhập hoặc quét tối thiểu 3 ký tự. Gợi ý tìm trực tiếp trên catalog đã cache trong PDA.\"\n            textSize = 13f\n            setTextColor(conceptMuted)\n        })\n\n",
    "picker_explanatory_text",
)
main = main.replace('            text = "Báo hết hàng"', '            text = "Báo SKU hết hàng"')
main = main.replace('            text = "Báo của tôi"', '            text = "Lịch sử báo hàng"')

main = replace_once(
    main,
    "    private fun renderReporter(root: LinearLayout, role: String) {\n        root.addView(sectionTitle(\"Điều phối Inventory\"))\n        root.addView(TextView(this).apply {\n            text = \"Ưu tiên: nhiều Picker bị ảnh hưởng hơn trước; bằng nhau thì báo đầu sớm hơn.\"\n            textSize = 13f\n            setTextColor(conceptMuted)\n        })\n        if (role == \"ADMIN\" || role == \"ROOT\") {\n            root.addView(TextView(this).apply {\n                text = \"PDA tập trung vận hành Reporter. Quản trị Master SKU / nhân sự thực hiện trên Website.\"\n                textSize = 12f\n                setTextColor(conceptMuted)\n            })\n        }\n\n        root.addView(Button(this).apply {\n            text = \"Tải lại danh sách vận hành\"\n",
    "    private fun renderReporter(root: LinearLayout, role: String) {\n        root.addView(sectionTitle(\"Hàng chờ xử lý\"))\n\n        root.addView(Button(this).apply {\n            text = \"Làm mới hàng chờ xử lý\"\n",
    "reporter_operational_copy",
)
main = main.replace('root.addView(sectionTitle("Kết quả gần đây"))', 'root.addView(sectionTitle("Kết quả xử lý gần đây"))')
main = main.replace('                text = "Đã có hàng"', '                text = "Có hàng"')

main = main.replace("applyConcept3Tree(", "applyOperationalStyles(")

old_header = '''    private fun addBrandHeader(root: LinearLayout, subtitle: String, meta: String) {
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
'''
new_header = '''    private fun addBrandHeader(root: LinearLayout, subtitle: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(14))
        }
        row.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_inventory_alert)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            contentDescription = "SUPRA Inventory"
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).apply { marginEnd = dp(12) }
        })
        row.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            addView(TextView(this@MainActivity).apply {
                text = "SUPRA Inventory"
                textSize = 22f
                maxLines = 1
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(conceptText)
            })
            addView(TextView(this@MainActivity).apply {
                text = subtitle
                textSize = 12.5f
                maxLines = 1
                setTextColor(conceptGreen)
            })
        })
        root.addView(row)
    }

    private fun addFooter(root: LinearLayout) {
        root.addView(TextView(this).apply {
            text = "Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291"
            textSize = 10f
            gravity = Gravity.CENTER
            setTextColor(conceptMuted)
            setPadding(dp(8), dp(16), dp(8), dp(4))
        })
    }
'''
main = replace_once(main, old_header, new_header, "native_header_footer")

main = replace_once(
    main,
    "    private fun applyOperationalStyles(view: View) {\n",
    "    private fun applyOperationalStyles(view: View) {\n",
    "operational_styles_exists",
)

main = replace_once(
    main,
    "        addBrandHeader(root, subtitle = \"Báo hàng · Beta\", meta = \"\")\n",
    "        addBrandHeader(root, subtitle = \"Báo hàng · Beta\")\n",
    "fatal_header",
)
main = replace_once(
    main,
    "        root.addView(fatalCard)\n        setContentView(wrapScroll(root))\n",
    "        root.addView(fatalCard)\n        addFooter(root)\n        applyOperationalStyles(root)\n        setContentView(wrapScroll(root))\n",
    "fatal_footer_styles",
)

old_update = '''    private fun checkForUpdate(silent: Boolean) {
        if (!::updateButton.isInitialized) return
        updateButton.isEnabled = false
        if (!silent) setStatus("Đang kiểm tra phiên bản mới...")
        Thread {
            try {
                val info = fetchLatestUpdate()
                if (info == null || info.versionCode <= BuildConfig.VERSION_CODE) {
                    runOnUiThread {
                        updateButton.isEnabled = true
                        if (!silent) setStatus("Đang dùng bản mới nhất.")
                    }
                    return@Thread
                }
                runOnUiThread { setStatus("Có bản mới ${info.tag}. Đang tải và kiểm tra SHA-256...") }
                val apk = downloadAndVerify(info)
                runOnUiThread {
                    updateButton.isEnabled = true
                    requestInstall(apk)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    updateButton.isEnabled = true
                    if (!silent) setStatus("Không kiểm tra được cập nhật: ${error.message ?: "unknown"}")
                }
            }
        }.start()
    }

    private fun fetchLatestUpdate(): UpdateInfo? {
        val connection = openDownloadConnection(BuildConfig.UPDATE_RELEASE_API)
        val code = connection.responseCode
        if (code == 404) return null
        val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (code !in 200..299) throw IllegalStateException("Update API HTTP $code")
        val release = org.json.JSONObject(text)
        val tag = release.optString("tag_name")
        val versionCode = Regex("^beta-vc(\\d+)$").find(tag)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: return null
        val assets = release.optJSONArray("assets") ?: return null
        var apkUrl = ""
        var checksumUrl = ""
        for (index in 0 until assets.length()) {
            val asset = assets.optJSONObject(index) ?: continue
            when (asset.optString("name")) {
                "supra-inventory-beta.apk" -> apkUrl = asset.optString("browser_download_url")
                "supra-inventory-beta.apk.sha256" -> checksumUrl = asset.optString("browser_download_url")
            }
        }
        if (apkUrl.isBlank() || checksumUrl.isBlank()) return null
        return UpdateInfo(versionCode, tag, apkUrl, checksumUrl)
    }
'''
new_update = '''    private fun updateGateMessage(): String = when (updateGate) {
        UpdateGate.CHECKING -> "Đang kiểm tra phiên bản..."
        UpdateGate.CURRENT -> "Sẵn sàng đăng nhập."
        UpdateGate.REQUIRED -> "Có bản cập nhật mới. Cần cập nhật trước khi đăng nhập."
        UpdateGate.FAILED -> "Chưa xác minh được bản cập nhật. Không thể đăng nhập. Kiểm tra mạng và thử lại."
    }

    private fun applyUpdateGateUi(message: String? = null) {
        loginButton?.isEnabled = updateGate == UpdateGate.CURRENT && !updateCheckRunning
        if (::updateButton.isInitialized) {
            updateButton.isEnabled = !updateCheckRunning
            updateButton.text = when (updateGate) {
                UpdateGate.REQUIRED -> "Cập nhật ngay"
                UpdateGate.FAILED -> "Thử lại cập nhật"
                else -> "Kiểm tra cập nhật"
            }
        }
        if (!message.isNullOrBlank()) setStatus(message)
    }

    private fun checkForUpdate(silent: Boolean) {
        if (!::updateButton.isInitialized || updateCheckRunning) return
        updateCheckRunning = true
        updateGate = UpdateGate.CHECKING
        applyUpdateGateUi(if (api.session == null || !silent) "Đang kiểm tra phiên bản..." else null)
        Thread {
            try {
                val info = fetchLatestUpdate()
                if (info.versionCode <= BuildConfig.VERSION_CODE) {
                    updateGate = UpdateGate.CURRENT
                    runOnUiThread {
                        updateCheckRunning = false
                        val message = when {
                            api.session == null -> "Sẵn sàng đăng nhập."
                            !silent -> "Đang dùng bản mới nhất."
                            else -> null
                        }
                        applyUpdateGateUi(message)
                    }
                    return@Thread
                }

                updateGate = UpdateGate.REQUIRED
                runOnUiThread {
                    applyUpdateGateUi("Có bản cập nhật ${info.tag}. Đang tải và kiểm tra SHA-256...")
                }
                val apk = downloadAndVerify(info)
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi("Đã tải ${info.tag}. Cần cài đặt trước khi đăng nhập.")
                    requestInstall(apk)
                }
            } catch (error: Exception) {
                updateGate = UpdateGate.FAILED
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi("Chưa xác minh được bản cập nhật. Không thể đăng nhập. Kiểm tra mạng và thử lại.")
                }
            }
        }.start()
    }

    private fun fetchLatestUpdate(): UpdateInfo {
        val connection = openDownloadConnection(BuildConfig.UPDATE_RELEASE_API)
        val code = connection.responseCode
        val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (code !in 200..299) throw IllegalStateException("Update API HTTP $code")
        val release = org.json.JSONObject(text)
        val tag = release.optString("tag_name")
        val versionCode = Regex("^beta-vc(\\d+)$").find(tag)?.groupValues?.getOrNull(1)?.toIntOrNull()
            ?: throw IllegalStateException("Release Beta không hợp lệ.")
        val assets = release.optJSONArray("assets") ?: throw IllegalStateException("Release Beta thiếu APK.")
        var apkUrl = ""
        var checksumUrl = ""
        for (index in 0 until assets.length()) {
            val asset = assets.optJSONObject(index) ?: continue
            when (asset.optString("name")) {
                "supra-inventory-beta.apk" -> apkUrl = asset.optString("browser_download_url")
                "supra-inventory-beta.apk.sha256" -> checksumUrl = asset.optString("browser_download_url")
            }
        }
        if (apkUrl.isBlank() || checksumUrl.isBlank()) throw IllegalStateException("Release Beta thiếu file cập nhật hợp lệ.")
        return UpdateInfo(versionCode, tag, apkUrl, checksumUrl)
    }
'''
main = replace_once(main, old_update, new_update, "native_update_gate")

MAIN.write_text(main, encoding="utf-8")

manifest = MANIFEST.read_text(encoding="utf-8")
manifest = remove_once(manifest, '        android:name=".InventoryApplication"\n', "remove_application_postprocessor")
MANIFEST.write_text(manifest, encoding="utf-8")
if APP.exists():
    APP.unlink()

# Rewrite the UI guard so Android behavior is validated in MainActivity directly.
guard = GUARD.read_text(encoding="utf-8")
guard = guard.replace('ANDROID_APP = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApplication.kt").read_text(encoding="utf-8")\n', '')
guard = guard.replace(
    '    "android_operational_application": \'android:name=".InventoryApplication"\' in ANDROID_MANIFEST,\n',
    '    "android_no_post_layout_application": \'android:name=".InventoryApplication"\' not in ANDROID_MANIFEST,\n',
)
guard = guard.replace('    "android_footer_credit": ANDROID_CREDIT in ANDROID_APP,\n', '    "android_footer_credit": ANDROID_CREDIT in ANDROID,\n')
guard = guard.replace('    "android_employee_code_full_label": "Mã nhân viên / tên đăng nhập" in ANDROID_APP,\n', '    "android_employee_code_full_label": "Mã nhân viên / tên đăng nhập" in ANDROID,\n')
guard = guard.replace('    "android_business_header_icon": \'current == "SI"\' in ANDROID_APP and "R.drawable.ic_inventory_alert" in ANDROID_APP,\n', '    "android_business_header_icon": "ImageView" in ANDROID and "R.drawable.ic_inventory_alert" in ANDROID,\n')
guard = guard.replace('    "android_picker_report_flow_preserved": "private fun renderPicker" in ANDROID and \'replace("Báo hết hàng", "Báo SKU hết hàng")\' in ANDROID_APP,\n', '    "android_picker_report_flow_preserved": "private fun renderPicker" in ANDROID and "Báo SKU hết hàng" in ANDROID and "Lịch sử báo hàng" in ANDROID,\n')
guard = guard.replace('    "android_mandatory_update_gate": all(token in ANDROID_APP for token in ["UpdateGate.CHECKING", "UpdateGate.REQUIRED", "UpdateGate.FAILED", "BuildConfig.UPDATE_RELEASE_API", "view.isEnabled = false"]),\n', '    "android_mandatory_update_gate": all(token in ANDROID for token in ["UpdateGate.CHECKING", "UpdateGate.REQUIRED", "UpdateGate.FAILED", "BuildConfig.UPDATE_RELEASE_API", "loginButton?.isEnabled = updateGate == UpdateGate.CURRENT"]),\n')
guard = guard.replace('    "android_version_meta_removed_from_header": \'text.startsWith("Phiên bản ")\' in ANDROID_APP and "View.GONE" in ANDROID_APP,\n', '    "android_version_meta_removed_from_header": "private fun addBrandHeader(root: LinearLayout, subtitle: String)" in ANDROID and "meta: String" not in ANDROID and "Phiên bản ${BuildConfig.VERSION_NAME}" not in ANDROID,\n')
guard = guard.replace(
    '    "design_spec_practical_balanced": "Practical Balanced" in DESIGN_SPEC and "Phương án 1" in DESIGN_SPEC and "mandatory update gate" in DESIGN_SPEC.lower(),\n',
    '    "android_no_explanatory_ui_patch": "InventoryApplication" not in ANDROID_MANIFEST and "Nhập hoặc quét tối thiểu 3 ký tự. Gợi ý" not in ANDROID and "Ưu tiên: nhiều Picker bị ảnh hưởng hơn trước" not in ANDROID,\n    "design_spec_practical_balanced": "Practical Balanced" in DESIGN_SPEC and "Phương án 1" in DESIGN_SPEC and "mandatory update gate" in DESIGN_SPEC.lower(),\n',
)
GUARD.write_text(guard, encoding="utf-8")

# Durable Owner decision: native Android layout/update gate is the single source of UI truth.
decisions = DECISIONS.read_text(encoding="utf-8")
marker = '| D041 | ACTIVE | Android/PDA must implement the approved narrow-screen layout, labels, footer and mandatory update gate directly in the primary activity/view source. Do not use an Application-level/post-layout tree rewriter to hide, rename or restyle business UI after rendering; this avoids layout races, repeated traversal overhead and device-dependent alignment. |\n'
if "| D041 |" not in decisions:
    anchor = "| D040 | ACTIVE | Android/PDA UI must be narrow-screen-first, consistently aligned and operationally concise. Remove long version metadata competing with the product title, remove AI/design-discussion/explanatory prose that is not needed for the current task, use an adaptive launcher icon whose green brand color fills the launcher mask without an extra white wrapper, and use footer `Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291`. This supersedes only the old footer wording within D036. |\n"
    decisions = replace_once(decisions, anchor, anchor + marker, "decision_d041")
DECISIONS.write_text(decisions, encoding="utf-8")

design = DESIGN.read_text(encoding="utf-8")
if "## Android native rendering rule" not in design:
    insert = '''\n## Android native rendering rule\n\n- Approved labels, footer, header layout and update/login gate are implemented directly in the primary Android activity/view source.\n- Do not rely on an `Application` lifecycle callback or generic post-layout view-tree traversal to hide/rename/restyle operational controls after rendering.\n- Header composition must remain stable at narrow PDA widths without a right-side version/meta element stealing title width.\n- Update verification is fail-closed before login and shares one update state machine with the download/install flow.\n'''
    design = design.replace("\n## Persistent product credit\n", insert + "\n## Persistent product credit\n", 1)
DESIGN.write_text(design, encoding="utf-8")

state = json.loads(STATE.read_text(encoding="utf-8"))
state["pending_build"] = [
    "Android vc33 native UI/update-gate remediation in progress: remove post-layout Application UI rewriter, render stable narrow-screen header/footer/labels natively, and make the login gate share the verified auto-update state machine.",
    *[x for x in state.get("pending_build", []) if not x.startswith("Android vc33 native UI/update-gate remediation")],
]
state["field_pending"] = [
    "Owner physical-PDA verification of the next signed Android build remains required after native UI/update-gate remediation.",
    "Physical logged-in PDA FCM delivery remains field-pending.",
]
state["next_action"] = {
    "primary": "Finish Android vc33 native UI/update-gate remediation through branch -> PR -> authority + continuity + UI/build checks -> merge, then automatically verify Beta deploy and signed monotonic APK release.",
    "method": "Keep beta-vc32 as the current runtime baseline until post-merge signed release evidence proves the new build. Stable remains untouched.",
    "stable_guard": "Do not activate Stable.",
}
state["workboard"]["in_progress"] = [
    "Android vc33 native narrow-screen UI source cleanup",
    "Single fail-closed latest-version gate shared with APK download/install flow",
    "Removal of Application-level post-layout business UI rewriting",
]
state["workboard"]["next"] = [
    "Open PR and pass authority + continuity + Practical Balanced Android build guard",
    "Merge only after required checks PASS",
    "Poll Beta Worker deploy and signed Android release until terminal PASS",
    "Owner field-test the resulting signed APK on physical PDA",
    "Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA",
]
STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("ANDROID_VC33_NATIVE_UI_CODEMOD_APPLIED")
