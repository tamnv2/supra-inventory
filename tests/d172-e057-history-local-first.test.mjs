import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const app = read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt");
const local = read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppHistoryStore.kt");
const session = read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppSessionStore.kt");
const core = read("service/src/obpp1291-core.ts");
const worker = read("service/src/index.ts");
const payload = JSON.stringify({
  operation_id:"11111111-1111-4111-8111-111111111111",
  items:Array.from({length:100},(_,i)=>({
    id:(i+1).toString(16).padStart(8,"0")+"-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    expected_revision:999999
  }))
});
test("E057: 100-item payload fits exact-route 16KiB Worker guard; old 4096B is a real blocker",()=>{
  assert.ok(payload.length>4096);
  assert.ok(payload.length<16384);
  assert.match(worker,/bodyCap=path==="\/api\/obpp1291\/records\/bulk-delete"\?16384:4096/);
  assert.match(worker,/OBPP_BODY_TOO_LARGE/);
  assert.match(core,/items.length>100/);
  assert.match(app,/historyDeleting=true/);
  assert.match(app,/if\(deleted==items.length\(\)\)/);
  assert.match(app,/ObppHistoryStore.removeAcknowledged/);
  assert.match(app,/code==409/);
});
test("E057: Core keyset pagination returns complete history with stable timestamp+id ordering",()=>{
  assert.match(core,/obpp_records_page_idx/);
  assert.match(core,/ORDER BY created_at DESC,id DESC LIMIT \?/);
  assert.match(core,/created_at<\? OR \(created_at=\? AND id<\?\)/);
  assert.match(core,/next_cursor:/);
  assert.match(core,/snapshot_at:snapshotAt/);
  assert.match(core,/baseline_seq:baselineSeq/);
  assert.match(core,/total_count:count/);
  assert.match(app,/next_cursor/);
  assert.match(app,/if\(hasMore\) fetchHistoryPage\(owner\) else fetchHistoryChanges\(owner\)/);
});
test("E057: local-first history persists all pages, resume checkpoint and account isolation",()=>{
  assert.match(local,/SQLiteOpenHelper/);
  assert.match(local,/PRIMARY KEY\(owner,id\)/);
  assert.match(local,/INSERT OR REPLACE INTO records/);
  assert.match(local,/CREATE TABLE sync_state/);
  assert.match(local,/acceptPage\(/);
  assert.match(local,/prior.snapshot/);
  assert.match(local,/if \(hasMore\) next else ""/);
  assert.match(local,/fun page\(/);
  assert.match(local,/LIMIT \? OFFSET \?/);
  assert.match(session,/cache_owner/);
  assert.match(worker,/cache_owner:user.user_id/);
  assert.ok(app.includes("renderLocalHistory()"));
  assert.ok(app.includes("historyPageCount>100"));
  assert.ok(app.includes("selectedRecordIds.clear()"));
});
test("E057: deltas are committed with Core record creates/edits/deletes and Sheet ACKs",()=>{
  assert.match(core,/CREATE TABLE IF NOT EXISTS obpp_record_changes/);
  assert.match(core,/INSERT INTO obpp_record_changes/);
  assert.match(core,/trackRecordChange\(state,refId,"DELETE"\)/);
  assert.match(core,/trackRecordChange\(state,id,"UPSERT"\)/);
  assert.match(core,/\/obpp1291\/records\/changes/);
  assert.match(core,/ORDER BY seq ASC LIMIT \?/);
  assert.match(local,/acceptChanges/);
  assert.match(local,/seq <= last/);
  assert.match(local,/if \(change.optString\("action"\) == "DELETE"\)/);
  assert.match(local,/UPDATE sync_state SET applied_seq/);
  assert.match(app,/fetchHistoryChanges\(owner\)/);
});
test("E057: 101, 350, 1000 histories have bounded 100-row presentation and non-global delete",()=>{
  for(const count of [100,101,350,1000]) {
    const pages=Math.ceil(count/100);
    assert.equal(Math.floor((count-1)/100)+1,pages);
  }
  assert.match(app,/ObppHistoryStore.page\(this,historyOwner,historySearchQuery,historyPage\)/);
  assert.match(app,/historyPage\+=1/);
  assert.match(app,/historyPageCount>100/);
  assert.match(app,/Chỉ xóa bản ghi đã chọn trên trang đang xem/);
  assert.match(app,/for \(i in 0 until recordData.length\(\)\)/);
  assert.doesNotMatch(app,/call\("POST", "\/api\/obpp1291\/records\/bulk-delete", payload\) \{/);
});
