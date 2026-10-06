export type ManagementRole = "ROOT" | "COORDINATOR";

export interface ManagementUser extends Record<string, SqlStorageValue> {
  user_id: string;
  username: string;
  display_name: string;
  role: ManagementRole;
  status: "ACTIVE" | "DISABLED";
  password_salt: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface ManagementSession extends Record<string, SqlStorageValue> {
  token_hash: string;
  user_id: string;
  username: string;
  display_name: string;
  role: ManagementRole;
  status: "ACTIVE" | "DISABLED";
  expires_at: number;
}

interface DeviceRow extends Record<string, SqlStorageValue> {
  serial: string;
  device_key: string;
  model: string;
  manufacturer: string;
  launcher_version: string;
  usage_status: string;
  physical_condition: string;
  borrower_employee_code: string | null;
  borrower_name: string | null;
  borrowed_at: string | null;
  last_returned_at: string | null;
  note: string;
  registry_last_seen_at: string;
  updated_at: string;
  updated_by: string;
  revision: number;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeUsername(value: unknown): string {
  return text(value, 64).toLowerCase();
}

export class PdaManagementCore {
  constructor(private readonly state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => this.initializeSchema());
  }

  private initializeSchema(): void {
    this.state.storage.sql.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ROOT','COORDINATOR')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);

      CREATE TABLE IF NOT EXISTS login_failures (
        username TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        window_started_at INTEGER NOT NULL DEFAULT 0,
        blocked_until INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS devices (
        serial TEXT PRIMARY KEY,
        device_key TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '',
        manufacturer TEXT NOT NULL DEFAULT '',
        launcher_version TEXT NOT NULL DEFAULT '',
        usage_status TEXT NOT NULL DEFAULT 'AVAILABLE'
          CHECK (usage_status IN ('AVAILABLE','BORROWED','REPAIR','DISABLED','LOST')),
        physical_condition TEXT NOT NULL DEFAULT 'UNKNOWN'
          CHECK (physical_condition IN ('GOOD','MINOR_DAMAGE','DAMAGED','UNKNOWN')),
        borrower_employee_code TEXT,
        borrower_name TEXT,
        borrowed_at TEXT,
        last_returned_at TEXT,
        note TEXT NOT NULL DEFAULT '',
        registry_last_seen_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT NOT NULL DEFAULT 'REGISTRY',
        revision INTEGER NOT NULL DEFAULT 1
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_device_key ON devices(device_key);
      CREATE INDEX IF NOT EXISTS idx_devices_status_serial ON devices(usage_status, serial);

      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        serial TEXT NOT NULL,
        action TEXT NOT NULL,
        employee_code TEXT,
        employee_name TEXT,
        old_usage_status TEXT,
        new_usage_status TEXT,
        physical_condition TEXT,
        occurred_at TEXT NOT NULL,
        operator_user_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT NOT NULL UNIQUE,
        revision INTEGER NOT NULL,
        FOREIGN KEY (serial) REFERENCES devices(serial)
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_serial_time ON transactions(serial, occurred_at DESC);

      INSERT INTO meta(key, value) VALUES ('data_revision', '1')
        ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key, value) VALUES ('registry_last_sync_ms', '0')
        ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key, value) VALUES ('registry_last_attempt_ms', '0')
        ON CONFLICT(key) DO NOTHING;
    `);
  }

  private meta(key: string, fallback = ""): string {
    return this.state.storage.sql
      .exec<{ value: string }>("SELECT value FROM meta WHERE key = ? LIMIT 1", key)
      .toArray()[0]?.value ?? fallback;
  }

  private setMeta(key: string, value: string): void {
    this.state.storage.sql.exec(
      "INSERT INTO meta(key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
      key, value,
    );
  }

  private incrementRevision(): number {
    const current = Number(this.meta("data_revision", "1")) || 1;
    const next = current + 1;
    this.setMeta("data_revision", String(next));
    return next;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sql = this.state.storage.sql;

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        status: "ok",
        storage: "sqlite-do",
        schema_version: 2,
        data_revision: Number(this.meta("data_revision", "1")) || 1,
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/user") {
      const username = normalizeUsername(url.searchParams.get("username"));
      const user = username
        ? sql.exec<ManagementUser>(
            "SELECT user_id, username, display_name, role, status, password_salt, password_hash, created_at, updated_at FROM users WHERE username = ? LIMIT 1",
            username,
          ).toArray()[0]
        : undefined;
      return json({ user: user || null });
    }

    if (request.method === "GET" && url.pathname === "/auth/user-count") {
      const count = Number(sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM users").toArray()[0]?.count || 0);
      return json({ count });
    }

    if (request.method === "POST" && url.pathname === "/auth/user/create") {
      const body = await request.json() as Record<string, unknown>;
      const userId = text(body.user_id, 80);
      const username = normalizeUsername(body.username);
      const displayName = text(body.display_name, 120);
      const role = text(body.role, 20).toUpperCase();
      const salt = text(body.password_salt, 200);
      const hash = text(body.password_hash, 200);
      if (!userId || !username || !displayName || !["ROOT","COORDINATOR"].includes(role) || !salt || !hash) {
        return json({ error: "INVALID_USER" }, 400);
      }
      try {
        sql.exec(
          "INSERT INTO users(user_id, username, display_name, role, status, password_salt, password_hash) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)",
          userId, username, displayName, role, salt, hash,
        );
      } catch {
        return json({ error: "USER_EXISTS" }, 409);
      }
      return json({ created: true });
    }

    if (request.method === "GET" && url.pathname === "/auth/guard") {
      const username = normalizeUsername(url.searchParams.get("username"));
      const now = Date.now();
      const row = username
        ? sql.exec<{ attempts: number; window_started_at: number; blocked_until: number }>(
            "SELECT attempts, window_started_at, blocked_until FROM login_failures WHERE username = ? LIMIT 1",
            username,
          ).toArray()[0]
        : undefined;
      const blockedUntil = Number(row?.blocked_until || 0);
      return json({
        allowed: blockedUntil <= now,
        retry_after_ms: Math.max(0, blockedUntil - now),
      });
    }

    if (request.method === "POST" && url.pathname === "/auth/failure") {
      const body = await request.json() as Record<string, unknown>;
      const username = normalizeUsername(body.username);
      if (!username) return json({ ok: true });
      const now = Date.now();
      const existing = sql.exec<{ attempts: number; window_started_at: number; blocked_until: number }>(
        "SELECT attempts, window_started_at, blocked_until FROM login_failures WHERE username = ? LIMIT 1",
        username,
      ).toArray()[0];
      const windowStart = Number(existing?.window_started_at || 0);
      let attempts = Number(existing?.attempts || 0);
      if (!windowStart || now - windowStart > 10 * 60_000) attempts = 0;
      attempts += 1;
      let blockedUntil = 0;
      if (attempts >= 10) blockedUntil = now + 30 * 60_000;
      else if (attempts >= 5) blockedUntil = now + 5 * 60_000;
      sql.exec(
        "INSERT INTO login_failures(username, attempts, window_started_at, blocked_until) VALUES (?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET attempts=excluded.attempts, window_started_at=excluded.window_started_at, blocked_until=excluded.blocked_until",
        username, attempts, (!windowStart || now - windowStart > 10 * 60_000) ? now : windowStart, blockedUntil,
      );
      return json({ ok: true, blocked_until: blockedUntil });
    }

    if (request.method === "POST" && url.pathname === "/auth/success") {
      const body = await request.json() as Record<string, unknown>;
      const username = normalizeUsername(body.username);
      if (username) sql.exec("DELETE FROM login_failures WHERE username = ?", username);
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/auth/session/create") {
      const body = await request.json() as Record<string, unknown>;
      const tokenHash = text(body.token_hash, 80);
      const userId = text(body.user_id, 80);
      const expiresAt = Number(body.expires_at || 0);
      if (!tokenHash || !userId || expiresAt <= Date.now()) return json({ error: "INVALID_SESSION" }, 400);
      sql.exec("DELETE FROM sessions WHERE expires_at <= ?", Date.now());
      sql.exec(
        "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        tokenHash, userId, expiresAt,
      );
      return json({ created: true });
    }

    if (request.method === "GET" && url.pathname === "/auth/session") {
      const tokenHash = text(url.searchParams.get("token_hash"), 80);
      const now = Date.now();
      const session = tokenHash
        ? sql.exec<ManagementSession>(`
            SELECT s.token_hash, s.user_id, u.username, u.display_name, u.role, u.status, s.expires_at
            FROM sessions s
            JOIN users u ON u.user_id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            LIMIT 1
          `, tokenHash, now).toArray()[0]
        : undefined;
      return json({ session: session || null });
    }

    if (request.method === "POST" && url.pathname === "/auth/session/delete") {
      const body = await request.json() as Record<string, unknown>;
      const tokenHash = text(body.token_hash, 80);
      if (tokenHash) sql.exec("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
      return json({ deleted: true });
    }

    if (request.method === "GET" && url.pathname === "/users/list") {
      const users = sql.exec<ManagementUser>(
        "SELECT user_id, username, display_name, role, status, password_salt, password_hash, created_at, updated_at FROM users ORDER BY CASE role WHEN 'ROOT' THEN 0 ELSE 1 END, display_name, username",
      ).toArray().map((user) => ({
        user_id: user.user_id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      }));
      return json({ users });
    }

    if (request.method === "GET" && url.pathname === "/devices/meta") {
      return json({
        data_revision: Number(this.meta("data_revision", "1")) || 1,
        registry_last_sync_ms: Number(this.meta("registry_last_sync_ms", "0")) || 0,
        registry_last_attempt_ms: Number(this.meta("registry_last_attempt_ms", "0")) || 0,
        count: Number(sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM devices").toArray()[0]?.count || 0),
      });
    }

    if (request.method === "POST" && url.pathname === "/devices/mark-attempt") {
      this.setMeta("registry_last_attempt_ms", String(Date.now()));
      return json({ ok: true });
    }

    if (request.method === "PUT" && url.pathname === "/devices/sync") {
      const body = await request.json() as { records?: Array<Record<string, unknown>> };
      const incoming = Array.isArray(body.records) ? body.records.slice(0, 5000) : [];
      const existing = new Map(
        sql.exec<DeviceRow>("SELECT * FROM devices").toArray().map((row) => [row.serial, row]),
      );
      let changed = 0;
      let created = 0;
      let updated = 0;

      for (const raw of incoming) {
        const serial = text(raw.serial, 120).toUpperCase();
        const deviceKey = text(raw.device_key, 80).toLowerCase();
        if (!serial || !deviceKey) continue;
        const model = text(raw.model, 100);
        const manufacturer = text(raw.manufacturer, 80);
        const launcherVersion = text(raw.launcher_version, 40);
        const lastSeen = text(raw.registry_last_seen_at, 80);
        const current = existing.get(serial);
        if (!current) {
          sql.exec(
            "INSERT INTO devices(serial, device_key, model, manufacturer, launcher_version, registry_last_seen_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, 'REGISTRY')",
            serial, deviceKey, model, manufacturer, launcherVersion, lastSeen,
          );
          changed += 1;
          created += 1;
          continue;
        }

        const identityChanged =
          current.device_key !== deviceKey ||
          current.model !== model ||
          current.manufacturer !== manufacturer ||
          current.launcher_version !== launcherVersion ||
          current.registry_last_seen_at !== lastSeen;
        if (!identityChanged) continue;

        sql.exec(
          "UPDATE devices SET device_key=?, model=?, manufacturer=?, launcher_version=?, registry_last_seen_at=?, updated_at=CURRENT_TIMESTAMP, updated_by='REGISTRY', revision=revision+1 WHERE serial=?",
          deviceKey, model, manufacturer, launcherVersion, lastSeen, serial,
        );
        changed += 1;
        updated += 1;
      }

      this.setMeta("registry_last_sync_ms", String(Date.now()));
      if (changed > 0) this.incrementRevision();
      return json({
        changed,
        created,
        updated,
        data_revision: Number(this.meta("data_revision", "1")) || 1,
        registry_last_sync_ms: Number(this.meta("registry_last_sync_ms", "0")) || 0,
      });
    }

    if (request.method === "GET" && url.pathname === "/devices/list") {
      const devices = sql.exec<DeviceRow>(`
        SELECT serial, device_key, model, manufacturer, launcher_version, usage_status,
               physical_condition, borrower_employee_code, borrower_name, borrowed_at,
               last_returned_at, note, registry_last_seen_at, updated_at, updated_by, revision
        FROM devices
        ORDER BY
          CASE usage_status
            WHEN 'BORROWED' THEN 0
            WHEN 'REPAIR' THEN 1
            WHEN 'LOST' THEN 2
            WHEN 'DISABLED' THEN 3
            ELSE 4
          END,
          serial
      `).toArray();
      return json({
        devices,
        data_revision: Number(this.meta("data_revision", "1")) || 1,
        registry_last_sync_ms: Number(this.meta("registry_last_sync_ms", "0")) || 0,
      });
    }

    return json({ error: "NOT_FOUND" }, 404);
  }
}
