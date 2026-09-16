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
    val displayName: String,
    val role: String,
    val employeeCode: String?,
)

data class SkuItem(
    val sku: String,
    val productName: String,
)

data class CatalogInfo(
    val count: Int,
    val version: String,
)

data class CatalogPage(
    val items: List<SkuItem>,
    val nextAfter: String?,
)

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
)

data class ReporterBatch(
    val batchId: String,
    val sku: String,
    val productName: String,
    val firstReportAt: String,
    val affectedPickerCount: Int,
)

data class ReporterRecent(
    val batchId: String,
    val sku: String,
    val productName: String,
    val status: String,
    val resolvedAt: String?,
    val correctionDeadlineAt: String?,
    val affectedPickerCount: Int,
)

data class BatchTicket(
    val ticketId: String,
    val pickerEmployeeCode: String,
    val pickerDisplayName: String,
    val status: String,
    val reportedAt: String,
)

class ApiException(
    val httpStatus: Int,
    val code: String,
    override val message: String,
) : Exception(message)

class InventoryApi(
    private val baseUrl: String,
    private val userAgent: String,
) {
    @Volatile
    var session: AppSession? = null
        private set

    fun clearSession() {
        session = null
    }

    fun login(username: String, password: String): AppSession {
        val payload = request(
            method = "POST",
            path = "/api/auth/login",
            body = JSONObject().put("username", username).put("password", password),
            authorized = false,
        )
        val user = payload.optJSONObject("user") ?: JSONObject()
        val next = AppSession(
            idToken = payload.optString("id_token"),
            refreshToken = payload.optString("refresh_token"),
            displayName = user.optString("display_name", username),
            role = user.optString("role", "AUTH"),
            employeeCode = user.optString("employee_code").takeIf { it.isNotBlank() && it != "null" },
        )
        if (next.idToken.isBlank() || next.refreshToken.isBlank()) {
            throw IllegalStateException("Phiên đăng nhập trả về không đầy đủ.")
        }
        session = next
        return next
    }

    fun registerNotificationDevice(deviceId: String, token: String): JSONObject =
        request(
            method = "POST",
            path = "/api/notifications/device",
            body = JSONObject().put("device_id", deviceId).put("token", token).put("platform", "ANDROID"),
        )

    fun unregisterNotificationDevice(deviceId: String): JSONObject =
        request(
            method = "DELETE",
            path = "/api/notifications/device",
            body = JSONObject().put("device_id", deviceId).put("platform", "ANDROID"),
        )

    fun createRealtimeTicket(): String {
        val payload = request(
            method = "POST",
            path = "/api/realtime/ticket",
            body = JSONObject().put("client_type", "ANDROID"),
        )
        return payload.optString("ticket").takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("Service không cấp được realtime ticket.")
    }

    fun getCatalogInfo(): CatalogInfo {
        val payload = request("GET", "/api/skus/catalog-info")
        return CatalogInfo(
            count = payload.optInt("count", 0),
            version = payload.optString("version"),
        )
    }

    fun getCatalogPage(after: String, limit: Int = 2000): CatalogPage {
        val path = "/api/skus/catalog?after=${enc(after)}&limit=$limit"
        val payload = request("GET", path)
        val array = payload.optJSONArray("items") ?: JSONArray()
        val items = ArrayList<SkuItem>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val sku = row.optString("sku").trim()
            val name = row.optString("product_name").trim()
            if (sku.isNotBlank() && name.isNotBlank()) items += SkuItem(sku, name)
        }
        return CatalogPage(
            items = items,
            nextAfter = payload.optString("next_after").takeIf { it.isNotBlank() && it != "null" },
        )
    }

    fun createPickerReport(sku: String): JSONObject =
        request(
            "POST",
            "/api/picker/reports",
            JSONObject().put("request_id", UUID.randomUUID().toString()).put("sku", sku),
        )

    fun getPickerReports(limit: Int = 100): List<PickerReport> {
        val payload = request("GET", "/api/picker/reports?limit=$limit")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<PickerReport>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += PickerReport(
                ticketId = row.optString("ticket_id"),
                batchId = row.optString("batch_id"),
                sku = row.optString("sku"),
                productName = row.optString("product_name"),
                status = row.optString("status"),
                batchStatus = row.optString("batch_status"),
                resolution = row.optString("resolution").takeIf { it.isNotBlank() && it != "null" },
                reportedAt = row.optString("reported_at"),
                withdrawDeadlineAt = row.optString("withdraw_deadline_at"),
                withdrawnAt = row.optString("withdrawn_at").takeIf { it.isNotBlank() && it != "null" },
                resolvedAt = row.optString("resolved_at").takeIf { it.isNotBlank() && it != "null" },
            )
        }
        return rows
    }

    fun withdrawPickerReport(ticketId: String): JSONObject =
        request(
            "POST",
            "/api/picker/reports/withdraw",
            JSONObject().put("request_id", UUID.randomUUID().toString()).put("ticket_id", ticketId),
        )

    fun getReporterQueue(limit: Int = 100): List<ReporterBatch> {
        val payload = request("GET", "/api/reporter/queue?limit=$limit")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<ReporterBatch>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += ReporterBatch(
                batchId = row.optString("batch_id"),
                sku = row.optString("sku"),
                productName = row.optString("product_name"),
                firstReportAt = row.optString("first_report_at"),
                affectedPickerCount = row.optInt("affected_picker_count", 0),
            )
        }
        return rows
    }

    fun getReporterRecent(limit: Int = 100): List<ReporterRecent> {
        val payload = request("GET", "/api/reporter/recent?limit=$limit")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<ReporterRecent>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += ReporterRecent(
                batchId = row.optString("batch_id"),
                sku = row.optString("sku"),
                productName = row.optString("product_name"),
                status = row.optString("status"),
                resolvedAt = row.optString("resolved_at").takeIf { it.isNotBlank() && it != "null" },
                correctionDeadlineAt = row.optString("correction_deadline_at").takeIf { it.isNotBlank() && it != "null" },
                affectedPickerCount = row.optInt("affected_picker_count", 0),
            )
        }
        return rows
    }

    fun getBatchTickets(batchId: String): List<BatchTicket> {
        val payload = request("GET", "/api/reporter/batch-tickets?batch_id=${enc(batchId)}")
        val array = payload.optJSONArray("items") ?: JSONArray()
        val rows = ArrayList<BatchTicket>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            rows += BatchTicket(
                ticketId = row.optString("ticket_id"),
                pickerEmployeeCode = row.optString("picker_employee_code"),
                pickerDisplayName = row.optString("picker_display_name"),
                status = row.optString("status"),
                reportedAt = row.optString("reported_at"),
            )
        }
        return rows
    }

    fun resolveBatch(batchId: String, resolution: String): JSONObject =
        request(
            "POST",
            "/api/reporter/batches/resolve",
            JSONObject()
                .put("request_id", UUID.randomUUID().toString())
                .put("batch_id", batchId)
                .put("resolution", resolution),
        )

    fun correctBatch(batchId: String): JSONObject =
        request(
            "POST",
            "/api/reporter/batches/correct",
            JSONObject().put("request_id", UUID.randomUUID().toString()).put("batch_id", batchId),
        )

    private fun refreshSession() {
        val current = session ?: throw ApiException(401, "AUTH_REQUIRED", "Phiên đăng nhập đã hết hạn.")
        val payload = request(
            method = "POST",
            path = "/api/auth/refresh",
            body = JSONObject().put("refresh_token", current.refreshToken),
            authorized = false,
            allowRefreshRetry = false,
        )
        val idToken = payload.optString("id_token")
        val refreshToken = payload.optString("refresh_token")
        if (idToken.isBlank() || refreshToken.isBlank()) {
            session = null
            throw ApiException(401, "SESSION_REFRESH_FAILED", "Không thể làm mới phiên đăng nhập.")
        }
        session = current.copy(idToken = idToken, refreshToken = refreshToken)
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
            if (response.first == 401) session = null
            throw ApiException(response.first, code, message)
        }
        return payload
    }

    private fun execute(
        method: String,
        path: String,
        body: JSONObject?,
        token: String?,
    ): Pair<Int, String> {
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
            if (body != null) {
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            code to stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        } finally {
            connection.disconnect()
        }
    }

    private fun parsePayload(text: String): JSONObject =
        try {
            if (text.isBlank()) JSONObject() else JSONObject(text)
        } catch (_: Exception) {
            throw IllegalStateException("API trả dữ liệu không hợp lệ.")
        }

    private fun enc(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
}
