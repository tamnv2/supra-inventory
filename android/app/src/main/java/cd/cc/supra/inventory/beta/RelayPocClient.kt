package cd.cc.supra.inventory.beta

import android.os.SystemClock
import android.util.Base64
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.TimeUnit

data class RelayProbeResult(
    val requestId: String,
    val agentId: String,
    val agentNetwork: String,
    val roundTripMs: Long,
)

private class RelayHttpException(
    val status: Int,
    override val message: String,
) : IOException(message)

private data class RelayFirebaseIdentity(
    val uid: String,
    val audience: String,
    val fingerprint: String,
)

class RelayPocClient(
    private val api: InventoryApi,
    private val log: (String) -> Unit = {},
) {
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
            log("Relay HTTP 401; làm mới Firebase session rồi thử lại.")
            executeProbe(api.refreshSessionForRelay(), suffix)
        }
    }

    private fun executeProbe(session: AppSession, suffix: String): RelayProbeResult {
        val databaseUrl = BuildConfig.FIREBASE_RTDB_URL.trim().trimEnd('/')
        if (databaseUrl.isBlank()) throw IllegalStateException("Relay Beta chưa được cấu hình.")

        val identity = firebaseIdentity(session.idToken)
        val requestId = UUID.randomUUID().toString()
        val url = jobUrl(databaseUrl, identity.uid, session.idToken, requestId)
        val started = SystemClock.elapsedRealtime()
        val payload = JSONObject()
            .put("request_id", requestId)
            .put("suffix", suffix)
            .put("status", "PENDING")
            .put("source", "ANDROID_POC")
            .put("client_sent_at_ms", System.currentTimeMillis())

        log("Relay gửi request=" + shortId(requestId) + " uid=" + identity.fingerprint + " aud=" + identity.audience.ifBlank { "unknown" })
        try {
            val putStarted = SystemClock.elapsedRealtime()
            val put = Request.Builder()
                .url(url)
                .put(payload.toString().toRequestBody(jsonType))
                .header("Accept", "application/json")
                .build()
            http.newCall(put).execute().use { response ->
                val elapsed = SystemClock.elapsedRealtime() - putStarted
                if (!response.isSuccessful) {
                    val body = response.body?.string()
                    val message = firebaseError(response.code, body)
                    log("Relay PUT HTTP " + response.code + " " + elapsed + "ms · " + message)
                    throw RelayHttpException(response.code, message)
                }
                log("Relay PUT PASS " + response.code + " " + elapsed + "ms")
            }

            val streamRequest = Request.Builder()
                .url(url)
                .get()
                .header("Accept", "text/event-stream")
                .build()
            http.newCall(streamRequest).execute().use { response ->
                if (!response.isSuccessful) {
                    val body = response.body?.string()
                    val message = firebaseError(response.code, body)
                    log("Relay SSE HTTP " + response.code + " · " + message)
                    throw RelayHttpException(response.code, message)
                }
                log("Relay SSE connected uid=" + identity.fingerprint)
                val source = response.body?.source() ?: throw IOException("Relay không trả dữ liệu.")
                val data = StringBuilder()
                while (true) {
                    val line = source.readUtf8Line() ?: break
                    if (line.isEmpty()) {
                        if (data.isNotEmpty()) {
                            val ack = parseAck(data.toString())
                            data.setLength(0)
                            if (ack != null) {
                                val total = (SystemClock.elapsedRealtime() - started).coerceAtLeast(0L)
                                log("Relay ACK request=" + shortId(requestId) + " agent=" + ack.first + " network=" + ack.second + " rtt=" + total + "ms")
                                return RelayProbeResult(
                                    requestId = requestId,
                                    agentId = ack.first,
                                    agentNetwork = ack.second,
                                    roundTripMs = total,
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
            log("Relay timeout request=" + shortId(requestId))
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
            http.newCall(Request.Builder().url(url).delete().build()).execute().use { response ->
                if (!response.isSuccessful) log("Relay cleanup HTTP " + response.code)
            }
        } catch (error: Exception) {
            log("Relay cleanup lỗi: " + safeText(error.message))
        }
    }

    private fun firebaseIdentity(idToken: String): RelayFirebaseIdentity {
        val parts = idToken.split('.')
        if (parts.size != 3) throw IllegalStateException("Firebase ID token không hợp lệ.")
        val decoded = try {
            Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        } catch (_: Exception) {
            throw IllegalStateException("Không đọc được Firebase ID token.")
        }
        val payload = try {
            JSONObject(String(decoded, Charsets.UTF_8))
        } catch (_: Exception) {
            throw IllegalStateException("Firebase ID token thiếu payload hợp lệ.")
        }
        val uid = payload.optString("sub").trim()
        if (uid.isBlank() || uid.length > 128) throw IllegalStateException("Firebase UID trong phiên không hợp lệ.")
        val audience = payload.optString("aud").trim()
        return RelayFirebaseIdentity(uid, audience, fingerprint(uid))
    }

    private fun jobUrl(databaseUrl: String, firebaseUid: String, idToken: String, requestId: String): HttpUrl =
        databaseUrl.toHttpUrl().newBuilder()
            .addPathSegment("relay_poc")
            .addPathSegment(firebaseUid)
            .addPathSegment("jobs")
            .addPathSegment(requestId + ".json")
            .addQueryParameter("auth", idToken)
            .build()

    private fun firebaseError(status: Int, body: String?): String {
        val detail = try { JSONObject(body.orEmpty()).optString("error") } catch (_: Exception) { "" }
        val cleanDetail = safeText(detail).take(180)
        return when (status) {
            401 -> "Phiên Firebase cần làm mới."
            403 -> "RTDB từ chối quyền (HTTP 403). Kiểm tra Rules và Firebase UID." + if (cleanDetail.isBlank()) "" else " " + cleanDetail
            404 -> "Không tìm thấy Firebase RTDB Beta."
            else -> cleanDetail.ifBlank { "Relay lỗi HTTP " + status + "." }
        }
    }

    private fun fingerprint(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
            .take(12)

    private fun shortId(value: String): String = value.take(8)

    private fun safeText(value: String?): String {
        if (value.isNullOrBlank()) return ""
        var next = value.take(240)
        next = next.replace(Regex("(?i)(authorization|bearer|token|password|secret|api[_ -]?key)\\s*[:=]\\s*[^\\s,;]+")) {
            it.groupValues[1] + "=[REDACTED]"
        }
        next = next.replace(Regex("eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}"), "[REDACTED_JWT]")
        return next
    }
}
