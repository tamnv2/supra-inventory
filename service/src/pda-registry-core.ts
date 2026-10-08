export interface PdaRegistryRecord {
  device_key: string;
  primary_identifier: string;
  identifier_source: string;
  serial_raw: string;
  serial_normalized: string;
  imei1: string;
  android_id: string;
  manufacturer: string;
  brand: string;
  model: string;
  device: string;
  product: string;
  board: string;
  hardware: string;
  android_version: string;
  sdk: number;
  security_patch: string;
  build_fingerprint: string;
  screen_resolution: string;
  total_ram_mb: number;
  total_storage_mb: number;
  launcher_version: string;
  launcher_version_code: number;
  registry_schema_version: number;
  payload_hash: string;
  first_registered_at: string;
  last_changed_at: string;
  last_validated_at: string;
}

interface ConfigRow extends Record<string, SqlStorageValue> {
  key: string;
  value_json: string;
  updated_at: string;
}

const PREFIX = "pda_registry:";
const DEVICE_KEY_RE = /^[a-f0-9]{64}$/;

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function parseRecord(value: string): PdaRegistryRecord | null {
  try {
    const record = JSON.parse(value) as PdaRegistryRecord;
    return DEVICE_KEY_RE.test(String(record.device_key || "")) ? record : null;
  } catch {
    return null;
  }
}

