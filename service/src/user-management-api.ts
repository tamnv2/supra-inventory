import { hashPassword, interactiveSessionError, readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";
import { importPasswordIdentity, updateFirebaseIdentity, type FirebaseManagedUserSpec } from "./firebase-auth-admin";
import { readHrEmployees, type StoredHrSource } from "./hr-sync";
import { validateHrSheetSource } from "./hr-source";

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  PICKER_DEFAULT_PASSWORD?: string;
  ROOT_BOOTSTRAP_PASSWORD?: string;
}
interface User {
  user_id: string;
  firebase_uid?: string | null;
  employee_code: string | null;
  display_name?: string;
  role: AppRole;
  base_role?: AppRole;
  status: "ACTIVE" | "DISABLED";
  auth_email?: string | null;
  password_salt?: string | null;
  password_hash?: string | null;
  firebase_password_ready?: boolean | number;
  firebase_agent_ready?: boolean | number;
  web_session_generation?: number;
  android_session_generation?: number;
}
const ROLES: AppRole[] = ["ADMIN", "ROOT"];

function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function core(env: Env): DurableObjectStub { return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core")); }
async function requireAdmin(request: Request, env: Env): Promise<User> {
  const token = readBearerToken(request); if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);
  let identity; try { identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID); } catch { throw json({ error: "INVALID_AUTH_TOKEN" }, 401); }
  const lookup = await core(env).fetch(`https://inventory-core.internal/auth/user-by-firebase-uid?uid=${encodeURIComponent(identity.uid)}`);
  const user = lookup.ok ? ((await lookup.json()) as { user?: User | null }).user : null;
  if (!user || user.status !== "ACTIVE") throw json({ error: "USER_NOT_ACTIVE" }, 403);
  const sessionError = interactiveSessionError(identity, user);
  if (sessionError) throw json({ error: sessionError }, 401);
  if (!ROLES.includes(user.role)) throw json({ error: "FORBIDDEN" }, 403);
  return user;
}
function actor(user: User) { return { user_id: user.user_id, employee_code: user.employee_code, role: user.role }; }

