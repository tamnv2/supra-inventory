#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
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


def ensure_archive_source() -> None:
    if (SERVICE / "archive.ts").exists() and 'SCHEMA_VERSION = 4' in (SERVICE / "core.ts").read_text(encoding="utf-8"):
        return
    subprocess.run([sys.executable, str(ROOT / "tools/apply_archive_retention.py")], check=True)


def patch_business_core() -> None:
    path = SERVICE / "business-core.ts"
    anchor = '''function adminReports(state: DurableObjectState, url: URL): BusinessResult {'''
    addition = r'''function reportingRange(url: URL): { from: string; to: string; error?: string } {
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) {
    return { from, to, error: "INVALID_REPORTING_RANGE" };
  }
  if (Date.parse(to) - Date.parse(from) > 60 * 86_400_000) {
    return { from, to, error: "REPORTING_RANGE_TOO_LARGE" };
  }
  return { from, to };
}

function normalizeReportingLimit(value: string | null): number {
  const parsed = Number(value || 100);
  return Math.max(1, Math.min(500, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
}

function normalizeOffset(value: string | null): number {
  const parsed = Number(value || 0);
  return Math.max(0, Math.min(100_000, Number.isFinite(parsed) ? Math.trunc(parsed) : 0));
}

function adminDashboard(state: DurableObjectState, url: URL): BusinessResult {
  const range = reportingRange(url);
  if (range.error) return { status: 400, payload: { error: range.error, max_range_days: 60 } };
  const spanMs = Date.parse(range.to) - Date.parse(range.from);
  const bucketFormat = spanMs <= 2 * 86_400_000 ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";

  const ticketSummary = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS reports_count,
            COUNT(DISTINCT sku) AS unique_sku_count,
            COUNT(DISTINCT picker_employee_code) AS affected_picker_count
       FROM report_tickets
      WHERE reported_at >= ? AND reported_at < ?`,
    range.from, range.to,
  ).toArray()) || {};

  const pendingSummary = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(DISTINCT b.batch_id) AS pending_batch_count,
            COUNT(t.ticket_id) AS pending_picker_count
       FROM report_batches b
       LEFT JOIN report_tickets t ON t.batch_id = b.batch_id AND t.status = 'OPEN'
      WHERE b.status = 'PENDING'`,
  ).toArray()) || {};

  const resolvedSummary = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS resolved_batch_count,
            AVG((julianday(resolved_at) - julianday(first_report_at)) * 1440.0) AS avg_resolution_minutes
       FROM report_batches
      WHERE resolved_at >= ? AND resolved_at < ?
        AND status IN ('HAS_STOCK','SKIP_ALLOWED')`,
    range.from, range.to,
  ).toArray()) || {};

  const reportTimeline = state.storage.sql.exec<SqlRow>(
    `SELECT strftime(?, reported_at, '+7 hours') AS bucket, COUNT(*) AS count
       FROM report_tickets
      WHERE reported_at >= ? AND reported_at < ?
      GROUP BY bucket ORDER BY bucket ASC`,
    bucketFormat, range.from, range.to,
  ).toArray();
  const resolvedTimeline = state.storage.sql.exec<SqlRow>(
    `SELECT strftime(?, resolved_at, '+7 hours') AS bucket, COUNT(*) AS count
       FROM report_batches
      WHERE resolved_at >= ? AND resolved_at < ?
        AND status IN ('HAS_STOCK','SKIP_ALLOWED')
      GROUP BY bucket ORDER BY bucket ASC`,
    bucketFormat, range.from, range.to,
  ).toArray();
  const timelineMap = new Map<string, { bucket: string; reports: number; resolved: number }>();
  for (const row of reportTimeline) {
    const bucket = String(row.bucket || "");
    if (bucket) timelineMap.set(bucket, { bucket, reports: Number(row.count || 0), resolved: 0 });
  }
  for (const row of resolvedTimeline) {
    const bucket = String(row.bucket || "");
    if (!bucket) continue;
    const current = timelineMap.get(bucket) || { bucket, reports: 0, resolved: 0 };
    current.resolved = Number(row.count || 0);
    timelineMap.set(bucket, current);
  }

  const outcomes = state.storage.sql.exec<SqlRow>(
    `SELECT status, COUNT(*) AS count
       FROM report_batches
      WHERE first_report_at >= ? AND first_report_at < ?
      GROUP BY status ORDER BY count DESC`,
    range.from, range.to,
  ).toArray().map((row) => ({ status: String(row.status), count: Number(row.count || 0) }));

  const topSkus = state.storage.sql.exec<SqlRow>(
    `SELECT b.sku, b.product_name,
            COUNT(t.ticket_id) AS report_count,
            COUNT(DISTINCT t.picker_employee_code) AS picker_count
       FROM report_tickets t
       JOIN report_batches b ON b.batch_id = t.batch_id
      WHERE t.reported_at >= ? AND t.reported_at < ?
      GROUP BY b.sku, b.product_name
      ORDER BY report_count DESC, picker_count DESC, b.sku ASC
      LIMIT 8`,
    range.from, range.to,
  ).toArray().map((row) => ({
    sku: String(row.sku), product_name: String(row.product_name),
    report_count: Number(row.report_count || 0), picker_count: Number(row.picker_count || 0),
  }));

  return {
    status: 200,
    payload: {
      period: { from: range.from, to: range.to, bucket: spanMs <= 2 * 86_400_000 ? "hour" : "day" },
      kpis: {
        reports_count: Number(ticketSummary.reports_count || 0),
        unique_sku_count: Number(ticketSummary.unique_sku_count || 0),
        affected_picker_count: Number(ticketSummary.affected_picker_count || 0),
        pending_batch_count: Number(pendingSummary.pending_batch_count || 0),
        pending_picker_count: Number(pendingSummary.pending_picker_count || 0),
        resolved_batch_count: Number(resolvedSummary.resolved_batch_count || 0),
        avg_resolution_minutes: resolvedSummary.avg_resolution_minutes == null ? null : Math.round(Number(resolvedSummary.avg_resolution_minutes) * 10) / 10,
      },
      timeline: [...timelineMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
      outcomes,
      top_skus: topSkus,
    },
  };
}

function adminReporting(state: DurableObjectState, url: URL): BusinessResult {
  const range = reportingRange(url);
  if (range.error) return { status: 400, payload: { error: range.error, max_range_days: 60 } };
  const statusValue = String(url.searchParams.get("status") || "").trim();
  const validStatus = ["PENDING", "HAS_STOCK", "SKIP_ALLOWED", "CLOSED"].includes(statusValue) ? statusValue : "";
  const query = String(url.searchParams.get("query") || "").trim().slice(0, 500);
  const limit = normalizeReportingLimit(url.searchParams.get("limit"));
  const offset = normalizeOffset(url.searchParams.get("offset"));

  const where: string[] = ["b.first_report_at >= ?", "b.first_report_at < ?"];
  const args: SqlStorageValue[] = [range.from, range.to];
  if (validStatus) { where.push("b.status = ?"); args.push(validStatus); }
  if (query) { where.push("(b.sku LIKE ? OR b.product_name LIKE ?)"); args.push(`%${query}%`, `%${query}%`); }
  const clause = where.join(" AND ");

  const totalRow = firstRow(state.storage.sql.exec<SqlRow>(
    `SELECT COUNT(*) AS total FROM report_batches b WHERE ${clause}`,
    ...args,
  ).toArray()) || {};

  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at, b.resolved_at,
            b.resolved_by_user_id, b.resolution, b.correction_deadline_at,
            SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) AS open_ticket_count,
            COUNT(t.ticket_id) AS total_ticket_count,
            CASE WHEN b.resolved_at IS NULL THEN NULL
                 ELSE ROUND((julianday(b.resolved_at) - julianday(b.first_report_at)) * 1440.0, 1) END AS duration_minutes
       FROM report_batches b
       LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
      WHERE ${clause}
      GROUP BY b.batch_id
      ORDER BY b.first_report_at DESC, b.batch_id DESC
      LIMIT ? OFFSET ?`,
    ...args, limit, offset,
  ).toArray();

  return { status: 200, payload: { items: rows, count: rows.length, total: Number(totalRow.total || 0), limit, offset, from: range.from, to: range.to, status: validStatus, query } };
}

''' + anchor
    replace_once(path, anchor, addition, "business-dashboard-functions")
    route_anchor = '''  else if (request.method === "GET" && url.pathname === "/business/admin/reports") result = adminReports(state, url);'''
    route_new = '''  else if (request.method === "GET" && url.pathname === "/business/admin/dashboard") result = adminDashboard(state, url);
  else if (request.method === "GET" && url.pathname === "/business/admin/reporting") result = adminReporting(state, url);
''' + route_anchor
    replace_once(path, route_anchor, route_new, "business-dashboard-routes")


