import { readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";
import { readHrEmployees, type StoredHrSource } from "./hr-sync";

interface Env {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
}
interface User { user_id: string; employee_code: string | null; role: AppRole; status: "ACTIVE" | "DISABLED"; }
const ROLES: AppRole[] = ["ADMIN", "ROOT"];

function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function core(env: Env): DurableObjectStub { return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core")); }
async function requireAdmin(request: Request, env: Env): Promise<User> {
  const token = readBearerToken(request); if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);
  let uid = ""; try { uid = (await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID)).uid; } catch { throw json({ error: "INVALID_AUTH_TOKEN" }, 401); }
  const lookup = await core(env).fetch(`https://inventory-core.internal/auth/user-by-firebase-uid?uid=${encodeURIComponent(uid)}`);
  const user = lookup.ok ? ((await lookup.json()) as { user?: User | null }).user : null;
  if (!user || user.status !== "ACTIVE") throw json({ error: "USER_NOT_ACTIVE" }, 403);
  if (!ROLES.includes(user.role)) throw json({ error: "FORBIDDEN" }, 403);
  return user;
}
function actor(user: User) { return { user_id: user.user_id, employee_code: user.employee_code, role: user.role }; }
async function bodyObject(request: Request): Promise<Record<string, unknown>> { try { const v = await request.json(); return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; } catch { return {}; } }
async function hrEmployees(env: Env) {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  const configResponse = await core(env).fetch("https://inventory-core.internal/config/hr-source");
  if (!configResponse.ok) throw new Error("HR_SOURCE_READ_FAILED");
  const config = (await configResponse.json()) as { configured?: boolean; source?: StoredHrSource | null };
  if (!config.configured || !config.source) throw new Error("HR_SOURCE_NOT_CONFIGURED");
  const read = await readHrEmployees(env.GOOGLE_RUNTIME_SA_JSON, config.source);
  if (read.invalid_rows.length || read.duplicate_conflicts.length) {
    throw new Error(`HR_SOURCE_DATA_INVALID: invalid_rows=${read.invalid_rows.slice(0,20).join(",")}; duplicate_conflicts=${read.duplicate_conflicts.slice(0,20).map((x) => x.employee_code).join(",")}`);
  }
  return read;
}

export async function handleUserManagementApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const supported = new Set([
    "GET /api/admin/users", "POST /api/admin/users", "PATCH /api/admin/users",
    "POST /api/admin/users/reset-password", "POST /api/admin/hr-sync/preview", "POST /api/admin/hr-sync/apply",
  ]);
  const key = `${request.method} ${url.pathname}`;
  if (!supported.has(key)) return null;
  const user = await requireAdmin(request, env);

  if (key === "GET /api/admin/users") {
    const params = new URLSearchParams();
    for (const name of ["query","role","status","limit"]) if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    return core(env).fetch(`https://inventory-core.internal/admin/users?${params.toString()}`);
  }
  if (key === "POST /api/admin/users") {
    const body = await bodyObject(request);
    return core(env).fetch("https://inventory-core.internal/admin/users/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, actor: actor(user) }) });
  }
  if (key === "PATCH /api/admin/users") {
    const body = await bodyObject(request);
    return core(env).fetch("https://inventory-core.internal/admin/users/update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, actor: actor(user) }) });
  }
  if (key === "POST /api/admin/users/reset-password") {
    const body = await bodyObject(request);
    return core(env).fetch("https://inventory-core.internal/admin/users/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, actor: actor(user) }) });
  }
  try {
    const read = await hrEmployees(env);
    if (key === "POST /api/admin/hr-sync/preview") {
      return core(env).fetch("https://inventory-core.internal/admin/hr-sync/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor: actor(user), employees: read.employees }) });
    }
    const body = await bodyObject(request);
    return core(env).fetch("https://inventory-core.internal/admin/hr-sync/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, actor: actor(user), employees: read.employees }) });
  } catch (error) {
    return json({ error: "HR_SYNC_SOURCE_FAILED", message: error instanceof Error ? error.message : "Không đọc được nguồn nhân sự." }, 400);
  }
}
