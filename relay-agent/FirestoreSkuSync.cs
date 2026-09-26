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
        internal bool DayLocked;
        internal bool ServiceStarted;
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
                var serviceStarted = FieldBool(fields, "service_started");
                if (string.Equals(status, "DONE", StringComparison.Ordinal))
                {
                    return new SkuSyncLeaseResult
                    {
                        Acquired = false,
                        AlreadyDone = true,
                        DayLocked = true,
                        ServiceStarted = true,
                        DayKey = dayKey,
                        LeaseDocumentId = docId,
                        Detail = "Đã có Agent cập nhật SKU hôm nay."
                    };
                }
                if (serviceStarted)
                {
                    return new SkuSyncLeaseResult
                    {
                        Acquired = false,
                        AlreadyDone = false,
                        DayLocked = true,
                        ServiceStarted = true,
                        DayKey = dayKey,
                        LeaseDocumentId = docId,
                        Detail = "Lượt cập nhật SKU hôm nay đã gửi Service. Không gửi lặp trong ngày để tránh trùng dữ liệu."
                    };
                }
                if (leaseUntil > NowMs())
                {
                    return new SkuSyncLeaseResult
                    {
                        Acquired = false,
                        AlreadyDone = false,
                        DayLocked = false,
                        ServiceStarted = false,
                        DayKey = dayKey,
                        LeaseDocumentId = docId,
                        Detail = "Đang có Agent chuẩn bị cập nhật SKU."
                    };
                }

                var updateTime = Get(existing, "updateTime");
                var fieldsPatch = LeaseFields(session, agentInstanceId, dayKey, docId, "LEASED", NowMs() + 10 * 60 * 1000L, false);
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
                    LeaseFields(session, agentInstanceId, dayKey, docId, "LEASED", NowMs() + 10 * 60 * 1000L, false),
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

        internal void MarkServiceStarted(AgentSession session, string agentInstanceId, SkuSyncLeaseResult lease)
        {
            if (lease == null || !lease.Acquired) throw new InvalidOperationException("Thiếu lease cập nhật SKU.");
            UpdateLease(session, agentInstanceId, lease, "RUNNING", EndOfDayLockMs(), true);
            lease.ServiceStarted = true;
            lease.DayLocked = true;
            _log("SKU_SYNC daily_lock=ACTIVE day=" + lease.DayKey + " reason=service_started");
        }

        internal void MarkLeaseDone(AgentSession session, string agentInstanceId, SkuSyncLeaseResult lease)
        {
            UpdateLease(session, agentInstanceId, lease, "DONE", EndOfDayLockMs(), true);
            if (lease != null)
            {
                lease.ServiceStarted = true;
                lease.DayLocked = true;
            }
        }

        internal void ReleaseLeaseSoon(AgentSession session, string agentInstanceId, SkuSyncLeaseResult lease)
        {
            // Safe only before the first service job is submitted. Once service_started=true,
            // the whole Asia/Ho_Chi_Minh day stays locked to prevent uncertain duplicate sends.
            if (lease == null || lease.ServiceStarted) return;
            try { UpdateLease(session, agentInstanceId, lease, "LEASED", NowMs() + 15 * 1000L, false); }
            catch { }
        }

        internal SkuSyncImportResult SubmitAndWait(
            AgentSession session,
            IList<WmsSkuCatalogItem> items,
            string sourceHash,
            bool confirmNameChanges,
            Action<string> progress = null,
            int timeoutSeconds = 180)
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
            if (progress != null) progress("Đã gửi lô SKU · đang chờ Service nhận...");
            _log("SKU_SYNC import_submit=PASS job=" + Short(jobId) +
                 " rows=" + items.Count +
                 " confirm_names=" + (confirmNameChanges ? "true" : "false"));

            var boundedTimeout = Math.Max(30, Math.Min(300, timeoutSeconds));
            var deadline = DateTime.UtcNow.AddSeconds(boundedTimeout);
            var lastStatus = "PENDING";
            var lastProgressUtc = DateTime.MinValue;
            while (DateTime.UtcNow < deadline)
            {
                Thread.Sleep(1000);
                var doc = Map(_json.DeserializeObject(Get(session, url, "sku-import-wait")));
                var docFields = GetMap(doc, "fields");
                var status = FieldString(docFields, "status");
                if (string.IsNullOrWhiteSpace(status)) status = "PENDING";
                var statusChanged = !string.Equals(status, lastStatus, StringComparison.Ordinal);
                if (statusChanged || DateTime.UtcNow - lastProgressUtc >= TimeSpan.FromSeconds(10))
                {
                    lastStatus = status;
                    lastProgressUtc = DateTime.UtcNow;
                    if (progress != null)
                    {
                        if (string.Equals(status, "RUNNING", StringComparison.Ordinal))
                            progress("Service đã nhận · đang xử lý lô SKU...");
                        else if (string.Equals(status, "PENDING", StringComparison.Ordinal))
                            progress("Đã gửi lô SKU · đang chờ Service nhận...");
                    }
                }
                if (string.Equals(status, "PENDING", StringComparison.Ordinal) ||
                    string.Equals(status, "RUNNING", StringComparison.Ordinal))
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

            throw new TimeoutException(
                string.Equals(lastStatus, "RUNNING", StringComparison.Ordinal)
                    ? "Service đã nhận cập nhật SKU nhưng chưa hoàn tất trong thời gian chờ. Đã giữ khóa hôm nay để không gửi trùng."
                    : "Service chưa xác nhận xử lý cập nhật SKU trong thời gian chờ. Đã giữ khóa hôm nay để không gửi trùng.");
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
            long leaseUntilMs,
            bool serviceStarted)
        {
            if (lease == null || string.IsNullOrWhiteSpace(lease.LeaseDocumentId)) return;
            var fields = LeaseFields(
                session,
                agentInstanceId,
                lease.DayKey,
                lease.LeaseDocumentId,
                status,
                leaseUntilMs,
                serviceStarted);
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
            long leaseUntilMs,
            bool serviceStarted)
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
                { "lease_until_ms", IntField(leaseUntilMs) },
                { "service_started", BoolField(serviceStarted) }
            };
        }

        private SkuSyncLeaseResult Acquired(string dayKey, string docId, string detail)
        {
            _log("SKU_SYNC lease=ACQUIRED day=" + dayKey + " doc=" + Short(docId));
            return new SkuSyncLeaseResult
            {
                Acquired = true,
                DayLocked = false,
                ServiceStarted = false,
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

        private static bool FieldBool(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            object value;
            return field != null &&
                   field.TryGetValue("booleanValue", out value) &&
                   value is bool &&
                   (bool)value;
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

        private static long EndOfDayLockMs()
        {
            // Fixed project timezone is Asia/Ho_Chi_Minh (UTC+07, no DST).
            var localNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
            var nextDay = new DateTimeOffset(
                localNow.Year,
                localNow.Month,
                localNow.Day,
                0, 15, 0,
                TimeSpan.FromHours(7)).AddDays(1);
            return nextDay.ToUnixTimeMilliseconds();
        }

        private static string Short(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            return value.Substring(0, Math.Min(12, value.Length));
        }
    }
}
