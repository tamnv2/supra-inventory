using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    // D173-E278: business-confirm readiness is not equivalent to WMS DOM login.
    // All network mail work is incident-driven, off the PDA/HA/UI threads.
    internal sealed partial class AgentForm
    {
        private readonly object _e278IncidentGate = new object();
        private volatile bool _e278ConfirmDegraded;
        private int _e278EmptySearchStrikes;
        private long _e278LastEmptySearchMs;
        private long _e278LastNonEmptyMs;
        private long _e278LoginFirstMs;
        private bool _e278IncidentReported;
        private int _e278AlertAttempts;
        private long _e278LastAlertAttemptMs;
        private bool _e278RearmReported;
        private long _e278FirstConfirmedHealthyMs;
        private long _e278LastRearmAttemptMs;
        private string _e278IncidentId = Guid.NewGuid().ToString("N");

        private static long E278NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        private bool E278HasReadyStandby()
        {
            var coordinator = _leaderCoordinator;
            return coordinator != null && coordinator.OnlineAgents.Any(agent =>
                agent != null && agent.WmsReady &&
                (string.Equals(agent.AgentInstanceId, coordinator.CurrentStandbyId, StringComparison.Ordinal) ||
                 string.Equals(agent.AgentInstanceId, coordinator.CurrentNextBId, StringComparison.Ordinal)));
        }

        private bool E278HasRecentPopulatedView()
        {
            var age = E278NowMs() - Interlocked.Read(ref _e278LastNonEmptyMs);
            return age >= 0 && age <= 7200000;
        }

        private bool E278ObserveSearch(SupraBrowserSearchResult search, bool hasPendingWork)
        {
            if (!hasPendingWork || search == null) return false;
            if (search.PicklistCodeCount > 0)
            {
                Interlocked.Exchange(ref _e278LastNonEmptyMs, E278NowMs());
                E278RestoreDataView();
                return false;
            }
            // No-PickList screen alone is NOT an outage. Require a real failed
            // PDA Search UI click, then another independent failure within 60s.
            if (!search.SearchClicked) return false;
            var now = E278NowMs();
            // A legitimately empty WMS queue at startup must not trigger HA or email.
            if (_e278LastNonEmptyMs <= 0 || now - _e278LastNonEmptyMs > 7200000) return false;
            var activated = false;
            lock (_e278IncidentGate)
            {
                if (_e278LastEmptySearchMs == 0 || now - _e278LastEmptySearchMs > 60000)
                    _e278EmptySearchStrikes = 0;
                _e278LastEmptySearchMs = now;
                _e278EmptySearchStrikes++;
                _e278FirstConfirmedHealthyMs = 0;
                _e278RearmReported = false;
                if (_e278EmptySearchStrikes >= 2 && !_e278ConfirmDegraded)
                {
                    _e278ConfirmDegraded = true;
                    activated = true;
                }
            }
            if (activated)
            {
                Log("D173_E278 CONFIRM_HEALTH state=DEGRADED reason=REPEATED_ZERO_TABLE_AFTER_SEARCH");
                E278AlertPrimary("WEB_CONFIRM_UNAVAILABLE");
                var coordinator = _leaderCoordinator;
                if (coordinator != null) coordinator.RequestRoleRefreshBeforeBusiness();
            }
            return _e278ConfirmDegraded;
        }

        private void E278RestoreDataView()
        {
            var restored = false;
            lock (_e278IncidentGate)
            {
                restored = _e278ConfirmDegraded;
                _e278ConfirmDegraded = false;
                _e278EmptySearchStrikes = 0;
                _e278LastEmptySearchMs = 0;
            }
            if (restored)
            {
                Log("D173_E278 CONFIRM_HEALTH state=DATA_VIEW_RESTORED");
                var coordinator = _leaderCoordinator;
                if (coordinator != null) coordinator.RequestRoleRefreshBeforeBusiness();
            }
        }

        private void E278ObserveWebHealth(SupraBrowserState state)
        {
            if (state == null) return;
            if (state.Ready && state.PicklistCodeCount > 0)
            {
                Interlocked.Exchange(ref _e278LastNonEmptyMs, E278NowMs());
                E278RestoreDataView();
            }
            if (state.LoginMarkerDetected)
            {
                var now = E278NowMs();
                if (_e278LoginFirstMs == 0) _e278LoginFirstMs = now;
                if (now - _e278LoginFirstMs >= 5000) E278AlertPrimary("SESSION_EXPIRED");
            }
            else _e278LoginFirstMs = 0;
            // No background polling: retry at most three times on existing health updates.
            // The Worker global claim suppresses duplicate sends even if an HTTP response is lost.
            if (_e278ConfirmDegraded && !_e278IncidentReported)
                E278AlertPrimary("WEB_CONFIRM_UNAVAILABLE");
            E278MaybeRearm();
        }

        private void E278Confirmed()
        {
            E278RestoreDataView();
            lock (_e278IncidentGate)
            {
                if (_e278FirstConfirmedHealthyMs == 0)
                    _e278FirstConfirmedHealthyMs = E278NowMs();
            }
        }

        private void E278AlertPrimary(string reason)
        {
            var coordinator = _leaderCoordinator;
            if (coordinator == null || !coordinator.IsLeader) return;
            string incidentId, generation, standby;
            var now = E278NowMs();
            lock (_e278IncidentGate)
            {
                if (_e278IncidentReported || _e278AlertAttempts >= 3 ||
                    (_e278LastAlertAttemptMs > 0 && now - _e278LastAlertAttemptMs < 60000)) return;
                _e278IncidentReported = true;
                _e278AlertAttempts++;
                _e278LastAlertAttemptMs = now;
                _e278FirstConfirmedHealthyMs = 0;
                incidentId = _e278IncidentId;
                generation = coordinator.Generation;
                standby = E278HasReadyStandby() ? "NOT_TRANSFERRED" : "NO_READY_STANDBY";
            }
            if (string.IsNullOrWhiteSpace(generation))
            {
                lock (_e278IncidentGate) _e278IncidentReported = false;
                return;
            }
            Task.Run(() =>
            {
                if (E278PostIncident("FAILED", incidentId, generation, reason, standby, 0L)) return;
                lock (_e278IncidentGate)
                    if (string.Equals(_e278IncidentId, incidentId, StringComparison.Ordinal))
                        _e278IncidentReported = false;
            });
        }

        private void E278MaybeRearm()
        {
            var coordinator = _leaderCoordinator;
            if (coordinator == null || !coordinator.IsLeader || !HasReadyConfirmBrowser()) return;
            var now = E278NowMs();
            string incidentId, generation;
            lock (_e278IncidentGate)
            {
                if (_e278RearmReported || _e278FirstConfirmedHealthyMs <= 0 ||
                    now - _e278FirstConfirmedHealthyMs < 300000 ||
                    now - _e278LastRearmAttemptMs < 60000) return;
                _e278LastRearmAttemptMs = now;
                incidentId = _e278IncidentId;
                generation = coordinator.Generation;
            }
            if (string.IsNullOrWhiteSpace(generation)) return;
            var healthyForMs = now - _e278FirstConfirmedHealthyMs;
            Task.Run(() =>
            {
                if (!E278PostIncident("RECOVERED", incidentId, generation,
                    "WEB_CONFIRM_UNAVAILABLE", "NOT_TRANSFERRED", healthyForMs)) return;
                lock (_e278IncidentGate)
                {
                    if (_e278IncidentId != incidentId) return;
                    _e278RearmReported = true;
                    _e278IncidentReported = false;
                    _e278IncidentId = Guid.NewGuid().ToString("N");
                    _e278AlertAttempts = 0;
                    _e278LastAlertAttemptMs = 0;
                }
                Log("D173_E278 CONFIRM_INCIDENT state=REARMED");
            });
        }

        private bool E278PostIncident(string action, string id, string generation,
            string reason, string standby, long healthyForMs)
        {
            try
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                if (session == null || string.IsNullOrWhiteSpace(session.IdToken)) return false;
                var payload = new JavaScriptSerializer().Serialize(new
                {
                    action = action,
                    incident_id = id,
                    agent_instance_id = _agentInstanceId,
                    generation = generation,
                    machine = Environment.MachineName,
                    reason = reason,
                    standby = standby,
                    healthy_for_ms = Math.Max(0L, healthyForMs)
                });
                var request = (HttpWebRequest)WebRequest.Create(
                    AgentConfig.ApiBaseUrl + "/api/agent/d173/confirm-incident");
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Accept = "application/json";
                request.Timeout = 10000;
                request.ReadWriteTimeout = 10000;
                request.Headers[HttpRequestHeader.Authorization] = "Bearer " + session.IdToken;
                using (var writer = new StreamWriter(request.GetRequestStream()))
                    writer.Write(payload);
                using (var reply = (HttpWebResponse)request.GetResponse())
                {
                    var ok = (int)reply.StatusCode >= 200 && (int)reply.StatusCode < 300;
                    Log("D173_E278 CONFIRM_INCIDENT action=" + action + " accepted=" +
                        (ok ? "1" : "0") + " status=" + (int)reply.StatusCode);
                    return ok;
                }
            }
            catch (Exception ex)
            {
                // Never include request bodies, Firebase tokens or Owner mail in logs.
                Log("D173_E278 CONFIRM_INCIDENT action=" + action + " result=DEFER type=" +
                    ex.GetType().Name);
                return false;
            }
        }
    }
}
