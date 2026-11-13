import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const css = read("web/src/d173-tabler.css");
const view = read("web/src/operational-app.ts");
const e264 = css.slice(css.indexOf("/* D173-E264: one compact geometry authority"));

test("E264: every authenticated Web workspace shares compact spacing and radii", () => {
  assert.ok(e264.startsWith("/* D173-E264:"), "Missing unified geometry overrides");
  for (const token of ["--d173-ui-gap: 6px", "--d173-ui-card-radius: 5px", "--d173-ui-panel-radius: 4px", "--d173-ui-control-radius: 4px"]) {
    assert.ok(e264.includes(token), "Missing geometry token " + token);
  }
  for (const selector of [
    ".business-summary-card", ".d173-overview-kpi", ".d173-overview-panel",
    ".sla-current-card", ".sla-threshold-card", ".sla-policy-card",
    ".tool-card", ".d167-meal-card", ".ops-panel", ".table-wrap",
    ".log-row", ".workspace-tab", ".workspace-tabs", ".d173-ops-toolbar",
    ".sku-kpi-grid", ".system-service-grid", ".reset-card-grid",
    ".system-service-card", ".reset-card", ".reset-security-panel",
    ".sku-provenance-panel", ".users-create-panel", ".log-list-panel",
    ".d173-report-toolbar", ".users-filter-panel", ".report-filter-panel",
  ]) assert.ok(e264.includes(selector), "Missing workspace coverage " + selector);
});

test("E264: unified tabs and controls are aligned without changing existing scroll behavior", () => {
  assert.match(e264, /\.d173-page-content \.workspace-tab\s*\{[^}]*align-items:\s*center;[^}]*min-height:\s*35px;/s);
  assert.match(e264, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  assert.doesNotMatch(e264, /(?:^|[;{]\\s*)(?:overflow|position|grid-template|height)\\s*:/m);
  assert.match(css, /height:\s*calc\(100dvh \/ var\(--supra-ui-zoom-factor, 1\)\) !important/);
  assert.match(css, /\.d173-tabler-shell \.ops-business-workspace \.fast-list/);
});

test("E264: only CSS presentation changes; existing business and Web3.3.20 source contracts stay intact", () => {
  for (const token of ["renderOperationalTabs", "renderDashboard", "renderShiftOperations", "renderSla", "renderTools"]) {
    assert.ok(view.includes(token), token);
  }
  assert.ok(read("web/src/web-version.ts").includes('WEB_VERSION = "3.3.20"'));
});
