import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const app = read("web/src/operational-app.ts");
const css = read("web/src/d173-tabler.css");
const input = app.slice(app.indexOf('opsInput?.addEventListener("input",'), app.indexOf("const toggleRecentDetails", app.indexOf('opsInput?.addEventListener("input",')));

test("E216 reproduces stale results: typing never rebuilds and replaces the active SKU input", () => {
  assert.match(input, /showRecentSearchPending\(\)/);
  assert.doesNotMatch(input, /if \(activeSection === "results" && \(wasSearching \|\| opsSkuSuffix\.length >= 3\)\) patchActiveSection\(true\)/);
  assert.match(input, /if \(!wasSearching && opsSkuSuffix\.length < 3\) return/);
  assert.match(input, /loadReporterRecentSnapshot\(\)/);
});

test("E216 rejects unfiltered server rows instead of displaying all as a search result", () => {
  assert.match(app, /if \(suffix && recent\.items\.some\(\(row\) => !String\(row\.sku\)\.endsWith\(suffix\)\)\)/);
  assert.match(app, /throw new Error\("Kết quả tìm SKU không khớp bộ lọc\."\)/);
});

test("E216 results loading updates table body without recreating the focused input", () => {
  assert.match(app, /function showRecentSearchPending\(\): void \{/);
  assert.match(app, /body\.replaceChildren\(row\)/);
  assert.match(app, /footer\.textContent = "Đang tìm dữ liệu theo bộ lọc…"/);
});

test("E216 result date range is right aligned directly beside SKU on desktop", () => {
  assert.match(css, /\.d173-result-range\s*\{[^}]*justify-content:space-between/);
  assert.match(css, /\.d173-result-range \+ #ops-sku-suffix\s*\{\s*margin-left:0/);
  assert.match(css, /\.d173-ops-toolbar\s*\{[^}]*flex-wrap:nowrap/);
});

test("E216 active tab remains accessible and has a distinct background for all five tabs", () => {
  assert.match(app, /aria-selected="\$\{current === "operations"\}"/);
  assert.match(app, /aria-selected="\$\{current === "overdue"\}"/);
  assert.match(app, /aria-selected="\$\{current === "results" && recentFilter === status\}"/);
  assert.match(css, /\.d173-ops-toolbar \.workspace-tab\[aria-selected="true"\]/);
  assert.match(css, /body\[data-theme="dark"\] \.d173-ops-toolbar \.workspace-tab\[aria-selected="true"\]/);
});
