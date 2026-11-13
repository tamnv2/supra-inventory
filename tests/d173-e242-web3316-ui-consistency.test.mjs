import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const web = read("web/src/operational-app.ts");
const css = read("web/src/d173-tabler.css");
const version = read("web/src/web-version.ts");
const pkg = JSON.parse(read("web/package.json"));
const section = (start, end) => web.slice(web.indexOf(start), web.indexOf(end, web.indexOf(start) + start.length));

test("E242 Picker identity and time are bold; auto-skip occupies a fourth same-line grid cell", () => {
  const picker = section("function pickerDetailMarkup(", "function renderFastDetail(");
  assert.ok(picker.includes('class="picker-display-name"'));
  assert.ok(picker.includes("<time><strong>"));
  assert.ok(css.includes("grid-template-columns:minmax(70px,100px) minmax(130px,1fr) max-content max-content"));
  assert.ok(css.includes(".picker-detail-row .picker-timeout-state { white-space:nowrap; }"));
});

test("E242 vertically center three outcome tabs and controls, compact day input", () => {
  assert.ok(css.includes("result-audit-table tbody tr[data-ops-sku-primary] > td { vertical-align:middle !important; }"));
  assert.ok(css.includes("result-audit-table tbody tr[data-ops-sku-primary] .user-row-actions { display:flex; align-items:center; }"));
  assert.ok(css.includes("#recent-day { width:125px; min-width:125px; }"));
});

test("E242 header API and WebSocket terminology, equal control heights", () => {
  assert.ok(web.includes("Dịch vụ API: "));
  assert.ok(web.includes("Dữ liệu trực tiếp: "));
  assert.ok(css.includes(".header-controls :is(select,button) { box-sizing:border-box; height:36px"));
});

test("E242 report toolbar hosts both date controls, no View buttons, scrollable inner content", () => {
  const toolbar = section("function renderReportTabs(", "function d167AreaSummaryMarkup(");
  const dashboard = section("function renderDashboard(", "function reportPickerOutcome(");
  const report = section("function renderReports(", "function sanitizeDiagnosticValue(");
  assert.ok(toolbar.includes("d173-report-toolbar"));
  assert.ok(toolbar.includes("report-date-filter"));
  assert.ok(dashboard.includes('class="d173-report-content"'));
  assert.ok(report.includes('class="d173-report-content"'));
  assert.ok(!dashboard.includes('report-filter-submit">Xem</button>'));
  assert.ok(!report.includes('report-filter-submit">Xem báo cáo</button>'));
  assert.ok(web.includes('#dashboard-filter, #report-date-filter'));
  assert.ok(css.includes(".report-workspace > .d173-report-content { flex:1 1 auto;"));
  assert.ok(css.includes("width:125px !important; min-width:125px !important"));
});

test("E242 shift visual cleanup retains operational data", () => {
  const shift = section("function renderShiftOperations(", "function renderAccount(");
  for (const old of ["Thông tin kỹ thuật ca", "State chia sẻ đến", "Cửa sổ kỹ thuật Replay", "Cùng trạng thái với App/PDA", "Theo lịch mặc định"]) {
    assert.ok(!shift.includes(old), old);
  }
  assert.ok(shift.includes("Thời hạn vận hành"));
  assert.ok(!web.includes("Nhắc Reporter lúc 10:55"));
  assert.ok(!web.includes("Nhắc Reporter lúc 17:55"));
  assert.ok(web.includes("getAndroidAlertWindow"));
});

test("E242 Web version is code-only 3.3.17", () => {
  assert.ok(version.includes('WEB_VERSION = "3.3.17"'));
  assert.equal(pkg.version, "3.3.17");
});
