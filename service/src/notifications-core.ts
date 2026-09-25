import { readAndroidAlertWindow, updateAndroidAlertWindow } from "./alert-window-core";
type SqlRow = Record<string, SqlStorageValue>;

type DeviceBody = {
  user_id?: string;
  device_id?: string;
  token?: string;
  platform?: string;
};

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function validUserId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function validDeviceId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}

async function upsertDevice(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as DeviceBody;
  const userId = String(body.user_id || "").trim();
  const deviceId = String(body.device_id || "").trim();
  const token = String(body.token || "").trim();
  const platform = String(body.platform || "ANDROID").toUpperCase();
  if (!validUserId(userId) || !validDeviceId(deviceId) || !token || token.length > 4096 || !["ANDROID", "WEB"].includes(platform)) {
    return response({ error: "INVALID_NOTIFICATION_DEVICE" }, 400);
  }
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO fcm_devices (device_id, user_id, platform, token, enabled, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET
       user_id = excluded.user_id,
       platform = excluded.platform,
       token = excluded.token,
       enabled = 1,
       last_seen_at = excluded.last_seen_at,
       updated_at = excluded.updated_at`,
    deviceId, userId, platform, token, at, at, at,
  );
  return response({ status: "registered", device_id: deviceId, platform, registered_at: at });
}

async function removeDevice(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as DeviceBody;
  const userId = String(body.user_id || "").trim();
  const deviceId = String(body.device_id || "").trim();
  if (!validUserId(userId) || !validDeviceId(deviceId)) return response({ error: "INVALID_NOTIFICATION_DEVICE" }, 400);
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `UPDATE fcm_devices SET enabled = 0, updated_at = ?, last_seen_at = ? WHERE device_id = ? AND user_id = ?`,
    at, at, deviceId, userId,
  );
  return response({ status: "unregistered", device_id: deviceId, unregistered_at: at });
}

type RealtimePickerAttachment = {
  connection_id?: string;
  user_id?: string;
  role?: string;
  client_type?: string;
};

export function onlinePickerProjectionData(
  state: DurableObjectState,
  excludeConnectionId = "",
): {
  items: Array<Record<string, unknown>>;
  count: number;
  generated_at: string;
  operating_window_open: boolean;
  overtime_until_ms: number | null;
} {
  const windowState = readAndroidAlertWindow(state);
  if (!windowState.is_open) {
    return {
      items: [],
      count: 0,
      generated_at: windowState.server_now,
      operating_window_open: false,
      overtime_until_ms: windowState.overtime_until_ms,
    };
  }

  // D120 field hotfix: a persisted login/device registration is necessary but not
  // sufficient to call a PDA "online". The live list is bounded to Picker Android
  // realtime sockets that are actually attached to InventoryCore right now.
  // This reuses the accepted D098 hibernatable WebSocket and adds no PDA heartbeat.
  const activePickerIds = new Set<string>();
  for (const socket of state.getWebSockets("role:PICKER")) {
    const attachment = socket.deserializeAttachment() as RealtimePickerAttachment | null;
    if (!attachment?.user_id) continue;
    if (excludeConnectionId && attachment.connection_id === excludeConnectionId) continue;
    if (attachment.role !== "PICKER" || attachment.client_type !== "ANDROID") continue;
    activePickerIds.add(String(attachment.user_id));
  }

  if (!activePickerIds.size) {
    return {
      items: [],
      count: 0,
      generated_at: windowState.server_now,
      operating_window_open: true,
      overtime_until_ms: windowState.overtime_until_ms,
    };
  }

  const userIds = [...activePickerIds].slice(0, 2000);
  const placeholders = userIds.map(() => "?").join(",");
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT u.user_id,
            COALESCE(u.employee_code, '') AS employee_code,
            u.display_name,
            u.android_session_started_at AS login_at,
            f.device_id,
            MAX(f.last_seen_at) AS device_seen_at
       FROM users u
       JOIN fcm_devices f
         ON f.user_id = u.user_id
        AND f.platform = 'ANDROID'
        AND f.enabled = 1
        AND u.android_session_device_id = ('android:' || f.device_id)
      WHERE u.role = 'PICKER'
        AND u.status = 'ACTIVE'
        AND u.android_session_device_id IS NOT NULL
        AND u.android_session_device_id <> ''
        AND u.user_id IN (${placeholders})
      GROUP BY u.user_id, u.employee_code, u.display_name, u.android_session_started_at, f.device_id
      ORDER BY COALESCE(u.employee_code, u.user_id) ASC, u.display_name ASC`,
    ...userIds,
  ).toArray().map((row) => ({
    user_id: String(row.user_id || ""),
    employee_code: String(row.employee_code || ""),
    display_name: String(row.display_name || ""),
    device_id: String(row.device_id || ""),
    login_at: row.login_at == null ? null : String(row.login_at),
    device_seen_at: row.device_seen_at == null ? null : String(row.device_seen_at),
    status: "PDA_READY",
  }));

  return {
    items: rows,
    count: rows.length,
    generated_at: windowState.server_now,
    operating_window_open: true,
    overtime_until_ms: windowState.overtime_until_ms,
  };
}

