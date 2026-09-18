package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.AlertDialog
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
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
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
    private var suggestions: LinearLayout? = null
    private var selectedBox: LinearLayout? = null
    private var selectedSkuLabel: TextView? = null
    private var selectedNameLabel: TextView? = null
    private var reportButton: Button? = null
    private var catalogLabel: TextView? = null
    private var historyBox: LinearLayout? = null
    private var historyRenderer: KeyedLinearRenderer? = null
    private var selected: SkuItem? = null
    private var pendingResults: List<PickerResult> = emptyList()
    private val withdrawButtons = linkedMapOf<Button, Long>()

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
        root.addView(TextView(activity).apply {
            text = "Quét hoặc nhập SKU"
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.text)
            setPadding(kit.dp(2), kit.dp(12), kit.dp(2), 0)
        })
        input = EditText(activity).apply {
            hint = "Nhập mã SKU…"
            isSingleLine = true
            textSize = 20f
            imeOptions = EditorInfo.IME_ACTION_SEARCH
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, kit.dp(58)).apply { topMargin = kit.dp(8) }
            kit.styleInput(this)
        }
        root.addView(input)

        suggestions = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        root.addView(suggestions)

        selectedBox = kit.card(Color.WHITE, kit.line, 7).apply { visibility = View.GONE }
        selectedSkuLabel = TextView(activity).apply {
            textSize = 22f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.navy)
        }
        selectedNameLabel = TextView(activity).apply {
            textSize = 15f
            setTextColor(kit.muted)
            setPadding(0, kit.dp(5), 0, 0)
        }
        selectedBox?.addView(selectedSkuLabel)
        selectedBox?.addView(selectedNameLabel)
        root.addView(selectedBox)

        reportButton = Button(activity).apply {
            text = "BÁO HẾT HÀNG"
            contentDescription = "Báo SKU hết hàng"
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            isEnabled = false
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, kit.dp(66)).apply {
                topMargin = kit.dp(8)
                bottomMargin = kit.dp(8)
            }
            kit.styleDanger(this)
            setOnClickListener { submit() }
        }
        root.addView(reportButton)

        catalogLabel = TextView(activity).apply {
            text = "Đang chuẩn bị danh mục SKU..."
            textSize = 10.5f
            setTextColor(kit.muted)
            setPadding(kit.dp(3), kit.dp(2), kit.dp(3), kit.dp(2))
        }
        root.addView(catalogLabel)
        root.addView(TextView(activity).apply {
            text = "BÁO HÔM NAY"
            textSize = 17f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.text)
            setPadding(kit.dp(2), kit.dp(14), kit.dp(2), kit.dp(4))
        })
        historyBox = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        historyRenderer = historyBox?.let(::KeyedLinearRenderer)
        root.addView(historyBox)

        input?.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val value = s?.toString().orEmpty().trim()
                if (selected?.sku != value) clearSelection()
                if (value.length >= 3) cache.exactSku(value)?.let { if (selected == null) selectSku(it, false) }
                scheduleSearch(value)
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
        input?.setOnEditorActionListener { _, _, _ ->
            val exact = cache.exactSku(input?.text?.toString().orEmpty())
            if (exact != null) { selectSku(exact, true); true } else false
        }
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
        val box = suggestions ?: return
        box.removeAllViews()
        for (item in rows) {
            box.addView(Button(activity).apply {
                text = "${item.sku} - ${item.productName}"
                textSize = 12.5f
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                kit.styleSecondary(this)
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.dp(4) }
                setOnClickListener { selectSku(item, true) }
            })
        }
    }

    private fun clearSelection() {
        selected = null
        selectedBox?.visibility = View.GONE
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
        suggestions?.removeAllViews()
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
        AlertDialog.Builder(activity)
            .setTitle(if (isSkip) "ĐƯỢC PHÉP SKIP" else "ĐÃ CÓ HÀNG")
            .setMessage("${result.sku} - ${result.productName}\n\n${if (isSkip) "Reporter đã xác nhận SKU này được phép skip." else "Reporter đã xác nhận SKU này đã có hàng."}")
            .setCancelable(false)
            .setPositiveButton("XÁC NHẬN ĐÃ NHẬN", null)
            .create()
            .also { dialog ->
                dialog.setOnShowListener {
                    if (result.displayedAt == null && displayedResults.add(result.resultEventId)) {
                        Thread {
                            try {
                                api.markResultStage(result.resultEventId, "DISPLAYED")
                            } catch (_: Exception) {
                                displayedResults -= result.resultEventId
                            }
                        }.start()
                    }
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = false
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
                                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = true
                                    setStatus(friendlyError(e))
                                }
                            }
                        }.start()
                    }
                }
                dialog.setOnDismissListener { resultDialogShowing = false }
                dialog.show()
            }
    }

    private fun renderHistory(allRows: List<PickerReport>) {
        val renderer = historyRenderer ?: return
        val today = LocalDate.now(zone)
        val rows = allRows.filter { reportDate(it.reportedAt) == today }
        if (rows.isEmpty()) {
            renderer.render(listOf("empty"), { it }, { it }) { empty("Hôm nay chưa có báo hàng.") }
            withdrawButtons.keys.removeAll { !it.isAttachedToWindow }
            return
        }

        renderer.render(
            items = rows,
            keyOf = { it.ticketId },
            signatureOf = { historySignature(it) },
            createView = { buildHistoryCard(it) },
        )
        withdrawButtons.keys.removeAll { !it.isAttachedToWindow }
    }

    private fun historySignature(row: PickerReport): String = listOf(
        row.ticketId,
        row.status,
        row.batchStatus,
        row.resolution.orEmpty(),
        row.withdrawDeadlineAt,
        row.withdrawnAt.orEmpty(),
        row.resolvedAt.orEmpty(),
        row.resultEventId.orEmpty(),
        row.acknowledgedAt.orEmpty(),
    ).joinToString("|")

    private fun buildHistoryCard(row: PickerReport): View {
        val state = businessStatus(row)
        val colors = when (state) {
            "Đã có hàng" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
            "Cho skip hàng" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
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
                text = "$state · ${timestamp(row.reportedAt)}${if (row.resultEventId != null && row.acknowledgedAt == null) " · Chưa xác nhận kết quả" else ""}"
                textSize = 12f
                setTextColor(colors.third)
                setPadding(0, kit.dp(5), 0, 0)
            })
            if (state == "Đang xử lý" && row.status == "OPEN") {
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
            .setMessage("${row.sku} - ${row.productName}\nChỉ thực hiện trong 60 giây khi Reporter chưa xử lý.")
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
        row.resolution == "SKIP_ALLOWED" || row.batchStatus == "SKIP_ALLOWED" -> "Cho skip hàng"
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
