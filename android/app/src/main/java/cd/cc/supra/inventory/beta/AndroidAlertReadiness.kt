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

enum class AlertDeliveryMode {
    NATIVE_DND,
    OVERLAY_COMPAT,
}

data class AlertReadiness(
    val notificationsReady: Boolean,
    val overlayReady: Boolean,
    val dndPolicyReady: Boolean,
    val batteryReady: Boolean,
    val criticalChannelReady: Boolean,
    val fullScreenIntentReady: Boolean,
) {
    /**
     * D151: only capabilities that are required by every supported Android
     * delivery path are allowed to block operational startup.
     *
     * Notification Policy / bypass-DND is an optional native enhancement.
     * Some OEM Android 11 builds expose a misleading DND Settings switch while
     * NotificationManager keeps the real policy grant false. Overlay remains
     * the canonical visual alert surface in that case.
     */
    val hardReady: Boolean
        get() = notificationsReady && overlayReady && batteryReady

    val nativeDndReady: Boolean
        get() = dndPolicyReady && criticalChannelReady

    val deliveryMode: AlertDeliveryMode
        get() = if (nativeDndReady) AlertDeliveryMode.NATIVE_DND else AlertDeliveryMode.OVERLAY_COMPAT

    val ready: Boolean
        get() = hardReady
}

object AndroidAlertReadiness {
    const val CRITICAL_CHANNEL_ID = "inventory_critical_alert_v2"
    private const val ACTION_NOTIFICATION_POLICY_ACCESS_DETAIL_SETTINGS =
        "android.settings.NOTIFICATION_POLICY_ACCESS_DETAIL_SETTINGS"

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

        val fullScreenIntentReady =
            Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent()

        return AlertReadiness(
            notificationsReady = notificationsReady,
            overlayReady = overlayReady,
            dndPolicyReady = dndPolicyReady,
            batteryReady = batteryReady,
            criticalChannelReady = criticalChannelReady,
            fullScreenIntentReady = fullScreenIntentReady,
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
                    description = "Cảnh báo nghiệp vụ cần hiển thị ngay; dùng DND bypass khi Android thực sự cấp quyền"
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

    fun canUseFullScreenIntent(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 34) return true
        return context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
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
        val detail = Intent(
            ACTION_NOTIFICATION_POLICY_ACCESS_DETAIL_SETTINGS,
            Uri.parse("package:" + context.packageName),
        )
        try {
            if (detail.resolveActivity(context.packageManager) != null) {
                context.startActivity(detail)
                return
            }
        } catch (_: Exception) {
            // Fall through to the platform list. OEM detail pages are optional.
        }
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
        return listOf(maker, model).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "Android PDA" }
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
