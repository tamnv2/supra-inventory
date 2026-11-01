package cd.cc.supra.inventory.beta

import org.json.JSONObject

/** Only unresolved online requests are retained, in RAM, for an explicit same-intent retry. */
internal class D173IntentJournal {
    data class Intent(val key: String, val requestId: String)
    private val entries = linkedMapOf<String, Intent>()

    @Synchronized fun begin(owner: String, operation: String, body: JSONObject, proposedId: String): Intent {
        val business = JSONObject()
        body.keys().asSequence().filter { it !in setOf("request_id", "d173_request_id", "read_model") }.sorted().forEach { business.put(it, body.get(it)) }
        val key = "$owner|$operation|$business"
        entries[key]?.let { return it }
        if (entries.size >= 32) throw IllegalStateException("Cần xác minh các thao tác chưa có kết quả trước khi gửi thêm.")
        return Intent(key, proposedId).also { entries[key] = it }
    }

    @Synchronized fun settle(intent: Intent, status: Int) {
        if (status in 200..299 || (status in 400..499 && status != 429)) entries.remove(intent.key)
    }

    @Synchronized fun clear() = entries.clear()
}
