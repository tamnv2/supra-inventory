import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const web = read("web/src/operational-app.ts");
const css = read("web/src/d173-tabler.css");
const version = read("web/src/web-version.ts");
const pkg = JSON.parse(read("web/package.json"));
const part = (start, end) => {
  const from = web.indexOf(start);
  const to = web.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start + " → " + end);
  return web.slice(from, to);
};

test("E233 regression: full-day result view is reusable from session-only RAM without new GET", () => {
  const loader = part("async function loadReporterRecentSnapshot()", "async function loadOperationsSnapshot()");
  assert.match(web, /const recentViewCache = new Map/);
  assert.match(loader, /recentViewCache\.get\(cacheKey\)/);
  assert.match(loader, /if \(cached\) \{/);
  assert.match(loader, /recentRows = cached\.rows/);
  assert.match(loader, /recentViewCache\.set\(cacheKey,/);
  assert.match(loader, /if \(all\.length !== total\) continue/);
  assert.match(loader, /getReporterRecent\(RECENT_PAGE_SIZE, offset, status, range\.from, range\.to, "", pickerRows, offset === 0\)/);
  assert.match(web, /const RECENT_PAGE_SIZE = 200/);
  assert.doesNotMatch(web, /(?:localStorage|sessionStorage|indexedDB)\.setItem\([^\n]*recent/);
});

test("E233 safety: revoke all previous result views for changed identity, realtime or reconcile", () => {
  assert.match(web, /recentViewCache\.clear\(\)/);
  assert.match(web, /sessionViewGeneration \+= 1;\s*invalidateRecentViewCache\(\)/);
  const applier = part("registerRealtimeApplier(", 'window.addEventListener("supra:realtime-status"');
  assert.match(applier, /if \(context\.source === "reconcile"\) \{\s*invalidateRecentViewCache\(\)/);
  assert.match(applier, /if \(reporterScopeChanged\) \{\s*invalidateRecentViewCache\(\)/);
  assert.match(web, /detail\.dirty/);
  assert.match(web, /realtimeStreamEpoch !== previousEpoch/);
  assert.match(web, /profile\?\.user_id/);
});

test("E233 layout: no full main vertical scrollbar; list height follows remaining workspace", () => {
  const segment = css.slice(css.indexOf("/* D173-E233"));
  assert.ok(segment.length > 0);
  assert.match(segment, /@media \(min-width:\s*781px\)/);
  assert.match(segment, /\.d173-page-content:has\(\.ops-business-workspace\)/);
  assert.match(segment, /overflow-y:\s*hidden\s*!important/);
  assert.match(segment, /\.ops-business-workspace\s*\{/);
  assert.match(segment, /min-height:\s*0/);
  assert.match(segment, /\.ops-business-workspace \.ops-panel/);
  assert.match(segment, /\.ops-business-workspace \.table-wrap/);
  assert.match(segment, /max-height:\s*none\s*!important/);
  assert.match(segment, /overflow-y:\s*auto/);
  assert.match(segment, /padding-bottom:\s*2[048]px/);
});

test("E233: final SKU remains rendered, existing local suffix and version advance", () => {
  const result = part("function renderResults(): string", "function renderPicker(): string");
  assert.match(result, /const visible = loaded \? recentRows : \[\]/);
  assert.match(result, /visible\.map\(\(row\) =>/);
  assert.doesNotMatch(result, /\.slice\(0,\s*200\)/);
  assert.match(web, /row\.dataset\.opsSkuRow \|\| ""\)\.endsWith\(suffix\)/);
  assert.match(version, /WEB_VERSION = "3\.3\.14"/);
  assert.equal(pkg.version, "3.3.14");
});
