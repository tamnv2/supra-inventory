import {
  initializeSlaAutomationSchema,
  readOperationalSlaConfig,
  scheduleNextOperationalAlarm,
  slaAutomationReadiness,
  validateOperationalSlaConfig,
  type OperationalSlaConfig,
} from "./sla-automation";

type SqlRow = Record<string, SqlStorageValue>;

type Actor = {
  user_id: string;
  employee_code: string | null;
  role?: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  display_name?: string;
};

type SlaConfig = OperationalSlaConfig;

type RealtimeRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";

const SLA_CONFIG_KEY = "operational_sla_v1";
const OPERATIONAL_SCHEMA_KEY = "operational_v2_schema_version";
const REALTIME_STREAM_EPOCH_KEY = "realtime_stream_epoch_v1";
export const OPERATIONAL_V2_SCHEMA_VERSION = 5;
const MAX_DELTA_LIMIT = 200;
const APP_TODAY_OPEN_SCOPE = "APP_TODAY_OPEN";
const BUSINESS_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

function appTodayStartIso(nowMs = Date.now()): string {
  const local = new Date(nowMs + BUSINESS_TIMEZONE_OFFSET_MS);
  const localMidnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(localMidnightAsUtc - BUSINESS_TIMEZONE_OFFSET_MS).toISOString();
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function hasColumn(state: DurableObjectState, tableName: string, columnName: string): boolean {
  return state.storage.sql
    .exec<{ name: string }>(`PRAGMA table_info(${tableName})`)
    .toArray()
    .some((row) => row.name === columnName);
}

function hasSqlObject(state: DurableObjectState, type: "table" | "trigger", name: string): boolean {
  return Boolean(first(
    state.storage.sql
      .exec<SqlRow>("SELECT name FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1", type, name)
      .toArray(),
  ));
}

function storedOperationalSchemaVersion(state: DurableObjectState): number {
  const row = first(
    state.storage.sql
      .exec<SqlRow>("SELECT value FROM schema_meta WHERE key = ? LIMIT 1", OPERATIONAL_SCHEMA_KEY)
      .toArray(),
  );
  const value = Number(row?.value || 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function readRealtimeStreamEpoch(state: DurableObjectState): string {
  const row = first(
    state.storage.sql
      .exec<SqlRow>("SELECT value_json FROM app_config WHERE key = ? LIMIT 1", REALTIME_STREAM_EPOCH_KEY)
      .toArray(),
  );
  if (!row?.value_json) return "";
  try {
    const parsed = JSON.parse(String(row.value_json)) as { epoch?: unknown };
    return String(parsed.epoch || "").trim();
  } catch {
    return "";
  }
}

function ensureRealtimeStreamEpoch(state: DurableObjectState): string {
  const existing = readRealtimeStreamEpoch(state);
  if (existing) return existing;
  const epoch = crypto.randomUUID();
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO app_config (key, value_json, updated_at, updated_by)
     VALUES (?, ?, ?, NULL)
     ON CONFLICT(key) DO UPDATE SET
       value_json = CASE
         WHEN app_config.value_json IS NULL OR app_config.value_json = '' THEN excluded.value_json
         ELSE app_config.value_json
       END,
       updated_at = CASE
         WHEN app_config.value_json IS NULL OR app_config.value_json = '' THEN excluded.updated_at
         ELSE app_config.updated_at
       END`,
    REALTIME_STREAM_EPOCH_KEY,
    JSON.stringify({ epoch }),
    at,
  );
  return readRealtimeStreamEpoch(state) || epoch;
}

export function realtimeStreamMetadata(state: DurableObjectState): {
  stream_epoch: string;
  latest_seq: number;
  retained_from_seq: number;
} {
  const row = first(
    state.storage.sql
      .exec<SqlRow>(
        "SELECT COALESCE(MIN(seq),0) AS retained_from_seq, COALESCE(MAX(seq),0) AS latest_seq FROM realtime_events",
      )
      .toArray(),
  ) || {};
  return {
    stream_epoch: readRealtimeStreamEpoch(state),
    latest_seq: Number(row.latest_seq || 0),
    retained_from_seq: Number(row.retained_from_seq || 0),
  };
}

export function operationalV2Readiness(state: DurableObjectState): {
  ready: boolean;
  schema_version: number;
  expected_schema_version: number;
} {
  const schemaVersion = storedOperationalSchemaVersion(state);
  const ready =
    schemaVersion >= OPERATIONAL_V2_SCHEMA_VERSION &&
    hasColumn(state, "report_batches", "version") &&
    hasColumn(state, "report_batches", "previous_batch_id") &&
    hasColumn(state, "report_batches", "last_report_at") &&
    hasSqlObject(state, "table", "realtime_events") &&
    hasSqlObject(state, "table", "result_acknowledgements") &&
    hasSqlObject(state, "table", "result_event_snapshots") &&
    hasSqlObject(state, "table", "notification_delivery_attempts") &&
    slaAutomationReadiness(state) &&
    Boolean(readRealtimeStreamEpoch(state)) &&
    hasSqlObject(state, "trigger", "trg_v2_report_event_stream") &&
    hasSqlObject(state, "trigger", "trg_v2_result_ack_targets") &&
    hasSqlObject(state, "trigger", "trg_v2_ticket_auto_skip_ack_target") &&
    hasSqlObject(state, "trigger", "trg_v2_ticket_auto_skip_version");
  return {
    ready,
    schema_version: schemaVersion,
    expected_schema_version: OPERATIONAL_V2_SCHEMA_VERSION,
  };
}

function first<T extends SqlRow>(rows: T[]): T | null {
  return rows[0] ?? null;
}

function readSlaConfig(state: DurableObjectState): SlaConfig | null {
  return readOperationalSlaConfig(state);
}

function slaState(firstReportAt: string, config: SlaConfig | null, nowMs = Date.now()): { state: string; waiting_minutes: number } {
  const firstMs = Date.parse(firstReportAt);
  const waitingMinutes = Number.isFinite(firstMs) ? Math.max(0, Math.floor((nowMs - firstMs) / 60_000)) : 0;
  if (!config) return { state: "UNCONFIGURED", waiting_minutes: waitingMinutes };
  if (waitingMinutes >= config.escalation_minutes) return { state: "ESCALATED", waiting_minutes: waitingMinutes };
  if (waitingMinutes >= config.warning_minutes) return { state: "WARNING", waiting_minutes: waitingMinutes };
  return { state: "NORMAL", waiting_minutes: waitingMinutes };
}

function slaDeadlines(firstReportAt: string, config: SlaConfig | null): { warning_at: string | null; escalation_at: string | null } {
  const firstMs = Date.parse(firstReportAt);
  if (!config || !Number.isFinite(firstMs)) return { warning_at: null, escalation_at: null };
  return {
    warning_at: new Date(firstMs + config.warning_minutes * 60_000).toISOString(),
    escalation_at: new Date(firstMs + config.escalation_minutes * 60_000).toISOString(),
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function currentBatchSnapshot(state: DurableObjectState, batchId: string): Record<string, unknown> | null {
  if (!batchId) return null;
  const row = first(
    state.storage.sql.exec<SqlRow>(
      `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.last_report_at,
              b.resolved_at, b.resolution, b.resolution_source, b.correction_deadline_at,
              b.auto_skip_deadline_at, b.version, b.previous_batch_id,
              p.resolved_at AS previous_resolved_at,
              (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id = b.batch_id) AS total_ticket_count,
              (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id = b.batch_id AND t.status = 'OPEN' AND t.auto_skip_allowed_at IS NULL) AS open_ticket_count,
              (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id = b.batch_id AND t.status = 'WITHDRAWN') AS withdrawn_ticket_count,
              (SELECT COUNT(DISTINCT a.target_user_id)
                 FROM result_acknowledgements a
                WHERE a.batch_id = b.batch_id AND a.batch_version = b.version) AS ack_target_count,
              (SELECT COUNT(DISTINCT a.target_user_id)
                 FROM result_acknowledgements a
                WHERE a.batch_id = b.batch_id AND a.batch_version = b.version
                  AND a.acknowledged_at IS NOT NULL) AS acknowledged_count
         FROM report_batches b
         LEFT JOIN report_batches p ON p.batch_id = b.previous_batch_id
        WHERE b.batch_id = ?
        LIMIT 1`,
      batchId,
    ).toArray(),
  );
  if (!row) return null;
  const config = readSlaConfig(state);
  const sla = row.status === "PENDING" ? slaState(String(row.first_report_at || ""), config) : null;
  return { ...row, ...(sla ? { sla_state: sla.state, waiting_minutes: sla.waiting_minutes } : {}) };
}

function backfillResultEventSnapshots(state: DurableObjectState): void {
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT e.event_id, e.event_type, e.batch_id, e.payload_json, e.created_at,
            b.sku, b.product_name,
            COALESCE(
              (SELECT r.batch_version FROM realtime_events r WHERE r.event_id = e.event_id LIMIT 1),
              (SELECT MAX(a.batch_version) FROM result_acknowledgements a WHERE a.result_event_id = e.event_id),
              b.version,
              1
            ) AS batch_version
       FROM report_events e
       JOIN report_batches b ON b.batch_id = e.batch_id
       LEFT JOIN result_event_snapshots s ON s.result_event_id = e.event_id
      WHERE e.event_type IN ('BATCH_RESOLVED','BATCH_CORRECTED')
        AND s.result_event_id IS NULL
      ORDER BY e.created_at ASC, e.event_id ASC`,
  ).toArray();

  for (const row of rows) {
    const payload = parseJsonObject(row.payload_json);
    const resolution = row.event_type === "BATCH_CORRECTED"
      ? String(payload.to || "")
      : String(payload.resolution || "");
    if (!["HAS_STOCK", "SKIP_ALLOWED"].includes(resolution)) continue;
    state.storage.sql.exec(
      `INSERT OR IGNORE INTO result_event_snapshots (
         result_event_id, batch_id, batch_version, event_type, sku, product_name, resolution, result_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      String(row.event_id || ""),
      String(row.batch_id || ""),
      Number(row.batch_version || 1),
      String(row.event_type || ""),
      String(row.sku || ""),
      String(row.product_name || ""),
      resolution,
      String(row.created_at || ""),
      String(row.created_at || ""),
    );
  }
}

export function initializeOperationalV2Schema(state: DurableObjectState): void {
  if (operationalV2Readiness(state).ready) return;
  const sql = state.storage.sql;

  if (!hasColumn(state, "report_batches", "version")) {
    sql.exec("ALTER TABLE report_batches ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
  }
  if (!hasColumn(state, "report_batches", "previous_batch_id")) {
    sql.exec("ALTER TABLE report_batches ADD COLUMN previous_batch_id TEXT");
  }
  if (!hasColumn(state, "report_batches", "last_report_at")) {
    sql.exec("ALTER TABLE report_batches ADD COLUMN last_report_at TEXT");
  }
  initializeSlaAutomationSchema(state);

  sql.exec(`
    CREATE INDEX IF NOT EXISTS idx_report_batches_previous_batch ON report_batches(previous_batch_id);
    CREATE INDEX IF NOT EXISTS idx_report_batches_sku_resolved ON report_batches(sku, resolved_at);

    CREATE TABLE IF NOT EXISTS realtime_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      batch_id TEXT,
      ticket_id TEXT,
      batch_version INTEGER,
      scopes_json TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_realtime_events_batch_seq ON realtime_events(batch_id, seq);

    CREATE TABLE IF NOT EXISTS result_acknowledgements (
      result_event_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      batch_version INTEGER NOT NULL,
      target_user_id TEXT NOT NULL,
      received_at TEXT,
      displayed_at TEXT,
      acknowledged_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (result_event_id, target_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_result_ack_batch_version ON result_acknowledgements(batch_id, batch_version);
    CREATE INDEX IF NOT EXISTS idx_result_ack_target_open ON result_acknowledgements(target_user_id, acknowledged_at, created_at);

    CREATE TABLE IF NOT EXISTS result_event_snapshots (
      result_event_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      batch_version INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      resolution TEXT NOT NULL CHECK (resolution IN ('HAS_STOCK','SKIP_ALLOWED')),
      result_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_result_event_snapshots_batch_version
      ON result_event_snapshots(batch_id, batch_version);

    CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
      attempt_id TEXT PRIMARY KEY,
      event_id TEXT,
      event_type TEXT NOT NULL,
      device_id TEXT,
      user_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('SENT','FAILED')),
      error_code TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notification_delivery_event
      ON notification_delivery_attempts(event_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notification_delivery_device
      ON notification_delivery_attempts(device_id, created_at);

    DROP TRIGGER IF EXISTS trg_v2_batch_recurrence;
    CREATE TRIGGER trg_v2_batch_recurrence
      AFTER INSERT ON report_batches
      WHEN NEW.previous_batch_id IS NULL
    BEGIN
      UPDATE report_batches
         SET previous_batch_id = (
           SELECT prior.batch_id
             FROM report_batches prior
            WHERE prior.sku = NEW.sku
              AND prior.batch_id <> NEW.batch_id
              AND prior.status IN ('HAS_STOCK','SKIP_ALLOWED')
              AND prior.resolved_at IS NOT NULL
            ORDER BY prior.resolved_at DESC, prior.created_at DESC
            LIMIT 1
         )
       WHERE batch_id = NEW.batch_id;
    END;

    DROP TRIGGER IF EXISTS trg_v2_ticket_insert_version;
    CREATE TRIGGER trg_v2_ticket_insert_version
      AFTER INSERT ON report_tickets
    BEGIN
      UPDATE report_batches
         SET last_report_at = NEW.reported_at,
             version = CASE
               WHEN (SELECT COUNT(*) FROM report_tickets WHERE batch_id = NEW.batch_id) > 1
               THEN version + 1 ELSE version END,
             updated_at = NEW.reported_at
       WHERE batch_id = NEW.batch_id;
    END;

    DROP TRIGGER IF EXISTS trg_v2_ticket_withdraw_version;
    CREATE TRIGGER trg_v2_ticket_withdraw_version
      AFTER UPDATE OF status ON report_tickets
      WHEN OLD.status = 'OPEN' AND NEW.status = 'WITHDRAWN'
    BEGIN
      UPDATE report_batches
         SET version = version + 1,
             updated_at = NEW.updated_at
       WHERE batch_id = NEW.batch_id;
    END;

    DROP TRIGGER IF EXISTS trg_v2_ticket_auto_skip_version;
    CREATE TRIGGER trg_v2_ticket_auto_skip_version
      AFTER UPDATE OF auto_skip_allowed_at ON report_tickets
      WHEN OLD.auto_skip_allowed_at IS NULL AND NEW.auto_skip_allowed_at IS NOT NULL
    BEGIN
      UPDATE report_batches
         SET version = version + 1,
             updated_at = NEW.updated_at
       WHERE batch_id = NEW.batch_id;
    END;

    DROP TRIGGER IF EXISTS trg_v2_batch_resolution_version;
    CREATE TRIGGER trg_v2_batch_resolution_version
      AFTER UPDATE OF status, resolution ON report_batches
      WHEN OLD.status <> NEW.status
        AND NEW.status IN ('HAS_STOCK','SKIP_ALLOWED')
    BEGIN
      UPDATE report_batches
         SET version = version + 1
       WHERE batch_id = NEW.batch_id;
    END;

    DROP TRIGGER IF EXISTS trg_v2_report_event_stream;
    CREATE TRIGGER trg_v2_report_event_stream
      AFTER INSERT ON report_events
    BEGIN
      INSERT OR IGNORE INTO realtime_events (
        event_id, event_type, batch_id, ticket_id, batch_version, scopes_json, payload_json, created_at
      ) VALUES (
        NEW.event_id,
        NEW.event_type,
        NEW.batch_id,
        NEW.ticket_id,
        (SELECT version FROM report_batches WHERE batch_id = NEW.batch_id),
        CASE NEW.event_type
          WHEN 'REPORT_CREATED' THEN '["reporter_queue","picker_reports"]'
          WHEN 'REPORT_WITHDRAWN' THEN '["reporter_queue","reporter_recent","picker_reports"]'
          WHEN 'BATCH_RESOLVED' THEN '["reporter_queue","reporter_recent","picker_reports"]'
          WHEN 'BATCH_CORRECTED' THEN '["reporter_recent","picker_reports"]'
          WHEN 'SLA_WARNING' THEN '["reporter_queue"]'
          WHEN 'SLA_ESCALATED' THEN '["reporter_queue","picker_reports"]'
          WHEN 'TICKET_AUTO_SKIP_ALLOWED' THEN '["reporter_queue","reporter_recent","picker_reports"]'
          WHEN 'BATCH_AUTO_SKIP_ALLOWED' THEN '["reporter_queue","reporter_recent","picker_reports"]'
          WHEN 'RESULT_ACKNOWLEDGED' THEN '["reporter_recent","picker_reports"]'
          ELSE '["operations"]'
        END,
        NEW.payload_json,
        NEW.created_at
      );
    END;

    DROP TRIGGER IF EXISTS trg_v2_result_ack_targets;
    CREATE TRIGGER trg_v2_result_ack_targets
      AFTER INSERT ON report_events
      WHEN NEW.event_type IN ('BATCH_RESOLVED','BATCH_CORRECTED','BATCH_AUTO_SKIP_ALLOWED')
        AND NEW.batch_id IS NOT NULL
    BEGIN
      INSERT OR IGNORE INTO result_acknowledgements (
        result_event_id, batch_id, batch_version, target_user_id,
        received_at, displayed_at, acknowledged_at, created_at, updated_at
      )
      SELECT NEW.event_id,
             NEW.batch_id,
             COALESCE((SELECT version FROM report_batches WHERE batch_id = NEW.batch_id), 1),
             t.picker_user_id,
             NULL, NULL, NULL,
             NEW.created_at,
             NEW.created_at
        FROM report_tickets t
       WHERE t.batch_id = NEW.batch_id
         AND t.status = 'RESOLVED'
         AND t.picker_user_id IS NOT NULL
         AND t.picker_user_id <> ''
         AND (
           NEW.event_type = 'BATCH_CORRECTED'
           OR (NEW.event_type = 'BATCH_AUTO_SKIP_ALLOWED' AND t.resolution_source = 'SYSTEM_TIMEOUT')
           OR (NEW.event_type = 'BATCH_RESOLVED' AND t.resolution_source = 'REPORTER')
         )
       GROUP BY t.picker_user_id;
    END;

    DROP TRIGGER IF EXISTS trg_v2_ticket_auto_skip_ack_target;
    CREATE TRIGGER trg_v2_ticket_auto_skip_ack_target
      AFTER INSERT ON report_events
      WHEN NEW.event_type = 'TICKET_AUTO_SKIP_ALLOWED'
        AND NEW.ticket_id IS NOT NULL
        AND NEW.batch_id IS NOT NULL
    BEGIN
      INSERT OR IGNORE INTO result_acknowledgements (
        result_event_id, batch_id, batch_version, target_user_id,
        received_at, displayed_at, acknowledged_at, created_at, updated_at
      )
      SELECT NEW.event_id,
             NEW.batch_id,
             COALESCE((SELECT version FROM report_batches WHERE batch_id = NEW.batch_id), 1),
             t.picker_user_id,
             NULL, NULL, NULL,
             NEW.created_at,
             NEW.created_at
        FROM report_tickets t
       WHERE t.ticket_id = NEW.ticket_id
         AND t.batch_id = NEW.batch_id
         AND t.picker_user_id IS NOT NULL
         AND t.picker_user_id <> '';
    END;
  `);

  backfillResultEventSnapshots(state);
  ensureRealtimeStreamEpoch(state);

  sql.exec(
    `INSERT INTO schema_meta (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    OPERATIONAL_SCHEMA_KEY,
    String(OPERATIONAL_V2_SCHEMA_VERSION),
  );
}

function reporterQueue(state: DurableObjectState, url: URL): Response {
  const parsed = Number(url.searchParams.get("limit") || 100);
  const parsedOffset = Number(url.searchParams.get("offset") || 0);
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
  const offset = Math.max(0, Number.isFinite(parsedOffset) ? Math.trunc(parsedOffset) : 0);
  const config = readSlaConfig(state);
  const serverNowMs = Date.now();
  const serverNow = new Date(serverNowMs).toISOString();
  const totalRow = first(
    state.storage.sql.exec<SqlRow>(
      `SELECT COUNT(*) AS total
         FROM report_batches b
        WHERE b.status = 'PENDING'
          AND EXISTS (
            SELECT 1
              FROM report_tickets t
             WHERE t.batch_id = b.batch_id
               AND t.status = 'OPEN'
               AND t.auto_skip_allowed_at IS NULL
          )`,
    ).toArray(),
  );
  const total = Number(totalRow?.total || 0);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.last_report_at,
            b.version, b.previous_batch_id, b.auto_skip_deadline_at AS batch_auto_skip_at,
            p.resolved_at AS previous_resolved_at,
            COUNT(t.ticket_id) AS affected_picker_count,
            MIN(t.reported_at) AS earliest_ticket_at,
            MIN(t.auto_skip_deadline_at) AS next_picker_auto_skip_at
       FROM report_batches b
       JOIN report_tickets t
         ON t.batch_id = b.batch_id
        AND t.status = 'OPEN'
        AND t.auto_skip_allowed_at IS NULL
       LEFT JOIN report_batches p ON p.batch_id = b.previous_batch_id
      WHERE b.status = 'PENDING'
      GROUP BY b.batch_id
      ORDER BY affected_picker_count DESC, b.first_report_at ASC
      LIMIT ? OFFSET ?`,
    limit,
    offset,
  ).toArray().map((row) => {
    const firstReportAt = String(row.first_report_at || "");
    const sla = slaState(firstReportAt, config, serverNowMs);
    const deadlines = slaDeadlines(firstReportAt, config);
    const previousResolvedAt = String(row.previous_resolved_at || "");
    const recurrenceMinutes = previousResolvedAt && row.first_report_at
      ? Math.max(0, Math.round((Date.parse(String(row.first_report_at)) - Date.parse(previousResolvedAt)) / 60_000))
      : null;
    return {
      ...row,
      sla_state: sla.state,
      waiting_minutes: sla.waiting_minutes,
      warning_at: deadlines.warning_at,
      escalation_at: deadlines.escalation_at,
      auto_skip_enabled: Boolean(config?.auto_skip_enabled),
      auto_skip_mode: config?.auto_skip_mode || null,
      auto_skip_at: config?.auto_skip_enabled
        ? (config.auto_skip_mode === "FIRST_REPORT" ? (row.batch_auto_skip_at || null) : (row.next_picker_auto_skip_at || null))
        : null,
      recurrence_minutes: Number.isFinite(recurrenceMinutes as number) ? recurrenceMinutes : null,
    };
  });
  return json({ items: rows, count: rows.length, total, limit, offset, server_now: serverNow, sla_configured: Boolean(config), sla: config });
}

function reporterRecent(state: DurableObjectState, url: URL): Response {
  const parsed = Number(url.searchParams.get("limit") || 100);
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
  const appTodayOpen = String(url.searchParams.get("scope") || "").toUpperCase() === APP_TODAY_OPEN_SCOPE;
  const todayStart = appTodayOpen ? appTodayStartIso() : "";
  const dayFilter = appTodayOpen ? " AND b.first_report_at >= ?" : "";
  const rowArgs: SqlStorageValue[] = appTodayOpen ? [todayStart, limit] : [limit];
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.last_report_at,
            b.resolved_at, b.resolved_by_user_id, b.resolution, b.resolution_source, b.correction_deadline_at,
            COALESCE(resolver.display_name, '') AS resolved_by_display_name,
            COALESCE(
              NULLIF(resolver.employee_code, ''),
              (SELECT e.actor_employee_code
                 FROM report_events e
                WHERE e.batch_id = b.batch_id
                  AND e.event_type IN ('BATCH_RESOLVED','BATCH_CORRECTED')
                  AND e.actor_employee_code IS NOT NULL
                ORDER BY e.created_at DESC
                LIMIT 1),
              ''
            ) AS resolved_by_employee_code,
            b.version, b.previous_batch_id, p.resolved_at AS previous_resolved_at,
            CASE
              WHEN b.status = 'CLOSED' THEN
                (SELECT COUNT(DISTINCT COALESCE(t.picker_user_id, t.picker_employee_code))
                   FROM report_tickets t
                  WHERE t.batch_id = b.batch_id AND t.status = 'WITHDRAWN')
              ELSE
                (SELECT COUNT(DISTINCT COALESCE(t.picker_user_id, t.picker_employee_code))
                   FROM report_tickets t
                  WHERE t.batch_id = b.batch_id AND t.status = 'RESOLVED')
            END AS affected_picker_count,
            (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id = b.batch_id) AS total_ticket_count,
            (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id = b.batch_id AND t.status = 'WITHDRAWN') AS withdrawn_ticket_count,
            (SELECT COUNT(DISTINCT a.target_user_id)
               FROM result_acknowledgements a
              WHERE a.batch_id = b.batch_id AND a.batch_version = b.version) AS ack_target_count,
            (SELECT COUNT(DISTINCT a.target_user_id)
               FROM result_acknowledgements a
              WHERE a.batch_id = b.batch_id AND a.batch_version = b.version
                AND a.acknowledged_at IS NOT NULL) AS acknowledged_count
       FROM report_batches b
       LEFT JOIN report_batches p ON p.batch_id = b.previous_batch_id
       LEFT JOIN users resolver ON resolver.user_id = b.resolved_by_user_id
      WHERE b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')${dayFilter}
      ORDER BY COALESCE(b.resolved_at, b.updated_at) DESC
      LIMIT ?`,
    ...rowArgs,
  ).toArray();
  const totalsArgs: SqlStorageValue[] = appTodayOpen ? [todayStart] : [];
  const totalsRow = first(
    state.storage.sql.exec<SqlRow>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'HAS_STOCK' THEN 1 ELSE 0 END), 0) AS has_stock,
         COALESCE(SUM(CASE WHEN status = 'SKIP_ALLOWED' THEN 1 ELSE 0 END), 0) AS skip_allowed,
         COALESCE(SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END), 0) AS withdrawn
       FROM report_batches b
      WHERE status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')${dayFilter}`,
      ...totalsArgs,
    ).toArray(),
  ) || {};
  return json({
    items: rows,
    count: rows.length,
    totals: {
      has_stock: Number(totalsRow.has_stock || 0),
      skip_allowed: Number(totalsRow.skip_allowed || 0),
      withdrawn: Number(totalsRow.withdrawn || 0),
    },
    scope: appTodayOpen ? APP_TODAY_OPEN_SCOPE : "ALL",
    today_start: appTodayOpen ? todayStart : null,
  });
}

function reporterBatchTickets(state: DurableObjectState, url: URL): Response {
  const batchId = String(url.searchParams.get("batch_id") || "").trim();
  if (!batchId) return json({ error: "BATCH_ID_REQUIRED" }, 400);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT t.ticket_id, t.picker_user_id, t.picker_employee_code,
            COALESCE(u.display_name, '') AS picker_display_name,
            t.status, t.reported_at, t.withdraw_deadline_at, t.withdrawn_at, t.resolved_at,
            t.auto_skip_deadline_at, t.auto_skip_allowed_at, t.resolution, t.resolution_source,
            (
              SELECT a.result_event_id
                FROM result_acknowledgements a
               WHERE a.batch_id = b.batch_id
                 AND a.target_user_id = t.picker_user_id
               ORDER BY a.created_at DESC
               LIMIT 1
            ) AS result_event_id,
            (
              SELECT a.acknowledged_at
                FROM result_acknowledgements a
               WHERE a.batch_id = b.batch_id
                 AND a.target_user_id = t.picker_user_id
               ORDER BY a.created_at DESC
               LIMIT 1
            ) AS acknowledged_at
       FROM report_tickets t
       JOIN report_batches b ON b.batch_id = t.batch_id
       LEFT JOIN users u ON u.employee_code = t.picker_employee_code
      WHERE t.batch_id = ?
      ORDER BY t.reported_at ASC`,
    batchId,
  ).toArray();
  return json({ batch_id: batchId, items: rows, count: rows.length });
}

function pickerReports(state: DurableObjectState, url: URL): Response {
  const userId = String(url.searchParams.get("user_id") || "").trim();
  const employeeCode = String(url.searchParams.get("employee_code") || "").trim();
  const parsed = Number(url.searchParams.get("limit") || 100);
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
  const appTodayOpen = String(url.searchParams.get("scope") || "").toUpperCase() === APP_TODAY_OPEN_SCOPE;
  const todayStart = appTodayOpen ? appTodayStartIso() : "";
  const scopeFilter = appTodayOpen
    ? " AND (t.reported_at >= ? OR (t.status = 'OPEN' AND t.auto_skip_allowed_at IS NULL AND b.status = 'PENDING'))"
    : "";
  if (!userId || !employeeCode) return json({ error: "INVALID_INPUT" }, 400);
  const args: SqlStorageValue[] = [userId, userId, userId, userId, userId, employeeCode];
  if (appTodayOpen) args.push(todayStart);
  args.push(limit);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT t.ticket_id, t.batch_id, t.sku, b.product_name, t.status,
            t.reported_at, t.withdraw_deadline_at, t.withdrawn_at, t.resolved_at,
            t.auto_skip_deadline_at, t.auto_skip_allowed_at,
            b.status AS batch_status,
            COALESCE(t.resolution, b.resolution) AS resolution,
            COALESCE(t.resolution_source, b.resolution_source) AS resolution_source,
            b.correction_deadline_at,
            b.version AS batch_version, b.previous_batch_id,
            (
              SELECT a.result_event_id
                FROM result_acknowledgements a
               WHERE a.batch_id = b.batch_id AND a.target_user_id = ?
               ORDER BY a.created_at DESC
               LIMIT 1
            ) AS result_event_id,
            (
              SELECT a.received_at
                FROM result_acknowledgements a
               WHERE a.batch_id = b.batch_id AND a.target_user_id = ?
               ORDER BY a.created_at DESC
               LIMIT 1
            ) AS received_at,
            (
              SELECT a.displayed_at
                FROM result_acknowledgements a
               WHERE a.batch_id = b.batch_id AND a.target_user_id = ?
               ORDER BY a.created_at DESC
               LIMIT 1
            ) AS displayed_at,
            (
              SELECT a.acknowledged_at
                FROM result_acknowledgements a
               WHERE a.batch_id = b.batch_id AND a.target_user_id = ?
               ORDER BY a.created_at DESC
               LIMIT 1
            ) AS acknowledged_at
       FROM report_tickets t
       JOIN report_batches b ON b.batch_id = t.batch_id
      WHERE (t.picker_user_id = ? OR t.picker_employee_code = ?)${scopeFilter}
      ORDER BY t.reported_at DESC
      LIMIT ?`,
    ...args,
  ).toArray();
  return json({
    items: rows,
    count: rows.length,
    scope: appTodayOpen ? APP_TODAY_OPEN_SCOPE : "ALL",
    today_start: appTodayOpen ? todayStart : null,
  });
}

function pendingResults(state: DurableObjectState, url: URL): Response {
  const userId = String(url.searchParams.get("user_id") || "").trim();
  const parsed = Number(url.searchParams.get("limit") || 20);
  const limit = Math.max(1, Math.min(100, Number.isFinite(parsed) ? Math.trunc(parsed) : 20));
  if (!userId) return json({ error: "USER_ID_REQUIRED" }, 400);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT a.result_event_id, a.batch_id, a.batch_version, a.received_at, a.displayed_at, a.acknowledged_at,
            a.created_at,
            s.sku, s.product_name, s.resolution AS status, s.resolution, s.result_at AS resolved_at,
            b.status AS current_batch_status, b.resolution AS current_resolution, b.version AS current_batch_version
       FROM result_acknowledgements a
       JOIN result_event_snapshots s ON s.result_event_id = a.result_event_id
       JOIN report_batches b ON b.batch_id = a.batch_id
      WHERE a.target_user_id = ? AND a.acknowledged_at IS NULL
      ORDER BY a.created_at ASC, a.result_event_id ASC
      LIMIT ?`,
    userId,
    limit,
  ).toArray();
  return json({ items: rows, count: rows.length });
}

async function updateResultStage(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    actor?: Actor;
    result_event_id?: string;
    stage?: string;
  };
  const actor = body.actor;
  const resultEventId = String(body.result_event_id || "").trim();
  const stage = String(body.stage || "").trim().toUpperCase();
  if (!actor?.user_id || !resultEventId || !["RECEIVED", "DISPLAYED", "ACKNOWLEDGED"].includes(stage)) {
    return json({ error: "INVALID_INPUT" }, 400);
  }

  const outcome = state.storage.transactionSync(() => {
    const row = first(state.storage.sql.exec<SqlRow>(
      `SELECT result_event_id, batch_id, batch_version, target_user_id,
              received_at, displayed_at, acknowledged_at, created_at
         FROM result_acknowledgements
        WHERE result_event_id = ? AND target_user_id = ?
        LIMIT 1`,
      resultEventId,
      actor.user_id,
    ).toArray());
    if (!row) return { status: 404, payload: { error: "RESULT_ACK_NOT_FOUND" } };

    const at = new Date().toISOString();
    if (stage === "RECEIVED") {
      state.storage.sql.exec(
        `UPDATE result_acknowledgements
            SET received_at = COALESCE(received_at, ?), updated_at = ?
          WHERE result_event_id = ? AND target_user_id = ?`,
        at, at, resultEventId, actor.user_id,
      );
    } else if (stage === "DISPLAYED") {
      state.storage.sql.exec(
        `UPDATE result_acknowledgements
            SET received_at = COALESCE(received_at, ?),
                displayed_at = COALESCE(displayed_at, ?),
                updated_at = ?
          WHERE result_event_id = ? AND target_user_id = ?`,
        at, at, at, resultEventId, actor.user_id,
      );
    } else {
      state.storage.sql.exec(
        `UPDATE result_acknowledgements
            SET received_at = COALESCE(received_at, ?),
                displayed_at = COALESCE(displayed_at, ?),
                acknowledged_at = COALESCE(acknowledged_at, ?),
                updated_at = ?
          WHERE result_event_id = ? AND target_user_id = ?`,
        at, at, at, at, resultEventId, actor.user_id,
      );
    }

    let ackEventId: string | null = null;
    if (stage === "ACKNOWLEDGED" && !row.acknowledged_at) {
      const counts = first(state.storage.sql.exec<SqlRow>(
        `SELECT COUNT(*) AS target_count,
                SUM(CASE WHEN acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) AS acknowledged_count
           FROM result_acknowledgements
          WHERE batch_id = ? AND batch_version = ?`,
        row.batch_id,
        row.batch_version,
      ).toArray()) || {};
      ackEventId = crypto.randomUUID();
      state.storage.sql.exec(
        `INSERT INTO report_events (
           event_id, batch_id, ticket_id, event_type, actor_user_id, actor_employee_code, payload_json, created_at
         ) VALUES (?, ?, NULL, 'RESULT_ACKNOWLEDGED', ?, ?, ?, ?)`,
        ackEventId,
        row.batch_id,
        actor.user_id,
        actor.employee_code,
        JSON.stringify({
          result_event_id: resultEventId,
          batch_version: Number(row.batch_version || 1),
          acknowledged_count: Number(counts.acknowledged_count || 0),
          target_count: Number(counts.target_count || 0),
        }),
        at,
      );
      state.storage.sql.exec(
        `INSERT INTO audit_log (
           audit_id, actor_user_id, actor_employee_code, actor_role, actor_display_name,
           action, target_type, target_id, metadata_json, created_at
         ) VALUES (?, ?, ?, ?, ?, 'RESULT_ACKNOWLEDGE', 'RESULT_EVENT', ?, ?, ?)`,
        crypto.randomUUID(),
        actor.user_id,
        actor.employee_code,
        actor.role || null,
        actor.display_name || null,
        resultEventId,
        JSON.stringify({ batch_id: row.batch_id, batch_version: Number(row.batch_version || 1) }),
        at,
      );
    }

    const updated = first(state.storage.sql.exec<SqlRow>(
      `SELECT result_event_id, batch_id, batch_version, target_user_id,
              received_at, displayed_at, acknowledged_at, created_at, updated_at
         FROM result_acknowledgements
        WHERE result_event_id = ? AND target_user_id = ?`,
      resultEventId,
      actor.user_id,
    ).toArray()) || {};
    return { status: 200, payload: { status: stage.toLowerCase(), acknowledgement: updated, event_id: ackEventId } };
  });

  return json(outcome.payload, outcome.status);
}

function getSla(state: DurableObjectState): Response {
  const config = readSlaConfig(state);
  return json({ configured: Boolean(config), sla: config });
}

async function putSla(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    warning_minutes?: unknown;
    escalation_minutes?: unknown;
    auto_skip_minutes?: unknown;
    auto_skip_enabled?: unknown;
    auto_skip_mode?: unknown;
    actor?: Actor;
  };
  const actor = body.actor;
  const validated = validateOperationalSlaConfig(body);
  if (!actor?.user_id || !validated.ok) {
    return json({
      error: "INVALID_SLA_CONFIG",
      rules: {
        warning_minutes: "1..1440",
        escalation_minutes: "> warning and <= 2880",
        auto_skip_minutes: "> escalation and <= 10080",
        auto_skip_enabled: "boolean",
        auto_skip_mode: "FIRST_REPORT|PER_PICKER",
      },
    }, 400);
  }

  const previous = readSlaConfig(state);
  const at = new Date().toISOString();
  const value: OperationalSlaConfig = {
    ...validated.value,
    policy_version: 2,
    effective_at: Number(previous?.policy_version || 0) >= 2 && previous?.effective_at ? previous.effective_at : at,
  };
  state.storage.transactionSync(() => {
    state.storage.sql.exec(
      `INSERT INTO app_config (key, value_json, updated_at, updated_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
      SLA_CONFIG_KEY,
      JSON.stringify(value),
      at,
      actor.user_id,
    );

    // Fail-safe policy change: disabling auto-skip or changing timing mode cancels
    // all not-yet-fired automatic deadlines. Re-enabling never retroactively
    // schedules old batches/tickets; only new reports get deadlines.
    if (!value.auto_skip_enabled || (previous?.auto_skip_mode && previous.auto_skip_mode !== value.auto_skip_mode)) {
      state.storage.sql.exec(
        "UPDATE report_batches SET auto_skip_deadline_at = NULL WHERE status = 'PENDING' AND auto_skip_deadline_at IS NOT NULL",
      );
      state.storage.sql.exec(
        `UPDATE report_tickets
            SET auto_skip_deadline_at = NULL
          WHERE status = 'OPEN'
            AND auto_skip_allowed_at IS NULL
            AND auto_skip_deadline_at IS NOT NULL`,
      );
    }

    state.storage.sql.exec(
      `INSERT INTO audit_log (
         audit_id, actor_user_id, actor_employee_code, actor_role, actor_display_name,
         action, target_type, target_id, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, ?, 'SLA_CONFIG_UPDATE', 'APP_CONFIG', ?, ?, ?)`,
      crypto.randomUUID(),
      actor.user_id,
      actor.employee_code,
      actor.role || null,
      actor.display_name || null,
      SLA_CONFIG_KEY,
      JSON.stringify({ ...value, previous_auto_skip_enabled: previous?.auto_skip_enabled ?? false, previous_auto_skip_mode: previous?.auto_skip_mode ?? null }),
      at,
    );
  });

  await scheduleNextOperationalAlarm(state);
  return json({ status: "saved", configured: true, sla: { ...value, updated_at: at, updated_by: actor.user_id } });
}

