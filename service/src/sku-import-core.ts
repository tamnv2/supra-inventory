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
  area?: unknown;
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
    expected_catalog_revision?: number;
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
    area: String(item.area ?? "").trim().toUpperCase(),
  }));
  const invalid = normalized.filter(
    (item) => !item.sku || !item.product_name || item.sku.length > 128 || item.product_name.length > 500 ||
      (item.area !== "" && item.area !== "LTA" && item.area !== "SHELVING"),
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

  const items = normalized.map(({ sku, product_name, area }) => ({ sku, product_name, area: area || undefined }));
  const sourceHash = String(body.source_hash || "").trim() || null;
  const plan = planChunk(state, items);
  const revisionRow = state.storage.sql.exec<{ revision: number }>("SELECT revision FROM d167_sku_meta WHERE id=1").toArray()[0];
  const catalogRevision = Number(revisionRow?.revision ?? 0);

  if (body.dry_run) {
    return response({
      status: "preview",
      catalog_revision: catalogRevision,
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

  if (body.expected_catalog_revision != null && Number(body.expected_catalog_revision) !== catalogRevision)
    return response({ error: "SKU_CATALOG_REVISION_CHANGED", catalog_revision: catalogRevision }, 409);
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
    // Repeat the revision fence *inside* the write transaction: a Web preview
    // may become stale while another Web/PRIMARY request commits.
    const actualRevision = Number(state.storage.sql.exec<{revision:number}>(
      "SELECT revision FROM d167_sku_meta WHERE id=1").toArray()[0]?.revision ?? 0);
    if (body.expected_catalog_revision != null &&
        Number(body.expected_catalog_revision) !== actualRevision)
      return { error:"SKU_CATALOG_REVISION_CHANGED",catalog_revision:actualRevision };

    const at = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const touched: string[] = [];
    const reactivated: string[] = [];

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
        touched.push(item.sku);
      } else if (existing.product_name === item.product_name) {
        const member = state.storage.sql.exec<{active:number}>(
          "SELECT active FROM d167_sku_active WHERE sku=?",item.sku).toArray()[0];
        if (member && Number(member.active) === 0) {
          reactivated.push(item.sku);
        } else {
          unchanged += 1;
        }
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
        touched.push(item.sku);
      }
    }

    // Web PATCH is day-scoped: only changed SKUs reactivate.
    // Same-field manual edits are recorded for source reconciliation.
    for (const sku of touched) {
      state.storage.sql.exec("INSERT INTO d167_sku_active (sku,active,area,area_verified,last_web_name_at) VALUES (?,1,'UNKNOWN',0,?) ON CONFLICT(sku) DO UPDATE SET active=1,last_web_name_at=excluded.last_web_name_at",sku,at);
    }
    for (const sku of reactivated) {
      state.storage.sql.exec("UPDATE d167_sku_active SET active=1 WHERE sku=? AND active=0",sku);
    }
    if (touched.length || reactivated.length)
      state.storage.sql.exec("UPDATE d167_sku_meta SET revision=revision+1,published_at=? WHERE id=1",at);

    if (inserted > 0 || updated > 0 || reactivated.length > 0) {
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
      reactivated: reactivated.length,
      catalog_revision: actualRevision + (touched.length || reactivated.length ? 1 : 0),
      source_hash: sourceHash,
      imported_at: at,
    };
    audit(state, actor, "SKU_IMPORT_CHUNK", requestId, payload, at);
    storeIdempotency(state, scope, requestId, payload, at);
    return payload;
  });

  if ("error" in result) return response(result,409);
  return response(result);
}

export async function handleSkuImportCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/business/skus/import-v2") {
    return importSkuChunk(state, request);
  }
  return null;
}
