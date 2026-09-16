const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, "");
const SESSION_KEY = "supra_inventory_beta_session_v1";

type StoredSession = {
  id_token?: string;
  expires_at?: number;
  user?: { user_id?: string };
};

type InvalidateFrame = {
  type?: string;
  event?: string;
  scopes?: string[];
};

let socket: WebSocket | null = null;
let connecting = false;
let reconnectTimer: number | null = null;
let reconnectDelay = 1000;
let connectedUserId = "";

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
  if (!session?.id_token) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    void ensureRealtime();
  }, reconnectDelay);
  reconnectDelay = Math.min(15_000, Math.round(reconnectDelay * 1.8));
}

async function requestTicket(token: string): Promise<string> {
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
  let payload: { ticket?: string; error?: string } = {};
  try { payload = JSON.parse(text) as { ticket?: string; error?: string }; } catch { payload = {}; }
  if (!response.ok || !payload.ticket) throw new Error(payload.error || `realtime_ticket_http_${response.status}`);
  return payload.ticket;
}

function websocketUrl(ticket: string): string {
  const url = new URL("/api/realtime/connect", API_BASE_URL || window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

function refreshAffectedViews(frame: InvalidateFrame): void {
  const scopes = Array.isArray(frame.scopes) ? frame.scopes : [];
  if (scopes.includes("reporter_queue") || scopes.includes("reporter_recent")) {
    document.querySelector<HTMLButtonElement>("#refresh-operations")?.click();
  }
  if (scopes.includes("sku_catalog")) {
    document.querySelector<HTMLButtonElement>("#sku-recent")?.click();
  }
}

async function ensureRealtime(): Promise<void> {
  const session = readSession();
  if (!session?.id_token || !session.user?.user_id) {
    closeSocket();
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN && connectedUserId === session.user.user_id) return;
  if (socket && socket.readyState === WebSocket.CONNECTING && connectedUserId === session.user.user_id) return;
  if (connecting) return;

  closeSocket();
  connecting = true;
  connectedUserId = session.user.user_id;
  try {
    const ticket = await requestTicket(session.id_token);
    const next = new WebSocket(websocketUrl(ticket));
    socket = next;
    next.onopen = () => {
      connecting = false;
      reconnectDelay = 1000;
    };
    next.onmessage = (event) => {
      try {
        const frame = JSON.parse(String(event.data || "{}")) as InvalidateFrame;
        if (frame.type === "invalidate") refreshAffectedViews(frame);
      } catch {
        // Ignore malformed realtime frames and keep the authoritative API snapshot intact.
      }
    };
    next.onerror = () => {
      // onclose performs the retry; avoid duplicate retry timers here.
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

window.setInterval(() => void ensureRealtime(), 3000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void ensureRealtime();
});
window.addEventListener("beforeunload", closeSocket);
void ensureRealtime();
