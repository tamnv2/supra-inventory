using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SupraInventoryRelayAgent
{
    // E190: a real WinForms child control, not a foreign HWND, overlay or second WMS profile.
    // This is presentation only: all actual Confirm operations remain in SupraConfirmBrowser CDP.
    internal sealed class AgentTabWebView2Browser : UserControl
    {
        private readonly Action<string> _log;
        private readonly WebView2 _initial = new WebView2 { Dock = DockStyle.Fill };
        private readonly List<WebView2> _children = new List<WebView2>();
        private CoreWebView2Environment _environment;
        private WebView2 _active;
        private WebView2 _skuSide;
        private string _profileRoot;
        private bool _protected = true;
        private bool _ready;
        private bool _proofRunning;
        private bool _rendererFailed;
        private bool _presentationRequested = true;
        private DateTime _lastViewportLogUtc = DateTime.MinValue;
        private string _lastSizeClass = "";
        private DateTime _proofAtUtc = DateTime.MinValue;
        private int _navigationId;

        internal bool Ready { get { return _ready && !IsDisposed; } }

        internal AgentTabWebView2Browser(Action<string> log)
        {
            _log = log ?? (_ => { });
            Dock = DockStyle.Fill;
            BackColor = Color.White;
            Controls.Add(_initial);
            // Parent is a genuine tab child for the entire renderer lifetime.
            Resize += (_, __) =>
            {
                var sizeClass = SizeClass();
                if (sizeClass != _lastSizeClass ||
                    DateTime.UtcNow - _lastViewportLogUtc >= TimeSpan.FromSeconds(30))
                {
                    _lastViewportLogUtc = DateTime.UtcNow;
                    _lastSizeClass = sizeClass;
                    _log("E190_WEB viewport=RESIZE visible=" + (Visible ? "1" : "0") +
                         " size_class=" + sizeClass);
                }
            };
            VisibleChanged += (_, __) => _log("E190_WEB viewport=VISIBILITY visible=" +
                (Visible ? "1" : "0") + " size_class=" + SizeClass());
        }

        private string SizeClass()
        {
            return Width < 640 ? "NARROW" : Width < 1280 ? "MEDIUM" : "WIDE";
        }

        internal async Task InitializeAsync(string loaderDirectory, string runtimeDirectory,
            string profileDirectory, int port)
        {
            if (Ready) return;
            if (IsDisposed) throw new ObjectDisposedException(nameof(AgentTabWebView2Browser));
            if (!Environment.Is64BitProcess || port < 1 || port > 65535)
                throw new InvalidOperationException("E190 requires x64 and loopback CDP port.");
            if (!File.Exists(Path.Combine(loaderDirectory, "WebView2Loader.dll")) ||
                !Directory.Exists(runtimeDirectory))
                throw new FileNotFoundException("E190 runtime/loader not installed.");
            _profileRoot = profileDirectory;
            CoreWebView2Environment.SetLoaderDllFolderPath(loaderDirectory);
            var options = new CoreWebView2EnvironmentOptions(
                "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" + port);
            _environment = await CoreWebView2Environment.CreateAsync(
                runtimeDirectory, profileDirectory, options);
            await ConfigureAsync(_initial);
            _active = _initial;
            // Create the CDP page target only. SupraConfirmBrowser performs the
            // canonical WMS navigation once, with existing profile/permissions.
            _initial.CoreWebView2.Navigate("about:blank");
            _ready = true;
            _log("E190_WEB init=PASS mode=IN_PROCESS_TAB runtime=FIXED " +
                 "profile=REUSED renderer=WEBVIEW2 cdponly=127.0.0.1 " +
                 "cross_process_parent=false session_extract=false");
        }

        private async Task ConfigureAsync(WebView2 view, bool skuSide = false)
        {
            await view.EnsureCoreWebView2Async(_environment);
            view.CoreWebView2.Settings.IsPasswordAutosaveEnabled = true;
            view.CoreWebView2.Settings.IsGeneralAutofillEnabled = true;
            view.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            view.CoreWebView2.Settings.IsStatusBarEnabled = false;
            view.Enabled = skuSide || !_protected;
            view.CoreWebView2.NewWindowRequested += NewWindowRequested;
            view.CoreWebView2.NavigationStarting += (_, args) =>
            {
                _navigationId++;
                _log("E190_WEB nav=START id=" + _navigationId +
                    " target=" + UrlClass(args.Uri));
            };
            view.CoreWebView2.NavigationCompleted += (_, args) =>
                _log("E190_WEB nav=COMPLETE id=" + _navigationId +
                    " success=" + (args.IsSuccess ? "1" : "0") +
                    " web_error=" + args.WebErrorStatus +
                    " viewport_visible=" + (Visible ? "1" : "0"));
            view.CoreWebView2.ProcessFailed += (_, args) =>
            {
                // Do not silently reload WMS while a confirm could be in flight.
                _rendererFailed = true;
                _protected = true;
                foreach (var child in _children) if (!child.IsDisposed) child.Enabled = false;
                if (!_initial.IsDisposed) _initial.Enabled = false;
                _log("E190_WEB renderer=FAILED kind=" + args.ProcessFailedKind +
                     " action=FAIL_CLOSED_NO_RELOAD");
            };
            _log("E190_WEB controller=READY sku_side=" + (skuSide ? "1" : "0"));
        }

        private static string UrlClass(string raw)
        {
            Uri uri;
            if (!Uri.TryCreate(raw, UriKind.Absolute, out uri)) return "OTHER";
            if (string.Equals(uri.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                return "WMS";
            if (string.Equals(uri.Host, "auth-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                return "AUTH";
            if (string.Equals(uri.Scheme, "about", StringComparison.OrdinalIgnoreCase))
                return "BLANK";
            return "OTHER";
        }

        private async void NewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            var deferred = e.GetDeferral();
            try
            {
                Uri uri;
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out uri) ||
                    uri.Scheme != Uri.UriSchemeHttps ||
                    !string.Equals(uri.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                {
                    _log("E190_WEB popup=DENIED reason=NON_WMS_DESTINATION");
                    e.Handled = true;
                    return;
                }
                if (string.Equals(uri.AbsolutePath,
                        "/sft3/app/saleorder/auto-pickpack-confirm",
                        StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(uri.Fragment, "#d167-sku-readonly", StringComparison.Ordinal))
                {
                    if (_skuSide != null)
                    {
                        Controls.Remove(_skuSide);
                        _skuSide.Dispose();
                        _skuSide = null;
                    }
                    var sku = new WebView2 { Size = new Size(1, 1), Visible = false };
                    Controls.Add(sku);
                    await ConfigureAsync(sku, true);
                    sku.CoreWebView2.DownloadStarting += OnSkuDownloadStarting;
                    _skuSide = sku;
                    e.NewWindow = sku.CoreWebView2;
                    e.Handled = true;
                    _log("E190_WEB popup=SKU_READONLY preserving_confirm=true");
                    return;
                }

                // Preserve opener/newWindow semantics; never swap into Navigate().
                var child = new WebView2 { Dock = DockStyle.Fill, Visible = false };
                Controls.Add(child);
                await ConfigureAsync(child);
                _children.Add(child);
                e.NewWindow = child.CoreWebView2;
                e.Handled = true;
                if (_active != null) _active.Visible = false;
                _active = child;
                child.Visible = true;
                child.Enabled = !_protected;
                child.BringToFront();
                while (_children.Count > 2)
                {
                    var old = _children[0];
                    _children.RemoveAt(0);
                    if (ReferenceEquals(old, _active)) continue;
                    Controls.Remove(old);
                    old.Dispose();
                }
                _log("E190_WEB popup=WMS_ATTACHED opener=PRESERVED visible_child=true");
            }
            catch (Exception ex)
            {
                e.Handled = true;
                _log("E190_WEB popup=FAILED type=" + ex.GetType().Name);
            }
            finally { deferred.Complete(); }
        }

        private void OnSkuDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            var url = e.DownloadOperation == null ? "" : e.DownloadOperation.Uri ?? "";
            var name = Path.GetFileName(e.ResultFilePath ?? "");
            Uri origin;
            var permitted = (Uri.TryCreate(url, UriKind.Absolute, out origin) &&
                ((origin.Scheme == "https" &&
                    string.Equals(origin.Host, "api-supra.winmart.vn", StringComparison.OrdinalIgnoreCase)) ||
                 url.StartsWith("blob:https://wms-supra.winmart.vn/", StringComparison.OrdinalIgnoreCase)));
            if (!permitted || !name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ||
                (name.IndexOf("BIN", StringComparison.OrdinalIgnoreCase) < 0 &&
                 name.IndexOf("INVENTORY", StringComparison.OrdinalIgnoreCase) < 0))
            {
                e.Cancel = true;
                _log("E190_WEB sku_export=REJECTED");
                return;
            }
            try
            {
                var folder = Path.Combine(Directory.GetParent(_profileRoot).FullName, "D167SkuDownloads");
                Directory.CreateDirectory(folder);
                e.ResultFilePath = Path.Combine(folder,
                    "D167_BIN_INVENTORY_" + DateTime.UtcNow.ToString("yyyyMMdd_HHmmss_fff") + ".xlsx");
                _log("E190_WEB sku_export=ALLOWED");
            }
            catch { e.Cancel = true; _log("E190_WEB sku_export=FAILED"); }
        }

        internal bool Protect(bool protect)
        {
            if (!Ready || (!protect && _rendererFailed)) return false;
            _protected = protect;
            foreach (var child in _children) if (!child.IsDisposed) child.Enabled = !protect;
            if (!_initial.IsDisposed) _initial.Enabled = !protect;
            _log("E190_WEB input=" + (protect ? "PROTECTED" : "UNLOCKED") +
                 " controller_ack=true");
            return true;
        }

        internal void SetPresentation(bool visible)
        {
            if (IsDisposed) return;
            // Parent TabControl determines the real visibility; this never
            // reparents/destroys the renderer or navigates/reloads WMS.
            if (_presentationRequested == visible) return;
            _presentationRequested = visible;
            base.Visible = visible;
            _log("E190_WEB presentation=" + (visible ? "SHOW" : "HIDE") +
                 " parented=true navigation=NONE");
        }

        internal async void CheckVisiblePaint()
        {
            if (!Ready || !Visible || _active == null || !_active.Visible ||
                _active.CoreWebView2 == null || _proofRunning ||
                DateTime.UtcNow - _proofAtUtc < TimeSpan.FromSeconds(20)) return;
            _proofAtUtc = DateTime.UtcNow;
            _proofRunning = true;
            try
            {
                // Preview is held only in memory. Never save, upload or log a frame.
                using (var memory = new MemoryStream())
                {
                    await _active.CoreWebView2.CapturePreviewAsync(
                        CoreWebView2CapturePreviewImageFormat.Png, memory);
                    memory.Position = 0;
                    using (var bmp = new Bitmap(memory))
                    {
                        var white = 0;
                        var count = 0;
                        for (var y = 0; y < 9; y++)
                            for (var x = 0; x < 13; x++)
                            {
                                var sample = bmp.GetPixel(
                                    Math.Min(bmp.Width - 1, x * bmp.Width / 13),
                                    Math.Min(bmp.Height - 1, y * bmp.Height / 9));
                                if (sample.R >= 247 && sample.G >= 247 && sample.B >= 247) white++;
                                count++;
                            }
                        _log("E190_WEB paint=CAPTURED all_white=" +
                            (white >= count - 2 ? "1" : "0") +
                            " sample_count=" + count +
                            " visible=" + (Visible ? "1" : "0") +
                            " controller=" + (_active.CoreWebView2 != null ? "READY" : "DOWN"));
                    }
                }
            }
            catch (Exception ex) { _log("E190_WEB paint=UNVERIFIED type=" + ex.GetType().Name); }
            finally { _proofRunning = false; }
        }
    }
}
