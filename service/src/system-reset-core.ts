type SqlRow = Record<string, SqlStorageValue>;

export type SystemResetScope =
  | "PICKER_ACCOUNTS"
  | "REPORTER_ACCOUNTS"
  | "ADMIN_ACCOUNTS"
  | "SKU_MASTER"
  | "OPEN_REPORTS"
  | "BUSINESS_HISTORY"
  | "SERVICE_LOGS"
  | "SESSIONS_DEVICES"
  | "RUNTIME_SETTINGS"
  | "CONFIRMATION_RELAY";

export const SYSTEM_RESET_SCOPES: SystemResetScope[] = [
  "PICKER_ACCOUNTS",
  "REPORTER_ACCOUNTS",
  "ADMIN_ACCOUNTS",
  "SKU_MASTER",
  "OPEN_REPORTS",
  "BUSINESS_HISTORY",
  "SERVICE_LOGS",
  "SESSIONS_DEVICES",
  "RUNTIME_SETTINGS",
  "CONFIRMATION_RELAY",
];

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function count(state: DurableObjectState, sql: string, ...args: SqlStorageValue[]): number {
  const row = state.storage.sql.exec<SqlRow>(sql, ...args).toArray()[0];
  return Number(row?.n || 0);
}

function validScopes(input: unknown): SystemResetScope[] {
  const raw = Array.isArray(input) ? input.map(String) : [];
  const allowed = new Set(SYSTEM_RESET_SCOPES);
  return [...new Set(raw.filter((value): value is SystemResetScope => allowed.has(value as SystemResetScope)))];
}

function roleUsers(state: DurableObjectState, role: "PICKER" | "REPORTER" | "ADMIN"): SqlRow[] {
  return state.storage.sql.exec<SqlRow>(
    `SELECT user_id, firebase_uid, employee_code, role
       FROM users WHERE role = ? ORDER BY user_id ASC`,
    role,
  ).toArray();
}

function resetPreview(state: DurableObjectState): Record<string, number> {
  return {
    picker_accounts: count(state, "SELECT COUNT(*) AS n FROM users WHERE role='PICKER'"),
    reporter_accounts: count(state, "SELECT COUNT(*) AS n FROM users WHERE role='REPORTER'"),
    admin_accounts: count(state, "SELECT COUNT(*) AS n FROM users WHERE role='ADMIN'"),
    root_accounts_preserved: count(state, "SELECT COUNT(*) AS n FROM users WHERE role='ROOT'"),
    sku_master: count(state, "SELECT COUNT(*) AS n FROM sku_master"),
    open_report_batches: count(state, "SELECT COUNT(*) AS n FROM report_batches WHERE status='PENDING'"),
    open_report_tickets: count(state, "SELECT COUNT(*) AS n FROM report_tickets WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE status='PENDING')"),
    history_batches: count(state, "SELECT COUNT(*) AS n FROM report_batches WHERE status<>'PENDING'"),
    history_events: count(state, "SELECT COUNT(*) AS n FROM report_events"),
    audit_log: count(state, "SELECT COUNT(*) AS n FROM audit_log"),
    notification_delivery_attempts: count(state, "SELECT COUNT(*) AS n FROM notification_delivery_attempts"),
    fcm_devices: count(state, "SELECT COUNT(*) AS n FROM fcm_devices"),
    presence_sessions: count(state, "SELECT COUNT(*) AS n FROM presence_sessions"),
    app_config: count(state, "SELECT COUNT(*) AS n FROM app_config"),
    hr_source_config: count(state, "SELECT COUNT(*) AS n FROM hr_source_config"),
  };
}

function deleteBatches(state: DurableObjectState, where: string): void {
  state.storage.sql.exec(
    `DELETE FROM notification_delivery_attempts
      WHERE event_id IN (
        SELECT event_id FROM report_events
         WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE ${where})
      )`,
  );
  state.storage.sql.exec(
    `DELETE FROM result_acknowledgements
      WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE ${where})`,
  );
  state.storage.sql.exec(
    `DELETE FROM result_event_snapshots
      WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE ${where})`,
  );
  state.storage.sql.exec(
    `DELETE FROM realtime_events
      WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE ${where})`,
  );
  state.storage.sql.exec(
    `DELETE FROM report_events
      WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE ${where})`,
  );
  state.storage.sql.exec(
    `DELETE FROM report_tickets
      WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE ${where})`,
  );
  state.storage.sql.exec(
    `DELETE FROM archive_exports
      WHERE batch_id IN (SELECT batch_id FROM report_batches WHERE ${where})`,
  );
  state.storage.sql.exec(`DELETE FROM report_batches WHERE ${where}`);
}

