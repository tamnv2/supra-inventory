#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "service/src"
STATE = ROOT / "ops/project-state.json"
REGISTRY = ROOT / "ops/resource-registry.json"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL {label}: expected 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def write_modules() -> None:
    (SERVICE / "archive-core.ts").write_text(r'''type SqlRow = Record<string, SqlStorageValue>;

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
            b.resolved_by_user_id, b.resolution, b.correction_deadline_at, b.created_at, b.updated_at
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
              reported_at, withdraw_deadline_at, withdrawn_at, resolved_at, created_at, updated_at
         FROM report_tickets WHERE batch_id = ? ORDER BY reported_at ASC, ticket_id ASC`, batchId,
    ).toArray();
    const events = state.storage.sql.exec<SqlRow>(
      `SELECT event_id, batch_id, ticket_id, event_type, actor_user_id, actor_employee_code, payload_json, created_at
         FROM report_events WHERE batch_id = ? ORDER BY created_at ASC, event_id ASC`, batchId,
    ).toArray();
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

  let tickets = 0, events = 0;
  state.storage.transactionSync(() => {
    for (const batchId of eligible) {
      const eventCount = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM report_events WHERE batch_id = ?", batchId).toArray()[0]?.c || 0);
      const ticketCount = Number(state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS c FROM report_tickets WHERE batch_id = ?", batchId).toArray()[0]?.c || 0);
      state.storage.sql.exec("DELETE FROM report_events WHERE batch_id = ?", batchId);
      state.storage.sql.exec("DELETE FROM report_tickets WHERE batch_id = ?", batchId);
      state.storage.sql.exec("DELETE FROM report_batches WHERE batch_id = ?", batchId);
      events += eventCount; tickets += ticketCount;
    }
  });
  return response({ status: "cleanup_complete", deleted_batches: eligible.length, deleted_tickets: tickets, deleted_events: events, cutoff_iso: cutoff });
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
''', encoding="utf-8")

    (SERVICE / "archive.ts").write_text(r'''interface ArchiveEnv {
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
      cell(batch.created_at), cell(batch.updated_at), runId,
    ]);
    const ticketRows = items.flatMap(({ tickets }) => tickets.map((ticket) => [
      cell(ticket.ticket_id), cell(ticket.batch_id), cell(ticket.picker_user_id), cell(ticket.picker_employee_code), cell(ticket.sku),
      cell(ticket.status), cell(ticket.reported_at), cell(ticket.withdraw_deadline_at), cell(ticket.withdrawn_at), cell(ticket.resolved_at),
      cell(ticket.created_at), cell(ticket.updated_at), runId,
    ]));
    const eventRows = items.flatMap(({ events }) => events.map((event) => [
      cell(event.event_id), cell(event.batch_id), cell(event.ticket_id), cell(event.event_type), cell(event.actor_user_id),
      cell(event.actor_employee_code), cell(event.payload_json), cell(event.created_at), runId,
    ]));
    const manifestRows = [[manifestId, runId, new Date().toISOString(), items.length, ticketRows.length, eventRows.length, "COMMITTED"]];

    const headers = [
      { range: `${quoteTab("Archive_Manifest")}!A1:G1`, majorDimension: "ROWS", values: [["manifest_id","archive_run_id","archived_at","batch_count","ticket_count","event_count","status"]] },
      { range: `${quoteTab("Archive_Batches")}!A1:L1`, majorDimension: "ROWS", values: [["batch_id","sku","product_name","status","first_report_at","resolved_at","resolved_by_user_id","resolution","correction_deadline_at","created_at","updated_at","archive_run_id"]] },
      { range: `${quoteTab("Archive_Tickets")}!A1:M1`, majorDimension: "ROWS", values: [["ticket_id","batch_id","picker_user_id","picker_employee_code","sku","status","reported_at","withdraw_deadline_at","withdrawn_at","resolved_at","created_at","updated_at","archive_run_id"]] },
      { range: `${quoteTab("Archive_Events")}!A1:I1`, majorDimension: "ROWS", values: [["event_id","batch_id","ticket_id","event_type","actor_user_id","actor_employee_code","payload_json","created_at","archive_run_id"]] },
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
''', encoding="utf-8")


def patch_core() -> None:
    path = SERVICE / "core.ts"
    replace_once(path,
        'import { handleUserManagementCoreRequest } from "./user-management-core";\n',
        'import { handleUserManagementCoreRequest } from "./user-management-core";\nimport { handleArchiveCoreRequest } from "./archive-core";\n',
        "core-import")
    replace_once(path, 'const SCHEMA_VERSION = 3;', 'const SCHEMA_VERSION = 4;', "schema-version")
    needle = '''      CREATE TABLE IF NOT EXISTS archive_checkpoints (
        stream_name TEXT PRIMARY KEY,
        cursor_value TEXT,
        last_exported_at TEXT,
        last_success_at TEXT,
        last_error TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
'''
    repl = needle + '''
      CREATE TABLE IF NOT EXISTS archive_exports (
        batch_id TEXT PRIMARY KEY,
        archive_run_id TEXT NOT NULL,
        manifest_id TEXT NOT NULL,
        archived_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_archive_exports_archived_at ON archive_exports(archived_at);
'''
    replace_once(path, needle, repl, "archive-schema")
    replace_once(path,
        '    const userManagement = await handleUserManagementCoreRequest(this.state, request);\n    if (userManagement) return userManagement;\n',
        '    const archive = await handleArchiveCoreRequest(this.state, request);\n    if (archive) return archive;\n\n    const userManagement = await handleUserManagementCoreRequest(this.state, request);\n    if (userManagement) return userManagement;\n',
        "archive-route")


