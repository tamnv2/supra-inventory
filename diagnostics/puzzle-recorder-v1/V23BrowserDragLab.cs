using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Cv2 = OpenCvSharp.Cv2;
using Mat = OpenCvSharp.Mat;
using Scalar = OpenCvSharp.Scalar;
using MatType = OpenCvSharp.MatType;
using ImreadModes = OpenCvSharp.ImreadModes;
using HierarchyIndex = OpenCvSharp.HierarchyIndex;
using RetrievalModes = OpenCvSharp.RetrievalModes;
using ContourApproximationModes = OpenCvSharp.ContourApproximationModes;

namespace SupraPuzzleRecorder
{
    // Actual CDP mouse input is strictly confined to a self-contained offline test page.
    // No real authentication challenge, WMS navigation, DOM credentials or network calls.
    internal sealed class V23BrowserDragLab : Form
    {
        private readonly WebView2 _browser = new WebView2 { Size = new Size(1178, 600) };
        private readonly Button _next = new Button { Text = "Mẫu mới", Width = 100 };
        private readonly Button _select = new Button { Text = "Chọn vùng", Width = 110, Enabled = false };
        private readonly Button _test = new Button { Text = "Kéo thật 1 lần", Width = 130, Enabled = false };
        private readonly Button _export = new Button { Text = "Lưu ZIP chẩn đoán", Width = 150, Enabled = false };
        private readonly Label _status = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };
        private readonly Random _random = new Random();
        private readonly List<Dictionary<string, object>> _reports = new List<Dictionary<string, object>>();
        private readonly List<Tuple<byte[], byte[]>> _images = new List<Tuple<byte[], byte[]>>();
        private readonly string _profileRoot = Path.Combine(Path.GetTempPath(), "SUPRA-V23-DragLab", Guid.NewGuid().ToString("N"));
        private Rectangle _roi = Rectangle.Empty;
        private Size _imageSize = Size.Empty;
        private readonly bool _smokeMode;
        private readonly Stopwatch _startupClock = Stopwatch.StartNew();
        private readonly List<Dictionary<string, object>> _startupEvents = new List<Dictionary<string, object>>();
        private Timer _smokeTimer;
        internal bool SmokePassed { get; private set; }
        private bool _ready;
        private bool _busy;
        private bool _tested;
        private int _sourceX, _targetX, _pieceY;
        private const int PieceSize = 46;
        private const int RoiPadding = 16;
        private const int MaxTests = 8;

