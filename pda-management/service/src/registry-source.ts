import { getGoogleServiceAccountAccessToken } from "./google-service";

export interface RegistryDevice {
  serial: string;
  device_key: string;
  model: string;
  manufacturer: string;
  launcher_version: string;
  registry_last_seen_at: string;
}

const SHEETS_READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function cell(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

export async function readRegistryDevices(rawServiceAccountJson: string, spreadsheetId: string): Promise<RegistryDevice[]> {
  if (!spreadsheetId) throw new Error("REGISTRY_SHEET_ID_REQUIRED");
  const token = await getGoogleServiceAccountAccessToken(rawServiceAccountJson, SHEETS_READ_SCOPE);
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
