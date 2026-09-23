package cd.cc.supra.inventory.beta

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.util.TypedValue
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class InventoryUi(private val activity: Activity) {
    val navy = Color.parseColor("#082A4A")
    val navyMid = Color.parseColor("#0B4A75")
    val green = Color.parseColor("#118D57")
    val greenDark = Color.parseColor("#0B6842")
    val greenSoft = Color.parseColor("#E8F5EE")
    val surface = Color.parseColor("#F4F7FA")
    val line = Color.parseColor("#DCE4EB")
    val lineStrong = Color.parseColor("#B8C5D1")
    val text = Color.parseColor("#172334")
    val muted = Color.parseColor("#607184")
    val orange = Color.parseColor("#A45B00")
    val orangeSoft = Color.parseColor("#FFF4D6")
    val red = Color.parseColor("#D92D20")
    val redStrong = Color.parseColor("#D92D20")
    val redSoft = Color.parseColor("#FDECEC")
    val graySoft = Color.parseColor("#F8FAFC")
    val blue = Color.parseColor("#1D63D4")
    val blueSoft = Color.parseColor("#EAF2FF")
    val pendingFill = Color.parseColor("#FFF4D6")
    val pendingStroke = Color.parseColor("#FFB000")
    val stockFill = Color.parseColor("#E8F5EE")
    val stockStroke = Color.parseColor("#8FD0A8")
    val skipFill = Color.parseColor("#FDECEC")
    val skipStroke = Color.parseColor("#F1A5A5")

    private val compactPda = activity.resources.configuration.screenWidthDp <= 380

    fun dp(value: Int): Int = (value * activity.resources.displayMetrics.density).toInt()

    fun rounded(fill: Int, stroke: Int = line, radiusDp: Int = 10): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = dp(radiusDp).toFloat()
            setStroke(dp(1), stroke)
        }

    fun page(): LinearLayout = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        val horizontal = if (compactPda) 10 else 12
        setPadding(dp(horizontal), dp(10), dp(horizontal), dp(24))
        setBackgroundColor(surface)
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    fun wrapScroll(content: View): ScrollView = ScrollView(activity).apply {
        isFillViewport = true
        setBackgroundColor(surface)
        addView(content)
    }

    fun card(fill: Int = Color.WHITE, stroke: Int = line, radiusDp: Int = 7): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(13), dp(14), dp(13))
            background = rounded(fill, stroke, radiusDp)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dp(6)
                bottomMargin = dp(6)
            }
        }

    fun title(value: String, size: Float = 19f): TextView = TextView(activity).apply {
        text = value
        textSize = size
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(this@InventoryUi.text)
    }

    fun muted(value: String, size: Float = 12f): TextView = TextView(activity).apply {
        text = value
        textSize = size
        setTextColor(this@InventoryUi.muted)
    }

    fun styleInput(input: EditText) {
        input.minHeight = dp(52)
        input.textSize = if (compactPda) 15f else 16f
        input.setTextColor(text)
        input.setHintTextColor(muted)
        input.background = rounded(Color.WHITE, lineStrong, 10)
        input.setPadding(dp(14), dp(10), dp(14), dp(10))
    }

    fun stylePrimary(button: Button) = styleButton(button, navyMid, Color.WHITE, navyMid)
    fun styleSuccess(button: Button) = styleButton(button, green, Color.WHITE, green)
    fun styleDanger(button: Button) = styleButton(button, red, Color.WHITE, red)
    fun styleSecondary(button: Button) = styleButton(button, Color.WHITE, navy, lineStrong)
    fun styleWarning(button: Button) = styleButton(button, orangeSoft, orange, Color.parseColor("#EBC56E"))

    private fun styleButton(button: Button, fill: Int, textColor: Int, stroke: Int) {
        button.isAllCaps = false
        button.minHeight = dp(48)
        button.minimumWidth = 0
        button.setTextColor(textColor)
        button.background = rounded(fill, stroke, 12)
        button.setPadding(dp(12), dp(9), dp(12), dp(9))
    }

    fun addBrandHeader(root: LinearLayout, subtitle: String) {
        root.addView(LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(12), 0, dp(8))
            addView(ImageView(activity).apply {
                setImageResource(R.drawable.app_icon_d089)
                scaleType = ImageView.ScaleType.CENTER_INSIDE
                contentDescription = "BÁO HÀNG 1291"
                layoutParams = LinearLayout.LayoutParams(dp(76), dp(76))
            })
            addView(TextView(activity).apply {
                text = "BÁO HÀNG 1291"
                textSize = 23f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(navy)
                setPadding(0, dp(10), 0, 0)
            })
            addView(TextView(activity).apply {
                text = subtitle
                textSize = 14f
                setTextColor(muted)
                setPadding(0, dp(3), 0, 0)
            })
        })
    }

    fun addOperationalHeader(
        root: LinearLayout,
        session: AppSession,
        onLog: () -> Unit,
        onExit: () -> Unit,
    ) {
        val header = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), 0, dp(10), 0)
            setBackgroundColor(navy)
            minimumHeight = dp(76)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(76))
        }

        header.addView(ImageView(activity).apply {
            setImageResource(R.drawable.app_icon_d089)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            contentDescription = "BÁO HÀNG 1291"
            layoutParams = LinearLayout.LayoutParams(dp(34), dp(34)).apply { marginEnd = dp(9) }
        })

        header.addView(LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            addView(TextView(activity).apply {
                text = "BÁO HÀNG 1291"
                textSize = 15f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(Color.WHITE)
                maxLines = 1
            })
            addView(TextView(activity).apply {
                text = "${session.employeeCode ?: "—"} - ${session.displayName} · ${roleLabel(session.role)}"
                textSize = 11f
                setTextColor(Color.parseColor("#C9DFEE"))
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                setPadding(0, dp(3), dp(4), 0)
            })
        })

        header.addView(LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(dp(98), ViewGroup.LayoutParams.MATCH_PARENT)
            addView(LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                addView(headerUtility("Log", onLog))
                addView(headerUtility("Thoát", onExit))
            })
            addView(TextView(activity).apply {
                text = "Beta vc${BuildConfig.VERSION_CODE}"
                textSize = 9.5f
                gravity = Gravity.CENTER
                setTextColor(Color.parseColor("#C9DFEE"))
                setPadding(0, dp(2), 0, 0)
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(22))
            })
        })
        root.addView(header)
    }

    private fun headerUtility(label: String, action: () -> Unit): TextView = TextView(activity).apply {
        text = label
        textSize = 11f
        gravity = Gravity.CENTER
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(Color.WHITE)
        layoutParams = LinearLayout.LayoutParams(0, dp(38), 1f)
        setOnClickListener { action() }
    }

    fun addFooter(root: LinearLayout) {
        root.addView(TextView(activity).apply {
            text = "Phát triển hệ thống · tamnv2 | Pick Pack 1291"
            textSize = 9f
            maxLines = 1
            setAutoSizeTextTypeUniformWithConfiguration(7, 10, 1, TypedValue.COMPLEX_UNIT_SP)
            gravity = Gravity.CENTER
            setTextColor(muted)
            setPadding(dp(6), dp(16), dp(6), dp(2))
        })
    }

    fun createStatusView(message: String = "", visible: Boolean = false): TextView = TextView(activity).apply {
        text = message
        textSize = 11.5f
        visibility = if (visible) View.VISIBLE else View.GONE
        setPadding(dp(10), dp(8), dp(10), dp(8))
        background = rounded(blueSoft, Color.parseColor("#BFD2F5"), 8)
        setTextColor(navyMid)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(7)
        }
    }

    fun roleLabel(role: String): String = when (role) {
        "PICKER" -> "Picker"
        "REPORTER" -> "Reporter"
        "ADMIN" -> "Admin"
        "ROOT" -> "Root"
        else -> role
    }
}