export function pickerCanReceiveRealtimeEvent(
  state: DurableObjectState,
  eventId: string,
  ticketId: string | null,
  userId: string,
): boolean {
  if (!eventId || !userId) return false;
  const row = first(state.storage.sql.exec<SqlRow>(
    `SELECT 1 AS allowed
       WHERE (
         (? IS NOT NULL AND EXISTS (
           SELECT 1 FROM report_tickets t
            WHERE t.ticket_id = ? AND t.picker_user_id = ?
         ))
         OR EXISTS (
           SELECT 1 FROM result_acknowledgements a
            WHERE a.result_event_id = ? AND a.target_user_id = ?
         )
         OR EXISTS (
           SELECT 1
             FROM report_events e
             JOIN report_tickets t ON t.batch_id = e.batch_id
            WHERE e.event_id = ?
              AND e.event_type = 'SLA_ESCALATED'
              AND t.picker_user_id = ?
              AND t.status = 'OPEN'
              AND t.auto_skip_allowed_at IS NULL
         )
         OR EXISTS (
           SELECT 1 FROM report_events e
            WHERE e.event_id = ? AND e.actor_user_id = ?
         )
       )
       LIMIT 1`,
    ticketId,
    ticketId,
    userId,
    eventId,
    userId,
    eventId,
    userId,
    eventId,
    userId,
  ).toArray());
  return Boolean(row);
}

