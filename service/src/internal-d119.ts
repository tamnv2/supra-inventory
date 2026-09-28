type InternalEnv = {
  APP_ENV: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  LOGS_FOLDER_ID?: string;
};

const EXPECTED_RUNTIME_EMAIL = "inventory-beta-alert-runtime@supra-inventory-beta.iam.gserviceaccount.com";
const EXPECTED_AUDIENCE = "https://inventory-beta.supra.cc.cd";
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;
const AGENT_LOG_FILENAME_RE = /^(?:agent_|scheduled_agent_|error_agent_|crash_agent_)[A-Za-z0-9._-]+_[0-9]{8}_[0-9]{6}\.log$/;
const MAX_AGENT_LOG_BYTES = 8_000_000;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function verifyRuntimeIdentity(request: Request, env: InternalEnv): Promise<boolean> {
  if (env.APP_ENV !== "beta") return false;
  const token = bearer(request);
  if (!token || token.length > 8192) return false;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    exp?: string;
  };
  const exp = Number(payload.exp || 0);
  return payload.aud === EXPECTED_AUDIENCE
    && payload.email === EXPECTED_RUNTIME_EMAIL
    && (payload.email_verified === "true" || payload.email_verified === true)
    && Number.isFinite(exp)
    && exp * 1000 > Date.now();
}

async function refreshDriveAccessToken(env: InternalEnv): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) {
    throw new Error("OAUTH_NOT_CONFIGURED");
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
  const payload = (await response.json()) as { access_token?: string };
  if (!response.ok || !payload.access_token) throw new Error("OAUTH_REFRESH_FAILED");
  return payload.access_token;
}

async function createAgentLogUploadSession(
  request: Request,
  env: InternalEnv,
): Promise<Response> {
  if (!(await verifyRuntimeIdentity(request, env))) return json({ error: "INTERNAL_IDENTITY_REQUIRED" }, 401);
  if (!env.LOGS_FOLDER_ID || !FILE_ID_RE.test(env.LOGS_FOLDER_ID)) return json({ error: "LOGS_FOLDER_NOT_CONFIGURED" }, 503);

  let body: { filename?: string; content_length?: number } = {};
  try { body = (await request.json()) as { filename?: string; content_length?: number }; } catch { body = {}; }
  const filename = String(body.filename || "").trim();
  const contentLength = Number(body.content_length || 0);
  if (!AGENT_LOG_FILENAME_RE.test(filename) || !Number.isInteger(contentLength) || contentLength < 1 || contentLength > MAX_AGENT_LOG_BYTES) {
    return json({ error: "INVALID_AGENT_LOG_UPLOAD_REQUEST" }, 400);
  }

  try {
    const token = await refreshDriveAccessToken(env);
    const duplicateParams = new URLSearchParams({
      q: `'${env.LOGS_FOLDER_ID}' in parents and trashed = false and name = '${filename.replaceAll("'", "\\'")}'`,
      orderBy: "createdTime desc",
      pageSize: "1",
      spaces: "drive",
      fields: "files(id,name)",
    });
    const duplicateResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${duplicateParams.toString()}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (duplicateResponse.ok) {
      const duplicate = (await duplicateResponse.json()) as { files?: Array<{ id?: string }> };
      const existingId = String(duplicate.files?.[0]?.id || "");
      if (existingId) return json({ status: "existing", drive_file_id: existingId });
    }

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=UTF-8",
          "x-upload-content-type": "text/plain; charset=UTF-8",
          "x-upload-content-length": String(contentLength),
        },
        body: JSON.stringify({
          name: filename,
          parents: [env.LOGS_FOLDER_ID],
          mimeType: "text/plain",
          appProperties: {
            project: "supra-inventory",
            source: "AGENT",
            transport: "GOOGLE_DIRECT_BROKERED_SESSION",
            severity: /^(?:crash_|error_)/.test(filename) ? "ERROR" : "INFO",
          },
        }),
      },
    );
    const uploadUrl = response.headers.get("location") || "";
    if (!response.ok || !uploadUrl.startsWith("https://")) {
      return json({ error: "DRIVE_UPLOAD_SESSION_FAILED", status_code: response.status }, 502);
    }
    return json({ status: "upload_required", upload_url: uploadUrl });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "DRIVE_UPLOAD_SESSION_FAILED",
    }, 502);
  }
}

function core(env: InternalEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

export async function handleD119Internal(request: Request, env: InternalEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const isRetiredSkuSync = request.method === "POST" && url.pathname === "/api/internal/d119/sku-sync";
  const isAlertWindow = request.method === "GET" && url.pathname === "/api/internal/d119/alert-window";
  const isAgentLogUploadSession = request.method === "POST" && url.pathname === "/api/internal/d146/agent-log-upload-session";
  if (isRetiredSkuSync) {
    return json({ error: "RETIRED_D126_MANUAL_FILE_ONLY" }, 410);
  }
  if (isAgentLogUploadSession) return createAgentLogUploadSession(request, env);
  if (!isAlertWindow) return null;
  if (!(await verifyRuntimeIdentity(request, env))) return json({ error: "INTERNAL_IDENTITY_REQUIRED" }, 401);
  return core(env).fetch("https://inventory-core.internal/notifications/alert-window");
}
