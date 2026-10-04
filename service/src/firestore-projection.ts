import { getServiceAccountAccessToken } from "./hr-source";
import { onlinePickerProjectionData } from "./notifications-core";

interface ProjectionWriteEnv {
  FIREBASE_PROJECT_ID: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
}

interface ProjectionEnv extends ProjectionWriteEnv {
  INVENTORY_CORE: DurableObjectNamespace;
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { timestampValue: string }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
let cachedDatastoreToken: { value: string; expires_at_ms: number } | null = null;

function field(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value)) return { integerValue: String(Math.trunc(value)) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) fields[key] = field(child);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function document(fields: Record<string, unknown>): { fields: Record<string, FirestoreValue> } {
  return { fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, field(value)])) };
}

async function accessToken(env: ProjectionWriteEnv): Promise<string> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  const now = Date.now();
  if (cachedDatastoreToken && cachedDatastoreToken.expires_at_ms > now + 60_000) return cachedDatastoreToken.value;
  const value = (await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, DATASTORE_SCOPE)).accessToken;
  cachedDatastoreToken = { value, expires_at_ms: now + 50 * 60_000 };
  return value;
}

function documentUrl(env: ProjectionWriteEnv, collection: string, id: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
}


type OperatingScheduleProjection = {
  schedule_key: string;
  version: number;
  decision: string;
  decision_boundary_ms: number;
  open_until_ms: number;
  updated_at_ms: number;
  updated_by_agent_instance_id: string;
};

function firestoreString(fields: Record<string, { stringValue?: string; integerValue?: string }> | undefined, key: string): string {
  return String(fields?.[key]?.stringValue || "");
}

function firestoreInt(fields: Record<string, { stringValue?: string; integerValue?: string }> | undefined, key: string): number {
  const value = Number(fields?.[key]?.integerValue || 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export async function readOperatingScheduleProjectionExact(
  env: ProjectionWriteEnv,
): Promise<OperatingScheduleProjection | null> {
  const token = await accessToken(env);
  const response = await fetch(documentUrl(env, "relay_poc_coordination", "operating_schedule"), {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`OPERATING_SCHEDULE_EXACT_READ_HTTP_${response.status}`);
  const payload = (await response.json()) as {
    fields?: Record<string, { stringValue?: string; integerValue?: string }>;
  };
  const fields = payload.fields;
  const scheduleKey = firestoreString(fields, "schedule_key");
  const version = firestoreInt(fields, "version");
  const decision = firestoreString(fields, "decision").toUpperCase();
  const decisionBoundaryMs = firestoreInt(fields, "decision_boundary_ms");
  const openUntilMs = firestoreInt(fields, "open_until_ms");
  if (
    !/^\d{8}$/.test(scheduleKey) ||
    version <= 0 ||
    !["CONTINUE","STOP","MANUAL_ADJUST","EARLY_START","CANCEL_OVERTIME"].includes(decision) ||
    openUntilMs <= 0 ||
    openUntilMs < decisionBoundaryMs
  ) return null;
  return {
    schedule_key: scheduleKey,
    version,
    decision,
    decision_boundary_ms: decisionBoundaryMs,
    open_until_ms: openUntilMs,
    updated_at_ms: firestoreInt(fields, "updated_at_ms") || version,
    updated_by_agent_instance_id: firestoreString(fields, "updated_by_agent_instance_id"),
  };
}

export async function publishAgentSupportLogRequest(
  env: ProjectionWriteEnv,
  input: {
    request_id: string;
    trace_id: string;
    issued_at_ms: number;
    expires_at_ms: number;
    issued_by_user_id: string;
    issued_by_login: string;
  },
): Promise<void> {
  const token = await accessToken(env);
  const fields = document({
    support_request_id: input.request_id,
    support_trace_id: input.trace_id,
    support_issued_at_ms: Math.trunc(input.issued_at_ms),
    support_expires_at_ms: Math.trunc(input.expires_at_ms),
    support_issued_by_user_id: input.issued_by_user_id,
    support_issued_by_login: input.issued_by_login,
  }).fields;
  const mask = [
    "support_request_id",
    "support_trace_id",
    "support_issued_at_ms",
    "support_expires_at_ms",
    "support_issued_by_user_id",
    "support_issued_by_login",
  ].map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join("&");
  const response = await fetch(
    documentUrl(env, "relay_poc_coordination", "primary_handoff") + "?" + mask,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ fields }),
    },
  );
  if (!response.ok) throw new Error(`AGENT_SUPPORT_CONTROL_WRITE_HTTP_${response.status}`);
}

