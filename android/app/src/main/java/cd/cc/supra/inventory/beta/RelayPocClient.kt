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
    val cacheMode: String,
    val rateStrikes: Int,
    val lockLevel: Int,
    val lockedUntilMs: Long,
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
    val cacheMode: String,
    val rateStrikes: Int,
    val lockLevel: Int,
    val lockedUntilMs: Long,
)

class RelayPocClient(
    private val api: InventoryApi,
    private val log: (String) -> Unit = {},
    private val onProgress: (String) -> Unit = {},
) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .callTimeout(15, TimeUnit.SECONDS)
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
            log("D091 Firestore HTTP 401; làm mới Firebase session rồi thử lại.")
            executeProbe(api.refreshSessionForRelay(), suffix)
        }
    }

    private fun executeProbe(session: AppSession, suffix: String): RelayProbeResult {
        val collectionUrl = BuildConfig.FIRESTORE_RELAY_COLLECTION_URL.trim()
        if (collectionUrl.isBlank()) throw IllegalStateException("Firestore relay Beta chưa được cấu hình.")

        val identity = firebaseIdentity(session.idToken)
        val requestId = UUID.randomUUID().toString()
        val documentUrl = collectionUrl.trimEnd('/') + "/" + requestId
        val started = SystemClock.elapsedRealtime()

        val fields = JSONObject()
            .put("request_id", stringValue(requestId))
            .put("suffix", stringValue(suffix))
            .put("status", stringValue("PENDING"))
            .put("source", stringValue("ANDROID_CONFIRM_V1"))
            .put("picker_uid", stringValue(identity.uid))
            .put("picker_user_id", stringValue(session.userId))
            .put("client_sent_at_ms", integerValue(System.currentTimeMillis()))
        val payload = JSONObject().put("fields", fields)

        log(
            "D091 Firestore gửi request=" + shortId(requestId) +
                " picker_uid=" + identity.fingerprint +
                " aud=" + identity.audience.ifBlank { "unknown" }
        )
        onProgress("Đang gửi qua Firestore...")

        try {
            val createUrl = collectionUrl.toHttpUrl().newBuilder()
                .addQueryParameter("documentId", requestId)
                .build()
            executeJson(
                Request.Builder()
                    .url(createUrl)
                    .post(payload.toString().toRequestBody(jsonType))
                    .header("Authorization", "Bearer " + session.idToken)
                    .header("Accept", "application/json")
                    .build(),
                "CREATE"
            )
            log("D091 Firestore CREATE PASS request=" + shortId(requestId))
            onProgress("Đã gửi Firestore · đang chờ Agent Office...")

            val deadline = SystemClock.elapsedRealtime() + 120_000L
            while (SystemClock.elapsedRealtime() < deadline) {
                val raw = executeJson(
                    Request.Builder()
                        .url(documentUrl)
                        .get()
                        .header("Authorization", "Bearer " + session.idToken)
                        .header("Accept", "application/json")
                        .build(),
                    "GET"
                )
                val docFields = try { JSONObject(raw).optJSONObject("fields") } catch (_: Exception) { null }
                val currentStatus = fieldString(docFields ?: JSONObject(), "status")
                if (currentStatus == "PENDING" && SystemClock.elapsedRealtime() - started > 15_000L) {
                    throw IOException("Không có Agent xử lý online. Vui lòng về bàn chuyên viên xử lý trực tiếp.")
                }
                if (currentStatus == "PROCESSING") {
                    onProgress("Agent đang xử lý Picklist...")
                }
                val ack = parseAck(raw)
                if (ack != null) {
                    val total = (SystemClock.elapsedRealtime() - started).coerceAtLeast(0L)
                    log(
                        "D091 Firestore ACK request=" + shortId(requestId) +
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
                        cacheMode = ack.cacheMode,
                        rateStrikes = ack.rateStrikes,
                        lockLevel = ack.lockLevel,
                        lockedUntilMs = ack.lockedUntilMs,
                    )
                }
                Thread.sleep(1_000L)
            }

            throw SocketTimeoutException("Yêu cầu đã gửi nhưng quá 120 giây chưa hoàn tất.")
        } catch (error: SocketTimeoutException) {
            log("D091 Firestore timeout request=" + shortId(requestId))
            throw IOException(error.message ?: "Agent Office chưa phản hồi.", error)
        } finally {
            cleanup(documentUrl, session.idToken)
        }
    }

    private fun executeJson(request: Request, operation: String): String {
        http.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = firestoreError(response.code, body)
                log("D091 Firestore " + operation + " HTTP " + response.code + " · " + message)
                throw RelayHttpException(response.code, message)
            }
            return body
        }
    }

    private fun parseAck(raw: String): RelayAck? {
        return try {
            val fields = JSONObject(raw).optJSONObject("fields") ?: return null
            val status = fieldString(fields, "status")
            if (status != "ACK") return null
            RelayAck(
                agentId = fieldString(fields, "agent_id").ifBlank { "Agent" },
                agentNetwork = fieldString(fields, "agent_network").ifBlank { "UNKNOWN" },
                adminUserId = fieldString(fields, "agent_admin_user_id").ifBlank { "ADMIN" },
                agentInstanceId = fieldString(fields, "agent_instance_id").ifBlank { "UNKNOWN" },
                lookupStatus = fieldString(fields, "lookup_status").ifBlank { "TRANSPORT_ONLY" },
                lookupMatches = fieldLong(fields, "lookup_matches").toInt().coerceAtLeast(0),
                lookupMs = fieldLong(fields, "lookup_ms").coerceAtLeast(0L),
                cacheMode = fieldString(fields, "cache_mode").ifBlank { "NONE" },
                rateStrikes = fieldLong(fields, "rate_strikes").toInt().coerceAtLeast(0),
                lockLevel = fieldLong(fields, "lock_level").toInt().coerceAtLeast(0),
                lockedUntilMs = fieldLong(fields, "locked_until_ms").coerceAtLeast(0L),
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun cleanup(documentUrl: String, idToken: String) {
        try {
            http.newCall(
                Request.Builder()
                    .url(documentUrl)
                    .delete()
                    .header("Authorization", "Bearer " + idToken)
                    .build()
            ).execute().use { response ->
                if (!response.isSuccessful && response.code != 404) {
                    log("D091 Firestore cleanup HTTP " + response.code)
                }
            }
        } catch (error: Exception) {
            log("D091 Firestore cleanup lỗi: " + safeText(error.message))
        }
    }

    private fun stringValue(value: String): JSONObject =
        JSONObject().put("stringValue", value)

    private fun integerValue(value: Long): JSONObject =
        JSONObject().put("integerValue", value.toString())

    private fun fieldString(fields: JSONObject, key: String): String =
        fields.optJSONObject(key)?.optString("stringValue").orEmpty()

    private fun fieldLong(fields: JSONObject, key: String): Long =
        fields.optJSONObject(key)?.optString("integerValue")?.toLongOrNull() ?: 0L

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

    private fun firestoreError(status: Int, body: String?): String {
        val detail = try {
            JSONObject(body.orEmpty()).optJSONObject("error")?.optString("message").orEmpty()
        } catch (_: Exception) {
            ""
        }
        val clean = safeText(detail).take(180)
        return when (status) {
            401 -> "Phiên Firebase cần làm mới."
            403 -> "Firestore từ chối quyền D091 (HTTP 403)."
            404 -> "Firestore Beta chưa sẵn sàng hoặc collection chưa tồn tại."
            409 -> "Request Firestore đã tồn tại; vui lòng thử lại."
            else -> clean.ifBlank { "Firestore relay lỗi HTTP " + status + "." }
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
