using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly Label _d131UsageProviderStatus = new Label();
        private readonly Label _d131UsageFirestore = new Label();
        private readonly Label _d131UsageAuth = new Label();
        private readonly Label _d131UsageFunction = new Label();
        private readonly Label _d131UsageExport = new Label();
        private readonly Label _d131UsageDrive = new Label();
        private readonly Label _d131UsageLocal = new Label();
        private readonly Button _d131UsageRefresh = new Button();
        private readonly System.Windows.Forms.Timer _d131UsageLocalTimer = new System.Windows.Forms.Timer();
        private long _d131UsageRefreshRunning;
        private DateTime _d131UsageLastProviderRefreshUtc = DateTime.MinValue;

        private void InitializeD131UsageFeatures()
        {
            _usagePage.Controls.Clear();
            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                AutoScroll = true,
                Padding = new Padding(14),
                ColumnCount = 1,
                RowCount = 8,
                BackColor = Color.FromArgb(243, 246, 248)
            };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));

            _d131UsageProviderStatus.Text = "Provider Usage: chưa tải";
            ConfigureUsageLabel(_d131UsageProviderStatus, true);
            root.Controls.Add(_d131UsageProviderStatus);

            ConfigureUsageLabel(_d131UsageFirestore, false);
            ConfigureUsageLabel(_d131UsageAuth, false);
            ConfigureUsageLabel(_d131UsageFunction, false);
            ConfigureUsageLabel(_d131UsageExport, false);
            ConfigureUsageLabel(_d131UsageDrive, false);
            ConfigureUsageLabel(_d131UsageLocal, false);

            root.Controls.Add(UsageCard("Firestore PDA ↔ Agent", _d131UsageFirestore));
            root.Controls.Add(UsageCard("Xác thực & thông báo", _d131UsageAuth, _d131UsageFunction));
            root.Controls.Add(UsageCard("Export Excel hằng ngày", _d131UsageExport, _d131UsageDrive));
            root.Controls.Add(UsageCard("Agent hiện tại", _d131UsageLocal));

            _d131UsageRefresh.Text = "Làm mới Usage";
            _d131UsageRefresh.AutoSize = true;
            _d131UsageRefresh.Margin = new Padding(0, 8, 0, 0);
            _d131UsageRefresh.Click += (s, e) => QueueD131UsageRefresh(true);
            root.Controls.Add(_d131UsageRefresh);

            _usagePage.Controls.Add(root);
            _d131UsageLocalTimer.Interval = 1000;
            _d131UsageLocalTimer.Tick += (s, e) =>
            {
                if (_mainTabs.SelectedTab == _usagePage) RefreshD131UsageLocal();
            };
            _d131UsageLocalTimer.Start();
            FormClosed += (s, e) =>
            {
                try { _d131UsageLocalTimer.Stop(); } catch { }
                try { _d131UsageLocalTimer.Dispose(); } catch { }
            };
        }

        private static void ConfigureUsageLabel(Label label, bool bold)
        {
            label.Dock = DockStyle.Top;
            label.AutoSize = true;
            label.MaximumSize = new Size(1800, 0);
            label.Padding = new Padding(2, 5, 2, 5);
            label.Font = new Font("Segoe UI", bold ? 10F : 9.5F, bold ? FontStyle.Bold : FontStyle.Regular);
            label.ForeColor = Color.FromArgb(30, 41, 59);
        }

        private static Control UsageCard(string title, params Control[] lines)
        {
            var panel = new TableLayoutPanel
            {
                Dock = DockStyle.Top,
                AutoSize = true,
                ColumnCount = 1,
                Padding = new Padding(12),
                Margin = new Padding(0, 8, 0, 0),
                BackColor = Color.White
            };
            var heading = new Label
            {
                Text = title,
                Dock = DockStyle.Top,
                AutoSize = true,
                Font = new Font("Segoe UI", 10F, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Padding = new Padding(0, 0, 0, 4)
            };
            panel.Controls.Add(heading);
            foreach (var line in lines) panel.Controls.Add(line);
            return panel;
        }

        internal void D131UsageTabActivated()
        {
            RefreshD131UsageLocal();
            var due = _d131UsageLastProviderRefreshUtc == DateTime.MinValue ||
                      DateTime.UtcNow - _d131UsageLastProviderRefreshUtc >= TimeSpan.FromMinutes(10);
            if (due) QueueD131UsageRefresh(false);
        }

        private void QueueD131UsageRefresh(bool force)
        {
            if (!HasAgentSession()) return;
            if (Interlocked.CompareExchange(ref _d131UsageRefreshRunning, 1L, 0L) != 0L) return;
            Ui(() =>
            {
                _d131UsageRefresh.Enabled = false;
                _d131UsageProviderStatus.Text = "Provider Usage: đang đọc Google Monitoring / Drive...";
            });

            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    var payload = FetchD131Usage(session, force);
                    _d131UsageLastProviderRefreshUtc = DateTime.UtcNow;
                    Ui(() => RenderD131Usage(payload));
                }
                catch (Exception ex)
                {
                    Ui(() => _d131UsageProviderStatus.Text =
                        "Provider Usage: không đọc được · " + SafeMessage(ex));
                }
                finally
                {
                    Interlocked.Exchange(ref _d131UsageRefreshRunning, 0L);
                    Ui(() => _d131UsageRefresh.Enabled = true);
                }
            });
        }

        private Dictionary<string, object> FetchD131Usage(AgentSession session, bool force)
        {
            var url = AgentConfig.AgentUsageUrl + (force ? "?refresh=1" : "");
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Timeout = 20000;
            request.ReadWriteTimeout = 20000;
            request.UserAgent = "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild;
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + session.IdToken;
            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    var raw = reader.ReadToEnd();
                    var json = new JavaScriptSerializer();
                    return json.DeserializeObject(raw) as Dictionary<string, object>
                           ?? new Dictionary<string, object>();
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                throw new InvalidOperationException("Usage HTTP " + status, ex);
            }
        }

        private void RenderD131Usage(Dictionary<string, object> payload)
        {
            var monitoring = Map(payload, "monitoring");
            var generated = Text(payload, "generated_at");
            var cached = Bool(payload, "cached");
            if (!Bool(monitoring, "available"))
            {
                _d131UsageProviderStatus.Text =
                    "Provider Usage: Monitoring chưa khả dụng · " + Text(monitoring, "error") +
                    " · không fallback bằng cách quét Firestore";
                _d131UsageFirestore.Text = "Chưa có số provider-authoritative.";
                _d131UsageAuth.Text = "Firebase Auth: chưa có số provider-authoritative.";
                _d131UsageFunction.Text = "Function/FCM: chưa có số provider-authoritative.";
            }
            else
            {
                _d131UsageProviderStatus.Text =
                    "Provider Usage · " + (cached ? "cache ≤10 phút" : "vừa làm mới") +
                    " · provider day " + Text(monitoring, "provider_day") +
                    (generated.Length > 0 ? " · " + generated : "");

                var fs = Map(monitoring, "firestore");
                var soft = Map(fs, "soft");
                var free = Map(fs, "free_reference");
                _d131UsageFirestore.Text =
                    "Reads: " + N(Long(fs, "reads")) + " / " + N(Long(soft, "reads")) + " soft / " + N(Long(free, "reads")) + " free ref" +
                    Environment.NewLine +
                    "Writes: " + N(Long(fs, "writes")) + " / " + N(Long(soft, "writes")) + " soft / " + N(Long(free, "writes")) + " free ref" +
                    Environment.NewLine +
                    "Deletes: " + N(Long(fs, "deletes")) + " / " + N(Long(soft, "deletes")) + " soft / " + N(Long(free, "deletes")) + " free ref" +
                    Environment.NewLine +
                    "Storage: " + Bytes(Long(fs, "storage_bytes")) + " / " + Bytes(Long(soft, "storage_bytes")) + " soft / " + Bytes(Long(free, "storage_bytes")) + " free ref" +
                    Environment.NewLine +
                    "Connections: " + N(Long(fs, "active_connections")) + " · Listeners: " + N(Long(fs, "snapshot_listeners"));

                var auth = Map(monitoring, "auth");
                _d131UsageAuth.Text =
                    "Firebase Auth · DAU: " + N(Long(auth, "daily_active")) +
                    " · MAU: " + N(Long(auth, "monthly_active"));

                var functions = Map(monitoring, "functions");
                var fcm = Map(monitoring, "fcm");
                _d131UsageFunction.Text =
                    "Picker-call Function hôm nay: " + N(Long(functions, "executions")) +
                    " · lỗi: " + N(Long(functions, "errors")) +
                    " · FCM: " + (Text(fcm, "pricing") == "NO_COST" ? "No-cost" : Text(fcm, "pricing"));
            }

            var export = Map(payload, "export");
            _d131UsageExport.Text =
                "Business day: " + Text(export, "business_day") +
                " · " + Text(export, "status") +
                Environment.NewLine +
                "File: " + EmptyAsDash(Text(export, "file_name")) +
                " · dòng: " + N(Long(export, "rows")) +
                " · thời gian: " + N(Long(export, "duration_ms")) + " ms" +
                Environment.NewLine +
                "Cleanup: " + N(Long(export, "deleted_jobs")) + " job · " +
                N(Long(export, "deleted_guards")) + " guard" +
                (Text(export, "error_code").Length == 0 ? "" : " · lỗi: " + Text(export, "error_code"));

            var drive = Map(payload, "drive");
            _d131UsageDrive.Text = drive.Count == 0
                ? "Drive storage: chưa đọc được; export vẫn dùng trạng thái riêng."
                : "Drive: " + Bytes(Long(drive, "usage")) + " / " + Bytes(Long(drive, "limit")) +
                  " · dữ liệu Drive: " + Bytes(Long(drive, "usageInDrive"));
            RefreshD131UsageLocal();
        }

        private void RefreshD131UsageLocal()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RefreshD131UsageLocal));
                return;
            }
            var role = _leaderCoordinator == null ? "chưa ghép HA" : _leaderCoordinator.RoleName;
            _d131UsageLocal.Text =
                "HA: " + role +
                " · Web Confirm: " + (HasReadyConfirmBrowser() ? "sẵn sàng" : "chưa sẵn sàng") +
                Environment.NewLine +
                (_d128AgentResourceStatus == null ? "" : _d128AgentResourceStatus.Text) +
                Environment.NewLine +
                (_d128BrowserResourceStatus == null ? "" : _d128BrowserResourceStatus.Text) +
                Environment.NewLine +
                FirestoreQuotaGuard.SnapshotText();
        }

        private static Dictionary<string, object> Map(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value)
                ? value as Dictionary<string, object> ?? new Dictionary<string, object>()
                : new Dictionary<string, object>();
        }

        private static string Text(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static long Long(Dictionary<string, object> map, string key)
        {
            object value;
            long parsed;
            return map != null && map.TryGetValue(key, out value) &&
                   long.TryParse(Convert.ToString(value), NumberStyles.Any, CultureInfo.InvariantCulture, out parsed)
                ? parsed
                : 0L;
        }

        private static bool Bool(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) &&
                   Convert.ToBoolean(value, CultureInfo.InvariantCulture);
        }

        private static string N(long value)
        {
            return Math.Max(0L, value).ToString("N0", CultureInfo.InvariantCulture);
        }

        private static string Bytes(long value)
        {
            var bytes = Math.Max(0L, value);
            if (bytes >= 1024L * 1024L * 1024L)
                return (bytes / 1024d / 1024d / 1024d).ToString("0.00", CultureInfo.InvariantCulture) + " GiB";
            if (bytes >= 1024L * 1024L)
                return (bytes / 1024d / 1024d).ToString("0.0", CultureInfo.InvariantCulture) + " MiB";
            if (bytes >= 1024L)
                return (bytes / 1024d).ToString("0.0", CultureInfo.InvariantCulture) + " KiB";
            return bytes.ToString(CultureInfo.InvariantCulture) + " B";
        }

        private static string EmptyAsDash(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "—" : value;
        }
    }
}
