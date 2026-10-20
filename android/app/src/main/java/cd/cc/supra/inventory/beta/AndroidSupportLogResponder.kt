package cd.cc.supra.inventory.beta

import android.content.Context
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.time.Instant
import kotlin.math.absoluteValue

object AndroidSupportLogResponder {
    private const val RUNTIME_PREFS = "runtime_logs"
    private const val NOTIFICATION_DEVICE_PREFS = "notification_device"
    private const val HANDLED_KEY = "support_requests_handled_v2"

    fun queue(context: Context, data: Map<String, String>) {
        val requestId = data["request_id"].orEmpty().trim()
        val traceId = data["trace_id"].orEmpty().trim().ifBlank { requestId }
        val issuedAtMs = data["issued_at_ms"]?.toLongOrNull() ?: 0L
        val expiresAtMs = data["expires_at_ms"]?.toLongOrNull() ?: 0L
        val now = System.currentTimeMillis()
        if (!requestId.matches(Regex("^support-[A-Za-z0-9]{16,80}$"))) return
        if (!traceId.matches(Regex("^[A-Za-z0-9._:-]{1,180}$"))) return
        if (issuedAtMs <= 0L || expiresAtMs <= now || expiresAtMs > issuedAtMs + 5L * 60L * 1000L) return

        val appContext = context.applicationContext
        val session = InteractiveSessionStore.load(appContext) ?: return
        val prefs = appContext.getSharedPreferences(RUNTIME_PREFS, Context.MODE_PRIVATE)
        val handled = prefs.getStringSet(HANDLED_KEY, emptySet()).orEmpty()
        if (handled.contains(requestId)) return

        val deviceId = appContext
            .getSharedPreferences(NOTIFICATION_DEVICE_PREFS, Context.MODE_PRIVATE)
            .getString("device_id", "")
            .orEmpty()
        // Deterministically stagger devices for up to three minutes. Bound by
        // the signed five-minute request TTL; no follow-up retry loop.
        val remainingMs = (expiresAtMs - now - 15_000L).coerceAtLeast(0L)
        val jitterMs = ((requestId + "|" + deviceId).hashCode().toLong().absoluteValue % 180_001L)
            .coerceAtMost(remainingMs)

        Thread {
            if (jitterMs > 0L) {
                try { Thread.sleep(jitterMs) } catch (_: InterruptedException) { return@Thread }
            }
            if (System.currentTimeMillis() >= expiresAtMs) return@Thread
            if (sendOnce(appContext, session, requestId, traceId, deviceId)) {
                markHandled(prefs, requestId)
            }
            // The next authorized request is the only next delivery opportunity.
        }.apply {
            name = "d161-support-log"
            isDaemon = true
            start()
        }
    }

    // Retry at most two previously sealed logout/kick bundles at a scheduled
    // boundary; never discard without a Drive-confirmed archive receipt.
    private fun retryPendingLogout(context: Context, session: AppSession, api: InventoryApi, deviceId: String) {
        val prefs = context.getSharedPreferences(RUNTIME_PREFS, Context.MODE_PRIVATE)
        val queue = try { JSONArray(prefs.getString("pending_logout_queue_v3", "[]")) }
            catch (_: Exception) { JSONArray() }
        if (queue.length() == 0) return
        val remaining = JSONArray()
        var attempts = 0
        var blocked = false
        for (index in 0 until queue.length()) {
            val item = queue.optJSONObject(index) ?: continue
            if (blocked || attempts >= 2 || item.optString("owner") != session.userId) {
                remaining.put(item)
                continue
            }
            val payload = try { JSONObject(item.optString("payload", "{}")) }
                catch (_: Exception) { remaining.put(item); continue }
            val bundleId = payload.optString("_runtime_log_bundle_id")
            val boundaryId = payload.optString("_runtime_log_boundary_id")
            val generatedAt = payload.optString("_runtime_log_generated_at")
            if (!bundleId.matches(Regex("^[a-f0-9]{32,64}$")) || generatedAt.isBlank() ||
                !boundaryId.matches(Regex("^[A-Za-z0-9._:-]{1,180}$"))) {
                remaining.put(item)
                continue
            }
            attempts++
            try {
                val response = api.uploadRuntimeLog(
                    severity = "INFO", reason = "session_end_logout",
                    generatedAt = generatedAt,
                    device = JSONObject().put("device_id", deviceId.take(160))
                        .put("package", BuildConfig.APPLICATION_ID)
                        .put("version_code", BuildConfig.VERSION_CODE),
                    payload = payload,
                    bundleId = bundleId, boundaryId = boundaryId, traceId = boundaryId,
                )
                if (response.optString("archive_status") != "DRIVE_SYNCED") {
                    remaining.put(item)
                    blocked = true
                }
            } catch (_: Exception) {
                remaining.put(item)
                blocked = true
            }
        }
        prefs.edit().putString("pending_logout_queue_v3", remaining.toString()).commit()
    }

