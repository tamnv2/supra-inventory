import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(file, "utf8");
const layout = read("relay-agent/D173E179OverviewNoScroll.cs");
const roster = read("relay-agent/D119AgentFeatures.cs");
const program = read("relay-agent/Program.cs");

test("E182 FIELD fail stays within existing Agent WinForms 40/60 overview", () => {
  assert.match(program, /new RowStyle\(SizeType\.Percent, 40F\)/);
  assert.match(program, /new RowStyle\(SizeType\.Percent, 60F\)/);
  assert.match(layout, /viewport\.AutoScroll = false/);
  assert.match(layout, /grid\.ScrollBars = ScrollBars\.Vertical/);
  assert.match(layout, /_agentFleetGrid\.ScrollBars = ScrollBars\.None/);
  assert.match(layout, /_manualPicklistGrid\.ScrollBars = ScrollBars\.None/);
  assert.match(layout, /viewport\.ClientSize\.Height >= 310/);
  assert.match(layout, /D173E182FitMiddleStack\(middle, supra\)/);
});

test("E182 session columns derive widths from currently rendered text, not constant ratios", () => {
  assert.match(layout, /var rowCount = grid\.Rows\.Count/);
  assert.match(layout, /for \(var r = 0; r < rowCount; r \+= step\)/);
  assert.match(layout, /TextRenderer\.MeasureText\(/);
  assert.match(layout, /col\.HeaderText/);
  assert.match(layout, /Convert\.ToString\(cell\.Value\)/);
  assert.match(layout, /desired\[i\] = Math\.Max\(min\[i\], Math\.Min\(max, measured\)\)/);
  assert.match(layout, /var available = Math\.Max\(1, grid\.ClientSize\.Width -/);
  assert.match(layout, /remaining = available - sumMin/);
  assert.match(layout, /var weightedNeed = 0d/);
  assert.match(layout, /var preferred = new\[\] \{ 3, 0, 4, 1 \}/);
  assert.match(layout, /if \(col\.Width != widths\[i\]\) col\.Width = widths\[i\]/);
  assert.match(roster, /D173E179FitRosterColumns\(\);\s*\}\s*\n\s*private void/);
  assert.match(roster, /if \(cell\.ToolTipText != value\) cell\.ToolTipText = value/);
  assert.match(layout, /grid\.SuspendLayout\(\)/);
  assert.doesNotMatch(layout, /var ratios = new\[\] \{ 0\.17, 0\.20, 0\.13, 0\.19, 0\.12, 0\.19 \};[\s\S]*?private void D173E179FitRosterColumns/);
});

test("E182 measured layout supersedes legacy fixed-coordinate handlers", () => {
  assert.match(roster, /if \(_d173E182AdaptiveTopReady\) \{ D173E179CompactWebLayout\(_supraCard\); return; \}/);
  assert.match(roster, /if \(_d173E182AdaptiveTopReady && authenticated\)\s*D173E179FitAgentFleet\(host\)/);
  assert.match(layout, /_d173E182AdaptiveTopReady = true/);
  assert.match(layout, /label\.TextChanged \+=/);
  assert.match(layout, /var actionTop = resourceTop \+ resourceHeight \+ 5/);
  assert.match(layout, /if \(actionX > left && actionX \+ actionWidth > host\.ClientSize\.Width - left\)/);
  assert.match(layout, /_afterHoursPanel\.Bottom \+ 5/);
  assert.match(layout, /gridHeight = Math\.Min\(remaining, measuredGrid\)/);
  assert.match(program, /var gridHeight = Math\.Max\(28,\s*height - gridTop - statusBottom - statusHeight - gap\)/);
});

test("E182 session toolbar reflow follows actual captions and keeps original actions", () => {
  assert.match(roster, /var tabMinimums = tabs\.Select\(measuredButton\)\.ToArray\(\)/);
  assert.match(roster, /var actionMinimums = actions\.Select\(measuredButton\)\.ToArray\(\)/);
  assert.match(roster, /var singleRow = width >= required/);
  assert.match(roster, /var toolbarHeight = singleRow \? 32 : 68/);
  for (const action of [
    "_d173E148ManualRefreshButton", "_d173E140CloseAllCalls",
    "_d168GroupContact", "_d161BulkKickAllButton", "_d173RosterTech"
  ]) assert.ok(roster.includes(action));
  assert.match(roster, /_pickerOnlineGrid\.ScrollBars = ScrollBars\.Vertical/);
  assert.match(program, /Task\.Run\(\(\) => ConfirmManualPicklist\(code\)\)/);
});
