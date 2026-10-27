using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private sealed class D160PickerHistoryRow
        {
            internal string RequestId = "";
            internal long SentAtMs;
            internal string UserId = "";
            internal string EmployeeCode = "";
            internal string DisplayName = "";
            internal string ContractorName = "";
            internal string InputText = "";
            internal string Result = "PENDING";
            internal string FullPickList = "";
            internal long OperationMs;
            internal int WrongCount;
            internal int LockLevel;
            internal int LockMinutes;
            internal long LockedUntilMs;
            internal string ProcessingAgentUser = "";
        }

        private readonly TabPage _d160HistoryPage = new TabPage("Lịch sử Picker xác nhận PickList");
        private readonly TabPage _d160UsagePage = new TabPage("Thông tin Usage");
        private readonly DataGridView _d160HistoryGrid = new DataGridView();
        private Panel _d160HistoryRoot;
        private readonly Label _d153HistoryTitle = new Label();
        private readonly Label _d160HistoryStatus = new Label();
        private readonly Label _d160LogStatus = new Label();
        private readonly Button _d160SendLogs = new Button();
        private readonly Button _d160OpenLogs = new Button();
        private readonly object _d160HistoryGate = new object();
        private readonly Dictionary<string, D160PickerHistoryRow> _d160History =
            new Dictionary<string, D160PickerHistoryRow>(StringComparer.Ordinal);
        private readonly Dictionary<string, DataGridViewRow> _d160HistoryGridRows =
            new Dictionary<string, DataGridViewRow>(StringComparer.Ordinal);
        private readonly JavaScriptSerializer _d160HistoryJson = new JavaScriptSerializer();
        private string _d160HistoryDayKey = "";
        private string _d160HistoryRenderedDayKey = "";
        private bool _d160HistoryUiReady;

        private static string D160HistoryDir
        {
            get { return Path.Combine(RelayDataDir, "picker-history"); }
        }

        private void InitializeD160Ui()
        {
            _connectionPage.AutoScroll = true;
            _connectionPage.Text = "Cài đặt";
            InitializeD160LogSettings();
            InitializeD160HistoryUi();
            // D168: Owner retired the Agent Usage tab, its auto-refresh and ZIP export.
            // Keep the independent operational history and support-log UI.
            UpdateD160RestrictedTabs(HasAgentSession());
            RetryD128OverlayAfterD160UiInitialized();
        }

        private void InitializeD160LogSettings()
        {
            var card = NewCard(22, 506, 1040, 188);
            card.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            card.Controls.Add(new Label
            {
                Left = 18,
                Top = 14,
                Width = 980,
                Height = 28,
                Text = "Logs",
                Font = new Font("Segoe UI Semibold", 13F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            card.Controls.Add(new Label
            {
                Left = 18,
                Top = 48,
                Width = 960,
                Height = 42,
                Text = "Agent ghi một file log đầy đủ về quá trình vận hành, xác nhận PickList, kết nối và lỗi. Thông tin nhạy cảm được làm sạch trước khi lưu/gửi.",
                ForeColor = Color.DimGray
            });
            _d160LogStatus.SetBounds(18, 94, 650, 42);
            _d160LogStatus.Text = _agentLogBridge.StatusSummary();
            _d160LogStatus.ForeColor = Color.FromArgb(88, 104, 115);
            card.Controls.Add(_d160LogStatus);

            _d160SendLogs.SetBounds(690, 90, 145, 34);
            _d160SendLogs.Text = "Gửi Logs";
            _d160SendLogs.Click += (s, e) =>
            {
                _d160LogStatus.Text = "Đang đóng gói và gửi Logs…";
                System.Threading.Tasks.Task.Run(() =>
                {
                    _agentLogBridge.TryQueueManualSnapshot();
                    Ui(() => _d160LogStatus.Text = _agentLogBridge.StatusSummary());
                });
            };
            card.Controls.Add(_d160SendLogs);

            _d160OpenLogs.SetBounds(845, 90, 145, 34);
            _d160OpenLogs.Text = "Mở file Logs";
            _d160OpenLogs.Click += (s, e) => AgentDiagnostics.OpenLog();
            card.Controls.Add(_d160OpenLogs);
            InitializeD161GlobalSupportLogControl(card);
            _connectionPage.Controls.Add(card);
        }

        private void InitializeD160HistoryUi()
        {
            _d160HistoryPage.BackColor = Color.FromArgb(243, 246, 248);
            var root = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12) };
            _d160HistoryRoot = root;
            _d160HistoryPage.Controls.Add(root);

            _d153HistoryTitle.Dock = DockStyle.Top;
            _d153HistoryTitle.Height = 38;
            _d153HistoryTitle.Text = "Lịch sử Picker xác nhận PickList";
            _d153HistoryTitle.Font = new Font("Segoe UI Semibold", 13F, FontStyle.Bold);
            _d153HistoryTitle.TextAlign = ContentAlignment.MiddleLeft;
            root.Controls.Add(_d153HistoryTitle);
            _d160HistoryStatus.Dock = DockStyle.Top;
            _d160HistoryStatus.Height = 42;
            _d160HistoryStatus.Text = "Lịch sử ca 05:00–04:59 · tự đồng bộ giữa các Agent đang hoạt động.";
            _d160HistoryStatus.ForeColor = Color.FromArgb(71, 85, 105);
            root.Controls.Add(_d160HistoryStatus);

            _d160HistoryGrid.Dock = DockStyle.Fill;
            _d160HistoryGrid.ReadOnly = true;
            _d160HistoryGrid.ColumnHeadersVisible = true;
            _d160HistoryGrid.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            _d160HistoryGrid.ColumnHeadersHeight = 38;
            _d160HistoryGrid.EnableHeadersVisualStyles = false;
            _d160HistoryGrid.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI Semibold", 9F, FontStyle.Bold);
            _d160HistoryGrid.AllowUserToAddRows = false;
            _d160HistoryGrid.AllowUserToDeleteRows = false;
            _d160HistoryGrid.AllowUserToResizeRows = false;
            _d160HistoryGrid.RowHeadersVisible = false;
            _d160HistoryGrid.MultiSelect = false;
            _d160HistoryGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _d160HistoryGrid.AutoGenerateColumns = false;
            _d160HistoryGrid.BackgroundColor = Color.White;
            _d160HistoryGrid.BorderStyle = BorderStyle.FixedSingle;
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "SentAtMs", HeaderText = "SentAtMs", Visible = false, ValueType = typeof(long) });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Time", HeaderText = "Thời gian", Width = 86 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Employee", HeaderText = "MNV / User", Width = 120 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Name", HeaderText = "Họ tên", Width = 180 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Contractor", HeaderText = "Nhà thầu", Width = 140 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Input", HeaderText = "Cụm gửi", Width = 100 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Result", HeaderText = "Kết quả", Width = 210 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "FullPickList", HeaderText = "PickList đầy đủ", Width = 170 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Wrong", HeaderText = "Nhập sai", Width = 78 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Lock", HeaderText = "Khóa", Width = 120 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Ms", HeaderText = "Xử lý", Width = 82 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Processor", HeaderText = "User Agent xử lý", Width = 145 });
            root.Controls.Add(_d160HistoryGrid);
            _d160HistoryGrid.SendToBack();
            _d160HistoryStatus.BringToFront();
            _d153HistoryTitle.BringToFront();
            _mainTabs.SelectedIndexChanged += (s, e) =>
            {
                if (_mainTabs.SelectedTab == _d160HistoryPage)
                {
                    ShowD160HistorySurface();
                    // WinForms can defer TabPage child layout until the native tab switch finishes.
                    // Recheck on the next UI dispatch; never refetch provider data or reset history.
                    if (IsHandleCreated && !IsDisposed)
                        BeginInvoke(new Action(() => {
                            if (!IsDisposed && _mainTabs.SelectedTab == _d160HistoryPage)
                                ShowD160HistorySurface();
                        }));
                }
                else if (_mainTabs.SelectedTab == _d160UsagePage)
                {
                    ApplyD160PendingUsageSnapshot();
                }
            };
            _d160HistoryUiReady = true;

            var day = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            ResetD160HistoryForBusinessDay(day);
            // Startup model may have loaded before the first WinForms grid
            // existed. Populate the initial view once, then reconcile by ID.
            RenderD160HistorySnapshot(day);
        }

        private void ShowD160HistorySurface()
        {
            if (!_d160HistoryUiReady || IsDisposed || _d160HistoryRoot == null ||
                _d160HistoryRoot.IsDisposed || _d160HistoryGrid.IsDisposed) return;
            try
            {
                var rebuilt = false;
                if (!_d160HistoryPage.Controls.Contains(_d160HistoryRoot))
                {
                    _d160HistoryPage.Controls.Add(_d160HistoryRoot);
                    rebuilt = true;
                }
                if (!_d160HistoryRoot.Controls.Contains(_d153HistoryTitle))
                {
                    _d160HistoryRoot.Controls.Add(_d153HistoryTitle);
                    rebuilt = true;
                }
                if (!_d160HistoryRoot.Controls.Contains(_d160HistoryStatus))
                {
                    _d160HistoryRoot.Controls.Add(_d160HistoryStatus);
                    rebuilt = true;
                }
                if (!_d160HistoryRoot.Controls.Contains(_d160HistoryGrid))
                {
                    _d160HistoryRoot.Controls.Add(_d160HistoryGrid);
                    rebuilt = true;
                }
                _d160HistoryRoot.Dock = DockStyle.Fill;
                _d160HistoryRoot.Visible = true;
                _d160HistoryGrid.Dock = DockStyle.Fill;
                _d160HistoryGrid.Visible = true;
                _d160HistoryGrid.ColumnHeadersVisible = true;
                if (_d160HistoryGrid.ColumnHeadersHeight < 32)
                    _d160HistoryGrid.ColumnHeadersHeight = 38;
                _d160HistoryGrid.SendToBack();
                _d160HistoryStatus.Dock = DockStyle.Top;
                _d160HistoryStatus.Visible = true;
                _d160HistoryStatus.BringToFront();
                _d160HistoryRoot.BringToFront();
                _d160HistoryRoot.PerformLayout();
                if (_d160HistoryGrid.Rows.Count == 0 || rebuilt)
                    RenderD160HistorySnapshot(_d160HistoryDayKey);
                else D161RestoreCanonicalHistorySort();
                _d160HistoryGrid.Invalidate(true);
                if (rebuilt)
                    Log("D173 HISTORY surface_recovered=1");
            }
            catch (Exception ex)
            {
                _d160HistoryStatus.Text = "Không thể hiển thị lịch sử; mở lại tab hoặc khởi động lại Agent.";
                Log("D173 HISTORY surface_error=" + ex.GetType().Name);
            }
        }

        internal void UpdateD160RestrictedTabs(bool authenticated)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<bool>(UpdateD160RestrictedTabs), authenticated);
                return;
            }

            if (authenticated)
            {
                if (!_mainTabs.TabPages.Contains(_d160HistoryPage))
                    _mainTabs.TabPages.Add(_d160HistoryPage);
            }
            else
            {
                if (_mainTabs.TabPages.Contains(_d160HistoryPage))
                    _mainTabs.TabPages.Remove(_d160HistoryPage);
            }

            // Hide retired Usage even after session role changes. No provider fetch is scheduled.
            StopD160Usage();
            if (_mainTabs.TabPages.Contains(_d160UsagePage))
                _mainTabs.TabPages.Remove(_d160UsagePage);
        }


        // Retain this compatibility gate for compiled D160/D166 helpers:
        // D168 Owner decommissioned all Agent Usage requests and ZIP export.
        private bool D160UsageAllowedForCurrentSession() { return false; }

        private void RecordD160PickerHistoryRequest(FirestoreConfirmationWorkItem work)
        {
            if (work == null || string.IsNullOrWhiteSpace(work.RequestId)) return;
            var row = new D160PickerHistoryRow
            {
                RequestId = work.RequestId,
                SentAtMs = work.ClientSentAtMs > 0 ? work.ClientSentAtMs : work.CreatedAtMs,
                UserId = work.PickerUserId ?? "",
                EmployeeCode = work.PickerEmployeeCode ?? "",
                DisplayName = work.PickerDisplayName ?? "",
                ContractorName = work.PickerContractorName ?? "",
                InputText = work.Suffix ?? "",
                Result = "Đang xử lý",
                FullPickList = "",
                OperationMs = 0,
                ProcessingAgentUser = D161CurrentProcessingAgentUser()
            };
            lock (_d160HistoryGate) _d160History[work.RequestId] = row;
            AppendD160HistoryEvent(row);
            Ui(() => RenderD160HistoryRow(row));
        }

        private void RecordD160PickerHistoryOutcome(
            FirestoreConfirmationWorkItem work,
            FirestoreConfirmationOutcome outcome)
        {
            if (work == null || outcome == null || string.IsNullOrWhiteSpace(work.RequestId)) return;
            D160PickerHistoryRow row;
            lock (_d160HistoryGate)
            {
                if (!_d160History.TryGetValue(work.RequestId, out row))
                {
                    row = new D160PickerHistoryRow
                    {
                        RequestId = work.RequestId,
                        SentAtMs = work.ClientSentAtMs > 0 ? work.ClientSentAtMs : work.CreatedAtMs,
                        UserId = work.PickerUserId ?? "",
                        EmployeeCode = work.PickerEmployeeCode ?? "",
                        DisplayName = work.PickerDisplayName ?? "",
                        InputText = work.Suffix ?? ""
                    };
                    _d160History[work.RequestId] = row;
                }
                if (!string.IsNullOrWhiteSpace(work.PickerContractorName))
                    row.ContractorName = work.PickerContractorName;
                if (!string.IsNullOrWhiteSpace(outcome.PickerContractorName))
                    row.ContractorName = outcome.PickerContractorName;
                row.Result = D160HistoryResultText(outcome.Result);
                row.FullPickList = outcome.ResolvedPickListCode ?? "";
                row.OperationMs = Math.Max(0L, outcome.OperationMs);
                row.ProcessingAgentUser = D161CurrentProcessingAgentUser();
                var rate = outcome.Rate;
                row.WrongCount = rate == null ? 0 : Math.Max(0, rate.NewlyLocked ? 3 : rate.StrikeCount);
                row.LockLevel = rate == null ? 0 : Math.Max(0, rate.LockLevel);
                row.LockMinutes = rate == null ? 0 : Math.Max(0, rate.LockMinutes);
                row.LockedUntilMs = rate == null ? 0L : Math.Max(0L, rate.LockedUntilMs);
            }
            AppendD160HistoryEvent(row);
            Ui(() => RenderD160HistoryRow(row));
        }

        internal void ResetD160HistoryForBusinessDay(string dayKey)
        {
            if (string.IsNullOrWhiteSpace(dayKey)) return;

            var changedDay = false;
            lock (_d160HistoryGate)
            {
                if (!string.Equals(_d160HistoryDayKey, dayKey, StringComparison.Ordinal))
                {
                    _d160HistoryDayKey = dayKey;
                    _d160HistoryRenderedDayKey = "";
                    _d160History.Clear();
                    LoadD160HistoryNoLock(dayKey);
                    changedDay = true;
                }
            }

            // D160 v97: model lifecycle is independent from WinForms lifecycle.
            // Startup may reset/load the business-day model before the History grid
            // has any columns. Rendering is deferred until InitializeD160HistoryUi.
            // A same-day fleet poll must not tear down/rebuild the entire grid.
            // Only day transition resets the model; incremental business events
            // update rows through RenderD160HistoryRow/ApplyD160HistorySyncSnapshot.
            if (_d160HistoryUiReady && changedDay)
                RenderD160HistorySnapshot(dayKey);

            if (changedDay) CleanupD160OldHistoryFiles(dayKey);
        }

        private void RenderD160HistorySnapshot(string dayKey)
        {
            if (!_d160HistoryUiReady || _d160HistoryGrid.IsDisposed || _d160HistoryGrid.Columns.Count == 0) return;
            if (string.IsNullOrWhiteSpace(dayKey)) return;

            List<D160PickerHistoryRow> rows;
            lock (_d160HistoryGate)
            {
                if (!string.Equals(_d160HistoryDayKey, dayKey, StringComparison.Ordinal)) return;
                rows = _d160History.Values.OrderByDescending(item => item.SentAtMs).ToList();
            }

            if (_d160HistoryGrid.InvokeRequired)
            {
                if (_d160HistoryGrid.IsHandleCreated)
                    _d160HistoryGrid.BeginInvoke(new Action(() =>
                        RenderD160HistorySnapshot(dayKey)));
                return;
            }
            var prepared = rows.Select(D161HistoryValues).ToArray();
            var keep = new HashSet<string>(rows.Select(r => r.RequestId),
                StringComparer.Ordinal);
            _d160HistoryGrid.SuspendLayout();
            try
            {
                // Do not blank out the entire grid on a repeated same-day snapshot.
                // WinForms may be painting this tab while Desktop sampling runs.
                foreach (var id in _d160HistoryGridRows.Keys.ToArray())
                {
                    DataGridViewRow existing;
                    if (!_d160HistoryGridRows.TryGetValue(id,out existing))continue;
                    if (keep.Contains(id) && existing != null &&
                        existing.DataGridView == _d160HistoryGrid)continue;
                    if (existing != null && existing.DataGridView == _d160HistoryGrid)
                        _d160HistoryGrid.Rows.Remove(existing);
                    _d160HistoryGridRows.Remove(id);
                }
                for (var i = 0; i < rows.Count; i++)
                {
                    var id=rows[i].RequestId;
                    if (string.IsNullOrWhiteSpace(id))continue;
                    DataGridViewRow target;
                    if (!_d160HistoryGridRows.TryGetValue(id,out target) ||
                        target == null || target.DataGridView != _d160HistoryGrid)
                    {
                        var index=_d160HistoryGrid.Rows.Add(prepared[i]);
                        target=_d160HistoryGrid.Rows[index];
                        target.Tag=id;
                        _d160HistoryGridRows[id]=target;
                    }
                    else
                    {
                        var values=prepared[i];
                        for (var j=0;j<values.Length && j<target.Cells.Count;j++)
                        {
                            if (!object.Equals(target.Cells[j].Value,values[j]))
                                target.Cells[j].Value=values[j];
                        }
                    }
                }
                _d160HistoryRenderedDayKey = dayKey;
                _d160HistoryStatus.Text =
                    "Ngày vận hành " + dayKey + " · " + rows.Count.ToString("N0") +
                    " request · reset lúc 05:00 · tự đồng bộ giữa các Agent.";
                D161RestoreCanonicalHistorySort();
            }
            catch(Exception ex)
            {
                _d160HistoryStatus.Text =
                    "Lịch sử tạm lỗi hiển thị · thử mở lại tab. Dữ liệu gốc vẫn được giữ.";
                Log("D173 HISTORY row_reconcile_error="+ex.GetType().Name);
            }
            finally
            {
                _d160HistoryGrid.ResumeLayout(true);
            }
        }

        private void RenderD160HistoryRow(D160PickerHistoryRow item)
        {
            if (item == null || !_d160HistoryUiReady || _d160HistoryGrid.IsDisposed || _d160HistoryGrid.Columns.Count == 0) return;
            DataGridViewRow target;
            if (!_d160HistoryGridRows.TryGetValue(item.RequestId ?? "", out target) || target == null || target.DataGridView == null)
            {
                var index = _d160HistoryGrid.Rows.Add(D161HistoryValues(item));
                target = _d160HistoryGrid.Rows[index];
                target.Tag = item.RequestId;
                _d160HistoryGridRows[item.RequestId ?? ""] = target;
                if (_mainTabs.SelectedTab == _d160HistoryPage) D161RestoreCanonicalHistorySort();
            }
            else
            {
                var values = D161HistoryValues(item);
                for (var i = 0; i < values.Length && i < target.Cells.Count; i++)
                    target.Cells[i].Value = values[i];
            }

            int count;
            lock (_d160HistoryGate) count = _d160History.Count;
            _d160HistoryStatus.Text =
                "Ngày vận hành " + _d160HistoryDayKey + " · " + count.ToString("N0") +
                " request · reset lúc 05:00 · tự đồng bộ giữa các Agent.";
        }

        private object[] D161HistoryValues(D160PickerHistoryRow item)
        {
            var when = item.SentAtMs > 0
                ? DateTimeOffset.FromUnixTimeMilliseconds(item.SentAtMs).ToLocalTime().ToString("HH:mm:ss")
                : "--";
            var user = string.IsNullOrWhiteSpace(item.EmployeeCode) ? item.UserId : item.EmployeeCode;
            return new object[]
            {
                item.SentAtMs,
                when,
                user,
                item.DisplayName,
                item.ContractorName,
                item.InputText,
                item.Result,
                item.FullPickList,
                item.WrongCount > 0 ? item.WrongCount.ToString(CultureInfo.InvariantCulture) : "",
                D160HistoryLockText(item),
                item.OperationMs > 0 ? item.OperationMs.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + " ms" : "",
                item.ProcessingAgentUser ?? ""
            };
        }

        private void D161RestoreCanonicalHistorySort()
        {
            if (!_d160HistoryUiReady || _d160HistoryGrid.IsDisposed) return;
            var column = _d160HistoryGrid.Columns["SentAtMs"];
            if (column != null && _d160HistoryGrid.Rows.Count > 1)
                _d160HistoryGrid.Sort(column, System.ComponentModel.ListSortDirection.Descending);
        }

        private string D161CurrentProcessingAgentUser()
        {
            try
            {
                var session = SnapshotSession();
                if (session == null) return "";
                var login = (session.LoginName ?? "").Trim();
                return login.Length > 0 ? login : ((session.AppUserId ?? "").Trim());
            }
            catch { return ""; }
        }

        private void AppendD160HistoryEvent(D160PickerHistoryRow row)
        {
            try
            {
                string day;
                lock (_d160HistoryGate) day = _d160HistoryDayKey;
                if (string.IsNullOrWhiteSpace(day))
                    day = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
                Directory.CreateDirectory(D160HistoryDir);
                var payload = new Dictionary<string, object>
                {
                    { "request_id", row.RequestId },
                    { "sent_at_ms", row.SentAtMs },
                    { "user_id", row.UserId },
                    { "employee_code", row.EmployeeCode },
                    { "display_name", row.DisplayName },
                    { "contractor_name", row.ContractorName },
                    { "input_text", row.InputText },
                    { "result", row.Result },
                    { "full_picklist", row.FullPickList },
                    { "operation_ms", row.OperationMs },
                    { "wrong_count", row.WrongCount },
                    { "lock_level", row.LockLevel },
                    { "lock_minutes", row.LockMinutes },
                    { "locked_until_ms", row.LockedUntilMs },
                    { "processing_agent_user", row.ProcessingAgentUser ?? "" }
                };
                File.AppendAllText(
                    D160HistoryPath(day),
                    _d160HistoryJson.Serialize(payload) + Environment.NewLine,
                    System.Text.Encoding.UTF8);
            }
            catch (Exception ex)
            {
                Log("D160 HISTORY local_append=DEFER type=" + ex.GetType().Name);
            }
        }

        private void LoadD160HistoryNoLock(string dayKey)
        {
            try
            {
                var path = D160HistoryPath(dayKey);
                if (!File.Exists(path)) return;
                var invalidRecords = 0;
                foreach (var line in File.ReadLines(path))
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    Dictionary<string, object> map;
                    try { map = _d160HistoryJson.DeserializeObject(line) as Dictionary<string, object>; }
                    catch { invalidRecords++; continue; }
                    if (map == null) continue;
                    var requestId = D160MapString(map, "request_id");
                    if (string.IsNullOrWhiteSpace(requestId)) continue;
                    _d160History[requestId] = new D160PickerHistoryRow
                    {
                        RequestId = requestId,
                        SentAtMs = D160MapLong(map, "sent_at_ms"),
                        UserId = D160MapString(map, "user_id"),
                        EmployeeCode = D160MapString(map, "employee_code"),
                        DisplayName = D160MapString(map, "display_name"),
                        ContractorName = D160MapString(map, "contractor_name"),
                        InputText = D160MapString(map, "input_text"),
                        Result = D160MapString(map, "result"),
                        FullPickList = D160MapString(map, "full_picklist"),
                        OperationMs = D160MapLong(map, "operation_ms"),
                        WrongCount = (int)D160MapLong(map, "wrong_count"),
                        LockLevel = (int)D160MapLong(map, "lock_level"),
                        LockMinutes = (int)D160MapLong(map, "lock_minutes"),
                        LockedUntilMs = D160MapLong(map, "locked_until_ms"),
                        ProcessingAgentUser = D160MapString(map, "processing_agent_user")
                    };
                }
                if (invalidRecords > 0)
                    Log("D173 HISTORY local_invalid_records=" + invalidRecords.ToString(CultureInfo.InvariantCulture));
            }
            catch (Exception ex)
            {
                Log("D173 HISTORY local_read_error=" + ex.GetType().Name);
            }
        }

        private static string D160HistoryPath(string dayKey)
        {
            var safe = new string((dayKey ?? "").Where(ch => char.IsDigit(ch) || ch == '-').ToArray());
            return Path.Combine(D160HistoryDir, "picker-history-" + safe + ".jsonl");
        }

        internal static bool PrepareD160StartupSmokeHistory()
        {
            try
            {
                var day = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
                var path = D160HistoryPath(day);
                if (File.Exists(path) && new FileInfo(path).Length > 0) return false;
                Directory.CreateDirectory(D160HistoryDir);
                var payload = new Dictionary<string, object>
                {
                    { "request_id", "d160-startup-smoke-history" },
                    { "sent_at_ms", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() },
                    { "user_id", "startup-smoke" },
                    { "employee_code", "SMOKE" },
                    { "display_name", "D160 startup smoke" },
                    { "contractor_name", "" },
                    { "input_text", "0000" },
                    { "result", "CONFIRMED" },
                    { "full_picklist", "PL0000" },
                    { "operation_ms", 1L },
                    { "wrong_count", 0 },
                    { "lock_level", 0 },
                    { "lock_minutes", 0 },
                    { "locked_until_ms", 0L },
                    { "processing_agent_user", "startup-smoke" }
                };
                File.WriteAllText(path, new JavaScriptSerializer().Serialize(payload) + Environment.NewLine, System.Text.Encoding.UTF8);
                return true;
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("D160 STARTUP_SMOKE history_seed=FAIL type=" + ex.GetType().Name);
                return false;
            }
        }

        internal static void CleanupD160StartupSmokeHistory(bool created)
        {
            if (!created) return;
            try
            {
                var day = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
                var path = D160HistoryPath(day);
                if (File.Exists(path)) File.Delete(path);
            }
            catch { }
        }

        internal bool D160StartupSmokeLifecycleReady()
        {
            return _d160HistoryUiReady &&
                   _d160HistoryGrid.Columns.Count >= 12 &&
                   _d160HistoryGrid.Rows.Count >= 1 &&
                   _d128OverlayUiInitialized &&
                   _d128Overlay != null &&
                   !_d128Overlay.IsDisposed;
        }

        private static void CleanupD160OldHistoryFiles(string currentDay)
        {
            try
            {
                if (!Directory.Exists(D160HistoryDir)) return;
                var current = Path.GetFullPath(D160HistoryPath(currentDay));
                foreach (var path in Directory.GetFiles(D160HistoryDir, "picker-history-*.jsonl"))
                    if (!string.Equals(Path.GetFullPath(path), current, StringComparison.OrdinalIgnoreCase))
                        File.Delete(path);
            }
            catch { }
        }

        private void ApplyD160HistorySyncSnapshot(string dayKey, string raw)
        {
            if (string.IsNullOrWhiteSpace(raw) || raw == "[]") return;
            var currentDay = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            if (!string.Equals(dayKey ?? "", currentDay, StringComparison.Ordinal)) return;

            try
            {
                var array = _d160HistoryJson.DeserializeObject(raw) as System.Collections.IEnumerable;
                if (array == null) return;
                var changed = false;
                var changedIds = new List<string>();
                lock (_d160HistoryGate)
                {
                    foreach (var item in array)
                    {
                        var map = item as Dictionary<string, object>;
                        if (map == null) continue;
                        var requestId = D160MapString(map, "r");
                        if (string.IsNullOrWhiteSpace(requestId)) continue;

                        var incoming = new D160PickerHistoryRow
                        {
                            RequestId = requestId,
                            SentAtMs = D160MapLong(map, "t"),
                            UserId = D160MapString(map, "u"),
                            EmployeeCode = D160MapString(map, "e"),
                            DisplayName = D160MapString(map, "n"),
                            ContractorName = D160MapString(map, "c"),
                            InputText = D160MapString(map, "i"),
                            Result = D160MapString(map, "s"),
                            FullPickList = D160MapString(map, "p"),
                            OperationMs = D160MapLong(map, "m"),
                            WrongCount = (int)D160MapLong(map, "w"),
                            LockLevel = (int)D160MapLong(map, "l"),
                            LockMinutes = (int)D160MapLong(map, "q"),
                            LockedUntilMs = D160MapLong(map, "z"),
                            ProcessingAgentUser = D160MapString(map, "a")
                        };

                        D160PickerHistoryRow existing;
                        if (_d160History.TryGetValue(requestId, out existing) && existing != null)
                        {
                            if (existing.OperationMs > incoming.OperationMs &&
                                !string.Equals(existing.Result, "Đang xử lý", StringComparison.Ordinal))
                                continue;
                            if (D160HistoryRowsEquivalent(existing, incoming))
                                continue;
                        }

                        _d160History[requestId] = incoming;
                        changed = true;
                        changedIds.Add(requestId);
                    }
                }

                if (!changed) return;
                Ui(() =>
                {
                    if (changedIds.Count == 1)
                    {
                        D160PickerHistoryRow row;
                        lock (_d160HistoryGate) _d160History.TryGetValue(changedIds[0], out row);
                        if (row != null) RenderD160HistoryRow(row);
                    }
                    else
                    {
                        RenderD160HistorySnapshot(currentDay);
                    }
                });
            }
            catch (Exception ex)
            {
                Log("D160 HISTORY fleet_merge=DEFER type=" + ex.GetType().Name);
            }
        }

        private static bool D160HistoryRowsEquivalent(D160PickerHistoryRow a, D160PickerHistoryRow b)
        {
            if (a == null || b == null) return a == b;
            return a.SentAtMs == b.SentAtMs &&
                   string.Equals(a.UserId ?? "", b.UserId ?? "", StringComparison.Ordinal) &&
                   string.Equals(a.EmployeeCode ?? "", b.EmployeeCode ?? "", StringComparison.Ordinal) &&
                   string.Equals(a.DisplayName ?? "", b.DisplayName ?? "", StringComparison.Ordinal) &&
                   string.Equals(a.ContractorName ?? "", b.ContractorName ?? "", StringComparison.Ordinal) &&
                   string.Equals(a.InputText ?? "", b.InputText ?? "", StringComparison.Ordinal) &&
                   string.Equals(a.Result ?? "", b.Result ?? "", StringComparison.Ordinal) &&
                   string.Equals(a.FullPickList ?? "", b.FullPickList ?? "", StringComparison.Ordinal) &&
                   a.OperationMs == b.OperationMs &&
                   a.WrongCount == b.WrongCount &&
                   a.LockLevel == b.LockLevel &&
                   a.LockMinutes == b.LockMinutes &&
                   a.LockedUntilMs == b.LockedUntilMs &&
                   string.Equals(a.ProcessingAgentUser ?? "", b.ProcessingAgentUser ?? "", StringComparison.Ordinal);
        }

        // D160_HISTORY_ZERO_EXTRA_PROVIDER_OP: this payload is carried only by the
        // existing counter-driven agent_sync reconcile; it owns no listener/poll/write cadence.
        internal string D160HistorySnapshotJson()
        {
            try
            {
                List<D160PickerHistoryRow> rows;
                lock (_d160HistoryGate)
                    rows = _d160History.Values.OrderBy(item => item.SentAtMs).ToList();

                var compact = new List<object>();
                foreach (var row in rows)
                {
                    compact.Add(new Dictionary<string, object>
                    {
                        { "r", row.RequestId ?? "" },
                        { "t", row.SentAtMs },
                        { "u", row.UserId ?? "" },
                        { "e", row.EmployeeCode ?? "" },
                        { "n", row.DisplayName ?? "" },
                        { "c", row.ContractorName ?? "" },
                        { "i", row.InputText ?? "" },
                        { "s", row.Result ?? "" },
                        { "p", row.FullPickList ?? "" },
                        { "m", row.OperationMs },
                        { "w", row.WrongCount },
                        { "l", row.LockLevel },
                        { "q", row.LockMinutes },
                        { "z", row.LockedUntilMs },
                        { "a", row.ProcessingAgentUser ?? "" }
                    });
                }

                var raw = _d160HistoryJson.Serialize(compact);
                while (System.Text.Encoding.UTF8.GetByteCount(raw) > 420000 && compact.Count > 1)
                {
                    compact.RemoveRange(0, Math.Min(50, compact.Count - 1));
                    raw = _d160HistoryJson.Serialize(compact);
                }
                return System.Text.Encoding.UTF8.GetByteCount(raw) <= 420000 ? raw : "[]";
            }
            catch
            {
                return "[]";
            }
        }

        private static string D160HistoryLockText(D160PickerHistoryRow item)
        {
            if (item == null || item.LockLevel <= 0) return "";
            var prefix = "L" + item.LockLevel.ToString(CultureInfo.InvariantCulture);
            if (item.LockedUntilMs > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())
            {
                var until = DateTimeOffset.FromUnixTimeMilliseconds(item.LockedUntilMs)
                    .ToLocalTime().ToString("HH:mm:ss");
                return prefix + " · " + Math.Max(0, item.LockMinutes).ToString(CultureInfo.InvariantCulture) +
                    "p · đến " + until;
            }
            return prefix + (item.LockMinutes > 0
                ? " · " + item.LockMinutes.ToString(CultureInfo.InvariantCulture) + "p"
                : "");
        }

        private static string D160HistoryResultText(string result)
        {
            switch (result ?? "")
            {
                case "CONFIRMED": return "Đã xác nhận";
                case "NOT_FOUND": return "Không tìm thấy PickList";
                case "AMBIGUOUS_PICKLIST": return "Trùng nhiều PickList";
                case "PICKER_LOCKED": return "Picker đang bị khóa";
                case "WMS_SESSION_REQUIRED": return "Web Agent chưa sẵn sàng";
                case "SESSION_EXPIRED": return "Phiên Web Supra đã hết hạn";
                case "WMS_DATA_UNAVAILABLE": return "Dữ liệu Supra chưa sẵn sàng";
                case "LOOKUP_ERROR": return "Lỗi đọc dữ liệu Web Supra";
                case "TRANSPORT_FAIL": return "Kết nối Supra đang gián đoạn";
                case "FORBIDDEN": return "Supra từ chối quyền xác nhận";
                case "CONFIRM_CONFLICT": return "Checkbox/trạng thái chưa sẵn sàng";
                case "CONFIRM_REJECTED": return "Supra từ chối xác nhận";
                case "CONFIRM_IN_PROGRESS_OR_UNCERTAIN": return "Chưa xác định kết quả";
                case "REQUEST_EXPIRED": return "Quá thời gian xử lý";
                default: return string.IsNullOrWhiteSpace(result) ? "Lỗi chưa xác định" : result;
            }
        }

        private static string D160MapString(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) && value != null
                ? Convert.ToString(value, CultureInfo.InvariantCulture)
                : "";
        }

        private static long D160MapLong(Dictionary<string, object> map, string key)
        {
            long value;
            return long.TryParse(D160MapString(map, key), NumberStyles.Any, CultureInfo.InvariantCulture, out value) ? value : 0L;
        }
    }
}
