interface RuntimeLogsEnv {
  INVENTORY_CORE?: DurableObjectNamespace;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  LOGS_FOLDER_ID?: string;
  LAUNCHER_LOGS_FOLDER_ID?: string;
}

export type RuntimeLogActor = {
  user_id: string;
  employee_code: string | null;
  display_name: string;
  role: string;
};

export type RuntimeLogSource = "WEB" | "ANDROID";
export type RuntimeLogSeverity = "INFO" | "ERROR";

type RuntimeLogBody = {
  source?: string;
  severity?: string;
  reason?: string;
  generated_at?: string;
  device?: Record<string, unknown>;
  payload?: unknown;
  bundle_id?: string;
  boundary_id?: string;
  trace_id?: string;
};

const SENSITIVE_KEY = /authorization|bearer|token|password|secret|private|credential|api.?key|refresh|cookie|signing|keystore|session/i;
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;
const RUNTIME_LOG_RETENTION_DAYS = 90;
const RETENTION_SWEEP_INTERVAL_MS = 6 * 60 * 60_000;
let nextRetentionSweepAt = 0;
const dailyFolderCache = new Map<string, { id: string; expiresAt: number }>();
const DAILY_FOLDER_CACHE_MS = 6 * 60 * 60_000;

function vietnamDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function driveQueryEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export async function resolveRuntimeLogDailyFolder(
  env: RuntimeLogsEnv,
  token: string,
  archiveDate = new Date(),
): Promise<{ id: string; dateKey: string }> {
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  const dateKey = vietnamDateKey(archiveDate);
  const cacheKey = `${env.LOGS_FOLDER_ID}:${dateKey}`;
  const cached = dailyFolderCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && FILE_ID_RE.test(cached.id)) {
    return { id: cached.id, dateKey };
  }

  const query = [
    `'${driveQueryEscape(env.LOGS_FOLDER_ID)}' in parents`,
    "trashed = false",
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${driveQueryEscape(dateKey)}'`,

  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    orderBy: "createdTime asc",
    pageSize: "2",
    spaces: "drive",
    fields: "files(id,name,createdTime,appProperties)",
  });
  const listed = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!listed.ok) throw new Error(`LOGS_DAILY_FOLDER_LIST_FAILED:${listed.status}`);
  const payload = await listed.json() as { files?: Array<{ id?: string }> };
  let id = String(payload.files?.[0]?.id || "");

  if (!FILE_ID_RE.test(id)) {
    const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,createdTime,appProperties", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        name: dateKey,
        parents: [env.LOGS_FOLDER_ID],
        mimeType: "application/vnd.google-apps.folder",
        appProperties: {
          project: "supra-inventory",
          kind: "runtime-log-day",
          archive_date: dateKey,
        },
      }),
    });
    const createdPayload = await created.json() as { id?: string };
    if (!created.ok || !FILE_ID_RE.test(String(createdPayload.id || ""))) {
      throw new Error(`LOGS_DAILY_FOLDER_CREATE_FAILED:${created.status}`);
    }
    const createdId = String(createdPayload.id);
    const converge = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!converge.ok) throw new Error(`LOGS_DAILY_FOLDER_CONVERGE_FAILED:${converge.status}`);
    const convergePayload = await converge.json() as { files?: Array<{ id?: string }> };
    id = String(convergePayload.files?.[0]?.id || createdId);
    if (FILE_ID_RE.test(id) && id !== createdId) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(createdId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  }

  dailyFolderCache.set(cacheKey, { id, expiresAt: Date.now() + DAILY_FOLDER_CACHE_MS });
  return { id, dateKey };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function archiveIdentityFromEnvelope(content: string, fallbackLogId: string): Promise<{
  archiveId: string;
  bundleId: string;
  boundaryId: string;
}> {
  let bundleId = "";
  let boundaryId = "";
  let source = "";
  let actorId = "";
  let deviceId = "";
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const rawBundle = String(parsed.bundle_id || "").trim().toLowerCase();
    if (/^[a-f0-9]{32,64}$/.test(rawBundle)) bundleId = rawBundle;
    const rawBoundary = String(parsed.boundary_id || "").trim();
    if (/^[A-Za-z0-9._:-]{1,180}$/.test(rawBoundary)) boundaryId = rawBoundary;
    source = String(parsed.source || "").trim().toUpperCase();
    const actor = parsed.actor && typeof parsed.actor === "object" ? parsed.actor as Record<string, unknown> : {};
    const device = parsed.device && typeof parsed.device === "object" ? parsed.device as Record<string, unknown> : {};
    actorId = String(actor.user_id || "").trim();
    deviceId = String(device.device_id || device.id || device.model || device.label || "").trim();
  } catch {
    // Legacy payloads use local buffer identity only.
  }
  const logicalBoundary = boundaryId
    ? await sha256Hex(`${source}|${actorId}|${deviceId}|${boundaryId}`)
    : "";
  return {
    archiveId: bundleId
      ? `bundle:${bundleId}`
      : logicalBoundary
        ? `boundary:${logicalBoundary}`
        : `runtime:${fallbackLogId}`,
    bundleId,
    boundaryId,
  };
}

