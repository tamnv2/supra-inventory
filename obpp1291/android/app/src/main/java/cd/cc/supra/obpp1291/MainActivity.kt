package cd.cc.supra.obpp1291

import android.app.Activity
import android.app.AlertDialog
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.PopupMenu
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
    private val selectedLocationCodes = mutableSetOf<String>()
    private var pendingQrFocus = false
    private var workplaceShown = false
    private val syncPollHandler = Handler(Looper.getMainLooper())
    private var foreground = false
    private val syncPoll = object : Runnable {
        override fun run() {
            if (!foreground) return
            if (!sessionToken.isNullOrBlank() && selectedTab == "Lịch sử" &&
                (0 until recordData.length()).any {
                    recordData.optJSONObject(it)?.optString("sync_status") == "PENDING"
                }) refreshRecords()
            syncPollHandler.postDelayed(this, 5000)
        }
    }
    override fun onResume() {
        super.onResume()
        foreground = true
        syncPollHandler.removeCallbacks(syncPoll)
        syncPollHandler.postDelayed(syncPoll, 5000)
    }
    override fun onPause() {
        foreground = false
        syncPollHandler.removeCallbacks(syncPoll)
        super.onPause()
    }
    private var lastSyncMessage = ""

    private val navy = Color.rgb(20, 57, 105)
    private val blue = Color.rgb(13, 100, 220)
    private val muted = Color.rgb(89, 109, 140)
    private fun dp(n: Int) = (n * resources.displayMetrics.density).toInt()
    private fun rounded(fill: Int, border: Int = fill, radius: Int = 14): GradientDrawable = GradientDrawable().apply {
        setColor(fill); cornerRadius = dp(radius).toFloat(); setStroke(dp(1), border)
    }

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
            setBackgroundColor(Color.rgb(242, 246, 252))
            setPadding(dp(14), dp(14), dp(14), dp(8))
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
        }
        body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, dp(20))
        }
        scroll.addView(body)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        if (!sessionToken.isNullOrBlank()) {
            val bottomTabs = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                background = rounded(Color.rgb(226, 236, 249))
                setPadding(dp(3), dp(3), dp(3), dp(3))
            }
            for (tab in listOf("Nghiệp vụ", "Vị trí", "Lịch sử")) {
                val tabButton = if (selectedTab == tab) action(tab) {
                    switchTab(tab)
                } else secondaryAction(tab) {
                    switchTab(tab)
                }
                bottomTabs.addView(tabButton, LinearLayout.LayoutParams(0, dp(50), 1f))
            }
            root.addView(bottomTabs, LinearLayout.LayoutParams(-1, -2))
        }
        setContentView(root)
        return body
    }

    private fun heading(message: String, large: Boolean = false): TextView =
        TextView(this).apply {
            text = message
            textSize = if (large) 22f else 16f
            setTextColor(navy)
            setPadding(dp(2), dp(10), dp(2), dp(10))
            setTypeface(null, if (large) 1 else 0)
        }

    private fun panel(root: LinearLayout, title: String): LinearLayout {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(Color.WHITE, Color.rgb(218, 228, 241))
            setPadding(dp(14), dp(12), dp(14), dp(14))
        }
        val lp = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) }
        root.addView(panel, lp)
        if (title.isNotBlank()) panel.addView(heading(title))
        return panel
    }

    private fun field(hint: String, numerical: Boolean = false, uppercase: Boolean = false): EditText =
        EditText(this).apply {
            this.hint = hint
            setHintTextColor(Color.rgb(148, 163, 184))
            textSize = 17f
            setTextColor(navy)
            setSingleLine(true)
            minHeight = dp(50)
            setPadding(dp(13), dp(8), dp(13), dp(8))
            background = rounded(Color.WHITE, Color.rgb(202, 214, 231), 10)
            inputType = if (numerical) InputType.TYPE_CLASS_NUMBER else InputType.TYPE_CLASS_TEXT
            filters = if (uppercase) arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(60))
                      else arrayOf(InputFilter.LengthFilter(512))
        }

    private fun labeledInput(root: LinearLayout, label: String, input: EditText) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val caption = TextView(this).apply {
            text = label
            textSize = 15f
            setTextColor(muted)
            setTypeface(null, 1)
        }
        input.hint = ""
        row.addView(caption, LinearLayout.LayoutParams(dp(112), -2))
        row.addView(input, LinearLayout.LayoutParams(0, dp(50), 1f))
        root.addView(row, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(9) })
    }

    private fun switchTab(tab: String) {
        if (selectedTab == tab) return
        selectedTab = tab
        if (tab == "Lịch sử") refreshRecords() else showWorkplace()
    }

    private fun syncTint(code: String): Int = when (code.uppercase()) {
        "SYNCED" -> Color.rgb(227, 248, 235)
        "ERROR" -> Color.rgb(255, 232, 232)
        else -> Color.rgb(255, 247, 210)
    }
    private fun syncLabel(code: String): String = when (code.uppercase()) {
        "SYNCED" -> "Đã đồng bộ"
        "ERROR" -> "Lỗi đồng bộ"
        else -> "Đang đồng bộ"
    }

    private fun action(label: String, onClick: () -> Unit): Button =
        Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            setTypeface(null, 1)
            minHeight = dp(48)
            backgroundTintList = ColorStateList.valueOf(blue)
            setTextColor(Color.WHITE)
            setOnClickListener { onClick() }
        }

    private fun secondaryAction(label: String, onClick: () -> Unit): Button =
        action(label, onClick).apply {
            setTextColor(navy)
            backgroundTintList = ColorStateList.valueOf(Color.rgb(229, 239, 253))
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
                            403 -> "Tài khoản không có quyền sử dụng ứng dụng."
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
        workplaceShown = false
        val root = surface()
        root.addView(heading("GHI NHẬN HÀNG RỚT", true))
        val card = panel(root, "Đăng nhập")
        val username = field("")
        val password = field("").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        labeledInput(card, "Tài khoản", username)
        labeledInput(card, "Mật khẩu / mã", password)
        card.addView(action("Đăng nhập") {
            val user = username.text.toString().trim()
            val pass = password.text.toString()
            if (user.isBlank() || pass.isBlank()) {
                message("Vui lòng nhập tài khoản và mật khẩu.")
            } else {
                call("POST", "/api/obpp1291/session/login",
                    JSONObject().put("username", user).put("password", pass), false) { res ->
                    password.setText("")
                    val token = res.optString("session_token")
                    val role = res.optString("role").uppercase()
                    if (token.isBlank() ||
                        role !in setOf("ADMIN", "PICKPACK_ADMIN", "ROOT", "OBPP_COORDINATOR")) {
                        message("Tài khoản không có quyền sử dụng ứng dụng.")
                    } else {
                        sessionToken = token
                        displayName = res.optString("display_name")
                        refreshAll()
                    }
                }
            }
        })
        card.addView(secondaryAction("Lấy mã đăng nhập") {
            val user = username.text.toString().trim()
            if (user.isBlank()) {
                message("Nhập tài khoản trước khi yêu cầu mã.")
            } else {
                call("POST", "/api/auth/privileged-code",
                    JSONObject().put("username", user), false) {
                    message("Đã yêu cầu gửi mã. Kiểm tra email quản trị.")
                }
            }
        })
        status = heading("")
        root.addView(status)
        root.addView(secondaryAction("Kiểm tra cập nhật") {
            ObppUpdateManager.check(this, true)
        })
    }

    private fun refreshAll() {
        call("GET", "/api/obpp1291/locations") { res ->
            locationData = res.optJSONArray("locations") ?: JSONArray()
            refreshRecords()
        }
    }

    private fun refreshRecords() {
        call("GET", "/api/obpp1291/records?limit=50") { res ->
            val fresh = res.optJSONArray("records") ?: JSONArray()
            val changed = fresh.toString() != recordData.toString()
            recordData = fresh
            if (!workplaceShown || (selectedTab == "Lịch sử" && changed)) showWorkplace()
        }
    }

    private fun showWorkplace() {
        val root = surface()
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val name = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        name.addView(heading("HÀNG RỚT OB × PP 1291", true))
        name.addView(TextView(this).apply {
            text = displayName
            textSize = 13f
            setTextColor(muted)
            setPadding(dp(2), 0, dp(2), dp(6))
        })
        header.addView(name, LinearLayout.LayoutParams(0, -2, 1f))
        val more = secondaryAction("⋮") { }
        more.setOnClickListener { anchor ->
            val menu = PopupMenu(this, anchor)
            menu.menu.add("Kiểm tra cập nhật")
            menu.menu.add("Đăng xuất")
            menu.setOnMenuItemClickListener { item ->
                when (item.title.toString()) {
                    "Kiểm tra cập nhật" -> ObppUpdateManager.check(this, true)
                    "Đăng xuất" -> {
                        call("POST", "/api/obpp1291/session/logout", JSONObject()) { }
                        showLogin()
                    }
                }
                true
            }
            menu.show()
        }
        header.addView(more, LinearLayout.LayoutParams(dp(55), dp(48)))
        root.addView(header)
        workplaceShown = true
        when (selectedTab) {
            "Vị trí" -> showLocations(root)
            "Lịch sử" -> showHistory(root)
            else -> showOperations(root)
        }
        status = heading(lastSyncMessage).apply {
            textSize = 13f
            setTextColor(muted)
        }
        root.addView(status)
        root.addView(secondaryAction("Đồng bộ / Làm mới") {
            call("POST", "/api/obpp1291/sync", JSONObject()) { receipt ->
                lastSyncMessage = if (receipt.optString("status") == "OK") {
                    "Đã kiểm tra đồng bộ"
                } else {
                    "Đồng bộ chưa hoàn tất. Vui lòng thử lại."
                }
                refreshAll()
            }
        })
    }

    private fun showOperations(container: LinearLayout) {
        val root = panel(container, "Quét mã QR hoặc nhập thông tin")
        qr = field("Scan QR")
        qr.imeOptions = EditorInfo.IME_ACTION_DONE
        qr.setOnEditorActionListener { _, _, event ->
            if (event == null || event.keyCode == KeyEvent.KEYCODE_ENTER) { parseScan(); true }
            else false
        }
        root.addView(qr)
        root.addView(secondaryAction("Tách thông tin QR") { parseScan() })
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
        val posRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        posRow.addView(TextView(this).apply {
            text = "Vị trí"
            textSize = 15f
            setTextColor(muted)
            setTypeface(null, 1)
        }, LinearLayout.LayoutParams(dp(112), -2))
        posRow.addView(locationSpinner, LinearLayout.LayoutParams(0, dp(50), 1f))
        root.addView(posRow, LinearLayout.LayoutParams(-1, -2).apply {
            bottomMargin = dp(9)
        })

        root.addView(action("LƯU GHI NHẬN") { saveRecord() })
        if (pendingQrFocus) {
            pendingQrFocus = false
            qr.requestFocus()
        }
    }

    private fun showHistory(container: LinearLayout) {
        val history = panel(container, "Lịch sử")
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
        history.addView(selectionBar)
        for (i in 0 until recordData.length()) {
            val item = recordData.optJSONObject(i) ?: continue
            val id = item.optString("id")
            val summary = item.optString("date_vn") + " " + item.optString("time_vn") +
                "\n" + item.optString("store_code") + " | " + item.optString("do_code") +
                " | " + item.optString("total_parcels") + " kiện | " +
                item.optString("location")
            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(dp(5), dp(5), dp(5), dp(5))
                background = rounded(syncTint(item.optString("sync_status")), Color.rgb(221, 232, 245))
                contentDescription = syncLabel(item.optString("sync_status"))
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
                setPadding(dp(4), dp(7), dp(4), dp(7))
                setOnLongClickListener {
                    if (id.isNotBlank()) showRecordActions(item)
                    true
                }
            }
            line.addView(view, LinearLayout.LayoutParams(0, -2, 1f))
            history.addView(line)
        }
        updateSelection()
        if (recordData.length() == 0) history.addView(heading("Chưa có bản ghi."))
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
            .setMessage("Xóa vĩnh viễn bản ghi đã chọn? Dữ liệu cũng được xóa khỏi Sheet.")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Xóa đã chọn") { _, _ ->
                val payload = JSONObject()
                    .put("operation_id", UUID.randomUUID().toString())
                    .put("items", items)
                call("POST", "/api/obpp1291/records/bulk-delete", payload) { receipt ->
                    selectedRecordIds.clear()
                    lastSyncMessage = "Đã xóa " + receipt.optInt("deleted_count") +
                        " bản ghi. Đang cập nhật Sheet."
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
                .put("raw_scan", if (scan.isBlank()) "Người dùng nhập thủ công" else scan)
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
                lastSyncMessage = "Đã lưu · " + syncLabel(res.optString("sync_status", "PENDING"))
                pendingQrFocus = true
                showWorkplace()
                refreshRecords()
            }
        } catch (e: IllegalArgumentException) {
            message(e.message ?: "Thông tin không hợp lệ")
        }
    }

    private fun showRecordActions(record: JSONObject) {
        val id = record.optString("id")
        AlertDialog.Builder(this).setTitle("Bản ghi " + id)
            .setItems(arrayOf("Sửa thông tin", "Xóa", "Đóng")) { _, which ->
                when (which) {
                    0 -> {
                        editingId = id
                        editingRevision = record.optInt("revision")
                        selectedTab = "Nghiệp vụ"
                        showWorkplace()
                        qr.setText(record.optString("raw_scan").takeUnless { it == "Người dùng nhập thủ công" } ?: "")
                        store.setText(record.optString("store_code"))
                        doCode.setText(record.optString("do_code"))
                        parcels.setText(record.optString("total_parcels"))
                        val wanted = record.optString("location")
                        for (i in 0 until locationSpinner.count)
                            if (locationSpinner.getItemAtPosition(i).toString() == wanted) locationSpinner.setSelection(i)
                        message("Đang chỉnh sửa bản ghi")
                    }
                    1 -> AlertDialog.Builder(this)
                        .setTitle("Xác nhận xóa")
                        .setMessage("Xóa bản ghi khỏi lịch sử?")
                        .setNegativeButton("Hủy", null)
                        .setPositiveButton("Xóa") { _, _ ->
                            val payload = JSONObject().put("operation_id", UUID.randomUUID().toString())
                                .put("expected_revision", record.optInt("revision"))
                            call("DELETE", "/api/obpp1291/records/" + id, payload) {
                                message("Đã xóa bản ghi")
                                refreshRecords()
                            }
                        }.show()
                }
            }.show()
    }

    private fun showLocations(root: LinearLayout) {
        val area = panel(root, "Vị trí")
        val locationName = field("Nhập vị trí mới (tự IN HOA)", uppercase = true)
        area.addView(locationName)
        area.addView(action("Thêm vị trí") {
            try {
                val code = ObQrParser.position(locationName.text.toString())
                call("POST", "/api/obpp1291/locations",
                    JSONObject().put("code", code).put("operation_id", UUID.randomUUID().toString())) {
                    refreshAll()
                    showWorkplace()
                }
            } catch (e: IllegalArgumentException) { message(e.message ?: "Vị trí không hợp lệ") }
        })
        val ids = (0 until locationData.length()).mapNotNull {
            locationData.optJSONObject(it)?.optString("code")?.takeIf { code -> code.isNotBlank() }
        }.toSet()
        selectedLocationCodes.retainAll(ids)
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val selectAll = secondaryAction("Chọn tất cả") { }
        val remove = action("Xóa đã chọn") { confirmLocationDelete() }
        val checks = mutableListOf<CheckBox>()
        val update = {
            selectAll.text = if (ids.isNotEmpty() && selectedLocationCodes.containsAll(ids))
                "Bỏ chọn" else "Chọn tất cả"
            remove.text = "Xóa đã chọn (" + selectedLocationCodes.size + ")"
            remove.isEnabled = selectedLocationCodes.isNotEmpty()
        }
        selectAll.setOnClickListener {
            if (selectedLocationCodes.containsAll(ids)) selectedLocationCodes.clear()
            else selectedLocationCodes.addAll(ids)
            checks.forEach { it.isChecked = selectedLocationCodes.contains(it.tag as String) }
            update()
        }
        bar.addView(selectAll, LinearLayout.LayoutParams(0, -2, 1f))
        bar.addView(remove, LinearLayout.LayoutParams(0, -2, 1f))
        area.addView(bar)
        for (i in 0 until locationData.length()) {
            val item = locationData.optJSONObject(i) ?: continue
            val code = item.optString("code")
            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(6), dp(6), dp(6), dp(6))
                background = rounded(Color.rgb(243, 247, 253), Color.rgb(221, 232, 245))
            }
            val checkbox = CheckBox(this).apply {
                tag = code
                isChecked = selectedLocationCodes.contains(code)
                setOnCheckedChangeListener { _, checked ->
                    if (checked) selectedLocationCodes.add(code) else selectedLocationCodes.remove(code)
                    update()
                }
            }
            checks.add(checkbox)
            line.addView(checkbox)
            val label = heading(code).apply {
                setOnLongClickListener { locationActions(code); true }
            }
            line.addView(label, LinearLayout.LayoutParams(0, -2, 1f))
            area.addView(line, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(7) })
        }
        update()
    }

    private fun confirmLocationDelete() {
        val entries = JSONArray()
        for (i in 0 until locationData.length()) {
            val item = locationData.optJSONObject(i) ?: continue
            if (selectedLocationCodes.contains(item.optString("code"))) {
                entries.put(JSONObject().put("code", item.optString("code"))
                    .put("expected_revision", item.optInt("revision")))
            }
        }
        if (entries.length() == 0) return
        AlertDialog.Builder(this).setTitle("Xóa " + entries.length() + " vị trí?")
            .setMessage("Không thể chọn các vị trí đã xóa cho ghi nhận mới.")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Xóa") { _, _ ->
                call("POST", "/api/obpp1291/locations/bulk-delete",
                    JSONObject().put("operation_id", UUID.randomUUID().toString())
                        .put("items", entries)) {
                    selectedLocationCodes.clear()
                    refreshAll()
                    showWorkplace()
                }
            }.show()
    }

    private fun locationActions(oldCode: String) {
        AlertDialog.Builder(this).setTitle(oldCode)
            .setItems(arrayOf("Sửa tên", "Xóa")) { _, which ->
                if (which == 0) {
                    val input = field("Tên vị trí mới", uppercase = true).apply { setText(oldCode) }
                    AlertDialog.Builder(this).setTitle("Đổi tên vị trí").setView(input)
                        .setNegativeButton("Hủy", null).setPositiveButton("Lưu") { _, _ ->
                            try {
                                val changed = ObQrParser.position(input.text.toString())
                                call("PATCH", "/api/obpp1291/locations/" + java.net.URLEncoder.encode(oldCode, "UTF-8"),
                                    JSONObject().put("code", changed).put("operation_id", UUID.randomUUID().toString())) {
                                    refreshAll()
                                    showWorkplace()
                                }
                            } catch (e: IllegalArgumentException) { message(e.message ?: "Vị trí không hợp lệ") }
                        }.show()
                } else {
                    val entry = (0 until locationData.length()).mapNotNull { locationData.optJSONObject(it) }
                        .firstOrNull { it.optString("code") == oldCode } ?: return@setItems
                    selectedLocationCodes.clear()
                    selectedLocationCodes.add(oldCode)
                    confirmLocationDelete()
                }
            }.show()
    }
}
