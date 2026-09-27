using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SupraDashboardProbe
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if ((args ?? new string[0]).Any(a =>
                string.Equals(a, "--self-test", StringComparison.OrdinalIgnoreCase)))
            {
                Environment.ExitCode = SelfTest.Run();
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ProbeForm());
        }
    }

    internal static class SelfTest
    {
        internal static int Run()
        {
            try
            {
                if (ProbeSecurity.SanitizeUrl(
                        "https://auth-supra.winmart.vn/dashboard?code=secret#token") !=
                    "https://auth-supra.winmart.vn/dashboard")
                    return 11;
                if (!ProbeSecurity.IsApprovedTarget(
                        "https://auth-supra.winmart.vn/dashboard"))
                    return 12;
                if (!ProbeSecurity.IsDashboardPage(
                        "https://auth-supra.winmart.vn/dashboard/"))
                    return 13;
                if (!ProbeSecurity.IsApprovedTarget(
                        "https://wms-supra.winmart.vn/sft3/app"))
                    return 14;
                if (ProbeSecurity.IsApprovedTarget(
                        "https://example.invalid/path"))
                    return 15;
                if (ProbeSecurity.IsApprovedTarget(
                        "http://wms-supra.winmart.vn/path"))
                    return 16;
                if (ProbeSecurity.IsApprovedTarget(
                        "https://user:pass@auth-supra.winmart.vn/dashboard"))
                    return 17;
                return 0;
            }
            catch
            {
                return 99;
            }
        }
    }

    internal sealed class RuntimeInfo
    {
        internal string RuntimePath = "";
        internal string Version = "";
        internal string HostBuild = "";
    }

    internal static class ProbeRuntime
    {
        internal static readonly string BrowserRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SUPRA Inventory", "ConfirmBrowser");

        internal static readonly string OwnedRoot =
            Path.Combine(BrowserRoot, "OwnedWebView2");

        internal static readonly string ProbeProfile =
            Path.Combine(BrowserRoot, "dashboard-probe-v2-profile");

        internal static RuntimeInfo Locate()
        {
            var active = Path.Combine(OwnedRoot, "active.txt");
            if (!File.Exists(active))
                throw new InvalidOperationException(
                    "Agent WebView2 Fixed chưa được cài.");

            var folder = File.ReadAllText(active).Trim();
            if (!Regex.IsMatch(folder, "^[0-9A-Za-z._-]{1,96}$"))
                throw new InvalidOperationException(
                    "Marker runtime không hợp lệ.");

            var bundle = Path.Combine(OwnedRoot, folder);
            var runtime = Path.Combine(bundle, "runtime");
            if (!File.Exists(Path.Combine(runtime, "msedgewebview2.exe")))
                throw new InvalidOperationException(
                    "Thiếu Agent WebView2 Fixed Runtime.");

            var buildFile = Path.Combine(bundle, "host-build.txt");
            var versionMatch = Regex.Match(
                folder,
                @"^wv2-(?<version>[0-9]+(?:\.[0-9]+){3})-");

            return new RuntimeInfo
            {
                RuntimePath = runtime,
                Version = versionMatch.Success
                    ? versionMatch.Groups["version"].Value
                    : "unknown",
                HostBuild = File.Exists(buildFile)
                    ? File.ReadAllText(buildFile).Trim()
                    : "unknown"
            };
        }
    }

    internal static class ProbeSecurity
    {
        internal static string SanitizeUrl(string raw)
        {
            Uri uri;
            if (!Uri.TryCreate(raw ?? "", UriKind.Absolute, out uri))
                return "invalid";
            if (!string.Equals(
                    uri.Scheme,
                    "https",
                    StringComparison.OrdinalIgnoreCase))
                return uri.Scheme + "://invalid";

            return uri.Scheme + "://" + uri.Host + uri.AbsolutePath;
        }

        internal static bool IsDashboardPage(string raw)
        {
            Uri uri;
            if (!Uri.TryCreate(raw ?? "", UriKind.Absolute, out uri))
                return false;
            if (!string.Equals(
                    uri.Scheme,
                    "https",
                    StringComparison.OrdinalIgnoreCase))
                return false;
            return string.Equals(
                       uri.Host,
                       "auth-supra.winmart.vn",
                       StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(
                       uri.AbsolutePath.TrimEnd('/'),
                       "/dashboard",
                       StringComparison.OrdinalIgnoreCase);
        }

        internal static bool IsApprovedTarget(string raw)
        {
            Uri uri;
            if (!Uri.TryCreate(raw ?? "", UriKind.Absolute, out uri))
                return false;
            if (!string.Equals(
                    uri.Scheme,
                    "https",
                    StringComparison.OrdinalIgnoreCase))
                return false;

            if (!string.IsNullOrEmpty(uri.UserInfo))
                return false;

            return string.Equals(
                       uri.Host,
                       "auth-supra.winmart.vn",
                       StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(
                       uri.Host,
                       "wms-supra.winmart.vn",
                       StringComparison.OrdinalIgnoreCase);
        }
    }

    internal sealed class TargetInfo
    {
        internal bool Unique;
        internal int Docs;
        internal int Arrows;
        internal int Targets;
        internal double X;
        internal double Y;
        internal string Reason = "PARSE_FAIL";

        internal string LogSummary
        {
            get
            {
                return "unique=" + Unique.ToString().ToLowerInvariant() +
                       " docs=" + Docs +
                       " arrows=" + Arrows +
                       " targets=" + Targets +
                       " reason=" + Reason;
            }
        }

        internal static TargetInfo Parse(string value)
        {
            var result = new TargetInfo();
            try
            {
                var parts = (value ?? "").Split('|');
                if (parts.Length < 7)
                    return result;

                result.Unique =
                    string.Equals(
                        parts[0],
                        "READY",
                        StringComparison.Ordinal);
                int.TryParse(parts[1], out result.Docs);
                int.TryParse(parts[2], out result.Arrows);
                int.TryParse(parts[3], out result.Targets);
                double.TryParse(
                    parts[4],
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out result.X);
                double.TryParse(
                    parts[5],
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out result.Y);
                result.Reason = Regex.IsMatch(
                    parts[6],
                    "^[A-Z0-9_]{1,40}$")
                    ? parts[6]
                    : "INVALID";
            }
            catch
            {
            }

            return result;
        }
    }

    internal sealed class ProbeForm : Form
    {
        private const string DashboardUrl =
            "https://auth-supra.winmart.vn/dashboard";

        private const string ArrowPath =
            "m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z";

        private readonly WebView2 _web =
            new WebView2 { Dock = DockStyle.Fill };

        private readonly TextBox _urlInput =
            new TextBox
            {
                Width = 470,
                Text = DashboardUrl
            };

        private readonly Button _go =
            new Button
            {
                Text = "Đi tới",
                Width = 72,
                Height = 28
            };

        private readonly Button _auto =
            new Button
            {
                Text = "Tự động kiểm tra",
                Width = 125,
                Height = 28
            };

        private readonly Button _monitor =
            new Button
            {
                Text = "Theo dõi thao tác người dùng",
                Width = 190,
                Height = 28
            };

        private readonly Button _openLog =
            new Button
            {
                Text = "Mở thư mục log",
                Width = 125,
                Height = 28
            };

        private readonly Label _status =
            new Label
            {
                Dock = DockStyle.Fill,
                AutoEllipsis = true,
                TextAlign = System.Drawing.ContentAlignment.MiddleLeft
            };

        private readonly JavaScriptSerializer _json =
            new JavaScriptSerializer();

        private readonly string _logDir;
        private readonly string _logFile;
        private readonly object _logGate = new object();

        private CoreWebView2Environment _environment;
        private bool _probeRunning;
        private bool _probeCompleted;
        private bool _monitoring;
        private int _transitionGeneration;
        private TaskCompletionSource<bool> _transitionSignal =
            new TaskCompletionSource<bool>();

        internal ProbeForm()
        {
            Text = "SUPRA Dashboard Probe v2 · D127";
            Width = 1360;
            Height = 900;
            StartPosition = FormStartPosition.CenterScreen;

            _logDir = Path.Combine(
                Environment.GetFolderPath(
                    Environment.SpecialFolder.LocalApplicationData),
                "SUPRA Inventory",
                "DashboardProbeV2",
                "Logs");
            Directory.CreateDirectory(_logDir);

            _logFile = Path.Combine(
                _logDir,
                "dashboard-probe-v2-" +
                DateTime.Now.ToString("yyyyMMdd-HHmmss") +
                ".log");

            var actions = new FlowLayoutPanel
            {
                Dock = DockStyle.Top,
                Height = 38,
                WrapContents = false,
                AutoScroll = true,
                Padding = new Padding(8, 5, 8, 3)
            };
            actions.Controls.Add(new Label
            {
                Text = "URL",
                AutoSize = true,
                Padding = new Padding(0, 6, 2, 0)
            });
            actions.Controls.Add(_urlInput);
            actions.Controls.Add(_go);
            actions.Controls.Add(_auto);
            actions.Controls.Add(_monitor);
            actions.Controls.Add(_openLog);

            var top = new Panel
            {
                Dock = DockStyle.Top,
                Height = 72,
                Padding = new Padding(8, 0, 8, 4)
            };
            top.Controls.Add(_status);
            top.Controls.Add(actions);

            Controls.Add(_web);
            Controls.Add(top);

            _openLog.Click += delegate { OpenLogFolder(); };
            _go.Click += async delegate { await NavigateFromInputAsync(); };
            _auto.Click += async delegate { await StartAutoProbeAsync(); };
            _monitor.Click += async delegate { await ToggleMonitoringAsync(); };
            _urlInput.KeyDown += async delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode != Keys.Enter) return;
                e.SuppressKeyPress = true;
                await NavigateFromInputAsync();
            };
            Shown += async delegate { await InitializeSafeAsync(); };
        }

        private async Task InitializeSafeAsync()
        {
            try
            {
                if (!Environment.Is64BitProcess)
                    throw new BadImageFormatException(
                        "Probe phải chạy x64.");

                var info = ProbeRuntime.Locate();

                var loaderFolder = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "loader",
                    "x64");
                var loader = Path.Combine(
                    loaderFolder,
                    "WebView2Loader.dll");

                if (!File.Exists(loader))
                    throw new FileNotFoundException(
                        "Thiếu WebView2Loader.dll x64.");

                CoreWebView2Environment.SetLoaderDllFolderPath(
                    loaderFolder);

                Directory.CreateDirectory(
                    ProbeRuntime.ProbeProfile);

                _environment = await CoreWebView2Environment.CreateAsync(
                    info.RuntimePath,
                    ProbeRuntime.ProbeProfile,
                    new CoreWebView2EnvironmentOptions());

                await _web.EnsureCoreWebView2Async(_environment);

                _web.CoreWebView2.Settings.IsPasswordAutosaveEnabled = true;
                _web.CoreWebView2.Settings.IsGeneralAutofillEnabled = true;

                HookEvents();

                Log(
                    "START",
                    "runtime_version=" + info.Version +
                    " host_build=" + info.HostBuild +
                    " profile=probe_v2_dedicated" +
                    " network_domain=false" +
                    " session_extract=false" +
                    " log_transport=local_only");

                SetStatus(
                    "Nhập URL, đăng nhập thủ công nếu cần, sau đó bấm Tự động kiểm tra.");

                _web.CoreWebView2.Navigate(DashboardUrl);
            }
            catch (Exception ex)
            {
                LogException("INIT_FAIL", ex);
                SetStatus(
                    "Probe không khởi động được. Mở thư mục log và gửi file log.");
            }
        }

        private void HookEvents()
        {
            _web.CoreWebView2.NavigationStarting +=
                delegate(object sender, CoreWebView2NavigationStartingEventArgs e)
                {
                    Log(
                        "NAV_START",
                        "url=" +
                        ProbeSecurity.SanitizeUrl(e.Uri));
                    SignalTransition();
                };

            _web.CoreWebView2.SourceChanged +=
                delegate
                {
                    Log(
                        "SOURCE_CHANGED",
                        "url=" + CurrentSafeUrl());
                    SignalTransition();
                };

            _web.CoreWebView2.NavigationCompleted +=
                async delegate(
                    object sender,
                    CoreWebView2NavigationCompletedEventArgs e)
                {
                    Log(
                        "NAV_DONE",
                        "success=" +
                        e.IsSuccess.ToString().ToLowerInvariant() +
                        " web_error=" + e.WebErrorStatus +
                        " url=" + CurrentSafeUrl());

                    if (_monitoring)
                    {
                        try
                        {
                            await InstallInstrumentationAsync();
                        }
                        catch (Exception ex)
                        {
                            LogException(
                                "INSTRUMENT_FAIL",
                                ex);
                        }
                    }
                };

            _web.CoreWebView2.NewWindowRequested +=
                delegate(
                    object sender,
                    CoreWebView2NewWindowRequestedEventArgs e)
                {
                    var safe =
                        ProbeSecurity.SanitizeUrl(e.Uri);
                    var approved =
                        ProbeSecurity.IsApprovedTarget(e.Uri);

                    Log(
                        "NEW_WINDOW",
                        "target=" + safe +
                        " approved=" +
                        approved
                            .ToString()
                            .ToLowerInvariant() +
                        " popup_mode=webview2_default");

                    SignalTransition();

                    if (!approved)
                    {
                        e.Handled = true;
                        Log(
                            "NEW_WINDOW_BLOCKED",
                            "target=" + safe +
                            " fail_closed=true");
                    }
                };

            _web.CoreWebView2.WebMessageReceived +=
                delegate(
                    object sender,
                    CoreWebView2WebMessageReceivedEventArgs e)
                {
                    try
                    {
                        var message =
                            e.TryGetWebMessageAsString();

                        if (!string.IsNullOrWhiteSpace(message) &&
                            message.StartsWith(
                                "D127|",
                                StringComparison.Ordinal))
                        {
                            var payload =
                                message.Substring(5);

                            if (Regex.IsMatch(
                                    payload,
                                    "^[A-Za-z0-9_ =.-]{1,220}$"))
                                Log(
                                    "DOM_EVENT",
                                    payload);
                            else
                                Log(
                                    "DOM_EVENT",
                                    "payload=redacted");
                        }
                    }
                    catch (Exception ex)
                    {
                        LogException(
                            "WEB_MESSAGE_FAIL",
                            ex);
                    }
                };

            _web.CoreWebView2.ProcessFailed +=
                delegate(
                    object sender,
                    CoreWebView2ProcessFailedEventArgs e)
                {
                    Log(
                        "PROCESS_FAILED",
                        "kind=" + e.ProcessFailedKind);
                };
        }

        private async Task NavigateFromInputAsync()
        {
            if (_web.CoreWebView2 == null)
                return;

            var raw = (_urlInput.Text ?? "").Trim();
            if (!ProbeSecurity.IsApprovedTarget(raw))
            {
                SetStatus(
                    "Chỉ chấp nhận HTTPS trên auth-supra.winmart.vn hoặc wms-supra.winmart.vn; URL không được chứa user/password.");
                Log(
                    "USER_NAV_REJECTED",
                    "url=" + ProbeSecurity.SanitizeUrl(raw));
                return;
            }

            _probeRunning = false;
            _probeCompleted = false;
            ResetTransitionSignal();

            Log(
                "USER_NAV",
                "url=" + ProbeSecurity.SanitizeUrl(raw));

            SetStatus(
                "Đang mở URL. Nếu cần, đăng nhập trực tiếp trên trang.");
            _web.CoreWebView2.Navigate(raw);
            await Task.CompletedTask;
        }

        private async Task StartAutoProbeAsync()
        {
            if (_probeRunning || _web.CoreWebView2 == null)
                return;

            _probeCompleted = false;
            _auto.Enabled = false;

            try
            {
                await TryStartProbeAsync();
            }
            finally
            {
                _auto.Enabled = true;
            }
        }

        private async Task ToggleMonitoringAsync()
        {
            if (_web.CoreWebView2 == null)
                return;

            _monitoring = !_monitoring;

            if (_monitoring)
            {
                await InstallInstrumentationAsync();
                _monitor.Text = "Dừng theo dõi";
                Log(
                    "MONITOR",
                    "state=started clickable_only=true input_fields=false local_log_only=true");
                SetStatus(
                    "Đang theo dõi phần tử click được. Hãy tự bấm đúng nút Truy cập một lần.");
            }
            else
            {
                await DisableInstrumentationAsync();
                _monitor.Text = "Theo dõi thao tác người dùng";
                Log(
                    "MONITOR",
                    "state=stopped");
                SetStatus(
                    "Đã dừng theo dõi. Có thể mở thư mục log và gửi file mới nhất.");
            }
        }

        private async Task DisableInstrumentationAsync()
        {
            if (_web.CoreWebView2 == null)
                return;

            try
            {
                await _web.CoreWebView2.ExecuteScriptAsync(
                    "(() => {" +
                    "const docs=[];" +
                    "const walk=d=>{" +
                    "if(!d||docs.includes(d))return;" +
                    "docs.push(d);" +
                    "for(const f of d.querySelectorAll('iframe,frame')){" +
                    "try{if(f.contentDocument)walk(f.contentDocument);}catch(e){}" +
                    "}" +
                    "};" +
                    "walk(document);" +
                    "for(const d of docs)d.__d127ProbeV2Enabled=false;" +
                    "return 'DISABLED_'+docs.length;" +
                    "})()");
            }
            catch (Exception ex)
            {
                LogException(
                    "INSTRUMENT_DISABLE_FAIL",
                    ex);
            }
        }

        private async Task InstallInstrumentationAsync()
        {
            var result = await ExecuteStringAsync(
                BuildInstrumentationExpression());

            Log(
                "INSTRUMENT",
                "result=" + SafeToken(result));
        }

        private async Task TryStartProbeAsync()
        {
            if (_probeRunning ||
                _probeCompleted ||
                _web.CoreWebView2 == null)
                return;

            _probeRunning = true;

            try
            {
                await Task.Delay(300);
                await InstallInstrumentationAsync();

                var inspect =
                    await InspectTargetAsync();

                Log(
                    "TARGET_SCAN",
                    inspect.LogSummary);

                if (!inspect.Unique)
                {
                    _probeCompleted = true;
                    SetStatus(
                        "Không xác định duy nhất nút Truy cập. Bấm Theo dõi thao tác người dùng rồi tự bấm đúng nút một lần.");
                    Log(
                        "AUTO_STOP",
                        "reason=target_not_unique");
                    return;
                }

                SetStatus(
                    "Đã xác định target. Đang thử các cơ chế thao tác trình duyệt...");

                Log(
                    "PROBE_BEGIN",
                    "methods=js_click,synthetic_pointer,cdp_user_gesture,cdp_mouse,cdp_keyboard_enter,cdp_keyboard_space");

                if (await TryJsClickAsync())
                    return;
                if (await TrySyntheticPointerAsync())
                    return;
                if (await TryCdpUserGestureAsync())
                    return;
                if (await TryCdpMouseAsync())
                    return;
                if (await TryCdpKeyboardAsync())
                    return;
                if (await TryCdpSpaceAsync())
                    return;

                _probeCompleted = true;

                Log(
                    "PROBE_END",
                    "transition=false manual_click_capture=true");

                SetStatus(
                    "Tự động chưa kích hoạt được. Bấm Theo dõi thao tác người dùng rồi tự bấm đúng nút Truy cập một lần.");
            }
            catch (Exception ex)
            {
                _probeCompleted = true;
                LogException(
                    "PROBE_FAIL",
                    ex);

                SetStatus(
                    "Probe gặp lỗi. Bấm Theo dõi thao tác người dùng rồi thao tác thật một lần.");
            }
            finally
            {
                _probeRunning = false;
                if (!_monitoring)
                    await DisableInstrumentationAsync();
            }
        }

        private async Task<bool> TryJsClickAsync()
        {
            ResetTransitionSignal();

            var result =
                await ExecuteStringAsync(
                    BuildTargetActionExpression(
                        "native_click"));

            Log(
                "METHOD",
                "name=js_click result=" +
                SafeToken(result));

            return await ObserveTransitionAsync(
                "js_click");
        }

        private async Task<bool> TrySyntheticPointerAsync()
        {
            ResetTransitionSignal();

            var result =
                await ExecuteStringAsync(
                    BuildTargetActionExpression(
                        "synthetic_pointer"));

            Log(
                "METHOD",
                "name=synthetic_pointer result=" +
                SafeToken(result));

            return await ObserveTransitionAsync(
                "synthetic_pointer");
        }

        private async Task<bool> TryCdpUserGestureAsync()
        {
            ResetTransitionSignal();

            var expression =
                BuildTargetActionExpression(
                    "native_click");

            var parameters =
                "{\"expression\":" +
                _json.Serialize(expression) +
                ",\"userGesture\":true" +
                ",\"awaitPromise\":true" +
                ",\"returnByValue\":true}";

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Runtime.evaluate",
                    parameters);

            Log(
                "METHOD",
                "name=cdp_user_gesture result=issued");

            return await ObserveTransitionAsync(
                "cdp_user_gesture");
        }

        private async Task<bool> TryCdpMouseAsync()
        {
            var inspect =
                await InspectTargetAsync();

            if (!inspect.Unique)
            {
                Log(
                    "METHOD",
                    "name=cdp_mouse result=target_lost");
                return false;
            }

            ResetTransitionSignal();

            var x =
                inspect.X.ToString(
                    CultureInfo.InvariantCulture);
            var y =
                inspect.Y.ToString(
                    CultureInfo.InvariantCulture);

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Input.dispatchMouseEvent",
                    "{\"type\":\"mouseMoved\"" +
                    ",\"x\":" + x +
                    ",\"y\":" + y + "}");

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Input.dispatchMouseEvent",
                    "{\"type\":\"mousePressed\"" +
                    ",\"x\":" + x +
                    ",\"y\":" + y +
                    ",\"button\":\"left\"" +
                    ",\"buttons\":1" +
                    ",\"clickCount\":1}");

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Input.dispatchMouseEvent",
                    "{\"type\":\"mouseReleased\"" +
                    ",\"x\":" + x +
                    ",\"y\":" + y +
                    ",\"button\":\"left\"" +
                    ",\"buttons\":0" +
                    ",\"clickCount\":1}");

            Log(
                "METHOD",
                "name=cdp_mouse result=issued");

            return await ObserveTransitionAsync(
                "cdp_mouse");
        }

        private async Task<bool> TryCdpKeyboardAsync()
        {
            ResetTransitionSignal();

            var result =
                await ExecuteStringAsync(
                    BuildTargetActionExpression(
                        "focus_only"));

            Log(
                "METHOD",
                "name=cdp_keyboard_enter focus=" +
                SafeToken(result));

            if (!string.Equals(
                    result,
                    "FOCUSED",
                    StringComparison.Ordinal))
                return false;

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Input.dispatchKeyEvent",
                    "{\"type\":\"keyDown\"" +
                    ",\"key\":\"Enter\"" +
                    ",\"code\":\"Enter\"" +
                    ",\"windowsVirtualKeyCode\":13" +
                    ",\"nativeVirtualKeyCode\":13}");

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Input.dispatchKeyEvent",
                    "{\"type\":\"keyUp\"" +
                    ",\"key\":\"Enter\"" +
                    ",\"code\":\"Enter\"" +
                    ",\"windowsVirtualKeyCode\":13" +
                    ",\"nativeVirtualKeyCode\":13}");

            Log(
                "METHOD",
                "name=cdp_keyboard_enter result=issued");

            return await ObserveTransitionAsync(
                "cdp_keyboard_enter");
        }

        private async Task<bool> TryCdpSpaceAsync()
        {
            ResetTransitionSignal();

            var result =
                await ExecuteStringAsync(
                    BuildTargetActionExpression(
                        "focus_only"));

            Log(
                "METHOD",
                "name=cdp_keyboard_space focus=" +
                SafeToken(result));

            if (!string.Equals(
                    result,
                    "FOCUSED",
                    StringComparison.Ordinal))
                return false;

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Input.dispatchKeyEvent",
                    "{\"type\":\"keyDown\"" +
                    ",\"key\":\" \"" +
                    ",\"code\":\"Space\"" +
                    ",\"windowsVirtualKeyCode\":32" +
                    ",\"nativeVirtualKeyCode\":32}");

            await _web.CoreWebView2
                .CallDevToolsProtocolMethodAsync(
                    "Input.dispatchKeyEvent",
                    "{\"type\":\"keyUp\"" +
                    ",\"key\":\" \"" +
                    ",\"code\":\"Space\"" +
                    ",\"windowsVirtualKeyCode\":32" +
                    ",\"nativeVirtualKeyCode\":32}");

            Log(
                "METHOD",
                "name=cdp_keyboard_space result=issued");

            return await ObserveTransitionAsync(
                "cdp_keyboard_space");
        }

        private async Task<bool> ObserveTransitionAsync(
            string method)
        {
            var generation =
                _transitionGeneration;

            var signal =
                _transitionSignal.Task;

            var completed =
                await Task.WhenAny(
                    signal,
                    Task.Delay(1900));

            var transitioned =
                completed == signal &&
                signal.Status ==
                    TaskStatus.RanToCompletion &&
                signal.Result;

            Log(
                "METHOD_OBSERVE",
                "name=" + method +
                " transitioned=" +
                transitioned
                    .ToString()
                    .ToLowerInvariant() +
                " url=" + CurrentSafeUrl());

            if (transitioned ||
                generation !=
                    _transitionGeneration)
            {
                _probeCompleted = true;

                SetStatus(
                    "Đã ghi nhận chuyển trang/new-window. Giữ cửa sổ mở và gửi file log mới nhất.");

                return true;
            }

            await Task.Delay(250);
            return false;
        }

        private void SignalTransition()
        {
            _transitionGeneration++;

            try
            {
                _transitionSignal.TrySetResult(true);
            }
            catch
            {
            }
        }

        private void ResetTransitionSignal()
        {
            _transitionSignal =
                new TaskCompletionSource<bool>();
        }

        private async Task<TargetInfo>
            InspectTargetAsync()
        {
            var value =
                await ExecuteStringAsync(
                    BuildInspectExpression());

            return TargetInfo.Parse(value);
        }

        private async Task<string>
            ExecuteStringAsync(
                string expression)
        {
            var raw =
                await _web.CoreWebView2
                    .ExecuteScriptAsync(expression);

            try
            {
                return _json
                    .Deserialize<string>(raw) ?? "";
            }
            catch
            {
                return "";
            }
        }

        private string BuildInspectExpression()
        {
            return
                "(() => {" +
                BuildTargetLocatorJs() +
                "const r=locate();" +
                "if(!r.unique)" +
                "return 'SCAN|'+r.docs+'|'+r.arrows+'|'+r.targets+'|0|0|'+r.reason;" +
                "return 'READY|'+r.docs+'|'+r.arrows+'|'+r.targets+'|'+r.x+'|'+r.y+'|'+r.reason;" +
                "})()";
        }

        private string BuildTargetActionExpression(
            string action)
        {
            var actionJs = "";

            if (action == "native_click")
            {
                actionJs =
                    "r.button.focus({preventScroll:true});" +
                    "r.button.click();" +
                    "return 'CLICKED';";
            }
            else if (
                action ==
                "synthetic_pointer")
            {
                actionJs =
                    "const b=r.button;" +
                    "const q={bubbles:true,cancelable:true,view:window,button:0,buttons:1};" +
                    "try{" +
                    "b.dispatchEvent(new PointerEvent('pointerdown',Object.assign({pointerId:1,pointerType:'mouse',isPrimary:true},q)));" +
                    "}catch(e){}" +
                    "b.dispatchEvent(new MouseEvent('mousedown',q));" +
                    "b.dispatchEvent(new MouseEvent('mouseup',Object.assign({},q,{buttons:0})));" +
                    "b.dispatchEvent(new MouseEvent('click',Object.assign({},q,{buttons:0})));" +
                    "return 'DISPATCHED';";
            }
            else
            {
                actionJs =
                    "r.button.focus({preventScroll:true});" +
                    "return 'FOCUSED';";
            }

            return
                "(() => {" +
                BuildTargetLocatorJs() +
                "const r=locate();" +
                "if(!r.unique)" +
                "return 'TARGET_'+r.reason;" +
                actionJs +
                "})()";
        }

        private string BuildTargetLocatorJs()
        {
            var arrow =
                _json.Serialize(ArrowPath);

            return
                "const arrowPath=" + arrow + ";" +
                "const norm=v=>String(v||'')" +
                ".normalize('NFC')" +
                ".replace(/[\\u200B-\\u200D\\uFEFF]/g,' ')" +
                ".replace(/\\s+/g,' ')" +
                ".trim().toLowerCase();" +
                "const vis=e=>!!e&&!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);" +
                "const docs=[];" +
                "const walk=(d,ox,oy)=>{" +
                "if(!d||docs.some(x=>x.doc===d))return;" +
                "docs.push({doc:d,ox:ox,oy:oy});" +
                "for(const f of d.querySelectorAll('iframe,frame')){" +
                "try{" +
                "if(!f.contentDocument)continue;" +
                "const r=f.getBoundingClientRect();" +
                "walk(f.contentDocument,ox+r.left,oy+r.top);" +
                "}catch(e){}" +
                "}" +
                "};" +
                "const locate=()=>{" +
                "walk(document,0,0);" +
                "const candidates=[];" +
                "let arrows=0;" +
                "for(const item of docs){" +
                "const d=item.doc;" +
                "for(const p of d.querySelectorAll('path')){" +
                "if(p.getAttribute('d')!==arrowPath)continue;" +
                "const svg=p.closest('svg');" +
                "if(!svg||!vis(svg))continue;" +
                "arrows++;" +
                "const b=p.closest('button,[role=button],a');" +
                "if(!b||!vis(b)||b.disabled||b.getAttribute('aria-disabled')==='true')continue;" +
                "const br=b.getBoundingClientRect();" +
                "let best=null;" +
                "let node=b;" +
                "for(let depth=0;node&&depth<10;depth++,node=node.parentElement){" +
                "if(!vis(node))continue;" +
                "const t=norm(node.innerText||node.textContent);" +
                "if(!t.includes('sft3'))continue;" +
                "if(!(t.includes('kho hưng yên 1')||t.includes('hy1')))continue;" +
                "const rr=node.getBoundingClientRect();" +
                "const area=Math.max(1,rr.width*rr.height);" +
                "if(!best||area<best.area)best={area:area,depth:depth};" +
                "}" +
                "candidates.push({" +
                "button:b," +
                "x:item.ox+br.left+br.width/2," +
                "y:item.oy+br.top+br.height/2," +
                "area:best?best.area:Number.MAX_VALUE," +
                "matched:!!best" +
                "});" +
                "}" +
                "}" +
                "const matched=candidates.filter(x=>x.matched);" +
                "let selected=[];" +
                "let reason='NOT_FOUND';" +
                "if(matched.length===1){selected=matched;reason='HY1_SFT3_UNIQUE';}" +
                "else if(matched.length>1){" +
                "const min=Math.min(...matched.map(x=>x.area));" +
                "const smallest=matched.filter(x=>x.area<=min*1.05);" +
                "if(smallest.length===1){selected=smallest;reason='HY1_SFT3_SMALLEST_CARD';}" +
                "else reason='HY1_SFT3_AMBIGUOUS';" +
                "}" +
                "else if(candidates.length===1){selected=candidates;reason='UNIQUE_ARROW_FALLBACK';}" +
                "else if(candidates.length>1){reason='ARROW_AMBIGUOUS';}" +
                "const chosen=selected.length===1?selected[0]:null;" +
                "return {" +
                "unique:!!chosen," +
                "button:chosen?chosen.button:null," +
                "x:chosen?chosen.x:0," +
                "y:chosen?chosen.y:0," +
                "docs:docs.length," +
                "arrows:arrows," +
                "targets:matched.length," +
                "reason:reason" +
                "};" +
                "};";
        }

        private string BuildInstrumentationExpression()
        {
            var arrow =
                _json.Serialize(ArrowPath);

            return
                "(() => {" +
                "const arrowPath=" + arrow + ";" +
                "const norm=v=>String(v||'')" +
                ".normalize('NFC')" +
                ".replace(/[\\u200B-\\u200D\\uFEFF]/g,' ')" +
                ".replace(/\\s+/g,' ')" +
                ".trim().toLowerCase();" +
                "const post=m=>{" +
                "try{chrome.webview.postMessage('D127|'+m);}catch(e){}" +
                "};" +
                "const docs=[];" +
                "const walk=d=>{" +
                "if(!d||docs.includes(d))return;" +
                "docs.push(d);" +
                "for(const f of d.querySelectorAll('iframe,frame')){" +
                "try{if(f.contentDocument)walk(f.contentDocument);}catch(e){}" +
                "}" +
                "};" +
                "walk(document);" +
                "let installed=0;" +
                "for(const d of docs){" +
                "if(d.__d127ProbeV2Installed){" +
                "d.__d127ProbeV2Enabled=true;" +
                "continue;" +
                "}" +
                "d.__d127ProbeV2Installed=true;" +
                "d.__d127ProbeV2Enabled=true;" +
                "const resolve=e=>{" +
                "if(!e||!e.closest)return null;" +
                "const b=e.closest('button,[role=button],a');" +
                "if(!b)return null;" +
                "const all=[...d.querySelectorAll('path')]" +
                ".filter(p=>p.getAttribute('d')===arrowPath)" +
                ".map(p=>p.closest('button,[role=button],a'))" +
                ".filter(Boolean);" +
                "if(!all.includes(b))return null;" +
                "let sft3=false;" +
                "let hy1=false;" +
                "let node=b;" +
                "for(let depth=0;node&&depth<10;depth++,node=node.parentElement){" +
                "const t=norm(node.innerText||node.textContent);" +
                "if(t.includes('sft3'))sft3=true;" +
                "if(t.includes('kho hưng yên 1')||t.includes('hy1'))hy1=true;" +
                "}" +
                "return {button:b,index:all.indexOf(b)+1,total:all.length,sft3:sft3,hy1:hy1};" +
                "};" +
                "for(const n of ['pointerdown','pointerup','mousedown','mouseup','click']){" +
                "d.addEventListener(n,e=>{" +
                "if(!d.__d127ProbeV2Enabled)return;" +
                "const r=resolve(e.target);" +
                "if(!r)return;" +
                "const b=r.button.getBoundingClientRect();" +
                "post(" +
                "'event='+n+" +
                "' trusted='+e.isTrusted+" +
                "' default_prevented='+e.defaultPrevented+" +
                "' arrow_index='+r.index+" +
                "' arrow_total='+r.total+" +
                "' semantic_sft3='+r.sft3+" +
                "' semantic_hy1='+r.hy1+" +
                "' x='+Math.round(b.left)+" +
                "' y='+Math.round(b.top)+" +
                "' w='+Math.round(b.width)+" +
                "' h='+Math.round(b.height));" +
                "},true);" +
                "}" +
                "d.addEventListener('keydown',e=>{" +
                "if(!d.__d127ProbeV2Enabled)return;" +
                "const r=resolve(e.target);" +
                "if(!r)return;" +
                "const keyClass=e.key==='Enter'?'enter':(e.key===' '?'space':'other');" +
                "if(keyClass==='other')return;" +
                "post(" +
                "'event=keydown_on_target trusted='+e.isTrusted+" +
                "' default_prevented='+e.defaultPrevented+" +
                "' key_class='+keyClass+" +
                "' arrow_index='+r.index+" +
                "' arrow_total='+r.total+" +
                "' semantic_sft3='+r.sft3+" +
                "' semantic_hy1='+r.hy1);" +
                "},true);" +
                "installed++;" +
                "}" +
                "window.addEventListener('beforeunload',()=>post('event=beforeunload'),true);" +
                "document.addEventListener('visibilitychange',()=>post('event=visibilitychange'),true);" +
                "return 'INSTALLED_'+installed;" +
                "})()";
        }

        private string CurrentSafeUrl()
        {
            try
            {
                return ProbeSecurity.SanitizeUrl(
                    _web.Source != null
                        ? _web.Source.AbsoluteUri
                        : "");
            }
            catch
            {
                return "unknown";
            }
        }

        private void SetStatus(string text)
        {
            if (InvokeRequired)
            {
                BeginInvoke(
                    new Action<string>(SetStatus),
                    text);
                return;
            }

            _status.Text = text ?? "";
        }

        private void Log(
            string kind,
            string detail)
        {
            var line =
                DateTime.UtcNow.ToString("o") +
                " " +
                kind +
                " " +
                (detail ?? "");

            lock (_logGate)
            {
                File.AppendAllText(
                    _logFile,
                    line + Environment.NewLine,
                    new UTF8Encoding(false));
            }
        }

        private void LogException(
            string kind,
            Exception ex)
        {
            Log(
                kind,
                "type=" +
                (ex == null
                    ? "unknown"
                    : ex.GetType().Name) +
                " hresult=" +
                (ex == null
                    ? "0"
                    : ex.HResult.ToString()));
        }

        private static string SafeToken(
            string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return "empty";

            return Regex.IsMatch(
                value,
                "^[A-Z0-9_]{1,64}$")
                ? value
                : "redacted";
        }

        private void OpenLogFolder()
        {
            try
            {
                Process.Start(
                    new ProcessStartInfo
                    {
                        FileName = "explorer.exe",
                        Arguments =
                            "\"" +
                            _logDir.Replace("\"", "") +
                            "\"",
                        UseShellExecute = true
                    });
            }
            catch
            {
            }
        }
    }
}
