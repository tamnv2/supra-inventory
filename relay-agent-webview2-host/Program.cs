using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
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
        private CoreWebView2Environment _environment;
        private WebView2 _activeWeb;
        private readonly List<WebView2> _childWebViews = new List<WebView2>();
        // D167: a read-only SKU export lives in a different hidden WebView2
        // with the SAME managed environment/profile. Never replace the Confirm tab.
        private WebView2 _skuExportWeb;

        internal BrowserForm(HostOptions options)
        {
            _options = options;
            Text = "SUPRA Confirm PickList · Agent";
            Width = 1360;
            Height = 900;
            StartPosition = FormStartPosition.CenterScreen;
            Controls.Add(_web);
            Shown += async (_, __) => await InitializeSafeAsync();
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

            CoreWebView2Environment.SetLoaderDllFolderPath(loaderFolder);

            GrantAppContainerReadBestEffort(_options.Runtime);
            var envOptions = new CoreWebView2EnvironmentOptions(
                "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" + _options.DebugPort);
            _environment = await CoreWebView2Environment.CreateAsync(_options.Runtime, _options.Profile, envOptions);
            await ConfigureWebViewAsync(_web);
            _activeWeb = _web;
            _web.Source = new Uri(_options.Url);
        }

        private async Task ConfigureWebViewAsync(WebView2 view)
        {
            await view.EnsureCoreWebView2Async(_environment);
            view.CoreWebView2.Settings.IsPasswordAutosaveEnabled = true;
            view.CoreWebView2.Settings.IsGeneralAutofillEnabled = true;
            view.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            view.CoreWebView2.Settings.IsStatusBarEnabled = false;
            view.CoreWebView2.NewWindowRequested += HandleNewWindowRequested;
            view.CoreWebView2.ProcessFailed += (_, __) =>
            {
                try
                {
                    BeginInvoke(new Action(() =>
                    {
                        Environment.ExitCode = 3;
                        Close();
                    }));
                }
                catch { }
            };
        }

        private async void HandleNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            var deferral = e.GetDeferral();
            try
            {
                Uri target;
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out target) ||
                    !string.Equals(target.Scheme, "https", StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(target.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                {
                    e.Handled = true;
                    return;
                }

                if (string.Equals(target.AbsolutePath, "/sft3/app/report/bin-inventory",
                    StringComparison.OrdinalIgnoreCase))
                {
                    // This exact read-only report route is the only D167 child
                    // allowed to remain hidden. Other Supra popups retain the
                    // previously field-proven v67 visible/opener flow.
                    if (_skuExportWeb != null)
                    {
                        var retiredSku = _skuExportWeb;
                        _skuExportWeb = null;
                        try { Controls.Remove(retiredSku); retiredSku.Dispose(); } catch { }
                    }
                    var skuChild = new WebView2 { Width = 1, Height = 1, Visible = false };
                    Controls.Add(skuChild);
                    await ConfigureWebViewAsync(skuChild);
                    skuChild.CoreWebView2.DownloadStarting += OnSkuDownloadStarting;
                    _skuExportWeb = skuChild;
                    e.NewWindow = skuChild.CoreWebView2;
                    e.Handled = true;
                    // Do not change _activeWeb, visibility, focus, Confirm DOM,
                    // WMS login, confirmation counters or refresh timers.
                    return;
                }

                // v67: preserve real browser new-window/opener semantics inside the owned
                // WebView2 environment instead of converting the request into Navigate().
                // This keeps the same dedicated profile while giving Supra a genuine child
                // browsing context, matching the Probe v2 field-success path.
                var child = new WebView2
                {
                    Dock = DockStyle.Fill,
                    Visible = false
                };
                Controls.Add(child);
                await ConfigureWebViewAsync(child);
                _childWebViews.Add(child);

                e.NewWindow = child.CoreWebView2;
                e.Handled = true;

                if (_activeWeb != null)
                    _activeWeb.Visible = false;

                _activeWeb = child;
                child.Visible = true;
                child.BringToFront();
                TrimRetiredChildren();
            }
            catch
            {
                e.Handled = true;
            }
            finally
            {
                deferral.Complete();
            }
        }

        private void OnSkuDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            // Never persist arbitrary browser downloads into the SKU directory.
            // Only a bounded read-only HY1 Bin Inventory Excel export is allowed.
            var url = e.DownloadOperation?.Uri ?? "";
            var name = Path.GetFileName(e.ResultFilePath ?? "");
            Uri origin;
            var permitted = (Uri.TryCreate(url, UriKind.Absolute, out origin) &&
                ((origin.Scheme == "https" &&
                    string.Equals(origin.Host, "api-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                 || (url.StartsWith("blob:https://wms-supra.winmart.vn/", StringComparison.OrdinalIgnoreCase))));
            if (!permitted || !name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ||
                (name.IndexOf("BIN", StringComparison.OrdinalIgnoreCase) < 0 &&
                 name.IndexOf("INVENTORY", StringComparison.OrdinalIgnoreCase) < 0))
            {
                e.Cancel = true;
                return;
            }
            try
            {
                var parent = Directory.GetParent(_options.Profile);
                if (parent == null) throw new IOException("SKU export directory missing.");
                var folder = Path.Combine(parent.FullName, "D167SkuDownloads");
                Directory.CreateDirectory(folder);
                e.ResultFilePath = Path.Combine(folder,
                    "D167_BIN_INVENTORY_" + DateTime.UtcNow.ToString("yyyyMMdd_HHmmss_fff") + ".xlsx");
            }
            catch
            {
                e.Cancel = true;
            }
        }

        private void TrimRetiredChildren()
        {
            // Keep the active child and its immediate predecessor so genuine opener
            // semantics remain available. Older hidden WebViews only consume RAM and
            // can accumulate during a long 16-hour Agent session.
            while (_childWebViews.Count > 2)
            {
                var retired = _childWebViews[0];
                _childWebViews.RemoveAt(0);
                if (ReferenceEquals(retired, _activeWeb)) continue;
                try { Controls.Remove(retired); } catch { }
                try { retired.Dispose(); } catch { }
            }
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
