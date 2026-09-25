using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly DataGridView _pickerOnlineGrid = new DataGridView();
        private readonly Label _pickerOnlineStatus = new Label();
        private readonly Label _fleetMetricStatus = new Label();
        private readonly System.Windows.Forms.Timer _d119OpsTimer = new System.Windows.Forms.Timer();
        private FirestorePickerPresenceClient _pickerPresenceClient;
        private FirestorePickerContactClient _pickerContactClient;
        private readonly Dictionary<string, PickerContactCommand> _activePickerCommands =
            new Dictionary<string, PickerContactCommand>(StringComparer.Ordinal);
        private long _pickerPresenceRefreshRunning;
        private DateTime _lastPickerPresenceRefreshUtc = DateTime.MinValue;

        private void InitializeD119AgentFeatures(TableLayoutPanel overviewLayout)
        {
            if (overviewLayout == null) return;

            _pickerPresenceClient = new FirestorePickerPresenceClient(message => Log(message));
            _pickerContactClient = new FirestorePickerContactClient(message => Log(message));

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

            _pickerOnlineStatus.SetBounds(274, 9, 470, 20);
            _pickerOnlineStatus.Text = "Đang chờ phiên Agent...";
            _pickerOnlineStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _pickerOnlineStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            pickerCard.Controls.Add(_pickerOnlineStatus);

            _fleetMetricStatus.SetBounds(748, 9, 274, 20);
            _fleetMetricStatus.Text = "";
            _fleetMetricStatus.TextAlign = ContentAlignment.MiddleRight;
            _fleetMetricStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _fleetMetricStatus.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            pickerCard.Controls.Add(_fleetMetricStatus);

            _pickerOnlineGrid.SetBounds(16, 34, 1006, 126);
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
                HeaderText = "MNV",
                Width = 105
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
                Width = 105
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "CallSpecialist",
                HeaderText = "Chuyên viên",
                Text = "Gọi về bàn CV",
                UseColumnTextForButtonValue = true,
                Width = 120
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "BringToPack",
                HeaderText = "Pack",
                Text = "Mang hàng về Pack",
                UseColumnTextForButtonValue = true,
                Width = 130
            });
            _pickerOnlineGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "ResolveContact",
                HeaderText = "Kết thúc",
                Width = 92
            });
            _pickerOnlineGrid.CellContentClick += PickerOnlineGridCellContentClick;
            pickerCard.Controls.Add(_pickerOnlineGrid);

            overviewLayout.Controls.Add(pickerCard, 0, 3);

            _d119OpsTimer.Interval = 5000;
            _d119OpsTimer.Tick += (s, e) => RefreshD119OperationalViews(false);
            _d119OpsTimer.Start();
            FormClosed += (s, e) =>
            {
                try { _d119OpsTimer.Stop(); } catch { }
                try { _d119OpsTimer.Dispose(); } catch { }
            };

            ApplyD119AuthenticatedLayout(HasAgentSession());
            RefreshD119OperationalViews(true);
        }

        private void ApplyD119AuthenticatedLayout(bool authenticated)
        {
            if (_username.Parent == null) return;
            var host = _username.Parent;

            var userLabel = host.Controls["agent-auth-user-label"];
            var passwordLabel = host.Controls["agent-auth-password-label"];
            if (userLabel != null) userLabel.Visible = !authenticated;
            if (passwordLabel != null) passwordLabel.Visible = !authenticated;
            _username.Visible = !authenticated;
            _password.Visible = !authenticated;
            _pair.Visible = !authenticated;

            if (authenticated)
            {
                _logout.SetBounds(Math.Max(16, host.ClientSize.Width - 430), 36, 108, 30);
                _manualUpdate.SetBounds(Math.Max(132, host.ClientSize.Width - 314), 36, 150, 30);
                _background.Visible = false;

                _identity.SetBounds(16, 72, 310, 20);
                _relay.SetBounds(336, 72, 310, 20);
                _network.SetBounds(656, 72, Math.Max(250, host.ClientSize.Width - 672), 20);
                _agentFleetStatus.SetBounds(16, 96, Math.Max(300, host.ClientSize.Width - 32), 20);
                _agentFleetGrid.SetBounds(16, 118, Math.Max(300, host.ClientSize.Width - 32), 128);
                _agentFleetGrid.Visible = true;
            }
            else
            {
                _logout.SetBounds(618, 80, 108, 31);
                _manualUpdate.SetBounds(736, 80, 150, 31);
                _background.SetBounds(886, 80, 120, 31);
                _background.Visible = true;
                _identity.SetBounds(16, 118, 310, 20);
                _relay.SetBounds(336, 118, 310, 20);
                _network.SetBounds(656, 118, 350, 20);
                _agentFleetStatus.SetBounds(16, 144, 990, 20);
                _agentFleetGrid.Visible = false;
            }

            if (authenticated) RefreshD119OperationalViews(true);
            else
            {
                _pickerOnlineGrid.Rows.Clear();
                _pickerOnlineStatus.Text = "Đăng nhập Agent để xem Picker đang hoạt động.";
                _fleetMetricStatus.Text = "";
            }
        }

        private void RefreshD119OperationalViews(bool force)
        {
            if (!HasAgentSession() || _pickerPresenceClient == null) return;
            var coordinator = _leaderCoordinator;
            var interval = coordinator != null && coordinator.IsLeader
                ? TimeSpan.FromSeconds(15)
                : TimeSpan.FromMinutes(30);
            if (!force && DateTime.UtcNow - _lastPickerPresenceRefreshUtc < interval) return;
            if (Interlocked.CompareExchange(ref _pickerPresenceRefreshRunning, 1L, 0L) != 0L) return;

            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    var items = _pickerPresenceClient.Load(session);
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
            _pickerOnlineGrid.Rows.Clear();
            foreach (var picker in items ?? new List<PickerPresenceView>())
            {
                var row = _pickerOnlineGrid.Rows[_pickerOnlineGrid.Rows.Add(
                    string.IsNullOrWhiteSpace(picker.EmployeeCode) ? picker.UserId : picker.EmployeeCode,
                    string.IsNullOrWhiteSpace(picker.DisplayName) ? "—" : picker.DisplayName,
                    "Đang online",
                    "Gọi về bàn CV",
                    "Mang hàng về Pack",
                    _activePickerCommands.ContainsKey(picker.UserId) ? "Đóng" : "—")];
                row.Tag = picker;
            }
            _pickerOnlineStatus.Text =
                (items == null ? 0 : items.Count).ToString("N0") +
                " Picker có phiên PDA + thông báo" +
                (primary ? " · PRIMARY cập nhật gần realtime" : " · Agent phụ cập nhật tiết kiệm quota");
            _fleetMetricStatus.Text =
                "Máy này: " + Interlocked.Read(ref _localPdaRequests).ToString("N0") +
                " yêu cầu · " + Interlocked.Read(ref _localAgentResponses).ToString("N0") + " phản hồi";
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
