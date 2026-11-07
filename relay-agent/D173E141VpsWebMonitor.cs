using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // E141: local-only opt-in for the enrolled authenticated VPS Agent.
    // All observations flow through AgentDiagnostics and its EXISTING bundle.
    // No Web request, Firestore read, Drive file or background browser instance.
    internal sealed partial class AgentForm
    {
        private readonly Button _e141WebMonitorButton = new Button();
        private volatile bool _e141WebMonitorEnabled;
        private bool _e141OptInLoaded;
        private readonly object _e141ObservationGate = new object();
        private string _e141PreviousWebState = "";
        private DateTime _e141LastWebSampleUtc = DateTime.MinValue;
        private DateTime _e141LastResourceSampleUtc = DateTime.MinValue;
        private long _e141MonitorEvents;
        // Resolve lazily: partial-class static initializer order is unspecified.
        private static string E141OptInPath
        {
            get
            {
                return Path.Combine(Environment.GetFolderPath(
                    Environment.SpecialFolder.LocalApplicationData),
                    "Agent Auto Confirm Pick Pack", "RelayPoc", "vps-web-monitor.dpapi");
            }
        }

        private bool E141AuthorizedVps()
        {
            try
            {
                var session = SnapshotSession();
                return FirestoreVpsReclaim.IsVps(session) ||
                    FirestoreVpsReclaim.IsOwner(session);
            }
            catch { return false; }
        }

        private string E141MachineBinding()
        {
            // Authorization is account-specific, not just local-device-specific.
            AgentSession actor;
            try { actor = SnapshotSession(); } catch { actor = null; }
            return Environment.MachineName + "|" + _agentInstanceId + "|" +
                ((actor == null ? "" : actor.LoginName ?? "").Trim().ToLowerInvariant());
        }

        private bool E141ReadOptIn()
        {
            if (!E141AuthorizedVps()) return false;
            try
            {
                if (!File.Exists(E141OptInPath)) return false;
                var payload = ProtectedData.Unprotect(File.ReadAllBytes(E141OptInPath),
                    null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(payload) == E141MachineBinding();
            }
            catch { return false; }
        }

        private void E141SaveOptIn(bool enabled)
        {
            Directory.CreateDirectory(RelayDataDir);
            if (!enabled)
            {
                if (File.Exists(E141OptInPath)) File.Delete(E141OptInPath);
                return;
            }
            // DPAPI user binding and local Agent instance: the same vps login
            // elsewhere does not silently enable monitoring on another machine.
            var bytes = ProtectedData.Protect(
                Encoding.UTF8.GetBytes(E141MachineBinding()),
                null, DataProtectionScope.CurrentUser);
            var temp = E141OptInPath + ".tmp";
            File.WriteAllBytes(temp, bytes);
            if (File.Exists(E141OptInPath)) File.Delete(E141OptInPath);
            File.Move(temp, E141OptInPath);
        }

        private void E141InitWebMonitorButton()
        {
            _e141WebMonitorButton.SetBounds(470, 110, 194, 30);
            _e141WebMonitorButton.Text = "Giám sát Web: TẮT";
            _e141WebMonitorButton.Visible = false;
            _e141WebMonitorButton.Click += (s, e) => E141ToggleWebMonitor();
            _wmsWebToolbar.Controls.Add(_e141WebMonitorButton);
            LayoutE143WebToolbar();
            E141RefreshMonitorUi();
        }

        private void E141RefreshMonitorUi()
        {
            if (InvokeRequired) { Ui(E141RefreshMonitorUi); return; }
            var permitted = E141AuthorizedVps();
            if (!permitted)
            {
                // Ordinary authenticated Agents can observe local Web health.
                // They cannot access the privileged ON/OFF control.
                _e141WebMonitorEnabled = HasAgentSession();
                _e141OptInLoaded = false;
            }
            else if (!_e141OptInLoaded)
            {
                _e141WebMonitorEnabled = E141ReadOptIn();
                _e141OptInLoaded = true;
            }
            _e141WebMonitorButton.Visible = permitted;
            _e141WebMonitorButton.Enabled = permitted;
            _e141WebMonitorButton.Text = _e141WebMonitorEnabled
                ? "Giám sát Web: BẬT" : "Giám sát Web: TẮT";
        }

        private void E141ToggleWebMonitor()
        {
            if (!E141AuthorizedVps()) return;
            var enabling = !_e141WebMonitorEnabled;
            try
            {
                E141SaveOptIn(enabling);
                _e141WebMonitorEnabled = enabling;
                _e141OptInLoaded = true;
                lock (_e141ObservationGate)
                {
                    _e141PreviousWebState = "";
                    _e141LastWebSampleUtc = DateTime.MinValue;
                    _e141LastResourceSampleUtc = DateTime.MinValue;
                }
                // A single safe mode transition appears in the existing Agent log
                // and therefore the existing manual/periodic Drive bundle.
                AgentDiagnostics.Write("E141 WEB_MONITOR state=" +
                    (enabling ? "ON" : "OFF") + " scope=AUTHORIZED_AGENT local_only=true");
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("E141 WEB_MONITOR state=UNCHANGED type=" +
                    ex.GetType().Name);
            }
            E141RefreshMonitorUi();
        }

        private void E141ObserveWeb(SupraBrowserState state)
        {
            if (!_e141WebMonitorEnabled || !HasAgentSession() || state == null) return;
            try
            {
                var now = DateTime.UtcNow;
                // Never emit raw URL/HTML/DOM, PickList, user ID, search input,
                // exception message, cookie, token or arbitrary Web page content.
                var safeState = E141StateClass(state.State);
                var key = safeState + "|" + (state.Ready ? "1" : "0") +
                    "|" + (state.LoginMarkerDetected ? "1" : "0") +
                    "|" + (state.DataHydrated ? "1" : "0") +
                    "|" + (state.PageLoaded ? "1" : "0") +
                    "|" + Math.Max(0, state.PicklistCodeCount) +
                    "|" + Math.Max(0, state.ConfirmVisibleCount);
                bool due, resourceDue;
                lock (_e141ObservationGate)
                {
                    due = key != _e141PreviousWebState ||
                        now - _e141LastWebSampleUtc >= TimeSpan.FromMinutes(1);
                    if (due)
                    {
                        _e141PreviousWebState = key;
                        _e141LastWebSampleUtc = now;
                    }
                    resourceDue = now - _e141LastResourceSampleUtc >= TimeSpan.FromMinutes(5);
                    if (resourceDue) _e141LastResourceSampleUtc = now;
                }
                if (due)
                {
                    Interlocked.Increment(ref _e141MonitorEvents);
                    AgentDiagnostics.Write("E141 WEB_MONITOR event=HEALTH state=" + safeState +
                        " ready=" + (state.Ready ? "1" : "0") +
                        " loaded=" + (state.PageLoaded ? "1" : "0") +
                        " login=" + (state.LoginMarkerDetected ? "1" : "0") +
                        " hydrated=" + (state.DataHydrated ? "1" : "0") +
                        " dom=" + (state.DomReady ? "1" : "0") +
                        " picklist_count=" + Math.Max(0, state.PicklistCodeCount) +
                        " table_count=" + Math.Max(0, state.TableCount) +
                        " checkbox_count=" + Math.Max(0, state.ConfirmVisibleCount) +
                        " frames=" + Math.Max(0, state.FrameCount) +
                        " events=" + Interlocked.Read(ref _e141MonitorEvents));
                }
                if (resourceDue && _supraBrowser != null)
                {
                    var process = _supraBrowser.SampleResourceUsage();
                    AgentDiagnostics.Write("E141 WEB_MONITOR event=RESOURCE " +
                        "available=" + (process.Available ? "1" : "0") +
                        " cpu_pct=" + Math.Round(process.CpuPercent, 1) +
                        " working_set_mb=" + Math.Max(0, process.WorkingSetBytes / 1048576L) +
                        " process_count=" + Math.Max(0, process.ProcessCount));
                }
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("E141 WEB_MONITOR event=OBSERVE_FAIL type=" +
                    ex.GetType().Name);
            }
        }

        private static string E141StateClass(string state)
        {
            switch (state ?? "")
            {
                case "READY": return "READY";
                case "READY_EMPTY": return "READY_EMPTY";
                case "LOGIN_REQUIRED": return "LOGIN_REQUIRED";
                case "CONFIRM_SETTLING": return "CONFIRM_SETTLING";
                case "CONFIRM_REFRESHING": return "CONFIRM_REFRESHING";
                case "CONFIRM_RELOAD_VERIFY": return "CONFIRM_RELOAD_VERIFY";
                case "DASHBOARD_ACCESS_FAILED": return "DASHBOARD_ACCESS_FAILED";
                case "CONFIRM_RETRY_EXHAUSTED": return "CONFIRM_RETRY_EXHAUSTED";
                case "DOM_UNAVAILABLE": return "DOM_UNAVAILABLE";
                case "NOT_OPEN": return "NOT_OPEN";
                case "BROWSER_ERROR": return "BROWSER_ERROR";
                default: return "OTHER";
            }
        }

        private void E141RecordRole(FirestoreAgentRole role)
        {
            if (!_e141WebMonitorEnabled || !HasAgentSession()) return;
            AgentDiagnostics.Write("E141 WEB_MONITOR event=HA_ROLE role=" + role +
                " local_only=true");
        }

        private void ToggleE141BrowserInput()
        {
            // The authenticated Agent session is the authorization boundary.
            // No second password challenge for this display-only input shield.
            if (!HasAgentSession() || _supraBrowser == null ||
                !_supraBrowser.IsAgentOwnedMode() || !_supraBrowser.HasActiveBrowser()) return;
            var unlock = _supraBrowser.AgentInputProtected;
            try
            {
                if (!_supraBrowser.SetAgentInputProtected(!unlock))
                {
                    AgentDiagnostics.Write("E141 WEB_SHIELD event=COMMAND_FAIL reason=HOST_NOT_ACK");
                    MessageBox.Show("Chưa xác minh được trạng thái khóa WebView2. " +
                        "Không coi trình duyệt đã được bảo vệ.",
                        "Web Confirm", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                AgentDiagnostics.Write("E141 WEB_SHIELD event=" +
                    (unlock ? "OPERATOR_UNLOCK" : "OPERATOR_PROTECT") +
                    " access=AUTHENTICATED_AGENT");
                UpdateD129SupraUi();
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("E141 WEB_SHIELD event=COMMAND_FAIL type=" +
                    ex.GetType().Name);
            }
        }
    }
}
