package cd.cc.supra.inventory.beta

import android.content.Context
import android.os.SystemClock
import android.util.Base64
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Source
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

data class RelayProbeResult(
    val requestId: String,
    val agentId: String,
    val agentNetwork: String,
    val agentAdminUserId: String,
    val agentInstanceId: String,
    val roundTripMs: Long,
    val lookupStatus: String,
    val lookupMatches: Int,
    val candidatePicklists: List<String>,
    val lookupMs: Long,
    val cacheMode: String,
    val rateStrikes: Int,
    val lockLevel: Int,
    val lockedUntilMs: Long,
)

private data class RelayFirebaseIdentity(
    val uid: String,
    val audience: String,
    val fingerprint: String,
)

private data class RelayAck(
    val agentId: String,
    val agentNetwork: String,
    val adminUserId: String,
    val agentInstanceId: String,
    val lookupStatus: String,
    val lookupMatches: Int,
    val candidatePicklists: List<String>,
    val lookupMs: Long,
    val cacheMode: String,
    val rateStrikes: Int,
    val lockLevel: Int,
    val lockedUntilMs: Long,
    val guardId: String,
    val retireAtMs: Long,
)

private data class RelayCleanupEntry(
    val jobId: String,
    val guardId: String,
    val notBeforeMs: Long,
    val ownerUid: String,
)

