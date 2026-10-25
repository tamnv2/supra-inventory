import { currentBatchSnapshot, handleOperationalV2CoreRequest, operationalV2Readiness, pickerCanReceiveRealtimeEvent, pickerRealtimeSnapshot, realtimeStreamMetadata } from "./operational-v2-core";

type SqlRow = Record<string, SqlStorageValue>;

type RealtimeRole = "PICKER" | "REPORTER" | "ADMIN" | "PICKPACK_ADMIN" | "ROOT";
type RealtimeClientType = "WEB" | "ANDROID";

type RealtimeTicket = {
  user_id: string;
  employee_code: string | null;
  display_name: string;
  role: RealtimeRole;
  client_type: RealtimeClientType;
  app_version?: string;
  expires_at: number;
};

type RealtimeAttachment = {
  connection_id: string;
  user_id: string;
  employee_code: string | null;
  display_name: string;
  role: RealtimeRole;
  client_type: RealtimeClientType;
  app_version?: string;
  connected_at: string;
};

const REALTIME_TICKET_PREFIX = "realtime-ticket:";
const REALTIME_TICKET_TTL_MS = 60_000;
const REALTIME_TAG_RE = /^(role:(PICKER|REPORTER|ADMIN|PICKPACK_ADMIN|ROOT)|user:[A-Za-z0-9._:-]{1,128}|client:(WEB|ANDROID))$/;

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

