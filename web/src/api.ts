const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SESSION_KEY = "supra_inventory_beta_session_v1";

export interface AppProfile {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  base_role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
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

export type SlaState = "UNCONFIGURED" | "NORMAL" | "WARNING" | "ESCALATED";

export interface ReporterBatch {
  batch_id: string;
  sku: string;
  product_name: string;
  status: "PENDING";
  first_report_at: string;
  last_report_at?: string | null;
  affected_picker_count: number;
  earliest_ticket_at: string;
  version: number;
  previous_batch_id: string | null;
  previous_resolved_at?: string | null;
  recurrence_minutes?: number | null;
  sla_state: SlaState;
  waiting_minutes: number;
  warning_at?: string | null;
  escalation_at?: string | null;
}

export interface ReporterRecentBatch {
  batch_id: string;
  sku: string;
  product_name: string;
  status: "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED";
  first_report_at: string;
  last_report_at?: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution: "HAS_STOCK" | "SKIP_ALLOWED" | null;
  correction_deadline_at: string | null;
  affected_picker_count: number;
  version: number;
  previous_batch_id: string | null;
  previous_resolved_at?: string | null;
  ack_target_count: number;
  acknowledged_count: number;
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
  result_event_id?: string | null;
  received_at?: string | null;
  displayed_at?: string | null;
  acknowledged_at?: string | null;
}

export interface ManagedUser {
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
  inactive_existing: number;
  not_in_source: number;
  collisions: Array<{ employee_code: string; role: string; user_id: string }>;
}

export interface HrSourceConfig {
  sheet_id: string;
  sheet_url: string;
  tab_name: string;
  mnv_header: string;
  full_name_header: string;
  header_row: number;
  data_row_count: number;
  verified_at: string;
  updated_at?: string;
  runtime_service_account?: string;
}

export interface HrSourceResponse {
  configured: boolean;
  source: HrSourceConfig | null;
}

export interface HrSourceSaveResponse {
  status: "saved";
  source: HrSourceConfig;
}

export interface SlaConfig {
  warning_minutes: number;
  escalation_minutes: number;
  updated_at?: string;
  updated_by?: string | null;
}

export interface SlaResponse {
  configured: boolean;
  sla: SlaConfig | null;
}

export interface OperationalInsights {
  sla: {
    configured: boolean;
    config: SlaConfig | null;
    warning_count: number;
    escalated_count: number;
  };
  recurrence: {
    top_skus: Array<{ sku: string; product_name: string; recurrence_count: number; latest_first_report_at: string }>;
  };
}

export interface AdminDashboard {
  period: { from: string; to: string; bucket: "hour" | "day" };
  kpis: {
    reports_count: number;
    unique_sku_count: number;
    affected_picker_count: number;
    pending_batch_count: number;
    pending_picker_count: number;
    resolved_batch_count: number;
    avg_resolution_minutes: number | null;
  };
  timeline: Array<{ bucket: string; reports: number; resolved: number }>;
  outcomes: Array<{ status: "PENDING" | "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED"; count: number }>;
  top_skus: Array<{ sku: string; product_name: string; report_count: number; picker_count: number }>;
}

export interface AdminReportingRow {
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
  duration_minutes: number | null;
}

export interface AdminReportingPage {
  items: AdminReportingRow[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  from: string;
  to: string;
  status: string;
  query: string;
}

export interface RealtimePresence {
  online_users: number;
  online_sessions: number;
  online_users_by_role: Record<"PICKER" | "REPORTER" | "ADMIN" | "ROOT", number>;
  online_users_by_client: Record<"WEB" | "ANDROID", number>;
  server_time: string;
}

export interface RuntimeLogItem {
  id: string;
  name: string;
  created_at: string;
  modified_at?: string;
  size: number;
  severity: "INFO" | "ERROR";
  source: "WEB" | "ANDROID";
}

export interface RuntimeLogList {
  source: "WEB" | "ANDROID";
  items: RuntimeLogItem[];
  count: number;
}

export interface RuntimeLogDetail {
  file: { id: string; name: string; created_at: string; size: number };
  content: unknown;
}

export interface SystemStatusSnapshot {
  generated_at: string;
  environment: string;
  source_commit: string | null;
  core: Record<string, unknown>;
  providers: Record<string, unknown>;
  limits: Record<string, unknown>;
  refresh_policy: Record<string, unknown>;
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

export async function readJson<T>(response: Response): Promise<T> {
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

export function hasSession(): boolean {
  return Boolean(session?.id_token && session?.refresh_token && session?.user);
}

export function getStoredProfile(): AppProfile | null {
  return session?.user || null;
}

export function clearSession(): void {
  saveSession(null);
}

export async function loginWithPassword(username: string, password: string): Promise<AppProfile> {
  const result = await readJson<LoginResponse>(await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username, password }),
  }));
  saveSession({
    id_token: result.id_token,
    refresh_token: result.refresh_token,
    expires_at: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000,
    user: result.user,
  });
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
      saveSession({
        ...session!,
        id_token: result.id_token,
        refresh_token: result.refresh_token,
        expires_at: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000,
      });
    } catch (error) {
      clearSession();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
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

export async function setRootEffectiveRole(role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT"): Promise<AppProfile> {
  const result = await readJson<{ user: AppProfile }>(await authorizedFetch("/api/auth/root-role", {
    method: "PUT",
    body: JSON.stringify({ role }),
  }));
  if (session) saveSession({ ...session, user: result.user });
  return result.user;
}

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  await readJson(await authorizedFetch("/api/auth/change-password", {
    method: "PUT",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }));
}

