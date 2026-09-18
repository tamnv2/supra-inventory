package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.ScrollView
import android.widget.TextView
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class ReporterController(
    private val activity: Activity,
    private val api: InventoryApi,
    private val kit: InventoryUi,
    private val setStatus: (String) -> Unit,
    private val friendlyError: (Exception) -> String,
    initialFilter: String = "PENDING",
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
    private var filter = when (initialFilter.uppercase()) {
        "HAS_STOCK" -> Filter.HAS_STOCK
        "SKIP_ALLOWED" -> Filter.SKIP_ALLOWED
        "WITHDRAWN", "CLOSED" -> Filter.WITHDRAWN
        else -> Filter.PENDING
    }
    private val buttons = linkedMapOf<Filter, Button>()
    private var listBox: LinearLayout? = null
    private var listRenderer: KeyedLinearRenderer? = null
    private var legacyList: ListView? = null
    private var legacySummary: TextView? = null
    private var queue: List<ReporterBatch> = emptyList()
    private var recent: List<ReporterRecent> = emptyList()

    private val slaTicker = object : Runnable {
        override fun run() {
            if (filter == Filter.PENDING && queue.isNotEmpty()) renderSelected()
            handler.postDelayed(this, 15_000L)
        }
    }

    fun render(root: LinearLayout) {
        legacySummary = root.findViewById(R.id.tvIssueSummary)
        legacyList = root.findViewById(R.id.listIssues)
        root.findViewById<Button>(R.id.btnRefreshIssues)?.setOnClickListener { refresh() }
        listBox = null
        listRenderer = null
        buttons.clear()
        handler.removeCallbacks(slaTicker)
        handler.postDelayed(slaTicker, 15_000L)
        refresh()
    }

    fun destroy() {
        handler.removeCallbacks(slaTicker)
        listRenderer = null
    }

    fun onRealtime(scopes: Set<String>, completion: (Boolean) -> Unit) {
        if (scopes.contains("reporter_queue") || scopes.contains("reporter_recent")) refresh(completion)
        else completion(true)
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
                val nextQueue = api.getReporterQueue(100)
                val nextRecent = api.getReporterRecent(100)
                activity.runOnUiThread {
                    val serverNow = nextQueue.firstOrNull()?.serverNow?.let(::millis) ?: 0L
                    queueServerOffsetMs = if (serverNow > 0L) serverNow - System.currentTimeMillis() else 0L
                    queue = nextQueue
                    recent = nextRecent
                    renderSelected()
                    setStatus("Đã cập nhật ${nextQueue.size} SKU đang xử lý.")
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

    private fun addTab(row: LinearLayout, value: Filter, label: String) {
        val button = Button(activity).apply {
            text = label
            textSize = 11f
            maxLines = 2
            minHeight = kit.dp(58)
            layoutParams = LinearLayout.LayoutParams(0, kit.dp(60), 1f).apply {
                marginStart = kit.dp(2)
                marginEnd = kit.dp(2)
            }
            setOnClickListener { filter = value; updateTabs(); renderSelected() }
        }
        buttons[value] = button
        row.addView(button)
    }

    private fun updateTabs() {
        for ((value, button) in buttons) {
            if (value == filter) {
                button.setTextColor(Color.WHITE)
                button.setTypeface(button.typeface, Typeface.BOLD)
                button.background = kit.rounded(kit.navyMid, kit.navyMid, 9)
            } else {
                button.setTextColor(kit.navy)
                button.setTypeface(button.typeface, Typeface.NORMAL)
                button.background = kit.rounded(Color.WHITE, kit.line, 9)
            }
        }
    }

    private fun renderSelected() {
        val legacy = legacyList
        if (legacy != null) {
            renderLegacyList(legacy)
            return
        }
        val renderer = listRenderer ?: return
        when (filter) {
            Filter.PENDING -> {
                if (queue.isEmpty()) {
                    renderer.render(listOf("empty:pending"), { it }, { it }) { empty("Không có SKU đang chờ xử lý.") }
                } else {
                    renderer.render(
                        queue,
                        keyOf = { "pending:${it.batchId}" },
                        signatureOf = { pendingSignature(it) },
                        createView = { pendingCard(it) },
                    )
                }
            }
            else -> {
                val state = when (filter) {
                    Filter.HAS_STOCK -> "HAS_STOCK"
                    Filter.SKIP_ALLOWED -> "SKIP_ALLOWED"
                    Filter.WITHDRAWN -> "CLOSED"
                    else -> "PENDING"
                }
                val rows = recent.filter { it.status == state }
                if (rows.isEmpty()) {
                    val message = when (state) {
                        "HAS_STOCK" -> "Chưa có kết quả Đã có hàng."
                        "SKIP_ALLOWED" -> "Chưa có kết quả Đã cho skip."
                        else -> "Chưa có báo Picker thu hồi."
                    }
                    renderer.render(listOf("empty:$state"), { it }, { it }) { empty(message) }
                } else {
                    renderer.render(
                        rows,
                        keyOf = { "recent:${it.batchId}:${it.version}" },
                        signatureOf = { recentSignature(it) },
                        createView = { recentCard(it, state) },
                    )
                }
            }
        }
    }

    private fun renderLegacyList(list: ListView) {
        if (filter == Filter.PENDING) {
            legacySummary?.text = if (queue.isEmpty()) "Không có SKU đang chờ xử lý." else "${queue.size} SKU đang chờ xử lý"
            if (queue.isEmpty()) {
                list.adapter = legacyTextAdapter(listOf("Không có SKU đang chờ xử lý."))
                list.onItemClickListener = null
            } else {
                list.adapter = pendingLegacyAdapter(queue)
                list.setOnItemClickListener { _, _, position, _ ->
                    val row = queue.getOrNull(position) ?: return@setOnItemClickListener
                    AlertDialog.Builder(activity)
                        .setTitle("${row.sku} - ${row.productName}")
                        .setItems(arrayOf("CÓ HÀNG", "CHO SKIP HÀNG", "Xem Picker")) { _, which ->
                            when (which) {
                                0 -> confirmHasStock(row)
                                1 -> confirmSkipImpact(row)
                                2 -> showTickets(row)
                            }
                        }
                        .setNegativeButton("Đóng", null)
                        .show()
                }
            }
            return
        }

        val state = when (filter) {
            Filter.HAS_STOCK -> "HAS_STOCK"
            Filter.SKIP_ALLOWED -> "SKIP_ALLOWED"
            Filter.WITHDRAWN -> "CLOSED"
            else -> "PENDING"
        }
        val rows = recent.filter { it.status == state }
        legacySummary?.text = when (filter) {
            Filter.HAS_STOCK -> "Đã có hàng · ${rows.size}"
            Filter.SKIP_ALLOWED -> "Đã cho skip · ${rows.size}"
            Filter.WITHDRAWN -> "Picker thu hồi · ${rows.size}"
            else -> "Đang xử lý"
        }
        if (rows.isEmpty()) {
            list.adapter = legacyTextAdapter(listOf("Chưa có dữ liệu."))
            list.onItemClickListener = null
        } else {
            list.adapter = recentLegacyAdapter(rows)
            list.setOnItemClickListener { _, _, position, _ ->
                val row = rows.getOrNull(position) ?: return@setOnItemClickListener
                if (row.status == "SKIP_ALLOWED" && millis(row.correctionDeadlineAt) > System.currentTimeMillis()) confirmCorrection(row)
            }
        }
    }

    private fun pendingLegacyAdapter(rows: List<ReporterBatch>): BaseAdapter = object : BaseAdapter() {
        override fun getCount(): Int = rows.size
        override fun getItem(position: Int): ReporterBatch = rows[position]
        override fun getItemId(position: Int): Long = rows[position].batchId.hashCode().toLong()
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: LayoutInflater.from(activity).inflate(R.layout.row_issue, parent, false)
            val row = getItem(position)
            val timing = liveTiming(row)
            view.findViewById<TextView>(R.id.tvIssueSku).text = row.sku
            view.findViewById<TextView>(R.id.tvIssueProduct).text = row.productName
            view.findViewById<TextView>(R.id.tvIssueElapsed).text = "${timing.first}p"
            view.findViewById<TextView>(R.id.tvIssueMeta).text =
                "${row.affectedPickerCount} Picker · ${slaLabel(timing.second)}${if (row.previousBatchId != null) " · Tái phát" else ""}"
            return view
        }
    }

    private fun recentLegacyAdapter(rows: List<ReporterRecent>): BaseAdapter = object : BaseAdapter() {
        override fun getCount(): Int = rows.size
        override fun getItem(position: Int): ReporterRecent = rows[position]
        override fun getItemId(position: Int): Long = rows[position].batchId.hashCode().toLong()
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: LayoutInflater.from(activity).inflate(R.layout.row_issue, parent, false)
            val row = getItem(position)
            val label = when (row.status) {
                "HAS_STOCK" -> "Đã có hàng"
                "SKIP_ALLOWED" -> "Đã cho skip"
                "CLOSED" -> "Picker thu hồi"
                else -> row.status
            }
            view.findViewById<TextView>(R.id.tvIssueSku).text = row.sku
            view.findViewById<TextView>(R.id.tvIssueProduct).text = row.productName
            view.findViewById<TextView>(R.id.tvIssueElapsed).text = ""
            view.findViewById<TextView>(R.id.tvIssueMeta).text =
                "$label · ${timestamp(row.resolvedAt)} · ${row.affectedPickerCount} Picker"
            return view
        }
    }

    private fun legacyTextAdapter(labels: List<String>): BaseAdapter = object : BaseAdapter() {
        override fun getCount(): Int = labels.size
        override fun getItem(position: Int): String = labels[position]
        override fun getItemId(position: Int): Long = position.toLong()
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: LayoutInflater.from(activity).inflate(R.layout.row_issue, parent, false)
            view.findViewById<TextView>(R.id.tvIssueSku).text = labels[position]
            view.findViewById<TextView>(R.id.tvIssueProduct).text = ""
            view.findViewById<TextView>(R.id.tvIssueElapsed).text = ""
            view.findViewById<TextView>(R.id.tvIssueMeta).text = ""
            return view
        }
    }

    private fun slaLabel(state: String): String = when (state) {
        "ESCALATED" -> "SLA quá hạn"
        "WARNING" -> "SLA cảnh báo"
        "NORMAL" -> "SLA bình thường"
        else -> "SLA chưa cấu hình"
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

    private fun pendingSignature(row: ReporterBatch): String {
        val timing = liveTiming(row)
        return listOf(
            row.batchId,
            row.version,
            row.affectedPickerCount,
            row.firstReportAt,
            row.previousBatchId.orEmpty(),
            row.recurrenceMinutes ?: -1,
            timing.second,
            timing.first,
        ).joinToString("|")
    }

    private fun pendingCard(row: ReporterBatch): ViewGroup {
        val timing = liveTiming(row)
        val liveState = timing.second
        val liveWaiting = timing.first
        val stroke = when (liveState) {
            "ESCALATED" -> kit.redStrong
            "WARNING" -> Color.parseColor("#EBC56E")
            else -> kit.line
        }
        return kit.card(Color.WHITE, stroke, 7).apply {
            addView(TextView(activity).apply {
                text = "SKU - ${row.sku}"
                textSize = 18f
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.navy)
            })
            addView(TextView(activity).apply {
                text = row.productName
                textSize = 12.5f
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
                setPadding(0, kit.dp(2), 0, 0)
            })
            val affectedPickerCount = row.affectedPickerCount
            val recurrence = if (row.previousBatchId != null) {
                val duration = row.recurrenceMinutes?.let { " · tái phát sau ${formatMinutes(it)}" }.orEmpty()
                " · Tái phát$duration"
            } else ""
            val sla = when (liveState) {
                "ESCALATED" -> "SLA quá hạn"
                "WARNING" -> "SLA cảnh báo"
                "NORMAL" -> "SLA bình thường"
                else -> "SLA chưa cấu hình"
            }
            addView(TextView(activity).apply {
                text = "$affectedPickerCount Picker · chờ $liveWaiting phút · $sla$recurrence\nBáo đầu: ${timestamp(row.firstReportAt)}"
                textSize = 12.5f
                maxLines = 3
                setTextColor(when (liveState) { "ESCALATED" -> kit.red; "WARNING" -> kit.orange; else -> kit.muted })
                setPadding(0, kit.dp(5), 0, kit.dp(2))
                contentDescription = "Xem $affectedPickerCount Picker báo SKU ${row.sku}"
                setOnClickListener { showTickets(row) }
            })

            val actions = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, kit.dp(8), 0, 0)
            }
            actions.addView(Button(activity).apply {
                text = "CÓ HÀNG"
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, kit.dp(56), 1f).apply { marginEnd = kit.dp(4) }
                kit.styleSuccess(this)
                setOnClickListener { confirmHasStock(row) }
            })
            actions.addView(Button(activity).apply {
                text = "CHO SKIP HÀNG"
                contentDescription = "Cho phép skip"
                textSize = 13.5f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, kit.dp(56), 1f).apply { marginStart = kit.dp(4) }
                kit.styleDanger(this)
                setOnClickListener { confirmSkipImpact(row) }
            })
            addView(actions)
        }
    }

    private fun recentSignature(row: ReporterRecent): String = listOf(
        row.batchId,
        row.version,
        row.status,
        row.resolvedAt.orEmpty(),
        row.correctionDeadlineAt.orEmpty(),
        row.affectedPickerCount,
        row.ackTargetCount,
        row.acknowledgedCount,
        row.previousBatchId.orEmpty(),
    ).joinToString("|")

    private fun recentCard(row: ReporterRecent, state: String): ViewGroup {
        val colors = when (state) {
            "HAS_STOCK" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
            "SKIP_ALLOWED" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
            else -> Triple(kit.graySoft, kit.line, kit.muted)
        }
        return kit.card(colors.first, colors.second, 7).apply {
            addView(TextView(activity).apply {
                text = "${row.sku} - ${row.productName}"
                textSize = 18.5f
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
            })
            val resultText = when (state) {
                "HAS_STOCK" -> "Đã có hàng"
                "SKIP_ALLOWED" -> "Đã cho skip"
                else -> "Picker thu hồi"
            }
            val ackText = if (state == "CLOSED") "" else " · ${row.acknowledgedCount}/${row.ackTargetCount} Picker đã xác nhận"
            val recurrence = if (row.previousBatchId != null) " · Tái phát" else ""
            addView(TextView(activity).apply {
                text = "$resultText · ${row.affectedPickerCount} Picker$ackText$recurrence\n${timestamp(row.resolvedAt)}"
                textSize = 12.5f
                setTextColor(colors.third)
                setPadding(0, kit.dp(5), 0, 0)
            })
            if (state == "SKIP_ALLOWED" && millis(row.correctionDeadlineAt) > System.currentTimeMillis()) {
                addView(Button(activity).apply {
                    text = "Sửa thành Đã có hàng"
                    textSize = 11.5f
                    kit.styleSecondary(this)
                    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, kit.dp(42)).apply {
                        topMargin = kit.dp(7)
                    }
                    setOnClickListener { confirmCorrection(row) }
                })
            }
        }
    }

    private fun confirmHasStock(row: ReporterBatch) {
        AlertDialog.Builder(activity)
            .setTitle("Xác nhận CÓ HÀNG?")
            .setMessage("${row.sku} - ${row.productName}\n${row.affectedPickerCount} Picker đang chờ.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("XÁC NHẬN CÓ HÀNG") { _, _ -> resolve(row, "HAS_STOCK", "Có hàng") }
            .show()
    }

    private fun confirmSkipImpact(row: ReporterBatch) {
        val affectedPickerCount = row.affectedPickerCount
        AlertDialog.Builder(activity)
            .setTitle("CHO PHÉP SKIP?")
            .setMessage("${row.sku} - ${row.productName}\n\nThao tác này sẽ cho phép $affectedPickerCount Picker đang bị ảnh hưởng skip SKU này.")
            .setNegativeButton("HUỶ", null)
            .setPositiveButton("XÁC NHẬN CHO SKIP") { _, _ -> resolve(row, "SKIP_ALLOWED", "Cho phép skip") }
            .show()
    }

    private fun resolve(row: ReporterBatch, resolution: String, label: String) {
        setStatus("Đang cập nhật ${row.sku}...")
        Thread {
            try {
                api.resolveBatch(row.batchId, resolution)
                activity.runOnUiThread { setStatus("Đã xử lý ${row.sku}: $label."); refresh() }
            } catch (e: Exception) {
                activity.runOnUiThread { setStatus(friendlyError(e)); refresh() }
            }
        }.start()
    }

    private fun confirmCorrection(row: ReporterRecent) {
        AlertDialog.Builder(activity)
            .setTitle("Sửa thành Đã có hàng?")
            .setMessage("${row.sku} - ${row.productName}\nLịch sử skip ban đầu vẫn được giữ.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ ->
                Thread {
                    try { api.correctBatch(row.batchId); activity.runOnUiThread { setStatus("Đã sửa ${row.sku} thành Đã có hàng."); refresh() } }
                    catch (e: Exception) { activity.runOnUiThread { setStatus(friendlyError(e)); refresh() } }
                }.start()
            }.show()
    }

    private fun showTickets(row: ReporterBatch) {
        Thread {
            try {
                val tickets = api.getBatchTickets(row.batchId)
                activity.runOnUiThread {
                    val text = if (tickets.isEmpty()) "Không có Picker trong batch." else tickets.joinToString("\n\n") {
                        val ack = if (it.resultEventId != null) if (it.acknowledgedAt != null) " · Đã xác nhận kết quả" else " · Chưa xác nhận kết quả" else ""
                        "${it.pickerEmployeeCode} - ${it.pickerDisplayName.ifBlank { "Chưa có tên" }}\nBáo ${timestamp(it.reportedAt)} · ${ticketStatus(it.status)}$ack"
                    }
                    val scroll = ScrollView(activity).apply {
                        addView(TextView(activity).apply { this.text = text; textSize = 13f; setPadding(kit.dp(16), kit.dp(8), kit.dp(16), kit.dp(8)) })
                    }
                    AlertDialog.Builder(activity).setTitle("${row.sku} · ${tickets.size} Picker").setView(scroll).setPositiveButton("Đóng", null).show()
                }
            } catch (e: Exception) { activity.runOnUiThread { setStatus(friendlyError(e)) } }
        }.start()
    }

    private fun formatMinutes(value: Int): String = if (value < 60) "${value}m" else "${value / 60}h ${value % 60}m"

    private fun timestamp(value: String?): String {
        if (value.isNullOrBlank()) return "—"
        return try { val instant = Instant.parse(value); "${timeFmt.format(instant)} ${dateFmt.format(instant)}" } catch (_: Exception) { value }
    }

    private fun millis(value: String?): Long = try { if (value.isNullOrBlank()) 0L else Instant.parse(value).toEpochMilli() } catch (_: Exception) { 0L }

    private fun ticketStatus(value: String): String = when (value) {
        "OPEN" -> "Đang xử lý"
        "WITHDRAWN" -> "Picker thu hồi"
        "RESOLVED" -> "Đã xử lý"
        else -> value
    }

    private fun empty(value: String): TextView = TextView(activity).apply {
        text = value
        textSize = 12.5f
        setTextColor(kit.muted)
        setPadding(kit.dp(12), kit.dp(16), kit.dp(12), kit.dp(16))
        background = kit.rounded(Color.WHITE, kit.line, 10)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.dp(6) }
    }
}