function limitOf(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function first(rows: SqlRow[]): SqlRow | null {
  return rows[0] ?? null;
}

function latestRealtimeSeq(state: DurableObjectState): number {
  const row = first(state.storage.sql.exec<SqlRow>("SELECT COALESCE(MAX(seq),0) AS latest_seq FROM realtime_events").toArray());
  return Number(row?.latest_seq || 0);
}

function skuCatalogInfo(state: DurableObjectState): Response {
  let row = state.storage.sql
    .exec<SqlRow>("SELECT item_count AS count, max_updated_at FROM sku_catalog_meta WHERE id = 1 LIMIT 1")
    .toArray()[0];
  if (!row) {
    row = state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS count, MAX(updated_at) AS max_updated_at FROM sku_master").toArray()[0] || {};
  }
  const full = state.storage.sql.exec<SqlRow>("SELECT last_full_day FROM d167_sku_meta WHERE id=1").toArray()[0];
  const live = full?.last_full_day
    ? state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS count FROM d167_sku_active WHERE active=1").toArray()[0]
    : null;
  const count = Number(live?.count ?? row.count ?? 0);
  const maxUpdatedAt = String(row.max_updated_at || "");
  const dayVn = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const lastFullDay = String(full?.last_full_day || "");
  const skuDayReady = lastFullDay === dayVn;

  const lastSync = state.storage.sql.exec<SqlRow>(
    `SELECT created_at, actor_user_id, metadata_json
       FROM audit_log
      WHERE action = 'SKU_IMPORT_CHUNK'
      ORDER BY created_at DESC, audit_id DESC
      LIMIT 1`,
  ).toArray()[0];
  let syncMetadata: Record<string, unknown> = {};
  if (lastSync?.metadata_json) {
    try { syncMetadata = JSON.parse(String(lastSync.metadata_json)) as Record<string, unknown>; }
    catch { syncMetadata = {}; }
  }

  return response({
    count,
    sku_day_ready: skuDayReady,
    sku_day_vn: dayVn,
    sku_day_last_full: lastFullDay || null,
    sku_day_warning: skuDayReady ? null : "Danh sách SKU chưa được cập nhật cho ngày hôm nay. Vui lòng liên hệ Chuyên viên Pick Pack / Invent để cập nhật trước khi vào ca.",
    max_updated_at: maxUpdatedAt || null,
    version: `${count}:${maxUpdatedAt}`,
    last_sync_at: lastSync?.created_at ? String(lastSync.created_at) : null,
    last_sync_by: lastSync?.actor_user_id ? String(lastSync.actor_user_id) : null,
    last_sync_total: Number(syncMetadata.total || 0),
    last_sync_inserted: Number(syncMetadata.inserted || 0),
    last_sync_updated: Number(syncMetadata.updated || 0),
    last_sync_unchanged: Number(syncMetadata.unchanged || 0),
  });
}

// D167: Admin-only source-attested history, queried only on the Web SKU workspace.
// Agent rows are durable DONE receipts; Web rows are authoritative audit writes.
// Neither catalog max_updated_at nor SKU_IMPORT_CHUNK alone proves an Agent FULL.
function skuCatalogProvenance(state: DurableObjectState): Response {
  type CatalogEvent = {
    source: "WEB" | "AGENT"; mode: "FULL" | "PATCH" | "DELTA";
    at: string; actor: string; slot: string | null; day_vn: string | null;
    total: number; created: number; updated: number; activated: number;
    hidden: number; unchanged: number; note: string;
  };
  const nonnegative = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  };
  const parse = (raw: unknown): Record<string, unknown> => {
    try {
      const obj: unknown = JSON.parse(String(raw || "{}"));
      return obj !== null && typeof obj === "object" && !Array.isArray(obj)
        ? obj as Record<string, unknown> : {};
    } catch { return {}; }
  };
  const webRows = state.storage.sql.exec<SqlRow>(`
    SELECT a.action,a.created_at,a.actor_employee_code,a.metadata_json,
           u.display_name AS verified_actor_name
    FROM audit_log a LEFT JOIN users u ON u.user_id=a.actor_user_id
    WHERE a.action IN ('SKU_IMPORT_CHUNK','SKU_WEB_FULL_REPLACE')
    ORDER BY a.created_at DESC, a.audit_id DESC LIMIT 6
  `).toArray();
  const agentRows = state.storage.sql.exec<SqlRow>(`
    SELECT day_vn,slot,complete_at,receipt_json
    FROM d167_sku_jobs WHERE state='DONE' AND complete_at IS NOT NULL
    ORDER BY complete_at DESC LIMIT 8
  `).toArray();
  // "Latest FULL" must remain exact even after many more DELTA/manual events.
  // Small indexed/local Durable Object SQL reads, only on admin SKU page entry.
  const lastFull = state.storage.sql.exec<SqlRow>(`
    SELECT day_vn,slot,complete_at,receipt_json FROM d167_sku_jobs
    WHERE state='DONE' AND slot='INITIAL_05' AND complete_at IS NOT NULL
    ORDER BY complete_at DESC LIMIT 1
  `).toArray()[0];
  const lastDelta = state.storage.sql.exec<SqlRow>(`
    SELECT day_vn,slot,complete_at,receipt_json FROM d167_sku_jobs
    WHERE state='DONE' AND slot<>'INITIAL_05' AND complete_at IS NOT NULL
    ORDER BY complete_at DESC LIMIT 1
  `).toArray()[0];
  const web: CatalogEvent[] = webRows.map(x => {
    const detail = parse(x.metadata_json);
    const full = x.action === "SKU_WEB_FULL_REPLACE";
    const name = String(x.verified_actor_name || "").trim().slice(0,100);
    const code = String(x.actor_employee_code || "").trim().slice(0,32);
    return {
      source:"WEB",mode:full?"FULL":"PATCH",at:String(x.created_at||""),
      actor:name ? (code ? name+" · "+code : name) : (code || "Tài khoản Web"),
      slot:null,day_vn:null,
      total:nonnegative(full?detail.source_rows:detail.total),
      created:nonnegative(full?detail.created:detail.inserted),
      updated:nonnegative(full?detail.renamed:detail.updated),
      activated:nonnegative(full?detail.reactivated:detail.reactivated),
      hidden:full?nonnegative(detail.hidden):0,
      unchanged:full?0:nonnegative(detail.unchanged),
      note:full?"FULL Web đã xác nhận":"Một lô PATCH từ Excel (không phải FULL)"
    };
  });
  const agentEvent = (x: SqlRow): CatalogEvent => {
    const detail = parse(x.receipt_json);
    const slot = String(x.slot||"");
    const full = slot === "INITIAL_05";
    const actor = String(detail.actor_display||"").trim().replace(/[\r\n\t]/g," ").slice(0,120);
    return {
      source:"AGENT",mode:full?"FULL":"DELTA",at:String(x.complete_at||""),
      actor:actor||"Agent đã xác thực",
      slot,day_vn:String(x.day_vn||""),
      total:nonnegative(detail.source_rows),
      created:nonnegative(detail.created),updated:nonnegative(detail.updated),
      activated:nonnegative(detail.activated),hidden:nonnegative(detail.hidden),
      unchanged:nonnegative(detail.unchanged),
      note:detail.source_unchanged===true?"Nguồn không đổi, không ghi lại SKU":
        (detail.manual===true?"Agent cập nhật thủ công":"Agent đồng bộ theo lịch")
    };
  };
  const agent: CatalogEvent[] = agentRows.map(agentEvent);
  const recent = [...web,...agent].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,8);
  return response({
    latest_web:web[0]||null,
    latest_agent_full:lastFull ? agentEvent(lastFull) : null,
    latest_agent_delta:lastDelta ? agentEvent(lastDelta) : null,
    recent,
    source_verified:true
  });
}

