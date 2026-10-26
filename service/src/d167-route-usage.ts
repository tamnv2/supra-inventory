import { recordD173PersistedMetric, snapshotD173PersistentMetrics } from "./d173-persistent-usage";

/**
 * D167: bounded DO request attribution, now restart-durable in existing DO SQLite.
 * Only fixed route categories are retained. Raw URLs, account IDs, user IDs,
 * SKU/PL, tokens, query strings and request/response bodies are excluded.
 * Per-route/hour upserts preserve execution counts on restart; this is an
 * estimate with explicit extra SQL writes, never provider billing.
 */
type D167RouteSample = {
  hour_utc: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OTHER";
  family: string;
  requests: number;
  latency_ms: number;
  max_latency_ms: number;
};
const MAX_HOURS = 36;
const MAX_BUCKETS = MAX_HOURS * 18;
const samples = new WeakMap<DurableObjectState, Map<string, D167RouteSample>>();

function familyForPath(path: string): string {
  if (path === "/__system_alarm") return "ALARM";
  // Order from most specific to least; classifications use fixed strings only.
  if (path.includes("/picker/result-stage") || path.includes("/picker/results/receipt")) return "PICKER_ACK";
  if (path.includes("/picker/results")) return "PICKER_RESULTS";
  if (path.includes("/picker/reports")) return "PICKER_REPORTS";
  if (path.includes("/reporter/queue")) return "REPORTER_QUEUE";
  if (path.includes("/reporter/overdue")) return "REPORTER_OVERDUE";
  if (path.includes("/reporter/recent")) return "REPORTER_RECENT";
  // E055: refine the former 16k/day OTHER_OPERATIONAL bucket using the
  // *existing* durable route write: zero extra calls or SQLite upserts.
  if (path.includes("/reporter/counters")) return "REPORTER_COUNTERS";
  if (path.includes("/reporter/batch-tickets")) return "REPORTER_BATCH_TICKETS";
  if (path.includes("/operational/sla")) return "SLA_CONFIG";
  if (path.includes("/operational/")) return "OTHER_OPERATIONAL";
  if (path.includes("/realtime/") || path === "/realtime") return "REALTIME";
  if (path.includes("/notification")) return "NOTIFICATIONS";
  if (path.includes("/runtime-log") || path.includes("/archive")) return "LOGS_ARCHIVE";
  if (path.includes("/sku") || path.includes("/catalog")) return "SKU_CATALOG";
  if (path.includes("/system-metrics")) return "SYSTEM_METRICS";
  if (path.includes("/auth") || path.includes("/session") || path.includes("/login")) return "AUTH_SESSION";
  if (path.includes("/admin") || path.includes("/users")) return "ADMIN";
  return "OTHER";
}

export function recordD167DoRequest(state: DurableObjectState, method: string, path: string, elapsedMs = 0): void {
  let bucket = samples.get(state);
  if (!bucket) { bucket = new Map(); samples.set(state, bucket); }
  const hour = new Date().toISOString().slice(0, 13) + ":00:00Z";
  const action = method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE"
    ? method : "OTHER";
  const family = familyForPath(path);
  const key = hour + "|" + action + "|" + family;
  // Persist first, before an unexpected isolate shutdown can reset counters.
  recordD173PersistedMetric(state, "ROUTE", family, action, 0, 0, elapsedMs, 0);
  const existing = bucket.get(key);
  if (existing) {
    existing.requests++;
    existing.latency_ms += elapsedMs;
    existing.max_latency_ms = Math.max(existing.max_latency_ms, elapsedMs);
    return;
  }
  if (bucket.size >= MAX_BUCKETS) {
    const cutoff = Date.now() - MAX_HOURS * 3600000;
    for (const [k, v] of bucket) if (Date.parse(v.hour_utc) < cutoff) bucket.delete(k);
    while (bucket.size >= MAX_BUCKETS) {
      const first = bucket.keys().next().value;
      if (first === undefined) break;
      bucket.delete(first);
    }
  }
  bucket.set(key, { hour_utc: hour, method: action, family, requests: 1,
    latency_ms: elapsedMs, max_latency_ms: elapsedMs });
}

export function snapshotD167DoRequests(state: DurableObjectState): {
  coverage: string;
  rows: D167RouteSample[];
  durable: boolean;
  telemetry_row_writes_estimate: number;
  persistence_failures_current_isolate: number;
} {
  const persisted = snapshotD173PersistentMetrics(state, "ROUTE");
  if (persisted.durable) {
    return {
      coverage: persisted.coverage + "__INVENTORY_CORE_ONLY",
      rows: persisted.rows.map((item) => ({
        hour_utc: item.hour_utc,
        method: item.method as D167RouteSample["method"],
        family: item.metric_id,
        requests: item.executions,
        latency_ms: item.latency_ms,
        max_latency_ms: item.max_latency_ms,
      })),
      durable: true,
      telemetry_row_writes_estimate: persisted.telemetry_row_writes_estimate,
      persistence_failures_current_isolate: persisted.persistence_failures_current_isolate,
    };
  }
  return {
    coverage: "INVENTORY_CORE_ISOLATE_FALLBACK_ONLY__RESTART_RESETS__ESTIMATE_NOT_BILLING",
    rows: [...(samples.get(state)?.values() || [])]
      .map(row => ({ ...row }))
      .sort((a, b) => a.hour_utc.localeCompare(b.hour_utc) || a.family.localeCompare(b.family)),
    durable: false, telemetry_row_writes_estimate: 0,
    persistence_failures_current_isolate: persisted.persistence_failures_current_isolate,
  };
}
