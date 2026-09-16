import { handleBusinessRequest, initializeBusinessSchema } from "./business-core";
import { handleSkuImportCoreRequest } from "./sku-import-core";
import { handleReadModelCoreRequest } from "./read-model-core";

const SCHEMA_VERSION = 3;

interface CoreEnv {
  APP_ENV: string;
  PROJECT_KEY: string;
}

type AppRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";

interface InternalUser extends Record<string, SqlStorageValue> {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: AppRole;
  status: "ACTIVE" | "DISABLED";
  password_salt: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export class InventoryCore {
  private readonly state: DurableObjectState;
  private readonly env: CoreEnv;

  constructor(state: DurableObjectState, env: CoreEnv) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => this.initializeSchema());
  }

  private hasColumn(tableName: string, columnName: string): boolean {
    return this.state.storage.sql
      .exec<{ name: string }>(`PRAGMA table_info(${tableName})`)
      .toArray()
      .some((column) => column.name === columnName);
  }

  private initializeSchema(): void {
    const sql = this.state.storage.sql;
    sql.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS hr_source_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        sheet_id TEXT NOT NULL,
        sheet_url TEXT NOT NULL,
        tab_name TEXT NOT NULL,
        mnv_header TEXT NOT NULL,
        full_name_header TEXT NOT NULL,
        header_row INTEGER NOT NULL,
        data_row_count INTEGER NOT NULL DEFAULT 0,
        verified_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        firebase_uid TEXT UNIQUE,
        employee_code TEXT,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('PICKER','REPORTER','ADMIN','ROOT')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_code
        ON users(employee_code)
        WHERE employee_code IS NOT NULL AND employee_code <> '';
      CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

      CREATE TABLE IF NOT EXISTS sku_master (
        sku TEXT PRIMARY KEY,
        product_name TEXT NOT NULL,
        source_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sku_master_product_name ON sku_master(product_name);

      CREATE TABLE IF NOT EXISTS report_batches (
        batch_id TEXT PRIMARY KEY,
        sku TEXT NOT NULL,
        product_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','HAS_STOCK','SKIP_ALLOWED','CLOSED')),
        first_report_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by_user_id TEXT,
        resolution TEXT CHECK (resolution IS NULL OR resolution IN ('HAS_STOCK','SKIP_ALLOWED')),
        correction_deadline_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_report_batches_priority ON report_batches(status, first_report_at);
      CREATE INDEX IF NOT EXISTS idx_report_batches_sku_status ON report_batches(sku, status);

      CREATE TABLE IF NOT EXISTS report_tickets (
        ticket_id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        picker_user_id TEXT,
        picker_employee_code TEXT NOT NULL,
        sku TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','WITHDRAWN','RESOLVED')),
        reported_at TEXT NOT NULL,
        withdraw_deadline_at TEXT NOT NULL,
        withdrawn_at TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES report_batches(batch_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_open_ticket_picker_sku
        ON report_tickets(picker_employee_code, sku) WHERE status = 'OPEN';
      CREATE INDEX IF NOT EXISTS idx_report_tickets_batch ON report_tickets(batch_id, status, reported_at);

      CREATE TABLE IF NOT EXISTS report_events (
        event_id TEXT PRIMARY KEY,
        batch_id TEXT,
        ticket_id TEXT,
        event_type TEXT NOT NULL,
        actor_user_id TEXT,
        actor_employee_code TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES report_batches(batch_id),
        FOREIGN KEY (ticket_id) REFERENCES report_tickets(ticket_id)
      );
      CREATE INDEX IF NOT EXISTS idx_report_events_batch_time ON report_events(batch_id, created_at);

      CREATE TABLE IF NOT EXISTS fcm_devices (
        device_id TEXT PRIMARY KEY,
        user_id TEXT,
        platform TEXT NOT NULL CHECK (platform IN ('ANDROID','WEB')),
        token TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fcm_devices_user_enabled ON fcm_devices(user_id, enabled);

      CREATE TABLE IF NOT EXISTS presence_sessions (
        connection_id TEXT PRIMARY KEY,
        user_id TEXT,
        employee_code TEXT,
        role TEXT,
        client_type TEXT NOT NULL CHECK (client_type IN ('WEB','ANDROID')),
        connected_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence_sessions(last_seen_at);

      CREATE TABLE IF NOT EXISTS archive_checkpoints (
        stream_name TEXT PRIMARY KEY,
        cursor_value TEXT,
        last_exported_at TEXT,
        last_success_at TEXT,
        last_error TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        audit_id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        actor_employee_code TEXT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at);
    `);

    if (!this.hasColumn("users", "password_salt")) sql.exec("ALTER TABLE users ADD COLUMN password_salt TEXT");
    if (!this.hasColumn("users", "password_hash")) sql.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
    if (!this.hasColumn("users", "password_changed_at")) sql.exec("ALTER TABLE users ADD COLUMN password_changed_at TEXT");

    initializeBusinessSchema(this.state);

    sql.exec(
      `INSERT OR IGNORE INTO users (user_id, firebase_uid, employee_code, display_name, role, status)
       VALUES ('root', NULL, 'root', 'Root', 'ROOT', 'ACTIVE')`,
    );

    sql.exec(
      `INSERT INTO schema_meta (key, value, updated_at)
       VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      String(SCHEMA_VERSION),
    );
  }

  private getSchemaVersion(): number {
    const row = this.state.storage.sql
      .exec<{ value: string }>("SELECT value FROM schema_meta WHERE key = 'schema_version' LIMIT 1")
      .one();
    return Number(row?.value || 0);
  }

  private getUserByUsername(username: string): InternalUser | null {
    const rows = this.state.storage.sql.exec<InternalUser>(
      `SELECT user_id, firebase_uid, employee_code, display_name, role, status,
              password_salt, password_hash, password_changed_at
         FROM users
        WHERE lower(employee_code) = lower(?) OR lower(user_id) = lower(?)
        LIMIT 1`,
      username,
      username,
    ).toArray();
    return rows[0] ?? null;
  }

  private getUserByFirebaseUid(uid: string): InternalUser | null {
    const rows = this.state.storage.sql.exec<InternalUser>(
      `SELECT user_id, firebase_uid, employee_code, display_name, role, status,
              password_salt, password_hash, password_changed_at
         FROM users WHERE firebase_uid = ? LIMIT 1`,
      uid,
    ).toArray();
    return rows[0] ?? null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const root = this.getUserByUsername("root");
      return response({
        status: "ok",
        component: "durable-object-sqlite",
        environment: this.env.APP_ENV,
        schema_version: this.getSchemaVersion(),
        expected_schema_version: SCHEMA_VERSION,
        root_password_initialized: Boolean(root?.password_hash && root?.password_salt),
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/user-by-username") {
      const username = (url.searchParams.get("username") || "").trim();
      return response({ user: username ? this.getUserByUsername(username) : null });
    }

    if (request.method === "GET" && url.pathname === "/auth/user-by-firebase-uid") {
      const uid = (url.searchParams.get("uid") || "").trim();
      return response({ user: uid ? this.getUserByFirebaseUid(uid) : null });
    }

    if (request.method === "PUT" && url.pathname === "/auth/link-firebase-uid") {
      const body = (await request.json()) as { user_id?: string; firebase_uid?: string };
      if (!body.user_id || !body.firebase_uid) return response({ error: "invalid_input" }, 400);
      this.state.storage.sql.exec(
        `UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        body.firebase_uid,
        body.user_id,
      );
      return response({ status: "linked" });
    }

    if (request.method === "PUT" && url.pathname === "/auth/set-password") {
      const body = (await request.json()) as { user_id?: string; password_salt?: string; password_hash?: string };
      if (!body.user_id || !body.password_salt || !body.password_hash) return response({ error: "invalid_input" }, 400);
      this.state.storage.sql.exec(
        `UPDATE users
            SET password_salt = ?, password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`,
        body.password_salt,
        body.password_hash,
        body.user_id,
      );
      return response({ status: "password_saved" });
    }

    if (request.method === "GET" && url.pathname === "/config/hr-source") {
      const rows = this.state.storage.sql.exec<{
        sheet_id: string; sheet_url: string; tab_name: string; mnv_header: string; full_name_header: string;
        header_row: number; data_row_count: number; verified_at: string; updated_at: string;
      }>(
        `SELECT sheet_id, sheet_url, tab_name, mnv_header, full_name_header,
                header_row, data_row_count, verified_at, updated_at
           FROM hr_source_config WHERE id = 1`,
      ).toArray();
      return response({ configured: rows.length === 1, source: rows[0] ?? null });
    }

    if (request.method === "PUT" && url.pathname === "/config/hr-source") {
      const body = (await request.json()) as {
        sheet_id: string; sheet_url: string; tab_name: string; mnv_header: string; full_name_header: string;
        header_row: number; data_row_count: number; verified_at: string; updated_by?: string;
      };
      this.state.storage.sql.exec(
        `INSERT INTO hr_source_config (
           id, sheet_id, sheet_url, tab_name, mnv_header, full_name_header,
           header_row, data_row_count, verified_at, updated_at, updated_by
         ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT(id) DO UPDATE SET
           sheet_id = excluded.sheet_id,
           sheet_url = excluded.sheet_url,
           tab_name = excluded.tab_name,
           mnv_header = excluded.mnv_header,
           full_name_header = excluded.full_name_header,
           header_row = excluded.header_row,
           data_row_count = excluded.data_row_count,
           verified_at = excluded.verified_at,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = excluded.updated_by`,
        body.sheet_id, body.sheet_url, body.tab_name, body.mnv_header, body.full_name_header,
        body.header_row, body.data_row_count, body.verified_at, body.updated_by ?? null,
      );
      return response({ status: "saved" });
    }

    const skuImport = await handleSkuImportCoreRequest(this.state, request);
    if (skuImport) return skuImport;

    const readModel = await handleReadModelCoreRequest(this.state, request);
    if (readModel) return readModel;

    const business = await handleBusinessRequest(this.state, request);
    if (business) return business;

    return response({ error: "not_found" }, 404);
  }
}
