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
    }

    // D167 authenticates with the existing Agent Firebase ID token. The
    // registered Google Agent Operations Gateway is a transport ONLY, to
    // reach Inventory Beta Worker when corporate Office blocks Cloudflare.
    // The Worker independently enforces PRIMARY generation and SQL CAS.
    // No WMS token, browser header, cookie or secret ever enters this class.
    internal sealed class D167SkuServiceClient
    {
        private static readonly JavaScriptSerializer Json =
            new JavaScriptSerializer { MaxJsonLength = 2 * 1024 * 1024 };
        private readonly Func<AgentSession> session;
        private readonly Action ensureFreshToken;
        private readonly Func<bool> stillPrimary;

        internal D167SkuServiceClient(Func<AgentSession> currentSession,
            Action refresh, Func<bool> currentPrimary)
        {
            session = currentSession;
            ensureFreshToken = refresh;
            stillPrimary = currentPrimary;
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
                    ScheduledAtMs = Long(x,"scheduled_at_ms")
                });
            }
            return output;
        }

        internal string State(string day,string slot)
        {
            var r = Send("status", new Dictionary<string, object> {
                {"day_vn",day},{"slot",slot}
            });
            return Str(r,"state");
        }

        internal bool UploadAndPublish(string day,string slot,string instanceId,
            string generation,D167SkuWorkbook workbook,Func<string,bool> confirmConflicts)
        {
            if (workbook == null || workbook.Items.Count == 0 || workbook.Items.Count > 5000)
                throw new InvalidDataException("D167_SKU_INVALID_WORKBOOK");
            if (!stillPrimary()) throw new InvalidOperationException("D167_NOT_PRIMARY");
            var proof = new Dictionary<string, object> {
                {"day_vn",day},{"slot",slot},
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
                if (!stillPrimary()) throw new InvalidOperationException("D167_LOST_PRIMARY");
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
                if (confirmConflicts == null || !confirmConflicts(conflicts))
                    throw new InvalidOperationException("D167_SKU_CONFLICT_AWAITING_APPROVAL");
                if (!stillPrimary()) throw new InvalidOperationException("D167_LOST_PRIMARY");
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
            if (!stillPrimary()) throw new InvalidOperationException("D167_NOT_PRIMARY");
            ensureFreshToken();
            var auth = session();
            if (auth == null || string.IsNullOrWhiteSpace(auth.IdToken))
                throw new InvalidOperationException("D167_AGENT_AUTH_UNAVAILABLE");
            var gateway = (AgentConfig.AgentLogGatewayUrl ?? "").Trim();
            Uri target;
            if (gateway.Contains("__") || !Uri.TryCreate(gateway,UriKind.Absolute,out target) ||
                target.Scheme != Uri.UriSchemeHttps ||
                !string.Equals(target.Host,"script.google.com",StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("D167_OFFICE_GATEWAY_NOT_CONFIGURED");
            var body = new Dictionary<string,object> {
                {"action","d167_sku_sync"},{"operation",operation},
                {"id_token",auth.IdToken},{"data",data}
            };
            var bytes=Encoding.UTF8.GetBytes(Json.Serialize(body));
            if (bytes.Length>500000) throw new InvalidDataException("D167_SKU_CHUNK_OVERSIZE");
            var request=(HttpWebRequest)WebRequest.Create(target);
            request.Method="POST";
            request.ContentType="application/json; charset=utf-8";
            request.UserAgent="Agent-Auto-Confirm-Pick-Pack/D167";
            request.Timeout=30000;
            request.ReadWriteTimeout=30000;
            request.AllowAutoRedirect=true;
            request.ContentLength=bytes.Length;
            using(var stream=request.GetRequestStream()) stream.Write(bytes,0,bytes.Length);
            try
            {
                using(var response=(HttpWebResponse)request.GetResponse())
                using(var stream=new StreamReader(response.GetResponseStream()))
                {
                    var raw=stream.ReadToEnd();
                    if (raw.Length>2*1024*1024) throw new InvalidDataException("D167_REPLY_OVERSIZE");
                    var value=Json.DeserializeObject(raw) as Dictionary<string,object>;
                    if (value==null) throw new InvalidDataException("D167_BAD_GATEWAY_RESPONSE");
                    object ok;
                    if (!value.TryGetValue("ok",out ok) || !Convert.ToBoolean(ok))
                    {
                        var err=Str(value,"error");
                        if (err.Length>100) err=err.Substring(0,100);
                        throw new InvalidOperationException("D167_WORKER_" + err);
                    }
                    return value;
                }
            }
            catch(WebException e)
            {
                // Do not copy provider bodies or exception messages into
                // logs; timeout after commit is resolved by exact status read.
                throw new IOException("D167_GATEWAY_"+e.Status.ToString());
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
