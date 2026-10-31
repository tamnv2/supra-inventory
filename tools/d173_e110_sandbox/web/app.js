const el=id=>document.getElementById(id),uid=()=>el("actor").value;
let socket=null,pending=new Map(),snapshot=null,seq=0;
const now=()=>new Date().toLocaleTimeString("vi-VN");
const log=(msg)=>{const line=document.createElement("div");line.textContent=now()+"  "+msg;el("feed").prepend(line);while(el("feed").children.length>70)el("feed").lastChild.remove();};
const error=msg=>{el("errors").textContent=msg;log("LỖI "+msg);};
const id=()=>crypto.randomUUID();
function endpoint(path){return path+"?uid="+encodeURIComponent(uid())+"&gen=1";}
function togglePanels(){const x=uid();el("pickerPanel").classList.toggle("hidden",!x.startsWith("p"));el("reporterPanel").classList.toggle("hidden",x!=="r1");el("agentPanel").classList.toggle("hidden",x!=="agent1");}
async function http(frame){const r=await fetch(endpoint("/command"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(frame)});if(!r.ok)throw Error("HTTP "+r.status);return r.json();}
function connect(){
  if(socket){try{socket.close();}catch{}socket=null;}
  for(const fail of pending.values())fail.reject(Error("SOCKET_RESTARTED"));pending.clear();
  togglePanels();
  if(el("mode").value!=="WS"){el("connection").textContent="HTTP đối chứng";el("lamp").style.background="#f59e0b";refresh();return;}
  const protocol=location.protocol==="https:"?"wss:":"ws:";
  const w=new WebSocket(protocol+"//"+location.host+endpoint("/socket"));socket=w;
  el("connection").textContent="Đang kết nối";
  w.onopen=()=>{el("connection").textContent="M2 WebSocket đã kết nối";el("lamp").style.background="#22c55e";};
  w.onmessage=e=>{
    const data=JSON.parse(e.data);
    if(data.type==="RESULT"){const task=pending.get(data.request_id);if(task){clearTimeout(task.timer);pending.delete(data.request_id);task.resolve(data);}return;}
    if(data.type==="EVENT"){seq=Math.max(seq,Number(data.seq)||0);log("WS event #"+data.seq+" "+data.kind+" "+JSON.stringify(data.payload));refresh();return;}
    if(data.type==="CONNECTED"){log("Kết nối realtime cho "+uid());refresh();}
  };
  w.onerror=()=>log("Socket lỗi — kiểm tra local Worker");
  w.onclose=()=>{if(socket!==w)return;el("lamp").style.background="#ef4444";el("connection").textContent="Ngắt kết nối";};
}
async function cmd(operation,args={},requestId=id()){
  const frame={request_id:requestId,operation,args};
  if(el("mode").value!=="WS"||socket?.readyState!==WebSocket.OPEN)
    return http(frame);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(async()=>{pending.delete(requestId);log("WS không ACK; thử HTTP với CÙNG request ID");try{resolve(await http(frame));}catch(e){reject(e);}},4500);
    pending.set(requestId,{resolve,reject,timer});
    try{socket.send(JSON.stringify(frame));}catch(e){clearTimeout(timer);pending.delete(requestId);reject(e);}
  });
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
