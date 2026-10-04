using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private void LayoutSupraCardControls()
        {
            if (_supraCard == null) return;

            var width = Math.Max(420, _supraCard.ClientSize.Width);
            const int gap = 8;
            var buttonWidth = Math.Max(120, (width - 32 - (gap * 2)) / 3);

            // D129: readiness is in the title; the first detail row is resource-only.
            _wmsStatus.Visible = false;
            _supraInfo.Visible = false;
            _wmsTest.Visible = false;
            _d128BrowserResourceStatus.SetBounds(16, 40, Math.Max(180, width - 32), 22);
            _d128BrowserResourceStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

            _wmsCapture.SetBounds(16, 70, buttonWidth, 32);
            _wmsDesktop.SetBounds(16 + buttonWidth + gap, 70, buttonWidth, 32);
            _wmsLogout.SetBounds(16 + ((buttonWidth + gap) * 2), 70,
                Math.Max(120, width - 32 - ((buttonWidth + gap) * 2)), 32);

            const int downloadWidth = 196;
            _browserBundleDownload.SetBounds(16, 110, downloadWidth, 30);
            _browserBundleStatus.SetBounds(220, 112, Math.Max(180, width - 236), 24);
            _browserBundleStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

            _browserBundleProgress.SetBounds(16, 146, Math.Max(120, width - 32), 16);
            _browserBundleProgress.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

            const int openFolderButtonWidth = 154;
            const int moveFolderButtonWidth = 124;
            _agentDataStorageStatus.SetBounds(
                16, 170,
                Math.Max(180, width - 32 - openFolderButtonWidth - moveFolderButtonWidth - gap - 8),
                24);
            _agentDataStorageStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _openAgentDataFolder.SetBounds(
                Math.Max(16, width - 16 - moveFolderButtonWidth - gap - openFolderButtonWidth),
                166, openFolderButtonWidth, 28);
            _openAgentDataFolder.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _moveAgentDataFolder.SetBounds(
                Math.Max(16, width - 16 - moveFolderButtonWidth),
                166, moveFolderButtonWidth, 28);
            _moveAgentDataFolder.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        }

        private sealed class SmoothDataGridView : DataGridView
        {
            internal SmoothDataGridView()
            {
                DoubleBuffered = true;
            }
        }

        private readonly DataGridView _pickerOnlineGrid = new SmoothDataGridView();
        private readonly Label _pickerOnlineStatus = new Label();
        private readonly Label _fleetMetricStatus = new Label();
        private readonly Label _agentRequestMetrics = new Label();
        private readonly Label _d128AgentResourceStatus = new Label();
        private readonly Label _d128BrowserResourceStatus = new Label();
        private readonly TextBox _pickerSearch = new TextBox();
        private List<PickerPresenceView> _pickerOnlineSnapshot = new List<PickerPresenceView>();
        private string _pickerOnlineRenderSignature = "";
        private bool? _d119AuthenticatedState;
        private readonly System.Windows.Forms.Timer _d119OpsTimer = new System.Windows.Forms.Timer();
        private FirestorePickerPresenceClient _pickerPresenceClient;
        private FirestorePickerContactClient _pickerContactClient;
        private FirestoreAgentSyncClient _agentSyncClient;
        private FirestoreAgentSyncListener _agentSyncListener;
        private readonly object _agentSyncLifecycleGate = new object();
        private FirestoreAgentRole _d140AgentSyncRole = FirestoreAgentRole.DEEP_HIBERNATE;
        private AgentSyncSnapshot _agentSyncSnapshot = new AgentSyncSnapshot();
        private readonly Dictionary<string, PickerContactCommand> _activePickerCommands =
            new Dictionary<string, PickerContactCommand>(StringComparer.Ordinal);
        private readonly Dictionary<string, long> _pickerCallLocks =
            new Dictionary<string, long>(StringComparer.Ordinal);
        private readonly HashSet<string> _pickerCallPending =
            new HashSet<string>(StringComparer.Ordinal);
        private string _d135CounterDayKey = "";
        private readonly object _d158CounterDayGate = new object();
        private string _d158LocalCounterDayKey = "";
        private long _d135CounterReceivedFloor;
        private long _d135CounterConfirmedFloor;
        private long _d135CounterErrorFloor;
        private long _agentSyncReconcileRunning;
        private DateTime _lastAgentSyncReconcileUtc = DateTime.MinValue;
        private string _lastD158DailyCounterReadDay = "";
        private string _lastD158DailyCounterReadGeneration = "";
        private DateTime _lastD150DeepSyncReadUtc = DateTime.MinValue;
        private long _d150DeepSyncReadRunning;
        private bool? _pickerWindowOpenState;
        private bool _d161DirectPickerPresenceObserved;
        private volatile int _activePdaCountForRelay;
        private FirestoreFleetMetricsClient _fleetMetricsClient;
        private FleetMetricSnapshot _fleetSnapshot;
        private readonly Button _autoSizeAgentColumnsButton = new Button();
        private readonly Button _d150PrimaryTakeoverButton = new Button();
        private bool _d150PrimaryTakeoverRunning;
        private bool _autoSizeColumnsEnabled = true;
        private bool _columnPreferenceApplying;
        private string _columnPreferenceUser = "";
        private Rectangle _savedNormalWindowBounds = Rectangle.Empty;
        private FormWindowState _lastTrackedWindowState = FormWindowState.Normal;
        private bool _restoringSavedWindowBounds;
        private D128OverlayForm _d128Overlay;
        private readonly Button _d128OverlaySettingsButton = new Button();
        private readonly Button _d128OverlayRetryButton = new Button();
        private readonly Label _d128OverlayStatus = new Label();
        private ToolStripMenuItem _d128OverlayVisibleMenu;
        private ToolStripMenuItem _d128OverlayLockedMenu;
        private ToolStripMenuItem _d128OverlaySettingsMenu;
        private bool _d128OverlayUiInitialized;
        private bool _d128OverlayTrayInitialized;
        private bool _d128OverlayAutoRetryAttempted;
        private static readonly string D128OverlaySettingsFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Agent Auto Confirm Pick Pack", "RelayPoc", "overlay-settings.json");

        public sealed class ColumnPreferenceProfile
        {
            public bool AutoSize = true;
            public Dictionary<string, int> Agent = new Dictionary<string, int>(StringComparer.Ordinal);
            public Dictionary<string, int> Picker = new Dictionary<string, int>(StringComparer.Ordinal);
            public Dictionary<string, int> PickList = new Dictionary<string, int>(StringComparer.Ordinal);
            public bool HasWindowBounds;
            public int WindowLeft;
            public int WindowTop;
            public int WindowWidth;
            public int WindowHeight;
        }

        private void InitializeD119AgentFeatures(TableLayoutPanel overviewLayout)
        {
            if (overviewLayout == null) return;

            _pickerPresenceClient = new FirestorePickerPresenceClient(message => Log(message));
            _pickerContactClient = new FirestorePickerContactClient(message => Log(message));
            _agentSyncClient = new FirestoreAgentSyncClient(message => Log(message));
            _fleetMetricsClient = new FirestoreFleetMetricsClient(message => Log(message));
            InitializeD128Overlay();

            var agentHost = _username.Parent;
            if (agentHost != null)
            {
                _d128AgentResourceStatus.Text = "CPU: -- | RAM: -- | Thời gian chạy: --";
                _d128AgentResourceStatus.ForeColor = Color.FromArgb(88, 104, 115);
                _d128AgentResourceStatus.AutoEllipsis = true;
                _d128AgentResourceStatus.TextAlign = ContentAlignment.MiddleLeft;
                _d128AgentResourceStatus.SetBounds(16, 62, Math.Max(160, agentHost.ClientSize.Width - 32), 20);
                _d128AgentResourceStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
                agentHost.Controls.Add(_d128AgentResourceStatus);
                _d128AgentResourceStatus.BringToFront();

                _agentRequestMetrics.Text = "Xác nhận đơn · Nhận 0 · Đã xử lý 0 · Thành công 0 · Lỗi 0 · Chờ 0";
                _agentRequestMetrics.ForeColor = Color.FromArgb(71, 85, 105);
                _agentRequestMetrics.AutoEllipsis = true;
                _agentRequestMetrics.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
                _agentRequestMetrics.Visible = false;
                agentHost.Controls.Add(_agentRequestMetrics);
            }

            if (_supraCard != null)
            {
                _d128BrowserResourceStatus.Text = "Tài nguyên Web: chờ đo...";
                _d128BrowserResourceStatus.ForeColor = Color.FromArgb(88, 104, 115);
                _d128BrowserResourceStatus.AutoEllipsis = true;
                _d128BrowserResourceStatus.Font = new Font("Segoe UI", 8F);
                _supraCard.Controls.Add(_d128BrowserResourceStatus);
                _d128BrowserResourceStatus.BringToFront();
                LayoutSupraCardControls();
            }

            var pickerCard = NewCard(0, 0, 1040, 170);
            pickerCard.Dock = DockStyle.Fill;
            pickerCard.Margin = Padding.Empty;

            pickerCard.Controls.Add(new Label
            {
                Left = 16,
                Top = 8,
                Width = 250,
                Height = 22,
                Text = "Picker đang hoạt động trên PDA",
                Font = new Font("Segoe UI Semibold", 11F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });

            _pickerOnlineStatus.SetBounds(274, 9, 250, 20);
            _pickerOnlineStatus.Text = "Đang chờ phiên Agent...";
            _pickerOnlineStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _pickerOnlineStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            pickerCard.Controls.Add(_pickerOnlineStatus);

            _fleetMetricStatus.SetBounds(528, 9, 494, 20);
            _fleetMetricStatus.Text = "";
            _fleetMetricStatus.TextAlign = ContentAlignment.MiddleRight;
            _fleetMetricStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _fleetMetricStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _fleetMetricStatus.Visible = false; // D149: durable counters stay internal; remove Hôm nay cluster UI.
            pickerCard.Controls.Add(_fleetMetricStatus);
            InitializeD161BulkPickerRevoke(pickerCard);

            pickerCard.Controls.Add(new Label
            {
                Left = 16,
                Top = 43,
                Width = 178,
                Height = 20,
                Text = "Tìm MNV / họ tên / nhà thầu",
                ForeColor = Color.FromArgb(71, 85, 105)
            });
            _pickerSearch.SetBounds(198, 36, 824, 30);
            _pickerSearch.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _pickerSearch.TextChanged += (s, e) => RenderPickerOnlineSnapshot();
            pickerCard.Controls.Add(_pickerSearch);

            _pickerOnlineGrid.SetBounds(16, 72, 1006, 88);
            _pickerOnlineGrid.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            _pickerOnlineGrid.AllowUserToAddRows = false;
            _pickerOnlineGrid.AllowUserToDeleteRows = false;
            _pickerOnlineGrid.AllowUserToResizeRows = false;
            _pickerOnlineGrid.MultiSelect = false;
            _pickerOnlineGrid.ReadOnly = true;
            _pickerOnlineGrid.RowHeadersVisible = false;
            _pickerOnlineGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _pickerOnlineGrid.AutoGenerateColumns = false;
            _pickerOnlineGrid.BackgroundColor = Color.White;
            _pickerOnlineGrid.BorderStyle = BorderStyle.FixedSingle;
            _pickerOnlineGrid.ScrollBars = ScrollBars.Vertical;
            _pickerOnlineGrid.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            _pickerOnlineGrid.ColumnHeadersHeight = 24;
            _pickerOnlineGrid.RowTemplate.Height = 28;
            _pickerOnlineGrid.DefaultCellStyle.WrapMode = DataGridViewTriState.False;
            _pickerOnlineGrid.ShowCellToolTips = true;
            _pickerOnlineGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "EmployeeCode",
                HeaderText = "Mã nhân viên",
                Width = 112
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "DisplayName",
                HeaderText = "Họ tên",
                AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill,
                MinimumWidth = 170
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "ContractorName",
                HeaderText = "Nhà thầu",
                Width = 130,
                MinimumWidth = 100
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "Source",
                HeaderText = "Nguồn xác nhận",
                Width = 116
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "KickUser",
                HeaderText = "Kích User",
                Text = "Kích User",
                UseColumnTextForButtonValue = true,
                Width = 96
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "CallSpecialist",
                HeaderText = "Chuyên viên",
                Text = "Liên hệ picker",
                UseColumnTextForButtonValue = true,
                Width = 118
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "ResolveContact",
                HeaderText = "Kết thúc",
                Width = 82
            });
            _pickerOnlineGrid.CellContentClick += PickerOnlineGridCellContentClick;
            _pickerOnlineGrid.CellMouseEnter += (s, e) =>
            {
                if (e.RowIndex < 0) return;
                _pickerOnlineGrid.Rows[e.RowIndex].DefaultCellStyle.BackColor = Color.FromArgb(232, 242, 252);
            };
            _pickerOnlineGrid.CellMouseLeave += (s, e) =>
            {
                if (e.RowIndex < 0) return;
                _pickerOnlineGrid.Rows[e.RowIndex].DefaultCellStyle.BackColor = Color.White;
            };
            pickerCard.Controls.Add(_pickerOnlineGrid);

            overviewLayout.Controls.Add(pickerCard, 1, 0);
            overviewLayout.SetRowSpan(pickerCard, 3);

            InitializeColumnPreferences(pickerCard);

            _d119OpsTimer.Interval = 30000;
            _d119OpsTimer.Tick += (s, e) =>
            {
                EnsureD158BusinessCounterDay();
                RefreshPickerWindowBoundary();
                ExpirePickerCallLocks();
                RefreshD119OperationalViews(false);
                UpdateD150PrimaryTakeoverButton();
            };
            _d119OpsTimer.Start();
            FormClosed += (s, e) =>
            {
                try { _d119OpsTimer.Stop(); } catch { }
                try { _d119OpsTimer.Dispose(); } catch { }
            };

            ApplyD119AuthenticatedLayout(HasAgentSession());
            RefreshAgentRequestMetrics();
            RefreshD119OperationalViews(true);
        }

        private void LayoutAgentSystemStatusRow(Control host, int top)
        {
            if (host == null) return;
            _identity.Visible = false;
            _network.Visible = false;
            _relay.Visible = true;
            _relay.SetBounds(16, top, Math.Max(300, host.ClientSize.Width - 32), 20);
            _relay.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _d128AgentResourceStatus.SetBounds(16, top + 24, Math.Max(300, host.ClientSize.Width - 32), 20);
            _d128AgentResourceStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        }

        private void ApplyD119AuthenticatedLayout(bool authenticated)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<bool>(ApplyD119AuthenticatedLayout), authenticated);
                return;
            }
            if (_username.Parent == null) return;
            var host = _username.Parent;

            var userLabel = host.Controls["agent-auth-user-label"];
            var passwordLabel = host.Controls["agent-auth-password-label"];
            if (userLabel != null) userLabel.Visible = !authenticated;
            if (passwordLabel != null) passwordLabel.Visible = !authenticated;
            _username.Visible = !authenticated;
            _password.Visible = !authenticated;
            _pair.Visible = !authenticated;

            _logout.Visible = authenticated;
            _background.Visible = true;
            _agentFleetStatus.Visible = false;

            if (authenticated)
            {
                LayoutAgentSystemStatusRow(host, 38);
                _d128AgentResourceStatus.Visible = true;
                _logout.SetBounds(16, 88, 108, 30);
                _manualUpdate.SetBounds(134, 88, 148, 30);
                _background.SetBounds(292, 88, 142, 30);
                _autoSizeAgentColumnsButton.SetBounds(
                    Math.Max(446, host.ClientSize.Width - 184),
                    88,
                    168,
                    30);
                _autoSizeAgentColumnsButton.Visible = true;
                _agentRequestMetrics.Visible = false;
                UpdateD150PrimaryTakeoverButton();

                var fleetTop = 126;
                _agentFleetGrid.SetBounds(
                    16,
                    fleetTop,
                    Math.Max(300, host.ClientSize.Width - 32),
                    Math.Max(46, host.ClientSize.Height - fleetTop - 12));
                _agentFleetGrid.Visible = true;
            }
            else
            {
                _relay.Visible = false;
                _identity.Visible = false;
                _network.Visible = false;
                _d128AgentResourceStatus.Visible = false;
                _manualUpdate.SetBounds(16, 118, 148, 30);
                _background.SetBounds(174, 118, 142, 30);
                _autoSizeAgentColumnsButton.Visible = false;
                _d150PrimaryTakeoverButton.Visible = false;
                _agentRequestMetrics.Visible = false;
                _agentFleetGrid.Visible = false;
            }

            UpdateD160RestrictedTabs(authenticated);
            UpdateD161BulkPickerRevokeVisibility();
            UpdateD161GlobalSupportLogControlVisibility();

            var authChanged = !_d119AuthenticatedState.HasValue || _d119AuthenticatedState.Value != authenticated;
            _d119AuthenticatedState = authenticated;
            if (authenticated)
            {
                // D161 Owner field repair: Picker observation is an authenticated Agent
                // management surface and is independent from WMS/Web Confirm readiness
                // and from the business processing window.
                if (authChanged) _d161DirectPickerPresenceObserved = false;
                StartD134AgentSync();
                if (authChanged)
                {
                    LoadColumnPreferencesForCurrentUser();
                    RefreshPickerWindowBoundary();
                    RefreshD119OperationalViews(true);
                    RenderD157OperationalListsFromMemory();
                }
            }
            else
            {
                StopD134AgentSync();
                _d161DirectPickerPresenceObserved = false;
                _pickerOnlineSnapshot = new List<PickerPresenceView>();
                _pickerOnlineRenderSignature = "";
                _pickerOnlineGrid.Rows.Clear();
                _pickerOnlineStatus.Text = "Đăng nhập Agent để xem Picker đang hoạt động.";
                _fleetMetricStatus.Text = "";
            }
        }

        private string ColumnPreferencePath
        {
            get { return Path.Combine(RelayDataDir, "grid-column-preferences.json"); }
        }

        private void InitializeColumnPreferences(Control pickerCard)
        {
            var agentHost = _username.Parent;
            if (agentHost != null)
            {
                _autoSizeAgentColumnsButton.AutoSize = true;
                _autoSizeAgentColumnsButton.Height = 30;
                _autoSizeAgentColumnsButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                _autoSizeAgentColumnsButton.Click += (s, e) =>
                {
                    _autoSizeColumnsEnabled = !_autoSizeColumnsEnabled;
                    UpdateAutoSizeColumnsButton();
                    ApplyColumnPreferenceMode();
                    if (!_autoSizeColumnsEnabled) RestoreManualGridWidthsForCurrentUser();
                    SaveColumnPreferencesForCurrentUser();
                };
                agentHost.Controls.Add(_autoSizeAgentColumnsButton);
                _autoSizeAgentColumnsButton.BringToFront();

                _d150PrimaryTakeoverButton.Text = "Chuyển Agent chính";
                _d150PrimaryTakeoverButton.Width = 150;
                _d150PrimaryTakeoverButton.Height = 30;
                _d150PrimaryTakeoverButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                _d150PrimaryTakeoverButton.Visible = false;
                _d150PrimaryTakeoverButton.Click += (s, e) => BeginD157TargetedPrimaryHandoff();
                agentHost.Controls.Add(_d150PrimaryTakeoverButton);
                _d150PrimaryTakeoverButton.BringToFront();
            }
            UpdateAutoSizeColumnsButton();
            UpdateD150PrimaryTakeoverButton();

            foreach (var grid in new[] { _agentFleetGrid, _pickerOnlineGrid, _manualPicklistGrid })
            {
                grid.AllowUserToResizeColumns = false;
                grid.ColumnWidthChanged += (s, e) =>
                {
                    if (_columnPreferenceApplying || _autoSizeColumnsEnabled) return;
                    SaveColumnPreferencesForCurrentUser();
                };
            }

            ResizeEnd += (s, e) =>
            {
                if (WindowState == FormWindowState.Normal)
                {
                    CaptureCurrentNormalWindowBounds(true);
                    SaveColumnPreferencesForCurrentUser();
                }
                if (_autoSizeColumnsEnabled)
                {
                    ApplyColumnSizingIfEnabled(_agentFleetGrid);
                    ApplyColumnSizingIfEnabled(_pickerOnlineGrid);
                    ApplyColumnSizingIfEnabled(_manualPicklistGrid);
                }
                ApplyManualPicklistCriticalLayout(_autoSizeColumnsEnabled);
            };
            Move += (s, e) =>
            {
                if (WindowState == FormWindowState.Normal && !_restoringSavedWindowBounds)
                    CaptureCurrentNormalWindowBounds(false);
            };
            _lastTrackedWindowState = WindowState;
            Resize += (s, e) => HandleTrackedWindowStateChange();
            Activated += (s, e) =>
            {
                RestoreSavedNormalBoundsIfNeeded();
                ScheduleAutoSizeAfterForegroundRestore();
                RefreshPickerPresenceOnForeground();
            };

            LoadColumnPreferencesForCurrentUser();
        }

        private void UpdateAutoSizeColumnsButton()
        {
            var text = _autoSizeColumnsEnabled
                ? "Auto size cột: Bật"
                : "Auto size cột: Tắt";
            _autoSizeAgentColumnsButton.Text = text;
        }

        private static bool IsD150ManualTakeoverLogin(string loginName)
        {
            var value = (loginName ?? "").Trim();
            return string.Equals(value, "tamnv2", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(value, "admin", StringComparison.OrdinalIgnoreCase);
        }

        private void UpdateD150PrimaryTakeoverButton()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(UpdateD150PrimaryTakeoverButton));
                return;
            }
            var host = _username.Parent;
            if (host == null) return;

            var authenticated = HasAgentSession();
            var allowed = false;
            if (authenticated)
            {
                try { allowed = IsD150ManualTakeoverLogin(SnapshotSession().LoginName); }
                catch { allowed = false; }
            }
            var primary = _leaderCoordinator != null && _leaderCoordinator.IsLeader;
            // D157: Owner-authorized users may choose any ready Agent as PRIMARY even
            // when the current machine is already PRIMARY.
            var visible = authenticated && allowed;
            _d150PrimaryTakeoverButton.Visible = visible;
            _d150PrimaryTakeoverButton.Enabled = visible &&
                !_d150PrimaryTakeoverRunning &&
                _leaderCoordinator != null &&
                IsBusinessAllowed();

            const int right = 16;
            const int gap = 8;
            const int autoWidth = 168;
            const int takeoverWidth = 150;
            if (visible)
            {
                var takeoverLeft = Math.Max(446, host.ClientSize.Width - right - takeoverWidth);
                _d150PrimaryTakeoverButton.SetBounds(takeoverLeft, 88, takeoverWidth, 30);
                _autoSizeAgentColumnsButton.SetBounds(Math.Max(446, takeoverLeft - gap - autoWidth), 88, autoWidth, 30);
            }
            else if (authenticated)
            {
                _autoSizeAgentColumnsButton.SetBounds(Math.Max(446, host.ClientSize.Width - right - autoWidth), 88, autoWidth, 30);
            }
            _d150PrimaryTakeoverButton.BringToFront();
        }

        private void BeginD150ManualPrimaryTakeover()
        {
            if (_d150PrimaryTakeoverRunning || !HasAgentSession()) return;
            AgentSession session;
            try { session = SnapshotSession(); }
            catch { return; }
            if (!IsD150ManualTakeoverLogin(session.LoginName)) return;
            if (_leaderCoordinator == null || _leaderCoordinator.IsLeader)
            {
                UpdateD150PrimaryTakeoverButton();
                return;
            }
            if (!IsBusinessAllowed() || !HasReadyConfirmBrowser())
            {
                MessageBox.Show(
                    "Chỉ có thể chuyển Agent chính khi Replay đang hoạt động và Web Confirm sẵn sàng.",
                    "Chuyển Agent chính",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                UpdateD150PrimaryTakeoverButton();
                return;
            }

            var confirm = MessageBox.Show(
                "Chuyển Agent chính về máy này?\r\n\r\nLuồng tự động PDA sẽ được chuyển sang Agent hiện tại bằng cơ chế CAS/generation an toàn.",
                "Xác nhận chuyển Agent chính",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2);
            if (confirm != DialogResult.Yes) return;

            _d150PrimaryTakeoverRunning = true;
            UpdateD150PrimaryTakeoverButton();
            Task.Run(() =>
            {
                var passed = false;
                try
                {
                    var coordinator = _leaderCoordinator;
                    passed = coordinator != null && coordinator.PromoteManualPrimary();
                }
                catch (Exception ex)
                {
                    Log("D150 manual primary takeover DEFER type=" + ex.GetType().Name + " detail=" + SafeMessage(ex));
                }
                Ui(() =>
                {
                    _d150PrimaryTakeoverRunning = false;
                    UpdateD150PrimaryTakeoverButton();
                    if (passed)
                        _relay.Text = "Chế độ nhận tin từ PDA: Replay · Máy này đã là Agent chính";
                    else
                        MessageBox.Show(
                            "Chưa thể chuyển Agent chính. Kiểm tra Web Confirm, trạng thái Replay hoặc thử lại sau khi cụm Agent đồng bộ.",
                            "Chuyển Agent chính",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning);
                });
            });
        }

        private string CurrentColumnPreferenceUser()
        {
            try { return SnapshotSession().AppUserId ?? ""; }
            catch { return ""; }
        }

        private Dictionary<string, ColumnPreferenceProfile> ReadColumnPreferenceStore()
        {
            try
            {
                if (!File.Exists(ColumnPreferencePath)) return new Dictionary<string, ColumnPreferenceProfile>(StringComparer.Ordinal);
                var raw = File.ReadAllText(ColumnPreferencePath, Encoding.UTF8);
                return new JavaScriptSerializer().Deserialize<Dictionary<string, ColumnPreferenceProfile>>(raw)
                    ?? new Dictionary<string, ColumnPreferenceProfile>(StringComparer.Ordinal);
            }
            catch
            {
                return new Dictionary<string, ColumnPreferenceProfile>(StringComparer.Ordinal);
            }
        }

        private void WriteColumnPreferenceStore(Dictionary<string, ColumnPreferenceProfile> store)
        {
            try
            {
                Directory.CreateDirectory(RelayDataDir);
                File.WriteAllText(ColumnPreferencePath, new JavaScriptSerializer().Serialize(store), Encoding.UTF8);
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("GRID_PREF save=FAIL type=" + ex.GetType().Name);
            }
        }

        private void LoadColumnPreferencesForCurrentUser()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(LoadColumnPreferencesForCurrentUser));
                return;
            }
            var user = CurrentColumnPreferenceUser();
            if (string.IsNullOrWhiteSpace(user)) return;
            var store = ReadColumnPreferenceStore();
            ColumnPreferenceProfile profile;
            if (!store.TryGetValue(user, out profile) || profile == null) profile = new ColumnPreferenceProfile();

            _columnPreferenceApplying = true;
            try
            {
                _columnPreferenceUser = user;
                _autoSizeColumnsEnabled = profile.AutoSize;
                UpdateAutoSizeColumnsButton();
                if (profile.HasWindowBounds)
                {
                    _savedNormalWindowBounds = NormalizeSavedWindowBounds(new Rectangle(
                        profile.WindowLeft,
                        profile.WindowTop,
                        profile.WindowWidth,
                        profile.WindowHeight));
                }
                ApplyColumnPreferenceMode();
                if (!_autoSizeColumnsEnabled)
                {
                    RestoreGridWidths(_agentFleetGrid, profile.Agent);
                    RestoreGridWidths(_pickerOnlineGrid, profile.Picker);
                    RestoreGridWidths(_manualPicklistGrid, profile.PickList);
                    ApplyManualPicklistCriticalLayout(false);
                }
            }
            finally
            {
                _columnPreferenceApplying = false;
            }
        }

        private static Dictionary<string, int> CaptureGridWidths(DataGridView grid)
        {
            var result = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (DataGridViewColumn column in grid.Columns)
                if (!string.IsNullOrWhiteSpace(column.Name)) result[column.Name] = column.Width;
            return result;
        }

        private static void RestoreGridWidths(DataGridView grid, Dictionary<string, int> widths)
        {
            if (widths == null) return;
            foreach (DataGridViewColumn column in grid.Columns)
            {
                int width;
                if (widths.TryGetValue(column.Name, out width))
                    column.Width = Math.Max(column.MinimumWidth, Math.Min(800, width));
            }
        }

        private void SaveColumnPreferencesForCurrentUser()
        {
            var user = CurrentColumnPreferenceUser();
            if (string.IsNullOrWhiteSpace(user)) return;
            var store = ReadColumnPreferenceStore();
            ColumnPreferenceProfile existing;
            store.TryGetValue(user, out existing);
            var bounds = _savedNormalWindowBounds;
            if (WindowState == FormWindowState.Normal && !_restoringSavedWindowBounds)
                bounds = Bounds;
            var profile = new ColumnPreferenceProfile
            {
                AutoSize = _autoSizeColumnsEnabled,
                Agent = _autoSizeColumnsEnabled && existing != null
                    ? existing.Agent
                    : CaptureGridWidths(_agentFleetGrid),
                Picker = _autoSizeColumnsEnabled && existing != null
                    ? existing.Picker
                    : CaptureGridWidths(_pickerOnlineGrid),
                PickList = _autoSizeColumnsEnabled && existing != null
                    ? existing.PickList
                    : CaptureGridWidths(_manualPicklistGrid),
                HasWindowBounds = !bounds.IsEmpty,
                WindowLeft = bounds.IsEmpty ? 0 : bounds.Left,
                WindowTop = bounds.IsEmpty ? 0 : bounds.Top,
                WindowWidth = bounds.IsEmpty ? 0 : bounds.Width,
                WindowHeight = bounds.IsEmpty ? 0 : bounds.Height
            };
            store[user] = profile;
            WriteColumnPreferenceStore(store);
            _columnPreferenceUser = user;
        }

        private void RestoreManualGridWidthsForCurrentUser()
        {
            var user = CurrentColumnPreferenceUser();
            if (string.IsNullOrWhiteSpace(user)) return;
            var store = ReadColumnPreferenceStore();
            ColumnPreferenceProfile profile;
            if (!store.TryGetValue(user, out profile) || profile == null) return;
            _columnPreferenceApplying = true;
            try
            {
                RestoreGridWidths(_agentFleetGrid, profile.Agent);
                RestoreGridWidths(_pickerOnlineGrid, profile.Picker);
                RestoreGridWidths(_manualPicklistGrid, profile.PickList);
            }
            finally
            {
                _columnPreferenceApplying = false;
            }
        }

        private void ApplyColumnPreferenceMode()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(ApplyColumnPreferenceMode));
                return;
            }
            foreach (var grid in new[] { _agentFleetGrid, _pickerOnlineGrid, _manualPicklistGrid })
            {
                grid.AllowUserToResizeColumns = !_autoSizeColumnsEnabled;
                if (_autoSizeColumnsEnabled)
                {
                    ApplyColumnSizingIfEnabled(grid);
                }
                else
                {
                    foreach (DataGridViewColumn column in grid.Columns)
                        column.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                }
            }
            ApplyManualPicklistCriticalLayout(_autoSizeColumnsEnabled);
        }

        private void ApplyColumnSizingIfEnabled(DataGridView grid)
        {
            if (grid == null || grid.IsDisposed) return;
            if (grid.InvokeRequired)
            {
                grid.BeginInvoke(new Action<DataGridView>(ApplyColumnSizingIfEnabled), grid);
                return;
            }
            if (!_autoSizeColumnsEnabled || grid.Columns.Count == 0) return;
            // Never calculate widths while the form is hidden/minimized or while the
            // layout is temporarily collapsed during tray restore. Those tiny client
            // widths were the cause of columns reopening as a narrow "clump".
            if (!Visible || WindowState == FormWindowState.Minimized || !grid.Visible || grid.ClientSize.Width < 520) return;
            if (ReferenceEquals(grid, _manualPicklistGrid))
            {
                ApplyManualPicklistCriticalLayout(true);
                return;
            }
            _columnPreferenceApplying = true;
            try
            {
                foreach (DataGridViewColumn column in grid.Columns)
                {
                    column.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                    column.DefaultCellStyle.WrapMode = DataGridViewTriState.False;
                }

                grid.AutoResizeColumns(DataGridViewAutoSizeColumnsMode.DisplayedCells);
                var available = Math.Max(240,
                    grid.ClientSize.Width -
                    (grid.Controls.OfType<VScrollBar>().Any(v => v.Visible) ? SystemInformation.VerticalScrollBarWidth : 4));
                var columns = grid.Columns.Cast<DataGridViewColumn>().Where(x => x.Visible).ToList();
                if (columns.Count == 0) return;

                var preferred = new Dictionary<DataGridViewColumn, int>();
                var minimum = new Dictionary<DataGridViewColumn, int>();
                var totalPreferred = 0;
                var totalMinimum = 0;
                foreach (var column in columns)
                {
                    var isAction = column is DataGridViewButtonColumn;
                    var min = Math.Max(column.MinimumWidth, isAction ? 82 : 72);
                    var max = isAction ? 150 : 360;
                    var pref = Math.Max(min, Math.Min(max, column.Width));
                    preferred[column] = pref;
                    minimum[column] = min;
                    totalPreferred += pref;
                    totalMinimum += min;
                }

                if (available <= totalMinimum)
                {
                    var ratio = available / (double)Math.Max(1, totalMinimum);
                    foreach (var column in columns)
                        column.Width = Math.Max(column.MinimumWidth, (int)Math.Floor(minimum[column] * ratio));
                    return;
                }

                if (totalPreferred > available)
                {
                    var compressible = Math.Max(1, totalPreferred - totalMinimum);
                    var need = totalPreferred - available;
                    foreach (var column in columns)
                    {
                        var room = preferred[column] - minimum[column];
                        var shrink = (int)Math.Round(need * (room / (double)compressible));
                        column.Width = Math.Max(minimum[column], preferred[column] - shrink);
                    }
                }
                else
                {
                    var slack = available - totalPreferred;
                    var flexible = columns.Where(x => !(x is DataGridViewButtonColumn)).ToList();
                    if (flexible.Count == 0) flexible = columns;
                    var weightTotal = flexible.Sum(x => Math.Max(1, preferred[x]));
                    foreach (var column in columns) column.Width = preferred[column];
                    foreach (var column in flexible)
                    {
                        var extra = (int)Math.Floor(slack * (Math.Max(1, preferred[column]) / (double)Math.Max(1, weightTotal)));
                        column.Width = Math.Min(column is DataGridViewButtonColumn ? 150 : 480, column.Width + extra);
                    }
                }

                var used = columns.Sum(x => x.Width);
                var remainder = available - used;
                if (remainder > 0)
                {
                    foreach (var column in columns.Where(x => !(x is DataGridViewButtonColumn)).OrderByDescending(x => x.Width))
                    {
                        if (remainder <= 0) break;
                        var cap = Math.Max(0, 480 - column.Width);
                        var add = Math.Min(cap, remainder);
                        column.Width += add;
                        remainder -= add;
                    }
                }
            }
            catch { }
            finally
            {
                _columnPreferenceApplying = false;
            }
        }

        private void CaptureCurrentNormalWindowBounds(bool persist)
        {
            if (WindowState != FormWindowState.Normal || _restoringSavedWindowBounds) return;
            var bounds = NormalizeSavedWindowBounds(Bounds);
            if (bounds.IsEmpty) return;
            _savedNormalWindowBounds = bounds;
            if (persist) SaveColumnPreferencesForCurrentUser();
        }

        private void ScheduleAutoSizeAfterForegroundRestore()
        {
            if (!_autoSizeColumnsEnabled || IsDisposed) return;
            try
            {
                BeginInvoke(new Action(() =>
                {
                    if (IsDisposed || !Visible || WindowState == FormWindowState.Minimized) return;
                    BeginInvoke(new Action(() =>
                    {
                        if (IsDisposed || !Visible || WindowState == FormWindowState.Minimized) return;
                        ApplyColumnSizingIfEnabled(_agentFleetGrid);
                        ApplyColumnSizingIfEnabled(_pickerOnlineGrid);
                        ApplyColumnSizingIfEnabled(_manualPicklistGrid);
                        ApplyManualPicklistCriticalLayout(true);
                    }));
                }));
            }
            catch { }
        }

        private Rectangle NormalizeSavedWindowBounds(Rectangle bounds)
        {
            if (bounds.Width < MinimumSize.Width || bounds.Height < MinimumSize.Height)
                return Rectangle.Empty;
            var center = new Point(bounds.Left + bounds.Width / 2, bounds.Top + bounds.Height / 2);
            var screen = Screen.FromPoint(center);
            var area = screen == null ? Screen.PrimaryScreen.WorkingArea : screen.WorkingArea;
            var width = Math.Min(Math.Max(MinimumSize.Width, bounds.Width), area.Width);
            var height = Math.Min(Math.Max(MinimumSize.Height, bounds.Height), area.Height);
            var left = Math.Max(area.Left, Math.Min(bounds.Left, area.Right - width));
            var top = Math.Max(area.Top, Math.Min(bounds.Top, area.Bottom - height));
            return new Rectangle(left, top, width, height);
        }

        private void RestoreSavedNormalBoundsIfNeeded()
        {
            if (WindowState != FormWindowState.Normal || _savedNormalWindowBounds.IsEmpty) return;
            var wanted = NormalizeSavedWindowBounds(_savedNormalWindowBounds);
            if (wanted.IsEmpty) return;
            if (Math.Abs(Bounds.Left - wanted.Left) <= 2 &&
                Math.Abs(Bounds.Top - wanted.Top) <= 2 &&
                Math.Abs(Bounds.Width - wanted.Width) <= 2 &&
                Math.Abs(Bounds.Height - wanted.Height) <= 2)
                return;
            _restoringSavedWindowBounds = true;
            try { Bounds = wanted; }
            finally { _restoringSavedWindowBounds = false; }
        }

        private void HandleTrackedWindowStateChange()
        {
            var current = WindowState;
            if (_lastTrackedWindowState == FormWindowState.Normal &&
                current != FormWindowState.Normal &&
                !_restoringSavedWindowBounds)
            {
                var restore = NormalizeSavedWindowBounds(RestoreBounds);
                if (!restore.IsEmpty) _savedNormalWindowBounds = restore;
                SaveColumnPreferencesForCurrentUser();
            }
            else if (_lastTrackedWindowState == FormWindowState.Maximized &&
                     current == FormWindowState.Normal)
            {
                BeginInvoke(new Action(() =>
                {
                    RestoreSavedNormalBoundsIfNeeded();
                    ScheduleAutoSizeAfterForegroundRestore();
                }));
            }
            else if (current == FormWindowState.Normal && !_restoringSavedWindowBounds)
            {
                CaptureCurrentNormalWindowBounds(false);
            }
            _lastTrackedWindowState = current;
        }

        private void RefreshPickerPresenceOnForeground()
        {
            if (!HasAgentSession()) return;
            // D134: focus/restore is UI-only. The compact listener already holds the
            // latest fleet state; foreground changes must never create provider reads.
            RenderPickerOnlineSnapshot();
            RenderFleetMetricStatus(_leaderCoordinator != null && _leaderCoordinator.IsLeader);
        }

        internal void StartD134AgentSync()
        {
            if (!HasAgentSession() || _agentSyncClient == null) return;
            FirestoreAgentSyncListener listener = null;
            lock (_agentSyncLifecycleGate)
            {
                if (_agentSyncListener != null) return;
                listener = new FirestoreAgentSyncListener(
                    SnapshotSession,
                    EnsureFreshToken,
                    ForceRefreshAgentTokenD160,
                    ApplyD134AgentSyncSnapshot,
                    ApplyD161DirectPickerPresence,
                    message => Log(message));
                _agentSyncListener = listener;
            }
            listener.Start();
        }

        internal void StopD134AgentSync()
        {
            FirestoreAgentSyncListener listener = null;
            lock (_agentSyncLifecycleGate)
            {
                listener = _agentSyncListener;
                _agentSyncListener = null;
            }
            try { if (listener != null) listener.Stop(); } catch { }
        }

        internal void ApplyD140AgentSyncRole(FirestoreAgentRole role)
        {
            var changed = false;
            lock (_agentSyncLifecycleGate)
            {
                if (_d140AgentSyncRole != role)
                {
                    _d140AgentSyncRole = role;
                    changed = true;
                }
            }

            var eligible = HasAgentSession();

            if (eligible)
                StartD134AgentSync();
            else
                StopD134AgentSync();

            if (changed)
            {
                Log(
                    "AGENT_SYNC role_gate=" + role +
                    " listener=" + (eligible ? "ENABLED" : "DISABLED") +
                    " policy=AUTHENTICATED_AGENT_SESSION__PICKER_OBSERVATION_WMS_INDEPENDENT");
            }
        }

        private void ApplyD134AgentSyncSnapshot(AgentSyncSnapshot snapshot)
        {
            if (snapshot == null) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action<AgentSyncSnapshot>(ApplyD134AgentSyncSnapshot), snapshot);
                return;
            }

            var currentSnapshot = _agentSyncSnapshot;
            if (snapshot.Version > 0 &&
                currentSnapshot != null &&
                currentSnapshot.Version > 0 &&
                snapshot.Version < currentSnapshot.Version)
            {
                Log("AGENT_SYNC apply=IGNORED_STALE incoming=" + snapshot.Version +
                    " current=" + currentSnapshot.Version);
                return;
            }
            _agentSyncSnapshot = snapshot;
            if (_agentSyncClient != null) _agentSyncClient.Remember(snapshot);
            ApplyD160HistorySyncSnapshot(snapshot.CounterDayKey, snapshot.PickerHistoryJson);
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            lock (_pickerCallLocks)
            {
                _pickerCallLocks.Clear();
                foreach (var pair in snapshot.Calls)
                {
                    var call = pair.Value;
                    if (call == null || call.LockUntilMs <= nowMs) continue;
                    _pickerCallLocks[pair.Key] = call.LockUntilMs;
                    SchedulePickerCallUnlock(pair.Key, call.LockUntilMs);
                }
            }

            lock (_activePickerCommands)
            {
                _activePickerCommands.Clear();
                foreach (var pair in snapshot.Calls)
                {
                    var call = pair.Value;
                    if (call == null || !call.Active || call.LockUntilMs <= nowMs) continue;
                    _activePickerCommands[pair.Key] = new PickerContactCommand
                    {
                        AlertId = call.CallId,
                        TargetUserId = call.TargetUserId,
                        CommandType = "CALL_SPECIALIST",
                        SenderAgentId = call.SenderAgentId,
                        SenderRole = call.SenderRole,
                        LockUntilMs = call.LockUntilMs,
                        IsActiveCall = true
                    };
                }
            }

            var currentCounterDay = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            var snapshotCounterDay = snapshot.CounterDayKey ?? "";
            _fleetSnapshot = new FleetMetricSnapshot
            {
                DayKey = snapshotCounterDay,
                ReceivedTotal = Math.Max(0L, snapshot.ReceivedTotal),
                ConfirmedTotal = Math.Max(0L, snapshot.ConfirmedTotal),
                ErrorTotal = Math.Max(0L, snapshot.ErrorTotal),
                OwnerAgentId = "D134_AGENT_SYNC"
            };
            if (string.Equals(snapshotCounterDay, currentCounterDay, StringComparison.Ordinal))
            {
                MergeD135CounterSnapshot(
                    _fleetSnapshot.DayKey,
                    _fleetSnapshot.ReceivedTotal,
                    _fleetSnapshot.ConfirmedTotal,
                    _fleetSnapshot.ErrorTotal);
            }
            else if (!string.IsNullOrWhiteSpace(snapshotCounterDay))
            {
                Log("D158 COUNTER stale_sync=IGNORED snapshot_day=" + snapshotCounterDay +
                    " current_day=" + currentCounterDay);
            }
            if (_leaderCoordinator != null)
            {
                _leaderCoordinator.ApplySyncedFleet(snapshot.Fleet);
                // D157 repair: Fleet/User presentation is role-independent. A NEXT_A/NEXT_B
                // Agent must render the already-synced fleet immediately; PRIMARY ownership
                // only gates PickList mutation, never observation.
                UpdateAgentFleetGrid(_leaderCoordinator.OnlineAgents);
            }

            if (HasAgentSession() && !_d161DirectPickerPresenceObserved)
                UpdatePickerOnlineGrid(snapshot.Pickers, _leaderCoordinator != null && _leaderCoordinator.IsLeader);
            RenderFleetMetricStatus(_leaderCoordinator != null && _leaderCoordinator.IsLeader);
            RefreshD128Overlay();
            Log("AGENT_SYNC apply version=" + snapshot.Version +
                " pickers=" + snapshot.Pickers.Count +
                " calls=" + snapshot.Calls.Count +
                " kicks=" + snapshot.Kicks.Count +
                " source=LISTEN_OR_RECONCILE");
        }

        private void SchedulePickerCallUnlock(string userId, long lockUntilMs)
        {
            var delay = Math.Max(0L, lockUntilMs - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            if (delay <= 0L) return;
            Task.Run(() =>
            {
                Thread.Sleep((int)Math.Min(int.MaxValue, delay + 25L));
                Ui(() =>
                {
                    lock (_pickerCallLocks)
                    {
                        long current;
                        if (_pickerCallLocks.TryGetValue(userId ?? "", out current) && current <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())
                            _pickerCallLocks.Remove(userId ?? "");
                    }
                    _pickerOnlineRenderSignature = "";
                    RenderPickerOnlineSnapshot();
                });
            });
        }

        private void ExpirePickerCallLocks()
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var changed = false;
            lock (_pickerCallLocks)
            {
                foreach (var key in _pickerCallLocks.Where(x => x.Value <= now).Select(x => x.Key).ToList())
                {
                    _pickerCallLocks.Remove(key);
                    changed = true;
                }
            }
            if (changed)
            {
                _pickerOnlineRenderSignature = "";
                RenderPickerOnlineSnapshot();
            }
        }

        private bool IsPickerCallLocked(string userId)
        {
            lock (_pickerCallLocks)
            {
                long until;
                return _pickerCallLocks.TryGetValue(userId ?? "", out until) &&
                    until > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            }
        }

        private bool IsPickerCallPending(string userId)
        {
            lock (_pickerCallPending) return _pickerCallPending.Contains(userId ?? "");
        }

        private void SetPickerCallPending(string userId, bool pending)
        {
            lock (_pickerCallPending)
            {
                if (pending) _pickerCallPending.Add(userId ?? "");
                else _pickerCallPending.Remove(userId ?? "");
            }
            _pickerOnlineRenderSignature = "";
            RenderPickerOnlineSnapshot();
        }

        private void EnsureD158BusinessCounterDay()
        {
            var current = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            var changed = false;
            lock (_d158CounterDayGate)
            {
                if (string.Equals(_d158LocalCounterDayKey, current, StringComparison.Ordinal)) return;
                _d158LocalCounterDayKey = current;
                Interlocked.Exchange(ref _localPdaRequests, 0L);
                Interlocked.Exchange(ref _localAgentResponses, 0L);
                Interlocked.Exchange(ref _localConfirmSuccess, 0L);
                Interlocked.Exchange(ref _localConfirmFailed, 0L);
                _d135CounterDayKey = current;
                _d135CounterReceivedFloor = 0L;
                _d135CounterConfirmedFloor = 0L;
                _d135CounterErrorFloor = 0L;
                if (_fleetSnapshot == null || !string.Equals(_fleetSnapshot.DayKey, current, StringComparison.Ordinal))
                    _fleetSnapshot = new FleetMetricSnapshot { DayKey = current };
                changed = true;
            }
            if (changed)
            {
                ResetD160HistoryForBusinessDay(current);
                Log("D158 COUNTER day_reset=PASS business_day=" + current + " boundary=05:00 local_only=true");
            }
        }

        private void RecordD158PdaRequest()
        {
            EnsureD158BusinessCounterDay();
            Interlocked.Increment(ref _localPdaRequests);
        }

        private void RecordD158AgentResponse()
        {
            EnsureD158BusinessCounterDay();
            Interlocked.Increment(ref _localAgentResponses);
        }

        private void RecordD158ConfirmOutcome(bool success)
        {
            EnsureD158BusinessCounterDay();
            if (success) Interlocked.Increment(ref _localConfirmSuccess);
            else Interlocked.Increment(ref _localConfirmFailed);
        }

        private void MergeD135CounterSnapshot(string dayKey, long received, long confirmed, long error)
        {
            var key = string.IsNullOrWhiteSpace(dayKey)
                ? FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow)
                : dayKey;
            if (!string.Equals(_d135CounterDayKey, key, StringComparison.Ordinal))
            {
                _d135CounterDayKey = key;
                _d135CounterReceivedFloor = Math.Max(0L, received);
                _d135CounterConfirmedFloor = Math.Max(0L, confirmed);
                _d135CounterErrorFloor = Math.Max(0L, error);
                return;
            }
            _d135CounterReceivedFloor = Math.Max(_d135CounterReceivedFloor, Math.Max(0L, received));
            _d135CounterConfirmedFloor = Math.Max(_d135CounterConfirmedFloor, Math.Max(0L, confirmed));
            _d135CounterErrorFloor = Math.Max(_d135CounterErrorFloor, Math.Max(0L, error));
        }

        internal void ApplyD135DurableCounterAck(string dayKey, FirestoreConfirmationOutcome outcome)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string, FirestoreConfirmationOutcome>(ApplyD135DurableCounterAck), dayKey, outcome);
                return;
            }
            if (outcome == null) return;

            EnsureD158BusinessCounterDay();
            // D158 counter boundary is terminal/ACK time. A request created before 05:00
            // but ACKed after 05:00 belongs to the new operational day for the Agent UI.
            var key = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            var snapshot = _fleetSnapshot;
            if (!string.Equals(_d135CounterDayKey, key, StringComparison.Ordinal))
            {
                var sameSnapshotDay = snapshot != null && string.Equals(snapshot.DayKey, key, StringComparison.Ordinal);
                _d135CounterDayKey = key;
                _d135CounterReceivedFloor = sameSnapshotDay ? Math.Max(0L, snapshot.ReceivedTotal) : 0L;
                _d135CounterConfirmedFloor = sameSnapshotDay ? Math.Max(0L, snapshot.ConfirmedTotal) : 0L;
                _d135CounterErrorFloor = sameSnapshotDay ? Math.Max(0L, snapshot.ErrorTotal) : 0L;
            }

            _d135CounterReceivedFloor++;
            if (string.Equals(outcome.Result, "CONFIRMED", StringComparison.Ordinal) ||
                string.Equals(outcome.Result, "ALREADY_CONFIRMED", StringComparison.Ordinal))
                _d135CounterConfirmedFloor++;
            else
                _d135CounterErrorFloor++;

            RenderFleetMetricStatus(_leaderCoordinator != null && _leaderCoordinator.IsLeader);
            RefreshD128Overlay();
        }

        private void GetD135DisplayCounters(out long received, out long confirmed, out long error)
        {
            EnsureD158BusinessCounterDay();
            var current = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            var snapshot = _fleetSnapshot;
            if (snapshot != null && string.Equals(snapshot.DayKey, current, StringComparison.Ordinal))
                MergeD135CounterSnapshot(snapshot.DayKey, snapshot.ReceivedTotal, snapshot.ConfirmedTotal, snapshot.ErrorTotal);
            received = Math.Max(0L, _d135CounterReceivedFloor);
            confirmed = Math.Max(0L, _d135CounterConfirmedFloor);
            error = Math.Max(0L, _d135CounterErrorFloor);
        }

        private void RefreshD119OperationalViews(bool force)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<bool>(RefreshD119OperationalViews), force);
                return;
            }
            if (!HasAgentSession() || _agentSyncClient == null) return;
            var coordinator = _leaderCoordinator;
            var primary = coordinator != null && coordinator.IsLeader;
            RenderFleetMetricStatus(primary);

            if (primary)
            {
                ReconcileD134AgentSync(force);
                return;
            }

            var now = DateTime.UtcNow;
            var role = coordinator == null ? FirestoreAgentRole.DEEP_HIBERNATE : coordinator.Role;
            var noSnapshot = _agentSyncSnapshot == null || _agentSyncSnapshot.Version <= 0;
            var forcedInitial = force && noSnapshot &&
                (_lastD150DeepSyncReadUtc == DateTime.MinValue || now - _lastD150DeepSyncReadUtc >= TimeSpan.FromMinutes(1));
            var deepPeriodic = role == FirestoreAgentRole.DEEP_HIBERNATE &&
                (_lastD150DeepSyncReadUtc == DateTime.MinValue || now - _lastD150DeepSyncReadUtc >= TimeSpan.FromMinutes(10));
            if (!forcedInitial && !deepPeriodic) return;
            if (Interlocked.CompareExchange(ref _d150DeepSyncReadRunning, 1L, 0L) != 0L) return;
            _lastD150DeepSyncReadUtc = now; // attempt throttle: failure must not create a 30-second retry loop.

            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    ApplyD134AgentSyncSnapshot(_agentSyncClient.Load(SnapshotSession()));
                    Log("AGENT_SYNC deep_exact_read=PASS cadence=10m listener=false");
                }
                catch (Exception ex)
                {
                    Log("AGENT_SYNC deep_exact_read=DEFER retry_after=10m detail=" + SafeMessage(ex));
                }
                finally
                {
                    Interlocked.Exchange(ref _d150DeepSyncReadRunning, 0L);
                }
            });
        }

        private void ReconcileD134AgentSync(bool force)
        {
            if (_agentSyncClient == null || _pickerPresenceClient == null || _fleetMetricsClient == null) return;
            var now = DateTime.UtcNow;
            if (!force && _lastAgentSyncReconcileUtc != DateTime.MinValue &&
                now - _lastAgentSyncReconcileUtc < FirestoreAgentSyncClient.ReconcileInterval) return;
            if (force && _lastAgentSyncReconcileUtc != DateTime.MinValue &&
                now - _lastAgentSyncReconcileUtc < TimeSpan.FromMinutes(1)) return;
            if (Interlocked.CompareExchange(ref _agentSyncReconcileRunning, 1L, 0L) != 0L) return;

            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    var pickers = _pickerPresenceClient.Load(session);
                    Dictionary<string, PickerContactCommand> openCalls = null;
                    try { openCalls = _pickerContactClient.LoadOpen(session); }
                    catch (Exception ex) { Log("PICKER_ACTIVE_CALL reconcile=DEFER detail=" + SafeMessage(ex)); }
                    var counterDay = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
                    var generation = _leaderCoordinator == null ? "" : (_leaderCoordinator.Generation ?? "");
                    long counterReceived;
                    long counterConfirmed;
                    long counterError;
                    var needDurableRecoveryRead =
                        !string.Equals(_lastD158DailyCounterReadDay, counterDay, StringComparison.Ordinal) ||
                        !string.Equals(_lastD158DailyCounterReadGeneration, generation, StringComparison.Ordinal);
                    if (needDurableRecoveryRead)
                    {
                        var metrics = _fleetMetricsClient.RefreshPrimary(
                            session,
                            _agentInstanceId,
                            Interlocked.Read(ref _localPdaRequests),
                            Interlocked.Read(ref _localAgentResponses));
                        _lastD158DailyCounterReadDay = counterDay;
                        _lastD158DailyCounterReadGeneration = generation;
                        MergeD135CounterSnapshot(metrics.DayKey, metrics.ReceivedTotal, metrics.ConfirmedTotal, metrics.ErrorTotal);
                    }
                    GetD135DisplayCounters(out counterReceived, out counterConfirmed, out counterError);

                    var fleet = _leaderCoordinator == null
                        ? new List<AgentPresenceView>()
                        : _leaderCoordinator.OnlineAgents;
                    var snapshot = _agentSyncClient.Reconcile(
                        session,
                        pickers,
                        openCalls,
                        fleet,
                        counterReceived,
                        counterConfirmed,
                        counterError,
                        D160HistorySnapshotJson());
                    _lastAgentSyncReconcileUtc = DateTime.UtcNow;
                    ApplyD134AgentSyncSnapshot(snapshot);
                    Log("AGENT_SYNC reconcile=PASS cadence=5m max_agents=10");
                }
                catch (Exception ex)
                {
                    Log("AGENT_SYNC reconcile=DEFER detail=" + SafeMessage(ex));
                }
                finally
                {
                    Interlocked.Exchange(ref _agentSyncReconcileRunning, 0L);
                }
            });
        }

        private void UpdatePickerOnlineGrid(List<PickerPresenceView> items, bool primary)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<List<PickerPresenceView>, bool>(UpdatePickerOnlineGrid), items, primary);
                return;
            }
            _pickerOnlineSnapshot = (items ?? new List<PickerPresenceView>())
                .Where(x => x != null && !string.IsNullOrWhiteSpace(x.UserId))
                .OrderBy(x => string.IsNullOrWhiteSpace(x.EmployeeCode) ? x.UserId : x.EmployeeCode, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.DisplayName ?? "", StringComparer.CurrentCultureIgnoreCase)
                .ToList();
            _activePdaCountForRelay = _pickerOnlineSnapshot.Count;
            _pickerOnlineRenderSignature = "";
            RenderPickerOnlineSnapshot();
            _pickerOnlineStatus.Text =
                _pickerOnlineSnapshot.Count.ToString("N0") + " Picker đang hoạt động" +
                (primary ? " · PRIMARY" : " · đồng bộ fleet");
            RenderFleetMetricStatus(primary);
        }

        internal void ApplyPickerRequestActivity(FirestoreConfirmationWorkItem work)
        {
            if (work == null || string.IsNullOrWhiteSpace(work.PickerUserId)) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action<FirestoreConfirmationWorkItem>(ApplyPickerRequestActivity), work);
                return;
            }

            var incomingGeneration = Math.Max(0L, work.PickerSessionGeneration);
            var existing = _pickerOnlineSnapshot.FirstOrDefault(x =>
                x != null && string.Equals(x.UserId, work.PickerUserId, StringComparison.Ordinal));

            if (existing != null)
            {
                var existingIsLogin = !string.Equals(existing.Source, "PICKLIST", StringComparison.Ordinal);
                if (existingIsLogin &&
                    (incomingGeneration <= 0 || existing.SessionGeneration >= incomingGeneration))
                {
                    Log("PICKER_PRESENCE activity=PICKLIST fallback=SKIP_LOGIN_AUTHORITY user=" +
                        SafeUserLabel(existing.EmployeeCode, existing.UserId));
                    return;
                }

                if (!existingIsLogin &&
                    (incomingGeneration <= 0 || existing.SessionGeneration >= incomingGeneration))
                {
                    Log("PICKER_PRESENCE activity=PICKLIST fallback=SKIP_ALREADY_PRESENT user=" +
                        SafeUserLabel(existing.EmployeeCode, existing.UserId));
                    return;
                }
            }

            var picker = new PickerPresenceView
            {
                UserId = work.PickerUserId,
                FirebaseUid = work.PickerUid ?? "",
                SessionGeneration = incomingGeneration,
                Source = "PICKLIST",
                EmployeeCode = work.PickerEmployeeCode ?? "",
                DisplayName = work.PickerDisplayName ?? "",
                ContractorName = existing == null ? "" : (existing.ContractorName ?? ""),
                DeviceId = "",
                LoginAt = "",
                DeviceSeenAt = DateTime.UtcNow.ToString("o"),
                Status = "PDA_READY"
            };

            if (existing == null)
                _pickerOnlineSnapshot.Add(picker);
            else
            {
                // A newer PickList session may replace an older/stale local row.
                // Do not retain LOGIN-only fields on the fallback representation.
                existing.FirebaseUid = picker.FirebaseUid;
                existing.SessionGeneration = picker.SessionGeneration;
                existing.Source = "PICKLIST";
                existing.DeviceId = "";
                existing.LoginAt = "";
                if (!string.IsNullOrWhiteSpace(picker.EmployeeCode)) existing.EmployeeCode = picker.EmployeeCode;
                if (!string.IsNullOrWhiteSpace(picker.DisplayName)) existing.DisplayName = picker.DisplayName;
                if (!string.IsNullOrWhiteSpace(picker.ContractorName)) existing.ContractorName = picker.ContractorName;
                existing.DeviceSeenAt = picker.DeviceSeenAt;
                existing.Status = "PDA_READY";
                picker = existing;
            }

            UpdatePickerOnlineGrid(_pickerOnlineSnapshot, _leaderCoordinator != null && _leaderCoordinator.IsLeader);

            if (_leaderCoordinator != null && _leaderCoordinator.IsLeader && _agentSyncClient != null)
            {
                var captured = picker;
                Task.Run(() =>
                {
                    try
                    {
                        EnsureFreshToken();
                        // LOGIN may arrive while this task is queued. Never let a delayed
                        // fallback request downgrade that newer authoritative state.
                        if (!IsCurrentPicklistFallback(captured.UserId, captured.SessionGeneration))
                        {
                            Log("AGENT_SYNC picklist-upsert=SKIP_SUPERSEDED_BY_LOGIN user=" +
                                SafeUserLabel(captured.EmployeeCode, captured.UserId));
                            return;
                        }
                        ApplyD134AgentSyncSnapshot(_agentSyncClient.UpsertPicker(SnapshotSession(), captured));
                    }
                    catch (Exception ex)
                    {
                        Log("AGENT_SYNC picklist-upsert=DEFER detail=" + SafeMessage(ex));
                    }
                });
            }

            Log("PICKER_PRESENCE activity=PICKLIST fallback=UPSERT_ONCE user=" +
                SafeUserLabel(picker.EmployeeCode, picker.UserId));
        }

        private bool IsCurrentPicklistFallback(string userId, long generation)
        {
            if (InvokeRequired)
                return (bool)Invoke(new Func<string, long, bool>(IsCurrentPicklistFallback), userId, generation);

            var current = _pickerOnlineSnapshot.FirstOrDefault(item =>
                item != null && string.Equals(item.UserId, userId ?? "", StringComparison.Ordinal));
            return current != null &&
                   string.Equals(current.Source, "PICKLIST", StringComparison.Ordinal) &&
                   (generation <= 0 || current.SessionGeneration == generation);
        }

        private static string SafeUserLabel(string employeeCode, string userId)
        {
            var value = string.IsNullOrWhiteSpace(employeeCode) ? (userId ?? "") : employeeCode;
            return value.Length <= 32 ? value : value.Substring(0, 32);
        }

        private static string PickerSharedStateSignature(IEnumerable<PickerPresenceView> items)
        {
            return string.Join("\n", (items ?? new PickerPresenceView[0])
                .Where(item => item != null && !string.IsNullOrWhiteSpace(item.UserId))
                .OrderBy(item => item.UserId ?? "", StringComparer.Ordinal)
                .Select(item => string.Join("\u001f", new[]
                {
                    item.UserId ?? "",
                    item.FirebaseUid ?? "",
                    item.EmployeeCode ?? "",
                    item.DisplayName ?? "",
                    item.ContractorName ?? "",
                    item.DeviceId ?? "",
                    item.LoginAt ?? "",
                    item.Source ?? "LOGIN",
                    item.SessionGeneration.ToString()
                })));
        }

        private static Dictionary<string, long> ParsePresenceRemovals(string raw)
        {
            var result = new Dictionary<string, long>(StringComparer.Ordinal);
            if (string.IsNullOrWhiteSpace(raw)) return result;
            try
            {
                var rows = new JavaScriptSerializer().Deserialize<List<Dictionary<string, object>>>(raw);
                foreach (var row in rows ?? new List<Dictionary<string, object>>())
                {
                    object userObj;
                    object generationObj;
                    if (!row.TryGetValue("user_id", out userObj) ||
                        !row.TryGetValue("session_generation", out generationObj))
                        continue;

                    var userId = Convert.ToString(userObj) ?? "";
                    long generation;
                    if (string.IsNullOrWhiteSpace(userId) ||
                        !long.TryParse(Convert.ToString(generationObj), out generation) ||
                        generation <= 0)
                        continue;

                    long previous;
                    if (!result.TryGetValue(userId, out previous) || generation > previous)
                        result[userId] = generation;
                }
            }
            catch { }
            return result;
        }

        private void ApplyD161DirectPickerPresence(List<PickerPresenceView> items)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<List<PickerPresenceView>>(ApplyD161DirectPickerPresence), items);
                return;
            }
            if (!HasAgentSession()) return;
            _d161DirectPickerPresenceObserved = true;
            ApplyEventDrivenPickerPresence(items, "DIRECT_PRESENCE_LISTEN", "[]");
        }

        internal void ApplyEventDrivenPickerPresence(
            List<PickerPresenceView> items,
            string reason,
            string removedSessionsJson)
        {
            if (InvokeRequired)
            {
                BeginInvoke(
                    new Action<List<PickerPresenceView>, string, string>(ApplyEventDrivenPickerPresence),
                    items,
                    reason,
                    removedSessionsJson);
                return;
            }

            var incoming = (items ?? new List<PickerPresenceView>())
                .Where(item => item != null && !string.IsNullOrWhiteSpace(item.UserId))
                .ToList();
            var incomingIds = new HashSet<string>(
                incoming.Select(item => item.UserId),
                StringComparer.Ordinal);
            var removals = ParsePresenceRemovals(removedSessionsJson);

            // LOGIN is authoritative, but an older delayed projection may not
            // downgrade a newer session already observed locally. For the same user,
            // LOGIN wins at the same/newer generation; a strictly newer local session
            // is preserved until authoritative projection catches up.
            var currentByUser = _pickerOnlineSnapshot
                .Where(item => item != null && !string.IsNullOrWhiteSpace(item.UserId))
                .GroupBy(item => item.UserId, StringComparer.Ordinal)
                .ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.SessionGeneration).First(), StringComparer.Ordinal);
            var merged = new List<PickerPresenceView>();
            foreach (var authoritative in incoming)
            {
                PickerPresenceView current;
                if (currentByUser.TryGetValue(authoritative.UserId, out current) &&
                    current.SessionGeneration > 0 &&
                    current.SessionGeneration > authoritative.SessionGeneration)
                {
                    merged.Add(current);
                    Log("PICKER_PRESENCE authority=LOGIN_LOGOUT stale_login=SKIP_OLDER_GENERATION user=" +
                        SafeUserLabel(current.EmployeeCode, current.UserId));
                }
                else
                {
                    merged.Add(authoritative);
                }
            }

            // Preserve one-shot PickList fallback through unrelated presence changes.
            // Explicit logout/revoke metadata removes only matching/older fallback.
            foreach (var fallback in _pickerOnlineSnapshot.Where(item =>
                item != null &&
                string.Equals(item.Source, "PICKLIST", StringComparison.Ordinal) &&
                !string.IsNullOrWhiteSpace(item.UserId)))
            {
                if (incomingIds.Contains(fallback.UserId)) continue;
                long removedGeneration;
                if (removals.TryGetValue(fallback.UserId, out removedGeneration) &&
                    fallback.SessionGeneration <= removedGeneration)
                    continue;
                merged.Add(fallback);
            }

            var before = PickerSharedStateSignature(_pickerOnlineSnapshot);
            var after = PickerSharedStateSignature(merged);
            if (string.Equals(before, after, StringComparison.Ordinal))
            {
                Log("PICKER_PRESENCE authority=LOGIN_LOGOUT reason=" + AgentDiagnostics.Sanitize(reason) +
                    " shared=SKIP_NO_CHANGE count=" + merged.Count);
                return;
            }

            UpdatePickerOnlineGrid(merged, _leaderCoordinator != null && _leaderCoordinator.IsLeader);
            if (_leaderCoordinator != null && _leaderCoordinator.IsLeader && _agentSyncClient != null)
            {
                var snapshot = merged.ToList();
                Task.Run(() =>
                {
                    try
                    {
                        EnsureFreshToken();
                        ApplyD134AgentSyncSnapshot(_agentSyncClient.PublishPresence(SnapshotSession(), snapshot));
                    }
                    catch (Exception ex)
                    {
                        Log("AGENT_SYNC presence=DEFER " + D160ProviderErrorSummary(ex) + " retry=NONE_EVENT_DRIVEN");
                    }
                });
            }

            Log("PICKER_PRESENCE authority=LOGIN_LOGOUT reason=" + AgentDiagnostics.Sanitize(reason) +
                " shared=CHANGED count=" + merged.Count);
        }

        private void RefreshPickerWindowBoundary()
        {
            var now = _businessSchedule == null ? DateTime.Now : _businessSchedule.NowOperational();
            var open = _businessSchedule == null
                ? (now.TimeOfDay >= new TimeSpan(6, 0, 0) && now.TimeOfDay < new TimeSpan(22, 0, 0))
                : IsBusinessAllowed();
            if (_pickerWindowOpenState.HasValue && _pickerWindowOpenState.Value == open) return;
            _pickerWindowOpenState = open;

            if (!open)
            {
                RenderD157OperationalListsFromMemory();
                if (HasAgentSession())
                    _pickerOnlineStatus.Text =
                        _pickerOnlineSnapshot.Count.ToString("N0") +
                        " Picker đang hoạt động · ngoài ca nghiệp vụ; danh sách vẫn hiển thị theo phiên đăng nhập.";
                return;
            }

            // Crossing CLOSED -> ACTIVE changes business processing only. Picker
            // observation remains visible throughout the authenticated Agent session.
            RenderD157OperationalListsFromMemory();
            RefreshD119OperationalViews(true);
        }

        private void RenderD157OperationalListsFromMemory()
        {
            if (!HasAgentSession()) return;

            var coordinator = _leaderCoordinator;
            if (coordinator != null)
                UpdateAgentFleetGrid(coordinator.OnlineAgents);

            if (_d161DirectPickerPresenceObserved)
            {
                RenderPickerOnlineSnapshot();
                Log("D161 UI_SYNC render=MEMORY source=DIRECT_PRESENCE provider_read=false provider_write=false");
                return;
            }

            var snapshot = _agentSyncSnapshot;
            if (snapshot == null || snapshot.Version <= 0) return;

            UpdatePickerOnlineGrid(
                snapshot.Pickers,
                coordinator != null && coordinator.IsLeader);
            Log("D157 UI_SYNC render=MEMORY role=" +
                (coordinator == null ? "UNASSIGNED" : coordinator.RoleName) +
                " pickers=" + snapshot.Pickers.Count +
                " provider_read=false provider_write=false");
        }

        private string PickerOnlineRenderSignature(string query)
        {
            var signature = new StringBuilder(query ?? "");
            foreach (var picker in _pickerOnlineSnapshot)
            {
                signature.Append('|')
                    .Append(picker.UserId ?? "").Append(':')
                    .Append(picker.EmployeeCode ?? "").Append(':')
                    .Append(picker.DisplayName ?? "").Append(':')
                    .Append(picker.ContractorName ?? "").Append(':')
                    .Append(picker.Source ?? "").Append(':')
                    .Append(picker.SessionGeneration).Append(':');
                var active = ActivePickerCommand(picker.UserId);
                long lockUntil;
                lock (_pickerCallLocks) _pickerCallLocks.TryGetValue(picker.UserId ?? "", out lockUntil);
                signature.Append(active == null ? "0" : "1")
                    .Append(':').Append(active == null ? "" : active.SenderAgentId ?? "")
                    .Append(':').Append(active == null ? "" : active.SenderRole ?? "")
                    .Append(':').Append(lockUntil)
                    .Append(':').Append(IsPickerCallPending(picker.UserId) ? "P" : "-");
            }
            return signature.ToString();
        }

        private void RenderPickerOnlineSnapshot()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RenderPickerOnlineSnapshot));
                return;
            }
            var query = (_pickerSearch.Text ?? "").Trim();
            var renderSignature = PickerOnlineRenderSignature(query);
            if (string.Equals(renderSignature, _pickerOnlineRenderSignature, StringComparison.Ordinal))
                return;

            var firstUserId = "";
            try
            {
                if (_pickerOnlineGrid.Rows.Count > 0 &&
                    _pickerOnlineGrid.FirstDisplayedScrollingRowIndex >= 0)
                {
                    var first = _pickerOnlineGrid.Rows[_pickerOnlineGrid.FirstDisplayedScrollingRowIndex].Tag as PickerPresenceView;
                    firstUserId = first == null ? "" : first.UserId;
                }
            }
            catch { }

            var selectedUserId = "";
            try
            {
                if (_pickerOnlineGrid.SelectedRows.Count > 0)
                {
                    var selected = _pickerOnlineGrid.SelectedRows[0].Tag as PickerPresenceView;
                    selectedUserId = selected == null ? "" : selected.UserId;
                }
            }
            catch { }

            _pickerOnlineGrid.SuspendLayout();
            try
            {
                _pickerOnlineGrid.Rows.Clear();
                foreach (var picker in _pickerOnlineSnapshot)
                {
                    var code = string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.UserId : picker.EmployeeCode;
                    var name = string.IsNullOrWhiteSpace(picker.DisplayName) ? "—" : picker.DisplayName;
                    var contractor = string.IsNullOrWhiteSpace(picker.ContractorName) ? "—" : picker.ContractorName;
                    if (!string.IsNullOrWhiteSpace(query) &&
                        code.IndexOf(query, StringComparison.OrdinalIgnoreCase) < 0 &&
                        name.IndexOf(query, StringComparison.CurrentCultureIgnoreCase) < 0 &&
                        contractor.IndexOf(query, StringComparison.CurrentCultureIgnoreCase) < 0)
                        continue;

                    var source = string.Equals(picker.Source, "PICKLIST", StringComparison.Ordinal)
                        ? "PICKLIST"
                        : "LOGIN";
                    var active = ActivePickerCommand(picker.UserId);
                    var callLocked = IsPickerCallLocked(picker.UserId) || IsPickerCallPending(picker.UserId);
                    var canResolve = active != null && CanResolvePickerCommand(picker.UserId);
                    var resolveText = active == null ? "—" : (canResolve ? "Kết thúc" : "Agent khác đang gọi");
                    var row = _pickerOnlineGrid.Rows[_pickerOnlineGrid.Rows.Add(
                        code,
                        name,
                        contractor,
                        source,
                        "Kích User",
                        "Liên hệ picker",
                        resolveText)];
                    row.Tag = picker;
                    if (callLocked)
                    {
                        row.Cells["CallSpecialist"].ReadOnly = true;
                        row.Cells["CallSpecialist"].Style.BackColor = Color.Gainsboro;
                        row.Cells["CallSpecialist"].Style.ForeColor = Color.DimGray;
                    }
                    if (!canResolve)
                    {
                        row.Cells["ResolveContact"].ReadOnly = true;
                        row.Cells["ResolveContact"].Style.BackColor = Color.Gainsboro;
                        row.Cells["ResolveContact"].Style.ForeColor = Color.DimGray;
                    }
                    if (string.IsNullOrWhiteSpace(picker.FirebaseUid) || picker.SessionGeneration <= 0)
                    {
                        row.Cells["KickUser"].ReadOnly = true;
                        row.Cells["KickUser"].Style.BackColor = Color.Gainsboro;
                        row.Cells["KickUser"].Style.ForeColor = Color.DimGray;
                    }
                }

                var firstIndex = -1;
                var selectedIndex = -1;
                for (var index = 0; index < _pickerOnlineGrid.Rows.Count; index++)
                {
                    var picker = _pickerOnlineGrid.Rows[index].Tag as PickerPresenceView;
                    if (picker == null) continue;
                    if (firstIndex < 0 && picker.UserId == firstUserId) firstIndex = index;
                    if (selectedIndex < 0 && picker.UserId == selectedUserId) selectedIndex = index;
                }
                if (firstIndex >= 0) _pickerOnlineGrid.FirstDisplayedScrollingRowIndex = firstIndex;
                if (selectedIndex >= 0) _pickerOnlineGrid.Rows[selectedIndex].Selected = true;
                ApplyColumnSizingIfEnabled(_pickerOnlineGrid);
                _pickerOnlineRenderSignature = renderSignature;
            }
            finally
            {
                _pickerOnlineGrid.ResumeLayout();
            }
        }

        private void RenderFleetMetricStatus(bool primary)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<bool>(RenderFleetMetricStatus), primary);
                return;
            }
            // D149: keep the durable D135 counters merged for HA/diagnostics, but
            // do not render the former "Hôm nay toàn cụm" text cluster in the Picker list.
            long received, confirmed, error;
            GetD135DisplayCounters(out received, out confirmed, out error);
            _fleetMetricStatus.Text = "";
            _fleetMetricStatus.Visible = false;
            RefreshAgentRequestMetrics();
        }

        private void RefreshAgentRequestMetrics()
        {
            EnsureD158BusinessCounterDay();
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RefreshAgentRequestMetrics));
                return;
            }
            var received = Interlocked.Read(ref _localPdaRequests);
            var processed = Interlocked.Read(ref _localAgentResponses);
            var success = Interlocked.Read(ref _localConfirmSuccess);
            var failed = Interlocked.Read(ref _localConfirmFailed);
            var pending = Math.Max(0L, received - processed);
            _agentRequestMetrics.Text =
                "Agent này · Nhận " + received.ToString("N0") +
                " · Đã xử lý " + processed.ToString("N0") +
                " · Thành công " + success.ToString("N0") +
                " · Lỗi " + failed.ToString("N0") +
                " · Chờ " + pending.ToString("N0");
            RefreshD128Overlay();
        }

        private void InitializeD128Overlay()
        {
            InitializeD128OverlaySettingsSurface();
            EnsureD128OverlayTrayMenu();
            TryInitializeD128Overlay("startup");
        }

        private void InitializeD128OverlaySettingsSurface()
        {
            if (_d128OverlayUiInitialized) return;

            var overlayCard = NewCard(22, 344, 1040, 150);
            overlayCard.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            overlayCard.Controls.Add(new Label
            {
                Left = 18, Top = 14, Width = 980, Height = 28,
                Text = "Bảng nổi Picklist",
                Font = new Font("Segoe UI Semibold", 13F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            overlayCard.Controls.Add(new Label
            {
                Left = 18, Top = 48, Width = 960, Height = 32,
                Text = "Picklist nhận | Picklist xác nhận | Picklist lỗi. Khi khóa, chuột xuyên qua bảng nổi xuống chương trình phía sau.",
                ForeColor = Color.DimGray
            });

            _d128OverlayStatus.SetBounds(18, 80, 960, 20);
            _d128OverlayStatus.Text = "Bảng nổi: đang khởi tạo...";
            _d128OverlayStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _d128OverlayStatus.AutoEllipsis = true;
            overlayCard.Controls.Add(_d128OverlayStatus);

            _d128OverlaySettingsButton.SetBounds(18, 104, 190, 34);
            _d128OverlaySettingsButton.Text = "Cài đặt bảng nổi";
            _d128OverlaySettingsButton.Enabled = false;
            _d128OverlaySettingsButton.Click += (s, e) => OpenD128OverlaySettings();
            overlayCard.Controls.Add(_d128OverlaySettingsButton);

            _d128OverlayRetryButton.SetBounds(216, 104, 170, 34);
            _d128OverlayRetryButton.Text = "Thử lại bảng nổi";
            _d128OverlayRetryButton.Enabled = false;
            _d128OverlayRetryButton.Click += (s, e) => TryInitializeD128Overlay("manual_retry");
            overlayCard.Controls.Add(_d128OverlayRetryButton);

            _connectionPage.Controls.Add(overlayCard);
            _d128OverlayUiInitialized = true;
            AgentDiagnostics.Write("D128_OVERLAY init=PASS stage=SETTINGS_CARD");
        }

        private void EnsureD128OverlayTrayMenu()
        {
            if (_d128OverlayTrayInitialized) return;
            var menu = _tray.ContextMenuStrip;
            if (menu == null) return;

            menu.Items.Add(new ToolStripSeparator());

            _d128OverlayVisibleMenu = new ToolStripMenuItem("Hiển thị bảng nổi");
            _d128OverlayVisibleMenu.Click += (s, e) =>
            {
                var overlay = _d128Overlay;
                if (overlay == null || overlay.IsDisposed) return;
                overlay.SetOverlayVisible(!overlay.OverlayVisible);
                RefreshD128OverlayMenu();
            };
            menu.Items.Add(_d128OverlayVisibleMenu);

            _d128OverlayLockedMenu = new ToolStripMenuItem("Khóa bảng nổi / chuột xuyên qua");
            _d128OverlayLockedMenu.Click += (s, e) =>
            {
                var overlay = _d128Overlay;
                if (overlay == null || overlay.IsDisposed) return;
                overlay.SetLocked(!overlay.IsLocked);
                RefreshD128OverlayMenu();
            };
            menu.Items.Add(_d128OverlayLockedMenu);

            _d128OverlaySettingsMenu = new ToolStripMenuItem("Cài đặt bảng nổi...");
            _d128OverlaySettingsMenu.Click += (s, e) => OpenD128OverlaySettings();
            menu.Items.Add(_d128OverlaySettingsMenu);

            _d128OverlayTrayInitialized = true;
            RefreshD128OverlayMenu();
            AgentDiagnostics.Write("D128_OVERLAY init=PASS stage=TRAY_MENU");
        }

        private bool TryInitializeD128Overlay(string reason)
        {
            if (_d128Overlay != null && !_d128Overlay.IsDisposed)
            {
                UpdateD128OverlayAvailability(true, "");
                return true;
            }

            var stage = "CONSTRUCT";
            try
            {
                AgentDiagnostics.Write("D128_OVERLAY init=START reason=" + AgentDiagnostics.Sanitize(reason ?? "unknown"));

                _d128Overlay = new D128OverlayForm(D128OverlaySettingsFile);
                _d128Overlay.SettingsChanged += RefreshD128OverlayMenu;
                AgentDiagnostics.Write("D128_OVERLAY init=PASS stage=CONSTRUCT");

                stage = "REFRESH_COUNTER";
                RefreshD128Overlay();
                AgentDiagnostics.Write("D128_OVERLAY init=PASS stage=REFRESH_COUNTER");

                stage = "SHOW";
                if (_d128Overlay.OverlayVisible) _d128Overlay.Show();
                AgentDiagnostics.Write("D128_OVERLAY init=PASS stage=SHOW visible=" + (_d128Overlay.OverlayVisible ? "true" : "false"));

                UpdateD128OverlayAvailability(true, "");
                RefreshD128OverlayMenu();
                AgentDiagnostics.Write("D128_OVERLAY init=PASS stage=COMPLETE");
                return true;
            }
            catch (Exception ex)
            {
                try
                {
                    if (_d128Overlay != null)
                    {
                        _d128Overlay.SettingsChanged -= RefreshD128OverlayMenu;
                        _d128Overlay.Dispose();
                    }
                }
                catch { }
                _d128Overlay = null;
                UpdateD128OverlayAvailability(false, ex.GetType().Name);
                RefreshD128OverlayMenu();
                AgentDiagnostics.Write(
                    "D128_OVERLAY init=FAIL stage=" + stage +
                    " type=" + ex.GetType().Name +
                    " message=" + AgentDiagnostics.Sanitize(ex.Message ?? ""));
                return false;
            }
        }

        private void RetryD128OverlayAfterD160UiInitialized()
        {
            if (_d128Overlay != null && !_d128Overlay.IsDisposed) return;
            if (_d128OverlayAutoRetryAttempted) return;
            _d128OverlayAutoRetryAttempted = true;
            AgentDiagnostics.Write("D128_OVERLAY retry=AUTO_ONCE_AFTER_D160_UI");
            TryInitializeD128Overlay("post_d160_ui_auto_once");
        }

        private void UpdateD128OverlayAvailability(bool available, string errorType)
        {
            if (!_d128OverlayUiInitialized) return;
            _d128OverlaySettingsButton.Enabled = available;
            _d128OverlayRetryButton.Enabled = !available;
            _d128OverlayStatus.Text = available
                ? "Bảng nổi: sẵn sàng."
                : "Bảng nổi: lỗi khởi tạo" + (string.IsNullOrWhiteSpace(errorType) ? "." : " (" + errorType + "). Có thể thử lại thủ công.");
            _d128OverlayStatus.ForeColor = available
                ? Color.FromArgb(45, 112, 72)
                : Color.FromArgb(163, 66, 52);
        }

        private void RefreshD128Overlay()
        {
            var overlay = _d128Overlay;
            if (overlay == null || overlay.IsDisposed) return;
            long received, confirmed, error;
            GetD135DisplayCounters(out received, out confirmed, out error);
            overlay.UpdatePicklistMetrics(received, confirmed, error);
        }

        private void RefreshD128OverlayMenu()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RefreshD128OverlayMenu));
                return;
            }
            var available = _d128Overlay != null && !_d128Overlay.IsDisposed;
            if (_d128OverlayVisibleMenu != null)
            {
                _d128OverlayVisibleMenu.Enabled = available;
                _d128OverlayVisibleMenu.Checked = available && _d128Overlay.OverlayVisible;
            }
            if (_d128OverlayLockedMenu != null)
            {
                _d128OverlayLockedMenu.Enabled = available;
                _d128OverlayLockedMenu.Checked = available && _d128Overlay.IsLocked;
            }
            if (_d128OverlaySettingsMenu != null)
                _d128OverlaySettingsMenu.Enabled = available;
        }

        private void OpenD128OverlaySettings()
        {
            if (_d128Overlay == null || _d128Overlay.IsDisposed)
            {
                TryInitializeD128Overlay("open_settings");
                if (_d128Overlay == null || _d128Overlay.IsDisposed) return;
            }
            using (var dialog = new D128OverlaySettingsDialog(_d128Overlay))
                dialog.ShowDialog(this);
            RefreshD128OverlayMenu();
        }

        private sealed class D128OverlayForm : Form
        {
            private const int WsExTransparent = 0x20;
            private const int WsExToolWindow = 0x80;
            private const int WsExNoActivate = 0x08000000;
            private const int GwlExStyle = -20;
            private const int WmNcHitTest = 0x0084;
            private const int HtTransparent = -1;
            private const int HtLeft = 10;
            private const int HtRight = 11;
            private const int HtTop = 12;
            private const int HtTopLeft = 13;
            private const int HtTopRight = 14;
            private const int HtBottom = 15;
            private const int HtBottomLeft = 16;
            private const int HtBottomRight = 17;
            private const int ResizeGrip = 9;

            private readonly Label _text = new Label();
            private readonly string _settingsPath;
            private int _savedLeft = int.MinValue;
            private int _savedTop = int.MinValue;
            private int _backgroundArgb = Color.FromArgb(28, 35, 43).ToArgb();
            private int _textArgb = Color.White.ToArgb();
            private double _overlayOpacity = 0.78;
            private bool _locked = true;
            private bool _overlayVisible = true;
            private bool _sizeCustomized;
            private bool _dragging;
            private Point _dragOrigin;
            private Point _windowOrigin;

            internal event Action SettingsChanged;

            internal D128OverlayForm(string settingsPath)
            {
                _settingsPath = settingsPath ?? "";
                LoadSettings();

                Text = "Agent Auto Confirm Pick Pack - Overlay";
                FormBorderStyle = FormBorderStyle.None;
                ShowInTaskbar = false;
                TopMost = true;
                StartPosition = FormStartPosition.Manual;
                MinimumSize = new Size(120, 24);
                MaximumSize = new Size(7680, 4320);
                Size = new Size(ClampWidth(Width <= 0 ? 620 : Width), ClampHeight(Height <= 0 ? 52 : Height));
                BackColor = SafeColor(_backgroundArgb, Color.FromArgb(28, 35, 43));
                Opacity = ClampOpacity(_overlayOpacity);
                Padding = new Padding(10, 5, 10, 5);

                _text.Dock = DockStyle.Fill;
                _text.TextAlign = ContentAlignment.MiddleLeft;
                _text.AutoEllipsis = true;
                _text.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
                _text.Text = "Picklist nhận: 0 | Picklist xác nhận: 0 | Picklist lỗi: 0";
                _text.ForeColor = SafeColor(_textArgb, Color.White);
                Controls.Add(_text);
                if (!_sizeCustomized) AutoFitToContent();

                foreach (Control control in new Control[] { this, _text })
                {
                    control.MouseDown += BeginDrag;
                    control.MouseMove += ContinueDrag;
                    control.MouseUp += EndDrag;
                }

                ApplySavedPosition();
                Shown += (s, e) => ApplyInteractionMode();
                ResizeEnd += (s, e) =>
                {
                    if (IsLocked) return;
                    _sizeCustomized = true;
                    Persist();
                };
            }

            protected override bool ShowWithoutActivation { get { return IsLocked; } }

            protected override CreateParams CreateParams
            {
                get
                {
                    var cp = base.CreateParams;
                    cp.ExStyle |= WsExToolWindow | WsExNoActivate;
                    if (IsLocked) cp.ExStyle |= WsExTransparent;
                    return cp;
                }
            }

            protected override void WndProc(ref Message m)
            {
                if (m.Msg == WmNcHitTest)
                {
                    if (IsLocked)
                    {
                        m.Result = new IntPtr(HtTransparent);
                        return;
                    }

                    var raw = m.LParam.ToInt64();
                    var screenPoint = new Point(
                        unchecked((short)(raw & 0xffff)),
                        unchecked((short)((raw >> 16) & 0xffff)));
                    var point = PointToClient(screenPoint);
                    var left = point.X <= ResizeGrip;
                    var right = point.X >= ClientSize.Width - ResizeGrip;
                    var top = point.Y <= ResizeGrip;
                    var bottom = point.Y >= ClientSize.Height - ResizeGrip;

                    if (left && top) m.Result = new IntPtr(HtTopLeft);
                    else if (right && top) m.Result = new IntPtr(HtTopRight);
                    else if (left && bottom) m.Result = new IntPtr(HtBottomLeft);
                    else if (right && bottom) m.Result = new IntPtr(HtBottomRight);
                    else if (left) m.Result = new IntPtr(HtLeft);
                    else if (right) m.Result = new IntPtr(HtRight);
                    else if (top) m.Result = new IntPtr(HtTop);
                    else if (bottom) m.Result = new IntPtr(HtBottom);
                    else
                    {
                        base.WndProc(ref m);
                        return;
                    }
                    return;
                }
                base.WndProc(ref m);
            }

            internal bool IsLocked { get { return _locked; } }
            internal bool OverlayVisible { get { return _overlayVisible; } }
            internal double OverlayOpacity { get { return _overlayOpacity; } }
            internal int OverlayWidth { get { return Width; } }
            internal int OverlayHeight { get { return Height; } }
            internal Color OverlayBackgroundColor { get { return SafeColor(_backgroundArgb, Color.FromArgb(28, 35, 43)); } }
            internal Color OverlayTextColor { get { return SafeColor(_textArgb, Color.White); } }

            internal void UpdatePicklistMetrics(long received, long confirmed, long failed)
            {
                if (IsDisposed) return;
                if (InvokeRequired)
                {
                    BeginInvoke(new Action<long, long, long>(UpdatePicklistMetrics), received, confirmed, failed);
                    return;
                }
                _text.Text =
                    "Picklist nhận: " + Math.Max(0L, received).ToString("N0") +
                    " | Picklist xác nhận: " + Math.Max(0L, confirmed).ToString("N0") +
                    " | Picklist lỗi: " + Math.Max(0L, failed).ToString("N0");
                if (!_sizeCustomized) AutoFitToContent();
            }

            internal void SetLocked(bool locked)
            {
                if (_locked == locked) return;
                _locked = locked;
                _dragging = false;
                ApplyInteractionMode();
                Persist();
            }

            internal void SetOverlayVisible(bool visible)
            {
                _overlayVisible = visible;
                if (visible)
                {
                    if (!Visible) Show();
                    TopMost = true;
                }
                else Hide();
                Persist();
            }

            internal void SetOverlayOpacity(double value)
            {
                _overlayOpacity = ClampOpacity(value);
                Opacity = _overlayOpacity;
                Persist();
            }

            internal void SetOverlaySize(int width, int height)
            {
                if (IsLocked) return;
                _sizeCustomized = true;
                Size = new Size(ClampWidth(width), ClampHeight(height));
                Persist();
            }

            internal void SetBackgroundColor(Color color)
            {
                _backgroundArgb = color.ToArgb();
                BackColor = color;
                Persist();
            }

            internal void SetTextColor(Color color)
            {
                _textArgb = color.ToArgb();
                _text.ForeColor = color;
                Persist();
            }

            private void ApplySavedPosition()
            {
                if (_savedLeft != int.MinValue && _savedTop != int.MinValue)
                {
                    Location = ClampToScreens(new Point(_savedLeft, _savedTop), Size);
                    return;
                }
                var area = Screen.PrimaryScreen == null ? new Rectangle(0, 0, 1280, 720) : Screen.PrimaryScreen.WorkingArea;
                Location = new Point(Math.Max(area.Left, area.Right - Width - 12), Math.Max(area.Top, area.Bottom - Height - 12));
            }

            private void ApplyInteractionMode()
            {
                TopMost = true;
                Cursor = IsLocked ? Cursors.Default : Cursors.SizeAll;
                try
                {
                    var style = GetWindowLong(Handle, GwlExStyle);
                    var next = IsLocked ? style | WsExTransparent | WsExNoActivate : style & ~WsExTransparent;
                    if (next != style) SetWindowLong(Handle, GwlExStyle, next);
                }
                catch { }
            }

            private void BeginDrag(object sender, MouseEventArgs e)
            {
                if (IsLocked || e.Button != MouseButtons.Left) return;
                var p = PointToClient(Cursor.Position);
                if (p.X <= ResizeGrip || p.X >= ClientSize.Width - ResizeGrip ||
                    p.Y <= ResizeGrip || p.Y >= ClientSize.Height - ResizeGrip) return;
                _dragging = true;
                _dragOrigin = Cursor.Position;
                _windowOrigin = Location;
            }

            private void ContinueDrag(object sender, MouseEventArgs e)
            {
                if (!_dragging || IsLocked) return;
                var now = Cursor.Position;
                Location = ClampToScreens(
                    new Point(_windowOrigin.X + now.X - _dragOrigin.X, _windowOrigin.Y + now.Y - _dragOrigin.Y),
                    Size);
            }

            private void EndDrag(object sender, MouseEventArgs e)
            {
                if (!_dragging) return;
                _dragging = false;
                Persist();
            }

            private void LoadSettings()
            {
                Width = 620;
                Height = 52;
                try
                {
                    if (string.IsNullOrWhiteSpace(_settingsPath) || !File.Exists(_settingsPath)) return;
                    var map = new JavaScriptSerializer().DeserializeObject(File.ReadAllText(_settingsPath)) as Dictionary<string, object>;
                    if (map == null) return;
                    object value;
                    if (map.TryGetValue("left", out value)) _savedLeft = Convert.ToInt32(value);
                    if (map.TryGetValue("top", out value)) _savedTop = Convert.ToInt32(value);
                    if (map.TryGetValue("width", out value)) Width = ClampWidth(Convert.ToInt32(value));
                    if (map.TryGetValue("height", out value)) Height = ClampHeight(Convert.ToInt32(value));
                    if (map.TryGetValue("background_argb", out value)) _backgroundArgb = Convert.ToInt32(value);
                    if (map.TryGetValue("text_argb", out value)) _textArgb = Convert.ToInt32(value);
                    if (map.TryGetValue("opacity", out value)) _overlayOpacity = ClampOpacity(Convert.ToDouble(value));
                    if (map.TryGetValue("locked", out value)) _locked = Convert.ToBoolean(value);
                    if (map.TryGetValue("visible", out value)) _overlayVisible = Convert.ToBoolean(value);
                    if (map.TryGetValue("size_customized", out value))
                        _sizeCustomized = Convert.ToBoolean(value);
                    else
                        _sizeCustomized = Width != 620 || Height != 52;
                }
                catch { }
            }

            private void AutoFitToContent()
            {
                if (_sizeCustomized || _text == null) return;
                try
                {
                    var measured = TextRenderer.MeasureText(
                        _text.Text ?? "",
                        _text.Font,
                        new Size(int.MaxValue, int.MaxValue),
                        TextFormatFlags.SingleLine | TextFormatFlags.NoPadding);
                    Size = new Size(
                        ClampWidth(measured.Width + Padding.Horizontal + 12),
                        ClampHeight(measured.Height + Padding.Vertical + 8));
                }
                catch { }
            }

            private void Persist()
            {
                _savedLeft = Left;
                _savedTop = Top;
                try
                {
                    var dir = Path.GetDirectoryName(_settingsPath);
                    if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                    var payload = new Dictionary<string, object>
                    {
                        { "left", Left }, { "top", Top }, { "width", Width }, { "height", Height },
                        { "background_argb", _backgroundArgb }, { "text_argb", _textArgb },
                        { "opacity", _overlayOpacity }, { "locked", _locked }, { "visible", _overlayVisible },
                        { "size_customized", _sizeCustomized }
                    };
                    File.WriteAllText(_settingsPath, new JavaScriptSerializer().Serialize(payload));
                }
                catch { }
                var handler = SettingsChanged;
                if (handler != null) handler();
            }

            private static int ClampWidth(int value) { return Math.Max(120, Math.Min(7680, value)); }
            private static int ClampHeight(int value) { return Math.Max(24, Math.Min(4320, value)); }
            private static double ClampOpacity(double value) { return Math.Max(0.35, Math.Min(1.0, value)); }
            private static Color SafeColor(int argb, Color fallback)
            {
                try { return argb == 0 ? fallback : Color.FromArgb(argb); } catch { return fallback; }
            }
            private static Point ClampToScreens(Point point, Size size)
            {
                foreach (var screen in Screen.AllScreens)
                {
                    var area = screen.WorkingArea;
                    if (area.IntersectsWith(new Rectangle(point, size)))
                        return new Point(
                            Math.Max(area.Left, Math.Min(point.X, area.Right - size.Width)),
                            Math.Max(area.Top, Math.Min(point.Y, area.Bottom - size.Height)));
                }
                var fallback = Screen.PrimaryScreen == null ? new Rectangle(0, 0, 1280, 720) : Screen.PrimaryScreen.WorkingArea;
                return new Point(Math.Max(fallback.Left, fallback.Right - size.Width - 12),
                    Math.Max(fallback.Top, fallback.Bottom - size.Height - 12));
            }

            [DllImport("user32.dll", EntryPoint = "GetWindowLong", SetLastError = true)]
            private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
            [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
            private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        }

        private sealed class D128OverlaySettingsDialog : Form
        {
            private readonly D128OverlayForm _overlay;
            private readonly CheckBox _visible = new CheckBox();
            private readonly CheckBox _locked = new CheckBox();
            private readonly TrackBar _opacity = new TrackBar();
            private readonly Label _opacityValue = new Label();
            private readonly NumericUpDown _width = new NumericUpDown();
            private readonly NumericUpDown _height = new NumericUpDown();
            private readonly Label _help = new Label();

            internal D128OverlaySettingsDialog(D128OverlayForm overlay)
            {
                _overlay = overlay;
                Text = "Cài đặt bảng nổi";
                Width = 490;
                Height = 450;
                FormBorderStyle = FormBorderStyle.FixedDialog;
                MaximizeBox = false;
                MinimizeBox = false;
                ShowInTaskbar = false;
                StartPosition = FormStartPosition.CenterParent;
                Font = new Font("Segoe UI", 9F);

                _visible.SetBounds(18, 18, 420, 26);
                _visible.Text = "Hiển thị bảng nổi Picklist";
                _visible.Checked = overlay.OverlayVisible;
                _visible.CheckedChanged += (s, e) => overlay.SetOverlayVisible(_visible.Checked);
                Controls.Add(_visible);

                Controls.Add(new Label { Left = 18, Top = 56, Width = 330, Height = 22, Text = "Độ trong của nền" });
                _opacity.SetBounds(16, 80, 360, 42);
                _opacity.Minimum = 35;
                _opacity.Maximum = 100;
                _opacity.TickFrequency = 5;
                _opacity.Value = Math.Max(35, Math.Min(100, (int)Math.Round(overlay.OverlayOpacity * 100.0)));
                _opacity.Scroll += (s, e) =>
                {
                    overlay.SetOverlayOpacity(_opacity.Value / 100.0);
                    _opacityValue.Text = _opacity.Value + "%";
                };
                Controls.Add(_opacity);
                _opacityValue.SetBounds(384, 86, 58, 24);
                _opacityValue.Text = _opacity.Value + "%";
                Controls.Add(_opacityValue);

                _locked.SetBounds(18, 132, 430, 26);
                _locked.Text = "Khóa vị trí/kích thước và cho chuột xuyên qua";
                _locked.Checked = overlay.IsLocked;
                _locked.CheckedChanged += (s, e) =>
                {
                    overlay.SetLocked(_locked.Checked);
                    RefreshEditState();
                };
                Controls.Add(_locked);

                Controls.Add(new Label { Left = 18, Top = 176, Width = 95, Height = 22, Text = "Chiều rộng" });
                _width.SetBounds(118, 172, 100, 28);
                _width.Minimum = 120;
                _width.Maximum = 7680;
                _width.Value = Math.Max(_width.Minimum, Math.Min(_width.Maximum, overlay.OverlayWidth));
                Controls.Add(_width);

                Controls.Add(new Label { Left = 248, Top = 176, Width = 85, Height = 22, Text = "Chiều cao" });
                _height.SetBounds(338, 172, 100, 28);
                _height.Minimum = 24;
                _height.Maximum = 4320;
                _height.Value = Math.Max(_height.Minimum, Math.Min(_height.Maximum, overlay.OverlayHeight));
                Controls.Add(_height);

                _width.ValueChanged += (s, e) => { if (!_locked.Checked) overlay.SetOverlaySize((int)_width.Value, (int)_height.Value); };
                _height.ValueChanged += (s, e) => { if (!_locked.Checked) overlay.SetOverlaySize((int)_width.Value, (int)_height.Value); };

                var background = new Button { Left = 18, Top = 220, Width = 200, Height = 34, Text = "Chọn màu nền..." };
                background.Click += (s, e) =>
                {
                    using (var dialog = new ColorDialog { FullOpen = true, AnyColor = true, Color = overlay.OverlayBackgroundColor })
                    {
                        if (dialog.ShowDialog(this) == DialogResult.OK) overlay.SetBackgroundColor(dialog.Color);
                    }
                };
                Controls.Add(background);

                var foreground = new Button { Left = 238, Top = 220, Width = 200, Height = 34, Text = "Chọn màu chữ..." };
                foreground.Click += (s, e) =>
                {
                    using (var dialog = new ColorDialog { FullOpen = true, AnyColor = true, Color = overlay.OverlayTextColor })
                    {
                        if (dialog.ShowDialog(this) == DialogResult.OK) overlay.SetTextColor(dialog.Color);
                    }
                };
                Controls.Add(foreground);

                _help.SetBounds(18, 274, 420, 76);
                _help.ForeColor = Color.DimGray;
                Controls.Add(_help);

                var close = new Button { Left = 348, Top = 370, Width = 90, Height = 30, Text = "Đóng" };
                close.Click += (s, e) => Close();
                Controls.Add(close);
                RefreshEditState();
            }

            private void RefreshEditState()
            {
                var editable = !_locked.Checked;
                _width.Enabled = editable;
                _height.Enabled = editable;
                _help.Text = _locked.Checked
                    ? "Đang khóa: bảng nổi cố định và chuột xuyên xuống chương trình phía sau. Mở khóa để kéo hoặc đổi kích thước."
                    : "Đang mở khóa: kéo bảng nổi để đổi vị trí; nhập kích thước hoặc kéo mép/góc. Màu nền, màu chữ và độ trong vẫn thay đổi được.";
            }
        }

        private void ApplyD128ResourceMetrics(SystemMetrics agent, BrowserResourceSnapshot browser)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<SystemMetrics, BrowserResourceSnapshot>(ApplyD128ResourceMetrics), agent, browser);
                return;
            }

            if (agent != null)
            {
                _d128AgentResourceStatus.Text =
                    "CPU: " + agent.ProcessCpuPercent.ToString("0.0") + "% | RAM: " +
                    (agent.ProcessWorkingSetBytes / 1024d / 1024d).ToString("0") + " MB | Thời gian chạy: " +
                    FormatD128Duration(agent.ProcessUptime);
            }

            if (browser == null || !browser.Available)
            {
                _d128BrowserResourceStatus.Text = "CPU: -- | RAM: -- | Tiến trình: -- | Thời gian chạy: --";
            }
            else
            {
                _d128BrowserResourceStatus.Text =
                    "CPU: " + browser.CpuPercent.ToString("0.0") + "% | RAM: " +
                    (browser.WorkingSetBytes / 1024d / 1024d).ToString("0") + " MB | Tiến trình: " +
                    browser.ProcessCount + " | Thời gian chạy: " +
                    FormatD128Duration(browser.RunningFor);
            }
        }

        private void RefreshD130ResourceClock()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RefreshD130ResourceClock));
                return;
            }
            if (!Visible || _lastD130ResourceSampleUtc == DateTime.MinValue) return;

            var elapsed = DateTime.UtcNow - _lastD130ResourceSampleUtc;
            if (elapsed < TimeSpan.Zero) elapsed = TimeSpan.Zero;

            var agent = _lastD130AgentMetrics;
            if (agent != null)
            {
                _d128AgentResourceStatus.Text =
                    "CPU: " + agent.ProcessCpuPercent.ToString("0.0") + "% | RAM: " +
                    (agent.ProcessWorkingSetBytes / 1024d / 1024d).ToString("0") + " MB | Thời gian chạy: " +
                    FormatD128Duration(agent.ProcessUptime + elapsed);
                _d128AgentResourceStatus.Refresh();
            }

            var browser = _lastD130BrowserMetrics;
            if (browser != null && browser.Available)
            {
                _d128BrowserResourceStatus.Text =
                    "CPU: " + browser.CpuPercent.ToString("0.0") + "% | RAM: " +
                    (browser.WorkingSetBytes / 1024d / 1024d).ToString("0") + " MB | Tiến trình: " +
                    browser.ProcessCount + " | Thời gian chạy: " +
                    FormatD128Duration(browser.RunningFor + elapsed);
                _d128BrowserResourceStatus.Refresh();
            }
        }

        private void SetD128ResourceMonitoringPaused()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(SetD128ResourceMonitoringPaused));
                return;
            }
            _lastD130AgentMetrics = null;
            _lastD130BrowserMetrics = null;
            _lastD130ResourceSampleUtc = DateTime.MinValue;
            _d128AgentResourceStatus.Text = "Tài nguyên Agent: tạm dừng đo khi chạy nền";
            _d128BrowserResourceStatus.Text = "Tài nguyên Web: tạm dừng đo khi chạy nền";
        }

        private static string FormatD128Duration(TimeSpan value)
        {
            if (value < TimeSpan.Zero) value = TimeSpan.Zero;
            var totalHours = (int)Math.Floor(value.TotalHours);
            return totalHours.ToString("00") + ":" + value.Minutes.ToString("00") + ":" + value.Seconds.ToString("00");
        }

        private bool HasActivePickerCommand(string userId)
        {
            lock (_activePickerCommands) return _activePickerCommands.ContainsKey(userId);
        }

        private PickerContactCommand ActivePickerCommand(string userId)
        {
            lock (_activePickerCommands)
            {
                PickerContactCommand command;
                return _activePickerCommands.TryGetValue(userId ?? "", out command) ? command : null;
            }
        }

        private bool CanResolvePickerCommand(string userId)
        {
            var command = ActivePickerCommand(userId);
            return command != null &&
                (!command.IsActiveCall ||
                 string.Equals(command.SenderAgentId, _agentInstanceId, StringComparison.Ordinal));
        }

        private void PickerOnlineGridCellContentClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0 || e.ColumnIndex < 0) return;
            var picker = _pickerOnlineGrid.Rows[e.RowIndex].Tag as PickerPresenceView;
            if (picker == null) return;
            var column = _pickerOnlineGrid.Columns[e.ColumnIndex].Name;

            if (column == "KickUser")
            {
                if (string.IsNullOrWhiteSpace(picker.FirebaseUid) || picker.SessionGeneration <= 0)
                {
                    _pickerOnlineStatus.Text = "Phiên Picker chưa có generation hợp lệ để Kích User.";
                    return;
                }
                if (MessageBox.Show(
                    "Kích User sẽ thu hồi phiên PDA hiện tại của " +
                    (string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.DisplayName : picker.EmployeeCode) +
                    " và xóa khỏi danh sách trên toàn bộ Agent. Tiếp tục?",
                    "Xác nhận Kích User · bước 1/2",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning) != DialogResult.Yes) return;
                if (MessageBox.Show(
                    "Xác nhận lần 2: Picker sẽ phải đăng nhập lại trước khi gửi PickList mới.",
                    "Xác nhận Kích User · bước 2/2",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning) != DialogResult.Yes) return;
                Task.Run(() => KickPickerUser(picker));
                return;
            }

            if (column == "CallSpecialist")
            {
                var pickerLabel = string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.DisplayName : picker.EmployeeCode;
                var choice = ShowPickerContactChoice(pickerLabel);
                if (choice == 1)
                {
                    if (IsPickerCallLocked(picker.UserId) || IsPickerCallPending(picker.UserId))
                    {
                        _pickerOnlineStatus.Text = "Liên hệ picker đang khóa 60 giây trên toàn bộ Agent.";
                        return;
                    }
                    if (MessageBox.Show(
                        "Gọi " + pickerLabel +
                        " về bàn chuyên viên? Sau khi gửi, nút gọi sẽ khóa đủ 60 giây để tránh gửi lặp.",
                        "Xác nhận gọi Picker",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question) != DialogResult.Yes) return;
                    SetPickerCallPending(picker.UserId, true);
                    Task.Run(() => SendPickerContact(picker, true));
                    return;
                }
                if (choice == 2)
                {
                    var chat = PromptPickerChatMessage(pickerLabel);
                    if (chat == null) return;
                    Task.Run(() => SendPickerChat(picker, chat));
                }
                return;
            }
            if (column == "ResolveContact")
            {
                if (!CanResolvePickerCommand(picker.UserId))
                {
                    _pickerOnlineStatus.Text = HasActivePickerCommand(picker.UserId)
                        ? "Chỉ Agent đã Liên hệ picker mới được kết thúc yêu cầu."
                        : "Picker này không có yêu cầu đang mở.";
                    return;
                }
                var pickerLabel = string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.DisplayName : picker.EmployeeCode;
                if (MessageBox.Show(
                    "Kết thúc yêu cầu Liên hệ picker của " + pickerLabel +
                    "? Cảnh báo trên PDA sẽ đóng; nút gọi vẫn khóa đủ 60 giây.",
                    "Xác nhận kết thúc Liên hệ picker",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question) != DialogResult.Yes) return;
                Task.Run(() => ResolvePickerContact(picker));
            }
        }

        private void KickPickerUser(PickerPresenceView picker)
        {
            try
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                _agentSyncClient.RevokePickerSession(session, picker, _agentInstanceId);
                var serverRevoked = TryRevokePickerWorkerSession(session, picker);
                var snapshot = _agentSyncClient.SetKick(
                    session,
                    picker.UserId,
                    picker.FirebaseUid,
                    picker.SessionGeneration);
                ApplyD134AgentSyncSnapshot(snapshot);
                Ui(() => _pickerOnlineStatus.Text =
                    "Đã Kích User " +
                    (string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.DisplayName : picker.EmployeeCode) +
                    " · toàn bộ Agent đã nhận trạng thái thu hồi" +
                    (serverRevoked ? " · phiên máy chủ đã vô hiệu." : " · máy chủ sẽ chặn khi kết nối khả dụng."));
                Log("PICKER_SESSION kick=PASS user=" + SafeUserLabel(picker.EmployeeCode, picker.UserId) +
                    " generation=" + picker.SessionGeneration +
                    " server_revoke=" + (serverRevoked ? "PASS" : "DEFERRED"));
            }
            catch (Exception ex)
            {
                Ui(() => _pickerOnlineStatus.Text = "Kích User thất bại · " + SafeMessage(ex));
            }
        }

        private bool TryRevokePickerWorkerSession(AgentSession session, PickerPresenceView picker)
        {
            return TryRevokePickerWorkerSessionD160(session, picker);
        }

        private int ShowPickerContactChoice(string pickerLabel)
        {
            using (var dialog = new Form())
            {
                dialog.Text = "Liên hệ Picker";
                dialog.StartPosition = FormStartPosition.CenterParent;
                dialog.FormBorderStyle = FormBorderStyle.FixedDialog;
                dialog.MinimizeBox = false;
                dialog.MaximizeBox = false;
                dialog.ShowInTaskbar = false;
                dialog.ClientSize = new Size(470, 190);
                dialog.Font = Font;
                dialog.Controls.Add(new Label
                {
                    Left = 18, Top = 16, Width = 430, Height = 42,
                    Text = "Chọn cách liên hệ " + pickerLabel + ":",
                    Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold)
                });
                var direct = new Button
                {
                    Left = 18, Top = 72, Width = 205, Height = 44,
                    Text = "Gọi thẳng về bàn CV",
                    DialogResult = DialogResult.Yes
                };
                var chat = new Button
                {
                    Left = 241, Top = 72, Width = 205, Height = 44,
                    Text = "Gửi nội dung chat",
                    DialogResult = DialogResult.Retry
                };
                var cancel = new Button
                {
                    Left = 341, Top = 136, Width = 105, Height = 32,
                    Text = "Hủy",
                    DialogResult = DialogResult.Cancel
                };
                dialog.Controls.Add(direct);
                dialog.Controls.Add(chat);
                dialog.Controls.Add(cancel);
                dialog.CancelButton = cancel;
                var result = dialog.ShowDialog(this);
                return result == DialogResult.Yes ? 1 : result == DialogResult.Retry ? 2 : 0;
            }
        }

        private string PromptPickerChatMessage(string pickerLabel)
        {
            using (var dialog = new Form())
            {
                dialog.Text = "Gửi thông báo tới Picker";
                dialog.StartPosition = FormStartPosition.CenterParent;
                dialog.FormBorderStyle = FormBorderStyle.FixedDialog;
                dialog.MinimizeBox = false;
                dialog.MaximizeBox = false;
                dialog.ShowInTaskbar = false;
                dialog.TopMost = true;
                dialog.KeyPreview = false;
                dialog.ClientSize = new Size(520, 260);
                dialog.Font = Font;

                var title = new Label
                {
                    Left = 18, Top = 14, Width = 480, Height = 28,
                    Text = "Gửi nội dung tới " + pickerLabel,
                    Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold)
                };
                var note = new Label
                {
                    Left = 18, Top = 44, Width = 480, Height = 34,
                    Text = "Tối đa 200 ký tự. Picker bấm Xác nhận để đóng cảnh báo; không gửi ACK về Agent."
                };
                var input = new TextBox
                {
                    Left = 18, Top = 84, Width = 480, Height = 92,
                    Multiline = true,
                    AcceptsReturn = true,
                    AcceptsTab = false,
                    MaxLength = 200,
                    ScrollBars = ScrollBars.Vertical,
                    TabIndex = 0
                };
                var count = new Label
                {
                    Left = 18, Top = 180, Width = 120, Height = 22,
                    Text = "0 / 200"
                };
                input.TextChanged += (sender, args) => count.Text = input.TextLength + " / 200";

                string accepted = null;
                var send = new Button
                {
                    Left = 286, Top = 212, Width = 100, Height = 34,
                    Text = "Gửi",
                    TabIndex = 1
                };
                var cancel = new Button
                {
                    Left = 398, Top = 212, Width = 100, Height = 34,
                    Text = "Hủy",
                    DialogResult = DialogResult.Cancel,
                    TabIndex = 2
                };
                send.Click += (sender, args) =>
                {
                    var message = (input.Text ?? "").Trim();
                    if (message.Length == 0 || message.Length > 200)
                    {
                        MessageBox.Show(
                            dialog,
                            "Nhập nội dung từ 1 đến 200 ký tự.",
                            "Nội dung chưa hợp lệ",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information);
                        input.Focus();
                        return;
                    }
                    accepted = message;
                    dialog.DialogResult = DialogResult.OK;
                    dialog.Close();
                };

                dialog.Controls.Add(title);
                dialog.Controls.Add(note);
                dialog.Controls.Add(input);
                dialog.Controls.Add(count);
                dialog.Controls.Add(send);
                dialog.Controls.Add(cancel);
                dialog.CancelButton = cancel;
                dialog.Shown += (sender, args) =>
                {
                    dialog.ActiveControl = input;
                    input.Focus();
                    input.SelectionStart = input.TextLength;
                };
                dialog.Activated += (sender, args) =>
                {
                    if (!send.Focused && !cancel.Focused)
                    {
                        input.Focus();
                        input.SelectionStart = input.TextLength;
                    }
                };

                // D144: isolate the modal editor from the one-second after-hours
                // repaint and the 30-second Picker view refresh. Both timers run on the
                // WinForms message loop and can otherwise disturb focus on weak laptops.
                var afterHoursWasEnabled = _afterHoursTimer.Enabled;
                var opsWasEnabled = _d119OpsTimer.Enabled;
                if (afterHoursWasEnabled) _afterHoursTimer.Stop();
                if (opsWasEnabled) _d119OpsTimer.Stop();
                try
                {
                    var result = dialog.ShowDialog(this);
                    return result == DialogResult.OK ? accepted : null;
                }
                finally
                {
                    if (afterHoursWasEnabled) _afterHoursTimer.Start();
                    if (opsWasEnabled) _d119OpsTimer.Start();
                    BeginInvoke(new Action(() =>
                    {
                        CheckAfterHoursSchedule();
                        RefreshD119OperationalViews(false);
                    }));
                }
            }
        }

        private void SendPickerChat(PickerPresenceView picker, string message)
        {
            try
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                _pickerContactClient.Send(session, _agentInstanceId, picker, "CHAT_MESSAGE", message);
                Ui(() => _pickerOnlineStatus.Text =
                    "Đã gửi thông báo tới " +
                    (string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.DisplayName : picker.EmployeeCode) +
                    " · Picker xác nhận đóng cảnh báo ngay trên PDA.");
            }
            catch (Exception ex)
            {
                Ui(() => _pickerOnlineStatus.Text = "Gửi thông báo tới Picker thất bại · " + SafeMessage(ex));
            }
        }

        private void SendPickerContact(PickerPresenceView picker, bool locallyReserved = false)
        {
            if (!locallyReserved && (IsPickerCallLocked(picker.UserId) || IsPickerCallPending(picker.UserId)))
            {
                Ui(() => _pickerOnlineStatus.Text = "Liên hệ picker đang khóa 60 giây trên toàn bộ Agent.");
                return;
            }
            try
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                var command = _pickerContactClient.Send(session, _agentInstanceId, picker, "CALL_SPECIALIST");
                var snapshot = _agentSyncClient.SetCallLock(
                    session,
                    picker.UserId,
                    command.AlertId,
                    command.SenderAgentId,
                    command.SenderRole,
                    command.LockUntilMs);
                ApplyD134AgentSyncSnapshot(snapshot);
                Ui(() =>
                {
                    _pickerOnlineStatus.Text =
                        "Đã Liên hệ picker " +
                        (string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.DisplayName : picker.EmployeeCode) +
                        " · nút gọi khóa 60 giây trên toàn bộ Agent.";
                });
            }
            catch (Exception ex)
            {
                Ui(() => _pickerOnlineStatus.Text = "Liên hệ picker thất bại · " + SafeMessage(ex));
            }
            finally
            {
                if (locallyReserved) Ui(() => SetPickerCallPending(picker.UserId, false));
            }
        }

        private void ResolvePickerContact(PickerPresenceView picker)
        {
            PickerContactCommand command;
            lock (_activePickerCommands)
            {
                if (!_activePickerCommands.TryGetValue(picker.UserId, out command))
                {
                    Ui(() => _pickerOnlineStatus.Text = "Picker này không có yêu cầu đang mở.");
                    return;
                }
                if (command.IsActiveCall &&
                    !string.Equals(command.SenderAgentId, _agentInstanceId, StringComparison.Ordinal))
                {
                    Ui(() => _pickerOnlineStatus.Text = "Chỉ Agent đã Liên hệ picker mới được kết thúc yêu cầu.");
                    return;
                }
            }

            try
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                _pickerContactClient.Resolve(session, _agentInstanceId, command);
                var snapshot = _agentSyncClient.SetCallResolved(session, picker.UserId, command.AlertId);
                ApplyD134AgentSyncSnapshot(snapshot);
                Ui(() => _pickerOnlineStatus.Text =
                    "Đã kết thúc Liên hệ picker · PDA sẽ đóng cảnh báo; nút gọi vẫn khóa đủ 60 giây.");
            }
            catch (Exception ex)
            {
                Ui(() => _pickerOnlineStatus.Text = "Không kết thúc được Liên hệ picker · " + SafeMessage(ex));
            }
        }

        internal bool HasActivePdaForRelay()
        {
            return _activePdaCountForRelay > 0;
        }

    }
}
