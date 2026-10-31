#!/usr/bin/env node
// D173-E111 local-only evidence. 60 virtual WebSockets are NOT 60 distinct PDA/auth sessions.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root=fileURLToPath(new URL("../../",import.meta.url));
const wrangler=join(root,"service/node_modules/wrangler/bin/wrangler.js");
const reports=join(root,"artifacts/d173-e111");mkdirSync(reports,{recursive:true});
const persist=mkdtempSync(join(tmpdir(),"m2-e111-load-"));
const worker=spawn(process.execPath,[wrangler,"dev","--config","tools/d173_e110_sandbox/wrangler.toml",
  "--local","--ip","127.0.0.1","--port","9897","--persist-to",persist,"--log-level","error"],
  {cwd:root,stdio:["ignore","pipe","pipe"]});
let output="";
for(const s of [worker.stdout,worker.stderr])s.on("data",b=>output=(output+String(b)).slice(-4000));
const base="http://127.0.0.1:9897";
const trace={at:new Date().toISOString(),lab:"D173-E111",production:false,provider_requests:0,
  virtual_sockets:60,unique_fixture_picker_users:2,checks:[],latency_ms:{},meter_before:null,meter_after:null,
  errors:[],limitations:["60 lab sockets share p1 fixture identity, not 60 physical PDA",
    "SQLite local cost and latency are not Cloudflare billed / mobile field measurements"]};
function record(name,pass,details={}){trace.checks.push({name,pass:!!pass,...details});}
function sample(v){const nums=[...v].sort((a,b)=>a-b);return{count:nums.length,
  p50:+nums[Math.ceil(nums.length*.5)-1].toFixed(2),
  p95:+nums[Math.ceil(nums.length*.95)-1].toFixed(2),
  p99:+nums[Math.ceil(nums.length*.99)-1].toFixed(2),
  max:+nums[nums.length-1].toFixed(2)};}
