import * as XLSX from "xlsx";
import type {
  AdminDashboard,
  AdminReportingDetailRow,
  AdminReportingRow,
  OperationalInsights,
} from "./api";

export type ReportExcelMeta = {
  from: string;
  to: string;
  status: string;
  query: string;
  generatedAt: Date;
};

function safeDate(value: string | null | undefined): Date | string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function setDateFormats(sheet: XLSX.WorkSheet): void {
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address];
    if (cell?.t === "d") cell.z = "dd/mm/yyyy hh:mm:ss";
  }
}

function addSheet(
  workbook: XLSX.WorkBook,
  name: string,
  table: unknown[][],
  widths: number[],
  autofilter = true,
): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(table, { cellDates: true });
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  if (autofilter && table.length > 1 && table[0]?.length) {
    const lastCol = XLSX.utils.encode_col(table[0].length - 1);
    sheet["!autofilter"] = { ref: `A1:${lastCol}${table.length}` };
  }
  setDateFormats(sheet);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
  return sheet;
}

function resolutionSourceLabel(value: string | null | undefined): string {
  if (value === "SYSTEM_TIMEOUT") return "Hệ thống tự động do quá hạn";
  if (value === "HUMAN") return "Invent xử lý";
  if (value === "CORRECTION") return "Invent sửa kết quả";
  if (!value) return "";
  return value;
}

