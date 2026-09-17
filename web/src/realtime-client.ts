const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, "");
const SESSION_KEY = "supra_inventory_beta_session_v1";
const LAST_SEQ_PREFIX = "supra_inventory_realtime_seq_v2:";

type StoredSession = {
  id_token?: string;
  expires_at?: number;
  user?: { user_id?: string; role?: string };
};

export type RealtimeEventFrame = {
  type?: string;
  event?: string;
  event_id?: string;
  seq?: number | null;
  scopes?: string[];
  batch_id?: string | null;
  batch_version?: number | null;
  snapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  server_time?: string;
  latest_seq?: number;
};

type DeltaResponse = {
  events?: RealtimeEventFrame[];
  cursor_seq?: number;
  latest_seq?: number;
  complete?: boolean;
};

let socket: WebSocket | null = null;
let connecting = false;
let reconnectTimer: number | null = null;
let reconnectDelay = 1000;
let connectedUserId = "";
let lastSeq = 0;
let recovering = false;

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.id_token || !parsed.user?.user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function seqStorageKey(userId: string): string {
  return `${LAST_SEQ_PREFIX}${userId}`;
}

function loadLastSeq(userId: string): number {
  const parsed = Number(sessionStorage.getItem(seqStorageKey(userId)) || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function saveLastSeq(userId: string, value: number): void {
  lastSeq = Math.max(0, Math.trunc(value || 0));
  sessionStorage.setItem(seqStorageKey(userId), String(lastSeq));
}

function emitStatus(state: "connected" | "connecting" | "reconnecting" | "offline", detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(new CustomEvent("supra:realtime-status", { detail: { state, lastSeq, ...detail } }));
}

function emitEvents(events: RealtimeEventFrame[], source: "socket" | "delta"): void {
  if (!events.length) return;
  window.dispatchEvent(new CustomEvent("supra:realtime", { detail: { events, source, lastSeq } }));
}

function emitReconcile(reason: string): void {
  window.dispatchEvent(new CustomEvent("supra:reconcile", { detail: { reason, lastSeq } }));
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeSocket(): void {
  clearReconnectTimer();
  connecting = false;
  connectedUserId = "";
  const current = socket;
  socket = null;
  if (current && current.readyState <= WebSocket.OPEN) {
    try { current.close(1000, "session-ended"); } catch { /* no-op */ }
  }
}

function scheduleReconnect(): void {
  clearReconnectTimer();
  const session = readSession();
  if (!session?.id_token) {
    emitStatus("offline");
    return;
  }
  emitStatus("reconnecting", { retry_ms: reconnectDelay });
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    void ensureRealtime();
  }, reconnectDelay);
  reconnectDelay = Math.min(15_000, Math.round(reconnectDelay * 1.8));
}

async function requestTicket(token: string): Promise<{ ticket: string; latest_seq: number }> {
  const response = await fetch(`${API_BASE_URL}/api/realtime/ticket`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ client_type: "WEB" }),
  });
  const text = await response.text();
  let payload: { ticket?: string; latest_seq?: number; error?: string } = {};
  try { payload = JSON.parse(text) as typeof payload; } catch { payload = {}; }
  if (!response.ok || !payload.ticket) throw new Error(payload.error || `realtime_ticket_http_${response.status}`);
  return { ticket: payload.ticket, latest_seq: Number(payload.latest_seq || 0) };
}

