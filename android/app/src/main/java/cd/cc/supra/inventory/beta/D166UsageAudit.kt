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
    // D171: SDK/provider-boundary attempts in RAM only. These are NOT billed reads/writes.
    private val sdkCounts = linkedMapOf<String, Long>()
    // D173-E013: reporter UI diagnostics use existing daily/manual log payload only.
    // No timer, network call, persistent write or raw SKU/IDs.
    private val reporterUiCounts = linkedMapOf<String, Long>()
    private var reporterUiEvictedBuckets = 0L
    private val reporterUiReasons = setOf(
        "REALTIME_APPLIED", "REFRESH_APPLIED", "REFRESH_STALE", "REFRESH_ERROR",
        "CROSS_REQUEST_COUNTER_DIFFERENCE", "OVERDUE_PAGE_APPLIED",
        "PENDING_BADGE_CHANGE", "OVERDUE_BADGE_CHANGE",
        "SCROLL_ANCHOR_RETAINED", "SCROLL_ANCHOR_MISSING"
    )
    internal fun recordReporterUi(reason: String) {
        if (reason !in reporterUiReasons) return
        val key = java.time.Instant.now().toString().take(13) + "|" + reason
        synchronized(metricLock) {
            if (!reporterUiCounts.containsKey(key) && reporterUiCounts.size >= 320) {
                val oldest = reporterUiCounts.keys.firstOrNull()
                if (oldest != null) {
                    reporterUiCounts.remove(oldest)
                    reporterUiEvictedBuckets++
                }
            }
            reporterUiCounts[key] = (reporterUiCounts[key] ?: 0L) + 1L
        }
    }
    // E016: last 32 snapshot states help reconstruct order and concurrent
    // GET-vs-WebSocket races. No user/SKU/batch IDs; RAM only, existing upload.
    private val reporterFrames = ArrayDeque<JSONObject>()
    internal fun recordReporterFrame(stage: String, pending: Int, overdue: Int,
                                     eventSeq: Long, revision: Long, compared: Int = -1) {
        if (stage !in setOf("REALTIME", "SNAPSHOT", "SNAPSHOT_MISMATCH", "BADGE")) return
        synchronized(metricLock) {
            if (reporterFrames.size >= 32) reporterFrames.removeFirst()
            reporterFrames.addLast(JSONObject()
                .put("utc", java.time.Instant.now().toString())
                .put("stage", stage)
                .put("pending", pending.coerceIn(0, 100_000))
                .put("overdue", overdue.coerceIn(0, 100_000))
                .put("server_seq", eventSeq.coerceAtLeast(0L))
                .put("local_revision", revision.coerceAtLeast(0L))
                .put("compared_pending", compared.coerceIn(-1, 100_000)))
        }
    }
    private var sdkOverflow = 0L
    private val sdkOperations = setOf(
        "AUTH_CUSTOM_TOKEN", "PICKER_CALL_LISTENER", "PICKER_SESSION_CHAT_LISTENER",
        "PICKLIST_CREATE", "PICKLIST_ACK_LISTENER", "PICKLIST_ACK_READ",
        "PICKLIST_RECOVERY_READ", "OPERATING_SCHEDULE_READ",
        "CLOUDFLARE_REALTIME_SOCKET"
    )
    private val sdkOutcomes = setOf(
        "ATTEMPT", "SUCCESS", "ERROR", "SNAPSHOT", "RECONNECT", "CLOSED",
        "UNCERTAIN", "RETRY", "RECOVERED", "CONNECTED", "ACK", "TIMEOUT"
    )
    internal fun recordTransport(operation: String, outcome: String) {
        if (operation !in sdkOperations || outcome !in sdkOutcomes) return
        val hour = java.time.Instant.now().toString().take(13)
        val key = "$hour|$operation|$outcome"
        synchronized(metricLock) {
            if (!sdkCounts.containsKey(key) && sdkCounts.size >= 320) {
                sdkOverflow++
                return
            }
            sdkCounts[key] = (sdkCounts[key] ?: 0L) + 1L
        }
    }

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

    internal fun snapshot(journal: JSONObject? = null, compact: Boolean = false): JSONObject {
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
                for ((key, n) in apiCounts.toList().takeLast(if (compact) 24 else 64))
                    out.put(JSONObject().put("utc_hour_route_method_status", key)
                        .put("attempts", n).put("elapsed_sum_ms", apiElapsedMs[key] ?: 0L))
                out
            })
            .put("sdk_transport_source", "LOCAL_CALLBACK_COUNTS_NOT_FIREBASE_BILLED_OPERATIONS")
            .put("sdk_transport_dropped_buckets", synchronized(metricLock) { sdkOverflow })
            .put("sdk_transport_omitted_old_buckets", synchronized(metricLock) {
                (sdkCounts.size - if (compact) 24 else 64).coerceAtLeast(0)
            })
            .put("http_omitted_old_buckets", synchronized(metricLock) {
                (apiCounts.size - if (compact) 24 else 64).coerceAtLeast(0)
            })
            .put("sdk_transport_groups", synchronized(metricLock) {
                val out = JSONArray()
                for ((key, n) in sdkCounts.toList().takeLast(if (compact) 24 else 64))
                    out.put(JSONObject().put("utc_hour_operation_outcome", key).put("observed_callbacks", n))
                out
            })
            .put("reporter_ui_source", "BOUNDED_LOCAL_UI_COUNTS_NOT_PROVIDER_BILLING")
            .put("reporter_ui_evicted_buckets", synchronized(metricLock) { reporterUiEvictedBuckets })
            .put("reporter_ui_omitted_old_buckets", synchronized(metricLock) {
                (reporterUiCounts.size - if (compact) 24 else 64).coerceAtLeast(0)
            })
            .put("reporter_ui_groups", synchronized(metricLock) {
                val out = JSONArray()
                for ((key, n) in reporterUiCounts.toList().takeLast(if (compact) 24 else 64))
                    out.put(JSONObject().put("utc_hour_reason", key).put("occurrences", n))
                out
            })
            .put("reporter_ui_recent_frames_source", "RAM_32_STATES_NOT_PROVIDER_BILLING")
            .put("reporter_ui_recent_frames", synchronized(metricLock) {
                val out = JSONArray()
                for (frame in reporterFrames) out.put(frame)
                out
            })
            .put("hourly", counts)
    }
}
