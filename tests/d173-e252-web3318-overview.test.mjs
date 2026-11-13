import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const web = readFileSync("web/src/operational-app.ts", "utf8");
const api = readFileSync("web/src/api.ts", "utf8");
const core = readFileSync("service/src/core.ts", "utf8");
const worker = readFileSync("service/src/business-api.ts", "utf8");
const css = readFileSync("web/src/d173-overview.css", "utf8");
const version = readFileSync("web/src/web-version.ts", "utf8");
const deploy = readFileSync(".github/workflows/deploy-beta.yml", "utf8");

test("D173-E257 shows live per-SKU triage without a second page or recent-resolution wall", () => {
  assert.match(version, /WEB_VERSION = "3\.3\.19"/); // Owner-authorized release candidate.
  assert.match(web, /function renderDashboard\(\): string/);
  const dashboard = web.slice(web.indexOf("function renderDashboard(): string"), web.indexOf("function reportPickerOutcome"));
  for (const key of [
    "Đợt đang nghẽn", "Dấu hiệu cần kiểm tra", "Xu hướng 7 ngày gần nhất",
    "Phát sinh theo giờ hôm nay", "Khu vực phát sinh hôm nay", "SKU cần đối chiếu",
    "first_report_at", "open_picker_count", "area_at_first_report",
  ]) assert.ok(dashboard.includes(key), key);
  assert.doesNotMatch(dashboard, /5 kết quả gần nhất|data-dashboard-status|data-dashboard-sku|data-dashboard-day/);
  assert.match(web, /getAdminOverview\(range\.from, range\.to, dashboardFrom, dashboardTo\)/);
  assert.match(web, /dashboardFrom = dateDaysAgo\(0\);\s+dashboardTo = dashboardFrom;/);
  assert.doesNotMatch(web, /function refreshDashboardPresence/);
  assert.match(web, /function scheduleDashboardEventRefresh\(\): void/);
  assert.match(web, /15_000 - \(Date\.now\(\) - dashboardLastLoadedAt\)/);
  assert.match(web, /scheduleDashboardEventRefresh\(\);/);
  assert.match(dashboard, /không phải vị trí hiện tại/);
  assert.match(dashboard, /chưa chứng minh nguyên nhân thiếu hàng/);
});

test("One authenticated Web-to-DO overview includes bounded pending evidence and two read-only hourly SQL groups", () => {
  assert.match(api, /export async function getAdminOverview\(/);
  assert.match(api, /pending_items: Array/);
  assert.match(api, /trend_7d_hours: Array/);
  assert.match(api, /authorizedFetch\(/);
  assert.match(worker, /"GET \/api\/admin\/overview"/);
  assert.match(worker, /env\.APP_ENV !== "beta"/);
  const authorized = core.indexOf('if (request.method === "GET" && url.pathname.startsWith("/authorized/business/admin/"))');
  const permission = core.indexOf("this.authorizeInteractiveIdentity(request, selected.manager", authorized);
  const combined = core.indexOf('if (operation === "overview")', permission);
  assert.ok(authorized > -1 && authorized < permission && permission < combined, "RBAC and WEB channel before overview");
  const region = core.slice(combined,core.indexOf('if (operation === "dashboard-preference")',combined));
  assert.match(region, /handleBusinessRequest\(this\.state/);
  assert.match(region, /handleOperationalV2CoreRequest\(this\.state/);
  assert.match(region, /handleD167AreaReportCoreRequest\(this\.state/);
  assert.match(region, /status='PENDING'/);
  assert.match(region, /first_report_at ASC,batch_id ASC LIMIT 6/);
  assert.match(region, /FROM report_tickets WHERE reported_at>=\?/);
  assert.match(region, /FROM report_batches WHERE resolved_at>=\?/);
  assert.match(region, /trend_7d_hours: trend7dHours/);
  assert.doesNotMatch(region, /\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|report_)/i);
  assert.doesNotMatch(region, /obpp1291|obpp_/i);
});

test("Header is viewport-sticky without clipped overflow; layout scope only affects Web", () => {
  assert.match(web, /import "\.\/d173-overview\.css"/);
  assert.match(css, /\.d173-tabler-shell > \.d173-tabler-navbar\s*\{[^}]*position:\s*sticky !important;[^}]*top:\s*0 !important;[^}]*height:\s*auto !important;[^}]*overflow:\s*visible !important;/s);
  assert.match(css, /@media \(max-width: 1120px\)/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.doesNotMatch(css, /\.obpp1291/);
});

test("Missing SLA remains unknown, ticket and batch counts are not mixed", () => {
  assert.match(web, /slaConfigured \? Number\(insights\?\.sla\.warning_count \|\| 0\) : null/);
  assert.match(web, /slaConfigured \? Number\(insights\?\.sla\.escalated_count \|\| 0\) : null/);
  assert.match(web, /"Chưa cấu hình SLA"/);
  assert.match(web, /Không phải số Picker duy nhất/);
  assert.match(web, /Đợt hoàn tất/);
});

test("E253 Production workflow preserves 10-slot Web log and D172 Gateway isolation", () => {
  const marker = "D173-E253_WEB3318_PRODUCTION_RELEASE:*";
  assert.equal(deploy.split(marker).length - 1, 3, "Worker, D146, Gateway guards all recognize E253");
  assert.match(deploy, /D173_E253_EXISTING_GATEWAY_D172_UNCHANGED__READ_ONLY_D173_OVERVIEW/);
  assert.match(deploy, /d173_e253_web3318_release_gate\.py --component worker/);
  assert.match(deploy, /D173_E165_WEB_LOG_10_SLOTS_DURABLE_SERVICE_CONTRACT_PASS/);
});
