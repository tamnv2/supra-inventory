import { PdaManagementCore, type ManagementRole } from "./core";
import {
  constantTimeStringEqual,
  hashPassword,
  normalizeUsername,
  randomId,
  randomToken,
  sha256,
  validPassword,
  validUsername,
  verifyPassword,
} from "./auth-crypto";
import { readRegistryDevices } from "./registry-source";
import { readEmployees, type EmployeeRecord } from "./employee-source";
import { mirrorDeviceAndTransaction } from "./management-sheet";

interface Env {
  APP_ENV: string;
  PROJECT_KEY: string;
  MANAGEMENT_SHEET_ID: string;
  REGISTRY_API_BASE: string;
  REGISTRY_SHEET_ID: string;
  HR_SHEET_ID: string;
  HR_TAB_NAME: string;
  PDA_CORE: DurableObjectNamespace;
  PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD?: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  SOURCE_COMMIT?: string;
}

interface PublicUser {
  user_id: string;
  username: string;
  display_name: string;
  role: ManagementRole;
  status: "ACTIVE" | "DISABLED";
}

interface SessionView extends PublicUser {
  token_hash: string;
  expires_at: number;
}

const CORE_NAME = "pda-management-core";
const SESSION_MS = 12 * 60 * 60_000;
const REGISTRY_AUTO_SYNC_MS = 5 * 60_000;
const REGISTRY_FORCE_GUARD_MS = 30_000;
const HR_AUTO_SYNC_MS = 5 * 60_000;
const HR_FORCE_GUARD_MS = 30_000;

const CHANNEL_BASE = "https://github.com/tamnv2/supra-inventory/releases/download/pda-mgmt-channel";
const CHANNEL_MANIFEST_URL = CHANNEL_BASE + "/pda-mgmt-manifest.json";
const CHANNEL_APK_URL = CHANNEL_BASE + "/supra-pda-management-beta.apk";
const CHANNEL_CHECKSUM_URL = CHANNEL_BASE + "/supra-pda-management-beta.apk.sha256";

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

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function clientDeviceId(request: Request): string {
  return String(request.headers.get("x-supra-device-id") || "").trim().slice(0, 120);
}

function core(env: Env): DurableObjectStub {
  return env.PDA_CORE.get(env.PDA_CORE.idFromName(CORE_NAME));
}

async function coreJson<T>(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await core(env).fetch("https://pda-core.internal" + path, init);
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `CORE_HTTP_${response.status}`);
  return payload;
}

async function currentSession(request: Request, env: Env): Promise<SessionView | null> {
  const token = bearer(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const result = await coreJson<{ session: SessionView | null }>(
    env,
    `/auth/session?token_hash=${encodeURIComponent(tokenHash)}`,
  );
  if (!result.session || result.session.status !== "ACTIVE") return null;
  return result.session;
}

async function recordFailure(env: Env, username: string): Promise<void> {
  await coreJson(env, "/auth/failure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
  });
}

