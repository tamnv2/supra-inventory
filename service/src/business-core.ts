type SqlRow = Record<string, SqlStorageValue>;

type Actor = {
  user_id: string;
  employee_code: string | null;
};

type BusinessResult = {
  status: number;
  payload: Record<string, unknown>;
};

interface SkuRow extends SqlRow {
  sku: string;
  product_name: string;
  source_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketRow extends SqlRow {
  ticket_id: string;
  batch_id: string;
  picker_user_id: string | null;
  picker_employee_code: string;
  sku: string;
  status: string;
  reported_at: string;
  withdraw_deadline_at: string;
  withdrawn_at: string | null;
  resolved_at: string | null;
}

interface BatchRow extends SqlRow {
  batch_id: string;
  sku: string;
  product_name: string;
  status: string;
  first_report_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution: string | null;
  correction_deadline_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IdempotencyRow extends SqlRow {
  response_json: string;
}

const MAX_IMPORT_ITEMS = 5000;
const MAX_LIST_LIMIT = 200;
const WITHDRAW_WINDOW_MS = 60_000;
const CORRECTION_WINDOW_MS = 5 * 60_000;
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function normalizeSku(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeProductName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeRequestId(value: unknown): string | null {
  const requestId = String(value ?? "").trim();
  return REQUEST_ID_RE.test(requestId) ? requestId : null;
}

function normalizeLimit(value: string | null, fallback = 50): number {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.trunc(parsed)));
}

function firstRow<T extends SqlRow>(rows: T[]): T | null {
  return rows[0] ?? null;
}

function readIdempotency(state: DurableObjectState, scope: string, requestId: string): Record<string, unknown> | null {
  const row = firstRow(
    state.storage.sql
      .exec<IdempotencyRow>(
        "SELECT response_json FROM idempotency_keys WHERE scope = ? AND idempotency_key = ? LIMIT 1",
        scope,
        requestId,
      )
      .toArray(),
  );
  if (!row) return null;
  try {
    return JSON.parse(row.response_json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function storeIdempotency(
  state: DurableObjectState,
  scope: string,
  requestId: string,
  payload: Record<string, unknown>,
  createdAt: string,
): void {
  state.storage.sql.exec(
    `INSERT OR REPLACE INTO idempotency_keys (scope, idempotency_key, response_json, created_at)
     VALUES (?, ?, ?, ?)`,
    scope,
    requestId,
    JSON.stringify(payload),
    createdAt,
  );
}

function audit(
  state: DurableObjectState,
  actor: Actor,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
  createdAt: string,
): void {
  state.storage.sql.exec(
    `INSERT INTO audit_log (
       audit_id, actor_user_id, actor_employee_code, action, target_type, target_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    actor.user_id,
    actor.employee_code,
    action,
    targetType,
    targetId,
    JSON.stringify(metadata),
    createdAt,
  );
}

function event(
  state: DurableObjectState,
  actor: Actor,
  eventType: string,
  batchId: string | null,
  ticketId: string | null,
  payload: Record<string, unknown>,
  createdAt: string,
): string {
  const eventId = crypto.randomUUID();
  state.storage.sql.exec(
    `INSERT INTO report_events (
       event_id, batch_id, ticket_id, event_type, actor_user_id, actor_employee_code, payload_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    eventId,
    batchId,
    ticketId,
    eventType,
    actor.user_id,
    actor.employee_code,
    JSON.stringify(payload),
    createdAt,
  );
  return eventId;
}

export function initializeBusinessSchema(state: DurableObjectState): void {
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      scope TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (scope, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_batch_sku
      ON report_batches(sku) WHERE status = 'PENDING';
  `);
}

async function importSkus(state: DurableObjectState, request: Request): Promise<BusinessResult> {
  const body = (await request.json()) as {
    actor?: Actor;
    request_id?: string;
    source_hash?: string;
    items?: Array<{ sku?: unknown; product_name?: unknown }>;
  };
  const actor = body.actor;
  const requestId = normalizeRequestId(body.request_id);
  if (!actor?.user_id || !requestId) return { status: 400, payload: { error: "INVALID_INPUT" } };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_IMPORT_ITEMS) {
    return { status: 400, payload: { error: "INVALID_SKU_IMPORT_SIZE", max_items: MAX_IMPORT_ITEMS } };
  }

  const normalized = body.items.map((item, index) => ({
    index,
    sku: normalizeSku(item.sku),
    product_name: normalizeProductName(item.product_name),
  }));
  const invalid = normalized.filter((item) => !item.sku || !item.product_name || item.sku.length > 128 || item.product_name.length > 500);
  if (invalid.length) {
    return {
      status: 400,
      payload: { error: "INVALID_SKU_ROWS", rows: invalid.slice(0, 50).map((item) => item.index + 1) },
    };
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of normalized) {
    if (seen.has(item.sku)) duplicates.add(item.sku);
    seen.add(item.sku);
  }
  if (duplicates.size) {
    return { status: 400, payload: { error: "DUPLICATE_SKU_IN_IMPORT", skus: [...duplicates].slice(0, 50) } };
  }

  const sourceHash = String(body.source_hash || "").trim() || null;
  const result = state.storage.transactionSync(() => {
    const scope = `sku_import:${actor.user_id}`;
    const replay = readIdempotency(state, scope, requestId);
    if (replay) return { status: 200, payload: { ...replay, idempotent_replay: true } } satisfies BusinessResult;

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const at = nowIso();

    for (const item of normalized) {
      const existing = firstRow(
        state.storage.sql
          .exec<SkuRow>("SELECT sku, product_name, source_hash, created_at, updated_at FROM sku_master WHERE sku = ? LIMIT 1", item.sku)
          .toArray(),
      );
      if (!existing) {
        state.storage.sql.exec(
          `INSERT INTO sku_master (sku, product_name, source_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          item.sku,
          item.product_name,
          sourceHash,
          at,
          at,
        );
        inserted += 1;
      } else if (existing.product_name === item.product_name && (existing.source_hash || null) === sourceHash) {
        unchanged += 1;
      } else {
        state.storage.sql.exec(
          `UPDATE sku_master
              SET product_name = ?, source_hash = ?, updated_at = ?
            WHERE sku = ?`,
          item.product_name,
          sourceHash,
          at,
          item.sku,
        );
        updated += 1;
      }
    }

    const payload = {
      status: "imported",
      total: normalized.length,
      inserted,
      updated,
      unchanged,
      source_hash: sourceHash,
      imported_at: at,
    };
    audit(state, actor, "SKU_IMPORT", "SKU_MASTER", requestId, payload, at);
    storeIdempotency(state, scope, requestId, payload, at);
    return { status: 200, payload } satisfies BusinessResult;
  });
  return result;
}

function searchSkus(state: DurableObjectState, url: URL): BusinessResult {
  const query = String(url.searchParams.get("query") || "").trim();
  const limit = normalizeLimit(url.searchParams.get("limit"), 50);
  const rows = query
    ? state.storage.sql
        .exec<SkuRow>(
          `SELECT sku, product_name, source_hash, created_at, updated_at
             FROM sku_master
            WHERE sku LIKE ? OR product_name LIKE ?
            ORDER BY sku ASC
            LIMIT ?`,
          `%${query}%`,
          `%${query}%`,
          limit,
        )
        .toArray()
    : state.storage.sql
        .exec<SkuRow>(
          `SELECT sku, product_name, source_hash, created_at, updated_at
             FROM sku_master
            ORDER BY sku ASC
            LIMIT ?`,
          limit,
        )
        .toArray();
  return { status: 200, payload: { items: rows, count: rows.length, query, limit } };
}

async function createReport(state: DurableObjectState, request: Request): Promise<BusinessResult> {
  const body = (await request.json()) as { actor?: Actor; request_id?: string; sku?: unknown };
  const actor = body.actor;
  const requestId = normalizeRequestId(body.request_id);
  const sku = normalizeSku(body.sku);
  if (!actor?.user_id || !actor.employee_code || !requestId || !sku) {
    return { status: 400, payload: { error: "INVALID_INPUT" } };
  }

  return state.storage.transactionSync(() => {
    const scope = `report_create:${actor.user_id}`;
    const replay = readIdempotency(state, scope, requestId);
    if (replay) return { status: 200, payload: { ...replay, idempotent_replay: true } } satisfies BusinessResult;

    const skuRow = firstRow(
      state.storage.sql
        .exec<SkuRow>("SELECT sku, product_name, source_hash, created_at, updated_at FROM sku_master WHERE sku = ? LIMIT 1", sku)
        .toArray(),
    );
    if (!skuRow) return { status: 404, payload: { error: "SKU_NOT_FOUND", sku } } satisfies BusinessResult;

    const existing = firstRow(
      state.storage.sql
        .exec<TicketRow>(
          `SELECT ticket_id, batch_id, picker_user_id, picker_employee_code, sku, status,
                  reported_at, withdraw_deadline_at, withdrawn_at, resolved_at
             FROM report_tickets
            WHERE picker_employee_code = ? AND sku = ? AND status = 'OPEN'
            LIMIT 1`,
          actor.employee_code,
          sku,
        )
        .toArray(),
    );
    if (existing) {
      return { status: 409, payload: { error: "ALREADY_REPORTED", ticket: existing } } satisfies BusinessResult;
    }

    const at = nowIso();
    let batch = firstRow(
      state.storage.sql
        .exec<BatchRow>(
          `SELECT batch_id, sku, product_name, status, first_report_at, resolved_at,
                  resolved_by_user_id, resolution, correction_deadline_at, created_at, updated_at
             FROM report_batches
            WHERE sku = ? AND status = 'PENDING'
            LIMIT 1`,
          sku,
        )
        .toArray(),
    );

    if (!batch) {
      const batchId = crypto.randomUUID();
      state.storage.sql.exec(
        `INSERT INTO report_batches (
           batch_id, sku, product_name, status, first_report_at, created_at, updated_at
         ) VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`,
        batchId,
        sku,
        skuRow.product_name,
        at,
        at,
        at,
      );
      batch = {
        batch_id: batchId,
        sku,
        product_name: skuRow.product_name,
        status: "PENDING",
        first_report_at: at,
        resolved_at: null,
        resolved_by_user_id: null,
        resolution: null,
        correction_deadline_at: null,
        created_at: at,
        updated_at: at,
      };
    }

    const ticketId = crypto.randomUUID();
    const withdrawDeadline = addMs(at, WITHDRAW_WINDOW_MS);
    state.storage.sql.exec(
      `INSERT INTO report_tickets (
         ticket_id, batch_id, picker_user_id, picker_employee_code, sku, status,
         reported_at, withdraw_deadline_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)`,
      ticketId,
      batch.batch_id,
      actor.user_id,
      actor.employee_code,
      sku,
      at,
      withdrawDeadline,
      at,
      at,
    );
    const eventId = event(state, actor, "REPORT_CREATED", batch.batch_id, ticketId, { sku }, at);
    audit(state, actor, "REPORT_CREATE", "REPORT_TICKET", ticketId, { batch_id: batch.batch_id, sku }, at);

    const payload = {
      status: "reported",
      ticket: {
        ticket_id: ticketId,
        batch_id: batch.batch_id,
        sku,
        product_name: batch.product_name,
        reported_at: at,
        withdraw_deadline_at: withdrawDeadline,
        status: "OPEN",
      },
      event_id: eventId,
    };
    storeIdempotency(state, scope, requestId, payload, at);
    return { status: 201, payload } satisfies BusinessResult;
  });
}

function pickerReports(state: DurableObjectState, url: URL): BusinessResult {
  const userId = String(url.searchParams.get("user_id") || "").trim();
  const employeeCode = String(url.searchParams.get("employee_code") || "").trim();
  const limit = normalizeLimit(url.searchParams.get("limit"), 50);
  if (!userId || !employeeCode) return { status: 400, payload: { error: "INVALID_INPUT" } };
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT t.ticket_id, t.batch_id, t.sku, b.product_name, t.status,
              t.reported_at, t.withdraw_deadline_at, t.withdrawn_at, t.resolved_at,
              b.status AS batch_status, b.resolution, b.correction_deadline_at
         FROM report_tickets t
         JOIN report_batches b ON b.batch_id = t.batch_id
        WHERE t.picker_user_id = ? OR t.picker_employee_code = ?
        ORDER BY t.reported_at DESC
        LIMIT ?`,
      userId,
      employeeCode,
      limit,
    )
    .toArray();
  return { status: 200, payload: { items: rows, count: rows.length } };
}

async function withdrawReport(state: DurableObjectState, request: Request): Promise<BusinessResult> {
  const body = (await request.json()) as { actor?: Actor; request_id?: string; ticket_id?: string };
  const actor = body.actor;
  const requestId = normalizeRequestId(body.request_id);
  const ticketId = String(body.ticket_id || "").trim();
  if (!actor?.user_id || !actor.employee_code || !requestId || !ticketId) {
    return { status: 400, payload: { error: "INVALID_INPUT" } };
  }

  return state.storage.transactionSync(() => {
    const scope = `report_withdraw:${actor.user_id}`;
    const replay = readIdempotency(state, scope, requestId);
    if (replay) return { status: 200, payload: { ...replay, idempotent_replay: true } } satisfies BusinessResult;

    const ticket = firstRow(
      state.storage.sql
        .exec<TicketRow>(
          `SELECT ticket_id, batch_id, picker_user_id, picker_employee_code, sku, status,
                  reported_at, withdraw_deadline_at, withdrawn_at, resolved_at
             FROM report_tickets
            WHERE ticket_id = ? AND (picker_user_id = ? OR picker_employee_code = ?)
            LIMIT 1`,
          ticketId,
          actor.user_id,
          actor.employee_code,
        )
        .toArray(),
    );
    if (!ticket) return { status: 404, payload: { error: "TICKET_NOT_FOUND" } } satisfies BusinessResult;
    if (ticket.status !== "OPEN") return { status: 409, payload: { error: "TICKET_NOT_OPEN", status: ticket.status } } satisfies BusinessResult;

    const at = nowIso();
    if (Date.parse(at) > Date.parse(ticket.withdraw_deadline_at)) {
      return { status: 409, payload: { error: "WITHDRAW_WINDOW_EXPIRED", withdraw_deadline_at: ticket.withdraw_deadline_at } } satisfies BusinessResult;
    }

    state.storage.sql.exec(
      `UPDATE report_tickets
          SET status = 'WITHDRAWN', withdrawn_at = ?, updated_at = ?
        WHERE ticket_id = ?`,
      at,
      at,
      ticketId,
    );
    const eventId = event(state, actor, "REPORT_WITHDRAWN", ticket.batch_id, ticketId, { sku: ticket.sku }, at);
    audit(state, actor, "REPORT_WITHDRAW", "REPORT_TICKET", ticketId, { batch_id: ticket.batch_id, sku: ticket.sku }, at);

    const remaining = firstRow(
      state.storage.sql
        .exec<SqlRow>("SELECT COUNT(*) AS count FROM report_tickets WHERE batch_id = ? AND status = 'OPEN'", ticket.batch_id)
        .toArray(),
    );
    if (Number(remaining?.count || 0) === 0) {
      state.storage.sql.exec(
        `UPDATE report_batches
            SET status = 'CLOSED', updated_at = ?
          WHERE batch_id = ? AND status = 'PENDING'`,
        at,
        ticket.batch_id,
      );
    }

    const payload = { status: "withdrawn", ticket_id: ticketId, batch_id: ticket.batch_id, withdrawn_at: at, event_id: eventId };
    storeIdempotency(state, scope, requestId, payload, at);
    return { status: 200, payload } satisfies BusinessResult;
  });
}

function reporterQueue(state: DurableObjectState, url: URL): BusinessResult {
  const limit = normalizeLimit(url.searchParams.get("limit"), 100);
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at,
              COUNT(t.ticket_id) AS affected_picker_count,
              MIN(t.reported_at) AS earliest_ticket_at
         FROM report_batches b
         JOIN report_tickets t ON t.batch_id = b.batch_id AND t.status = 'OPEN'
        WHERE b.status = 'PENDING'
        GROUP BY b.batch_id, b.sku, b.product_name, b.status, b.first_report_at
        ORDER BY affected_picker_count DESC, b.first_report_at ASC
        LIMIT ?`,
      limit,
    )
    .toArray();
  return { status: 200, payload: { items: rows, count: rows.length } };
}

async function resolveBatch(state: DurableObjectState, request: Request): Promise<BusinessResult> {
  const body = (await request.json()) as {
    actor?: Actor;
    request_id?: string;
    batch_id?: string;
    resolution?: string;
  };
  const actor = body.actor;
  const requestId = normalizeRequestId(body.request_id);
  const batchId = String(body.batch_id || "").trim();
  const resolution = String(body.resolution || "").trim();
  if (!actor?.user_id || !requestId || !batchId || !["HAS_STOCK", "SKIP_ALLOWED"].includes(resolution)) {
    return { status: 400, payload: { error: "INVALID_INPUT" } };
  }

  return state.storage.transactionSync(() => {
    const scope = `batch_resolve:${actor.user_id}`;
    const replay = readIdempotency(state, scope, requestId);
    if (replay) return { status: 200, payload: { ...replay, idempotent_replay: true } } satisfies BusinessResult;

    const batch = firstRow(
      state.storage.sql
        .exec<BatchRow>(
          `SELECT batch_id, sku, product_name, status, first_report_at, resolved_at,
                  resolved_by_user_id, resolution, correction_deadline_at, created_at, updated_at
             FROM report_batches WHERE batch_id = ? LIMIT 1`,
          batchId,
        )
        .toArray(),
    );
    if (!batch) return { status: 404, payload: { error: "BATCH_NOT_FOUND" } } satisfies BusinessResult;
    if (batch.status !== "PENDING") return { status: 409, payload: { error: "BATCH_NOT_PENDING", status: batch.status } } satisfies BusinessResult;

    const at = nowIso();
    const correctionDeadline = resolution === "SKIP_ALLOWED" ? addMs(at, CORRECTION_WINDOW_MS) : null;
    const openCountRow = firstRow(
      state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS count FROM report_tickets WHERE batch_id = ? AND status = 'OPEN'", batchId).toArray(),
    );
    const affected = Number(openCountRow?.count || 0);
    if (affected < 1) return { status: 409, payload: { error: "BATCH_HAS_NO_OPEN_TICKETS" } } satisfies BusinessResult;

    state.storage.sql.exec(
      `UPDATE report_batches
          SET status = ?, resolution = ?, resolved_at = ?, resolved_by_user_id = ?,
              correction_deadline_at = ?, updated_at = ?
        WHERE batch_id = ?`,
      resolution,
      resolution,
      at,
      actor.user_id,
      correctionDeadline,
      at,
      batchId,
    );
    state.storage.sql.exec(
      `UPDATE report_tickets
          SET status = 'RESOLVED', resolved_at = ?, updated_at = ?
        WHERE batch_id = ? AND status = 'OPEN'`,
      at,
      at,
      batchId,
    );
    const eventId = event(
      state,
      actor,
      "BATCH_RESOLVED",
      batchId,
      null,
      { resolution, affected_picker_count: affected, correction_deadline_at: correctionDeadline },
      at,
    );
    audit(state, actor, "BATCH_RESOLVE", "REPORT_BATCH", batchId, { resolution, affected_picker_count: affected }, at);

    const payload = {
      status: "resolved",
      batch_id: batchId,
      resolution,
      affected_picker_count: affected,
      resolved_at: at,
      correction_deadline_at: correctionDeadline,
      event_id: eventId,
    };
    storeIdempotency(state, scope, requestId, payload, at);
    return { status: 200, payload } satisfies BusinessResult;
  });
}

async function correctBatch(state: DurableObjectState, request: Request): Promise<BusinessResult> {
  const body = (await request.json()) as { actor?: Actor; request_id?: string; batch_id?: string };
  const actor = body.actor;
  const requestId = normalizeRequestId(body.request_id);
  const batchId = String(body.batch_id || "").trim();
  if (!actor?.user_id || !requestId || !batchId) return { status: 400, payload: { error: "INVALID_INPUT" } };

  return state.storage.transactionSync(() => {
    const scope = `batch_correct:${actor.user_id}`;
    const replay = readIdempotency(state, scope, requestId);
    if (replay) return { status: 200, payload: { ...replay, idempotent_replay: true } } satisfies BusinessResult;

    const batch = firstRow(
      state.storage.sql
        .exec<BatchRow>(
          `SELECT batch_id, sku, product_name, status, first_report_at, resolved_at,
                  resolved_by_user_id, resolution, correction_deadline_at, created_at, updated_at
             FROM report_batches WHERE batch_id = ? LIMIT 1`,
          batchId,
        )
        .toArray(),
    );
    if (!batch) return { status: 404, payload: { error: "BATCH_NOT_FOUND" } } satisfies BusinessResult;
    if (batch.status !== "SKIP_ALLOWED" || batch.resolution !== "SKIP_ALLOWED") {
      return { status: 409, payload: { error: "BATCH_NOT_CORRECTABLE", status: batch.status, resolution: batch.resolution } } satisfies BusinessResult;
    }

    const at = nowIso();
    if (!batch.correction_deadline_at || Date.parse(at) > Date.parse(batch.correction_deadline_at)) {
      return { status: 409, payload: { error: "CORRECTION_WINDOW_EXPIRED", correction_deadline_at: batch.correction_deadline_at } } satisfies BusinessResult;
    }

    state.storage.sql.exec(
      `UPDATE report_batches
          SET status = 'HAS_STOCK', resolution = 'HAS_STOCK', resolved_at = ?,
              resolved_by_user_id = ?, correction_deadline_at = NULL, updated_at = ?
        WHERE batch_id = ?`,
      at,
      actor.user_id,
      at,
      batchId,
    );
    const eventId = event(
      state,
      actor,
      "BATCH_CORRECTED",
      batchId,
      null,
      { from: "SKIP_ALLOWED", to: "HAS_STOCK", previous_correction_deadline_at: batch.correction_deadline_at },
      at,
    );
    audit(state, actor, "BATCH_CORRECT", "REPORT_BATCH", batchId, { from: "SKIP_ALLOWED", to: "HAS_STOCK" }, at);

    const payload = { status: "corrected", batch_id: batchId, resolution: "HAS_STOCK", corrected_at: at, event_id: eventId };
    storeIdempotency(state, scope, requestId, payload, at);
    return { status: 200, payload } satisfies BusinessResult;
  });
}

function reportingRange(url: URL): { from: string; to: string; error?: string } {
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) {
    return { from, to, error: "INVALID_REPORTING_RANGE" };
  }
  if (Date.parse(to) - Date.parse(from) > 60 * 86_400_000) {
    return { from, to, error: "REPORTING_RANGE_TOO_LARGE" };
  }
  return { from, to };
}

