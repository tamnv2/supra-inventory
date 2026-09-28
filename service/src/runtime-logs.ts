interface RuntimeLogsEnv {
  INVENTORY_CORE?: DurableObjectNamespace;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  LOGS_FOLDER_ID?: string;
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
};

const SENSITIVE_KEY = /authorization|bearer|token|password|secret|private|credential|api.?key|refresh|cookie|signing|keystore|session/i;
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;
const RUNTIME_LOG_RETENTION_DAYS = 90;
const RETENTION_SWEEP_INTERVAL_MS = 6 * 60 * 60_000;
let nextRetentionSweepAt = 0;

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
} {
  const source = normalizeSource(body.source);
  const severity = normalizeSeverity(body.severity);
  const generatedAt = body.generated_at && Number.isFinite(Date.parse(body.generated_at))
    ? new Date(body.generated_at).toISOString()
    : new Date().toISOString();
  const receivedAt = new Date().toISOString();
  const device = sanitize(body.device || {}) as Record<string, unknown>;
  const deviceSlug = safeSlug(device.device_id || device.id || device.model || device.label, source.toLowerCase());
  const prefix = severity === "ERROR" ? "error_" : "";
  const filename = `${prefix}${source.toLowerCase()}_${deviceSlug}_${vietnamStamp(generatedAt)}.json`;

  const envelope: Record<string, unknown> = {
    format: "supra-inventory-runtime-log-v1",
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
  return { source, severity, filename, generatedAt, receivedAt, content };
}

export async function uploadRuntimeLog(
  env: RuntimeLogsEnv,
  actor: RuntimeLogActor,
  body: RuntimeLogBody,
): Promise<Record<string, unknown>> {
  const { source, severity, filename, generatedAt, receivedAt, content } = logEnvelope(actor, body);

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

    const duplicateParams = new URLSearchParams({
      q: `'${env.LOGS_FOLDER_ID}' in parents and trashed = false and name = '${filename.replaceAll("'", "\\'")}'`,
      orderBy: "createdTime desc",
      pageSize: "1",
      spaces: "drive",
      fields: "files(id,name,createdTime,size)",
    });
    const duplicateResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${duplicateParams.toString()}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (duplicateResponse.ok) {
      const duplicatePayload = (await duplicateResponse.json()) as { files?: Array<Record<string, unknown>> };
      const existing = duplicatePayload.files?.[0];
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
        };
      }
    }

    const boundary = `supra_inventory_${crypto.randomUUID().replaceAll("-", "")}`;
    const metadata = JSON.stringify({
      name: filename,
      parents: [env.LOGS_FOLDER_ID],
      mimeType: "application/json",
      appProperties: { project: "supra-inventory", source, severity },
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

export async function uploadAgentRuntimeLogText(
  env: RuntimeLogsEnv,
  filenameValue: string,
  contentValue: string,
): Promise<Record<string, unknown>> {
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  const filename = String(filenameValue || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .slice(0, 140);
  if (!filename || (!filename.startsWith("agent_") && !filename.startsWith("crash_agent_"))) {
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
  const duplicateParams = new URLSearchParams({
    q: `'${env.LOGS_FOLDER_ID}' in parents and trashed = false and name = '${filename.replaceAll("'", "\\'")}'`,
    orderBy: "createdTime desc",
    pageSize: "1",
    spaces: "drive",
    fields: "files(id,name,createdTime,size)",
  });
  const duplicateResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${duplicateParams.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (duplicateResponse.ok) {
    const duplicatePayload = (await duplicateResponse.json()) as { files?: Array<Record<string, unknown>> };
    const existing = duplicatePayload.files?.[0];
    if (existing) return { status: "already_uploaded", file: existing };
  }

  const boundary = `supra_agent_log_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [env.LOGS_FOLDER_ID],
    mimeType: "text/plain",
    appProperties: { project: "supra-inventory", source: "AGENT", severity: filename.startsWith("crash_") ? "ERROR" : "INFO" },
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
  return { status: "uploaded", file: payload };
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