export function pickerRealtimeSnapshot(
  state: DurableObjectState,
  batchId: string,
  eventId: string,
  ticketId: string | null,
  userId: string,
): Record<string, unknown> | null {
  if (!batchId || !userId) return null;
  const batch = first(state.storage.sql.exec<SqlRow>(
    `SELECT batch_id, sku, product_name, status AS batch_status,
            resolution AS current_resolution, resolved_at AS current_resolved_at,
            version AS current_batch_version, previous_batch_id
       FROM report_batches
      WHERE batch_id = ?
      LIMIT 1`,
    batchId,
  ).toArray());
  if (!batch) return null;

  const ticket = first(state.storage.sql.exec<SqlRow>(
    `SELECT ticket_id, status AS ticket_status, reported_at, withdraw_deadline_at, withdrawn_at, resolved_at,
             auto_skip_deadline_at, auto_skip_allowed_at, resolution, resolution_source
       FROM report_tickets
      WHERE batch_id = ? AND picker_user_id = ?
        AND (? IS NULL OR ticket_id = ?)
      ORDER BY reported_at DESC
      LIMIT 1`,
    batchId,
    userId,
    ticketId,
    ticketId,
  ).toArray());

  const result = first(state.storage.sql.exec<SqlRow>(
    `SELECT s.result_event_id, s.batch_version, s.event_type, s.resolution, s.result_at,
            a.received_at, a.displayed_at, a.acknowledged_at
       FROM result_event_snapshots s
       JOIN result_acknowledgements a
         ON a.result_event_id = s.result_event_id
        AND a.target_user_id = ?
      WHERE s.result_event_id = ?
      LIMIT 1`,
    userId,
    eventId,
  ).toArray());

  return {
    ...batch,
    ticket: ticket ? { ...ticket } : null,
    result_event: result ? { ...result } : null,
  };
}

