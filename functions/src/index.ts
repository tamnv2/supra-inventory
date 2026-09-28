import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { GoogleAuth } from "google-auth-library";

initializeApp();

const REGION = "asia-southeast1";
const RUNTIME_SA = "inventory-beta-alert-runtime@supra-inventory-beta.iam.gserviceaccount.com";
const WORKER_ORIGIN = "https://inventory-beta.supra.cc.cd";
const MAX_ALERT_TTL_MS = 6 * 60 * 60 * 1000;
const PICKER_ACTIVE_CALL_TTL_MS = 60 * 1000;
const MAX_SKU_ITEMS = 1000;

setGlobalOptions({
  region: REGION,
  serviceAccount: RUNTIME_SA,
  maxInstances: 3,
  concurrency: 20,
  memory: "256MiB",
  timeoutSeconds: 60,
});

type AlertRecord = {
  alert_id?: string;
  target_user_id?: string;
  command_type?: string;
  message?: string;
  status?: string;
  source?: string;
  expires_at_ms?: number;
};

type ActiveCallRecord = {
  call_id?: string;
  target_user_id?: string;
  command_type?: string;
  message?: string;
  status?: string;
  source?: string;
  sender_user_id?: string;
  sender_agent_id?: string;
  sender_role?: string;
  created_at_ms?: number;
  lock_until_ms?: number;
};

function safeCode(error: unknown): string {
  if (error instanceof Error) return error.name.slice(0, 80) || "ERROR";
  return "ERROR";
}

async function alertWindowOpen(): Promise<boolean> {
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(WORKER_ORIGIN);
  const response = await client.request<{ is_open?: boolean }>({
    url: `${WORKER_ORIGIN}/api/internal/d119/alert-window`,
    method: "GET",
    timeout: 10_000,
  });
  return response.data?.is_open === true;
}

export const pickerActiveCallCreated = onDocumentWritten("picker_active_calls/{targetUserId}", async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;
  if (!after || !after.exists) return;
  const call = after.data() as ActiveCallRecord;
  const targetUserId = String(call.target_user_id || event.params.targetUserId || "").trim();
  const callId = String(call.call_id || "").trim();
  const senderRole = String(call.sender_role || "").trim();
  const previousStatus = before?.exists ? String(before.get("status") || "") : "";
  const previousCallId = before?.exists ? String(before.get("call_id") || "") : "";
  if (
    call.status !== "ACTIVE" ||
    call.source !== "AGENT_PICKER_ACTIVE_CALL_V2" ||
    call.command_type !== "CALL_SPECIALIST" ||
    targetUserId !== String(event.params.targetUserId || "") ||
    !callId ||
    !["INVENTORY", "PICK_PACK"].includes(senderRole) ||
    (previousStatus === "ACTIVE" && previousCallId === callId)
  ) return;

  const title = senderRole === "PICK_PACK"
    ? "YÊU CẦU TỪ CHUYÊN VIÊN PICK PACK"
    : "YÊU CẦU TỪ CHUYÊN VIÊN INVENTORY";
  const fallbackBody = senderRole === "PICK_PACK"
    ? "Vui lòng di chuyển về bàn chuyên viên Pick Pack để phối hợp xử lý công việc."
    : "Vui lòng di chuyển về bàn chuyên viên Inventory để phối hợp xử lý công việc.";
  const body = String(call.message || "").slice(0, 500) || fallbackBody;

  const db = getFirestore();
  const target = await db.doc(`picker_notification_targets/${targetUserId}`).get();
  const token = target.exists && target.get("enabled") === true ? String(target.get("token") || "") : "";
  if (!token) return;

  try {
    const lockUntilMs = Number(call.lock_until_ms || 0);
    await getMessaging().send({
      token,
      data: {
        event: "picker_command",
        alert_id: callId,
        command_type: "CALL_SPECIALIST",
        notification_title: title,
        notification_body: body,
        expires_at_ms: String(lockUntilMs > Date.now() ? lockUntilMs : Date.now() + PICKER_ACTIVE_CALL_TTL_MS),
      },
      android: { priority: "high", ttl: PICKER_ACTIVE_CALL_TTL_MS },
    });
  } catch (error) {
    console.error("picker_active_call_push_failed", safeCode(error));
  }
});

export const pickerActiveCallResolved = onDocumentUpdated("picker_active_calls/{targetUserId}", async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;
  if (!before || !after) return;
  if (String(before.get("status") || "") !== "ACTIVE" || String(after.get("status") || "") !== "RESOLVED") return;

  const targetUserId = String(after.get("target_user_id") || event.params.targetUserId || "").trim();
  const callId = String(after.get("call_id") || "").trim();
  if (!targetUserId || !callId) return;

  const db = getFirestore();
  const target = await db.doc(`picker_notification_targets/${targetUserId}`).get();
  const token = target.exists && target.get("enabled") === true ? String(target.get("token") || "") : "";
  if (!token) return;
  try {
    await getMessaging().send({
      token,
      data: {
        event: "picker_command_resolved",
        alert_id: callId,
        notification_title: "Yêu cầu đã kết thúc",
        notification_body: "Yêu cầu từ chuyên viên đã được kết thúc.",
      },
      android: { priority: "high", ttl: 10 * 60 * 1000 },
    });
  } catch (error) {
    console.error("picker_active_call_close_push_failed", safeCode(error));
  }
});

