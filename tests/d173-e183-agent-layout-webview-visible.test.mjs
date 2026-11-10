import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path, "utf8");
const layout = read("relay-agent/D173E179OverviewNoScroll.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const monitor = read("relay-agent/D173E141VpsWebMonitor.cs");
const program = read("relay-agent/Program.cs");

test("E183 all three top cards have identical outer spacing and middle seam", () => {
  for (const part of ["agent.Margin = new Padding(4)", "middle.Margin = new Padding(4)",
    "desktop.Margin = new Padding(4)", "supra.Margin = new Padding(0, 0, 0, 3)",
    "picklist.Margin = new Padding(0, 3, 0, 0)"])
    assert.ok(layout.includes(part), part);
  assert.match(layout, /overview\.RowStyles\[0\]\.Height = 40F/);
  assert.match(layout, /middle\.RowStyles\.Add\(new RowStyle\(SizeType.Percent, 50F\)\)/);
  assert.match(layout, /_manualPicklistGrid\.ScrollBars = ScrollBars.None/);
});

test("E183 WebView2 viewport blank recovery keeps host, WMS DOM and user session unchanged", () => {
  const from = browser.indexOf("internal bool InvalidateEmbeddedOnTabActivation(");
  const to = browser.indexOf("internal bool IsReady()", from);
  const method = browser.slice(from, to);
  assert.match(method, /GetParent\(_embeddedHostWindow\) != expectedParent/);
  assert.match(method, /SetWindowPos\(_embeddedHostWindow/);
  assert.match(method, /height - 1, positionFlags/);
  assert.match(method, /height, positionFlags/);
  assert.match(method, /RedrawWindow\(_embeddedHostWindow/);
  assert.match(method, /paint_proof=UNVERIFIED navigation=NONE/);
  assert.doesNotMatch(method, /Navigate\(|Reload\(|StopManagedBrowser|StartAgent|RefreshState/);
  assert.match(monitor, /if \(unlock && _mainTabs.SelectedTab == _wmsWebTab/);
  assert.match(program, /native_wake=REQUESTED navigation=NONE/);
});

test("E183 never equates a loaded DOM to a verified on-screen WebView2 frame", () => {
  assert.match(program, /Trang đã tải \(chưa xác minh hiển thị\)/);
  assert.doesNotMatch(program, /_supraCardTitle.Text = "Đăng nhập Supra \| Sẵn sàng/);
});