async function login(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  if (!validUsername(username) || !validPassword(password)) {
    return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không hợp lệ." }, 400);
  }

  const guard = await coreJson<{ allowed: boolean; retry_after_ms: number }>(
    env,
    `/auth/guard?username=${encodeURIComponent(username)}`,
  );
  if (!guard.allowed) {
    return json({
      error: "LOGIN_RATE_LIMITED",
      message: "Đăng nhập đang tạm khóa do nhập sai nhiều lần.",
      retry_after_ms: guard.retry_after_ms,
    }, 429);
  }

  let userResult = await coreJson<{ user: null | (PublicUser & { password_salt: string; password_hash: string }) }>(
    env,
    `/auth/user?username=${encodeURIComponent(username)}`,
  );

  if (!userResult.user) {
    const count = await coreJson<{ count: number }>(env, "/auth/user-count");
    const bootstrapSecret = env.PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD || "";
    const mayBootstrap =
      count.count === 0 &&
      username === "root" &&
      bootstrapSecret.length >= 8 &&
      constantTimeStringEqual(password, bootstrapSecret);

    if (!mayBootstrap) {
      await recordFailure(env, username);
      return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không đúng." }, 401);
    }

    const material = await hashPassword(password);
    await coreJson(env, "/auth/user/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: randomId("usr"),
        username: "root",
        display_name: "Root PDA Management",
        role: "ROOT",
        password_salt: material.salt,
        password_hash: material.hash,
      }),
    });
    userResult = await coreJson(
      env,
      `/auth/user?username=${encodeURIComponent(username)}`,
    );
  }

  const user = userResult.user;
  if (!user || user.status !== "ACTIVE" || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    await recordFailure(env, username);
    return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không đúng." }, 401);
  }

  await coreJson(env, "/auth/success", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
  });

  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = Date.now() + SESSION_MS;
  await coreJson(env, "/auth/session/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token_hash: tokenHash, user_id: user.user_id, expires_at: expiresAt }),
  });

  return json({
    token,
    expires_at: expiresAt,
    user: {
      user_id: user.user_id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      status: user.status,
    },
    device_id: clientDeviceId(request),
  });
}

async function logout(request: Request, env: Env): Promise<Response> {
  const token = bearer(request);
  if (/^[a-f0-9]{64}$/.test(token)) {
    await coreJson(env, "/auth/session/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token_hash: await sha256(token) }),
    });
  }
  return json({ logged_out: true });
}

async function usersApi(request: Request, env: Env, session: SessionView): Promise<Response> {
  if (session.role !== "ROOT") return json({ error: "FORBIDDEN" }, 403);

  if (request.method === "GET") {
    return json(await coreJson(env, "/users/list"));
  }

  if (request.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }
    const username = normalizeUsername(body.username);
    const displayName = String(body.display_name ?? "").trim().slice(0, 120);
    const password = String(body.password ?? "");
    if (!validUsername(username) || !displayName || !validPassword(password) || username === "root") {
      return json({
        error: "INVALID_USER",
        message: "Điều phối cần tài khoản hợp lệ, tên hiển thị và mật khẩu từ 8 ký tự.",
      }, 400);
    }

    const material = await hashPassword(password);
    try {
      await coreJson(env, "/auth/user/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: randomId("usr"),
          username,
          display_name: displayName,
          role: "COORDINATOR",
          password_salt: material.salt,
          password_hash: material.hash,
        }),
      });
    } catch (error) {
      if (String(error).includes("USER_EXISTS")) {
        return json({ error: "USER_EXISTS", message: "Tài khoản đã tồn tại." }, 409);
      }
      throw error;
    }

    return json({ created: true }, 201);
  }

  return json({ error: "METHOD_NOT_ALLOWED" }, 405);
}

async function syncRegistryIfDue(env: Env, force: boolean): Promise<{ synced: boolean; skipped: string }> {
  const meta = await coreJson<{
    count: number;
    registry_last_sync_ms: number;
    registry_last_attempt_ms: number;
  }>(env, "/devices/meta");
  const now = Date.now();

  if (now - meta.registry_last_attempt_ms < REGISTRY_FORCE_GUARD_MS) {
    return { synced: false, skipped: "RECENT_ATTEMPT" };
  }
  if (!force && meta.count > 0 && now - meta.registry_last_sync_ms < REGISTRY_AUTO_SYNC_MS) {
    return { synced: false, skipped: "TTL_FRESH" };
  }
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.REGISTRY_SHEET_ID) {
    return { synced: false, skipped: "REGISTRY_CONFIG_MISSING" };
  }

  await coreJson(env, "/devices/mark-attempt", { method: "POST" });
  const records = await readRegistryDevices(env.GOOGLE_RUNTIME_SA_JSON, env.REGISTRY_SHEET_ID);
  await coreJson(env, "/devices/sync", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records }),
  });
  return { synced: true, skipped: "" };
}

