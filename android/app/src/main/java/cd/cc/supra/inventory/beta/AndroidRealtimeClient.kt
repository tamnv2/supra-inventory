package cd.cc.supra.inventory.beta

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.min

// Foreground realtime: ordered sequence + bounded delta recovery. Database/API remain authoritative.
class AndroidRealtimeClient(
    private val api: InventoryApi,
    private val baseUrl: String,
    private val onInvalidate: (Set<String>) -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    @Volatile private var stopped = true
    @Volatile private var connecting = false
    @Volatile private var socket: WebSocket? = null
    @Volatile private var reconnectDelayMs = 1_000L
    @Volatile private var recovering = false
    @Volatile private var lastSeq = 0L

    fun start() {
        if (!stopped) return
        stopped = false
        reconnectDelayMs = 1_000L
        connectAsync()
    }

    fun stop() {
        stopped = true
        connecting = false
        mainHandler.removeCallbacksAndMessages(null)
        socket?.close(1000, "session-ended")
        socket = null
        client.dispatcher.cancelAll()
        client.connectionPool.evictAll()
        executor.shutdownNow()
    }

    private fun connectAsync() {
        if (stopped || connecting || executor.isShutdown) return
        connecting = true
        executor.execute {
            try {
                val ticket = api.createRealtimeTicket()
                if (stopped) {
                    connecting = false
                    return@execute
                }
                val request = Request.Builder()
                    .url(websocketUrl(ticket))
                    .header("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
                    .build()
                client.newWebSocket(request, listener())
            } catch (_: Exception) {
                connecting = false
                scheduleReconnect()
            }
        }
    }

    private fun listener(): WebSocketListener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            if (stopped) {
                webSocket.close(1000, "stopped")
                return
            }
            socket = webSocket
            connecting = false
            reconnectDelayMs = 1_000L
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            try {
                val payload = JSONObject(text)
                when (payload.optString("type")) {
                    "connected" -> {
                        val latest = payload.optLong("latest_seq", 0L)
                        if (latest > lastSeq) recoverDeltaAsync("connected")
                    }
                    "invalidate" -> handleInvalidate(payload)
                }
            } catch (_: Exception) {
                reconcileAuthoritatively()
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, reason)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            if (socket === webSocket) socket = null
            connecting = false
            scheduleReconnect()
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            if (socket === webSocket) socket = null
            connecting = false
            scheduleReconnect()
        }
    }

    private fun handleInvalidate(payload: JSONObject) {
        val seq = payload.optLong("seq", 0L)
        if (seq <= 0L) {
            reconcileAuthoritatively()
            return
        }
        if (seq <= lastSeq) return
        if (lastSeq > 0L && seq > lastSeq + 1L) {
            recoverDeltaAsync("sequence_gap")
            return
        }
        lastSeq = seq
        dispatchScopes(readScopes(payload))
    }

    private fun recoverDeltaAsync(reason: String) {
        if (stopped || recovering || executor.isShutdown) return
        recovering = true
        executor.execute {
            try {
                recoverDelta(reason)
            } finally {
                recovering = false
            }
        }
    }

    private fun recoverDelta(reason: String) {
        var cursor = lastSeq
        val scopes = linkedSetOf<String>()
        try {
            repeat(8) {
                if (stopped) return
                val page = api.getRealtimeDelta(cursor, 100)
                val ordered = page.events.filter { it.seq > cursor }.sortedBy { it.seq }
                for (event in ordered) {
                    if (event.seq <= cursor) continue
                    if (cursor > 0L && event.seq > cursor + 1L) {
                        reconcileAuthoritatively()
                        return
                    }
                    cursor = event.seq
                    scopes += event.scopes
                }
                if (page.cursorSeq > cursor) cursor = page.cursorSeq
                lastSeq = cursor
                if (page.complete) {
                    dispatchScopes(scopes)
                    return
                }
            }
            reconcileAuthoritatively()
        } catch (_: Exception) {
            if (reason.isNotBlank()) reconcileAuthoritatively()
        }
    }

    private fun readScopes(payload: JSONObject): Set<String> {
        val array = payload.optJSONArray("scopes") ?: return emptySet()
        val scopes = linkedSetOf<String>()
        for (index in 0 until array.length()) {
            val value = array.optString(index).trim()
            if (value.isNotBlank()) scopes += value
        }
        return scopes
    }

    private fun dispatchScopes(scopes: Set<String>) {
        if (scopes.isEmpty() || stopped) return
        mainHandler.post { if (!stopped) onInvalidate(scopes) }
    }

    private fun reconcileAuthoritatively() {
        dispatchScopes(setOf("picker_reports", "reporter_queue", "reporter_recent", "sku_catalog"))
    }

    private fun scheduleReconnect() {
        if (stopped) return
        val delay = reconnectDelayMs
        reconnectDelayMs = min(15_000L, (reconnectDelayMs * 18L) / 10L)
        mainHandler.postDelayed({ connectAsync() }, delay)
    }

    private fun websocketUrl(ticket: String): String {
        val root = when {
            baseUrl.startsWith("https://") -> "wss://${baseUrl.removePrefix("https://")}"
            baseUrl.startsWith("http://") -> "ws://${baseUrl.removePrefix("http://")}"
            else -> baseUrl
        }.trimEnd('/')
        val encoded = URLEncoder.encode(ticket, StandardCharsets.UTF_8.toString())
        return "$root/api/realtime/connect?ticket=$encoded"
    }
}
