package cd.cc.supra.inventory.beta

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat

class InventoryApplication : Application(), Application.ActivityLifecycleCallbacks {
    private val footerText = "Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291"

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        val decor = activity.window.decorView
        decor.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> applyOperationalUi(activity) }
        decor.post { applyOperationalUi(activity) }
    }

    override fun onActivityResumed(activity: Activity) {
        activity.window.decorView.post { applyOperationalUi(activity) }
    }

    private fun applyOperationalUi(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
        styleTree(content, activity)
        injectFooter(content, activity)
    }

    private fun styleTree(view: View, activity: Activity) {
        if (view is TextView) {
            val current = view.text?.toString().orEmpty()
            val updated = current
                .replace("MNV / tên đăng nhập", "Mã nhân viên / tên đăng nhập")
                .replace("Điều phối Inventory", "Hàng chờ xử lý")
                .replace("Báo của tôi", "Lịch sử báo hàng")
                .replace("Kết quả gần đây", "Kết quả xử lý gần đây")
                .replace("Tải lại danh sách vận hành", "Làm mới hàng chờ xử lý")
            if (updated != current) view.text = updated

            if (view is EditText) {
                val hint = view.hint?.toString().orEmpty()
                val nextHint = hint
                    .replace("MNV / tên đăng nhập", "Mã nhân viên / tên đăng nhập")
                    .replace("MNV", "Mã nhân viên")
                if (nextHint != hint) view.hint = nextHint
            }

            val family = if (view.textSize / resources.displayMetrics.scaledDensity >= 18f) "sans-serif-medium" else "sans-serif"
            val style = if (view.typeface?.isBold == true) Typeface.BOLD else Typeface.NORMAL
            view.typeface = Typeface.create(family, style)

            if (current.startsWith("SUPRA Inventory") && view.compoundDrawables[0] == null) {
                ContextCompat.getDrawable(activity, R.drawable.ic_inventory_alert)?.let { icon ->
                    val size = dp(22)
                    icon.setBounds(0, 0, size, size)
                    view.compoundDrawablePadding = dp(7)
                    view.setCompoundDrawables(icon, null, null, null)
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
            if (child is TextView && child.text?.toString() == footerText) return
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
    override fun onActivityDestroyed(activity: Activity) = Unit
}
