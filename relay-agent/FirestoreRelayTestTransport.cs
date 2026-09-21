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
    /// <summary>
    /// D091 field-only transport candidate.
    /// Polls a bounded Firestore collection over HTTPS with the current Firebase ADMIN ID token.
    /// It proves PDA -> Firestore -> Office Agent -> Firestore -> PDA only.
    /// It deliberately does not select the final transport, implement Agent HA, or mutate WMS.
    /// </summary>
    internal sealed class FirestoreRelayTestTransport
    {
        internal const int PollIntervalMs = 3000;
        internal const int MaxDocumentsPerPoll = 25;

        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly string _instanceId;
        private readonly Func<string> _networkProvider;
        private readonly Action<string> _log;
        private readonly Action<string> _audit;
        private readonly Action _onRequest;
        private readonly Action _onResponse;
        private readonly Action<string> _stateChanged;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();

        internal FirestoreRelayTestTransport(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            string instanceId,
            Func<string> networkProvider,
            Action<string> log,
            Action<string> audit,
            Action onRequest,
            Action onResponse,
            Action<string> stateChanged)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _instanceId = instanceId ?? "";
            _networkProvider = networkProvider ?? (() => "UNKNOWN");
            _log = log ?? delegate { };
            _audit = audit ?? delegate { };
            _onRequest = onRequest ?? delegate { };
            _onResponse = onResponse ?? delegate { };
            _stateChanged = stateChanged ?? delegate { };
        }

        internal void Run(CancellationToken token)
        {
            _log("D091 FIRESTORE relay_test_loop start poll_ms=" + PollIntervalMs + " max_docs=" + MaxDocumentsPerPoll);
            while (!token.IsCancellationRequested)
            {
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    var processed = PollOnce(session);
                    _stateChanged(processed > 0
                        ? "Relay: FIRESTORE OK / đã nhận " + processed + " yêu cầu"
                        : "Relay: FIRESTORE ONLINE / đang nghe");
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch (WebException ex)
                {
                    _stateChanged("Relay: FIRESTORE lỗi mạng/quyền");
                    _log("D091 FIRESTORE poll_fail " + DescribeWebException(ex));
                }
                catch (Exception ex)
                {
                    _stateChanged("Relay: FIRESTORE lỗi · xem log");
                    _log("D091 FIRESTORE poll_fail type=" + ex.GetType().Name +
                         " detail=" + AgentDiagnostics.Sanitize(ex.Message));
                }

                if (token.WaitHandle.WaitOne(PollIntervalMs)) return;
            }
        }

        private int PollOnce(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu Firebase ADMIN session.");

            var url = AgentConfig.FirestoreRelayCollectionUrl +
                      "?pageSize=" + MaxDocumentsPerPoll;
            var raw = Send("GET", url, session.IdToken, null);
            if (string.IsNullOrWhiteSpace(raw)) return 0;

            var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
            if (root == null) return 0;
            object docsObj;
            if (!root.TryGetValue("documents", out docsObj) || docsObj == null) return 0;

            var enumerable = docsObj as IEnumerable;
            if (enumerable == null) return 0;

            var processed = 0;
            foreach (var item in enumerable)
            {
                var doc = item as Dictionary<string, object>;
                if (doc == null) continue;
                var name = GetString(doc, "name");
                var jobId = LastPathSegment(name);
                object fieldsObj;
                if (string.IsNullOrWhiteSpace(jobId) ||
                    !doc.TryGetValue("fields", out fieldsObj))
                    continue;

                var fields = fieldsObj as Dictionary<string, object>;
                if (fields == null) continue;

                if (!string.Equals(FieldString(fields, "status"), "PENDING", StringComparison.Ordinal))
                    continue;
                if (!string.Equals(FieldString(fields, "source"), "ANDROID_D091", StringComparison.Ordinal))
                    continue;

                var requestId = FieldString(fields, "request_id");
                var suffix = FieldString(fields, "suffix");
                var pickerUid = FieldString(fields, "picker_uid");
                var pickerUserId = FieldString(fields, "picker_user_id");
                var clientSentAtMs = FieldLong(fields, "client_sent_at_ms");

                if (!string.Equals(requestId, jobId, StringComparison.Ordinal) ||
                    suffix == null || suffix.Length != 5 ||
                    string.IsNullOrWhiteSpace(pickerUid) ||
                    string.IsNullOrWhiteSpace(pickerUserId))
                    continue;

                _onRequest();
                _audit("D091_PDA_REQUEST request=" + Short(jobId) +
                       " picker=" + SafeId(pickerUserId) +
                       " transport=FIRESTORE" +
                       " client_sent_at_ms=" + clientSentAtMs +
                       " admin=" + SafeId(session.AppUserId) +
                       " machine=" + SafeId(Environment.MachineName) +
                       " instance=" + Short(_instanceId) +
                       " network=" + SafeId(_networkProvider()));

                if (TryAck(session, name, jobId))
                {
                    processed++;
                    _onResponse();
                }
            }
            return processed;
        }

        private bool TryAck(AgentSession session, string documentName, string jobId)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var fields = new Dictionary<string, object>
            {
                { "status", StringValue("ACK") },
                { "agent_id", StringValue(Environment.MachineName) },
                { "agent_instance_id", StringValue(_instanceId) },
                { "agent_admin_user_id", StringValue(session.AppUserId ?? "") },
                { "agent_network", StringValue(_networkProvider()) },
                { "agent_received_at_ms", IntegerValue(now) },
                { "agent_ack_at_ms", IntegerValue(now) },
                { "lookup_status", StringValue("TRANSPORT_ONLY") },
                { "lookup_matches", IntegerValue(0) },
                { "lookup_ms", IntegerValue(0) },
                { "lookup_route", StringValue("FIRESTORE_D091") },
                { "lookup_http", IntegerValue(200) },
                { "cache_mode", StringValue("NONE") },
                { "rate_strikes", IntegerValue(0) },
                { "lock_level", IntegerValue(0) },
                { "locked_until_ms", IntegerValue(0) }
            };

            var body = _json.Serialize(new Dictionary<string, object> { { "fields", fields } });
            var url = "https://firestore.googleapis.com/v1/" + documentName + BuildUpdateMask(fields.Keys);
            try
            {
                Send("PATCH", url, session.IdToken, body);
                _log("D091 FIRESTORE ACK PASS request=" + Short(jobId) +
                     " admin=" + SafeId(session.AppUserId) +
                     " instance=" + Short(_instanceId));
                return true;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 403 || status == 409)
                {
                    _log("D091 FIRESTORE ACK race_or_denied request=" + Short(jobId) + " http=" + status);
                    return false;
                }
                throw;
            }
        }

        private string Send(string method, string url, string idToken, string body)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = method;
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D091";
            request.Timeout = 10000;
            request.ReadWriteTimeout = 10000;
            request.KeepAlive = false;
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + idToken;

            if (body != null)
            {
                var bytes = Encoding.UTF8.GetBytes(body);
                request.ContentLength = bytes.Length;
                using (var output = request.GetRequestStream())
                    output.Write(bytes, 0, bytes.Length);
            }

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var stream = response.GetResponseStream())
            using (var reader = stream == null ? null : new StreamReader(stream))
                return reader == null ? "" : reader.ReadToEnd();
        }

        private string DescribeWebException(WebException ex)
        {
            var response = ex.Response as HttpWebResponse;
            if (response == null)
                return "status=0 web_exception=" + ex.Status;

            var status = (int)response.StatusCode;
            var host = response.ResponseUri == null ? "" : response.ResponseUri.Host;
            var detail = "";
            try
            {
                using (response)
                using (var stream = response.GetResponseStream())
                using (var reader = stream == null ? null : new StreamReader(stream))
                    detail = reader == null ? "" : reader.ReadToEnd();
            }
            catch { }

            return "http=" + status +
                   " host=" + host +
                   " detail=" + AgentDiagnostics.Sanitize(detail);
        }

        private static Dictionary<string, object> StringValue(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntegerValue(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString() } };
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            object valueObj;
            if (!fields.TryGetValue(key, out valueObj)) return "";
            var value = valueObj as Dictionary<string, object>;
            return value == null ? "" : GetString(value, "stringValue");
        }

        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            object valueObj;
            if (!fields.TryGetValue(key, out valueObj)) return 0;
            var value = valueObj as Dictionary<string, object>;
            if (value == null) return 0;
            long parsed;
            return long.TryParse(GetString(value, "integerValue"), out parsed) ? parsed : 0;
        }

        private static string GetString(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static string LastPathSegment(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var parts = value.Split('/');
            return parts.Length == 0 ? "" : parts[parts.Length - 1];
        }

        private static string BuildUpdateMask(IEnumerable<string> fields)
        {
            var sb = new StringBuilder();
            var first = true;
            foreach (var field in fields)
            {
                sb.Append(first ? "?" : "&");
                first = false;
                sb.Append("updateMask.fieldPaths=");
                sb.Append(Uri.EscapeDataString(field));
            }
            return sb.ToString();
        }

        private static string Short(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "" : value.Substring(0, Math.Min(8, value.Length));
        }

        private static string SafeId(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "unknown";
            var sb = new StringBuilder();
            foreach (var ch in value)
            {
                if (char.IsLetterOrDigit(ch) || ch == '.' || ch == '_' || ch == ':' || ch == '@' || ch == '-')
                    sb.Append(ch);
                if (sb.Length >= 96) break;
            }
            return sb.Length == 0 ? "unknown" : sb.ToString();
        }
    }
}