function onlinePickerProjection(state: DurableObjectState): Response {
  return response(onlinePickerProjectionData(state));
}

function targetUsersForRoles(state: DurableObjectState, roles: string[]): string[] {
  const allowed = [...new Set(roles.filter((role) => ["PICKER", "REPORTER", "ADMIN", "ROOT"].includes(role)))];
  if (!allowed.length) return [];
  const placeholders = allowed.map(() => "?").join(",");
  return state.storage.sql
    .exec<SqlRow>(`SELECT user_id FROM users WHERE status = 'ACTIVE' AND (CASE WHEN role = 'ROOT' AND role_override IN ('PICKER','REPORTER','ADMIN') THEN role_override ELSE role END) IN (${placeholders})`, ...allowed)
    .toArray()
    .map((row) => String(row.user_id || "").trim())
    .filter(Boolean);
}

function targetUsersForBatch(state: DurableObjectState, batchId: string): string[] {
  if (!batchId) return [];
  return state.storage.sql
    .exec<SqlRow>(
      `SELECT DISTINCT picker_user_id AS user_id
         FROM report_tickets
        WHERE batch_id = ?
          AND status = 'RESOLVED'
          AND picker_user_id IS NOT NULL
          AND picker_user_id <> ''`,
      batchId,
    )
    .toArray()
    .map((row) => String(row.user_id || "").trim())
    .filter(Boolean);
}

function targetUsersForResultEvent(state: DurableObjectState, resultEventId: string): string[] {
  if (!resultEventId) return [];
  return state.storage.sql
    .exec<SqlRow>(
      `SELECT DISTINCT target_user_id AS user_id
         FROM result_acknowledgements
        WHERE result_event_id = ?`,
      resultEventId,
    )
    .toArray()
    .map((row) => String(row.user_id || "").trim())
    .filter(Boolean);
}

async function notificationTargets(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { roles?: unknown[]; user_ids?: unknown[]; batch_id?: string; result_event_id?: string };
  const users = new Set<string>();
  for (const value of Array.isArray(body.user_ids) ? body.user_ids : []) {
    const userId = String(value).trim();
    if (validUserId(userId)) users.add(userId);
  }
  for (const userId of targetUsersForRoles(state, (Array.isArray(body.roles) ? body.roles : []).map(String))) users.add(userId);
  const batchId = String(body.batch_id || "").trim();
  const resultEventId = String(body.result_event_id || "").trim();
  const resultTargets = targetUsersForResultEvent(state, resultEventId);
  if (resultTargets.length) {
    for (const userId of resultTargets) users.add(userId);
  } else {
    for (const userId of targetUsersForBatch(state, batchId)) users.add(userId);
  }

  const tokens = new Set<string>();
  for (const userId of users) {
    const rows = state.storage.sql
      .exec<SqlRow>(
        `SELECT token FROM fcm_devices WHERE user_id = ? AND enabled = 1 ORDER BY last_seen_at DESC LIMIT 8`,
        userId,
      )
      .toArray();
    for (const row of rows) {
      const token = String(row.token || "").trim();
      if (token) tokens.add(token);
    }
  }

  let batch: Record<string, unknown> | null = null;
  if (batchId) {
    const row = state.storage.sql
      .exec<SqlRow>(`SELECT batch_id, sku, product_name, status, resolution FROM report_batches WHERE batch_id = ? LIMIT 1`, batchId)
      .toArray()[0];
    if (row) batch = row;
  }
  return response({ tokens: [...tokens].slice(0, 500), target_user_count: users.size, batch });
}

