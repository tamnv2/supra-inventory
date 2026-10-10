/**
 * D167: bounded DO request attribution, no persistent storage or provider calls.
 * Only fixed route categories are retained. Raw URLs, account IDs, user IDs,
 * SKU/PL, tokens, query strings and request/response bodies are excluded.
 * Reset on isolate restart; this is diagnostic evidence, never billed usage.
 */
type D167RouteSample = {
  hour_utc: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OTHER";
  family: string;
  requests: number;
};
const MAX_HOURS = 36;
const MAX_BUCKETS = MAX_HOURS * 18;
const samples = new WeakMap<DurableObjectState, Map<string, D167RouteSample>>();

function familyForPath(path: string): string {
  // Order from most specific to least; classifications use fixed strings only.
  if (path.includes("/picker/result-stage") || path.includes("/picker/results/receipt")) return "PICKER_ACK";
  if (path.includes("/picker/results")) return "PICKER_RESULTS";
  if (path.includes("/picker/reports")) return "PICKER_REPORTS";
  if (path.includes("/reporter/queue")) return "REPORTER_QUEUE";
  if (path.includes("/reporter/overdue")) return "REPORTER_OVERDUE";
  if (path.includes("/reporter/recent")) return "REPORTER_RECENT";
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

export function recordD167DoRequest(state: DurableObjectState, method: string, path: string): void {
  let bucket = samples.get(state);
  if (!bucket) { bucket = new Map(); samples.set(state, bucket); }
  const hour = new Date().toISOString().slice(0, 13) + ":00:00Z";
  const action = method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE"
    ? method : "OTHER";
  const family = familyForPath(path);
  const key = hour + "|" + action + "|" + family;
  const existing = bucket.get(key);
  if (existing) { existing.requests++; return; }
  if (bucket.size >= MAX_BUCKETS) {
    const cutoff = Date.now() - MAX_HOURS * 3600000;
    for (const [k, v] of bucket) if (Date.parse(v.hour_utc) < cutoff) bucket.delete(k);
    while (bucket.size >= MAX_BUCKETS) {
      const first = bucket.keys().next().value;
      if (first === undefined) break;
      bucket.delete(first);
    }
  }
  bucket.set(key, { hour_utc: hour, method: action, family, requests: 1 });
}

export function snapshotD167DoRequests(state: DurableObjectState): {
  coverage: string;
  rows: D167RouteSample[];
} {
  return {
    coverage: "INVENTORY_CORE_ISOLATE_ONLY__RESTART_RESETS__ESTIMATE_NOT_BILLING",
    rows: [...(samples.get(state)?.values() || [])]
      .map(row => ({ ...row }))
      .sort((a, b) => a.hour_utc.localeCompare(b.hour_utc) || a.family.localeCompare(b.family)),
  };
}
