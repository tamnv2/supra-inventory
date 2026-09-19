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
        private static readonly Regex SecretPattern = new Regex(@"(?i)(authorization|bearer|token|password|secret|private[_ -]?key|api[_ -]?key|cookie|refresh[_ -]?token|id[_ -]?token|apisid|sid|scid|usid|x-signature(?:-nonce)?)\s*[:=]\s*[^\s,;]+", RegexOptions.Compiled);
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
        public string Role;
        public string BaseRole;
        public DateTime ExpiresUtc;
    }

    internal sealed class TransportProbeResult
    {
        internal string Name;
        internal string Result;
        internal int StatusCode;
        internal long ElapsedMs;
        internal string RequestedHost;
        internal string FinalHost;
        internal string ContentType;

        internal string Summary()
        {
            return Name + "=" + Result +
                (StatusCode > 0 ? "(" + StatusCode + ")" : "") +
                (ElapsedMs >= 0 ? "/" + ElapsedMs + "ms" : "");
        }
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
        private readonly Button _probeAuth = new Button();
        private readonly Button _probeRtdb = new Button();
        private readonly Button _probeFirestore = new Button();
        private readonly Button _probeAppsScript = new Button();
        private readonly Button _probeSheets = new Button();
        private readonly Button _probeDrive = new Button();
        private readonly Button _probeAll = new Button();
        private readonly Button _wmsCapture = new Button();
        private readonly Button _wmsTest = new Button();
        private readonly Label _wmsStatus = new Label();
        private readonly Label _relay = new Label();
        private readonly Label _network = new Label();
        private readonly Label _identity = new Label();
        private readonly ListBox _log = new ListBox();
        private readonly NotifyIcon _tray = new NotifyIcon();
        private readonly ToolStripMenuItem _trayStatusItem = new ToolStripMenuItem();
        private readonly ToolStripMenuItem _trayOverlayVisibleItem = new ToolStripMenuItem();
        private readonly ToolStripMenuItem _trayOverlayLockItem = new ToolStripMenuItem();
        private readonly ToolStripMenuItem _trayOverlayOpacityMenu = new ToolStripMenuItem();
        private readonly SystemMonitor _systemMonitor = new SystemMonitor();
        private readonly System.Windows.Forms.Timer _trayMonitorTimer = new System.Windows.Forms.Timer();
        private readonly StatusOverlayForm _statusOverlay;
        private readonly HashSet<string> _acked = new HashSet<string>(StringComparer.Ordinal);
        private readonly object _sessionLock = new object();
        private readonly object _wmsSessionLock = new object();
        private AgentSession _session;
        private WmsSessionSnapshot _wmsSession;
        private CancellationTokenSource _listenCts;
        private bool _allowExit;
        private bool _updateCheckRunning;
        private readonly string _agentInstanceId;
        private readonly System.Windows.Forms.Timer _updateTimer = new System.Windows.Forms.Timer();

        private static readonly string RelayDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SUPRA Inventory", "RelayPoc");
        private static readonly string SessionFile = Path.Combine(RelayDataDir, "session.bin");
        private static readonly string AgentInstanceFile = Path.Combine(RelayDataDir, "agent-instance-id.txt");
        private static readonly string OverlaySettingsFile = Path.Combine(RelayDataDir, "overlay-settings.json");

        internal AgentForm()
        {
            _agentInstanceId = LoadOrCreateAgentInstanceId();
            var overlaySettings = StatusOverlayForm.LoadSettings(OverlaySettingsFile);
            _statusOverlay = new StatusOverlayForm(overlaySettings, OverlaySettingsFile);
            _statusOverlay.SettingsChanged += RefreshOverlayMenu;
            Text = "SUPRA Inventory - Relay Test v" + AgentConfig.AgentBuild;
            Width = 780;
            Height = 680;
            MinimumSize = new Size(780, 680);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Segoe UI", 9F);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;

            Controls.Add(new Label { Left = 18, Top = 16, Width = 726, Height = 30, Text = "SUPRA INVENTORY - RELAY TEST AGENT", Font = new Font("Segoe UI", 14F, FontStyle.Bold) });
            _relay.SetBounds(18, 52, 726, 24); _relay.Text = "Relay: chưa kết nối"; Controls.Add(_relay);
            _network.SetBounds(18, 78, 726, 24); _network.Text = "Mạng: " + GetSsid(); Controls.Add(_network);
            _identity.SetBounds(18, 104, 726, 24); _identity.Text = "Agent: chưa ghép"; Controls.Add(_identity);

            Controls.Add(new Label { Left = 18, Top = 140, Width = 90, Text = "ADMIN" });
            _username.SetBounds(110, 136, 180, 26); Controls.Add(_username);
            Controls.Add(new Label { Left = 305, Top = 140, Width = 70, Text = "Mật khẩu" });
            _password.SetBounds(375, 136, 160, 26); _password.UseSystemPasswordChar = true; Controls.Add(_password);
            _pair.SetBounds(545, 135, 105, 28); _pair.Text = "Đăng nhập"; _pair.Click += (s, e) => Task.Run(() => PairLogin()); Controls.Add(_pair);

            _testOffice.SetBounds(18, 176, 135, 32); _testOffice.Text = "Kiểm tra Office"; _testOffice.Enabled = false;
            _testOffice.Click += (s, e) => Task.Run(() => TestOffice()); Controls.Add(_testOffice);
            _listen.SetBounds(160, 176, 135, 32); _listen.Text = "Nghe relay"; _listen.Enabled = false;
            _listen.Click += (s, e) => { if (_listenCts == null) StartListening(); else StopListening(); }; Controls.Add(_listen);
            _openLog.SetBounds(302, 176, 105, 32); _openLog.Text = "Mở log";
            _openLog.Click += (s, e) => AgentDiagnostics.OpenLog(); Controls.Add(_openLog);
            Controls.Add(new Label { Left = 420, Top = 178, Width = 324, Height = 38, Text = "POC chỉ test truyền nhận. Không truy cập hoặc thao tác WMS.", ForeColor = Color.DimGray });

            Controls.Add(new Label { Left = 18, Top = 220, Width = 726, Height = 20, Text = "Probe transport Office — chỉ GET/read-only, không tạo dữ liệu:", ForeColor = Color.DimGray });

            _probeAuth.SetBounds(18, 242, 92, 32); _probeAuth.Text = "Auth";
            _probeAuth.Click += (s, e) => Task.Run(() => ProbeFirebaseAuth()); Controls.Add(_probeAuth);

            _probeRtdb.SetBounds(116, 242, 92, 32); _probeRtdb.Text = "RTDB";
            _probeRtdb.Click += (s, e) => Task.Run(() => ProbeRtdb()); Controls.Add(_probeRtdb);

            _probeFirestore.SetBounds(214, 242, 100, 32); _probeFirestore.Text = "Firestore";
            _probeFirestore.Click += (s, e) => Task.Run(() => ProbeFirestore()); Controls.Add(_probeFirestore);

            _probeAppsScript.SetBounds(320, 242, 100, 32); _probeAppsScript.Text = "Apps Script";
            _probeAppsScript.Click += (s, e) => Task.Run(() => ProbeAppsScript()); Controls.Add(_probeAppsScript);

            _probeSheets.SetBounds(426, 242, 92, 32); _probeSheets.Text = "Sheets";
            _probeSheets.Click += (s, e) => Task.Run(() => ProbeSheets()); Controls.Add(_probeSheets);

            _probeDrive.SetBounds(524, 242, 92, 32); _probeDrive.Text = "Drive";
            _probeDrive.Click += (s, e) => Task.Run(() => ProbeDrive()); Controls.Add(_probeDrive);

            _probeAll.SetBounds(622, 242, 122, 32); _probeAll.Text = "TEST TẤT CẢ";
            _probeAll.Click += (s, e) => Task.Run(() => ProbeAllTransports()); Controls.Add(_probeAll);

            Controls.Add(new Label { Left = 18, Top = 286, Width = 726, Height = 20, Text = "Supra WMS — tự lấy phiên từ Edge/Chrome riêng, chỉ kiểm tra kết nối đọc:", ForeColor = Color.DimGray });
            _wmsCapture.SetBounds(18, 308, 172, 32); _wmsCapture.Text = "Mở WMS + lấy phiên";
            _wmsCapture.Click += (s, e) => Task.Run(() => CaptureWmsSession()); Controls.Add(_wmsCapture);
            _wmsTest.SetBounds(198, 308, 142, 32); _wmsTest.Text = "TEST SUPRA";
            _wmsTest.Click += (s, e) => Task.Run(() => TestWmsConnection()); Controls.Add(_wmsTest);
            _wmsStatus.SetBounds(350, 311, 394, 28); _wmsStatus.Text = "WMS: chưa kiểm tra"; Controls.Add(_wmsStatus);
            SetProbeButtonsEnabled(false);

            _log.SetBounds(18, 356, 726, 255); Controls.Add(_log);

            var menu = new ContextMenuStrip();
            _trayStatusItem.Enabled = false;
            _trayStatusItem.Text = "Máy: đang đọc...";
            menu.Items.Add(_trayStatusItem);
            menu.Items.Add(new ToolStripSeparator());

            _trayOverlayVisibleItem.Text = "Hiển thị bảng nổi";
            _trayOverlayVisibleItem.CheckOnClick = false;
            _trayOverlayVisibleItem.Click += (s, e) =>
            {
                _statusOverlay.SetOverlayVisible(!_statusOverlay.OverlayVisible);
                RefreshOverlayMenu();
            };
            menu.Items.Add(_trayOverlayVisibleItem);

            _trayOverlayLockItem.Text = "Khóa vị trí / xuyên chuột";
            _trayOverlayLockItem.CheckOnClick = false;
            _trayOverlayLockItem.Click += (s, e) =>
            {
                _statusOverlay.SetLocked(!_statusOverlay.IsLocked);
                RefreshOverlayMenu();
            };
            menu.Items.Add(_trayOverlayLockItem);

            _trayOverlayOpacityMenu.Text = "Độ trong bảng nổi";
            foreach (var item in new[] { 0.40, 0.60, 0.80, 1.00 })
            {
                var opacity = item;
                var opacityItem = new ToolStripMenuItem(((int)(opacity * 100)).ToString() + "%");
                opacityItem.Tag = opacity;
                opacityItem.Click += (s, e) =>
                {
                    _statusOverlay.SetOverlayOpacity(opacity);
                    RefreshOverlayMenu();
                };
                _trayOverlayOpacityMenu.DropDownItems.Add(opacityItem);
            }
            menu.Items.Add(_trayOverlayOpacityMenu);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Mở Agent", null, (s, e) => RestoreFromTray());
            menu.Items.Add("Mở log", null, (s, e) => AgentDiagnostics.OpenLog());
            menu.Items.Add("Thoát", null, (s, e) => { _allowExit = true; Close(); });
            _tray.Text = "SUPRA | đang đọc tài nguyên máy"; _tray.Icon = SystemIcons.Application; _tray.ContextMenuStrip = menu; _tray.Visible = true;
            RefreshOverlayMenu();
            _tray.DoubleClick += (s, e) => RestoreFromTray();

            Resize += (s, e) => { if (WindowState == FormWindowState.Minimized) { Hide(); _tray.ShowBalloonTip(1000, "SUPRA Inventory", "Relay Test Agent đang chạy nền.", ToolTipIcon.Info); } };
            FormClosing += (s, e) =>
            {
                if (!_allowExit && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; WindowState = FormWindowState.Minimized; Hide(); return; }
                StopListening(); _trayMonitorTimer.Stop(); try { _statusOverlay.Close(); } catch { } _tray.Visible = false;
            };

            var timer = new System.Windows.Forms.Timer { Interval = 4000 };
            timer.Tick += (s, e) => _network.Text = "Mạng: " + GetSsid();
            timer.Start();

            _trayMonitorTimer.Interval = 2000;
            _trayMonitorTimer.Tick += (s, e) => UpdateTrayMonitor();
            _trayMonitorTimer.Start();
            UpdateTrayMonitor();

            _updateTimer.Interval = 4 * 60 * 60 * 1000;
            _updateTimer.Tick += (s, e) => Task.Run(() => TryAutoUpdate(false));
            _updateTimer.Start();

            Shown += (s, e) =>
            {
                if (_statusOverlay.OverlayVisible && !_statusOverlay.Visible) _statusOverlay.Show();
                Task.Run(() => StartupSequence());
            };
        }

        private void RestoreFromTray() { Show(); WindowState = FormWindowState.Normal; Activate(); }

        private void UpdateTrayMonitor()
        {
            try
            {
                var metrics = _systemMonitor.Sample();
                var compact = metrics.Compact();
                if (compact.Length > 63) compact = compact.Substring(0, 63);
                _tray.Text = compact;
                _trayStatusItem.Text = metrics.MenuText();
                _statusOverlay.UpdateText(metrics.Compact());
            }
            catch
            {
                _tray.Text = "SUPRA Agent";
                _trayStatusItem.Text = "Máy: chưa đọc được tài nguyên";
                _statusOverlay.UpdateText("SUPRA | chưa đọc được tài nguyên máy");
            }
        }

        private void RefreshOverlayMenu()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RefreshOverlayMenu));
                return;
            }
            _trayOverlayVisibleItem.Checked = _statusOverlay.OverlayVisible;
            _trayOverlayLockItem.Checked = _statusOverlay.IsLocked;
            foreach (ToolStripItem item in _trayOverlayOpacityMenu.DropDownItems)
            {
                var menuItem = item as ToolStripMenuItem;
                if (menuItem == null || !(menuItem.Tag is double)) continue;
                var value = (double)menuItem.Tag;
                menuItem.Checked = Math.Abs(value - _statusOverlay.OverlayOpacity) < 0.02;
            }
        }

        private void SetProbeButtonsEnabled(bool enabled)
        {
            Ui(() =>
            {
                _probeAuth.Enabled = enabled;
                _probeRtdb.Enabled = enabled;
                _probeFirestore.Enabled = enabled;
                _probeAppsScript.Enabled = enabled;
                _probeSheets.Enabled = enabled;
                _probeDrive.Enabled = enabled;
                _probeAll.Enabled = enabled;
                var hasWmsSession = HasUsableWmsSession();
                _wmsCapture.Enabled = enabled && !hasWmsSession;
                _wmsCapture.Text = hasWmsSession ? "Phiên WMS đang OK" : "Mở WMS + lấy phiên";
                _wmsTest.Enabled = enabled;
            });
        }

        private bool HasUsableWmsSession()
        {
            lock (_wmsSessionLock)
                return _wmsSession != null && _wmsSession.IsValidHy1();
        }

        private void StartupSequence()
        {
            LogNetworkSnapshot("startup");
            if (TryAutoUpdate(true)) return;
            RestoreSession();
        }

        private bool TryAutoUpdate(bool startup)
        {
            lock (_sessionLock)
            {
                if (_updateCheckRunning) return false;
                _updateCheckRunning = true;
            }

            try
            {
                if (startup) Log("UPDATE kiểm tra Agent prerelease v" + AgentConfig.AgentBuild + ".");
                var result = AgentUpdater.CheckAndInstallIfNeeded();
                if (result.InstallStarted)
                {
                    Log(result.Message);
                    Ui(() =>
                    {
                        _relay.Text = "Update: đang cài v" + result.LatestBuild;
                        _allowExit = true;
                        Close();
                    });
                    return true;
                }
                if (!startup) Log("UPDATE " + result.Message);
                return false;
            }
            catch (Exception ex)
            {
                Log("UPDATE chưa thể kiểm tra/cài tự động: " + SafeMessage(ex));
                return false;
            }
            finally
            {
                lock (_sessionLock) _updateCheckRunning = false;
            }
        }

        private void RestoreSession()
        {
            try
            {
                var stored = LoadStoredSession();
                if (stored == null)
                {
                    Log("Chưa có phiên ADMIN Agent đã lưu trên Windows user này.");
                    return;
                }
                lock (_sessionLock) _session = stored;
                Log("Đã đọc phiên Agent từ Windows DPAPI; đang xác minh lại quyền ADMIN qua Firebase.");
                RefreshDirect();
                Ui(() =>
                {
                    _identity.Text = "Agent: " + Environment.MachineName + " / " + CurrentSessionUser();
                    _listen.Enabled = true;
                    _testOffice.Enabled = true;
                });
                SetProbeButtonsEnabled(true);
                Log("Khôi phục ADMIN Agent PASS.");
            }
            catch (Exception ex)
            {
                ClearStoredSession();
                lock (_sessionLock) _session = null;
                Ui(() =>
                {
                    _identity.Text = "Agent: cần đăng nhập ADMIN";
                    _listen.Enabled = false;
                    _testOffice.Enabled = false;
                });
                SetProbeButtonsEnabled(false);
                Log("Phiên Agent cũ bị loại; cần đăng nhập lại bằng ADMIN: " + SafeMessage(ex));
            }
        }

        private void PairLogin()
        {
            string username = "", password = "";
            UiSync(() =>
            {
                username = _username.Text.Trim();
                password = _password.Text;
                _password.Clear();
                _pair.Enabled = false;
            });
            if (username.Length == 0 || password.Length == 0)
            {
                Log("Nhập tài khoản ADMIN và mật khẩu khi laptop đang ở mạng truy cập được Cloudflare.");
                Ui(() => _pair.Enabled = true);
                return;
            }

            try
            {
                LogNetworkSnapshot("admin-login");
                var payload = new Dictionary<string, object> { { "username", username }, { "password", password } };
                var root = Map(_json.DeserializeObject(RequestJson("POST", AgentConfig.ApiBaseUrl + "/api/auth/login", _json.Serialize(payload), "application/json")));
                var user = Map(root["user"]);
                var role = user.ContainsKey("role") ? Convert.ToString(user["role"]) : "";
                var baseRole = user.ContainsKey("base_role") ? Convert.ToString(user["base_role"]) : "";
                var appUserId = user.ContainsKey("user_id") ? Convert.ToString(user["user_id"]) : "";
                if (!string.Equals(role, "ADMIN", StringComparison.Ordinal) ||
                    !string.Equals(baseRole, "ADMIN", StringComparison.Ordinal))
                    throw new InvalidOperationException("EXE chỉ cho phép tài khoản ADMIN thực. ROOT/REPORTER/PICKER không được dùng.");

                var idToken = Convert.ToString(root["id_token"]);
                var refreshToken = Convert.ToString(root["refresh_token"]);
                var firebaseUid = FirebaseUidFromIdToken(idToken);
                var audience = FirebaseAudienceFromIdToken(idToken);
                var tokenRole = FirebaseClaimFromIdToken(idToken, "app_role");
                var tokenBaseRole = FirebaseClaimFromIdToken(idToken, "app_base_role");
                var tokenAppUser = FirebaseClaimFromIdToken(idToken, "app_user_id");
                if (!string.Equals(audience, AgentConfig.FirebaseProjectId, StringComparison.Ordinal))
                    throw new InvalidOperationException("Firebase token sai project audience.");
                if (!string.Equals(tokenRole, "ADMIN", StringComparison.Ordinal) ||
                    !string.Equals(tokenBaseRole, "ADMIN", StringComparison.Ordinal) ||
                    !string.Equals(tokenAppUser, appUserId, StringComparison.Ordinal))
                    throw new InvalidOperationException("Firebase ADMIN claims chưa đồng bộ; cần build/deploy D075 trước khi ghép Agent.");

                var next = new AgentSession
                {
                    IdToken = idToken,
                    RefreshToken = refreshToken,
                    UserId = firebaseUid,
                    AppUserId = appUserId,
                    Role = tokenRole,
                    BaseRole = tokenBaseRole,
                    ExpiresUtc = DateTime.UtcNow.AddSeconds(ParseInt(root, "expires_in", 3600) - 60)
                };
                if (string.IsNullOrWhiteSpace(next.IdToken) || string.IsNullOrWhiteSpace(next.RefreshToken) ||
                    string.IsNullOrWhiteSpace(next.UserId) || string.IsNullOrWhiteSpace(next.AppUserId))
                    throw new InvalidOperationException("Phiên ADMIN Agent không đầy đủ.");

                lock (_sessionLock) _session = next;
                SaveStoredSession(next);
                Ui(() =>
                {
                    _password.Clear();
                    _identity.Text = "Agent: " + Environment.MachineName + " / " + CurrentSessionUser();
                    _listen.Enabled = true;
                    _testOffice.Enabled = true;
                });
                SetProbeButtonsEnabled(true);
                Log(
                    "ADMIN Agent login PASS admin=" + next.AppUserId +
                    " machine=" + Environment.MachineName +
                    " instance=" + Short(_agentInstanceId) +
                    " firebase_uid=" + Fingerprint(next.UserId) +
                    " aud=" + audience
                );
            }
            catch (Exception ex)
            {
                Log("Đăng nhập ADMIN Agent thất bại: " + SafeMessage(ex));
            }
            finally
            {
                Ui(() => _pair.Enabled = true);
            }
        }

        private void ProbeFirebaseAuth()
        {
            SetProbeButtonsEnabled(false);
            try
            {
                LogNetworkSnapshot("probe-auth");
                var started = Stopwatch.StartNew();
                RefreshDirect();
                started.Stop();
                var result = new TransportProbeResult
                {
                    Name = "AUTH",
                    Result = "PASS",
                    StatusCode = 200,
                    ElapsedMs = started.ElapsedMilliseconds,
                    RequestedHost = "securetoken.googleapis.com",
                    FinalHost = "securetoken.googleapis.com",
                    ContentType = "application/json"
                };
                LogProbeResult(result);
                Ui(() => _relay.Text = "Probe Auth: PASS");
            }
            catch (Exception ex)
            {
                Log("PROBE AUTH result=TRANSPORT_FAIL detail=" + SafeMessage(ex));
                Ui(() => _relay.Text = "Probe Auth: FAIL");
            }
            finally
            {
                SetProbeButtonsEnabled(true);
            }
        }

        private void ProbeRtdb()
        {
            RunSingleProbe("RTDB", () =>
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                return ProbeHttp("RTDB", JobsUrl(session) + "&shallow=true", null);
            });
        }

        private void ProbeFirestore()
        {
            RunSingleProbe("FIRESTORE", () =>
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                return ProbeHttp("FIRESTORE", AgentConfig.FirestoreProbeUrl, session.IdToken);
            });
        }

        private void ProbeAppsScript()
        {
            SetProbeButtonsEnabled(false);
            try
            {
                LogNetworkSnapshot("probe-apps-script");
                var web = ProbeHttp("APPS_WEB", AgentConfig.AppsScriptWebProbeUrl, null);
                var api = ProbeHttp("APPS_API", AgentConfig.AppsScriptApiProbeUrl, null);
                LogProbeResult(web);
                LogProbeResult(api);
                Ui(() => _relay.Text = "Probe Apps Script: " + web.Result + " / " + api.Result);
            }
            catch (Exception ex)
            {
                Log("PROBE APPS_SCRIPT result=TRANSPORT_FAIL detail=" + SafeMessage(ex));
                Ui(() => _relay.Text = "Probe Apps Script: FAIL");
            }
            finally
            {
                SetProbeButtonsEnabled(true);
            }
        }

        private void ProbeSheets()
        {
            RunSingleProbe("SHEETS", () => ProbeHttp("SHEETS", AgentConfig.SheetsProbeUrl, null));
        }

        private void ProbeDrive()
        {
            RunSingleProbe("DRIVE", () => ProbeHttp("DRIVE", AgentConfig.DriveProbeUrl, null));
        }

        private void ProbeAllTransports()
        {
            SetProbeButtonsEnabled(false);
            var results = new List<TransportProbeResult>();
            try
            {
                LogNetworkSnapshot("probe-all");
                Log("PROBE ALL START ssid=" + GetSsid());

                try
                {
                    var started = Stopwatch.StartNew();
                    RefreshDirect();
                    started.Stop();
                    results.Add(new TransportProbeResult
                    {
                        Name = "AUTH",
                        Result = "PASS",
                        StatusCode = 200,
                        ElapsedMs = started.ElapsedMilliseconds,
                        RequestedHost = "securetoken.googleapis.com",
                        FinalHost = "securetoken.googleapis.com",
                        ContentType = "application/json"
                    });
                }
                catch (Exception ex)
                {
                    Log("PROBE AUTH result=TRANSPORT_FAIL detail=" + SafeMessage(ex));
                    results.Add(new TransportProbeResult
                    {
                        Name = "AUTH",
                        Result = "TRANSPORT_FAIL",
                        StatusCode = 0,
                        ElapsedMs = -1,
                        RequestedHost = "securetoken.googleapis.com",
                        FinalHost = "",
                        ContentType = ""
                    });
                }

                AgentSession session = null;
                try { session = SnapshotSession(); } catch { }

                if (session != null)
                {
                    results.Add(ProbeHttp("RTDB", JobsUrl(session) + "&shallow=true", null));
                    results.Add(ProbeHttp("FIRESTORE", AgentConfig.FirestoreProbeUrl, session.IdToken));
                }
                else
                {
                    results.Add(new TransportProbeResult { Name = "RTDB", Result = "NO_SESSION", ElapsedMs = -1 });
                    results.Add(new TransportProbeResult { Name = "FIRESTORE", Result = "NO_SESSION", ElapsedMs = -1 });
                }

                results.Add(ProbeHttp("APPS_WEB", AgentConfig.AppsScriptWebProbeUrl, null));
                results.Add(ProbeHttp("APPS_API", AgentConfig.AppsScriptApiProbeUrl, null));
                results.Add(ProbeHttp("SHEETS", AgentConfig.SheetsProbeUrl, null));
                results.Add(ProbeHttp("DRIVE", AgentConfig.DriveProbeUrl, null));

                foreach (var result in results) LogProbeResult(result);
                Log("PROBE SUMMARY ssid=" + GetSsid() + " " + string.Join(" | ", results.ConvertAll(x => x.Summary()).ToArray()));
                Ui(() => _relay.Text = "Probe xong · xem log");
            }
            catch (Exception ex)
            {
                Log("PROBE ALL unexpected_fail detail=" + SafeMessage(ex));
                Ui(() => _relay.Text = "Probe: lỗi · xem log");
            }
            finally
            {
                SetProbeButtonsEnabled(true);
            }
        }

        private void RunSingleProbe(string label, Func<TransportProbeResult> action)
        {
            SetProbeButtonsEnabled(false);
            try
            {
                LogNetworkSnapshot("probe-" + label.ToLowerInvariant());
                var result = action();
                LogProbeResult(result);
                Ui(() => _relay.Text = "Probe " + label + ": " + result.Result);
            }
            catch (Exception ex)
            {
                Log("PROBE " + label + " result=TRANSPORT_FAIL detail=" + SafeMessage(ex));
                Ui(() => _relay.Text = "Probe " + label + ": FAIL");
            }
            finally
            {
                SetProbeButtonsEnabled(true);
            }
        }

        private TransportProbeResult ProbeHttp(string name, string url, string bearerToken)
        {
            var started = Stopwatch.StartNew();
            var requested = new Uri(url);
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "GET";
            req.Accept = "application/json,text/plain,text/html;q=0.8,*/*;q=0.5";
            req.UserAgent = "SUPRA-Inventory-Relay-Test/1.3";
            req.Timeout = 10000;
            req.ReadWriteTimeout = 10000;
            req.AllowAutoRedirect = true;
            req.KeepAlive = false;
            if (!string.IsNullOrWhiteSpace(bearerToken))
                req.Headers[HttpRequestHeader.Authorization] = "Bearer " + bearerToken;

            try
            {
                using (var response = (HttpWebResponse)req.GetResponse())
                {
                    var sample = ReadProbeSample(response.GetResponseStream());
                    started.Stop();
                    return BuildProbeResult(
                        name,
                        (int)response.StatusCode,
                        started.ElapsedMilliseconds,
                        requested.Host,
                        response.ResponseUri == null ? "" : response.ResponseUri.Host,
                        response.ContentType,
                        sample,
                        null
                    );
                }
            }
            catch (WebException ex)
            {
                started.Stop();
                var response = ex.Response as HttpWebResponse;
                if (response == null)
                {
                    return new TransportProbeResult
                    {
                        Name = name,
                        Result = "TRANSPORT_FAIL",
                        StatusCode = 0,
                        ElapsedMs = started.ElapsedMilliseconds,
                        RequestedHost = requested.Host,
                        FinalHost = "",
                        ContentType = ""
                    };
                }

                var status = (int)response.StatusCode;
                var finalHost = response.ResponseUri == null ? "" : response.ResponseUri.Host;
                var contentType = response.ContentType ?? "";
                var sample = "";
                try
                {
                    using (response)
                        sample = ReadProbeSample(response.GetResponseStream());
                }
                catch { }

                return BuildProbeResult(
                    name,
                    status,
                    started.ElapsedMilliseconds,
                    requested.Host,
                    finalHost,
                    contentType,
                    sample,
                    ex.Status.ToString()
                );
            }
        }

        private TransportProbeResult BuildProbeResult(
            string name,
            int statusCode,
            long elapsedMs,
            string requestedHost,
            string finalHost,
            string contentType,
            string bodySample,
            string transportStatus)
        {
            var result = "HTTP_ERROR";
            if (LooksLikeCorporateProxyBlock(bodySample))
                result = "PROXY_BLOCK";
            else if (statusCode >= 200 && statusCode < 400)
                result = "PASS";
            else if (statusCode == 401)
                result = "AUTH_REQUIRED";
            else if (IsGoogleHost(requestedHost) || IsGoogleHost(finalHost))
                result = "GOOGLE_REACHABLE";
            else if (!string.IsNullOrWhiteSpace(transportStatus))
                result = "HTTP_ERROR";

            var probe = new TransportProbeResult
            {
                Name = name,
                Result = result,
                StatusCode = statusCode,
                ElapsedMs = elapsedMs,
                RequestedHost = requestedHost ?? "",
                FinalHost = finalHost ?? "",
                ContentType = contentType ?? ""
            };

            if (result == "PROXY_BLOCK")
            {
                AgentDiagnostics.Write(
                    "PROBE PROXY_BLOCK name=" + name +
                    " category=" + ProxyCategory(bodySample) +
                    " rule=" + ProxyRule(bodySample));
            }
            return probe;
        }

        private void LogProbeResult(TransportProbeResult result)
        {
            if (result == null) return;
            Log(
                "PROBE " + result.Name +
                " result=" + result.Result +
                " http=" + result.StatusCode +
                " requested_host=" + (result.RequestedHost ?? "") +
                " final_host=" + (result.FinalHost ?? "") +
                " content_type=" + SafeProbeToken(result.ContentType) +
                " ms=" + result.ElapsedMs
            );
        }

        private static string ReadProbeSample(Stream stream)
        {
            if (stream == null) return "";
            try
            {
                using (var reader = new StreamReader(stream))
                {
                    var buffer = new char[8192];
                    var read = reader.ReadBlock(buffer, 0, buffer.Length);
                    return read <= 0 ? "" : new string(buffer, 0, read);
                }
            }
            catch
            {
                return "";
            }
        }

        private static bool LooksLikeCorporateProxyBlock(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return false;
            return body.IndexOf("Cảnh báo truy cập Website", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   body.IndexOf("URLBlocked.html", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   body.IndexOf("/mwg-internal/", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   body.IndexOf("Block All Other connect form Store", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string ProxyCategory(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return "unknown";
            if (body.IndexOf("Software/Hardware", StringComparison.OrdinalIgnoreCase) >= 0) return "Software/Hardware";
            return "unknown";
        }

        private static string ProxyRule(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return "unknown";
            if (body.IndexOf("Block All Other connect form Store", StringComparison.OrdinalIgnoreCase) >= 0)
                return "Block_All_Other_connect_form_Store";
            return "unknown";
        }

        private static bool IsGoogleHost(string host)
        {
            if (string.IsNullOrWhiteSpace(host)) return false;
            var value = host.Trim().ToLowerInvariant();
            return value == "google.com" ||
                   value.EndsWith(".google.com", StringComparison.Ordinal) ||
                   value == "googleapis.com" ||
                   value.EndsWith(".googleapis.com", StringComparison.Ordinal) ||
                   value == "googleusercontent.com" ||
                   value.EndsWith(".googleusercontent.com", StringComparison.Ordinal);
        }

        private static string SafeProbeToken(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            return Regex.Replace(value, "[^A-Za-z0-9._+;=/-]", "_").Substring(0, Math.Min(96, value.Length));
        }

        private WmsSessionSnapshot SnapshotWmsSession()
        {
            lock (_wmsSessionLock)
                return _wmsSession;
        }

        private void CaptureWmsSession()
        {
            if (HasUsableWmsSession())
            {
                Ui(() => _wmsStatus.Text = "WMS: phiên HY1 đang OK · không mở lại login");
                Log("WMS SESSION REUSE valid_in_ram=true browser_login_skipped=true values=redacted.");
                SetProbeButtonsEnabled(true);
                return;
            }

            SetProbeButtonsEnabled(false);
            Ui(() => _wmsStatus.Text = "WMS: đang mở trình duyệt / chờ phiên...");
            try
            {
                LogNetworkSnapshot("wms-session-capture");
                var captured = WmsBrowserCapture.CaptureSession(300, message => Log("WMS " + message));
                lock (_wmsSessionLock) _wmsSession = captured;
                Ui(() => _wmsStatus.Text = "WMS: phiên HY1 đã lấy tự động");
                Log("WMS SESSION PASS scope=HY1 storage=RAM_ONLY values=redacted.");
            }
            catch (Exception ex)
            {
                lock (_wmsSessionLock) _wmsSession = null;
                Ui(() => _wmsStatus.Text = "WMS: chưa lấy được phiên");
                Log("WMS SESSION FAIL " + SafeMessage(ex));
            }
            finally
            {
                SetProbeButtonsEnabled(true);
            }
        }

        private void TestWmsConnection()
        {
            SetProbeButtonsEnabled(false);
            Ui(() => _wmsStatus.Text = "WMS: đang kiểm tra kết nối...");
            try
            {
                LogNetworkSnapshot("wms-readonly-test");
                var ui = WmsReadOnlyClient.ProbeUi();
                Log("WMS PROBE " + ui.Summary());

                if (string.Equals(ui.Result, "TRANSPORT_FAIL", StringComparison.Ordinal) ||
                    string.Equals(ui.Result, "PROXY_AUTH_REQUIRED", StringComparison.Ordinal) ||
                    string.Equals(ui.Result, "PROXY_BLOCK", StringComparison.Ordinal))
                {
                    Ui(() => _wmsStatus.Text = "WMS UI: " + ui.Result + " · " + ui.Route);
                    return;
                }

                var session = SnapshotWmsSession();
                if (session == null || !session.IsValidHy1())
                {
                    Log("WMS chưa có phiên HY1 trong RAM; tự mở trình duyệt để lấy phiên.");
                    session = WmsBrowserCapture.CaptureSession(300, message => Log("WMS " + message));
                    lock (_wmsSessionLock) _wmsSession = session;
                }

                var api = WmsReadOnlyClient.ProbeApi(session);
                Log("WMS PROBE " + api.Summary());

                if (string.Equals(api.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                {
                    Log("WMS phiên cũ hết hạn; tự mở trình duyệt để lấy phiên mới một lần.");
                    var refreshed = WmsBrowserCapture.CaptureSession(300, message => Log("WMS " + message));
                    lock (_wmsSessionLock) _wmsSession = refreshed;
                    api = WmsReadOnlyClient.ProbeApi(refreshed);
                    Log("WMS PROBE RETRY " + api.Summary());
                }

                if (string.Equals(api.Result, "PASS", StringComparison.Ordinal))
                {
                    Ui(() => _wmsStatus.Text = "WMS: PASS · API HY1 · " + api.Route + " · " + api.ElapsedMs + "ms");
                    Log("WMS READ_ONLY PASS ui=" + ui.Result + " api=PASS route=" + api.Route + " no_mutation=true.");
                }
                else
                {
                    Ui(() => _wmsStatus.Text = "WMS API: " + api.Result + " · HTTP " + api.StatusCode);
                    Log("WMS READ_ONLY FAIL api=" + api.Result + " http=" + api.StatusCode + " route=" + api.Route + ".");
                }
            }
            catch (Exception ex)
            {
                Ui(() => _wmsStatus.Text = "WMS: lỗi · xem log");
                Log("WMS TEST FAIL " + SafeMessage(ex));
            }
            finally
            {
                SetProbeButtonsEnabled(true);
            }
        }

        private void TestOffice()
        {
            Ui(() =>
            {
                _testOffice.Enabled = false;
                _relay.Text = "Relay: đang kiểm tra Google...";
            });
            LogNetworkSnapshot("office-check");

            try
            {
                RefreshDirect();
                Ui(() => _relay.Text = "Relay: Google OK · đang kiểm tra RTDB...");
                var session = SnapshotSession();
                var result = ProbeHttp("RTDB", JobsUrl(session) + "&shallow=true", null);
                LogProbeResult(result);

                if (result.Result == "PASS")
                {
                    Ui(() => _relay.Text = "Relay: OFFICE PASS / Google + RTDB");
                    Log("OFFICE PASS ssid=" + GetSsid() + " admin=" + session.AppUserId + " instance=" + Short(_agentInstanceId) + " rtdb_ms=" + result.ElapsedMs + ".");
                }
                else if (result.Result == "PROXY_BLOCK")
                {
                    Ui(() => _relay.Text = "Relay: OFFICE PROXY BLOCK / RTDB");
                    Log("OFFICE PROXY_BLOCK RTDB http=" + result.StatusCode + " host=" + result.FinalHost + ".");
                }
                else
                {
                    Ui(() => _relay.Text = "Relay: RTDB " + result.Result + " / HTTP " + result.StatusCode);
                    Log("OFFICE RTDB_FAIL result=" + result.Result + " http=" + result.StatusCode + ".");
                }
            }
            catch (Exception ex)
            {
                Ui(() => _relay.Text = "Relay: lỗi mạng/transport");
                Log("OFFICE TRANSPORT_FAIL " + SafeMessage(ex));
            }
            finally
            {
                Ui(() => _testOffice.Enabled = true);
            }
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
                var retrySeconds = 1;
                try
                {
                    EnsureFreshToken();
                    ListenOnce(token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch (RelayHttpException ex)
                {
                    if (LooksLikeCorporateProxyBlock(ex.Detail))
                    {
                        retrySeconds = 10;
                        Ui(() => _relay.Text = "Relay: OFFICE PROXY BLOCK / RTDB");
                        Log("Relay PROXY_BLOCK RTDB http=" + ex.StatusCode + " category=" + ProxyCategory(ex.Detail) + " rule=" + ProxyRule(ex.Detail));
                    }
                    else if (ex.StatusCode == 403)
                    {
                        retrySeconds = 5;
                        Ui(() => _relay.Text = "Relay: RTDB 403 / Rules");
                        Log("Relay RTDB_PERMISSION_DENIED 403; Firebase/Rules response không phải proxy block. detail=" + SafeMessage(ex));
                    }
                    else
                    {
                        retrySeconds = 2;
                        Ui(() => _relay.Text = "Relay: HTTP " + ex.StatusCode + " · thử lại");
                        Log("Relay HTTP_FAIL " + ex.StatusCode + " detail=" + SafeMessage(ex));
                    }
                }
                catch (Exception ex)
                {
                    Ui(() => _relay.Text = "Relay: mạng/transport · thử lại");
                    Log("Relay TRANSPORT_FAIL " + SafeMessage(ex));
                }
                if (token.WaitHandle.WaitOne(TimeSpan.FromSeconds(retrySeconds))) return;
            }
        }

        private void ListenOnce(CancellationToken token)
        {
            var session = SnapshotSession();
            var url = JobsUrl(session);
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "GET";
            req.Accept = "text/event-stream";
            req.UserAgent = "SUPRA-Inventory-Relay-Test/1.2";
            req.Timeout = 10000;
            req.ReadWriteTimeout = 65000;
            req.KeepAlive = true;

            Log("Relay SSE CONNECT host=" + AgentDiagnostics.SafeUrl(url) + " admin=" + session.AppUserId + " instance=" + Short(_agentInstanceId) + " uid=" + Fingerprint(session.UserId) + " ssid=" + GetSsid());
            HttpWebResponse response = null;
            try
            {
                using (token.Register(() => { try { req.Abort(); } catch { } }))
                {
                    try
                    {
                        response = (HttpWebResponse)req.GetResponse();
                    }
                    catch (WebException ex)
                    {
                        throw ToRelayHttpException(ex, "RTDB SSE");
                    }

                    using (response)
                    using (var stream = response.GetResponseStream())
                    using (var reader = new StreamReader(stream))
                    {
                        Ui(() => _relay.Text = "Relay: ONLINE / đang nghe");
                        Log("Relay SSE PASS HTTP " + (int)response.StatusCode + " ssid=" + GetSsid() + " admin=" + session.AppUserId + " instance=" + Short(_agentInstanceId) + " uid=" + Fingerprint(session.UserId));
                        var data = new StringBuilder();
                        string line;
                        while (!token.IsCancellationRequested && (line = reader.ReadLine()) != null)
                        {
                            if (line.Length == 0)
                            {
                                if (data.Length > 0)
                                {
                                    ProcessSse(data.ToString());
                                    data.Clear();
                                }
                                continue;
                            }
                            if (line.StartsWith("data:", StringComparison.Ordinal))
                                data.Append(line.Substring(5).Trim());
                        }
                    }
                }
            }
            finally
            {
                if (response != null) response.Dispose();
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
            if (!job.TryGetValue("status", out statusObj) ||
                !string.Equals(Convert.ToString(statusObj), "PENDING", StringComparison.OrdinalIgnoreCase))
                return;
            if (job.TryGetValue("source", out sourceObj) &&
                !string.Equals(Convert.ToString(sourceObj), "ANDROID_POC", StringComparison.Ordinal))
                return;

            lock (_acked)
            {
                if (_acked.Contains(jobId)) return;
                _acked.Add(jobId);
            }

            var session = SnapshotSession();
            try
            {
                var patch = new Dictionary<string, object>
                {
                    { "status", "ACK" },
                    { "agent_id", Environment.MachineName },
                    { "agent_instance_id", _agentInstanceId },
                    { "agent_admin_user_id", session.AppUserId },
                    { "agent_network", GetSsid() },
                    { "agent_received_at_ms", NowMs() },
                    { "agent_ack_at_ms", NowMs() }
                };
                RequestJson("PATCH", JobUrl(session, jobId), _json.Serialize(patch), "application/json");
                Log(
                    "ACK OWNED request=" + Short(jobId) +
                    " admin=" + session.AppUserId +
                    " machine=" + Environment.MachineName +
                    " instance=" + Short(_agentInstanceId) +
                    " network=" + GetSsid() +
                    " payload_digits=5"
                );
            }
            catch (RelayHttpException ex)
            {
                if (ex.StatusCode == 403 && JobAlreadyAcknowledgedByAnotherAgent(session, jobId))
                {
                    Log("ACK SKIP request=" + Short(jobId) + " another ADMIN Agent already owns ACK.");
                    return;
                }
                lock (_acked) _acked.Remove(jobId);
                Log("ACK lỗi: " + SafeMessage(ex));
            }
            catch (Exception ex)
            {
                lock (_acked) _acked.Remove(jobId);
                Log("ACK lỗi: " + SafeMessage(ex));
            }
        }

        private bool JobAlreadyAcknowledgedByAnotherAgent(AgentSession session, string jobId)
        {
            try
            {
                var raw = RequestJson("GET", JobUrl(session, jobId), null, null);
                var job = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (job == null) return false;
                object status;
                return job.TryGetValue("status", out status) &&
                    string.Equals(Convert.ToString(status), "ACK", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private void EnsureFreshToken() { var s = SnapshotSession(); if (s.ExpiresUtc <= DateTime.UtcNow.AddMinutes(2)) RefreshDirect(); }

        private void RefreshDirect()
        {
            var current = SnapshotSession();
            var form = "grant_type=refresh_token&refresh_token=" + Uri.EscapeDataString(current.RefreshToken);
            var url = "https://securetoken.googleapis.com/v1/token?key=" + Uri.EscapeDataString(AgentConfig.FirebaseApiKey);
            Log("Firebase refresh START host=securetoken.googleapis.com ssid=" + GetSsid());
            var root = Map(_json.DeserializeObject(RequestJson("POST", url, form, "application/x-www-form-urlencoded")));
            var idToken = Convert.ToString(root["id_token"]);
            var refreshToken = Convert.ToString(root["refresh_token"]);
            var firebaseUid = FirebaseUidFromIdToken(idToken);
            var audience = FirebaseAudienceFromIdToken(idToken);
            var role = FirebaseClaimFromIdToken(idToken, "app_role");
            var baseRole = FirebaseClaimFromIdToken(idToken, "app_base_role");
            var appUserId = FirebaseClaimFromIdToken(idToken, "app_user_id");

            if (!string.Equals(audience, AgentConfig.FirebaseProjectId, StringComparison.Ordinal))
                throw new InvalidOperationException("Firebase token sai project audience.");
            if (!string.Equals(role, "ADMIN", StringComparison.Ordinal) ||
                !string.Equals(baseRole, "ADMIN", StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(appUserId))
                throw new InvalidOperationException("Phiên Agent không phải ADMIN thực hoặc thiếu D075 claims.");

            var next = new AgentSession
            {
                IdToken = idToken,
                RefreshToken = refreshToken,
                UserId = firebaseUid,
                AppUserId = appUserId,
                Role = role,
                BaseRole = baseRole,
                ExpiresUtc = DateTime.UtcNow.AddSeconds(ParseInt(root, "expires_in", 3600) - 60)
            };
            if (string.IsNullOrWhiteSpace(next.IdToken) ||
                string.IsNullOrWhiteSpace(next.RefreshToken) ||
                string.IsNullOrWhiteSpace(next.UserId))
                throw new InvalidOperationException("Google không trả phiên Firebase hợp lệ.");

            lock (_sessionLock) _session = next;
            SaveStoredSession(next);
            Log(
                "Firebase refresh PASS admin=" + next.AppUserId +
                " role=" + next.Role +
                " base_role=" + next.BaseRole +
                " uid=" + Fingerprint(next.UserId) +
                " aud=" + audience
            );
        }

        private AgentSession SnapshotSession()
        {
            lock (_sessionLock)
            {
                if (_session == null) throw new InvalidOperationException("Chưa đăng nhập ADMIN Agent.");
                return new AgentSession
                {
                    IdToken = _session.IdToken,
                    RefreshToken = _session.RefreshToken,
                    UserId = _session.UserId,
                    AppUserId = _session.AppUserId,
                    Role = _session.Role,
                    BaseRole = _session.BaseRole,
                    ExpiresUtc = _session.ExpiresUtc
                };
            }
        }

        private string CurrentSessionUser()
        {
            lock (_sessionLock)
            {
                if (_session == null) return "chưa đăng nhập ADMIN";
                var appUser = string.IsNullOrWhiteSpace(_session.AppUserId) ? "admin?" : _session.AppUserId;
                return "ADMIN " + appUser + " / device:" + Short(_agentInstanceId);
            }
        }

        private static string JobsUrl(AgentSession s)
        {
            return AgentConfig.DatabaseUrl.TrimEnd('/') + "/relay_poc/jobs.json?auth=" + Uri.EscapeDataString(s.IdToken);
        }

        private static string JobUrl(AgentSession s, string id)
        {
            return AgentConfig.DatabaseUrl.TrimEnd('/') + "/relay_poc/jobs/" + Uri.EscapeDataString(id) + ".json?auth=" + Uri.EscapeDataString(s.IdToken);
        }

        private static string RequestJson(string method, string url, string body, string contentType)
        {
            var started = Stopwatch.StartNew();
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = method;
            req.Accept = "application/json";
            req.UserAgent = "SUPRA-Inventory-Relay-Test/1.1";
            req.Timeout = 10000;
            req.ReadWriteTimeout = 10000;
            if (!string.IsNullOrWhiteSpace(contentType)) req.ContentType = contentType;

            try
            {
                if (body != null)
                {
                    if (string.IsNullOrWhiteSpace(req.ContentType)) req.ContentType = "application/json; charset=utf-8";
                    var bytes = Encoding.UTF8.GetBytes(body);
                    req.ContentLength = bytes.Length;
                    using (var output = req.GetRequestStream())
                        output.Write(bytes, 0, bytes.Length);
                }

                using (var response = (HttpWebResponse)req.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    var result = reader.ReadToEnd();
                    started.Stop();
                    AgentDiagnostics.Write("HTTP PASS method=" + method + " url=" + AgentDiagnostics.SafeUrl(url) +
                        " status=" + (int)response.StatusCode + " ms=" + started.ElapsedMilliseconds +
                        " response_bytes=" + Encoding.UTF8.GetByteCount(result));
                    return result;
                }
            }
            catch (WebException ex)
            {
                started.Stop();
                var converted = ToRelayHttpException(ex, method + " " + AgentDiagnostics.SafeUrl(url));
                AgentDiagnostics.Write("HTTP FAIL method=" + method + " url=" + AgentDiagnostics.SafeUrl(url) +
                    " status=" + converted.StatusCode + " ms=" + started.ElapsedMilliseconds +
                    " detail=" + converted.Detail);
                throw converted;
            }
        }

        private static RelayHttpException ToRelayHttpException(WebException ex, string operation)
        {
            var response = ex.Response as HttpWebResponse;
            if (response == null)
                return new RelayHttpException(0, ex.Status.ToString(), operation);

            // Capture every property needed for diagnostics before disposing the proxy/HTTP response.
            // Office proxy failures exercise this path; reading StatusCode after using(response) caused
            // ObjectDisposedException and hid the real HTTP status returned by the proxy/RTDB endpoint.
            var statusCode = (int)response.StatusCode;
            var statusDescription = response.StatusDescription ?? "";
            var responseHost = response.ResponseUri == null ? "" : response.ResponseUri.Host;
            var contentType = response.ContentType ?? "";
            var detail = "";

            try
            {
                using (response)
                using (var stream = response.GetResponseStream())
                using (var reader = stream == null ? null : new StreamReader(stream))
                    detail = reader == null ? "" : reader.ReadToEnd();
            }
            catch { }

            if (!string.IsNullOrWhiteSpace(detail))
            {
                try
                {
                    var parsed = new JavaScriptSerializer().DeserializeObject(detail) as Dictionary<string, object>;
                    object error;
                    if (parsed != null && parsed.TryGetValue("error", out error))
                        detail = Convert.ToString(error);
                }
                catch { }
            }

            var safeDetail = AgentDiagnostics.Sanitize(detail).Trim();
            if (string.IsNullOrWhiteSpace(safeDetail))
                safeDetail = AgentDiagnostics.Sanitize(statusDescription).Trim();

            AgentDiagnostics.Write(
                "HTTP ERROR RESPONSE status=" + statusCode +
                " host=" + responseHost +
                " content_type=" + contentType +
                " web_exception=" + ex.Status);

            return new RelayHttpException(statusCode, safeDetail, operation);
        }

        private void SaveStoredSession(AgentSession session)
        {
            var dir = Path.GetDirectoryName(SessionFile);
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            var payload = _json.Serialize(new Dictionary<string, object>
            {
                { "refresh_token", session.RefreshToken },
                { "firebase_uid", session.UserId },
                { "app_user_id", session.AppUserId ?? "" },
                { "role", session.Role ?? "" },
                { "base_role", session.BaseRole ?? "" }
            });
            File.WriteAllBytes(SessionFile, ProtectedData.Protect(Encoding.UTF8.GetBytes(payload), null, DataProtectionScope.CurrentUser));
            AgentDiagnostics.Write(
                "SESSION saved_dpapi admin=" + (session.AppUserId ?? "") +
                " role=" + (session.Role ?? "") +
                " base_role=" + (session.BaseRole ?? "") +
                " uid=" + Fingerprint(session.UserId) +
                " instance=" + Short(_agentInstanceId)
            );
        }

        private AgentSession LoadStoredSession()
        {
            if (!File.Exists(SessionFile)) return null;
            var raw = ProtectedData.Unprotect(File.ReadAllBytes(SessionFile), null, DataProtectionScope.CurrentUser);
            var map = Map(_json.DeserializeObject(Encoding.UTF8.GetString(raw)));
            object refreshValue;
            if (!map.TryGetValue("refresh_token", out refreshValue) || string.IsNullOrWhiteSpace(Convert.ToString(refreshValue)))
                throw new InvalidOperationException("Phiên Agent đã lưu thiếu refresh token.");

            object firebaseValue, appValue, roleValue, baseRoleValue;
            var firebaseUid = map.TryGetValue("firebase_uid", out firebaseValue) ? Convert.ToString(firebaseValue) : "";
            var appUser = map.TryGetValue("app_user_id", out appValue) ? Convert.ToString(appValue) : "";
            var role = map.TryGetValue("role", out roleValue) ? Convert.ToString(roleValue) : "";
            var baseRole = map.TryGetValue("base_role", out baseRoleValue) ? Convert.ToString(baseRoleValue) : "";

            return new AgentSession
            {
                RefreshToken = Convert.ToString(refreshValue),
                UserId = firebaseUid,
                AppUserId = appUser,
                Role = role,
                BaseRole = baseRole,
                IdToken = "",
                ExpiresUtc = DateTime.MinValue
            };
        }

        private void ClearStoredSession()
        {
            try
            {
                if (File.Exists(SessionFile)) File.Delete(SessionFile);
            }
            catch { }
        }

        private Dictionary<string, object> DecodeTokenPayload(string idToken)
        {
            if (string.IsNullOrWhiteSpace(idToken)) throw new InvalidOperationException("Firebase ID token trống.");
            var parts = idToken.Split('.');
            if (parts.Length != 3) throw new InvalidOperationException("Firebase ID token sai định dạng.");
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            switch (payload.Length % 4)
            {
                case 2: payload += "=="; break;
                case 3: payload += "="; break;
            }
            try
            {
                var json = Encoding.UTF8.GetString(Convert.FromBase64String(payload));
                return Map(_json.DeserializeObject(json));
            }
            catch
            {
                throw new InvalidOperationException("Không đọc được Firebase ID token payload.");
            }
        }

        private string FirebaseUidFromIdToken(string idToken)
        {
            var payload = DecodeTokenPayload(idToken);
            object value;
            var uid = payload.TryGetValue("sub", out value) ? Convert.ToString(value) : "";
            if (string.IsNullOrWhiteSpace(uid) || uid.Length > 128)
                throw new InvalidOperationException("Firebase ID token thiếu UID hợp lệ.");
            return uid;
        }

        private string FirebaseAudienceFromIdToken(string idToken)
        {
            var payload = DecodeTokenPayload(idToken);
            object value;
            return payload.TryGetValue("aud", out value) ? Convert.ToString(value) : "";
        }

        private string FirebaseClaimFromIdToken(string idToken, string claim)
        {
            var payload = DecodeTokenPayload(idToken);
            object value;
            return payload.TryGetValue(claim, out value) ? Convert.ToString(value) : "";
        }

        private string LoadOrCreateAgentInstanceId()
        {
            try
            {
                Directory.CreateDirectory(RelayDataDir);
                if (File.Exists(AgentInstanceFile))
                {
                    var existing = File.ReadAllText(AgentInstanceFile).Trim();
                    Guid parsed;
                    if (Guid.TryParse(existing, out parsed)) return parsed.ToString("N");
                }
                var created = Guid.NewGuid().ToString("N");
                File.WriteAllText(AgentInstanceFile, created, Encoding.ASCII);
                return created;
            }
            catch
            {
                return "ephemeral-" + Guid.NewGuid().ToString("N");
            }
        }

        private void LogNetworkSnapshot(string stage)
        {
            var ssid = GetSsid();
            var internet = NetworkInterface.GetIsNetworkAvailable();
            var proxy = "DIRECT";
            try
            {
                var target = new Uri(AgentConfig.DatabaseUrl);
                var systemProxy = WebRequest.DefaultWebProxy;
                if (systemProxy != null)
                {
                    var proxyUri = systemProxy.GetProxy(target);
                    if (proxyUri != null && proxyUri != target)
                        proxy = proxyUri.Scheme + "://" + proxyUri.Host + ":" + proxyUri.Port;
                }
            }
            catch (Exception ex)
            {
                proxy = "UNKNOWN:" + ex.GetType().Name;
            }

            Log("NET stage=" + stage + " ssid=" + ssid + " available=" + internet + " proxy=" + proxy);
            try
            {
                foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus != OperationalStatus.Up) continue;
                    var props = nic.GetIPProperties();
                    var ips = new List<string>();
                    foreach (var addr in props.UnicastAddresses)
                    {
                        if (addr.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                            ips.Add(addr.Address.ToString());
                    }
                    var gateways = new List<string>();
                    foreach (var gw in props.GatewayAddresses)
                    {
                        if (gw.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                            gateways.Add(gw.Address.ToString());
                    }
                    var dns = new List<string>();
                    foreach (var dnsAddr in props.DnsAddresses)
                    {
                        if (dnsAddr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                            dns.Add(dnsAddr.ToString());
                    }
                    AgentDiagnostics.Write("NETIF stage=" + stage + " name=" + nic.Name + " type=" + nic.NetworkInterfaceType +
                        " ip=" + string.Join(",", ips) + " gateway=" + string.Join(",", gateways) + " dns=" + string.Join(",", dns));
                }
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("NETIF snapshot_failed " + ex.GetType().Name);
            }
        }

        private static string GetSsid()
        {
            try
            {
                var info = new ProcessStartInfo
                {
                    FileName = "netsh",
                    Arguments = "wlan show interfaces",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };
                using (var process = Process.Start(info))
                {
                    if (process == null) return "UNKNOWN";
                    var text = process.StandardOutput.ReadToEnd();
                    process.WaitForExit(3000);
                    foreach (var raw in text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None))
                    {
                        var line = raw.Trim();
                        if (line.StartsWith("SSID", StringComparison.OrdinalIgnoreCase) &&
                            !line.StartsWith("BSSID", StringComparison.OrdinalIgnoreCase))
                        {
                            var index = line.IndexOf(':');
                            if (index >= 0)
                            {
                                var value = line.Substring(index + 1).Trim();
                                if (value.Length > 0) return value;
                            }
                        }
                    }
                }
            }
            catch { }
            return "UNKNOWN";
        }

        private static string Fingerprint(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "none";
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
                var builder = new StringBuilder();
                for (var i = 0; i < Math.Min(6, hash.Length); i++)
                    builder.Append(hash[i].ToString("x2"));
                return builder.ToString();
            }
        }

        private static long NowMs() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
        private static string Short(string value) { return value == null ? "" : value.Substring(0, Math.Min(8, value.Length)); }
        private static int ParseInt(Dictionary<string, object> map, string key, int fallback)
        {
            object value;
            int parsed;
            return map.TryGetValue(key, out value) && int.TryParse(Convert.ToString(value), out parsed) ? parsed : fallback;
        }
        private static Dictionary<string, object> Map(object value)
        {
            var map = value as Dictionary<string, object>;
            if (map == null) throw new InvalidOperationException("JSON response không hợp lệ.");
            return map;
        }
        private static string SafeMessage(Exception ex)
        {
            var message = AgentDiagnostics.Sanitize(ex.Message ?? ex.GetType().Name);
            return message.Length > 240 ? message.Substring(0, 240) : message;
        }

        private void Log(string message)
        {
            var safe = AgentDiagnostics.Sanitize(message);
            AgentDiagnostics.Write(safe);
            Ui(() =>
            {
                _log.Items.Insert(0, DateTime.Now.ToString("HH:mm:ss") + "  " + safe);
                while (_log.Items.Count > 120) _log.Items.RemoveAt(_log.Items.Count - 1);
            });
        }

        private void Ui(Action action)
        {
            if (IsDisposed) return;
            if (InvokeRequired) BeginInvoke(action);
            else action();
        }

        private void UiSync(Action action)
        {
            if (IsDisposed) return;
            if (InvokeRequired) Invoke(action);
            else action();
        }
    }
}