function skuCatalog(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"), 1000, 2000);
  const after = String(url.searchParams.get("after") || "");
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT sku, product_name, updated_at
         FROM sku_master
        WHERE sku > ? AND ((SELECT last_full_day FROM d167_sku_meta WHERE id=1) IS NULL
          OR EXISTS(SELECT 1 FROM d167_sku_active a WHERE a.sku=sku_master.sku AND a.active=1))
        ORDER BY sku ASC
        LIMIT ?`,
      after,
      limit,
    )
    .toArray();
  const nextAfter = rows.length === limit ? String(rows[rows.length - 1]?.sku || "") : null;
  return response({ items: rows, count: rows.length, next_after: nextAfter, limit });
}

function skuCatalogDelta(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"), 1000, 2000);
  const since = String(url.searchParams.get("since") || "").trim();
  const afterUpdatedAt = String(url.searchParams.get("after_updated_at") || since).trim();
  const afterSku = String(url.searchParams.get("after_sku") || "").trim();
  if (!since || !afterUpdatedAt) return response({ error: "CATALOG_DELTA_CURSOR_REQUIRED" }, 400);
  // Active SKU membership may change without changing sku_master.updated_at:
  // a hidden SKU has no tombstone in the legacy delta payload. An old Android
  // cache that saw the previous membership MUST perform a full staged refresh.
  // The existing Android client treats HTTP 409 as delta failure and safely
  // falls back to /api/skus/catalog, preserving the installed-version contract.
  const membership = state.storage.sql.exec<SqlRow>(
    "SELECT membership_changed_at FROM d167_sku_meta WHERE id=1 LIMIT 1",
  ).toArray()[0];
  const membershipAt = Date.parse(String(membership?.membership_changed_at || ""));
  const cursorAt = Date.parse(since);
  if (Number.isFinite(membershipAt) &&
      (!Number.isFinite(cursorAt) || cursorAt < membershipAt)) {
    return response({ error: "CATALOG_MEMBERSHIP_CHANGED_FULL_REQUIRED" }, 409);
  }
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT sku, product_name, updated_at
       FROM sku_master
      WHERE updated_at > ? OR (updated_at = ? AND sku > ?)
      ORDER BY updated_at ASC, sku ASC
      LIMIT ?`,
    afterUpdatedAt, afterUpdatedAt, afterSku, limit,
  ).toArray();
  const last = rows[rows.length - 1];
  const hasNext = rows.length === limit;
  return response({
    items: rows,
    count: rows.length,
    since,
    next_updated_at: hasNext && last ? String(last.updated_at || "") : null,
    next_sku: hasNext && last ? String(last.sku || "") : null,
    limit,
  });
}

