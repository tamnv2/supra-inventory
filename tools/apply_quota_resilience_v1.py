#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "service/src"
ANDROID = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta"
STATE = ROOT / "ops/project-state.json"
REGISTRY = ROOT / "ops/resource-registry.json"
DECISIONS = ROOT / "docs/OWNER_DECISIONS.md"
DOCS = ROOT / "docs"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL {label}: expected 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def patch_core() -> None:
    path = SERVICE / "core.ts"
    replace_once(path, "const SCHEMA_VERSION = 4;", "const SCHEMA_VERSION = 5;", "schema-v5")
    replace_once(
        path,
        '''      CREATE INDEX IF NOT EXISTS idx_sku_master_product_name ON sku_master(product_name);\n''',
        '''      CREATE INDEX IF NOT EXISTS idx_sku_master_product_name ON sku_master(product_name);\n      CREATE INDEX IF NOT EXISTS idx_sku_master_updated_at_sku ON sku_master(updated_at, sku);\n\n      CREATE TABLE IF NOT EXISTS sku_catalog_meta (\n        id INTEGER PRIMARY KEY CHECK (id = 1),\n        item_count INTEGER NOT NULL DEFAULT 0,\n        max_updated_at TEXT\n      );\n''',
        "sku-delta-index-meta",
    )
    replace_once(
        path,
        '''      CREATE INDEX IF NOT EXISTS idx_report_batches_sku_status ON report_batches(sku, status);\n''',
        '''      CREATE INDEX IF NOT EXISTS idx_report_batches_sku_status ON report_batches(sku, status);\n      CREATE INDEX IF NOT EXISTS idx_report_batches_first_report_at_status ON report_batches(first_report_at, status);\n      CREATE INDEX IF NOT EXISTS idx_report_batches_resolved_at_status ON report_batches(resolved_at, status);\n''',
        "batch-reporting-indexes",
    )
    replace_once(
        path,
        '''      CREATE INDEX IF NOT EXISTS idx_report_tickets_batch ON report_tickets(batch_id, status, reported_at);\n''',
        '''      CREATE INDEX IF NOT EXISTS idx_report_tickets_batch ON report_tickets(batch_id, status, reported_at);\n      CREATE INDEX IF NOT EXISTS idx_report_tickets_reported_at_batch ON report_tickets(reported_at, batch_id, picker_employee_code);\n''',
        "ticket-reporting-index",
    )
    anchor = '''    if (!this.hasColumn("users", "password_salt")) sql.exec("ALTER TABLE users ADD COLUMN password_salt TEXT");'''
    addition = '''    const catalogMeta = sql.exec<{ id: number }>("SELECT id FROM sku_catalog_meta WHERE id = 1 LIMIT 1").toArray()[0];
    if (!catalogMeta) {
      sql.exec(
        `INSERT INTO sku_catalog_meta (id, item_count, max_updated_at)
         SELECT 1, COUNT(*), MAX(updated_at) FROM sku_master`,
      );
    }

''' + anchor
    replace_once(path, anchor, addition, "catalog-meta-bootstrap")


def patch_sku_import() -> None:
    path = SERVICE / "sku-import-core.ts"
    anchor = '''    const payload = {
      status: "imported",'''
    addition = '''    if (inserted > 0 || updated > 0) {
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

''' + anchor
    replace_once(path, anchor, addition, "catalog-meta-update")


