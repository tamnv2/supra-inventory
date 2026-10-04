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
    private const val KEY_OVERLAY_PRESENTED_RESULTS = "overlay_presented_results"
    private const val KEY_OVERLAY_ACK_PENDING = "overlay_ack_pending"
    private const val KEY_PICKER_CHAT_DISMISSED = "picker_chat_dismissed"
    private const val KEY_SKU_CATALOG_REFRESH = "sku_catalog_refresh_pending"

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
    fun markSkuCatalogRefresh(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_SKU_CATALOG_REFRESH, true)
            .apply()
    }

    @Synchronized
    fun consumeSkuCatalogRefresh(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pending = prefs.getBoolean(KEY_SKU_CATALOG_REFRESH, false)
        if (pending) prefs.edit().putBoolean(KEY_SKU_CATALOG_REFRESH, false).apply()
        return pending
    }

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


    @Synchronized
    fun markResultOverlayPresented(context: Context, eventId: String) {
        if (!eventId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val values = prefs.getStringSet(KEY_OVERLAY_PRESENTED_RESULTS, emptySet()).orEmpty().toMutableSet()
        values += eventId
        prefs.edit().putStringSet(KEY_OVERLAY_PRESENTED_RESULTS, values).apply()
    }

    fun isResultOverlayPresented(context: Context, eventId: String): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_OVERLAY_PRESENTED_RESULTS, emptySet())
            .orEmpty()
            .contains(eventId)

    @Synchronized
    fun clearResultOverlayPresented(context: Context, eventId: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val values = prefs.getStringSet(KEY_OVERLAY_PRESENTED_RESULTS, emptySet()).orEmpty().toMutableSet()
        if (values.remove(eventId)) prefs.edit().putStringSet(KEY_OVERLAY_PRESENTED_RESULTS, values).apply()
    }

    @Synchronized
    fun markPickerChatDismissed(context: Context, alertId: String) {
        if (!alertId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val values = prefs.getStringSet(KEY_PICKER_CHAT_DISMISSED, emptySet()).orEmpty().toMutableSet()
        values += alertId
        while (values.size > 64) values.remove(values.first())
        prefs.edit().putStringSet(KEY_PICKER_CHAT_DISMISSED, values).apply()
    }

    fun isPickerChatDismissed(context: Context, alertId: String): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_PICKER_CHAT_DISMISSED, emptySet())
            .orEmpty()
            .contains(alertId)

    @Synchronized
    fun markOverlayAckPending(context: Context, eventId: String) {
        if (!eventId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val values = prefs.getStringSet(KEY_OVERLAY_ACK_PENDING, emptySet()).orEmpty().toMutableSet()
        values += eventId
        prefs.edit().putStringSet(KEY_OVERLAY_ACK_PENDING, values).apply()
    }

    fun pendingOverlayAcks(context: Context): Set<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_OVERLAY_ACK_PENDING, emptySet())
            .orEmpty()
            .filter { it.matches(Regex("[A-Za-z0-9._:-]{1,128}")) }
            .toSet()

    fun isOverlayAckPending(context: Context, eventId: String): Boolean =
        pendingOverlayAcks(context).contains(eventId)

    @Synchronized
    fun clearOverlayAck(context: Context, eventId: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val values = prefs.getStringSet(KEY_OVERLAY_ACK_PENDING, emptySet()).orEmpty().toMutableSet()
        if (values.remove(eventId)) prefs.edit().putStringSet(KEY_OVERLAY_ACK_PENDING, values).apply()
        clearResultOverlayPresented(context, eventId)
    }
}

object InteractiveSessionStore {
    private const val PREFS = "interactive_session_v2"

    fun save(context: Context, value: AppSession?) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (value == null) {
            prefs.edit().remove("session").apply()
            return
        }
        val payload = org.json.JSONObject()
            .put("id_token", value.idToken)
            .put("refresh_token", value.refreshToken)
            .put("user_id", value.userId)
            .put("display_name", value.displayName)
            .put("role", value.role)
            .put("employee_code", value.employeeCode ?: org.json.JSONObject.NULL)
            .put("contractor_name", value.contractorName ?: org.json.JSONObject.NULL)
            .put("shortage_reporting_enabled", value.shortageReportingEnabled)
            .put("shortage_reporting_revision", value.shortageReportingRevision)
        prefs.edit().putString("session", payload.toString()).apply()
    }

    fun load(context: Context): AppSession? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString("session", null) ?: return null
        return try {
            val payload = org.json.JSONObject(raw)
            val next = AppSession(
                idToken = payload.optString("id_token"),
                refreshToken = payload.optString("refresh_token"),
                userId = payload.optString("user_id"),
                displayName = payload.optString("display_name"),
                role = payload.optString("role"),
                employeeCode = payload.optString("employee_code").takeIf { it.isNotBlank() && it != "null" },
                contractorName = payload.optString("contractor_name").takeIf { it.isNotBlank() && it != "null" },
                shortageReportingEnabled = payload.optBoolean("shortage_reporting_enabled", false),
                shortageReportingRevision = if (payload.has("shortage_reporting_revision")) payload.optLong("shortage_reporting_revision", -1L) else -1L,
            )
            if (next.idToken.isBlank() || next.refreshToken.isBlank() || next.userId.isBlank()) null else next
        } catch (_: Exception) {
            prefs.edit().remove("session").apply()
            null
        }
    }
}
