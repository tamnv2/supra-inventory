import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const css = read("web/src/d173-tabler.css");
const view = read("web/src/operational-app.ts");
const legacy = read("web/src/legacy-transplant/web-unified-ui.css");
const legacyAccounts = read("web/src/legacy-transplant/d167-web-ux-recovery.css");
const scoped = css.slice(css.indexOf("/* D173-E267: FIELD 3.3.21 spacing repair"));

test("E267 RED reproduction: legacy margin and padding values survived the E264 gap-only fix", () => {
  assert.match(legacy, /min-height:\s*42px;\s*margin:\s*0 0 14px !important;/);
  assert.match(legacy, /\.ops-panel-title \{ margin-bottom: 12px !important; \}/);
  assert.match(legacyAccounts, /\.users-workspace \.users-mode-tabs \{[^}]*margin:0 0 12px;/);
  assert.match(legacyAccounts, /\.users-workspace \.users-top-grid \{[^}]*margin:0 0 10px !important;/);
  assert.match(view, /class="ops-grid-two" style="display:grid;grid-template-columns:repeat\(auto-fit,minmax\(270px,1fr\)\);gap:14px"/);
  assert.match(view, /class="d167-meal-form"[^>]*style="[^"]*gap:12px;[^"]*margin-top:14px"/);
});

test("E267: outer page inset overrides the legacy role-scoped important padding", () => {
  assert.ok(scoped.startsWith("/* D173-E267:"), "FIELD layout override missing");
  assert.match(scoped, /body \.d173-tabler-shell > \.d173-page-content:not\(:has\(\.ops-business-workspace\)\)\s*\{[^}]*padding:\s*4px 6px 24px !important;/s);
});

test("E267: actual workspace roots normalize vertical rhythm, not just nested grid gaps", () => {
  for (const cls of [".users-workspace", ".tools-workspace", ".sku-workspace", ".sla-workspace",
                      ".logs-workspace", ".reset-workspace", ".system-workspace", ".account-workspace"]) {
    assert.ok(scoped.includes(cls), "missing route " + cls);
  }
  assert.match(scoped, /flex-direction:\s*column;/);
  assert.match(scoped, /gap:\s*var\(--d173-ui-gap\) !important;/);
  assert.match(scoped, /:is\(\.business-summary-grid, \.business-page-head, \.workspace-tabs, \.users-top-grid, \.users-list-summary, \.ops-panel\)/);
  assert.match(scoped, /margin:\s*0 !important;/);
  assert.match(scoped, /min-height:\s*0 !important;/);
});

test("E267: meal controls, form actions and section titles use real compact geometry", () => {
  assert.match(scoped, /\.d167-meal-form, \.d167-meal-edit/);
  assert.match(scoped, /margin-top:\s*var\(--d173-ui-gap\) !important;/);
  assert.match(scoped, /\.ops-panel-title\s*\{[^}]*margin-bottom:\s*var\(--d173-ui-gap\) !important;/s);
  assert.match(scoped, /\.users-top-grid \.users-filter-panel/);
  assert.match(scoped, /padding:\s*8px 10px !important;/);
  assert.match(scoped, /\.users-workspace \.users-filter-form \.ops-form-actions/);
  assert.match(scoped, /padding:\s*0 !important;/);
});

test("E267: preserve fixed Operations/Report scrolling, shell zoom, field status and D172 separation", () => {
  assert.doesNotMatch(scoped, /(?:^|[;{]\s*)overflow(?:-[xy])?\s*:/m);
  assert.doesNotMatch(scoped, /(?:^|[;{]\s*)height\s*:/m);
  assert.match(css, /\.ops-business-workspace \.fast-list/);
  assert.match(css, /height:\s*calc\(100dvh \/ var\(--supra-ui-zoom-factor, 1\)\) !important/);
  assert.match(read("web/src/web-version.ts"), /WEB_VERSION = "3\.3\.21"/);
});
