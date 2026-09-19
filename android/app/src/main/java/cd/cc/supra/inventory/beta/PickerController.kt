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

class PickerController(
    private val activity: Activity,
    private val api: InventoryApi,
    private val cache: SkuCatalogCache,
    private val kit: InventoryUi,
    private val setStatus: (String) -> Unit,
    private val friendlyError: (Exception) -> String,
    private val recordLog: (String) -> Unit,
) {
    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private val timeFmt = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(zone)
    private val dateFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone)
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
    private val relayPocClient = RelayPocClient(api, recordLog)
    private var relayPicklistInput: EditText? = null
    private var relayButton: Button? = null
    private var relayStatus: TextView? = null
    private var shortagePanel: View? = null
    private var confirmPanel: View? = null
    private var shortageTab: TextView? = null
    private var confirmTab: TextView? = null

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
                    val digits = raw.filter(Char::isDigit).take(5)
                    if (raw != digits) {
                        normalizing = true
                        setText(digits)
                        setSelection(digits.length)
                        normalizing = false
                    }
                    relayButton?.isEnabled = digits.length == 5
                    relayStatus?.text = if (digits.isEmpty()) {
                        "Sẵn sàng nhập 5 số cuối."
                    } else if (digits.length < 5) {
                        "Đã nhập " + digits.length + "/5 số."
                    } else {
                        "Đủ 5 số. Sẵn sàng gửi test."
                    }
                }
            })
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE && text?.length == 5) {
                    submitRelayProbe()
                    true
                } else {
                    false
                }
            }
        }
        showOperationTab(confirm = false)

        autoInput?.threshold = 1
        autoInput?.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val value = s?.toString().orEmpty().trim()
                if (selected?.sku != value) clearSelection()
                if (value.length >= 3) cache.exactSku(value)?.let { if (selected == null) selectSku(it, false) }
                scheduleSearch(value)
            }
            override fun afterTextChanged(s: Editable?) = Unit
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
            setBackgroundResource(if (confirm) R.drawable.bg_button_secondary else R.drawable.bg_button_primary)
            setTextColor(if (confirm) kit.text else Color.WHITE)
        }
        confirmTab?.apply {
            setBackgroundResource(if (confirm) R.drawable.bg_button_primary else R.drawable.bg_button_secondary)
            setTextColor(if (confirm) Color.WHITE else kit.text)
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
        val suffix = relayPicklistInput?.text?.toString()?.trim().orEmpty()
        if (!suffix.matches(Regex("^\\d{5}$"))) {
            relayStatus?.text = "Nhập đúng 5 số cuối Picklist."
            relayButton?.isEnabled = false
            return
        }
        if (!isOnline()) {
            relayStatus?.text = "PDA chưa có kết nối Internet."
            recordLog("Relay PDA chưa có Internet validated")
            return
        }
        relayButton?.isEnabled = false
        relayStatus?.text = "Đang gửi tới máy xử lý..."
        recordLog("Relay bắt đầu gửi test 5 số; không ghi giá trị Picklist vào log")
        Thread {
            try {
                val result = relayPocClient.sendProbe(suffix)
                activity.runOnUiThread {
                    relayButton?.isEnabled = relayPicklistInput?.text?.length == 5
                    val network = result.agentNetwork.takeIf { it.isNotBlank() && it != "UNKNOWN" }?.let { " • " + it }.orEmpty()
                    relayStatus?.text = "Đã nhận: " + result.agentId + " • Admin " + result.agentAdminUserId + network + " • " + result.roundTripMs + " ms"
                    recordLog(
                        "Relay PDA ACK rtt=" + result.roundTripMs +
                            "ms admin=" + result.agentAdminUserId +
                            " agent=" + result.agentId +
                            " instance=" + result.agentInstanceId.take(12) +
                            " network=" + result.agentNetwork
                    )
                }
            } catch (error: Exception) {
                activity.runOnUiThread {
                    relayButton?.isEnabled = relayPicklistInput?.text?.length == 5
                    val message = error.message?.takeIf { it.isNotBlank() } ?: friendlyError(error)
                    relayStatus?.text = message
                    recordLog("Relay PDA lỗi: " + message)
                }
            }
        }.start()
    }

    private fun isOnline(): Boolean {
        val manager = activity.getSystemService(ConnectivityManager::class.java) ?: return false
        val network = manager.activeNetwork ?: return false
        val caps = manager.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun updateReportEnabled() {
        reportButton?.isEnabled = selected != null && isOnline() && !syncing
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
        if (query.length < 3) { suggestions?.removeAllViews(); return }
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
        suggestionRows = rows
        val field = autoInput ?: return
        val labels = rows.map { "${it.sku} - ${it.productName}" }
        field.setAdapter(ArrayAdapter(activity, android.R.layout.simple_dropdown_item_1line, labels))
        if (labels.isNotEmpty() && field.hasFocus()) field.showDropDown()
    }

    private fun clearSelection() {
        selected = null
        selectedSkuLabel?.text = "Chưa chọn SKU"
        selectedNameLabel?.text = "Chọn đúng SKU cần báo"
        selectedBox?.visibility = View.VISIBLE
        updateReportEnabled()
    }

    private fun selectSku(item: SkuItem, updateInput: Boolean) {
        selected = item
        if (updateInput && input?.text?.toString()?.trim() != item.sku) {
            input?.setText(item.sku)
            input?.setSelection(item.sku.length)
        }
        selectedSkuLabel?.text = item.sku
        selectedNameLabel?.text = item.productName
        selectedBox?.visibility = View.VISIBLE
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
                val reports = api.getPickerReports(100)
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
        val rows = allRows.filter { reportDate(it.reportedAt) == today }
        val labels = if (rows.isEmpty()) {
            listOf("Hôm nay chưa có báo hàng.")
        } else {
            rows.map { row ->
                val source = if (row.resolutionSource == "SYSTEM_TIMEOUT") " · Hệ thống tự động do quá hạn" else ""
                val deadline = if (row.autoSkipAllowedAt == null && !row.autoSkipDeadlineAt.isNullOrBlank()) " · Tự động: ${timestamp(row.autoSkipDeadlineAt)}" else ""
                "${row.sku} - ${row.productName}\n${businessStatus(row)} · ${timestamp(row.reportedAt)}$source$deadline"
            }
        }
        list.adapter = ArrayAdapter(activity, android.R.layout.simple_list_item_1, labels)
        list.setOnItemClickListener { _, _, position, _ ->
            val row = rows.getOrNull(position) ?: return@setOnItemClickListener
            if (row.status == "OPEN" && row.autoSkipAllowedAt == null && millis(row.withdrawDeadlineAt) > System.currentTimeMillis()) confirmWithdraw(row)
        }
        withdrawButtons.clear()
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
        return kit.card(colors.first, colors.second, 11).apply {
            addView(TextView(activity).apply {
                text = "${row.sku} - ${row.productName}"
                textSize = 18f
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
            })
            addView(TextView(activity).apply {
                text = "$state · ${timestamp(row.reportedAt)}${if (row.resolutionSource == "SYSTEM_TIMEOUT") " · Hệ thống tự động do quá hạn" else ""}${if (row.resultEventId != null && row.acknowledgedAt == null) " · Chưa xác nhận kết quả" else ""}"
                textSize = 12f
                setTextColor(colors.third)
                setPadding(0, kit.dp(5), 0, 0)
            })
            if (state == "Đang xử lý" && row.status == "OPEN" && row.autoSkipAllowedAt == null) {
                if (!row.autoSkipDeadlineAt.isNullOrBlank()) {
                    addView(TextView(activity).apply {
                        text = "Mốc tự động: ${timestamp(row.autoSkipDeadlineAt)}"
                        textSize = 11.5f
                        setTextColor(kit.muted)
                        setPadding(0, kit.dp(4), 0, 0)
                    })
                }
                val deadline = millis(row.withdrawDeadlineAt)
                if (deadline > System.currentTimeMillis()) {
                    val withdraw = Button(activity).apply {
                        text = "Thu hồi"
                        textSize = 11.5f
                        kit.styleSecondary(this)
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, kit.dp(42)).apply {
                            topMargin = kit.dp(7)
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

    private fun businessStatus(row: PickerReport): String = when {
        row.status == "WITHDRAWN" || row.batchStatus == "CLOSED" -> "Picker thu hồi"
        row.resolution == "HAS_STOCK" || row.batchStatus == "HAS_STOCK" -> "Đã có hàng"
        row.resolution == "SKIP_ALLOWED" || row.batchStatus == "SKIP_ALLOWED" -> "Được phép bỏ qua"
        else -> "Đang xử lý"
    }

    private fun timestamp(value: String): String = try {
        val instant = Instant.parse(value)
        "${timeFmt.format(instant)} - ${dateFmt.format(instant)}"
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
