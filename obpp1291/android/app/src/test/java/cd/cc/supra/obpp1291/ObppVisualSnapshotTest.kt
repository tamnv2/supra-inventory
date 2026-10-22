package cd.cc.supra.obpp1291

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.FileOutputStream

/**
 * D172 E029 TEST ONLY. Renders the real MainActivity login view on the JVM.
 * No emulator, no real user account, no QR/DO, and no Production calls.
 * OS overlay / FCM / hardware scanner are NOT validated by this test.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ObppVisualSnapshotTest {

    @Test
    @Config(sdk = [30], qualifiers = "w360dp-h640dp-xhdpi")
    fun mt90LoginSnapshot() = renderLogin("mt90-720x1280", 720, 1280)

    @Test
    @Config(sdk = [30], qualifiers = "w360dp-h720dp-xhdpi")
    fun dt50LoginSnapshot() = renderLogin("dt50-720x1440", 720, 1440)

    private fun renderLogin(name: String, width: Int, height: Int) {
        // MainActivity constructs this page programmatically; XML-only snapshots
        // would miss the actual D172 production UI hierarchy.
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        try {
            val root = activity.window.decorView
            val exactW = View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY)
            val exactH = View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
            root.measure(exactW, exactH)
            root.layout(0, 0, width, height)

            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)
            root.draw(canvas)
            val folder = File("obpp1291/android/app/build/visual-qa").apply { mkdirs() }
            val screenshot = File(folder, "$name.png")
            FileOutputStream(screenshot).use {
                check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it))
            }
            // A *synthetic, unauthenticated login page only*: small JPEG previews
            // can be decoded from PR CI logs for direct visual inspection.
            // NEVER use this channel for real users, DO/QR, tokens or production screens.
            val mini = Bitmap.createScaledBitmap(bitmap, width / 2, height / 2, true)
            val preview = File(folder, "$name-preview.jpg")
            FileOutputStream(preview).use {
                check(mini.compress(Bitmap.CompressFormat.JPEG, 65, it))
            }
            assertTrue("Missing synthetic visual preview", preview.length() > 1_000)
            assertTrue("Missing/empty screenshot: $screenshot", screenshot.length() > 10_000)
            assertEquals(width, bitmap.width)
            assertEquals(height, bitmap.height)

            val texts = mutableListOf<String>()
            fun collect(v: View) {
                if (v is TextView) texts += v.text.toString()
                if (v is ViewGroup) for (index in 0 until v.childCount) collect(v.getChildAt(index))
            }
            collect(root)
            assertTrue("Missing login heading: $texts", texts.any { it.contains("GHI NHẬN HÀNG RỚT") })
            for (label in listOf("Đăng nhập", "Tài khoản", "Mật khẩu / mã", "Kiểm tra cập nhật")) {
                assertTrue("Missing login control '$label' in $texts", texts.any { it == label })
            }
        } finally {
            controller.pause().stop().destroy()
        }
    }
}
