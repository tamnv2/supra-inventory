package cd.cc.supra.inventory.beta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
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
            else -> "SUPRA Inventory"
        }
        val body = message.data["notification_body"]?.takeIf { it.isNotBlank() } ?: message.notification?.body ?: "Có cập nhật nghiệp vụ mới."

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
