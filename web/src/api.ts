const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SESSION_KEY = "supra_inventory_beta_session_v1";

export interface AppProfile {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  status: "ACTIVE" | "DISABLED";
  password_changed_at: string | null;
}

export interface SkuItem {
  sku: string;
  product_name: string;
  source_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SkuCatalogInfo {
  count: number;
  max_updated_at: string | null;
  version: string;
}

export interface SkuCatalogPage {
  items: SkuItem[];
  count: number;
  next_after: string | null;
  limit: number;
}

export interface SkuNameChangeConflict {
  sku: string;
  current_product_name: string;
  incoming_product_name: string;
}

export interface SkuImportChunkResult {
  status: string;
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
  source_hash: string | null;
  imported_at?: string;
  conflict_count?: number;
  requires_confirmation?: boolean;
  conflicts?: SkuNameChangeConflict[];
  idempotent_replay?: boolean;
}

export interface ReporterBatch {
  batch_id: string;
  sku: string;
  product_name: string;
  status: "PENDING";
  first_report_at: string;
  affected_picker_count: number;
  earliest_ticket_at: string;
}

export interface ReporterRecentBatch {
  batch_id: string;
  sku: string;
  product_name: string;
  status: "HAS_STOCK" | "SKIP_ALLOWED";
  first_report_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution: "HAS_STOCK" | "SKIP_ALLOWED" | null;
  correction_deadline_at: string | null;
  affected_picker_count: number;
}

export interface BatchPickerTicket {
  ticket_id: string;
  picker_user_id: string | null;
  picker_employee_code: string;
  picker_display_name: string;
  status: "OPEN" | "WITHDRAWN" | "RESOLVED";
  reported_at: string;
  withdraw_deadline_at: string;
  withdrawn_at: string | null;
  resolved_at: string | null;
}

export interface AdminReportBatch {
  batch_id: string;
  sku: string;
  product_name: string;
  status: "PENDING" | "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED";
  first_report_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution: "HAS_STOCK" | "SKIP_ALLOWED" | null;
  correction_deadline_at: string | null;
  open_ticket_count: number;
  total_ticket_count: number;
}

interface StoredSession {
  id_token: string;
  refresh_token: string;
  expires_at: number;
  user: AppProfile;
}

interface LoginResponse {
  id_token: string;
  refresh_token: string;
  expires_in: number;
  user: AppProfile;
}

let session: StoredSession | null = loadSession();
let refreshPromise: Promise<void> | null = null;

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.id_token || !parsed.refresh_token || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(next: StoredSession | null): void {
  session = next;
  if (!next) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: (T & { error?: string; message?: string }) | null = null;
  try {
    payload = JSON.parse(text) as T & { error?: string; message?: string };
  } catch {
    const type = response.headers.get("content-type") || "unknown";
    throw new Error(`API trả dữ liệu không hợp lệ (HTTP ${response.status}, ${type}).`);
  }
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  return payload;
}

export function hasSession(): boolean { return Boolean(session?.id_token && session?.refresh_token && session?.user); }
export function getStoredProfile(): AppProfile | null { return session?.user || null; }
export function clearSession(): void { saveSession(null); }

export async function loginWithPassword(username: string, password: string): Promise<AppProfile> {
  const result = await readJson<LoginResponse>(await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username, password }),
  }));
  saveSession({ id_token: result.id_token, refresh_token: result.refresh_token, expires_at: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000, user: result.user });
  return result.user;
}

