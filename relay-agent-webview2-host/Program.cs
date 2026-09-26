using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SupraInventoryWebView2Host
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try
            {
                var options = HostOptions.Parse(args);
                Application.Run(new BrowserForm(options));
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(Path.GetTempPath(), "supra-webview2-host.log"),
                        DateTime.UtcNow.ToString("o") + " " + ex.GetType().Name + " " + ex.Message + Environment.NewLine);
                }
                catch { }
                Environment.ExitCode = 2;
            }
        }
    }

    internal sealed class HostOptions
    {
        internal string Url = "";
        internal string Profile = "";
        internal string Runtime = "";
        internal int DebugPort;

        internal static HostOptions Parse(string[] args)
        {
            var value = new HostOptions();
            foreach (var arg in args ?? new string[0])
            {
                if (arg.StartsWith("--url=", StringComparison.Ordinal)) value.Url = arg.Substring(6);
                else if (arg.StartsWith("--profile=", StringComparison.Ordinal)) value.Profile = arg.Substring(10);
                else if (arg.StartsWith("--runtime=", StringComparison.Ordinal)) value.Runtime = arg.Substring(10);
                else if (arg.StartsWith("--debug-port=", StringComparison.Ordinal)) int.TryParse(arg.Substring(13), out value.DebugPort);
            }
            if (!Uri.TryCreate(value.Url, UriKind.Absolute, out var url) ||
                !string.Equals(url.Scheme, "https", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(url.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Invalid Supra URL.");
            if (value.DebugPort <= 0 || value.DebugPort > 65535) throw new InvalidOperationException("Invalid debug port.");
            if (string.IsNullOrWhiteSpace(value.Profile)) throw new InvalidOperationException("Missing profile path.");
            if (string.IsNullOrWhiteSpace(value.Runtime) ||
                !File.Exists(Path.Combine(value.Runtime, "msedgewebview2.exe")))
                throw new InvalidOperationException("Fixed WebView2 Runtime is unavailable.");
            Directory.CreateDirectory(value.Profile);
            return value;
        }
    }

    internal sealed class BrowserForm : Form
    {
        private readonly HostOptions _options;
        private readonly WebView2 _web = new WebView2 { Dock = DockStyle.Fill };
        private readonly Timer _dashboardProbeTimer = new Timer { Interval = 700 };
        private bool _dashboardProbeRunning;
        private bool _warehouseEntryClickIssued;
        private string _warehouseEntrySource = "";
        private DateTime _warehouseEntryClickUtc = DateTime.MinValue;
        private bool _pendingConfirmAfterWarehouseEntry;
        private string _lastDashboardProbeResult = "";
        private DateTime _lastDashboardProbeLogUtc = DateTime.MinValue;

        internal BrowserForm(HostOptions options)
        {
            _options = options;
            Text = "SUPRA Confirm PickList · Agent";
            Width = 1360;
            Height = 900;
            StartPosition = FormStartPosition.CenterScreen;
            Controls.Add(_web);
            Shown += async (_, __) => await InitializeSafeAsync();
            FormClosed += (_, __) =>
            {
                try { _dashboardProbeTimer.Stop(); } catch { }
            };
        }

        private async Task InitializeSafeAsync()
        {
            try
            {
                await InitializeAsync();
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(Path.GetTempPath(), "supra-webview2-host.log"),
                        DateTime.UtcNow.ToString("o") + " INIT_FAIL " + ex.GetType().Name + " " + ex.Message + Environment.NewLine);
                }
                catch { }
                Environment.ExitCode = 2;
                try { Close(); } catch { }
            }
        }

        private async Task InitializeAsync()
        {
            if (!Environment.Is64BitProcess)
                throw new BadImageFormatException("SUPRA WebView2 host phải chạy tiến trình x64.");

            var loaderFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "loader", "x64");
            var loaderPath = Path.Combine(loaderFolder, "WebView2Loader.dll");
            if (!File.Exists(loaderPath))
                throw new FileNotFoundException("Thiếu WebView2Loader.dll x64.", loaderPath);

            // D127 v54: bind the native loader explicitly. Relying on default probing can
            // load a loader of the wrong architecture on .NET Framework and throw 0x8007000B.
            CoreWebView2Environment.SetLoaderDllFolderPath(loaderFolder);

            GrantAppContainerReadBestEffort(_options.Runtime);
            var envOptions = new CoreWebView2EnvironmentOptions(
                "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" + _options.DebugPort);
            var env = await CoreWebView2Environment.CreateAsync(_options.Runtime, _options.Profile, envOptions);
            await _web.EnsureCoreWebView2Async(env);
            _web.CoreWebView2.Settings.IsPasswordAutosaveEnabled = true;
            _web.CoreWebView2.Settings.IsGeneralAutofillEnabled = true;
            _web.CoreWebView2.NewWindowRequested += HandleNewWindowRequested;
            _web.CoreWebView2.NavigationCompleted += HandleNavigationCompleted;
            _dashboardProbeTimer.Tick += async (_, __) => await ProbeDashboardAccessAsync();
            _dashboardProbeTimer.Start();
            _web.Source = new Uri(_options.Url);
        }

        private void HandleNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            try
            {
                Uri target;
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out target)) return;
                if (!string.Equals(target.Scheme, "https", StringComparison.OrdinalIgnoreCase)) return;
                if (!string.Equals(target.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase)) return;

                // D127 v60: keep the Supra quick-access flow on the visible Agent tab.
                _pendingConfirmAfterWarehouseEntry = true;
                e.Handled = true;
                _web.CoreWebView2.Navigate(target.AbsoluteUri);
            }
            catch
            {
                // Fail closed: if the target cannot be validated, keep default WebView2 behavior.
            }
        }

        private async void HandleNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                if (!e.IsSuccess || _web.CoreWebView2 == null) return;
                var current = _web.CoreWebView2.Source ?? "";
                Uri uri;
                if (!Uri.TryCreate(current, UriKind.Absolute, out uri)) return;
                if (!string.Equals(uri.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase)) return;

                if (_pendingConfirmAfterWarehouseEntry &&
                    uri.AbsolutePath.IndexOf("/sft3/app/saleorder/auto-pickpack-confirm", StringComparison.OrdinalIgnoreCase) < 0)
                {
                    _pendingConfirmAfterWarehouseEntry = false;
                    await Task.Delay(500);
                    _web.CoreWebView2.Navigate(_options.Url);
                    return;
                }

                if (_warehouseEntryClickIssued &&
                    !string.Equals(current, _warehouseEntrySource, StringComparison.OrdinalIgnoreCase) &&
                    uri.AbsolutePath.IndexOf("/sft3/app/saleorder/auto-pickpack-confirm", StringComparison.OrdinalIgnoreCase) < 0)
                {
                    _warehouseEntryClickIssued = false;
                    _warehouseEntrySource = "";
                    await Task.Delay(500);
                    _web.CoreWebView2.Navigate(_options.Url);
                }
            }
            catch
            {
                // Agent controller remains the secondary readiness guard.
            }
        }

        private async Task ProbeDashboardAccessAsync()
        {
            if (_dashboardProbeRunning || _web.CoreWebView2 == null) return;
            _dashboardProbeRunning = true;
            try
            {
                var current = _web.CoreWebView2.Source ?? "";
                Uri uri;
                if (!Uri.TryCreate(current, UriKind.Absolute, out uri)) return;
                if (!string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(uri.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                    return;
                if (uri.AbsolutePath.IndexOf("/sft3/app/saleorder/auto-pickpack-confirm", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    _warehouseEntryClickIssued = false;
                    _warehouseEntrySource = "";
                    return;
                }

                if (_warehouseEntryClickIssued)
                {
                    if (!string.Equals(current, _warehouseEntrySource, StringComparison.OrdinalIgnoreCase))
                    {
                        _warehouseEntryClickIssued = false;
                        _warehouseEntrySource = "";
                        _web.CoreWebView2.Navigate(_options.Url);
                        return;
                    }

                    if (DateTime.UtcNow - _warehouseEntryClickUtc < TimeSpan.FromSeconds(12))
                        return;

                    _warehouseEntryClickIssued = false;
                    _warehouseEntrySource = "";
                }

                // D127 v63: mark the attempt before activating the control. A same-tab
                // navigation can complete while the CDP call is still awaiting its response.
                _warehouseEntryClickIssued = true;
                _warehouseEntrySource = current;
                _warehouseEntryClickUtc = DateTime.UtcNow;

                var result = await ActivateDashboardEntryAsync();
                var now = DateTime.UtcNow;
                if (!string.Equals(result ?? "", _lastDashboardProbeResult, StringComparison.Ordinal) ||
                    now - _lastDashboardProbeLogUtc >= TimeSpan.FromSeconds(5))
                {
                    _lastDashboardProbeResult = result ?? "";
                    _lastDashboardProbeLogUtc = now;
                    AppendHostLog("DASHBOARD_PROBE result=" + (_lastDashboardProbeResult.Length > 300
                        ? _lastDashboardProbeResult.Substring(0, 300)
                        : _lastDashboardProbeResult));
                }

                if (string.IsNullOrWhiteSpace(result) ||
                    result.IndexOf("ACTIVATED:", StringComparison.Ordinal) < 0)
                {
                    _warehouseEntryClickIssued = false;
                    _warehouseEntrySource = "";
                    return;
                }

                AppendHostLog("DASHBOARD_USER_GESTURE " + result);
            }
            catch (Exception ex)
            {
                AppendHostLog("DASHBOARD_PROBE_FAIL " + ex.GetType().Name + " " + ex.Message);
            }
            finally
            {
                _dashboardProbeRunning = false;
            }
        }

        private async Task<string> ActivateDashboardEntryAsync()
        {
            var expression = BuildDashboardActivationScript();
            var parameters =
                "{\"expression\":" + QuoteJson(expression) +
                ",\"userGesture\":true,\"awaitPromise\":false,\"returnByValue\":true}";
            var raw = await _web.CoreWebView2.CallDevToolsProtocolMethodAsync(
                "Runtime.evaluate",
                parameters);

            var match = Regex.Match(
                raw ?? "",
                @"(?<state>ACTIVATED|NOT_FOUND|AMBIGUOUS):docs=(?<docs>[0-9]+):arrows=(?<arrows>[0-9]+):cards=(?<cards>[0-9]+)",
                RegexOptions.CultureInvariant);
            if (!match.Success)
                return "CDP_NO_RESULT";

            return
                match.Groups["state"].Value +
                ":docs=" + match.Groups["docs"].Value +
                ":arrows=" + match.Groups["arrows"].Value +
                ":cards=" + match.Groups["cards"].Value;
        }

        private static string BuildDashboardActivationScript()
        {
            return @"(() => {
              const visible = e => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
              const normPath = v => String(v || '').toLowerCase().replace(/[\s,]+/g,'');
              const exactArrow = normPath('m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z');

              // v60-v62 accidentally regressed the v58 same-origin-frame walk when the
              // recovery logic moved into the owned WebView2 host. Restore it here so the
              // visible dashboard/micro-frontend document is the one being activated.
              const docs = [];
              const seenDocs = new Set();
              const addDoc = d => {
                if (!d || seenDocs.has(d) || docs.length >= 8) return;
                seenDocs.add(d);
                docs.push(d);
                for (const frame of [...d.querySelectorAll('iframe')]) {
                  try { if (frame.contentDocument) addDoc(frame.contentDocument); } catch (_) {}
                }
              };
              addDoc(document);

              const exactArrowButtons = [];
              for (const d of docs) {
                for (const button of [...d.querySelectorAll('button.MuiIconButton-root')]) {
                  if (!visible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true')
                    continue;
                  const hasArrow = [...button.querySelectorAll('svg[viewBox] path')].some(path => {
                    const svg = path.closest('svg');
                    if (!svg || String(svg.getAttribute('viewBox') || '').trim() !== '0 0 24 24')
                      return false;
                    return normPath(path.getAttribute('d')) === exactArrow;
                  });
                  if (hasArrow) exactArrowButtons.push(button);
                }
              }

              const quickAccessButtons = [];
              for (const button of exactArrowButtons) {
                let node = button.parentElement;
                for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
                  if (!visible(node)) continue;
                  const className = String(node.className || '');
                  if (!className.includes('MuiPaper-root')) continue;
                  const hasWarehouseIllustration = [...node.querySelectorAll('svg[viewBox]')].some(svg =>
                    visible(svg) &&
                    String(svg.getAttribute('viewBox') || '').trim() === '0 0 72 72');
                  if (hasWarehouseIllustration) {
                    quickAccessButtons.push(button);
                    break;
                  }
                }
              }

              const targets = [...new Set(quickAccessButtons)];
              if (targets.length === 0)
                return 'NOT_FOUND:docs=' + docs.length + ':arrows=' + exactArrowButtons.length + ':cards=0';
              if (targets.length !== 1)
                return 'AMBIGUOUS:docs=' + docs.length + ':arrows=' + exactArrowButtons.length + ':cards=' + targets.length;

              const target = targets[0];
              try { target.scrollIntoView({block:'center',inline:'center'}); } catch (_) {}
              try { target.focus({preventScroll:true}); } catch (_) { try { target.focus(); } catch (_) {} }

              // Runtime.evaluate is called with userGesture=true. That preserves browser
              // user-activation for React/MUI handlers that open the SFT3 route in a new
              // browsing context; NewWindowRequested then forces that route into this tab.
              target.click();
              return 'ACTIVATED:docs=' + docs.length + ':arrows=' + exactArrowButtons.length + ':cards=1';
            })()";
        }

        private static string QuoteJson(string value)
        {
            if (value == null) return "\"\"";
            return "\"" +
                value
                    .Replace("\\", "\\\\")
                    .Replace("\"", "\\\"")
                    .Replace("\r", "\\r")
                    .Replace("\n", "\\n")
                    .Replace("\t", "\\t") +
                "\"";
        }

        private static void AppendHostLog(string message)
        {
            try
            {
                File.AppendAllText(
                    Path.Combine(Path.GetTempPath(), "supra-webview2-host.log"),
                    DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine);
            }
            catch { }
        }

        private static void GrantAppContainerReadBestEffort(string path)
        {
            foreach (var sid in new[] { "*S-1-15-2-2", "*S-1-15-2-1" })
            {
                try
                {
                    using (var process = Process.Start(new ProcessStartInfo
                    {
                        FileName = "icacls.exe",
                        Arguments = "\"" + path.Replace("\"", "") + "\" /grant " + sid + ":(OI)(CI)(RX)",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }))
                    {
                        process?.WaitForExit(5000);
                    }
                }
                catch { }
            }
        }
    }
}
