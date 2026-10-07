import { sendProjectEmail, type GoogleMailEnv } from "./google-mail";

interface LauncherPasswordEnv extends GoogleMailEnv {
  INVENTORY_CORE: DurableObjectNamespace;
}

interface InternalPasswordPayload {
  operational_date: string;
  revision: number;
  generated_at: string;
  generated_reason: "DAILY" | "RESET";
  valid_from: string;
  valid_until: string;
  valid_from_vn: string;
  valid_until_vn: string;
  reset_available_at: string;
  reset_cooldown_seconds: number;
  email_sent: boolean;
  email_sent_at: string;
  server_time: string;
  server_time_vn: string;
  timezone: string;
  daily_change_hour: string;
  email_required?: boolean;
  code?: string;
  created?: boolean;
  error?: string;
  retry_after_seconds?: number;
  valid?: boolean;
}

// Password state stays in this Durable Object so current emailed codes remain valid.
const CORE_NAME = "singleton";
// PDA registrations are stored by pda-registry.ts in a different Durable Object.
const REGISTRY_CORE_NAME = "inventory-core";
export const PROJECT_ADMIN_EMAIL = "tam95.supra@gmail.com";
const RECIPIENT = PROJECT_ADMIN_EMAIL;
const DEVICE_KEY_RE = /^[a-f0-9]{64}$/;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function core(env: LauncherPasswordEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_NAME));
}

function registryCore(env: LauncherPasswordEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(REGISTRY_CORE_NAME));
}

