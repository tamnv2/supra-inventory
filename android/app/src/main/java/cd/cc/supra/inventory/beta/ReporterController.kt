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
import org.json.JSONObject
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
    private enum class Filter { PENDING, OVERDUE, HAS_STOCK, SKIP_ALLOWED, WITHDRAWN }

    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private val timeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(zone)
    private val dateFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone)
    private val handler = Handler(Looper.getMainLooper())
    private var queueServerOffsetMs = 0L
    private var refreshing = false
    private var refreshDirty = false
    private val refreshWaiters = mutableListOf<(Boolean) -> Unit>()
    private val processingBatchIds = mutableSetOf<String>()
    private val confirmingBatchIds = mutableSetOf<String>()

    private var filter = when (initialFilter.uppercase()) {
        "OVERDUE" -> Filter.OVERDUE
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
    private var overdueRows: List<ReporterOverdueBatch> = emptyList()
    private var overdueTotal = 0
    private var overdueEnabled = false
    private var overdueLoaded = false
    private var overdueLoading = false
    private var recent: List<ReporterRecent> = emptyList()
    private var recentCounts = ReporterRecentCounts()

    // One shared UI ticker. SKIP correction needs second-level countdown; PENDING
    // keeps minute-boundary refresh. Neither path performs network I/O per tick.
    private val minuteTicker = object : Runnable {
        override fun run() {
            if ((filter == Filter.PENDING && queue.isNotEmpty()) ||
                (filter == Filter.SKIP_ALLOWED && recent.isNotEmpty())
            ) {
                (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
            }
            scheduleMinuteTicker()
        }
    }

    fun render(root: LinearLayout) {
        applyDisplayScale(root)
        list = root.findViewById(R.id.listIssues)
        bindTab(root, Filter.PENDING, R.id.tabReporterPendingBox, R.id.tabReporterPending, R.id.badgeReporterPending)
        bindTab(root, Filter.OVERDUE, R.id.tabReporterOverdueBox, R.id.tabReporterOverdue, R.id.badgeReporterOverdue)
        bindTab(root, Filter.HAS_STOCK, R.id.tabReporterHasStockBox, R.id.tabReporterHasStock, R.id.badgeReporterHasStock)
        bindTab(root, Filter.SKIP_ALLOWED, R.id.tabReporterSkipBox, R.id.tabReporterSkip, R.id.badgeReporterSkip)
        bindTab(root, Filter.WITHDRAWN, R.id.tabReporterWithdrawnBox, R.id.tabReporterWithdrawn, R.id.badgeReporterWithdrawn)
        updateTabs()
        scheduleMinuteTicker()
        refresh()
    }

    fun currentFilterName(): String = filter.name

    fun destroy() {
        handler.removeCallbacks(minuteTicker)
        refreshWaiters.clear()
        list = null
    }

    fun onRealtime(scopes: Set<String>, events: List<RealtimeDeltaEvent>, completion: (Boolean) -> Unit) {
        val relevant = scopes.contains("reporter_queue") || scopes.contains("reporter_overdue") || scopes.contains("reporter_recent")
        if (!relevant) {
            completion(true)
            return
        }
        if (events.isNotEmpty() && applyRealtimeEvents(events)) {
            completion(true)
            return
        }
        // Full authoritative reconcile is reserved for initial state, a real cursor
        // gap, or incompatible/missing event data.
        refresh(completion)
    }

    private fun nullable(value: JSONObject, key: String): String? =
        value.optString(key).trim().takeIf { it.isNotBlank() && it != "null" }

    private fun reporterBatchFromSnapshot(snapshot: JSONObject): ReporterBatch? {
        if (snapshot.optString("status") != "PENDING") return null
        val waiting = snapshot.optInt("waiting_picker_count", snapshot.optInt("open_ticket_count", 0))
        if (waiting <= 0) return null
        return ReporterBatch(
            batchId = snapshot.optString("batch_id"),
            sku = snapshot.optString("sku"),
            productName = snapshot.optString("product_name"),
            firstReportAt = snapshot.optString("first_report_at"),
            affectedPickerCount = waiting,
            version = snapshot.optInt("version", 1).coerceAtLeast(1),
            previousBatchId = nullable(snapshot, "previous_batch_id"),
            previousResolvedAt = nullable(snapshot, "previous_resolved_at"),
            recurrenceMinutes = if (snapshot.has("recurrence_minutes") && !snapshot.isNull("recurrence_minutes")) snapshot.optInt("recurrence_minutes") else null,
            slaState = snapshot.optString("sla_state", "UNCONFIGURED"),
            waitingMinutes = snapshot.optInt("waiting_minutes", 0),
            warningAt = nullable(snapshot, "warning_at"),
            escalationAt = nullable(snapshot, "escalation_at"),
            autoSkipAt = nullable(snapshot, "auto_skip_at"),
            autoSkipEnabled = snapshot.optBoolean("auto_skip_enabled", false),
            autoSkipMode = nullable(snapshot, "auto_skip_mode"),
            serverNow = null,
        )
    }

    private fun reporterOverdueFromSnapshot(snapshot: JSONObject): ReporterOverdueBatch? {
        if (snapshot.optString("status") != "PENDING") return null
        val overdue = snapshot.optInt("overdue_picker_count", snapshot.optInt("overdue_ticket_count", 0))
        if (overdue < 1) return null
        return ReporterOverdueBatch(
            batchId = snapshot.optString("batch_id"),
            sku = snapshot.optString("sku"),
            productName = snapshot.optString("product_name"),
            firstReportAt = snapshot.optString("first_report_at"),
            firstOverdueAt = nullable(snapshot, "first_overdue_at"),
            overduePickerCount = overdue,
            waitingPickerCount = snapshot.optInt("waiting_picker_count", snapshot.optInt("open_ticket_count", 0)),
            version = snapshot.optInt("version", 1).coerceAtLeast(1),
        )
    }

    private fun reporterRecentFromSnapshot(snapshot: JSONObject): ReporterRecent? {
        val status = snapshot.optString("status")
        if (status !in setOf("HAS_STOCK", "SKIP_ALLOWED", "CLOSED")) return null
        return ReporterRecent(
            batchId = snapshot.optString("batch_id"),
            sku = snapshot.optString("sku"),
            productName = snapshot.optString("product_name"),
            status = status,
            firstReportAt = snapshot.optString("first_report_at"),
            resolvedAt = nullable(snapshot, "resolved_at"),
            resolutionSource = nullable(snapshot, "resolution_source"),
            resolvedByDisplayName = nullable(snapshot, "resolved_by_display_name"),
            resolvedByEmployeeCode = nullable(snapshot, "resolved_by_employee_code"),
            correctionDeadlineAt = nullable(snapshot, "correction_deadline_at"),
            correctionAllowed = false,
            affectedPickerCount = snapshot.optInt("affected_picker_count", 0),
            version = snapshot.optInt("version", 1).coerceAtLeast(1),
            previousBatchId = nullable(snapshot, "previous_batch_id"),
            ackTargetCount = snapshot.optInt("ack_target_count", 0),
            acknowledgedCount = snapshot.optInt("acknowledged_count", 0),
        )
    }

    private fun applyRecentCountDelta(metadata: JSONObject, snapshot: JSONObject): Boolean {
        val transition = metadata.optJSONObject("recent_counter") ?: return true
        val before = transition.optString("before_status").takeIf { it in setOf("HAS_STOCK", "SKIP_ALLOWED", "CLOSED") }
        val after = transition.optString("after_status").takeIf { it in setOf("HAS_STOCK", "SKIP_ALLOWED", "CLOSED") }
        var hasStock = recentCounts.hasStock
        var skip = recentCounts.skipAllowed
        var withdrawn = recentCounts.withdrawn
        fun change(status: String?, delta: Int) {
            when (status) {
                "HAS_STOCK" -> hasStock = (hasStock + delta).coerceAtLeast(0)
                "SKIP_ALLOWED" -> skip = (skip + delta).coerceAtLeast(0)
                "CLOSED" -> withdrawn = (withdrawn + delta).coerceAtLeast(0)
            }
        }
        change(before, -1)
        change(after, 1)
        recentCounts = ReporterRecentCounts(hasStock = hasStock, skipAllowed = skip, withdrawn = withdrawn)
        return true
    }

    private fun applyRealtimeEvents(events: List<RealtimeDeltaEvent>): Boolean {
        var changed = false
        for (event in events) {
            val queueChanged = event.scopes.contains("reporter_queue")
            val overdueChanged = event.scopes.contains("reporter_overdue")
            val recentChanged = event.scopes.contains("reporter_recent")
            if (!queueChanged && !overdueChanged && !recentChanged) continue
            val snapshot = event.snapshot ?: return false
            val batchId = snapshot.optString("batch_id").trim()
            if (batchId.isBlank()) return false
            val metadata = event.metadata ?: JSONObject()

            if (queueChanged) {
                val delta = metadata.opt("queue_delta")
                if (delta != null) {
                    val parsed = metadata.optInt("queue_delta", Int.MIN_VALUE)
                    if (parsed !in -1..1) return false
                    queueTotal = (queueTotal + parsed).coerceAtLeast(0)
                } else if (event.event.uppercase() !in setOf("SLA_WARNING", "SLA_ESCALATED")) {
                    return false
                }
                val row = reporterBatchFromSnapshot(snapshot)
                queue = if (row == null) {
                    queue.filterNot { it.batchId == batchId }
                } else {
                    (queue.filterNot { it.batchId == batchId } + row)
                        .sortedWith(compareBy<ReporterBatch> { it.firstReportAt }.thenBy { it.batchId })
                }
            }

            if (overdueChanged) {
                if (!metadata.has("overdue_delta")) return false
                val delta = metadata.optInt("overdue_delta", Int.MIN_VALUE)
                if (delta !in -1..1) return false
                overdueTotal = (overdueTotal + delta).coerceAtLeast(0)
                if (overdueLoaded) {
                    val row = reporterOverdueFromSnapshot(snapshot)
                    overdueRows = if (row == null) {
                        overdueRows.filterNot { it.batchId == batchId }
                    } else {
                        (overdueRows.filterNot { it.batchId == batchId } + row)
                            .sortedWith(compareBy<ReporterOverdueBatch> { it.firstOverdueAt ?: it.firstReportAt }.thenBy { it.batchId })
                            .take(200)
                    }
                }
            }

            if (recentChanged) {
                if (!applyRecentCountDelta(metadata, snapshot)) return false
                val row = reporterRecentFromSnapshot(snapshot)
                recent = if (row == null) {
                    recent.filterNot { it.batchId == batchId }
                } else {
                    (recent.filterNot { it.batchId == batchId } + row)
                        .sortedByDescending { millis(it.resolvedAt ?: it.firstReportAt) }
                        .take(200)
                }
            }
            changed = true
        }
        if (!changed) return true
        updateBadges()
        renderSelected()
        scheduleMinuteTicker()
        return true
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
        if (filter == value || (value == Filter.OVERDUE && !overdueEnabled)) return
        filter = value
        updateTabs()
        renderSelected()
        if (value == Filter.OVERDUE && !overdueLoaded) loadOverdue()
    }

    private fun scheduleMinuteTicker() {
        handler.removeCallbacks(minuteTicker)
        val calibratedNow = System.currentTimeMillis() + queueServerOffsetMs
        val delay = if (filter == Filter.SKIP_ALLOWED) {
            (1_000L - (calibratedNow % 1_000L) + 30L).coerceIn(250L, 1_030L)
        } else {
            (60_000L - (calibratedNow % 60_000L) + 80L).coerceIn(1_000L, 60_080L)
        }
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
                val nextCounters = api.getReporterCountersSnapshot()
                val canShowOverdue = nextCounters.autoSkipEnabled && nextCounters.autoSkipMode == "PER_PICKER"
                val nextOverdue = if (canShowOverdue && filter == Filter.OVERDUE) api.getReporterOverdueSnapshot(200) else null
                activity.runOnUiThread {
                    if (list == null) {
                        refreshing = false
                        finishRefreshWaiters(false)
                        return@runOnUiThread
                    }
                    val queueServerNow = nextQueue.items.firstOrNull()?.serverNow?.let(::millis) ?: 0L
                    val serverNow = nextRecent.serverNowMs.takeIf { it > 0L } ?: queueServerNow
                    queueServerOffsetMs = if (serverNow > 0L) serverNow - System.currentTimeMillis() else 0L
                    queue = nextQueue.items
                    queueTotal = nextQueue.total
                    recent = nextRecent.items
                    recentCounts = nextRecent.counts
                    overdueEnabled = canShowOverdue
                    overdueTotal = if (canShowOverdue) nextCounters.overdueTotal else 0
                    overdueRows = nextOverdue?.items ?: emptyList()
                    overdueLoaded = nextOverdue != null
                    if (!overdueEnabled && filter == Filter.OVERDUE) filter = Filter.PENDING
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
        // Keep the accepted four-tab layout; enable horizontal scrolling only
        // when PER_PICKER exposes a fifth tab.
        val strip = list?.rootView?.findViewById<LinearLayout>(R.id.reporterTabs)
        strip?.layoutParams?.let { params ->
            val width = if (overdueEnabled) ViewGroup.LayoutParams.WRAP_CONTENT else ViewGroup.LayoutParams.MATCH_PARENT
            if (params.width != width) {
                params.width = width
                strip.layoutParams = params
            }
        }
        for ((_, box) in tabBoxes) {
            val params = box.layoutParams as? LinearLayout.LayoutParams ?: continue
            params.width = if (overdueEnabled) kit.dp((104 * displayScale).roundToInt().coerceIn(94, 130)) else 0
            params.weight = if (overdueEnabled) 0f else 1f
            box.layoutParams = params
        }
        tabBoxes[Filter.OVERDUE]?.visibility = if (overdueEnabled) View.VISIBLE else View.GONE
        setBadge(Filter.PENDING, queueTotal)
        setBadge(Filter.OVERDUE, overdueTotal)
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
        } else if (filter == Filter.OVERDUE) {
            target.adapter = overdueAdapter(overdueRows)
            target.setOnItemClickListener { _, _, position, _ ->
                overdueRows.getOrNull(position)?.let { showTickets(it.batchId, it.sku) }
            }
        } else {
            val rows = recentRows()
            target.adapter = recentAdapter(rows)
        }
        scheduleMinuteTicker()
        updateTabs()
    }

    // The overdue list is lazy: tab counters are cheap; list rows are fetched
    // only on first opening, then patched from the existing realtime stream.
    private fun loadOverdue() {
        if (!overdueEnabled || overdueLoaded || overdueLoading || list == null) return
        overdueLoading = true
        setStatus("Đang tải SKU quá hạn…")
        Thread {
            try {
                val next = api.getReporterOverdueSnapshot(200)
                activity.runOnUiThread {
                    if (list == null) return@runOnUiThread
                    overdueLoading = false
                    overdueEnabled = next.enabled && next.autoSkipMode == "PER_PICKER"
                    overdueRows = if (overdueEnabled) next.items else emptyList()
                    overdueTotal = if (overdueEnabled) next.total else 0
                    overdueLoaded = overdueEnabled
                    if (!overdueEnabled && filter == Filter.OVERDUE) filter = Filter.PENDING
                    updateBadges()
                    renderSelected()
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    overdueLoading = false
                    setStatus(friendlyError(e))
                }
            }
        }.start()
    }

    private fun overdueAdapter(rows: List<ReporterOverdueBatch>): BaseAdapter = object : BaseAdapter() {
        override fun getCount(): Int = rows.size
        override fun getItem(position: Int): ReporterOverdueBatch = rows[position]
        override fun getItemId(position: Int): Long = rows[position].batchId.hashCode().toLong()
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val created = convertView == null
            val view = convertView ?: LayoutInflater.from(activity).inflate(R.layout.row_reporter_issue, parent, false)
            if (created) applyDisplayScale(view)
            val row = getItem(position)
            bindCommon(view, row.sku, row.productName, "${row.overduePickerCount} quá hạn")
            view.findViewById<LinearLayout>(R.id.reporterRowRoot).background = kit.rounded(kit.orangeSoft, kit.skipStroke, 7)
            view.findViewById<TextView>(R.id.tvReporterMeta).apply {
                text = "Quá hạn: ${row.overduePickerCount} Picker · Còn chờ: ${row.waitingPickerCount} Picker\nLần đầu: ${timestamp(row.firstOverdueAt)}"
                setTextColor(kit.orange)
            }
            val busy = processingBatchIds.contains(row.batchId) || confirmingBatchIds.contains(row.batchId)
            view.findViewById<Button>(R.id.btnReporterHasStock).apply {
                visibility = View.VISIBLE
                text = "Đã có hàng"
                isEnabled = !busy
                alpha = if (busy) 0.45f else 1f
                setOnClickListener { confirmResolution(row.batchId, row.sku, row.productName, "HAS_STOCK", "Đã có hàng") }
            }
            view.findViewById<Button>(R.id.btnReporterSkip).apply {
                visibility = View.VISIBLE
                text = "Cho phép skip"
                isEnabled = !busy
                alpha = if (busy) 0.45f else 1f
                setOnClickListener { confirmResolution(row.batchId, row.sku, row.productName, "SKIP_ALLOWED", "Cho phép skip") }
            }
            return view
        }
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
            hasStock.setOnClickListener { confirmResolution(row.batchId, row.sku, row.productName, "HAS_STOCK", "Đã có hàng") }
            skip.setOnClickListener { confirmResolution(row.batchId, row.sku, row.productName, "SKIP_ALLOWED", "Cho phép skip") }
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
            val actions = view.findViewById<LinearLayout>(R.id.reporterActions)
            val hasStock = view.findViewById<Button>(R.id.btnReporterHasStock)
            val skip = view.findViewById<Button>(R.id.btnReporterSkip)
            val calibratedNow = System.currentTimeMillis() + queueServerOffsetMs
            val deadlineMs = millis(row.correctionDeadlineAt)
            val remainingMs = (deadlineMs - calibratedNow).coerceAtLeast(0L)
            val canCorrectSkip = row.status == "SKIP_ALLOWED" && row.correctionAllowed && deadlineMs > 0L && remainingMs > 0L
            val canCorrectStock = row.status == "HAS_STOCK"
            val busy = processingBatchIds.contains(row.batchId) || confirmingBatchIds.contains(row.batchId)
            actions.visibility = if (canCorrectSkip || canCorrectStock) View.VISIBLE else View.GONE
            hasStock.visibility = if (canCorrectSkip || canCorrectStock) View.VISIBLE else View.GONE
            skip.visibility = if (canCorrectStock) View.VISIBLE else View.GONE
            hasStock.isEnabled = !busy
            skip.isEnabled = !busy
            hasStock.alpha = if (busy) 0.45f else 1f
            skip.alpha = if (busy) 0.45f else 1f
            when {
                canCorrectStock -> {
                    hasStock.text = "Sửa - Đang xử lý"
                    skip.text = "Sửa - Cho phép Skip"
                    hasStock.setOnClickListener { confirmStockCorrection(row, "PENDING", "Đang xử lý") }
                    skip.setOnClickListener { confirmStockCorrection(row, "SKIP_ALLOWED", "Cho phép Skip") }
                }
                canCorrectSkip -> {
                    val totalSeconds = (remainingMs + 999L) / 1_000L
                    val minutes = totalSeconds / 60L
                    val seconds = totalSeconds % 60L
                    hasStock.text = "Sửa thành Đã có hàng · %02d:%02d".format(minutes, seconds)
                    hasStock.setOnClickListener { confirmCorrection(row) }
                    skip.setOnClickListener(null)
                }
                else -> {
                    hasStock.setOnClickListener(null)
                    skip.setOnClickListener(null)
                }
            }
            val root = view.findViewById<LinearLayout>(R.id.reporterRowRoot)
            val colors = when (row.status) {
                "HAS_STOCK" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
                "SKIP_ALLOWED" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
                else -> Triple(kit.graySoft, kit.line, kit.muted)
            }
            root.background = kit.rounded(colors.first, colors.second, 7)
            val reportTime = timeOnly(row.firstReportAt)
            val responseTime = row.resolvedAt?.let(::timeOnly)
            val responder = when {
                row.status == "CLOSED" -> ""
                row.resolutionSource == "SYSTEM_TIMEOUT" -> "Hệ thống"
                !row.resolvedByDisplayName.isNullOrBlank() -> row.resolvedByDisplayName
                !row.resolvedByEmployeeCode.isNullOrBlank() -> row.resolvedByEmployeeCode
                else -> ""
            }
            view.findViewById<TextView>(R.id.tvReporterMeta).apply {
                text = if (responseTime.isNullOrBlank()) {
                    "Báo lúc: $reportTime"
                } else {
                    "Báo lúc: $reportTime\nInvent phản hồi lúc: $responseTime" + if (responder.isBlank()) "" else " bởi $responder"
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

    private fun confirmResolution(batchId: String, sku: String, productName: String, resolution: String, label: String) {
        if (processingBatchIds.contains(batchId) || !confirmingBatchIds.add(batchId)) return
        (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
        val dialog = AlertDialog.Builder(activity)
            .setTitle("Xác nhận $label?")
            .setMessage("$sku - $productName\nXác nhận xử lý SKU này?")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ -> resolveDirect(batchId, sku, resolution, label) }
            .create()
        dialog.setOnDismissListener {
            confirmingBatchIds.remove(batchId)
            (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
        }
        dialog.show()
    }

    private fun resolveDirect(batchId: String, sku: String, resolution: String, label: String) {
        if (!processingBatchIds.add(batchId)) return
        (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
        setStatus("Đang cập nhật $sku…")
        Thread {
            try {
                api.resolveBatch(batchId, resolution)
                activity.runOnUiThread {
                    processingBatchIds.remove(batchId)
                    setStatus("Đã xử lý $sku: $label.")
                    refresh()
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    processingBatchIds.remove(batchId)
                    setStatus(friendlyError(e))
                    refresh()
                }
            }
        }.start()
    }

    private fun confirmStockCorrection(row: ReporterRecent, target: String, label: String) {
        if (processingBatchIds.contains(row.batchId) || !confirmingBatchIds.add(row.batchId)) return
        (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
        var secondOpened = false
        val first = AlertDialog.Builder(activity)
            .setTitle("Sửa kết quả Đã có hàng?")
            .setMessage("${row.sku} - ${row.productName}\nChuyển kết quả sang $label?")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Tiếp tục") { _, _ ->
                secondOpened = true
                val second = AlertDialog.Builder(activity)
                    .setTitle("CẢNH BÁO: Thay đổi kết quả đã gửi")
                    .setMessage("Kết quả Đã có hàng đã được thông báo cho Picker. Thay đổi sang $label sẽ tạo kết quả điều chỉnh mới và yêu cầu Picker xác nhận lại. Tiếp tục?")
                    .setNegativeButton("Huỷ", null)
                    .setPositiveButton("Xác nhận sửa") { _, _ ->
                        if (processingBatchIds.add(row.batchId)) {
                            (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
                            Thread {
                                try {
                                    api.correctResolvedBatch(row.batchId, target, row.version)
                                    activity.runOnUiThread {
                                        processingBatchIds.remove(row.batchId)
                                        setStatus("Đã sửa ${row.sku} thành $label.")
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
                    }.create()
                second.setOnDismissListener {
                    confirmingBatchIds.remove(row.batchId)
                    (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
                }
                second.show()
            }.create()
        first.setOnDismissListener {
            if (!secondOpened) {
                confirmingBatchIds.remove(row.batchId)
                (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
            }
        }
        first.show()
    }

    private fun confirmCorrection(row: ReporterRecent) {
        val calibratedNow = System.currentTimeMillis() + queueServerOffsetMs
        if (millis(row.correctionDeadlineAt) <= calibratedNow) {
            setStatus("Đã hết thời gian cho phép sửa kết quả.")
            (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("Sửa thành Đã có hàng?")
            .setMessage("${row.sku} - ${row.productName}\nLịch sử Cho phép skip ban đầu vẫn được giữ.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ ->
                if (!processingBatchIds.add(row.batchId)) return@setPositiveButton
                (list?.adapter as? BaseAdapter)?.notifyDataSetChanged()
                Thread {
                    try {
                        api.correctBatch(row.batchId)
                        activity.runOnUiThread {
                            processingBatchIds.remove(row.batchId)
                            setStatus("Đã sửa ${row.sku} thành Đã có hàng.")
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
            }.show()
    }

    private fun showTickets(row: ReporterBatch) = showTickets(row.batchId, row.sku)

    private fun showTickets(batchId: String, sku: String) {
        Thread {
            try {
                val tickets = api.getBatchTickets(batchId)
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
                        .setTitle("$sku · ${tickets.size} Picker")
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
