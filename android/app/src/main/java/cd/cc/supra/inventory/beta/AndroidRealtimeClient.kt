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
    private val log: (String) -> Unit = {},
    private val onApply: (Set<String>, List<RealtimeDeltaEvent>, (Boolean) -> Unit) -> Unit,
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
    @Volatile private var pendingSocket: WebSocket? = null
    @Volatile private var connectionAttempt = 0L
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
        pendingSocket?.cancel()
        pendingSocket = null
        socket = null
        client.dispatcher.cancelAll()
        client.connectionPool.evictAll()
        executor.shutdownNow()
    }

    private fun connectAsync() {
        if (stopped || connecting || executor.isShutdown) return
        connecting = true
        val attempt = connectionAttempt + 1L
        connectionAttempt = attempt
        executor.execute {
            try {
                val ticket = api.createRealtimeTicket()
                if (stopped || attempt != connectionAttempt) {
                    connecting = false
                    return@execute
                }
                val request = Request.Builder()
                    .url(websocketUrl(ticket))
                    .header("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
                    .build()
                val pending = client.newWebSocket(request, listener(attempt))
                pendingSocket = pending
                if (socket === pending) pendingSocket = null

                // D130: recover a handshake path that wedges without promptly delivering onFailure.
                mainHandler.postDelayed({
                    if (!stopped &&
                        attempt == connectionAttempt &&
                        connecting &&
                        socket == null &&
                        pendingSocket === pending
                    ) {
                        log("Realtime handshake timeout · tự kết nối lại.")
                        pendingSocket = null
                        connecting = false
                        try { pending.cancel() } catch (_: Exception) { }
                        scheduleReconnect()
                    }
                }, 12_000L)
            } catch (error: Exception) {
                if (attempt == connectionAttempt) {
                    connecting = false
                    pendingSocket = null
                    log("Realtime connect fail · tự kết nối lại: " + (error.message ?: error.javaClass.simpleName))
                    scheduleReconnect()
                }
            }
        }
    }

    private fun listener(attempt: Long): WebSocketListener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            if (stopped || attempt != connectionAttempt) {
                webSocket.close(1000, "stale-attempt")
                return
            }
            socket = webSocket
            if (pendingSocket === webSocket) pendingSocket = null
            connecting = false
            reconnectDelayMs = 1_000L
            log("Realtime WebSocket connected.")
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
            if (pendingSocket === webSocket) pendingSocket = null
            if (attempt != connectionAttempt) return
            connecting = false
            log("Realtime WebSocket closed · tự kết nối lại.")
            scheduleReconnect()
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            if (socket === webSocket) socket = null
            if (pendingSocket === webSocket) pendingSocket = null
            if (attempt != connectionAttempt) return
            connecting = false
            log("Realtime WebSocket fail · tự kết nối lại: " + (t.message ?: t.javaClass.simpleName))
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
        val scopes = readScopes(payload)
        val frame = RealtimeDeltaEvent(
            seq = payload.optLong("seq", 0L),
            event = payload.optString("event"),
            eventId = payload.optString("event_id"),
            scopes = scopes,
            batchId = payload.optString("batch_id").takeIf { it.isNotBlank() },
            batchVersion = payload.optInt("batch_version", -1).takeIf { it >= 0 },
            metadata = payload.optJSONObject("metadata"),
            snapshot = payload.optJSONObject("snapshot"),
        )
        val directCapabilityControl =
            scopes.contains("picker_reporting_enabled") || scopes.contains("picker_reporting_disabled")
        val seq = payload.optLong("seq", 0L)
        if (seq <= 0L) {
            if (directCapabilityControl) {
                if (!applyScopesAndWait(scopes, listOf(frame))) scheduleDirtyRecovery("capability_control_apply_failed")
                return
            }
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

        if (!applyScopesAndWait(scopes, listOf(frame))) {
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

                val events = page.events
                    .filter { it.seq > cursor }
                    .sortedBy { it.seq }
                val scopes = linkedSetOf<String>()
                events.forEach { event -> scopes += event.scopes }

                if (!applyScopesAndWait(scopes, events)) {
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
        if (!applyScopesAndWait(setOf("picker_reports", "reporter_queue", "reporter_recent", "sku_catalog"), emptyList())) {
            scheduleDirtyRecovery("$reason:reconcile_apply_failed")
            return
        }
        saveApplied(cursor.coerceAtLeast(0L), epoch)
    }

    private fun applyScopesAndWait(scopes: Set<String>, events: List<RealtimeDeltaEvent>): Boolean {
        if (scopes.isEmpty() || stopped) return true
        val latch = CountDownLatch(1)
        var success = false
        mainHandler.post {
            if (stopped) {
                latch.countDown()
                return@post
            }
            try {
                onApply(scopes, events) {
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
