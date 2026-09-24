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
        internal string ScheduleKey = "";
        internal string ScheduleDecision = "";
        internal long RelayOverrideUntilMs;
        internal long DecisionBoundaryMs;
    }

    internal sealed class AgentPresenceView
    {
        internal string AgentInstanceId = "";
        internal string AdminUserId = "";
        internal string Machine = "";
        internal string Role = "FROZEN";
        internal string Version = "";
        internal bool WmsReady;
        internal long HeartbeatAtMs;
    }

    internal sealed class FirestoreAgentLeaderCoordinator : IDisposable
    {
        internal const int FailoverAfterMs = 10000;
        internal const int StandbyTakeoverAgeMs = 10000;
        internal const int PrimaryLeaseHeartbeatMs = 7000;
        internal const int PrimaryRoleRefreshMs = 60000;
        internal const int StandbyRoleRefreshMs = 60000;
        internal const int FrozenRoleRefreshMs = 30000;
        internal const int StartupConvergenceIntervalMs = 5000;
        internal const int StartupConvergenceCycles = 4;
        internal const int PresenceHeartbeatIntervalMs = 900000;
        internal const int PresenceReadIntervalMs = 1800000;
        internal const int PresenceFreshMs = 2400000;

        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly Func<bool> _wmsReady;
        private readonly Func<bool> _takeoverWmsProbe;
        private readonly Func<bool> _relayEnabled;
        private readonly string _instanceId;
        private readonly Action<string> _log;
        private readonly Action<FirestoreAgentRole, string> _stateChanged;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly object _stateGate = new object();
        private readonly AutoResetEvent _wake = new AutoResetEvent(false);

        private CancellationTokenSource _cts;
        private volatile FirestoreAgentRole _role = FirestoreAgentRole.FROZEN;
        private string _primaryId = "";
        private string _standbyId = "";
        private long _lastPresenceWriteMs;
        private long _lastPresenceReadMs;
        private volatile int _onlineAgentCount;
        private volatile int _onlinePrimaryCount;
        private volatile int _onlineStandbyCount;
        private volatile int _onlineFrozenCount;
        private List<AgentPresenceView> _onlineAgents = new List<AgentPresenceView>();
        private volatile bool _fleetRefreshRequested = true;
        private int _startupConvergenceRemaining;
        private volatile bool _coordinationHealthy;
        private volatile bool _relayPollHealthy;
        private volatile bool _refreshBeforeBusiness;
        private string _generation = "";
        private long _lastRoleRefreshMs;
        private long _lastLeaseWriteMs;
        private long _leaseMissingSinceMs;
        private long _lastTakeoverProbeMs;
        private string _sharedScheduleKey = "";
        private string _sharedScheduleDecision = "";
        private long _sharedRelayOverrideUntilMs;
        private long _sharedDecisionBoundaryMs;

        internal FirestoreAgentLeaderCoordinator(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            Func<bool> wmsReady,
            Func<bool> takeoverWmsProbe,
            Func<bool> relayEnabled,
            string instanceId,
            Action<string> log,
            Action<FirestoreAgentRole, string> stateChanged)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _wmsReady = wmsReady;
            _takeoverWmsProbe = takeoverWmsProbe ?? (() => false);
            _relayEnabled = relayEnabled ?? (() => true);
            _instanceId = instanceId ?? "";
            _log = log ?? delegate { };
            _stateChanged = stateChanged ?? delegate { };
        }

        internal bool IsLeader { get { return _role == FirestoreAgentRole.PRIMARY; } }
        internal bool IsStandby { get { return _role == FirestoreAgentRole.STANDBY; } }
        internal bool IsFrozen { get { return _role == FirestoreAgentRole.FROZEN; } }
        internal FirestoreAgentRole Role { get { return _role; } }
        internal string RoleName { get { return _role.ToString(); } }
        internal bool CanPollBusiness { get { return _relayEnabled() && _wmsReady() && _role == FirestoreAgentRole.PRIMARY; } }
        internal bool IsTransportHealthy { get { return _coordinationHealthy && (!_relayPollHealthy ? _role == FirestoreAgentRole.FROZEN : true); } }
        internal int OnlineAgentCount { get { return Math.Max(0, _onlineAgentCount); } }
        internal int OnlinePrimaryCount { get { return Math.Max(0, _onlinePrimaryCount); } }
        internal int OnlineStandbyCount { get { return Math.Max(0, _onlineStandbyCount); } }
        internal int OnlineFrozenCount { get { return Math.Max(0, _onlineFrozenCount); } }

        internal List<AgentPresenceView> OnlineAgents
        {
            get
            {
                lock (_stateGate)
                {
                    return new List<AgentPresenceView>(_onlineAgents);
                }
            }
        }

        internal string CurrentLeaderId
        {
            get { lock (_stateGate) return _primaryId; }
        }

        internal int BusinessPollIntervalMs
        {
            get
            {
                if (_role == FirestoreAgentRole.PRIMARY) return FirestoreConfirmationTransport.PrimaryIdlePollIntervalMs;
                return 2000;
            }
        }

        internal bool CanProcessJob(long createdAtMs)
        {
            return _relayEnabled() && _wmsReady() && _role == FirestoreAgentRole.PRIMARY;
        }

        internal bool SharedRelayOverrideAllows(string scheduleKey, long nowMs)
        {
            lock (_stateGate)
            {
                return !string.IsNullOrWhiteSpace(scheduleKey) &&
                       string.Equals(_sharedScheduleKey, scheduleKey, StringComparison.Ordinal) &&
                       _sharedRelayOverrideUntilMs > nowMs;
            }
        }

        internal bool HasScheduleDecision(string scheduleKey, long boundaryMs)
        {
            lock (_stateGate)
            {
                return !string.IsNullOrWhiteSpace(scheduleKey) &&
                       string.Equals(_sharedScheduleKey, scheduleKey, StringComparison.Ordinal) &&
                       _sharedDecisionBoundaryMs == boundaryMs &&
                       !string.IsNullOrWhiteSpace(_sharedScheduleDecision);
            }
        }

        internal string SharedScheduleDecision
        {
            get { lock (_stateGate) return _sharedScheduleDecision ?? ""; }
        }

        internal long SharedRelayOverrideUntilMs
        {
            get { lock (_stateGate) return _sharedRelayOverrideUntilMs; }
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
            try { _wake.Set(); } catch { }
        }

        internal void RequestFleetRefresh()
        {
            _fleetRefreshRequested = true;
            try { _wake.Set(); } catch { }
        }

        internal void EnsureRoleCurrentBeforeBusiness(AgentSession session)
        {
            if (!_refreshBeforeBusiness) return;
            RefreshRole(session);
            _lastRoleRefreshMs = NowMs();
            _refreshBeforeBusiness = false;
        }

        internal bool VerifyPrimaryBeforeMutation(AgentSession session)
        {
            if (!_relayEnabled() || !_wmsReady() || _role != FirestoreAgentRole.PRIMARY) return false;
            var read = ReadRoles(session);
            ApplySharedSchedule(read.Snapshot);
            var snapshot = read.Snapshot;
            if (snapshot == null ||
                !string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(snapshot.Generation) ||
                !string.Equals(snapshot.Generation, _generation, StringComparison.Ordinal))
            {
                ApplySnapshot(snapshot, "MUTATION_FENCE_CHANGED");
                return false;
            }
            if (!_relayEnabled()) return false;
            return true;
        }

        internal bool PublishScheduleDecision(
            string scheduleKey,
            long boundaryMs,
            string decision,
            long relayOverrideUntilMs)
        {
            if (_role != FirestoreAgentRole.PRIMARY) return false;
            if (string.IsNullOrWhiteSpace(scheduleKey) || boundaryMs <= 0) return false;
            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                WriteScheduleFields(session, scheduleKey, decision, boundaryMs, relayOverrideUntilMs);
                SetSharedSchedule(scheduleKey, decision, boundaryMs, relayOverrideUntilMs);
                WritePrimaryLease(session);
                _log("FIRESTORE SCHEDULE decision=" + AgentDiagnostics.Sanitize(decision ?? "") +
                     " boundary_ms=" + boundaryMs +
                     " relay_until_ms=" + relayOverrideUntilMs +
                     " by=PRIMARY");
                try { _wake.Set(); } catch { }
                return true;
            }
            catch (Exception ex)
            {
                _log("FIRESTORE SCHEDULE write=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
                return false;
            }
        }

        internal bool PublishEarlyStartAndClaimPrimary(string scheduleKey, long relayOverrideUntilMs)
        {
            if (!_wmsReady() || string.IsNullOrWhiteSpace(scheduleKey) || relayOverrideUntilMs <= NowMs())
                return false;
            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                WriteScheduleFields(session, scheduleKey, "EARLY_START", 0L, relayOverrideUntilMs);
                SetSharedSchedule(scheduleKey, "EARLY_START", 0L, relayOverrideUntilMs);

                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (!TryWriteRoles(session, next, read)) continue;
                    _generation = next.Generation;
                    SetRole(FirestoreAgentRole.PRIMARY, _instanceId, "", "EARLY_START_PRIMARY");
                    WritePrimaryLease(session);
                    TrySelectReplacementStandby(session, "");
                    _log("FIRESTORE SCHEDULE early_start=PASS relay_until_ms=" + relayOverrideUntilMs);
                    return true;
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE SCHEDULE early_start=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }

        internal void Start()
        {
            lock (_stateGate)
            {
                if (_cts != null) return;
                _cts = new CancellationTokenSource();
                _startupConvergenceRemaining = StartupConvergenceCycles;
                _fleetRefreshRequested = true;
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
            try { _wake.Set(); } catch { }
            SetRole(FirestoreAgentRole.FROZEN, "", "", "STOPPED");
        }

        public void Dispose() { Stop(); }

        internal bool PromoteStandbyForTakeover()
        {
            if (_role == FirestoreAgentRole.PRIMARY) return true;
            if (_role != FirestoreAgentRole.STANDBY || !_relayEnabled() || !_wmsReady()) return false;

            var now = NowMs();
            if (_lastTakeoverProbeMs != 0 && now - _lastTakeoverProbeMs < 5000) return false;
            _lastTakeoverProbeMs = now;
            if (!_takeoverWmsProbe())
            {
                _log("FIRESTORE HA takeover=DEFER reason=WMS_PROBE_NOT_READY");
                return false;
            }

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                for (var attempt = 0; attempt < 3; attempt++)
                {
                    var read = ReadRoles(session);
                    ApplySharedSchedule(read.Snapshot);
                    if (!_relayEnabled()) return false;

                    if (read.Snapshot != null &&
                        string.Equals(read.Snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        _generation = read.Snapshot.Generation ?? "";
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, read.Snapshot.StandbyAgentInstanceId, "TAKEOVER_ALREADY_PRIMARY");
                        WritePrimaryLease(session);
                        return true;
                    }

                    if (read.Snapshot == null ||
                        !string.Equals(read.Snapshot.StandbyAgentInstanceId, _instanceId, StringComparison.Ordinal) ||
                        !string.Equals(read.Snapshot.Generation ?? "", _generation ?? "", StringComparison.Ordinal))
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
                        _generation = next.Generation;
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, "", "ACTIVE_FAILOVER_LEASE");
                        WritePrimaryLease(session);
                        _log("FIRESTORE HA takeover=PASS trigger=primary_lease_timeout threshold_ms=" + FailoverAfterMs +
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
                var waitMs = 5000;
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    var now = NowMs();
                    var startupConvergence = _startupConvergenceRemaining > 0;
                    var roleInterval = _role == FirestoreAgentRole.FROZEN
                        ? FrozenRoleRefreshMs
                        : (_role == FirestoreAgentRole.STANDBY ? StandbyRoleRefreshMs : PrimaryRoleRefreshMs);
                    var roleRefreshDue = startupConvergence ||
                                         _refreshBeforeBusiness ||
                                         _lastRoleRefreshMs == 0 ||
                                         now - _lastRoleRefreshMs >= roleInterval;
                    if (roleRefreshDue)
                    {
                        RefreshRole(session);
                        _lastRoleRefreshMs = NowMs();
                        _refreshBeforeBusiness = false;
                    }

                    if (_relayEnabled() && _role == FirestoreAgentRole.PRIMARY)
                    {
                        if (_lastLeaseWriteMs == 0 || NowMs() - _lastLeaseWriteMs >= PrimaryLeaseHeartbeatMs)
                            WritePrimaryLease(session);
                        waitMs = Math.Max(1000, PrimaryLeaseHeartbeatMs - (int)Math.Min(PrimaryLeaseHeartbeatMs, Math.Max(0L, NowMs() - _lastLeaseWriteMs)));
                    }
                    else if (_role == FirestoreAgentRole.STANDBY)
                    {
                        waitMs = CheckPrimaryLease(session);
                    }
                    else
                    {
                        waitMs = startupConvergence ? StartupConvergenceIntervalMs : 30000;
                    }

                    MaintainPresence(session);
                    if (startupConvergence ||
                        _fleetRefreshRequested ||
                        _lastPresenceReadMs == 0 ||
                        NowMs() - _lastPresenceReadMs >= PresenceReadIntervalMs)
                    {
                        ReadOnlineAgentCounts(session, NowMs());
                        _lastPresenceReadMs = NowMs();
                        _fleetRefreshRequested = false;
                    }

                    _coordinationHealthy = true;
                    if (startupConvergence) _startupConvergenceRemaining--;
                }
                catch (Exception ex)
                {
                    _coordinationHealthy = false;
                    _refreshBeforeBusiness = true;
                    _log("FIRESTORE HA coordination error role_preserved=true type=" + ex.GetType().Name +
                         " message=" + AgentDiagnostics.Sanitize(ex.Message));
                    waitMs = 3000;
                }

                var signaled = WaitHandle.WaitAny(new WaitHandle[] { token.WaitHandle, _wake }, Math.Max(1000, waitMs));
                if (signaled == 0) return;
            }
        }

        private void RefreshRole(AgentSession session)
        {
            for (var attempt = 0; attempt < 4; attempt++)
            {
                var read = ReadRoles(session);
                var snapshot = read.Snapshot;
                ApplySharedSchedule(snapshot);

                if (snapshot == null)
                {
                    if (!_relayEnabled() || !_wmsReady())
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
                        _generation = first.Generation;
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, "", "ACTIVE_FIRST");
                        WritePrimaryLease(session);
                        return;
                    }
                    continue;
                }

                if (!_relayEnabled())
                {
                    if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        var sleep = new FirestoreRoleSnapshot
                        {
                            PrimaryAgentInstanceId = "",
                            StandbyAgentInstanceId = "",
                            Generation = Guid.NewGuid().ToString("N"),
                            UpdatedAtMs = NowMs()
                        };
                        TryWriteRoles(session, sleep, read);
                    }
                    _generation = snapshot.Generation ?? "";
                    SetRole(FirestoreAgentRole.FROZEN, "", "", "RELAY_SCHEDULE_SLEEP");
                    return;
                }

                if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    _generation = snapshot.Generation ?? "";
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
                    _generation = snapshot.Generation ?? "";
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
                        _generation = primary.Generation;
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, primary.StandbyAgentInstanceId, "ACTIVE_VACANT");
                        WritePrimaryLease(session);
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
                        _generation = standby.Generation ?? "";
                        _leaseMissingSinceMs = 0;
                        SetRole(FirestoreAgentRole.STANDBY, standby.PrimaryAgentInstanceId, _instanceId, "STANDBY_SELECTED");
                        return;
                    }
                    continue;
                }

                _generation = snapshot.Generation ?? "";
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
                { "role", StringField(RoleName) },
                { "agent_build", IntField(AgentConfig.AgentBuild) }
            };
            SendJson("PATCH", PresenceSelfUrl(), session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                BuildMask(fields.Keys), 7000, false, "PRESENCE_WRITE");
            _lastPresenceWriteMs = now;
        }

        private void ReadOnlineAgentCounts(AgentSession session, long now)
        {
            var raw = SendJson("GET", PresenceCollectionUrl(), session.IdToken, null, "", 7000, true, "PRESENCE_READ");
            var root = _json.DeserializeObject(raw) as Dictionary<string, object>;
            object docsObj;
            var docs = root != null && root.TryGetValue("documents", out docsObj) ? docsObj as IEnumerable : null;
            if (docs == null)
            {
                _onlineAgentCount = 0;
                _onlinePrimaryCount = 0;
                _onlineStandbyCount = 0;
                _onlineFrozenCount = 0;
                lock (_stateGate) _onlineAgents = new List<AgentPresenceView>();
                return;
            }

            var freshIds = new HashSet<string>(StringComparer.Ordinal);
            var views = new List<AgentPresenceView>();
            foreach (var item in docs)
            {
                var doc = item as Dictionary<string, object>;
                if (doc == null) continue;
                object fieldsObj;
                var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
                if (fields == null) continue;
                var heartbeat = FieldLong(fields, "heartbeat_at_ms");
                var age = now - heartbeat;
                var agentId = FieldString(fields, "agent_instance_id");
                if (heartbeat <= 0 || age < -60000 || age > PresenceFreshMs || string.IsNullOrWhiteSpace(agentId))
                    continue;

                freshIds.Add(agentId);
                var build = FieldLong(fields, "agent_build");
                views.Add(new AgentPresenceView
                {
                    AgentInstanceId = agentId,
                    AdminUserId = FieldString(fields, "agent_admin_user_id"),
                    Machine = FieldString(fields, "machine"),
                    WmsReady = FieldBool(fields, "wms_ready"),
                    Version = build > 0 ? "v" + build : "--",
                    HeartbeatAtMs = heartbeat
                });
            }

            string primary;
            string standby;
            lock (_stateGate)
            {
                primary = _primaryId ?? "";
                standby = _standbyId ?? "";
            }

            foreach (var view in views)
            {
                view.Role = string.Equals(view.AgentInstanceId, primary, StringComparison.Ordinal)
                    ? "PRIMARY"
                    : (string.Equals(view.AgentInstanceId, standby, StringComparison.Ordinal) ? "STANDBY" : "FROZEN");
            }
            views.Sort((a, b) =>
            {
                var rankA = a.Role == "PRIMARY" ? 0 : (a.Role == "STANDBY" ? 1 : 2);
                var rankB = b.Role == "PRIMARY" ? 0 : (b.Role == "STANDBY" ? 1 : 2);
                var rank = rankA.CompareTo(rankB);
                if (rank != 0) return rank;
                return string.Compare(a.Machine ?? "", b.Machine ?? "", StringComparison.OrdinalIgnoreCase);
            });

            var primaryCount = !string.IsNullOrWhiteSpace(primary) && freshIds.Contains(primary) ? 1 : 0;
            var standbyCount = !string.IsNullOrWhiteSpace(standby) && freshIds.Contains(standby) ? 1 : 0;
            _onlineAgentCount = freshIds.Count;
            _onlinePrimaryCount = primaryCount;
            _onlineStandbyCount = standbyCount;
            _onlineFrozenCount = Math.Max(0, freshIds.Count - primaryCount - standbyCount);
            lock (_stateGate) _onlineAgents = views;
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
                        UpdatedAtMs = FieldLong(fields, "updated_at_ms"),
                        ScheduleKey = FieldString(fields, "schedule_key"),
                        ScheduleDecision = FieldString(fields, "schedule_decision"),
                        RelayOverrideUntilMs = FieldLong(fields, "relay_override_until_ms"),
                        DecisionBoundaryMs = FieldLong(fields, "decision_boundary_ms")
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
            ApplySharedSchedule(snapshot);
            if (snapshot == null)
            {
                _generation = "";
                SetRole(FirestoreAgentRole.FROZEN, "", "", reason);
                return;
            }
            _generation = snapshot.Generation ?? "";
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
                if (changed)
                {
                    _relayPollHealthy = false;
                    _lastPresenceWriteMs = 0;
                    _fleetRefreshRequested = true;
                    if (role == FirestoreAgentRole.PRIMARY) _lastLeaseWriteMs = 0;
                    if (role != FirestoreAgentRole.STANDBY) _leaseMissingSinceMs = 0;
                }
            }
            if (!changed) return;
            try { _wake.Set(); } catch { }

            _log("FIRESTORE HA role=" + role +
                 " reason=" + reason +
                 " self=" + Short(_instanceId) +
                 " primary=" + Short(primaryId) +
                 " standby=" + Short(standbyId) +
                 " failover_ms=" + FailoverAfterMs);
            _stateChanged(role, primaryId ?? "");
        }

        private void ApplySharedSchedule(FirestoreRoleSnapshot snapshot)
        {
            if (snapshot == null) return;
            SetSharedSchedule(
                snapshot.ScheduleKey ?? "",
                snapshot.ScheduleDecision ?? "",
                snapshot.DecisionBoundaryMs,
                snapshot.RelayOverrideUntilMs);
        }

        private void SetSharedSchedule(string key, string decision, long boundaryMs, long overrideUntilMs)
        {
            lock (_stateGate)
            {
                _sharedScheduleKey = key ?? "";
                _sharedScheduleDecision = decision ?? "";
                _sharedDecisionBoundaryMs = Math.Max(0L, boundaryMs);
                _sharedRelayOverrideUntilMs = Math.Max(0L, overrideUntilMs);
            }
        }

        private void WriteScheduleFields(
            AgentSession session,
            string scheduleKey,
            string decision,
            long boundaryMs,
            long overrideUntilMs)
        {
            var fields = new Dictionary<string, object>
            {
                { "schedule_key", StringField(scheduleKey ?? "") },
                { "schedule_decision", StringField(decision ?? "") },
                { "decision_boundary_ms", IntField(Math.Max(0L, boundaryMs)) },
                { "relay_override_until_ms", IntField(Math.Max(0L, overrideUntilMs)) },
                { "schedule_updated_by_agent_instance_id", StringField(_instanceId) },
                { "schedule_updated_at_ms", IntField(NowMs()) }
            };
            SendJson(
                "PATCH",
                RolesUrl(),
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                BuildMask(fields.Keys),
                7000,
                false,
                "SCHEDULE_WRITE");
        }

        private void WritePrimaryLease(AgentSession session)
        {
            if (_role != FirestoreAgentRole.PRIMARY ||
                string.IsNullOrWhiteSpace(_generation) ||
                !_relayEnabled())
                return;

            string scheduleKey;
            string scheduleDecision;
            long boundaryMs;
            long overrideUntilMs;
            lock (_stateGate)
            {
                scheduleKey = _sharedScheduleKey ?? "";
                scheduleDecision = _sharedScheduleDecision ?? "";
                boundaryMs = _sharedDecisionBoundaryMs;
                overrideUntilMs = _sharedRelayOverrideUntilMs;
            }

            var fields = new Dictionary<string, object>
            {
                { "generation", StringField(_generation) },
                { "primary_agent_instance_id", StringField(_instanceId) },
                { "heartbeat_at_ms", IntField(NowMs()) },
                { "schedule_key", StringField(scheduleKey) },
                { "schedule_decision", StringField(scheduleDecision) },
                { "decision_boundary_ms", IntField(Math.Max(0L, boundaryMs)) },
                { "relay_override_until_ms", IntField(Math.Max(0L, overrideUntilMs)) }
            };

            Exception last = null;
            for (var attempt = 1; attempt <= 2; attempt++)
            {
                try
                {
                    SendJson(
                        "PATCH",
                        LeaseUrl(_generation),
                        session.IdToken,
                        _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                        BuildMask(fields.Keys),
                        5000,
                        false,
                        "PRIMARY_LEASE_WRITE");
                    _lastLeaseWriteMs = NowMs();
                    return;
                }
                catch (Exception ex)
                {
                    last = ex;
                    if (attempt < 2) Thread.Sleep(250);
                }
            }
            throw last ?? new InvalidOperationException("Không ghi được PRIMARY lease.");
        }

        private int CheckPrimaryLease(AgentSession session)
        {
            if (_role != FirestoreAgentRole.STANDBY) return 30000;
            var generation = _generation ?? "";
            if (string.IsNullOrWhiteSpace(generation))
            {
                _refreshBeforeBusiness = true;
                return 1000;
            }

            long leaseUpdatedMs = 0;
            try
            {
                var raw = SendJson("GET", LeaseUrl(generation), session.IdToken, null, "", 5000, true, "PRIMARY_LEASE_READ");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (doc != null)
                {
                    DateTimeOffset parsed;
                    if (DateTimeOffset.TryParse(Get(doc, "updateTime"), out parsed))
                        leaseUpdatedMs = parsed.ToUnixTimeMilliseconds();

                    object fieldsObj;
                    var fields = doc.TryGetValue("fields", out fieldsObj)
                        ? fieldsObj as Dictionary<string, object>
                        : null;
                    if (fields != null)
                    {
                        SetSharedSchedule(
                            FieldString(fields, "schedule_key"),
                            FieldString(fields, "schedule_decision"),
                            FieldLong(fields, "decision_boundary_ms"),
                            FieldLong(fields, "relay_override_until_ms"));
                    }
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status != 404) throw;
            }

            if (!_relayEnabled())
            {
                _leaseMissingSinceMs = 0;
                return 30000;
            }

            var now = NowMs();
            if (leaseUpdatedMs <= 0)
            {
                if (_leaseMissingSinceMs == 0) _leaseMissingSinceMs = now;
                var missingAge = now - _leaseMissingSinceMs;
                if (missingAge >= FailoverAfterMs)
                {
                    PromoteStandbyForTakeover();
                    return 1000;
                }
                return Math.Max(1000, FailoverAfterMs - (int)Math.Min(FailoverAfterMs, Math.Max(0L, missingAge)));
            }

            _leaseMissingSinceMs = 0;
            var ageMs = Math.Max(0L, now - leaseUpdatedMs);
            if (ageMs >= FailoverAfterMs)
            {
                PromoteStandbyForTakeover();
                return 1000;
            }

            if (ageMs < 8000L)
                return Math.Max(1000, 8000 - (int)ageMs);
            return 1000;
        }

        private static string LeaseUrl(string generation)
        {
            return DocumentsBase + "/relay_poc_coordination/lease_" + Uri.EscapeDataString(generation ?? "");
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