function pickerRealtimeMetadata(
  state: DurableObjectState,
  eventId: string,
  eventType: string,
  payloadValue: unknown,
  userId: string,
): Record<string, unknown> {
  const payload = parseJsonObject(payloadValue);
  if (["BATCH_RESOLVED", "BATCH_CORRECTED", "BATCH_AUTO_SKIP_ALLOWED", "TICKET_AUTO_SKIP_ALLOWED"].includes(eventType)) {
    const result = first(state.storage.sql.exec<SqlRow>(
      `SELECT resolution, result_at, batch_version
         FROM result_event_snapshots
        WHERE result_event_id = ?
        LIMIT 1`,
      eventId,
    ).toArray());
    return result
      ? {
          resolution: String(result.resolution || ""),
          result_at: String(result.result_at || ""),
          batch_version: Number(result.batch_version || 0),
        }
      : {};
  }
  if (eventType === "RESULT_ACKNOWLEDGED") {
    return {
      result_event_id: String(payload.result_event_id || ""),
      batch_version: Number(payload.batch_version || 0),
      acknowledged_by_current_user: true,
    };
  }
  if (eventType === "REPORT_CREATED" || eventType === "REPORT_WITHDRAWN") {
    return { sku: String(payload.sku || "") };
  }
  const actorOwnsEvent = Boolean(first(state.storage.sql.exec<SqlRow>(
    "SELECT 1 AS owned FROM report_events WHERE event_id = ? AND actor_user_id = ? LIMIT 1",
    eventId,
    userId,
  ).toArray()));
  return actorOwnsEvent ? {} : {};
}

