import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const app = read("web/src/operational-app.ts");
const css = read("web/src/d173-tabler.css");
const api = read("web/src/api.ts");
const core = read("service/src/operational-v2-core.ts");

const body = (from, to) => app.slice(app.indexOf(from), app.indexOf(to, app.indexOf(from)));
const operations = body("function renderOperations()", "function renderOverdue()");
const overdue = body("function renderOverdue()", "function resultPickerMarkup(");
const results = body("function renderResults()", "function renderPicker()");
const tabs = body("function renderOperationalTabs(", "function syncOperationalTabBadges");
const search = body("  const opsInput = document.querySelector<HTMLInputElement>(\"#ops-sku-suffix\");", "  const toggleRecentDetails =");

test("E209 field fail: unified toolbar, no redundant heading or result KPI row", () => {
  for (const page of [operations, overdue, results])
    assert.doesNotMatch(page, /<h2>Vận hành báo hàng<\/h2>/);
  assert.doesNotMatch(results, /business-summary-grid-5/);
  assert.match(tabs, /d173-ops-toolbar/);
  assert.ok(tabs.indexOf('${range}') < tabs.indexOf('id="ops-sku-suffix"'), "date filters precede stable rightmost SKU input");
  assert.match(css, /\.d173-ops-toolbar/);
});

test("E209 field fail: skip tab shows total / automatic / human using server count", () => {
  assert.match(tabs, /Tổng /);
  assert.match(tabs, /Tự động /);
  assert.match(tabs, /Nhân sự /);
  assert.match(api, /automatic_skipped_total\?: number/);
  assert.match(core, /AS automatic_skipped_total/);
  assert.match(app, /resultTabAutoSkipCount/);
});

test("E209 field fail: search bypasses global busy gate and reloads only selected tab", () => {
  assert.doesNotMatch(search, /void run\(/);
  assert.match(search, /section === "results"/);
  assert.match(search, /loadReporterRecentSnapshot\(\)/);
  assert.match(search, /loadReporterOverdueSnapshot\(\)/);
  assert.match(search, /opsSkuSuffix\.length < 3/);
  assert.match(core, /b\.sku LIKE \?/);
  assert.match(api, /params\.set\("sku_suffix", suffix\)/);
});

test("E209 field fail: withdrawn actor is tied to latest ticket user identity", () => {
  assert.match(core, /withdrawn_user\.user_id = latest_withdrawal\.picker_user_id/);
  assert.match(core, /withdrawn_picker_employee_code/);
  assert.match(core, /withdrawn_picker_display_name/);
  assert.match(results, /withdrawn_picker_employee_code/);
  assert.match(results, /withdrawn_picker_display_name/);
});

test("E209 field fail: result table drops redundant Picker received column, details compact grid", () => {
  assert.doesNotMatch(results, /<th>Picker đã nhận<\/th>/);
  assert.doesNotMatch(results, /Không áp dụng/);
  assert.match(results, /const columnCount = showFirstReport \? 9 : 8/);
  assert.match(css, /\.d173-result-picker\s*\{[^}]*grid-template-columns/);
  const detail = body("function resultPickerMarkup(", "function renderResults()");
  assert.doesNotMatch(detail, /<strong>Picker đã báo trong đợt SKU này<\/strong>/);
  assert.match(detail, /<time>/);
});

test("E209 field fail: preserve first_report date filter and D172 isolation guard", () => {
  assert.match(core, /b\.first_report_at >= \?/);
  assert.match(core, /b\.first_report_at < \?/);
  assert.match(core, /GROUP BY b\.batch_id, t\.picker_employee_code/);
  assert.match(read(".github/workflows/d173-e209-web-results.yml"), /D172/);
});
