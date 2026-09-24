type SqlRow = Record<string, SqlStorageValue>;
type AppRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
type UserStatus = "ACTIVE" | "DISABLED";
type PickerBulkAction = "ENABLE" | "DISABLE" | "DELETE";

type Actor = { user_id: string; employee_code: string | null; role: AppRole; display_name?: string };
type HrEmployee = { employee_code?: unknown; display_name?: unknown };

interface UserRow extends SqlRow {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: AppRole;
  status: UserStatus;
  password_salt: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
  auth_email: string | null;
  firebase_password_ready: number;
  created_at: string;
  updated_at: string;
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
function first<T>(rows: T[]): T | null { return rows[0] ?? null; }
function normalizeLogin(value: unknown): string { return String(value ?? "").trim().toLowerCase(); }
function normalizeName(value: unknown): string { return String(value ?? "").trim().replace(/\s+/g, " "); }
function validLogin(value: string): boolean { return /^[a-z0-9._-]{1,64}$/.test(value); }
function validRequestId(value: unknown): string | null { const v = String(value ?? "").trim(); return /^[A-Za-z0-9._:-]{8,160}$/.test(v) ? v : null; }
function validPasswordPart(value: unknown): value is string { const v = String(value ?? ""); return v.length >= 16 && v.length <= 256; }

function audit(state: DurableObjectState, actor: Actor, action: string, targetType: string, targetId: string, metadata: Record<string, unknown>): void {
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO audit_log (
       audit_id, actor_user_id, actor_employee_code, actor_role, actor_display_name,
       action, target_type, target_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(), actor.user_id, actor.employee_code, actor.role, actor.display_name || null,
    action, targetType, targetId, JSON.stringify(metadata), at,
  );
}

function canCreateRole(actorRole: AppRole, targetRole: AppRole): boolean {
  if (actorRole === "ROOT") return targetRole === "ADMIN" || targetRole === "REPORTER";
  if (actorRole === "ADMIN") return targetRole === "REPORTER";
  return false;
}

function canManageTarget(actorRole: AppRole, targetRole: AppRole): boolean {
  if (targetRole === "ROOT") return false;
  if (actorRole === "ROOT") return targetRole === "ADMIN" || targetRole === "REPORTER" || targetRole === "PICKER";
  if (actorRole === "ADMIN") return targetRole === "REPORTER" || targetRole === "PICKER";
  return false;
}

function safeUser(row: UserRow): Record<string, unknown> {
  return {
    user_id: row.user_id, firebase_uid: row.firebase_uid, employee_code: row.employee_code,
    display_name: row.display_name, role: row.role, status: row.status,
    auth_email: row.auth_email || null,
    firebase_password_ready: Number(row.firebase_password_ready || 0) === 1,
    password_initialized: Boolean(row.password_hash && row.password_salt), password_changed_at: row.password_changed_at,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

function getUser(state: DurableObjectState, userId: string): UserRow | null {
  return first(state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_salt, password_hash, password_changed_at, auth_email, firebase_password_ready, created_at, updated_at
       FROM users WHERE user_id = ? LIMIT 1`, userId,
  ).toArray());
}

function listUsers(state: DurableObjectState, url: URL): Response {
  const query = String(url.searchParams.get("query") || "").trim().toLowerCase().slice(0, 200);
  const role = String(url.searchParams.get("role") || "").trim().toUpperCase();
  const status = String(url.searchParams.get("status") || "").trim().toUpperCase();
  const parsedLimit = Number(url.searchParams.get("limit") || 100);
  const parsedOffset = Number(url.searchParams.get("offset") || 0);
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100));
  const offset = Math.max(0, Math.min(100_000, Number.isFinite(parsedOffset) ? Math.trunc(parsedOffset) : 0));

  const where: string[] = [];
  const args: SqlStorageValue[] = [];
  if (query) {
    const like = `%${query}%`;
    where.push("(lower(COALESCE(employee_code,'')) LIKE ? OR lower(display_name) LIKE ? OR lower(user_id) LIKE ?)");
    args.push(like, like, like);
  }
  if (["PICKER","REPORTER","ADMIN","ROOT"].includes(role)) {
    where.push("role = ?");
    args.push(role);
  }
  if (["ACTIVE","DISABLED"].includes(status)) {
    where.push("status = ?");
    args.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = first(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS total FROM users ${clause}`,
    ...args,
  ).toArray()) || {};

  const rows = state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status,
            password_salt, password_hash, password_changed_at, auth_email, firebase_password_ready, created_at, updated_at
       FROM users
       ${clause}
      ORDER BY CASE role WHEN 'ROOT' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'REPORTER' THEN 3 ELSE 4 END,
               employee_code ASC, display_name ASC, user_id ASC
      LIMIT ? OFFSET ?`,
    ...args,
    limit,
    offset,
  ).toArray();

  return response({
    items: rows.map(safeUser),
    count: rows.length,
    total: Number(totalRow.total || 0),
    limit,
    offset,
  });
}

async function createManagedUser(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; username?: unknown; display_name?: unknown; role?: AppRole; auth_email?: unknown; request_id?: unknown; password_salt?: unknown; password_hash?: unknown };
  const actor = body.actor;
  const targetRole = String(body.role || "").toUpperCase() as AppRole;
  const username = normalizeLogin(body.username);
  const displayName = normalizeName(body.display_name);
  const authEmail = String(body.auth_email || "").trim().toLowerCase();
  const emailValid = !authEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail);
  if (!actor?.user_id) {
    return response({ error: "USER_CREATE_ACTOR_REQUIRED", message: "Phiên người tạo tài khoản không hợp lệ." }, 400);
  }
  if (!["ADMIN", "REPORTER"].includes(targetRole)) {
    return response({ error: "USER_CREATE_ROLE_INVALID", message: "Chỉ được tạo tài khoản Quản trị hoặc Người xử lý báo hàng." }, 400);
  }
  if (!canCreateRole(actor.role, targetRole)) {
    return response({ error: "USER_CREATE_ROLE_FORBIDDEN", message: "Quyền hiện tại không được tạo loại tài khoản đã chọn." }, 403);
  }
  if (!validLogin(username)) {
    return response({
      error: "USER_CREATE_USERNAME_INVALID",
      message: "Mã nhân viên / tên đăng nhập chỉ dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang; tối đa 64 ký tự.",
    }, 400);
  }
  if (!displayName || displayName.length > 200) {
    return response({ error: "USER_CREATE_DISPLAY_NAME_INVALID", message: "Họ và tên không hợp lệ." }, 400);
  }
  if (!validRequestId(body.request_id)) {
    return response({ error: "USER_CREATE_REQUEST_INVALID", message: "Yêu cầu tạo tài khoản không hợp lệ. Vui lòng thử lại." }, 400);
  }
  if (!validPasswordPart(body.password_salt) || !validPasswordPart(body.password_hash)) {
    return response({ error: "USER_CREATE_PASSWORD_INVALID", message: "Không xử lý được mật khẩu khởi tạo. Vui lòng nhập lại mật khẩu." }, 400);
  }
  if (!emailValid) {
    return response({ error: "USER_CREATE_EMAIL_INVALID", message: "Email đăng ký không hợp lệ." }, 400);
  }
  if (targetRole === "ADMIN" && !authEmail) {
    return response({ error: "USER_CREATE_ADMIN_EMAIL_REQUIRED", message: "Tài khoản Quản trị bắt buộc có email đăng ký." }, 400);
  }
  const existing = first(state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_salt, password_hash, password_changed_at, auth_email, firebase_password_ready, created_at, updated_at
       FROM users WHERE lower(employee_code) = lower(?) OR lower(user_id) = lower(?) LIMIT 1`, username, username,
  ).toArray());
  if (existing) return response({ error: "USER_IDENTIFIER_EXISTS", user: safeUser(existing) }, 409);
  const userId = `${targetRole.toLowerCase()}:${username}`;
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO users (user_id, firebase_uid, employee_code, display_name, role, status, created_at, updated_at, password_salt, password_hash, password_changed_at, auth_email, firebase_password_ready)
     VALUES (?, NULL, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, 0)`,
    userId, username, displayName, targetRole, at, at, body.password_salt, body.password_hash, at, authEmail || null,
  );
  audit(state, actor, "USER_CREATE", "USER", userId, { role: targetRole, employee_code: username, password_mode: "explicit" });
  return response({ status: "created", user: safeUser(getUser(state, userId)!) }, 201);
}

async function updateManagedUser(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; user_id?: string; display_name?: unknown; status?: UserStatus; auth_email?: unknown; request_id?: unknown };
  const actor = body.actor;
  const userId = String(body.user_id || "").trim();
  const target = getUser(state, userId);
  if (!actor?.user_id || !target || !canManageTarget(actor.role, target.role) || !validRequestId(body.request_id)) return response({ error: "USER_NOT_MANAGEABLE" }, 403);
  const displayName = normalizeName(body.display_name ?? target.display_name);
  const status = String(body.status || target.status).toUpperCase() as UserStatus;
  const authEmail = body.auth_email == null ? (target.auth_email || "") : String(body.auth_email || "").trim().toLowerCase();
  const emailValid = !authEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail);
  if (!displayName || displayName.length > 200 || !["ACTIVE","DISABLED"].includes(status) || !emailValid || (target.role === "ADMIN" && !authEmail)) return response({ error: "INVALID_USER_UPDATE" }, 400);
  state.storage.sql.exec(`UPDATE users SET display_name = ?, status = ?, auth_email = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, displayName, status, authEmail || null, userId);
  if (status === "DISABLED") {
    state.storage.sql.exec(`UPDATE fcm_devices SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, userId);
    state.storage.sql.exec(`DELETE FROM presence_sessions WHERE user_id = ?`, userId);
  }
  audit(state, actor, "USER_UPDATE", "USER", userId, { display_name: displayName, status, role: target.role });
  return response({ status: "updated", user: safeUser(getUser(state, userId)!) });
}

async function setManagedPassword(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; user_id?: string; request_id?: unknown; password_salt?: unknown; password_hash?: unknown };
  const actor = body.actor;
  const userId = String(body.user_id || "").trim();
  const target = getUser(state, userId);
  if (!actor?.user_id || !target || !canManageTarget(actor.role, target.role) || !validRequestId(body.request_id) || !validPasswordPart(body.password_salt) || !validPasswordPart(body.password_hash)) {
    return response({ error: "USER_NOT_MANAGEABLE" }, 403);
  }
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `UPDATE users
        SET password_salt = ?,
            password_hash = ?,
            password_changed_at = ?,
            firebase_password_ready = 0,
            web_session_generation = COALESCE(web_session_generation, 0) + 1,
            web_session_device_id = NULL,
            web_session_started_at = NULL,
            android_session_generation = COALESCE(android_session_generation, 0) + 1,
            android_session_device_id = NULL,
            android_session_started_at = NULL,
            updated_at = ?
      WHERE user_id = ?`,
    body.password_salt, body.password_hash, at, at, userId,
  );
  state.storage.sql.exec(`UPDATE fcm_devices SET enabled = 0, updated_at = ? WHERE user_id = ?`, at, userId);
  state.storage.sql.exec(`DELETE FROM presence_sessions WHERE user_id = ?`, userId);
  audit(state, actor, "USER_PASSWORD_CHANGE_BY_MANAGER", "USER", userId, { role: target.role, sessions_invalidated_by_channel_generation: true });
  return response({ status: "password_changed", user_id: userId });
}

async function deletePicker(state: DurableObjectState, actor: Actor, target: UserRow): Promise<void> {
  audit(state, actor, "PICKER_DELETE", "USER", target.user_id, { employee_code: target.employee_code, display_name: target.display_name });
  state.storage.sql.exec(`DELETE FROM fcm_devices WHERE user_id = ?`, target.user_id);
  state.storage.sql.exec(`DELETE FROM presence_sessions WHERE user_id = ?`, target.user_id);
  state.storage.sql.exec(`DELETE FROM users WHERE user_id = ? AND role = 'PICKER'`, target.user_id);
}

async function pickerBulkAction(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; action?: PickerBulkAction; user_ids?: unknown; excluded_user_ids?: unknown; all?: boolean; request_id?: unknown };
  const actor = body.actor;
  const action = String(body.action || "").toUpperCase() as PickerBulkAction;
  if (!actor?.user_id || !["ADMIN","ROOT"].includes(actor.role) || !["ENABLE","DISABLE","DELETE"].includes(action) || !validRequestId(body.request_id)) {
    return response({ error: "INVALID_PICKER_BULK_ACTION" }, 400);
  }
  let targets = state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_salt, password_hash, password_changed_at, auth_email, firebase_password_ready, created_at, updated_at FROM users WHERE role = 'PICKER' ORDER BY employee_code ASC`,
  ).toArray();
  const excludedIds = Array.isArray(body.excluded_user_ids)
    ? new Set(body.excluded_user_ids.map((value) => String(value || "").trim()).filter(Boolean))
    : new Set<string>();
  if (body.all) {
    if (excludedIds.size) targets = targets.filter((row) => !excludedIds.has(row.user_id));
  } else {
    const ids = Array.isArray(body.user_ids) ? new Set(body.user_ids.map((value) => String(value || "").trim()).filter(Boolean)) : new Set<string>();
    if (!ids.size) return response({ error: "PICKER_SELECTION_REQUIRED" }, 400);
    targets = targets.filter((row) => ids.has(row.user_id));
  }
  const at = new Date().toISOString();
  let affected = 0;
  state.storage.transactionSync(() => {
    for (const target of targets) {
      if (action === "DELETE") {
        audit(state, actor, "PICKER_DELETE", "USER", target.user_id, { employee_code: target.employee_code, display_name: target.display_name, bulk: true });
        state.storage.sql.exec(`DELETE FROM fcm_devices WHERE user_id = ?`, target.user_id);
        state.storage.sql.exec(`DELETE FROM presence_sessions WHERE user_id = ?`, target.user_id);
        state.storage.sql.exec(`DELETE FROM users WHERE user_id = ? AND role = 'PICKER'`, target.user_id);
      } else {
        const nextStatus: UserStatus = action === "ENABLE" ? "ACTIVE" : "DISABLED";
        state.storage.sql.exec(`UPDATE users SET status = ?, updated_at = ? WHERE user_id = ? AND role = 'PICKER'`, nextStatus, at, target.user_id);
        if (nextStatus === "DISABLED") {
          state.storage.sql.exec(`UPDATE fcm_devices SET enabled = 0, updated_at = ? WHERE user_id = ?`, at, target.user_id);
          state.storage.sql.exec(`DELETE FROM presence_sessions WHERE user_id = ?`, target.user_id);
        }
        audit(state, actor, `PICKER_${action}`, "USER", target.user_id, { employee_code: target.employee_code, bulk: true });
      }
      affected += 1;
    }
  });
  audit(state, actor, "PICKER_BULK_ACTION", "USER_SET", String(body.request_id), { action, affected, all: Boolean(body.all), excluded_count: body.all ? excludedIds.size : 0 });
  return response({ status: "applied", action, affected });
}

