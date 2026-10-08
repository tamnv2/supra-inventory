package cd.cc.supra.inventory.beta

import org.json.JSONArray
import org.json.JSONObject

/** D166: summarize the journal at an existing support-log boundary. No timer, IO or listener. */
internal object D166UsageAudit {
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
            .put("http_attempts", JSONObject.NULL)
            .put("http_reason", "NOT_INSTRUMENTED_YET")
            .put("hourly", counts)
    }
}
