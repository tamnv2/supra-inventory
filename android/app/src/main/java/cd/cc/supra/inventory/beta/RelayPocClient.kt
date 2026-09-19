package cd.cc.supra.inventory.beta

import android.os.SystemClock
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.UUID
import java.util.concurrent.TimeUnit

data class RelayProbeResult(
    val requestId: String,
    val agentId: String,
    val agentNetwork: String,
    val roundTripMs: Long,
)

private class RelayHttpException(val status: Int, message: String) : IOException(message)

class RelayPocClient(private val api: InventoryApi) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(9, TimeUnit.SECONDS)
        .callTimeout(12, TimeUnit.SECONDS)
        .build()

    fun close() {
        http.dispatcher.cancelAll()
    }

    fun sendProbe(suffix: String): RelayProbeResult {
        require(suffix.matches(Regex("^\\d{5}$"))) { "Picklist phải đúng 5 số." }
        val current = api.session ?: throw ApiException(401, "AUTH_REQUIRED", "Chưa đăng nhập.")
        return try {
            executeProbe(current, suffix)
        } catch (error: RelayHttpException) {
            if (error.status != 401) throw error
            executeProbe(api.refreshSessionForRelay(), suffix)
        }
    }

    private fun executeProbe(session: AppSession, suffix: String): RelayProbeResult {
        val databaseUrl = BuildConfig.FIREBASE_RTDB_URL.trim().trimEnd('/')
        if (databaseUrl.isBlank()) throw IllegalStateException("Relay Beta chưa được cấu hình.")
        val requestId = UUID.randomUUID().toString()
        val url = jobUrl(databaseUrl, session, requestId)
        val started = SystemClock.elapsedRealtime()
        val payload = JSONObject()
            .put("request_id", requestId)
            .put("suffix", suffix)
            .put("status", "PENDING")
            .put("source", "ANDROID_POC")
            .put("client_sent_at_ms", System.currentTimeMillis())

        try {
            val put = Request.Builder()
                .url(url)
                .put(payload.toString().toRequestBody(jsonType))
                .header("Accept", "application/json")
                .build()
            http.newCall(put).execute().use { response ->
                if (!response.isSuccessful) throw RelayHttpException(response.code, firebaseError(response.code, response.body?.string()))
            }

            val streamRequest = Request.Builder()
                .url(url)
                .get()
                .header("Accept", "text/event-stream")
                .build()
            http.newCall(streamRequest).execute().use { response ->
                if (!response.isSuccessful) throw RelayHttpException(response.code, firebaseError(response.code, response.body?.string()))
                val source = response.body?.source() ?: throw IOException("Relay không trả dữ liệu.")
                val data = StringBuilder()
                while (true) {
                    val line = source.readUtf8Line() ?: break
                    if (line.isEmpty()) {
                        if (data.isNotEmpty()) {
                            val ack = parseAck(data.toString())
                            data.setLength(0)
                            if (ack != null) {
                                return RelayProbeResult(
                                    requestId = requestId,
                                    agentId = ack.first,
                                    agentNetwork = ack.second,
                                    roundTripMs = (SystemClock.elapsedRealtime() - started).coerceAtLeast(0L),
                                )
                            }
                        }
                    } else if (line.startsWith("data:")) {
                        data.append(line.substringAfter("data:").trim())
                    }
                }
            }
            throw SocketTimeoutException("Máy xử lý chưa trả ACK.")
        } catch (error: SocketTimeoutException) {
            throw IOException("Quá 8 giây chưa nhận phản hồi từ máy xử lý.", error)
        } finally {
            cleanup(url)
        }
    }

    private fun parseAck(raw: String): Pair<String, String>? {
        return try {
            val envelope = JSONObject(raw)
            val data = envelope.optJSONObject("data") ?: return null
            if (data.optString("status") != "ACK") return null
            val agentId = data.optString("agent_id").ifBlank { "Agent" }
            val network = data.optString("agent_network").ifBlank { "UNKNOWN" }
            agentId to network
        } catch (_: Exception) {
            null
        }
    }

    private fun cleanup(url: HttpUrl) {
        try {
            http.newCall(Request.Builder().url(url).delete().build()).execute().close()
        } catch (_: Exception) {
        }
    }

    private fun jobUrl(databaseUrl: String, session: AppSession, requestId: String): HttpUrl =
        databaseUrl.toHttpUrl().newBuilder()
            .addPathSegment("relay_poc")
            .addPathSegment(session.userId)
            .addPathSegment("jobs")
            .addPathSegment(requestId + ".json")
            .addQueryParameter("auth", session.idToken)
            .build()

    private fun firebaseError(status: Int, body: String?): String {
        val detail = try { JSONObject(body.orEmpty()).optString("error") } catch (_: Exception) { "" }
        return when (status) {
            401 -> "Phiên Firebase cần làm mới."
            403 -> "Relay từ chối quyền truy cập."
            404 -> "Firebase RTDB Beta chưa được tạo."
            else -> detail.ifBlank { "Relay lỗi HTTP " + status + "." }
        }
    }
}
