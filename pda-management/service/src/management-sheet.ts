import { getGoogleServiceAccountAccessToken } from "./google-service";

const SHEETS_WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

interface DeviceSnapshot {
  serial: string;
  device_key: string;
  model: string;
  manufacturer: string;
  launcher_version: string;
  usage_status: string;
  physical_condition: string;
  condition_id?: string | null;
  condition_name?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  borrower_employee_code?: string | null;
  borrower_name?: string | null;
  borrowed_at?: string | null;
  last_returned_at?: string | null;
  note?: string;
  registry_last_seen_at?: string;
  updated_at?: string;
  updated_by?: string;
  revision: number;
}

interface TransactionSnapshot {
  transaction_id: string;
  serial: string;
  action: string;
  employee_code?: string | null;
  employee_name?: string | null;
  physical_condition?: string | null;
  condition_id?: string | null;
  condition_name?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  old_usage_status?: string | null;
  new_usage_status?: string | null;
  occurred_at: string;
  operator_user_id: string;
  operator_name: string;
  note?: string;
  idempotency_key: string;
  revision: number;
}

async function sheetFetch(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers || {}),
    },
  });
}

async function findDeviceRow(token: string, spreadsheetId: string, serial: string): Promise<number | null> {
  const range = encodeURIComponent("PDA_Devices!A2:A2000");
  const response = await sheetFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
  );
  if (!response.ok) throw new Error(`MANAGEMENT_SHEET_READ_HTTP_${response.status}`);
  const payload = await response.json() as { values?: unknown[][] };
  const rows = Array.isArray(payload.values) ? payload.values : [];
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index]?.[0] ?? "").trim().toUpperCase() === serial.toUpperCase()) {
      return index + 2;
    }
  }
  return null;
}

function deviceRow(device: DeviceSnapshot): unknown[] {
  return [
    device.serial,
    device.device_key,
    device.model,
    "",
    "AUTO",
    device.usage_status,
    device.physical_condition,
    device.borrower_employee_code || "",
    device.borrower_name || "",
    device.borrowed_at || "",
    device.last_returned_at || "",
    device.note || "",
    device.registry_last_seen_at || "",
    device.updated_at || new Date().toISOString(),
    device.updated_by || "",
    device.revision,
    device.site_id || "",
    device.site_name || "",
    device.condition_id || "",
    device.condition_name || "",
  ];
}

export async function mirrorDeviceAndTransaction(
  rawServiceAccountJson: string,
  spreadsheetId: string,
  device: DeviceSnapshot,
  transaction: TransactionSnapshot,
): Promise<void> {
  const token = await getGoogleServiceAccountAccessToken(rawServiceAccountJson, SHEETS_WRITE_SCOPE);

  const transactionRange = encodeURIComponent("PDA_Transactions!A:R");
  const appendTransaction = await sheetFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${transactionRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [[
          transaction.transaction_id,
          transaction.serial,
          transaction.action,
          transaction.employee_code || "",
          transaction.employee_name || "",
          transaction.physical_condition || "",
          transaction.old_usage_status || "",
          transaction.new_usage_status || "",
          transaction.occurred_at,
          transaction.operator_user_id,
          transaction.operator_name,
          transaction.note || "",
          transaction.idempotency_key,
          transaction.revision,
          transaction.condition_id || "",
          transaction.condition_name || "",
          transaction.site_id || "",
          transaction.site_name || "",
        ]],
      }),
    },
  );
  if (!appendTransaction.ok) {
    throw new Error(`MANAGEMENT_TRANSACTION_APPEND_HTTP_${appendTransaction.status}`);
  }

  const row = await findDeviceRow(token, spreadsheetId, device.serial);
  const values = [deviceRow(device)];
  if (row == null) {
    const range = encodeURIComponent("PDA_Devices!A:T");
    const appendDevice = await sheetFetch(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ majorDimension: "ROWS", values }) },
    );
    if (!appendDevice.ok) throw new Error(`MANAGEMENT_DEVICE_APPEND_HTTP_${appendDevice.status}`);
  } else {
    const range = encodeURIComponent(`PDA_Devices!A${row}:T${row}`);
    const updateDevice = await sheetFetch(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values }) },
    );
    if (!updateDevice.ok) throw new Error(`MANAGEMENT_DEVICE_UPDATE_HTTP_${updateDevice.status}`);
  }
}


