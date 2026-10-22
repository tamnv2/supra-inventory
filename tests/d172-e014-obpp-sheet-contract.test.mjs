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
  const tabs=new Map([["Vi_tri",[]],["Nhat_ky",[]],["Ghi_nhan",[]]]);
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
    const tab=[...tabs.keys()].find(t=>path.includes("'"+t+"'"));
    assert.ok(tab,"exact scoped tab");
    const rows=tabs.get(tab);
    if(method==="GET"){
      calls.sheetReads++;
      if(tab==="Vi_tri")return reply({values:rows.map(row=>row.slice(0,6))});
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
      return reply({updates:{updatedRange:tab+"!A"+(rows.length+1)+":M"+(rows.length+1)}});
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
  assert.equal(h.tabs.get("Vi_tri").length,2);
  assert.equal(h.tabs.get("Nhat_ky").length,1);
  assert.equal(h.calls.acks,3);
  assert.equal(h.calls.sheetReads,3); // 1 failed, then 1 per distinct tab
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
  assert.equal(h.tabs.get("Vi_tri").length,1);
  assert.equal(h.tabs.get("Vi_tri")[0][1],"Ngừng dùng");
  assert.equal(h.tabs.get("Vi_tri")[0][5],"2");
});
test("D172 writes sheet display times in Asia/Ho_Chi_Minh while core UTC stays intact",async()=>{
  const loc=item("LOCATION","CX7.5");
  loc.row.updated_at="2026-10-22T03:45:06.597Z";
  const audit=item("AUDIT",randomUUID());
  audit.row.time="2026-10-22T03:45:06.597Z";
  const h=harness([loc,audit]);
  const r=await h.drain(h.env);
  assert.equal(r.processed,2);
  assert.equal(h.tabs.get("Vi_tri")[0][3],"22/10/2026 10:45:06");
  assert.equal(h.tabs.get("Nhat_ky")[0][4],"22/10/2026 10:45:06");
  assert.equal(loc.row.updated_at,"2026-10-22T03:45:06.597Z");
});
test("D172 does not duplicate Sheet rows with overlapping drainer calls",async()=>{
  const h=harness([item("LOCATION","CX8.1"),item("LOCATION","CX8.8")]);
  await Promise.all([h.drain(h.env),h.drain(h.env),h.drain(h.env)]);
  assert.equal(h.tabs.get("Vi_tri").length,2);
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
  assert.match(appSource,/labeledInput\(root, "Mã cửa hàng:"/);
});
