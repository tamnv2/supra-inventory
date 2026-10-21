package cd.cc.supra.inventory.beta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat

class CriticalOverlayService : Service() {
    private data class OverlayAlert(
        val title: String,
        val body: String,
        val mode: String,
        val alertId: String,
        val expiresAtMs: Long,
        val resolution: String,
        val sku: String,
        val productName: String,
        val correctionFromStatus: String,
        val isCorrection: Boolean,
        val enqueuedAtMs: Long,
        val ownerUserId: String,
    ) {
        val priority: Int
            get() = when (mode) {
                MODE_PICKER_COMMAND, MODE_PICKER_CHAT -> PRIORITY_SPECIALIST
                MODE_RESULT -> PRIORITY_RESULT
                MODE_REPORT_CREATED -> PRIORITY_REPORT
                else -> PRIORITY_REPORT
            }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val pendingAlerts = mutableListOf<OverlayAlert>()
    private var overlay: View? = null
    private var windowManager: WindowManager? = null
    private var expiryTask: Runnable? = null
    private var activeAlert: OverlayAlert? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WindowManager::class.java)
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_CLEAR) {
            clearAlert(intent.getStringExtra(EXTRA_ALERT_ID).orEmpty())
            return START_NOT_STICKY
        }
        if (intent?.action == ACTION_CLEAR_ALL_RESULTS) {
            val discarded = pendingAlerts.filter { it.mode == MODE_RESULT }
            pendingAlerts.removeAll(discarded.toSet())
            discarded.forEach(::releaseUnacknowledgedResult)
            if (activeAlert?.mode == MODE_RESULT) finishActive(userAcknowledged = false)
            return START_NOT_STICKY
        }
        if (intent?.action != ACTION_SHOW) return START_NOT_STICKY
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            if (intent.getStringExtra(EXTRA_MODE) == MODE_RESULT) {
                NotificationSignalStore.clearResultOverlayPresented(applicationContext, intent.getStringExtra(EXTRA_ALERT_ID).orEmpty())
            }
            stopSelf()
            return START_NOT_STICKY
        }

        val nowMs = System.currentTimeMillis()
        val mode = intent.getStringExtra(EXTRA_MODE).orEmpty()
        val owner = if (mode == MODE_RESULT)
            InteractiveSessionStore.load(applicationContext)?.takeIf { it.role == "PICKER" }?.userId.orEmpty()
        else ""
        if (mode == MODE_RESULT && owner.isBlank()) {
            NotificationSignalStore.clearResultOverlayPresented(applicationContext,
                intent.getStringExtra(EXTRA_ALERT_ID).orEmpty())
            return START_NOT_STICKY
        }
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "SUPRA Inventory" }.take(120)
        val body = intent.getStringExtra(EXTRA_BODY).orEmpty().ifBlank { "Có cập nhật nghiệp vụ mới." }.take(800)
        val sku = intent.getStringExtra(EXTRA_SKU).orEmpty().take(64)
        val productName = intent.getStringExtra(EXTRA_PRODUCT_NAME).orEmpty().take(500)
        val resolution = intent.getStringExtra(EXTRA_RESOLUTION).orEmpty().take(64)
        val correctionFromStatus = intent.getStringExtra(EXTRA_CORRECTION_FROM_STATUS).orEmpty().take(64)
        val isCorrection = intent.getBooleanExtra(EXTRA_IS_CORRECTION, false)
        val suppliedId = intent.getStringExtra(EXTRA_ALERT_ID).orEmpty().trim()
        val alertId = suppliedId.ifBlank {
            "local:" + mode.take(24) + ":" + (sku.ifBlank { body.take(80) }).hashCode().toString()
        }.take(128)
        val requestedExpiresAt = intent.getLongExtra(EXTRA_EXPIRES_AT_MS, nowMs + DEFAULT_TTL_MS)
            .coerceAtMost(nowMs + MAX_TTL_MS)
        val expiresAt = if (mode == MODE_PICKER_COMMAND) {
            minOf(requestedExpiresAt, nowMs + PICKER_COMMAND_TTL_MS)
        } else {
            requestedExpiresAt
        }
        if (expiresAt <= nowMs) {
            if (mode == MODE_RESULT) {
                NotificationSignalStore.clearResultOverlayPresented(applicationContext, alertId)
            }
            return START_NOT_STICKY
        }

        enqueue(
            OverlayAlert(
                title = title,
                body = body,
                mode = mode,
                alertId = alertId,
                expiresAtMs = expiresAt,
                resolution = resolution,
                sku = sku,
                productName = productName,
                correctionFromStatus = correctionFromStatus,
                isCorrection = isCorrection,
                enqueuedAtMs = nowMs,
                ownerUserId = owner,
            ),
        )
        return START_NOT_STICKY
    }

    private fun enqueue(item: OverlayAlert) {
        if (activeAlert?.alertId == item.alertId || pendingAlerts.any { it.alertId == item.alertId }) return

        // Mark result events as owned by the overlay queue immediately, including
        // items that are waiting behind a higher-priority alert. This prevents the
        // in-app dialog from racing the queue and showing the same result twice.
        if (item.mode == MODE_RESULT && item.alertId.isNotBlank()) {
            NotificationSignalStore.markResultOverlayPresented(applicationContext, item.alertId)
        }

        pendingAlerts += item
        AndroidAlertReadiness.recordOverlayTrace(this, "OVERLAY_ENQUEUED", item.mode, item.alertId)
        pruneExpired()

        val current = activeAlert
        if (current == null) {
            displayNext()
            return
        }

        // Specialist/Picker-call alerts preempt lower-priority shortage/result info.
        // The interrupted item is re-queued with its original FIFO timestamp.
        if (item.priority > current.priority) {
            suspendActiveForPriority()
            displayNext()
        }
    }

    private fun suspendActiveForPriority() {
        val current = activeAlert ?: return
        cancelExpiry()
        removeOverlay()
        activeAlert = null
        if (current.expiresAtMs > System.currentTimeMillis()) {
            pendingAlerts += current
        } else {
            releaseUnacknowledgedResult(current)
        }
    }

    private fun pruneExpired() {
        val now = System.currentTimeMillis()
        val expired = pendingAlerts.filter { it.expiresAtMs <= now }
        if (expired.isEmpty()) return
        pendingAlerts.removeAll(expired.toSet())
        expired.forEach(::releaseUnacknowledgedResult)
    }

    private fun displayNext() {
        pruneExpired()
        if (activeAlert != null) return

        val next = pendingAlerts
            .sortedWith(compareByDescending<OverlayAlert> { it.priority }.thenBy { it.enqueuedAtMs })
            .firstOrNull()

        if (next == null) {
            removeOverlay()
            cancelExpiry()
            stopForegroundCompat()
            stopSelf()
            return
        }

        pendingAlerts.remove(next)
        activeAlert = next
        try {
            startForeground(
                OVERLAY_NOTIFICATION_ID,
                foregroundNotification(next.title, next.body, next.alertId),
            )
            showOverlay(next)
            scheduleExpiry(next)
            AndroidAlertReadiness.recordOverlayTrace(this, "OVERLAY_ATTACHED", next.mode, next.alertId)
        } catch (error: Exception) {
            // Never leave an unshown result claimed as visible after a window/FGS error.
            AndroidAlertReadiness.recordOverlayTrace(this, "OVERLAY_FAILED", next.mode, next.alertId, error.javaClass.simpleName)
            releaseUnacknowledgedResult(next)
            activeAlert = null
            removeOverlay()
            stopForegroundCompat()
            try {
                getSystemService(NotificationManager::class.java).notify(
                    (WAKE_REQUEST_BASE + next.alertId.hashCode()).and(0x7fffffff),
                    foregroundNotification(next.title, next.body, next.alertId),
                )
                AndroidAlertReadiness.recordOverlayTrace(this, "FALLBACK_POSTED", next.mode, next.alertId)
            } catch (fallback: Exception) {
                AndroidAlertReadiness.recordOverlayTrace(this, "FALLBACK_FAILED", next.mode, next.alertId, fallback.javaClass.simpleName)
            }
            displayNext()
        }
    }

    private fun scheduleExpiry(item: OverlayAlert) {
        cancelExpiry()
        val maxDelay = if (item.mode == MODE_PICKER_COMMAND) PICKER_COMMAND_TTL_MS else MAX_TTL_MS
        expiryTask = Runnable {
            if (activeAlert?.alertId == item.alertId) {
                finishActive(userAcknowledged = false)
            }
        }.also { task ->
            handler.postDelayed(
                task,
                (item.expiresAtMs - System.currentTimeMillis()).coerceIn(1_000L, maxDelay),
            )
        }
    }

    private fun cancelExpiry() {
        expiryTask?.let(handler::removeCallbacks)
        expiryTask = null
    }

    private fun clearAlert(requestedId: String) {
        val targetId = requestedId.trim()
        if (targetId.isNotBlank()) {
            val removed = pendingAlerts.filter { it.alertId == targetId }
            pendingAlerts.removeAll { it.alertId == targetId }
            removed.forEach(::releaseUnacknowledgedResult)
            if (activeAlert?.alertId == targetId) {
                finishActive(userAcknowledged = false)
            } else if (activeAlert == null) {
                displayNext()
            }
            return
        }

        // A malformed/legacy command-clear without an ID must never wipe unrelated
        // shortage/result alerts. At most clear the currently visible command.
        val current = activeAlert
        if (current != null && (current.mode == MODE_PICKER_COMMAND || current.mode == MODE_PICKER_CHAT)) {
            finishActive(userAcknowledged = false)
        }
    }

    private fun finishActive(userAcknowledged: Boolean) {
        val current = activeAlert ?: return
        // The button is a purely local close action and never emits ACKNOWLEDGED.
        // Save against the original recipient even if the session was kicked.
        if (userAcknowledged && current.mode == MODE_RESULT) {
            NotificationSignalStore.markResultDismissed(
                applicationContext, current.alertId, current.ownerUserId)
            AndroidAlertReadiness.recordOverlayTrace(this, "RESULT_DISMISSED", current.mode, current.alertId)
        }
        if (userAcknowledged && current.mode == MODE_PICKER_CHAT) {
            NotificationSignalStore.markPickerChatDismissed(applicationContext, current.alertId)
        }
        cancelExpiry()
        removeOverlay()
        activeAlert = null
        if (current.mode == MODE_RESULT && !userAcknowledged) releaseUnacknowledgedResult(current)
        displayNext()
    }

    private fun releaseUnacknowledgedResult(item: OverlayAlert) {
        if (
            item.mode == MODE_RESULT &&
            item.alertId.isNotBlank() &&
            !NotificationSignalStore.isResultDismissed(applicationContext, item.alertId, item.ownerUserId)
        ) {
            NotificationSignalStore.clearResultOverlayPresented(applicationContext, item.alertId)
        }
    }

    private fun recordDisplayedAfterDraw(item: OverlayAlert, view: View) {
        if (item.mode != MODE_RESULT || item.ownerUserId.isBlank()) return
        view.post {
            if (overlay !== view || !view.isAttachedToWindow || !view.isShown) return@post
            AndroidAlertReadiness.recordOverlayTrace(this, "RESULT_DRAW_CONFIRMED", item.mode, item.alertId)
            val owner = InteractiveSessionStore.load(applicationContext)
                ?.takeIf { it.role == "PICKER" && it.userId == item.ownerUserId }
                ?: return@post
            NotificationSignalStore.markResultDisplayPending(
                applicationContext, item.alertId, owner.userId)
            Thread {
                try {
                    val session = InteractiveSessionStore.load(applicationContext)
                        ?.takeIf { it.userId == item.ownerUserId } ?: return@Thread
                    val api = InventoryApi(
                        baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
                        userAgent = "SUPRA-Inventory/" + BuildConfig.VERSION_NAME,
                        onSessionChanged = { InteractiveSessionStore.save(applicationContext, it) },
                    )
                    api.restoreSession(session)
                    api.markResultStage(item.alertId, "DISPLAYED")
                    NotificationSignalStore.clearResultEvent(
                        applicationContext, item.alertId, item.ownerUserId)
                } catch (error: ApiException) {
                    if (error.httpStatus == 404 && error.code == "RESULT_ACK_NOT_FOUND")
                        NotificationSignalStore.quarantineResultReceipt(
                            applicationContext, item.alertId, item.ownerUserId)
                } catch (_: Exception) {
                    // Durable account-owned DISPLAYED will retry on foreground/reconnect.
                }
            }.start()
        }
    }

    private fun showOverlay(item: OverlayAlert) {
        removeOverlay()
        val view = when (item.mode) {
            MODE_RESULT -> buildResultOverlay(item)
            MODE_REPORT_CREATED -> buildReportCreatedOverlay(item)
            else -> buildCommandOverlay(item, item.mode == MODE_PICKER_CHAT)
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
        recordDisplayedAfterDraw(item, view)
    }

    private fun buildResultOverlay(item: OverlayAlert): View {
        // The new state, not mentions of the old state in free text, controls color.
        val isSkip = item.resolution == "SKIP_ALLOWED"
        val isPending = item.resolution == "PENDING"
        val surface = LayoutInflater.from(this).inflate(R.layout.overlay_alert, null, false)
        surface.setBackgroundResource(when {
            isPending -> R.drawable.bg_overlay_info
            isSkip -> R.drawable.bg_overlay_skip
            else -> R.drawable.bg_overlay_available
        })
        surface.findViewById<TextView>(R.id.tvOverlayStatus).text = when {
            item.isCorrection -> "SỬA TRẠNG THÁI BÁO HÀNG"
            isPending -> "ĐANG XỬ LÝ"
            isSkip -> "ĐƯỢC PHÉP BỎ QUA"
            else -> "ĐÃ CÓ HÀNG"
        }
        surface.findViewById<TextView>(R.id.tvOverlaySku).text =
            item.sku.takeIf { it.isNotBlank() } ?: "KẾT QUẢ BÁO HÀNG"
        surface.findViewById<TextView>(R.id.tvOverlayProduct).text = item.productName
        surface.findViewById<TextView>(R.id.tvOverlayMessage).text =
            if (item.isCorrection) {
                val before = when (item.correctionFromStatus) {
                    "SKIP_ALLOWED" -> "Cho phép skip"
                    "HAS_STOCK" -> "Đã có hàng"
                    else -> "Trạng thái trước"
                }
                val after = when (item.resolution) {
                    "PENDING" -> "Đang xử lý — chưa được phép Skip"
                    "SKIP_ALLOWED" -> "Cho phép skip"
                    "HAS_STOCK" -> "Đã có hàng"
                    else -> "Chưa xác định"
                }
                "ĐÃ SỬA: $before → $after.\n${item.body}"
            } else item.body
        surface.findViewById<TextView>(R.id.tvOverlayDismissHint).text =
            "Cảnh báo nghiệp vụ • xác nhận từng thông tin để xem cảnh báo tiếp theo"
        surface.findViewById<Button>(R.id.btnOverlayAck).apply {
            text = "ĐÓNG THÔNG BÁO"
            visibility = View.VISIBLE
            setOnClickListener {
                isEnabled = false
                finishActive(userAcknowledged = true)
            }
        }
        return surface
    }

    private fun buildReportCreatedOverlay(item: OverlayAlert): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(24), dp(22), dp(24))
            setBackgroundColor(Color.argb(205, 8, 18, 35))
        }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(22), dp(24), dp(22))
            background = GradientDrawable().apply {
                setColor(Color.rgb(248, 250, 252))
                cornerRadius = dp(18).toFloat()
                setStroke(dp(2), Color.rgb(226, 232, 240))
            }
            elevation = dp(8).toFloat()
        }
        card.addView(TextView(this).apply {
            text = "THÔNG TIN BÁO HẾT HÀNG"
            textSize = 22f
            setTextColor(Color.rgb(15, 23, 42))
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }, matchWrap())

        card.addView(TextView(this).apply {
            text = "SKU"
            textSize = 13f
            setTextColor(Color.rgb(100, 116, 139))
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(18), 0, dp(2))
        }, matchWrap())

        card.addView(TextView(this).apply {
            text = item.sku.ifBlank { "—" }
            textSize = 29f
            setTextColor(Color.rgb(30, 64, 175))
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }, matchWrap())

        card.addView(TextView(this).apply {
            text = "Tên sản phẩm"
            textSize = 13f
            setTextColor(Color.rgb(100, 116, 139))
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(16), 0, dp(4))
        }, matchWrap())

        card.addView(TextView(this).apply {
            text = item.productName.ifBlank { item.body }
            textSize = 19f
            setTextColor(Color.rgb(30, 41, 59))
            gravity = Gravity.CENTER
            maxLines = 8
            ellipsize = TextUtils.TruncateAt.END
            setLineSpacing(0f, 1.08f)
        }, matchWrap())

        card.addView(Button(this).apply {
            text = "OK"
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
            backgroundTintList = ColorStateList.valueOf(Color.rgb(37, 99, 235))
            setOnClickListener {
                isEnabled = false
                finishActive(userAcknowledged = true)
            }
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(54),
        ).apply { topMargin = dp(20) })

        root.addView(card, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            marginStart = dp(2)
            marginEnd = dp(2)
        })
        return root
    }

    private fun buildCommandOverlay(item: OverlayAlert, localAcknowledge: Boolean): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(Color.argb(225, 8, 18, 35))
        }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(32), dp(28), dp(32), dp(28))
            setBackgroundColor(Color.WHITE)
        }
        card.addView(TextView(this).apply {
            text = item.title
            textSize = 24f
            setTextColor(Color.rgb(15, 23, 42))
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }, matchWrap())
        // The body scrolls independently; the acknowledgement button stays
        // outside this scroll view and remains reachable for long messages.
        val message = TextView(this).apply {
            text = item.body
            textSize = 19f
            setTextColor(Color.rgb(30, 41, 59))
            gravity = Gravity.CENTER
            setPadding(0, dp(18), 0, dp(18))
        }
        val scrollingMessage = ScrollView(this).apply {
            isFillViewport = false
            addView(message)
        }
        card.addView(scrollingMessage, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f,
        ))
        if (localAcknowledge) {
            card.addView(Button(this).apply {
                text = "XÁC NHẬN"
                textSize = 17f
                setTypeface(typeface, Typeface.BOLD)
                setOnClickListener {
                    isEnabled = false
                    finishActive(userAcknowledged = true)
                }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ))
        }
        root.addView(card, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            (resources.displayMetrics.heightPixels * 0.78f).toInt(),
        ).apply {
            marginStart = dp(10)
            marginEnd = dp(10)
        })
        return root
    }

    private fun matchWrap(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        )

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt().coerceAtLeast(value)

    private fun foregroundNotification(title: String, body: String, alertId: String): Notification {
        val channelId = ensureChannel()
        val open = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(
            this,
            OVERLAY_NOTIFICATION_ID,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = Notification.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body.take(180))
            .setStyle(Notification.BigTextStyle().bigText(body.take(500)))
            .setContentIntent(pending)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)

        if (AndroidAlertReadiness.canUseFullScreenIntent(this)) {
            val wakePending = PendingIntent.getActivity(
                this,
                (WAKE_REQUEST_BASE + alertId.hashCode()).and(0x7fffffff),
                CriticalWakeActivity.intent(this, title, body),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            builder.setFullScreenIntent(wakePending, true)
        }
        return builder.build()
    }

    private fun ensureChannel(): String {
        if (AndroidAlertReadiness.ensureCriticalChannel(this)) {
            return AndroidAlertReadiness.CRITICAL_CHANNEL_ID
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(
                StockMessagingService.CHANNEL_ID,
                "SUPRA Inventory · Nghiệp vụ",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Cảnh báo nghiệp vụ khi SUPRA Inventory chạy nền" },
        )
        return StockMessagingService.CHANNEL_ID
    }

    private fun removeOverlay() {
        overlay?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) { }
        }
        overlay = null
    }

    private fun stopForegroundCompat() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (_: Exception) { }
    }

    override fun onDestroy() {
        cancelExpiry()
        activeAlert?.let(::releaseUnacknowledgedResult)
        pendingAlerts.forEach(::releaseUnacknowledgedResult)
        pendingAlerts.clear()
        activeAlert = null
        removeOverlay()
        super.onDestroy()
    }

    companion object {
        const val ACTION_SHOW = "cd.cc.supra.inventory.beta.CRITICAL_OVERLAY_SHOW"
        const val ACTION_CLEAR = "cd.cc.supra.inventory.beta.CRITICAL_OVERLAY_CLEAR"
        const val ACTION_CLEAR_ALL_RESULTS = "cd.cc.supra.inventory.beta.CRITICAL_OVERLAY_CLEAR_RESULTS"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_MODE = "mode"
        const val EXTRA_ALERT_ID = "alert_id"
        const val EXTRA_EXPIRES_AT_MS = "expires_at_ms"
        const val EXTRA_RESOLUTION = "resolution"
        const val EXTRA_SKU = "sku"
        const val EXTRA_PRODUCT_NAME = "product_name"
        const val EXTRA_CORRECTION_FROM_STATUS = "correction_from_status"
        const val EXTRA_IS_CORRECTION = "is_correction"
        const val MODE_PICKER_COMMAND = "PICKER_COMMAND"
        const val MODE_PICKER_CHAT = "PICKER_CHAT"
        const val MODE_RESULT = "RESULT"
        const val MODE_REPORT_CREATED = "REPORT_CREATED"

        private const val PRIORITY_SPECIALIST = 300
        private const val PRIORITY_RESULT = 200
        private const val PRIORITY_REPORT = 100
        private const val OVERLAY_NOTIFICATION_ID = 129119
        private const val WAKE_REQUEST_BASE = 129200
        private const val DEFAULT_TTL_MS = 30L * 60L * 1000L
        private const val PICKER_COMMAND_TTL_MS = 60L * 1000L
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
            correctionFromStatus: String = "",
            isCorrection: Boolean = false,
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
                putExtra(EXTRA_CORRECTION_FROM_STATUS, correctionFromStatus)
                putExtra(EXTRA_IS_CORRECTION, isCorrection)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun clear(context: android.content.Context, alertId: String) {
            context.startService(Intent(context, CriticalOverlayService::class.java).apply {
                action = ACTION_CLEAR
                putExtra(EXTRA_ALERT_ID, alertId)
            })
        }

        fun clearAllResultOverlays(context: android.content.Context) {
            context.startService(Intent(context, CriticalOverlayService::class.java).apply {
                action = ACTION_CLEAR_ALL_RESULTS
            })
        }

        fun permissionSettings(context: android.content.Context): Intent =
            Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.packageName))
    }
}
