package cd.cc.supra.inventory.beta

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class D173ReadModelTest {
    private val api = InventoryApi("https://unused.invalid", "test")
    private fun wrapper(kind: String, params: JSONObject, snapshot: JSONObject): JSONObject = JSONObject()
        .put("view", JSONObject().put("kind", kind).put("params", params))
        .put("revision", JSONObject().put("latest_seq", 7).put("stream_epoch", "e"))
        .put("snapshot", snapshot)

    @Test fun reporterParserUsesSameServerClockAndRejectsChangedFilterCoverage() {
        val params = JSONObject().put("limit", "200").put("recent_limit", "200").put("recent_scope", "APP_TODAY_OPEN").put("include_overdue", "0")
        val snapshot = JSONObject().put("queue", JSONObject().put("items", JSONArray()).put("total", 0))
            .put("recent", JSONObject().put("items", JSONArray()).put("totals", JSONObject()).put("server_now_ms", 1793494800000L))
            .put("counters", JSONObject().put("queue_total", 0).put("overdue_total", 0))
        val value = wrapper("REPORTER", params, snapshot)
        assertEquals(1793494800000L, api.parseReporterReadModel(value)!!.recent.serverNowMs)
        params.put("status", "HAS_STOCK")
        assertNull(api.parseReporterReadModel(value))
        params.remove("status")
        value.remove("revision")
        assertNull(api.parseReporterReadModel(value))
    }

    @Test fun pickerParserRejectsOtherViewScopeAndMissingSections() {
        val params = JSONObject().put("limit", "200").put("scope", "APP_TODAY_OPEN").put("result_limit", "50").put("display_only", "1")
        val snapshot = JSONObject().put("reports", JSONObject().put("items", JSONArray())).put("results", JSONObject().put("items", JSONArray()))
        val value = wrapper("PICKER", params, snapshot)
        assertNotNull(api.parsePickerReadModel(value))
        params.put("scope", "ALL")
        assertNull(api.parsePickerReadModel(value))
        params.put("scope", "APP_TODAY_OPEN")
        snapshot.remove("results")
        assertNull(api.parsePickerReadModel(value))
    }
}
