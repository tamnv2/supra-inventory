package cd.cc.supra.inventory.beta

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.graphics.Typeface
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AdminLauncherController(
    private val activity: Activity,
    private val session: AppSession,
    private val kit: InventoryUi,
    private val setStatus: (String) -> Unit,
    private val onOpenOperations: () -> Unit,
    private val onOpenResults: () -> Unit,
    private val onOpenLog: () -> Unit,
    private val onCheckUpdate: () -> Unit,
) {
    fun render(root: LinearLayout) {
        section(root, "Vận hành")
        root.addView(action("Hàng chờ xử lý", "Mở luồng Reporter realtime") {
            onOpenOperations()
        })
        root.addView(action("Kết quả gần đây", "Xem kết quả xử lý và ACK") {
            onOpenResults()
        })

        section(root, "Quản trị")
        root.addView(action("Nhân sự / Picker", "Quản lý sâu trên Web") { openWeb("/#hr", "Nhân sự / Picker") })
        root.addView(action("Tài khoản", if (session.role == "ROOT") "Admin / Reporter" else "Reporter") { openWeb("/#users", "Tài khoản") })
        root.addView(action("Master SKU", "Theo dõi và cập nhật trên Web") { openWeb("/#sku", "Master SKU") })
        root.addView(action("SLA / Cấu hình", "Thiết lập nghiệp vụ trên Web") { openWeb("/#sla", "SLA / Cấu hình") })

        section(root, "Hệ thống")
        root.addView(action("Trạng thái dịch vụ", "Kiểm tra dịch vụ Beta") {
            openWeb("/health", "Trạng thái dịch vụ")
        })
        root.addView(action("Log / Chẩn đoán", "Xem log phiên làm việc") { onOpenLog() })
        root.addView(action("Cập nhật", "Kiểm tra bản Beta mới nhất") { onCheckUpdate() })
    }

    private fun section(root: LinearLayout, label: String) {
        root.addView(TextView(activity).apply {
            text = label
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(kit.text)
            setPadding(kit.dp(2), kit.dp(14), kit.dp(2), kit.dp(4))
        })
    }

    private fun action(title: String, subtitle: String, onClick: () -> Unit): Button = Button(activity).apply {
        text = "$title\n$subtitle"
        textSize = 13f
        isAllCaps = false
        setTypeface(typeface, Typeface.BOLD)
        gravity = android.view.Gravity.START or android.view.Gravity.CENTER_VERTICAL
        kit.styleSecondary(this)
        minHeight = kit.dp(62)
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = kit.dp(5) }
        setOnClickListener { onClick() }
    }

    private fun openWeb(path: String, label: String) {
        try {
            val base = BuildConfig.API_BASE_URL.trimEnd('/')
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("$base$path")))
            setStatus("Đã mở $label trên Web.")
        } catch (_: Exception) {
            setStatus("Không thể mở $label trên Web.")
        }
    }
}
