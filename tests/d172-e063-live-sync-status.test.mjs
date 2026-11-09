import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";

const serviceRequire=createRequire(new URL("../service/package.json",import.meta.url));
const ts=serviceRequire("typescript");
const coreSource=readFileSync(new URL("../service/src/obpp1291-core.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt",import.meta.url),"utf8");
const compiled=ts.transpileModule(coreSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(compiled,{
  exports,Request,Response,Headers,URL,Date,console,JSON,crypto:{randomUUID}
});
const {initializeObppSchema,handleObppCoreRequest}=exports;

function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users(user_id TEXT PRIMARY KEY,display_name TEXT NOT NULL)");
  const state={storage:{
    sql:{exec(query,...params){
      const st=db.prepare(query);
      const rows=st.columns().length?st.all(...params):(st.run(...params),[]);
      return {toArray(){return rows;}};
    }},
    transactionSync(fn){
      db.exec("SAVEPOINT qa_e063");
      try{const out=fn();db.exec("RELEASE qa_e063");return out;}
      catch(error){db.exec("ROLLBACK TO qa_e063");db.exec("RELEASE qa_e063");throw error;}
    }
  }};
  initializeObppSchema(state);
  async function call(method,path,body,internal=false){
    const request=new Request("https://inventory-core.internal"+path,{
      method,headers:{
        "x-obpp-user-id":"qa_e063_fake_user","x-obpp-user-role":"ADMIN",
        ...(internal?{"x-obpp-internal":"sync"}:{}),
        ...(body?{"content-type":"application/json"}:{})
      },
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const response=await handleObppCoreRequest(state,request);
    assert.ok(response instanceof Response);
    return {status:response.status,data:await response.json()};
  }
  const row=(q,...p)=>db.prepare(q).get(...p);
  async function insert(do_code){
    const loc=await call("POST","/obpp1291/locations",{
      code:"QA-E063",operation_id:randomUUID()
    });
    assert.equal(loc.status,200);
    const saved=await call("POST","/obpp1291/records",{
      operation_id:randomUUID(),raw_scan:"Người dùng nhập thủ công",
      store_code:"QA63",do_code,total_parcels:3,parcel_index:null,
      location:"QA-E063",note:"SYNTHETIC_TEST_ONLY"
    });
    assert.equal(saved.status,200,JSON.stringify(saved));
    return saved.data.id;
  }
  return {db,call,row,insert,close:()=>db.close()};
}
const status=(h,id)=>h.row("SELECT sync_status FROM obpp_records WHERE id=?",id)?.sync_status;
const seqCount=(h,id)=>Number(h.row("SELECT COUNT(*) AS n FROM obpp_record_changes WHERE record_id=?",id).n);
const ack=(h,event_key,id,revision=1)=>h.call("POST","/obpp1291/outbox/ack",
  {event_key,kind:"RECORD",ref_id:id,revision},true);

test("E063 normal Google Sheet RECORD ACK creates one visible SYNCED PDA delta; replay creates none",async()=>{
  const h=fixture();
  try {
    const id=await h.insert("9990000063");
    const event_key="RECORD:"+id+":1";
    assert.equal(status(h,id),"PENDING");
    const before=seqCount(h,id);
    const first=await ack(h,event_key,id);
    assert.equal(first.status,200);
    assert.equal(status(h,id),"SYNCED");
    assert.equal(seqCount(h,id),before+1);
    const changes=await h.call("GET","/obpp1291/records/changes?after=0&limit=100");
    assert.equal(changes.status,200);
    assert.ok(changes.data.changes.some(change=>
      change.id===id&&change.action==="UPSERT"&&change.record?.sync_status==="SYNCED"
    ),"APK can only exit yellow PENDING after committed Core change-feed event");
    const replay=await ack(h,event_key,id);
    assert.equal(replay.status,200);
    assert.equal(seqCount(h,id),before+1,"duplicate Google ACK must not grow change journal");
    await h.call("POST","/obpp1291/outbox/ack",
      {event_key,kind:"RECORD",ref_id:randomUUID(),revision:1},true);
    assert.equal(seqCount(h,id),before+1,"unrelated ref_id must never sync");
  } finally{h.close();}
});

test("E063 old revision ACK cannot claim newer edit is synced; new revision ACK does",async()=>{
  const h=fixture();
  try {
    const id=await h.insert("9990000064");
    const patched=await h.call("PATCH","/obpp1291/records/"+id,{
      operation_id:randomUUID(),raw_scan:"Người dùng nhập thủ công",
      store_code:"QA63",do_code:"9990000064",total_parcels:3,
      parcel_index:null,location:"QA-E063",note:"EDITED",expected_revision:1
    });
    assert.equal(patched.status,200);
    const previous=seqCount(h,id);
    await ack(h,"RECORD:"+id+":1",id,1);
    assert.equal(status(h,id),"PENDING");
    assert.equal(seqCount(h,id),previous);
    await ack(h,"RECORD:"+id+":2",id,2);
    assert.equal(status(h,id),"SYNCED");
    assert.equal(seqCount(h,id),previous+1);
  } finally{h.close();}
});

test("E063 retry failure reaches ERROR on PDA once, then ACK recovers to SYNCED",async()=>{
  const h=fixture();
  try{
    const id=await h.insert("9990000065");
    const event_key="RECORD:"+id+":1";
    const before=seqCount(h,id);
    for(let tries=0;tries<4;tries++){
      h.db.prepare("UPDATE obpp_outbox SET status='IN_FLIGHT' WHERE event_key=?").run(event_key);
      const response=await h.call("POST","/obpp1291/outbox/release",{event_key},true);
      assert.equal(response.status,200);
    }
    assert.equal(status(h,id),"ERROR");
    assert.equal(seqCount(h,id),before+1,"one error event despite 4 failures");
    const failed=await h.call("GET","/obpp1291/records/changes?after=0");
    assert.ok(failed.data.changes.some(c=>c.id===id&&c.record?.sync_status==="ERROR"));
    await ack(h,event_key,id,1);
    assert.equal(status(h,id),"SYNCED");
    assert.equal(seqCount(h,id),before+2);
  }finally{h.close();}
});

test("E063 manual repair confirm is idempotent and only emits a real transition",async()=>{
  const h=fixture();
  try{
    const id=await h.insert("9990000066");
    const before=seqCount(h,id);
    await h.call("POST","/obpp1291/sheet/confirm-record",{id,revision:1},true);
    assert.equal(status(h,id),"SYNCED");
    assert.equal(seqCount(h,id),before+1);
    await h.call("POST","/obpp1291/sheet/confirm-record",{id,revision:1},true);
    assert.equal(seqCount(h,id),before+1);
  } finally{h.close();}
});

test("E063 Android uses immediate footer mutation and updates badges without tab switch",()=>{
  const message=app.slice(app.indexOf("private fun message("),app.indexOf("private fun call("));
  const bulk=app.slice(app.indexOf("private fun confirmBulkDelete()"),app.indexOf("private fun parseScan()"));
  const manual=app.slice(app.indexOf("private fun confirmManualSync()"),app.indexOf("private fun showOperations("));
  const single=app.slice(app.indexOf("private fun showRecordActions("),app.indexOf("private fun showLocations("));
  assert.match(message,/lastSyncMessage = value[\s\S]*?status\.text = value/);
  assert.match(bulk,/message\("Đang yêu cầu Cloud xóa "[\s\S]*?message\("Cloud đã xóa \$deleted bản ghi/);
  assert.match(bulk,/ObppHistoryStore\.removeAcknowledged[\s\S]*?message\("Cloud đã xóa/);
  assert.match(manual,/message\(if\(result\.optString\("status"\)=="OK"\)/);
  assert.match(single,/call\("DELETE"[\s\S]*?ObppHistoryStore\.removeAcknowledged/);
  assert.match(app,/if\(states\.any \{ it == "PENDING" \|\| it == "ERROR" \} \|\| syncPollTick % 6 == 0\)[\s\S]*?refreshRecords\(false\)/);
  assert.match(app,/if\(events\.length\(\)>0\) renderLocalHistory\(\)/);
  assert.match(app,/val oldY = if \(::pageScroll\.isInitialized\) pageScroll\.scrollY else 0/);
  assert.match(app,/pageScroll\.post \{ if\(selectedTab=="Lịch sử"\) pageScroll\.scrollTo\(0,oldY\) \}/);
  assert.doesNotMatch(bulk,/lastSyncMessage\s*=/);
});
