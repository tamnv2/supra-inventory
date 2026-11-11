import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const main = readFileSync("diagnostics/puzzle-recorder-v1/Program.cs", "utf8");
const diagnostic = readFileSync("diagnostics/puzzle-recorder-v1/V21Diagnostics.cs", "utf8");
const project = readFileSync("diagnostics/puzzle-recorder-v1/SupraPuzzleRecorder.csproj", "utf8");

test("V2.1 collects before/after only for an Owner-selected region, in memory", () => {
  assert.match(main, /if \(_v21Region\.IsEmpty\)/);
  assert.match(main, /V21StartAttempt\(item, picture\)/);
  assert.match(main, /await V21ReviewAttemptAsync\(item\)/);
  for (const expected of [
    "CapturePreviewAsync", "selector.SelectedBounds", "V21CropPng",
    "roi.Width > original.Width * .80", "roi.Height > original.Height * .70",
    "BeforePng = cropped", "AfterPng = V21CropPng",
    "Image = selected", "Xác nhận: không có thông tin nhạy cảm"
  ]) assert.ok(diagnostic.includes(expected), expected);
  assert.ok(!diagnostic.includes("File.WriteAllBytes"));
});

test("Owner marks two points in BEFORE and optional observed point in AFTER", () => {
  for (const expected of [
    "manual_source_center_x_y_px", "manual_slot_center_x_y_px",
    "manual_reference_delta_x_px", "predicted_delta_error_px",
    "manual_observed_piece_center_x_y_px",
    "Source = pt", "Slot = pt", "AfterPoint = V21MapPoint",
    "ACKNOWLEDGED_CDP_EVENTS_ONLY_NOT_OBSERVED_PIECE_MOTION",
    "acknowledged_mouse_events_kind_x_y_ms"
  ]) assert.ok(diagnostic.includes(expected), expected);
});

test("Only approved cropped images may enter the locally saved ZIP", () => {
  assert.match(diagnostic, /if \(dialog\.ShowDialog\(this\) == DialogResult\.OK && dialog\.Approved\)/);
  assert.match(diagnostic, /e\.UserApproved && e\.BeforePng != null/);
  assert.match(diagnostic, /MessageBoxButtons\.YesNo, MessageBoxIcon\.Warning/);
  assert.match(diagnostic, /new SaveFileDialog/);
  assert.match(diagnostic, /new ZipArchive\(file, ZipArchiveMode\.Create\)/);
  assert.match(diagnostic, /attempt-" \+ e\.Number\.ToString\("D2"\)/);
  assert.ok(!diagnostic.includes("GetCookies"));
  assert.ok(!diagnostic.includes("HttpClient"));
  assert.ok(!diagnostic.includes("Network.enable"));
  assert.ok(!diagnostic.includes("RawScreenshot"));
});

test("V2.1 stays a standalone diagnostic, no new login automation or cloud calls", () => {
  assert.ok(main.includes("CallDevToolsProtocolMethodAsync"));
  assert.ok(main.includes("kind == \"mouseReleased\" ? \"left\""));
  assert.ok(main.includes("_pendingTest != null"));
  assert.ok(!main.includes("while (true)"));
  assert.ok(diagnostic.includes("internal static bool V21ImageSmoke()"));
  assert.ok(main.includes("RecorderForm.V21ImageSmoke()"));
  assert.match(project, /<Version>2\.1\.0<\/Version>/);
  assert.match(project, /<Reference Include="System\.IO\.Compression" \/>/);
  assert.match(project, /<PlatformTarget>x64<\/PlatformTarget>/);
});
