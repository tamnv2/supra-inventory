type InternalEnv = {
  APP_ENV: string;
  INVENTORY_CORE: DurableObjectNamespace;
};

type CoreUser = {
  user_id: string;
  employee_code: string | null;
  display_name: string;
  role: string;
  base_role: string;
  status: string;
};

const EXPECTED_RUNTIME_EMAIL = "inventory-beta-alert-runtime@supra-inventory-beta.iam.gserviceaccount.com";
const EXPECTED_AUDIENCE = "https://inventory-beta.supra.cc.cd";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function verifyRuntimeIdentity(request: Request, env: InternalEnv): Promise<boolean> {
  if (env.APP_ENV !== "beta") return false;
  const token = bearer(request);
  if (!token || token.length > 8192) return false;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    exp?: string;
  };
  const exp = Number(payload.exp || 0);
  return payload.aud === EXPECTED_AUDIENCE
    && payload.email === EXPECTED_RUNTIME_EMAIL
    && (payload.email_verified === "true" || payload.email_verified === true)
    && Number.isFinite(exp)
    && exp * 1000 > Date.now();
}

function core(env: InternalEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

async function coreUser(env: InternalEnv, userId: string): Promise<CoreUser | null> {
  const response = await core(env).fetch(
    `https://inventory-core.internal/auth/user-by-id?user_id=${encodeURIComponent(userId)}`,
  );
  if (!response.ok) return null;
  return ((await response.json()) as { user?: CoreUser | null }).user || null;
}

async function coreSkuImport(
  env: InternalEnv,
  body: Record<string, unknown>,
): Promise<{ response: Response; payload: Record<string, unknown> }> {
  const response = await core(env).fetch("https://inventory-core.internal/business/skus/import-v2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: Record<string, unknown> = {};
  try { payload = (await response.json()) as Record<string, unknown>; } catch { payload = {}; }
  return { response, payload };
}

export async function handleD119Internal(request: Request, env: InternalEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/api/internal/d119/sku-sync") return null;
  if (!(await verifyRuntimeIdentity(request, env))) return json({ error: "INTERNAL_IDENTITY_REQUIRED" }, 401);

  let body: {
    job_id?: unknown;
    actor_user_id?: unknown;
    source_hash?: unknown;
    confirm_name_changes?: unknown;
    items?: Array<{ sku?: unknown; product_name?: unknown }>;
  };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "INVALID_JSON" }, 400); }

  const jobId = String(body.job_id || "").trim();
  const actorUserId = String(body.actor_user_id || "").trim();
  const confirmNameChanges = body.confirm_name_changes === true;
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(jobId) || !actorUserId) {
    return json({ error: "INVALID_SYNC_IDENTITY" }, 400);
  }

  const actor = await coreUser(env, actorUserId);
  if (!actor || actor.status !== "ACTIVE" || actor.role !== "ADMIN" || actor.base_role !== "ADMIN") {
    return json({ error: "WMS_SYNC_ADMIN_REQUIRED" }, 403);
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length < 1 || rawItems.length > 1000) return json({ error: "INVALID_ITEM_COUNT" }, 400);

  const bySku = new Map<string, string>();
  const inconsistent: string[] = [];
  for (const row of rawItems) {
    const sku = String(row?.sku || "").trim();
    const productName = String(row?.product_name || "").trim().replace(/\s+/g, " ");
    if (!sku || !productName || sku.length > 128 || productName.length > 500) {
      return json({ error: "INVALID_SKU_ITEM" }, 400);
    }
    const prior = bySku.get(sku);
    if (prior && prior !== productName) inconsistent.push(sku);
    else bySku.set(sku, productName);
  }
  if (inconsistent.length) {
    return json({ error: "WMS_SOURCE_NAME_CONFLICT", skus: [...new Set(inconsistent)].slice(0, 100) }, 409);
  }
  const items = [...bySku.entries()].map(([sku, product_name]) => ({ sku, product_name }));
  const actorBody = { user_id: actor.user_id, employee_code: actor.employee_code };
  const sourceHash = String(body.source_hash || "").trim() || `wms-bin:${jobId}`;

  const preview = await coreSkuImport(env, {
    actor: actorBody,
    request_id: `job:${jobId}:preview`,
    source_hash: sourceHash,
    dry_run: true,
    confirm_name_changes: false,
    items,
  });
  if (!preview.response.ok) return json({ error: "SKU_PREVIEW_FAILED", detail: preview.payload }, preview.response.status);

  const conflicts = Array.isArray(preview.payload.conflicts)
    ? preview.payload.conflicts as Array<{ sku?: unknown; current_product_name?: unknown; incoming_product_name?: unknown }>
    : [];
  const conflictSkus = new Set(conflicts.map((item) => String(item.sku || "")));
  const applyItems = confirmNameChanges ? items : items.filter((item) => !conflictSkus.has(item.sku));

  let applied: Record<string, unknown> = {
    status: "imported",
    total: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };
  if (applyItems.length > 0) {
    const result = await coreSkuImport(env, {
      actor: actorBody,
      request_id: `job:${jobId}:${confirmNameChanges ? "confirmed" : "safe"}`,
      source_hash: sourceHash,
      confirm_name_changes: confirmNameChanges,
      items: applyItems,
    });
    if (!result.response.ok) return json({ error: "SKU_IMPORT_FAILED", detail: result.payload }, result.response.status);
    applied = result.payload;
  }

  return json({
    status: conflicts.length > 0 && !confirmNameChanges ? "awaiting_confirmation" : "done",
    received: items.length,
    applied: applyItems.length,
    inserted: Number(applied.inserted || 0),
    updated: Number(applied.updated || 0),
    unchanged: Number(applied.unchanged || 0),
    conflict_count: conflicts.length,
    conflicts: conflicts.map((item) => ({
      sku: String(item.sku || ""),
      current_product_name: String(item.current_product_name || ""),
      incoming_product_name: String(item.incoming_product_name || ""),
    })),
  });
}
