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
    val agentAdminUserId: String,
    val agentInstanceId: String,
    val roundTripMs: Long,
    val lookupStatus: String,
    val lookupMatches: Int,
    val lookupMs: Long,
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

private data class RelayAck(
    val agentId: String,
    val agentNetwork: String,
    val adminUserId: String,
    val agentInstanceId: String,
    val lookupStatus: String,
    val lookupMatches: Int,
    val lookupMs: Long,
)

class RelayPocClient(
    private val api: InventoryApi,
    private val log: (String) -> Unit = {},
) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(115, TimeUnit.SECONDS)
        .callTimeout(120, TimeUnit.SECONDS)
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
        val url = jobUrl(databaseUrl, session.idToken, requestId)
        val started = SystemClock.elapsedRealtime()
        val payload = JSONObject()
            .put("request_id", requestId)
            .put("suffix", suffix)
            .put("status", "PENDING")
            .put("source", "ANDROID_POC")
            .put("picker_uid", identity.uid)
            .put("picker_user_id", session.userId)
            .put("client_sent_at_ms", System.currentTimeMillis())

        log("Relay gửi shared request=" + shortId(requestId) + " picker_uid=" + identity.fingerprint + " aud=" + identity.audience.ifBlank { "unknown" })
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
                log("Relay SSE connected shared_job=" + shortId(requestId))
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
                                log(
                                    "Relay ACK request=" + shortId(requestId) +
                                        " admin=" + safeId(ack.adminUserId) +
                                        " agent=" + safeId(ack.agentId) +
                                        " instance=" + safeId(ack.agentInstanceId) +
                                        " network=" + safeId(ack.agentNetwork) +
                                        " rtt=" + total + "ms"
                                )
                                return RelayProbeResult(
                                    requestId = requestId,
                                    agentId = ack.agentId,
                                    agentNetwork = ack.agentNetwork,
                                    agentAdminUserId = ack.adminUserId,
                                    agentInstanceId = ack.agentInstanceId,
                                    roundTripMs = total,
                                    lookupStatus = ack.lookupStatus,
                                    lookupMatches = ack.lookupMatches,
                                    lookupMs = ack.lookupMs,
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
            throw IOException("Quá 2 phút chưa nhận phản hồi tra cứu từ máy xử lý.", error)
        } finally {
            cleanup(url)
        }
    }

    private fun parseAck(raw: String): RelayAck? {
        return try {
            val envelope = JSONObject(raw)
            val data = envelope.optJSONObject("data") ?: return null
            if (data.optString("status") != "ACK") return null
            RelayAck(
                agentId = data.optString("agent_id").ifBlank { "Agent" },
                agentNetwork = data.optString("agent_network").ifBlank { "UNKNOWN" },
                adminUserId = data.optString("agent_admin_user_id").ifBlank { "ADMIN" },
                agentInstanceId = data.optString("agent_instance_id").ifBlank { "UNKNOWN" },
                lookupStatus = data.optString("lookup_status").ifBlank { "TRANSPORT_ONLY" },
                lookupMatches = data.optInt("lookup_matches", 0).coerceAtLeast(0),
                lookupMs = data.optLong("lookup_ms", 0L).coerceAtLeast(0L),
            )
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

    private fun jobUrl(databaseUrl: String, idToken: String, requestId: String): HttpUrl =
        databaseUrl.toHttpUrl().newBuilder()
            .addPathSegment("relay_poc")
            .addPathSegment("jobs")
            .addPathSegment(requestId + ".json")
            .addQueryParameter("auth", idToken)
            .build()

    private fun firebaseError(status: Int, body: String?): String {
        val detail = try { JSONObject(body.orEmpty()).optString("error") } catch (_: Exception) { "" }
        val cleanDetail = safeText(detail).take(180)
        return when (status) {
            401 -> "Phiên Firebase cần làm mới."
            403 -> "RTDB từ chối quyền (HTTP 403). Kiểm tra Rules D075." + if (cleanDetail.isBlank()) "" else " " + cleanDetail
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

    private fun safeId(value: String): String =
        value.filter { it.isLetterOrDigit() || it in "._:@-" }.take(96).ifBlank { "unknown" }

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
