package cd.cc.supra.obpp1291

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

/** Only two PDAs: checks when opened/manual. No background polling, push or inventory OTA. */
object ObppUpdateManager {
    private const val MANIFEST_URL =
        "https://github.com/tamnv2/supra-inventory/releases/download/obpp1291-latest/obpp1291-latest.json"
    private const val PACKAGE = "cd.cc.supra.obpp1291"
    private val shaPattern = Regex("[a-fA-F0-9]{64}")

    fun check(activity: Activity, manual: Boolean) {
        thread(name = "OBPP-Github-Update") {
            try {
                val connection = URL(MANIFEST_URL).openConnection() as HttpURLConnection
                connection.connectTimeout = 10000
                connection.readTimeout = 15000
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("User-Agent", "SUPRA-OBPP1291-Update/1")
                val json = try {
                    if (connection.responseCode != 200) throw IllegalStateException("Chưa có bản phát hành GitHub")
                    JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
                } finally { connection.disconnect() }
                val version = json.optInt("version_code", 0)
                val targetPackage = json.optString("package_name")
                val sha = json.optString("sha256").lowercase()
                val apkUrl = json.optString("apk_url")
                require(targetPackage == PACKAGE && shaPattern.matches(sha) && version > 0) {
                    "Thông tin phiên bản GitHub không hợp lệ"
                }
                val host = URL(apkUrl)
                require(host.protocol == "https" &&
                    host.host in setOf("github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com")) {
                    "Địa chỉ APK không hợp lệ"
                }
                if (version <= BuildConfig.VERSION_CODE) {
                    if (manual) activity.runOnUiThread {
                        AlertDialog.Builder(activity).setMessage("App đang dùng phiên bản mới nhất.")
                            .setPositiveButton("Đóng", null).show()
                    }
                    return@thread
                }
                activity.runOnUiThread {
                    AlertDialog.Builder(activity)
                        .setTitle("Có bản cập nhật OB × PP 1291")
                        .setMessage("Phiên bản hiện tại: " + BuildConfig.VERSION_NAME +
                            "\nPhiên bản mới: " + json.optString("version_name") +
                            "\nỨng dụng sẽ tải APK chính thức từ GitHub.")
                        .setNegativeButton("Để sau", null)
                        .setPositiveButton("Tải và cập nhật") { _, _ ->
                            downloadAndInstall(activity, apkUrl, sha)
                        }.show()
                }
            } catch (_: Exception) {
                if (manual) activity.runOnUiThread {
                    AlertDialog.Builder(activity).setMessage("Chưa kiểm tra được phiên bản trên GitHub.")
                        .setPositiveButton("Đóng", null).show()
                }
            }
        }
    }

    private fun downloadAndInstall(activity: Activity, url: String, expectedSha: String) {
        thread(name = "OBPP-Github-Download") {
            var file: File? = null
            try {
                val target = File(activity.cacheDir, "obpp1291-update.apk")
                file = target
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.connectTimeout = 12000
                connection.readTimeout = 30000
                connection.setRequestProperty("User-Agent", "SUPRA-OBPP1291-Update/1")
                try {
                    require(connection.responseCode == 200) { "APK chưa sẵn sàng" }
                    val digest = MessageDigest.getInstance("SHA-256")
                    connection.inputStream.use { input ->
                        target.outputStream().use { output ->
                            val buffer = ByteArray(16384)
                            var total = 0L
                            while (true) {
                                val count = input.read(buffer)
                                if (count < 0) break
                                total += count
                                require(total <= 100L * 1024 * 1024) { "APK quá lớn" }
                                digest.update(buffer, 0, count)
                                output.write(buffer, 0, count)
                            }
                        }
                    }
                    val actualSha = digest.digest().joinToString("") { "%02x".format(it) }
                    require(actualSha == expectedSha) { "SHA-256 APK không khớp" }
                } finally { connection.disconnect() }
                val apkUri: Uri = FileProvider.getUriForFile(activity, PACKAGE + ".fileprovider", target)
                activity.runOnUiThread {
                    val install = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(apkUri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    try { activity.startActivity(install) } catch (_: Exception) {
                        AlertDialog.Builder(activity).setMessage("Chưa mở được trình cài APK. Kiểm tra quyền cài ứng dụng.")
                            .setPositiveButton("Đóng", null).show()
                    }
                }
            } catch (_: Exception) {
                file?.delete()
                activity.runOnUiThread {
                    AlertDialog.Builder(activity).setMessage("Tải/cập nhật không thành công. Bản hiện tại được giữ nguyên.")
                        .setPositiveButton("Đóng", null).show()
                }
            }
        }
    }
}