function websocketUrl(ticket: string): string {
  const url = new URL("/api/realtime/connect", API_BASE_URL || window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

async function fetchDelta(token: string, afterSeq: number): Promise<DeltaResponse> {
  const params = new URLSearchParams({ after_seq: String(Math.max(0, afterSeq)), limit: "100" });
  const response = await fetch(`${API_BASE_URL}/api/realtime/delta?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`realtime_delta_http_${response.status}`);
  return (await response.json()) as DeltaResponse;
}

async function recoverDelta(reason: string): Promise<void> {
  if (recovering) return;
  const session = readSession();
  if (!session?.id_token || !session.user?.user_id) return;
  recovering = true;
  try {
    let cursor = lastSeq;
    for (let page = 0; page < 8; page += 1) {
      const delta = await fetchDelta(session.id_token, cursor);
      const events = Array.isArray(delta.events) ? delta.events : [];
      const ordered = events
        .filter((event) => Number(event.seq || 0) > cursor)
        .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));
      for (const event of ordered) {
        const seq = Number(event.seq || 0);
        if (seq > cursor) cursor = seq;
      }
      if (ordered.length) emitEvents(ordered, "delta");
      const serverCursor = Number(delta.cursor_seq ?? cursor);
      if (serverCursor > cursor) cursor = serverCursor;
      saveLastSeq(session.user.user_id, cursor);
      if (delta.complete !== false) return;
    }
    emitReconcile(`${reason}:delta_limit`);
  } catch {
    emitReconcile(`${reason}:delta_failed`);
  } finally {
    recovering = false;
  }
}

async function handleFrame(frame: RealtimeEventFrame): Promise<void> {
  const session = readSession();
  const userId = session?.user?.user_id;
  if (!userId) return;

  if (frame.type === "connected") {
    const latest = Number(frame.latest_seq || 0);
    if (lastSeq === 0) {
      saveLastSeq(userId, latest);
      emitReconcile("initial_authoritative_sync");
    } else if (latest < lastSeq) {
      saveLastSeq(userId, latest);
      emitReconcile("server_sequence_reset");
    } else if (latest > lastSeq) {
      await recoverDelta("reconnect_gap");
    }
    return;
  }

  if (frame.type !== "invalidate") return;
  const seq = Number(frame.seq || 0);
  if (!seq) {
    emitReconcile("unsequenced_event");
    return;
  }
  if (seq <= lastSeq) return;
  if (seq > lastSeq + 1) {
    await recoverDelta("sequence_gap");
    return;
  }
  saveLastSeq(userId, seq);
  emitEvents([frame], "socket");
}

async function ensureRealtime(): Promise<void> {
  const session = readSession();
  if (!session?.id_token || !session.user?.user_id) {
    closeSocket();
    emitStatus("offline");
    return;
  }

  if (connectedUserId !== session.user.user_id) {
    lastSeq = loadLastSeq(session.user.user_id);
  }
  if (socket && socket.readyState === WebSocket.OPEN && connectedUserId === session.user.user_id) return;
  if (socket && socket.readyState === WebSocket.CONNECTING && connectedUserId === session.user.user_id) return;
  if (connecting) return;

  closeSocket();
  connecting = true;
  connectedUserId = session.user.user_id;
  emitStatus("connecting");
  try {
    const ticket = await requestTicket(session.id_token);
    if (lastSeq === 0 && ticket.latest_seq > 0) {
      // The connected frame will set the initial cursor and request an authoritative reconcile.
    }
    const next = new WebSocket(websocketUrl(ticket.ticket));
    socket = next;
    next.onopen = () => {
      connecting = false;
      reconnectDelay = 1000;
      emitStatus("connected");
    };
    next.onmessage = (event) => {
      try {
        const frame = JSON.parse(String(event.data || "{}")) as RealtimeEventFrame;
        void handleFrame(frame);
      } catch {
        emitReconcile("malformed_realtime_frame");
      }
    };
    next.onerror = () => {
      // onclose performs retry.
    };
    next.onclose = () => {
      if (socket === next) socket = null;
      connecting = false;
      connectedUserId = "";
      scheduleReconnect();
    };
  } catch {
    connecting = false;
    connectedUserId = "";
    scheduleReconnect();
  }
}

window.setInterval(() => void ensureRealtime(), 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void ensureRealtime();
});
window.addEventListener("beforeunload", closeSocket);
window.addEventListener("supra:session-changed", () => void ensureRealtime());
void ensureRealtime();
