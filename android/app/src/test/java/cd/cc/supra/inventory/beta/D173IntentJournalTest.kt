package cd.cc.supra.inventory.beta

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class D173IntentJournalTest {
    @Test fun uncertainCommitReusesFirstKeyOnlyWithinSameSessionAndBusinessIntent() {
        val journal = D173IntentJournal()
        val first = journal.begin("u|ANDROID|7", "shortage.create", JSONObject().put("sku", "S").put("request_id", "first"), "first")
        journal.settle(first, 503)
        val retry = journal.begin("u|ANDROID|7", "shortage.create", JSONObject().put("sku", "S").put("request_id", "second").put("read_model", JSONObject()), "second")
        assertEquals("first", retry.requestId)
        assertEquals("new-session", journal.begin("u|ANDROID|8", "shortage.create", JSONObject().put("sku", "S"), "new-session").requestId)
        journal.settle(retry, 200)
        assertEquals("next", journal.begin("u|ANDROID|7", "shortage.create", JSONObject().put("sku", "S"), "next").requestId)
    }

    @Test fun unresolvedJournalIsBoundedAndNeverEvictsAnUnknownMutation() {
        val journal = D173IntentJournal()
        repeat(32) { journal.begin("u", "shortage.create", JSONObject().put("sku", "$it"), "$it") }
        try {
            journal.begin("u", "shortage.create", JSONObject().put("sku", "overflow"), "overflow")
            fail("Unbounded journal")
        } catch (_: IllegalStateException) { }
        assertEquals("0", journal.begin("u", "shortage.create", JSONObject().put("sku", "0"), "replacement").requestId)
    }
}