function normalizeReportingLimit(value: string | null): number {
  const parsed = Number(value || 100);
  return Math.max(1, Math.min(500, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
}

function normalizeOffset(value: string | null): number {
  const parsed = Number(value || 0);
  return Math.max(0, Math.min(100_000, Number.isFinite(parsed) ? Math.trunc(parsed) : 0));
}

function adminDashboard(state: DurableObjectState, url: URL): BusinessResult {
  const range = reportingRange(url);
  if (range.error) return { status: 400, payload: { error: range.error, max_range_days: 60 } };
  const spanMs = Date.parse(range.to) - Date.parse(range.from);
  const bucketFormat = spanMs <= 2 * 86_400_000 ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";

  const ticketSummary = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS reports_count,
            COUNT(DISTINCT sku) AS unique_sku_count,
            COUNT(DISTINCT picker_employee_code) AS affected_picker_count
       FROM report_tickets
      WHERE reported_at >= ? AND reported_at < ?`,
    range.from, range.to,
  ).toArray()) || {};

  const pendingSummary = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(DISTINCT b.batch_id) AS pending_batch_count,
            COUNT(t.ticket_id) AS pending_picker_count
       FROM report_batches b
       LEFT JOIN report_tickets t ON t.batch_id = b.batch_id AND t.status = 'OPEN'
      WHERE b.status = 'PENDING'`,
  ).toArray()) || {};

  const resolvedSummary = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS resolved_batch_count,
            AVG((julianday(resolved_at) - julianday(first_report_at)) * 1440.0) AS avg_resolution_minutes
       FROM report_batches
      WHERE resolved_at >= ? AND resolved_at < ?
        AND status IN ('HAS_STOCK','SKIP_ALLOWED')`,
    range.from, range.to,
  ).toArray()) || {};

  const reportTimeline = state.storage.sql.exec<SqlRow>(
    `SELECT strftime(?, reported_at, '+7 hours') AS bucket, COUNT(*) AS count
       FROM report_tickets
      WHERE reported_at >= ? AND reported_at < ?
      GROUP BY bucket ORDER BY bucket ASC`,
    bucketFormat, range.from, range.to,
  ).toArray();
  const resolvedTimeline = state.storage.sql.exec<SqlRow>(
    `SELECT strftime(?, resolved_at, '+7 hours') AS bucket, COUNT(*) AS count
       FROM report_batches
      WHERE resolved_at >= ? AND resolved_at < ?
        AND status IN ('HAS_STOCK','SKIP_ALLOWED')
      GROUP BY bucket ORDER BY bucket ASC`,
    bucketFormat, range.from, range.to,
  ).toArray();
  const timelineMap = new Map<string, { bucket: string; reports: number; resolved: number }>();
  for (const row of reportTimeline) {
    const bucket = String(row.bucket || "");
    if (bucket) timelineMap.set(bucket, { bucket, reports: Number(row.count || 0), resolved: 0 });
  }
  for (const row of resolvedTimeline) {
    const bucket = String(row.bucket || "");
    if (!bucket) continue;
    const current = timelineMap.get(bucket) || { bucket, reports: 0, resolved: 0 };
    current.resolved = Number(row.count || 0);
    timelineMap.set(bucket, current);
  }

  const outcomes = state.storage.sql.exec<SqlRow>(
    `SELECT status, COUNT(*) AS count
       FROM report_batches
      WHERE first_report_at >= ? AND first_report_at < ?
      GROUP BY status ORDER BY count DESC`,
    range.from, range.to,
  ).toArray().map((row) => ({ status: String(row.status), count: Number(row.count || 0) }));

  const topSkus = state.storage.sql.exec<SqlRow>(
    `SELECT b.sku, b.product_name,
            COUNT(t.ticket_id) AS report_count,
            COUNT(DISTINCT t.picker_employee_code) AS picker_count
       FROM report_tickets t
       JOIN report_batches b ON b.batch_id = t.batch_id
      WHERE t.reported_at >= ? AND t.reported_at < ?
      GROUP BY b.sku, b.product_name
      ORDER BY report_count DESC, picker_count DESC, b.sku ASC
      LIMIT 8`,
    range.from, range.to,
  ).toArray().map((row) => ({
    sku: String(row.sku), product_name: String(row.product_name),
    report_count: Number(row.report_count || 0), picker_count: Number(row.picker_count || 0),
  }));

  return {
    status: 200,
    payload: {
      period: { from: range.from, to: range.to, bucket: spanMs <= 2 * 86_400_000 ? "hour" : "day" },
      kpis: {
        reports_count: Number(ticketSummary.reports_count || 0),
        unique_sku_count: Number(ticketSummary.unique_sku_count || 0),
        affected_picker_count: Number(ticketSummary.affected_picker_count || 0),
        pending_batch_count: Number(pendingSummary.pending_batch_count || 0),
        pending_picker_count: Number(pendingSummary.pending_picker_count || 0),
        resolved_batch_count: Number(resolvedSummary.resolved_batch_count || 0),
        avg_resolution_minutes: resolvedSummary.avg_resolution_minutes == null ? null : Math.round(Number(resolvedSummary.avg_resolution_minutes) * 10) / 10,
      },
      timeline: [...timelineMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
      outcomes,
      top_skus: topSkus,
    },
  };
}

function adminReporting(state: DurableObjectState, url: URL): BusinessResult {
  const range = reportingRange(url);
  if (range.error) return { status: 400, payload: { error: range.error, max_range_days: 60 } };
  const statusValue = String(url.searchParams.get("status") || "").trim();
  const validStatus = ["PENDING", "HAS_STOCK", "SKIP_ALLOWED", "CLOSED"].includes(statusValue) ? statusValue : "";
  const query = String(url.searchParams.get("query") || "").trim().slice(0, 500);
  const limit = normalizeReportingLimit(url.searchParams.get("limit"));
  const offset = normalizeOffset(url.searchParams.get("offset"));

  const where: string[] = ["b.first_report_at >= ?", "b.first_report_at < ?"];
  const args: SqlStorageValue[] = [range.from, range.to];
  if (validStatus) { where.push("b.status = ?"); args.push(validStatus); }
  if (query) { where.push("(b.sku LIKE ? OR b.product_name LIKE ?)"); args.push(`%${query}%`, `%${query}%`); }
  const clause = where.join(" AND ");

  const totalRow = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS total FROM report_batches b WHERE ${clause}`,
    ...args,
  ).toArray()) || {};

  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.resolved_at,
            b.resolved_by_user_id, b.resolution, b.correction_deadline_at,
            SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) AS open_ticket_count,
            COUNT(t.ticket_id) AS total_ticket_count,
            CASE WHEN b.resolved_at IS NULL THEN NULL
                 ELSE ROUND((julianday(b.resolved_at) - julianday(b.first_report_at)) * 1440.0, 1) END AS duration_minutes
       FROM report_batches b
       LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
      WHERE ${clause}
      GROUP BY b.batch_id
      ORDER BY b.first_report_at DESC, b.batch_id DESC
      LIMIT ? OFFSET ?`,
    ...args, limit, offset,
  ).toArray();

  return { status: 200, payload: { items: rows, count: rows.length, total: Number(totalRow.total || 0), limit, offset, from: range.from, to: range.to, status: validStatus, query } };
}

function adminReports(state: DurableObjectState, url: URL): BusinessResult {
  const limit = normalizeLimit(url.searchParams.get("limit"), 100);
  const status = String(url.searchParams.get("status") || "").trim();
  const validStatus = ["PENDING", "HAS_STOCK", "SKIP_ALLOWED", "CLOSED"].includes(status) ? status : null;
  const rows = validStatus
    ? state.storage.sql
        .exec<SqlRow>(
          `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.resolved_at,
                  b.resolved_by_user_id, b.resolution, b.correction_deadline_at,
                  SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) AS open_ticket_count,
                  COUNT(t.ticket_id) AS total_ticket_count
             FROM report_batches b
             LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
            WHERE b.status = ?
            GROUP BY b.batch_id
            ORDER BY b.first_report_at DESC
            LIMIT ?`,
          validStatus,
          limit,
        )
        .toArray()
    : state.storage.sql
        .exec<SqlRow>(
          `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.resolved_at,
                  b.resolved_by_user_id, b.resolution, b.correction_deadline_at,
                  SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) AS open_ticket_count,
                  COUNT(t.ticket_id) AS total_ticket_count
             FROM report_batches b
             LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
            GROUP BY b.batch_id
            ORDER BY b.first_report_at DESC
            LIMIT ?`,
          limit,
        )
        .toArray();
  return { status: 200, payload: { items: rows, count: rows.length, status: validStatus } };
}

export async function handleBusinessRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  let result: BusinessResult | null = null;

  if (request.method === "POST" && url.pathname === "/business/skus/import") result = await importSkus(state, request);
  else if (request.method === "GET" && url.pathname === "/business/skus/search") result = searchSkus(state, url);
  else if (request.method === "POST" && url.pathname === "/business/reports/create") result = await createReport(state, request);
  else if (request.method === "GET" && url.pathname === "/business/picker/reports") result = pickerReports(state, url);
  else if (request.method === "POST" && url.pathname === "/business/reports/withdraw") result = await withdrawReport(state, request);
  else if (request.method === "GET" && url.pathname === "/business/reporter/queue") result = reporterQueue(state, url);
  else if (request.method === "POST" && url.pathname === "/business/reporter/resolve") result = await resolveBatch(state, request);
  else if (request.method === "POST" && url.pathname === "/business/reporter/correct") result = await correctBatch(state, request);
  else if (request.method === "GET" && url.pathname === "/business/admin/dashboard") result = adminDashboard(state, url);
  else if (request.method === "GET" && url.pathname === "/business/admin/reporting") result = adminReporting(state, url);
  else if (request.method === "GET" && url.pathname === "/business/admin/reports") result = adminReports(state, url);

  return result ? response(result.payload, result.status) : null;
}
