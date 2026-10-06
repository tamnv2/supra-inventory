import { getServiceAccountAccessToken } from "./hr-source";
import type { PdaRegistryRecord } from "./pda-registry-core";

interface PdaRegistryEnv {
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  PDA_REGISTRY_SHEET_ID?: string;
}

type PdaInput = Record<string, unknown>;

const CORE_NAME = "inventory-core";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEVICE_KEY_RE = /^[a-f0-9]{64}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const SCHEMA_VERSION = 1;
let tokenCache: { token: string; expiresAt: number } | null = null;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(value: unknown, max = 160): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeIdentifier(value: unknown): string {
  return text(value, 96).normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}

function safeSource(value: unknown): string {
  const source = text(value, 40).toUpperCase().replace(/[^A-Z0-9_:-]/g, "_");
  return source.slice(0, 40);
}

function integer(value: unknown, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(min, Math.min(max, parsed));
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function core(env: PdaRegistryEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_NAME));
}

async function coreJson<T>(env: PdaRegistryEnv, path: string, init?: RequestInit): Promise<T> {
  const response = await core(env).fetch(`https://inventory-core.internal${path}`, init);
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(`PDA_REGISTRY_CORE_HTTP_${response.status}`);
  return payload;
}

async function sheetsToken(env: PdaRegistryEnv): Promise<string> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("PDA_REGISTRY_GOOGLE_RUNTIME_SA_MISSING");
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const result = await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, SHEETS_SCOPE);
  tokenCache = { token: result.accessToken, expiresAt: Date.now() + 50 * 60_000 };
  return result.accessToken;
}

function sheetId(env: PdaRegistryEnv): string {
  const id = String(env.PDA_REGISTRY_SHEET_ID || "").trim();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error("PDA_REGISTRY_SHEET_NOT_CONFIGURED");
  return id;
}

async function sheetRequest(
  env: PdaRegistryEnv,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const bearer = await sheetsToken(env);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${bearer}`);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return fetch(url, { ...init, headers });
}

type SheetIndexEntry = { row: number; payloadHash: string };

async function readSheetIndex(env: PdaRegistryEnv): Promise<Map<string, SheetIndexEntry>> {
  const id = sheetId(env);
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet`);
  url.searchParams.append("ranges", "PDA_Devices!A2:A2000");
  url.searchParams.append("ranges", "PDA_Devices!Y2:Y2000");
  url.searchParams.set("majorDimension", "ROWS");
  const response = await sheetRequest(env, url.toString());
  if (!response.ok) throw new Error(`PDA_REGISTRY_SHEET_INDEX_HTTP_${response.status}`);
  const payload = (await response.json()) as {
    valueRanges?: Array<{ values?: unknown[][] }>;
  };
  const keyRows = payload.valueRanges?.[0]?.values || [];
  const hashRows = payload.valueRanges?.[1]?.values || [];
  const result = new Map<string, SheetIndexEntry>();
  for (let index = 0; index < keyRows.length; index += 1) {
    const key = String(keyRows[index]?.[0] || "").trim().toLowerCase();
    if (!DEVICE_KEY_RE.test(key)) continue;
    result.set(key, {
      row: index + 2,
      payloadHash: String(hashRows[index]?.[0] || "").trim().toLowerCase(),
    });
  }
  return result;
}

function rowFor(record: PdaRegistryRecord, includeHumanColumns: boolean): unknown[] {
  const values: unknown[] = [
    record.device_key,
    record.primary_identifier,
    record.identifier_source,
    record.serial_raw,
    record.serial_normalized,
    record.imei1,
    record.android_id,
    record.manufacturer,
    record.brand,
    record.model,
    record.device,
    record.product,
    record.board,
    record.hardware,
    record.android_version,
    record.sdk,
    record.security_patch,
    record.build_fingerprint,
    record.screen_resolution,
    record.total_ram_mb,
    record.total_storage_mb,
    record.launcher_version,
    record.launcher_version_code,
    record.registry_schema_version,
    record.payload_hash,
    record.first_registered_at,
    record.last_changed_at,
    record.last_validated_at,
  ];
  if (includeHumanColumns) values.push("ACTIVE", "");
  return values;
}

