import { InventoryCore } from "./core";
import { createFirebaseCustomToken, hashPassword, readBearerToken, verifyFirebaseIdToken, verifyPassword, type AppRole } from "./auth";
import { handleBusinessApi } from "./business-api";
import { handleReadApi } from "./read-api";
import { handleNotificationApi } from "./notification-api";
import { handleUserManagementApi } from "./user-management-api";
import { archiveStatus, runArchive } from "./archive";
import { validateHrSheetSource } from "./hr-source";

export { InventoryCore };

interface Env {
  APP_ENV: string;
  PROJECT_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  INVENTORY_CORE: DurableObjectNamespace;
  ASSETS?: Fetcher;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REDIRECT_URI?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  ROOT_BOOTSTRAP_PASSWORD?: string;
  ARCHIVE_SHEET_ID?: string;
  RETENTION_DAYS?: string;
}

interface InternalUser {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: AppRole;
  status: "ACTIVE" | "DISABLED";
  password_salt: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
}

interface FirebaseExchangeResponse {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  localId?: string;
  error?: { message?: string };
}

interface FirebaseRefreshResponse {
  id_token?: string;
  refresh_token?: string;
  expires_in?: string;
  user_id?: string;
  error?: { message?: string };
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const OAUTH_STATE_COOKIE = "inventory_oauth_state";
const CORE_OBJECT_NAME = "inventory-core";
const REQUIRED_RUNTIME_BINDINGS = [
  "GOOGLE_RUNTIME_SA_JSON",
  "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
  "GOOGLE_DRIVE_OAUTH_REDIRECT_URI",
  "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_WEB_API_KEY",
] as const;

function json(payload: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(payload, null, 2), { status, headers });
}

function html(body: string, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  return new Response(body, { status, headers });
}

function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function oauthBindingsReady(env: Env): boolean {
  return Boolean(env.GOOGLE_DRIVE_OAUTH_CLIENT_ID && env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET && env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI);
}

function coreStub(env: Env): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_OBJECT_NAME));
}

async function coreJson<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const response = await coreStub(env).fetch(`https://inventory-core.internal${path}`, init);
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(`core_http_${response.status}`);
  return payload;
}

async function checkCore(env: Env): Promise<{
  ok: boolean; status: string; schema_version?: number; expected_schema_version?: number; root_password_initialized?: boolean;
}> {
  try {
    const payload = await coreJson<{
      status?: string; schema_version?: number; expected_schema_version?: number; root_password_initialized?: boolean;
    }>(env, "/health");
    return {
      ok: payload.status === "ok" && payload.schema_version === payload.expected_schema_version,
      status: payload.status || "unknown",
      schema_version: payload.schema_version,
      expected_schema_version: payload.expected_schema_version,
      root_password_initialized: payload.root_password_initialized,
    };
  } catch {
    return { ok: false, status: "unavailable" };
  }
}

async function getUserByUsername(env: Env, username: string): Promise<InternalUser | null> {
  const payload = await coreJson<{ user: InternalUser | null }>(env, `/auth/user-by-username?username=${encodeURIComponent(username)}`);
  return payload.user;
}

async function getUserByFirebaseUid(env: Env, uid: string): Promise<InternalUser | null> {
  const payload = await coreJson<{ user: InternalUser | null }>(env, `/auth/user-by-firebase-uid?uid=${encodeURIComponent(uid)}`);
  return payload.user;
}

async function savePassword(env: Env, userId: string, password: string): Promise<void> {
  const derived = await hashPassword(password);
  await coreJson(env, "/auth/set-password", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, password_salt: derived.salt, password_hash: derived.hash }),
  });
}

async function ensureFirebaseUid(env: Env, user: InternalUser): Promise<string> {
  if (user.firebase_uid) return user.firebase_uid;
  const uid = user.user_id;
  await coreJson(env, "/auth/link-firebase-uid", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id, firebase_uid: uid }),
  });
  return uid;
}

async function requireUser(request: Request, env: Env, roles?: AppRole[]): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
  let identity;
  try {
    identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw new Response(JSON.stringify({ error: "INVALID_AUTH_TOKEN" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const user = await getUserByFirebaseUid(env, identity.uid);
  if (!user || user.status !== "ACTIVE") throw new Response(JSON.stringify({ error: "USER_NOT_ACTIVE" }), { status: 403, headers: { "content-type": "application/json" } });
  if (roles && !roles.includes(user.role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { "content-type": "application/json" } });
  return user;
}

function publicUser(user: InternalUser): Omit<InternalUser, "password_salt" | "password_hash"> {
  const { password_salt: _salt, password_hash: _hash, ...safe } = user;
  return safe;
}

async function parseUpstreamJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`firebase_upstream_invalid_json_http_${response.status}`);
  }
}