        internal V23BrowserDragLab(bool smokeMode = false)
        {
            _smokeMode = smokeMode;
            Text = "SUPRA V2.3 — Kéo thật bằng WebView2 trên trang thử nghiệm offline";
            Size = new Size(1230, 780);
            MinimumSize = new Size(900, 500);
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            var toolbar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 43, WrapContents = false };
            foreach (var button in new[] { _next, _select, _test, _export })
                toolbar.Controls.Add(button);
            var host = new Panel { Dock = DockStyle.Fill, AutoScroll = true };
            host.Controls.Add(_browser);
            var foot = new Panel { Dock = DockStyle.Bottom, Height = 42 };
            foot.Controls.Add(_status);
            _status.Text = "Chỉ dùng trang mô phỏng nội bộ, không mở hoặc kéo trên WMS thật.";
            Controls.Add(host);
            Controls.Add(foot);
            Controls.Add(toolbar);
            _browser.CreationProperties = new CoreWebView2CreationProperties
            {
                UserDataFolder = _profileRoot,
                ProfileName = "V23OfflineDrag",
                IsInPrivateModeEnabled = true
            };
            _next.Click += (sender, args) => NewSample();
            _select.Click += async (sender, args) => await SelectRegionAsync();
            _test.Click += async (sender, args) => await TestOnceAsync();
            _export.Click += (sender, args) => Export();
            Shown += async (sender, args) => await InitializeAsync();
            if (_smokeMode)
            {
                _smokeTimer = new Timer { Interval = 20000 };
                _smokeTimer.Tick += (sender, args) =>
                {
                    TraceStartup("SMOKE", "TIMEOUT");
                    Close();
                };
                _smokeTimer.Start();
            }
        }

        private void TraceStartup(string phase, string code)
        {
            if (_startupEvents.Count >= 40) return;
            _startupEvents.Add(new Dictionary<string, object>
            {
                ["phase"] = phase, ["code"] = code,
                ["elapsed_ms"] = _startupClock.ElapsedMilliseconds
            });
        }

        private async Task VerifySceneAsync(bool navigationSucceeded, string browserError)
        {
            TraceStartup("NAVIGATION_COMPLETED", navigationSucceeded ? "SUCCESS" : browserError);
            if (!navigationSucceeded) { _status.Text = "Không tải được trang mẫu: " + browserError; _export.Enabled = true; return; }
            try
            {
                // A successful about:blank navigation does not prove the canvas is available.
                var marker = await _browser.CoreWebView2.ExecuteScriptAsync(
                    "Boolean(document.getElementById('board') && document.getElementById('board').getContext('2d'))");
                if (marker != "true")
                {
                    TraceStartup("DOM_VERIFY", "CANVAS_NOT_READY");
                    _status.Text = "Trang tải nhưng chưa có vùng mẫu. Bấm Mẫu mới hoặc xuất log khởi tạo.";
                    _export.Enabled = true;
                    _next.Enabled = true;
                    return;
                }
                TraceStartup("DOM_VERIFY", "CANVAS_READY");
                _ready = true;
                _select.Enabled = !_busy;
                _test.Enabled = !_roi.IsEmpty && !_tested && !_busy;
                _next.Enabled = !_busy && _reports.Count < MaxTests;
                _status.Text = "Trang offline đã tạo. Nhấn Chọn vùng, sau đó Kéo thật 1 lần.";
                if (_smokeMode) { SmokePassed = true; Close(); }
            }
            catch (Exception ex)
            {
                TraceStartup("DOM_VERIFY_ERROR", ex.GetType().Name + "_" + ex.HResult.ToString("X8"));
                _status.Text = "Lỗi kiểm tra trang mẫu. Bấm Lưu ZIP chẩn đoán để gửi mã lỗi.";
                _export.Enabled = true;
                _next.Enabled = true;
            }
        }

        private async Task InitializeAsync()
        {
            _next.Enabled = false;
            TraceStartup("INITIALIZE", "START");
            try
            {
                await _browser.EnsureCoreWebView2Async();
                TraceStartup("INITIALIZE", "WEBVIEW2_READY");
                _browser.ZoomFactor = 1;
                _browser.CoreWebView2.Profile.IsPasswordAutosaveEnabled = false;
                _browser.CoreWebView2.Profile.IsGeneralAutofillEnabled = false;
                _browser.CoreWebView2.NewWindowRequested += (sender, args) => args.Handled = true;
                _browser.CoreWebView2.NavigationStarting += (sender, args) =>
                {
                    // NavigateToString is about:blank. Never permit navigation to the WMS or any site.
                    if (!string.Equals(args.Uri, "about:blank", StringComparison.OrdinalIgnoreCase))
                    {
                        args.Cancel = true;
                        TraceStartup("NAVIGATION_BLOCKED", "NON_LOCAL_PAGE");
                    }
                };
                _browser.CoreWebView2.NavigationCompleted += async (sender, args) =>
                    await VerifySceneAsync(args.IsSuccess, args.WebErrorStatus.ToString());
                NewSample();
            }
            catch (Exception ex)
            {
                TraceStartup("INITIALIZE_ERROR", ex.GetType().Name + "_" + ex.HResult.ToString("X8"));
                _status.Text = "Không tạo được trang thử offline. Bấm Lưu ZIP chẩn đoán để gửi mã lỗi.";
                _export.Enabled = true;
                _next.Enabled = _browser.CoreWebView2 != null;
            }
        }

        private void NewSample()
        {
            if (_busy || _browser.CoreWebView2 == null || _reports.Count >= MaxTests) return;
            _sourceX = 165 + _random.Next(0, 26);
            _targetX = 425 + _random.Next(0, 180);
            _pieceY = 215 + _random.Next(0, 20);
            _ready = false;
            _tested = false;
            _next.Enabled = _test.Enabled = _select.Enabled = false;
            TraceStartup("NEW_SAMPLE", "NAVIGATION_REQUESTED");
            try
            {
                _browser.CoreWebView2.NavigateToString(SampleHtml
                    .Replace("__SOURCE_X__", _sourceX.ToString(CultureInfo.InvariantCulture))
                    .Replace("__TARGET_X__", _targetX.ToString(CultureInfo.InvariantCulture))
                    .Replace("__PIECE_Y__", _pieceY.ToString(CultureInfo.InvariantCulture)));
                _status.Text = "Đang tạo mẫu offline; vùng chọn có thể sai lệch tối đa 16 px.";
            }
            catch (Exception ex)
            {
                TraceStartup("NEW_SAMPLE_ERROR", ex.GetType().Name + "_" + ex.HResult.ToString("X8"));
                _status.Text = "Không tạo được mẫu. Lưu ZIP chẩn đoán hoặc nhấn Mẫu mới.";
                _next.Enabled = _export.Enabled = true;
            }
        }

        // All pixels and input belong to this fixed, synthetic test page.
        private static readonly string SampleHtml = @"
