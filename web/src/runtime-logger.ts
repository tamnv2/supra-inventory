import { hasSession, uploadRuntimeLog } from "./api";

type Severity = "INFO" | "ERROR";
type SnapshotProvider = () => Record<string, unknown>;
type RuntimeEvent = {
  at: string;
  level: Severity;
  category: string;
  name: string;
  duration_ms?: number;
  data?: unknown;
};

const DEVICE_KEY = "supra_inventory_web_device_id_v1";
const SLOT_KEY = "supra_inventory_web_log_slot_v1";
const PENDING_ERROR_KEY = "supra_inventory_web_pending_error_v1";
const MAX_EVENTS = 420;
const MAX_LONG_TASKS = 100;
const events: RuntimeEvent[] = [];
const longTasks: Array<{ at: string; start_ms: number; duration_ms: number; name: string }> = [];
const startedAt = Date.now();
let snapshotProvider: SnapshotProvider = () => ({});
let initialized = false;
let lastImmediateErrorAt = 0;
let scheduledSendInFlight = false;

function redactText(value: string): string {
  let next = value.slice(0, 2_000);
  next = next.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]");
  next = next.replace(/Bearer\s+[A-Za-z0-9._~+\/-]{16,}/gi, "Bearer [REDACTED]");
  next = next.replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]");
  next = next.replace(/(authorization|token|password|secret|private[_ -]?key|api[_ -]?key|refresh[_ -]?token|cookie|keystore|signing)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  return next;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 7) return "[TRUNCATED]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 220).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 120)) {
      output[key] = /authorization|bearer|token|password|secret|private|credential|api.?key|refresh|cookie|signing|keystore/i.test(key)
        ? "[REDACTED]"
        : sanitize(item, depth + 1);
    }
    return output;
  }
  return redactText(String(value));
}

function pushEvent(event: RuntimeEvent): void {
  while (events.length >= MAX_EVENTS) events.shift();
  events.push({
    ...event,
    at: event.at || new Date().toISOString(),
    level: event.level === "ERROR" ? "ERROR" : "INFO",
    category: redactText(event.category || "APP"),
    name: redactText(event.name || "event"),
    duration_ms: event.duration_ms == null ? undefined : Math.max(0, Math.round(event.duration_ms * 100) / 100),
    data: sanitize(event.data),
  });
}

export function runtimeLogEvent(message: string, level = "INFO", data?: unknown): void {
  pushEvent({
    at: new Date().toISOString(),
    level: String(level).toUpperCase() === "ERROR" ? "ERROR" : "INFO",
    category: "APP",
    name: message,
    data,
  });
}

export function runtimeLogMetric(
  category: string,
  name: string,
  data?: unknown,
  durationMs?: number,
  level: Severity = "INFO",
): void {
  pushEvent({
    at: new Date().toISOString(),
    level,
    category,
    name,
    duration_ms: durationMs,
    data,
  });
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

function safeUrlSummary(raw: string): { origin: string; path: string; query_keys: string[] } {
  try {
    const url = new URL(raw, location.origin);
    return {
      origin: url.origin === location.origin ? "same-origin" : url.origin,
      path: url.pathname.slice(0, 240),
      query_keys: [...url.searchParams.keys()].slice(0, 20),
    };
  } catch {
    return { origin: "unknown", path: String(raw || "").split("?")[0].slice(0, 240), query_keys: [] };
  }
}

function describeElement(target: EventTarget | null): Record<string, unknown> | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest("button,a,input,select,textarea,form,[role=button],[data-section],[data-workspace-section]") || target;
  const html = element as HTMLElement;
  const data: Record<string, string> = {};
  for (const key of [
    "section",
    "workspaceSection",
    "queueFilter",
    "resultFilter",
    "resolve",
    "skipBatch",
    "detail",
    "pickerAction",
    "dateTarget",
    "dateDays",
    "dashboardStatus",
    "logSource",
  ]) {
    const value = html.dataset?.[key];
    if (value) data[key] = value.slice(0, 120);
  }
  const text = (html.getAttribute("aria-label") || html.getAttribute("title") || html.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return {
    tag: element.tagName.toLowerCase(),
    id: html.id || null,
    name: element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
      ? element.name || null
      : null,
    input_type: element instanceof HTMLInputElement ? element.type : null,
    text: text || null,
    data,
  };
}

function navigationTiming(): Record<string, unknown> | null {
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!entry) return null;
  return {
    type: entry.type,
    duration_ms: Math.round(entry.duration * 100) / 100,
    dom_interactive_ms: Math.round(entry.domInteractive * 100) / 100,
    dom_content_loaded_ms: Math.round(entry.domContentLoadedEventEnd * 100) / 100,
    load_event_ms: Math.round(entry.loadEventEnd * 100) / 100,
    response_start_ms: Math.round(entry.responseStart * 100) / 100,
    transfer_size_bytes: entry.transferSize,
    encoded_body_bytes: entry.encodedBodySize,
    decoded_body_bytes: entry.decodedBodySize,
  };
}

