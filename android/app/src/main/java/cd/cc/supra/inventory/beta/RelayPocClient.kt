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
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Source
import org.json.JSONObject
import java.io.IOException
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
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
    val sessionGeneration: Long,
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

class RelayPocClient(
    context: Context,
    private val api: InventoryApi,
    private val log: (String) -> Unit = {},
    private val onProgress: (String) -> Unit = {},
) {
    private companion object {
        const val FAILOVER_NOTICE_MS = 10_000L
        const val TOTAL_WAIT_MS = 20_000L
        const val CREATE_FIRST_WAIT_SECONDS = 5L
        const val CREATE_VERIFY_WAIT_SECONDS = 3L
        const val CREATE_RETRY_WAIT_SECONDS = 4L
        const val JOB_COLLECTION = "relay_poc_jobs"
        const val SCHEDULE_RECONCILE_MIN_MS = 60_000L
    }

    private val appContext = context.applicationContext
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val firestore by lazy { FirebaseFirestore.getInstance() }
    private val listenerGate = Any()
    private var activeListener: ListenerRegistration? = null
    @Volatile private var lastScheduleReconcileElapsedMs = 0L

    fun close() {
        synchronized(listenerGate) {
            activeListener?.remove()
            activeListener = null
        }
    }

    fun sendProbe(suffix: String): RelayProbeResult {
        require(suffix.matches(Regex("^\\d{3,20}$"))) { "PickList phải có từ 3 đến 20 chữ số cuối." }
        var session = api.session ?: throw ApiException(401, "AUTH_REQUIRED", "Chưa đăng nhập.")

        if (!OperatingScheduleStore.isOpen(appContext)) {
            reconcileOperatingScheduleOnce(session)
        }
        if (!OperatingScheduleStore.isOpen(appContext)) {
            throw ApiException(
                403,
                "ANDROID_WINDOW_CLOSED",
                "Replay/PickList đang ngoài ca. Khung thường 05:45–22:30; tăng ca theo lệnh chung của Agent.",
            )
        }

        session = ensureFirestoreAuth(session)
        return executeProbe(session, suffix)
    }

    private fun reconcileOperatingScheduleOnce(session: AppSession) {
        val nowElapsed = SystemClock.elapsedRealtime()
        val previous = lastScheduleReconcileElapsedMs
        if (previous > 0L && nowElapsed - previous < SCHEDULE_RECONCILE_MIN_MS) return
        lastScheduleReconcileElapsedMs = nowElapsed

        try {
            val window = api.getAndroidOperatingWindow()
            OperatingScheduleStore.applyWorkerWindow(appContext, window)
            log("D154 schedule reconcile=WORKER version=" + window.scheduleVersion)
            if (OperatingScheduleStore.isOpen(appContext)) return
            // D154: a successful HTTP response may still be a stale Worker mirror.
            // When business is still blocked, perform one exact Firestore GET below.
            log("D154 schedule reconcile=WORKER_CLOSED exact_get=REQUIRED")
        } catch (workerError: Exception) {
            log("D154 schedule reconcile=WORKER_DEFER detail=" + safeText(workerError.message))
        }

        // One exact-document recovery only when the Worker still leaves the window
        // closed. No listener/list query and no retry loop; the existing 60s gate
        // bounds repeated user attempts.
        var firestoreSession = session
        var identity = firebaseIdentity(firestoreSession.idToken)
        if (!hasCompatibleFirebaseSession(identity)) {
            try {
                firestoreSession = ensureFirestoreAuth(firestoreSession)
                identity = firebaseIdentity(firestoreSession.idToken)
            } catch (authError: Exception) {
                log("D154 schedule reconcile=FIRESTORE_AUTH_DEFER detail=" + safeText(authError.message))
                return
            }
        }
        try {
            val doc = firestore.collection(OperatingScheduleStore.FIRESTORE_COLLECTION)
                .document(OperatingScheduleStore.FIRESTORE_DOCUMENT)
            val snapshot = Tasks.await(doc.get(Source.SERVER), 5, TimeUnit.SECONDS)
            if (!snapshot.exists()) return
            val key = snapshot.getString("schedule_key").orEmpty()
            val version = snapshot.getLong("version") ?: 0L
            val openUntil = snapshot.getLong("open_until_ms") ?: 0L
            if (!key.matches(Regex("^\\d{8}$")) || version <= 0L || openUntil <= 0L) return
            val current = OperatingScheduleStore.load(appContext)
            OperatingScheduleStore.save(
                appContext,
                LocalOperatingSchedule(
                    scheduleKey = key,
                    version = version,
                    decision = snapshot.getString("decision").orEmpty(),
                    openUntilMs = openUntil,
                    normalStartMinutes = (snapshot.getLong("normal_start_minutes") ?: 345L).toInt(),
                    normalEndMinutes = (snapshot.getLong("normal_end_minutes") ?: 1350L).toInt(),
                    overtimeCutoffMinutes = (snapshot.getLong("overtime_cutoff_minutes") ?: 300L).toInt(),
                    updatedAtMs = snapshot.getLong("updated_at_ms") ?: version,
                    serverOffsetMs = current?.serverOffsetMs ?: 0L,
                ),
            )
            log("D154 schedule reconcile=FIRESTORE_EXACT_GET version=" + version)
        } catch (error: Exception) {
            log("D154 schedule reconcile=FIRESTORE_DEFER detail=" + safeText(error.message))
        }
    }

    private fun ensureFirestoreAuth(initial: AppSession): AppSession {
        val identity = firebaseIdentity(initial.idToken)
        if (hasCompatibleFirebaseSession(identity)) return initial

        // D134 hotfix: an already signed-in Firebase user can still carry the pre-fix
        // string-typed app_session_generation claim. Refresh once and re-authenticate
        // so Firestore Rules receive the required numeric claim without forcing logout.
        var session = api.refreshSessionForRelay()
        var token = session.relayCustomToken
        if (token.isNullOrBlank()) {
            throw IOException("Không lấy được phiên Firestore realtime cho Xác nhận đơn.")
        }

        try {
            val result = Tasks.await(auth.signInWithCustomToken(token), 15, TimeUnit.SECONDS)
            val refreshedIdentity = firebaseIdentity(session.idToken)
            if (result.user?.uid != refreshedIdentity.uid) {
                auth.signOut()
                throw IOException("Firebase relay identity không khớp Picker hiện tại.")
            }
            if (!hasCompatibleFirebaseSession(refreshedIdentity)) {
                auth.signOut()
                throw IOException("Phiên Firestore chưa có session generation kiểu số hợp lệ.")
            }
            log("D134 Firestore auth repaired uid=" + refreshedIdentity.fingerprint +
                " generation=" + refreshedIdentity.sessionGeneration)
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


    private fun hasCompatibleFirebaseSession(identity: RelayFirebaseIdentity): Boolean {
        val existing = auth.currentUser ?: return false
        if (existing.uid != identity.uid) return false
        return try {
            val tokenResult = Tasks.await(existing.getIdToken(false), 5, TimeUnit.SECONDS)
            val rawGeneration = tokenResult.claims["app_session_generation"]
            rawGeneration is Number && rawGeneration.toLong() == identity.sessionGeneration
        } catch (error: Exception) {
            log("D134 Firestore auth claim check deferred: " + safeText(error.message))
            false
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
            "picker_employee_code" to (session.employeeCode ?: ""),
            "picker_display_name" to session.displayName,
            "picker_session_generation" to identity.sessionGeneration,
            "client_sent_at_ms" to System.currentTimeMillis(),
            "created_at" to FieldValue.serverTimestamp(),
        )

        log(
            "D097 Firestore create request=" + shortId(requestId) +
                " picker_uid=" + identity.fingerprint +
                " aud=" + identity.audience.ifBlank { "unknown" }
        )
        onProgress("Đang gửi qua Firestore...")

        createRequestWithRecovery(doc, fields, requestId, identity.uid)

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
                val listenerError = errorRef.get()
                if (listenerError != null) {
                    log("D097 Firestore listener chưa hồi phục trong 30s request=" + shortId(requestId) +
                        " detail=" + safeText(listenerError.message))
                }
                throw IOException(
                    "Không xử lý được request #" + shortId(requestId) +
                        " trong 20 giây. Vui lòng về bàn Chuyên viên xử lý trực tiếp."
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

    private fun createRequestWithRecovery(
        doc: DocumentReference,
        fields: Map<String, Any>,
        requestId: String,
        ownerUid: String,
    ) {
        try {
            Tasks.await(doc.set(fields), CREATE_FIRST_WAIT_SECONDS, TimeUnit.SECONDS)
            return
        } catch (first: Exception) {
            log(
                "D130 Firestore create uncertain request=" + shortId(requestId) +
                    " reason=" + safeText(first.message) +
                    " · đang xác minh trên server."
            )
            if (requestExistsOnServer(doc, requestId, ownerUid)) {
                log("D130 Firestore CREATE RECOVERED request=" + shortId(requestId) + " phase=verify1")
                return
            }

            // Reuse the exact same document id. Firestore Rules allow Picker create only,
            // so a late first write/Agent ACK cannot be overwritten by this retry.
            try {
                Tasks.await(doc.set(fields), CREATE_RETRY_WAIT_SECONDS, TimeUnit.SECONDS)
                log("D130 Firestore CREATE RETRY PASS request=" + shortId(requestId))
                return
            } catch (second: Exception) {
                log("D134 Firestore create retry failed request=" + shortId(requestId) +
                    " reason=" + safeText(second.message))
                if (requestExistsOnServer(doc, requestId, ownerUid)) {
                    log("D130 Firestore CREATE RECOVERED request=" + shortId(requestId) + " phase=verify2")
                    return
                }
                throw IOException("Không gửi được yêu cầu Xác nhận đơn qua Firestore.", second)
            }
        }
    }

    private fun requestExistsOnServer(
        doc: DocumentReference,
        requestId: String,
        ownerUid: String,
    ): Boolean {
        return try {
            val snapshot = Tasks.await(
                doc.get(Source.SERVER),
                CREATE_VERIFY_WAIT_SECONDS,
                TimeUnit.SECONDS,
            )
            if (!snapshot.exists()) return false
            val status = snapshot.getString("status").orEmpty()
            snapshot.getString("request_id") == requestId &&
                snapshot.getString("picker_uid") == ownerUid &&
                snapshot.getString("source") == "ANDROID_CONFIRM_V1" &&
                (status == "PENDING" || status == "ACK")
        } catch (_: Exception) {
            false
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
        val sessionGeneration = payload.optLong("app_session_generation", 0L).coerceAtLeast(0L)
        return RelayFirebaseIdentity(uid, audience, fingerprint(uid), sessionGeneration)
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
