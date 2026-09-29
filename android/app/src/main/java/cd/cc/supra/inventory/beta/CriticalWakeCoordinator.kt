package cd.cc.supra.inventory.beta

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * D151 local wake coordinator.
 *
 * Overlay is the canonical visual alert surface. When the screen is off or the
 * keyguard is showing, a short transparent CriticalWakeActivity is launched to
 * request screen-on / show-when-locked before the overlay is displayed.
 *
 * No polling, WakeLock or provider traffic is introduced.
 */
object CriticalWakeCoordinator {
    fun wakeForCriticalOverlayIfNeeded(context: Context, title: String, body: String): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            return false
        }

        val power = context.getSystemService(PowerManager::class.java)
        val keyguard = context.getSystemService(KeyguardManager::class.java)
        val needsWake = !power.isInteractive || keyguard.isKeyguardLocked
        if (!needsWake) return false

        return try {
            context.startActivity(CriticalWakeActivity.intent(context, title, body))
            true
        } catch (_: Exception) {
            false
        }
    }
}
