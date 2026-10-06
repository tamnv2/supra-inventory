import { getGoogleServiceAccountAccessToken } from "./google-service";

export interface EmployeeRecord {
  employee_code: string;
  full_name: string;
  contractor: string;
  source_hash: string;
}

const SHEETS_READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function cell(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", exactArrayBuffer(bytes)));
  return Array.from(digest).map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function readEmployees(
  rawServiceAccountJson: string,
  spreadsheetId: string,
  tabName: string,
): Promise<EmployeeRecord[]> {
  const token = await getGoogleServiceAccountAccessToken(rawServiceAccountJson, SHEETS_READ_SCOPE);
  const range = encodeURIComponent(`${tabName}!A1:C5000`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?majorDimension=ROWS`,
    { headers: { authorization: `Bearer ${token}`, accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`HR_SHEET_HTTP_${response.status}`);
  const payload = await response.json() as { values?: unknown[][] };
  const rows = Array.isArray(payload.values) ? payload.values : [];
  if (!rows.length) return [];

  const header = rows[0].map((value) => String(value ?? "").trim().toLowerCase());
  const codeIndex = header.findIndex((value) => value === "mã nhân viên" || value === "ma nhan vien");
  const nameIndex = header.findIndex((value) => value === "họ và tên" || value === "ho va ten");
  const contractorIndex = header.findIndex((value) => value === "nhà thầu" || value === "nha thau");
  if (codeIndex < 0 || nameIndex < 0 || contractorIndex < 0) {
    throw new Error("HR_HEADERS_INVALID");
  }

  const result: EmployeeRecord[] = [];
  const seen = new Set<string>();
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const employeeCode = cell(row, codeIndex);
    const fullName = cell(row, nameIndex);
    const contractor = cell(row, contractorIndex);
    if (!employeeCode || !fullName || seen.has(employeeCode)) continue;
    seen.add(employeeCode);
    result.push({
      employee_code: employeeCode,
      full_name: fullName,
      contractor,
      source_hash: await sha256([employeeCode, fullName, contractor].join("|")),
    });
  }
  return result;
}
