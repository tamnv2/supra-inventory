using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class FleetMetricSnapshot
    {
        internal string DayKey = "";
        internal long ReceivedTotal;
        internal long ConfirmedTotal;
        internal long ErrorTotal;
        internal long LocalRequests;
        internal long LocalResponses;
        internal string OwnerAgentId = "";
        internal string UpdateTime = "";

        // Compatibility projections for the existing compact UI while D131 renders
        // all three durable counters explicitly.
        internal long AcceptedTotal { get { return ReceivedTotal; } }
        internal long ProcessedTotal { get { return ConfirmedTotal + ErrorTotal; } }
    }

    internal sealed class FirestoreFleetMetricsClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Action<string> _log;

        internal FirestoreFleetMetricsClient(Action<string> log)
        {
            _log = log ?? delegate { };
        }

        internal FleetMetricSnapshot Load(AgentSession session)
        {
            EnsureSession(session);
            var dayKey = BusinessDayKey(DateTimeOffset.UtcNow);
            var url = AgentConfig.FirestoreCoordinationBaseUrl + "/daily_" + dayKey;
            try
            {
                var raw = FirestoreHttpTransport.SendJson(
                    "GET", url, session.IdToken, null,
                    UserAgent(), 10000, true, _log, "daily-counter-read");
                return ParseSnapshot(_json.DeserializeObject(raw), dayKey);
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
            var snapshot = Load(session);
            snapshot.LocalRequests = Math.Max(0L, localRequests);
            snapshot.LocalResponses = Math.Max(0L, localResponses);
            snapshot.OwnerAgentId = agentInstanceId ?? snapshot.OwnerAgentId;
            _log("D131 DAILY_COUNTER authority=relay_poc_coordination/daily_" + snapshot.DayKey +
                 " received=" + snapshot.ReceivedTotal +
                 " confirmed=" + snapshot.ConfirmedTotal +
                 " error=" + snapshot.ErrorTotal +
                 " provider_write=false");
            return snapshot;
        }

        private FleetMetricSnapshot ParseSnapshot(object raw, string dayKey)
        {
            var doc = raw as Dictionary<string, object>;
            if (doc == null) return NewSnapshot(dayKey);
            var fields = GetMap(doc, "fields");
            var snapshot = NewSnapshot(dayKey);
            snapshot.DayKey = FieldString(fields, "business_day");
            if (string.IsNullOrWhiteSpace(snapshot.DayKey)) snapshot.DayKey = dayKey;
            snapshot.ReceivedTotal = Math.Max(0L, FieldLong(fields, "received_total"));
            snapshot.ConfirmedTotal = Math.Max(0L, FieldLong(fields, "confirmed_total"));
            snapshot.ErrorTotal = Math.Max(0L, FieldLong(fields, "error_total"));
            snapshot.OwnerAgentId = FieldString(fields, "owner_agent_id");
            snapshot.UpdateTime = Get(doc, "updateTime");
            return snapshot;
        }

        private static FleetMetricSnapshot NewSnapshot(string dayKey)
        {
            return new FleetMetricSnapshot { DayKey = dayKey ?? "" };
        }

        internal static string BusinessDayKey(DateTimeOffset utc)
        {
            return utc.ToOffset(TimeSpan.FromHours(7))
                .AddHours(-5)
                .ToString("yyyyMMdd", CultureInfo.InvariantCulture);
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
                throw new InvalidOperationException("Thiếu phiên Agent hợp lệ cho D131 durable counters.");
        }

        private static string UserAgent()
        {
            return "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild;
        }
    }
}
