import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import vm from "node:vm";

const fromService=createRequire(new URL("../service/package.json",import.meta.url));
const ts=fromService("typescript");
const sheetsSource=readFileSync(new URL("../service/src/obpp1291-sheets.ts",import.meta.url),"utf8");
const coreSource=readFileSync(new URL("../service/src/obpp1291-core.ts",import.meta.url),"utf8");
const workerSource=readFileSync(new URL("../service/src/index.ts",import.meta.url),"utf8");
const appSource=readFileSync(new URL("../obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",import.meta.url),"utf8");
const digest="dfdea4df19b9b31a90720783bbdca4028bc8e125a0c54c27f9c8d467d669ab40";
const fakeCrypto={
  randomUUID,
  subtle:{async digest(){return Uint8Array.from(digest.match(/../g).map(hex=>parseInt(hex,16))).buffer;}}
};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json"}
});
function harness(events,{failFirst=false,gridRows=50000}={}){
  const queue=events.map(e=>({...e,status:"PENDING"}));
  const tabs=new Map([["Vị trí",[]],["Nhật ký thao tác",[]],["Ghi nhận Rớt",[]]]);
  const sheetIds=new Map([["Vị trí",172001],["Nhật ký thao tác",172002],["Ghi nhận Rớt",1153247675]]);
  const rowCounts=new Map([...sheetIds.keys()].map(name=>[name,gridRows]));
  // Non-business user data, deliberately kept separate from Core-owned A:E/A:G/A:K.
  const auxiliary=new Map([...sheetIds.keys()].map(name=>[name,new Map()]));
  const calls={sheetReads:0,writes:0,claims:0,acks:0,releases:0,operations:[]};
  let lease=null,once=failFirst;
  const core={idFromName(){return "inventory-core";},get(){return {async fetch(url,init){
    const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
    if(path.endsWith("/outbox/claim")){
      calls.claims++;
      if(lease)return reply({busy:true,items:[]});
      lease=body.lease_token;
      const items=queue.filter(x=>x.status==="PENDING").slice(0,body.limit);
      items.forEach(i=>i.status="IN_FLIGHT");
      return reply({busy:false,items});
    }
    if(path.endsWith("/outbox/ack")){
      calls.acks++;
      queue.find(i=>i.event_key===body.event_key).status="SYNCED";
      return reply({ok:true});
    }
    if(path.endsWith("/outbox/release")){
      calls.releases++;
      queue.find(i=>i.event_key===body.event_key).status="PENDING";
      return reply({ok:true});
    }
    if(path.endsWith("/outbox/finish")){
      if(lease===body.lease_token)lease=null;
      return reply({ok:true});
    }
    throw Error("Unexpected Core API "+path);
  }};}};
  async function fetchGoogle(uri,init={}){
    const url=new URL(uri),method=init.method||"GET",path=decodeURIComponent(url.pathname);
    assert.equal(url.hostname,"sheets.googleapis.com");
    if(url.searchParams.has("fields")){
      calls.sheetReads++;
      return reply({sheets:[...sheetIds].map(([title,sheetId])=>({properties:{title,sheetId,gridProperties:{columnCount:26,rowCount:rowCounts.get(title)}}}))});
    }
    if(path.endsWith(":batchUpdate")){
      if(once){once=false;return reply({error:"rateLimited"},429);}
      calls.writes++;
      const requests=JSON.parse(init.body).requests;
      assert.ok(requests?.length,"scoped grid operations required");
      for(const request of requests){
        const kind=Object.keys(request)[0];
        calls.operations.push({kind,payload:request[kind]});
        const detail=request[kind];
        const sheetId=detail.sheetId??detail.start?.sheetId??detail.range?.sheetId;
        const name=[...sheetIds].find(([,id])=>id===sheetId)?.[0];
        assert.ok(name);
        const rows=tabs.get(name);
        const width={"Ghi nhận Rớt":11,"Vị trí":5,"Nhật ký thao tác":7}[name];
        if(kind==="deleteRange"){
          assert.equal(detail.shiftDimension,"ROWS");
          assert.equal(detail.range.startColumnIndex,0);
          assert.equal(detail.range.endColumnIndex,width);
          rows.splice(detail.range.startRowIndex-1,1);
        } else if(kind==="appendDimension"){
          assert.equal(detail.dimension,"ROWS");
          assert.ok(detail.length>0);
          rowCounts.set(name,rowCounts.get(name)+detail.length);
        } else if(kind==="updateCells"){
          assert.equal(detail.fields,"userEnteredValue,userEnteredFormat");
          assert.equal(detail.start.columnIndex,0);
          const target=detail.start.rowIndex-1;
          assert.ok(target>=0,"header must never be overwritten");
          assert.ok(target<rowCounts.get(name),"write must remain within grid");
          for(const cellRow of detail.rows){
            assert.equal(cellRow.values.length,width);
            rows[target]=cellRow.values.map(v=>v.userEnteredValue?.stringValue??"");
          }
        } else throw Error("Unapproved or sheet-wide Sheets write kind "+kind);
      }
      return reply({replies:[{}]});
    }
    const tab=[...tabs.keys()].find(t=>path.includes("'"+t+"'"));
    assert.ok(tab,"exact scoped tab");
    const rows=tabs.get(tab);
    if(method==="GET"){
      calls.sheetReads++;
      if(/!A1$/.test(path))return reply({values:[[tab==="Vị trí"?"Vị trí":tab==="Nhật ký thao tác"?"Mã sự kiện":"ID"]]});
      if(/!A1:K1$/.test(path))return reply({values:[["ID","","","","","","","","","","Ghi chú"]]});
      return reply({values:rows});
    }
    if(once){once=false;return reply({error:"rateLimited"},429);}
    calls.writes++;
    const payload=JSON.parse(init.body);
    const actualRange=path.split("/values/")[1]?.replace(/:append$/,"");
    assert.equal(payload.range,actualRange,"ValueRange.range must match URL A1 range");
    const row=payload.values[0];
    if(method==="POST")throw Error("legacy values.append is forbidden");
    const match=/!A(\d+)/.exec(path);
    assert.ok(match);
    rows[Number(match[1])-2]=row;
    return reply({ok:true});
  }
  const exports={};
  const js=ts.transpileModule(sheetsSource,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  vm.runInNewContext(js,{exports,require:(key)=>{
    assert.equal(key,"./hr-source");
    return {getServiceAccountAccessToken:async()=>({accessToken:"mock",expiresAt:0})};
  },fetch:fetchGoogle,crypto:fakeCrypto,Date,URL,TextEncoder,console});
  return {drain:exports.drainObppSheets,env:{
    INVENTORY_CORE:core,D172_OBPP_SHEET_ID:"MOCK_D172_PRIVATE_SHEET",
    GOOGLE_RUNTIME_SA_JSON: process.env.D172_CI_FAKE_SA_PLACEHOLDER || "test-fixture" },calls,tabs,auxiliary,rowCounts,queue};
}
function item(kind,key){
  const row=kind==="LOCATION"?{code:key,sheet_key:key,active:1,revision:1,actor_id:"TEST",updated_at:"2026-10-22T00:00:00Z"}:
    {id:key,record_id:"test",action:"LOCATION_ADD",revision:1,time:"2026-10-22T00:00:00Z",actor:"TEST",note:""};
  return {event_key:kind+":"+key,kind,ref_id:key,revision:1,row};
}
test("D172 queued records drain, retry after Google 429, dedupe tab-index GET",async()=>{
  const h=harness([item("LOCATION","CX1"),item("LOCATION","CX2"),item("AUDIT",randomUUID())],{failFirst:true});
  const first=await h.drain(h.env);
  assert.equal(first.processed,0);
  assert.equal(first.remaining,3);
  assert.equal(first.error_code,"OBPP_SHEETS_HTTP_429");
  const second=await h.drain(h.env);
  assert.equal(second.processed,3);
  assert.equal(h.tabs.get("Vị trí").length,2);
  assert.equal(h.tabs.get("Nhật ký thao tác").length,1);
  assert.equal(h.calls.acks,3);
  assert.ok(h.calls.sheetReads<=14, "bounded re-index after append; never guess physical row"); // correctness over stale cached row offsets
  const priorReads=h.calls.sheetReads;
  const third=await h.drain(h.env);
  assert.equal(third.processed,0);
  assert.equal(h.calls.sheetReads,priorReads); // no Google call for an empty outbox
});
test("D172 update uses the same A1 range in URL and body, without appending a duplicate",async()=>{
  const first=item("LOCATION","CX8.1");
  const h=harness([first]);
  await h.drain(h.env);
  const revised={...item("LOCATION","CX8.1"),revision:2,event_key:"LOCATION:CX8.1:2",
    row:{...first.row,revision:2,active:0}};
  h.queue.push({...revised,status:"PENDING"});
  await h.drain(h.env);
  assert.equal(h.tabs.get("Vị trí").length,1);
  assert.equal(h.tabs.get("Vị trí")[0][1],"TEST");
  assert.equal(h.tabs.get("Vị trí")[0][4],"2");
  assert.ok(h.calls.operations.filter(x=>x.kind==="updateCells")
    .every(x=>x.payload.rows[0].values.every(v=>!v.userEnteredFormat.borders)),
    "location tab must not get unexpected borders");
});
test("D172 writes sheet display times in Asia/Ho_Chi_Minh while core UTC stays intact",async()=>{
  const loc=item("LOCATION","CX7.5");
  loc.row.updated_at="2026-10-22T03:45:06.597Z";
  const audit=item("AUDIT",randomUUID());
  audit.row.time="2026-10-22T03:45:06.597Z";
  const h=harness([loc,audit]);
  const r=await h.drain(h.env);
  assert.equal(r.processed,2);
  assert.equal(h.tabs.get("Vị trí")[0][2],"22/10/2026 10:45:06");
  assert.equal(h.tabs.get("Nhật ký thao tác")[0][4],"22/10/2026 10:45:06");
  assert.equal(loc.row.updated_at,"2026-10-22T03:45:06.597Z");
});
test("D172 does not duplicate Sheet rows with overlapping drainer calls",async()=>{
  const h=harness([item("LOCATION","CX8.1"),item("LOCATION","CX8.8")]);
  await Promise.all([h.drain(h.env),h.drain(h.env),h.drain(h.env)]);
  assert.equal(h.tabs.get("Vị trí").length,2);
  assert.equal(h.calls.acks,2);
});
test("D172 E018 enforces one-way authoritative Core mirror and manual repair",()=>{
  assert.match(workerSource,/\/api\/obpp1291\/sync/);
  assert.match(workerSource,/repairObppSheetMirror\(env/);
  assert.doesNotMatch(workerSource,/reconcileObppSheetEdits\(env/);
  assert.match(sheetsSource,/export async function repairObppSheetMirror/);
  assert.doesNotMatch(sheetsSource,/export async function reconcileObppSheetEdits/);
  assert.match(coreSource,/\/obpp1291\/records\/bulk-delete/);
  assert.match(coreSource,/\/obpp1291\/sheet\/reconcile/);
  assert.match(coreSource,/sync_status='ERROR'/);
  assert.match(appSource,/Đã đồng bộ/);
  assert.match(appSource,/Lỗi đồng bộ/);
  assert.match(appSource,/confirmBulkDelete\(/);
  assert.match(appSource,/inputColumn\(firstRow, "Mã cửa hàng", store\)/);
});


test("D172 E038 enforces 11-column A:K business mirror and physical delete",async()=>{
  const rec={event_key:"RECORD:new:1",kind:"RECORD",ref_id:"rec-1",revision:1,row:{
    id:"rec-1",date_vn:"22/10/2026",time_vn:"17:32:20",raw_scan:"Người dùng nhập thủ công",
    store_code:"2AT2",do_code:"70841444491",total_parcels:8,location:"CX8.8",
    actor_id:"admin:admin",actor_name:"Nguyễn Văn A",updated_at:"2026-10-22T10:35:22.000Z"
  }};
  const h=harness([rec]);
  assert.equal((await h.drain(h.env)).processed,1);
  const sheet=h.tabs.get("Ghi nhận Rớt");
  assert.equal(sheet.length,1);
  assert.deepEqual(Array.from(sheet[0]),[
    "rec-1","22/10/2026","17:32:20","Người dùng nhập thủ công",
    "2AT2","70841444491","8","CX8.8","Nguyễn Văn A","22/10/2026 17:35:22",""
  ]);
  h.queue.push({event_key:"RECORD_DELETE:rec-1:2",kind:"RECORD_DELETE",
    ref_id:"rec-1",revision:2,row:{id:"rec-1"},status:"PENDING"});
  assert.equal((await h.drain(h.env)).processed,1);
  assert.equal(sheet.length,0,"deleteDimension removed business row");
  assert.doesNotMatch(coreSource,/UPDATE obpp_records SET deleted=1/);
  assert.ok(coreSource.includes('hardDelete(state,"RECORD"'));
});
test("D172 E022 QR manual marker and reliable app navigation contracts",()=>{
  assert.match(coreSource,/Người dùng nhập thủ công/);
  assert.match(appSource,/private fun showHistory/);
  assert.match(appSource,/private fun confirmLocationDelete/);
  assert.ok(appSource.includes('for (tab in listOf("Nghiệp vụ", "Vị trí", "Lịch sử"))'));
});

test("D172 E047 inserts into business A:K at exact physical row with plain style even when A is hidden",async()=>{
  const id="123e4567-e89b-42d3-a456-426614174000";
  const record={event_key:"RECORD:"+id,kind:"RECORD",ref_id:id,revision:1,row:{
    id,date_vn:"22/10/2026",time_vn:"22:24:34",raw_scan:"SYNTHETIC_QR",
    store_code:"2AD0",do_code:"7084270563",total_parcels:2,location:"CX8.8",
    actor_name:"TEST",updated_at:"2026-10-22T15:24:34Z"
  }};
  const h=harness([record]);
  // Hidden-column state is presentation-only. There must be no active-column
  // arithmetic: GridData always anchors the first cell to physical column A.
  const result=await h.drain(h.env);
  assert.equal(result.processed,1);
  assert.deepEqual(h.tabs.get("Ghi nhận Rớt")[0],[
    id,"22/10/2026","22:24:34","SYNTHETIC_QR","2AD0","7084270563","2","CX8.8","TEST","22/10/2026 22:24:34",""
  ]);
  const inserted=h.calls.operations.find(x=>x.kind==="updateCells");
  assert.ok(inserted,"use physical updateCells, not sheet-wide appendCells");
  assert.equal(inserted.payload.start.sheetId,1153247675);
  assert.equal(inserted.payload.start.rowIndex,1);
  assert.equal(inserted.payload.rows[0].values[0].userEnteredValue.stringValue,id);
  assert.ok(inserted.payload.rows[0].values.every(v=>v.userEnteredFormat.textFormat.bold===false &&
    v.userEnteredFormat.backgroundColor.red===1));
  // D172-E041: each physical A:K value cell has visible top/bottom/left/right
  // borders once authoritative A (record ID) is populated. No extra API call.
  assert.equal(inserted.payload.rows[0].values.length,11);
  for(const v of inserted.payload.rows[0].values){
    const b=v.userEnteredFormat.borders;
    assert.ok(b,"record value cell must be bordered");
    for(const side of ["top","bottom","left","right"]){
      assert.equal(b[side].style,"SOLID");
      assert.ok(b[side].color.red>=0 && b[side].color.red<=1);
    }
  }
  assert.doesNotMatch(sheetsSource,/:append\\?valueInputOption=/);
});
test("D172 E034 repairs shifted B:K row in place without duplicate or residual K",async()=>{
  const id="123e4567-e89b-42d3-a456-426614174000";
  const record={event_key:"RECORD:"+id,kind:"RECORD",ref_id:id,revision:2,row:{
    id,date_vn:"22/10/2026",time_vn:"22:24:34",raw_scan:"SYNTHETIC_QR",
    store_code:"2AD0",do_code:"7084270563",total_parcels:2,location:"CX8.8",
    actor_name:"TEST",updated_at:"2026-10-22T15:24:34Z"
  }};
  const h=harness([record]);
  const shifted=["",id,"22/10/2026","22:24:34","SYNTHETIC_QR","2AD0","7084270563","2","CX8.8","TEST","22/10/2026 22:24:34"];
  h.tabs.get("Ghi nhận Rớt").push(shifted);
  assert.equal((await h.drain(h.env)).processed,1);
  const rows=h.tabs.get("Ghi nhận Rớt");
  assert.equal(rows.length,1,"must not duplicate corrupt shifted record");
  assert.equal(rows[0][0],id);
  assert.equal(rows[0][9],"22/10/2026 22:24:34");
  assert.equal(rows[0][10],"","stray K must be cleared");
  assert.ok(h.calls.operations.some(x=>x.kind==="updateCells"&&x.payload.start.rowIndex===1));
  assert.equal(h.calls.operations.filter(x=>x.kind==="appendCells").length,0);
});


// D172-E047: shared physical sheet rows do not imply shared business columns.
function fakeRecord(id){
  return {event_key:"RECORD:"+id,kind:"RECORD",ref_id:id,revision:1,row:{
    id,date_vn:"24/10/2026",time_vn:"21:53:03",raw_scan:"TEST_QR",
    store_code:"3303",do_code:"000001",total_parcels:8,location:"CX8.8",
    actor_name:"TEST",updated_at:"2026-10-24T14:53:03Z",note:""
  }};
}
test("D172 E047 ignores auxiliary M:N and fills the next business row A:K",async()=>{
  const id="123e4567-e89b-42d3-a456-426614174001";
  const h=harness([fakeRecord(id)]);
  const business=h.tabs.get("Ghi nhận Rớt");
  business.push(["previous-id","24/10/2026"]);
  h.auxiliary.get("Ghi nhận Rớt").set(37,["aux-M-37","aux-N-37"]);
  h.auxiliary.get("Ghi nhận Rớt").set(38,["aux-M-38","aux-N-38"]);
  const before=JSON.stringify([...h.auxiliary.get("Ghi nhận Rớt")]);
  assert.equal((await h.drain(h.env)).processed,1);
  assert.equal(business.length,2,"next physical business row is 3, never aux row 39");
  assert.equal(business[1][0],id);
  assert.equal(h.calls.operations.at(-1).payload.start.rowIndex,2);
  assert.equal(JSON.stringify([...h.auxiliary.get("Ghi nhận Rớt")]),before);
  assert.ok(h.calls.operations.every(o=>o.kind!=="appendCells"&&o.kind!=="deleteDimension"));
});
test("D172 E047 applies separate A:E and A:G boundaries even when auxiliary data extends below",async()=>{
  const loc=item("LOCATION","CX8.9"),audit=item("AUDIT","audit-new");
  const h=harness([loc,audit]);
  h.tabs.get("Vị trí").push(["old-loc","","","old-loc","1"]);
  h.tabs.get("Nhật ký thao tác").push(["old-audit"]);
  h.auxiliary.get("Vị trí").set(10,["user-F-10"]);
  h.auxiliary.get("Nhật ký thao tác").set(12,["user-H-12"]);
  assert.equal((await h.drain(h.env)).processed,2);
  assert.equal(h.tabs.get("Vị trí")[1][0],"CX8.9");
  assert.equal(h.tabs.get("Nhật ký thao tác")[1][0],"audit-new");
  const writes=h.calls.operations.filter(o=>o.kind==="updateCells");
  assert.deepEqual(writes.map(o=>o.payload.rows[0].values.length),[5,7]);
  assert.deepEqual(writes.map(o=>o.payload.start.rowIndex),[2,2]);
  assert.equal(h.auxiliary.get("Vị trí").get(10)[0],"user-F-10");
  assert.equal(h.auxiliary.get("Nhật ký thao tác").get(12)[0],"user-H-12");
});
test("D172 E047 delete shifts ONLY A:K/A:E cells and leaves auxiliary row coordinates intact",async()=>{
  const rec=fakeRecord("123e4567-e89b-42d3-a456-426614174002");
  const loc=item("LOCATION","CX8.10");
  const h=harness([rec,loc]);
  assert.equal((await h.drain(h.env)).processed,2);
  h.auxiliary.get("Ghi nhận Rớt").set(2,["user-M2"]);
  h.auxiliary.get("Vị trí").set(2,["user-F2"]);
  h.queue.push({...rec,event_key:"RECORD_DELETE:"+rec.ref_id,kind:"RECORD_DELETE",status:"PENDING"});
  h.queue.push({...loc,event_key:"LOCATION_DELETE:CX8.10",kind:"LOCATION_DELETE",status:"PENDING"});
  assert.equal((await h.drain(h.env)).processed,2);
  assert.equal(h.tabs.get("Ghi nhận Rớt").length,0);
  assert.equal(h.tabs.get("Vị trí").length,0);
  assert.equal(h.auxiliary.get("Ghi nhận Rớt").get(2)[0],"user-M2");
  assert.equal(h.auxiliary.get("Vị trí").get(2)[0],"user-F2");
  const deletes=h.calls.operations.filter(o=>o.kind==="deleteRange");
  assert.deepEqual(deletes.map(o=>o.payload.range.endColumnIndex),[11,5]);
});
test("D172 E047 uses appendDimension only to increase empty grid capacity, never shift user cells",async()=>{
  const h=harness([item("LOCATION","CX8.11")],{gridRows:1});
  h.auxiliary.get("Vị trí").set(1,["header-F1"]);
  assert.equal((await h.drain(h.env)).processed,1);
  assert.equal(h.rowCounts.get("Vị trí"),2);
  assert.deepEqual(h.calls.operations.map(o=>o.kind),["appendDimension","updateCells"]);
  assert.equal(h.auxiliary.get("Vị trí").get(1)[0],"header-F1");
});
test("D172 E047 avoids overwriting partially filled business rows without an ID",async()=>{
  const h=harness([item("LOCATION","CX8.12")]);
  h.tabs.get("Vị trí").push(["","","","orphan-marker"]);
  assert.equal((await h.drain(h.env)).processed,1);
  assert.equal(h.tabs.get("Vị trí").length,2);
  assert.equal(h.tabs.get("Vị trí")[0][3],"orphan-marker");
  assert.equal(h.tabs.get("Vị trí")[1][0],"CX8.12");
});

test("D172 E047 does not compact historical blank business rows when later records already exist",async()=>{
  const id="123e4567-e89b-42d3-a456-426614174099";
  const h=harness([fakeRecord(id)]);
  const rows=h.tabs.get("Ghi nhận Rớt");
  // Physical business rows 36, 39 and 40; rows 37 and 38 are intentionally blank.
  rows[34]=["previous-36"];
  rows[37]=["previous-39"];
  rows[38]=["previous-40"];
  h.auxiliary.get("Ghi nhận Rớt").set(37,["aux-M37"]);
  h.auxiliary.get("Ghi nhận Rớt").set(38,["aux-M38"]);
  assert.equal((await h.drain(h.env)).processed,1);
  assert.equal(rows[35],undefined);
  assert.equal(rows[36],undefined);
  assert.equal(rows[37][0],"previous-39");
  assert.equal(rows[38][0],"previous-40");
  assert.equal(rows[39][0],id,"next record is at physical row 41");
  assert.equal(h.calls.operations.at(-1).payload.start.rowIndex,40);
  assert.equal(h.auxiliary.get("Ghi nhận Rớt").get(37)[0],"aux-M37");
  assert.equal(h.auxiliary.get("Ghi nhận Rớt").get(38)[0],"aux-M38");
});
