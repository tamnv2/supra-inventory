import { handleOperationalV2CoreRequest, initializeOperationalV2Schema } from "./operational-v2-core";

type SqlRow = Record<string, SqlStorageValue>;

type RealtimeRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
type RealtimeClientType = "WEB" | "ANDROID";

type RealtimeTicket = {
  user_id: string;
  employee_code: string | null;
  display_name: string;
  role: RealtimeRole;
  client_type: RealtimeClientType;
  expires_at: number;
};

type RealtimeAttachment = {
  connection_id: string;
  user_id: string;
  employee_code: string | null;
  display_name: string;
  role: RealtimeRole;
  client_type: RealtimeClientType;
  connected_at: string;
};

const REALTIME_TICKET_PREFIX = "realtime-ticket:";
const REALTIME_TICKET_TTL_MS = 60_000;
const REALTIME_TAG_RE = /^(role:(PICKER|REPORTER|ADMIN|ROOT)|user:[A-Za-z0-9._:-]{1,128}|client:(WEB|ANDROID))$/;

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
  const count = Number(row.count || 0);
  const maxUpdatedAt = String(row.max_updated_at || "");
  return response({ count, max_updated_at: maxUpdatedAt || null, version: `${count}:${maxUpdatedAt}` });
}

function skuCatalog(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"), 1000, 2000);
  const after = String(url.searchParams.get("after") || "");
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT sku, product_name, updated_at
         FROM sku_master
        WHERE sku > ?
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
    !["PICKER", "REPORTER", "ADMIN", "ROOT"].includes(role) ||
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
    expires_at: expiresAt,
  };
  await state.storage.put(`${REALTIME_TICKET_PREFIX}${ticket}`, value);
  return response({ ticket, expires_at: new Date(expiresAt).toISOString(), latest_seq: latestRealtimeSeq(state) });
}

async function connectRealtime(state: DurableObjectState, request: Request, url: URL): Promise<Response> {
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
    connected_at: connectedAt,
  };
  server.serializeAttachment(attachment);
  state.acceptWebSocket(server, [
    `role:${ticket.role}`,
    `user:${ticket.user_id}`,
    `client:${ticket.client_type}`,
  ]);
  state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));

  try {
    server.send(JSON.stringify({
      type: "connected",
      connection_id: attachment.connection_id,
      latest_seq: latestRealtimeSeq(state),
      server_time: connectedAt,
    }));
  } catch {
    // Handshake remains authoritative even if the peer closes immediately after accept.
  }

  return new Response(null, { status: 101, webSocket: client });
}

function realtimePresence(state: DurableObjectState): Response {
  const sockets = state.getWebSockets();
  const sessions: RealtimeAttachment[] = [];
  const users = new Set<string>();
  for (const socket of sockets) {
    const attachment = socket.deserializeAttachment() as RealtimeAttachment | null;
    if (!attachment?.connection_id || !attachment.user_id) continue;
    sessions.push(attachment);
    users.add(attachment.user_id);
  }
  return response({
    online_users: users.size,
    online_sessions: sessions.length,
    sessions,
    latest_seq: latestRealtimeSeq(state),
    server_time: new Date().toISOString(),
  });
}

function pickerUserTagsForBatch(state: DurableObjectState, batchId: string): string[] {
  if (!batchId) return [];
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT DISTINCT picker_user_id
         FROM report_tickets
        WHERE batch_id = ? AND picker_user_id IS NOT NULL AND picker_user_id <> ''`,
      batchId,
    )
    .toArray();
  return rows
    .map((row) => `user:${String(row.picker_user_id || "").trim()}`)
    .filter((tag) => REALTIME_TAG_RE.test(tag));
}

function batchSnapshot(state: DurableObjectState, batchId: string): Record<string, unknown> | null {
  if (!batchId) return null;
  const row = first(state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.last_report_at,
            b.resolved_at, b.resolution, b.correction_deadline_at, b.version, b.previous_batch_id,
            SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) AS open_ticket_count,
            COUNT(DISTINCT t.ticket_id) AS total_ticket_count,
            COUNT(DISTINCT a.target_user_id) AS ack_target_count,
            COUNT(DISTINCT CASE WHEN a.acknowledged_at IS NOT NULL THEN a.target_user_id END) AS acknowledged_count
       FROM report_batches b
       LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
       LEFT JOIN result_acknowledgements a
         ON a.batch_id = b.batch_id AND a.batch_version = b.version
      WHERE b.batch_id = ?
      GROUP BY b.batch_id
      LIMIT 1`,
    batchId,
  ).toArray());
  return row ? { ...row } : null;
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
    requestedTags.push(...pickerUserTagsForBatch(state, batchId));
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
  const snapshot = batchId ? batchSnapshot(state, batchId) : null;
  const frame = JSON.stringify({
    type: "invalidate",
    event,
    event_id: eventId || (eventRow ? String(eventRow.event_id || "") : ""),
    seq: eventRow ? Number(eventRow.seq || 0) : null,
    scopes,
    batch_id: batchId || null,
    batch_version: snapshot ? Number(snapshot.version || eventRow?.batch_version || 0) : Number(eventRow?.batch_version || 0),
    snapshot,
    server_time: new Date().toISOString(),
    metadata: { ...(body.metadata || {}), ...(batchId ? { batch_id: batchId } : {}) },
  });
  let sent = 0;
  let failed = 0;
  for (const socket of sockets) {
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
    tags,
    scopes,
    event_id: eventId || null,
    seq: eventRow ? Number(eventRow.seq || 0) : null,
  });
}

export async function handleReadModelCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/operational/init") {
    initializeOperationalV2Schema(state);
    return response({ status: "ready", extension: "operational-v2", latest_seq: latestRealtimeSeq(state) });
  }
  if (url.pathname.startsWith("/operational/")) {
    initializeOperationalV2Schema(state);
    const operational = await handleOperationalV2CoreRequest(state, request);
    if (operational) return operational;
  }

  if (url.pathname.startsWith("/realtime/") || url.pathname.startsWith("/read/realtime/")) {
    initializeOperationalV2Schema(state);
  }

  if (request.method === "GET" && url.pathname === "/read/skus/catalog-info") return skuCatalogInfo(state);
  if (request.method === "GET" && url.pathname === "/read/skus/catalog") return skuCatalog(state, url);
  if (request.method === "GET" && url.pathname === "/read/skus/catalog-delta") return skuCatalogDelta(state, url);
  if (request.method === "GET" && url.pathname === "/read/reporter/recent") return reporterRecent(state, url);
  if (request.method === "GET" && url.pathname === "/read/reporter/batch-tickets") return reporterBatchTickets(state, url);
  if (request.method === "POST" && url.pathname === "/realtime/ticket") return createRealtimeTicket(state, request);
  if (request.method === "GET" && url.pathname === "/realtime/connect") return connectRealtime(state, request, url);
  if (request.method === "GET" && url.pathname === "/read/realtime/presence") return realtimePresence(state);
  if (request.method === "POST" && url.pathname === "/realtime/broadcast") return realtimeBroadcast(state, request);
  return null;
}
