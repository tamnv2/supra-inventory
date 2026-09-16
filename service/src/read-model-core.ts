type SqlRow = Record<string, SqlStorageValue>;

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

function limitOf(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function skuCatalogInfo(state: DurableObjectState): Response {
  const rows = state.storage.sql
    .exec<SqlRow>("SELECT COUNT(*) AS count, MAX(updated_at) AS max_updated_at FROM sku_master")
    .toArray();
  const row = rows[0] || {};
  const count = Number(row.count || 0);
  const maxUpdatedAt = String(row.max_updated_at || "");
  return response({ count, max_updated_at: maxUpdatedAt || null, version: `${count}:${maxUpdatedAt}` });
}

function skuCatalog(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"), 1000, 2000);
  const after = String(url.searchParams.get("after") || "");
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT sku, product_name, updated_at
         FROM sku_master
        WHERE sku > ?
        ORDER BY sku ASC
        LIMIT ?`,
      after,
      limit,
    )
    .toArray();
  const nextAfter = rows.length === limit ? String(rows[rows.length - 1]?.sku || "") : null;
  return response({ items: rows, count: rows.length, next_after: nextAfter, limit });
}

function reporterRecent(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"), 100, 200);
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT b.batch_id, b.sku, b.product_name, b.status, b.first_report_at,
              b.resolved_at, b.resolved_by_user_id, b.resolution, b.correction_deadline_at,
              COUNT(t.ticket_id) AS affected_picker_count
         FROM report_batches b
         LEFT JOIN report_tickets t ON t.batch_id = b.batch_id
        WHERE b.status IN ('HAS_STOCK','SKIP_ALLOWED')
        GROUP BY b.batch_id
        ORDER BY b.resolved_at DESC
        LIMIT ?`,
      limit,
    )
    .toArray();
  return response({ items: rows, count: rows.length });
}

function reporterBatchTickets(state: DurableObjectState, url: URL): Response {
  const batchId = String(url.searchParams.get("batch_id") || "").trim();
  if (!batchId) return response({ error: "BATCH_ID_REQUIRED" }, 400);
  const rows = state.storage.sql
    .exec<SqlRow>(
      `SELECT t.ticket_id, t.picker_user_id, t.picker_employee_code,
              COALESCE(u.display_name, '') AS picker_display_name,
              t.status, t.reported_at, t.withdraw_deadline_at, t.withdrawn_at, t.resolved_at
         FROM report_tickets t
         LEFT JOIN users u ON u.employee_code = t.picker_employee_code
        WHERE t.batch_id = ?
        ORDER BY t.reported_at ASC`,
      batchId,
    )
    .toArray();
  return response({ batch_id: batchId, items: rows, count: rows.length });
}

export async function handleReadModelCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/read/skus/catalog-info") return skuCatalogInfo(state);
  if (request.method === "GET" && url.pathname === "/read/skus/catalog") return skuCatalog(state, url);
  if (request.method === "GET" && url.pathname === "/read/reporter/recent") return reporterRecent(state, url);
  if (request.method === "GET" && url.pathname === "/read/reporter/batch-tickets") return reporterBatchTickets(state, url);
  return null;
}
