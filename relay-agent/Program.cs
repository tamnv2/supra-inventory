using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
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
        private const string MainInstanceMutexName = @"Local\AgentAutoConfirmPickPack.MainInstance";
        private const string MainInstanceActivateEventName = @"Local\AgentAutoConfirmPickPack.Activate";
        private static int _networkChangeGeneration;

        private static void RefreshDefaultWindowsProxy(string reason)
        {
            try
            {
                var proxy = WebRequest.GetSystemWebProxy();
                if (proxy != null)
                    proxy.Credentials = CredentialCache.DefaultNetworkCredentials;
                WebRequest.DefaultWebProxy = proxy;
                AgentDiagnostics.Write(
                    "SYSTEM proxy-refresh=PASS reason=" + AgentDiagnostics.Sanitize(reason) +
                    " tls=TLS1.2");
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write(
                    "SYSTEM proxy-refresh=FAIL reason=" + AgentDiagnostics.Sanitize(reason) +
                    " type=" + ex.GetType().Name);
            }
        }

        [STAThread]
        private static void Main(string[] args)
        {
            var watchdogIndex = args == null ? -1 : Array.FindIndex(args, item =>
                string.Equals(item, "--watchdog", StringComparison.OrdinalIgnoreCase));
            if (watchdogIndex >= 0 && args != null && watchdogIndex + 1 < args.Length)
            {
                int parentPid;
                if (int.TryParse(args[watchdogIndex + 1], out parentPid))
                    Environment.ExitCode = AgentRuntimeGuard.RunWatchdog(parentPid);
                else
                    Environment.ExitCode = 2;
                return;
            }

            AgentDiagnostics.Initialize();

            var d096SelfTest = args != null && Array.Exists(args, item =>
                string.Equals(item, "--d096-self-test", StringComparison.OrdinalIgnoreCase));
            if (d096SelfTest)
            {
                try
                {
                    var parserPass = WmsExactPicklistResolver.SelfTestJsonArrayParsing();
                    var confirmPass = WmsPicklistConfirmClient.SelfTestResponseSemantics();
                    AgentDiagnostics.Write(
                        "D096 SELFTEST parser=" + (parserPass ? "PASS" : "FAIL") +
                        " confirm_semantics=" + (confirmPass ? "PASS" : "FAIL"));
                    Environment.ExitCode = parserPass && confirmPass ? 0 : 3;
                }
                catch (Exception ex)
                {
                    AgentDiagnostics.Write(
                        "D096 SELFTEST exception type=" + ex.GetType().Name +
                        " message=" + AgentDiagnostics.Sanitize(ex.Message));
                    Environment.ExitCode = 4;
                }
                return;
            }

            var startupSmoke = args != null && Array.Exists(args, item =>
                string.Equals(item, "--startup-smoke", StringComparison.OrdinalIgnoreCase));
            var autoStarted = args != null && Array.Exists(args, item =>
                string.Equals(item, "--autostart", StringComparison.OrdinalIgnoreCase));

            Mutex instanceMutex = null;
            EventWaitHandle activateEvent = null;
            if (!startupSmoke)
            {
                bool createdNew;
                instanceMutex = new Mutex(true, MainInstanceMutexName, out createdNew);
                if (!createdNew)
                {
                    AgentDiagnostics.Write("SINGLE_INSTANCE duplicate-launch blocked; activating existing instance");
                    try
                    {
                        using (var existing = EventWaitHandle.OpenExisting(MainInstanceActivateEventName))
                            existing.Set();
                    }
                    catch (Exception ex)
                    {
                        AgentDiagnostics.Write("SINGLE_INSTANCE activate-existing failed type=" + ex.GetType().Name);
                    }
                    instanceMutex.Dispose();
                    return;
                }
                activateEvent = new EventWaitHandle(false, EventResetMode.AutoReset, MainInstanceActivateEventName);
            }

            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                ServicePointManager.DnsRefreshTimeout = 15000;
                RefreshDefaultWindowsProxy("startup");
                if (!startupSmoke)
                {
                    NetworkChange.NetworkAddressChanged += (s, e) =>
                    {
                        FirestoreHttpTransport.NotifyNetworkChange();
                        var generation = Interlocked.Increment(ref _networkChangeGeneration);
                        foreach (var delayMs in new[] { 750, 3000, 8000, 15000 })
                        {
                            var capturedDelay = delayMs;
                            ThreadPool.QueueUserWorkItem(_ =>
                            {
                                Thread.Sleep(capturedDelay);
                                if (generation != Volatile.Read(ref _networkChangeGeneration)) return;
                                RefreshDefaultWindowsProxy("network-change-" + capturedDelay + "ms");
                            });
                        }
                    };
                }

                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);
                AppDomain.CurrentDomain.UnhandledException += (s, e) =>
                {
                    var ex = e.ExceptionObject as Exception;
                    AgentDiagnostics.Write(
                        "FATAL appdomain type=" + (ex == null ? "UNKNOWN" : ex.GetType().Name) +
                        " message=" + AgentDiagnostics.Sanitize(ex == null ? "" : ex.Message));
                };

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new AgentForm(startupSmoke, autoStarted, activateEvent));
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write(
                    "FATAL startup type=" + ex.GetType().Name +
                    " message=" + AgentDiagnostics.Sanitize(ex.Message));
                if (startupSmoke)
                {
                    Environment.ExitCode = 2;
                    return;
                }

                try
                {
                    MessageBox.Show(
                        "SUPRA Inventory Agent không thể khởi động.\r\n\r\n" +
                        "Lỗi: " + AgentDiagnostics.Sanitize(ex.GetType().Name + " - " + ex.Message) +
                        "\r\n\r\nĐã ghi log cục bộ để chẩn đoán.",
                        "Agent Auto Confirm Pick Pack - lỗi khởi động",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }
                catch { }
            }
            finally
            {
                try { if (activateEvent != null) activateEvent.Dispose(); } catch { }
                try
                {
                    if (instanceMutex != null)
                    {
                        instanceMutex.ReleaseMutex();
                        instanceMutex.Dispose();
                    }
                }
                catch { }
            }
        }
    }

    internal static class AgentDiagnostics
    {
        private static readonly object Gate = new object();
        private static readonly Regex JwtPattern = new Regex(@"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}", RegexOptions.Compiled);
        private static readonly Regex SecretPattern = new Regex(@"(?i)(authorization|bearer|token|password|secret|private[_ -]?key|api[_ -]?key|cookie|refresh[_ -]?token|id[_ -]?token|apisid|sid|scid|usid|x-signature(?:-nonce)?)\s*[:=]\s*[^\s,;]+", RegexOptions.Compiled);
        private static readonly Regex QuerySecretPattern = new Regex(@"(?i)([?&](?:auth|key|access_token|token)=)[^&\s]+", RegexOptions.Compiled);
        internal static string DiagnosticLogFile { get; private set; }
        internal static string RelayAuditLogFile { get; private set; }
        internal static string LogFile { get { return DiagnosticLogFile; } }

        internal static void Initialize()
        {
            try
            {
                var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Agent Auto Confirm Pick Pack", "RelayPoc", "Logs");
                Directory.CreateDirectory(dir);
                var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Process.GetCurrentProcess().Id;
                DiagnosticLogFile = Path.Combine(dir, "technical-ai-" + stamp + ".log");
                RelayAuditLogFile = Path.Combine(dir, "pda-agent-audit-" + stamp + ".log");
                Write("START version=" + Assembly.GetExecutingAssembly().GetName().Version + " os=" + Environment.OSVersion.VersionString + " clr=" + Environment.Version + " process64=" + Environment.Is64BitProcess + " machine=" + Environment.MachineName);
                WriteAudit("AUDIT_START version=" + Assembly.GetExecutingAssembly().GetName().Version + " machine=" + Environment.MachineName);
            }
            catch
            {
                DiagnosticLogFile = "";
                RelayAuditLogFile = "";
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
            AppendSanitized(DiagnosticLogFile, message);
        }

        internal static void WriteAudit(string message)
        {
            AppendSanitized(RelayAuditLogFile, message);
        }

        private static void AppendSanitized(string path, string message)
        {
            var line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + "  " + Sanitize(message);
            try
            {
                lock (Gate)
                {
                    if (!string.IsNullOrWhiteSpace(path))
                        File.AppendAllText(path, line + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch { }
        }

        internal static void OpenLog() { OpenDiagnosticLog(); }

        internal static void OpenDiagnosticLog()
        {
            OpenFile(DiagnosticLogFile);
        }

        internal static void OpenRelayAuditLog()
        {
            OpenFile(RelayAuditLogFile);
        }

        private static void OpenFile(string path)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
                    Process.Start("explorer.exe", "/select,\"" + path + "\"");
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
        public string LoginName;
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
        private readonly EventWaitHandle _instanceActivateEvent;
        private readonly TextBox _username = new TextBox();
        private readonly TextBox _password = new TextBox();
        private readonly Button _pair = new Button();
        private readonly Button _logout = new Button();
        private readonly Button _testOffice = new Button();
        private readonly Button _listen = new Button();
        private readonly Button _openLog = new Button();
        private readonly Button _openAuditLog = new Button();
        private readonly Button _overlaySettingsButton = new Button();
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
        private readonly Label _agentAuthStatus = new Label();
        private readonly TextBox _manualPicklistQuery = new TextBox();
        private readonly Button _manualPicklistSearch = new Button();
        private readonly ListBox _manualPicklistResults = new ListBox();
        private readonly Button _manualPicklistConfirm = new Button();
        private readonly Label _manualPicklistStatus = new Label();
        private readonly Panel _overlaySettingsHost = new Panel();
        private OverlaySettingsForm _embeddedOverlaySettings;
        private readonly ListBox _log = new ListBox();
        private readonly ListBox _auditLog = new ListBox();
        private readonly NotifyIcon _tray = new NotifyIcon();
        private readonly ToolStripMenuItem _trayStatusItem = new ToolStripMenuItem();
        private readonly ToolStripMenuItem _trayOverlayVisibleItem = new ToolStripMenuItem();
        private readonly ToolStripMenuItem _trayOverlayLockItem = new ToolStripMenuItem();
        private readonly ToolStripMenuItem _trayOverlayOpacityMenu = new ToolStripMenuItem();
        private readonly SystemMonitor _systemMonitor = new SystemMonitor();
        private readonly System.Windows.Forms.Timer _trayMonitorTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer _networkUiTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer _guardTimer = new System.Windows.Forms.Timer();
        private readonly TabControl _mainTabs = new TabControl();
        private readonly TabPage _overviewPage = new TabPage("Tổng quan");
        private readonly TabPage _settingsPage = new TabPage("Cài đặt");
        private StatusOverlayForm _statusOverlay;
        private readonly OverlaySettings _overlaySettings;
        private readonly bool _startupSmoke;
        private readonly bool _autoStarted;
        private bool _overlayInitFailed;
        private readonly HashSet<string> _acked = new HashSet<string>(StringComparer.Ordinal);
        private readonly PicklistCacheCoordinator _picklistCache = new PicklistCacheCoordinator();
        private readonly PickerRateLimiter _pickerRateLimiter = new PickerRateLimiter();
        private readonly FirestorePickerRateLimiter _firestoreRateLimiter = new FirestorePickerRateLimiter();
        private readonly FirestoreConfirmationGuard _confirmationGuard = new FirestoreConfirmationGuard();
        private readonly FirestoreAgentSessionGate _agentSessionGate;
        private FirestoreAgentLeaderCoordinator _leaderCoordinator;
        private readonly object _sessionLock = new object();
        private readonly object _wmsSessionLock = new object();
        private AgentSession _session;
        private WmsSessionSnapshot _wmsSession;
        private CancellationTokenSource _listenCts;
        private bool _allowExit;
        private bool _updateCheckRunning;
        private long _localPdaRequests;
        private long _localAgentResponses;
        private readonly string _agentInstanceId;
        private readonly System.Windows.Forms.Timer _updateTimer = new System.Windows.Forms.Timer();

        private static readonly string RelayDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Agent Auto Confirm Pick Pack", "RelayPoc");
        private static readonly string SessionFile = Path.Combine(RelayDataDir, "session.bin");
        private static readonly string AgentInstanceFile = Path.Combine(RelayDataDir, "agent-instance-id.txt");
        private static readonly string OverlaySettingsFile = Path.Combine(RelayDataDir, "overlay-settings.json");
        private static readonly string WmsSessionFile = Path.Combine(RelayDataDir, "wms-session.bin");
        private static readonly string ExitVerifierFile = Path.Combine(RelayDataDir, "exit-verifier.bin");

        internal AgentForm(bool startupSmoke = false, bool autoStarted = false, EventWaitHandle instanceActivateEvent = null)
        {
            _startupSmoke = startupSmoke;
            _autoStarted = autoStarted;
            _instanceActivateEvent = instanceActivateEvent;
            _agentInstanceId = LoadOrCreateAgentInstanceId();
            _agentSessionGate = new FirestoreAgentSessionGate(message => Log(message));
            _overlaySettings = StatusOverlayForm.LoadSettings(OverlaySettingsFile);
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
            _logout.Text = "Đăng xuất"; _logout.Enabled = false; _logout.Click += (s, e) => Task.Run(() => LogoutAgent());

            _testOffice.SetBounds(18, 176, 135, 32); _testOffice.Text = "Test Firestore"; _testOffice.Enabled = false;
            _testOffice.Click += (s, e) => Task.Run(() => TestOffice()); Controls.Add(_testOffice);
            _listen.SetBounds(160, 176, 135, 32); _listen.Text = "Nghe relay"; _listen.Enabled = false;
            _listen.Click += (s, e) => { if (_listenCts == null) StartListening(); else StopListening(); }; Controls.Add(_listen);
            _openLog.SetBounds(302, 176, 105, 32); _openLog.Text = "Mở log";
            _openLog.Click += (s, e) => AgentDiagnostics.OpenLog(); Controls.Add(_openLog);
            _overlaySettingsButton.SetBounds(414, 176, 135, 32); _overlaySettingsButton.Text = "Cài đặt bảng nổi";
            _overlaySettingsButton.Click += (s, e) => OpenOverlaySettings(); Controls.Add(_overlaySettingsButton);
            Controls.Add(new Label { Left = 560, Top = 178, Width = 184, Height = 38, Text = "POC chỉ đọc WMS; chưa xác nhận đơn.", ForeColor = Color.DimGray });

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

            BuildProfessionalLayout();

            var menu = new ContextMenuStrip();
            _trayStatusItem.Enabled = false;
            _trayStatusItem.Text = "Máy: đang đọc...";
            menu.Items.Add(_trayStatusItem);
            menu.Items.Add(new ToolStripSeparator());

            menu.Items.Add("Mở Agent", null, (s, e) => RestoreFromTray());
            menu.Items.Add("Cài đặt", null, (s, e) => OpenSettingsFromTray());
            menu.Items.Add("Mở log", null, (s, e) => AgentDiagnostics.OpenLog());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Tắt Agent...", null, (s, e) => RequestProtectedExit());
            _tray.Text = "Agent Auto Confirm Pick Pack";
            try { _tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application; }
            catch { _tray.Icon = SystemIcons.Application; }
            try { Icon = _tray.Icon; } catch { }
            _tray.ContextMenuStrip = menu; _tray.Visible = true;
            RefreshOverlayMenu();
            _tray.DoubleClick += (s, e) => RestoreFromTray();

            // D088: minimize/user-close hides the window from taskbar and leaves the Agent in System Tray.
            FormClosing += (s, e) =>
            {
                if (!_allowExit && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; MinimizeToTray(); return; }
                if (e.CloseReason == CloseReason.WindowsShutDown) AgentRuntimeGuard.MarkPlannedExit();
                StopListening();
                StopLeaderCoordination();
                _trayMonitorTimer.Stop();
                try { if (_statusOverlay != null) _statusOverlay.Close(); } catch { }
                _tray.Visible = false;
            };

            _networkUiTimer.Interval = 60000;
            _networkUiTimer.Tick += (s, e) =>
            {
                if (Visible) _network.Text = "Mạng: " + GetSsid();
            };

            _guardTimer.Interval = 60000;
            _guardTimer.Tick += (s, e) => AgentRuntimeGuard.EnsureWatchdog();

            _trayMonitorTimer.Interval = 5000;
            _trayMonitorTimer.Tick += (s, e) => UpdateTrayMonitor();

            _updateTimer.Interval = 4 * 60 * 60 * 1000;
            _updateTimer.Tick += (s, e) => Task.Run(() => TryAutoUpdate(false));
            _updateTimer.Start();

            Shown += (s, e) =>
            {
                InitializeStatusOverlaySafe();
                UpdateTrayMonitor();

                if (_startupSmoke)
                {
                    AgentDiagnostics.Write("STARTUP_SMOKE PASS overlay=" + (_statusOverlay == null ? "fallback" : "ready"));
                    _allowExit = true;
                    BeginInvoke(new Action(Close));
                    return;
                }

                AgentRuntimeGuard.EnsureWatchdog();
                _guardTimer.Start();
                _networkUiTimer.Start();
                _trayMonitorTimer.Start();
                if (_autoStarted)
                {
                    BeginInvoke(new Action(() =>
                    {
                        MinimizeToTray();
                        _tray.ShowBalloonTip(1500, "Agent Auto Confirm Pick Pack", "Agent đã tự khởi động cùng Windows.", ToolTipIcon.Info);
                    }));
                }
                if (_instanceActivateEvent != null)
                    Task.Run(() => ListenForSecondLaunch());
                Task.Run(() => StartupSequence());
            };
        }

        private void BuildProfessionalLayout()
        {
            SuspendLayout();
            Controls.Clear();

            Text = "Agent Auto Confirm Pick Pack v" + AgentConfig.AgentBuild;
            Width = 920;
            Height = 760;
            MinimumSize = new Size(920, 760);
            BackColor = Color.FromArgb(243, 246, 248);
            ControlBox = false;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = true;
            FormBorderStyle = FormBorderStyle.None;

            var shell = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                RowCount = 2,
                ColumnCount = 1,
                Margin = Padding.Empty,
                Padding = Padding.Empty
            };
            shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 38F));
            shell.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));

            var chrome = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(31, 47, 58),
                Margin = Padding.Empty
            };
            var chromeTitle = new Label
            {
                Left = 14,
                Top = 8,
                Width = 760,
                Height = 24,
                Text = "Agent Auto Confirm Pick Pack v" + AgentConfig.AgentBuild,
                ForeColor = Color.White,
                Font = new Font("Segoe UI Semibold", 9.5F, FontStyle.Bold)
            };
            var minimize = new Button
            {
                Dock = DockStyle.Right,
                Width = 48,
                Text = "—",
                FlatStyle = FlatStyle.Flat,
                ForeColor = Color.White,
                BackColor = Color.FromArgb(31, 47, 58),
                TabStop = false
            };
            minimize.FlatAppearance.BorderSize = 0;
            minimize.Click += (s, e) => MinimizeToTray();
            chrome.MouseDown += BeginMainWindowDrag;
            chromeTitle.MouseDown += BeginMainWindowDrag;
            chrome.Controls.Add(chromeTitle);
            chrome.Controls.Add(minimize);

            _mainTabs.Dock = DockStyle.Fill;
            _mainTabs.Font = new Font("Segoe UI", 9F);
            _overviewPage.BackColor = Color.FromArgb(243, 246, 248);
            _settingsPage.BackColor = Color.FromArgb(243, 246, 248);
            _mainTabs.TabPages.Add(_overviewPage);
            _mainTabs.TabPages.Add(_settingsPage);

            shell.Controls.Add(chrome, 0, 0);
            shell.Controls.Add(_mainTabs, 0, 1);
            Controls.Add(shell);

            var title = new Label
            {
                Left = 24,
                Top = 16,
                Width = 840,
                Height = 34,
                Text = "AGENT AUTO CONFIRM PICK PACK",
                Font = new Font("Segoe UI Semibold", 17F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            };
            _overviewPage.Controls.Add(title);

            var supraCard = NewCard(24, 58, 846, 112);
            supraCard.Controls.Add(new Label
            {
                Left = 18,
                Top = 12,
                Width = 790,
                Height = 24,
                Text = "Hệ thống Supra",
                Font = new Font("Segoe UI Semibold", 11F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            _wmsCapture.SetBounds(18, 50, 220, 38);
            _wmsCapture.Text = "Đăng nhập hệ thống Supra";
            _wmsStatus.SetBounds(258, 50, 560, 38);
            _wmsStatus.Text = "Supra WMS: đang kiểm tra phiên";
            supraCard.Controls.Add(_wmsCapture);
            supraCard.Controls.Add(_wmsStatus);
            _overviewPage.Controls.Add(supraCard);

            var agentCard = NewCard(24, 182, 846, 182);
            agentCard.Controls.Add(new Label
            {
                Left = 18,
                Top = 12,
                Width = 790,
                Height = 24,
                Text = "Xác minh Agent",
                Font = new Font("Segoe UI Semibold", 11F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            _agentAuthStatus.SetBounds(18, 40, 790, 22);
            _agentAuthStatus.Text = "Xác minh Agent: CHƯA ĐĂNG NHẬP";
            _agentAuthStatus.ForeColor = Color.FromArgb(180, 76, 60);
            agentCard.Controls.Add(_agentAuthStatus);

            agentCard.Controls.Add(new Label { Left = 18, Top = 72, Width = 170, Height = 20, Text = "Tài khoản / email ADMIN" });
            _username.SetBounds(18, 94, 290, 28);
            agentCard.Controls.Add(_username);
            agentCard.Controls.Add(new Label { Left = 326, Top = 72, Width = 120, Height = 20, Text = "Mật khẩu" });
            _password.SetBounds(326, 94, 220, 28);
            _password.UseSystemPasswordChar = true;
            agentCard.Controls.Add(_password);
            _pair.SetBounds(566, 92, 120, 32);
            _pair.Text = "Đăng nhập";
            agentCard.Controls.Add(_pair);
            _logout.SetBounds(696, 92, 120, 32);
            _logout.Text = "Đăng xuất";
            _logout.Enabled = false;
            agentCard.Controls.Add(_logout);

            _identity.SetBounds(18, 132, 260, 22);
            _relay.SetBounds(286, 132, 270, 22);
            _network.SetBounds(566, 132, 250, 22);
            agentCard.Controls.Add(_identity);
            agentCard.Controls.Add(_relay);
            agentCard.Controls.Add(_network);
            _overviewPage.Controls.Add(agentCard);

            var directCard = NewCard(24, 376, 846, 284);
            directCard.Controls.Add(new Label
            {
                Left = 18,
                Top = 12,
                Width = 790,
                Height = 24,
                Text = "Xử lý PickList trực tiếp tại bàn chuyên viên",
                Font = new Font("Segoe UI Semibold", 11F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            directCard.Controls.Add(new Label
            {
                Left = 18,
                Top = 40,
                Width = 790,
                Height = 22,
                Text = "Nhập 3–5 chữ số. Hệ thống tìm chuỗi ở bất kỳ vị trí nào trong full PickListCode đã nạp.",
                ForeColor = Color.FromArgb(88, 104, 115)
            });
            _manualPicklistQuery.SetBounds(18, 70, 190, 30);
            _manualPicklistQuery.MaxLength = 5;
            _manualPicklistQuery.KeyPress += (s, e) =>
            {
                if (!char.IsControl(e.KeyChar) && !char.IsDigit(e.KeyChar)) e.Handled = true;
            };
            _manualPicklistQuery.TextChanged += (s, e) =>
            {
                var length = _manualPicklistQuery.Text.Trim().Length;
                _manualPicklistSearch.Enabled = length >= 3 && length <= 5;
                _manualPicklistConfirm.Enabled = false;
                _manualPicklistResults.Items.Clear();
                _manualPicklistStatus.Text = length < 3
                    ? "Nhập ít nhất 3 chữ số để tìm."
                    : "Sẵn sàng tìm PickList.";
            };
            directCard.Controls.Add(_manualPicklistQuery);

            _manualPicklistSearch.SetBounds(220, 68, 110, 34);
            _manualPicklistSearch.Text = "Tìm kiếm";
            _manualPicklistSearch.Enabled = false;
            _manualPicklistSearch.Click += (s, e) => Task.Run(() => SearchManualPicklists());
            directCard.Controls.Add(_manualPicklistSearch);

            _manualPicklistConfirm.SetBounds(684, 68, 132, 34);
            _manualPicklistConfirm.Text = "Xác nhận đơn";
            _manualPicklistConfirm.Enabled = false;
            _manualPicklistConfirm.Click += (s, e) => Task.Run(() => ConfirmManualPicklist());
            directCard.Controls.Add(_manualPicklistConfirm);

            _manualPicklistResults.SetBounds(18, 112, 798, 108);
            _manualPicklistResults.SelectedIndexChanged += (s, e) =>
            {
                _manualPicklistConfirm.Enabled =
                    _manualPicklistResults.SelectedItem != null &&
                    HasAgentSession() &&
                    HasUsableWmsSession();
            };
            directCard.Controls.Add(_manualPicklistResults);

            _manualPicklistStatus.SetBounds(18, 230, 798, 34);
            _manualPicklistStatus.Text = "Nhập 3–5 chữ số để xử lý trực tiếp khi PDA không sử dụng được.";
            _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            directCard.Controls.Add(_manualPicklistStatus);
            _overviewPage.Controls.Add(directCard);

            var settingsTabs = new TabControl { Dock = DockStyle.Fill, Padding = new Point(14, 6) };
            var networkPage = new TabPage("Kết nối") { BackColor = Color.White };
            var overlayPage = new TabPage("Bảng nổi") { BackColor = Color.White };
            var auditPage = new TabPage("Nhật ký vận hành") { BackColor = Color.White };
            var technicalPage = new TabPage("Chẩn đoán kỹ thuật") { BackColor = Color.White };
            settingsTabs.TabPages.Add(networkPage);
            settingsTabs.TabPages.Add(overlayPage);
            settingsTabs.TabPages.Add(auditPage);
            settingsTabs.TabPages.Add(technicalPage);
            _settingsPage.Controls.Add(settingsTabs);

            networkPage.Controls.Add(new Label { Left = 24, Top = 20, Width = 800, Height = 28, Text = "Kiểm tra kết nối", Font = new Font("Segoe UI Semibold", 11F) });
            _testOffice.SetBounds(24, 64, 150, 34); networkPage.Controls.Add(_testOffice);
            _listen.SetBounds(184, 64, 150, 34); networkPage.Controls.Add(_listen);
            _wmsTest.SetBounds(344, 64, 150, 34); _wmsTest.Text = "Kiểm tra Supra"; networkPage.Controls.Add(_wmsTest);
            _probeAuth.SetBounds(24, 126, 100, 32); networkPage.Controls.Add(_probeAuth);
            _probeRtdb.SetBounds(132, 126, 100, 32); networkPage.Controls.Add(_probeRtdb);
            _probeFirestore.SetBounds(240, 126, 110, 32); networkPage.Controls.Add(_probeFirestore);
            _probeAppsScript.SetBounds(358, 126, 110, 32); networkPage.Controls.Add(_probeAppsScript);
            _probeSheets.SetBounds(476, 126, 100, 32); networkPage.Controls.Add(_probeSheets);
            _probeDrive.SetBounds(584, 126, 100, 32); networkPage.Controls.Add(_probeDrive);
            _probeAll.SetBounds(692, 126, 130, 32); networkPage.Controls.Add(_probeAll);
            networkPage.Controls.Add(new Label
            {
                Left = 24,
                Top = 186,
                Width = 798,
                Height = 70,
                Text = "Firebase Auth + Firestore là kênh xác minh/relay Agent. Các nút tại đây chỉ kiểm tra kết nối; không thay đổi nghiệp vụ xác nhận.",
                ForeColor = Color.DimGray
            });

            _overlaySettingsHost.Dock = DockStyle.Fill;
            _overlaySettingsHost.BackColor = Color.White;
            _overlaySettingsHost.AutoScroll = true;
            _overlaySettingsHost.Controls.Add(new Label
            {
                Name = "overlay-loading",
                Left = 24,
                Top = 24,
                Width = 760,
                Height = 28,
                Text = "Đang khởi tạo cài đặt bảng nổi...",
                ForeColor = Color.DimGray
            });
            overlayPage.Controls.Add(_overlaySettingsHost);
            overlayPage.Enter += (s, e) => EnsureEmbeddedOverlaySettings();

            auditPage.Controls.Add(new Label
            {
                Left = 18,
                Top = 14,
                Width = 620,
                Height = 28,
                Text = "Nhật ký vận hành PDA ↔ Agent",
                Font = new Font("Segoe UI Semibold", 10.5F)
            });
            _openAuditLog.SetBounds(700, 10, 120, 30);
            _openAuditLog.Text = "Mở file";
            _openAuditLog.Click += (s, e) => AgentDiagnostics.OpenRelayAuditLog();
            auditPage.Controls.Add(_openAuditLog);
            _auditLog.SetBounds(18, 52, 802, 540);
            auditPage.Controls.Add(_auditLog);

            technicalPage.Controls.Add(new Label
            {
                Left = 18,
                Top = 14,
                Width = 620,
                Height = 28,
                Text = "Chẩn đoán kỹ thuật cho AI",
                Font = new Font("Segoe UI Semibold", 10.5F)
            });
            _openLog.SetBounds(700, 10, 120, 30);
            _openLog.Text = "Mở file";
            technicalPage.Controls.Add(_openLog);
            _log.SetBounds(18, 52, 802, 540);
            technicalPage.Controls.Add(_log);

            ResumeLayout(true);
        }

        private static Panel NewCard(int left, int top, int width, int height)
        {
            return new Panel
            {
                Left = left,
                Top = top,
                Width = width,
                Height = height,
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
        }

        private void OpenSettingsFromTray()
        {
            RestoreFromTray();
            _mainTabs.SelectedTab = _settingsPage;
        }

        private void RequestProtectedExit()
        {
            AgentSession session = null;
            try { session = SnapshotSession(); } catch { }

            if (session == null || string.IsNullOrWhiteSpace(session.AppUserId))
            {
                MessageBox.Show(
                    "Agent chưa có phiên ADMIN hợp lệ. Hãy đăng nhập ADMIN trong Cài đặt trước khi tắt Agent.",
                    "Tắt Agent",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            using (var dialog = new ExitPasswordDialog(session.AppUserId))
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                var password = dialog.PasswordValue;
                try
                {
                    if (!ExitAuthorization.Verify(ExitVerifierFile, session.AppUserId, password))
                    {
                        MessageBox.Show(
                            "Mật khẩu ADMIN không đúng hoặc phiên cũ chưa có bộ xác minh tắt Agent. Hãy đăng nhập ADMIN lại trong Cài đặt rồi thử lại.",
                            "Không thể tắt Agent",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error);
                        return;
                    }
                }
                finally
                {
                    password = null;
                }
            }

            AgentDiagnostics.Write("AGENT EXIT authorized admin=" + session.AppUserId + " method=local_dpapi_verifier");
            AgentRuntimeGuard.MarkPlannedExit();
            _allowExit = true;
            Close();
        }

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);

        private void BeginMainWindowDrag(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left || WindowState != FormWindowState.Normal) return;
            try
            {
                ReleaseCapture();
                SendMessage(Handle, 0x00A1, 0x0002, 0);
            }
            catch { }
        }

        private void ListenForSecondLaunch()
        {
            try
            {
                while (!IsDisposed && _instanceActivateEvent != null)
                {
                    _instanceActivateEvent.WaitOne();
                    if (IsDisposed) return;
                    BeginInvoke(new Action(() =>
                    {
                        RestoreFromTray();
                        _tray.ShowBalloonTip(1200, "Agent Auto Confirm Pick Pack", "Agent đã chạy sẵn. Đã mở cửa sổ hiện tại.", ToolTipIcon.Info);
                    }));
                }
            }
            catch (ObjectDisposedException) { }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("SINGLE_INSTANCE listener failed type=" + ex.GetType().Name);
            }
        }

        private void MinimizeToTray()
        {
            WindowState = FormWindowState.Minimized;
            ShowInTaskbar = false;
            Hide();
        }

        private void RestoreFromTray()
        {
            ShowInTaskbar = true;
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
        }

        private string BuildLaptopOverlayLine(SystemMetrics metrics, OverlaySettings options)
        {
            if (options == null || !options.ShowLaptopGroup) return "";
            var parts = new List<string>();
            if (options.ShowCpu)
                parts.Add("CPU " + (metrics.CpuPercent < 0 ? "--" : Math.Round(metrics.CpuPercent).ToString("0") + "%"));
            if (options.ShowMemory)
            {
                var ram = metrics.RamTotalBytes == 0 ? "--" :
                    (metrics.RamUsedBytes / 1073741824.0).ToString("0.0") + "/" +
                    (metrics.RamTotalBytes / 1073741824.0).ToString("0.0") + "GB";
                parts.Add("RAM " + ram);
            }
            if (options.ShowDisk)
                parts.Add("Disk " + (metrics.DiskPercent < 0 ? "--" : Math.Round(metrics.DiskPercent).ToString("0") + "%"));
            if (options.ShowNetwork)
            {
                var down = metrics.NetworkDownMbps < 0 ? "--" : metrics.NetworkDownMbps.ToString("0.0");
                var up = metrics.NetworkUpMbps < 0 ? "--" : metrics.NetworkUpMbps.ToString("0.0");
                parts.Add(metrics.NetworkKind + " ↓" + down + " ↑" + up + "Mbps");
            }
            if (options.ShowInternet)
                parts.Add("Internet " + (!metrics.InternetKnown ? "--" : (metrics.InternetConnected ? "ON" : "OFF")));
            if (options.ShowGpu)
                parts.Add("GPU " + (metrics.GpuPercent < 0 ? "--" : Math.Round(metrics.GpuPercent).ToString("0") + "%"));
            return parts.Count == 0 ? "" : "Laptop | " + string.Join(" | ", parts.ToArray());
        }

        private string BuildAgentOverlayLine(int online, string state, OverlaySettings options)
        {
            if (options == null || !options.ShowAgentGroup) return "";
            var parts = new List<string>();
            if (options.ShowAgentOnline) parts.Add("Online " + online);
            if (options.ShowAgentState) parts.Add(state);
            if (options.ShowPdaRequests) parts.Add("APK " + Interlocked.Read(ref _localPdaRequests));
            if (options.ShowAgentResponses) parts.Add("Phản hồi " + Interlocked.Read(ref _localAgentResponses));
            if (options.ShowWmsSession) parts.Add("Supra " + (HasUsableWmsSession() ? "Sẵn sàng" : "Chưa sẵn sàng"));
            return parts.Count == 0 ? "" : "Agent | " + string.Join(" | ", parts.ToArray());
        }

        private void UpdateTrayMonitor()
        {
            try
            {
                var metrics = _systemMonitor.Sample();
                var compact = metrics.Compact();
                if (compact.Length > 63) compact = compact.Substring(0, 63);
                _tray.Text = compact;
                _trayStatusItem.Text = metrics.MenuText();

                var online = _leaderCoordinator == null
                    ? (_listenCts != null ? 1 : (HasUsableWmsSession() ? 1 : 0))
                    : _leaderCoordinator.OnlineAgentCount;
                var state = _leaderCoordinator == null
                    ? (_listenCts != null ? "FIRESTORE" : "CHƯA PHỐI HỢP")
                    : (!_leaderCoordinator.IsTransportHealthy
                        ? "FIRESTORE OFFLINE"
                        : (_leaderCoordinator.IsLeader ? "ACTIVE" : "STANDBY"));

                if (_statusOverlay != null)
                {
                    var options = _statusOverlay.DisplaySettings;
                    _statusOverlay.UpdateMetrics(
                        BuildLaptopOverlayLine(metrics, options),
                        BuildAgentOverlayLine(online, state, options));
                }
            }
            catch
            {
                _tray.Text = "SUPRA Agent";
                _trayStatusItem.Text = "Máy: chưa đọc được tài nguyên";
                if (_statusOverlay != null)
                    _statusOverlay.UpdateMetrics("Laptop | chưa đọc được tài nguyên máy", "Agent | chưa đọc được trạng thái");
            }
        }

        private void InitializeStatusOverlaySafe(bool retry = false)
        {
            if (_statusOverlay != null) return;
            if (_overlayInitFailed && !retry) return;
            _overlayInitFailed = false;
            try
            {
                var overlay = new StatusOverlayForm(_overlaySettings, OverlaySettingsFile);
                overlay.SettingsChanged += () =>
                {
                    RefreshOverlayMenu();
                    UpdateTrayMonitor();
                };
                _statusOverlay = overlay;
                if (overlay.OverlayVisible) overlay.Show();
                AgentDiagnostics.Write("OVERLAY init=PASS mode=lazy-after-main-shown");
            }
            catch (Exception ex)
            {
                _overlayInitFailed = true;
                AgentDiagnostics.Write(
                    "OVERLAY init=FAIL type=" + ex.GetType().Name +
                    " message=" + AgentDiagnostics.Sanitize(ex.Message) +
                    " detail=" + AgentDiagnostics.Sanitize(ex.ToString()));
            }
            RefreshOverlayMenu();
        }

        private void ToggleOverlayVisibility()
        {
            InitializeStatusOverlaySafe(true);
            if (_statusOverlay == null) return;
            try { _statusOverlay.SetOverlayVisible(!_statusOverlay.OverlayVisible); }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("OVERLAY visibility-fail type=" + ex.GetType().Name);
            }
        }

        private void ToggleOverlayLock()
        {
            InitializeStatusOverlaySafe(true);
            if (_statusOverlay == null) return;
            try { _statusOverlay.SetLocked(!_statusOverlay.IsLocked); }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("OVERLAY lock-fail type=" + ex.GetType().Name);
            }
        }

        private void SetOverlayOpacitySafe(double opacity)
        {
            InitializeStatusOverlaySafe(true);
            if (_statusOverlay == null) return;
            try { _statusOverlay.SetOverlayOpacity(opacity); }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("OVERLAY opacity-fail type=" + ex.GetType().Name);
            }
        }

        private void OpenOverlaySettings()
        {
            InitializeStatusOverlaySafe(true);
            if (_statusOverlay == null)
            {
                MessageBox.Show(
                    "Bảng nổi chưa khởi tạo được. Có thể thử lại ngay; mở log Kỹ thuật AI để xem chẩn đoán.",
                    "Agent Auto Confirm Pick Pack",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            try
            {
                using (var settings = new OverlaySettingsForm(_statusOverlay))
                    settings.ShowDialog(this);
                RefreshOverlayMenu();
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("OVERLAY settings-fail type=" + ex.GetType().Name);
                MessageBox.Show(
                    "Không mở được cài đặt bảng nổi. Đã ghi log cục bộ.",
                    "Agent Auto Confirm Pick Pack",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
        }

        private void EnsureEmbeddedOverlaySettings()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(EnsureEmbeddedOverlaySettings));
                return;
            }
            if (_embeddedOverlaySettings != null && !_embeddedOverlaySettings.IsDisposed) return;

            InitializeStatusOverlaySafe(true);
            _overlaySettingsHost.Controls.Clear();
            if (_statusOverlay == null)
            {
                _overlaySettingsHost.Controls.Add(new Label
                {
                    Left = 24,
                    Top = 24,
                    Width = 760,
                    Height = 54,
                    Text = "Không khởi tạo được bảng nổi. Mở tab Chẩn đoán kỹ thuật để xem log rồi quay lại tab này để thử lại.",
                    ForeColor = Color.FromArgb(180, 76, 60)
                });
                return;
            }

            try
            {
                _embeddedOverlaySettings = new OverlaySettingsForm(_statusOverlay);
                _embeddedOverlaySettings.PrepareEmbedded();
                _overlaySettingsHost.Controls.Add(_embeddedOverlaySettings);
                _embeddedOverlaySettings.Show();
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("OVERLAY embedded-settings-fail type=" + ex.GetType().Name);
                _embeddedOverlaySettings = null;
                _overlaySettingsHost.Controls.Add(new Label
                {
                    Left = 24,
                    Top = 24,
                    Width = 760,
                    Height = 54,
                    Text = "Không hiển thị được cài đặt bảng nổi. Đã ghi log kỹ thuật.",
                    ForeColor = Color.FromArgb(180, 76, 60)
                });
            }
        }

        private void RefreshOverlayMenu()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RefreshOverlayMenu));
                return;
            }

            var visible = _statusOverlay != null ? _statusOverlay.OverlayVisible : _overlaySettings.Visible;
            var locked = _statusOverlay != null ? _statusOverlay.IsLocked : _overlaySettings.Locked;
            var opacity = _statusOverlay != null ? _statusOverlay.OverlayOpacity : _overlaySettings.Opacity;

            _trayOverlayVisibleItem.Checked = visible;
            _trayOverlayLockItem.Checked = locked;
            _trayOverlayVisibleItem.Enabled = true;
            _trayOverlayLockItem.Enabled = true;
            _trayOverlayOpacityMenu.Enabled = true;
            _overlaySettingsButton.Enabled = true;
            _overlaySettingsButton.Text = _overlayInitFailed ? "Thử lại cài đặt bảng nổi" : "Cài đặt bảng nổi";
            if (_overlayInitFailed)
                _trayOverlayVisibleItem.Text = "Bảng nổi lỗi - bấm để thử lại";
            else
                _trayOverlayVisibleItem.Text = "Hiển thị bảng nổi";

            foreach (ToolStripItem item in _trayOverlayOpacityMenu.DropDownItems)
            {
                var menuItem = item as ToolStripMenuItem;
                if (menuItem == null || !(menuItem.Tag is double)) continue;
                var value = (double)menuItem.Tag;
                menuItem.Checked = Math.Abs(value - opacity) < 0.02;
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
                _wmsCapture.Text = hasWmsSession ? "Phiên Supra đang sẵn sàng" : "Đăng nhập hệ thống Supra";
                _wmsTest.Enabled = enabled;
            });
        }

        private bool HasUsableWmsSession()
        {
            lock (_wmsSessionLock)
                return _wmsSession != null && _wmsSession.IsValidHy1();
        }

        private void SearchManualPicklists()
        {
            string query = "";
            UiSync(() =>
            {
                query = (_manualPicklistQuery.Text ?? "").Trim();
                _manualPicklistSearch.Enabled = false;
                _manualPicklistConfirm.Enabled = false;
                _manualPicklistResults.Items.Clear();
                _manualPicklistStatus.Text = "Đang tìm PickList...";
                _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            });

            try
            {
                if (query.Length < 3 || query.Length > 5)
                    throw new InvalidOperationException("Nhập từ 3 đến 5 chữ số.");
                foreach (var ch in query)
                    if (!char.IsDigit(ch))
                        throw new InvalidOperationException("Chỉ được nhập chữ số.");

                if (!HasAgentSession())
                    throw new InvalidOperationException("Cần xác minh Agent bằng tài khoản ADMIN trước.");
                var wmsSession = SnapshotWmsSession();
                if (wmsSession == null || !wmsSession.IsValidHy1())
                    throw new InvalidOperationException("Phiên Supra chưa sẵn sàng.");

                var result = _picklistCache.SearchContains(wmsSession, query, 50);
                if (string.Equals(result.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                    ClearWmsSessionAfterExpiry();

                Ui(() =>
                {
                    _manualPicklistResults.Items.Clear();
                    foreach (var code in result.Matches)
                        _manualPicklistResults.Items.Add(code);

                    if (string.Equals(result.Result, "FOUND", StringComparison.Ordinal))
                    {
                        _manualPicklistStatus.Text =
                            "Tìm thấy " + result.Matches.Count +
                            (result.Matches.Count >= 50 ? " PickList đầu tiên." : " PickList.") +
                            " Hãy chọn đúng PickList để xác nhận.";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(35, 122, 76);
                    }
                    else if (string.Equals(result.Result, "NOT_FOUND", StringComparison.Ordinal))
                    {
                        _manualPicklistStatus.Text = "Không tìm thấy PickList phù hợp.";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                    }
                    else
                    {
                        _manualPicklistStatus.Text = "Không thể tìm PickList: " + (result.Result ?? "LOOKUP_ERROR") + ".";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                    }
                });

                AgentDiagnostics.WriteAudit(
                    "MANUAL_PICKLIST_SEARCH result=" + result.Result +
                    " query_length=" + query.Length +
                    " matches=" + result.Matches.Count +
                    " cache_count=" + result.CacheCount +
                    " values=redacted");
            }
            catch (Exception ex)
            {
                Ui(() =>
                {
                    _manualPicklistStatus.Text = SafeMessage(ex);
                    _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                });
                Log("Manual PickList search fail: " + SafeMessage(ex));
            }
            finally
            {
                Ui(() =>
                {
                    var length = (_manualPicklistQuery.Text ?? "").Trim().Length;
                    _manualPicklistSearch.Enabled = length >= 3 && length <= 5;
                });
            }
        }

        private void ConfirmManualPicklist()
        {
            string pickListCode = "";
            UiSync(() =>
            {
                pickListCode = Convert.ToString(_manualPicklistResults.SelectedItem) ?? "";
                _manualPicklistConfirm.Enabled = false;
                _manualPicklistSearch.Enabled = false;
                _manualPicklistStatus.Text = "Đang xác nhận PickList...";
                _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            });

            try
            {
                if (string.IsNullOrWhiteSpace(pickListCode))
                    throw new InvalidOperationException("Chưa chọn PickList.");
                if (!HasAgentSession())
                    throw new InvalidOperationException("Phiên xác minh Agent không còn hợp lệ.");

                EnsureFreshToken();
                var appSession = SnapshotSession();
                if (!_agentSessionGate.IsCurrent(appSession, _agentInstanceId))
                    throw new InvalidOperationException("Phiên Agent này đã bị thay thế bởi Agent khác.");

                var wmsSession = SnapshotWmsSession();
                if (wmsSession == null || !wmsSession.IsValidHy1())
                    throw new InvalidOperationException("Phiên Supra chưa sẵn sàng.");

                var requestId = "manual:" + Guid.NewGuid().ToString("N");
                var guard = _confirmationGuard.TryBegin(
                    appSession,
                    pickListCode,
                    requestId,
                    _agentInstanceId,
                    "manual:" + appSession.UserId);

                if (guard.AlreadyConfirmed)
                {
                    Ui(() =>
                    {
                        _manualPicklistStatus.Text = "PickList này đã được xác nhận trước đó. Không gửi lại.";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(35, 122, 76);
                    });
                    AgentDiagnostics.WriteAudit("MANUAL_PICKLIST_CONFIRM result=ALREADY_CONFIRMED guard=" + Short(guard.GuardId));
                    return;
                }

                if (!guard.Acquired || guard.InProgressOrUncertain)
                {
                    Ui(() =>
                    {
                        _manualPicklistStatus.Text = "Trạng thái xác nhận chưa rõ. Không gửi lại; hãy kiểm tra trên SFT / SFT 3.";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                    });
                    AgentDiagnostics.WriteAudit("MANUAL_PICKLIST_CONFIRM result=GUARD_UNCERTAIN guard=" + Short(guard.GuardId));
                    return;
                }

                var confirmed = WmsPicklistConfirmClient.Confirm(wmsSession, pickListCode);
                if (string.Equals(confirmed.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                    ClearWmsSessionAfterExpiry();

                if (string.Equals(confirmed.Result, "CONFIRMED", StringComparison.Ordinal))
                {
                    _confirmationGuard.MarkLocalConfirmed(guard.GuardId);
                    Ui(() =>
                    {
                        _manualPicklistStatus.Text = "Xác nhận thành công. Hãy tiếp tục xử lý trên SFT / SFT 3.";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(35, 122, 76);
                    });
                }
                else if (IsSafeConfirmationFailure(confirmed.Result))
                {
                    _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);
                    Ui(() =>
                    {
                        _manualPicklistStatus.Text = "Xác nhận không thành công: " + confirmed.Result + ".";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                    });
                }
                else
                {
                    Ui(() =>
                    {
                        _manualPicklistStatus.Text = "Kết quả xác nhận chưa rõ. Không bấm lại; hãy kiểm tra trên SFT / SFT 3.";
                        _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                    });
                }

                AgentDiagnostics.WriteAudit(
                    "MANUAL_PICKLIST_CONFIRM result=" + (confirmed.Result ?? "CONFIRM_ERROR") +
                    " http=" + confirmed.StatusCode +
                    " route=" + confirmed.Route +
                    " guard=" + Short(guard.GuardId) +
                    " picklist=redacted");
            }
            catch (Exception ex)
            {
                Ui(() =>
                {
                    _manualPicklistStatus.Text = SafeMessage(ex);
                    _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                });
                Log("Manual PickList confirm fail: " + SafeMessage(ex));
            }
            finally
            {
                Ui(() =>
                {
                    var length = (_manualPicklistQuery.Text ?? "").Trim().Length;
                    _manualPicklistSearch.Enabled = length >= 3 && length <= 5;
                    _manualPicklistConfirm.Enabled =
                        _manualPicklistResults.SelectedItem != null &&
                        HasAgentSession() &&
                        HasUsableWmsSession();
                });
            }
        }

        private void ActivateRelayRuntime()
        {
            try
            {
                if (_listenCts == null) StartListening();
                Ui(() => _identity.Text = "Agent: " + Environment.MachineName + " / " + CurrentSessionUser() + " / FIRESTORE");
            }
            catch (Exception ex)
            {
                Log("Relay runtime chưa thể tự khởi động: " + SafeMessage(ex));
            }
        }

        private void StartLeaderCoordination()
        {
            if (_leaderCoordinator != null) return;
            _leaderCoordinator = new FirestoreAgentLeaderCoordinator(
                SnapshotSession,
                EnsureFreshToken,
                HasUsableWmsSession,
                _agentInstanceId,
                Log,
                (role, primaryId) =>
                {
                    Ui(() =>
                    {
                        var roleText = role == FirestoreAgentRole.PRIMARY
                            ? "PRIMARY"
                            : (role == FirestoreAgentRole.STANDBY ? "STANDBY" : "FROZEN");
                        _identity.Text = "Agent: " + Environment.MachineName + " / " + CurrentSessionUser() + " / " + roleText;
                    });
                });
            _leaderCoordinator.Start();
        }

        private void StopLeaderCoordination()
        {
            var coordinator = _leaderCoordinator;
            _leaderCoordinator = null;
            try { if (coordinator != null) coordinator.Stop(); } catch { }
        }

        private void ProcessPendingJobsSnapshot()
        {
            if (_leaderCoordinator == null || !_leaderCoordinator.IsLeader) return;
            try
            {
                EnsureFreshToken();
                var session = SnapshotSession();
                var raw = RequestJson("GET", JobsUrl(session), null, null);
                if (string.IsNullOrWhiteSpace(raw) || string.Equals(raw.Trim(), "null", StringComparison.OrdinalIgnoreCase))
                    return;
                var jobs = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (jobs == null) return;
                foreach (var pair in jobs)
                {
                    if (_leaderCoordinator == null || !_leaderCoordinator.IsLeader) return;
                    var job = pair.Value as Dictionary<string, object>;
                    if (job != null) HandleJob(pair.Key, job);
                }
            }
            catch (Exception ex)
            {
                Log("AGENT HA pending-scan fail: " + SafeMessage(ex));
            }
        }

        private void TryRestoreWmsSessionFileFirst()
        {
            if (HasUsableWmsSession()) return;
            Ui(() => _wmsStatus.Text = "Supra WMS: đang đọc phiên đã mã hóa...");
            try
            {
                var stored = WmsSessionStore.Load(WmsSessionFile);
                if (stored == null)
                    throw new InvalidOperationException("Chưa có file phiên WMS trên Windows user này.");

                var probe = WmsReadOnlyClient.ProbeApi(stored);
                if (!string.Equals(probe.Result, "PASS", StringComparison.Ordinal))
                    throw new InvalidOperationException("Phiên WMS đã lưu không còn hợp lệ: " + probe.Result + ".");

                lock (_wmsSessionLock) _wmsSession = stored;
                Ui(() => _wmsStatus.Text = "Supra WMS: phiên cũ hợp lệ · đang nạp Picklist");
                SetProbeButtonsEnabled(true);
                Log("WMS SESSION RESTORE PASS source=dpapi_file values=redacted.");
                if (PreloadPicklistCache(stored, "STARTUP_FILE"))
                    return;

                throw new InvalidOperationException("Không nạp được danh sách Picklist từ phiên đã lưu.");
            }
            catch (Exception ex)
            {
                WmsSessionStore.Clear(WmsSessionFile);
                lock (_wmsSessionLock) _wmsSession = null;
                _picklistCache.Clear();
                Ui(() => _wmsStatus.Text = "Supra WMS: phiên cũ không dùng được · đang mở đăng nhập");
                SetProbeButtonsEnabled(true);
                Log("WMS SESSION RESTORE unavailable; opening_local_browser=true detail=" + SafeMessage(ex));
            }

            CaptureWmsSession();
        }

        private bool PreloadPicklistCache(WmsSessionSnapshot session, string reason)
        {
            try
            {
                var preload = _picklistCache.Preload(session);
                Log(
                    "PICKLIST CACHE preload result=" + preload.Result +
                    " mode=" + preload.CacheMode +
                    " count=" + preload.CacheCount +
                    " ms=" + preload.ElapsedMs +
                    " reason=" + reason +
                    " values=redacted");
                if (string.Equals(preload.Result, "PASS", StringComparison.Ordinal))
                {
                    WmsSessionStore.Save(WmsSessionFile, session);
                    Ui(() => _wmsStatus.Text = "Supra WMS: OK · Picklist cache " + preload.CacheCount);
                    SetProbeButtonsEnabled(true);
                    Log("WMS SESSION FILE renew=PASS protection=DPAPI_CURRENT_USER values=redacted.");
                    return true;
                }

                if (string.Equals(preload.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                {
                    lock (_wmsSessionLock) _wmsSession = null;
                    _picklistCache.Clear();
                    WmsSessionStore.Clear(WmsSessionFile);
                    Ui(() => _wmsStatus.Text = "Supra WMS: phiên hết hạn · cần đăng nhập lại");
                    SetProbeButtonsEnabled(true);
                }
            }
            catch (Exception ex)
            {
                Log("PICKLIST CACHE preload fail reason=" + reason + " detail=" + SafeMessage(ex));
            }
            return false;
        }

        private void StartupSequence()
        {
            UserStartupRegistration.EnsureRegistered();
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
                        AgentRuntimeGuard.MarkPlannedExit();
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
                    SetAgentAuthUi(false);
                    Log("Chưa có phiên ADMIN Agent đã lưu trên Windows user này.");
                    return;
                }
                lock (_sessionLock) _session = stored;
                Log("Đã đọc phiên Agent từ Windows DPAPI; đang xác minh lại quyền ADMIN qua Firebase.");
                RefreshDirect();
                var restored = SnapshotSession();
                var claim = _agentSessionGate.Claim(restored, _agentInstanceId, false);
                if (claim.Conflict || !claim.Claimed)
                    throw new InvalidOperationException("Tài khoản ADMIN đang được Agent khác sử dụng.");
                Ui(() =>
                {
                    _identity.Text = "Agent: " + Environment.MachineName + " / " + CurrentSessionUser();
                    _listen.Enabled = true;
                    _testOffice.Enabled = true;
                });
                SetAgentAuthUi(true);
                SetProbeButtonsEnabled(true);
                Log("Khôi phục ADMIN Agent PASS.");
                ActivateRelayRuntime();
                Task.Run(() => TryRestoreWmsSessionFileFirst());
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
                SetAgentAuthUi(false);
                SetProbeButtonsEnabled(false);
                Log("Phiên Agent cũ bị loại; cần đăng nhập lại bằng ADMIN: " + SafeMessage(ex));
            }
        }

        private static string ResolveAdminFirebaseEmail(string identifier)
        {
            var value = (identifier ?? "").Trim().ToLowerInvariant();
            if (value.Length == 0) throw new InvalidOperationException("Nhập tài khoản hoặc email ADMIN.");
            if (value.IndexOf("@", StringComparison.Ordinal) > 0) return value;
            if (!Regex.IsMatch(value, "^[a-z0-9._-]{1,64}$"))
                throw new InvalidOperationException("Tài khoản ADMIN không hợp lệ.");
            var seed = Regex.Replace(value, "[^a-z0-9._-]", "-").Trim('-');
            if (seed.Length > 44) seed = seed.Substring(0, 44);
            if (seed.Length == 0) seed = "user";
            return "admin." + seed + "@auth.supra.invalid";
        }

        private AgentSession FirebasePasswordLoginDirect(string identifier, string password)
        {
            var email = ResolveAdminFirebaseEmail(identifier);
            if (string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException("Nhập mật khẩu ADMIN.");

            var url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
                      Uri.EscapeDataString(AgentConfig.FirebaseApiKey);
            var payload = _json.Serialize(new Dictionary<string, object>
            {
                { "email", email },
                { "password", password },
                { "returnSecureToken", true }
            });
            Log("Firebase ADMIN login START host=identitytoolkit.googleapis.com ssid=" + GetSsid());
            var root = Map(_json.DeserializeObject(RequestJson("POST", url, payload, "application/json")));
            var idToken = MapString(root, "idToken");
            var refreshToken = MapString(root, "refreshToken");
            var expires = ParseInt(root, "expiresIn", 3600);
            var firebaseUid = MapString(root, "localId");
            if (string.IsNullOrWhiteSpace(firebaseUid)) firebaseUid = FirebaseUidFromIdToken(idToken);
            var audience = FirebaseAudienceFromIdToken(idToken);
            var tokenRole = FirebaseClaimFromIdToken(idToken, "app_role");
            var tokenBaseRole = FirebaseClaimFromIdToken(idToken, "app_base_role");
            var tokenAppUser = FirebaseClaimFromIdToken(idToken, "app_user_id");
            if (!string.Equals(audience, AgentConfig.FirebaseProjectId, StringComparison.Ordinal))
                throw new InvalidOperationException("Firebase token sai project audience.");
            if (!string.Equals(tokenRole, "ADMIN", StringComparison.Ordinal) ||
                !string.Equals(tokenBaseRole, "ADMIN", StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(tokenAppUser))
                throw new InvalidOperationException("Chỉ tài khoản ADMIN thực đã đồng bộ Firebase mới được xác minh Agent.");

            return new AgentSession
            {
                IdToken = idToken,
                RefreshToken = refreshToken,
                UserId = firebaseUid,
                AppUserId = tokenAppUser,
                LoginName = identifier.Trim(),
                Role = tokenRole,
                BaseRole = tokenBaseRole,
                ExpiresUtc = DateTime.UtcNow.AddSeconds(Math.Max(60, expires))
            };
        }

        private void PairLogin()
        {
            string email = "", password = "";
            UiSync(() =>
            {
                email = _username.Text.Trim();
                password = _password.Text;
                _password.Clear();
                _pair.Enabled = false;
            });
            if (email.Length == 0 || password.Length == 0)
            {
                Log("Nhập tài khoản/email ADMIN và mật khẩu.");
                Ui(() => _pair.Enabled = true);
                return;
            }

            try
            {
                LogNetworkSnapshot("admin-firebase-login");
                var next = FirebasePasswordLoginDirect(email, password);
                var claim = _agentSessionGate.Claim(next, _agentInstanceId, false);
                if (claim.Conflict)
                {
                    var proceed = false;
                    UiSync(() =>
                    {
                        proceed = MessageBox.Show(
                            "Tài khoản ADMIN này đang đăng nhập trên Agent khác.\r\n\r\n" +
                            "Nếu tiếp tục, Agent cũ sẽ mất quyền xác nhận đơn. Web và App vẫn giữ nguyên.\r\n\r\n" +
                            "Tiếp tục đăng nhập Agent này?",
                            "Xác nhận thay thế Agent",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Warning) == DialogResult.Yes;
                    });
                    if (!proceed)
                    {
                        Log("Firebase ADMIN login CANCEL same-channel-conflict=true");
                        return;
                    }
                    claim = _agentSessionGate.Claim(next, _agentInstanceId, true);
                }
                if (!claim.Claimed)
                    throw new InvalidOperationException("Không giành được phiên Agent.");

                lock (_sessionLock) _session = next;
                SaveStoredSession(next);
                ExitAuthorization.SaveVerifier(ExitVerifierFile, next.AppUserId, password);
                Ui(() =>
                {
                    _password.Clear();
                    _identity.Text = "Agent: " + Environment.MachineName + " / " + CurrentSessionUser();
                    _listen.Enabled = true;
                    _testOffice.Enabled = true;
                });
                SetAgentAuthUi(true);
                SetProbeButtonsEnabled(true);
                Log(
                    "ADMIN Agent Firebase login PASS admin=" + next.AppUserId +
                    " machine=" + Environment.MachineName +
                    " instance=" + Short(_agentInstanceId) +
                    " firebase_uid=" + Fingerprint(next.UserId)
                );
                ActivateRelayRuntime();
                Task.Run(() => TryRestoreWmsSessionFileFirst());
            }
            catch (Exception ex)
            {
                Log("Đăng nhập ADMIN Agent Firebase thất bại: " + SafeMessage(ex));
            }
            finally
            {
                password = null;
                SetAgentAuthUi(HasAgentSession());
            }
        }

        private bool HasAgentSession()
        {
            lock (_sessionLock) return _session != null && !string.IsNullOrWhiteSpace(_session.RefreshToken);
        }

        private void SetAgentAuthUi(bool authenticated)
        {
            string loginName = "";
            string appUser = "";
            lock (_sessionLock)
            {
                if (_session != null)
                {
                    loginName = _session.LoginName ?? "";
                    appUser = _session.AppUserId ?? "";
                }
            }

            Ui(() =>
            {
                _username.Enabled = !authenticated;
                _password.Enabled = !authenticated;
                _pair.Enabled = !authenticated;
                _logout.Enabled = authenticated;
                _pair.Text = authenticated ? "Đã xác minh ADMIN" : "Đăng nhập ADMIN";
                if (authenticated && !string.IsNullOrWhiteSpace(loginName))
                    _username.Text = loginName;
                if (!authenticated)
                {
                    _username.Clear();
                    _password.Clear();
                }
                _agentAuthStatus.Text = authenticated
                    ? "Xác minh Agent: ĐÃ ĐĂNG NHẬP" + (string.IsNullOrWhiteSpace(appUser) ? "" : " · " + appUser)
                    : "Xác minh Agent: CHƯA ĐĂNG NHẬP";
                _agentAuthStatus.ForeColor = authenticated
                    ? Color.FromArgb(35, 122, 76)
                    : Color.FromArgb(180, 76, 60);
            });
        }

        private void LogoutAgent()
        {
            string previousUser = "";
            try
            {
                var current = SnapshotSession();
                previousUser = current.AppUserId ?? "";
            }
            catch { }

            AgentSession releasing = null;
            try { releasing = SnapshotSession(); } catch { }
            try { StopListening(); } catch { }
            try { if (releasing != null) _agentSessionGate.Release(releasing, _agentInstanceId); } catch { }
            lock (_sessionLock) _session = null;
            ClearStoredSession();
            try { if (File.Exists(ExitVerifierFile)) File.Delete(ExitVerifierFile); } catch { }

            Ui(() =>
            {
                _identity.Text = "Agent: cần đăng nhập ADMIN";
                _relay.Text = "Relay: chưa xác minh Agent";
                _listen.Enabled = false;
                _testOffice.Enabled = false;
            });
            SetAgentAuthUi(false);
            SetProbeButtonsEnabled(false);
            Log("ADMIN Agent logout PASS previous_admin=" + previousUser + " stored_session=cleared");
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
                return ProbeHttp("FIRESTORE", AgentConfig.FirestoreRelayCollectionUrl + "?pageSize=1", session.IdToken);
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
                var probe = WmsReadOnlyClient.ProbeApi(captured);
                if (!string.Equals(probe.Result, "PASS", StringComparison.Ordinal))
                    throw new InvalidOperationException("Phiên WMS vừa lấy chưa sử dụng được: " + probe.Result + ".");
                lock (_wmsSessionLock) _wmsSession = captured;
                Ui(() => _wmsStatus.Text = "WMS: phiên HY1 đã lấy · đang nạp Picklist");
                Log("WMS SESSION PASS scope=HY1 storage=BROWSER_PROFILE_PLUS_RAM_CAPTURE values=redacted.");
                PreloadPicklistCache(captured, "MANUAL_LOGIN");
            }
            catch (Exception ex)
            {
                lock (_wmsSessionLock) _wmsSession = null;
                _picklistCache.Clear();
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
                    lock (_wmsSessionLock) _wmsSession = null;
                    _picklistCache.Clear();
                    Log("WMS phiên cũ hết hạn; tự mở trình duyệt để lấy phiên mới một lần.");
                    var refreshed = WmsBrowserCapture.CaptureSession(300, message => Log("WMS " + message));
                    lock (_wmsSessionLock) _wmsSession = refreshed;
                    session = refreshed;
                    api = WmsReadOnlyClient.ProbeApi(refreshed);
                    Log("WMS PROBE RETRY " + api.Summary());
                }

                if (string.Equals(api.Result, "PASS", StringComparison.Ordinal))
                {
                    Ui(() => _wmsStatus.Text = "WMS: PASS · API HY1 · " + api.Route + " · " + api.ElapsedMs + "ms");
                    Log("WMS READ_ONLY PASS ui=" + ui.Result + " api=PASS route=" + api.Route + " no_mutation=true.");
                    if (session != null && session.IsValidHy1())
                        PreloadPicklistCache(session, "MANUAL_TEST");
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
                Ui(() => _relay.Text = "Relay: Google OK · đang kiểm tra Firestore...");
                var session = SnapshotSession();
                var result = ProbeHttp("FIRESTORE_RELAY", AgentConfig.FirestoreRelayCollectionUrl + "?pageSize=1", session.IdToken);
                LogProbeResult(result);

                if (result.Result == "PASS")
                {
                    Ui(() => _relay.Text = "Relay: FIRESTORE PASS / Office");
                    Log("OFFICE PASS ssid=" + GetSsid() + " admin=" + session.AppUserId + " instance=" + Short(_agentInstanceId) + " firestore_ms=" + result.ElapsedMs + ".");
                }
                else if (result.Result == "PROXY_BLOCK")
                {
                    Ui(() => _relay.Text = "Relay: OFFICE PROXY BLOCK / Firestore");
                    Log("OFFICE PROXY_BLOCK FIRESTORE http=" + result.StatusCode + " host=" + result.FinalHost + ".");
                }
                else
                {
                    Ui(() => _relay.Text = "Relay: Firestore " + result.Result + " / HTTP " + result.StatusCode);
                    Log("OFFICE FIRESTORE_FAIL result=" + result.Result + " http=" + result.StatusCode + ".");
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

        private FirestoreConfirmationOutcome ProcessFirestoreConfirmation(FirestoreConfirmationWorkItem work)
        {
            var appSession = SnapshotSession();
            var rate = _firestoreRateLimiter.Check(appSession, work.PickerUid, work.PickerUserId);
            if (rate.IsLocked)
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = "PICKER_LOCKED",
                    CacheMode = "RATE_LIMIT",
                    Route = "NONE",
                    Rate = rate
                };
            }

            var wmsSession = SnapshotWmsSession();
            if (wmsSession == null || !wmsSession.IsValidHy1())
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = "WMS_SESSION_REQUIRED",
                    CacheMode = "NO_SESSION",
                    Route = "NONE",
                    Rate = rate
                };
            }

            var lookup = _picklistCache.Lookup(wmsSession, work.Suffix);
            if (string.Equals(lookup.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                ClearWmsSessionAfterExpiry();

            if (string.Equals(lookup.Result, "NOT_FOUND", StringComparison.Ordinal))
            {
                rate = _firestoreRateLimiter.RecordNotFound(appSession, work.PickerUid, work.PickerUserId, work.RequestId);
                return new FirestoreConfirmationOutcome
                {
                    Result = rate.IsLocked ? "PICKER_LOCKED" : "NOT_FOUND",
                    CacheMode = lookup.CacheMode,
                    Route = lookup.Route,
                    Http = lookup.StatusCode,
                    OperationMs = Math.Max(0L, lookup.ElapsedMs),
                    Matches = 0,
                    Rate = rate
                };
            }

            if (!string.Equals(lookup.Result, "FOUND", StringComparison.Ordinal))
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = lookup.Result ?? "LOOKUP_ERROR",
                    CacheMode = lookup.CacheMode,
                    Route = lookup.Route,
                    Http = lookup.StatusCode,
                    OperationMs = Math.Max(0L, lookup.ElapsedMs),
                    Matches = Math.Max(0, lookup.MatchCount),
                    Rate = rate
                };
            }

            _firestoreRateLimiter.ClearFound(appSession, work.PickerUid);
            rate = new PickerRateDecision();

            if (work.CreatedAtMs > 0 && DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - work.CreatedAtMs >= 25000)
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = "REQUEST_EXPIRED",
                    CacheMode = lookup.CacheMode + "+EXPIRED",
                    Route = lookup.Route,
                    Http = lookup.StatusCode,
                    OperationMs = Math.Max(0L, lookup.ElapsedMs),
                    Matches = Math.Max(0, lookup.MatchCount),
                    Rate = rate
                };
            }

            var exact = WmsExactPicklistResolver.Resolve(wmsSession, work.Suffix);
            if (!string.Equals(exact.Result, "FOUND", StringComparison.Ordinal) ||
                exact.MatchCount != 1 || string.IsNullOrWhiteSpace(exact.PickListCode))
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = exact.Result ?? "EXACT_CODE_NOT_RESOLVED",
                    CacheMode = lookup.CacheMode + "+EXACT_RESOLVE",
                    Route = exact.Route,
                    Http = exact.StatusCode,
                    OperationMs = Math.Max(0L, lookup.ElapsedMs) + Math.Max(0L, exact.ElapsedMs),
                    Matches = Math.Max(0, exact.MatchCount),
                    Rate = rate
                };
            }

            if (work.CreatedAtMs > 0 && DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - work.CreatedAtMs >= 25000)
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = "REQUEST_EXPIRED",
                    CacheMode = lookup.CacheMode + "+EXACT_RESOLVE+EXPIRED",
                    Route = exact.Route,
                    Http = exact.StatusCode,
                    OperationMs = Math.Max(0L, lookup.ElapsedMs) + Math.Max(0L, exact.ElapsedMs),
                    Matches = 1,
                    Rate = rate
                };
            }

            var guard = _confirmationGuard.TryBegin(
                appSession,
                exact.PickListCode,
                work.RequestId,
                _agentInstanceId,
                work.PickerUid);

            if (guard.AlreadyConfirmed)
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = "CONFIRMED",
                    CacheMode = lookup.CacheMode + "+EXACT_RESOLVE+IDEMPOTENT",
                    Route = "FIRESTORE_CONFIRM_GUARD",
                    Http = 200,
                    OperationMs = Math.Max(0L, lookup.ElapsedMs) + Math.Max(0L, exact.ElapsedMs),
                    Matches = 1,
                    Rate = rate,
                    GuardId = guard.GuardId,
                    RetireAtMs = guard.RetireAtMs
                };
            }

            if (!guard.Acquired || guard.InProgressOrUncertain)
            {
                return new FirestoreConfirmationOutcome
                {
                    Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                    CacheMode = lookup.CacheMode + "+EXACT_RESOLVE+GUARD",
                    Route = "FIRESTORE_CONFIRM_GUARD",
                    Http = 409,
                    OperationMs = Math.Max(0L, lookup.ElapsedMs) + Math.Max(0L, exact.ElapsedMs),
                    Matches = 1,
                    Rate = rate,
                    GuardId = guard.GuardId,
                    RetireAtMs = guard.RetireAtMs
                };
            }

            var confirmed = WmsPicklistConfirmClient.Confirm(wmsSession, exact.PickListCode);
            if (string.Equals(confirmed.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                ClearWmsSessionAfterExpiry();

            if (string.Equals(confirmed.Result, "CONFIRMED", StringComparison.Ordinal))
            {
                _confirmationGuard.MarkLocalConfirmed(guard.GuardId);
            }
            else if (IsSafeConfirmationFailure(confirmed.Result))
            {
                _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);
            }

            return new FirestoreConfirmationOutcome
            {
                Result = confirmed.Result ?? "CONFIRM_ERROR",
                CacheMode = lookup.CacheMode + "+EXACT_RESOLVE+GUARD",
                Route = confirmed.Route,
                Http = confirmed.StatusCode,
                OperationMs = Math.Max(0L, lookup.ElapsedMs) + Math.Max(0L, exact.ElapsedMs) + Math.Max(0L, confirmed.ElapsedMs),
                Matches = 1,
                Rate = rate,
                GuardId = guard.GuardId,
                RetireAtMs = guard.RetireAtMs
            };
        }

        private static bool IsSafeConfirmationFailure(string result)
        {
            return string.Equals(result, "FORBIDDEN", StringComparison.Ordinal) ||
                   string.Equals(result, "PROXY_BLOCK", StringComparison.Ordinal) ||
                   string.Equals(result, "PROXY_AUTH_REQUIRED", StringComparison.Ordinal) ||
                   string.Equals(result, "CONFIRM_REJECTED", StringComparison.Ordinal) ||
                   string.Equals(result, "RATE_LIMITED", StringComparison.Ordinal) ||
                   string.Equals(result, "SESSION_EXPIRED", StringComparison.Ordinal);
        }

        private void ClearWmsSessionAfterExpiry()
        {
            lock (_wmsSessionLock) _wmsSession = null;
            _picklistCache.Clear();
            WmsSessionStore.Clear(WmsSessionFile);
            Ui(() => _wmsStatus.Text = "WMS: phiên hết hạn · cần đăng nhập lại");
            SetProbeButtonsEnabled(true);
        }

        private void StartListening()
        {
            try { SnapshotSession(); } catch { Log("Chưa ghép Agent."); return; }
            if (_listenCts != null) return;
            StartLeaderCoordination();
            _listenCts = new CancellationTokenSource();
            Ui(() => { _listen.Text = "Dừng nghe"; _relay.Text = "Relay: đang kết nối Firestore..."; });
            var token = _listenCts.Token;
            Task.Run(() =>
            {
                var transport = new FirestoreConfirmationTransport(
                    SnapshotSession,
                    EnsureFreshToken,
                    _agentInstanceId,
                    GetSsid,
                    Log,
                    Audit,
                    () => Interlocked.Increment(ref _localPdaRequests),
                    () => Interlocked.Increment(ref _localAgentResponses),
                    state => Ui(() => _relay.Text = state),
                    ProcessFirestoreConfirmation,
                    _leaderCoordinator,
                    healthy =>
                    {
                        var coordinator = _leaderCoordinator;
                        if (coordinator != null) coordinator.ReportRelayPoll(healthy);
                        if (coordinator != null && coordinator.IsLeader)
                        {
                            Ui(() => _identity.Text =
                                "Agent: " + Environment.MachineName + " / " + CurrentSessionUser() +
                                (healthy ? " / ACTIVE" : " / ACTIVE · FIRESTORE OFFLINE"));
                        }
                    });
                transport.Run(token);
            }, token);
        }

        private void StopListening()
        {
            var cts = _listenCts; _listenCts = null;
            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (cts != null) cts.Dispose(); } catch { }
            StopLeaderCoordination();
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
            if (_leaderCoordinator == null || !_leaderCoordinator.IsLeader) return;

            object statusObj, sourceObj, suffixObj, pickerUidObj, pickerUserObj, sentObj;
            if (!job.TryGetValue("status", out statusObj)) return;
            var status = Convert.ToString(statusObj) ?? "";
            if (!string.Equals(status, "PENDING", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(status, "SWITCHING", StringComparison.OrdinalIgnoreCase))
                return;

            if (job.TryGetValue("source", out sourceObj) &&
                !string.Equals(Convert.ToString(sourceObj), "ANDROID_POC", StringComparison.Ordinal))
                return;
            if (!job.TryGetValue("suffix", out suffixObj) ||
                !job.TryGetValue("picker_uid", out pickerUidObj) ||
                !job.TryGetValue("picker_user_id", out pickerUserObj))
                return;

            var suffix = Convert.ToString(suffixObj) ?? "";
            var pickerUid = Convert.ToString(pickerUidObj) ?? "";
            var pickerUserId = Convert.ToString(pickerUserObj) ?? "";
            long clientSentAtMs = 0;
            if (job.TryGetValue("client_sent_at_ms", out sentObj))
                long.TryParse(Convert.ToString(sentObj), out clientSentAtMs);

            if (!Regex.IsMatch(suffix, @"^\d{5}$"))
            {
                Log("Relay request=" + Short(jobId) + " bị từ chối vì suffix không đúng 5 số.");
                return;
            }

            if (string.IsNullOrWhiteSpace(pickerUid) || string.IsNullOrWhiteSpace(pickerUserId))
            {
                Log("Relay request=" + Short(jobId) + " thiếu identity Picker.");
                return;
            }

            if (string.Equals(status, "PENDING", StringComparison.OrdinalIgnoreCase) &&
                clientSentAtMs > 0 &&
                NowMs() - clientSentAtMs >= AgentLeaderCoordinator.FailoverAfterMs)
            {
                if (!MarkJobSwitching(jobId))
                    return;
            }

            lock (_acked)
            {
                if (_acked.Contains(jobId)) return;
                _acked.Add(jobId);
            }

            Task.Run(() => HandlePicklistLookupJob(jobId, suffix, pickerUid, pickerUserId, clientSentAtMs));
        }

        private bool MarkJobSwitching(string jobId)
        {
            try
            {
                var session = SnapshotSession();
                var patch = new Dictionary<string, object>
                {
                    { "status", "SWITCHING" },
                    { "switching_at_ms", NowMs() },
                    { "switching_agent_instance_id", _agentInstanceId }
                };
                RequestJson("PATCH", JobUrl(session, jobId), _json.Serialize(patch), "application/json");
                Log("AGENT HA request=" + Short(jobId) + " status=SWITCHING leader=" + Short(_agentInstanceId));
                return true;
            }
            catch (RelayHttpException ex)
            {
                if (ex.StatusCode == 403 && JobAlreadyAcknowledgedByAnotherAgent(SnapshotSession(), jobId))
                    return false;
                Log("AGENT HA switching_fail request=" + Short(jobId) + " detail=" + SafeMessage(ex));
                return false;
            }
            catch (Exception ex)
            {
                Log("AGENT HA switching_fail request=" + Short(jobId) + " detail=" + SafeMessage(ex));
                return false;
            }
        }

        private void HandlePicklistLookupJob(string jobId, string suffix, string pickerUid, string pickerUserId, long clientSentAtMs)
        {
            var session = SnapshotSession();
            try
            {
                if (_leaderCoordinator == null || !_leaderCoordinator.IsLeader)
                {
                    lock (_acked) _acked.Remove(jobId);
                    return;
                }

                Interlocked.Increment(ref _localPdaRequests);
                Audit(
                    "PDA_REQUEST request=" + Short(jobId) +
                    " picker=" + pickerUserId +
                    " picker_uid=" + Fingerprint(pickerUid) +
                    " picklist_last5=" + suffix +
                    " client_sent_at_ms=" + clientSentAtMs +
                    " admin=" + session.AppUserId +
                    " machine=" + Environment.MachineName +
                    " instance=" + Short(_agentInstanceId) +
                    " network=" + GetSsid());

                var rate = _pickerRateLimiter.Check(session, pickerUid, pickerUserId);
                if (rate.IsLocked)
                {
                    AckLookupJob(
                        session,
                        jobId,
                        pickerUserId,
                        suffix,
                        pickerUid,
                        clientSentAtMs,
                        "PICKER_LOCKED",
                        "RATE_LIMIT",
                        "NONE",
                        0,
                        0,
                        0,
                        rate);
                    return;
                }

                CachedPicklistResult lookup;
                var wmsSession = SnapshotWmsSession();
                if (wmsSession == null || !wmsSession.IsValidHy1())
                {
                    lookup = new CachedPicklistResult
                    {
                        Result = "WMS_SESSION_REQUIRED",
                        CacheMode = "NO_SESSION",
                        Route = "NONE",
                        StatusCode = 0,
                        ElapsedMs = 0,
                        MatchCount = 0
                    };
                }
                else
                {
                    lookup = _picklistCache.Lookup(wmsSession, suffix);
                }

                if (string.Equals(lookup.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                {
                    lock (_wmsSessionLock) _wmsSession = null;
                    _picklistCache.Clear();
                    WmsSessionStore.Clear(WmsSessionFile);
                    Ui(() => _wmsStatus.Text = "WMS: phiên hết hạn · cần đăng nhập lại");
                    SetProbeButtonsEnabled(true);
                }

                if ((string.Equals(lookup.Result, "FOUND", StringComparison.Ordinal) ||
                     string.Equals(lookup.Result, "NOT_FOUND", StringComparison.Ordinal)) &&
                    !string.Equals(lookup.CacheMode, "CACHE_HIT", StringComparison.Ordinal) &&
                    !string.Equals(lookup.CacheMode, "CACHE_FRESH_MISS", StringComparison.Ordinal) &&
                    wmsSession != null)
                {
                    try
                    {
                        WmsSessionStore.Save(WmsSessionFile, wmsSession);
                        Log("WMS SESSION FILE renew=PASS reason=lookup_refresh values=redacted.");
                    }
                    catch (Exception ex)
                    {
                        Log("WMS SESSION FILE renew=FAIL type=" + ex.GetType().Name);
                    }
                }

                if (string.Equals(lookup.Result, "FOUND", StringComparison.Ordinal))
                {
                    rate = _pickerRateLimiter.RecordFound(session, pickerUid, pickerUserId);
                }
                else if (string.Equals(lookup.Result, "NOT_FOUND", StringComparison.Ordinal))
                {
                    rate = _pickerRateLimiter.RecordNotFound(session, pickerUid, pickerUserId);
                    if (rate.IsLocked)
                        lookup.Result = "PICKER_LOCKED";
                }

                AckLookupJob(
                    session,
                    jobId,
                    pickerUserId,
                    suffix,
                    pickerUid,
                    clientSentAtMs,
                    lookup.Result ?? "LOOKUP_ERROR",
                    lookup.CacheMode ?? "NONE",
                    lookup.Route ?? "NONE",
                    lookup.StatusCode,
                    Math.Max(0L, lookup.ElapsedMs),
                    Math.Max(0, lookup.MatchCount),
                    rate);
            }
            catch (RelayHttpException ex)
            {
                if (ex.StatusCode == 403 && JobAlreadyAcknowledgedByAnotherAgent(session, jobId))
                {
                    Log("ACK SKIP request=" + Short(jobId) + " another ADMIN Agent already owns ACK.");
                    return;
                }
                lock (_acked) _acked.Remove(jobId);
                Log("PICKLIST LOOKUP ACK lỗi request=" + Short(jobId) + " picker=" + pickerUserId + " detail=" + SafeMessage(ex));
            }
            catch (Exception ex)
            {
                lock (_acked) _acked.Remove(jobId);
                Log("PICKLIST LOOKUP lỗi request=" + Short(jobId) + " picker=" + pickerUserId + " detail=" + SafeMessage(ex));
                try
                {
                    AckLookupJob(
                        session,
                        jobId,
                        pickerUserId,
                        suffix,
                        pickerUid,
                        clientSentAtMs,
                        "LOOKUP_ERROR",
                        "ERROR",
                        "NONE",
                        0,
                        0,
                        0,
                        new PickerRateDecision());
                    lock (_acked) _acked.Add(jobId);
                }
                catch { }
            }
        }

        private void AckLookupJob(
            AgentSession session,
            string jobId,
            string pickerUserId,
            string picklistLast5,
            string pickerUid,
            long clientSentAtMs,
            string result,
            string cacheMode,
            string route,
            int http,
            long lookupMs,
            int matches,
            PickerRateDecision rate)
        {
            rate = rate ?? new PickerRateDecision();
            var patch = new Dictionary<string, object>
            {
                { "status", "ACK" },
                { "agent_id", Environment.MachineName },
                { "agent_instance_id", _agentInstanceId },
                { "agent_admin_user_id", session.AppUserId },
                { "agent_network", GetSsid() },
                { "agent_received_at_ms", NowMs() },
                { "agent_ack_at_ms", NowMs() },
                { "lookup_status", result ?? "LOOKUP_ERROR" },
                { "lookup_matches", Math.Max(0, matches) },
                { "lookup_ms", Math.Max(0L, lookupMs) },
                { "lookup_route", string.IsNullOrWhiteSpace(route) ? "NONE" : route },
                { "lookup_http", Math.Max(0, http) },
                { "cache_mode", string.IsNullOrWhiteSpace(cacheMode) ? "NONE" : cacheMode },
                { "rate_strikes", Math.Max(0, rate.StrikeCount) },
                { "lock_level", Math.Max(0, rate.LockLevel) },
                { "locked_until_ms", Math.Max(0L, rate.LockedUntilMs) }
            };

            RequestJson("PATCH", JobUrl(session, jobId), _json.Serialize(patch), "application/json");
            Interlocked.Increment(ref _localAgentResponses);
            Audit(
                "AGENT_RESPONSE request=" + Short(jobId) +
                " picker=" + pickerUserId +
                " picker_uid=" + Fingerprint(pickerUid) +
                " picklist_last5=" + picklistLast5 +
                " client_sent_at_ms=" + clientSentAtMs +
                " result=" + (result ?? "LOOKUP_ERROR") +
                " cache=" + (cacheMode ?? "NONE") +
                " matches=" + matches +
                " lookup_ms=" + lookupMs +
                " route=" + (route ?? "NONE") +
                " http=" + http +
                " strikes=" + rate.StrikeCount +
                " lock_level=" + rate.LockLevel +
                " locked_until_ms=" + rate.LockedUntilMs +
                " admin=" + session.AppUserId +
                " machine=" + Environment.MachineName +
                " instance=" + Short(_agentInstanceId) +
                " network=" + GetSsid());

            Log(
                "PICKLIST LOOKUP ACK request=" + Short(jobId) +
                " picker=" + pickerUserId +
                " result=" + (result ?? "LOOKUP_ERROR") +
                " cache=" + (cacheMode ?? "NONE") +
                " matches=" + matches +
                " lookup_ms=" + lookupMs +
                " route=" + (route ?? "NONE") +
                " http=" + http +
                " strikes=" + rate.StrikeCount +
                " lock_level=" + rate.LockLevel +
                " locked=" + rate.IsLocked +
                " admin=" + session.AppUserId +
                " machine=" + Environment.MachineName +
                " instance=" + Short(_agentInstanceId) +
                " network=" + GetSsid() +
                " payload_digits=5 values=redacted"
            );

            Ui(() =>
            {
                if (string.Equals(result, "FOUND", StringComparison.Ordinal))
                    _relay.Text = "Relay: CÓ PICKLIST · đã trả PDA";
                else if (string.Equals(result, "NOT_FOUND", StringComparison.Ordinal))
                    _relay.Text = "Relay: KHÔNG CÓ PICKLIST · đã trả PDA";
                else if (string.Equals(result, "PICKER_LOCKED", StringComparison.Ordinal))
                    _relay.Text = "Relay: Picker bị khóa chống spam";
                else if (string.Equals(result, "WMS_SESSION_REQUIRED", StringComparison.Ordinal) ||
                         string.Equals(result, "SESSION_EXPIRED", StringComparison.Ordinal))
                    _relay.Text = "Relay: cần phiên WMS";
                else
                    _relay.Text = "Relay: tra cứu WMS " + (result ?? "ERROR");
            });
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
                LoginName = current.LoginName,
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
                    LoginName = _session.LoginName,
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
                { "login_name", session.LoginName ?? "" },
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

            object firebaseValue, appValue, loginValue, roleValue, baseRoleValue;
            var firebaseUid = map.TryGetValue("firebase_uid", out firebaseValue) ? Convert.ToString(firebaseValue) : "";
            var appUser = map.TryGetValue("app_user_id", out appValue) ? Convert.ToString(appValue) : "";
            var loginName = map.TryGetValue("login_name", out loginValue) ? Convert.ToString(loginValue) : "";
            var role = map.TryGetValue("role", out roleValue) ? Convert.ToString(roleValue) : "";
            var baseRole = map.TryGetValue("base_role", out baseRoleValue) ? Convert.ToString(baseRoleValue) : "";

            return new AgentSession
            {
                RefreshToken = Convert.ToString(refreshValue),
                UserId = firebaseUid,
                AppUserId = appUser,
                LoginName = loginName,
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
        private static string MapString(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

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

        private void Audit(string message)
        {
            var safe = AgentDiagnostics.Sanitize(message);
            AgentDiagnostics.WriteAudit(safe);
            Ui(() =>
            {
                _auditLog.Items.Insert(0, DateTime.Now.ToString("HH:mm:ss") + "  " + safe);
                while (_auditLog.Items.Count > 120) _auditLog.Items.RemoveAt(_auditLog.Items.Count - 1);
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
