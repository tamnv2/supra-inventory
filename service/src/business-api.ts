import { interactiveSessionError, readBearerToken, verifyFirebaseIdToken, type AppRole, type FirebaseIdentity } from "./auth";
import { verifyCurrentAuthenticationProof } from "./privileged-auth";
import { sendFcmNotifications } from "./fcm";

interface BusinessEnv {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
}

interface InternalUser {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  contractor_name?: string | null;
  shortage_reporting_enabled?: number | boolean | null;
  role: AppRole;
  status: "ACTIVE" | "DISABLED";
  password_salt: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
  web_session_generation?: number;
  android_session_generation?: number;
  session_channel?: "WEB" | "ANDROID" | "AGENT" | "";
}

const CORE_OBJECT_NAME = "inventory-core";
const REPORTER_ROLES: AppRole[] = ["REPORTER", "ADMIN", "ROOT"];
const REPORTER_READ_ROLES: AppRole[] = ["REPORTER", "ADMIN", "PICKPACK_ADMIN", "ROOT"];
const PICKPACK_REPORT_ROLES: AppRole[] = ["ADMIN", "PICKPACK_ADMIN", "ROOT"];
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

async function requireIdentity(request: Request, env: BusinessEnv): Promise<FirebaseIdentity> {
  const token = readBearerToken(request);
  if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);
  try {
    return await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw json({ error: "INVALID_AUTH_TOKEN" }, 401);
  }
}

function authorizedHeaders(identity: FirebaseIdentity, contentType = false): Headers {
  const headers = new Headers();
  headers.set("x-supra-auth-uid", identity.uid);
  headers.set("x-supra-session-channel", identity.sessionChannel);
  headers.set("x-supra-session-generation", String(identity.sessionGeneration));
  if (contentType) headers.set("content-type", "application/json");
  return headers;
}

function publicAuthorizedResponse(response: Response): { response: Response; userId: string } {
  const userId = response.headers.get("x-supra-internal-user-id") || "";
  const headers = new Headers(response.headers);
  headers.delete("x-supra-internal-user-id");
  return {
    response: new Response(response.body, { status: response.status, statusText: response.statusText, headers }),
    userId,
  };
}

async function authorizedGet(request: Request, env: BusinessEnv, path: string): Promise<Response> {
  const identity = await requireIdentity(request, env);
  const raw = await coreStub(env).fetch(`https://inventory-core.internal${path}`, { headers: authorizedHeaders(identity) });
  return publicAuthorizedResponse(raw).response;
}

