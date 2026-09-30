using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private FirestoreD157HandoffClient _d157HandoffClient;
        private FirestoreD157HandoffListener _d157HandoffListener;
        private FirestoreD157PendingWakeListener _d157PendingWakeListener;
        private readonly object _d157HandoffGate = new object();
        private string _d157PendingHandoffRequestId = "";
        private string _d157HandledTargetHandoffRequestId = "";
        private DateTime _d157LastWmsProofUtc = DateTime.MinValue;
        private DateTime _d157LastSessionValidationUtc = DateTime.MinValue;
        private DateTime _d157LastBusinessActivityUtc = DateTime.MinValue;
        private long _d157SessionValidationRunning;

        private void StartD157AgentFeatures()
        {
            if (!HasAgentSession()) return;
            var now = DateTime.UtcNow;
            if (_d157LastWmsProofUtc == DateTime.MinValue) _d157LastWmsProofUtc = now;
            if (_d157LastSessionValidationUtc == DateTime.MinValue) _d157LastSessionValidationUtc = now;
            if (_d157LastBusinessActivityUtc == DateTime.MinValue) _d157LastBusinessActivityUtc = now;

            if (_d157HandoffClient == null)
                _d157HandoffClient = new FirestoreD157HandoffClient(message => Log(message));

            if (_d157HandoffListener == null)
            {
                _d157HandoffListener = new FirestoreD157HandoffListener(
                    SnapshotSession,
                    EnsureFreshToken,
                    HandleD157HandoffEvent,
                    message => Log(message));
                _d157HandoffListener.Start();
            }

            if (_d157PendingWakeListener == null)
            {
                _d157PendingWakeListener = new FirestoreD157PendingWakeListener(
                    SnapshotSession,
                    EnsureFreshToken,
                    () =>
                    {
                        var coordinator = _leaderCoordinator;
                        return coordinator != null &&
                               coordinator.IsLeader &&
                               IsBusinessAllowed() &&
                               HasOperationalReadiness();
                    },
                    message => Log(message));
                _d157PendingWakeListener.Start();
            }
        }

        private void StopD157AgentFeatures()
        {
            var pending = _d157PendingWakeListener;
            _d157PendingWakeListener = null;
            try { if (pending != null) pending.Stop(); } catch { }

            var handoff = _d157HandoffListener;
            _d157HandoffListener = null;
            try { if (handoff != null) handoff.Stop(); } catch { }

            lock (_d157HandoffGate)
            {
                _d157PendingHandoffRequestId = "";
                _d157HandledTargetHandoffRequestId = "";
            }
        }

        private void MarkD157BusinessActivity()
        {
            _d157LastBusinessActivityUtc = DateTime.UtcNow;
        }

        private void MarkD157WmsProof()
        {
            var now = DateTime.UtcNow;
            _d157LastBusinessActivityUtc = now;
            _d157LastWmsProofUtc = now;
        }

        private void TickD157SessionHealth()
        {
            if (!HasAgentSession() || _supraBrowser == null || !HasReadyConfirmBrowser()) return;
            if (Interlocked.CompareExchange(ref _d157SessionValidationRunning, 0L, 0L) != 0L) return;
            if (Interlocked.CompareExchange(ref _manualPicklistOperationRunning, 0, 0) != 0) return;
            if (Interlocked.CompareExchange(ref _readinessRefreshRunning, 0L, 0L) != 0L) return;
            if (Interlocked.CompareExchange(ref _browserStorageMigrationRunning, 0, 0) != 0) return;
            if (_d150PrimaryTakeoverRunning) return;

            var coordinator = _leaderCoordinator;
            if (coordinator == null) return;

            var now = DateTime.UtcNow;
            var primary = coordinator.IsLeader;
            var due = primary
                ? now - _d157LastWmsProofUtc >= TimeSpan.FromMinutes(60)
                : now - _d157LastSessionValidationUtc >= TimeSpan.FromHours(2);
            if (!due) return;

            var idleRequired = primary ? TimeSpan.FromSeconds(60) : TimeSpan.FromSeconds(30);
            if (now - _d157LastBusinessActivityUtc < idleRequired) return;

            if (Interlocked.CompareExchange(ref _d157SessionValidationRunning, 1L, 0L) != 0L) return;
            _d157LastSessionValidationUtc = now;
            Task.Run(() =>
            {
                try
                {
                    var reason = primary ? "primary_60m_without_wms_proof" : "secondary_2h_idle_check";
                    var passed = _supraBrowser.ReloadConfirmForHealthCheck(TimeSpan.FromSeconds(12), reason);
                    if (passed)
                    {
                        MarkD157WmsProof();
                        Log("D157 SESSION_CHECK schedule=PASS role=" + coordinator.RoleName +
                            " cadence=" + (primary ? "60m_no_proof" : "2h"));
                    }
                    else
                    {
                        Log("D157 SESSION_CHECK schedule=FAIL role=" + coordinator.RoleName +
                            " next_action=readiness_reconcile");
                    }
                    RefreshSupraBrowserStatus();
                }
                catch (Exception ex)
                {
                    Log("D157 SESSION_CHECK schedule=FAIL type=" + ex.GetType().Name +
                        " detail=" + SafeMessage(ex));
                    try { RefreshSupraBrowserStatus(); } catch { }
                }
                finally
                {
                    Interlocked.Exchange(ref _d157SessionValidationRunning, 0L);
                }
            });
        }

        private bool ProbeD157TargetWmsForTakeover()
        {
            if (_supraBrowser == null || !HasReadyConfirmBrowser()) return false;
            if (Interlocked.CompareExchange(ref _manualPicklistOperationRunning, 0, 0) != 0) return false;
            if (Interlocked.CompareExchange(ref _d157SessionValidationRunning, 1L, 0L) != 0L) return false;

            try
            {
                MarkD157BusinessActivity();
                var passed = _supraBrowser.ReloadConfirmForHealthCheck(
                    TimeSpan.FromSeconds(12),
                    "targeted_primary_preflight");
                RefreshSupraBrowserStatus();
                if (passed && HasReadyConfirmBrowser())
                {
                    MarkD157WmsProof();
                    Log("D157 HANDOFF target_wms_preflight=PASS real_reload=true");
                    return true;
                }
                Log("D157 HANDOFF target_wms_preflight=FAIL real_reload=true");
                return false;
            }
            catch (Exception ex)
            {
                Log("D157 HANDOFF target_wms_preflight=FAIL type=" + ex.GetType().Name +
                    " detail=" + SafeMessage(ex));
                try { RefreshSupraBrowserStatus(); } catch { }
                return false;
            }
            finally
            {
                Interlocked.Exchange(ref _d157SessionValidationRunning, 0L);
            }
        }

        private void BeginD157TargetedPrimaryHandoff()
        {
            if (_d150PrimaryTakeoverRunning || !HasAgentSession()) return;

            AgentSession session;
            try { session = SnapshotSession(); }
            catch { return; }
            if (!IsD150ManualTakeoverLogin(session.LoginName)) return;
            if (_leaderCoordinator == null || !IsBusinessAllowed())
            {
                MessageBox.Show(
                    "Chỉ có thể chuyển Agent chính khi Replay đang hoạt động và cụm Agent đã sẵn sàng.",
                    "Chuyển Agent chính",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            _d150PrimaryTakeoverRunning = true;
            UpdateD150PrimaryTakeoverButton();
            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    var coordinator = _leaderCoordinator;
                    if (coordinator == null) return;
                    var fresh = coordinator.GetFreshAgentsForManualHandoff()
                        .Where(item => item != null && item.WmsReady)
                        .OrderBy(item => item.Machine ?? "")
                        .ThenBy(item => item.AdminUserId ?? "")
                        .ToList();

                    AgentPresenceView target = null;
                    Invoke(new Action(() => target = ShowD157TargetAgentDialog(fresh)));
                    if (target == null) return;

                    var confirmed = DialogResult.No;
                    Invoke(new Action(() =>
                    {
                        confirmed = MessageBox.Show(
                            "Chuyển Agent chính sang máy " + (target.Machine ?? target.AgentInstanceId) +
                            "?\r\n\r\nMáy đích sẽ tự reload Web Confirm bằng F5 thật và chỉ nhận PRIMARY khi kiểm tra đạt.",
                            "Xác nhận chuyển Agent chính",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question,
                            MessageBoxDefaultButton.Button2);
                    }));
                    if (confirmed != DialogResult.Yes) return;

                    EnsureFreshToken();
                    session = SnapshotSession();
                    var client = _d157HandoffClient ?? new FirestoreD157HandoffClient(message => Log(message));
                    var requestId = client.CreateRequest(session, _agentInstanceId, target);
                    lock (_d157HandoffGate) _d157PendingHandoffRequestId = requestId;
                    Ui(() => _relay.Text =
                        "Chế độ nhận tin từ PDA: Đang yêu cầu chuyển PRIMARY sang " +
                        (target.Machine ?? "Agent đích") + "...");
                }
                catch (Exception ex)
                {
                    Log("D157 HANDOFF request=FAIL type=" + ex.GetType().Name +
                        " detail=" + SafeMessage(ex));
                    Ui(() => MessageBox.Show(
                        "Không gửi được yêu cầu chuyển Agent chính. " + SafeMessage(ex),
                        "Chuyển Agent chính",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning));
                }
                finally
                {
                    Ui(() =>
                    {
                        _d150PrimaryTakeoverRunning = false;
                        UpdateD150PrimaryTakeoverButton();
                    });
                }
            });
        }

        private AgentPresenceView ShowD157TargetAgentDialog(List<AgentPresenceView> agents)
        {
            var list = agents ?? new List<AgentPresenceView>();
            if (list.Count == 0)
            {
                MessageBox.Show(
                    "Hiện không có Agent nào được ghi nhận online + Web Confirm sẵn sàng.",
                    "Chuyển Agent chính",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return null;
            }

            using (var dialog = new Form())
            using (var selector = new ListBox())
            using (var ok = new Button())
            using (var cancel = new Button())
            {
                dialog.Text = "Chọn Agent làm máy chính";
                dialog.Width = 620;
                dialog.Height = 390;
                dialog.StartPosition = FormStartPosition.CenterParent;
                dialog.MinimizeBox = false;
                dialog.MaximizeBox = false;
                dialog.FormBorderStyle = FormBorderStyle.FixedDialog;

                selector.Left = 16;
                selector.Top = 16;
                selector.Width = 570;
                selector.Height = 280;
                foreach (var agent in list)
                    selector.Items.Add(new D157AgentChoice(agent));
                if (selector.Items.Count > 0) selector.SelectedIndex = 0;

                ok.Text = "Chuyển Agent chính";
                ok.Left = 330;
                ok.Top = 310;
                ok.Width = 150;
                ok.DialogResult = DialogResult.OK;

                cancel.Text = "Huỷ";
                cancel.Left = 490;
                cancel.Top = 310;
                cancel.Width = 96;
                cancel.DialogResult = DialogResult.Cancel;

                dialog.Controls.Add(selector);
                dialog.Controls.Add(ok);
                dialog.Controls.Add(cancel);
                dialog.AcceptButton = ok;
                dialog.CancelButton = cancel;

                if (dialog.ShowDialog(this) != DialogResult.OK) return null;
                var choice = selector.SelectedItem as D157AgentChoice;
                return choice == null ? null : choice.Agent;
            }
        }

        private void HandleD157HandoffEvent(D157PrimaryHandoffRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.RequestId)) return;

            string pending;
            lock (_d157HandoffGate) pending = _d157PendingHandoffRequestId;
            if (!string.IsNullOrWhiteSpace(pending) &&
                string.Equals(pending, request.RequestId, StringComparison.Ordinal) &&
                string.Equals(request.RequesterAgentInstanceId, _agentInstanceId, StringComparison.Ordinal) &&
                (string.Equals(request.Status, "SUCCESS", StringComparison.Ordinal) ||
                 string.Equals(request.Status, "FAILED", StringComparison.Ordinal)))
            {
                lock (_d157HandoffGate) _d157PendingHandoffRequestId = "";
                Ui(() =>
                {
                    UpdateD150PrimaryTakeoverButton();
                    MessageBox.Show(
                        string.Equals(request.Status, "SUCCESS", StringComparison.Ordinal)
                            ? "Đã chuyển Agent chính sang " + (request.TargetMachine ?? "máy đã chọn") + "."
                            : "Chưa chuyển được Agent chính. " + (request.ResultDetail ?? "Máy đích chưa sẵn sàng."),
                        "Chuyển Agent chính",
                        MessageBoxButtons.OK,
                        string.Equals(request.Status, "SUCCESS", StringComparison.Ordinal)
                            ? MessageBoxIcon.Information
                            : MessageBoxIcon.Warning);
                });
                return;
            }

            if (!string.Equals(request.Status, "PENDING", StringComparison.Ordinal) ||
                !string.Equals(request.TargetAgentInstanceId, _agentInstanceId, StringComparison.Ordinal))
                return;

            lock (_d157HandoffGate)
            {
                if (string.Equals(_d157HandledTargetHandoffRequestId, request.RequestId, StringComparison.Ordinal))
                    return;
                _d157HandledTargetHandoffRequestId = request.RequestId;
            }

            Task.Run(() =>
            {
                var success = false;
                var detail = "";
                var generation = "";
                try
                {
                    var coordinator = _leaderCoordinator;
                    if (coordinator == null)
                    {
                        detail = "TARGET_COORDINATOR_NOT_READY";
                    }
                    else
                    {
                        success = coordinator.PromoteTargetedPrimaryHandoff(request, out detail, out generation);
                    }

                    EnsureFreshToken();
                    var client = _d157HandoffClient ?? new FirestoreD157HandoffClient(message => Log(message));
                    client.Complete(SnapshotSession(), request, success, detail, generation);
                }
                catch (Exception ex)
                {
                    detail = "TARGET_EXCEPTION_" + ex.GetType().Name;
                    Log("D157 HANDOFF target=FAIL type=" + ex.GetType().Name +
                        " detail=" + SafeMessage(ex));
                    try
                    {
                        EnsureFreshToken();
                        var client = _d157HandoffClient ?? new FirestoreD157HandoffClient(message => Log(message));
                        client.Complete(SnapshotSession(), request, false, detail, "");
                    }
                    catch { }
                }
            });
        }

        private sealed class D157AgentChoice
        {
            internal readonly AgentPresenceView Agent;

            internal D157AgentChoice(AgentPresenceView agent)
            {
                Agent = agent;
            }

            public override string ToString()
            {
                if (Agent == null) return "";
                return (Agent.Machine ?? "(không rõ máy)") +
                       "  |  " + (Agent.AdminUserId ?? "(không rõ user)") +
                       "  |  " + (Agent.Role ?? "") +
                       "  |  Web Confirm READY";
            }
        }
    }
}
