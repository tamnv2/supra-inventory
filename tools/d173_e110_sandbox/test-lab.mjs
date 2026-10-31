#!/usr/bin/env node
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";

const root=fileURLToPath(new URL("../../../",import.meta.url));
const wrangler=join(root,"service/node_modules/wrangler/bin/wrangler.js");
const persist=mkdtempSync(join(tmpdir(),"m2-e110-lab-"));
const origin="http://127.0.0.1:9897";
const worker=spawn(process.execPath,[wrangler,"dev","--config","tools/d173_e110_sandbox/wrangler.toml","--local","--ip","127.0.0.1","--port","9897","--persist-to",persist,"--log-level","error"],{cwd:root,stdio:["ignore","pipe","pipe"]});
let output="";
worker.stdout.on("data",b=>output=(output+b).slice(-7000));
worker.stderr.on("data",b=>output=(output+b).slice(-7000));
const at=(path,uid="p1")=>origin+path+"?uid="+uid+"&gen=1";
const frame=(op,args={},id=crypto.randomUUID())=>({request_id:id,operation:op,args});
async function post(uid,data){
 const r=await fetch(at("/command",uid),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
 assert.equal(r.status,200,"HTTP status "+r.status);
 return r.json();
}
async function startup(){
 for(let t=0;t<180;t++){
  if(worker.exitCode!==null)throw Error("Wrangler exited "+output);
  try{const r=await fetch(origin+"/health");if(r.ok&&((await r.json()).isolated))return;}catch{}
  await delay(200);
 }
 throw Error("Local lab backend unavailable "+output);
}
async function ws(uid){
 return new Promise((resolve,reject)=>{
   const client=new WebSocket("ws://127.0.0.1:9897/socket?uid="+uid+"&gen=1");
   const q=[],wait=[];
   const timer=setTimeout(()=>reject(Error("WS timeout "+uid)),10000);
   client.addEventListener("open",()=>{
    clearTimeout(timer);
    resolve({
      send:x=>client.send(JSON.stringify(x)),
      recv:()=>new Promise((yes,no)=>{
        if(q.length)return yes(q.shift());
        const deadline=setTimeout(()=>no(Error("WS recv timeout "+uid)),9000);
        wait.push(x=>{clearTimeout(deadline);yes(x);});
      }),
      close:()=>client.close()
    });
   });
   client.addEventListener("error",()=>reject(Error("WS error")));
   client.addEventListener("message",ev=>{const x=JSON.parse(String(ev.data));(wait.shift()||((z)=>q.push(z)))(x);});
 });
}
function expectError(x,key){assert.equal(x.error,key,JSON.stringify(x));}
try{
 await startup();
 const asset=await fetch(origin+"/");
 assert.equal(asset.status,200);
 assert.match(await asset.text(),/LAB ĐỘC LẬP/);
 const p1=await ws("p1"),r1=await ws("r1"),agent=await ws("agent1");
 assert.equal((await p1.recv()).type,"CONNECTED");
 assert.equal((await r1.recv()).type,"CONNECTED");
 assert.equal((await agent.recv()).type,"CONNECTED");
 const first=frame("REPORT",{sku:"SKU-001"},"first");
 p1.send(first);
 const outcome=await p1.recv();
 // Initial response and event can arrive in either order.
 let result=outcome.type==="RESULT"?outcome:await p1.recv();
 assert.equal(result.ok,true,JSON.stringify(result));
 const same=await post("p1",first);
 assert.deepEqual({batch_id:same.batch_id,version:same.version},{batch_id:result.batch_id,version:result.version});
 const again=await post("p1",frame("REPORT",{sku:"SKU-002"},"first"));
 expectError(again,"REQUEST_ID_CONFLICT");
 const second=await post("p2",frame("REPORT",{sku:"SKU-001"}));
 assert.equal(second.batch_id,result.batch_id);
 const snapshot=await post("r1",frame("SNAPSHOT"));
 assert.equal(snapshot.batches.length,1);
 assert.equal(snapshot.tickets.length,2);
 const denied=await post("p1",frame("RESOLVE",{batch_id:1,expected_version:2,resolution:"HAS_STOCK"}));
 expectError(denied,"RESOLVE_FORBIDDEN");
 const conflict=await post("r1",frame("RESOLVE",{batch_id:1,expected_version:1,resolution:"HAS_STOCK"}));
 expectError(conflict,"VERSION_CONFLICT");
 const resolved=await post("r1",frame("RESOLVE",{batch_id:1,expected_version:2,resolution:"SKIP_ALLOWED"}));
 assert.equal(resolved.version,3);
 const corrected=await post("r1",frame("CORRECT",{batch_id:1,expected_version:3,resolution:"HAS_STOCK"}));
 assert.equal(corrected.version,4);
 const ack=await post("p1",frame("ACK",{batch_id:1,event_id:corrected.event_id}));
 assert.equal(ack.ack,true);
 const sku=await post("agent1",frame("SKU_SYNC",{sku:"SKU-004",name:"Thử nghiệm",location:"D04"}));
 assert.equal(sku.ok,true);
 const chat=await post("agent1",frame("CHAT",{target:"p1",message:"Thông điệp thử"}));
 assert.equal(chat.ok,true);
 const call=await post("agent1",frame("CALL_CV",{target:"p2"}));
 assert.equal(call.ok,true);
 const recovered=await post("p1",frame("RECOVER",{after_seq:0}));
 assert(recovered.events.some(x=>x.kind==="CHAT"));
 assert(!recovered.events.some(x=>x.kind==="CALL_CV"));
 const meters=await post("agent1",frame("METERS"));
 assert(meters.meters.HTTP>0&&meters.meters.WS>0&&meters.meters.HANDSHAKE>=3);
 assert.match(meters.note,/MÔ PHỎNG/);
 p1.close();r1.close();agent.close();
 console.log("M2_E110_SANDBOX_LOCAL_PASS: isolated web asset, 3 WebSockets, HTTP retry/CAS/ACK/SKU/CHAT/CV, audience recovery and synthetic meter");
}catch(e){
 console.error("M2_E110_SANDBOX_LOCAL_FAIL",String(e?.stack||e),output.slice(-4500));
 process.exitCode=1;
}finally{
 worker.kill("SIGTERM");
 await delay(400);
 try{rmSync(persist,{recursive:true,force:true});}catch{}
}
