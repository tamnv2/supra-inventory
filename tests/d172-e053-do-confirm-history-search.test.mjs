import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const app = read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt");
const core = read("service/src/obpp1291-core.ts");

test("D172-E053 duplicate DO stays blocked unless an explicit true boolean is submitted", () => {
  assert.match(core, /const duplicateFound=duplicateDo\(state,p\.do_code\)/);
  assert.equal((core.match(/if\(duplicateFound && b\.allow_duplicate_do!==true\)\{duplicate=true;return;\}/g)||[]).length, 2);
  assert.match(core, /error:"DUPLICATE_RECORD"/);
  assert.match(core, /"CREATE_DUPLICATE_CONFIRMED"/);
  assert.match(core, /"EDIT_DUPLICATE_CONFIRMED"/);
  assert.match(core, /state\.storage\.transactionSync\(\(\)=>\{/);
  assert.match(core, /if\(!conflict && !duplicate\)writeResult\(state,op,response\)/);
});

test("D172-E053 duplicate modal sends opt-in only after confirmation, with preserved operation id", () => {
  assert.match(app, /private fun saveRecord\(confirmedDuplicate: Boolean = false\)/);
  assert.match(app, /setTitle\("DO đã tồn tại"\)/);
  assert.match(app, /setNegativeButton\("Bỏ qua", null\)/);
  assert.match(app, /setPositiveButton\("Xác nhận"\) \{ _, _ -> saveRecord\(true\) \}/);
  assert.match(app, /if \(confirmedDuplicate\) json\.put\("allow_duplicate_do", true\)/);
  assert.ok(app.indexOf("val key = json.toString()") < app.indexOf('json.put("allow_duplicate_do", true)'));
  assert.match(app, /json\.put\("operation_id", pendingSaveId\)/);
  assert.match(app, /if\(safeError!="DUPLICATE_RECORD" \|\| onFailure==null\) message\(label\)/);
  assert.ok(!app.includes("records/do-check"), "No extra duplicate-check request");
});

test("D172-E053 history searches the complete active Core table, not just cached 100 rows", () => {
  const recordsGet = core.slice(core.indexOf('if(path==="/obpp1291/records" && method==="GET")'),
    core.indexOf("// D172-E018: authenticated Worker-only mirror snapshot"));
  for (const column of ["store_code", "do_code", "location"])
    assert.ok(recordsGet.includes("instr(lower(" + column + "),lower(?))>0"), column);
  assert.ok(recordsGet.includes('url.searchParams.get("q")'));
  assert.ok(recordsGet.includes("rawQuery.length>80"));
  assert.ok(recordsGet.includes("ORDER BY created_at DESC LIMIT ?"));
  assert.ok(recordsGet.includes("WHERE deleted=0"));
});

test("D172-E053 compact fixed input above tabs, local immediate filter and debounced global search", () => {
  const surface = app.slice(app.indexOf("private fun surface()"), app.indexOf("private fun heading("));
  assert.ok(surface.indexOf('field("Tìm kiếm")') < surface.indexOf('val bottomTabs ='));
  assert.ok(surface.includes('if (selectedTab == "Lịch sử")'));
  assert.ok(surface.includes("dp(38)"));
  assert.ok(surface.includes("historySearchQuery = s?.toString().orEmpty()"));
  assert.ok(surface.includes("renderHistoryRows()"));
  assert.ok(surface.includes("syncPollHandler.postDelayed(task, 350)"));
  assert.match(app, /selectedTab == "Lịch sử" && query != historySearchQuery\.trim\(\)/);
  for (const column of ["store_code", "do_code", "location"])
    assert.ok(app.includes('item.optString("' + column + '").contains(query, ignoreCase = true)'));
  assert.ok(app.includes('if (loadedHistoryQuery != query) history.addView(heading("Đang tìm kiếm..."))'));
  assert.ok(app.includes("selectedRecordIds.retainAll(availableIds)"), "Only visible rows can be selected for deletion");
});
