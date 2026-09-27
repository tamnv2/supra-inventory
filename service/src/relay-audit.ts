import { getServiceAccountAccessToken } from "./hr-source";

export interface RelayAuditEnv {
  FIREBASE_PROJECT_ID: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  EXPORTS_FOLDER_ID?: string;
}

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
  booleanValue?: boolean;
};

type FirestoreDoc = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const XLS_MIME = "application/vnd.ms-excel";
const JOB_RETENTION_DAYS = 60;
const JOB_CLEANUP_LIMIT = 1500;
const GUARD_CLEANUP_LIMIT = 800;

function fieldString(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  const value = fields?.[key];
  return String(value?.stringValue || "");
}

function fieldLong(fields: Record<string, FirestoreValue> | undefined, key: string): number {
  const value = Number(fields?.[key]?.integerValue || 0);
  return Number.isFinite(value) ? value : 0;
}

function fieldTimestamp(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  return String(fields?.[key]?.timestampValue || "");
}

function fsString(value: string): FirestoreValue {
  return { stringValue: value };
}

function fsInt(value: number): FirestoreValue {
  return { integerValue: String(Math.max(0, Math.trunc(value))) };
}

function hcmParts(now = new Date()): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function closedBusinessDayKey(now = new Date()): string {
  const p = hcmParts(now);
  const local = new Date(Date.UTC(p.year, p.month - 1, p.day));
  // Before 05:00 the current business day has not closed yet; the latest
  // completed business day therefore started two calendar days earlier.
  local.setUTCDate(local.getUTCDate() - (p.hour < 5 ? 2 : 1));
  return `${local.getUTCFullYear()}${String(local.getUTCMonth() + 1).padStart(2, "0")}${String(local.getUTCDate()).padStart(2, "0")}`;
}

function businessRangeUtc(dayKey: string): { start: string; end: string } {
  if (!/^\d{8}$/.test(dayKey)) throw new Error("INVALID_BUSINESS_DAY");
  const year = Number(dayKey.slice(0, 4));
  const month = Number(dayKey.slice(4, 6));
  const day = Number(dayKey.slice(6, 8));
  // 05:00 Asia/Ho_Chi_Minh = 22:00 UTC on the previous calendar date.
  const startMs = Date.UTC(year, month - 1, day, 5, 0, 0) - 7 * 60 * 60 * 1000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function datastoreToken(env: RelayAuditEnv): Promise<string> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  return (await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, DATASTORE_SCOPE)).accessToken;
}

function firestoreBase(env: RelayAuditEnv): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}

