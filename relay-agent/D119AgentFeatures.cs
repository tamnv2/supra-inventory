using System;
using System.Collections.Generic;
using System.Drawing;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
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
        private readonly TextBox _pickerSearch = new TextBox();
        private List<PickerPresenceView> _pickerOnlineSnapshot = new List<PickerPresenceView>();
        private string _pickerOnlineRenderSignature = "";
        private bool? _d119AuthenticatedState;
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
        private FirestoreFleetMetricsClient _fleetMetricsClient;
        private FleetMetricSnapshot _fleetSnapshot;
        private long _fleetMetricsRefreshRunning;
        private DateTime _lastFleetMetricsRefreshUtc = DateTime.MinValue;
        private DateTime _lastFleetMetricsAttemptUtc = DateTime.MinValue;
        private bool _lastFleetPrimary;
        private long _skuSyncRunning;
        private DateTime _nextAutoSkuSyncAttemptUtc = DateTime.MinValue;

        private void InitializeD119AgentFeatures(TableLayoutPanel overviewLayout)
        {
            if (overviewLayout == null) return;

            _pickerPresenceClient = new FirestorePickerPresenceClient(message => Log(message));
            _pickerContactClient = new FirestorePickerContactClient(message => Log(message));
            _skuSyncClient = new FirestoreSkuSyncClient(message => Log(message));
            _fleetMetricsClient = new FirestoreFleetMetricsClient(message => Log(message));

            if (_supraCard != null)
            {
                _wmsCapture.SetBounds(16, 72, 138, 32);
                _wmsLogout.SetBounds(162, 72, 128, 32);
                _wmsTest.SetBounds(298, 72, 96, 32);
                _skuSyncButton.SetBounds(402, 72, 140, 32);
                _skuSyncButton.Text = "Cập nhật SKU";
                _skuSyncButton.Anchor = AnchorStyles.Top | AnchorStyles.Left;
                _skuSyncButton.Click += (s, e) => RunSkuSync(true);
                _supraCard.Controls.Add(_skuSyncButton);

                _wmsStatus.SetBounds(16, 42, 210, 22);
                _supraInfo.SetBounds(232, 42, Math.Max(220, _supraCard.ClientSize.Width - 248), 22);
                _supraInfo.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
                _skuSyncStatus.SetBounds(550, 79, Math.Max(150, _supraCard.ClientSize.Width - 566), 18);
                _skuSyncStatus.TextAlign = ContentAlignment.MiddleRight;
                _skuSyncStatus.ForeColor = Color.FromArgb(88, 104, 115);
                _skuSyncStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
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
                Width = 88
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

                // D121: Agent / Relay / Wi-Fi are one compact status row.
                LayoutAgentSystemStatusRow(host, 100);
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
                _manualUpdate.SetBounds(16, 118, 148, 30);
                _background.SetBounds(174, 118, 142, 30);
                LayoutAgentSystemStatusRow(host, 154);
                _agentFleetGrid.Visible = false;
            }

            _skuSyncButton.Enabled = authenticated;
            var authChanged = !_d119AuthenticatedState.HasValue || _d119AuthenticatedState.Value != authenticated;
            _d119AuthenticatedState = authenticated;
            if (authenticated)
            {
                if (authChanged) RefreshD119OperationalViews(true);
            }
            else
            {
                _pickerOnlineSnapshot = new List<PickerPresenceView>();
                _pickerOnlineRenderSignature = "";
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
            var primary = coordinator != null && coordinator.IsLeader;
            RefreshFleetMetricsIfDue(_fleetSnapshot == null || (primary && !_lastFleetPrimary), primary);
            _lastFleetPrimary = primary;
            RenderFleetMetricStatus(primary);

            var interval = primary
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

            if (HasUsableWmsSession() && DateTime.UtcNow >= _nextAutoSkuSyncAttemptUtc)
                RunSkuSync(false);
        }

        private void UpdatePickerOnlineGrid(List<PickerPresenceView> items, bool primary)
        {
            _pickerOnlineSnapshot = items ?? new List<PickerPresenceView>();
            RenderPickerOnlineSnapshot();
            _pickerOnlineStatus.Text =
                _pickerOnlineSnapshot.Count.ToString("N0") +
                " Picker đang hoạt động" +
                (primary ? " · cập nhật trực tiếp" : " · cập nhật tiết kiệm");
            RenderFleetMetricStatus(primary);
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
            var localRequests = Interlocked.Read(ref _localPdaRequests);
            var localResponses = Interlocked.Read(ref _localAgentResponses);
            var snapshot = _fleetSnapshot;
            var fleet = snapshot == null
                ? "Cụm: —/—"
                : "Cụm hôm nay: " + snapshot.AcceptedTotal.ToString("N0") +
                  "/" + snapshot.ProcessedTotal.ToString("N0");
            _fleetMetricStatus.Text = fleet +
                " · Máy này: " + localRequests.ToString("N0") + "/" + localResponses.ToString("N0") +
                (primary ? " · realtime" : " · 30p");
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