def patch_business_api() -> None:
    path = SERVICE / "business-api.ts"
    replace_once(path,
        '    "GET /api/admin/reports",\n',
        '    "GET /api/admin/reports",\n    "GET /api/admin/dashboard",\n    "GET /api/admin/reporting",\n',
        "api-supported")
    anchor = '''  if (key === "GET /api/admin/reports") {'''
    addition = '''  if (key === "GET /api/admin/dashboard" || key === "GET /api/admin/reporting") {
    await requireUser(request, env, ["ADMIN", "ROOT"]);
    const params = new URLSearchParams();
    for (const name of ["from", "to", "status", "query", "limit", "offset"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return coreGet(env, `${key.endsWith("dashboard") ? "/business/admin/dashboard" : "/business/admin/reporting"}?${params.toString()}`);
  }

''' + anchor
    replace_once(path, anchor, addition, "api-dashboard-route")


def patch_web_api() -> None:
    path = WEB / "api.ts"
    anchor = '''export interface AdminReportBatch {
'''
    interfaces = '''export interface AdminDashboard {
  period: { from: string; to: string; bucket: "hour" | "day" };
  kpis: {
    reports_count: number; unique_sku_count: number; affected_picker_count: number;
    pending_batch_count: number; pending_picker_count: number; resolved_batch_count: number;
    avg_resolution_minutes: number | null;
  };
  timeline: Array<{ bucket: string; reports: number; resolved: number }>;
  outcomes: Array<{ status: "PENDING" | "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED"; count: number }>;
  top_skus: Array<{ sku: string; product_name: string; report_count: number; picker_count: number }>;
}

export interface AdminReportingRow {
  batch_id: string; sku: string; product_name: string;
  status: "PENDING" | "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED";
  first_report_at: string; resolved_at: string | null; resolved_by_user_id: string | null;
  resolution: "HAS_STOCK" | "SKIP_ALLOWED" | null; correction_deadline_at: string | null;
  open_ticket_count: number; total_ticket_count: number; duration_minutes: number | null;
}

export interface AdminReportingPage {
  items: AdminReportingRow[]; count: number; total: number; limit: number; offset: number;
  from: string; to: string; status: string; query: string;
}

''' + anchor
    replace_once(path, anchor, interfaces, "web-api-interfaces")
    anchor2 = '''export async function getAdminReports(limit = 100, status = ""): Promise<{ items: AdminReportBatch[]; count: number }> {'''
    funcs = '''export async function getAdminDashboard(from: string, to: string): Promise<AdminDashboard> {
  const params = new URLSearchParams({ from, to });
  return readJson(await authorizedFetch(`/api/admin/dashboard?${params.toString()}`));
}

export async function getAdminReporting(options: { from: string; to: string; status?: string; query?: string; limit?: number; offset?: number }): Promise<AdminReportingPage> {
  const params = new URLSearchParams({ from: options.from, to: options.to, limit: String(options.limit || 100), offset: String(options.offset || 0) });
  if (options.status) params.set("status", options.status);
  if (options.query) params.set("query", options.query);
  return readJson(await authorizedFetch(`/api/admin/reporting?${params.toString()}`));
}

''' + anchor2
    replace_once(path, anchor2, funcs, "web-api-functions")


