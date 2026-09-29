package cd.cc.supra.inventory.beta

import android.content.Context
import java.util.Calendar
import java.util.TimeZone

data class LocalOperatingSchedule(
    val scheduleKey: String,
    val version: Long,
    val decision: String,
    val openUntilMs: Long,
    val normalStartMinutes: Int = 6 * 60,
    val normalEndMinutes: Int = 22 * 60,
    val overtimeCutoffMinutes: Int = 5 * 60,
    val updatedAtMs: Long = 0L,
    val serverOffsetMs: Long = 0L,
)

object OperatingScheduleStore {
    const val FCM_TOPIC = "supra_beta_operating_schedule"
    const val FIRESTORE_COLLECTION = "relay_poc_coordination"
    const val FIRESTORE_DOCUMENT = "operating_schedule"

    private const val PREFS = "d149_operating_schedule"
    private const val TZ = "Asia/Ho_Chi_Minh"

    fun load(context: Context): LocalOperatingSchedule? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = prefs.getString("schedule_key", "").orEmpty()
        if (key.isBlank()) return null
        return LocalOperatingSchedule(
            scheduleKey = key,
            version = prefs.getLong("version", 0L),
            decision = prefs.getString("decision", "").orEmpty(),
            openUntilMs = prefs.getLong("open_until_ms", 0L),
            normalStartMinutes = prefs.getInt("normal_start_minutes", 6 * 60),
            normalEndMinutes = prefs.getInt("normal_end_minutes", 22 * 60),
            overtimeCutoffMinutes = prefs.getInt("overtime_cutoff_minutes", 5 * 60),
            updatedAtMs = prefs.getLong("updated_at_ms", 0L),
            serverOffsetMs = prefs.getLong("server_offset_ms", 0L),
        )
    }

    fun save(context: Context, incoming: LocalOperatingSchedule): LocalOperatingSchedule {
        val current = load(context)
        if (current != null && current.scheduleKey == incoming.scheduleKey && incoming.version < current.version) {
            return current
        }
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("schedule_key", incoming.scheduleKey)
            .putLong("version", incoming.version.coerceAtLeast(0L))
            .putString("decision", incoming.decision)
            .putLong("open_until_ms", incoming.openUntilMs.coerceAtLeast(0L))
            .putInt("normal_start_minutes", incoming.normalStartMinutes)
            .putInt("normal_end_minutes", incoming.normalEndMinutes)
            .putInt("overtime_cutoff_minutes", incoming.overtimeCutoffMinutes)
            .putLong("updated_at_ms", incoming.updatedAtMs.coerceAtLeast(0L))
            .putLong("server_offset_ms", incoming.serverOffsetMs)
            .apply()
        return incoming
    }

    fun applyWorkerWindow(context: Context, window: AndroidOperatingWindow): LocalOperatingSchedule {
        val current = load(context)
        val nowLocal = System.currentTimeMillis()
        val offset = if (window.serverNowMs > 0L) window.serverNowMs - nowLocal else current?.serverOffsetMs ?: 0L
        val next = LocalOperatingSchedule(
            scheduleKey = window.scheduleKey.ifBlank { scheduleKey(nowLocal + offset, window.overtimeCutoffMinutes) },
            version = window.scheduleVersion,
            decision = window.decision.orEmpty(),
            openUntilMs = window.projectionOpenUntilMs ?: 0L,
            normalStartMinutes = window.startMinutes,
            normalEndMinutes = window.endMinutes,
            overtimeCutoffMinutes = window.overtimeCutoffMinutes,
            updatedAtMs = window.serverNowMs,
            serverOffsetMs = offset,
        )
        // A Worker response for a new schedule day is authoritative even when version=0.
        if (current != null && current.scheduleKey == next.scheduleKey && next.version < current.version) return current
        return save(context, next)
    }

    fun applyFcm(context: Context, data: Map<String, String>): LocalOperatingSchedule? {
        if (data["event"] != "operating_schedule_changed") return null
        val key = data["schedule_key"].orEmpty()
        val version = data["schedule_version"]?.toLongOrNull() ?: return null
        val openUntil = data["open_until_ms"]?.toLongOrNull() ?: return null
        val decision = data["decision"].orEmpty()
        if (!key.matches(Regex("^\\d{8}$")) || version <= 0L || openUntil <= 0L) return null
        val current = load(context)
        return save(
            context,
            LocalOperatingSchedule(
                scheduleKey = key,
                version = version,
                decision = decision,
                openUntilMs = openUntil,
                normalStartMinutes = data["normal_start_minutes"]?.toIntOrNull() ?: 6 * 60,
                normalEndMinutes = data["normal_end_minutes"]?.toIntOrNull() ?: 22 * 60,
                overtimeCutoffMinutes = data["overtime_cutoff_minutes"]?.toIntOrNull() ?: 5 * 60,
                updatedAtMs = data["updated_at_ms"]?.toLongOrNull() ?: version,
                serverOffsetMs = current?.serverOffsetMs ?: 0L,
            ),
        )
    }

    fun isOpen(context: Context, systemNowMs: Long = System.currentTimeMillis()): Boolean {
        val state = load(context)
        val offset = state?.serverOffsetMs ?: 0L
        val nowMs = systemNowMs + offset
        val start = state?.normalStartMinutes ?: 6 * 60
        val end = state?.normalEndMinutes ?: 22 * 60
        val cutoff = state?.overtimeCutoffMinutes ?: 5 * 60
        val minutes = localMinutes(nowMs)
        if (minutes >= start && minutes < end) return true
        if (state == null || state.scheduleKey != scheduleKey(nowMs, cutoff) || state.openUntilMs <= nowMs) return false
        if (minutes >= cutoff && minutes < start) return state.decision == "EARLY_START"
        if (minutes >= end || minutes < cutoff) return state.decision != "EARLY_START"
        return false
    }

    fun scheduleKey(nowMs: Long, cutoffMinutes: Int = 5 * 60): String {
        val calendar = Calendar.getInstance(TimeZone.getTimeZone(TZ)).apply { timeInMillis = nowMs }
        if (calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE) < cutoffMinutes) {
            calendar.add(Calendar.DAY_OF_MONTH, -1)
        }
        return "%04d%02d%02d".format(
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH) + 1,
            calendar.get(Calendar.DAY_OF_MONTH),
        )
    }

    private fun localMinutes(nowMs: Long): Int {
        val calendar = Calendar.getInstance(TimeZone.getTimeZone(TZ)).apply { timeInMillis = nowMs }
        return calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
    }
}
