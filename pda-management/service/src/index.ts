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

interface Env {
  APP_ENV: string;
  PROJECT_KEY: string;
  MANAGEMENT_SHEET_ID: string;
  REGISTRY_API_BASE: string;
  REGISTRY_SHEET_ID: string;
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

async function devicesApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  let sync = { synced: false, skipped: "" };
  let syncError = "";
  try {
    sync = await syncRegistryIfDue(env, force);
  } catch (error) {
    syncError = error instanceof Error ? error.message : "REGISTRY_SYNC_FAILED";
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const storage = await coreHealth(env);
      const configReady = Boolean(env.MANAGEMENT_SHEET_ID && env.REGISTRY_API_BASE && env.REGISTRY_SHEET_ID);
      const secretsReady = Boolean(env.PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD && env.GOOGLE_RUNTIME_SA_JSON);
      return json({
        status: storage.status === "ok" && configReady && secretsReady ? "ok" : "degraded",
        environment: env.APP_ENV,
        project: env.PROJECT_KEY,
        source_commit: env.SOURCE_COMMIT || "",
        storage,
        management_sheet_configured: Boolean(env.MANAGEMENT_SHEET_ID),
        registry_source_configured: Boolean(env.REGISTRY_API_BASE && env.REGISTRY_SHEET_ID),
        root_bootstrap_secret_configured: Boolean(env.PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD),
        google_runtime_secret_configured: Boolean(env.GOOGLE_RUNTIME_SA_JSON),
        usage_policy: {
          heartbeat: false,
          firebase: false,
          android_background_poll: false,
          auth_session_validation: "sqlite-read-only",
          registry_auto_sync: "global-5m-ttl-on-authenticated-list-request",
          registry_manual_refresh_guard: "30s-global",
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

    return json({ error: "NOT_FOUND" }, 404);
  },
};