function executeReset(state: DurableObjectState, scopes: SystemResetScope[]): Record<string, unknown> {
  const selected = new Set(scopes);
  const before = resetPreview(state);
  state.storage.transactionSync(() => {
    if (selected.has("OPEN_REPORTS") && selected.has("BUSINESS_HISTORY")) {
      deleteBatches(state, "1=1");
    } else {
      if (selected.has("OPEN_REPORTS")) deleteBatches(state, "status='PENDING'");
      if (selected.has("BUSINESS_HISTORY")) deleteBatches(state, "status<>'PENDING'");
    }

    if (selected.has("BUSINESS_HISTORY")) {
      state.storage.sql.exec("DELETE FROM archive_checkpoints");
      state.storage.sql.exec("DELETE FROM idempotency_keys");
      state.storage.sql.exec("DELETE FROM realtime_events WHERE batch_id IS NULL");
      state.storage.sql.exec("DELETE FROM result_acknowledgements WHERE batch_id NOT IN (SELECT batch_id FROM report_batches)");
      state.storage.sql.exec("DELETE FROM result_event_snapshots WHERE batch_id NOT IN (SELECT batch_id FROM report_batches)");
    }

    if (selected.has("SERVICE_LOGS")) {
      state.storage.sql.exec("DELETE FROM audit_log");
      state.storage.sql.exec("DELETE FROM notification_delivery_attempts");
    }

    if (selected.has("SESSIONS_DEVICES")) {
      state.storage.sql.exec("DELETE FROM fcm_devices");
      state.storage.sql.exec("DELETE FROM presence_sessions");
      state.storage.sql.exec(
        `UPDATE users
            SET web_session_generation = COALESCE(web_session_generation,0) + 1,
                web_session_device_id = NULL,
                web_session_started_at = NULL,
                android_session_generation = COALESCE(android_session_generation,0) + 1,
                android_session_device_id = NULL,
                android_session_started_at = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE role <> 'ROOT'`,
      );
    }

    for (const role of ["PICKER","REPORTER","ADMIN"] as const) {
      const scope = role === "PICKER" ? "PICKER_ACCOUNTS" : role === "REPORTER" ? "REPORTER_ACCOUNTS" : "ADMIN_ACCOUNTS";
      if (!selected.has(scope)) continue;
      state.storage.sql.exec("DELETE FROM fcm_devices WHERE user_id IN (SELECT user_id FROM users WHERE role = ?)", role);
      state.storage.sql.exec("DELETE FROM presence_sessions WHERE user_id IN (SELECT user_id FROM users WHERE role = ?)", role);
      state.storage.sql.exec("DELETE FROM users WHERE role = ?", role);
    }

    if (selected.has("SKU_MASTER")) {
      state.storage.sql.exec("DELETE FROM sku_master");
      state.storage.sql.exec("UPDATE sku_catalog_meta SET item_count=0, max_updated_at=NULL WHERE id=1");
    }

    if (selected.has("RUNTIME_SETTINGS")) {
      state.storage.sql.exec("DELETE FROM app_config");
      state.storage.sql.exec("DELETE FROM hr_source_config");
    }
  });
  return { before, after: resetPreview(state), scopes };
}

interface ResetChallenge {
  challenge_id: string;
  root_user_id: string;
  email: string;
  scopes: SystemResetScope[];
  code_hash: string;
  created_at: string;
  expires_at: string;
  attempts: number;
  verified_at?: string | null;
}

function challengeKey(id: string): string { return `system-reset-challenge:${id}`; }

