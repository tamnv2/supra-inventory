import { interactiveSessionError, readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";
import { sendFcmNotifications } from "./fcm";

interface BusinessEnv {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
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
  web_session_generation?: number;
  android_session_generation?: number;
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
  const sessionError = interactiveSessionError(identity, user);
  if (sessionError) throw json({ error: sessionError }, 401);
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

function corePut(env: BusinessEnv, path: string, body: Record<string, unknown>): Promise<Response> {
  return coreStub(env).fetch(`https://inventory-core.internal${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function coreGet(env: BusinessEnv, path: string): Promise<Response> {
  return coreStub(env).fetch(`https://inventory-core.internal${path}`);
}

function actor(user: InternalUser): { user_id: string; employee_code: string | null; role: AppRole; display_name: string } {
  return { user_id: user.user_id, employee_code: user.employee_code, role: user.role, display_name: user.display_name };
}

async function ensureOperationalV2(env: BusinessEnv): Promise<Response | null> {
  try {
    const response = await coreGet(env, "/operational/init");
    if (response.ok) return null;
    return json({ error: "OPERATIONAL_V2_NOT_READY", message: "Hệ thống nghiệp vụ chưa khởi tạo xong. Dịch vụ đang tự phục hồi, vui lòng thử lại." }, 503);
  } catch {
    return json({ error: "OPERATIONAL_V2_NOT_READY", message: "Hệ thống nghiệp vụ chưa khởi tạo xong. Dịch vụ đang tự phục hồi, vui lòng thử lại." }, 503);
  }
}

function requiredRolesForBusinessRoute(key: string): AppRole[] | undefined {
  if (key.startsWith("POST /api/picker/") || key.startsWith("GET /api/picker/")) return ["PICKER"];
  if (key.startsWith("GET /api/reporter/") || key.startsWith("POST /api/reporter/")) return REPORTER_ROLES;
  if (key.startsWith("GET /api/admin/") || key.startsWith("POST /api/admin/") || key.startsWith("PUT /api/admin/")) return ["ADMIN", "ROOT"];
  return undefined;
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
  let eventId = "";
  try {
    const payload = (await response.clone().json()) as {
      event_id?: string | null;
      batch_id?: string;
      ticket?: { batch_id?: string };
      acknowledgement?: { batch_id?: string };
    };
    eventId = String(payload.event_id || "");
    batchId = String(batchId || payload.batch_id || payload.ticket?.batch_id || payload.acknowledgement?.batch_id || "");
  } catch {
    // Keep best-effort broadcast behavior.
  }

  try {
    await corePost(env, "/realtime/broadcast", {
      event: options.event,
      event_id: eventId || null,
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

type NotificationTarget = {
  roles?: AppRole[];
  userIds?: string[];
  batchId?: string;
};

function scheduleFcm(
  response: Response,
  env: BusinessEnv,
  ctx: ExecutionContext | undefined,
  options: {
    event: string;
    target: NotificationTarget;
    title: string;
    body: string;
  },
): void {
  if (!ctx || !env.GOOGLE_RUNTIME_SA_JSON || !response.ok) return;
  ctx.waitUntil((async () => {
    try {
      const mutation = (await response.clone().json()) as {
        event_id?: string | null;
        batch_id?: string;
        ticket?: { batch_id?: string };
      };
      const resultEventId = String(mutation.event_id || "");
      const batchId = String(options.target.batchId || mutation.batch_id || mutation.ticket?.batch_id || "");

      let eventSeq = "";
      let batchVersion = "";
      if (resultEventId) {
        const eventResponse = await coreGet(env, `/operational/realtime/event?event_id=${encodeURIComponent(resultEventId)}`);
        if (eventResponse.ok) {
          const eventPayload = (await eventResponse.json()) as { event?: { seq?: number; batch_version?: number } };
          if (eventPayload.event?.seq != null) eventSeq = String(eventPayload.event.seq);
          if (eventPayload.event?.batch_version != null) batchVersion = String(eventPayload.event.batch_version);
        }
      }

      const targetResponse = await corePost(env, "/notifications/targets", {
        roles: options.target.roles || [],
        user_ids: options.target.userIds || [],
        batch_id: batchId || null,
        result_event_id: resultEventId || null,
      });
      if (!targetResponse.ok) return;
      const targetPayload = (await targetResponse.json()) as {
        tokens?: string[];
        batch?: { sku?: string; product_name?: string } | null;
      };
      const tokens = targetPayload.tokens || [];
      if (!tokens.length) return;
      const batchSku = String(targetPayload.batch?.sku || "");
      const delivery = await sendFcmNotifications(env.GOOGLE_RUNTIME_SA_JSON!, env.FIREBASE_PROJECT_ID, tokens, {
        title: options.title,
        body: options.body.replace("{sku}", batchSku || "SKU"),
        data: {
          event: options.event,
          batch_id: batchId,
          result_event_id: resultEventId,
          event_seq: eventSeq,
          batch_version: batchVersion,
        },
      });
      await corePost(env, "/notifications/delivery-attempts", {
        event_id: resultEventId || null,
        event: options.event,
        attempts: delivery.attempts.map((attempt) => ({
          token: attempt.token,
          status: attempt.status,
          error_code: attempt.error_code,
        })),
      });
      if (delivery.invalidTokens.length) {
        await corePost(env, "/notifications/disable-tokens", { tokens: delivery.invalidTokens });
      }
    } catch {
      // Background notification is best-effort and must never change the committed business result.
    }
  })());
}

export async function handleBusinessApi(request: Request, env: BusinessEnv, ctx?: ExecutionContext): Promise<Response | null> {
  const url = new URL(request.url);
  const key = `${request.method} ${url.pathname}`;
  const supported = new Set([
    "POST /api/admin/skus/import",
    "GET /api/skus",
    "POST /api/picker/reports",
    "GET /api/picker/reports",
    "POST /api/picker/reports/withdraw",
    "GET /api/picker/results",
    "POST /api/picker/results/receipt",
    "GET /api/reporter/queue",
    "POST /api/reporter/batches/resolve",
    "POST /api/reporter/batches/correct",
    "GET /api/admin/reports",
    "GET /api/admin/dashboard",
    "GET /api/admin/reporting",
    "GET /api/admin/audit-history",
    "GET /api/admin/dashboard-preference",
    "PUT /api/admin/dashboard-preference",
    "GET /api/admin/operational-insights",
    "GET /api/admin/sla",
    "PUT /api/admin/sla",
  ]);
  if (!supported.has(key)) return null;

  // Authentication/authorization must happen before any readiness probe. An unauthenticated
  // request must never trigger schema work or turn an expected 401/403 into a readiness 503.
  const user = await requireUser(request, env, requiredRolesForBusinessRoute(key));
  const initializationFailure = await ensureOperationalV2(env);
  if (initializationFailure) return initializationFailure;

  if (key === "POST /api/admin/skus/import") {
    const body = await parseObjectBody(request);
    const items = Array.isArray(body.items) ? body.items : [];
    const suppliedHash = String(body.source_hash || "").trim();
    const sourceHash = suppliedHash || (await sha256Hex(JSON.stringify(items)));
    return corePost(env, "/business/skus/import-v2", { ...body, source_hash: sourceHash, actor: actor(user) });
  }

  if (key === "GET /api/skus") {
    const params = new URLSearchParams();
    if (url.searchParams.has("query")) params.set("query", url.searchParams.get("query") || "");
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return coreGet(env, `/business/skus/search?${params.toString()}`);
  }

  if (key === "POST /api/picker/reports") {
    const body = await parseObjectBody(request);
    const response = await corePost(env, "/business/reports/create", { ...body, actor: actor(user) });
    const result = await realtimeAfter(response, env, {
      event: "report_created",
      scopes: ["reporter_queue", "picker_reports"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });
    let sku = String(body.sku || "").trim();
    try {
      const payload = (await response.clone().json()) as { ticket?: { sku?: string } };
      sku = String(payload.ticket?.sku || sku);
    } catch {}
    scheduleFcm(result, env, ctx, {
      event: "report_created",
      target: { roles: REPORTER_ROLES },
      title: "SUPRA Inventory · SKU cần xử lý",
      body: `${sku || "SKU"} vừa được Picker báo hết hàng.`,
    });
    return result;
  }

  if (key === "GET /api/picker/reports") {
    if (!user.employee_code) return json({ error: "PICKER_EMPLOYEE_CODE_REQUIRED" }, 409);
    const params = new URLSearchParams({ user_id: user.user_id, employee_code: user.employee_code });
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return coreGet(env, `/operational/picker/reports?${params.toString()}`);
  }

  if (key === "POST /api/picker/reports/withdraw") {
    const body = await parseObjectBody(request);
    const response = await corePost(env, "/business/reports/withdraw", { ...body, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "report_withdrawn",
      scopes: ["reporter_queue", "reporter_recent", "picker_reports"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });
  }

  if (key === "GET /api/picker/results") {
    const params = new URLSearchParams({ user_id: user.user_id });
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return coreGet(env, `/operational/picker/results?${params.toString()}`);
  }

  if (key === "POST /api/picker/results/receipt") {
    const body = await parseObjectBody(request);
    const response = await corePost(env, "/operational/picker/result-stage", { ...body, actor: actor(user) });
    const stage = String(body.stage || "").toUpperCase();
    if (stage !== "ACKNOWLEDGED") return response;
    return realtimeAfter(response, env, {
      event: "result_acknowledged",
      scopes: ["reporter_recent", "picker_reports"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });
  }

  if (key === "GET /api/reporter/queue") {
    const params = new URLSearchParams();
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    if (url.searchParams.has("offset")) params.set("offset", url.searchParams.get("offset") || "");
    return coreGet(env, `/operational/reporter/queue?${params.toString()}`);
  }

  if (key === "POST /api/reporter/batches/resolve") {
    const body = await parseObjectBody(request);
    const batchId = String(body.batch_id || "").trim();
    const response = await corePost(env, "/business/reporter/resolve", { ...body, actor: actor(user) });
    const result = await realtimeAfter(response, env, {
      event: "batch_resolved",
      scopes: ["reporter_queue", "reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
    const resolution = String(body.resolution || "");
    scheduleFcm(result, env, ctx, {
      event: "batch_resolved",
      target: { batchId },
      title: resolution === "HAS_STOCK" ? "SUPRA Inventory · Đã có hàng" : "SUPRA Inventory · Được skip",
      body: resolution === "HAS_STOCK" ? "{sku} đã được Reporter xác nhận có hàng." : "{sku} đã được Reporter cho phép skip.",
    });
    return result;
  }

  if (key === "POST /api/reporter/batches/correct") {
    const body = await parseObjectBody(request);
    const batchId = String(body.batch_id || "").trim();
    const response = await corePost(env, "/business/reporter/correct", { ...body, actor: actor(user) });
    const result = await realtimeAfter(response, env, {
      event: "batch_corrected",
      scopes: ["reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
    scheduleFcm(result, env, ctx, {
      event: "batch_corrected",
      target: { batchId },
      title: "SUPRA Inventory · Cập nhật kết quả",
      body: "{sku} đã được sửa kết quả thành Có hàng.",
    });
    return result;
  }

  if (key === "GET /api/admin/sla") {
    return coreGet(env, "/operational/sla");
  }

  if (key === "PUT /api/admin/sla") {
    const body = await parseObjectBody(request);
    const response = await corePut(env, "/operational/sla", { ...body, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "sla_settings_updated",
      scopes: ["sla_settings", "reporter_queue"],
      tags: REPORTER_TAGS,
    });
  }

  if (key === "GET /api/admin/operational-insights") {
    const params = new URLSearchParams();
    for (const name of ["from", "to"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return coreGet(env, `/operational/admin/insights?${params.toString()}`);
  }

  if (key === "GET /api/admin/dashboard" || key === "GET /api/admin/reporting") {
    const params = new URLSearchParams();
    for (const name of ["from", "to", "status", "query", "limit", "offset"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return coreGet(env, `${key.endsWith("dashboard") ? "/business/admin/dashboard" : "/business/admin/reporting"}?${params.toString()}`);
  }

  if (key === "GET /api/admin/dashboard-preference") {
    return coreGet(env, `/business/admin/dashboard-preference?user_id=${encodeURIComponent(user.user_id)}`);
  }

  if (key === "PUT /api/admin/dashboard-preference") {
    const body = await parseObjectBody(request);
    return corePut(env, "/business/admin/dashboard-preference", { ...body, actor: actor(user) });
  }

  if (key === "GET /api/admin/audit-history") {
    const params = new URLSearchParams();
    for (const name of ["role", "query", "limit", "offset"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return coreGet(env, `/business/admin/audit-history?${params.toString()}`);
  }

  if (key === "GET /api/admin/reports") {
    const params = new URLSearchParams();
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    if (url.searchParams.has("status")) params.set("status", url.searchParams.get("status") || "");
    return coreGet(env, `/business/admin/reports?${params.toString()}`);
  }

  return null;
}
