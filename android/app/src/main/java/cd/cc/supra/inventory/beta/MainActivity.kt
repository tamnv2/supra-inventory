package cd.cc.supra.inventory.beta

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
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
        reporterController = null
        val root = kit.page()
        kit.addOperationalHeader(root, session, onLog = { showLocalLog() }, onExit = { confirmLogout() })
        status = kit.createStatusView()
        root.addView(status)
        when (session.role) {
            "PICKER" -> {
                pickerController = PickerController(this, api, skuCache, kit, ::setStatus, ::friendlyError)
                    .also { it.render(root) }
            }
            "REPORTER", "ADMIN", "ROOT" -> {
                reporterController = ReporterController(this, api, kit, ::setStatus, ::friendlyError)
                    .also { it.render(root) }
            }
            else -> root.addView(kit.muted("Vai trò ${session.role} chưa được hỗ trợ trên PDA."))
        }
        kit.addFooter(root)
        setContentView(kit.wrapScroll(root))
        startRealtime(session)
        registerBackgroundNotifications()
        recordLog("Đăng nhập ${kit.roleLabel(session.role)}: ${session.employeeCode ?: session.displayName}")
    }

    private fun addBrandHeader(root: LinearLayout, subtitle: String) = kit.addBrandHeader(root, subtitle)

    private fun stopOperationalClients() {
        pickerController?.destroy()
        pickerController = null
        reporterController = null
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

    private fun showLocalLog() {
        val content = if (localLog.isEmpty()) "Chưa có log trong phiên làm việc này." else localLog.joinToString("\n")
        val scroll = ScrollView(this).apply {
            addView(TextView(this@MainActivity).apply {
                text = content
                textSize = 12f
                setTextColor(kit.text)
                setPadding(kit.dp(14), kit.dp(8), kit.dp(14), kit.dp(8))
            })
        }
        AlertDialog.Builder(this)
            .setTitle("Log phiên làm việc")
            .setView(scroll)
            .setNegativeButton("Xoá log") { _, _ -> localLog.clear() }
            .setPositiveButton("Đóng", null)
            .show()
    }

    private fun recordLog(message: String) {
        if (localLog.size >= 80) localLog.removeFirst()
        localLog.addLast("${logTime.format(Instant.now())} · $message")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            "inventory_operations",
            "SUPRA Inventory · Nghiệp vụ",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = "Cảnh báo báo hàng khi ứng dụng chạy nền" }
        manager.createNotificationChannel(channel)
    }

    private fun registerBackgroundNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 701)
        }
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val token = if (task.isSuccessful) task.result else null
            if (token.isNullOrBlank() || api.session == null) return@addOnCompleteListener
            Thread {
                try { api.registerNotificationDevice(notificationDeviceId, token) } catch (_: Exception) { }
            }.start()
        }
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
            api = api,
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
        ) { scopes ->
            runOnUiThread {
                if (api.session == null || isFinishing) return@runOnUiThread
                if (session.role == "PICKER") pickerController?.onRealtime(scopes)
                else reporterController?.onRealtime(scopes)
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
                val info = fetchLatestUpdate()
                if (info.versionCode <= BuildConfig.VERSION_CODE) {
                    updateGate = UpdateGate.CURRENT
                    runOnUiThread {
                        updateCheckRunning = false
                        applyUpdateGateUi(if (api.session == null) "Sẵn sàng đăng nhập." else if (!silent) "Đang dùng bản mới nhất." else null)
                    }
                    return@Thread
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

    private fun downloadAndVerify(info: UpdateInfo): File {
        val expected = downloadText(info.checksumUrl).trim().split(Regex("\\s+"))[0].lowercase()
        if (!expected.matches(Regex("[0-9a-f]{64}"))) throw IllegalStateException("Checksum không hợp lệ.")
        val dir = File(getExternalFilesDir(null), "updates").apply { mkdirs() }
        val temp = File(dir, "supra-inventory-beta.apk.download")
        val target = File(dir, "supra-inventory-beta.apk")
        downloadFile(info.apkUrl, temp)
        if (sha256(temp) != expected) {
            temp.delete()
            throw IllegalStateException("SHA-256 APK không khớp.")
        }
        if (target.exists()) target.delete()
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

    private fun openDownloadConnection(url: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 60_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
        }

    private fun downloadText(url: String): String {
        val connection = openDownloadConnection(url)
        if (connection.responseCode !in 200..299) throw IllegalStateException("Checksum HTTP ${connection.responseCode}")
        return connection.inputStream.bufferedReader().use { it.readText() }
    }

    private fun downloadFile(url: String, file: File) {
        val connection = openDownloadConnection(url)
        if (connection.responseCode !in 200..299) throw IllegalStateException("APK HTTP ${connection.responseCode}")
        connection.inputStream.use { input -> file.outputStream().use { output -> input.copyTo(output, 64 * 1024) } }
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
