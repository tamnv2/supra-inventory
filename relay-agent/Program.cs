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

    internal sealed partial class AgentForm : Form
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
        private readonly Button _probeAuth = new Button();
        private readonly Button _probeRtdb = new Button();
        private readonly Button _probeFirestore = new Button();
        private readonly Button _probeAppsScript = new Button();
        private readonly Button _probeSheets = new Button();
        private readonly Button _probeDrive = new Button();
        private readonly Button _probeAll = new Button();
        private readonly Button _wmsCapture = new Button();
        private readonly Button _wmsDesktop = new Button();
        private readonly Button _wmsLogout = new Button();
        private readonly Button _wmsTest = new Button();
        private readonly Button _browserBundleDownload = new Button();
        private readonly ProgressBar _browserBundleProgress = new ProgressBar();
        private readonly Label _browserBundleStatus = new Label();
        private readonly Label _agentDataStorageStatus = new Label();
        private readonly Button _openAgentDataFolder = new Button();
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
        private readonly Button _afterHoursEarlyStart = new Button();
        private readonly Label _supraInfo = new Label();
        private readonly ListBox _log = new ListBox();
        private readonly ListBox _auditLog = new ListBox();
        private readonly NotifyIcon _tray = new NotifyIcon();
        private readonly ToolStripMenuItem _trayStatusItem = new ToolStripMenuItem();
        private readonly SystemMonitor _systemMonitor = new SystemMonitor();
        private readonly System.Windows.Forms.Timer _trayMonitorTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer _networkUiTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer _guardTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer _afterHoursTimer = new System.Windows.Forms.Timer();
        private long _trayMonitorRefreshRunning;
        private long _afterHoursScheduleRefreshRunning;
        private long _networkStatusRefreshRunning;
        private long _watchdogRefreshRunning;
        private string _agentFleetRenderSignature = "";
        private readonly TabControl _mainTabs = new TabControl();
        private readonly TabPage _overviewPage = new TabPage("Tổng quan");
        private readonly TabPage _connectionPage = new TabPage("Kết nối");
        private readonly TabPage _auditPage = new TabPage("Nhật ký vận hành");
        private readonly TabPage _technicalPage = new TabPage("Chẩn đoán kỹ thuật");
        private readonly bool _startupSmoke;
        private readonly bool _autoStarted;
        private readonly HashSet<string> _acked = new HashSet<string>(StringComparer.Ordinal);
        private readonly PickerRateLimiter _pickerRateLimiter = new PickerRateLimiter();
        private SupraConfirmBrowser _supraBrowser;
        private volatile bool _supraBrowserReady;
        private volatile bool _supraBrowserHidden;
        private volatile bool _relayPollHealthyObserved;
        private string _supraBrowserState = "NOT_OPEN";
        private readonly FirestorePickerRateLimiter _firestoreRateLimiter = new FirestorePickerRateLimiter();
        private readonly FirestoreConfirmationGuard _confirmationGuard = new FirestoreConfirmationGuard();
        private readonly FirestoreAgentSessionGate _agentSessionGate;
        private FirestoreAgentLeaderCoordinator _leaderCoordinator;
        private readonly object _sessionLock = new object();
        private AgentSession _session;
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
        private DateTime _lastAfterHoursScheduleSyncAt = DateTime.MinValue;
        private bool? _lastRelayAllowed;
        private bool? _afterHoursLayoutVisible;
        private DateTime _lastAgentDataSizeRefreshUtc = DateTime.MinValue;
        private int _agentDataSizeRefreshRunning;

        private static readonly string RelayDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Agent Auto Confirm Pick Pack", "RelayPoc");
        private static readonly string SessionFile = Path.Combine(RelayDataDir, "session.bin");
        private static readonly string AgentInstanceFile = Path.Combine(RelayDataDir, "agent-instance-id.txt");
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
            _supraBrowser = new SupraConfirmBrowser(message => Log(message));
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
            _network.SetBounds(18, 78, 726, 24); _network.Text = "Wi-Fi: đang đọc..."; Controls.Add(_network);
            _identity.SetBounds(18, 104, 726, 24); _identity.Text = "Agent: chưa ghép"; Controls.Add(_identity);

            Controls.Add(new Label { Left = 18, Top = 140, Width = 90, Text = "ADMIN" });
            _username.SetBounds(110, 136, 180, 26); Controls.Add(_username);
            Controls.Add(new Label { Left = 305, Top = 140, Width = 70, Text = "Mật khẩu" });
            _password.SetBounds(375, 136, 160, 26); _password.UseSystemPasswordChar = true; Controls.Add(_password);
            _pair.SetBounds(545, 135, 105, 28); _pair.Text = "Đăng nhập"; _pair.Click += (s, e) => Task.Run(() => PairLogin()); Controls.Add(_pair);
            _logout.Text = "Đăng xuất"; _logout.Enabled = false; _logout.Click += (s, e) =>
            {
                if (MessageBox.Show(
                    "Đăng xuất Agent sẽ dừng xử lý trên máy này và xóa phiên Agent đã lưu cục bộ. Đăng nhập Supra trong trình duyệt được quản lý riêng bởi trình duyệt.\r\n\r\nTiếp tục đăng xuất?",
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
            Controls.Add(new Label { Left = 560, Top = 178, Width = 184, Height = 38, Text = "Confirm PickList qua Web; Agent không lấy phiên Supra.", ForeColor = Color.DimGray });

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

            Controls.Add(new Label { Left = 18, Top = 286, Width = 726, Height = 20, Text = "Supra — người dùng đăng nhập trực tiếp trên Web Confirm; Agent không lấy phiên:", ForeColor = Color.DimGray });
            _wmsCapture.SetBounds(18, 308, 172, 32); _wmsCapture.Text = "Mở trình duyệt Agent";
            _wmsCapture.Click += (sender, e) => Task.Run(() => OpenSupraConfirmBrowser(false)); Controls.Add(_wmsCapture);
            _wmsDesktop.SetBounds(198, 308, 176, 32); _wmsDesktop.Text = "Mở trình duyệt Desktop";
            _wmsDesktop.Click += (sender, e) => Task.Run(() => OpenSupraConfirmBrowser(true)); Controls.Add(_wmsDesktop);
            _wmsTest.SetBounds(382, 308, 142, 32); _wmsTest.Text = "KIỂM TRA WEB";
            _wmsTest.Click += (sender, e) => Task.Run(() => TestSupraBrowser()); Controls.Add(_wmsTest);
            _wmsStatus.SetBounds(532, 311, 212, 28); _wmsStatus.Text = "Web Confirm: chưa mở"; Controls.Add(_wmsStatus);
            SetProbeButtonsEnabled(false);

            _log.SetBounds(18, 356, 726, 255); Controls.Add(_log);

            BuildProfessionalLayout();

            var menu = new ContextMenuStrip();
            _trayStatusItem.Enabled = false;
            _trayStatusItem.Text = "Máy: đang đọc...";
            menu.Items.Add(_trayStatusItem);
            menu.Items.Add(new ToolStripSeparator());

            menu.Items.Add("Mở Agent", null, (s, e) => RestoreFromTray());
            menu.Items.Add("Mở log", null, (s, e) => AgentDiagnostics.OpenLog());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Tắt Agent...", null, (s, e) => RequestProtectedExit());
            _tray.Text = "Agent Auto Confirm Pick Pack";
            try { _tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application; }
            catch { _tray.Icon = SystemIcons.Application; }
            try { Icon = _tray.Icon; } catch { }
            _tray.ContextMenuStrip = menu; _tray.Visible = true;
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
                try { if (_supraBrowser != null) _supraBrowser.Dispose(); } catch { }
                _tray.Visible = false;
            };

            _networkUiTimer.Interval = 60000;
            _networkUiTimer.Tick += (s, e) => QueueNetworkStatusRefresh();

            _guardTimer.Interval = 60000;
            _guardTimer.Tick += (s, e) => QueueWatchdogRefresh();

            _trayMonitorTimer.Interval = 5000;
            _trayMonitorTimer.Tick += (s, e) => UpdateTrayMonitor();

            _afterHoursTimer.Interval = 1000;
            _afterHoursTimer.Tick += (s, e) =>
            {
                CheckAfterHoursSchedule();
                RefreshBrowserBundleUi();
                QueueAgentDataStorageRefresh();
            };

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
                UpdateTrayMonitor();

                if (_startupSmoke)
                {
                    AgentDiagnostics.Write("STARTUP_SMOKE PASS shell=ready");
                    _allowExit = true;
                    BeginInvoke(new Action(Close));
                    return;
                }

                _guardTimer.Start();
                _networkUiTimer.Start();
                QueueNetworkStatusRefresh();
                _trayMonitorTimer.Start();
                _logUploadTimer.Start();
                _afterHoursTimer.Start();
                AgentBrowserBundle.CleanupObsoleteBackground(message => Log(message));
                QueueAgentDataStorageRefresh(true);
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
                RowCount = 4,
                ColumnCount = 1,
                Margin = Padding.Empty,
                Padding = Padding.Empty
            };
            shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 0F));
            shell.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 24F));
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
            foreach (var page in new[] { _overviewPage, _connectionPage, _auditPage, _technicalPage })
                page.BackColor = Color.FromArgb(243, 246, 248);
            _overviewPage.AutoScroll = false;
            _mainTabs.TabPages.Add(_overviewPage);
            _mainTabs.TabPages.Add(_connectionPage);
            _mainTabs.TabPages.Add(_auditPage);
            _mainTabs.TabPages.Add(_technicalPage);
            _mainTabs.SelectedIndexChanged += (s, e) =>
            {
                if (_mainTabs.SelectedTab == _overviewPage && _leaderCoordinator != null)
                    _leaderCoordinator.RequestFleetRefresh();
            };

            var footer = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(243, 246, 248),
                Margin = Padding.Empty
            };
            var footerCredit = new Label
            {
                Dock = DockStyle.Right,
                Width = 360,
                TextAlign = ContentAlignment.MiddleRight,
                Padding = new Padding(0, 0, 12, 0),
                Text = "Phát triển hệ thống · tamnv2 | Pick Pack 1291",
                ForeColor = Color.FromArgb(105, 117, 128),
                Font = new Font("Segoe UI", 8F, FontStyle.Regular)
            };
            footer.Controls.Add(footerCredit);

            shell.Controls.Add(chrome, 0, 0);
            shell.Controls.Add(_mainTabs, 0, 1);
            shell.Controls.Add(footer, 0, 2);
            Controls.Add(shell);

            // Tổng quan - bố cục cố định, không cuộn toàn trang.
            var overviewLayout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                RowCount = 3,
                ColumnCount = 2,
                Margin = Padding.Empty,
                Padding = new Padding(12)
            };
            overviewLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 48F));
            overviewLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 52F));
            // D122: Agent needs the larger operational surface; Supra and PickList
            // remain compact while all three rows still follow the window height.
            overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 48F));
            overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 29F));
            overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 23F));
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

            agentCard.Controls.Add(new Label { Name = "agent-auth-user-label", Left = 16, Top = 64, Width = 220, Height = 18, Text = "Tài khoản quản trị Agent" });
            _username.SetBounds(16, 82, 260, 27);
            _username.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            agentCard.Controls.Add(_username);

            agentCard.Controls.Add(new Label { Name = "agent-auth-password-label", Left = 288, Top = 64, Width = 90, Height = 18, Text = "Mật khẩu" });
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
            _identity.AutoEllipsis = true;
            _relay.AutoEllipsis = true;
            _network.AutoEllipsis = true;
            agentCard.Controls.Add(_identity);
            agentCard.Controls.Add(_relay);
            agentCard.Controls.Add(_network);

            _agentFleetStatus.SetBounds(16, 144, 990, 20);
            _agentFleetStatus.Text = "Cụm Agent: đang đồng bộ...";
            _agentFleetStatus.ForeColor = Color.FromArgb(50, 70, 82);
            _agentFleetStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            agentCard.Controls.Add(_agentFleetStatus);

            _agentFleetGrid.SetBounds(16, 168, 990, 146);
            _agentFleetGrid.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
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
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Supra", HeaderText = "Web Confirm", Width = 110 });
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Version", HeaderText = "Phiên bản", Width = 95 });
            _agentFleetGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "LastSeen", HeaderText = "Cập nhật", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
            agentCard.Controls.Add(_agentFleetGrid);

            // Hai label này vẫn là state nội bộ cho updater/diagnostics nhưng không chiếm UI Tổng quan.
            _agentSystemInfo.Visible = false;
            _updateStatus.Visible = false;

            _afterHoursPanel.SetBounds(16, 142, 990, 88);
            _afterHoursPanel.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _afterHoursPanel.BackColor = Color.FromArgb(255, 247, 226);
            _afterHoursPanel.BorderStyle = BorderStyle.FixedSingle;
            _afterHoursStatus.SetBounds(10, 7, 470, 34);
            _afterHoursStatus.ForeColor = Color.FromArgb(111, 78, 15);
            _afterHoursPanel.Controls.Add(_afterHoursStatus);
            _afterHoursContinue.Text = "Tiếp tục sau 22:00";
            _afterHoursContinue.Click += (s, e) => SetAfterHoursDecision(AfterHoursDecision.CONTINUE);
            _afterHoursPanel.Controls.Add(_afterHoursContinue);
            _afterHoursStop.Text = "Ngừng từ 22:00";
            _afterHoursStop.Click += (s, e) => SetAfterHoursDecision(AfterHoursDecision.STOP);
            _afterHoursPanel.Controls.Add(_afterHoursStop);
            _afterHoursEarlyStart.Text = "Khởi động relay trước 06:00";
            _afterHoursEarlyStart.Click += (s, e) => StartRelayBeforeSix();
            _afterHoursEarlyStart.Visible = false;
            _afterHoursPanel.Controls.Add(_afterHoursEarlyStart);
            _afterHoursPanel.Visible = false;
            agentCard.Controls.Add(_afterHoursPanel);
            agentCard.Resize += (s, e) =>
            {
                ApplyD119AuthenticatedLayout(HasAgentSession());
                if (_afterHoursLayoutVisible == true) ApplyAfterHoursAgentLayout(true);
            };
            overviewLayout.Controls.Add(agentCard, 0, 0);

            // Đăng nhập Supra - trạng thái trình duyệt, tải bundle và dung lượng dữ liệu cục bộ.
            _supraCard = NewCard(0, 0, 1040, 96);
            _supraCard.Dock = DockStyle.Fill;
            _supraCard.Margin = new Padding(0, 0, 0, 8);
            _supraCard.Controls.Add(new Label
            {
                Left = 16,
                Top = 10,
                Width = 190,
                Height = 24,
                Text = "Đăng nhập Supra · v" + AgentConfig.AgentBuild,
                Font = new Font("Segoe UI Semibold", 12F, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 55)
            });
            _wmsStatus.SetBounds(16, 42, 300, 22);
            _wmsStatus.Text = "Web Confirm: chưa mở";
            _supraCard.Controls.Add(_wmsStatus);
            _supraInfo.SetBounds(320, 42, 410, 22);
            _supraInfo.Text = "HY1 · Trình duyệt chưa mở";
            _supraInfo.ForeColor = Color.FromArgb(88, 104, 115);
            _supraInfo.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _supraCard.Controls.Add(_supraInfo);
            _wmsCapture.SetBounds(16, 72, 188, 32);
            _wmsCapture.Text = "Mở trình duyệt Agent";
            _wmsCapture.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _supraCard.Controls.Add(_wmsCapture);
            _wmsDesktop.SetBounds(212, 72, 198, 32);
            _wmsDesktop.Text = "Mở trình duyệt Desktop";
            _wmsDesktop.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _supraCard.Controls.Add(_wmsDesktop);
            _wmsLogout.SetBounds(16, 110, 138, 30);
            _wmsLogout.Text = "Ẩn trình duyệt";
            _wmsLogout.Enabled = false;
            _wmsLogout.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _wmsLogout.Click += (sender, e) => Task.Run(() => ToggleSupraBrowserVisibility());
            _supraCard.Controls.Add(_wmsLogout);
            _wmsTest.SetBounds(162, 110, 108, 30);
            _wmsTest.Text = "Kiểm tra";
            _wmsTest.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _supraCard.Controls.Add(_wmsTest);

            _browserBundleDownload.SetBounds(278, 110, 180, 30);
            _browserBundleDownload.Text = "Tải trình duyệt Agent";
            _browserBundleDownload.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _browserBundleDownload.Click += (sender, e) => StartAgentBrowserDownload();
            _supraCard.Controls.Add(_browserBundleDownload);

            _browserBundleProgress.SetBounds(16, 148, 442, 18);
            _browserBundleProgress.Minimum = 0;
            _browserBundleProgress.Maximum = 100;
            _browserBundleProgress.Value = 0;
            _browserBundleProgress.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _supraCard.Controls.Add(_browserBundleProgress);

            _browserBundleStatus.SetBounds(16, 170, 500, 24);
            _browserBundleStatus.Text = "Trình duyệt Agent: chưa tải";
            _browserBundleStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _browserBundleStatus.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _browserBundleStatus.AutoEllipsis = true;
            _supraCard.Controls.Add(_browserBundleStatus);

            _agentDataStorageStatus.SetBounds(524, 170, 220, 24);
            _agentDataStorageStatus.Text = "Dữ liệu Agent: đang tính...";
            _agentDataStorageStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _agentDataStorageStatus.AutoEllipsis = true;
            _supraCard.Controls.Add(_agentDataStorageStatus);

            _openAgentDataFolder.SetBounds(752, 166, 244, 28);
            _openAgentDataFolder.Text = "Mở thư mục dữ liệu";
            _openAgentDataFolder.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _openAgentDataFolder.Click += (sender, e) => OpenAgentDataFolder();
            _supraCard.Controls.Add(_openAgentDataFolder);

            RefreshBrowserBundleUi();
            QueueAgentDataStorageRefresh(true);
            _supraCard.Enabled = false;
            overviewLayout.Controls.Add(_supraCard, 0, 1);

            // Xử lý PickList - D121 chia đều chiều cao với Agent và Supra ở cột trái.
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
                _manualPicklistSearch.Enabled = valid;
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

            _manualPicklistGrid.SetBounds(16, 82, 1006, 96);
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
            _manualPicklistGrid.RowTemplate.Height = 34;
            _manualPicklistGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "PickListCode",
                HeaderText = "PickList",
                ReadOnly = true,
                Width = 310,
                MinimumWidth = 240,
                DefaultCellStyle = new DataGridViewCellStyle
                {
                    Font = new Font("Segoe UI Semibold", 11F, FontStyle.Bold),
                    ForeColor = Color.FromArgb(24, 43, 55)
                }
            });
            _manualPicklistGrid.Columns.Add(new DataGridViewButtonColumn
            {
                Name = "ConfirmAction",
                HeaderText = "Thao tác",
                Text = "Xác nhận",
                UseColumnTextForButtonValue = true,
                Width = 130,
                MinimumWidth = 130
            });
            _manualPicklistGrid.Columns.Add(new DataGridViewTextBoxColumn
            {
                Name = "ConfirmStatus",
                HeaderText = "Kết quả",
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

            _manualPicklistStatus.SetBounds(16, 180, 1006, 32);
            _manualPicklistStatus.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Bottom;
            _manualPicklistStatus.Text = "";
            _manualPicklistStatus.Font = new Font("Segoe UI Semibold", 10.5F, FontStyle.Bold);
            _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            directCard.Controls.Add(_manualPicklistStatus);
            overviewLayout.Controls.Add(directCard, 0, 2);
            InitializeD119AgentFeatures(overviewLayout);

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
            if (InvokeRequired)
            {
                BeginInvoke(new Action<List<AgentPresenceView>>(UpdateAgentFleetGrid), agents);
                return;
            }
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var normalized = agents ?? new List<AgentPresenceView>();
            var signature = new StringBuilder();
            foreach (var agent in normalized)
            {
                var ageBucket = Math.Max(0L, nowMs - agent.HeartbeatAtMs) / 60000L;
                signature.Append(agent.AdminUserId).Append('|')
                    .Append(agent.Machine).Append('|')
                    .Append(agent.Role).Append('|')
                    .Append(agent.WmsReady ? '1' : '0').Append('|')
                    .Append(agent.Version).Append('|')
                    .Append(ageBucket).Append(';');
            }
            var nextSignature = signature.ToString();
            if (string.Equals(_agentFleetRenderSignature, nextSignature, StringComparison.Ordinal)) return;
            _agentFleetRenderSignature = nextSignature;

            var firstVisible = -1;
            try { firstVisible = _agentFleetGrid.FirstDisplayedScrollingRowIndex; } catch { }
            _agentFleetGrid.SuspendLayout();
            try
            {
                _agentFleetGrid.Rows.Clear();
                foreach (var agent in normalized)
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
                if (firstVisible >= 0 && firstVisible < _agentFleetGrid.Rows.Count)
                {
                    try { _agentFleetGrid.FirstDisplayedScrollingRowIndex = firstVisible; } catch { }
                }
                ApplyColumnSizingIfEnabled(_agentFleetGrid);
            }
            finally
            {
                _agentFleetGrid.ResumeLayout(true);
            }
        }

        private void ApplyAfterHoursAgentLayout(bool visible)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<bool>(ApplyAfterHoursAgentLayout), visible);
                return;
            }

            var visibilityChanged = !_afterHoursLayoutVisible.HasValue || _afterHoursLayoutVisible.Value != visible;
            _afterHoursLayoutVisible = visible;
            _afterHoursPanel.Visible = visible;
            if (!visible && !visibilityChanged) return;
            if (visible)
            {
                _agentFleetStatus.Visible = false;
                var host = _afterHoursPanel.Parent;
                var hostWidth = host == null ? 990 : host.ClientSize.Width;
                var hostHeight = host == null ? 320 : host.ClientSize.Height;
                var panelWidth = Math.Max(300, hostWidth - 32);
                const int panelTop = 142;
                const int panelHeight = 88;

                _afterHoursPanel.SetBounds(16, panelTop, panelWidth, panelHeight);
                _afterHoursStatus.SetBounds(10, 7, Math.Max(220, panelWidth - 20), 34);

                const int gap = 8;
                var actionWidth = Math.Max(120, (panelWidth - 28 - gap) / 2);
                _afterHoursContinue.SetBounds(10, 48, actionWidth, 32);
                _afterHoursStop.SetBounds(18 + actionWidth, 48, Math.Max(120, panelWidth - 28 - gap - actionWidth), 32);
                _afterHoursEarlyStart.SetBounds(10, 48, Math.Max(240, panelWidth - 20), 32);

                var gridTop = panelTop + panelHeight + 6;
                _agentFleetGrid.SetBounds(
                    16,
                    gridTop,
                    Math.Max(300, hostWidth - 32),
                    Math.Max(46, hostHeight - gridTop - 12));
                _agentFleetGrid.Visible = true;
                _agentFleetGrid.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
                _afterHoursPanel.BringToFront();
            }
            else
            {
                _agentFleetStatus.Visible = true;
                ApplyD119AuthenticatedLayout(HasAgentSession());
            }
        }

        private bool IsBusinessAllowed()
        {
            if (_businessSchedule == null) return true;
            var now = _businessSchedule.NowOperational();
            if (_businessSchedule.DefaultRelayAllowed(now)) return true;
            var coordinator = _leaderCoordinator;
            return coordinator != null &&
                   coordinator.SharedRelayOverrideAllows(
                       _businessSchedule.ScheduleKey(now),
                       OperationalMs(now));
        }

        private static long OperationalMs(DateTime value)
        {
            var local = DateTime.SpecifyKind(value, DateTimeKind.Unspecified);
            return new DateTimeOffset(local, TimeSpan.FromHours(7)).ToUnixTimeMilliseconds();
        }

        private void SetAfterHoursDecision(AfterHoursDecision decision)
        {
            if (_businessSchedule == null || _leaderCoordinator == null || !HasAgentSession())
                return;

            var now = _businessSchedule.NowOperational();
            DateTime boundary;
            if (!_businessSchedule.TryGetPromptBoundary(now, out boundary)) return;

            var until = decision == AfterHoursDecision.CONTINUE
                ? _businessSchedule.ExtensionUntil(boundary)
                : boundary;
            var key = _businessSchedule.ScheduleKey(now);
            var published = _leaderCoordinator.PublishScheduleDecision(
                key,
                OperationalMs(boundary),
                decision.ToString(),
                OperationalMs(until));
            _lastAfterHoursScheduleSyncAt = DateTime.MinValue;
            if (!published)
            {
                _leaderCoordinator.RefreshSharedScheduleNow();
                _afterHoursStatus.Text = "Mốc giờ này đã được một Agent khác xác nhận. Đã đồng bộ quyết định hiện hành.";
                CheckAfterHoursSchedule(true);
                return;
            }

            _lastAfterHoursPromptAt = DateTime.MinValue;
            Log("AFTER_HOURS decision=" + decision +
                " boundary=" + boundary.ToString("HH:mm") +
                " relay_until=" + until.ToString("HH:mm") +
                " schedule_key=" + key +
                " role=" + _leaderCoordinator.RoleName);
            _leaderCoordinator.RequestRoleRefreshBeforeBusiness();
            CheckAfterHoursSchedule(true);
        }

        private void StartRelayBeforeSix()
        {
            if (_businessSchedule == null || _leaderCoordinator == null) return;
            var now = _businessSchedule.NowOperational();
            if (_businessSchedule.DefaultRelayAllowed(now)) return;
            if (!HasReadyConfirmBrowser())
            {
                _afterHoursStatus.Text = "Cần Web Confirm sẵn sàng trước khi khởi động relay.";
                return;
            }

            var until = _businessSchedule.NextRegularStart(now);
            var key = _businessSchedule.ScheduleKey(now);
            if (_leaderCoordinator.PublishEarlyStartAndClaimPrimary(key, OperationalMs(until)))
            {
                _lastAfterHoursPromptAt = DateTime.MinValue;
                _leaderCoordinator.RequestRoleRefreshBeforeBusiness();
                Log("AFTER_HOURS early_start=PASS relay_until=" + until.ToString("HH:mm") + " schedule_key=" + key);
                CheckAfterHoursSchedule(true);
            }
            else
            {
                _afterHoursStatus.Text = "Chưa khởi động được relay sớm · kiểm tra Firestore/Web Confirm.";
            }
        }

        private void QueueSharedScheduleRefresh(FirestoreAgentLeaderCoordinator coordinator)
        {
            if (coordinator == null) return;
            if (Interlocked.CompareExchange(ref _afterHoursScheduleRefreshRunning, 1L, 0L) != 0L) return;

            Task.Run(() =>
            {
                try
                {
                    coordinator.RefreshSharedScheduleNow();
                }
                finally
                {
                    Interlocked.Exchange(ref _afterHoursScheduleRefreshRunning, 0L);
                }
            });
        }

        private void CheckAfterHoursSchedule(bool forcePrompt = false)
        {
            if (_businessSchedule == null) return;
            var now = _businessSchedule.NowOperational();
            var defaultAllowed = _businessSchedule.DefaultRelayAllowed(now);
            var coordinator = _leaderCoordinator;

            DateTime boundary;
            var hasBoundary = _businessSchedule.TryGetPromptBoundary(now, out boundary);
            if (coordinator != null && HasAgentSession())
            {
                var secondsToBoundary = hasBoundary ? (boundary - now).TotalSeconds : double.MaxValue;
                var syncIntervalSeconds = secondsToBoundary >= 0 && secondsToBoundary <= 15 ? 2 : 30;
                var localRelayAllowed = defaultAllowed ||
                    coordinator.SharedRelayOverrideAllows(_businessSchedule.ScheduleKey(now), OperationalMs(now));
                var needsScheduleSync =
                    forcePrompt ||
                    _lastAfterHoursScheduleSyncAt == DateTime.MinValue ||
                    (now - _lastAfterHoursScheduleSyncAt).TotalSeconds >= syncIntervalSeconds ||
                    (!defaultAllowed && !localRelayAllowed);
                if (needsScheduleSync)
                {
                    // D121: never perform Firestore/network I/O on the WinForms timer thread.
                    // The UI keeps using the latest coordinator snapshot while one bounded
                    // background refresh updates the shared schedule cache.
                    _lastAfterHoursScheduleSyncAt = now;
                    QueueSharedScheduleRefresh(coordinator);
                }
            }

            var relayAllowed = IsBusinessAllowed();

            if (!_lastRelayAllowed.HasValue || _lastRelayAllowed.Value != relayAllowed)
            {
                _lastRelayAllowed = relayAllowed;
                if (coordinator != null) coordinator.RequestRoleRefreshBeforeBusiness();
                Log("RELAY SCHEDULE state=" + (relayAllowed ? "ACTIVE" : "SLEEP") +
                    " at=" + now.ToString("HH:mm:ss"));
            }

            var key = _businessSchedule.ScheduleKey(now);
            var boundaryMs = hasBoundary ? OperationalMs(boundary) : 0L;
            var earlyStarted = coordinator != null &&
                               string.Equals(coordinator.SharedScheduleDecision, "EARLY_START", StringComparison.Ordinal) &&
                               coordinator.SharedRelayOverrideAllows(key, OperationalMs(now));
            var needsConfirmation =
                relayAllowed &&
                !earlyStarted &&
                coordinator != null &&
                HasAgentSession() &&
                hasBoundary &&
                !coordinator.HasScheduleDecision(key, boundaryMs);
            var frozenOutsideRegular = !defaultAllowed && !relayAllowed;

            ApplyAfterHoursAgentLayout(needsConfirmation || frozenOutsideRegular);
            _afterHoursContinue.Visible = needsConfirmation;
            _afterHoursStop.Visible = needsConfirmation;
            _afterHoursEarlyStart.Visible = frozenOutsideRegular;

            if (needsConfirmation)
            {
                var until = _businessSchedule.ExtensionUntil(boundary);
                _afterHoursStatus.Text =
                    "Xác nhận ca: có tiếp tục relay PDA sau " + boundary.ToString("HH:mm") + " không?";
                _afterHoursContinue.Text = "Tiếp tục đến " + until.ToString("HH:mm");
                _afterHoursStop.Text = "Dừng lúc " + boundary.ToString("HH:mm");

                if (!forcePrompt &&
                    _lastAfterHoursPromptAt != DateTime.MinValue &&
                    (now - _lastAfterHoursPromptAt).TotalMinutes < 5)
                    return;

                _lastAfterHoursPromptAt = now;
                try
                {
                    _tray.ShowBalloonTip(
                        5000,
                        "Xác nhận thời gian vận hành relay",
                        "Có tiếp tục nhận xác nhận từ PDA sau " + boundary.ToString("HH:mm") +
                        " không? Nếu không xác nhận, relay sẽ tự ngủ tại mốc này.",
                        ToolTipIcon.Warning);
                }
                catch { }
                return;
            }

            _lastAfterHoursPromptAt = DateTime.MinValue;
            if (frozenOutsideRegular)
            {
                var next = _businessSchedule.NextRegularStart(now);
                _afterHoursStatus.Text =
                    "Relay PDA đang ngủ đến " + next.ToString("HH:mm") +
                    " · xác nhận trực tiếp tại Agent vẫn hoạt động.";
                _afterHoursEarlyStart.Text = "Khởi động relay đến " + next.ToString("HH:mm");
                return;
            }

            if (relayAllowed && hasBoundary && coordinator != null &&
                coordinator.HasScheduleDecision(key, boundaryMs))
            {
                var decision = coordinator.SharedScheduleDecision;
                var until = _businessSchedule.ExtensionUntil(boundary);
                _afterHoursStatus.Text = string.Equals(decision, "CONTINUE", StringComparison.Ordinal)
                    ? "Đã xác nhận tiếp tục relay đến " + until.ToString("HH:mm") + " trên hệ thống."
                    : "Đã xác nhận dừng relay tại " + boundary.ToString("HH:mm") + " trên hệ thống.";
                return;
            }

            _afterHoursStatus.Text = relayAllowed
                ? "Relay PDA hoạt động theo lịch đã xác nhận."
                : _businessSchedule.StatusText(now);
        }

        private void StartAgentBrowserDownload()
        {
            var status = AgentBrowserBundle.SnapshotStatus();
            if (status.Ready)
            {
                RefreshBrowserBundleUi();
                return;
            }

            _browserBundleDownload.Enabled = false;
            _browserBundleStatus.Text = "Đang chuẩn bị tải trình duyệt Agent...";
            AgentBrowserBundle.EnsureBackground(message => Log(message));
            RefreshBrowserBundleUi();
        }

        private void RefreshBrowserBundleUi()
        {
            if (_browserBundleStatus == null || _browserBundleProgress == null || _browserBundleDownload == null) return;
            var status = AgentBrowserBundle.SnapshotStatus();
            var value = Math.Max(0, Math.Min(100, status.Percent));
            if (_browserBundleProgress.Value != value) _browserBundleProgress.Value = value;

            if (status.Ready)
            {
                _browserBundleDownload.Text = "Trình duyệt đã sẵn sàng";
                _browserBundleDownload.Enabled = false;
                _wmsCapture.Enabled = HasAgentSession();
                _browserBundleStatus.ForeColor = Color.FromArgb(42, 126, 82);
                _browserBundleStatus.Text = "Trình duyệt Agent khả dụng" +
                    (string.IsNullOrWhiteSpace(status.Version) ? "" : " · WebView2 Fixed " + status.Version);
                return;
            }

            if (status.Downloading)
            {
                _browserBundleDownload.Text = "Đang tải...";
                _browserBundleDownload.Enabled = false;
                _wmsCapture.Enabled = false;
                _browserBundleStatus.ForeColor = Color.FromArgb(71, 85, 105);
                _browserBundleStatus.Text = "Đang tải trình duyệt Agent · " + value + "%" +
                    (string.IsNullOrWhiteSpace(status.Version) ? "" : " · " + status.Version);
                return;
            }

            _browserBundleDownload.Text = "Tải trình duyệt Agent";
            _browserBundleDownload.Enabled = HasAgentSession();
            _wmsCapture.Enabled = false;
            _browserBundleStatus.ForeColor = Color.FromArgb(88, 104, 115);
            _browserBundleStatus.Text = string.IsNullOrWhiteSpace(status.Detail)
                ? "Trình duyệt Agent: chưa tải"
                : status.Detail;
        }

        private void QueueAgentDataStorageRefresh(bool force = false)
        {
            var now = DateTime.UtcNow;
            if (!force && _lastAgentDataSizeRefreshUtc != DateTime.MinValue &&
                now - _lastAgentDataSizeRefreshUtc < TimeSpan.FromMinutes(1))
                return;
            if (Interlocked.CompareExchange(ref _agentDataSizeRefreshRunning, 1, 0) != 0) return;

            _lastAgentDataSizeRefreshUtc = now;
            Task.Run(() =>
            {
                try
                {
                    var browserBytes = DirectorySizeBestEffort(AgentBrowserBundle.BrowserDataRoot);
                    var legacyRoot = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "Agent Auto Confirm Pick Pack");
                    var otherBytes = DirectorySizeBestEffort(legacyRoot);
                    var total = Math.Max(0L, browserBytes) + Math.Max(0L, otherBytes);
                    Ui(() =>
                    {
                        _agentDataStorageStatus.Text =
                            "Dữ liệu Agent: " + FormatBytes(total) +
                            " · Browser " + FormatBytes(browserBytes);
                    });
                }
                catch
                {
                    Ui(() => _agentDataStorageStatus.Text = "Dữ liệu Agent: chưa đọc được");
                }
                finally
                {
                    Interlocked.Exchange(ref _agentDataSizeRefreshRunning, 0);
                }
            });
        }

        private static long DirectorySizeBestEffort(string root)
        {
            long total = 0;
            try
            {
                if (!Directory.Exists(root)) return 0;
                foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
                {
                    try { total += new FileInfo(file).Length; } catch { }
                }
            }
            catch { }
            return total;
        }

        private static string FormatBytes(long bytes)
        {
            var value = Math.Max(0L, bytes);
            if (value >= 1024L * 1024L * 1024L)
                return (value / (1024d * 1024d * 1024d)).ToString("0.00") + " GB";
            if (value >= 1024L * 1024L)
                return (value / (1024d * 1024d)).ToString("0.0") + " MB";
            if (value >= 1024L)
                return (value / 1024d).ToString("0.0") + " KB";
            return value + " B";
        }

        private void OpenAgentDataFolder()
        {
            try
            {
                var root = AgentBrowserBundle.BrowserDataRoot;
                Directory.CreateDirectory(root);
                Process.Start("explorer.exe", "\"" + root + "\"");
            }
            catch (Exception ex)
            {
                Log("AGENT_DATA open_folder=FAIL type=" + ex.GetType().Name +
                    " detail=" + AgentDiagnostics.Sanitize(ex.Message));
            }
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

        private void QueueNetworkStatusRefresh()
        {
            if (!Visible || Interlocked.CompareExchange(ref _networkStatusRefreshRunning, 1L, 0L) != 0L) return;
            Task.Run(() =>
            {
                try
                {
                    var ssid = GetSsid();
                    Ui(() => _network.Text = "Wi-Fi: " + ssid);
                }
                finally
                {
                    Interlocked.Exchange(ref _networkStatusRefreshRunning, 0L);
                }
            });
        }

        private void QueueWatchdogRefresh()
        {
            if (!HasAgentSession() || Interlocked.CompareExchange(ref _watchdogRefreshRunning, 1L, 0L) != 0L) return;
            Task.Run(() =>
            {
                try { AgentRuntimeGuard.EnsureWatchdog(); }
                catch (Exception ex) { AgentDiagnostics.Write("RUNTIME_GUARD refresh=FAIL type=" + ex.GetType().Name); }
                finally { Interlocked.Exchange(ref _watchdogRefreshRunning, 0L); }
            });
        }

        private void UpdateTrayMonitor()
        {
            if (Interlocked.CompareExchange(ref _trayMonitorRefreshRunning, 1L, 0L) != 0L) return;

            // D121: PerformanceCounter/GPU/NIC sampling can occasionally stall while
            // Windows rebuilds counters or adapters. Keep it completely off the UI thread
            // and coalesce overlapping 5-second timer ticks.
            Task.Run(() =>
            {
                try
                {
                    var metrics = _systemMonitor.Sample();
                    RefreshSupraBrowserStatus();
                    Ui(() => ApplyTrayMonitor(metrics));
                }
                catch
                {
                    Ui(ApplyTrayMonitorUnavailable);
                }
                finally
                {
                    Interlocked.Exchange(ref _trayMonitorRefreshRunning, 0L);
                }
            });
        }

        private void ApplyTrayMonitor(SystemMetrics metrics)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<SystemMetrics>(ApplyTrayMonitor), metrics);
                return;
            }
            try
            {
                var compact = metrics.Compact();
                if (compact.Length > 63) compact = compact.Substring(0, 63);
                _tray.Text = compact;
                _trayStatusItem.Text = metrics.MenuText();

                var online = _leaderCoordinator == null
                    ? (_listenCts != null ? 1 : (HasReadyConfirmBrowser() ? 1 : 0))
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
                    "HY1 · " +
                    (HasReadyConfirmBrowser() ? "Web Confirm sẵn sàng" : BrowserStateLabel(_supraBrowserState)) +
                    (_supraBrowserHidden ? " · Đang ẩn" : " · Đang hiển thị");

            }
            catch
            {
                ApplyTrayMonitorUnavailable();
            }
        }

        private void ApplyTrayMonitorUnavailable()
        {
            _tray.Text = "SUPRA Agent";
            _trayStatusItem.Text = "Máy: chưa đọc được tài nguyên";
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
                _wmsCapture.Enabled = enabled && HasAgentSession() && AgentBrowserBundle.SnapshotStatus().Ready;
                _wmsCapture.Text = "Mở trình duyệt Agent";
                _wmsDesktop.Enabled = enabled && HasAgentSession();
                _wmsDesktop.Text = "Mở trình duyệt Desktop";
                _wmsLogout.Enabled = enabled && !string.Equals(_supraBrowserState, "NOT_OPEN", StringComparison.Ordinal);
                _wmsLogout.Text = _supraBrowserHidden ? "Hiện trình duyệt" : "Ẩn trình duyệt";
                _wmsTest.Enabled = enabled && !string.Equals(_supraBrowserState, "NOT_OPEN", StringComparison.Ordinal);
            });
        }

        private bool HasReadyConfirmBrowser()
        {
            return _supraBrowserReady;
        }

        private static string BrowserStateLabel(string state)
        {
            switch (state ?? "")
            {
                case "READY": return "Web Confirm sẵn sàng";
                case "LOGIN_OR_DOM_NOT_READY": return "Chờ đăng nhập / tải trang";
                case "CONFIRM_DOM_PARTIAL": return "Đang nhận diện giao diện Confirm";
                case "WRONG_PAGE": return "Sai trang Confirm";
                case "BROWSER_ERROR": return "Lỗi trình duyệt";
                case "DOM_UNAVAILABLE": return "DOM chưa sẵn sàng";
                default: return "Trình duyệt chưa mở";
            }
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
                count >= 2 && HasAgentSession() && HasReadyConfirmBrowser();
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
                _manualPicklistStatus.Text = "Đang tìm PickList trên Web Confirm...";
                _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            });

            try
            {
                if (queries == null || queries.Count == 0)
                    throw new InvalidOperationException("Nhập tối thiểu 3 số cho mỗi PickList; tối đa 10 giá trị, ngăn cách bằng dấu phẩy.");
                if (!HasAgentSession())
                    throw new InvalidOperationException("Cần xác minh Agent bằng tài khoản quản trị trước.");
                if (!HasReadyConfirmBrowser())
                    throw new InvalidOperationException("Web Confirm chưa sẵn sàng. Hãy mở Trình duyệt Agent hoặc Trình duyệt Desktop và đăng nhập Supra.");

                var result = _supraBrowser.SearchMany(queries, true);

                Ui(() =>
                {
                    _manualPicklistGrid.Rows.Clear();
                    foreach (var code in result.Matches)
                        _manualPicklistGrid.Rows.Add(code, null, "Sẵn sàng xác nhận");

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
                                ? " · " + result.MissingFragments.Count + " từ khóa không có kết quả sau khi tìm lại."
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
                    ApplyColumnSizingIfEnabled(_manualPicklistGrid);
                });

                AgentDiagnostics.WriteAudit(
                    "MANUAL_PICKLIST_SEARCH adapter=BROWSER_DOM result=" + result.Result +
                    " query_count=" + queries.Count +
                    " missing_queries=" + result.MissingFragments.Count +
                    " ambiguous_queries=" + result.AmbiguousFragments.Count +
                    " matches=" + result.Matches.Count +
                    " search_click=" + (result.SearchClicked ? "1" : "0") +
                    " session_extract=false direct_wms_api=false");
            }
            catch (Exception ex)
            {
                Ui(() =>
                {
                    _manualPicklistStatus.Text = SafeMessage(ex);
                    _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                    _manualPicklistConfirmAll.Visible = false;
                });
                Log("Manual PickList browser search fail: " + SafeMessage(ex));
            }
            finally
            {
                Interlocked.Exchange(ref _manualPicklistOperationRunning, 0);
                Ui(() =>
                {
                    List<string> parsed;
                    _manualPicklistSearch.Enabled =
                        TryParseManualPicklistQueries(_manualPicklistQuery.Text, out parsed);
                    _manualPicklistGrid.Enabled =
                        HasAgentSession() && HasReadyConfirmBrowser();
                    UpdateManualConfirmAllVisibility();
                });
            }
        }

        

        private static string ManualOutcomeText(string status)
        {
            switch (status ?? "")
            {
                case "CONFIRMED": return "Đã xác nhận thành công";
                case "ALREADY_CONFIRMED": return "Đã xác nhận trước đó";
                case "CONFIRM_REJECTED": return "Supra từ chối xác nhận";
                case "CONFIRM_CONFLICT": return "Xung đột trạng thái PickList";
                case "SESSION_EXPIRED":
                case "WMS_SESSION_REQUIRED":
                case "WEB_CONFIRM_REQUIRED": return "Web Confirm chưa sẵn sàng";
                case "EXACT_CODE_NOT_RESOLVED": return "PickList đã thay đổi · cần tìm lại";
                case "AMBIGUOUS_PICKLIST": return "Có nhiều PickList trùng số đuôi";
                case "FORBIDDEN": return "Supra từ chối quyền xác nhận";
                case "PROXY_BLOCK":
                case "PROXY_AUTH_REQUIRED":
                case "TRANSPORT_FAIL": return "Kết nối Supra đang gián đoạn";
                case "RATE_LIMITED": return "Hệ thống đang giới hạn yêu cầu";
                case "SERVER_ERROR": return "Supra đang lỗi máy chủ";
                case "CONFIRM_IN_PROGRESS_OR_UNCERTAIN": return "Chưa chắc chắn · không xác nhận lại";
                default: return "Không hoàn tất · " + (string.IsNullOrWhiteSpace(status) ? "CONFIRM_ERROR" : status);
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
                var code = (raw ?? "").Trim().ToUpperInvariant();
                if (!Regex.IsMatch(code, "^PL[0-9]+$") || !seen.Add(code)) continue;
                codes.Add(code);
            }

            UiSync(() =>
            {
                _manualPicklistGrid.Enabled = false;
                _manualPicklistSearch.Enabled = false;
                _manualPicklistConfirmAll.Enabled = false;
                _manualPicklistStatus.Text = codes.Count <= 1
                    ? "Đang xác nhận PickList trên Web Confirm..."
                    : "Đang xác nhận " + codes.Count + " PickList...";
                _manualPicklistStatus.ForeColor = Color.FromArgb(88, 104, 115);
            });

            try
            {
                if (codes.Count == 0) throw new InvalidOperationException("Chưa chọn PickList.");
                if (codes.Count > 50) throw new InvalidOperationException("Tối đa 50 PickList hiển thị cho một lần xác nhận tất cả.");
                if (!HasAgentSession()) throw new InvalidOperationException("Phiên xác minh Agent không còn hợp lệ.");
                if (!HasReadyConfirmBrowser()) throw new InvalidOperationException("Web Confirm chưa sẵn sàng.");

                EnsureFreshToken();
                var appSession = SnapshotSession();
                if (!_agentSessionGate.IsCurrent(appSession, _agentInstanceId))
                    throw new InvalidOperationException("Phiên Agent này đã bị thay thế bởi Agent khác.");

                var acquired = new Dictionary<string, FirestoreConfirmationGuardDecision>(StringComparer.OrdinalIgnoreCase);
                var statusByCode = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var alreadyConfirmed = 0;
                var uncertain = 0;

                foreach (var code in codes)
                {
                    var requestId = "manual:" + Guid.NewGuid().ToString("N");
                    var guard = _confirmationGuard.TryBegin(
                        appSession, code, requestId, _agentInstanceId, "manual:" + appSession.UserId);

                    if (guard.AlreadyConfirmed)
                    {
                        alreadyConfirmed++;
                        statusByCode[code] = "ALREADY_CONFIRMED";
                    }
                    else if (!guard.Acquired || guard.InProgressOrUncertain)
                    {
                        uncertain++;
                        statusByCode[code] = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                    }
                    else acquired[code] = guard;
                }

                var confirmedCount = 0;
                var failedCount = 0;
                foreach (var pair in acquired)
                {
                    SupraBrowserConfirmResult result;
                    try { result = _supraBrowser.ConfirmExact(pair.Key); }
                    catch (Exception ex)
                    {
                        uncertain++;
                        statusByCode[pair.Key] = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                        Log("Manual browser confirm uncertain code=redacted type=" + ex.GetType().Name);
                        continue;
                    }

                    statusByCode[pair.Key] = result.Result ?? "CONFIRM_ERROR";
                    if (string.Equals(result.Result, "CONFIRMED", StringComparison.Ordinal))
                    {
                        _confirmationGuard.MarkLocalConfirmed(pair.Value.GuardId);
                        confirmedCount++;
                    }
                    else if (IsSafeBrowserFailure(result))
                    {
                        _confirmationGuard.ReleaseSafeFailure(appSession, pair.Value.GuardId);
                        failedCount++;
                    }
                    else uncertain++;
                }

                Ui(() =>
                {
                    foreach (DataGridViewRow row in _manualPicklistGrid.Rows)
                    {
                        if (row == null || row.IsNewRow) continue;
                        var code = Convert.ToString(row.Cells["PickListCode"].Value) ?? "";
                        string rowStatus;
                        if (statusByCode.TryGetValue(code, out rowStatus))
                            row.Cells["ConfirmStatus"].Value = ManualOutcomeText(rowStatus);
                    }

                    var totalOk = confirmedCount + alreadyConfirmed;
                    if (codes.Count == 1)
                    {
                        string singleStatus;
                        statusByCode.TryGetValue(codes[0], out singleStatus);
                        _manualPicklistStatus.Text = codes[0] + " · " + ManualOutcomeText(singleStatus ?? "CONFIRM_ERROR");
                    }
                    else
                    {
                        _manualPicklistStatus.Text =
                            "Đã xử lý " + codes.Count + " PickList · thành công " + totalOk +
                            (uncertain > 0 ? " · chưa chắc chắn " + uncertain : "") +
                            (failedCount > 0 ? " · lỗi " + failedCount : "");
                    }
                    _manualPicklistStatus.ForeColor =
                        uncertain == 0 && failedCount == 0
                            ? Color.FromArgb(35, 122, 76)
                            : Color.FromArgb(180, 76, 60);
                });

                AgentDiagnostics.WriteAudit(
                    "MANUAL_PICKLIST_CONFIRM adapter=BROWSER_DOM requested=" + codes.Count +
                    " confirmed=" + confirmedCount +
                    " already=" + alreadyConfirmed +
                    " uncertain=" + uncertain +
                    " failed=" + failedCount +
                    " session_extract=false direct_wms_api=false");
            }
            catch (Exception ex)
            {
                Ui(() =>
                {
                    _manualPicklistStatus.Text = SafeMessage(ex);
                    _manualPicklistStatus.ForeColor = Color.FromArgb(180, 76, 60);
                });
                Log("Manual PickList browser confirm fail: " + SafeMessage(ex));
            }
            finally
            {
                Interlocked.Exchange(ref _manualPicklistOperationRunning, 0);
                Ui(() =>
                {
                    List<string> parsed;
                    _manualPicklistSearch.Enabled =
                        TryParseManualPicklistQueries(_manualPicklistQuery.Text, out parsed);
                    _manualPicklistGrid.Enabled =
                        HasAgentSession() && HasReadyConfirmBrowser();
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
                HasReadyConfirmBrowser,
                ProbeSupraBrowserForTakeover,
                IsBusinessAllowed,
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
                        if (role == FirestoreAgentRole.PRIMARY) RefreshD119OperationalViews(true);
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

        private void RefreshSupraBrowserStatus()
        {
            if (_supraBrowser == null) return;
            var wasReady = _supraBrowserReady;
            try
            {
                var state = _supraBrowser.RefreshState();
                _supraBrowserReady = state.Ready;
                _supraBrowserHidden = state.Hidden;
                _supraBrowserState = state.State ?? "NOT_OPEN";
                Ui(() =>
                {
                    _wmsStatus.Text = state.Ready
                        ? "Web Confirm sẵn sàng"
                        : "Web Confirm: " + BrowserStateLabel(state.State);
                    _supraInfo.Text =
                        "HY1 · " + (string.IsNullOrWhiteSpace(state.Browser) ? "Trình duyệt" : state.Browser) +
                        (state.Hidden ? " · Đang ẩn" : " · Đang hiển thị") +
                        (state.Ready ? "" :
                            " · DOM Tìm=" + state.SearchCount +
                            " XN=" + state.ConfirmCount +
                            " Bảng=" + state.TableCount);
                    _wmsLogout.Text = state.Hidden ? "Hiện trình duyệt" : "Ẩn trình duyệt";
                    _wmsLogout.Enabled = !string.Equals(state.State, "NOT_OPEN", StringComparison.Ordinal) && HasAgentSession();
                    _wmsTest.Enabled = !string.Equals(state.State, "NOT_OPEN", StringComparison.Ordinal) && HasAgentSession();
                    _wmsCapture.Enabled = HasAgentSession() && AgentBrowserBundle.SnapshotStatus().Ready;
                    _wmsDesktop.Enabled = HasAgentSession();
                    _manualPicklistGrid.Enabled = HasAgentSession() && state.Ready;
                    UpdateManualConfirmAllVisibility();
                });
            }
            catch (Exception ex)
            {
                _supraBrowserReady = false;
                _supraBrowserState = "BROWSER_ERROR";
                Ui(() => _wmsStatus.Text = "Web Confirm: lỗi trình duyệt");
                AgentDiagnostics.Write("SUPRA_BROWSER readiness=FAIL type=" + ex.GetType().Name);
            }

            if (wasReady != _supraBrowserReady)
            {
                var coordinator = _leaderCoordinator;
                if (coordinator != null) coordinator.RequestRoleRefreshBeforeBusiness();
            }
        }

        private void OpenSupraConfirmBrowser(bool desktop)
        {
            Ui(() => _wmsStatus.Text = desktop
                ? "Web Confirm: đang mở Desktop..."
                : "Web Confirm: đang mở trình duyệt Agent...");
            try
            {
                var state = desktop
                    ? _supraBrowser.OpenOrShowDesktop()
                    : _supraBrowser.OpenOrShowAgent();
                _supraBrowserReady = state.Ready;
                _supraBrowserHidden = state.Hidden;
                _supraBrowserState = state.State ?? "NOT_OPEN";
                RefreshSupraBrowserStatus();
                Log("SUPRA_BROWSER open mode=" + (desktop ? "DESKTOP" : "AGENT") +
                    " state=" + _supraBrowserState +
                    " ready=" + (_supraBrowserReady ? "1" : "0") +
                    " page=" + (state.Url ?? "") +
                    " search=" + state.SearchCount +
                    " search_exact=" + state.SearchExactCount +
                    " search_decorated=" + state.SearchDecoratedCount +
                    " confirm=" + state.ConfirmCount +
                    " confirm_visible=" + state.ConfirmVisibleCount +
                    " table=" + state.TableCount +
                    " frames=" + state.FrameCount +
                    " session_extract=false direct_wms_api=false auto_fallback=false");
            }
            catch (Exception ex)
            {
                _supraBrowserReady = false;
                _supraBrowserState = "BROWSER_ERROR";
                Ui(() => _wmsStatus.Text = desktop
                    ? "Desktop: không mở được · xem log"
                    : "Trình duyệt Agent: không mở được · xem log");
                Log("SUPRA_BROWSER open fail mode=" + (desktop ? "DESKTOP" : "AGENT") +
                    " type=" + ex.GetType().Name + " detail=" + SafeMessage(ex) + " auto_fallback=false");
            }
            finally { SetProbeButtonsEnabled(true); }
        }

        private void ToggleSupraBrowserVisibility()
        {
            try
            {
                if (_supraBrowserHidden) _supraBrowser.Show();
                else _supraBrowser.Hide();
                RefreshSupraBrowserStatus();
            }
            catch (Exception ex)
            {
                Log("SUPRA_BROWSER visibility fail: " + SafeMessage(ex));
            }
        }

        private void TestSupraBrowser()
        {
            try
            {
                var state = _supraBrowser.RefreshState();
                _supraBrowserReady = state.Ready;
                _supraBrowserHidden = state.Hidden;
                _supraBrowserState = state.State ?? "NOT_OPEN";
                Log("SUPRA_BROWSER check state=" + _supraBrowserState +
                    " ready=" + (_supraBrowserReady ? "1" : "0") +
                    " page=" + (state.Url ?? "") +
                    " search=" + state.SearchCount +
                    " search_exact=" + state.SearchExactCount +
                    " search_decorated=" + state.SearchDecoratedCount +
                    " confirm=" + state.ConfirmCount +
                    " confirm_visible=" + state.ConfirmVisibleCount +
                    " table=" + state.TableCount +
                    " frames=" + state.FrameCount +
                    " session_extract=false direct_wms_api=false");
                RefreshSupraBrowserStatus();
            }
            catch (Exception ex)
            {
                _supraBrowserReady = false;
                _supraBrowserState = "BROWSER_ERROR";
                Log("SUPRA_BROWSER check fail type=" + ex.GetType().Name);
            }
            Ui(() => _wmsStatus.Text = _supraBrowserReady
                ? "Web Confirm sẵn sàng"
                : "Web Confirm: " + BrowserStateLabel(_supraBrowserState));
        }

        

        private void StartupSequence()
        {
            UserStartupRegistration.EnsureRegistered();
            LogNetworkSnapshot("startup");
            if (TryAutoUpdate(true)) return;
            RestoreSession();
            AgentBrowserBundle.EnsureBackground(Log);
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
                    RefreshSupraBrowserStatus();
                });
            }
            catch (Exception ex)
            {
                ClearStoredSession();
                lock (_sessionLock) _session = null;
                Ui(() =>
                {
                    _identity.Text = "Agent: cần đăng nhập quản trị";
                    _listen.Enabled = false;
                    _testOffice.Enabled = false;
                });
                SetAgentAuthUi(false);
                SetProbeButtonsEnabled(false);
                Log("Phiên Agent cũ bị loại; cần đăng nhập lại bằng tài khoản quản trị: " + SafeMessage(ex));
            }
        }

        private static bool IsAgentOperatorRole(string role, string baseRole)
        {
            return
                (string.Equals(role, "ADMIN", StringComparison.Ordinal) &&
                 string.Equals(baseRole, "ADMIN", StringComparison.Ordinal)) ||
                (string.Equals(role, "PICKPACK_ADMIN", StringComparison.Ordinal) &&
                 string.Equals(baseRole, "PICKPACK_ADMIN", StringComparison.Ordinal));
        }

        private static string AgentRoleLabel(string role)
        {
            if (string.Equals(role, "PICKPACK_ADMIN", StringComparison.Ordinal)) return "Quản trị Pick Pack";
            if (string.Equals(role, "ADMIN", StringComparison.Ordinal)) return "Quản trị Invent";
            return "Quản trị";
        }

        private static string ResolveAgentFirebaseEmail(string identifier, string role)
        {
            var value = (identifier ?? "").Trim().ToLowerInvariant();
            if (value.Length == 0) throw new InvalidOperationException("Nhập tài khoản Agent.");
            if (!Regex.IsMatch(value, "^[a-z0-9._-]{1,64}$"))
                throw new InvalidOperationException("Tài khoản Agent không hợp lệ.");
            var seed = Regex.Replace(value, "[^a-z0-9._-]", "-").Trim('-');
            if (seed.Length > 44) seed = seed.Substring(0, 44);
            if (seed.Length == 0) throw new InvalidOperationException("Tài khoản Agent không hợp lệ.");

            var prefix = string.Equals(role, "PICKPACK_ADMIN", StringComparison.Ordinal)
                ? "pickpack_admin"
                : "admin";
            return prefix + "." + seed + "@auth.supra.invalid";
        }

        private AgentSession FirebasePasswordLoginForRole(string identifier, string password, string expectedRole)
        {
            var email = ResolveAgentFirebaseEmail(identifier, expectedRole);
            var url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
                      Uri.EscapeDataString(AgentConfig.FirebaseApiKey);
            var payload = _json.Serialize(new Dictionary<string, object>
            {
                { "email", email },
                { "password", password },
                { "returnSecureToken", true }
            });
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
            if (!string.Equals(tokenRole, expectedRole, StringComparison.Ordinal) ||
                !string.Equals(tokenBaseRole, expectedRole, StringComparison.Ordinal) ||
                !IsAgentOperatorRole(tokenRole, tokenBaseRole) ||
                string.IsNullOrWhiteSpace(tokenAppUser))
                throw new InvalidOperationException("Tài khoản không có quyền Agent hợp lệ.");

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

        private AgentSession FirebasePasswordLoginDirect(string identifier, string password)
        {
            if (string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException("Nhập mật khẩu Agent.");

            Log("Firebase Agent login START host=identitytoolkit.googleapis.com ssid=" + GetSsid());
            RelayHttpException firstCredentialFailure = null;
            try
            {
                return FirebasePasswordLoginForRole(identifier, password, "ADMIN");
            }
            catch (RelayHttpException ex)
            {
                if (ex.StatusCode != 400) throw;
                firstCredentialFailure = ex;
            }

            try
            {
                return FirebasePasswordLoginForRole(identifier, password, "PICKPACK_ADMIN");
            }
            catch (RelayHttpException ex)
            {
                if (ex.StatusCode != 400) throw;
                throw firstCredentialFailure ?? ex;
            }
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
                Log("Nhập tài khoản Quản trị Invent hoặc Quản trị Pick Pack và mật khẩu.");
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
                            "Tài khoản này đang đăng nhập trên Agent khác.\r\n\r\n" +
                            "Nếu tiếp tục, Agent cũ sẽ mất quyền xác nhận đơn. Web và App vẫn giữ nguyên.\r\n\r\n" +
                            "Tiếp tục đăng nhập Agent này?",
                            "Xác nhận thay thế Agent",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Warning) == DialogResult.Yes;
                    });
                    if (!proceed)
                    {
                        Log("Firebase Agent login CANCEL same-channel-conflict=true");
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
                    "Agent Firebase login PASS user=" + next.AppUserId +
                    " machine=" + Environment.MachineName +
                    " instance=" + Short(_agentInstanceId) +
                    " firebase_uid=" + Fingerprint(next.UserId)
                );
                ActivateRelayRuntime();
                Task.Run(() =>
                {
                    _agentLogBridge.TryFlushPendingCrash();
                    _agentLogBridge.TryQueueScheduledSnapshot();
                    RefreshSupraBrowserStatus();
                });
            }
            catch (Exception ex)
            {
                Log("Đăng nhập Agent Firebase thất bại: " + SafeMessage(ex));
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

            // D123: SetAgentAuthUi is called from startup/login/session-recovery worker tasks.
            // Every WinForms mutation, including the D119 layout/column sizing path, must
            // execute on the UI thread. Cross-thread DataGridView AutoResize was able to
            // deadlock the window after the UI had already rendered.
            Ui(() =>
            {
                _username.Enabled = !authenticated;
                _password.Enabled = !authenticated;
                _pair.Enabled = !authenticated;
                _logout.Enabled = authenticated;
                _pair.Text = authenticated ? "Đã xác minh Agent" : "Đăng nhập Agent";
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
                        _wmsStatus.Text = "Web Confirm: chờ xác minh Agent";
                        _wmsCapture.Enabled = false;
                        _wmsDesktop.Enabled = false;
                        _wmsTest.Enabled = false;
                    }
                }
                ApplyD119AuthenticatedLayout(authenticated);
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
            AgentRuntimeGuard.MarkPlannedExit();
            try { if (File.Exists(ExitVerifierFile)) File.Delete(ExitVerifierFile); } catch { }

            Ui(() =>
            {
                _identity.Text = "Agent: cần đăng nhập quản trị";
                _relay.Text = "Relay: chưa xác minh Agent";
                _listen.Enabled = false;
                _testOffice.Enabled = false;
                _wmsStatus.Text = "Web Confirm: chờ đăng nhập Agent";
                _supraInfo.Text = "HY1 · Web Confirm tạm dừng đến khi đăng nhập Agent";
            });
            SetAgentAuthUi(false);
            SetProbeButtonsEnabled(false);
            Log("Agent logout PASS previous_user=" + previousUser + " stored_session=cleared");
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

            if (!HasReadyConfirmBrowser())
            {
                foreach (var work in works)
                {
                    if (work == null || string.IsNullOrWhiteSpace(work.RequestId) || outcomes.ContainsKey(work.RequestId)) continue;
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "WMS_SESSION_REQUIRED",
                        CacheMode = "WEB_CONFIRM_NOT_READY",
                        Route = "BROWSER_DOM"
                    };
                }
                return outcomes;
            }

            var eligible = new List<FirestoreConfirmationWorkItem>();
            var suffixes = new List<string>();
            foreach (var work in works)
            {
                if (work == null || string.IsNullOrWhiteSpace(work.RequestId) || outcomes.ContainsKey(work.RequestId)) continue;
                eligible.Add(work);
                suffixes.Add(work.Suffix);
            }

            SupraBrowserSearchResult search;
            try
            {
                search = eligible.Count == 0
                    ? new SupraBrowserSearchResult { Result = "NOT_FOUND" }
                    : _supraBrowser.SearchMany(suffixes, true);
            }
            catch (Exception ex)
            {
                foreach (var work in eligible)
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "LOOKUP_ERROR",
                        CacheMode = "BROWSER_DOM_ERROR",
                        Route = "BROWSER_DOM"
                    };
                Log("FIRESTORE browser lookup fail type=" + ex.GetType().Name);
                return outcomes;
            }

            var guardsByRequest = new Dictionary<string, FirestoreConfirmationGuardDecision>(StringComparer.Ordinal);
            var codeByRequest = new Dictionary<string, string>(StringComparer.Ordinal);

            foreach (var work in eligible)
            {
                List<string> candidates;
                if (!search.Candidates.TryGetValue(work.Suffix ?? "", out candidates))
                    candidates = new List<string>();

                if (candidates.Count == 0)
                {
                    var rate = _firestoreRateLimiter.RecordNotFound(
                        appSession, work.PickerUid, work.PickerUserId, work.RequestId);
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = rate.IsLocked ? "PICKER_LOCKED" : "NOT_FOUND",
                        CacheMode = "BROWSER_DOM" + (search.SearchClicked ? "+SEARCH_CLICK" : ""),
                        Route = "BROWSER_DOM",
                        OperationMs = Math.Max(0L, search.ElapsedMs),
                        Matches = 0,
                        Rate = rate
                    };
                    continue;
                }

                if (candidates.Count != 1)
                {
                    var ambiguous = new FirestoreConfirmationOutcome
                    {
                        Result = "AMBIGUOUS_PICKLIST",
                        CacheMode = "BROWSER_DOM",
                        Route = "BROWSER_DOM",
                        OperationMs = Math.Max(0L, search.ElapsedMs),
                        Matches = candidates.Count,
                        Rate = new PickerRateDecision()
                    };
                    ambiguous.Candidates.AddRange(candidates);
                    outcomes[work.RequestId] = ambiguous;
                    continue;
                }

                if (search.UnselectableFragments.Exists(x => string.Equals(x, work.Suffix ?? "", StringComparison.Ordinal)))
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "CONFIRM_REJECTED",
                        CacheMode = "BROWSER_DOM+SEARCH_REFRESH+CHECKBOX_NOT_READY",
                        Route = "BROWSER_DOM",
                        OperationMs = Math.Max(0L, search.ElapsedMs),
                        Matches = 1,
                        Rate = new PickerRateDecision()
                    };
                    continue;
                }

                _firestoreRateLimiter.ClearFound(appSession, work.PickerUid);

                var ageNow = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                if (work.CreatedAtMs <= 0 || ageNow - work.CreatedAtMs >= 20000L)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "REQUEST_EXPIRED",
                        CacheMode = "BROWSER_DOM+AGE_FENCE",
                        Route = "BROWSER_DOM",
                        OperationMs = Math.Max(0L, search.ElapsedMs),
                        Matches = 1,
                        Rate = new PickerRateDecision()
                    };
                    continue;
                }

                var code = candidates[0];
                var guard = _confirmationGuard.TryBegin(
                    appSession, code, work.RequestId, _agentInstanceId, work.PickerUid);

                if (guard.AlreadyConfirmed)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "CONFIRMED",
                        CacheMode = "BROWSER_DOM+IDEMPOTENT",
                        Route = "FIRESTORE_CONFIRM_GUARD",
                        Http = 200,
                        OperationMs = Math.Max(0L, search.ElapsedMs),
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
                        CacheMode = "BROWSER_DOM+GUARD",
                        Route = "FIRESTORE_CONFIRM_GUARD",
                        Http = 409,
                        OperationMs = Math.Max(0L, search.ElapsedMs),
                        Matches = 1,
                        Rate = new PickerRateDecision(),
                        GuardId = guard.GuardId,
                        RetireAtMs = guard.RetireAtMs
                    };
                    continue;
                }

                guardsByRequest[work.RequestId] = guard;
                codeByRequest[work.RequestId] = code;
            }

            var browserMutationCount = 0;
            foreach (var work in eligible)
            {
                FirestoreConfirmationGuardDecision guard;
                string code;
                if (!guardsByRequest.TryGetValue(work.RequestId ?? "", out guard) ||
                    !codeByRequest.TryGetValue(work.RequestId ?? "", out code))
                    continue;

                var finalAgeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                if (work.CreatedAtMs <= 0 || finalAgeMs - work.CreatedAtMs >= 20000L)
                {
                    _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "REQUEST_EXPIRED",
                        CacheMode = "BROWSER_DOM+GUARD+FINAL_20S_FENCE",
                        Route = "BROWSER_DOM",
                        Matches = 1,
                        GuardId = guard.GuardId,
                        RetireAtMs = guard.RetireAtMs,
                        Rate = new PickerRateDecision()
                    };
                    continue;
                }

                var fenceOk = false;
                try
                {
                    fenceOk = _leaderCoordinator != null &&
                              _leaderCoordinator.VerifyPrimaryBeforeMutation(appSession);
                }
                catch (Exception ex)
                {
                    Log("FIRESTORE CONFIRM browser generation fence error type=" + ex.GetType().Name);
                }
                if (!fenceOk)
                {
                    _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                        CacheMode = "BROWSER_DOM+ROLE_GENERATION_FENCE",
                        Route = "ROLE_GENERATION_FENCE",
                        Matches = 1,
                        GuardId = guard.GuardId,
                        RetireAtMs = guard.RetireAtMs,
                        Rate = new PickerRateDecision(),
                        ShouldAck = false
                    };
                    continue;
                }

                SupraBrowserConfirmResult confirmed;
                try
                {
                    confirmed = _supraBrowser.ConfirmExact(code);
                    browserMutationCount++;
                }
                catch (Exception ex)
                {
                    outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                    {
                        Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                        CacheMode = "BROWSER_DOM+EXCEPTION",
                        Route = "BROWSER_DOM",
                        Matches = 1,
                        GuardId = guard.GuardId,
                        RetireAtMs = guard.RetireAtMs,
                        Rate = new PickerRateDecision()
                    };
                    Log("FIRESTORE browser confirm uncertain type=" + ex.GetType().Name);
                    continue;
                }

                if (string.Equals(confirmed.Result, "CONFIRMED", StringComparison.Ordinal))
                    _confirmationGuard.MarkLocalConfirmed(guard.GuardId);
                else if (IsSafeBrowserFailure(confirmed))
                    _confirmationGuard.ReleaseSafeFailure(appSession, guard.GuardId);

                outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                {
                    Result = confirmed.Result ?? "CONFIRM_ERROR",
                    CacheMode = "BROWSER_DOM+GUARD+EXACT_ROW",
                    Route = "BROWSER_DOM",
                    Http = 0,
                    OperationMs = Math.Max(0L, search.ElapsedMs) + Math.Max(0L, confirmed.ElapsedMs),
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
            Ui(() => RefreshAgentRequestMetrics());

            AgentDiagnostics.WriteAudit(
                "PDA_CONFIRM_BATCH adapter=BROWSER_DOM jobs=" + works.Count +
                " mutations=" + browserMutationCount +
                " search_click=" + (search.SearchClicked ? "1" : "0") +
                " session_extract=false direct_wms_api=false");

            return outcomes;
        }

        

        private static bool IsSafeBrowserFailure(SupraBrowserConfirmResult result)
        {
            if (result == null) return false;
            if (string.Equals(result.Result, "EXACT_CODE_NOT_RESOLVED", StringComparison.Ordinal) ||
                string.Equals(result.Result, "AMBIGUOUS_PICKLIST", StringComparison.Ordinal))
                return true;

            if (!string.Equals(result.Result, "CONFIRM_REJECTED", StringComparison.Ordinal))
                return false;

            switch (result.Detail ?? "")
            {
                case "ROW_NOT_FOUND":
                case "ROW_AMBIGUOUS":
                case "CHECKBOX_NOT_UNIQUE":
                case "CHECKBOX_DISABLED":
                case "CHECKBOX_VERIFY_FAILED":
                case "CONFIRM_BUTTON_NOT_UNIQUE":
                case "CONFIRM_BUTTON_DISABLED":
                case "PAGE_NOT_READY":
                case "ROW_CHANGED":
                    return true;
                default:
                    return false;
            }
        }

        private bool ProbeSupraBrowserForTakeover()
        {
            try
            {
                RefreshSupraBrowserStatus();
                return HasReadyConfirmBrowser();
            }
            catch (Exception ex)
            {
                Log("SUPRA_BROWSER takeover readiness fail type=" + ex.GetType().Name);
                return false;
            }
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
                    () =>
                    {
                        Interlocked.Increment(ref _localPdaRequests);
                        Ui(() => RefreshAgentRequestMetrics());
                    },
                    () =>
                    {
                        Interlocked.Increment(ref _localAgentResponses);
                        Ui(() => RefreshAgentRequestMetrics());
                    },
                    state => Ui(() => _relay.Text = state),
                    ProcessFirestoreConfirmations,
                    (items, reason) => Ui(() => ApplyEventDrivenPickerPresence(items, reason)),
                    _leaderCoordinator,
                    IsBusinessAllowed,
                    healthy =>
                    {
                        var coordinator = _leaderCoordinator;
                        if (coordinator != null) coordinator.ReportRelayPoll(healthy);
                        var recovered = healthy && !_relayPollHealthyObserved;
                        _relayPollHealthyObserved = healthy;
                        if (coordinator != null && coordinator.IsLeader)
                        {
                            Ui(() =>
                            {
                                _identity.Text =
                                    "Agent: " + Environment.MachineName + " / " + CurrentSessionUser() +
                                    (healthy ? " / ACTIVE" : " / ACTIVE · FIRESTORE OFFLINE");
                                if (recovered) RefreshD119OperationalViews(true);
                            });
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

        private void EnsureFreshToken()
        {
            var s = SnapshotSession();
            if (s.ExpiresUtc > DateTime.UtcNow.AddMinutes(2)) return;
            try
            {
                RefreshDirect();
            }
            catch (Exception ex)
            {
                if (IsDefinitiveAgentAuthFailure(ex))
                    ExpireAgentSession("Phiên Agent đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.");
                throw;
            }
        }

        private static bool IsDefinitiveAgentAuthFailure(Exception ex)
        {
            var relay = ex as RelayHttpException;
            if (relay != null && (relay.StatusCode == 400 || relay.StatusCode == 401 || relay.StatusCode == 403))
            {
                var detail = (relay.Detail ?? "").ToUpperInvariant();
                if (detail.Contains("INVALID_REFRESH_TOKEN") ||
                    detail.Contains("INVALID_GRANT") ||
                    detail.Contains("TOKEN_EXPIRED") ||
                    detail.Contains("USER_DISABLED") ||
                    detail.Contains("INVALID_ID_TOKEN") ||
                    detail.Contains("CREDENTIAL_TOO_OLD"))
                    return true;
            }

            var invalid = ex as InvalidOperationException;
            if (invalid == null) return false;
            var message = (invalid.Message ?? "").ToUpperInvariant();
            return message.Contains("KHÔNG CÒN QUYỀN") ||
                   message.Contains("SAI PROJECT AUDIENCE") ||
                   message.Contains("KHÔNG TRẢ PHIÊN FIREBASE HỢP LỆ");
        }

        private void ExpireAgentSession(string reason)
        {
            if (!HasAgentSession()) return;
            try { StopListening(); } catch { }
            lock (_sessionLock) _session = null;
ClearStoredSession();
            try { if (File.Exists(ExitVerifierFile)) File.Delete(ExitVerifierFile); } catch { }
            Ui(() =>
            {
                _identity.Text = "Agent: cần đăng nhập lại";
                _relay.Text = "Relay: phiên Agent hết hạn";
                _listen.Enabled = false;
                _testOffice.Enabled = false;
                _wmsStatus.Text = "Web Confirm: chờ đăng nhập Agent";
                _supraInfo.Text = "HY1 · Web Confirm tạm dừng đến khi đăng nhập Agent";
                _agentFleetRenderSignature = "";
            });
            SetAgentAuthUi(false);
            SetProbeButtonsEnabled(false);
            AgentDiagnostics.Write("AGENT SESSION expired reason=" + AgentDiagnostics.Sanitize(reason));
        }

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
            if (!IsAgentOperatorRole(role, baseRole) || string.IsNullOrWhiteSpace(appUserId))
                throw new InvalidOperationException("Phiên Agent không còn quyền Quản trị Invent/Quản trị Pick Pack hợp lệ.");

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
                if (_session == null) throw new InvalidOperationException("Chưa đăng nhập Agent.");
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
                if (_session == null) return "chưa đăng nhập";
                var appUser = string.IsNullOrWhiteSpace(_session.AppUserId) ? "user?" : _session.AppUserId;
                return AgentRoleLabel(_session.Role) + " " + appUser + " / device:" + Short(_agentInstanceId);
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
                    // D122: never block on ReadToEnd before the timeout. netsh has been
                    // observed to stall on adapter transitions; wait first, kill if needed,
                    // and only read stdout after the process has definitely exited.
                    if (!process.WaitForExit(2500))
                    {
                        try { process.Kill(); } catch { }
                        return "UNKNOWN";
                    }
                    var text = process.StandardOutput.ReadToEnd();
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