function delta(state: DurableObjectState, url: URL): Response {
  const afterSeqRaw = Number(url.searchParams.get("after_seq") || 0);
  const afterSeq = Math.max(0, Number.isFinite(afterSeqRaw) ? Math.trunc(afterSeqRaw) : 0);
  const limitRaw = Number(url.searchParams.get("limit") || 100);
  const limit = Math.max(1, Math.min(MAX_DELTA_LIMIT, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 100));
  const role = String(url.searchParams.get("role") || "") as RealtimeRole;
  const userId = String(url.searchParams.get("user_id") || "").trim();
  const clientEpoch = String(url.searchParams.get("stream_epoch") || "").trim();
  if (!["PICKER", "REPORTER", "ADMIN", "ROOT"].includes(role) || !userId) {
    return json({ error: "INVALID_REALTIME_IDENTITY" }, 400);
  }

  const stream = realtimeStreamMetadata(state);
  const epochMismatch = Boolean(clientEpoch && clientEpoch !== stream.stream_epoch);
  const cursorAhead = afterSeq > stream.latest_seq;
  const retentionGap = stream.retained_from_seq > 0 && afterSeq < stream.retained_from_seq - 1;
  if (epochMismatch || cursorAhead || retentionGap) {
    return json({
      after_seq: afterSeq,
      events: [],
      count: 0,
      latest_seq: stream.latest_seq,
      cursor_seq: stream.latest_seq,
      retained_from_seq: stream.retained_from_seq,
      stream_epoch: stream.stream_epoch,
      has_more: false,
      resync_required: true,
      resync_reason: epochMismatch
        ? "STREAM_EPOCH_CHANGED"
        : (cursorAhead ? "CURSOR_AHEAD_OF_STREAM" : "CURSOR_BEFORE_RETENTION"),
      complete: false,
      limit,
      scanned_count: 0,
    });
  }

  // Scan a bounded global window, then project only events authorized for this principal.
  // cursor_seq therefore advances across other users' global sequence numbers without
  // pretending that an authorized Picker stream must be numerically contiguous.
  const scanned = state.storage.sql.exec<SqlRow>(
    `SELECT e.seq, e.event_id, e.event_type, e.batch_id, e.ticket_id,
            e.batch_version, e.scopes_json, e.payload_json, e.created_at
       FROM realtime_events e
      WHERE e.seq > ?
      ORDER BY e.seq ASC
      LIMIT ?`,
    afterSeq,
    limit,
  ).toArray();

  const selected = role === "PICKER"
    ? scanned.filter((row) => pickerCanReceiveRealtimeEvent(
        state,
        String(row.event_id || ""),
        row.ticket_id == null ? null : String(row.ticket_id),
        userId,
      ))
    : scanned;

  const events = selected.map((row) => {
    const eventId = String(row.event_id || "");
    const eventType = String(row.event_type || "");
    const batchId = String(row.batch_id || "");
    const ticketId = row.ticket_id == null ? null : String(row.ticket_id);
    const snapshot = role === "PICKER"
      ? pickerRealtimeSnapshot(state, batchId, eventId, ticketId, userId)
      : (batchId ? currentBatchSnapshot(state, batchId) : null);
    return {
      seq: Number(row.seq || 0),
      event_id: eventId,
      event: eventType,
      batch_id: batchId || null,
      ticket_id: ticketId,
      batch_version: Number(row.batch_version || 0),
      scopes: role === "PICKER"
        ? parseJsonArray(row.scopes_json).filter((scope) => scope === "picker_reports")
        : parseJsonArray(row.scopes_json),
      metadata: role === "PICKER"
        ? pickerRealtimeMetadata(state, eventId, eventType, row.payload_json, userId)
        : parseJsonObject(row.payload_json),
      snapshot,
      server_time: String(row.created_at || ""),
    };
  });

  const cursorSeq = scanned.length
    ? Number(scanned[scanned.length - 1]?.seq || afterSeq)
    : Math.min(afterSeq, stream.latest_seq);
  const hasMore = cursorSeq < stream.latest_seq;
  return json({
    after_seq: afterSeq,
    events,
    count: events.length,
    latest_seq: stream.latest_seq,
    cursor_seq: cursorSeq,
    retained_from_seq: stream.retained_from_seq,
    stream_epoch: stream.stream_epoch,
    has_more: hasMore,
    resync_required: false,
    resync_reason: null,
    // Compatibility marker for older clients. New clients use has_more/resync_required.
    complete: !hasMore,
    limit,
    scanned_count: scanned.length,
  });
}

