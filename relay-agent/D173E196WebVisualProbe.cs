using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private System.Windows.Forms.Timer _e196VisualProbeTimer;
        private DateTime _e196LastVisualProbeAtUtc = DateTime.MinValue;

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);

        private void D173E196ScheduleVisualProbe(string trigger)
        {
            if (_startupSmoke || IsDisposed || !IsHandleCreated ||
                _mainTabs.SelectedTab != _wmsWebTab ||
                _e196VisualProbeTimer != null ||
                DateTime.UtcNow - _e196LastVisualProbeAtUtc < TimeSpan.FromMinutes(2))
                return;
            var timer = new System.Windows.Forms.Timer { Interval = 1600 };
            _e196VisualProbeTimer = timer;
            timer.Tick += (s, e) =>
            {
                timer.Stop();
                timer.Dispose();
                _e196VisualProbeTimer = null;
                _e196LastVisualProbeAtUtc = DateTime.UtcNow;
                D173E196ProbeWebPixels(trigger);
            };
            timer.Start();
        }

        private void D173E196ProbeWebPixels(string trigger)
        {
            if (IsDisposed || !Visible || WindowState == FormWindowState.Minimized ||
                _mainTabs.SelectedTab != _wmsWebTab || !_wmsWebViewport.Visible ||
                !_wmsWebViewport.IsHandleCreated ||
                _supraBrowser == null || !_supraBrowser.IsAgentOwnedMode())
                return;
            try
            {
                var foreground = GetForegroundWindow();
                var foregroundRoot = foreground == IntPtr.Zero ? IntPtr.Zero :
                    GetAncestor(foreground, 2 /* GA_ROOT */);
                var native = _supraBrowser.HostDiagnosticSnapshot();
                var dpi = _wmsWebViewport.DeviceDpi;
                var bounds = _wmsWebViewport.ClientRectangle;
                if (foregroundRoot != Handle || bounds.Width < 100 || bounds.Height < 100)
                {
                    AgentDiagnostics.Write("D173_E196_WEB_PIXELS result=SKIPPED reason=" +
                        (foregroundRoot != Handle ? "NOT_FOREGROUND" : "SMALL_VIEWPORT") +
                        " trigger=" + trigger + " dpi=" + dpi + " " + native);
                    return;
                }

                // Screen-only, ephemeral pixel-class sampling. Never persist a
                // WMS screenshot, identifiable pixel values, OCR, URL or page data.
                var origin = _wmsWebViewport.PointToScreen(Point.Empty);
                using (var image = new Bitmap(bounds.Width, bounds.Height))
                using (var graphics = Graphics.FromImage(image))
                {
                    graphics.CopyFromScreen(origin, Point.Empty, bounds.Size,
                        CopyPixelOperation.SourceCopy);
                    const int columns = 12;
                    const int rows = 8;
                    var white = 0;
                    var dark = 0;
                    var buckets = new Dictionary<int, int>();
                    var dominant = 0;
                    for (var y = 0; y < rows; y++)
                    {
                        for (var x = 0; x < columns; x++)
                        {
                            var pixel = image.GetPixel(
                                (2 * x + 1) * (image.Width - 1) / (2 * columns),
                                (2 * y + 1) * (image.Height - 1) / (2 * rows));
                            if (pixel.R >= 245 && pixel.G >= 245 && pixel.B >= 245) white++;
                            if (pixel.R <= 20 && pixel.G <= 20 && pixel.B <= 20) dark++;
                            var bucket = ((pixel.R / 32) << 6) |
                                ((pixel.G / 32) << 3) | (pixel.B / 32);
                            int count;
                            buckets.TryGetValue(bucket, out count);
                            buckets[bucket] = ++count;
                            if (count > dominant) dominant = count;
                        }
                    }
                    var samples = columns * rows;
                    var whitePct = white * 100 / samples;
                    var dominantPct = dominant * 100 / samples;
                    var visualClass = whitePct >= 95 ? "SCREEN_NEAR_WHITE" :
                        dominantPct >= 98 ? "SCREEN_UNIFORM" : "SCREEN_VARIANT";
                    AgentDiagnostics.Write("D173_E196_WEB_PIXELS result=" + visualClass +
                        " trigger=" + trigger + " sample_count=" + samples +
                        " white_pct=" + whitePct.ToString(CultureInfo.InvariantCulture) +
                        " dark_pct=" + (dark * 100 / samples).ToString(CultureInfo.InvariantCulture) +
                        " dominant_bucket_pct=" + dominantPct.ToString(CultureInfo.InvariantCulture) +
                        " dom_ready=" + (_supraBrowserReady ? "1" : "0") +
                        " tab_selected=1 foreground_agent=1 dpi=" + dpi +
                        " viewport=" + bounds.Width + "x" + bounds.Height +
                        " source=SCREEN_NO_IMAGE_STORED occlusion=UNVERIFIED " + native);
                }
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("D173_E196_WEB_PIXELS result=UNAVAILABLE reason=" +
                    ex.GetType().Name + " no_image_stored=true");
            }
        }
    }
}