async function requireUser(request: Request, env: BusinessEnv, roles?: AppRole[]): Promise<InternalUser> {
  const identity = await requireIdentity(request, env);
  const user = await coreUserByFirebaseUid(env, identity.uid);
  if (!user || user.status !== "ACTIVE") throw json({ error: "USER_NOT_ACTIVE" }, 403);
  const sessionError = interactiveSessionError(identity, user);
  if (sessionError) throw json({ error: sessionError }, 401);
  if (roles && !roles.includes(user.role)) throw json({ error: "FORBIDDEN" }, 403);
  return { ...user, session_channel: identity.sessionChannel };
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

function pickerShortageReportingEnabled(user: InternalUser): boolean {
  if (user.role !== "PICKER") return true;
  return user.shortage_reporting_enabled === true || Number(user.shortage_reporting_enabled ?? 0) === 1;
}


function requiredRolesForBusinessRoute(key: string): AppRole[] | undefined {
  if (key.startsWith("POST /api/picker/") || key.startsWith("GET /api/picker/")) return ["PICKER"];
  if (key.startsWith("GET /api/reporter/")) return REPORTER_READ_ROLES;
  if (key.startsWith("POST /api/reporter/")) return REPORTER_ROLES;
  if (key === "POST /api/admin/skus/import") return PICKPACK_REPORT_ROLES;
  if ([
    "GET /api/admin/reports",
    "GET /api/admin/dashboard",
    "GET /api/admin/reporting",
    "GET /api/admin/reporting-detail",
    "GET /api/admin/dashboard-preference",
    "PUT /api/admin/dashboard-preference",
    "GET /api/admin/operational-insights",
    "GET /api/admin/alert-window",
    "PUT /api/admin/alert-window",
  ].includes(key)) return PICKPACK_REPORT_ROLES;
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
  const metadata: Record<string, unknown> = { ...(options.metadata || {}) };
  try {
    const payload = (await response.clone().json()) as {
      event_id?: string | null;
      batch_id?: string;
      ticket?: { batch_id?: string };
      acknowledgement?: { batch_id?: string };
      queue_delta?: unknown;
      recent_counter?: unknown;
      overdue_delta?: unknown;
    };
    eventId = String(payload.event_id || "");
    batchId = String(batchId || payload.batch_id || payload.ticket?.batch_id || payload.acknowledgement?.batch_id || "");
    const queueDelta = Number(payload.queue_delta);
    if (Number.isInteger(queueDelta) && queueDelta >= -1 && queueDelta <= 1) metadata.queue_delta = queueDelta;
    if (payload.recent_counter && typeof payload.recent_counter === "object" && !Array.isArray(payload.recent_counter)) {
      metadata.recent_counter = payload.recent_counter;
    }
    const overdueDelta = Number(payload.overdue_delta);
    if (Number.isInteger(overdueDelta) && overdueDelta >= -1 && overdueDelta <= 1) metadata.overdue_delta = overdueDelta;
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
      metadata,
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

function resolverRoleLabel(role: string): string {
  if (role === "ADMIN") return "Quản trị Invent";
  if (role === "REPORTER") return "Người báo hàng";
  if (role === "ROOT") return "Quản trị hệ thống";
  if (role === "PICKPACK_ADMIN") return "Quản trị Pick Pack";
  return role || "Hệ thống";
}

function scheduleFcm(
  response: Response,
  env: BusinessEnv,
  ctx: ExecutionContext | undefined,
  options: {
    event: string;
    target: NotificationTarget;
    title: string;
    body: string;
    resolution?: "HAS_STOCK" | "SKIP_ALLOWED" | "PENDING";
  },
): void {
  if (!ctx || !env.GOOGLE_RUNTIME_SA_JSON || !response.ok) return;
  ctx.waitUntil((async () => {
    try {
      const mutation = (await response.clone().json()) as {
        event_id?: string | null;
        batch_id?: string;
        ticket?: { batch_id?: string };
        resolution_source?: string;
        from_status?: string;
        resolved_by_display_name?: string;
        resolved_by_employee_code?: string;
        resolved_by_role?: string;
      };
      const resultEventId = String(mutation.event_id || "");
      const batchId = String(options.target.batchId || mutation.batch_id || mutation.ticket?.batch_id || "");

      const alertWindowResponse = await coreGet(env, "/notifications/alert-window/reconcile");
      if (!alertWindowResponse.ok) return;
      const alertWindow = (await alertWindowResponse.json()) as { is_open?: boolean };
      if (alertWindow.is_open !== true) return;

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
      const batchProductName = String(targetPayload.batch?.product_name || "");
      const resolverName = String(mutation.resolved_by_display_name || mutation.resolved_by_employee_code || "").trim();
      const resolverRole = String(mutation.resolved_by_role || "").trim().toUpperCase();
      const resolutionSource = String(mutation.resolution_source || "").trim();
      const fromStatus = String(mutation.from_status || "").trim().toUpperCase();
      const fromLabel = fromStatus === "SKIP_ALLOWED" ? "Skip" : fromStatus === "HAS_STOCK" ? "Đã có hàng" : "Trạng thái trước";
      const toLabel = options.resolution === "PENDING" ? "Đang xử lý" : options.resolution === "HAS_STOCK" ? "Đã có hàng" : "Skip";
      const humanResolver = resolverName || (resolutionSource === "SYSTEM_TIMEOUT" ? "Hệ thống tự động" : "Nhân sự Inventory");
      const roleLabel = resolutionSource === "SYSTEM_TIMEOUT" ? "Hệ thống" : resolverRoleLabel(resolverRole);
      const renderedBody = options.body
        .replaceAll("{sku}", batchSku || "SKU")
        .replaceAll("{product}", batchProductName || "Chưa có tên sản phẩm")
        .replaceAll("{actor}", humanResolver)
        .replaceAll("{role}", roleLabel)
        .replaceAll("{source}", resolutionSource || "REPORTER")
        .replaceAll("{from_status}", fromLabel)
        .replaceAll("{to_status}", toLabel);
      const delivery = await sendFcmNotifications(env.GOOGLE_RUNTIME_SA_JSON!, env.FIREBASE_PROJECT_ID, tokens, {
        title: options.title,
        body: renderedBody,
        data: {
          event: options.event,
          batch_id: batchId,
          result_event_id: resultEventId,
          event_seq: eventSeq,
          batch_version: batchVersion,
          sku: batchSku,
          product_name: batchProductName,
          resolution: options.resolution || "",
          resolver_name: humanResolver,
          resolver_role: resolverRole,
          resolver_role_label: roleLabel,
          resolution_source: resolutionSource,
          correction_from_status: fromStatus,
          correction_to_status: options.resolution || "",
          correction_reason: fromStatus ? "REPORTER_CORRECTION" : "",
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


function scheduleCatalogRefreshFcm(
  response: Response,
  env: BusinessEnv,
  ctx: ExecutionContext | undefined,
): void {
  if (!ctx || !env.GOOGLE_RUNTIME_SA_JSON || !response.ok) return;
  ctx.waitUntil((async () => {
    try {
      const targetResponse = await corePost(env, "/notifications/targets", {
        roles: ["PICKER", "REPORTER", "ADMIN"],
        user_ids: [],
      });
      if (!targetResponse.ok) return;
      const targetPayload = (await targetResponse.json()) as { tokens?: string[] };
      const tokens = targetPayload.tokens || [];
      if (!tokens.length) return;
      const delivery = await sendFcmNotifications(
        env.GOOGLE_RUNTIME_SA_JSON!,
        env.FIREBASE_PROJECT_ID,
        tokens,
        {
          title: "",
          body: "",
          data: {
            event: "sku_catalog_updated",
            source: "WEB_SKU_IMPORT",
          },
        },
      );
      if (delivery.invalidTokens.length) {
        await corePost(env, "/notifications/disable-tokens", { tokens: delivery.invalidTokens });
      }
    } catch {
      // Silent catalog refresh is best-effort. Realtime/version reconciliation remains authoritative.
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
    "GET /api/reporter/overdue",
    "GET /api/reporter/counters",
    "POST /api/reporter/batches/resolve",
    "POST /api/reporter/batches/correct",
    "GET /api/admin/reports",
    "GET /api/admin/dashboard",
    "GET /api/admin/reporting",
    "GET /api/admin/reporting-detail",
    "GET /api/admin/audit-history",
    "GET /api/admin/dashboard-preference",
    "PUT /api/admin/dashboard-preference",
    "GET /api/admin/operational-insights",
    "GET /api/admin/sla",
    "PUT /api/admin/sla",
    "GET /api/admin/alert-window",
    "PUT /api/admin/alert-window",
  ]);
  if (!supported.has(key)) return null;

  // D162 high-volume paths verify the Firebase signature in the Worker and perform
  // authoritative user/session/role validation plus the operation in one InventoryCore call.
  if (key === "GET /api/picker/reports") {
    const params = new URLSearchParams();
    for (const name of ["limit", "offset", "scope"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return authorizedGet(request, env, `/authorized/operational/picker/reports?${params.toString()}`);
  }

  if (key === "GET /api/picker/results") {
    const params = new URLSearchParams();
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    return authorizedGet(request, env, `/authorized/operational/picker/results?${params.toString()}`);
  }

  if (key === "GET /api/reporter/queue") {
    const params = new URLSearchParams();
    for (const name of ["limit", "offset"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return authorizedGet(request, env, `/authorized/operational/reporter/queue?${params.toString()}`);
  }

  if (key === "GET /api/reporter/overdue") {
    const params = new URLSearchParams();
    for (const name of ["limit", "offset"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return authorizedGet(request, env, `/authorized/operational/reporter/overdue?${params.toString()}`);
  }

  if (key === "GET /api/reporter/counters") {
    const params = new URLSearchParams();
    for (const name of ["status", "from", "to"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return authorizedGet(request, env, `/authorized/operational/reporter/counters?${params.toString()}`);
  }

  if (key === "POST /api/picker/results/receipt") {
    const identity = await requireIdentity(request, env);
    const body = await parseObjectBody(request);
    const raw = await coreStub(env).fetch("https://inventory-core.internal/authorized/operational/picker/result-stage", {
      method: "POST",
      headers: authorizedHeaders(identity, true),
      body: JSON.stringify(body),
    });
    const authorized = publicAuthorizedResponse(raw);
    const stage = String(body.stage || "").toUpperCase();
    if (stage !== "ACKNOWLEDGED" || !authorized.response.ok) return authorized.response;
    return realtimeAfter(authorized.response, env, {
      event: "result_acknowledged",
      scopes: ["reporter_recent", "picker_reports"],
      tags: [...REPORTER_TAGS, `user:${authorized.userId}`],
    });
  }

  // Authentication/authorization for the remaining lower-volume routes stays explicit.
  // request must never trigger schema work or turn an expected 401/403 into a readiness 503.
  const user = await requireUser(request, env, requiredRolesForBusinessRoute(key));
  if (user.session_channel === "ANDROID" && request.method !== "GET") {
    const windowResponse = await coreGet(env, "/notifications/alert-window/reconcile");
    if (!windowResponse.ok) return json({ error: "ANDROID_WINDOW_UNAVAILABLE" }, 503);
    const windowState = (await windowResponse.json()) as { is_open?: boolean; server_now_ms?: number };
    if (windowState.is_open !== true) {
      return json({
        error: "ANDROID_WINDOW_CLOSED",
        message: "Ngoài cửa sổ kỹ thuật Replay 05:45–22:15 và chưa có lệnh tăng ca/bật sớm hiện hành.",
        server_now_ms: Number(windowState.server_now_ms || 0),
      }, 403);
    }
  }
  if (key.startsWith("GET /api/admin/") || key.startsWith("POST /api/admin/") || key.startsWith("PUT /api/admin/")) {
    if (user.session_channel === "ANDROID") return json({ error: "MANAGEMENT_WEB_ONLY" }, 403);
  }
  if (key === "GET /api/admin/alert-window") {
    return coreGet(env, "/notifications/alert-window/reconcile");
  }

  if (key === "PUT /api/admin/alert-window") {
    return json({
      error: "ALERT_WINDOW_AGENT_AUTHORITY_D149",
      message: "Ca vận hành được quyết định tập trung từ Agent; Web chỉ hiển thị trạng thái dùng chung.",
    }, 409);
  }

  if (key === "POST /api/admin/skus/import") {
    const body = await parseObjectBody(request);
    const items = Array.isArray(body.items) ? body.items : [];
    const suppliedHash = String(body.source_hash || "").trim();
    const sourceHash = suppliedHash || (await sha256Hex(JSON.stringify(items)));
    const response = await corePost(env, "/business/skus/import-v2", { ...body, source_hash: sourceHash, actor: actor(user) });
    const result = await realtimeAfter(response, env, {
      event: "sku_catalog_updated",
      scopes: ["sku_catalog"],
      tags: ["role:PICKER", "role:REPORTER", "role:ADMIN"],
      metadata: { source: "WEB_SKU_IMPORT" },
    });
    scheduleCatalogRefreshFcm(result, env, ctx);
    return result;
  }

  if (key === "GET /api/skus") {
    const params = new URLSearchParams();
    if (url.searchParams.has("query")) params.set("query", url.searchParams.get("query") || "");
    if (url.searchParams.has("limit")) params.set("limit", url.searchParams.get("limit") || "");
    if (url.searchParams.has("offset")) params.set("offset", url.searchParams.get("offset") || "");
    return coreGet(env, `/business/skus/search?${params.toString()}`);
  }

  if (key === "POST /api/picker/reports") {
    if (!pickerShortageReportingEnabled(user)) {
      return json({ error: "PICKER_SHORTAGE_REPORTING_DISABLED", message: "Chức năng Báo hàng đang tắt cho tài khoản này." }, 403);
    }
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

  if (key === "POST /api/picker/reports/withdraw") {
    if (!pickerShortageReportingEnabled(user)) {
      return json({ error: "PICKER_SHORTAGE_REPORTING_DISABLED", message: "Chức năng Báo hàng đang tắt cho tài khoản này." }, 403);
    }
    const body = await parseObjectBody(request);
    const response = await corePost(env, "/business/reports/withdraw", { ...body, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "report_withdrawn",
      scopes: ["reporter_queue", "reporter_overdue", "reporter_recent", "picker_reports"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });
  }

  if (key === "POST /api/reporter/batches/resolve") {
    const body = await parseObjectBody(request);
    const batchId = String(body.batch_id || "").trim();
    const response = await corePost(env, "/business/reporter/resolve", { ...body, actor: actor(user) });
    const result = await realtimeAfter(response, env, {
      event: "batch_resolved",
      scopes: ["reporter_queue", "reporter_overdue", "reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
    const resolution = String(body.resolution || "");
    scheduleFcm(result, env, ctx, {
      event: "batch_resolved",
      target: { batchId },
      title: resolution === "HAS_STOCK" ? "SUPRA Inventory · Đã có hàng" : "SUPRA Inventory · Được skip",
      body: resolution === "HAS_STOCK"
        ? "{sku} · {product}\nĐã có hàng · {actor} · {role}"
        : "{sku} · {product}\nCho phép skip · {actor} · {role}",
      resolution: resolution === "HAS_STOCK" ? "HAS_STOCK" : "SKIP_ALLOWED",
    });
    return result;
  }

  if (key === "POST /api/reporter/batches/correct") {
    const body = await parseObjectBody(request);
    const batchId = String(body.batch_id || "").trim();
    const target = String(body.target || "").trim().toUpperCase();
    const response = await corePost(env, "/business/reporter/correct", { ...body, actor: actor(user) });
    const result = await realtimeAfter(response, env, {
      event: "batch_corrected",
      scopes: ["reporter_queue", "reporter_overdue", "reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
    if (["PENDING", "SKIP_ALLOWED", "HAS_STOCK"].includes(target)) {
      // BATCH_CORRECTED creates version-specific ACK targets from the exact batch
      // reporters. Never widen FCM to all Pickers or send an additional poll.
      scheduleFcm(result, env, ctx, {
        event: target === "PENDING" ? "batch_corrected_pending" : "batch_corrected",
        target: { batchId },
        title: "SUPRA Inventory · Sửa kết quả báo hàng",
        body: "Báo hàng {sku} · {product}\\nSKU chuyển trạng thái từ {from_status} sang {to_status}.\\nLý do: {actor} ({role}) sửa kết quả.",
        resolution: target as "PENDING" | "SKIP_ALLOWED" | "HAS_STOCK",
      });
    }
    return result;
  }

  if (key === "GET /api/admin/sla") {
    return coreGet(env, "/operational/sla");
  }

  if (key === "PUT /api/admin/sla") {
    const body = await parseObjectBody(request);
    const currentPassword = String(body.current_password || "");
    const proof = await verifyCurrentAuthenticationProof(env, user, currentPassword);
    if (!proof.valid) {
      return json({
        error: "CURRENT_PASSWORD_INVALID",
        message: "Mật khẩu xác nhận không đúng. Tài khoản đặc quyền dùng mật khẩu một lần hoặc mật khẩu khẩn cấp.",
      }, 403);
    }
    const { current_password: _password, ...safeBody } = body;
    const response = await corePut(env, "/operational/sla", { ...safeBody, actor: actor(user) });
    return realtimeAfter(response, env, {
      event: "sla_settings_updated",
      scopes: ["sla_settings", "reporter_queue", "reporter_overdue"],
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

  if (key === "GET /api/admin/dashboard" || key === "GET /api/admin/reporting" || key === "GET /api/admin/reporting-detail") {
    const params = new URLSearchParams();
    for (const name of ["from", "to", "status", "query", "limit", "offset", "batch_id"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    const path = key.endsWith("dashboard")
      ? "/business/admin/dashboard"
      : (key.endsWith("reporting-detail") ? "/business/admin/reporting-detail" : "/business/admin/reporting");
    return coreGet(env, `${path}?${params.toString()}`);
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