async function queryJobs(env: RelayAuditEnv, token: string, dayKey: string): Promise<FirestoreDoc[]> {
  const range = businessRangeUtc(dayKey);
  const response = await fetch(`${firestoreBase(env)}:runQuery`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "relay_poc_jobs" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "created_at" },
                  op: "GREATER_THAN_OR_EQUAL",
                  value: { timestampValue: range.start },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: "created_at" },
                  op: "LESS_THAN",
                  value: { timestampValue: range.end },
                },
              },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: "created_at" }, direction: "ASCENDING" }],
        limit: 5000,
      },
    }),
  });
  if (!response.ok) throw new Error(`RELAY_AUDIT_QUERY_HTTP_${response.status}`);
  const rows = (await response.json()) as Array<{ document?: FirestoreDoc }>;
  return rows
    .map((row) => row.document)
    .filter((doc): doc is FirestoreDoc => Boolean(doc?.fields))
    .filter((doc) => fieldString(doc.fields, "source") === "ANDROID_CONFIRM_V1");
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildExcelXml(dayKey: string, docs: FirestoreDoc[]): Uint8Array {
  const headers = [
    "Request ID",
    "Mã nhân viên",
    "Họ tên Picker",
    "User ID",
    "Thời gian gửi",
    "Số cuối PickList",
    "Trạng thái",
    "Kết quả",
    "Mã kết quả",
    "Agent",
    "Agent instance",
    "Quản trị Agent",
    "Thời gian hoàn tất",
    "Thời gian xử lý (ms)",
  ];
  const rows = docs.map((doc) => {
    const f = doc.fields;
    return [
      fieldString(f, "request_id"),
      fieldString(f, "picker_employee_code"),
      fieldString(f, "picker_display_name"),
      fieldString(f, "picker_user_id"),
      fieldTimestamp(f, "created_at") || fieldLong(f, "client_sent_at_ms"),
      fieldString(f, "suffix"),
      fieldString(f, "status"),
      fieldString(f, "lookup_status"),
      fieldString(f, "lookup_status"),
      fieldString(f, "agent_id"),
      fieldString(f, "agent_instance_id"),
      fieldString(f, "agent_admin_user_id"),
      fieldLong(f, "terminal_at_ms") || fieldLong(f, "agent_ack_at_ms"),
      fieldLong(f, "terminal_duration_ms") || fieldLong(f, "lookup_ms"),
    ];
  });
  const allRows = [headers, ...rows];
  const table = allRows.map((row) =>
    `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join("")}</Row>`
  ).join("");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>SUPRA PickList ${dayKey}</Title></DocumentProperties>` +
    `<Worksheet ss:Name="PickList ${dayKey}"><Table>${table}</Table></Worksheet></Workbook>`;
  return new TextEncoder().encode(xml);
}

async function driveAccessToken(env: RelayAuditEnv): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
      !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
      !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) {
    throw new Error("DRIVE_OAUTH_NOT_CONFIGURED");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(`DRIVE_OAUTH_FAILED:${payload.error || response.status}`);
  return payload.access_token;
}

async function findDriveFile(env: RelayAuditEnv, token: string, name: string): Promise<string> {
  if (!env.EXPORTS_FOLDER_ID) throw new Error("EXPORTS_FOLDER_NOT_CONFIGURED");
  const q = `'${env.EXPORTS_FOLDER_ID}' in parents and name = '${name.replaceAll("'", "\\'")}' and trashed = false`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "10");
  const response = await fetch(url.toString(), { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`DRIVE_LIST_HTTP_${response.status}`);
  const payload = await response.json() as { files?: Array<{ id?: string }> };
  return String(payload.files?.[0]?.id || "");
}

async function uploadDriveFile(
  env: RelayAuditEnv,
  token: string,
  name: string,
  bytes: Uint8Array,
  existingId: string,
): Promise<string> {
  if (existingId) {
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media&fields=id`,
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": XLS_MIME },
        body: bytes,
      },
    );
    if (!response.ok) throw new Error(`DRIVE_UPDATE_HTTP_${response.status}`);
    const payload = await response.json() as { id?: string };
    return String(payload.id || existingId);
  }

  if (!env.EXPORTS_FOLDER_ID) throw new Error("EXPORTS_FOLDER_NOT_CONFIGURED");
  const boundary = `supra-d131-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name,
    parents: [env.EXPORTS_FOLDER_ID],
    mimeType: XLS_MIME,
  });
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${XLS_MIME}\r\n\r\n`,
  );
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(prefix.length + bytes.length + suffix.length);
  body.set(prefix, 0);
  body.set(bytes, prefix.length);
  body.set(suffix, prefix.length + bytes.length);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok) throw new Error(`DRIVE_CREATE_HTTP_${response.status}`);
  const payload = await response.json() as { id?: string };
  if (!payload.id) throw new Error("DRIVE_CREATE_ID_MISSING");
  return payload.id;
}

