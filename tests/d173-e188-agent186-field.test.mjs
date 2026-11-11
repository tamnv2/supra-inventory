import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const agent = read("relay-agent/Program.cs");
const overview = read("relay-agent/D173E179OverviewNoScroll.cs");
const roster = read("relay-agent/D119AgentFeatures.cs");
const host = read("relay-agent-webview2-host/Program.cs");

test("E188 reproducer: prevent cross-process SetParent that whites out loaded WMS WebView2", () => {
  const overlay = browser.slice(browser.indexOf("internal bool TryEmbedAgentWindow("),
    browser.indexOf("private bool OwnedByAgentHostNoLock("));
  assert.doesNotMatch(overlay, /SetParent\s*\(/);
  assert.match(overlay, /GetAncestor\(tabHandle, 2/);
  assert.match(overlay, /ClientToScreen\(tabHandle, ref origin\)/);
  assert.match(overlay, /SetWindowLongPtr\(host, -8/);
  assert.match(overlay, /GetWindow\(host, 4 \/\* GW_OWNER \*\/\) != owner/);
  assert.match(overlay, /WS_POPUP/);
  assert.doesNotMatch(overlay, /NavigateConfirm|Page\.reload|StopManagedBrowser|StartNoLock/);
  assert.match(host, /e.NewWindow = child.CoreWebView2/);
  assert.match(host, /_activeWeb = child;/);
});

test("E188 overlay hides outside tab/tray and tracks RDP window relocation without polling", () => {
  assert.match(browser, /internal void SetAgentTabVisibility\(bool visible\)/);
  assert.match(browser, /_embeddedTabVisible = visible/);
  assert.match(browser, /visible && attached && _embeddedTabVisible/);
  assert.match(agent, /else if \(_supraBrowser != null\)\s*_supraBrowser.SetAgentTabVisibility\(false\)/);
  assert.match(agent, /Move \+= \(s, e\) => SizeEmbeddedWmsViewport\(\)/);
  assert.match(agent, /_supraBrowser\?\.SetAgentTabVisibility\(false\);\s*var parentEpoch/);
  assert.match(agent, /Show\(\);\s*ApplyWorkingAreaMaximum\(\);\s*Activate\(\);\s*if \(_mainTabs.SelectedTab == _wmsWebTab\)/);
  assert.match(browser, /paint_proof=UNVERIFIED navigation=NONE/);
});

test("E188 five action controls have exact Owner order and preserve original handlers", () => {
  const actions = overview.slice(overview.indexOf("private int D173E182FitAgentHeader("),
    overview.indexOf("private void InstallD173E179WebTools("));
  assert.match(actions,
    /_d150PrimaryTakeoverButton, _manualUpdate, _background, _logout, _agentExit/);
  assert.match(agent, /_manualUpdate.Text = "Cập nhật"/);
  assert.match(agent, /_background.Text = "Xuống nền"/);
  assert.match(roster, /_d150PrimaryTakeoverButton.Text = "Chuyển Agent chính"/);
  assert.match(agent, /_agentExit.Text = "Tắt Agent"/);
});

test("E188 HD/HD+ layout is measured before 34/33/33 and Web buttons wrap", () => {
  assert.match(overview, /D173E188CanUseThreeColumns\(/);
  assert.match(overview, /TextRenderer.MeasureText\(button.Text/);
  assert.match(overview, /height >= requiredAgent && height \/ 2 >=/);
  assert.match(overview, /var useThree = D173E188CanUseThreeColumns\(/);
  assert.match(overview, /var firstRowFits = firstMin \+ secondMin \+ 6 <= inner/);
  assert.match(overview, /firstTop \+ \(firstRowFits \? 0 : 31\)/);
});

test("E188 live roster count reflow does not allocate space to hidden actions", () => {
  const source = roster.slice(roster.indexOf("private void LayoutD173RosterToolbar("),
    roster.indexOf("private void UpdateD173RosterFilterColors("));
  assert.match(source, /_d173RosterTech, _d173E148ManualRefreshButton/);
  assert.match(source, /\.Where\(c => c.Visible\)\.ToList\(\)/);
  assert.match(source, /_d173E182ToolbarFitting/);
  assert.match(source, /SetD173BoundsIfChanged\(_d173RosterToolbar/);
  assert.match(source, /tab.AutoEllipsis = true/);
});

test("E188 source is Agent186 only, reusing already released Host14", () => {
  assert.equal(read("relay-agent/VERSION").trim(), "186");
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild = 186;/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /0\.186\.0\.0/);
  assert.match(read("relay-agent/AgentBrowserBundle.cs"), /RequiredHostBuild = 14;/);
});
