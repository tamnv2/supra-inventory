package cd.cc.supra.inventory.beta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class StockMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        NotificationSignalStore.saveToken(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        NotificationSignalStore.markMessage(applicationContext, message.data)
        ensureChannel()

        val event = message.data["event"].orEmpty()
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
        val resultEventId = message.data["result_event_id"].orEmpty().trim()
        // D120: only the Picker's authoritative red/blue result surface is projected
        // across other apps. Warning/report-created notices remain ordinary Android
        // notifications so the user never sees two competing full-screen designs.
        val overlayEligible = isPickerCommand || (event in resultEvents && resultEventId.isNotBlank())
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)
        if (overlayEligible && overlayGranted) {
            val expiresAt = message.data["expires_at_ms"]?.toLongOrNull()
                ?: (System.currentTimeMillis() + if (isPickerCommand) 6L * 60L * 60L * 1000L else 30L * 60L * 1000L)
            try {
                CriticalOverlayService.show(
                    this,
                    title,
                    body,
                    if (isPickerCommand) CriticalOverlayService.MODE_PICKER_COMMAND else CriticalOverlayService.MODE_RESULT,
                    message.data["alert_id"].orEmpty().ifBlank { resultEventId },
                    expiresAt,
                    message.data["resolution"].orEmpty(),
                    message.data["sku"].orEmpty(),
                    message.data["product_name"].orEmpty(),
                )
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
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title.take(120))
            .setContentText(body.take(240))
            .setStyle(Notification.BigTextStyle().bigText(body.take(500)))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

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
    }
}