function normalizeHrEmployees(items: HrEmployee[]): { employees: Array<{ employee_code: string; display_name: string }>; invalid: number[]; duplicates: string[] } {
  const invalid: number[] = [];
  const map = new Map<string, string>();
  const duplicates = new Set<string>();
  items.forEach((item, index) => {
    const code = normalizeLogin(item.employee_code);
    const name = normalizeName(item.display_name);
    if (!validLogin(code) || !name || name.length > 200) { invalid.push(index + 1); return; }
    const old = map.get(code);
    if (old && old !== name) duplicates.add(code);
    else map.set(code, name);
  });
  return { employees: [...map].map(([employee_code, display_name]) => ({ employee_code, display_name })), invalid, duplicates: [...duplicates] };
}

function hrPlan(state: DurableObjectState, employees: Array<{ employee_code: string; display_name: string }>): Record<string, unknown> {
  const incoming = new Map(employees.map((item) => [item.employee_code, item.display_name]));
  const existing = state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_salt, password_hash, password_changed_at, auth_email, firebase_password_ready, created_at, updated_at FROM users`,
  ).toArray();
  const byCode = new Map(existing.filter((u) => u.employee_code).map((u) => [String(u.employee_code).toLowerCase(), u]));
  const collisions: Array<{ employee_code: string; role: AppRole; user_id: string }> = [];
  let create = 0, rename = 0, unchanged = 0, inactiveExisting = 0;
  for (const [code, name] of incoming) {
    const current = byCode.get(code);
    if (!current) create += 1;
    else if (current.role !== "PICKER") collisions.push({ employee_code: code, role: current.role, user_id: current.user_id });
    else if (current.status !== "ACTIVE") inactiveExisting += 1;
    else if (current.display_name !== name) rename += 1;
    else unchanged += 1;
  }
  const notInSource = existing.filter((u) => u.role === "PICKER" && u.employee_code && !incoming.has(String(u.employee_code).toLowerCase())).length;
  return { total_source: employees.length, create, reactivate: 0, rename, disable: 0, unchanged, inactive_existing: inactiveExisting, not_in_source: notInSource, collisions };
}

async function hrPreview(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; employees?: HrEmployee[] };
  if (!body.actor?.user_id || !["ADMIN","ROOT"].includes(body.actor.role) || !Array.isArray(body.employees)) return response({ error: "INVALID_HR_SYNC" }, 400);
  const normalized = normalizeHrEmployees(body.employees);
  if (normalized.invalid.length || normalized.duplicates.length) return response({ error: "INVALID_HR_ROWS", invalid_rows: normalized.invalid.slice(0,100), duplicate_conflicts: normalized.duplicates.slice(0,100) }, 400);
  return response({ status: "preview", ...hrPlan(state, normalized.employees) });
}

async function hrApply(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; employees?: HrEmployee[]; request_id?: unknown; confirm?: boolean; picker_password_salt?: unknown; picker_password_hash?: unknown };
  const actor = body.actor;
  if (!actor?.user_id || !["ADMIN","ROOT"].includes(actor.role) || !Array.isArray(body.employees) || body.confirm !== true || !validRequestId(body.request_id) || !validPasswordPart(body.picker_password_salt) || !validPasswordPart(body.picker_password_hash)) return response({ error: "INVALID_HR_SYNC" }, 400);
  const normalized = normalizeHrEmployees(body.employees);
  if (normalized.invalid.length || normalized.duplicates.length) return response({ error: "INVALID_HR_ROWS", invalid_rows: normalized.invalid.slice(0,100), duplicate_conflicts: normalized.duplicates.slice(0,100) }, 400);
  const plan = hrPlan(state, normalized.employees) as { collisions?: unknown[] };
  if ((plan.collisions || []).length) return response({ error: "HR_EMPLOYEE_CODE_COLLIDES_NON_PICKER", ...plan }, 409);
  const incoming = new Map(normalized.employees.map((item) => [item.employee_code, item.display_name]));
  const at = new Date().toISOString();
  state.storage.transactionSync(() => {
    const existing = state.storage.sql.exec<UserRow>(
      `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_salt, password_hash, password_changed_at, auth_email, firebase_password_ready, created_at, updated_at FROM users`,
    ).toArray();
    const pickerByCode = new Map(existing.filter((u) => u.role === "PICKER" && u.employee_code).map((u) => [String(u.employee_code).toLowerCase(), u]));
    for (const [code, name] of incoming) {
      const current = pickerByCode.get(code);
      if (!current) {
        state.storage.sql.exec(
          `INSERT INTO users (user_id, firebase_uid, employee_code, display_name, role, status, created_at, updated_at, password_salt, password_hash, password_changed_at)
           VALUES (?, NULL, ?, ?, 'PICKER', 'ACTIVE', ?, ?, ?, ?, ?)`,
          `picker:${code}:${crypto.randomUUID()}`, code, name, at, at, body.picker_password_salt, body.picker_password_hash, at,
        );
      } else if (current.display_name !== name) {
        state.storage.sql.exec(`UPDATE users SET display_name = ?, updated_at = ? WHERE user_id = ?`, name, at, current.user_id);
      }
    }
  });
  const finalPlan = hrPlan(state, normalized.employees);
  audit(state, actor, "HR_PICKER_SYNC", "HR_SOURCE", String(body.request_id), { source_count: normalized.employees.length, applied_at: at, pre_apply: plan, absence_policy: "NO_AUTOMATIC_DISABLE" });
  state.storage.sql.exec(
    `INSERT INTO app_config (key, value_json, updated_at, updated_by) VALUES ('hr_last_sync', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    JSON.stringify({ source_count: normalized.employees.length, applied_at: at, request_id: body.request_id, absence_policy: "NO_AUTOMATIC_DISABLE" }), at, actor.user_id,
  );
  return response({ status: "applied", source_count: normalized.employees.length, applied_at: at, post_apply: finalPlan });
}

