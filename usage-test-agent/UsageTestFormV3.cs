using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraFirestoreUsageTest
{
    internal sealed class UsageTestFormV3 : Form
    {
        private readonly UsageClient _client = new UsageClient();
        private readonly System.Windows.Forms.Timer _timer = new System.Windows.Forms.Timer();
        private readonly Label _status = new Label();
        private readonly Label _updated = new Label();
        private readonly Button _refresh = new Button();

        private readonly Label _reads = new Label();
        private readonly Label _writes = new Label();
        private readonly Label _deletes = new Label();
        private readonly Label _quotaReset = new Label();
        private readonly Label _storage = new Label();

        private readonly Label _connections = new Label();
        private readonly Label _listeners = new Label();
        private readonly Label _rulesAllow = new Label();
        private readonly Label _rulesDeny = new Label();
        private readonly Label _rulesError = new Label();

        private readonly Label _fcmRequests = new Label();
        private readonly Label _fcmErrors = new Label();
        private readonly Label _authIdentity = new Label();
        private readonly Label _authRefresh = new Label();
        private readonly Label _authErrors = new Label();

        private readonly Label _trafficReads = new Label();
        private readonly Label _trafficWrites = new Label();
        private readonly Label _trafficDeletes = new Label();
        private readonly Label _peakRead = new Label();
        private readonly Label _peakWrite = new Label();

        private readonly Label _functionRequests = new Label();
        private readonly Label _functionErrors = new Label();
        private readonly Label _functionInstances = new Label();
        private readonly Label _functionBillable = new Label();

        private readonly Label _autoRefresh = new Label();
        private readonly Label _sharedCache = new Label();
        private readonly Label _extraFirestore = new Label();
        private readonly Label _providerDelay = new Label();
        private readonly Label _agentVisibility = new Label();

        private readonly DataGridView _grid = new DataGridView();
        private int _refreshing;

        internal UsageTestFormV3()
        {
            Text = UsageTestConfig.ProductName + " — " + UsageTestConfig.Version;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1480, 900);
            MinimumSize = new Size(1180, 720);
            Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            BackColor = Color.FromArgb(245, 247, 250);

            var tabs = new TabControl { Dock = DockStyle.Fill };
            var tab = new TabPage("Thông tin Usage") { BackColor = BackColor };
            tabs.TabPages.Add(tab);
            Controls.Add(tabs);

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(14),
                RowCount = 3,
                ColumnCount = 1
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 90));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 370));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            tab.Controls.Add(root);

            root.Controls.Add(BuildHeader(), 0, 0);
            root.Controls.Add(BuildSummary(), 0, 1);
            root.Controls.Add(BuildGrid(), 0, 2);

            _autoRefresh.Text = "15 phút/lần";
            _sharedCache.Text = "Dùng chung tối đa 15 phút";
            _extraFirestore.Text = "0 Read / 0 Write / 0 Delete";
            _providerDelay.Text = "Monitoring có thể trễ vài–30 phút";
            _agentVisibility.Text = "Chỉ tamnv2 / admin khi tích hợp Agent";

            _timer.Interval = UsageTestConfig.RefreshMinutes * 60 * 1000;
            _timer.Tick += async (s, e) => await RefreshUsageAsync();
            Shown += async (s, e) =>
            {
                _timer.Start();
                await RefreshUsageAsync();
            };
        }

        private Control BuildHeader()
        {
            var panel = new Panel { Dock = DockStyle.Fill };
            var title = new Label
            {
                Text = "Firebase / Firestore Usage — Beta",
                Font = new Font("Segoe UI Semibold", 17F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(4, 2)
            };

            _status.AutoSize = true;
            _status.Location = new Point(6, 44);
            _status.Text = "Tự cập nhật mỗi 15 phút; chỉ đọc Cloud Monitoring, không quét document Firestore.";
            _status.ForeColor = Color.FromArgb(71, 85, 105);

            _updated.AutoSize = true;
            _updated.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _updated.TextAlign = ContentAlignment.TopRight;
            _updated.ForeColor = Color.FromArgb(100, 116, 139);
            _updated.Location = new Point(1010, 8);
            _updated.Size = new Size(270, 40);

            _refresh.Text = "Cập nhật ngay";
            _refresh.Size = new Size(140, 34);
            _refresh.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _refresh.Location = new Point(1290, 6);
            _refresh.Click += async (s, e) => await RefreshUsageAsync();

            panel.Controls.Add(title);
            panel.Controls.Add(_status);
            panel.Controls.Add(_updated);
            panel.Controls.Add(_refresh);
            panel.Resize += (s, e) =>
            {
                _refresh.Left = Math.Max(10, panel.ClientSize.Width - _refresh.Width - 8);
                _updated.Left = Math.Max(10, _refresh.Left - _updated.Width - 14);
            };
            return panel;
        }

        private Control BuildSummary()
        {
            var table = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 3,
                RowCount = 2,
                Padding = new Padding(0, 4, 0, 8)
            };
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 34F));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33F));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33F));
            table.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
            table.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));

            table.Controls.Add(MetricGroup(
                "Firestore — quota hôm nay",
                new[]
                {
                    Tuple.Create("Lượt đọc", _reads),
                    Tuple.Create("Lượt ghi", _writes),
                    Tuple.Create("Lượt xóa", _deletes),
                    Tuple.Create("Dung lượng dữ liệu + chỉ mục", _storage),
                    Tuple.Create("Reset quota", _quotaReset)
                }), 0, 0);

            table.Controls.Add(MetricGroup(
                "Firestore — realtime & bảo mật · 24 giờ",
                new[]
                {
                    Tuple.Create("Kết nối", _connections),
                    Tuple.Create("Listener", _listeners),
                    Tuple.Create("Rule cho phép", _rulesAllow),
                    Tuple.Create("Rule từ chối", _rulesDeny),
                    Tuple.Create("Rule lỗi", _rulesError)
                }), 1, 0);

            table.Controls.Add(MetricGroup(
                "Firebase — đăng nhập & FCM · 24 giờ",
                new[]
                {
                    Tuple.Create("Yêu cầu đăng nhập/tài khoản", _authIdentity),
                    Tuple.Create("Làm mới phiên", _authRefresh),
                    Tuple.Create("Lỗi xác thực", _authErrors),
                    Tuple.Create("Yêu cầu FCM gửi thông báo", _fcmRequests),
                    Tuple.Create("Lỗi FCM", _fcmErrors)
                }), 2, 0);

            table.Controls.Add(MetricGroup(
                "Firestore — tổng 24 giờ",
                new[]
                {
                    Tuple.Create("Tổng đọc", _trafficReads),
                    Tuple.Create("Tổng ghi", _trafficWrites),
                    Tuple.Create("Tổng xóa", _trafficDeletes),
                    Tuple.Create("Giờ đọc cao nhất", _peakRead),
                    Tuple.Create("Giờ ghi cao nhất", _peakWrite)
                }), 0, 1);

            table.Controls.Add(MetricGroup(
                "Cloud Functions — thông báo Picker · 24 giờ",
                new[]
                {
                    Tuple.Create("Lượt xử lý", _functionRequests),
                    Tuple.Create("Lỗi 4xx / 5xx", _functionErrors),
                    Tuple.Create("Instance hiện tại / đỉnh", _functionInstances),
                    Tuple.Create("Thời gian instance tính phí", _functionBillable)
                }), 1, 1);

            table.Controls.Add(MetricGroup(
                "Cơ chế giám sát",
                new[]
                {
                    Tuple.Create("Tự cập nhật", _autoRefresh),
                    Tuple.Create("Cache dùng chung", _sharedCache),
                    Tuple.Create("Firestore phát sinh thêm", _extraFirestore),
                    Tuple.Create("Độ trễ dữ liệu", _providerDelay),
                    Tuple.Create("Tab Agent sau tích hợp", _agentVisibility)
                }), 2, 1);

            return table;
        }

        private GroupBox MetricGroup(string title, Tuple<string, Label>[] rows)
        {
            var box = new GroupBox
            {
                Text = title,
                Dock = DockStyle.Fill,
                Padding = new Padding(10)
            };
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                RowCount = rows.Length,
                ColumnCount = 2
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 48F));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 52F));

            for (var i = 0; i < rows.Length; i++)
            {
                layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F / rows.Length));
                var name = new Label
                {
                    Text = rows[i].Item1,
                    AutoSize = true,
                    Anchor = AnchorStyles.Left,
                    ForeColor = Color.FromArgb(71, 85, 105)
                };
                rows[i].Item2.Text = "—";
                rows[i].Item2.AutoSize = true;
                rows[i].Item2.Anchor = AnchorStyles.Left;
                rows[i].Item2.Font = new Font("Segoe UI Semibold", 9.5F, FontStyle.Bold);
                layout.Controls.Add(name, 0, i);
                layout.Controls.Add(rows[i].Item2, 1, i);
            }
            box.Controls.Add(layout);
            return box;
        }

        private Control BuildGrid()
        {
            var host = new GroupBox
            {
                Text = "Chi tiết Firestore — 24 giờ gần nhất",
                Dock = DockStyle.Fill,
                Padding = new Padding(8)
            };

            _grid.Dock = DockStyle.Fill;
            _grid.ReadOnly = true;
            _grid.AllowUserToAddRows = false;
            _grid.AllowUserToDeleteRows = false;
            _grid.AllowUserToResizeRows = false;
            _grid.MultiSelect = false;
            _grid.RowHeadersVisible = false;
            _grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            _grid.BackgroundColor = Color.White;
            _grid.BorderStyle = BorderStyle.FixedSingle;
            _grid.Columns.Add("hour", "Giờ");
            _grid.Columns.Add("reads", "Đọc");
            _grid.Columns.Add("writes", "Ghi");
            _grid.Columns.Add("deletes", "Xóa");
            _grid.Columns.Add("listeners", "Listener đỉnh");
            _grid.Columns.Add("connections", "Kết nối đỉnh");
            _grid.Columns.Add("allow", "Rule cho phép");
            _grid.Columns.Add("deny", "Rule từ chối");
            _grid.Columns.Add("error", "Rule lỗi");
            host.Controls.Add(_grid);
            return host;
        }

        private async Task RefreshUsageAsync()
        {
            if (Interlocked.Exchange(ref _refreshing, 1) != 0) return;
            _refresh.Enabled = false;
            SetStatus("Đang lấy dữ liệu Cloud Monitoring…", Color.FromArgb(71, 85, 105));
            try
            {
                var snapshot = await Task.Run(() => _client.Fetch());
                ApplySnapshot(snapshot);
                var partial = JsonHelpers.BoolValue(snapshot, "partial");
                if (partial)
                    SetStatus(BuildProviderFailureStatus(snapshot), Color.FromArgb(180, 83, 9));
                else
                    SetStatus("Đã cập nhật. Tab Usage không tạo Firestore Read/Write/Delete; dữ liệu được cache chung tối đa 15 phút.", Color.FromArgb(21, 128, 61));
            }
            catch (Exception ex)
            {
                SetStatus(FriendlyError(ex.Message), Color.FromArgb(185, 28, 28));
            }
            finally
            {
                _refresh.Enabled = true;
                Interlocked.Exchange(ref _refreshing, 0);
            }
        }

        private void ApplySnapshot(Dictionary<string, object> snapshot)
        {
            var availability = JsonHelpers.Child(snapshot, "availability");

            var readsAvailable = JsonHelpers.BoolValue(availability, "reads");
            var writesAvailable = JsonHelpers.BoolValue(availability, "writes");
            var deletesAvailable = JsonHelpers.BoolValue(availability, "deletes");
            var storageAvailable = JsonHelpers.BoolValue(availability, "storage");
            var connectionsAvailable = JsonHelpers.BoolValue(availability, "connections");
            var listenersAvailable = JsonHelpers.BoolValue(availability, "listeners");
            var rulesAvailable = JsonHelpers.BoolValue(availability, "rules");
            var fcmAvailable = JsonHelpers.BoolValue(availability, "fcm");
            var identityAvailable = JsonHelpers.BoolValue(availability, "auth_identity");
            var refreshAvailable = JsonHelpers.BoolValue(availability, "auth_refresh");
            var functionsRequestsAvailable = JsonHelpers.BoolValue(availability, "functions_requests");
            var functionsInstancesAvailable = JsonHelpers.BoolValue(availability, "functions_instances");
            var functionsBillableAvailable = JsonHelpers.BoolValue(availability, "functions_billable");

            var quota = JsonHelpers.Child(snapshot, "quota_day");
            var limits = JsonHelpers.Child(quota, "reference_limits");
            _reads.Text = readsAvailable ? QuotaTextV3(JsonHelpers.LongValue(quota, "reads"), JsonHelpers.LongValue(limits, "reads")) : "N/A";
            _writes.Text = writesAvailable ? QuotaTextV3(JsonHelpers.LongValue(quota, "writes"), JsonHelpers.LongValue(limits, "writes")) : "N/A";
            _deletes.Text = deletesAvailable ? QuotaTextV3(JsonHelpers.LongValue(quota, "deletes"), JsonHelpers.LongValue(limits, "deletes")) : "N/A";
            _quotaReset.Text = ResetText(JsonHelpers.StringValue(quota, "reset_at"));

            var storage = JsonHelpers.Child(snapshot, "firestore_storage");
            _storage.Text = storageAvailable
                ? ByteQuotaText(JsonHelpers.LongValue(storage, "data_and_index_bytes"), JsonHelpers.LongValue(storage, "free_reference_bytes"))
                : "N/A";

            var realtime = JsonHelpers.Child(snapshot, "realtime_24h");
            _connections.Text = connectionsAvailable
                ? Number(JsonHelpers.LongValue(realtime, "active_connections_current")) + " hiện tại · " +
                  Number(JsonHelpers.LongValue(realtime, "active_connections_peak")) + " đỉnh"
                : "N/A";
            _listeners.Text = listenersAvailable
                ? Number(JsonHelpers.LongValue(realtime, "snapshot_listeners_current")) + " hiện tại · " +
                  Number(JsonHelpers.LongValue(realtime, "snapshot_listeners_peak")) + " đỉnh"
                : "N/A";

            var rules = JsonHelpers.Child(snapshot, "rules_24h");
            var allow = JsonHelpers.LongValue(rules, "allow");
            var deny = JsonHelpers.LongValue(rules, "deny");
            var ruleError = JsonHelpers.LongValue(rules, "error");
            var ruleTotal = allow + deny + ruleError;
            _rulesAllow.Text = rulesAvailable ? Number(allow) : "N/A";
            _rulesDeny.Text = rulesAvailable ? Number(deny) + " · " + PercentOf(deny, ruleTotal) : "N/A";
            _rulesError.Text = rulesAvailable ? Number(ruleError) + " · " + PercentOf(ruleError, ruleTotal) : "N/A";

            var firebase = JsonHelpers.Child(snapshot, "firebase_24h");
            var fcm = JsonHelpers.Child(firebase, "fcm");
            var identity = JsonHelpers.Child(firebase, "identity_toolkit");
            var secureToken = JsonHelpers.Child(firebase, "secure_token");

            _fcmRequests.Text = fcmAvailable ? Number(JsonHelpers.LongValue(fcm, "requests")) : "N/A";
            _fcmErrors.Text = fcmAvailable ? ErrorPair(fcm) : "N/A";
            _authIdentity.Text = identityAvailable ? Number(JsonHelpers.LongValue(identity, "requests")) : "N/A";
            _authRefresh.Text = refreshAvailable ? Number(JsonHelpers.LongValue(secureToken, "requests")) : "N/A";
            _authErrors.Text = identityAvailable && refreshAvailable
                ? Number(
                    JsonHelpers.LongValue(identity, "client_errors") +
                    JsonHelpers.LongValue(identity, "server_errors") +
                    JsonHelpers.LongValue(secureToken, "client_errors") +
                    JsonHelpers.LongValue(secureToken, "server_errors"))
                : "N/A";

            var traffic = JsonHelpers.Child(snapshot, "firestore_24h");
            _trafficReads.Text = readsAvailable ? Number(JsonHelpers.LongValue(traffic, "reads")) : "N/A";
            _trafficWrites.Text = writesAvailable ? Number(JsonHelpers.LongValue(traffic, "writes")) : "N/A";
            _trafficDeletes.Text = deletesAvailable ? Number(JsonHelpers.LongValue(traffic, "deletes")) : "N/A";
            _peakRead.Text = readsAvailable
                ? PeakText(JsonHelpers.StringValue(traffic, "peak_read_hour"), JsonHelpers.LongValue(traffic, "peak_read_value"))
                : "N/A";
            _peakWrite.Text = writesAvailable
                ? PeakText(JsonHelpers.StringValue(traffic, "peak_write_hour"), JsonHelpers.LongValue(traffic, "peak_write_value"))
                : "N/A";

            var functions = JsonHelpers.Child(snapshot, "functions_24h");
            var functionRequests = JsonHelpers.Child(functions, "requests");
            _functionRequests.Text = functionsRequestsAvailable ? Number(JsonHelpers.LongValue(functionRequests, "requests")) : "N/A";
            _functionErrors.Text = functionsRequestsAvailable ? ErrorPair(functionRequests) : "N/A";
            _functionInstances.Text = functionsInstancesAvailable
                ? Number(JsonHelpers.LongValue(functions, "instances_current")) + " hiện tại · " +
                  Number(JsonHelpers.LongValue(functions, "instances_peak")) + " đỉnh"
                : "N/A";
            _functionBillable.Text = functionsBillableAvailable
                ? DurationText(JsonHelpers.LongValue(functions, "billable_instance_seconds"))
                : "N/A";

            _grid.Rows.Clear();
            foreach (var item in JsonHelpers.List(JsonHelpers.Value(snapshot, "hourly")))
            {
                var row = JsonHelpers.Map(item);
                _grid.Rows.Add(
                    JsonHelpers.StringValue(row, "hour_label_vn"),
                    readsAvailable ? Number(JsonHelpers.LongValue(row, "reads")) : "N/A",
                    writesAvailable ? Number(JsonHelpers.LongValue(row, "writes")) : "N/A",
                    deletesAvailable ? Number(JsonHelpers.LongValue(row, "deletes")) : "N/A",
                    listenersAvailable ? Number(JsonHelpers.LongValue(row, "listeners_peak")) : "N/A",
                    connectionsAvailable ? Number(JsonHelpers.LongValue(row, "connections_peak")) : "N/A",
                    rulesAvailable ? Number(JsonHelpers.LongValue(row, "rules_allow")) : "N/A",
                    rulesAvailable ? Number(JsonHelpers.LongValue(row, "rules_deny")) : "N/A",
                    rulesAvailable ? Number(JsonHelpers.LongValue(row, "rules_error")) : "N/A"
                );
            }
            if (_grid.Rows.Count > 0)
                _grid.FirstDisplayedScrollingRowIndex = Math.Max(0, _grid.Rows.Count - 1);

            DateTimeOffset generated;
            var generatedText = JsonHelpers.StringValue(snapshot, "generated_at");
            var when = DateTimeOffset.TryParse(generatedText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out generated)
                ? generated.ToLocalTime().ToString("dd/MM/yyyy HH:mm:ss")
                : "—";
            var source = JsonHelpers.BoolValue(snapshot, "cache_hit") ? "cache dùng chung ≤15 phút" : "Cloud Monitoring mới";
            var login = JsonHelpers.StringValue(snapshot, "local_login_name");
            _updated.Text =
                "Cập nhật: " + when + Environment.NewLine +
                source + (string.IsNullOrWhiteSpace(login) ? "" : " · phiên " + login);
        }

        private void SetStatus(string text, Color color)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string, Color>(SetStatus), text, color);
                return;
            }
            _status.Text = text;
            _status.ForeColor = color;
        }

        private static string Number(long value)
        {
            return value.ToString("N0", CultureInfo.GetCultureInfo("vi-VN"));
        }

        private static string QuotaTextV3(long value, long limit)
        {
            var pct = limit <= 0 ? 0D : 100D * value / limit;
            var remaining = Math.Max(0L, limit - value);
            return Number(value) + " / " + Number(limit) + " · " +
                pct.ToString("0.#", CultureInfo.InvariantCulture) + "% · còn " + Number(remaining);
        }

        private static string ByteQuotaText(long value, long referenceLimit)
        {
            var usedMiB = value / 1024D / 1024D;
            var limitMiB = referenceLimit / 1024D / 1024D;
            var pct = referenceLimit <= 0 ? 0D : 100D * value / referenceLimit;
            return usedMiB.ToString("N1", CultureInfo.GetCultureInfo("vi-VN")) + " MiB / " +
                limitMiB.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + " MiB · " +
                pct.ToString("0.#", CultureInfo.InvariantCulture) + "%";
        }

        private static string ResetText(string iso)
        {
            DateTimeOffset reset;
            if (!DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out reset))
                return "N/A";
            var remaining = reset.ToUniversalTime() - DateTimeOffset.UtcNow;
            if (remaining < TimeSpan.Zero) remaining = TimeSpan.Zero;
            var hours = (int)Math.Floor(remaining.TotalHours);
            return reset.ToLocalTime().ToString("dd/MM HH:mm") + " · còn " +
                hours.ToString(CultureInfo.InvariantCulture) + "g " +
                remaining.Minutes.ToString(CultureInfo.InvariantCulture) + "p";
        }

        private static string PercentOf(long value, long total)
        {
            var pct = total <= 0 ? 0D : 100D * value / total;
            return pct.ToString("0.###", CultureInfo.InvariantCulture) + "%";
        }

        private static string ErrorPair(Dictionary<string, object> map)
        {
            return Number(JsonHelpers.LongValue(map, "client_errors")) + " lỗi 4xx · " +
                Number(JsonHelpers.LongValue(map, "server_errors")) + " lỗi 5xx";
        }

        private static string PeakText(string hour, long value)
        {
            return (string.IsNullOrWhiteSpace(hour) ? "—" : hour) + " · " + Number(value);
        }

        private static string DurationText(long seconds)
        {
            if (seconds < 60) return Number(seconds) + " giây";
            if (seconds < 3600) return (seconds / 60D).ToString("0.#", CultureInfo.GetCultureInfo("vi-VN")) + " phút";
            return (seconds / 3600D).ToString("0.##", CultureInfo.GetCultureInfo("vi-VN")) + " giờ";
        }

        private static string BuildProviderFailureStatus(Dictionary<string, object> snapshot)
        {
            var unique = new List<string>();
            foreach (var item in JsonHelpers.List(JsonHelpers.Value(snapshot, "errors")))
            {
                var value = Convert.ToString(item, CultureInfo.InvariantCulture);
                if (string.IsNullOrWhiteSpace(value)) continue;
                var separator = value.IndexOf(':');
                var code = separator >= 0 && separator + 1 < value.Length
                    ? value.Substring(separator + 1)
                    : value;
                if (!unique.Contains(code)) unique.Add(code);
            }

            if (unique.Count == 0)
                return "Cloud Monitoring chưa trả đủ dữ liệu. Một số mục đang N/A.";

            return "Cloud Monitoring thiếu một phần dữ liệu: " +
                string.Join(" | ", unique.ToArray()) +
                ". N/A không được coi là 0.";
        }

        private static string FriendlyError(string code)
        {
            var value = code ?? "";
            if (value.Contains("SESSION_NOT_FOUND"))
                return "Chưa có phiên Agent đã lưu. Đăng nhập Agent một lần trên máy này rồi mở lại D159.";
            if (value.Contains("SESSION_DPAPI_UNAVAILABLE"))
                return "Không đọc được phiên Agent của Windows user hiện tại. D159 không sửa hoặc xóa phiên đang có.";
            if (value.Contains("D159_GATEWAY_NOT_CONFIGURED"))
                return "Bản test chưa được gắn URL D159 Usage Gateway.";
            if (value.Contains("D159_FIREBASE_KEY_NOT_CONFIGURED"))
                return "Bản test chưa được build với cấu hình Firebase Beta.";
            if (value.Contains("FIREBASE_REFRESH_"))
                return "Phiên Agent đã lưu không làm mới được. Hãy đăng nhập lại Agent rồi thử lại.";
            if (value.Contains("AUTH_ROLE"))
                return "Phiên hiện tại không có quyền quản trị để xem Usage.";
            if (value.Contains("MONITORING_"))
                return "Cloud Monitoring trả lỗi: " + value;
            return "Không lấy được Usage: " + value;
        }
    }
}
