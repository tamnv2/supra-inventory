using System;
using System.Collections;
using System.Collections.Generic;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class SkuSyncLeaseResult
    {
        internal bool Acquired;
        internal bool AlreadyDone;
        internal string DayKey;
        internal string LeaseDocumentId;
        internal string Detail;
    }

    internal sealed class SkuSyncImportResult
    {
        internal string Status;
        internal int Received;
        internal int Applied;
        internal int Inserted;
        internal int Updated;
        internal int Unchanged;
        internal int ConflictCount;
        internal string ResultCode;
    }

    internal sealed class FirestoreSkuSyncClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer
        {
            MaxJsonLength = 32 * 1024 * 1024,
            RecursionLimit = 256
        };
        private readonly Action<string> _log;

        internal FirestoreSkuSyncClient(Action<string> log)
        {
            _log = log ?? delegate { };
        }

        internal SkuSyncLeaseResult AcquireDailyLease(AgentSession session, string agentInstanceId)
        {
            EnsureSession(session);
            var dayKey = DateTime.UtcNow.AddHours(7).ToString("yyyyMMdd");
            var docId = "lease-" + dayKey;
            var url = AgentConfig.FirestoreSkuSyncCollectionUrl.TrimEnd('/') + "/" + docId;
            Dictionary<string, object> existing = null;
            try
            {
                existing = Map(_json.DeserializeObject(Get(session, url, "sku-lease-read")));
            }
            catch (WebException ex)
            {
                if (Status(ex) != 404) throw;
            }

            if (existing != null && existing.Count > 0)
            {
                var fields = GetMap(existing, "fields");
                var status = FieldString(fields, "status");
                var leaseUntil = FieldLong(fields, "lease_until_ms");
                var owner = FieldString(fields, "owner_agent_id");
                if (string.Equals(status, "DONE", StringComparison.Ordinal))
                {
                    return new SkuSyncLeaseResult
                    {
                        Acquired = false,
                        AlreadyDone = true,
                        DayKey = dayKey,
                        LeaseDocumentId = docId,
                        Detail = "Đã có Agent cập nhật SKU hôm nay."
                    };
                }
                if (leaseUntil > NowMs() && !string.Equals(owner, agentInstanceId, StringComparison.Ordinal))
                {
                    return new SkuSyncLeaseResult
                    {
                        Acquired = false,
                        AlreadyDone = false,
                        DayKey = dayKey,
                        LeaseDocumentId = docId,
                        Detail = "Agent khác đang cập nhật SKU."
                    };
                }

                var updateTime = Get(existing, "updateTime");
                var fieldsPatch = LeaseFields(session, agentInstanceId, dayKey, docId, "LEASED", NowMs() + 10 * 60 * 1000L);
                var suffix = BuildMask(fieldsPatch.Keys);
                if (!string.IsNullOrWhiteSpace(updateTime))
                    suffix += "&currentDocument.updateTime=" + Uri.EscapeDataString(updateTime);
                try
                {
                    Patch(session, url + suffix, fieldsPatch, "sku-lease-takeover");
                    return Acquired(dayKey, docId, "Đã nhận lease cập nhật SKU.");
                }
                catch (WebException ex)
                {
                    if (Status(ex) == 409 || Status(ex) == 412 || Status(ex) == 403)
                        return new SkuSyncLeaseResult
                        {
                            Acquired = false,
                            DayKey = dayKey,
                            LeaseDocumentId = docId,
                            Detail = "Lease SKU vừa được Agent khác nhận."
                        };
                    throw;
                }
            }

            try
            {
                Patch(
                    session,
                    url + "?currentDocument.exists=false",
                    LeaseFields(session, agentInstanceId, dayKey, docId, "LEASED", NowMs() + 10 * 60 * 1000L),
                    "sku-lease-create");
                return Acquired(dayKey, docId, "Đã tạo lease cập nhật SKU.");
            }
            catch (WebException ex)
            {
                if (Status(ex) == 409 || Status(ex) == 412 || Status(ex) == 403)
                    return new SkuSyncLeaseResult
                    {
                        Acquired = false,
                        DayKey = dayKey,
                        LeaseDocumentId = docId,
                        Detail = "Agent khác đã tạo lease cập nhật SKU."
                    };
                throw;
            }
        }

        internal void MarkLeaseDone(AgentSession session, string agentInstanceId, SkuSyncLeaseResult lease)
        {
            UpdateLease(session, agentInstanceId, lease, "DONE", NowMs() + 10 * 60 * 1000L);
        }

        internal void ReleaseLeaseSoon(AgentSession session, string agentInstanceId, SkuSyncLeaseResult lease)
        {
            try { UpdateLease(session, agentInstanceId, lease, "LEASED", NowMs() + 15 * 1000L); }
            catch { }
        }

        internal SkuSyncImportResult SubmitAndWait(
            AgentSession session,
            IList<WmsSkuCatalogItem> items,
            string sourceHash,
            bool confirmNameChanges,
            int timeoutSeconds = 75)
        {
            EnsureSession(session);
            if (items == null || items.Count == 0 || items.Count > 1000)
                throw new InvalidOperationException("Mỗi lô SKU phải có 1-1000 dòng.");

            var jobId = "sku-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + "-" + Guid.NewGuid().ToString("N");
            var itemValues = new List<object>();
            foreach (var item in items)
            {
                itemValues.Add(new Dictionary<string, object>
                {
                    { "mapValue", new Dictionary<string, object>
                        {
                            { "fields", new Dictionary<string, object>
                                {
                                    { "sku", StringField(item.Sku) },
                                    { "product_name", StringField(item.ProductName) }
                                }
                            }
                        }
                    }
                });
            }

            var fields = new Dictionary<string, object>
            {
                { "kind", StringField("IMPORT") },
                { "source", StringField("AGENT_WMS_BINSTOCK_V1") },
                { "status", StringField("PENDING") },
                { "job_id", StringField(jobId) },
                { "admin_user_id", StringField(session.AppUserId ?? "") },
                { "source_hash", StringField(sourceHash ?? "") },
                { "confirm_name_changes", BoolField(confirmNameChanges) },
                { "items", new Dictionary<string, object>
                    {
                        { "arrayValue", new Dictionary<string, object> { { "values", itemValues } } }
                    }
                }
            };

            var url = AgentConfig.FirestoreSkuSyncCollectionUrl.TrimEnd('/') + "/" + jobId;
            Patch(session, url + "?currentDocument.exists=false", fields, "sku-import-create");
            _log("SKU_SYNC import_submit=PASS job=" + Short(jobId) +
                 " rows=" + items.Count +
                 " confirm_names=" + (confirmNameChanges ? "true" : "false"));

            var deadline = DateTime.UtcNow.AddSeconds(Math.Max(15, Math.Min(180, timeoutSeconds)));
            while (DateTime.UtcNow < deadline)
            {
                Thread.Sleep(1000);
                var doc = Map(_json.DeserializeObject(Get(session, url, "sku-import-wait")));
                var docFields = GetMap(doc, "fields");
                var status = FieldString(docFields, "status");
                if (string.Equals(status, "PENDING", StringComparison.Ordinal) ||
                    string.Equals(status, "RUNNING", StringComparison.Ordinal) ||
                    string.IsNullOrWhiteSpace(status))
                    continue;

                var resultMap = FieldMap(docFields, "result");
                return new SkuSyncImportResult
                {
                    Status = status,
                    ResultCode = FieldString(docFields, "result_code"),
                    Received = FieldInt(resultMap, "received"),
                    Applied = FieldInt(resultMap, "applied"),
                    Inserted = FieldInt(resultMap, "inserted"),
                    Updated = FieldInt(resultMap, "updated"),
                    Unchanged = FieldInt(resultMap, "unchanged"),
                    ConflictCount = FieldInt(resultMap, "conflict_count")
                };
            }

            throw new TimeoutException("Hết thời gian chờ service cập nhật SKU.");
        }

        internal static string ComputeSourceHash(IList<WmsSkuCatalogItem> items)
        {
            var sb = new StringBuilder();
            foreach (var item in items)
                sb.Append(item.Sku ?? "").Append('\t').Append(item.ProductName ?? "").Append('\n');
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
                var hex = new StringBuilder(hash.Length * 2);
                foreach (var b in hash) hex.Append(b.ToString("x2"));
                return hex.ToString();
            }
        }

        private void UpdateLease(
            AgentSession session,
            string agentInstanceId,
            SkuSyncLeaseResult lease,
            string status,
            long leaseUntilMs)
        {
            if (lease == null || string.IsNullOrWhiteSpace(lease.LeaseDocumentId)) return;
            var fields = LeaseFields(
                session,
                agentInstanceId,
                lease.DayKey,
                lease.LeaseDocumentId,
                status,
                leaseUntilMs);
            Patch(
                session,
                AgentConfig.FirestoreSkuSyncCollectionUrl.TrimEnd('/') + "/" + lease.LeaseDocumentId + BuildMask(fields.Keys),
                fields,
                "sku-lease-" + status.ToLowerInvariant());
        }

        private static Dictionary<string, object> LeaseFields(
            AgentSession session,
            string agentInstanceId,
            string dayKey,
            string docId,
            string status,
            long leaseUntilMs)
        {
            return new Dictionary<string, object>
            {
                { "kind", StringField("LEASE") },
                { "source", StringField("AGENT_WMS_BINSTOCK_V1") },
                { "status", StringField(status) },
                { "job_id", StringField(docId) },
                { "admin_user_id", StringField(session.AppUserId ?? "") },
                { "owner_agent_id", StringField(agentInstanceId ?? "") },
                { "day_key", StringField(dayKey ?? "") },
                { "lease_until_ms", IntField(leaseUntilMs) }
            };
        }

        private SkuSyncLeaseResult Acquired(string dayKey, string docId, string detail)
        {
            _log("SKU_SYNC lease=ACQUIRED day=" + dayKey + " doc=" + Short(docId));
            return new SkuSyncLeaseResult
            {
                Acquired = true,
                DayKey = dayKey,
                LeaseDocumentId = docId,
                Detail = detail
            };
        }

        private string Get(AgentSession session, string url, string component)
        {
            return FirestoreHttpTransport.SendJson(
                "GET", url, session.IdToken, null,
                "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild,
                10000, true, _log, component);
        }

        private void Patch(
            AgentSession session,
            string url,
            Dictionary<string, object> fields,
            string component)
        {
            FirestoreHttpTransport.SendJson(
                "PATCH", url, session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild,
                12000, false, _log, component);
        }

        private static void EnsureSession(AgentSession session)
        {
            var realAdmin = session != null &&
                string.Equals(session.Role, "ADMIN", StringComparison.Ordinal) &&
                string.Equals(session.BaseRole, "ADMIN", StringComparison.Ordinal);
            var realPickPackAdmin = session != null &&
                string.Equals(session.Role, "PICKPACK_ADMIN", StringComparison.Ordinal) &&
                string.Equals(session.BaseRole, "PICKPACK_ADMIN", StringComparison.Ordinal);
            if (session == null ||
                string.IsNullOrWhiteSpace(session.IdToken) ||
                string.IsNullOrWhiteSpace(session.AppUserId) ||
                (!realAdmin && !realPickPackAdmin))
                throw new InvalidOperationException("Thiếu phiên quản trị hợp lệ cho đồng bộ SKU.");
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString() } };
        }

        private static Dictionary<string, object> BoolField(bool value)
        {
            return new Dictionary<string, object> { { "booleanValue", value } };
        }

        private static Dictionary<string, object> Map(object value)
        {
            return value as Dictionary<string, object> ?? new Dictionary<string, object>();
        }

        private static Dictionary<string, object> GetMap(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value)
                ? value as Dictionary<string, object>
                : null;
        }

        private static Dictionary<string, object> FieldMap(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            return GetMap(field, "mapValue") == null
                ? new Dictionary<string, object>()
                : GetMap(GetMap(field, "mapValue"), "fields") ?? new Dictionary<string, object>();
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            object value;
            return field != null && field.TryGetValue("stringValue", out value)
                ? Convert.ToString(value) ?? ""
                : "";
        }

        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            object value;
            long parsed;
            return field != null &&
                   field.TryGetValue("integerValue", out value) &&
                   long.TryParse(Convert.ToString(value), out parsed)
                ? parsed
                : 0L;
        }

        private static int FieldInt(Dictionary<string, object> fields, string key)
        {
            var value = FieldLong(fields, key);
            return value > int.MaxValue ? int.MaxValue : (int)Math.Max(0, value);
        }

        private static string BuildMask(IEnumerable<string> fields)
        {
            var sb = new StringBuilder("?");
            var first = true;
            foreach (var field in fields)
            {
                if (!first) sb.Append("&");
                first = false;
                sb.Append("updateMask.fieldPaths=").Append(Uri.EscapeDataString(field));
            }
            return sb.ToString();
        }

        private static int Status(WebException ex)
        {
            var response = ex == null ? null : ex.Response as HttpWebResponse;
            if (response == null) return 0;
            var status = (int)response.StatusCode;
            try { response.Dispose(); } catch { }
            return status;
        }

        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value)
                ? Convert.ToString(value) ?? ""
                : "";
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        private static string Short(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            return value.Substring(0, Math.Min(12, value.Length));
        }
    }
}
