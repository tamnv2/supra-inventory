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
            internal int LockCount;
            internal long LockedUntilMs;
        }

        private readonly TabPage _d160HistoryPage = new TabPage("Lịch sử Picker xác nhận PickList");
        private readonly TabPage _d160UsagePage = new TabPage("Thông tin Usage");
        private readonly DataGridView _d160HistoryGrid = new DataGridView();
        private readonly Label _d160HistoryStatus = new Label();
        private readonly Label _d160LogStatus = new Label();
        private readonly Button _d160SendLogs = new Button();
        private readonly Button _d160OpenLogs = new Button();
        private readonly object _d160HistoryGate = new object();
        private readonly Dictionary<string, D160PickerHistoryRow> _d160History =
            new Dictionary<string, D160PickerHistoryRow>(StringComparer.Ordinal);
        private readonly JavaScriptSerializer _d160HistoryJson = new JavaScriptSerializer();
        private string _d160HistoryDayKey = "";

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
            InitializeD160UsageUi();
            UpdateD160RestrictedTabs(HasAgentSession());
        }

        private void InitializeD160LogSettings()
        {
            var card = NewCard(22, 510, 1040, 190);
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
                Text = "Agent ghi một file log đầy đủ gồm vận hành PDA ↔ Agent, WMS, Firestore, lỗi và chẩn đoán. Log được làm sạch thông tin nhạy cảm trước khi lưu/gửi.",
                ForeColor = Color.DimGray
            });
            _d160LogStatus.SetBounds(18, 94, 650, 42);
            _d160LogStatus.Text = _agentLogBridge.GetStatusSummary() + " · bảo hiểm gửi lúc 21:45.";
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
                    Ui(() => _d160LogStatus.Text = _agentLogBridge.GetStatusSummary() +
                        " · Nếu còn gói chờ, Agent sẽ tự gửi lại khi mạng sẵn sàng.");
                });
            };
            card.Controls.Add(_d160SendLogs);

            _d160OpenLogs.SetBounds(845, 90, 145, 34);
            _d160OpenLogs.Text = "Mở file Logs";
            _d160OpenLogs.Click += (s, e) => AgentDiagnostics.OpenLog();
            card.Controls.Add(_d160OpenLogs);
            _connectionPage.Controls.Add(card);
        }

        private void InitializeD160HistoryUi()
        {
            _d160HistoryPage.BackColor = Color.FromArgb(243, 246, 248);
            var root = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12) };
            _d160HistoryPage.Controls.Add(root);

            _d160HistoryStatus.Dock = DockStyle.Top;
            _d160HistoryStatus.Height = 42;
            _d160HistoryStatus.Text = "Lịch sử trong ca vận hành 05:00–04:59 · cập nhật trực tiếp từ pipeline Agent, không tạo listener/poll Firestore riêng.";
            _d160HistoryStatus.ForeColor = Color.FromArgb(71, 85, 105);
            root.Controls.Add(_d160HistoryStatus);

            _d160HistoryGrid.Dock = DockStyle.Fill;
            _d160HistoryGrid.ReadOnly = true;
            _d160HistoryGrid.AllowUserToAddRows = false;
            _d160HistoryGrid.AllowUserToDeleteRows = false;
            _d160HistoryGrid.AllowUserToResizeRows = false;
            _d160HistoryGrid.RowHeadersVisible = false;
            _d160HistoryGrid.MultiSelect = false;
            _d160HistoryGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _d160HistoryGrid.AutoGenerateColumns = false;
            _d160HistoryGrid.BackgroundColor = Color.White;
            _d160HistoryGrid.BorderStyle = BorderStyle.FixedSingle;
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Time", HeaderText = "Thời gian", Width = 86 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Employee", HeaderText = "MNV / User", Width = 120 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Name", HeaderText = "Họ tên", Width = 180 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Contractor", HeaderText = "Nhà thầu", Width = 140 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Input", HeaderText = "Cụm gửi", Width = 100 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Result", HeaderText = "Kết quả", Width = 190 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "WrongCount", HeaderText = "Nhập sai", Width = 76 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "LockCount", HeaderText = "Bị khóa", Width = 110 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "FullPickList", HeaderText = "PickList đầy đủ", Width = 170 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Ms", HeaderText = "Xử lý", Width = 82 });
            root.Controls.Add(_d160HistoryGrid);
            _d160HistoryGrid.BringToFront();

            var day = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            ResetD160HistoryForBusinessDay(day);
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

            var allowedUsage = authenticated && D160UsageAllowedForCurrentSession();
            if (allowedUsage)
            {
                if (!_mainTabs.TabPages.Contains(_d160UsagePage))
                    _mainTabs.TabPages.Add(_d160UsagePage);
                StartD160Usage();
            }
            else
            {
                StopD160Usage();
                if (_mainTabs.TabPages.Contains(_d160UsagePage))
                    _mainTabs.TabPages.Remove(_d160UsagePage);
            }
        }

        private bool D160UsageAllowedForCurrentSession()
        {
            AgentSession session;
            try { session = SnapshotSession(); } catch { return false; }
            var login = ((session == null ? "" : session.LoginName) ?? "").Trim();
            return string.Equals(login, "tamnv2", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(login, "admin", StringComparison.OrdinalIgnoreCase);
        }

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
                OperationMs = 0
            };
            lock (_d160HistoryGate) _d160History[work.RequestId] = row;
            AppendD160HistoryEvent(row);
            QueueD160HistoryForAgentSync();
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

                var prior = _d160History.Values
                    .Where(item => item != null &&
                                   !string.Equals(item.RequestId, row.RequestId, StringComparison.Ordinal) &&
                                   D160HistorySamePicker(item, row))
                    .ToList();
                var priorWrong = prior.Select(item => item.WrongCount).DefaultIfEmpty(0).Max();
                var priorLocks = prior.Select(item => item.LockCount).DefaultIfEmpty(0).Max();
                var rate = outcome.Rate;
                var countedWrong = string.Equals(outcome.Result, "NOT_FOUND", StringComparison.Ordinal) ||
                                   (rate != null && rate.NewlyLocked);
                row.WrongCount = Math.Max(row.WrongCount, priorWrong + (countedWrong ? 1 : 0));
                row.LockCount = Math.Max(row.LockCount, priorLocks + (rate != null && rate.NewlyLocked ? 1 : 0));
                row.LockedUntilMs = rate == null ? 0L : Math.Max(0L, rate.LockedUntilMs);
            }
            AppendD160HistoryEvent(row);
            QueueD160HistoryForAgentSync();
            Ui(() => RenderD160HistoryRow(row));
        }

        private static bool D160HistorySamePicker(D160PickerHistoryRow left, D160PickerHistoryRow right)
        {
            if (left == null || right == null) return false;
            if (!string.IsNullOrWhiteSpace(left.UserId) && !string.IsNullOrWhiteSpace(right.UserId))
                return string.Equals(left.UserId, right.UserId, StringComparison.Ordinal);
            return !string.IsNullOrWhiteSpace(left.EmployeeCode) &&
                   string.Equals(left.EmployeeCode, right.EmployeeCode, StringComparison.OrdinalIgnoreCase);
        }

        private void QueueD160HistoryForAgentSync()
        {
            try
            {
                if (_agentSyncClient == null) return;
                string day;
                List<AgentSyncHistoryRow> rows;
                lock (_d160HistoryGate)
                {
                    day = _d160HistoryDayKey;
                    rows = D160HistorySyncRowsNoLock();
                }
                _agentSyncClient.MergeLocalHistory(day, rows);
            }
            catch (Exception ex)
            {
                Log("D160 HISTORY sync_cache=DEFER type=" + ex.GetType().Name);
            }
        }

        internal List<AgentSyncHistoryRow> SnapshotD160HistoryForAgentSync(string dayKey)
        {
            lock (_d160HistoryGate)
            {
                if (!string.Equals(_d160HistoryDayKey, dayKey ?? "", StringComparison.Ordinal))
                    return new List<AgentSyncHistoryRow>();
                return D160HistorySyncRowsNoLock();
            }
        }

        private List<AgentSyncHistoryRow> D160HistorySyncRowsNoLock()
        {
            return _d160History.Values
                .Where(item => item != null && !string.IsNullOrWhiteSpace(item.RequestId))
                .OrderBy(item => item.SentAtMs)
                .Select(item => new AgentSyncHistoryRow
                {
                    RequestId = item.RequestId ?? "",
                    SentAtMs = Math.Max(0L, item.SentAtMs),
                    UserId = item.UserId ?? "",
                    EmployeeCode = item.EmployeeCode ?? "",
                    DisplayName = item.DisplayName ?? "",
                    ContractorName = item.ContractorName ?? "",
                    InputText = item.InputText ?? "",
                    Result = item.Result ?? "",
                    FullPickList = item.FullPickList ?? "",
                    OperationMs = Math.Max(0L, item.OperationMs),
                    WrongCount = Math.Max(0, item.WrongCount),
                    LockCount = Math.Max(0, item.LockCount),
                    LockedUntilMs = Math.Max(0L, item.LockedUntilMs)
                })
                .Take(FirestoreAgentSyncClient.MaxHistoryRows)
                .ToList();
        }

        internal void ApplyD160HistoryFromAgentSync(string dayKey, IEnumerable<AgentSyncHistoryRow> incoming)
        {
            var currentDay = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
            if (!string.Equals(dayKey ?? "", currentDay, StringComparison.Ordinal)) return;
            var changed = false;
            lock (_d160HistoryGate)
            {
                if (!string.Equals(_d160HistoryDayKey, currentDay, StringComparison.Ordinal)) return;
                foreach (var source in incoming ?? new AgentSyncHistoryRow[0])
                {
                    if (source == null || string.IsNullOrWhiteSpace(source.RequestId)) continue;
                    D160PickerHistoryRow target;
                    if (!_d160History.TryGetValue(source.RequestId, out target))
                    {
                        target = new D160PickerHistoryRow { RequestId = source.RequestId };
                        _d160History[source.RequestId] = target;
                        changed = true;
                    }
                    var before = target.Result + "|" + target.FullPickList + "|" + target.OperationMs + "|" +
                                 target.WrongCount + "|" + target.LockCount + "|" + target.LockedUntilMs;
                    if (source.SentAtMs > 0) target.SentAtMs = source.SentAtMs;
                    if (!string.IsNullOrWhiteSpace(source.UserId)) target.UserId = source.UserId;
                    if (!string.IsNullOrWhiteSpace(source.EmployeeCode)) target.EmployeeCode = source.EmployeeCode;
                    if (!string.IsNullOrWhiteSpace(source.DisplayName)) target.DisplayName = source.DisplayName;
                    if (!string.IsNullOrWhiteSpace(source.ContractorName)) target.ContractorName = source.ContractorName;
                    if (!string.IsNullOrWhiteSpace(source.InputText)) target.InputText = source.InputText;
                    if (!string.IsNullOrWhiteSpace(source.Result)) target.Result = source.Result;
                    if (!string.IsNullOrWhiteSpace(source.FullPickList)) target.FullPickList = source.FullPickList;
                    if (source.OperationMs > 0) target.OperationMs = source.OperationMs;
                    target.WrongCount = Math.Max(target.WrongCount, Math.Max(0, source.WrongCount));
                    target.LockCount = Math.Max(target.LockCount, Math.Max(0, source.LockCount));
                    target.LockedUntilMs = Math.Max(target.LockedUntilMs, Math.Max(0L, source.LockedUntilMs));
                    var after = target.Result + "|" + target.FullPickList + "|" + target.OperationMs + "|" +
                                target.WrongCount + "|" + target.LockCount + "|" + target.LockedUntilMs;
                    if (!string.Equals(before, after, StringComparison.Ordinal)) changed = true;
                }
            }
            if (!changed) return;
            Ui(() =>
            {
                _d160HistoryGrid.Rows.Clear();
                List<D160PickerHistoryRow> rows;
                lock (_d160HistoryGate)
                    rows = _d160History.Values.OrderByDescending(item => item.SentAtMs).ToList();
                foreach (var row in rows) RenderD160HistoryRow(row);
            });
        }

        internal void ResetD160HistoryForBusinessDay(string dayKey)
        {
            if (string.IsNullOrWhiteSpace(dayKey)) return;
            lock (_d160HistoryGate)
            {
                if (string.Equals(_d160HistoryDayKey, dayKey, StringComparison.Ordinal)) return;
                _d160HistoryDayKey = dayKey;
                _d160History.Clear();
                LoadD160HistoryNoLock(dayKey);
            }
            Ui(() =>
            {
                _d160HistoryGrid.Rows.Clear();
                List<D160PickerHistoryRow> rows;
                lock (_d160HistoryGate)
                    rows = _d160History.Values.OrderByDescending(item => item.SentAtMs).ToList();
                foreach (var row in rows) RenderD160HistoryRow(row);
                _d160HistoryStatus.Text =
                    "Ngày vận hành " + dayKey + " · " + rows.Count.ToString("N0") +
                    " request · reset lúc 05:00 · UI cục bộ, không thêm Firestore usage.";
            });
            CleanupD160OldHistoryFiles(dayKey);
        }

        private void RenderD160HistoryRow(D160PickerHistoryRow item)
        {
            if (item == null || _d160HistoryGrid.IsDisposed) return;
            DataGridViewRow target = null;
            foreach (DataGridViewRow row in _d160HistoryGrid.Rows)
                if (string.Equals(Convert.ToString(row.Tag), item.RequestId, StringComparison.Ordinal))
                {
                    target = row;
                    break;
                }

            var when = item.SentAtMs > 0
                ? DateTimeOffset.FromUnixTimeMilliseconds(item.SentAtMs).ToLocalTime().ToString("HH:mm:ss")
                : "--";
            var user = string.IsNullOrWhiteSpace(item.EmployeeCode) ? item.UserId : item.EmployeeCode;
            var values = new object[]
            {
                when,
                user,
                item.DisplayName,
                item.ContractorName,
                item.InputText,
                item.Result,
                item.WrongCount.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")),
                D160HistoryLockText(item),
                item.FullPickList,
                item.OperationMs > 0 ? item.OperationMs.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + " ms" : ""
            };
            if (target == null)
            {
                _d160HistoryGrid.Rows.Insert(0, values);
                _d160HistoryGrid.Rows[0].Tag = item.RequestId;
            }
            else
            {
                for (var i = 0; i < values.Length; i++) target.Cells[i].Value = values[i];
            }

            int count;
            lock (_d160HistoryGate) count = _d160History.Count;
            _d160HistoryStatus.Text =
                "Ngày vận hành " + _d160HistoryDayKey + " · " + count.ToString("N0") +
                " request · reset lúc 05:00 · UI cục bộ, không thêm Firestore usage.";
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
                    { "lock_count", row.LockCount },
                    { "locked_until_ms", row.LockedUntilMs }
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
                foreach (var line in File.ReadLines(path))
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    var map = _d160HistoryJson.DeserializeObject(line) as Dictionary<string, object>;
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
                        WrongCount = (int)Math.Max(0L, D160MapLong(map, "wrong_count")),
                        LockCount = (int)Math.Max(0L, D160MapLong(map, "lock_count")),
                        LockedUntilMs = Math.Max(0L, D160MapLong(map, "locked_until_ms"))
                    };
                }
            }
            catch { }
        }

        private static string D160HistoryPath(string dayKey)
        {
            var safe = new string((dayKey ?? "").Where(ch => char.IsDigit(ch) || ch == '-').ToArray());
            return Path.Combine(D160HistoryDir, "picker-history-" + safe + ".jsonl");
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

        private static string D160HistoryLockText(D160PickerHistoryRow item)
        {
            if (item == null) return "0";
            var count = Math.Max(0, item.LockCount);
            if (item.LockedUntilMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())
                return count.ToString(CultureInfo.InvariantCulture);
            var until = DateTimeOffset.FromUnixTimeMilliseconds(item.LockedUntilMs)
                .ToLocalTime().ToString("HH:mm");
            return count.ToString(CultureInfo.InvariantCulture) + " · đến " + until;
        }

        private static string D160HistoryResultText(string result)
        {
            switch (result ?? "")
            {
                case "CONFIRMED": return "Đã xác nhận";
                case "NOT_FOUND": return "Không tìm thấy PickList";
                case "AMBIGUOUS_PICKLIST": return "Trùng nhiều PickList";
                case "PICKER_LOCKED": return "Picker đang bị khóa";
                case "WMS_DATA_UNAVAILABLE": return "Dữ liệu Supra chưa sẵn sàng";
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
