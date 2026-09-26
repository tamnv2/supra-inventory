type InternalEnv = {
  APP_ENV: string;
  INVENTORY_CORE: DurableObjectNamespace;
};

const EXPECTED_RUNTIME_EMAIL = "inventory-beta-alert-runtime@supra-inventory-beta.iam.gserviceaccount.com";
const EXPECTED_AUDIENCE = "https://inventory-beta.supra.cc.cd";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function verifyRuntimeIdentity(request: Request, env: InternalEnv): Promise<boolean> {
  if (env.APP_ENV !== "beta") return false;
  const token = bearer(request);
  if (!token || token.length > 8192) return false;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    exp?: string;
  };
  const exp = Number(payload.exp || 0);
  return payload.aud === EXPECTED_AUDIENCE
    && payload.email === EXPECTED_RUNTIME_EMAIL
    && (payload.email_verified === "true" || payload.email_verified === true)
    && Number.isFinite(exp)
    && exp * 1000 > Date.now();
}

function core(env: InternalEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

export async function handleD119Internal(request: Request, env: InternalEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const isRetiredSkuSync = request.method === "POST" && url.pathname === "/api/internal/d119/sku-sync";
  const isAlertWindow = request.method === "GET" && url.pathname === "/api/internal/d119/alert-window";
  if (isRetiredSkuSync) {
    return json({ error: "RETIRED_D126_MANUAL_FILE_ONLY" }, 410);
  }
  if (!isAlertWindow) return null;
  if (!(await verifyRuntimeIdentity(request, env))) return json({ error: "INTERNAL_IDENTITY_REQUIRED" }, 401);
  return core(env).fetch("https://inventory-core.internal/notifications/alert-window");
}
