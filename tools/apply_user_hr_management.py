#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "service/src"
WEB = ROOT / "web/src"
STATE = ROOT / "ops/project-state.json"
REGISTRY = ROOT / "ops/resource-registry.json"
DECISIONS = ROOT / "docs/OWNER_DECISIONS.md"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL {label}: expected 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def write_service_modules() -> None:
    (SERVICE / "hr-sync.ts").write_text(r'''import { getServiceAccountAccessToken } from "./hr-source";

export interface StoredHrSource {
  sheet_id: string;
  sheet_url: string;
  tab_name: string;
  mnv_header: string;
  full_name_header: string;
  header_row: number;
}

export interface HrEmployee {
  employee_code: string;
  display_name: string;
}

export interface HrEmployeeReadResult {
  employees: HrEmployee[];
  duplicate_conflicts: Array<{ employee_code: string; names: string[] }>;
  invalid_rows: number[];
  source_row_count: number;
  loaded_at: string;
}

function normalizeHeader(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .trim().toLowerCase().replace(/[_./-]+/g, " ").replace(/\s+/g, " ");
}

export async function readHrEmployees(rawServiceAccountJson: string, source: StoredHrSource): Promise<HrEmployeeReadResult> {
  const { accessToken } = await getServiceAccountAccessToken(rawServiceAccountJson);
  const range = `'${source.tab_name.replaceAll("'", "''")}'!A1:ZZ2000`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(source.sheet_id)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("majorDimension", "ROWS");
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Không đọc được dữ liệu nhân sự: HTTP ${response.status}`);
  const values = (await response.json()) as { values?: string[][] };
  const rows = values.values || [];
  const headerIndex = Math.max(0, Number(source.header_row || 1) - 1);
  const headers = rows[headerIndex] || [];
  const mnvWanted = normalizeHeader(source.mnv_header);
  const nameWanted = normalizeHeader(source.full_name_header);
  const mnvIndex = headers.findIndex((cell) => normalizeHeader(String(cell || "")) === mnvWanted);
  const nameIndex = headers.findIndex((cell) => normalizeHeader(String(cell || "")) === nameWanted);
  if (mnvIndex < 0 || nameIndex < 0) throw new Error("Header MNV/Họ tên của nguồn nhân sự đã thay đổi. Hãy xác nhận lại cấu hình nguồn.");

  const byCode = new Map<string, Set<string>>();
  const invalidRows: number[] = [];
  let sourceRowCount = 0;
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (!row.some((cell) => String(cell || "").trim())) continue;
    sourceRowCount += 1;
    const employeeCode = String(row[mnvIndex] || "").trim().toLowerCase();
    const displayName = String(row[nameIndex] || "").trim().replace(/\s+/g, " ");
    if (!/^[a-z0-9._-]{1,64}$/.test(employeeCode) || !displayName || displayName.length > 200) {
      invalidRows.push(index + 1);
      continue;
    }
    const names = byCode.get(employeeCode) || new Set<string>();
    names.add(displayName);
    byCode.set(employeeCode, names);
  }

  const duplicateConflicts: Array<{ employee_code: string; names: string[] }> = [];
  const employees: HrEmployee[] = [];
  for (const [employeeCode, names] of byCode.entries()) {
    if (names.size > 1) duplicateConflicts.push({ employee_code: employeeCode, names: [...names].sort() });
    else employees.push({ employee_code: employeeCode, display_name: [...names][0] });
  }
  employees.sort((a, b) => a.employee_code.localeCompare(b.employee_code, "vi", { numeric: true }));
  duplicateConflicts.sort((a, b) => a.employee_code.localeCompare(b.employee_code, "vi", { numeric: true }));
  return { employees, duplicate_conflicts: duplicateConflicts, invalid_rows: invalidRows, source_row_count: sourceRowCount, loaded_at: new Date().toISOString() };
}
''', encoding="utf-8")

    (SERVICE / "user-management-core.ts").write_text(r'''type SqlRow = Record<string, SqlStorageValue>;
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
''', encoding="utf-8")

    (SERVICE / "user-management-api.ts").write_text(r'''import { readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";
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
''', encoding="utf-8")


