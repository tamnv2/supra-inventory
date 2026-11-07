import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const host = read("relay-agent-webview2-host/Program.cs");

test("E146 targets only the named, owned BrowserForm instead of the first helper HWND", () => {
  assert.match(host, /Text = "SUPRA Confirm PickList · Agent"/);
  assert.match(host, /Text = _inputProtected/);
  assert.match(browser, /OwnedAgentBrowserTitlePrefix = "SUPRA Confirm PickList · Agent"/);
  assert.match(browser, /GetWindowText\(candidate, title, title.Capacity\)/);
  assert.match(browser, /candidatePid != pid/);
  assert.match(browser, /GetWindow\(candidate, 4 \/\* GW_OWNER \*\/\)/);
  // Host13 ShowInTaskbar=false may give the BrowserForm a hidden owner.
  // PID + exact title must win, without trusting arbitrary helper HWNDs.
  assert.doesNotMatch(browser, /candidatePid != pid \|\|/);
  assert.match(browser, /var hasWin32Owner = GetWindow\(candidate/);
  assert.match(browser, /GetWindowLong\(_embeddedHostWindow, -16/);
  assert.match(browser, /Only WS_CHILD with a parent is truly embedded/);
  assert.match(browser, /FindOwnedAgentBrowserFormNoLock\(\)/);
  assert.match(browser, /GetParent\(_embeddedHostWindow\) != IntPtr.Zero/);
  assert.match(browser, /CharSet = CharSet.Unicode/);
});

test("E146 Agent window visibility cannot show hidden .NET or GDI+ windows", () => {
  const start = browser.indexOf("private void SetBrowserWindowsVisibleNoLock(bool visible)");
  const end = browser.indexOf("private static bool NeedsSearchRetry", start);
  assert.ok(start > 0 && end > start);
  const visibility = browser.slice(start, end);
  const agent = visibility.slice(0, visibility.indexOf("// Desktop browser handling"));
  assert.match(agent, /if \(_launchMode == BrowserLaunchMode.Agent\)/);
  assert.match(agent, /var host = FindOwnedAgentBrowserFormNoLock\(\)/);
  assert.match(agent, /if \(host == IntPtr.Zero\)/);
  assert.match(agent, /ShowWindow\(host, visible && attached \? SW_SHOW : SW_HIDE\)/);
  assert.match(agent, /return;/);
  assert.doesNotMatch(agent, /ShowWindow\(hWnd/);
  assert.doesNotMatch(agent, /EnumWindows\(/);
  assert.match(visibility, /\/\/ Desktop browser handling is intentionally unchanged\./);
});

test("E146 embed and shield reuse the same exact Host12 Form; no second WMS process", () => {
  const embed = browser.slice(browser.indexOf("internal bool TryEmbedAgentWindow("),
    browser.indexOf("private bool OwnedByAgentHostNoLock"));
  const shield = browser.slice(browser.indexOf("private bool SetAgentInputProtectionNoLock("),
    browser.indexOf("internal void Hide()"));
  assert.match(embed, /var host = FindOwnedAgentBrowserFormNoLock\(\)/);
  assert.match(embed, /SetParent\(host, tabHandle\)/);
  assert.match(embed, /WS_EX_TOOLWINDOW/);
  assert.match(embed, /WS_EX_APPWINDOW/);
  assert.doesNotMatch(embed, /EnumWindows\(/);
  assert.match(shield, /IntPtr host = FindOwnedAgentBrowserFormNoLock\(\)/);
  assert.doesNotMatch(shield, /EnumWindows\(/);
  assert.match(shield, /SendMessageTimeout\(host/);
  assert.match(browser, /_embeddedHostWindow = IntPtr.Zero;/);
  assert.ok(["171","172","173"].includes(read("relay-agent/VERSION").trim())); // Host13 preserved across Agent171–173.
});
