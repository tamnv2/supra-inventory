package cd.cc.supra.inventory.beta

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

data class AlertReadiness(
    val notificationsReady: Boolean,
    val overlayReady: Boolean,
    val dndPolicyReady: Boolean,
    val batteryReady: Boolean,
    val criticalChannelReady: Boolean,
) {
    val ready: Boolean
        get() = notificationsReady && overlayReady && dndPolicyReady && batteryReady && criticalChannelReady
}

object AndroidAlertReadiness {
    const val CRITICAL_CHANNEL_ID = "inventory_critical_alert_v2"

    fun evaluate(context: Context): AlertReadiness {
        val manager = context.getSystemService(NotificationManager::class.java)
        val runtimeNotificationGranted =
            Build.VERSION.SDK_INT < 33 ||
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val notificationsReady = runtimeNotificationGranted && manager.areNotificationsEnabled()
        val overlayReady = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        val dndPolicyReady = manager.isNotificationPolicyAccessGranted
        val batteryReady = context.getSystemService(PowerManager::class.java)
            .isIgnoringBatteryOptimizations(context.packageName)

        if (dndPolicyReady) ensureCriticalChannel(context)
        val channel = manager.getNotificationChannel(CRITICAL_CHANNEL_ID)
        val criticalChannelReady =
            dndPolicyReady &&
                channel != null &&
                channel.importance >= NotificationManager.IMPORTANCE_HIGH &&
                channel.canBypassDnd()

        return AlertReadiness(
            notificationsReady = notificationsReady,
            overlayReady = overlayReady,
            dndPolicyReady = dndPolicyReady,
            batteryReady = batteryReady,
            criticalChannelReady = criticalChannelReady,
        )
    }

    fun ensureCriticalChannel(context: Context): Boolean {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (!manager.isNotificationPolicyAccessGranted) return false
        try {
            manager.createNotificationChannel(
                NotificationChannel(
                    CRITICAL_CHANNEL_ID,
                    "1291 Báo hàng · Cảnh báo bắt buộc",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Cảnh báo nghiệp vụ cần hiển thị ngay, kể cả khi bật Không làm phiền"
                    enableVibration(true)
                    setBypassDnd(true)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                },
            )
        } catch (_: SecurityException) {
            return false
        }
        val channel = manager.getNotificationChannel(CRITICAL_CHANNEL_ID)
        return channel != null &&
            channel.importance >= NotificationManager.IMPORTANCE_HIGH &&
            channel.canBypassDnd()
    }

    fun openAppNotificationSettings(context: Context) {
        startWithFallback(
            context,
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            },
        )
    }

    fun openOverlaySettings(context: Context) {
        startWithFallback(
            context,
            Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.packageName)),
        )
    }

    fun openDndPolicySettings(context: Context) {
        startWithFallback(context, Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
    }

    fun openBatteryOptimizationSettings(context: Context) {
        val direct = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:" + context.packageName),
        )
        try {
            context.startActivity(direct)
        } catch (_: Exception) {
            try {
                context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            } catch (_: Exception) {
                openAppDetails(context)
            }
        }
    }

    fun openCriticalChannelSettings(context: Context) {
        startWithFallback(
            context,
            Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                putExtra(Settings.EXTRA_CHANNEL_ID, CRITICAL_CHANNEL_ID)
            },
        )
    }

    fun deviceLabel(): String {
        val maker = Build.MANUFACTURER.orEmpty().trim()
        val model = Build.MODEL.orEmpty().trim()
        return listOf(maker, model).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "Android 11 PDA" }
    }

    private fun startWithFallback(context: Context, intent: Intent) {
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            openAppDetails(context)
        }
    }

    fun openAppDetails(context: Context) {
        context.startActivity(
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.packageName),
            ),
        )
    }
}
