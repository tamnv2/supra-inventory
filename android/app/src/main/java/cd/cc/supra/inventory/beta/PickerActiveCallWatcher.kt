package cd.cc.supra.inventory.beta

import android.content.Context
import android.util.Base64
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import org.json.JSONObject

class PickerActiveCallWatcher(
    context: Context,
    private val onSessionRevoked: () -> Unit = {},
    private val log: (String) -> Unit = {},
) {
    private val appContext = context.applicationContext
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()
    private var callRegistration: ListenerRegistration? = null
    private var sessionRegistration: ListenerRegistration? = null
    private var activeCallId: String = ""
    private var activeUserId: String = ""
    private var activeFirebaseUid: String = ""
    private var activeGeneration: Long = 0L
    @Volatile private var revokeDelivered = false

    fun start(session: AppSession) {
        close()
        if (session.role != "PICKER") return
        val token = session.relayCustomToken
        if (token.isNullOrBlank()) {
            log("D134 picker watch deferred: relay custom token unavailable")
            return
        }
        val identity = tokenIdentity(session.idToken)
        activeUserId = session.userId
        activeFirebaseUid = identity.first
        activeGeneration = identity.second
        revokeDelivered = false

        val existing = auth.currentUser
        if (existing != null && existing.uid == activeFirebaseUid) {
            attach(session.userId, activeFirebaseUid, activeGeneration)
            return
        }
        if (existing != null) auth.signOut()

        auth.signInWithCustomToken(token)
            .addOnSuccessListener { result ->
                if (activeUserId != session.userId || activeFirebaseUid != identity.first) return@addOnSuccessListener
                if (result.user?.uid != activeFirebaseUid) {
                    auth.signOut()
                    log("D134 picker watch auth rejected: Firebase identity mismatch")
                    return@addOnSuccessListener
                }
                attach(session.userId, activeFirebaseUid, activeGeneration)
            }
            .addOnFailureListener { error ->
                log("D134 picker watch auth deferred: " + safe(error.message))
            }
    }

    fun reconcile(session: AppSession?) {
        if (session == null || session.role != "PICKER") {
            close()
            return
        }
        val identity = try { tokenIdentity(session.idToken) } catch (_: Exception) { "" to 0L }
        if (callRegistration == null ||
            sessionRegistration == null ||
            activeUserId != session.userId ||
            activeFirebaseUid != identity.first ||
            activeGeneration != identity.second) {
            start(session)
        }
    }

    private fun attach(userId: String, firebaseUid: String, generation: Long) {
        callRegistration?.remove()
        sessionRegistration?.remove()

        callRegistration = firestore.collection("picker_active_calls").document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    log("D134 active-call listener reconnecting: " + safe(error.message))
                    return@addSnapshotListener
                }
                val status = snapshot?.getString("status").orEmpty()
                val callId = snapshot?.getString("call_id").orEmpty()
                val lockUntilMs = (snapshot?.getLong("lock_until_ms") ?: 0L).coerceAtLeast(0L)
                if (snapshot?.exists() == true &&
                    status == "ACTIVE" &&
                    callId.isNotBlank() &&
                    (lockUntilMs <= 0L || lockUntilMs > System.currentTimeMillis())) {
                    activeCallId = callId
                    val senderRole = snapshot.getString("sender_role").orEmpty()
                    val title = if (senderRole == "PICK_PACK") {
                        "YÊU CẦU TỪ CHUYÊN VIÊN PICK PACK"
                    } else {
                        "YÊU CẦU TỪ CHUYÊN VIÊN INVENTORY"
                    }
                    val body = snapshot.getString("message").orEmpty().ifBlank {
                        if (senderRole == "PICK_PACK") {
                            "Vui lòng di chuyển về bàn chuyên viên Pick Pack để phối hợp xử lý công việc."
                        } else {
                            "Vui lòng di chuyển về bàn chuyên viên Inventory để phối hợp xử lý công việc."
                        }
                    }
                    CriticalOverlayService.show(
                        appContext,
                        title,
                        body,
                        CriticalOverlayService.MODE_PICKER_COMMAND,
                        callId,
                        if (lockUntilMs > 0L) lockUntilMs else System.currentTimeMillis() + 60_000L,
                    )
                    log("D134 active-call visible call=" + callId.take(10))
                } else {
                    clearActiveCall()
                }
            }

        sessionRegistration = firestore.collection("picker_session_controls").document(firebaseUid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    log("D134 session-control listener reconnecting: " + safe(error.message))
                    return@addSnapshotListener
                }
                val revokedGeneration = (snapshot?.getLong("revoked_generation") ?: 0L).coerceAtLeast(0L)
                if (snapshot?.exists() == true &&
                    generation > 0L &&
                    revokedGeneration >= generation &&
                    !revokeDelivered) {
                    revokeDelivered = true
                    clearActiveCall()
                    log("D144 session revoked generation=$generation")
                    onSessionRevoked()
                    return@addSnapshotListener
                }

                val chatId = snapshot?.getString("chat_id").orEmpty()
                val chatType = snapshot?.getString("chat_command_type").orEmpty()
                val chatMessage = snapshot?.getString("chat_message").orEmpty().take(200)
                val chatExpiresAt = (snapshot?.getLong("chat_expires_at_ms") ?: 0L).coerceAtLeast(0L)
                if (snapshot?.exists() == true &&
                    chatType == "CHAT_MESSAGE" &&
                    chatId.isNotBlank() &&
                    chatMessage.isNotBlank() &&
                    chatExpiresAt > System.currentTimeMillis() &&
                    !NotificationSignalStore.isPickerChatDismissed(appContext, chatId)) {
                    CriticalOverlayService.show(
                        appContext,
                        "Chuyên viên gửi thông báo tới bạn:",
                        "- $chatMessage\n\nHãy đọc kĩ và thực hiện theo!",
                        CriticalOverlayService.MODE_PICKER_CHAT,
                        chatId,
                        chatExpiresAt,
                    )
                    log("D144 picker-chat visible id=" + chatId.take(12))
                }
            }
    }

    private fun clearActiveCall() {
        val previous = activeCallId
        activeCallId = ""
        if (previous.isNotBlank()) {
            CriticalOverlayService.clear(appContext, previous)
            log("D134 active-call cleared call=" + previous.take(10))
        }
    }

    fun close() {
        callRegistration?.remove()
        sessionRegistration?.remove()
        callRegistration = null
        sessionRegistration = null
        clearActiveCall()
        activeUserId = ""
        activeFirebaseUid = ""
        activeGeneration = 0L
        revokeDelivered = false
    }

    private fun tokenIdentity(idToken: String): Pair<String, Long> {
        val parts = idToken.split('.')
        if (parts.size != 3) throw IllegalStateException("Firebase ID token không hợp lệ.")
        val decoded = Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        val payload = JSONObject(String(decoded, Charsets.UTF_8))
        val uid = payload.optString("sub").trim()
        val generation = payload.optLong("app_session_generation", 0L).coerceAtLeast(0L)
        if (uid.isBlank()) throw IllegalStateException("Firebase UID trống.")
        return uid to generation
    }

    private fun safe(value: String?): String =
        value.orEmpty()
            .replace(Regex("(?i)(authorization|bearer|token|password|secret|api[_ -]?key)\\s*[:=]\\s*[^\\s,;]+")) {
                it.groupValues[1] + "=[REDACTED]"
            }
            .take(180)
}
