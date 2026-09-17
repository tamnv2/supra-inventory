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
        setStatus("Đang cập nhật hàng chờ xử lý...")
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
                activity.runOnUiThread {
                    refreshing = false
                    setStatus(friendlyError(e))
                }
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
            setOnClickListener {
                filter = value
                updateTabs()
                renderSelected()
            }
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
        if (queue.isEmpty()) {
            box.addView(empty("Không có SKU đang chờ xử lý."))
            return
        }
        for (row in queue) {
            val card = kit.card(Color.WHITE, kit.line, 11)
            card.addView(TextView(activity).apply {
                text = "${row.sku} - ${row.productName}"
                textSize = 19.5f
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
            })
            card.addView(TextView(activity).apply {
                text = "Báo lần đầu lúc: ${timestamp(row.firstReportAt)} - ${row.affectedPickerCount} lượt báo"
                textSize = 12.5f
                maxLines = 2
                setTextColor(kit.muted)
                setPadding(0, kit.dp(4), 0, kit.dp(2))
                contentDescription = "Xem ${row.affectedPickerCount} Picker báo SKU ${row.sku}"
                setOnClickListener { showTickets(row) }
            })
            val actions = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, kit.dp(7), 0, 0)
            }
            actions.addView(Button(activity).apply {
                text = "CÓ HÀNG"
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, kit.dp(54), 1f).apply { marginEnd = kit.dp(4) }
                kit.stylePrimary(this)
                setOnClickListener { confirmResolve(row, "HAS_STOCK") }
            })
            actions.addView(Button(activity).apply {
                text = "CHO SKIP HÀNG"
                contentDescription = "Cho phép skip"
                textSize = 13.5f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, kit.dp(54), 1f).apply { marginStart = kit.dp(4) }
                kit.styleDanger(this)
                setOnClickListener { confirmResolve(row, "SKIP_ALLOWED") }
            })
            card.addView(actions)
            box.addView(card)
        }
    }

    private fun renderRecent(box: LinearLayout, state: String) {
        val rows = recent.filter { it.status == state }
        if (rows.isEmpty()) {
            val label = when (state) {
                "HAS_STOCK" -> "Chưa có kết quả Đã có hàng."
                "SKIP_ALLOWED" -> "Chưa có kết quả Đã cho skip."
                else -> "Chưa có báo Picker thu hồi."
            }
            box.addView(empty(label))
            return
        }
        for (row in rows) {
            val colors = when (state) {
                "HAS_STOCK" -> Triple(kit.stockFill, kit.stockStroke, kit.greenDark)
                "SKIP_ALLOWED" -> Triple(kit.skipFill, kit.skipStroke, kit.red)
                else -> Triple(kit.graySoft, kit.line, kit.muted)
            }
            val card = kit.card(colors.first, colors.second, 11)
            val titleRow = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            titleRow.addView(TextView(activity).apply {
                text = "${row.sku} - ${row.productName}"
                textSize = 18.5f
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(kit.text)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = kit.dp(6) }
            })
            titleRow.addView(TextView(activity).apply {
                text = when (state) {
                    "HAS_STOCK" -> "Đã có hàng"
                    "SKIP_ALLOWED" -> "Đã cho skip"
                    else -> "Picker thu hồi"
                }
                textSize = 11.5f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(colors.third)
                setPadding(kit.dp(8), kit.dp(5), kit.dp(8), kit.dp(5))
                background = kit.rounded(colors.first, colors.second, 999)
            })
            card.addView(titleRow)
            card.addView(TextView(activity).apply {
                text = if (state == "CLOSED") {
                    "${row.affectedPickerCount} lượt báo · Picker đã thu hồi"
                } else {
                    "Xử lý: ${timestamp(row.resolvedAt)} - ${row.affectedPickerCount} lượt báo"
                }
                textSize = 12.5f
                setTextColor(kit.muted)
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

    private fun confirmResolve(row: ReporterBatch, resolution: String) {
        val label = if (resolution == "HAS_STOCK") "Có hàng" else "Cho phép skip"
        AlertDialog.Builder(activity)
            .setTitle("Xác nhận $label?")
            .setMessage("${row.sku} - ${row.productName}\n${row.affectedPickerCount} Picker đang chờ.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ ->
                setStatus("Đang cập nhật ${row.sku}...")
                Thread {
                    try {
                        api.resolveBatch(row.batchId, resolution)
                        activity.runOnUiThread { setStatus("Đã xử lý ${row.sku}: $label."); refresh() }
                    } catch (e: Exception) {
                        activity.runOnUiThread { setStatus(friendlyError(e)); refresh() }
                    }
                }.start()
            }.show()
    }

    private fun confirmCorrection(row: ReporterRecent) {
        AlertDialog.Builder(activity)
            .setTitle("Sửa thành Đã có hàng?")
            .setMessage("${row.sku} - ${row.productName}\nLịch sử skip ban đầu vẫn được giữ.")
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
        setStatus("Đang tải Picker của ${row.sku}...")
        Thread {
            try {
                val tickets = api.getBatchTickets(row.batchId)
                activity.runOnUiThread {
                    val text = if (tickets.isEmpty()) "Không có Picker trong batch." else tickets.joinToString("\n\n") {
                        "${it.pickerEmployeeCode} - ${it.pickerDisplayName.ifBlank { "Chưa có tên" }}\nBáo ${timestamp(it.reportedAt)} · ${ticketStatus(it.status)}"
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
                    setStatus("Đã tải chi tiết ${row.sku}.")
                }
            } catch (e: Exception) {
                activity.runOnUiThread { setStatus(friendlyError(e)) }
            }
        }.start()
    }

    private fun timestamp(value: String?): String {
        if (value.isNullOrBlank()) return "—"
        return try {
            val instant = Instant.parse(value)
            "${timeFmt.format(instant)} ${dateFmt.format(instant)}"
        } catch (_: Exception) { value }
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
