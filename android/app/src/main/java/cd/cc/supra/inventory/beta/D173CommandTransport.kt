package cd.cc.supra.inventory.beta

import okhttp3.WebSocket
import org.json.JSONObject
import java.net.URLDecoder
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/** RAM-only, negotiated RPC. No offline outbox and no transport change for HA/ACK. */
internal class D173CommandTransport(private val currentSession: () -> AppSession?) {
    private data class Channel(val socket: WebSocket, val owner: AppSession, val operations: Set<String>, val expires: Long)
    private data class Pending(val owner: AppSession, val result: CompletableFuture<Pair<Int, String>>)
    @Volatile private var channel: Channel? = null
    private val pending = ConcurrentHashMap<String, Pending>()

    fun configure(socket: WebSocket, frame: JSONObject) {
        reset()
        val owner = currentSession() ?: return
        val capabilities = frame.optJSONObject("capabilities") ?: return
        if (capabilities.optString("protocol") != "d173-v2") return
        val expires = frame.optLong("auth_expires_at_ms", 0L)
        if (expires <= System.currentTimeMillis()) return
        val array = capabilities.optJSONArray("operations") ?: return
        val operations = (0 until array.length()).map { array.optString(it) }.filter { it.isNotBlank() }.toSet()
        channel = Channel(socket, owner, operations, expires)
    }

    fun reset(socket: WebSocket? = null) {
        if (socket != null && channel?.socket !== socket) return
        channel = null
        pending.values.forEach { it.result.completeExceptionally(IllegalStateException("TRANSPORT_CLOSED")) }
        pending.clear()
    }

    fun accept(frame: JSONObject): Boolean {
        if (frame.optString("type") != "response") return false
        val request = pending[frame.optString("request_id")] ?: return true
        if (!sameSession(currentSession(), request.owner)) {
            request.result.completeExceptionally(IllegalStateException("SESSION_CHANGED"))
            return true
        }
        val status = frame.optInt("status", 0)
        D166UsageAudit.recordTransport("CLOUDFLARE_COMMAND", if (status in 200..299) "SUCCESS" else "ERROR")
        if (status in 200..499 && status != 426 && status != 429) {
            request.result.complete(status to (frame.optJSONObject("payload") ?: JSONObject()).toString())
        } else request.result.completeExceptionally(IllegalStateException("TRANSPORT_UNSUPPORTED"))
        return true // Never let an RPC result advance the realtime cursor.
    }

    fun execute(method: String, path: String, body: JSONObject?, owner: AppSession, http: () -> Pair<Int, String>): Pair<Int, String> {
        val operation = operation(method, path) ?: return http()
        val active = channel ?: return http()
        if (!sameSession(active.owner, owner) || active.expires <= System.currentTimeMillis() ||
            operation !in active.operations || pending.size >= 32) return http()
        val args = body?.let { JSONObject(it.toString()) } ?: JSONObject().also { value ->
            path.substringAfter('?', "").split('&').filter { it.isNotBlank() }.forEach { part ->
                value.put(URLDecoder.decode(part.substringBefore('='), "UTF-8"), URLDecoder.decode(part.substringAfter('=', ""), "UTF-8"))
            }
        }
        val requestId = args.optString("d173_request_id").ifBlank { args.optString("request_id").ifBlank { UUID.randomUUID().toString() } }
        val message = JSONObject().put("type", "request").put("request_id", requestId).put("operation", operation).put("args", args).toString()
        if (message.toByteArray(Charsets.UTF_8).size > 16 * 1024) return http()
        val result = CompletableFuture<Pair<Int, String>>()
        if (pending.putIfAbsent(requestId, Pending(owner, result)) != null) return http()
        try {
            D166UsageAudit.recordTransport("CLOUDFLARE_COMMAND", "ATTEMPT")
            if (!active.socket.send(message)) return checkedHttp(owner, http)
            // 50ms on read paths produced repeated hedged GETs while WS was still active.
            // Bound the read wait; keep mutation hedging fast and idempotent.
            val wsWaitMs = if (method == "GET") 250L else 50L
            try { return result.get(wsWaitMs, TimeUnit.MILLISECONDS) }
            catch (_: TimeoutException) {
                D166UsageAudit.recordTransport("CLOUDFLARE_COMMAND", "TIMEOUT")
                // Race an HTTP hedge, using exactly the same durable mutation key.
                val fallback = CompletableFuture.supplyAsync { checkedHttp(owner, http) }
                val winner = CompletableFuture<Pair<Int, String>>()
                result.thenAccept { winner.complete(it) }
                fallback.whenComplete { value, error ->
                    if (error != null) winner.completeExceptionally(error) else winner.complete(value)
                }
                return winner.get().also { if (!sameSession(currentSession(), owner)) throw IllegalStateException("SESSION_CHANGED") }
            }
            catch (_: Exception) { return checkedHttp(owner, http) }
        } finally { pending.remove(requestId) }
    }

    private fun checkedHttp(owner: AppSession, http: () -> Pair<Int, String>): Pair<Int, String> {
        if (!sameSession(currentSession(), owner)) throw IllegalStateException("SESSION_CHANGED")
        D166UsageAudit.recordTransport("CLOUDFLARE_COMMAND", "RETRY")
        return http().also { if (!sameSession(currentSession(), owner)) throw IllegalStateException("SESSION_CHANGED") }
    }

    private fun sameSession(left: AppSession?, right: AppSession): Boolean = left?.userId == right.userId && left.idToken == right.idToken

    companion object {
        fun operation(method: String, path: String): String? = when ("$method ${path.substringBefore('?')}") {
            "GET /api/realtime/presence" -> "realtime.presence"
            "GET /api/realtime/delta" -> "realtime.delta"
            "GET /api/reporter/snapshot" -> "reporter.snapshot"
            "GET /api/picker/snapshot" -> "picker.snapshot"
            "GET /api/skus/catalog-info" -> "sku.catalog.info"
            "GET /api/skus/catalog-delta" -> "sku.catalog.delta"
            "POST /api/picker/reports" -> "shortage.create"
            "POST /api/picker/reports/withdraw" -> "shortage.withdraw"
            "POST /api/reporter/batches/resolve" -> "shortage.resolve"
            "POST /api/reporter/batches/correct" -> "shortage.correct"
            else -> null
        }
    }
}
