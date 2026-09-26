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

                var result = await _web.CoreWebView2.ExecuteScriptAsync(BuildDashboardTargetScript());
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

                double clickX;
                double clickY;
                int arrowCount;
                int cardCount;
                if (!TryParseDashboardTarget(result, out clickX, out clickY, out arrowCount, out cardCount))
                    return;
                if (clickX < 0 || clickY < 0 || cardCount != 1)
                    return;

                await DispatchTrustedMouseClickAsync(clickX, clickY);
                AppendHostLog(
                    "DASHBOARD_TRUSTED_CLICK x=" + clickX.ToString("0.0", CultureInfo.InvariantCulture) +
                    " y=" + clickY.ToString("0.0", CultureInfo.InvariantCulture) +
                    " arrows=" + arrowCount +
                    " cards=" + cardCount);

                _warehouseEntryClickIssued = true;
                _warehouseEntrySource = current;
                _warehouseEntryClickUtc = DateTime.UtcNow;
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

        private static string BuildDashboardTargetScript()
        {
            return @"(() => {
              const visible = e => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
              const normPath = v => String(v || '').toLowerCase().replace(/[\s,]+/g,'');
              const exactArrow = normPath('m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z');

              const exactArrowButtons = [...document.querySelectorAll('button.MuiIconButton-root')].filter(button => {
                if (!visible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true')
                  return false;
                return [...button.querySelectorAll('svg[viewBox] path')].some(path => {
                  const svg = path.closest('svg');
                  if (!svg || String(svg.getAttribute('viewBox') || '').trim() !== '0 0 24 24')
                    return false;
                  return normPath(path.getAttribute('d')) === exactArrow;
                });
              });

              const quickAccessButtons = exactArrowButtons.filter(button => {
                const card = button.parentElement;
                if (!card || !visible(card)) return false;
                const className = String(card.className || '');
                if (!className.includes('MuiPaper-root')) return false;
                return [...card.querySelectorAll('svg[viewBox]')].some(svg =>
                  visible(svg) &&
                  String(svg.getAttribute('viewBox') || '').trim() === '0 0 72 72');
              });

              if (quickAccessButtons.length !== 1)
                return [-1,-1,exactArrowButtons.length,quickAccessButtons.length];

              const target = quickAccessButtons[0];
              try { target.scrollIntoView({block:'center',inline:'center'}); } catch (_) {}
              const rect = target.getBoundingClientRect();
              return [
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
                exactArrowButtons.length,
                quickAccessButtons.length
              ];
            })()";
        }

        private static bool TryParseDashboardTarget(
            string raw,
            out double x,
            out double y,
            out int arrows,
            out int cards)
        {
            x = -1;
            y = -1;
            arrows = 0;
            cards = 0;
            var match = Regex.Match(
                raw ?? "",
                @"^\s*\[\s*(?<x>-?[0-9]+(?:\.[0-9]+)?)\s*,\s*(?<y>-?[0-9]+(?:\.[0-9]+)?)\s*,\s*(?<a>[0-9]+)\s*,\s*(?<c>[0-9]+)\s*\]\s*$",
                RegexOptions.CultureInvariant);
            if (!match.Success) return false;

            return double.TryParse(match.Groups["x"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out x) &&
                   double.TryParse(match.Groups["y"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out y) &&
                   int.TryParse(match.Groups["a"].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out arrows) &&
                   int.TryParse(match.Groups["c"].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out cards);
        }

        private async Task DispatchTrustedMouseClickAsync(double x, double y)
        {
            var sx = x.ToString("0.###", CultureInfo.InvariantCulture);
            var sy = y.ToString("0.###", CultureInfo.InvariantCulture);

            await _web.CoreWebView2.CallDevToolsProtocolMethodAsync(
                "Input.dispatchMouseEvent",
                "{\"type\":\"mouseMoved\",\"x\":" + sx + ",\"y\":" + sy + ",\"button\":\"none\",\"buttons\":0}");
            await _web.CoreWebView2.CallDevToolsProtocolMethodAsync(
                "Input.dispatchMouseEvent",
                "{\"type\":\"mousePressed\",\"x\":" + sx + ",\"y\":" + sy + ",\"button\":\"left\",\"buttons\":1,\"clickCount\":1}");
            await _web.CoreWebView2.CallDevToolsProtocolMethodAsync(
                "Input.dispatchMouseEvent",
                "{\"type\":\"mouseReleased\",\"x\":" + sx + ",\"y\":" + sy + ",\"button\":\"left\",\"buttons\":0,\"clickCount\":1}");
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