    // D171 scheduled bundles are deterministic per device and VN slot. An
    // HTTP accepted/staged result is NOT treated as a Drive receipt.
    fun sendDaily(context: Context, session: AppSession, slot: String): Boolean {
        if (!slot.matches(Regex("^\\d{8}-(1315|2115)$"))) return false
        val appContext = context.applicationContext
        val deviceId = appContext.getSharedPreferences(NOTIFICATION_DEVICE_PREFS, Context.MODE_PRIVATE)
            .getString("device_id", "").orEmpty()
        return try {
            val api = InventoryApi(
                baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
                userAgent = "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}",
                onSessionChanged = { next -> InteractiveSessionStore.save(appContext, next) },
            )
            api.restoreSession(session)
            retryPendingLogout(appContext, session, api, deviceId)
            val prefs = appContext.getSharedPreferences(RUNTIME_PREFS, Context.MODE_PRIVATE)
            val savedKey = "d171_daily_payload_${session.userId}_$slot"
            val savedPayload = prefs.getString(savedKey, null)
            val journal = if (savedPayload == null) journalSnapshot(prefs, session.userId)
                else JSONObject(savedPayload).optJSONObject("journal") ?: journalSnapshot(prefs, session.userId)
            val through = journal.optLong("last_sequence", 0L)
            // Cap attachment to fit the existing authorized runtime-log route.
            val original = journal.optJSONArray("recent_events") ?: JSONArray()
            val bounded = JSONArray()
            for (i in (original.length() - 60).coerceAtLeast(0) until original.length()) {
                original.optJSONObject(i)?.let { bounded.put(it) }
            }
            journal.put("recent_events", bounded)
            journal.put("snapshot_trimmed_for_delivery", original.length() > 60)
            val payload = JSONObject()
                .put("format", "supra-inventory-support-v2")
                .put("source", "ANDROID")
                .put("scheduled_boundary", slot)
                .put("generated_at", Instant.now().toString())
                .put("app", JSONObject()
                    .put("version_name", BuildConfig.VERSION_NAME)
                    .put("version_code", BuildConfig.VERSION_CODE)
                    .put("role", session.role))
                .put("journal", journal)
                .put("d166_usage_audit", D166UsageAudit.snapshot(journal, compact = true))
            val sealedPayload = if (savedPayload != null) JSONObject(savedPayload) else payload.also {
                prefs.edit().putString(savedKey, it.toString()).commit()
            }
            val bundleId = sha256Hex("ANDROID|$deviceId|${session.userId}|scheduled:$slot")
            val result = api.uploadRuntimeLog(
                severity = "INFO",
                reason = "scheduled_$slot",
                generatedAt = sealedPayload.optString("generated_at"),
                device = JSONObject()
                    .put("device_id", deviceId.take(160))
                    .put("package", BuildConfig.APPLICATION_ID)
                    .put("version_code", BuildConfig.VERSION_CODE)
                    .put("model", Build.MODEL.take(80)),
                payload = sealedPayload,
                bundleId = bundleId,
                boundaryId = "android:scheduled:$slot",
                traceId = "android:scheduled:$slot",
            )
            if (result.optString("archive_status") == "DRIVE_SYNCED") {
                if (through > 0L) pruneJournalThrough(prefs, session.userId, through)
                prefs.edit().remove(savedKey).apply()
                true
            } else false
        } catch (_: Exception) { false }
    }

