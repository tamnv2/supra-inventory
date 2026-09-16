export interface HrSourceInput {
  sheet_url: string;
  tab_name: string;
}

export interface HrSourceValidationResult {
  sheet_id: string;
  sheet_url: string;
  tab_name: string;
  mnv_header: string;
  full_name_header: string;
  header_row: number;
  data_row_count: number;
  verified_at: string;
  runtime_service_account: string;
}

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

const SHEETS_READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEET_URL_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/;

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getServiceAccountAccessToken(rawServiceAccountJson: string): Promise<{
  accessToken: string;
  clientEmail: string;
}> {
  let credentials: ServiceAccountJson;
  try {
    credentials = JSON.parse(rawServiceAccountJson) as ServiceAccountJson;
  } catch {
    throw new Error("GOOGLE_RUNTIME_SA_JSON is not valid JSON");
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_RUNTIME_SA_JSON is missing client_email/private_key");
  }

  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SHEETS_READ_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await tokenResponse.json()) as TokenResponse;
  if (!tokenResponse.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "service_account_token_exchange_failed");
  }

  return { accessToken: payload.access_token, clientEmail: credentials.client_email };
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ");
}

function detectHeaders(rows: string[][]): {
  headerRow: number;
  mnvHeader: string;
  fullNameHeader: string;
} | null {
  const mnvNames = new Set(["mnv", "ma nv", "ma nhan vien"]);
  const fullNameNames = new Set(["ho ten", "ho va ten", "ho ten nhan vien", "ten nhan vien"]);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    let mnvHeader = "";
    let fullNameHeader = "";

    for (const cell of row) {
      const normalized = normalizeHeader(String(cell || ""));
      if (!mnvHeader && mnvNames.has(normalized)) mnvHeader = String(cell);
      if (!fullNameHeader && fullNameNames.has(normalized)) fullNameHeader = String(cell);
    }

    if (mnvHeader && fullNameHeader) {
      return { headerRow: rowIndex + 1, mnvHeader, fullNameHeader };
    }
  }

  return null;
}

export function parseGoogleSheetId(sheetUrl: string): string {
  const match = sheetUrl.trim().match(SHEET_URL_RE);
  if (!match?.[1]) {
    throw new Error("Link Google Sheet không hợp lệ. Yêu cầu dạng https://docs.google.com/spreadsheets/d/<ID>/...");
  }
  return match[1];
}

export async function validateHrSheetSource(
  rawServiceAccountJson: string,
  input: HrSourceInput,
): Promise<HrSourceValidationResult> {
  const sheetUrl = input.sheet_url.trim();
  const tabName = input.tab_name.trim();
  if (!tabName) throw new Error("Tên tab không được để trống");

  const sheetId = parseGoogleSheetId(sheetUrl);
  const { accessToken, clientEmail } = await getServiceAccountAccessToken(rawServiceAccountJson);
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  const metaUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}`);
  metaUrl.searchParams.set("fields", "sheets.properties(sheetId,title)");
  const metaResponse = await fetch(metaUrl.toString(), { headers: authHeaders });
  if (!metaResponse.ok) {
    if (metaResponse.status === 403 || metaResponse.status === 404) {
      throw new Error(`Không đọc được Google Sheet. Hãy share Viewer cho ${clientEmail} và kiểm tra lại link.`);
    }
    throw new Error(`Google Sheets metadata request failed: HTTP ${metaResponse.status}`);
  }

  const meta = (await metaResponse.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };
  const exactTab = meta.sheets?.find((sheet) => sheet.properties?.title === tabName);
  if (!exactTab) {
    throw new Error(`Không tìm thấy tab đúng tên "${tabName}" trong Google Sheet.`);
  }

  const range = `'${tabName.replaceAll("'", "''")}'!A1:ZZ2000`;
  const valuesUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`,
  );
  valuesUrl.searchParams.set("majorDimension", "ROWS");
  const valuesResponse = await fetch(valuesUrl.toString(), { headers: authHeaders });
  if (!valuesResponse.ok) {
    throw new Error(`Không đọc được dữ liệu tab "${tabName}": HTTP ${valuesResponse.status}`);
  }

  const values = (await valuesResponse.json()) as { values?: string[][] };
  const rows = values.values || [];
  const detected = detectHeaders(rows.slice(0, 20));
  if (!detected) {
    throw new Error('Tab phải chứa đủ 2 cột "MNV" và "Họ tên" (hoặc tên cột tương đương đã chuẩn hóa).');
  }

  const dataRows = rows.slice(detected.headerRow).filter((row) => row.some((cell) => String(cell || "").trim() !== ""));

  return {
    sheet_id: sheetId,
    sheet_url: sheetUrl,
    tab_name: tabName,
    mnv_header: detected.mnvHeader,
    full_name_header: detected.fullNameHeader,
    header_row: detected.headerRow,
    data_row_count: dataRows.length,
    verified_at: new Date().toISOString(),
    runtime_service_account: clientEmail,
  };
}
