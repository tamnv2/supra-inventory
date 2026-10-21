package cd.cc.supra.inventory.beta

import android.content.Context

object NotificationSignalStore {
    private const val PREFS = "notification_signal_v1"
    private const val KEY_TOKEN = "latest_fcm_token"
    private const val KEY_DIRTY = "dirty"
    // Legacy global receipts have no proven account owner; preserve for audit but never replay.
    private const val KEY_RESULT_EVENTS = "pending_result_events"
    private const val RESULT_RECEIPT_PENDING = "result_received_pending"
    private const val KEY_EVENT = "last_event"
    private const val KEY_BATCH = "last_batch"
    private const val KEY_SEQ = "last_seq"
    private const val KEY_BATCH_VERSION = "last_batch_version"
    private const val KEY_OVERLAY_PRESENTED_RESULTS = "overlay_presented_results"
    private const val KEY_OVERLAY_COMPLETED_RESULTS = "overlay_completed_results"
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
        val activePicker = InteractiveSessionStore.load(context)
            ?.takeIf { it.role == "PICKER" && it.userId.isNotBlank() }
        val receiptKey = activePicker?.let { scopedAckKey(it.userId, RESULT_RECEIPT_PENDING) }
        val pending = receiptKey?.let {
            prefs.getStringSet(it, emptySet()).orEmpty().toMutableSet()
        }
        if (resultEventId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) {
            pending?.add(resultEventId)
        }

        val edit = prefs.edit().putBoolean(KEY_DIRTY, true)
        if (receiptKey != null && pending != null) edit.putStringSet(receiptKey, pending)
        edit
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

    fun pendingResultEvents(context: Context, userId: String): Set<String> {
        if (userId.isBlank()) return emptySet()
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(scopedAckKey(userId, RESULT_RECEIPT_PENDING), emptySet())
            .orEmpty()
            .filter { it.matches(Regex("[A-Za-z0-9._:-]{1,128}")) }
            .toSet()
    }

    // D171: private account-scoped, bounded evidence of terminal result receipts.
    // Does NOT claim delivery or suppress authenticated business acknowledgement.
    fun isResultReceiptQuarantined(context: Context, eventId: String, userId: String): Boolean {
        if (userId.isBlank()) return false
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(scopedAckKey(userId, "received_terminal_404"), emptySet())
            .orEmpty().contains(eventId)
    }

