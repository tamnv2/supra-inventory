package cd.cc.supra.inventory.beta

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.UUID

data class AppSession(
    val idToken: String,
    val refreshToken: String,
    val userId: String,
    val displayName: String,
    val role: String,
    val employeeCode: String?,
    val relayCustomToken: String? = null,
)

data class AndroidOperatingWindow(
    val isOpen: Boolean,
    val serverNowMs: Long,
    val closesAtMs: Long?,
    val overtimeUntilMs: Long?,
)

data class SkuItem(val sku: String, val productName: String)
data class CatalogInfo(val count: Int, val version: String)
data class CatalogPage(val items: List<SkuItem>, val nextAfter: String?)
data class CatalogDeltaPage(val items: List<SkuItem>, val nextUpdatedAt: String?, val nextSku: String?)

data class PickerReport(
    val ticketId: String,
    val batchId: String,
    val sku: String,
    val productName: String,
    val status: String,
    val batchStatus: String,
    val resolution: String?,
    val reportedAt: String,
    val withdrawDeadlineAt: String,
    val withdrawnAt: String?,
    val resolvedAt: String?,
    val autoSkipDeadlineAt: String? = null,
    val autoSkipAllowedAt: String? = null,
    val resolutionSource: String? = null,
    val batchVersion: Int = 1,
    val previousBatchId: String? = null,
    val resultEventId: String? = null,
    val receivedAt: String? = null,
    val displayedAt: String? = null,
    val acknowledgedAt: String? = null,
)

data class PickerResult(
    val resultEventId: String,
    val batchId: String,
    val batchVersion: Int,
    val sku: String,
    val productName: String,
    val status: String,
    val resolution: String,
    val resolvedAt: String?,
    val receivedAt: String?,
    val displayedAt: String?,
    val acknowledgedAt: String?,
)

data class ReporterBatch(
    val batchId: String,
    val sku: String,
    val productName: String,
    val firstReportAt: String,
    val affectedPickerCount: Int,
    val version: Int = 1,
    val previousBatchId: String? = null,
    val previousResolvedAt: String? = null,
    val recurrenceMinutes: Int? = null,
    val slaState: String = "UNCONFIGURED",
    val waitingMinutes: Int = 0,
    val warningAt: String? = null,
    val escalationAt: String? = null,
    val autoSkipAt: String? = null,
    val autoSkipEnabled: Boolean = false,
    val autoSkipMode: String? = null,
    val serverNow: String? = null,
)

data class ReporterQueueSnapshot(
    val items: List<ReporterBatch>,
    val total: Int,
)

data class ReporterRecentCounts(
    val hasStock: Int = 0,
    val skipAllowed: Int = 0,
    val withdrawn: Int = 0,
)

data class ReporterRecentSnapshot(
    val items: List<ReporterRecent>,
    val counts: ReporterRecentCounts,
)

data class ReporterRecent(
    val batchId: String,
    val sku: String,
    val productName: String,
    val status: String,
    val firstReportAt: String,
    val resolvedAt: String?,
    val resolutionSource: String? = null,
    val resolvedByDisplayName: String? = null,
    val resolvedByEmployeeCode: String? = null,
    val correctionDeadlineAt: String?,
    val affectedPickerCount: Int,
    val version: Int = 1,
    val previousBatchId: String? = null,
    val ackTargetCount: Int = 0,
    val acknowledgedCount: Int = 0,
)

data class BatchTicket(
    val ticketId: String,
    val pickerEmployeeCode: String,
    val pickerDisplayName: String,
    val status: String,
    val reportedAt: String,
    val autoSkipDeadlineAt: String? = null,
    val autoSkipAllowedAt: String? = null,
    val resolution: String? = null,
    val resolutionSource: String? = null,
    val resultEventId: String? = null,
    val acknowledgedAt: String? = null,
)

data class RealtimeDeltaEvent(
    val seq: Long,
    val event: String,
    val eventId: String,
    val scopes: Set<String>,
    val batchId: String?,
    val batchVersion: Int?,
)

data class RealtimeDelta(
    val events: List<RealtimeDeltaEvent>,
    val latestSeq: Long,
    val cursorSeq: Long,
    val retainedFromSeq: Long,
    val streamEpoch: String,
    val hasMore: Boolean,
    val resyncRequired: Boolean,
    val resyncReason: String?,
)

