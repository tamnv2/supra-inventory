package cd.cc.supra.inventory.beta

import org.json.JSONObject

internal object D166UsageAudit {
    private val lock = Any()
    private var requestAttempts = 0L
    private var totalTimeMs = 0L
    private var errorAttempts = 0L

    internal fun record(status: Int, elapsedMs: Long) {
        synchronized(lock) {
            requestAttempts++
            totalTimeMs += elapsedMs.coerceIn(0L, 120000L)
            if (status !in 200..299) errorAttempts++
        }
    }

    internal fun snapshot(journal: JSONObject? = null): JSONObject = synchronized(lock) {
        JSONObject().put("schema", "D166_RAM_ONLY")
            .put("http_attempts", requestAttempts)
            .put("http_non2xx", errorAttempts)
            .put("http_elapsed_sum_ms", totalTimeMs)
            .put("billing_reads", "NOT_MEASURED")
            .put("journal_dropped_events", journal?.optLong("dropped_events", 0L) ?: 0L)
            .put("journal_captured_events", journal?.optJSONArray("recent_events")?.length() ?: 0)
            .put("journal_window_first_seq", journal?.optLong("first_sequence", 0L) ?: 0L)
            .put("journal_window_last_seq", journal?.optLong("last_sequence", 0L) ?: 0L)
    }
}