async function exchangeCustomToken(env: Env, customToken: string): Promise<{ id_token: string; refresh_token: string; expires_in: number }> {
  if (!env.FIREBASE_WEB_API_KEY) throw new Error("firebase_web_api_key_missing");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const payload = await parseUpstreamJson<FirebaseExchangeResponse>(response);
  if (!response.ok || !payload.idToken || !payload.refreshToken) {
    throw new Error(`firebase_custom_token_exchange_failed:${payload.error?.message || response.status}`);
  }
  return {
    id_token: payload.idToken,
    refresh_token: payload.refreshToken,
    expires_in: Math.max(60, Number(payload.expiresIn || 3600)),
  };
}

async function refreshSession(request: Request, env: Env): Promise<Response> {
  if (!env.FIREBASE_WEB_API_KEY) return json({ error: "FIREBASE_RUNTIME_NOT_CONFIGURED" }, 503);
  const body = (await request.json()) as { refresh_token?: string };
  const refreshToken = String(body.refresh_token || "").trim();
  if (!refreshToken) return json({ error: "REFRESH_TOKEN_REQUIRED" }, 400);

  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  let payload: FirebaseRefreshResponse;
  try {
    payload = await parseUpstreamJson<FirebaseRefreshResponse>(response);
  } catch {
    return json({ error: "FIREBASE_REFRESH_UPSTREAM_INVALID_RESPONSE" }, 502);
  }
  if (!response.ok || !payload.id_token || !payload.refresh_token) {
    return json({ error: "FIREBASE_REFRESH_FAILED", message: payload.error?.message || `HTTP ${response.status}` }, 401);
  }
  return json({
    id_token: payload.id_token,
    refresh_token: payload.refresh_token,
    expires_in: Math.max(60, Number(payload.expires_in || 3600)),
  });
}

async function login(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.FIREBASE_WEB_API_KEY) return json({ error: "AUTH_RUNTIME_NOT_CONFIGURED" }, 503);
  const body = (await request.json()) as { username?: string; password?: string };
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^[a-z0-9._-]{1,64}$/.test(username) || !password) return json({ error: "INVALID_CREDENTIALS" }, 401);

  let user = await getUserByUsername(env, username);
  if (!user || user.status !== "ACTIVE") return json({ error: "INVALID_CREDENTIALS" }, 401);

  if (!user.password_hash || !user.password_salt) {
    if (!env.ROOT_BOOTSTRAP_PASSWORD) {
      return json({ error: "PASSWORD_NOT_INITIALIZED", message: "Tài khoản chưa được khởi tạo mật khẩu." }, 503);
    }
    await savePassword(env, user.user_id, env.ROOT_BOOTSTRAP_PASSWORD);
    user = (await getUserByUsername(env, username))!;
  }

  if (!(await verifyPassword(password, user.password_salt!, user.password_hash!))) return json({ error: "INVALID_CREDENTIALS" }, 401);
  const firebaseUid = await ensureFirebaseUid(env, user);
  const customToken = await createFirebaseCustomToken(env.GOOGLE_RUNTIME_SA_JSON, firebaseUid, {
    app_role: user.role,
    app_user_id: user.user_id,
    employee_code: user.employee_code || "",
  });
  try {
    const session = await exchangeCustomToken(env, customToken);
    return json({ ...session, user: publicUser({ ...user, firebase_uid: firebaseUid }) });
  } catch (error) {
    return json({ error: "FIREBASE_LOGIN_EXCHANGE_FAILED", message: error instanceof Error ? error.message : "Firebase login exchange failed" }, 502);
  }
}

async function changePassword(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = (await request.json()) as { current_password?: string; new_password?: string };
  const current = String(body.current_password || "");
  const next = String(body.new_password || "");
  if (!user.password_salt || !user.password_hash || !(await verifyPassword(current, user.password_salt, user.password_hash))) {
    return json({ error: "CURRENT_PASSWORD_INVALID" }, 400);
  }
  await savePassword(env, user.user_id, next);
  return json({ status: "password_changed" });
}