class RelayPocClient(
    context: Context,
    private val api: InventoryApi,
    private val log: (String) -> Unit = {},
    private val onProgress: (String) -> Unit = {},
) {
    private companion object {
        const val FAILOVER_NOTICE_MS = 10_000L
        const val TOTAL_WAIT_MS = 20_000L
        const val TIMED_OUT_PENDING_RETENTION_MS = 60L * 60L * 1000L
        const val CONFIRMED_RETENTION_MS = 30L * 24L * 60L * 60L * 1000L
        const val CLEANUP_PREF = "relay_d097_cleanup"
        const val CLEANUP_KEY = "entries"
        const val JOB_COLLECTION = "relay_poc_jobs"
        const val GUARD_COLLECTION = "relay_poc_confirm_guards"
    }

    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(CLEANUP_PREF, Context.MODE_PRIVATE)
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val firestore by lazy {
        val db = FirebaseFirestore.getInstance()
        try {
            db.firestoreSettings = FirebaseFirestoreSettings.Builder()
                .setPersistenceEnabled(false)
                .build()
        } catch (error: Exception) {
            log("D097 Firestore persistence config: " + safeText(error.message))
        }
        db
    }
    private val listenerGate = Any()
    private var activeListener: ListenerRegistration? = null
    private val cleanupExecutor = Executors.newSingleThreadExecutor()
    private val cleanupInFlight = AtomicBoolean(false)

    fun close() {
        synchronized(listenerGate) {
            activeListener?.remove()
            activeListener = null
        }
    }

    fun sendProbe(suffix: String): RelayProbeResult {
        require(suffix.matches(Regex("^\\d{3,20}$"))) { "PickList phải có từ 3 đến 20 chữ số cuối." }
        val window = api.getAndroidOperatingWindow()
        if (!window.isOpen) {
            throw ApiException(
                403,
                "ANDROID_WINDOW_CLOSED",
                "Ca vận hành App/PDA đang đóng (23:00–05:00).",
            )
        }
        var session = api.session ?: throw ApiException(401, "AUTH_REQUIRED", "Chưa đăng nhập.")
        session = ensureFirestoreAuth(session)

        return try {
            executeProbe(session, suffix)
        } finally {
            triggerCleanupAsync()
        }
    }

    private fun ensureFirestoreAuth(initial: AppSession): AppSession {
        val identity = firebaseIdentity(initial.idToken)
        val existing = auth.currentUser
        if (existing != null && existing.uid == identity.uid) return initial

        var session = initial
        var token = session.relayCustomToken
        if (token.isNullOrBlank()) {
            session = api.refreshSessionForRelay()
            token = session.relayCustomToken
        }
        if (token.isNullOrBlank()) {
            throw IOException("Không lấy được phiên Firestore realtime cho Xác nhận đơn.")
        }

        try {
            val result = Tasks.await(auth.signInWithCustomToken(token), 15, TimeUnit.SECONDS)
            if (result.user?.uid != firebaseIdentity(session.idToken).uid) {
                auth.signOut()
                throw IOException("Firebase relay identity không khớp Picker hiện tại.")
            }
            log("D097 Firestore listener auth PASS uid=" + firebaseIdentity(session.idToken).fingerprint)
            return session
        } catch (first: Exception) {
            log("D097 Firestore listener auth retry sau refresh: " + safeText(first.message))
            session = api.refreshSessionForRelay()
            val retryToken = session.relayCustomToken
                ?: throw IOException("Không làm mới được phiên Firestore realtime.", first)
            val result = Tasks.await(auth.signInWithCustomToken(retryToken), 15, TimeUnit.SECONDS)
            if (result.user?.uid != firebaseIdentity(session.idToken).uid) {
                auth.signOut()
                throw IOException("Firebase relay identity không khớp sau refresh.")
            }
            return session
        }
    }

    private fun executeProbe(session: AppSession, suffix: String): RelayProbeResult {
        val identity = firebaseIdentity(session.idToken)
        val requestId = UUID.randomUUID().toString()
        val doc = firestore.collection(JOB_COLLECTION).document(requestId)
        val started = SystemClock.elapsedRealtime()

        val fields = hashMapOf<String, Any>(
            "request_id" to requestId,
            "suffix" to suffix,
            "status" to "PENDING",
            "source" to "ANDROID_CONFIRM_V1",
            "picker_uid" to identity.uid,
            "picker_user_id" to session.userId,
            "client_sent_at_ms" to System.currentTimeMillis(),
            "created_at" to FieldValue.serverTimestamp(),
        )

        log(
            "D097 Firestore create request=" + shortId(requestId) +
                " picker_uid=" + identity.fingerprint +
                " aud=" + identity.audience.ifBlank { "unknown" }
        )
        onProgress("Đang gửi qua Firestore...")

        try {
            Tasks.await(doc.set(fields), 15, TimeUnit.SECONDS)
        } catch (error: Exception) {
            throw IOException("Không gửi được yêu cầu Xác nhận đơn qua Firestore.", error)
        }

        log("D097 Firestore CREATE PASS request=" + shortId(requestId))
        onProgress("Đã gửi #" + shortId(requestId) + " · đang chờ Agent chính...")

        val ackRef = AtomicReference<RelayAck?>(null)
        val errorRef = AtomicReference<Exception?>(null)
        val done = CountDownLatch(1)

        val registration = doc.addSnapshotListener { snapshot, error ->
            if (error != null) {
                errorRef.compareAndSet(null, error)
                return@addSnapshotListener
            }
            if (snapshot == null || !snapshot.exists()) return@addSnapshotListener
            val ack = parseAck(snapshot) ?: return@addSnapshotListener
            ackRef.set(ack)
            done.countDown()
        }
        synchronized(listenerGate) {
            activeListener?.remove()
            activeListener = registration
        }

        var failoverNoticeShown = false
        try {
            val deadline = SystemClock.elapsedRealtime() + TOTAL_WAIT_MS
            while (SystemClock.elapsedRealtime() < deadline) {
                val remaining = (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(1L)
                if (done.await(minOf(1_000L, remaining), TimeUnit.MILLISECONDS)) break

                val elapsed = SystemClock.elapsedRealtime() - started
                if (!failoverNoticeShown && elapsed >= FAILOVER_NOTICE_MS) {
                    failoverNoticeShown = true
                    onProgress("Đang chờ phản hồi · hệ thống sẽ tự chuyển Agent dự phòng nếu cần... #" + shortId(requestId))
                }
            }

            var ack = ackRef.get()
            if (ack == null) {
                ack = readAckFromServer(doc, requestId)
            }
            if (ack == null) {
                scheduleCleanup(
                    requestId,
                    "",
                    System.currentTimeMillis() + TIMED_OUT_PENDING_RETENTION_MS,
                    identity.uid,
                )
                val listenerError = errorRef.get()
                if (listenerError != null) {
                    log("D097 Firestore listener chưa hồi phục trong 30s request=" + shortId(requestId) +
                        " detail=" + safeText(listenerError.message))
                }
                throw IOException(
                    "Không xử lý được request #" + shortId(requestId) +
                        " trong 30 giây. Vui lòng về bàn Chuyên viên xử lý trực tiếp."
                )
            }

            val total = (SystemClock.elapsedRealtime() - started).coerceAtLeast(0L)
            log(
                "D097 Firestore ACK request=" + shortId(requestId) +
                    " admin=" + safeId(ack.adminUserId) +
                    " agent=" + safeId(ack.agentId) +
                    " instance=" + safeId(ack.agentInstanceId) +
                    " network=" + safeId(ack.agentNetwork) +
                    " rtt=" + total + "ms"
            )

            if (ack.guardId.isNotBlank()) {
                val retire = ack.retireAtMs.takeIf { it > System.currentTimeMillis() }
                    ?: (System.currentTimeMillis() + CONFIRMED_RETENTION_MS)
                scheduleCleanup(requestId, ack.guardId, retire, identity.uid)
            } else {
                scheduleCleanup(requestId, "", System.currentTimeMillis(), identity.uid)
            }

            return RelayProbeResult(
                requestId = requestId,
                agentId = ack.agentId,
                agentNetwork = ack.agentNetwork,
                agentAdminUserId = ack.adminUserId,
                agentInstanceId = ack.agentInstanceId,
                roundTripMs = total,
                lookupStatus = ack.lookupStatus,
                lookupMatches = ack.lookupMatches,
                candidatePicklists = ack.candidatePicklists,
                lookupMs = ack.lookupMs,
                cacheMode = ack.cacheMode,
                rateStrikes = ack.rateStrikes,
                lockLevel = ack.lockLevel,
                lockedUntilMs = ack.lockedUntilMs,
            )
        } finally {
            registration.remove()
            synchronized(listenerGate) {
                if (activeListener === registration) activeListener = null
            }
        }
    }

    private fun parseAck(snapshot: DocumentSnapshot): RelayAck? {
        if (snapshot.getString("status") != "ACK") return null
        return RelayAck(
            agentId = snapshot.getString("agent_id").orEmpty().ifBlank { "Agent" },
            agentNetwork = snapshot.getString("agent_network").orEmpty().ifBlank { "UNKNOWN" },
            adminUserId = snapshot.getString("agent_admin_user_id").orEmpty().ifBlank { "ADMIN" },
            agentInstanceId = snapshot.getString("agent_instance_id").orEmpty().ifBlank { "UNKNOWN" },
            lookupStatus = snapshot.getString("lookup_status").orEmpty().ifBlank { "TRANSPORT_ONLY" },
            lookupMatches = (snapshot.getLong("lookup_matches") ?: 0L).toInt().coerceAtLeast(0),
            candidatePicklists = (snapshot.get("candidate_picklists") as? List<*>)
                .orEmpty()
                .mapNotNull { it?.toString()?.trim()?.takeIf { code -> code.matches(Regex("^PL\\d{3,20}$", RegexOption.IGNORE_CASE)) } }
                .distinct()
                .take(20),
            lookupMs = (snapshot.getLong("lookup_ms") ?: 0L).coerceAtLeast(0L),
            cacheMode = snapshot.getString("cache_mode").orEmpty().ifBlank { "NONE" },
            rateStrikes = (snapshot.getLong("rate_strikes") ?: 0L).toInt().coerceAtLeast(0),
            lockLevel = (snapshot.getLong("lock_level") ?: 0L).toInt().coerceAtLeast(0),
            lockedUntilMs = (snapshot.getLong("locked_until_ms") ?: 0L).coerceAtLeast(0L),
            guardId = snapshot.getString("guard_id").orEmpty(),
            retireAtMs = (snapshot.getLong("retire_at_ms") ?: 0L).coerceAtLeast(0L),
        )
    }

    private fun readAckFromServer(doc: DocumentReference, requestId: String): RelayAck? {
        return try {
            val snapshot = Tasks.await(doc.get(Source.SERVER), 5, TimeUnit.SECONDS)
            val ack = parseAck(snapshot)
            if (ack != null) {
                log("D115 Firestore final-read recovered ACK request=" + shortId(requestId))
            }
            ack
        } catch (error: Exception) {
            log(
                "D115 Firestore final-read unavailable request=" + shortId(requestId) +
                    " detail=" + safeText(error.message)
            )
            null
        }
    }

    private fun triggerCleanupAsync() {
        val currentUid = auth.currentUser?.uid?.trim().orEmpty()
        if (currentUid.isBlank()) return
        if (!cleanupInFlight.compareAndSet(false, true)) return

        cleanupExecutor.execute {
            try {
                runDueCleanup(currentUid)
            } catch (error: Exception) {
                log("D115 cleanup background deferred detail=" + safeText(error.message))
            } finally {
                cleanupInFlight.set(false)
            }
        }
    }

    private fun runDueCleanup(currentUid: String) {
        val now = System.currentTimeMillis()
        val entries = readCleanupEntries()
        if (entries.isEmpty()) return

        val remaining = ArrayList<RelayCleanupEntry>()
        var droppedLegacy = 0
        var droppedForeign = 0
        var droppedDenied = 0

        for (entry in entries) {
            if (entry.ownerUid.isBlank()) {
                droppedLegacy++
                continue
            }
            if (entry.ownerUid != currentUid) {
                droppedForeign++
                continue
            }
            if (entry.notBeforeMs > now) {
                remaining += entry
                continue
            }

            try {
                Tasks.await(
                    firestore.collection(JOB_COLLECTION).document(entry.jobId).delete(),
                    10,
                    TimeUnit.SECONDS,
                )
                if (entry.guardId.isNotBlank()) {
                    Tasks.await(
                        firestore.collection(GUARD_COLLECTION).document(entry.guardId).delete(),
                        10,
                        TimeUnit.SECONDS,
                    )
                }
                log(
                    "D115 cleanup PASS job=" + shortId(entry.jobId) +
                        (if (entry.guardId.isBlank()) "" else " guard=" + shortId(entry.guardId))
                )
            } catch (error: Exception) {
                val detail = safeText(error.message)
                if (detail.contains("PERMISSION_DENIED", ignoreCase = true)) {
                    droppedDenied++
                } else {
                    remaining += entry
                    log(
                        "D115 cleanup background deferred job=" + shortId(entry.jobId) +
                            " detail=" + detail
                    )
                }
            }
        }

        writeCleanupEntries(remaining)
        if (droppedLegacy + droppedForeign + droppedDenied > 0) {
            log(
                "D115 cleanup pruned legacy=" + droppedLegacy +
                    " foreign=" + droppedForeign +
                    " denied=" + droppedDenied
            )
        }
    }

    private fun scheduleCleanup(
        jobId: String,
        guardId: String,
        notBeforeMs: Long,
        ownerUid: String,
    ) {
        val entries = readCleanupEntries()
            .filterNot { it.jobId == jobId }
            .toMutableList()
        entries += RelayCleanupEntry(
            jobId = jobId,
            guardId = guardId,
            notBeforeMs = notBeforeMs.coerceAtLeast(0L),
            ownerUid = ownerUid,
        )
        writeCleanupEntries(entries.takeLast(2_000))
    }

    private fun readCleanupEntries(): List<RelayCleanupEntry> {
        val raw = prefs.getString(CLEANUP_KEY, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val row = array.optJSONObject(index) ?: continue
                    val jobId = row.optString("job_id").trim()
                    if (jobId.isBlank()) continue
                    add(
                        RelayCleanupEntry(
                            jobId = jobId,
                            guardId = row.optString("guard_id").trim(),
                            notBeforeMs = row.optLong("not_before_ms", 0L),
                            ownerUid = row.optString("owner_uid").trim(),
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun writeCleanupEntries(entries: List<RelayCleanupEntry>) {
        val array = JSONArray()
        for (entry in entries) {
            array.put(
                JSONObject()
                    .put("job_id", entry.jobId)
                    .put("guard_id", entry.guardId)
                    .put("not_before_ms", entry.notBeforeMs)
                    .put("owner_uid", entry.ownerUid)
            )
        }
        prefs.edit().putString(CLEANUP_KEY, array.toString()).apply()
    }

    private fun firebaseIdentity(idToken: String): RelayFirebaseIdentity {
        val parts = idToken.split('.')
        if (parts.size != 3) throw IllegalStateException("Firebase ID token không hợp lệ.")
        val decoded = try {
            Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        } catch (_: Exception) {
            throw IllegalStateException("Không đọc được Firebase ID token.")
        }
        val payload = try {
            JSONObject(String(decoded, Charsets.UTF_8))
        } catch (_: Exception) {
            throw IllegalStateException("Firebase ID token thiếu payload hợp lệ.")
        }
        val uid = payload.optString("sub").trim()
        if (uid.isBlank() || uid.length > 128) throw IllegalStateException("Firebase UID trong phiên không hợp lệ.")
        val audience = payload.optString("aud").trim()
        return RelayFirebaseIdentity(uid, audience, fingerprint(uid))
    }

    private fun fingerprint(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
            .take(12)

    private fun shortId(value: String): String = value.take(8)

    private fun safeId(value: String): String =
        value.filter { it.isLetterOrDigit() || it in "._:@-" }.take(96).ifBlank { "unknown" }

    private fun safeText(value: String?): String {
        if (value.isNullOrBlank()) return ""
        var next = value.take(240)
        next = next.replace(Regex("(?i)(authorization|bearer|token|password|secret|api[_ -]?key)\\s*[:=]\\s*[^\\s,;]+")) {
            it.groupValues[1] + "=[REDACTED]"
        }
        next = next.replace(Regex("eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}"), "[REDACTED_JWT]")
        return next
    }
}
