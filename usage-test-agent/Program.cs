using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraFirestoreUsageTest
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            if (args != null)
            {
                foreach (var arg in args)
                {
                    if (string.Equals(arg, "--self-test", StringComparison.OrdinalIgnoreCase))
                    {
                        Environment.Exit(SelfTest.Run() ? 0 : 1);
                        return;
                    }
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UsageTestForm());
        }
    }

    internal sealed class StoredAgentSession
    {
        internal string RefreshToken;
        internal string LoginName;
        internal string Role;
        internal string BaseRole;
    }

    internal sealed class UsageClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private static readonly string SessionFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Agent Auto Confirm Pick Pack", "RelayPoc", "session.bin");

        internal Dictionary<string, object> Fetch()
        {
            ValidateConfiguration();
            var session = LoadStoredSession();
            var idToken = RefreshIdToken(session.RefreshToken);
            var snapshot = PostGateway(idToken);
            snapshot["local_login_name"] = session.LoginName ?? "";
            snapshot["local_role"] = session.Role ?? "";
            return snapshot;
        }

        private static void ValidateConfiguration()
        {
            Uri gateway;
            if (string.IsNullOrWhiteSpace(UsageTestConfig.UsageGatewayUrl) ||
                UsageTestConfig.UsageGatewayUrl.Contains("__D159_USAGE_GATEWAY_URL_BETA__") ||
                !Uri.TryCreate(UsageTestConfig.UsageGatewayUrl, UriKind.Absolute, out gateway) ||
                !string.Equals(gateway.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("D159_GATEWAY_NOT_CONFIGURED");

            if (string.IsNullOrWhiteSpace(UsageTestConfig.FirebaseApiKey) ||
                UsageTestConfig.FirebaseApiKey.Contains("__FIREBASE_API_KEY_BETA__"))
                throw new InvalidOperationException("D159_FIREBASE_KEY_NOT_CONFIGURED");
        }

        private StoredAgentSession LoadStoredSession()
        {
            if (!File.Exists(SessionFile)) throw new InvalidOperationException("SESSION_NOT_FOUND");
            try
            {
                var raw = ProtectedData.Unprotect(
                    File.ReadAllBytes(SessionFile),
                    null,
                    DataProtectionScope.CurrentUser);
                var map = JsonHelpers.Map(_json.DeserializeObject(Encoding.UTF8.GetString(raw)));
                var refresh = JsonHelpers.StringValue(map, "refresh_token");
                if (string.IsNullOrWhiteSpace(refresh)) throw new InvalidOperationException("SESSION_REFRESH_TOKEN_MISSING");

                return new StoredAgentSession
                {
                    RefreshToken = refresh,
                    LoginName = JsonHelpers.StringValue(map, "login_name"),
                    Role = JsonHelpers.StringValue(map, "role"),
                    BaseRole = JsonHelpers.StringValue(map, "base_role")
                };
            }
            catch (CryptographicException)
            {
                throw new InvalidOperationException("SESSION_DPAPI_UNAVAILABLE");
            }
        }

        private string RefreshIdToken(string refreshToken)
        {
            var url = "https://securetoken.googleapis.com/v1/token?key=" +
                Uri.EscapeDataString(UsageTestConfig.FirebaseApiKey);
            var form =
                "grant_type=refresh_token&refresh_token=" +
                Uri.EscapeDataString(refreshToken ?? "");
            var bytes = Encoding.UTF8.GetBytes(form);

            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "POST";
            request.ContentType = "application/x-www-form-urlencoded";
            request.UserAgent = "SUPRA-Firestore-Usage-Test/D159";
            request.Timeout = 15000;
            request.ReadWriteTimeout = 15000;
            request.AllowAutoRedirect = true;
            request.ContentLength = bytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bytes, 0, bytes.Length);

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                {
                    var root = JsonHelpers.Map(_json.DeserializeObject(reader.ReadToEnd()));
                    var idToken = JsonHelpers.StringValue(root, "id_token");
                    if (string.IsNullOrWhiteSpace(idToken)) throw new InvalidOperationException("FIREBASE_REFRESH_NO_ID_TOKEN");
                    return idToken;
                }
            }
            catch (WebException ex)
            {
                var status = ex.Response is HttpWebResponse
                    ? ((int)((HttpWebResponse)ex.Response).StatusCode).ToString(CultureInfo.InvariantCulture)
                    : "NETWORK";
                throw new InvalidOperationException("FIREBASE_REFRESH_" + status);
            }
        }

        private Dictionary<string, object> PostGateway(string idToken)
        {
            var body = new Dictionary<string, object>
            {
                { "action", "get_firestore_usage" },
                { "id_token", idToken ?? "" }
            };
            var bytes = Encoding.UTF8.GetBytes(_json.Serialize(body));
            var request = (HttpWebRequest)WebRequest.Create(UsageTestConfig.UsageGatewayUrl);
            request.Method = "POST";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "SUPRA-Firestore-Usage-Test/D159";
            request.Timeout = 30000;
            request.ReadWriteTimeout = 30000;
            request.AllowAutoRedirect = true;
            request.ContentLength = bytes.Length;

            using (var stream = request.GetRequestStream())
                stream.Write(bytes, 0, bytes.Length);

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                {
                    var text = reader.ReadToEnd();
                    var root = JsonHelpers.Map(_json.DeserializeObject(text));
                    if (!JsonHelpers.BoolValue(root, "ok"))
                    {
                        var code = JsonHelpers.StringValue(root, "error");
                        throw new InvalidOperationException(string.IsNullOrWhiteSpace(code) ? "D159_GATEWAY_REJECTED" : code);
                    }
                    return root;
                }
            }
            catch (WebException ex)
            {
                var status = ex.Response is HttpWebResponse
                    ? ((int)((HttpWebResponse)ex.Response).StatusCode).ToString(CultureInfo.InvariantCulture)
                    : "NETWORK";
                throw new InvalidOperationException("D159_GATEWAY_" + status);
            }
        }
    }

    internal static class JsonHelpers
    {
        internal static Dictionary<string, object> Map(object value)
        {
            var map = value as Dictionary<string, object>;
            return map ?? new Dictionary<string, object>(StringComparer.Ordinal);
        }

        internal static IEnumerable<object> List(object value)
        {
            var objectArray = value as object[];
            if (objectArray != null) return objectArray;
            var arrayList = value as ArrayList;
            if (arrayList != null)
            {
                var result = new List<object>();
                foreach (var item in arrayList) result.Add(item);
                return result;
            }
            var enumerable = value as IEnumerable;
            if (enumerable != null && !(value is string))
            {
                var result = new List<object>();
                foreach (var item in enumerable) result.Add(item);
                return result;
            }
            return new object[0];
        }

        internal static string StringValue(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) && value != null
                ? Convert.ToString(value, CultureInfo.InvariantCulture)
                : "";
        }

        internal static long LongValue(Dictionary<string, object> map, string key)
        {
            object value;
            if (map == null || !map.TryGetValue(key, out value) || value == null) return 0;
            long parsed;
            return long.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out parsed)
                ? parsed
                : 0;
        }

        internal static bool BoolValue(Dictionary<string, object> map, string key)
        {
            object value;
            if (map == null || !map.TryGetValue(key, out value) || value == null) return false;
            if (value is bool) return (bool)value;
            bool parsed;
            return bool.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), out parsed) && parsed;
        }

        internal static Dictionary<string, object> Child(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Map(value) : Map(null);
        }

        internal static object Value(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? value : null;
        }
    }

    internal sealed class UsageTestForm : Form
    {
        private readonly UsageClient _client = new UsageClient();
        private readonly System.Windows.Forms.Timer _timer = new System.Windows.Forms.Timer();
        private readonly Label _status = new Label();
        private readonly Label _updated = new Label();
        private readonly Button _refresh = new Button();
        private readonly Label _reads = new Label();
        private readonly Label _writes = new Label();
        private readonly Label _deletes = new Label();
        private readonly Label _connections = new Label();
        private readonly Label _listeners = new Label();
        private readonly Label _rulesAllow = new Label();
        private readonly Label _rulesDeny = new Label();
        private readonly Label _rulesError = new Label();
        private readonly DataGridView _grid = new DataGridView();
        private int _refreshing;

        internal UsageTestForm()
        {
            Text = UsageTestConfig.ProductName + " — " + UsageTestConfig.Version;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1180, 760);
            MinimumSize = new Size(980, 640);
            Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            BackColor = Color.FromArgb(245, 247, 250);

            var tabs = new TabControl { Dock = DockStyle.Fill };
            var tab = new TabPage("Thông tin") { BackColor = BackColor };
            tabs.TabPages.Add(tab);
            Controls.Add(tabs);

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(14),
                RowCount = 3,
                ColumnCount = 1
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 86));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 190));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            tab.Controls.Add(root);

            root.Controls.Add(BuildHeader(), 0, 0);
            root.Controls.Add(BuildSummary(), 0, 1);
            root.Controls.Add(BuildGrid(), 0, 2);

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
                Text = "Firestore Usage — Beta",
                Font = new Font("Segoe UI Semibold", 17F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(4, 2)
            };
            _status.AutoSize = true;
            _status.Location = new Point(6, 42);
            _status.Text = "Mở ứng dụng để kiểm tra trực tiếp; tự cập nhật mỗi 15 phút.";
            _status.ForeColor = Color.FromArgb(71, 85, 105);

            _updated.AutoSize = true;
            _updated.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _updated.TextAlign = ContentAlignment.TopRight;
            _updated.ForeColor = Color.FromArgb(100, 116, 139);
            _updated.Location = new Point(755, 8);
            _updated.Size = new Size(220, 36);

            _refresh.Text = "Cập nhật ngay";
            _refresh.Size = new Size(130, 34);
            _refresh.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _refresh.Location = new Point(990, 6);
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
                RowCount = 1,
                Padding = new Padding(0, 4, 0, 8)
            };
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 38F));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 31F));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 31F));
            table.Controls.Add(MetricGroup(
                "Quota provider day (mốc tham chiếu)",
                new[]
                {
                    Tuple.Create("Reads", _reads),
                    Tuple.Create("Writes", _writes),
                    Tuple.Create("Deletes", _deletes)
                }), 0, 0);
            table.Controls.Add(MetricGroup(
                "Realtime · 24 giờ",
                new[]
                {
                    Tuple.Create("Active connections", _connections),
                    Tuple.Create("Snapshot listeners", _listeners)
                }), 1, 0);
            table.Controls.Add(MetricGroup(
                "Security Rules · 24 giờ",
                new[]
                {
                    Tuple.Create("ALLOW", _rulesAllow),
                    Tuple.Create("DENY", _rulesDeny),
                    Tuple.Create("ERROR", _rulesError)
                }), 2, 0);
            return table;
        }

        private GroupBox MetricGroup(string title, Tuple<string, Label>[] rows)
        {
            var box = new GroupBox
            {
                Text = title,
                Dock = DockStyle.Fill,
                Padding = new Padding(12)
            };
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                RowCount = rows.Length,
                ColumnCount = 2
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 45F));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 55F));
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
                rows[i].Item2.Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold);
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
                Text = "Chi tiết 24 giờ gần nhất",
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
            _grid.Columns.Add("reads", "Read");
            _grid.Columns.Add("writes", "Write");
            _grid.Columns.Add("deletes", "Delete");
            _grid.Columns.Add("listeners", "Listener peak");
            _grid.Columns.Add("connections", "Connection peak");
            _grid.Columns.Add("allow", "ALLOW");
            _grid.Columns.Add("deny", "DENY");
            _grid.Columns.Add("error", "ERROR");
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
                    SetStatus("Đã cập nhật nhưng có metric tạm thời N/A. Xem trạng thái nguồn ở lần cập nhật tiếp theo.", Color.FromArgb(180, 83, 9));
                else
                    SetStatus("Đã cập nhật. D159 chỉ đọc Cloud Monitoring; không tạo Firestore Read/Write/Delete.", Color.FromArgb(21, 128, 61));
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
            var connectionsAvailable = JsonHelpers.BoolValue(availability, "connections");
            var listenersAvailable = JsonHelpers.BoolValue(availability, "listeners");
            var rulesAvailable = JsonHelpers.BoolValue(availability, "rules");

            var quota = JsonHelpers.Child(snapshot, "quota_day");
            var limits = JsonHelpers.Child(quota, "reference_limits");
            _reads.Text = readsAvailable ? QuotaText(JsonHelpers.LongValue(quota, "reads"), JsonHelpers.LongValue(limits, "reads")) : "N/A";
            _writes.Text = writesAvailable ? QuotaText(JsonHelpers.LongValue(quota, "writes"), JsonHelpers.LongValue(limits, "writes")) : "N/A";
            _deletes.Text = deletesAvailable ? QuotaText(JsonHelpers.LongValue(quota, "deletes"), JsonHelpers.LongValue(limits, "deletes")) : "N/A";

            var realtime = JsonHelpers.Child(snapshot, "realtime_24h");
            _connections.Text = connectionsAvailable
                ? Number(JsonHelpers.LongValue(realtime, "active_connections_current")) + " hiện tại · " +
                  Number(JsonHelpers.LongValue(realtime, "active_connections_peak")) + " peak"
                : "N/A";
            _listeners.Text = listenersAvailable
                ? Number(JsonHelpers.LongValue(realtime, "snapshot_listeners_current")) + " hiện tại · " +
                  Number(JsonHelpers.LongValue(realtime, "snapshot_listeners_peak")) + " peak"
                : "N/A";

            var rules = JsonHelpers.Child(snapshot, "rules_24h");
            _rulesAllow.Text = rulesAvailable ? Number(JsonHelpers.LongValue(rules, "allow")) : "N/A";
            _rulesDeny.Text = rulesAvailable ? Number(JsonHelpers.LongValue(rules, "deny")) : "N/A";
            _rulesError.Text = rulesAvailable ? Number(JsonHelpers.LongValue(rules, "error")) : "N/A";

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
            if (_grid.Rows.Count > 0) _grid.FirstDisplayedScrollingRowIndex = Math.Max(0, _grid.Rows.Count - 1);

            DateTimeOffset generated;
            var generatedText = JsonHelpers.StringValue(snapshot, "generated_at");
            var when = DateTimeOffset.TryParse(generatedText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out generated)
                ? generated.ToLocalTime().ToString("dd/MM/yyyy HH:mm:ss")
                : "—";
            var source = JsonHelpers.BoolValue(snapshot, "cache_hit") ? "cache ≤15 phút" : "Cloud Monitoring mới";
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

        private static string QuotaText(long value, long limit)
        {
            var pct = limit <= 0 ? 0D : (100D * value / limit);
            return Number(value) + " / " + Number(limit) + " · " +
                pct.ToString("0.#", CultureInfo.InvariantCulture) + "%";
        }

        private static string FriendlyError(string code)
        {
            var value = code ?? "";
            if (value.Contains("SESSION_NOT_FOUND"))
                return "Chưa có phiên Agent đã lưu. Đăng nhập Agent chính một lần trên máy này rồi mở lại D159.";
            if (value.Contains("SESSION_DPAPI_UNAVAILABLE"))
                return "Không đọc được phiên Agent của Windows user hiện tại. D159 không sửa hoặc xoá phiên đang có.";
            if (value.Contains("D159_GATEWAY_NOT_CONFIGURED"))
                return "Bản test chưa được gắn URL D159 Usage Gateway.";
            if (value.Contains("D159_FIREBASE_KEY_NOT_CONFIGURED"))
                return "Bản test chưa được build với cấu hình Firebase Beta.";
            if (value.Contains("FIREBASE_REFRESH_"))
                return "Phiên Agent đã lưu không refresh được. Hãy đăng nhập lại Agent chính rồi thử lại.";
            if (value.Contains("AUTH_ROLE"))
                return "Phiên hiện tại không có quyền ADMIN/PICKPACK_ADMIN cho D159.";
            if (value.Contains("MONITORING_"))
                return "Cloud Monitoring trả lỗi: " + value;
            return "Không lấy được Usage: " + value;
        }
    }

    internal static class SelfTest
    {
        internal static bool Run()
        {
            try
            {
                var json = new JavaScriptSerializer();
                var sample =
                    "{\"ok\":true,\"availability\":{\"reads\":true,\"writes\":true,\"deletes\":true,\"connections\":true,\"listeners\":true,\"rules\":true},\"quota_day\":{\"reads\":17000,\"writes\":8500,\"deletes\":95," +
                    "\"reference_limits\":{\"reads\":50000,\"writes\":20000,\"deletes\":20000}}," +
                    "\"realtime_24h\":{\"active_connections_current\":34,\"active_connections_peak\":63," +
                    "\"snapshot_listeners_current\":47,\"snapshot_listeners_peak\":63}," +
                    "\"rules_24h\":{\"allow\":65000,\"deny\":15,\"error\":2}," +
                    "\"hourly\":[{\"hour_label_vn\":\"18:00–19:00\",\"reads\":1000,\"writes\":500,\"deletes\":0," +
                    "\"listeners_peak\":60,\"connections_peak\":32,\"rules_allow\":3000,\"rules_deny\":1,\"rules_error\":0}]}";
                var root = JsonHelpers.Map(json.DeserializeObject(sample));
                if (!JsonHelpers.BoolValue(root, "ok")) return false;
                if (!JsonHelpers.BoolValue(JsonHelpers.Child(root, "availability"), "rules")) return false;
                if (JsonHelpers.LongValue(JsonHelpers.Child(root, "quota_day"), "reads") != 17000) return false;
                var count = 0;
                foreach (var item in JsonHelpers.List(JsonHelpers.Value(root, "hourly")))
                {
                    var row = JsonHelpers.Map(item);
                    if (JsonHelpers.LongValue(row, "writes") != 500) return false;
                    count++;
                }
                return count == 1;
            }
            catch
            {
                return false;
            }
        }
    }
}
