package cd.cc.supra.inventory.beta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class StockMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        NotificationSignalStore.saveToken(applicationContext, token)
        getSharedPreferences("d149_schedule_topic", MODE_PRIVATE)
            .edit().putBoolean("subscribed", false).apply()
        FirebaseMessaging.getInstance().subscribeToTopic(OperatingScheduleStore.FCM_TOPIC)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    getSharedPreferences("d149_schedule_topic", MODE_PRIVATE)
                        .edit().putBoolean("subscribed", true).apply()
                }
            }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val event = message.data["event"].orEmpty()
        if (event == "operating_schedule_changed") {
            OperatingScheduleStore.applyFcm(applicationContext, message.data)
            sendBroadcast(
                Intent(ACTION_OPERATING_SCHEDULE_CHANGED)
                    .setPackage(packageName)
            )
            return
        }
        if (event == "sku_catalog_updated") {
            NotificationSignalStore.markSkuCatalogRefresh(applicationContext)
            return
        }
        if (event == "support_log_request") {
            AndroidSupportLogResponder.queue(applicationContext, message.data)
            return
        }

        NotificationSignalStore.markMessage(applicationContext, message.data)
        ensureChannel()
        val title = message.data["notification_title"]?.takeIf { it.isNotBlank() } ?: message.notification?.title ?: when (event) {
            "batch_resolved" -> "SUPRA Inventory · Kết quả báo hàng"
            "batch_corrected" -> "SUPRA Inventory · Cập nhật kết quả"
            "report_created" -> "SUPRA Inventory · SKU cần xử lý"
            "sla_warning", "sla_warning_summary" -> "SUPRA Inventory · SKU sắp quá hạn"
            "sla_escalated", "sla_escalated_summary" -> "SUPRA Inventory · SKU quá hạn"
            "ticket_auto_skip_allowed", "batch_auto_skip_allowed", "auto_skip_summary" -> "SUPRA Inventory · Được phép bỏ qua"
            else -> "SUPRA Inventory"
        }
        val body = message.data["notification_body"]?.takeIf { it.isNotBlank() } ?: message.notification?.body ?: "Có cập nhật nghiệp vụ mới."

        if (event == "picker_command_resolved") {
            CriticalOverlayService.clear(this, message.data["alert_id"].orEmpty())
            return
        }

        val resultEvents = setOf(
            "batch_resolved", "batch_corrected",
            "ticket_auto_skip_allowed", "batch_auto_skip_allowed",
        )
        val isPickerCommand = event == "picker_command"
        val isPickerChat = isPickerCommand && message.data["command_type"].orEmpty() == "CHAT_MESSAGE"
        val pickerAlertId = message.data["alert_id"].orEmpty()
        if (isPickerChat && pickerAlertId.isNotBlank() &&
            NotificationSignalStore.isPickerChatDismissed(applicationContext, pickerAlertId)) {
            return
        }
        val resultEventId = message.data["result_event_id"].orEmpty().trim()
        val isReportCreated = event == "report_created" && resultEventId.isNotBlank()
        // D148: the existing high-priority FCM event becomes the wake path for
        // Reporter/Admin report-created overlays. No polling/listener cadence is added.
        // The overlay service owns priority, de-duplication and one-at-a-time ACK.
        val overlayEligible =
            isPickerCommand ||
                isReportCreated ||
                (event in resultEvents && resultEventId.isNotBlank())
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)
        if (overlayEligible && overlayGranted) {
            val expiresAt = message.data["expires_at_ms"]?.toLongOrNull()
                ?: (System.currentTimeMillis() + when {
                    isPickerChat -> 30L * 60L * 1000L
                    isPickerCommand -> 60L * 1000L
                    isReportCreated -> 30L * 60L * 1000L
                    else -> 30L * 60L * 1000L
                })
            try {
                CriticalOverlayService.show(
                    this,
                    if (isReportCreated) "THÔNG TIN BÁO HẾT HÀNG" else title,
                    body,
                    if (isPickerChat) CriticalOverlayService.MODE_PICKER_CHAT
                    else if (isPickerCommand) CriticalOverlayService.MODE_PICKER_COMMAND
                    else if (isReportCreated) CriticalOverlayService.MODE_REPORT_CREATED
                    else CriticalOverlayService.MODE_RESULT,
                    message.data["alert_id"].orEmpty().ifBlank { resultEventId },
                    expiresAt,
                    message.data["resolution"].orEmpty(),
                    message.data["sku"].orEmpty(),
                    message.data["product_name"].orEmpty(),
                )
                CriticalWakeCoordinator.wakeForCriticalOverlayIfNeeded(this, title, body)
                return
            } catch (_: Exception) {
                // Fall through to the accepted high-importance notification path.
            }
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("notification_event", event)
            putExtra("notification_result_event_id", message.data["result_event_id"].orEmpty())
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            message.data["event_seq"].orEmpty().hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val fallbackChannelId =
            if (overlayEligible && AndroidAlertReadiness.ensureCriticalChannel(this)) {
                AndroidAlertReadiness.CRITICAL_CHANNEL_ID
            } else {
                CHANNEL_ID
            }
        val notificationBuilder = Notification.Builder(this, fallbackChannelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title.take(120))
            .setContentText(body.take(240))
            .setStyle(Notification.BigTextStyle().bigText(body.take(500)))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        if (overlayEligible) {
            notificationBuilder.setVisibility(Notification.VISIBILITY_PUBLIC)
            if (AndroidAlertReadiness.canUseFullScreenIntent(this)) {
                val wakePending = PendingIntent.getActivity(
                    this,
                    (129300 + resultEventId.hashCode()).and(0x7fffffff),
                    CriticalWakeActivity.intent(this, title, body),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                notificationBuilder.setFullScreenIntent(wakePending, true)
            }
        }
        val notification = notificationBuilder.build()

        getSystemService(NotificationManager::class.java)
            .notify(message.data["result_event_id"].orEmpty().ifBlank { message.messageId.orEmpty() }.hashCode(), notification)
    }

    private fun ensureChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "SUPRA Inventory · Nghiệp vụ",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Cảnh báo nghiệp vụ khi SUPRA Inventory chạy nền" },
        )
    }

    companion object {
        const val CHANNEL_ID = "inventory_operations"
        const val ACTION_OPERATING_SCHEDULE_CHANGED =
            "cd.cc.supra.inventory.beta.OPERATING_SCHEDULE_CHANGED"
    }
}
