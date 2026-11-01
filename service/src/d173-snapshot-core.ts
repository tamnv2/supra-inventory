import { readD173OperationalSnapshotPart, realtimeStreamMetadata, type D173OperationalSnapshotPart } from "./operational-v2-core";

export type D173SnapshotKind = "REPORTER" | "PICKER";
export type D173SnapshotUser = {
  user_id: string; employee_code?: string | null; role: string;
  shortage_reporting_enabled?: number | boolean | null;
};
const PARAMS = new Set([
  "limit", "offset", "scope", "queue_limit", "queue_offset", "recent_limit", "recent_offset",
  "recent_scope", "status", "from", "to", "include_overdue", "overdue_limit", "overdue_offset",
  "result_limit", "display_only",
]);

function error(code: string, status = 400): Response {
  return new Response(JSON.stringify({ error: code }), { status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

/** No caller may supply identity or unbounded arbitrary projection arguments. */
export function d173SnapshotParams(value: unknown): URLSearchParams | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(value)) {
    if (!PARAMS.has(key) || !["string", "number", "boolean"].includes(typeof item)) continue;
    const text = String(item);
    if (text.length > 128) return null;
    params.set(key, text);
  }
  return params;
}

function endpoint(path: string, values: Record<string, string>): URL {
  const url = new URL("https://inventory-core.internal/operational/" + path);
  for (const [key, value] of Object.entries(values)) if (value !== "") url.searchParams.set(key, value);
  return url;
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** All SQL reads and metadata are captured before the first await. No external
 * provider call, object self-fetch, extra auth lookup or cross-request cache. */
export async function readD173Snapshot(
  state: DurableObjectState, kind: D173SnapshotKind, user: D173SnapshotUser,
  input: URLSearchParams, nowMs = Date.now(),
): Promise<Record<string, unknown> | Response> {
  const inputObject: Record<string, string> = {};
  input.forEach((value, key) => { inputObject[key] = value; });
  const params = d173SnapshotParams(inputObject);
  if (!params) return error("INVALID_SNAPSHOT_PARAMETERS");
  if (kind === "PICKER" && (user.role !== "PICKER" || !user.employee_code)) {
    return error(user.role === "PICKER" ? "PICKER_EMPLOYEE_CODE_REQUIRED" : "FORBIDDEN", user.role === "PICKER" ? 409 : 403);
  }
  if (kind === "REPORTER" && !["REPORTER", "ADMIN", "PICKPACK_ADMIN", "ROOT"].includes(user.role)) return error("FORBIDDEN", 403);
  const local = new Date(nowMs + 7 * 3_600_000);
  const dayStartMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 7 * 3_600_000;
  const from = params.get("from") || new Date(dayStartMs).toISOString();
  const to = params.get("to") || new Date(dayStartMs + 86_400_000).toISOString();
  if (Boolean(params.get("from")) !== Boolean(params.get("to"))) return error("INVALID_SNAPSHOT_RANGE");
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) return error("INVALID_SNAPSHOT_RANGE");
  if (Date.parse(to) - Date.parse(from) > 60 * 86_400_000) return error("SNAPSHOT_RANGE_TOO_LARGE");

  const snapshot: Record<string, Record<string, unknown>> = {};
  let failure: Response | null = null;
  const read = (part: D173OperationalSnapshotPart, url: URL, reuse = {}) => {
    const result = readD173OperationalSnapshotPart(state, part, url, nowMs, reuse);
    if (result.status >= 400) {
      failure = new Response(JSON.stringify(result.payload), { status: result.status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
    }
    snapshot[part] = result.payload;
    return result.payload;
  };
  if (kind === "REPORTER") {
    const queue = read("queue", endpoint("reporter/queue", {
      limit: params.get("queue_limit") || params.get("limit") || "100",
      offset: params.get("queue_offset") || params.get("offset") || "0",
    }));
    const recentScope = params.get("recent_scope") || params.get("scope") || "";
    const recentFrom = params.get("from") || "";
    const recentTo = params.get("to") || "";
    const recent = read("recent", endpoint("reporter/recent", {
      limit: params.get("recent_limit") || "50", offset: params.get("recent_offset") || "0",
      scope: recentScope, status: params.get("status") || "", from: recentFrom, to: recentTo,
    }));
    let overdue: Record<string, unknown> | undefined;
    if (params.get("include_overdue") === "1") overdue = read("overdue", endpoint("reporter/overdue", {
      limit: params.get("overdue_limit") || params.get("limit") || "100",
      offset: params.get("overdue_offset") || params.get("offset") || "0",
    }));
    const totals = recent.totals && typeof recent.totals === "object"
      ? recent.totals as Record<string, unknown> : {};
    // Reuse terminal totals only when the two predicates are identical. The
    // APP_TODAY_OPEN lower bound must not clip a requested historical range.
    const equalRecentRange = recentFrom === from && recentTo === to &&
      (recentScope.toUpperCase() !== "APP_TODAY_OPEN" || Date.parse(from) >= dayStartMs);
    read("counters", endpoint("reporter/counters", { from, to, status: params.get("status") || "" }), {
      queue_total: numberField(queue.total),
      ...(overdue?.enabled === true ? { overdue_total: numberField(overdue.total) } : {}),
      ...(equalRecentRange ? { recent: { from, to, has_stock: numberField(totals.has_stock),
        skip_allowed: numberField(totals.skip_allowed), withdrawn: numberField(totals.withdrawn) } } : {}),
    });
  } else {
    read("reports", endpoint("picker/reports", { user_id: user.user_id, employee_code: user.employee_code || "",
      limit: params.get("limit") || "50", offset: params.get("offset") || "0", scope: params.get("scope") || "" }));
    if (user.shortage_reporting_enabled === true || Number(user.shortage_reporting_enabled || 0) === 1) {
      read("results", endpoint("picker/results", { user_id: user.user_id,
        limit: params.get("result_limit") || "20", display_only: params.get("display_only") === "1" ? "1" : "" }));
    } else snapshot.results = { items: [], count: 0, total: 0, reporting_enabled: false };
  }
  if (failure) return failure;
  const revision = realtimeStreamMetadata(state);
  const serverTime = new Date(nowMs).toISOString();
  const sorted: Array<[string, string]> = [];
  params.forEach((value, key) => { sorted.push([key, value]); });
  sorted.sort(([a], [b]) => a.localeCompare(b));
  // Include generated counter bounds so a VN midnight rollover changes the
  // view identity even if the requesting device clock is wrong.
  const view = { kind, params: Object.fromEntries(sorted), counter_from: from, counter_to: to };
  const fingerprint = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(view)));
  const digest = Array.from(new Uint8Array(fingerprint), b => b.toString(16).padStart(2, "0")).join("");
  return {
    snapshot, revision, server_time: serverTime,
    view_revision: `${revision.stream_epoch}:${revision.latest_seq}:${digest.slice(0, 24)}`,
    view, coverage: { views: Object.keys(snapshot), user_id: user.user_id, role: user.role,
      cursor_authority: false, complete: true },
  };
}
