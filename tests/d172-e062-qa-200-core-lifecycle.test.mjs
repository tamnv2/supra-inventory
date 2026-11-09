import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";

// Purely in-memory D172 Core integration QA; NEVER connects to Worker,
// the real private Sheet or real accounts. Headers emulate already-authorized
// Worker-to-Core forwarding only in this disposable local process.
const requireService=createRequire(new URL("../service/package.json",import.meta.url));
const ts=requireService("typescript");
const source=readFileSync(new URL("../service/src/obpp1291-core.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const exports={};
vm.runInNewContext(compiled,{
  exports,Request,Response,Headers,URL,Date,console,JSON,
  crypto:{randomUUID},
});
const {initializeObppSchema,handleObppCoreRequest}=exports;
assert.equal(typeof initializeObppSchema,"function");
assert.equal(typeof handleObppCoreRequest,"function");

function harness(){
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users(user_id TEXT PRIMARY KEY,display_name TEXT NOT NULL)");
  const state={storage:{
    sql:{exec(query,...params){
      const stmt=db.prepare(query);
      const rows=stmt.columns().length>0?stmt.all(...params):(stmt.run(...params),[]);
      return {toArray(){return rows;}};
    }},
    transactionSync(fn){
      db.exec("SAVEPOINT qa_transaction");
      try{const result=fn();db.exec("RELEASE qa_transaction");return result;}
      catch(error){db.exec("ROLLBACK TO qa_transaction");db.exec("RELEASE qa_transaction");throw error;}
    }
  }};
  initializeObppSchema(state);
  const base="https://inventory-core.internal";
  async function call(method,path,body){
    const request=new Request(base+path,{
      method,headers:{
        "x-obpp-user-id":"qa_e062_local_only",
        "x-obpp-user-role":"ADMIN",
        "x-obpp-user-name":"D172 QA synthetic",
        ...(body?{"content-type":"application/json"}:{})
      },
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const response=await handleObppCoreRequest(state,request);
    assert.ok(response instanceof Response,"D172 Core must handle route");
    return {status:response.status,data:await response.json()};
  }
  const scalar=query=>Number(db.prepare(query).get().n);
  return {db,call,scalar,close:()=>db.close()};
}

test("D172 E062: 200 synthetic APK-equivalent creates, 100-per-page read, 2x100 hard delete and durable Sheet intents",async()=>{
  const h=harness();
  try{
    const locations=["QA200-A","QA200-B","QA200-C"];
    for(const code of locations){
      const result=await h.call("POST","/obpp1291/locations",{code,operation_id:randomUUID()});
      assert.equal(result.status,200,JSON.stringify(result));
    }
    let seed=0xd172e062;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0));
    const data=[];
    for(let i=0;i<200;i++){
      const random=rand();
      const do_code="99"+String(i+1).padStart(6,"0")+String(random%10000).padStart(4,"0");
      const qr=i%2===0;
      const location=locations[random%locations.length];
      const store_code=["QA200","QA2","QA1291"][random%3];
      const total_parcels=5+(random%4);
      const parcel_index=qr?1+(random%total_parcels):null;
      const raw_scan=qr
        ?[store_code,do_code,"SOQA"+String(i+1).padStart(5,"0"),
          "PKQA"+String(i+1).padStart(5,"0"),"QA.1291",
          parcel_index+"/"+total_parcels].join("|")
        :"Người dùng nhập thủ công";
      const operation_id=randomUUID();
      const payload={raw_scan,store_code,do_code,total_parcels,parcel_index,
        location,note:"QA_E062_SYNTHETIC_RECORD_"+String(i+1).padStart(3,"0"),
        operation_id};
      const saved=await h.call("POST","/obpp1291/records",payload);
      assert.equal(saved.status,200,"Create index "+i+" "+JSON.stringify(saved));
      assert.match(saved.data.id,/^[0-9a-f-]{36}$/i);
      assert.equal(saved.data.revision,1);
      data.push({id:saved.data.id,payload,revision:1});
      if(i%25===0){
        const retry=await h.call("POST","/obpp1291/records",payload);
        assert.equal(retry.status,200);
        assert.equal(retry.data.id,saved.data.id,"Idempotent network retry must not append duplicate");
      }
    }
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_records WHERE deleted=0"),200);
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_record_changes WHERE action='UPSERT'"),200);
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_outbox WHERE kind='RECORD' AND status='PENDING'"),200);
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_audit WHERE action='CREATE'"),200);

    // Signed v11 history starts with page size 100; first snapshot/cursor must
    // cover precisely 200 IDs, including records sharing one millisecond.
    let cursor="",snapshot="",hasMore=true,pages=0;
    const viewed=[];
    while(hasMore){
      const q=new URLSearchParams({limit:"100"});
      if(snapshot){q.set("snapshot",snapshot);if(cursor)q.set("cursor",cursor);}
      const result=await h.call("GET","/obpp1291/records?"+q);
      assert.equal(result.status,200);
      pages++;
      if(!snapshot)snapshot=result.data.snapshot_at;
      viewed.push(...result.data.records);
      hasMore=result.data.has_more;
      cursor=result.data.next_cursor??"";
      assert.ok(pages<=3,"Pagination must terminate");
    }
    assert.equal(pages,2);
    assert.equal(viewed.length,200);
    assert.equal(new Set(viewed.map(r=>r.id)).size,200);
    assert.ok(viewed.every(r=>r.note.startsWith("QA_E062_SYNTHETIC_")));
    assert.ok(viewed.every(r=>locations.includes(r.location)));
    const found=await h.call("GET","/obpp1291/records?q=QA200-A&limit=100");
    assert.equal(found.status,200);
    assert.ok(found.data.records.length>0,"Old records remain searchable");
    assert.ok(found.data.records.every(r=>r.location==="QA200-A"));

    // Same API used by APK for edit: after successful PATCH, revision fences
    // protect the delete operation and updated note remains visible.
    for(let i=0;i<20;i++){
      const current=data[i];
      const patch={...current.payload,
        note:"QA_E062_SYNTHETIC_EDITED_"+i,operation_id:randomUUID(),
        expected_revision:current.revision};
      const out=await h.call("PATCH","/obpp1291/records/"+current.id,patch);
      assert.equal(out.status,200,JSON.stringify(out));
      assert.equal(out.data.revision,2);
      current.revision=2;
    }
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_audit WHERE action='EDIT'"),20);
    const afterEdit=await h.call("GET","/obpp1291/records?limit=100");
    assert.ok(afterEdit.data.records.some(r=>r.revision===2 && r.note.startsWith("QA_E062_SYNTHETIC_EDITED_")));

    // APK selection is page scoped and Core bulk API accepts at most 100.
    for(const batch of [data.slice(0,100),data.slice(100,200)]){
      const body={operation_id:randomUUID(),items:batch.map(r=>({
        id:r.id,expected_revision:r.revision
      }))};
      assert.ok(JSON.stringify(body).length<16384,"Worker 16KiB per-batch boundary");
      const result=await h.call("POST","/obpp1291/records/bulk-delete",body);
      assert.equal(result.status,200,JSON.stringify(result));
      assert.equal(result.data.deleted_count,100);
      const expectedRemaining=batch===data.slice(0,100)?100:0;
      // We intentionally do not compare arrays by identity; derive from Core count.
      assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_records WHERE deleted=0"),
        batch[0]===data[0]?100:0);
      const check=await h.call("GET","/obpp1291/records?limit=100");
      assert.equal(check.data.records.length,batch[0]===data[0]?100:0);
      assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_sheet_deletes WHERE kind='RECORD'"),
        batch[0]===data[0]?100:200);
    }
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_records"),0,
      "Hard delete means physical Core delete, not local-only hiding");
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_outbox WHERE kind='RECORD_DELETE' AND status='PENDING'"),200,
      "All 200 Sheet tombstones durably queued; no fake Google ACK");
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_audit WHERE action='DELETE'"),200,
      "Each deletion retains an audit without retaining a business row");
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_record_changes WHERE action='DELETE'"),200);
    assert.equal(h.scalar("SELECT COUNT(*) AS n FROM obpp_record_changes WHERE action='UPSERT'"),220);

    // A real app reader starts with the full history and then applies ordered
    // tombstones. The delta feed must cover all 200 physical deletions.
    let after=0,changes=[],more=true,rounds=0;
    while(more){
      const r=await h.call("GET","/obpp1291/records/changes?limit=100&after="+after);
      assert.equal(r.status,200);
      changes.push(...r.data.changes);
      assert.ok(r.data.next_after>=after);
      after=r.data.next_after;
      more=r.data.has_more;
      assert.ok(++rounds<=6,"Change pagination must terminate");
    }
    assert.equal(changes.filter(c=>c.action==="DELETE").length,200);
    assert.equal(changes.filter(c=>c.action==="UPSERT").length,220);
    assert.equal(new Set(changes.filter(c=>c.action==="DELETE").map(c=>c.id)).size,200);
    console.log("D172_E062_LOCAL_SQLITE_QA_200: inserted=200; read_pages=2; edited=20; hard_deleted=200; sheet_tombstones=200; delete_deltas=200; PRODUCTION_WRITES=0");
  }finally{h.close();}
});
