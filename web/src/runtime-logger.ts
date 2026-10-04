import { getSessionDiagnosticIdentity, hasSession, uploadRuntimeLog } from "./api";
import { WEB_VERSION } from "./web-version";

type Severity = "INFO" | "ERROR";
type SnapshotProvider = () => Record<string, unknown>;
type RuntimeEvent = {
  at: string;
  sequence?: number;
  level: Severity;
  category: string;
  name: string;
  duration_ms?: number;
  data?: unknown;
};

const DEVICE_KEY = "supra_inventory_web_device_id_v1";
const SLOT_KEY = "supra_inventory_web_log_slot_v1";
const PENDING_ERROR_KEY = "supra_inventory_web_pending_error_v1";
const JOURNAL_PREFIX = "supra_inventory_web_runtime_journal_v2:";
const JOURNAL_INDEX_KEY = "supra_inventory_web_runtime_journal_index_v2";
const MAX_JOURNAL_CHARS = 720_000;
const MAX_JOURNAL_EVENTS = 320;
const MAX_EVENTS = 420;
const MAX_LONG_TASKS = 100;
const events: RuntimeEvent[] = [];
const longTasks: Array<{ at: string; start_ms: number; duration_ms: number; name: string }> = [];
const startedAt = Date.now();
let snapshotProvider: SnapshotProvider = () => ({});
let initialized = false;
let lastImmediateErrorAt = 0;
let scheduledSendInFlight = false;
let journalPersistTimer: number | null = null;
let journalKey = "";
let journalState: {
  format: "supra-web-runtime-journal-v2";
  session_key: string;
  next_sequence: number;
  dropped_events: number;
  last_updated_at: string;
  events: RuntimeEvent[];
} | null = null;

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


function journalSessionKey(): string {
  const identity = getSessionDiagnosticIdentity();
  if (!identity || identity.session_channel !== "WEB") return "";
  return `${identity.user_id}:${identity.session_generation}`;
}

function journalStorageKey(sessionKey: string): string {
  return JOURNAL_PREFIX + sessionKey;
}

function pruneOldJournals(currentStorageKey: string): void {
  try {
    const raw = localStorage.getItem(JOURNAL_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) as Array<{ key?: string; updated_at?: string }> : [];
    const next = parsed
      .filter((item) => item && typeof item.key === "string" && item.key.startsWith(JOURNAL_PREFIX))
      .filter((item) => item.key !== currentStorageKey);
    next.unshift({ key: currentStorageKey, updated_at: new Date().toISOString() });
    const keep = next.slice(0, 3);
    const keepSet = new Set(keep.map((item) => item.key));
    for (const item of next.slice(3)) {
      if (item.key && !keepSet.has(item.key)) localStorage.removeItem(item.key);
    }
    localStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(keep));
  } catch {
    // Diagnostics persistence is best-effort and must never block business UI.
  }
}

function ensureJournal(): typeof journalState {
  const sessionKey = journalSessionKey();
  if (!sessionKey) {
    journalKey = "";
    journalState = null;
    return null;
  }
  const storageKey = journalStorageKey(sessionKey);
  if (journalState && journalKey === storageKey) return journalState;
  journalKey = storageKey;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) as typeof journalState : null;
    if (
      parsed &&
      parsed.format === "supra-web-runtime-journal-v2" &&
      parsed.session_key === sessionKey &&
      Array.isArray(parsed.events)
    ) {
      journalState = {
        format: "supra-web-runtime-journal-v2",
        session_key: sessionKey,
        next_sequence: Math.max(1, Math.trunc(Number(parsed.next_sequence || 1))),
        dropped_events: Math.max(0, Math.trunc(Number(parsed.dropped_events || 0))),
        last_updated_at: String(parsed.last_updated_at || new Date().toISOString()),
        events: parsed.events.slice(-MAX_JOURNAL_EVENTS),
      };
    } else {
      journalState = null;
    }
  } catch {
    journalState = null;
  }
  if (!journalState) {
    journalState = {
      format: "supra-web-runtime-journal-v2",
      session_key: sessionKey,
      next_sequence: 1,
      dropped_events: 0,
      last_updated_at: new Date().toISOString(),
      events: [],
    };
  }
  pruneOldJournals(storageKey);
  return journalState;
}

function persistJournalNow(): void {
  journalPersistTimer = null;
  const existingJournal = journalState;
  const existingKey = journalKey;
  const journal = existingJournal && existingKey ? existingJournal : ensureJournal();
  const storageKey = existingJournal && existingKey ? existingKey : journalKey;
  if (!journal || !storageKey) return;
  try {
    journal.last_updated_at = new Date().toISOString();
    while (journal.events.length > MAX_JOURNAL_EVENTS) {
      journal.events.shift();
      journal.dropped_events += 1;
    }
    let encoded = JSON.stringify(journal);
    while (encoded.length > MAX_JOURNAL_CHARS && journal.events.length > 20) {
      journal.events.splice(0, Math.min(20, journal.events.length));
      journal.dropped_events += 20;
      encoded = JSON.stringify(journal);
    }
    localStorage.setItem(storageKey, encoded);
  } catch {
    // Storage quota/private-mode failures are diagnostics-only.
  }
}