    @Synchronized
    fun quarantineResultReceipt(context: Context, eventId: String, userId: String) {
        if (userId.isBlank() || !eventId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = scopedAckKey(userId, "received_terminal_404")
        val quarantined = prefs.getStringSet(key, emptySet()).orEmpty().toMutableSet()
        quarantined.add(eventId)
        while (quarantined.size > 128) quarantined.remove(quarantined.first())
        val pendingKey = scopedAckKey(userId, RESULT_RECEIPT_PENDING)
        val pending = prefs.getStringSet(pendingKey, emptySet()).orEmpty().toMutableSet()
        pending.remove(eventId)
        prefs.edit().putStringSet(key, quarantined)
            .putStringSet(pendingKey, pending).apply()
    }

    @Synchronized
    fun clearResultEvent(context: Context, eventId: String, userId: String) {
        if (userId.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = scopedAckKey(userId, RESULT_RECEIPT_PENDING)
        val pending = prefs.getStringSet(key, emptySet()).orEmpty().toMutableSet()
        if (pending.remove(eventId)) prefs.edit().putStringSet(key, pending).apply()
    }


    // Presentation claims are temporary process/UI ownership, never business ACKs.
    // Clean stale claims once at process startup so an interrupted service cannot
    // permanently prevent a result from being displayed after an app restart.
    private var presentationStoreInitialized = false

    private fun ensurePresentationStore(context: Context) {
        if (presentationStoreInitialized) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(KEY_OVERLAY_PRESENTED_RESULTS).commit()
        presentationStoreInitialized = true
    }

    // Synchronized acquire before launching either the FCM overlay service or
    // the foreground Picker dialog. One result_event_id gets only one UI owner.
    @Synchronized
    fun tryMarkResultOverlayPresented(context: Context, eventId: String): Boolean {
        if (!eventId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) return false
        ensurePresentationStore(context)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val values = prefs.getStringSet(KEY_OVERLAY_PRESENTED_RESULTS, emptySet()).orEmpty().toMutableSet()
        if (!values.add(eventId)) return false
        prefs.edit().putStringSet(KEY_OVERLAY_PRESENTED_RESULTS, values).commit()
        return true
    }

    @Synchronized
    fun markResultOverlayPresented(context: Context, eventId: String) {
        if (!eventId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) return
        ensurePresentationStore(context)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val values = prefs.getStringSet(KEY_OVERLAY_PRESENTED_RESULTS, emptySet()).orEmpty().toMutableSet()
        values += eventId
        prefs.edit().putStringSet(KEY_OVERLAY_PRESENTED_RESULTS, values).apply()
    }

    @Synchronized
    fun isResultOverlayPresented(context: Context, eventId: String): Boolean {
        ensurePresentationStore(context)
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_OVERLAY_PRESENTED_RESULTS, emptySet())
            .orEmpty()
            .contains(eventId)
    }

    @Synchronized
    fun clearResultOverlayPresented(context: Context, eventId: String) {
        ensurePresentationStore(context)
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

    // D167: ACKs belong to the authenticated Picker, never to another account
    // using the same PDA. Legacy unscoped ACKs remain intact for evidence/recovery,
    // but are never replayed under a guessed account.
    private fun scopedAckKey(userId: String, suffix: String): String {
        require(userId.isNotBlank()) { "Picker session required for ACK storage" }
        val hash = java.security.MessageDigest.getInstance("SHA-256")
            .digest(userId.toByteArray(Charsets.UTF_8))
            .take(12).joinToString("") { "%02x".format(it.toInt() and 0xff) }
        return "overlay_ack_${suffix}_v2_$hash"
    }

    @Synchronized
    fun markOverlayAckPending(context: Context, eventId: String, userId: String) {
        if (!eventId.matches(Regex("[A-Za-z0-9._:-]{1,128}")) || userId.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = scopedAckKey(userId, "pending")
        val values = prefs.getStringSet(key, emptySet()).orEmpty().toMutableSet()
        values += eventId
        prefs.edit().putStringSet(key, values).apply()
    }

    fun pendingOverlayAcks(context: Context, userId: String): Set<String> {
        if (userId.isBlank()) return emptySet()
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(scopedAckKey(userId, "pending"), emptySet()).orEmpty()
            .filter { it.matches(Regex("[A-Za-z0-9._:-]{1,128}")) }.toSet()
    }

    @Synchronized
    fun reconcileLegacyOverlayAcks(context: Context, userId: String, serverPendingEventIds: Set<String>): Int {
        // Upgrade only the legacy IDs which the authoritative server has just
        // returned as pending for this exact Picker. Unknown/foreign IDs remain
        // quarantined locally, never replayed under the wrong account.
        if (userId.isBlank() || serverPendingEventIds.isEmpty()) return 0
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val legacy = prefs.getStringSet(KEY_OVERLAY_ACK_PENDING, emptySet()).orEmpty().toMutableSet()
        val proven = legacy.intersect(serverPendingEventIds)
            .filter { it.matches(Regex("[A-Za-z0-9._:-]{1,128}")) }.toSet()
        if (proven.isEmpty()) return 0
        val pendingKey = scopedAckKey(userId, "pending")
        val pending = prefs.getStringSet(pendingKey, emptySet()).orEmpty().toMutableSet()
        pending.addAll(proven)
        legacy.removeAll(proven)
        prefs.edit().putStringSet(pendingKey, pending)
            .putStringSet(KEY_OVERLAY_ACK_PENDING, legacy).apply()
        return proven.size
    }

    fun legacyUnscopedAckCount(context: Context): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_OVERLAY_ACK_PENDING, emptySet()).orEmpty().size

    fun quarantinedOverlayAckCount(context: Context, userId: String): Int {
        if (userId.isBlank()) return 0
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(scopedAckKey(userId, "quarantine"), emptySet()).orEmpty().size
    }

    fun isOverlayAckPending(context: Context, eventId: String, userId: String): Boolean =
        pendingOverlayAcks(context, userId).contains(eventId)

    // A delayed duplicate FCM must not reopen an event after confirmed ACK.
    // This receipt is account-scoped, bounded and local; Worker remains authority.
    fun isResultCompleted(context: Context, eventId: String, userId: String): Boolean =
        userId.isNotBlank() && context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(scopedAckKey(userId, KEY_OVERLAY_COMPLETED_RESULTS), emptySet())
            .orEmpty().contains(eventId)

    @Synchronized
    fun quarantineOverlayAck(context: Context, eventId: String, userId: String, reason: String) {
        if (userId.isBlank() || !eventId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pendingKey = scopedAckKey(userId, "pending")
        val quarantineKey = scopedAckKey(userId, "quarantine")
        val pending = prefs.getStringSet(pendingKey, emptySet()).orEmpty().toMutableSet()
        if (!pending.remove(eventId)) return
        val quarantined = prefs.getStringSet(quarantineKey, emptySet()).orEmpty().toMutableSet()
        quarantined += "$eventId|${reason.take(40)}"
        prefs.edit().putStringSet(pendingKey, pending).putStringSet(quarantineKey, quarantined).apply()
        // A server-side 404 is not a successful ACK. Keep local evidence and
        // allow a future authoritative result to be presented again.
        clearResultOverlayPresented(context, eventId)
    }

    @Synchronized
    fun clearOverlayAck(context: Context, eventId: String, userId: String) {
        if (userId.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = scopedAckKey(userId, "pending")
        val values = prefs.getStringSet(key, emptySet()).orEmpty().toMutableSet()
        if (values.remove(eventId)) {
            val completedKey = scopedAckKey(userId, KEY_OVERLAY_COMPLETED_RESULTS)
            val completed = prefs.getStringSet(completedKey, emptySet()).orEmpty().toMutableSet()
            completed.remove(eventId)
            completed.add(eventId)
            while (completed.size > 128) completed.remove(completed.first())
            prefs.edit().putStringSet(key, values).putStringSet(completedKey, completed).apply()
        }
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
