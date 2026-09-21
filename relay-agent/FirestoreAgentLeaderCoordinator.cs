using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class FirestoreLeaderSnapshot
    {
        internal string AgentInstanceId = "";
        internal string AgentAdminUserId = "";
        internal string Machine = "";
        internal string Generation = "";
        internal long SelectedAtMs;
        internal long HeartbeatAtMs;
        internal bool WmsReady;
    }

    internal sealed class FirestoreAgentLeaderCoordinator : IDisposable
    {
        // D085 business target: fail over after 10 seconds.
        // Four-second lease cadence keeps detection bounded while reducing Firestore writes.
        internal const int HeartbeatIntervalMs = 4000;
        internal const int FailoverAfterMs = 10000;
        internal const int PresenceHeartbeatIntervalMs = 30000;
        internal const int PresenceReadIntervalMs = 60000;
        internal const int PresenceFreshMs = 90000;

        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly Func<bool> _wmsReady;
        private readonly string _instanceId;
        private readonly Action<string> _log;
        private readonly Action<bool, string> _stateChanged;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly object _stateGate = new object();

        private CancellationTokenSource _cts;
        private volatile bool _isLeader;
        private string _currentLeaderId = "";
        private long _lastPresenceWriteMs;
        private long _lastPresenceReadMs;
        private volatile int _onlineAgentCount = 1;

        internal FirestoreAgentLeaderCoordinator(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            Func<bool> wmsReady,
            string instanceId,
            Action<string> log,
            Action<bool, string> stateChanged)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _wmsReady = wmsReady;
            _instanceId = instanceId ?? "";
            _log = log ?? delegate { };
            _stateChanged = stateChanged ?? delegate { };
        }

        internal bool IsLeader { get { return _isLeader; } }
        internal int OnlineAgentCount { get { return Math.Max(1, _onlineAgentCount); } }

        internal string CurrentLeaderId
        {
            get { lock (_stateGate) return _currentLeaderId; }
        }

        internal void Start()
        {
            lock (_stateGate)
            {
                if (_cts != null) return;
                _cts = new CancellationTokenSource();
                Task.Run(() => Loop(_cts.Token), _cts.Token);
            }
        }

        internal void Stop()
        {
            CancellationTokenSource cts;
            lock (_stateGate)
            {
                cts = _cts;
                _cts = null;
            }

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                ReleasePresence(session);
                ReleaseLeadership(session);
            }
            catch { }

            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (cts != null) cts.Dispose(); } catch { }
            SetLeaderState(false, "", "STOPPED");
        }

        public void Dispose() { Stop(); }

        private void Loop(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    MaintainPresence(session);
                    var read = ReadLeader(session);

                    if (!_wmsReady())
                    {
                        if (read.Snapshot != null &&
                            string.Equals(read.Snapshot.AgentInstanceId, _instanceId, StringComparison.Ordinal))
                            TryDeleteLeader(session, read.UpdateTime);
                        SetLeaderState(false, read.Snapshot == null ? "" : read.Snapshot.AgentInstanceId, "WMS_NOT_READY");
                    }
                    else if (read.Snapshot != null &&
                             string.Equals(read.Snapshot.AgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        var renewed = BuildSnapshot(session, read.Snapshot.SelectedAtMs, read.Snapshot.Generation);
                        if (TryWriteLeader(session, renewed, read))
                            SetLeaderState(true, _instanceId, "ACTIVE");
                        else
                            SetLeaderState(false, "", "LEASE_RACE");
                    }
                    else if (IsHealthy(read.Snapshot))
                    {
                        SetLeaderState(false, read.Snapshot.AgentInstanceId, "STANDBY");
                    }
                    else
                    {
                        var candidate = BuildSnapshot(session, NowMs(), Guid.NewGuid().ToString("N"));
                        if (TryWriteLeader(session, candidate, read))
                            SetLeaderState(true, _instanceId, read.Snapshot == null ? "ACTIVE_FIRST" : "ACTIVE_FAILOVER");
                        else
                            SetLeaderState(false, "", "ELECTION_RACE");
                    }
                }
                catch (Exception ex)
                {
                    SetLeaderState(false, CurrentLeaderId, "COORDINATION_ERROR");
                    _log("FIRESTORE HA coordination_error type=" + ex.GetType().Name +
                         " message=" + AgentDiagnostics.Sanitize(ex.Message));
                }

                if (token.WaitHandle.WaitOne(HeartbeatIntervalMs)) return;
            }
        }

        private void MaintainPresence(AgentSession session)
        {
            var now = NowMs();
            try
            {
                if (_lastPresenceWriteMs == 0 || now - _lastPresenceWriteMs >= PresenceHeartbeatIntervalMs)
                {
                    WritePresence(session, now);
                    _lastPresenceWriteMs = now;
                }

                if (_lastPresenceReadMs == 0 || now - _lastPresenceReadMs >= PresenceReadIntervalMs)
                {
                    _onlineAgentCount = Math.Max(1, ReadOnlineAgentCount(session, now));
                    _lastPresenceReadMs = now;
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE PRESENCE error type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
        }

        private void WritePresence(AgentSession session, long now)
        {
            var fields = new Dictionary<string, object>
            {
                { "agent_instance_id", StringField(_instanceId) },
                { "agent_admin_user_id", StringField(session == null ? "" : session.AppUserId ?? "") },
                { "machine", StringField(Environment.MachineName) },
                { "heartbeat_at_ms", IntField(now) },
                { "wms_ready", BoolField(_wmsReady()) }
            };
            SendJson("PATCH", PresenceSelfUrl(), session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                BuildMask(fields.Keys), 7000);
        }

        private int ReadOnlineAgentCount(AgentSession session, long now)
        {
            var raw = SendJson("GET", PresenceCollectionUrl(), session.IdToken, null, "", 7000);
            var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
            object docsObj;
            var docs = root != null && root.TryGetValue("documents", out docsObj) ? docsObj as ArrayList : null;
            if (docs == null) return 1;

            var count = 0;
            foreach (var item in docs)
            {
                var doc = item as Dictionary<string, object>;
                if (doc == null) continue;
                object fieldsObj;
                var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
                if (fields == null) continue;
                var heartbeat = FieldLong(fields, "heartbeat_at_ms");
                var age = now - heartbeat;
                if (heartbeat > 0 && age >= -60000 && age <= PresenceFreshMs) count++;
            }
            return Math.Max(1, count);
        }

        private void ReleasePresence(AgentSession session)
        {
            try { SendJson("DELETE", PresenceSelfUrl(), session.IdToken, null, "", 4000); }
            catch { }
        }

        private bool IsHealthy(FirestoreLeaderSnapshot snapshot)
        {
            if (snapshot == null || !snapshot.WmsReady || string.IsNullOrWhiteSpace(snapshot.AgentInstanceId))
                return false;
            var delta = NowMs() - snapshot.HeartbeatAtMs;
            return delta >= -60000 && delta <= FailoverAfterMs;
        }

        private FirestoreLeaderSnapshot BuildSnapshot(AgentSession session, long selectedAtMs, string generation)
        {
            return new FirestoreLeaderSnapshot
            {
                AgentInstanceId = _instanceId,
                AgentAdminUserId = session == null ? "" : session.AppUserId ?? "",
                Machine = Environment.MachineName,
                Generation = string.IsNullOrWhiteSpace(generation) ? Guid.NewGuid().ToString("N") : generation,
                SelectedAtMs = selectedAtMs > 0 ? selectedAtMs : NowMs(),
                HeartbeatAtMs = NowMs(),
                WmsReady = true
            };
        }

        private sealed class LeaderRead
        {
            internal FirestoreLeaderSnapshot Snapshot;
            internal string UpdateTime = "";
            internal bool Exists;
        }

        private LeaderRead ReadLeader(AgentSession session)
        {
            try
            {
                var raw = SendJson("GET", LeaderUrl(), session.IdToken, null, "", 7000);
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (doc == null) return new LeaderRead();
                object fieldsObj;
                var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
                if (fields == null) return new LeaderRead { Exists = true, UpdateTime = Get(doc, "updateTime") };
                return new LeaderRead
                {
                    Exists = true,
                    UpdateTime = Get(doc, "updateTime"),
                    Snapshot = new FirestoreLeaderSnapshot
                    {
                        AgentInstanceId = FieldString(fields, "agent_instance_id"),
                        AgentAdminUserId = FieldString(fields, "agent_admin_user_id"),
                        Machine = FieldString(fields, "machine"),
                        Generation = FieldString(fields, "generation"),
                        SelectedAtMs = FieldLong(fields, "selected_at_ms"),
                        HeartbeatAtMs = FieldLong(fields, "heartbeat_at_ms"),
                        WmsReady = FieldBool(fields, "wms_ready")
                    }
                };
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 404)
                {
                    try { response.Dispose(); } catch { }
                    return new LeaderRead();
                }
                throw;
            }
        }

        private bool TryWriteLeader(AgentSession session, FirestoreLeaderSnapshot snapshot, LeaderRead previous)
        {
            var fields = new Dictionary<string, object>
            {
                { "agent_instance_id", StringField(snapshot.AgentInstanceId) },
                { "agent_admin_user_id", StringField(snapshot.AgentAdminUserId) },
                { "machine", StringField(snapshot.Machine) },
                { "generation", StringField(snapshot.Generation) },
                { "selected_at_ms", IntField(snapshot.SelectedAtMs) },
                { "heartbeat_at_ms", IntField(snapshot.HeartbeatAtMs) },
                { "wms_ready", BoolField(snapshot.WmsReady) }
            };
            var suffix = BuildMask(fields.Keys);
            suffix += previous != null && previous.Exists && !string.IsNullOrWhiteSpace(previous.UpdateTime)
                ? "&currentDocument.updateTime=" + Uri.EscapeDataString(previous.UpdateTime)
                : "&currentDocument.exists=false";
            try
            {
                SendJson("PATCH", LeaderUrl(), session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }), suffix, 7000);
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

        private void ReleaseLeadership(AgentSession session)
        {
            try
            {
                var read = ReadLeader(session);
                if (read.Snapshot != null &&
                    string.Equals(read.Snapshot.AgentInstanceId, _instanceId, StringComparison.Ordinal))
                    TryDeleteLeader(session, read.UpdateTime);
            }
            catch { }
        }

        private bool TryDeleteLeader(AgentSession session, string updateTime)
        {
            var suffix = string.IsNullOrWhiteSpace(updateTime)
                ? ""
                : "?currentDocument.updateTime=" + Uri.EscapeDataString(updateTime);
            try
            {
                SendJson("DELETE", LeaderUrl(), session.IdToken, null, suffix, 7000);
                return true;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 404 || status == 409 || status == 412) return false;
                throw;
            }
        }

        private void SetLeaderState(bool isLeader, string leaderId, string reason)
        {
            bool changed;
            lock (_stateGate)
            {
                changed = _isLeader != isLeader ||
                          !string.Equals(_currentLeaderId ?? "", leaderId ?? "", StringComparison.Ordinal);
                _isLeader = isLeader;
                _currentLeaderId = leaderId ?? "";
            }
            if (!changed) return;

            _log("FIRESTORE HA state=" + (isLeader ? "ACTIVE" : "STANDBY") +
                 " reason=" + reason +
                 " self=" + Short(_instanceId) +
                 " leader=" + Short(leaderId) +
                 " failover_ms=" + FailoverAfterMs);
            _stateChanged(isLeader, leaderId ?? "");
        }

        private static string DocumentsBase
        {
            get { return AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/'); }
        }

        private static string LeaderUrl()
        {
            return DocumentsBase + "/relay_poc_coordination/leader";
        }

        private static string PresenceCollectionUrl()
        {
            return DocumentsBase + "/relay_poc_agents?pageSize=100";
        }

        private string PresenceSelfUrl()
        {
            return DocumentsBase + "/relay_poc_agents/" + Uri.EscapeDataString(_instanceId);
        }

        private string SendJson(string method, string baseUrl, string token, string body, string suffix, int timeout)
        {
            var request = (HttpWebRequest)WebRequest.Create(baseUrl + (suffix ?? ""));
            request.Method = method;
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/FirestoreHA";
            request.Timeout = timeout;
            request.ReadWriteTimeout = timeout;
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

        private static Dictionary<string, object> BoolField(bool value)
        {
            return new Dictionary<string, object> { { "booleanValue", value } };
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            return value == null ? "" : Get(value, "stringValue");
        }

        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            long parsed;
            return value != null && long.TryParse(Get(value, "integerValue"), out parsed) ? parsed : 0L;
        }

        private static bool FieldBool(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            if (value == null) return false;
            object rawBool;
            return value.TryGetValue("booleanValue", out rawBool) && rawBool is bool && (bool)rawBool;
        }

        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        private static string Short(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "none";
            return value.Substring(0, Math.Min(8, value.Length));
        }
    }
}