async function syncEmployeesIfDue(
  env: Env,
  force: boolean,
): Promise<{ synced: boolean; skipped: string }> {
  const meta = await coreJson<{
    count: number;
    hr_last_sync_ms: number;
    hr_last_attempt_ms: number;
  }>(env, "/employees/meta");
  const now = Date.now();

  if (now - meta.hr_last_attempt_ms < HR_FORCE_GUARD_MS) {
    return { synced: false, skipped: "RECENT_ATTEMPT" };
  }
  if (!force && meta.count > 0 && now - meta.hr_last_sync_ms < HR_AUTO_SYNC_MS) {
    return { synced: false, skipped: "TTL_FRESH" };
  }
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.HR_SHEET_ID || !env.HR_TAB_NAME) {
    return { synced: false, skipped: "HR_CONFIG_MISSING" };
  }

  await coreJson(env, "/employees/mark-attempt", { method: "POST" });
  const records = await readEmployees(env.GOOGLE_RUNTIME_SA_JSON, env.HR_SHEET_ID, env.HR_TAB_NAME);
  await coreJson(env, "/employees/sync", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records }),
  });
  return { synced: true, skipped: "" };
}

async function employeeByCode(env: Env, employeeCode: string): Promise<EmployeeRecord | null> {
  await syncEmployeesIfDue(env, false);
  let result = await coreJson<{ employee: EmployeeRecord | null }>(
    env,
    `/employees/find?employee_code=${encodeURIComponent(employeeCode)}`,
  );
  if (result.employee) return result.employee;

  const meta = await coreJson<{ hr_last_attempt_ms: number }>(env, "/employees/meta");
  if (Date.now() - meta.hr_last_attempt_ms >= HR_FORCE_GUARD_MS) {
    await syncEmployeesIfDue(env, true);
    result = await coreJson(
      env,
      `/employees/find?employee_code=${encodeURIComponent(employeeCode)}`,
    );
  }
  return result.employee;
}

async function coreMutation(
  env: Env,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const response = await core(env).fetch("https://pda-core.internal" + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as Record<string, unknown>;
  return { status: response.status, payload };
}

function mirrorIfPossible(
  ctx: ExecutionContext,
  env: Env,
  payload: Record<string, unknown>,
): void {
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.MANAGEMENT_SHEET_ID) return;
  if (payload.replayed === true) return;
  const device = payload.device as Record<string, unknown> | undefined;
  const transaction = payload.transaction as Record<string, unknown> | undefined;
  if (!device || !transaction) return;
  ctx.waitUntil(
    mirrorDeviceAndTransaction(
      env.GOOGLE_RUNTIME_SA_JSON,
      env.MANAGEMENT_SHEET_ID,
      device as never,
      transaction as never,
    ).catch((error) => {
      console.error("pda_management_sheet_mirror_failed", error instanceof Error ? error.message : "unknown");
    }),
  );
}

async function employeeApi(pathname: string, env: Env): Promise<Response> {
  const match = pathname.match(/^\/api\/employees\/([^/]+)$/);
  const employeeCode = match?.[1] ? decodeURIComponent(match[1]).trim() : "";
  if (!employeeCode) return json({ error: "INVALID_EMPLOYEE_CODE" }, 400);
  try {
    const employee = await employeeByCode(env, employeeCode);
    return employee
      ? json({ employee })
      : json({ error: "EMPLOYEE_NOT_FOUND", message: "Không tìm thấy nhân sự theo mã đã nhập." }, 404);
  } catch (error) {
    return json({
      error: "HR_LOOKUP_FAILED",
      message: "Không thể kiểm tra dữ liệu nhân sự lúc này.",
      detail: error instanceof Error ? error.message : "unknown",
    }, 503);
  }
}

