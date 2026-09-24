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

            var d102SelfTest = args != null && Array.Exists(args, item =>
                string.Equals(item, "--d102-self-test", StringComparison.OrdinalIgnoreCase));
            if (d102SelfTest)
            {
                try
                {
                    var schedulePass = AgentBusinessSchedule.SelfTestTransitions();
                    AgentDiagnostics.Write("D102 SELFTEST schedule=" + (schedulePass ? "PASS" : "FAIL"));
                    Environment.ExitCode = schedulePass ? 0 : 5;
                }
                catch (Exception ex)
                {
                    AgentDiagnostics.Write(
                        "D102 SELFTEST exception type=" + ex.GetType().Name +
                        " message=" + AgentDiagnostics.Sanitize(ex.Message));
                    Environment.ExitCode = 6;
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
                    AgentDiagnostics.TryQueueCrashUpload(ex == null ? "UNKNOWN" : ex.GetType().Name);
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
                AgentDiagnostics.TryQueueCrashUpload("STARTUP_" + ex.GetType().Name);
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
        private static readonly Regex SecretPattern = new Regex(@"(?i)\b(authorization|bearer|token|password|secret|private[_ -]?key|api[_ -]?key|cookie|refresh[_ -]?token|id[_ -]?token|apisid|sid|scid|usid|x-signature(?:-nonce)?)\b\s*[:=]\s*[^\s,;]+", RegexOptions.Compiled);
        private static readonly Regex QuerySecretPattern = new Regex(@"(?i)([?&](?:auth|key|access_token|token)=)[^&\s]+", RegexOptions.Compiled);
        internal static string DiagnosticLogFile { get; private set; }
        internal static string RelayAuditLogFile { get; private set; }
        internal static string LogFile { get { return DiagnosticLogFile; } }
        internal static Action<string> CrashUploadCallback { get; set; }

        internal static void Initialize()
        {
            try
            {
                var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Agent Auto Confirm Pick Pack", "RelayPoc", "Logs");
                Directory.CreateDirectory(dir);
                DiagnosticLogFile = Path.Combine(dir, "technical-ai.log");
                RelayAuditLogFile = Path.Combine(dir, "pda-agent-audit.log");
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

        internal static string SanitizeBundle(string value, int maxChars = 4_000_000)
        {
            if (string.IsNullOrEmpty(value)) return "";
            var next = value.Length > maxChars ? value.Substring(value.Length - maxChars) : value;
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

        internal static void TryQueueCrashUpload(string crashType)
        {
            try
            {
                var callback = CrashUploadCallback;
                if (callback != null) callback(crashType ?? "UNKNOWN");
            }
            catch { }
        }

        private static void AppendSanitized(string path, string message)
        {
            var line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + "  " + Sanitize(message);
            try
            {
                lock (Gate)
                {
                    if (!string.IsNullOrWhiteSpace(path))
                    {
                        RotateIfNeeded(path, Encoding.UTF8.GetByteCount(line + Environment.NewLine));
                        File.AppendAllText(path, line + Environment.NewLine, Encoding.UTF8);
                    }
                }
            }
            catch { }
        }

        private const long MaxLogBytes = 2L * 1024L * 1024L;
        private const int MaxRolledFilesPerStream = 4;

        private static void RotateIfNeeded(string path, int incomingBytes)
        {
            try
            {
                if (!File.Exists(path)) return;
                var length = new FileInfo(path).Length;
                if (length + Math.Max(0, incomingBytes) <= MaxLogBytes) return;

                var oldest = path + "." + MaxRolledFilesPerStream;
                if (File.Exists(oldest)) File.Delete(oldest);
                for (var index = MaxRolledFilesPerStream - 1; index >= 1; index--)
                {
                    var from = path + "." + index;
                    var to = path + "." + (index + 1);
                    if (File.Exists(from)) File.Move(from, to);
                }
                File.Move(path, path + ".1");
            }
            catch { }
        }

        internal static string BuildUploadSnapshot(DateTime sinceLocal, bool crash)
        {
            var builder = new StringBuilder();
            AppendSnapshotStream(builder, "TECHNICAL", DiagnosticLogFile, sinceLocal);
            AppendSnapshotStream(builder, "PDA_AGENT_AUDIT", RelayAuditLogFile, sinceLocal);
            var content = builder.ToString();
            var cap = crash ? 800000 : 4000000;
            if (content.Length > cap)
                content = content.Substring(Math.Max(0, content.Length - cap));
            return SanitizeBundle(content, cap);
        }

        private static void AppendSnapshotStream(StringBuilder builder, string title, string currentPath, DateTime sinceLocal)
        {
            if (string.IsNullOrWhiteSpace(currentPath)) return;
            var paths = new List<string>();
            for (var i = MaxRolledFilesPerStream; i >= 1; i--)
            {
                var rolled = currentPath + "." + i;
                if (File.Exists(rolled)) paths.Add(rolled);
            }
            if (File.Exists(currentPath)) paths.Add(currentPath);
            if (paths.Count == 0) return;

            builder.AppendLine("===== " + title + " =====");
            foreach (var path in paths)
            {
                try
                {
                    foreach (var line in File.ReadAllLines(path, Encoding.UTF8))
                    {
                        if (line.Length < 23) continue;
                        DateTime at;
                        if (!DateTime.TryParseExact(line.Substring(0, 23), "yyyy-MM-dd HH:mm:ss.fff",
                            System.Globalization.CultureInfo.InvariantCulture,
                            System.Globalization.DateTimeStyles.None, out at)) continue;
                        if (at >= sinceLocal) builder.AppendLine(Sanitize(line));
                    }
                }
                catch { }
            }
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
        private Panel _supraCard;
        private readonly TextBox _manualPicklistQuery = new TextBox();
        private readonly Button _manualPicklistSearch = new Button();
        private readonly Button _manualPicklistConfirmAll = new Button();
        private readonly DataGridView _manualPicklistGrid = new DataGridView();
        private readonly Label _manualPicklistStatus = new Label();
        private readonly Label _agentFleetStatus = new Label();
        private readonly DataGridView _agentFleetGrid = new DataGridView();
        private readonly Label _agentSystemInfo = new Label();
        private readonly Label _updateStatus = new Label();
        private readonly Button _manualUpdate = new Button();
        private readonly Button _background = new Button();
        private readonly Panel _afterHoursPanel = new Panel();
        private readonly Label _afterHoursStatus = new Label();
        private readonly Button _afterHoursContinue = new Button();
        private readonly Button _afterHoursStop = new Button();
        private readonly Label _supraInfo = new Label();
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
        private readonly System.Windows.Forms.Timer _afterHoursTimer = new System.Windows.Forms.Timer();
        private readonly TabControl _mainTabs = new TabControl();
        private readonly TabPage _overviewPage = new TabPage("Tổng quan");
        private readonly TabPage _connectionPage = new TabPage("Kết nối");
        private readonly TabPage _overlayPage = new TabPage("Bảng nổi");
        private readonly TabPage _auditPage = new TabPage("Nhật ký vận hành");
        private readonly TabPage _technicalPage = new TabPage("Chẩn đoán kỹ thuật");
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
        private int _manualPicklistOperationRunning;
        private long _localPdaRequests;
        private long _localAgentResponses;
        private long _localConfirmSuccess;
        private long _localConfirmFailed;
        private readonly string _agentInstanceId;
        private readonly System.Windows.Forms.Timer _updateTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer _logUploadTimer = new System.Windows.Forms.Timer();
        private readonly AgentLogUploadBridge _agentLogBridge;
        private readonly AgentBusinessSchedule _businessSchedule;
        private DateTime _lastAfterHoursPromptAt = DateTime.MinValue;

        private static readonly string RelayDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Agent Auto Confirm Pick Pack", "RelayPoc");
        private static readonly string SessionFile = Path.Combine(RelayDataDir, "session.bin");
        private static readonly string AgentInstanceFile = Path.Combine(RelayDataDir, "agent-instance-id.txt");
        private static readonly string OverlaySettingsFile = Path.Combine(RelayDataDir, "overlay-settings.json");
        private static readonly string WmsSessionFile = Path.Combine(RelayDataDir, "wms-session.bin");
        private static readonly string ExitVerifierFile = Path.Combine(RelayDataDir, "exit-verifier.bin");
        private static readonly string AgentLogUploadCheckpointFile = Path.Combine(RelayDataDir, "agent-log-upload-checkpoint.txt");
        private static readonly string AfterHoursStateFile = Path.Combine(RelayDataDir, "after-hours-state.txt");

        internal AgentForm(bool startupSmoke = false, bool autoStarted = false, EventWaitHandle instanceActivateEvent = null)
        {
            _startupSmoke = startupSmoke;
            _autoStarted = autoStarted;
            _instanceActivateEvent = instanceActivateEvent;
            _agentInstanceId = LoadOrCreateAgentInstanceId();
            _businessSchedule = new AgentBusinessSchedule(AfterHoursStateFile);
            _agentSessionGate = new FirestoreAgentSessionGate(message => Log(message));
            _agentLogBridge = new AgentLogUploadBridge(
                () =>
                {
                    lock (_sessionLock) return _session;
                },
                _agentInstanceId,
                AgentLogUploadCheckpointFile,
                message => Log(message));
            AgentDiagnostics.CrashUploadCallback = crashType => _agentLogBridge.TryQueueCrashSnapshot(crashType);
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
            _network.SetBounds(18, 78, 726, 24); _network.Text = "Wi-Fi: " + GetSsid(); Controls.Add(_network);
            _identity.SetBounds(18, 104, 726, 24); _identity.Text = "Agent: chưa ghép"; Controls.Add(_identity);

            Controls.Add(new Label { Left = 18, Top = 140, Width = 90, Text = "ADMIN" });
            _username.SetBounds(110, 136, 180, 26); Controls.Add(_username);
            Controls.Add(new Label { Left = 305, Top = 140, Width = 70, Text = "Mật khẩu" });
            _password.SetBounds(375, 136, 160, 26); _password.UseSystemPasswordChar = true; Controls.Add(_password);
            _pair.SetBounds(545, 135, 105, 28); _pair.Text = "Đăng nhập"; _pair.Click += (s, e) => Task.Run(() => PairLogin()); Controls.Add(_pair);
            _logout.Text = "Đăng xuất"; _logout.Enabled = false; _logout.Click += (s, e) =>
            {
                if (MessageBox.Show(
                    "Đăng xuất Agent sẽ dừng xử lý trên máy này và xóa phiên Agent/Supra đang lưu cục bộ.\r\n\r\nTiếp tục đăng xuất?",
                    "Xác nhận đăng xuất Agent",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning) != DialogResult.Yes) return;
                Task.Run(() => LogoutAgent());
            };

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
            menu.Items.Add("Bảng nổi", null, (s, e) => OpenSettingsFromTray());
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
                if (!_allowExit && e.CloseReason == CloseReason.UserClosing)
                {
                    if (HasAgentSession())
                    {
                        e.Cancel = true;
                        BeginInvoke(new Action(RequestProtectedExit));
                        return;
                    }
                    AgentRuntimeGuard.MarkPlannedExit();
                    _allowExit = true;
                }
                if (e.CloseReason == CloseReason.WindowsShutDown) AgentRuntimeGuard.MarkPlannedExit();
                StopListening();
                StopLeaderCoordination();
                _trayMonitorTimer.Stop();
                _logUploadTimer.Stop();
                _afterHoursTimer.Stop();
                try { if (_statusOverlay != null) _statusOverlay.Close(); } catch { }
                _tray.Visible = false;
            };

            _networkUiTimer.Interval = 60000;
            _networkUiTimer.Tick += (s, e) =>
            {
                if (Visible) _network.Text = "Wi-Fi: " + GetSsid();
            };

            _guardTimer.Interval = 60000;
            _guardTimer.Tick += (s, e) => { if (HasAgentSession()) AgentRuntimeGuard.EnsureWatchdog(); };

            _trayMonitorTimer.Interval = 5000;
            _trayMonitorTimer.Tick += (s, e) => UpdateTrayMonitor();

            _afterHoursTimer.Interval = 60 * 1000;
            _afterHoursTimer.Tick += (s, e) => CheckAfterHoursSchedule();

            // GitHub cannot push directly into a portable EXE. D101 therefore uses
            // a bounded direct GitHub background check while the Agent is running.
            _updateTimer.Interval = 30 * 60 * 1000;
            _updateTimer.Tick += (s, e) => Task.Run(() => TryAutoUpdate(false));
            _updateTimer.Start();

            _logUploadTimer.Interval = 60 * 1000;
            _logUploadTimer.Tick += (s, e) => Task.Run(() =>
            {
                try { EnsureFreshToken(); } catch { }
                _agentLogBridge.TryFlushPendingCrash();
                _agentLogBridge.TryQueueScheduledSnapshot();
            });

            Shown += (s, e) =>
            {
                ApplyWorkingAreaMaximum();
                InitializeStatusOverlaySafe();
                UpdateTrayMonitor();

                if (_startupSmoke)
                {
                    AgentDiagnostics.Write("STARTUP_SMOKE PASS overlay=" + (_statusOverlay == null ? "fallback" : "ready"));
                    _allowExit = true;
                    BeginInvoke(new Action(Close));
                    return;
                }

                _guardTimer.Start();
                _networkUiTimer.Start();
                _trayMonitorTimer.Start();
                _logUploadTimer.Start();
                _afterHoursTimer.Start();
                CheckAfterHoursSchedule(true);
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
            Width = 1120;
            Height = 790;
            MinimumSize = new Size(1000, 720);
            BackColor = Color.FromArgb(243, 246, 248);
            ControlBox = true;
            MaximizeBox = true;
            MinimizeBox = true;
            ShowInTaskbar = true;
            FormBorderStyle = FormBorderStyle.Sizable;
            ApplyWorkingAreaMaximum();

            var shell = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                RowCount = 2,
                ColumnCount = 1,
                Margin = Padding.Empty,
                Padding = Padding.Empty
            };
            shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 0F));
            shell.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));

            var chrome = new Panel
            {
                Visible = false,
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(31, 47, 58),
                Margin = Padding.Empty
            };
            var chromeTitle = new Label
            {
                Left = 14,
                Top = 8,
                Width = 920,
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
            foreach (var page in new[] { _overviewPage, _connectionPage, _overlayPage, _auditPage, _technicalPage })
                page.BackColor = Color.FromArgb(243, 246, 248);
            _overviewPage.AutoScroll = false;
            _mainTabs.TabPages.Add(_overviewPage);
            _mainTabs.TabPages.Add(_connectionPage);
            _mainTabs.TabPages.Add(_overlayPage);
            _mainTabs.TabPages.Add(_auditPage);
            _mainTabs.TabPages.Add(_technicalPage);
            _mainTabs.SelectedIndexChanged += (s, e) =>
            {
                if (_mainTabs.SelectedTab == _overviewPage && _leaderCoordinator != null)
                    _leaderCoordinator.RequestFleetRefresh();
            };

            shell.Controls.Add(chrome, 0, 0);
            shell.Controls.Add(_mainTabs, 0, 1);
            Controls.Add(shell);

            // Tổng quan - bố cục cố định, không cuộn toàn trang.
            var overviewLayout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                RowCount = 3,
                ColumnCount = 1,
                Margin = Padding.Empty,
                Padding = new Padding(12)
            };
            overviewLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            overviewLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 330F));
            overviewLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 105F));
            overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            _overviewPage.Controls.Add(overviewLayout);

            // Hệ thống Agent - gọn, tối đa 5 dòng Agent trước khi cuộn trong bảng.
            var agentCard = NewCard(0, 0, 1040, 320);
            agentCard.Dock = DockStyle.Fill;
            agentCard.Margin = new Padding(0, 0, 0, 8);
            agentCard.Controls.Add(new Label
            {
                Left = 16,
                Top = 10,
                Width = 980,
                Height = 24,
                Text = "Hệ thống Agent",
                Font = new Font("Segoe UI Semibold", 12F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            });

            _agentAuthStatus.SetBounds(16, 38, 980, 20);
            _agentAuthStatus.Text = "CHƯA ĐĂNG NHẬP";
            _agentAuthStatus.ForeColor = Color.FromArgb(180, 76, 60);
            _agentAuthStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            agentCard.Controls.Add(_agentAuthStatus);

            agentCard.Controls.Add(new Label { Left = 16, Top = 64, Width = 150, Height = 18, Text = "Tài khoản ADMIN" });
            _username.SetBounds(16, 82, 260, 27);
            _username.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            agentCard.Controls.Add(_username);

            agentCard.Controls.Add(new Label { Left = 288, Top = 64, Width = 90, Height = 18, Text = "Mật khẩu" });
            _password.SetBounds(288, 82, 200, 27);
            _password.UseSystemPasswordChar = true;
            KeyEventHandler submitAgentLogin = (s, e) =>
            {
                if (e.KeyCode != Keys.Enter || !_pair.Enabled) return;
                e.SuppressKeyPress = true;
                e.Handled = true;
                Task.Run(() => PairLogin());
            };
            _username.KeyDown += submitAgentLogin;
            _password.KeyDown += submitAgentLogin;
            agentCard.Controls.Add(_password);

            _pair.SetBounds(500, 80, 108, 31);
            _pair.Text = "Đăng nhập";
            agentCard.Controls.Add(_pair);

            _logout.SetBounds(618, 80, 108, 31);
            _logout.Text = "Đăng xuất";
            _logout.Enabled = false;
            agentCard.Controls.Add(_logout);

            _manualUpdate.SetBounds(736, 80, 150, 31);
            _manualUpdate.Text = "Kiểm tra cập nhật";
            _manualUpdate.Click += (s, e) => Task.Run(() => TryAutoUpdate(false));
            agentCard.Controls.Add(_manualUpdate);

            _background.SetBounds(886, 80, 120, 31);
            _background.Text = "Chuyển xuống nền";
            _background.Click += (s, e) => MinimizeToTray();
            _background.TabStop = false;
            agentCard.Controls.Add(_background);

            _identity.SetBounds(16, 118, 310, 20);
            _relay.SetBounds(336, 118, 310, 20);
            _network.SetBounds(656, 118, 350, 20);
            _identity.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _relay.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _network.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            agentCard.Controls.Add(_identity);
            agentCard.Controls.Add(_relay);
            agentCard.Controls.Add(_network);

            _agentFleetStatus.SetBounds(16, 144, 990, 20);
            _agentFleetStatus.Text = "Cụm Agent: đang đồng bộ...";
            _agentFleetStatus.ForeColor = Color.FromArgb(50, 70, 82);
            _agentFleetStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            agentCard.Controls.Add(_agentFleetStatus);

            _agentFleetGrid.SetBounds(16, 168, 990, 146);
            _agentFleetGrid.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _agentFleetGrid.AllowUserToAddRows = false;
            _agentFleetGrid.AllowUserToDeleteRows = false;
            _agentFleetGrid.AllowUserToResizeRows = false;
            _agentFleetGrid.MultiSelect = false;
            _agentFleetGrid.ReadOnly = true;
            _agentFleetGrid.RowHeadersVisible = false;
            _agentFleetGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _agentFleetGrid.AutoGenerateColumns = false;
            _agentFleetGrid.BackgroundColor = Color.White;
            _agentFleetGrid.BorderStyle = BorderStyle.FixedSingle;
            _agentFleetGrid.ScrollBars = ScrollBars.Vertical;
            _agentFleetGrid.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            _agentFleetGrid.ColumnHeadersHeight = 25;
            _agentFleetGrid.RowTemplate.Height = 24;
            _agentFleetGrid.Columns.Clear();
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Admin", HeaderText = "Tài khoản", Width = 155 });
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Machine", HeaderText = "Máy", Width = 190 });
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Role", HeaderText = "Vai trò", Width = 120 });
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Supra", HeaderText = "Supra", Width = 110 });
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Version", HeaderText = "Phiên bản", Width = 95 });
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "LastSeen", HeaderText = "Cập nhật", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
            agentCard.Controls.Add(_agentFleetGrid);

            // Hai label này vẫn là state nội bộ cho updater/diagnostics nhưng không chiếm UI Tổng quan.
            _agentSystemInfo.Visible = false;
            _updateStatus.Visible = false;

            _afterHoursPanel.SetBounds(16, 168, 990, 54);
            _afterHoursPanel.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _afterHoursPanel.BackColor = Color.FromArgb(255, 247, 226);
            _afterHoursPanel.BorderStyle = BorderStyle.FixedSingle;
            _afterHoursStatus.SetBounds(10, 7, 490, 38);
            _afterHoursStatus.ForeColor = Color.FromArgb(111, 78, 15);
            _afterHoursPanel.Controls.Add(_afterHoursStatus);
            _afterHoursContinue.SetBounds(520, 10, 210, 32);
            _afterHoursContinue.Text = "Tiếp tục sau 22:00";
            _afterHoursContinue.Click += (s, e) => SetAfterHoursDecision(AfterHoursDecision.CONTINUE);
            _afterHoursPanel.Controls.Add(_afterHoursContinue);
            _afterHoursStop.SetBounds(742, 10, 190, 32);
            _afterHoursStop.Text = "Ngừng từ 22:00";
            _afterHoursStop.Click += (s, e) => SetAfterHoursDecision(AfterHoursDecision.STOP);
            _afterHoursPanel.Controls.Add(_afterHoursStop);
            _afterHoursPanel.Visible = false;
            agentCard.Controls.Add(_afterHoursPanel);
            overviewLayout.Controls.Add(agentCard, 0, 0);

            // Hệ thống Supra - chỉ giữ trạng thái cần dùng.
            _supraCard = NewCard(0, 0, 1040, 96);
            _supraCard.Dock = DockStyle.Fill;
            _supraCard.Margin = new Padding(0, 0, 0, 8);
            _supraCard.Controls.Add(new Label
            {
                Left = 16,
                Top = 10,
                Width = 190,
                Height = 24,
                Text = "Hệ thống Supra",
                Font = new Font("Segoe UI Semibold", 12F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            _wmsStatus.SetBounds(16, 42, 300, 22);
            _wmsStatus.Text = "Supra: chờ đăng nhập Agent";
            _supraCard.Controls.Add(_wmsStatus);
            _supraInfo.SetBounds(320, 42, 410, 22);
            _supraInfo.Text = "HY1 · Phiên chưa sẵn sàng · Cache 0";
            _supraInfo.ForeColor = Color.FromArgb(88, 104, 115);
            _supraInfo.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _supraCard.Controls.Add(_supraInfo);
            _wmsCapture.SetBounds(744, 34, 160, 32);
            _wmsCapture.Text = "Đăng nhập Supra";
            _wmsCapture.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _supraCard.Controls.Add(_wmsCapture);
            _wmsTest.SetBounds(914, 34, 108, 32);
            _wmsTest.Text = "Kiểm tra";
            _wmsTest.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _supraCard.Controls.Add(_wmsTest);
            _supraCard.Enabled = false;
            overviewLayout.Controls.Add(_supraCard, 0, 1);

            // Xử lý PickList - luôn chiếm toàn bộ phần còn lại phía dưới.
            var directCard = NewCard(0, 0, 1040, 260);
            directCard.Dock = DockStyle.Fill;
            directCard.Margin = Padding.Empty;
            directCard.Controls.Add(new Label
            {
                Left = 16,
                Top = 10,
                Width = 620,
                Height = 24,
                Text = "Xử lý PickList",
                Font = new Font("Segoe UI Semibold", 12F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });

            _manualPicklistQuery.SetBounds(16, 42, 360, 30);
            _manualPicklistQuery.MaxLength = 220;
            _manualPicklistQuery.KeyPress += (s, e) =>
            {
                if (char.IsControl(e.KeyChar) || char.IsDigit(e.KeyChar) || e.KeyChar == ',' || char.IsWhiteSpace(e.KeyChar))
                    return;
                e.Handled = true;
            };
            _manualPicklistQuery.KeyDown += (s, e) =>
            {
                if (e.KeyCode != Keys.Enter || !_manualPicklistSearch.Enabled) return;
                e.SuppressKeyPress = true;
                e.Handled = true;
                Task.Run(() => SearchManualPicklists());
            };
            _manualPicklistQuery.TextChanged += (s, e) =>
            {
                List<string> queries;
                var valid = TryParseManualPicklistQueries(_manualPicklistQuery.Text, out queries);
                _manualPicklistSearch.Enabled = valid && IsBusinessAllowed();
                _manualPicklistGrid.Rows.Clear();
                _manualPicklistConfirmAll.Visible = false;
                _manualPicklistStatus.Text = string.IsNullOrWhiteSpace(_manualPicklistQuery.Text)
                    ? ""
                    : (valid ? "Sẵn sàng." : "Nhập tối thiểu 3 số; có thể nhập dài hơn. Nhiều giá trị ngăn cách bằng dấu phẩy.");
            };
            directCard.Controls.Add(_manualPicklistQuery);

            _manualPicklistSearch.SetBounds(386, 40, 110, 34);
            _manualPicklistSearch.Text = "Tìm kiếm";
            _manualPicklistSearch.Enabled = false;
            _manualPicklistSearch.Click += (s, e) => Task.Run(() => SearchManualPicklists());
            directCard.Controls.Add(_manualPicklistSearch);

            _manualPicklistConfirmAll.SetBounds(506, 40, 160, 34);
            _manualPicklistConfirmAll.Text = "Xác nhận tất cả";
            _manualPicklistConfirmAll.Visible = false;
            _manualPicklistConfirmAll.Enabled = false;
            _manualPicklistConfirmAll.Click += (s, e) => Task.Run(() => ConfirmAllManualPicklists());
            directCard.Controls.Add(_manualPicklistConfirmAll);

            _manualPicklistGrid.SetBounds(16, 84, 1006, 130);
            _manualPicklistGrid.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            _manualPicklistGrid.AllowUserToAddRows = false;
            _manualPicklistGrid.AllowUserToDeleteRows = false;
            _manualPicklistGrid.AllowUserToResizeRows = false;
            _manualPicklistGrid.MultiSelect = false;
            _manualPicklistGrid.RowHeadersVisible = false;
            _manualPicklistGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _manualPicklistGrid.AutoGenerateColumns = false;
            _manualPicklistGrid.BackgroundColor = Color.White;
            _manualPicklistGrid.BorderStyle = BorderStyle.FixedSingle;
            _manualPicklistGrid.ScrollBars = ScrollBars.Vertical;
            _manualPicklistGrid.Columns.Clear();
            _manualPicklistGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "ConfirmAction",
                HeaderText = "",
                Text = "Xác nhận",
                UseColumnTextForButtonValue = true,
                Width = 130,
                MinimumWidth = 130
            });
            _manualPicklistGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "PickListCode",
                HeaderText = "PickList",
                ReadOnly = true,
                AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill
            });
            _manualPicklistGrid.CellContentClick += (s, e) =>
            {
                if (e.RowIndex < 0 || e.ColumnIndex < 0) return;
                if (_manualPicklistGrid.Columns[e.ColumnIndex].Name != "ConfirmAction") return;
                var code = Convert.ToString(_manualPicklistGrid.Rows[e.RowIndex].Cells["PickListCode"].Value) ?? "";
                if (string.IsNullOrWhiteSpace(code)) return;
                Task.Run(() => ConfirmManualPicklist(code));
            };
            directCard.Controls.Add(_manualPicklistGrid);

            _manualPicklistStatus.SetBounds(16, 220, 1006, 24);
            _manualPicklistStatus.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Bottom;
            _manualPicklistStatus.Text = "";
            _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            directCard.Controls.Add(_manualPicklistStatus);
            overviewLayout.Controls.Add(directCard, 0, 2);

            // Kết nối
            var networkCard = NewCard(22, 24, 1040, 300);
            networkCard.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            networkCard.Controls.Add(new Label
            {
                Left = 18, Top = 14, Width = 980, Height = 28,
                Text = "Kiểm tra kết nối",
                Font = new Font("Segoe UI Semibold", 13F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            _testOffice.SetBounds(18, 60, 150, 34); networkCard.Controls.Add(_testOffice);
            _listen.SetBounds(178, 60, 150, 34); networkCard.Controls.Add(_listen);
            _probeAuth.SetBounds(18, 122, 100, 32); networkCard.Controls.Add(_probeAuth);
            _probeRtdb.SetBounds(126, 122, 100, 32); networkCard.Controls.Add(_probeRtdb);
            _probeFirestore.SetBounds(234, 122, 110, 32); networkCard.Controls.Add(_probeFirestore);
            _probeAppsScript.SetBounds(352, 122, 110, 32); networkCard.Controls.Add(_probeAppsScript);
            _probeSheets.SetBounds(470, 122, 100, 32); networkCard.Controls.Add(_probeSheets);
            _probeDrive.SetBounds(578, 122, 100, 32); networkCard.Controls.Add(_probeDrive);
            _probeAll.SetBounds(686, 122, 140, 32); networkCard.Controls.Add(_probeAll);
            networkCard.Controls.Add(new Label
            {
                Left = 18, Top = 184, Width = 980, Height = 80,
                Text = "Kiểm tra trạng thái kết nối của Agent. Wi-Fi lấy trực tiếp từ Windows WLAN.",
                ForeColor = Color.DimGray
            });
            _connectionPage.Controls.Add(networkCard);

            // Bảng nổi
            _overlaySettingsHost.Dock = DockStyle.Fill;
            _overlaySettingsHost.BackColor = Color.White;
            _overlaySettingsHost.AutoScroll = true;
            _overlaySettingsHost.Controls.Add(new Label
            {
                Name = "overlay-loading",
                Left = 24,
                Top = 24,
                Width = 960,
                Height = 28,
                Text = "Đang khởi tạo cài đặt bảng nổi...",
                ForeColor = Color.DimGray
            });
            _overlayPage.Controls.Add(_overlaySettingsHost);
            _overlayPage.Enter += (s, e) => EnsureEmbeddedOverlaySettings();

            // Nhật ký
            _auditPage.Controls.Add(new Label
            {
                Left = 18, Top = 14, Width = 760, Height = 28,
                Text = "Nhật ký vận hành PDA ↔ Agent",
                Font = new Font("Segoe UI Semibold", 10.5F)
            });
            _openAuditLog.SetBounds(900, 10, 120, 30);
            _openAuditLog.Text = "Mở file";
            _openAuditLog.Click += (s, e) => AgentDiagnostics.OpenRelayAuditLog();
            _auditPage.Controls.Add(_openAuditLog);
            _auditLog.SetBounds(18, 52, 1002, 590);
            _auditLog.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            _auditPage.Controls.Add(_auditLog);

            _technicalPage.Controls.Add(new Label
            {
                Left = 18, Top = 14, Width = 760, Height = 28,
                Text = "Chẩn đoán kỹ thuật",
                Font = new Font("Segoe UI Semibold", 10.5F)
            });
            _openLog.SetBounds(900, 10, 120, 30);
            _openLog.Text = "Mở file";
            _technicalPage.Controls.Add(_openLog);
            _log.SetBounds(18, 52, 1002, 590);
            _log.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            _technicalPage.Controls.Add(_log);

            ResumeLayout(true);
        }

        private void UpdateAgentFleetGrid(List<AgentPresenceView> agents)
        {
            _agentFleetGrid.Rows.Clear();
            if (agents == null || agents.Count == 0) return;

            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            foreach (var agent in agents)
            {
                var ageMs = Math.Max(0L, nowMs - agent.HeartbeatAtMs);
                var age = ageMs < 60000
                    ? "vừa xong"
                    : (ageMs < 3600000
                        ? Math.Max(1L, ageMs / 60000) + " phút"
                        : Math.Max(1L, ageMs / 3600000) + " giờ");
                _agentFleetGrid.Rows.Add(
                    string.IsNullOrWhiteSpace(agent.AdminUserId) ? "--" : agent.AdminUserId,
                    string.IsNullOrWhiteSpace(agent.Machine) ? "--" : agent.Machine,
                    agent.Role,
                    agent.WmsReady ? "Sẵn sàng" : "Chưa sẵn sàng",
                    string.IsNullOrWhiteSpace(agent.Version) ? "--" : agent.Version,
                    age);
            }
        }

        private void ApplyAfterHoursAgentLayout(bool visible)
        {
            _afterHoursPanel.Visible = visible;
            if (visible)
            {
                _agentFleetGrid.SetBounds(16, 226, Math.Max(300, _agentFleetGrid.Parent == null ? 990 : _agentFleetGrid.Parent.ClientSize.Width - 32), 88);
                _agentFleetGrid.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            }
            else
            {
                _agentFleetGrid.SetBounds(16, 168, Math.Max(300, _agentFleetGrid.Parent == null ? 990 : _agentFleetGrid.Parent.ClientSize.Width - 32), 146);
                _agentFleetGrid.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            }
        }

        private bool IsBusinessAllowed()
        {
            return _businessSchedule == null || _businessSchedule.BusinessAllowed(_businessSchedule.NowOperational());
        }

        private void SetAfterHoursDecision(AfterHoursDecision decision)
        {
            if (_businessSchedule == null) return;
            var now = _businessSchedule.NowOperational();
            _businessSchedule.SetDecision(now, decision);
            _lastAfterHoursPromptAt = DateTime.MinValue;
            Log("AFTER_HOURS decision=" + decision + " night=" + now.ToString("yyyy-MM-dd"));
            CheckAfterHoursSchedule(true);
            if (decision == AfterHoursDecision.CONTINUE && _leaderCoordinator != null)
                _leaderCoordinator.RequestRoleRefreshBeforeBusiness();
        }

        private void CheckAfterHoursSchedule(bool forcePrompt = false)
        {
            if (_businessSchedule == null) return;
            var now = _businessSchedule.NowOperational();
            var needsConfirmation = _businessSchedule.NeedsConfirmation(now);
            ApplyAfterHoursAgentLayout(needsConfirmation);
            _afterHoursStatus.Text = _businessSchedule.StatusText(now);

            if (!needsConfirmation)
            {
                _lastAfterHoursPromptAt = DateTime.MinValue;
                return;
            }

            if (!forcePrompt &&
                _lastAfterHoursPromptAt != DateTime.MinValue &&
                (now - _lastAfterHoursPromptAt).TotalMinutes < 5)
                return;

            _lastAfterHoursPromptAt = now;
            try
            {
                _tray.ShowBalloonTip(
                    5000,
                    "Xác nhận vận hành sau 22:00",
                    now.TimeOfDay >= new TimeSpan(22, 0, 0) || now.TimeOfDay < new TimeSpan(5, 0, 0)
                        ? "Chưa xác nhận tăng ca. Nghiệp vụ Agent đang tạm dừng. Mở Agent để xác nhận."
                        : "Có tiếp tục vận hành Agent sau 22:00 không? Mở Agent để xác nhận.",
                    ToolTipIcon.Warning);
            }
            catch { }
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
            _mainTabs.SelectedTab = _connectionPage;
        }

        private void RequestProtectedExit()
        {
            AgentSession session = null;
            try { session = SnapshotSession(); } catch { }

            if (session == null || string.IsNullOrWhiteSpace(session.AppUserId))
            {
                AgentRuntimeGuard.MarkPlannedExit();
                _allowExit = true;
                Close();
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
                            "Mật khẩu ADMIN không đúng hoặc phiên cũ chưa có bộ xác minh tắt Agent. Hãy đăng nhập ADMIN lại tại Tổng quan rồi thử lại.",
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

        private void ApplyWorkingAreaMaximum()
        {
            try
            {
                var screen = Screen.FromControl(this);
                MaximizedBounds = screen.WorkingArea;
            }
            catch { }
            WindowState = FormWindowState.Maximized;
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
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate();
        }

        private string BuildLaptopOverlayLine(SystemMetrics metrics, string state, OverlaySettings options)
        {
            if (options == null || !options.ShowLaptopGroup) return "";
            var parts = new List<string>();
            if (options.ShowCpu) parts.Add("Vai trò " + state);
            if (options.ShowMemory)
                parts.Add("Firestore " + (_leaderCoordinator != null && _leaderCoordinator.IsTransportHealthy ? "ON" : "OFF"));
            if (options.ShowDisk)
                parts.Add("WMS " + (HasUsableWmsSession() ? "Sẵn sàng" : "Chưa sẵn sàng"));
            if (options.ShowNetwork) parts.Add("v" + AgentConfig.AgentBuild);
            if (options.ShowInternet) parts.Add("Nghiệp vụ " + (IsBusinessAllowed() ? "ON" : "TẠM DỪNG"));
            if (options.ShowGpu) parts.Add("Cache " + _picklistCache.CacheCount);
            return parts.Count == 0 ? "" : "Vận hành | " + string.Join(" | ", parts.ToArray());
        }

        private string BuildAgentOverlayLine(
            SystemMetrics metrics,
            int online,
            int primaryCount,
            int standbyCount,
            int frozenCount,
            OverlaySettings options)
        {
            if (options == null || !options.ShowAgentGroup) return "";
            var parts = new List<string>();
            if (options.ShowAgentOnline)
                parts.Add("CPU " + (metrics.ProcessCpuPercent < 0 ? "--" : metrics.ProcessCpuPercent.ToString("0") + "%"));
            if (options.ShowAgentState)
            {
                var ramMb = metrics.ProcessWorkingSetBytes <= 0 ? "--" : (metrics.ProcessWorkingSetBytes / 1048576.0).ToString("0") + "MB";
                var uptime = metrics.ProcessUptime.TotalHours >= 1
                    ? ((int)metrics.ProcessUptime.TotalHours).ToString("0") + "h" + metrics.ProcessUptime.Minutes.ToString("00")
                    : Math.Max(0, metrics.ProcessUptime.Minutes).ToString("0") + "m";
                parts.Add("RAM " + ramMb + " · chạy " + uptime);
            }
            var requests = Interlocked.Read(ref _localPdaRequests);
            var responses = Interlocked.Read(ref _localAgentResponses);
            if (options.ShowPdaRequests)
                parts.Add("Yêu cầu " + requests + " · chờ " + Math.Max(0L, requests - responses));
            if (options.ShowAgentResponses)
                parts.Add("OK " + Interlocked.Read(ref _localConfirmSuccess) + " · lỗi " + Interlocked.Read(ref _localConfirmFailed));
            if (options.ShowWmsSession)
                parts.Add("Cụm " + online + " (P" + primaryCount + "/S" + standbyCount + "/F" + frozenCount + ") · " + DateTime.Now.ToString("HH:mm:ss"));
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
                        : (_leaderCoordinator.IsLeader ? "PRIMARY"
                            : (_leaderCoordinator.IsStandby ? "STANDBY" : "FROZEN")));

                var primaryCount = _leaderCoordinator == null ? 0 : _leaderCoordinator.OnlinePrimaryCount;
                var standbyCount = _leaderCoordinator == null ? 0 : _leaderCoordinator.OnlineStandbyCount;
                var frozenCount = _leaderCoordinator == null ? 0 : _leaderCoordinator.OnlineFrozenCount;
                _agentFleetStatus.Text =
                    "Cụm Agent: " + online +
                    " online · PRIMARY " + primaryCount +
                    " · STANDBY " + standbyCount +
                    " · FROZEN " + frozenCount +
                    " · Máy này: " + state;
                _agentSystemInfo.Text = state;
                UpdateAgentFleetGrid(_leaderCoordinator == null ? null : _leaderCoordinator.OnlineAgents);
                _supraInfo.Text =
                    "HY1 · " + (HasUsableWmsSession() ? "Phiên sẵn sàng" : "Phiên chưa sẵn sàng") +
                    " · Cache " + _picklistCache.CacheCount +
                    (_picklistCache.RefreshedUtc == DateTime.MinValue ? "" : " · " + _picklistCache.RefreshedUtc.ToLocalTime().ToString("HH:mm"));

                if (_statusOverlay != null)
                {
                    var options = _statusOverlay.DisplaySettings;
                    _statusOverlay.UpdateMetrics(
                        BuildLaptopOverlayLine(metrics, state, options),
                        BuildAgentOverlayLine(metrics, online, primaryCount, standbyCount, frozenCount, options));
                }
            }
            catch
            {
                _tray.Text = "SUPRA Agent";
                _trayStatusItem.Text = "Máy: chưa đọc được tài nguyên";
                if (_statusOverlay != null)
                    _statusOverlay.UpdateMetrics("Vận hành | chưa đọc được trạng thái", "Agent | chưa đọc được tải tiến trình");
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
                    "Bảng nổi chưa khởi tạo được. Có thể thử lại ngay; mở Chẩn đoán kỹ thuật để xem chi tiết.",
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

        private static bool TryParseManualPicklistQueries(string raw, out List<string> queries)
        {
            queries = new List<string>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var part in (raw ?? "").Split(','))
            {
                var value = (part ?? "").Trim();
                if (value.Length == 0) continue;
                if (value.Length < 3 || value.Length > 20) return false;
                foreach (var ch in value)
                    if (ch < '0' || ch > '9') return false;
                if (seen.Add(value)) queries.Add(value);
            }
            return queries.Count > 0 && queries.Count <= 10;
        }

        private List<string> GetManualDisplayedPicklists()
        {
            var codes = new List<string>();
            UiSync(() =>
            {
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (DataGridViewRow row in _manualPicklistGrid.Rows)
                {
                    if (row == null || row.IsNewRow) continue;
                    var code = Convert.ToString(row.Cells["PickListCode"].Value) ?? "";
                    code = code.Trim();
                    if (code.Length > 0 && seen.Add(code)) codes.Add(code);
                }
            });
            return codes;
        }

        private void UpdateManualConfirmAllVisibility()
        {
            var count = 0;
            foreach (DataGridViewRow row in _manualPicklistGrid.Rows)
                if (row != null && !row.IsNewRow) count++;
            _manualPicklistConfirmAll.Visible = count >= 2;
            _manualPicklistConfirmAll.Text = count >= 2 ? "Xác nhận tất cả (" + count + ")" : "Xác nhận tất cả";
            _manualPicklistConfirmAll.Enabled =
                count >= 2 && HasAgentSession() && HasUsableWmsSession() && IsBusinessAllowed();
        }

        private void SearchManualPicklists()
        {
            if (Interlocked.CompareExchange(ref _manualPicklistOperationRunning, 1, 0) != 0)
            {
                Ui(() => _manualPicklistStatus.Text = "Đang xử lý PickList...");
                return;
            }

            List<string> queries = null;
            UiSync(() =>
            {
                if (!TryParseManualPicklistQueries(_manualPicklistQuery.Text, out queries))
                    queries = null;
                _manualPicklistSearch.Enabled = false;
                _manualPicklistConfirmAll.Visible = false;
                _manualPicklistGrid.Enabled = false;
                _manualPicklistGrid.Rows.Clear();
                _manualPicklistStatus.Text = "Đang tìm PickList...";
                _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            });

            try
            {
                if (!IsBusinessAllowed())
                    throw new InvalidOperationException("Agent đang tạm dừng nghiệp vụ 22:00–05:00. Hãy xác nhận tăng ca tại Tổng quan để tiếp tục.");
                if (queries == null || queries.Count == 0)
                    throw new InvalidOperationException("Nhập tối thiểu 3 số cho mỗi PickList; tối đa 10 giá trị, ngăn cách bằng dấu phẩy.");

                if (!HasAgentSession())
                    throw new InvalidOperationException("Cần xác minh Agent bằng tài khoản ADMIN trước.");
                var wmsSession = SnapshotWmsSession();
                if (wmsSession == null || !wmsSession.IsValidHy1())
                    throw new InvalidOperationException("Phiên Supra chưa sẵn sàng.");

                // D104: search all terms against one cache snapshot. If any term misses,
                // refresh WMS at most once and search all terms again.
                var result = _picklistCache.SearchContainsMany(wmsSession, queries, 50);
                if (string.Equals(result.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                    ClearWmsSessionAfterExpiry();

                Ui(() =>
                {
                    _manualPicklistGrid.Rows.Clear();
                    foreach (var code in result.Matches)
                        _manualPicklistGrid.Rows.Add(code);

                    if (string.Equals(result.Result, "AMBIGUOUS", StringComparison.Ordinal))
                    {
                        _manualPicklistStatus.Text =
                            result.AmbiguousFragments.Count + " từ khóa khớp nhiều PickList. Nhập thêm số để xác định duy nhất." +
                            (result.Matches.Count > 0 ? " · " + result.Matches.Count + " từ khóa khác đã xác định được." : "");
                        _manualPicklistStatus.ForeColor = Color.FromArgb(180, 116, 30);
                    }
                    else if (string.Equals(result.Result, "FOUND", StringComparison.Ordinal))
                    {
                        _manualPicklistStatus.Text =
                            "Tìm thấy " + result.Matches.Count + " PickList duy nhất" +
                            (result.MissingFragments.Count > 0
                                ? " · " + result.MissingFragments.Count + " từ khóa không có kết quả."
                                : ".");
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
                    UpdateManualConfirmAllVisibility();
                });

                AgentDiagnostics.WriteAudit(
                    "MANUAL_PICKLIST_SEARCH result=" + result.Result +
                    " query_count=" + queries.Count +
                    " missing_queries=" + result.MissingFragments.Count +
                    " ambiguous_queries=" + result.AmbiguousFragments.Count +
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
                    _manualPicklistConfirmAll.Visible = false;
                });
                Log("Manual PickList search fail: " + SafeMessage(ex));
            }
            finally
            {
                Interlocked.Exchange(ref _manualPicklistOperationRunning, 0);
                Ui(() =>
                {
                    List<string> parsed;
                    _manualPicklistSearch.Enabled =
                        TryParseManualPicklistQueries(_manualPicklistQuery.Text, out parsed) &&
                        IsBusinessAllowed();
                    _manualPicklistGrid.Enabled =
                        HasAgentSession() && HasUsableWmsSession() && IsBusinessAllowed();
                    UpdateManualConfirmAllVisibility();
                });
            }
        }

        private void ConfirmManualPicklist(string pickListCode)
        {
            ConfirmManualPicklists(new[] { pickListCode });
        }

        private void ConfirmAllManualPicklists()
        {
            var codes = GetManualDisplayedPicklists();
            if (codes.Count < 2) return;
            ConfirmManualPicklists(codes);
        }

        private void ConfirmManualPicklists(IEnumerable<string> pickListCodes)
        {
            if (Interlocked.CompareExchange(ref _manualPicklistOperationRunning, 1, 0) != 0)
            {
                Ui(() => _manualPicklistStatus.Text = "Đang xử lý PickList...");
                return;
            }

            var codes = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var raw in pickListCodes ?? new string[0])
            {
                var code = (raw ?? "").Trim();
                if (code.Length == 0 || !seen.Add(code)) continue;
                codes.Add(code);
            }

            UiSync(() =>
            {
                _manualPicklistGrid.Enabled = false;
                _manualPicklistSearch.Enabled = false;
                _manualPicklistConfirmAll.Enabled = false;
                _manualPicklistStatus.Text = codes.Count <= 1
                    ? "Đang xác nhận PickList..."
                    : "Đang xác nhận " + codes.Count + " PickList...";
                _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            });

            try
            {
                if (!IsBusinessAllowed())
                    throw new InvalidOperationException("Agent đang tạm dừng nghiệp vụ 22:00–05:00. Hãy xác nhận tăng ca tại Tổng quan để tiếp tục.");
                if (codes.Count == 0)
                    throw new InvalidOperationException("Chưa chọn PickList.");
                if (codes.Count > 50)
                    throw new InvalidOperationException("Tối đa 50 PickList hiển thị cho một lần xác nhận tất cả.");
                if (!HasAgentSession())
                    throw new InvalidOperationException("Phiên xác minh Agent không còn hợp lệ.");

                EnsureFreshToken();
                var appSession = SnapshotSession();
                if (!_agentSessionGate.IsCurrent(appSession, _agentInstanceId))
                    throw new InvalidOperationException("Phiên Agent này đã bị thay thế bởi Agent khác.");

                var wmsSession = SnapshotWmsSession();
                if (wmsSession == null || !wmsSession.IsValidHy1())
                    throw new InvalidOperationException("Phiên Supra chưa sẵn sàng.");

                var acquired = new Dictionary<string, FirestoreConfirmationGuardDecision>(StringComparer.OrdinalIgnoreCase);
                var alreadyConfirmed = 0;
                var uncertain = 0;

                foreach (var code in codes)
                {
                    var requestId = "manual:" + Guid.NewGuid().ToString("N");
                    var guard = _confirmationGuard.TryBegin(
                        appSession,
                        code,
                        requestId,
                        _agentInstanceId,
                        "manual:" + appSession.UserId);

                    if (guard.AlreadyConfirmed)
                    {
                        alreadyConfirmed++;
                        continue;
                    }
                    if (!guard.Acquired || guard.InProgressOrUncertain)
                    {
                        uncertain++;
                        continue;
                    }
                    acquired[code] = guard;
                }

                var confirmedCount = 0;
                var failedCount = 0;
                var processed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var acquiredCodes = new List<string>(acquired.Keys);
                var stopAfterSessionExpiry = false;

                for (var offset = 0; offset < acquiredCodes.Count; offset += 10)
                {
                    var count = Math.Min(10, acquiredCodes.Count - offset);
                    var chunk = acquiredCodes.GetRange(offset, count);
                    var results = WmsPicklistConfirmClient.ConfirmMany(wmsSession, chunk);

                    foreach (var code in chunk)
                    {
                        processed.Add(code);
                        WmsPicklistConfirmResult result;
                        if (!results.TryGetValue(code, out result) || result == null)
                        {
                            uncertain++;
                            continue;
                        }

                        var guard = acquired[code];
                        if (string.Equals(result.Result, "CONFIRMED", StringComparison.Ordinal))
                        {
                            _confirmationGuard.MarkLocalConfirmed(guard.GuardId);
                            confirmedCount++;
                        }
                        else if (IsSafeConfirmationFailure(result, chunk.Count))
                        {
                            _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);
                            failedCount++;
                        }
                        else
                        {
                            uncertain++;
                        }

                        if (string.Equals(result.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                            stopAfterSessionExpiry = true;
                    }

                    if (stopAfterSessionExpiry) break;
                }

                if (stopAfterSessionExpiry)
                {
                    ClearWmsSessionAfterExpiry();
                    foreach (var pair in acquired)
                    {
                        if (processed.Contains(pair.Key)) continue;
                        _confirmationGuard.ReleaseSafeFailure(appSession, pair.Value.GuardId);
                        failedCount++;
                    }
                }

                Ui(() =>
                {
                    var totalOk = confirmedCount + alreadyConfirmed;
                    _manualPicklistStatus.Text =
                        "Xác nhận: " + totalOk + "/" + codes.Count +
                        (alreadyConfirmed > 0 ? " · đã có " + alreadyConfirmed : "") +
                        (uncertain > 0 ? " · chưa rõ " + uncertain : "") +
                        (failedCount > 0 ? " · lỗi " + failedCount : "");
                    _manualPicklistStatus.ForeColor =
                        uncertain == 0 && failedCount == 0
                            ? Color.FromArgb(35, 122, 76)
                            : Color.FromArgb(180, 76, 60);
                });

                AgentDiagnostics.WriteAudit(
                    "MANUAL_PICKLIST_CONFIRM_BATCH requested=" + codes.Count +
                    " sent=" + acquired.Count +
                    " confirmed=" + confirmedCount +
                    " already=" + alreadyConfirmed +
                    " uncertain=" + uncertain +
                    " failed=" + failedCount +
                    " picklists=redacted");
            }
            catch (Exception ex)
            {
                Ui(() =>
                {
                    _manualPicklistStatus.Text = SafeMessage(ex);
                    _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                });
                Log("Manual PickList confirm batch fail: " + SafeMessage(ex));
            }
            finally
            {
                Interlocked.Exchange(ref _manualPicklistOperationRunning, 0);
                Ui(() =>
                {
                    List<string> parsed;
                    _manualPicklistSearch.Enabled =
                        TryParseManualPicklistQueries(_manualPicklistQuery.Text, out parsed) &&
                        IsBusinessAllowed();
                    _manualPicklistGrid.Enabled =
                        HasAgentSession() && HasUsableWmsSession() && IsBusinessAllowed();
                    UpdateManualConfirmAllVisibility();
                });
            }
        }

        private void ActivateRelayRuntime()
        {
            try
            {
                AgentRuntimeGuard.EnsureWatchdog();
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
            if (!HasAgentSession())
            {
                Ui(() => _wmsStatus.Text = "Supra WMS: chờ xác minh Agent");
                return;
            }
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
                Ui(() =>
                {
                    _manualUpdate.Enabled = false;
                    _manualUpdate.Text = "Đang kiểm tra...";
                    _updateStatus.Text = "CHECKING";
                });
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
                Ui(() => _updateStatus.Text = result.Message);
                return false;
            }
            catch (Exception ex)
            {
                Log("UPDATE chưa thể kiểm tra/cài tự động: " + SafeMessage(ex));
                Ui(() => _updateStatus.Text = "UPDATE_CHECK_FAILED");
                return false;
            }
            finally
            {
                lock (_sessionLock) _updateCheckRunning = false;
                Ui(() =>
                {
                    _manualUpdate.Enabled = true;
                    _manualUpdate.Text = "Kiểm tra cập nhật";
                });
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
                Task.Run(() =>
                {
                    _agentLogBridge.TryFlushPendingCrash();
                    _agentLogBridge.TryQueueScheduledSnapshot();
                    TryRestoreWmsSessionFileFirst();
                });
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
            if (value.Length == 0) throw new InvalidOperationException("Nhập tài khoản ADMIN.");
            if (!Regex.IsMatch(value, "^[a-z0-9._-]{1,64}$"))
                throw new InvalidOperationException("Tài khoản ADMIN không hợp lệ.");
            var seed = Regex.Replace(value, "[^a-z0-9._-]", "-").Trim('-');
            if (seed.Length > 44) seed = seed.Substring(0, 44);
            if (seed.Length == 0) throw new InvalidOperationException("Tài khoản ADMIN không hợp lệ.");
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
                Log("Nhập tài khoản ADMIN và mật khẩu.");
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
                Task.Run(() =>
                {
                    _agentLogBridge.TryFlushPendingCrash();
                    _agentLogBridge.TryQueueScheduledSnapshot();
                    TryRestoreWmsSessionFileFirst();
                });
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
                    ? "Hệ thống Agent: ĐÃ ĐĂNG NHẬP" + (string.IsNullOrWhiteSpace(appUser) ? "" : " · " + appUser)
                    : "Hệ thống Agent: CHƯA ĐĂNG NHẬP";
                _agentAuthStatus.ForeColor = authenticated
                    ? Color.FromArgb(35, 122, 76)
                    : Color.FromArgb(180, 76, 60);
                if (_supraCard != null)
                {
                    _supraCard.Enabled = authenticated;
                    if (!authenticated)
                    {
                        _wmsStatus.Text = "Supra WMS: chờ xác minh Agent";
                        _wmsCapture.Enabled = false;
                        _wmsTest.Enabled = false;
                    }
                }
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
            lock (_wmsSessionLock) _wmsSession = null;
            _picklistCache.Clear();
            ClearStoredSession();
            AgentRuntimeGuard.MarkPlannedExit();
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
            var results = ProcessFirestoreConfirmations(new List<FirestoreConfirmationWorkItem> { work });
            FirestoreConfirmationOutcome outcome;
            return work != null &&
                   results.TryGetValue(work.RequestId ?? "", out outcome) &&
                   outcome != null
                ? outcome
                : new FirestoreConfirmationOutcome { Result = "CONFIRM_ERROR" };
        }

        private Dictionary<string, FirestoreConfirmationOutcome> ProcessFirestoreConfirmations(
            List<FirestoreConfirmationWorkItem> works)
        {
            var outcomes = new Dictionary<string, FirestoreConfirmationOutcome>(StringComparer.Ordinal);
            if (works == null || works.Count == 0) return outcomes;
            if (works.Count > FirestoreConfirmationTransport.MaxConcurrentJobs)
                throw new InvalidOperationException("Confirmation batch exceeds bounded job limit.");

            var appSession = SnapshotSession();
            var wmsSession = SnapshotWmsSession();

            foreach (var work in works)
            {
                if (work == null || string.IsNullOrWhiteSpace(work.RequestId)) continue;
                var rate = _firestoreRateLimiter.Check(appSession, work.PickerUid, work.PickerUserId);
                if (rate.IsLocked)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "PICKER_LOCKED",
                        CacheMode = "RATE_LIMIT",
                        Route = "NONE",
                        Rate = rate
                    };
                }
            }

            if (wmsSession == null || !wmsSession.IsValidHy1())
            {
                foreach (var work in works)
                {
                    if (work == null || string.IsNullOrWhiteSpace(work.RequestId) || outcomes.ContainsKey(work.RequestId)) continue;
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "WMS_SESSION_REQUIRED",
                        CacheMode = "NO_SESSION",
                        Route = "NONE"
                    };
                }
                return outcomes;
            }

            var lookupWorks = new List<FirestoreConfirmationWorkItem>();
            var lookupSuffixes = new List<string>();
            foreach (var work in works)
            {
                if (work == null || string.IsNullOrWhiteSpace(work.RequestId) || outcomes.ContainsKey(work.RequestId)) continue;
                lookupWorks.Add(work);
                lookupSuffixes.Add(work.Suffix);
            }

            Dictionary<string, CachedPicklistResult> lookupBySuffix;
            try
            {
                lookupBySuffix = lookupWorks.Count == 0
                    ? new Dictionary<string, CachedPicklistResult>(StringComparer.Ordinal)
                    : _picklistCache.LookupMany(wmsSession, lookupSuffixes);
            }
            catch (Exception ex)
            {
                foreach (var work in lookupWorks)
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "LOOKUP_ERROR",
                        CacheMode = "BATCH_LOOKUP_ERROR",
                        Route = "NONE"
                    };
                Log("FIRESTORE batch lookup fail type=" + ex.GetType().Name);
                return outcomes;
            }

            var exactWorks = new List<FirestoreConfirmationWorkItem>();
            var exactSuffixes = new List<string>();
            foreach (var work in lookupWorks)
            {
                CachedPicklistResult lookup;
                if (!lookupBySuffix.TryGetValue(work.Suffix ?? "", out lookup) || lookup == null)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "LOOKUP_ERROR",
                        CacheMode = "BATCH_LOOKUP_MISSING",
                        Route = "NONE"
                    };
                    continue;
                }

                if (string.Equals(lookup.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                    ClearWmsSessionAfterExpiry();

                if (string.Equals(lookup.Result, "NOT_FOUND", StringComparison.Ordinal))
                {
                    var rate = _firestoreRateLimiter.RecordNotFound(
                        appSession, work.PickerUid, work.PickerUserId, work.RequestId);
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = rate.IsLocked ? "PICKER_LOCKED" : "NOT_FOUND",
                        CacheMode = lookup.CacheMode,
                        Route = lookup.Route,
                        Http = lookup.StatusCode,
                        OperationMs = Math.Max(0L, lookup.ElapsedMs),
                        Matches = 0,
                        Rate = rate
                    };
                    continue;
                }

                if (!string.Equals(lookup.Result, "FOUND", StringComparison.Ordinal))
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = lookup.Result ?? "LOOKUP_ERROR",
                        CacheMode = lookup.CacheMode,
                        Route = lookup.Route,
                        Http = lookup.StatusCode,
                        OperationMs = Math.Max(0L, lookup.ElapsedMs),
                        Matches = Math.Max(0, lookup.MatchCount)
                    };
                    continue;
                }

                _firestoreRateLimiter.ClearFound(appSession, work.PickerUid);

                if (work.CreatedAtMs > 0 &&
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - work.CreatedAtMs >= 25000)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "REQUEST_EXPIRED",
                        CacheMode = lookup.CacheMode + "+EXPIRED",
                        Route = lookup.Route,
                        Http = lookup.StatusCode,
                        OperationMs = Math.Max(0L, lookup.ElapsedMs),
                        Matches = Math.Max(0, lookup.MatchCount),
                        Rate = new PickerRateDecision()
                    };
                    continue;
                }

                exactWorks.Add(work);
                exactSuffixes.Add(work.Suffix);
            }

            Dictionary<string, WmsExactPicklistResult> exactBySuffix;
            try
            {
                exactBySuffix = exactWorks.Count == 0
                    ? new Dictionary<string, WmsExactPicklistResult>(StringComparer.Ordinal)
                    : WmsExactPicklistResolver.ResolveMany(wmsSession, exactSuffixes);
            }
            catch (Exception ex)
            {
                foreach (var work in exactWorks)
                {
                    CachedPicklistResult lookup;
                    lookupBySuffix.TryGetValue(work.Suffix ?? "", out lookup);
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "EXACT_CODE_NOT_RESOLVED",
                        CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_BATCH_ERROR",
                        Route = "NONE",
                        OperationMs = lookup == null ? 0L : Math.Max(0L, lookup.ElapsedMs)
                    };
                }
                Log("FIRESTORE exact batch fail type=" + ex.GetType().Name);
                return outcomes;
            }

            var guardsByRequest = new Dictionary<string, FirestoreConfirmationGuardDecision>(StringComparer.Ordinal);
            var codeByRequest = new Dictionary<string, string>(StringComparer.Ordinal);
            var confirmCodes = new List<string>();

            foreach (var work in exactWorks)
            {
                CachedPicklistResult lookup;
                lookupBySuffix.TryGetValue(work.Suffix ?? "", out lookup);
                WmsExactPicklistResult exact;
                if (!exactBySuffix.TryGetValue(work.Suffix ?? "", out exact) || exact == null ||
                    !string.Equals(exact.Result, "FOUND", StringComparison.Ordinal) ||
                    exact.MatchCount != 1 || string.IsNullOrWhiteSpace(exact.PickListCode))
                {
                    var unresolved = new FirestoreConfirmationOutcome
                    {
                        Result = exact == null ? "EXACT_CODE_NOT_RESOLVED" : (exact.Result ?? "EXACT_CODE_NOT_RESOLVED"),
                        CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_RESOLVE_BATCH",
                        Route = exact == null ? "NONE" : exact.Route,
                        Http = exact == null ? 0 : exact.StatusCode,
                        OperationMs = (lookup == null ? 0L : Math.Max(0L, lookup.ElapsedMs)) +
                                      (exact == null ? 0L : Math.Max(0L, exact.ElapsedMs)),
                        Matches = exact == null ? 0 : Math.Max(0, exact.MatchCount),
                        Rate = new PickerRateDecision()
                    };
                    if (exact != null && exact.Candidates != null)
                        unresolved.Candidates.AddRange(exact.Candidates);
                    outcomes[work.RequestId] = unresolved;
                    continue;
                }

                if (work.CreatedAtMs > 0 &&
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - work.CreatedAtMs >= 25000)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "REQUEST_EXPIRED",
                        CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_RESOLVE_BATCH+EXPIRED",
                        Route = exact.Route,
                        Http = exact.StatusCode,
                        OperationMs = (lookup == null ? 0L : Math.Max(0L, lookup.ElapsedMs)) + Math.Max(0L, exact.ElapsedMs),
                        Matches = 1,
                        Rate = new PickerRateDecision()
                    };
                    continue;
                }

                var guard = _confirmationGuard.TryBegin(
                    appSession,
                    exact.PickListCode,
                    work.RequestId,
                    _agentInstanceId,
                    work.PickerUid);

                if (guard.AlreadyConfirmed)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "CONFIRMED",
                        CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_RESOLVE_BATCH+IDEMPOTENT",
                        Route = "FIRESTORE_CONFIRM_GUARD",
                        Http = 200,
                        OperationMs = (lookup == null ? 0L : Math.Max(0L, lookup.ElapsedMs)) + Math.Max(0L, exact.ElapsedMs),
                        Matches = 1,
                        Rate = new PickerRateDecision(),
                        GuardId = guard.GuardId,
                        RetireAtMs = guard.RetireAtMs
                    };
                    continue;
                }

                if (!guard.Acquired || guard.InProgressOrUncertain)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                        CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_RESOLVE_BATCH+GUARD",
                        Route = "FIRESTORE_CONFIRM_GUARD",
                        Http = 409,
                        OperationMs = (lookup == null ? 0L : Math.Max(0L, lookup.ElapsedMs)) + Math.Max(0L, exact.ElapsedMs),
                        Matches = 1,
                        Rate = new PickerRateDecision(),
                        GuardId = guard.GuardId,
                        RetireAtMs = guard.RetireAtMs
                    };
                    continue;
                }

                guardsByRequest[work.RequestId] = guard;
                codeByRequest[work.RequestId] = exact.PickListCode;
                if (!confirmCodes.Exists(item =>
                        string.Equals(item, exact.PickListCode, StringComparison.OrdinalIgnoreCase)))
                    confirmCodes.Add(exact.PickListCode);
            }

            var confirmResults = new Dictionary<string, WmsPicklistConfirmResult>(StringComparer.OrdinalIgnoreCase);
            var confirmBatchSizes = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var sessionExpired = false;
            for (var offset = 0; offset < confirmCodes.Count; offset += 10)
            {
                var count = Math.Min(10, confirmCodes.Count - offset);
                var chunk = confirmCodes.GetRange(offset, count);
                var chunkResults = WmsPicklistConfirmClient.ConfirmMany(wmsSession, chunk);
                foreach (var pair in chunkResults)
                {
                    confirmResults[pair.Key] = pair.Value;
                    confirmBatchSizes[pair.Key] = chunk.Count;
                }
                foreach (var result in chunkResults.Values)
                    if (result != null && string.Equals(result.Result, "SESSION_EXPIRED", StringComparison.Ordinal))
                        sessionExpired = true;
                if (sessionExpired) break;
            }

            if (sessionExpired) ClearWmsSessionAfterExpiry();

            foreach (var work in exactWorks)
            {
                FirestoreConfirmationGuardDecision guard;
                string code;
                if (!guardsByRequest.TryGetValue(work.RequestId ?? "", out guard) ||
                    !codeByRequest.TryGetValue(work.RequestId ?? "", out code))
                    continue;

                CachedPicklistResult lookup;
                lookupBySuffix.TryGetValue(work.Suffix ?? "", out lookup);
                WmsExactPicklistResult exact;
                exactBySuffix.TryGetValue(work.Suffix ?? "", out exact);

                WmsPicklistConfirmResult confirmed;
                if (!confirmResults.TryGetValue(code, out confirmed) || confirmed == null)
                {
                    if (sessionExpired)
                    {
                        _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);
                        outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                        {
                            Result = "SESSION_EXPIRED",
                            CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_RESOLVE_BATCH+GUARD+BATCH_CONFIRM",
                            Route = "NONE",
                            Matches = 1,
                            Rate = new PickerRateDecision(),
                            GuardId = guard.GuardId,
                            RetireAtMs = guard.RetireAtMs
                        };
                    }
                    else
                    {
                        outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                        {
                            Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                            CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_RESOLVE_BATCH+GUARD+BATCH_CONFIRM",
                            Route = "NONE",
                            Matches = 1,
                            Rate = new PickerRateDecision(),
                            GuardId = guard.GuardId,
                            RetireAtMs = guard.RetireAtMs
                        };
                    }
                    continue;
                }

                if (string.Equals(confirmed.Result, "CONFIRMED", StringComparison.Ordinal))
                    _confirmationGuard.MarkLocalConfirmed(guard.GuardId);
                else
                {
                    int batchSize;
                    if (!confirmBatchSizes.TryGetValue(code, out batchSize)) batchSize = 1;
                    if (IsSafeConfirmationFailure(confirmed, batchSize))
                        _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);
                }

                outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                {
                    Result = confirmed.Result ?? "CONFIRM_ERROR",
                    CacheMode = (lookup == null ? "NONE" : lookup.CacheMode) + "+EXACT_RESOLVE_BATCH+GUARD+BATCH_CONFIRM",
                    Route = confirmed.Route,
                    Http = confirmed.StatusCode,
                    OperationMs =
                        (lookup == null ? 0L : Math.Max(0L, lookup.ElapsedMs)) +
                        (exact == null ? 0L : Math.Max(0L, exact.ElapsedMs)) +
                        Math.Max(0L, confirmed.ElapsedMs),
                    Matches = 1,
                    Rate = new PickerRateDecision(),
                    GuardId = guard.GuardId,
                    RetireAtMs = guard.RetireAtMs
                };
            }

            foreach (var outcome in outcomes.Values)
            {
                if (outcome != null && string.Equals(outcome.Result, "CONFIRMED", StringComparison.Ordinal))
                    Interlocked.Increment(ref _localConfirmSuccess);
                else
                    Interlocked.Increment(ref _localConfirmFailed);
            }

            AgentDiagnostics.WriteAudit(
                "PDA_CONFIRM_BATCH jobs=" + works.Count +
                " exact_candidates=" + exactWorks.Count +
                " wms_codes=" + confirmCodes.Count +
                " wms_requests=" + ((confirmCodes.Count + 9) / 10) +
                " values=redacted");

            return outcomes;
        }

        private static bool IsSafeConfirmationFailure(WmsPicklistConfirmResult result, int batchSize)
        {
            if (result == null) return false;
            if (batchSize > 1 &&
                string.Equals(result.Result, "CONFIRM_REJECTED", StringComparison.Ordinal))
            {
                // The supplied multi-code request shape proves batching is accepted, but
                // not that Status=false can identify which individual code mutated.
                // Preserve all acquired guards and fail closed instead of retrying.
                return false;
            }
            return IsSafeConfirmationFailure(result.Result);
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
                    ProcessFirestoreConfirmations,
                    _leaderCoordinator,
                    IsBusinessAllowed,
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