async function readExportState(env: RelayAuditEnv, token: string, dayKey: string): Promise<FirestoreDoc | null> {
  const response = await fetch(
    `${firestoreBase(env)}/relay_poc_coordination/audit_export_${dayKey}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`AUDIT_STATE_READ_HTTP_${response.status}`);
  return await response.json() as FirestoreDoc;
}

async function writeExportState(
  env: RelayAuditEnv,
  token: string,
  dayKey: string,
  input: {
    status: string;
    fileId?: string;
    fileName?: string;
    rowCount?: number;
    errorCode?: string;
    durationMs?: number;
    deletedJobs?: number;
    deletedGuards?: number;
  },
): Promise<void> {
  const fields: Record<string, FirestoreValue> = {
    schema_version: fsInt(2),
    business_day: fsString(dayKey),
    status: fsString(input.status),
    file_id: fsString(input.fileId || ""),
    file_name: fsString(input.fileName || ""),
    row_count: fsInt(input.rowCount || 0),
    error_code: fsString(input.errorCode || ""),
    duration_ms: fsInt(input.durationMs || 0),
    deleted_jobs: fsInt(input.deletedJobs || 0),
    deleted_guards: fsInt(input.deletedGuards || 0),
    updated_at_ms: fsInt(Date.now()),
  };
  const mask = Object.keys(fields).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
  const response = await fetch(
    `${firestoreBase(env)}/relay_poc_coordination/audit_export_${dayKey}?${mask}`,
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ fields }),
    },
  );
  if (!response.ok) throw new Error(`AUDIT_STATE_WRITE_HTTP_${response.status}`);
}

async function queryDocumentNames(
  env: RelayAuditEnv,
  token: string,
  collection: string,
  fieldPath: string,
  op: "LESS_THAN" | "LESS_THAN_OR_EQUAL",
  value: FirestoreValue,
  limit: number,
): Promise<string[]> {
  const response = await fetch(`${firestoreBase(env)}:runQuery`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath }, op, value } },
        limit,
      },
    }),
  });
  if (!response.ok) throw new Error(`CLEANUP_QUERY_${collection}_HTTP_${response.status}`);
  const rows = await response.json() as Array<{ document?: FirestoreDoc }>;
  return rows.map((row) => String(row.document?.name || "")).filter(Boolean).slice(0, limit);
}

async function batchDelete(env: RelayAuditEnv, token: string, names: string[]): Promise<number> {
  let deleted = 0;
  for (let start = 0; start < names.length; start += 500) {
    const chunk = names.slice(start, start + 500);
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:batchWrite`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ writes: chunk.map((name) => ({ delete: name })) }),
      },
    );
    if (!response.ok) throw new Error(`CLEANUP_DELETE_HTTP_${response.status}`);
    deleted += chunk.length;
  }
  return deleted;
}

async function boundedCleanup(env: RelayAuditEnv, token: string): Promise<{ jobs: number; guards: number }> {
  const cutoff = new Date(Date.now() - JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const jobNames = await queryDocumentNames(
    env, token, "relay_poc_jobs", "created_at", "LESS_THAN", { timestampValue: cutoff }, JOB_CLEANUP_LIMIT,
  );
  const guardNames = await queryDocumentNames(
    env, token, "relay_poc_confirm_guards", "retire_at_ms", "LESS_THAN_OR_EQUAL",
    { integerValue: String(Date.now()) }, GUARD_CLEANUP_LIMIT,
  );
  return {
    jobs: await batchDelete(env, token, jobNames),
    guards: await batchDelete(env, token, guardNames),
  };
}

export async function runRelayAuditExport(env: RelayAuditEnv, dayKey = closedBusinessDayKey()): Promise<{
  status: string;
  business_day: string;
  rows: number;
  file_id: string;
}> {
  const started = Date.now();
  const firestoreToken = await datastoreToken(env);
  const state = await readExportState(env, firestoreToken, dayKey);
  const stateFields = state?.fields;
  if (fieldString(stateFields, "status") === "PASS" && fieldString(stateFields, "file_id")) {
    return {
      status: "PASS",
      business_day: dayKey,
      rows: fieldLong(stateFields, "row_count"),
      file_id: fieldString(stateFields, "file_id"),
    };
  }

  const fileName = `SUPRA_PickList_${dayKey}.xls`;
  try {
    const jobs = await queryJobs(env, firestoreToken, dayKey);
    const bytes = buildExcelXml(dayKey, jobs);
    const driveToken = await driveAccessToken(env);
    let fileId = fieldString(stateFields, "file_id");
    if (!fileId) fileId = await findDriveFile(env, driveToken, fileName);
    fileId = await uploadDriveFile(env, driveToken, fileName, bytes, fileId);
    const cleanup = await boundedCleanup(env, firestoreToken);
    await writeExportState(env, firestoreToken, dayKey, {
      status: "PASS",
      fileId,
      fileName,
      rowCount: jobs.length,
      durationMs: Date.now() - started,
      deletedJobs: cleanup.jobs,
      deletedGuards: cleanup.guards,
    });
    return { status: "PASS", business_day: dayKey, rows: jobs.length, file_id: fileId };
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN";
    try {
      await writeExportState(env, firestoreToken, dayKey, {
        status: "FAILED",
        fileId: fieldString(stateFields, "file_id"),
        fileName,
        errorCode: code,
        durationMs: Date.now() - started,
      });
    } catch { }
    throw error;
  }
}

export async function maybeRunRelayAuditExport(env: RelayAuditEnv, now = new Date()): Promise<void> {
  const p = hcmParts(now);
  if (p.hour !== 5 || p.minute < 10 || p.minute > 55) return;
  await runRelayAuditExport(env);
}

export { closedBusinessDayKey };
