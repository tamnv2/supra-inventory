import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const source=readFileSync("diagnostics/puzzle-recorder-v1/V23BrowserDragLab.cs","utf8");
const main=readFileSync("diagnostics/puzzle-recorder-v1/Program.cs","utf8");
const ui=readFileSync("diagnostics/puzzle-recorder-v1/V21Diagnostics.cs","utf8");

test("one-shot actual browser drag is confined to an embedded offline page",()=>{
  assert.match(source,/CoreWebView2\.NavigateToString\(SampleHtml/);
  assert.match(source,/NavigationStarting \+= \(sender, args\) =>/);
  assert.match(source,/string\.Equals\(args\.Uri, "about:blank"/);
  assert.match(source,/args\.Cancel = true/);
  assert.ok(!source.includes("https://"));
  assert.ok(!source.includes("HttpClient"));
  assert.match(source,/if \(!_ready \|\| _busy \|\| _tested \|\| _roi\.IsEmpty/);
  assert.match(source,/_tested = true; \/\/ One attempt per explicit sample/);
  assert.match(source,/CallDevToolsProtocolMethodAsync\("Input\.dispatchMouseEvent"/);
  assert.match(source,/await SendMouseAsync\("mousePressed"/);
  assert.match(source,/await SendMouseAsync\("mouseReleased"/);
  assert.ok(!source.includes("while (true)"));
});

test("ROI margin and real screenshot color detection are checked before mouse input",()=>{
  assert.match(source,/RoiPadding = 16/);
  assert.match(source,/TryLocate\(before, _roi, out var source, out var target, out var reason\)/);
  assert.match(source,/SCREENSHOT_DIMENSIONS_CHANGED/);
  assert.match(source,/Cv2\.ImDecode\(png, ImreadModes\.Color\)/);
  assert.match(source,/Cv2\.InRange\(cut/);
  assert.match(source,/SOURCE_AMBIGUOUS_OR_MISSING/);
  assert.match(source,/TARGET_AMBIGUOUS_OR_MISSING/);
  assert.match(source,/internal static bool NativeSmoke\(\)/);
  assert.match(main,/V23BrowserDragLab\.NativeSmoke\(\)/);
});

test("evidence has before and after, prediction, input ACK and observation",()=>{
  for(const expected of ["predicted_delta_x_px","synthetic_reference_delta_x_px",
    "predicted_reference_error_px","mouse_path_css_xy_ms","mouse_path_ack_count",
    "observed_xy_px","observed_travel_x_px","observed_target_error_px",
    "browser_input_sent","LOCAL_DRAG_PASS","LOCAL_DRAG_FAIL","synthetic_page_only",
    "puzzle-browser-drag-v23.json","-before.png","-after.png"])
    assert.ok(source.includes(expected),expected);
  assert.ok(source.includes('"actual_wms_auth_challenge"] = false'));
  assert.ok(source.includes("Math.Abs(observed.X - target.X) <= 5"));
  assert.ok(source.includes("MaxTests = 8"));
  assert.ok(ui.includes("new V23BrowserDragLab()"));
});

test("offline scene startup verifies actual canvas and exposes sanitized error events",()=>{
  for (const expected of ["VerifySceneAsync", "document.getElementById('board')",
    "CANVAS_READY", "CANVAS_NOT_READY", "INITIALIZE_ERROR", "NEW_SAMPLE_ERROR",
    '"startup_events"', 'TraceStartup("INITIALIZE", "START")', "_export.Enabled = true"])
    assert.ok(source.includes(expected), expected);
  assert.ok(main.includes('args[0] == "--lab-smoke"'));
  assert.ok(main.includes("lab.SmokePassed"));
  assert.ok(source.includes("Interval = 20000"));
  assert.ok(!source.includes("ex.Message"));
});