export async function publishPickerSessionRevocation(
  env: ProjectionWriteEnv,
  input: {
    user_id: string;
    firebase_uid: string;
    revoked_generation: number;
    kicked_at_ms: number;
    issued_by_user_id: string;
    issued_by_agent_instance_id: string;
  },
): Promise<void> {
  const token = await accessToken(env);
  const fields = document({
    firebase_uid: input.firebase_uid,
    user_id: input.user_id,
    revoked_generation: Math.max(1, Math.trunc(input.revoked_generation)),
    kicked_at_ms: Math.max(0, Math.trunc(input.kicked_at_ms)),
    kicked_by_user_id: input.issued_by_user_id,
    kicked_by_agent_id: input.issued_by_agent_instance_id,
    source: "D161_SINGLE_REVOKE_SERVER_AUTHORITY",
  }).fields;
  const mask = [
    "firebase_uid",
    "user_id",
    "revoked_generation",
    "kicked_at_ms",
    "kicked_by_user_id",
    "kicked_by_agent_id",
    "source",
  ].map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join("&");
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(
      documentUrl(env, "picker_session_controls", input.firebase_uid) + "?" + mask,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ fields }),
      },
    );
    if (response.ok) return;
    lastStatus = response.status;
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
  }
  throw new Error(`PICKER_SESSION_REVOKE_SIGNAL_HTTP_${lastStatus}`);
}

async function putDocument(
  env: ProjectionWriteEnv,
  collection: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const token = await accessToken(env);
  const response = await fetch(documentUrl(env, collection, id), {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(document(fields)),
  });
  if (!response.ok) throw new Error(`FIRESTORE_PROJECTION_WRITE_HTTP_${response.status}`);
}

