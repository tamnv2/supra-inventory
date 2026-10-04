import { getServiceAccountAccessToken } from "./hr-source";

export interface StoredHrSource {
  sheet_id: string;
  sheet_url: string;
  tab_name: string;
  mnv_header: string;
  full_name_header: string;
  contractor_header: string;
  header_row: number;
}

export interface HrEmployee {
  employee_code: string;
  display_name: string;
  contractor_name: string;
}

export type HrInvalidRowReason =
  | "INVALID_EMPLOYEE_CODE"
  | "MISSING_DISPLAY_NAME"
  | "DISPLAY_NAME_TOO_LONG"
  | "CONTRACTOR_TOO_LONG";

export interface HrEmployeeReadResult {
  employees: HrEmployee[];
  duplicate_conflicts: Array<{ employee_code: string; names: string[]; contractors: string[] }>;
  invalid_rows: number[];
  invalid_row_details: Array<{ row: number; reasons: HrInvalidRowReason[] }>;
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
  const employeeCodeWanted = normalizeHeader(source.mnv_header);
  const nameWanted = normalizeHeader(source.full_name_header);
  const contractorWanted = normalizeHeader(source.contractor_header);
  if (!contractorWanted) {
    throw new Error("Nguồn nhân sự chưa cấu hình cột Nhà thầu. Hãy xác nhận lại nguồn trước khi đồng bộ Picker.");
  }
  const employeeCodeIndex = headers.findIndex((cell) => normalizeHeader(String(cell || "")) === employeeCodeWanted);
  const nameIndex = headers.findIndex((cell) => normalizeHeader(String(cell || "")) === nameWanted);
  const contractorIndex = headers.findIndex((cell) => normalizeHeader(String(cell || "")) === contractorWanted);
  if (employeeCodeIndex < 0 || nameIndex < 0 || contractorIndex < 0) {
    throw new Error("Tên cột Mã nhân viên/Họ và tên/Nhà thầu của nguồn nhân sự đã thay đổi. Hãy xác nhận lại cấu hình nguồn.");
  }

  const byCode = new Map<string, Map<string, { display_name: string; contractor_name: string }>>();
  const invalidRows: number[] = [];
  const invalidRowDetails: HrEmployeeReadResult["invalid_row_details"] = [];
  let sourceRowCount = 0;
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (!row.some((cell) => String(cell || "").trim())) continue;
    sourceRowCount += 1;
    const employeeCode = String(row[employeeCodeIndex] || "").trim().toLowerCase();
    const displayName = String(row[nameIndex] || "").trim().replace(/\s+/g, " ");
    const contractorName = String(row[contractorIndex] || "").trim().replace(/\s+/g, " ");
    const invalidReasons: HrInvalidRowReason[] = [];
    if (!/^[a-z0-9._-]{1,64}$/.test(employeeCode)) invalidReasons.push("INVALID_EMPLOYEE_CODE");
    if (!displayName) invalidReasons.push("MISSING_DISPLAY_NAME");
    if (displayName.length > 200) invalidReasons.push("DISPLAY_NAME_TOO_LONG");
    if (contractorName.length > 200) invalidReasons.push("CONTRACTOR_TOO_LONG");
    if (invalidReasons.length) {
      invalidRows.push(index + 1);
      invalidRowDetails.push({ row: index + 1, reasons: invalidReasons });
      continue;
    }
    const variants = byCode.get(employeeCode) || new Map<string, { display_name: string; contractor_name: string }>();
    variants.set(`${displayName}\u001f${contractorName}`, { display_name: displayName, contractor_name: contractorName });
    byCode.set(employeeCode, variants);
  }

  const duplicateConflicts: Array<{ employee_code: string; names: string[]; contractors: string[] }> = [];
  const employees: HrEmployee[] = [];
  for (const [employeeCode, variants] of byCode.entries()) {
    const values = [...variants.values()];
    if (values.length > 1) {
      duplicateConflicts.push({
        employee_code: employeeCode,
        names: [...new Set(values.map((item) => item.display_name))].sort(),
        contractors: [...new Set(values.map((item) => item.contractor_name))].sort(),
      });
    } else if (values.length === 1) {
      employees.push({ employee_code: employeeCode, display_name: values[0].display_name, contractor_name: values[0].contractor_name });
    }
  }
  employees.sort((a, b) => a.employee_code.localeCompare(b.employee_code, "vi", { numeric: true }));
  duplicateConflicts.sort((a, b) => a.employee_code.localeCompare(b.employee_code, "vi", { numeric: true }));
  return {
    employees,
    duplicate_conflicts: duplicateConflicts,
    invalid_rows: invalidRows,
    invalid_row_details: invalidRowDetails,
    source_row_count: sourceRowCount,
    loaded_at: new Date().toISOString(),
  };
}
