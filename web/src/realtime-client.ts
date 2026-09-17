const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, "");
const SESSION_KEY = "supra_inventory_beta_session_v1";
const APPLIED_SEQ_PREFIX = "supra_inventory_realtime_applied_seq_v3:";
const STREAM_EPOCH_PREFIX = "supra_inventory_realtime_epoch_v3:";

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
  retained_from_seq?: number;
  stream_epoch?: string;
};

type DeltaResponse = {
  events?: RealtimeEventFrame[];
  cursor_seq?: number;
  latest_seq?: number;
  retained_from_seq?: number;
  stream_epoch?: string;
  has_more?: boolean;
  resync_required?: boolean;
  resync_reason?: string | null;
  complete?: boolean;
};

export type RealtimeApplyContext = {
  source: "socket" | "delta" | "reconcile";
  reason: string;
  cursorSeq: number;
  streamEpoch: string;
};

export type RealtimeApplier = (
  events: RealtimeEventFrame[],
  context: RealtimeApplyContext,
) => Promise<boolean>;

let socket: WebSocket | null = null;
let connecting = false;
let reconnectTimer: number | null = null;
let dirtyTimer: number | null = null;
let reconnectDelay = 1000;
let connectedUserId = "";
let appliedSeq = 0;
let streamEpoch = "";
let recovering = false;
let dirty = false;
let applier: RealtimeApplier | null = null;
let processing: Promise<void> = Promise.resolve();

export function registerRealtimeApplier(next: RealtimeApplier): void {
  applier = next;
}

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
  return `${APPLIED_SEQ_PREFIX}${userId}`;
}

function epochStorageKey(userId: string): string {
  return `${STREAM_EPOCH_PREFIX}${userId}`;
}

function loadAppliedState(userId: string): void {
  const parsed = Number(sessionStorage.getItem(seqStorageKey(userId)) || 0);
  appliedSeq = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
  streamEpoch = String(sessionStorage.getItem(epochStorageKey(userId)) || "");
}

function saveAppliedState(userId: string, cursorSeq: number, epoch: string): void {
  appliedSeq = Math.max(0, Math.trunc(cursorSeq || 0));
  if (epoch) streamEpoch = epoch;
  sessionStorage.setItem(seqStorageKey(userId), String(appliedSeq));
  if (streamEpoch) sessionStorage.setItem(epochStorageKey(userId), streamEpoch);
  emitStatus(socket?.readyState === WebSocket.OPEN ? "connected" : "reconnecting");
}

