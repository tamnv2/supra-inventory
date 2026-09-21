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
        internal long RetireAtMs;
    }

    internal sealed class FirestoreConfirmationGuard
    {
        private const long ConfirmRetentionMs = 30L * 24L * 60L * 60L * 1000L;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly object _localGate = new object();
        private readonly HashSet<string> _locallyConfirmed = new HashSet<string>(StringComparer.Ordinal);

        private sealed class GuardRead
        {
            internal bool Exists;
            internal string Status = "";
            internal string RequestId = "";
            internal string PickerUid = "";
            internal long RetireAtMs;
        }

        internal FirestoreConfirmationGuardDecision TryBegin(
            AgentSession session,
            string pickListCode,
            string requestId,
            string agentInstanceId,
            string pickerUid)
        {
            EnsureSession(session);
            var guardId = Fingerprint(pickListCode);
            lock (_localGate)
            {
                if (_locallyConfirmed.Contains(guardId))
                {
                    return new FirestoreConfirmationGuardDecision
                    {
                        AlreadyConfirmed = true,
                        GuardId = guardId,
                        RetireAtMs = NowMs() + ConfirmRetentionMs
                    };
                }
            }

            var now = NowMs();
            var retireAtMs = now + ConfirmRetentionMs;
            var fields = new Dictionary<string, object>
            {
                { "status", StringField("CLAIMED") },
                { "request_id", StringField(requestId ?? "") },
                { "agent_instance_id", StringField(agentInstanceId ?? "") },
                { "picker_uid", StringField(pickerUid ?? "") },
                { "started_at_ms", IntField(now) },
                { "retire_at_ms", IntField(retireAtMs) }
            };

            var url = DocumentUrl(guardId) + BuildMask(fields.Keys) + "&currentDocument.exists=false";
            try
            {
                Send("PATCH", url, session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    false,
                    "CONFIRM_GUARD_CREATE");
                return new FirestoreConfirmationGuardDecision
                {
                    Acquired = true,
                    GuardId = guardId,
                    RetireAtMs = retireAtMs
                };
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status != 409 && status != 412) throw;
            }

            var existing = Read(session, guardId);
            if (!existing.Exists)
            {
                return new FirestoreConfirmationGuardDecision
                {
                    InProgressOrUncertain = true,
                    GuardId = guardId,
                    RetireAtMs = retireAtMs
                };
            }

            lock (_localGate)
            {
                if (_locallyConfirmed.Contains(guardId))
                {
                    return new FirestoreConfirmationGuardDecision
                    {
                        AlreadyConfirmed = true,
                        GuardId = guardId,
                        RetireAtMs = existing.RetireAtMs
                    };
                }
            }

            if (string.Equals(existing.Status, "CONFIRMED", StringComparison.Ordinal))
            {
                return new FirestoreConfirmationGuardDecision
                {
                    AlreadyConfirmed = true,
                    GuardId = guardId,
                    RetireAtMs = existing.RetireAtMs
                };
            }

            if (!string.IsNullOrWhiteSpace(existing.RequestId) &&
                OriginalJobProvesConfirmed(session, existing.RequestId))
            {
                return new FirestoreConfirmationGuardDecision
                {
                    AlreadyConfirmed = true,
                    GuardId = guardId,
                    RetireAtMs = existing.RetireAtMs
                };
            }

            return new FirestoreConfirmationGuardDecision
            {
                InProgressOrUncertain = true,
                GuardId = guardId,
                RetireAtMs = existing.RetireAtMs
            };
        }

        internal void MarkLocalConfirmed(string guardId)
        {
            if (string.IsNullOrWhiteSpace(guardId)) return;
            lock (_localGate) _locallyConfirmed.Add(guardId);
        }

        internal void MarkDurableConfirmed(AgentSession session, string guardId)
        {
            if (string.IsNullOrWhiteSpace(guardId)) return;
            EnsureSession(session);
            var fields = new Dictionary<string, object>
            {
                { "status", StringField("CONFIRMED") },
                { "confirmed_at_ms", IntField(NowMs()) }
            };
            Send(
                "PATCH",
                DocumentUrl(guardId) + BuildMask(fields.Keys),
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                false,
                "CONFIRM_GUARD_MARK_CONFIRMED");
            MarkLocalConfirmed(guardId);
        }

        internal void ReleaseSafeFailure(AgentSession session, string guardId)
        {
            if (string.IsNullOrWhiteSpace(guardId)) return;
            lock (_localGate) _locallyConfirmed.Remove(guardId);
            try
            {
                EnsureSession(session);
                Send("DELETE", DocumentUrl(guardId), session.IdToken, null, false, "CONFIRM_GUARD_RELEASE");
            }
            catch { }
        }

        private GuardRead Read(AgentSession session, string guardId)
        {
            try
            {
                var raw = Send("GET", DocumentUrl(guardId), session.IdToken, null, true, "CONFIRM_GUARD_READ");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object fieldsObj;
                var fields = doc != null && doc.TryGetValue("fields", out fieldsObj)
                    ? fieldsObj as Dictionary<string, object>
                    : null;
                return new GuardRead
                {
                    Exists = doc != null,
                    Status = FieldString(fields, "status"),
                    RequestId = FieldString(fields, "request_id"),
                    PickerUid = FieldString(fields, "picker_uid"),
                    RetireAtMs = FieldLong(fields, "retire_at_ms")
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

        private bool OriginalJobProvesConfirmed(AgentSession session, string requestId)
        {
            try
            {
                var raw = Send(
                    "GET",
                    AgentConfig.FirestoreRelayCollectionUrl.TrimEnd('/') + "/" + Uri.EscapeDataString(requestId),
                    session.IdToken,
                    null,
                    true,
                    "CONFIRM_GUARD_JOB_PROOF");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object fieldsObj;
                var fields = doc != null && doc.TryGetValue("fields", out fieldsObj)
                    ? fieldsObj as Dictionary<string, object>
                    : null;
                return string.Equals(FieldString(fields, "status"), "ACK", StringComparison.Ordinal) &&
                       string.Equals(FieldString(fields, "lookup_status"), "CONFIRMED", StringComparison.Ordinal);
            }
            catch
            {
                return false;
            }
        }

        private static string DocumentUrl(string guardId)
        {
            return AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                   "/relay_poc_confirm_guards/" + Uri.EscapeDataString(guardId);
        }

        private string Send(
            string method,
            string url,
            string token,
            string body,
            bool retrySafeRead,
            string component)
        {
            return FirestoreHttpTransport.SendJson(
                method,
                url,
                token,
                body,
                "Agent-Auto-Confirm-Pick-Pack/D097",
                8000,
                retrySafeRead,
                null,
                component);
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

        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object>
                : null;
            if (value == null) return 0L;
            object rawInt;
            long parsed;
            return value.TryGetValue("integerValue", out rawInt) &&
                   long.TryParse(Convert.ToString(rawInt), out parsed)
                ? parsed
                : 0L;
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