const mk=(operation,args={},request_id=crypto.randomUUID())=>({operation,args,request_id});
async function http(uid,frame) {
  const started=performance.now();
  const url=base+"/command?uid="+uid+"&gen=1";
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(frame),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error("HTTP "+r.status+" "+uid+" "+frame.operation);
  const data=await r.json();
  return {data,ms:performance.now()-started};
}
async function startup(){
  for(let i=0;i<180;i++){
    if(worker.exitCode!==null)throw Error("Wrangler exited "+output);
    try {const r=await fetch(base+"/health",{signal:AbortSignal.timeout(1000)});
      if(r.ok&&(await r.json()).isolated)return;
    }catch{}await delay(200);}
  throw Error("Worker timeout "+output);
}
function connected(uid){
  return new Promise((resolve,reject)=>{
    const w=new WebSocket("ws://127.0.0.1:9897/socket?uid="+uid+"&gen=1");
    const pending=new Map();let events=0;
    const timer=setTimeout(()=>reject(Error("WS connect timeout "+uid)),18000);
    w.addEventListener("open",()=>{
      clearTimeout(timer);
      resolve({
        get events(){return events;},
        request:frame=>new Promise((yes,no)=>{
          const start=performance.now();
          const alarm=setTimeout(()=>{pending.delete(frame.request_id);no(Error("WS ACK timeout "+frame.operation));},12000);
          pending.set(frame.request_id,{yes,no,alarm,start});
          w.send(JSON.stringify(frame));
        }),
        close:()=>w.close()
      });
    });
    w.addEventListener("message",e=>{
      let data;try{data=JSON.parse(String(e.data));}catch{return;}
      if(data.type==="EVENT")events++;
      if(data.type==="RESULT"){
        const p=pending.get(data.request_id);
        if(!p)return;
        pending.delete(data.request_id);clearTimeout(p.alarm);
        p.yes({data,ms:performance.now()-p.start});
      }
    });
    w.addEventListener("error",()=>{if(w.readyState!==WebSocket.OPEN)reject(Error("WS error"));});
    w.addEventListener("close",()=>{for(const p of pending.values()){clearTimeout(p.alarm);p.no(Error("socket closed"));}pending.clear();});
  });
}
let clients=[];
try{
  await startup();
  const before=await http("agent1",mk("METERS"));trace.meter_before=before.data.meters;
  const open=performance.now();
  clients=await Promise.all(Array.from({length:60},()=>connected("p1")));
  trace.latency_ms.connect_60_total=+(performance.now()-open).toFixed(2);
  record("60_WEBSOCKET_UPGRADE",clients.length===60,{total_ms:trace.latency_ms.connect_60_total});
  const warm=await Promise.all(clients.map(w=>w.request(mk("SNAPSHOT"))));
  record("60_CONCURRENT_SNAPSHOTS",warm.every(x=>x.data.ok),{count:warm.length});
  trace.latency_ms.snapshot_60=sample(warm.map(x=>x.ms));
  // 20 distinct skus to avoid fixture business duplicates; agent uses existing local SQL only.
  for(let i=0;i<20;i++){
    const x=await http("agent1",mk("SKU_SYNC",{sku:"E111-"+String(i).padStart(3,"0"),
      name:"Synthetic item "+i,location:"E"+i}));
    if(!x.data.ok)throw Error("SKU seed failed "+i+" "+JSON.stringify(x.data));
  }
  const frames=Array.from({length:20},(_,i)=>mk("REPORT",{sku:"E111-"+String(i).padStart(3,"0")},"E111-report-"+i));
  const burstStarted=performance.now();
  const burst=await Promise.all(frames.map((f,i)=>clients[i].request(f)));
  const burstElapsed=performance.now()-burstStarted;
  trace.latency_ms.report_20=sample(burst.map(x=>x.ms));
  record("20_COMMAND_BURST_UNDER_5S_LOCAL",burst.every(x=>x.data.ok)&&burstElapsed<5000,
    {elapsed_ms:+burstElapsed.toFixed(2),count:20});
  const replay=await Promise.all(frames.map(f=>http("p1",f)));
  const duplicateFree=replay.every((x,i)=>x.data.batch_id===burst[i].data.batch_id&&x.data.event_id===burst[i].data.event_id);
  record("20_REPLAY_SAME_REQUEST_ID_NO_DUPLICATION",duplicateFree,{count:20});
  const rSnapshot=await http("r1",mk("SNAPSHOT"));
  const e111Batches=rSnapshot.data.batches.filter(b=>String(b.sku).startsWith("E111-"));
  record("20_DISTINCT_LAB_BATCHES",e111Batches.length===20,{actual:e111Batches.length});
  const rStart=performance.now();
  const resolutions=await Promise.all(e111Batches.map(b=>http("r1",mk("RESOLVE",
    {batch_id:b.id,expected_version:b.version,resolution:"HAS_STOCK"}))));
  trace.latency_ms.resolve_20=sample(resolutions.map(x=>x.ms));
  record("20_REPORTER_RESOLUTIONS",resolutions.every(x=>x.data.ok),
    {elapsed_ms:+(performance.now()-rStart).toFixed(2)});
  const first=burst[0].data;
  const ack=await http("p1",mk("ACK",{batch_id:first.batch_id,
    event_id:resolutions.find(x=>x.data.batch_id===first.batch_id)?.data.event_id}));
  record("PICKER_ACK_AFTER_REPORTER",ack.data.ok===true&&ack.data.ack===true);
  const eventTotal=clients.reduce((n,c)=>n+c.events,0);
  record("WEBSOCKET_EVENT_FANOUT",eventTotal>=1200,{frames_delivered:eventTotal});
  // Release 55 clients before generating cursor pagination pressure.
  for(const c of clients.slice(5))c.close();
  clients=clients.slice(0,5);
  const reopen=await Promise.all(Array.from({length:15},()=>connected("p1")));
  record("RECONNECT_15_VIRTUAL_SESSIONS",reopen.length===15);
  for(const c of reopen)c.close();
  // >201 recipient-visible events proves whether covered-through cursor may skip.
  for(let i=0;i<225;i++){
    const result=await http("agent1",mk("SKU_SYNC",{sku:"E111-page-"+String(i).padStart(4,"0"),
      name:"Synthetic paging "+i,location:"LAB"}));
    if(!result.data.ok)throw Error("pagination seed failed "+i);
  }
  const cursor=await http("p1",mk("RECOVER",{after_seq:0,limit:100}));
  const last=cursor.data.events?.at(-1)?.seq??0;
  const skipped=Number(cursor.data.covered_through||0)>Number(last);
  record("RECOVERY_CURSOR_NO_EVENT_SKIP_201_PLUS",!skipped,
    {returned:cursor.data.events?.length,highest_returned_seq:last,
      covered_through:cursor.data.covered_through,latest_seq:cursor.data.latest_seq,
      observation:skipped?"FAIL: cursor advances over events not returned to recipient":"No skip observed"});
  // Query parameter uid currently functions as a test identity; must never enter prod.
  const arbitraryActor=await http("r1",mk("SNAPSHOT"));
  record("FIREBASE_VERIFIED_IDENTITY_AT_INGRESS",false,
    {observation:"LAB accepts query uid=r1 without Firebase bearer token",
     simulated_reporter_snapshot:arbitraryActor.data.ok===true});
  const after=await http("agent1",mk("METERS"));trace.meter_after=after.data.meters;
  record("PROVIDER_BILLABLE_REQUESTS_MEASURED",false,
    {observation:"Only local synthetic counters; no provider account billable quantities"});
  record("REAL_60_DISTINCT_PDA_END_TO_END",false,
    {observation:"Virtual sockets share the same synthetic p1 identity; no physical PDA or FCM"});
  record("PRODUCTION_SOURCE_PARITY",false,
    {observation:"Lab is separate tools/ worker, does not execute service/src InventoryCore or real clients"});
}catch(error){
  trace.errors.push(String(error?.stack||error).slice(0,2200));
  record("LOAD_DRIVER_COMPLETE",false,{reason:String(error?.message||error)});
  process.exitCode=1;
}finally{
  for(const c of clients)try{c.close();}catch{}
  worker.kill("SIGTERM");await delay(400);
  rmSync(persist,{recursive:true,force:true});
  trace.finished_at=new Date().toISOString();
  trace.failures=trace.checks.filter(x=>!x.pass).map(x=>x.name);
  writeFileSync(join(reports,"local-load-fault.json"),JSON.stringify(trace,null,2));
  console.log("D173_E111_LOCAL_LOAD_REPORT "+JSON.stringify({
    total_checks:trace.checks.length,passed:trace.checks.filter(x=>x.pass).length,
    failed:trace.failures,latency:trace.latency_ms,errors:trace.errors}));
}
