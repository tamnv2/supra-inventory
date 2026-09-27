package cd.cc.supra.inventory.beta

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

class PickerActiveCallWatcher(
    context: Context,
    private val log: (String) -> Unit = {},
) {
    private val appContext = context.applicationContext
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()
    private var registration: ListenerRegistration? = null
    private var activeCallId: String = ""
    private var activeUserId: String = ""

    fun start(session: AppSession) {
        close()
        if (session.role != "PICKER") return
        val token = session.relayCustomToken
        if (token.isNullOrBlank()) {
            log("D131 active-call watch deferred: relay custom token unavailable")
            return
        }
        activeUserId = session.userId

        val existing = auth.currentUser
        if (existing != null) {
            attach(session.userId)
            return
        }

        auth.signInWithCustomToken(token)
            .addOnSuccessListener {
                if (activeUserId == session.userId) attach(session.userId)
            }
            .addOnFailureListener { error ->
                log("D131 active-call auth deferred: " + safe(error.message))
            }
    }

    fun reconcile(session: AppSession?) {
        if (session == null || session.role != "PICKER") {
            close()
            return
        }
        if (registration == null || activeUserId != session.userId) start(session)
    }

    private fun attach(userId: String) {
        registration?.remove()
        registration = firestore.collection("picker_active_calls").document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    log("D131 active-call listener deferred: " + safe(error.message))
                    return@addSnapshotListener
                }
                val status = snapshot?.getString("status").orEmpty()
                val callId = snapshot?.getString("call_id").orEmpty()
                if (snapshot?.exists() == true && status == "ACTIVE" && callId.isNotBlank()) {
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
                        Long.MAX_VALUE,
                    )
                    log("D131 active-call visible call=" + callId.take(10))
                } else {
                    val previous = activeCallId
                    activeCallId = ""
                    if (previous.isNotBlank()) {
                        CriticalOverlayService.clear(appContext, previous)
                        log("D131 active-call cleared call=" + previous.take(10))
                    }
                }
            }
    }

    fun close() {
        registration?.remove()
        registration = null
        activeUserId = ""
    }

    private fun safe(value: String?): String =
        value.orEmpty()
            .replace(Regex("(?i)(authorization|bearer|token|password|secret|api[_ -]?key)\\s*[:=]\\s*[^\\s,;]+")) {
                it.groupValues[1] + "=[REDACTED]"
            }
            .take(180)
}
