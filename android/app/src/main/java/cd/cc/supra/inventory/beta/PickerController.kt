package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
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
import java.util.ArrayDeque
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
    private var input: EditText? = null
    private var suggestions: LinearLayout? = null
    private var selectedLabel: TextView? = null
    private var reportButton: Button? = null
    private var catalogLabel: TextView? = null
    private var historyBox: LinearLayout? = null
    private var selected: SkuItem? = null
    private val withdrawButtons = linkedMapOf<Button, Long>()
    private var snapshotReady = false
    private val statusSnapshot = mutableMapOf<String, String>()
    private val resultAlerts = ArrayDeque<String>()
    private var resultAlertShowing = false

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
        val row = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, kit.dp(8), 0, 0)
        }
        input = EditText(activity).apply {
            hint = "Nhập tối thiểu 3 số SKU vào đây"
            isSingleLine = true
            imeOptions = EditorInfo.IME_ACTION_SEARCH
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            layoutParams = LinearLayout.LayoutParams(0, kit.dp(56), 1.5f).apply { marginEnd = kit.dp(8) }
            kit.styleInput(this)
        }
        reportButton = Button(activity).apply {
            text = "BÁO HẾT HÀNG"
            contentDescription = "Báo SKU hết hàng"
            textSize = 13.5f
            setTypeface(typeface, Typeface.BOLD)
            isEnabled = false
            layoutParams = LinearLayout.LayoutParams(0, kit.dp(56), 0.9f)
            kit.styleDanger(this)
            setOnClickListener { submit() }
        }
        row.addView(input)
        row.addView(reportButton)
        root.addView(row)

        selectedLabel = TextView(activity).apply {
            visibility = View.GONE
            textSize = 12.5f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.greenDark)
            setPadding(kit.dp(4), kit.dp(6), kit.dp(4), 0)
        }
        root.addView(selectedLabel)
        suggestions = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        root.addView(suggestions)
        catalogLabel = TextView(activity).apply {
            text = "Đang chuẩn bị danh mục SKU..."
            textSize = 10.5f
            setTextColor(kit.muted)
            setPadding(kit.dp(3), kit.dp(5), kit.dp(3), kit.dp(2))
        }
        root.addView(catalogLabel)
        root.addView(TextView(activity).apply {
            text = "Lịch sử báo hàng hôm nay"
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.muted)
            setPadding(kit.dp(2), kit.dp(13), kit.dp(2), kit.dp(4))
        })
        historyBox = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        root.addView(historyBox)

        input?.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val raw = s?.toString().orEmpty()
                val value = raw.trim()
                if (selected?.sku != value) {
                    selected = null
                    selectedLabel?.visibility = View.GONE
                    reportButton?.isEnabled = false
                }
                if (value.length >= 3) cache.exactSku(value)?.let { if (selected == null) selectSku(it, false) }
                scheduleSearch(raw)
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
        input?.setOnEditorActionListener { _, _, _ ->
            val exact = cache.exactSku(input?.text?.toString().orEmpty())
            if (exact != null) {
                selectSku(exact, true)
                true
            } else false
        }
        syncCatalog(auto = true)
        refresh()
    }

    fun onRealtime(scopes: Set<String>) {
        if (scopes.contains("picker_reports")) refresh()
        if (scopes.contains("sku_catalog")) syncCatalog(auto = true)
    }

    fun destroy() {
        searchTask?.let { handler.removeCallbacks(it) }
        handler.removeCallbacks(withdrawTicker)
    }

    private fun syncCatalog(auto: Boolean) {
        if (syncing) return
        syncing = true
        catalogLabel?.visibility = View.VISIBLE
        if (!auto) setStatus("Đang đồng bộ Master SKU...")
        Thread {
            try {
                if (cache.count == 0) cache.loadLocal()
                val result = cache.sync(api) { loaded, total ->
                    activity.runOnUiThread {
                        catalogLabel?.visibility = View.VISIBLE
                        catalogLabel?.text = "Đang tải danh mục: $loaded/$total SKU"
                    }
                }
                activity.runOnUiThread {
                    syncing = false
                    catalogLabel?.visibility = View.GONE
                    if (!auto || result.updated) setStatus("Master SKU sẵn sàng.")
                    val current = input?.text?.toString().orEmpty()
                    if (current.trim().length >= 3) scheduleSearch(current)
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    syncing = false
                    catalogLabel?.visibility = View.VISIBLE
                    catalogLabel?.text = "Danh mục local: ${cache.count} SKU"
                    setStatus("${friendlyError(e)} Danh mục cũ vẫn được giữ.")
                }
            }
        }.start()
    }

    private fun scheduleSearch(raw: String) {
        searchTask?.let { handler.removeCallbacks(it) }
        val query = raw.trim()
        if (query.length < 3) {
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
        val box = suggestions ?: return
        box.removeAllViews()
        if (rows.isEmpty()) {
            box.addView(kit.muted(if (cache.count == 0) "Chưa có danh mục local." else "Không tìm thấy SKU phù hợp.", 11.5f))
            return
        }
        for (item in rows) {
            box.addView(Button(activity).apply {
                text = "${item.sku} - ${item.productName}"
                textSize = 12.5f
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                kit.styleSecondary(this)
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = kit.dp(4)
                }
                setOnClickListener { selectSku(item, true) }
            })
        }
    }

    private fun selectSku(item: SkuItem, updateInput: Boolean) {
        selected = item
        if (updateInput && input?.text?.toString()?.trim() != item.sku) {
            input?.setText(item.sku)
            input?.setSelection(item.sku.length)
        }
        selectedLabel?.apply {
            text = "${item.sku} - ${item.productName}"
            visibility = View.VISIBLE
        }
        reportButton?.isEnabled = true
        suggestions?.removeAllViews()
    }

    private fun submit() {
        val item = selected ?: return
        reportButton?.isEnabled = false
        setStatus("Đang gửi báo ${item.sku}...")
        Thread {
            try {
                api.createPickerReport(item.sku)
                activity.runOnUiThread {
                    selected = null
                    input?.setText("")
                    selectedLabel?.visibility = View.GONE
                    reportButton?.isEnabled = false
                    setStatus("Đã ghi nhận ${item.sku}.")
                    refresh()
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    reportButton?.isEnabled = selected != null
                    setStatus(friendlyError(e))
                }
            }
        }.start()
    }

    fun refresh() {
        if (refreshing) return
        refreshing = true
        Thread {
            try {
                val rows = api.getPickerReports(100)
                activity.runOnUiThread {
                    refreshing = false
                    renderHistory(rows)
                    detectChanges(rows)
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    refreshing = false
                    setStatus(friendlyError(e))
                }
            }
        }.start()
    }

    private fun renderHistory(allRows: List<PickerReport>) {
        val box = historyBox ?: return
        box.removeAllViews()
        withdrawButtons.clear()
        val today = LocalDate.now(zone)
        val rows = allRows.filter { reportDate(it.reportedAt) == today }
        if (rows.isEmpty()) {
            box.addView(empty("Hôm nay chưa có báo hàng."))
            return
        }
        for (row in rows) {
            val state = businessStatus(row)
            val colors = when (state) {
                "Đã có hàng" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
                "Cho skip hàng" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
                "Picker thu hồi" -> Triple(kit.graySoft, kit.line, kit.muted)
                else -> Triple(kit.pendingFill, kit.pendingStroke, kit.orange)
            }
            val card = kit.card(colors.first, colors.second, 11)
            val top = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            top.addView(TextView(activity).apply {
                text = "${row.sku} - ${row.productName}"
                textSize = 18.5f
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = kit.dp(7) }
            })
            top.addView(TextView(activity).apply {
                text = state
                textSize = 11.5f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(colors.third)
                setPadding(kit.dp(9), kit.dp(5), kit.dp(9), kit.dp(5))
                background = kit.rounded(colors.first, colors.second, 999)
            })
            card.addView(top)
            card.addView(TextView(activity).apply {
                text = "Báo hết hàng lúc: ${timestamp(row.reportedAt)}"
                textSize = 12.5f
                setTextColor(kit.text)
                setPadding(0, kit.dp(5), 0, 0)
            })
            if (state == "Đang xử lý" && row.status == "OPEN") {
                val deadline = millis(row.withdrawDeadlineAt)
                if (deadline > System.currentTimeMillis()) {
                    val withdraw = Button(activity).apply {
                        text = "Thu hồi"
                        textSize = 11.5f
                        kit.styleSecondary(this)
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, kit.dp(42)).apply { topMargin = kit.dp(7) }
                        setOnLongClickListener { confirmWithdraw(row); true }
                    }
                    withdrawButtons[withdraw] = deadline
                    card.addView(withdraw)
                }
            }
            box.addView(card)
        }
    }

    private fun detectChanges(rows: List<PickerReport>) {
        val next = mutableMapOf<String, String>()
        for (row in rows) {
            val state = businessStatus(row)
            next[row.ticketId] = state
            if (snapshotReady) {
                val previous = statusSnapshot[row.ticketId]
                if (previous != state && (state == "Đã có hàng" || state == "Cho skip hàng")) {
                    resultAlerts.add("${row.sku} - ${row.productName}\nKết quả: $state")
                }
            }
        }
        statusSnapshot.clear()
        statusSnapshot.putAll(next)
        snapshotReady = true
        showNextAlert()
    }

    private fun showNextAlert() {
        if (resultAlertShowing || resultAlerts.isEmpty() || activity.isFinishing) return
        resultAlertShowing = true
        AlertDialog.Builder(activity)
            .setTitle("Kết quả báo hàng")
            .setMessage(resultAlerts.removeFirst())
            .setCancelable(false)
            .setPositiveButton("Xác nhận") { _, _ -> resultAlertShowing = false; showNextAlert() }
            .show()
    }

    private fun confirmWithdraw(row: PickerReport) {
        AlertDialog.Builder(activity)
            .setTitle("Thu hồi báo nhầm?")
            .setMessage("${row.sku} - ${row.productName}\nChỉ thực hiện trong 60 giây khi Reporter chưa xử lý.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Thu hồi") { _, _ ->
                setStatus("Đang thu hồi ${row.sku}...")
                Thread {
                    try {
                        api.withdrawPickerReport(row.ticketId)
                        activity.runOnUiThread { setStatus("Đã thu hồi ${row.sku}."); refresh() }
                    } catch (e: Exception) {
                        activity.runOnUiThread { setStatus(friendlyError(e)) }
                    }
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
