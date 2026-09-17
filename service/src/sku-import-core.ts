type SqlRow = Record<string, SqlStorageValue>;

type Actor = {
  user_id: string;
  employee_code: string | null;
};

interface SkuRow extends SqlRow {
  sku: string;
  product_name: string;
  source_hash: string | null;
}

interface IdempotencyRow extends SqlRow {
  response_json: string;
}

type SkuImportItem = {
  sku?: unknown;
  product_name?: unknown;
};

const MAX_CHUNK_ITEMS = 2000;
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,160}$/;

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

function normalizeSku(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeProductName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeRequestId(value: unknown): string | null {
  const requestId = String(value ?? "").trim();
  return REQUEST_ID_RE.test(requestId) ? requestId : null;
}

function firstRow<T extends SqlRow>(rows: T[]): T | null {
  return rows[0] ?? null;
}

function readIdempotency(state: DurableObjectState, scope: string, requestId: string): Record<string, unknown> | null {
  const row = firstRow(
    state.storage.sql
      .exec<IdempotencyRow>(
        "SELECT response_json FROM idempotency_keys WHERE scope = ? AND idempotency_key = ? LIMIT 1",
        scope,
        requestId,
      )
      .toArray(),
  );
  if (!row) return null;
  try {
    return JSON.parse(row.response_json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function storeIdempotency(
  state: DurableObjectState,
  scope: string,
  requestId: string,
  payload: Record<string, unknown>,
  createdAt: string,
): void {
  state.storage.sql.exec(
    `INSERT OR REPLACE INTO idempotency_keys (scope, idempotency_key, response_json, created_at)
     VALUES (?, ?, ?, ?)`,
    scope,
    requestId,
    JSON.stringify(payload),
    createdAt,
  );
}

function audit(
  state: DurableObjectState,
  actor: Actor,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>,
  createdAt: string,
): void {
  state.storage.sql.exec(
    `INSERT INTO audit_log (
       audit_id, actor_user_id, actor_employee_code, action, target_type, target_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, 'SKU_MASTER', ?, ?, ?)`,
    crypto.randomUUID(),
    actor.user_id,
    actor.employee_code,
    action,
    targetId,
    JSON.stringify(metadata),
    createdAt,
  );
}

function planChunk(state: DurableObjectState, items: Array<{ sku: string; product_name: string }>) {
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const conflicts: Array<{ sku: string; current_product_name: string; incoming_product_name: string }> = [];

  for (const item of items) {
    const existing = firstRow(
      state.storage.sql
        .exec<SkuRow>("SELECT sku, product_name, source_hash FROM sku_master WHERE sku = ? LIMIT 1", item.sku)
        .toArray(),
    );
    if (!existing) {
      inserted += 1;
    } else if (existing.product_name === item.product_name) {
      unchanged += 1;
    } else {
      updated += 1;
      conflicts.push({
        sku: item.sku,
        current_product_name: existing.product_name,
        incoming_product_name: item.product_name,
      });
    }
  }

  return { inserted, updated, unchanged, conflicts };
}

async function importSkuChunk(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    actor?: Actor;
    request_id?: string;
    source_hash?: string;
    dry_run?: boolean;
    confirm_name_changes?: boolean;
    items?: SkuImportItem[];
  };
  const actor = body.actor;
  const requestId = normalizeRequestId(body.request_id);
  if (!actor?.user_id || !requestId) return response({ error: "INVALID_INPUT" }, 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_CHUNK_ITEMS) {
    return response({ error: "INVALID_SKU_IMPORT_CHUNK_SIZE", max_items: MAX_CHUNK_ITEMS }, 400);
  }

  const normalized = body.items.map((item, index) => ({
    index,
    sku: normalizeSku(item.sku),
    product_name: normalizeProductName(item.product_name),
  }));
  const invalid = normalized.filter(
    (item) => !item.sku || !item.product_name || item.sku.length > 128 || item.product_name.length > 500,
  );
  if (invalid.length) {
    return response(
      {
        error: "INVALID_SKU_ROWS",
        invalid_count: invalid.length,
        rows: invalid.slice(0, 100).map((item) => item.index + 1),
      },
      400,
    );
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of normalized) {
    if (seen.has(item.sku)) duplicates.add(item.sku);
    seen.add(item.sku);
  }
  if (duplicates.size) {
    return response({ error: "DUPLICATE_SKU_IN_CHUNK", skus: [...duplicates].slice(0, 100) }, 400);
  }

  const items = normalized.map(({ sku, product_name }) => ({ sku, product_name }));
  const sourceHash = String(body.source_hash || "").trim() || null;
  const plan = planChunk(state, items);

  if (body.dry_run) {
    return response({
      status: "preview",
      total: items.length,
      inserted: plan.inserted,
      updated: plan.updated,
      unchanged: plan.unchanged,
      conflict_count: plan.conflicts.length,
      requires_confirmation: plan.conflicts.length > 0,
      conflicts: plan.conflicts,
      source_hash: sourceHash,
    });
  }

  if (plan.conflicts.length > 0 && !body.confirm_name_changes) {
    return response(
      {
        error: "SKU_NAME_CHANGES_REQUIRE_CONFIRMATION",
        total: items.length,
        inserted: plan.inserted,
        updated: plan.updated,
        unchanged: plan.unchanged,
        conflict_count: plan.conflicts.length,
        conflicts: plan.conflicts,
      },
      409,
    );
  }

  const result = state.storage.transactionSync(() => {
    const scope = `sku_import_v2:${actor.user_id}`;
    const replay = readIdempotency(state, scope, requestId);
    if (replay) return { ...replay, idempotent_replay: true };

    const at = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const item of items) {
      const existing = firstRow(
        state.storage.sql
          .exec<SkuRow>("SELECT sku, product_name, source_hash FROM sku_master WHERE sku = ? LIMIT 1", item.sku)
          .toArray(),
      );
      if (!existing) {
        state.storage.sql.exec(
          `INSERT INTO sku_master (sku, product_name, source_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          item.sku,
          item.product_name,
          sourceHash,
          at,
          at,
        );
        inserted += 1;
      } else if (existing.product_name === item.product_name) {
        unchanged += 1;
      } else {
        state.storage.sql.exec(
          `UPDATE sku_master
              SET product_name = ?, source_hash = ?, updated_at = ?
            WHERE sku = ?`,
          item.product_name,
          sourceHash,
          at,
          item.sku,
        );
        updated += 1;
      }
    }

    if (inserted > 0 || updated > 0) {
      const meta = state.storage.sql.exec<SqlRow>("SELECT item_count FROM sku_catalog_meta WHERE id = 1 LIMIT 1").toArray()[0];
      if (!meta) {
        state.storage.sql.exec(
          `INSERT INTO sku_catalog_meta (id, item_count, max_updated_at)
           SELECT 1, COUNT(*), MAX(updated_at) FROM sku_master`,
        );
      } else {
        state.storage.sql.exec(
          `UPDATE sku_catalog_meta
              SET item_count = item_count + ?, max_updated_at = ?
            WHERE id = 1`,
          inserted,
          at,
        );
      }
    }

    const payload = {
      status: "imported",
      total: items.length,
      inserted,
      updated,
      unchanged,
      source_hash: sourceHash,
      imported_at: at,
    };
    audit(state, actor, "SKU_IMPORT_CHUNK", requestId, payload, at);
    storeIdempotency(state, scope, requestId, payload, at);
    return payload;
  });

  return response(result);
}

export async function handleSkuImportCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/business/skus/import-v2") {
    return importSkuChunk(state, request);
  }
  return null;
}