async function refreshSession(): Promise<void> {
  if (!session?.refresh_token) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const result = await readJson<{ id_token: string; refresh_token: string; expires_in: number }>(await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refresh_token: session!.refresh_token }),
      }));
      saveSession({ ...session!, id_token: result.id_token, refresh_token: result.refresh_token, expires_at: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000 });
    } catch (error) {
      clearSession();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!session) throw new Error("Chưa đăng nhập.");
  if (session.expires_at <= Date.now() + 60_000) await refreshSession();
  if (!session) throw new Error("Phiên đăng nhập đã hết hạn.");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${session.id_token}`);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && session?.refresh_token) {
    await refreshSession();
    if (!session) return response;
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set("authorization", `Bearer ${session.id_token}`);
    retryHeaders.set("accept", "application/json");
    if (init.body && !retryHeaders.has("content-type")) retryHeaders.set("content-type", "application/json");
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });
  }
  return response;
}

export async function getMyProfile(): Promise<AppProfile> {
  const result = (await readJson<{ user: AppProfile }>(await authorizedFetch("/api/auth/me"))).user;
  if (session) saveSession({ ...session, user: result });
  return result;
}

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  await readJson(await authorizedFetch("/api/auth/change-password", { method: "PUT", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }));
}

export async function getHrSource(): Promise<unknown> { return readJson(await authorizedFetch("/api/admin/hr-source")); }
export async function saveHrSource(sheetUrl: string, tabName: string): Promise<unknown> {
  return readJson(await authorizedFetch("/api/admin/hr-source", { method: "PUT", body: JSON.stringify({ sheet_url: sheetUrl, tab_name: tabName }) }));
}

export async function importSkuChunk(items: SkuItem[], options: { requestId: string; sourceHash: string; dryRun?: boolean; confirmNameChanges?: boolean }): Promise<SkuImportChunkResult> {
  return readJson(await authorizedFetch("/api/admin/skus/import", {
    method: "POST",
    body: JSON.stringify({ request_id: options.requestId, source_hash: options.sourceHash, dry_run: Boolean(options.dryRun), confirm_name_changes: Boolean(options.confirmNameChanges), items }),
  }));
}

export async function searchSkus(query = "", limit = 50): Promise<{ items: SkuItem[]; count: number }> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return readJson(await authorizedFetch(`/api/skus?${params.toString()}`));
}

export async function getSkuCatalogInfo(): Promise<SkuCatalogInfo> { return readJson(await authorizedFetch("/api/skus/catalog-info")); }
export async function getSkuCatalogPage(after = "", limit = 2000): Promise<SkuCatalogPage> {
  const params = new URLSearchParams({ after, limit: String(limit) });
  return readJson(await authorizedFetch(`/api/skus/catalog?${params.toString()}`));
}

export async function getReporterQueue(limit = 100): Promise<{ items: ReporterBatch[]; count: number }> {
  return readJson(await authorizedFetch(`/api/reporter/queue?limit=${encodeURIComponent(String(limit))}`));
}

export async function getReporterRecent(limit = 100): Promise<{ items: ReporterRecentBatch[]; count: number }> {
  return readJson(await authorizedFetch(`/api/reporter/recent?limit=${encodeURIComponent(String(limit))}`));
}

export async function getReporterBatchTickets(batchId: string): Promise<{ batch_id: string; items: BatchPickerTicket[]; count: number }> {
  return readJson(await authorizedFetch(`/api/reporter/batch-tickets?batch_id=${encodeURIComponent(batchId)}`));
}

export async function resolveReporterBatch(batchId: string, resolution: "HAS_STOCK" | "SKIP_ALLOWED"): Promise<unknown> {
  return readJson(await authorizedFetch("/api/reporter/batches/resolve", { method: "POST", body: JSON.stringify({ request_id: crypto.randomUUID(), batch_id: batchId, resolution }) }));
}

export async function correctReporterBatch(batchId: string): Promise<unknown> {
  return readJson(await authorizedFetch("/api/reporter/batches/correct", { method: "POST", body: JSON.stringify({ request_id: crypto.randomUUID(), batch_id: batchId }) }));
}

export async function getAdminReports(limit = 100, status = ""): Promise<{ items: AdminReportBatch[]; count: number }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return readJson(await authorizedFetch(`/api/admin/reports?${params.toString()}`));
}