function paintTiming(): Array<Record<string, unknown>> {
  return performance.getEntriesByType("paint").slice(0, 10).map((entry) => ({
    name: entry.name,
    start_ms: Math.round(entry.startTime * 100) / 100,
  }));
}

function resourceTiming(): Record<string, unknown> {
  const rows = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const latest = rows.slice(-120);
  const slowest = [...latest]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20)
    .map((entry) => ({
      ...safeUrlSummary(entry.name),
      initiator: entry.initiatorType,
      duration_ms: Math.round(entry.duration * 100) / 100,
      transfer_size_bytes: entry.transferSize,
      encoded_body_bytes: entry.encodedBodySize,
    }));
  return {
    total_entries: rows.length,
    sampled_entries: latest.length,
    sampled_transfer_bytes: latest.reduce((sum, row) => sum + Math.max(0, Number(row.transferSize || 0)), 0),
    slowest,
  };
}

function localStorageStats(): Record<string, unknown> {
  let bytes = 0;
  const keys: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      keys.push(key);
      const value = localStorage.getItem(key) || "";
      bytes += (key.length + value.length) * 2;
    }
  } catch {
    return { available: false };
  }
  return {
    available: true,
    key_count: keys.length,
    approximate_bytes: bytes,
    keys: keys.filter((key) => !/token|password|secret|credential|session|cookie/i.test(key)).slice(0, 60),
  };
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
      referrer_origin: document.referrer ? safeUrlSummary(document.referrer).origin : null,
    },
    browser: {
      user_agent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      online: navigator.onLine,
      hardware_concurrency: navigator.hardwareConcurrency || null,
      device_memory_gb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight, pixel_ratio: window.devicePixelRatio },
      screen: {
        width: screen.width,
        height: screen.height,
        avail_width: screen.availWidth,
        avail_height: screen.availHeight,
        color_depth: screen.colorDepth,
      },
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
    performance: {
      uptime_ms: Date.now() - startedAt,
      navigation: navigationTiming(),
      paint: paintTiming(),
      resources: resourceTiming(),
      long_tasks: longTasks.slice(-80),
    },
    dom: {
      nodes: document.querySelectorAll("*").length,
      buttons: document.querySelectorAll("button").length,
      inputs: document.querySelectorAll("input,select,textarea").length,
      tables: document.querySelectorAll("table").length,
      table_rows: document.querySelectorAll("tbody tr").length,
      active_element: describeElement(document.activeElement),
    },
    storage: localStorageStats(),
    state: sanitize(snapshotProvider()),
    recent_events: events.slice(-260),
  };
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
  } catch (error) {
    pushEvent({
      at: new Date().toISOString(),
      level: "ERROR",
      category: "LOG",
      name: "upload_failed",
      data: error instanceof Error ? { message: error.message } : String(error),
    });
    return false;
  }
}

export async function sendWebRuntimeLog(reason = "manual", severity: Severity = "INFO", extra?: unknown): Promise<boolean> {
  runtimeLogEvent(`Gửi log: ${reason}`, severity, extra);
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
    }).slice(0, 48_000));
  } catch { /* storage unavailable */ }
}

