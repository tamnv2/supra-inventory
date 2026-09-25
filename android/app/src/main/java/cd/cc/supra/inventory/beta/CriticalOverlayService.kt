package cd.cc.supra.inventory.beta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat

class CriticalOverlayService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var overlay: View? = null
    private var windowManager: WindowManager? = null
    private var expiryTask: Runnable? = null
    private var activeAlertId: String = ""
    private var activeMode: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WindowManager::class.java)
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_CLEAR) {
            val requested = intent.getStringExtra(EXTRA_ALERT_ID).orEmpty()
            if (requested.isBlank() || requested == activeAlertId) stopSelf()
            return START_NOT_STICKY
        }
        if (intent?.action != ACTION_SHOW) return START_NOT_STICKY
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "SUPRA Inventory" }.take(120)
        val body = intent.getStringExtra(EXTRA_BODY).orEmpty().ifBlank { "Có cập nhật nghiệp vụ mới." }.take(800)
        activeMode = intent.getStringExtra(EXTRA_MODE).orEmpty()
        activeAlertId = intent.getStringExtra(EXTRA_ALERT_ID).orEmpty()
        val resolution = intent.getStringExtra(EXTRA_RESOLUTION).orEmpty()
        val sku = intent.getStringExtra(EXTRA_SKU).orEmpty()
        val productName = intent.getStringExtra(EXTRA_PRODUCT_NAME).orEmpty()
        val expiresAt = intent.getLongExtra(EXTRA_EXPIRES_AT_MS, System.currentTimeMillis() + DEFAULT_TTL_MS)
            .coerceAtMost(System.currentTimeMillis() + MAX_TTL_MS)

        startForeground(OVERLAY_NOTIFICATION_ID, foregroundNotification(title, body))
        if (activeMode == MODE_RESULT && activeAlertId.isNotBlank()) {
            NotificationSignalStore.markResultOverlayPresented(applicationContext, activeAlertId)
        }
        showOverlay(title, body, activeMode, resolution, sku, productName)
        expiryTask?.let(handler::removeCallbacks)
        expiryTask = Runnable { stopSelf() }.also { task ->
            handler.postDelayed(task, (expiresAt - System.currentTimeMillis()).coerceIn(1_000L, MAX_TTL_MS))
        }
        return START_NOT_STICKY
    }

    private fun showOverlay(
        title: String,
        body: String,
        mode: String,
        resolution: String,
        sku: String,
        productName: String,
    ) {
        removeOverlay()
        val view = if (mode == MODE_RESULT) {
            buildResultOverlay(body, resolution, sku, productName)
        } else {
            buildCommandOverlay(title, body)
        }
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply { gravity = Gravity.CENTER }

        windowManager?.addView(view, params)
        overlay = view
    }

    private fun buildResultOverlay(body: String, resolution: String, sku: String, productName: String): View {
        val isSkip = resolution == "SKIP_ALLOWED" || body.contains("skip", ignoreCase = true) || body.contains("bỏ qua", ignoreCase = true)
        val surface = LayoutInflater.from(this).inflate(R.layout.overlay_alert, null, false)
        surface.setBackgroundResource(if (isSkip) R.drawable.bg_overlay_skip else R.drawable.bg_overlay_available)
        surface.findViewById<TextView>(R.id.tvOverlayStatus).text =
            if (isSkip) "ĐƯỢC PHÉP BỎ QUA" else "ĐÃ CÓ HÀNG"
        surface.findViewById<TextView>(R.id.tvOverlaySku).text =
            sku.takeIf { it.isNotBlank() } ?: "KẾT QUẢ BÁO HÀNG"
        surface.findViewById<TextView>(R.id.tvOverlayProduct).text = productName
        surface.findViewById<TextView>(R.id.tvOverlayMessage).text = body
        surface.findViewById<TextView>(R.id.tvOverlayDismissHint).text =
            "Cảnh báo nghiệp vụ • xác nhận tại đây để tiếp tục"
        val acknowledge = surface.findViewById<Button>(R.id.btnOverlayAck).apply {
            text = "XÁC NHẬN ĐÃ NHẬN"
            visibility = View.VISIBLE
        }
        acknowledge.setOnClickListener {
            val eventId = activeAlertId
            if (eventId.isBlank()) return@setOnClickListener
            acknowledge.isEnabled = false
            acknowledge.text = "ĐANG XÁC NHẬN..."
            NotificationSignalStore.markOverlayAckPending(applicationContext, eventId)
            Thread {
                try {
                    val session = InteractiveSessionStore.load(applicationContext)
                        ?: throw IllegalStateException("Phiên đăng nhập chưa sẵn sàng.")
                    val api = InventoryApi(
                        baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
                        userAgent = "SUPRA-Inventory-Beta/" + BuildConfig.VERSION_NAME,
                        onSessionChanged = { InteractiveSessionStore.save(applicationContext, it) },
                    )
                    api.restoreSession(session)
                    api.acknowledgeResult(eventId)
                    NotificationSignalStore.clearOverlayAck(applicationContext, eventId)
                    handler.post { stopSelf() }
                } catch (_: Exception) {
                    handler.post {
                        acknowledge.isEnabled = true
                        acknowledge.text = "THỬ XÁC NHẬN LẠI"
                        surface.findViewById<TextView>(R.id.tvOverlayDismissHint).text =
                            "Chưa gửi được xác nhận • kiểm tra mạng rồi thử lại"
                    }
                }
            }.start()
        }
        return surface
    }

    private fun buildCommandOverlay(title: String, body: String): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(28, 28, 28, 28)
            setBackgroundColor(Color.argb(225, 8, 18, 35))
        }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(32, 28, 32, 28)
            setBackgroundColor(Color.WHITE)
        }
        card.addView(TextView(this).apply {
            text = title
            textSize = 24f
            setTextColor(Color.rgb(15, 23, 42))
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        card.addView(TextView(this).apply {
            text = body
            textSize = 19f
            setTextColor(Color.rgb(30, 41, 59))
            gravity = Gravity.CENTER
            setPadding(0, 18, 0, 18)
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        card.addView(TextView(this).apply {
            text = "Cảnh báo sẽ được đóng khi Chuyên viên xác nhận đã xử lý."
            textSize = 14f
            setTextColor(Color.rgb(71, 85, 105))
            gravity = Gravity.CENTER
        })
        root.addView(card, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            marginStart = 20
            marginEnd = 20
        })
        return root
    }

    private fun foregroundNotification(title: String, body: String): Notification {
        val open = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(
            this,
            OVERLAY_NOTIFICATION_ID,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body.take(180))
            .setStyle(Notification.BigTextStyle().bigText(body.take(500)))
            .setContentIntent(pending)
            .setOngoing(true)
            .build()
    }

    private fun ensureChannel() {
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "SUPRA Inventory · Cảnh báo toàn màn hình",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Cảnh báo nghiệp vụ Báo hàng cần chú ý ngay" },
        )
    }

    private fun removeOverlay() {
        overlay?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) { }
        }
        overlay = null
    }

    override fun onDestroy() {
        expiryTask?.let(handler::removeCallbacks)
        expiryTask = null
        if (
            activeMode == MODE_RESULT &&
            activeAlertId.isNotBlank() &&
            !NotificationSignalStore.isOverlayAckPending(applicationContext, activeAlertId)
        ) {
            NotificationSignalStore.clearResultOverlayPresented(applicationContext, activeAlertId)
        }
        removeOverlay()
        super.onDestroy()
    }

    companion object {
        const val ACTION_SHOW = "cd.cc.supra.inventory.beta.CRITICAL_OVERLAY_SHOW"
        const val ACTION_CLEAR = "cd.cc.supra.inventory.beta.CRITICAL_OVERLAY_CLEAR"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_MODE = "mode"
        const val EXTRA_ALERT_ID = "alert_id"
        const val EXTRA_EXPIRES_AT_MS = "expires_at_ms"
        const val EXTRA_RESOLUTION = "resolution"
        const val EXTRA_SKU = "sku"
        const val EXTRA_PRODUCT_NAME = "product_name"
        const val MODE_PICKER_COMMAND = "PICKER_COMMAND"
        const val MODE_RESULT = "RESULT"
        private const val CHANNEL_ID = "inventory_critical_overlay"
        private const val OVERLAY_NOTIFICATION_ID = 129119
        private const val DEFAULT_TTL_MS = 30L * 60L * 1000L
        private const val MAX_TTL_MS = 6L * 60L * 60L * 1000L

        fun show(
            context: android.content.Context,
            title: String,
            body: String,
            mode: String,
            alertId: String,
            expiresAtMs: Long,
            resolution: String = "",
            sku: String = "",
            productName: String = "",
        ) {
            val intent = Intent(context, CriticalOverlayService::class.java).apply {
                action = ACTION_SHOW
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_BODY, body)
                putExtra(EXTRA_MODE, mode)
                putExtra(EXTRA_ALERT_ID, alertId)
                putExtra(EXTRA_EXPIRES_AT_MS, expiresAtMs)
                putExtra(EXTRA_RESOLUTION, resolution)
                putExtra(EXTRA_SKU, sku)
                putExtra(EXTRA_PRODUCT_NAME, productName)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun clear(context: android.content.Context, alertId: String) {
            context.startService(Intent(context, CriticalOverlayService::class.java).apply {
                action = ACTION_CLEAR
                putExtra(EXTRA_ALERT_ID, alertId)
            })
        }

        fun permissionSettings(context: android.content.Context): Intent =
            Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.packageName))
    }
}
