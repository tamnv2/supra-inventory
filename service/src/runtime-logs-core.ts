type SqlRow = Record<string, SqlStorageValue>;

const RETENTION_DAYS = 90;
const MAX_CONTENT_CHARS = 192_000;
const VALID_SOURCE = new Set(["WEB", "ANDROID"]);
const VALID_SEVERITY = new Set(["INFO", "ERROR"]);
const LOCAL_ID_RE = /^local_[a-f0-9]{32}$/;
const FILENAME_RE = /^(scheduled|manual|error|crash)_(web|android)_[A-Za-z0-9._-]+_[0-9]{8}_[0-9]{6}(?:_[a-f0-9]{12})?\.json$/;

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
  // D166: one atomic parent+VN-day authority shared by Worker and Apps Script.
  // Unlike two independent Drive list/create/cache paths, only this DO lease
  // holder may create the day's folder. Stored values never enter diagnostics.
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS runtime_log_daily_folders (
      parent_id TEXT NOT NULL,
      day_vn TEXT NOT NULL,
      folder_id TEXT NOT NULL DEFAULT '',
      lease_token TEXT NOT NULL DEFAULT '',
      lease_until_ms INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(parent_id, day_vn)
    );
  `);
  // Separate single-row authority for OAuth-created Launcher archive folder.
  // This is not part of the general Inventory logs parent or retention.
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS launcher_log_folder (
      singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
      folder_id TEXT NOT NULL DEFAULT '',
      lease_token TEXT NOT NULL DEFAULT '',
      lease_until_ms INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  state.storage.sql.exec(
    "INSERT OR IGNORE INTO launcher_log_folder(singleton) VALUES (1)",
  );
  const folderColumns = state.storage.sql.exec<{ name: string }>("PRAGMA table_info(launcher_log_folder)").toArray();
  if (!folderColumns.some(row => row.name === "last_error")) {
    state.storage.sql.exec("ALTER TABLE launcher_log_folder ADD COLUMN last_error TEXT NOT NULL DEFAULT ''");
  }
  // Only per-day status counts; no device keys, IP, request bodies or tokens.
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS launcher_log_ingress_counter (
      day_vn TEXT NOT NULL,
      http_status INTEGER NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0,
      last_received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(day_vn, http_status)
    )
  `);
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS launcher_log_ingress_monitor (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  state.storage.sql.exec("INSERT OR IGNORE INTO launcher_log_ingress_monitor(id) VALUES (1)");
  const columns = state.storage.sql.exec<{ name: string }>("PRAGMA table_info(runtime_log_buffer)").toArray();
  if (!columns.some((row) => row.name === "bundle_id")) {
    state.storage.sql.exec("ALTER TABLE runtime_log_buffer ADD COLUMN bundle_id TEXT");
  }
  state.storage.sql.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_log_buffer_bundle_id ON runtime_log_buffer(bundle_id) WHERE bundle_id IS NOT NULL AND bundle_id <> ''",
  );
}

