interface ArchiveEnv {
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  ARCHIVE_SHEET_ID?: string;
  RETENTION_DAYS?: string;
}

type ArchiveCheckpoint = { manifest_row: number; batches_row: number; tickets_row: number; events_row: number };
type ArchiveItem = { batch: Record<string, unknown>; tickets: Record<string, unknown>[]; events: Record<string, unknown>[] };
const CORE_NAME = "inventory-core";

function core(env: ArchiveEnv): DurableObjectStub { return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_NAME)); }
function cell(value: unknown): string | number | boolean { return value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function quoteTab(name: string): string { return `'${name.replaceAll("'", "''")}'`; }

async function refreshGoogleAccessToken(env: ArchiveEnv): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) throw new Error("ARCHIVE_OAUTH_NOT_CONFIGURED");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(`ARCHIVE_OAUTH_FAILED:${payload.error_description || payload.error || response.status}`);
  return payload.access_token;
}

function range(tab: string, startRow: number, rows: unknown[][]): { range: string; majorDimension: string; values: unknown[][] } | null {
  if (!rows.length) return null;
  const width = Math.max(...rows.map((r) => r.length));
  const endRow = startRow + rows.length - 1;
  const endColumn = String.fromCharCode(64 + Math.min(26, width));
  return { range: `${quoteTab(tab)}!A${startRow}:${endColumn}${endRow}`, majorDimension: "ROWS", values: rows };
}

async function writeArchiveSheet(env: ArchiveEnv, token: string, data: unknown[]): Promise<void> {
  if (!env.ARCHIVE_SHEET_ID) throw new Error("ARCHIVE_SHEET_ID_NOT_CONFIGURED");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.ARCHIVE_SHEET_ID)}/values:batchUpdate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
  if (!response.ok) throw new Error(`ARCHIVE_SHEETS_WRITE_FAILED:${response.status}:${(await response.text()).slice(0,300)}`);
}

export async function runArchive(env: ArchiveEnv): Promise<Record<string, unknown>> {
  const runId = crypto.randomUUID();
  try {
    const candidateResponse = await core(env).fetch("https://inventory-core.internal/archive/candidates?limit=100");
    if (!candidateResponse.ok) throw new Error(`ARCHIVE_CANDIDATES_HTTP_${candidateResponse.status}`);
    const payload = (await candidateResponse.json()) as { items?: ArchiveItem[]; checkpoint?: ArchiveCheckpoint };
    const items = payload.items || [];
    const cp = payload.checkpoint || { manifest_row: 2, batches_row: 2, tickets_row: 2, events_row: 2 };
    if (!items.length) {
      const retention = await runRetention(env);
      return { status: "no_candidates", archive_run_id: runId, retention };
    }

    const manifestId = `archive:${runId}`;
    const batchRows = items.map(({ batch }) => [
      cell(batch.batch_id), cell(batch.sku), cell(batch.product_name), cell(batch.status), cell(batch.first_report_at),
      cell(batch.resolved_at), cell(batch.resolved_by_user_id), cell(batch.resolution), cell(batch.correction_deadline_at),
      cell(batch.version), cell(batch.previous_batch_id), cell(batch.last_report_at),
      cell(batch.created_at), cell(batch.updated_at), runId,
    ]);
    const ticketRows = items.flatMap(({ tickets }) => tickets.map((ticket) => [
      cell(ticket.ticket_id), cell(ticket.batch_id), cell(ticket.picker_user_id), cell(ticket.picker_employee_code), cell(ticket.sku),
      cell(ticket.status), cell(ticket.reported_at), cell(ticket.withdraw_deadline_at), cell(ticket.withdrawn_at), cell(ticket.resolved_at),
      cell(ticket.created_at), cell(ticket.updated_at), runId,
    ]));
    const eventRows = items.flatMap(({ events }) => events.map((event) => [
      cell(event.event_id), cell(event.batch_id), cell(event.ticket_id), cell(event.event_type), cell(event.actor_user_id),
      cell(event.actor_employee_code), cell(event.payload_json), cell(event.created_at),
      cell(event.batch_version), cell(event.result_resolution), cell(event.result_at), cell(event.acknowledgements_json), runId,
    ]));
    const manifestRows = [[manifestId, runId, new Date().toISOString(), items.length, ticketRows.length, eventRows.length, "COMMITTED"]];

    const headers = [
      { range: `${quoteTab("Archive_Manifest")}!A1:G1`, majorDimension: "ROWS", values: [["manifest_id","archive_run_id","archived_at","batch_count","ticket_count","event_count","status"]] },
      { range: `${quoteTab("Archive_Batches")}!A1:Q1`, majorDimension: "ROWS", values: [["batch_id","sku","product_name","status","first_report_at","resolved_at","resolved_by_user_id","resolution","resolution_source","auto_skip_deadline_at","correction_deadline_at","version","previous_batch_id","last_report_at","created_at","updated_at","archive_run_id"]] },
      { range: `${quoteTab("Archive_Tickets")}!A1:Q1`, majorDimension: "ROWS", values: [["ticket_id","batch_id","picker_user_id","picker_employee_code","sku","status","reported_at","withdraw_deadline_at","withdrawn_at","resolved_at","auto_skip_deadline_at","auto_skip_allowed_at","resolution","resolution_source","created_at","updated_at","archive_run_id"]] },
      { range: `${quoteTab("Archive_Events")}!A1:M1`, majorDimension: "ROWS", values: [["event_id","batch_id","ticket_id","event_type","actor_user_id","actor_employee_code","payload_json","created_at","batch_version","result_resolution","result_at","acknowledgements_json","archive_run_id"]] },
    ];
    const writes = [
      ...headers,
      range("Archive_Manifest", cp.manifest_row, manifestRows),
      range("Archive_Batches", cp.batches_row, batchRows),
      range("Archive_Tickets", cp.tickets_row, ticketRows),
      range("Archive_Events", cp.events_row, eventRows),
    ].filter(Boolean);
    const token = await refreshGoogleAccessToken(env);
    await writeArchiveSheet(env, token, writes);

    const next = {
      manifest_row: cp.manifest_row + manifestRows.length,
      batches_row: cp.batches_row + batchRows.length,
      tickets_row: cp.tickets_row + ticketRows.length,
      events_row: cp.events_row + eventRows.length,
    };
    const mark = await core(env).fetch("https://inventory-core.internal/archive/mark", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ archive_run_id: runId, manifest_id: manifestId, batch_ids: items.map((i) => String(i.batch.batch_id)), checkpoint: next }),
    });
    if (!mark.ok) throw new Error(`ARCHIVE_MARK_HTTP_${mark.status}`);
    const retention = await runRetention(env);
    return { status: "archived", archive_run_id: runId, batches: items.length, tickets: ticketRows.length, events: eventRows.length, retention };
  } catch (error) {
    const message = error instanceof Error ? error.message : "archive_failed";
    await core(env).fetch("https://inventory-core.internal/archive/error", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ error: message }) }).catch(() => undefined);
    throw error;
  }
}

export async function runRetention(env: ArchiveEnv): Promise<Record<string, unknown>> {
  const days = Math.max(30, Math.min(365, Number(env.RETENTION_DAYS || 60) || 60));
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const response = await core(env).fetch("https://inventory-core.internal/archive/cleanup", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cutoff_iso: cutoff }),
  });
  if (!response.ok) throw new Error(`RETENTION_HTTP_${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

export async function archiveStatus(env: ArchiveEnv): Promise<Response> {
  return core(env).fetch("https://inventory-core.internal/archive/status");
}