export async function handlePdaRegistryCoreRequest(
  state: DurableObjectState,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);

  // Stored in the same Durable Object as the PDA registry; the public endpoint
  // is read-only. Only the authenticated Worker admin route can write policies.
  if (request.method === "GET" && url.pathname === "/launcher-update/policies") {
    const row = state.storage.sql.exec<ConfigRow>(
      "SELECT key, value_json, updated_at FROM app_config WHERE key = ? LIMIT 1",
      "launcher_update:policies",
    ).toArray()[0];
    return response(row ? JSON.parse(String(row.value_json)) : { revision: 0, rules: [] });
  }

  if (request.method === "PUT" && url.pathname === "/launcher-update/policies") {
    const body = await request.json() as Record<string, unknown>;
    const currentRow = state.storage.sql.exec<ConfigRow>(
      "SELECT key, value_json, updated_at FROM app_config WHERE key = ? LIMIT 1",
      "launcher_update:policies",
    ).toArray()[0];
    const previous = currentRow ? JSON.parse(String(currentRow.value_json)) as {revision?:number} : {};
    if (body.expected_revision !== (previous.revision || 0)) return response({ error: "UPDATE_POLICY_REVISION_CONFLICT" }, 409);
    const next = {
      revision: (previous.revision || 0) + 1,
      rules: body.rules,
      updated_by: String(body.updated_by || "root").slice(0, 80),
      updated_at: new Date().toISOString(),
    };
    state.storage.sql.exec(
      `INSERT INTO app_config (key, value_json, updated_at, updated_by)
       VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET
         value_json=excluded.value_json, updated_at=excluded.updated_at,
         updated_by=excluded.updated_by`,
      "launcher_update:policies", JSON.stringify(next), next.updated_at, next.updated_by,
    );
    return response(next);
  }

  if (request.method === "GET" && url.pathname === "/pda-registry/status") {
    const deviceKey = String(url.searchParams.get("device_key") || "").trim().toLowerCase();
    if (!DEVICE_KEY_RE.test(deviceKey)) return response({ error: "invalid_device_key" }, 400);
    const row = state.storage.sql.exec<ConfigRow>(
      "SELECT key, value_json, updated_at FROM app_config WHERE key = ? LIMIT 1",
      PREFIX + deviceKey,
    ).toArray()[0];
    const record = row ? parseRecord(String(row.value_json || "")) : null;
    return response({ registered: Boolean(record), record });
  }

  if (request.method === "GET" && url.pathname === "/pda-registry/all") {
    const rows = state.storage.sql.exec<ConfigRow>(
      "SELECT key, value_json, updated_at FROM app_config WHERE key LIKE 'pda_registry:%' ORDER BY key LIMIT 5000",
    ).toArray();
    const records = rows
      .map((row) => parseRecord(String(row.value_json || "")))
      .filter((record): record is PdaRegistryRecord => Boolean(record));
    return response({ records });
  }

  if (request.method === "PUT" && url.pathname === "/pda-registry/upsert") {
    let body: { record?: PdaRegistryRecord } = {};
    try {
      body = (await request.json()) as { record?: PdaRegistryRecord };
    } catch {
      return response({ error: "invalid_json" }, 400);
    }
    const incoming = body.record;
    const deviceKey = String(incoming?.device_key || "").trim().toLowerCase();
    if (!incoming || !DEVICE_KEY_RE.test(deviceKey)) return response({ error: "invalid_device_key" }, 400);

    const key = PREFIX + deviceKey;
    const currentRow = state.storage.sql.exec<ConfigRow>(
      "SELECT key, value_json, updated_at FROM app_config WHERE key = ? LIMIT 1",
      key,
    ).toArray()[0];
    let current = currentRow ? parseRecord(String(currentRow.value_json || "")) : null;
    let rekeyedFromDeviceKey = "";

    // A corrected hardware identifier may legitimately change DeviceKey.
    // Reuse the existing Registry record when the immutable device evidence still matches,
    // instead of creating a duplicate PDA row.
    if (!current && (
      String(incoming.imei1 || "").trim()
      || String(incoming.android_id || "").trim()
      || String(incoming.serial_normalized || "").trim()
    )) {
      const candidates = state.storage.sql.exec<ConfigRow>(
        "SELECT key, value_json, updated_at FROM app_config WHERE key LIKE 'pda_registry:%' ORDER BY key LIMIT 5000",
      ).toArray();
      const incomingImei = String(incoming.imei1 || "").trim();
      const incomingAndroidId = String(incoming.android_id || "").trim();
      const incomingSerial = String(incoming.serial_normalized || "").trim();
      const incomingModel = String(incoming.model || "").trim().toLowerCase();
      for (const candidateRow of candidates) {
        const candidate = parseRecord(String(candidateRow.value_json || ""));
        if (!candidate || candidate.device_key === deviceKey) continue;
        const sameImei = Boolean(incomingImei) && incomingImei === String(candidate.imei1 || "").trim();
        const sameAndroidDevice = Boolean(incomingAndroidId)
          && incomingAndroidId === String(candidate.android_id || "").trim()
          && incomingModel === String(candidate.model || "").trim().toLowerCase();
        const sameSerialDevice = Boolean(incomingSerial)
          && incomingSerial === String(candidate.serial_normalized || "").trim()
          && incomingModel === String(candidate.model || "").trim().toLowerCase();
        if (sameImei || sameAndroidDevice || sameSerialDevice) {
          current = candidate;
          rekeyedFromDeviceKey = candidate.device_key;
          break;
        }
      }
    }

    if (current && current.payload_hash === incoming.payload_hash && !rekeyedFromDeviceKey) {
      return response({ status: "unchanged", created: false, changed: false, record: current });
    }

    const now = new Date().toISOString();
    const next: PdaRegistryRecord = {
      ...incoming,
      device_key: deviceKey,
      first_registered_at: current?.first_registered_at || incoming.first_registered_at || now,
      last_changed_at: now,
      last_validated_at: now,
    };
    state.storage.sql.exec(
      `INSERT INTO app_config (key, value_json, updated_at, updated_by)
       VALUES (?, ?, ?, 'system:pda-registry')
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
      key,
      JSON.stringify(next),
      now,
    );
    if (rekeyedFromDeviceKey) {
      state.storage.sql.exec(
        "DELETE FROM app_config WHERE key = ?",
        PREFIX + rekeyedFromDeviceKey,
      );
    }
    return response({
      status: current ? "updated" : "created",
      created: !current,
      changed: true,
      old_hash: current?.payload_hash || "",
      rekeyed_from_device_key: rekeyedFromDeviceKey,
      record: next,
    });
  }

  return null;
}