async function findArchivedByIdentity(
  folderId: string,
  token: string,
  archiveId: string,
): Promise<Record<string, unknown> | null> {
  const query = [
    `'${driveQueryEscape(folderId)}' in parents`,
    "trashed = false",
    `appProperties has { key='archive_id' and value='${driveQueryEscape(archiveId)}' }`,
  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    orderBy: "createdTime desc",
    pageSize: "1",
    spaces: "drive",
    fields: "files(id,name,createdTime,size,appProperties)",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`LOGS_ARCHIVE_IDENTITY_LOOKUP_FAILED:${response.status}`);
  const payload = await response.json() as { files?: Array<Record<string, unknown>> };
  return payload.files?.[0] || null;
}

async function findArchivedByFilename(
  folderId: string,
  token: string,
  filename: string,
): Promise<Record<string, unknown> | null> {
  const query = [
    `'${driveQueryEscape(folderId)}' in parents`,
    "trashed = false",
    `name = '${driveQueryEscape(filename)}'`,
  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    orderBy: "createdTime desc",
    pageSize: "1",
    spaces: "drive",
    fields: "files(id,name,createdTime,size,appProperties)",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`LOGS_FILENAME_LOOKUP_FAILED:${response.status}`);
  const payload = await response.json() as { files?: Array<Record<string, unknown>> };
  return payload.files?.[0] || null;
}

async function maybeCleanupRuntimeLogs(env: RuntimeLogsEnv, token: string): Promise<void> {
  const now = Date.now();
  if (now < nextRetentionSweepAt) return;
  nextRetentionSweepAt = now + RETENTION_SWEEP_INTERVAL_MS;
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) return;

  const cutoff = new Date(now - RUNTIME_LOG_RETENTION_DAYS * 86_400_000).toISOString();
  const params = new URLSearchParams({
    q: `'${env.LOGS_FOLDER_ID}' in parents and trashed = false and createdTime < '${cutoff}'`,
    orderBy: "createdTime asc",
    pageSize: "100",
    spaces: "drive",
    fields: "files(id,name,createdTime)",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`LOGS_RETENTION_LIST_FAILED:${response.status}`);
  const payload = await response.json() as { files?: Array<{ id?: string }> };
  for (const file of payload.files || []) {
    const id = String(file.id || "");
    if (!FILE_ID_RE.test(id)) continue;
    const deletion = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!deletion.ok && deletion.status !== 404) {
      throw new Error(`LOGS_RETENTION_DELETE_FAILED:${deletion.status}`);
    }
  }
}


function scrubText(value: string): string {
  let next = value.slice(0, 2_000);
  next = next.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]");
  next = next.replace(/Bearer\s+[A-Za-z0-9._~+\/-]{16,}/gi, "Bearer [REDACTED]");
  next = next.replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]");
  return next;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED_DEPTH]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.slice(0, 240).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 140)) {
      output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitize(item, depth + 1);
    }
    return output;
  }
  return scrubText(String(value));
}

function normalizeSource(value: unknown): RuntimeLogSource {
  return String(value || "").toUpperCase() === "ANDROID" ? "ANDROID" : "WEB";
}

function normalizeSeverity(value: unknown): RuntimeLogSeverity {
  return String(value || "").toUpperCase() === "ERROR" ? "ERROR" : "INFO";
}

function runtimeLogKind(reasonValue: unknown, severity: RuntimeLogSeverity): "scheduled" | "manual" | "error" | "crash" {
  const reason = String(reasonValue || "").trim().toLowerCase();
  if (reason.includes("crash") || reason.includes("fatal") || reason.includes("uncaught")) return "crash";
  if (severity === "ERROR") return "error";
  if (reason.includes("manual")) return "manual";
  return "scheduled";
}

