package cd.cc.supra.inventory.beta

import okhttp3.Request
import okhttp3.WebSocket
import okio.ByteString
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class D173CommandTransportTest {
    private fun owner(id: String = "u") = AppSession("id-$id", "refresh", id, "Name", "REPORTER", null)
    private class Socket(var onSend: (JSONObject) -> Unit = {}) : WebSocket {
        val sent = mutableListOf<JSONObject>()
        override fun request() = Request.Builder().url("https://inventory.supra.cc.cd/").build()
        override fun queueSize() = 0L
        override fun send(text: String): Boolean { val frame = JSONObject(text); sent += frame; onSend(frame); return true }
        override fun send(bytes: ByteString) = false
        override fun close(code: Int, reason: String?) = true
        override fun cancel() {}
    }
    private fun config(transport: D173CommandTransport, socket: Socket, operation: String, expiry: Long = System.currentTimeMillis() + 60_000) {
        transport.configure(socket, JSONObject().put("capabilities", JSONObject().put("protocol", "d173-v2").put("operations", JSONArray().put(operation)))
            .put("auth_expires_at_ms", expiry))
    }

    @Test fun negotiatedReadAvoidsHttp() {
        val owner = owner()
        val transport = D173CommandTransport { owner }
        val socket = Socket { frame -> transport.accept(JSONObject().put("type", "response").put("request_id", frame.getString("request_id"))
            .put("status", 200).put("payload", JSONObject().put("online", 2))) }
        config(transport, socket, "realtime.presence")
        val result = transport.execute("GET", "/api/realtime/presence", null, owner) { fail("Unexpected HTTP"); 500 to "{}" }
        assertEquals(200, result.first)
        assertEquals(2, JSONObject(result.second).getInt("online"))
    }

    @Test fun lostReplyUsesSameMutationKeyForHttpHedge() {
        val owner = owner()
        val transport = D173CommandTransport { owner }
        val socket = Socket()
        config(transport, socket, "shortage.resolve")
        val body = JSONObject().put("request_id", "stable-key").put("d173_request_id", "stable-key").put("batch_id", "b")
        var calls = 0
        val result = transport.execute("POST", "/api/reporter/batches/resolve", body, owner) { calls++; 200 to "{\"replayed\":true}" }
        assertEquals(1, calls)
        assertEquals("stable-key", socket.sent.single().getString("request_id"))
        assertEquals("stable-key", socket.sent.single().getJSONObject("args").getString("d173_request_id"))
        assertTrue(JSONObject(result.second).getBoolean("replayed"))
    }

    @Test fun expiredOrUnsupportedChannelUsesExistingHttp() {
        val owner = owner()
        val transport = D173CommandTransport { owner }
        val socket = Socket()
        config(transport, socket, "realtime.presence", System.currentTimeMillis() - 1)
        var calls = 0
        transport.execute("GET", "/api/realtime/presence", null, owner) { calls++; 200 to "{}" }
        transport.execute("POST", "/api/picker/results/receipt", JSONObject(), owner) { calls++; 200 to "{}" }
        assertEquals(2, calls)
        assertTrue(socket.sent.isEmpty())
    }

    @Test fun sessionReplacementRejectsReplyWithoutOldSessionHttp() {
        val first = owner()
        var current = first
        val transport = D173CommandTransport { current }
        val socket = Socket { frame ->
            current = owner("replacement")
            transport.accept(JSONObject().put("type", "response").put("request_id", frame.getString("request_id")).put("status", 200).put("payload", JSONObject()))
        }
        config(transport, socket, "realtime.presence")
        try {
            transport.execute("GET", "/api/realtime/presence", null, first) { fail("Old session HTTP"); 500 to "{}" }
            fail("Replaced session accepted")
        } catch (expected: IllegalStateException) { assertEquals("SESSION_CHANGED", expected.message) }
    }

    @Test fun serverDenialIsNotHiddenByHttpFallback() {
        val owner = owner()
        val transport = D173CommandTransport { owner }
        val socket = Socket { frame -> transport.accept(JSONObject().put("type", "response").put("request_id", frame.getString("request_id"))
            .put("status", 403).put("payload", JSONObject().put("error", "FORBIDDEN"))) }
        config(transport, socket, "realtime.presence")
        assertEquals(403, transport.execute("GET", "/api/realtime/presence", null, owner) { fail("Denial hidden"); 200 to "{}" }.first)
    }

    @Test fun unknownCommit503RecoversCanonicalResultWithOriginalKey() {
        val owner = owner()
        val transport = D173CommandTransport { owner }
        val socket = Socket { frame -> transport.accept(JSONObject().put("type", "response").put("request_id", frame.getString("request_id"))
            .put("status", 503).put("payload", JSONObject().put("error", "COMMAND_TEMPORARILY_UNAVAILABLE"))) }
        config(transport, socket, "shortage.create")
        val body = JSONObject().put("request_id", "original-key").put("d173_request_id", "original-key").put("sku", "S")
        var calls = 0
        val result = transport.execute("POST", "/api/picker/reports", body, owner) {
            calls++
            assertEquals("original-key", body.getString("request_id"))
            200 to "{\"idempotent_replay\":true}"
        }
        assertEquals(1, calls)
        assertTrue(JSONObject(result.second).getBoolean("idempotent_replay"))
    }
}
