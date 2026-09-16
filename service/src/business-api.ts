import { readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";

interface BusinessEnv {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
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

const CORE_OBJECT_NAME = "inventory-core";
const REPORTER_ROLES: AppRole[] = ["REPORTER", "ADMIN", "ROOT"];
const REPORTER_TAGS = ["role:REPORTER", "role:ADMIN", "role:ROOT"];

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

function coreStub(env: BusinessEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_OBJECT_NAME));
}

async function coreUserByFirebaseUid(env: BusinessEnv, uid: string): Promise<InternalUser | null> {
  const response = await coreStub(env).fetch(
    `https://inventory-core.internal/auth/user-by-firebase-uid?uid=${encodeURIComponent(uid)}`,
  );
  if (!response.ok) throw new Error(`core_user_http_${response.status}`);
  const payload = (await response.json()) as { user?: InternalUser | null };
  return payload.user ?? null;
}

async function requireUser(request: Request, env: BusinessEnv, roles?: AppRole[]): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);

  let identity;
  try {
    identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw json({ error: "INVALID_AUTH_TOKEN" }, 401);
  }

  const user = await coreUserByFirebaseUid(env, identity.uid);
  if (!user || user.status !== "ACTIVE") throw json({ error: "USER_NOT_ACTIVE" }, 403);
  if (roles && !roles.includes(user.role)) throw json({ error: "FORBIDDEN" }, 403);
  return user;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function parseObjectBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function corePost(env: BusinessEnv, path: string, body: Record<string, unknown>): Promise<Response> {
  return coreStub(env).fetch(`https://inventory-core.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function coreGet(env: BusinessEnv, path: string): Promise<Response> {
  return coreStub(env).fetch(`https://inventory-core.internal${path}`);
}

function actor(user: InternalUser): { user_id: string; employee_code: string | null } {
  return { user_id: user.user_id, employee_code: user.employee_code };
}

async function realtimeAfter(
  response: Response,
  env: BusinessEnv,
  options: {
    event: string;
    scopes: string[];
    tags?: string[];
    batchId?: string;
    includeBatchPickerUsers?: boolean;
    metadata?: Record<string, unknown>;
  },
): Promise<Response> {
  if (!response.ok) return response;

  let batchId = options.batchId || "";
  if (!batchId) {
    try {
      const payload = (await response.clone().json()) as {
        batch_id?: string;
        ticket?: { batch_id?: string };
      };
      batchId = String(payload.batch_id || payload.ticket?.batch_id || "");
    } catch {
      batchId = "";
    }
  }

  try {
    await corePost(env, "/realtime/broadcast", {
      event: options.event,
      scopes: options.scopes,
      tags: options.tags || [],
      batch_id: batchId || null,
      include_batch_picker_users: Boolean(options.includeBatchPickerUsers),
      metadata: options.metadata || {},
    });
  } catch {
    // Realtime is best-effort. Authoritative transaction success must not be rolled back by notification failure.
  }
  return response;
}

export async function handleBusinessApi(request: Request, env: BusinessEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const key = `${request.method} ${url.pathname}`;
  const supported = new Set([
    "POST /api/admin/skus/import",
    "GET /api/skus",
    "POST /api/picker/reports",
    "GET /api/picker/reports",
    "POST /api/picker/reports/withdraw",
    "GET /api/reporter/queue",
    "POST /api/reporter/batches/resolve",
    "POST /api/reporter/batches/correct",
    "GET /api/admin/reports",
  ]);
  if (!supported.has(key)) return null;

  if (key === "POST /api/admin/skus/import") {
    const user = await requireUser(request, env, ["ADMIN", "ROOT"]);
    const body = await parseObjectBody(request);
    const items = Array.isArray(body.items) ? body.items : [];
    const suppliedHash = String(body.source_hash || "").trim();
    const sourceHash = suppliedHash || (await sha256Hex(JSON.stringify(items)));
    return corePost(env, "/business/skus/import-v2", { ...body, source_hash: sourceHash, actor: actor(user) });
  }

  if (key === "GET /api/skus") {
    await requireUser(request, env);
    const params = new URLSearchParams();
    if (url.searchParams.has("query")) params.set("query", url.searchParams.get("query") || "");
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return coreGet(env, `/business/skus/search?${params.toString()}`);
  }

  if (key === "POST /api/picker/reports") {
    const user = await requireUser(request, env, ["PICKER"]);
    const body = await parseObjectBody(request);
    const response = await corePost(env, "/business/reports/create", { ...body, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "report_created",
      scopes: ["reporter_queue"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });
  }

  if (key === "GET /api/picker/reports") {
    const user = await requireUser(request, env, ["PICKER"]);
    if (!user.employee_code) return json({ error: "PICKER_EMPLOYEE_CODE_REQUIRED" }, 409);
    const params = new URLSearchParams({ user_id: user.user_id, employee_code: user.employee_code });
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return coreGet(env, `/business/picker/reports?${params.toString()}`);
  }

  if (key === "POST /api/picker/reports/withdraw") {
    const user = await requireUser(request, env, ["PICKER"]);
    const body = await parseObjectBody(request);
    const response = await corePost(env, "/business/reports/withdraw", { ...body, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "report_withdrawn",
      scopes: ["reporter_queue", "picker_reports"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });
  }

  if (key === "GET /api/reporter/queue") {
    await requireUser(request, env, REPORTER_ROLES);
    const params = new URLSearchParams();
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return coreGet(env, `/business/reporter/queue?${params.toString()}`);
  }

  if (key === "POST /api/reporter/batches/resolve") {
    const user = await requireUser(request, env, REPORTER_ROLES);
    const body = await parseObjectBody(request);
    const batchId = String(body.batch_id || "").trim();
    const response = await corePost(env, "/business/reporter/resolve", { ...body, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "batch_resolved",
      scopes: ["reporter_queue", "reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
  }

  if (key === "POST /api/reporter/batches/correct") {
    const user = await requireUser(request, env, REPORTER_ROLES);
    const body = await parseObjectBody(request);
    const batchId = String(body.batch_id || "").trim();
    const response = await corePost(env, "/business/reporter/correct", { ...body, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "batch_corrected",
      scopes: ["reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
  }

  if (key === "GET /api/admin/reports") {
    await requireUser(request, env, ["ADMIN", "ROOT"]);
    const params = new URLSearchParams();
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    if (url.searchParams.has("status")) params.set("status", url.searchParams.get("status") || "");
    return coreGet(env, `/business/admin/reports?${params.toString()}`);
  }

  return null;
}