function reporterRecent(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"), 100, 200);
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at,
              b.resolved_at, b.resolved_by_user_id, b.resolution, b.correction_deadline_at,
              COUNT(t.ticket_id) AS affected_picker_count
         FROM report_batches b
         LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
        WHERE b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')
        GROUP BY b.batch_id
        ORDER BY COALESCE(b.resolved_at, b.updated_at) DESC
        LIMIT ?`,
      limit,
    )
    .toArray();
  return response({ items: rows, count: rows.length });
}

function reporterBatchTickets(state: DurableObjectState, url: URL): Response {
  const batchId = String(url.searchParams.get("batch_id") || "").trim();
  if (!batchId) return response({ error: "BATCH_ID_REQUIRED" }, 400);
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT t.ticket_id, t.picker_user_id, t.picker_employee_code,
              COALESCE(u.display_name, '') AS picker_display_name,
              t.status, t.reported_at, t.withdraw_deadline_at, t.withdrawn_at, t.resolved_at
         FROM report_tickets t
         LEFT JOIN users u ON u.employee_code = t.picker_employee_code
        WHERE t.batch_id = ?
        ORDER BY t.reported_at ASC`,
      batchId,
    )
    .toArray();
  return response({ batch_id: batchId, items: rows, count: rows.length });
}

async function cleanupExpiredRealtimeTickets(state: DurableObjectState): Promise<void> {
  const now = Date.now();
  const entries = await state.storage.list<RealtimeTicket>({ prefix: REALTIME_TICKET_PREFIX, limit: 100 });
  const expired: string[] = [];
  for (const [key, ticket] of entries) {
    if (!ticket || ticket.expires_at <= now) expired.push(key);
  }
  if (expired.length) await state.storage.delete(expired);
}

async function createRealtimeTicket(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as Partial<RealtimeTicket>;
  const userId = String(body.user_id || "").trim();
  const role = String(body.role || "") as RealtimeRole;
  const clientType = String(body.client_type || "") as RealtimeClientType;
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/.test(userId) ||
    !["PICKER", "REPORTER", "ADMIN", "PICKPACK_ADMIN", "ROOT"].includes(role) ||
    !["WEB", "ANDROID"].includes(clientType)
  ) {
    return response({ error: "INVALID_REALTIME_TICKET_REQUEST" }, 400);
  }

  await cleanupExpiredRealtimeTickets(state);
  const ticket = crypto.randomUUID();
  const expiresAt = Date.now() + REALTIME_TICKET_TTL_MS;
  const value: RealtimeTicket = {
    user_id: userId,
    employee_code: body.employee_code ? String(body.employee_code) : null,
    display_name: String(body.display_name || ""),
    role,
    client_type: clientType,
    app_version: clientType === "ANDROID" && /^vc[0-9]{1,6}$/.test(String(body.app_version || "")) ? String(body.app_version) :
      clientType === "WEB" && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(String(body.app_version || "")) ? String(body.app_version) : "",
    expires_at: expiresAt,
  };
  await state.storage.put(`${REALTIME_TICKET_PREFIX}${ticket}`, value);
  const stream = realtimeStreamMetadata(state);
  return response({
    ticket,
    expires_at: new Date(expiresAt).toISOString(),
    latest_seq: stream.latest_seq,
    retained_from_seq: stream.retained_from_seq,
    stream_epoch: stream.stream_epoch,
  });
}

async function connectRealtime(
  state: DurableObjectState,
  request: Request,
  url: URL,
  onPickerAndroidPresenceChanged?: () => Promise<void>,
): Promise<Response> {
  if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
    return response({ error: "WEBSOCKET_UPGRADE_REQUIRED" }, 426);
  }
  const ticketId = String(url.searchParams.get("ticket") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return response({ error: "INVALID_REALTIME_TICKET" }, 401);
  const key = `${REALTIME_TICKET_PREFIX}${ticketId}`;
  const ticket = await state.storage.get<RealtimeTicket>(key);
  if (!ticket || ticket.expires_at <= Date.now()) {
    if (ticket) await state.storage.delete(key);
    return response({ error: "REALTIME_TICKET_EXPIRED" }, 401);
  }
  await state.storage.delete(key);

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  const connectedAt = new Date().toISOString();
  const attachment: RealtimeAttachment = {
    connection_id: crypto.randomUUID(),
    user_id: ticket.user_id,
    employee_code: ticket.employee_code,
    display_name: ticket.display_name,
    role: ticket.role,
    client_type: ticket.client_type,
    app_version: ticket.app_version || "",
    connected_at: connectedAt,
  };
  server.serializeAttachment(attachment);
  state.acceptWebSocket(server, [
    `role:${ticket.role}`,
    `user:${ticket.user_id}`,
    `client:${ticket.client_type}`,
  ]);
  state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  if (ticket.role === "PICKER" && ticket.client_type === "ANDROID" && onPickerAndroidPresenceChanged) {
    state.waitUntil(onPickerAndroidPresenceChanged());
  }

  try {
    const stream = realtimeStreamMetadata(state);
    server.send(JSON.stringify({
      type: "connected",
      connection_id: attachment.connection_id,
      latest_seq: stream.latest_seq,
      retained_from_seq: stream.retained_from_seq,
      stream_epoch: stream.stream_epoch,
      server_time: connectedAt,
    }));
  } catch {
    // Handshake remains authoritative even if the peer closes immediately after accept.
  }

  return new Response(null, { status: 101, webSocket: client });
}

