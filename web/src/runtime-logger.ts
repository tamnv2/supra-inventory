import { hasSession, uploadRuntimeLog } from "./api";

type Severity = "INFO" | "ERROR";
type SnapshotProvider = () => Record<string, unknown>;

const DEVICE_KEY = "supra_inventory_web_device_id_v1";
const SLOT_KEY = "supra_inventory_web_log_slot_v1";
const PENDING_ERROR_KEY = "supra_inventory_web_pending_error_v1";
const MAX_EVENTS = 120;
const events: Array<{ at: string; level: string; message: string }> = [];
let snapshotProvider: SnapshotProvider = () => ({});
let initialized = false;
let lastImmediateErrorAt = 0;

function redactText(value: string): string {
  let next = value.slice(0, 1500);
  next = next.replace(/Bearer\s+[A-Za-z0-9._~+\/-]{16,}/gi, "Bearer [REDACTED]");
  next = next.replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]");
  next = next.replace(/(authorization|token|password|secret|private[_ -]?key|api[_ -]?key|refresh[_ -]?token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  return next;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 60).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 60)) {
      output[key] = /authorization|token|password|secret|private|credential|api.?key|refresh|cookie/i.test(key)
        ? "[REDACTED]"
        : sanitize(item, depth + 1);
    }
    return output;
  }
  return redactText(String(value));
}

function deviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = `web-${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

function vietnamParts(date = new Date()): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentSlotKey(): string {
  const parts = vietnamParts();
  const hour = Number(parts.hour || 0);
  const slot = hour >= 18 ? 18 : hour >= 12 ? 12 : hour >= 6 ? 6 : 0;
  return `${parts.year}${parts.month}${parts.day}-${String(slot).padStart(2, "0")}`;
}

function runtimePayload(reason: string): Record<string, unknown> {
  const perf = performance as Performance & { memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number } };
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;
  return {
    reason,
    page: {
      path: location.pathname,
      hash: location.hash,
      visibility: document.visibilityState,
      title: document.title,
    },
    browser: {
      user_agent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      viewport: { width: window.innerWidth, height: window.innerHeight, pixel_ratio: window.devicePixelRatio },
      connection: connection ? {
        effective_type: connection.effectiveType || null,
        downlink_mbps: connection.downlink ?? null,
        rtt_ms: connection.rtt ?? null,
        save_data: connection.saveData ?? null,
      } : null,
      memory: perf.memory ? {
        used_js_heap_bytes: perf.memory.usedJSHeapSize ?? null,
        total_js_heap_bytes: perf.memory.totalJSHeapSize ?? null,
        js_heap_limit_bytes: perf.memory.jsHeapSizeLimit ?? null,
      } : null,
    },
    state: sanitize(snapshotProvider()),
    recent_events: events.slice(-80),
  };
}

export function runtimeLogEvent(message: string, level = "INFO"): void {
  if (events.length >= MAX_EVENTS) events.shift();
  events.push({ at: new Date().toISOString(), level: redactText(level), message: redactText(message) });
}

async function send(severity: Severity, reason: string, extra?: unknown): Promise<boolean> {
  if (!hasSession()) return false;
  try {
    await uploadRuntimeLog({
      source: "WEB",
      severity,
      reason,
      generated_at: new Date().toISOString(),
      device: {
        device_id: deviceId(),
        label: `Web ${navigator.platform || "browser"}`,
        platform: navigator.platform || "",
        user_agent: navigator.userAgent,
      },
      payload: {
        ...runtimePayload(reason),
        extra: sanitize(extra),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendWebRuntimeLog(reason = "manual", severity: Severity = "INFO", extra?: unknown): Promise<boolean> {
  runtimeLogEvent(`Gửi log: ${reason}`, severity);
  return send(severity, reason, extra);
}

async function flushPendingError(): Promise<void> {
  const raw = localStorage.getItem(PENDING_ERROR_KEY);
  if (!raw || !hasSession()) return;
  let pending: unknown = raw;
  try { pending = JSON.parse(raw); } catch { /* keep raw */ }
  if (await send("ERROR", "deferred_web_error", pending)) localStorage.removeItem(PENDING_ERROR_KEY);
}

function rememberError(reason: string, detail: unknown): void {
  try {
    localStorage.setItem(PENDING_ERROR_KEY, JSON.stringify({
      at: new Date().toISOString(),
      reason,
      detail: sanitize(detail),
    }).slice(0, 12000));
  } catch { /* storage unavailable */ }
}

async function immediateError(reason: string, detail: unknown): Promise<void> {
  runtimeLogEvent(reason, "ERROR");
  rememberError(reason, detail);
  const now = Date.now();
  if (now - lastImmediateErrorAt < 20_000) return;
  lastImmediateErrorAt = now;
  if (await send("ERROR", reason, detail)) localStorage.removeItem(PENDING_ERROR_KEY);
}

export async function maybeSendScheduledWebLog(): Promise<void> {
  if (!hasSession()) return;
  await flushPendingError();
  const slot = currentSlotKey();
  if (localStorage.getItem(SLOT_KEY) === slot) return;
  if (await send("INFO", `scheduled_${slot}`)) localStorage.setItem(SLOT_KEY, slot);
}

export function initWebRuntimeLogging(provider: SnapshotProvider): void {
  snapshotProvider = provider;
  if (initialized) return;
  initialized = true;

  window.addEventListener("error", (event) => {
    void immediateError("window_error", {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error instanceof Error ? event.error.stack : null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error
      ? { message: event.reason.message, stack: event.reason.stack }
      : event.reason;
    void immediateError("unhandled_promise_rejection", reason);
  });

  window.addEventListener("online", () => void maybeSendScheduledWebLog());
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void maybeSendScheduledWebLog();
  });
  window.addEventListener("supra:session-changed", () => void maybeSendScheduledWebLog());
  window.setInterval(() => void maybeSendScheduledWebLog(), 60_000);
  void maybeSendScheduledWebLog();
}
