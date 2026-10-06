interface ConfigRow extends Record<string, SqlStorageValue> {
  key: string;
  value_json: string;
  updated_at: string;
}

interface LauncherPasswordState {
  operational_date: string;
  code: string;
  revision: number;
  generated_at: string;
  generated_reason: "DAILY" | "RESET";
  valid_from: string;
  valid_until: string;
  reset_available_at: string;
  email_sent_at: string;
}

interface AttemptState {
  failures: number;
  blocked_until: string;
  updated_at: string;
}

const STATE_KEY = "launcher_password:state";
const ATTEMPT_PREFIX = "launcher_password:attempt:";
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAILY_START_HOUR = 5;
const RESET_COOLDOWN_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const ATTEMPT_BLOCK_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const DEVICE_KEY_RE = /^[a-f0-9]{64}$/;
const CODE_RE = /^\d{4}$/;

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

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function operationalDateFor(ms: number): string {
  const shifted = new Date(ms + VN_OFFSET_MS - DAILY_START_HOUR * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function parseOperationalDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("invalid_operational_date");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function cutoffMs(operationalDate: string, dayOffset: number): number {
  const parts = parseOperationalDate(operationalDate);
  return Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, DAILY_START_HOUR, 0, 0) - VN_OFFSET_MS;
}

function vnText(ms: number): string {
  const local = new Date(ms + VN_OFFSET_MS);
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())} ${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
}

function randomFourDigits(): string {
  const bucket = 10_000;
  const range = 0x1_0000_0000;
  const limit = range - (range % bucket);
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return String(values[0] % bucket).padStart(4, "0");
}

function readJson<T>(state: DurableObjectState, key: string): T | null {
  const row = state.storage.sql.exec<ConfigRow>(
    "SELECT key, value_json, updated_at FROM app_config WHERE key = ? LIMIT 1",
    key,
  ).toArray()[0];
  if (!row) return null;
  try { return JSON.parse(String(row.value_json || "")) as T; }
  catch { return null; }
}

function writeJson(state: DurableObjectState, key: string, value: unknown, updatedBy: string): void {
  const now = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO app_config (key, value_json, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
    key,
    JSON.stringify(value),
    now,
    updatedBy,
  );
}

function deleteKey(state: DurableObjectState, key: string): void {
  state.storage.sql.exec("DELETE FROM app_config WHERE key = ?", key);
}

// Device registration is verified by the public Worker against the authoritative
// "inventory-core" Durable Object before reaching this password-only instance.
// Keeping password state in its original "singleton" instance preserves existing
// emailed codes, daily validity and the global 15-minute reset cooldown.

function currentState(state: DurableObjectState): LauncherPasswordState | null {
  const value = readJson<LauncherPasswordState>(state, STATE_KEY);
  if (!value || !CODE_RE.test(String(value.code || ""))) return null;
  return value;
}

function ensureState(state: DurableObjectState, nowMs: number): { state: LauncherPasswordState; created: boolean } {
  const operationalDate = operationalDateFor(nowMs);
  const existing = currentState(state);
  if (existing && existing.operational_date === operationalDate) {
    return { state: existing, created: false };
  }

  const next: LauncherPasswordState = {
    operational_date: operationalDate,
    code: randomFourDigits(),
    revision: Math.max(0, Number(existing?.revision || 0)) + 1,
    generated_at: iso(nowMs),
    generated_reason: "DAILY",
    valid_from: iso(cutoffMs(operationalDate, 0)),
    valid_until: iso(cutoffMs(operationalDate, 1)),
    reset_available_at: iso(Math.max(nowMs, Date.parse(existing?.reset_available_at || "") || 0)),
    email_sent_at: "",
  };
  writeJson(state, STATE_KEY, next, "system:launcher-password-daily");
  return { state: next, created: true };
}

function safeState(value: LauncherPasswordState, nowMs: number): Record<string, unknown> {
  const resetAvailableMs = Date.parse(value.reset_available_at || "") || 0;
  return {
    operational_date: value.operational_date,
    revision: value.revision,
    generated_at: value.generated_at,
    generated_reason: value.generated_reason,
    valid_from: value.valid_from,
    valid_until: value.valid_until,
    valid_from_vn: vnText(Date.parse(value.valid_from)),
    valid_until_vn: vnText(Date.parse(value.valid_until)),
    reset_available_at: value.reset_available_at,
    reset_cooldown_seconds: Math.max(0, Math.ceil((resetAvailableMs - nowMs) / 1000)),
    email_sent: Boolean(value.email_sent_at),
    email_sent_at: value.email_sent_at,
    server_time: iso(nowMs),
    server_time_vn: vnText(nowMs),
    timezone: "Asia/Ho_Chi_Minh",
    daily_change_hour: "05:00",
  };
}

function attemptKey(deviceKey: string): string {
  return ATTEMPT_PREFIX + deviceKey;
}

function readAttempt(state: DurableObjectState, deviceKey: string): AttemptState | null {
  return readJson<AttemptState>(state, attemptKey(deviceKey));
}

