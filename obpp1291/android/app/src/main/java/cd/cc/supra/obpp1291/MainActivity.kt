package cd.cc.supra.obpp1291

import android.app.Activity
import android.app.AlertDialog
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Standalone OB x PP1291 code-only client. All business writes require the
 * future server-verified OBPP-specific session; no Firebase/Inventory channel
 * session is created, mutated or persisted by this Activity.
 */
class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private var sessionToken: String? = null
    private var displayName = ""
    private var selectedTab = "Nghiệp vụ"
    private var locationData = JSONArray()
    private var recordData = JSONArray()
    private var editingId: String? = null
    private var editingRevision = 0
    private var pendingSaveKey: String? = null
    private var pendingSaveId: String? = null
    private val selectedRecordIds = mutableSetOf<String>()
    private var lastSyncMessage = ""

    private lateinit var body: LinearLayout
    private lateinit var qr: EditText
    private lateinit var store: EditText
    private lateinit var doCode: EditText
    private lateinit var parcels: EditText
    private lateinit var locationSpinner: Spinner
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(27, 62, 102)
        showLogin()
        ObppUpdateManager.check(this, false)
    }

    override fun onDestroy() {
        sessionToken = null
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun surface(): LinearLayout {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(247, 249, 252))
            setPadding(18, 18, 18, 12)
        }
        val scroll = ScrollView(this).apply { isFillViewport = true }
        body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(body)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        return body
    }

    private fun heading(message: String, large: Boolean = false): TextView {
        return TextView(this).apply {
            text = message
            textSize = if (large) 21f else 16f
            setTextColor(Color.rgb(24, 52, 82))
            setPadding(2, 12, 2, 12)
            if (large) setTypeface(null, 1)
        }
    }

    private fun field(hint: String, numerical: Boolean = false, uppercase: Boolean = false): EditText {
        return EditText(this).apply {
            this.hint = hint
            textSize = 18f
            setSingleLine(true)
            setPadding(12, 12, 12, 12)
            inputType = if (numerical) InputType.TYPE_CLASS_NUMBER else InputType.TYPE_CLASS_TEXT
            if (uppercase) filters = arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(60))
            else filters = arrayOf(InputFilter.LengthFilter(512))
        }
    }

    private fun labeledInput(root: LinearLayout, label: String, input: EditText) {
        val density = resources.displayMetrics.density
        val horizontal = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setPadding(0, (5 * density).toInt(), 0, (5 * density).toInt())
        }
        val caption = TextView(this).apply {
            text = label
            textSize = 16f
            setTextColor(Color.rgb(24, 52, 82))
        }
        input.hint = ""
        input.minHeight = (44 * density).toInt()
        horizontal.addView(caption, LinearLayout.LayoutParams((125 * density).toInt(), -2))
        horizontal.addView(input, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(horizontal)
    }

    private fun syncLabel(code: String): String = when (code.uppercase()) {
        "SYNCED" -> "Đã đồng bộ"
        "ERROR" -> "Lỗi đồng bộ"
        else -> "Đang đồng bộ"
    }

    private fun action(label: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            backgroundTintList = ColorStateList.valueOf(Color.rgb(33, 91, 153))
            setTextColor(Color.WHITE)
            setOnClickListener { onClick() }
        }
    }

    private fun message(value: String) {
        runOnUiThread {
            if (::status.isInitialized) status.text = value
            else AlertDialog.Builder(this).setMessage(value).setPositiveButton("Đóng", null).show()
        }
    }

    private fun call(
        method: String,
        path: String,
        request: JSONObject? = null,
        authenticated: Boolean = true,
        onSuccess: (JSONObject) -> Unit
    ) {
        val bearer = sessionToken
        if (authenticated && bearer.isNullOrBlank()) {
            message("Chưa có phiên OB × PP hợp lệ")
            return
        }
        executor.execute {
            try {
                val conn = URL(BuildConfig.API_BASE_URL.trimEnd('/') + path).openConnection() as HttpURLConnection
                try {
                    conn.requestMethod = method
                    conn.connectTimeout = 10000
                    conn.readTimeout = 12000
                    conn.setRequestProperty("Accept", "application/json")
                    if (authenticated) conn.setRequestProperty("Authorization", "Bearer " + bearer)
                    if (request != null) {
                        conn.doOutput = true
                        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                        conn.outputStream.use { it.write(request.toString().toByteArray(Charsets.UTF_8)) }
                    }
                    val code = conn.responseCode
                    if (code !in 200..299) {
                        // The service returns a bounded, pre-defined error identifier.
                        // Never display response bodies, usernames or credentials.
                        val safeError = try {
                            val raw = conn.errorStream?.bufferedReader(Charsets.UTF_8)
                                ?.use { it.readText().take(1200) } ?: ""
                            val key = JSONObject(raw).optString("error", "")
                            if (key.matches(Regex("^[A-Z][A-Z0-9_]{2,64}$"))) key else ""
                        } catch (_: Exception) { "" }
                        val label = when (code) {
                            401 -> if (!authenticated) "Tài khoản/mật khẩu hoặc mã một lần không hợp lệ."
                                else "Phiên đã hết hạn. Đăng nhập lại."
                            403 -> "Tài khoản chưa có quyền OB × PP (ADMIN / PICKPACK_ADMIN / ROOT)."
                            409 -> "Dữ liệu đã thay đổi ở máy khác. Vui lòng tải lại."
                            429 -> "Hệ thống đang giới hạn yêu cầu. Vui lòng thử lại."
                            503 -> "Dịch vụ đăng nhập tạm chưa sẵn sàng."
                            else -> "Service lỗi HTTP " + code + "."
                        } + if (safeError.isBlank()) "" else " [" + safeError + "]"
                        runOnUiThread { message(label); if (code == 401 && authenticated) showLogin() }
                        return@execute
                    }
                    val response = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                    val parsed = if (response.isBlank()) JSONObject() else JSONObject(response)
                    runOnUiThread { onSuccess(parsed) }
                } finally {
                    conn.disconnect()
                }
            } catch (_: Exception) {
                message("Không kết nối được service. Chưa lưu dữ liệu, không có hàng đợi offline.")
            }
        }
    }

    private fun showLogin() {
        sessionToken = null
        val root = surface()
        root.addView(heading("GHI NHẬN HÀNG RỚT OB × PP 1291", true))
        root.addView(heading("Đăng nhập độc lập bằng tài khoản SUPRA đã được cấp quyền."))
        val username = field("Tài khoản / Mã nhân viên")
        val password = field("Mật khẩu").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(username)
        root.addView(password)
        root.addView(action("Kiểm tra cập nhật GitHub") { ObppUpdateManager.check(this, true) })
        root.addView(heading("Admin/root/tamnv2/vps: dùng mã đăng nhập một lần theo chính sách Báo hàng."))
        root.addView(action("Gửi mã một lần tới email quản trị") {
            val user = username.text.toString().trim()
            if (user.isBlank()) {
                message("Nhập tài khoản quản trị trước khi yêu cầu mã.")
            } else {
                call("POST", "/api/auth/privileged-code",
                    JSONObject().put("username", user), false) {
                    message("Đã yêu cầu mã một lần qua email quản trị. Nhập mã vào ô Mật khẩu.")
                }
            }
        })

        root.addView(action("Đăng nhập") {
            val user = username.text.toString().trim()
            val pass = password.text.toString()
            if (user.isEmpty() || pass.isEmpty()) {
                message("Nhập tài khoản và mật khẩu.")
            } else {
                call("POST", "/api/obpp1291/session/login",
                    JSONObject().put("username", user).put("password", pass), false) { res ->
                    password.setText("")
                    val token = res.optString("session_token")
                    val role = res.optString("role").uppercase()
                    if (token.isBlank() || role !in setOf("ADMIN", "PICKPACK_ADMIN", "ROOT")) {
                        message("Service chưa cấp phiên OB × PP hợp lệ.")
                    } else {
                        sessionToken = token
                        displayName = res.optString("display_name")
                        refreshAll()
                    }
                }
            }
        })
        status = heading("Chỉ hoạt động khi có kết nối service.")
        root.addView(status)
    }

    private fun refreshAll() {
        call("GET", "/api/obpp1291/locations") { res ->
            locationData = res.optJSONArray("locations") ?: JSONArray()
            refreshRecords()
        }
    }

    private fun refreshRecords() {
        call("GET", "/api/obpp1291/records?limit=50") { res ->
            recordData = res.optJSONArray("records") ?: JSONArray()
            showWorkplace()
        }
    }

    private fun showWorkplace() {
        val root = surface()
        root.addView(heading("HÀNG RỚT OB × PP 1291", true))
        root.addView(heading("Tài khoản: " + displayName))
        val tabs = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        for (tab in listOf("Nghiệp vụ", "Danh sách vị trí")) {
            tabs.addView(action(tab) { selectedTab = tab; showWorkplace() },
                LinearLayout.LayoutParams(0, -2, 1f))
        }
        root.addView(tabs)
        status = heading(lastSyncMessage)
        if (selectedTab == "Nghiệp vụ") showOperations(root) else showLocations(root)
        root.addView(status)
        root.addView(action("Đồng bộ / Làm mới") {
            call("POST", "/api/obpp1291/sync", JSONObject()) { receipt ->
                lastSyncMessage = if (receipt.optString("status") == "OK") {
                    "Đã kiểm tra đồng bộ · xử lý ${receipt.optInt("processed")} sự kiện"
                } else {
                    "Đồng bộ còn chờ thử lại [" + receipt.optString("error_code", "OBPP_RETRY") + "]"
                }
                refreshAll()
            }
        })
        root.addView(action("Kiểm tra cập nhật GitHub") { ObppUpdateManager.check(this, true) })
        root.addView(action("Đăng xuất riêng app này") {
            call("POST", "/api/obpp1291/session/logout", JSONObject()) { }
            showLogin()
        })
    }

    private fun showOperations(root: LinearLayout) {
        root.addView(heading("Quét mã QR hoặc nhập thông tin"))
        qr = field("Scan QR")
        qr.imeOptions = EditorInfo.IME_ACTION_DONE
        qr.setOnEditorActionListener { _, _, event ->
            if (event == null || event.keyCode == KeyEvent.KEYCODE_ENTER) { parseScan(); true }
            else false
        }
        root.addView(qr)
        root.addView(action("Tách thông tin QR") { parseScan() })
        store = field("Mã cửa hàng (IN HOA)", uppercase = true)
        doCode = field("DO (chỉ chữ số)", numerical = true)
        parcels = field("Số kiện (tổng)", numerical = true)
        labeledInput(root, "Mã cửa hàng:", store)
        labeledInput(root, "DO:", doCode)
        labeledInput(root, "Số kiện:", parcels)

        val labels = mutableListOf("Chọn vị trí")
        for (i in 0 until locationData.length()) {
            val item = locationData.optJSONObject(i) ?: continue
            if (item.optBoolean("active", true)) labels.add(item.optString("code"))
        }
        locationSpinner = Spinner(this)
        locationSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, labels)
        root.addView(locationSpinner)
        root.addView(heading("Bấm Lưu để ghi nhận (quét QR không tự lưu)."))
        root.addView(action("LƯU THÔNG TIN") { saveRecord() })
        root.addView(heading("Lịch sử ghi nhận", true))
        val availableIds = (0 until recordData.length()).mapNotNull {
            recordData.optJSONObject(it)?.optString("id")?.takeIf { key -> key.isNotBlank() }
        }.toSet()
        selectedRecordIds.retainAll(availableIds)
        val selectionBar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val selectAll = action("Chọn tất cả") { }
        val deleteSelected = action("Xóa đã chọn") { }
        val checkboxes = mutableListOf<CheckBox>()
        val updateSelection = {
            selectAll.text = if (availableIds.isNotEmpty() && selectedRecordIds.containsAll(availableIds))
                "Bỏ chọn" else "Chọn tất cả"
            deleteSelected.text = "Xóa đã chọn (" + selectedRecordIds.size + ")"
            deleteSelected.isEnabled = selectedRecordIds.isNotEmpty()
        }
        selectAll.setOnClickListener {
            if (selectedRecordIds.containsAll(availableIds)) selectedRecordIds.clear()
            else selectedRecordIds.addAll(availableIds)
            checkboxes.forEach { it.isChecked = selectedRecordIds.contains(it.tag as String) }
            updateSelection()
        }
        deleteSelected.setOnClickListener { confirmBulkDelete() }
        selectionBar.addView(selectAll, LinearLayout.LayoutParams(0, -2, 1f))
        selectionBar.addView(deleteSelected, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(selectionBar)
        for (i in 0 until recordData.length()) {
            val item = recordData.optJSONObject(i) ?: continue
            val id = item.optString("id")
            val summary = item.optString("date_vn") + " " + item.optString("time_vn") +
                " - MCH: " + item.optString("store_code") +
                " - DO " + item.optString("do_code") +
                " - " + item.optString("total_parcels") + " kiện" +
                " - " + item.optString("location") +
                " - " + syncLabel(item.optString("sync_status"))
            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(0, 2, 0, 2)
                setBackgroundColor(if (i % 2 == 0) Color.WHITE else Color.rgb(238, 243, 249))
            }
            val checkbox = CheckBox(this).apply {
                tag = id
                isChecked = selectedRecordIds.contains(id)
                setOnCheckedChangeListener { _, checked ->
                    if (checked) selectedRecordIds.add(id) else selectedRecordIds.remove(id)
                    updateSelection()
                }
            }
            checkboxes.add(checkbox)
            line.addView(checkbox)
            val view = heading(summary).apply {
                textSize = 14f
                setPadding(0, 7, 0, 7)
                setOnLongClickListener {
                    if (id.isNotBlank()) showRecordActions(item)
                    true
                }
            }
            line.addView(view, LinearLayout.LayoutParams(0, -2, 1f))
            root.addView(line)
        }
        updateSelection()
        if (recordData.length() == 0) root.addView(heading("Chưa có dữ liệu đã ghi nhận."))
    }

    private fun confirmBulkDelete() {
        val items = JSONArray()
        for (i in 0 until recordData.length()) {
            val record = recordData.optJSONObject(i) ?: continue
            val id = record.optString("id")
            if (selectedRecordIds.contains(id)) {
                items.put(JSONObject().put("id", id)
                    .put("expected_revision", record.optInt("revision")))
            }
        }
        if (items.length() == 0) return
        AlertDialog.Builder(this)
            .setTitle("Xóa " + items.length() + " bản ghi?")
            .setMessage("Bản ghi sẽ được ẩn khỏi lịch sử, nhật ký thao tác vẫn được giữ.")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Xóa đã chọn") { _, _ ->
                val payload = JSONObject()
                    .put("operation_id", UUID.randomUUID().toString())
                    .put("items", items)
                call("POST", "/api/obpp1291/records/bulk-delete", payload) { receipt ->
                    selectedRecordIds.clear()
                    lastSyncMessage = "Đã ghi nhận xóa " + receipt.optInt("deleted_count") +
                        " bản ghi. Đang đồng bộ Sheets."
                    refreshRecords()
                }
            }.show()
    }

    private fun parseScan() {
        val raw = qr.text.toString()
        if (raw.isBlank()) return
        try {
            val info = ObQrParser.parse(raw)
            store.setText(info.storeCode)
            doCode.setText(info.doCode)
            parcels.setText(info.totalParcels.toString())
            message("Đã đọc QR: kiện " + info.parcelIndex + "/" + info.totalParcels)
        } catch (e: IllegalArgumentException) {
            message(e.message ?: "QR không hợp lệ")
        }
    }

    private fun saveRecord() {
        val loc = locationSpinner.selectedItem?.toString().orEmpty()
        if (loc == "Chọn vị trí") {
            message("Chọn vị trí trước khi lưu")
            return
        }
        try {
            val s = ObQrParser.store(store.text.toString())
            val d = ObQrParser.doCode(doCode.text.toString())
            val count = ObQrParser.total(parcels.text.toString())
            val scan = qr.text.toString()
            val qrIndex = if (scan.isBlank()) JSONObject.NULL else ObQrParser.parse(scan).parcelIndex
            val json = JSONObject()
                .put("raw_scan", scan)
                .put("store_code", s)
                .put("do_code", d)
                .put("total_parcels", count)
                .put("parcel_index", qrIndex)
                .put("location", ObQrParser.position(loc))
            val id = editingId
            if (id != null) json.put("expected_revision", editingRevision)
            val key = json.toString() + "|" + (id ?: "")
            if (key != pendingSaveKey) {
                pendingSaveKey = key
                pendingSaveId = UUID.randomUUID().toString()
            }
            json.put("operation_id", pendingSaveId)
            val path = if (id == null) "/api/obpp1291/records" else "/api/obpp1291/records/" + id
            call(if (id == null) "POST" else "PATCH", path, json) { res ->
                editingId = null
                editingRevision = 0
                pendingSaveKey = null
                pendingSaveId = null
                lastSyncMessage = "Service đã lưu · " + syncLabel(res.optString("sync_status", "PENDING"))
                refreshRecords()
            }
        } catch (e: IllegalArgumentException) {
            message(e.message ?: "Thông tin không hợp lệ")
        }
    }

    private fun showRecordActions(record: JSONObject) {
        val id = record.optString("id")
        AlertDialog.Builder(this).setTitle("Bản ghi " + id)
            .setItems(arrayOf("Sửa thông tin", "Xóa (lưu nhật ký)", "Đóng")) { _, which ->
                when (which) {
                    0 -> {
                        editingId = id
                        editingRevision = record.optInt("revision")
                        qr.setText(record.optString("raw_scan"))
                        store.setText(record.optString("store_code"))
                        doCode.setText(record.optString("do_code"))
                        parcels.setText(record.optString("total_parcels"))
                        val wanted = record.optString("location")
                        for (i in 0 until locationSpinner.count)
                            if (locationSpinner.getItemAtPosition(i).toString() == wanted) locationSpinner.setSelection(i)
                        message("Đang sửa bản ghi " + id + " (phiên bản " + editingRevision + ")")
                    }
                    1 -> AlertDialog.Builder(this)
                        .setTitle("Xác nhận xóa")
                        .setMessage("Xóa logic; dữ liệu cũ vẫn được giữ trong nhật ký.")
                        .setNegativeButton("Hủy", null)
                        .setPositiveButton("Xóa") { _, _ ->
                            val payload = JSONObject().put("operation_id", UUID.randomUUID().toString())
                                .put("expected_revision", record.optInt("revision"))
                            call("DELETE", "/api/obpp1291/records/" + id, payload) {
                                message("Đã ghi nhận thao tác xóa")
                                refreshRecords()
                            }
                        }.show()
                }
            }.show()
    }

    private fun showLocations(root: LinearLayout) {
        root.addView(heading("DANH SÁCH VỊ TRÍ", true))
        val locationName = field("Nhập vị trí mới (tự IN HOA)", uppercase = true)
        root.addView(locationName)
        root.addView(action("Thêm vị trí") {
            try {
                val code = ObQrParser.position(locationName.text.toString())
                call("POST", "/api/obpp1291/locations",
                    JSONObject().put("code", code).put("operation_id", UUID.randomUUID().toString())) {
                    refreshAll()
                }
            } catch (e: IllegalArgumentException) { message(e.message ?: "Vị trí không hợp lệ") }
        })
        for (i in 0 until locationData.length()) {
            val item = locationData.optJSONObject(i) ?: continue
            val code = item.optString("code")
            val active = item.optBoolean("active", true)
            val view = heading(code + (if (active) " • Đang dùng" else " • Đã ngừng dùng"))
            view.setOnLongClickListener { locationActions(code, active); true }
            root.addView(view)
        }
    }

    private fun locationActions(oldCode: String, active: Boolean) {
        AlertDialog.Builder(this).setTitle(oldCode)
            .setItems(arrayOf("Đổi tên", if (active) "Ngừng sử dụng" else "Kích hoạt lại")) { _, which ->
                if (which == 0) {
                    val input = field("Tên vị trí mới", uppercase = true).apply { setText(oldCode) }
                    AlertDialog.Builder(this).setTitle("Đổi tên vị trí").setView(input)
                        .setNegativeButton("Hủy", null).setPositiveButton("Lưu") { _, _ ->
                            try {
                                val changed = ObQrParser.position(input.text.toString())
                                call("PATCH", "/api/obpp1291/locations/" + java.net.URLEncoder.encode(oldCode, "UTF-8"),
                                    JSONObject().put("code", changed).put("operation_id", UUID.randomUUID().toString())) {
                                    refreshAll()
                                }
                            } catch (e: IllegalArgumentException) { message(e.message ?: "Vị trí không hợp lệ") }
                        }.show()
                } else {
                    AlertDialog.Builder(this).setTitle(if (active) "Ngừng sử dụng?" else "Kích hoạt lại?")
                        .setMessage("Không xóa nhãn vị trí đã ghi nhận trong lịch sử.")
                        .setNegativeButton("Hủy", null)
                        .setPositiveButton("Xác nhận") { _, _ ->
                            call("PATCH", "/api/obpp1291/locations/" + java.net.URLEncoder.encode(oldCode, "UTF-8"),
                                JSONObject().put("active", !active).put("operation_id", UUID.randomUUID().toString())) {
                                refreshAll()
                            }
                        }.show()
                }
            }.show()
    }
}