def patch_web_main() -> None:
    path = WEB / "main.ts"
    text = path.read_text(encoding="utf-8")
    text = text.replace('  getHrSource,\n', '  getHrSource,\n  getAdminDashboard,\n  getAdminReporting,\n', 1)
    text = text.replace('  type AppProfile,\n', '  type AppProfile,\n  type AdminDashboard,\n  type AdminReportingRow,\n', 1)
    text = text.replace('type Section = "operations" | "sku" | "hr" | "account";', 'type Section = "dashboard" | "operations" | "reports" | "sku" | "hr" | "account";', 1)
    text = text.replace('let hrSyncPreview: HrSyncPreview | null = null;\n', '''let hrSyncPreview: HrSyncPreview | null = null;
let dashboardData: AdminDashboard | null = null;
let adminReportRows: AdminReportingRow[] = [];
let adminReportTotal = 0;
let adminReportOffset = 0;
const ADMIN_REPORT_PAGE_SIZE = 100;
let dashboardFromDate = dateInputDaysAgo(6);
let dashboardToDate = dateInputDaysAgo(0);
let reportFromDate = dateInputDaysAgo(6);
let reportToDate = dateInputDaysAgo(0);
let reportStatus = "";
let reportQuery = "";
''', 1)

    helper_anchor = '''function escapeHtml(value: unknown): string {'''
    helpers = r'''function dateInputDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function apiRange(fromDate: string, toDate: string): { from: string; to: string } {
  const from = new Date(`${fromDate}T00:00:00+07:00`);
  const toStart = new Date(`${toDate}T00:00:00+07:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(toStart.getTime()) || from.getTime() > toStart.getTime()) throw new Error("Khoảng ngày không hợp lệ.");
  return { from: from.toISOString(), to: new Date(toStart.getTime() + 86_400_000).toISOString() };
}

function statusClass(value: string): string {
  if (value === "HAS_STOCK") return "ok";
  if (value === "SKIP_ALLOWED") return "skip";
  if (value === "PENDING") return "pending";
  return "closed";
}

function statusSymbol(value: string): string {
  if (value === "HAS_STOCK") return "✓";
  if (value === "SKIP_ALLOWED") return "→";
  if (value === "PENDING") return "!";
  return "↩";
}

function metricNumber(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString("vi-VN");
}

''' + helper_anchor
    if helper_anchor not in text: raise SystemExit('PATCH_FAIL main-helpers')
    text = text.replace(helper_anchor, helpers, 1)

    old_nav = '''  const tabs: Array<[Section, string]> = [];
  if (canOperate()) tabs.push(["operations", "Vận hành"]);
  if (canManage()) tabs.push(["sku", "Master SKU"], ["hr", "Nhân sự"]);
  tabs.push(["account", "Tài khoản"]);'''
    new_nav = '''  const tabs: Array<[Section, string]> = [];
  if (canManage()) tabs.push(["dashboard", "Tổng quan"]);
  if (canOperate()) tabs.push(["operations", "Hàng chờ"]);
  if (canManage()) tabs.push(["reports", "Báo cáo"], ["sku", "Master SKU"], ["hr", "Nhân sự"]);
  tabs.push(["account", "Tài khoản"]);'''
    if old_nav not in text: raise SystemExit('PATCH_FAIL main-nav')
    text = text.replace(old_nav, new_nav, 1)

    render_anchor = '''function renderSkuRows(): string {'''
    renderers = r'''function renderDashboard(): string {
  const data = dashboardData;
  const k = data?.kpis;
  const maxTrend = Math.max(1, ...(data?.timeline || []).flatMap((row) => [row.reports, row.resolved]));
  const outcomeTotal = Math.max(1, (data?.outcomes || []).reduce((sum, row) => sum + row.count, 0));
  return `<section class="page-stack dashboard-page">
    <div class="section-head dashboard-title"><div><p class="eyebrow">Điều hành hôm nay</p><h2>Tổng quan báo hàng</h2><p class="muted">Theo dõi tín hiệu quan trọng; mở Báo cáo khi cần drill-down chi tiết.</p></div><button id="refresh-dashboard" class="secondary">Làm mới</button></div>
    <form id="dashboard-filter" class="filter-bar" aria-label="Bộ lọc thời gian dashboard">
      <div class="preset-group"><button type="button" class="chip" data-dashboard-preset="today">Hôm nay</button><button type="button" class="chip" data-dashboard-preset="7">7 ngày</button><button type="button" class="chip" data-dashboard-preset="30">30 ngày</button></div>
      <label>Từ ngày<input name="fromDate" type="date" value="${escapeHtml(dashboardFromDate)}" required /></label>
      <label>Đến ngày<input name="toDate" type="date" value="${escapeHtml(dashboardToDate)}" required /></label>
      <button>Áp dụng</button>
    </form>
    <div class="dashboard-metrics">
      <div class="metric primary"><span>Báo thiếu trong kỳ</span><strong>${metricNumber(k?.reports_count)}</strong><small>ticket Picker tạo</small></div>
      <div class="metric"><span>SKU bị báo</span><strong>${metricNumber(k?.unique_sku_count)}</strong><small>SKU khác nhau</small></div>
      <div class="metric"><span>Picker bị ảnh hưởng</span><strong>${metricNumber(k?.affected_picker_count)}</strong><small>Picker khác nhau</small></div>
      <div class="metric attention"><span>Đợt đang chờ</span><strong>${metricNumber(k?.pending_batch_count)}</strong><small>${metricNumber(k?.pending_picker_count)} Picker đang chờ</small></div>
    </div>
    <div class="dashboard-grid two-one">
      <article class="card"><div class="card-head"><div><h3>Xu hướng báo hàng</h3><p class="muted tiny">Báo mới và batch đã xử lý theo ${data?.period.bucket === "hour" ? "giờ" : "ngày"}.</p></div><div class="legend"><span><i class="legend-dot reports"></i>Báo mới</span><span><i class="legend-dot resolved"></i>Đã xử lý</span></div></div>
        ${(data?.timeline || []).length ? `<div class="trend-chart" role="img" aria-label="Biểu đồ xu hướng báo hàng">${data!.timeline.map((row) => `<div class="trend-column"><div class="bars"><span class="bar reports" style="height:${Math.max(3, row.reports / maxTrend * 100)}%" title="Báo mới: ${row.reports}"></span><span class="bar resolved" style="height:${Math.max(3, row.resolved / maxTrend * 100)}%" title="Đã xử lý: ${row.resolved}"></span></div><small>${escapeHtml(row.bucket.slice(data?.period.bucket === "hour" ? 11 : 5))}</small></div>`).join("")}</div>` : `<div class="empty-state">Chưa có dữ liệu trong khoảng đã chọn.</div>`}
      </article>
      <article class="card"><h3>Kết quả xử lý</h3><div class="outcome-list">${(data?.outcomes || []).map((row) => `<div class="outcome-row"><div><span class="status ${statusClass(row.status)}">${statusSymbol(row.status)} ${escapeHtml(statusLabel(row.status))}</span><b>${metricNumber(row.count)}</b></div><div class="progress-track"><span style="width:${Math.max(2, row.count / outcomeTotal * 100)}%"></span></div></div>`).join("") || `<div class="empty-state">Chưa có dữ liệu.</div>`}</div><div class="resolution-summary"><span>Đã xử lý trong kỳ</span><strong>${metricNumber(k?.resolved_batch_count)}</strong><span>Thời gian xử lý TB</span><strong>${k?.avg_resolution_minutes == null ? "—" : `${k.avg_resolution_minutes.toLocaleString("vi-VN")} phút`}</strong></div></article>
    </div>
    <article class="card"><div class="card-head"><div><h3>SKU được báo nhiều</h3><p class="muted tiny">Dựa trên ticket phát sinh trong khoảng thời gian đã chọn.</p></div><button id="dashboard-open-reports" class="secondary">Mở báo cáo chi tiết</button></div>
      ${(data?.top_skus || []).length ? `<div class="table-wrap compact"><table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Số lượt báo</th><th>Picker ảnh hưởng</th></tr></thead><tbody>${data!.top_skus.map((row) => `<tr><td><b>${escapeHtml(row.sku)}</b></td><td>${escapeHtml(row.product_name)}</td><td>${metricNumber(row.report_count)}</td><td>${metricNumber(row.picker_count)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">Chưa có SKU được báo trong khoảng này.</div>`}
    </article>
  </section>`;
}

function renderAdminReports(): string {
  const page = Math.floor(adminReportOffset / ADMIN_REPORT_PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(adminReportTotal / ADMIN_REPORT_PAGE_SIZE));
  return `<section class="page-stack"><div class="section-head"><div><p class="eyebrow">Phân tích chi tiết</p><h2>Báo cáo</h2><p class="muted">Lọc theo thời gian, trạng thái hoặc SKU; dữ liệu nóng tối đa 60 ngày.</p></div><button id="export-reports" class="secondary">Xuất CSV</button></div>
    <form id="report-filter" class="filter-bar report-filter"><label>Từ ngày<input name="fromDate" type="date" value="${escapeHtml(reportFromDate)}" required /></label><label>Đến ngày<input name="toDate" type="date" value="${escapeHtml(reportToDate)}" required /></label><label>Trạng thái<select name="status"><option value="">Tất cả</option>${["PENDING","HAS_STOCK","SKIP_ALLOWED","CLOSED"].map((value) => `<option value="${value}" ${reportStatus === value ? "selected" : ""}>${escapeHtml(statusLabel(value))}</option>`).join("")}</select></label><label class="grow">SKU / Tên sản phẩm<input name="query" value="${escapeHtml(reportQuery)}" placeholder="Tìm SKU hoặc tên sản phẩm" /></label><button>Lọc</button></form>
    <article class="card report-card"><div class="card-head"><div><h3>Kết quả</h3><p class="muted tiny">${metricNumber(adminReportTotal)} batch · Trang ${page}/${pages}</p></div><div class="pagination"><button id="report-prev" class="secondary" ${adminReportOffset <= 0 ? "disabled" : ""}>Trước</button><button id="report-next" class="secondary" ${adminReportOffset + ADMIN_REPORT_PAGE_SIZE >= adminReportTotal ? "disabled" : ""}>Sau</button></div></div>
      ${adminReportRows.length ? `<div class="table-wrap report-table"><table><thead><tr><th>Thời gian báo</th><th>SKU</th><th>Tên sản phẩm</th><th>Trạng thái</th><th>Picker</th><th>Thời gian xử lý</th><th>Người xử lý</th><th>Chi tiết</th></tr></thead><tbody>${adminReportRows.map((row) => `<tr><td>${escapeHtml(fmtDate(row.first_report_at))}</td><td><b>${escapeHtml(row.sku)}</b></td><td>${escapeHtml(row.product_name)}</td><td><span class="status ${statusClass(row.status)}">${statusSymbol(row.status)} ${escapeHtml(statusLabel(row.status))}</span></td><td>${metricNumber(row.total_ticket_count)}${Number(row.open_ticket_count) ? ` · <b>${metricNumber(row.open_ticket_count)} chờ</b>` : ""}</td><td>${row.duration_minutes == null ? "—" : `${Number(row.duration_minutes).toLocaleString("vi-VN")} phút`}</td><td>${escapeHtml(row.resolved_by_user_id || "—")}</td><td><button class="secondary small-btn" data-detail-batch="${escapeHtml(row.batch_id)}">${batchDetails.has(row.batch_id) ? "Ẩn Picker" : "Xem Picker"}</button></td></tr>${batchDetails.has(row.batch_id) ? `<tr class="detail-row"><td colspan="8">${renderBatchDetails(row.batch_id)}</td></tr>` : ""}`).join("")}</tbody></table></div>` : `<div class="empty-state">Không có dữ liệu phù hợp bộ lọc.</div>`}
    </article>
  </section>`;
}

''' + render_anchor
    if render_anchor not in text: raise SystemExit('PATCH_FAIL main-render-anchor')
    text = text.replace(render_anchor, renderers, 1)

    old_content = '''function renderContent(): string {
  if (activeSection === "operations" && canOperate()) return renderOperations();
  if (activeSection === "sku" && canManage()) return renderSkuPage();
  if (activeSection === "hr" && canManage()) return renderHrPage();
  return renderAccountPage();
}'''
    new_content = '''function renderContent(): string {
  if (activeSection === "dashboard" && canManage()) return renderDashboard();
  if (activeSection === "operations" && canOperate()) return renderOperations();
  if (activeSection === "reports" && canManage()) return renderAdminReports();
  if (activeSection === "sku" && canManage()) return renderSkuPage();
  if (activeSection === "hr" && canManage()) return renderHrPage();
  return renderAccountPage();
}'''
    if old_content not in text: raise SystemExit('PATCH_FAIL main-content')
    text = text.replace(old_content, new_content, 1)

    old_header = '''${activeSection === "operations" ? "Vận hành báo hàng" : activeSection === "sku" ? "Master SKU" : activeSection === "hr" ? "Nhân sự" : "Tài khoản"}'''
    new_header = '''${activeSection === "dashboard" ? "Tổng quan" : activeSection === "operations" ? "Hàng chờ xử lý" : activeSection === "reports" ? "Báo cáo" : activeSection === "sku" ? "Master SKU" : activeSection === "hr" ? "Nhân sự" : "Tài khoản"}'''
    if old_header not in text: raise SystemExit('PATCH_FAIL main-header')
    text = text.replace(old_header, new_header, 1)
    text = text.replace('${message ? `<div class="notice">${escapeHtml(message)}</div>` : ""}', '${message ? `<div class="notice" role="status" aria-live="polite">${escapeHtml(message)}</div>` : ""}', 1)

    old_nav_handler = '''  document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => button.addEventListener("click", () => { activeSection = button.dataset.section as Section; message = ""; render(); }));'''
    new_nav_handler = '''  document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => button.addEventListener("click", () => void handleSectionChange(button.dataset.section as Section)));'''
    if old_nav_handler not in text: raise SystemExit('PATCH_FAIL main-nav-handler')
    text = text.replace(old_nav_handler, new_nav_handler, 1)

    attach_anchor = '''  document.querySelector<HTMLButtonElement>("#refresh-operations")?.addEventListener("click", () => void loadOperations());'''
    attach_new = '''  document.querySelector<HTMLButtonElement>("#refresh-dashboard")?.addEventListener("click", () => void loadAdminDashboard());
  document.querySelector<HTMLButtonElement>("#dashboard-open-reports")?.addEventListener("click", () => void handleSectionChange("reports"));
  document.querySelector<HTMLFormElement>("#dashboard-filter")?.addEventListener("submit", handleDashboardFilter);
  document.querySelectorAll<HTMLButtonElement>("[data-dashboard-preset]").forEach((button) => button.addEventListener("click", () => void handleDashboardPreset(button.dataset.dashboardPreset || "7")));
  document.querySelector<HTMLFormElement>("#report-filter")?.addEventListener("submit", handleReportFilter);
  document.querySelector<HTMLButtonElement>("#report-prev")?.addEventListener("click", () => void changeReportPage(-1));
  document.querySelector<HTMLButtonElement>("#report-next")?.addEventListener("click", () => void changeReportPage(1));
  document.querySelector<HTMLButtonElement>("#export-reports")?.addEventListener("click", () => void exportAdminReportsCsv());
''' + attach_anchor
    if attach_anchor not in text: raise SystemExit('PATCH_FAIL main-attach')
    text = text.replace(attach_anchor, attach_new, 1)

    logout_old = '''function handleLogout(): void { clearSession(); profile = null; message = ""; skuStatus = ""; skuRows = []; queueRows = []; recentRows = []; managedUsers = []; hrSyncPreview = null; batchDetails.clear(); resetSkuImportState(); render(); }'''
    logout_new = '''function handleLogout(): void { clearSession(); profile = null; message = ""; skuStatus = ""; skuRows = []; queueRows = []; recentRows = []; managedUsers = []; hrSyncPreview = null; dashboardData = null; adminReportRows = []; adminReportTotal = 0; adminReportOffset = 0; batchDetails.clear(); resetSkuImportState(); render(); }'''
    if logout_old not in text: raise SystemExit('PATCH_FAIL main-logout')
    text = text.replace(logout_old, logout_new, 1)

    login_old = '''    activeSection = canOperate(profile) ? "operations" : "account";
    if (canOperate(profile)) await loadOperations(false);'''
    login_new = '''    activeSection = canManage(profile) ? "dashboard" : canOperate(profile) ? "operations" : "account";
    if (canManage(profile)) await loadAdminDashboard(false);
    else if (canOperate(profile)) await loadOperations(false);'''
    if login_old not in text: raise SystemExit('PATCH_FAIL main-login')
    text = text.replace(login_old, login_new, 1)

    restore_old = '''  try { profile = await getMyProfile(); activeSection = canOperate(profile) ? "operations" : "account"; if (canOperate(profile)) await loadOperations(false); }'''
    restore_new = '''  try { profile = await getMyProfile(); activeSection = canManage(profile) ? "dashboard" : canOperate(profile) ? "operations" : "account"; if (canManage(profile)) await loadAdminDashboard(false); else if (canOperate(profile)) await loadOperations(false); }'''
    if restore_old not in text: raise SystemExit('PATCH_FAIL main-restore')
    text = text.replace(restore_old, restore_new, 1)

    functions_anchor = '''async function handlePasswordChange(event: SubmitEvent): Promise<void> {'''
    functions = r'''async function handleSectionChange(section: Section): Promise<void> {
  activeSection = section; message = ""; render();
  if (section === "dashboard" && canManage()) await loadAdminDashboard();
  else if (section === "operations" && canOperate()) await loadOperations();
  else if (section === "reports" && canManage()) await loadAdminReporting();
  else if (section === "hr" && canManage()) await loadManagedUsers();
}

async function loadAdminDashboard(renderAfter = true): Promise<void> {
  if (!canManage()) return;
  try { const range = apiRange(dashboardFromDate, dashboardToDate); dashboardData = await getAdminDashboard(range.from, range.to); }
  catch (error) { message = error instanceof Error ? error.message : "Không tải được dashboard."; }
  if (renderAfter) render();
}

async function handleDashboardFilter(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
  dashboardFromDate = String(form.get("fromDate") || dashboardFromDate); dashboardToDate = String(form.get("toDate") || dashboardToDate);
  await loadAdminDashboard();
}

async function handleDashboardPreset(preset: string): Promise<void> {
  const days = preset === "today" ? 1 : preset === "30" ? 30 : 7;
  dashboardToDate = dateInputDaysAgo(0); dashboardFromDate = dateInputDaysAgo(days - 1); await loadAdminDashboard();
}

async function loadAdminReporting(renderAfter = true): Promise<void> {
  if (!canManage()) return;
  try {
    const range = apiRange(reportFromDate, reportToDate);
    const result = await getAdminReporting({ ...range, status: reportStatus, query: reportQuery, limit: ADMIN_REPORT_PAGE_SIZE, offset: adminReportOffset });
    adminReportRows = result.items; adminReportTotal = result.total;
  } catch (error) { message = error instanceof Error ? error.message : "Không tải được báo cáo."; }
  if (renderAfter) render();
}

async function handleReportFilter(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
  reportFromDate = String(form.get("fromDate") || reportFromDate); reportToDate = String(form.get("toDate") || reportToDate);
  reportStatus = String(form.get("status") || ""); reportQuery = String(form.get("query") || "").trim(); adminReportOffset = 0;
  await loadAdminReporting();
}

async function changeReportPage(direction: number): Promise<void> {
  adminReportOffset = Math.max(0, Math.min(Math.max(0, adminReportTotal - 1), adminReportOffset + direction * ADMIN_REPORT_PAGE_SIZE));
  await loadAdminReporting();
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

async function exportAdminReportsCsv(): Promise<void> {
  if (!canManage()) return;
  const range = apiRange(reportFromDate, reportToDate); const rows: AdminReportingRow[] = []; const chunkSize = 500; const maxRows = 20_000;
  message = "Đang chuẩn bị file CSV..."; render();
  try {
    for (let offset = 0; offset < maxRows; offset += chunkSize) {
      const page = await getAdminReporting({ ...range, status: reportStatus, query: reportQuery, limit: chunkSize, offset });
      rows.push(...page.items);
      if (offset + page.items.length >= page.total || page.items.length < chunkSize) break;
    }
    if (rows.length >= maxRows) throw new Error(`Kết quả vượt ${maxRows.toLocaleString("vi-VN")} dòng. Hãy thu hẹp bộ lọc trước khi xuất.`);
    const header = ["Batch ID","Thời gian báo","Thời gian xử lý","Phút xử lý","SKU","Tên sản phẩm","Trạng thái","Kết quả","Tổng Picker","Picker đang chờ","Người xử lý"];
    const lines = [header.map(csvCell).join(","), ...rows.map((row) => [row.batch_id,row.first_report_at,row.resolved_at || "",row.duration_minutes ?? "",row.sku,row.product_name,statusLabel(row.status),row.resolution || "",row.total_ticket_count,row.open_ticket_count,row.resolved_by_user_id || ""].map(csvCell).join(","))];
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = href; a.download = `supra-inventory-report_${reportFromDate}_${reportToDate}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(href);
    message = `Đã xuất ${rows.length.toLocaleString("vi-VN")} dòng CSV.`;
  } catch (error) { message = error instanceof Error ? error.message : "Không xuất được CSV."; }
  render();
}

''' + functions_anchor
    if functions_anchor not in text: raise SystemExit('PATCH_FAIL main-functions')
    text = text.replace(functions_anchor, functions, 1)

    path.write_text(text, encoding="utf-8")


