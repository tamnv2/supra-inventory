const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, "");
const SESSION_KEY = "supra_inventory_beta_session_v1";

type StoredSession = {
  id_token: string;
  refresh_token: string;
  expires_at: number;
  user: { user_id: string; employee_code?: string | null; display_name?: string; role?: string };
};

export type SlaState = "UNCONFIGURED" | "NORMAL" | "WARNING" | "ESCALATED";

export interface SlaConfig {
  warning_minutes: number;
  escalation_minutes: number;
  updated_at?: string;
  updated_by?: string | null;
}

export interface ReporterBatchV2 {
  batch_id: string;
  sku: string;
  product_name: string;
  status: "PENDING";
  first_report_at: string;
  last_report_at?: string | null;
  version: number;
  previous_batch_id?: string | null;
  previous_resolved_at?: string | null;
  affected_picker_count: number;
  earliest_ticket_at: string;
  sla_state: SlaState;
  waiting_minutes: number;
  recurrence_minutes?: number | null;
}

export interface ReporterQueueV2 {
  items: ReporterBatchV2[];
  count: number;
  sla_configured: boolean;
  sla: SlaConfig | null;
}

export interface ReporterRecentV2 {
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
  version: number;
  previous_batch_id?: string | null;
  previous_resolved_at?: string | null;
  affected_picker_count: number;
  ack_target_count: number;
  acknowledged_count: number;
}

export interface ReporterTicketV2 {
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

export interface PickerReportV2 {
  ticket_id: string;
  batch_id: string;
  sku: string;
  product_name: string;
  status: "OPEN" | "WITHDRAWN" | "RESOLVED";
  reported_at: string;
  withdraw_deadline_at: string;
  withdrawn_at: string | null;
  resolved_at: string | null;
  batch_status: "PENDING" | "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED";
  resolution: "HAS_STOCK" | "SKIP_ALLOWED" | null;
  correction_deadline_at: string | null;
  batch_version: number;
  previous_batch_id?: string | null;
  result_event_id?: string | null;
  received_at?: string | null;
  displayed_at?: string | null;
  acknowledged_at?: string | null;
}

export interface PickerResultV2 {
  result_event_id: string;
  batch_id: string;
  batch_version: number;
  target_user_id: string;
  received_at: string | null;
  displayed_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  sku: string;
  product_name: string;
  status: "HAS_STOCK" | "SKIP_ALLOWED";
  resolution: "HAS_STOCK" | "SKIP_ALLOWED";
  resolved_at: string | null;
}

export interface OperationalInsights {
  sla?: {
    configured?: boolean;
    warning_count?: number;
    escalated_count?: number;
    config?: SlaConfig | null;
  };
  recurrence?: {
    count?: number;
    items?: Array<{
      batch_id: string;
      sku: string;
      product_name: string;
      previous_batch_id: string;
      first_report_at: string;
      previous_resolved_at: string;
      recurrence_minutes?: number | null;
    }>;
  };
  [key: string]: unknown;
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.id_token && parsed?.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("supra:session-changed"));
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: (T & { error?: string; message?: string }) | null = null;
  try { payload = JSON.parse(text) as T & { error?: string; message?: string }; }
  catch { throw new Error(`API trả dữ liệu không hợp lệ (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  return payload;
}

async function refresh(session: StoredSession): Promise<StoredSession> {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const next = await readJson<{ id_token: string; refresh_token: string; expires_in: number }>(response);
  const updated: StoredSession = {
    ...session,
    id_token: next.id_token,
    refresh_token: next.refresh_token,
    expires_at: Date.now() + Math.max(60, Number(next.expires_in || 3600)) * 1000,
  };
  saveSession(updated);
  return updated;
}

export async function operationalFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let session = readSession();
  if (!session) throw new Error("Chưa đăng nhập.");
  if (session.expires_at <= Date.now() + 60_000) session = await refresh(session);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${session.id_token}`);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401) {
    session = await refresh(session);
    headers.set("authorization", `Bearer ${session.id_token}`);
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  }
  return response;
}

export async function getReporterQueueV2(limit = 200): Promise<ReporterQueueV2> {
  return readJson(await operationalFetch(`/api/reporter/queue?limit=${limit}`));
}

export async function getReporterRecentV2(limit = 200): Promise<{ items: ReporterRecentV2[]; count: number }> {
  return readJson(await operationalFetch(`/api/reporter/recent?limit=${limit}`));
}

export async function getReporterTicketsV2(batchId: string): Promise<{ batch_id: string; items: ReporterTicketV2[]; count: number }> {
  return readJson(await operationalFetch(`/api/reporter/batch-tickets?batch_id=${encodeURIComponent(batchId)}`));
}

export async function getPickerReportsV2(limit = 100): Promise<{ items: PickerReportV2[]; count: number }> {
  return readJson(await operationalFetch(`/api/picker/reports?limit=${limit}`));
}

export async function getPickerResultsV2(limit = 100): Promise<{ items: PickerResultV2[]; count: number }> {
  return readJson(await operationalFetch(`/api/picker/results?limit=${limit}`));
}

export async function createPickerReport(sku: string): Promise<unknown> {
  return readJson(await operationalFetch("/api/picker/reports", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), sku }),
  }));
}

export async function withdrawPickerReport(ticketId: string): Promise<unknown> {
  return readJson(await operationalFetch("/api/picker/reports/withdraw", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), ticket_id: ticketId }),
  }));
}

export async function markPickerResult(resultEventId: string, batchId: string, batchVersion: number, stage: "RECEIVED" | "DISPLAYED" | "ACKNOWLEDGED"): Promise<unknown> {
  return readJson(await operationalFetch("/api/picker/results/receipt", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), result_event_id: resultEventId, batch_id: batchId, batch_version: batchVersion, stage }),
  }));
}

export async function resolveBatchV2(batchId: string, resolution: "HAS_STOCK" | "SKIP_ALLOWED"): Promise<unknown> {
  return readJson(await operationalFetch("/api/reporter/batches/resolve", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), batch_id: batchId, resolution }),
  }));
}

export async function correctBatchV2(batchId: string): Promise<unknown> {
  return readJson(await operationalFetch("/api/reporter/batches/correct", {
    method: "POST",
    body: JSON.stringify({ request_id: crypto.randomUUID(), batch_id: batchId }),
  }));
}

export async function getSlaConfig(): Promise<{ configured: boolean; sla: SlaConfig | null }> {
  return readJson(await operationalFetch("/api/admin/sla"));
}

export async function saveSlaConfig(warningMinutes: number, escalationMinutes: number): Promise<{ status: string; sla: SlaConfig }> {
  return readJson(await operationalFetch("/api/admin/sla", {
    method: "PUT",
    body: JSON.stringify({ warning_minutes: warningMinutes, escalation_minutes: escalationMinutes }),
  }));
}

export async function getOperationalInsights(): Promise<OperationalInsights> {
  return readJson(await operationalFetch("/api/admin/operational-insights"));
}

export async function getServiceHealth(): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/health`, { headers: { accept: "application/json" } });
  return readJson<Record<string, unknown>>(response);
}