function ticketStatusLabel(value: string): string {
  if (value === "OPEN") return "Đang mở";
  if (value === "WITHDRAWN") return "Picker thu hồi";
  if (value === "RESOLVED") return "Đã xử lý";
  return value;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function downloadReportWorkbook(
  rows: AdminReportingRow[],
  details: AdminReportingDetailRow[],
  dashboard: AdminDashboard,
  insights: OperationalInsights,
  meta: ReportExcelMeta,
  statusLabel: (status: string) => string,
): void {
  const workbook = XLSX.utils.book_new();
  const kpi = dashboard?.kpis;
  const outcomes = dashboard?.outcomes || [];
  const sources = dashboard?.resolution_sources || [];
  const outcome = (status: string) => Number(outcomes.find((row) => row.status === status)?.count || 0);
  const sourceCount = (status: string, source: string) =>
    Number(sources.find((row) => row.status === status && row.resolution_source === source)?.count || 0);
  const automaticSkip = sourceCount("SKIP_ALLOWED", "SYSTEM_TIMEOUT");
  const humanSkip = Math.max(0, outcome("SKIP_ALLOWED") - automaticSkip);

  const summaryTable: unknown[][] = [
    ["BÁO CÁO VẬN HÀNH INVENTORY", ""],
    ["Khoảng dữ liệu", `${meta.from} → ${meta.to}`],
    ["Bộ lọc kết quả", meta.status ? statusLabel(meta.status) : "Tất cả kết quả"],
    ["Bộ lọc SKU / tên", meta.query || "Tất cả"],
    ["Thời điểm xuất", meta.generatedAt],
    ["", ""],
    ["CHỈ SỐ TỔNG QUAN", "GIÁ TRỊ"],
    ["Lượt báo hết hàng", Number(kpi?.reports_count || 0)],
    ["SKU phát sinh", Number(kpi?.unique_sku_count || 0)],
    ["Picker bị ảnh hưởng", Number(kpi?.affected_picker_count || 0)],
    ["SKU/đợt đang chờ", Number(kpi?.pending_batch_count || 0)],
    ["Picker đang chờ", Number(kpi?.pending_picker_count || 0)],
    ["Đợt đã xử lý", Number(kpi?.resolved_batch_count || 0)],
    ["Thời gian xử lý bình quân (phút)", kpi?.avg_resolution_minutes ?? ""],
    ["", ""],
    ["KẾT QUẢ", "SỐ ĐỢT"],
    ["Đã có hàng", outcome("HAS_STOCK")],
    ["Bỏ qua bởi Invent", humanSkip],
    ["Tự động bỏ qua do quá hạn", automaticSkip],
    ["Picker thu hồi", outcome("CLOSED")],
    ["Đang chờ", outcome("PENDING")],
    ["", ""],
    ["SLA HIỆN TẠI", "GIÁ TRỊ"],
    ["SKU đang cảnh báo", Number(insights?.sla?.warning_count || 0)],
    ["SKU đã quá hạn", Number(insights?.sla?.escalated_count || 0)],
    ["Phiên bản cấu hình", Number(insights?.sla?.config?.policy_version || 0) || ""],
  ];
  const summarySheet = addSheet(workbook, "Tổng quan", summaryTable, [34, 44], false);
  summarySheet["!merges"] = [XLSX.utils.decode_range("A1:B1")];

  const timelineTable: unknown[][] = [
    ["Thời gian", "Lượt báo", "Đợt xử lý xong"],
    ...(dashboard?.timeline || []).map((row) => [
      safeDate(row.bucket),
      Number(row.reports || 0),
      Number(row.resolved || 0),
    ]),
  ];
  addSheet(workbook, "Diễn biến", timelineTable, [22, 16, 18]);

  const batchTable: unknown[][] = [
    [
      "Batch ID", "SKU", "Tên sản phẩm", "Kết quả", "Nguồn xử lý", "MNV xử lý", "Người xử lý",
      "Báo lần đầu", "Xử lý xong", "Thời gian xử lý (phút)", "Đang mở", "Tổng lượt báo",
      "Hạn sửa Skip→Có hàng",
    ],
    ...rows.map((row) => [
      row.batch_id,
      row.sku,
      row.product_name,
      statusLabel(row.status),
      row.status === "CLOSED" ? "Picker tự thu hồi" : resolutionSourceLabel(row.resolution_source),
      row.resolved_by_employee_code || "",
      row.resolved_by_display_name || row.resolved_by_user_id || "",
      safeDate(row.first_report_at),
      safeDate(row.resolved_at),
      row.duration_minutes ?? "",
      Number(row.open_ticket_count || 0),
      Number(row.total_ticket_count || 0),
      safeDate(row.correction_deadline_at),
    ]),
  ];
  addSheet(workbook, "Đợt báo hàng", batchTable, [36, 18, 46, 22, 28, 16, 28, 22, 22, 24, 12, 14, 22]);

  const detailTable: unknown[][] = [
    [
      "Batch ID", "Ticket ID", "SKU", "Tên sản phẩm", "Kết quả đợt", "Trạng thái Picker",
      "MNV Picker", "Tên Picker", "Picker báo lúc", "Hạn thu hồi", "Picker thu hồi lúc",
      "Picker/đợt xử lý lúc", "Thời gian Picker chờ (phút)", "Tự động Skip dự kiến",
      "Tự động Skip được cấp", "Kết quả Picker", "Nguồn kết quả", "MNV Invent xử lý",
      "Invent xử lý", "Báo đầu đợt", "Báo cuối đợt", "Kết thúc đợt", "Thời gian đợt (phút)",
      "Kết quả được nhận", "Kết quả được hiển thị", "Picker xác nhận kết quả", "Batch trước",
      "Batch trước xử lý xong",
    ],
    ...details.map((row) => [
      row.batch_id,
      row.ticket_id,
      row.sku,
      row.product_name,
      statusLabel(row.batch_status),
      ticketStatusLabel(row.ticket_status),
      row.picker_employee_code,
      row.picker_display_name,
      safeDate(row.reported_at),
      safeDate(row.withdraw_deadline_at),
      safeDate(row.withdrawn_at),
      safeDate(row.ticket_resolved_at || row.batch_resolved_at),
      row.picker_wait_minutes ?? "",
      safeDate(row.auto_skip_deadline_at),
      safeDate(row.auto_skip_allowed_at),
      row.ticket_resolution ? statusLabel(row.ticket_resolution) : "",
      resolutionSourceLabel(row.ticket_resolution_source),
      row.resolved_by_employee_code || "",
      row.resolved_by_display_name || "",
      safeDate(row.first_report_at),
      safeDate(row.last_report_at),
      safeDate(row.batch_resolved_at),
      row.batch_duration_minutes ?? "",
      safeDate(row.result_received_at),
      safeDate(row.result_displayed_at),
      safeDate(row.result_acknowledged_at),
      row.previous_batch_id || "",
      safeDate(row.previous_resolved_at),
    ]),
  ];
  addSheet(workbook, "Chi tiết Picker", detailTable, [
    36, 36, 18, 46, 20, 20, 16, 28, 22, 22, 22, 22, 24, 22, 22, 20, 28, 16, 28,
    22, 22, 22, 22, 22, 22, 22, 36, 22,
  ]);

  const detailsBySku = new Map<string, AdminReportingDetailRow[]>();
  for (const detail of details) {
    const list = detailsBySku.get(detail.sku) || [];
    list.push(detail);
    detailsBySku.set(detail.sku, list);
  }
  const rowsBySku = new Map<string, AdminReportingRow[]>();
  for (const row of rows) {
    const list = rowsBySku.get(row.sku) || [];
    list.push(row);
    rowsBySku.set(row.sku, list);
  }
  const skuKeys = unique([...rowsBySku.keys(), ...detailsBySku.keys()]).sort((a, b) => a.localeCompare(b, "vi"));
  const skuTable: unknown[][] = [[
    "SKU", "Tên sản phẩm", "Số đợt", "Lượt báo", "Picker khác nhau", "Đã có hàng",
    "Bỏ qua", "Picker thu hồi", "Đang chờ", "Báo đầu kỳ", "Báo cuối kỳ",
    "TG xử lý TB (phút)", "TG Picker chờ TB (phút)",
  ]];
  for (const sku of skuKeys) {
    const skuRows = rowsBySku.get(sku) || [];
    const skuDetails = detailsBySku.get(sku) || [];
    const durations = skuRows.map((row) => row.duration_minutes).filter((value): value is number => value != null);
    const waits = skuDetails.map((row) => row.picker_wait_minutes).filter((value): value is number => value != null);
    const dates = skuDetails.map((row) => row.reported_at).filter(Boolean).sort();
    skuTable.push([
      sku,
      skuRows[0]?.product_name || skuDetails[0]?.product_name || "",
      skuRows.length,
      skuDetails.length,
      unique(skuDetails.map((row) => row.picker_employee_code || row.picker_user_id || "").filter(Boolean)).length,
      skuRows.filter((row) => row.status === "HAS_STOCK").length,
      skuRows.filter((row) => row.status === "SKIP_ALLOWED").length,
      skuRows.filter((row) => row.status === "CLOSED").length,
      skuRows.filter((row) => row.status === "PENDING").length,
      safeDate(dates[0]),
      safeDate(dates[dates.length - 1]),
      durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) * 10 / durations.length) / 10 : "",
      waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) * 10 / waits.length) / 10 : "",
    ]);
  }
  addSheet(workbook, "Tổng hợp SKU", skuTable, [18, 46, 12, 12, 16, 14, 14, 16, 14, 22, 22, 22, 24]);

  const topSkuTable: unknown[][] = [
    ["SKU", "Tên sản phẩm", "Lượt báo", "Picker ảnh hưởng"],
    ...(dashboard?.top_skus || []).map((row) => [
      row.sku,
      row.product_name,
      Number(row.report_count || 0),
      Number(row.picker_count || 0),
    ]),
  ];
  addSheet(workbook, "SKU nổi bật", topSkuTable, [18, 46, 14, 18]);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(meta.generatedAt);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  const stamp = `${pick("year")}${pick("month")}${pick("day")}_${pick("hour")}${pick("minute")}${pick("second")}`;

  XLSX.writeFile(workbook, `SUPRA_Inventory_Chi_tiet_${stamp}.xlsx`, {
    compression: true,
    cellDates: true,
  });
}
