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

interface EmployeeRow extends Record<string, SqlStorageValue> {
  employee_code: string;
  full_name: string;
  contractor: string;
  source_hash: string;
  updated_at: string;
}

interface TransactionRow extends Record<string, SqlStorageValue> {
  transaction_id: string;
  serial: string;
  action: string;
  employee_code: string | null;
  employee_name: string | null;
  employee_contractor: string | null;
  old_usage_status: string | null;
  new_usage_status: string | null;
  physical_condition: string | null;
  occurred_at: string;
  operator_user_id: string;
  operator_name: string;
  note: string;
  idempotency_key: string;
  revision: number;
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
  borrower_contractor: string | null;
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

  private hasColumn(tableName: string, columnName: string): boolean {
    return this.state.storage.sql
      .exec<{ name: string }>(`PRAGMA table_info(${tableName})`)
      .toArray()
      .some((column) => column.name === columnName);
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
        borrower_contractor TEXT,
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
        employee_contractor TEXT,
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

      CREATE TABLE IF NOT EXISTS employees (
        employee_code TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        contractor TEXT NOT NULL DEFAULT '',
        source_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(full_name);

      INSERT INTO meta(key, value) VALUES ('data_revision', '1')
        ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key, value) VALUES ('registry_last_sync_ms', '0')
        ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key, value) VALUES ('registry_last_attempt_ms', '0')
        ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key, value) VALUES ('hr_last_sync_ms', '0')
        ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key, value) VALUES ('hr_last_attempt_ms', '0')
        ON CONFLICT(key) DO NOTHING;
    `);

    if (!this.hasColumn("devices", "borrower_contractor")) {
      sql.exec("ALTER TABLE devices ADD COLUMN borrower_contractor TEXT");
    }
    if (!this.hasColumn("transactions", "employee_contractor")) {
      sql.exec("ALTER TABLE transactions ADD COLUMN employee_contractor TEXT");
    }
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

    if (request.method === "GET" && url.pathname === "/employees/meta") {
      return json({
        hr_last_sync_ms: Number(this.meta("hr_last_sync_ms", "0")) || 0,
        hr_last_attempt_ms: Number(this.meta("hr_last_attempt_ms", "0")) || 0,
        count: Number(sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM employees").toArray()[0]?.count || 0),
      });
    }

    if (request.method === "POST" && url.pathname === "/employees/mark-attempt") {
      this.setMeta("hr_last_attempt_ms", String(Date.now()));
      return json({ ok: true });
    }

    if (request.method === "PUT" && url.pathname === "/employees/sync") {
      const body = await request.json() as { records?: Array<Record<string, unknown>> };
      const incoming = Array.isArray(body.records) ? body.records.slice(0, 5000) : [];
      const existing = new Map(
        sql.exec<EmployeeRow>("SELECT employee_code, full_name, contractor, source_hash, updated_at FROM employees")
          .toArray()
          .map((row) => [row.employee_code, row]),
      );
      const incomingCodes = new Set(
        incoming
          .map((raw) => text(raw.employee_code, 80))
          .filter(Boolean),
      );
      if (existing.size > 0) {
        const minimumSafe = Math.floor(existing.size * 0.8);
        if (incomingCodes.size < minimumSafe) {
          return json({
            error: "HR_ROW_LOSS_GUARD",
            existing_count: existing.size,
            incoming_count: incomingCodes.size,
          }, 409);
        }
      }

      let changed = 0;
      let created = 0;
      let updated = 0;
      let removed = 0;

      for (const raw of incoming) {
        const employeeCode = text(raw.employee_code, 80);
        const fullName = text(raw.full_name, 160);
        const contractor = text(raw.contractor, 120);
        const sourceHash = text(raw.source_hash, 80);
        if (!employeeCode || !fullName || !sourceHash) continue;
        const current = existing.get(employeeCode);
        if (!current) {
          sql.exec(
            "INSERT INTO employees(employee_code, full_name, contractor, source_hash) VALUES (?, ?, ?, ?)",
            employeeCode, fullName, contractor, sourceHash,
          );
          created += 1;
          changed += 1;
          continue;
        }
        if (
          current.full_name === fullName &&
          current.contractor === contractor &&
          current.source_hash === sourceHash
        ) continue;
        sql.exec(
          "UPDATE employees SET full_name=?, contractor=?, source_hash=?, updated_at=CURRENT_TIMESTAMP WHERE employee_code=?",
          fullName, contractor, sourceHash, employeeCode,
        );
        updated += 1;
        changed += 1;
      }

      for (const employeeCode of existing.keys()) {
        if (incomingCodes.has(employeeCode)) continue;
        sql.exec("DELETE FROM employees WHERE employee_code=?", employeeCode);
        removed += 1;
        changed += 1;
      }

      this.setMeta("hr_last_sync_ms", String(Date.now()));
      return json({
        changed,
        created,
        updated,
        removed,
        hr_last_sync_ms: Number(this.meta("hr_last_sync_ms", "0")) || 0,
      });
    }

    if (request.method === "GET" && url.pathname === "/employees/find") {
      const employeeCode = text(url.searchParams.get("employee_code"), 80);
      const employee = employeeCode
        ? sql.exec<EmployeeRow>(
            "SELECT employee_code, full_name, contractor, source_hash, updated_at FROM employees WHERE employee_code=? LIMIT 1",
            employeeCode,
          ).toArray()[0]
        : undefined;
      return json({ employee: employee || null });
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
               physical_condition, borrower_employee_code, borrower_name, borrower_contractor, borrowed_at,
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

    if (request.method === "GET" && url.pathname === "/devices/get") {
      const serial = text(url.searchParams.get("serial"), 120).toUpperCase();
      const device = serial
        ? sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", serial).toArray()[0]
        : undefined;
      return device ? json({ device }) : json({ error: "DEVICE_NOT_FOUND" }, 404);
    }

    if (request.method === "GET" && url.pathname === "/devices/history") {
      const serial = text(url.searchParams.get("serial"), 120).toUpperCase();
      if (!serial) return json({ error: "INVALID_SERIAL" }, 400);
      const transactions = sql.exec<TransactionRow>(
        "SELECT transaction_id, serial, action, employee_code, employee_name, employee_contractor, old_usage_status, new_usage_status, physical_condition, occurred_at, operator_user_id, operator_name, note, idempotency_key, revision FROM transactions WHERE serial=? ORDER BY occurred_at DESC LIMIT 100",
        serial,
      ).toArray();
      return json({ transactions });
    }

    if (request.method === "POST" && url.pathname === "/devices/borrow") {
      const body = await request.json() as Record<string, unknown>;
      const serial = text(body.serial, 120).toUpperCase();
      const employeeCode = text(body.employee_code, 80);
      const employeeName = text(body.employee_name, 160);
      const employeeContractor = text(body.employee_contractor, 120);
      const operatorUserId = text(body.operator_user_id, 80);
      const operatorName = text(body.operator_name, 160);
      const idempotencyKey = text(body.idempotency_key, 120);
      const transactionId = text(body.transaction_id, 120);
      const occurredAt = text(body.occurred_at, 80) || new Date().toISOString();
      if (!serial || !employeeCode || !employeeName || !operatorUserId || !operatorName || !idempotencyKey || !transactionId) {
        return json({ error: "INVALID_BORROW_REQUEST" }, 400);
      }

      const replay = sql.exec<TransactionRow>(
        "SELECT * FROM transactions WHERE idempotency_key=? LIMIT 1",
        idempotencyKey,
      ).toArray()[0];
      if (replay) {
        const device = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", replay.serial).toArray()[0];
        return json({ replayed: true, transaction: replay, device });
      }

      const current = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", serial).toArray()[0];
      if (!current) return json({ error: "DEVICE_NOT_FOUND" }, 404);
      if (current.usage_status !== "AVAILABLE") {
        return json({
          error: "DEVICE_NOT_AVAILABLE",
          usage_status: current.usage_status,
          borrower_employee_code: current.borrower_employee_code,
          borrower_name: current.borrower_name,
        }, 409);
      }

      const nextRevision = Number(current.revision || 0) + 1;
      sql.exec(
        `UPDATE devices
         SET usage_status='BORROWED',
             borrower_employee_code=?,
             borrower_name=?,
             borrower_contractor=?,
             borrowed_at=?,
             updated_at=?,
             updated_by=?,
             revision=?
         WHERE serial=?`,
        employeeCode, employeeName, employeeContractor, occurredAt, occurredAt, operatorUserId, nextRevision, serial,
      );
      sql.exec(
        `INSERT INTO transactions(
          transaction_id, serial, action, employee_code, employee_name, employee_contractor,
          old_usage_status, new_usage_status, physical_condition, occurred_at,
          operator_user_id, operator_name, note, idempotency_key, revision
        ) VALUES (?, ?, 'BORROW', ?, ?, ?, ?, 'BORROWED', ?, ?, ?, ?, '', ?, ?)`,
        transactionId, serial, employeeCode, employeeName, employeeContractor,
        current.usage_status, current.physical_condition, occurredAt,
        operatorUserId, operatorName, idempotencyKey, nextRevision,
      );
      this.incrementRevision();
      const device = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", serial).toArray()[0];
      const transaction = sql.exec<TransactionRow>("SELECT * FROM transactions WHERE transaction_id=? LIMIT 1", transactionId).toArray()[0];
      return json({ replayed: false, transaction, device });
    }

    if (request.method === "POST" && url.pathname === "/devices/status") {
      const body = await request.json() as Record<string, unknown>;
      const serial = text(body.serial, 120).toUpperCase();
      const newStatus = text(body.usage_status, 30).toUpperCase();
      const condition = text(body.physical_condition, 30).toUpperCase();
      const operatorUserId = text(body.operator_user_id, 80);
      const operatorName = text(body.operator_name, 160);
      const note = text(body.note, 500);
      const idempotencyKey = text(body.idempotency_key, 120);
      const transactionId = text(body.transaction_id, 120);
      const occurredAt = text(body.occurred_at, 80) || new Date().toISOString();
      if (
        !serial ||
        !["AVAILABLE","REPAIR","DISABLED","LOST"].includes(newStatus) ||
        !["GOOD","MINOR_DAMAGE","DAMAGED","UNKNOWN"].includes(condition) ||
        !operatorUserId || !operatorName || !idempotencyKey || !transactionId
      ) {
        return json({ error: "INVALID_STATUS_REQUEST" }, 400);
      }

      const replay = sql.exec<TransactionRow>(
        "SELECT * FROM transactions WHERE idempotency_key=? LIMIT 1",
        idempotencyKey,
      ).toArray()[0];
      if (replay) {
        const device = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", replay.serial).toArray()[0];
        return json({ replayed: true, transaction: replay, device });
      }

      const current = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", serial).toArray()[0];
      if (!current) return json({ error: "DEVICE_NOT_FOUND" }, 404);
      if (current.usage_status === "BORROWED") {
        return json({ error: "BORROWED_DEVICE_REQUIRES_RETURN" }, 409);
      }

      const nextRevision = Number(current.revision || 0) + 1;
      sql.exec(
        `UPDATE devices
         SET usage_status=?,
             physical_condition=?,
             note=?,
             updated_at=?,
             updated_by=?,
             revision=?
         WHERE serial=?`,
        newStatus, condition, note, occurredAt, operatorUserId, nextRevision, serial,
      );
      sql.exec(
        `INSERT INTO transactions(
          transaction_id, serial, action, employee_code, employee_name, employee_contractor,
          old_usage_status, new_usage_status, physical_condition, occurred_at,
          operator_user_id, operator_name, note, idempotency_key, revision
        ) VALUES (?, ?, 'STATUS_UPDATE', NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        transactionId, serial, current.usage_status, newStatus, condition, occurredAt,
        operatorUserId, operatorName, note, idempotencyKey, nextRevision,
      );
      this.incrementRevision();
      const device = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", serial).toArray()[0];
      const transaction = sql.exec<TransactionRow>("SELECT * FROM transactions WHERE transaction_id=? LIMIT 1", transactionId).toArray()[0];
      return json({ replayed: false, transaction, device });
    }

    if (request.method === "POST" && url.pathname === "/devices/return") {
      const body = await request.json() as Record<string, unknown>;
      const serial = text(body.serial, 120).toUpperCase();
      const condition = text(body.physical_condition, 30).toUpperCase();
      const operatorUserId = text(body.operator_user_id, 80);
      const operatorName = text(body.operator_name, 160);
      const note = text(body.note, 500);
      const idempotencyKey = text(body.idempotency_key, 120);
      const transactionId = text(body.transaction_id, 120);
      const occurredAt = text(body.occurred_at, 80) || new Date().toISOString();
      if (!serial || !["GOOD","MINOR_DAMAGE","DAMAGED"].includes(condition) || !operatorUserId || !operatorName || !idempotencyKey || !transactionId) {
        return json({ error: "INVALID_RETURN_REQUEST" }, 400);
      }

      const replay = sql.exec<TransactionRow>(
        "SELECT * FROM transactions WHERE idempotency_key=? LIMIT 1",
        idempotencyKey,
      ).toArray()[0];
      if (replay) {
        const device = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", replay.serial).toArray()[0];
        return json({ replayed: true, transaction: replay, device });
      }

      const current = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", serial).toArray()[0];
      if (!current) return json({ error: "DEVICE_NOT_FOUND" }, 404);
      if (current.usage_status !== "BORROWED") {
        return json({ error: "DEVICE_NOT_BORROWED", usage_status: current.usage_status }, 409);
      }

      const newStatus = condition === "DAMAGED" ? "REPAIR" : "AVAILABLE";
      const nextRevision = Number(current.revision || 0) + 1;
      sql.exec(
        `UPDATE devices
         SET usage_status=?,
             physical_condition=?,
             borrower_employee_code=NULL,
             borrower_name=NULL,
             borrower_contractor=NULL,
             borrowed_at=NULL,
             last_returned_at=?,
             note=?,
             updated_at=?,
             updated_by=?,
             revision=?
         WHERE serial=?`,
        newStatus, condition, occurredAt, note, occurredAt, operatorUserId, nextRevision, serial,
      );
      sql.exec(
        `INSERT INTO transactions(
          transaction_id, serial, action, employee_code, employee_name, employee_contractor,
          old_usage_status, new_usage_status, physical_condition, occurred_at,
          operator_user_id, operator_name, note, idempotency_key, revision
        ) VALUES (?, ?, 'RETURN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        transactionId, serial,
        current.borrower_employee_code, current.borrower_name, current.borrower_contractor,
        current.usage_status, newStatus, condition, occurredAt,
        operatorUserId, operatorName, note, idempotencyKey, nextRevision,
      );
      this.incrementRevision();
      const device = sql.exec<DeviceRow>("SELECT * FROM devices WHERE serial=? LIMIT 1", serial).toArray()[0];
      const transaction = sql.exec<TransactionRow>("SELECT * FROM transactions WHERE transaction_id=? LIMIT 1", transactionId).toArray()[0];
      return json({ replayed: false, transaction, device });
    }

    return json({ error: "NOT_FOUND" }, 404);
  }
}
