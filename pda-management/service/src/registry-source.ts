interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface RegistryDevice {
  serial: string;
  device_key: string;
  model: string;
  manufacturer: string;
  launcher_version: string;
  registry_last_seen_at: string;
}

const SHEETS_READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

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
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function accessToken(rawJson: string): Promise<string> {
  let credentials: ServiceAccountJson;
  try {
    credentials = JSON.parse(rawJson) as ServiceAccountJson;
  } catch {
    throw new Error("GOOGLE_RUNTIME_SA_JSON_INVALID");
  }
  if (!credentials.client_email || !credentials.private_key) throw new Error("GOOGLE_RUNTIME_SA_JSON_INCOMPLETE");

  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: SHEETS_READ_SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
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

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }
  return payload.access_token;
}

function cell(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

export async function readRegistryDevices(rawServiceAccountJson: string, spreadsheetId: string): Promise<RegistryDevice[]> {
  if (!spreadsheetId) throw new Error("REGISTRY_SHEET_ID_REQUIRED");
  const token = await accessToken(rawServiceAccountJson);
  const range = encodeURIComponent("PDA_Devices!A2:AD5000");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?majorDimension=ROWS`,
    { headers: { authorization: `Bearer ${token}`, accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`REGISTRY_SHEET_HTTP_${response.status}`);
  const payload = await response.json() as { values?: unknown[][] };
  const rows = Array.isArray(payload.values) ? payload.values : [];
  const devices: RegistryDevice[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const serial = (cell(row, 4) || cell(row, 1) || cell(row, 3)).toUpperCase();
    const deviceKey = cell(row, 0).toLowerCase();
    if (!serial || !/^[a-f0-9]{64}$/.test(deviceKey) || seen.has(serial)) continue;
    seen.add(serial);
    devices.push({
      serial,
      device_key: deviceKey,
      manufacturer: cell(row, 7),
      model: cell(row, 9),
      launcher_version: cell(row, 21),
      registry_last_seen_at: cell(row, 27) || cell(row, 26) || cell(row, 25),
    });
  }
  return devices;
}
