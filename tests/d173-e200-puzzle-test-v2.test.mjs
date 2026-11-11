import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const program=readFileSync("diagnostics/puzzle-recorder-v1/Program.cs","utf8");
const vision=readFileSync("diagnostics/puzzle-recorder-v1/PuzzleVision.cs","utf8");
const project=readFileSync("diagnostics/puzzle-recorder-v1/SupraPuzzleRecorder.csproj","utf8");

test("V2 Test click sends at most one guarded drag, no automatic retries",()=>{
  assert.match(program,/private async System\.Threading\.Tasks\.Task TestOnceAsync\(\)/);
  assert.match(program,/if \(_browser\.CoreWebView2 == null \|\| _testing \|\| _recording \|\| _pendingTest != null\) return/);
  assert.match(program,/await DragOneTimeAsync\(/);
  assert.match(program,/No automatic retries|Never auto-retry/);
  assert.ok(!program.includes("while (true)"));
});

test("Owner manually labels PASS or FAIL; geometry logs stay local",()=>{
  for(const s of ['Test (1 lần)','Text = "PASS"','Text = "FAIL"',
    'owner_result','NOT_ATTEMPTED','PENDING','MarkTest(bool pass)',
    'SaveFileDialog','viewport_image_px','delta_x_px'])
      assert.ok(program.includes(s),s);
  assert.ok(!program.includes('GetCookiesAsync'));
  assert.ok(!program.includes('Network.enable'));
  assert.ok(!program.includes('Storage.getCookies'));
  assert.ok(!program.includes('password"]'));
  assert.ok(!program.includes('RawScreenshot'));
});

test("Visual analysis uses screenshot only, rejects uncertain target and never retries",()=>{
  for(const s of ['Cv2.ImDecode','Cv2.MatchTemplate','Cv2.InRange',
    'HANDLE_AMBIGUOUS','SOURCE_OUTLINE_NOT_FOUND','IMAGE_CONFIDENCE_LOW',
    'IMAGE_AMBIGUOUS','DELTA_OUT_OF_BOUNDS'])
      assert.ok(vision.includes(s),s);
  assert.ok(!vision.includes('HttpClient'));
  assert.ok(!vision.includes('Navigate('));
  assert.ok(!vision.includes('GetCookies'));
});

test("V2 remains an isolated Windows x64 experimental tool",()=>{
  assert.match(project,/SUPRA\.Puzzle\.Tester\.V2/);
  assert.match(project,/PlatformTarget>x64/);
  assert.match(project,/OpenCvSharp4\.Windows/);
  assert.ok(program.includes("IsInPrivateModeEnabled = true"));
  assert.ok(program.includes("IsPasswordAutosaveEnabled = false"));
});

test("Native CV smoke must evaluate a synthetic geometry fixture",()=>{
  assert.ok(vision.includes('internal static bool SelfTest()'));
  assert.ok(vision.includes('Cv2.MatchTemplate'));
  assert.ok(vision.includes('TemplateMatchModes.CCorrNormed'));
  assert.ok(program.includes('PuzzleVision.SelfTest()'));
  assert.ok(program.includes('kind == "mouseReleased" ? "left"'));
  assert.ok(vision.includes('SOURCE_OUTLINE_NOT_FOUND'));
});