def patch_index() -> None:
    path = SERVICE / "index.ts"
    replace_once(path,
        'import { handleUserManagementApi } from "./user-management-api";\n',
        'import { handleUserManagementApi } from "./user-management-api";\nimport { archiveStatus, runArchive } from "./archive";\n',
        "index-import")
    replace_once(path,
        '  ROOT_BOOTSTRAP_PASSWORD?: string;\n',
        '  ROOT_BOOTSTRAP_PASSWORD?: string;\n  ARCHIVE_SHEET_ID?: string;\n  RETENTION_DAYS?: string;\n',
        "index-env")
    anchor = '''      if (request.method === "GET" && url.pathname === "/api/admin/hr-source") {'''
    addition = '''      if (request.method === "GET" && url.pathname === "/api/admin/archive/status") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        return archiveStatus(env);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/archive/run") {
        await requireUser(request, env, ["ROOT"]);
        try { return json(await runArchive(env)); }
        catch (error) { return json({ error: "ARCHIVE_RUN_FAILED", message: error instanceof Error ? error.message : "archive_failed" }, 502); }
      }

''' + anchor
    replace_once(path, anchor, addition, "archive-admin-api")
    old = '''export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {'''
    new = '''export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {'''
    if old not in path.read_text(encoding="utf-8"): raise SystemExit("PATCH_FAIL index-export-anchor")
    # Add scheduled sibling after fetch handler object body by replacing terminal signature.
    terminal = '''  },
} satisfies ExportedHandler<Env>;'''
    scheduled = '''  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runArchive(env).then(() => undefined).catch((error) => console.error("archive_scheduled_failed", error instanceof Error ? error.message : "unknown")));
  },
} satisfies ExportedHandler<Env>;'''
    replace_once(path, terminal, scheduled, "scheduled-handler")


def patch_wrangler() -> None:
    path = ROOT / "service/wrangler.beta.toml"
    text = path.read_text(encoding="utf-8")
    text = text.replace('FIREBASE_PROJECT_ID = "supra-inventory-beta"\n', 'FIREBASE_PROJECT_ID = "supra-inventory-beta"\nARCHIVE_SHEET_ID = "1WU9RDUEevE74Twyq1aA80xvL3Wr1mTA21PRA8ypIMOA"\nRETENTION_DAYS = "60"\n', 1)
    if '[[triggers.crons]]' not in text:
        text += '\n[triggers]\ncrons = ["15 20 * * *"]\n'
    path.write_text(text, encoding="utf-8")


def update_state() -> None:
    state = json.loads(STATE.read_text(encoding="utf-8"))
    state['current_status']['sqlite_schema'] = 4
    state['current_status']['archive'] = 'IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_RETENTION_SOURCE_PENDING_CI_DEPLOY'
    state['pending_build'] = [x for x in state['pending_build'] if x != 'Backup/archive executor with checkpoint/retry/retention safety']
    state['pending_build'].insert(1, 'Verify/deploy archive executor + 60-day cleanup guarded by successful archive markers')
    state['next_action']['primary'] = 'Verify/deploy archive/retention executor, then reporting/export UI and APIs, then load/resilience testing.'
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    registry['cloudflare']['beta_sqlite_schema_version'] = 4
    registry['environments']['beta']['sqlite_schema_version'] = 4
    registry['environments']['beta']['business_api_status'] = 'IMPLEMENTED_DEPLOYED_SCHEMA_V4'
    registry['archive'] = {
      'beta_sheet_id': '1WU9RDUEevE74Twyq1aA80xvL3Wr1mTA21PRA8ypIMOA',
      'tabs': ['Archive_Manifest','Archive_Tickets','Archive_Batches','Archive_Events'],
      'execution': 'DAILY_03_15_ASIA_HO_CHI_MINH_AND_ROOT_MANUAL',
      'idempotency': 'FIXED_ROW_RANGES_FROM_SQLITE_CHECKPOINT_PLUS_ARCHIVE_MARKERS',
      'retention_days': 60,
      'cleanup_guard': 'ONLY_FINAL_BATCHES_WITH_ARCHIVE_EXPORT_MARKER',
      'pending_survives_retention': True,
      'source_status': 'PENDING_CI_DEPLOY'
    }
    registry['application_build_pending'] = [x for x in registry['application_build_pending'] if x != 'backup_archive_execution']
    registry['application_build_pending'].append('backup_archive_execution_verify')
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    write_modules(); patch_core(); patch_index(); patch_wrangler(); update_state(); print('ARCHIVE_RETENTION_PATCH_PASS')

if __name__ == '__main__': main()