async function deviceActionApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  session: SessionView,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/devices\/([^/]+)\/(borrow|return|status|history)$/);
  if (!match) return null;
  const serial = decodeURIComponent(match[1]).trim().toUpperCase();
  const action = match[2];
  if (!serial) return json({ error: "INVALID_SERIAL" }, 400);

  if (action === "history" && request.method === "GET") {
    try {
      const result = await coreJson(
        env,
        `/devices/history?serial=${encodeURIComponent(serial)}`,
      );
      return json(result);
    } catch (error) {
      return json({ error: "HISTORY_FAILED", message: "Không đọc được lịch sử PDA." }, 500);
    }
  }

  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const idempotencyKey = String(body.idempotency_key ?? "").trim();
  if (!idempotencyKey) {
    return json({ error: "IDEMPOTENCY_KEY_REQUIRED" }, 400);
  }
  const common = {
    serial,
    operator_user_id: session.user_id,
    operator_name: session.display_name,
    idempotency_key: idempotencyKey,
    transaction_id: randomId("txn"),
    occurred_at: new Date().toISOString(),
  };

  if (action === "borrow") {
    const employeeCode = String(body.employee_code ?? "").trim();
    if (!employeeCode) return json({ error: "EMPLOYEE_CODE_REQUIRED" }, 400);
    let employee: EmployeeRecord | null = null;
    try {
      employee = await employeeByCode(env, employeeCode);
    } catch (error) {
      return json({ error: "HR_LOOKUP_FAILED", message: "Không thể kiểm tra dữ liệu nhân sự lúc này." }, 503);
    }
    if (!employee) {
      return json({ error: "EMPLOYEE_NOT_FOUND", message: "Không tìm thấy nhân sự theo mã đã nhập." }, 404);
    }

    const result = await coreMutation(env, "/devices/borrow", {
      ...common,
      employee_code: employee.employee_code,
      employee_name: employee.full_name,
      employee_contractor: employee.contractor,
    });
    if (result.status >= 200 && result.status < 300) mirrorIfPossible(ctx, env, result.payload);
    return json(result.payload, result.status);
  }

  if (action === "return") {
    const condition = String(body.physical_condition ?? "").trim().toUpperCase();
    const note = String(body.note ?? "").trim().slice(0, 500);
    const result = await coreMutation(env, "/devices/return", {
      ...common,
      physical_condition: condition,
      note,
    });
    if (result.status >= 200 && result.status < 300) mirrorIfPossible(ctx, env, result.payload);
    return json(result.payload, result.status);
  }

  if (action === "status") {
    const usageStatus = String(body.usage_status ?? "").trim().toUpperCase();
    const condition = String(body.physical_condition ?? "UNKNOWN").trim().toUpperCase();
    const note = String(body.note ?? "").trim().slice(0, 500);
    const result = await coreMutation(env, "/devices/status", {
      ...common,
      usage_status: usageStatus,
      physical_condition: condition,
      note,
    });
    if (result.status >= 200 && result.status < 300) mirrorIfPossible(ctx, env, result.payload);
    return json(result.payload, result.status);
  }

  return null;
}

async function devicesApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  const localOnly = url.searchParams.get("local") === "1";
  let sync = { synced: false, skipped: localOnly ? "LOCAL_ONLY" : "" };
  let syncError = "";
  if (!localOnly) {
    try {
      sync = await syncRegistryIfDue(env, force);
    } catch (error) {
      syncError = error instanceof Error ? error.message : "REGISTRY_SYNC_FAILED";
    }
  }

  const list = await coreJson<{
    devices: unknown[];
    data_revision: number;
    registry_last_sync_ms: number;
  }>(env, "/devices/list");

  return json({
    ...list,
    registry_sync: sync,
    ...(syncError ? { registry_sync_error: syncError } : {}),
  });
}

