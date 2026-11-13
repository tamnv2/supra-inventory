import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const web = readFileSync("web/src/operational-app.ts", "utf8");
const api = readFileSync("web/src/api.ts", "utf8");
const core = readFileSync("service/src/core.ts", "utf8");
const worker = readFileSync("service/src/business-api.ts", "utf8");
const css = readFileSync("web/src/d173-overview.css", "utf8");
const version = readFileSync("web/src/web-version.ts", "utf8");

test("Web3.3.18 includes new compact operational overview and same-day/7-day drilldown", () => {
  assert.match(version, /WEB_VERSION = "3\.3\.18"/);
  assert.match(web, /function renderDashboard\(\): string/);
  for (const key of ["Tình trạng cần ưu tiên", "Biến động theo", "Vấn đề cần kiểm tra", "LTA \/ Shelving", "SKU tái phát", "SKU được báo nhiều", "5 kết quả gần nhất"]) assert.ok(web.includes(key), key);
  assert.match(web, /getAdminOverview\(range\.from, range\.to, dashboardFrom, dashboardTo\)/);
  assert.match(web, /data-dashboard-day/);
  assert.match(web, /dashboardFrom = day;\s+dashboardTo = day;/);
  assert.match(web, /data-dashboard-status="PENDING"/);
  assert.match(web, /d173-overview-connected/);
  assert.match(web, /Không lấy hiệu làm tồn đọng/);
});

test("Single authorized Worker→DO read forwards only existing business data", () => {
  assert.match(api, /export async function getAdminOverview\(/);
  assert.match(api, /authorizedFetch\(\`\/api\/admin\/overview\?/);
  assert.match(worker, /"GET \/api\/admin\/overview"/);
  assert.match(worker, /overview: \["from", "to", "day_from", "day_to"\]/);
  assert.match(worker, /env\.APP_ENV !== "beta"/);
  const authorized = core.indexOf('if (request.method === "GET" && url.pathname.startsWith("/authorized/business/admin/"))');
  const permission = core.indexOf("this.authorizeInteractiveIdentity(request, selected.manager", authorized);
  const combined = core.indexOf('if (operation === "overview")', permission);
  assert.ok(authorized > -1 && authorized < permission && permission < combined, "role and WEB channel gates before combined read");
  assert.match(core.slice(combined,combined+2600), /handleBusinessRequest\(this\.state/);
  assert.match(core.slice(combined,combined+2600), /handleOperationalV2CoreRequest\(this\.state/);
  assert.match(core.slice(combined,combined+2600), /handleD167AreaReportCoreRequest\(this\.state/);
  assert.match(core.slice(combined,combined+2600), /areasResponse\?\.ok \? await areasResponse\.json\(\) : null/);
  assert.doesNotMatch(core.slice(combined,combined+2600), /storage\.sql\.exec|INSERT|UPDATE|DELETE/);
});

test("Header is viewport-sticky without clipped overflow; layout scope only affects Web", () => {
  assert.match(web, /import "\.\/d173-overview\.css"/);
  assert.match(css, /\.d173-tabler-shell > \.d173-tabler-navbar\s*\{[^}]*position:\s*sticky !important;[^}]*top:\s*0 !important;[^}]*height:\s*auto !important;[^}]*overflow:\s*visible !important;/s);
  assert.match(css, /@media \(max-width: 1120px\)/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.doesNotMatch(css, /\.obpp1291/);
});

test("No invented stock cause, missing SLA is not coerced to zero, and ticket/batch are differentiated", () => {
  assert.match(web, /slaConfigured \? Number\(insights\?\.sla\.warning_count \|\| 0\) : null/);
  assert.match(web, /warning == null \? "—"/);
  assert.match(web, /chưa xác minh nguyên nhân tồn kho/);
  assert.match(web, /lượt Picker; xử lý xong: đợt/);
  assert.match(web, /k\?\.avg_resolution_minutes == null \? "—"/);
});