async function startGoogleOAuth(env: Env): Promise<Response> {
  if (!oauthBindingsReady(env)) return json({ error: "oauth_not_configured" }, 503);
  const state = randomState();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID!, redirect_uri: env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI!, response_type: "code",
    scope: DRIVE_SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      "set-cookie": `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; Path=/api/oauth/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "cache-control": "no-store", "referrer-policy": "no-referrer",
    },
  });
}

async function googleOAuthCallback(request: Request, env: Env): Promise<Response> {
  if (!oauthBindingsReady(env)) return json({ error: "oauth_not_configured" }, 503);
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) return html(`<h1>OAuth cancelled/failed</h1><p>${escapeHtml(oauthError)}</p>`, 400);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, OAUTH_STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) return html("<h1>OAuth state validation failed</h1>", 400);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID!, client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET!, redirect_uri: env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI!, grant_type: "authorization_code" }),
  });
  const tokenPayload = (await tokenResponse.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok) return html(`<h1>Token exchange failed</h1><p>${escapeHtml(tokenPayload.error_description || tokenPayload.error || "token_exchange_failed")}</p>`, 502);
  if (!tokenPayload.refresh_token) return html("<h1>No refresh token returned</h1>", 502);
  return html(
    `<!doctype html><html><head><meta charset="utf-8"><title>SUPRA Inventory OAuth</title></head><body style="font-family:system-ui;max-width:900px;margin:40px auto;padding:0 20px"><h1>Google Drive OAuth thành công</h1><p>Copy giá trị dưới đây vào Cloudflare Worker secret <code>GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN</code>. Không gửi token qua chat/email/GitHub.</p><textarea readonly style="width:100%;height:160px">${escapeHtml(tokenPayload.refresh_token)}</textarea></body></html>`,
    200,
    { "set-cookie": `${OAUTH_STATE_COOKIE}=; Path=/api/oauth/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        const bindingPresence = Object.fromEntries(REQUIRED_RUNTIME_BINDINGS.map((name) => [name, Boolean(env[name])]));
        const missing = REQUIRED_RUNTIME_BINDINGS.filter((name) => !env[name]);
        const core = await checkCore(env);
        const healthy = missing.length === 0 && core.ok;
        return json({
          status: healthy ? "ok" : "degraded", service: env.PROJECT_KEY || "supra-inventory", environment: env.APP_ENV || "unknown",
          required_bindings: bindingPresence, oauth_refresh_token_configured: Boolean(env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN),
          root_bootstrap_secret_configured: Boolean(env.ROOT_BOOTSTRAP_PASSWORD), storage: core, missing_bindings: missing, timestamp: new Date().toISOString(),
        }, healthy ? 200 : 503);
      }

      if (request.method === "GET" && url.pathname === "/api/system/capabilities") {
        const core = await checkCore(env);
        return json({
          environment: env.APP_ENV,
          firebase_auth: "worker_exchanged_firebase_id_token",
          durable_objects_sqlite: core.ok,
          business_api: {
            version: 1,
            sku_master: "implemented",
            picker_report_withdraw: "implemented",
            reporter_priority_resolve_correction: "implemented",
            admin_monitoring: "implemented",
            mutation_idempotency: "required_request_id",
          },
          realtime_foreground: "websocket_planned_on_inventory_core",
          background_notifications: "firebase_cloud_messaging",
          hr_source_setup: { mode: "web_admin_input", required_input: ["google_sheet_url", "tab_name"], validation: ["valid_google_sheet_link", "exact_tab_name", "MNV_column", "Ho_ten_column"], public_setup_endpoint: false },
          root_password_initialized: Boolean(core.root_password_initialized), stable_release: "owner_gated",
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") return login(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/refresh") return refreshSession(request, env);
      if (request.method === "GET" && url.pathname === "/api/auth/me") return json({ user: publicUser(await requireUser(request, env)) });
      if (request.method === "PUT" && url.pathname === "/api/auth/change-password") return changePassword(request, env);

      if (request.method === "GET" && url.pathname === "/api/admin/archive/status") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        return archiveStatus(env);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/archive/run") {
        await requireUser(request, env, ["ROOT"]);
        try { return json(await runArchive(env)); }
        catch (error) { return json({ error: "ARCHIVE_RUN_FAILED", message: error instanceof Error ? error.message : "archive_failed" }, 502); }
      }

      if (request.method === "GET" && url.pathname === "/api/admin/hr-source") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        return coreStub(env).fetch("https://inventory-core.internal/config/hr-source");
      }
      if (request.method === "PUT" && url.pathname === "/api/admin/hr-source") {
        const user = await requireUser(request, env, ["ADMIN", "ROOT"]);
        if (!env.GOOGLE_RUNTIME_SA_JSON) return json({ error: "GOOGLE_RUNTIME_NOT_CONFIGURED" }, 503);
        const body = (await request.json()) as { sheet_url?: string; tab_name?: string };
        try {
          const validated = await validateHrSheetSource(env.GOOGLE_RUNTIME_SA_JSON, { sheet_url: String(body.sheet_url || ""), tab_name: String(body.tab_name || "") });
          await coreJson(env, "/config/hr-source", {
            method: "PUT", headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...validated, updated_by: user.user_id }),
          });
          return json({ status: "saved", source: validated });
        } catch (error) {
          return json({ error: "HR_SOURCE_INVALID", message: error instanceof Error ? error.message : "HR source validation failed" }, 400);
        }
      }

      const userManagementResponse = await handleUserManagementApi(request, env);
      if (userManagementResponse) return userManagementResponse;

      const notificationResponse = await handleNotificationApi(request, env);
      if (notificationResponse) return notificationResponse;

      const readResponse = await handleReadApi(request, env);
      if (readResponse) return readResponse;

      const businessResponse = await handleBusinessApi(request, env, ctx);
      if (businessResponse) return businessResponse;

      if (request.method === "GET" && url.pathname === "/api/oauth/google/start") return startGoogleOAuth(env);
      if (request.method === "GET" && url.pathname === "/api/oauth/google/callback") return googleOAuthCallback(request, env);

      if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
      if ((request.method === "GET" || request.method === "HEAD") && env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: "not_found" }, 404);
    } catch (error) {
      if (error instanceof Response) return error;
      return json({ error: "internal_error" }, 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runArchive(env).then(() => undefined).catch((error) => console.error("archive_scheduled_failed", error instanceof Error ? error.message : "unknown")));
  },
} satisfies ExportedHandler<Env>;