async function releaseManifest(): Promise<Response> {
  const upstream = await fetch(CHANNEL_MANIFEST_URL, {
    headers: {
      "accept": "application/json",
      "user-agent": "SUPRA-PDA-Management-Beta-Worker",
    },
  });
  if (!upstream.ok) {
    return json({ error: "UPDATE_CHANNEL_UNAVAILABLE", upstream_status: upstream.status }, 503);
  }

  const raw = await upstream.text();
  try {
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    const versionCode = Number(manifest.version_code || 0);
    const tag = String(manifest.tag || "");
    const versionName = String(manifest.version_name || "");
    if (
      versionCode <= 0 ||
      tag !== `pda-mgmt-beta-vc${versionCode}` ||
      versionName !== `0.1.0-beta.${versionCode}`
    ) {
      return json({ error: "UPDATE_CHANNEL_INVALID" }, 502);
    }
  } catch {
    return json({ error: "UPDATE_CHANNEL_INVALID_JSON" }, 502);
  }

  return new Response(raw, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}

async function coreHealth(env: Env): Promise<Record<string, unknown>> {
  try {
    const response = await core(env).fetch("https://pda-core.internal/health");
    return await response.json() as Record<string, unknown>;
  } catch {
    return { status: "unavailable" };
  }
}

export { PdaManagementCore };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const storage = await coreHealth(env);
      const configReady = Boolean(
        env.MANAGEMENT_SHEET_ID &&
        env.REGISTRY_API_BASE &&
        env.REGISTRY_SHEET_ID &&
        env.HR_SHEET_ID &&
        env.HR_TAB_NAME
      );
      const secretsReady = Boolean(env.PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD && env.GOOGLE_RUNTIME_SA_JSON);
      return json({
        status: storage.status === "ok" && configReady && secretsReady ? "ok" : "degraded",
        environment: env.APP_ENV,
        project: env.PROJECT_KEY,
        source_commit: env.SOURCE_COMMIT || "",
        storage,
        management_sheet_configured: Boolean(env.MANAGEMENT_SHEET_ID),
        registry_source_configured: Boolean(env.REGISTRY_API_BASE && env.REGISTRY_SHEET_ID),
        hr_source_configured: Boolean(env.HR_SHEET_ID && env.HR_TAB_NAME),
        root_bootstrap_secret_configured: Boolean(env.PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD),
        google_runtime_secret_configured: Boolean(env.GOOGLE_RUNTIME_SA_JSON),
        usage_policy: {
          heartbeat: false,
          firebase: false,
          android_background_poll: false,
          auth_session_validation: "sqlite-read-only",
          registry_auto_sync: "global-5m-ttl-on-authenticated-list-request",
          registry_manual_refresh_guard: "30s-global",
          hr_lookup_cache: "global-5m-ttl__force-on-miss-guarded-30s",
          mutations: "event-driven-idempotent",
          sheet: "mirror-not-critical-path",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/downloads/app/manifest") return releaseManifest();
    if (request.method === "GET" && url.pathname === "/downloads/app/latest") return Response.redirect(CHANNEL_APK_URL, 302);
    if (request.method === "GET" && url.pathname === "/downloads/app/latest.sha256") return Response.redirect(CHANNEL_CHECKSUM_URL, 302);

    if (request.method === "POST" && url.pathname === "/api/auth/login") return login(request, env);
    if (request.method === "POST" && url.pathname === "/api/auth/logout") return logout(request, env);

    if (request.method === "GET" && url.pathname === "/api/config") {
      return json({
        app_scope: "PDA_MANAGEMENT",
        environment: env.APP_ENV,
        registry_mode: "GLOBAL_TTL_5M_MANUAL_GUARD_30S",
        offline_mutation: false,
      });
    }

    const session = await currentSession(request, env);
    if (!session) return json({ error: "UNAUTHORIZED", message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." }, 401);

    if (url.pathname === "/api/me" && request.method === "GET") {
      return json({
        user: {
          user_id: session.user_id,
          username: session.username,
          display_name: session.display_name,
          role: session.role,
          status: session.status,
        },
        expires_at: session.expires_at,
      });
    }

    if (url.pathname === "/api/users") return usersApi(request, env, session);
    if (url.pathname === "/api/devices" && request.method === "GET") return devicesApi(request, env);
    if (url.pathname.startsWith("/api/employees/") && request.method === "GET") {
      return employeeApi(url.pathname, env);
    }

    const deviceAction = await deviceActionApi(request, env, ctx, session);
    if (deviceAction) return deviceAction;

    return json({ error: "NOT_FOUND" }, 404);
  },
};