function realtimeEventById(state: DurableObjectState, url: URL): Response {
  const eventId = String(url.searchParams.get("event_id") || "").trim();
  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);
  const row = first(state.storage.sql.exec<SqlRow>(
    `SELECT seq, event_id, event_type, batch_id, ticket_id, batch_version, scopes_json, payload_json, created_at
       FROM realtime_events WHERE event_id = ? LIMIT 1`,
    eventId,
  ).toArray());
  if (!row) return json({ error: "EVENT_NOT_FOUND" }, 404);
  const batchId = String(row.batch_id || "");
  const snapshot = batchId ? currentBatchSnapshot(state, batchId) : null;
  return json({
    event: {
      seq: Number(row.seq || 0),
      event_id: String(row.event_id || ""),
      event: String(row.event_type || ""),
      batch_id: batchId || null,
      batch_version: Number(row.batch_version || 0),
      scopes: parseJsonArray(row.scopes_json),
      metadata: parseJsonObject(row.payload_json),
      snapshot,
      server_time: String(row.created_at || ""),
    },
  });
}

function adminInsights(state: DurableObjectState, url: URL): Response {
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!from || !to || !Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return json({ error: "INVALID_REPORTING_RANGE" }, 400);
  }
  if (toMs - fromMs > 60 * 86_400_000) {
    return json({ error: "REPORTING_RANGE_TOO_LARGE", max_range_days: 60 }, 400);
  }

  const config = readSlaConfig(state);
  let warning = 0;
  let escalated = 0;
  if (config) {
    const now = Date.now();
    const warningCutoff = new Date(now - config.warning_minutes * 60_000).toISOString();
    const escalationCutoff = new Date(now - config.escalation_minutes * 60_000).toISOString();
    const slaCounts = first(
      state.storage.sql.exec<SqlRow>(
        `SELECT
           COALESCE(SUM(CASE WHEN first_report_at <= ? THEN 1 ELSE 0 END),0) AS escalated_count,
           COALESCE(SUM(CASE WHEN first_report_at <= ? AND first_report_at > ? THEN 1 ELSE 0 END),0) AS warning_count
         FROM report_batches
        WHERE status = 'PENDING'`,
        escalationCutoff,
        warningCutoff,
        escalationCutoff,
      ).toArray(),
    ) || {};
    warning = Number(slaCounts.warning_count || 0);
    escalated = Number(slaCounts.escalated_count || 0);
  }

  const recurrence = state.storage.sql.exec<SqlRow>(
    `SELECT b.sku, b.product_name, COUNT(*) AS recurrence_count,
            MAX(b.first_report_at) AS latest_first_report_at
       FROM report_batches b
      WHERE b.previous_batch_id IS NOT NULL
        AND b.first_report_at >= ? AND b.first_report_at < ?
      GROUP BY b.sku, b.product_name
      ORDER BY recurrence_count DESC, latest_first_report_at DESC
      LIMIT 10`,
    from,
    to,
  ).toArray();
  return json({
    period: { from, to, max_range_days: 60 },
    server_now: new Date().toISOString(),
    sla: { configured: Boolean(config), config, warning_count: warning, escalated_count: escalated },
    recurrence: { top_skus: recurrence },
  });
}

