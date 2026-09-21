using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class FirestoreConfirmationWorkItem
    {
        internal string RequestId;
        internal string Suffix;
        internal string PickerUid;
        internal string PickerUserId;
        internal long ClientSentAtMs;
    }

    internal sealed class FirestoreConfirmationOutcome
    {
        internal string Result = "CONFIRM_ERROR";
        internal string CacheMode = "NONE";
        internal string Route = "NONE";
        internal int Http;
        internal long OperationMs;
        internal int Matches;
        internal PickerRateDecision Rate = new PickerRateDecision();
    }

    internal sealed class FirestoreConfirmationTransport
    {
        internal const int PollIntervalMs = 3000;

        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly string _instanceId;
        private readonly Func<string> _networkProvider;
        private readonly Action<string> _log;
        private readonly Action<string> _audit;
        private readonly Action _onRequest;
        private readonly Action _onResponse;
        private readonly Action<string> _state;
        private readonly Func<FirestoreConfirmationWorkItem, FirestoreConfirmationOutcome> _handler;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };

        internal FirestoreConfirmationTransport(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            string instanceId,
            Func<string> networkProvider,
            Action<string> log,
            Action<string> audit,
            Action onRequest,
            Action onResponse,
            Action<string> state,
            Func<FirestoreConfirmationWorkItem, FirestoreConfirmationOutcome> handler)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _instanceId = instanceId ?? "";
            _networkProvider = networkProvider;
            _log = log;
            _audit = audit;
            _onRequest = onRequest;
            _onResponse = onResponse;
            _state = state;
            _handler = handler;
        }

        internal void Run(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    _ensureFreshToken();
                    var processed = ProcessOnce(_sessionProvider());
                    _state(processed > 0 ? "Relay: đã xử lý yêu cầu" : "Relay: Firestore online · chờ PDA");
                }
                catch (Exception ex)
                {
                    _state("Relay: Firestore lỗi · đang thử lại");
                    _log("FIRESTORE confirm loop fail " + Describe(ex));
                }
                if (token.WaitHandle.WaitOne(PollIntervalMs)) break;
            }
        }

        private int ProcessOnce(AgentSession session)
        {
            var raw = Send("GET", AgentConfig.FirestoreRelayCollectionUrl + "?pageSize=100", session.IdToken, null);
            var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
            object docsObj;
            var docs = root != null && root.TryGetValue("documents", out docsObj) ? docsObj as ArrayList : null;
            if (docs == null) return 0;

            var processed = 0;
            foreach (var item in docs)
            {
                var doc = item as Dictionary<string, object>;
                if (doc == null) continue;
                var name = Get(doc, "name");
                var updateTime = Get(doc, "updateTime");
                var jobId = Last(name);
                object fieldsObj;
                var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
                if (fields == null || string.IsNullOrWhiteSpace(jobId)) continue;
                if (FieldString(fields, "status") != "PENDING") continue;
                if (FieldString(fields, "source") != "ANDROID_CONFIRM_V1") continue;

                var requestId = FieldString(fields, "request_id");
                var suffix = FieldString(fields, "suffix");
                var pickerUid = FieldString(fields, "picker_uid");
                var pickerUserId = FieldString(fields, "picker_user_id");
                if (requestId != jobId || !ValidSuffix(suffix) ||
                    string.IsNullOrWhiteSpace(pickerUid) || string.IsNullOrWhiteSpace(pickerUserId))
                    continue;

                if (!TryClaim(session, name, updateTime, jobId)) continue;

                _onRequest();
                _audit("PDA_REQUEST request=" + Short(jobId) +
                    " picker=" + Safe(pickerUserId) +
                    " picklist_last5=redacted transport=FIRESTORE" +
                    " admin=" + Safe(session.AppUserId) +
                    " machine=" + Safe(Environment.MachineName) +
                    " instance=" + Short(_instanceId));

                FirestoreConfirmationOutcome outcome;
                try
                {
                    outcome = _handler(new FirestoreConfirmationWorkItem
                    {
                        RequestId = jobId,
                        Suffix = suffix,
                        PickerUid = pickerUid,
                        PickerUserId = pickerUserId,
                        ClientSentAtMs = FieldLong(fields, "client_sent_at_ms")
                    }) ?? new FirestoreConfirmationOutcome();
                }
                catch (Exception ex)
                {
                    _log("FIRESTORE business fail request=" + Short(jobId) + " " + Describe(ex));
                    outcome = new FirestoreConfirmationOutcome { Result = "CONFIRM_ERROR" };
                }

                if (TryAck(session, name, jobId, outcome))
                {
                    processed++;
                    _onResponse();
                }
            }
            return processed;
        }

        private bool TryClaim(AgentSession session, string name, string updateTime, string jobId)
        {
            var fields = new Dictionary<string, object>
            {
                { "status", StringField("PROCESSING") },
                { "agent_id", StringField(Environment.MachineName) },
                { "agent_instance_id", StringField(_instanceId) },
                { "agent_admin_user_id", StringField(session.AppUserId ?? "") },
                { "agent_network", StringField(_networkProvider()) },
                { "agent_received_at_ms", IntField(NowMs()) }
            };
            var url = "https://firestore.googleapis.com/v1/" + name + Mask(fields.Keys);
            if (!string.IsNullOrWhiteSpace(updateTime))
                url += "&currentDocument.updateTime=" + Uri.EscapeDataString(updateTime);
            try
            {
                Send("PATCH", url, session.IdToken, _json.Serialize(new Dictionary<string, object> { { "fields", fields } }));
                _log("FIRESTORE CLAIM PASS request=" + Short(jobId) + " instance=" + Short(_instanceId));
                return true;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 403 || status == 409 || status == 412) return false;
                throw;
            }
        }

        private bool TryAck(AgentSession session, string name, string jobId, FirestoreConfirmationOutcome outcome)
        {
            var rate = outcome.Rate ?? new PickerRateDecision();
            var fields = new Dictionary<string, object>
            {
                { "status", StringField("ACK") },
                { "agent_ack_at_ms", IntField(NowMs()) },
                { "lookup_status", StringField(outcome.Result ?? "CONFIRM_ERROR") },
                { "lookup_matches", IntField(Math.Max(0, outcome.Matches)) },
                { "lookup_ms", IntField(Math.Max(0L, outcome.OperationMs)) },
                { "lookup_route", StringField(outcome.Route ?? "NONE") },
                { "lookup_http", IntField(Math.Max(0, outcome.Http)) },
                { "cache_mode", StringField(outcome.CacheMode ?? "NONE") },
                { "rate_strikes", IntField(Math.Max(0, rate.StrikeCount)) },
                { "lock_level", IntField(Math.Max(0, rate.LockLevel)) },
                { "locked_until_ms", IntField(Math.Max(0L, rate.LockedUntilMs)) }
            };
            try
            {
                Send("PATCH", "https://firestore.googleapis.com/v1/" + name + Mask(fields.Keys),
                    session.IdToken, _json.Serialize(new Dictionary<string, object> { { "fields", fields } }));
                _audit("AGENT_RESPONSE request=" + Short(jobId) +
                    " result=" + Safe(outcome.Result) +
                    " cache=" + Safe(outcome.CacheMode) +
                    " http=" + outcome.Http +
                    " strikes=" + rate.StrikeCount +
                    " lock_level=" + rate.LockLevel +
                    " instance=" + Short(_instanceId));
                _log("FIRESTORE ACK PASS request=" + Short(jobId) + " result=" + Safe(outcome.Result));
                return true;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 403 || status == 409 || status == 412) return false;
                throw;
            }
        }

        private string Send(string method, string url, string token, string body)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = method;
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D092";
            request.Timeout = 12000;
            request.ReadWriteTimeout = 12000;
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

        private string Describe(Exception ex)
        {
            var web = ex as WebException;
            if (web == null) return "type=" + ex.GetType().Name + " detail=" + AgentDiagnostics.Sanitize(ex.Message);
            var response = web.Response as HttpWebResponse;
            if (response == null) return "status=0 web_exception=" + web.Status;
            var status = (int)response.StatusCode;
            try { response.Dispose(); } catch { }
            return "http=" + status;
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
            var value = fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            return value == null ? "" : Get(value, "stringValue");
        }
        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            long result;
            return value != null && long.TryParse(Get(value, "integerValue"), out result) ? result : 0L;
        }
        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }
        private static string Last(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var parts = value.Split('/');
            return parts[parts.Length - 1];
        }
        private static string Mask(IEnumerable<string> fields)
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
        private static bool ValidSuffix(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length != 5) return false;
            foreach (var ch in value) if (ch < '0' || ch > '9') return false;
            return true;
        }
        private static string Short(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "" : value.Substring(0, Math.Min(8, value.Length));
        }
        private static string Safe(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "unknown";
            var sb = new StringBuilder();
            foreach (var ch in value)
            {
                if (char.IsLetterOrDigit(ch) || ch == '.' || ch == '_' || ch == ':' || ch == '@' || ch == '-') sb.Append(ch);
                if (sb.Length >= 96) break;
            }
            return sb.Length == 0 ? "unknown" : sb.ToString();
        }
        private static long NowMs() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
    }
}
