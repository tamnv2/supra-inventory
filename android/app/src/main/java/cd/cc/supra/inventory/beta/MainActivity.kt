package cd.cc.supra.inventory.beta

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.text.method.PasswordTransformationMethod
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.FileProvider
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.ArrayDeque
import java.util.UUID

class MainActivity : Activity() {
    private enum class UpdateGate { CHECKING, CURRENT, REQUIRED, FAILED }

    private val uiHandler = Handler(Looper.getMainLooper())
    private val logTime = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.of("Asia/Ho_Chi_Minh"))
    private val localLog = ArrayDeque<String>()
    private lateinit var api: InventoryApi
    private lateinit var skuCache: SkuCatalogCache
    private lateinit var kit: InventoryUi
    private lateinit var status: TextView
    private lateinit var updateButton: Button
    private var loginButton: Button? = null
    private var pickerController: PickerController? = null
    private var reporterController: ReporterController? = null
    private var adminLauncherController: AdminLauncherController? = null
    private var realtimeClient: AndroidRealtimeClient? = null
    private var statusHideTask: Runnable? = null
    private var pendingInstallFile: File? = null
    @Volatile private var updateGate = UpdateGate.CHECKING
    @Volatile private var updateCheckRunning = false

    private val notificationDeviceId: String by lazy {
        val prefs = getSharedPreferences("notification_device", MODE_PRIVATE)
        prefs.getString("device_id", null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString("device_id", it).apply()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        kit = InventoryUi(this)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            renderFatal("Thiết bị cần Android 11 trở lên.")
            return
        }
        if (BuildConfig.FIREBASE_API_KEY.isBlank()) {
            renderFatal("Thiếu cấu hình Firebase Beta.")
            return
        }
        val options = FirebaseOptions.Builder()
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setApplicationId(BuildConfig.FIREBASE_APP_ID)
            .setGcmSenderId(BuildConfig.FIREBASE_MESSAGING_SENDER_ID)
            .build()
        if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this, options)
        createNotificationChannel()
        api = InventoryApi(
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
            userAgent = "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}",
        )
        skuCache = SkuCatalogCache(this)
        renderLogin()
    }

    override fun onDestroy() {
        statusHideTask?.let { uiHandler.removeCallbacks(it) }
        pickerController?.destroy()
        realtimeClient?.stop()
        realtimeClient = null
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        val pending = pendingInstallFile
        if (pending != null) {
            if (packageManager.canRequestPackageInstalls()) {
                pendingInstallFile = null
                launchInstaller(pending)
            }
            return
        }
        if (::api.isInitialized && api.session == null && updateGate != UpdateGate.CURRENT && !updateCheckRunning) {
            checkForUpdate(silent = true)
        }
        if (::api.isInitialized && api.session != null) reconcileNotificationSignal()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (::api.isInitialized && api.session != null) reconcileNotificationSignal()
    }

    private fun reconcileNotificationSignal() {
        if (!NotificationSignalStore.consumeDirty(applicationContext)) return
        drainNotificationReceipts()
        val picker = pickerController
        val reporter = reporterController
        when {
            picker != null -> picker.refresh()
            reporter != null -> reporter.refresh()
            else -> setStatus("Có cập nhật nghiệp vụ mới. Mở Vận hành để xem.")
        }
    }

    private fun renderLogin(message: String = "Đang kiểm tra phiên bản...") {
        stopOperationalClients()
        val root = kit.page()
        addBrandHeader(root, subtitle = "Báo hàng · Beta")
        val card = kit.card()
        card.addView(kit.title("Đăng nhập", 18f))
        val username = EditText(this).apply {
            hint = "Mã nhân viên / tên đăng nhập"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            kit.styleInput(this)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.dp(8) }
        }
        val password = EditText(this).apply {
            hint = "Mật khẩu"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            transformationMethod = PasswordTransformationMethod.getInstance()
            kit.styleInput(this)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.dp(8) }
        }
        val showPassword = CheckBox(this).apply { text = "Hiện mật khẩu" }
        val login = Button(this).apply {
            text = "Đăng nhập"
            isEnabled = false
            kit.stylePrimary(this)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.dp(8) }
        }
        loginButton = login
        card.addView(username)
        card.addView(password)
        card.addView(showPassword)
        card.addView(login)
        root.addView(card)
        updateButton = Button(this).apply {
            text = "Kiểm tra cập nhật"
            kit.styleSecondary(this)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.dp(7) }
        }
        root.addView(updateButton)
        status = kit.createStatusView(message, true)
        root.addView(status)
        kit.addFooter(root)
        setContentView(kit.wrapScroll(root))
        applyUpdateGateUi(message)
        checkForUpdate(silent = true)

        showPassword.setOnCheckedChangeListener { _, checked ->
            if (checked) {
                password.transformationMethod = null
                password.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            } else {
                password.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                password.transformationMethod = PasswordTransformationMethod.getInstance()
            }
            password.setSelection(password.text.length)
        }
        login.setOnClickListener {
            if (updateGate != UpdateGate.CURRENT) {
                setStatus(updateGateMessage())
                return@setOnClickListener
            }
            val user = username.text.toString().trim().lowercase()
            val pass = password.text.toString().trimEnd('\r', '\n')
            if (!user.matches(Regex("[a-z0-9._-]{1,64}")) || pass.isBlank()) {
                setStatus("Tên đăng nhập hoặc mật khẩu không hợp lệ.")
                return@setOnClickListener
            }
            login.isEnabled = false
            setStatus("Đang đăng nhập...")
            Thread {
                try {
                    val session = api.login(user, pass)
                    runOnUiThread { password.setText(""); renderHome(session) }
                } catch (e: Exception) {
                    runOnUiThread {
                        login.isEnabled = updateGate == UpdateGate.CURRENT
                        setStatus(friendlyError(e))
                    }
                }
            }.start()
        }
        updateButton.setOnClickListener { checkForUpdate(silent = false) }
    }

    private fun renderHome(session: AppSession) {
        loginButton = null
        pickerController?.destroy()
        pickerController = null
        reporterController?.destroy()
        reporterController = null
        adminLauncherController = null
        when (session.role) {
            "PICKER" -> renderPickerHome(session)
            "REPORTER" -> renderReporterHome(session, showLauncherBack = false, initialFilter = "PENDING")
            "ADMIN" -> renderAdminLauncher(session)
            "ROOT" -> renderAdminLauncher(session)
            else -> {
                val root = baseOperationalPage(session)
                root.addView(kit.muted("Vai trò ${session.role} chưa được hỗ trợ trên PDA."))
                finishOperationalPage(root)
            }
        }
        startRealtime(session)
        registerBackgroundNotifications()
        drainNotificationReceipts()
        recordLog("Đăng nhập ${kit.roleLabel(session.role)}: ${session.employeeCode ?: session.displayName}")
    }

    private fun baseOperationalPage(session: AppSession): LinearLayout {
        val root = kit.page()
        kit.addOperationalHeader(root, session, onLog = { showSupportDiagnostics() }, onExit = { confirmLogout() })
        status = kit.createStatusView()
        root.addView(status)
        return root
    }

    private fun finishOperationalPage(root: LinearLayout) {
        kit.addFooter(root)
        setContentView(kit.wrapScroll(root))
    }

    private fun renderPickerHome(session: AppSession) {
        val root = baseOperationalPage(session)
        pickerController = PickerController(this, api, skuCache, kit, ::setStatus, ::friendlyError)
            .also { it.render(root) }
        finishOperationalPage(root)
    }

    private fun renderReporterHome(session: AppSession, showLauncherBack: Boolean, initialFilter: String = "PENDING") {
        pickerController?.destroy()
        pickerController = null
        reporterController?.destroy()
        reporterController = null
        val root = baseOperationalPage(session)
        if (showLauncherBack) {
            root.addView(Button(this).apply {
                text = "← Về trang ${kit.roleLabel(session.role)}"
                kit.styleSecondary(this)
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, kit.dp(46)).apply { topMargin = kit.dp(7) }
                setOnClickListener { renderAdminLauncher(session) }
            })
        }
        reporterController = ReporterController(this, api, kit, ::setStatus, ::friendlyError, initialFilter)
            .also { it.render(root) }
        finishOperationalPage(root)
    }

    private fun renderAdminLauncher(session: AppSession) {
        pickerController?.destroy()
        pickerController = null
        reporterController?.destroy()
        reporterController = null
        val root = baseOperationalPage(session)
        adminLauncherController = AdminLauncherController(
            activity = this,
            session = session,
            kit = kit,
            setStatus = ::setStatus,
            onOpenOperations = { renderReporterHome(session, showLauncherBack = true, initialFilter = "PENDING") },
            onOpenResults = { renderReporterHome(session, showLauncherBack = true, initialFilter = "HAS_STOCK") },
            onOpenLog = { showSupportDiagnostics() },
            onCheckUpdate = { checkForUpdate(silent = false) },
        ).also { it.render(root) }
        finishOperationalPage(root)
    }

    private fun addBrandHeader(root: LinearLayout, subtitle: String) = kit.addBrandHeader(root, subtitle)

    private fun stopOperationalClients() {
        pickerController?.destroy()
        pickerController = null
        reporterController?.destroy()
        reporterController = null
        adminLauncherController = null
        realtimeClient?.stop()
        realtimeClient = null
    }

    private fun confirmLogout() {
        AlertDialog.Builder(this)
            .setTitle("Đăng xuất?")
            .setMessage("Phiên làm việc hiện tại sẽ kết thúc.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Đăng xuất") { _, _ -> logoutWithNotificationCleanup() }
            .show()
    }

    private fun showSupportDiagnostics() {
        val payload = buildSupportDiagnostics()
        val scroll = ScrollView(this).apply {
            addView(TextView(this@MainActivity).apply {
                text = payload
                textSize = 11.5f
                setTextColor(kit.text)
                setPadding(kit.dp(14), kit.dp(8), kit.dp(14), kit.dp(8))
                setTextIsSelectable(true)
            })
        }
        AlertDialog.Builder(this)
            .setTitle("Log hỗ trợ")
            .setView(scroll)
            .setNegativeButton("Đóng", null)
            .setNeutralButton("Chia sẻ") { _, _ ->
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, "SUPRA Inventory Beta support log")
                    putExtra(Intent.EXTRA_TEXT, payload)
                }
                startActivity(Intent.createChooser(intent, "Chia sẻ log hỗ trợ"))
            }
            .show()
    }

    private fun buildSupportDiagnostics(): String {
        val realtime = realtimeClient?.diagnosticSnapshot().orEmpty()
        val errors = localLog
            .filter { line ->
                val value = line.lowercase()
                listOf("lỗi", "không thể", "không hợp lệ", "thất bại", "hết hạn", "chưa xác minh").any(value::contains)
            }
            .takeLast(10)
            .map(::sanitizeDiagnosticText)

        val root = JSONObject()
            .put("format", "supra-inventory-support-v1")
            .put("generated_at", Instant.now().toString())
            .put("app", JSONObject()
                .put("package", BuildConfig.APPLICATION_ID)
                .put("version_name", BuildConfig.VERSION_NAME)
                .put("version_code", BuildConfig.VERSION_CODE))
            .put("device", JSONObject()
                .put("manufacturer", Build.MANUFACTURER.take(80))
                .put("model", Build.MODEL.take(80))
                .put("sdk_int", Build.VERSION.SDK_INT))
            .put("network", JSONObject()
                .put("validated_internet", hasValidatedInternet())
                .put("api_host", Uri.parse(BuildConfig.API_BASE_URL).host.orEmpty()))
            .put("realtime", JSONObject(realtime))
            .put("catalog", JSONObject()
                .put("count", skuCache.count)
                .put("version", sanitizeDiagnosticText(skuCache.version).take(160)))
            .put("recent_errors", JSONArray(errors))

        return root.toString(2).take(16_000)
    }

    private fun hasValidatedInternet(): Boolean {
        val manager = getSystemService(ConnectivityManager::class.java) ?: return false
        val network = manager.activeNetwork ?: return false
        val caps = manager.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun sanitizeDiagnosticText(value: String): String {
        var next = value.take(500)
        val secretPattern = Regex("(?i)(authorization|bearer|token|password|secret|private[_ -]?key|api[_ -]?key)\\s*[:=]\\s*[^\\s,;]+")
        next = secretPattern.replace(next) { match -> "${match.groupValues[1]}=[REDACTED]" }
        next = next.replace(Regex("eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}"), "[REDACTED_JWT]")
        return next
    }
    private fun recordLog(message: String) {
        if (localLog.size >= 80) localLog.removeFirst()
        localLog.addLast("${logTime.format(Instant.now())} · $message")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            StockMessagingService.CHANNEL_ID,
            "SUPRA Inventory · Nghiệp vụ",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = "Cảnh báo báo hàng khi ứng dụng chạy nền" }
        manager.createNotificationChannel(channel)
    }

    private fun registerBackgroundNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 701)
        }
        NotificationSignalStore.latestToken(applicationContext)?.let(::registerNotificationToken)
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val token = if (task.isSuccessful) task.result else null
            if (token.isNullOrBlank()) return@addOnCompleteListener
            NotificationSignalStore.saveToken(applicationContext, token)
            registerNotificationToken(token)
        }
    }

    private fun registerNotificationToken(token: String) {
        if (token.isBlank() || api.session == null) return
        Thread {
            try { api.registerNotificationDevice(notificationDeviceId, token) } catch (_: Exception) { }
        }.start()
    }

    private fun drainNotificationReceipts() {
        if (api.session?.role != "PICKER") return
        val events = NotificationSignalStore.pendingResultEvents(applicationContext)
        if (events.isEmpty()) return
        Thread {
            for (eventId in events) {
                try {
                    api.markResultStage(eventId, "RECEIVED")
                    NotificationSignalStore.clearResultEvent(applicationContext, eventId)
                } catch (_: Exception) {
                    // Keep the event for a later authenticated retry.
                }
            }
        }.start()
    }

    private fun logoutWithNotificationCleanup() {
        stopOperationalClients()
        Thread {
            try { api.unregisterNotificationDevice(notificationDeviceId) } catch (_: Exception) { }
            api.clearSession()
            runOnUiThread { renderLogin("Đã đăng xuất.") }
        }.start()
    }

    private fun startRealtime(session: AppSession) {
        realtimeClient?.stop()
        realtimeClient = AndroidRealtimeClient(
            context = applicationContext,
            api = api,
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
            userId = session.userId,
        ) { scopes, completion ->
            runOnUiThread {
                if (api.session == null || isFinishing) {
                    completion(false)
                    return@runOnUiThread
                }
                if (session.role == "PICKER") {
                    val controller = pickerController
                    if (controller != null) controller.onRealtime(scopes, completion) else completion(true)
                } else {
                    val controller = reporterController
                    if (controller != null) controller.onRealtime(scopes, completion) else completion(true)
                }
            }
        }.also { it.start() }
    }

    private fun friendlyError(error: Exception): String {
        if (error is ApiException) {
            return when (error.code) {
                "ALREADY_REPORTED" -> "SKU này đang có báo chưa xử lý của bạn."
                "SKU_NOT_FOUND" -> "SKU không tồn tại trong Master SKU."
                "WITHDRAW_WINDOW_EXPIRED" -> "Đã hết 60 giây cho phép thu hồi."
                "TICKET_NOT_OPEN" -> "Báo này đã được xử lý hoặc thu hồi."
                "BATCH_NOT_PENDING" -> "Đợt này đã được người khác xử lý."
                "CORRECTION_WINDOW_EXPIRED" -> "Đã hết 5 phút cho phép sửa Skip."
                "BATCH_NOT_CORRECTABLE" -> "Đợt này không còn ở trạng thái cho phép sửa."
                "RESULT_ACK_NOT_FOUND" -> "Kết quả cần xác nhận không còn hợp lệ cho tài khoản này."
                "USER_NOT_ACTIVE" -> "Tài khoản đã dừng hoạt động."
                "FORBIDDEN" -> "Tài khoản không có quyền thực hiện thao tác này."
                "AUTH_REQUIRED", "INVALID_AUTH_TOKEN", "SESSION_REFRESH_FAILED" -> "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
                else -> error.message
            }
        }
        return error.message ?: "Có lỗi không xác định."
    }

    private fun setStatus(message: String) {
        if (!::status.isInitialized) return
        statusHideTask?.let { uiHandler.removeCallbacks(it) }
        status.text = message
        status.visibility = View.VISIBLE
        recordLog(message)
        val normalized = message.lowercase()
        val isError = listOf("lỗi", "không thể", "không hợp lệ", "thất bại", "hết hạn", "chưa xác minh").any { normalized.contains(it) }
        val isWorking = !isError && listOf("đang ", "cần ", "chờ ").any { normalized.contains(it) }
        val fill = when { isError -> kit.redSoft; isWorking -> kit.orangeSoft; else -> kit.greenSoft }
        val stroke = when { isError -> Color.parseColor("#E9A2AA"); isWorking -> Color.parseColor("#EBC56E"); else -> kit.line }
        val textColor = when { isError -> kit.red; isWorking -> kit.orange; else -> kit.greenDark }
        status.setTextColor(textColor)
        status.background = kit.rounded(fill, stroke, 9)
        if (!isError && !isWorking && api.session != null) {
            val task = Runnable { status.visibility = View.GONE }
            statusHideTask = task
            uiHandler.postDelayed(task, 2600)
        }
    }

    private data class UpdateInfo(
        val versionCode: Int,
        val tag: String,
        val apkUrl: String,
        val checksumUrl: String,
    )

    private fun updateGateMessage(): String = when (updateGate) {
        UpdateGate.CHECKING -> "Đang kiểm tra phiên bản..."
        UpdateGate.CURRENT -> "Sẵn sàng đăng nhập."
        UpdateGate.REQUIRED -> "Có bản cập nhật mới. Cần cập nhật trước khi đăng nhập."
        UpdateGate.FAILED -> "Chưa xác minh được bản cập nhật. Không thể đăng nhập."
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
                verifyInstalledSignerTrusted()
                val info = fetchLatestUpdate()
                if (info.versionCode == BuildConfig.VERSION_CODE) {
                    updateGate = UpdateGate.CURRENT
                    runOnUiThread {
                        updateCheckRunning = false
                        applyUpdateGateUi(if (api.session == null) "Sẵn sàng đăng nhập." else if (!silent) "Đang dùng bản mới nhất." else null)
                    }
                    return@Thread
                }
                if (info.versionCode < BuildConfig.VERSION_CODE) {
                    throw IllegalStateException("Phiên bản cài đặt không khớp release Beta hiện hành.")
                }
                updateGate = UpdateGate.REQUIRED
                runOnUiThread { applyUpdateGateUi("Có bản cập nhật ${info.tag}. Đang tải và kiểm tra SHA-256...") }
                val apk = downloadAndVerify(info)
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi("Đã tải ${info.tag}. Cần cài đặt trước khi đăng nhập.")
                    requestInstall(apk)
                }
            } catch (_: Exception) {
                updateGate = UpdateGate.FAILED
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi("Chưa xác minh được bản cập nhật. Không thể đăng nhập. Kiểm tra mạng và thử lại.")
                }
            }
        }.start()
    }

    private fun fetchLatestUpdate(): UpdateInfo {
        val connection = openTrustedConnection(BuildConfig.UPDATE_RELEASE_API, UpdateResource.RELEASE_API, null)
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

    private fun downloadAndVerify(info: UpdateInfo): File {
        val expected = downloadText(info.checksumUrl, info.tag).trim().split(Regex("\\s+"))[0].lowercase()
        if (!expected.matches(Regex("[0-9a-f]{64}"))) throw IllegalStateException("Checksum không hợp lệ.")
        val dir = File(getExternalFilesDir(null), "updates").apply { mkdirs() }
        val temp = File(dir, "supra-inventory-beta.apk.download")
        val target = File(dir, "supra-inventory-beta.apk")
        downloadFile(info.apkUrl, temp, info.tag)
        if (sha256(temp) != expected) {
            temp.delete()
            throw IllegalStateException("SHA-256 APK không khớp.")
        }
        verifyDownloadedApk(temp, info)
        if (target.exists() && !target.delete()) {
            temp.delete()
            throw IllegalStateException("Không thể thay file cập nhật cũ.")
        }
        if (!temp.renameTo(target)) {
            temp.copyTo(target, overwrite = true)
            temp.delete()
        }
        return target
    }

    private fun requestInstall(apk: File) {
        if (!packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = apk
            setStatus("Cần cấp quyền cài ứng dụng không rõ nguồn gốc một lần cho SUPRA Inventory Beta.")
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            return
        }
        launchInstaller(apk)
    }

    private fun launchInstaller(apk: File) {
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        setStatus("Đã tải xong. Đang mở trình cài bản cập nhật...")
        startActivity(intent)
    }

    private enum class UpdateResource { RELEASE_API, ASSET }

    private fun openTrustedConnection(url: String, resource: UpdateResource, tag: String?): HttpURLConnection {
        var current = URL(url)
        repeat(6) { redirectIndex ->
            validateUpdateUrl(current, resource, tag, redirectIndex > 0)
            val connection = (current.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 60_000
                instanceFollowRedirects = false
                setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
                setRequestProperty("Accept", if (resource == UpdateResource.RELEASE_API) "application/vnd.github+json" else "*/*")
            }
            val code = connection.responseCode
            if (code in setOf(301, 302, 303, 307, 308)) {
                val location = connection.getHeaderField("Location")
                    ?: throw IllegalStateException("Update redirect thiếu Location.")
                connection.disconnect()
                current = URL(current, location)
                return@repeat
            }
            return connection
        }
        throw IllegalStateException("Update redirect vượt giới hạn.")
    }

    private fun validateUpdateUrl(url: URL, resource: UpdateResource, tag: String?, redirected: Boolean) {
        if (url.protocol != "https") throw IllegalStateException("Update chỉ cho phép HTTPS.")
        when (resource) {
            UpdateResource.RELEASE_API -> {
                if (
                    redirected ||
                    url.host != "api.github.com" ||
                    url.path != "/repos/tamnv2/supra-inventory/releases/latest"
                ) throw IllegalStateException("Update API không thuộc nguồn tin cậy.")
            }
            UpdateResource.ASSET -> {
                if (!redirected) {
                    val safeTag = tag?.takeIf { it.matches(Regex("^beta-vc\\d+$")) }
                        ?: throw IllegalStateException("Beta tag không hợp lệ.")
                    val prefix = "/tamnv2/supra-inventory/releases/download/$safeTag/"
                    if (url.host != "github.com" || !url.path.startsWith(prefix)) {
                        throw IllegalStateException("Release asset không thuộc repo Beta tin cậy.")
                    }
                } else {
                    val trustedCdn = url.host == "release-assets.githubusercontent.com" ||
                        url.host == "objects.githubusercontent.com" ||
                        url.host.endsWith(".githubusercontent.com")
                    if (!trustedCdn) throw IllegalStateException("Redirect cập nhật không thuộc CDN GitHub tin cậy.")
                }
            }
        }
    }

    private fun downloadText(url: String, tag: String): String {
        val connection = openTrustedConnection(url, UpdateResource.ASSET, tag)
        if (connection.responseCode !in 200..299) throw IllegalStateException("Checksum HTTP ${connection.responseCode}")
        return connection.inputStream.bufferedReader().use { it.readText() }
    }

    private fun downloadFile(url: String, file: File, tag: String) {
        val connection = openTrustedConnection(url, UpdateResource.ASSET, tag)
        if (connection.responseCode !in 200..299) throw IllegalStateException("APK HTTP ${connection.responseCode}")
        connection.inputStream.use { input ->
            file.outputStream().use { output -> input.copyTo(output, 64 * 1024) }
        }
    }

    private fun verifyInstalledSignerTrusted() {
        val expected = BuildConfig.TRUSTED_SIGNER_SHA256.trim().lowercase()
        if (expected.isBlank()) {
            if (BuildConfig.DEBUG) return
            throw IllegalStateException("Release thiếu trusted signer fingerprint.")
        }
        val installed = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        if (expected !in signerDigests(installed)) {
            throw IllegalStateException("Chữ ký ứng dụng hiện tại không hợp lệ.")
        }
    }

    private fun verifyDownloadedApk(file: File, info: UpdateInfo) {
        val archive = packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
            ?: throw IllegalStateException("Không đọc được thông tin APK cập nhật.")
        if (archive.packageName != BuildConfig.APPLICATION_ID) {
            throw IllegalStateException("APK cập nhật sai package.")
        }
        if (archive.longVersionCode != info.versionCode.toLong()) {
            throw IllegalStateException("APK cập nhật sai versionCode.")
        }
        val expectedName = "0.2.0-beta.${info.versionCode}"
        if (archive.versionName != expectedName || info.tag != "beta-vc${info.versionCode}") {
            throw IllegalStateException("APK cập nhật sai kênh/phiên bản Beta.")
        }

        val expectedSigner = BuildConfig.TRUSTED_SIGNER_SHA256.trim().lowercase()
        val archiveSigners = signerDigests(archive)
        if (expectedSigner.isBlank() || expectedSigner !in archiveSigners) {
            throw IllegalStateException("APK cập nhật sai chữ ký.")
        }
    }

    private fun signerDigests(info: PackageInfo): Set<String> {
        val signing = info.signingInfo ?: return emptySet()
        val certificates = if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        return certificates.map { certificate ->
            MessageDigest.getInstance("SHA-256")
                .digest(certificate.toByteArray())
                .joinToString("") { "%02x".format(it) }
        }.toSet()
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun renderFatal(message: String) {
        val root = kit.page()
        addBrandHeader(root, subtitle = "Báo hàng · Beta")
        val card = kit.card(kit.redSoft, Color.parseColor("#E9A2AA"))
        card.addView(TextView(this).apply {
            text = "Không thể khởi động ứng dụng"
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.red)
        })
        card.addView(TextView(this).apply {
            text = message
            textSize = 12.5f
            setTextColor(kit.red)
            setPadding(0, kit.dp(6), 0, 0)
        })
        root.addView(card)
        kit.addFooter(root)
        setContentView(kit.wrapScroll(root))
    }
}
}1=[REDACTED]")
        next = next.replace(Regex("eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}"), "[REDACTED_JWT]")
        return next
    }

    private fun recordLog(message: String) {
        if (localLog.size >= 80) localLog.removeFirst()
        localLog.addLast("${logTime.format(Instant.now())} · $message")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            StockMessagingService.CHANNEL_ID,
            "SUPRA Inventory · Nghiệp vụ",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = "Cảnh báo báo hàng khi ứng dụng chạy nền" }
        manager.createNotificationChannel(channel)
    }

    private fun registerBackgroundNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 701)
        }
        NotificationSignalStore.latestToken(applicationContext)?.let(::registerNotificationToken)
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val token = if (task.isSuccessful) task.result else null
            if (token.isNullOrBlank()) return@addOnCompleteListener
            NotificationSignalStore.saveToken(applicationContext, token)
            registerNotificationToken(token)
        }
    }

    private fun registerNotificationToken(token: String) {
        if (token.isBlank() || api.session == null) return
        Thread {
            try { api.registerNotificationDevice(notificationDeviceId, token) } catch (_: Exception) { }
        }.start()
    }

    private fun drainNotificationReceipts() {
        if (api.session?.role != "PICKER") return
        val events = NotificationSignalStore.pendingResultEvents(applicationContext)
        if (events.isEmpty()) return
        Thread {
            for (eventId in events) {
                try {
                    api.markResultStage(eventId, "RECEIVED")
                    NotificationSignalStore.clearResultEvent(applicationContext, eventId)
                } catch (_: Exception) {
                    // Keep the event for a later authenticated retry.
                }
            }
        }.start()
    }

    private fun logoutWithNotificationCleanup() {
        stopOperationalClients()
        Thread {
            try { api.unregisterNotificationDevice(notificationDeviceId) } catch (_: Exception) { }
            api.clearSession()
            runOnUiThread { renderLogin("Đã đăng xuất.") }
        }.start()
    }

    private fun startRealtime(session: AppSession) {
        realtimeClient?.stop()
        realtimeClient = AndroidRealtimeClient(
            context = applicationContext,
            api = api,
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
            userId = session.userId,
        ) { scopes, completion ->
            runOnUiThread {
                if (api.session == null || isFinishing) {
                    completion(false)
                    return@runOnUiThread
                }
                if (session.role == "PICKER") {
                    val controller = pickerController
                    if (controller != null) controller.onRealtime(scopes, completion) else completion(true)
                } else {
                    val controller = reporterController
                    if (controller != null) controller.onRealtime(scopes, completion) else completion(true)
                }
            }
        }.also { it.start() }
    }

    private fun friendlyError(error: Exception): String {
        if (error is ApiException) {
            return when (error.code) {
                "ALREADY_REPORTED" -> "SKU này đang có báo chưa xử lý của bạn."
                "SKU_NOT_FOUND" -> "SKU không tồn tại trong Master SKU."
                "WITHDRAW_WINDOW_EXPIRED" -> "Đã hết 60 giây cho phép thu hồi."
                "TICKET_NOT_OPEN" -> "Báo này đã được xử lý hoặc thu hồi."
                "BATCH_NOT_PENDING" -> "Đợt này đã được người khác xử lý."
                "CORRECTION_WINDOW_EXPIRED" -> "Đã hết 5 phút cho phép sửa Skip."
                "BATCH_NOT_CORRECTABLE" -> "Đợt này không còn ở trạng thái cho phép sửa."
                "RESULT_ACK_NOT_FOUND" -> "Kết quả cần xác nhận không còn hợp lệ cho tài khoản này."
                "USER_NOT_ACTIVE" -> "Tài khoản đã dừng hoạt động."
                "FORBIDDEN" -> "Tài khoản không có quyền thực hiện thao tác này."
                "AUTH_REQUIRED", "INVALID_AUTH_TOKEN", "SESSION_REFRESH_FAILED" -> "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
                else -> error.message
            }
        }
        return error.message ?: "Có lỗi không xác định."
    }

    private fun setStatus(message: String) {
        if (!::status.isInitialized) return
        statusHideTask?.let { uiHandler.removeCallbacks(it) }
        status.text = message
        status.visibility = View.VISIBLE
        recordLog(message)
        val normalized = message.lowercase()
        val isError = listOf("lỗi", "không thể", "không hợp lệ", "thất bại", "hết hạn", "chưa xác minh").any { normalized.contains(it) }
        val isWorking = !isError && listOf("đang ", "cần ", "chờ ").any { normalized.contains(it) }
        val fill = when { isError -> kit.redSoft; isWorking -> kit.orangeSoft; else -> kit.greenSoft }
        val stroke = when { isError -> Color.parseColor("#E9A2AA"); isWorking -> Color.parseColor("#EBC56E"); else -> kit.line }
        val textColor = when { isError -> kit.red; isWorking -> kit.orange; else -> kit.greenDark }
        status.setTextColor(textColor)
        status.background = kit.rounded(fill, stroke, 9)
        if (!isError && !isWorking && api.session != null) {
            val task = Runnable { status.visibility = View.GONE }
            statusHideTask = task
            uiHandler.postDelayed(task, 2600)
        }
    }

    private data class UpdateInfo(
        val versionCode: Int,
        val tag: String,
        val apkUrl: String,
        val checksumUrl: String,
    )

    private fun updateGateMessage(): String = when (updateGate) {
        UpdateGate.CHECKING -> "Đang kiểm tra phiên bản..."
        UpdateGate.CURRENT -> "Sẵn sàng đăng nhập."
        UpdateGate.REQUIRED -> "Có bản cập nhật mới. Cần cập nhật trước khi đăng nhập."
        UpdateGate.FAILED -> "Chưa xác minh được bản cập nhật. Không thể đăng nhập."
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
                verifyInstalledSignerTrusted()
                val info = fetchLatestUpdate()
                if (info.versionCode == BuildConfig.VERSION_CODE) {
                    updateGate = UpdateGate.CURRENT
                    runOnUiThread {
                        updateCheckRunning = false
                        applyUpdateGateUi(if (api.session == null) "Sẵn sàng đăng nhập." else if (!silent) "Đang dùng bản mới nhất." else null)
                    }
                    return@Thread
                }
                if (info.versionCode < BuildConfig.VERSION_CODE) {
                    throw IllegalStateException("Phiên bản cài đặt không khớp release Beta hiện hành.")
                }
                updateGate = UpdateGate.REQUIRED
                runOnUiThread { applyUpdateGateUi("Có bản cập nhật ${info.tag}. Đang tải và kiểm tra SHA-256...") }
                val apk = downloadAndVerify(info)
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi("Đã tải ${info.tag}. Cần cài đặt trước khi đăng nhập.")
                    requestInstall(apk)
                }
            } catch (_: Exception) {
                updateGate = UpdateGate.FAILED
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi("Chưa xác minh được bản cập nhật. Không thể đăng nhập. Kiểm tra mạng và thử lại.")
                }
            }
        }.start()
    }

    private fun fetchLatestUpdate(): UpdateInfo {
        val connection = openTrustedConnection(BuildConfig.UPDATE_RELEASE_API, UpdateResource.RELEASE_API, null)
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

    private fun downloadAndVerify(info: UpdateInfo): File {
        val expected = downloadText(info.checksumUrl, info.tag).trim().split(Regex("\\s+"))[0].lowercase()
        if (!expected.matches(Regex("[0-9a-f]{64}"))) throw IllegalStateException("Checksum không hợp lệ.")
        val dir = File(getExternalFilesDir(null), "updates").apply { mkdirs() }
        val temp = File(dir, "supra-inventory-beta.apk.download")
        val target = File(dir, "supra-inventory-beta.apk")
        downloadFile(info.apkUrl, temp, info.tag)
        if (sha256(temp) != expected) {
            temp.delete()
            throw IllegalStateException("SHA-256 APK không khớp.")
        }
        verifyDownloadedApk(temp, info)
        if (target.exists() && !target.delete()) {
            temp.delete()
            throw IllegalStateException("Không thể thay file cập nhật cũ.")
        }
        if (!temp.renameTo(target)) {
            temp.copyTo(target, overwrite = true)
            temp.delete()
        }
        return target
    }

    private fun requestInstall(apk: File) {
        if (!packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = apk
            setStatus("Cần cấp quyền cài ứng dụng không rõ nguồn gốc một lần cho SUPRA Inventory Beta.")
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            return
        }
        launchInstaller(apk)
    }

    private fun launchInstaller(apk: File) {
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        setStatus("Đã tải xong. Đang mở trình cài bản cập nhật...")
        startActivity(intent)
    }

    private enum class UpdateResource { RELEASE_API, ASSET }

    private fun openTrustedConnection(url: String, resource: UpdateResource, tag: String?): HttpURLConnection {
        var current = URL(url)
        repeat(6) { redirectIndex ->
            validateUpdateUrl(current, resource, tag, redirectIndex > 0)
            val connection = (current.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 60_000
                instanceFollowRedirects = false
                setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
                setRequestProperty("Accept", if (resource == UpdateResource.RELEASE_API) "application/vnd.github+json" else "*/*")
            }
            val code = connection.responseCode
            if (code in setOf(301, 302, 303, 307, 308)) {
                val location = connection.getHeaderField("Location")
                    ?: throw IllegalStateException("Update redirect thiếu Location.")
                connection.disconnect()
                current = URL(current, location)
                return@repeat
            }
            return connection
        }
        throw IllegalStateException("Update redirect vượt giới hạn.")
    }

    private fun validateUpdateUrl(url: URL, resource: UpdateResource, tag: String?, redirected: Boolean) {
        if (url.protocol != "https") throw IllegalStateException("Update chỉ cho phép HTTPS.")
        when (resource) {
            UpdateResource.RELEASE_API -> {
                if (
                    redirected ||
                    url.host != "api.github.com" ||
                    url.path != "/repos/tamnv2/supra-inventory/releases/latest"
                ) throw IllegalStateException("Update API không thuộc nguồn tin cậy.")
            }
            UpdateResource.ASSET -> {
                if (!redirected) {
                    val safeTag = tag?.takeIf { it.matches(Regex("^beta-vc\\d+$")) }
                        ?: throw IllegalStateException("Beta tag không hợp lệ.")
                    val prefix = "/tamnv2/supra-inventory/releases/download/$safeTag/"
                    if (url.host != "github.com" || !url.path.startsWith(prefix)) {
                        throw IllegalStateException("Release asset không thuộc repo Beta tin cậy.")
                    }
                } else {
                    val trustedCdn = url.host == "release-assets.githubusercontent.com" ||
                        url.host == "objects.githubusercontent.com" ||
                        url.host.endsWith(".githubusercontent.com")
                    if (!trustedCdn) throw IllegalStateException("Redirect cập nhật không thuộc CDN GitHub tin cậy.")
                }
            }
        }
    }

    private fun downloadText(url: String, tag: String): String {
        val connection = openTrustedConnection(url, UpdateResource.ASSET, tag)
        if (connection.responseCode !in 200..299) throw IllegalStateException("Checksum HTTP ${connection.responseCode}")
        return connection.inputStream.bufferedReader().use { it.readText() }
    }

    private fun downloadFile(url: String, file: File, tag: String) {
        val connection = openTrustedConnection(url, UpdateResource.ASSET, tag)
        if (connection.responseCode !in 200..299) throw IllegalStateException("APK HTTP ${connection.responseCode}")
        connection.inputStream.use { input ->
            file.outputStream().use { output -> input.copyTo(output, 64 * 1024) }
        }
    }

    private fun verifyInstalledSignerTrusted() {
        val expected = BuildConfig.TRUSTED_SIGNER_SHA256.trim().lowercase()
        if (expected.isBlank()) {
            if (BuildConfig.DEBUG) return
            throw IllegalStateException("Release thiếu trusted signer fingerprint.")
        }
        val installed = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        if (expected !in signerDigests(installed)) {
            throw IllegalStateException("Chữ ký ứng dụng hiện tại không hợp lệ.")
        }
    }

    private fun verifyDownloadedApk(file: File, info: UpdateInfo) {
        val archive = packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
            ?: throw IllegalStateException("Không đọc được thông tin APK cập nhật.")
        if (archive.packageName != BuildConfig.APPLICATION_ID) {
            throw IllegalStateException("APK cập nhật sai package.")
        }
        if (archive.longVersionCode != info.versionCode.toLong()) {
            throw IllegalStateException("APK cập nhật sai versionCode.")
        }
        val expectedName = "0.2.0-beta.${info.versionCode}"
        if (archive.versionName != expectedName || info.tag != "beta-vc${info.versionCode}") {
            throw IllegalStateException("APK cập nhật sai kênh/phiên bản Beta.")
        }

        val expectedSigner = BuildConfig.TRUSTED_SIGNER_SHA256.trim().lowercase()
        val archiveSigners = signerDigests(archive)
        if (expectedSigner.isBlank() || expectedSigner !in archiveSigners) {
            throw IllegalStateException("APK cập nhật sai chữ ký.")
        }
    }

    private fun signerDigests(info: PackageInfo): Set<String> {
        val signing = info.signingInfo ?: return emptySet()
        val certificates = if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        return certificates.map { certificate ->
            MessageDigest.getInstance("SHA-256")
                .digest(certificate.toByteArray())
                .joinToString("") { "%02x".format(it) }
        }.toSet()
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun renderFatal(message: String) {
        val root = kit.page()
        addBrandHeader(root, subtitle = "Báo hàng · Beta")
        val card = kit.card(kit.redSoft, Color.parseColor("#E9A2AA"))
        card.addView(TextView(this).apply {
            text = "Không thể khởi động ứng dụng"
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.red)
        })
        card.addView(TextView(this).apply {
            text = message
            textSize = 12.5f
            setTextColor(kit.red)
            setPadding(0, kit.dp(6), 0, 0)
        })
        root.addView(card)
        kit.addFooter(root)
        setContentView(kit.wrapScroll(root))
    }
}
