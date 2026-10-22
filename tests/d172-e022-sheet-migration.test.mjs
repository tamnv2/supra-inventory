import test from "node:test";
import assert from "node:assert/strict";
import {planRecordTableMigration,RECORD_HEADERS,LEGACY_HEADERS} from "../tools/d172_sheet_migration_plan.mjs";
const id=n=>n.toString(16).padStart(8,"0")+"-cccc-4444-8888-abcdefabcdef";
const source=n=>({id:id(n),date_vn:"22/10/2026",time_vn:"17:32:20",
 raw_scan:"Người dùng nhập thủ công",store_code:"2AT2",do_code:String(70841444491+n),
 total_parcels:8,location:"CX8.8",actor_name:"Người vận hành",updated_at:"2026-10-22T10:40:21Z",
 created_at:"2026-10-22T10:32:20Z"});
const legacy=r=>[r.id,r.date_vn,r.raw_scan,r.store_code,r.do_code,r.total_parcels,r.location,
 r.time_vn,1,"admin:admin","Đã ghi nhận",2,r.updated_at];
test("D172 E022 row-7 legacy header and records above it produce header row 1 without lost/overwritten IDs",()=>{
 const core=Array.from({length:7},(_,i)=>source(i+1));
 const sheetRows=[...core.slice(0,6).map(legacy),LEGACY_HEADERS,legacy(core[6])];
 const plan=planRecordTableMigration({sheetRows,coreRecords:core,coreSnapshotComplete:true});
 assert.deepEqual(plan.rows[0],RECORD_HEADERS);
 assert.equal(plan.headerRow,1);assert.equal(plan.freezeRowCount,1);
 assert.equal(plan.migratedCount,7);
 assert.deepEqual(plan.rows.slice(1).map(row=>row[0]),core.map(r=>r.id));
 assert.equal(plan.rows[1].length,10);
 assert.equal(plan.rows[1][2],"17:32:20");
 assert.equal(plan.rows[1][6],"8");
 assert.equal(plan.rows[1][8],"Người vận hành");
 assert.equal(plan.rows[1][9],"22/10/2026 17:40:21");
});
test("D172 E022 no unrecognized business row silently disappears",()=>{
 assert.throws(()=>planRecordTableMigration({sheetRows:[LEGACY_HEADERS,legacy(source(1))],
   coreRecords:[],coreSnapshotComplete:true}),/UNRECONCILED/);
 assert.throws(()=>planRecordTableMigration({sheetRows:[LEGACY_HEADERS,legacy(source(1)),legacy(source(1))],
   coreRecords:[source(1)],coreSnapshotComplete:true}),/DUPLICATE_SHEET_ID/);
});
test("D172 E022 only trusted tombstones permit physical absence",()=>{
 const p=planRecordTableMigration({sheetRows:[LEGACY_HEADERS,legacy(source(1)),legacy(source(2))],
   coreRecords:[source(2)],deletedIds:[id(1)],coreSnapshotComplete:true});
 assert.equal(p.confirmedDeletes,1);assert.equal(p.migratedCount,1);
 assert.equal(p.rows.length,2);
});
test("D172 E022 refuse partial Core snapshot and missing header",()=>{
 assert.throws(()=>planRecordTableMigration({sheetRows:[LEGACY_HEADERS],coreRecords:[],coreSnapshotComplete:false}),/CORE_SNAPSHOT_INCOMPLETE/);
 assert.throws(()=>planRecordTableMigration({sheetRows:[legacy(source(1))],coreRecords:[source(1)],coreSnapshotComplete:true}),/MISSING_OR_MULTIPLE_HEADER/);
});
