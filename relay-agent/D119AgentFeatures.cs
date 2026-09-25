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
        private readonly Button _skuSyncButton = new Button();
        private readonly Label _skuSyncStatus = new Label();
        private FirestoreSkuSyncClient _skuSyncClient;
        private long _skuSyncRunning;
        private DateTime _nextAutoSkuSyncAttemptUtc = DateTime.MinValue;

        private void InitializeD119AgentFeatures(TableLayoutPanel overviewLayout)
        {
            if (overviewLayout == null) return;

            _pickerPresenceClient = new FirestorePickerPresenceClient(message => Log(message));
            _pickerContactClient = new FirestorePickerContactClient(message => Log(message));
            _skuSyncClient = new FirestoreSkuSyncClient(message => Log(message));

            if (_supraCard != null)
            {
                _wmsCapture.SetBounds(610, 32, 142, 32);
                _wmsTest.SetBounds(760, 32, 92, 32);
                _skuSyncButton.SetBounds(860, 32, 162, 32);
                _skuSyncButton.Text = "Cập nhật SKU";
                _skuSyncButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                _skuSyncButton.Click += (s, e) => RunSkuSync(true);
                _supraCard.Controls.Add(_skuSyncButton);

                _wmsStatus.SetBounds(16, 42, 250, 22);
                _supraInfo.SetBounds(270, 42, 330, 22);
                _skuSyncStatus.SetBounds(610, 66, 412, 16);
                _skuSyncStatus.TextAlign = ContentAlignment.MiddleRight;
                _skuSyncStatus.ForeColor = Color.FromArgb(88, 104, 115);
                _skuSyncStatus.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                _supraCard.Controls.Add(_skuSyncStatus);
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

            _skuSyncButton.Enabled = authenticated;
            if (authenticated) RefreshD119OperationalViews(true);
            else
            {
                _pickerOnlineGrid.Rows.Clear();
                _pickerOnlineStatus.Text = "Đăng nhập Agent để xem Picker đang hoạt động.";
                _fleetMetricStatus.Text = "";
                _skuSyncStatus.Text = "";
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

            if (HasUsableWmsSession() && DateTime.UtcNow >= _nextAutoSkuSyncAttemptUtc)
                RunSkuSync(false);
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
                    HasActivePickerCommand(picker.UserId) ? "Đóng" : "—")];
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

        private void RunSkuSync(bool manual)
        {
            if (_skuSyncClient == null || !HasAgentSession()) return;
            if (Interlocked.CompareExchange(ref _skuSyncRunning, 1L, 0L) != 0L)
            {
                if (manual) Ui(() => _skuSyncStatus.Text = "Đang cập nhật SKU...");
                return;
            }

            if (!manual) _nextAutoSkuSyncAttemptUtc = DateTime.UtcNow.AddMinutes(15);
            Task.Run(() =>
            {
                SkuSyncLeaseResult lease = null;
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    var wms = SnapshotWmsSession();
                    if (wms == null || !wms.IsValidHy1())
                    {
                        if (manual) Ui(() => _skuSyncStatus.Text = "Cần phiên Supra WMS hợp lệ.");
                        return;
                    }

                    Ui(() =>
                    {
                        _skuSyncButton.Enabled = false;
                        _skuSyncStatus.Text = manual ? "Đang cập nhật SKU..." : "Tự đồng bộ SKU...";
                    });

                    lease = _skuSyncClient.AcquireDailyLease(session, _agentInstanceId);
                    if (!lease.Acquired)
                    {
                        Ui(() => _skuSyncStatus.Text = lease.Detail);
                        if (lease.AlreadyDone) _nextAutoSkuSyncAttemptUtc = DateTime.UtcNow.AddHours(6);
                        return;
                    }

                    var catalog = WmsSkuCatalogClient.Download(wms, message => Log(message));
                    var sourceHash = FirestoreSkuSyncClient.ComputeSourceHash(catalog.Items);
                    var inserted = 0;
                    var updated = 0;
                    var unchanged = 0;
                    var declinedConflicts = 0;

                    const int chunkSize = 800;
                    for (var offset = 0; offset < catalog.Items.Count; offset += chunkSize)
                    {
                        var count = Math.Min(chunkSize, catalog.Items.Count - offset);
                        var chunk = catalog.Items.GetRange(offset, count);
                        Ui(() => _skuSyncStatus.Text =
                            "Đang cập nhật SKU " + Math.Min(catalog.Items.Count, offset + count).ToString("N0") +
                            "/" + catalog.Items.Count.ToString("N0") + "...");

                        var result = _skuSyncClient.SubmitAndWait(session, chunk, sourceHash, false);
                        if (string.Equals(result.Status, "FAILED", StringComparison.Ordinal))
                            throw new InvalidOperationException("Service từ chối lô SKU: " + result.ResultCode);

                        inserted += result.Inserted;
                        updated += result.Updated;
                        unchanged += result.Unchanged;

                        if (string.Equals(result.Status, "AWAITING_CONFIRMATION", StringComparison.Ordinal) &&
                            result.ConflictCount > 0)
                        {
                            var approve = false;
                            UiSync(() =>
                            {
                                approve = MessageBox.Show(
                                    "Supra phát hiện " + result.ConflictCount.ToString("N0") +
                                    " SKU đã có nhưng tên sản phẩm khác.\r\n\r\n" +
                                    "Xác nhận cập nhật tên theo Supra? SKU không có trong nguồn sẽ không bị xóa.",
                                    "Xác nhận đổi tên SKU",
                                    MessageBoxButtons.YesNo,
                                    MessageBoxIcon.Question) == DialogResult.Yes;
                            });

                            if (approve)
                            {
                                var confirmed = _skuSyncClient.SubmitAndWait(session, chunk, sourceHash, true);
                                if (!string.Equals(confirmed.Status, "DONE", StringComparison.Ordinal))
                                    throw new InvalidOperationException("Không hoàn tất được lô đổi tên SKU.");
                                updated += confirmed.Updated;
                            }
                            else
                            {
                                declinedConflicts += result.ConflictCount;
                            }
                        }
                    }

                    _skuSyncClient.MarkLeaseDone(session, _agentInstanceId, lease);
                    _nextAutoSkuSyncAttemptUtc = DateTime.UtcNow.AddHours(6);
                    Ui(() => _skuSyncStatus.Text =
                        "SKU: +" + inserted.ToString("N0") +
                        " mới · " + updated.ToString("N0") +
                        " đổi tên · " + unchanged.ToString("N0") + " giữ nguyên" +
                        (declinedConflicts > 0 ? " · " + declinedConflicts.ToString("N0") + " chưa đổi tên" : ""));
                    Log("SKU_SYNC complete=PASS unique_sku=" + catalog.Items.Count +
                        " inserted=" + inserted +
                        " updated=" + updated +
                        " unchanged=" + unchanged +
                        " declined_conflicts=" + declinedConflicts +
                        " stock_fields=discarded");
                }
                catch (Exception ex)
                {
                    try
                    {
                        if (lease != null && lease.Acquired)
                            _skuSyncClient.ReleaseLeaseSoon(SnapshotSession(), _agentInstanceId, lease);
                    }
                    catch { }
                    _nextAutoSkuSyncAttemptUtc = DateTime.UtcNow.AddMinutes(15);
                    Ui(() => _skuSyncStatus.Text = "Cập nhật SKU chưa hoàn tất · " + SafeMessage(ex));
                    Log("SKU_SYNC complete=FAIL type=" + ex.GetType().Name + " detail=" + SafeMessage(ex));
                }
                finally
                {
                    Interlocked.Exchange(ref _skuSyncRunning, 0L);
                    Ui(() => _skuSyncButton.Enabled = HasAgentSession());
                }
            });
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