export const pickerAlertCreated = onDocumentCreated("picker_alerts/{alertId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const alert = snapshot.data() as AlertRecord;
  const alertId = String(alert.alert_id || event.params.alertId || "").trim();
  const targetUserId = String(alert.target_user_id || "").trim();
  const commandType = String(alert.command_type || "").trim();
  const expiresAtMs = Number(alert.expires_at_ms || 0);
  const now = Date.now();

  if (
    alert.status !== "PENDING" ||
    alert.source !== "AGENT_PICKER_CONTACT_V1" ||
    !alertId ||
    !targetUserId ||
    !["CALL_SPECIALIST", "BRING_TO_PACK", "CHAT_MESSAGE"].includes(commandType) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= now ||
    expiresAtMs > now + MAX_ALERT_TTL_MS
  ) {
    await snapshot.ref.set({
      status: "REJECTED",
      completed_at: FieldValue.serverTimestamp(),
      result_code: "INVALID_OR_EXPIRED_ALERT",
    }, { merge: true });
    return;
  }

  const db = getFirestore();
  await snapshot.ref.set({ server_created_at: FieldValue.serverTimestamp() }, { merge: true });
  const latest = await snapshot.ref.get();
  if (!latest.exists || latest.get("status") !== "PENDING") return;

  let windowOpen = false;
  try { windowOpen = await alertWindowOpen(); } catch { windowOpen = false; }
  if (!windowOpen) {
    await snapshot.ref.set({
      status: "WINDOW_CLOSED",
      completed_at: FieldValue.serverTimestamp(),
      result_code: "ANDROID_ALERT_WINDOW_CLOSED",
    }, { merge: true });
    return;
  }

  const presence = await db.doc("picker_presence_projection/current").get();
  const pickers = presence.exists && Array.isArray(presence.get("pickers")) ? presence.get("pickers") as Array<Record<string, unknown>> : [];
  const online = pickers.some((picker) => String(picker.user_id || "") === targetUserId);
  if (!online) {
    await snapshot.ref.set({
      status: "TARGET_OFFLINE",
      completed_at: FieldValue.serverTimestamp(),
      result_code: "PDA_NOT_READY",
    }, { merge: true });
    return;
  }

  const target = await db.doc(`picker_notification_targets/${targetUserId}`).get();
  const token = target.exists && target.get("enabled") === true ? String(target.get("token") || "") : "";
  if (!token) {
    await snapshot.ref.set({
      status: "TARGET_OFFLINE",
      completed_at: FieldValue.serverTimestamp(),
      result_code: "FCM_TARGET_NOT_READY",
    }, { merge: true });
    return;
  }

  try {
    const messageId = await getMessaging().send({
      token,
      data: {
        event: "picker_command",
        alert_id: alertId,
        command_type: commandType,
        notification_title: commandType === "CHAT_MESSAGE"
          ? "Chuyên viên gửi thông báo tới bạn:"
          : commandType === "CALL_SPECIALIST"
            ? "Yêu cầu về bàn Chuyên viên"
            : "Yêu cầu lấy hàng về bàn Pack",
        notification_body: commandType === "CHAT_MESSAGE"
          ? (("- " + (String(alert.message || "").slice(0, 200) || "Có thông báo mới.")) + "\n\nHãy đọc kĩ và thực hiện theo!")
          : (String(alert.message || "").slice(0, 500) || (
              commandType === "CALL_SPECIALIST"
                ? "Vui lòng về bàn Chuyên viên để xử lý."
                : "Vui lòng lấy hàng về bàn Pack."
            )),
        expires_at_ms: String(expiresAtMs),
      },
      android: {
        priority: "high",
        ttl: Math.max(1_000, Math.min(MAX_ALERT_TTL_MS, expiresAtMs - now)),
      },
    });
    await snapshot.ref.set({
      status: "SENT",
      sent_at: FieldValue.serverTimestamp(),
      result_code: "FCM_ACCEPTED",
      fcm_message_id: messageId,
    }, { merge: true });
  } catch (error) {
    await snapshot.ref.set({
      status: "FAILED",
      completed_at: FieldValue.serverTimestamp(),
      result_code: safeCode(error),
    }, { merge: true });
  }
});

export const pickerAlertResolved = onDocumentUpdated("picker_alerts/{alertId}", async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;
  if (!before || !after) return;
  const previousStatus = String(before.get("status") || "");
  const status = String(after.get("status") || "");
  if (previousStatus === "RESOLVED" || status !== "RESOLVED") return;

  const targetUserId = String(after.get("target_user_id") || "").trim();
  const alertId = String(after.get("alert_id") || event.params.alertId || "").trim();
  if (!targetUserId || !alertId) return;

  const db = getFirestore();
  await after.ref.set({ server_resolved_at: FieldValue.serverTimestamp() }, { merge: true });
  const target = await db.doc(`picker_notification_targets/${targetUserId}`).get();
  const token = target.exists && target.get("enabled") === true ? String(target.get("token") || "") : "";
  if (!token) return;

  try {
    await getMessaging().send({
      token,
      data: {
        event: "picker_command_resolved",
        alert_id: alertId,
        notification_title: "Yêu cầu đã hoàn tất",
        notification_body: "Chuyên viên đã xác nhận xử lý.",
      },
      android: { priority: "high", ttl: 10 * 60 * 1000 },
    });
    await after.ref.set({
      close_push_at: FieldValue.serverTimestamp(),
      close_push_result: "FCM_ACCEPTED",
    }, { merge: true });
  } catch (error) {
    await after.ref.set({
      close_push_at: FieldValue.serverTimestamp(),
      close_push_result: safeCode(error),
    }, { merge: true });
  }
});