    private fun sendOnce(
        context: Context,
        session: AppSession,
        requestId: String,
        traceId: String,
        deviceId: String,
    ): Boolean {
        return try {
            val api = InventoryApi(
                baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
                userAgent = "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}",
                onSessionChanged = { next -> InteractiveSessionStore.save(context, next) },
            )
            api.restoreSession(session)

            val prefs = context.getSharedPreferences(RUNTIME_PREFS, Context.MODE_PRIVATE)
            val journal = journalSnapshot(prefs, session.userId)
            val through = journal.optLong("last_sequence", 0L)
            val payload = JSONObject()
                .put("format", "supra-inventory-support-v2")
                .put("support_request", true)
                .put("request_id", requestId)
                .put("generated_at", Instant.now().toString())
                .put("app", JSONObject()
                    .put("surface", "ANDROID")
                    .put("package", BuildConfig.APPLICATION_ID)
                    .put("version_name", BuildConfig.VERSION_NAME)
                    .put("version_code", BuildConfig.VERSION_CODE)
                    .put("role", session.role)
                    .put("user_id", session.userId.take(128)))
                .put("device", JSONObject()
                    .put("device_id", deviceId.take(160))
                    .put("manufacturer", Build.MANUFACTURER.take(80))
                    .put("model", Build.MODEL.take(80))
                    .put("sdk_int", Build.VERSION.SDK_INT))
                .put("journal", journal)
                .put("d166_usage_audit", D166UsageAudit.snapshot(journal))

            val bundleId = sha256Hex("ANDROID|$deviceId|${session.userId}|$requestId")
            val response = api.uploadRuntimeLog(
                severity = "INFO",
                reason = "global_support_request",
                generatedAt = Instant.now().toString(),
                device = JSONObject()
                    .put("device_id", deviceId.take(160))
                    .put("manufacturer", Build.MANUFACTURER.take(80))
                    .put("model", Build.MODEL.take(80))
                    .put("sdk_int", Build.VERSION.SDK_INT)
                    .put("package", BuildConfig.APPLICATION_ID)
                    .put("version_code", BuildConfig.VERSION_CODE)
                    .put("version_name", BuildConfig.VERSION_NAME),
                payload = payload,
                bundleId = bundleId,
                boundaryId = "support:$requestId",
                traceId = traceId,
            )
            if (response.optString("archive_status") == "DRIVE_SYNCED" && through > 0L) {
                pruneJournalThrough(prefs, session.userId, through)
            }
            response.optString("archive_status") == "DRIVE_SYNCED"
        } catch (_: Exception) {
            false
        }
    }

    private fun journalSnapshot(
        prefs: android.content.SharedPreferences,
        userId: String,
    ): JSONObject {
        if (userId.isBlank() || prefs.getString("journal_owner", "").orEmpty() != userId) {
            return JSONObject().put("persistent", false)
        }
        val events = try {
            JSONArray(prefs.getString("journal_events", "[]"))
        } catch (_: Exception) {
            JSONArray()
        }
        return JSONObject()
            .put("persistent", true)
            .put("format", "supra-android-runtime-journal-v2")
            .put("first_sequence", events.optJSONObject(0)?.optLong("sequence", 0L)?.takeIf { it > 0L })
            .put("last_sequence", events.optJSONObject(events.length() - 1)?.optLong("sequence", 0L)?.takeIf { it > 0L })
            .put("dropped_events", prefs.getLong("journal_dropped", 0L))
            .put("recent_events", events)
    }

    private fun pruneJournalThrough(
        prefs: android.content.SharedPreferences,
        userId: String,
        through: Long,
    ) {
        if (prefs.getString("journal_owner", "").orEmpty() != userId) return
        val events = try {
            JSONArray(prefs.getString("journal_events", "[]"))
        } catch (_: Exception) {
            JSONArray()
        }
        val keep = JSONArray()
        for (index in 0 until events.length()) {
            val event = events.optJSONObject(index) ?: continue
            if (event.optLong("sequence", 0L) > through) keep.put(event)
        }
        prefs.edit()
            .putString("journal_events", keep.toString())
            .putLong("journal_dropped", 0L)
            .apply()
    }

    private fun markHandled(
        prefs: android.content.SharedPreferences,
        requestId: String,
    ) {
        val values = prefs.getStringSet(HANDLED_KEY, emptySet()).orEmpty().toMutableSet()
        values += requestId
        while (values.size > 64) values.remove(values.first())
        prefs.edit().putStringSet(HANDLED_KEY, values).apply()
    }

    private fun sha256Hex(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte) }
}
