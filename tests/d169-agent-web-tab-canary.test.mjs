import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const program = read("relay-agent/Program.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const ownedHost = read("relay-agent-webview2-host/Program.cs");
const channel = read("relay-agent/VERSION").trim();

test("Agent keeps v138+ WMS tab behavior and versioned build identity", () => {
  assert.ok(Number(channel) >= 138);
  assert.match(read("relay-agent/AgentConfig.cs"), new RegExp("AgentBuild\\s*=\\s*" + channel + "\\s*;"));
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), new RegExp("<FileVersion>0\\." + channel + "\\.0\\.0</FileVersion>"));
});

test("WMS tab is a real resizable Agent tab, not a second WMS login", () => {
  assert.match(program, /new TabPage\("Web Confirm"\)/);
  assert.match(program, /_mainTabs\.TabPages\.Add\(_wmsWebTab\)/);
  assert.match(program, /_wmsWebViewport\.Resize\s*\+=/);
  assert.match(program, /TryEmbedAgentWindow\(_wmsWebViewport\.Handle/);
  assert.match(program, /_mainTabs\.SelectedTab = _wmsWebTab/);
  assert.match(program, /_supraBrowser\.Hide\(\)/);
});

test("only Agent-owned x64 host may be reparented", () => {
  assert.match(browser, /_launchMode != BrowserLaunchMode\.Agent/);
  assert.match(browser, /OwnedByAgentHostNoLock/);
  assert.match(browser, /SetParent\(host, tabHandle\)/);
  assert.match(browser, /GetParent\(host\) != tabHandle/);
  assert.match(browser, /MoveWindow\(host, 0, 0, width, height, true\)/);
  assert.match(browser, /EnumWindows does not enumerate child windows after SetParent/);
  assert.doesNotMatch(browser, /Network\.enable/);
});

test("preserve the existing child-page WMS Confirm and hidden read-only SKU export", () => {
  assert.match(ownedHost, /e\.NewWindow = child\.CoreWebView2/);
  assert.match(ownedHost, /_skuExportWeb = skuChild/);
  assert.match(ownedHost, /CoreWebView2Environment\.CreateAsync/);
  assert.match(browser, /AgentBrowserStorage\.CurrentRoot/);
  assert.match(browser, /Page\.navigate/);
  assert.match(browser, /Runtime\.enable/);
});

test("v135 preserves Web tab show and hide button without closing WMS", () => {
  assert.match(program, /_toggleWmsTab\.Click \+= \(s, e\) => ToggleWmsWebTab\(\)/);
  assert.match(program, /_toggleWmsTab\.Text = "Ẩn tab trình duyệt"/);
  assert.match(program, /_toggleWmsTab\.Text = "Hiển thị tab trình duyệt"/);
  assert.match(program, /_mainTabs\.TabPages\.Remove\(_wmsWebTab\)/);
  assert.match(program, /_mainTabs\.TabPages\.Add\(_wmsWebTab\)/);
  assert.match(program, /if \(_wmsTabUserHidden\)/);
  assert.match(program, /VerifyCurrentAgentPasswordForBrowserAction/);
  assert.doesNotMatch(program.slice(program.indexOf("private void ToggleWmsWebTab()"), program.indexOf("private void SizeEmbeddedWmsViewport()")), /StopManagedBrowser|ConfirmExact|Page\.reload/);
});

test("v132 updater can jump directly to v135 using existing signed checksum channel", () => {
  const updater = read("relay-agent/AgentUpdater.cs");
  const config = read("relay-agent/AgentConfig.cs");
  assert.match(updater, /latest\.Build <= AgentConfig\.AgentBuild/);
  assert.match(updater, /ParseChecksum\(checksumText\)/);
  assert.match(updater, /DownloadFile\(latest\.ExeUrl/);
  assert.match(config, /AgentUpdateManifestUrl = ApiBaseUrl/);
  assert.match(config, /AgentUpdateExeUrl = ApiBaseUrl/);
});

test("D173 owner-requested no duplicate browser toolbar keeps all normal tabs and protected WMS toggle logic", () => {
  const layout = program.slice(program.indexOf("// D169 v135: two exclusive layout rows."), program.indexOf("shell.Controls.Add(footer, 0, 2)"));
  assert.match(layout, /new TableLayoutPanel/);
  assert.match(layout, /RowCount = 2/);
  assert.match(layout, /tabShell\.RowStyles\.Add\(new RowStyle\(SizeType\.Absolute, 0F\)\)/);
  assert.match(layout, /tabActions\.Visible = false/);
  assert.match(layout, /_toggleWmsTab\.Visible = false/);
  assert.match(layout, /tabShell\.RowStyles\.Add\(new RowStyle\(SizeType\.Percent, 100F\)\)/);
  assert.match(layout, /tabShell\.Controls\.Add\(tabActions, 0, 0\)/);
  assert.match(layout, /InstallD173E038Sidebar/);
  const sidebar = read('relay-agent/D173E038Sidebar.cs');
  assert.ok(sidebar.includes('host.Controls.Add(_mainTabs, 1, 1)'));
  assert.ok(sidebar.includes('_mainTabs.TabPages.Contains(captured)'));
  assert.doesNotMatch(layout, /BringToFront\(\)/);
  for (const original of ['_overviewPage','_connectionPage','_d167SkuPage','_wmsWebTab']) {
    assert.match(program, new RegExp('_mainTabs\\.TabPages\\.Add\\(' + original + '\\)'));
  }
  assert.match(program, /D169TabHeaderLayoutSelfTest\(\)/);
  assert.match(program, /D173_E038_SIDEBAR_SMOKE/);
  assert.ok(program.includes('_d173SidebarNav.Controls.OfType<Button>'));
});
