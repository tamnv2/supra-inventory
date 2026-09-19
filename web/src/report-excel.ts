import * as XLSX from "xlsx";
import type { AdminReportingRow } from "./api";

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

export function downloadReportWorkbook(
  rows: AdminReportingRow[],
  meta: ReportExcelMeta,
  statusLabel: (status: string) => string,
): void {
  const table: unknown[][] = [
    ["SKU", "Tên sản phẩm", "Trạng thái", "Báo lần đầu", "Xử lý xong", "Thời gian xử lý (phút)", "Số lượt báo"],
    ...rows.map((row) => [
      row.sku,
      row.product_name,
      statusLabel(row.status),
      safeDate(row.first_report_at),
      safeDate(row.resolved_at),
      row.duration_minutes ?? "",
      Number(row.total_ticket_count || 0),
    ]),
  ];

  const reportSheet = XLSX.utils.aoa_to_sheet(table, { cellDates: true });
  reportSheet["!cols"] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
  ];
  if (rows.length) reportSheet["!autofilter"] = { ref: `A1:G${rows.length + 1}` };

  for (const address of Object.keys(reportSheet)) {
    if (address.startsWith("!")) continue;
    const cell = reportSheet[address];
    if (cell?.t === "d") cell.z = "dd/mm/yyyy hh:mm:ss";
  }

  const infoSheet = XLSX.utils.aoa_to_sheet([
    ["Thông tin", "Giá trị"],
    ["Từ ngày", meta.from],
    ["Đến ngày", meta.to],
    ["Kết quả", meta.status ? statusLabel(meta.status) : "Tất cả kết quả"],
    ["SKU / tên sản phẩm", meta.query || "Tất cả"],
    ["Số dòng", rows.length],
    ["Thời điểm xuất", meta.generatedAt],
  ], { cellDates: true });
  infoSheet["!cols"] = [{ wch: 24 }, { wch: 42 }];
  const generatedCell = infoSheet["B7"];
  if (generatedCell?.t === "d") generatedCell.z = "dd/mm/yyyy hh:mm:ss";

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, reportSheet, "Báo cáo");
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Thông tin");

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

  XLSX.writeFile(workbook, `SUPRA_Inventory_Bao_cao_${stamp}.xlsx`, {
    compression: true,
    cellDates: true,
  });
}