def write_concept3_css() -> None:
    (WEB / "styles.css").write_text(r''':root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #15241c; background: #f4f8f5; font-synthesis: none;
  --green-900:#0b4d32; --green-800:#08633c; --green-700:#087443; --green-600:#0b8750;
  --green-100:#e5f4ec; --green-50:#f1faf5; --orange-700:#b45309; --orange-100:#ffedd5;
  --red-700:#b42318; --red-100:#fee4e2; --ink:#15241c; --muted:#66756d; --line:#dbe7df; --panel:#ffffff;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: #f4f8f5; }
button, input, select { font: inherit; }
button { min-height: 44px; border: 0; border-radius: 10px; padding: 10px 15px; background: var(--green-700); color: #fff; font-weight: 750; cursor: pointer; transition: background .15s, transform .15s; }
button:hover { background: var(--green-800); }
button:active { transform: translateY(1px); }
button.secondary { background: #eef5f1; color: var(--green-900); border: 1px solid #cfe1d6; }
button.secondary:hover { background: #e2f0e8; }
button.success { background: var(--green-700); }
button.warning-btn { background: #fff7ed; color: var(--orange-700); border: 1px solid #fed7aa; }
button.chip { min-height: 38px; padding: 7px 12px; background: #fff; color: #405249; border: 1px solid var(--line); border-radius: 999px; }
button.small-btn { min-height: 36px; padding: 7px 10px; }
button:disabled { opacity: .45; cursor: not-allowed; transform: none; }
button.full { width: 100%; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid #76c99d; outline-offset: 2px; }
input, select { width: 100%; min-height: 44px; border: 1px solid #cfdcd4; border-radius: 10px; padding: 10px 12px; background: #fff; color: var(--ink); }
input:focus, select:focus { border-color: var(--green-600); }
label { display: grid; gap: 6px; font-weight: 650; color: #3b5045; font-size: .86rem; }
h1,h2,h3 { margin: 0; color: #14261c; letter-spacing: -.018em; }
p { line-height: 1.5; }
.shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.login-shell { background: radial-gradient(circle at 18% 10%, #dff4e8 0, transparent 35%), #f5faf7; }
.login-card { width: min(440px, 100%); }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 20px; box-shadow: 0 5px 20px rgba(25,72,48,.045); }
.card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
.stack,.page-stack { display:grid; gap:16px; }
.brand-mark { width:54px; height:54px; display:grid; place-items:center; border-radius:14px; background:var(--green-700); color:white; font-weight:900; letter-spacing:-.04em; margin-bottom:18px; }
.brand-mark.small { width:40px; height:40px; border-radius:10px; margin:0; }
.app-shell { min-height:100vh; display:grid; grid-template-columns:232px minmax(0,1fr); }
.sidebar { position:sticky; top:0; height:100vh; background:#fbfdfb; color:var(--ink); padding:18px 14px; display:flex; flex-direction:column; gap:22px; border-right:1px solid var(--line); }
.brand { display:flex; gap:10px; align-items:center; padding:2px 6px; }
.brand > div:last-child { display:grid; }
.brand span { color:#7a8b82; font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; }
.tabs { display:grid; gap:5px; }
.tab { width:100%; text-align:left; background:transparent; color:#4b5d53; border:1px solid transparent; }
.tab:hover { background:#f1f7f3; color:var(--green-900); }
.tab.active { background:var(--green-100); color:var(--green-900); border-color:#d0e8da; }
.sidebar-foot { margin-top:auto; display:grid; gap:12px; }
.user-mini { display:grid; gap:2px; padding:14px 6px 0; border-top:1px solid var(--line); }
.user-mini span { color:#7b8a82; font-size:.8rem; }
.workspace { min-width:0; padding:24px 28px 40px; max-width:1540px; width:100%; }
.workspace-head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:18px; }
.workspace-head h1 { font-size:1.65rem; }
.header-badges,.actions,.legend,.pagination,.preset-group { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.badge { display:inline-flex; align-items:center; border-radius:999px; padding:6px 10px; background:var(--green-100); color:var(--green-900); font-weight:800; font-size:.76rem; }
.badge.env { background:var(--orange-100); color:#8a4b08; }
.eyebrow { margin:0 0 5px; color:var(--green-700); font-size:.75rem; font-weight:850; letter-spacing:.09em; text-transform:uppercase; }
.muted { color:var(--muted); }
.tiny { color:var(--muted); font-size:.77rem; margin:4px 0 0; }
.notice { padding:12px 14px; margin-bottom:16px; border-radius:10px; background:#fff7ed; color:#8a4b08; border:1px solid #fed7aa; }
.message { color:#8a4b08; }
.metrics,.dashboard-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.metric { background:#fff; border:1px solid var(--line); border-radius:13px; padding:16px; display:grid; gap:6px; min-height:118px; }
.metric.primary { background:linear-gradient(145deg,#f3fbf6,#fff); border-color:#bcdcca; }
.metric.attention { background:#fffaf4; border-color:#f5d6ae; }
.metric span { color:#617269; font-size:.83rem; }
.metric strong { font-size:1.72rem; color:#173c29; }
.metric small { color:#84928a; }
.section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.filter-bar { display:grid; grid-template-columns:auto minmax(140px,180px) minmax(140px,180px) auto; align-items:end; gap:10px; padding:14px; border:1px solid var(--line); border-radius:13px; background:#fff; }
.report-filter { grid-template-columns:minmax(135px,170px) minmax(135px,170px) minmax(150px,190px) minmax(220px,1fr) auto; }
.filter-bar .grow { min-width:0; }
.dashboard-grid { display:grid; gap:14px; }
.dashboard-grid.two-one { grid-template-columns:minmax(0,2fr) minmax(300px,1fr); }
.legend { font-size:.76rem; color:#66766d; }
.legend-dot { width:9px; height:9px; border-radius:999px; display:inline-block; margin-right:5px; }
.legend-dot.reports,.bar.reports { background:var(--green-700); }
.legend-dot.resolved,.bar.resolved { background:#87b99d; }
.trend-chart { height:240px; display:flex; align-items:stretch; gap:7px; padding:18px 4px 2px; overflow-x:auto; border-top:1px solid #eef4f0; }
.trend-column { min-width:34px; flex:1; display:grid; grid-template-rows:1fr auto; gap:6px; text-align:center; color:#718077; font-size:.7rem; }
.bars { display:flex; align-items:flex-end; justify-content:center; gap:3px; height:190px; }
.bar { width:min(11px,38%); min-height:3px; border-radius:5px 5px 2px 2px; }
.outcome-list { display:grid; gap:13px; margin-top:16px; }
.outcome-row > div:first-child { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.progress-track { height:7px; margin-top:7px; background:#edf3ef; border-radius:999px; overflow:hidden; }
.progress-track span { display:block; height:100%; background:#7dbb98; border-radius:999px; }
.resolution-summary { display:grid; grid-template-columns:1fr auto; gap:9px 14px; border-top:1px solid var(--line); margin-top:18px; padding-top:14px; color:#66766d; }
.resolution-summary strong { color:#244734; }
.operation-list { display:grid; gap:10px; }
.operation-card { border:1px solid var(--line); border-radius:12px; padding:15px; }
.operation-main { display:flex; justify-content:space-between; gap:18px; align-items:center; }
.sku-code { font-size:1.08rem; font-weight:900; color:#17462e; }
.product-name { color:#405149; margin-top:3px; }
.operation-meta { display:flex; flex-wrap:wrap; gap:8px 14px; margin-top:8px; color:#728078; font-size:.8rem; }
.operation-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; min-width:360px; }
.detail-panel { margin-top:12px; background:#f5faf7; border:1px solid #e1ece5; border-radius:10px; padding:12px; }
.detail-row td { background:#f8fbf9; padding:8px 14px 14px; }
.detail-row .detail-panel { margin-top:0; }
.mini-list { display:grid; gap:7px; margin-top:8px; }
.empty-state { padding:28px; text-align:center; color:#718077; background:#f7faf8; border-radius:11px; }
.status { display:inline-flex; align-items:center; gap:4px; padding:5px 8px; border-radius:999px; font-weight:750; font-size:.76rem; white-space:nowrap; }
.status.ok { background:#e2f5e9; color:#12613a; }
.status.skip { background:#fff0d9; color:#8a4b08; }
.status.pending { background:#fff1dc; color:#9a5308; }
.status.closed { background:#edf0ee; color:#52625a; }
.inline-form { display:grid; grid-template-columns:minmax(180px,1fr) auto auto; gap:9px; margin:14px 0; }
.table-wrap { overflow:auto; max-height:520px; border:1px solid var(--line); border-radius:10px; }
.table-wrap.compact { max-height:380px; }
.report-table { max-height:620px; }
table { width:100%; border-collapse:collapse; min-width:720px; background:#fff; }
th,td { padding:10px 12px; text-align:left; border-bottom:1px solid #e7eee9; vertical-align:top; }
th { position:sticky; top:0; z-index:1; background:#f4f8f5; color:#52645a; font-size:.78rem; }
tbody tr:hover td { background:#fbfdfc; }
tbody tr:last-child td { border-bottom:0; }
pre { overflow:auto; padding:12px; background:#f6faf7; border-radius:10px; border:1px solid var(--line); white-space:pre-wrap; word-break:break-word; }
.conflict-box { margin-top:16px; padding:16px; border:1px solid #f1b766; background:#fff8ed; border-radius:12px; }
.conflict-box.warning { border-color:#e7a5a1; background:#fff5f4; }
.conflict-box .table-wrap { max-height:360px; background:#fff; }
.block-gap { margin-top:12px; }
.narrow { max-width:560px; }
@media (max-width:1100px) { .dashboard-metrics,.metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .dashboard-grid.two-one { grid-template-columns:1fr; } .filter-bar,.report-filter { grid-template-columns:repeat(2,minmax(0,1fr)); } .preset-group { grid-column:1/-1; } .operation-main { align-items:flex-start; flex-direction:column; } .operation-actions { min-width:0; justify-content:flex-start; } }
@media (max-width:760px) { .app-shell { grid-template-columns:1fr; } .sidebar { position:static; height:auto; } .tabs { grid-template-columns:repeat(2,minmax(0,1fr)); } .sidebar-foot { margin-top:0; } .workspace { padding:16px; } .workspace-head,.section-head,.card-head { flex-direction:column; } .filter-bar,.report-filter { grid-template-columns:1fr; } .preset-group { grid-column:auto; } .dashboard-metrics,.metrics { grid-template-columns:1fr 1fr; } .inline-form { grid-template-columns:1fr; } }
@media (max-width:480px) { .dashboard-metrics,.metrics { grid-template-columns:1fr; } .workspace { padding:12px; } }
''', encoding="utf-8")


