import { InventoryCore } from "./core";

export { InventoryCore };

interface Env {
  APP_ENV: string;
  PROJECT_KEY: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REDIRECT_URI?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function oauthBindingsReady(env: Env): boolean {
  return Boolean(
    env.GOOGLE_DRIVE_OAUTH_CLIENT_ID &&
      env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET &&
      env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI,
  );
}

function coreStub(env: Env): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_OBJECT_NAME));
}

async function checkCore(env: Env): Promise<{
  ok: boolean;
  status: string;
  schema_version?: number;
  expected_schema_version?: number;
}> {
  try {
    const response = await coreStub(env).fetch("https://inventory-core.internal/health");
    const payload = (await response.json()) as {
      status?: string;
      schema_version?: number;
      expected_schema_version?: number;
    };
    return {
      ok:
        response.ok &&
        payload.status === "ok" &&
        payload.schema_version === payload.expected_schema_version,
      status: payload.status || "unknown",
      schema_version: payload.schema_version,
      expected_schema_version: payload.expected_schema_version,
    };
  } catch {
    return { ok: false, status: "unavailable" };
  }
}

async function startGoogleOAuth(env: Env): Promise<Response> {
  if (!oauthBindingsReady(env)) return json({ error: "oauth_not_configured" }, 503);

  const state = randomState();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID!,
    redirect_uri: env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      "set-cookie": `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; Path=/api/oauth/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
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
  if (!code || !state || !expectedState || state !== expectedState) {
    return html("<h1>OAuth state validation failed</h1><p>Start the flow again from /api/oauth/google/start.</p>", 400);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID!,
      client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET!,
      redirect_uri: env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokenPayload = (await tokenResponse.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok) {
    const detail = tokenPayload.error_description || tokenPayload.error || "token_exchange_failed";
    return html(`<h1>Token exchange failed</h1><p>${escapeHtml(detail)}</p>`, 502, {
      "set-cookie": `${OAUTH_STATE_COOKIE}=; Path=/api/oauth/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    });
  }

  if (!tokenPayload.refresh_token) {
    return html(
      "<h1>No refresh token returned</h1><p>Start again from /api/oauth/google/start and approve consent.</p>",
      502,
      { "set-cookie": `${OAUTH_STATE_COOKIE}=; Path=/api/oauth/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    );
  }

  const refreshToken = escapeHtml(tokenPayload.refresh_token);
  return html(
    `<!doctype html><html><head><meta charset="utf-8"><title>SUPRA Inventory OAuth</title></head><body style="font-family:system-ui;max-width:900px;margin:40px auto;padding:0 20px"><h1>Google Drive OAuth thành công</h1><p>Copy giá trị dưới đây vào Cloudflare Worker secret <code>GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN</code>. Không gửi token qua chat, email hoặc commit vào GitHub.</p><textarea readonly style="width:100%;height:160px">${refreshToken}</textarea><p>Sau khi lưu secret thành công, đóng trang này.</p></body></html>`,
    200,
    { "set-cookie": `${OAUTH_STATE_COOKIE}=; Path=/api/oauth/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        service: env.PROJECT_KEY || "supra-inventory",
        environment: env.APP_ENV || "unknown",
        status: "running",
        health: "/health",
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const bindingPresence = Object.fromEntries(
        REQUIRED_RUNTIME_BINDINGS.map((name) => [name, Boolean(env[name])]),
      );
      const missing = REQUIRED_RUNTIME_BINDINGS.filter((name) => !env[name]);
      const core = await checkCore(env);
      const healthy = missing.length === 0 && core.ok;

      return json(
        {
          status: healthy ? "ok" : "degraded",
          service: env.PROJECT_KEY || "supra-inventory",
          environment: env.APP_ENV || "unknown",
          required_bindings: bindingPresence,
          oauth_refresh_token_configured: Boolean(env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN),
          storage: core,
          missing_bindings: missing,
          timestamp: new Date().toISOString(),
        },
        healthy ? 200 : 503,
      );
    }

    if (request.method === "GET" && url.pathname === "/api/system/capabilities") {
      const core = await checkCore(env);
      return json({
        environment: env.APP_ENV,
        durable_objects_sqlite: core.ok,
        realtime_foreground: "websocket_planned_on_inventory_core",
        background_notifications: "firebase_cloud_messaging",
        hr_source_setup: {
          mode: "web_admin_input",
          required_input: ["google_sheet_url", "tab_name"],
          validation: ["valid_google_sheet_link", "exact_tab_name", "MNV_column", "Ho_ten_column"],
          public_setup_endpoint: false,
        },
        stable_release: "owner_gated",
      });
    }

    if (request.method === "GET" && url.pathname === "/api/oauth/google/start") return startGoogleOAuth(env);
    if (request.method === "GET" && url.pathname === "/api/oauth/google/callback") return googleOAuthCallback(request, env);

    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
