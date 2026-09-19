type SqlRow = Record<string, SqlStorageValue>;

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function limitOf(value: string | null): number {
  const parsed = Number(value || 100);
  return Math.max(1, Math.min(250, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
}

function checkpoint(state: DurableObjectState): Record<string, number> {
  const row = state.storage.sql.exec<SqlRow>("SELECT cursor_value FROM archive_checkpoints WHERE stream_name = 'archive_v1' LIMIT 1").toArray()[0];
  if (row?.cursor_value) {
    try {
      const parsed = JSON.parse(String(row.cursor_value)) as Record<string, number>;
      return {
        manifest_row: Math.max(2, Number(parsed.manifest_row || 2)),
        batches_row: Math.max(2, Number(parsed.batches_row || 2)),
        tickets_row: Math.max(2, Number(parsed.tickets_row || 2)),
        events_row: Math.max(2, Number(parsed.events_row || 2)),
      };
    } catch {}
  }
  return { manifest_row: 2, batches_row: 2, tickets_row: 2, events_row: 2 };
}

function candidates(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"));
  const batches = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.resolved_at,
            b.resolved_by_user_id, b.resolution, b.correction_deadline_at, b.version,
            b.previous_batch_id, b.last_report_at, b.created_at, b.updated_at
       FROM report_batches b
       LEFT JOIN archive_exports a ON a.batch_id = b.batch_id
      WHERE a.batch_id IS NULL AND b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')
      ORDER BY COALESCE(b.resolved_at, b.updated_at) ASC, b.batch_id ASC
      LIMIT ?`,
    limit,
  ).toArray();

  const items = batches.map((batch) => {
    const batchId = String(batch.batch_id);
    const tickets = state.storage.sql.exec<SqlRow>(
      `SELECT ticket_id, batch_id, picker_user_id, picker_employee_code, sku, status,
              reported_at, withdraw_deadline_at, withdrawn_at, resolved_at,
               auto_skip_deadline_at, auto_skip_allowed_at, resolution, resolution_source,
               created_at, updated_at
         FROM report_tickets WHERE batch_id = ? ORDER BY reported_at ASC, ticket_id ASC`, batchId,
    ).toArray();
    const acknowledgements = state.storage.sql.exec<SqlRow>(
      `SELECT result_event_id, target_user_id, received_at, displayed_at, acknowledged_at, created_at, updated_at
         FROM result_acknowledgements
        WHERE batch_id = ?
        ORDER BY result_event_id ASC, target_user_id ASC`,
      batchId,
    ).toArray();
    const acknowledgementMap = new Map<string, SqlRow[]>();
    for (const acknowledgement of acknowledgements) {
      const eventId = String(acknowledgement.result_event_id || "");
      const list = acknowledgementMap.get(eventId) || [];
      list.push(acknowledgement);
      acknowledgementMap.set(eventId, list);
    }
    const events = state.storage.sql.exec<SqlRow>(
      `SELECT e.event_id, e.batch_id, e.ticket_id, e.event_type, e.actor_user_id, e.actor_employee_code,
              e.payload_json, e.created_at,
              s.batch_version, s.resolution AS result_resolution, s.result_at
         FROM report_events e
         LEFT JOIN result_event_snapshots s ON s.result_event_id = e.event_id
        WHERE e.batch_id = ?
        ORDER BY e.created_at ASC, e.event_id ASC`,
      batchId,
    ).toArray().map((event) => ({
      ...event,
      acknowledgements_json: JSON.stringify(acknowledgementMap.get(String(event.event_id || "")) || []),
    }));
    return { batch, tickets, events };
  });
  return response({ items, count: items.length, checkpoint: checkpoint(state) });
}

async function markArchived(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    archive_run_id?: string;
    manifest_id?: string;
    batch_ids?: string[];
    checkpoint?: Record<string, number>;
  };
  const runId = String(body.archive_run_id || "").trim();
  const manifestId = String(body.manifest_id || "").trim();
  const batchIds = Array.isArray(body.batch_ids) ? [...new Set(body.batch_ids.map(String).map((v) => v.trim()).filter(Boolean))] : [];
  const next = body.checkpoint;
  if (!runId || !manifestId || !batchIds.length || !next) return response({ error: "INVALID_ARCHIVE_MARK" }, 400);
  const at = new Date().toISOString();
  state.storage.transactionSync(() => {
    for (const batchId of batchIds) {
      const batch = state.storage.sql.exec<SqlRow>("SELECT status FROM report_batches WHERE batch_id = ? LIMIT 1", batchId).toArray()[0];
      if (!batch || !["HAS_STOCK","SKIP_ALLOWED","CLOSED"].includes(String(batch.status))) throw new Error(`archive_batch_not_final:${batchId}`);
      state.storage.sql.exec(
        `INSERT OR IGNORE INTO archive_exports (batch_id, archive_run_id, manifest_id, archived_at) VALUES (?, ?, ?, ?)`,
        batchId, runId, manifestId, at,
      );
    }
    state.storage.sql.exec(
      `INSERT INTO archive_checkpoints (stream_name, cursor_value, last_exported_at, last_success_at, last_error, updated_at)
       VALUES ('archive_v1', ?, ?, ?, NULL, ?)
       ON CONFLICT(stream_name) DO UPDATE SET cursor_value=excluded.cursor_value, last_exported_at=excluded.last_exported_at,
       last_success_at=excluded.last_success_at, last_error=NULL, updated_at=excluded.updated_at`,
      JSON.stringify(next), at, at, at,
    );
  });
  return response({ status: "marked", archived: batchIds.length, archived_at: at, checkpoint: next });
}

async function markError(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { error?: string };
  const message = String(body.error || "archive_failed").slice(0, 1000);
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO archive_checkpoints (stream_name, cursor_value, last_error, updated_at)
     VALUES ('archive_v1', ?, ?, ?)
     ON CONFLICT(stream_name) DO UPDATE SET last_error=excluded.last_error, updated_at=excluded.updated_at`,
    JSON.stringify(checkpoint(state)), message, at,
  );
  return response({ status: "error_recorded", updated_at: at });
}

async function cleanup(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { cutoff_iso?: string };
  const cutoff = String(body.cutoff_iso || "").trim();
  if (!cutoff || Number.isNaN(Date.parse(cutoff))) return response({ error: "INVALID_RETENTION_CUTOFF" }, 400);
  const eligible = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id
       FROM report_batches b
       JOIN archive_exports a ON a.batch_id = b.batch_id
      WHERE b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')
        AND COALESCE(b.resolved_at, b.updated_at) < ?
      ORDER BY COALESCE(b.resolved_at, b.updated_at) ASC
      LIMIT 500`, cutoff,
  ).toArray().map((row) => String(row.batch_id));
  if (!eligible.length) return response({ status: "cleanup_complete", deleted_batches: 0, cutoff_iso: cutoff });

  let tickets = 0, events = 0, acknowledgements = 0, resultSnapshots = 0, realtimeEvents = 0, deliveryAttempts = 0;
  state.storage.transactionSync(() => {
    for (const batchId of eligible) {
      const eventCount = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM report_events WHERE batch_id = ?", batchId).toArray()[0]?.c || 0);
      const ticketCount = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM report_tickets WHERE batch_id = ?", batchId).toArray()[0]?.c || 0);
      const ackCount = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM result_acknowledgements WHERE batch_id = ?", batchId).toArray()[0]?.c || 0);
      const snapshotCount = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM result_event_snapshots WHERE batch_id = ?", batchId).toArray()[0]?.c || 0);
      const realtimeCount = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM realtime_events WHERE batch_id = ?", batchId).toArray()[0]?.c || 0);
      const attemptCount = Number(state.storage.sql.exec<SqlRow>(
        `SELECT COUNT(*) AS c
           FROM notification_delivery_attempts
          WHERE event_id IN (SELECT event_id FROM report_events WHERE batch_id = ?)`,
        batchId,
      ).toArray()[0]?.c || 0);

      state.storage.sql.exec(
        `DELETE FROM notification_delivery_attempts
          WHERE event_id IN (SELECT event_id FROM report_events WHERE batch_id = ?)`,
        batchId,
      );
      state.storage.sql.exec("DELETE FROM result_acknowledgements WHERE batch_id = ?", batchId);
      state.storage.sql.exec("DELETE FROM result_event_snapshots WHERE batch_id = ?", batchId);
      state.storage.sql.exec("DELETE FROM realtime_events WHERE batch_id = ?", batchId);
      state.storage.sql.exec("DELETE FROM report_events WHERE batch_id = ?", batchId);
      state.storage.sql.exec("DELETE FROM report_tickets WHERE batch_id = ?", batchId);
      state.storage.sql.exec("DELETE FROM report_batches WHERE batch_id = ?", batchId);

      events += eventCount;
      tickets += ticketCount;
      acknowledgements += ackCount;
      resultSnapshots += snapshotCount;
      realtimeEvents += realtimeCount;
      deliveryAttempts += attemptCount;
    }
  });
  return response({
    status: "cleanup_complete",
    deleted_batches: eligible.length,
    deleted_tickets: tickets,
    deleted_events: events,
    deleted_acknowledgements: acknowledgements,
    deleted_result_snapshots: resultSnapshots,
    deleted_realtime_events: realtimeEvents,
    deleted_delivery_attempts: deliveryAttempts,
    cutoff_iso: cutoff,
  });
}

function status(state: DurableObjectState): Response {
  const cp = state.storage.sql.exec<SqlRow>(
    `SELECT stream_name, cursor_value, last_exported_at, last_success_at, last_error, updated_at
       FROM archive_checkpoints WHERE stream_name='archive_v1' LIMIT 1`,
  ).toArray()[0] || null;
  const pending = Number(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS c FROM report_batches b LEFT JOIN archive_exports a ON a.batch_id=b.batch_id
      WHERE a.batch_id IS NULL AND b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')`,
  ).toArray()[0]?.c || 0);
  const archived = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM archive_exports").toArray()[0]?.c || 0);
  return response({ checkpoint: cp, pending_final_batches: pending, archived_batches: archived });
}

export async function handleArchiveCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/archive/candidates") return candidates(state, url);
  if (request.method === "GET" && url.pathname === "/archive/status") return status(state);
  if (request.method === "POST" && url.pathname === "/archive/mark") return markArchived(state, request);
  if (request.method === "POST" && url.pathname === "/archive/error") return markError(state, request);
  if (request.method === "POST" && url.pathname === "/archive/cleanup") return cleanup(state, request);
  return null;
}
