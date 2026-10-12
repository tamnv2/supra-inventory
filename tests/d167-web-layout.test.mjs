import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../web/src/operational-app.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/src/legacy-transplant/d167-web-layout-density.css", import.meta.url), "utf8");
const route = (start, end) => ui.slice(ui.indexOf(start), ui.indexOf(end));
test("D167 SLA overview is above authority and not moved into credential form", () => {
  const html = route('function renderSla(): string {', 'function renderReportTabs(');
  const idx = (key) => html.indexOf(key);
  assert.ok(idx('class="sla-current-grid"') > idx('class="business-page-head sla-page-head"'));
  assert.ok(idx('class="sla-current-grid"') < idx('class="sla-authority-strip"'));
  assert.ok(idx('class="sla-authority-strip"') < idx('id="sla-form"'));
  for(const value of ['sla-warning-count','sla-escalated-count','Sửa kết quả Đã có hàng / Skip','Tự động bỏ qua']) assert.ok(html.includes(value));
  for(const value of ['warningEnabled','escalationEnabled','autoSkipEnabled','autoSkipMode','skipToStockEnabled','currentPassword','sla-save-button']) assert.ok(html.includes(value));
});
test("D167 personnel forms keep identity and input names", () => {
  const html=route('function renderUsers(): string {','function renderSla(): string {');
  assert.match(html, /id="create-user-form" class="users-form-grid users-create-form"/);
  assert.match(html, /id="user-filter-form" class="users-form-grid users-filter-form"/);
  for(const value of ['username','displayName','role','authEmail','password','query','status','shortageReporting']) assert.ok(html.includes('name="'+value+'"'));
  assert.ok(html.includes('class="ops-users-table"'));
  assert.ok(html.includes('data-picker-action="REPORTING_ENABLE"'));
});
test("D167 logs and system reset preserve existing operations", () => {
  const logs=route('function renderLogs(): string {','function renderLegacyLogs(): string {');
  const reset=route('function renderSystemReset(): string {','function renderTools(): string {');
  assert.match(logs,/id="log-date-range" class="toolbar log-retention-window"/);
  assert.ok(logs.includes('name="from"') && logs.includes('name="to"'));
  for(const token of ['send-web-log','download-support-log','runtime-log-prev','runtime-log-next']) assert.ok(logs.includes(token));
  for(const token of ['reset-select-all','reset-refresh-preview','reset-read-relay','reset-root-password','reset-request-code','reset-execute']) assert.ok(reset.includes(token));
  assert.ok(reset.includes('data-reset-scope="${item.scope}"'));
  assert.ok(css.includes('.reset-workspace') && css.includes('.logs-workspace') && css.includes('.users-workspace'));
});
