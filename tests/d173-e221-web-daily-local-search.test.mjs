import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("web/src/operational-app.ts");
const api = read("web/src/api.ts");
const core = read("service/src/core.ts");
const sql = read("service/src/operational-v2-core.ts");
const css = read("web/src/d173-tabler.css");
const part = (from, to) => {
  const a = app.indexOf(from);
  assert.notEqual(a, -1, "source marker missing: " + from);
  const b = app.indexOf(to, a + from.length);
  assert.notEqual(b, -1, "source marker missing: " + to);
  return app.slice(a, b);
};
const tabs = part("function renderOperationalTabs(", "function syncOperationalTabBadges");
const result = part("function renderResults(): string", "function renderPicker(): string");
const overdue = part("function renderOverdue(): string", "function resultPickerMarkup(");
const search = part('  const opsInput = document.querySelector<HTMLInputElement>("#ops-sku-suffix");', "  const toggleRecentDetails =");
const recentLoader = part("async function loadReporterRecentSnapshot(): Promise<void>", "async function loadOperationsSnapshot(): Promise<void>");
const overdueLoader = part("async function loadReporterOverdueSnapshot(): Promise<void>", "async function loadReporterRecentSnapshot(): Promise<void>");

test("E221: one VN calendar day, not presets or from/to and login/F5 resets today", () => {
  assert.match(tabs, /id="recent-day"/);
  assert.match(tabs, /current === "results"/);
  assert.doesNotMatch(tabs, /data-recent-range|name="from"|name="to"/);
  assert.match(app, /recentFrom = dateDaysAgo\(0\)/);
  assert.match(app, /recentTo = recentFrom/);
  assert.match(app, /recentFrom = day;\s*recentTo = day;/);
  assert.match(sql, /b\.first_report_at >= \?/);
  assert.match(sql, /b\.first_report_at < \?/);
});

test("E221: no user-facing pagination in all five reporter operation tabs", () => {
  assert.doesNotMatch(result + overdue + tabs, /id="recent-prev"|id="recent-next"|id="overdue-prev"|id="overdue-next"|data-recent-range/);
  assert.match(result, /data-ops-visible-count/);
  assert.match(overdue, /data-ops-visible-count/);
  assert.match(app, /loadCompleteReporterQueue/);
});

test("E221: each selected day/status is fetched completely in bounded 200-row pages", () => {
  assert.match(recentLoader, /getReporterRecent\(RECENT_PAGE_SIZE, offset, status, range\.from, range\.to, "", pickerRows, offset === 0\)/);
  assert.match(app, /const RECENT_PAGE_SIZE = 200/);
  assert.match(recentLoader, /offset \+= page\.items\.length/);
  assert.match(recentLoader, /if \(all\.length !== total\) continue/);
  assert.match(recentLoader, /recentLoadedViewKey = viewKey/);
  assert.match(overdueLoader, /getReporterOverdue\(200, offset\)/);
  assert.match(overdueLoader, /if \(all\.length !== total\) continue/);
  assert.match(app, /if \(activeSection === "results" \|\| activeSection === "overdue"\) return false/);
});

test("E221: SKU lookup is suffix-only and local, without any service search on typing", () => {
  assert.match(search, /filterOperationalSkuRows\(\)/);
  assert.doesNotMatch(search, /getReporterRecent\(|getReporterOverdue\(|loadReporterRecentSnapshot\(|loadReporterOverdueSnapshot\(|setTimeout\(/);
  assert.match(app, /row\.dataset\.opsSkuRow \|\| ""\)\.endsWith\(suffix\)/);
  assert.match(app, /if \(matches && row\.hasAttribute\("data-ops-sku-primary"\)\) shown \+= 1/);
  assert.match(result, /data-ops-sku-row/);
  assert.match(overdue, /data-ops-sku-row/);
  assert.match(app, /opsInput\.value\.replace\(\/\\D\/g, ""\)/);
});

test("E221: exact CLOSЕD picker rows and distinct identities survive full loading", () => {
  assert.match(recentLoader, /const pickerRows = recentFilter === "CLOSED"/);
  assert.match(recentLoader, /row\.batch_id \+ "\\|" \+ \(row\.withdrawn_picker_employee_code \|\| ""\)/);
  assert.match(result, /withdrawn_picker_employee_code/);
  assert.match(sql, /GROUP BY b\.batch_id, t\.picker_employee_code/);
  assert.doesNotMatch(app, /\.slice\(0, RECENT_PAGE_SIZE\)/);
});

test("E221 regression: authorized Core bridges previously dropped suffix/picker rows/totals", () => {
  const route = (name) => core.slice(core.indexOf('url.pathname === "/authorized/operational/reporter/' + name + '"'));
  const names = (name) => {
    const match = route(name).match(/for \(const name of (\[[^\]]+\])\)/);
    assert.ok(match, "authorized whitelist missing for " + name);
    return JSON.parse(match[1]);
  };
  for (const key of ["sku_suffix", "picker_rows", "include_totals"]) assert.ok(names("recent").includes(key), "Core drops " + key);
  assert.ok(names("overdue").includes("sku_suffix"), "Core drops overdue suffix");
  assert.match(api, /if \(pickerRows\) params\.set\("picker_rows", "1"\)/);
  assert.match(core, /this\.authorizeInteractiveIdentity\(request, reporterRoles\)/);
});

test("E221: no D172 source/data changes, date controls align before the SKU input", () => {
  assert.match(tabs, /\$\{range\}[\s\S]*id="ops-sku-suffix"/);
  assert.match(css, /#recent-day\s*\{/);
  assert.match(css, /\.d173-ops-toolbar \.workspace-tab\[aria-selected="true"\]/);
  assert.match(css, /body\[data-theme="dark"\] \.d173-ops-toolbar \.workspace-tab\[aria-selected="true"\]/);
});
