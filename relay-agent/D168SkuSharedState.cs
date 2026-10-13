using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly JavaScriptSerializer _d168SkuJson = new JavaScriptSerializer();
        private int _d168SkuPublishRunning;
        private string _d168SkuLastPublished = "";

        // The Worker/Core has already verified DONE. Only terminal receipts are
        // sent over the existing Agent sync carrier, not stage progress/chunks.
        private void PublishD168TerminalSkuStatus(List<D167SkuSlotStatus> slots)
        {
            if(slots==null || _agentSyncClient==null || !HasAgentSession())return;
            var day=D167SkuSchedule.VNNow().ToString("yyyy-MM-dd");
            var complete=slots.Where(x=>x!=null && x.Day==day &&
                x.State=="DONE" &&
                (x.Slot=="INITIAL_05" || x.Slot=="DELTA_12" || x.Slot=="DELTA_19"))
                .OrderBy(x=>x.Slot,StringComparer.Ordinal).ToList();
            if(complete.Count==0)return;

            // Existing Worker receipts only; no extra Worker GET or provider poll.
            var records=complete.Select(x=>(object)new Dictionary<string,object> {
                {"slot",x.Slot},{"state","DONE"},
                {"scheduled_at_ms",x.ScheduledAtMs},
                {"complete_at",(x.CompleteAt ?? "").Substring(0,Math.Min((x.CompleteAt ?? "").Length,64))},
                {"receipt_json",(x.ReceiptJson ?? "").Substring(0,Math.Min((x.ReceiptJson ?? "").Length,750))}
            }).ToArray();
            var body=_d168SkuJson.Serialize(new Dictionary<string,object> {
                {"day_vn",day},{"slots",records}
            });
            if(body.Length>3500 || string.Equals(_d168SkuLastPublished,body,StringComparison.Ordinal))return;
            if(Interlocked.CompareExchange(ref _d168SkuPublishRunning,1,0)!=0)return;
            Task.Run(()=>{
                try
                {
                    EnsureFreshToken();
                    var client=_agentSyncClient;
                    if(client==null || !HasAgentSession())return;
                    var snapshot=client.SetSkuStatus(SnapshotSession(),body);
                    _d168SkuLastPublished=body;
                    Ui(()=>ApplyD134AgentSyncSnapshot(snapshot));
                }
                catch(Exception e) { Log("D168_SKU_SHARED write=DEFER type="+e.GetType().Name); }
                finally { Interlocked.Exchange(ref _d168SkuPublishRunning,0); }
            });
        }

        // Called by the already-present agent_sync listener; Office standby does
        // not have to connect to Worker or start a separate Firestore listener.
        private void ApplyD168SharedSkuStatus(string raw)
        {
            if(string.IsNullOrWhiteSpace(raw) || raw.Length>3500 ||
                _leaderCoordinator!=null && _leaderCoordinator.IsLeader)return;
            try
            {
                var obj=_d168SkuJson.DeserializeObject(raw) as Dictionary<string,object>;
                if(obj==null)return;
                object value;
                if(!obj.TryGetValue("day_vn",out value) ||
                    !string.Equals(Convert.ToString(value),
                        D167SkuSchedule.VNNow().ToString("yyyy-MM-dd"),StringComparison.Ordinal))
                    return;
                if(!obj.TryGetValue("slots",out value))return;
                var arr=value as object[];
                if(arr==null || arr.Length>3)return;
                var today=D167SkuSchedule.VNNow().ToString("yyyy-MM-dd");
                var result=new List<D167SkuSlotStatus>();
                foreach(var source in arr)
                {
                    var row=source as Dictionary<string,object>;
                    if(row==null)continue;
                    object name;
                    if(!row.TryGetValue("slot",out name))continue;
                    var slot=Convert.ToString(name);
                    if(slot!="INITIAL_05" && slot!="DELTA_12" && slot!="DELTA_19")continue;
                    if(row.ContainsKey("state") && Convert.ToString(row["state"])!="DONE")continue;
                    long scheduled=0;
                    if(row.ContainsKey("scheduled_at_ms"))
                        long.TryParse(Convert.ToString(row["scheduled_at_ms"]),out scheduled);
                    var completed=row.ContainsKey("complete_at") ? Convert.ToString(row["complete_at"]) : "";
                    var receipt=row.ContainsKey("receipt_json") ? Convert.ToString(row["receipt_json"]) : "";
                    result.Add(new D167SkuSlotStatus {Day=today,Slot=slot,State="DONE",
                        ScheduledAtMs=scheduled,CompleteAt=completed ?? "",ReceiptJson=receipt ?? ""});
                }
                if(result.Count>0)
                    RenderD167SkuStatus(result,null,null,
                        "Trạng thái hoàn tất đồng bộ từ Agent qua kênh đang sử dụng.");
            }
            catch(Exception e){Log("D168_SKU_SHARED parse=DEFER type="+e.GetType().Name);}
        }
    }
}
