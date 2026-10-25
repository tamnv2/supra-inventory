import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const web = readFileSync(new URL("../web/src/operational-app.ts", import.meta.url), "utf8");
const hr = readFileSync(new URL("../web/src/hr-web-panel.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/src/legacy-transplant/d167-web-ux-recovery.css", import.meta.url), "utf8");
const version = readFileSync(new URL("../web/src/web-version.ts", import.meta.url), "utf8");
const section = (begin, end) => {
  assert.ok(web.includes(begin) && web.includes(end));
  return web.slice(web.indexOf(begin), web.indexOf(end));
};

test("Owner NOT PASS: three People views are exclusive and match each action", () => {
  const users = section("function renderUsers(): string {", "function renderSla(): string {");
  assert.match(web, /let usersView: "list" \| "create" \| "import" = "list"/);
  for (const name of ["list", "create", "import"]) {
    assert.ok(users.includes('data-users-mode="' + name + '"'));
    assert.ok(users.includes('usersView === "' + name + '"'));
  }
  assert.ok(users.includes('id="create-user-form"'));
  assert.ok(users.includes('id="user-filter-form"'));
  assert.ok(users.includes('usersView === "import"'));
  assert.ok(users.includes('renderHrWeb('));
  assert.ok(hr.includes('id="hr-manual-form"'));
  assert.ok(hr.includes('id="hr-excel-file"'));
  assert.ok(web.includes("usersView = next as typeof usersView"));
  for (const forbidden of ["usersHrOpen", "usersCreateOpen", "function renderPeopleTabs", "toggle-create-user", "toggle-hr-import"]) {
    assert.ok(!web.includes(forbidden), "obsolete overlapping screen logic: " + forbidden);
  }
  assert.ok(web.includes('usersView = "list";'), "create/apply returns to the actual list");
});

test("Owner NOT PASS: role-limited account controls and explicit selection", () => {
  const users = section("function renderUsers(): string {", "function renderSla(): string {");
  assert.ok(users.includes('data-user-select'));
  assert.ok(users.includes('data-managed-user-select'));
  assert.ok(users.includes('!privilegedOneTimeManagedUser(user)'));
  assert.ok(web.includes('function renderUserBulkToolbar('));
  assert.ok(web.includes('data-picker-action="REPORTING_ENABLE"'));
  assert.ok(web.includes('data-picker-action="DELETE"'));
  assert.ok(web.includes('user-bulk-dropdown'));
  assert.ok(web.includes('select-page-pickers') && web.includes('select-all-global-pickers'));
  assert.ok(web.includes('usersGlobalTargetCount'));
  assert.ok(css.includes('.users-workspace [hidden]'));
});

test("Owner NOT PASS: SLA three compact steps and two policy columns", () => {
  const sla = section("function renderSla(): string {", "function renderReportTabs(");
  for (const key of ["warningEnabled","escalationEnabled","autoSkipEnabled","autoSkipMode","skipToStockEnabled","skipToStockMinutes","currentPassword","sla-save-button"]) {
    assert.ok(sla.includes(key), "missing business input: " + key);
  }
  assert.ok(css.includes('grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr) 12px minmax(0,1fr)'));
  assert.ok(css.includes('grid-template-columns: minmax(0,1fr) minmax(0,1fr)'));
  assert.ok(css.includes('@media(max-width:690px)'));
  assert.ok(!sla.includes('Hệ thống kiểm tra phiên bản cấu hình trước khi lưu.'));
  assert.match(version, /WEB_VERSION = "3\.3\.0"/);
});

test("All Web screens: no Owner-facing narrative or long non-actionable paragraphs", () => {
  const obsolete = [
    "Nhấn để xem danh sách",
    "Trước lần xác minh nguồn đầu tiên:",
    "Không hồi tố khu vực",
    "Dành cho quản trị hệ thống. Chỉ truy vấn khi bấm nút",
    "Chỉ Web + PDA; Agent không được tính.",
    "Web lấy từ nhật ký nhập Excel; Agent lấy từ biên nhận DONE",
    "Hai lựa chọn mỗi buổi, đồng bộ toàn bộ Reporter",
    "Tổng quan danh mục đang phục vụ",
    "Theo dõi tình trạng, mức sử dụng và giới hạn",
    "Cung cấp website và xử lý các yêu cầu nghiệp vụ.",
    "Một tài khoản được tính một lần dù mở nhiều phiên cùng quyền.",
    "Theo thời điểm xử lý; tối đa 60 ngày."
  ];
  for (const phrase of obsolete) assert.ok(!(web + hr).includes(phrase), "Owner-facing narrative remains: " + phrase);
  const longStaticParagraphs = [...web.matchAll(/<p(?:\s+[^>]*)?>([^<]{90,})<\/p>/g)]
    .map(m => m[1]).filter(p => !p.includes("${"));
  assert.ok(longStaticParagraphs.length <= 2, "Unexpected long static copy: " + longStaticParagraphs.join(" | "));
  assert.ok(web.includes("ROOT") && web.includes("Mật khẩu xác nhận"), "important action/security notice must stay");
});
