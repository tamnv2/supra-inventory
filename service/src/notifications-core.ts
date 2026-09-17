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

function targetUsersForRoles(state: DurableObjectState, roles: string[]): string[] {
  const allowed = [...new Set(roles.filter((role) => ["PICKER", "REPORTER", "ADMIN", "ROOT"].includes(role)))];
  if (!allowed.length) return [];
  const placeholders = allowed.map(() => "?").join(",");
  return state.storage.sql
    .exec<SqlRow>(`SELECT user_id FROM users WHERE status = 'ACTIVE' AND role IN (${placeholders})`, ...allowed)
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

export async function handleNotificationCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/notifications/device/upsert") return upsertDevice(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/device/remove") return removeDevice(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/targets") return notificationTargets(state, request);
  return null;
}
