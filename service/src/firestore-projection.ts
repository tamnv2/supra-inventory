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
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function field(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
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
  return (await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, DATASTORE_SCOPE)).accessToken;
}

function documentUrl(env: ProjectionWriteEnv, collection: string, id: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
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
    employee_code?: unknown;
    display_name?: unknown;
    device_id?: unknown;
    login_at?: unknown;
    device_seen_at?: unknown;
    status?: unknown;
  }>;
  generated_at?: unknown;
};

async function writePickerPresenceProjection(
  env: ProjectionWriteEnv,
  payload: PickerProjectionPayload,
): Promise<void> {
  const pickers = (payload.items || []).slice(0, 2000).map((item) => ({
    user_id: String(item.user_id || ""),
    employee_code: String(item.employee_code || ""),
    display_name: String(item.display_name || ""),
    device_id: String(item.device_id || ""),
    login_at: item.login_at || null,
    device_seen_at: item.device_seen_at || null,
    status: "PDA_READY",
  }));
  await putDocument(env, "picker_presence_projection", "current", {
    schema_version: 2,
    presence_source: "ACTIVE_ANDROID_REALTIME",
    updated_at: new Date().toISOString(),
    source_generated_at: payload.generated_at || null,
    count: pickers.length,
    pickers,
  });
}

export async function syncPickerPresenceProjection(env: ProjectionEnv): Promise<void> {
  const core = env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
  const response = await core.fetch("https://inventory-core.internal/notifications/online-pickers");
  if (!response.ok) throw new Error(`ONLINE_PICKERS_HTTP_${response.status}`);
  await writePickerPresenceProjection(env, (await response.json()) as PickerProjectionPayload);
}

export async function syncPickerPresenceProjectionFromState(
  state: DurableObjectState,
  env: ProjectionWriteEnv,
  excludeConnectionId = "",
): Promise<void> {
  await writePickerPresenceProjection(
    env,
    onlinePickerProjectionData(state, excludeConnectionId) as PickerProjectionPayload,
  );
}

export async function refreshPickerProjectionBestEffort(env: ProjectionEnv): Promise<void> {
  try {
    await syncPickerPresenceProjection(env);
  } catch {
    // D119 projection failure must never roll back existing login/device business behavior.
  }
}