async function closeRealtimeUser(state: DurableObjectState, request: Request): Promise<Response> {
  let body: { user_id?: string; client_type?: string; reason?: string } = {};
  try {
    body = (await request.json()) as { user_id?: string; client_type?: string; reason?: string };
  } catch {
    body = {};
  }
  const userId = String(body.user_id || "").trim();
  const clientType = String(body.client_type || "").trim().toUpperCase();
  // Keep the established role-change close reason while D098 also scopes same-channel replacement.
  const allowedCloseReasons = new Set(["role-changed", "session-replaced", "session-changed"]);
  const requestedReason = String(body.reason || "session-changed").trim().slice(0, 64) || "session-changed";
  const reason = allowedCloseReasons.has(requestedReason) ? requestedReason : "session-changed";
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(userId)) return response({ error: "INVALID_USER_ID" }, 400);
  if (clientType && !["WEB", "ANDROID"].includes(clientType)) return response({ error: "INVALID_CLIENT_TYPE" }, 400);
  let closed = 0;
  for (const socket of state.getWebSockets()) {
    const attachment = socket.deserializeAttachment() as RealtimeAttachment | null;
    if (attachment?.user_id !== userId) continue;
    if (clientType && attachment.client_type !== clientType) continue;
    try {
      socket.close(1000, reason);
      closed += 1;
    } catch {
      // Socket may already be closing; HTTP/session generation remains authoritative.
    }
  }
  return response({ status: "closed", user_id: userId, client_type: clientType || "ALL", closed });
}

async function closeRealtimeUsers(state: DurableObjectState, request: Request): Promise<Response> {
  let body: { user_ids?: unknown[]; client_type?: string; reason?: string } = {};
  try {
    body = (await request.json()) as { user_ids?: unknown[]; client_type?: string; reason?: string };
  } catch {
    body = {};
  }
  const userIds = new Set(
    (Array.isArray(body.user_ids) ? body.user_ids : [])
      .map((value) => String(value || "").trim())
      .filter((value) => /^[A-Za-z0-9._:-]{1,128}$/.test(value))
      .slice(0, 2000),
  );
  const clientType = String(body.client_type || "").trim().toUpperCase();
  const allowedCloseReasons = new Set(["role-changed", "session-replaced", "session-changed"]);
  const requestedReason = String(body.reason || "session-changed").trim().slice(0, 64) || "session-changed";
  const reason = allowedCloseReasons.has(requestedReason) ? requestedReason : "session-changed";
  if (!userIds.size) return response({ status: "noop", closed: 0, targeted_users: 0 });
  if (clientType && !["WEB", "ANDROID"].includes(clientType)) return response({ error: "INVALID_CLIENT_TYPE" }, 400);

  let closed = 0;
  for (const socket of state.getWebSockets()) {
    const attachment = socket.deserializeAttachment() as RealtimeAttachment | null;
    if (!attachment?.user_id || !userIds.has(attachment.user_id)) continue;
    if (clientType && attachment.client_type !== clientType) continue;
    try {
      socket.close(1000, reason);
      closed += 1;
    } catch {
      // Session generation remains authoritative if the socket is already closing.
    }
  }
  return response({
    status: "closed",
    targeted_users: userIds.size,
    client_type: clientType || "ALL",
    closed,
  });
}

