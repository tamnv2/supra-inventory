using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    // D169: One VPS account and one administrator-consent record in the existing
    // Firestore coordination collection. Rules, not client labels, authorize writes.
    internal sealed class VpsReclaimRecord
    {
        internal string RequestId = "";
        internal string Status = "";
        internal string PrimaryAgentId = "";
        internal string VpsAgentId = "";
        internal string Generation = "";
        internal long CreatedAtMs;
        internal long ExpiresAtMs;
        internal long ApprovedAtMs;
        internal string ApprovedByUserId = "";
        internal string UpdateTime = "";
        internal bool Exists;
    }

    internal sealed class VpsReadyRecord
    {
        internal string AgentInstanceId = "";
        internal long ReadyAtMs;
        internal long AgentBuild;
        internal bool WmsReady;
        internal bool Fresh
        {
            get
            {
                var age = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - ReadyAtMs;
                return WmsReady && AgentBuild >= 138 && age >= -5000 && age <= 30000 &&
                    !string.IsNullOrWhiteSpace(AgentInstanceId);
            }
        }
    }

    internal sealed class FirestoreVpsReclaim
    {
        internal const long RequestCadenceMs = 15L * 60L * 1000L;
        internal const long RequestTtlMs = 120000L;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Action<string> _log;
        private const string ReadyDocument = AgentConfig.FirestoreCoordinationBaseUrl + "/vps_ready";
        private const string RequestDocument = AgentConfig.FirestoreCoordinationBaseUrl + "/vps_reclaim";

        internal FirestoreVpsReclaim(Action<string> log) { _log = log ?? delegate { }; }

        internal static bool IsVps(AgentSession session)
        {
            return session != null &&
                string.Equals((session.LoginName ?? "").Trim(), "vps", StringComparison.OrdinalIgnoreCase) &&
                IsRealAgentRole(session);
        }

        internal static bool IsOwner(AgentSession session)
        {
            var login = session == null ? "" : (session.LoginName ?? "").Trim();
            return IsRealAgentRole(session) &&
                (string.Equals(login, "admin", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(login, "tamnv2", StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsRealAgentRole(AgentSession session)
        {
            return session != null &&
                ((session.Role == "ADMIN" && session.BaseRole == "ADMIN") ||
                 (session.Role == "PICKPACK_ADMIN" && session.BaseRole == "PICKPACK_ADMIN"));
        }

        internal void PublishReady(AgentSession session, string instanceId, bool ready)
        {
            if (!IsVps(session) || string.IsNullOrWhiteSpace(instanceId)) return;
            var now = NowMs();
            var fields = new Dictionary<string, object>
            {
                { "agent_instance_id", Str(instanceId) },
                { "agent_user_id", Str(session.AppUserId ?? "") },
                { "firebase_uid", Str(session.UserId ?? "") },
                { "ready_at_ms", Num(now) },
                { "wms_ready", Bool(ready) },
                { "agent_build", Num(AgentConfig.AgentBuild) }
            };
            Write("PATCH", ReadyDocument, session, fields, Mask(fields.Keys), "D169_VPS_READY");
        }

        internal VpsReadyRecord GetReady(AgentSession session)
        {
            var read = Read(ReadyDocument, session, "D169_VPS_READY_READ");
            if (read == null) return new VpsReadyRecord();
            var f = Fields(read);
            return new VpsReadyRecord
            {
                AgentInstanceId = GetString(f, "agent_instance_id"),
                ReadyAtMs = GetLong(f, "ready_at_ms"),
                AgentBuild = GetLong(f, "agent_build"),
                WmsReady = GetBool(f, "wms_ready")
            };
        }

        internal VpsReclaimRecord GetRequest(AgentSession session)
        {
            var read = Read(RequestDocument, session, "D169_VPS_RECLAIM_READ");
            if (read == null) return new VpsReclaimRecord();
            var fields = Fields(read);
            return new VpsReclaimRecord
            {
                Exists = true,
                RequestId = GetString(fields, "request_id"),
                Status = GetString(fields, "status"),
                PrimaryAgentId = GetString(fields, "primary_agent_instance_id"),
                VpsAgentId = GetString(fields, "vps_agent_instance_id"),
                Generation = GetString(fields, "generation"),
                CreatedAtMs = GetLong(fields, "created_at_ms"),
                ExpiresAtMs = GetLong(fields, "expires_at_ms"),
                ApprovedAtMs = GetLong(fields, "approved_at_ms"),
                ApprovedByUserId = GetString(fields, "approved_by_user_id"),
                UpdateTime = GetRawString(read, "updateTime")
            };
        }

        internal bool TryRequest(AgentSession session, string vpsInstanceId,
            string primaryId, string generation)
        {
            if (!IsVps(session) || string.IsNullOrWhiteSpace(vpsInstanceId) ||
                string.IsNullOrWhiteSpace(primaryId) || string.IsNullOrWhiteSpace(generation))
                return false;
            var last = GetRequest(session);
            var now = NowMs();
            if (last.Exists && last.CreatedAtMs > 0 &&
                now - last.CreatedAtMs < RequestCadenceMs) return false;
            var fields = new Dictionary<string, object>
            {
                { "request_id", Str(Guid.NewGuid().ToString("N")) },
                { "status", Str("PENDING") },
                { "vps_agent_instance_id", Str(vpsInstanceId) },
                { "primary_agent_instance_id", Str(primaryId) },
                { "generation", Str(generation) },
                { "created_at_ms", Num(now) },
                { "expires_at_ms", Num(now + RequestTtlMs) },
                { "approved_by_user_id", Str("") },
                { "approved_at_ms", Num(0) }
            };
            var cas = last.Exists && !string.IsNullOrWhiteSpace(last.UpdateTime)
                ? "&currentDocument.updateTime=" + Uri.EscapeDataString(last.UpdateTime)
                : "&currentDocument.exists=false";
            try
            {
                Write("PATCH", RequestDocument, session, fields, Mask(fields.Keys) + cas, "D169_VPS_RECLAIM_REQUEST");
                _log("D169 VPS reclaim request=ISSUED expiry_s=120 cadence_m=15");
                return true;
            }
            catch (WebException ex)
            {
                if (IsConflict(ex)) return false;
                throw;
            }
        }

        internal bool Approve(AgentSession session, string requestId)
        {
            if (!IsOwner(session) || string.IsNullOrWhiteSpace(requestId)) return false;
            var last = GetRequest(session);
            var now = NowMs();
            if (!last.Exists || last.Status != "PENDING" || last.RequestId != requestId ||
                last.ExpiresAtMs <= now || last.CreatedAtMs > now + 5000 ||
                string.IsNullOrWhiteSpace(last.UpdateTime)) return false;
            var fields = new Dictionary<string, object>
            {
                { "status", Str("APPROVED") },
                { "approved_by_user_id", Str(session.AppUserId ?? "") },
                { "approved_at_ms", Num(now) }
            };
            try
            {
                Write("PATCH", RequestDocument, session, fields,
                    Mask(fields.Keys) + "&currentDocument.updateTime=" +
                    Uri.EscapeDataString(last.UpdateTime), "D169_VPS_RECLAIM_APPROVE");
                _log("D169 VPS reclaim=APPROVED by_verified_owner=true");
                return true;
            }
            catch (WebException ex)
            {
                if (IsConflict(ex)) return false;
                throw;
            }
        }

        private Dictionary<string, object> Read(string url, AgentSession session, string component)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken)) return null;
            try
            {
                var raw = FirestoreHttpTransport.SendJson(
                    "GET", url, session.IdToken, null,
                    "Agent-Auto-Confirm-Pick-Pack/D169", 5000, true, _log, component);
                return _json.DeserializeObject(raw) as Dictionary<string, object>;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && response.StatusCode == HttpStatusCode.NotFound)
                {
                    try { response.Dispose(); } catch { }
                    return null;
                }
                throw;
            }
        }

        private void Write(string method, string url, AgentSession session,
            Dictionary<string, object> fields, string suffix, string component)
        {
            FirestoreHttpTransport.SendJson(method, url + suffix, session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                "Agent-Auto-Confirm-Pick-Pack/D169", 7000, false, _log, component);
        }

        private static bool IsConflict(WebException ex)
        {
            var response = ex.Response as HttpWebResponse;
            if (response == null) return false;
            var code = (int)response.StatusCode;
            try { response.Dispose(); } catch { }
            return code == 409 || code == 412;
        }

        private static Dictionary<string, object> Fields(Dictionary<string, object> doc)
        {
            object value;
            return doc != null && doc.TryGetValue("fields", out value)
                ? value as Dictionary<string, object> : null;
        }

        private static string GetRawString(Dictionary<string, object> doc, string key)
        {
            object value;
            return doc != null && doc.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static string GetString(Dictionary<string, object> fields, string key)
        {
            var value = Field(fields, key);
            object s;
            return value != null && value.TryGetValue("stringValue", out s) ? Convert.ToString(s) ?? "" : "";
        }

        private static long GetLong(Dictionary<string, object> fields, string key)
        {
            var value = Field(fields, key);
            object s;
            long result;
            return value != null && value.TryGetValue("integerValue", out s) &&
                long.TryParse(Convert.ToString(s), NumberStyles.Integer,
                    CultureInfo.InvariantCulture, out result) ? result : 0L;
        }

        private static bool GetBool(Dictionary<string, object> fields, string key)
        {
            var value = Field(fields, key);
            object s;
            return value != null && value.TryGetValue("booleanValue", out s) &&
                string.Equals(Convert.ToString(s), "true", StringComparison.OrdinalIgnoreCase);
        }

        private static Dictionary<string, object> Field(Dictionary<string, object> f, string key)
        {
            object value;
            return f != null && f.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
        }

        private static string Mask(IEnumerable<string> fields)
        {
            var result = "?";
            foreach (var field in fields)
                result += "updateMask.fieldPaths=" + Uri.EscapeDataString(field) + "&";
            return result.TrimEnd('&');
        }

        private static Dictionary<string, object> Str(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> Num(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString(CultureInfo.InvariantCulture) } };
        }

        private static Dictionary<string, object> Bool(bool value)
        {
            return new Dictionary<string, object> { { "booleanValue", value } };
        }

        private static long NowMs() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
    }
}
