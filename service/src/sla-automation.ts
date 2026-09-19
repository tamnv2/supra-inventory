type SqlRow = Record<string, SqlStorageValue>;

export type AutoSkipMode = "FIRST_REPORT" | "PER_PICKER";

export interface OperationalSlaConfig {
  warning_minutes: number;
  escalation_minutes: number;
  auto_skip_minutes: number;
  auto_skip_enabled: boolean;
  auto_skip_mode: AutoSkipMode;
  policy_version?: number;
  effective_at?: string;
  updated_at?: string;
  updated_by?: string | null;
}

export interface OperationalDeadlineEffect {
  event: "sla_warning" | "sla_escalated" | "ticket_auto_skip_allowed" | "batch_auto_skip_allowed";
  event_id: string;
  batch_id: string;
  sku: string;
  product_name: string;
  scopes: string[];
  reporter_roles: Array<"REPORTER" | "ADMIN" | "ROOT">;
  picker_user_ids: string[];
  result_event: boolean;
  title: string;
  body: string;
}

const SLA_CONFIG_KEY = "operational_sla_v1";
const SYSTEM_USER_ID = "system:deadline";
const CORRECTION_WINDOW_MS = 5 * 60_000;
const MAX_DUE_PER_ALARM = 200;

function first<T extends SqlRow>(rows: T[]): T | null {
  return rows[0] ?? null;
}

function hasColumn(state: DurableObjectState, tableName: string, columnName: string): boolean {
  return state.storage.sql
    .exec<{ name: string }>(`PRAGMA table_info(${tableName})`)
    .toArray()
    .some((row) => row.name === columnName);
}

function hasTable(state: DurableObjectState, name: string): boolean {
  return Boolean(first(
    state.storage.sql
      .exec<SqlRow>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1", name)
      .toArray(),
  ));
}

function deadlineIso(baseAt: string, minutes: number): string | null {
  const baseMs = Date.parse(baseAt);
  if (!Number.isFinite(baseMs)) return null;
  return new Date(baseMs + minutes * 60_000).toISOString();
}

function parseConfig(value: unknown, updatedAt?: unknown, updatedBy?: unknown): OperationalSlaConfig | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value)) as Partial<OperationalSlaConfig>;
    const warning = Number(parsed.warning_minutes);
    const escalation = Number(parsed.escalation_minutes);
    if (!Number.isInteger(warning) || !Number.isInteger(escalation) || warning < 1 || escalation <= warning) return null;

    // Legacy D050/D069 rows did not have the third threshold. Keep auto-skip safely OFF
    // until Admin/Root explicitly saves the D070 policy.
    const autoCandidate = Number(parsed.auto_skip_minutes);
    const autoSkip = Number.isInteger(autoCandidate) && autoCandidate > escalation
      ? autoCandidate
      : Math.min(10_080, escalation + Math.max(1, Math.min(60, escalation - warning || 5)));
    const mode: AutoSkipMode = parsed.auto_skip_mode === "PER_PICKER" ? "PER_PICKER" : "FIRST_REPORT";

    return {
      warning_minutes: warning,
      escalation_minutes: escalation,
      auto_skip_minutes: autoSkip,
      auto_skip_enabled: parsed.auto_skip_enabled === true,
      auto_skip_mode: mode,
      policy_version: Number(parsed.policy_version || 0) || undefined,
      effective_at: String(parsed.effective_at || "") || undefined,
      updated_at: String(updatedAt || parsed.updated_at || "") || undefined,
      updated_by: updatedBy == null ? (parsed.updated_by == null ? null : String(parsed.updated_by)) : String(updatedBy),
    };
  } catch {
    return null;
  }
}

export function readOperationalSlaConfig(state: DurableObjectState): OperationalSlaConfig | null {
  const row = first(
    state.storage.sql
      .exec<SqlRow>("SELECT value_json, updated_at, updated_by FROM app_config WHERE key = ? LIMIT 1", SLA_CONFIG_KEY)
      .toArray(),
  );
  return row ? parseConfig(row.value_json, row.updated_at, row.updated_by) : null;
}

