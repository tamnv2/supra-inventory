using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace SupraPuzzleRecorder
{
    // Passive diagnostic only. Geometry is stored locally; never persist page content or identity.
    internal sealed partial class RecorderForm
    {
        private readonly Button _v22Inspect = new Button
            { Text = "Kiểm tra vùng (không kéo)", Width = 184, Enabled = false };
        private static readonly string V22RegionPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SUPRA", "PuzzleDiagnostic", "region-v22.json");

        private static bool V22RegionFits(Rectangle roi, int width, int height)
        {
            return width > 0 && height > 0 && roi.X >= 0 && roi.Y >= 0
                && roi.Width >= 120 && roi.Height >= 95
                && roi.Width <= width * .80 && roi.Height <= height * .70
                && roi.Right <= width && roi.Bottom <= height;
        }

        private void V22SaveRegion(Rectangle roi, int width, int height)
        {
            if (!V22RegionFits(roi, width, height)) return;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(V22RegionPath));
                var geometry = new Dictionary<string, int>
                {
                    ["viewport_width"] = width,
                    ["viewport_height"] = height,
                    ["x"] = roi.X, ["y"] = roi.Y, ["width"] = roi.Width, ["height"] = roi.Height
                };
                File.WriteAllText(V22RegionPath, _json.Serialize(geometry), new UTF8Encoding(false));
            }
            catch (IOException) { /* Region still works for the current session. */ }
            catch (UnauthorizedAccessException) { /* Never write browser state as fallback. */ }
        }

        private bool V22RestoreRegion(int width, int height)
        {
            try
            {
                var saved = new FileInfo(V22RegionPath);
                if (!saved.Exists || saved.Length > 512) return false;
                var geometry = _json.Deserialize<Dictionary<string, int>>(File.ReadAllText(V22RegionPath));
                if (geometry == null || geometry["viewport_width"] != width ||
                    geometry["viewport_height"] != height) return false;
                var roi = new Rectangle(geometry["x"], geometry["y"],
                    geometry["width"], geometry["height"]);
                if (!V22RegionFits(roi, width, height)) return false;
                _v21Region = roi;
                return true;
            }
            catch (Exception) { return false; } // Malformed local geometry must never be trusted.
        }

        private async Task V22InspectRegionAsync()
        {
            if (_browser.CoreWebView2 == null || _testing || _recording || _pendingTest != null) return;
            _v22Inspect.Enabled = false;
            try
            {
                using (var frame = new MemoryStream())
                {
                    await _browser.CoreWebView2.CapturePreviewAsync(
                        CoreWebView2CapturePreviewImageFormat.Png, frame);
                    using (var screenshot = new Bitmap(frame))
                    {
                        if (_v21Region.IsEmpty && !V22RestoreRegion(screenshot.Width, screenshot.Height))
                        {
                            _status.Text = "Chưa có vùng phù hợp. Chọn vùng trò chơi và xác nhận ảnh trước.";
                            return;
                        }
                        if (!V22RegionFits(_v21Region, screenshot.Width, screenshot.Height))
                        {
                            _v21Region = Rectangle.Empty;
                            _status.Text = "Kích thước ảnh đã đổi (DPI/viewport). Chọn vùng trò chơi lại.";
                            return;
                        }
                        var pixels = V21CropPng(frame.ToArray(), _v21Region);
                        using (var cut = new MemoryStream(pixels))
                        using (var image = new Bitmap(cut))
                        using (var dialog = new Form
                        {
                            Text = "V2.2 — Chỉ kiểm tra vùng chọn, không tự kéo",
                            Width = 750, Height = 580, StartPosition = FormStartPosition.CenterParent
                        })
                        {
                            var picture = new PictureBox
                            {
                                Dock = DockStyle.Fill, Image = image, SizeMode = PictureBoxSizeMode.Zoom
                            };
                            dialog.Controls.Add(picture);
                            dialog.ShowDialog(this);
                        }
                        _status.Text = "Vùng " + _v21Region.Width + "×" + _v21Region.Height +
                            " px đúng viewport " + screenshot.Width + "×" + screenshot.Height +
                            "; không gửi thao tác chuột hoặc yêu cầu xác minh.";
                    }
                }
            }
            catch (Exception)
            {
                _status.Text = "Không kiểm tra được vùng. Không tự thử lại hoặc kéo chuột.";
            }
            finally { _v22Inspect.Enabled = true; }
        }

        // Native synthetic smoke: reject stale DPI dimensions and out-of-bounds regions.
        internal static bool V22RegionSmoke()
        {
            return V22RegionFits(new Rectangle(75, 40, 140, 105), 320, 220)
                && !V22RegionFits(new Rectangle(300, 40, 140, 105), 320, 220)
                && !V22RegionFits(new Rectangle(75, 40, 140, 105), 150, 220);
        }
    }
}