function agentReporterPresence(state: DurableObjectState): Response {
  // Agent-only Worker route: authenticated Inventory WebSocket attachments
  // (WEB and Android Báo hàng). D172 OBPP has a separate app/channel and
  // must NEVER be inferred from shared Firebase identity or account records.
  // Additive v1 extension: retain legacy "reporters" for v141/v142 clients,
  // and expose bounded role+channel sessions for new Agent roster.
  const reporters = new Map<string, { employee_code: string; display_name: string; channels: Set<RealtimeClientType>; versions: Map<RealtimeClientType, string> }>();
  const sessions = new Map<string, { role: RealtimeRole; employee_code: string; display_name: string; channel: RealtimeClientType; app_version: string }>();
  for (const socket of state.getWebSockets()) {
    const a = socket.deserializeAttachment() as RealtimeAttachment | null;
    if (!a?.user_id || !a.connection_id || !["WEB", "ANDROID"].includes(a.client_type)) continue;
    const role = a.role;
    if (!["PICKER", "REPORTER", "ADMIN", "PICKPACK_ADMIN", "ROOT"].includes(role)) continue;
    const key = a.user_id + "|" + role + "|" + a.client_type;
    if (!sessions.has(key)) {
      sessions.set(key, {
        role, employee_code: String(a.employee_code || "").slice(0, 36),
        display_name: String(a.display_name || "").slice(0, 96),
        channel: a.client_type, app_version: String(a.app_version || "").slice(0, 24),
      });
    }
    if (role !== "REPORTER") continue;
    let entry = reporters.get(a.user_id);
    if (!entry) {
      entry = { employee_code: String(a.employee_code || "").slice(0, 36),
        display_name: String(a.display_name || "").slice(0, 96), channels: new Set<RealtimeClientType>(), versions: new Map<RealtimeClientType, string>() };
      reporters.set(a.user_id, entry);
    }
    entry.channels.add(a.client_type);
    if (a.app_version && a.app_version.length <= 24) entry.versions.set(a.client_type, a.app_version);
  }
  return response({
    schema_version: 1,
    source: "AUTHENTICATED_REALTIME_SOCKET",
    reporter_count: reporters.size,
    // Unique authenticated Inventory user+channel rows; no Firestore
    // query, no extra heartbeat, no foreign app records or token material.
    sessions: Array.from(sessions.values()).slice(0, 150),
    session_count: sessions.size,
    sessions_truncated: sessions.size > 150,
    reporters: Array.from(reporters.values()).slice(0, 100).map((row) => ({
      employee_code: row.employee_code, display_name: row.display_name,
      channel: Array.from(row.channels).sort().join("+"),
      android_version: row.versions.get("ANDROID") || "",
      web_version: row.versions.get("WEB") || "",
    })),
    truncated: reporters.size > 100,
    server_time: new Date().toISOString(),
  });
}

function realtimePresence(state: DurableObjectState): Response {
  const sockets = state.getWebSockets();
  const sessions: RealtimeAttachment[] = [];
  const users = new Set<string>();
  const byRole: Record<RealtimeRole, Set<string>> = {
    PICKER: new Set<string>(),
    REPORTER: new Set<string>(),
    ADMIN: new Set<string>(),
    PICKPACK_ADMIN: new Set<string>(),
    ROOT: new Set<string>(),
  };
  const byClient: Record<RealtimeClientType, Set<string>> = {
    WEB: new Set<string>(),
    ANDROID: new Set<string>(),
  };
  for (const socket of sockets) {
    const attachment = socket.deserializeAttachment() as RealtimeAttachment | null;
    if (!attachment?.connection_id || !attachment.user_id) continue;
    sessions.push(attachment);
    users.add(attachment.user_id);
    if (attachment.role in byRole) byRole[attachment.role].add(attachment.user_id);
    if (attachment.client_type in byClient) byClient[attachment.client_type].add(attachment.user_id);
  }
  return response({
    online_users: users.size,
    online_sessions: sessions.length,
    online_users_by_role: Object.fromEntries(Object.entries(byRole).map(([role, values]) => [role, values.size])),
    online_users_by_client: Object.fromEntries(Object.entries(byClient).map(([client, values]) => [client, values.size])),
    sessions,
    latest_seq: latestRealtimeSeq(state),
    server_time: new Date().toISOString(),
  });
}

