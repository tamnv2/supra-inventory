// Negotiated, bounded transport only. HTTP remains the fallback and owns auth retry.
type CommandSocket = { readyState: number; send(value: string): void };
type Pending = { owner: object; complete(status: number, payload: unknown): void; cancel(): void };
const pending = new Map<string, Pending>();
let channel: { socket: CommandSocket; owner: object; operations: Set<string>; expires: number } | null = null;
const MAX_PENDING = 32;
const MAX_FRAME_BYTES = 16 * 1024;
const HTTP_HEDGE_MS = 50;

export function resetCommandTransport(): void {
  channel = null;
  for (const entry of [...pending.values()]) entry.cancel();
  pending.clear();
}

export function configureCommandTransport(socket: CommandSocket, owner: object, frame: Record<string, unknown>): void {
  resetCommandTransport();
  const capabilities = frame.capabilities as { protocol?: string; operations?: unknown } | undefined;
  if (capabilities?.protocol !== "d173-v2" || !Array.isArray(capabilities.operations)) return;
  const expires = Number(frame.auth_expires_at_ms || 0);
  if (!Number.isFinite(expires) || expires <= Date.now()) return;
  channel = { socket, owner, expires, operations: new Set(capabilities.operations.filter((x): x is string => typeof x === "string")) };
}

export function acceptCommandResponse(frame: Record<string, unknown>, owner: object): boolean {
  if (frame.type !== "response") return false;
  const requestId = String(frame.request_id || "");
  const entry = pending.get(requestId);
  if (entry && entry.owner === owner) {
    const status = Number(frame.status || 0);
    if (Number.isInteger(status) && status >= 200 && status <= 599) entry.complete(status, frame.payload);
    else entry.cancel();
  }
  return true; // A late response must never enter the realtime cursor reducer.
}

export function commandOperation(path: string, method: string): string | null {
  const route = path.split("?", 1)[0];
  const reads: Record<string, string> = {
    "/api/realtime/presence": "realtime.presence",
    "/api/realtime/delta": "realtime.delta",
    "/api/reporter/snapshot": "reporter.snapshot",
    "/api/picker/snapshot": "picker.snapshot",
    "/api/skus/catalog-info": "sku.catalog.info",
    "/api/skus/catalog-delta": "sku.catalog.delta",
  };
  const writes: Record<string, string> = {
    "/api/picker/reports": "shortage.create",
    "/api/picker/reports/withdraw": "shortage.withdraw",
    "/api/reporter/batches/resolve": "shortage.resolve",
    "/api/reporter/batches/correct": "shortage.correct",
  };
  return method === "GET" ? reads[route] || null : method === "POST" ? writes[route] || null : null;
}

export function negotiatedCommandFetch(
  path: string, init: RequestInit, owner: object, stillCurrent: () => boolean,
  http: () => Promise<Response>,
  onSocketSend: () => void = () => undefined,
): Promise<Response> {
  const operation = commandOperation(path, String(init.method || "GET").toUpperCase());
  const active = channel;
  if (!operation || !active || active.owner !== owner || active.socket.readyState !== 1 ||
      active.expires <= Date.now() || !active.operations.has(operation) || pending.size >= MAX_PENDING || init.signal?.aborted) return http();
  let args: Record<string, unknown>;
  try {
    args = init.body ? JSON.parse(String(init.body)) as Record<string, unknown>
      : Object.fromEntries(new URLSearchParams(path.split("?")[1] || ""));
  } catch { return http(); }
  const requestId = String(args.d173_request_id || args.request_id || crypto.randomUUID());
  const message = JSON.stringify({ type: "request", request_id: requestId, operation, args });
  if (new TextEncoder().encode(message).byteLength > MAX_FRAME_BYTES || pending.has(requestId)) return http();
  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    let httpStarted = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;
    const finish = (response?: Response, error?: unknown) => {
      if (settled) return;
      settled = true;
      if (hedge !== undefined) clearTimeout(hedge);
      pending.delete(requestId);
      if (!stillCurrent()) reject(new Error("SESSION_CHANGED"));
      else if (error) reject(error);
      else resolve(response!);
    };
    const fallback = () => {
      if (settled || httpStarted) return;
      if (!stillCurrent()) { finish(undefined, new Error("SESSION_CHANGED")); return; }
      httpStarted = true;
      void http().then((response) => finish(response), (error) => finish(undefined, error));
    };
    pending.set(requestId, { owner,
      complete(status, payload) {
        if (status === 501 || status === 426 || status === 429 || status >= 500) { fallback(); return; }
        finish(new Response(JSON.stringify(payload ?? {}), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } }));
      },
      cancel: fallback,
    });
    hedge = setTimeout(fallback, HTTP_HEDGE_MS);
    try { active.socket.send(message); onSocketSend(); } catch { fallback(); }
  });
}
