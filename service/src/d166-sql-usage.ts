/**
 * D166 usage diagnostics for expensive InventoryCore SQL statements.
 *
 * Strictly in-memory: no disk writes, provider calls, timers, network, SKU/PL,
 * account identifiers, query parameters or free-form SQL text.
 *
 * Each observation is read from Cloudflare's already-executed SqlStorageCursor;
 * the SQL result and authoritative transaction remain unchanged.
 *
 * The counters reset on DO/isolate restart and are ESTIMATE_NOT_BILLING.
 */
export type D166SqlQueryId =
  | "BATCH_SNAPSHOT"
  | "RECENT_RESULTS_COUNT"
  | "RECENT_RESULTS_PAGE";

type SqlCursorUsage = {
  readonly rowsRead?: number;
  readonly rowsWritten?: number;
};

type Sample = {
  hour_utc: string;
  query_id: D166SqlQueryId;
  executions: number;
  rows_read: number;
  rows_written: number;
  max_rows_read: number;
  max_rows_written: number;
  latency_ms: number;
  max_latency_ms: number;
  unavailable_cursor_samples: number;
};

const MAX_BUCKET_HOURS = 36;
const QUERY_IDS = new Set<D166SqlQueryId>([
  "BATCH_SNAPSHOT",
  "RECENT_RESULTS_COUNT",
  "RECENT_RESULTS_PAGE",
]);
const buckets = new Map<string, Sample>();

function finiteNonnegative(input: unknown): number | null {
  const n = Number(input);
  return typeof input === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

export function recordD166SqlUsage(
  queryId: D166SqlQueryId,
  cursor: SqlCursorUsage,
  startedAtMs: number,
): void {
  if (!QUERY_IDS.has(queryId)) return;
  const now = Date.now();
  const hour = new Date(now).toISOString().slice(0, 13) + ":00:00Z";
  const key = hour + "|" + queryId;
  let sample = buckets.get(key);
  if (!sample) {
    sample = {
      hour_utc: hour,
      query_id: queryId,
      executions: 0,
      rows_read: 0,
      rows_written: 0,
      max_rows_read: 0,
      max_rows_written: 0,
      latency_ms: 0,
      max_latency_ms: 0,
      unavailable_cursor_samples: 0,
    };
    buckets.set(key, sample);
  }
  sample.executions++;
  const reads = finiteNonnegative(cursor.rowsRead);
  const writes = finiteNonnegative(cursor.rowsWritten);
  if (reads === null || writes === null) sample.unavailable_cursor_samples++;
  if (reads !== null) {
    sample.rows_read += reads;
    sample.max_rows_read = Math.max(reads, sample.max_rows_read);
  }
  if (writes !== null) {
    sample.rows_written += writes;
    sample.max_rows_written = Math.max(writes, sample.max_rows_written);
  }
  if (Number.isFinite(startedAtMs) && startedAtMs > 0) {
    const elapsed = Math.max(0, now - startedAtMs);
    sample.latency_ms += elapsed;
    sample.max_latency_ms = Math.max(sample.max_latency_ms, elapsed);
  }

  // Memory cap independent of client load; at most 36h * 3 query types.
  const cutoff = now - MAX_BUCKET_HOURS * 60 * 60 * 1000;
  if (buckets.size > QUERY_IDS.size * MAX_BUCKET_HOURS) {
    for (const [k, v] of buckets) {
      if (Date.parse(v.hour_utc) < cutoff) buckets.delete(k);
    }
    // Additional hard bound for arbitrary clock adjustments.
    while (buckets.size > QUERY_IDS.size * MAX_BUCKET_HOURS) {
      const firstKey = buckets.keys().next().value;
      if (typeof firstKey !== "string") break;
      buckets.delete(firstKey);
    }
  }
}

export function d166SqlUsageSnapshot(): {
  coverage: string;
  source: string;
  rows: Sample[];
} {
  return {
    coverage: "ISOLATE_PROCESS_LOCAL_RESTART_RESETS__ESTIMATE_NOT_BILLING",
    source: "SQL_CURSOR_ROWS_READ_WRITTEN_AFTER_EXECUTION",
    rows: [...buckets.values()].map((item) => ({ ...item }))
      .sort((a, b) => a.hour_utc.localeCompare(b.hour_utc) || a.query_id.localeCompare(b.query_id)),
  };
}