export function validateOperationalSlaConfig(input: {
  warning_minutes: unknown;
  escalation_minutes: unknown;
  auto_skip_minutes: unknown;
  auto_skip_enabled: unknown;
  auto_skip_mode: unknown;
}): { ok: true; value: Omit<OperationalSlaConfig, "updated_at" | "updated_by"> } | { ok: false } {
  const warning = Number(input.warning_minutes);
  const escalation = Number(input.escalation_minutes);
  const autoSkip = Number(input.auto_skip_minutes);
  const enabled = input.auto_skip_enabled === true;
  const mode = String(input.auto_skip_mode || "").toUpperCase();

  if (
    !Number.isInteger(warning) ||
    !Number.isInteger(escalation) ||
    !Number.isInteger(autoSkip) ||
    warning < 1 ||
    warning > 1_440 ||
    escalation <= warning ||
    escalation > 2_880 ||
    autoSkip <= escalation ||
    autoSkip > 10_080 ||
    !["FIRST_REPORT", "PER_PICKER"].includes(mode)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      warning_minutes: warning,
      escalation_minutes: escalation,
      auto_skip_minutes: autoSkip,
      auto_skip_enabled: enabled,
      auto_skip_mode: mode as AutoSkipMode,
    },
  };
}

export function initializeSlaAutomationSchema(state: DurableObjectState): void {
  const sql = state.storage.sql;
  if (!hasColumn(state, "report_batches", "auto_skip_deadline_at")) {
    sql.exec("ALTER TABLE report_batches ADD COLUMN auto_skip_deadline_at TEXT");
  }
  if (!hasColumn(state, "report_batches", "resolution_source")) {
    sql.exec("ALTER TABLE report_batches ADD COLUMN resolution_source TEXT");
  }
  if (!hasColumn(state, "report_tickets", "auto_skip_deadline_at")) {
    sql.exec("ALTER TABLE report_tickets ADD COLUMN auto_skip_deadline_at TEXT");
  }
  if (!hasColumn(state, "report_tickets", "auto_skip_allowed_at")) {
    sql.exec("ALTER TABLE report_tickets ADD COLUMN auto_skip_allowed_at TEXT");
  }
  if (!hasColumn(state, "report_tickets", "resolution")) {
    sql.exec("ALTER TABLE report_tickets ADD COLUMN resolution TEXT");
  }
  if (!hasColumn(state, "report_tickets", "resolution_source")) {
    sql.exec("ALTER TABLE report_tickets ADD COLUMN resolution_source TEXT");
  }

  sql.exec(`
    CREATE TABLE IF NOT EXISTS sla_deadline_events (
      deadline_event_key TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      ticket_id TEXT,
      level TEXT NOT NULL,
      event_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sla_deadline_events_batch_level
      ON sla_deadline_events(batch_id, level, created_at);
    CREATE INDEX IF NOT EXISTS idx_report_batches_auto_skip_deadline
      ON report_batches(status, auto_skip_deadline_at);
    CREATE INDEX IF NOT EXISTS idx_report_tickets_auto_skip_deadline
      ON report_tickets(status, auto_skip_allowed_at, auto_skip_deadline_at);
  `);
}

export function slaAutomationReadiness(state: DurableObjectState): boolean {
  return (
    hasColumn(state, "report_batches", "auto_skip_deadline_at") &&
    hasColumn(state, "report_batches", "resolution_source") &&
    hasColumn(state, "report_tickets", "auto_skip_deadline_at") &&
    hasColumn(state, "report_tickets", "auto_skip_allowed_at") &&
    hasColumn(state, "report_tickets", "resolution") &&
    hasColumn(state, "report_tickets", "resolution_source") &&
    hasTable(state, "sla_deadline_events")
  );
}

export function planAutoSkipForNewReport(
  state: DurableObjectState,
  input: {
    reported_at: string;
    existing_batch: boolean;
    existing_batch_deadline_at?: string | null;
  },
): {
  config: OperationalSlaConfig | null;
  batch_deadline_at: string | null;
  ticket_deadline_at: string | null;
} {
  const config = readOperationalSlaConfig(state);
  if (!config?.auto_skip_enabled) {
    return { config, batch_deadline_at: input.existing_batch_deadline_at || null, ticket_deadline_at: null };
  }

  if (config.auto_skip_mode === "PER_PICKER") {
    return {
      config,
      batch_deadline_at: input.existing_batch_deadline_at || null,
      ticket_deadline_at: deadlineIso(input.reported_at, config.auto_skip_minutes),
    };
  }

  // FIRST_REPORT is intentionally not backfilled to a batch that existed before
  // this policy was enabled/saved. A new report joining such a legacy batch also
  // inherits no automatic deadline.
  if (input.existing_batch) {
    const deadline = input.existing_batch_deadline_at || null;
    return { config, batch_deadline_at: deadline, ticket_deadline_at: deadline };
  }

  const deadline = deadlineIso(input.reported_at, config.auto_skip_minutes);
  return { config, batch_deadline_at: deadline, ticket_deadline_at: deadline };
}

