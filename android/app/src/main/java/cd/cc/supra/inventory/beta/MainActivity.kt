package cd.cc.supra.inventory.beta

import android.app.Activity
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {
    private lateinit var status: TextView
    private var idToken: String? = null
    private var refreshToken: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 56, 40, 40)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        val title = TextView(this).apply { text = "SUPRA Inventory — Beta"; textSize = 24f }
        val username = EditText(this).apply { hint = "Tên đăng nhập"; setText("root"); inputType = InputType.TYPE_CLASS_TEXT }
        val password = EditText(this).apply { hint = "Mật khẩu"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        val login = Button(this).apply { text = "Đăng nhập" }
        val logout = Button(this).apply { text = "Đăng xuất"; isEnabled = false }
        status = TextView(this).apply { text = "Khởi tạo..." }
        root.addView(title); root.addView(username); root.addView(password); root.addView(login); root.addView(logout); root.addView(status)
        setContentView(root)

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
    }

    private data class SessionResult(
        val idToken: String,
        val refreshToken: String,
        val displayName: String,
        val role: String,
    )

    private fun requestSession(username: String, password: String): SessionResult {
        val connection = (URL("${BuildConfig.API_BASE_URL}/api/auth/login").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }
        val body = JSONObject().put("username", username).put("password", password).toString()
        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val payload = try {
            JSONObject(text)
        } catch (_: Exception) {
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
}