function pickerUserTagsForResultEvent(state: DurableObjectState, batchId: string, eventId: string): string[] {
  if (!batchId) return [];
  const rows = eventId
    ? state.storage.sql
        .exec<SqlRow>(
          `SELECT DISTINCT target_user_id AS picker_user_id
             FROM result_acknowledgements
            WHERE result_event_id = ? AND batch_id = ?`,
          eventId,
          batchId,
        )
        .toArray()
    : state.storage.sql
        .exec<SqlRow>(
          `SELECT DISTINCT picker_user_id
             FROM report_tickets
            WHERE batch_id = ?
              AND status = 'RESOLVED'
              AND picker_user_id IS NOT NULL
              AND picker_user_id <> ''`,
          batchId,
        )
        .toArray();
  return rows
    .map((row) => `user:${String(row.picker_user_id || "").trim()}`)
    .filter((tag) => REALTIME_TAG_RE.test(tag));
}

function realtimeEvent(state: DurableObjectState, eventId: string): SqlRow | null {
  if (!eventId) return null;
  return first(state.storage.sql.exec<SqlRow>(
    `SELECT seq, event_id, event_type, batch_id, ticket_id, batch_version, scopes_json, payload_json, created_at
       FROM realtime_events
      WHERE event_id = ?
      LIMIT 1`,
    eventId,
  ).toArray());
}

