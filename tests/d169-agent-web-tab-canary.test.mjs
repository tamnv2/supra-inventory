import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const program = read("relay-agent/Program.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const ownedHost = read("relay-agent-webview2-host/Program.cs");
const channel = read("relay-agent/VERSION").trim();

test("v134 remains newer than released v132 and v133 canary", () => {
  assert.equal(channel, "134");
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild\s*=\s*134\s*;/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /0\.134\.0\.0/);
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

test("v134 offers tab show and hide on the same persistent button without closing WMS", () => {
  assert.match(program, /_toggleWmsTab\.Click \+= \(s, e\) => ToggleWmsWebTab\(\)/);
  assert.match(program, /_toggleWmsTab\.Text = "Ẩn tab trình duyệt"/);
  assert.match(program, /_toggleWmsTab\.Text = "Hiển thị tab trình duyệt"/);
  assert.match(program, /_mainTabs\.TabPages\.Remove\(_wmsWebTab\)/);
  assert.match(program, /_mainTabs\.TabPages\.Add\(_wmsWebTab\)/);
  assert.match(program, /if \(_wmsTabUserHidden\)/);
  assert.match(program, /VerifyCurrentAgentPasswordForBrowserAction/);
  assert.doesNotMatch(program.slice(program.indexOf("private void ToggleWmsWebTab()"), program.indexOf("private void SizeEmbeddedWmsViewport()")), /StopManagedBrowser|ConfirmExact|Page\.reload/);
});

test("v132 updater can jump directly to v134 using existing signed checksum channel", () => {
  const updater = read("relay-agent/AgentUpdater.cs");
  const config = read("relay-agent/AgentConfig.cs");
  assert.match(updater, /latest\.Build <= AgentConfig\.AgentBuild/);
  assert.match(updater, /ParseChecksum\(checksumText\)/);
  assert.match(updater, /DownloadFile\(latest\.ExeUrl/);
  assert.match(config, /AgentUpdateManifestUrl = ApiBaseUrl/);
  assert.match(config, /AgentUpdateExeUrl = ApiBaseUrl/);
});
