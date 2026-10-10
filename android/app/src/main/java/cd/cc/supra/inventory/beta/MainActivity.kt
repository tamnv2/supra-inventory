package cd.cc.supra.inventory.beta

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
import android.view.Gravity
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
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
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

@Volatile private var firestoreOnlineOnlyConfigured = false

private fun configureFirestoreOnlineOnly() {
    if (firestoreOnlineOnlyConfigured) return
    synchronized(FirebaseFirestore::class.java) {
        if (firestoreOnlineOnlyConfigured) return
        val db = FirebaseFirestore.getInstance()
        db.firestoreSettings = FirebaseFirestoreSettings.Builder()
            .setPersistenceEnabled(false)
            .build()
        firestoreOnlineOnlyConfigured = true
    }
}

class MainActivity : Activity() {
    private enum class UpdateGate { CHECKING, CURRENT, REQUIRED, MANDATORY, DEFERRED, FAILED }

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
    private var activeCallWatcher: PickerActiveCallWatcher? = null
    private var contentContainer: FrameLayout? = null
    private var activeSession: AppSession? = null
    private var statusHideTask: Runnable? = null
    private var pendingInstallFile: File? = null
    private var pendingUpdateInfo: UpdateInfo? = null
    @Volatile private var updateGate = UpdateGate.CHECKING
    private var verifiedMinimumVersionCode: Int = 0
    private fun mandatoryUpdateKnown(): Boolean = verifiedMinimumVersionCode > BuildConfig.VERSION_CODE
    @Volatile private var updateCheckRunning = false
    private var lastUpdateCheckElapsedMs = 0L
    private val UPDATE_FOREGROUND_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000L
    @Volatile private var logoutRunning = false
    @Volatile private var roleSyncRunning = false
    @Volatile private var operatingWindowCheckRunning = false
    @Volatile private var overlayAckDrainRunning = false
    @Volatile private var activeCallAuthRefreshRunning = false
    @Volatile private var lastImmediateRuntimeLogAt = 0L
    private var permissionGateActive = false
    private var permissionManualReview = false
    private var restoringSessionScreen = false
    private var operatingWindowTask: Runnable? = null
    private var operatingScheduleReceiverRegistered = false
    private val operatingScheduleReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != StockMessagingService.ACTION_OPERATING_SCHEDULE_CHANGED || !::api.isInitialized) return
            applyOperatingSchedulePresentation()
        }
    }
    private var previousUncaughtHandler: Thread.UncaughtExceptionHandler? = null
    private val runtimeLogTick = object : Runnable {
        override fun run() {
            // D148: the 60-second tick remains for lightweight local reconciliation only.
            // Periodic PDA INFO-log uploads are retired; session-end/error/crash/manual
            // paths own support-log delivery so idle or unused PDAs create no log traffic.
            reconcileSkuCatalogRefresh()
            if (::api.isInitialized && api.session?.role == "PICKER") {
                drainOverlayAcknowledgements()
            }
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
        verifiedMinimumVersionCode = getSharedPreferences("d166_update_floor", MODE_PRIVATE)
            .getInt("verified_minimum_version_code", 0).coerceAtLeast(0)
        if (mandatoryUpdateKnown()) updateGate = UpdateGate.MANDATORY
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
        configureFirestoreOnlineOnly()
        createNotificationChannel()
        api = InventoryApi(
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
            userAgent = "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}",
            onSessionChanged = ::persistInteractiveSession,
        )
        val restoredSession = restoreInteractiveSession()
        restoredSession?.let(api::restoreSession)
        skuCache = SkuCatalogCache(this)
        installCrashRuntimeLogHandler()
        if (hasRequiredNotificationPermissions()) {
            continueStartupAfterPermissionGate()
        } else {
            renderRequiredPermissionsGate()
        }
    }

    override fun onStart() {
        super.onStart()
        if (!operatingScheduleReceiverRegistered) {
            val filter = IntentFilter(StockMessagingService.ACTION_OPERATING_SCHEDULE_CHANGED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(operatingScheduleReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                registerReceiver(operatingScheduleReceiver, filter)
            }
            operatingScheduleReceiverRegistered = true
        }
    }

    override fun onStop() {
        if (operatingScheduleReceiverRegistered) {
            try { unregisterReceiver(operatingScheduleReceiver) } catch (_: Exception) { }
            operatingScheduleReceiverRegistered = false
        }
        super.onStop()
    }

    override fun onDestroy() {
        statusHideTask?.let { uiHandler.removeCallbacks(it) }
        operatingWindowTask?.let { uiHandler.removeCallbacks(it) }
        operatingWindowTask = null
        uiHandler.removeCallbacks(runtimeLogTick)
        pickerController?.destroy()
        activeCallWatcher?.close()
        activeCallWatcher = null
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
        if (::api.isInitialized) {
            if (!hasRequiredNotificationPermissions()) {
                if (!permissionGateActive) {
                    stopOperationalClients()
                    renderRequiredPermissionsGate("Cần cấp đủ quyền để tiếp tục sử dụng 1291 Báo hàng Beta.")
                }
                return
            }
            if (permissionGateActive) {
                if (permissionManualReview) {
                    renderRequiredPermissionsGate("Kiểm tra lại trạng thái thực tế của từng quyền rồi bấm “Kiểm tra cấp quyền”.")
                } else {
                    continueStartupAfterPermissionGate()
                }
                return
            }
        }
        if (::api.isInitialized && api.session == null && updateGate != UpdateGate.CURRENT && !updateCheckRunning) {
            checkForUpdate(silent = true)
        }
        if (::api.isInitialized && api.session != null && !updateCheckRunning &&
            android.os.SystemClock.elapsedRealtime() - lastUpdateCheckElapsedMs >= UPDATE_FOREGROUND_CHECK_INTERVAL_MS) {
            // Foreground-only, max once per 6h, no new timer or background poll.
            checkForUpdate(silent = true)
        }
        if (::api.isInitialized && api.session != null &&
            (updateGate == UpdateGate.CURRENT || updateGate == UpdateGate.MANDATORY)) {
            // Do not block result receipts/ACK for an already-running session.
            reconcileNotificationSignal()
            reconcileSkuCatalogRefresh()
            drainOverlayAcknowledgements()
            ensurePickerActiveCallWatcher(api.session!!)
            applyOperatingSchedulePresentation()
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
                    val identityChanged =
                        before?.displayName != next.displayName ||
                        before?.employeeCode != next.employeeCode ||
                        before?.contractorName != next.contractorName
                    val reportingChanged = before?.shortageReportingEnabled != next.shortageReportingEnabled
                    if (roleChanged || identityChanged || activeSession == null) {
                        renderHome(next)
                    } else {
                        activeSession = next
                        if (reportingChanged && next.role == "PICKER") {
                            pickerController?.applyShortageReportingCapability(next.shortageReportingEnabled)
                        }
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

    private fun reconcileSkuCatalogRefresh() {
        if (!::api.isInitialized || api.session == null) return
        if (!NotificationSignalStore.consumeSkuCatalogRefresh(applicationContext)) return
        val current = api.session
        if (current?.role == "PICKER" && !current.shortageReportingEnabled) return
        syncSkuCatalogAsync("push")
    }

    private fun syncSkuCatalogAsync(reason: String, onDone: (Boolean) -> Unit = {}) {
        if (api.session == null) {
            onDone(false)
            return
        }
        Thread {
            try {
                val result = skuCache.sync(api)
                runOnUiThread {
                    recordLog(
                        if (result.updated) "Đã tự cập nhật Master SKU · ${result.count} SKU · $reason"
                        else "Master SKU đã mới nhất · ${result.count} SKU · $reason"
                    )
                    onDone(true)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    recordLog("Tự cập nhật Master SKU thất bại · $reason · ${sanitizeDiagnosticText(error.message ?: "unknown")}")
                    onDone(false)
                }
            }
        }.start()
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

    private fun persistInteractiveSession(value: AppSession?) {
        InteractiveSessionStore.save(applicationContext, value)
    }

    private fun restoreInteractiveSession(): AppSession? =
        InteractiveSessionStore.load(applicationContext)

    private fun renderSessionRestoring(session: AppSession) {
        uiHandler.removeCallbacks(runtimeLogTick)
        stopOperationalClients()
        activeSession = session
        contentContainer = null
        restoringSessionScreen = true

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(kit.dp(26), kit.dp(26), kit.dp(26), kit.dp(26))
            setBackgroundColor(Color.rgb(244, 247, 250))
        }
        root.addView(TextView(this).apply {
            text = "1291 Báo hàng Beta"
            textSize = 24f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.rgb(24, 43, 55))
            gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = "Đang khôi phục phiên làm việc"
            textSize = 15f
            setTextColor(Color.rgb(71, 85, 105))
            gravity = Gravity.CENTER
            setPadding(0, kit.dp(8), 0, kit.dp(16))
        })
        val progress = ProgressBar(this)
        root.addView(progress, LinearLayout.LayoutParams(kit.dp(38), kit.dp(38)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        })
        status = TextView(this).apply {
            text = "Đang xác minh phiên bản và phiên đăng nhập..."
            textSize = 13f
            setTextColor(Color.rgb(71, 85, 105))
            gravity = Gravity.CENTER
            setPadding(0, kit.dp(14), 0, kit.dp(10))
        }
        root.addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        updateButton = Button(this).apply {
            text = "Thử lại"
            visibility = View.GONE
            setOnClickListener { checkForUpdate(silent = false) }
        }
        root.addView(updateButton, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, kit.dp(48)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        })
        loginButton = null
        loginProgress = progress
        setContentView(root)
        applySystemBarInsets()
        checkForUpdate(silent = true)
    }

    private fun renderLogin(message: String = "Đang kiểm tra phiên bản...") {
        uiHandler.removeCallbacks(runtimeLogTick)
        stopOperationalClients()
        restoringSessionScreen = false
        activeSession = null
        contentContainer = null
        setContentView(R.layout.activity_login)
        applySystemBarInsets()
        findViewById<TextView>(R.id.tvLoginVersion).text =
            "Beta vc${BuildConfig.VERSION_CODE} · ${BuildConfig.VERSION_NAME.substringBefore("-")}"

        val username = findViewById<EditText>(R.id.etEmployeeCode)
        val password = findViewById<EditText>(R.id.etPassword)
        if (BuildConfig.DEFAULT_PICKER_PASSWORD.isNotBlank()) password.setText(BuildConfig.DEFAULT_PICKER_PASSWORD)
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
        updateButton = findViewById(R.id.btnLoginUpdate)
        loginButton = login
        updateButton.setOnClickListener {
            pendingUpdateInfo?.let { info -> showUpdateAvailable(info) } ?: checkForUpdate(silent = false)
        }

        status.visibility = View.GONE
        progress.visibility = View.GONE
        login.isEnabled = updateGate != UpdateGate.FAILED && updateGate != UpdateGate.MANDATORY
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
            if (updateGate == UpdateGate.FAILED || updateGate == UpdateGate.MANDATORY) {
                setStatus(updateGateMessage())
                return@setOnClickListener
            }
            val user = username.text.toString().trim().lowercase()
            val pass = password.text.toString().trimEnd('\r', '\n')
            if (!user.matches(Regex("[a-z0-9._-]{1,64}")) || pass.isBlank()) {
                setStatus("Tên đăng nhập hoặc mật khẩu/mã xác nhận không hợp lệ.")
                return@setOnClickListener
            }
            fun attemptLogin(force: Boolean) {
                login.isEnabled = false
                progress.visibility = View.VISIBLE
                status.visibility = View.GONE
                Thread {
                    try {
                        val session = api.login(user, pass, "android:$notificationDeviceId", force)
                        api.lastOperatingWindow?.let { OperatingScheduleStore.applyWorkerWindow(applicationContext, it) }
                        runOnUiThread {
                            progress.visibility = View.GONE
                            password.setText("")
                            renderHome(session)
                        }
                    } catch (e: Exception) {
                        if (e is ApiException && e.code == "SESSION_ACTIVE_OTHER_DEVICE" && !force) {
                            runOnUiThread {
                                progress.visibility = View.GONE
                                login.isEnabled = updateGate != UpdateGate.FAILED && updateGate != UpdateGate.MANDATORY
                                AlertDialog.Builder(this@MainActivity)
                                    .setTitle("Tài khoản đang dùng trên App/PDA khác")
                                    .setMessage(e.message + "\n\nTiếp tục sẽ đăng xuất phiên App/PDA cũ. Web và Agent không bị ảnh hưởng.")
                                    .setNegativeButton("Huỷ", null)
                                    .setPositiveButton("Tiếp tục") { _, _ -> attemptLogin(true) }
                                    .create().also { safelyShowDialog(it) }
                            }
                        } else {
                            runOnUiThread {
                                progress.visibility = View.GONE
                                login.isEnabled = updateGate != UpdateGate.FAILED && updateGate != UpdateGate.MANDATORY
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
        restoringSessionScreen = false
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
        findViewById<TextView>(R.id.tvHeaderTitle).text = "1291 Báo hàng Beta"
        findViewById<TextView>(R.id.tvHeaderUser).text =
            buildString {
                append(session.employeeCode ?: session.userId)
                append(" · ")
                append(session.displayName)
                if (session.role == "PICKER" && !session.contractorName.isNullOrBlank()) {
                    append(" · ")
                    append(session.contractorName)
                }
            }
        findViewById<TextView>(R.id.tvAppVersion).apply {
            text = "Beta vc${BuildConfig.VERSION_CODE}"
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Tìm kiếm bản cập nhật?")
                    .setMessage("Hệ thống sẽ kiểm tra kênh Beta một lần.")
                    .setNegativeButton("Huỷ", null)
                    .setPositiveButton("Tìm kiếm") { _, _ -> checkForUpdate(silent = false) }
                    .create().also { safelyShowDialog(it) }
            }
        }
        findViewById<TextView>(R.id.btnLog).setOnClickListener { showSupportDiagnostics() }
        findViewById<TextView>(R.id.btnLogout).setOnClickListener { confirmLogout() }
        configureOperationalDisplayControls(session)
        findViewById<TextView>(R.id.btnBack).setOnClickListener { }

        when (session.role) {
            "PICKER" -> renderPickerHome(session)
            "REPORTER" -> renderReporterHome(session, showLauncherBack = false, initialFilter = "PENDING")
            "ADMIN" -> renderReporterHome(session, showLauncherBack = false, initialFilter = "PENDING")
            "ROOT", "PICKPACK_ADMIN" -> {
                api.clearSession()
                renderLogin("Root/Quản trị Pick Pack sử dụng Web hoặc Agent phù hợp. App/PDA hỗ trợ Picker, Reporter và Quản trị Invent ở chế độ xử lý báo hàng.")
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
        if (session.role == "PICKER") {
            ensurePickerActiveCallWatcher(session)
        } else {
            activeCallWatcher?.close()
        }
        scheduleAndroidOperatingWindowCheck(session)
        registerBackgroundNotifications()
        drainNotificationReceipts()
        drainOverlayAcknowledgements()
        recordLog("Đăng nhập ${kit.roleLabel(session.role)}: ${session.employeeCode ?: session.displayName}")
        flushPendingCrashRuntimeLog()
        flushPendingSessionEndRuntimeLog(session)
        uiHandler.removeCallbacks(runtimeLogTick)
        uiHandler.post(runtimeLogTick)
    }

    private fun ensurePickerActiveCallWatcher(session: AppSession) {
        if (session.role != "PICKER") {
            activeCallWatcher?.close()
            return
        }
        if (activeCallWatcher == null) {
            activeCallWatcher = PickerActiveCallWatcher(
                applicationContext,
                onSessionRevoked = {
                    runOnUiThread {
                        if (api.session?.role == "PICKER") {
                            logoutWithNotificationCleanup(
                                "Phiên PDA đã bị Kích User. Vui lòng đăng nhập lại."
                            )
                        }
                    }
                },
                log = ::recordLog,
            )
        }
        if (!session.relayCustomToken.isNullOrBlank()) {
            activeCallWatcher?.reconcile(session)
            return
        }
        if (activeCallAuthRefreshRunning) return
        activeCallAuthRefreshRunning = true
        Thread {
            try {
                val refreshed = api.refreshSessionForRelay()
                runOnUiThread {
                    activeCallAuthRefreshRunning = false
                    if (api.session?.userId == refreshed.userId && refreshed.role == "PICKER") {
                        activeSession = refreshed
                        activeCallWatcher?.start(refreshed)
                    }
                }
            } catch (error: Exception) {
                runOnUiThread {
                    activeCallAuthRefreshRunning = false
                    recordLog("D133 active-call auth refresh deferred: " + error.message.orEmpty().take(160))
                }
            }
        }.start()
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
        val reset = findViewById<TextView>(R.id.btnTextReset)
        val scalable = session.role == "PICKER" || session.role == "REPORTER" || session.role == "ADMIN"
        minus.visibility = if (scalable) View.VISIBLE else View.GONE
        plus.visibility = if (scalable) View.VISIBLE else View.GONE
        reset.visibility = if (scalable) View.VISIBLE else View.GONE
        if (!scalable) return

        fun applyScale(nextRaw: Float) {
            val picker = session.role == "PICKER"
            val prefs = getSharedPreferences(if (picker) "picker_display_scale_v1" else "reporter_display_scale_v1", MODE_PRIVATE)
            val current = if (picker) pickerDisplayScale(session) else reporterDisplayScale(session)
            val next = nextRaw.coerceIn(0.8f, 1.4f)
            if (next == current) return
            val currentFilter = reporterController?.currentFilterName() ?: "PENDING"
            prefs.edit().putFloat("user:${session.userId}", next).apply()
            if (picker) {
                renderPickerHome(session)
            } else {
                renderReporterHome(session, showLauncherBack = false, initialFilter = currentFilter)
            }
            val percent = (next * 100).toInt()
            Toast.makeText(this, "Cỡ hiển thị ${kit.roleLabel(session.role)}: $percent%", Toast.LENGTH_SHORT).show()
        }

        minus.setOnClickListener {
            val current = if (session.role == "PICKER") pickerDisplayScale(session) else reporterDisplayScale(session)
            applyScale(current - 0.1f)
        }
        plus.setOnClickListener {
            val current = if (session.role == "PICKER") pickerDisplayScale(session) else reporterDisplayScale(session)
            applyScale(current + 0.1f)
        }
        reset.setOnClickListener { applyScale(1.0f) }
        minus.contentDescription = "Thu nhỏ cỡ hiển thị"
        plus.contentDescription = "Phóng to cỡ hiển thị"
        reset.contentDescription = "Đặt cỡ hiển thị về 100%"
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
            session.shortageReportingEnabled,
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
        activeCallWatcher?.close()
        activeCallWatcher = null
        realtimeClient?.stop()
        realtimeClient = null
    }

    private fun safelyShowDialog(dialog: AlertDialog): Boolean {
        // A queued background/OTA/session callback may outlive the Activity's
        // window token even before onDestroy finishes (D167 BadToken crash).
        if (isFinishing || isDestroyed) return false
        return try {
            dialog.show()
            true
        } catch (_: android.view.WindowManager.BadTokenException) {
            false
        } catch (_: IllegalStateException) {
            false
        }
    }

    private fun confirmLogout() {
        AlertDialog.Builder(this)
            .setTitle("Đăng xuất?")
            .setMessage("Phiên làm việc hiện tại sẽ kết thúc.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Đăng xuất") { _, _ -> logoutWithNotificationCleanup() }
            .create().also { safelyShowDialog(it) }
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
            .setNeutralButton("Gửi log") { _, _ ->
                sendAndroidRuntimeLog("INFO", "manual_android_log", JSONObject(payload), showResult = true)
                Toast.makeText(this, "Đang gửi log...", Toast.LENGTH_SHORT).show()
            }
            .setPositiveButton("Chia sẻ") { _, _ ->
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, "1291 Báo hàng Beta support log")
                    putExtra(Intent.EXTRA_TEXT, payload)
                }
                startActivity(Intent.createChooser(intent, "Chia sẻ log hỗ trợ"))
            }
            .create().also { safelyShowDialog(it) }
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
            .put("journal", androidPersistentJournalSnapshot())
            .put("d166_usage_audit", D166UsageAudit.snapshot(androidPersistentJournalSnapshot()))
            .put("recent_events", JSONArray(localLog.toList().takeLast(80).map(::sanitizeDiagnosticText)))
            .put("recent_errors", JSONArray(errors))

        // D166 logging-only: never cut a serialized JSON string midway (invalid JSON).
        var serialized = root.toString()
        if (serialized.length <= 16_000) return serialized
        root.remove("recent_events")
        root.remove("recent_errors")
        val journalEvents = root.optJSONObject("journal")?.optJSONArray("recent_events")
        if (journalEvents != null) {
            while (root.toString().length > 16_000 && journalEvents.length() > 0) journalEvents.remove(0)
        }
        root.put("d166_bounded_json", true)
        serialized = root.toString()
        if (serialized.length <= 16_000) return serialized
        root.remove("journal")
        serialized = root.toString()
        if (serialized.length <= 16_000) return serialized
        return JSONObject().put("format", "supra-inventory-support-v2")
            .put("d166_bounded_json", true)
            .put("d166_usage_audit", D166UsageAudit.snapshot())
            .toString()
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
        try {
            val userId = (activeSession ?: api.session)?.userId.orEmpty()
            if (userId.isNotBlank()) {
                val prefs = runtimeLogPrefs()
                val owner = prefs.getString("journal_owner", "").orEmpty()
                val sequence = if (owner == userId) prefs.getLong("journal_sequence", 0L) + 1L else 1L
                val persisted = if (owner == userId) {
                    try { JSONArray(prefs.getString("journal_events", "[]")) } catch (_: Exception) { JSONArray() }
                } else JSONArray()
                persisted.put(JSONObject()
                    .put("at", Instant.now().toString())
                    .put("sequence", sequence)
                    .put("level", "INFO")
                    .put("category", "APP")
                    .put("name", sanitizeDiagnosticText(message)))
                var dropped = if (owner == userId) prefs.getLong("journal_dropped", 0L) else 0L
                while (persisted.length() > 160) {
                    persisted.remove(0)
                    dropped += 1L
                }
                while (persisted.toString().length > 700_000 && persisted.length() > 20) {
                    persisted.remove(0)
                    dropped += 1L
                }
                prefs.edit()
                    .putString("journal_owner", userId)
                    .putLong("journal_sequence", sequence)
                    .putLong("journal_dropped", dropped)
                    .putString("journal_events", persisted.toString())
                    .apply()
            }
        } catch (_: Exception) { }
    }

    private fun androidPersistentJournalSnapshot(): JSONObject {
        val prefs = runtimeLogPrefs()
        val userId = (activeSession ?: api.session)?.userId.orEmpty()
        if (userId.isBlank() || prefs.getString("journal_owner", "").orEmpty() != userId) {
            return JSONObject().put("persistent", false)
        }
        val events = try { JSONArray(prefs.getString("journal_events", "[]")) } catch (_: Exception) { JSONArray() }
        return JSONObject()
            .put("persistent", true)
            .put("format", "supra-android-runtime-journal-v2")
            .put("first_sequence", events.optJSONObject(0)?.optLong("sequence", 0L)?.takeIf { it > 0L })
            .put("last_sequence", events.optJSONObject(events.length() - 1)?.optLong("sequence", 0L)?.takeIf { it > 0L })
            .put("dropped_events", prefs.getLong("journal_dropped", 0L))
            .put("recent_events", events)
    }

    private fun pruneAndroidPersistentJournal(payload: JSONObject) {
        val journal = payload.optJSONObject("journal")
            ?: payload.optJSONObject("support")?.optJSONObject("journal")
            ?: return
        val through = journal.optLong("last_sequence", 0L)
        if (through <= 0L) return
        val prefs = runtimeLogPrefs()
        val events = try { JSONArray(prefs.getString("journal_events", "[]")) } catch (_: Exception) { JSONArray() }
        val keep = JSONArray()
        for (index in 0 until events.length()) {
            val event = events.optJSONObject(index) ?: continue
            if (event.optLong("sequence", 0L) > through) keep.put(event)
        }
        prefs.edit()
            .putString("journal_events", keep.toString())
            .putLong("journal_dropped", 0L)
            .apply()
    }

    private fun runtimeLogPrefs() = getSharedPreferences("runtime_logs", MODE_PRIVATE)

    private fun androidRuntimeLogDevice(): JSONObject = JSONObject()
        .put("device_id", notificationDeviceId)
        .put("manufacturer", Build.MANUFACTURER.take(80))
        .put("model", Build.MODEL.take(80))
        .put("sdk_int", Build.VERSION.SDK_INT)
        .put("package", BuildConfig.APPLICATION_ID)
        .put("version_code", BuildConfig.VERSION_CODE)
        .put("version_name", BuildConfig.VERSION_NAME)

    private data class AndroidLogSendResult(
        val accepted: Boolean,
        val archiveStatus: String = "",
        val error: String = "",
    )

    private data class AndroidRuntimeLogIdentity(
        val bundleId: String,
        val boundaryId: String,
        val traceId: String,
        val generatedAt: String,
    )

    private fun ensureAndroidRuntimeLogIdentity(payload: JSONObject, reason: String): AndroidRuntimeLogIdentity {
        val bundlePattern = Regex("^[a-f0-9]{32,64}$")
        val idPattern = Regex("^[A-Za-z0-9._:-]{1,180}$")
        var bundleId = payload.optString("_runtime_log_bundle_id", "").lowercase()
        if (!bundlePattern.matches(bundleId)) {
            bundleId = UUID.randomUUID().toString().replace("-", "").lowercase()
            payload.put("_runtime_log_bundle_id", bundleId)
        }
        var boundaryId = payload.optString("_runtime_log_boundary_id", "")
        if (!idPattern.matches(boundaryId)) {
            val safeReason = reason.replace(Regex("[^A-Za-z0-9._-]+"), "_").take(48).ifBlank { "support" }
            boundaryId = "android:$safeReason:$bundleId"
            payload.put("_runtime_log_boundary_id", boundaryId)
        }
        var traceId = payload.optString("_runtime_log_trace_id", "")
        if (!idPattern.matches(traceId)) {
            traceId = boundaryId
            payload.put("_runtime_log_trace_id", traceId)
        }
        var generatedAt = payload.optString("_runtime_log_generated_at", "")
        if (generatedAt.isBlank()) {
            generatedAt = Instant.now().toString()
            payload.put("_runtime_log_generated_at", generatedAt)
        }
        return AndroidRuntimeLogIdentity(bundleId, boundaryId, traceId, generatedAt)
    }

    private fun uploadAndroidRuntimeLog(severity: String, reason: String, payload: JSONObject): AndroidLogSendResult {
        if (api.session == null) return AndroidLogSendResult(false, error = "Chưa đăng nhập.")
        if (!hasValidatedInternet()) return AndroidLogSendResult(false, error = "Chưa có Internet.")
        return try {
            val identity = ensureAndroidRuntimeLogIdentity(payload, reason)
            val response = api.uploadRuntimeLog(
                severity = severity,
                reason = sanitizeDiagnosticText(reason),
                generatedAt = identity.generatedAt,
                device = androidRuntimeLogDevice(),
                payload = payload,
                bundleId = identity.bundleId,
                boundaryId = identity.boundaryId,
                traceId = identity.traceId,
            )
            val archiveStatus = response.optString("archive_status", "DEFERRED")
            if (archiveStatus == "DRIVE_SYNCED") pruneAndroidPersistentJournal(payload)
            AndroidLogSendResult(
                accepted = true,
                archiveStatus = archiveStatus,
            )
        } catch (error: Exception) {
            val safe = sanitizeDiagnosticText(error.message ?: "unknown")
            recordLog("Lỗi gửi log: $safe")
            AndroidLogSendResult(false, error = safe)
        }
    }

    private fun sendAndroidRuntimeLog(
        severity: String,
        reason: String,
        payload: JSONObject = JSONObject(buildSupportDiagnostics()),
        showResult: Boolean = false,
    ) {
        Thread {
            val result = uploadAndroidRuntimeLog(severity, reason, payload)
            if (result.accepted) recordLog("Đã gửi log $severity · $reason · ${result.archiveStatus}")
            if (showResult) {
                runOnUiThread {
                    val message = when {
                        !result.accepted -> "Không gửi được log: ${result.error.ifBlank { "không xác định" }}"
                        result.archiveStatus == "DRIVE_SYNCED" -> "Đã gửi log và lưu Google Drive."
                        else -> "Đã lưu log hệ thống; Drive sẽ tự tiếp tục gửi."
                    }
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun savePendingSessionEndRuntimeLog(session: AppSession, payload: JSONObject) {
        // D165: persist the final sanitized bundle synchronously before any
        // session cleanup. The embedded bundle identity survives retries so the
        // server/Drive archive can dedupe the same logout boundary.
        runtimeLogPrefs().edit()
            .putString("pending_session_end_user", session.userId)
            .putString("pending_session_end_payload", payload.toString().take(30_000))
            .commit()
    }

    private fun flushPendingSessionEndRuntimeLog(session: AppSession) {
        val prefs = runtimeLogPrefs()
        val pendingUser = prefs.getString("pending_session_end_user", "").orEmpty()
        val raw = prefs.getString("pending_session_end_payload", null) ?: return
        if (pendingUser != session.userId) {
            // Never upload a previous user's session-end diagnostic under another
            // authenticated account. A later login of the same user may retry.
            return
        }
        Thread {
            val payload = try {
                JSONObject(raw)
            } catch (_: Exception) {
                JSONObject().put("raw", sanitizeDiagnosticText(raw))
            }
            val result = uploadAndroidRuntimeLog("INFO", "session_end_logout", payload)
            if (result.archiveStatus == "DRIVE_SYNCED") {
                prefs.edit()
                    .remove("pending_session_end_user")
                    .remove("pending_session_end_payload")
                    .apply()
            }
        }.start()
    }

    private fun flushPendingCrashRuntimeLog() {
        val prefs = runtimeLogPrefs()
        val raw = prefs.getString("pending_crash", null) ?: return
        Thread {
            val payload = try { JSONObject(raw) } catch (_: Exception) { JSONObject().put("raw", sanitizeDiagnosticText(raw)) }
            val result = uploadAndroidRuntimeLog("ERROR", "deferred_android_crash", payload)
            if (result.archiveStatus == "DRIVE_SYNCED") {
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
            ensureAndroidRuntimeLogIdentity(payload, "android_crash")
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

    private fun notificationPermissionGranted(): Boolean =
        AndroidAlertReadiness.evaluate(this).notificationsReady

    private fun overlayPermissionGranted(): Boolean =
        AndroidAlertReadiness.evaluate(this).overlayReady

    private fun hasRequiredNotificationPermissions(): Boolean =
        AndroidAlertReadiness.evaluate(this).ready

    private fun continueStartupAfterPermissionGate() {
        permissionManualReview = false
        permissionGateActive = false
        val session = api.session
        if (session == null) {
            renderLogin("Đang kiểm tra phiên bản...")
        } else {
            renderSessionRestoring(session)
        }
    }

    private fun renderRequiredPermissionsGate(message: String = "") {
        permissionGateActive = true
        stopOperationalClients()

        val readiness = AndroidAlertReadiness.evaluate(this)
        val root = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(243, 246, 248))
            isFillViewport = true
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 32, 28, 32)
        }
        content.addView(TextView(this).apply {
            text = "HOÀN TẤT QUYỀN CẢNH BÁO"
            textSize = 21f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.rgb(15, 23, 42))
        })
        content.addView(TextView(this).apply {
            text = if (message.isBlank()) {
                "Ưu tiên thử khả năng vượt Không làm phiền trước. Sau đó hoàn tất các quyền bắt buộc để cảnh báo luôn hiển thị ổn định."
            } else message
            textSize = 14f
            setTextColor(Color.rgb(71, 85, 105))
            setPadding(0, 10, 0, 12)
        })

        fun permissionCard(
            title: String,
            ready: Boolean,
            why: String,
            guide: String,
            buttonText: String = "MỞ CÀI ĐẶT",
            action: (() -> Unit)? = null,
        ) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(18, 16, 18, 16)
                background = android.graphics.drawable.GradientDrawable().apply {
                    setColor(Color.WHITE)
                    cornerRadius = 14f
                    setStroke(1, if (ready) Color.rgb(134, 239, 172) else Color.rgb(203, 213, 225))
                }
            }
            card.addView(TextView(this).apply {
                text = (if (ready) "✓ " else "• ") + title + if (ready) " · Đã cấp" else " · Chưa sẵn sàng"
                textSize = 15f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(if (ready) Color.rgb(21, 128, 61) else Color.rgb(153, 27, 27))
            })
            card.addView(TextView(this).apply {
                text = why
                textSize = 13f
                setTextColor(Color.rgb(51, 65, 85))
                setPadding(0, 6, 0, 2)
            })
            card.addView(TextView(this).apply {
                text = guide
                textSize = 12.5f
                setTextColor(Color.rgb(100, 116, 139))
                setPadding(0, 2, 0, 8)
            })
            if (action != null) {
                card.addView(Button(this).apply {
                    text = buttonText
                    isAllCaps = false
                    setOnClickListener { action() }
                }, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ))
            }
            content.addView(card, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = 10 })
        }

        val priorityCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 16, 18, 16)
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.rgb(239, 246, 255))
                cornerRadius = 14f
                setStroke(2, Color.rgb(59, 130, 246))
            }
        }
        priorityCard.addView(TextView(this).apply {
            text = "ƯU TIÊN 1 · KHÔNG LÀM PHIỀN + OVERLAY"
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.rgb(30, 64, 175))
        })
        priorityCard.addView(TextView(this).apply {
            text = "Hãy thử Không làm phiền trước. Nếu PASS, thiết bị dùng chế độ cảnh báo đầy đủ; nếu không PASS, Overlay là lớp tương thích để cảnh báo vẫn phủ lên ứng dụng đang mở."
            textSize = 13f
            setTextColor(Color.rgb(30, 64, 175))
            setPadding(0, 7, 0, 8)
        })
        priorityCard.addView(TextView(this).apply {
            text = if (readiness.nativeDndReady) {
                "✓ Không làm phiền · PASS"
            } else {
                "• Không làm phiền · Chưa PASS hoặc thiết bị không hỗ trợ đầy đủ"
            }
            textSize = 13.5f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (readiness.nativeDndReady) Color.rgb(21, 128, 61) else Color.rgb(180, 83, 9))
        })
        if (!readiness.nativeDndReady) {
            priorityCard.addView(Button(this).apply {
                text = if (readiness.dndPolicyReady) "KIỂM TRA KÊNH CẢNH BÁO" else "THỬ QUYỀN KHÔNG LÀM PHIỀN"
                isAllCaps = false
                setOnClickListener {
                    if (readiness.dndPolicyReady) {
                        AndroidAlertReadiness.openCriticalChannelSettings(this@MainActivity)
                    } else {
                        AndroidAlertReadiness.openDndPolicySettings(this@MainActivity)
                    }
                }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = 8 })
        }
        priorityCard.addView(TextView(this).apply {
            text = (if (readiness.overlayReady) "✓ " else "• ") +
                "Hiển thị trên ứng dụng khác" +
                if (readiness.overlayReady) " · Đã cấp" else " · Bắt buộc"
            textSize = 13.5f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (readiness.overlayReady) Color.rgb(21, 128, 61) else Color.rgb(153, 27, 27))
            setPadding(0, 3, 0, 4)
        })
        priorityCard.addView(TextView(this).apply {
            text = "Overlay vẫn phải được cấp để bảo đảm cảnh báo có thể phủ SFT/ứng dụng khác trên các PDA thực tế."
            textSize = 12.5f
            setTextColor(Color.rgb(71, 85, 105))
            setPadding(0, 0, 0, 8)
        })
        priorityCard.addView(Button(this).apply {
            text = if (readiness.overlayReady) "MỞ CÀI ĐẶT OVERLAY" else "CẤP QUYỀN OVERLAY"
            isAllCaps = false
            setOnClickListener { AndroidAlertReadiness.openOverlaySettings(this@MainActivity) }
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ))
        content.addView(priorityCard, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = 12 })

        permissionCard(
            "Thông báo ứng dụng",
            readiness.notificationsReady,
            "Để PDA nhận cảnh báo nghiệp vụ khi ứng dụng đang chạy nền.",
            "Bật “Cho phép thông báo” cho 1291 Báo hàng Beta.",
        ) { requestNotificationPermissionFromGate() }

        permissionCard(
            "Không tối ưu pin",
            readiness.batteryReady,
            "Để Android không trì hoãn cảnh báo khi bật Tiết kiệm pin.",
            "Chọn Cho phép / Không tối ưu cho ứng dụng.",
            "CHO PHÉP KHÔNG TỐI ƯU PIN",
        ) { AndroidAlertReadiness.openBatteryOptimizationSettings(this) }

        content.addView(TextView(this).apply {
            text = if (readiness.nativeDndReady) {
                "Chế độ cảnh báo đầy đủ · Sẵn sàng. DND PASS; các quyền bắt buộc bên trên vẫn phải hoàn tất."
            } else {
                "Chế độ tương thích Overlay · Sẵn sàng. DND không chặn đăng nhập; các quyền bắt buộc vẫn phải PASS."
            }
            textSize = 12.5f
            setTextColor(if (readiness.nativeDndReady) Color.rgb(21, 128, 61) else Color.rgb(29, 78, 216))
            setPadding(0, 2, 0, 8)
        })

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 8, 0, 0)
        }
        actions.addView(Button(this).apply {
            text = "Kiểm tra cấp quyền"
            isAllCaps = false
            setOnClickListener {
                val latest = AndroidAlertReadiness.evaluate(this@MainActivity)
                if (latest.ready) {
                    permissionManualReview = false
                    continueStartupAfterPermissionGate()
                } else {
                    permissionManualReview = true
                    renderRequiredPermissionsGate("Còn quyền bắt buộc chưa sẵn sàng. Hoàn tất các mục bên dưới rồi bấm “Kiểm tra cấp quyền”.")
                }
            }
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        actions.addView(Button(this).apply {
            text = "Đặt lại mặc định"
            isAllCaps = false
            setOnClickListener {
                getSharedPreferences("required_permission_gate_v1", MODE_PRIVATE).edit().clear().apply()
                permissionManualReview = true
                Toast.makeText(
                    this@MainActivity,
                    "Đã đặt lại trạng thái kiểm tra. Quyền hệ thống vẫn do Android quản lý; hãy chỉnh tại Cài đặt rồi quay lại kiểm tra.",
                    Toast.LENGTH_LONG,
                ).show()
                AndroidAlertReadiness.openAppDetails(this@MainActivity)
            }
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = 6 })
        content.addView(actions)

        content.addView(TextView(this).apply {
            text = "Sau khi thay đổi quyền, ứng dụng sẽ tự kiểm tra khi quay lại. Nếu màn hình chưa chuyển, bấm “Kiểm tra cấp quyền”."
            textSize = 12f
            setTextColor(Color.rgb(71, 85, 105))
            setPadding(0, 10, 0, 6)
        })

        root.addView(content)
        setContentView(root)
    }

    private fun requestNotificationPermissionFromGate() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            val prefs = getSharedPreferences("required_permission_gate_v1", MODE_PRIVATE)
            if (!prefs.getBoolean("notification_requested", false)) {
                prefs.edit().putBoolean("notification_requested", true).apply()
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 701)
                return
            }
        }
        try {
            startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            })
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != 701) return
        if (hasRequiredNotificationPermissions()) {
            continueStartupAfterPermissionGate()
        } else {
            renderRequiredPermissionsGate("Quyền thông báo là bắt buộc để tiếp tục sử dụng ứng dụng.")
        }
    }

    private fun registerBackgroundNotifications() {
        ensureOperatingScheduleTopic()
        NotificationSignalStore.latestToken(applicationContext)?.let(::registerNotificationToken)
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val token = if (task.isSuccessful) task.result else null
            if (token.isNullOrBlank()) return@addOnCompleteListener
            NotificationSignalStore.saveToken(applicationContext, token)
            registerNotificationToken(token)
        }
    }

    private fun ensureOperatingScheduleTopic() {
        val prefs = getSharedPreferences("d149_schedule_topic", MODE_PRIVATE)
        if (prefs.getBoolean("subscribed", false)) return
        FirebaseMessaging.getInstance().subscribeToTopic(OperatingScheduleStore.FCM_TOPIC)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) prefs.edit().putBoolean("subscribed", true).apply()
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

    private fun drainOverlayAcknowledgements() {
        // D167: never replay a PDA's ACK for a different account. The old
        // unscoped queue is retained for safe recovery, not auto-attributed.
        val owner = api.session ?: return
        if (overlayAckDrainRunning || owner.role != "PICKER") return
        val events = NotificationSignalStore.pendingOverlayAcks(applicationContext, owner.userId)
        if (events.isEmpty()) return
        overlayAckDrainRunning = true
        Thread {
            try {
                for (eventId in events) {
                    if (api.session?.userId != owner.userId) break
                    try {
                        api.acknowledgeResult(eventId)
                        NotificationSignalStore.clearOverlayAck(applicationContext, eventId, owner.userId)
                    } catch (error: ApiException) {
                        if (error.httpStatus == 404 && error.code == "RESULT_ACK_NOT_FOUND") {
                            // Permanent/not-authorized-to-this-user result: preserve
                            // evidence, avoid another 60-second retry storm.
                            // Do not claim that the server recorded this ACK.
                            NotificationSignalStore.quarantineOverlayAck(
                                applicationContext, eventId, owner.userId, "RESULT_ACK_NOT_FOUND"
                            )
                        }
                        // All transient failures remain pending for session/network recovery.
                    } catch (_: Exception) {
                        // Keep the ACK pending; no extra request or timer.
                    }
                }
            } finally {
                runOnUiThread {
                    overlayAckDrainRunning = false
                    if (!isFinishing && !isDestroyed && api.session?.userId == owner.userId) {
                        pickerController?.refresh()
                    }
                }
            }
        }.start()
    }

    private fun logoutWithNotificationCleanup(message: String = "Đã đăng xuất.") {
        if (logoutRunning) return
        logoutRunning = true
        findViewById<View>(R.id.btnLogout)?.isEnabled = false
        val logoutLoading = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(kit.dp(20), kit.dp(12), kit.dp(20), kit.dp(12))
            addView(ProgressBar(this@MainActivity), LinearLayout.LayoutParams(kit.dp(34), kit.dp(34)))
            addView(TextView(this@MainActivity).apply {
                text = "Đang đăng xuất…"
                textSize = 14f
                setPadding(kit.dp(12), 0, 0, 0)
            })
        }
        val logoutDialog = AlertDialog.Builder(this)
            .setView(logoutLoading)
            .setCancelable(false)
            .create()
        if (!safelyShowDialog(logoutDialog)) { logoutRunning = false; return }

        operatingWindowTask?.let { uiHandler.removeCallbacks(it) }
        operatingWindowTask = null
        uiHandler.removeCallbacks(runtimeLogTick)

        val endingSession = api.session
        val sessionEndPayload = if (endingSession != null) {
            try {
                JSONObject(buildSupportDiagnostics())
                    .put("session_end_message", sanitizeDiagnosticText(message))
                    .put("session_end_user_id", endingSession.userId.take(128))
            } catch (_: Exception) {
                JSONObject()
                    .put("session_end_message", sanitizeDiagnosticText(message))
                    .put("session_end_user_id", endingSession.userId.take(128))
            }
        } else null

        if (endingSession != null && sessionEndPayload != null) {
            ensureAndroidRuntimeLogIdentity(sessionEndPayload, "session_end_logout")
            savePendingSessionEndRuntimeLog(endingSession, sessionEndPayload)
        }

        stopOperationalClients()
        Thread {
            if (endingSession != null && sessionEndPayload != null) {
                val sent = uploadAndroidRuntimeLog("INFO", "session_end_logout", sessionEndPayload)
                if (sent.archiveStatus == "DRIVE_SYNCED") {
                    runtimeLogPrefs().edit()
                        .remove("pending_session_end_user")
                        .remove("pending_session_end_payload")
                        .apply()
                }
                // Otherwise the synchronously persisted final bundle remains
                // pending and is retried only by the existing bounded same-user
                // login/resume delivery path.
            }
            try { api.unregisterNotificationDevice(notificationDeviceId) } catch (_: Exception) { }
            try { api.logoutInteractive("android:$notificationDeviceId") } catch (_: Exception) { api.clearSession() }
            runOnUiThread {
                logoutRunning = false
                logoutDialog.dismiss()
                renderLogin(message)
            }
        }.start()
    }

    private fun scheduleAndroidOperatingWindowCheck(session: AppSession) {
        if (operatingWindowCheckRunning || api.session == null) return

        // Login/refresh already carries the schedule. Consume it locally with no
        // second request whenever available.
        api.lastOperatingWindow?.let { window ->
            OperatingScheduleStore.applyWorkerWindow(applicationContext, window)
            applyOperatingSchedulePresentation()
            return
        }

        // Restored process/session: one Worker reconciliation only. D149 removes
        // the former five-minute retry loop and shift-close auto logout.
        operatingWindowCheckRunning = true
        Thread {
            try {
                val window = api.getAndroidOperatingWindow()
                OperatingScheduleStore.applyWorkerWindow(applicationContext, window)
                runOnUiThread {
                    operatingWindowCheckRunning = false
                    if (api.session == null || activeSession?.userId != session.userId) return@runOnUiThread
                    applyOperatingSchedulePresentation()
                }
            } catch (_: Exception) {
                runOnUiThread {
                    operatingWindowCheckRunning = false
                    if (api.session == null || activeSession?.userId != session.userId) return@runOnUiThread
                    // Do not fabricate logout or start a retry timer. PickList has
                    // one exact Firestore fallback when Worker is actually unavailable.
                    applyOperatingSchedulePresentation()
                }
            }
        }.start()
    }

    private fun applyOperatingSchedulePresentation() {
        if (api.session == null) return
        val open = OperatingScheduleStore.isOpen(applicationContext)
        pickerController?.applyOperatingScheduleState(open)
        if (!open) {
            setStatus("Ca nghiệp vụ đang nghỉ. App vẫn đăng nhập và sẽ tự nhận khi Agent mở tăng ca.")
        }
    }

    private fun startRealtime(session: AppSession) {
        realtimeClient?.stop()
        realtimeClient = AndroidRealtimeClient(
            context = applicationContext,
            api = api,
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
            userId = session.userId,
            log = { message -> recordLog(message) },
        ) { scopes, events, completion ->
            runOnUiThread {
                if (api.session == null || isFinishing) {
                    completion(false)
                    return@runOnUiThread
                }

                val reportingEnabledEvent = scopes.contains("picker_reporting_enabled")
                val reportingDisabledEvent = scopes.contains("picker_reporting_disabled")
                if (session.role == "PICKER" && (reportingEnabledEvent || reportingDisabledEvent)) {
                    // D161: event scope is only a wake-up hint. Reconcile the
                    // authoritative boolean + revision instead of applying an
                    // unversioned realtime value that could overwrite a newer state.
                    syncEffectiveRole()
                }
                val capabilityScopes = setOf("picker_reporting_enabled", "picker_reporting_disabled")
                val afterCapability = scopes.filterNot { it in capabilityScopes }.toSet()
                val catalogChanged = afterCapability.contains("sku_catalog")
                val remainingScopes = if (catalogChanged) afterCapability.filterNot { it == "sku_catalog" }.toSet() else afterCapability
                val applyRemaining: (Boolean) -> Unit = { catalogOk ->
                    if (!catalogOk) {
                        completion(false)
                    } else if (remainingScopes.isEmpty()) {
                        completion(true)
                    } else if (session.role == "PICKER") {
                        val controller = pickerController
                        if (controller != null) controller.onRealtime(remainingScopes, events, completion) else completion(true)
                    } else {
                        val controller = reporterController
                        if (controller != null) controller.onRealtime(remainingScopes, events, completion) else completion(true)
                    }
                }

                val skipCatalogForDisabledPicker =
                    session.role == "PICKER" && api.session?.shortageReportingEnabled == false
                if (catalogChanged && !skipCatalogForDisabledPicker) syncSkuCatalogAsync("realtime", applyRemaining)
                else applyRemaining(true)
            }
        }.also { it.start() }
    }

    private fun friendlyError(error: Exception): String {
        if (error is ApiException) {
            return when (error.code) {
                "ALREADY_REPORTED" -> "SKU này đang có báo chưa xử lý của bạn."
                "PICKER_SHORTAGE_REPORTING_DISABLED" -> "Báo hàng đang tắt cho tài khoản này."
                "ANDROID_WINDOW_CLOSED" -> "Ca nghiệp vụ đang nghỉ. Agent cần bật tăng ca/bật sớm trước khi Báo hàng."
                "SKU_NOT_FOUND" -> "SKU không tồn tại trong Master SKU."
                "WITHDRAW_WINDOW_EXPIRED" -> "Đã hết 60 giây cho phép thu hồi."
                "TICKET_NOT_OPEN" -> "Báo này đã được xử lý hoặc thu hồi."
                "BATCH_NOT_PENDING" -> "Đợt này đã được người khác xử lý."
                "CORRECTION_DISABLED" -> "Chức năng đổi Skip thành Đã có hàng đang tắt."
                "CORRECTION_WINDOW_EXPIRED" -> "Đã hết thời gian cho phép đổi Skip thành Đã có hàng."
                "BATCH_NOT_CORRECTABLE" -> "Đợt này không còn ở trạng thái cho phép sửa."
                "RESULT_CORRECTION_DISABLED" -> "Web đang tắt cho phép sửa kết quả hoặc kết quả này chưa có thời hạn sửa hợp lệ."
                "RESULT_CORRECTION_EXPIRED" -> "Đã hết thời gian cho phép sửa kết quả."
                "SKIP_CORRECTION_DISABLED" -> "Web đang tắt cho phép sửa kết quả Skip."
                "SKIP_CORRECTION_EXPIRED" -> "Đã hết thời gian cho phép sửa kết quả Skip."
                "BATCH_VERSION_CONFLICT" -> "Trạng thái SKU vừa thay đổi trên thiết bị khác. Tải lại và thử lại."
                "RESULT_ACK_NOT_FOUND" -> "Kết quả cần xác nhận không còn hợp lệ cho tài khoản này."
                "USER_NOT_ACTIVE" -> "Tài khoản đã dừng hoạt động."
                "FORBIDDEN" -> "Tài khoản không có quyền thực hiện thao tác này."
                "CLIENT_ROLE_NOT_ALLOWED" -> "Tài khoản này không được phép dùng kênh App/PDA hiện tại."
                "SESSION_REPLACED" -> "Tài khoản đã đăng nhập ở nơi khác. Phiên trên thiết bị này đã kết thúc."
                "SESSION_UPGRADE_REQUIRED" -> "Phiên cũ cần đăng nhập lại một lần để áp dụng cơ chế phiên mới."
                "INVALID_CREDENTIALS" -> "Tài khoản hoặc mật khẩu không đúng."
                "FIREBASE_LOGIN_EXCHANGE_FAILED" -> "Không thể hoàn tất đăng nhập. Vui lòng thử lại."
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
        val minimumVersionCode: Int,
        val tag: String,
        val apkUrl: String,
        val checksumUrl: String,
        val releaseNotes: List<String>,
    )

    private fun updateGateMessage(): String = when (updateGate) {
        UpdateGate.CHECKING -> "Đang kiểm tra bản cập nhật nền. Vẫn có thể đăng nhập."
        UpdateGate.CURRENT -> "Đang dùng bản Beta mới nhất."
        UpdateGate.REQUIRED -> "Có bản cập nhật Beta mới."
        UpdateGate.MANDATORY -> "Bắt buộc cập nhật Beta trước khi đăng nhập mới."
        UpdateGate.DEFERRED -> "Chưa kiểm tra được kênh cập nhật. Có thể tiếp tục đăng nhập."
        UpdateGate.FAILED -> "Không xác minh được chữ ký ứng dụng đang cài. Đăng nhập đã bị chặn."
    }

    private fun applyUpdateGateUi(message: String? = null) {
        loginButton?.isEnabled = updateGate != UpdateGate.FAILED &&
            updateGate != UpdateGate.MANDATORY && !logoutRunning
        loginProgress?.visibility = if (logoutRunning) View.VISIBLE else View.GONE
        if (::updateButton.isInitialized) {
            updateButton.isEnabled = !updateCheckRunning
            updateButton.text = when (updateGate) {
                UpdateGate.REQUIRED, UpdateGate.MANDATORY -> "Cập nhật"
                UpdateGate.DEFERRED -> "Thử lại"
                UpdateGate.FAILED -> "Kiểm tra an toàn"
                else -> if (updateCheckRunning) "Đang kiểm tra…" else "Kiểm tra cập nhật"
            }
        }
        if (api.session == null && updateGate == UpdateGate.CURRENT && !updateCheckRunning && message.isNullOrBlank()) {
            if (::status.isInitialized) status.visibility = View.GONE
            return
        }
        if (!message.isNullOrBlank()) setStatus(message)
    }

    private fun checkForUpdate(silent: Boolean) {
        if (!::updateButton.isInitialized || updateCheckRunning) return
        updateCheckRunning = true
        lastUpdateCheckElapsedMs = android.os.SystemClock.elapsedRealtime()
        updateGate = if (mandatoryUpdateKnown()) UpdateGate.MANDATORY else UpdateGate.CHECKING
        pendingUpdateInfo = null
        applyUpdateGateUi(if (!silent) "Đang kiểm tra bản cập nhật Beta..." else null)
        Thread {
            try {
                try {
                    verifyInstalledSignerTrusted()
                } catch (integrity: Exception) {
                    updateGate = UpdateGate.FAILED
                    runOnUiThread {
                        updateCheckRunning = false
                        if (restoringSessionScreen) updateButton.visibility = View.VISIBLE
                        applyUpdateGateUi("Không xác minh được chữ ký ứng dụng đang cài. Đăng nhập đã bị chặn.")
                        recordLog("UPDATE_INTEGRITY_FAILED: ${integrity.message}")
                    }
                    return@Thread
                }

                val info = try {
                    fetchLatestUpdate()
                } catch (channel: Exception) {
                    updateGate = if (mandatoryUpdateKnown()) UpdateGate.MANDATORY else UpdateGate.DEFERRED
                    runOnUiThread {
                        updateCheckRunning = false
                        if (restoringSessionScreen) updateButton.visibility = View.VISIBLE
                        applyUpdateGateUi(if (mandatoryUpdateKnown()) "Chưa kiểm tra lại được phiên bản bắt buộc. Cần cập nhật theo chính sách đã xác minh." else if (!silent) "Không kết nối được kênh cập nhật. Có thể tiếp tục sử dụng bản hiện tại." else null)
                        recordLog("UPDATE_CHECK_DEFERRED: ${channel.message}")
                        if (restoringSessionScreen && api.session != null) {
                            tryRestoreSessionAfterUpdateCheck()
                        }
                    }
                    return@Thread
                }

                verifiedMinimumVersionCode = info.minimumVersionCode
                getSharedPreferences("d166_update_floor", MODE_PRIVATE).edit()
                    .putInt("verified_minimum_version_code", verifiedMinimumVersionCode).apply()
                if (info.versionCode <= BuildConfig.VERSION_CODE) {
                    cleanupUpdateArtifacts()
                    updateGate = if (info.versionCode == BuildConfig.VERSION_CODE) UpdateGate.CURRENT else UpdateGate.DEFERRED
                    val restored = if (api.session != null) {
                        try { api.refreshProfile() } catch (_: Exception) { null }
                    } else null
                    runOnUiThread {
                        updateCheckRunning = false
                        when {
                            restored != null -> renderHome(restored)
                            api.session != null -> renderHome(api.session!!)
                            restoringSessionScreen -> renderLogin("Phiên đăng nhập cần xác thực lại.")
                            else -> applyUpdateGateUi(if (!silent && updateGate == UpdateGate.CURRENT) "Đang dùng bản Beta mới nhất." else null)
                        }
                    }
                    return@Thread
                }

                pendingUpdateInfo = info
                updateGate = if (mandatoryUpdateKnown()) UpdateGate.MANDATORY else UpdateGate.REQUIRED
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi("Có bản cập nhật ${info.tag}.")
                    showUpdateAvailable(info)
                }
            } catch (error: Exception) {
                updateGate = if (mandatoryUpdateKnown()) UpdateGate.MANDATORY else UpdateGate.DEFERRED
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi(if (mandatoryUpdateKnown()) "Chưa thể xác minh lại bản cập nhật bắt buộc." else if (!silent) "Kiểm tra cập nhật chưa hoàn tất. Có thể tiếp tục sử dụng bản hiện tại." else null)
                    recordLog("UPDATE_CHECK_DEFERRED: ${error.message}")
                }
            }
        }.start()
    }

    private fun tryRestoreSessionAfterUpdateCheck() {
        if (!restoringSessionScreen) return
        val restored = api.session
        if (restored != null) renderHome(restored) else renderLogin("Phiên đăng nhập cần xác thực lại.")
    }

    private fun showUpdateAvailable(info: UpdateInfo) {
        pendingUpdateInfo = info
        val mandatory = info.minimumVersionCode > BuildConfig.VERSION_CODE
        val builder = AlertDialog.Builder(this)
            .setTitle(if (mandatory) "Bắt buộc cập nhật ${info.tag}" else "Có bản cập nhật ${info.tag}")
            .setMessage(
                buildString {
                    append(if (mandatory)
                        "Đây là bản cập nhật bắt buộc đã được hệ thống xác minh. Để tránh mất xác nhận Picklist/ACK đang thực hiện, phiên làm việc hiện tại không bị ngắt giữa chừng. Cần cập nhật trước lần đăng nhập mới."
                        else "Cập nhật ngay hoặc để sau. Bản cập nhật này chưa bắt buộc.")
                    if (info.releaseNotes.isNotEmpty()) {
                        append("\n\nNội dung cập nhật:\n")
                        info.releaseNotes.forEach { append("• ").append(it).append("\n") }
                    }
                }.trimEnd()
            )
            .setPositiveButton("Cập nhật") { _, _ -> downloadAndInstallUpdate(info) }
        if (mandatory) {
            // Existing authenticated PDA sessions must finish ACK before
            // downloading/restarting; do not create a forced activity kill.
            if (api.session != null) builder.setNegativeButton("Tiếp tục phiên hiện tại") { _, _ ->
                applyUpdateGateUi("Cần cập nhật trước lần đăng nhập tiếp theo.")
            }
            else builder.setCancelable(false)
        } else {
            builder.setNegativeButton("Để sau") { _, _ ->
                updateGate = UpdateGate.DEFERRED
                applyUpdateGateUi(null)
            }
        }
        safelyShowDialog(builder.create())
    }

    private fun downloadAndInstallUpdate(info: UpdateInfo) {
        if (updateCheckRunning) return
        updateCheckRunning = true
        applyUpdateGateUi("Đang tải và kiểm tra ${info.tag}...")
        Thread {
            try {
                val apk = downloadAndVerify(info)
                runOnUiThread {
                    updateCheckRunning = false
                    pendingUpdateInfo = null
                    applyUpdateGateUi("Đã xác minh ${info.tag}. Đang mở trình cài đặt.")
                    requestInstall(apk)
                }
            } catch (error: Exception) {
                updateGate = if (mandatoryUpdateKnown()) UpdateGate.MANDATORY else UpdateGate.DEFERRED
                runOnUiThread {
                    updateCheckRunning = false
                    applyUpdateGateUi(if (mandatoryUpdateKnown())
                        "Cập nhật bắt buộc chưa hoàn tất. Hãy thử lại; phiên đang chạy không bị ngắt."
                        else "Không thể hoàn tất cập nhật. Có thể tiếp tục sử dụng bản hiện tại.")
                    // Strict structured diagnostics, never record exception
                    // messages, download URLs or credentials.
                    recordLog("UPDATE_DOWNLOAD_FAILED: " + error.javaClass.simpleName)
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
        val minimumVersionCode = manifest.optInt("minimum_version_code", 0).coerceAtLeast(0)
        if (!tag.matches(Regex("^beta-vc\\d+$")) || versionCode <= 0 || tag != "beta-vc$versionCode") {
            throw IllegalStateException("Kênh cập nhật Beta không hợp lệ.")
        }
        val apkPath = manifest.optString("apk_path")
        val checksumPath = manifest.optString("checksum_path")
        if (!apkPath.startsWith("/") || !checksumPath.startsWith("/")) {
            throw IllegalStateException("Kênh cập nhật thiếu đường dẫn tin cậy.")
        }
        val notesJson = manifest.optJSONArray("release_notes")
        val notes = buildList {
            if (notesJson != null) {
                for (index in 0 until minOf(notesJson.length(), 5)) {
                    val text = notesJson.optString(index).replace(Regex("[\\r\\n\\t]+"), " ").trim().take(180)
                    if (text.isNotBlank()) add(text)
                }
            }
        }
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        if (minimumVersionCode > versionCode) throw IllegalStateException("Phiên bản bắt buộc chưa có bản phát hành phù hợp.")
        return UpdateInfo(versionCode, minimumVersionCode, tag, base + apkPath, base + checksumPath, notes)
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
            setStatus("Cần cấp quyền cài ứng dụng không rõ nguồn gốc một lần cho 1291 Báo hàng Beta.")
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