function safeSlug(value: unknown, fallback: string): string {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .toLowerCase();
  return slug || fallback;
}

function vietnamStamp(input?: string): string {
  const date = input && Number.isFinite(Date.parse(input)) ? new Date(input) : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${pick("year")}${pick("month")}${pick("day")}_${pick("hour")}${pick("minute")}${pick("second")}`;
}

function core(env: RuntimeLogsEnv): DurableObjectStub {
  if (!env.INVENTORY_CORE) throw new Error("LOGS_BUFFER_NOT_CONFIGURED");
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

async function refreshGoogleAccessToken(env: RuntimeLogsEnv): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) {
    throw new Error("LOGS_OAUTH_NOT_CONFIGURED");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`LOGS_OAUTH_FAILED:${payload.error_description || payload.error || response.status}`);
  }
  return payload.access_token;
}

function archiveErrorCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : "drive_sync_failed";
  return scrubText(raw).slice(0, 300);
}

async function markDriveState(
  env: RuntimeLogsEnv,
  logId: string,
  driveFileId = "",
  error = "",
): Promise<void> {
  if (!logId) return;
  await core(env).fetch("https://inventory-core.internal/runtime-logs/mark-drive", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      log_id: logId,
      drive_file_id: driveFileId,
      error,
    }),
  }).catch(() => undefined);
}

function logEnvelope(actor: RuntimeLogActor, body: RuntimeLogBody): {
  source: RuntimeLogSource;
  severity: RuntimeLogSeverity;
  filename: string;
  generatedAt: string;
  receivedAt: string;
  content: string;
  bundleId: string;
  boundaryId: string;
  traceId: string;
} {
  const source = normalizeSource(body.source);
  const severity = normalizeSeverity(body.severity);
  const generatedAt = body.generated_at && Number.isFinite(Date.parse(body.generated_at))
    ? new Date(body.generated_at).toISOString()
    : new Date().toISOString();
  const receivedAt = new Date().toISOString();
  const device = sanitize(body.device || {}) as Record<string, unknown>;
  const deviceSlug = safeSlug(device.device_id || device.id || device.model || device.label, source.toLowerCase());
  const suppliedBundleId = String(body.bundle_id || "").trim().toLowerCase();
  const bundleId = /^[a-f0-9]{32,64}$/.test(suppliedBundleId)
    ? suppliedBundleId
    : crypto.randomUUID().replaceAll("-", "");
  const suppliedBoundaryId = String(body.boundary_id || "").trim();
  const boundaryId = /^[A-Za-z0-9._:-]{1,180}$/.test(suppliedBoundaryId) ? suppliedBoundaryId : "";
  const suppliedTraceId = String(body.trace_id || "").trim();
  const traceId = /^[A-Za-z0-9._:-]{1,180}$/.test(suppliedTraceId) ? suppliedTraceId : "";

  const kind = runtimeLogKind(body.reason, severity);
  const filename = `${kind}_${source.toLowerCase()}_${deviceSlug}_${vietnamStamp(generatedAt)}_${bundleId.slice(0, 12)}.json`;

  const envelope: Record<string, unknown> = {
    format: "supra-inventory-runtime-log-v2",
    schema_version: 2,
    bundle_id: bundleId || null,
    boundary_id: boundaryId || null,
    trace_id: traceId || null,
    generated_at: generatedAt,
    received_at: receivedAt,
    source,
    severity,
    reason: scrubText(String(body.reason || (severity === "ERROR" ? "error" : "scheduled"))),
    actor: {
      user_id: scrubText(actor.user_id),
      employee_code: actor.employee_code ? scrubText(actor.employee_code) : null,
      display_name: scrubText(actor.display_name),
      role: scrubText(actor.role),
    },
    device,
    payload: sanitize(body.payload),
    redaction: {
      sensitive_keys: "REDACTED",
      max_depth: 8,
      max_array_items: 240,
      max_object_keys: 140,
      max_string_chars: 2000,
      max_file_chars: 192000,
    },
  };

  let content = JSON.stringify(envelope, null, 2);
  if (content.length > 192_000) {
    envelope.payload = {
      truncated: true,
      excerpt: scrubText(JSON.stringify(sanitize(body.payload)).slice(0, 160_000)),
    };
    content = JSON.stringify(envelope, null, 2);
    if (content.length > 192_000) {
      envelope.payload = { truncated: true, excerpt: "[TRUNCATED_LOG_PAYLOAD]" };
      content = JSON.stringify(envelope, null, 2);
    }
  }
  return { source, severity, filename, generatedAt, receivedAt, content, bundleId, boundaryId, traceId };
}

export async function uploadRuntimeLog(
  env: RuntimeLogsEnv,
  actor: RuntimeLogActor,
  body: RuntimeLogBody,
): Promise<Record<string, unknown>> {
  const { source, severity, filename, generatedAt, receivedAt, content, bundleId, boundaryId, traceId } = logEnvelope(actor, body);

  // D144 authority: persist the sanitized support log in InventoryCore first.
  // Google Drive is archive-only. A revoked user OAuth token must never make
  // Web Nhật ký unreadable or make Android support-log upload fail.
  const bufferedResponse = await core(env).fetch("https://inventory-core.internal/runtime-logs/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename,
      source,
      severity,
      generated_at: generatedAt,
      received_at: receivedAt,
      content,
      bundle_id: bundleId,
    }),
  });
  const buffered = await bufferedResponse.json() as {
    error?: string;
    file?: Record<string, unknown> | null;
  };
  if (!bufferedResponse.ok || !buffered.file) {
    throw new Error(`LOGS_BUFFER_FAILED:${buffered.error || bufferedResponse.status}`);
  }

  const localFile = buffered.file;
  const localId = String(localFile.log_id || "");
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) {
    await markDriveState(env, localId, "", "LOGS_FOLDER_NOT_CONFIGURED");
    return {
      status: "buffered",
      source,
      severity,
      file: {
        id: localId,
        name: filename,
        created_at: receivedAt,
        size: Number(localFile.size_bytes || content.length),
      },
      archive_status: "DEFERRED",
    };
  }

  try {
    const token = await refreshGoogleAccessToken(env);
    await maybeCleanupRuntimeLogs(env, token).catch(() => undefined);

    const daily = await resolveRuntimeLogDailyFolder(env, token, new Date(generatedAt));
    const logicalBoundary = boundaryId
      ? await sha256Hex(`${source}|${actor.user_id}|${String((sanitize(body.device || {}) as Record<string, unknown>).device_id || "")}|${boundaryId}`)
      : "";
    const archiveId = `bundle:${bundleId}`;
    const existing = await findArchivedByIdentity(daily.id, token, archiveId);
    if (existing?.id) {
      await markDriveState(env, localId, String(existing.id));
      return {
        status: "buffered_and_archived",
        source,
        severity,
        file: {
          id: localId,
          name: filename,
          created_at: receivedAt,
          size: Number(localFile.size_bytes || content.length),
        },
        archive_status: "DRIVE_SYNCED",
        archive_date: daily.dateKey,
      };
    }

    const boundary = `supra_inventory_${crypto.randomUUID().replaceAll("-", "")}`;
    const metadata = JSON.stringify({
      name: filename,
      parents: [daily.id],
      mimeType: "application/json",
      appProperties: {
        project: "supra-inventory",
        source,
        severity,
        archive_id: archiveId,
        archive_date: daily.dateKey,
        bundle_id: bundleId || "legacy",
        boundary_id_hash: logicalBoundary || "none",
        trace_id: traceId ? safeSlug(traceId, "trace") : "none",
      },
    });
    const multipart = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      content,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime,size",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      },
    );
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok || !payload.id) throw new Error(`LOGS_DRIVE_UPLOAD_FAILED:${response.status}`);
    await markDriveState(env, localId, String(payload.id));
    return {
      status: "buffered_and_archived",
      source,
      severity,
      file: {
        id: localId,
        name: filename,
        created_at: receivedAt,
        size: Number(localFile.size_bytes || content.length),
      },
      archive_status: "DRIVE_SYNCED",
      archive_date: daily.dateKey,
    };
  } catch (error) {
    await markDriveState(env, localId, "", archiveErrorCode(error));
    return {
      status: "buffered",
      source,
      severity,
      file: {
        id: localId,
        name: filename,
        created_at: receivedAt,
        size: Number(localFile.size_bytes || content.length),
      },
      archive_status: "DEFERRED",
    };
  }
}


type PendingRuntimeLogArchive = {
  log_id?: string;
  filename?: string;
  source?: string;
  severity?: string;
  content?: string;
};

async function archiveBufferedJson(
  env: RuntimeLogsEnv,
  token: string,
  item: PendingRuntimeLogArchive,
): Promise<string> {
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  const logId = String(item.log_id || "");
  const filename = String(item.filename || "");
  const source = normalizeSource(item.source);
  const severity = normalizeSeverity(item.severity);
  const content = String(item.content || "");
  if (!/^local_[a-f0-9]{32}$/.test(logId) || !filename || !content) throw new Error("INVALID_BUFFERED_RUNTIME_LOG");

  // Retain the dedicated Launcher destination even when Drive archival was
  // deferred and the server retries hours or days after initial reception.
  const isLauncher = /^scheduled_android_launcher-|^error_android_launcher-|^crash_android_launcher-/i.test(filename);
  if (isLauncher && !env.LAUNCHER_LOGS_FOLDER_ID) throw new Error("LAUNCHER_LOG_FOLDER_NOT_CONFIGURED");
  const destination = isLauncher
    ? { ...env, LOGS_FOLDER_ID: env.LAUNCHER_LOGS_FOLDER_ID }
    : env;
  let sourceDate = new Date();
  try {
    const parsed = JSON.parse(content) as { generated_at?: string };
    if (parsed.generated_at && Number.isFinite(Date.parse(parsed.generated_at))) {
      sourceDate = new Date(parsed.generated_at);
    }
  } catch { /* Reconcile legacy malformed headers under current day. */ }
  const daily = await resolveRuntimeLogDailyFolder(destination, token, sourceDate);
  const identity = await archiveIdentityFromEnvelope(content, logId);
  const archiveId = identity.archiveId;
  const existing = await findArchivedByIdentity(daily.id, token, archiveId);
  const existingId = String(existing?.id || "");
  if (existingId) return existingId;

  const boundary = `supra_runtime_retry_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [daily.id],
    mimeType: "application/json",
    appProperties: {
      project: "supra-inventory",
      source,
      severity,
      archive_id: archiveId,
      archive_date: daily.dateKey,
      bundle_id: identity.bundleId || "legacy",
      boundary_id_hash: identity.boundaryId ? await sha256Hex(identity.boundaryId) : "none",
    },
  });
  const multipart = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime,size",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    },
  );
  const payload = (await response.json()) as { id?: string };
  if (!response.ok || !payload.id) throw new Error(`LOGS_DRIVE_RETRY_UPLOAD_FAILED:${response.status}`);
  return payload.id;
}