async function deleteDocument(env: ProjectionWriteEnv, collection: string, id: string): Promise<void> {
  const token = await accessToken(env);
  const response = await fetch(documentUrl(env, collection, id), {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`FIRESTORE_PROJECTION_DELETE_HTTP_${response.status}`);
}

export async function clearPickerNotificationTargets(
  env: ProjectionWriteEnv,
  userIds: string[],
): Promise<number> {
  const unique = [...new Set(
    (userIds || [])
      .map((value) => String(value || "").trim())
      .filter((value) => /^[A-Za-z0-9._:-]{1,180}$/.test(value)),
  )].slice(0, 2000);
  if (!unique.length) return 0;

  const token = await accessToken(env);
  let deleted = 0;
  for (let offset = 0; offset < unique.length; offset += 450) {
    const chunk = unique.slice(offset, offset + 450);
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          writes: chunk.map((userId) => ({
            delete: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/picker_notification_targets/${userId}`,
          })),
        }),
      },
    );
    if (!response.ok) throw new Error(`FIRESTORE_NOTIFICATION_TARGET_BULK_DELETE_HTTP_${response.status}`);
    deleted += chunk.length;
  }
  return deleted;
}

export async function mirrorPickerNotificationTarget(
  env: ProjectionEnv,
  input: {
    user_id: string;
    device_id: string;
    platform: string;
    token?: string;
    enabled: boolean;
  },
): Promise<void> {
  const userId = input.user_id.trim();
  if (!userId) return;
  if (!input.enabled) {
    await deleteDocument(env, "picker_notification_targets", userId);
    return;
  }
  if (input.platform !== "ANDROID" || !input.token) return;
  await putDocument(env, "picker_notification_targets", userId, {
    user_id: userId,
    device_id: input.device_id,
    token: input.token,
    platform: "ANDROID",
    enabled: true,
    updated_at: new Date().toISOString(),
  });
}

type PickerProjectionPayload = {
  items?: Array<{
    user_id?: unknown;
    firebase_uid?: unknown;
    session_generation?: unknown;
    source?: unknown;
    employee_code?: unknown;
    display_name?: unknown;
    contractor_name?: unknown;
    device_id?: unknown;
    login_at?: unknown;
    device_seen_at?: unknown;
    status?: unknown;
  }>;
  generated_at?: unknown;
  semantic_signature?: unknown;
  projection_current?: unknown;
};
type PresenceRemoval = { user_id: string; session_generation: number };
function normalizePresenceRemovals(rows: PresenceRemoval[]): PresenceRemoval[] {
  const latest = new Map<string, number>();
  for (const row of rows || []) {
    const userId = String(row?.user_id || "").trim(), generation = Math.max(0, Math.trunc(Number(row?.session_generation || 0)));
    if (!userId || generation <= 0) continue;
    latest.set(userId, Math.max(generation, latest.get(userId) || 0));
  }
  return [...latest.entries()].map(([user_id, session_generation]) => ({ user_id, session_generation }));
}

async function writePickerPresenceProjection(
  env: ProjectionWriteEnv,
  payload: PickerProjectionPayload,
  reason = "SNAPSHOT_REFRESH",
  writeProjection = true,
  removals: PresenceRemoval[] = [],
): Promise<void> {
  const pickers = (payload.items || []).slice(0, 2000).map((item) => ({
    user_id: String(item.user_id || ""),
    firebase_uid: String(item.firebase_uid || ""),
    session_generation: Number(item.session_generation || 0),
    source: String(item.source || "LOGIN") === "PICKLIST" ? "PICKLIST" : "LOGIN",
    employee_code: String(item.employee_code || ""),
    display_name: String(item.display_name || ""),
    contractor_name: String(item.contractor_name || ""),
    device_id: String(item.device_id || ""),
    login_at: item.login_at || null,
    device_seen_at: item.device_seen_at || null,
    status: "PDA_READY",
  }));
  const now = new Date();
  if (writeProjection) {
    await putDocument(env, "picker_presence_projection", "current", {
      schema_version: 4,
      presence_source: "ANDROID_SESSION_AUTHORITY",
      updated_at: now.toISOString(),
      source_generated_at: payload.generated_at || null,
      count: pickers.length,
      pickers,
    });
  }

  // D132: one fixed single-slot control event restores event-driven delivery to
  // the current PRIMARY without adding a new poll loop or per-PDA heartbeat.
  // Repeated changes overwrite this same document; Agent ACK is race-safe by updateTime.
  await putDocument(env, "relay_poc_jobs", "picker_presence_current", {
    request_id: "picker_presence_current",
    status: "PENDING",
    source: "ANDROID_PRESENCE_V1",
    created_at: now,
    schema_version: 4,
    reason,
    removed_sessions_json: JSON.stringify(normalizePresenceRemovals(removals)),
    count: pickers.length,
    pickers,
  });
}

export async function syncPickerPresenceProjection(env: ProjectionEnv, reason = "SNAPSHOT_REFRESH", removals: PresenceRemoval[] = []): Promise<void> {
  const core = env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
  const response = await core.fetch("https://inventory-core.internal/notifications/online-pickers");
  if (!response.ok) throw new Error("ONLINE_PICKERS_HTTP_" + response.status);
  const payload = (await response.json()) as PickerProjectionPayload;
  const semanticSignature = String(payload.semantic_signature || "");
  const projectionCurrent = payload.projection_current === true && /^[0-9a-f]{64}$/.test(semanticSignature);
  const normalizedRemovals = normalizePresenceRemovals(removals);
  if (projectionCurrent && normalizedRemovals.length === 0) return;
  await writePickerPresenceProjection(env, payload, reason, !projectionCurrent, normalizedRemovals);
  if (!projectionCurrent) {
    const ack = await core.fetch("https://inventory-core.internal/notifications/online-pickers/projection-ack", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature: semanticSignature }) });
    if (!ack.ok) throw new Error("ONLINE_PICKERS_PROJECTION_ACK_HTTP_" + ack.status);
  }
}

export async function syncPickerPresenceProjectionFromState(
  state: DurableObjectState,
  env: ProjectionWriteEnv,
  excludeConnectionId = "",
  reason = "SOCKET_CHANGE",
): Promise<void> {
  await writePickerPresenceProjection(
    env,
    onlinePickerProjectionData(state, excludeConnectionId) as PickerProjectionPayload,
    reason,
  );
}

type AgentKickSnapshot = {
  user_id?: unknown;
  firebase_uid?: unknown;
  revoked_generation?: unknown;
  kicked_at_ms?: unknown;
};

function restStringField(fields: Record<string, { stringValue?: string }> | undefined, key: string): string {
  return String(fields?.[key]?.stringValue || "");
}

export async function reconcileRecentAgentKicks(env: ProjectionEnv): Promise<void> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) return;
  const token = await accessToken(env);
  const response = await fetch(documentUrl(env, "relay_poc_coordination", "agent_sync"), {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`AGENT_KICK_RECONCILE_READ_HTTP_${response.status}`);

  const payload = await response.json() as {
    fields?: Record<string, { stringValue?: string }>;
  };
  const raw = restStringField(payload.fields, "kicks_json");
  if (!raw) return;

  let rows: AgentKickSnapshot[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) rows = parsed.slice(0, 500);
  } catch {
    throw new Error("AGENT_KICK_RECONCILE_INVALID_JSON");
  }

  const now = Date.now();
  const recent = rows.filter((row) => {
    const kickedAtMs = Number(row.kicked_at_ms || 0);
    return kickedAtMs > 0 && kickedAtMs <= now + 60_000 && now - kickedAtMs <= 15 * 60_000;
  });
  if (!recent.length) return;

  const core = env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
  const removals: PresenceRemoval[] = [];
  for (const row of recent) {
    const userId = String(row.user_id || "").trim();
    const firebaseUid = String(row.firebase_uid || "").trim();
    const revokedGeneration = Math.max(0, Math.trunc(Number(row.revoked_generation || 0)));
    if (!userId || !firebaseUid || revokedGeneration <= 0) continue;
    const revoke = await core.fetch("https://inventory-core.internal/auth/revoke-android-session", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        firebase_uid: firebaseUid,
        revoked_generation: revokedGeneration,
        force_current: false,
      }),
    });
    if (!revoke.ok && revoke.status !== 404) {
      throw new Error(`AGENT_KICK_RECONCILE_CORE_HTTP_${revoke.status}`);
    }
    const result = await revoke.json() as { status?: string };
    if (result.status === "android_session_revoked") {
      removals.push({ user_id: userId, session_generation: revokedGeneration });
      await deleteDocument(env, "picker_notification_targets", userId).catch(() => undefined);
    }
  }
  if (removals.length) await syncPickerPresenceProjection(env, "AGENT_KICK_SCHEDULED_RECONCILE", removals);
}

export async function refreshPickerProjectionBestEffort(env: ProjectionEnv, reason = "SNAPSHOT_REFRESH", removals: PresenceRemoval[] = []): Promise<void> {
  try {
    await syncPickerPresenceProjection(env, reason, removals);
  } catch {
    // D119 projection failure must never roll back existing login/device business behavior.
  }
}
