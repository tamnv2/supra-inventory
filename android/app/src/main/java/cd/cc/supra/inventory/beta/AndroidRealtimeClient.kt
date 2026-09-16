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

// Foreground realtime invalidation client. Authoritative data is always re-read from the API after an event.
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
                if (payload.optString("type") != "invalidate") return
                val array = payload.optJSONArray("scopes") ?: return
                val scopes = linkedSetOf<String>()
                for (index in 0 until array.length()) {
                    val value = array.optString(index).trim()
                    if (value.isNotBlank()) scopes += value
                }
                if (scopes.isNotEmpty()) onInvalidate(scopes)
            } catch (_: Exception) {
                // Ignore malformed frames; authoritative API snapshots remain the source of truth.
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
