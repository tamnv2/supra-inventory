import { readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";

interface ReadApiEnv {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
}

interface InternalUser {
  user_id: string;
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

export async function handleReadApi(request: Request, env: ReadApiEnv): Promise<Response | null> {
  const url = new URL(request.url);
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

  if (url.pathname === "/api/reporter/recent") {
    await requireUser(request, env, REPORTER_ROLES);
    const params = new URLSearchParams();
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return core(env).fetch(`https://inventory-core.internal/read/reporter/recent?${params.toString()}`);
  }

  if (url.pathname === "/api/reporter/batch-tickets") {
    await requireUser(request, env, REPORTER_ROLES);
    const params = new URLSearchParams({ batch_id: url.searchParams.get("batch_id") || "" });
    return core(env).fetch(`https://inventory-core.internal/read/reporter/batch-tickets?${params.toString()}`);
  }

  return null;
}
