type SqlRow = Record<string, SqlStorageValue>;
type AppRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
type UserStatus = "ACTIVE" | "DISABLED";

type Actor = { user_id: string; employee_code: string | null; role: AppRole };
type HrEmployee = { employee_code?: unknown; display_name?: unknown };

interface UserRow extends SqlRow {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: AppRole;
  status: UserStatus;
  password_changed_at: string | null;
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

function audit(state: DurableObjectState, actor: Actor, action: string, targetType: string, targetId: string, metadata: Record<string, unknown>): void {
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO audit_log (audit_id, actor_user_id, actor_employee_code, action, target_type, target_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(), actor.user_id, actor.employee_code, action, targetType, targetId, JSON.stringify(metadata), at,
  );
}

function manageableRole(actorRole: AppRole): AppRole | null {
  if (actorRole === "ROOT") return "ADMIN";
  if (actorRole === "ADMIN") return "REPORTER";
  return null;
}

function safeUser(row: UserRow): Record<string, unknown> {
  return {
    user_id: row.user_id, firebase_uid: row.firebase_uid, employee_code: row.employee_code,
    display_name: row.display_name, role: row.role, status: row.status,
    password_initialized: Boolean(row.password_changed_at), password_changed_at: row.password_changed_at,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

function getUser(state: DurableObjectState, userId: string): UserRow | null {
  return first(state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_changed_at, created_at, updated_at
       FROM users WHERE user_id = ? LIMIT 1`, userId,
  ).toArray());
}

function listUsers(state: DurableObjectState, url: URL): Response {
  const query = String(url.searchParams.get("query") || "").trim().toLowerCase();
  const role = String(url.searchParams.get("role") || "").trim().toUpperCase();
  const status = String(url.searchParams.get("status") || "").trim().toUpperCase();
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 500) || 500));
  let rows = state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_changed_at, created_at, updated_at
       FROM users ORDER BY CASE role WHEN 'ROOT' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'REPORTER' THEN 3 ELSE 4 END, employee_code ASC, display_name ASC LIMIT 1000`,
  ).toArray();
  if (query) rows = rows.filter((row) => `${row.employee_code || ""} ${row.display_name} ${row.user_id}`.toLowerCase().includes(query));
  if (["PICKER","REPORTER","ADMIN","ROOT"].includes(role)) rows = rows.filter((row) => row.role === role);
  if (["ACTIVE","DISABLED"].includes(status)) rows = rows.filter((row) => row.status === status);
  rows = rows.slice(0, limit);
  return response({ items: rows.map(safeUser), count: rows.length });
}

async function createManagedUser(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; username?: unknown; display_name?: unknown; role?: AppRole; request_id?: unknown };
  const actor = body.actor;
  const expectedRole = actor ? manageableRole(actor.role) : null;
  const username = normalizeLogin(body.username);
  const displayName = normalizeName(body.display_name);
  if (!actor?.user_id || !expectedRole || body.role !== expectedRole || !validLogin(username) || !displayName || displayName.length > 200 || !validRequestId(body.request_id)) {
    return response({ error: "INVALID_USER_CREATE_SCOPE" }, 400);
  }
  const existing = first(state.storage.sql.exec<UserRow>(
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_changed_at, created_at, updated_at
       FROM users WHERE lower(employee_code) = lower(?) OR lower(user_id) = lower(?) LIMIT 1`, username, username,
  ).toArray());
  if (existing) return response({ error: "USER_IDENTIFIER_EXISTS", user: safeUser(existing) }, 409);
  const userId = `${expectedRole.toLowerCase()}:${username}`;
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO users (user_id, firebase_uid, employee_code, display_name, role, status, created_at, updated_at, password_salt, password_hash, password_changed_at)
     VALUES (?, NULL, ?, ?, ?, 'ACTIVE', ?, ?, NULL, NULL, NULL)`,
    userId, username, displayName, expectedRole, at, at,
  );
  audit(state, actor, "USER_CREATE", "USER", userId, { role: expectedRole, employee_code: username, default_password_pending: true });
  return response({ status: "created", user: safeUser(getUser(state, userId)!) }, 201);
}

async function updateManagedUser(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; user_id?: string; display_name?: unknown; status?: UserStatus; request_id?: unknown };
  const actor = body.actor;
  const userId = String(body.user_id || "").trim();
  const target = getUser(state, userId);
  const expectedRole = actor ? manageableRole(actor.role) : null;
  if (!actor?.user_id || !target || !expectedRole || target.role !== expectedRole || !validRequestId(body.request_id)) return response({ error: "USER_NOT_MANAGEABLE" }, 403);
  const displayName = normalizeName(body.display_name ?? target.display_name);
  const status = String(body.status || target.status).toUpperCase() as UserStatus;
  if (!displayName || displayName.length > 200 || !["ACTIVE","DISABLED"].includes(status)) return response({ error: "INVALID_USER_UPDATE" }, 400);
  state.storage.sql.exec(`UPDATE users SET display_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, displayName, status, userId);
  if (status === "DISABLED") state.storage.sql.exec(`UPDATE fcm_devices SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, userId);
  audit(state, actor, "USER_UPDATE", "USER", userId, { display_name: displayName, status, role: target.role });
  return response({ status: "updated", user: safeUser(getUser(state, userId)!) });
}

async function resetManagedPassword(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; user_id?: string; request_id?: unknown };
  const actor = body.actor;
  const userId = String(body.user_id || "").trim();
  const target = getUser(state, userId);
  const expectedRole = actor ? manageableRole(actor.role) : null;
  if (!actor?.user_id || !target || !expectedRole || target.role !== expectedRole || !validRequestId(body.request_id)) return response({ error: "USER_NOT_MANAGEABLE" }, 403);
  const nextUid = `r:${crypto.randomUUID()}`;
  state.storage.sql.exec(
    `UPDATE users SET firebase_uid = ?, password_salt = NULL, password_hash = NULL, password_changed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    nextUid, userId,
  );
  state.storage.sql.exec(`UPDATE fcm_devices SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, userId);
  audit(state, actor, "USER_PASSWORD_RESET", "USER", userId, { role: target.role, sessions_invalidated_by_uid_rotation: true });
  return response({ status: "password_reset_to_bootstrap", user_id: userId });
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
    `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_changed_at, created_at, updated_at FROM users`,
  ).toArray();
  const byCode = new Map(existing.filter((u) => u.employee_code).map((u) => [String(u.employee_code).toLowerCase(), u]));
  const collisions: Array<{ employee_code: string; role: AppRole; user_id: string }> = [];
  let create = 0, reactivate = 0, rename = 0, unchanged = 0;
  for (const [code, name] of incoming) {
    const current = byCode.get(code);
    if (!current) create += 1;
    else if (current.role !== "PICKER") collisions.push({ employee_code: code, role: current.role, user_id: current.user_id });
    else if (current.status !== "ACTIVE") reactivate += 1;
    else if (current.display_name !== name) rename += 1;
    else unchanged += 1;
  }
  const disable = existing.filter((u) => u.role === "PICKER" && u.status === "ACTIVE" && u.employee_code && !incoming.has(String(u.employee_code).toLowerCase())).length;
  return { total_source: employees.length, create, reactivate, rename, disable, unchanged, collisions };
}