function insertReportEvent(
  state: DurableObjectState,
  eventType: string,
  batchId: string,
  ticketId: string | null,
  payload: Record<string, unknown>,
  at: string,
): string {
  const eventId = crypto.randomUUID();
  state.storage.sql.exec(
    `INSERT INTO report_events (
       event_id, batch_id, ticket_id, event_type, actor_user_id, actor_employee_code, payload_json, created_at
     ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    eventId,
    batchId,
    ticketId,
    eventType,
    SYSTEM_USER_ID,
    JSON.stringify(payload),
    at,
  );
  return eventId;
}

function insertResultSnapshot(
  state: DurableObjectState,
  eventId: string,
  eventType: string,
  batchId: string,
  resolution: "SKIP_ALLOWED",
  at: string,
): void {
  const batch = first(state.storage.sql.exec<SqlRow>(
    "SELECT sku, product_name, version FROM report_batches WHERE batch_id = ? LIMIT 1",
    batchId,
  ).toArray());
  if (!batch) return;
  state.storage.sql.exec(
    `INSERT OR IGNORE INTO result_event_snapshots (
       result_event_id, batch_id, batch_version, event_type,
       sku, product_name, resolution, result_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    eventId,
    batchId,
    Number(batch.version || 1),
    eventType,
    String(batch.sku || ""),
    String(batch.product_name || ""),
    resolution,
    at,
    at,
  );
}

function auditSystem(
  state: DurableObjectState,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
  at: string,
): void {
  state.storage.sql.exec(
    `INSERT INTO audit_log (
       audit_id, actor_user_id, actor_employee_code, action, target_type, target_id, metadata_json, created_at
     ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    SYSTEM_USER_ID,
    action,
    targetType,
    targetId,
    JSON.stringify(metadata),
    at,
  );
}

function activePickerUsersForBatch(state: DurableObjectState, batchId: string): string[] {
  return state.storage.sql.exec<SqlRow>(
    `SELECT DISTINCT picker_user_id AS user_id
       FROM report_tickets
      WHERE batch_id = ?
        AND status = 'OPEN'
        AND auto_skip_allowed_at IS NULL
        AND picker_user_id IS NOT NULL
        AND picker_user_id <> ''
      ORDER BY picker_user_id`,
    batchId,
  ).toArray().map((row) => String(row.user_id || "")).filter(Boolean);
}

function batchIdentity(state: DurableObjectState, batchId: string): { sku: string; product_name: string } {
  const row = first(state.storage.sql.exec<SqlRow>(
    "SELECT sku, product_name FROM report_batches WHERE batch_id = ? LIMIT 1",
    batchId,
  ).toArray());
  return { sku: String(row?.sku || ""), product_name: String(row?.product_name || "") };
}

function recordDeadlineOnce(
  state: DurableObjectState,
  batchId: string,
  level: "WARNING" | "ESCALATED",
  eventId: string,
  at: string,
): void {
  state.storage.sql.exec(
    `INSERT OR IGNORE INTO sla_deadline_events (
       deadline_event_key, batch_id, ticket_id, level, event_id, created_at
     ) VALUES (?, ?, NULL, ?, ?, ?)`,
    `${batchId}:${level}`,
    batchId,
    level,
    eventId,
    at,
  );
}

function deadlineAlreadyRecorded(state: DurableObjectState, batchId: string, level: "WARNING" | "ESCALATED"): boolean {
  return Boolean(first(state.storage.sql.exec<SqlRow>(
    "SELECT 1 AS present FROM sla_deadline_events WHERE deadline_event_key = ? LIMIT 1",
    `${batchId}:${level}`,
  ).toArray()));
}

function processWarningAndEscalation(
  state: DurableObjectState,
  config: OperationalSlaConfig,
  nowMs: number,
  effects: OperationalDeadlineEffect[],
): void {
  if (Number(config.policy_version || 0) < 2 || !config.effective_at) return;
  const now = new Date(nowMs).toISOString();
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.first_report_at
       FROM report_batches b
      WHERE b.status = 'PENDING'
        AND b.first_report_at >= ?
        AND (
          NOT EXISTS (
            SELECT 1 FROM sla_deadline_events d
             WHERE d.deadline_event_key = b.batch_id || ':WARNING'
          )
          OR NOT EXISTS (
            SELECT 1 FROM sla_deadline_events d
             WHERE d.deadline_event_key = b.batch_id || ':ESCALATED'
          )
        )
      ORDER BY b.first_report_at ASC
      LIMIT ?`,
    config.effective_at,
    MAX_DUE_PER_ALARM,
  ).toArray();

  for (const row of rows) {
    const batchId = String(row.batch_id || "");
    const firstMs = Date.parse(String(row.first_report_at || ""));
    if (!batchId || !Number.isFinite(firstMs)) continue;

    const warningDue = firstMs + config.warning_minutes * 60_000 <= nowMs;
    const escalationDue = firstMs + config.escalation_minutes * 60_000 <= nowMs;

    if (warningDue && !escalationDue && !deadlineAlreadyRecorded(state, batchId, "WARNING")) {
      const eventId = insertReportEvent(
        state,
        "SLA_WARNING",
        batchId,
        null,
        { level: "WARNING", threshold_minutes: config.warning_minutes, source: "SYSTEM_DEADLINE" },
        now,
      );
      recordDeadlineOnce(state, batchId, "WARNING", eventId, now);
      auditSystem(state, "SLA_WARNING", "REPORT_BATCH", batchId, { threshold_minutes: config.warning_minutes }, now);
      effects.push({
        event: "sla_warning",
        event_id: eventId,
        batch_id: batchId,
        sku: String(row.sku || ""),
        product_name: String(row.product_name || ""),
        scopes: ["reporter_queue"],
        reporter_roles: ["REPORTER", "ADMIN", "ROOT"],
        picker_user_ids: [],
        result_event: false,
        title: "SUPRA Inventory · SKU sắp quá hạn",
        body: `${String(row.sku || "SKU")} đã chờ ${config.warning_minutes} phút.`,
      });
    }

    if (escalationDue && !deadlineAlreadyRecorded(state, batchId, "ESCALATED")) {
      const pickerUsers = activePickerUsersForBatch(state, batchId);
      const eventId = insertReportEvent(
        state,
        "SLA_ESCALATED",
        batchId,
        null,
        { level: "ESCALATED", threshold_minutes: config.escalation_minutes, source: "SYSTEM_DEADLINE" },
        now,
      );
      recordDeadlineOnce(state, batchId, "ESCALATED", eventId, now);
      auditSystem(state, "SLA_ESCALATED", "REPORT_BATCH", batchId, { threshold_minutes: config.escalation_minutes }, now);
      effects.push({
        event: "sla_escalated",
        event_id: eventId,
        batch_id: batchId,
        sku: String(row.sku || ""),
        product_name: String(row.product_name || ""),
        scopes: ["reporter_queue", "picker_reports"],
        reporter_roles: ["REPORTER", "ADMIN", "ROOT"],
        picker_user_ids: pickerUsers,
        result_event: false,
        title: "SUPRA Inventory · SKU quá hạn",
        body: `${String(row.sku || "SKU")} đã quá mốc xử lý ${config.escalation_minutes} phút.`,
      });
    }
  }
}

function processBatchAutoSkip(
  state: DurableObjectState,
  config: OperationalSlaConfig | null,
  nowMs: number,
  effects: OperationalDeadlineEffect[],
): void {
  if (!config?.auto_skip_enabled || config.auto_skip_mode !== "FIRST_REPORT") return;
  const now = new Date(nowMs).toISOString();
  const due = state.storage.sql.exec<SqlRow>(
    `SELECT batch_id, sku, product_name, auto_skip_deadline_at
       FROM report_batches
      WHERE status = 'PENDING'
        AND auto_skip_deadline_at IS NOT NULL
        AND auto_skip_deadline_at <= ?
      ORDER BY auto_skip_deadline_at ASC
      LIMIT ?`,
    now,
    MAX_DUE_PER_ALARM,
  ).toArray();

  for (const row of due) {
    const batchId = String(row.batch_id || "");
    if (!batchId) continue;

    state.storage.transactionSync(() => {
      const current = first(state.storage.sql.exec<SqlRow>(
        "SELECT status, auto_skip_deadline_at FROM report_batches WHERE batch_id = ? LIMIT 1",
        batchId,
      ).toArray());
      if (!current || String(current.status) !== "PENDING" || !current.auto_skip_deadline_at || String(current.auto_skip_deadline_at) > now) return;

      const targetRows = state.storage.sql.exec<SqlRow>(
        `SELECT ticket_id, picker_user_id
           FROM report_tickets
          WHERE batch_id = ?
            AND status = 'OPEN'
            AND auto_skip_allowed_at IS NULL
          ORDER BY reported_at ASC`,
        batchId,
      ).toArray();
      if (!targetRows.length) return;

      const correctionDeadline = new Date(nowMs + CORRECTION_WINDOW_MS).toISOString();
      state.storage.sql.exec(
        `UPDATE report_tickets
            SET status = 'RESOLVED',
                auto_skip_allowed_at = ?,
                resolution = 'SKIP_ALLOWED',
                resolution_source = 'SYSTEM_TIMEOUT',
                resolved_at = ?,
                updated_at = ?
          WHERE batch_id = ?
            AND status = 'OPEN'
            AND auto_skip_allowed_at IS NULL`,
        now,
        now,
        now,
        batchId,
      );
      state.storage.sql.exec(
        `UPDATE report_batches
            SET status = 'SKIP_ALLOWED',
                resolution = 'SKIP_ALLOWED',
                resolution_source = 'SYSTEM_TIMEOUT',
                resolved_at = ?,
                resolved_by_user_id = NULL,
                correction_deadline_at = ?,
                updated_at = ?
          WHERE batch_id = ? AND status = 'PENDING'`,
        now,
        correctionDeadline,
        now,
        batchId,
      );

      const eventId = insertReportEvent(
        state,
        "BATCH_AUTO_SKIP_ALLOWED",
        batchId,
        null,
        {
          resolution: "SKIP_ALLOWED",
          source: "SYSTEM_TIMEOUT",
          auto_skip_mode: "FIRST_REPORT",
          affected_picker_count: targetRows.length,
          correction_deadline_at: correctionDeadline,
        },
        now,
      );
      insertResultSnapshot(state, eventId, "BATCH_AUTO_SKIP_ALLOWED", batchId, "SKIP_ALLOWED", now);
      auditSystem(
        state,
        "BATCH_AUTO_SKIP_ALLOWED",
        "REPORT_BATCH",
        batchId,
        { mode: "FIRST_REPORT", affected_picker_count: targetRows.length, deadline_at: String(row.auto_skip_deadline_at || "") },
        now,
      );

      effects.push({
        event: "batch_auto_skip_allowed",
        event_id: eventId,
        batch_id: batchId,
        sku: String(row.sku || ""),
        product_name: String(row.product_name || ""),
        scopes: ["reporter_queue", "reporter_recent", "picker_reports"],
        reporter_roles: ["REPORTER", "ADMIN", "ROOT"],
        picker_user_ids: [...new Set(targetRows.map((ticket) => String(ticket.picker_user_id || "")).filter(Boolean))],
        result_event: true,
        title: "SUPRA Inventory · Được phép bỏ qua",
        body: `${String(row.sku || "SKU")} đã quá thời gian phản hồi. Hệ thống cho phép bỏ qua.`,
      });
    });
  }
}

function processPerPickerAutoSkip(
  state: DurableObjectState,
  config: OperationalSlaConfig | null,
  nowMs: number,
  effects: OperationalDeadlineEffect[],
): void {
  if (!config?.auto_skip_enabled || config.auto_skip_mode !== "PER_PICKER") return;
  const now = new Date(nowMs).toISOString();
  const due = state.storage.sql.exec<SqlRow>(
    `SELECT t.ticket_id, t.batch_id, t.picker_user_id, t.auto_skip_deadline_at,
            b.sku, b.product_name
       FROM report_tickets t
       JOIN report_batches b ON b.batch_id = t.batch_id
      WHERE b.status = 'PENDING'
        AND b.auto_skip_deadline_at IS NULL
        AND t.status = 'OPEN'
        AND t.auto_skip_allowed_at IS NULL
        AND t.auto_skip_deadline_at IS NOT NULL
        AND t.auto_skip_deadline_at <= ?
      ORDER BY t.auto_skip_deadline_at ASC, t.reported_at ASC
      LIMIT ?`,
    now,
    MAX_DUE_PER_ALARM,
  ).toArray();

  for (const row of due) {
    const ticketId = String(row.ticket_id || "");
    const batchId = String(row.batch_id || "");
    const pickerUserId = String(row.picker_user_id || "");
    if (!ticketId || !batchId) continue;

    state.storage.transactionSync(() => {
      const ticket = first(state.storage.sql.exec<SqlRow>(
        `SELECT t.status, t.auto_skip_allowed_at, t.auto_skip_deadline_at, b.status AS batch_status
           FROM report_tickets t
           JOIN report_batches b ON b.batch_id = t.batch_id
          WHERE t.ticket_id = ? LIMIT 1`,
        ticketId,
      ).toArray());
      if (
        !ticket ||
        String(ticket.batch_status) !== "PENDING" ||
        String(ticket.status) !== "OPEN" ||
        ticket.auto_skip_allowed_at ||
        !ticket.auto_skip_deadline_at ||
        String(ticket.auto_skip_deadline_at) > now
      ) return;

      state.storage.sql.exec(
        `UPDATE report_tickets
            SET auto_skip_allowed_at = ?,
                resolution = 'SKIP_ALLOWED',
                resolution_source = 'SYSTEM_TIMEOUT',
                updated_at = ?
          WHERE ticket_id = ?
            AND status = 'OPEN'
            AND auto_skip_allowed_at IS NULL`,
        now,
        now,
        ticketId,
      );

      const remaining = first(state.storage.sql.exec<SqlRow>(
        `SELECT COUNT(*) AS count
           FROM report_tickets
          WHERE batch_id = ?
            AND status = 'OPEN'
            AND auto_skip_allowed_at IS NULL`,
        batchId,
      ).toArray());
      const finalForBatch = Number(remaining?.count || 0) === 0;
      let correctionDeadline: string | null = null;

      if (finalForBatch) {
        correctionDeadline = new Date(nowMs + CORRECTION_WINDOW_MS).toISOString();
        state.storage.sql.exec(
          `UPDATE report_tickets
              SET status = 'RESOLVED',
                  resolved_at = COALESCE(resolved_at, ?),
                  updated_at = ?
            WHERE batch_id = ? AND status = 'OPEN'`,
          now,
          now,
          batchId,
        );
        state.storage.sql.exec(
          `UPDATE report_batches
              SET status = 'SKIP_ALLOWED',
                  resolution = 'SKIP_ALLOWED',
                  resolution_source = 'SYSTEM_TIMEOUT',
                  resolved_at = ?,
                  resolved_by_user_id = NULL,
                  correction_deadline_at = ?,
                  updated_at = ?
            WHERE batch_id = ? AND status = 'PENDING'`,
          now,
          correctionDeadline,
          now,
          batchId,
        );
      }

      const eventId = insertReportEvent(
        state,
        "TICKET_AUTO_SKIP_ALLOWED",
        batchId,
        ticketId,
        {
          resolution: "SKIP_ALLOWED",
          source: "SYSTEM_TIMEOUT",
          auto_skip_mode: "PER_PICKER",
          auto_skip_deadline_at: String(row.auto_skip_deadline_at || ""),
          final_batch_resolution: finalForBatch,
          correction_deadline_at: correctionDeadline,
        },
        now,
      );
      insertResultSnapshot(state, eventId, "TICKET_AUTO_SKIP_ALLOWED", batchId, "SKIP_ALLOWED", now);
      auditSystem(
        state,
        "TICKET_AUTO_SKIP_ALLOWED",
        "REPORT_TICKET",
        ticketId,
        {
          batch_id: batchId,
          mode: "PER_PICKER",
          deadline_at: String(row.auto_skip_deadline_at || ""),
          final_batch_resolution: finalForBatch,
        },
        now,
      );

      effects.push({
        event: "ticket_auto_skip_allowed",
        event_id: eventId,
        batch_id: batchId,
        sku: String(row.sku || ""),
        product_name: String(row.product_name || ""),
        scopes: ["reporter_queue", ...(finalForBatch ? ["reporter_recent"] : []), "picker_reports"],
        reporter_roles: ["REPORTER", "ADMIN", "ROOT"],
        picker_user_ids: pickerUserId ? [pickerUserId] : [],
        result_event: true,
        title: "SUPRA Inventory · Được phép bỏ qua",
        body: `${String(row.sku || "SKU")} đã quá thời gian phản hồi của bạn. Hệ thống cho phép bỏ qua.`,
      });
    });
  }
}

export function processOperationalDeadlines(
  state: DurableObjectState,
  nowMs = Date.now(),
): OperationalDeadlineEffect[] {
  const effects: OperationalDeadlineEffect[] = [];
  const config = readOperationalSlaConfig(state);
  processBatchAutoSkip(state, config, nowMs, effects);
  processPerPickerAutoSkip(state, config, nowMs, effects);
  if (config) processWarningAndEscalation(state, config, nowMs, effects);
  return effects;
}

function earliestPendingFirstReport(state: DurableObjectState, level: "WARNING" | "ESCALATED", effectiveAt: string): string | null {
  const row = first(state.storage.sql.exec<SqlRow>(
    `SELECT MIN(b.first_report_at) AS first_report_at
       FROM report_batches b
      WHERE b.status = 'PENDING'
        AND b.first_report_at >= ?
        AND NOT EXISTS (
          SELECT 1 FROM sla_deadline_events d
           WHERE d.deadline_event_key = b.batch_id || ':' || ?
        )`,
    effectiveAt,
    level,
  ).toArray());
  return row?.first_report_at ? String(row.first_report_at) : null;
}

export async function scheduleNextOperationalAlarm(state: DurableObjectState): Promise<void> {
  const config = readOperationalSlaConfig(state);
  const candidates: number[] = [];

  if (config && Number(config.policy_version || 0) >= 2 && config.effective_at) {
    const warningBase = earliestPendingFirstReport(state, "WARNING", config.effective_at);
    const escalationBase = earliestPendingFirstReport(state, "ESCALATED", config.effective_at);
    const warningAt = warningBase ? deadlineIso(warningBase, config.warning_minutes) : null;
    const escalationAt = escalationBase ? deadlineIso(escalationBase, config.escalation_minutes) : null;
    for (const value of [warningAt, escalationAt]) {
      const ms = value ? Date.parse(value) : NaN;
      if (Number.isFinite(ms)) candidates.push(ms);
    }
  }

  if (config?.auto_skip_enabled && config.auto_skip_mode === "FIRST_REPORT") {
    const batchAuto = first(state.storage.sql.exec<SqlRow>(
      `SELECT MIN(auto_skip_deadline_at) AS deadline
         FROM report_batches
        WHERE status = 'PENDING' AND auto_skip_deadline_at IS NOT NULL`,
    ).toArray());
    const ms = batchAuto?.deadline ? Date.parse(String(batchAuto.deadline)) : NaN;
    if (Number.isFinite(ms)) candidates.push(ms);
  }
  if (config?.auto_skip_enabled && config.auto_skip_mode === "PER_PICKER") {
    const ticketAuto = first(state.storage.sql.exec<SqlRow>(
      `SELECT MIN(t.auto_skip_deadline_at) AS deadline
         FROM report_tickets t
         JOIN report_batches b ON b.batch_id = t.batch_id
        WHERE b.status = 'PENDING'
          AND t.status = 'OPEN'
          AND t.auto_skip_allowed_at IS NULL
          AND t.auto_skip_deadline_at IS NOT NULL`,
    ).toArray());
    const ms = ticketAuto?.deadline ? Date.parse(String(ticketAuto.deadline)) : NaN;
    if (Number.isFinite(ms)) candidates.push(ms);
  }

  if (!candidates.length) {
    await state.storage.deleteAlarm();
    return;
  }
  const next = Math.max(Date.now() + 250, Math.min(...candidates));
  await state.storage.setAlarm(next);
}