def patch_read_model() -> None:
    path = SERVICE / "read-model-core.ts"
    old_info = '''function skuCatalogInfo(state: DurableObjectState): Response {
  const rows = state.storage.sql
    .exec<SqlRow>("SELECT COUNT(*) AS count, MAX(updated_at) AS max_updated_at FROM sku_master")
    .toArray();
  const row = rows[0] || {};
  const count = Number(row.count || 0);
  const maxUpdatedAt = String(row.max_updated_at || "");
  return response({ count, max_updated_at: maxUpdatedAt || null, version: `${count}:${maxUpdatedAt}` });
}
'''
    new_info = '''function skuCatalogInfo(state: DurableObjectState): Response {
  let row = state.storage.sql
    .exec<SqlRow>("SELECT item_count AS count, max_updated_at FROM sku_catalog_meta WHERE id = 1 LIMIT 1")
    .toArray()[0];
  if (!row) {
    row = state.storage.sql.exec<SqlRow>("SELECT COUNT(*) AS count, MAX(updated_at) AS max_updated_at FROM sku_master").toArray()[0] || {};
  }
  const count = Number(row.count || 0);
  const maxUpdatedAt = String(row.max_updated_at || "");
  return response({ count, max_updated_at: maxUpdatedAt || null, version: `${count}:${maxUpdatedAt}` });
}
'''
    replace_once(path, old_info, new_info, "catalog-info-meta")

    anchor = '''function reporterRecent(state: DurableObjectState, url: URL): Response {'''
    delta = '''function skuCatalogDelta(state: DurableObjectState, url: URL): Response {
  const limit = limitOf(url.searchParams.get("limit"), 1000, 2000);
  const since = String(url.searchParams.get("since") || "").trim();
  const afterUpdatedAt = String(url.searchParams.get("after_updated_at") || since).trim();
  const afterSku = String(url.searchParams.get("after_sku") || "").trim();
  if (!since || !afterUpdatedAt) return response({ error: "CATALOG_DELTA_CURSOR_REQUIRED" }, 400);
  const rows = state.storage.sql.exec<SqlRow>(
    `SELECT sku, product_name, updated_at
       FROM sku_master
      WHERE updated_at > ? OR (updated_at = ? AND sku > ?)
      ORDER BY updated_at ASC, sku ASC
      LIMIT ?`,
    afterUpdatedAt, afterUpdatedAt, afterSku, limit,
  ).toArray();
  const last = rows[rows.length - 1];
  const hasNext = rows.length === limit;
  return response({
    items: rows,
    count: rows.length,
    since,
    next_updated_at: hasNext && last ? String(last.updated_at || "") : null,
    next_sku: hasNext && last ? String(last.sku || "") : null,
    limit,
  });
}

''' + anchor
    replace_once(path, anchor, delta, "catalog-delta-function")
    replace_once(
        path,
        '''  if (request.method === "GET" && url.pathname === "/read/skus/catalog") return skuCatalog(state, url);\n''',
        '''  if (request.method === "GET" && url.pathname === "/read/skus/catalog") return skuCatalog(state, url);\n  if (request.method === "GET" && url.pathname === "/read/skus/catalog-delta") return skuCatalogDelta(state, url);\n''',
        "catalog-delta-core-route",
    )


def patch_read_api() -> None:
    path = SERVICE / "read-api.ts"
    anchor = '''  if (url.pathname === "/api/reporter/recent") {'''
    route = '''  if (url.pathname === "/api/skus/catalog-delta") {
    await requireUser(request, env);
    const params = new URLSearchParams();
    for (const name of ["since", "after_updated_at", "after_sku", "limit"]) {
      if (url.searchParams.has(name)) params.set(name, url.searchParams.get(name) || "");
    }
    return core(env).fetch(`https://inventory-core.internal/read/skus/catalog-delta?${params.toString()}`);
  }

''' + anchor
    replace_once(path, anchor, route, "catalog-delta-public-route")


def patch_android_api() -> None:
    path = ANDROID / "InventoryApi.kt"
    anchor = '''data class PickerReport('''
    models = '''data class CatalogDeltaPage(
    val items: List<SkuItem>,
    val nextUpdatedAt: String?,
    val nextSku: String?,
)

''' + anchor
    replace_once(path, anchor, models, "android-delta-model")
    anchor2 = '''    fun createPickerReport(sku: String): JSONObject ='''
    method = '''    fun getCatalogDelta(since: String, afterUpdatedAt: String, afterSku: String, limit: Int = 2000): CatalogDeltaPage {
        val path = "/api/skus/catalog-delta?since=${enc(since)}&after_updated_at=${enc(afterUpdatedAt)}&after_sku=${enc(afterSku)}&limit=$limit"
        val payload = request("GET", path)
        val array = payload.optJSONArray("items") ?: JSONArray()
        val items = ArrayList<SkuItem>(array.length())
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val sku = row.optString("sku").trim()
            val name = row.optString("product_name").trim()
            if (sku.isNotBlank() && name.isNotBlank()) items += SkuItem(sku, name)
        }
        return CatalogDeltaPage(
            items = items,
            nextUpdatedAt = payload.optString("next_updated_at").takeIf { it.isNotBlank() && it != "null" },
            nextSku = payload.optString("next_sku").takeIf { it.isNotBlank() && it != "null" },
        )
    }

''' + anchor2
    replace_once(path, anchor2, method, "android-delta-method")


