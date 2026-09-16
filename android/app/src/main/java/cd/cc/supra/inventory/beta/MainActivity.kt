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
import com.google.firebase.auth.FirebaseAuth

class MainActivity : Activity() {
    private var auth: FirebaseAuth? = null
    private lateinit var status: TextView

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

        root.addView(title)
        root.addView(username)
        root.addView(password)
        root.addView(login)
        root.addView(logout)
        root.addView(status)
        setContentView(root)

        if (BuildConfig.FIREBASE_API_KEY.isBlank()) {
            status.text = "Thiếu FIREBASE_API_KEY_BETA. Source APK đã bootstrap nhưng Auth chưa thể hoạt động."
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
        auth = FirebaseAuth.getInstance()
        status.text = "Sẵn sàng đăng nhập Beta."

        login.setOnClickListener {
            val rawUsername = username.text.toString().trim().lowercase()
            if (!rawUsername.matches(Regex("[a-z0-9._-]{1,64}"))) {
                status.text = "Tên đăng nhập không hợp lệ."
                return@setOnClickListener
            }
            val email = "$rawUsername@auth.supra-inventory.local"
            status.text = "Đang đăng nhập..."
            auth?.signInWithEmailAndPassword(email, password.text.toString())
                ?.addOnSuccessListener {
                    status.text = "Đăng nhập Firebase thành công. UID=${it.user?.uid ?: ""}"
                    logout.isEnabled = true
                }
                ?.addOnFailureListener { status.text = it.message ?: "Đăng nhập thất bại." }
        }
        logout.setOnClickListener {
            auth?.signOut()
            logout.isEnabled = false
            status.text = "Đã đăng xuất."
        }
    }
}
