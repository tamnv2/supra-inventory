using System;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private AgentTabWebView2Browser _e190Web;

        // Bridge is invoked by the established CDP business adapter on a worker
        // thread. Only the WinForms UI thread creates or touches WebView2 controls.
        private void ConfigureE190NativeBrowser()
        {
            _supraBrowser.ConfigureEmbeddedBrowser(new SupraConfirmBrowser.EmbeddedBrowserBridge
            {
                Start = StartE190NativeBrowser,
                Protect = E190Protect,
                SetVisible = E190Visible,
                RefreshPaintProof = E190PaintProof,
                Stop = E190Stop,
                IsReady = () => _e190Web != null && _e190Web.Ready
            });
        }

        private bool StartE190NativeBrowser(int port, string fixedRuntime, string profile)
        {
            if (!IsHandleCreated || IsDisposed || !InvokeRequired)
                throw new InvalidOperationException("E190 browser creation must run from worker to live UI.");
            var loader = Path.Combine(AgentBrowserStorage.CurrentRoot, "OwnedWebView2");
            // Use the exact installed Host14 loader, not a system-wide Edge fallback.
            string hostExe, verifiedRuntime;
            if (!AgentBrowserBundle.TryGetReady(out hostExe, out verifiedRuntime) ||
                !string.Equals(verifiedRuntime, fixedRuntime, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("E190 fixed runtime not verified.");
            loader = Path.Combine(Path.GetDirectoryName(hostExe), "loader", "x64");
            var completed = new ManualResetEventSlim(false);
            {
                Exception failure = null;
                var success = false;
                BeginInvoke(new Action(async () =>
                {
                    AgentTabWebView2Browser browser = null;
                    try
                    {
                        E190DisposeOnUi();
                        browser = new AgentTabWebView2Browser(AgentDiagnostics.Write);
                        _e190Web = browser;
                        _wmsWebViewport.Controls.Add(browser);
                        browser.BringToFront();
                        await browser.InitializeAsync(loader, fixedRuntime, profile, port);
                        success = browser.Ready;
                    }
                    catch (Exception ex)
                    {
                        failure = ex;
                        AgentDiagnostics.Write("E190_WEB init=FAIL type=" + ex.GetType().Name);
                        if (browser != null)
                        {
                            _wmsWebViewport.Controls.Remove(browser);
                            browser.Dispose();
                            if (ReferenceEquals(_e190Web, browser)) _e190Web = null;
                        }
                    }
                    finally { completed.Set(); }
                }));
                if (!completed.Wait(TimeSpan.FromSeconds(30)))
                {
                    E190Stop();
                    throw new TimeoutException("E190 native browser initialization timeout.");
                }
                if (failure != null) throw new InvalidOperationException(
                    "Không khởi tạo được trình duyệt Web Agent mới.", failure);
                return success;
            }
        }

        private bool E190Invoke(Func<bool> action)
        {
            if (IsDisposed || !IsHandleCreated) return false;
            if (!InvokeRequired) return action();
            var completed = new ManualResetEventSlim(false);
            {
                var result = false;
                try
                {
                    BeginInvoke(new Action(() =>
                    {
                        try { result = !IsDisposed && action(); }
                        catch (Exception ex)
                        {
                            result = false;
                            AgentDiagnostics.Write("E190_WEB ui_action=FAILED type=" + ex.GetType().Name);
                        }
                        finally { completed.Set(); }
                    }));
                    return completed.Wait(TimeSpan.FromMilliseconds(1800)) && result;
                }
                catch (InvalidOperationException) { return false; }
            }
        }

        private bool E190Protect(bool protect)
        {
            // An unacknowledged delayed UI callback must never unlock WMS
            // after the caller has already failed closed. Unlock is interactive
            // on the Agent UI thread; background callers may only re-protect.
            if (!protect && InvokeRequired)
            {
                AgentDiagnostics.Write("E190_WEB input=UNLOCK_DENIED reason=NOT_UI_THREAD");
                return false;
            }
            return E190Invoke(() => _e190Web != null && _e190Web.Protect(protect));
        }

        private void E190Visible(bool visible)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke(new Action(() =>
                {
                    if (!IsDisposed && _e190Web != null && !_e190Web.IsDisposed)
                        _e190Web.SetPresentation(visible);
                }));
            }
            catch (InvalidOperationException) { }
        }

        private void E190PaintProof()
        {
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke(new Action(() =>
                {
                    if (!IsDisposed && _e190Web != null && _e190Web.Ready)
                        _e190Web.CheckVisiblePaint();
                }));
            }
            catch (InvalidOperationException) { }
        }

        private void E190DisposeOnUi()
        {
            if (_e190Web == null) return;
            var retired = _e190Web;
            _e190Web = null;
            _wmsWebViewport.Controls.Remove(retired);
            retired.Dispose();
            AgentDiagnostics.Write("E190_WEB lifecycle=DISPOSED");
        }

        private void E190Stop()
        {
            E190Invoke(() => { E190DisposeOnUi(); return true; });
        }
    }
}
