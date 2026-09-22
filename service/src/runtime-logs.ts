interface RuntimeLogsEnv {
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

function logEnvelope(actor: RuntimeLogActor, body: RuntimeLogBody): {
  source: RuntimeLogSource;
  severity: RuntimeLogSeverity;
  filename: string;
  content: string;
} {
  const source = normalizeSource(body.source);
  const severity = normalizeSeverity(body.severity);
  const generatedAt = body.generated_at && Number.isFinite(Date.parse(body.generated_at))
    ? new Date(body.generated_at).toISOString()
    : new Date().toISOString();
  const device = sanitize(body.device || {}) as Record<string, unknown>;
  const deviceSlug = safeSlug(device.device_id || device.id || device.model || device.label, source.toLowerCase());
  const prefix = severity === "ERROR" ? "error_" : "";
  const filename = `${prefix}${source.toLowerCase()}_${deviceSlug}_${vietnamStamp(generatedAt)}.json`;

  const envelope: Record<string, unknown> = {
    format: "supra-inventory-runtime-log-v1",
    generated_at: generatedAt,
    received_at: new Date().toISOString(),
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
  return { source, severity, filename, content };
}

export async function uploadRuntimeLog(
  env: RuntimeLogsEnv,
  actor: RuntimeLogActor,
  body: RuntimeLogBody,
): Promise<Record<string, unknown>> {
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  const token = await refreshGoogleAccessToken(env);
  const { source, severity, filename, content } = logEnvelope(actor, body);

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
    if (existing) {
      return {
        status: "already_uploaded",
        source,
        severity,
        file: {
          id: existing.id,
          name: existing.name || filename,
          created_at: existing.createdTime || new Date().toISOString(),
          size: Number(existing.size || content.length),
        },
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
  if (!response.ok) throw new Error(`LOGS_DRIVE_UPLOAD_FAILED:${response.status}`);
  return {
    status: "uploaded",
    source,
    severity,
    file: {
      id: payload.id,
      name: payload.name || filename,
      created_at: payload.createdTime || new Date().toISOString(),
      size: Number(payload.size || content.length),
    },
  };
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
): Promise<Record<string, unknown>> {
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  const source = normalizeSource(sourceValue);
  const limit = Math.max(1, Math.min(100, Number(limitValue || 50)));
  const token = await refreshGoogleAccessToken(env);
  const needle = source.toLowerCase() + "_";
  const params = new URLSearchParams({
    q: `'${env.LOGS_FOLDER_ID}' in parents and trashed = false and name contains '${needle}'`,
    orderBy: "createdTime desc",
    pageSize: String(limit),
    spaces: "drive",
    fields: "files(id,name,createdTime,modifiedTime,size,mimeType,appProperties)",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const payload = (await response.json()) as { files?: Array<Record<string, unknown>> };
  if (!response.ok) throw new Error(`LOGS_DRIVE_LIST_FAILED:${response.status}`);
  const seenNames = new Set<string>();
  const items = (payload.files || [])
    .filter((file) => {
      const name = String(file.name || "");
      if (!name || seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    })
    .map((file) => ({
      id: file.id,
      name: file.name,
      created_at: file.createdTime,
      modified_at: file.modifiedTime,
      size: Number(file.size || 0),
      severity: String(file.name || "").startsWith("error_") ? "ERROR" : "INFO",
      source,
    }));
  return { source, items, count: items.length };
}

export async function readRuntimeLog(env: RuntimeLogsEnv, fileId: string): Promise<Record<string, unknown>> {
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) throw new Error("LOGS_FOLDER_NOT_CONFIGURED");
  if (!FILE_ID_RE.test(fileId)) throw new Error("INVALID_LOG_FILE_ID");
  const token = await refreshGoogleAccessToken(env);
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,parents,mimeType,size,createdTime`,
    { headers: { authorization: `Bearer ${token}`, accept: "application/json" } },
  );
  const metadata = (await metadataResponse.json()) as { id?: string; name?: string; parents?: string[]; mimeType?: string; size?: string; createdTime?: string };
  if (!metadataResponse.ok) throw new Error(`LOGS_DRIVE_METADATA_FAILED:${metadataResponse.status}`);
  if (!metadata.parents?.includes(env.LOGS_FOLDER_ID) || metadata.mimeType !== "application/json") throw new Error("LOG_FILE_OUTSIDE_SCOPE");

  const contentResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
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