export async function handleOperationalV2CoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/operational/init") {
    initializeOperationalV2Schema(state);
    const readiness = operationalV2Readiness(state);
    return json({
      status: readiness.ready ? "ready" : "not_ready",
      ...readiness,
    }, readiness.ready ? 200 : 503);
  }

  if (request.method === "GET" && url.pathname === "/operational/reporter/queue") return reporterQueue(state, url);
  if (request.method === "GET" && url.pathname === "/operational/reporter/recent") return reporterRecent(state, url);
  if (request.method === "GET" && url.pathname === "/operational/reporter/batch-tickets") return reporterBatchTickets(state, url);
  if (request.method === "GET" && url.pathname === "/operational/picker/reports") return pickerReports(state, url);
  if (request.method === "GET" && url.pathname === "/operational/picker/results") return pendingResults(state, url);
  if (request.method === "POST" && url.pathname === "/operational/picker/result-stage") return updateResultStage(state, request);
  if (request.method === "GET" && url.pathname === "/operational/sla") return getSla(state);
  if (request.method === "PUT" && url.pathname === "/operational/sla") return putSla(state, request);
  if (request.method === "GET" && url.pathname === "/operational/realtime/delta") return delta(state, url);
  if (request.method === "GET" && url.pathname === "/operational/realtime/event") return realtimeEventById(state, url);
  if (request.method === "GET" && url.pathname === "/operational/admin/insights") return adminInsights(state, url);

  return null;
}