async function rollbackManagedUserCreate(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; user_id?: string; request_id?: unknown };
  const actor = body.actor;
  const userId = String(body.user_id || "").trim();
  const target = getUser(state, userId);
  if (!actor?.user_id || !target || !validRequestId(body.request_id) || !canManageTarget(actor.role, target.role)) {
    return response({ error: "USER_CREATE_ROLLBACK_FORBIDDEN" }, 403);
  }
  if (!["ADMIN", "REPORTER"].includes(target.role) || Number(target.firebase_password_ready || 0) === 1) {
    return response({ error: "USER_CREATE_ROLLBACK_UNSAFE" }, 409);
  }

  state.storage.transactionSync(() => {
    state.storage.sql.exec("DELETE FROM fcm_devices WHERE user_id = ?", userId);
    state.storage.sql.exec("DELETE FROM presence_sessions WHERE user_id = ?", userId);
    state.storage.sql.exec(
      "DELETE FROM users WHERE user_id = ? AND COALESCE(firebase_password_ready, 0) = 0",
      userId,
    );
  });
  audit(state, actor, "USER_CREATE_ROLLBACK", "USER", userId, {
    reason: "firebase_provision_failed",
    request_id: String(body.request_id || ""),
  });
  return response({ status: "rolled_back", user_id: userId });
}

export async function handleUserManagementCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/admin/users") return listUsers(state, url);
  if (request.method === "POST" && url.pathname === "/admin/users/create") return createManagedUser(state, request);
  if (request.method === "POST" && url.pathname === "/admin/users/rollback-create") return rollbackManagedUserCreate(state, request);
  if (request.method === "POST" && url.pathname === "/admin/users/update") return updateManagedUser(state, request);
  if (request.method === "POST" && url.pathname === "/admin/users/set-password") return setManagedPassword(state, request);
  if (request.method === "POST" && url.pathname === "/admin/pickers/bulk") return pickerBulkAction(state, request);
  if (request.method === "POST" && url.pathname === "/admin/hr-sync/preview") return hrPreview(state, request);
  if (request.method === "POST" && url.pathname === "/admin/hr-sync/apply") return hrApply(state, request);
  return null;
}
