type SqlRow = Record<string, SqlStorageValue>;

function first<T extends SqlRow>(rows: T[]): T | null {
  return rows[0] ?? null;
}

function count(state: DurableObjectState, table: string, where = "", args: SqlStorageValue[] = []): number {
  const row = first(state.storage.sql.exec<SqlRow>(`SELECT COUNT(*) AS n FROM ${table} ${where}`, ...args).toArray());
  return Number(row?.n || 0);
}

function groupedCount(state: DurableObjectState, sql: string, ...args: SqlStorageValue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of state.storage.sql.exec<SqlRow>(sql, ...args).toArray()) {
    const key = String(row.key || row.role || row.status || row.platform || "UNKNOWN");
    out[key] = Number(row.n || 0);
  }
  return out;
}

function realtimePresence(state: DurableObjectState): {
  online_users: number;
  online_sessions: number;
  by_role: Record<string, number>;
  by_client: Record<string, number>;
} {
  const sessions = state.getWebSockets();
  const users = new Set<string>();
  const roleUsers = new Map<string, Set<string>>();
  const clientUsers = new Map<string, Set<string>>();
  let validSessions = 0;
  for (const socket of sessions) {
    const attachment = socket.deserializeAttachment() as { user_id?: string; role?: string; client_type?: string } | null;
    if (!attachment?.user_id) continue;
    validSessions += 1;
    users.add(attachment.user_id);
    const role = String(attachment.role || "UNKNOWN");
    const client = String(attachment.client_type || "UNKNOWN");
    if (!roleUsers.has(role)) roleUsers.set(role, new Set());
    if (!clientUsers.has(client)) clientUsers.set(client, new Set());
    roleUsers.get(role)!.add(attachment.user_id);
    clientUsers.get(client)!.add(attachment.user_id);
  }
  return {
    online_users: users.size,
    online_sessions: validSessions,
    by_role: Object.fromEntries([...roleUsers.entries()].map(([key, value]) => [key, value.size])),
    by_client: Object.fromEntries([...clientUsers.entries()].map(([key, value]) => [key, value.size])),
  };
}

