package cd.cc.supra.inventory.beta

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class D173AudienceCoverageTest {
    private fun owner(generation: Long = 7L, channel: String = "ANDROID", role: String = "PICKER"): AppSession {
        val claims = JSONObject().put("app_session_generation", generation).put("app_session_channel", channel)
        val token = "x." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(claims.toString().toByteArray()) + ".x"
        return AppSession(token, "refresh", "picker-u", "Name", role, "P")
    }
    private fun proof(): JSONObject = JSONObject().put("complete", true).put("stream_epoch", "epoch-A").put("user_id", "picker-u")
        .put("role", "PICKER").put("session_channel", "ANDROID").put("session_generation", 7)
        .put("from_seq", 6).put("through_seq", 9)

    @Test fun onlyCompleteExactFilteredGapIsCovered() {
        assertTrue(D173AudienceCoverage.covers(proof(), 5L, 10L, "epoch-A", owner()))
        assertFalse(D173AudienceCoverage.covers(null, 5L, 10L, "epoch-A", owner()))
        assertFalse(D173AudienceCoverage.covers(proof(), 0L, 10L, "epoch-A", owner()))
        assertFalse(D173AudienceCoverage.covers(proof(), 12L, 10L, "epoch-A", owner()))
        assertFalse(D173AudienceCoverage.covers(proof(), 5L, 10L, "", owner()))
        for ((key, value) in listOf("complete" to false, "stream_epoch" to "old", "user_id" to "other", "role" to "REPORTER",
            "session_channel" to "WEB", "session_generation" to 6, "from_seq" to 7, "through_seq" to 8, "from_seq" to "6")) {
            assertFalse(key, D173AudienceCoverage.covers(proof().put(key, value), 5L, 10L, "epoch-A", owner()))
        }
    }

    @Test fun oldSessionOrRoleCannotConsumePreviousCoverage() {
        assertFalse(D173AudienceCoverage.covers(proof(), 5L, 10L, "epoch-A", owner(8)))
        assertFalse(D173AudienceCoverage.covers(proof(), 5L, 10L, "epoch-A", owner(role = "REPORTER")))
        assertFalse(D173AudienceCoverage.covers(proof(), 5L, 10L, "epoch-A", owner().copy(idToken = "legacy")))
    }

    @Test fun refreshedTokenSameGenerationKeepsSessionButAnotherLoginDoesNot() {
        assertTrue(D173AudienceCoverage.sameSession(owner(), owner().copy(displayName = "Updated name")))
        assertFalse(D173AudienceCoverage.sameSession(owner(), owner(8)))
        assertFalse(D173AudienceCoverage.sameSession(owner(), owner(role = "REPORTER")))
        assertFalse(D173AudienceCoverage.sameSession(owner(), owner(channel = "WEB")))
    }
}