export async function retryBufferedRuntimeLogArchives(
  env: RuntimeLogsEnv,
  limit = 20,
): Promise<{ pending: number; synced: number; failed: number }> {
  if (!env.INVENTORY_CORE || !env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) {
    return { pending: 0, synced: 0, failed: 0 };
  }
  const pendingResponse = await core(env).fetch(
    `https://inventory-core.internal/runtime-logs/pending-drive?limit=${Math.max(1, Math.min(50, Math.trunc(limit || 20)))}`,
  );
  const pendingPayload = await pendingResponse.json() as { items?: PendingRuntimeLogArchive[] };
  if (!pendingResponse.ok) throw new Error(`LOGS_PENDING_READ_FAILED:${pendingResponse.status}`);
  const items = Array.isArray(pendingPayload.items) ? pendingPayload.items : [];
  if (!items.length) return { pending: 0, synced: 0, failed: 0 };

  let token: string;
  try {
    token = await refreshGoogleAccessToken(env);
  } catch (error) {
    const code = archiveErrorCode(error);
    await Promise.all(items.map((item) => markDriveState(env, String(item.log_id || ""), "", code)));
    return { pending: items.length, synced: 0, failed: items.length };
  }

  await maybeCleanupRuntimeLogs(env, token).catch(() => undefined);
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    const logId = String(item.log_id || "");
    try {
      const driveId = await archiveBufferedJson(env, token, item);
      await markDriveState(env, logId, driveId);
      synced += 1;
    } catch (error) {
      await markDriveState(env, logId, "", archiveErrorCode(error));
      failed += 1;
    }
  }
  return { pending: items.length, synced, failed };
}

