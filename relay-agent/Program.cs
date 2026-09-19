using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            AgentDiagnostics.Initialize();
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            try
            {
                WebRequest.DefaultWebProxy = WebRequest.GetSystemWebProxy();
                if (WebRequest.DefaultWebProxy != null)
                    WebRequest.DefaultWebProxy.Credentials = CredentialCache.DefaultNetworkCredentials;
                AgentDiagnostics.Write("SYSTEM proxy=windows-default tls=TLS1.2");
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("SYSTEM proxy-init-failed " + ex.GetType().Name);
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new AgentForm());
        }
    }

    internal static class AgentDiagnostics
    {
        private static readonly object Gate = new object();
        private static readonly Regex JwtPattern = new Regex(@"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}", RegexOptions.Compiled);
        private static readonly Regex SecretPattern = new Regex(@"(?i)(authorization|bearer|token|password|secret|private[_ -]?key|api[_ -]?key|cookie|refresh[_ -]?token|id[_ -]?token)\s*[:=]\s*[^\s,;]+", RegexOptions.Compiled);
        private static readonly Regex QuerySecretPattern = new Regex(@"(?i)([?&](?:auth|key|access_token|token)=)[^&\s]+", RegexOptions.Compiled);
        internal static string LogFile { get; private set; }

        internal static void Initialize()
        {
            try
            {
                var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SUPRA Inventory", "RelayPoc", "Logs");
                Directory.CreateDirectory(dir);
                LogFile = Path.Combine(dir, "relay-agent-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Process.GetCurrentProcess().Id + ".log");
                Write("START version=" + Assembly.GetExecutingAssembly().GetName().Version + " os=" + Environment.OSVersion.VersionString + " clr=" + Environment.Version + " process64=" + Environment.Is64BitProcess + " machine=" + Environment.MachineName);
            }
            catch
            {
                LogFile = "";
            }
        }

        internal static string Sanitize(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            var next = value.Length > 4000 ? value.Substring(0, 4000) : value;
            next = QuerySecretPattern.Replace(next, "$1[REDACTED]");
            next = SecretPattern.Replace(next, m => m.Groups[1].Value + "=[REDACTED]");
            next = JwtPattern.Replace(next, "[REDACTED_JWT]");
            return next;
        }

        internal static string SafeUrl(string url)
        {
            try
            {
                var uri = new Uri(url);
                return uri.GetLeftPart(UriPartial.Path);
            }
            catch
            {
                return Sanitize(url);
            }
        }

        internal static void Write(string message)
        {
            var line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + "  " + Sanitize(message);
            try
            {
                lock (Gate)
                {
                    if (!string.IsNullOrWhiteSpace(LogFile))
                        File.AppendAllText(LogFile, line + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch { }
        }

        internal static void OpenLog()
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(LogFile) && File.Exists(LogFile))
                    Process.Start("explorer.exe", "/select,\"" + LogFile + "\"");
            }
            catch { }
        }
    }

    internal sealed class RelayHttpException : Exception
    {
        internal int StatusCode { get; private set; }
        internal string Detail { get; private set; }
        internal RelayHttpException(int statusCode, string detail, string operation)
            : base(operation + " HTTP " + statusCode + (string.IsNullOrWhiteSpace(detail) ? "" : " - " + detail))
        {
            StatusCode = statusCode;
            Detail = detail ?? "";
        }
    }

    internal sealed class AgentSession
    {
        public string IdToken;
        public string RefreshToken;
        public string UserId;
        public string AppUserId;
        public DateTime ExpiresUtc;
    }

    internal sealed class AgentForm : Form
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly TextBox _username = new TextBox();
        private readonly TextBox _password = new TextBox();
        private readonly Button _pair = new Button();
        private readonly Button _testOffice = new Button();
        private readonly Button _listen = new Button();
        private readonly Button _openLog = new Button();
        private readonly Label _relay = new Label();
        private readonly Label _network = new Label();
        private readonly Label _identity = new Label();
        private readonly ListBox _log = new ListBox();
        private readonly NotifyIcon _tray = new NotifyIcon();
        private readonly HashSet<string> _acked = new HashSet<string>(StringComparer.Ordinal);
        private readonly object _sessionLock = new object();
        private AgentSession _session;
        private CancellationTokenSource _listenCts;
        private bool _allowExit;

        private static readonly string SessionFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SUPRA Inventory", "RelayPoc", "session.bin");

        internal AgentForm()
        {
            Text = "SUPRA Inventory - Relay Test";
            Width = 680;
            Height = 510;
            MinimumSize = new Size(680, 510);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Segoe UI", 9F);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;

            Controls.Add(new Label { Left = 18, Top = 16, Width = 630, Height = 30, Text = "SUPRA INVENTORY - RELAY TEST AGENT", Font = new Font("Segoe UI", 14F, FontStyle.Bold) });
            _relay.SetBounds(18, 52, 630, 24); _relay.Text = "Relay: chưa kết nối"; Controls.Add(_relay);
            _network.SetBounds(18, 78, 630, 24); _network.Text = "Mạng: " + GetSsid(); Controls.Add(_network);
            _identity.SetBounds(18, 104, 630, 24); _identity.Text = "Agent: chưa ghép"; Controls.Add(_identity);

            Controls.Add(new Label { Left = 18, Top = 140, Width = 90, Text = "Tài khoản" });
            _username.SetBounds(110, 136, 180, 26); Controls.Add(_username);
            Controls.Add(new Label { Left = 305, Top = 140, Width = 70, Text = "Mật khẩu" });
            _password.SetBounds(375, 136, 160, 26); _password.UseSystemPasswordChar = true; Controls.Add(_password);
            _pair.SetBounds(545, 135, 105, 28); _pair.Text = "Ghép Agent"; _pair.Click += (s, e) => Task.Run(() => PairLogin()); Controls.Add(_pair);

            _testOffice.SetBounds(18, 176, 135, 32); _testOffice.Text = "Kiểm tra Office"; _testOffice.Enabled = false;
            _testOffice.Click += (s, e) => Task.Run(() => TestOffice()); Controls.Add(_testOffice);
            _listen.SetBounds(160, 176, 135, 32); _listen.Text = "Nghe relay"; _listen.Enabled = false;
            _listen.Click += (s, e) => { if (_listenCts == null) StartListening(); else StopListening(); }; Controls.Add(_listen);
            _openLog.SetBounds(302, 176, 105, 32); _openLog.Text = "Mở log";
            _openLog.Click += (s, e) => AgentDiagnostics.OpenLog(); Controls.Add(_openLog);
            Controls.Add(new Label { Left = 420, Top = 178, Width = 230, Height = 44, Text = "POC chỉ nhận 5 số và trả ACK. Không truy cập hoặc thao tác WMS.", ForeColor = Color.DimGray });

            _log.SetBounds(18, 225, 632, 220); Controls.Add(_log);

            var menu = new ContextMenuStrip();
            menu.Items.Add("Mở", null, (s, e) => RestoreFromTray());
            menu.Items.Add("Thoát", null, (s, e) => { _allowExit = true; Close(); });
            _tray.Text = "SUPRA Inventory Relay Test"; _tray.Icon = SystemIcons.Application; _tray.ContextMenuStrip = menu; _tray.Visible = true;
            _tray.DoubleClick += (s, e) => RestoreFromTray();

            Resize += (s, e) => { if (WindowState == FormWindowState.Minimized) { Hide(); _tray.ShowBalloonTip(1000, "SUPRA Inventory", "Relay Test Agent đang chạy nền.", ToolTipIcon.Info); } };
            FormClosing += (s, e) =>
            {
                if (!_allowExit && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; WindowState = FormWindowState.Minimized; Hide(); return; }
                StopListening(); _tray.Visible = false;
            };

            var timer = new System.Windows.Forms.Timer { Interval = 4000 };
            timer.Tick += (s, e) => _network.Text = "Mạng: " + GetSsid(); timer.Start();
            Shown += (s, e) => Task.Run(() => { LogNetworkSnapshot("startup"); RestoreSession(); });
        }

        private void RestoreFromTray() { Show(); WindowState = FormWindowState.Normal; Activate(); }

        private void RestoreSession()
        {
            try
            {
                var stored = LoadStoredSession();
                if (stored == null) return;
                lock (_sessionLock) _session = stored;
                RefreshDirect();
                Ui(() => { _identity.Text = "Agent: " + Environment.MachineName + " / " + CurrentSessionUser(); _listen.Enabled = true; _testOffice.Enabled = true; });
                Log("Khôi phục phiên đã ghép bằng Windows DPAPI.");
            }
            catch (Exception ex) { Log("Chưa thể khôi phục phiên: " + SafeMessage(ex)); }
        }

        private void PairLogin()
        {
            string username = "", password = "";
            UiSync(() => { username = _username.Text.Trim(); password = _password.Text; _pair.Enabled = false; });
            if (username.Length == 0 || password.Length == 0) { Log("Nhập tài khoản và mật khẩu khi laptop đang ở mạng truy cập được Cloudflare."); Ui(() => _pair.Enabled = true); return; }
            try
            {
                var payload = new Dictionary<string, object> { { "username", username }, { "password", password } };
                var root = Map(_json.DeserializeObject(RequestJson("POST", AgentConfig.ApiBaseUrl + "/api/auth/login", _json.Serialize(payload), "application/json")));
                var user = Map(root["user"]);
                var next = new AgentSession
                {
                    IdToken = Convert.ToString(root["id_token"]),
                    RefreshToken = Convert.ToString(root["refresh_token"]),
                    UserId = Convert.ToString(user["user_id"]),
                    ExpiresUtc = DateTime.UtcNow.AddSeconds(ParseInt(root, "expires_in", 3600) - 60)
                };
                if (string.IsNullOrWhiteSpace(next.IdToken) || string.IsNullOrWhiteSpace(next.RefreshToken) || string.IsNullOrWhiteSpace(next.UserId)) throw new InvalidOperationException("Phiên ghép không đầy đủ.");
                lock (_sessionLock) _session = next;
                SaveStoredSession(next);
                Ui(() => { _password.Clear(); _identity.Text = "Agent: " + Environment.MachineName + " / " + next.UserId; _listen.Enabled = true; _testOffice.Enabled = true; });
                Log("Ghép Agent thành công. Chuyển laptop sang Office rồi bấm Kiểm tra Office.");
            }
            catch (Exception ex) { Log("Ghép Agent thất bại: " + SafeMessage(ex)); }
            finally { Ui(() => _pair.Enabled = true); }
        }

        private void TestOffice()
        {
            Ui(() => { _testOffice.Enabled = false; _relay.Text = "Relay: đang kiểm tra Google..."; });
            try
            {
                RefreshDirect();
                var session = SnapshotSession();
                RequestJson("GET", JobsUrl(session) + "&shallow=true", null, null);
                Ui(() => _relay.Text = "Relay: OFFICE PASS / Google + RTDB");
                Log("OFFICE PASS: Google token refresh + RTDB đọc được trên " + GetSsid() + ".");
            }
            catch (Exception ex) { Ui(() => _relay.Text = "Relay: OFFICE FAIL"); Log("OFFICE FAIL: " + SafeMessage(ex)); }
            finally { Ui(() => _testOffice.Enabled = true); }
        }

        private void StartListening()
        {
            try { SnapshotSession(); } catch { Log("Chưa ghép Agent."); return; }
            if (_listenCts != null) return;
            _listenCts = new CancellationTokenSource();
            Ui(() => { _listen.Text = "Dừng nghe"; _relay.Text = "Relay: đang kết nối..."; });
            var token = _listenCts.Token;
            Task.Run(() => ListenLoop(token), token);
        }

        private void StopListening()
        {
            var cts = _listenCts; _listenCts = null;
            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (cts != null) cts.Dispose(); } catch { }
            Ui(() => { _listen.Text = "Nghe relay"; if (_allowExit) return; _relay.Text = "Relay: đã dừng"; });
        }

        private void ListenLoop(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try { EnsureFreshToken(); ListenOnce(token); }
                catch (OperationCanceledException) { return; }
                catch (Exception ex) { Log("Relay gián đoạn: " + SafeMessage(ex)); Ui(() => _relay.Text = "Relay: đang thử lại"); }
                if (token.WaitHandle.WaitOne(TimeSpan.FromSeconds(1))) return;
            }
        }

        private void ListenOnce(CancellationToken token)
        {
            var session = SnapshotSession();
            var req = (HttpWebRequest)WebRequest.Create(JobsUrl(session));
            req.Method = "GET"; req.Accept = "text/event-stream"; req.UserAgent = "SUPRA-Inventory-Relay-Test/1.0";
            req.Timeout = 10000; req.ReadWriteTimeout = 65000; req.KeepAlive = true;
            using (token.Register(() => { try { req.Abort(); } catch { } }))
            using (var response = (HttpWebResponse)req.GetResponse())
            using (var stream = response.GetResponseStream())
            using (var reader = new StreamReader(stream))
            {
                Ui(() => _relay.Text = "Relay: ONLINE / đang nghe");
                Log("Đã mở Firebase SSE trên " + GetSsid() + ".");
                var data = new StringBuilder();
                string line;
                while (!token.IsCancellationRequested && (line = reader.ReadLine()) != null)
                {
                    if (line.Length == 0) { if (data.Length > 0) { ProcessSse(data.ToString()); data.Clear(); } continue; }
                    if (line.StartsWith("data:", StringComparison.Ordinal)) data.Append(line.Substring(5).Trim());
                }
            }
        }

        private void ProcessSse(string raw)
        {
            Dictionary<string, object> envelope;
            try { envelope = Map(_json.DeserializeObject(raw)); } catch { return; }
            object pathObj, dataObj;
            if (!envelope.TryGetValue("path", out pathObj) || !envelope.TryGetValue("data", out dataObj) || dataObj == null) return;
            var path = Convert.ToString(pathObj) ?? "/";
            var data = dataObj as Dictionary<string, object>;
            if (data == null) return;
            if (path == "/" && !data.ContainsKey("status"))
            {
                foreach (var pair in data) { var job = pair.Value as Dictionary<string, object>; if (job != null) HandleJob(pair.Key, job); }
                return;
            }
            var jobId = path.Trim('/').Split('/')[0];
            if (jobId.Length == 0 && data.ContainsKey("request_id")) jobId = Convert.ToString(data["request_id"]) ?? "";
            if (jobId.Length > 0) HandleJob(jobId, data);
        }

        private void HandleJob(string jobId, Dictionary<string, object> job)
        {
            object statusObj, sourceObj;
            if (!job.TryGetValue("status", out statusObj) || !string.Equals(Convert.ToString(statusObj), "PENDING", StringComparison.OrdinalIgnoreCase)) return;
            if (job.TryGetValue("source", out sourceObj) && !string.Equals(Convert.ToString(sourceObj), "ANDROID_POC", StringComparison.Ordinal)) return;
            lock (_acked) { if (_acked.Contains(jobId)) return; _acked.Add(jobId); }
            var suffix = job.ContainsKey("suffix") ? Convert.ToString(job["suffix"]) : "";
            try
            {
                var patch = new Dictionary<string, object> { { "status", "ACK" }, { "agent_id", Environment.MachineName }, { "agent_network", GetSsid() }, { "agent_received_at_ms", NowMs() }, { "agent_ack_at_ms", NowMs() } };
                RequestJson("PATCH", JobUrl(SnapshotSession(), jobId), _json.Serialize(patch), "application/json");
                Log("ACK " + suffix + " / " + Short(jobId) + " / " + GetSsid());
            }
            catch (Exception ex) { lock (_acked) _acked.Remove(jobId); Log("ACK lỗi: " + SafeMessage(ex)); }
        }

        private void EnsureFreshToken() { var s = SnapshotSession(); if (s.ExpiresUtc <= DateTime.UtcNow.AddMinutes(2)) RefreshDirect(); }

        private void RefreshDirect()
        {
            var current = SnapshotSession();
            var form = "grant_type=refresh_token&refresh_token=" + Uri.EscapeDataString(current.RefreshToken);
            var url = "https://securetoken.googleapis.com/v1/token?key=" + Uri.EscapeDataString(AgentConfig.FirebaseApiKey);
            var root = Map(_json.DeserializeObject(RequestJson("POST", url, form, "application/x-www-form-urlencoded")));
            var next = new AgentSession
            {
                IdToken = Convert.ToString(root["id_token"]), RefreshToken = Convert.ToString(root["refresh_token"]),
                UserId = root.ContainsKey("user_id") ? Convert.ToString(root["user_id"]) : current.UserId,
                ExpiresUtc = DateTime.UtcNow.AddSeconds(ParseInt(root, "expires_in", 3600) - 60)
            };
            if (string.IsNullOrWhiteSpace(next.IdToken) || string.IsNullOrWhiteSpace(next.RefreshToken)) throw new InvalidOperationException("Google không trả phiên Firebase hợp lệ.");
            lock (_sessionLock) _session = next; SaveStoredSession(next);
        }

        private AgentSession SnapshotSession()
        {
            lock (_sessionLock)
            {
                if (_session == null) throw new InvalidOperationException("Chưa ghép Agent.");
                return new AgentSession { IdToken = _session.IdToken, RefreshToken = _session.RefreshToken, UserId = _session.UserId, ExpiresUtc = _session.ExpiresUtc };
            }
        }

        private string CurrentSessionUser() { lock (_sessionLock) return _session == null ? "chưa ghép" : _session.UserId; }
        private static string JobsUrl(AgentSession s) { return AgentConfig.DatabaseUrl.TrimEnd('/') + "/relay_poc/" + Uri.EscapeDataString(s.UserId) + "/jobs.json?auth=" + Uri.EscapeDataString(s.IdToken); }
        private static string JobUrl(AgentSession s, string id) { return AgentConfig.DatabaseUrl.TrimEnd('/') + "/relay_poc/" + Uri.EscapeDataString(s.UserId) + "/jobs/" + Uri.EscapeDataString(id) + ".json?auth=" + Uri.EscapeDataString(s.IdToken); }

        private static string RequestJson(string method, string url, string body, string contentType)
        {
            var req = (HttpWebRequest)WebRequest.Create(url); req.Method = method; req.Accept = "application/json"; req.UserAgent = "SUPRA-Inventory-Relay-Test/1.0"; req.Timeout = 10000; req.ReadWriteTimeout = 10000;
            if (!string.IsNullOrWhiteSpace(contentType)) req.ContentType = contentType;
            if (body != null) { if (string.IsNullOrWhiteSpace(req.ContentType)) req.ContentType = "application/json; charset=utf-8"; var bytes = Encoding.UTF8.GetBytes(body); req.ContentLength = bytes.Length; using (var output = req.GetRequestStream()) output.Write(bytes, 0, bytes.Length); }
            try { using (var response = (HttpWebResponse)req.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) return reader.ReadToEnd(); }
            catch (WebException ex)
            {
                var status = ex.Response is HttpWebResponse ? ((int)((HttpWebResponse)ex.Response).StatusCode).ToString() : ex.Status.ToString();
                throw new InvalidOperationException("HTTP " + status, ex);
            }
        }

        private void SaveStoredSession(AgentSession session)
        {
            var dir = Path.GetDirectoryName(SessionFile); if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            var payload = _json.Serialize(new Dictionary<string, object> { { "refresh_token", session.RefreshToken }, { "user_id", session.UserId } });
            File.WriteAllBytes(SessionFile, ProtectedData.Protect(Encoding.UTF8.GetBytes(payload), null, DataProtectionScope.CurrentUser));
        }

        private AgentSession LoadStoredSession()
        {
            if (!File.Exists(SessionFile)) return null;
            var raw = ProtectedData.Unprotect(File.ReadAllBytes(SessionFile), null, DataProtectionScope.CurrentUser);
            var map = Map(_json.DeserializeObject(Encoding.UTF8.GetString(raw)));
            return new AgentSession { RefreshToken = Convert.ToString(map["refresh_token"]), UserId = Convert.ToString(map["user_id"]), IdToken = "", ExpiresUtc = DateTime.MinValue };
        }

        private static string GetSsid()
        {
            try
            {
                var info = new ProcessStartInfo { FileName = "netsh", Arguments = "wlan show interfaces", UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true };
                using (var process = Process.Start(info))
                {
                    if (process == null) return "UNKNOWN";
                    var text = process.StandardOutput.ReadToEnd(); process.WaitForExit(3000);
                    foreach (var raw in text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None))
                    {
                        var line = raw.Trim();
                        if (line.StartsWith("SSID", StringComparison.OrdinalIgnoreCase) && !line.StartsWith("BSSID", StringComparison.OrdinalIgnoreCase))
                        {
                            var index = line.IndexOf(':'); if (index >= 0) { var value = line.Substring(index + 1).Trim(); if (value.Length > 0) return value; }
                        }
                    }
                }
            }
            catch { }
            return "UNKNOWN";
        }

        private static long NowMs() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
        private static string Short(string value) { return value == null ? "" : value.Substring(0, Math.Min(8, value.Length)); }
        private static int ParseInt(Dictionary<string, object> map, string key, int fallback) { object value; int parsed; return map.TryGetValue(key, out value) && int.TryParse(Convert.ToString(value), out parsed) ? parsed : fallback; }
        private static Dictionary<string, object> Map(object value) { var map = value as Dictionary<string, object>; if (map == null) throw new InvalidOperationException("JSON response không hợp lệ."); return map; }
        private static string SafeMessage(Exception ex) { var message = ex.Message ?? ex.GetType().Name; return message.Length > 180 ? message.Substring(0, 180) : message; }

        private void Log(string message) { Ui(() => { _log.Items.Insert(0, DateTime.Now.ToString("HH:mm:ss") + "  " + message); while (_log.Items.Count > 100) _log.Items.RemoveAt(_log.Items.Count - 1); }); }
        private void Ui(Action action) { if (IsDisposed) return; if (InvokeRequired) BeginInvoke(action); else action(); }
        private void UiSync(Action action) { if (IsDisposed) return; if (InvokeRequired) Invoke(action); else action(); }
    }
}
