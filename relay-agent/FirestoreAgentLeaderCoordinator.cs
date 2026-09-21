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
    internal enum FirestoreAgentRole
    {
        FROZEN = 0,
        STANDBY = 1,
        PRIMARY = 2
    }

    internal sealed class FirestoreRoleSnapshot
    {
        internal string PrimaryAgentInstanceId = "";
        internal string StandbyAgentInstanceId = "";
        internal string Generation = "";
        internal long UpdatedAtMs;
    }

    internal sealed class FirestoreAgentLeaderCoordinator : IDisposable
    {
        internal const int FailoverAfterMs = 10000;
        internal const int StandbyTakeoverAgeMs = 10000;
        internal const int PrimaryRoleRefreshMs = 60000;
        internal const int StandbyRoleRefreshMs = 300000;
        internal const int FrozenRoleRefreshMs = 900000;
        internal const int PresenceHeartbeatIntervalMs = 3600000;
        internal const int PresenceReadIntervalMs = 3600000;
        internal const int PresenceFreshMs = 7200000;

        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly Func<bool> _wmsReady;
        private readonly string _instanceId;
        private readonly Action<string> _log;
        private readonly Action<FirestoreAgentRole, string> _stateChanged;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly object _stateGate = new object();

        private CancellationTokenSource _cts;
        private volatile FirestoreAgentRole _role = FirestoreAgentRole.FROZEN;
        private string _primaryId = "";
        private string _standbyId = "";
        private long _lastPresenceWriteMs;
        private long _lastPresenceReadMs;
        private volatile int _onlineAgentCount;
        private volatile bool _coordinationHealthy;
        private volatile bool _relayPollHealthy;
        private volatile bool _refreshBeforeBusiness;

        internal FirestoreAgentLeaderCoordinator(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            Func<bool> wmsReady,
            string instanceId,
            Action<string> log,
            Action<FirestoreAgentRole, string> stateChanged)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _wmsReady = wmsReady;
            _instanceId = instanceId ?? "";
            _log = log ?? delegate { };
            _stateChanged = stateChanged ?? delegate { };
        }

        internal bool IsLeader { get { return _role == FirestoreAgentRole.PRIMARY; } }
        internal bool IsStandby { get { return _role == FirestoreAgentRole.STANDBY; } }
        internal bool IsFrozen { get { return _role == FirestoreAgentRole.FROZEN; } }
        internal FirestoreAgentRole Role { get { return _role; } }
        internal string RoleName { get { return _role.ToString(); } }
        internal bool CanPollBusiness { get { return _wmsReady() && (_role == FirestoreAgentRole.PRIMARY || _role == FirestoreAgentRole.STANDBY); } }
        internal bool IsTransportHealthy { get { return _coordinationHealthy && (!_relayPollHealthy ? _role == FirestoreAgentRole.FROZEN : true); } }
        internal int OnlineAgentCount { get { return Math.Max(0, _onlineAgentCount); } }

        internal string CurrentLeaderId
        {
            get { lock (_stateGate) return _primaryId; }
        }

        internal int BusinessPollIntervalMs
        {
            get
            {
                if (_role == FirestoreAgentRole.PRIMARY) return 5000;
                if (_role == FirestoreAgentRole.STANDBY) return 10000;
                return 60000;
            }
        }

        internal bool CanProcessJob(long createdAtMs)
        {
            if (!_wmsReady()) return false;
            if (_role == FirestoreAgentRole.PRIMARY) return true;
            if (_role != FirestoreAgentRole.STANDBY) return false;
            if (createdAtMs <= 0) return false;
            return NowMs() - createdAtMs >= StandbyTakeoverAgeMs;
        }

        internal void ReportRelayPoll(bool healthy)
        {
            _relayPollHealthy = healthy;
            if (!healthy)
            {
                _refreshBeforeBusiness = true;
                _log("FIRESTORE role=" + RoleName + " transport=OFFLINE role_preserved=true");
            }
        }

        internal void RequestRoleRefreshBeforeBusiness()
        {
            _refreshBeforeBusiness = true;
        }

        internal void EnsureRoleCurrentBeforeBusiness(AgentSession session)
        {
            if (!_refreshBeforeBusiness) return;
            RefreshRole(session);
            _refreshBeforeBusiness = false;
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
                ReleaseRole(session);
                ReleasePresence(session);
            }
            catch { }

            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (cts != null) cts.Dispose(); } catch { }
            SetRole(FirestoreAgentRole.FROZEN, "", "", "STOPPED");
        }

        public void Dispose() { Stop(); }

        internal bool PromoteStandbyForTakeover()
        {
            if (_role == FirestoreAgentRole.PRIMARY) return true;
            if (_role != FirestoreAgentRole.STANDBY || !_wmsReady()) return false;

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                for (var attempt = 0; attempt < 3; attempt++)
                {
                    var read = ReadRoles(session);
                    if (read.Snapshot != null &&
                        string.Equals(read.Snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, read.Snapshot.StandbyAgentInstanceId, "TAKEOVER_ALREADY_PRIMARY");
                        return true;
                    }

                    if (read.Snapshot == null ||
                        !string.Equals(read.Snapshot.StandbyAgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        ApplySnapshot(read.Snapshot, "TAKEOVER_ROLE_CHANGED");
                        return false;
                    }

                    var previousPrimary = read.Snapshot.PrimaryAgentInstanceId ?? "";
                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, next, read))
                    {
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, "", "ACTIVE_FAILOVER_REQUEST_DRIVEN");
                        _log("FIRESTORE HA takeover=PASS trigger=pending_age threshold_ms=" + FailoverAfterMs +
                             " self=" + Short(_instanceId));
                        TrySelectReplacementStandby(session, previousPrimary);
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE HA takeover=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }

        private void Loop(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                var waitMs = FrozenRoleRefreshMs;
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    MaintainPresence(session);
                    RefreshRole(session);
                    if ((_role == FirestoreAgentRole.PRIMARY || _role == FirestoreAgentRole.STANDBY) &&
                        (_lastPresenceReadMs == 0 || NowMs() - _lastPresenceReadMs >= PresenceReadIntervalMs))
                    {
                        _onlineAgentCount = ReadOnlineAgentCount(session, NowMs());
                        _lastPresenceReadMs = NowMs();
                    }

                    _coordinationHealthy = true;
                    waitMs = _role == FirestoreAgentRole.FROZEN
                        ? FrozenRoleRefreshMs
                        : (_role == FirestoreAgentRole.STANDBY ? StandbyRoleRefreshMs : PrimaryRoleRefreshMs);
                }
                catch (Exception ex)
                {
                    _coordinationHealthy = false;
                    _log("FIRESTORE HA role-refresh error role_preserved=true type=" + ex.GetType().Name +
                         " message=" + AgentDiagnostics.Sanitize(ex.Message));
                    waitMs = 30000;
                }

                if (token.WaitHandle.WaitOne(waitMs)) return;
            }
        }

        private void RefreshRole(AgentSession session)
        {
            for (var attempt = 0; attempt < 4; attempt++)
            {
                var read = ReadRoles(session);
                var snapshot = read.Snapshot;

                if (snapshot == null)
                {
                    if (!_wmsReady())
                    {
                        SetRole(FirestoreAgentRole.FROZEN, "", "", "WMS_NOT_READY");
                        return;
                    }
                    var first = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, first, read))
                    {
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, "", "ACTIVE_FIRST");
                        return;
                    }
                    continue;
                }

                if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    if (!_wmsReady())
                    {
                        var relinquish = new FirestoreRoleSnapshot
                        {
                            PrimaryAgentInstanceId = snapshot.StandbyAgentInstanceId ?? "",
                            StandbyAgentInstanceId = "",
                            Generation = Guid.NewGuid().ToString("N"),
                            UpdatedAtMs = NowMs()
                        };
                        if (TryWriteRoles(session, relinquish, read))
                        {
                            SetRole(FirestoreAgentRole.FROZEN, relinquish.PrimaryAgentInstanceId, "", "PRIMARY_WMS_NOT_READY");
                            return;
                        }
                        continue;
                    }
                    SetRole(FirestoreAgentRole.PRIMARY, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, "ACTIVE");
                    return;
                }

                if (string.Equals(snapshot.StandbyAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    if (!_wmsReady())
                    {
                        var clearStandby = new FirestoreRoleSnapshot
                        {
                            PrimaryAgentInstanceId = snapshot.PrimaryAgentInstanceId,
                            StandbyAgentInstanceId = "",
                            Generation = snapshot.Generation,
                            UpdatedAtMs = NowMs()
                        };
                        if (TryWriteRoles(session, clearStandby, read))
                        {
                            SetRole(FirestoreAgentRole.FROZEN, clearStandby.PrimaryAgentInstanceId, "", "STANDBY_WMS_NOT_READY");
                            return;
                        }
                        continue;
                    }
                    SetRole(FirestoreAgentRole.STANDBY, snapshot.PrimaryAgentInstanceId, _instanceId, "STANDBY");
                    return;
                }

                if (string.IsNullOrWhiteSpace(snapshot.PrimaryAgentInstanceId) && _wmsReady())
                {
                    var primary = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = snapshot.StandbyAgentInstanceId,
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, primary, read))
                    {
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, primary.StandbyAgentInstanceId, "ACTIVE_VACANT");
                        return;
                    }
                    continue;
                }

                if (string.IsNullOrWhiteSpace(snapshot.StandbyAgentInstanceId) && _wmsReady())
                {
                    var standby = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = snapshot.PrimaryAgentInstanceId,
                        StandbyAgentInstanceId = _instanceId,
                        Generation = snapshot.Generation,
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, standby, read))
                    {
                        SetRole(FirestoreAgentRole.STANDBY, standby.PrimaryAgentInstanceId, _instanceId, "STANDBY_SELECTED");
                        return;
                    }
                    continue;
                }

                SetRole(FirestoreAgentRole.FROZEN, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, "FROZEN");
                return;
            }

            throw new InvalidOperationException("Không ổn định được vai trò Agent sau nhiều lần cạnh tranh.");
        }

        private void TrySelectReplacementStandby(AgentSession session, string excludedAgentId)
        {
            try
            {
                var raw = SendJson("GET", PresenceCollectionUrl(), session.IdToken, null, "", 7000, true, "STANDBY_DISCOVERY");
                var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object docsObj;
                var docs = root != null && root.TryGetValue("documents", out docsObj)
                    ? docsObj as IEnumerable
                    : null;
                if (docs == null) return;

                var now = NowMs();
                var candidate = "";
                foreach (var item in docs)
                {
                    var doc = item as Dictionary<string, object>;
                    if (doc == null) continue;
                    object fieldsObj;
                    var fields = doc.TryGetValue("fields", out fieldsObj)
                        ? fieldsObj as Dictionary<string, object>
                        : null;
                    if (fields == null) continue;

                    var agentId = FieldString(fields, "agent_instance_id");
                    var heartbeat = FieldLong(fields, "heartbeat_at_ms");
                    var age = now - heartbeat;
                    if (string.IsNullOrWhiteSpace(agentId) ||
                        string.Equals(agentId, _instanceId, StringComparison.Ordinal) ||
                        string.Equals(agentId, excludedAgentId ?? "", StringComparison.Ordinal) ||
                        heartbeat <= 0 || age < -60000 || age > PresenceFreshMs ||
                        !FieldBool(fields, "wms_ready"))
                        continue;

                    candidate = agentId;
                    if (string.Equals(FieldString(fields, "role"), "FROZEN", StringComparison.OrdinalIgnoreCase))
                        break;
                }

                if (string.IsNullOrWhiteSpace(candidate))
                {
                    _log("FIRESTORE HA replacement-standby=NONE available_candidate=false");
                    return;
                }

                for (var attempt = 0; attempt < 3; attempt++)
                {
                    var roles = ReadRoles(session);
                    if (roles.Snapshot == null ||
                        !string.Equals(roles.Snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal) ||
                        !string.IsNullOrWhiteSpace(roles.Snapshot.StandbyAgentInstanceId))
                        return;

                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = candidate,
                        Generation = roles.Snapshot.Generation ?? Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, next, roles))
                    {
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, candidate, "REPLACEMENT_STANDBY_SELECTED");
                        _log("FIRESTORE HA replacement-standby=SELECTED candidate=" + Short(candidate));
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE HA replacement-standby=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
        }

        private void MaintainPresence(AgentSession session)
        {
            var now = NowMs();
            if (_lastPresenceWriteMs != 0 && now - _lastPresenceWriteMs < PresenceHeartbeatIntervalMs) return;
            var fields = new Dictionary<string, object>
            {
                { "agent_instance_id", StringField(_instanceId) },
                { "agent_admin_user_id", StringField(session == null ? "" : session.AppUserId ?? "") },
                { "machine", StringField(Environment.MachineName) },
                { "heartbeat_at_ms", IntField(now) },
                { "wms_ready", BoolField(_wmsReady()) },
                { "role", StringField(RoleName) }
            };
            SendJson("PATCH", PresenceSelfUrl(), session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                BuildMask(fields.Keys), 7000, false, "PRESENCE_WRITE");
            _lastPresenceWriteMs = now;
        }

        private int ReadOnlineAgentCount(AgentSession session, long now)
        {
            var raw = SendJson("GET", PresenceCollectionUrl(), session.IdToken, null, "", 7000, true, "PRESENCE_READ");
            var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
            object docsObj;
            var docs = root != null && root.TryGetValue("documents", out docsObj) ? docsObj as IEnumerable : null;
            if (docs == null) return 0;

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
            return Math.Max(0, count);
        }

        private sealed class RoleRead
        {
            internal FirestoreRoleSnapshot Snapshot;
            internal string UpdateTime = "";
            internal bool Exists;
        }

        private RoleRead ReadRoles(AgentSession session)
        {
            try
            {
                var raw = SendJson("GET", RolesUrl(), session.IdToken, null, "", 7000, true, "ROLE_READ");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (doc == null) return new RoleRead();
                object fieldsObj;
                var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
                if (fields == null) return new RoleRead { Exists = true, UpdateTime = Get(doc, "updateTime") };
                return new RoleRead
                {
                    Exists = true,
                    UpdateTime = Get(doc, "updateTime"),
                    Snapshot = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = FieldString(fields, "primary_agent_instance_id"),
                        StandbyAgentInstanceId = FieldString(fields, "standby_agent_instance_id"),
                        Generation = FieldString(fields, "generation"),
                        UpdatedAtMs = FieldLong(fields, "updated_at_ms")
                    }
                };
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 404)
                {
                    try { response.Dispose(); } catch { }
                    return new RoleRead();
                }
                throw;
            }
        }

        private bool TryWriteRoles(AgentSession session, FirestoreRoleSnapshot snapshot, RoleRead previous)
        {
            var fields = new Dictionary<string, object>
            {
                { "primary_agent_instance_id", StringField(snapshot.PrimaryAgentInstanceId ?? "") },
                { "standby_agent_instance_id", StringField(snapshot.StandbyAgentInstanceId ?? "") },
                { "generation", StringField(snapshot.Generation ?? "") },
                { "updated_at_ms", IntField(snapshot.UpdatedAtMs) }
            };
            var suffix = BuildMask(fields.Keys);
            suffix += previous != null && previous.Exists && !string.IsNullOrWhiteSpace(previous.UpdateTime)
                ? "&currentDocument.updateTime=" + Uri.EscapeDataString(previous.UpdateTime)
                : "&currentDocument.exists=false";
            try
            {
                SendJson("PATCH", RolesUrl(), session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    suffix, 7000, false, "ROLE_WRITE");
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

        private void ReleaseRole(AgentSession session)
        {
            try
            {
                var read = ReadRoles(session);
                var snapshot = read.Snapshot;
                if (snapshot == null) return;

                if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = snapshot.StandbyAgentInstanceId ?? "",
                        StandbyAgentInstanceId = "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    TryWriteRoles(session, next, read);
                }
                else if (string.Equals(snapshot.StandbyAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = snapshot.PrimaryAgentInstanceId ?? "",
                        StandbyAgentInstanceId = "",
                        Generation = snapshot.Generation ?? "",
                        UpdatedAtMs = NowMs()
                    };
                    TryWriteRoles(session, next, read);
                }
            }
            catch { }
        }

        private void ReleasePresence(AgentSession session)
        {
            try
            {
                SendJson("DELETE", PresenceSelfUrl(), session.IdToken, null, "", 4000, false, "PRESENCE_DELETE");
            }
            catch { }
        }

        private void ApplySnapshot(FirestoreRoleSnapshot snapshot, string reason)
        {
            if (snapshot == null)
            {
                SetRole(FirestoreAgentRole.FROZEN, "", "", reason);
                return;
            }
            if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                SetRole(FirestoreAgentRole.PRIMARY, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, reason);
            else if (string.Equals(snapshot.StandbyAgentInstanceId, _instanceId, StringComparison.Ordinal))
                SetRole(FirestoreAgentRole.STANDBY, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, reason);
            else
                SetRole(FirestoreAgentRole.FROZEN, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, reason);
        }

        private void SetRole(FirestoreAgentRole role, string primaryId, string standbyId, string reason)
        {
            bool changed;
            lock (_stateGate)
            {
                changed = _role != role ||
                          !string.Equals(_primaryId ?? "", primaryId ?? "", StringComparison.Ordinal) ||
                          !string.Equals(_standbyId ?? "", standbyId ?? "", StringComparison.Ordinal);
                _role = role;
                _primaryId = primaryId ?? "";
                _standbyId = standbyId ?? "";
                if (changed) _relayPollHealthy = false;
            }
            if (!changed) return;

            _log("FIRESTORE HA role=" + role +
                 " reason=" + reason +
                 " self=" + Short(_instanceId) +
                 " primary=" + Short(primaryId) +
                 " standby=" + Short(standbyId) +
                 " failover_ms=" + FailoverAfterMs);
            _stateChanged(role, primaryId ?? "");
        }

        private static string DocumentsBase
        {
            get { return AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/'); }
        }

        private static string RolesUrl()
        {
            return DocumentsBase + "/relay_poc_coordination/roles";
        }

        private string PresenceSelfUrl()
        {
            return DocumentsBase + "/relay_poc_agents/" + Uri.EscapeDataString(_instanceId);
        }

        private static string PresenceCollectionUrl()
        {
            return DocumentsBase + "/relay_poc_agents?pageSize=100";
        }

        private string SendJson(
            string method,
            string url,
            string token,
            string body,
            string suffix,
            int timeoutMs,
            bool retrySafeRead,
            string component)
        {
            return FirestoreHttpTransport.SendJson(
                method,
                url + (suffix ?? ""),
                token,
                body,
                "Agent-Auto-Confirm-Pick-Pack/D097",
                timeoutMs,
                retrySafeRead,
                _log,
                component);
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
            long result;
            return value != null && long.TryParse(Get(value, "integerValue"), out result) ? result : 0L;
        }

        private static bool FieldBool(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            if (value == null) return false;
            object rawBool;
            return value.TryGetValue("booleanValue", out rawBool) && Convert.ToBoolean(rawBool);
        }

        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
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

        private static string Short(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            return value.Substring(0, Math.Min(8, value.Length));
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
