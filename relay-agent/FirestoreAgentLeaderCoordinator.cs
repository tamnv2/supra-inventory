using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal enum FirestoreAgentRole
    {
        DEEP_HIBERNATE = 0,
        NEXT_B = 1,
        NEXT_A = 2,
        PRIMARY = 3
    }

    internal sealed class FirestoreRoleSnapshot
    {
        internal string PrimaryAgentInstanceId = "";
        internal string StandbyAgentInstanceId = ""; // D131 NEXT_A compatibility field in code
        internal string NextBAgentInstanceId = "";
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
        internal string Role = "DEEP_HIBERNATE";
        internal string Version = "";
        internal bool WmsReady;
        internal long HeartbeatAtMs;
    }

    internal sealed class FirestoreAgentLeaderCoordinator : IDisposable
    {
        internal const int FailoverAfterMs = 15000;
        internal const int StandbyTakeoverAgeMs = 15000;
        internal const int PrimaryLeaseHeartbeatMs = 10000;
        internal const int PrimaryRoleRefreshMs = 60000;
        internal const int NextARoleRefreshMs = 60000;
        internal const int NextBRoleRefreshMs = 120000;
        internal const int DeepHibernateRoleRefreshMs = 600000;
        internal const int StartupConvergenceIntervalMs = 5000;
        internal const int StartupConvergenceCycles = 4;
        internal const int PresenceHeartbeatIntervalMs = 600000;
        internal const int PresenceReadIntervalMs = 600000;
        internal const int PresenceFreshMs = 1500000;

        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly Func<bool> _wmsReady;
        private readonly Func<bool> _takeoverWmsProbe;
        private readonly Func<bool> _targetHandoffWmsProbe;
        private readonly Func<bool> _relayEnabled;
        private readonly string _instanceId;
        private readonly Action<string> _log;
        private readonly Action<FirestoreAgentRole, string> _stateChanged;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly object _stateGate = new object();
        private readonly AutoResetEvent _wake = new AutoResetEvent(false);
        private readonly RtdbHaLiveness _rtdbLiveness;

        private CancellationTokenSource _cts;
        private volatile FirestoreAgentRole _role = FirestoreAgentRole.DEEP_HIBERNATE;
        private string _primaryId = "";
        private string _standbyId = "";
        private string _nextBId = "";
        private long _lastPresenceWriteMs;
        private long _lastPresenceReadMs;
        private volatile int _onlineAgentCount;
        private volatile int _onlinePrimaryCount;
        private volatile int _onlineStandbyCount;
        private volatile int _onlineNextBCount;
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
            Func<bool> targetHandoffWmsProbe,
            Func<bool> relayEnabled,
            string instanceId,
            Action<string> log,
            Action<FirestoreAgentRole, string> stateChanged)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _wmsReady = wmsReady;
            _takeoverWmsProbe = takeoverWmsProbe ?? (() => false);
            _targetHandoffWmsProbe = targetHandoffWmsProbe ?? _takeoverWmsProbe;
            _relayEnabled = relayEnabled ?? (() => true);
            _instanceId = instanceId ?? "";
            _log = log ?? delegate { };
            _stateChanged = stateChanged ?? delegate { };
            _rtdbLiveness = new RtdbHaLiveness(_instanceId, _log, () =>
            {
                try { _wake.Set(); } catch { }
            });
        }

        internal bool IsLeader { get { return _role == FirestoreAgentRole.PRIMARY; } }
        internal bool IsStandby { get { return _role == FirestoreAgentRole.NEXT_A; } }
        internal bool IsNextA { get { return _role == FirestoreAgentRole.NEXT_A; } }
        internal bool IsNextB { get { return _role == FirestoreAgentRole.NEXT_B; } }
        internal bool IsFrozen { get { return _role == FirestoreAgentRole.DEEP_HIBERNATE; } }
        internal bool IsDeepHibernate { get { return _role == FirestoreAgentRole.DEEP_HIBERNATE; } }
        internal FirestoreAgentRole Role { get { return _role; } }
        internal string Generation
        {
            get { lock (_stateGate) return _generation ?? ""; }
        }
        internal string RoleName { get { return _role.ToString(); } }
        internal bool CanPollBusiness { get { return _relayEnabled() && _role == FirestoreAgentRole.PRIMARY; } }
        internal bool IsTransportHealthy
        {
            get
            {
                // D158: only PRIMARY owns the business queue poll. NEXT_A/NEXT_B are
                // healthy when HA coordination is healthy; their lack of PRIMARY poll
                // success must never be rendered as "Mất kết nối".
                return _coordinationHealthy &&
                       (_role != FirestoreAgentRole.PRIMARY || _relayPollHealthy);
            }
        }
        internal int OnlineAgentCount { get { return Math.Max(0, _onlineAgentCount); } }
        internal int OnlinePrimaryCount { get { return Math.Max(0, _onlinePrimaryCount); } }
        internal int OnlineStandbyCount { get { return Math.Max(0, _onlineStandbyCount); } }
        internal int OnlineNextBCount { get { return Math.Max(0, _onlineNextBCount); } }
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

        internal void ApplySyncedFleet(IEnumerable<AgentPresenceView> fleet)
        {
            var views = new List<AgentPresenceView>();
            foreach (var item in fleet ?? new AgentPresenceView[0])
            {
                if (item == null || string.IsNullOrWhiteSpace(item.AgentInstanceId)) continue;
                views.Add(item);
                if (views.Count >= FirestoreAgentSyncClient.MaxAgents) break;
            }
            lock (_stateGate) _onlineAgents = views;
            _onlineAgentCount = views.Count;
            _onlinePrimaryCount = views.Count(x => string.Equals(x.Role, "PRIMARY", StringComparison.Ordinal));
            _onlineStandbyCount = views.Count(x => string.Equals(x.Role, "NEXT_A", StringComparison.Ordinal));
            _onlineNextBCount = views.Count(x => string.Equals(x.Role, "NEXT_B", StringComparison.Ordinal));
            _onlineFrozenCount = Math.Max(0, views.Count - _onlinePrimaryCount - _onlineStandbyCount - _onlineNextBCount);
        }

        internal string CurrentLeaderId
        {
            get { lock (_stateGate) return _primaryId; }
        }

        internal string CurrentStandbyId
        {
            get { lock (_stateGate) return _standbyId; }
        }

        internal string CurrentNextBId
        {
            get { lock (_stateGate) return _nextBId; }
        }

        internal int BusinessPollIntervalMs
        {
            get
            {
                if (_role == FirestoreAgentRole.PRIMARY) return FirestoreConfirmationTransport.PrimaryInactivePollIntervalMs;
                if (_role == FirestoreAgentRole.NEXT_A) return 5000;
                if (_role == FirestoreAgentRole.NEXT_B) return 30000;
                return 60000;
            }
        }

        internal bool CanProcessJob(long createdAtMs)
        {
            return _relayEnabled() && _role == FirestoreAgentRole.PRIMARY;
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
                _log("D160_DIAG HA refresh_before_business=ARMED trigger=RELAY_POLL_UNHEALTHY role=" + RoleName);
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
            var started = NowMs();
            var before = RoleName;
            _log("D160_DIAG HA role_refresh=START trigger=REFRESH_BEFORE_BUSINESS role_before=" + before);
            RefreshRole(session);
            _lastRoleRefreshMs = NowMs();
            _refreshBeforeBusiness = false;
            _log("D160_DIAG HA role_refresh=END trigger=REFRESH_BEFORE_BUSINESS role_before=" + before +
                 " role_after=" + RoleName +
                 " elapsed_ms=" + Math.Max(0L, NowMs() - started));
        }

        internal bool VerifyPrimaryForBusinessIngress(AgentSession session)
        {
            if (!_relayEnabled() || _role != FirestoreAgentRole.PRIMARY) return false;
            var read = ReadRoles(session);
            ApplySharedSchedule(read.Snapshot);
            var snapshot = read.Snapshot;
            if (snapshot == null ||
                !string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(snapshot.Generation) ||
                !string.Equals(snapshot.Generation, _generation, StringComparison.Ordinal))
            {
                ApplySnapshot(snapshot, "INGRESS_FENCE_CHANGED");
                return false;
            }
            if (!_relayEnabled()) return false;
            _lastRoleRefreshMs = NowMs();
            _refreshBeforeBusiness = false;
            return true;
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
            // D158: this authoritative roles read already proves the current PRIMARY
            // generation. Reuse it as the scheduled role-refresh proof instead of
            // issuing another GET seconds later.
            _lastRoleRefreshMs = NowMs();
            _refreshBeforeBusiness = false;
            return true;
        }

        internal bool RefreshSharedScheduleNow()
        {
            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                var read = ReadRoles(session);
                ApplySharedSchedule(read.Snapshot);
                return read.Snapshot != null;
            }
            catch (Exception ex)
            {
                _log("FIRESTORE SCHEDULE refresh=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
                return false;
            }
        }

        internal bool PublishScheduleDecision(
            string scheduleKey,
            long boundaryMs,
            string decision,
            long relayOverrideUntilMs)
        {
            if (string.IsNullOrWhiteSpace(scheduleKey) || boundaryMs <= 0) return false;
            if (string.IsNullOrWhiteSpace(decision)) return false;
            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var current = read.Snapshot;
                    ApplySharedSchedule(current);

                    if (current != null &&
                        string.Equals(current.ScheduleKey ?? "", scheduleKey, StringComparison.Ordinal) &&
                        current.DecisionBoundaryMs == boundaryMs &&
                        !string.IsNullOrWhiteSpace(current.ScheduleDecision))
                    {
                        _log("FIRESTORE SCHEDULE decision=EXISTING boundary_ms=" + boundaryMs +
                             " existing=" + AgentDiagnostics.Sanitize(current.ScheduleDecision));
                        return string.Equals(current.ScheduleDecision, decision, StringComparison.Ordinal);
                    }

                    if (!TryWriteScheduleFields(session, scheduleKey, decision, boundaryMs, relayOverrideUntilMs, read))
                        continue;

                    SetSharedSchedule(scheduleKey, decision, boundaryMs, relayOverrideUntilMs);
                    if (_role == FirestoreAgentRole.PRIMARY) WritePrimaryLease(session);
                    TryPublishOperatingScheduleProjection(session, scheduleKey, decision, boundaryMs, relayOverrideUntilMs);
                    _log("FIRESTORE SCHEDULE decision=" + AgentDiagnostics.Sanitize(decision ?? "") +
                         " boundary_ms=" + boundaryMs +
                         " relay_until_ms=" + relayOverrideUntilMs +
                         " by=ANY_AUTHENTICATED_AGENT role=" + _role);
                    try { _wake.Set(); } catch { }
                    return true;
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE SCHEDULE write=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }


        // D161: one explicit +1h action is applied against the freshest
        // shared schedule snapshot under Firestore updateTime CAS. If another
        // Agent wins the CAS first, retry recomputes from that newer end time,
        // so no stale write can shorten an active override.
        internal bool PublishOvertimeExtension(
            string scheduleKey,
            long requestedAtMs,
            long cutoffMs)
        {
            if (string.IsNullOrWhiteSpace(scheduleKey) ||
                requestedAtMs <= 0 ||
                cutoffMs <= requestedAtMs)
                return false;

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var current = read.Snapshot;
                    ApplySharedSchedule(current);

                    var basis = requestedAtMs;
                    if (current != null &&
                        string.Equals(current.ScheduleKey ?? "", scheduleKey, StringComparison.Ordinal) &&
                        current.RelayOverrideUntilMs > requestedAtMs)
                        basis = current.RelayOverrideUntilMs;

                    if (basis >= cutoffMs)
                    {
                        if (current != null)
                            TryPublishOperatingScheduleProjection(
                                session, scheduleKey, "MANUAL_ADJUST",
                                current.DecisionBoundaryMs > 0 ? current.DecisionBoundaryMs : requestedAtMs,
                                current.RelayOverrideUntilMs);
                        return true;
                    }

                    var target = Math.Min(cutoffMs, basis + 60L * 60L * 1000L);
                    if (!TryWriteScheduleFields(
                        session, scheduleKey, "MANUAL_ADJUST", requestedAtMs, target, read))
                        continue;

                    SetSharedSchedule(scheduleKey, "MANUAL_ADJUST", requestedAtMs, target);
                    if (_role == FirestoreAgentRole.PRIMARY) WritePrimaryLease(session);
                    TryPublishOperatingScheduleProjection(
                        session, scheduleKey, "MANUAL_ADJUST", requestedAtMs, target);
                    _log("FIRESTORE SCHEDULE d161_extend=PASS at_ms=" + requestedAtMs +
                         " relay_until_ms=" + target +
                         " cutoff_ms=" + cutoffMs +
                         " role=" + _role);
                    try { _wake.Set(); } catch { }
                    return true;
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE SCHEDULE d161_extend=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }

        internal bool PublishManualScheduleAdjustment(
            string scheduleKey,
            long adjustmentAtMs,
            long relayOverrideUntilMs)
        {
            if (string.IsNullOrWhiteSpace(scheduleKey) ||
                adjustmentAtMs <= 0 ||
                relayOverrideUntilMs <= NowMs())
                return false;

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var current = read.Snapshot;
                    ApplySharedSchedule(current);

                    if (current != null &&
                        string.Equals(current.ScheduleKey ?? "", scheduleKey, StringComparison.Ordinal) &&
                        current.RelayOverrideUntilMs >= relayOverrideUntilMs)
                    {
                        // D154: an explicit repeated action may repair a missed low-frequency
                        // projection without adding any timer, listener or retry loop.
                        TryPublishOperatingScheduleProjection(
                            session,
                            current.ScheduleKey ?? scheduleKey,
                            string.IsNullOrWhiteSpace(current.ScheduleDecision) ? "MANUAL_ADJUST" : current.ScheduleDecision,
                            current.DecisionBoundaryMs > 0 ? current.DecisionBoundaryMs : adjustmentAtMs,
                            current.RelayOverrideUntilMs);
                        _log("FIRESTORE SCHEDULE manual_adjust=REPROJECT existing_until_ms=" +
                             current.RelayOverrideUntilMs);
                        return true;
                    }

                    if (!TryWriteScheduleFields(
                        session, scheduleKey, "MANUAL_ADJUST", adjustmentAtMs,
                        relayOverrideUntilMs, read))
                        continue;

                    SetSharedSchedule(scheduleKey, "MANUAL_ADJUST", adjustmentAtMs, relayOverrideUntilMs);
                    if (_role == FirestoreAgentRole.PRIMARY) WritePrimaryLease(session);
                    TryPublishOperatingScheduleProjection(
                        session, scheduleKey, "MANUAL_ADJUST", adjustmentAtMs, relayOverrideUntilMs);
                    _log("FIRESTORE SCHEDULE manual_adjust=PASS at_ms=" + adjustmentAtMs +
                         " relay_until_ms=" + relayOverrideUntilMs +
                         " role=" + _role);
                    try { _wake.Set(); } catch { }
                    return true;
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE SCHEDULE manual_adjust=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }

        internal bool PublishCancelOvertime(string scheduleKey, long cancelAtMs)
        {
            if (string.IsNullOrWhiteSpace(scheduleKey) || cancelAtMs <= 0)
                return false;

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var current = read.Snapshot;
                    ApplySharedSchedule(current);

                    if (!TryWriteScheduleFields(
                        session, scheduleKey, "CANCEL_OVERTIME", cancelAtMs, cancelAtMs, read))
                        continue;

                    SetSharedSchedule(scheduleKey, "CANCEL_OVERTIME", cancelAtMs, cancelAtMs);
                    if (_role == FirestoreAgentRole.PRIMARY) WritePrimaryLease(session);
                    TryPublishOperatingScheduleProjection(
                        session, scheduleKey, "CANCEL_OVERTIME", cancelAtMs, cancelAtMs);
                    _log("FIRESTORE SCHEDULE cancel_overtime=PASS at_ms=" + cancelAtMs +
                         " role=" + _role);
                    try { _wake.Set(); } catch { }
                    return true;
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE SCHEDULE cancel_overtime=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }


        internal bool PublishEarlyStartAndClaimPrimary(string scheduleKey, long relayOverrideUntilMs)
        {
            if (!_wmsReady() || string.IsNullOrWhiteSpace(scheduleKey) || relayOverrideUntilMs <= NowMs())
                return false;
            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();

                // D149: early start follows the same first-writer-wins schedule CAS.
                // It must never seize PRIMARY merely because a user clicked first;
                // HA role ownership remains governed by the existing roles/lease model.
                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var current = read.Snapshot;
                    ApplySharedSchedule(current);

                    if (current != null &&
                        string.Equals(current.ScheduleKey ?? "", scheduleKey, StringComparison.Ordinal) &&
                        string.Equals(current.ScheduleDecision ?? "", "EARLY_START", StringComparison.Ordinal) &&
                        current.RelayOverrideUntilMs >= relayOverrideUntilMs)
                    {
                        _log("FIRESTORE SCHEDULE early_start=EXISTING relay_until_ms=" +
                             current.RelayOverrideUntilMs);
                        return true;
                    }

                    if (!TryWriteScheduleFields(
                        session, scheduleKey, "EARLY_START", 0L, relayOverrideUntilMs, read))
                        continue;

                    SetSharedSchedule(scheduleKey, "EARLY_START", 0L, relayOverrideUntilMs);
                    if (_role == FirestoreAgentRole.PRIMARY) WritePrimaryLease(session);
                    TryPublishOperatingScheduleProjection(
                        session, scheduleKey, "EARLY_START", 0L, relayOverrideUntilMs);
                    _refreshBeforeBusiness = true;
                    try { _wake.Set(); } catch { }
                    _log("FIRESTORE SCHEDULE early_start=PASS relay_until_ms=" +
                         relayOverrideUntilMs + " role=" + _role +
                         " primary_authority=EXISTING_HA");
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

            try { _rtdbLiveness.StopObserver(); } catch { }
            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (cts != null) cts.Dispose(); } catch { }
            try { _wake.Set(); } catch { }
            SetRole(FirestoreAgentRole.DEEP_HIBERNATE, "", "", "STOPPED");
        }

        public void Dispose() { Stop(); }

        internal bool PromoteStandbyForTakeover()
        {
            if (_role == FirestoreAgentRole.PRIMARY) return true;
            if (_role != FirestoreAgentRole.NEXT_A || !_relayEnabled() || !_wmsReady()) return false;

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
                        StandbyAgentInstanceId = read.Snapshot.NextBAgentInstanceId ?? "",
                        NextBAgentInstanceId = "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, next, read))
                    {
                        _generation = next.Generation;
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, next.StandbyAgentInstanceId, "ACTIVE_FAILOVER_LEASE");
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

        internal bool PromoteManualPrimary()
        {
            if (_role == FirestoreAgentRole.PRIMARY) return true;
            if (!_relayEnabled() || !_wmsReady()) return false;

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();
                if (!IsManualTakeoverUser(session))
                {
                    _log("FIRESTORE HA manual_takeover=DENY reason=USER_NOT_ALLOWED");
                    return false;
                }
                if (!_takeoverWmsProbe())
                {
                    _log("FIRESTORE HA manual_takeover=DEFER reason=WMS_PROBE_NOT_READY");
                    return false;
                }

                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var current = read.Snapshot;
                    ApplySharedSchedule(current);
                    if (!_relayEnabled() || !_wmsReady()) return false;

                    if (current != null &&
                        string.Equals(current.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        _generation = current.Generation ?? "";
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, current.StandbyAgentInstanceId, "MANUAL_ALREADY_PRIMARY");
                        WritePrimaryLease(session);
                        return true;
                    }

                    var fresh = QueryFreshPresence(session, "MANUAL_TAKEOVER_DISCOVERY", NowMs(), FirestoreAgentSyncClient.MaxAgents);
                    var readyIds = new HashSet<string>(
                        fresh.Where(item => item != null && item.WmsReady).Select(item => item.AgentInstanceId),
                        StringComparer.Ordinal);
                    var candidates = new List<string>();
                    Action<string> addCandidate = id =>
                    {
                        if (string.IsNullOrWhiteSpace(id) ||
                            string.Equals(id, _instanceId, StringComparison.Ordinal) ||
                            !readyIds.Contains(id) ||
                            candidates.Contains(id)) return;
                        candidates.Add(id);
                    };

                    var previousPrimary = current == null ? "" : (current.PrimaryAgentInstanceId ?? "");
                    if (current != null && IsCurrentPrimaryLeaseFresh(session, current) && readyIds.Contains(previousPrimary))
                        addCandidate(previousPrimary);
                    if (current != null)
                    {
                        addCandidate(current.StandbyAgentInstanceId);
                        addCandidate(current.NextBAgentInstanceId);
                    }

                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = candidates.Count > 0 ? candidates[0] : "",
                        NextBAgentInstanceId = candidates.Count > 1 ? candidates[1] : "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (!TryWriteRoles(session, next, read)) continue;

                    _generation = next.Generation;
                    lock (_stateGate) _nextBId = next.NextBAgentInstanceId ?? "";
                    SetRole(FirestoreAgentRole.PRIMARY, _instanceId, next.StandbyAgentInstanceId, "MANUAL_OWNER_TAKEOVER");
                    WritePrimaryLease(session);
                    _fleetRefreshRequested = true;
                    _log("FIRESTORE HA manual_takeover=PASS self=" + Short(_instanceId) +
                         " previous_primary=" + Short(previousPrimary) +
                         " next_a=" + Short(next.StandbyAgentInstanceId) +
                         " next_b=" + Short(next.NextBAgentInstanceId));
                    TrySelectReplacementStandby(session, "");
                    return true;
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE HA manual_takeover=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }

        internal List<AgentPresenceView> GetFreshAgentsForManualHandoff()
        {
            _ensureFreshToken();
            var session = _sessionProvider();
            if (!IsManualTakeoverUser(session))
                throw new InvalidOperationException("Tài khoản này không có quyền chuyển Agent chính.");
            return QueryFreshPresence(
                session,
                "D157_HANDOFF_DISCOVERY",
                NowMs(),
                FirestoreAgentSyncClient.MaxAgents);
        }

        internal bool PromoteTargetedPrimaryHandoff(
            D157PrimaryHandoffRequest request,
            out string detail,
            out string generation)
        {
            detail = "";
            generation = "";
            if (request == null ||
                !string.Equals(request.Status, "PENDING", StringComparison.Ordinal) ||
                !string.Equals(request.TargetAgentInstanceId, _instanceId, StringComparison.Ordinal))
            {
                detail = "REQUEST_NOT_FOR_THIS_AGENT";
                return false;
            }
            if (!IsManualTakeoverLogin(request.RequesterLogin))
            {
                detail = "REQUESTER_NOT_ALLOWED";
                return false;
            }
            if (request.ExpiresAtMs <= NowMs())
            {
                detail = "REQUEST_EXPIRED";
                return false;
            }
            if (!_relayEnabled() || !_wmsReady())
            {
                detail = "TARGET_NOT_READY";
                return false;
            }

            try
            {
                _ensureFreshToken();
                var session = _sessionProvider();

                // D157: the target proves the real WMS session on its own machine
                // immediately before accepting PRIMARY. The delegate performs the
                // protected D137 Page.reload/F5 path, not a DOM-only probe.
                if (!_targetHandoffWmsProbe())
                {
                    detail = "WMS_REAL_RELOAD_NOT_READY";
                    _log("FIRESTORE HA targeted_handoff=DEFER reason=" + detail);
                    return false;
                }

                for (var attempt = 0; attempt < 4; attempt++)
                {
                    var read = ReadRoles(session);
                    var current = read.Snapshot;
                    ApplySharedSchedule(current);
                    if (!_relayEnabled() || !_wmsReady())
                    {
                        detail = "TARGET_LOST_READINESS";
                        return false;
                    }

                    if (current != null &&
                        string.Equals(current.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                    {
                        _generation = current.Generation ?? "";
                        generation = _generation;
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, current.StandbyAgentInstanceId, "D157_HANDOFF_ALREADY_PRIMARY");
                        WritePrimaryLease(session);
                        detail = "ALREADY_PRIMARY";
                        return true;
                    }

                    var fresh = QueryFreshPresence(
                        session,
                        "D157_HANDOFF_TARGET_DISCOVERY",
                        NowMs(),
                        FirestoreAgentSyncClient.MaxAgents);
                    var readyIds = new HashSet<string>(
                        fresh.Where(item => item != null && item.WmsReady)
                             .Select(item => item.AgentInstanceId),
                        StringComparer.Ordinal);
                    // The target just passed a real local reload, so do not reject it
                    // merely because the coarse 10-minute presence projection still
                    // carries the previous readiness value.
                    readyIds.Add(_instanceId);

                    var candidates = new List<string>();
                    Action<string> addCandidate = id =>
                    {
                        if (string.IsNullOrWhiteSpace(id) ||
                            string.Equals(id, _instanceId, StringComparison.Ordinal) ||
                            !readyIds.Contains(id) ||
                            candidates.Contains(id)) return;
                        candidates.Add(id);
                    };

                    var previousPrimary = current == null ? "" : (current.PrimaryAgentInstanceId ?? "");
                    if (current != null &&
                        IsCurrentPrimaryLeaseFresh(session, current) &&
                        readyIds.Contains(previousPrimary))
                        addCandidate(previousPrimary);
                    if (current != null)
                    {
                        addCandidate(current.StandbyAgentInstanceId);
                        addCandidate(current.NextBAgentInstanceId);
                    }

                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = candidates.Count > 0 ? candidates[0] : "",
                        NextBAgentInstanceId = candidates.Count > 1 ? candidates[1] : "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (!TryWriteRoles(session, next, read)) continue;

                    _generation = next.Generation;
                    generation = next.Generation;
                    lock (_stateGate) _nextBId = next.NextBAgentInstanceId ?? "";
                    SetRole(
                        FirestoreAgentRole.PRIMARY,
                        _instanceId,
                        next.StandbyAgentInstanceId,
                        "D157_TARGETED_OWNER_HANDOFF");
                    WritePrimaryLease(session);
                    _fleetRefreshRequested = true;
                    _log("FIRESTORE HA targeted_handoff=PASS request=" + Short(request.RequestId) +
                         " self=" + Short(_instanceId) +
                         " previous_primary=" + Short(previousPrimary) +
                         " next_a=" + Short(next.StandbyAgentInstanceId) +
                         " next_b=" + Short(next.NextBAgentInstanceId));
                    TrySelectReplacementStandby(session, "");
                    detail = "PRIMARY_TRANSFERRED";
                    return true;
                }

                detail = "CAS_RETRY_EXHAUSTED";
            }
            catch (Exception ex)
            {
                detail = "TARGET_ERROR_" + ex.GetType().Name;
                _log("FIRESTORE HA targeted_handoff=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
            return false;
        }

        private static bool IsManualTakeoverLogin(string login)
        {
            var value = (login ?? "").Trim();
            return string.Equals(value, "tamnv2", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(value, "admin", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsManualTakeoverUser(AgentSession session)
        {
            var login = session == null ? "" : (session.LoginName ?? "").Trim();
            return IsManualTakeoverLogin(login);
        }

        private bool IsCurrentPrimaryLeaseFresh(AgentSession session, FirestoreRoleSnapshot snapshot)
        {
            if (snapshot == null ||
                string.IsNullOrWhiteSpace(snapshot.Generation) ||
                string.IsNullOrWhiteSpace(snapshot.PrimaryAgentInstanceId)) return false;
            try
            {
                var raw = SendJson("GET", LeaseUrl(snapshot.Generation), session.IdToken, null, "", 5000, true, "MANUAL_TAKEOVER_LEASE_READ");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (doc == null) return false;
                DateTimeOffset updated;
                if (!DateTimeOffset.TryParse(Get(doc, "updateTime"), out updated)) return false;
                var age = Math.Max(0L, NowMs() - updated.ToUnixTimeMilliseconds());
                object fieldsObj;
                var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
                return age <= FailoverAfterMs &&
                       fields != null &&
                       string.Equals(FieldString(fields, "primary_agent_instance_id"), snapshot.PrimaryAgentInstanceId, StringComparison.Ordinal) &&
                       string.Equals(FieldString(fields, "generation"), snapshot.Generation, StringComparison.Ordinal);
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 404) return false;
                throw;
            }
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
                    var roleInterval = _role == FirestoreAgentRole.DEEP_HIBERNATE
                        ? DeepHibernateRoleRefreshMs
                        : (_role == FirestoreAgentRole.NEXT_A
                            ? NextARoleRefreshMs
                            : (_role == FirestoreAgentRole.NEXT_B
                                ? NextBRoleRefreshMs
                                : (!_wmsReady() ? FirestoreConfirmationTransport.PrimaryInactivePollIntervalMs : PrimaryRoleRefreshMs)));
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
                        _rtdbLiveness.StopObserver();
                        if (_lastLeaseWriteMs == 0 || NowMs() - _lastLeaseWriteMs >= PrimaryLeaseHeartbeatMs)
                        {
                            if (_rtdbLiveness.WriteHeartbeat(session, _generation))
                                _lastLeaseWriteMs = NowMs();
                            else
                                WritePrimaryLease(session);
                        }
                        waitMs = Math.Max(1000, PrimaryLeaseHeartbeatMs - (int)Math.Min(PrimaryLeaseHeartbeatMs, Math.Max(0L, NowMs() - _lastLeaseWriteMs)));
                    }
                    else if (_role == FirestoreAgentRole.NEXT_A)
                    {
                        _rtdbLiveness.EnsureObserver(session, _generation, _primaryId);
                        long livenessAgeMs;
                        if (_rtdbLiveness.TryGetFresh(_generation, _primaryId, out livenessAgeMs))
                        {
                            _leaseMissingSinceMs = 0;
                            waitMs = Math.Max(1000, FailoverAfterMs - (int)Math.Min(FailoverAfterMs, Math.Max(0L, livenessAgeMs)));
                        }
                        else
                        {
                            // RTDB is liveness only. Any stale/missing/uncertain signal
                            // re-enters the accepted Firestore lease path, which verifies
                            // generation/PRIMARY authority before takeover.
                            waitMs = CheckPrimaryLease(session);
                        }
                    }
                    else if (_role == FirestoreAgentRole.NEXT_B)
                    {
                        _rtdbLiveness.StopObserver();
                        waitMs = startupConvergence ? StartupConvergenceIntervalMs : 60000;
                    }
                    else
                    {
                        _rtdbLiveness.StopObserver();
                        waitMs = startupConvergence ? StartupConvergenceIntervalMs : 600000;
                    }

                    MaintainPresence(session);
                    // D150: only PRIMARY scans the fresh Agent-presence projection. NEXT_A/NEXT_B
                    // receive the compact agent_sync document through the D140 listener; DEEP
                    // performs a coarse exact agent_sync read in the UI layer. This removes the
                    // previous N x N fleet collection scan without weakening lease/failover.
                    if (_role == FirestoreAgentRole.PRIMARY &&
                        (_fleetRefreshRequested ||
                         _lastPresenceReadMs == 0 ||
                         NowMs() - _lastPresenceReadMs >= PresenceReadIntervalMs))
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
                lock (_stateGate) _nextBId = snapshot == null ? "" : (snapshot.NextBAgentInstanceId ?? "");

                if (snapshot == null)
                {
                    if (!_relayEnabled())
                    {
                        SetRole(FirestoreAgentRole.DEEP_HIBERNATE, "", "", "RELAY_SCHEDULE_SLEEP");
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
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, "", _wmsReady() ? "ACTIVE_FIRST" : "DEGRADED_RECEIVER_FIRST");
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
                    SetRole(FirestoreAgentRole.DEEP_HIBERNATE, "", "", "RELAY_SCHEDULE_SLEEP");
                    return;
                }

                if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    _generation = snapshot.Generation ?? "";
                    if (!_wmsReady())
                    {
                        // D161 repair: if no ready standby exists, retain one PRIMARY as
                        // a degraded receiver. It may consume/ACK PDA requests with the
                        // explicit WMS_SESSION_REQUIRED terminal result, while the D160
                        // business pipeline still blocks WMS mutation until browser-ready.
                        if (string.IsNullOrWhiteSpace(snapshot.StandbyAgentInstanceId))
                        {
                            SetRole(FirestoreAgentRole.PRIMARY, _instanceId, "", "PRIMARY_DEGRADED_RECEIVER");
                            return;
                        }

                        var relinquish = new FirestoreRoleSnapshot
                        {
                            PrimaryAgentInstanceId = snapshot.StandbyAgentInstanceId ?? "",
                            StandbyAgentInstanceId = snapshot.NextBAgentInstanceId ?? "",
                            NextBAgentInstanceId = "",
                            Generation = Guid.NewGuid().ToString("N"),
                            UpdatedAtMs = NowMs()
                        };
                        if (TryWriteRoles(session, relinquish, read))
                        {
                            SetRole(FirestoreAgentRole.DEEP_HIBERNATE, relinquish.PrimaryAgentInstanceId, relinquish.StandbyAgentInstanceId, "PRIMARY_WMS_NOT_READY");
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
                            StandbyAgentInstanceId = snapshot.NextBAgentInstanceId ?? "",
                            NextBAgentInstanceId = "",
                            Generation = snapshot.Generation,
                            UpdatedAtMs = NowMs()
                        };
                        if (TryWriteRoles(session, clearStandby, read))
                        {
                            SetRole(FirestoreAgentRole.DEEP_HIBERNATE, clearStandby.PrimaryAgentInstanceId, clearStandby.StandbyAgentInstanceId, "NEXT_A_WMS_NOT_READY");
                            return;
                        }
                        continue;
                    }
                    SetRole(FirestoreAgentRole.NEXT_A, snapshot.PrimaryAgentInstanceId, _instanceId, "NEXT_A");
                    return;
                }

                if (string.Equals(snapshot.NextBAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    _generation = snapshot.Generation ?? "";
                    if (!_wmsReady())
                    {
                        var clearNextB = new FirestoreRoleSnapshot
                        {
                            PrimaryAgentInstanceId = snapshot.PrimaryAgentInstanceId,
                            StandbyAgentInstanceId = snapshot.StandbyAgentInstanceId,
                            NextBAgentInstanceId = "",
                            Generation = snapshot.Generation,
                            UpdatedAtMs = NowMs()
                        };
                        if (TryWriteRoles(session, clearNextB, read))
                        {
                            SetRole(FirestoreAgentRole.DEEP_HIBERNATE, clearNextB.PrimaryAgentInstanceId, clearNextB.StandbyAgentInstanceId, "NEXT_B_WMS_NOT_READY");
                            return;
                        }
                        continue;
                    }
                    SetRole(FirestoreAgentRole.NEXT_B, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, "NEXT_B");
                    return;
                }

                if (string.IsNullOrWhiteSpace(snapshot.PrimaryAgentInstanceId))
                {
                    var primary = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = snapshot.StandbyAgentInstanceId,
                        NextBAgentInstanceId = snapshot.NextBAgentInstanceId,
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, primary, read))
                    {
                        _generation = primary.Generation;
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, primary.StandbyAgentInstanceId, _wmsReady() ? "ACTIVE_VACANT" : "DEGRADED_RECEIVER_VACANT");
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
                        NextBAgentInstanceId = snapshot.NextBAgentInstanceId,
                        Generation = snapshot.Generation,
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, standby, read))
                    {
                        _generation = standby.Generation ?? "";
                        _leaseMissingSinceMs = 0;
                        SetRole(FirestoreAgentRole.NEXT_A, standby.PrimaryAgentInstanceId, _instanceId, "STANDBY_SELECTED");
                        return;
                    }
                    continue;
                }

                if (string.IsNullOrWhiteSpace(snapshot.NextBAgentInstanceId) && _wmsReady())
                {
                    var nextB = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = snapshot.PrimaryAgentInstanceId,
                        StandbyAgentInstanceId = snapshot.StandbyAgentInstanceId,
                        NextBAgentInstanceId = _instanceId,
                        Generation = snapshot.Generation,
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, nextB, read))
                    {
                        _generation = nextB.Generation ?? "";
                        SetRole(FirestoreAgentRole.NEXT_B, nextB.PrimaryAgentInstanceId, nextB.StandbyAgentInstanceId, "NEXT_B_SELECTED");
                        return;
                    }
                    continue;
                }

                _generation = snapshot.Generation ?? "";
                SetRole(FirestoreAgentRole.DEEP_HIBERNATE, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, "DEEP_HIBERNATE");
                return;
            }

            throw new InvalidOperationException("Không ổn định được vai trò Agent sau nhiều lần cạnh tranh.");
        }

        private void TrySelectReplacementStandby(AgentSession session, string excludedAgentId)
        {
            try
            {
                var fresh = QueryFreshPresence(session, "NEXT_AB_DISCOVERY", NowMs(), FirestoreAgentSyncClient.MaxAgents);
                var candidates = new List<string>();
                foreach (var view in fresh)
                {
                    var agentId = view == null ? "" : (view.AgentInstanceId ?? "");
                    if (string.IsNullOrWhiteSpace(agentId) ||
                        string.Equals(agentId, _instanceId, StringComparison.Ordinal) ||
                        string.Equals(agentId, excludedAgentId ?? "", StringComparison.Ordinal) ||
                        view == null || !view.WmsReady)
                        continue;
                    if (!candidates.Contains(agentId)) candidates.Add(agentId);
                }
                candidates.Sort(StringComparer.Ordinal);
                if (candidates.Count > FirestoreAgentSyncClient.MaxAgents - 1)
                    candidates.RemoveRange(
                        FirestoreAgentSyncClient.MaxAgents - 1,
                        candidates.Count - (FirestoreAgentSyncClient.MaxAgents - 1));
                if (candidates.Count == 0)
                {
                    _log("FIRESTORE HA next_ab=NONE available_candidate=false");
                    return;
                }

                for (var attempt = 0; attempt < 3; attempt++)
                {
                    var roles = ReadRoles(session);
                    var current = roles.Snapshot;
                    if (current == null ||
                        !string.Equals(current.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                        return;

                    var nextA = current.StandbyAgentInstanceId ?? "";
                    var nextB = current.NextBAgentInstanceId ?? "";
                    foreach (var candidate in candidates)
                    {
                        if (string.IsNullOrWhiteSpace(nextA))
                        {
                            nextA = candidate;
                            continue;
                        }
                        if (string.IsNullOrWhiteSpace(nextB) &&
                            !string.Equals(candidate, nextA, StringComparison.Ordinal))
                        {
                            nextB = candidate;
                            break;
                        }
                    }
                    if (string.Equals(nextA, current.StandbyAgentInstanceId ?? "", StringComparison.Ordinal) &&
                        string.Equals(nextB, current.NextBAgentInstanceId ?? "", StringComparison.Ordinal))
                        return;

                    var next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = _instanceId,
                        StandbyAgentInstanceId = nextA,
                        NextBAgentInstanceId = nextB,
                        Generation = current.Generation ?? Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                    if (TryWriteRoles(session, next, roles))
                    {
                        lock (_stateGate) _nextBId = nextB;
                        SetRole(FirestoreAgentRole.PRIMARY, _instanceId, nextA, "NEXT_AB_SELECTED");
                        _log("FIRESTORE HA next_ab=SELECTED next_a=" + Short(nextA) + " next_b=" + Short(nextB));
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                _log("FIRESTORE HA next_ab=DEFER type=" + ex.GetType().Name +
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
                { "agent_admin_user_id", StringField(AgentDisplayUsername(session)) },
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

        private List<AgentPresenceView> QueryFreshPresence(AgentSession session, string component, long now, int limit)
        {
            var cutoff = Math.Max(0L, now - PresenceFreshMs);
            var query = new Dictionary<string, object>
            {
                {
                    "structuredQuery", new Dictionary<string, object>
                    {
                        { "from", new object[] { new Dictionary<string, object> { { "collectionId", "relay_poc_agents" } } } },
                        {
                            "where", new Dictionary<string, object>
                            {
                                {
                                    "fieldFilter", new Dictionary<string, object>
                                    {
                                        { "field", new Dictionary<string, object> { { "fieldPath", "heartbeat_at_ms" } } },
                                        { "op", "GREATER_THAN_OR_EQUAL" },
                                        { "value", IntField(cutoff) }
                                    }
                                }
                            }
                        },
                        {
                            "orderBy", new object[]
                            {
                                new Dictionary<string, object>
                                {
                                    { "field", new Dictionary<string, object> { { "fieldPath", "heartbeat_at_ms" } } },
                                    { "direction", "DESCENDING" }
                                }
                            }
                        },
                        { "limit", Math.Max(1, Math.Min(50, limit)) }
                    }
                }
            };
            var raw = SendJson(
                "POST",
                DocumentsBase + ":runQuery",
                session.IdToken,
                _json.Serialize(query),
                "",
                7000,
                true,
                component);
            var rows = _json.DeserializeObject(raw) as IEnumerable;
            var views = new List<AgentPresenceView>();
            var returnedDocuments = 0;
            if (rows != null)
            {
                foreach (var item in rows)
                {
                    var row = item as Dictionary<string, object>;
                    object docObj;
                    var doc = row != null && row.TryGetValue("document", out docObj)
                        ? docObj as Dictionary<string, object>
                        : null;
                    if (doc == null) continue;
                    returnedDocuments++;
                    object fieldsObj;
                    var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
                    if (fields == null) continue;
                    var heartbeat = FieldLong(fields, "heartbeat_at_ms");
                    var age = now - heartbeat;
                    var agentId = FieldString(fields, "agent_instance_id");
                    if (heartbeat <= 0 || age < -60000 || age > PresenceFreshMs || string.IsNullOrWhiteSpace(agentId))
                        continue;
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
            }
            FirestoreQuotaGuard.RecordReadDocuments(returnedDocuments, component, _log);
            return views;
        }

        private void ReadOnlineAgentCounts(AgentSession session, long now)
        {
            var views = QueryFreshPresence(session, "PRESENCE_FRESH_QUERY", now, FirestoreAgentSyncClient.MaxAgents);

            string primary;
            string standby;
            string nextB;
            lock (_stateGate)
            {
                primary = _primaryId ?? "";
                standby = _standbyId ?? "";
                nextB = _nextBId ?? "";
            }

            foreach (var view in views)
            {
                view.Role = string.Equals(view.AgentInstanceId, primary, StringComparison.Ordinal)
                    ? "PRIMARY"
                    : (string.Equals(view.AgentInstanceId, standby, StringComparison.Ordinal)
                        ? "NEXT_A"
                        : (string.Equals(view.AgentInstanceId, nextB, StringComparison.Ordinal) ? "NEXT_B" : "DEEP_HIBERNATE"));
            }
            views.Sort((a, b) =>
            {
                var rankA = a.Role == "PRIMARY" ? 0 : (a.Role == "NEXT_A" ? 1 : (a.Role == "NEXT_B" ? 2 : 3));
                var rankB = b.Role == "PRIMARY" ? 0 : (b.Role == "NEXT_A" ? 1 : (b.Role == "NEXT_B" ? 2 : 3));
                var rank = rankA.CompareTo(rankB);
                if (rank != 0) return rank;
                return string.Compare(a.Machine ?? "", b.Machine ?? "", StringComparison.OrdinalIgnoreCase);
            });

            if (views.Count > FirestoreAgentSyncClient.MaxAgents)
                views.RemoveRange(FirestoreAgentSyncClient.MaxAgents, views.Count - FirestoreAgentSyncClient.MaxAgents);

            var visibleIds = new HashSet<string>(views.Select(item => item.AgentInstanceId), StringComparer.Ordinal);
            var primaryCount = !string.IsNullOrWhiteSpace(primary) && visibleIds.Contains(primary) ? 1 : 0;
            var standbyCount = !string.IsNullOrWhiteSpace(standby) && visibleIds.Contains(standby) ? 1 : 0;
            var nextBCount = !string.IsNullOrWhiteSpace(nextB) && visibleIds.Contains(nextB) ? 1 : 0;
            _onlineAgentCount = views.Count;
            _onlinePrimaryCount = primaryCount;
            _onlineStandbyCount = standbyCount;
            _onlineNextBCount = nextBCount;
            _onlineFrozenCount = Math.Max(0, views.Count - primaryCount - standbyCount - nextBCount);
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
                        NextBAgentInstanceId = FieldString(fields, "next_b_agent_instance_id"),
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
                { "next_b_agent_instance_id", StringField(snapshot.NextBAgentInstanceId ?? "") },
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

                FirestoreRoleSnapshot next = null;
                if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = snapshot.StandbyAgentInstanceId ?? "",
                        StandbyAgentInstanceId = snapshot.NextBAgentInstanceId ?? "",
                        NextBAgentInstanceId = "",
                        Generation = Guid.NewGuid().ToString("N"),
                        UpdatedAtMs = NowMs()
                    };
                }
                else if (string.Equals(snapshot.StandbyAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = snapshot.PrimaryAgentInstanceId ?? "",
                        StandbyAgentInstanceId = snapshot.NextBAgentInstanceId ?? "",
                        NextBAgentInstanceId = "",
                        Generation = snapshot.Generation ?? "",
                        UpdatedAtMs = NowMs()
                    };
                }
                else if (string.Equals(snapshot.NextBAgentInstanceId, _instanceId, StringComparison.Ordinal))
                {
                    next = new FirestoreRoleSnapshot
                    {
                        PrimaryAgentInstanceId = snapshot.PrimaryAgentInstanceId ?? "",
                        StandbyAgentInstanceId = snapshot.StandbyAgentInstanceId ?? "",
                        NextBAgentInstanceId = "",
                        Generation = snapshot.Generation ?? "",
                        UpdatedAtMs = NowMs()
                    };
                }
                if (next != null) TryWriteRoles(session, next, read);
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
            lock (_stateGate) _nextBId = snapshot == null ? "" : (snapshot.NextBAgentInstanceId ?? "");
            if (snapshot == null)
            {
                _generation = "";
                SetRole(FirestoreAgentRole.DEEP_HIBERNATE, "", "", reason);
                return;
            }
            _generation = snapshot.Generation ?? "";
            if (string.Equals(snapshot.PrimaryAgentInstanceId, _instanceId, StringComparison.Ordinal))
                SetRole(FirestoreAgentRole.PRIMARY, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, reason);
            else if (string.Equals(snapshot.StandbyAgentInstanceId, _instanceId, StringComparison.Ordinal))
                SetRole(FirestoreAgentRole.NEXT_A, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, reason);
            else if (string.Equals(snapshot.NextBAgentInstanceId, _instanceId, StringComparison.Ordinal))
                SetRole(FirestoreAgentRole.NEXT_B, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, reason);
            else
                SetRole(FirestoreAgentRole.DEEP_HIBERNATE, snapshot.PrimaryAgentInstanceId, snapshot.StandbyAgentInstanceId, reason);
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
                    if (role != FirestoreAgentRole.NEXT_A) _leaseMissingSinceMs = 0;
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

        private bool TryWriteScheduleFields(
            AgentSession session,
            string scheduleKey,
            string decision,
            long boundaryMs,
            long overrideUntilMs,
            RoleRead previous)
        {
            if (previous == null || !previous.Exists || string.IsNullOrWhiteSpace(previous.UpdateTime))
                return false;

            var fields = new Dictionary<string, object>
            {
                { "schedule_key", StringField(scheduleKey ?? "") },
                { "schedule_decision", StringField(decision ?? "") },
                { "decision_boundary_ms", IntField(Math.Max(0L, boundaryMs)) },
                { "relay_override_until_ms", IntField(Math.Max(0L, overrideUntilMs)) },
                { "schedule_updated_by_agent_instance_id", StringField(_instanceId) },
                { "schedule_updated_at_ms", IntField(NowMs()) }
            };
            var suffix = BuildMask(fields.Keys) +
                         "&currentDocument.updateTime=" + Uri.EscapeDataString(previous.UpdateTime);
            try
            {
                SendJson(
                    "PATCH",
                    RolesUrl(),
                    session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    suffix,
                    7000,
                    false,
                    "SCHEDULE_WRITE");
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

        private void WriteScheduleFields(
            AgentSession session,
            string scheduleKey,
            string decision,
            long boundaryMs,
            long overrideUntilMs)
        {
            for (var attempt = 0; attempt < 4; attempt++)
            {
                var read = ReadRoles(session);
                if (TryWriteScheduleFields(session, scheduleKey, decision, boundaryMs, overrideUntilMs, read))
                    return;
            }
            throw new InvalidOperationException("Không ghi được trạng thái lịch vận hành.");
        }


        private void TryPublishOperatingScheduleProjection(
            AgentSession session,
            string scheduleKey,
            string decision,
            long boundaryMs,
            long overrideUntilMs)
        {
            // D149: this exact document is deliberately low-frequency. It is written
            // only after a real schedule action and is the only schedule document
            // eligible for Function/Android recovery. Never project roles/lease heartbeats.
            try
            {
                var now = NowMs();
                var fields = new Dictionary<string, object>
                {
                    { "schedule_key", StringField(scheduleKey ?? "") },
                    { "version", IntField(now) },
                    { "decision", StringField(decision ?? "") },
                    { "decision_boundary_ms", IntField(Math.Max(0L, boundaryMs)) },
                    { "open_until_ms", IntField(Math.Max(0L, overrideUntilMs)) },
                    { "normal_start_minutes", IntField(5 * 60 + 45) },
                    { "normal_end_minutes", IntField(22 * 60 + 15) },
                    { "overtime_cutoff_minutes", IntField(5 * 60) },
                    { "updated_at_ms", IntField(now) },
                    { "updated_by_agent_instance_id", StringField(_instanceId) }
                };
                SendJson(
                    "PATCH",
                    OperatingScheduleUrl(),
                    session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    BuildMask(fields.Keys),
                    7000,
                    false,
                    "OPERATING_SCHEDULE_PROJECTION");
                _log("FIRESTORE SCHEDULE projection=PASS decision=" +
                     AgentDiagnostics.Sanitize(decision ?? "") +
                     " open_until_ms=" + overrideUntilMs);
            }
            catch (Exception ex)
            {
                // Authority is already committed in roles. Projection failure must not
                // create a retry loop; a same-decision explicit action can repair it.
                _log("FIRESTORE SCHEDULE projection=DEFER type=" + ex.GetType().Name +
                     " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
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
            if (_role != FirestoreAgentRole.NEXT_A) return 30000;
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

            if (ageMs < PrimaryLeaseHeartbeatMs)
                return Math.Max(1000, PrimaryLeaseHeartbeatMs - (int)ageMs);
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

        private static string OperatingScheduleUrl()
        {
            return DocumentsBase + "/relay_poc_coordination/operating_schedule";
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

        private static string AgentDisplayUsername(AgentSession session)
        {
            if (session == null) return "";
            var value = string.IsNullOrWhiteSpace(session.LoginName)
                ? (session.AppUserId ?? "")
                : session.LoginName;
            value = (value ?? "").Trim();
            var colon = value.LastIndexOf(':');
            if (colon >= 0 && colon < value.Length - 1) value = value.Substring(colon + 1);
            return value.Trim();
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
