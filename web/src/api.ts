const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SESSION_KEY = "supra_inventory_interactive_session_v2";
const LEGACY_SESSION_KEY = "supra_inventory_beta_session_v1";
const WEB_DEVICE_KEY = "supra_inventory_web_device_v1";

export interface AppProfile {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  base_role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  status: "ACTIVE" | "DISABLED";
  password_changed_at: string | null;
  auth_email?: string | null;
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
  auto_skip_enabled?: boolean;
  auto_skip_mode?: AutoSkipMode | null;
  auto_skip_at?: string | null;
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
  resolution_source?: string | null;
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
  auto_skip_deadline_at?: string | null;
  auto_skip_allowed_at?: string | null;
  resolution?: "HAS_STOCK" | "SKIP_ALLOWED" | null;
  resolution_source?: string | null;
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
  auth_email?: string | null;
  firebase_password_ready?: boolean;
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

export type AutoSkipMode = "FIRST_REPORT" | "PER_PICKER";

export interface SlaConfig {
  warning_minutes: number;
  escalation_minutes: number;
  auto_skip_minutes: number;
  auto_skip_enabled: boolean;
  auto_skip_mode: AutoSkipMode;
  policy_version?: number;
  effective_at?: string;
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

export interface StoredSession {
  id_token: string;
  refresh_token: string;
  expires_at: number;
  user: AppProfile;
  session_generation?: number;
  session_channel?: "WEB" | "ANDROID";
}

interface LoginResponse {
  id_token: string;
  refresh_token: string;
  expires_in: number;
  session_generation?: number;
  session_channel?: "WEB" | "ANDROID";
  user: AppProfile;
}

let session: StoredSession | null = loadSession();
let refreshPromise: Promise<void> | null = null;

function webDeviceId(): string {
  try {
    const existing = localStorage.getItem(WEB_DEVICE_KEY);
    if (existing && /^[A-Za-z0-9._:-]{8,160}$/.test(existing)) return existing;
    const created = `web:${crypto.randomUUID()}`;
    localStorage.setItem(WEB_DEVICE_KEY, created);
    return created;
  } catch {
    return "web:browser";
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
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
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  if (!next) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: (T & { error?: string; message?: string }) | null = null;
  try {
    payload = JSON.parse(text) as T & { error?: string; message?: string };
  } catch {
    const type = response.headers.get("content-type") || "unknown";
    throw new ApiError(response.status, "INVALID_API_RESPONSE", `API trả dữ liệu không hợp lệ (HTTP ${response.status}, ${type}).`);
  }
  if (!response.ok) {
    throw new ApiError(response.status, String(payload.error || `HTTP_${response.status}`), payload.message || payload.error || `HTTP ${response.status}`);
  }
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

function apiRouteSummary(path: string): { path: string; query_keys: string[] } {
  try {
    const url = new URL(path, window.location.origin);
    return { path: url.pathname.slice(0, 240), query_keys: [...url.searchParams.keys()].slice(0, 20) };
  } catch {
    return { path: String(path || "").split("?")[0].slice(0, 240), query_keys: [] };
  }
}

function emitApiTelemetry(detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent("supra:api-telemetry", { detail }));
}

export async function loginWithPassword(username: string, password: string, force = false): Promise<AppProfile> {
  const started = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        username,
        password,
        client_type: "WEB",
        device_id: webDeviceId(),
        force,
      }),
    });
    emitApiTelemetry({
      name: "auth_login",
      method: "POST",
      route: "/api/auth/login",
      status: response.status,
      duration_ms: performance.now() - started,
    });
    const result = await readJson<LoginResponse>(response);
    saveSession({
      id_token: result.id_token,
      refresh_token: result.refresh_token,
      expires_at: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000,
      user: result.user,
      session_generation: result.session_generation,
      session_channel: result.session_channel || "WEB",
    });
    return result.user;
  } catch (error) {
    emitApiTelemetry({
      name: "auth_login",
      method: "POST",
      route: "/api/auth/login",
      duration_ms: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function getAuthSessionSnapshot(): StoredSession | null {
  return session ? { ...session, user: { ...session.user } } : null;
}

export async function logoutInteractiveSession(): Promise<void> {
  if (!session?.id_token) return;
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.id_token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ device_id: webDeviceId() }),
    });
  } catch {
    // Best-effort server release; local logout still wins.
  }
}

