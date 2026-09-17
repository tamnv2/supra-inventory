type SqlRow = Record<string, SqlStorageValue>;

type Actor = {
  user_id: string;
  employee_code: string | null;
};

type SlaConfig = {
  warning_minutes: number;
  escalation_minutes: number;
  updated_at?: string;
  updated_by?: string | null;
};

type RealtimeRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";

const SLA_CONFIG_KEY = "operational_sla_v1";
const OPERATIONAL_SCHEMA_KEY = "operational_v2_schema_version";
export const OPERATIONAL_V2_SCHEMA_VERSION = 1;
const MAX_DELTA_LIMIT = 200;

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
    hasSqlObject(state, "trigger", "trg_v2_report_event_stream") &&
    hasSqlObject(state, "trigger", "trg_v2_result_ack_targets");
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
  const row = first(
    state.storage.sql
      .exec<SqlRow>("SELECT value_json, updated_at, updated_by FROM app_config WHERE key = ? LIMIT 1", SLA_CONFIG_KEY)
      .toArray(),
  );
  if (!row?.value_json) return null;
  try {
    const parsed = JSON.parse(String(row.value_json)) as Partial<SlaConfig>;
    const warning = Number(parsed.warning_minutes);
    const escalation = Number(parsed.escalation_minutes);
    if (!Number.isInteger(warning) || !Number.isInteger(escalation) || warning < 1 || escalation <= warning) return null;
    return {
      warning_minutes: warning,
      escalation_minutes: escalation,
      updated_at: String(row.updated_at || "") || undefined,
      updated_by: row.updated_by == null ? null : String(row.updated_by),
    };
  } catch {
    return null;
  }
}

function slaState(firstReportAt: string, config: SlaConfig | null): { state: string; waiting_minutes: number } {
  const firstMs = Date.parse(firstReportAt);
  const waitingMinutes = Number.isFinite(firstMs) ? Math.max(0, Math.floor((Date.now() - firstMs) / 60_000)) : 0;
  if (!config) return { state: "UNCONFIGURED", waiting_minutes: waitingMinutes };
  if (waitingMinutes >= config.escalation_minutes) return { state: "ESCALATED", waiting_minutes: waitingMinutes };
  if (waitingMinutes >= config.warning_minutes) return { state: "WARNING", waiting_minutes: waitingMinutes };
  return { state: "NORMAL", waiting_minutes: waitingMinutes };
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
              b.resolved_at, b.resolution, b.correction_deadline_at, b.version, b.previous_batch_id,
              p.resolved_at AS previous_resolved_at,
              SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) AS open_ticket_count,
              COUNT(t.ticket_id) AS total_ticket_count,
              SUM(CASE WHEN a.acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) AS acknowledged_count,
              COUNT(DISTINCT a.target_user_id) AS ack_target_count
         FROM report_batches b
         LEFT JOIN report_batches p ON p.batch_id = b.previous_batch_id
         LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
         LEFT JOIN result_acknowledgements a
           ON a.batch_id = b.batch_id AND a.batch_version = b.version
        WHERE b.batch_id = ?
        GROUP BY b.batch_id
        LIMIT 1`,
      batchId,
    ).toArray(),
  );
  if (!row) return null;
  const config = readSlaConfig(state);
  const sla = row.status === "PENDING" ? slaState(String(row.first_report_at || ""), config) : null;
  return { ...row, ...(sla ? { sla_state: sla.state, waiting_minutes: sla.waiting_minutes } : {}) };
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
      WHEN NEW.event_type IN ('BATCH_RESOLVED','BATCH_CORRECTED')
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
       GROUP BY t.picker_user_id;
    END;
  `);

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
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
  const config = readSlaConfig(state);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.last_report_at,
            b.version, b.previous_batch_id, p.resolved_at AS previous_resolved_at,
            COUNT(t.ticket_id) AS affected_picker_count,
            MIN(t.reported_at) AS earliest_ticket_at
       FROM report_batches b
       JOIN report_tickets t ON t.batch_id = b.batch_id AND t.status = 'OPEN'
       LEFT JOIN report_batches p ON p.batch_id = b.previous_batch_id
      WHERE b.status = 'PENDING'
      GROUP BY b.batch_id
      ORDER BY affected_picker_count DESC, b.first_report_at ASC
      LIMIT ?`,
    limit,
  ).toArray().map((row) => {
    const sla = slaState(String(row.first_report_at || ""), config);
    const previousResolvedAt = String(row.previous_resolved_at || "");
    const recurrenceMinutes = previousResolvedAt && row.first_report_at
      ? Math.max(0, Math.round((Date.parse(String(row.first_report_at)) - Date.parse(previousResolvedAt)) / 60_000))
      : null;
    return {
      ...row,
      sla_state: sla.state,
      waiting_minutes: sla.waiting_minutes,
      recurrence_minutes: Number.isFinite(recurrenceMinutes as number) ? recurrenceMinutes : null,
    };
  });
  return json({ items: rows, count: rows.length, sla_configured: Boolean(config), sla: config });
}

function reporterRecent(state: DurableObjectState, url: URL): Response {
  const parsed = Number(url.searchParams.get("limit") || 100);
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.last_report_at,
            b.resolved_at, b.resolved_by_user_id, b.resolution, b.correction_deadline_at,
            b.version, b.previous_batch_id, p.resolved_at AS previous_resolved_at,
            COUNT(DISTINCT t.ticket_id) AS affected_picker_count,
            COUNT(DISTINCT a.target_user_id) AS ack_target_count,
            COUNT(DISTINCT CASE WHEN a.acknowledged_at IS NOT NULL THEN a.target_user_id END) AS acknowledged_count
       FROM report_batches b
       LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
       LEFT JOIN report_batches p ON p.batch_id = b.previous_batch_id
       LEFT JOIN result_acknowledgements a
         ON a.batch_id = b.batch_id AND a.batch_version = b.version
      WHERE b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')
      GROUP BY b.batch_id
      ORDER BY COALESCE(b.resolved_at, b.updated_at) DESC
      LIMIT ?`,
    limit,
  ).toArray();
  return json({ items: rows, count: rows.length });
}

