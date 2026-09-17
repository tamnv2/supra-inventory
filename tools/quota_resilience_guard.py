#!/usr/bin/env python3
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
