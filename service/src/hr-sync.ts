import { getServiceAccountAccessToken } from "./hr-source";

export interface StoredHrSource {
  sheet_id: string;
  sheet_url: string;
  tab_name: string;
  mnv_header: string;
  full_name_header: string;
  header_row: number;
}

export interface HrEmployee {
  employee_code: string;
  display_name: string;
}

export interface HrEmployeeReadResult {
  employees: HrEmployee[];
  duplicate_conflicts: Array<{ employee_code: string; names: string[] }>;
  invalid_rows: number[];
  source_row_count: number;
  loaded_at: string;
}

function normalizeHeader(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .trim().toLowerCase().replace(/[_./-]+/g, " ").replace(/\s+/g, " ");
}

export async function readHrEmployees(rawServiceAccountJson: string, source: StoredHrSource): Promise<HrEmployeeReadResult> {
  const { accessToken } = await getServiceAccountAccessToken(rawServiceAccountJson);
  const range = `'${source.tab_name.replaceAll("'", "''")}'!A1:ZZ2000`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(source.sheet_id)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("majorDimension", "ROWS");
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Không đọc được dữ liệu nhân sự: HTTP ${response.status}`);
  const values = (await response.json()) as { values?: string[][] };
  const rows = values.values || [];
  const headerIndex = Math.max(0, Number(source.header_row || 1) - 1);
  const headers = rows[headerIndex] || [];
  const mnvWanted = normalizeHeader(source.mnv_header);
  const nameWanted = normalizeHeader(source.full_name_header);
  const mnvIndex = headers.findIndex((cell) => normalizeHeader(String(cell || "")) === mnvWanted);
  const nameIndex = headers.findIndex((cell) => normalizeHeader(String(cell || "")) === nameWanted);
  if (mnvIndex < 0 || nameIndex < 0) throw new Error("Header MNV/Họ tên của nguồn nhân sự đã thay đổi. Hãy xác nhận lại cấu hình nguồn.");

  const byCode = new Map<string, Set<string>>();
  const invalidRows: number[] = [];
  let sourceRowCount = 0;
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (!row.some((cell) => String(cell || "").trim())) continue;
    sourceRowCount += 1;
    const employeeCode = String(row[mnvIndex] || "").trim().toLowerCase();
    const displayName = String(row[nameIndex] || "").trim().replace(/\s+/g, " ");
    if (!/^[a-z0-9._-]{1,64}$/.test(employeeCode) || !displayName || displayName.length > 200) {
      invalidRows.push(index + 1);
      continue;
    }
    const names = byCode.get(employeeCode) || new Set<string>();
    names.add(displayName);
    byCode.set(employeeCode, names);
  }

  const duplicateConflicts: Array<{ employee_code: string; names: string[] }> = [];
  const employees: HrEmployee[] = [];
  for (const [employeeCode, names] of byCode.entries()) {
    if (names.size > 1) duplicateConflicts.push({ employee_code: employeeCode, names: [...names].sort() });
    else employees.push({ employee_code: employeeCode, display_name: [...names][0] });
  }
  employees.sort((a, b) => a.employee_code.localeCompare(b.employee_code, "vi", { numeric: true }));
  duplicateConflicts.sort((a, b) => a.employee_code.localeCompare(b.employee_code, "vi", { numeric: true }));
  return { employees, duplicate_conflicts: duplicateConflicts, invalid_rows: invalidRows, source_row_count: sourceRowCount, loaded_at: new Date().toISOString() };
}