export async function uploadAgentRuntimeLogText(
  env: RuntimeLogsEnv,
  filenameValue: string,
  contentValue: string,
): Promise<Record<string, unknown>> {
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  const filename = String(filenameValue || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .slice(0, 140);
  if (!filename || !/^(?:agent_|scheduled_agent_|error_agent_|crash_agent_)[A-Za-z0-9._-]+_[0-9]{8}_[0-9]{6}\.log$/.test(filename)) {
    throw new Error("INVALID_AGENT_LOG_FILENAME");
  }

  let content = String(contentValue || "");
  if (content.length > 8_000_000) content = content.slice(content.length - 8_000_000);
  content = content
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]{16,}/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]");

  const token = await refreshGoogleAccessToken(env);
  await maybeCleanupRuntimeLogs(env, token).catch(() => undefined);
  const daily = await resolveRuntimeLogDailyFolder(env, token);
  const archiveId = `agent:${await sha256Hex(filename + "\n" + content)}`;
  const existing = await findArchivedByIdentity(daily.id, token, archiveId)
    || await findArchivedByFilename(daily.id, token, filename);
  if (existing) return { status: "already_uploaded", archive_status: "DRIVE_SYNCED", file: existing, archive_date: daily.dateKey };

  const boundary = `supra_agent_log_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [daily.id],
    mimeType: "text/plain",
    appProperties: {
      project: "supra-inventory",
      source: "AGENT",
      severity: /^(?:crash_|error_)/.test(filename) ? "ERROR" : "INFO",
      archive_id: archiveId,
      archive_date: daily.dateKey,
    },
  });
  const multipart = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime,size",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    },
  );
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`AGENT_LOGS_DRIVE_UPLOAD_FAILED:${response.status}`);
  return { status: "uploaded", archive_status: "DRIVE_SYNCED", file: payload, archive_date: daily.dateKey };
}

export async function listRuntimeLogs(
  env: RuntimeLogsEnv,
  sourceValue: string,
  limitValue: number,
  daysValue = 30,
  pageTokenValue = "",
): Promise<Record<string, unknown>> {
  const source = normalizeSource(sourceValue);
  const limit = Math.max(1, Math.min(500, Number(limitValue || 100)));
  const days = [30, 60, 90].includes(Number(daysValue)) ? Number(daysValue) : 30;
  const pageToken = String(pageTokenValue || "").trim();
  if (pageToken.length > 2048) throw new Error("INVALID_LOG_PAGE_TOKEN");

  const params = new URLSearchParams({
    source,
    limit: String(limit),
    days: String(days),
  });
  if (pageToken) params.set("page_token", pageToken);
  const response = await core(env).fetch(
    `https://inventory-core.internal/runtime-logs/list?${params.toString()}`,
  );
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`LOGS_BUFFER_LIST_FAILED:${String(payload.error || response.status)}`);
  return payload;
}

