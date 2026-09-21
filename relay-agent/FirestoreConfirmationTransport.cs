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
        private readonly Func<bool> _canProcess;
        private readonly Action<bool> _relayHealth;
        private long _lastPollTelemetryMs;
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
            Func<FirestoreConfirmationWorkItem, FirestoreConfirmationOutcome> handler,
            Func<bool> canProcess,
            Action<bool> relayHealth)
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
            _canProcess = canProcess ?? delegate { return true; };
            _relayHealth = relayHealth ?? delegate { };
        }

        internal void Run(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    if (!_canProcess())
                    {
                        _state("Relay: STANDBY · chờ Agent chính");
                    }
                    else
                    {
                        _ensureFreshToken();
                        var processed = ProcessOnce(_sessionProvider());
                        _relayHealth(true);
                        _state(processed > 0 ? "Relay: đã xử lý yêu cầu" : "Relay: ACTIVE · Firestore online · chờ PDA");
                    }
                }
                catch (Exception ex)
                {
                    _relayHealth(false);
                    _state("Relay: FIRESTORE OFFLINE · đang kết nối lại");
                    _log("FIRESTORE confirm loop fail " + Describe(ex));
                }
                if (token.WaitHandle.WaitOne(PollIntervalMs)) break;
            }
        }

        private int ProcessOnce(AgentSession session)
        {
            var docs = ReadPendingDocuments(session);
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

                _log("FIRESTORE CONFIRM pending-found request=" + Short(jobId) +
                     " picker=" + Safe(pickerUserId));
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

        private ArrayList ReadPendingDocuments(AgentSession session)
        {
            try
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
                                        "compositeFilter", new Dictionary<string, object>
                                        {
                                            { "op", "AND" },
                                            {
                                                "filters", new object[]
                                                {
                                                    new Dictionary<string, object>
                                                    {
                                                        {
                                                            "fieldFilter", new Dictionary<string, object>
                                                            {
                                                                { "field", new Dictionary<string, object> { { "fieldPath", "status" } } },
                                                                { "op", "EQUAL" },
                                                                { "value", StringField("PENDING") }
                                                            }
                                                        }
                                                    },
                                                    new Dictionary<string, object>
                                                    {
                                                        {
                                                            "fieldFilter", new Dictionary<string, object>
                                                            {
                                                                { "field", new Dictionary<string, object> { { "fieldPath", "source" } } },
                                                                { "op", "EQUAL" },
                                                                { "value", StringField("ANDROID_CONFIRM_V1") }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            { "limit", 100 }
                        }
                    }
                };

                var raw = SendSafeRead(
                    "POST",
                    AgentConfig.FirestoreDocumentsBaseUrl + ":runQuery",
                    session.IdToken,
                    _json.Serialize(query));

                var rows = _json.DeserializeObject(raw) as ArrayList;
                var docs = new ArrayList();
                if (rows != null)
                {
                    foreach (var rowObj in rows)
                    {
                        var row = rowObj as Dictionary<string, object>;
                        if (row == null) continue;
                        object documentObj;
                        var document = row.TryGetValue("document", out documentObj)
                            ? documentObj as Dictionary<string, object>
                            : null;
                        if (document != null) docs.Add(document);
                    }
                }

                LogPollTelemetry("QUERY", docs.Count);
                return docs;
            }
            catch (Exception ex)
            {
                _log("FIRESTORE CONFIRM pending-query fallback type=" + ex.GetType().Name +
                     " detail=" + AgentDiagnostics.Sanitize(ex.Message));

                var raw = Send(
                    "GET",
                    AgentConfig.FirestoreRelayCollectionUrl +
                        "?pageSize=100&orderBy=" + Uri.EscapeDataString("client_sent_at_ms desc"),
                    session.IdToken,
                    null);
                var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object docsObj;
                var sourceDocs = root != null && root.TryGetValue("documents", out docsObj)
                    ? docsObj as ArrayList
                    : null;
                var docs = new ArrayList();
                if (sourceDocs != null)
                {
                    foreach (var item in sourceDocs)
                    {
                        var doc = item as Dictionary<string, object>;
                        if (doc == null) continue;
                        object fieldsObj;
                        var fields = doc.TryGetValue("fields", out fieldsObj)
                            ? fieldsObj as Dictionary<string, object>
                            : null;
                        if (fields == null) continue;
                        if (FieldString(fields, "status") == "PENDING" &&
                            FieldString(fields, "source") == "ANDROID_CONFIRM_V1")
                            docs.Add(doc);
                    }
                }

                LogPollTelemetry("LIST_FALLBACK", docs.Count);
                return docs;
            }
        }

        private void LogPollTelemetry(string mode, int pendingCount)
        {
            var now = NowMs();
            if (pendingCount <= 0 && now - _lastPollTelemetryMs < 30000) return;
            _lastPollTelemetryMs = now;
            _log("FIRESTORE CONFIRM poll=PASS mode=" + Safe(mode) +
                 " pending=" + Math.Max(0, pendingCount));
        }

        private string SendSafeRead(string method, string url, string token, string body)
        {
            return FirestoreHttpTransport.SendJson(
                method,
                url,
                token,
                body,
                "Agent-Auto-Confirm-Pick-Pack/D094",
                12000,
                true,
                _log,
                "CONFIRM_QUERY");
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
            return FirestoreHttpTransport.SendJson(
                method,
                url,
                token,
                body,
                "Agent-Auto-Confirm-Pick-Pack/D093",
                12000,
                string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase),
                _log,
                "CONFIRM");
        }

        private string Describe(Exception ex)
        {
            var web = ex as WebException;
            if (web == null) return "type=" + ex.GetType().Name + " detail=" + AgentDiagnostics.Sanitize(ex.Message);
            return FirestoreHttpTransport.Describe(web);
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
