using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
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

            const int folderButtonWidth = 150;
            _agentDataStorageStatus.SetBounds(
                16, 170, Math.Max(180, width - 32 - folderButtonWidth - 8), 24);
            _agentDataStorageStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _openAgentDataFolder.SetBounds(
                Math.Max(16, width - 16 - folderButtonWidth), 166, folderButtonWidth, 28);
            _openAgentDataFolder.Anchor = AnchorStyles.Top | AnchorStyles.Right;
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
        private readonly Dictionary<string, PickerContactCommand> _activePickerCommands =
            new Dictionary<string, PickerContactCommand>(StringComparer.Ordinal);
        private readonly Dictionary<string, DateTime> _pickerDisconnectGrace =
            new Dictionary<string, DateTime>(StringComparer.Ordinal);
        private const int PickerDisconnectGraceSeconds = 180;
        private long _pickerPresenceRefreshRunning;
        private DateTime _lastPickerPresenceRefreshUtc = DateTime.MinValue;
        private bool? _pickerWindowOpenState;
        private FirestoreFleetMetricsClient _fleetMetricsClient;
        private FleetMetricSnapshot _fleetSnapshot;
        private long _fleetMetricsRefreshRunning;
        private DateTime _lastFleetMetricsRefreshUtc = DateTime.MinValue;
        private DateTime _lastFleetMetricsAttemptUtc = DateTime.MinValue;
        private long _lastFleetCheckpointLocalRequests = -1L;
        private long _lastFleetCheckpointLocalResponses = -1L;
        private bool _lastFleetPrimary;
        private readonly CheckBox _autoSizeColumns = new CheckBox();
        private bool _columnPreferenceApplying;
        private string _columnPreferenceUser = "";
        private D128OverlayForm _d128Overlay;
        private readonly Button _d128OverlaySettingsButton = new Button();
        private ToolStripMenuItem _d128OverlayVisibleMenu;
        private ToolStripMenuItem _d128OverlayLockedMenu;
        private static readonly string D128OverlaySettingsFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Agent Auto Confirm Pick Pack", "RelayPoc", "overlay-settings.json");

        public sealed class ColumnPreferenceProfile
        {
            public bool AutoSize = true;
            public Dictionary<string, int> Agent = new Dictionary<string, int>(StringComparer.Ordinal);
            public Dictionary<string, int> Picker = new Dictionary<string, int>(StringComparer.Ordinal);
            public Dictionary<string, int> PickList = new Dictionary<string, int>(StringComparer.Ordinal);
        }

        private void InitializeD119AgentFeatures(TableLayoutPanel overviewLayout)
        {
            if (overviewLayout == null) return;

            _pickerPresenceClient = new FirestorePickerPresenceClient(message => Log(message));
            _pickerContactClient = new FirestorePickerContactClient(message => Log(message));
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
            pickerCard.Controls.Add(_fleetMetricStatus);

            pickerCard.Controls.Add(new Label
            {
                Left = 16,
                Top = 43,
                Width = 178,
                Height = 20,
                Text = "Tìm Mã nhân viên / họ tên",
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
                MinimumWidth = 180
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "PdaState",
                HeaderText = "PDA",
                Width = 148
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "CallSpecialist",
                HeaderText = "Chuyên viên",
                Text = "Gọi về bàn CV",
                UseColumnTextForButtonValue = true,
                Width = 112
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "BringToPack",
                HeaderText = "Pack",
                Text = "Mang hàng về Pack",
                UseColumnTextForButtonValue = true,
                Width = 122
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

            InitializeColumnPreferences();

            _d119OpsTimer.Interval = 30000;
            _d119OpsTimer.Tick += (s, e) =>
            {
                RefreshPickerWindowBoundary();
                ExpirePickerPresenceGrace();
                RefreshD119OperationalViews(false);
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
            var available = Math.Max(360, host.ClientSize.Width - 32);
            const int gap = 10;
            var width = Math.Max(110, (available - (gap * 2)) / 3);
            var left = 16;

            _identity.SetBounds(left, top, width, 20);
            _relay.SetBounds(left + width + gap, top, width, 20);
            _network.SetBounds(left + ((width + gap) * 2), top, Math.Max(110, available - ((width + gap) * 2)), 20);
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
                _logout.SetBounds(16, 62, 108, 30);
                _manualUpdate.SetBounds(134, 62, 148, 30);
                _background.SetBounds(292, 62, 142, 30);

                // D124: basic Agent state + local request counters occupy about the
                // upper 30% of the Agent card; the fleet table consumes the rest.
                LayoutAgentSystemStatusRow(host, 96);
                _agentRequestMetrics.SetBounds(16, 118, Math.Max(300, host.ClientSize.Width - 32), 20);
                _agentRequestMetrics.Visible = true;
                var fleetTop = Math.Max(142, (int)Math.Round(host.ClientSize.Height * 0.30));
                _agentFleetGrid.SetBounds(
                    16,
                    fleetTop,
                    Math.Max(300, host.ClientSize.Width - 32),
                    Math.Max(46, host.ClientSize.Height - fleetTop - 12));
                _agentFleetGrid.Visible = true;
            }
            else
            {
                _manualUpdate.SetBounds(16, 118, 148, 30);
                _background.SetBounds(174, 118, 142, 30);
                LayoutAgentSystemStatusRow(host, 154);
                _agentRequestMetrics.Visible = false;
                _agentFleetGrid.Visible = false;
            }

            var authChanged = !_d119AuthenticatedState.HasValue || _d119AuthenticatedState.Value != authenticated;
            _d119AuthenticatedState = authenticated;
            if (authenticated)
            {
                if (authChanged)
                {
                    LoadColumnPreferencesForCurrentUser();
                    RefreshD119OperationalViews(true);
                }
            }
            else
            {
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

        private void InitializeColumnPreferences()
        {
            var host = _username.Parent;
            if (host != null)
            {
                _autoSizeColumns.Text = "Tự căn cột theo nội dung";
                _autoSizeColumns.AutoSize = true;
                _autoSizeColumns.Checked = true;
                _autoSizeColumns.Top = 12;
                _autoSizeColumns.Left = Math.Max(460, host.ClientSize.Width - 205);
                _autoSizeColumns.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                _autoSizeColumns.CheckedChanged += (s, e) =>
                {
                    if (_columnPreferenceApplying) return;
                    ApplyColumnPreferenceMode();
                    SaveColumnPreferencesForCurrentUser();
                };
                host.Controls.Add(_autoSizeColumns);
                _autoSizeColumns.BringToFront();
            }

            foreach (var grid in new[] { _agentFleetGrid, _pickerOnlineGrid, _manualPicklistGrid })
            {
                grid.AllowUserToResizeColumns = false;
                grid.ColumnWidthChanged += (s, e) =>
                {
                    if (_columnPreferenceApplying || _autoSizeColumns.Checked) return;
                    SaveColumnPreferencesForCurrentUser();
                };
            }
            ResizeEnd += (s, e) =>
            {
                if (!_autoSizeColumns.Checked) return;
                ApplyColumnSizingIfEnabled(_agentFleetGrid);
                ApplyColumnSizingIfEnabled(_pickerOnlineGrid);
                ApplyColumnSizingIfEnabled(_manualPicklistGrid);
            };
            LoadColumnPreferencesForCurrentUser();
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
                _autoSizeColumns.Checked = profile.AutoSize;
                RestoreGridWidths(_agentFleetGrid, profile.Agent);
                RestoreGridWidths(_pickerOnlineGrid, profile.Picker);
                RestoreGridWidths(_manualPicklistGrid, profile.PickList);
                ApplyColumnPreferenceMode();
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
            var profile = new ColumnPreferenceProfile
            {
                AutoSize = _autoSizeColumns.Checked,
                Agent = CaptureGridWidths(_agentFleetGrid),
                Picker = CaptureGridWidths(_pickerOnlineGrid),
                PickList = CaptureGridWidths(_manualPicklistGrid)
            };
            store[user] = profile;
            WriteColumnPreferenceStore(store);
            _columnPreferenceUser = user;
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
                grid.AllowUserToResizeColumns = !_autoSizeColumns.Checked;
                if (_autoSizeColumns.Checked) ApplyColumnSizingIfEnabled(grid);
            }
        }

        private void ApplyColumnSizingIfEnabled(DataGridView grid)
        {
            if (grid == null || grid.IsDisposed) return;
            if (grid.InvokeRequired)
            {
                grid.BeginInvoke(new Action<DataGridView>(ApplyColumnSizingIfEnabled), grid);
                return;
            }
            if (!_autoSizeColumns.Checked || grid.Columns.Count == 0) return;
            _columnPreferenceApplying = true;
            try
            {
                foreach (DataGridViewColumn column in grid.Columns)
                    column.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                grid.AutoResizeColumns(DataGridViewAutoSizeColumnsMode.DisplayedCells);
                var available = Math.Max(200, grid.ClientSize.Width - (grid.Controls.OfType<VScrollBar>().Any(v => v.Visible) ? SystemInformation.VerticalScrollBarWidth : 4));
                var used = 0;
                foreach (DataGridViewColumn column in grid.Columns) used += column.Width;
                if (used < available)
                {
                    var last = grid.Columns[grid.Columns.Count - 1];
                    last.Width = Math.Min(800, Math.Max(last.MinimumWidth, last.Width + (available - used)));
                }
            }
            catch { }
            finally
            {
                _columnPreferenceApplying = false;
            }
        }

        private void RefreshD119OperationalViews(bool force)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<bool>(RefreshD119OperationalViews), force);
                return;
            }
            if (!HasAgentSession() || _pickerPresenceClient == null) return;
            var coordinator = _leaderCoordinator;
            var primary = coordinator != null && coordinator.IsLeader;
            RefreshFleetMetricsIfDue(_fleetSnapshot == null || (primary && !_lastFleetPrimary), primary);
            _lastFleetPrimary = primary;
            RenderFleetMetricStatus(primary);

            // D127: Picker presence is event-driven through the already-polled relay queue.
            // Periodic UI ticks must never read the projection or picker_alerts.
            if (!force) return;
            if (Interlocked.CompareExchange(ref _pickerPresenceRefreshRunning, 1L, 0L) != 0L) return;

            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    var items = _pickerPresenceClient.Load(session);
                    Dictionary<string, PickerContactCommand> openCommands = null;
                    try { openCommands = _pickerContactClient.LoadOpen(session); }
                    catch (Exception ex) { Log("PICKER_CONTACT list=FAIL detail=" + SafeMessage(ex)); }
                    if (openCommands != null)
                    {
                        lock (_activePickerCommands)
                        {
                            _activePickerCommands.Clear();
                            foreach (var entry in openCommands) _activePickerCommands[entry.Key] = entry.Value;
                        }
                    }
                    _lastPickerPresenceRefreshUtc = DateTime.UtcNow;
                    Ui(() => UpdatePickerOnlineGrid(items, coordinator != null && coordinator.IsLeader));
                }
                catch (Exception ex)
                {
                    Ui(() => _pickerOnlineStatus.Text = "Không đọc được danh sách Picker · " + SafeMessage(ex));
                }
                finally
                {
                    Interlocked.Exchange(ref _pickerPresenceRefreshRunning, 0L);
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
            _pickerOnlineSnapshot = items ?? new List<PickerPresenceView>();
            RenderPickerOnlineSnapshot();
            var liveCount = _pickerOnlineSnapshot.Count(x => string.Equals(x.Status, "PDA_READY", StringComparison.Ordinal));
            var graceCount = _pickerOnlineSnapshot.Count - liveCount;
            _pickerOnlineStatus.Text =
                liveCount.ToString("N0") + " Picker đang hoạt động" +
                (graceCount > 0 ? " · " + graceCount.ToString("N0") + " mất kết nối tạm thời" : "") +
                (primary ? " · sự kiện trực tiếp" : " · snapshot");
            RenderFleetMetricStatus(primary);
        }

        internal void ApplyEventDrivenPickerPresence(List<PickerPresenceView> items, string reason)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<List<PickerPresenceView>, string>(ApplyEventDrivenPickerPresence), items, reason);
                return;
            }

            var now = DateTime.UtcNow;
            var incoming = items ?? new List<PickerPresenceView>();
            var incomingIds = new HashSet<string>(
                incoming.Where(x => x != null && !string.IsNullOrWhiteSpace(x.UserId)).Select(x => x.UserId),
                StringComparer.Ordinal);
            foreach (var id in incomingIds) _pickerDisconnectGrace.Remove(id);

            var hardLeave = string.Equals(reason, "LOGOUT", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(reason, "DEVICE_REMOVE", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(reason, "session-replaced", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(reason, "session-changed", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(reason, "role-changed", StringComparison.OrdinalIgnoreCase);
            var merged = new List<PickerPresenceView>(incoming);
            if (!hardLeave)
            {
                foreach (var previous in _pickerOnlineSnapshot)
                {
                    if (previous == null || string.IsNullOrWhiteSpace(previous.UserId) || incomingIds.Contains(previous.UserId))
                        continue;
                    DateTime disconnectedAt;
                    if (!_pickerDisconnectGrace.TryGetValue(previous.UserId, out disconnectedAt))
                    {
                        disconnectedAt = now;
                        _pickerDisconnectGrace[previous.UserId] = disconnectedAt;
                    }
                    if (now - disconnectedAt >= TimeSpan.FromSeconds(PickerDisconnectGraceSeconds))
                        continue;
                    merged.Add(new PickerPresenceView
                    {
                        UserId = previous.UserId,
                        EmployeeCode = previous.EmployeeCode,
                        DisplayName = previous.DisplayName,
                        DeviceId = previous.DeviceId,
                        LoginAt = previous.LoginAt,
                        DeviceSeenAt = previous.DeviceSeenAt,
                        Status = "PDA_GRACE"
                    });
                }
            }
            else
            {
                foreach (var id in _pickerDisconnectGrace.Keys.Where(id => !incomingIds.Contains(id)).ToList())
                    _pickerDisconnectGrace.Remove(id);
            }

            UpdatePickerOnlineGrid(merged, _leaderCoordinator != null && _leaderCoordinator.IsLeader);
        }

        private void RefreshPickerWindowBoundary()
        {
            var now = _businessSchedule == null ? DateTime.Now : _businessSchedule.NowOperational();
            var open = now.TimeOfDay >= new TimeSpan(5, 0, 0) && now.TimeOfDay < new TimeSpan(23, 0, 0);
            if (_pickerWindowOpenState.HasValue && _pickerWindowOpenState.Value == open) return;
            _pickerWindowOpenState = open;

            if (!open)
            {
                _pickerDisconnectGrace.Clear();
                _pickerOnlineSnapshot = new List<PickerPresenceView>();
                _pickerOnlineRenderSignature = "";
                UpdatePickerOnlineGrid(_pickerOnlineSnapshot, _leaderCoordinator != null && _leaderCoordinator.IsLeader);
                _pickerOnlineStatus.Text = "Ngoài khung PDA 05:00–23:00 · danh sách Picker đã đóng.";
                return;
            }

            // One authoritative snapshot at 05:00 / process entry into the operating window.
            RefreshD119OperationalViews(true);
        }

        private void ExpirePickerPresenceGrace()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(ExpirePickerPresenceGrace));
                return;
            }
            if (_pickerDisconnectGrace.Count == 0) return;
            var now = DateTime.UtcNow;
            var expired = _pickerDisconnectGrace
                .Where(x => now - x.Value >= TimeSpan.FromSeconds(PickerDisconnectGraceSeconds))
                .Select(x => x.Key)
                .ToList();
            if (expired.Count == 0) return;
            foreach (var id in expired) _pickerDisconnectGrace.Remove(id);
            if (_pickerOnlineSnapshot.RemoveAll(x =>
                    x != null &&
                    string.Equals(x.Status, "PDA_GRACE", StringComparison.Ordinal) &&
                    expired.Contains(x.UserId)) > 0)
            {
                _pickerOnlineRenderSignature = "";
                UpdatePickerOnlineGrid(_pickerOnlineSnapshot, _leaderCoordinator != null && _leaderCoordinator.IsLeader);
            }
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
                    .Append(picker.DeviceId ?? "").Append(':')
                    .Append(picker.Status ?? "").Append(':')
                    .Append(HasActivePickerCommand(picker.UserId) ? '1' : '0');
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
                    if (!string.IsNullOrWhiteSpace(query) &&
                        code.IndexOf(query, StringComparison.OrdinalIgnoreCase) < 0 &&
                        name.IndexOf(query, StringComparison.CurrentCultureIgnoreCase) < 0)
                        continue;

                    var row = _pickerOnlineGrid.Rows[_pickerOnlineGrid.Rows.Add(
                        code,
                        name,
                        "Đang online",
                        "Gọi về bàn CV",
                        "Mang hàng về Pack",
                        HasActivePickerCommand(picker.UserId) ? "Đóng" : "—")];
                    row.Tag = picker;
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

        private void RefreshFleetMetricsIfDue(bool force, bool primary)
        {
            if (_fleetMetricsClient == null || !HasAgentSession()) return;
            var now = DateTime.UtcNow;
            var interval = TimeSpan.FromMinutes(30);
            // D120: metrics are observability-only. UI refresh, tab changes and failed reads
            // must never turn the 30-minute checkpoint into a 5-second Firestore storm.
            if (_lastFleetMetricsAttemptUtc != DateTime.MinValue && now - _lastFleetMetricsAttemptUtc < interval) return;
            if (!force && _lastFleetMetricsRefreshUtc != DateTime.MinValue && now - _lastFleetMetricsRefreshUtc < interval) return;
            if (Interlocked.CompareExchange(ref _fleetMetricsRefreshRunning, 1L, 0L) != 0L) return;
            _lastFleetMetricsAttemptUtc = now;

            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    FleetMetricSnapshot snapshot;
                    if (primary)
                    {
                        snapshot = _fleetMetricsClient.RefreshPrimary(
                            session,
                            _agentInstanceId,
                            Interlocked.Read(ref _localPdaRequests),
                            Interlocked.Read(ref _localAgentResponses));
                    }
                    else
                    {
                        snapshot = _fleetMetricsClient.Load(session);
                    }
                    _fleetSnapshot = snapshot;
                    _lastFleetMetricsRefreshUtc = DateTime.UtcNow;
                    Ui(() => RenderFleetMetricStatus(primary));
                }
                catch (Exception ex)
                {
                    Log("FLEET_METRICS refresh=FAIL primary=" + (primary ? "true" : "false") +
                        " detail=" + SafeMessage(ex));
                    Ui(() =>
                    {
                        RenderFleetMetricStatus(primary);
                        if (_fleetSnapshot == null)
                            _fleetMetricStatus.Text = "Cụm: chờ đồng bộ metrics";
                    });
                }
                finally
                {
                    Interlocked.Exchange(ref _fleetMetricsRefreshRunning, 0L);
                }
            });
        }

        private void RenderFleetMetricStatus(bool primary)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<bool>(RenderFleetMetricStatus), primary);
                return;
            }
            var snapshot = _fleetSnapshot;
            _fleetMetricStatus.Text = snapshot == null
                ? "Cụm hôm nay: chờ đồng bộ"
                : "Cụm hôm nay: " + snapshot.AcceptedTotal.ToString("N0") +
                  " nhận · " + snapshot.ProcessedTotal.ToString("N0") + " xử lý" +
                  (primary ? " · realtime" : " · 30p");
            RefreshAgentRequestMetrics();
        }

        private void RefreshAgentRequestMetrics()
        {
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
                "Xác nhận đơn · Nhận " + received.ToString("N0") +
                " · Đã xử lý " + processed.ToString("N0") +
                " · Thành công " + success.ToString("N0") +
                " · Lỗi " + failed.ToString("N0") +
                " · Chờ " + pending.ToString("N0");
            RefreshD128Overlay();
        }

        private void InitializeD128Overlay()
        {
            try
            {
                _d128Overlay = new D128OverlayForm(D128OverlaySettingsFile);
                _d128Overlay.SettingsChanged += RefreshD128OverlayMenu;
                RefreshD128Overlay();
                if (_d128Overlay.OverlayVisible) _d128Overlay.Show();

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
                    Left = 18, Top = 50, Width = 780, Height = 42,
                    Text = "Picklist nhận | Picklist xác nhận | Picklist lỗi. Khi khóa, chuột xuyên qua bảng nổi xuống chương trình phía sau.",
                    ForeColor = Color.DimGray
                });
                _d128OverlaySettingsButton.SetBounds(18, 100, 190, 34);
                _d128OverlaySettingsButton.Text = "Cài đặt bảng nổi";
                _d128OverlaySettingsButton.Click += (s, e) => OpenD128OverlaySettings();
                overlayCard.Controls.Add(_d128OverlaySettingsButton);
                _connectionPage.Controls.Add(overlayCard);

                var menu = _tray.ContextMenuStrip;
                if (menu != null)
                {
                    menu.Items.Add(new ToolStripSeparator());
                    _d128OverlayVisibleMenu = new ToolStripMenuItem("Hiển thị bảng nổi");
                    _d128OverlayVisibleMenu.Click += (s, e) =>
                    {
                        if (_d128Overlay == null) return;
                        _d128Overlay.SetOverlayVisible(!_d128Overlay.OverlayVisible);
                        RefreshD128OverlayMenu();
                    };
                    menu.Items.Add(_d128OverlayVisibleMenu);

                    _d128OverlayLockedMenu = new ToolStripMenuItem("Khóa bảng nổi / chuột xuyên qua");
                    _d128OverlayLockedMenu.Click += (s, e) =>
                    {
                        if (_d128Overlay == null) return;
                        _d128Overlay.SetLocked(!_d128Overlay.IsLocked);
                        RefreshD128OverlayMenu();
                    };
                    menu.Items.Add(_d128OverlayLockedMenu);

                    var settings = new ToolStripMenuItem("Cài đặt bảng nổi...");
                    settings.Click += (s, e) => OpenD128OverlaySettings();
                    menu.Items.Add(settings);
                }
                RefreshD128OverlayMenu();
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("D128_OVERLAY init=FAIL type=" + ex.GetType().Name);
            }
        }

        private void RefreshD128Overlay()
        {
            var overlay = _d128Overlay;
            if (overlay == null || overlay.IsDisposed) return;
            overlay.UpdatePicklistMetrics(
                Interlocked.Read(ref _localPdaRequests),
                Interlocked.Read(ref _localConfirmSuccess),
                Interlocked.Read(ref _localConfirmFailed));
        }

        private void RefreshD128OverlayMenu()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RefreshD128OverlayMenu));
                return;
            }
            if (_d128OverlayVisibleMenu != null)
                _d128OverlayVisibleMenu.Checked = _d128Overlay != null && _d128Overlay.OverlayVisible;
            if (_d128OverlayLockedMenu != null)
                _d128OverlayLockedMenu.Checked = _d128Overlay != null && _d128Overlay.IsLocked;
        }

        private void OpenD128OverlaySettings()
        {
            if (_d128Overlay == null || _d128Overlay.IsDisposed) return;
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
                MinimumSize = new Size(430, 42);
                MaximumSize = new Size(1600, 180);
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

                foreach (Control control in new Control[] { this, _text })
                {
                    control.MouseDown += BeginDrag;
                    control.MouseMove += ContinueDrag;
                    control.MouseUp += EndDrag;
                }

                ApplySavedPosition();
                Shown += (s, e) => ApplyInteractionMode();
                ResizeEnd += (s, e) => { if (!IsLocked) Persist(); };
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
                if (m.Msg == WmNcHitTest && IsLocked)
                {
                    m.Result = new IntPtr(HtTransparent);
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
                        { "opacity", _overlayOpacity }, { "locked", _locked }, { "visible", _overlayVisible }
                    };
                    File.WriteAllText(_settingsPath, new JavaScriptSerializer().Serialize(payload));
                }
                catch { }
                var handler = SettingsChanged;
                if (handler != null) handler();
            }

            private static int ClampWidth(int value) { return Math.Max(430, Math.Min(1600, value)); }
            private static int ClampHeight(int value) { return Math.Max(42, Math.Min(180, value)); }
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
                _width.Minimum = 430;
                _width.Maximum = 1600;
                _width.Value = Math.Max(_width.Minimum, Math.Min(_width.Maximum, overlay.OverlayWidth));
                Controls.Add(_width);

                Controls.Add(new Label { Left = 248, Top = 176, Width = 85, Height = 22, Text = "Chiều cao" });
                _height.SetBounds(338, 172, 100, 28);
                _height.Minimum = 42;
                _height.Maximum = 180;
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
                    "Agent · CPU " + agent.ProcessCpuPercent.ToString("0.0") + "% · RAM " +
                    (agent.ProcessWorkingSetBytes / 1024d / 1024d).ToString("0") + " MB · Thời gian chạy " +
                    FormatD128Duration(agent.ProcessUptime);
            }

            if (browser == null || !browser.Available)
            {
                _d128BrowserResourceStatus.Text = "Tài nguyên Web: chưa có tiến trình";
            }
            else
            {
                _d128BrowserResourceStatus.Text =
                    (string.IsNullOrWhiteSpace(browser.Browser) ? "Web" : browser.Browser) +
                    " · CPU " + browser.CpuPercent.ToString("0.0") + "% · RAM " +
                    (browser.WorkingSetBytes / 1024d / 1024d).ToString("0") + " MB · " +
                    browser.ProcessCount + " tiến trình · Thời gian chạy " +
                    FormatD128Duration(browser.RunningFor);
            }
        }

        private void SetD128ResourceMonitoringPaused()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(SetD128ResourceMonitoringPaused));
                return;
            }
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

        private void PickerOnlineGridCellContentClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0 || e.ColumnIndex < 0) return;
            var picker = _pickerOnlineGrid.Rows[e.RowIndex].Tag as PickerPresenceView;
            if (picker == null) return;
            var column = _pickerOnlineGrid.Columns[e.ColumnIndex].Name;

            if (column == "CallSpecialist")
            {
                Task.Run(() => SendPickerContact(picker, "CALL_SPECIALIST"));
                return;
            }
            if (column == "BringToPack")
            {
                Task.Run(() => SendPickerContact(picker, "BRING_TO_PACK"));
                return;
            }
            if (column == "ResolveContact")
            {
                Task.Run(() => ResolvePickerContact(picker));
            }
        }

        private void SendPickerContact(PickerPresenceView picker, string commandType)
        {
            if (HasActivePickerCommand(picker.UserId))
            {
                Ui(() => _pickerOnlineStatus.Text = "Picker này đang có yêu cầu mở. Hãy xác nhận kết thúc trước khi gửi yêu cầu mới.");
                return;
            }
            try
            {
                EnsureFreshToken();
                var command = _pickerContactClient.Send(SnapshotSession(), _agentInstanceId, picker, commandType);
                lock (_activePickerCommands) _activePickerCommands[picker.UserId] = command;
                Ui(() =>
                {
                    _pickerOnlineStatus.Text =
                        (commandType == "CALL_SPECIALIST" ? "Đã gọi " : "Đã gửi yêu cầu Pack cho ") +
                        (string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.DisplayName : picker.EmployeeCode) +
                        ". PDA sẽ hiển thị cảnh báo toàn màn hình.";
                    RefreshD119OperationalViews(true);
                });
            }
            catch (Exception ex)
            {
                Ui(() => _pickerOnlineStatus.Text = "Gửi yêu cầu Picker thất bại · " + SafeMessage(ex));
            }
        }

        private void ResolvePickerContact(PickerPresenceView picker)
        {
            PickerContactCommand command;
            lock (_activePickerCommands)
            {
                if (!_activePickerCommands.TryGetValue(picker.UserId, out command))
                {
                    Ui(() => _pickerOnlineStatus.Text = "Picker này không có yêu cầu đang mở từ Agent hiện tại.");
                    return;
                }
            }

            try
            {
                EnsureFreshToken();
                _pickerContactClient.Resolve(SnapshotSession(), _agentInstanceId, command);
                lock (_activePickerCommands) _activePickerCommands.Remove(picker.UserId);
                Ui(() =>
                {
                    _pickerOnlineStatus.Text = "Đã xác nhận xử lý Picker · PDA sẽ đóng cảnh báo.";
                    RefreshD119OperationalViews(true);
                });
            }
            catch (Exception ex)
            {
                Ui(() => _pickerOnlineStatus.Text = "Không đóng được yêu cầu Picker · " + SafeMessage(ex));
            }
        }
    }
}
