import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const main = readFileSync("diagnostics/puzzle-recorder-v1/Program.cs", "utf8");
const v21 = readFileSync("diagnostics/puzzle-recorder-v1/V21Diagnostics.cs", "utf8");
const v22 = readFileSync("diagnostics/puzzle-recorder-v1/V22FixedViewport.cs", "utf8");
const project = readFileSync("diagnostics/puzzle-recorder-v1/SupraPuzzleRecorder.csproj", "utf8");

test("V2.2 retains a fixed WebView2 viewport regardless of host window resize", () => {
  assert.match(main, /browserHost = new Panel \{ Dock = DockStyle\.Fill, AutoScroll = true \}/);
  assert.match(main, /_browser\.Dock = DockStyle\.None/);
  assert.match(main, /_browser\.Size = new Size\(1178, 600\)/);
  assert.match(main, /_browser\.ZoomFactor = 1\.0/);
  assert.match(main, /AutoScaleMode = AutoScaleMode\.None/);
});

test("Saved ROI is local numeric geometry, accepted only at exact screenshot dimensions", () => {
  assert.ok(v21.includes("V22SaveRegion(roi, original.Width, original.Height)"));
  for (const s of ["RegionPath", "viewport_width", "viewport_height", 
    "V22RegionFits", "LocalApplicationData", "File.WriteAllText", 
    "geometry[\"viewport_width\"] != width", "geometry[\"viewport_height\"] != height"]) {
    assert.ok(v22.includes(s), s);
  }
  for (const forbidden of ["GetCookies", "HttpClient", "password", "token", "Network.enable", "webview.postMessage"]) {
    assert.ok(!v22.includes(forbidden), forbidden);
  }
});

test("V2.2 selected-region test is passive, with no automated challenge solution or mouse actuation", () => {
  assert.match(v22, /private async Task V22InspectRegionAsync\(\)/);
  assert.match(v22, /V21CropPng\(frame.ToArray\(\), _v21Region\)/);
  assert.match(v21, /_v22Inspect\.Click \+= async .* V22InspectRegionAsync\(\)/);
  assert.match(main, /_test\.Visible = false/);
  assert.ok(!main.includes("_test.Click += async (sender, e) => await TestOnceAsync()"));
  assert.ok(!v22.includes("Input.dispatchMouseEvent"));
  assert.ok(!v22.includes("PuzzleVision.Analyze"));
  assert.ok(!v22.includes("CallDevToolsProtocolMethodAsync"));
});

test("V2.2 remains standalone; native smoke checks bounded ROI geometry", () => {
  assert.match(project, /<Version>2\.2\.0<\/Version>/);
  assert.match(project, /<PlatformTarget>x64<\/PlatformTarget>/);
  assert.ok(main.includes("RecorderForm.V22RegionSmoke()"));
  assert.ok(v22.includes("internal static bool V22RegionSmoke()"));
  assert.ok(v22.includes("new Rectangle(300, 40, 140, 105)"));
});
