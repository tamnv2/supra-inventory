#!/usr/bin/env node
// E113 one bounded run: same actual InventoryCore logic on independent HTTP and M2 DO SQL instances.
// Fails immediately if real cloud auth/provider unavailable; never auto-retries cloud business writes.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
import {randomBytes} from "node:crypto";
const root=fileURLToPath(new URL("../../",import.meta.url));
const basedir=join(root,"tools/d173_e113_cloud_lab");
const cloud=!!process.env.M2_LAB_URL;
const origin=(process.env.M2_LAB_URL||"http://127.0.0.1:9899").replace(/\/$/,"");
const key=process.env.M2_LAB_GATE_KEY||randomBytes(32).toString("hex");
if(!/^[a-zA-Z0-9-]{20,128}$/.test(key))throw Error("LAB_TOKEN_FORMAT");
if(cloud&&!origin.startsWith("https://"))throw Error("REMOTE_MUST_USE_HTTPS");
if(cloud&&!/\.workers\.dev$/.test(new URL(origin).hostname))throw Error("NO_EXTERNAL_CUSTOM_DOMAIN_ALLOWED");
let wranglerOutput="";
const reportDir=join(root,"artifacts/d173-e113");mkdirSync(reportDir,{recursive:true});
let worker=null,persist=null,devVars=join(basedir,".dev.vars");
const report={date:new Date().toISOString(),test:"D173-E113-METERED-REAL-SOURCE",
 deployment:cloud?"REMOTE_CLOUDFLARE":"WRANGLER_LOCAL",identity:"TEST_ONLY",
 source:"EXACT_RELEASE_INVENTORYCORE",budget:{max_total_requests:700,max_websockets:60,max_seconds:120},
 calls:{http:0,ws_messages:0,ws_connections:0},checks:[],measurements:{},errors:[],
 evidence:[],cautions:["Same Cloudflare account aggregate billing; GraphQL invocation sums may lag and are NOT billed DO requests",
 "60 WebSockets share synthetic actors; no physical PDA, WMS or Firebase Auth used"]};
const checks=(name,pass,details={})=>{report.checks.push({name,pass:!!pass,...details});if(!pass)throw Error("CHECK_FAIL "+name+" "+JSON.stringify(details));};
const deadline=Date.now()+120000;
function budget(kind){
 if(Date.now()>deadline)throw Error("LAB_120S_ABORT");
 const n=report.calls.http+report.calls.ws_messages+report.calls.ws_connections;
 if(n>=700)throw Error("LAB_700_REQUEST_ABORT");
 report.calls[kind]++;
}
function quantile(values){const s=[...values].sort((a,b)=>a-b);const p=x=>Math.round(s[Math.max(0,Math.ceil(s.length*x)-1)]*100)/100;
 return {count:s.length,p50_ms:p(.5),p95_ms:p(.95),p99_ms:p(.99),max_ms:p(1)};}