async function hrPreview(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; employees?: HrEmployee[] };
  if (!body.actor?.user_id || !["ADMIN","ROOT"].includes(body.actor.role) || !Array.isArray(body.employees)) return response({ error: "INVALID_HR_SYNC" }, 400);
  const normalized = normalizeHrEmployees(body.employees);
  if (normalized.invalid.length || normalized.duplicates.length) return response({ error: "INVALID_HR_ROWS", invalid_rows: normalized.invalid.slice(0,100), duplicate_conflicts: normalized.duplicates.slice(0,100) }, 400);
  return response({ status: "preview", ...hrPlan(state, normalized.employees) });
}

async function hrApply(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { actor?: Actor; employees?: HrEmployee[]; request_id?: unknown; confirm?: boolean };
  const actor = body.actor;
  if (!actor?.user_id || !["ADMIN","ROOT"].includes(actor.role) || !Array.isArray(body.employees) || body.confirm !== true || !validRequestId(body.request_id)) return response({ error: "INVALID_HR_SYNC" }, 400);
  const normalized = normalizeHrEmployees(body.employees);
  if (normalized.invalid.length || normalized.duplicates.length) return response({ error: "INVALID_HR_ROWS", invalid_rows: normalized.invalid.slice(0,100), duplicate_conflicts: normalized.duplicates.slice(0,100) }, 400);
  const plan = hrPlan(state, normalized.employees) as { collisions?: unknown[] };
  if ((plan.collisions || []).length) return response({ error: "HR_MNV_COLLIDES_NON_PICKER", ...plan }, 409);
  const incoming = new Map(normalized.employees.map((item) => [item.employee_code, item.display_name]));
  const at = new Date().toISOString();
  state.storage.transactionSync(() => {
    const existing = state.storage.sql.exec<UserRow>(
      `SELECT user_id, firebase_uid, employee_code, display_name, role, status, password_changed_at, created_at, updated_at FROM users`,
    ).toArray();
    const pickerByCode = new Map(existing.filter((u) => u.role === "PICKER" && u.employee_code).map((u) => [String(u.employee_code).toLowerCase(), u]));
    for (const [code, name] of incoming) {
      const current = pickerByCode.get(code);
      if (!current) {
        state.storage.sql.exec(
          `INSERT INTO users (user_id, firebase_uid, employee_code, display_name, role, status, created_at, updated_at, password_salt, password_hash, password_changed_at)
           VALUES (?, NULL, ?, ?, 'PICKER', 'ACTIVE', ?, ?, NULL, NULL, NULL)`,
          `picker:${code}`, code, name, at, at,
        );
      } else {
        state.storage.sql.exec(`UPDATE users SET display_name = ?, status = 'ACTIVE', updated_at = ? WHERE user_id = ?`, name, at, current.user_id);
      }
    }
    for (const current of existing) {
      if (current.role === "PICKER" && current.status === "ACTIVE" && current.employee_code && !incoming.has(String(current.employee_code).toLowerCase())) {
        state.storage.sql.exec(`UPDATE users SET status = 'DISABLED', updated_at = ? WHERE user_id = ?`, at, current.user_id);
        state.storage.sql.exec(`UPDATE fcm_devices SET enabled = 0, updated_at = ? WHERE user_id = ?`, at, current.user_id);
      }
    }
  });
  const finalPlan = hrPlan(state, normalized.employees);
  audit(state, actor, "HR_PICKER_SYNC", "HR_SOURCE", String(body.request_id), { source_count: normalized.employees.length, applied_at: at, pre_apply: plan });
  state.storage.sql.exec(
    `INSERT INTO app_config (key, value_json, updated_at, updated_by) VALUES ('hr_last_sync', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    JSON.stringify({ source_count: normalized.employees.length, applied_at: at, request_id: body.request_id }), at, actor.user_id,
  );
  return response({ status: "applied", source_count: normalized.employees.length, applied_at: at, post_apply: finalPlan });
}

export async function handleUserManagementCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/admin/users") return listUsers(state, url);
  if (request.method === "POST" && url.pathname === "/admin/users/create") return createManagedUser(state, request);
  if (request.method === "POST" && url.pathname === "/admin/users/update") return updateManagedUser(state, request);
  if (request.method === "POST" && url.pathname === "/admin/users/reset-password") return resetManagedPassword(state, request);
  if (request.method === "POST" && url.pathname === "/admin/hr-sync/preview") return hrPreview(state, request);
  if (request.method === "POST" && url.pathname === "/admin/hr-sync/apply") return hrApply(state, request);
  return null;
}
