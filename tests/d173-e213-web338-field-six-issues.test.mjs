import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("web/src/operational-app.ts");
const tabler = read("web/src/d173-tabler.css");
const unified = read("web/src/d173-e036-unified-design.css");
const core = read("service/src/operational-v2-core.ts");

test("D173 Web 3.3.8 field: the corporate title is exactly 150% of its old 11px size", () => {
  assert.match(unified, /\.header-product > \.company-name\s*\{\s*font-size:\s*16\.5px !important/);
});

test("D173 Web 3.3.8 field: Skip tab has a compact count and no visible breakdown", () => {
  assert.match(app, /<b data-workspace-count="\$\{status\}">\$\{resultTabBadgeCounts\[status\]\}<\/b>/);
  assert.doesNotMatch(app, /<span data-workspace-count="SKIP_ALLOWED">\$\{skipBreakdown\}<\/span>/);
  assert.match(app, /badge\.textContent = String\(resultTabBadgeCounts\[status\]\)/);
});

test("D173 Web 3.3.8 field: desktop controls stay on one row, dates and SKU shrink", () => {
  assert.match(tabler, /\.d173-ops-toolbar\s*\{[^}]*flex-wrap:nowrap/);
  assert.match(tabler, /\.d173-ops-toolbar-right\s*\{[^}]*flex-wrap:nowrap/);
  assert.match(tabler, /#ops-sku-suffix\s*\{[^}]*width:103px/);
  assert.match(tabler, /\.d173-range-dates input\s*\{[^}]*width:100px/);
  assert.doesNotMatch(tabler, /@media \(max-width:1550px\)\s*\{[\s\S]*?\.d173-ops-toolbar-right\s*\{\s*flex:1 1 100%/);
});

test("D173 Web 3.3.8 field: changing SKU immediately invalidates and hides stale results", () => {
  assert.match(app, /function recentPageKey\(\): string/);
  assert.match(app, /recentLoadedViewKey = viewKey;/);
  assert.match(app, /const waitingForResults = recentLoadedViewKey !== recentPageKey\(\)/);
  assert.match(app, /const visible = waitingForResults \? \[\] : recentRows;/);
  assert.match(app, /if \(activeSection === "results" && \(wasSearching \|\| opsSkuSuffix\.length >= 3\)\) patchActiveSection\(true\);/);
});

test("D173 Web 3.3.8 field: withdrawn identity comes from latest withdrawn ticket, not the batch resolver", () => {
  assert.match(core, /latest_withdrawal\.picker_user_id/);
  assert.match(core, /COALESCE\(NULLIF\(page\.picker_employee_code, ''\), NULLIF\(withdrawn_user\.employee_code, ''\), ''\) AS withdrawn_picker_employee_code/);
  assert.match(app, /row\.status === "CLOSED"[\s\S]{0,120}\? \[row\.withdrawn_picker_employee_code, row\.withdrawn_picker_display_name\]/);
});
