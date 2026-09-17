package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.WeakHashMap

class InventoryApplication : Application(), Application.ActivityLifecycleCallbacks {
    private val footerText = "Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291"
    private val styledContentRoots = WeakHashMap<Activity, View?>()
    @Volatile private var updateGate = UpdateGate.CHECKING
    @Volatile private var updateCheckRunning = false
    @Volatile private var lastUpdateCheckAt = 0L

    private enum class UpdateGate { CHECKING, CURRENT, REQUIRED, FAILED }

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        val decor = activity.window.decorView
        decor.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> applyIfContentChanged(activity) }
        decor.post { applyIfContentChanged(activity, force = true) }
        startVersionGate(activity, force = false)
    }

    override fun onActivityResumed(activity: Activity) {
        activity.window.decorView.post { applyIfContentChanged(activity, force = true) }
        if (updateGate == UpdateGate.FAILED && System.currentTimeMillis() - lastUpdateCheckAt >= 5_000L) {
            startVersionGate(activity, force = true)
        }
    }

    private fun applyIfContentChanged(activity: Activity, force: Boolean = false) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
        val currentRoot = content.getChildAt(0)
        if (!force && styledContentRoots[activity] === currentRoot) return
        styledContentRoots[activity] = currentRoot
        applyOperationalUi(activity)
    }

    private fun startVersionGate(activity: Activity, force: Boolean) {
        if (updateCheckRunning) return
        if (!force && updateGate != UpdateGate.CHECKING) return
        updateCheckRunning = true
        lastUpdateCheckAt = System.currentTimeMillis()
        Thread {
            updateGate = try {
                val connection = (URL(BuildConfig.UPDATE_RELEASE_API).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10_000
                    readTimeout = 20_000
                    instanceFollowRedirects = true
                    setRequestProperty("Accept", "application/vnd.github+json")
                    setRequestProperty("User-Agent", "SUPRA-Inventory-Beta/${BuildConfig.VERSION_NAME}")
                }
                val code = connection.responseCode
                val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                connection.disconnect()
                if (code !in 200..299) throw IllegalStateException("HTTP $code")
                val tag = JSONObject(text).optString("tag_name")
                val latest = Regex("^beta-vc(\\d+)$").find(tag)?.groupValues?.getOrNull(1)?.toIntOrNull()
                    ?: throw IllegalStateException("release_tag_invalid")
                if (latest > BuildConfig.VERSION_CODE) UpdateGate.REQUIRED else UpdateGate.CURRENT
            } catch (_: Exception) {
                UpdateGate.FAILED
            }
            updateCheckRunning = false
            activity.runOnUiThread { applyIfContentChanged(activity, force = true) }
        }.start()
    }

    private fun applyOperationalUi(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
        styleTree(content, activity)
        injectFooter(content, activity)
    }

    private fun styleTree(view: View, activity: Activity) {
        if (view is TextView) {
            val current = view.text?.toString().orEmpty()

            if (current == "Đang dùng bản mới nhất.") updateGate = UpdateGate.CURRENT

            val updated = current
                .replace("MNV / tên đăng nhập", "Mã nhân viên / tên đăng nhập")
                .replace("Điều phối Inventory", "Hàng chờ xử lý")
                .replace("Báo hết hàng", "Báo SKU hết hàng")
                .replace("Báo của tôi", "Lịch sử báo hàng")
                .replace("Kết quả gần đây", "Kết quả xử lý gần đây")
                .replace("Tải lại danh sách vận hành", "Làm mới hàng chờ xử lý")
                .replace("Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291", footerText)
            if (updated != current) view.text = updated

            if (view is EditText) {
                val hint = view.hint?.toString().orEmpty()
                val nextHint = hint
                    .replace("MNV / tên đăng nhập", "Mã nhân viên / tên đăng nhập")
                    .replace("MNV", "Mã nhân viên")
                if (nextHint != hint) view.hint = nextHint
            }

            val text = view.text?.toString().orEmpty()
            if (text.startsWith("Phiên bản ") && text.contains("Android 11+")) {
                view.visibility = View.GONE
            }
            if (
                text.startsWith("Nhập hoặc quét tối thiểu 3 ký tự") ||
                text.startsWith("Ưu tiên: nhiều Picker bị ảnh hưởng hơn trước") ||
                text.startsWith("PDA tập trung vận hành Reporter")
            ) {
                view.visibility = View.GONE
            }

            val family = if (view.textSize / resources.displayMetrics.scaledDensity >= 18f) "sans-serif-medium" else "sans-serif"
            val style = if (view.typeface?.isBold == true) Typeface.BOLD else Typeface.NORMAL
            view.typeface = Typeface.create(family, style)

            if (current == "SI" && view.compoundDrawables[0] == null) {
                view.text = ""
                ContextCompat.getDrawable(activity, R.drawable.ic_inventory_alert)?.let { icon ->
                    val size = dp(30)
                    icon.setBounds(0, 0, size, size)
                    view.setCompoundDrawables(icon, null, null, null)
                }
            }

            if (view is Button && view.text?.toString() == "Đăng nhập") {
                when (updateGate) {
                    UpdateGate.CURRENT -> {
                        if (view.tag == "update-gate") {
                            view.tag = null
                            view.isEnabled = true
                            view.alpha = 1f
                        }
                    }
                    else -> {
                        view.tag = "update-gate"
                        view.isEnabled = false
                        view.alpha = 0.55f
                    }
                }
            }

            if (text == "Sẵn sàng đăng nhập Beta." || text == "Đang kiểm tra phiên bản..." || text.startsWith("Chưa xác minh được phiên bản")) {
                when (updateGate) {
                    UpdateGate.CHECKING -> view.text = "Đang kiểm tra phiên bản..."
                    UpdateGate.REQUIRED -> view.text = "Có bản cập nhật mới. Cần cập nhật trước khi đăng nhập."
                    UpdateGate.FAILED -> view.text = "Chưa xác minh được phiên bản. Hãy kiểm tra kết nối và thử lại cập nhật."
                    UpdateGate.CURRENT -> view.text = "Sẵn sàng đăng nhập."
                }
            }
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) styleTree(view.getChildAt(index), activity)
        }
    }

    private fun injectFooter(content: ViewGroup, activity: Activity) {
        val scroll = findScrollView(content) ?: return
        val root = scroll.getChildAt(0) as? LinearLayout ?: return
        for (index in 0 until root.childCount) {
            val child = root.getChildAt(index)
            if (child is TextView) {
                val text = child.text?.toString().orEmpty()
                if (text == footerText) return
                if (text.startsWith("Phát triển và duy trì bởi:")) {
                    child.text = footerText
                    return
                }
            }
        }
        root.addView(TextView(activity).apply {
            text = footerText
            textSize = 10f
            gravity = Gravity.CENTER
            setTextColor(0xFF78877F.toInt())
            setPadding(dp(8), dp(14), dp(8), dp(8))
            typeface = Typeface.create("sans-serif", Typeface.NORMAL)
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    private fun findScrollView(view: View): ScrollView? {
        if (view is ScrollView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                findScrollView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) {
        styledContentRoots.remove(activity)
    }
}
