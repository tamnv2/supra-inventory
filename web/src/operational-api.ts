import { authorizedFetch, readJson } from "./api";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, "");
const operationalFetch = authorizedFetch;

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
