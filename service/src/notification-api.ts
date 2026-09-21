import { interactiveSessionError, readBearerToken, verifyFirebaseIdToken } from "./auth";

interface NotificationEnv {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
}

type InternalUser = {
  user_id: string;
  status: "ACTIVE" | "DISABLED";
  web_session_generation?: number;
  android_session_generation?: number;
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function core(env: NotificationEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

async function requireUser(request: Request, env: NotificationEnv): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);
  let identity;
  try {
    identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw json({ error: "INVALID_AUTH_TOKEN" }, 401);
  }
  const lookup = await core(env).fetch(`https://inventory-core.internal/auth/user-by-firebase-uid?uid=${encodeURIComponent(identity.uid)}`);
  if (!lookup.ok) throw json({ error: "AUTH_LOOKUP_FAILED" }, 502);
  const user = ((await lookup.json()) as { user?: InternalUser | null }).user;
  if (!user || user.status !== "ACTIVE") throw json({ error: "USER_NOT_ACTIVE" }, 403);
  const sessionError = interactiveSessionError(identity, user);
  if (sessionError) throw json({ error: sessionError }, 401);
  return user;
}

export async function handleNotificationApi(request: Request, env: NotificationEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/notifications/device") return null;
  if (request.method !== "POST" && request.method !== "DELETE") return null;
  const user = await requireUser(request, env);
  let body: { device_id?: string; token?: string; platform?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const path = request.method === "POST" ? "/notifications/device/upsert" : "/notifications/device/remove";
  return core(env).fetch(`https://inventory-core.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, user_id: user.user_id }),
  });
}