function reporterBatchTickets(state: DurableObjectState, url: URL): Response {
  const batchId = String(url.searchParams.get("batch_id") || "").trim();
  if (!batchId) return json({ error: "BATCH_ID_REQUIRED" }, 400);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT t.ticket_id, t.picker_user_id, t.picker_employee_code,
            COALESCE(u.display_name, '') AS picker_display_name,
            t.status, t.reported_at, t.withdraw_deadline_at, t.withdrawn_at, t.resolved_at,
            a.result_event_id, a.received_at, a.displayed_at, a.acknowledged_at
       FROM report_tickets t
       JOIN report_batches b ON b.batch_id = t.batch_id
       LEFT JOIN users u ON u.employee_code = t.picker_employee_code
       LEFT JOIN result_acknowledgements a
         ON a.batch_id = b.batch_id
        AND a.batch_version = b.version
        AND a.target_user_id = t.picker_user_id
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
  if (!userId || !employeeCode) return json({ error: "INVALID_INPUT" }, 400);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT t.ticket_id, t.batch_id, t.sku, b.product_name, t.status,
            t.reported_at, t.withdraw_deadline_at, t.withdrawn_at, t.resolved_at,
            b.status AS batch_status, b.resolution, b.correction_deadline_at,
            b.version AS batch_version, b.previous_batch_id,
            a.result_event_id, a.received_at, a.displayed_at, a.acknowledged_at
       FROM report_tickets t
       JOIN report_batches b ON b.batch_id = t.batch_id
       LEFT JOIN result_acknowledgements a
         ON a.batch_id = b.batch_id
        AND a.batch_version = b.version
        AND a.target_user_id = ?
      WHERE t.picker_user_id = ? OR t.picker_employee_code = ?
      ORDER BY t.reported_at DESC
      LIMIT ?`,
    userId,
    userId,
    employeeCode,
    limit,
  ).toArray();
  return json({ items: rows, count: rows.length });
}

function pendingResults(state: DurableObjectState, url: URL): Response {
  const userId = String(url.searchParams.get("user_id") || "").trim();
  const parsed = Number(url.searchParams.get("limit") || 20);
  const limit = Math.max(1, Math.min(100, Number.isFinite(parsed) ? Math.trunc(parsed) : 20));
  if (!userId) return json({ error: "USER_ID_REQUIRED" }, 400);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT a.result_event_id, a.batch_id, a.batch_version, a.received_at, a.displayed_at, a.acknowledged_at,
            a.created_at, b.sku, b.product_name, b.status, b.resolution, b.resolved_at
       FROM result_acknowledgements a
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
           audit_id, actor_user_id, actor_employee_code, action, target_type, target_id, metadata_json, created_at
         ) VALUES (?, ?, ?, 'RESULT_ACKNOWLEDGE', 'RESULT_EVENT', ?, ?, ?)`,
        crypto.randomUUID(),
        actor.user_id,
        actor.employee_code,
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
    actor?: Actor;
  };
  const warning = Number(body.warning_minutes);
  const escalation = Number(body.escalation_minutes);
  const actor = body.actor;
  if (
    !actor?.user_id ||
    !Number.isInteger(warning) ||
    !Number.isInteger(escalation) ||
    warning < 1 || warning > 1440 ||
    escalation <= warning || escalation > 2880
  ) {
    return json({ error: "INVALID_SLA_CONFIG", rules: { warning_minutes: "1..1440", escalation_minutes: "> warning and <= 2880" } }, 400);
  }
  const at = new Date().toISOString();
  const value = { warning_minutes: warning, escalation_minutes: escalation };
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
  state.storage.sql.exec(
    `INSERT INTO audit_log (
       audit_id, actor_user_id, actor_employee_code, action, target_type, target_id, metadata_json, created_at
     ) VALUES (?, ?, ?, 'SLA_CONFIG_UPDATE', 'APP_CONFIG', ?, ?, ?)`,
    crypto.randomUUID(),
    actor.user_id,
    actor.employee_code,
    SLA_CONFIG_KEY,
    JSON.stringify(value),
    at,
  );
  return json({ status: "saved", configured: true, sla: { ...value, updated_at: at, updated_by: actor.user_id } });
}

