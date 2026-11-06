import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const program = read("relay-agent/Program.cs");
const roster = read("relay-agent/D119AgentFeatures.cs");
const monitor = read("relay-agent/D173E141VpsWebMonitor.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const state = JSON.parse(read("ops/project-state.json"));

test("D173-E143 Owner Agent168 version, 50/50 overview, compact PickList headers", () => {
  // E143 UI invariant survives later Agent revisions; version parity remains exact.
  const version = Number(read("relay-agent/VERSION").trim());
  assert.ok(version >= 168);
  assert.match(read("relay-agent/AgentConfig.cs"), new RegExp("AgentBuild\\s*=\\s*" + version + ";"));
  assert.match(program, /overviewLayout.RowStyles.Add\(new RowStyle\(SizeType.Percent, 50F\)\)/);
  assert.doesNotMatch(program, /overviewLayout.RowStyles.Add\(new RowStyle\(SizeType.Percent, 60F\)\)/);
  assert.match(program, /compact && _manualPicklistConfirmAll.Visible \? 114 : 80/);
  assert.match(program, /LayoutManualPicklistCard\(_manualPicklistGrid.Parent\)/);
});

test("D173-E143 one line roster, counted tabs, short search and same-row controls", () => {
  assert.match(roster, /private void LayoutD173RosterToolbar\(\)/);
  assert.match(roster, /_d173RosterToolbar.Controls.Add\(action\)/);
  assert.match(roster, /_pickerOnlineGrid.RowTemplate.Height = 31/);
  assert.match(roster, /if \(row.Height != 31\) row.Height = 31/);
  assert.match(roster, /_pickerOnlineGrid.DefaultCellStyle.WrapMode = DataGridViewTriState.False/);
  assert.match(roster, /labels\[i\] \+ " \(" \+ numbers\[i\] \+ "\)"/);
  assert.match(roster, /Math.Min\(370, w - 228\)/);
  assert.match(roster, /_d173E140CloseAllCalls, _d168GroupContact, _d161BulkKickAllButton/);
  assert.match(roster, /_d173WebPresenceUnavailable \? "—"/);
});

test("D173-E143 permanent tab and pinned toggles, no secondary password", () => {
  assert.doesNotMatch(program, /_toggleWmsTab.Click \+=/);
  assert.match(program, /_wmsWebTab.Controls.Add\(webTabLayout\)/);
  assert.match(program, /_wmsWebToolbar.Controls.Add\(_wmsLogout\)/);
  assert.match(monitor, /_wmsWebToolbar.Controls.Add\(_e141WebMonitorButton\)/);
  assert.doesNotMatch(monitor, /VerifyCurrentAgentPasswordForBrowserAction/);
  assert.match(monitor, /if \(!E141AuthorizedVps\(\)\) return/);
  assert.match(monitor, /if \(!HasAgentSession\(\) \|\| _supraBrowser == null/);
});

test("D173-E143 same Agent-owned WebView2 HWND and child-aware shield", () => {
  assert.match(program, /_supraBrowser.TryEmbedAgentWindow\(/);
  assert.match(browser, /GetParent\(host\) != tabHandle/);
  assert.match(browser, /SetParent\(host, tabHandle\)/);
  assert.match(browser, /IntPtr host = _embeddedHostWindow/);
  assert.match(browser, /OwnedByAgentHostNoLock\(host\)/);
  assert.match(browser, /SendMessageTimeout\(host/);
  assert.match(program, /SizeEmbeddedWmsViewport\(\)/);
  assert.match(program, /ActivateEmbeddedWmsTab\(\)/);
  assert.equal(state.d173_e143.d172, "PENDING_HOLD_UNCHANGED");
  assert.equal(state.d173_e143.release, "NONE");
});