export interface CatalogMirrorItem {
  catalog_type: "CONDITION" | "SITE";
  item_id: string;
  name: string;
  legacy_condition?: string | null;
  status: string;
  sort_order: number;
  updated_at?: string | null;
}

async function findCatalogRow(
  token: string,
  spreadsheetId: string,
  catalogType: string,
  itemId: string,
): Promise<number | null> {
  const range = encodeURIComponent("PDA_Catalogs!A2:B2000");
  const response = await sheetFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
  );
  if (!response.ok) throw new Error(`MANAGEMENT_CATALOG_READ_HTTP_${response.status}`);
  const payload = await response.json() as { values?: unknown[][] };
  const rows = Array.isArray(payload.values) ? payload.values : [];
  for (let index = 0; index < rows.length; index += 1) {
    if (
      String(rows[index]?.[0] ?? "").trim().toUpperCase() === catalogType.toUpperCase() &&
      String(rows[index]?.[1] ?? "").trim() === itemId
    ) return index + 2;
  }
  return null;
}

export async function mirrorCatalogItem(
  rawServiceAccountJson: string,
  spreadsheetId: string,
  item: CatalogMirrorItem,
): Promise<void> {
  const token = await getGoogleServiceAccountAccessToken(rawServiceAccountJson, SHEETS_WRITE_SCOPE);
  const row = await findCatalogRow(token, spreadsheetId, item.catalog_type, item.item_id);
  const values = [[
    item.catalog_type,
    item.item_id,
    item.name,
    item.legacy_condition || "",
    item.status,
    item.sort_order,
    item.updated_at || new Date().toISOString(),
  ]];

  if (row == null) {
    const range = encodeURIComponent("PDA_Catalogs!A:G");
    const append = await sheetFetch(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ majorDimension: "ROWS", values }) },
    );
    if (!append.ok) throw new Error(`MANAGEMENT_CATALOG_APPEND_HTTP_${append.status}`);
    return;
  }

  const range = encodeURIComponent(`PDA_Catalogs!A${row}:G${row}`);
  const update = await sheetFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values }) },
  );
  if (!update.ok) throw new Error(`MANAGEMENT_CATALOG_UPDATE_HTTP_${update.status}`);
}


export interface ManagementUserMirror {
  user_id: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
  employee_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

async function findManagementUserRow(
  token: string,
  spreadsheetId: string,
  userId: string,
): Promise<{ row: number; createdAt: string; revision: number } | null> {
  const range = encodeURIComponent("PDA_Users!A2:J500");
  const response = await sheetFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
  );
  if (!response.ok) throw new Error(`MANAGEMENT_USER_READ_HTTP_${response.status}`);
  const payload = await response.json() as { values?: unknown[][] };
  const rows = Array.isArray(payload.values) ? payload.values : [];
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index]?.[0] ?? "").trim() !== userId) continue;
    return {
      row: index + 2,
      createdAt: String(rows[index]?.[6] ?? ""),
      revision: Number(rows[index]?.[9] ?? 0) || 0,
    };
  }
  return null;
}

export async function mirrorManagementUser(
  rawServiceAccountJson: string,
  spreadsheetId: string,
  user: ManagementUserMirror,
  actorUserId: string,
): Promise<void> {
  const token = await getGoogleServiceAccountAccessToken(rawServiceAccountJson, SHEETS_WRITE_SCOPE);
  const existing = await findManagementUserRow(token, spreadsheetId, user.user_id);
  const now = user.updated_at || new Date().toISOString();
  const createdAt = user.created_at || existing?.createdAt || now;
  const revision = (existing?.revision || 0) + 1;
  const values = [[
    user.user_id,
    user.username,
    user.display_name,
    user.role,
    user.status,
    user.employee_code || "",
    createdAt,
    now,
    actorUserId,
    revision,
  ]];

  if (!existing) {
    const range = encodeURIComponent("PDA_Users!A:J");
    const append = await sheetFetch(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ majorDimension: "ROWS", values }) },
    );
    if (!append.ok) throw new Error(`MANAGEMENT_USER_APPEND_HTTP_${append.status}`);
    return;
  }

  const range = encodeURIComponent(`PDA_Users!A${existing.row}:J${existing.row}`);
  const update = await sheetFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values }) },
  );
  if (!update.ok) throw new Error(`MANAGEMENT_USER_UPDATE_HTTP_${update.status}`);
}
