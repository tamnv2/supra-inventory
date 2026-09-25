import { handleBusinessRequest, initializeBusinessSchema } from "./business-core";
import { handleSkuImportCoreRequest } from "./sku-import-core";
import { handleReadModelCoreRequest } from "./read-model-core";
import { handleNotificationCoreRequest } from "./notifications-core";
import { handleUserManagementCoreRequest } from "./user-management-core";
import { handleArchiveCoreRequest } from "./archive-core";
import { handleSystemMetricsCoreRequest } from "./system-metrics-core";
import { handleSystemResetCoreRequest } from "./system-reset-core";
import { handleAuthRecoveryCoreRequest } from "./auth-recovery-core";
import { handleOperationalV2CoreRequest, initializeOperationalV2Schema, operationalV2Readiness } from "./operational-v2-core";
import {
  processOperationalDeadlines,
  scheduleNextOperationalAlarm,
  type OperationalDeadlineEffect,
} from "./sla-automation";
import { sendFcmNotifications } from "./fcm";
import { readAndroidAlertWindow } from "./alert-window-core";

const SCHEMA_VERSION = 12;

interface CoreEnv {
  APP_ENV: string;
  PROJECT_KEY: string;
  FIREBASE_PROJECT_ID: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
}

type AppRole = "PICKER" | "REPORTER" | "ADMIN" | "PICKPACK_ADMIN" | "ROOT";

interface InternalUser extends Record<string, SqlStorageValue> {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: AppRole;
  base_role: AppRole;
  role_override: AppRole | null;
  status: "ACTIVE" | "DISABLED";
  password_salt: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
  auth_email: string | null;
  firebase_password_ready: number;
  firebase_agent_ready: number;
  session_generation: number;
  session_started_at: string | null;
  web_session_generation: number;
  web_session_device_id: string | null;
  web_session_started_at: string | null;
  android_session_generation: number;
  android_session_device_id: string | null;
  android_session_started_at: string | null;
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
  private nextAuditRetentionSweepAt = 0;

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
        role TEXT NOT NULL CHECK (role IN ('PICKER','REPORTER','ADMIN','PICKPACK_ADMIN','ROOT')),
        role_override TEXT CHECK (role_override IS NULL OR role_override IN ('PICKER','REPORTER','ADMIN')),
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
      CREATE INDEX IF NOT EXISTS idx_sku_master_updated_at_sku ON sku_master(updated_at, sku);