export async function getHrSource(): Promise<HrSourceResponse> {
  return readJson(await authorizedFetch("/api/admin/hr-source"));
}

export async function saveHrSource(sheetUrl: string, tabName: string, employeeCodeHeader: string, fullNameHeader: string): Promise<HrSourceSaveResponse> {
  return readJson(await authorizedFetch("/api/admin/hr-source-v2", {
    method: "PUT",
    body: JSON.stringify({
      sheet_url: sheetUrl,
      tab_name: tabName,
      employee_code_header: employeeCodeHeader,
      full_name_header: fullNameHeader,
    }),
  }));
}

export async function importSkuChunk(
  items: SkuItem[],
  options: { requestId: string; sourceHash: string; dryRun?: boolean; confirmNameChanges?: boolean },
): Promise<SkuImportChunkResult> {
  return readJson(await authorizedFetch("/api/admin/skus/import", {
    method: "POST",
    body: JSON.stringify({
      request_id: options.requestId,
      source_hash: options.sourceHash,
      dry_run: Boolean(options.dryRun),
      confirm_name_changes: Boolean(options.confirmNameChanges),
      items,
    }),
  }));
}

export async function searchSkus(query = "", limit = 50): Promise<{ items: SkuItem[]; count: number }> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return readJson(await authorizedFetch(`/api/skus?${params.toString()}`));
}

export async function getSkuCatalogInfo(): Promise<SkuCatalogInfo> {
  return readJson(await authorizedFetch("/api/skus/catalog-info"));
}

export async function getSkuCatalogPage(after = "", limit = 2000): Promise<SkuCatalogPage> {
  const params = new URLSearchParams({ after, limit: String(limit) });
  return readJson(await authorizedFetch(`/api/skus/catalog?${params.toString()}`));
}

export async function getReporterQueue(limit = 100): Promise<{ items: ReporterBatch[]; count: number; server_now?: string; sla_configured?: boolean; sla?: SlaConfig | null }> {
  return readJson(await authorizedFetch(`/api/reporter/queue?limit=${encodeURIComponent(String(limit))}`));
}

export async function getReporterRecent(limit = 100): Promise<{ items: ReporterRecentBatch[]; count: number }> {
  return readJson(await authorizedFetch(`/api/reporter/recent?limit=${encodeURIComponent(String(limit))}`));
}

export async function getReporterBatchTickets(batchId: string): Promise<{ batch_id: string; items: BatchPickerTicket[]; count: number }> {
  return readJson(await authorizedFetch(`/api/reporter/batch-tickets?batch_id=${encodeURIComponent(batchId)}`));
}

export async function resolveReporterBatch(batchId: string, resolution: "HAS_STOCK" | "SKIP_ALLOWED"): Promise<unknown> {
  return readJson(await authorizedFetch("/api/reporter/batches/resolve", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), batch_id: batchId, resolution }),
  }));
}

export async function correctReporterBatch(batchId: string): Promise<unknown> {
  return readJson(await authorizedFetch("/api/reporter/batches/correct", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), batch_id: batchId }),
  }));
}