export async function handleRuntimeLogCoreRequest(
  state: DurableObjectState,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/runtime-logs/")) return null;

  // D166: only same InventoryCore executes these atomically. Caller
  // authorization is enforced by Worker; do not expose this internal path.
  if (url.pathname.startsWith("/runtime-logs/day-folder")) {
    const body = request.method === "POST"
      ? await request.json().catch(() => ({})) as Record<string, unknown>
      : {};
    const parent = String(request.method === "GET" ? url.searchParams.get("parent_id") : body.parent_id || "");
    const day = String(request.method === "GET" ? url.searchParams.get("day_vn") : body.day_vn || "");
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(parent) || !/^\d{4}-\d{2}-\d{2}$/.test(day))
      return response({ error: "LOG_DAY_SCOPE_INVALID" }, 400);
    state.storage.sql.exec(
      "INSERT OR IGNORE INTO runtime_log_daily_folders(parent_id, day_vn) VALUES (?, ?)",
      parent, day,
    );
    if (request.method === "GET" && url.pathname === "/runtime-logs/day-folder") {
      const existing = state.storage.sql.exec<SqlRow>(
        "SELECT folder_id, lease_until_ms FROM runtime_log_daily_folders WHERE parent_id = ? AND day_vn = ?",
        parent, day,
      ).toArray()[0];
      return response({
        folder_id: String(existing?.folder_id || ""),
        provisioning_in_progress: Number(existing?.lease_until_ms || 0) > Date.now(),
      });
    }
    if (request.method === "POST" && url.pathname === "/runtime-logs/day-folder/lease") {
      const token = crypto.randomUUID();
      const now = Date.now();
      state.storage.sql.exec(
        `UPDATE runtime_log_daily_folders SET lease_token = ?, lease_until_ms = ?, updated_at = CURRENT_TIMESTAMP
          WHERE parent_id = ? AND day_vn = ? AND folder_id = '' AND lease_until_ms <= ?`,
        token, now + 90000, parent, day, now,
      );
      const current = state.storage.sql.exec<SqlRow>(
        "SELECT folder_id, lease_token FROM runtime_log_daily_folders WHERE parent_id = ? AND day_vn = ?",
        parent, day,
      ).toArray()[0];
      const acquired = String(current?.lease_token || "") === token;
      return response({ acquired, nonce: acquired ? token : "", folder_id: String(current?.folder_id || "") });
    }
    if (request.method === "POST" && url.pathname === "/runtime-logs/day-folder/commit") {
      const nonce = String(body.nonce || "");
      const folderId = String(body.folder_id || "");
      if (!/^[a-f0-9-]{36}$/.test(nonce) || !/^[A-Za-z0-9_-]{10,200}$/.test(folderId))
        return response({ error: "LOG_DAY_COMMIT_INVALID" }, 400);
      state.storage.sql.exec(
        `UPDATE runtime_log_daily_folders SET folder_id = ?, lease_token = '', lease_until_ms = 0,
          updated_at = CURRENT_TIMESTAMP
          WHERE parent_id = ? AND day_vn = ? AND folder_id = '' AND lease_token = ?`,
        folderId, parent, day, nonce,
      );
      const current = state.storage.sql.exec<SqlRow>(
        "SELECT folder_id FROM runtime_log_daily_folders WHERE parent_id = ? AND day_vn = ?",
        parent, day,
      ).toArray()[0];
      const selected = String(current?.folder_id || "");
      return response({ committed: selected === folderId, folder_id: selected }, selected === folderId ? 200 : 409);
    }
    if (request.method === "POST" && url.pathname === "/runtime-logs/day-folder/release") {
      const nonce = String(body.nonce || "");
      if (!/^[a-f0-9-]{36}$/.test(nonce)) return response({ error: "LOG_DAY_RELEASE_INVALID" }, 400);
      state.storage.sql.exec(
        `UPDATE runtime_log_daily_folders SET lease_token = '', lease_until_ms = 0, updated_at = CURRENT_TIMESTAMP
          WHERE parent_id = ? AND day_vn = ? AND folder_id = '' AND lease_token = ?`,
        parent, day, nonce,
      );
      return response({ released: true });
    }
    return response({ error: "LOG_DAY_ACTION_INVALID" }, 405);
  }

  if (request.method === "GET" && url.pathname === "/runtime-logs/launcher-folder") {
    const row = state.storage.sql.exec<SqlRow>(
      "SELECT folder_id, lease_until_ms, last_error, updated_at FROM launcher_log_folder WHERE singleton = 1",
    ).toArray()[0];
    return response({
      folder_id: String(row?.folder_id || ""),
      provisioning_in_progress: Number(row?.lease_until_ms || 0) > Date.now(),
      last_error: String(row?.last_error || ""),
      updated_at: String(row?.updated_at || ""),
    });
  }
  if (request.method === "POST" && url.pathname === "/runtime-logs/launcher-folder/lease") {
    const now = Date.now();
    const nonce = crypto.randomUUID();
    // Atomic compare-and-claim in the existing single InventoryCore object.
    state.storage.sql.exec(
      `UPDATE launcher_log_folder SET lease_token = ?, lease_until_ms = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE singleton = 1 AND folder_id = '' AND lease_until_ms <= ?`,
      nonce, now + 90_000, now,
    );
    const row = state.storage.sql.exec<SqlRow>(
      "SELECT folder_id, lease_token FROM launcher_log_folder WHERE singleton = 1",
    ).toArray()[0];
    return response({
      acquired: String(row?.lease_token || "") === nonce,
      folder_id: String(row?.folder_id || ""),
      nonce: String(row?.lease_token || "") === nonce ? nonce : "",
    });
  }
  if (request.method === "POST" && url.pathname === "/runtime-logs/launcher-folder/failure") {
    const body = await request.json().catch(() => ({})) as { nonce?: unknown; error?: unknown };
    const nonce = String(body.nonce || "");
    const error = String(body.error || "");
    if (!/^[a-f0-9-]{36}$/.test(nonce) || !/^LAUNCHER_FOLDER_[A-Z_]+(?:_HTTP_[0-9]{3})?$/.test(error)) {
      return response({ error: "INVALID_LAUNCHER_FOLDER_FAILURE" }, 400);
    }
    state.storage.sql.exec(
      `UPDATE launcher_log_folder SET last_error = ?, lease_token = '',
          lease_until_ms = 0, updated_at = CURRENT_TIMESTAMP
          WHERE singleton = 1 AND folder_id = '' AND lease_token = ?`,
      error, nonce,
    );
    return response({ recorded: true });
  }
  if (request.method === "POST" && url.pathname === "/runtime-logs/launcher-folder/commit") {
    const body = await request.json().catch(() => ({})) as { nonce?: unknown; folder_id?: unknown };
    const folderId = String(body.folder_id || "").trim();
    const nonce = String(body.nonce || "").trim();
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(folderId) || !/^[a-f0-9-]{36}$/.test(nonce)) {
      return response({ error: "INVALID_LAUNCHER_FOLDER_COMMIT" }, 400);
    }
    state.storage.sql.exec(
      `UPDATE launcher_log_folder SET folder_id = ?, lease_token = '',
         lease_until_ms = 0, last_error = '', updated_at = CURRENT_TIMESTAMP
         WHERE singleton = 1 AND folder_id = '' AND lease_token = ?`,
      folderId, nonce,
    );
    const row = state.storage.sql.exec<SqlRow>(
      "SELECT folder_id FROM launcher_log_folder WHERE singleton = 1",
    ).toArray()[0];
    const committed = String(row?.folder_id || "") === folderId;
    return response({ committed, folder_id: String(row?.folder_id || "") }, committed ? 200 : 409);
  }

  if (request.method === "POST" && url.pathname === "/runtime-logs/upsert") {
    let body: {
      filename?: unknown;
      source?: unknown;
      severity?: unknown;
      generated_at?: unknown;
      received_at?: unknown;
      content?: unknown;
      bundle_id?: unknown;
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
    const bundleId = String(body.bundle_id || "").trim().toLowerCase();

    if (
      !FILENAME_RE.test(filename) ||
      !source ||
      !severity ||
      !Number.isFinite(Date.parse(generatedAt)) ||
      !Number.isFinite(Date.parse(receivedAt)) ||
      !content ||
      content.length > MAX_CONTENT_CHARS ||
      (bundleId && !/^[a-f0-9]{32,64}$/.test(bundleId))
    ) {
      return response({ error: "INVALID_RUNTIME_LOG" }, 400);
    }

    prune(state);
    if (bundleId) {
      const existing = state.storage.sql.exec<SqlRow>(
        "SELECT log_id, filename, source, severity, generated_at, received_at, size_bytes, drive_file_id, drive_synced_at, content_text FROM runtime_log_buffer WHERE bundle_id = ? LIMIT 1",
        bundleId,
      ).toArray()[0];
      if (existing) {
        if (String(existing.content_text || "") !== content) {
          // The envelope's received_at is regenerated on a retry. Compare
          // the actual log contents and immutable identity without that
          // server-generated timestamp before declaring a bundle conflict.
          let sameImmutablePayload = false;
          try {
            const previous = JSON.parse(String(existing.content_text || "")) as Record<string, unknown>;
            const incoming = JSON.parse(content) as Record<string, unknown>;
            delete previous.received_at;
            delete incoming.received_at;
            sameImmutablePayload = JSON.stringify(previous) === JSON.stringify(incoming);
          } catch { /* Fail closed on malformed envelopes. */ }
          if (!sameImmutablePayload) {
            return response({ error: "RUNTIME_LOG_BUNDLE_ID_CONFLICT" }, 409);
          }
        }
        const { content_text: _content, ...file } = existing;
        return response({ status: "buffered", idempotent_replay: true, file });
      }
    }
    const logId = "local_" + crypto.randomUUID().replaceAll("-", "");
    state.storage.sql.exec(
      `INSERT INTO runtime_log_buffer (
         log_id, filename, source, severity, generated_at, received_at,
         size_bytes, content_text, bundle_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
      bundleId || null,
    );
    const row = state.storage.sql.exec<SqlRow>(
      `SELECT log_id, filename, source, severity, generated_at, received_at,
              size_bytes, drive_file_id, drive_synced_at
         FROM runtime_log_buffer WHERE filename = ? LIMIT 1`,
      filename,
    ).toArray()[0];
    return response({ status: "buffered", file: row || null });
  }

  // D166: manual, ROOT-gated Worker diagnostics. Only aggregated Launcher
  // metadata; the API never exports filenames, DeviceKeys, payloads or Drive IDs.
  if (request.method === "POST" && url.pathname === "/runtime-logs/launcher-ingress-metric") {
    const body = await request.json().catch(() => ({})) as { http_status?: unknown };
    const status = Number(body.http_status);
    if (!Number.isInteger(status) || status < 200 || status > 599) {
      return response({ error: "INVALID_LAUNCHER_INGRESS_STATUS" }, 400);
    }
    const dayVn = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    state.storage.sql.exec(
      `INSERT INTO launcher_log_ingress_counter(day_vn,http_status,hit_count)
       VALUES (?,?,1)
       ON CONFLICT(day_vn,http_status) DO UPDATE SET
          hit_count=hit_count+1,last_received_at=CURRENT_TIMESTAMP`,
      dayVn, status,
    );
    return response({ recorded: true });
  }

  if (request.method === "GET" && url.pathname === "/runtime-logs/launcher-diagnostics") {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const selector = `source = 'ANDROID'
        AND (filename LIKE 'scheduled_android_launcher-%'
          OR filename LIKE 'error_android_launcher-%'
          OR filename LIKE 'crash_android_launcher-%'
          OR filename LIKE 'manual_android_launcher-%')
        AND received_at >= ?`;
    const totals = state.storage.sql.exec<SqlRow>(
      `SELECT COUNT(*) AS received,
              SUM(CASE WHEN drive_file_id IS NOT NULL AND drive_synced_at IS NOT NULL THEN 1 ELSE 0 END) AS synced,
              SUM(CASE WHEN drive_file_id IS NULL THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN drive_file_id IS NULL AND last_drive_error IS NOT NULL THEN 1 ELSE 0 END) AS failed,
              MIN(received_at) AS first_received_at, MAX(received_at) AS last_received_at
         FROM runtime_log_buffer WHERE ${selector}`, since,
    ).toArray()[0] || {};
    const failedRows = state.storage.sql.exec<SqlRow>(
      `SELECT last_drive_error FROM runtime_log_buffer
        WHERE ${selector} AND drive_file_id IS NULL AND last_drive_error IS NOT NULL
        ORDER BY received_at DESC LIMIT 30`, since,
    ).toArray();
    const errorCounts: Record<string, number> = {};
    for (const row of failedRows) {
      const raw = String(row.last_drive_error || "");
      const match = /^(LOGS_[A-Z_]+|LAUNCHER_LOG_[A-Z_]+)(?::(\d{3}))?/.exec(raw);
      const safe = match ? match[1] + (match[2] ? "_HTTP_" + match[2] : "") : "OTHER_ARCHIVE_FAILURE";
      errorCounts[safe] = (errorCounts[safe] || 0) + 1;
    }
    const ingressSince = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const ingressRows = state.storage.sql.exec<SqlRow>(
      `SELECT http_status, SUM(hit_count) AS hits, MAX(last_received_at) AS latest
       FROM launcher_log_ingress_counter WHERE day_vn >= ?
       GROUP BY http_status ORDER BY http_status`, ingressSince,
    ).toArray();
    const ingressMonitor = state.storage.sql.exec<SqlRow>(
      "SELECT started_at FROM launcher_log_ingress_monitor WHERE id = 1",
    ).toArray()[0];
    const ingressCodes: Record<string, number> = {};
    let ingressTotal = 0;
    let ingressLatest: string | null = null;
    for (const row of ingressRows) {
      const status = Number(row.http_status);
      const count = Number(row.hits || 0);
      ingressCodes[String(status)] = count;
      ingressTotal += count;
      const latest = String(row.latest || "");
      if (latest && (!ingressLatest || latest > ingressLatest)) ingressLatest = latest;
    }
    return response({
      ingress_monitor_started_at: ingressMonitor?.started_at || null,
      ingress_http_attempts: ingressTotal,
      ingress_http_statuses: ingressCodes,
      ingress_last_at: ingressLatest,
      window_days: 7,
      authority: "INVENTORY_CORE_BUFFER",
      received: Number(totals.received || 0),
      drive_synced: Number(totals.synced || 0),
      pending_drive: Number(totals.pending || 0),
      pending_with_error: Number(totals.failed || 0),
      first_received_at: totals.first_received_at || null,
      last_received_at: totals.last_received_at || null,
      recent_failure_sample_count: failedRows.length,
      recent_failure_classes: errorCounts,
      checked_at: new Date().toISOString(),
    });
  }

  // Minimal receipt lookup for the PDA client. Never return log contents,
  // Drive IDs or employee/device details to an unauthenticated caller.
  // A receipt is only valid for the registered DeviceKey that uploaded it.
  if (request.method === "GET" && url.pathname === "/runtime-logs/launcher-archive-status") {
    const bundleId = String(url.searchParams.get("bundle_id") || "").trim().toLowerCase();
    const deviceKey = String(url.searchParams.get("device_key") || "").trim().toLowerCase();
    if (!/^[a-f0-9]{32,64}$/.test(bundleId) || !/^[a-f0-9]{64}$/.test(deviceKey)) {
      return response({ error: "INVALID_LAUNCHER_ARCHIVE_RECEIPT" }, 400);
    }
    const row = state.storage.sql.exec<SqlRow>(
      "SELECT drive_file_id, drive_synced_at, content_text FROM runtime_log_buffer WHERE bundle_id = ? LIMIT 1",
      bundleId,
    ).toArray()[0];
    if (!row) return response({ status: "NOT_FOUND", archived: false }, 404);
    try {
      const log = JSON.parse(String(row.content_text || "")) as Record<string, unknown>;
      const device = log.device && typeof log.device === "object"
        ? log.device as Record<string, unknown> : {};
      if (String(log.actor && typeof log.actor === "object"
          ? (log.actor as Record<string, unknown>).user_id : "") !== "launcher-system"
          || String(device.device_key || "").toLowerCase() !== deviceKey) {
        return response({ status: "NOT_FOUND", archived: false }, 404);
      }
    } catch {
      return response({ status: "NOT_FOUND", archived: false }, 404);
    }
    const archived = Boolean(row.drive_file_id && row.drive_synced_at);
    return response({ status: archived ? "DRIVE_SYNCED" : "BUFFERED", archived });
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
