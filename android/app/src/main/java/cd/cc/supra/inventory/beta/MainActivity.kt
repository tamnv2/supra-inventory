package cd.cc.supra.inventory.beta

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.FileProvider
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var updateButton: Button
    private var idToken: String? = null
    private var refreshToken: String? = null
    private var pendingInstallFile: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 56, 40, 40)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        val title = TextView(this).apply { text = "SUPRA Inventory — Beta"; textSize = 24f }
        val version = TextView(this).apply { text = "Phiên bản ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) — Android 11+"; textSize = 13f }
        val username = EditText(this).apply { hint = "Tên đăng nhập"; setText("root"); inputType = InputType.TYPE_CLASS_TEXT }
        val password = EditText(this).apply { hint = "Mật khẩu"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        val login = Button(this).apply { text = "Đăng nhập" }
        val logout = Button(this).apply { text = "Đăng xuất"; isEnabled = false }
        updateButton = Button(this).apply { text = "Kiểm tra cập nhật" }
        status = TextView(this).apply { text = "Khởi tạo..." }
        root.addView(title); root.addView(version); root.addView(username); root.addView(password); root.addView(login); root.addView(logout); root.addView(updateButton); root.addView(status)
        setContentView(root)

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            status.text = "Thiết bị cần Android 11 trở lên."
            login.isEnabled = false
            updateButton.isEnabled = false
            return
        }
        if (BuildConfig.FIREBASE_API_KEY.isBlank()) {
            status.text = "Thiếu FIREBASE_API_KEY_BETA."
            login.isEnabled = false
            return
        }
        val options = FirebaseOptions.Builder()
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setApplicationId(BuildConfig.FIREBASE_APP_ID)
            .setGcmSenderId(BuildConfig.FIREBASE_MESSAGING_SENDER_ID)
            .build()
        if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this, options)
        status.text = "Sẵn sàng đăng nhập Beta."

        login.setOnClickListener {
            val user = username.text.toString().trim().lowercase()
            val pass = password.text.toString()
            if (!user.matches(Regex("[a-z0-9._-]{1,64}")) || pass.isBlank()) {
                status.text = "Tên đăng nhập hoặc mật khẩu không hợp lệ."
                return@setOnClickListener
            }
            login.isEnabled = false
            status.text = "Đang đăng nhập..."
            Thread {
                try {
                    val session = requestSession(user, pass)
                    idToken = session.idToken
                    refreshToken = session.refreshToken
                    runOnUiThread {
                        status.text = "Đăng nhập thành công. ${session.displayName} (${session.role})"
                        logout.isEnabled = true
                        login.isEnabled = true
                    }
                } catch (error: Exception) {
                    runOnUiThread {
                        status.text = error.message ?: "Đăng nhập thất bại."
                        login.isEnabled = true
                    }
                }
            }.start()
        }
        logout.setOnClickListener {
            idToken = null
            refreshToken = null
            logout.isEnabled = false
            status.text = "Đã đăng xuất."
        }
        updateButton.setOnClickListener { checkForUpdate(silent = false) }
        checkForUpdate(silent = true)
    }

    override fun onResume() {
        super.onResume()
        val pending = pendingInstallFile ?: return
        if (packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = null
            launchInstaller(pending)
        }
    }

    private data class SessionResult(
        val idToken: String,
        val refreshToken: String,
        val displayName: String,
        val role: String,
    )

    private data class UpdateInfo(
        val versionCode: Int,
        val tag: String,
        val apkUrl: String,
        val checksumUrl: String,
    )

    private fun requestSession(username: String, password: String): SessionResult {
        val connection = openJsonConnection("${BuildConfig.API_BASE_URL}/api/auth/login", "POST")
        val body = JSONObject().put("username", username).put("password", password).toString()
        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val payload = try { JSONObject(text) } catch (_: Exception) {
            throw IllegalStateException("API trả dữ liệu không hợp lệ (HTTP $code).")
        }
        if (code !in 200..299) {
            throw IllegalStateException(payload.optString("message", payload.optString("error", "HTTP $code")))
        }
        val idToken = payload.optString("id_token")
        val refreshToken = payload.optString("refresh_token")
        if (idToken.isBlank() || refreshToken.isBlank()) throw IllegalStateException("Phiên đăng nhập trả về không đầy đủ.")
        val user = payload.optJSONObject("user") ?: JSONObject()
        return SessionResult(
            idToken = idToken,
            refreshToken = refreshToken,
            displayName = user.optString("display_name", username),
            role = user.optString("role", "AUTH"),
        )
    }

    private fun checkForUpdate(silent: Boolean) {
        updateButton.isEnabled = false
        if (!silent) status.text = "Đang kiểm tra phiên bản mới..."
        Thread {
            try {
                val info = fetchLatestUpdate()
                if (info == null || info.versionCode <= BuildConfig.VERSION_CODE) {
                    runOnUiThread {
                        updateButton.isEnabled = true
                        if (!silent) status.text = "Đang dùng bản mới nhất."
                    }
                    return@Thread
                }
                runOnUiThread { status.text = "Có bản mới ${info.tag}. Đang tải và kiểm tra..." }
                val apk = downloadAndVerify(info)
                runOnUiThread {
                    updateButton.isEnabled = true
                    requestInstall(apk)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    updateButton.isEnabled = true
                    if (!silent) status.text = "Không kiểm tra được cập nhật: ${error.message ?: "unknown"}"
                }
            }
        }.start()
    }

    private fun fetchLatestUpdate(): UpdateInfo? {
        val connection = openJsonConnection(BuildConfig.UPDATE_RELEASE_API, "GET")
        val code = connection.responseCode
        if (code == 404) return null
        val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (code !in 200..299) throw IllegalStateException("Update API HTTP $code")
        val release = JSONObject(text)
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

    private fun downloadAndVerify(info: UpdateInfo): File {
        val expected = downloadText(info.checksumUrl).trim().split(Regex("\\s+"))[0].lowercase()
        if (!expected.matches(Regex("[0-9a-f]{64}"))) throw IllegalStateException("Checksum bản cập nhật không hợp lệ.")
        val dir = File(getExternalFilesDir(null), "updates").apply { mkdirs() }
        val temp = File(dir, "supra-inventory-beta.apk.download")
        val target = File(dir, "supra-inventory-beta.apk")
        downloadFile(info.apkUrl, temp)
        val actual = sha256(temp)
        if (actual != expected) {
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
            status.text = "Cần cấp quyền cài ứng dụng không rõ nguồn gốc một lần cho SUPRA Inventory Beta."
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
        status.text = "Đã tải xong. Đang mở trình cài bản cập nhật..."
        startActivity(intent)
    }

    private fun openJsonConnection(url: String, method: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 30_000
            instanceFollowRedirects = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
            if (method == "POST") {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }

    private fun downloadText(url: String): String {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 30_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
        }
        if (connection.responseCode !in 200..299) throw IllegalStateException("Checksum HTTP ${connection.responseCode}")
        return connection.inputStream.bufferedReader().use { it.readText() }
    }

    private fun downloadFile(url: String, file: File) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 60_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
        }
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
}