function cmd(actor,operation,args={},request_id=randomBytes(12).toString("hex")){
 return {actor,operation,args,request_id};
}
async function http(variant,path,body){
 budget("http");const u=new URL(origin+path);
 u.searchParams.set("variant",variant);
 const start=performance.now();
 const req={method:body?"POST":"GET",headers:{authorization:"Bearer "+key,"content-type":"application/json"},signal:AbortSignal.timeout(14000)};
 if(body)req.body=JSON.stringify(body);
 const response=await fetch(u,req),data=await response.json();
 return {data,http_status:Number(data.http_status??response.status),ms:performance.now()-start};
}
async function ws(variant,actor){
 budget("ws_connections");
 const u=new URL(origin.replace(/^http/,"ws")+"/__lab/ws");
 u.searchParams.set("variant",variant);u.searchParams.set("actor",actor);
 return new Promise((resolve,reject)=>{
  const sock=new WebSocket(u.toString(),["m2lab."+key]);
  const inflight=new Map();
  const timeout=setTimeout(()=>reject(Error("WS_UPGRADE_TIMEOUT")),14000);
  sock.onopen=()=>{clearTimeout(timeout);resolve({
   send(x){budget("ws_messages");const started=performance.now();
    return new Promise((res,rej)=>{
     const alarm=setTimeout(()=>{inflight.delete(x.request_id);rej(Error("WS_RESULT_TIMEOUT"));},14000);
     inflight.set(x.request_id,{res,rej,alarm,started});
     sock.send(JSON.stringify(x));
    });},
   close(){sock.close();}
  });};
  sock.onmessage=evt=>{let data;try{data=JSON.parse(String(evt.data));}catch{return;}
    if(data.type==="RESULT"){const task=inflight.get(data.request_id);if(!task)return;
      clearTimeout(task.alarm);inflight.delete(data.request_id);task.res({data,
        http_status:Number(data.http_status),ms:performance.now()-task.started});}
  };
  sock.onerror=e=>reject(Error("WS_NETWORK_ERROR "+String(e?.message||"unknown")));
  sock.onclose=()=>{for(const task of inflight.values()){clearTimeout(task.alarm);task.rej(Error("WS_CLOSED"));}inflight.clear();};
 });
}
async function startLocal(){
 if(cloud)return;
 if(existsSync(devVars))throw Error("LOCAL_DEV_VARS_ALREADY_EXISTS_STOP");
 const expires=String(Date.now()+8*60000);
 writeFileSync(devVars,"M2_LAB_GATE_KEY="+key+"\nM2_LAB_EXPIRES_AT="+expires+"\n",{mode:0o600});
 persist=mkdtempSync("/tmp/d173-e113-");
 const path=join(root,"service/node_modules/wrangler/bin/wrangler.js");
 worker=spawn(process.execPath,[path,"dev","--config","tools/d173_e113_cloud_lab/wrangler.toml",
 "--local","--ip","127.0.0.1","--port","9899","--persist-to",persist,"--log-level","error"],
 {cwd:root,stdio:["ignore","pipe","pipe"]});
 for(const s of [worker.stdout,worker.stderr])s.on("data",b=>wranglerOutput=(wranglerOutput+String(b)).slice(-6500));
 for(let i=0;i<140;i++){
  if(worker.exitCode!==null)throw Error("LOCAL_WRANGLER_EXIT");
  try{const r=await fetch(origin+"/__lab/health?variant=http",{signal:AbortSignal.timeout(800)});
   // Guard ensures unauthorized request returns 401, proving server listens.
   if(r.status===401)return;}catch{}
  await delay(170);
 }
 throw Error("LOCAL_WRANGLER_NOT_STARTED");
}
function shape(x){
 const v=x?.data?.body?.result||{};
 return {status:v.status,hasTicket:!!v.ticket,hasBatch:!!v.batch_id||!!v.ticket?.batch_id,event:Boolean(v.event_id)};
}
async function compareScenario(variant,useWs){
 let s=null;
 const samples=[];
 try{
  if(useWs)s=await ws(variant,"p1");
  const first=await (useWs?s.send(cmd("p1","REPORT",{sku:"LAB-REAL-001"},"e113-create-first")):
    http(variant,"/__lab/command",cmd("p1","REPORT",{sku:"LAB-REAL-001"},"e113-create-first")));
  checks(variant+"_CREATE_REAL_CORE_201",first.http_status===201,{status:first.http_status});
  const created=first.data.body?.result;
  const id=created?.ticket?.batch_id||created?.batch_id;
  checks(variant+"_REAL_UUID_BATCH",typeof id==="string"&&id.length>15);
  const duplicate=await http(variant,"/__lab/command",cmd("p1","REPORT",{sku:"LAB-REAL-001"},"e113-create-first"));
  checks(variant+"_WS_HTTP_IDEMPOTENCY",duplicate.http_status===200&&duplicate.data.body?.result?.idempotent_replay===true);
  const second=await http(variant,"/__lab/command",cmd("p2","REPORT",{sku:"LAB-REAL-001"},"e113-other-picker"));
  checks(variant+"_GROUP_TWO_PICKERS",second.http_status===201&&second.data.body?.result?.ticket?.batch_id===id);
  const denied=await http(variant,"/__lab/command",cmd("p1","RESOLVE",{batch_id:id,resolution:"HAS_STOCK"}));
  checks(variant+"_ROLE_DENY",denied.http_status===403);
  const resolve=await http(variant,"/__lab/command",cmd("r1","RESOLVE",{batch_id:id,resolution:"HAS_STOCK"}));
  checks(variant+"_REPORTER_RESOLVE",resolve.http_status===200,{status:resolve.http_status});
  const reports=await http(variant,"/__lab/command",cmd("p1","PICKER_REPORTS"));
  checks(variant+"_PICKER_READ",reports.http_status===200);
  // 20 genuinely unique business writes, not a mock counter.
  const actions=Array.from({length:20},(_,i)=>cmd("p1","REPORT",
    {sku:"LAB-REAL-"+String(i+2).padStart(3,"0")},"e113-burst-"+i));
  const start=performance.now();
  const events=await Promise.all(actions.map(a=>useWs?s.send(a):http(variant,"/__lab/command",a)));
  report.measurements[variant+"_burst_duration_ms"]=Math.round((performance.now()-start)*100)/100;
  checks(variant+"_20_REAL_BUSINESS_WRITES",events.every(x=>x.http_status===201),{
   count:events.length,elapsed_ms:report.measurements[variant+"_burst_duration_ms"]});
  for(const x of events)samples.push(x.ms);
  report.measurements[variant+"_report_latency"]=quantile(samples);
  const again=await Promise.all(actions.map(a=>http(variant,"/__lab/command",a)));
  checks(variant+"_REPLAY_NO_DUPLICATE",again.every((x,i)=>x.http_status===200
    &&x.data.body?.result?.idempotent_replay===true
    &&x.data.body?.result?.ticket?.ticket_id===events[i].data.body?.result?.ticket?.ticket_id));
  return {status:"PASS",first:shape(first),other:shape(second),resolution:shape(resolve),
    report20:events.length,reported:report.measurements[variant+"_report_latency"]};
 }finally{try{s?.close();}catch{}}
}
let sockets=[];
try{
 await startLocal();
 checks("GATE_NO_BEARER_DENIED", (await fetch(origin+"/__lab/health?variant=http")).status===401);
 const a=await http("http","/__lab/health");
 const b=await http("m2","/__lab/health");
 checks("TWO_INDEPENDENT_REAL_CORE_NAMESPACES",a.http_status===200&&b.http_status===200);
 const initHttp=await http("http","/__lab/init",{});
 const initM2=await http("m2","/__lab/init",{});
 checks("REAL_SCHEMA_FIXTURES_BOTH_VARIANTS",initHttp.http_status===200&&initM2.http_status===200);
 const old=await compareScenario("http",false);
 const modern=await compareScenario("m2",true);
 checks("REAL_BIZ_HTTP_M2_PARITY",JSON.stringify(old.first)===JSON.stringify(modern.first)
  &&JSON.stringify(old.resolution)===JSON.stringify(modern.resolution),{old,modern});
 const started=performance.now();
 // One test actor with 60 virtual sessions, not 60 distinct devices.
 for(let i=0;i<6;i++)sockets.push(...await Promise.all(Array.from({length:10},()=>ws("m2","p1"))));
 report.measurements["m2_connect_60_ms"]=Math.round((performance.now()-started)*100)/100;
 checks("60_REMOTE_OR_LOCAL_WEBSOCKET_UPGRADES",sockets.length===60);
 const actions=Array.from({length:60},()=>cmd("p1","QUEUE"));
 const outputs=await Promise.all(actions.map((x,i)=>sockets[i].send(cmd("p1","PICKER_REPORTS"))));
 checks("60_CONCURRENT_CORE_READS",outputs.every(x=>x.http_status===200));
 report.measurements["m2_read_60_latency"]=quantile(outputs.map(x=>x.ms));
 for(const x of sockets)x.close();sockets=[];
 report.evidence.push("No WMS/Firebase/GCP account; real InventoryCore from service/src executed in dedicated DOs");
 console.log("D173_E113_REAL_CLOUD_OR_LOCAL_PASS "+JSON.stringify({
  checks:report.checks.length,transport:report.deployment,measurements:report.measurements,calls:report.calls}));
}catch(e){
 report.errors.push(String(e?.stack||e).slice(0,2500));
 if(!cloud)report.errors.push(wranglerOutput.slice(-4500));
 process.exitCode=1;
 console.error("D173_E113_TEST_FAIL "+String(e?.message||e).slice(0,400));
 if(!cloud)console.error("D173_E113_LOCAL_WRANGLER_DIAGNOSTIC "+wranglerOutput.slice(-3500));
}finally{
 for(const x of sockets)try{x.close()}catch{}
 if(worker){worker.kill("SIGTERM");await delay(300);}
 if(persist)try{rmSync(persist,{recursive:true,force:true})}catch{}
 if(!cloud&&existsSync(devVars))unlinkSync(devVars);
 report.finished=new Date().toISOString();
 report.status=report.errors.length?"FAIL":"PASS";
 writeFileSync(join(reportDir,cloud?"remote-parity.json":"local-parity.json"),JSON.stringify(report,null,2));
}