function failedAttempt(state: DurableObjectState, deviceKey: string, nowMs: number): AttemptState {
  const prior = readAttempt(state, deviceKey);
  const priorUpdated = Date.parse(prior?.updated_at || "") || 0;
  const withinWindow = prior && nowMs - priorUpdated <= ATTEMPT_WINDOW_MS;
  const failures = (withinWindow ? Number(prior?.failures || 0) : 0) + 1;
  const blockedUntil = failures >= MAX_FAILURES ? nowMs + ATTEMPT_BLOCK_MS : 0;
  const next: AttemptState = {
    failures: blockedUntil ? 0 : failures,
    blocked_until: blockedUntil ? iso(blockedUntil) : "",
    updated_at: iso(nowMs),
  };
  writeJson(state, attemptKey(deviceKey), next, "system:launcher-password-security");
  return next;
}

export async function handleLauncherPasswordCoreRequest(
  state: DurableObjectState,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  const nowMs = Date.now();

  if (request.method === "POST" && url.pathname === "/launcher-password/ensure") {
    const ensured = ensureState(state, nowMs);
    return response({
      ...safeState(ensured.state, nowMs),
      created: ensured.created,
      email_required: !ensured.state.email_sent_at,
      ...(ensured.state.email_sent_at ? {} : { code: ensured.state.code }),
    });
  }

  if (request.method === "POST" && url.pathname === "/launcher-password/mark-email-sent") {
    let body: { revision?: number } = {};
    try { body = (await request.json()) as { revision?: number }; }
    catch { return response({ error: "invalid_json" }, 400); }

    const current = currentState(state);
    if (!current) return response({ error: "launcher_password_missing" }, 409);
    if (Number(body.revision || 0) !== current.revision) {
      return response({ error: "stale_revision", current_revision: current.revision }, 409);
    }
    current.email_sent_at = iso(nowMs);
    writeJson(state, STATE_KEY, current, "system:launcher-password-mail");
    return response({ status: "marked", revision: current.revision, email_sent_at: current.email_sent_at });
  }

  if (request.method === "GET" && url.pathname === "/launcher-password/status") {
    const ensured = ensureState(state, nowMs);
    return response(safeState(ensured.state, nowMs));
  }

  if (request.method === "POST" && url.pathname === "/launcher-password/verify") {
    let body: { device_key?: string; code?: string } = {};
    try { body = (await request.json()) as { device_key?: string; code?: string }; }
    catch { return response({ error: "invalid_json" }, 400); }

    const deviceKey = String(body.device_key || "").trim().toLowerCase();
    const candidate = String(body.code || "").trim();
    if (!DEVICE_KEY_RE.test(deviceKey)) return response({ error: "invalid_device_key" }, 400);
    if (!CODE_RE.test(candidate)) return response({ error: "invalid_code_format" }, 400);

    const priorAttempt = readAttempt(state, deviceKey);
    const blockedUntilMs = Date.parse(priorAttempt?.blocked_until || "") || 0;
    if (blockedUntilMs > nowMs) {
      return response({
        error: "too_many_attempts",
        retry_after_seconds: Math.max(1, Math.ceil((blockedUntilMs - nowMs) / 1000)),
      }, 429);
    }

    const ensured = ensureState(state, nowMs);
    const valid = candidate === ensured.state.code;
    if (valid) {
      deleteKey(state, attemptKey(deviceKey));
      return response({ valid: true, ...safeState(ensured.state, nowMs) });
    }

    const attempt = failedAttempt(state, deviceKey, nowMs);
    const nextBlockedMs = Date.parse(attempt.blocked_until || "") || 0;
    return response({
      valid: false,
      retry_after_seconds: nextBlockedMs > nowMs
        ? Math.max(1, Math.ceil((nextBlockedMs - nowMs) / 1000))
        : 0,
    }, nextBlockedMs > nowMs ? 429 : 200);
  }

  if (request.method === "POST" && url.pathname === "/launcher-password/reset") {
    let body: { device_key?: string } = {};
    try { body = (await request.json()) as { device_key?: string }; }
    catch { return response({ error: "invalid_json" }, 400); }

    const deviceKey = String(body.device_key || "").trim().toLowerCase();
    if (!DEVICE_KEY_RE.test(deviceKey)) return response({ error: "invalid_device_key" }, 400);

    const ensured = ensureState(state, nowMs);
    const resetAvailableMs = Date.parse(ensured.state.reset_available_at || "") || 0;
    if (resetAvailableMs > nowMs) {
      return response({
        error: "reset_cooldown",
        ...safeState(ensured.state, nowMs),
      }, 429);
    }

    const next: LauncherPasswordState = {
      ...ensured.state,
      code: randomFourDigits(),
      revision: ensured.state.revision + 1,
      generated_at: iso(nowMs),
      generated_reason: "RESET",
      reset_available_at: iso(nowMs + RESET_COOLDOWN_MS),
      email_sent_at: "",
    };
    writeJson(state, STATE_KEY, next, "system:launcher-password-reset");
    return response({
      ...safeState(next, nowMs),
      email_required: true,
      code: next.code,
    });
  }

  return null;
}
