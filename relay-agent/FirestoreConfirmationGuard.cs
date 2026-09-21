using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class FirestoreConfirmationGuardDecision
    {
        internal bool Acquired;
        internal bool AlreadyConfirmed;
        internal bool InProgressOrUncertain;
        internal string GuardId = "";
    }

    internal sealed class FirestoreConfirmationGuard
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();

        internal FirestoreConfirmationGuardDecision TryBegin(
            AgentSession session,
            string pickListCode,
            string requestId,
            string agentInstanceId)
        {
            EnsureSession(session);
            var guardId = Fingerprint(pickListCode);
            for (var attempt = 0; attempt < 3; attempt++)
            {
                var existing = Read(session, guardId);
                if (existing.Exists)
                {
                    if (string.Equals(existing.Status, "CONFIRMED", StringComparison.Ordinal))
                        return new FirestoreConfirmationGuardDecision
                        {
                            AlreadyConfirmed = true,
                            GuardId = guardId
                        };

                    return new FirestoreConfirmationGuardDecision
                    {
                        InProgressOrUncertain = true,
                        GuardId = guardId
                    };
                }

                var fields = new Dictionary<string, object>
                {
                    { "status", StringField("PROCESSING") },
                    { "request_id", StringField(requestId ?? "") },
                    { "agent_instance_id", StringField(agentInstanceId ?? "") },
                    { "started_at_ms", IntField(NowMs()) },
                    { "updated_at_ms", IntField(NowMs()) }
                };

                var url = DocumentUrl(guardId) + BuildMask(fields.Keys) + "&currentDocument.exists=false";
                try
                {
                    Send("PATCH", url, session.IdToken,
                        _json.Serialize(new Dictionary<string, object> { { "fields", fields } }));
                    return new FirestoreConfirmationGuardDecision
                    {
                        Acquired = true,
                        GuardId = guardId
                    };
                }
                catch (WebException ex)
                {
                    var response = ex.Response as HttpWebResponse;
                    var status = response == null ? 0 : (int)response.StatusCode;
                    try { if (response != null) response.Dispose(); } catch { }
                    if (status == 409 || status == 412) continue;
                    throw;
                }
            }

            return new FirestoreConfirmationGuardDecision
            {
                InProgressOrUncertain = true,
                GuardId = guardId
            };
        }

        internal void MarkConfirmed(
            AgentSession session,
            string guardId,
            string requestId,
            string agentInstanceId)
        {
            EnsureSession(session);
            var fields = new Dictionary<string, object>
            {
                { "status", StringField("CONFIRMED") },
                { "request_id", StringField(requestId ?? "") },
                { "agent_instance_id", StringField(agentInstanceId ?? "") },
                { "confirmed_at_ms", IntField(NowMs()) },
                { "updated_at_ms", IntField(NowMs()) }
            };
            Send("PATCH", DocumentUrl(guardId) + BuildMask(fields.Keys), session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }));
        }

        internal void ReleaseSafeFailure(AgentSession session, string guardId)
        {
            if (string.IsNullOrWhiteSpace(guardId)) return;
            try
            {
                EnsureSession(session);
                Send("DELETE", DocumentUrl(guardId), session.IdToken, null);
            }
            catch { }
        }

        private sealed class GuardRead
        {
            internal bool Exists;
            internal string Status = "";
        }

        private GuardRead Read(AgentSession session, string guardId)
        {
            try
            {
                var raw = Send("GET", DocumentUrl(guardId), session.IdToken, null);
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object fieldsObj;
                var fields = doc != null && doc.TryGetValue("fields", out fieldsObj)
                    ? fieldsObj as Dictionary<string, object>
                    : null;
                return new GuardRead
                {
                    Exists = doc != null,
                    Status = FieldString(fields, "status")
                };
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 404)
                {
                    try { response.Dispose(); } catch { }
                    return new GuardRead();
                }
                throw;
            }
        }

        private static string DocumentUrl(string guardId)
        {
            return AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                   "/relay_poc_confirm_guards/" + Uri.EscapeDataString(guardId);
        }

        private string Send(string method, string url, string token, string body)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = method;
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/ConfirmGuard";
            request.Timeout = 8000;
            request.ReadWriteTimeout = 8000;
            request.KeepAlive = false;
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + token;
            if (body != null)
            {
                var bytes = Encoding.UTF8.GetBytes(body);
                request.ContentLength = bytes.Length;
                using (var output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);
            }

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var stream = response.GetResponseStream())
            using (var reader = stream == null ? null : new StreamReader(stream))
                return reader == null ? "" : reader.ReadToEnd();
        }

        private static string Fingerprint(string pickListCode)
        {
            if (string.IsNullOrWhiteSpace(pickListCode))
                throw new ArgumentException("PickListCode is required.", "pickListCode");
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(pickListCode.Trim().ToUpperInvariant()));
                var sb = new StringBuilder(hash.Length * 2);
                foreach (var item in hash) sb.Append(item.ToString("x2"));
                return sb.ToString();
            }
        }

        private static void EnsureSession(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu Firebase ADMIN session cho confirmation guard.");
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
            if (value == null) return "";
            object rawString;
            return value.TryGetValue("stringValue", out rawString)
                ? Convert.ToString(rawString) ?? ""
                : "";
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
