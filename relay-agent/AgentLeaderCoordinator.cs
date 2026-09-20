using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class RelayLeaderSnapshot
    {
        internal string AgentInstanceId = "";
        internal string AgentAdminUserId = "";
        internal string Machine = "";
        internal string Generation = "";
        internal long SelectedAtMs;
        internal long HeartbeatAtMs;
        internal bool WmsReady;
    }

    internal sealed class AgentLeaderCoordinator : IDisposable
    {
        internal const int HeartbeatIntervalMs = 3000;
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
        private string _generation = "";
        private long _lastPresenceWriteMs;
        private long _lastPresenceReadMs;
        private volatile int _onlineAgentCount = 1;

        internal AgentLeaderCoordinator(
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
            get
            {
                lock (_stateGate) return _currentLeaderId;
            }
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
                ReleasePresence();
                if (_isLeader)
                    ReleaseLeadership();
            }
            catch { }

            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (cts != null) cts.Dispose(); } catch { }
            SetLeaderState(false, "", "STOPPED");
        }

        public void Dispose()
        {
            Stop();
        }

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
                            TryDeleteLeader(session, read.ETag);
                        SetLeaderState(false, read.Snapshot == null ? "" : read.Snapshot.AgentInstanceId, "WMS_NOT_READY");
                    }
                    else if (read.Snapshot != null &&
                             string.Equals(read.Snapshot.AgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        var renewed = BuildSnapshot(session, read.Snapshot.SelectedAtMs, read.Snapshot.Generation);
                        if (TryPutLeader(session, renewed, read.ETag))
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
                        if (TryPutLeader(session, candidate, read.ETag))
                        {
                            _generation = candidate.Generation;
                            SetLeaderState(true, _instanceId, read.Snapshot == null ? "ACTIVE_FIRST" : "ACTIVE_FAILOVER");
                        }
                        else
                        {
                            SetLeaderState(false, "", "ELECTION_RACE");
                        }
                    }
                }
                catch (Exception ex)
                {
                    SetLeaderState(false, CurrentLeaderId, "COORDINATION_ERROR");
                    _log("AGENT HA coordination_error type=" + ex.GetType().Name +
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
                _log("AGENT PRESENCE error type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
        }

        private void WritePresence(AgentSession session, long now)
        {
            var payload = _json.Serialize(new Dictionary<string, object>
            {
                { "agent_instance_id", _instanceId },
                { "agent_admin_user_id", session == null ? "" : (session.AppUserId ?? "") },
                { "machine", Environment.MachineName },
                { "heartbeat_at_ms", now },
                { "wms_ready", _wmsReady() }
            });
            var request = (HttpWebRequest)WebRequest.Create(PresenceSelfUrl(session));
            request.Method = "PUT";
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "SUPRA-Inventory-Relay-Test/Presence";
            request.Timeout = 7000;
            request.ReadWriteTimeout = 7000;
            var bytes = Encoding.UTF8.GetBytes(payload);
            request.ContentLength = bytes.Length;
            using (var output = request.GetRequestStream())
                output.Write(bytes, 0, bytes.Length);
            using (var response = (HttpWebResponse)request.GetResponse()) { }
        }

        private int ReadOnlineAgentCount(AgentSession session, long now)
        {
            var request = (HttpWebRequest)WebRequest.Create(PresenceCollectionUrl(session));
            request.Method = "GET";
            request.Accept = "application/json";
            request.UserAgent = "SUPRA-Inventory-Relay-Test/Presence";
            request.Timeout = 7000;
            request.ReadWriteTimeout = 7000;
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                var raw = reader.ReadToEnd();
                if (string.IsNullOrWhiteSpace(raw) || string.Equals(raw.Trim(), "null", StringComparison.OrdinalIgnoreCase))
                    return 1;
                var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (root == null) return 1;
                var count = 0;
                foreach (var item in root)
                {
                    var map = item.Value as Dictionary<string, object>;
                    if (map == null) continue;
                    var heartbeat = LongValue(map, "heartbeat_at_ms");
                    var age = now - heartbeat;
                    if (heartbeat > 0 && age >= -60000 && age <= PresenceFreshMs)
                        count++;
                }
                return Math.Max(1, count);
            }
        }

        private void ReleasePresence()
        {
            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                var request = (HttpWebRequest)WebRequest.Create(PresenceSelfUrl(session));
                request.Method = "DELETE";
                request.UserAgent = "SUPRA-Inventory-Relay-Test/Presence";
                request.Timeout = 4000;
                request.ReadWriteTimeout = 4000;
                using (var response = (HttpWebResponse)request.GetResponse()) { }
            }
            catch { }
        }

        private string PresenceCollectionUrl(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu Firebase ADMIN session cho Agent presence.");
            return AgentConfig.DatabaseUrl.TrimEnd('/') +
                   "/relay_poc/coordination/agents.json?auth=" +
                   Uri.EscapeDataString(session.IdToken);
        }

        private string PresenceSelfUrl(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu Firebase ADMIN session cho Agent presence.");
            return AgentConfig.DatabaseUrl.TrimEnd('/') +
                   "/relay_poc/coordination/agents/" + Uri.EscapeDataString(_instanceId) + ".json?auth=" +
                   Uri.EscapeDataString(session.IdToken);
        }

        private bool IsHealthy(RelayLeaderSnapshot snapshot)
        {
            if (snapshot == null || !snapshot.WmsReady || string.IsNullOrWhiteSpace(snapshot.AgentInstanceId))
                return false;

            var delta = NowMs() - snapshot.HeartbeatAtMs;
            return delta >= -60000 && delta <= FailoverAfterMs;
        }

        private RelayLeaderSnapshot BuildSnapshot(AgentSession session, long selectedAtMs, string generation)
        {
            return new RelayLeaderSnapshot
            {
                AgentInstanceId = _instanceId,
                AgentAdminUserId = session == null ? "" : (session.AppUserId ?? ""),
                Machine = Environment.MachineName,
                Generation = string.IsNullOrWhiteSpace(generation) ? Guid.NewGuid().ToString("N") : generation,
                SelectedAtMs = selectedAtMs > 0 ? selectedAtMs : NowMs(),
                HeartbeatAtMs = NowMs(),
                WmsReady = true
            };
        }

        private void ReleaseLeadership()
        {
            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                var read = ReadLeader(session);
                if (read.Snapshot != null &&
                    string.Equals(read.Snapshot.AgentInstanceId, _instanceId, StringComparison.Ordinal))
                    TryDeleteLeader(session, read.ETag);
            }
            catch { }
        }

        private sealed class LeaderRead
        {
            internal RelayLeaderSnapshot Snapshot;
            internal string ETag = "";
        }

        private LeaderRead ReadLeader(AgentSession session)
        {
            var request = (HttpWebRequest)WebRequest.Create(LeaderUrl(session));
            request.Method = "GET";
            request.Accept = "application/json";
            request.UserAgent = "SUPRA-Inventory-Relay-Test/HA";
            request.Timeout = 7000;
            request.ReadWriteTimeout = 7000;
            request.Headers["X-Firebase-ETag"] = "true";

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                var raw = reader.ReadToEnd();
                var result = new LeaderRead { ETag = response.Headers["ETag"] ?? "" };
                if (string.IsNullOrWhiteSpace(raw) || string.Equals(raw.Trim(), "null", StringComparison.OrdinalIgnoreCase))
                    return result;

                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (map == null) return result;
                result.Snapshot = new RelayLeaderSnapshot
                {
                    AgentInstanceId = StringValue(map, "agent_instance_id"),
                    AgentAdminUserId = StringValue(map, "agent_admin_user_id"),
                    Machine = StringValue(map, "machine"),
                    Generation = StringValue(map, "generation"),
                    SelectedAtMs = LongValue(map, "selected_at_ms"),
                    HeartbeatAtMs = LongValue(map, "heartbeat_at_ms"),
                    WmsReady = BoolValue(map, "wms_ready")
                };
                return result;
            }
        }

        private bool TryPutLeader(AgentSession session, RelayLeaderSnapshot snapshot, string etag)
        {
            var payload = _json.Serialize(new Dictionary<string, object>
            {
                { "agent_instance_id", snapshot.AgentInstanceId },
                { "agent_admin_user_id", snapshot.AgentAdminUserId },
                { "machine", snapshot.Machine },
                { "generation", snapshot.Generation },
                { "selected_at_ms", snapshot.SelectedAtMs },
                { "heartbeat_at_ms", snapshot.HeartbeatAtMs },
                { "wms_ready", snapshot.WmsReady }
            });

            var request = (HttpWebRequest)WebRequest.Create(LeaderUrl(session));
            request.Method = "PUT";
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "SUPRA-Inventory-Relay-Test/HA";
            request.Timeout = 7000;
            request.ReadWriteTimeout = 7000;
            if (!string.IsNullOrWhiteSpace(etag))
                request.Headers[HttpRequestHeader.IfMatch] = etag;

            var bytes = Encoding.UTF8.GetBytes(payload);
            request.ContentLength = bytes.Length;
            using (var output = request.GetRequestStream())
                output.Write(bytes, 0, bytes.Length);

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                    return (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 412)
                {
                    try { response.Dispose(); } catch { }
                    return false;
                }
                throw;
            }
        }

        private bool TryDeleteLeader(AgentSession session, string etag)
        {
            var request = (HttpWebRequest)WebRequest.Create(LeaderUrl(session));
            request.Method = "DELETE";
            request.Accept = "application/json";
            request.UserAgent = "SUPRA-Inventory-Relay-Test/HA";
            request.Timeout = 7000;
            request.ReadWriteTimeout = 7000;
            if (!string.IsNullOrWhiteSpace(etag))
                request.Headers[HttpRequestHeader.IfMatch] = etag;

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                    return (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 412)
                {
                    try { response.Dispose(); } catch { }
                    return false;
                }
                throw;
            }
        }

        private string LeaderUrl(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu Firebase ADMIN session cho Agent HA.");
            return AgentConfig.DatabaseUrl.TrimEnd('/') +
                   "/relay_poc/coordination/leader.json?auth=" +
                   Uri.EscapeDataString(session.IdToken);
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

            _log(
                "AGENT HA state=" + (isLeader ? "ACTIVE" : "STANDBY") +
                " reason=" + reason +
                " self=" + Short(_instanceId) +
                " leader=" + Short(leaderId) +
                " failover_ms=" + FailoverAfterMs);
            _stateChanged(isLeader, leaderId ?? "");
        }

        private static string StringValue(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static long LongValue(Dictionary<string, object> map, string key)
        {
            object value;
            long parsed;
            return map != null && map.TryGetValue(key, out value) &&
                   long.TryParse(Convert.ToString(value), out parsed) ? parsed : 0L;
        }

        private static bool BoolValue(Dictionary<string, object> map, string key)
        {
            object value;
            bool parsed;
            return map != null && map.TryGetValue(key, out value) &&
                   bool.TryParse(Convert.ToString(value), out parsed) && parsed;
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