<!doctype html><html><head><meta charset='utf-8'>
<style>html,body{margin:0;padding:0;overflow:hidden;background:#f2f4f7}
canvas{display:block;width:1178px;height:600px}</style></head>
<body><canvas id='board' width='1178' height='600'></canvas><script>
(function(){
 const canvas=document.getElementById('board'), ctx=canvas.getContext('2d');
 const sx=__SOURCE_X__,tx=__TARGET_X__,py=__PIECE_Y__,size=46;
 let px=sx,drag=false,shift=0;
 function draw(){
   ctx.fillStyle='#f2f4f7';ctx.fillRect(0,0,1178,600);
   ctx.fillStyle='#333';ctx.font='20px sans-serif';
   ctx.fillText('LOCAL TEST ONLY - Browser mouse drag, no WMS/CAPTCHA',75,75);
   ctx.fillText('Keo o xanh toi khung cam',75,110);
   ctx.strokeStyle='#bbbbbb';ctx.lineWidth=3;ctx.beginPath();
   ctx.moveTo(100,py+size/2);ctx.lineTo(760,py+size/2);ctx.stroke();
   ctx.strokeStyle='#ed7a18';ctx.lineWidth=5;ctx.strokeRect(tx,py,size,size);
   ctx.fillStyle='#1e69aa';ctx.fillRect(px,py,size,size);
   ctx.fillStyle='#555';ctx.font='14px sans-serif';
   ctx.fillText('Trang nay chi thu luong input chuot tren WebView2.',75,360);
 }
 canvas.addEventListener('mousedown',e=>{
   if(e.clientX>=px && e.clientX<=px+size && e.clientY>=py && e.clientY<=py+size){
     drag=true;shift=e.clientX-px;
   }
 });
 canvas.addEventListener('mousemove',e=>{
   if(drag){px=Math.max(75,Math.min(850,e.clientX-shift));draw();}
 });
 window.addEventListener('mouseup',e=>{if(drag){drag=false;draw();}});
 draw();
})();
</script></body></html>";

        private async Task<byte[]> ScreenshotAsync()
        {
            using (var stream = new MemoryStream())
            {
                await _browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
                return stream.ToArray();
            }
        }

        private async Task SelectRegionAsync()
        {
            if (!_ready || _busy || _tested) return;
            _select.Enabled = false;
            try
            {
                var png = await ScreenshotAsync();
                using (var stream = new MemoryStream(png))
                using (var image = new Bitmap(stream))
                using (var crop = new CropForm(new Bitmap(image)))
                {
                    if (crop.ShowDialog(this) != DialogResult.OK || crop.Cropped == null) return;
                    var region = crop.SelectedBounds;
                    using (crop.Cropped)
                    {
                        if (region.Width < 120 || region.Height < 95 ||
                            region.Right > image.Width || region.Bottom > image.Height)
                        {
                            _status.Text = "Vùng chọn không hợp lệ, chọn lại.";
                            return;
                        }
                    }
                    _roi = region;
                    _imageSize = image.Size;
                    _status.Text = "Vùng " + region.Width + "x" + region.Height +
                        " px đã chọn, biên dung sai " + RoiPadding + " px. Nhấn Kéo thật 1 lần.";
                    _test.Enabled = true;
                }
            }
            catch (Exception) { _status.Text = "Không lấy được ảnh mẫu. Không thử kéo."; }
            finally { _select.Enabled = _ready && !_busy && !_tested; }
        }

        private async Task TestOnceAsync()
        {
            if (!_ready || _busy || _tested || _roi.IsEmpty || _reports.Count >= MaxTests) return;
            _tested = true; // One attempt per explicit sample, regardless of any failure.
            _busy = true;
            _test.Enabled = _next.Enabled = _select.Enabled = false;
            var report = new Dictionary<string, object>
            {
                ["sequence"] = _reports.Count + 1,
                ["synthetic_page_only"] = true,
                ["browser_input_sent"] = false,
                ["reason"] = "NOT_ATTEMPTED",
                ["roi_xywh"] = new[] { _roi.X, _roi.Y, _roi.Width, _roi.Height },
                ["roi_padding_px"] = RoiPadding,
                ["mouse_path_css_xy_ms"] = new List<int[]>()
            };
            byte[] before = null, after = null;
            try
            {
                before = await ScreenshotAsync();
                var imageSize = ImageDimensions(before);
                report["screenshot_wh_px"] = new[] { imageSize.Width, imageSize.Height };
                if (imageSize != _imageSize)
                {
                    report["reason"] = "SCREENSHOT_DIMENSIONS_CHANGED";
                    return;
                }
                if (!TryLocate(before, _roi, out var source, out var target, out var reason))
                {
                    report["reason"] = reason;
                    return;
                }
                report["predicted_source_xy_px"] = new[] { source.X, source.Y };
                report["predicted_target_xy_px"] = new[] { target.X, target.Y };
                report["predicted_delta_x_px"] = target.X - source.X;
                report["synthetic_reference_delta_x_px"] = _targetX - _sourceX;
                report["predicted_reference_error_px"] = (target.X - source.X) - (_targetX - _sourceX);
                var cssW = await CssDimensionAsync("window.innerWidth");
                var cssH = await CssDimensionAsync("window.innerHeight");
                if (cssW <= 0 || cssH <= 0) { report["reason"] = "CSS_DIMENSION_UNAVAILABLE"; return; }
                var scaleX = cssW / imageSize.Width;
                var scaleY = cssH / imageSize.Height;
                var x = source.X * scaleX;
                var y = source.Y * scaleY;
                var endX = target.X * scaleX;
                var stopwatch = Stopwatch.StartNew();
                var path = (List<int[]>)report["mouse_path_css_xy_ms"];
                await SendMouseAsync("mouseMoved", x, y, false, stopwatch, path);
                await SendMouseAsync("mousePressed", x, y, true, stopwatch, path);
                report["browser_input_sent"] = true;
                const int steps = 24;
                try
                {
                    for (var i = 1; i <= steps; i++)
                    {
                        var t = (double)i / steps;
                        var eased = t * t * (3 - 2 * t);
                        await SendMouseAsync("mouseMoved", x + (endX - x) * eased, y, true, stopwatch, path);
                        await Task.Delay(40);
                    }
                }
                finally
                {
                    // Release once even when a move fails; never auto-retry the challenge.
                    await SendMouseAsync("mouseReleased", endX, y, false, stopwatch, path);
                }
                report["mouse_path_ack_count"] = path.Count;
                await Task.Delay(220);
                after = await ScreenshotAsync();
                if (!TryLocateBlue(after, _roi, out var observed))
                {
                    report["reason"] = "OBSERVED_SOURCE_NOT_FOUND";
                    return;
                }
                report["observed_xy_px"] = new[] { observed.X, observed.Y };
                report["observed_travel_x_px"] = observed.X - source.X;
                report["observed_target_error_px"] = observed.X - target.X;
                report["result"] = Math.Abs(observed.X - target.X) <= 5 ? "LOCAL_DRAG_PASS" : "LOCAL_DRAG_FAIL";
                report["reason"] = "DRAG_SENT_AND_OBSERVED";
            }
            catch (Exception)
            {
                report["reason"] = "TEST_EXECUTION_ERROR";
            }
            finally
            {
                report["browser_input_sent"] = report["browser_input_sent"];
                _reports.Add(report);
                _images.Add(Tuple.Create(before, after));
                _busy = false;
                _next.Enabled = _reports.Count < MaxTests;
                _export.Enabled = _reports.Count > 0;
                _status.Text = "Lượt " + _reports.Count + ": " + report["reason"] +
                    (report.ContainsKey("result") ? " / " + report["result"] : "") +
                    ". Xuất ZIP hoặc chọn Mẫu mới.";
            }
        }

        private async Task<double> CssDimensionAsync(string expression)
        {
            var raw = await _browser.CoreWebView2.ExecuteScriptAsync(expression);
            double result;
            return double.TryParse(raw.Trim('"'), NumberStyles.Float,
                CultureInfo.InvariantCulture, out result) ? result : 0;
        }

        private async Task SendMouseAsync(string kind, double x, double y, bool down,
            Stopwatch clock, List<int[]> path)
        {
            await _browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",
                _json.Serialize(new Dictionary<string, object>
                {
                    ["type"] = kind,
                    ["x"] = Math.Round(x, 2),
                    ["y"] = Math.Round(y, 2),
                    ["button"] = down || kind == "mouseReleased" ? "left" : "none",
                    ["buttons"] = down ? 1 : 0,
                    ["clickCount"] = kind == "mousePressed" ? 1 : 0
                }));
            path.Add(new[] { kind == "mousePressed" ? 1 : kind == "mouseReleased" ? 3 : 2,
                (int)Math.Round(x), (int)Math.Round(y), (int)clock.ElapsedMilliseconds });
        }

        private static Size ImageDimensions(byte[] png)
        {
            using (var stream = new MemoryStream(png))
            using (var bitmap = new Bitmap(stream)) return bitmap.Size;
        }

        private static bool TryLocateBlue(byte[] png, Rectangle roi, out Point result)
        {
            Point ignore;
            string reason;
            return TryDetect(png, roi, out result, out ignore, out reason, true);
        }

        private static bool TryLocate(byte[] png, Rectangle roi, out Point source, out Point target,
            out string reason)
        {
            return TryDetect(png, roi, out source, out target, out reason, false);
        }

        private static bool TryDetect(byte[] png, Rectangle roi, out Point source, out Point target,
            out string reason, bool sourceOnly)
        {
            source = target = Point.Empty;
            reason = "IMAGE_UNAVAILABLE";
            if (png == null || png.Length < 100) return false;
            using (var image = Cv2.ImDecode(png, ImreadModes.Color))
            {
                if (image.Empty()) return false;
                var expanded = Rectangle.Intersect(
                    new Rectangle(0, 0, image.Width, image.Height),
                    Rectangle.FromLTRB(roi.Left - RoiPadding, roi.Top - RoiPadding,
                        roi.Right + RoiPadding, roi.Bottom + RoiPadding));
                if (expanded.Width < 120 || expanded.Height < 95)
                { reason = "ROI_TOO_SMALL"; return false; }
                using (var cut = new Mat(image, new OpenCvSharp.Rect(
                    expanded.X, expanded.Y, expanded.Width, expanded.Height)))
                using (var blue = new Mat())
                using (var orange = new Mat())
                {
                    Cv2.InRange(cut, new Scalar(140, 80, 0), new Scalar(220, 150, 80), blue);
                    Cv2.InRange(cut, new Scalar(0, 95, 205), new Scalar(70, 160, 255), orange);
                    var blues = CandidateCenters(blue, expanded.Location);
                    var oranges = CandidateCenters(orange, expanded.Location);
                    if (blues.Count != 1) { reason = "SOURCE_AMBIGUOUS_OR_MISSING"; return false; }
                    source = blues[0];
                    if (sourceOnly) { reason = "READY"; return true; }
                    if (oranges.Count != 1) { reason = "TARGET_AMBIGUOUS_OR_MISSING"; return false; }
                    target = oranges[0];
                    if (target.X - source.X < 80) { reason = "INVALID_DISTANCE"; return false; }
                    reason = "READY";
                    return true;
                }
            }
        }

        private static List<Point> CandidateCenters(Mat mask, Point origin)
        {
            OpenCvSharp.Point[][] contours;
            HierarchyIndex[] hierarchy;
            Cv2.FindContours(mask, out contours, out hierarchy, RetrievalModes.External,
                ContourApproximationModes.ApproxSimple);
            return contours.Select(Cv2.BoundingRect)
                .Where(r => r.Width >= 38 && r.Width <= 65 &&
                            r.Height >= 38 && r.Height <= 65)
                .Select(r => new Point(origin.X + r.X + r.Width / 2,
                    origin.Y + r.Y + r.Height / 2)).ToList();
        }

        internal static bool NativeSmoke()
        {
            using (var image = new Mat(new OpenCvSharp.Size(1178, 600),
                MatType.CV_8UC3, new Scalar(247, 244, 242)))
            {
                Cv2.Rectangle(image, new OpenCvSharp.Rect(170, 225, 46, 46),
                    new Scalar(170, 105, 30), -1);
                Cv2.Rectangle(image, new OpenCvSharp.Rect(490, 225, 46, 46),
                    new Scalar(24, 122, 237), 5);
                byte[] png;
                Cv2.ImEncode(".png", image, out png);
                foreach (var shift in new[] { -15, 0, 15 })
                {
                    Point source, target;
                    string reason;
                    if (!TryLocate(png, new Rectangle(120 + shift, 170 + shift, 520, 160),
                        out source, out target, out reason)) return false;
                    if (Math.Abs(source.X - 193) > 2 || Math.Abs(target.X - 513) > 2)
                        return false;
                }
                return true;
            }
        }

        private void Export()
        {
            if (_busy || (_reports.Count == 0 && _startupEvents.Count == 0)) return;
            using (var dialog = new SaveFileDialog
            {
                Filter = "ZIP chẩn đoán (*.zip)|*.zip",
                FileName = "puzzle-browser-drag-v23.zip", AddExtension = true
            })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    using (var file = File.Create(dialog.FileName))
                    using (var zip = new ZipArchive(file, ZipArchiveMode.Create))
                    {
                        var data = new Dictionary<string, object>
                        {
                            ["schema"] = "supra-v23-real-browser-input-offline-synthetic",
                            ["real_browser_mouse_input"] = true,
                            ["actual_wms_auth_challenge"] = false,
                            ["test_count"] = _reports.Count,
                            ["tests"] = _reports,
                            ["startup_events"] = _startupEvents,
                            ["canvas_ready"] = _ready
                        };
                        WriteZip(zip, "puzzle-browser-drag-v23.json",
                            Encoding.UTF8.GetBytes(_json.Serialize(data)));
                        for (var i = 0; i < _images.Count; i++)
                        {
                            var pair = _images[i];
                            if (pair.Item1 != null)
                                WriteZip(zip, "attempt-" + (i + 1).ToString("D2") + "-before.png", pair.Item1);
                            if (pair.Item2 != null)
                                WriteZip(zip, "attempt-" + (i + 1).ToString("D2") + "-after.png", pair.Item2);
                        }
                    }
                    _status.Text = "ZIP lưu cục bộ. Có thể gửi để phân tích đường kéo và sai lệch.";
                }
                catch (Exception) { _status.Text = "Không ghi được ZIP; không tự gửi hoặc thử lại."; }
            }
        }

        private static void WriteZip(ZipArchive zip, string name, byte[] content)
        {
            var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
            using (var output = entry.Open()) output.Write(content, 0, content.Length);
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            _smokeTimer?.Stop();
            _smokeTimer?.Dispose();
            _images.Clear();
            _reports.Clear();
            _browser.Dispose();
            try { if (Directory.Exists(_profileRoot)) Directory.Delete(_profileRoot, true); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            base.OnFormClosed(e);
        }
    }
}