def patch_android_cache() -> None:
    path = ANDROID / "SkuCatalogCache.kt"
    old = '''        val downloaded = ArrayList<SkuItem>(info.count.coerceAtLeast(16))
        var after = ""
        while (true) {
            val page = api.getCatalogPage(after = after, limit = 2000)
            if (page.items.isEmpty()) {
                if (page.nextAfter != null) throw IllegalStateException("Catalog pagination không hợp lệ.")
                break
            }
            downloaded.addAll(page.items)
            progress(downloaded.size, info.count)
            val next = page.nextAfter ?: break
            if (next <= after) throw IllegalStateException("Catalog cursor không tiến lên.")
            after = next
        }

        if (downloaded.size != info.count) {
            throw IllegalStateException("Catalog tải thiếu: ${downloaded.size}/${info.count} SKU. Cache cũ được giữ nguyên.")
        }

        saveAtomic(downloaded, info.version)
        items = downloaded
        return CatalogSyncResult(updated = true, count = downloaded.size, version = info.version)
'''
    new = '''        val oldWatermark = currentVersion.substringAfter(':', "").trim()
        if (cacheFile.exists() && items.isNotEmpty() && currentVersion.isNotBlank() && oldWatermark.isNotBlank() && items.size <= info.count) {
            val merged = HashMap<String, SkuItem>(items.size + 64)
            for (item in items) merged[item.sku] = item
            var afterUpdatedAt = oldWatermark
            var afterSku = ""
            var deltaLoaded = 0
            while (true) {
                val page = api.getCatalogDelta(
                    since = oldWatermark,
                    afterUpdatedAt = afterUpdatedAt,
                    afterSku = afterSku,
                    limit = 2000,
                )
                for (item in page.items) merged[item.sku] = item
                deltaLoaded += page.items.size
                progress((items.size + deltaLoaded).coerceAtMost(info.count), info.count)
                val nextUpdatedAt = page.nextUpdatedAt ?: break
                val nextSku = page.nextSku ?: throw IllegalStateException("Catalog delta cursor thiếu SKU.")
                if (nextUpdatedAt < afterUpdatedAt || (nextUpdatedAt == afterUpdatedAt && nextSku <= afterSku)) {
                    throw IllegalStateException("Catalog delta cursor không tiến lên.")
                }
                afterUpdatedAt = nextUpdatedAt
                afterSku = nextSku
            }
            val deltaMerged = merged.values.sortedBy { it.sku }
            if (deltaMerged.size == info.count) {
                saveAtomic(deltaMerged, info.version)
                items = deltaMerged
                return CatalogSyncResult(updated = true, count = deltaMerged.size, version = info.version)
            }
        }

        // Bootstrap/fallback only: a fresh device or corrupt/incomplete cache downloads the full catalog.
        val downloaded = ArrayList<SkuItem>(info.count.coerceAtLeast(16))
        var after = ""
        while (true) {
            val page = api.getCatalogPage(after = after, limit = 2000)
            if (page.items.isEmpty()) {
                if (page.nextAfter != null) throw IllegalStateException("Catalog pagination không hợp lệ.")
                break
            }
            downloaded.addAll(page.items)
            progress(downloaded.size, info.count)
            val next = page.nextAfter ?: break
            if (next <= after) throw IllegalStateException("Catalog cursor không tiến lên.")
            after = next
        }

        if (downloaded.size != info.count) {
            throw IllegalStateException("Catalog tải thiếu: ${downloaded.size}/${info.count} SKU. Cache cũ được giữ nguyên.")
        }

        saveAtomic(downloaded, info.version)
        items = downloaded
        return CatalogSyncResult(updated = true, count = downloaded.size, version = info.version)
'''
    replace_once(path, old, new, "android-delta-cache")


