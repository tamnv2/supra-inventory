using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        // E148: Operator-triggered, read-only exact refresh, independent of the
        // existing five/ten-minute reconcile and 30-second UI tick.
        // No new timer, poll, cache reset, credential or server endpoint.
        private readonly Button _d173E148ManualRefreshButton = new Button();
        private int _d173E148ManualRefreshRunning;
        private DateTime _d173E148ManualRefreshStartedUtc = DateTime.MinValue;

        private void InitializeD173E148ManualRefresh()
        {
            _d173E148ManualRefreshButton.Name = "D173E148RefreshAllRosterAndAgents";
            _d173E148ManualRefreshButton.Text = "Làm mới dữ liệu";
            _d173E148ManualRefreshButton.SetBounds(0, 3, 154, 29);
            _d173E148ManualRefreshButton.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _d173E148ManualRefreshButton.Enabled = HasAgentSession();
            _d173E148ManualRefreshButton.Click += (sender, args) => BeginD173E148ManualRefresh();
        }

        private void BeginD173E148ManualRefresh()
        {
            if (!HasAgentSession() || IsDisposed) return;
            if (Interlocked.CompareExchange(ref _d173E148ManualRefreshRunning, 1, 0) != 0) return;
            // Prevent accidental double-click bursts, but never wait for the
            // 5/10/15-minute automatic sync periods.
            if (DateTime.UtcNow - _d173E148ManualRefreshStartedUtc < TimeSpan.FromSeconds(10))
            {
                Interlocked.Exchange(ref _d173E148ManualRefreshRunning, 0);
                _pickerOnlineStatus.Text = "Vừa làm mới · thử lại sau vài giây";
                return;
            }
            _d173E148ManualRefreshStartedUtc = DateTime.UtcNow;
            _d173E148ManualRefreshButton.Enabled = false;
            _d173E148ManualRefreshButton.Text = "Đang làm mới...";
            _pickerOnlineStatus.Text = "Đang đọc dữ liệu phiên và Agent...";

            Task.Run(() =>
            {
                AgentSession identity = null;
                AgentSyncSnapshot sync = null;
                List<PickerPresenceView> pickers = null;
                List<ReporterOnlineView> webAndReporters = null;
                List<AgentPresenceView> agents = null;
                var passed = 0;
                var failed = 0;

                try
                {
                    EnsureFreshToken();
                    identity = SnapshotSession();

                    // 1. Existing shared coordination document: calls, kicks,
                    // counters, latest SKU and history, *not* a new write.
                    try
                    {
                        if (_agentSyncClient == null) throw new InvalidOperationException("SYNC_CLIENT_UNAVAILABLE");
                        sync = _agentSyncClient.Load(identity);
                        passed++;
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        Log("D173_E148_REFRESH source=AGENT_SYNC result=DEFER type=" + ex.GetType().Name);
                    }

                    // 2. Exact Android Picker login/logout authority, not the
                    // eventually consistent PickList fallback.
                    try
                    {
                        if (_pickerPresenceClient == null) throw new InvalidOperationException("PRESENCE_CLIENT_UNAVAILABLE");
                        pickers = _pickerPresenceClient.Load(identity);
                        passed++;
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        Log("D173_E148_REFRESH source=PICKER result=DEFER type=" + ex.GetType().Name);
                    }

                    // 3. Same authenticated Worker endpoint as the existing
                    // Web / Android Reporter session roster, called once.
                    try
                    {
                        if (_d173ReporterClient == null) throw new InvalidOperationException("REPORTER_CLIENT_UNAVAILABLE");
                        webAndReporters = _d173ReporterClient.Load(identity);
                        passed++;
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        Log("D173_E148_REFRESH source=WEB_REPORTER result=DEFER type=" + ex.GetType().Name);
                    }

                    // 4. Read the current Agent heartbeat + roles directly.
                    // Never mutate PRIMARY/standby lease or run a new timer.
                    try
                    {
                        var leader = _leaderCoordinator;
                        if (leader == null) throw new InvalidOperationException("AGENT_FLEET_UNAVAILABLE");
                        agents = leader.QueryFreshFleetForOperatorRefresh(identity);
                        passed++;
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        Log("D173_E148_REFRESH source=AGENT_FLEET result=DEFER type=" + ex.GetType().Name);
                    }
                }
                catch (Exception ex)
                {
                    failed++;
                    Log("D173_E148_REFRESH state=AUTH_UNAVAILABLE type=" + ex.GetType().Name);
                }

                var successCount = passed;
                var failureCount = failed;
                Ui(() =>
                {
                    try
                    {
                        if (IsDisposed || !HasAgentSession() || identity == null) return;
                        AgentSession current;
                        try { current = SnapshotSession(); }
                        catch { return; }
                        // Never let an old login's delayed read repopulate a new
                        // user's roster after logout/re-login.
                        if (!string.Equals(identity.UserId, current.UserId, StringComparison.Ordinal) ||
                            !string.Equals(identity.RefreshToken, current.RefreshToken, StringComparison.Ordinal))
                        {
                            Log("D173_E148_REFRESH state=DISCARDED_SESSION_CHANGED");
                            return;
                        }

                        // Sequence matters: shared snapshot is the baseline,
                        // then authoritative direct Picker projection and fresh
                        // Agent fleet supersede its older replicated lists.
                        if (sync != null)
                        {
                            ApplyD134AgentSyncSnapshot(sync);
                            _lastD150DeepSyncReadUtc = DateTime.UtcNow;
                        }
                        if (pickers != null)
                            ApplyD161DirectPickerPresence(pickers);
                        if (webAndReporters != null)
                        {
                            _d173ReporterLastAttemptUtc = DateTime.UtcNow;
                            _d173WebPresenceUnavailable = false;
                            UpdateD173ReporterOnline(webAndReporters);
                        }
                        else
                        {
                            // An unavailable roster must not display stale web/
                            // Reporter sessions as if they were still connected.
                            _d173WebPresenceUnavailable = true;
                            UpdateD173ReporterOnline(new List<ReporterOnlineView>());
                        }
                        if (agents != null && _leaderCoordinator != null)
                        {
                            _leaderCoordinator.ApplySyncedFleet(agents);
                            UpdateAgentFleetGrid(_leaderCoordinator.OnlineAgents);
                        }
                        _pickerOnlineRenderSignature = "";
                        RenderPickerOnlineSnapshot();
                        _pickerOnlineStatus.Text = failureCount == 0
                            ? "Đã làm mới đầy đủ 4/4 nguồn"
                            : "Đã làm mới " + successCount + "/4 nguồn · có lỗi";
                    }
                    finally
                    {
                        Interlocked.Exchange(ref _d173E148ManualRefreshRunning, 0);
                        _d173E148ManualRefreshButton.Text = "Làm mới dữ liệu";
                        _d173E148ManualRefreshButton.Enabled = HasAgentSession() && !IsDisposed;
                        Log("D173_E148_REFRESH mode=MANUAL_EXACT_READ success=" + successCount +
                            " failed=" + failureCount + " provider_write=false");
                    }
                });
            });
        }
    }
}
