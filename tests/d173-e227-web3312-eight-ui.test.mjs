import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const web = readFileSync(new URL("../web/src/operational-app.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/src/d173-tabler.css", import.meta.url), "utf8");
const version = readFileSync(new URL("../web/src/web-version.ts", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../web/package.json", import.meta.url), "utf8"));

test("1. Operations tab appearance matches dashboard standard workspace-tab style", () => {
  assert.match(web, /class="workspace-tabs" role="tablist" aria-label="Vận hành báo hàng"/);
  assert.match(web, /class="workspace-tab \$\{current === "operations" \? "active" : ""\}/);
  assert.match(css, /\.d173-tabler-shell \.d173-ops-toolbar \.workspace-tab\.active/);
  assert.doesNotMatch(css, /inset 0 -3px 0 #206bc4/);
});
test("2. Sidebar remains highlighted for operations, overdue and results", () => {
  assert.match(web, /node\.dataset\.section === "operations" && \(activeSection === "overdue" \|\| activeSection === "results"\)/);
  assert.match(web, /section === "operations" && \(activeSection === "overdue" \|\| activeSection === "results"\)/);
});
test("3. SKU search width exactly doubles existing 103px to 206px", () => {
  assert.match(css, /#ops-sku-suffix \{[^\n]*width:206px; min-width:206px; flex:0 0 206px/);
});
test("4. Closed Picker tab has only SKU, Picker, withdrawal time; correct dynamic spans", () => {
  assert.match(web, /const withdrawnOnly = recentFilter === "CLOSED"/);
  assert.match(web, /const columnCount = withdrawnOnly \? 3 : 9/);
  assert.match(web, /<th>Picker thu hồi<\/th><th>Thời điểm thu hồi<\/th>/);
  assert.match(web, /if \(withdrawnOnly\) return `<tr data-ops-sku-row/);
});
test("5. Auto SKIP has separate background; human SKIP uses normal row tone (E230)", () => {
  assert.match(web, /row\.resolution_source === "SYSTEM_TIMEOUT" \|\| row\.resolution_source === "SYSTEM_DAY_END"/);
  assert.match(css, /tr\.d173-skip-auto > td/);
  assert.doesNotMatch(css, /tr\.d173-skip-human > td/);
  assert.match(css, /body\[data-theme="dark"\].*d173-skip-auto/);
});
test("6-7. Company title enlarged and redundant hamburger removed", () => {
  assert.match(css, /company-name \{\s*font-size:20px !important/);
  assert.doesNotMatch(web, /id="d173-sidebar-toggle"/);
  assert.doesNotMatch(web, /querySelector<HTMLButtonElement>\("#d173-sidebar-toggle"\)/);
});
test("8. Tabs, date and SKU filter stay inside one sticky vertical scroll toolbar", () => {
  assert.match(css, /\.d173-tabler-shell \.d173-ops-toolbar \{\s*position:sticky; top:0/);
  assert.match(web, /<div class="d173-ops-toolbar">/);
  assert.match(web, /<input type="date" id="recent-day"/);
  assert.match(web, /<input id="ops-sku-suffix"/);
});
test("Web 3.3.17 source candidate, no data-layer change", () => {
  assert.match(version, /WEB_VERSION = "3\.3\.16"/);
  assert.equal(pkg.version, "3.3.17");
});