def write_guard_and_docs() -> None:
    (ROOT / "tools/quota_resilience_guard.py").write_text('''#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
checks = {
  "schema_v5": "const SCHEMA_VERSION = 5;" in (ROOT/"service/src/core.ts").read_text(),
  "catalog_meta": "sku_catalog_meta" in (ROOT/"service/src/core.ts").read_text(),
  "sku_delta_index": "idx_sku_master_updated_at_sku" in (ROOT/"service/src/core.ts").read_text(),
  "report_time_indexes": all(x in (ROOT/"service/src/core.ts").read_text() for x in ["idx_report_tickets_reported_at_batch","idx_report_batches_first_report_at_status","idx_report_batches_resolved_at_status"]),
  "delta_api": "/api/skus/catalog-delta" in (ROOT/"service/src/read-api.ts").read_text(),
  "android_delta": "getCatalogDelta" in (ROOT/"android/app/src/main/java/cd/cc/supra/inventory/beta/SkuCatalogCache.kt").read_text(),
  "android_full_sync_is_fallback": "Bootstrap/fallback only" in (ROOT/"android/app/src/main/java/cd/cc/supra/inventory/beta/SkuCatalogCache.kt").read_text(),
}
free = {"workers_requests_day":100000,"do_requests_day":100000,"do_rows_read_day":5000000,"do_rows_written_day":100000}
max_catalog = 50000
model = {
  "catalog_rows": max_catalog,
  "full_bootstrap_pages_at_2000": 25,
  "full_bootstrap_devices_to_5m_row_read_limit": free["do_rows_read_day"] // max_catalog,
  "delta_example_1000_changes_x_100_devices_rows": 1000 * 100,
  "delta_example_percent_of_5m": round((1000*100/free["do_rows_read_day"])*100, 2),
}
receipt = {"status":"PASS" if all(checks.values()) else "FAIL", "checks":checks, "free_reference_envelope":free, "model_not_forecast":model}
print(json.dumps(receipt, ensure_ascii=False, indent=2))
if not all(checks.values()): raise SystemExit(1)
''', encoding='utf-8')

    (DOCS / "QUOTA_RESILIENCE.md").write_text('''# SUPRA Inventory — quota & resilience guard\n\nChecked against official provider documentation on 2026-09-17. This is a conservative design envelope, not proof of the account's billing entitlement and not an Owner-approved traffic forecast. The project must not auto-upgrade a plan.\n\n## Official reference envelope\n\n- Cloudflare Workers Free: 100,000 requests/day, 10 ms CPU per HTTP invocation. Source: https://developers.cloudflare.com/workers/platform/limits/\n- SQLite Durable Objects on Workers Free: 100,000 requests/day, 13,000 GB-s/day, 5,000,000 rows read/day, 100,000 rows written/day, 5 GB total SQL data. Source: https://developers.cloudflare.com/durable-objects/platform/pricing/\n- Cloudflare confirms each index row update adds a row written; indexes are still recommended for read-heavy filters when their saved scans justify the write cost. Source: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/\n- Google Sheets API: 300 reads/min/project + 300 writes/min/project, 60/min/user/project; batch request counts as one request; Google recommends payloads around 2 MB or less. Source: https://developers.google.com/workspace/sheets/api/limits\n- FCM HTTP v1 default downstream quota is 600,000 messages/min/project; Android per-device maximum is 240/min and 5,000/hour. FCM is no-cost. Sources: https://firebase.google.com/docs/cloud-messaging/throttling-and-quotas and https://firebase.google.com/pricing\n\n## Guards applied\n\n1. Dashboard/report date filters use dedicated timestamp indexes instead of repeated unbounded table scans.\n2. SKU catalog metadata is materialized in one row, so catalog-version checks no longer `COUNT/MAX` scan the entire master on every PDA sync.\n3. PDA catalog sync is delta-first using `(updated_at, sku)` pagination. Full 50k catalog download is only bootstrap/fallback.\n4. A 50,000-SKU full bootstrap is 50,000 catalog rows per device. At the Free 5M rows-read envelope, 100 fresh full bootstraps in one day alone could consume the entire row-read allowance. This is why version changes must not trigger full reloads.\n5. No rapid HTTP polling is introduced. WebSocket invalidation remains foreground realtime; FCM remains background notification; dashboard refresh is explicit/realtime-driven.\n6. Archive uses batched Sheets writes and checkpointed fixed ranges rather than per-event Sheets writes.\n7. Live resilience probes are read-only: health/schema/auth guards and bounded burst tests. Business mutation stress must use an isolated test workload so Beta operational records are not polluted.\n\n## Residual risk\n\nA genuinely fresh fleet bootstrap can still be expensive because each device has no local catalog yet. The exact PDA concurrency/daily report volume is not canonical in the current repo, so this document does not claim production-capacity PASS from an invented workload. Measure real usage and account entitlement before Stable release.\n''', encoding='utf-8')


