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
    private var renderedTab = ""
    private var historyScrollY = 0
    private lateinit var pageScroll: ScrollView
    private val syncPollHandler = Handler(Looper.getMainLooper())
    private var syncPollTick = 0
    private var foreground = false
    private val syncPoll = object : Runnable {
        override fun run() {
            if (!foreground) return
            if(!sessionToken.isNullOrBlank()){
                syncPollTick++
                // A new OBPP login on another PDA revokes this one. Check
                // every 30s in any tab without polling Google Sheets.
                if(syncPollTick % 6 == 0)
                    call("GET","/api/obpp1291/session/status") { }
                if(selectedTab == "Lịch sử"){
                    val states=(0 until recordData.length()).mapNotNull {
                        recordData.optJSONObject(it)?.optString("sync_status")
                    }
                    if(states.contains("PENDING") || syncPollTick % 6 == 0)
                        refreshRecords()
                }
            }
            syncPollHandler.postDelayed(this, 5000)
        }
    }
    override fun onResume() {
        super.onResume()
        foreground = true
        syncPollHandler.removeCallbacks(syncPoll)
        syncPollHandler.postDelayed(syncPoll, 5000)
        if(!sessionToken.isNullOrBlank())
            call("GET","/api/obpp1291/session/status") { }
    }
    override fun onPause() {
        foreground = false
        syncPollHandler.removeCallbacks(syncPoll)
        super.onPause()
    }
    private var lastSyncMessage = ""
    private var lastManualSyncAt = 0L
    private var manualSyncRunning = false

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
        ObppDiagnostics.installCrashHandler(this)
        ObppDiagnostics.scheduleDaily(this)
        val restored = ObppSessionStore.restore(this)
        if(restored != null){
            sessionToken = restored.first
            displayName = restored.second
            refreshAll()
        }else showLogin()
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
            setPadding(dp(12), dp(6), dp(12), dp(4))
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
        }
        body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, dp(4))
        }
        scroll.addView(body)
        pageScroll = scroll
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        if (!sessionToken.isNullOrBlank()) {
            val bottomTabs = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                background = rounded(Color.rgb(233, 240, 250), Color.rgb(221, 231, 244), 10)
                setPadding(dp(2), dp(2), dp(2), dp(2))
            }
            for (tab in listOf("Nghiệp vụ", "Vị trí", "Lịch sử")) {
                val tabButton = if (selectedTab == tab) action(tab) {
                    switchTab(tab)
                } else secondaryAction(tab) {
                    switchTab(tab)
                }
                tabButton.textSize = 13f
                tabButton.minHeight = dp(42)
                bottomTabs.addView(tabButton, LinearLayout.LayoutParams(0, dp(42), 1f))
            }
            root.addView(bottomTabs, LinearLayout.LayoutParams(-1, -2))
        }
        setContentView(root)
        return body
    }

    private fun heading(message: String, large: Boolean = false): TextView =
        TextView(this).apply {
            text = message
            textSize = if (large) 19f else 15f
            setTextColor(navy)
            setPadding(dp(2), dp(5), dp(2), dp(5))
            setTypeface(null, if (large) 1 else 0)
        }

    private fun panel(root: LinearLayout, title: String): LinearLayout {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(Color.WHITE, Color.rgb(218, 228, 241))
            setPadding(dp(11), dp(8), dp(11), dp(10))
        }
        val lp = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(8) }
        root.addView(panel, lp)
        if (title.isNotBlank()) panel.addView(heading(title))
        return panel
    }

    private fun field(hint: String, numerical: Boolean = false, uppercase: Boolean = false): EditText =
        EditText(this).apply {
            this.hint = hint
            setHintTextColor(Color.rgb(148, 163, 184))
            textSize = 15.5f
            setTextColor(navy)
            setSingleLine(true)
            minHeight = dp(44)
            setPadding(dp(10), dp(5), dp(10), dp(5))
            background = rounded(Color.WHITE, Color.rgb(202, 214, 231), 10)
            inputType = if (numerical) InputType.TYPE_CLASS_NUMBER else InputType.TYPE_CLASS_TEXT
            filters = if (uppercase) arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(60))
                      else arrayOf(InputFilter.LengthFilter(512))
        }

    private fun fieldLabel(textValue: String): TextView = TextView(this).apply {
        text = textValue
        textSize = 12.5f
        setTextColor(muted)
        setTypeface(null, 1)
        setPadding(dp(2), 0, dp(2), dp(3))
    }

    // Labels stay outside inputs. Columns can share a row on narrow PDAs.
    private fun inputColumn(row: LinearLayout, label: String, view: View, leftGap: Int = 0) {
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        column.addView(fieldLabel(label))
        column.addView(view, LinearLayout.LayoutParams(-1, dp(44)))
        row.addView(column, LinearLayout.LayoutParams(0, -2, 1f).apply {
            leftMargin = dp(leftGap)
        })
    }

    private fun labeledInput(root: LinearLayout, label: String, input: EditText) {
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        column.addView(fieldLabel(label))
        column.addView(input, LinearLayout.LayoutParams(-1, dp(44)))
        root.addView(column, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(8) })
    }

    private fun compactButton(label: String, primary: Boolean = false, onClick: () -> Unit): Button =
        (if(primary) action(label,onClick) else secondaryAction(label,onClick)).apply {
            textSize = 13f
            minHeight = dp(38)
            minWidth = 0
            setPadding(dp(7), 0, dp(7), 0)
        }

    private fun switchTab(tab: String) {
        if (selectedTab == tab) return
        selectedTab = tab
        // Render immediately. A successful GET with unchanged JSON must never
        // prevent a newly selected tab from becoming visible.
        showWorkplace()
        if (tab == "Lịch sử") refreshRecords()
        if (tab == "Vị trí") refreshAll()
        ObppDiagnostics.event(this,"TAB_CHANGED")
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
            val startedAt=android.os.SystemClock.elapsedRealtime()
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
                    val eventName=when {
                        path.contains("/session/") -> "HTTP_SESSION"
                        path=="/api/obpp1291/sync" -> "HTTP_SYNC"
                        path.contains("/records") -> "HTTP_RECORDS"
                        path.contains("/locations") -> "HTTP_LOCATIONS"
                        else -> "HTTP_REQUEST"
                    }
                    ObppDiagnostics.event(this,eventName,code in 200..299,
                        android.os.SystemClock.elapsedRealtime()-startedAt,code)
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
                        runOnUiThread { 
                            if(path=="/api/obpp1291/sync") manualSyncRunning=false
                            message(label)
                            if(code==401 && authenticated) showLogin()
                        }
                        return@execute
                    }
                    val response = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                    val parsed = if (response.isBlank()) JSONObject() else JSONObject(response)
                    runOnUiThread { onSuccess(parsed) }
                } finally {
                    conn.disconnect()
                }
            } catch (_: Exception) {
                ObppDiagnostics.event(this,"API_NETWORK_ERROR",false)
                runOnUiThread { if(path=="/api/obpp1291/sync")manualSyncRunning=false }
                message("Không kết nối được service. Chưa lưu dữ liệu, không có hàng đợi offline.")
            }
        }
    }

    private fun showLogin() {
        sessionToken = null
        ObppSessionStore.clear(this)
        workplaceShown = false
        renderedTab = ""
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
                        if(token.startsWith("obpp1_"))ObppSessionStore.save(this,token,displayName)
                        ObppDiagnostics.event(this,"LOGIN_SUCCESS")
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
            if (workplaceShown && selectedTab == "Vị trí") showWorkplace()
            refreshRecords()
        }
    }

    private fun refreshRecords() {
        call("GET", "/api/obpp1291/records?limit=100") { res ->
            val fresh = res.optJSONArray("records") ?: JSONArray()
            val changed = fresh.toString() != recordData.toString()
            recordData = fresh
            if (!workplaceShown || (selectedTab == "Lịch sử" && changed)) showWorkplace()
        }
    }

    private fun showWorkplace() {
        val keepY = if (renderedTab == selectedTab && selectedTab == "Lịch sử" &&
            ::pageScroll.isInitialized) pageScroll.scrollY else 0
        val root = surface()
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(1), 0, dp(1), dp(5))
        }
        val titles = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        titles.addView(TextView(this).apply {
            text = "Hàng rớt OB × PP 1291"
            textSize = 18f
            setTypeface(null, 1)
            setTextColor(navy)
            setSingleLine(true)
        })
        titles.addView(TextView(this).apply {
            text = displayName
            textSize = 12f
            setTextColor(muted)
            setSingleLine(true)
            setPadding(0, dp(1), 0, 0)
        })
        header.addView(titles, LinearLayout.LayoutParams(0, -2, 1f))
        val more = TextView(this).apply {
            text = "⋮"
            textSize = 23f
            gravity = Gravity.CENTER
            contentDescription = "Tùy chọn"
            setTextColor(navy)
            background = rounded(Color.rgb(229, 239, 253), Color.rgb(218, 229, 242), 9)
        }
        more.setOnClickListener { anchor ->
            val menu = PopupMenu(this, anchor)
            menu.menu.add("Đồng bộ ngay")
            menu.menu.add("Kiểm tra cập nhật")
            menu.menu.add("Gửi log ứng dụng")
            menu.menu.add("Đăng xuất")
            menu.setOnMenuItemClickListener { item ->
                when (item.title.toString()) {
                    "Đồng bộ ngay" -> confirmManualSync()
                    "Kiểm tra cập nhật" -> ObppUpdateManager.check(this, true)
                    "Gửi log ứng dụng" -> confirmManualLogSend()
                    "Đăng xuất" -> {
                        call("POST", "/api/obpp1291/session/logout", JSONObject()) { receipt ->
                            if(receipt.optBoolean("logged_out")) {
                                ObppDiagnostics.event(this,"LOGOUT")
                                showLogin()
                            } else message("Chưa xác nhận đăng xuất. Vui lòng thử lại.")
                        }
                    }
                }
                true
            }
            menu.show()
        }
        header.addView(more, LinearLayout.LayoutParams(dp(40), dp(40)))
        root.addView(header)
        workplaceShown = true
        when (selectedTab) {
            "Vị trí" -> showLocations(root)
            "Lịch sử" -> showHistory(root)
            else -> showOperations(root)
        }
        renderedTab = selectedTab
        pageScroll.post { pageScroll.scrollTo(0, keepY) }
        status = TextView(this).apply {
            text = lastSyncMessage
            textSize = 12f
            setTextColor(muted)
            setPadding(dp(2), dp(2), dp(2), dp(3))
        }
        root.addView(status)
    }

    private fun confirmManualLogSend() {
        AlertDialog.Builder(this)
            .setTitle("Gửi log ứng dụng?")
            .setMessage("Gửi thông tin kỹ thuật lên hệ thống để kiểm tra sự cố?")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Gửi log") { _, _ ->
                ObppDiagnostics.sendManual(this) { synced ->
                    runOnUiThread {
                        message(if(synced) "Drive đã nhận log."
                            else "Chưa gửi được log. Dữ liệu được giữ để thử lại.")
                    }
                }
            }.show()
    }

    private fun confirmManualSync() {
        val elapsed=android.os.SystemClock.elapsedRealtime()-lastManualSyncAt
        if(manualSyncRunning || (lastManualSyncAt>0 && elapsed<60000)){
            message("Chờ ít nhất 60 giây giữa hai lần đồng bộ.")
            return
        }
        AlertDialog.Builder(this)
            .setTitle("Xác nhận đồng bộ")
            .setMessage("Kiểm tra và đồng bộ dữ liệu với Google Sheets?")
            .setNegativeButton("Hủy",null)
            .setPositiveButton("Đồng bộ") { _, _ ->
                if(manualSyncRunning)return@setPositiveButton
                manualSyncRunning=true
                lastManualSyncAt=android.os.SystemClock.elapsedRealtime()
                ObppDiagnostics.event(this,"MANUAL_SYNC")
                call("POST","/api/obpp1291/sync",JSONObject()) { result ->
                    manualSyncRunning=false
                    lastSyncMessage=if(result.optString("status")=="OK")
                        "Đã kiểm tra đồng bộ"
                        else "Chưa đồng bộ xong • Sẽ tự thử lại"
                    refreshAll()
                }
            }.show()
    }

    private fun showOperations(container: LinearLayout) {
        val root = panel(container, "")
        root.addView(fieldLabel("Quét QR"))
        val scanRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        qr = field("Scan QR")
        qr.imeOptions = EditorInfo.IME_ACTION_DONE
        qr.setOnEditorActionListener { _, _, event ->
            if (event == null || event.keyCode == KeyEvent.KEYCODE_ENTER) { parseScan(); true }
            else false
        }
        scanRow.addView(qr, LinearLayout.LayoutParams(0, dp(44), 1f))
        val splitQr = compactButton("Tách QR") { parseScan() }
        scanRow.addView(splitQr, LinearLayout.LayoutParams(dp(92), dp(40)).apply {
            leftMargin = dp(7)
        })
        root.addView(scanRow, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) })

        store = field("", uppercase = true)
        doCode = field("", numerical = true)
        parcels = field("", numerical = true)
        val firstRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        inputColumn(firstRow, "Mã cửa hàng", store)
        inputColumn(firstRow, "DO", doCode, 8)
        root.addView(firstRow, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(9) })

        val labels = mutableListOf("Chọn vị trí")
        for (i in 0 until locationData.length()) {
            val item = locationData.optJSONObject(i) ?: continue
            labels.add(item.optString("code"))
        }
        locationSpinner = Spinner(this)
        locationSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, labels)
        val secondRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        inputColumn(secondRow, "Số kiện", parcels)
        inputColumn(secondRow, "Vị trí", locationSpinner, 8)
        root.addView(secondRow, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(11) })

        root.addView(action("LƯU GHI NHẬN") { saveRecord() },
            LinearLayout.LayoutParams(-1, dp(46)))
        if (pendingQrFocus) {
            pendingQrFocus = false
            qr.requestFocus()
        }
    }

    private fun showHistory(container: LinearLayout) {
        val history = panel(container, "")
        val availableIds = (0 until recordData.length()).mapNotNull {
            recordData.optJSONObject(it)?.optString("id")?.takeIf { key -> key.isNotBlank() }
        }.toSet()
        selectedRecordIds.retainAll(availableIds)
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val selectAll = compactButton("Chọn tất cả") { }
        val deleteSelected = compactButton("Xóa đã chọn") { }
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
        bar.addView(selectAll, LinearLayout.LayoutParams(0, dp(38), 1f))
        bar.addView(deleteSelected, LinearLayout.LayoutParams(0, dp(38), 1f).apply {
            leftMargin = dp(6)
        })
        history.addView(bar, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(4) })

        for (i in 0 until recordData.length()) {
            val item = recordData.optJSONObject(i) ?: continue
            val id = item.optString("id")
            val sync = item.optString("sync_status")
            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(4), dp(3), dp(5), dp(3))
                background = rounded(syncTint(sync), Color.rgb(217, 228, 239), 10)
                contentDescription = syncLabel(sync)
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
            line.addView(checkbox, LinearLayout.LayoutParams(dp(42), dp(44)))
            val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            val infoTop = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            infoTop.addView(TextView(this).apply {
                text = item.optString("date_vn") + " " + item.optString("time_vn")
                textSize = 12f
                setTextColor(muted)
                setSingleLine(true)
            }, LinearLayout.LayoutParams(0, -2, 1f))
            infoTop.addView(TextView(this).apply {
                text = syncLabel(sync)
                textSize = 10.5f
                setTypeface(null, 1)
                setTextColor(navy)
                setPadding(dp(5), dp(2), dp(5), dp(2))
            })
            content.addView(infoTop)
            content.addView(TextView(this).apply {
                text = item.optString("store_code") + " · " + item.optString("do_code") +
                    " · " + item.optString("total_parcels") + " kiện · " +
                    item.optString("location")
                textSize = 13.5f
                setTextColor(navy)
                setPadding(0, dp(3), 0, dp(2))
            })
            content.setOnLongClickListener {
                if (id.isNotBlank()) showRecordActions(item)
                true
            }
            line.addView(content, LinearLayout.LayoutParams(0, -2, 1f))
            history.addView(line, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5) })
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
                lastSyncMessage = "Đã lưu • Xem trạng thái Sheets trong Lịch sử"
                ObppDiagnostics.event(this,"RECORD_SAVED")
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
        val area = panel(root, "")
        val addRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val locationName = field("Vị trí mới", uppercase = true)
        addRow.addView(locationName, LinearLayout.LayoutParams(0, dp(44), 1f))
        addRow.addView(compactButton("Thêm", true) {
            try {
                val code = ObQrParser.position(locationName.text.toString())
                call("POST", "/api/obpp1291/locations",
                    JSONObject().put("code", code).put("operation_id", UUID.randomUUID().toString())) {
                    refreshAll()
                    showWorkplace()
                }
            } catch (e: IllegalArgumentException) { message(e.message ?: "Vị trí không hợp lệ") }
        }, LinearLayout.LayoutParams(dp(86), dp(42)).apply { leftMargin = dp(7) })
        area.addView(addRow, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(7) })

        val ids = (0 until locationData.length()).mapNotNull {
            locationData.optJSONObject(it)?.optString("code")?.takeIf { code -> code.isNotBlank() }
        }.toSet()
        selectedLocationCodes.retainAll(ids)
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val selectAll = compactButton("Chọn tất cả") { }
        val remove = compactButton("Xóa đã chọn") { confirmLocationDelete() }
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
        bar.addView(selectAll, LinearLayout.LayoutParams(0, dp(38), 1f))
        bar.addView(remove, LinearLayout.LayoutParams(0, dp(38), 1f).apply { leftMargin = dp(6) })
        area.addView(bar)

        for (i in 0 until locationData.length()) {
            val item = locationData.optJSONObject(i) ?: continue
            val code = item.optString("code")
            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(4), dp(2), dp(6), dp(2))
                background = rounded(Color.rgb(248, 250, 253), Color.rgb(227, 234, 243), 9)
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
            line.addView(checkbox, LinearLayout.LayoutParams(dp(42), dp(40)))
            val label = TextView(this).apply {
                text = code
                textSize = 14f
                setTextColor(navy)
                gravity = Gravity.CENTER_VERTICAL
                setOnLongClickListener { locationActions(code); true }
            }
            line.addView(label, LinearLayout.LayoutParams(0, dp(40), 1f))
            area.addView(line, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5) })
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
                    selectedLocationCodes.clear()
                    selectedLocationCodes.add(oldCode)
                    confirmLocationDelete()
                }
            }.show()
    }
}
