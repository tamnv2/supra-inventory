import * as XLSX from "xlsx";
import { readSheet } from "read-excel-file/browser";

export interface HrEmployeeInput {
  employee_code: string;
  display_name: string;
  contractor_name: string;
}

const REQUIRED = ["Mã nhân viên", "Họ và tên", "Nhà thầu"];
const MAX_ROWS = 5000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

export function downloadHrExample(): void {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    REQUIRED,
    ["1291001", "Nguyễn Văn A", "Nhà thầu mẫu"],
  ]);
  sheet["!cols"] = [{ wch: 20 }, { wch: 35 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(book, sheet, "Nhan su Picker");
  XLSX.writeFile(book, "Mau_nhap_nhan_su_Picker.xlsx");
}

export async function parseHrWorkbook(file: File): Promise<HrEmployeeInput[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > MAX_FILE_BYTES || file.size === 0)
    throw new Error("Chọn file .xlsx hợp lệ, không vượt quá 10 MB.");
  const rows = await readSheet(file) as unknown[][];
  const headerIndex = rows.findIndex((row, index) => index < 15 &&
    REQUIRED.every(name => row.some(cell => normalize(cell) === normalize(name))));
  if (headerIndex < 0) throw new Error("Thiếu các cột Mã nhân viên, Họ và tên, Nhà thầu.");
  const header = rows[headerIndex].map(normalize);
  const cols = REQUIRED.map(name => header.indexOf(normalize(name)));
  const byCode = new Map<string, HrEmployeeInput>();
  const problems: string[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawCode = row[cols[0]];
    const code = String(rawCode ?? "").trim().toLowerCase();
    const name = String(row[cols[1]] ?? "").trim().replace(/\s+/g, " ");
    const contractor = String(row[cols[2]] ?? "").trim().replace(/\s+/g, " ");
    if (!code && !name && !contractor) continue;
    if (!/^[a-z0-9._-]{1,64}$/.test(code) || !name || !contractor || name.length > 200 || contractor.length > 200) {
      problems.push(`Dòng ${i + 1}: thiếu thông tin hoặc mã/tên/Nhà thầu không hợp lệ.`);
      continue;
    }
    const prior = byCode.get(code);
    if (prior && (prior.display_name !== name || prior.contractor_name !== contractor)) {
      problems.push(`Dòng ${i + 1}: mã nhân viên ${code} trùng nhưng tên hoặc Nhà thầu khác.`);
      continue;
    }
    byCode.set(code, { employee_code: code, display_name: name, contractor_name: contractor });
    if (byCode.size > MAX_ROWS) throw new Error("File có hơn 5.000 mã nhân viên, vui lòng chia lô.");
  }
  if (problems.length) throw new Error(problems.slice(0, 30).join("\n") + (problems.length > 30 ? `\nCòn ${problems.length - 30} dòng lỗi.` : ""));
  if (!byCode.size) throw new Error("File chưa có nhân sự hợp lệ.");
  return [...byCode.values()];
}
