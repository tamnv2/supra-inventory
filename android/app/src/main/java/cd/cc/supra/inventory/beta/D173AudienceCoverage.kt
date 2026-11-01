package cd.cc.supra.inventory.beta

import org.json.JSONObject

internal object D173AudienceCoverage {
    data class Scope(val channel: String, val generation: Long)
    fun scope(token: String): Scope? = try {
        val claims = JSONObject(String(java.util.Base64.getUrlDecoder().decode(token.split('.')[1]), Charsets.UTF_8))
        val channel = claims.getString("app_session_channel")
        val generation = claims.getLong("app_session_generation")
        if (channel in setOf("WEB", "ANDROID") && generation in 1L..9_007_199_254_740_991L) Scope(channel, generation) else null
    } catch (_: Exception) { null }

    fun covers(proof: JSONObject?, applied: Long, incoming: Long, epoch: String, owner: AppSession?): Boolean {
        if (proof == null || owner == null || epoch.isBlank() || applied <= 0L || incoming <= applied + 1L || incoming > 9_007_199_254_740_991L) return false
        val scope = scope(owner.idToken) ?: return false
        return proof.opt("complete") == true && proof.opt("stream_epoch") == epoch && proof.opt("user_id") == owner.userId &&
            proof.opt("role") == owner.role && proof.opt("session_channel") == scope.channel &&
            exactNumber(proof.opt("session_generation"), scope.generation) && exactNumber(proof.opt("from_seq"), applied + 1L) &&
            exactNumber(proof.opt("through_seq"), incoming - 1L)
    }

    fun sameSession(left: AppSession?, right: AppSession?): Boolean {
        if (left == null || right == null || left.userId != right.userId || left.role != right.role) return false
        val leftScope = scope(left.idToken)
        val rightScope = scope(right.idToken)
        return if (leftScope != null && rightScope != null) leftScope == rightScope else left.idToken == right.idToken
    }

    private fun exactNumber(value: Any?, expected: Long): Boolean = value is Number && value.toDouble().isFinite() && value.toDouble() == expected.toDouble()
}
