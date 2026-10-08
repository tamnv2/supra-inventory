import { uploadRuntimeLog } from "./runtime-logs";

interface LauncherDiagnosticEnv {
  APP_ENV: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  LOGS_FOLDER_ID?: string;
  LAUNCHER_LOGS_FOLDER_ID?: string;
}

const CORE_NAME = "inventory-core";
const DEVICE_KEY_RE = /^[a-f0-9]{64}$/;
const BOUNDARY_RE = /^launcher:[a-f0-9]{12,64}:\d{4}-\d{2}-\d{2}(?::[a-z0-9._-]{1,24})?$/;
const MAX_BODY_CHARS = 160_000;
const lastUploadByDevice = new Map<string, number>();

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

function text(value: unknown, max = 300): string {
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

async function isRegisteredDevice(env: LauncherDiagnosticEnv, deviceKey: string): Promise<boolean> {
  const core = env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_NAME));
  const response = await core.fetch(
    `https://inventory-core.internal/pda-registry/status?device_key=${encodeURIComponent(deviceKey)}`,
  );
  if (!response.ok) return false;
  const payload = await response.json() as { registered?: boolean };
  return payload.registered === true;
}

export async function handleLauncherDiagnosticLog(
  request: Request,
  env: LauncherDiagnosticEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/api/pda/launcher/logs") return null;

  if (env.APP_ENV !== "beta") return json({ error: "NOT_FOUND" }, 404);
  if (request.headers.get("x-supra-launcher-log-version") !== "1") {
    return json({ error: "LAUNCHER_LOG_HEADER_REQUIRED" }, 400);
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_BODY_CHARS) return json({ error: "LAUNCHER_LOG_TOO_LARGE" }, 413);

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  if (!raw || raw.length > MAX_BODY_CHARS) return json({ error: "LAUNCHER_LOG_TOO_LARGE" }, 413);

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  if (input.schema !== "supra-launcher-log-v1") {
    return json({ error: "INVALID_LAUNCHER_LOG_SCHEMA" }, 400);
  }

  const device = record(input.device);
  const payload = record(input.payload);
  const deviceKey = text(device.device_key, 64).toLowerCase();
  const packageName = text(device.package, 120);
  const boundaryId = text(input.boundary_id, 180);
  const generatedAt = text(input.generated_at, 80);

  if (!DEVICE_KEY_RE.test(deviceKey)
      || packageName !== "vn.supra.pdalauncher"
      || !BOUNDARY_RE.test(boundaryId)) {
    return json({ error: "INVALID_LAUNCHER_LOG_IDENTITY" }, 400);
  }

  if (!(await isRegisteredDevice(env, deviceKey))) {
    return json({ error: "PDA_NOT_REGISTERED" }, 403);
  }

  const now = Date.now();
  const previous = lastUploadByDevice.get(deviceKey) || 0;
  if (now - previous < 30_000) return json({ error: "LAUNCHER_LOG_RATE_LIMITED" }, 429);
  lastUploadByDevice.set(deviceKey, now);
  if (lastUploadByDevice.size > 512) {
    const cutoff = now - 12 * 60 * 60_000;
    for (const [key, seenAt] of lastUploadByDevice) {
      if (seenAt < cutoff) lastUploadByDevice.delete(key);
    }
  }

  const events = Array.isArray(payload.events) ? payload.events.slice(0, 180) : [];
  const summary = record(payload.summary);

  try {
    // Use an independent root folder for Launcher; preserve Inventory logs root.
    if (!env.LAUNCHER_LOGS_FOLDER_ID) return json({ error: "LAUNCHER_LOG_FOLDER_NOT_CONFIGURED" }, 503);
    const result = await uploadRuntimeLog(
      { ...env, LOGS_FOLDER_ID: env.LAUNCHER_LOGS_FOLDER_ID },
      {
        user_id: "launcher-system",
        employee_code: null,
        display_name: "SUPRA PDA Launcher",
        role: "LAUNCHER",
      },
      {
        source: "ANDROID",
        severity: text(input.severity, 16).toUpperCase() === "ERROR" ? "ERROR" : "INFO",
        reason: text(input.reason, 120) || "launcher_daily_diagnostic",
        generated_at: generatedAt,
        bundle_id: text(input.bundle_id, 64),
        boundary_id: boundaryId,
        trace_id: text(input.trace_id, 180),
        device: {
          device_id: "launcher-" + deviceKey.slice(0, 16),
          device_key: deviceKey,
          manufacturer: text(device.manufacturer, 80),
          brand: text(device.brand, 80),
          model: text(device.model, 100),
          device: text(device.device, 100),
          product: text(device.product, 100),
          hardware: text(device.hardware, 100),
          sdk_int: Number(device.sdk_int || 0),
          android_version: text(device.android_version, 40),
          package: packageName,
          version_name: text(device.version_name, 40),
          version_code: Number(device.version_code || 0),
        },
        payload: {
          schema: "supra-launcher-log-v1",
          date: text(payload.date, 20),
          upload_window: text(payload.upload_window, 80),
          summary,
          events,
          privacy: {
            raw_passwords: "NEVER_COLLECTED",
            auth_tokens: "NEVER_COLLECTED",
            imei_meid_serial_raw: "NEVER_COLLECTED_IN_LOG_PAYLOAD",
            network_identifiers: "NO_SSID_BSSID_IP",
          },
        },
      },
    );
    return json({ status: "accepted", result });
  } catch (error) {
    return json({
      error: "LAUNCHER_LOG_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "upload_failed",
    }, 502);
  }
}