function parseScopes(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function realtimeBroadcast(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    event?: string;
    event_id?: string;
    tags?: unknown[];
    scopes?: unknown[];
    batch_id?: string;
    include_batch_picker_users?: boolean;
    metadata?: Record<string, unknown>;
  };
  const fallbackEvent = String(body.event || "business_changed").trim().slice(0, 100);
  const eventId = String(body.event_id || "").trim();
  const eventRow = realtimeEvent(state, eventId);
  const event = String(eventRow?.event_type || fallbackEvent);
  const requestedTags = Array.isArray(body.tags)
    ? body.tags.map((value) => String(value)).filter((value) => REALTIME_TAG_RE.test(value))
    : [];
  const batchId = String(body.batch_id || eventRow?.batch_id || "").trim();
  if (body.include_batch_picker_users && batchId) {
    requestedTags.push(...pickerUserTagsForResultEvent(state, batchId, eventId));
  }
  const tags = [...new Set(requestedTags)].slice(0, 200);
  const requestedScopes = Array.isArray(body.scopes)
    ? [...new Set(body.scopes.map((value) => String(value).trim()).filter(Boolean))].slice(0, 20)
    : [];
  const eventScopes = eventRow ? parseScopes(eventRow.scopes_json) : [];
  const scopes = eventScopes.length ? eventScopes : requestedScopes;
  if (!tags.length) return response({ status: "noop", sent: 0, reason: "no_valid_tags" });

  const sockets = new Set<WebSocket>();
  for (const tag of tags) {
    for (const socket of state.getWebSockets(tag)) sockets.add(socket);
  }
  const eventIdentity = eventId || (eventRow ? String(eventRow.event_id || "") : "");
  const ticketId = eventRow?.ticket_id == null ? null : String(eventRow.ticket_id);
  const eventBatchVersion = Number(eventRow?.batch_version || 0);
  const reporterSnapshot = batchId ? currentBatchSnapshot(state, batchId) : null;
  let sent = 0;
  let failed = 0;
  let filtered = 0;
  for (const socket of sockets) {
    const attachment = socket.deserializeAttachment() as RealtimeAttachment | null;
    if (!attachment?.user_id || !attachment.role) {
      filtered += 1;
      continue;
    }

    const directPickerReportingControl =
      attachment.role === "PICKER" &&
      !eventRow &&
      (event === "picker_reporting_enabled" || event === "picker_reporting_disabled") &&
      requestedTags.includes(`user:${attachment.user_id}`) &&
      scopes.includes(event);
    const directPickerSupportControl =
      attachment.role === "PICKER" &&
      !eventRow &&
      event === "support_log_request" &&
      requestedTags.includes("role:PICKER") &&
      scopes.includes("support_log_request");
    const directPickerControl = directPickerReportingControl || directPickerSupportControl;

    if (
      attachment.role === "PICKER" &&
      !directPickerControl &&
      !pickerCanReceiveRealtimeEvent(state, eventIdentity, ticketId, attachment.user_id)
    ) {
      filtered += 1;
      continue;
    }

    const snapshot = attachment.role === "PICKER" && !directPickerControl
      ? pickerRealtimeSnapshot(state, batchId, eventIdentity, ticketId, attachment.user_id)
      : (attachment.role === "PICKER" ? null : reporterSnapshot);
    const metadata = attachment.role === "PICKER"
      ? { ...(directPickerControl ? (body.metadata || {}) : {}), ...(batchId ? { batch_id: batchId } : {}) }
      : { ...(body.metadata || {}), ...(batchId ? { batch_id: batchId } : {}) };
    const frame = JSON.stringify({
      type: "invalidate",
      event,
      event_id: eventIdentity,
      seq: eventRow ? Number(eventRow.seq || 0) : null,
      scopes: attachment.role === "PICKER"
        ? scopes.filter((scope) =>
            scope === "picker_reports" ||
            scope === "picker_reporting_enabled" ||
            scope === "picker_reporting_disabled" ||
            scope === "support_log_request")
        : scopes,
      batch_id: batchId || null,
      batch_version: eventBatchVersion,
      snapshot,
      server_time: new Date().toISOString(),
      metadata,
    });
    try {
      socket.send(frame);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return response({
    status: "broadcasted",
    sent,
    failed,
    filtered,
    tags,
    scopes,
    event_id: eventId || null,
    seq: eventRow ? Number(eventRow.seq || 0) : null,
  });
}

export async function handleReadModelCoreRequest(
  state: DurableObjectState,
  request: Request,
  onPickerAndroidPresenceChanged?: () => Promise<void>,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/operational/init") {
    const readiness = operationalV2Readiness(state);
    return response(
      { status: readiness.ready ? "ready" : "not_ready", extension: "operational-v2", ...readiness, latest_seq: latestRealtimeSeq(state) },
      readiness.ready ? 200 : 503,
    );
  }
  if (url.pathname.startsWith("/operational/")) {
    const operational = await handleOperationalV2CoreRequest(state, request);
    if (operational) return operational;
  }

  if (request.method === "GET" && url.pathname === "/read/skus/catalog-info") return skuCatalogInfo(state);
  if (request.method === "GET" && url.pathname === "/read/skus/catalog-provenance") return skuCatalogProvenance(state);
  if (request.method === "GET" && url.pathname === "/read/skus/catalog") return skuCatalog(state, url);
  if (request.method === "GET" && url.pathname === "/read/skus/catalog-delta") return skuCatalogDelta(state, url);
  if (request.method === "GET" && url.pathname === "/read/reporter/recent") return reporterRecent(state, url);
  if (request.method === "GET" && url.pathname === "/read/reporter/batch-tickets") return reporterBatchTickets(state, url);
  if (request.method === "POST" && url.pathname === "/realtime/ticket") return createRealtimeTicket(state, request);
  if (request.method === "GET" && url.pathname === "/realtime/connect") {
    return connectRealtime(state, request, url, onPickerAndroidPresenceChanged);
  }
  if (request.method === "GET" && url.pathname === "/read/realtime/agent-reporters") return agentReporterPresence(state);
  if (request.method === "GET" && url.pathname === "/read/realtime/presence") return realtimePresence(state);
  if (request.method === "POST" && url.pathname === "/realtime/close-user") return closeRealtimeUser(state, request);
  if (request.method === "POST" && url.pathname === "/realtime/close-users") return closeRealtimeUsers(state, request);
  if (request.method === "POST" && url.pathname === "/realtime/broadcast") return realtimeBroadcast(state, request);
  return null;
}
