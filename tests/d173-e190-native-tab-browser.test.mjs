import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(file, "utf8");
const bridge = read("relay-agent/SupraConfirmBrowser.cs");
const ui = read("relay-agent/AgentFormE190Web.cs");
const renderer = read("relay-agent/AgentTabWebView2Browser.cs");
const agent = read("relay-agent/Program.cs");
const project = read("relay-agent/SupraInventoryRelayAgent.csproj");

test("E190 Agent uses real in-process WebView2 tab, not foreign HWND overlay", () => {
  const section = bridge.slice(bridge.indexOf("private void StartNoLock("),
      bridge.indexOf("private void StartOwnedWebView2NoLock("));
  assert.match(section, /StartNativeTabWebView2NoLock\(ownedHost, fixedRuntime\)/);
  assert.match(section, /Process.GetCurrentProcess\(\)/);
  assert.match(section, /_embeddedBridge\.Start\(_port, fixedRuntime, profile\)/);
  assert.doesNotMatch(section, /StartOwnedWebView2NoLock\(ownedHost, fixedRuntime\)/);
  assert.match(renderer, /class AgentTabWebView2Browser : UserControl/);
  assert.match(renderer, /Controls.Add\(_initial\)/);
  assert.match(ui, /_wmsWebViewport\.Controls.Add\(browser\)/);
  assert.match(project, /Microsoft.Web.WebView2.*1\.0\.4191\.47/);
  assert.match(agent, /ConfigureE190NativeBrowser\(\)/);
});

test("E190 navigation, login and confirm reuse canonical CDP rather than new WMS API", () => {
  assert.match(bridge, /AttachDevToolsNoLock\(TimeSpan.FromSeconds\(20\)\)/);
  assert.match(bridge, /private void NavigateConfirmNoLock\(\)/);
  assert.match(bridge, /CommandNoLock\("Page.navigate"/);
  assert.match(renderer, /Navigate\("about:blank"\)/);
  assert.match(renderer, /e.NewWindow = child.CoreWebView2/);
  assert.match(renderer, /SKU_READONLY preserving_confirm=true/);
  assert.match(renderer, /session_extract=false/);
  assert.doesNotMatch(renderer, /HttpWebRequest|HttpClient|fetch\(|document\.cookie/);
});

test("E190 input shield and failure are fail closed, no automatic WMS reload", () => {
  assert.match(bridge, /_embeddedBridge\?\.Protect\(protect\) == true/);
  assert.match(bridge, /if \(_agentNativeTab\)/);
  assert.match(renderer, /private bool _protected = true/);
  assert.match(renderer, /_rendererFailed = true/);
  assert.match(renderer, /if \(!Ready \|\| \(!protect && _rendererFailed\)\) return false/);
  assert.match(renderer, /action=FAIL_CLOSED_NO_RELOAD/);
  assert.match(renderer, /CoreWebView2\.NewWindowRequested/);
  assert.doesNotMatch(renderer, /SetParent\(/);
});

test("E190 diagnostics do not write screenshot, URL or password", () => {
  assert.match(renderer, /CapturePreviewAsync/);
  assert.match(renderer, /sample_count=/);
  assert.match(renderer, /private static string UrlClass\(/);
  assert.match(agent, /E190_AUTH probe=FAIL role=/);
  assert.match(agent, /SafeFirebaseErrorCode\(ex.Detail\)/);
  assert.match(agent, /credentials_logged=false/);
  assert.doesNotMatch(renderer, /File\.WriteAllBytes|File\.WriteAllText|Convert\.ToBase64String/);
  assert.doesNotMatch(agent.slice(agent.indexOf("private AgentSession FirebasePasswordLoginDirect("),
     agent.indexOf("private void PairLogin()")), /Log\(.*password/);
});

test("E190 postpones header overlap change until separate Owner deployment", () => {
  const header = agent.slice(agent.indexOf("private void SetAgentAuthUi(bool authenticated)"),
    agent.indexOf("private void LogoutAgent()"));
  assert.doesNotMatch(header, /if \(authenticated\) _agentAuthStatus\.Visible = false/);
});
