import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const web = read("web/src/operational-app.ts");
const css = read("web/src/d173-tabler.css");
const version = read("web/src/web-version.ts");
const pkg = JSON.parse(read("web/package.json"));

test("E237: redundant navigation-level titles are absent; operational subheadings remain", () => {
  for (const label of ["Danh mục SKU", "Nhân sự & tài khoản", "Tổng quan & báo cáo", "Thời gian xử lý", "Nhật ký", "Ca vận hành", "Đặt lại hệ thống", "Công cụ", "Tài khoản"]) {
    assert.doesNotMatch(web, new RegExp("<h2>" + label.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&") + "<\\/h2>"));
  }
  assert.match(web, /<h2>Giờ nghỉ · tạm dừng tự động Skip<\\/h2>/);
  assert.match(web, /id="export-reports"/);
  assert.match(web, /id="send-web-log"/);
  assert.match(web, /id="reset-select-all"/);
});

test("E237: compact spacing and rounded corners apply only outside Operations; no data logic change", () => {
  assert.match(css, /D173-E237: carry the compact Operations visual rhythm/);
  assert.match(css, /\.d173-page-content:not\(:has\(\.ops-business-workspace\)\)/);
  assert.match(css, /\.business-summary-card\s*\{/);
  assert.match(css, /padding:8px 10px !important/);
  assert.match(css, /border-radius:4px !important/);
});

test("E237: Dashboard, Accounts and Logs tabbars remain sticky in both themes", () => {
  assert.match(css, /:is\(\.report-workspace,\.users-workspace,\.logs-workspace\) > \.workspace-tabs\s*\{[\s\S]*?position:sticky;[\s\S]*?top:0;/);
  assert.match(css, /body\[data-theme="dark"\].*:is\(\.report-workspace,\.users-workspace,\.logs-workspace\) > \.workspace-tabs \.workspace-tab\.active/);
  assert.match(web, /aria-label="Tổng quan và báo cáo"/);
  assert.match(web, /class="workspace-tabs users-mode-tabs"/);
  assert.match(web, /aria-label="Nguồn nhật ký"/);
});

test("E237: Web 3.3.15 is candidate only; existing network and RBAC handlers remain untouched", () => {
  assert.match(version, /WEB_VERSION = "3\.3\.15"/);
  assert.equal(pkg.version, "3.3.15");
});
