import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",import.meta.url),"utf8");
const span=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)+a.length));
test("E029 compact screen preserves fixed navigation with smaller controls",()=>{
 assert.match(src,/dp\(42\), 1f\)/);
 assert.match(src,/textSize = 18f/);
 assert.match(src,/setPadding\(dp\(12\), dp\(6\), dp\(12\), dp\(4\)\)/);
});
test("E029 uses external labels in two compact data rows and preserves scan + save",()=>{
 const op=span("private fun showOperations(", "private fun showHistory(");
 assert.match(op,/inputColumn\(firstRow, "Mã cửa hàng", store\)/);
 assert.match(op,/inputColumn\(firstRow, "DO", doCode, 8\)/);
 assert.match(op,/inputColumn\(secondRow, "Số kiện", parcels\)/);
 assert.match(op,/inputColumn\(secondRow, "Vị trí", locationSpinner, 8\)/);
 assert.match(op,/qr\.setOnEditorActionListener/);
 assert.match(op,/saveRecord\(\)/);
 assert.doesNotMatch(op,/labeledInput\(root/);
});
test("E029 moves manual sync into contextual menu without footer duplicate",()=>{
 const block=span("private fun showWorkplace()", "private fun confirmManualSync()");
 assert.match(block,/menu\.menu\.add\("Đồng bộ ngay"\)/);
 assert.match(block,/"Đồng bộ ngay" -> confirmManualSync\(\)/);
 assert.doesNotMatch(block,/root\.addView\(secondaryAction\("Đồng bộ"/);
 assert.match(src,/setTitle\("Xác nhận đồng bộ"\)/);
 assert.match(src,/elapsed<60000/);
});
test("E029 manual log send requires explicit confirmation and keeps Drive receipt gate",()=>{
 const block=span("private fun confirmManualLogSend()", "private fun confirmManualSync()");
 assert.match(block,/\.setNegativeButton\("Hủy", null\)/);
 assert.match(block,/\.setPositiveButton\("Gửi log"\)/);
 assert.match(block,/ObppDiagnostics\.sendManual\(this\)/);
 assert.doesNotMatch(span("private fun showWorkplace()", "private fun confirmManualLogSend()"),/ObppDiagnostics\.sendManual\(this\)/);
});
test("E029 condensed history keeps full identity, sync color and long-press actions",()=>{
 const block=span("private fun showHistory(", "private fun confirmBulkDelete()");
 for(const fragment of ["date_vn","time_vn","store_code","do_code","total_parcels","location","syncTint(sync)","syncLabel(sync)","showRecordActions(item)","confirmBulkDelete()"])
   assert.ok(block.includes(fragment),fragment);
 assert.match(block,/topMargin = dp\(5\)/);
});
test("E029 compact location management keeps add and multi-delete",()=>{
 const block=span("private fun showLocations(", "private fun confirmLocationDelete()");
 for(const fragment of ["Vị trí mới","Chọn tất cả","Xóa đã chọn","confirmLocationDelete()","locationActions(code)"])
   assert.ok(block.includes(fragment),fragment);
 assert.match(block,/LinearLayout\.LayoutParams\(dp\(86\), dp\(42\)\)/);
});
