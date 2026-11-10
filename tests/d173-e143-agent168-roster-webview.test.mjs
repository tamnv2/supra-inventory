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
  if (version >= 179) {
    const e181 = JSON.parse(read("ops/d173-e181-agent179-release-authorization.json"));
    const overview = read("relay-agent/D173E179OverviewNoScroll.cs");
    assert.equal(e181.owner_code_approved, true);
    assert.deepEqual(e181.approved_components, ["agent"]);
    assert.equal(e181.agent_target_version, 179);
    assert.equal(e181.d172_mutation, false);
    assert.equal(e181.stable_mutation, false);
    assert.ok(program.includes("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 40F))"));
    assert.ok(program.includes("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 60F))"));
    assert.ok(overview.includes("overview.RowStyles[0].Height = 40F"));
    assert.ok(overview.includes("overview.RowStyles[1].Height = 60F"));
  } else if (version === 178) {
    const e179 = JSON.parse(read("ops/d173-e179-agent178-release-authorization.json"));
    const overview = read("relay-agent/D173E179OverviewNoScroll.cs");
    assert.equal(e179.owner_code_approved, true);
    assert.deepEqual(e179.approved_components, ["agent"]);
    assert.equal(e179.agent_target_version, 178);
    assert.equal(e179.d172_mutation, false);
    assert.equal(e179.stable_mutation, false);
    assert.match(program, /overviewLayout.RowStyles.Add\(new RowStyle\(SizeType.Percent, 50F\)\)/);
    assert.match(overview, /overview.RowStyles\[0\].Height = 50F/);
    assert.match(overview, /overview.RowStyles\[1\].Height = 50F/);
  } else if (version >= 177) {
    const e175 = JSON.parse(read("ops/d173-e175-release-authorization.json"));
    assert.equal(e175.checkpoint_id, "D173-E175");
    assert.equal(e175.owner_approved_code, true);
    assert.equal(e175.agent_target_version, 177);
    assert.equal(e175.no_stable, true);
    assert.equal(e175.d172_pending_hold, true);
    assert.match(program, /overviewLayout.RowStyles.Add\(new RowStyle\(SizeType.Percent, 60F\)\)/);
    assert.match(program, /overviewLayout.RowStyles.Add\(new RowStyle\(SizeType.Percent, 40F\)\)/);
  } else {
    assert.match(program, /overviewLayout.RowStyles.Add\(new RowStyle\(SizeType.Percent, 50F\)\)/);
    assert.doesNotMatch(program, /overviewLayout.RowStyles.Add\(new RowStyle\(SizeType.Percent, 60F\)\)/);
  }
  if (version >= 178) {
    assert.match(program, /compact && _manualPicklistConfirmAll.Visible && !bulkInline \? 114 : 80/);
  } else {
    assert.match(program, /compact && _manualPicklistConfirmAll.Visible \? 114 : 80/);
  }
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
  assert.match(roster, /_d173E140CloseAllCalls,\s*_d168GroupContact,\s*_d161BulkKickAllButton/);
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
  assert.match(browser, /IntPtr host = FindOwnedAgentBrowserFormNoLock\(\)/);
  assert.match(browser, /OwnedByAgentHostNoLock\(host\)/);
  assert.match(browser, /SendMessageTimeout\(host/);
  assert.match(program, /SizeEmbeddedWmsViewport\(\)/);
  assert.match(program, /ActivateEmbeddedWmsTab\(\)/);
  assert.equal(state.d173_e143.d172, "PENDING_HOLD_UNCHANGED");
  assert.equal(state.d173_e143.release, "NONE");
});