function emitStatus(
  state: "connected" | "connecting" | "reconnecting" | "offline",
  detail: Record<string, unknown> = {},
): void {
  window.dispatchEvent(new CustomEvent("supra:realtime-status", {
    detail: { state, lastSeq: appliedSeq, appliedSeq, streamEpoch, dirty, ...detail },
  }));
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearDirtyTimer(): void {
  if (dirtyTimer !== null) {
    window.clearTimeout(dirtyTimer);
    dirtyTimer = null;
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

function enqueue(task: () => Promise<void>): void {
  processing = processing
    .then(task)
    .catch(() => {
      markDirty("processing_failed");
    });
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

function markDirty(reason: string): void {
  dirty = true;
  emitStatus(socket?.readyState === WebSocket.OPEN ? "connected" : "reconnecting", { dirty_reason: reason });
  if (dirtyTimer !== null) return;
  dirtyTimer = window.setTimeout(() => {
    dirtyTimer = null;
    enqueue(() => recoverDelta(`dirty:${reason}`));
  }, 1500);
}

async function requestTicket(token: string): Promise<{
  ticket: string;
  latest_seq: number;
  retained_from_seq: number;
  stream_epoch: string;
}> {
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
  let payload: {
    ticket?: string;
    latest_seq?: number;
    retained_from_seq?: number;
    stream_epoch?: string;
    error?: string;
  } = {};
  try { payload = JSON.parse(text) as typeof payload; } catch { payload = {}; }
  if (!response.ok || !payload.ticket) throw new Error(payload.error || `realtime_ticket_http_${response.status}`);
  return {
    ticket: payload.ticket,
    latest_seq: Number(payload.latest_seq || 0),
    retained_from_seq: Number(payload.retained_from_seq || 0),
    stream_epoch: String(payload.stream_epoch || ""),
  };
}

function websocketUrl(ticket: string): string {
  const url = new URL("/api/realtime/connect", API_BASE_URL || window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

async function fetchDelta(token: string, afterSeq: number, epoch: string): Promise<DeltaResponse> {
  const params = new URLSearchParams({ after_seq: String(Math.max(0, afterSeq)), limit: "100" });
  if (epoch) params.set("stream_epoch", epoch);
  const response = await fetch(`${API_BASE_URL}/api/realtime/delta?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`realtime_delta_http_${response.status}`);
  return (await response.json()) as DeltaResponse;
}

async function applyThrough(
  events: RealtimeEventFrame[],
  source: "socket" | "delta" | "reconcile",
  reason: string,
  cursorSeq: number,
  epoch: string,
): Promise<boolean> {
  if (!events.length && source !== "reconcile") return true;
  const current = applier;
  if (!current) return false;
  try {
    return await current(events, { source, reason, cursorSeq, streamEpoch: epoch });
  } catch {
    return false;
  }
}

async function authoritativeReconcile(reason: string, cursorSeq: number, epoch: string): Promise<boolean> {
  const session = readSession();
  const userId = session?.user?.user_id;
  if (!userId) return false;
  const ok = await applyThrough([], "reconcile", reason, cursorSeq, epoch);
  if (!ok) {
    markDirty(`${reason}:reconcile_apply_failed`);
    return false;
  }
  dirty = false;
  clearDirtyTimer();
  saveAppliedState(userId, cursorSeq, epoch);
  return true;
}

async function recoverDelta(reason: string): Promise<void> {
  if (recovering) return;
  const session = readSession();
  if (!session?.id_token || !session.user?.user_id) return;
  recovering = true;
  try {
    let cursor = appliedSeq;
    let epoch = streamEpoch;
    for (let page = 0; page < 8; page += 1) {
      const delta = await fetchDelta(session.id_token, cursor, epoch);
      const serverEpoch = String(delta.stream_epoch || epoch);
      const serverCursor = Math.max(0, Number(delta.cursor_seq ?? cursor));
      const latestSeq = Math.max(0, Number(delta.latest_seq ?? serverCursor));

      if (delta.resync_required === true || (epoch && serverEpoch && epoch !== serverEpoch)) {
        await authoritativeReconcile(
          `${reason}:${delta.resync_reason || "stream_reset"}`,
          latestSeq,
          serverEpoch,
        );
        return;
      }

      const events = (Array.isArray(delta.events) ? delta.events : [])
        .filter((event) => Number(event.seq || 0) > cursor)
        .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));

      const applied = await applyThrough(events, "delta", reason, serverCursor, serverEpoch);
      if (!applied) {
        markDirty(`${reason}:delta_apply_failed`);
        return;
      }

      dirty = false;
      clearDirtyTimer();
      saveAppliedState(session.user.user_id, serverCursor, serverEpoch);
      cursor = serverCursor;
      epoch = serverEpoch;

      const hasMore = delta.has_more === true || (delta.has_more == null && delta.complete === false);
      if (!hasMore) return;
      if (serverCursor >= latestSeq) return;
    }

    // Page budget is only a continuation boundary. Never mark unseen pages as applied.
    markDirty(`${reason}:delta_page_budget`);
  } catch {
    markDirty(`${reason}:delta_fetch_failed`);
  } finally {
    recovering = false;
  }
}

async function handleFrame(frame: RealtimeEventFrame): Promise<void> {
  const session = readSession();
  const userId = session?.user?.user_id;
  if (!userId) return;

  if (frame.type === "connected") {
    const latest = Math.max(0, Number(frame.latest_seq || 0));
    const serverEpoch = String(frame.stream_epoch || streamEpoch);

    if (streamEpoch && serverEpoch && streamEpoch !== serverEpoch) {
      await authoritativeReconcile("server_epoch_changed", latest, serverEpoch);
      return;
    }
    if (appliedSeq === 0 && latest > 0) {
      await authoritativeReconcile("initial_authoritative_sync", latest, serverEpoch);
      return;
    }
    if (latest < appliedSeq) {
      await authoritativeReconcile("server_sequence_reset", latest, serverEpoch);
      return;
    }
    if (!streamEpoch && serverEpoch) {
      saveAppliedState(userId, appliedSeq, serverEpoch);
    }
    if (latest > appliedSeq) await recoverDelta("reconnect_gap");
    return;
  }

  if (frame.type !== "invalidate") return;
  const seq = Number(frame.seq || 0);
  if (!seq) {
    markDirty("unsequenced_event");
    return;
  }
  if (seq <= appliedSeq) return;

  // A gap in the global sequence may contain unrelated Picker events. Delta scans the
  // global window and advances cursor_seq across authorized gaps without requiring +1.
  if (appliedSeq > 0 && seq > appliedSeq + 1) {
    await recoverDelta("sequence_gap");
    return;
  }

  const applied = await applyThrough([frame], "socket", "socket_event", seq, streamEpoch);
  if (!applied) {
    markDirty("socket_apply_failed");
    return;
  }
  dirty = false;
  clearDirtyTimer();
  saveAppliedState(userId, seq, streamEpoch);
}

async function ensureRealtime(): Promise<void> {
  const session = readSession();
  if (!session?.id_token || !session.user?.user_id) {
    closeSocket();
    emitStatus("offline");
    return;
  }

  if (connectedUserId !== session.user.user_id) {
    loadAppliedState(session.user.user_id);
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
    if (streamEpoch && ticket.stream_epoch && streamEpoch !== ticket.stream_epoch) {
      // The connected frame will perform an authoritative epoch reconcile.
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
        enqueue(() => handleFrame(frame));
      } catch {
        markDirty("malformed_realtime_frame");
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
  if (document.visibilityState === "visible") {
    void ensureRealtime();
    if (dirty) markDirty("visibility_resume");
  }
});
window.addEventListener("beforeunload", () => {
  clearDirtyTimer();
  closeSocket();
});
window.addEventListener("supra:session-changed", () => void ensureRealtime());
void ensureRealtime();
