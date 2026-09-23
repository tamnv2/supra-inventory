package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.ScrollView
import android.widget.TextView
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

class ReporterController(
    private val activity: Activity,
    private val api: InventoryApi,
    private val kit: InventoryUi,
    private val setStatus: (String) -> Unit,
    private val friendlyError: (Exception) -> String,
    initialFilter: String = "PENDING",
    private val displayScale: Float = 1f,
) {
    private enum class Filter { PENDING, HAS_STOCK, SKIP_ALLOWED, WITHDRAWN }

    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private val timeFmt = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(zone)
    private val dateFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone)
    private val handler = Handler(Looper.getMainLooper())
    private var queueServerOffsetMs = 0L
    private var refreshing = false
    private var refreshDirty = false
    private val refreshWaiters = mutableListOf<(Boolean) -> Unit>()
    private val processingBatchIds = mutableSetOf<String>()
    private val confirmingBatchIds = mutableSetOf<String>()

    private var filter = when (initialFilter.uppercase()) {
        "HAS_STOCK" -> Filter.HAS_STOCK
        "SKIP_ALLOWED" -> Filter.SKIP_ALLOWED
        "WITHDRAWN", "CLOSED" -> Filter.WITHDRAWN
        else -> Filter.PENDING
    }

    private var list: ListView? = null
    private val tabBoxes = linkedMapOf<Filter, FrameLayout>()
    private val tabLabels = linkedMapOf<Filter, TextView>()
    private val badges = linkedMapOf<Filter, TextView>()
    private var queue: List<ReporterBatch> = emptyList()
    private var queueTotal = 0
    private var recent: List<ReporterRecent> = emptyList()
    private var recentCounts = ReporterRecentCounts()

    private val minuteTicker = object : Runnable {
        override fun run() {
            if (filter == Filter.PENDING && queue.isNotEmpty()) {
                (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
            }
            scheduleMinuteTicker()
        }
    }

    fun render(root: LinearLayout) {
        applyDisplayScale(root)
        list = root.findViewById(R.id.listIssues)
        bindTab(root, Filter.PENDING, R.id.tabReporterPendingBox, R.id.tabReporterPending, R.id.badgeReporterPending)
        bindTab(root, Filter.HAS_STOCK, R.id.tabReporterHasStockBox, R.id.tabReporterHasStock, R.id.badgeReporterHasStock)
        bindTab(root, Filter.SKIP_ALLOWED, R.id.tabReporterSkipBox, R.id.tabReporterSkip, R.id.badgeReporterSkip)
        bindTab(root, Filter.WITHDRAWN, R.id.tabReporterWithdrawnBox, R.id.tabReporterWithdrawn, R.id.badgeReporterWithdrawn)
        updateTabs()
        scheduleMinuteTicker()
        refresh()
    }

    fun destroy() {
        handler.removeCallbacks(minuteTicker)
        refreshWaiters.clear()
        list = null
    }

    fun onRealtime(scopes: Set<String>, completion: (Boolean) -> Unit) {
        if (scopes.contains("reporter_queue") || scopes.contains("reporter_recent")) refresh(completion)
        else completion(true)
    }

    private fun scaledSp(base: Float): Float = (base * displayScale).coerceIn(9f, 27f)

    private fun applyDisplayScale(root: View) {
        val density = activity.resources.displayMetrics.scaledDensity
        fun visit(view: View) {
            if (view is TextView) {
                val baseSp = view.textSize / density
                view.textSize = (baseSp * displayScale).coerceIn(9f, 27f)
            }
            if (view is ViewGroup) {
                for (index in 0 until view.childCount) visit(view.getChildAt(index))
            }
        }
        visit(root)
        root.findViewById<View>(R.id.reporterTabs)?.layoutParams?.let { params ->
            params.height = kit.dp((52f * displayScale).roundToInt().coerceIn(46, 68))
            root.findViewById<View>(R.id.reporterTabs)?.layoutParams = params
        }
        root.findViewById<View>(R.id.reporterActions)?.layoutParams?.let { params ->
            params.height = kit.dp((44f * displayScale).roundToInt().coerceIn(40, 58))
            root.findViewById<View>(R.id.reporterActions)?.layoutParams = params
        }
        listOf(R.id.btnReporterHasStock, R.id.btnReporterSkip).forEach { id ->
            root.findViewById<View>(id)?.layoutParams?.let { params ->
                params.height = kit.dp((44f * displayScale).roundToInt().coerceIn(40, 58))
                root.findViewById<View>(id)?.layoutParams = params
            }
        }
    }

    private fun bindTab(root: View, value: Filter, boxId: Int, labelId: Int, badgeId: Int) {
        val box = root.findViewById<FrameLayout>(boxId)
        val label = root.findViewById<TextView>(labelId)
        val badge = root.findViewById<TextView>(badgeId)
        tabBoxes[value] = box
        tabLabels[value] = label
        badges[value] = badge
        box.setOnClickListener { selectFilter(value) }
        label.setOnClickListener { selectFilter(value) }
        badge.setOnClickListener { selectFilter(value) }
    }

    private fun selectFilter(value: Filter) {
        if (filter == value) return
        filter = value
        updateTabs()
        renderSelected()
    }

    private fun scheduleMinuteTicker() {
        handler.removeCallbacks(minuteTicker)
        val calibratedNow = System.currentTimeMillis() + queueServerOffsetMs
        val delay = (60_000L - (calibratedNow % 60_000L) + 80L).coerceIn(1_000L, 60_080L)
        handler.postDelayed(minuteTicker, delay)
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
                val nextQueue = api.getReporterQueueSnapshot(200)
                val nextRecent = api.getReporterRecentSnapshot(200)
                activity.runOnUiThread {
                    val serverNow = nextQueue.items.firstOrNull()?.serverNow?.let(::millis) ?: 0L
                    queueServerOffsetMs = if (serverNow > 0L) serverNow - System.currentTimeMillis() else 0L
                    queue = nextQueue.items
                    queueTotal = nextQueue.total
                    recent = nextRecent.items
                    recentCounts = nextRecent.counts
                    updateBadges()
                    renderSelected()
                    scheduleMinuteTicker()
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

    private fun updateTabs() {
        for ((value, box) in tabBoxes) {
            val selected = value == filter
            box.setBackgroundResource(if (selected) R.drawable.bg_picker_tab_selected else R.drawable.bg_picker_tab_idle)
            tabLabels[value]?.setTextColor(if (selected) kit.navy else kit.muted)
        }
    }

    private fun updateBadges() {
        setBadge(Filter.PENDING, queueTotal)
        setBadge(Filter.HAS_STOCK, recentCounts.hasStock)
        setBadge(Filter.SKIP_ALLOWED, recentCounts.skipAllowed)
        setBadge(Filter.WITHDRAWN, recentCounts.withdrawn)
    }

    private fun setBadge(value: Filter, count: Int) {
        badges[value]?.text = if (count > 99) "99+" else count.coerceAtLeast(0).toString()
    }

    private fun recentRows(): List<ReporterRecent> = when (filter) {
        Filter.HAS_STOCK -> recent.filter { it.status == "HAS_STOCK" }
        Filter.SKIP_ALLOWED -> recent.filter { it.status == "SKIP_ALLOWED" }
        Filter.WITHDRAWN -> recent.filter { it.status == "CLOSED" }
        else -> emptyList()
    }

    private fun renderSelected() {
        val target = list ?: return
        target.setOnItemClickListener(null)
        if (filter == Filter.PENDING) {
            target.adapter = pendingAdapter(queue)
            if (queue.isNotEmpty()) {
                target.setOnItemClickListener { _, _, position, _ -> queue.getOrNull(position)?.let(::showTickets) }
            }
        } else {
            val rows = recentRows()
            target.adapter = recentAdapter(rows)
            if (filter == Filter.SKIP_ALLOWED && rows.isNotEmpty()) {
                target.setOnItemClickListener { _, _, position, _ ->
                    rows.getOrNull(position)?.let { row ->
                        if (millis(row.correctionDeadlineAt) > System.currentTimeMillis()) confirmCorrection(row)
                    }
                }
            }
        }
        updateTabs()
    }

    private fun pendingAdapter(rows: List<ReporterBatch>): BaseAdapter = object : BaseAdapter() {
        override fun getCount(): Int = rows.size
        override fun getItem(position: Int): ReporterBatch = rows[position]
        override fun getItemId(position: Int): Long = rows[position].batchId.hashCode().toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val created = convertView == null
            val view = convertView ?: LayoutInflater.from(activity).inflate(R.layout.row_reporter_issue, parent, false)
            if (created) applyDisplayScale(view)
            val row = getItem(position)
            val timing = liveTiming(row)
            bindCommon(view, row.sku, row.productName, "${timing.first} phút")
            val root = view.findViewById<LinearLayout>(R.id.reporterRowRoot)
            val fill = when (timing.second) {
                "ESCALATED" -> kit.redSoft
                "WARNING" -> kit.orangeSoft
                else -> Color.WHITE
            }
            val stroke = when (timing.second) {
                "ESCALATED" -> kit.skipStroke
                "WARNING" -> Color.parseColor("#EBC56E")
                else -> kit.line
            }
            root.background = kit.rounded(fill, stroke, 7)

            val recurrence = if (row.previousBatchId != null) {
                " · Tái phát" + (row.recurrenceMinutes?.let { " sau ${formatMinutes(it)}" } ?: "")
            } else ""
            view.findViewById<TextView>(R.id.tvReporterMeta).apply {
                text = "Báo lúc: ${timestamp(row.firstReportAt)} · ${slaLabel(timing.second)}$recurrence"
                setTextColor(when (timing.second) { "ESCALATED" -> kit.red; "WARNING" -> kit.orange; else -> kit.muted })
            }

            val hasStock = view.findViewById<Button>(R.id.btnReporterHasStock)
            val skip = view.findViewById<Button>(R.id.btnReporterSkip)
            val busy = processingBatchIds.contains(row.batchId) || confirmingBatchIds.contains(row.batchId)
            hasStock.isEnabled = !busy
            skip.isEnabled = !busy
            hasStock.alpha = if (busy) 0.45f else 1f
            skip.alpha = if (busy) 0.45f else 1f
            hasStock.text = if (busy) "Đang xử lý…" else "Đã có hàng"
            skip.text = if (busy) "Đang xử lý…" else "Cho phép skip"
            hasStock.setOnClickListener { confirmResolution(row, "HAS_STOCK", "Đã có hàng") }
            skip.setOnClickListener { confirmResolution(row, "SKIP_ALLOWED", "Cho phép skip") }
            root.contentDescription = "SKU ${row.sku}, ${timing.first} phút, ${slaLabel(timing.second)}"
            return view
        }
    }

    private fun recentAdapter(rows: List<ReporterRecent>): BaseAdapter = object : BaseAdapter() {
        override fun getCount(): Int = rows.size
        override fun getItem(position: Int): ReporterRecent = rows[position]
        override fun getItemId(position: Int): Long = rows[position].batchId.hashCode().toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val created = convertView == null
            val view = convertView ?: LayoutInflater.from(activity).inflate(R.layout.row_reporter_issue, parent, false)
            if (created) applyDisplayScale(view)
            val row = getItem(position)
            bindCommon(view, row.sku, row.productName, "")
            view.findViewById<LinearLayout>(R.id.reporterActions).visibility = View.GONE
            val root = view.findViewById<LinearLayout>(R.id.reporterRowRoot)
            val colors = when (row.status) {
                "HAS_STOCK" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
                "SKIP_ALLOWED" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
                else -> Triple(kit.graySoft, kit.line, kit.muted)
            }
            root.background = kit.rounded(colors.first, colors.second, 7)
            val reportTime = timeOnly(row.firstReportAt)
            val responseTime = row.resolvedAt?.let(::timeOnly)
            view.findViewById<TextView>(R.id.tvReporterMeta).apply {
                text = if (responseTime.isNullOrBlank()) {
                    "Báo lúc: $reportTime"
                } else {
                    "Báo lúc: $reportTime\nInvent phản hồi lúc: $responseTime"
                }
                setTextColor(colors.third)
            }
            return view
        }
    }

    private fun bindCommon(view: View, sku: String, product: String, elapsed: String) {
        view.findViewById<TextView>(R.id.tvReporterSku).text = sku
        view.findViewById<TextView>(R.id.tvReporterElapsed).text = elapsed
        view.findViewById<TextView>(R.id.tvReporterProduct).text = product
        view.findViewById<LinearLayout>(R.id.reporterActions).visibility = View.VISIBLE
    }

    private fun confirmResolution(row: ReporterBatch, resolution: String, label: String) {
        if (processingBatchIds.contains(row.batchId) || !confirmingBatchIds.add(row.batchId)) return
        (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
        val dialog = AlertDialog.Builder(activity)
            .setTitle("Xác nhận $label?")
            .setMessage("${row.sku} - ${row.productName}\nXác nhận xử lý SKU này?")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ -> resolveDirect(row, resolution, label) }
            .create()
        dialog.setOnDismissListener {
            confirmingBatchIds.remove(row.batchId)
            (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
        }
        dialog.show()
    }

    private fun resolveDirect(row: ReporterBatch, resolution: String, label: String) {
        if (!processingBatchIds.add(row.batchId)) return
        (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
        setStatus("Đang cập nhật ${row.sku}…")
        Thread {
            try {
                api.resolveBatch(row.batchId, resolution)
                activity.runOnUiThread {
                    processingBatchIds.remove(row.batchId)
                    setStatus("Đã xử lý ${row.sku}: $label.")
                    refresh()
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    processingBatchIds.remove(row.batchId)
                    setStatus(friendlyError(e))
                    refresh()
                }
            }
        }.start()
    }

    private fun confirmCorrection(row: ReporterRecent) {
        AlertDialog.Builder(activity)
            .setTitle("Sửa thành Đã có hàng?")
            .setMessage("${row.sku} - ${row.productName}\nLịch sử Cho phép skip ban đầu vẫn được giữ.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ ->
                Thread {
                    try {
                        api.correctBatch(row.batchId)
                        activity.runOnUiThread { setStatus("Đã sửa ${row.sku} thành Đã có hàng."); refresh() }
                    } catch (e: Exception) {
                        activity.runOnUiThread { setStatus(friendlyError(e)); refresh() }
                    }
                }.start()
            }.show()
    }

    private fun showTickets(row: ReporterBatch) {
        Thread {
            try {
                val tickets = api.getBatchTickets(row.batchId)
                activity.runOnUiThread {
                    val text = if (tickets.isEmpty()) "Không có Picker trong batch." else tickets.joinToString("\n\n") {
                        val ack = if (it.resultEventId != null) {
                            if (it.acknowledgedAt != null) " · Đã xác nhận kết quả" else " · Chưa xác nhận kết quả"
                        } else ""
                        "${it.pickerEmployeeCode} - ${it.pickerDisplayName.ifBlank { "Chưa có tên" }}\nBáo ${timestamp(it.reportedAt)} · ${ticketStatus(it.status)}$ack"
                    }
                    val scroll = ScrollView(activity).apply {
                        addView(TextView(activity).apply {
                            this.text = text
                            textSize = 13f
                            setPadding(kit.dp(16), kit.dp(8), kit.dp(16), kit.dp(8))
                        })
                    }
                    AlertDialog.Builder(activity)
                        .setTitle("${row.sku} · ${tickets.size} Picker")
                        .setView(scroll)
                        .setPositiveButton("Đóng", null)
                        .show()
                }
            } catch (e: Exception) {
                activity.runOnUiThread { setStatus(friendlyError(e)) }
            }
        }.start()
    }

    private fun liveTiming(row: ReporterBatch): Pair<Int, String> {
        val now = System.currentTimeMillis() + queueServerOffsetMs
        val first = millis(row.firstReportAt)
        val waiting = if (first > 0L) ((now - first).coerceAtLeast(0L) / 60_000L).toInt() else row.waitingMinutes
        val escalation = millis(row.escalationAt)
        val warning = millis(row.warningAt)
        val state = when {
            escalation > 0L && now >= escalation -> "ESCALATED"
            warning > 0L && now >= warning -> "WARNING"
            row.slaState == "UNCONFIGURED" -> "UNCONFIGURED"
            else -> "NORMAL"
        }
        return waiting to state
    }

    private fun slaLabel(state: String): String = when (state) {
        "ESCALATED" -> "Quá thời gian"
        "WARNING" -> "Sắp quá thời gian"
        "NORMAL" -> "Trong thời gian"
        else -> "Chưa thiết lập thời gian"
    }

    private fun formatMinutes(value: Int): String = if (value < 60) "${value}m" else "${value / 60}h ${value % 60}m"

    private fun timeOnly(value: String?): String {
        if (value.isNullOrBlank()) return "—"
        return try { timeFmt.format(Instant.parse(value)) } catch (_: Exception) { value }
    }

    private fun timestamp(value: String?): String {
        if (value.isNullOrBlank()) return "—"
        return try {
            val instant = Instant.parse(value)
            "${timeFmt.format(instant)} ${dateFmt.format(instant)}"
        } catch (_: Exception) {
            value
        }
    }

    private fun millis(value: String?): Long = try {
        if (value.isNullOrBlank()) 0L else Instant.parse(value).toEpochMilli()
    } catch (_: Exception) {
        0L
    }

    private fun ticketStatus(value: String): String = when (value) {
        "OPEN" -> "Đang xử lý"
        "WITHDRAWN" -> "Picker thu hồi"
        "RESOLVED" -> "Đã xử lý"
        else -> value
    }
}
