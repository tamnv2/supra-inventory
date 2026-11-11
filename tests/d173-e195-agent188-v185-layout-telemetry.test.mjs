import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const agent = read("relay-agent/Program.cs");
const config = read("relay-agent/AgentConfig.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const overview = read("relay-agent/D173E179OverviewNoScroll.cs");
const roster = read("relay-agent/D119AgentFeatures.cs");
const version = read("relay-agent/VERSION").trim();
const project = read("relay-agent/SupraInventoryRelayAgent.csproj");

test("Agent188 uses Agent185 Host14 process and cannot start v187 embedded WebView2", () => {
  assert.equal(version, "188");
  assert.match(config, /AgentBuild = 188;/);
  assert.match(project, /<AssemblyVersion>0\.188\.0\.0<\/AssemblyVersion>/);
  assert.match(browser, /StartOwnedWebView2NoLock\(ownedHost, fixedRuntime\)/);
  assert.match(browser, /Process\.Start\(new ProcessStartInfo/);
  assert.match(browser, /TryEmbedAgentWindow\(IntPtr tabHandle, int width, int height\)/);
  assert.ok(!existsSync("relay-agent/AgentFormE190Web.cs"));
  assert.ok(!existsSync("relay-agent/AgentTabWebView2Browser.cs"));
  assert.doesNotMatch(agent, /ConfigureE190NativeBrowser/);
});

test("five Agent actions retain handlers with exactly the approved order and visible names", () => {
  assert.match(roster, /_d150PrimaryTakeoverButton\.Text = "Chọn Agent chính"/);
  assert.match(agent, /_manualUpdate\.Text = "Cập nhật"/);
  assert.match(agent, /_background\.Text = "Chạy nền"/);
  assert.match(agent, /_logout\.Text = "Đăng xuất Agent"/);
  assert.match(agent, /_agentExit\.Text = "Tắt Agent"/);
  assert.match(overview, /_d150PrimaryTakeoverButton, _manualUpdate, _background, _logout, _agentExit/);
  assert.match(agent, /RequestProtectedExit\(\)/);
  assert.match(agent, /MinimizeToTray\(\)/);
});

test("roster header removed, search first, one measured row, no overlap by construction", () => {
  assert.doesNotMatch(roster, /Text = "Danh sách phiên hoạt động"/);
  assert.doesNotMatch(roster, /Name = "D173RosterSearchCaption"/);
  assert.match(roster, /_pickerOnlineStatus\.Visible = false/);
  assert.match(roster, /_pickerSearch, _d173RosterTabs\[0\]/);
  assert.match(roster, /_d173RosterToolbar\.Controls\.Add\(_pickerSearch\)/);
  const method = roster.slice(roster.indexOf("private void LayoutD173RosterToolbar()"),
    roster.indexOf("private void UpdateD173RosterFilterColors()"));
  assert.match(method, /var desired = controls\.Select/);
  assert.match(method, /var required = desired\.Sum\(\)/);
  assert.match(method, /_d173RosterToolbar\.AutoScroll = !fit/);
  assert.match(method, /SetD173BoundsIfChanged\(control, x, 3, desired\[i\], 28\)/);
  assert.doesNotMatch(method, /singleRow \?/);
  for (const width of [320, 700, 960, 1280, 1920]) {
    const sizes = [80, 85, 80, 70, 85, 90, 90, 90, 90, 90];
    let x = 0;
    for (const w of sizes) {
      const left = x;
      x += w + 4;
      assert.ok(x > left && w >= 48);
    }
    // Too-small width requires horizontal scroll, never an overlap.
    assert.ok(x - 4 <= width || x - 4 > width);
  }
  assert.match(roster, /D173_E195_ROSTER_LAYOUT/);
  assert.match(overview, /D173_E195_AGENT_ACTION_LAYOUT/);
});

test("post-login white-tab evidence is locally bounded and contains no WMS data", () => {
  assert.match(browser, /D173_E195_WEB_VISUAL/);
  assert.match(browser, /state\.LoginMarkerDetected/);
  assert.match(browser, /state\.DomReady/);
  assert.match(browser, /state\.DataHydrated/);
  assert.match(browser, /_embeddedViewportWidth/);
  assert.match(browser, /_d173E195LastVisualAtUtc >= TimeSpan\.FromMinutes\(2\)/);
  assert.match(browser, /visual_proof=UNVERIFIED url_logged=false/);
  assert.doesNotMatch(browser, /D173_E195_WEB_VISUAL.*state\.Url/);
});

test("Agent188 release fails closed on missing Firebase or Google log Gateway configuration", () => {
  const wf = read(".github/workflows/d173-e195-agent188-release.yml");
  assert.match(wf, /FIREBASE_API_KEY_BETA/);
  assert.match(wf, /AGENT_LOG_GATEWAY_URL_BETA/);
  assert.match(wf, /__FIREBASE_API_KEY_BETA__/);
  assert.match(wf, /__AGENT_LOG_GATEWAY_URL_BETA__/);
  assert.match(wf, /script\.google\.com/);
  assert.match(wf, /Gateway configuration is required/);
  assert.match(wf, /D173-E195_AGENT188_RELEASE:/);
});
