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
            _connectionPage.Controls.Add(card);
        }

        private void InitializeD160HistoryUi()
        {
            _d160HistoryPage.BackColor = Color.FromArgb(243, 246, 248);
            var root = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12) };
            _d160HistoryPage.Controls.Add(root);

            _d160HistoryStatus.Dock = DockStyle.Top;
            _d160HistoryStatus.Height = 42;
            _d160HistoryStatus.Text = "Lịch sử ca 05:00–04:59 · tự đồng bộ giữa các Agent đang hoạt động.";
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
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Result", HeaderText = "Kết quả", Width = 210 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "FullPickList", HeaderText = "PickList đầy đủ", Width = 170 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Wrong", HeaderText = "Nhập sai", Width = 78 });
            _d160HistoryGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Lock", HeaderText = "Khóa", Width = 120 });
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
                    " request · reset lúc 05:00 · tự đồng bộ giữa các Agent.";
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
                item.FullPickList,
                item.WrongCount > 0 ? item.WrongCount.ToString(CultureInfo.InvariantCulture) : "",
                D160HistoryLockText(item),
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
                " request · reset lúc 05:00 · tự đồng bộ giữa các Agent.";
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
                        WrongCount = (int)D160MapLong(map, "wrong_count"),
                        LockLevel = (int)D160MapLong(map, "lock_level"),
                        LockMinutes = (int)D160MapLong(map, "lock_minutes"),
                        LockedUntilMs = D160MapLong(map, "locked_until_ms")
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
                            LockedUntilMs = D160MapLong(map, "z")
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
                   a.LockedUntilMs == b.LockedUntilMs;
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
                        { "z", row.LockedUntilMs }
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
