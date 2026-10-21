import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const core = read("service/src/read-model-core.ts");
const api = read("service/src/read-api.ts");
const app = read("web/src/operational-app.ts");
const css = read("web/src/legacy-transplant/d167-sku-provenance.css");
const client = read("web/src/api.ts");
const catalogSearch = read("service/src/business-core.ts");

test("SKU source identity is not inferred from max_updated_at or SKU_IMPORT_CHUNK", () => {
  assert.match(core, /skuCatalogProvenance\(state: DurableObjectState\)/);
  assert.match(core, /FROM d167_sku_jobs WHERE state='DONE' AND complete_at IS NOT NULL/);
  assert.match(core, /a.action IN \('SKU_IMPORT_CHUNK','SKU_WEB_FULL_REPLACE'\)/);
  assert.match(core, /String\(detail.actor_display\|\|""\)/);
  assert.match(core, /latest_agent_full:lastFull \? agentEvent\(lastFull\) : null/);
  assert.match(core, /latest_web:web\[0\]/);
  assert.match(core, /WHERE state=\x27DONE\x27 AND slot=\x27INITIAL_05\x27/);
  assert.match(core, /WHERE state=\x27DONE\x27 AND slot<>\x27INITIAL_05\x27/);
  assert.match(core, /latest_agent_delta:lastDelta \? agentEvent\(lastDelta\) : null/);
  assert.match(core, /last_sync_at: lastSync\?\.created_at/); // Backward-compatible old consumers.
  assert.ok(!app.includes("Đồng bộ Agent gần nhất"));
  assert.ok(app.includes("Thay đổi danh mục gần nhất")); // Source remains proven by the separate Web/Agent receipt cards.
});
test("provenance is management-only, no picker access and Web-only", () => {
  const route = api.slice(api.indexOf('"/api/admin/skus/catalog-provenance"'));
  // D171 option D merges session+role verification and catalog read into the same DO invocation.
  const inventoryCore = read("service/src/core.ts");
  assert.match(route, /authorizedGet\(request, env, "\/authorized\/read\/skus\/catalog-provenance"\)/);
  assert.match(inventoryCore, /const manager = action === "skus\/catalog-provenance"/);
  assert.match(inventoryCore, /manager \? \["ROOT", "ADMIN", "PICKPACK_ADMIN"\]/);
  assert.match(inventoryCore, /this\.authorizeInteractiveIdentity\(request/);
  assert.match(inventoryCore, /generation !== expected/);
  assert.match(inventoryCore, /MANAGEMENT_WEB_ONLY/);
  assert.match(client, /getSkuCatalogProvenance\(\)/);
  assert.match(app, /getSkuCatalogProvenance\(\)\.catch\(\(\) => null\)/);
  assert.ok(!core.includes("INSERT INTO d167_sku_jobs",core.indexOf("function skuCatalogProvenance")));
});
test("single SKU workspace request is cached and session-scoped", () => {
  const loader = app.slice(app.indexOf("async function loadSkuWorkspace(): Promise<void>"),app.indexOf("async function loadUsers(): Promise<void>"));
  assert.match(loader, /refreshProvenance = skuProvenanceLoadedAt === 0/);
  assert.match(loader, /5 \* 60_000/);
  assert.match(loader, /generation !== sessionViewGeneration/);
  assert.match(app, /skuProvenanceLoadedAt = 0;/);
  assert.match(app, /skuExcelExpanded = false;/);
});
test("SKU has compact cards, separated provenance and safe Excel actions", () => {
  const render = app.slice(app.indexOf("function renderSku(): string {"),app.indexOf("function renderHr(): string {"));
  for(const id of ["sku-admin-search-form","sku-admin-clear","sku-prev","sku-next","sku-file","sku-full-replace","apply-sku-import","sku-import-details"]) {
    assert.ok(render.includes(id),id);
  }
  for(const marker of ["sku-kpi-grid","sku-provenance-grid","sku-events-scroll","sku-catalog-table","sku-tech-details","Web · Thay toàn bộ","Agent · Đồng bộ FULL","Agent · Đồng bộ DELTA"]) assert.ok(render.includes(marker),marker);
  assert.match(render, /skuExcelExpanded \|\| wb \? "open"/);
  assert.match(app, /getSkuCatalogProvenance/);
  assert.match(catalogSearch, /AS area/);
  assert.match(catalogSearch, /a\.sku=sku_master\.sku AND a\.active=1/);
  assert.match(css, /\.sku-workspace \.sku-provenance-grid/);
  assert.match(css, /@media\(max-width:680px\)/);
});