def patch_service() -> None:
    core = SERVICE / "core.ts"
    replace_once(core,
        'import { handleNotificationCoreRequest } from "./notifications-core";\n',
        'import { handleNotificationCoreRequest } from "./notifications-core";\nimport { handleUserManagementCoreRequest } from "./user-management-core";\n',
        "core-user-import")
    replace_once(core,
        '    const notifications = await handleNotificationCoreRequest(this.state, request);\n    if (notifications) return notifications;\n',
        '    const userManagement = await handleUserManagementCoreRequest(this.state, request);\n    if (userManagement) return userManagement;\n\n    const notifications = await handleNotificationCoreRequest(this.state, request);\n    if (notifications) return notifications;\n',
        "core-user-route")

    index = SERVICE / "index.ts"
    replace_once(index,
        'import { handleNotificationApi } from "./notification-api";\n',
        'import { handleNotificationApi } from "./notification-api";\nimport { handleUserManagementApi } from "./user-management-api";\n',
        "index-user-import")
    replace_once(index,
        '''  if (!user.password_hash || !user.password_salt) {
    if (user.role !== "ROOT" || !env.ROOT_BOOTSTRAP_PASSWORD) {
      return json({ error: "PASSWORD_NOT_INITIALIZED", message: "Tài khoản chưa được khởi tạo mật khẩu." }, 503);
    }
    await savePassword(env, user.user_id, env.ROOT_BOOTSTRAP_PASSWORD);
    user = (await getUserByUsername(env, username))!;
  }''',
        '''  if (!user.password_hash || !user.password_salt) {
    if (!env.ROOT_BOOTSTRAP_PASSWORD) {
      return json({ error: "PASSWORD_NOT_INITIALIZED", message: "Tài khoản chưa được khởi tạo mật khẩu." }, 503);
    }
    await savePassword(env, user.user_id, env.ROOT_BOOTSTRAP_PASSWORD);
    user = (await getUserByUsername(env, username))!;
  }''',
        "login-default-bootstrap")
    replace_once(index,
        '      const notificationResponse = await handleNotificationApi(request, env);\n      if (notificationResponse) return notificationResponse;\n',
        '      const userManagementResponse = await handleUserManagementApi(request, env);\n      if (userManagementResponse) return userManagementResponse;\n\n      const notificationResponse = await handleNotificationApi(request, env);\n      if (notificationResponse) return notificationResponse;\n',
        "index-user-route")


def patch_web_api() -> None:
    api = WEB / "api.ts"
    anchor = '''export interface AdminReportBatch {
  batch_id: string;'''
    addition = '''export interface ManagedUser {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  status: "ACTIVE" | "DISABLED";
  password_initialized: boolean;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HrSyncPreview {
  status: "preview";
  total_source: number;
  create: number;
  reactivate: number;
  rename: number;
  disable: number;
  unchanged: number;
  collisions: Array<{ employee_code: string; role: string; user_id: string }>;
}

export interface AdminReportBatch {
  batch_id: string;'''
    replace_once(api, anchor, addition, "api-types")
    api.write_text(api.read_text(encoding="utf-8") + r'''

export async function listManagedUsers(query = "", role = "", status = ""): Promise<{ items: ManagedUser[]; count: number }> {
  const params = new URLSearchParams({ limit: "1000" });
  if (query) params.set("query", query);
  if (role) params.set("role", role);
  if (status) params.set("status", status);
  return readJson(await authorizedFetch(`/api/admin/users?${params.toString()}`));
}

export async function createManagedUser(username: string, displayName: string, role: "ADMIN" | "REPORTER"): Promise<ManagedUser> {
  const result = await readJson<{ user: ManagedUser }>(await authorizedFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), username, display_name: displayName, role }),
  }));
  return result.user;
}

export async function updateManagedUser(userId: string, displayName: string, status: "ACTIVE" | "DISABLED"): Promise<ManagedUser> {
  const result = await readJson<{ user: ManagedUser }>(await authorizedFetch("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({ request_id: crypto.randomUUID(), user_id: userId, display_name: displayName, status }),
  }));
  return result.user;
}

export async function resetManagedUserPassword(userId: string): Promise<void> {
  await readJson(await authorizedFetch("/api/admin/users/reset-password", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), user_id: userId }),
  }));
}

export async function previewHrPickerSync(): Promise<HrSyncPreview> {
  return readJson(await authorizedFetch("/api/admin/hr-sync/preview", { method: "POST", body: "{}" }));
}

export async function applyHrPickerSync(): Promise<unknown> {
  return readJson(await authorizedFetch("/api/admin/hr-sync/apply", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), confirm: true }),
  }));
}
''', encoding="utf-8")


