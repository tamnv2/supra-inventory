// Shared in-object transport adapter. It never obtains a DO stub or creates a
// second business implementation. Every target is an existing authorized route.
export const D173_COMMAND_PROTOCOL = "d173-v2";
export const D173_READ_OPERATIONS = [
  "realtime.presence", "reporter.snapshot", "picker.snapshot", "realtime.delta",
  "sku.catalog.info", "sku.catalog.delta",
] as const;
export const D173_MUTATION_OPERATIONS = [
  "shortage.create", "shortage.withdraw", "shortage.resolve", "shortage.correct",
] as const;
export const D173_OPERATIONS = [...D173_READ_OPERATIONS, ...D173_MUTATION_OPERATIONS];
const ID = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_FRAME_BYTES = 16_384;
const MAX_PENDING = 16;
const inFlight = new WeakMap<WebSocket, number>();

export interface D173SocketIdentity {
  command_protocol?: string;
  firebase_uid?: string;
  session_channel?: string;
  session_generation?: number;
  auth_expires_at_ms?: number;
  user_id?: string;
  role?: string;
  command_window_at_ms?: number;
  command_window_count?: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function d173BoundIdentity(value: D173SocketIdentity | null | undefined, now = Date.now()): boolean {
  return value?.command_protocol === D173_COMMAND_PROTOCOL &&
    typeof value.firebase_uid === "string" && value.firebase_uid.length > 0 && value.firebase_uid.length <= 128 &&
    (value.session_channel === "WEB" || value.session_channel === "ANDROID") &&
    Number.isSafeInteger(value.session_generation) && Number(value.session_generation) > 0 &&
    Number.isFinite(value.auth_expires_at_ms) && Number(value.auth_expires_at_ms) > now;
}

// Also used before sending private push frames: a long-lived attachment is not
// permission authority. This check uses the same effective-role/generation rules.
export function d173LiveSocketIdentity(state: DurableObjectState, value: D173SocketIdentity): boolean {
  if (!d173BoundIdentity(value)) return false;
  const row = state.storage.sql.exec<Record<string, SqlStorageValue>>(
    `SELECT user_id,status,CASE WHEN role='ROOT' AND role_override IN ('PICKER','REPORTER','ADMIN','PICKPACK_ADMIN')
       THEN role_override ELSE role END AS role,
       web_session_generation,android_session_generation FROM users WHERE firebase_uid=? LIMIT 1`,
    String(value.firebase_uid),
  ).toArray()[0];
  if (!row || row.status !== "ACTIVE" || String(row.user_id) !== value.user_id || String(row.role) !== value.role) return false;
  const current = value.session_channel === "WEB" ? row.web_session_generation : row.android_session_generation;
  return Number(current) === value.session_generation;
}

export function d173CommandRequest(
  identity: D173SocketIdentity, requestId: string, operation: string, args: Record<string, unknown>,
): Request | null {
  if (!ID.test(requestId)) return null;
  const paths: Record<string, string> = {
    "realtime.presence": "/authorized/read/realtime/presence",
    "reporter.snapshot": "/authorized/operational/reporter/snapshot",
    "picker.snapshot": "/authorized/operational/picker/snapshot",
    "realtime.delta": "/authorized/operational/realtime/delta",
    "sku.catalog.info": "/authorized/read/skus/catalog-info",
    "sku.catalog.delta": "/authorized/read/skus/catalog-delta",
  };
  const headers = new Headers({
    "x-supra-auth-uid": String(identity.firebase_uid || ""),
    "x-supra-session-channel": String(identity.session_channel || ""),
    "x-supra-session-generation": String(identity.session_generation || 0),
    "x-supra-auth-expires-at-ms": String(identity.auth_expires_at_ms || 0),
  });
  const path = paths[operation];
  if (path) {
    const url = new URL("https://inventory-core.internal" + path);
    // No client-supplied identity, role, private URL or arbitrary headers.
    const allowed = new Set([
      "limit", "offset", "status", "scope", "from", "to", "include_overdue",
      "queue_limit", "queue_offset", "recent_limit", "recent_offset", "recent_status", "recent_scope", "recent_from", "recent_to",
      "overdue_limit", "overdue_offset", "result_limit", "display_only",
      "reports_limit", "results_limit", "results_scope", "results_from", "results_to",
      "after_seq", "stream_epoch", "since", "after_updated_at", "after_sku", "after",
    ]);
    for (const [key, value] of Object.entries(args)) {
      if (!allowed.has(key) || value === null || value === undefined) continue;
      if (!["string", "number", "boolean"].includes(typeof value) || String(value).length > 256) return null;
      url.searchParams.set(key, String(value));
    }
    return new Request(url, { headers });
  }
  const action = operation.startsWith("shortage.") ? operation.slice("shortage.".length) : "";
  if (!["create", "withdraw", "resolve", "correct"].includes(action)) return null;
  if ((args.request_id !== undefined && args.request_id !== requestId) ||
      (args.d173_request_id !== undefined && args.d173_request_id !== requestId)) return null;
  const body: Record<string, unknown> = { request_id: requestId, d173_request_id: requestId };
  const fields: Record<string, string[]> = {
    create: ["sku"], withdraw: ["ticket_id"], resolve: ["batch_id", "resolution"],
    correct: ["batch_id", "target", "expected_version"],
  };
  for (const field of fields[action]) {
    const value = args[field];
    if (value !== undefined && (typeof value === "string" || typeof value === "number")) body[field] = value;
  }
  // Keep structured input shallow before serializing another Request. JSON.parse
  // can accept nesting deep enough to overflow JSON.stringify's stack even in a
  // bounded frame; only the documented primitive filter options are forwarded.
  if (args.read_model !== undefined) {
    const view = record(args.read_model);
    const parameters = record(view?.params);
    if (!view || !parameters || !["PICKER", "REPORTER"].includes(String(view.kind || ""))) return null;
    const safeParams: Record<string, string | number | boolean> = {};
    const entries = Object.entries(parameters);
    if (entries.length > 24) return null;
    for (const [key, value] of entries) {
      if (key.length > 64 || !["string", "number", "boolean"].includes(typeof value) || String(value).length > 128) return null;
      safeParams[key] = value as string | number | boolean;
    }
    body.read_model = { kind: view.kind, params: safeParams };
  }
  headers.set("content-type", "application/json");
  return new Request("https://inventory-core.internal/authorized/business/shortage/" + action, {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

type Execute = (request: Request) => Promise<Response>;
type Finalize = (action: string, args: Record<string, unknown>, raw: Response) => Promise<Response>;

export async function handleD173WebSocketFrame(
  state: DurableObjectState, ws: WebSocket, message: string | ArrayBuffer,
  execute: Execute, finalizeMutation: Finalize, enabled = true,
): Promise<void> {
  let attachment: D173SocketIdentity | null = null;
  try { attachment = typeof ws.deserializeAttachment === "function" ? ws.deserializeAttachment() : null; } catch { /* invalid attachment */ }
  const negotiated = enabled && attachment?.command_protocol === D173_COMMAND_PROTOCOL;
  // Keep E086's legacy 2048 text-unit limit exactly. Negotiated commands use a
  // UTF-8 byte limit because they parse structured, bounded application input.
  const bytes = typeof message === "string"
    ? (negotiated ? new TextEncoder().encode(message).byteLength : message.length) : message.byteLength;
  if (bytes > (negotiated ? MAX_FRAME_BYTES : 2048)) {
    try { ws.close(1009, "message-too-large"); } catch { /* closing */ }
    return;
  }
  // E086 legacy behavior: no parsing/SQL/business side effects on old sockets.
  if (!negotiated || typeof message !== "string") return;
  let frame: Record<string, unknown> | null;
  try { frame = record(JSON.parse(message)); } catch { return; }
  if (frame?.type !== "request") return;
  const requestId = typeof frame.request_id === "string" ? frame.request_id : "";
  const operation = typeof frame.operation === "string" ? frame.operation : "";
  const args = record(frame.args);
  const send = (status: number, payload: unknown) => {
    try { ws.send(JSON.stringify({ type: "response", request_id: requestId, status, payload, server_now_ms: Date.now() })); }
    catch { /* HTTP fallback reuses the same request_id; never replay a new mutation. */ }
  };
  if (!ID.test(requestId) || !args) { send(400, { error: "INVALID_COMMAND" }); return; }
  if (!d173BoundIdentity(attachment)) {
    send(401, { error: "COMMAND_SESSION_EXPIRED" });
    try { ws.close(4401, "command-session-expired"); } catch { /* closing */ }
    return;
  }
  const current = attachment!;
  const now = Date.now();
  if (!current.command_window_at_ms || now - current.command_window_at_ms >= 10_000) {
    current.command_window_at_ms = now; current.command_window_count = 0;
  }
  if ((current.command_window_count || 0) >= 120 || (inFlight.get(ws) || 0) >= MAX_PENDING) {
    send(429, { error: "COMMAND_BACKPRESSURE" }); return;
  }
  current.command_window_count = (current.command_window_count || 0) + 1;
  ws.serializeAttachment(current);
  let request: Request | null;
  try { request = d173CommandRequest(current, requestId, operation, args); }
  catch { send(400, { error: "INVALID_COMMAND_OPERATION_OR_ARGS" }); return; }
  if (!request) { send(400, { error: "INVALID_COMMAND_OPERATION_OR_ARGS" }); return; }
  inFlight.set(ws, (inFlight.get(ws) || 0) + 1);
  try {
    // The authorized target validates the live account, role and session on
    // EVERY command. No stub.fetch(), expiry timer or role cache is involved.
    let raw = await execute(request);
    if (operation.startsWith("shortage.")) raw = await finalizeMutation(operation.slice(9), args, raw);
    const payload: unknown = await raw.json();
    send(raw.status, payload);
  } catch {
    send(503, { error: "COMMAND_TEMPORARILY_UNAVAILABLE" });
  } finally {
    inFlight.set(ws, Math.max(0, (inFlight.get(ws) || 1) - 1));
  }
}

// Notification code can share its existing private handler without making any
// nested Durable Object RPC/HTTP request. Only the two used namespace methods
// are supplied; no caller ever receives this adapter.
export function d173LocalNamespace(execute: Execute): DurableObjectNamespace {
  return {
    idFromName: () => "inventory-core",
    get: () => ({ fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      execute(input instanceof Request ? input : new Request(input, init)) }),
  } as unknown as DurableObjectNamespace;
}
