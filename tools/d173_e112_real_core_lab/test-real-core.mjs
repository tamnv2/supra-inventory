// Real InventoryCore, real SQLite/operational V2 source. No Cloudflare/Firebase/WMS provider.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
const root=fileURLToPath(new URL("../../",import.meta.url));
const persist=mkdtempSync("/tmp/d173-e112-realcore-");
const reportDir=join(root,"artifacts/d173-e112");mkdirSync(reportDir,{recursive:true});
const origin="http://127.0.0.1:9898";
const wrangler=join(root,"service/node_modules/wrangler/bin/wrangler.js");
const child=spawn(process.execPath,[wrangler,"dev","--config","tools/d173_e112_real_core_lab/wrangler.toml","--local","--ip","127.0.0.1","--port","9898","--persist-to",persist,"--log-level","error"],
 {cwd:root,stdio:["ignore","pipe","pipe"]});
let std="";
for(const s of [child.stdout,child.stderr])s.on("data",b=>std=(std+String(b)).slice(-5500));
const result={date:new Date().toISOString(),source:"EXACT_RELEASE_INVENTORYCORE",local_only:true,checks:[],issues:[],latencies:{}};
const check=(name,ok,data)=>{result.checks.push({name,pass:!!ok,...(data||{})});assert(ok,name+" FAIL "+JSON.stringify(data||{}));};
const request=(operation,actor,args={},request_id=crypto.randomUUID())=>({operation,actor,args,request_id});
async function send(q){
 const start=performance.now();const r=await fetch(origin+"/__lab/command",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(q),signal:AbortSignal.timeout(15000)});
 const j=await r.json();return {...j,ms:performance.now()-start};
}
async function waitReady(){
 for(let i=0;i<170;i++){if(child.exitCode!==null)throw Error("Wrangler exit "+std);
  try{const r=await fetch(origin+"/__lab/health",{signal:AbortSignal.timeout(500)});
   if(r.status===200)return await r.json();}catch{}await delay(250);}
 throw Error("Core boot timeout "+std);
}
function socket(actor){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket("ws://127.0.0.1:9898/__lab/ws?actor="+actor);
  const requests=new Map();const timer=setTimeout(()=>reject(Error("socket open timeout")),8000);
  ws.onopen=()=>{clearTimeout(timer);resolve({
   send(q){return new Promise((yes,no)=>{const to=setTimeout(()=>{requests.delete(q.request_id);no(Error("WS result timeout"));},12000);requests.set(q.request_id,{yes,no,to,start:performance.now()});ws.send(JSON.stringify(q));});},
   close(){ws.close();}
  });};
  ws.onerror=()=>reject(Error("WS connection error"));
  ws.onmessage=msg=>{const d=JSON.parse(String(msg.data));if(d.type==="RESULT"&&requests.has(d.request_id)){const x=requests.get(d.request_id);clearTimeout(x.to);requests.delete(d.request_id);x.yes({...d,ms:performance.now()-x.start});}};
 });
}
let ws;
try{
 const health=await waitReady();
 check("EXACT_INVENTORYCORE_BOOTSTRAP",health.real_core.status==="ok"&&health.real_core.schema_version===17,{health});
 const seeded=await fetch(origin+"/__lab/init",{method:"POST"}).then(x=>x.json());
 check("LOCAL_SEPARATE_SCHEMA_FIXTURES",seeded.ok&&seeded.actors.length===4,{seeded});
 const queue=await send(request("QUEUE","r1"));
 check("REAL_AUTHORIZED_REPORTER_QUEUE",queue.http_status===200,{status:queue.http_status});
 const denied=await send(request("RESOLVE","p1",{batch_id:"fake",resolution:"HAS_STOCK"}));
 check("REAL_SOURCE_ROLE_DENY",denied.http_status===403,{denied:denied.body});
 ws=await socket("p1");
 const q=request("REPORT","p1",{sku:"LAB-REAL-001"},"E112-first-idempotent");
 const first=await ws.send(q);
 result.latencies.report_ws_ms=+first.ms.toFixed(1);
 check("REAL_BIZ_REPORT_WS",first.http_status===201,{status:first.http_status,body:first.body});
 const retry=await send(q);
 check("REAL_BIZ_WS_TO_HTTP_IDEMPOTENT",retry.http_status===200&&retry.body?.result?.idempotent_replay===true,
  {http_status:retry.http_status,retry:retry.body});
 const created=first.body?.result;
 const batch=created?.batch_id||created?.ticket?.batch_id;
 check("REAL_BIZ_BATCH_ID",typeof batch==="string"&&batch.length>0,{batch});
 const queueAfter=await send(request("QUEUE","r1"));
 check("REAL_BIZ_QUEUE_AFTER_REPORT",queueAfter.http_status===200,{status:queueAfter.http_status});
 const resolution=await send(request("RESOLVE","r1",{batch_id:batch,resolution:"HAS_STOCK"}));
 check("REAL_BIZ_REPORTER_RESOLVE",resolution.http_status===200,{status:resolution.http_status,body:resolution.body});
 const pending=await send(request("PICKER_REPORTS","p1"));
 check("REAL_BIZ_PICKER_QUERY",pending.http_status===200,{status:pending.http_status});
 const bad=await send(request("REPORT","r1",{sku:"LAB-REAL-001"}));
 check("REAL_BIZ_REPORTER_CANNOT_PICK",bad.http_status===403,{status:bad.http_status});
 const noauth=await send(request("BOGUS","p1",{}));
 check("LAB_ACTION_ALLOWLIST",noauth.http_status===403,{status:noauth.http_status});
 // Actual Core, actual SQL migration: socket concurrency/20 distinct business commands.
 const virtual=[];const opened=performance.now();
 try{
  for(let i=0;i<60;i+=10){
   const group=await Promise.all(Array.from({length:10},()=>socket("p2")));
   virtual.push(...group);
  }
  result.latencies.ws_60_upgrade_ms=+(performance.now()-opened).toFixed(1);
  check("REAL_CORE_60_LOCAL_WS_UPGRADES",virtual.length===60,{connections:virtual.length});
  const commands=Array.from({length:20},(_,i)=>request("REPORT","p2",
    {sku:"LAB-REAL-"+String(i+2).padStart(3,"0")},"e112-burst-"+i));
  const started=performance.now();
  const bursts=await Promise.all(commands.map((q,i)=>virtual[i].send(q)));
  result.latencies.burst_20_ms=+(performance.now()-started).toFixed(1);
  check("REAL_CORE_20_BUSINESS_COMMANDS_LOCAL_UNDER_5S",
    bursts.length===20&&bursts.every(x=>x.http_status===201)&&result.latencies.burst_20_ms<5000,
    {count:bursts.length,duration_ms:result.latencies.burst_20_ms,
      statuses:bursts.map(x=>x.http_status)});
  const replays=await Promise.all(commands.map(send));
  check("REAL_CORE_20_WS_HTTP_REPLAY_IDENTICAL",
    replays.every((x,i)=>x.http_status===200&&x.body?.result?.idempotent_replay===true
      &&x.body?.result?.ticket?.ticket_id===bursts[i].body?.result?.ticket?.ticket_id),
    {count:replays.length});
  const reporter=await send(request("QUEUE","r1"));
  check("REAL_CORE_REPORTER_QUEUE_AFTER_BURST",reporter.http_status===200,
    {status:reporter.http_status});
 }finally{for(const c of virtual)try{c.close()}catch{}}

 console.log("D173_E112_REAL_CORE_TEST_PASS",JSON.stringify({checks:result.checks.length,source:result.source,ms:result.latencies}));
}catch(e){result.issues.push(String(e.stack||e).slice(0,4000));process.exitCode=1;console.error("D173_E112_REAL_CORE_TEST_FAIL",result.issues[0],std);}
finally{
 try{ws?.close()}catch{}
 child.kill("SIGTERM");await delay(400);try{rmSync(persist,{recursive:true,force:true})}catch{}
 result.finished=new Date().toISOString();result.status=result.issues.length?"FAIL":"PASS";
 writeFileSync(join(reportDir,"real-core-e2e.json"),JSON.stringify(result,null,2));
}