class ApiException(
    val httpStatus: Int,
    val code: String,
    override val message: String,
) : Exception(message)

class InventoryApi(
    private val baseUrl: String,
    private val userAgent: String,
    private val onSessionChanged: (AppSession?) -> Unit = {},
) {
    @Volatile var session: AppSession? = null
        private set

    private fun updateSession(next: AppSession?) {
        session = next
        onSessionChanged(next)
    }

    fun restoreSession(next: AppSession) {
        updateSession(next)
    }

    fun clearSession() { updateSession(null) }

    fun logoutInteractive(deviceId: String) {
        val current = session
        if (current == null) return
        try {
            request(
                "POST",
                "/api/auth/logout",
                JSONObject().put("device_id", deviceId),
                authorized = true,
                allowRefreshRetry = false,
            )
        } finally {
            updateSession(null)
        }
    }

    fun login(username: String, password: String, deviceId: String, force: Boolean = false): AppSession {
        val payload = request(
            method = "POST",
            path = "/api/auth/login",
            body = JSONObject()
                .put("username", username)
                .put("password", password)
                .put("client_type", "ANDROID")
                .put("device_id", deviceId)
                .put("force", force),
            authorized = false,
        )
        val user = payload.optJSONObject("user") ?: JSONObject()
        val next = AppSession(
            idToken = payload.optString("id_token"),
            refreshToken = payload.optString("refresh_token"),
            userId = user.optString("user_id", username),
            displayName = user.optString("display_name", username),
            role = user.optString("role", "AUTH"),
            employeeCode = nullable(user, "employee_code"),
            relayCustomToken = payload.optString("firebase_custom_token").takeIf { it.isNotBlank() },
        )
        if (next.idToken.isBlank() || next.refreshToken.isBlank()) throw IllegalStateException("Phiên đăng nhập trả về không đầy đủ.")
        updateSession(next)
        return next
    }

    fun refreshProfile(): AppSession {
        val current = session ?: throw ApiException(401, "AUTH_REQUIRED", "Chưa đăng nhập.")
        val payload = request("GET", "/api/auth/me")
        val user = payload.optJSONObject("user") ?: JSONObject()
        val next = current.copy(
            userId = user.optString("user_id", current.userId),
            displayName = user.optString("display_name", current.displayName),
            role = user.optString("role", current.role),
            employeeCode = nullable(user, "employee_code") ?: current.employeeCode,
        )
        updateSession(next)
        return next
    }

    fun getAndroidOperatingWindow(): AndroidOperatingWindow {
        val payload = request("GET", "/api/auth/android-window")
        return AndroidOperatingWindow(
            isOpen = payload.optBoolean("is_open", false),
            serverNowMs = payload.optLong("server_now_ms", 0L),
            closesAtMs = payload.optLong("closes_at_ms", 0L).takeIf { it > 0L },
            overtimeUntilMs = payload.optLong("overtime_until_ms", 0L).takeIf { it > 0L },
        )
    }

    fun registerNotificationDevice(deviceId: String, token: String): JSONObject = request(
        "POST", "/api/notifications/device",
        JSONObject().put("device_id", deviceId).put("token", token).put("platform", "ANDROID"),
    )

    fun unregisterNotificationDevice(deviceId: String): JSONObject = request(
        "DELETE", "/api/notifications/device",
        JSONObject().put("device_id", deviceId).put("platform", "ANDROID"),
    )

    fun uploadRuntimeLog(
        severity: String,
        reason: String,
        generatedAt: String,
        device: JSONObject,
        payload: JSONObject,
    ): JSONObject = request(
        "POST", "/api/logs/upload",
        JSONObject()
            .put("source", "ANDROID")
            .put("severity", severity.uppercase())
            .put("reason", reason)
            .put("generated_at", generatedAt)
            .put("device", device)
            .put("payload", payload),
    )

    fun createRealtimeTicket(): String {
        val payload = request("POST", "/api/realtime/ticket", JSONObject().put("client_type", "ANDROID"))
        return payload.optString("ticket").takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("Service không cấp được realtime ticket.")
    }

    fun getRealtimeDelta(afterSeq: Long, streamEpoch: String, limit: Int = 100): RealtimeDelta {
        val epochParam = if (streamEpoch.isBlank()) "" else "&stream_epoch=${enc(streamEpoch)}"
        val payload = request(
            "GET",
            "/api/realtime/delta?after_seq=${afterSeq.coerceAtLeast(0)}&limit=${limit.coerceIn(1, 200)}$epochParam",
        )
        val array = payload.optJSONArray("events") ?: JSONArray()
        val events = ArrayList<RealtimeDeltaEvent>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val scopesArray = row.optJSONArray("scopes") ?: JSONArray()
            val scopes = linkedSetOf<String>()
            for (i in 0 until scopesArray.length()) {
                scopesArray.optString(i).trim().takeIf { it.isNotBlank() }?.let { scopes += it }
            }
            events += RealtimeDeltaEvent(
                seq = row.optLong("seq", 0L),
                event = row.optString("event", row.optString("event_type")),
                eventId = row.optString("event_id"),
                scopes = scopes,
                batchId = nullable(row, "batch_id"),
                batchVersion = row.optInt("batch_version", -1).takeIf { it >= 0 },
            )
        }
        return RealtimeDelta(
            events = events,
            latestSeq = payload.optLong("latest_seq", 0L),
            cursorSeq = payload.optLong("cursor_seq", afterSeq),
            retainedFromSeq = payload.optLong("retained_from_seq", 0L),
            streamEpoch = payload.optString("stream_epoch"),
            hasMore = payload.optBoolean("has_more", payload.optBoolean("complete", true).not()),
            resyncRequired = payload.optBoolean("resync_required", false),
            resyncReason = nullable(payload, "resync_reason"),
        )
    }

    fun getCatalogInfo(): CatalogInfo {
        val payload = request("GET", "/api/skus/catalog-info")
        return CatalogInfo(payload.optInt("count", 0), payload.optString("version"))
    }

    fun getCatalogPage(after: String, limit: Int = 2000): CatalogPage {
        val payload = request("GET", "/api/skus/catalog?after=${enc(after)}&limit=$limit")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val items = ArrayList<SkuItem>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val sku = row.optString("sku").trim()
            val name = row.optString("product_name").trim()
            if (sku.isNotBlank() && name.isNotBlank()) items += SkuItem(sku, name)
        }
        return CatalogPage(items, nullable(payload, "next_after"))
    }

    fun getCatalogDelta(since: String, afterUpdatedAt: String, afterSku: String, limit: Int = 2000): CatalogDeltaPage {
        val payload = request("GET", "/api/skus/catalog-delta?since=${enc(since)}&after_updated_at=${enc(afterUpdatedAt)}&after_sku=${enc(afterSku)}&limit=$limit")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val items = ArrayList<SkuItem>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val sku = row.optString("sku").trim()
            val name = row.optString("product_name").trim()
            if (sku.isNotBlank() && name.isNotBlank()) items += SkuItem(sku, name)
        }
        return CatalogDeltaPage(items, nullable(payload, "next_updated_at"), nullable(payload, "next_sku"))
    }

    fun createPickerReport(sku: String): JSONObject = request(
        "POST", "/api/picker/reports",
        JSONObject().put("request_id", UUID.randomUUID().toString()).put("sku", sku),
    )

    fun getPickerReports(limit: Int = 200): List<PickerReport> {
        val payload = request("GET", "/api/picker/reports?limit=$limit&scope=APP_TODAY_OPEN")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<PickerReport>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += PickerReport(
                ticketId = row.optString("ticket_id"), batchId = row.optString("batch_id"),
                sku = row.optString("sku"), productName = row.optString("product_name"),
                status = row.optString("status"), batchStatus = row.optString("batch_status"),
                resolution = nullable(row, "resolution"), reportedAt = row.optString("reported_at"),
                withdrawDeadlineAt = row.optString("withdraw_deadline_at"), withdrawnAt = nullable(row, "withdrawn_at"),
                resolvedAt = nullable(row, "resolved_at"),
                autoSkipDeadlineAt = nullable(row, "auto_skip_deadline_at"),
                autoSkipAllowedAt = nullable(row, "auto_skip_allowed_at"),
                resolutionSource = nullable(row, "resolution_source"),
                batchVersion = row.optInt("batch_version", 1),
                previousBatchId = nullable(row, "previous_batch_id"), resultEventId = nullable(row, "result_event_id"),
                receivedAt = nullable(row, "received_at"), displayedAt = nullable(row, "displayed_at"),
                acknowledgedAt = nullable(row, "acknowledged_at"),
            )
        }
        return rows
    }

    fun getPickerResults(limit: Int = 100): List<PickerResult> {
        val payload = request("GET", "/api/picker/results?limit=$limit")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<PickerResult>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += PickerResult(
                resultEventId = row.optString("result_event_id"), batchId = row.optString("batch_id"),
                batchVersion = row.optInt("batch_version", 1), sku = row.optString("sku"),
                productName = row.optString("product_name"), status = row.optString("status"),
                resolution = row.optString("resolution"), resolvedAt = nullable(row, "resolved_at"),
                receivedAt = nullable(row, "received_at"), displayedAt = nullable(row, "displayed_at"),
                acknowledgedAt = nullable(row, "acknowledged_at"),
            )
        }
        return rows
    }

    fun markResultStage(resultEventId: String, stage: String): JSONObject = request(
        "POST", "/api/picker/results/receipt",
        JSONObject().put("request_id", UUID.randomUUID().toString()).put("result_event_id", resultEventId).put("stage", stage),
    )

    fun acknowledgeResult(resultEventId: String): JSONObject = markResultStage(resultEventId, "ACKNOWLEDGED")

    fun withdrawPickerReport(ticketId: String): JSONObject = request(
        "POST", "/api/picker/reports/withdraw",
        JSONObject().put("request_id", UUID.randomUUID().toString()).put("ticket_id", ticketId),
    )

    fun getReporterQueue(limit: Int = 100): List<ReporterBatch> = getReporterQueueSnapshot(limit).items

    fun getReporterQueueSnapshot(limit: Int = 200): ReporterQueueSnapshot {
        val payload = request("GET", "/api/reporter/queue?limit=$limit")
        val serverNow = nullable(payload, "server_now")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<ReporterBatch>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += ReporterBatch(
                batchId = row.optString("batch_id"), sku = row.optString("sku"), productName = row.optString("product_name"),
                firstReportAt = row.optString("first_report_at"), affectedPickerCount = row.optInt("affected_picker_count", 0),
                version = row.optInt("version", 1), previousBatchId = nullable(row, "previous_batch_id"),
                previousResolvedAt = nullable(row, "previous_resolved_at"),
                recurrenceMinutes = row.optInt("recurrence_minutes", -1).takeIf { it >= 0 },
                slaState = row.optString("sla_state", "UNCONFIGURED"), waitingMinutes = row.optInt("waiting_minutes", 0),
                warningAt = nullable(row, "warning_at"), escalationAt = nullable(row, "escalation_at"),
                autoSkipAt = nullable(row, "auto_skip_at"),
                autoSkipEnabled = row.optBoolean("auto_skip_enabled", false),
                autoSkipMode = nullable(row, "auto_skip_mode"),
                serverNow = serverNow,
            )
        }
        return ReporterQueueSnapshot(rows, payload.optInt("total", rows.size))
    }

    fun getReporterRecent(limit: Int = 100): List<ReporterRecent> = getReporterRecentSnapshot(limit).items

    fun getReporterRecentSnapshot(limit: Int = 200): ReporterRecentSnapshot {
        val payload = request("GET", "/api/reporter/recent?limit=$limit&scope=APP_TODAY_OPEN")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<ReporterRecent>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += ReporterRecent(
                batchId = row.optString("batch_id"), sku = row.optString("sku"), productName = row.optString("product_name"),
                status = row.optString("status"), firstReportAt = row.optString("first_report_at"), resolvedAt = nullable(row, "resolved_at"),
                resolutionSource = nullable(row, "resolution_source"),
                resolvedByDisplayName = nullable(row, "resolved_by_display_name"),
                resolvedByEmployeeCode = nullable(row, "resolved_by_employee_code"),
                correctionDeadlineAt = nullable(row, "correction_deadline_at"), affectedPickerCount = row.optInt("affected_picker_count", 0),
                version = row.optInt("version", 1), previousBatchId = nullable(row, "previous_batch_id"),
                ackTargetCount = row.optInt("ack_target_count", 0), acknowledgedCount = row.optInt("acknowledged_count", 0),
            )
        }
        val totals = payload.optJSONObject("totals") ?: JSONObject()
        return ReporterRecentSnapshot(
            items = rows,
            counts = ReporterRecentCounts(
                hasStock = totals.optInt("has_stock", rows.count { it.status == "HAS_STOCK" }),
                skipAllowed = totals.optInt("skip_allowed", rows.count { it.status == "SKIP_ALLOWED" }),
                withdrawn = totals.optInt("withdrawn", rows.count { it.status == "CLOSED" }),
            ),
        )
    }

    fun getBatchTickets(batchId: String): List<BatchTicket> {
        val payload = request("GET", "/api/reporter/batch-tickets?batch_id=${enc(batchId)}")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<BatchTicket>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += BatchTicket(
                ticketId = row.optString("ticket_id"), pickerEmployeeCode = row.optString("picker_employee_code"),
                pickerDisplayName = row.optString("picker_display_name"), status = row.optString("status"),
                reportedAt = row.optString("reported_at"),
                autoSkipDeadlineAt = nullable(row, "auto_skip_deadline_at"),
                autoSkipAllowedAt = nullable(row, "auto_skip_allowed_at"),
                resolution = nullable(row, "resolution"),
                resolutionSource = nullable(row, "resolution_source"),
                resultEventId = nullable(row, "result_event_id"),
                acknowledgedAt = nullable(row, "acknowledged_at"),
            )
        }
        return rows
    }

    fun resolveBatch(batchId: String, resolution: String): JSONObject = request(
        "POST", "/api/reporter/batches/resolve",
        JSONObject().put("request_id", UUID.randomUUID().toString()).put("batch_id", batchId).put("resolution", resolution),
    )

    fun correctBatch(batchId: String): JSONObject = request(
        "POST", "/api/reporter/batches/correct",
        JSONObject().put("request_id", UUID.randomUUID().toString()).put("batch_id", batchId),
    )

    fun refreshSessionForRelay(): AppSession {
        refreshSession()
        return session ?: throw ApiException(401, "SESSION_REFRESH_FAILED", "Không thể làm mới phiên đăng nhập.")
    }

    private fun refreshSession() {
        val current = session ?: throw ApiException(401, "AUTH_REQUIRED", "Phiên đăng nhập đã hết hạn.")
        val payload = request(
            "POST", "/api/auth/refresh", JSONObject().put("refresh_token", current.refreshToken),
            authorized = false, allowRefreshRetry = false,
        )
        val idToken = payload.optString("id_token")
        val refreshToken = payload.optString("refresh_token")
        if (idToken.isBlank() || refreshToken.isBlank()) {
            updateSession(null)
            throw ApiException(401, "SESSION_REFRESH_FAILED", "Không thể làm mới phiên đăng nhập.")
        }
        updateSession(
            current.copy(
                idToken = idToken,
                refreshToken = refreshToken,
                relayCustomToken = payload.optString("firebase_custom_token").takeIf { it.isNotBlank() },
            )
        )
    }

    private fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        authorized: Boolean = true,
        allowRefreshRetry: Boolean = true,
    ): JSONObject {
        val current = session
        if (authorized && current == null) throw ApiException(401, "AUTH_REQUIRED", "Chưa đăng nhập.")
        val response = execute(method, path, body, if (authorized) current?.idToken else null)
        if (response.first == 401 && authorized && allowRefreshRetry && current?.refreshToken?.isNotBlank() == true) {
            refreshSession()
            return request(method, path, body, authorized = true, allowRefreshRetry = false)
        }
        val payload = parsePayload(response.second)
        if (response.first !in 200..299) {
            val code = payload.optString("error", "HTTP_${response.first}")
            val message = payload.optString("message").ifBlank { code }
            if (response.first == 401) updateSession(null)
            throw ApiException(response.first, code, message)
        }
        return payload
    }

    private fun execute(method: String, path: String, body: JSONObject?, token: String?): Pair<Int, String> {
        val connection = (URL("$baseUrl$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 30_000
            instanceFollowRedirects = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", userAgent)
            if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        return try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            code to stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        } finally { connection.disconnect() }
    }

    private fun parsePayload(text: String): JSONObject = try {
        if (text.isBlank()) JSONObject() else JSONObject(text)
    } catch (_: Exception) {
        throw IllegalStateException("API trả dữ liệu không hợp lệ.")
    }

    private fun nullable(objectValue: JSONObject, key: String): String? =
        objectValue.optString(key).takeIf { it.isNotBlank() && it != "null" }

    private fun enc(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
}
