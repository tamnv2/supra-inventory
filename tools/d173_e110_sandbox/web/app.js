const el=id=>document.getElementById(id),uid=()=>el("actor").value;
let socket=null,pending=new Map(),snapshot=null,seq=0;
// Per-tab ephemeral telemetry; do not store raw credentials or free-text messages.
const clientTrace=[];
function trace(kind,fields={}){
  clientTrace.push({at:new Date().toISOString(),kind,...fields});
  if(clientTrace.length>4000)clientTrace.shift();
}
const safeFields=payload=>{
  const keep=["sku","batch_id","expected_version","event_id","resolution","target","status","version","current_version","error","ok","ack"];
  const out={};for(const key of keep){const value=payload?.[key];if(["string","number","boolean"].includes(typeof value))out[key]=value;}
  return out;
};
const now=()=>new Date().toLocaleTimeString("vi-VN");
const log=(msg)=>{const line=document.createElement("div");line.textContent=now()+"  "+msg;el("feed").prepend(line);while(el("feed").children.length>70)el("feed").lastChild.remove();};
const error=msg=>{el("errors").textContent=msg;log("LỖI "+msg);};
const id=()=>crypto.randomUUID();
function endpoint(path){return path+"?uid="+encodeURIComponent(uid())+"&gen=1";}
function togglePanels(){const x=uid();el("pickerPanel").classList.toggle("hidden",!x.startsWith("p"));el("reporterPanel").classList.toggle("hidden",x!=="r1");el("agentPanel").classList.toggle("hidden",x!=="agent1");}
async function http(frame){const r=await fetch(endpoint("/command"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(frame)});if(!r.ok)throw Error("HTTP "+r.status);return r.json();}
function connect(){
  if(socket){try{socket.close();}catch{}socket=null;}
  trace("CONNECT_ATTEMPT",{actor:uid(),mode:el("mode").value});
  for(const fail of pending.values())fail.reject(Error("SOCKET_RESTARTED"));pending.clear();
  togglePanels();
  if(el("mode").value!=="WS"){el("connection").textContent="HTTP đối chứng";el("lamp").style.background="#f59e0b";refresh();return;}
  const protocol=location.protocol==="https:"?"wss:":"ws:";
  const w=new WebSocket(protocol+"//"+location.host+endpoint("/socket"));socket=w;
  el("connection").textContent="Đang kết nối";
  w.onopen=()=>{trace("WS_CONNECTED",{actor:uid()});el("connection").textContent="M2 WebSocket đã kết nối";el("lamp").style.background="#22c55e";};
  w.onmessage=e=>{
    const data=JSON.parse(e.data);
    if(data.type==="RESULT"){const task=pending.get(data.request_id);if(task){clearTimeout(task.timer);pending.delete(data.request_id);task.resolve(data);}return;}
    if(data.type==="EVENT"){seq=Math.max(seq,Number(data.seq)||0);trace("WS_EVENT",{actor:uid(),seq:Number(data.seq),event_kind:String(data.kind),payload:safeFields(data.payload)});log("WS event #"+data.seq+" "+data.kind+" "+JSON.stringify(data.payload));refresh();return;}
    if(data.type==="CONNECTED"){log("Kết nối realtime cho "+uid());refresh();}
  };
  w.onerror=()=>{trace("WS_ERROR",{actor:uid()});log("Socket lỗi — kiểm tra local Worker");};
  w.onclose=()=>{if(socket!==w)return;trace("WS_CLOSED",{actor:uid()});el("lamp").style.background="#ef4444";el("connection").textContent="Ngắt kết nối";};
}
async function cmd(operation,args={},requestId=id()){
  const frame={request_id:requestId,operation,args};
  const started=performance.now();
  let transport="HTTP";
  const record=(result,failure)=>trace("REQUEST",{
    actor:uid(),operation,request_id:requestId,transport,
    duration_ms:Math.round((performance.now()-started)*10)/10,
    args:safeFields(args),result:safeFields(result),
    ...(failure?{network_error:String(failure).slice(0,160)}:{})
  });
  try {
    let answer;
    if(el("mode").value!=="WS"||socket?.readyState!==WebSocket.OPEN){
      answer=await http(frame);
    } else {
      transport="WS";
      answer=await new Promise((resolve,reject)=>{
        const timer=setTimeout(async()=>{
          pending.delete(requestId);transport="WS_TO_HTTP_FALLBACK";
          log("WS không ACK; thử HTTP với CÙNG request ID");
          try{resolve(await http(frame));}catch(e){reject(e);}
        },4500);
        pending.set(requestId,{resolve,reject,timer});
        try{socket.send(JSON.stringify(frame));}catch(e){clearTimeout(timer);pending.delete(requestId);reject(e);}
      });
    }
    record(answer,null);
    return answer;
  }catch(e){record(null,e?.message||e);throw e;}
}
async function perform(op,args){el("errors").textContent="";try{const r=await cmd(op,args);log(op+" → "+JSON.stringify(r));if(r.error){error(r.error);return;}await refresh();}catch(e){error(e.message||String(e));}}
function render(x){
  snapshot=x;const batches=x.batches||[];
  el("batchCount").textContent=batches.length;
  const sku=el("sku"),current=sku.value;sku.replaceChildren();
  for(const item of x.items||[]){const option=document.createElement("option");option.value=item.sku;option.textContent=item.sku+" · "+item.name+" ("+item.location+")";sku.appendChild(option);}
  if([...sku.options].some(o=>o.value===current))sku.value=current;
  const tbody=el("batches");tbody.replaceChildren();
  for(const b of batches){const tr=document.createElement("tr");for(const value of [b.id,b.sku,b.status,b.version,b.result_event||"–"]){const td=document.createElement("td");td.textContent=String(value);tr.appendChild(td);}tr.addEventListener("click",()=>{el("resolveId").value=b.id;el("version").value=b.version;el("withdrawId").value=b.id;el("ackBatchId").value=b.id;el("ackEventId").value=b.result_event||"";});tbody.appendChild(tr);}
  for(const b of x.events||[])seq=Math.max(seq,Number(b.seq)||0);
}
async function refresh(){try{const r=await cmd("SNAPSHOT");if(r.error)throw Error(r.error);render(r);const m=await cmd("METERS");if(m.ok){el("hcount").textContent=m.meters.HTTP;el("wcount").textContent=m.meters.WS;el("bcount").textContent=m.billed_equivalent_estimate;}}catch(e){error(e.message||String(e));}}
async function downloadLog(){
  const button=el("downloadLog");button.disabled=true;
  const requestedAt=new Date().toISOString();
  try{
    // Include SQLite lab receipts/events produced by Agent HTTP and other simulated clients.
    const server=await cmd("EXPORT_LOG");
    if(!server.ok)throw Error(server.error||"EXPORT_LOG_FAILED");
    const packageData={format:"SUPRA_M2_LAB_DIAGNOSTIC_V1",generated_at:new Date().toISOString(),
      lab_only:true,cloudflare_billing_real:false,
      browser:{role_at_export:uid(),mode:el("mode").value,location_origin:location.origin},
      client_events:clientTrace.slice(),
      backend:{...server}};
    const blob=new Blob([JSON.stringify(packageData,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;
    const stamp=requestedAt.replace(/[-:]/g,"").replace("T","_").slice(0,15);
    link.download="D173_M2_LAB_LOG_"+stamp+".json";
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    log("Xuất log JSON: "+link.download+" ("+server.counts.events+" event, "+server.counts.receipts+" receipt trên Core)");
  }catch(e){error("Không thể xuất log: "+String(e?.message||e));}
  finally{button.disabled=false;}
}
el("downloadLog").onclick=downloadLog;
el("actor").onchange=connect;el("mode").onchange=connect;el("resetUi").onclick=connect;el("load").onclick=refresh;
el("report").onclick=()=>perform("REPORT",{sku:el("sku").value});
el("withdraw").onclick=()=>perform("WITHDRAW",{batch_id:Number(el("withdrawId").value)});
el("ack").onclick=()=>perform("ACK",{batch_id:Number(el("ackBatchId").value),event_id:Number(el("ackEventId").value)});
for(const [btn,op,resolution] of [["stock","RESOLVE","HAS_STOCK"],["skip","RESOLVE","SKIP_ALLOWED"],["correct","CORRECT","HAS_STOCK"]]){
  el(btn).onclick=()=>perform(op,{batch_id:Number(el("resolveId").value),expected_version:Number(el("version").value),resolution});
}
el("syncSku").onclick=()=>perform("SKU_SYNC",{sku:el("agentSku").value,name:el("agentName").value,location:el("agentLocation").value});
el("sendChat").onclick=()=>perform("CHAT",{target:el("target").value,message:el("message").value});
el("callCv").onclick=()=>perform("CALL_CV",{target:el("target").value});
togglePanels();connect();
