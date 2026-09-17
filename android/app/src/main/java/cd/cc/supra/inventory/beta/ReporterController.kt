package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
import android.text.TextUtils
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
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
) {
    private enum class Filter { PENDING, HAS_STOCK, SKIP_ALLOWED, WITHDRAWN }
    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private val timeFmt = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(zone)
    private val dateFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone)
    private var refreshing = false
    private var filter = Filter.PENDING
    private val buttons = linkedMapOf<Filter, Button>()
    private var listBox: LinearLayout? = null
    private var queue: List<ReporterBatch> = emptyList()
    private var recent: List<ReporterRecent> = emptyList()

    fun render(root: LinearLayout) {
        val tabs = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, kit.dp(8), 0, kit.dp(5))
        }
        addTab(tabs, Filter.PENDING, "Đang xử lý")
        addTab(tabs, Filter.HAS_STOCK, "Đã có hàng")
        addTab(tabs, Filter.SKIP_ALLOWED, "Đã cho skip")
        addTab(tabs, Filter.WITHDRAWN, "Picker thu hồi")
        root.addView(tabs)
        listBox = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        root.addView(listBox)
        updateTabs()
        refresh()
    }

    fun onRealtime(scopes: Set<String>) {
        if (scopes.contains("reporter_queue") || scopes.contains("reporter_recent")) refresh()
    }

    fun refresh() {
        if (refreshing) return
        refreshing = true
        Thread {
            try {
                val nextQueue = api.getReporterQueue(100)
                val nextRecent = api.getReporterRecent(100)
                activity.runOnUiThread {
                    refreshing = false
                    queue = nextQueue
                    recent = nextRecent
                    renderSelected()
                    setStatus("Đã cập nhật ${nextQueue.size} SKU đang xử lý.")
                }
            } catch (e: Exception) {
                activity.runOnUiThread { refreshing = false; setStatus(friendlyError(e)) }
            }
        }.start()
    }

    private fun addTab(row: LinearLayout, value: Filter, label: String) {
        val button = Button(activity).apply {
            text = label
            textSize = 10.5f
            maxLines = 2
            minHeight = kit.dp(52)
            layoutParams = LinearLayout.LayoutParams(0, kit.dp(54), 1f).apply {
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
                button.setTextColor(kit.blue)
                button.setTypeface(button.typeface, Typeface.BOLD)
                button.background = kit.rounded(kit.blueSoft, Color.parseColor("#7FB3FF"), 9)
            } else {
                button.setTextColor(kit.text)
                button.setTypeface(button.typeface, Typeface.NORMAL)
                button.background = kit.rounded(Color.WHITE, kit.line, 9)
            }
        }
    }

    private fun renderSelected() {
        val box = listBox ?: return
        box.removeAllViews()
        when (filter) {
            Filter.PENDING -> renderPending(box)
            Filter.HAS_STOCK -> renderRecent(box, "HAS_STOCK")
            Filter.SKIP_ALLOWED -> renderRecent(box, "SKIP_ALLOWED")
            Filter.WITHDRAWN -> renderRecent(box, "CLOSED")
        }
    }

    private fun renderPending(box: LinearLayout) {
        if (queue.isEmpty()) { box.addView(empty("Không có SKU đang chờ xử lý.")); return }
        for (row in queue) {
            val stroke = when (row.slaState) {
                "ESCALATED" -> kit.redStrong
                "WARNING" -> Color.parseColor("#EBC56E")
                else -> kit.line
            }
            val card = kit.card(Color.WHITE, stroke, 11)
            card.addView(TextView(activity).apply {
                text = "${row.sku} - ${row.productName}"
                textSize = 19.5f
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
            })
            val affectedPickerCount = row.affectedPickerCount
            val recurrence = if (row.previousBatchId != null) {
                val duration = row.recurrenceMinutes?.let { " · tái phát sau ${formatMinutes(it)}" }.orEmpty()
                " · Tái phát$duration"
            } else ""
            val sla = when (row.slaState) {
                "ESCALATED" -> "SLA quá hạn"
                "WARNING" -> "SLA cảnh báo"
                "NORMAL" -> "SLA bình thường"
                else -> "SLA chưa cấu hình"
            }
            val context = TextView(activity).apply {
                text = "$affectedPickerCount Picker · chờ ${row.waitingMinutes} phút · $sla$recurrence\nBáo đầu: ${timestamp(row.firstReportAt)}"
                textSize = 12.5f
                maxLines = 3
                setTextColor(when (row.slaState) { "ESCALATED" -> kit.red; "WARNING" -> kit.orange; else -> kit.muted })
                setPadding(0, kit.dp(5), 0, kit.dp(2))
                contentDescription = "Xem $affectedPickerCount Picker báo SKU ${row.sku}"
                setOnClickListener { showTickets(row) }
            }
            card.addView(context)

            val actions = LinearLayout(activity).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, kit.dp(8), 0, 0) }
            actions.addView(Button(activity).apply {
                text = "CÓ HÀNG"
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, kit.dp(56), 1f).apply { marginEnd = kit.dp(4) }
                kit.stylePrimary(this)
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
            card.addView(actions)
            box.addView(card)
        }
    }

    private fun renderRecent(box: LinearLayout, state: String) {
        val rows = recent.filter { it.status == state }
        if (rows.isEmpty()) {
            box.addView(empty(when (state) {
                "HAS_STOCK" -> "Chưa có kết quả Đã có hàng."
                "SKIP_ALLOWED" -> "Chưa có kết quả Đã cho skip."
                else -> "Chưa có báo Picker thu hồi."
            }))
            return
        }
        for (row in rows) {
            val colors = when (state) {
                "HAS_STOCK" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
                "SKIP_ALLOWED" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
                else -> Triple(kit.graySoft, kit.line, kit.muted)
            }
            val card = kit.card(colors.first, colors.second, 11)
            card.addView(TextView(activity).apply {
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
            card.addView(TextView(activity).apply {
                text = "$resultText · ${row.affectedPickerCount} Picker$ackText$recurrence\n${timestamp(row.resolvedAt)}"
                textSize = 12.5f
                setTextColor(colors.third)
                setPadding(0, kit.dp(5), 0, 0)
            })
            if (state == "SKIP_ALLOWED" && millis(row.correctionDeadlineAt) > System.currentTimeMillis()) {
                card.addView(Button(activity).apply {
                    text = "Sửa thành Đã có hàng"
                    textSize = 11.5f
                    kit.styleSecondary(this)
                    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, kit.dp(42)).apply { topMargin = kit.dp(7) }
                    setOnClickListener { confirmCorrection(row) }
                })
            }
            box.addView(card)
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
