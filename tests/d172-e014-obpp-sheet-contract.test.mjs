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
function harness(events,{failFirst=false}={}){
  const queue=events.map(e=>({...e,status:"PENDING"}));
  const tabs=new Map([["Vị trí",[]],["Nhật ký thao tác",[]],["Ghi nhận Rớt",[]]]);
  const sheetIds=new Map([["Vị trí",172001],["Nhật ký thao tác",172002],["Ghi nhận Rớt",1153247675]]);
  const calls={sheetReads:0,writes:0,claims:0,acks:0,releases:0};
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
      return reply({sheets:[...sheetIds].map(([title,sheetId])=>({properties:{title,sheetId}}))});
    }
    if(path.endsWith(":batchUpdate")){
      if(once){once=false;return reply({error:"rateLimited"},429);}
      calls.writes++;
      const request=JSON.parse(init.body).requests?.[0]?.deleteDimension?.range;
      assert.ok(request,"physical row deletion required");
      const name=[...sheetIds].find(([,id])=>id===request.sheetId)?.[0];
      assert.ok(name);
      tabs.get(name).splice(request.startIndex-1,1);
      return reply({replies:[{}]});
    }
    const tab=[...tabs.keys()].find(t=>path.includes("'"+t+"'"));
    assert.ok(tab,"exact scoped tab");
    const rows=tabs.get(tab);
    if(method==="GET"){
      calls.sheetReads++;
      if(/!A1$/.test(path))return reply({values:[[tab==="Vị trí"?"Vị trí":tab==="Nhật ký thao tác"?"Mã sự kiện":"ID"]]});
      if(tab==="Vị trí")return reply({values:rows.map(row=>row.slice(0,5))});
      return reply({values:rows.map(row=>[row[0]])});
    }
    if(once){once=false;return reply({error:"rateLimited"},429);}
    calls.writes++;
    const payload=JSON.parse(init.body);
    const actualRange=path.split("/values/")[1]?.replace(/:append$/,"");
    assert.equal(payload.range,actualRange,"ValueRange.range must match URL A1 range");
    const row=payload.values[0];
    if(method==="POST"){
      rows.push(row);
      return reply({updates:{updatedRange:tab+"!A"+(rows.length+1)+":J"+(rows.length+1)}});
    }
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
    GOOGLE_RUNTIME_SA_JSON: process.env.D172_CI_FAKE_SA_PLACEHOLDER || "test-fixture" },calls,tabs,queue};
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
  assert.equal(h.calls.sheetReads,6); // header/index reads on 2 tabs plus retry
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


test("D172 E022 enforces ten-column business mirror and physical delete, no soft delete",async()=>{
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
    "2AT2","70841444491","8","CX8.8","Nguyễn Văn A","22/10/2026 17:35:22"
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
