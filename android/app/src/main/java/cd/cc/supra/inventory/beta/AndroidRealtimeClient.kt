package cd.cc.supra.inventory.beta

import android.content.Context
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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.min

// Foreground realtime: global scan cursor + role-authorized delta + applied-state recovery.
class AndroidRealtimeClient(
    context: Context,
    private val api: InventoryApi,
    private val baseUrl: String,
    private val userId: String,
    private val onApply: (Set<String>, (Boolean) -> Unit) -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    private val prefs = context.getSharedPreferences("realtime_cursor_v3", Context.MODE_PRIVATE)

    @Volatile private var stopped = true
    @Volatile private var connecting = false
    @Volatile private var socket: WebSocket? = null
    @Volatile private var reconnectDelayMs = 1_000L
    @Volatile private var recovering = false
    @Volatile private var dirtyRecoveryScheduled = false
    @Volatile private var appliedSeq = prefs.getLong("seq:$userId", 0L).coerceAtLeast(0L)
    @Volatile private var streamEpoch = prefs.getString("epoch:$userId", "").orEmpty()

    fun start() {
        if (!stopped) return
        stopped = false
        reconnectDelayMs = 1_000L
        connectAsync()
    }

    fun diagnosticSnapshot(): Map<String, String> = linkedMapOf(
        "state" to when {
            stopped -> "stopped"
            socket != null -> "connected"
            connecting -> "connecting"
            recovering -> "recovering"
            else -> "disconnected"
        },
        "applied_seq" to appliedSeq.toString(),
        "stream_epoch" to streamEpoch.take(80),
        "recovering" to recovering.toString(),
        "dirty_recovery_scheduled" to dirtyRecoveryScheduled.toString(),
    )

    fun stop() {
        stopped = true
        connecting = false
        dirtyRecoveryScheduled = false
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
            if (stopped || executor.isShutdown) return
            executor.execute {
                try {
                    val payload = JSONObject(text)
                    when (payload.optString("type")) {
                        "connected" -> handleConnected(payload)
                        "invalidate" -> handleInvalidate(payload)
                    }
                } catch (_: Exception) {
                    scheduleDirtyRecovery("malformed_frame")
                }
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

    private fun handleConnected(payload: JSONObject) {
        val latest = payload.optLong("latest_seq", 0L).coerceAtLeast(0L)
        val serverEpoch = payload.optString("stream_epoch", streamEpoch)

        when {
            streamEpoch.isNotBlank() && serverEpoch.isNotBlank() && streamEpoch != serverEpoch ->
                reconcileAndCommit("stream_epoch_changed", latest, serverEpoch)
            appliedSeq == 0L && latest > 0L ->
                reconcileAndCommit("initial_authoritative_sync", latest, serverEpoch)
            latest < appliedSeq ->
                reconcileAndCommit("server_sequence_reset", latest, serverEpoch)
            else -> {
                if (streamEpoch.isBlank() && serverEpoch.isNotBlank()) saveApplied(appliedSeq, serverEpoch)
                if (latest > appliedSeq) recoverDelta("connected")
            }
        }
    }

    private fun handleInvalidate(payload: JSONObject) {
        val seq = payload.optLong("seq", 0L)
        if (seq <= 0L) {
            scheduleDirtyRecovery("unsequenced_event")
            return
        }
        if (seq <= appliedSeq) return

        // Global sequence gaps may contain events authorized only for another principal.
        // Recover through server scan cursor instead of requiring Picker events to be +1.
        if (appliedSeq > 0L && seq > appliedSeq + 1L) {
            recoverDelta("sequence_gap")
            return
        }

        val scopes = readScopes(payload)
        if (!applyScopesAndWait(scopes)) {
            scheduleDirtyRecovery("socket_apply_failed")
            return
        }
        saveApplied(seq, streamEpoch)
    }

    private fun recoverDelta(reason: String) {
        if (stopped || recovering || executor.isShutdown) return
        recovering = true
        try {
            var cursor = appliedSeq
            var epoch = streamEpoch
            repeat(8) {
                if (stopped) return
                val page = api.getRealtimeDelta(cursor, epoch, 100)
                val serverEpoch = page.streamEpoch.ifBlank { epoch }

                if (page.resyncRequired || (epoch.isNotBlank() && serverEpoch.isNotBlank() && epoch != serverEpoch)) {
                    reconcileAndCommit(
                        "$reason:${page.resyncReason ?: "stream_reset"}",
                        page.latestSeq,
                        serverEpoch,
                    )
                    return
                }

                val scopes = linkedSetOf<String>()
                page.events
                    .filter { it.seq > cursor }
                    .sortedBy { it.seq }
                    .forEach { event -> scopes += event.scopes }

                if (!applyScopesAndWait(scopes)) {
                    scheduleDirtyRecovery("$reason:delta_apply_failed")
                    return
                }

                val serverCursor = page.cursorSeq.coerceAtLeast(cursor)
                saveApplied(serverCursor, serverEpoch)
                cursor = serverCursor
                epoch = serverEpoch

                if (!page.hasMore || cursor >= page.latestSeq) return
            }

            // The page budget is a continuation boundary only; unseen pages remain unapplied.
            scheduleDirtyRecovery("$reason:delta_page_budget")
        } catch (_: Exception) {
            scheduleDirtyRecovery("$reason:delta_fetch_failed")
        } finally {
            recovering = false
        }
    }

    private fun reconcileAndCommit(reason: String, cursor: Long, epoch: String) {
        if (!applyScopesAndWait(setOf("picker_reports", "reporter_queue", "reporter_recent", "sku_catalog"))) {
            scheduleDirtyRecovery("$reason:reconcile_apply_failed")
            return
        }
        saveApplied(cursor.coerceAtLeast(0L), epoch)
    }

    private fun applyScopesAndWait(scopes: Set<String>): Boolean {
        if (scopes.isEmpty() || stopped) return true
        val latch = CountDownLatch(1)
        var success = false
        mainHandler.post {
            if (stopped) {
                latch.countDown()
                return@post
            }
            try {
                onApply(scopes) {
                    success = it
                    latch.countDown()
                }
            } catch (_: Exception) {
                latch.countDown()
            }
        }
        return try {
            latch.await(20, TimeUnit.SECONDS) && success
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            false
        }
    }

    private fun saveApplied(cursor: Long, epoch: String) {
        appliedSeq = cursor.coerceAtLeast(0L)
        if (epoch.isNotBlank()) streamEpoch = epoch
        prefs.edit()
            .putLong("seq:$userId", appliedSeq)
            .putString("epoch:$userId", streamEpoch)
            .apply()
    }

    private fun scheduleDirtyRecovery(reason: String) {
        if (stopped || dirtyRecoveryScheduled) return
        dirtyRecoveryScheduled = true
        mainHandler.postDelayed({
            dirtyRecoveryScheduled = false
            if (!stopped && !executor.isShutdown) {
                executor.execute { recoverDelta("dirty:$reason") }
            }
        }, 1_500L)
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
