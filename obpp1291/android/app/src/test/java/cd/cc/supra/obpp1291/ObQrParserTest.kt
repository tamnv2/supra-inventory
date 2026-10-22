package cd.cc.supra.obpp1291

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ObQrParserTest {
    @Test fun parsesSixSegmentsAndTotalNotIndex() {
        val r = ObQrParser.parse("2BPB|7083772047|SOWINSAJREM3B84|PB1261009080B99.004|CX1.10.1|1/4")
        assertEquals("2BPB", r.storeCode)
        assertEquals("7083772047", r.doCode)
        assertEquals(1, r.parcelIndex)
        assertEquals(4, r.totalParcels)
    }

    @Test fun normalizesManualValues() {
        assertEquals("2BPB", ObQrParser.store(" 2bpb "))
        assertEquals("0007083", ObQrParser.doCode(" 0007083 "))
        assertEquals(4, ObQrParser.total("4"))
        assertEquals("CX 1.8.8", ObQrParser.position(" cx 1.8.8 "))
    }

    @Test fun rejectsBadFractionAndBadFields() {
        val prefix = "2BPB|7083772047|SOWIN|PB123|CX1.1.1|"
        for (tail in listOf("0/4", "5/4", "1/0", "4/3", "1/x", "")) {
            assertThrows(IllegalArgumentException::class.java) { ObQrParser.parse(prefix + tail) }
        }
        assertThrows(IllegalArgumentException::class.java) { ObQrParser.parse("2BPB|ABC|SOWIN|PB|CX|1/4") }
        assertThrows(IllegalArgumentException::class.java) { ObQrParser.parse("2BPB|123|1/4") }
        assertThrows(IllegalArgumentException::class.java) { ObQrParser.doCode("12A3") }
        assertThrows(IllegalArgumentException::class.java) { ObQrParser.total("0") }
    }
}
