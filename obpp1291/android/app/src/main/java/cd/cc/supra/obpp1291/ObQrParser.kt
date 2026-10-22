package cd.cc.supra.obpp1291

import java.util.Locale

data class ParcelInfo(
    val rawScan: String,
    val storeCode: String,
    val doCode: String,
    val parcelIndex: Int,
    val totalParcels: Int
)

object ObQrParser {
    private val storePattern = Regex("[A-Z0-9-]{1,24}")
    private val doPattern = Regex("[0-9]{1,24}")
    private val fractional = Regex("([0-9]+)/([0-9]+)")

    fun store(value: String): String {
        val v = value.trim().uppercase(Locale.ROOT)
        require(storePattern.matches(v)) { "Mã cửa hàng không hợp lệ" }
        return v
    }

    fun doCode(value: String): String {
        val v = value.trim()
        require(doPattern.matches(v)) { "DO chỉ được chứa chữ số" }
        return v
    }

    fun total(value: String): Int {
        val n = value.trim().toIntOrNull()
        require(n != null && n > 0 && n <= 999999) { "Số kiện phải là số nguyên dương" }
        return n
    }

    fun position(value: String): String {
        val v = value.trim().uppercase(Locale.ROOT)
        require(v.isNotEmpty() && v.length <= 60 && !v.any { it == '\n' || it == '\r' }) {
            "Vị trí không hợp lệ"
        }
        return v
    }

    fun parse(raw: String): ParcelInfo {
        require(raw.length in 11..512) { "Độ dài QR không hợp lệ" }
        val parts = raw.trim().split('|')
        require(parts.size == 6 && parts.all { it.trim().isNotEmpty() }) {
            "QR phải đủ sáu thành phần"
        }
        val s = store(parts[0])
        val d = doCode(parts[1])
        val m = fractional.matchEntire(parts[5].trim()) ?: throw IllegalArgumentException("Thiếu STT/tổng kiện")
        val ordinal = m.groupValues[1].toIntOrNull()
        val total = m.groupValues[2].toIntOrNull()
        require(ordinal != null && total != null && ordinal > 0 && total > 0 && ordinal <= total && total <= 999999) {
            "STT kiện phải nằm trong khoảng 1..tổng kiện"
        }
        return ParcelInfo(raw, s, d, ordinal, total)
    }
}
