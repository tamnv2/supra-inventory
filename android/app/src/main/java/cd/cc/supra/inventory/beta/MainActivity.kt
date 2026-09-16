package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.text.method.PasswordTransformationMethod
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.FileProvider
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.ArrayDeque
import kotlin.math.max

class MainActivity : Activity() {
    private val ui = Handler(Looper.getMainLooper())
    private lateinit var api: InventoryApi
    private lateinit var skuCache: SkuCatalogCache
    private lateinit var status: TextView
    private lateinit var updateButton: Button

    private var pendingInstallFile: File? = null
    private var searchRunnable: Runnable? = null
    private var searchGeneration = 0
    private var catalogSyncing = false
    private var reporterRefreshing = false
    private var pickerRefreshing = false

    private var catalogStatusView: TextView? = null
    private var skuInput: EditText? = null
    private var skuSuggestions: LinearLayout? = null
    private var selectedSkuLabel: TextView? = null
    private var reportButton: Button? = null
    private var selectedSku: SkuItem? = null
    private var pickerReportsBox: LinearLayout? = null
    private var reporterQueueBox: LinearLayout? = null
    private var reporterRecentBox: LinearLayout? = null

    private val withdrawButtons = linkedMapOf<Button, Long>()
    private var pickerSnapshotReady = false
    private val pickerStatusSnapshot = mutableMapOf<String, String>()
    private val resultAlerts = ArrayDeque<String>()
    private var resultAlertShowing = false

    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM HH:mm:ss")
        .withZone(ZoneId.of("Asia/Ho_Chi_Minh"))

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
                button.text = if (remaining > 0) {
                    "Nhấn giữ để thu hồi (${remaining}s)"
                } else {
                    "Hết thời gian thu hồi"
                }
                button.isEnabled = remaining > 0
            }
            ui.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            renderFatal("Thiết bị cần Android 11 trở lên.")
            return
        }
        if (BuildConfig.FIREBASE_API_KEY.isBlank()) {
            renderFatal("Thiếu cấu hình Firebase Beta.")
            return
        }

        val options = FirebaseOptions.Builder()
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setApplicationId(BuildConfig.FIREBASE_APP_ID)
            .setGcmSenderId(BuildConfig.FIREBASE_MESSAGING_SENDER_ID)
            .build()
        if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this, options)

        api = InventoryApi(
            baseUrl = BuildConfig.API_BASE_URL.trimEnd('/'),
            userAgent = "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}",
        )
        skuCache = SkuCatalogCache(this)

        ui.post(withdrawTicker)
        renderLogin()
        checkForUpdate(silent = true)
    }

    override fun onDestroy() {
        searchRunnable?.let { ui.removeCallbacks(it) }
        ui.removeCallbacks(withdrawTicker)
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        val pending = pendingInstallFile ?: return
        if (packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = null
            launchInstaller(pending)
        }
    }

    private fun renderLogin(message: String = "Sẵn sàng đăng nhập Beta.") {
        withdrawButtons.clear()
        pickerSnapshotReady = false
        pickerStatusSnapshot.clear()
        resultAlerts.clear()
        resultAlertShowing = false

        val root = page()
        root.addView(TextView(this).apply {
            text = "SUPRA Inventory"
            textSize = 27f
            setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "BÁO HÀNG · BETA"
            textSize = 13f
            setTextColor(Color.parseColor("#4F46E5"))
        })
        root.addView(TextView(this).apply {
            text = "Phiên bản ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · Android 11+"
            textSize = 12f
            setTextColor(Color.DKGRAY)
        })

        val loginCard = card()
        loginCard.addView(sectionTitle("Đăng nhập"))
        val username = EditText(this).apply {
            hint = "MNV / tên đăng nhập"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        val password = EditText(this).apply {
            hint = "Mật khẩu"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            transformationMethod = PasswordTransformationMethod.getInstance()
        }
        val showPassword = CheckBox(this).apply { text = "Hiện mật khẩu" }
        val loginButton = Button(this).apply { text = "Đăng nhập" }
        loginCard.addView(username)
        loginCard.addView(password)
        loginCard.addView(showPassword)
        loginCard.addView(loginButton)
        root.addView(loginCard)

        updateButton = Button(this).apply { text = "Kiểm tra cập nhật" }
        root.addView(updateButton)
        status = TextView(this).apply {
            text = message
            textSize = 13f
            setPadding(0, dp(12), 0, dp(8))
        }
        root.addView(status)
        setContentView(wrapScroll(root))

        showPassword.setOnCheckedChangeListener { _, checked ->
            if (checked) {
                password.transformationMethod = null
                password.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            } else {
                password.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                password.transformationMethod = PasswordTransformationMethod.getInstance()
            }
            password.setSelection(password.text.length)
        }

        loginButton.setOnClickListener {
            val user = username.text.toString().trim().lowercase()
            val rawPass = password.text.toString()
            val pass = rawPass.trimEnd('\r', '\n')
            if (!user.matches(Regex("[a-z0-9._-]{1,64}")) || pass.isBlank()) {
                setStatus("Tên đăng nhập hoặc mật khẩu không hợp lệ.")
                return@setOnClickListener
            }
            loginButton.isEnabled = false
            setStatus("Đang đăng nhập...")
            Thread {
                try {
                    val session = api.login(user, pass)
                    runOnUiThread {
                        password.setText("")
                        renderHome(session)
                    }
                } catch (error: Exception) {
                    runOnUiThread {
                        loginButton.isEnabled = true
                        setStatus(friendlyError(error))
                    }
                }
            }.start()
        }

        updateButton.setOnClickListener { checkForUpdate(silent = false) }
    }

    private fun renderHome(session: AppSession) {
        withdrawButtons.clear()
        searchRunnable?.let { ui.removeCallbacks(it) }
        selectedSku = null

        val root = page()
        root.addView(TextView(this).apply {
            text = "SUPRA Inventory — Beta"
            textSize = 22f
            setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "${session.displayName} · ${session.employeeCode ?: "—"} · ${roleLabel(session.role)}"
            textSize = 13f
            setTextColor(Color.DKGRAY)
        })

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        updateButton = Button(this).apply {
            text = "Cập nhật"
            layoutParams = weightedParams()
            setOnClickListener { checkForUpdate(silent = false) }
        }
        val logout = Button(this).apply {
            text = "Đăng xuất"
            layoutParams = weightedParams()
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Đăng xuất?")
                    .setMessage("Phiên làm việc hiện tại sẽ kết thúc.")
                    .setNegativeButton("Huỷ", null)
                    .setPositiveButton("Đăng xuất") { _, _ ->
                        api.clearSession()
                        renderLogin("Đã đăng xuất.")
                    }
                    .show()
            }
        }
        actions.addView(updateButton)
        actions.addView(logout)
        root.addView(actions)

        status = TextView(this).apply {
            text = "Đã đăng nhập. Đang tải dữ liệu..."
            textSize = 13f
            setPadding(0, dp(8), 0, dp(8))
        }
        root.addView(status)

        when (session.role) {
            "PICKER" -> renderPicker(root)
            "REPORTER", "ADMIN", "ROOT" -> renderReporter(root, session.role)
            else -> root.addView(TextView(this).apply { text = "Vai trò ${session.role} chưa được hỗ trợ trên PDA." })
        }

        setContentView(wrapScroll(root))
    }

    private fun renderPicker(root: LinearLayout) {
        root.addView(sectionTitle("Báo SKU hết hàng"))
        root.addView(TextView(this).apply {
            text = "Nhập hoặc quét tối thiểu 3 ký tự. Gợi ý tìm trực tiếp trên catalog đã cache trong PDA."
            textSize = 13f
            setTextColor(Color.DKGRAY)
        })

        val catalogCard = card()
        catalogStatusView = TextView(this).apply { text = "Catalog: đang đọc cache local..." }
        val sync = Button(this).apply {
            text = "Đồng bộ Master SKU"
            setOnClickListener { syncSkuCatalog(auto = false) }
        }
        catalogCard.addView(catalogStatusView)
        catalogCard.addView(sync)
        root.addView(catalogCard)

        val reportCard = card()
        skuInput = EditText(this).apply {
            hint = "Nhập / quét SKU hoặc tên sản phẩm"
            isSingleLine = true
            imeOptions = EditorInfo.IME_ACTION_SEARCH
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        selectedSkuLabel = TextView(this).apply {
            text = "Chưa chọn SKU."
            setPadding(0, dp(8), 0, dp(8))
        }
        skuSuggestions = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        reportButton = Button(this).apply {
            text = "Báo hết hàng"
            isEnabled = false
            setOnClickListener { submitPickerReport() }
        }
        reportCard.addView(skuInput)
        reportCard.addView(selectedSkuLabel)
        reportCard.addView(skuSuggestions)
        reportCard.addView(reportButton)
        root.addView(reportCard)

        val reportsHeader = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        reportsHeader.addView(TextView(this).apply {
            text = "Báo của tôi"
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            layoutParams = weightedParams()
        })
        reportsHeader.addView(Button(this).apply {
            text = "Tải lại"
            setOnClickListener { refreshPickerReports() }
        })
        root.addView(reportsHeader)
        pickerReportsBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(pickerReportsBox)

        skuInput?.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val text = s?.toString().orEmpty()
                if (selectedSku?.sku != text.trim()) {
                    selectedSku = null
                    selectedSkuLabel?.text = "Chưa chọn SKU."
                    reportButton?.isEnabled = false
                }
                scheduleSkuSearch(text)
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
        skuInput?.setOnEditorActionListener { _, _, _ ->
            val exact = skuCache.exactSku(skuInput?.text?.toString().orEmpty())
            if (exact != null) {
                selectSku(exact)
                true
            } else {
                false
            }
        }

        syncSkuCatalog(auto = true)
        refreshPickerReports()
    }

    private fun syncSkuCatalog(auto: Boolean) {
        if (catalogSyncing) return
        catalogSyncing = true
        if (!auto) setStatus("Đang đồng bộ Master SKU...")
        Thread {
            try {
                if (skuCache.count == 0) {
                    val localCount = skuCache.loadLocal()
                    runOnUiThread {
                        catalogStatusView?.text = if (localCount > 0) {
                            "Catalog local: $localCount SKU. Đang kiểm tra phiên bản..."
                        } else {
                            "Chưa có catalog local. Đang tải từ service..."
                        }
                    }
                }
                val result = skuCache.sync(api) { loaded, total ->
                    runOnUiThread {
                        catalogStatusView?.text = "Đang tải catalog: $loaded/$total SKU"
                    }
                }
                runOnUiThread {
                    catalogSyncing = false
                    catalogStatusView?.text = "Catalog: ${result.count} SKU · ${if (result.updated) "vừa cập nhật" else "đã mới nhất"}"
                    if (!auto || result.updated) setStatus("Master SKU sẵn sàng trên PDA.")
                    val current = skuInput?.text?.toString().orEmpty()
                    if (current.trim().length >= 3) scheduleSkuSearch(current)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    catalogSyncing = false
                    catalogStatusView?.text = "Catalog local: ${skuCache.count} SKU · đồng bộ lỗi"
                    setStatus("${friendlyError(error)} Catalog cũ vẫn được giữ.")
                }
            }
        }.start()
    }

    private fun scheduleSkuSearch(raw: String) {
        searchRunnable?.let { ui.removeCallbacks(it) }
        val query = raw.trim()
        if (query.length < 3) {
            skuSuggestions?.removeAllViews()
            return
        }
        val generation = ++searchGeneration
        val task = Runnable {
            Thread {
                val results = skuCache.search(query, 20)
                runOnUiThread {
                    if (generation == searchGeneration) renderSkuSuggestions(results)
                }
            }.start()
        }
        searchRunnable = task
        ui.postDelayed(task, 180)
    }

    private fun renderSkuSuggestions(items: List<SkuItem>) {
        val box = skuSuggestions ?: return
        box.removeAllViews()
        if (items.isEmpty()) {
            box.addView(TextView(this).apply {
                text = if (skuCache.count == 0) "Chưa có catalog local. Hãy đồng bộ Master SKU." else "Không tìm thấy SKU phù hợp."
                setTextColor(Color.DKGRAY)
                setPadding(0, dp(6), 0, dp(6))
            })
            return
        }
        for (item in items) {
            box.addView(Button(this).apply {
                text = "${item.sku} — ${item.productName}"
                isAllCaps = false
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                setOnClickListener { selectSku(item) }
            })
        }
    }

    private fun selectSku(item: SkuItem) {
        selectedSku = item
        skuInput?.setText(item.sku)
        skuInput?.setSelection(item.sku.length)
        selectedSkuLabel?.text = "Đã chọn: ${item.sku}\n${item.productName}"
        reportButton?.isEnabled = true
        skuSuggestions?.removeAllViews()
    }

    private fun submitPickerReport() {
        val item = selectedSku ?: return
        reportButton?.isEnabled = false
        setStatus("Đang gửi báo ${item.sku}...")
        Thread {
            try {
                api.createPickerReport(item.sku)
                runOnUiThread {
                    selectedSku = null
                    skuInput?.setText("")
                    selectedSkuLabel?.text = "Chưa chọn SKU."
                    reportButton?.isEnabled = false
                    setStatus("Đã ghi nhận báo hết hàng ${item.sku}.")
                    refreshPickerReports()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    reportButton?.isEnabled = selectedSku != null
                    setStatus(friendlyError(error))
                }
            }
        }.start()
    }

    private fun refreshPickerReports() {
        if (pickerRefreshing) return
        pickerRefreshing = true
        Thread {
            try {
                val rows = api.getPickerReports(100)
                runOnUiThread {
                    pickerRefreshing = false
                    renderPickerReports(rows)
                    detectPickerResultChanges(rows)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    pickerRefreshing = false
                    setStatus(friendlyError(error))
                }
            }
        }.start()
    }

    private fun renderPickerReports(rows: List<PickerReport>) {
        val box = pickerReportsBox ?: return
        box.removeAllViews()
        withdrawButtons.clear()
        if (rows.isEmpty()) {
            box.addView(emptyState("Chưa có báo SKU nào."))
            return
        }
        for (row in rows) {
            val card = card()
            card.addView(TextView(this).apply {
                text = row.sku
                textSize = 18f
                setTypeface(typeface, Typeface.BOLD)
            })
            card.addView(TextView(this).apply {
                text = row.productName
                textSize = 14f
            })
            val businessStatus = pickerBusinessStatus(row)
            card.addView(TextView(this).apply {
                text = businessStatus
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(statusColor(businessStatus))
                setPadding(0, dp(5), 0, dp(5))
            })
            card.addView(TextView(this).apply {
                text = "Báo lúc ${fmtDate(row.reportedAt)}"
                textSize = 12f
                setTextColor(Color.DKGRAY)
            })

            if (businessStatus == "Đang xử lý" && row.status == "OPEN") {
                val deadline = parseMillis(row.withdrawDeadlineAt)
                val remaining = deadline - System.currentTimeMillis()
                if (remaining > 0) {
                    val withdraw = Button(this).apply {
                        text = "Nhấn giữ để thu hồi"
                        isAllCaps = false
                        setOnLongClickListener {
                            confirmWithdraw(row)
                            true
                        }
                    }
                    withdrawButtons[withdraw] = deadline
                    card.addView(withdraw)
                }
            }
            box.addView(card)
        }
    }

    private fun detectPickerResultChanges(rows: List<PickerReport>) {
        val next = mutableMapOf<String, String>()
        for (row in rows) {
            val state = pickerBusinessStatus(row)
            next[row.ticketId] = state
            if (pickerSnapshotReady) {
                val previous = pickerStatusSnapshot[row.ticketId]
                if (previous != state && (state == "Đã có hàng" || state == "Được skip")) {
                    resultAlerts.add("${row.sku} — ${row.productName}\nKết quả: $state")
                }
            }
        }
        pickerStatusSnapshot.clear()
        pickerStatusSnapshot.putAll(next)
        pickerSnapshotReady = true
        showNextResultAlert()
    }

    private fun showNextResultAlert() {
        if (resultAlertShowing || resultAlerts.isEmpty() || isFinishing) return
        resultAlertShowing = true
        val message = resultAlerts.removeFirst()
        AlertDialog.Builder(this)
            .setTitle("Kết quả báo hàng")
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("Xác nhận") { _, _ ->
                resultAlertShowing = false
                showNextResultAlert()
            }
            .show()
    }

    private fun confirmWithdraw(report: PickerReport) {
        AlertDialog.Builder(this)
            .setTitle("Thu hồi báo nhầm?")
            .setMessage("${report.sku} — ${report.productName}\nChỉ thực hiện được trong 60 giây và khi Reporter chưa xử lý.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Thu hồi") { _, _ ->
                setStatus("Đang thu hồi ${report.sku}...")
                Thread {
                    try {
                        api.withdrawPickerReport(report.ticketId)
                        runOnUiThread {
                            setStatus("Đã thu hồi ${report.sku}.")
                            refreshPickerReports()
                        }
                    } catch (error: Exception) {
                        runOnUiThread { setStatus(friendlyError(error)) }
                    }
                }.start()
            }
            .show()
    }

    private fun renderReporter(root: LinearLayout, role: String) {
        root.addView(sectionTitle("Điều phối Inventory"))
        root.addView(TextView(this).apply {
            text = "Ưu tiên: nhiều Picker bị ảnh hưởng hơn trước; bằng nhau thì báo đầu sớm hơn."
            textSize = 13f
            setTextColor(Color.DKGRAY)
        })
        if (role == "ADMIN" || role == "ROOT") {
            root.addView(TextView(this).apply {
                text = "PDA tập trung vận hành Reporter. Quản trị Master SKU / nhân sự thực hiện trên Website."
                textSize = 12f
                setTextColor(Color.parseColor("#6B7280"))
            })
        }

        root.addView(Button(this).apply {
            text = "Tải lại danh sách vận hành"
            setOnClickListener { refreshReporterData() }
        })

        root.addView(sectionTitle("Đang xử lý"))
        reporterQueueBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(reporterQueueBox)

        root.addView(sectionTitle("Kết quả gần đây"))
        reporterRecentBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(reporterRecentBox)

        refreshReporterData()
    }

    private fun refreshReporterData() {
        if (reporterRefreshing) return
        reporterRefreshing = true
        setStatus("Đang tải danh sách Reporter...")
        Thread {
            try {
                val queue = api.getReporterQueue(100)
                val recent = api.getReporterRecent(100)
                runOnUiThread {
                    reporterRefreshing = false
                    renderReporterQueue(queue)
                    renderReporterRecent(recent)
                    setStatus("Đã cập nhật vận hành: ${queue.size} đợt đang chờ.")
                }
            } catch (error: Exception) {
                runOnUiThread {
                    reporterRefreshing = false
                    setStatus(friendlyError(error))
                }
            }
        }.start()
    }

    private fun renderReporterQueue(rows: List<ReporterBatch>) {
        val box = reporterQueueBox ?: return
        box.removeAllViews()
        if (rows.isEmpty()) {
            box.addView(emptyState("Không có SKU đang chờ xử lý."))
            return
        }
        for (row in rows) {
            val card = card()
            card.addView(TextView(this).apply {
                text = row.sku
                textSize = 19f
                setTypeface(typeface, Typeface.BOLD)
            })
            card.addView(TextView(this).apply {
                text = row.productName
                textSize = 14f
            })
            card.addView(TextView(this).apply {
                text = "${row.affectedPickerCount} Picker · chờ ${ageLabel(row.firstReportAt)} · báo đầu ${fmtDate(row.firstReportAt)}"
                textSize = 12f
                setTextColor(Color.DKGRAY)
                setPadding(0, dp(4), 0, dp(6))
            })

            val actionRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            actionRow.addView(Button(this).apply {
                text = "Đã có hàng"
                layoutParams = weightedParams()
                setOnClickListener { confirmResolve(row, "HAS_STOCK") }
            })
            actionRow.addView(Button(this).apply {
                text = "Cho phép skip"
                layoutParams = weightedParams()
                setOnClickListener { confirmResolve(row, "SKIP_ALLOWED") }
            })
            card.addView(actionRow)
            card.addView(Button(this).apply {
                text = "Xem Picker liên quan"
                setOnClickListener { showBatchTickets(row) }
            })
            box.addView(card)
        }
    }

    private fun renderReporterRecent(rows: List<ReporterRecent>) {
        val box = reporterRecentBox ?: return
        box.removeAllViews()
        if (rows.isEmpty()) {
            box.addView(emptyState("Chưa có kết quả gần đây."))
            return
        }
        for (row in rows) {
            val card = card()
            card.addView(TextView(this).apply {
                text = "${row.sku} — ${row.productName}"
                textSize = 15f
                setTypeface(typeface, Typeface.BOLD)
            })
            val label = if (row.status == "HAS_STOCK") "Đã có hàng" else "Được skip"
            card.addView(TextView(this).apply {
                text = "$label · ${row.affectedPickerCount} Picker · ${fmtDate(row.resolvedAt)}"
                setTextColor(statusColor(label))
                textSize = 13f
            })
            val deadline = parseMillis(row.correctionDeadlineAt)
            if (row.status == "SKIP_ALLOWED" && deadline > System.currentTimeMillis()) {
                card.addView(Button(this).apply {
                    text = "Sửa thành Đã có hàng"
                    setOnClickListener { confirmCorrection(row) }
                })
                card.addView(TextView(this).apply {
                    text = "Hạn sửa ${fmtDate(row.correctionDeadlineAt)}"
                    textSize = 11f
                    setTextColor(Color.DKGRAY)
                })
            }
            box.addView(card)
        }
    }

    private fun confirmResolve(batch: ReporterBatch, resolution: String) {
        val label = if (resolution == "HAS_STOCK") "Đã có hàng" else "Cho phép skip"
        AlertDialog.Builder(this)
            .setTitle("Xác nhận $label?")
            .setMessage("${batch.sku} — ${batch.productName}\n${batch.affectedPickerCount} Picker đang chờ.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ ->
                setStatus("Đang cập nhật ${batch.sku}...")
                Thread {
                    try {
                        api.resolveBatch(batch.batchId, resolution)
                        runOnUiThread {
                            setStatus("Đã xử lý ${batch.sku}: $label.")
                            refreshReporterData()
                        }
                    } catch (error: Exception) {
                        runOnUiThread {
                            setStatus(friendlyError(error))
                            refreshReporterData()
                        }
                    }
                }.start()
            }
            .show()
    }

    private fun confirmCorrection(batch: ReporterRecent) {
        AlertDialog.Builder(this)
            .setTitle("Sửa kết quả thành Đã có hàng?")
            .setMessage("${batch.sku} — ${batch.productName}\nLịch sử Skip ban đầu vẫn được giữ.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận") { _, _ ->
                Thread {
                    try {
                        api.correctBatch(batch.batchId)
                        runOnUiThread {
                            setStatus("Đã sửa ${batch.sku} thành Đã có hàng.")
                            refreshReporterData()
                        }
                    } catch (error: Exception) {
                        runOnUiThread {
                            setStatus(friendlyError(error))
                            refreshReporterData()
                        }
                    }
                }.start()
            }
            .show()
    }

    private fun showBatchTickets(batch: ReporterBatch) {
        setStatus("Đang tải Picker của ${batch.sku}...")
        Thread {
            try {
                val tickets = api.getBatchTickets(batch.batchId)
                runOnUiThread {
                    val text = if (tickets.isEmpty()) {
                        "Không có Picker trong batch."
                    } else {
                        tickets.joinToString("\n\n") {
                            "${it.pickerEmployeeCode} — ${it.pickerDisplayName.ifBlank { "Chưa có tên" }}\nBáo ${fmtDate(it.reportedAt)} · ${ticketStatusLabel(it.status)}"
                        }
                    }
                    val scroll = ScrollView(this).apply {
                        addView(TextView(this@MainActivity).apply {
                            this.text = text
                            textSize = 14f
                            setPadding(dp(18), dp(8), dp(18), dp(8))
                        })
                    }
                    AlertDialog.Builder(this)
                        .setTitle("${batch.sku} · ${tickets.size} Picker")
                        .setView(scroll)
                        .setPositiveButton("Đóng", null)
                        .show()
                    setStatus("Đã tải chi tiết ${batch.sku}.")
                }
            } catch (error: Exception) {
                runOnUiThread { setStatus(friendlyError(error)) }
            }
        }.start()
    }

    private fun pickerBusinessStatus(row: PickerReport): String = when {
        row.status == "WITHDRAWN" || row.batchStatus == "CLOSED" -> "Picker thu hồi"
        row.resolution == "HAS_STOCK" || row.batchStatus == "HAS_STOCK" -> "Đã có hàng"
        row.resolution == "SKIP_ALLOWED" || row.batchStatus == "SKIP_ALLOWED" -> "Được skip"
        else -> "Đang xử lý"
    }

    private fun ticketStatusLabel(value: String): String = when (value) {
        "OPEN" -> "Đang xử lý"
        "WITHDRAWN" -> "Picker thu hồi"
        "RESOLVED" -> "Đã xử lý"
        else -> value
    }

    private fun friendlyError(error: Exception): String {
        if (error is ApiException) {
            return when (error.code) {
                "ALREADY_REPORTED" -> "SKU này đang có báo chưa xử lý của bạn."
                "SKU_NOT_FOUND" -> "SKU không tồn tại trong Master SKU."
                "WITHDRAW_WINDOW_EXPIRED" -> "Đã hết 60 giây cho phép thu hồi."
                "TICKET_NOT_OPEN" -> "Báo này đã được xử lý hoặc thu hồi."
                "BATCH_NOT_PENDING" -> "Đợt này đã được người khác xử lý."
                "CORRECTION_WINDOW_EXPIRED" -> "Đã hết 5 phút cho phép sửa Skip."
                "BATCH_NOT_CORRECTABLE" -> "Đợt này không còn ở trạng thái cho phép sửa."
                "USER_NOT_ACTIVE" -> "Tài khoản đã dừng hoạt động."
                "FORBIDDEN" -> "Tài khoản không có quyền thực hiện thao tác này."
                "AUTH_REQUIRED", "INVALID_AUTH_TOKEN", "SESSION_REFRESH_FAILED" -> "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
                else -> error.message
            }
        }
        return error.message ?: "Có lỗi không xác định."
    }

    private fun setStatus(message: String) {
        if (::status.isInitialized) status.text = message
    }

    private fun roleLabel(role: String): String = when (role) {
        "PICKER" -> "Picker"
        "REPORTER" -> "Reporter"
        "ADMIN" -> "Admin"
        "ROOT" -> "Root"
        else -> role
    }

    private fun statusColor(label: String): Int = when (label) {
        "Đã có hàng" -> Color.parseColor("#047857")
        "Được skip" -> Color.parseColor("#B45309")
        "Picker thu hồi" -> Color.parseColor("#6B7280")
        else -> Color.parseColor("#1D4ED8")
    }

    private fun fmtDate(value: String?): String {
        if (value.isNullOrBlank()) return "—"
        return try {
            dateFormatter.format(Instant.parse(value))
        } catch (_: Exception) {
            value
        }
    }

    private fun parseMillis(value: String?): Long {
        if (value.isNullOrBlank()) return 0L
        return try {
            Instant.parse(value).toEpochMilli()
        } catch (_: Exception) {
            0L
        }
    }

    private fun ageLabel(value: String): String {
        val at = parseMillis(value)
        if (at <= 0) return "—"
        val minutes = max(0L, (System.currentTimeMillis() - at) / 60_000L)
        if (minutes < 1) return "< 1 phút"
        if (minutes < 60) return "$minutes phút"
        return "${minutes / 60}h ${minutes % 60}m"
    }

    private fun page(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(24), dp(18), dp(30))
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun wrapScroll(content: View): ScrollView = ScrollView(this).apply {
        isFillViewport = true
        addView(content)
    }

    private fun sectionTitle(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 20f
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(16), 0, dp(8))
    }

    private fun emptyState(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 13f
        setTextColor(Color.DKGRAY)
        setPadding(dp(12), dp(16), dp(12), dp(16))
    }

    private fun card(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(12), dp(14), dp(12))
        background = GradientDrawable().apply {
            setColor(Color.WHITE)
            cornerRadius = dp(12).toFloat()
            setStroke(dp(1), Color.parseColor("#E5E7EB"))
        }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply {
            topMargin = dp(8)
            bottomMargin = dp(4)
        }
    }

    private fun weightedParams(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = dp(4)
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun renderFatal(message: String) {
        val root = page()
        root.addView(TextView(this).apply {
            text = "SUPRA Inventory — Beta"
            textSize = 24f
            setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = message
            setTextColor(Color.RED)
            setPadding(0, dp(12), 0, 0)
        })
        setContentView(wrapScroll(root))
    }

    private data class UpdateInfo(
        val versionCode: Int,
        val tag: String,
        val apkUrl: String,
        val checksumUrl: String,
    )

    private fun checkForUpdate(silent: Boolean) {
        if (!::updateButton.isInitialized) return
        updateButton.isEnabled = false
        if (!silent) setStatus("Đang kiểm tra phiên bản mới...")
        Thread {
            try {
                val info = fetchLatestUpdate()
                if (info == null || info.versionCode <= BuildConfig.VERSION_CODE) {
                    runOnUiThread {
                        updateButton.isEnabled = true
                        if (!silent) setStatus("Đang dùng bản mới nhất.")
                    }
                    return@Thread
                }
                runOnUiThread { setStatus("Có bản mới ${info.tag}. Đang tải và kiểm tra SHA-256...") }
                val apk = downloadAndVerify(info)
                runOnUiThread {
                    updateButton.isEnabled = true
                    requestInstall(apk)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    updateButton.isEnabled = true
                    if (!silent) setStatus("Không kiểm tra được cập nhật: ${error.message ?: "unknown"}")
                }
            }
        }.start()
    }

    private fun fetchLatestUpdate(): UpdateInfo? {
        val connection = openDownloadConnection(BuildConfig.UPDATE_RELEASE_API)
        val code = connection.responseCode
        if (code == 404) return null
        val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (code !in 200..299) throw IllegalStateException("Update API HTTP $code")
        val release = org.json.JSONObject(text)
        val tag = release.optString("tag_name")
        val versionCode = Regex("^beta-vc(\\d+)$").find(tag)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: return null
        val assets = release.optJSONArray("assets") ?: return null
        var apkUrl = ""
        var checksumUrl = ""
        for (index in 0 until assets.length()) {
            val asset = assets.optJSONObject(index) ?: continue
            when (asset.optString("name")) {
                "supra-inventory-beta.apk" -> apkUrl = asset.optString("browser_download_url")
                "supra-inventory-beta.apk.sha256" -> checksumUrl = asset.optString("browser_download_url")
            }
        }
        if (apkUrl.isBlank() || checksumUrl.isBlank()) return null
        return UpdateInfo(versionCode, tag, apkUrl, checksumUrl)
    }

    private fun downloadAndVerify(info: UpdateInfo): File {
        val expected = downloadText(info.checksumUrl).trim().split(Regex("\\s+"))[0].lowercase()
        if (!expected.matches(Regex("[0-9a-f]{64}"))) throw IllegalStateException("Checksum bản cập nhật không hợp lệ.")
        val dir = File(getExternalFilesDir(null), "updates").apply { mkdirs() }
        val temp = File(dir, "supra-inventory-beta.apk.download")
        val target = File(dir, "supra-inventory-beta.apk")
        downloadFile(info.apkUrl, temp)
        val actual = sha256(temp)
        if (actual != expected) {
            temp.delete()
            throw IllegalStateException("SHA-256 APK không khớp.")
        }
        if (target.exists()) target.delete()
        if (!temp.renameTo(target)) {
            temp.copyTo(target, overwrite = true)
            temp.delete()
        }
        return target
    }

    private fun requestInstall(apk: File) {
        if (!packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = apk
            setStatus("Cần cấp quyền cài ứng dụng không rõ nguồn gốc một lần cho SUPRA Inventory Beta.")
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            return
        }
        launchInstaller(apk)
    }

    private fun launchInstaller(apk: File) {
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        setStatus("Đã tải xong. Đang mở trình cài bản cập nhật...")
        startActivity(intent)
    }

    private fun openDownloadConnection(url: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 60_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
        }

    private fun downloadText(url: String): String {
        val connection = openDownloadConnection(url)
        if (connection.responseCode !in 200..299) throw IllegalStateException("Checksum HTTP ${connection.responseCode}")
        return connection.inputStream.bufferedReader().use { it.readText() }
    }

    private fun downloadFile(url: String, file: File) {
        val connection = openDownloadConnection(url)
        if (connection.responseCode !in 200..299) throw IllegalStateException("APK HTTP ${connection.responseCode}")
        connection.inputStream.use { input ->
            file.outputStream().use { output -> input.copyTo(output, 64 * 1024) }
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
