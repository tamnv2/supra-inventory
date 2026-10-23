import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app = load("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt");
const draft = load("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppDraftStore.kt");
const core = load("service/src/obpp1291-core.ts");
const mirror = load("service/src/obpp1291-sheets.ts");

test("E038 device-only form draft",()=>{
  for(const term of ["AndroidKeyStore","AES/GCM/NoPadding","bindUser","save","restore","clear"])assert.ok(draft.includes(term),term);
  for(const term of ["captureDraft()","restoreDraftUi()","ObppDraftStore.save","ObppDraftStore.clear","watchDraft"])assert.ok(app.includes(term),term);
  assert.ok(app.includes('draft.put("parsed_qr",raw)'));
  assert.ok(app.includes('note.setText("")'));
});
test("E038 multiline note layout and save",()=>{
  for(const term of ['fieldLabel("Ghi chú")',"setSingleLine(false)","TYPE_TEXT_FLAG_MULTI_LINE","dp(132)",'.put("note",note.text.toString().trim())'])assert.ok(app.includes(term),term);
  const op = app.slice(app.indexOf("private fun showOperations("),app.indexOf("private fun showHistory("));
  assert.ok(op.indexOf('fieldLabel("Ghi chú")')<op.indexOf('action("LƯU GHI NHẬN"'));
});
test("E038 atomic duplicate guard",()=>{
  for(const term of ["function duplicateRecord","parcel_index IS ?","note=?","id<>?","if(duplicateRecord(state,p))","if(duplicateRecord(state,p,id))",'error:"DUPLICATE_RECORD"'])assert.ok(core.includes(term),term);
  assert.ok(core.includes("state.storage.transactionSync"));
  assert.ok(core.includes("ALTER TABLE obpp_records ADD COLUMN note TEXT NOT NULL DEFAULT ''"));
});
test("E038 A:K Sheet writer never overwrites K with old cleanup",()=>{
  for(const term of ["safeNote(r.note)",'stringValue:"Ghi chú"',"if(count<11)","pasteType:","kind==="RECORD"?"K""])assert.ok(mirror.includes(term),term);
  assert.ok(!mirror.includes("cells.push({userEnteredFormat:{}})"));
  assert.ok(mirror.includes("safeNote"));
});