async function putValues(env: PdaRegistryEnv, range: string, values: unknown[][]): Promise<void> {
  const id = sheetId(env);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`,
  );
  url.searchParams.set("valueInputOption", "RAW");
  const response = await sheetRequest(env, url.toString(), {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  if (!response.ok) throw new Error(`PDA_REGISTRY_SHEET_UPDATE_HTTP_${response.status}`);
}

async function appendValues(env: PdaRegistryEnv, range: string, values: unknown[][]): Promise<void> {
  if (!values.length) return;
  const id = sheetId(env);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}:append`,
  );
  url.searchParams.set("valueInputOption", "RAW");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");
  const response = await sheetRequest(env, url.toString(), {
    method: "POST",
    body: JSON.stringify({ majorDimension: "ROWS", values }),
  });
  if (!response.ok) throw new Error(`PDA_REGISTRY_SHEET_APPEND_HTTP_${response.status}`);
}

async function appendAudit(
  env: PdaRegistryEnv,
  rows: unknown[][],
): Promise<void> {
  try {
    await appendValues(env, "Registry_Audit!A:H", rows);
  } catch (error) {
    console.error("pda_registry_audit_append_failed", error instanceof Error ? error.message : "unknown");
  }
}

async function syncRecordToSheet(
  env: PdaRegistryEnv,
  record: PdaRegistryRecord,
  action: "CREATED" | "UPDATED",
  oldHash: string,
): Promise<{ synced: boolean; action: string }> {
  const index = await readSheetIndex(env);
  const existing = index.get(record.device_key);
  if (existing && existing.payloadHash === record.payload_hash) {
    return { synced: true, action: "UNCHANGED" };
  }
  if (existing) {
    await putValues(env, `PDA_Devices!A${existing.row}:AB${existing.row}`, [rowFor(record, false)]);
  } else {
    await appendValues(env, "PDA_Devices!A:AD", [rowFor(record, true)]);
  }
  await appendAudit(env, [[
    new Date().toISOString(),
    record.device_key,
    action,
    oldHash,
    record.payload_hash,
    "LAUNCHER",
    "PASS",
    existing ? `Updated row ${existing.row}` : "Appended new device",
  ]]);
  return { synced: true, action: existing ? "UPDATED" : "APPENDED" };
}

async function normalizeRegistration(body: PdaInput): Promise<PdaRegistryRecord> {
  const identifierSource = safeSource(body.identifier_source);
  const primaryIdentifier = text(body.primary_identifier, 96);
  const normalizedPrimary = normalizeIdentifier(primaryIdentifier);
  if (!identifierSource || normalizedPrimary.length < 4) throw new Error("INVALID_PRIMARY_IDENTIFIER");

  const expectedDeviceKey = await sha256Hex(`${identifierSource}|${normalizedPrimary}`);
  const suppliedDeviceKey = text(body.device_key, 64).toLowerCase();
  if (!DEVICE_KEY_RE.test(suppliedDeviceKey) || suppliedDeviceKey !== expectedDeviceKey) {
    throw new Error("DEVICE_KEY_MISMATCH");
  }

  const suppliedHash = text(body.payload_hash, 64).toLowerCase();
  const now = new Date().toISOString();
  const serialRaw = text(body.serial_raw, 96);
  const serialNormalized = serialRaw ? normalizeIdentifier(serialRaw) : normalizeIdentifier(body.serial_normalized);
  const imeiCandidate = text(body.imei1, 24).replace(/\D/g, "");
  const androidId = text(body.android_id, 96);

  const record: PdaRegistryRecord = {
    device_key: expectedDeviceKey,
    primary_identifier: primaryIdentifier,
    identifier_source: identifierSource,
    serial_raw: serialRaw,
    serial_normalized: serialNormalized,
    imei1: imeiCandidate.length >= 8 ? imeiCandidate : "",
    android_id: androidId,
    manufacturer: text(body.manufacturer, 80),
    brand: text(body.brand, 80),
    model: text(body.model, 100),
    device: text(body.device, 100),
    product: text(body.product, 100),
    board: text(body.board, 100),
    hardware: text(body.hardware, 100),
    android_version: text(body.android_version, 40),
    sdk: integer(body.sdk, 0, 100),
    security_patch: text(body.security_patch, 40),
    build_fingerprint: text(body.build_fingerprint, 300),
    screen_resolution: text(body.screen_resolution, 40),
    total_ram_mb: integer(body.total_ram_mb, 0, 1_000_000),
    total_storage_mb: integer(body.total_storage_mb, 0, 10_000_000),
    launcher_version: text(body.launcher_version, 40),
    launcher_version_code: integer(body.launcher_version_code, 0, 10_000_000),
    registry_schema_version: SCHEMA_VERSION,
    payload_hash: HASH_RE.test(suppliedHash)
      ? suppliedHash
      : await sha256Hex(JSON.stringify(body).slice(0, 12_000)),
    first_registered_at: now,
    last_changed_at: now,
    last_validated_at: now,
  };
  return record;
}