def patch_web_main() -> None:
    main = WEB / "main.ts"
    replace_once(main,
        '''  changeMyPassword,
  clearSession,
  correctReporterBatch,''',
        '''  changeMyPassword,
  clearSession,
  correctReporterBatch,
  createManagedUser,
  applyHrPickerSync,''',
        "main-import-a")
    replace_once(main,
        '''  getHrSource,
  getMyProfile,''',
        '''  getHrSource,
  listManagedUsers,
  previewHrPickerSync,
  resetManagedUserPassword,
  updateManagedUser,
  getMyProfile,''',
        "main-import-b")
    replace_once(main,
        '''  type AppProfile,
  type BatchPickerTicket,''',
        '''  type AppProfile,
  type ManagedUser,
  type HrSyncPreview,
  type BatchPickerTicket,''',
        "main-import-types")
    replace_once(main,
        'let pendingDatabaseConflicts: SkuNameChangeConflict[] = [];\n',
        'let pendingDatabaseConflicts: SkuNameChangeConflict[] = [];\nlet managedUsers: ManagedUser[] = [];\nlet hrSyncPreview: HrSyncPreview | null = null;\n',
        "main-state")

    old_hr = '''function renderHrPage(): string {
  return `<section class="page-stack"><div><p class="eyebrow">Nguồn nhân sự</p><h2>Google Sheet nhân sự</h2><p class="muted">Chỉ lưu cấu hình khi backend đọc được file, đúng tab và có MNV + Họ tên.</p></div><article class="card"><form id="hr-form" class="stack"><label>Google Sheet URL<input name="sheetUrl" type="url" required /></label><label>Tên tab chính xác<input name="tabName" value="Nhân sự" required /></label><button>Xác nhận & cập nhật</button></form><button id="load-hr" class="secondary block-gap">Đọc cấu hình hiện tại</button><pre id="hr-result"></pre></article></section>`;
}'''
    new_hr = r'''function renderHrPage(): string {
  const createRole = profile?.role === "ROOT" ? "ADMIN" : "REPORTER";
  const manageableRole = createRole;
  const preview = hrSyncPreview ? `<div class="detail-panel"><strong>Preview đồng bộ Picker</strong><div class="operation-meta"><span>Nguồn: ${hrSyncPreview.total_source}</span><span>Thêm: ${hrSyncPreview.create}</span><span>Kích hoạt lại: ${hrSyncPreview.reactivate}</span><span>Đổi tên: ${hrSyncPreview.rename}</span><span>Ngừng hoạt động: ${hrSyncPreview.disable}</span><span>Không đổi: ${hrSyncPreview.unchanged}</span></div>${hrSyncPreview.collisions.length ? `<p class="message">Có ${hrSyncPreview.collisions.length} MNV trùng tài khoản không phải Picker. Chưa được phép đồng bộ.</p>` : `<button id="apply-hr-sync" class="block-gap">Xác nhận đồng bộ Picker</button>`}</div>` : "";
  const userRows = managedUsers.length ? `<div class="table-wrap"><table><thead><tr><th>MNV/User</th><th>Họ tên</th><th>Role</th><th>Trạng thái</th><th>Mật khẩu</th><th>Thao tác</th></tr></thead><tbody>${managedUsers.map((user) => { const canEdit = user.role === manageableRole; return `<tr><td><b>${escapeHtml(user.employee_code || user.user_id)}</b></td><td>${escapeHtml(user.display_name)}</td><td>${escapeHtml(user.role)}</td><td>${user.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động"}</td><td>${user.password_initialized ? "Đã khởi tạo" : "Mặc định"}</td><td>${canEdit ? `<button class="secondary" data-user-toggle="${escapeHtml(user.user_id)}" data-next-status="${user.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}" data-user-name="${escapeHtml(user.display_name)}">${user.status === "ACTIVE" ? "Ngừng hoạt động" : "Mở lại"}</button><button class="secondary" data-user-reset="${escapeHtml(user.user_id)}">Reset mật khẩu</button>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="muted">Chưa tải danh sách tài khoản.</p>`;
  return `<section class="page-stack"><div><p class="eyebrow">Nhân sự & tài khoản</p><h2>Quản lý nhân sự</h2><p class="muted">Picker lấy từ HR Sheet. ROOT tạo ADMIN; ADMIN tạo REPORTER. Tài khoản mất khỏi HR không bị xoá lịch sử mà chuyển ngừng hoạt động.</p></div><article class="card"><h3>Nguồn Google Sheet</h3><form id="hr-form" class="stack"><label>Google Sheet URL<input name="sheetUrl" type="url" required /></label><label>Tên tab chính xác<input name="tabName" value="Nhân sự" required /></label><button>Xác nhận & cập nhật</button></form><div class="actions block-gap"><button id="load-hr" class="secondary">Đọc cấu hình</button><button id="preview-hr-sync" class="secondary">Kiểm tra đồng bộ Picker</button></div><pre id="hr-result"></pre>${preview}</article><article class="card"><h3>Tạo ${createRole}</h3><form id="managed-user-form" class="inline-form"><input name="username" placeholder="MNV / tên đăng nhập" required /><input name="displayName" placeholder="Họ tên" required /><button>Tạo ${createRole}</button></form><p class="tiny">Tài khoản mới dùng mật khẩu mặc định từ bootstrap secret; không lưu mật khẩu trong source.</p></article><article class="card"><div class="section-head"><div><h3>Danh sách tài khoản</h3><p class="muted">ROOT được bảo vệ; Picker do HR quản lý; chỉ role thuộc phạm vi của cấp hiện tại mới có nút thao tác.</p></div><button id="load-users" class="secondary">Tải lại</button></div>${userRows}</article></section>`;
}'''
    replace_once(main, old_hr, new_hr, "main-render-hr")

    replace_once(main,
        '''  document.querySelector<HTMLButtonElement>("#load-hr")?.addEventListener("click", handleHrLoad);
  document.querySelector<HTMLFormElement>("#sku-import-form")?.addEventListener("submit", handleSkuImport);''',
        '''  document.querySelector<HTMLButtonElement>("#load-hr")?.addEventListener("click", handleHrLoad);
  document.querySelector<HTMLButtonElement>("#preview-hr-sync")?.addEventListener("click", () => void handleHrSyncPreview());
  document.querySelector<HTMLButtonElement>("#apply-hr-sync")?.addEventListener("click", () => void handleHrSyncApply());
  document.querySelector<HTMLFormElement>("#managed-user-form")?.addEventListener("submit", handleManagedUserCreate);
  document.querySelector<HTMLButtonElement>("#load-users")?.addEventListener("click", () => void loadManagedUsers());
  document.querySelectorAll<HTMLButtonElement>("[data-user-toggle]").forEach((button) => button.addEventListener("click", () => void handleManagedUserToggle(button)));
  document.querySelectorAll<HTMLButtonElement>("[data-user-reset]").forEach((button) => button.addEventListener("click", () => void handleManagedUserReset(button.dataset.userReset || "")));
  document.querySelector<HTMLFormElement>("#sku-import-form")?.addEventListener("submit", handleSkuImport);''',
        "main-hr-events")

    anchor = '''async function loadOperations(renderAfter = true): Promise<void> {'''
    handlers = r'''async function loadManagedUsers(renderAfter = true): Promise<void> {
  if (!canManage()) return;
  try { managedUsers = (await listManagedUsers()).items; }
  catch (error) { message = error instanceof Error ? error.message : "Không tải được tài khoản."; }
  if (renderAfter) render();
}

async function handleManagedUserCreate(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!profile || !["ROOT","ADMIN"].includes(profile.role)) return;
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const role = profile.role === "ROOT" ? "ADMIN" : "REPORTER";
  try {
    await createManagedUser(String(form.get("username") || ""), String(form.get("displayName") || ""), role);
    message = `Đã tạo ${role}. Tài khoản dùng mật khẩu mặc định cho lần đăng nhập đầu.`;
    (event.currentTarget as HTMLFormElement).reset();
    await loadManagedUsers(false);
  } catch (error) { message = error instanceof Error ? error.message : "Không tạo được tài khoản."; }
  render();
}

async function handleManagedUserToggle(button: HTMLButtonElement): Promise<void> {
  const userId = button.dataset.userToggle || "";
  const nextStatus = button.dataset.nextStatus as "ACTIVE" | "DISABLED";
  const displayName = button.dataset.userName || "";
  if (!userId || !nextStatus || !window.confirm(`${nextStatus === "DISABLED" ? "Ngừng hoạt động" : "Mở lại"} tài khoản ${displayName}?`)) return;
  try { await updateManagedUser(userId, displayName, nextStatus); message = "Đã cập nhật trạng thái tài khoản."; await loadManagedUsers(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không cập nhật được tài khoản."; }
  render();
}

async function handleManagedUserReset(userId: string): Promise<void> {
  if (!userId || !window.confirm("Reset mật khẩu về mật khẩu mặc định và vô hiệu phiên hiện tại của tài khoản này?")) return;
  try { await resetManagedUserPassword(userId); message = "Đã reset mật khẩu về mặc định."; await loadManagedUsers(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không reset được mật khẩu."; }
  render();
}

async function handleHrSyncPreview(): Promise<void> {
  busy = true; message = "Đang đọc nguồn HR và đối chiếu Picker..."; render();
  try { hrSyncPreview = await previewHrPickerSync(); message = "Đối chiếu HR hoàn tất. Kiểm tra số liệu trước khi xác nhận."; }
  catch (error) { hrSyncPreview = null; message = error instanceof Error ? error.message : "Không đối chiếu được HR."; }
  finally { busy = false; render(); }
}

async function handleHrSyncApply(): Promise<void> {
  if (!hrSyncPreview || hrSyncPreview.collisions.length) return;
  if (!window.confirm(`Xác nhận đồng bộ ${hrSyncPreview.total_source} Picker? Sẽ thêm ${hrSyncPreview.create}, kích hoạt lại ${hrSyncPreview.reactivate}, đổi tên ${hrSyncPreview.rename}, và chuyển ngừng hoạt động ${hrSyncPreview.disable} Picker không còn trong nguồn.`)) return;
  busy = true; render();
  try { await applyHrPickerSync(); hrSyncPreview = null; message = "Đồng bộ Picker từ HR Sheet thành công."; await loadManagedUsers(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không đồng bộ được Picker."; }
  finally { busy = false; render(); }
}

async function loadOperations(renderAfter = true): Promise<void> {'''
    replace_once(main, anchor, handlers, "main-handlers")

    replace_once(main,
        'function handleLogout(): void { clearSession(); profile = null; message = ""; skuStatus = ""; skuRows = []; queueRows = []; recentRows = []; batchDetails.clear(); resetSkuImportState(); render(); }',
        'function handleLogout(): void { clearSession(); profile = null; message = ""; skuStatus = ""; skuRows = []; queueRows = []; recentRows = []; managedUsers = []; hrSyncPreview = null; batchDetails.clear(); resetSkuImportState(); render(); }',
        "main-logout-state")


