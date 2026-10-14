import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const activity = readFileSync(new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/verify-apps.yml", import.meta.url), "utf8");
const notes = JSON.parse(readFileSync(new URL("../android/release-notes.json", import.meta.url), "utf8"));

test("D168 vc109 shows both lunch and dinner choices in an actual visible Android view", () => {
  const start = activity.indexOf("private fun reconcileD167MealPrompt()");
  const end = activity.indexOf("private fun startRealtime(", start);
  assert.ok(start >= 0 && end > start);
  const body = activity.slice(start, end);
  for (const label of ["11:00 – 11:30", "11:30 – 12:00", "18:00 – 18:30", "18:30 – 19:00"]) {
    assert.ok(body.includes(label), "missing visible choice: " + label);
  }
  assert.match(body, /RadioGroup\(this@MainActivity\)/);
  assert.match(body, /radioGroup\.addView\(RadioButton\(this@MainActivity\)/);
  assert.match(body, /\.setView\(content\)/);
  assert.doesNotMatch(body, /\.setMessage\(/);
  assert.doesNotMatch(body, /\.setSingleChoiceItems\(/);
});

test("D168 vc109 requires an explicit selection and preserves Worker first-writer behavior", () => {
  const body = activity.slice(activity.indexOf("private fun reconcileD167MealPrompt()"), activity.indexOf("private fun startRealtime("));
  assert.match(body, /var chosen: Int\? = null/);
  assert.match(body, /confirm\.isEnabled = false/);
  assert.match(body, /chosen = optionIds\.indexOf\(checkedId\)/);
  assert.match(body, /val selected = chosen \?: return@setOnClickListener/);
  assert.match(body, /api\.confirmD167Meal\(period, if \(selected == 0\) "EARLY" else "LATE"\)/);
  assert.match(body, /reconcileD167MealPrompt\(\)/);
  assert.match(body, /confirm\.isEnabled = chosen != null/);
});

test("D168 signed-release workflow uses fresh, reviewed version-specific notes", () => {
  assert.equal(notes.schema_version, 1);
  assert.ok(notes.release_notes.length >= 1 && notes.release_notes.length <= 5);
  for (const item of notes.release_notes) {
    assert.equal(typeof item, "string");
    assert.ok(item.length >= 12 && item.length <= 180);
  }
  assert.match(workflow, /git diff --quiet "\$previous" "\$GITHUB_SHA" -- "\$notes"/);
  assert.match(workflow, /release_notes:\$changelog\[0\]\.release_notes/);
  assert.match(workflow, /--notes-file android\/dist\/release-notes\.txt/);
  assert.match(workflow, /--slurpfile changelog android\/release-notes\.json/);
  assert.doesNotMatch(workflow, /release_notes:\["Hiển thị và xử lý báo hàng theo từng Picker/);
  assert.match(workflow, /':!android\/release-notes\.json'/);
});

test("D168 release notes describe only the two approved vc109 changes", () => {
  assert.ok(notes.release_notes.some((s) => s.includes("11:00") && s.includes("18:00")));
  assert.ok(notes.release_notes.some((s) => s.includes("không còn tự chọn")));
  assert.ok(notes.release_notes.some((s) => s.includes("Nội dung cập nhật")));
});
