package cd.cc.supra.inventory.beta

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
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
    val green = Color.parseColor("#087443")
    val greenDark = Color.parseColor("#0B4D32")
    val greenSoft = Color.parseColor("#E7F6EA")
    val surface = Color.parseColor("#F4F7F8")
    val line = Color.parseColor("#D9E1E5")
    val text = Color.parseColor("#0B1B33")
    val muted = Color.parseColor("#667085")
    val orange = Color.parseColor("#9A6700")
    val orangeSoft = Color.parseColor("#FFF5CC")
    val red = Color.parseColor("#C51D34")
    val redStrong = Color.parseColor("#E54857")
    val redSoft = Color.parseColor("#FDE7E9")
    val graySoft = Color.parseColor("#EEF2F4")
    val blue = Color.parseColor("#175CD3")
    val blueSoft = Color.parseColor("#E8F1FF")
    val pendingFill = Color.parseColor("#FFF8CF")
    val pendingStroke = Color.parseColor("#F4CA32")
    val stockFill = Color.parseColor("#E9F8E8")
    val stockStroke = Color.parseColor("#8AD187")
    val skipFill = Color.parseColor("#FDE7E9")
    val skipStroke = Color.parseColor("#F3A2AA")

    private val compactPda = activity.resources.configuration.screenWidthDp <= 380

    fun dp(value: Int): Int = (value * activity.resources.displayMetrics.density).toInt()

    fun rounded(fill: Int, stroke: Int = line, radiusDp: Int = 12): GradientDrawable =
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

    fun card(fill: Int = Color.WHITE, stroke: Int = line, radiusDp: Int = 12): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(13), dp(12), dp(13), dp(12))
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
        input.minHeight = dp(54)
        input.textSize = if (compactPda) 14f else 15f
        input.setTextColor(text)
        input.setHintTextColor(Color.parseColor("#84928A"))
        input.background = rounded(Color.WHITE, Color.parseColor("#C7D2D9"), 10)
        input.setPadding(dp(12), dp(8), dp(12), dp(8))
    }

    fun stylePrimary(button: Button) = styleButton(button, green, Color.WHITE, green)
    fun styleDanger(button: Button) = styleButton(button, redStrong, Color.WHITE, redStrong)
    fun styleSecondary(button: Button) = styleButton(button, Color.WHITE, text, line)
    fun styleWarning(button: Button) = styleButton(button, orangeSoft, orange, Color.parseColor("#EBC56E"))

    private fun styleButton(button: Button, fill: Int, textColor: Int, stroke: Int) {
        button.isAllCaps = false
        button.minHeight = dp(48)
        button.minimumWidth = 0
        button.setTextColor(textColor)
        button.background = rounded(fill, stroke, 10)
        button.setPadding(dp(8), dp(7), dp(8), dp(7))
    }

    fun addBrandHeader(root: LinearLayout, subtitle: String) {
        val row = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(12))
        }
        row.addView(ImageView(activity).apply {
            setImageResource(R.drawable.ic_inventory_alert)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            contentDescription = "SUPRA Inventory"
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)).apply { marginEnd = dp(10) }
        })
        row.addView(LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            addView(title("SUPRA Inventory", 21f).apply {
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
            })
            addView(TextView(activity).apply {
                text = subtitle
                textSize = 12f
                maxLines = 1
                setTextColor(green)
            })
        })
        root.addView(row)
    }

    fun addOperationalHeader(
        root: LinearLayout,
        session: AppSession,
        onLog: () -> Unit,
        onExit: () -> Unit,
    ) {
        val header = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(9), dp(10), dp(9))
            background = rounded(Color.WHITE, line, 12)
        }

        val titleRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        titleRow.addView(title("BÁO HÀNG 1291", if (compactPda) 19f else 21f).apply {
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(6)
            }
        })
        titleRow.addView(LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            addView(utility("Log", onLog))
            addView(utility("Thoát", onExit))
        })
        header.addView(titleRow)

        val identityRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(6), 0, 0)
        }
        identityRow.addView(TextView(activity).apply {
            text = "${session.employeeCode ?: "—"} - ${session.displayName}"
            textSize = if (compactPda) 12.5f else 13.5f
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setTextColor(this@InventoryUi.text)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(6)
            }
        })
        identityRow.addView(TextView(activity).apply {
            text = roleLabel(session.role)
            textSize = 11.5f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(this@InventoryUi.text)
            setPadding(dp(3), dp(3), dp(5), dp(3))
        })
        identityRow.addView(TextView(activity).apply {
            text = "Beta vc${BuildConfig.VERSION_CODE}"
            textSize = 10.5f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(blue)
            setPadding(dp(7), dp(3), dp(7), dp(3))
            background = rounded(blueSoft, Color.parseColor("#C6D8FF"), 999)
        })
        header.addView(identityRow)
        root.addView(header)
    }

    private fun utility(label: String, action: () -> Unit): Button = Button(activity).apply {
        text = label
        textSize = 11f
        maxLines = 1
        layoutParams = LinearLayout.LayoutParams(if (compactPda) dp(54) else dp(60), dp(42)).apply {
            marginStart = dp(4)
        }
        styleSecondary(this)
        minHeight = 0
        minimumHeight = 0
        setOnClickListener { action() }
    }

    fun addFooter(root: LinearLayout) {
        root.addView(TextView(activity).apply {
            text = "Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291"
            textSize = 9.5f
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
        background = rounded(greenSoft, line, 9)
        setTextColor(greenDark)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(6)
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
