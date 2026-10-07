interface ConfigRow extends Record<string, SqlStorageValue> {
  key: string;
  value_json: string;
}

interface PrivilegedOtpState {
  revision: number;
  code_hash: string;
  issued_at: string;
  expires_at: string;
  failures: number;
  blocked_until: string;
}

const KEY_PREFIX = "privileged_auth:otp:";
const ISSUE_COOLDOWN_MS = 30 * 1000;
const MAX_FAILURES = 5;
const ATTEMPT_BLOCK_MS = 5 * 60 * 1000;
const HASH_RE = /^[a-f0-9]{64}$/;

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

function keyFor(userId: string): string {
  return KEY_PREFIX + userId;
}

function readState(state: DurableObjectState, userId: string): PrivilegedOtpState | null {
  const row = state.storage.sql.exec<ConfigRow>(
    "SELECT key, value_json FROM app_config WHERE key = ? LIMIT 1",
    keyFor(userId),
  ).toArray()[0];
  if (!row) return null;
  try {
    const parsed = JSON.parse(String(row.value_json || "")) as PrivilegedOtpState;
    return parsed && HASH_RE.test(String(parsed.code_hash || "")) ? parsed : null;
  } catch {
    return null;
  }
}

function writeState(state: DurableObjectState, userId: string, value: PrivilegedOtpState): void {
  const now = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO app_config (key, value_json, updated_at, updated_by)
     VALUES (?, ?, ?, 'system:d165-privileged-auth')
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
    keyFor(userId),
    JSON.stringify(value),
    now,
  );
}

function deleteState(state: DurableObjectState, userId: string): void {
  state.storage.sql.exec("DELETE FROM app_config WHERE key = ?", keyFor(userId));
}

function safeEqualHex(left: string, right: string): boolean {
  if (!HASH_RE.test(left) || !HASH_RE.test(right)) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function handlePrivilegedAuthCoreRequest(
  state: DurableObjectState,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  const nowMs = Date.now();

  if (request.method === "POST" && url.pathname === "/privileged-auth/issue") {
    let body: { user_id?: string; code_hash?: string; bypass_cooldown?: boolean } = {};
    try { body = (await request.json()) as typeof body; }
    catch { return response({ error: "invalid_json" }, 400); }

    const userId = String(body.user_id || "").trim();
    const codeHash = String(body.code_hash || "").trim().toLowerCase();
    if (!userId || userId.length > 200 || !HASH_RE.test(codeHash)) {
      return response({ error: "invalid_input" }, 400);
    }

    const previous = readState(state, userId);
    if (previous && !previous.expires_at) {
      // Issued durable OTP remains the ONLY valid code until consumed.
      // Public pre-login issuance and automatic send paths must not replace it,
      // even with bypass_cooldown. This also prevents reset/mail spam.
      return response({ error: "code_pending_until_consumed" }, 409);
    }
    const previousIssuedMs = Date.parse(previous?.issued_at || "") || 0;
    if (!body.bypass_cooldown && previousIssuedMs && nowMs - previousIssuedMs < ISSUE_COOLDOWN_MS) {
      return response({
        error: "issue_cooldown",
        retry_after_seconds: Math.max(1, Math.ceil((ISSUE_COOLDOWN_MS - (nowMs - previousIssuedMs)) / 1000)),
      }, 429);
    }

    const next: PrivilegedOtpState = {
      revision: Math.max(0, Number(previous?.revision || 0)) + 1,
      code_hash: codeHash,
      issued_at: new Date(nowMs).toISOString(),
      expires_at: "", // D165: no wall-clock expiry; consumed atomically at first successful use.
      failures: 0,
      blocked_until: "",
    };
    writeState(state, userId, next);
    return response({ status: "issued", revision: next.revision, issued_at: next.issued_at, expires_at: next.expires_at });
  }

  if (request.method === "POST" && url.pathname === "/privileged-auth/cancel") {
    let body: { user_id?: string; revision?: number } = {};
    try { body = (await request.json()) as typeof body; }
    catch { return response({ error: "invalid_json" }, 400); }
    const userId = String(body.user_id || "").trim();
    const current = readState(state, userId);
    if (current && Number(body.revision || 0) === current.revision) deleteState(state, userId);
    return response({ status: "cancelled" });
  }

  if (request.method === "POST" && url.pathname === "/privileged-auth/verify") {
    let body: { user_id?: string; code_hash?: string } = {};
    try { body = (await request.json()) as typeof body; }
    catch { return response({ error: "invalid_json" }, 400); }

    const userId = String(body.user_id || "").trim();
    const candidateHash = String(body.code_hash || "").trim().toLowerCase();
    if (!userId || !HASH_RE.test(candidateHash)) return response({ error: "invalid_input" }, 400);

    const current = readState(state, userId);
    if (!current) return response({ valid: false, error: "code_missing" }, 401);

    const blockedUntilMs = Date.parse(current.blocked_until || "") || 0;
    if (blockedUntilMs > nowMs) {
      return response({
        valid: false,
        error: "too_many_attempts",
        retry_after_seconds: Math.max(1, Math.ceil((blockedUntilMs - nowMs) / 1000)),
      }, 429);
    }

    if (safeEqualHex(current.code_hash, candidateHash)) {
      const revision = current.revision;
      deleteState(state, userId);
      return response({ valid: true, status: "consumed", revision });
    }

    const failures = Math.max(0, Number(current.failures || 0)) + 1;
    current.failures = failures >= MAX_FAILURES ? 0 : failures;
    current.blocked_until = failures >= MAX_FAILURES
      ? new Date(nowMs + ATTEMPT_BLOCK_MS).toISOString()
      : "";
    writeState(state, userId, current);
    return response({
      valid: false,
      error: failures >= MAX_FAILURES ? "too_many_attempts" : "code_invalid",
      retry_after_seconds: failures >= MAX_FAILURES ? Math.ceil(ATTEMPT_BLOCK_MS / 1000) : 0,
    }, failures >= MAX_FAILURES ? 429 : 401);
  }

  return null;
}