export async function getAdminSla(): Promise<SlaResponse> {
  return readJson(await authorizedFetch("/api/admin/sla"));
}

export async function saveAdminSla(warningMinutes: number, escalationMinutes: number): Promise<SlaResponse> {
  return readJson(await authorizedFetch("/api/admin/sla", {
    method: "PUT",
    body: JSON.stringify({ warning_minutes: warningMinutes, escalation_minutes: escalationMinutes }),
  }));
}

export async function getAdminOperationalInsights(from: string, to: string): Promise<OperationalInsights> {
  const params = new URLSearchParams({ from, to });
  return readJson(await authorizedFetch(`/api/admin/operational-insights?${params.toString()}`));
}

export async function getAdminDashboard(from: string, to: string): Promise<AdminDashboard> {
  const params = new URLSearchParams({ from, to });
  return readJson(await authorizedFetch(`/api/admin/dashboard?${params.toString()}`));
}

export async function getAdminReporting(options: {
  from: string;
  to: string;
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminReportingPage> {
  const params = new URLSearchParams({
    from: options.from,
    to: options.to,
    limit: String(options.limit || 100),
    offset: String(options.offset || 0),
  });
  if (options.status) params.set("status", options.status);
  if (options.query) params.set("query", options.query);
  return readJson(await authorizedFetch(`/api/admin/reporting?${params.toString()}`));
}

export async function getAdminReports(limit = 100, status = ""): Promise<{ items: AdminReportBatch[]; count: number }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return readJson(await authorizedFetch(`/api/admin/reports?${params.toString()}`));
}

export async function getRealtimePresence(): Promise<RealtimePresence> {
  return readJson(await authorizedFetch("/api/realtime/presence"));
}

export async function uploadRuntimeLog(payload: {
  source: "WEB" | "ANDROID";
  severity: "INFO" | "ERROR";
  reason: string;
  generated_at: string;
  device: Record<string, unknown>;
  payload: unknown;
}): Promise<{ status: string; file?: { id?: string; name?: string; created_at?: string; size?: number } }> {
  return readJson(await authorizedFetch("/api/logs/upload", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export async function getRuntimeLogs(source: "WEB" | "ANDROID", limit = 50): Promise<RuntimeLogList> {
  const params = new URLSearchParams({ source, limit: String(Math.max(1, Math.min(100, limit))) });
  return readJson(await authorizedFetch(`/api/admin/logs?${params.toString()}`));
}

export async function getRuntimeLogDetail(fileId: string): Promise<RuntimeLogDetail> {
  const params = new URLSearchParams({ file_id: fileId });
  return readJson(await authorizedFetch(`/api/admin/logs/file?${params.toString()}`));
}

export async function getSystemStatus(fresh = false): Promise<SystemStatusSnapshot> {
  const suffix = fresh ? "?fresh=1" : "";
  return readJson(await authorizedFetch(`/api/admin/system-status${suffix}`));
}

export async function listManagedUsers(options: {
  query?: string;
  role?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: ManagedUser[]; count: number; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams({
    limit: String(options.limit || 100),
    offset: String(options.offset || 0),
  });
  if (options.query) params.set("query", options.query);
  if (options.role) params.set("role", options.role);
  if (options.status) params.set("status", options.status);
  return readJson(await authorizedFetch(`/api/admin/users?${params.toString()}`));
}

export async function createManagedUser(
  username: string,
  displayName: string,
  role: "ADMIN" | "REPORTER",
  password: string,
): Promise<ManagedUser> {
  const result = await readJson<{ user: ManagedUser }>(await authorizedFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), username, display_name: displayName, role, password }),
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

export async function setManagedUserPassword(userId: string, password: string): Promise<void> {
  await readJson(await authorizedFetch("/api/admin/users/password", {
    method: "PUT",
    body: JSON.stringify({ request_id: crypto.randomUUID(), user_id: userId, password }),
  }));
}

export async function updatePickerAccounts(
  action: "ENABLE" | "DISABLE" | "DELETE",
  userIds: string[] = [],
  all = false,
): Promise<{ status: string; action: string; affected: number }> {
  return readJson(await authorizedFetch("/api/admin/pickers/bulk", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), action, all, user_ids: all ? [] : userIds }),
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
