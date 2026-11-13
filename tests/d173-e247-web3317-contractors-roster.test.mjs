import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const web = read("web/src/operational-app.ts");
const css = read("web/src/d173-tabler.css");
const hr = read("web/src/hr-web-panel.ts");
const api = read("web/src/api.ts");
const core = read("service/src/core.ts");
const users = read("service/src/user-management-core.ts");
const auth = read("service/src/user-management-api.ts");
const pkg = JSON.parse(read("web/package.json"));
const version = read("web/src/web-version.ts");

test("E247 report frame and date buttons reclaim available viewport", () => {
  assert.match(css, /\.report-workspace\s*\{\s*max-width:none; width:100%/);
  assert.match(css, /\.report-workspace\s*\{\s*border:0;\s*border-radius:0;/);
  assert.match(css, /\.d173-report-date \.compact-date-presets[\s\S]*?gap:4px !important/);
  assert.match(css, /\.d173-page-content:has\(\.report-workspace\)[\s\S]*?padding:4px 6px/);
});

test("E247 SKU Excel import precedes provenance and catalog lookup", () => {
  const sku = web.slice(web.indexOf("function renderSku()"), web.indexOf("function renderHr()"));
  assert.ok(sku.indexOf('id="sku-import-details"') > 0);
  assert.ok(sku.indexOf('id="sku-import-details"') < sku.indexOf("sku-provenance-panel"));
  assert.ok(sku.indexOf('id="sku-import-details"') < sku.indexOf("sku-search-panel"));
});

test("E247 accounts show full server roster in bounded pages with scoped in-memory reuse", () => {
  const list = web.slice(web.indexOf("async function loadUsers("), web.indexOf("async function loadLogs("));
  assert.match(list, /USER_FETCH_PAGE_SIZE/);
  assert.match(list, /new Set\(items\.map\(\(user\) => user\.user_id\)\)\.size !== total/);
  assert.match(list, /userRosterCache\.scope !== scope/);
  assert.match(list, /managedUsers = userRosterCache\.items\.filter/);
  assert.doesNotMatch(web, /id="user-(?:prev|next)"/);
  assert.match(web, /id="users-refresh-list"/);
  assert.match(web, /userRosterCache = null;/);
  assert.doesNotMatch(web, /localStorage\.setItem\([^\n]*userRoster/i);
});

test("E247 contractor directory is authenticated, per-role, and protects referenced Pickers", () => {
  assert.match(auth, /"GET \/api\/admin\/contractors", "POST \/api\/admin\/contractors"/);
  assert.match(auth, /const user = await requireAdmin\(request, env\)/);
  assert.match(auth, /actor: actor\(user\)/);
  assert.match(users, /CONTRACTOR_IN_USE/);
  assert.match(users, /INSERT OR IGNORE INTO contractor_catalog \(name\)/);
  assert.match(users, /audit\(state, actor, "CONTRACTOR_"/);
  assert.match(core, /CREATE TABLE IF NOT EXISTS contractor_catalog/);
  assert.match(core, /d173_contractor_catalog_seed_v1/);
});

test("E247 Picker manual input uses live contractor select; import retains existing preview/commit", () => {
  assert.match(hr, /<select name="contractorName" required>/);
  assert.doesNotMatch(hr, /<input name="contractorName"/);
  assert.match(web, /data-users-mode="contractors"/);
  assert.match(web, /id="contractor-create-form"/);
  assert.match(web, /id="contractor-edit-form"/);
  assert.match(hr, /id="hr-apply-web"/);
  assert.match(api, /authorizedFetch\("\/api\/admin\/contractors"/);
});

test("E247 Web 3.3.17 remains candidate until gated release", () => {
  assert.match(version, /WEB_VERSION = "3\.3\.17"/);
  assert.equal(pkg.version, "3.3.17");
});
