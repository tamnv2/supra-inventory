package cd.cc.supra.inventory.beta

import android.content.Context

object NotificationSignalStore {
    private const val PREFS = "notification_signal_v1"
    private const val KEY_TOKEN = "latest_fcm_token"
    private const val KEY_DIRTY = "dirty"
    private const val KEY_RESULT_EVENTS = "pending_result_events"
    private const val KEY_EVENT = "last_event"
    private const val KEY_BATCH = "last_batch"
    private const val KEY_SEQ = "last_seq"
    private const val KEY_BATCH_VERSION = "last_batch_version"

    fun saveToken(context: Context, token: String) {
        if (token.isBlank()) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, token)
            .apply()
    }

    fun latestToken(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TOKEN, null)
            ?.takeIf { it.isNotBlank() }

    @Synchronized
    fun markMessage(context: Context, data: Map<String, String>) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val resultEventId = data["result_event_id"].orEmpty().trim()
        val pending = prefs.getStringSet(KEY_RESULT_EVENTS, emptySet()).orEmpty().toMutableSet()
        if (resultEventId.isNotBlank()) pending += resultEventId

        prefs.edit()
            .putBoolean(KEY_DIRTY, true)
            .putStringSet(KEY_RESULT_EVENTS, pending)
            .putString(KEY_EVENT, data["event"].orEmpty().take(100))
            .putString(KEY_BATCH, data["batch_id"].orEmpty().take(128))
            .putString(KEY_SEQ, data["event_seq"].orEmpty().take(32))
            .putString(KEY_BATCH_VERSION, data["batch_version"].orEmpty().take(32))
            .apply()
    }

    @Synchronized
    fun consumeDirty(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val dirty = prefs.getBoolean(KEY_DIRTY, false)
        if (dirty) prefs.edit().putBoolean(KEY_DIRTY, false).apply()
        return dirty
    }

    fun pendingResultEvents(context: Context): Set<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_RESULT_EVENTS, emptySet())
            .orEmpty()
            .filter { it.matches(Regex("[A-Za-z0-9._:-]{1,128}")) }
            .toSet()

    @Synchronized
    fun clearResultEvent(context: Context, eventId: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pending = prefs.getStringSet(KEY_RESULT_EVENTS, emptySet()).orEmpty().toMutableSet()
        if (pending.remove(eventId)) prefs.edit().putStringSet(KEY_RESULT_EVENTS, pending).apply()
    }
}
