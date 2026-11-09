import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const program = readFileSync("relay-agent/Program.cs", "utf8");
const browser = readFileSync("relay-agent/SupraConfirmBrowser.cs", "utf8");
const embed = browser.split("internal bool TryEmbedAgentWindow(")[1]?.split("private bool OwnedByAgentHostNoLock")[0];

test("background tray / hidden Agent never touches the embedded HWND", () => {
  const sizing = program.split("private void SizeEmbeddedWmsViewport()")[1]
    ?.split("private void ActivateEmbeddedWmsTab()")[0];
  assert.ok(sizing, "viewport sizing code exists");
  for (const marker of ["!Visible", "FormWindowState.Minimized", "_wmsTabUserHidden",
    "_mainTabs.SelectedTab != _wmsWebTab", "!_wmsWebViewport.Visible"]) {
    assert.ok(sizing.includes(marker), "missing visibility gate " + marker);
  }
  assert.ok(sizing.indexOf("if (!Visible") < sizing.indexOf("TryEmbedAgentWindow("));
});

test("reused owned Host13 HWND never receives per-second ShowWindow or MoveWindow", () => {
  assert.ok(embed, "owned embed method exists");
  assert.ok(embed.includes("needsAttach"));
  assert.ok(embed.includes("_embeddedViewportWidth != width"));
  assert.ok(embed.includes("_embeddedViewportHeight != height"));
  assert.ok(embed.includes("!IsWindowVisible(host)"));
  assert.ok(embed.includes("SWP_NOACTIVATE"));
  assert.ok(embed.includes("SWP_SHOWWINDOW"));
  assert.doesNotMatch(embed, /ShowWindow\(host,\s*SW_SHOW\)/);
  assert.doesNotMatch(embed, /MoveWindow\(host,/);
});

test("explicit Agent-owned browser show never activates child HWND", () => {
  assert.match(browser, /ShowWindow\(host,\s*visible && attached \? SW_SHOWNOACTIVATE : SW_HIDE\)/);
  assert.match(browser, /private const int SW_SHOWNOACTIVATE = 4;/);
  assert.match(browser, /RequiredHostBuild = 13/);
});
