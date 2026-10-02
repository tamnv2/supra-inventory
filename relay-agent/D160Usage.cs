using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed class D160UsageClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };

        internal Dictionary<string, object> Fetch(string idToken)
        {
            Uri gateway;
            var url = (AgentConfig.AgentLogGatewayUrl ?? "").Trim();
            if (!Uri.TryCreate(url, UriKind.Absolute, out gateway) ||
                !string.Equals(gateway.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
                url.Contains("__"))
                throw new InvalidOperationException("USAGE_GATEWAY_NOT_CONFIGURED");
            if (string.IsNullOrWhiteSpace(idToken))
                throw new InvalidOperationException("USAGE_SESSION_NOT_READY");

            var body = new Dictionary<string, object>
            {
                { "action", "get_firestore_usage" },
                { "id_token", idToken }
            };
            var bytes = Encoding.UTF8.GetBytes(_json.Serialize(body));
            var request = (HttpWebRequest)WebRequest.Create(gateway);
            request.Method = "POST";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D160";
            request.Timeout = 30000;
            request.ReadWriteTimeout = 30000;
            request.AllowAutoRedirect = true;
            request.ContentLength = bytes.Length;
            using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                {
                    var root = D160UsageJson.Map(_json.DeserializeObject(reader.ReadToEnd()));
                    if (!D160UsageJson.Bool(root, "ok"))
                    {
                        var code = D160UsageJson.String(root, "error");
                        throw new InvalidOperationException(string.IsNullOrWhiteSpace(code) ? "USAGE_GATEWAY_REJECTED" : code);
                    }
                    if (!string.Equals(
                            D160UsageJson.String(root, "service"),
                            "SUPRA_AGENT_OPERATIONS_USAGE_D160",
                            StringComparison.Ordinal) ||
                        !string.Equals(
                            D160UsageJson.String(root, "project"),
                            AgentConfig.FirebaseProjectId,
                            StringComparison.Ordinal) ||
                        !string.Equals(
                            D160UsageJson.String(root, "revision"),
                            "D160-GW-v1",
                            StringComparison.Ordinal))
                        throw new InvalidOperationException("USAGE_GATEWAY_IDENTITY_MISMATCH");
                    return root;
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? "NETWORK" : ((int)response.StatusCode).ToString(CultureInfo.InvariantCulture);
                try { if (response != null) response.Dispose(); } catch { }
                throw new InvalidOperationException("USAGE_GATEWAY_" + status);
            }
        }
    }

    internal static class D160UsageJson
    {
        internal static Dictionary<string, object> Map(object value)
        {
            return value as Dictionary<string, object> ?? new Dictionary<string, object>(StringComparer.Ordinal);
        }
        internal static IEnumerable<object> List(object value)
        {
            var arr = value as object[];
            if (arr != null) return arr;
            var list = value as ArrayList;
            if (list != null)
            {
                var result = new List<object>();
                foreach (var item in list) result.Add(item);
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
        internal static object Value(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? value : null;
        }
        internal static Dictionary<string, object> Child(Dictionary<string, object> map, string key)
        {
            return Map(Value(map, key));
        }
        internal static string String(Dictionary<string, object> map, string key)
        {
            var value = Value(map, key);
            return value == null ? "" : Convert.ToString(value, CultureInfo.InvariantCulture);
        }
        internal static long Long(Dictionary<string, object> map, string key)
        {
            long value;
            return long.TryParse(String(map, key), NumberStyles.Any, CultureInfo.InvariantCulture, out value) ? value : 0L;
        }
        internal static bool Bool(Dictionary<string, object> map, string key)
        {
            var value = Value(map, key);
            if (value is bool) return (bool)value;
            bool parsed;
            return bool.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), out parsed) && parsed;
        }
    }

    internal sealed partial class AgentForm
    {
        private readonly D160UsageClient _d160UsageClient = new D160UsageClient();
        private readonly System.Windows.Forms.Timer _d160UsageTimer = new System.Windows.Forms.Timer();
        private readonly Label _d160UsageStatus = new Label();
        private readonly Label _d160UsageUpdated = new Label();
        private readonly Button _d160UsageRefresh = new Button();
        private readonly DataGridView _d160UsageGrid = new DataGridView();
        private readonly Dictionary<string, Label> _d160UsageMetrics =
            new Dictionary<string, Label>(StringComparer.Ordinal);
        private int _d160UsageRefreshing;
        private DateTime _d160UsageLastRefreshUtc = DateTime.MinValue;

        private void InitializeD160UsageUi()
        {
            _d160UsagePage.BackColor = Color.FromArgb(243, 246, 248);
            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(12),
                RowCount = 3,
                ColumnCount = 1
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 76));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 330));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            _d160UsagePage.Controls.Add(root);

            var header = new Panel { Dock = DockStyle.Fill };
            header.Controls.Add(new Label
            {
                Left = 4,
                Top = 2,
                Width = 620,
                Height = 30,
                Text = "Firebase / Firestore Usage — Beta",
                Font = new Font("Segoe UI Semibold", 16F, FontStyle.Bold)
            });
            _d160UsageStatus.SetBounds(6, 40, 760, 28);
            _d160UsageStatus.Text = "Tự cập nhật theo mốc 00 / 15 / 30 / 45 · Cloud Monitoring read-only · 0 Firestore document op cho Usage.";
            _d160UsageStatus.ForeColor = Color.FromArgb(71, 85, 105);
            header.Controls.Add(_d160UsageStatus);
            _d160UsageUpdated.SetBounds(770, 6, 250, 42);
            _d160UsageUpdated.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _d160UsageUpdated.TextAlign = ContentAlignment.TopRight;
            _d160UsageUpdated.ForeColor = Color.FromArgb(100, 116, 139);
            header.Controls.Add(_d160UsageUpdated);
            _d160UsageRefresh.SetBounds(1030, 6, 135, 34);
            _d160UsageRefresh.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _d160UsageRefresh.Text = "Cập nhật ngay";
            _d160UsageRefresh.Click += async (s, e) => await RefreshD160UsageAsync(true);
            header.Controls.Add(_d160UsageRefresh);
            header.Resize += (s, e) =>
            {
                _d160UsageRefresh.Left = Math.Max(10, header.ClientSize.Width - _d160UsageRefresh.Width - 8);
                _d160UsageUpdated.Left = Math.Max(10, _d160UsageRefresh.Left - _d160UsageUpdated.Width - 12);
            };
            root.Controls.Add(header, 0, 0);

            var groups = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 3,
                RowCount = 2,
                Padding = new Padding(0, 2, 0, 6)
            };
            for (var i = 0; i < 3; i++) groups.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.333F));
            groups.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
            groups.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
            groups.Controls.Add(D160UsageGroup("Firestore — quota hôm nay", new[]
            {
                Tuple.Create("Lượt đọc","reads"), Tuple.Create("Lượt ghi","writes"),
                Tuple.Create("Lượt xóa","deletes"), Tuple.Create("Dung lượng","storage"),
                Tuple.Create("Reset quota","reset")
            }),0,0);
            groups.Controls.Add(D160UsageGroup("Realtime & Rules · 24 giờ", new[]
            {
                Tuple.Create("Kết nối","connections"), Tuple.Create("Listener","listeners"),
                Tuple.Create("Rule cho phép","rules_allow"), Tuple.Create("Rule từ chối","rules_deny"),
                Tuple.Create("Rule lỗi","rules_error")
            }),1,0);
            groups.Controls.Add(D160UsageGroup("Firebase · 24 giờ", new[]
            {
                Tuple.Create("Auth/tài khoản","auth_identity"), Tuple.Create("Refresh phiên","auth_refresh"),
                Tuple.Create("Lỗi xác thực","auth_errors"), Tuple.Create("FCM gửi","fcm_requests"),
                Tuple.Create("FCM lỗi","fcm_errors")
            }),2,0);
            groups.Controls.Add(D160UsageGroup("Firestore — tổng 24 giờ", new[]
            {
                Tuple.Create("Tổng đọc","traffic_reads"), Tuple.Create("Tổng ghi","traffic_writes"),
                Tuple.Create("Tổng xóa","traffic_deletes"), Tuple.Create("Đỉnh đọc","peak_read"),
                Tuple.Create("Đỉnh ghi","peak_write")
            }),0,1);
            groups.Controls.Add(D160UsageGroup("Cloud Functions · 24 giờ", new[]
            {
                Tuple.Create("Lượt xử lý","function_requests"), Tuple.Create("Lỗi 4xx/5xx","function_errors"),
                Tuple.Create("Instance hiện tại/đỉnh","function_instances"), Tuple.Create("Thời gian tính phí","function_billable"),
                Tuple.Create("Nguồn","provider")
            }),1,1);
            groups.Controls.Add(D160UsageGroup("Cơ chế giám sát", new[]
            {
                Tuple.Create("Tự cập nhật","auto"), Tuple.Create("Cache dùng chung","cache"),
                Tuple.Create("Firestore phát sinh","extra"), Tuple.Create("Độ trễ dữ liệu","delay"),
                Tuple.Create("Quyền xem","visibility")
            }),2,1);
            root.Controls.Add(groups,0,1);

            var host = new GroupBox { Text = "Chi tiết Firestore — 24 giờ gần nhất", Dock = DockStyle.Fill, Padding = new Padding(8) };
            _d160UsageGrid.Dock = DockStyle.Fill;
            _d160UsageGrid.ReadOnly = true;
            _d160UsageGrid.AllowUserToAddRows = false;
            _d160UsageGrid.AllowUserToDeleteRows = false;
            _d160UsageGrid.AllowUserToResizeRows = false;
            _d160UsageGrid.RowHeadersVisible = false;
            _d160UsageGrid.BackgroundColor = Color.White;
            _d160UsageGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            foreach (var col in new[]
            {
                Tuple.Create("hour","Giờ"), Tuple.Create("reads","Đọc"), Tuple.Create("writes","Ghi"),
                Tuple.Create("deletes","Xóa"), Tuple.Create("listeners","Listener đỉnh"),
                Tuple.Create("connections","Kết nối đỉnh"), Tuple.Create("allow","Rule cho phép"),
                Tuple.Create("deny","Rule từ chối"), Tuple.Create("error","Rule lỗi")
            }) _d160UsageGrid.Columns.Add(col.Item1,col.Item2);
            host.Controls.Add(_d160UsageGrid);
            root.Controls.Add(host,0,2);

            D160UsageSet("auto","Mốc 00 / 15 / 30 / 45");
            D160UsageSet("cache","Dùng chung tối đa 15 phút");
            D160UsageSet("extra","0 Read / 0 Write / 0 Delete");
            D160UsageSet("delay","Monitoring có thể trễ vài–30 phút");
            D160UsageSet("visibility","Chỉ tamnv2 / admin");

            _d160UsageTimer.Tick += async (s,e) =>
            {
                _d160UsageTimer.Stop();
                await RefreshD160UsageAsync(false);
                ScheduleD160UsageQuarterHour();
                if (D160UsageAllowedForCurrentSession()) _d160UsageTimer.Start();
            };
        }

        private GroupBox D160UsageGroup(string title, Tuple<string,string>[] rows)
        {
            var box = new GroupBox { Text = title, Dock = DockStyle.Fill, Padding = new Padding(8) };
            var table = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = rows.Length };
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 48F));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 52F));
            for (var i=0;i<rows.Length;i++)
            {
                table.RowStyles.Add(new RowStyle(SizeType.Percent,100F/rows.Length));
                table.Controls.Add(new Label
                {
                    Text=rows[i].Item1, AutoSize=true, Anchor=AnchorStyles.Left,
                    ForeColor=Color.FromArgb(71,85,105)
                },0,i);
                var value=new Label
                {
                    Text="—", AutoSize=true, Anchor=AnchorStyles.Left,
                    Font=new Font("Segoe UI Semibold",9.2F,FontStyle.Bold)
                };
                _d160UsageMetrics[rows[i].Item2]=value;
                table.Controls.Add(value,1,i);
            }
            box.Controls.Add(table);
            return box;
        }

        private void StartD160Usage()
        {
            if (!D160UsageAllowedForCurrentSession()) return;
            ScheduleD160UsageQuarterHour();
            _d160UsageTimer.Start();
        }

        private void ScheduleD160UsageQuarterHour()
        {
            var now = DateTime.Now;
            var nextMinute = ((now.Minute / 15) + 1) * 15;
            var next = nextMinute >= 60
                ? new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, now.Kind).AddHours(1)
                : new DateTime(now.Year, now.Month, now.Day, now.Hour, nextMinute, 0, now.Kind);
            var delay = next - now;
            var ms = (int)Math.Max(1000D, Math.Min(int.MaxValue, delay.TotalMilliseconds));
            _d160UsageTimer.Interval = ms;
            _d160UsageUpdated.Text = "Tự cập nhật lúc " + next.ToString("HH:mm");
        }

        private void StopD160Usage()
        {
            _d160UsageTimer.Stop();
        }

        private async Task RefreshD160UsageAsync(bool manual)
        {
            if (!D160UsageAllowedForCurrentSession()) return;
            if (Interlocked.Exchange(ref _d160UsageRefreshing,1)!=0) return;
            _d160UsageRefresh.Enabled=false;
            _d160UsageStatus.Text="Đang lấy dữ liệu Cloud Monitoring…";
            try
            {
                var snapshot=await Task.Run(() =>
                {
                    EnsureFreshToken();
                    var session=SnapshotSession();
                    if (session==null || string.IsNullOrWhiteSpace(session.IdToken))
                        throw new InvalidOperationException("USAGE_SESSION_NOT_READY");
                    if (!D160UsageAllowedForCurrentSession())
                        throw new InvalidOperationException("USAGE_LOGIN_NOT_ALLOWED");
                    return _d160UsageClient.Fetch(session.IdToken);
                });
                ApplyD160Usage(snapshot);
                _d160UsageLastRefreshUtc=DateTime.UtcNow;
                _d160UsageStatus.ForeColor=Color.FromArgb(21,128,61);
                _d160UsageStatus.Text=D160UsageJson.Bool(snapshot,"partial")
                    ? "Đã cập nhật nhưng Cloud Monitoring thiếu một phần metric; N/A không được coi là 0."
                    : "Đã cập nhật · 0 Firestore document Read/Write/Delete cho tính năng Usage.";
            }
            catch(Exception ex)
            {
                _d160UsageStatus.ForeColor=Color.FromArgb(185,28,28);
                _d160UsageStatus.Text="Không lấy được Usage: "+AgentDiagnostics.Sanitize(ex.Message);
                Log("D160 USAGE refresh=DEFER type="+ex.GetType().Name+" detail="+AgentDiagnostics.Sanitize(ex.Message));
            }
            finally
            {
                _d160UsageRefresh.Enabled=true;
                Interlocked.Exchange(ref _d160UsageRefreshing,0);
            }
        }

        private void ApplyD160Usage(Dictionary<string,object> snapshot)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<Dictionary<string,object>>(ApplyD160Usage),snapshot);
                return;
            }
            var availability=D160UsageJson.Child(snapshot,"availability");
            bool reads=D160UsageJson.Bool(availability,"reads"), writes=D160UsageJson.Bool(availability,"writes"),
                 deletes=D160UsageJson.Bool(availability,"deletes"), storageOk=D160UsageJson.Bool(availability,"storage"),
                 connections=D160UsageJson.Bool(availability,"connections"), listeners=D160UsageJson.Bool(availability,"listeners"),
                 rulesOk=D160UsageJson.Bool(availability,"rules"), fcmOk=D160UsageJson.Bool(availability,"fcm"),
                 authOk=D160UsageJson.Bool(availability,"auth_identity"), refreshOk=D160UsageJson.Bool(availability,"auth_refresh"),
                 fnReq=D160UsageJson.Bool(availability,"functions_requests"), fnInst=D160UsageJson.Bool(availability,"functions_instances"),
                 fnBill=D160UsageJson.Bool(availability,"functions_billable");

            var quota=D160UsageJson.Child(snapshot,"quota_day");
            var limits=D160UsageJson.Child(quota,"reference_limits");
            D160UsageSet("reads",reads?D160QuotaText(D160UsageJson.Long(quota,"reads"),D160UsageJson.Long(limits,"reads")):"N/A");
            D160UsageSet("writes",writes?D160QuotaText(D160UsageJson.Long(quota,"writes"),D160UsageJson.Long(limits,"writes")):"N/A");
            D160UsageSet("deletes",deletes?D160QuotaText(D160UsageJson.Long(quota,"deletes"),D160UsageJson.Long(limits,"deletes")):"N/A");
            var storage=D160UsageJson.Child(snapshot,"firestore_storage");
            D160UsageSet("storage",storageOk?D160Bytes(D160UsageJson.Long(storage,"data_and_index_bytes"),D160UsageJson.Long(storage,"free_reference_bytes")):"N/A");
            D160UsageSet("reset",D160Reset(D160UsageJson.String(quota,"reset_at")));

            var realtime=D160UsageJson.Child(snapshot,"realtime_24h");
            D160UsageSet("connections",connections?D160N(D160UsageJson.Long(realtime,"active_connections_current"))+" hiện tại · "+D160N(D160UsageJson.Long(realtime,"active_connections_peak"))+" đỉnh":"N/A");
            D160UsageSet("listeners",listeners?D160N(D160UsageJson.Long(realtime,"snapshot_listeners_current"))+" hiện tại · "+D160N(D160UsageJson.Long(realtime,"snapshot_listeners_peak"))+" đỉnh":"N/A");
            var rules=D160UsageJson.Child(snapshot,"rules_24h");
            D160UsageSet("rules_allow",rulesOk?D160N(D160UsageJson.Long(rules,"allow")):"N/A");
            D160UsageSet("rules_deny",rulesOk?D160N(D160UsageJson.Long(rules,"deny")):"N/A");
            D160UsageSet("rules_error",rulesOk?D160N(D160UsageJson.Long(rules,"error")):"N/A");

            var firebase=D160UsageJson.Child(snapshot,"firebase_24h");
            var fcm=D160UsageJson.Child(firebase,"fcm");
            var identity=D160UsageJson.Child(firebase,"identity_toolkit");
            var secure=D160UsageJson.Child(firebase,"secure_token");
            D160UsageSet("fcm_requests",fcmOk?D160N(D160UsageJson.Long(fcm,"requests")):"N/A");
            D160UsageSet("fcm_errors",fcmOk?D160N(D160UsageJson.Long(fcm,"client_errors")+D160UsageJson.Long(fcm,"server_errors")):"N/A");
            D160UsageSet("auth_identity",authOk?D160N(D160UsageJson.Long(identity,"requests")):"N/A");
            D160UsageSet("auth_refresh",refreshOk?D160N(D160UsageJson.Long(secure,"requests")):"N/A");
            D160UsageSet("auth_errors",authOk&&refreshOk?D160N(
                D160UsageJson.Long(identity,"client_errors")+D160UsageJson.Long(identity,"server_errors")+
                D160UsageJson.Long(secure,"client_errors")+D160UsageJson.Long(secure,"server_errors")):"N/A");

            var traffic=D160UsageJson.Child(snapshot,"firestore_24h");
            D160UsageSet("traffic_reads",reads?D160N(D160UsageJson.Long(traffic,"reads")):"N/A");
            D160UsageSet("traffic_writes",writes?D160N(D160UsageJson.Long(traffic,"writes")):"N/A");
            D160UsageSet("traffic_deletes",deletes?D160N(D160UsageJson.Long(traffic,"deletes")):"N/A");
            D160UsageSet("peak_read",reads?D160UsageJson.String(traffic,"peak_read_hour")+" · "+D160N(D160UsageJson.Long(traffic,"peak_read_value")):"N/A");
            D160UsageSet("peak_write",writes?D160UsageJson.String(traffic,"peak_write_hour")+" · "+D160N(D160UsageJson.Long(traffic,"peak_write_value")):"N/A");

            var functions=D160UsageJson.Child(snapshot,"functions_24h");
            var functionReq=D160UsageJson.Child(functions,"requests");
            D160UsageSet("function_requests",fnReq?D160N(D160UsageJson.Long(functionReq,"requests")):"N/A");
            D160UsageSet("function_errors",fnReq?D160N(D160UsageJson.Long(functionReq,"client_errors")+D160UsageJson.Long(functionReq,"server_errors")):"N/A");
            D160UsageSet("function_instances",fnInst?D160N(D160UsageJson.Long(functions,"instances_current"))+" hiện tại · "+D160N(D160UsageJson.Long(functions,"instances_peak"))+" đỉnh":"N/A");
            D160UsageSet("function_billable",fnBill?D160Duration(D160UsageJson.Long(functions,"billable_instance_seconds")):"N/A");
            D160UsageSet("provider",D160UsageJson.Bool(snapshot,"cache_hit")?"Cache dùng chung":"Cloud Monitoring");

            _d160UsageGrid.Rows.Clear();
            foreach(var item in D160UsageJson.List(D160UsageJson.Value(snapshot,"hourly")))
            {
                var row=D160UsageJson.Map(item);
                _d160UsageGrid.Rows.Add(
                    D160UsageJson.String(row,"hour_label_vn"),
                    reads?D160N(D160UsageJson.Long(row,"reads")):"N/A",
                    writes?D160N(D160UsageJson.Long(row,"writes")):"N/A",
                    deletes?D160N(D160UsageJson.Long(row,"deletes")):"N/A",
                    listeners?D160N(D160UsageJson.Long(row,"listeners_peak")):"N/A",
                    connections?D160N(D160UsageJson.Long(row,"connections_peak")):"N/A",
                    rulesOk?D160N(D160UsageJson.Long(row,"rules_allow")):"N/A",
                    rulesOk?D160N(D160UsageJson.Long(row,"rules_deny")):"N/A",
                    rulesOk?D160N(D160UsageJson.Long(row,"rules_error")):"N/A");
            }

            DateTimeOffset generated;
            var generatedText=D160UsageJson.String(snapshot,"generated_at");
            var when=DateTimeOffset.TryParse(generatedText,CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal,out generated)
                ? generated.ToLocalTime().ToString("dd/MM/yyyy HH:mm:ss") : "—";
            _d160UsageUpdated.Text="Cập nhật: "+when+Environment.NewLine+
                (D160UsageJson.Bool(snapshot,"cache_hit")?"cache ≤15 phút":"Cloud Monitoring mới");
        }

        private void D160UsageSet(string key,string value)
        {
            Label label;
            if (_d160UsageMetrics.TryGetValue(key,out label)) label.Text=value??"—";
        }
        private static string D160N(long value){return value.ToString("N0",CultureInfo.GetCultureInfo("vi-VN"));}
        private static string D160QuotaText(long value,long limit)
        {
            var pct=limit<=0?0D:100D*value/limit;
            return D160N(value)+" / "+D160N(limit)+" · "+pct.ToString("0.#",CultureInfo.InvariantCulture)+"% · còn "+D160N(Math.Max(0L,limit-value));
        }
        private static string D160Bytes(long value,long limit)
        {
            var used=value/1024D/1024D; var max=limit/1024D/1024D;
            return used.ToString("N1",CultureInfo.GetCultureInfo("vi-VN"))+" MiB / "+max.ToString("N0",CultureInfo.GetCultureInfo("vi-VN"))+" MiB";
        }
        private static string D160Reset(string iso)
        {
            DateTimeOffset reset;
            if(!DateTimeOffset.TryParse(iso,CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal,out reset))return"N/A";
            var remain=reset.ToUniversalTime()-DateTimeOffset.UtcNow;if(remain<TimeSpan.Zero)remain=TimeSpan.Zero;
            return reset.ToLocalTime().ToString("dd/MM HH:mm")+" · còn "+((int)remain.TotalHours)+"g "+remain.Minutes+"p";
        }
        private static string D160Duration(long seconds)
        {
            if(seconds<60)return D160N(seconds)+" giây";
            if(seconds<3600)return(seconds/60D).ToString("0.#",CultureInfo.GetCultureInfo("vi-VN"))+" phút";
            return(seconds/3600D).ToString("0.##",CultureInfo.GetCultureInfo("vi-VN"))+" giờ";
        }
    }
}
