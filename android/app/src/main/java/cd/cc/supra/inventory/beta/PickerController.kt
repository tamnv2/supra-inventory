package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.AlertDialog
import android.app.Dialog
import android.graphics.Color
import android.graphics.Typeface
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.InputType
import android.text.TextUtils
import android.text.TextWatcher
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.max
import kotlin.math.roundToInt

class PickerController(
    private val activity: Activity,
    private val api: InventoryApi,
    private val cache: SkuCatalogCache,
    private val kit: InventoryUi,
    private val setStatus: (String) -> Unit,
    private val friendlyError: (Exception) -> String,
    private val recordLog: (String) -> Unit,
    private val displayScale: Float = 1f,
) {
    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private val timeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(zone)
    private val handler = Handler(Looper.getMainLooper())
    private var searchTask: Runnable? = null
    private var searchGeneration = 0
    private var syncing = false
    private var refreshing = false
    private var refreshDirty = false
    private val refreshWaiters = mutableListOf<(Boolean) -> Unit>()
    private var resultDialogShowing = false
    private val receivedResults = mutableSetOf<String>()
    private val displayedResults = mutableSetOf<String>()
    private var input: EditText? = null
    private var autoInput: AutoCompleteTextView? = null
    private var suggestions: LinearLayout? = null
    private var suggestionRows: List<SkuItem> = emptyList()
    private var selectedBox: LinearLayout? = null
    private var selectedSkuLabel: TextView? = null
    private var selectedNameLabel: TextView? = null
    private var reportButton: Button? = null
    private var catalogLabel: TextView? = null
    private var historyBox: LinearLayout? = null
    private var historyRenderer: KeyedLinearRenderer? = null
    private var historyList: ListView? = null
    private var selected: SkuItem? = null
    private var pendingResults: List<PickerResult> = emptyList()
    private val withdrawButtons = linkedMapOf<Button, Long>()
    private val relayPocClient = RelayPocClient(activity.applicationContext, api, recordLog) { message ->
        activity.runOnUiThread { showRelayProgress(message) }
    }
    private var relayLockedUntilMs: Long = 0L
    @Volatile private var relayRequestInFlight = false
    private var relayPicklistInput: EditText? = null
    private var relayButton: Button? = null
    private var relayStatus: TextView? = null
    private var shortagePanel: View? = null
    private var confirmPanel: View? = null
    private var shortageTab: TextView? = null
    private var confirmTab: TextView? = null

    private fun scaledSp(base: Float): Float = (base * displayScale).coerceIn(9f, 27f)

    private fun applyDisplayScale(root: View) {
        val density = activity.resources.displayMetrics.scaledDensity
        fun visit(view: View) {
            if (view is TextView && view.id != R.id.btnRelayPocSend) {
                val baseSp = view.textSize / density
                view.textSize = (baseSp * displayScale).coerceIn(9f, 27f)
            }
            if (view is ViewGroup) {
                for (index in 0 until view.childCount) visit(view.getChildAt(index))
            }
        }
        visit(root)
        val controlHeight = kit.dp((48f * displayScale).roundToInt().coerceIn(44, 64))
        listOf(
            root.findViewById<View>(R.id.acSkuSearch),
            root.findViewById<View>(R.id.btnReportShortage),
            root.findViewById<View>(R.id.etRelayPicklistSuffix),
            root.findViewById<View>(R.id.btnRelayPocSend),
        ).forEach { control ->
            control?.layoutParams?.let { params ->
                params.height = controlHeight
                control.layoutParams = params
            }
        }
    }

    private val withdrawTicker = object : Runnable {
        override fun run() {
            val now = System.currentTimeMillis()
            val iterator = withdrawButtons.iterator()
            while (iterator.hasNext()) {
                val entry = iterator.next()
                val button = entry.key
                if (!button.isAttachedToWindow) {
                    iterator.remove()
                    continue
                }
                val remaining = max(0L, (entry.value - now + 999L) / 1000L)
                button.text = if (remaining > 0) "Thu hồi (${remaining}s)" else "Hết thời gian thu hồi"
                button.isEnabled = remaining > 0
            }
            handler.postDelayed(this, 1000)
        }
    }

    fun render(root: LinearLayout) {
        handler.post(withdrawTicker)
        applyDisplayScale(root)
        autoInput = root.findViewById(R.id.acSkuSearch)
        input = autoInput
        selectedSkuLabel = root.findViewById(R.id.tvSelectedSku)
        selectedNameLabel = root.findViewById(R.id.tvSelectedProduct)
        selectedBox = selectedSkuLabel?.parent as? LinearLayout
        reportButton = root.findViewById<Button>(R.id.btnReportShortage)?.apply {
            contentDescription = "Báo SKU hết hàng"
            setOnClickListener { submit() }
        }
        historyList = root.findViewById(R.id.listMyReports)
        catalogLabel = null
        suggestions = null
        historyBox = null
        historyRenderer = null

        shortagePanel = root.findViewById(R.id.panelShortage)
        confirmPanel = root.findViewById(R.id.panelConfirmOrder)
        shortageTab = root.findViewById<TextView>(R.id.tabShortage)?.apply {
            setOnClickListener { showOperationTab(confirm = false) }
        }
        confirmTab = root.findViewById<TextView>(R.id.tabConfirmOrder)?.apply {
            setOnClickListener { showOperationTab(confirm = true) }
        }
        relayStatus = root.findViewById(R.id.tvRelayPocStatus)
        relayButton = root.findViewById<Button>(R.id.btnRelayPocSend)?.apply {
            isEnabled = false
            alpha = 0.42f
            setOnClickListener { submitRelayProbe() }
        }
        relayPicklistInput = root.findViewById<EditText>(R.id.etRelayPicklistSuffix)?.apply {
            isEnabled = true
            isFocusable = true
            isFocusableInTouchMode = true
            addTextChangedListener(object : TextWatcher {
                private var normalizing = false
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
                override fun afterTextChanged(s: Editable?) {
                    if (normalizing) return
                    val raw = s?.toString().orEmpty()
                    val digits = raw.filter(Char::isDigit).take(4)
                    if (raw != digits) {
                        normalizing = true
                        setText(digits)
                        setSelection(digits.length)
                        normalizing = false
                    }
                    val locked = System.currentTimeMillis() < relayLockedUntilMs
                    setRelayButtonReady(digits.length == 4 && !locked && !relayRequestInFlight)
                    showRelayHint(
                        if (locked) {
                            "Tra cứu Picklist đang bị khóa. Vui lòng về bàn chuyên viên xử lý."
                        } else if (digits.isEmpty()) {
                            "Sẵn sàng nhập 4 số cuối để kiểm tra Picklist."
                        } else if (digits.length < 4) {
                            "Đã nhập " + digits.length + "/4 số."
                        } else {
                            "Đủ 4 số. Sẵn sàng kiểm tra Picklist."
                        }
                    )
                }
            })
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE && text?.length == 4 && !relayRequestInFlight) {
                    submitRelayProbe()
                    true
                } else {
                    false
                }
            }
        }
        showOperationTab(confirm = false)

        autoInput?.threshold = 3
        autoInput?.addTextChangedListener(object : TextWatcher {
            private var normalizing = false
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                if (normalizing) return
                val raw = s?.toString().orEmpty()
                val digits = raw.filter(Char::isDigit)
                if (raw != digits) {
                    normalizing = true
                    autoInput?.setText(digits)
                    autoInput?.setSelection(digits.length)
                    normalizing = false
                    return
                }
                val value = digits.trim()
                if (selected?.sku == value) {
                    searchTask?.let { handler.removeCallbacks(it) }
                    suggestionRows = emptyList()
                    autoInput?.dismissDropDown()
                    updateReportEnabled()
                    return
                }
                if (selected != null) clearSelection()
                if (value.length < 3) {
                    searchTask?.let { handler.removeCallbacks(it) }
                    suggestionRows = emptyList()
                    autoInput?.dismissDropDown()
                    return
                }
                val exact = cache.exactSku(value)
                if (exact != null) {
                    selectSku(exact, false)
                    return
                }
                scheduleSearch(value)
            }
        })
        autoInput?.setOnItemClickListener { _, _, position, _ ->
            suggestionRows.getOrNull(position)?.let { selectSku(it, true) }
        }
        autoInput?.setOnEditorActionListener { _, _, _ ->
            val exact = cache.exactSku(autoInput?.text?.toString().orEmpty())
            if (exact != null) { selectSku(exact, true); true } else false
        }
        clearSelection()
        syncCatalog(auto = true)
        refresh()
    }

    fun onRealtime(scopes: Set<String>, completion: (Boolean) -> Unit) {
        if (scopes.contains("sku_catalog")) syncCatalog(auto = true)
        if (scopes.contains("picker_reports")) refresh(completion)
        else completion(true)
    }

    fun destroy() {
        searchTask?.let { handler.removeCallbacks(it) }
        handler.removeCallbacks(withdrawTicker)
        historyRenderer = null
        relayPocClient.close()
    }

    private fun showOperationTab(confirm: Boolean) {
        shortagePanel?.visibility = if (confirm) View.GONE else View.VISIBLE
        confirmPanel?.visibility = if (confirm) View.VISIBLE else View.GONE
        shortageTab?.apply {
            setBackgroundResource(if (confirm) R.drawable.bg_picker_tab_idle else R.drawable.bg_picker_tab_selected)
            setTextColor(if (confirm) kit.muted else kit.navy)
            isSelected = !confirm
        }
        confirmTab?.apply {
            setBackgroundResource(if (confirm) R.drawable.bg_picker_tab_selected else R.drawable.bg_picker_tab_idle)
            setTextColor(if (confirm) kit.navy else kit.muted)
            isSelected = confirm
        }
        if (confirm) {
            recordLog("Picker mở tab Xác nhận đơn")
            relayPicklistInput?.post {
                relayPicklistInput?.requestFocus()
                activity.getSystemService(InputMethodManager::class.java)
                    ?.showSoftInput(relayPicklistInput, InputMethodManager.SHOW_IMPLICIT)
            }
        } else {
            recordLog("Picker mở tab Báo hết hàng")
        }
    }

    private fun submitRelayProbe() {
        if (relayRequestInFlight) return
        if (System.currentTimeMillis() < relayLockedUntilMs) {
            showRelayWarning(
                "Tra cứu Picklist đã bị khóa",
                "Bạn đã nhập sai nhiều lần. Vui lòng về bàn chuyên viên xử lý trực tiếp."
            )
            return
        }
        val suffix = relayPicklistInput?.text?.toString()?.trim().orEmpty()
        if (!suffix.matches(Regex("^\\d{4}$"))) {
            showRelayHint("Nhập đúng 4 số cuối Picklist.")
            setRelayButtonReady(false)
            return
        }
        if (!isOnline()) {
            showRelayResult("PDA chưa có kết nối Internet.", false)
            recordLog("Relay PDA chưa có Internet validated")
            return
        }
        relayRequestInFlight = true
        setRelayButtonReady(false)
        showRelayProgress("Đang xác nhận lấy lại đơn...")
        recordLog("Bắt đầu xác nhận lấy lại đơn; không ghi giá trị Picklist vào log")
        Thread {
            try {
                val result = relayPocClient.sendProbe(suffix)
                activity.runOnUiThread {
                    relayRequestInFlight = false
                    setRelayButtonReady(
                        relayPicklistInput?.text?.length == 4 &&
                            System.currentTimeMillis() >= relayLockedUntilMs
                    )
                    val headline = when (result.lookupStatus) {
                        "CONFIRMED" -> "Đã xác nhận lấy lại đơn. Hãy quay lại app SFT / SFT 3 để tiếp tục"
                        "NOT_FOUND" -> "Không tìm thấy Picklist khớp 4 số cuối. Vui lòng kiểm tra lại."
                        "AMBIGUOUS_PICKLIST", "EXACT_CODE_NOT_RESOLVED" -> "Không xác định được duy nhất Picklist. Vui lòng về bàn chuyên viên xử lý trực tiếp."
                        "PICKER_LOCKED" -> "TRA CỨU ĐÃ BỊ KHÓA"
                        "WMS_SESSION_REQUIRED", "SESSION_EXPIRED" -> "Máy xử lý cần đăng nhập lại SFT / SFT 3. Vui lòng về bàn chuyên viên xử lý trực tiếp."
                        "SCHEMA_UNSUPPORTED" -> "Không đọc được danh sách Picklist an toàn. Vui lòng về bàn chuyên viên xử lý trực tiếp."
                        "FORBIDDEN" -> "Hệ thống Supra từ chối quyền xác nhận. Vui lòng về bàn chuyên viên xử lý trực tiếp."
                        "PROXY_BLOCK" -> "Mạng Office đang chặn kết nối xử lý. Vui lòng về bàn chuyên viên xử lý trực tiếp."
                        "CONFIRM_REJECTED", "CONFIRM_CONFLICT" -> "Picklist không thể xác nhận tự động. Vui lòng kiểm tra trên SFT / SFT 3."
                        "CONFIRM_IN_PROGRESS_OR_UNCERTAIN" -> "Trạng thái xác nhận chưa chắc chắn. Không bấm lại; vui lòng về bàn chuyên viên kiểm tra trên SFT / SFT 3."
                        "REQUEST_EXPIRED" -> "Đã quá thời gian xử lý tự động. Vui lòng về bàn Chuyên viên xử lý trực tiếp."
                        "RATE_LIMITED" -> "Hệ thống đang giới hạn yêu cầu. Vui lòng thử lại sau."
                        else -> "Xác nhận lấy lại đơn chưa thành công. Vui lòng về bàn chuyên viên xử lý trực tiếp."
                    }
                    showRelayResult(headline, result.lookupStatus == "CONFIRMED")
                    if (result.lookupStatus == "CONFIRMED") {
                        relayPicklistInput?.setText("")
                        relayPicklistInput?.requestFocus()
                        setRelayButtonReady(false)
                    }
                    if (result.lookupStatus == "PICKER_LOCKED") {
                        applyRelayLock(result.lockedUntilMs, result.lockLevel)
                    } else if (result.lookupStatus == "NOT_FOUND" && result.rateStrikes > 0) {
                        relayStatus?.append("\nSai " + result.rateStrikes + "/3 lần trong cửa sổ 60 giây.")
                    }
                    recordLog(
                        "Relay PDA confirm=" + result.lookupStatus +
                            " matches=" + result.lookupMatches +
                            " lookup_ms=" + result.lookupMs +
                            " rtt=" + result.roundTripMs +
                            "ms admin=" + result.agentAdminUserId +
                            " agent=" + result.agentId +
                            " instance=" + result.agentInstanceId.take(12) +
                            " network=" + result.agentNetwork +
                            " cache=" + result.cacheMode +
                            " strikes=" + result.rateStrikes +
                            " lock_level=" + result.lockLevel
                    )
                }
            } catch (error: Exception) {
                activity.runOnUiThread {
                    relayRequestInFlight = false
                    setRelayButtonReady(
                        relayPicklistInput?.text?.length == 4 &&
                            System.currentTimeMillis() >= relayLockedUntilMs
                    )
                    val message = error.message?.takeIf { it.isNotBlank() } ?: friendlyError(error)
                    showRelayResult(message, false)
                    if (message.contains("Không có Agent xử lý online", ignoreCase = true)) {
                        showRelayWarning(
                            "Không có Agent xử lý online",
                            "Vui lòng về bàn chuyên viên xử lý trực tiếp."
                        )
                    }
                    recordLog("Relay PDA lỗi: " + message)
                }
            }
        }.start()
    }

    private fun applyRelayLock(lockedUntilMs: Long, lockLevel: Int) {
        relayLockedUntilMs = maxOf(lockedUntilMs, System.currentTimeMillis() + 1000L)
        relayPicklistInput?.isEnabled = false
        setRelayButtonReady(false)
        val remainingMinutes = maxOf(1L, (relayLockedUntilMs - System.currentTimeMillis() + 59_999L) / 60_000L)
        showRelayResult("Đã bị khóa " + remainingMinutes + " phút do nhập sai nhiều lần.\nVui lòng về bàn chuyên viên xử lý trực tiếp.", false)
        showRelayWarning(
            "Tra cứu Picklist bị khóa",
            "Bạn đã nhập sai nhiều lần. Tạm khóa khoảng " + remainingMinutes + " phút (cấp " + lockLevel + "). Vui lòng về bàn chuyên viên xử lý."
        )
        val delay = (relayLockedUntilMs - System.currentTimeMillis()).coerceAtLeast(1000L)
        handler.postDelayed({
            if (System.currentTimeMillis() >= relayLockedUntilMs) {
                relayLockedUntilMs = 0L
                relayPicklistInput?.isEnabled = true
                setRelayButtonReady(relayPicklistInput?.text?.length == 4 && !relayRequestInFlight)
                showRelayHint("Đã hết thời gian khóa. Có thể kiểm tra Picklist.")
            }
        }, delay)
    }

    private fun setRelayButtonReady(ready: Boolean) {
        relayButton?.apply {
            isEnabled = ready
            alpha = if (ready) 1.0f else 0.42f
        }
    }

    private fun showRelayHint(message: String) {
        relayStatus?.apply {
            text = message
            textSize = scaledSp(12.5f)
            setTypeface(typeface, Typeface.NORMAL)
            setTextColor(kit.muted)
        }
    }

    private fun showRelayProgress(message: String) {
        relayStatus?.apply {
            text = message
            textSize = scaledSp(13f)
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.muted)
        }
    }

    private fun showRelayResult(message: String, success: Boolean) {
        relayStatus?.apply {
            text = message
            textSize = scaledSp(17f)
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (success) kit.greenDark else kit.redStrong)
        }
    }

    private fun showRelayWarning(title: String, message: String) {
        if (activity.isFinishing) return
        AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Đã hiểu", null)
            .show()
    }

    private fun isOnline(): Boolean {
        val manager = activity.getSystemService(ConnectivityManager::class.java) ?: return false
        val network = manager.activeNetwork ?: return false
        val caps = manager.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun updateReportEnabled() {
        val ready = selected != null && isOnline() && !syncing
        reportButton?.apply {
            isEnabled = ready
            alpha = if (ready) 1.0f else 0.42f
        }
    }

    private fun syncCatalog(auto: Boolean) {
        if (syncing) return
        syncing = true
        updateReportEnabled()
        catalogLabel?.visibility = View.VISIBLE
        if (!auto) setStatus("Đang đồng bộ Master SKU...")
        Thread {
            try {
                if (cache.count == 0) cache.loadLocal()
                val result = cache.sync(api) { loaded, total ->
                    activity.runOnUiThread { catalogLabel?.apply { visibility = View.VISIBLE; text = "Đang tải danh mục: $loaded/$total SKU" } }
                }
                activity.runOnUiThread {
                    syncing = false
                    catalogLabel?.visibility = View.GONE
                    if (!auto || result.updated) setStatus("Master SKU sẵn sàng.")
                    updateReportEnabled()
                    input?.text?.toString()?.trim()?.takeIf { it.length >= 3 }?.let(::scheduleSearch)
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    syncing = false
                    catalogLabel?.apply { visibility = View.VISIBLE; text = "Danh mục local: ${cache.count} SKU" }
                    setStatus("${friendlyError(e)} Không thể báo hàng cho tới khi dịch vụ online.")
                    updateReportEnabled()
                }
            }
        }.start()
    }

    private fun scheduleSearch(raw: String) {
        searchTask?.let { handler.removeCallbacks(it) }
        val query = raw.trim()
        if (selected != null || query.length < 3) {
            suggestionRows = emptyList()
            autoInput?.dismissDropDown()
            suggestions?.removeAllViews()
            return
        }
        val generation = ++searchGeneration
        val task = Runnable {
            Thread {
                val rows = cache.search(query, 12)
                activity.runOnUiThread { if (generation == searchGeneration) renderSuggestions(rows) }
            }.start()
        }
        searchTask = task
        handler.postDelayed(task, 150)
    }

    private fun renderSuggestions(rows: List<SkuItem>) {
        val field = autoInput ?: return
        if (selected != null || (field.text?.toString()?.trim()?.length ?: 0) < 3) {
            suggestionRows = emptyList()
            field.dismissDropDown()
            return
        }
        suggestionRows = rows
        val labels = rows.map { "${it.sku} - ${it.productName}" }
        field.setAdapter(ArrayAdapter(activity, android.R.layout.simple_dropdown_item_1line, labels))
        if (labels.isNotEmpty() && field.hasFocus()) field.showDropDown() else field.dismissDropDown()
    }

    private fun clearSelection() {
        selected = null
        selectedSkuLabel?.text = "Chưa chọn SKU"
        selectedNameLabel?.text = "Chọn đúng SKU cần báo"
        selectedBox?.apply {
            visibility = View.VISIBLE
            background = kit.rounded(Color.WHITE, kit.line, 9)
        }
        updateReportEnabled()
    }

    private fun selectSku(item: SkuItem, updateInput: Boolean) {
        selected = item
        searchTask?.let { handler.removeCallbacks(it) }
        searchGeneration += 1
        if (updateInput && input?.text?.toString()?.trim() != item.sku) {
            input?.setText(item.sku)
            input?.setSelection(item.sku.length)
        }
        selectedSkuLabel?.text = item.sku
        selectedNameLabel?.text = item.productName
        selectedBox?.apply {
            visibility = View.VISIBLE
            background = kit.rounded(kit.blueSoft, kit.blue, 9)
        }
        suggestionRows = emptyList()
        autoInput?.dismissDropDown()
        updateReportEnabled()
    }

    private fun submit() {
        val item = selected ?: return
        if (!isOnline()) {
            updateReportEnabled()
            setStatus("Cần kết nối dịch vụ để báo hàng. Hệ thống không có chế độ offline.")
            return
        }
        reportButton?.isEnabled = false
        setStatus("Đang gửi báo ${item.sku}...")
        Thread {
            try {
                api.createPickerReport(item.sku)
                activity.runOnUiThread {
                    clearSelection()
                    input?.setText("")
                    setStatus("Đã ghi nhận ${item.sku}.")
                    refresh()
                }
            } catch (e: Exception) {
                activity.runOnUiThread { updateReportEnabled(); setStatus(friendlyError(e)) }
            }
        }.start()
    }

    fun refresh(onComplete: ((Boolean) -> Unit)? = null) {
        onComplete?.let { refreshWaiters += it }
        if (refreshing) {
            refreshDirty = true
            return
        }
        refreshing = true
        Thread {
            try {
                val reports = api.getPickerReports(200)
                val results = api.getPickerResults(50)
                activity.runOnUiThread {
                    pendingResults = results
                    renderHistory(reports)
                    stageAndShowNextResult()
                    updateReportEnabled()
                    refreshing = false
                    if (refreshDirty) {
                        refreshDirty = false
                        refresh()
                    } else {
                        finishRefreshWaiters(true)
                    }
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    refreshing = false
                    refreshDirty = false
                    updateReportEnabled()
                    setStatus(friendlyError(e))
                    finishRefreshWaiters(false)
                }
            }
        }.start()
    }

    private fun finishRefreshWaiters(success: Boolean) {
        if (refreshWaiters.isEmpty()) return
        val waiters = refreshWaiters.toList()
        refreshWaiters.clear()
        for (waiter in waiters) {
            try { waiter(success) } catch (_: Exception) { }
        }
    }

    private fun stageAndShowNextResult() {
        val result = pendingResults.firstOrNull { it.acknowledgedAt == null } ?: return
        if (result.receivedAt == null && receivedResults.add(result.resultEventId)) {
            Thread {
                try {
                    api.markResultStage(result.resultEventId, "RECEIVED")
                } catch (_: Exception) {
                    receivedResults -= result.resultEventId
                }
            }.start()
        }
        showResultDialog(result)
    }

    private fun showResultDialog(result: PickerResult) {
        if (resultDialogShowing || activity.isFinishing) return
        resultDialogShowing = true
        val isSkip = result.resolution == "SKIP_ALLOWED"
        val surface = LayoutInflater.from(activity).inflate(R.layout.overlay_alert, null, false)
        surface.setBackgroundResource(if (isSkip) R.drawable.bg_overlay_skip else R.drawable.bg_overlay_available)
        surface.findViewById<TextView>(R.id.tvOverlayStatus).text = if (isSkip) "ĐƯỢC PHÉP BỎ QUA" else "ĐÃ CÓ HÀNG"
        surface.findViewById<TextView>(R.id.tvOverlaySku).text = result.sku
        surface.findViewById<TextView>(R.id.tvOverlayProduct).text = result.productName
        surface.findViewById<TextView>(R.id.tvOverlayMessage).text =
            if (isSkip) "Người xử lý đã xác nhận SKU này được phép bỏ qua." else "Người xử lý đã xác nhận SKU này đã có hàng."
        surface.findViewById<TextView>(R.id.tvOverlayDismissHint).text = "Cảnh báo nghiệp vụ • cần xác nhận để tiếp tục"
        val acknowledge = surface.findViewById<Button>(R.id.btnOverlayAck).apply {
            text = "XÁC NHẬN ĐÃ NHẬN"
            visibility = View.VISIBLE
        }

        val dialog = Dialog(activity, android.R.style.Theme_Material_Light_NoActionBar_Fullscreen).apply {
            setContentView(surface)
            setCancelable(false)
        }
        dialog.setOnShowListener {
            dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            if (result.displayedAt == null && displayedResults.add(result.resultEventId)) {
                Thread {
                    try {
                        api.markResultStage(result.resultEventId, "DISPLAYED")
                    } catch (_: Exception) {
                        displayedResults -= result.resultEventId
                    }
                }.start()
            }
        }
        acknowledge.setOnClickListener {
            acknowledge.isEnabled = false
            Thread {
                try {
                    api.acknowledgeResult(result.resultEventId)
                    activity.runOnUiThread {
                        dialog.dismiss()
                        resultDialogShowing = false
                        setStatus("Đã xác nhận nhận kết quả ${result.sku}.")
                        refresh()
                    }
                } catch (e: Exception) {
                    activity.runOnUiThread {
                        acknowledge.isEnabled = true
                        setStatus(friendlyError(e))
                    }
                }
            }.start()
        }
        dialog.setOnDismissListener { resultDialogShowing = false }
        dialog.show()
    }

    private fun renderHistory(allRows: List<PickerReport>) {
        val list = historyList ?: return
        val today = LocalDate.now(zone)
        val rows = allRows.filter { reportDate(it.reportedAt) == today || isUnresolved(it) }
        withdrawButtons.clear()
        list.adapter = if (rows.isEmpty()) {
            ArrayAdapter(activity, android.R.layout.simple_list_item_1, emptyList<String>())
        } else {
            object : BaseAdapter() {
                override fun getCount(): Int = rows.size
                override fun getItem(position: Int): PickerReport = rows[position]
                override fun getItemId(position: Int): Long = position.toLong()
                override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View =
                    buildHistoryCard(rows[position])
            }
        }
        list.setOnItemClickListener { _, _, position, _ ->
            val row = rows.getOrNull(position) ?: return@setOnItemClickListener
            if (row.status == "OPEN" && row.autoSkipAllowedAt == null && millis(row.withdrawDeadlineAt) > System.currentTimeMillis()) confirmWithdraw(row)
        }
    }

    private fun historySignature(row: PickerReport): String = listOf(
        row.ticketId,
        row.status,
        row.batchStatus,
        row.resolution.orEmpty(),
        row.withdrawDeadlineAt,
        row.withdrawnAt.orEmpty(),
        row.resolvedAt.orEmpty(),
        row.autoSkipDeadlineAt.orEmpty(),
        row.autoSkipAllowedAt.orEmpty(),
        row.resolutionSource.orEmpty(),
        row.resultEventId.orEmpty(),
        row.acknowledgedAt.orEmpty(),
    ).joinToString("|")

    private fun buildHistoryCard(row: PickerReport): View {
        val state = businessStatus(row)
        val colors = when (state) {
            "Đã có hàng" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
            "Được phép bỏ qua" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
            "Picker thu hồi" -> Triple(kit.graySoft, kit.line, kit.muted)
            else -> Triple(kit.pendingFill, kit.pendingStroke, kit.orange)
        }
        val resultTimeLine = when {
            state == "Picker thu hồi" && !row.withdrawnAt.isNullOrBlank() -> "Picker thu hồi lúc: ${timeOnly(row.withdrawnAt)}"
            (state == "Đã có hàng" || state == "Được phép bỏ qua") && !row.resolvedAt.isNullOrBlank() && row.resolutionSource == "SYSTEM_TIMEOUT" ->
                "Hệ thống tự động lúc: ${timeOnly(row.resolvedAt)}"
            (state == "Đã có hàng" || state == "Được phép bỏ qua") && !row.resolvedAt.isNullOrBlank() ->
                "Invent phản hồi lúc: ${timeOnly(row.resolvedAt)}"
            else -> null
        }
        return kit.card(colors.first, colors.second, 9).apply {
            setPadding(kit.dp(10), kit.dp(7), kit.dp(10), kit.dp(7))
            addView(TextView(activity).apply {
                text = "${row.sku} - ${row.productName}"
                textSize = scaledSp(14.5f)
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
            })
            addView(TextView(activity).apply {
                text = "$state · Báo hết lúc: ${timeOnly(row.reportedAt)}"
                textSize = scaledSp(10.5f)
                setTextColor(colors.third)
                setPadding(0, kit.dp(3), 0, 0)
            })
            if (resultTimeLine != null) {
                addView(TextView(activity).apply {
                    text = resultTimeLine + if (row.resultEventId != null && row.acknowledgedAt == null) " · Chưa xác nhận kết quả" else ""
                    textSize = scaledSp(10f)
                    setTextColor(colors.third)
                    setPadding(0, kit.dp(2), 0, 0)
                })
            }
            if (state == "Đang xử lý" && row.status == "OPEN" && row.autoSkipAllowedAt == null) {
                val deadline = millis(row.withdrawDeadlineAt)
                if (deadline > System.currentTimeMillis()) {
                    val withdraw = Button(activity).apply {
                        text = "Thu hồi"
                        textSize = scaledSp(10.5f)
                        kit.styleSecondary(this)
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, kit.dp((38f * displayScale).roundToInt().coerceIn(36, 50))).apply {
                            topMargin = kit.dp(5)
                        }
                        setOnClickListener { confirmWithdraw(row) }
                    }
                    withdrawButtons[withdraw] = deadline
                    addView(withdraw)
                }
            }
        }
    }

    private fun confirmWithdraw(row: PickerReport) {
        AlertDialog.Builder(activity)
            .setTitle("Thu hồi báo nhầm?")
            .setMessage("${row.sku} - ${row.productName}\nChỉ thực hiện trong 60 giây khi Người xử lý chưa xử lý.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Thu hồi") { _, _ ->
                Thread {
                    try { api.withdrawPickerReport(row.ticketId); activity.runOnUiThread { setStatus("Đã thu hồi ${row.sku}."); refresh() } }
                    catch (e: Exception) { activity.runOnUiThread { setStatus(friendlyError(e)) } }
                }.start()
            }.show()
    }

    private fun isUnresolved(row: PickerReport): Boolean =
        row.status == "OPEN" && row.autoSkipAllowedAt == null && row.batchStatus == "PENDING"

    private fun businessStatus(row: PickerReport): String = when {
        row.status == "WITHDRAWN" || row.batchStatus == "CLOSED" -> "Picker thu hồi"
        row.resolution == "HAS_STOCK" || row.batchStatus == "HAS_STOCK" -> "Đã có hàng"
        row.resolution == "SKIP_ALLOWED" || row.batchStatus == "SKIP_ALLOWED" -> "Được phép bỏ qua"
        else -> "Đang xử lý"
    }

    private fun timeOnly(value: String): String = try {
        timeFmt.format(Instant.parse(value))
    } catch (_: Exception) { value }

    private fun reportDate(value: String): LocalDate? = try { Instant.parse(value).atZone(zone).toLocalDate() } catch (_: Exception) { null }
    private fun millis(value: String?): Long = try { if (value.isNullOrBlank()) 0L else Instant.parse(value).toEpochMilli() } catch (_: Exception) { 0L }

    private fun empty(value: String): TextView = TextView(activity).apply {
        text = value
        textSize = 12.5f
        setTextColor(kit.muted)
        setPadding(kit.dp(12), kit.dp(16), kit.dp(12), kit.dp(16))
        background = kit.rounded(Color.WHITE, kit.line, 10)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.dp(6) }
    }
}