export async function handleSystemResetCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/root/system-reset/challenge-store") {
    const body = (await request.json()) as ResetChallenge;
    const scopes = validScopes(body.scopes);
    const expiresAt = Date.parse(String(body.expires_at || ""));
    if (!body.challenge_id || !body.root_user_id || !body.email || !body.code_hash || !scopes.length || !Number.isFinite(expiresAt)) {
      return response({ error: "INVALID_RESET_CHALLENGE" }, 400);
    }
    const throttleKey = `system-reset-throttle:${String(body.root_user_id)}`;
    const lastSentAt = Number((await state.storage.get<number>(throttleKey)) || 0);
    if (lastSentAt && Date.now() - lastSentAt < 60_000) {
      return response({ error: "RESET_CODE_RATE_LIMIT", retry_after_seconds: Math.ceil((60_000 - (Date.now() - lastSentAt)) / 1000) }, 429);
    }
    const challenge: ResetChallenge = {
      challenge_id: String(body.challenge_id),
      root_user_id: String(body.root_user_id),
      email: String(body.email),
      scopes,
      code_hash: String(body.code_hash),
      created_at: String(body.created_at || new Date().toISOString()),
      expires_at: new Date(expiresAt).toISOString(),
      attempts: 0,
      verified_at: null,
    };
    await state.storage.put(challengeKey(challenge.challenge_id), challenge);
    await state.storage.put(throttleKey, Date.now());
    return response({ status: "stored" });
  }

  if (request.method === "POST" && url.pathname === "/root/system-reset/challenge-delete") {
    const body = (await request.json()) as { challenge_id?: string };
    const id = String(body.challenge_id || "");
    if (id) await state.storage.delete(challengeKey(id));
    return response({ status: "deleted" });
  }

  if (request.method === "POST" && url.pathname === "/root/system-reset/challenge-verify") {
    const body = (await request.json()) as { challenge_id?: string; root_user_id?: string; code_hash?: string };
    const id = String(body.challenge_id || "");
    const challenge = id ? await state.storage.get<ResetChallenge>(challengeKey(id)) : null;
    if (!challenge || challenge.root_user_id !== String(body.root_user_id || "")) return response({ error: "RESET_CHALLENGE_INVALID" }, 400);
    if (Date.parse(challenge.expires_at) < Date.now()) {
      await state.storage.delete(challengeKey(id));
      return response({ error: "RESET_CODE_EXPIRED" }, 400);
    }
    if (challenge.attempts >= 5) {
      await state.storage.delete(challengeKey(id));
      return response({ error: "RESET_CODE_LOCKED" }, 429);
    }
    if (challenge.code_hash !== String(body.code_hash || "")) {
      challenge.attempts += 1;
      await state.storage.put(challengeKey(id), challenge);
      return response({ error: "RESET_CODE_INVALID", remaining_attempts: Math.max(0, 5 - challenge.attempts) }, 400);
    }
    challenge.verified_at = new Date().toISOString();
    await state.storage.put(challengeKey(id), challenge);
    return response({ status: "verified", scopes: challenge.scopes, email: challenge.email });
  }

  if (request.method === "POST" && url.pathname === "/root/system-reset/challenge-consume") {
    const body = (await request.json()) as { challenge_id?: string; root_user_id?: string };
    const id = String(body.challenge_id || "");
    const challenge = id ? await state.storage.get<ResetChallenge>(challengeKey(id)) : null;
    if (!challenge || challenge.root_user_id !== String(body.root_user_id || "") || !challenge.verified_at) {
      return response({ error: "RESET_CHALLENGE_NOT_VERIFIED" }, 400);
    }
    await state.storage.delete(challengeKey(id));
    return response({ status: "consumed" });
  }

  if (request.method === "GET" && url.pathname === "/root/system-reset/preview") {
    return response({ counts: resetPreview(state) });
  }

  if (request.method === "POST" && url.pathname === "/root/system-reset/identities") {
    const body = (await request.json()) as { scopes?: unknown };
    const scopes = validScopes(body.scopes);
    const selected = new Set(scopes);
    const identities: SqlRow[] = [];
    if (selected.has("PICKER_ACCOUNTS")) identities.push(...roleUsers(state, "PICKER"));
    if (selected.has("REPORTER_ACCOUNTS")) identities.push(...roleUsers(state, "REPORTER"));
    if (selected.has("ADMIN_ACCOUNTS")) identities.push(...roleUsers(state, "ADMIN"));
    return response({ identities, scopes });
  }

  if (request.method === "POST" && url.pathname === "/root/system-reset/execute") {
    const body = (await request.json()) as { scopes?: unknown };
    const scopes = validScopes(body.scopes);
    if (!scopes.length) return response({ error: "RESET_SCOPE_REQUIRED" }, 400);
    return response({ status: "reset_complete", ...executeReset(state, scopes) });
  }

  return null;
}
