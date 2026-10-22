// D172 E022 pure planner: no network or provider writes.
export const RECORD_HEADERS=["ID","Ngày","Thời gian","Scan QR","Mã cửa hàng","DO","Số kiện","Vị trí","Người thao tác","Cập nhật lúc"];
export const LEGACY_HEADERS=["ID","Ngày","Scan QR","Mã cửa hàng","DO","Số kiện","Vị trí","Thời gian","STT kiện","Người thao tác","Trạng thái","Phiên bản","Cập nhật lúc"];
const str=x=>String(x??"").trim();
const vn=x=>{const n=Date.parse(str(x));if(!Number.isFinite(n))throw Error("INVALID_UPDATED_AT");
 const t=new Date(n+25200000).toISOString();return t.slice(8,10)+"/"+t.slice(5,7)+"/"+t.slice(0,4)+" "+t.slice(11,19)};
function business(r){
 if(!str(r.id)||!str(r.date_vn)||!str(r.time_vn)||!str(r.store_code)||!str(r.do_code)||
 !str(r.location)||!Number.isInteger(Number(r.total_parcels))||Number(r.total_parcels)<1)throw Error("INCOMPLETE_CORE_RECORD");
 return [str(r.id),str(r.date_vn),str(r.time_vn),str(r.raw_scan),str(r.store_code),
  str(r.do_code),str(r.total_parcels),str(r.location),
  str(r.actor_name||str(r.actor_id).split(":").pop()),vn(r.updated_at)];
}
// Requires complete authoritative Core page scan, deleted-ID tombstones and
// full existing Sheet rectangle. Any unknown/duplicate row blocks migration.
export function planRecordTableMigration({sheetRows,coreRecords,deletedIds=[],coreSnapshotComplete=false}){
 if(!coreSnapshotComplete)throw Error("CORE_SNAPSHOT_INCOMPLETE");
 if(!Array.isArray(sheetRows)||!Array.isArray(coreRecords))throw Error("INVALID_INPUT");
 let headerCount=0;const oldIds=[],seen=new Set();
 for(const row of sheetRows){
  const cells=(Array.isArray(row)?row:[]).map(str);
  if(!cells.some(Boolean))continue;
  if(cells.join("|")===RECORD_HEADERS.join("|")||cells.join("|")===LEGACY_HEADERS.join("|")){headerCount++;continue;}
  const id=cells[0];
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))throw Error("UNKNOWN_ROW_PRESENT");
  if(seen.has(id))throw Error("DUPLICATE_SHEET_ID");
  seen.add(id);oldIds.push(id);
 }
 if(headerCount!==1)throw Error("MISSING_OR_MULTIPLE_HEADER");
 const core=new Map();
 for(const row of coreRecords){
  if(!row||!str(row.id)||core.has(str(row.id)))throw Error("INVALID_CORE_SNAPSHOT");
  core.set(str(row.id),row);
 }
 const deleted=new Set(deletedIds.map(str));
 for(const id of oldIds)if(!core.has(id)&&!deleted.has(id))throw Error("UNRECONCILED_SHEET_ROW");
 const ids=[...oldIds.filter(id=>core.has(id)),...[...core.keys()].filter(id=>!seen.has(id))
  .sort((a,b)=>str(core.get(a).created_at).localeCompare(str(core.get(b).created_at)))];
 const rows=[RECORD_HEADERS,...ids.map(id=>business(core.get(id)))];
 if(rows.some(row=>row.length!==10))throw Error("INVALID_OUTPUT_WIDTH");
 return {rows,headerRow:1,freezeRowCount:1,migratedCount:ids.length,
  confirmedDeletes:oldIds.filter(id=>deleted.has(id)).length};
}
