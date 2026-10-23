import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const core=read("service/src/obpp1291-core.ts");
const app=read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt");
const workflow=read(".github/workflows/release-obpp1291.yml");
const gate=read("tools/d172_release_gate.py");

test("E043 DO uniqueness compares only DO across every active record",()=>{
 const f=core.slice(core.indexOf("function duplicateDo("),core.indexOf("function parcel("));
 assert.ok(f.includes("deleted=0 AND do_code=? AND id<>? LIMIT 1"));
 for(const extra of ["store_code=?","raw_scan=?","parcel_index","total_parcels","location=?","note=?","date_vn=?"])
   assert.ok(!f.includes(extra),extra);
 assert.ok(core.includes("CREATE INDEX IF NOT EXISTS obpp_do_lookup_idx ON obpp_records(do_code,deleted)"));
});

test("E043 atomic POST and PATCH prevent different operation IDs from creating duplicate DO",()=>{
 assert.ok(core.includes("state.storage.transactionSync"));
 assert.ok(core.includes("if(duplicateDo(state,p.do_code)){duplicate=true;return;}"));
 assert.ok(core.includes("p.do_code!==String(before.do_code) && duplicateDo(state,p.do_code,id)"));
 assert.ok(core.includes('duplicate?reply({error:"DUPLICATE_RECORD"},409)'));
 assert.ok(core.includes("if(!conflict && !duplicate)writeResult(state,op,response)"));
 assert.ok(!core.includes("/obpp1291/records/do-check"));
 assert.ok(!core.includes("duplicateRecord(state,p"));
});

test("E043 v8 requires no new APK and keeps existing 409 duplicate handling",()=>{
 assert.ok(app.includes('if(safeError=="DUPLICATE_RECORD")'));
 assert.ok(app.includes("private fun saveRecord()"));
 assert.ok(app.includes("ObppDraftStore.clear(this)"));
 assert.ok(!app.includes("checkScannedDo"));
 assert.ok(!app.includes("checkTypedDo"));
 assert.ok(!app.includes("records/do-check"));
});

test("E043 Worker-only rollout explicitly skips signed Android release",()=>{
 assert.ok(workflow.includes("D172-E043_WORKER_ONLY:"));
 assert.ok(gate.includes("D172_E043_OWNER_PINNED_DO_UNIQUE_WORKER_ONLY_PASS"));
 assert.ok(gate.includes("component!="+'"worker"'));
});
