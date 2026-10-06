import { uploadRuntimeLog } from "./runtime-logs";

interface PdaManagementDiagnosticEnv {
  APP_ENV: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  LOGS_FOLDER_ID?: string;
}

const DEVICE_HASH_RE = /^[a-f0-9]{64}$/;
const MAX_BODY_CHARS = 190_000;
const lastUploadByIdentity = new Map<string, number>();

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(value: unknown, max = 500): string {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function handlePdaManagementDiagnosticLog(
  request: Request,
  env: PdaManagementDiagnosticEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/api/diagnostics/pda-management/upload") return null;
  if (env.APP_ENV !== "beta") return json({ error: "NOT_FOUND" }, 404);
  if (request.headers.get("x-supra-pda-management-log-version") !== "1") {
    return json({ error: "PDA_MANAGEMENT_LOG_HEADER_REQUIRED" }, 400);
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_BODY_CHARS) return json({ error: "PDA_MANAGEMENT_LOG_TOO_LARGE" }, 413);

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  if (!raw || raw.length > MAX_BODY_CHARS) return json({ error: "PDA_MANAGEMENT_LOG_TOO_LARGE" }, 413);

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (input.schema !== "supra-pda-management-log-v1") {
    return json({ error: "INVALID_PDA_MANAGEMENT_LOG_SCHEMA" }, 400);
  }

  const identity = record(input.identity);
  const build = record(input.build);
  const payload = record(input.payload);
  const packageName = text(identity.package, 120);
  const deviceHash = text(identity.device_id_hash, 64).toLowerCase();
  const allowedPackage =
    packageName === "cc.supra.pdamanagement.beta" ||
    packageName === "cc.supra.pdamanagement.beta.server";
  if (!allowedPackage || !DEVICE_HASH_RE.test(deviceHash)) {
    return json({ error: "INVALID_PDA_MANAGEMENT_LOG_IDENTITY" }, 400);
  }

  const now = Date.now();
  const ip = text(request.headers.get("cf-connecting-ip") || "unknown", 80);
  const rateKey = ip + "|" + deviceHash + "|" + packageName;
  const previous = lastUploadByIdentity.get(rateKey) || 0;
  if (now - previous < 10_000) {
    return json({ error: "PDA_MANAGEMENT_LOG_RATE_LIMITED" }, 429);
  }
  lastUploadByIdentity.set(rateKey, now);
  if (lastUploadByIdentity.size > 512) {
    const cutoff = now - 60 * 60_000;
    for (const [key, seenAt] of lastUploadByIdentity) {
      if (seenAt < cutoff) lastUploadByIdentity.delete(key);
    }
  }

  const events = Array.isArray(payload.events) ? payload.events.slice(-800) : [];
  const reasonRaw = text(input.reason, 120).toLowerCase();
  const reason = reasonRaw.startsWith("pda_management_")
    ? reasonRaw
    : "pda_management_manual";
  const severity = text(input.severity, 16).toUpperCase() === "ERROR" ? "ERROR" : "INFO";

  const allowedPayload = {
    schema: "supra-pda-management-log-v1",
    project: "PDA_MANAGEMENT",
    runtime: record(payload.runtime),
    network: record(payload.network),
    summary: record(payload.summary),
    events,
    server_error: record(payload.server_error),
    privacy: {
      passwords: "NEVER_ACCEPTED",
      auth_tokens: "NEVER_ACCEPTED",
      cookies: "NEVER_ACCEPTED",
      private_keys: "NEVER_ACCEPTED",
      raw_android_id: "NEVER_ACCEPTED",
    },
  };

  try {
    const result = await uploadRuntimeLog(
      env,
      {
        user_id: "pda-management-diagnostic",
        employee_code: null,
        display_name: "SUPRA PDA Management",
        role: "PDA_MANAGEMENT",
      },
      {
        source: packageName.endsWith(".server") ? "WEB" : "ANDROID",
        severity,
        reason,
        generated_at: text(input.generated_at, 80),
        bundle_id: text(input.bundle_id, 64),
        boundary_id: text(input.boundary_id, 180),
        trace_id: text(input.trace_id, 180),
        device: {
          device_id: "pda-management-" + deviceHash.slice(0, 16),
          manufacturer: text(build.manufacturer, 80),
          brand: text(build.brand, 80),
          model: text(build.model, 100),
          sdk_int: Number(build.sdk_int || 0),
          android_version: text(build.android_version, 40),
          package: packageName,
          version_name: text(build.version_name, 60),
          version_code: Number(build.version_code || 0),
          source_commit: text(build.source_commit, 80),
        },
        payload: allowedPayload,
      },
    );
    return json({ status: "accepted", archive: result });
  } catch (error) {
    return json({
      error: "PDA_MANAGEMENT_LOG_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "upload_failed",
    }, 502);
  }
}