export function handleSystemMetricsCoreRequest(state: DurableObjectState, request: Request): Response | null {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/admin/system-metrics") {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const since10m = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    const accountRoles = groupedCount(
      state,
      `SELECT role AS key, COUNT(*) AS n FROM users GROUP BY role ORDER BY role`,
    );
    const accountStatus = groupedCount(
      state,
      `SELECT status AS key, COUNT(*) AS n FROM users GROUP BY status ORDER BY status`,
    );
    const firebaseLinked = count(state, "users", "WHERE firebase_uid IS NOT NULL AND firebase_uid <> ''");
    const batchStatus = groupedCount(
      state,
      `SELECT status AS key, COUNT(*) AS n FROM report_batches GROUP BY status ORDER BY status`,
    );
    const ticketStatus = groupedCount(
      state,
      `SELECT status AS key, COUNT(*) AS n FROM report_tickets GROUP BY status ORDER BY status`,
    );
    const devicePlatforms = groupedCount(
      state,
      `SELECT platform AS key, COUNT(*) AS n FROM fcm_devices WHERE enabled = 1 GROUP BY platform ORDER BY platform`,
    );
    const delivery24h = groupedCount(
      state,
      `SELECT status AS key, COUNT(*) AS n
         FROM notification_delivery_attempts
        WHERE created_at >= ?
        GROUP BY status ORDER BY status`,
      since24h,
    );
    const recentReportEvents = groupedCount(
      state,
      `SELECT event_type AS key, COUNT(*) AS n
         FROM report_events
        WHERE created_at >= ?
        GROUP BY event_type ORDER BY event_type`,
      since24h,
    );

    const realtimeSeq = first(
      state.storage.sql.exec<SqlRow>(
        `SELECT COALESCE(MIN(seq),0) AS min_seq,
                COALESCE(MAX(seq),0) AS max_seq,
                COUNT(*) AS n
           FROM realtime_events`,
      ).toArray(),
    ) || {};

    const archiveCheckpoint = first(
      state.storage.sql.exec<SqlRow>(
        `SELECT stream_name, cursor_value, last_exported_at, last_success_at, last_error, updated_at
           FROM archive_checkpoints
          ORDER BY updated_at DESC
          LIMIT 1`,
      ).toArray(),
    );

    const hrSource = first(
      state.storage.sql.exec<SqlRow>(
        `SELECT sheet_id, tab_name, data_row_count, verified_at, updated_at
           FROM hr_source_config
          WHERE id = 1
          LIMIT 1`,
      ).toArray(),
    );

    const reports10m = count(state, "report_tickets", "WHERE reported_at >= ?", [since10m]);
    const reports24h = count(state, "report_tickets", "WHERE reported_at >= ?", [since24h]);
    const audit24h = count(state, "audit_log", "WHERE created_at >= ?", [since24h]);

    const tableRows: Record<string, number> = {
      users: count(state, "users"),
      sku_master: count(state, "sku_master"),
      report_batches: count(state, "report_batches"),
      report_tickets: count(state, "report_tickets"),
      report_events: count(state, "report_events"),
      realtime_events: count(state, "realtime_events"),
      result_acknowledgements: count(state, "result_acknowledgements"),
      result_event_snapshots: count(state, "result_event_snapshots"),
      fcm_devices: count(state, "fcm_devices"),
      notification_delivery_attempts: count(state, "notification_delivery_attempts"),
      archive_exports: count(state, "archive_exports"),
      audit_log: count(state, "audit_log"),
    };

    const lastLoadTestRow = first(
      state.storage.sql.exec<SqlRow>(
        `SELECT value_json, updated_at, updated_by
           FROM app_config
          WHERE key = 'beta_load_test_last_v1'
          LIMIT 1`,
      ).toArray(),
    );
    let lastLoadTest: unknown = null;
    if (lastLoadTestRow?.value_json) {
      try { lastLoadTest = JSON.parse(String(lastLoadTestRow.value_json)); }
      catch { lastLoadTest = null; }
    }

    return new Response(JSON.stringify({
      generated_at: now.toISOString(),
      sqlite: {
        database_size_bytes: state.storage.sql.databaseSize,
        table_rows: tableRows,
      },
      accounts: {
        total: tableRows.users,
        by_role: accountRoles,
        by_status: accountStatus,
        firebase_linked: firebaseLinked,
      },
      business: {
        sku_count: tableRows.sku_master,
        batches_by_status: batchStatus,
        tickets_by_status: ticketStatus,
        reports_last_10_minutes: reports10m,
        reports_last_24_hours: reports24h,
        report_events_last_24_hours: recentReportEvents,
        audit_events_last_24_hours: audit24h,
      },
      realtime: {
        ...realtimePresence(state),
        retained_events: Number(realtimeSeq.n || 0),
        min_seq: Number(realtimeSeq.min_seq || 0),
        max_seq: Number(realtimeSeq.max_seq || 0),
      },
      notifications: {
        active_devices: Number(devicePlatforms.ANDROID || 0) + Number(devicePlatforms.WEB || 0),
        active_by_platform: devicePlatforms,
        delivery_last_24_hours: delivery24h,
      },
      archive: {
        exported_batches: tableRows.archive_exports,
        checkpoint: archiveCheckpoint,
      },
      last_load_test: lastLoadTest,
      hr_source: hrSource ? {
        configured: true,
        sheet_id: String(hrSource.sheet_id || ""),
        tab_name: String(hrSource.tab_name || ""),
        data_row_count: Number(hrSource.data_row_count || 0),
        verified_at: hrSource.verified_at,
        updated_at: hrSource.updated_at,
      } : { configured: false },
    }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (request.method === "POST" && url.pathname === "/admin/load-test/result") {
    return request.json().then((raw) => {
      const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      const allowed = {
        test_id: String(body.test_id || "").slice(0, 128),
        started_at: String(body.started_at || "").slice(0, 64),
        completed_at: String(body.completed_at || "").slice(0, 64),
        duration_seconds: Number(body.duration_seconds || 0),
        requested_reports: Number(body.requested_reports || 0),
        successful_reports: Number(body.successful_reports || 0),
        failed_reports: Number(body.failed_reports || 0),
        picker_count: Number(body.picker_count || 0),
        sku_count: Number(body.sku_count || 0),
        unique_skus_reported: Number(body.unique_skus_reported || 0),
        average_ms: Number(body.average_ms || 0),
        p50_ms: Number(body.p50_ms || 0),
        p95_ms: Number(body.p95_ms || 0),
        max_ms: Number(body.max_ms || 0),
        http_status_counts: body.http_status_counts && typeof body.http_status_counts === "object" ? body.http_status_counts : {},
        error_counts: body.error_counts && typeof body.error_counts === "object" ? body.error_counts : {},
        before: body.before && typeof body.before === "object" ? body.before : {},
        after: body.after && typeof body.after === "object" ? body.after : {},
        delta: body.delta && typeof body.delta === "object" ? body.delta : {},
      };
      const at = new Date().toISOString();
      state.storage.sql.exec(
        `INSERT INTO app_config (key, value_json, updated_at, updated_by)
         VALUES ('beta_load_test_last_v1', ?, ?, 'github-actions-load-test')
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        JSON.stringify(allowed),
        at,
      );
      return new Response(JSON.stringify({ status: "saved", updated_at: at }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }).catch(() => new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    }));
  }

  if (request.method === "GET" && url.pathname === "/admin/load-test/candidates") {
    const pickerLimit = Math.max(1, Math.min(200, Number(url.searchParams.get("pickers") || 100)));
    const skuLimit = Math.max(1, Math.min(1000, Number(url.searchParams.get("skus") || 400)));
    const pickers = state.storage.sql.exec<SqlRow>(
      `SELECT user_id, firebase_uid, employee_code, display_name
         FROM users
        WHERE role = 'PICKER'
          AND status = 'ACTIVE'
          AND employee_code IS NOT NULL
          AND employee_code <> ''
        ORDER BY RANDOM()
        LIMIT ?`,
      pickerLimit,
    ).toArray();
    const skus = state.storage.sql.exec<SqlRow>(
      `SELECT sku, product_name
         FROM sku_master
        ORDER BY RANDOM()
        LIMIT ?`,
      skuLimit,
    ).toArray();
    return new Response(JSON.stringify({
      pickers,
      skus,
      picker_count: pickers.length,
      sku_count: skus.length,
    }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return null;
}
