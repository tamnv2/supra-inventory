import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const main = readFileSync("diagnostics/puzzle-recorder-v1/Program.cs", "utf8");
const ui = readFileSync("diagnostics/puzzle-recorder-v1/V21Diagnostics.cs", "utf8");
const sim = readFileSync("diagnostics/puzzle-recorder-v1/V23OfflineDrag.cs", "utf8");
const project = readFileSync("diagnostics/puzzle-recorder-v1/SupraPuzzleRecorder.csproj", "utf8");

test("V2.3 simulation uses only synthetic positions and ±15 px ROI offsets", () => {
  assert.match(sim, /internal static bool TryPlan\(Rectangle roi, Rectangle source, Rectangle target, out int delta\)/);
  assert.match(sim, /RegionForOffset\(offset, offset\)/);
  assert.match(sim, /new\[\] \{ -15, 0, 15 \}/);
  assert.match(sim, /delta != 330/);
  assert.match(sim, /!roi.Contains\(source\) \|\| !roi.Contains\(target\)/);
  assert.match(sim, /internal static bool NativeSmoke\(\)/);
  assert.ok(main.includes("V23OfflineDragForm.NativeSmoke()"));
});

test("V2.3 never reads real challenge pixels or dispatches browser input", () => {
  assert.ok(!sim.includes("WebView2"));
  assert.ok(!sim.includes("CoreWebView2"));
  assert.ok(!sim.includes("CapturePreviewAsync"));
  assert.ok(!sim.includes("Input.dispatchMouseEvent"));
  assert.ok(!sim.includes("PuzzleVision.Analyze"));
  assert.ok(!sim.includes("HttpClient"));
  assert.ok(!sim.includes("Navigate("));
  assert.ok(!sim.includes("password"));
  assert.ok(!sim.includes("cookie"));
  assert.ok(ui.includes("new V23BrowserDragLab()"));
  assert.ok(main.includes("_test.Visible = false"));
});

test("V2.3 output is explicit local synthetic-only geometry", () => {
  for (const key of ['"synthetic_only"', '"browser_input_sent"', '"synthetic_expected_dx"',
    '"synthetic_simulated_dx"', '"synthetic_pass"', 'SaveFileDialog'])
    assert.ok(sim.includes(key), key);
  assert.match(sim, /"browser_input_sent"\] = false/);
  assert.match(project, /<Version>2\.3\.0<\/Version>/);
});
