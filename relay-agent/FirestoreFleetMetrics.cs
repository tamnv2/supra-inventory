using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class FleetMetricSnapshot
    {
        internal string DayKey = "";
        internal long AcceptedTotal;
        internal long ProcessedTotal;
        internal long LocalRequests;
        internal long LocalResponses;
        internal string OwnerAgentId = "";
        internal string UpdateTime = "";
        internal readonly HashSet<string> AcceptedIds = new HashSet<string>(StringComparer.Ordinal);
        internal readonly HashSet<string> ProcessedIds = new HashSet<string>(StringComparer.Ordinal);
    }

    internal sealed class FirestoreFleetMetricsClient
    {
        private const int MaxDailyIds = 2500;
        private const int QueryLimit = 2000;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer
        {
            MaxJsonLength = 16 * 1024 * 1024,
            RecursionLimit = 256
        };
        private readonly Action<string> _log;

        internal FirestoreFleetMetricsClient(Action<string> log)
        {
            _log = log ?? delegate { };
        }

        internal FleetMetricSnapshot Load(AgentSession session)
        {
            EnsureSession(session);
            var dayKey = VietnamDayKey(DateTime.UtcNow);
            try
            {
                var raw = FirestoreHttpTransport.SendJson(
                    "GET", AgentConfig.FirestoreFleetMetricsUrl, session.IdToken, null,
                    UserAgent(), 10000, true, _log, "fleet-metrics-read");
                var parsed = ParseSnapshot(_json.DeserializeObject(raw), dayKey);
                if (!string.Equals(parsed.DayKey, dayKey, StringComparison.Ordinal))
                {
                    var reset = NewSnapshot(dayKey);
                    reset.UpdateTime = parsed.UpdateTime;
                    return reset;
                }
                return parsed;
            }
            catch (WebException ex)
            {
                if (Status(ex) == 404) return NewSnapshot(dayKey);
                throw;
            }
        }

        internal FleetMetricSnapshot RefreshPrimary(
            AgentSession session,
            string agentInstanceId,
            long localRequests,
            long localResponses)
        {
            EnsureSession(session);
            for (var attempt = 1; attempt <= 2; attempt++)
            {
                var snapshot = Load(session);
                MergeTail(session, snapshot, ScanStartUtc(snapshot));
                snapshot.LocalRequests = Math.Max(0L, localRequests);
                snapshot.LocalResponses = Math.Max(0L, localResponses);
                snapshot.OwnerAgentId = agentInstanceId ?? "";

                try
                {
                    WriteSnapshot(session, snapshot);
                    _log("FLEET_METRICS checkpoint=PASS day=" + snapshot.DayKey +
                         " accepted=" + snapshot.AcceptedTotal +
                         " processed=" + snapshot.ProcessedTotal +
                         " attempt=" + attempt);
                    return snapshot;
                }
                catch (WebException ex)
                {
                    var status = Status(ex);
                    if ((status == 409 || status == 412) && attempt < 2) continue;
                    throw;
                }
            }
            throw new InvalidOperationException("Không ghi được checkpoint fleet metrics.");
        }

        private void MergeTail(AgentSession session, FleetMetricSnapshot snapshot, DateTime startUtc)
        {
            var query = new Dictionary<string, object>
            {
                {
                    "structuredQuery", new Dictionary<string, object>
                    {
                        { "from", new object[] { new Dictionary<string, object> { { "collectionId", "relay_poc_jobs" } } } },
                        {
                            "where", new Dictionary<string, object>
                            {
                                {
                                    "fieldFilter", new Dictionary<string, object>
                                    {
                                        { "field", new Dictionary<string, object> { { "fieldPath", "created_at" } } },
                                        { "op", "GREATER_THAN_OR_EQUAL" },
                                        { "value", new Dictionary<string, object> { { "timestampValue", startUtc.ToString("o", CultureInfo.InvariantCulture) } } }
                                    }
                                }
                            }
                        },
                        {
                            "orderBy", new object[]
                            {
                                new Dictionary<string, object>
                                {
                                    { "field", new Dictionary<string, object> { { "fieldPath", "created_at" } } },
                                    { "direction", "ASCENDING" }
                                }
                            }
                        },
                        { "limit", QueryLimit }
                    }
                }
            };

            var raw = FirestoreHttpTransport.SendJson(
                "POST",
                AgentConfig.FirestoreDocumentsBaseUrl + ":runQuery",
                session.IdToken,
                _json.Serialize(query),
                UserAgent(),
                12000,
                true,
                _log,
                "fleet-metrics-tail");

            var rows = _json.DeserializeObject(raw) as IEnumerable;
            if (rows == null) return;
            var seen = 0;
            foreach (var rowObj in rows)
            {
                var row = rowObj as Dictionary<string, object>;
                var doc = row == null ? null : GetMap(row, "document");
                if (doc == null) continue;
                var fields = GetMap(doc, "fields");
                if (fields == null) continue;
                if (!string.Equals(FieldString(fields, "source"), "ANDROID_CONFIRM_V1", StringComparison.Ordinal)) continue;
                var requestId = FieldString(fields, "request_id");
                if (string.IsNullOrWhiteSpace(requestId)) continue;
                seen++;
                if (snapshot.AcceptedIds.Add(requestId)) snapshot.AcceptedTotal++;
                if (string.Equals(FieldString(fields, "status"), "ACK", StringComparison.Ordinal) &&
                    snapshot.ProcessedIds.Add(requestId))
                    snapshot.ProcessedTotal++;
            }
            if (seen >= QueryLimit)
                throw new InvalidOperationException("Fleet metrics tail vượt giới hạn an toàn; từ chối checkpoint một phần.");
        }

        private void WriteSnapshot(AgentSession session, FleetMetricSnapshot snapshot)
        {
            EnforceLimit(snapshot.AcceptedIds);
            EnforceLimit(snapshot.ProcessedIds);
            var fields = new Dictionary<string, object>
            {
                { "schema_version", IntField(1) },
                { "day_key", StringField(snapshot.DayKey) },
                { "accepted_total", IntField(snapshot.AcceptedTotal) },
                { "processed_total", IntField(snapshot.ProcessedTotal) },
                { "accepted_ids", StringArrayField(snapshot.AcceptedIds) },
                { "processed_ids", StringArrayField(snapshot.ProcessedIds) },
                { "owner_agent_id", StringField(snapshot.OwnerAgentId) },
                { "local_requests", IntField(snapshot.LocalRequests) },
                { "local_responses", IntField(snapshot.LocalResponses) }
            };

            var url = AgentConfig.FirestoreFleetMetricsUrl;
            if (string.IsNullOrWhiteSpace(snapshot.UpdateTime))
                url += "?currentDocument.exists=false";
            else
                url += BuildMask(fields.Keys) + "&currentDocument.updateTime=" + Uri.EscapeDataString(snapshot.UpdateTime);

            var raw = FirestoreHttpTransport.SendJson(
                "PATCH",
                url,
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                UserAgent(),
                12000,
                false,
                _log,
                "fleet-metrics-write");

            var written = ParseSnapshot(_json.DeserializeObject(raw), snapshot.DayKey);
            snapshot.UpdateTime = written.UpdateTime;
        }

        private FleetMetricSnapshot ParseSnapshot(object raw, string dayKey)
        {
            var doc = raw as Dictionary<string, object>;
            if (doc == null) return NewSnapshot(dayKey);
            var fields = GetMap(doc, "fields");
            var snapshot = NewSnapshot(dayKey);
            snapshot.DayKey = FieldString(fields, "day_key");
            if (string.IsNullOrWhiteSpace(snapshot.DayKey)) snapshot.DayKey = dayKey;
            snapshot.AcceptedTotal = Math.Max(0L, FieldLong(fields, "accepted_total"));
            snapshot.ProcessedTotal = Math.Max(0L, FieldLong(fields, "processed_total"));
            snapshot.LocalRequests = Math.Max(0L, FieldLong(fields, "local_requests"));
            snapshot.LocalResponses = Math.Max(0L, FieldLong(fields, "local_responses"));
            snapshot.OwnerAgentId = FieldString(fields, "owner_agent_id");
            snapshot.UpdateTime = Get(doc, "updateTime");
            foreach (var id in FieldStringArray(fields, "accepted_ids")) snapshot.AcceptedIds.Add(id);
            foreach (var id in FieldStringArray(fields, "processed_ids")) snapshot.ProcessedIds.Add(id);
            if (snapshot.AcceptedTotal < snapshot.AcceptedIds.Count) snapshot.AcceptedTotal = snapshot.AcceptedIds.Count;
            if (snapshot.ProcessedTotal < snapshot.ProcessedIds.Count) snapshot.ProcessedTotal = snapshot.ProcessedIds.Count;
            return snapshot;
        }

        private static FleetMetricSnapshot NewSnapshot(string dayKey)
        {
            return new FleetMetricSnapshot { DayKey = dayKey ?? "" };
        }

        private static DateTime ScanStartUtc(FleetMetricSnapshot snapshot)
        {
            DateTime serverUpdate;
            if (!string.IsNullOrWhiteSpace(snapshot.UpdateTime) &&
                snapshot.AcceptedIds.Count > 0 &&
                DateTime.TryParse(
                    snapshot.UpdateTime,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                    out serverUpdate))
                return serverUpdate.ToUniversalTime().AddMinutes(-1);

            var nowVn = DateTime.UtcNow.AddHours(7);
            return new DateTime(nowVn.Year, nowVn.Month, nowVn.Day, 0, 0, 0, DateTimeKind.Utc).AddHours(-7);
        }

        private static string VietnamDayKey(DateTime utc)
        {
            return utc.AddHours(7).ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        }

        private static void EnforceLimit(HashSet<string> ids)
        {
            if (ids.Count > MaxDailyIds)
                throw new InvalidOperationException("Fleet metrics vượt giới hạn " + MaxDailyIds + " request/ngày.");
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", Math.Max(0L, value).ToString(CultureInfo.InvariantCulture) } };
        }

        private static Dictionary<string, object> StringArrayField(IEnumerable<string> values)
        {
            var rows = new List<object>();
            foreach (var value in values)
            {
                if (string.IsNullOrWhiteSpace(value)) continue;
                rows.Add(StringField(value));
            }
            return new Dictionary<string, object>
            {
                { "arrayValue", new Dictionary<string, object> { { "values", rows } } }
            };
        }

        private static List<string> FieldStringArray(Dictionary<string, object> fields, string key)
        {
            var result = new List<string>();
            var field = GetMap(fields, key);
            var array = GetMap(field, "arrayValue");
            object valuesRaw;
            var values = array != null && array.TryGetValue("values", out valuesRaw)
                ? valuesRaw as IEnumerable
                : null;
            if (values == null) return result;
            foreach (var item in values)
            {
                var map = item as Dictionary<string, object>;
                object value;
                if (map != null && map.TryGetValue("stringValue", out value))
                {
                    var text = Convert.ToString(value) ?? "";
                    if (!string.IsNullOrWhiteSpace(text)) result.Add(text);
                }
            }
            return result;
        }

        private static Dictionary<string, object> GetMap(Dictionary<string, object> map, string key)
        {
            if (map == null) return null;
            object value;
            return map.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
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
                   long.TryParse(Convert.ToString(value), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed)
                ? parsed
                : 0L;
        }

        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value)
                ? Convert.ToString(value) ?? ""
                : "";
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

        private static void EnsureSession(AgentSession session)
        {
            var realAdmin = session != null &&
                string.Equals(session.Role, "ADMIN", StringComparison.Ordinal) &&
                string.Equals(session.BaseRole, "ADMIN", StringComparison.Ordinal);
            var realPickPackAdmin = session != null &&
                string.Equals(session.Role, "PICKPACK_ADMIN", StringComparison.Ordinal) &&
                string.Equals(session.BaseRole, "PICKPACK_ADMIN", StringComparison.Ordinal);
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken) || (!realAdmin && !realPickPackAdmin))
                throw new InvalidOperationException("Thiếu phiên Agent hợp lệ cho fleet metrics.");
        }

        private static string UserAgent()
        {
            return "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild;
        }
    }
}