async function disableTokens(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { tokens?: unknown[] };
  const tokens = [...new Set((Array.isArray(body.tokens) ? body.tokens : []).map((value) => String(value).trim()).filter(Boolean))].slice(0, 500);
  if (!tokens.length) return response({ status: "noop", disabled: 0 });
  const at = new Date().toISOString();
  let disabled = 0;
  for (const token of tokens) {
    state.storage.sql.exec(
      "UPDATE fcm_devices SET enabled = 0, updated_at = ? WHERE token = ? AND enabled = 1",
      at,
      token,
    );
    const row = state.storage.sql.exec<SqlRow>(
      "SELECT changes() AS changed",
    ).toArray()[0];
    disabled += Number(row?.changed || 0);
  }
  return response({ status: "disabled", disabled });
}

async function recordDeliveryAttempts(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    event_id?: string | null;
    event?: string;
    attempts?: Array<{ token?: unknown; status?: unknown; error_code?: unknown }>;
  };
  const eventId = String(body.event_id || "").trim().slice(0, 128) || null;
  const eventType = String(body.event || "unknown").trim().slice(0, 100) || "unknown";
  const attempts = Array.isArray(body.attempts) ? body.attempts.slice(0, 500) : [];
  const at = new Date().toISOString();
  let recorded = 0;

  state.storage.transactionSync(() => {
    for (const attempt of attempts) {
      const token = String(attempt.token || "").trim();
      const status = String(attempt.status || "").toUpperCase();
      if (!token || !["SENT", "FAILED"].includes(status)) continue;
      const device = state.storage.sql.exec<SqlRow>(
        "SELECT device_id, user_id FROM fcm_devices WHERE token = ? LIMIT 1",
        token,
      ).toArray()[0];
      state.storage.sql.exec(
        `INSERT INTO notification_delivery_attempts (
           attempt_id, event_id, event_type, device_id, user_id, status, error_code, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(),
        eventId,
        eventType,
        device?.device_id == null ? null : String(device.device_id),
        device?.user_id == null ? null : String(device.user_id),
        status,
        String(attempt.error_code || "").trim().slice(0, 100) || null,
        at,
      );
      recorded += 1;
    }
    state.storage.sql.exec(
      `DELETE FROM notification_delivery_attempts
        WHERE attempt_id IN (
          SELECT attempt_id
            FROM notification_delivery_attempts
           ORDER BY created_at DESC, attempt_id DESC
           LIMIT -1 OFFSET 5000
        )`,
    );
  });
  return response({ status: "recorded", recorded });
}

export async function handleNotificationCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/notifications/alert-window") {
    return response(readAndroidAlertWindow(state));
  }
  if (request.method === "PUT" && url.pathname === "/notifications/alert-window") {
    const body = (await request.json()) as { actor_user_id?: unknown; action?: unknown };
    const actorUserId = String(body.actor_user_id || "").trim();
    const action = String(body.action || "").trim().toUpperCase();
    if (!validUserId(actorUserId) || !["EXTEND_ONE_HOUR", "STOP_OVERTIME"].includes(action)) {
      return response({ error: "INVALID_ALERT_WINDOW_ACTION" }, 400);
    }
    try {
      return response(updateAndroidAlertWindow(
        state,
        actorUserId,
        action as "EXTEND_ONE_HOUR" | "STOP_OVERTIME",
      ));
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : "ALERT_WINDOW_UPDATE_FAILED" }, 409);
    }
  }
  if (request.method === "GET" && url.pathname === "/notifications/online-pickers") {
    return onlinePickerProjection(state);
  }
  if (request.method === "POST" && url.pathname === "/notifications/device/upsert") return upsertDevice(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/device/remove") return removeDevice(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/targets") return notificationTargets(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/disable-tokens") return disableTokens(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/delivery-attempts") return recordDeliveryAttempts(state, request);
  return null;
}
