using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class D167SkuSlotStatus
    {
        internal string Day = "";
        internal string Slot = "";
        internal string State = "";
        internal long ScheduledAtMs;
    internal string CompleteAt = "";
    internal string ReceiptJson = "";
    }

    // D168: SKU bypasses Apps Script entirely. The registered Beta Worker
    // validates an authenticated PRIMARY at reserve; InventoryCore issues
    // an opaque in-memory job grant for the remaining idempotent stages.
    // No WMS token, browser header, cookie or secret ever enters this class.
    internal sealed class D167SkuServiceClient
    {
        private static readonly JavaScriptSerializer Json =
            new JavaScriptSerializer { MaxJsonLength = 2 * 1024 * 1024 };
        private readonly Func<AgentSession> session;
        private readonly Action ensureFreshToken;
        private readonly Func<bool> stillPrimary;
        private readonly Action<string> refreshSkuPrimaryLease;
        internal List<D167SkuSlotStatus> RecentManual { get; private set; } = new List<D167SkuSlotStatus>();

        internal D167SkuServiceClient(Func<AgentSession> currentSession,
            Action refresh, Func<bool> currentPrimary,Action<string> ensureSkuLease)
        {
            session = currentSession;
            ensureFreshToken = refresh;
            stillPrimary = currentPrimary;
            refreshSkuPrimaryLease = ensureSkuLease ?? throw new ArgumentNullException("ensureSkuLease");
        }

        internal List<D167SkuSlotStatus> Schedule(string day)
        {
            var r = Send("schedule", new Dictionary<string, object> {{"day_vn",day}});
            var output = new List<D167SkuSlotStatus>();
            object value;
            if (!r.TryGetValue("slots",out value)) throw new InvalidDataException("D167_SCHEDULE_MISSING");
            var items = value as object[];
            if (items == null || items.Length != 3) throw new InvalidDataException("D167_SCHEDULE_INVALID");
            foreach (var item in items)
            {
                var x = item as Dictionary<string, object>;
                if (x == null) throw new InvalidDataException("D167_SCHEDULE_ITEM_INVALID");
                var slot = Str(x,"slot");
                if (!new[]{"INITIAL_05","DELTA_12","DELTA_19"}.Contains(slot))
                    throw new InvalidDataException("D167_SCHEDULE_SLOT_INVALID");
                output.Add(new D167SkuSlotStatus {
                    Day = Str(x,"day_vn"), Slot = slot, State = Str(x,"state"),
                    ScheduledAtMs = Long(x,"scheduled_at_ms"),
                    CompleteAt = Str(x,"complete_at"), ReceiptJson=Str(x,"receipt_json")
                });
            }
            var manual = new List<D167SkuSlotStatus>();
            if (r.TryGetValue("recent_manual",out value))
            {
                foreach(var item in value as object[] ?? new object[0])
                {
                    var row = item as Dictionary<string,object>;
                    if(row==null) continue;
                    manual.Add(new D167SkuSlotStatus {
                        Day=day, Slot=Str(row,"slot"),State=Str(row,"state"),
                        CompleteAt=Str(row,"complete_at"),ReceiptJson=Str(row,"receipt_json"),
                        ScheduledAtMs=Long(row,"authorized_at_ms")
                    });
                }
            }
            RecentManual=manual;
            return output;
        }

        internal string ManualStart(string day,string instanceId,string generation,
            string runId,string credential)
        {
            if (string.IsNullOrEmpty(credential) || credential.Length>128)
                throw new InvalidOperationException("D167_MANUAL_PROOF_REQUIRED");
            var r=Send("manual-start",new Dictionary<string,object>{
                {"day_vn",day},{"instance_id",instanceId},{"generation",generation},
                {"run_id",runId},{"proof",credential}
            });
            if (Str(r,"status")!="AUTHORIZED") throw new InvalidOperationException("D167_MANUAL_NOT_AUTHORIZED");
            var slot=Str(r,"slot");
            if (slot!="INITIAL_05" && !System.Text.RegularExpressions.Regex.IsMatch(slot,
                @"^MANUAL_DELTA_[a-f0-9]{32}$"))
                throw new InvalidDataException("D167_MANUAL_SLOT_INVALID");
            return slot;
        }

        internal string State(string day,string slot)
        {
            var r = Send("status", new Dictionary<string, object> {
                {"day_vn",day},{"slot",slot}
            });
            return Str(r,"state");
        }

        internal string WorkerRouteStatus()
        {
            // One read-only network classification before a scheduled WMS
            // export. Never send a SKU, WMS header or credential in this probe.
            ensureFreshToken();
            var actor=session();
            if(actor==null || string.IsNullOrWhiteSpace(actor.IdToken))
                throw new InvalidOperationException("D167_AGENT_AUTH_UNAVAILABLE");
            return D168NetworkRoute.ProbeWorker(actor.IdToken);
        }

        internal string Reserve(string day,string slot,string instanceId,string generation)
        {
            var r=Send("reserve",new Dictionary<string,object>{
                {"day_vn",day},{"slot",slot},{"instance_id",instanceId},{"generation",generation}
            });
            if (Str(r,"status")!="RESERVED" || !System.Text.RegularExpressions.Regex.IsMatch(
                Str(r,"job_grant"),"^[a-f0-9]{64}$"))
                throw new InvalidOperationException("D167_RESERVE_NOT_CONFIRMED");
            return Str(r,"job_grant");
        }

        internal void Abort(string day,string slot,string instanceId,string generation,string grant)
        {
            try { Send("abort",new Dictionary<string,object>{
                {"day_vn",day},{"slot",slot},{"instance_id",instanceId},
                {"generation",generation},{"job_grant",grant}
            }); } catch { /* original failure is preserved; expiry also fences the job */ }
        }

        internal bool UploadAndPublish(string day,string slot,string instanceId,
            string generation,string grant,D167SkuWorkbook workbook,Func<string,bool> confirmConflicts)
        {
            if (workbook == null || workbook.Items.Count == 0 || workbook.Items.Count > 5000)
                throw new InvalidDataException("D167_SKU_INVALID_WORKBOOK");
            if (!System.Text.RegularExpressions.Regex.IsMatch(grant ?? "","^[a-f0-9]{64}$"))
                throw new InvalidOperationException("D167_JOB_GRANT_REQUIRED");
            var proof = new Dictionary<string, object> {
                {"day_vn",day},{"slot",slot},{"job_grant",grant},
                {"instance_id",instanceId},{"generation",generation}
            };
            var claim = Copy(proof);
            claim["fingerprint"] = workbook.Fingerprint;
            claim["source_rows"] = workbook.Items.Count;
            var claimed = Send("claim",claim);
            if (Str(claimed,"status") == "DONE")
                return VerifyDone(day,slot,workbook.Fingerprint);
            if (Str(claimed,"status") != "CLAIMED")
                throw new InvalidOperationException("D167_CLAIM_NOT_CONFIRMED");

            const int chunkSize = 500;
            var all = workbook.Items;
            for (int offset=0;offset<all.Count;offset+=chunkSize)
            {
                var body = Copy(proof);
                body["fingerprint"] = workbook.Fingerprint;
                body["expected_count"] = all.Count;
                body["items"] = all.Skip(offset).Take(chunkSize).Select(x =>
                    (object)new Dictionary<string, object> {
                        {"sku",x.Sku},{"product_name",x.ProductName},{"area",x.Area},
                        {"area_verified",x.AreaVerified},{"area_reason",x.AreaReason}
                    }).ToArray();
                var staged = Send("stage",body);
                var count = Long(staged,"staged");
                if (count < offset + Math.Min(chunkSize, all.Count-offset))
                    throw new InvalidOperationException("D167_SKU_STAGING_SHORT");
            }
            var preview = Send("preview",proof);
            if (Str(preview,"status") != "PREVIEW")
                throw new InvalidOperationException("D167_SKU_PREVIEW_MISSING");
            var conflicts = 0;
            object raw;
            if (preview.TryGetValue("conflicts",out raw))
                conflicts = (raw as object[] ?? new object[0]).Length;
            var abnormalFull = preview.ContainsKey("requires_large_hide_approval") && Convert.ToBoolean(preview["requires_large_hide_approval"]);
            var approved = false;
            if (conflicts > 0 || abnormalFull)
            {
                var approvalLines = new List<string>();
                if (abnormalFull)
                    approvalLines.Add("Bất thường: FULL sẽ ẩn " + Long(preview,"hidden") +
                        "/" + Long(preview,"previous_active") +
                        " SKU đang hoạt động. Xác minh file WMS xuất đầy đủ trước khi đồng ý.");
                if (conflicts > 0)
                {
                    approvalLines.Add("Xung đột với chỉnh sửa Web: " + conflicts + " SKU.");
                    var sample = (preview["conflicts"] as object[] ?? new object[0]).Take(5);
                    foreach (var item in sample)
                    {
                        var fields = item as Dictionary<string,object>;
                        if (fields == null) continue;
                        Func<string,string> compact = key => {
                            var value = Str(fields,key).Replace("\r"," ").Replace("\n"," ");
                            return value.Substring(0, Math.Min(value.Length, 70));
                        };
                        approvalLines.Add(compact("sku") + " [" + compact("field") + "] " +
                            compact("current") + " → " + compact("incoming"));
                    }
                    if (conflicts > 5) approvalLines.Add("... và các mục khác.");
                }
                approvalLines.Add("Nếu từ chối, trạng thái SKU hiện tại được giữ nguyên.");
                if (confirmConflicts == null || !confirmConflicts(string.Join("\n",approvalLines)))
                    throw new InvalidOperationException("D167_SKU_CONFLICT_AWAITING_APPROVAL");
                approved = true;
            }
            var publish = Copy(proof);
            publish["approve_conflicts"] = approved;
            publish["approve_large_hide"] = abnormalFull && approved;
            var receipt = Send("publish",publish);
            if (Str(receipt,"status") != "DONE")
                throw new InvalidOperationException("D167_SKU_PUBLISH_UNCERTAIN");
            return VerifyDone(day,slot,workbook.Fingerprint);
        }

        private bool VerifyDone(string day,string slot,string hash)
        {
            var result = Send("status", new Dictionary<string, object> {
                {"day_vn",day},{"slot",slot}
            });
            if (Str(result,"state") != "DONE")
                throw new InvalidOperationException("D167_DURABLE_DONE_READBACK_FAILED");
            object value;
            if (!result.TryGetValue("receipt",out value))
                throw new InvalidOperationException("D167_DURABLE_RECEIPT_MISSING");
            var receipt = value as Dictionary<string,object>;
            if (receipt == null || !string.Equals(Str(receipt,"fingerprint"),hash,
                StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("D167_DURABLE_RECEIPT_FINGERPRINT_MISMATCH");
            return true;
        }

        private Dictionary<string, object> Send(string operation,Dictionary<string,object> data)
        {
            var primaryGate=operation=="reserve" || operation=="manual-start";
            if (primaryGate && !stillPrimary())
                throw new InvalidOperationException("D167_NOT_PRIMARY");
            ensureFreshToken();
            if (primaryGate)
            {
                object proofGeneration;
                if (!data.TryGetValue("generation",out proofGeneration))
                    throw new InvalidOperationException("D167_SKU_PRIMARY_PROOF_REQUIRED");
                refreshSkuPrimaryLease(Convert.ToString(proofGeneration));
            }
            var auth=session();
            if (auth==null || string.IsNullOrWhiteSpace(auth.IdToken))
                throw new InvalidOperationException("D167_AGENT_AUTH_UNAVAILABLE");
            var isGet=operation=="schedule" || operation=="status";
            var root=AgentConfig.ApiBaseUrl.TrimEnd('/');
            Uri allowed;
            if (!Uri.TryCreate(root,UriKind.Absolute,out allowed) ||
                allowed.Scheme!=Uri.UriSchemeHttps ||
                !string.Equals(allowed.Host,"inventory.supra.cc.cd",StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("D167_WORKER_TARGET_NOT_ALLOWED");
            var path=root+"/api/agent/d167/skus/"+operation;
            if(isGet)
            {
                path+="?day_vn="+Uri.EscapeDataString(Str(data,"day_vn"));
                if(operation=="status") path+="&slot="+Uri.EscapeDataString(Str(data,"slot"));
            }
            var request=(HttpWebRequest)WebRequest.Create(path);
            request.Method=isGet ? "GET" : "POST";
            request.ContentType="application/json; charset=utf-8";
            request.Accept="application/json";
            request.UserAgent="Agent-Auto-Confirm-Pick-Pack/D168";
            request.Timeout=30000;
            request.ReadWriteTimeout=30000;
            request.AllowAutoRedirect=false;
            request.Headers[HttpRequestHeader.Authorization]="Bearer "+auth.IdToken;
            if(!isGet)
            {
                var bytes=Encoding.UTF8.GetBytes(Json.Serialize(data));
                if(bytes.Length>500000) throw new InvalidDataException("D167_SKU_CHUNK_OVERSIZE");
                request.ContentLength=bytes.Length;
                using(var stream=request.GetRequestStream()) stream.Write(bytes,0,bytes.Length);
            }
            try
            {
                using(var response=(HttpWebResponse)request.GetResponse())
                using(var stream=new StreamReader(response.GetResponseStream()))
                {
                    var raw=stream.ReadToEnd();
                    if(raw.Length>2*1024*1024)throw new InvalidDataException("D167_REPLY_OVERSIZE");
                    var value=Json.DeserializeObject(raw) as Dictionary<string,object>;
                    if(value==null)throw new InvalidDataException("D167_BAD_WORKER_RESPONSE");
                    var err=Str(value,"error");
                    if(!string.IsNullOrEmpty(err))
                        throw new InvalidOperationException("D167_WORKER_REJECTED");
                    return value;
                }
            }
            catch(WebException e)
            {
                var response=e.Response as HttpWebResponse;
                var http=response==null ? 0 : (int)response.StatusCode;
                throw new IOException(http>0
                    ? "D167_WORKER_HTTP_"+http.ToString(System.Globalization.CultureInfo.InvariantCulture)
                    : "D167_WORKER_"+e.Status.ToString().ToUpperInvariant());
            }
        }

        private static Dictionary<string,object> Copy(Dictionary<string,object> source)
        {
            return new Dictionary<string,object>(source);
        }
        private static string Str(Dictionary<string,object> value,string key)
        {
            object x;
            return value!=null && value.TryGetValue(key,out x)&&x!=null
                ? Convert.ToString(x) : "";
        }
        private static long Long(Dictionary<string,object> value,string key)
        {
            long number;
            return long.TryParse(Str(value,key),out number) ? number : 0;
        }
    }
}
