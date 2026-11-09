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
import android.text.Editable
import android.text.TextWatcher
import android.widget.AdapterView
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
    private var historyOwner = ""
    private var historySyncing = false
    private var historyDeleting = false
    private var historyPage = 0
    private var historyPageCount = 0
    private var editingId: String? = null
    private var editingRevision = 0
    private var pendingSaveKey: String? = null
    private var pendingSaveId: String? = null
    private val selectedRecordIds = mutableSetOf<String>()
    private val selectedLocationCodes = mutableSetOf<String>()
    private var pendingQrFocus = false
    private var draft = JSONObject()
    private var restoringDraft = false
    private var savingRecord = false
    private lateinit var note: EditText
    private fun captureDraft() {
        if (restoringDraft || selectedTab != "Nghiệp vụ" ||
            !::qr.isInitialized || !::store.isInitialized || !::note.isInitialized ||
            !::locationSpinner.isInitialized) return
        draft.put("qr",qr.text.toString())
            .put("store",store.text.toString()).put("do",doCode.text.toString())
            .put("parcels",parcels.text.toString()).put("location",
                locationSpinner.selectedItem?.toString()?.takeUnless { it=="Chọn vị trí" } ?: "")
            .put("note",note.text.toString())
            .put("editing_id",editingId ?: "").put("editing_revision",editingRevision)
        ObppDraftStore.save(this,draft)
    }
    private fun watchDraft(view: EditText) {
        view.addTextChangedListener(object: TextWatcher {
            override fun beforeTextChanged(s:CharSequence?,start:Int,count:Int,after:Int) {}
            override fun onTextChanged(s:CharSequence?,start:Int,before:Int,count:Int) { captureDraft() }
            override fun afterTextChanged(s:Editable?) {}
        })
    }
    private fun restoreDraftUi() {
        restoringDraft=true
        try {
            qr.setText(draft.optString("qr",""))
            store.setText(draft.optString("store",""))
            doCode.setText(draft.optString("do",""))
            parcels.setText(draft.optString("parcels",""))
            note.setText(draft.optString("note",""))
            val selected=draft.optString("location","")
            for (i in 1 until locationSpinner.count)
                if(locationSpinner.getItemAtPosition(i).toString()==selected) {
                    locationSpinner.setSelection(i)
                    break
                }
        } finally { restoringDraft=false }
    }
    private var workplaceShown = false
    private var renderedTab = ""
    private var historyScrollY = 0
    private var historySearchQuery = ""
    private var loadedHistoryQuery = ""
    private var pendingHistorySearch: Runnable? = null
    private lateinit var historyResults: LinearLayout
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
                    call("GET","/api/obpp1291/session/status") { bindHistoryOwner(it) }
                if(selectedTab == "Lịch sử"){
                    val states=(0 until recordData.length()).mapNotNull {
                        recordData.optJSONObject(it)?.optString("sync_status")
                    }
                    if(states.any { it == "PENDING" || it == "ERROR" } || syncPollTick % 6 == 0)
                        refreshRecords(false)
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
            call("GET","/api/obpp1291/session/status") { bindHistoryOwner(it) }
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
        draft=ObppDraftStore.restore(this)
        editingId=draft.optString("editing_id","").ifBlank { null }
        editingRevision=draft.optInt("editing_revision",0)
        ObppDiagnostics.scheduleDaily(this)
        val restored = ObppSessionStore.restore(this)
        if(restored != null){
            sessionToken = restored.first
            displayName = restored.second
            historyOwner = ObppSessionStore.cacheOwner(this)
            // Render cached data without waiting for a network roundtrip.
            showWorkplace()
            renderLocalHistory()
            refreshAll()
        }else showLogin()
        ObppUpdateManager.check(this, false)
    }

    override fun onDestroy() {
        if(selectedTab=="Nghiệp vụ" && workplaceShown)captureDraft()
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
            if (selectedTab == "Lịch sử") {
                // Fixed, compact search box above the bottom navigation.
                val search = field("Tìm kiếm").apply {
                    textSize = 14f
                    minHeight = dp(38)
                    filters = arrayOf(InputFilter.LengthFilter(80))
                    imeOptions = EditorInfo.IME_ACTION_SEARCH
                    setText(historySearchQuery)
                    addTextChangedListener(object : TextWatcher {
                        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                            historySearchQuery = s?.toString().orEmpty()
                            historyPage = 0
                            if (::historyResults.isInitialized) renderLocalHistory()
                            pendingHistorySearch?.let { syncPollHandler.removeCallbacks(it) }
                            val task = Runnable {
                                if (selectedTab == "Lịch sử") renderLocalHistory()
                            }
                            pendingHistorySearch = task
                            syncPollHandler.postDelayed(task, 350)
                        }
                        override fun afterTextChanged(s: Editable?) {}
                    })
                }
                root.addView(search, LinearLayout.LayoutParams(-1, dp(38)).apply {
                    bottomMargin = dp(3)
                })
            }
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
        if (selectedTab == "Lịch sử") {
            pendingHistorySearch?.let { syncPollHandler.removeCallbacks(it) }
            pendingHistorySearch = null
        }
        if(selectedTab=="Nghiệp vụ")captureDraft()
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

    /** The footer must reflect each async completion on the active tab.
     * Recreating the screen to display a message would lose draft focus/scroll. */
    private fun message(value: String) {
        runOnUiThread {
            lastSyncMessage = value
            if (::status.isInitialized) status.text = value
            else AlertDialog.Builder(this).setMessage(value).setPositiveButton("Đóng", null).show()
        }
    }

    private fun call(
        method: String,
        path: String,
        request: JSONObject? = null,
        authenticated: Boolean = true,
        onFailure: ((Int,String) -> Unit)? = null,
        onSuccess: (JSONObject) -> Unit
    ) {
        val bearer = sessionToken
        if (authenticated && bearer.isNullOrBlank()) {
            onFailure?.invoke(401,"NO_SESSION")
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
                        val label = if (code == 409 &&
                            path == "/api/auth/privileged-code" &&
                            safeError == "CODE_PENDING_UNTIL_CONSUMED") {
                            "Đã có mã đăng nhập chưa sử dụng. Vui lòng dùng mã trong email quản trị."
                        } else when (code) {
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
                            onFailure?.invoke(code,safeError)
                            // Duplicate DO is handled by the save confirmation dialog.
                            if(safeError!="DUPLICATE_RECORD" || onFailure==null) message(label)
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
                runOnUiThread {
                    if(path=="/api/obpp1291/sync")manualSyncRunning=false
                    onFailure?.invoke(-1,"NETWORK_ERROR")
                }
                message("Không kết nối được service. Chưa lưu dữ liệu, không có hàng đợi offline.")
            }
        }
    }

    private fun showLogin() {
        sessionToken = null
        historyOwner = ""
        historySyncing = false
        recordData = JSONArray()
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
                        val owner = res.optString("cache_owner")
                        if (owner.isBlank()) {
                            message("Không nhận được định danh đồng bộ lịch sử.")
                            return@call
                        }
                        if(token.startsWith("obpp1_"))ObppSessionStore.save(this,token,displayName,owner)
                        bindHistoryOwner(res)
                        ObppDraftStore.bindUser(this,user)
                        draft=ObppDraftStore.restore(this)
                        editingId=draft.optString("editing_id","").ifBlank { null }
                        editingRevision=draft.optInt("editing_revision",0)
                        // E061: bind this account's draft before rendering; do not wait for Cloud history.
                        showWorkplace()
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

    private fun bindHistoryOwner(response: JSONObject) {
        val owner = response.optString("cache_owner")
        if (owner.isBlank() || owner.length > 128) return
        if (historyOwner != owner) {
            historyOwner = owner
            historySyncing = false
            historyPage = 0
            recordData = JSONArray()
            selectedRecordIds.clear()
            ObppSessionStore.bindCacheOwner(this,owner)
            renderLocalHistory()
            refreshRecords()
        }
    }

    /** Read indexed device history first. A page is only a presentation boundary. */
    private fun renderLocalHistory() {
        try {
            historyPageCount = ObppHistoryStore.count(this,historyOwner,historySearchQuery)
            val pages = if(historyPageCount==0) 0 else (historyPageCount-1)/100
            historyPage = historyPage.coerceIn(0,pages)
            recordData = ObppHistoryStore.page(this,historyOwner,historySearchQuery,historyPage)
            if (selectedTab == "Lịch sử" && ::historyResults.isInitialized) {
                val oldY = if (::pageScroll.isInitialized) pageScroll.scrollY else 0
                renderHistoryRows()
                pageScroll.post { if(selectedTab=="Lịch sử") pageScroll.scrollTo(0,oldY) }
            }
        } catch (_:Exception) {
            message("Không đọc được lịch sử cục bộ trên PDA.")
        }
    }

    private fun refreshRecords(renderCache: Boolean = true) {
        // Regular 5s status checks must not reconstruct the visible 100-row
        // layout until there is an actual server delta.
        if(renderCache) renderLocalHistory()
        if (historyOwner.isBlank() || historySyncing || sessionToken.isNullOrBlank()) return
        historySyncing = true
        fetchHistoryPage(historyOwner)
    }

    /** Resume initial full hydration, then receive only ordered mutations and tombstones. */
    private fun fetchHistoryPage(owner: String) {
        if (historyOwner != owner || sessionToken.isNullOrBlank()) {
            historySyncing=false
            return
        }
        val state = ObppHistoryStore.state(this,owner)
        if (state.complete) {
            fetchHistoryChanges(owner)
            return
        }
        val uri = StringBuilder("/api/obpp1291/records?limit=100")
        if(state.snapshot.isNotBlank()) {
            uri.append("&snapshot=").append(java.net.URLEncoder.encode(state.snapshot,"UTF-8"))
            if(state.cursor.isNotBlank())
                uri.append("&cursor=").append(java.net.URLEncoder.encode(state.cursor,"UTF-8"))
        }
        call("GET",uri.toString(),onFailure={ _,_ -> historySyncing=false }) { response ->
            if (historyOwner != owner) { historySyncing=false;return@call }
            try {
                val hasMore=response.optBoolean("has_more",false)
                val next=response.optString("next_cursor")
                val snapshot=response.optString("snapshot_at")
                if (hasMore && next.isBlank()) throw IllegalStateException("History cursor absent")
                ObppHistoryStore.acceptPage(
                    this,owner,response.optJSONArray("records")?:JSONArray(),snapshot,
                    next,response.optLong("baseline_seq",0L),
                    response.optInt("total_count",0),hasMore
                )
                if(state.snapshot.isBlank() || !hasMore) renderLocalHistory()
                if(hasMore) fetchHistoryPage(owner) else fetchHistoryChanges(owner)
            } catch (_:Exception) {
                historySyncing=false
                message("Đồng bộ lịch sử chưa hoàn tất. Sẽ tiếp tục từ trang đã lưu.")
            }
        }
    }

    private fun fetchHistoryChanges(owner: String) {
        if (owner != historyOwner) { historySyncing=false;return }
        val state=ObppHistoryStore.state(this,owner)
        if(!state.complete){fetchHistoryPage(owner);return}
        call("GET","/api/obpp1291/records/changes?limit=100&after="+state.appliedSeq,
            onFailure={ _,_ -> historySyncing=false }) { response ->
            if(owner!=historyOwner){historySyncing=false;return@call}
            try {
                val events=response.optJSONArray("changes")?:JSONArray()
                val next=response.optLong("next_after",state.appliedSeq)
                if (!ObppHistoryStore.acceptChanges(this,owner,state.appliedSeq,events,next))
                    throw IllegalStateException("History sequence conflict")
                if(events.length()>0) renderLocalHistory()
                if(response.optBoolean("has_more",false)){
                    if(events.length()==0)throw IllegalStateException("Empty continuing delta")
                    fetchHistoryChanges(owner)
                } else historySyncing=false
            }catch (_:Exception){
                historySyncing=false
                message("Lịch sử local chưa cập nhật đủ. Sẽ thử lại khi kết nối.")
            }
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
                                ObppDraftStore.clear(this)
                                draft=JSONObject()
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
                    message(if(result.optString("status")=="OK")
                        "Đã kiểm tra đồng bộ"
                        else "Chưa đồng bộ xong • Sẽ tự thử lại")
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
        root.addView(secondRow, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(9) })

        // Note is an actual multiline field; label occupies its own line.
        root.addView(fieldLabel("Ghi chú"))
        note = field("").apply {
            setSingleLine(false)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            gravity = Gravity.TOP or Gravity.START
            filters = arrayOf(InputFilter.LengthFilter(500))
            minHeight = dp(132)
        }
        root.addView(note, LinearLayout.LayoutParams(-1, dp(132)).apply { bottomMargin=dp(10) })
        restoreDraftUi()
        listOf(qr,store,doCode,parcels,note).forEach(::watchDraft)
        locationSpinner.onItemSelectedListener=object:AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent:AdapterView<*>?,view:View?,position:Int,id:Long) {
                captureDraft()
            }
            override fun onNothingSelected(parent:AdapterView<*>?) {}
        }

        root.addView(action("LƯU GHI NHẬN") { saveRecord() },
            LinearLayout.LayoutParams(-1, dp(46)))
        if (pendingQrFocus) {
            pendingQrFocus = false
            qr.requestFocus()
        }
    }

    private fun showHistory(container: LinearLayout) {
        historyResults = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        container.addView(historyResults)
        renderHistoryRows()
    }

    private fun renderHistoryRows() {
        if (selectedTab != "Lịch sử" || !::historyResults.isInitialized) return
        historyResults.removeAllViews()
        val history = panel(historyResults, "")
        val state=ObppHistoryStore.state(this,historyOwner)
        val storedCount=ObppHistoryStore.count(this,historyOwner)
        val summary=if(state.complete)
            "Đã lưu $storedCount bản ghi trên PDA • Trang ${historyPage+1}/${if(historyPageCount==0) 1 else (historyPageCount+99)/100}"
        else "Đang tải lịch sử về PDA: $storedCount/${state.expected.takeIf { it>0 } ?: "?"}"
        history.addView(heading(summary))
        val query = historySearchQuery.trim()
        val filtered = (0 until recordData.length()).mapNotNull { recordData.optJSONObject(it) }
            .filter { item -> query.isBlank() ||
                item.optString("store_code").contains(query, ignoreCase = true) ||
                item.optString("do_code").contains(query, ignoreCase = true) ||
                item.optString("location").contains(query, ignoreCase = true) }
        val availableIds = filtered.mapNotNull {
            it.optString("id").takeIf { id -> id.isNotBlank() }
        }.toSet()
        // Deletion and select-all may only act on records currently visible.
        selectedRecordIds.retainAll(availableIds)
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val selectAll = compactButton("Chọn trang đang xem") { }
        val deleteSelected = compactButton("Xóa đã chọn") { }
        val checkboxes = mutableListOf<CheckBox>()
        val updateSelection = {
            selectAll.text = if (availableIds.isNotEmpty() && selectedRecordIds.containsAll(availableIds))
                "Bỏ chọn" else "Chọn trang đang xem"
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

        for (item in filtered) {
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
        if(historyPageCount>100){
            val pager=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL }
            val previous=secondaryAction("Trang trước") {
                selectedRecordIds.clear()
                historyPage=(historyPage-1).coerceAtLeast(0)
                renderLocalHistory()
            }.apply { isEnabled=historyPage>0 }
            val next=secondaryAction("Trang sau") {
                selectedRecordIds.clear()
                historyPage+=1
                renderLocalHistory()
            }.apply { isEnabled=(historyPage+1)*100<historyPageCount }
            pager.addView(previous,LinearLayout.LayoutParams(0,dp(38),1f))
            pager.addView(next,LinearLayout.LayoutParams(0,dp(38),1f))
            history.addView(pager)
        }
        if (!state.complete) history.addView(heading("Chưa tải đủ dữ liệu Cloud; kết quả tìm kiếm local có thể chưa đầy đủ."))
        if (filtered.isEmpty()) history.addView(heading(
            if (query.isBlank()) "Chưa có bản ghi." else "Không tìm thấy kết quả."
        ))
    }

    private fun confirmBulkDelete() {
        if(historyDeleting)return
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
            .setTitle("Xóa " + items.length() + " bản ghi đang chọn?")
            .setMessage("Chỉ xóa bản ghi đã chọn trên trang đang xem, không xóa các trang ẩn. Dữ liệu cũng sẽ được xóa khỏi Sheet sau khi Cloud xác nhận.")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Xóa đã chọn") { _, _ ->
                historyDeleting=true
                message("Đang yêu cầu Cloud xóa " + items.length() + " bản ghi...")
                val selectedSnapshot=selectedRecordIds.toSet()
                val payload = JSONObject()
                    .put("operation_id", UUID.randomUUID().toString())
                    .put("items", items)
                call("POST", "/api/obpp1291/records/bulk-delete", payload,
                    onFailure={ code,_ ->
                        historyDeleting=false
                        if(code==409){
                            message("Có bản ghi đã thay đổi hoặc đã xóa ở PDA khác. Đã dừng cả lô, vui lòng kiểm tra và chọn lại.")
                            selectedRecordIds.clear()
                            refreshRecords()
                        } else if(code==413) message("Gói xóa vượt giới hạn Worker. Chưa xóa bản ghi nào.")
                    }) { receipt ->
                    historyDeleting=false
                    val deleted=receipt.optInt("deleted_count",0)
                    if(deleted==items.length()){
                        ObppHistoryStore.removeAcknowledged(this,historyOwner,selectedSnapshot)
                        selectedRecordIds.clear()
                        message("Cloud đã xóa $deleted bản ghi. Google Sheet đang đồng bộ.")
                        renderLocalHistory()
                        refreshRecords()
                    } else {
                        message("Kết quả xóa chưa khớp. Đang đối chiếu lại dữ liệu Cloud.")
                        refreshRecords()
                    }
                }
            }.show()
    }

    private fun parseScan() {
        val raw = qr.text.toString()
        if (raw.isBlank()) return
        try {
            val info = ObQrParser.parse(raw)
            if(raw!=draft.optString("parsed_qr","")) {
                note.setText("")
                editingId=null
                editingRevision=0
                pendingSaveKey=null
                pendingSaveId=null
            }
            draft.put("parsed_qr",raw)
            store.setText(info.storeCode)
            doCode.setText(info.doCode)
            parcels.setText(info.totalParcels.toString())
            captureDraft()
            message("Đã đọc QR: kiện " + info.parcelIndex + "/" + info.totalParcels)
        } catch (e: IllegalArgumentException) {
            message(e.message ?: "QR không hợp lệ")
        }
    }

    private fun saveRecord(confirmedDuplicate: Boolean = false) {
        if(savingRecord)return
        captureDraft()
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
                .put("note",note.text.toString().trim())
            val id = editingId
            if (id != null) json.put("expected_revision", editingRevision)
            // Keep the same idempotency key after the server's 409 warning.
            val key = json.toString() + "|" + (id ?: "")
            if (key != pendingSaveKey) {
                pendingSaveKey = key
                pendingSaveId = UUID.randomUUID().toString()
            }
            if (confirmedDuplicate) json.put("allow_duplicate_do", true)
            json.put("operation_id", pendingSaveId)
            val path = if (id == null) "/api/obpp1291/records" else "/api/obpp1291/records/" + id
            savingRecord=true
            call(if (id == null) "POST" else "PATCH", path, json,
                onFailure={ _, error ->
                    savingRecord=false
                    if(error=="DUPLICATE_RECORD") {
                        if (confirmedDuplicate) {
                            message("Chưa lưu được DO trùng. Vui lòng thử lại sau khi cập nhật dịch vụ.")
                        } else {
                            AlertDialog.Builder(this)
                                .setTitle("DO đã tồn tại")
                                .setMessage("DO này đã có trong lịch sử. Vẫn muốn lưu thêm?")
                                .setNegativeButton("Bỏ qua", null)
                                .setPositiveButton("Xác nhận") { _, _ -> saveRecord(true) }
                                .show()
                        }
                    }
                }) { res ->
                savingRecord=false
                editingId = null
                editingRevision = 0
                pendingSaveKey = null
                pendingSaveId = null
                draft=JSONObject()
                ObppDraftStore.clear(this)
                message("Đã lưu • Xem trạng thái Sheets trong Lịch sử")
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
                        note.setText(record.optString("note"))
                        captureDraft()
                        message("Đang chỉnh sửa bản ghi")
                    }
                    1 -> AlertDialog.Builder(this)
                        .setTitle("Xác nhận xóa")
                        .setMessage("Xóa bản ghi khỏi lịch sử?")
                        .setNegativeButton("Hủy", null)
                        .setPositiveButton("Xóa") { _, _ ->
                            val payload = JSONObject().put("operation_id", UUID.randomUUID().toString())
                                .put("expected_revision", record.optInt("revision"))
                            message("Đang yêu cầu Cloud xóa bản ghi...")
                            call("DELETE", "/api/obpp1291/records/" + id, payload) {
                                ObppHistoryStore.removeAcknowledged(this,historyOwner,setOf(id))
                                selectedRecordIds.remove(id)
                                message("Cloud đã xóa bản ghi. Google Sheet đang đồng bộ.")
                                renderLocalHistory()
                                refreshRecords(false)
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
                    message("Đã thêm vị trí • Google Sheet đang đồng bộ.")
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
                    message("Cloud đã xóa vị trí. Google Sheet đang đồng bộ.")
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
                                    message("Đã cập nhật vị trí • Google Sheet đang đồng bộ.")
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
