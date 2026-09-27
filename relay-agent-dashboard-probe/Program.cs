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

                    if (!_probeCompleted)
                        await TryStartProbeAsync();
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
                        " approved_same_tab=" +
                        approved
                            .ToString()
                            .ToLowerInvariant());

                    SignalTransition();

                    e.Handled = true;

                    if (approved)
                    {
                        _web.CoreWebView2.Navigate(e.Uri);
                        Log(
                            "NEW_WINDOW_INTERCEPT",
                            "mode=same_tab target=" + safe);
                    }
                    else
                    {
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

        private async Task RerunAsync()
        {
            if (_web.CoreWebView2 == null)
                return;

            _probeRunning = false;
            _probeCompleted = false;
            ResetTransitionSignal();

            Log("RERUN", "requested=true");
            SetStatus(
                "Đang tải lại Supra Dashboard để chạy probe.");

            _web.CoreWebView2.Navigate(DashboardUrl);
            await Task.CompletedTask;
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

            await Task.Delay(1000);

            var safeUrl = CurrentSafeUrl();

            if (!ProbeSecurity.IsDashboardPage(safeUrl))
            {
                if (safeUrl.IndexOf(
                        "auth-supra.winmart.vn",
                        StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    SetStatus(
                        "Đang chờ Dashboard. Nếu đang ở màn hình đăng nhập, hãy đăng nhập bình thường.");
                }
                return;
            }

            var inspect =
                await InspectTargetAsync();

            Log(
                "TARGET_SCAN",
                inspect.LogSummary);

            if (!inspect.Unique)
            {
                _probeCompleted = true;
                SetStatus(
                    "Không xác định duy nhất nút đích. Hãy bấm đúng mũi tên bằng tay 1 lần; Probe vẫn ghi log.");
                return;
            }

            _probeRunning = true;

            SetStatus(
                "Đã thấy đúng nút Dashboard. Đang thử các cơ chế kích hoạt...");

            Log(
                "PROBE_BEGIN",
                "methods=js_click,synthetic_pointer,cdp_user_gesture,cdp_mouse,cdp_keyboard_enter");

            try
            {
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

                _probeCompleted = true;

                Log(
                    "PROBE_END",
                    "transition=false manual_click_capture=true");

                SetStatus(
                    "Tự động chưa kích hoạt được. Anh bấm đúng mũi tên bằng tay 1 lần; Probe đang ghi log.");
            }
            catch (Exception ex)
            {
                _probeCompleted = true;
                LogException("PROBE_FAIL", ex);

                SetStatus(
                    "Probe gặp lỗi. Có thể bấm mũi tên bằng tay 1 lần rồi gửi log.");
            }
            finally
            {
                _probeRunning = false;
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
                "const targeted=[];" +
                "const fallback=[];" +
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
                "const candidate={button:b,x:item.ox+br.left+br.width/2,y:item.oy+br.top+br.height/2};" +
                "fallback.push(candidate);" +
                "let c=b;" +
                "let ok=false;" +
                "for(let i=0;i<10&&c;i++,c=c.parentElement){" +
                "const t=norm(c.innerText||c.textContent);" +
                "if(t.includes('kho hưng yên 1')&&t.includes('sft3')){" +
                "ok=true;break;" +
                "}" +
                "}" +
                "if(ok)targeted.push(candidate);" +
                "}" +
                "}" +
                "const dedupe=a=>{" +
                "const out=[];" +
                "for(const x of a)if(!out.some(y=>y.button===x.button))out.push(x);" +
                "return out;" +
                "};" +
                "const primary=dedupe(targeted);" +
                "const all=dedupe(fallback);" +
                "const selected=primary.length===1?primary:(primary.length===0&&all.length===1?all:[]);" +
                "const reason=primary.length===1?'HY1_SFT3_UNIQUE':" +
                "(primary.length>1?'HY1_SFT3_AMBIGUOUS':" +
                "(all.length===1?'UNIQUE_ARROW_FALLBACK':" +
                "(all.length===0?'NOT_FOUND':'ARROW_AMBIGUOUS')));" +
                "return {" +
                "unique:selected.length===1," +
                "button:selected.length===1?selected[0].button:null," +
                "x:selected.length===1?selected[0].x:0," +
                "y:selected.length===1?selected[0].y:0," +
                "docs:docs.length," +
                "arrows:arrows," +
                "targets:primary.length," +
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
                "if(d.__d127ProbeInstalled)continue;" +
                "d.__d127ProbeInstalled=true;" +
                "const isTarget=e=>{" +
                "if(!e||!e.closest)return false;" +
                "const b=e.closest('button,[role=button],a');" +
                "if(!b)return false;" +
                "return [...b.querySelectorAll('path')].some(x=>x.getAttribute('d')===arrowPath);" +
                "};" +
                "for(const n of ['pointerdown','pointerup','mousedown','mouseup','click']){" +
                "d.addEventListener(n,e=>{" +
                "if(isTarget(e.target))post(" +
                "'event='+n+" +
                "' trusted='+e.isTrusted+" +
                "' default_prevented='+e.defaultPrevented);" +
                "},true);" +
                "}" +
                "d.addEventListener('keydown',e=>{" +
                "if(isTarget(e.target))post(" +
                "'event=keydown_on_target trusted='+e.isTrusted+" +
                "' default_prevented='+e.defaultPrevented);" +
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
