/**
 * D173-E049: persistent, aggregate-only InventoryCore execution counters.
 * Each recorded event is committed in the existing DO SQLite database before
 * returning. No raw SQL, arguments, paths, request bodies, SKU, names, IDs,
 * session material, credentials or network/provider calls are retained.
 *
 * Cost: one additional SQLite upsert/row write per recorded event. This is
 * intentionally explicit; a RAM-only checkpoint would lose recent data on
 * an unplanned DO restart and would not satisfy the Owner durability requirement.
 */
export type D173MetricKind = "SQL" | "ROUTE";

export type D173PersistedMetric = {
  hour_utc: string;
  metric_kind: D173MetricKind;
  metric_id: string;
  method: string;
  executions: number;
  rows_read: number;
  rows_written: number;
  max_rows_read: number;
  max_rows_written: number;
  latency_ms: number;
  max_latency_ms: number;
  unavailable_cursor_samples: number;
};

const RETENTION_DAYS = 35;
const DEFAULT_SNAPSHOT_HOURS = 36;
const MAX_SNAPSHOT_HOURS = RETENTION_DAYS * 24;
const nextPrune = new WeakMap<DurableObjectState, number>();
const persistenceFailures = new WeakMap<DurableObjectState, number>();

export function initializeD173MetricsTable(state: DurableObjectState): void {
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS d173_usage_counters (
      hour_utc TEXT NOT NULL,
      metric_kind TEXT NOT NULL CHECK(metric_kind IN ('SQL','ROUTE')),
      metric_id TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT '',
      executions INTEGER NOT NULL DEFAULT 0,
      rows_read INTEGER NOT NULL DEFAULT 0,
      rows_written INTEGER NOT NULL DEFAULT 0,
      max_rows_read INTEGER NOT NULL DEFAULT 0,
      max_rows_written INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      max_latency_ms INTEGER NOT NULL DEFAULT 0,
      unavailable_cursor_samples INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (hour_utc, metric_kind, metric_id, method)
    )
  `);
  // Existing startup schema already executes on the registered InventoryCore.
  // Prune the small 35-day bounded table at startup only, never on hot paths.
  state.storage.sql.exec(
    "DELETE FROM d173_usage_counters WHERE hour_utc < ?",
    new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString().slice(0, 13) + ":00:00Z",
  );
}

export function recordD173PersistedMetric(
  state: DurableObjectState,
  kind: D173MetricKind,
  metricId: string,
  method: string,
  rowsRead: number,
  rowsWritten: number,
  elapsedMs: number,
  unavailable: number,
): boolean {
  // Only callers owning fixed enum categories may supply IDs; defensive
  // bounded allowlist shape avoids ever writing raw URLs/SQL/payloads.
  if (!/^[A-Z0-9_]{1,48}$/.test(metricId) ||
      !/^(GET|POST|PUT|PATCH|DELETE|OTHER|)$/.test(method)) return false;
  const now = Date.now();
  const hour = new Date(now).toISOString().slice(0, 13) + ":00:00Z";
  const read = Math.max(0, Math.floor(Number.isFinite(rowsRead) ? rowsRead : 0));
  const written = Math.max(0, Math.floor(Number.isFinite(rowsWritten) ? rowsWritten : 0));
  const latency = Math.max(0, Math.floor(Number.isFinite(elapsedMs) ? elapsedMs : 0));
  try {
    state.storage.sql.exec(`
      INSERT INTO d173_usage_counters (
        hour_utc, metric_kind, metric_id, method,
        executions, rows_read, rows_written, max_rows_read,
        max_rows_written, latency_ms, max_latency_ms,
        unavailable_cursor_samples
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hour_utc, metric_kind, metric_id, method) DO UPDATE SET
        executions = executions + 1,
        rows_read = rows_read + excluded.rows_read,
        rows_written = rows_written + excluded.rows_written,
        max_rows_read = MAX(max_rows_read, excluded.max_rows_read),
        max_rows_written = MAX(max_rows_written, excluded.max_rows_written),
        latency_ms = latency_ms + excluded.latency_ms,
        max_latency_ms = MAX(max_latency_ms, excluded.max_latency_ms),
        unavailable_cursor_samples = unavailable_cursor_samples + excluded.unavailable_cursor_samples
    `, hour, kind, metricId, method, read, written, read, written, latency, latency,
       Math.max(0, unavailable));
    return true;
  } catch {
    // A broken diagnostic table must NEVER abort a business transaction.
    persistenceFailures.set(state, (persistenceFailures.get(state) || 0) + 1);
    return false;
  }
}

export function snapshotD173PersistentMetrics(
  state: DurableObjectState,
  kind: D173MetricKind,
  windowHours = DEFAULT_SNAPSHOT_HOURS,
): { coverage: string; durable: boolean; retention_days: number;
     snapshot_hours: number; persistence_failures_current_isolate: number;
     telemetry_row_writes_estimate: number; rows: D173PersistedMetric[] } {
  const hours = Math.max(1, Math.min(MAX_SNAPSHOT_HOURS,
    Number.isFinite(windowHours) ? Math.floor(windowHours) : DEFAULT_SNAPSHOT_HOURS));
  const cutoff = new Date(Date.now() - hours * 3600000).toISOString().slice(0, 13) + ":00:00Z";
  try {
    const rows = state.storage.sql.exec<D173PersistedMetric>(`
      SELECT hour_utc, metric_kind, metric_id, method, executions, rows_read,
        rows_written, max_rows_read, max_rows_written, latency_ms,
        max_latency_ms, unavailable_cursor_samples
      FROM d173_usage_counters
      WHERE metric_kind = ? AND hour_utc >= ?
      ORDER BY hour_utc, metric_id, method
    `, kind, cutoff).toArray();
    const count = rows.reduce((n, item) => n + item.executions, 0);
    return {
      coverage: "SQLITE_DURABLE_HOURLY_AGGREGATE__ALLOWLISTED_HOTPATHS__ESTIMATE_NOT_PROVIDER_BILLING",
      durable: true, retention_days: RETENTION_DAYS, snapshot_hours: hours,
      persistence_failures_current_isolate: persistenceFailures.get(state) || 0,
      telemetry_row_writes_estimate: count, rows,
    };
  } catch {
    return {
      coverage: "DURABLE_STORAGE_READ_UNAVAILABLE__FALLBACK_VOLATILE__NO_BILLING_CLAIM",
      durable: false, retention_days: RETENTION_DAYS, snapshot_hours: hours,
      persistence_failures_current_isolate: (persistenceFailures.get(state) || 0) + 1,
      telemetry_row_writes_estimate: 0, rows: [],
    };
  }
}