def update_authority_pending() -> None:
    decisions = DECISIONS.read_text(encoding='utf-8')
    if '| D026 | ACTIVE |' not in decisions:
        marker = '\n## Superseded historical state'
        line = '\n| D026 | ACTIVE | Quota/resilience design must assume the no-auto-upgrade/free-envelope worst case unless live entitlement proves otherwise. Admin reporting uses bounded indexed time-range queries; PDA SKU cache must use delta-first synchronization so a Master SKU version change does not force every PDA to reload a 10k–50k catalog. Full catalog fetch is bootstrap/fallback only. Live stress tests must be non-destructive unless an isolated test workload is explicitly available. |\n'
        decisions = decisions.replace(marker, line + marker)
        DECISIONS.write_text(decisions, encoding='utf-8')

    state = json.loads(STATE.read_text(encoding='utf-8'))
    state['current_status']['sqlite_schema'] = 5
    state['current_status']['quota_resilience'] = 'DELTA_CATALOG_INDEXED_REPORTING_SOURCE_PENDING_BETA_VERIFY'
    line = 'Quota/resilience optimization: materialized catalog metadata + delta-first PDA catalog sync + reporting timestamp indexes — Beta verification pending'
    if line not in state['completed_capabilities']: state['completed_capabilities'].append(line)
    state['next_action']['primary'] = 'Verify/deploy schema v5 quota-resilience optimization and signed Android beta-vc29, then field-verify on physical PDA and complete Owner business acceptance.'
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    registry['cloudflare']['beta_sqlite_schema_version'] = 5
    registry['environments']['beta']['sqlite_schema_version'] = 5
    registry['environments']['stable']['sqlite_schema_version_source'] = 5
    registry['environments']['beta']['business_api_status'] = 'IMPLEMENTED_SOURCE_SCHEMA_V5_VERIFY_PENDING'
    registry['quota_resilience'] = {
      'reference_date': '2026-09-17',
      'plan_policy': 'NO_AUTO_UPGRADE_MODEL_AGAINST_FREE_ENVELOPE_UNTIL_LIVE_ENTITLEMENT_READBACK',
      'catalog_sync': 'DELTA_FIRST_FULL_BOOTSTRAP_FALLBACK_ONLY',
      'catalog_max_design_rows': 50000,
      'reporting': 'BOUNDED_60D_INDEXED_TIME_RANGE',
      'live_stress': 'NON_DESTRUCTIVE_ONLY_WITHOUT_ISOLATED_BUSINESS_DATASET',
      'source_status': 'VERIFY_PENDING'
    }
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def main() -> None:
    patch_core(); patch_sku_import(); patch_read_model(); patch_read_api(); patch_android_api(); patch_android_cache(); write_guard_and_docs(); update_authority_pending()
    print('QUOTA_RESILIENCE_V1_PATCH_PASS')

if __name__ == '__main__': main()
