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
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
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

    private data class OperationalPage(
        val shell: LinearLayout,
        val content: LinearLayout,
    )

    private val uiHandler = Handler(Looper.getMainLooper())
    private val logTime = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.of("Asia/Ho_Chi_Minh"))
    private val localLog = ArrayDeque<String>()
    private lateinit var api: InventoryApi
    private lateinit var skuCache: SkuCatalogCache
    private lateinit var kit: InventoryUi
    private lateinit var status: TextView
    private lateinit var updateButton: Button
    private var loginButton: Button? = null
    private var loginProgress: ProgressBar? = null
    private var pickerController: PickerController? = null
    private var reporterController: ReporterController? = null
    private var adminLauncherController: AdminLauncherController? = null
    private var realtimeClient: AndroidRealtimeClient? = null
    private var contentContainer: FrameLayout? = null
    private var activeSession: AppSession? = null
    private var statusHideTask: Runnable? = null
    private var pendingInstallFile: File? = null
    @Volatile private var updateGate = UpdateGate.CHECKING
    @Volatile private var updateCheckRunning = false
    @Volatile private var roleSyncRunning = false
    @Volatile private var lastImmediateRuntimeLogAt = 0L
    private var previousUncaughtHandler: Thread.UncaughtExceptionHandler? = null
    private val runtimeLogTick = object : Runnable {
        override fun run() {
            maybeUploadScheduledRuntimeLog()
            uiHandler.postDelayed(this, 60_000L)
        }
    }

    private val notificationDeviceId: String by lazy {
        val prefs = getSharedPreferences("notification_device", MODE_PRIVATE)
        prefs.getString("device_id", null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString("device_id", it).apply()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        kit = InventoryUi(this)
        cleanupUpdateArtifacts()
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
            onSessionChanged = ::persistInteractiveSession,
        )
        restoreInteractiveSession()?.let(api::restoreSession)
        skuCache = SkuCatalogCache(this)
        installCrashRuntimeLogHandler()
        renderLogin(if (api.session == null) "Đang kiểm tra phiên bản..." else "Đang khôi phục phiên đăng nhập...")
    }

    override fun onDestroy() {
        statusHideTask?.let { uiHandler.removeCallbacks(it) }
        uiHandler.removeCallbacks(runtimeLogTick)
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
        if (::api.isInitialized && api.session != null) {
            reconcileNotificationSignal()
            syncEffectiveRole()
        }
    }

    private fun syncEffectiveRole() {
        if (roleSyncRunning || api.session == null) return
        roleSyncRunning = true
        val before = activeSession
        Thread {
            try {
                val next = api.refreshProfile()
                runOnUiThread {
                    roleSyncRunning = false
                    val roleChanged = before?.role != next.role
                    val identityChanged = before?.displayName != next.displayName || before?.employeeCode != next.employeeCode
                    if (roleChanged || identityChanged || activeSession == null) {
                        renderHome(next)
                    } else {
                        activeSession = next
                    }
                }
            } catch (error: Exception) {
                runOnUiThread {
                    roleSyncRunning = false
                    if (api.session == null) renderLogin("Phiên đăng nhập đã hết hạn.")
                }
            }
        }.start()
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

    private fun interactiveSessionPrefs() = getSharedPreferences("interactive_session_v2", MODE_PRIVATE)

    private fun persistInteractiveSession(value: AppSession?) {
        val prefs = interactiveSessionPrefs()
        if (value == null) {
            prefs.edit().remove("session").apply()
            return
        }
        val payload = JSONObject()
            .put("id_token", value.idToken)
            .put("refresh_token", value.refreshToken)
            .put("user_id", value.userId)
            .put("display_name", value.displayName)
            .put("role", value.role)
            .put("employee_code", value.employeeCode ?: JSONObject.NULL)
        prefs.edit().putString("session", payload.toString()).apply()
    }

    private fun restoreInteractiveSession(): AppSession? {
        val raw = interactiveSessionPrefs().getString("session", null) ?: return null
        return try {
            val payload = JSONObject(raw)
            val next = AppSession(
                idToken = payload.optString("id_token"),
                refreshToken = payload.optString("refresh_token"),
                userId = payload.optString("user_id"),
                displayName = payload.optString("display_name"),
                role = payload.optString("role"),
                employeeCode = payload.optString("employee_code").takeIf { it.isNotBlank() && it != "null" },
            )
            if (next.idToken.isBlank() || next.refreshToken.isBlank() || next.userId.isBlank()) null else next
        } catch (_: Exception) {
            interactiveSessionPrefs().edit().remove("session").apply()
            null
        }
    }

    private fun renderLogin(message: String = "Đang kiểm tra phiên bản...") {
        uiHandler.removeCallbacks(runtimeLogTick)
        stopOperationalClients()
        activeSession = null
        contentContainer = null
        setContentView(R.layout.activity_login)
        applySystemBarInsets()

        val username = findViewById<EditText>(R.id.etEmployeeCode)
        val password = findViewById<EditText>(R.id.etPassword)
        val passwordVisibility = findViewById<ImageButton>(R.id.btnPasswordVisibility)
        var passwordVisible = false
        passwordVisibility.setOnClickListener {
            passwordVisible = !passwordVisible
            password.transformationMethod = if (passwordVisible) null else PasswordTransformationMethod.getInstance()
            password.setSelection(password.text?.length ?: 0)
            passwordVisibility.contentDescription = if (passwordVisible) "Ẩn mật khẩu" else "Hiện mật khẩu"
        }
        val login = findViewById<Button>(R.id.btnLogin)
        val progress = findViewById<ProgressBar>(R.id.progressLogin)
        loginProgress = progress
        status = findViewById(R.id.tvLoginError)
        updateButton = Button(this)
        loginButton = login

        status.visibility = View.GONE
        progress.visibility = View.VISIBLE
        login.isEnabled = false
        applyUpdateGateUi(message)
        checkForUpdate(silent = true)

        val submitLoginFromKeyboard = TextView.OnEditorActionListener { _, _, event ->
            val isEnter = event?.keyCode == android.view.KeyEvent.KEYCODE_ENTER
            if (!isEnter && event != null) return@OnEditorActionListener false
            if (login.isEnabled) login.performClick()
            true
        }
        username.setOnEditorActionListener(submitLoginFromKeyboard)
        password.setOnEditorActionListener(submitLoginFromKeyboard)

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
            fun attemptLogin(force: Boolean) {
                login.isEnabled = false
                progress.visibility = View.VISIBLE
                status.visibility = View.GONE
                Thread {
                    try {
                        val session = api.login(user, pass, "android:$notificationDeviceId", force)
                        runOnUiThread {
                            progress.visibility = View.GONE
                            password.setText("")
                            renderHome(session)
                        }
                    } catch (e: Exception) {
                        if (e is ApiException && e.code == "SESSION_ACTIVE_OTHER_DEVICE" && !force) {
                            runOnUiThread {
                                progress.visibility = View.GONE
                                login.isEnabled = updateGate == UpdateGate.CURRENT
                                AlertDialog.Builder(this@MainActivity)
                                    .setTitle("Tài khoản đang dùng trên App/PDA khác")
                                    .setMessage(e.message + "\n\nTiếp tục sẽ đăng xuất phiên App/PDA cũ. Web và Agent không bị ảnh hưởng.")
                                    .setNegativeButton("Huỷ", null)
                                    .setPositiveButton("Tiếp tục") { _, _ -> attemptLogin(true) }
                                    .show()
                            }
                        } else {
                            runOnUiThread {
                                progress.visibility = View.GONE
                                login.isEnabled = updateGate == UpdateGate.CURRENT
                                setStatus(friendlyError(e))
                            }
                        }
                    }
                }.start()
            }
            attemptLogin(false)
        }
    }

    private fun renderHome(session: AppSession) {
        loginButton = null
        pickerController?.destroy()
        pickerController = null
        reporterController?.destroy()
        reporterController = null
        adminLauncherController = null
        activeSession = session

        setContentView(R.layout.activity_main)
        applySystemBarInsets()
        contentContainer = findViewById(R.id.contentContainer)
        status = TextView(this)
        findViewById<TextView>(R.id.tvHeaderTitle).text = "1291 Beta"
        findViewById<TextView>(R.id.tvHeaderUser).text =
            "${session.employeeCode ?: session.userId} · ${session.displayName}"
        findViewById<TextView>(R.id.tvAppVersion).apply {
            text = "Beta vc${BuildConfig.VERSION_CODE}"
            setOnClickListener { checkForUpdate(silent = false) }
        }
        findViewById<TextView>(R.id.btnLog).setOnClickListener { showSupportDiagnostics() }
        findViewById<TextView>(R.id.btnLogout).setOnClickListener { confirmLogout() }
        configureOperationalDisplayControls(session)
        findViewById<TextView>(R.id.btnBack).setOnClickListener { }

        when (session.role) {
            "PICKER" -> renderPickerHome(session)
            "REPORTER" -> renderReporterHome(session, showLauncherBack = false, initialFilter = "PENDING")
            "ADMIN", "ROOT" -> {
                api.clearSession()
                renderLogin("Admin/Root hiện chỉ sử dụng Web. App/PDA chỉ hỗ trợ Picker và Reporter.")
                return
            }
            else -> {
                contentContainer?.removeAllViews()
                contentContainer?.addView(TextView(this).apply {
                    text = "Vai trò ${session.role} chưa được hỗ trợ trên PDA."
                    textSize = 14f
                    setPadding(24, 24, 24, 24)
                })
            }
        }
        startRealtime(session)
        registerBackgroundNotifications()
        drainNotificationReceipts()
        recordLog("Đăng nhập ${kit.roleLabel(session.role)}: ${session.employeeCode ?: session.displayName}")
        flushPendingCrashRuntimeLog()
        uiHandler.removeCallbacks(runtimeLogTick)
        uiHandler.post(runtimeLogTick)
    }

    private fun showBack(show: Boolean) {
        findViewById<TextView>(R.id.btnBack)?.visibility = if (show) View.VISIBLE else View.GONE
    }

    private fun replaceContent(layoutId: Int): View {
        val host = contentContainer ?: error("Legacy content container not ready")
        host.removeAllViews()
        val view = layoutInflater.inflate(layoutId, host, false)
        host.addView(view)
        return view
    }

    private fun pickerDisplayScale(session: AppSession): Float =
        getSharedPreferences("picker_display_scale_v1", MODE_PRIVATE)
            .getFloat("user:${session.userId}", 1.0f)
            .coerceIn(0.8f, 1.4f)

    private fun reporterDisplayScale(session: AppSession): Float =
        getSharedPreferences("reporter_display_scale_v1", MODE_PRIVATE)
            .getFloat("user:${session.userId}", 1.0f)
            .coerceIn(0.8f, 1.4f)

    private fun configureOperationalDisplayControls(session: AppSession) {
        val minus = findViewById<TextView>(R.id.btnTextMinus)
        val plus = findViewById<TextView>(R.id.btnTextPlus)
        val scalable = session.role == "PICKER" || session.role == "REPORTER"
        minus.visibility = if (scalable) View.VISIBLE else View.GONE
        plus.visibility = if (scalable) View.VISIBLE else View.GONE
        if (!scalable) return

        fun applyDelta(delta: Float) {
            val picker = session.role == "PICKER"
            val prefs = getSharedPreferences(if (picker) "picker_display_scale_v1" else "reporter_display_scale_v1", MODE_PRIVATE)
            val current = if (picker) pickerDisplayScale(session) else reporterDisplayScale(session)
            val next = (current + delta).coerceIn(0.8f, 1.4f)
            if (next == current) return
            prefs.edit().putFloat("user:${session.userId}", next).apply()
            if (picker) {
                renderPickerHome(session)
            } else {
                val currentFilter = reporterController?.currentFilterName() ?: "PENDING"
                renderReporterHome(session, showLauncherBack = false, initialFilter = currentFilter)
            }
            val percent = (next * 100).toInt()
            Toast.makeText(this, "Cỡ hiển thị ${kit.roleLabel(session.role)}: $percent%", Toast.LENGTH_SHORT).show()
        }

        minus.setOnClickListener { applyDelta(-0.1f) }
        plus.setOnClickListener { applyDelta(0.1f) }
        minus.contentDescription = "Thu nhỏ cỡ hiển thị"
        plus.contentDescription = "Phóng to cỡ hiển thị"
    }

    private fun renderPickerHome(session: AppSession) {
        showBack(false)
        val view = replaceContent(R.layout.view_picker) as LinearLayout
        pickerController?.destroy()
        pickerController = PickerController(
            this,
            api,
            skuCache,
            kit,
            ::setStatus,
            ::friendlyError,
            ::recordLog,
            pickerDisplayScale(session),
        ).also { it.render(view) }
    }

    private fun renderReporterHome(session: AppSession, showLauncherBack: Boolean, initialFilter: String = "PENDING") {
        showBack(showLauncherBack)
        pickerController?.destroy()
        pickerController = null
        reporterController?.destroy()
        val view = replaceContent(R.layout.view_invent) as LinearLayout
        reporterController = ReporterController(this, api, kit, ::setStatus, ::friendlyError, initialFilter, reporterDisplayScale(session))
            .also { it.render(view) }
    }

    private fun renderAdminResults(session: AppSession) {
        renderReporterHome(session, showLauncherBack = true, initialFilter = "HAS_STOCK")
    }

    private fun renderAdminLauncher(session: AppSession) {
        showBack(false)
        pickerController?.destroy()
        pickerController = null
        reporterController?.destroy()
        reporterController = null
        val view = replaceContent(R.layout.view_admin)
        val statusView = view.findViewById<TextView>(R.id.tvAdminStatus)
        statusView.text = "Sẵn sàng"
        view.findViewById<Button>(R.id.btnOpenInventQueue).setOnClickListener {
            renderReporterHome(session, showLauncherBack = true, initialFilter = "PENDING")
        }
        view.findViewById<Button>(R.id.btnImportSku).setOnClickListener { openLegacyWeb("#sku", "Danh mục SKU") }
        view.findViewById<Button>(R.id.btnImportUsers).setOnClickListener { openLegacyWeb("#users", "Nhân sự & tài khoản") }
        view.findViewById<Button>(R.id.btnDownloadUserTemplate).setOnClickListener { openLegacyWeb("#users", "Nhân sự & tài khoản") }
        view.findViewById<Button>(R.id.btnSyncSheet).setOnClickListener {
            statusView.text = "Sẵn sàng"
        }
        view.findViewById<Button>(R.id.btnSaveConfig).setOnClickListener {
            openLegacyWeb("#sla", "Thời gian nghiệp vụ")
        }
    }

    private fun openLegacyWeb(hash: String, label: String) {
        try {
            val base = BuildConfig.API_BASE_URL.trimEnd('/')
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("$base/$hash")))
            setStatus("Đã mở $label trên Web.")
        } catch (_: Exception) {
            setStatus("Không thể mở $label trên Web.")
        }
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
            .setNeutralButton("Gửi lên Drive") { _, _ ->
                sendAndroidRuntimeLog("INFO", "manual_android_log", JSONObject(payload))
                Toast.makeText(this, "Đang gửi log vào Beta / Logs.", Toast.LENGTH_SHORT).show()
            }
            .setPositiveButton("Chia sẻ") { _, _ ->
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, "1291 Beta support log")
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

        val runtime = Runtime.getRuntime()
        val root = JSONObject()
            .put("format", "supra-inventory-support-v2")
            .put("generated_at", Instant.now().toString())
            .put("app", JSONObject()
                .put("package", BuildConfig.APPLICATION_ID)
                .put("version_name", BuildConfig.VERSION_NAME)
                .put("version_code", BuildConfig.VERSION_CODE)
                .put("role", activeSession?.role)
                .put("user_id", activeSession?.userId))
            .put("device", JSONObject()
                .put("device_id", notificationDeviceId)
                .put("manufacturer", Build.MANUFACTURER.take(80))
                .put("model", Build.MODEL.take(80))
                .put("sdk_int", Build.VERSION.SDK_INT))
            .put("network", JSONObject()
                .put("validated_internet", hasValidatedInternet())
                .put("api_host", Uri.parse(BuildConfig.API_BASE_URL).host.orEmpty()))
            .put("memory", JSONObject()
                .put("used_bytes", runtime.totalMemory() - runtime.freeMemory())
                .put("free_bytes", runtime.freeMemory())
                .put("max_bytes", runtime.maxMemory()))
            .put("storage", JSONObject()
                .put("files_free_bytes", filesDir.usableSpace)
                .put("files_total_bytes", filesDir.totalSpace))
            .put("realtime", JSONObject(realtime))
            .put("catalog", JSONObject()
                .put("count", skuCache.count)
                .put("version", sanitizeDiagnosticText(skuCache.version).take(160)))
            .put("recent_events", JSONArray(localLog.toList().takeLast(80).map(::sanitizeDiagnosticText)))
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

    private fun runtimeLogPrefs() = getSharedPreferences("runtime_logs", MODE_PRIVATE)

    private fun currentRuntimeLogSlot(): String {
        val now = Instant.now().atZone(ZoneId.of("Asia/Ho_Chi_Minh"))
        val slot = when {
            now.hour >= 18 -> 18
            now.hour >= 12 -> 12
            now.hour >= 6 -> 6
            else -> 0
        }
        return "%04d%02d%02d-%02d".format(now.year, now.monthValue, now.dayOfMonth, slot)
    }

    private fun androidRuntimeLogDevice(): JSONObject = JSONObject()
        .put("device_id", notificationDeviceId)
        .put("manufacturer", Build.MANUFACTURER.take(80))
        .put("model", Build.MODEL.take(80))
        .put("sdk_int", Build.VERSION.SDK_INT)
        .put("package", BuildConfig.APPLICATION_ID)
        .put("version_code", BuildConfig.VERSION_CODE)
        .put("version_name", BuildConfig.VERSION_NAME)

    private fun uploadAndroidRuntimeLog(severity: String, reason: String, payload: JSONObject): Boolean {
        if (api.session == null || !hasValidatedInternet()) return false
        return try {
            api.uploadRuntimeLog(
                severity = severity,
                reason = sanitizeDiagnosticText(reason),
                generatedAt = Instant.now().toString(),
                device = androidRuntimeLogDevice(),
                payload = payload,
            )
            true
        } catch (error: Exception) {
            recordLog("Lỗi gửi log: ${sanitizeDiagnosticText(error.message ?: "unknown")}")
            false
        }
    }

    private fun sendAndroidRuntimeLog(severity: String, reason: String, payload: JSONObject = JSONObject(buildSupportDiagnostics())) {
        Thread {
            val sent = uploadAndroidRuntimeLog(severity, reason, payload)
            if (sent) recordLog("Đã gửi log $severity · $reason")
        }.start()
    }

    private fun maybeUploadScheduledRuntimeLog() {
        if (api.session == null || !hasValidatedInternet()) return
        val slot = currentRuntimeLogSlot()
        val prefs = runtimeLogPrefs()
        if (prefs.getString("last_slot", "") == slot) return
        Thread {
            val sent = uploadAndroidRuntimeLog("INFO", "scheduled_$slot", JSONObject(buildSupportDiagnostics()))
            if (sent) prefs.edit().putString("last_slot", slot).apply()
        }.start()
    }

    private fun flushPendingCrashRuntimeLog() {
        val prefs = runtimeLogPrefs()
        val raw = prefs.getString("pending_crash", null) ?: return
        Thread {
            val payload = try { JSONObject(raw) } catch (_: Exception) { JSONObject().put("raw", sanitizeDiagnosticText(raw)) }
            if (uploadAndroidRuntimeLog("ERROR", "deferred_android_crash", payload)) {
                prefs.edit().remove("pending_crash").apply()
            }
        }.start()
    }

    private fun installCrashRuntimeLogHandler() {
        if (previousUncaughtHandler != null) return
        previousUncaughtHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val payload = JSONObject()
                .put("thread", sanitizeDiagnosticText(thread.name))
                .put("message", sanitizeDiagnosticText(throwable.message ?: throwable.javaClass.name))
                .put("stack", sanitizeDiagnosticText(throwable.stackTraceToString()).take(12_000))
                .put("support", try { JSONObject(buildSupportDiagnostics()) } catch (_: Exception) { JSONObject() })
            runtimeLogPrefs().edit().putString("pending_crash", payload.toString().take(30_000)).commit()
            if (::api.isInitialized && api.session != null && hasValidatedInternet()) {
                val sender = Thread { uploadAndroidRuntimeLog("ERROR", "android_crash", payload) }
                sender.start()
                try { sender.join(1_500L) } catch (_: InterruptedException) { }
            }
            previousUncaughtHandler?.uncaughtException(thread, throwable)
        }
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
        uiHandler.removeCallbacks(runtimeLogTick)
        stopOperationalClients()
        Thread {
            try { api.unregisterNotificationDevice(notificationDeviceId) } catch (_: Exception) { }
            try { api.logoutInteractive("android:$notificationDeviceId") } catch (_: Exception) { api.clearSession() }
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
                "CLIENT_ROLE_NOT_ALLOWED" -> "Admin/Root hiện chỉ sử dụng Web. App/PDA chỉ hỗ trợ Picker và Reporter."
                "SESSION_REPLACED" -> "Tài khoản đã đăng nhập ở nơi khác. Phiên trên thiết bị này đã kết thúc."
                "SESSION_UPGRADE_REQUIRED" -> "Phiên cũ cần đăng nhập lại một lần để áp dụng cơ chế phiên mới."
                "AUTH_REQUIRED", "INVALID_AUTH_TOKEN", "SESSION_REFRESH_FAILED" -> "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
                else -> error.message
            }
        }
        return error.message ?: "Có lỗi không xác định."
    }

    private fun setStatus(message: String) {
        if (!::status.isInitialized) return
        val normalized = message.lowercase()
        val isError = listOf("lỗi", "không thể", "không hợp lệ", "thất bại", "hết hạn", "chưa xác minh").any { normalized.contains(it) }
        recordLog(message)
        if (isError && api.session != null) {
            val now = System.currentTimeMillis()
            if (now - lastImmediateRuntimeLogAt >= 20_000L) {
                lastImmediateRuntimeLogAt = now
                sendAndroidRuntimeLog(
                    "ERROR",
                    "android_runtime_error",
                    JSONObject(buildSupportDiagnostics()).put("message", sanitizeDiagnosticText(message)),
                )
            }
        }
        if (status.parent == null && api.session != null) {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            return
        }
        statusHideTask?.let { uiHandler.removeCallbacks(it) }
        status.text = message
        status.visibility = View.VISIBLE
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
        loginProgress?.visibility = if (updateCheckRunning) View.VISIBLE else View.GONE
        if (::updateButton.isInitialized) {
            updateButton.isEnabled = !updateCheckRunning
            updateButton.text = when (updateGate) {
                UpdateGate.REQUIRED -> "Cập nhật ngay"
                UpdateGate.FAILED -> "Thử lại cập nhật"
                else -> "Kiểm tra cập nhật"
            }
        }
        if (api.session == null && updateGate == UpdateGate.CURRENT && !updateCheckRunning) {
            if (::status.isInitialized) status.visibility = View.GONE
            return
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
                    cleanupUpdateArtifacts()
                    updateGate = UpdateGate.CURRENT
                    val restored = if (api.session != null) {
                        try { api.refreshProfile() } catch (_: Exception) { null }
                    } else null
                    runOnUiThread {
                        updateCheckRunning = false
                        if (restored != null) {
                            renderHome(restored)
                        } else {
                            applyUpdateGateUi(if (api.session == null) "Sẵn sàng đăng nhập." else if (!silent) "Đang dùng bản mới nhất." else null)
                        }
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
        val connection = openTrustedConnection(BuildConfig.UPDATE_RELEASE_API, UpdateResource.MANIFEST)
        val code = connection.responseCode
        val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (code !in 200..299) throw IllegalStateException("Kênh cập nhật HTTP $code")
        val manifest = JSONObject(text)
        val tag = manifest.optString("tag")
        val versionCode = manifest.optInt("version_code", -1)
        if (!tag.matches(Regex("^beta-vc\\d+$")) || versionCode <= 0 || tag != "beta-vc$versionCode") {
            throw IllegalStateException("Kênh cập nhật Beta không hợp lệ.")
        }
        val apkPath = manifest.optString("apk_path")
        val checksumPath = manifest.optString("checksum_path")
        if (!apkPath.startsWith("/") || !checksumPath.startsWith("/")) {
            throw IllegalStateException("Kênh cập nhật thiếu đường dẫn tin cậy.")
        }
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        return UpdateInfo(versionCode, tag, base + apkPath, base + checksumPath)
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
            setStatus("Cần cấp quyền cài ứng dụng không rõ nguồn gốc một lần cho 1291 Beta.")
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

    private enum class UpdateResource { MANIFEST, ASSET }

    private fun openTrustedConnection(url: String, resource: UpdateResource): HttpURLConnection {
        var current = URL(url)
        repeat(6) { redirectIndex ->
            validateUpdateUrl(current, resource, redirectIndex > 0)
            val connection = (current.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 60_000
                instanceFollowRedirects = false
                setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
                setRequestProperty("Accept", if (resource == UpdateResource.MANIFEST) "application/json" else "*/*")
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

    private fun validateUpdateUrl(url: URL, resource: UpdateResource, redirected: Boolean) {
        if (url.protocol != "https") throw IllegalStateException("Update chỉ cho phép HTTPS.")
        val serviceHost = URL(BuildConfig.API_BASE_URL).host
        if (resource == UpdateResource.MANIFEST) {
            if (redirected || url.host != serviceHost || url.path != "/downloads/pda/manifest") {
                throw IllegalStateException("Manifest cập nhật không thuộc dịch vụ tin cậy.")
            }
            return
        }

        if (!redirected) {
            val trustedPath = url.path == "/downloads/pda/latest" || url.path == "/downloads/pda/latest.sha256"
            if (url.host != serviceHost || !trustedPath) {
                throw IllegalStateException("Tệp cập nhật không thuộc dịch vụ tin cậy.")
            }
            return
        }

        if (url.host == "github.com") {
            val prefix = "/tamnv2/supra-inventory/releases/download/inventory-channel/"
            if (!url.path.startsWith(prefix)) throw IllegalStateException("Release asset không thuộc kênh Beta tin cậy.")
            return
        }
        val trustedCdn = url.host == "release-assets.githubusercontent.com" ||
            url.host == "objects.githubusercontent.com" ||
            url.host.endsWith(".githubusercontent.com")
        if (!trustedCdn) throw IllegalStateException("Redirect cập nhật không thuộc CDN GitHub tin cậy.")
    }

    private fun downloadText(url: String, tag: String): String {
        if (!tag.matches(Regex("^beta-vc\\d+$"))) throw IllegalStateException("Beta tag không hợp lệ.")
        val connection = openTrustedConnection(url, UpdateResource.ASSET)
        if (connection.responseCode !in 200..299) throw IllegalStateException("Checksum HTTP ${connection.responseCode}")
        return connection.inputStream.bufferedReader().use { it.readText() }
    }

    private fun downloadFile(url: String, file: File, tag: String) {
        if (!tag.matches(Regex("^beta-vc\\d+$"))) throw IllegalStateException("Beta tag không hợp lệ.")
        val connection = openTrustedConnection(url, UpdateResource.ASSET)
        if (connection.responseCode !in 200..299) throw IllegalStateException("APK HTTP ${connection.responseCode}")
        connection.inputStream.use { input ->
            file.outputStream().use { output -> input.copyTo(output, 64 * 1024) }
        }
    }

    private fun cleanupUpdateArtifacts() {
        try {
            val dir = File(getExternalFilesDir(null), "updates")
            if (!dir.exists()) return
            dir.listFiles()?.forEach { file ->
                if (file.isFile && (file.name.endsWith(".apk") || file.name.endsWith(".download"))) file.delete()
            }
            if (dir.listFiles().isNullOrEmpty()) dir.delete()
        } catch (_: Exception) {
            // Best-effort only; update verification remains fail-closed.
        }
    }

    private fun applySystemBarInsets() {
        val content = findViewById<View>(android.R.id.content) ?: return
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.navigationBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(content)
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