function delta(state: DurableObjectState, url: URL): Response {
  const afterSeqRaw = Number(url.searchParams.get("after_seq") || 0);
  const afterSeq = Math.max(0, Number.isFinite(afterSeqRaw) ? Math.trunc(afterSeqRaw) : 0);
  const limitRaw = Number(url.searchParams.get("limit") || 100);
  const limit = Math.max(1, Math.min(MAX_DELTA_LIMIT, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 100));
  const role = String(url.searchParams.get("role") || "") as RealtimeRole;
  const userId = String(url.searchParams.get("user_id") || "").trim();
  if (!["PICKER", "REPORTER", "ADMIN", "ROOT"].includes(role) || !userId) {
    return json({ error: "INVALID_REALTIME_IDENTITY" }, 400);
  }

  const latestRow = first(state.storage.sql.exec<SqlRow>("SELECT COALESCE(MAX(seq),0) AS latest_seq FROM realtime_events").toArray()) || {};
  const latestSeq = Number(latestRow.latest_seq || 0);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT e.seq, e.event_id, e.event_type, e.batch_id, e.ticket_id,
            e.batch_version, e.scopes_json, e.payload_json, e.created_at
       FROM realtime_events e
      WHERE e.seq > ?
        AND (? <> 'PICKER' OR EXISTS (
          SELECT 1 FROM report_tickets t
           WHERE t.batch_id = e.batch_id AND t.picker_user_id = ?
        ))
      ORDER BY e.seq ASC
      LIMIT ?`,
    afterSeq,
    role,
    userId,
    limit + 1,
  ).toArray();

  const hasMore = rows.length > limit;
  const selected = hasMore ? rows.slice(0, limit) : rows;
  const events = selected.map((row) => {
    const batchId = String(row.batch_id || "");
    const snapshot = batchId ? currentBatchSnapshot(state, batchId) : null;
    return {
      seq: Number(row.seq || 0),
      event_id: String(row.event_id || ""),
      event: String(row.event_type || ""),
      batch_id: batchId || null,
      ticket_id: row.ticket_id == null ? null : String(row.ticket_id),
      batch_version: snapshot ? Number(snapshot.version || row.batch_version || 0) : Number(row.batch_version || 0),
      scopes: parseJsonArray(row.scopes_json),
      metadata: parseJsonObject(row.payload_json),
      snapshot,
      server_time: String(row.created_at || ""),
    };
  });

  const cursorSeq = hasMore
    ? Number(selected[selected.length - 1]?.seq || afterSeq)
    : latestSeq;
  return json({
    after_seq: afterSeq,
    events,
    count: events.length,
    latest_seq: latestSeq,
    cursor_seq: cursorSeq,
    complete: !hasMore,
    limit,
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
      batch_version: snapshot ? Number(snapshot.version || row.batch_version || 0) : Number(row.batch_version || 0),
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
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) {
    return json({ error: "INVALID_REPORTING_RANGE" }, 400);
  }
  const config = readSlaConfig(state);
  const pending = state.storage.sql.exec<SqlRow>(
    `SELECT batch_id, first_report_at FROM report_batches WHERE status = 'PENDING'`,
  ).toArray();
  let warning = 0;
  let escalated = 0;
  for (const row of pending) {
    const stateValue = slaState(String(row.first_report_at || ""), config).state;
    if (stateValue === "WARNING") warning += 1;
    if (stateValue === "ESCALATED") escalated += 1;
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
    sla: { configured: Boolean(config), config, warning_count: warning, escalated_count: escalated },
    recurrence: { top_skus: recurrence },
  });
}

export async function handleOperationalV2CoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);

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
