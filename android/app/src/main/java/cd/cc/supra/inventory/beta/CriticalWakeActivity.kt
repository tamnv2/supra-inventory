package cd.cc.supra.inventory.beta

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class CriticalWakeActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private val finishTask = Runnable {
        if (!isFinishing) finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Native full-screen notification fallback must be readable even when
        // overlay permission exists but Android denied foreground service start.
        val fallback = intent.getBooleanExtra(EXTRA_FALLBACK, true) ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this))
        if (fallback) {
            renderFallback()
        } else {
            setContentView(LinearLayout(this).apply {
                setBackgroundColor(Color.TRANSPARENT)
            })
            handler.postDelayed(finishTask, WAKE_WINDOW_MS)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handler.removeCallbacks(finishTask)
        if (intent.getBooleanExtra(EXTRA_FALLBACK, true)) renderFallback()
        else handler.postDelayed(finishTask, WAKE_WINDOW_MS)
    }

    override fun onDestroy() {
        handler.removeCallbacks(finishTask)
        super.onDestroy()
    }

    private fun renderFallback() {
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "1291 Báo hàng" }
        val body = intent.getStringExtra(EXTRA_BODY).orEmpty().ifBlank { "Có cảnh báo nghiệp vụ cần xử lý." }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 40, 32, 40)
            setBackgroundColor(Color.rgb(8, 18, 35))
        }
        root.addView(TextView(this).apply {
            text = title
            textSize = 24f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(TextView(this).apply {
            text = body
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 22, 0, 24)
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(Button(this).apply {
            text = "ĐÓNG THÔNG BÁO"
            setOnClickListener {
                val id = intent.getStringExtra(EXTRA_RESULT_EVENT_ID).orEmpty()
                val owner = InteractiveSessionStore.load(applicationContext)
                    ?.takeIf { it.role == "PICKER" }?.userId.orEmpty()
                if (id.isNotBlank() && owner.isNotBlank()) {
                    // Only local dismissal, never a network ACK.
                    NotificationSignalStore.markResultDismissed(applicationContext, id, owner)
                    NotificationSignalStore.clearResultOverlayPresented(applicationContext, id)
                }
                finish()
            }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(root)
        AndroidAlertReadiness.recordOverlayTrace(this, "FULL_SCREEN_FALLBACK_SHOWN", "NOTIFICATION",
            intent.getStringExtra(EXTRA_RESULT_EVENT_ID).orEmpty())
    }

    companion object {
        const val EXTRA_TITLE = "critical_wake_title"
        const val EXTRA_BODY = "critical_wake_body"
        const val EXTRA_FALLBACK = "critical_wake_fallback"
        const val EXTRA_RESULT_EVENT_ID = "critical_result_event_id"
        private const val WAKE_WINDOW_MS = 8_000L

        fun intent(
            context: android.content.Context,
            title: String,
            body: String,
            resultEventId: String = "",
            transparentWake: Boolean = false,
        ): Intent = Intent(context, CriticalWakeActivity::class.java).apply {
            putExtra(EXTRA_TITLE, title.take(120))
            putExtra(EXTRA_BODY, body.take(500))
            putExtra(EXTRA_RESULT_EVENT_ID, resultEventId.take(128))
            putExtra(EXTRA_FALLBACK, !transparentWake)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
    }
}
