import { readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";

interface ReadApiEnv {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
}

interface InternalUser {
  user_id: string;
  employee_code?: string | null;
  display_name?: string;
  role: AppRole;
  status: "ACTIVE" | "DISABLED";
}

const REPORTER_ROLES: AppRole[] = ["REPORTER", "ADMIN", "ROOT"];

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function core(env: ReadApiEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

async function requireUser(request: Request, env: ReadApiEnv, roles?: AppRole[]): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);
  let uid = "";
  try {
    uid = (await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID)).uid;
  } catch {
    throw json({ error: "INVALID_AUTH_TOKEN" }, 401);
  }
  const response = await core(env).fetch(`https://inventory-core.internal/auth/user-by-firebase-uid?uid=${encodeURIComponent(uid)}`);
  if (!response.ok) throw json({ error: "AUTH_LOOKUP_FAILED" }, 502);
  const payload = (await response.json()) as { user?: InternalUser | null };
  const user = payload.user;
  if (!user || user.status !== "ACTIVE") throw json({ error: "USER_NOT_ACTIVE" }, 403);
  if (roles && !roles.includes(user.role)) throw json({ error: "FORBIDDEN" }, 403);
  return user;
}

async function ensureOperationalV2(env: ReadApiEnv): Promise<Response | null> {
  try {
    const ready = await core(env).fetch("https://inventory-core.internal/operational/init");
    return ready.ok ? null : json({ error: "OPERATIONAL_V2_NOT_READY" }, 503);
  } catch {
    return json({ error: "OPERATIONAL_V2_NOT_READY" }, 503);
  }
}

export async function handleReadApi(request: Request, env: ReadApiEnv): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/realtime/ticket") {
    const user = await requireUser(request, env);
    const initFailure = await ensureOperationalV2(env);
    if (initFailure) return initFailure;
    let body: { client_type?: string } = {};
    try {
      body = (await request.json()) as { client_type?: string };
    } catch {
      body = {};
    }
    const clientType = String(body.client_type || "").toUpperCase();
    if (!["WEB", "ANDROID"].includes(clientType)) return json({ error: "INVALID_CLIENT_TYPE" }, 400);
    return core(env).fetch("https://inventory-core.internal/realtime/ticket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: user.user_id,
        employee_code: user.employee_code || null,
        display_name: user.display_name || "",
        role: user.role,
        client_type: clientType,
      }),
    });
  }

  if (request.method === "GET" && url.pathname === "/api/realtime/connect") {
    const ticket = String(url.searchParams.get("ticket") || "").trim();
    const headers = new Headers();
    headers.set("Upgrade", request.headers.get("Upgrade") || "");
    headers.set("Connection", request.headers.get("Connection") || "Upgrade");
    return core(env).fetch(`https://inventory-core.internal/realtime/connect?ticket=${encodeURIComponent(ticket)}`, { headers });
  }

  if (request.method === "GET" && url.pathname === "/api/realtime/delta") {
    const user = await requireUser(request, env);
    const initFailure = await ensureOperationalV2(env);
    if (initFailure) return initFailure;
    const params = new URLSearchParams({
      user_id: user.user_id,
      role: user.role,
      after_seq: url.searchParams.get("after_seq") || "0",
    });
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return core(env).fetch(`https://inventory-core.internal/operational/realtime/delta?${params.toString()}`);
  }

  if (request.method === "GET" && url.pathname === "/api/realtime/presence") {
    await requireUser(request, env, ["ADMIN", "ROOT"]);
    const initFailure = await ensureOperationalV2(env);
    if (initFailure) return initFailure;
    return core(env).fetch("https://inventory-core.internal/read/realtime/presence");
  }

  if (request.method !== "GET") return null;

  if (url.pathname === "/api/skus/catalog-info") {
    await requireUser(request, env);
    return core(env).fetch("https://inventory-core.internal/read/skus/catalog-info");
  }

  if (url.pathname === "/api/skus/catalog") {
    await requireUser(request, env);
    const params = new URLSearchParams();
    if (url.searchParams.has("after")) params.set("after", url.searchParams.get("after") || "");
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return core(env).fetch(`https://inventory-core.internal/read/skus/catalog?${params.toString()}`);
  }

  if (url.pathname === "/api/skus/catalog-delta") {
    await requireUser(request, env);
    const params = new URLSearchParams();
    for (const name of ["since", "after_updated_at", "after_sku", "limit"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return core(env).fetch(`https://inventory-core.internal/read/skus/catalog-delta?${params.toString()}`);
  }

  if (url.pathname === "/api/reporter/recent") {
    await requireUser(request, env, REPORTER_ROLES);
    const initFailure = await ensureOperationalV2(env);
    if (initFailure) return initFailure;
    const params = new URLSearchParams();
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return core(env).fetch(`https://inventory-core.internal/operational/reporter/recent?${params.toString()}`);
  }

  if (url.pathname === "/api/reporter/batch-tickets") {
    await requireUser(request, env, REPORTER_ROLES);
    const initFailure = await ensureOperationalV2(env);
    if (initFailure) return initFailure;
    const params = new URLSearchParams({ batch_id: url.searchParams.get("batch_id") || "" });
    return core(env).fetch(`https://inventory-core.internal/operational/reporter/batch-tickets?${params.toString()}`);
  }

  return null;
}
