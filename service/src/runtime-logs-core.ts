type SqlRow = Record<string, SqlStorageValue>;

const RETENTION_DAYS = 90;
const MAX_CONTENT_CHARS = 192_000;
const VALID_SOURCE = new Set(["WEB", "ANDROID"]);
const VALID_SEVERITY = new Set(["INFO", "ERROR"]);
const LOCAL_ID_RE = /^local_[a-f0-9]{32}$/;
const FILENAME_RE = /^(scheduled|manual|error|crash)_(web|android)_[A-Za-z0-9._-]+_[0-9]{8}_[0-9]{6}\.json$/;

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

function sourceOf(value: unknown): "WEB" | "ANDROID" | null {
  const source = String(value || "").trim().toUpperCase();
  return VALID_SOURCE.has(source) ? source as "WEB" | "ANDROID" : null;
}

function severityOf(value: unknown): "INFO" | "ERROR" | null {
  const severity = String(value || "").trim().toUpperCase();
  return VALID_SEVERITY.has(severity) ? severity as "INFO" | "ERROR" : null;
}

function prune(state: DurableObjectState): void {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  state.storage.sql.exec("DELETE FROM runtime_log_buffer WHERE received_at < ?", cutoff);
}

export function initializeRuntimeLogSchema(state: DurableObjectState): void {
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS runtime_log_buffer (
      log_id TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL CHECK (source IN ('WEB','ANDROID')),
      severity TEXT NOT NULL CHECK (severity IN ('INFO','ERROR')),
      generated_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      content_text TEXT NOT NULL,
      drive_file_id TEXT,
      drive_synced_at TEXT,
      last_drive_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_runtime_log_buffer_source_received
      ON runtime_log_buffer(source, received_at DESC, log_id DESC);
    CREATE INDEX IF NOT EXISTS idx_runtime_log_buffer_drive_pending
      ON runtime_log_buffer(drive_synced_at, received_at);
  `);
}

export async function handleRuntimeLogCoreRequest(
  state: DurableObjectState,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/runtime-logs/")) return null;

  if (request.method === "POST" && url.pathname === "/runtime-logs/upsert") {
    let body: {
      filename?: unknown;
      source?: unknown;
      severity?: unknown;
      generated_at?: unknown;
      received_at?: unknown;
      content?: unknown;
    } = {};
    try {
      body = await request.json() as typeof body;
    } catch {
      return response({ error: "INVALID_JSON" }, 400);
    }

    const filename = String(body.filename || "").trim();
    const source = sourceOf(body.source);
    const severity = severityOf(body.severity);
    const generatedAt = String(body.generated_at || "").trim();
    const receivedAt = String(body.received_at || "").trim();
    const content = String(body.content || "");

    if (
      !FILENAME_RE.test(filename) ||
      !source ||
      !severity ||
      !Number.isFinite(Date.parse(generatedAt)) ||
      !Number.isFinite(Date.parse(receivedAt)) ||
      !content ||
      content.length > MAX_CONTENT_CHARS
    ) {
      return response({ error: "INVALID_RUNTIME_LOG" }, 400);
    }

    prune(state);
    const logId = "local_" + crypto.randomUUID().replaceAll("-", "");
    state.storage.sql.exec(
      `INSERT INTO runtime_log_buffer (
         log_id, filename, source, severity, generated_at, received_at,
         size_bytes, content_text, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(filename) DO UPDATE SET
         source = excluded.source,
         severity = excluded.severity,
         generated_at = excluded.generated_at,
         received_at = excluded.received_at,
         size_bytes = excluded.size_bytes,
         content_text = excluded.content_text,
         updated_at = CURRENT_TIMESTAMP`,
      logId,
      filename,
      source,
      severity,
      new Date(generatedAt).toISOString(),
      new Date(receivedAt).toISOString(),
      new TextEncoder().encode(content).byteLength,
      content,
    );
    const row = state.storage.sql.exec<SqlRow>(
      `SELECT log_id, filename, source, severity, generated_at, received_at,
              size_bytes, drive_file_id, drive_synced_at
         FROM runtime_log_buffer WHERE filename = ? LIMIT 1`,
      filename,
    ).toArray()[0];
    return response({ status: "buffered", file: row || null });
  }

  if (request.method === "GET" && url.pathname === "/runtime-logs/pending-drive") {
    prune(state);
    const limitRaw = Number(url.searchParams.get("limit") || 20);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 20));
    const retryBefore = new Date(Date.now() - 2 * 60_000).toISOString();
    const rows = state.storage.sql.exec<SqlRow>(
      `SELECT log_id, filename, source, severity, generated_at, received_at,
              size_bytes, content_text, drive_file_id, drive_synced_at, last_drive_error, updated_at
         FROM runtime_log_buffer
        WHERE drive_file_id IS NULL
          AND (last_drive_error IS NULL OR updated_at <= ?)
        ORDER BY CASE WHEN last_drive_error IS NULL THEN 0 ELSE 1 END ASC,
                 updated_at ASC, received_at ASC, log_id ASC
        LIMIT ?`,
      retryBefore,
      limit,
    ).toArray();
    return response({
      items: rows.map((row) => ({
        log_id: row.log_id,
        filename: row.filename,
        source: row.source,
        severity: row.severity,
        generated_at: row.generated_at,
        received_at: row.received_at,
        size_bytes: Number(row.size_bytes || 0),
        content: row.content_text,
        last_drive_error: row.last_drive_error || null,
      })),
      count: rows.length,
      authority: "INVENTORY_CORE_BUFFER",
    });
  }

  if (request.method === "GET" && url.pathname === "/runtime-logs/list") {
    prune(state);
    const source = sourceOf(url.searchParams.get("source"));
    if (!source) return response({ error: "INVALID_RUNTIME_LOG_SOURCE" }, 400);
    const daysRaw = Number(url.searchParams.get("days") || 30);
    const days = [30, 60, 90].includes(daysRaw) ? daysRaw : 30;
    const limitRaw = Number(url.searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50));
    const token = String(url.searchParams.get("page_token") || "").trim();
    let offset = 0;
    if (token) {
      const match = /^local:(\d{1,8})$/.exec(token);
      if (!match) return response({ error: "INVALID_LOG_PAGE_TOKEN" }, 400);
      offset = Math.max(0, Math.min(10_000_000, Number(match[1])));
    }
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = state.storage.sql.exec<SqlRow>(
      `SELECT log_id, filename, source, severity, generated_at, received_at,
              size_bytes, drive_file_id, drive_synced_at
         FROM runtime_log_buffer
        WHERE source = ? AND received_at >= ?
        ORDER BY received_at DESC, log_id DESC
        LIMIT ? OFFSET ?`,
      source,
      from,
      limit + 1,
      offset,
    ).toArray();
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    return response({
      source,
      days,
      items: visible.map((row) => ({
        id: row.log_id,
        name: row.filename,
        created_at: row.received_at,
        modified_at: row.drive_synced_at || row.received_at,
        size: Number(row.size_bytes || 0),
        severity: row.severity,
        source: row.source,
        archive_status: row.drive_file_id ? "DRIVE_SYNCED" : "LOCAL_BUFFER",
      })),
      count: visible.length,
      next_page_token: hasMore ? `local:${offset + limit}` : null,
      authority: "INVENTORY_CORE_BUFFER",
    });
  }

  if (request.method === "GET" && url.pathname === "/runtime-logs/file") {
    const logId = String(url.searchParams.get("log_id") || "").trim();
    if (!LOCAL_ID_RE.test(logId)) return response({ error: "INVALID_RUNTIME_LOG_ID" }, 400);
    const row = state.storage.sql.exec<SqlRow>(
      `SELECT log_id, filename, source, severity, generated_at, received_at,
              size_bytes, content_text, drive_file_id, drive_synced_at
         FROM runtime_log_buffer WHERE log_id = ? LIMIT 1`,
      logId,
    ).toArray()[0];
    if (!row) return response({ error: "RUNTIME_LOG_NOT_FOUND" }, 404);
    let content: unknown;
    try {
      content = JSON.parse(String(row.content_text || ""));
    } catch {
      content = { raw: String(row.content_text || "").slice(0, MAX_CONTENT_CHARS) };
    }
    return response({
      file: {
        id: row.log_id,
        name: row.filename,
        created_at: row.received_at,
        size: Number(row.size_bytes || 0),
      },
      content,
      archive_status: row.drive_file_id ? "DRIVE_SYNCED" : "LOCAL_BUFFER",
    });
  }

  if (request.method === "POST" && url.pathname === "/runtime-logs/mark-drive") {
    let body: { log_id?: unknown; drive_file_id?: unknown; error?: unknown } = {};
    try {
      body = await request.json() as typeof body;
    } catch {
      return response({ error: "INVALID_JSON" }, 400);
    }
    const logId = String(body.log_id || "").trim();
    if (!LOCAL_ID_RE.test(logId)) return response({ error: "INVALID_RUNTIME_LOG_ID" }, 400);
    const driveFileId = String(body.drive_file_id || "").trim().slice(0, 220);
    const error = String(body.error || "").trim().slice(0, 300);
    if (driveFileId) {
      state.storage.sql.exec(
        `UPDATE runtime_log_buffer
            SET drive_file_id = ?, drive_synced_at = CURRENT_TIMESTAMP,
                last_drive_error = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE log_id = ?`,
        driveFileId,
        logId,
      );
    } else {
      state.storage.sql.exec(
        `UPDATE runtime_log_buffer
            SET last_drive_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE log_id = ?`,
        error || "drive_sync_failed",
        logId,
      );
    }
    return response({ status: "marked" });
  }

  return response({ error: "not_found" }, 404);
}
