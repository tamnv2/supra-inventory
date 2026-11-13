import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const web = readFileSync(new URL("../web/src/operational-app.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/src/d173-tabler.css", import.meta.url), "utf8");
const version = readFileSync(new URL("../web/src/web-version.ts", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../web/package.json", import.meta.url), "utf8"));
const between = (start, end) => {
  const from = web.indexOf(start);
  const to = web.indexOf(end);
  assert.ok(from >= 0 && to > from, `Expected source boundaries: ${start} → ${end}`);
  return web.slice(from, to);
};

test("D173-E230: only system-auto Skip rows receive a special background", () => {
  const render = between("function renderResults()", "function renderPicker(");
  assert.match(render, /row\.resolution_source === "SYSTEM_TIMEOUT" \|\| row\.resolution_source === "SYSTEM_DAY_END"/);
  assert.match(render, /\? "d173-skip-auto" : ""/);
  assert.doesNotMatch(render, /d173-skip-human/);
  assert.match(css, /tr\.d173-skip-auto > td/);
  assert.doesNotMatch(css, /tr\.d173-skip-human > td/);
  assert.match(css, /body\[data-theme="dark"\].*d173-skip-auto/);
});

test("D173-E230: remove redundant visible totals from the five-tab lists", () => {
  const results = between("function renderResults()", "function renderPicker(");
  const overdue = between("function renderOverdue()", "function resultPickerMarkup(");
  assert.doesNotMatch(results, /class="user-pagination"/);
  assert.doesNotMatch(overdue, /class="user-pagination"/);
  assert.match(results, /const visible = loaded \? recentRows : \[\]/);
  assert.match(web, /data-workspace-count="\$\{status\}"/);
});

test("D173-E230: compact only the Reporter operation workspace without touching data source", () => {
  assert.match(css, /\.ops-business-workspace \.ops-panel/);
  assert.match(css, /\.ops-business-workspace \.table-wrap/);
  assert.match(css, /\.ops-business-workspace \.d173-ops-toolbar/);
  assert.match(css, /\.ops-business-workspace \.business-summary-card/);
  assert.match(css, /max-height:none/);
});

test("D173-E230: exact suffix-search instruction and Web candidate version", () => {
  assert.match(web, /placeholder="Tìm SKU tối thiểu 3 chữ số cuối"/);
  assert.match(web, /opsSkuSuffix\.length < 3 \|\| row\.sku\.endsWith\(opsSkuSuffix\)/);
  assert.match(version, /WEB_VERSION = "3\.3\.19"/);
  assert.equal(pkg.version, "3.3.19");
});