function scheduleJournalPersist(): void {
  if (journalPersistTimer != null) return;
  journalPersistTimer = window.setTimeout(persistJournalNow, 250);
}

function journalSnapshot(): Record<string, unknown> {
  const journal = ensureJournal();
  if (!journal) return { persistent: false };
  const first = journal.events[0]?.sequence ?? null;
  const last = journal.events[journal.events.length - 1]?.sequence ?? null;
  return {
    persistent: true,
    format: journal.format,
    session_key: journal.session_key,
    first_sequence: first,
    last_sequence: last,
    dropped_events: journal.dropped_events,
    recent_events: journal.events.slice(-260),
  };
}

function markJournalDriveSynced(lastSequence: number | null): void {
  const journal = ensureJournal();
  if (!journal || lastSequence == null) return;
  journal.events = journal.events.filter((event) => Number(event.sequence || 0) > lastSequence);
  journal.dropped_events = 0;
  scheduleJournalPersist();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pushEvent(event: RuntimeEvent): void {
  const normalized: RuntimeEvent = {
    ...event,
    at: event.at || new Date().toISOString(),
    level: event.level === "ERROR" ? "ERROR" : "INFO",
    category: redactText(event.category || "APP"),
    name: redactText(event.name || "event"),
    duration_ms: event.duration_ms == null ? undefined : Math.max(0, Math.round(event.duration_ms * 100) / 100),
    data: sanitize(event.data),
  };
  const journal = ensureJournal();
  if (journal) {
    normalized.sequence = journal.next_sequence++;
    journal.events.push(normalized);
    if (journal.events.length > MAX_JOURNAL_EVENTS) {
      journal.events.shift();
      journal.dropped_events += 1;
    }
    scheduleJournalPersist();
  }
  while (events.length >= MAX_EVENTS) events.shift();
  events.push(normalized);
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

function currentSlotKey(): string | null {
  const parts = vietnamParts();
  const hour = Number(parts.hour || 0);
  if (hour < 6) return null;
  const slot = hour >= 21 ? 21 : hour >= 18 ? 18 : hour >= 12 ? 12 : 6;
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
    web_version: WEB_VERSION,
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
    journal: journalSnapshot(),
    recent_events: events.slice(-260),
  };
}

export function getWebRuntimeDiagnosticSnapshot(reason = "local_support"): Record<string, unknown> {
  return sanitize(runtimePayload(reason)) as Record<string, unknown>;
}

async function send(
  severity: Severity,
  reason: string,
  extra?: unknown,
  options: { boundaryId?: string; traceId?: string } = {},
): Promise<boolean> {
  if (!hasSession()) return false;
  try {
    const identity = getSessionDiagnosticIdentity();
    const generatedAt = new Date().toISOString();
    const stableBoundary = options.boundaryId ||
      (reason.startsWith("scheduled_") ? `web:${reason}` : `web:${reason}:${generatedAt}`);
    const bundleId = await sha256Hex(
      `WEB|${deviceId()}|${identity?.user_id || "unknown"}|${identity?.session_generation || 0}|${stableBoundary}`,
    );
    const journal = ensureJournal();
    const archivedThrough = journal?.events[journal.events.length - 1]?.sequence ?? null;
    const result = await uploadRuntimeLog({
      source: "WEB",
      severity,
      reason,
      generated_at: generatedAt,
      bundle_id: bundleId,
      boundary_id: stableBoundary,
      trace_id: options.traceId || "",
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
    if (result.archive_status === "DRIVE_SYNCED") markJournalDriveSynced(archivedThrough);
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
    if (!slot) return;
    const slotIdentity = `${journalSessionKey()}:${slot}`;
    if (localStorage.getItem(SLOT_KEY) === slotIdentity) return;
    if (await send("INFO", `scheduled_${slot}`, undefined, { boundaryId: `web:scheduled:${slot}` })) {
      localStorage.setItem(SLOT_KEY, slotIdentity);
    }
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

  window.addEventListener("supra:realtime-telemetry", (event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
    runtimeLogMetric(
      "REALTIME",
      String(detail.name || "activity"),
      detail,
      Number(detail.duration_ms || 0),
      detail.error ? "ERROR" : "INFO",
    );
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
    if (journalPersistTimer != null) {
      window.clearTimeout(journalPersistTimer);
      journalPersistTimer = null;
    }
    persistJournalNow();
    journalKey = "";
    journalState = null;
    runtimeLogMetric("SESSION", "changed");
    void maybeSendScheduledWebLog();
  });

  window.setInterval(() => void maybeSendScheduledWebLog(), 60_000);
  runtimeLogMetric("SESSION", "logger_initialized", { device_id: deviceId() });
  void maybeSendScheduledWebLog();
}
