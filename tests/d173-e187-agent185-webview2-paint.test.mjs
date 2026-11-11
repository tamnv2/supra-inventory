import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path, "utf8");
const host = read("relay-agent-webview2-host/Program.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const bundle = read("relay-agent/AgentBrowserBundle.cs");
const workflow = read(".github/workflows/verify-relay-agent.yml");

test("E187 regression reproduces Host13 DOM-ready but paint-unverified popup", () => {
  assert.match(browser, /paint_proof=UNVERIFIED navigation=NONE/);
  assert.match(host, /e.NewWindow = child.CoreWebView2/);
  assert.match(host, /_activeWeb = child;/);
  assert.match(browser, /_embeddedTabHandle != expectedParent/);
});

test("Host14 requests controller presentation sync after cross-process WM_SIZE and popup switch", () => {
  assert.match(host, /PresentationSyncMessage = 0x8000 \+ 0x342/);
  assert.match(host, /m.Msg == 0x0005 .*WM_SIZE/);
  assert.match(host, /m.Msg == 0x0047 .*WM_WINDOWPOSCHANGED/);
  assert.match(host, /var view = _activeWeb/);
  assert.match(host, /view.Size = new Size\(width, height - 1\)/);
  assert.match(host, /view.Size = new Size\(width, height\)/);
  assert.match(host, /view.Invalidate\(true\)/);
  assert.match(host, /child.BringToFront\(\);\s*TrimRetiredChildren\(\);\s*QueuePresentationSync\(\);/);
  const sync = host.slice(host.indexOf("private void QueuePresentationSync()"),host.indexOf("protected override bool ProcessCmdKey"));
  assert.doesNotMatch(sync, /Navigate\(|Source =|Dispose\(|Enabled =|EnsureCoreWebView2/);
});

test("Agent185 native wake requests Host14 sync on the exact verified embedded HWND", () => {
  const m = browser.slice(browser.indexOf("internal bool InvalidateEmbeddedOnTabActivation("),browser.indexOf("internal bool IsReady()"));
  assert.match(m,/GetWindow\(_embeddedHostWindow, 4/);
  assert.match(m,/SendMessageTimeout\(_embeddedHostWindow, 0x8000u \+ 0x342u/);
  assert.match(m,/paint_proof=UNVERIFIED navigation=NONE/);
  assert.doesNotMatch(m,/Navigate\(|Page.reload|StartOwnedWebView2|StopManagedBrowser/);
});

test("Historical Agent185 Host14 remains in workflow while Agent186 retains Host14", () => {
  assert.equal(read("relay-agent/VERSION").trim(),"186");
  assert.match(read("relay-agent/AgentConfig.cs"),/AgentBuild = 186;/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"),/0\.186\.0\.0/);
  assert.match(bundle,/RequiredHostBuild = 14;/);
  assert.match(workflow,/D173-E187_AGENT185_ONLY_RELEASE:/);
  assert.match(workflow,/hostBuildMatch/);
});
