package cd.cc.supra.inventory.beta

import org.json.JSONArray
import org.json.JSONObject

/** D166: summarize the journal at an existing support-log boundary. No timer, IO or listener. */
internal object D166UsageAudit {
    private val metricLock = Any()
    private val apiCounts = linkedMapOf<String, Long>()
    private val apiElapsedMs = linkedMapOf<String, Long>()
    private const val MAX_API_KEYS = 256
    private const val MAX_ERROR_KEYS = 64
    private var droppedApiAttempts = 0L
    private var droppedBusinessErrors = 0L
    private val businessErrorCounts = linkedMapOf<String, Long>()

    // Existing HTTP operation boundary only; never persists per request or changes retry behavior.
    internal fun recordApi(method: String, path: String, status: Int, elapsedMs: Long) {
        try {
            val family = when {
                path.startsWith("/api/skus/catalog") -> "CATALOG"
                path.startsWith("/api/picker/reports") -> "PICKER_REPORTS"
                path.startsWith("/api/picker/results") -> "PICKER_RESULTS"
                path.startsWith("/api/reporter/") -> "REPORTER"
                path.startsWith("/api/realtime/") -> "REALTIME"
                path.startsWith("/api/auth/") -> "AUTH"
                path.startsWith("/api/notifications/") -> "NOTIFICATIONS"
                path.startsWith("/api/logs/upload") -> "LOG_UPLOAD"
                else -> "OTHER"
            }
            val outcome = when {
                status in 200..299 -> "OK"
                status == 0 -> "NETWORK_ERROR"
                status == 401 -> "AUTH_401"
                status == 403 -> "AUTH_403"
                status == 429 -> "RATE_429"
                status == 400 -> "HTTP_400"
                status == 404 -> "HTTP_404"
                status == 408 -> "HTTP_408"
                status == 409 -> "HTTP_409"
                status == 422 -> "HTTP_422"
                status in 400..499 -> "HTTP_4XX_OTHER"
                status >= 500 -> "SERVER_5XX"
                else -> "OTHER_STATUS"
            }
            val hour = java.time.Instant.now().atOffset(java.time.ZoneOffset.UTC)
                .toString().take(13)
            val key = hour + "|" + family + "|" + method.take(6).uppercase() + "|" + outcome
            synchronized(metricLock) {
                if (!apiCounts.containsKey(key) && apiCounts.size >= MAX_API_KEYS) {
                    droppedApiAttempts++
                    return
                }
                apiCounts[key] = (apiCounts[key] ?: 0L) + 1L
                apiElapsedMs[key] = (apiElapsedMs[key] ?: 0L) + elapsedMs.coerceIn(0L, 120000L)
            }
        } catch (_: Exception) { }
    }

    // Business error code is explicitly allowlisted; do not archive raw
    // server error payloads, text, URLs, identifiers or arbitrary codes.
    internal fun recordPickerResultError(status: Int, code: String) {
        if (status in 200..299) return
        val safeCode = when (code) {
            "RESULT_NOT_READY", "RESULT_ACK_NOT_FOUND", "RESULT_ALREADY_ACKNOWLEDGED",
            "RESULT_EVENT_NOT_FOUND", "RECEIPT_NOT_READY", "RECEIPT_NOT_FOUND",
            "RESULT_NOT_FOUND", "BATCH_VERSION_CONFLICT", "RESULT_CORRECTION_EXPIRED",
            "RESULT_CORRECTION_DISABLED", "RESULT_ACK_CONFLICT" -> code
            else -> "OTHER_BUSINESS_ERROR"
        }
        val hour = java.time.Instant.now().toString().take(13)
        val key = hour + "|PICKER_RESULTS|" + safeCode
        synchronized(metricLock) {
            if (!businessErrorCounts.containsKey(key) && businessErrorCounts.size >= MAX_ERROR_KEYS) {
                droppedBusinessErrors++
                return
            }
            businessErrorCounts[key] = (businessErrorCounts[key] ?: 0L) + 1L
        }
    }

    internal fun snapshot(journal: JSONObject? = null): JSONObject {
        val events = journal?.optJSONArray("recent_events") ?: JSONArray()
        val byHour = linkedMapOf<String, Int>()
        var errors = 0
        for (index in 0 until events.length()) {
            val event = events.optJSONObject(index) ?: continue
            val stamp = event.optString("at", "")
            val hour = if (stamp.length >= 13) stamp.substring(0, 13) + "Z" else "UNKNOWN"
            val category = event.optString("category", "APP").uppercase()
            val safeCategory = if (category in listOf("APP", "REALTIME", "API", "AUTH", "NETWORK", "PERF")) category else "OTHER"
            val key = hour + "|" + safeCategory
            if (!byHour.containsKey(key) && byHour.size >= 48) continue
            byHour[key] = (byHour[key] ?: 0) + 1
            if (event.optString("level", "INFO") == "ERROR") errors++
        }
        val counts = JSONArray()
        for ((key, n) in byHour) counts.put(JSONObject().put("hour_utc_category", key).put("events", n))
        return JSONObject()
            .put("schema", "d166-android-journal-audit-v1")
            .put("source", "EXISTING_BOUNDED_JOURNAL_NOT_FIRESTORE_BILLING")
            .put("journal_captured_events", events.length())
            .put("journal_error_events", errors)
            .put("journal_dropped_events", journal?.optLong("dropped_events", 0L) ?: 0L)
            .put("journal_first_sequence", journal?.optLong("first_sequence", 0L) ?: 0L)
            .put("journal_last_sequence", journal?.optLong("last_sequence", 0L) ?: 0L)
            .put("http_source", "RAM_PER_ATTEMPT_NOT_PROVIDER_BILLING")
            .put("http_dropped_samples", synchronized(metricLock) { droppedApiAttempts })
            .put("http_business_error_dropped_samples", synchronized(metricLock) { droppedBusinessErrors })
            .put("http_business_errors", synchronized(metricLock) {
                val out = JSONArray()
                for ((key, n) in businessErrorCounts)
                    out.put(JSONObject().put("utc_hour_route_error_class", key).put("attempts", n))
                out
            })
            .put("http_groups", synchronized(metricLock) {
                val out = JSONArray()
                for ((key, n) in apiCounts)
                    out.put(JSONObject().put("utc_hour_route_method_status", key)
                        .put("attempts", n).put("elapsed_sum_ms", apiElapsedMs[key] ?: 0L))
                out
            })
            .put("hourly", counts)
    }
}