// Registration is checked against the actual PDA registry on each explicit admin
// operation. Never trust a client-provided "registered" flag, and fail closed
// when the authoritative registry is unavailable.
async function requireRegisteredDevice(
  env: LauncherPasswordEnv,
  deviceKey: string,
): Promise<Response | null> {
  try {
    const response = await registryCore(env).fetch(
      `https://inventory-core.internal/pda-registry/status?device_key=${encodeURIComponent(deviceKey)}`,
    );
    if (!response.ok) return json({ error: "REGISTRY_UNAVAILABLE" }, 503);
    const payload = (await response.json()) as { registered?: boolean };
    if (payload.registered !== true) {
      return json({ error: "device_not_registered" }, 403);
    }
    return null;
  } catch (error) {
    console.error("launcher_password_registry_lookup_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "REGISTRY_UNAVAILABLE" }, 503);
  }
}

async function readPayload(response: Response): Promise<InternalPasswordPayload> {
  try { return (await response.json()) as InternalPasswordPayload; }
  catch { return {} as InternalPasswordPayload; }
}

function safePayload(payload: InternalPasswordPayload): Record<string, unknown> {
  const {
    code: _code,
    email_required: _emailRequired,
    ...safe
  } = payload;
  return {
    ...safe,
    recipient: RECIPIENT,
  };
}

function mailSubject(payload: InternalPasswordPayload): string {
  return `MẬT KHẨU LAUNCHER HÀNG NGÀY - ${String(payload.code || "").trim()}`;
}

function mailBody(payload: InternalPasswordPayload): string {
  const code = String(payload.code || "");
  return [
    "SUPRA PDA Launcher",
    "",
    payload.generated_reason === "RESET"
      ? "Mã quản trị Launcher vừa được đặt lại theo yêu cầu từ một PDA."
      : "Mã quản trị Launcher hằng ngày đã được tạo.",
    "",
    `Mã: ${code}`,
    `Ngày hiệu lực: ${payload.operational_date}`,
    `Hiệu lực: ${payload.valid_from_vn} đến ${payload.valid_until_vn}`,
    "Múi giờ: Việt Nam (Asia/Ho_Chi_Minh, UTC+7)",
    "",
    "Mã gồm 4 chữ số. Không chuyển tiếp email này cho người không có quyền quản trị PDA.",
    "Mật khẩu khẩn cấp của admin vẫn hoạt động độc lập khi cần.",
  ].join("\n");
}

async function markEmailSent(env: LauncherPasswordEnv, revision: number): Promise<void> {
  const response = await core(env).fetch("https://inventory-core.internal/launcher-password/mark-email-sent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ revision }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`LAUNCHER_PASSWORD_MARK_EMAIL_HTTP_${response.status}`);
  }
}

async function deliverIfNeeded(env: LauncherPasswordEnv, payload: InternalPasswordPayload): Promise<void> {
  if (!payload.email_required || !payload.code) return;
  await sendProjectEmail(env, RECIPIENT, mailSubject(payload), mailBody(payload));
  await markEmailSent(env, Number(payload.revision || 0));
}

export async function ensureDailyLauncherPassword(env: LauncherPasswordEnv): Promise<void> {
  const response = await core(env).fetch("https://inventory-core.internal/launcher-password/ensure", {
    method: "POST",
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(`LAUNCHER_PASSWORD_ENSURE_HTTP_${response.status}`);
  await deliverIfNeeded(env, payload);
}

export function shouldRetryDailyLauncherPassword(now = new Date()): boolean {
  // Cloudflare cron runs in UTC. Add UTC+7 and inspect the resulting Vietnam wall clock.
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vn.getUTCHours() === 5 && vn.getUTCMinutes() <= 30;
}

async function ensureDailyBestEffort(env: LauncherPasswordEnv): Promise<void> {
  try {
    await ensureDailyLauncherPassword(env);
  } catch (error) {
    console.error("launcher_password_daily_delivery_failed", error instanceof Error ? error.message : "unknown");
  }
}

export async function handleLauncherPasswordApi(
  request: Request,
  env: LauncherPasswordEnv,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/launcher/password/status") {
    const deviceKey = String(url.searchParams.get("device_key") || "").trim().toLowerCase();
    if (!DEVICE_KEY_RE.test(deviceKey)) return json({ error: "INVALID_DEVICE_KEY" }, 400);
    const registrationError = await requireRegisteredDevice(env, deviceKey);
    if (registrationError) return registrationError;

    await ensureDailyBestEffort(env);
    const response = await core(env).fetch(
      `https://inventory-core.internal/launcher-password/status?device_key=${encodeURIComponent(deviceKey)}`,
    );
    const payload = await readPayload(response);
    return json(safePayload(payload), response.status);
  }

  if (request.method === "POST" && url.pathname === "/api/launcher/password/verify") {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2048) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);

    let body: { device_key?: string; code?: string } = {};
    try { body = (await request.json()) as { device_key?: string; code?: string }; }
    catch { return json({ error: "INVALID_JSON" }, 400); }

    const deviceKey = String(body.device_key || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    if (!DEVICE_KEY_RE.test(deviceKey)) return json({ error: "INVALID_DEVICE_KEY" }, 400);
    const registrationError = await requireRegisteredDevice(env, deviceKey);
    if (registrationError) return registrationError;
    if (!/^\d{4}$/.test(code)) return json({ error: "INVALID_CODE_FORMAT" }, 400);

    await ensureDailyBestEffort(env);
    const response = await core(env).fetch("https://inventory-core.internal/launcher-password/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_key: deviceKey, code }),
    });
    const payload = await readPayload(response);
    return json(safePayload(payload), response.status);
  }

  if (request.method === "POST" && url.pathname === "/api/launcher/password/reset") {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2048) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);

    let body: { device_key?: string } = {};
    try { body = (await request.json()) as { device_key?: string }; }
    catch { return json({ error: "INVALID_JSON" }, 400); }

    const deviceKey = String(body.device_key || "").trim().toLowerCase();
    if (!DEVICE_KEY_RE.test(deviceKey)) return json({ error: "INVALID_DEVICE_KEY" }, 400);
    const registrationError = await requireRegisteredDevice(env, deviceKey);
    if (registrationError) return registrationError;

    const coreResponse = await core(env).fetch("https://inventory-core.internal/launcher-password/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_key: deviceKey }),
    });
    const payload = await readPayload(coreResponse);
    if (!coreResponse.ok) return json(safePayload(payload), coreResponse.status);

    try {
      await deliverIfNeeded(env, payload);
      return json({
        ...safePayload(payload),
        status: "sent",
        message: `Đã gửi mã quản trị mới tới ${RECIPIENT}.`,
      });
    } catch (error) {
      console.error("launcher_password_reset_mail_failed", error instanceof Error ? error.message : "unknown");
      return json({
        ...safePayload(payload),
        error: "MAIL_SEND_FAILED",
        email_retry_pending: true,
        message: "Mã mới đã được tạo nhưng email chưa gửi thành công. Hệ thống sẽ tự thử gửi lại.",
      }, 502);
    }
  }

  return null;
}
