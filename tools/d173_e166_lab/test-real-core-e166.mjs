#!/usr/bin/env node
// D173-E166: bounded A/B/C on published InventoryCore in isolated LAB DOs.
// Never points at production. TEST-ONLY event projection is not commit-atomic.
import {spawn} from "node:child_process";
import {mkdirSync,mkdtempSync,rmSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {randomBytes} from "node:crypto";
const remote=Boolean(process.env.M2_LAB_URL);
const origin=(process.env.M2_LAB_URL||"http://127.0.0.1:9899").replace(/\/$/,"");
if(remote&&(!origin.startsWith("https://")||!new URL(origin).hostname.endsWith(".workers.dev")))throw Error("NO_PRODUCTION_TRAFFIC");
const key=process.env.M2_LAB_GATE_KEY||randomBytes(32).toString("hex");
if(!/^[a-z0-9-]{20,128}$/i.test(key))throw Error("INVALID_TEST_KEY");
const root=process.cwd(),out=join(root,"artifacts/d173-e166");mkdirSync(out,{recursive:true});
const state={at:new Date().toISOString(),kind:"E166_REAL_CORE_ISOLATED",remote,script:"supra-inventory-m2-lab",budget:{max_calls:700,max_sockets:45,max_seconds:120},
 calls:{http:0,ws_connections:0,ws_messages:0},variants:{},checks:[],status:"RUNNING",
 limitations:["LAB identity, not Firebase Auth","No FCM, WMS, UI or real PDA","E166 sidecar events are not atomic with Core business commits","Raw DO analytics are NOT billed Compute Requests"]};
const deadline=Date.now()+120000;let proc=null,temp=null;
const devVars=join(root,"tools/d173_e113_cloud_lab/.dev.vars");
function guard(kind){
 if(Date.now()>deadline)throw Error("TIME_CEILING_120S");
 if(state.calls[kind]>=0)state.calls[kind]++;
 if(state.calls.http+state.calls.ws_connections+state.calls.ws_messages>700)throw Error("TRAFFIC_CEILING");
 if(state.calls.ws_connections>45)throw Error("SOCKET_CEILING");
}
function check(label,pass,details){state.checks.push({label,pass:Boolean(pass),details:details||null});if(!pass)throw Error("ASSERT_"+label+" "+JSON.stringify(details||{}).slice(0,300));}
function pctl(a,n){const s=[...a].sort((x,y)=>x-y);return s.length?Number(s[Math.max(0,Math.ceil(n*s.length)-1)].toFixed(2)):null;}
async function http(v,path,body){
 guard("http");
 const url=new URL(origin+path);url.searchParams.set("variant",v);
 const start=performance.now(),r=await fetch(url,{method:body?"POST":"GET",
  headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(14000)});
 const data=await r.json().catch(()=>({}));
 return {status:r.status,data,ms:performance.now()-start,object_suffix:r.headers.get("x-e166-test-object-suffix")};
}
async function socket(v,actor){
 guard("ws_connections");
 const u=new URL(origin.replace(/^http/,"ws")+"/__lab/ws");
 u.searchParams.set("variant",v);u.searchParams.set("actor",actor);u.searchParams.set("e166","1");
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(u.toString(),["m2lab."+key]),events=[],results=new Map();
  const timeout=setTimeout(()=>reject(Error("SOCKET_UPGRADE_TIMEOUT")),14000);
  ws.onopen=()=>{clearTimeout(timeout);resolve({
    actor,events,
    command(data){guard("ws_messages");const start=performance.now();
     return new Promise((ok,fail)=>{
      const rid=data.request_id;const t=setTimeout(()=>{results.delete(rid);fail(Error("WS_COMMAND_TIMEOUT"));},14000);
      results.set(rid,{ok,fail,t,start});ws.send(JSON.stringify({...data,type:"E166_COMMAND"}));
     });},
    close(){ws.close();}
   });};
  ws.onmessage=e=>{let value;try{value=JSON.parse(String(e.data))}catch{return}
   if(value.type==="E166_EVENT")events.push(value);
   if(value.type==="RESULT"){const task=results.get(value.request_id);if(task){
    clearTimeout(task.t);results.delete(value.request_id);
    task.ok({status:value.http_status,data:value,ms:performance.now()-task.start});
   }}
  };
  ws.onerror=()=>reject(Error("SOCKET_ERROR"));
  ws.onclose=()=>{for(const x of results.values()){clearTimeout(x.t);x.fail(Error("SOCKET_CLOSED"))}results.clear()};
 });
}
async function startLocal(){
 if(remote)return;
 if(existsSync(devVars))throw Error("CANNOT_OVERWRITE_DEV_VARS");
 writeFileSync(devVars,"M2_LAB_GATE_KEY="+key+"\nM2_LAB_EXPIRES_AT="+String(Date.now()+360000)+"\n",{mode:0o600});
 temp=mkdtempSync("/tmp/e166-lab-");
 proc=spawn(process.execPath,["service/node_modules/wrangler/bin/wrangler.js","dev","--config","tools/d173_e113_cloud_lab/wrangler.toml","--local","--ip","127.0.0.1","--port","9899","--persist-to",temp,"--log-level","error"],{cwd:root,stdio:"ignore"});
 for(let i=0;i<140;i++){
  if(proc.exitCode!==null)throw Error("WRANGLER_STOPPED");
  try{const x=await fetch(origin+"/__lab/health?variant=e166-a",{signal:AbortSignal.timeout(600)});if(x.status===401)break}catch{}
  if(i===139)throw Error("WRANGLER_START_TIMEOUT");
  await delay(180);
 }
}
const command=(actor,i)=>({actor,operation:"REPORT",args:{sku:"LAB-REAL-"+String(i).padStart(3,"0")},request_id:"e166-"+actor+"-report"});
async function variant(v,mode){
 const sockets=[],readMs=[],writeMs=[];
 try{
  const init=await http(v,"/__lab/init",{});check(v+"_INIT",init.status===200,init.data?.error);
  const view={variant:v,mode,object_suffix:init.object_suffix};
  const actors=Array.from({length:20},(_,i)=>"p"+(i+1));
  let reporter=null;const byActor=new Map();
  if(mode!=="baseline"){
   reporter=await socket(v,"r1");sockets.push(reporter);
   for(const actor of actors){const s=await socket(v,actor);byActor.set(actor,s);sockets.push(s)}
  }
  const burstStart=performance.now();
  const results=await Promise.all(actors.map(async(actor,i)=>{
   const c=command(actor,i+1);
   const output=mode==="baseline"?await http(v,"/__lab/command",c):
    mode==="http-patch"?await http(v,"/__lab/e166/command",c):await byActor.get(actor).command(c);
   writeMs.push(output.ms);return output;
  }));
  view.burst_ms=Number((performance.now()-burstStart).toFixed(2));
  check(v+"_20_UNIQUE_PICKER_WRITES",results.every(x=>Number(x.data.http_status??x.status)===201),results.map(x=>({http:x.status,core:x.data.http_status})));
  if(mode==="baseline"){
   for(const actor of actors){
    for(const op of ["PICKER_REPORTS","PICKER_RESULTS","REALTIME_DELTA"]){
     const t=await http(v,"/__lab/command",{actor,operation:op,args:{after_seq:0},request_id:"e166-read-"+actor+"-"+op});
     readMs.push(t.ms);check(v+"_BASELINE_READ_"+actor+"_"+op,t.data.http_status===200);
    }
   }
  }else{
   // Server push replaces three redundant client follow-up reads per logical create.
   for(let i=0;i<15&&reporter.events.length<20;i++)await delay(100);
   check(v+"_REPORTER_PUSH_ALL",reporter.events.length===20,{got:reporter.events.length});
   check(v+"_AUDIENCE_EXACT",actors.every(x=>byActor.get(x).events.length===1),{
    recipient_counts:actors.map(x=>byActor.get(x).events.length)});
   const r=await http(v,"/__lab/e166/recover",{actor:"r1",after_seq:0,limit:50});
   check(v+"_DURABLE_REPORTER_REPLAY",r.status===200&&r.data.events?.length===20,{n:r.data.events?.length});
   const p=await http(v,"/__lab/e166/recover",{actor:"p1",after_seq:0,limit:50});
   check(v+"_DURABLE_PICKER_SCOPE",p.data.events?.length===1&&p.data.events[0]?.payload?.actor==="p1");
   const replay=await http(v,mode==="http-patch"?"/__lab/e166/command":"/__lab/e166/command",command("p1",1));
   check(v+"_RETRY_SAME_ID_NO_EXTRA_PATCH",replay.data.http_status===200&&replay.data.e166_patch===null,{status:replay.data.http_status});
   const again=await http(v,"/__lab/e166/recover",{actor:"r1",after_seq:20,limit:50});
   check(v+"_RETRY_NO_EXTRA_EVENT",again.data.events?.length===0);
   view.push_count=reporter.events.length;
  }
  const audit=await http(v,"/__lab/e166/audit");
  check(v+"_BUSINESS_AUDIT",audit.status===200&&audit.data.batches?.length===20);
  const queue=await http(v,"/__lab/command",{actor:"r1",operation:"QUEUE",args:{},request_id:"e166-queue"});
  check(v+"_REAL_CORE_QUEUE",queue.data.http_status===200);
  view.business=audit.data.batches;
  view.write={p50:pctl(writeMs,.5),p95:pctl(writeMs,.95),p99:pctl(writeMs,.99)};
  view.read={count:readMs.length,p95:pctl(readMs,.95)};
  view.total_http_calls=state.calls.http;
  state.variants[v]=view;
 }finally{for(const s of sockets)try{s.close()}catch{}}
}
try{
 await startLocal();
 // Order alternating tests will be required before any field performance conclusion.
 await variant("e166-a","baseline");
 await variant("e166-b","http-patch");
 await variant("e166-c","ws-patch");
 const a=state.variants["e166-a"],b=state.variants["e166-b"],c=state.variants["e166-c"];
 check("REAL_CORE_A_B_C_FINAL_STATE_EQUAL",JSON.stringify(a.business)===JSON.stringify(b.business)&&JSON.stringify(b.business)===JSON.stringify(c.business));
 state.summary={read_after_write_eliminated_per_20_actions:60,variants:Object.fromEntries(Object.entries(state.variants).map(([k,v])=>[k,{burst_ms:v.burst_ms,write_p95_ms:v.write.p95,object_suffix:v.object_suffix,push_count:v.push_count||0}]))};
 state.status="PASS";console.log("E166_LAB_PASS "+JSON.stringify({checks:state.checks.length,calls:state.calls,summary:state.summary}));
}catch(e){state.status="FAIL";state.error=String(e?.stack||e).slice(0,2000);console.error("E166_LAB_FAIL "+String(e?.message||e));process.exitCode=1}
finally{
 for(const v of Object.values(state.variants))delete v.business;
 state.finished=new Date().toISOString();writeFileSync(join(out,remote?"cloud.json":"local.json"),JSON.stringify(state,null,2));
 if(proc){proc.kill("SIGTERM");await delay(300)}
 if(temp)rmSync(temp,{recursive:true,force:true});
 if(!remote&&existsSync(devVars))unlinkSync(devVars);
}
