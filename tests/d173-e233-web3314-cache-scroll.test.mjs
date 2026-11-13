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
  assert.match(version, /WEB_VERSION = "3\.3\.19"/);
  assert.equal(pkg.version, "3.3.19");
});

import { runInNewContext } from "node:vm";

const loaderBody = part("async function loadReporterRecentSnapshot()", "async function loadOperationsSnapshot()")
  .replace("async function loadReporterRecentSnapshot(): Promise<void>", "async function loadReporterRecentSnapshot()")
  .replace("const all: ReporterRecentBatch[] = []", "const all = []")
  .replace("new Set<string>()", "new Set()")
  .replace("let totals: typeof recentTotals | null = null", "let totals = null");

function loaderFixture(count) {
  const records = Array.from({ length: count }, (_, index) => ({ batch_id: `b${index}`, sku: String(index) }));
  let calls = 0;
  const ctx = {
    profile: { user_id: "operator-1", role: "ADMIN", base_role: "ADMIN" },
    sessionViewGeneration: 1,
    recentViewCacheEpoch: 0,
    recentViewCache: new Map(),
    reporterRecentLoadGeneration: 0,
    recentFilter: "HAS_STOCK",
    recentFrom: "2026-11-12",
    recentTo: "2026-11-12",
    recentLoadedViewKey: "",
    recentRows: [],
    recentTotal: 0,
    recentLoadError: "",
    recentTotals: { has_stock: 0, skip_allowed: 0, automatic_skipped: 0, withdrawn: 0, ack_target_count: 0, acknowledged_count: 0, displayed_count: 0 },
    recentBadgeCount: 0,
    recentBadgeInitialized: false,
    resultTabAutoSkipCount: 0,
    realtimeState: "connected",
    RECENT_PAGE_SIZE: 200,
    recentPageKey: () => [ctx.recentFilter, ctx.recentFrom, ctx.recentTo].join("|"),
    apiRange: () => ({ from: "2026-11-12T00:00:00", to: "2026-11-13T00:00:00" }),
    syncOperationalTabBadges() {},
    markWebUpdateReceived() {},
    async getReporterRecent(limit, offset) {
      calls++;
      return {
        items: records.slice(offset, offset + limit),
        total: records.length,
        totals: { ...ctx.recentTotals, has_stock: records.length },
      };
    },
  };
  const load = runInNewContext(loaderBody + "\nloadReporterRecentSnapshot", ctx);
  return { ctx, load, get calls() { return calls; } };
}

test("E234 behavior: 0/1/200/201/383/1000 rows all loaded; exact count and bounded 200 API paging", async () => {
  for (const n of [0, 1, 200, 201, 383, 1000]) {
    const f = loaderFixture(n);
    await f.load();
    assert.equal(f.ctx.recentRows.length, n, "row count " + n);
    assert.equal(f.ctx.recentTotal, n);
    assert.equal(f.ctx.recentLoadedViewKey, "HAS_STOCK|2026-11-12|2026-11-12");
    assert.equal(f.calls, Math.max(1, Math.ceil(n / 200)), "GET count " + n);
  }
});

test("E234 behavior: A→B→A reuses only valid same-session cache and restores badges", async () => {
  const f = loaderFixture(383);
  await f.load();
  assert.equal(f.calls, 2);
  f.ctx.recentFilter = "SKIP_ALLOWED";
  await f.load();
  assert.equal(f.calls, 4);
  f.ctx.recentFilter = "HAS_STOCK";
  await f.load();
  assert.equal(f.calls, 4, "returning to complete A must make zero API requests");
  assert.equal(f.ctx.recentBadgeCount, 383);
  f.ctx.recentViewCache.clear();
  f.ctx.recentViewCacheEpoch++;
  await f.load();
  assert.equal(f.calls, 6, "realtime invalidation must force authoritative reload");
  f.ctx.profile.user_id = "operator-2";
  await f.load();
  assert.equal(f.calls, 8, "new user must not reuse previous user's RAM data");
  f.ctx.realtimeState = "offline";
  await f.load();
  assert.equal(f.calls, 10, "offline / dirty state must never treat old RAM as authoritative");
});