def update_canonical_state() -> None:
    decisions = DECISIONS.read_text(encoding="utf-8")
    d024 = '| D024 | ACTIVE | Unified product UI is based on Owner-selected Concept 3 for both Web and Android/PDA: light background, green primary accent, orange reserved for warnings/attention, clean borders, low visual clutter, large practical touch targets on PDA, and consistent component/status language across platforms. Concept artwork is visual direction only: do not import mock data or capabilities that conflict with project scope/business rules (for example location/bin inventory, stock quantity management, or other unapproved fields). Role-specific information architecture and permissions remain authoritative over the concept artwork. |'
    d025 = '| D025 | ACTIVE | Admin/Root Web uses an operational dashboard and detailed reporting flow under Concept 3. Dashboard is a compact decision overview with one shared date filter, core KPI cards, report/resolution trend, outcome breakdown, and top reported SKUs; detail is drilled into the Reporting view. Reporting supports date/status/SKU filters, pagination and explicit chunked CSV export. Do not add unapproved stock quantity/location metrics or individual employee performance scoring. Avoid aggressive polling/auto-refresh; authoritative realtime invalidation and explicit refresh remain preferred to protect runtime quota. |'
    if d025 not in decisions:
        decisions = decisions.replace(d024, d024 + '\n' + d025)
    DECISIONS.write_text(decisions, encoding="utf-8")

    state = json.loads(STATE.read_text(encoding="utf-8"))
    state['current_status']['sqlite_schema'] = 4
    state['current_status']['archive'] = 'IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS'
    state['current_status']['web'] = 'CONCEPT3_ADMIN_DASHBOARD_REPORTING_AND_ROLE_OPERATIONS_BETA_DEPLOY_PASS'
    state['current_status']['admin_dashboard'] = 'CONCEPT3_OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS'
    archive_line = 'Archive/retention executor: fixed-range Google Sheet archive + SQLite markers/checkpoint + cleanup only archived final batches older than 60 days — Beta deploy/schema v4 PASS'
    dashboard_line = 'Admin/Root Concept 3 operational dashboard + filtered paginated reporting + chunked CSV export — Beta deploy/build PASS'
    for line in [archive_line, dashboard_line]:
        if line not in state['completed_capabilities']: state['completed_capabilities'].append(line)
    state['pending_build'] = [x for x in state['pending_build'] if 'archive' not in x.lower() and 'reporting/export' not in x.lower()]
    state['next_action']['primary'] = 'Apply Concept 3 visual system to Android/PDA role workflows, then run load/resilience/quota testing and Owner business acceptance.'
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding="utf-8")

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    registry['cloudflare']['beta_sqlite_schema_version'] = 4
    registry['environments']['beta']['sqlite_schema_version'] = 4
    registry['environments']['beta']['business_api_status'] = 'IMPLEMENTED_DEPLOYED_SCHEMA_V4'
    registry['environments']['beta']['web_source_status'] = 'CONCEPT3_ADMIN_DASHBOARD_REPORTING_ROLE_UI_DEPLOYED_PASS'
    registry['environments']['stable']['sqlite_schema_version_source'] = 4
    registry['archive']['source_status'] = 'BETA_DEPLOY_SCHEMA_V4_PASS'
    registry['admin_dashboard'] = {
      'audience': ['ADMIN','ROOT'],
      'design': 'CONCEPT_3_LIGHT_GREEN_OPERATIONAL',
      'data_source': 'INVENTORY_CORE_SQLITE_AGGREGATE_ENDPOINT',
      'default_period_days': 7,
      'max_hot_reporting_range_days': 60,
      'csv_export': 'EXPLICIT_CLIENT_EXPORT_PAGED_500_MAX_20000',
      'refresh': 'EXPLICIT_OR_REALTIME_INVALIDATION_NO_AGGRESSIVE_POLLING',
      'source_status': 'BETA_DEPLOY_BUILD_PASS'
    }
    completed = registry['application_build_completed']
    for item in ['business_sqlite_schema_v4_archive', 'backup_archive_execution', 'admin_dashboard_reporting_concept3']:
        if item not in completed: completed.append(item)
    registry['application_build_pending'] = [x for x in registry['application_build_pending'] if x not in ['backup_archive_execution','backup_archive_execution_verify','reporting_and_exports']]
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding="utf-8")


def main() -> None:
    ensure_archive_source()
    patch_business_core()
    patch_business_api()
    patch_web_api()
    patch_web_main()
    write_concept3_css()
    update_canonical_state()
    print('CONCEPT3_ADMIN_REPORTING_PATCH_PASS')


if __name__ == '__main__':
    main()