async function coreUserById(env: Env, userId: string): Promise<User | null> {
  const response = await core(env).fetch(`https://inventory-core.internal/auth/user-by-id?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) return null;
  return ((await response.json()) as { user?: User | null }).user || null;
}

async function linkFirebaseUid(env: Env, userId: string, uid: string): Promise<void> {
  const response = await core(env).fetch("https://inventory-core.internal/auth/link-firebase-uid", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, firebase_uid: uid }),
  });
  if (!response.ok) throw new Error("FIREBASE_UID_LINK_FAILED");
}

async function markFirebaseReady(env: Env, userId: string, uid: string): Promise<void> {
  const response = await core(env).fetch("https://inventory-core.internal/auth/firebase-password-ready", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, firebase_uid: uid }),
  });
  if (!response.ok) throw new Error("FIREBASE_READY_MARK_FAILED");
}
async function markAgentFirebaseReady(env: Env, userId: string): Promise<void> {
  const response = await core(env).fetch("https://inventory-core.internal/auth/firebase-agent-ready", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error("FIREBASE_AGENT_READY_MARK_FAILED");
}


function firebaseSpec(user: User, uid: string, derived?: { salt: string; hash: string }): FirebaseManagedUserSpec {
  return {
    uid,
    userId: user.user_id,
    employeeCode: user.employee_code,
    displayName: user.display_name || user.employee_code || user.user_id,
    role: (user.base_role || user.role) as AppRole,
    status: user.status,
    authEmail: user.auth_email || null,
    passwordSalt: derived?.salt || user.password_salt || null,
    passwordHash: derived?.hash || user.password_hash || null,
  };
}

async function provisionManagedCredential(
  env: Env,
  user: User,
  derived: { salt: string; hash: string },
  plainPassword: string,
): Promise<User> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  const uid = String(user.firebase_uid || user.user_id);
  if (!user.firebase_uid) await linkFirebaseUid(env, user.user_id, uid);
  if (Boolean(user.firebase_password_ready)) {
    await updateFirebaseIdentity(
      env.GOOGLE_RUNTIME_SA_JSON,
      env.FIREBASE_PROJECT_ID,
      firebaseSpec(user, uid, derived),
      { password: plainPassword },
    );
  } else {
    await importPasswordIdentity(
      env.GOOGLE_RUNTIME_SA_JSON,
      env.FIREBASE_PROJECT_ID,
      firebaseSpec(user, uid, derived),
    );
  }
  await markFirebaseReady(env, user.user_id, uid);
  const primaryReady = (await coreUserById(env, user.user_id)) || { ...user, firebase_uid: uid, firebase_password_ready: true };
  if ((primaryReady.base_role || primaryReady.role) === "ADMIN") {
    // Same Firebase UID serves Web/App/Agent. Mark the direct Agent username
    // path ready after the primary credential is synchronized.
    await markAgentFirebaseReady(env, user.user_id);
  }
  return (await coreUserById(env, user.user_id)) || primaryReady;
}

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
async function derivePassword(value: unknown): Promise<{ salt: string; hash: string }> {
  const password = String(value || "");
  if (!password) throw new Error("PASSWORD_REQUIRED");
  return hashPassword(password);
}
async function derivePickerDefault(env: Env): Promise<{ salt: string; hash: string }> {
  const password = env.PICKER_DEFAULT_PASSWORD || env.ROOT_BOOTSTRAP_PASSWORD || "";
  if (!password) throw new Error("PICKER_DEFAULT_PASSWORD_NOT_CONFIGURED");
  return hashPassword(password);
}

export async function handleUserManagementApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const supported = new Set([
    "GET /api/admin/users", "POST /api/admin/users", "PATCH /api/admin/users",
    "PUT /api/admin/users/password", "POST /api/admin/pickers/bulk",
    "PUT /api/admin/hr-source-v2", "POST /api/admin/hr-sync/preview", "POST /api/admin/hr-sync/apply",
  ]);
  const key = `${request.method} ${url.pathname}`;
  if (!supported.has(key)) return null;
  const user = await requireAdmin(request, env);

  if (key === "GET /api/admin/users") {
    const params = new URLSearchParams();
    for (const name of ["query","role","status","limit","offset"]) if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    return core(env).fetch(`https://inventory-core.internal/admin/users?${params.toString()}`);
  }
  if (key === "POST /api/admin/users") {
    const body = await bodyObject(request);
    const plainPassword = String(body.password || "");
    try {
      const derived = await derivePassword(plainPassword);
      const { password: _password, ...safeBody } = body;
      const createdResponse = await core(env).fetch("https://inventory-core.internal/admin/users/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...safeBody, password_salt: derived.salt, password_hash: derived.hash, actor: actor(user) }),
      });
      const createdPayload = (await createdResponse.json()) as { user?: User; error?: string };
      if (!createdResponse.ok || !createdPayload.user) {
        return json(createdPayload, createdResponse.status);
      }
      const provisioned = await provisionManagedCredential(env, createdPayload.user, derived, plainPassword);
      return json({
        status: "created",
        user: {
          ...createdPayload.user,
          firebase_uid: provisioned.firebase_uid,
          auth_email: provisioned.auth_email || createdPayload.user.auth_email || null,
          firebase_password_ready: true,
        },
      }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không tạo được tài khoản.";
      const credentialFailure = message.startsWith("FIREBASE_") || message === "GOOGLE_RUNTIME_NOT_CONFIGURED";
      return json({
        error: credentialFailure ? "FIREBASE_ACCOUNT_PROVISION_FAILED" : "INVALID_PASSWORD",
        message: credentialFailure ? "Không đồng bộ được tài khoản Firebase." : message,
      }, credentialFailure ? 502 : 400);
    }
  }
  if (key === "PATCH /api/admin/users") {
    const body = await bodyObject(request);
    const targetId = String(body.user_id || "").trim();
    const before = targetId ? await coreUserById(env, targetId) : null;
    const updatedResponse = await core(env).fetch("https://inventory-core.internal/admin/users/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, actor: actor(user) }),
    });
    const updatedPayload = (await updatedResponse.json()) as { user?: User; error?: string };
    if (!updatedResponse.ok || !updatedPayload.user) return json(updatedPayload, updatedResponse.status);
    const updated = updatedPayload.user;
    if (
      env.GOOGLE_RUNTIME_SA_JSON &&
      updated.firebase_uid &&
      Boolean(updated.firebase_password_ready || before?.firebase_password_ready)
    ) {
      try {
        await updateFirebaseIdentity(
          env.GOOGLE_RUNTIME_SA_JSON,
          env.FIREBASE_PROJECT_ID,
          firebaseSpec({ ...before, ...updated }, String(updated.firebase_uid)),
        );
        await markFirebaseReady(env, updated.user_id, String(updated.firebase_uid));
        updated.firebase_password_ready = true;
        if ((updated.base_role || updated.role) === "ADMIN") {
          await markAgentFirebaseReady(env, updated.user_id);
          updated.firebase_agent_ready = true;
        }
      } catch {
        return json({
          error: "FIREBASE_ACCOUNT_UPDATE_FAILED",
          message: "Thông tin nghiệp vụ đã lưu nhưng chưa đồng bộ được Firebase. Không tiếp tục sử dụng tài khoản cho tới khi đồng bộ lại.",
        }, 502);
      }
    }
    return json({ status: "updated", user: updated });
  }
  if (key === "PUT /api/admin/users/password") {
    const body = await bodyObject(request);
    const userId = String(body.user_id || "").trim();
    const plainPassword = String(body.password || "");
    try {
      const before = userId ? await coreUserById(env, userId) : null;
      if (!before) return json({ error: "USER_NOT_FOUND" }, 404);
      const derived = await derivePassword(plainPassword);
      const changedResponse = await core(env).fetch("https://inventory-core.internal/admin/users/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, request_id: body.request_id, password_salt: derived.salt, password_hash: derived.hash, actor: actor(user) }),
      });
      if (!changedResponse.ok) return changedResponse;
      const after = (await coreUserById(env, userId)) || before;
      await provisionManagedCredential(env, after, derived, plainPassword);
      return json({ status: "password_changed", user_id: userId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không đổi được mật khẩu.";
      const credentialFailure = message.startsWith("FIREBASE_") || message === "GOOGLE_RUNTIME_NOT_CONFIGURED";
      return json({
        error: credentialFailure ? "FIREBASE_ACCOUNT_UPDATE_FAILED" : "INVALID_PASSWORD",
        message: credentialFailure ? "Không đồng bộ được mật khẩu Firebase." : message,
      }, credentialFailure ? 502 : 400);
    }
  }
  if (key === "POST /api/admin/pickers/bulk") {
    const body = await bodyObject(request);
    return core(env).fetch("https://inventory-core.internal/admin/pickers/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, actor: actor(user) }) });
  }
  if (key === "PUT /api/admin/hr-source-v2") {
    if (!env.GOOGLE_RUNTIME_SA_JSON) return json({ error: "GOOGLE_RUNTIME_NOT_CONFIGURED" }, 503);
    const body = await bodyObject(request);
    try {
      const validated = await validateHrSheetSource(env.GOOGLE_RUNTIME_SA_JSON, {
        sheet_url: String(body.sheet_url || ""),
        tab_name: String(body.tab_name || ""),
        employee_code_header: String(body.employee_code_header || ""),
        full_name_header: String(body.full_name_header || ""),
      });
      const saved = await core(env).fetch("https://inventory-core.internal/config/hr-source", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...validated, updated_by: user.user_id }),
      });
      if (!saved.ok) return saved;
      return json({ status: "saved", source: validated });
    } catch (error) {
      return json({ error: "HR_SOURCE_INVALID", message: error instanceof Error ? error.message : "Nguồn nhân sự không hợp lệ." }, 400);
    }
  }

  try {
    const read = await hrEmployees(env);
    if (key === "POST /api/admin/hr-sync/preview") {
      return core(env).fetch("https://inventory-core.internal/admin/hr-sync/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor: actor(user), employees: read.employees }) });
    }
    const body = await bodyObject(request);
    const pickerDefault = await derivePickerDefault(env);
    return core(env).fetch("https://inventory-core.internal/admin/hr-sync/apply", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, actor: actor(user), employees: read.employees, picker_password_salt: pickerDefault.salt, picker_password_hash: pickerDefault.hash }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được nguồn nhân sự.";
    return json({ error: "HR_SYNC_SOURCE_FAILED", message }, message === "PICKER_DEFAULT_PASSWORD_NOT_CONFIGURED" ? 503 : 400);
  }
}
