using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class AgentSessionClaimResult
    {
        internal bool Claimed;
        internal bool Conflict;
        internal string ExistingAgentInstanceId = "";
    }

    internal sealed class FirestoreAgentSessionGate
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Action<string> _log;

        private sealed class ReadResult
        {
            internal bool Exists;
            internal string UpdateTime = "";
            internal string AgentInstanceId = "";
        }

        internal FirestoreAgentSessionGate(Action<string> log)
        {
            _log = log ?? delegate { };
        }

        internal AgentSessionClaimResult Claim(AgentSession session, string agentInstanceId, bool force)
        {
            EnsureSession(session);
            if (string.IsNullOrWhiteSpace(agentInstanceId))
                throw new InvalidOperationException("Agent instance id trống.");

            for (var attempt = 0; attempt < 4; attempt++)
            {
                var current = Read(session);
                if (current.Exists &&
                    !string.Equals(current.AgentInstanceId, agentInstanceId, StringComparison.Ordinal) &&
                    !force)
                {
                    return new AgentSessionClaimResult
                    {
                        Conflict = true,
                        ExistingAgentInstanceId = current.AgentInstanceId
                    };
                }

                if (TryWrite(session, agentInstanceId, current))
                {
                    _log("FIRESTORE AGENT_SESSION claim=PASS force=" + (force ? "true" : "false") +
                         " instance=" + Short(agentInstanceId));
                    return new AgentSessionClaimResult { Claimed = true };
                }
            }

            throw new InvalidOperationException("Không thể giành phiên Agent sau nhiều lần cạnh tranh.");
        }

        internal bool IsCurrent(AgentSession session, string agentInstanceId)
        {
            EnsureSession(session);
            var current = Read(session);
            return current.Exists &&
                   string.Equals(current.AgentInstanceId, agentInstanceId, StringComparison.Ordinal);
        }

        internal void Release(AgentSession session, string agentInstanceId)
        {
            try
            {
                EnsureSession(session);
                var current = Read(session);
                if (!current.Exists ||
                    !string.Equals(current.AgentInstanceId, agentInstanceId, StringComparison.Ordinal))
                    return;

                var suffix = string.IsNullOrWhiteSpace(current.UpdateTime)
                    ? ""
                    : "?currentDocument.updateTime=" + Uri.EscapeDataString(current.UpdateTime);
                Send("DELETE", DocumentUrl(session.UserId) + suffix, session.IdToken, null, false, "AGENT_SESSION_RELEASE");
                _log("FIRESTORE AGENT_SESSION release=PASS instance=" + Short(agentInstanceId));
            }
            catch (Exception ex)
            {
                _log("FIRESTORE AGENT_SESSION release=DEFER type=" + ex.GetType().Name);
            }
        }

        private ReadResult Read(AgentSession session)
        {
            try
            {
                var raw = Send("GET", DocumentUrl(session.UserId), session.IdToken, null, true, "AGENT_SESSION_READ");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object fieldsObj;
                var fields = doc != null && doc.TryGetValue("fields", out fieldsObj)
                    ? fieldsObj as Dictionary<string, object>
                    : null;
                return new ReadResult
                {
                    Exists = doc != null,
                    UpdateTime = Get(doc, "updateTime"),
                    AgentInstanceId = FieldString(fields, "agent_instance_id")
                };
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 404)
                {
                    try { response.Dispose(); } catch { }
                    return new ReadResult();
                }
                throw;
            }
        }

        private bool TryWrite(AgentSession session, string agentInstanceId, ReadResult previous)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var fields = new Dictionary<string, object>
            {
                { "firebase_uid", StringField(session.UserId) },
                { "agent_instance_id", StringField(agentInstanceId) },
                { "agent_admin_user_id", StringField(session.AppUserId ?? "") },
                { "machine", StringField(Environment.MachineName) },
                { "claimed_at_ms", IntField(now) }
            };
            var suffix =
                "?updateMask.fieldPaths=firebase_uid" +
                "&updateMask.fieldPaths=agent_instance_id" +
                "&updateMask.fieldPaths=agent_admin_user_id" +
                "&updateMask.fieldPaths=machine" +
                "&updateMask.fieldPaths=claimed_at_ms";
            suffix += previous != null && previous.Exists && !string.IsNullOrWhiteSpace(previous.UpdateTime)
                ? "&currentDocument.updateTime=" + Uri.EscapeDataString(previous.UpdateTime)
                : "&currentDocument.exists=false";

            try
            {
                Send(
                    "PATCH",
                    DocumentUrl(session.UserId) + suffix,
                    session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    false,
                    "AGENT_SESSION_CLAIM");
                return true;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 409 || status == 412) return false;
                throw;
            }
        }

        private string Send(string method, string url, string token, string body, bool retrySafeRead, string component)
        {
            return FirestoreHttpTransport.SendJson(
                method,
                url,
                token,
                body,
                "Agent-Auto-Confirm-Pick-Pack/D098",
                8000,
                retrySafeRead,
                _log,
                component);
        }

        private static string DocumentUrl(string uid)
        {
            return AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                   "/relay_poc_agent_sessions/" + Uri.EscapeDataString(uid);
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString() } };
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object>
                : null;
            return value == null ? "" : Get(value, "stringValue");
        }

        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value)
                ? Convert.ToString(value) ?? ""
                : "";
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
                string.IsNullOrWhiteSpace(session.UserId) ||
                (!realAdmin && !realPickPackAdmin))
                throw new InvalidOperationException("Thiếu phiên Firebase quản trị hợp lệ cho Agent.");
        }

        private static string Short(string value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? ""
                : value.Substring(0, Math.Min(8, value.Length));
        }
    }
}