async function immediateError(reason: string, detail: unknown): Promise<void> {
  runtimeLogEvent(reason, "ERROR", detail);
  rememberError(reason, detail);
  const now = Date.now();
  if (now - lastImmediateErrorAt < 20_000) return;
  lastImmediateErrorAt = now;
  if (await send("ERROR", reason, detail)) localStorage.removeItem(PENDING_ERROR_KEY);
}

export async function maybeSendScheduledWebLog(): Promise<void> {
  if (!hasSession() || scheduledSendInFlight) return;
  scheduledSendInFlight = true;
  try {
    await flushPendingError();
    const slot = currentSlotKey();
    if (localStorage.getItem(SLOT_KEY) === slot) return;
    if (await send("INFO", `scheduled_${slot}`)) localStorage.setItem(SLOT_KEY, slot);
  } finally {
    scheduledSendInFlight = false;
  }
}

function installPerformanceObservers(): void {
  try {
    const supported = (PerformanceObserver as typeof PerformanceObserver & { supportedEntryTypes?: string[] }).supportedEntryTypes || [];
    if (supported.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          while (longTasks.length >= MAX_LONG_TASKS) longTasks.shift();
          longTasks.push({
            at: new Date().toISOString(),
            start_ms: Math.round(entry.startTime * 100) / 100,
            duration_ms: Math.round(entry.duration * 100) / 100,
            name: redactText(entry.name || "longtask"),
          });
          if (entry.duration >= 100) {
            runtimeLogMetric("PERF", "long_task", { start_ms: entry.startTime }, entry.duration);
          }
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    }
  } catch {
    // PerformanceObserver support varies by browser; logging must never block the product.
  }
}

export function initWebRuntimeLogging(provider: SnapshotProvider): void {
  snapshotProvider = provider;
  if (initialized) return;
  initialized = true;
  installPerformanceObservers();

  window.addEventListener("error", (event) => {
    void immediateError("window_error", {
      message: event.message,
      filename: safeUrlSummary(event.filename || "").path,
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

  window.addEventListener("supra:api-telemetry", (event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
    runtimeLogMetric(
      "API",
      String(detail.name || "request"),
      detail,
      Number(detail.duration_ms || 0),
      detail.error ? "ERROR" : "INFO",
    );
  });

  window.addEventListener("supra:ui-telemetry", (event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
    runtimeLogMetric(
      "UI",
      String(detail.name || "interaction"),
      detail,
      Number(detail.duration_ms || 0),
      detail.error ? "ERROR" : "INFO",
    );
  });

  window.addEventListener("supra:realtime-status", (event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
    runtimeLogMetric("REALTIME", "status", detail);
  });

  document.addEventListener("click", (event) => {
    const target = describeElement(event.target);
    if (target) runtimeLogMetric("UI_INPUT", "click", target);
  }, true);

  document.addEventListener("submit", (event) => {
    const target = describeElement(event.target);
    if (target) runtimeLogMetric("UI_INPUT", "submit", target);
  }, true);

  document.addEventListener("change", (event) => {
    const target = describeElement(event.target);
    if (target) runtimeLogMetric("UI_INPUT", "change", target);
  }, true);

  window.addEventListener("online", () => {
    runtimeLogMetric("NETWORK", "online");
    void maybeSendScheduledWebLog();
  });
  window.addEventListener("offline", () => runtimeLogMetric("NETWORK", "offline"));
  window.addEventListener("hashchange", () => runtimeLogMetric("NAVIGATION", "hashchange", { hash: location.hash }));
  window.addEventListener("popstate", () => runtimeLogMetric("NAVIGATION", "popstate", { hash: location.hash }));
  document.addEventListener("visibilitychange", () => {
    runtimeLogMetric("PAGE", "visibility", { visibility: document.visibilityState });
    if (document.visibilityState === "visible") void maybeSendScheduledWebLog();
  });
  window.addEventListener("supra:session-changed", () => {
    runtimeLogMetric("SESSION", "changed");
    void maybeSendScheduledWebLog();
  });

  window.setInterval(() => void maybeSendScheduledWebLog(), 60_000);
  runtimeLogMetric("SESSION", "logger_initialized", { device_id: deviceId() });
  void maybeSendScheduledWebLog();
}