def update_docs_state() -> None:
    decisions = DECISIONS.read_text(encoding="utf-8")
    marker = '| D022 | ACTIVE | Web and Android/PDA must be built as usable role-specific business products according to the approved Picker/Reporter/Admin/Root workflows. Login/settings-only or diagnostic skeleton screens are not acceptable as the finished UI. Web must expose the management/operating functions allowed to Admin/Root, while PDA must expose the operational Picker/Reporter flows with Admin/Root inheriting Reporter capability where applicable. |\n'
    addition = marker + '| D023 | ACTIVE | Account provisioning hierarchy: ROOT creates/manages ADMIN; ADMIN creates/manages REPORTER; PICKER accounts are provisioned from the configured HR Sheet by MNV. Picker rows removed from the HR source are not deleted; they become DISABLED so history remains. New/reset managed accounts use the protected bootstrap default password secret and are not forced to change it immediately. ROOT is protected from normal subordinate account-management flows. |\n'
    if marker not in decisions: raise SystemExit('PATCH_FAIL decisions D022 marker')
    DECISIONS.write_text(decisions.replace(marker, addition, 1), encoding="utf-8")

    state = json.loads(STATE.read_text(encoding="utf-8"))
    state['current_status']['user_management'] = 'ROOT_ADMIN_HIERARCHY_AND_HR_PICKER_SYNC_DEPLOY_VERIFICATION_PENDING'
    completed = state['completed_capabilities']
    line = 'FCM device registration + targeted background notification foundation — Beta Worker deploy and signed Android beta-vc27 build PASS'
    if line not in completed: completed.append(line)
    pending = state['pending_build']
    pending[:] = [x for x in pending if x != 'User management and HR provisioning/sync lifecycle']
    pending.insert(0, 'Verify/deploy ROOT→ADMIN, ADMIN→REPORTER account management and preview-confirm HR→PICKER sync Web/API')
    state['next_action']['primary'] = 'Verify/deploy user management + HR Picker provisioning; then implement archive/retention executor and reporting/export.'
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding="utf-8")

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    registry['user_management'] = {
      'hierarchy': 'ROOT_CREATES_ADMIN__ADMIN_CREATES_REPORTER__PICKER_FROM_HR',
      'picker_missing_from_hr': 'DISABLE_RETAIN_HISTORY',
      'default_password_source': 'PROTECTED_ROOT_BOOTSTRAP_PASSWORD_SECRET_REUSED_FOR_INITIAL_MANAGED_LOGIN',
      'root_protection': 'NOT_MANAGEABLE_BY_NORMAL_ACCOUNT_API',
      'hr_sync': 'PREVIEW_THEN_EXPLICIT_APPLY',
      'source_status': 'PENDING_CI_DEPLOY'
    }
    pending_r = registry['application_build_pending']
    pending_r[:] = [x for x in pending_r if x != 'user_management_and_hr_provisioning']
    pending_r.insert(0, 'user_management_hr_provisioning_verify')
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding="utf-8")


def main() -> None:
    write_service_modules()
    patch_service()
    patch_web_api()
    patch_web_main()
    update_docs_state()
    print('USER_HR_MANAGEMENT_PATCH_PASS')

if __name__ == '__main__':
    main()
