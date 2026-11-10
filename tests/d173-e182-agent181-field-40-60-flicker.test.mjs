import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const layout = read("relay-agent/D173E179OverviewNoScroll.cs");
const form = read("relay-agent/Program.cs");
const roster = read("relay-agent/D119AgentFeatures.cs");

test("E182 Owner FIELD FAIL: 40/60 outer and exact 34/33/33 + 50/50 inner", () => {
  assert.match(layout, /overview\.RowStyles\[0\]\.Height = 40F;/);
  assert.match(layout, /overview\.RowStyles\[1\]\.Height = 60F;/);
  for (const v of ["34F","33F","33F"])
    assert.ok(layout.includes("new ColumnStyle(SizeType.Percent, " + v + ")"));
  assert.match(layout, /threeColumns\.ColumnStyles\.Add\(new ColumnStyle\(SizeType.Percent, 34F\)\);\s*threeColumns\.ColumnStyles\.Add\(new ColumnStyle\(SizeType.Percent, 33F\)\);\s*threeColumns\.ColumnStyles\.Add\(new ColumnStyle\(SizeType.Percent, 33F\)\);/);
  assert.doesNotMatch(layout, /D173E182FitMiddleStack/);
  assert.match(layout, /middle\.RowStyles\.Add\(new RowStyle\(SizeType.Percent, 50F\)\);\s*middle\.RowStyles\.Add\(new RowStyle\(SizeType.Percent, 50F\)\);/);
});

test("Agent resource refresh does not synchronously repaint/resize the entire card", () => {
  const start = roster.indexOf("private void RefreshD130ResourceClock()");
  const end = roster.indexOf("private void SetD128ResourceMonitoringPaused()", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(roster.slice(start, end), /\.Refresh\(\)/);
  assert.match(roster.slice(start, end), /if \(_d128AgentResourceStatus\.Text != agentText\)/);
  assert.match(roster.slice(start, end), /if \(_d128BrowserResourceStatus\.Text != browserText\)/);
  const from = layout.indexOf("foreach (var label in new Control[] {");
  const to = layout.indexOf("private void D173E179FitAgentFleet", from);
  const events = layout.slice(from, to);
  assert.doesNotMatch(events, /_d128AgentResourceStatus/);
  assert.doesNotMatch(events, /_d128BrowserResourceStatus/);
  assert.match(layout, /var resourceSample = /);
  assert.match(layout, /measuredText = "CPU: 100,0%/);
});

test("Overtime schedule tick cannot reassign responsive Agent fleet geometry", () => {
  const start = form.indexOf("private void ApplyAfterHoursAgentLayout(bool visible)");
  const end = form.indexOf("private bool IsBusinessAllowed()", start);
  assert.ok(start >= 0 && end > start);
  const section = form.slice(start, end);
  assert.match(section, /D173E182FitAgentHeader\(host\) \+ 6/);
  assert.match(section, /if \(_d173E182AdaptiveTopReady && host != null\)/);
  assert.match(section, /D173E179FitAgentFleet\(host\);/);
  assert.match(section, /if \(_afterHoursPanel\.Visible != visible\)/);
});

test("Roster buttons are equally sized and Website reports online/known total", () => {
  assert.match(roster, /var equalMinimum = Math\.Max/);
  assert.match(roster, /var uniform = Math\.Max\(48/);
  assert.match(roster, /SetD173BoundsIfChanged\(tabs\[i\], x, 1, uniform, 29\)/);
  assert.match(roster, /webOnline\.ToString\("N0"\) \+ "\/" \+/);
  assert.match(roster, /\(webOnline \+ webOffline\)\.ToString\("N0"\)/);
  assert.match(roster, /"Tất cả", "Agent", "Website"/);
  assert.match(layout, /grid\.ScrollBars = ScrollBars\.Vertical;/);
  assert.match(layout, /_agentFleetGrid\.ScrollBars = ScrollBars\.None;/);
  assert.match(layout, /_manualPicklistGrid\.ScrollBars = ScrollBars\.None;/);
});