export async function handlePdaRegistryApi(
  request: Request,
  env: PdaRegistryEnv,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/pda/registry/status") {
    const deviceKey = String(url.searchParams.get("device_key") || "").trim().toLowerCase();
    if (!DEVICE_KEY_RE.test(deviceKey)) return json({ error: "INVALID_DEVICE_KEY" }, 400);
    const result = await coreJson<{ registered: boolean }>(
      env,
      `/pda-registry/status?device_key=${encodeURIComponent(deviceKey)}`,
    );
    return json({
      registered: result.registered === true,
      need_payload: result.registered !== true,
      registry_schema_version: SCHEMA_VERSION,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/pda/registry/register") {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_384) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);

    let body: PdaInput;
    try {
      body = (await request.json()) as PdaInput;
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    let record: PdaRegistryRecord;
    try {
      record = await normalizeRegistration(body);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "INVALID_DEVICE_PAYLOAD" }, 400);
    }

    const result = await coreJson<{
      status: "created" | "updated" | "unchanged";
      created: boolean;
      changed: boolean;
      old_hash?: string;
      record: PdaRegistryRecord;
    }>(env, "/pda-registry/upsert", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ record }),
    });

    let sheetSynced = result.status === "unchanged";
    let sheetAction = result.status === "unchanged" ? "UNCHANGED" : "PENDING";
    let sheetError = "";
    if (result.changed) {
      try {
        const sync = await syncRecordToSheet(
          env,
          result.record,
          result.created ? "CREATED" : "UPDATED",
          String(result.old_hash || ""),
        );
        sheetSynced = sync.synced;
        sheetAction = sync.action;
      } catch (error) {
        sheetError = error instanceof Error ? error.message : "sheet_sync_failed";
        console.error("pda_registry_sheet_sync_failed", sheetError);
      }
    }

    return json({
      registered: true,
      status: result.status,
      device_key: result.record.device_key,
      payload_hash: result.record.payload_hash,
      registry_schema_version: SCHEMA_VERSION,
      sheet_synced: sheetSynced,
      sheet_action: sheetAction,
      ...(sheetError ? { sheet_retry: "SERVER_RECONCILE" } : {}),
    });
  }

  return null;
}

export async function reconcilePdaRegistrySheet(env: PdaRegistryEnv): Promise<void> {
  if (!env.PDA_REGISTRY_SHEET_ID || !env.GOOGLE_RUNTIME_SA_JSON) return;
  const result = await coreJson<{ records?: PdaRegistryRecord[] }>(env, "/pda-registry/all");
  const records = (result.records || []).slice(0, 5000);
  if (!records.length) return;

  const index = await readSheetIndex(env);
  const missing: PdaRegistryRecord[] = [];
  const changed: Array<{ record: PdaRegistryRecord; row: number; oldHash: string }> = [];
  for (const record of records) {
    const current = index.get(record.device_key);
    if (!current) {
      missing.push(record);
    } else if (current.payloadHash !== record.payload_hash) {
      changed.push({ record, row: current.row, oldHash: current.payloadHash });
    }
  }

  if (changed.length) {
    const id = sheetId(env);
    const response = await sheetRequest(
      env,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: changed.map((item) => ({
            range: `PDA_Devices!A${item.row}:AB${item.row}`,
            majorDimension: "ROWS",
            values: [rowFor(item.record, false)],
          })),
        }),
      },
    );
    if (!response.ok) throw new Error(`PDA_REGISTRY_RECONCILE_UPDATE_HTTP_${response.status}`);
  }

  if (missing.length) {
    await appendValues(env, "PDA_Devices!A:AD", missing.map((record) => rowFor(record, true)));
  }

  const auditRows: unknown[][] = [
    ...changed.map((item) => [
      new Date().toISOString(), item.record.device_key, "RECONCILED_UPDATE",
      item.oldHash, item.record.payload_hash, "SERVER_RECONCILE", "PASS", `Restored row ${item.row}`,
    ]),
    ...missing.map((record) => [
      new Date().toISOString(), record.device_key, "RECONCILED_MISSING",
      "", record.payload_hash, "SERVER_RECONCILE", "PASS", "Restored missing Sheet row",
    ]),
  ];
  if (auditRows.length) await appendAudit(env, auditRows);
}
