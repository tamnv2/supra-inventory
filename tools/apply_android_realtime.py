#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt"
API = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt"
REALTIME = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidRealtimeClient.kt"
GRADLE = ROOT / "android/app/build.gradle.kts"
STATE = ROOT / "ops/project-state.json"
REGISTRY = ROOT / "ops/resource-registry.json"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL {label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def patch_main() -> None:
    text = MAIN.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "    private lateinit var updateButton: Button\n\n    private var pendingInstallFile: File? = null",
        "    private lateinit var updateButton: Button\n    private var realtimeClient: AndroidRealtimeClient? = null\n\n    private var pendingInstallFile: File? = null",
        "main-field",
    )
    text = replace_once(
        text,
        "    override fun onDestroy() {\n        searchRunnable?.let { ui.removeCallbacks(it) }\n        ui.removeCallbacks(withdrawTicker)\n        super.onDestroy()\n    }",
        "    override fun onDestroy() {\n        searchRunnable?.let { ui.removeCallbacks(it) }\n        ui.removeCallbacks(withdrawTicker)\n        realtimeClient?.stop()\n        realtimeClient = null\n        super.onDestroy()\n    }",
        "main-onDestroy",
    )
    text = replace_once(
        text,
        "    private fun renderLogin(message: String = \"Sẵn sàng đăng nhập Beta.\") {\n        withdrawButtons.clear()",
        "    private fun renderLogin(message: String = \"Sẵn sàng đăng nhập Beta.\") {\n        realtimeClient?.stop()\n        realtimeClient = null\n        withdrawButtons.clear()",
        "main-renderLogin",
    )
    text = replace_once(
        text,
        "                    .setPositiveButton(\"Đăng xuất\") { _, _ ->\n                        api.clearSession()\n                        renderLogin(\"Đã đăng xuất.\")",
        "                    .setPositiveButton(\"Đăng xuất\") { _, _ ->\n                        realtimeClient?.stop()\n                        realtimeClient = null\n                        api.clearSession()\n                        renderLogin(\"Đã đăng xuất.\")",
        "main-logout",
    )
    text = replace_once(
        text,
        "        setContentView(wrapScroll(root))\n    }\n\n    private fun renderPicker(root: LinearLayout) {",
        """        setContentView(wrapScroll(root))
        startRealtime(session)
    }

    private fun startRealtime(session: AppSession) {
        realtimeClient?.stop()
        realtimeClient = AndroidRealtimeClient(
            api = api,
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
        ) { scopes ->
            runOnUiThread {
                if (api.session == null || isFinishing) return@runOnUiThread
                if (session.role == \"PICKER\") {
                    if (scopes.contains(\"picker_reports\")) refreshPickerReports()
                    if (scopes.contains(\"sku_catalog\")) syncSkuCatalog(auto = true)
                } else if (scopes.contains(\"reporter_queue\") || scopes.contains(\"reporter_recent\")) {
                    refreshReporterData()
                }
            }
        }.also { it.start() }
    }

    private fun renderPicker(root: LinearLayout) {""",
        "main-startRealtime",
    )
    MAIN.write_text(text, encoding="utf-8")


def patch_api() -> None:
    text = API.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "    fun getCatalogInfo(): CatalogInfo {",
        """    fun createRealtimeTicket(): String {
        val payload = request(
            method = \"POST\",
            path = \"/api/realtime/ticket\",
            body = JSONObject().put(\"client_type\", \"ANDROID\"),
        )
        return payload.optString(\"ticket\").takeIf { it.isNotBlank() }
            ?: throw IllegalStateException(\"Service không cấp được realtime ticket.\")
    }

    fun getCatalogInfo(): CatalogInfo {""",
        "api-realtime-ticket",
    )
    API.write_text(text, encoding="utf-8")


def write_realtime_client() -> None:
    REALTIME.write_text(
        '''package cd.cc.supra.inventory.beta

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
''',
        encoding="utf-8",
    )


def patch_gradle() -> None:
    text = GRADLE.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '    implementation("androidx.core:core:1.17.0")\n}',
        '    implementation("androidx.core:core:1.17.0")\n    implementation("com.squareup.okhttp3:okhttp:4.12.0")\n}',
        "gradle-okhttp",
    )
    GRADLE.write_text(text, encoding="utf-8")


def update_state() -> None:
    state = json.loads(STATE.read_text(encoding="utf-8"))
    state["current_status"]["realtime"] = "WEBSOCKET_SERVER_WEB_CLIENT_DEPLOYED_PASS_ANDROID_CLIENT_SOURCE_COMMITTED_PENDING_CI"
    completed = state["completed_capabilities"]
    web_done = "Web foreground realtime invalidation client — Beta build/deploy PASS"
    if web_done not in completed:
        completed.append(web_done)
    pending = state["pending_build"]
    pending[:] = [item for item in pending if "Web foreground realtime client" not in item and "Android foreground realtime client" not in item]
    pending.insert(0, "Verify/build/sign/release Android foreground realtime client")
    state["next_action"]["primary"] = "Verify/build/sign/release Android foreground realtime client, then implement FCM background delivery."
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    registry.setdefault("realtime", {})["source_status"] = "SERVER_AND_WEB_CLIENT_DEPLOYED_PASS_ANDROID_CLIENT_SOURCE_COMMITTED_PENDING_CI"
    built = registry["application_build_completed"]
    if "web_foreground_realtime_client" not in built:
        built.append("web_foreground_realtime_client")
    pending_registry = registry["application_build_pending"]
    pending_registry[:] = [item for item in pending_registry if item != "websocket_realtime_protocol_deploy_and_client_wiring"]
    if "android_foreground_realtime_client_verify" not in pending_registry:
        pending_registry.insert(0, "android_foreground_realtime_client_verify")
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    patch_main()
    patch_api()
    write_realtime_client()
    patch_gradle()
    update_state()
    print("ANDROID_REALTIME_PATCH_PASS")


if __name__ == "__main__":
    main()
