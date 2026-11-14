import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const web = read("web/src/operational-app.ts");
const tabler = read("web/src/d173-tabler.css");
const overview = read("web/src/d173-overview.css");
const reportTabs = web.slice(web.indexOf("function renderReportTabs("), web.indexOf("function d167AreaSummaryMarkup("));
const dashboard = web.slice(web.indexOf("function renderDashboard()"), web.indexOf("function reportPickerOutcome"));
const operations = web.slice(web.indexOf("function renderOperationalTabs("), web.indexOf("function syncOperationalTabBadges"));

test("E260: the overview data timestamp is right-aligned on the report tab row, without a second title", () => {
  assert.match(reportTabs, /class="d173-report-toolbar"/);
  assert.match(reportTabs, /class="d173-overview-updated">Dữ liệu lúc/);
  assert.match(overview, /\.d173-dashboard-triage \.d173-report-toolbar \.d173-overview-updated\s*\{[^}]*margin-left:\s*auto;/s);
  assert.doesNotMatch(reportTabs, /Giám sát hôm nay · Đối chiếu 7 ngày/);
  assert.doesNotMatch(dashboard, /Giám sát báo hàng Inventory|Đang mở: toàn hệ thống/);
});

test("E260: remove Owner-directed commentary only, preserve operational evidence", () => {
  for (const label of [
    "Toàn hệ thống, không lọc ngày", "Không phải số Picker duy nhất",
    "Từ lúc báo đầu của đợt còn mở", "Không tự kết luận nguyên nhân tồn kho",
    "Khu vực được xác định tại thời điểm báo đầu", "LTA / Shelving theo lịch sử lúc báo đầu",
    "Tái phát / nhiều Picker báo", "chi tiết trực tiếp",
    "chưa chứng minh nguyên nhân thiếu hàng",
  ]) assert.ok(!dashboard.includes(label), label);
  for (const label of [
    "Đợt chờ xử lý", "Ticket Picker đang chờ", "Chờ lâu nhất",
    "Skip tự động hôm nay", "SLA cảnh báo / quá hạn",
    "Đợt đang nghẽn", "Dấu hiệu cần kiểm tra",
    "Xu hướng 7 ngày gần nhất", "Phát sinh theo giờ hôm nay",
    "Khu vực phát sinh hôm nay", "SKU cần đối chiếu",
    "first_report_at", "open_picker_count", "area_at_first_report",
    "Chưa cấu hình SLA",
  ]) assert.ok(dashboard.includes(label), label);
  assert.match(dashboard, /\$\{dailyMarkup\}/);
  assert.match(dashboard, /\$\{hourlyMarkup\}/);
});

test("E260: measured header row, zoom-compensated viewport and bottom scroll reserve", () => {
  assert.match(overview, /\.d173-tabler-shell > \.d173-tabler-navbar\s*\{[^}]*position:\s*relative !important;[^}]*top:\s*auto !important;[^}]*height:\s*auto !important;[^}]*overflow:\s*visible !important;/s);
  assert.match(web, /style\.setProperty\("--supra-ui-zoom-factor", effectiveScale\.toFixed\(3\)\)/);
  assert.match(web, /style\.setProperty\("zoom", effectiveScale\.toFixed\(3\)\)/);
  assert.match(tabler, /height:\s*calc\(100dvh \/ var\(--supra-ui-zoom-factor, 1\)\) !important/);
  assert.match(tabler, /scroll-padding-bottom:\s*24px;/);
  assert.match(tabler, /@media \(min-width:\s*901px\)/);
  assert.doesNotMatch(overview, /obpp1291/);
});

test("E260: overdue badge vertical centering and uniform desktop content offsets", () => {
  assert.match(operations, /Quá hạn <b data-workspace-count="overdue">/);
  assert.match(tabler, /\.d173-tabler-shell \.d173-ops-toolbar \.workspace-tab\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s);
  assert.match(tabler, /\.d173-tabler-shell \.d173-ops-toolbar \.workspace-tab > b\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;/s);
  assert.match(tabler, /body \.d173-tabler-shell > \.d173-page-content:has\(\.ops-business-workspace\),[\s\S]*?body \.d173-tabler-shell > \.d173-page-content:has\(\.report-workspace\)\s*\{\s*padding:\s*4px 6px 24px !important;/);
  assert.match(tabler, /@media \(max-width:\s*780px\)/);
});