export async function readRuntimeLog(env: RuntimeLogsEnv, fileId: string): Promise<Record<string, unknown>> {
  const id = String(fileId || "").trim();
  if (/^local_[a-f0-9]{32}$/.test(id)) {
    const response = await core(env).fetch(
      `https://inventory-core.internal/runtime-logs/file?log_id=${encodeURIComponent(id)}`,
    );
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(`LOGS_BUFFER_READ_FAILED:${String(payload.error || response.status)}`);
    return payload;
  }

  // Compatibility read for Drive-backed IDs that may be opened from an older
  // browser state. New D144 list pages use InventoryCore local IDs.
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  if (!FILE_ID_RE.test(id)) throw new Error("INVALID_LOG_FILE_ID");
  const token = await refreshGoogleAccessToken(env);
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,parents,mimeType,size,createdTime`,
    { headers: { authorization: `Bearer ${token}`, accept: "application/json" } },
  );
  const metadata = (await metadataResponse.json()) as { id?: string; name?: string; parents?: string[]; mimeType?: string; size?: string; createdTime?: string };
  if (!metadataResponse.ok) throw new Error(`LOGS_DRIVE_METADATA_FAILED:${metadataResponse.status}`);
  if (!metadata.parents?.includes(env.LOGS_FOLDER_ID) || metadata.mimeType !== "application/json") throw new Error("LOG_FILE_OUTSIDE_SCOPE");

  const contentResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
    { headers: { authorization: `Bearer ${token}`, accept: "application/json" } },
  );
  if (!contentResponse.ok) throw new Error(`LOGS_DRIVE_READ_FAILED:${contentResponse.status}`);
  const text = (await contentResponse.text()).slice(0, 210_000);
  let content: unknown;
  try { content = JSON.parse(text); } catch { content = { raw: scrubText(text) }; }
  return {
    file: {
      id: metadata.id,
      name: metadata.name,
      created_at: metadata.createdTime,
      size: Number(metadata.size || 0),
    },
    content: sanitize(content),
  };
}