export async function requestPasswordReset(username: string, email: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/password-reset`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username: username.trim(), email: email.trim() }),
  });
  const result = await readJson<{ status: string; message?: string }>(response);
  return result.message || "Nếu thông tin tài khoản và email khớp, hệ thống đã gửi liên kết đặt lại mật khẩu.";
}

export async function updateMyAuthEmail(email: string): Promise<AppProfile> {
  const result = await readJson<{ user: AppProfile }>(await authorizedFetch("/api/auth/email", {
    method: "PUT",
    body: JSON.stringify({ email }),
  }));
  if (session) saveSession({ ...session, user: result.user });
  return result.user;
}

async function refreshSession(): Promise<void> {
  if (!session?.refresh_token) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const started = performance.now();
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refresh_token: session!.refresh_token }),
      });
      emitApiTelemetry({
        name: "auth_refresh",
        method: "POST",
        route: "/api/auth/refresh",
        status: response.status,
        duration_ms: performance.now() - started,
      });
      const result = await readJson<{ id_token: string; refresh_token: string; expires_in: number }>(response);
      saveSession({
        ...session!,
        id_token: result.id_token,
        refresh_token: result.refresh_token,
        expires_at: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000,
      });
    } catch (error) {
      emitApiTelemetry({
        name: "auth_refresh",
        method: "POST",
        route: "/api/auth/refresh",
        duration_ms: performance.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
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
  const started = performance.now();
  const method = String(init.method || "GET").toUpperCase();
  const route = apiRouteSummary(path);
  let refreshedBeforeRequest = false;
  let retriedAfter401 = false;
  try {
    if (session.expires_at <= Date.now() + 60_000) {
      refreshedBeforeRequest = true;
      await refreshSession();
    }
    if (!session) throw new Error("Phiên đăng nhập đã hết hạn.");
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${session.id_token}`);
    headers.set("accept", "application/json");
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (response.status === 401 && session?.refresh_token) {
      retriedAfter401 = true;
      await refreshSession();
      if (!session) return response;
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("authorization", `Bearer ${session.id_token}`);
      retryHeaders.set("accept", "application/json");
      if (init.body && !retryHeaders.has("content-type")) retryHeaders.set("content-type", "application/json");
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });
    }
    emitApiTelemetry({
      name: "authorized_request",
      method,
      route: route.path,
      query_keys: route.query_keys,
      status: response.status,
      ok: response.ok,
      refreshed_before_request: refreshedBeforeRequest,
      retried_after_401: retriedAfter401,
      duration_ms: performance.now() - started,
    });
    return response;
  } catch (error) {
    emitApiTelemetry({
      name: "authorized_request",
      method,
      route: route.path,
      query_keys: route.query_keys,
      refreshed_before_request: refreshedBeforeRequest,
      retried_after_401: retriedAfter401,
      duration_ms: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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

export async function getReporterQueue(limit = 100, offset = 0): Promise<{ items: ReporterBatch[]; count: number; total: number; limit: number; offset: number; server_now?: string; sla_configured?: boolean; sla?: SlaConfig | null }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return readJson(await authorizedFetch(`/api/reporter/queue?${params.toString()}`));
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

export async function saveAdminSla(input: {
  warning_minutes: number;
  escalation_minutes: number;
  auto_skip_minutes: number;
  auto_skip_enabled: boolean;
  auto_skip_mode: AutoSkipMode;
}): Promise<SlaResponse> {
  return readJson(await authorizedFetch("/api/admin/sla", {
    method: "PUT",
    body: JSON.stringify(input),
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
  authEmail = "",
): Promise<ManagedUser> {
  const result = await readJson<{ user: ManagedUser }>(await authorizedFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), username, display_name: displayName, role, password, auth_email: authEmail }),
  }));
  return result.user;
}

export async function updateManagedUser(
  userId: string,
  displayName: string,
  status: "ACTIVE" | "DISABLED",
  authEmail?: string,
): Promise<ManagedUser> {
  const result = await readJson<{ user: ManagedUser }>(await authorizedFetch("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({ request_id: crypto.randomUUID(), user_id: userId, display_name: displayName, status, ...(authEmail == null ? {} : { auth_email: authEmail }) }),
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