      CREATE TABLE IF NOT EXISTS sku_catalog_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        item_count INTEGER NOT NULL DEFAULT 0,
        max_updated_at TEXT
      );

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
      CREATE INDEX IF NOT EXISTS idx_report_batches_first_report_at_status ON report_batches(first_report_at, status);
      CREATE INDEX IF NOT EXISTS idx_report_batches_resolved_at_status ON report_batches(resolved_at, status);

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
      CREATE INDEX IF NOT EXISTS idx_report_tickets_reported_at_batch ON report_tickets(reported_at, batch_id, picker_employee_code);

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

      CREATE TABLE IF NOT EXISTS archive_exports (
        batch_id TEXT PRIMARY KEY,
        archive_run_id TEXT NOT NULL,
        manifest_id TEXT NOT NULL,
        archived_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_archive_exports_archived_at ON archive_exports(archived_at);

      CREATE TABLE IF NOT EXISTS audit_log (
        audit_id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        actor_employee_code TEXT,
        actor_role TEXT,
        actor_display_name TEXT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at);
    `);

    const catalogMeta = sql.exec<{ id: number }>("SELECT id FROM sku_catalog_meta WHERE id = 1 LIMIT 1").toArray()[0];
    if (!catalogMeta) {
      sql.exec(
        `INSERT INTO sku_catalog_meta (id, item_count, max_updated_at)
         SELECT 1, COUNT(*), MAX(updated_at) FROM sku_master`,
      );
    }

    if (!this.hasColumn("users", "password_salt")) sql.exec("ALTER TABLE users ADD COLUMN password_salt TEXT");
    if (!this.hasColumn("users", "password_hash")) sql.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
    if (!this.hasColumn("users", "password_changed_at")) sql.exec("ALTER TABLE users ADD COLUMN password_changed_at TEXT");
    if (!this.hasColumn("users", "role_override")) sql.exec("ALTER TABLE users ADD COLUMN role_override TEXT");
    if (!this.hasColumn("users", "session_generation")) sql.exec("ALTER TABLE users ADD COLUMN session_generation INTEGER NOT NULL DEFAULT 0");
    if (!this.hasColumn("users", "session_started_at")) sql.exec("ALTER TABLE users ADD COLUMN session_started_at TEXT");
    if (!this.hasColumn("users", "auth_email")) sql.exec("ALTER TABLE users ADD COLUMN auth_email TEXT");
    if (!this.hasColumn("users", "firebase_password_ready")) sql.exec("ALTER TABLE users ADD COLUMN firebase_password_ready INTEGER NOT NULL DEFAULT 0");
    if (!this.hasColumn("users", "firebase_agent_ready")) sql.exec("ALTER TABLE users ADD COLUMN firebase_agent_ready INTEGER NOT NULL DEFAULT 0");
    if (!this.hasColumn("users", "web_session_generation")) sql.exec("ALTER TABLE users ADD COLUMN web_session_generation INTEGER NOT NULL DEFAULT 0");
    if (!this.hasColumn("users", "web_session_device_id")) sql.exec("ALTER TABLE users ADD COLUMN web_session_device_id TEXT");
    if (!this.hasColumn("users", "web_session_started_at")) sql.exec("ALTER TABLE users ADD COLUMN web_session_started_at TEXT");
    if (!this.hasColumn("users", "android_session_generation")) sql.exec("ALTER TABLE users ADD COLUMN android_session_generation INTEGER NOT NULL DEFAULT 0");
    if (!this.hasColumn("users", "android_session_device_id")) sql.exec("ALTER TABLE users ADD COLUMN android_session_device_id TEXT");
    if (!this.hasColumn("users", "android_session_started_at")) sql.exec("ALTER TABLE users ADD COLUMN android_session_started_at TEXT");
    if (!this.hasColumn("audit_log", "actor_role")) sql.exec("ALTER TABLE audit_log ADD COLUMN actor_role TEXT");
    if (!this.hasColumn("audit_log", "actor_display_name")) sql.exec("ALTER TABLE audit_log ADD COLUMN actor_display_name TEXT");

    // D119 additive role migration. Rebuild only the users table constraint; all
    // accepted D118 business/HA tables and semantics remain untouched.
    const usersTableSql = String(
      sql.exec<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1").toArray()[0]?.sql || "",
    );
    if (!usersTableSql.includes("'PICKPACK_ADMIN'")) {
      this.state.storage.transactionSync(() => {
        sql.exec(`
          CREATE TABLE users_d119 (
            user_id TEXT PRIMARY KEY,
            firebase_uid TEXT UNIQUE,
            employee_code TEXT,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('PICKER','REPORTER','ADMIN','PICKPACK_ADMIN','ROOT')),
            role_override TEXT CHECK (role_override IS NULL OR role_override IN ('PICKER','REPORTER','ADMIN')),
            status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            password_salt TEXT,
            password_hash TEXT,
            password_changed_at TEXT,
            session_generation INTEGER NOT NULL DEFAULT 0,
            session_started_at TEXT,
            auth_email TEXT,
            firebase_password_ready INTEGER NOT NULL DEFAULT 0,
            firebase_agent_ready INTEGER NOT NULL DEFAULT 0,
            web_session_generation INTEGER NOT NULL DEFAULT 0,
            web_session_device_id TEXT,
            web_session_started_at TEXT,
            android_session_generation INTEGER NOT NULL DEFAULT 0,
            android_session_device_id TEXT,
            android_session_started_at TEXT
          );
          INSERT INTO users_d119 (
            user_id, firebase_uid, employee_code, display_name, role, role_override, status,
            created_at, updated_at, password_salt, password_hash, password_changed_at,
            session_generation, session_started_at, auth_email, firebase_password_ready, firebase_agent_ready,
            web_session_generation, web_session_device_id, web_session_started_at,
            android_session_generation, android_session_device_id, android_session_started_at
          )
          SELECT
            user_id, firebase_uid, employee_code, display_name, role, role_override, status,
            created_at, updated_at, password_salt, password_hash, password_changed_at,
            session_generation, session_started_at, auth_email, firebase_password_ready, firebase_agent_ready,
            web_session_generation, web_session_device_id, web_session_started_at,
            android_session_generation, android_session_device_id, android_session_started_at
          FROM users;
          DROP TABLE users;
          ALTER TABLE users_d119 RENAME TO users;
          CREATE UNIQUE INDEX idx_users_employee_code
            ON users(employee_code)
            WHERE employee_code IS NOT NULL AND employee_code <> '';
          CREATE INDEX idx_users_role_status ON users(role, status);
        `);
      });
    }

    initializeBusinessSchema(this.state);
    initializeOperationalV2Schema(this.state);

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

  private async notificationTokens(roles: string[], userIds: string[]): Promise<string[]> {
    const result = await handleNotificationCoreRequest(
      this.state,
      new Request("https://inventory-core.internal/notifications/targets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roles, user_ids: userIds }),
      }),
    );
    if (!result?.ok) return [];
    const payload = (await result.json()) as { tokens?: string[] };
    return Array.isArray(payload.tokens) ? payload.tokens : [];
  }

  private async recordNotificationDelivery(
    eventId: string | null,
    event: string,
    attempts: Array<{ token: string; status: string; error_code: string | null }>,
    invalidTokens: string[],
  ): Promise<void> {
    if (attempts.length) {
      await handleNotificationCoreRequest(
        this.state,
        new Request("https://inventory-core.internal/notifications/delivery-attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event_id: eventId, event, attempts }),
        }),
      );
    }
    if (invalidTokens.length) {
      await handleNotificationCoreRequest(
        this.state,
        new Request("https://inventory-core.internal/notifications/disable-tokens", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tokens: invalidTokens }),
        }),
      );
    }
  }

  private async sendDeadlineFcm(
    effect: OperationalDeadlineEffect,
    roles: string[],
    userIds: string[],
    title = effect.title,
    body = effect.body,
    eventName: string = effect.event,
    correlateResult = true,
  ): Promise<void> {
    if (!this.env.GOOGLE_RUNTIME_SA_JSON || !this.env.FIREBASE_PROJECT_ID) return;
    if (!readAndroidAlertWindow(this.state).is_open) return;
    const tokens = await this.notificationTokens(roles, userIds);
    if (!tokens.length) return;
    const eventRow = this.state.storage.sql.exec<Record<string, SqlStorageValue>>(
      "SELECT seq, batch_version FROM realtime_events WHERE event_id = ? LIMIT 1",
      effect.event_id,
    ).toArray()[0];
    const delivery = await sendFcmNotifications(
      this.env.GOOGLE_RUNTIME_SA_JSON,
      this.env.FIREBASE_PROJECT_ID,
      tokens,
      {
        title,
        body,
        data: {
          event: eventName,
          batch_id: effect.batch_id,
          result_event_id: effect.result_event && correlateResult ? effect.event_id : "",
          event_seq: eventRow?.seq == null ? "" : String(eventRow.seq),
          batch_version: eventRow?.batch_version == null ? "" : String(eventRow.batch_version),
          source: "SYSTEM_DEADLINE",
        },
      },
    );
    await this.recordNotificationDelivery(
      effect.result_event && correlateResult ? effect.event_id : null,
      eventName,
      delivery.attempts.map((attempt) => ({
        token: attempt.token,
        status: attempt.status,
        error_code: attempt.error_code,
      })),
      delivery.invalidTokens,
    );
  }

  private async broadcastDeadlineEffect(effect: OperationalDeadlineEffect): Promise<void> {
    const tags = [
      ...effect.reporter_roles.map((role) => `role:${role}`),
      ...effect.picker_user_ids.map((userId) => `user:${userId}`),
    ];
    await handleReadModelCoreRequest(
      this.state,
      new Request("https://inventory-core.internal/realtime/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: effect.event,
          event_id: effect.event_id,
          scopes: effect.scopes,
          tags,
          batch_id: effect.batch_id,
          include_batch_picker_users: false,
          metadata: { source: "SYSTEM_DEADLINE" },
        }),
      }),
    );
  }

  private reporterSummary(effect: OperationalDeadlineEffect, count: number): { title: string; body: string; event: string } {
    if (count <= 1) return { title: effect.title, body: effect.body, event: effect.event };
    if (effect.event === "sla_warning") {
      return {
        title: "SUPRA Inventory · SKU sắp quá hạn",
        body: `${count} SKU vừa chuyển sang mức cảnh báo.`,
        event: "sla_warning_summary",
      };
    }
    if (effect.event === "sla_escalated") {
      return {
        title: "SUPRA Inventory · SKU quá hạn",
        body: `${count} SKU vừa chuyển sang quá hạn.`,
        event: "sla_escalated_summary",
      };
    }
    return {
      title: "SUPRA Inventory · Hệ thống cho phép bỏ qua",
      body: `${count} SKU vừa được hệ thống cho phép bỏ qua do quá thời gian phản hồi.`,
      event: "auto_skip_summary",
    };
  }

  async alarm(): Promise<void> {
    this.pruneAuditRetentionIfDue();
    // Authoritative state transitions and the next alarm schedule must not depend
    // on downstream realtime/FCM availability. Delivery is best-effort after the
    // committed transition, matching the notification contract.
    const effects = processOperationalDeadlines(this.state);
    await scheduleNextOperationalAlarm(this.state);

    for (const effect of effects) {
      try {
        await this.broadcastDeadlineEffect(effect);
      } catch {
        // Authoritative database state remains the source of truth; connected
        // clients recover through the normal cursor/reconcile path.
      }
    }

    // Critical Picker result and overdue notices preserve exact event identity.
    // Provider failure must not throw the alarm and cause platform retry storms.
    for (const effect of effects) {
      if (!effect.picker_user_ids.length) continue;
      try {
        await this.sendDeadlineFcm(effect, [], effect.picker_user_ids);
      } catch {
        // Best-effort background delivery; authoritative result remains queryable.
      }
    }

    // Reporter/Admin/Root background notifications are grouped per deadline level
    // to avoid alert storms when many SKU cross a threshold together.
    const grouped = new Map<string, OperationalDeadlineEffect[]>();
    for (const effect of effects) {
      const list = grouped.get(effect.event) || [];
      list.push(effect);
      grouped.set(effect.event, list);
    }
    for (const list of grouped.values()) {
      const firstEffect = list[0];
      if (!firstEffect?.reporter_roles.length) continue;
      const uniqueBatchCount = new Set(list.map((item) => item.batch_id)).size;
      const summary = this.reporterSummary(firstEffect, uniqueBatchCount);
      try {
        await this.sendDeadlineFcm(
          firstEffect,
          firstEffect.reporter_roles,
          [],
          summary.title,
          summary.body,
          summary.event,
          false,
        );
      } catch {
        // Background provider failure must not retry an already-committed alarm.
      }
    }
  }

  private pruneAuditRetentionIfDue(): void {
    const now = Date.now();
    if (now < this.nextAuditRetentionSweepAt) return;
    this.nextAuditRetentionSweepAt = now + 6 * 60 * 60_000;
    const cutoff = new Date(now - 90 * 86_400_000).toISOString();
    this.state.storage.sql.exec("DELETE FROM audit_log WHERE created_at < ?", cutoff);
  }

  private getSchemaVersion(): number {
    const row = this.state.storage.sql
      .exec<{ value: string }>("SELECT value FROM schema_meta WHERE key = 'schema_version' LIMIT 1")
      .one();
    return Number(row?.value || 0);
  }

  private getUserByUsername(username: string): InternalUser | null {
    const rows = this.state.storage.sql.exec<InternalUser>(
      `SELECT user_id, firebase_uid, employee_code, display_name,
              CASE
                WHEN role = 'ROOT' AND role_override IN ('PICKER','REPORTER','ADMIN') THEN role_override
                ELSE role
              END AS role,
              role AS base_role,
              role_override,
              status,
              password_salt, password_hash, password_changed_at,
              auth_email, firebase_password_ready, firebase_agent_ready,
              session_generation, session_started_at,
              web_session_generation, web_session_device_id, web_session_started_at,
              android_session_generation, android_session_device_id, android_session_started_at
         FROM users
        WHERE lower(employee_code) = lower(?) OR lower(user_id) = lower(?)
        LIMIT 1`,
      username,
      username,
    ).toArray();
    return rows[0] ?? null;
  }

  private getUserById(userId: string): InternalUser | null {
    const rows = this.state.storage.sql.exec<InternalUser>(
      `SELECT user_id, firebase_uid, employee_code, display_name,
              CASE
                WHEN role = 'ROOT' AND role_override IN ('PICKER','REPORTER','ADMIN') THEN role_override
                ELSE role
              END AS role,
              role AS base_role,
              role_override,
              status, password_salt, password_hash, password_changed_at,
              auth_email, firebase_password_ready, firebase_agent_ready,
              session_generation, session_started_at,
              web_session_generation, web_session_device_id, web_session_started_at,
              android_session_generation, android_session_device_id, android_session_started_at,
              created_at, updated_at
         FROM users
        WHERE user_id = ?
        LIMIT 1`,
      userId,
    ).toArray();
    return rows[0] ?? null;
  }

  private getUserByFirebaseUid(uid: string): InternalUser | null {
    const rows = this.state.storage.sql.exec<InternalUser>(
      `SELECT user_id, firebase_uid, employee_code, display_name,
              CASE
                WHEN role = 'ROOT' AND role_override IN ('PICKER','REPORTER','ADMIN') THEN role_override
                ELSE role
              END AS role,
              role AS base_role,
              role_override,
              status,
              password_salt, password_hash, password_changed_at,
              auth_email, firebase_password_ready, firebase_agent_ready,
              session_generation, session_started_at,
              web_session_generation, web_session_device_id, web_session_started_at,
              android_session_generation, android_session_device_id, android_session_started_at
         FROM users WHERE firebase_uid = ? LIMIT 1`,
      uid,
    ).toArray();
    return rows[0] ?? null;
  }

  async fetch(request: Request): Promise<Response> {
    this.pruneAuditRetentionIfDue();
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const root = this.getUserByUsername("root");
      const operationalV2 = operationalV2Readiness(this.state);
      return response({
        status: operationalV2.ready ? "ok" : "degraded",
        component: "durable-object-sqlite",
        environment: this.env.APP_ENV,
        schema_version: this.getSchemaVersion(),
        expected_schema_version: SCHEMA_VERSION,
        operational_v2: operationalV2,
        root_password_initialized: Boolean(root?.password_hash && root?.password_salt),
      }, operationalV2.ready ? 200 : 503);
    }

    if (request.method === "GET" && url.pathname === "/auth/user-by-username") {
      const username = (url.searchParams.get("username") || "").trim();
      return response({ user: username ? this.getUserByUsername(username) : null });
    }

    if (request.method === "GET" && url.pathname === "/auth/user-by-id") {
      const userId = (url.searchParams.get("user_id") || "").trim();
      return response({ user: userId ? this.getUserById(userId) : null });
    }

    if (request.method === "GET" && url.pathname === "/auth/user-by-firebase-uid") {
      const uid = (url.searchParams.get("uid") || "").trim();
      return response({ user: uid ? this.getUserByFirebaseUid(uid) : null });
    }

    if (request.method === "GET" && url.pathname === "/auth/firebase-migration-candidates") {
      const role = String(url.searchParams.get("role") || "").trim().toUpperCase();
      const channel = String(url.searchParams.get("channel") || "").trim().toUpperCase();
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)));
      if (!["ADMIN", "PICKPACK_ADMIN", "ROOT", "REPORTER", "PICKER"].includes(role)) {
        return response({ error: "invalid_role" }, 400);
      }
      if (channel && channel !== "AGENT") return response({ error: "invalid_channel" }, 400);
      const readinessColumn = channel === "AGENT" ? "firebase_agent_ready" : "firebase_password_ready";
      if (channel === "AGENT" && !["ADMIN", "PICKPACK_ADMIN"].includes(role)) return response({ error: "agent_operator_only" }, 400);
      const rows = this.state.storage.sql.exec<InternalUser>(
        `SELECT user_id, firebase_uid, employee_code, display_name,
                role AS role, role AS base_role, role_override, status,
                password_salt, password_hash, password_changed_at,
                auth_email, firebase_password_ready, firebase_agent_ready,
                session_generation, session_started_at,
                web_session_generation, web_session_device_id, web_session_started_at,
                android_session_generation, android_session_device_id, android_session_started_at
           FROM users
          WHERE role = ? AND status = 'ACTIVE'
            AND COALESCE(${readinessColumn}, 0) = 0
          ORDER BY user_id ASC
          LIMIT ?`,
        role,
        limit,
      ).toArray();
      return response({ items: rows, count: rows.length });
    }

    if (request.method === "PUT" && url.pathname === "/auth/firebase-agent-ready") {
      const body = (await request.json()) as { user_id?: string };
      const userId = String(body.user_id || "").trim();
      if (!userId) return response({ error: "invalid_input" }, 400);
      this.state.storage.sql.exec(
        `UPDATE users SET firebase_agent_ready = 1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND role IN ('ADMIN','PICKPACK_ADMIN')`,
        userId,
      );
      return response({ status: "firebase_agent_ready" });
    }

    if (request.method === "PUT" && url.pathname === "/auth/activate-session") {
      const body = (await request.json()) as {
        user_id?: string;
        channel?: string;
        device_id?: string;
        force?: boolean;
      };
      const userId = String(body.user_id || "").trim();
      const channel = String(body.channel || "").trim().toUpperCase();
      const deviceId = String(body.device_id || "").trim().slice(0, 160);
      if (!userId || !["WEB", "ANDROID"].includes(channel) || !deviceId) {
        return response({ error: "invalid_input" }, 400);
      }
      const columnPrefix = channel === "WEB" ? "web" : "android";
      const current = this.state.storage.sql.exec<{
        generation: number;
        device_id: string | null;
        started_at: string | null;
      }>(
        `SELECT ${columnPrefix}_session_generation AS generation,
                ${columnPrefix}_session_device_id AS device_id,
                ${columnPrefix}_session_started_at AS started_at
           FROM users WHERE user_id = ? LIMIT 1`,
        userId,
      ).toArray()[0];
      if (!current) return response({ error: "user_not_found" }, 404);
      if (
        current.device_id &&
        current.device_id !== deviceId &&
        !body.force
      ) {
        return response({
          error: "SESSION_ACTIVE_OTHER_DEVICE",
          channel,
          started_at: current.started_at,
        }, 409);
      }
      this.state.storage.sql.exec(
        `UPDATE users
            SET ${columnPrefix}_session_generation = COALESCE(${columnPrefix}_session_generation, 0) + 1,
                ${columnPrefix}_session_device_id = ?,
                ${columnPrefix}_session_started_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`,
        deviceId,
        userId,
      );
      const row = this.state.storage.sql.exec<{ generation: number }>(
        `SELECT ${columnPrefix}_session_generation AS generation
           FROM users WHERE user_id = ? LIMIT 1`,
        userId,
      ).toArray()[0];
      return response({
        session_generation: Number(row?.generation || 0),
        channel,
        replaced_other_device: Boolean(current.device_id && current.device_id !== deviceId),
      });
    }

    if (request.method === "PUT" && url.pathname === "/auth/end-session") {
      const body = (await request.json()) as {
        user_id?: string;
        channel?: string;
        generation?: number;
        device_id?: string;
      };
      const userId = String(body.user_id || "").trim();
      const channel = String(body.channel || "").trim().toUpperCase();
      const deviceId = String(body.device_id || "").trim().slice(0, 160);
      const generation = Number(body.generation || 0);
      if (!userId || !["WEB", "ANDROID"].includes(channel) || !deviceId || !Number.isFinite(generation) || generation <= 0) {
        return response({ error: "invalid_input" }, 400);
      }
      const prefix = channel === "WEB" ? "web" : "android";
      this.state.storage.sql.exec(
        `UPDATE users
            SET ${prefix}_session_device_id = NULL,
                ${prefix}_session_started_at = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
            AND ${prefix}_session_generation = ?
            AND ${prefix}_session_device_id = ?`,
        userId,
        Math.trunc(generation),
        deviceId,
      );
      return response({ status: "ended", channel });
    }

    if (request.method === "PUT" && url.pathname === "/auth/firebase-password-ready") {
      const body = (await request.json()) as { user_id?: string; firebase_uid?: string };
      const userId = String(body.user_id || "").trim();
      const uid = String(body.firebase_uid || "").trim();
      if (!userId || !uid) return response({ error: "invalid_input" }, 400);
      this.state.storage.sql.exec(
        `UPDATE users
            SET firebase_uid = ?,
                firebase_password_ready = 1,
                updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`,
        uid,
        userId,
      );
      return response({ status: "firebase_password_ready" });
    }

    if (request.method === "PUT" && url.pathname === "/auth/set-email") {
      const body = (await request.json()) as { user_id?: string; auth_email?: string };
      const userId = String(body.user_id || "").trim();
      const email = String(body.auth_email || "").trim().toLowerCase();
      if (!userId || !email) return response({ error: "invalid_input" }, 400);
      this.state.storage.sql.exec(
        "UPDATE users SET auth_email = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        email,
        userId,
      );
      return response({ status: "email_saved", user: this.getUserById(userId) });
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

    if (request.method === "PUT" && url.pathname === "/auth/root-role-override") {
      const body = (await request.json()) as { user_id?: string; role?: string };
      const userId = String(body.user_id || "").trim();
      const nextRole = String(body.role || "").trim().toUpperCase();
      if (!userId || !["ROOT", "ADMIN", "REPORTER", "PICKER"].includes(nextRole)) {
        return response({ error: "invalid_input" }, 400);
      }
      const base = this.state.storage.sql.exec<{ role: string }>(
        "SELECT role FROM users WHERE user_id = ? LIMIT 1",
        userId,
      ).toArray()[0];
      if (!base || String(base.role) !== "ROOT") return response({ error: "root_only" }, 403);
      this.state.storage.sql.exec(
        "UPDATE users SET role_override = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        nextRole === "ROOT" ? null : nextRole,
        userId,
      );
      return response({ user: this.getUserByUsername(userId) });
    }

    if (request.method === "PUT" && url.pathname === "/auth/set-password") {
      const body = (await request.json()) as { user_id?: string; password_salt?: string; password_hash?: string };
      if (!body.user_id || !body.password_salt || !body.password_hash) return response({ error: "invalid_input" }, 400);
      this.state.storage.sql.exec(
        `UPDATE users
            SET password_salt = ?,
                password_hash = ?,
                password_changed_at = CURRENT_TIMESTAMP,
                session_generation = COALESCE(session_generation, 0) + 1,
                session_started_at = CURRENT_TIMESTAMP,
                web_session_generation = COALESCE(web_session_generation, 0) + 1,
                web_session_device_id = NULL,
                web_session_started_at = NULL,
                android_session_generation = COALESCE(android_session_generation, 0) + 1,
                android_session_device_id = NULL,
                android_session_started_at = NULL,
                firebase_password_ready = 0,
                firebase_agent_ready = CASE WHEN role = 'ADMIN' THEN 0 ELSE firebase_agent_ready END,
                updated_at = CURRENT_TIMESTAMP
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

    const operationalV2 = await handleOperationalV2CoreRequest(this.state, request);
    if (operationalV2) return operationalV2;

    const skuImport = await handleSkuImportCoreRequest(this.state, request);
    if (skuImport) return skuImport;

    const archive = await handleArchiveCoreRequest(this.state, request);
    if (archive) return archive;

    const userManagement = await handleUserManagementCoreRequest(this.state, request);
    if (userManagement) return userManagement;

    const notifications = await handleNotificationCoreRequest(this.state, request);
    if (notifications) return notifications;

    const systemReset = await handleSystemResetCoreRequest(this.state, request);
    if (systemReset) return systemReset;

    const authRecovery = await handleAuthRecoveryCoreRequest(this.state, request);
    if (authRecovery) return authRecovery;

    const systemMetrics = await handleSystemMetricsCoreRequest(this.state, request);
    if (systemMetrics) return systemMetrics;

    const readModel = await handleReadModelCoreRequest(this.state, request);
    if (readModel) return readModel;

    const business = await handleBusinessRequest(this.state, request);
    if (business) return business;

    return response({ error: "not_found" }, 404);
  }
}
