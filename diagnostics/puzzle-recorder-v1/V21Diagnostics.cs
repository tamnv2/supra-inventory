using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace SupraPuzzleRecorder
{
    internal sealed class V21Evidence
    {
        internal int Number;
        internal Rectangle Region;
        internal Dictionary<string, object> Test;
        internal byte[] BeforePng;
        internal byte[] AfterPng;
        internal bool UserApproved;
        internal List<int[]> AcknowledgedEvents = new List<int[]>();
        internal Stopwatch GestureClock = Stopwatch.StartNew();
    }

    internal sealed partial class RecorderForm
    {
        private readonly Button _v21ChooseRegion = new Button
            { Text = "Chọn vùng trò chơi", Width = 155, Enabled = false };
        private readonly Button _v21Bundle = new Button
            { Text = "Lưu bộ chẩn đoán", Width = 154, Enabled = false };
        private readonly Button _v23Sim = new Button
            { Text = "Phòng thử kéo thật (offline)", Width = 206 };
        private readonly List<V21Evidence> _v21Evidence = new List<V21Evidence>();
        private Rectangle _v21Region = Rectangle.Empty;
        private V21Evidence _v21Active;

        private Control V21CreateToolbar()
        {
            var bar = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight,
                WrapContents = false, Padding = new Padding(7, 1, 4, 0)
            };
            bar.Controls.Add(_v21ChooseRegion);
            bar.Controls.Add(_v22Inspect);
            bar.Controls.Add(_v22Export);
            bar.Controls.Add(_v23Sim);
            bar.Controls.Add(_v21Bundle);
            _v21Bundle.Visible = false; // V2.3 has no live Test; retain V2.1 evidence code but hide its inactive action.
            var label = new Label
            {
                Text = "Ảnh chỉ lưu khi duyệt vùng đã cắt; không ghi URL, tài khoản hoặc token.",
                AutoSize = true, Padding = new Padding(8, 7, 0, 0)
            };
            bar.Controls.Add(label);
            _v21ChooseRegion.Click += async (sender, args) => await V21SelectRegionAsync();
            _v22Inspect.Click += async (sender, args) => await V22InspectRegionAsync();
            _v22Export.Click += (sender, args) => V22ExportApprovedRegion();
            _v23Sim.Click += (sender, args) =>
            {
                try { using (var sim = new V23BrowserDragLab()) sim.ShowDialog(this); }
                catch (Exception ex)
                {
                    _status.Text = "Phòng thử offline không mở được: " + ex.GetType().Name +
                        " (0x" + ex.HResult.ToString("X8") + "). Không ảnh hưởng phiên Web thật.";
                }
            };
            _v21Bundle.Click += (sender, args) => V21SaveBundle();
            return bar;
        }

        private async Task V21SelectRegionAsync()
        {
            if (_browser.CoreWebView2 == null || _testing || _recording || _pendingTest != null) return;
            _v21ChooseRegion.Enabled = false;
            try
            {
                using (var stream = new MemoryStream())
                {
                    await _browser.CoreWebView2.CapturePreviewAsync(
                        CoreWebView2CapturePreviewImageFormat.Png, stream);
                    stream.Position = 0;
                    using (var original = new Bitmap(stream))
                    using (var selector = new CropForm(new Bitmap(original)))
                    {
                        if (selector.ShowDialog(this) != DialogResult.OK || selector.Cropped == null)
                            return;
                        using (var selected = selector.Cropped)
                        {
                            var roi = selector.SelectedBounds;
                            if (roi.Width < 120 || roi.Height < 95 ||
                                roi.Width > original.Width * .80 || roi.Height > original.Height * .70)
                            {
                                MessageBox.Show(this,
                                    "Chỉ chọn vùng hình ghép, không chọn toàn trang hoặc phần tài khoản.",
                                    "Vùng chọn không hợp lệ");
                                return;
                            }
                            using (var confirm = new Form
                            {
                                Text = "Kiểm tra vùng hình ghép trước khi ghi", Width = 740,
                                Height = 510, StartPosition = FormStartPosition.CenterParent
                            })
                            using (var preview = new PictureBox
                            {
                                Dock = DockStyle.Fill, Image = selected, SizeMode = PictureBoxSizeMode.Zoom
                            })
                            using (var ok = new Button
                            {
                                Text = "Xác nhận: không có thông tin nhạy cảm",
                                Dock = DockStyle.Bottom, Height = 42, DialogResult = DialogResult.OK
                            })
                            {
                                confirm.Controls.Add(preview);
                                confirm.Controls.Add(ok);
                                confirm.AcceptButton = ok;
                                if (confirm.ShowDialog(this) != DialogResult.OK) return;
                            }
                            _v21Region = roi;
                            V22SaveRegion(roi, original.Width, original.Height);
                            _status.Text = "Đã chọn vùng trò chơi " + roi.Width + "×" + roi.Height +
                                " px. Nhấn Test một lần; mỗi ảnh sẽ được kiểm tra trước khi lưu.";
                        }
                    }
                }
            }
            catch (Exception)
            {
                _status.Text = "Không chụp được vùng trò chơi. Vui lòng thử chọn vùng khác.";
            }
            finally { _v21ChooseRegion.Enabled = true; }
        }

        private bool V21StartAttempt(Dictionary<string, object> item, byte[] screenshot)
        {
            if (_v21Region.IsEmpty || _v21Evidence.Count >= 20) return false;
            try
            {
                var cropped = V21CropPng(screenshot, _v21Region);
                var evidence = new V21Evidence
                {
                    Number = _tests.Count + 1,
                    Test = item,
                    Region = _v21Region,
                    BeforePng = cropped
                };
                evidence.GestureClock.Restart();
                item["puzzle_region_x_y_w_h_px"] = new[]
                { _v21Region.X, _v21Region.Y, _v21Region.Width, _v21Region.Height };
                item["input_trace_note"] = "ACKNOWLEDGED_CDP_EVENTS_ONLY_NOT_OBSERVED_PIECE_MOTION";
                _v21Active = evidence;
                return true;
            }
            catch (Exception)
            {
                _v21Active = null;
                return false;
            }
        }

        private void V21RecordAcknowledgedMouseEvent(string type, double x, double y)
        {
            if (_v21Active == null) return;
            var kind = type == "mousePressed" ? 1 : type == "mouseReleased" ? 3 : 2;
            if (_v21Active.AcknowledgedEvents.Count >= 36) return;
            _v21Active.AcknowledgedEvents.Add(new[]
            {
                kind, (int)Math.Round(x), (int)Math.Round(y),
                (int)Math.Min(int.MaxValue, _v21Active.GestureClock.ElapsedMilliseconds)
            });
        }

        private async Task V21ReviewAttemptAsync(Dictionary<string, object> item)
        {
            var evidence = _v21Active;
            _v21Active = null;
            if (evidence == null) return;
            try
            {
                await Task.Delay(250);
                using (var stream = new MemoryStream())
                {
                    await _browser.CoreWebView2.CapturePreviewAsync(
                        CoreWebView2CapturePreviewImageFormat.Png, stream);
                    evidence.AfterPng = V21CropPng(stream.ToArray(), evidence.Region);
                }
                item["acknowledged_mouse_events_kind_x_y_ms"] = evidence.AcknowledgedEvents;
                item["input_event_kind_map"] = "1=press,2=move,3=release; timestamps relative to capture";
                var end = evidence.AcknowledgedEvents.LastOrDefault(e => e[0] == 3);
                if (end != null) item["acknowledged_release_x_y_css_px"] = new[] { end[1], end[2] };
                using (var dialog = new V21ImageReview(evidence.BeforePng, evidence.AfterPng))
                {
                    if (dialog.ShowDialog(this) == DialogResult.OK && dialog.Approved)
                    {
                        evidence.UserApproved = true;
                        var source = dialog.Source.Value;
                        var slot = dialog.Slot.Value;
                        var origin = evidence.Region;
                        var actualDelta = slot.X - source.X;
                        item["manual_source_center_x_y_px"] = new[] { origin.X + source.X, origin.Y + source.Y };
                        item["manual_slot_center_x_y_px"] = new[] { origin.X + slot.X, origin.Y + slot.Y };
                        item["manual_reference_delta_x_px"] = actualDelta;
                        if (item.TryGetValue("delta_x_px", out var estimated))
                            item["predicted_delta_error_px"] = Convert.ToInt32(estimated) - actualDelta;
                        if (dialog.AfterPoint.HasValue)
                        {
                            var p = dialog.AfterPoint.Value;
                            item["manual_observed_piece_center_x_y_px"] =
                                new[] { origin.X + p.X, origin.Y + p.Y };
                            item["manual_observed_travel_x_px"] = p.X - source.X;
                        }
                        item["puzzle_images_user_approved"] = true;
                        _status.Text = "Đã ghi vị trí thực tế lượt " + evidence.Number +
                            ". Chọn PASS/FAIL nếu đã kéo, sau đó Lưu bộ chẩn đoán.";
                    }
                    else
                    {
                        // Images are discarded immediately unless the Owner inspected and approved them.
                        evidence.BeforePng = null;
                        evidence.AfterPng = null;
                        item["puzzle_images_user_approved"] = false;
                        _status.Text = "Đã bỏ ảnh lượt " + evidence.Number +
                            "; dữ liệu hình học vẫn được giữ trong log.";
                    }
                }
            }
            catch (Exception)
            {
                evidence.BeforePng = null;
                evidence.AfterPng = null;
                item["image_review_status"] = "CAPTURE_OR_REVIEW_FAILED";
            }
            finally
            {
                _v21Evidence.Add(evidence);
                _v21Bundle.Enabled = _v21Evidence.Any(v => v.UserApproved);
            }
        }

        private static byte[] V21CropPng(byte[] png, Rectangle roi)
        {
            using (var stream = new MemoryStream(png))
            using (var source = new Bitmap(stream))
            {
                if (roi.X < 0 || roi.Y < 0 || roi.Right > source.Width || roi.Bottom > source.Height)
                    throw new ArgumentOutOfRangeException("roi");
                using (var crop = source.Clone(roi, source.PixelFormat))
                using (var output = new MemoryStream())
                {
                    crop.Save(output, ImageFormat.Png);
                    return output.ToArray();
                }
            }
        }

        private void V21AddReportMetadata(Dictionary<string, object> output)
        {
            output["diagnostic_version"] = "2.1";
            output["privacy_capture"] = "selected-puzzle-region-only, RAM until owner approved export";
            output["reviewed_image_count"] = _v21Evidence.Count(e => e.UserApproved);
            output["note"] = "manual source and target annotations define ground truth; input events are acknowledged, not physical motion proof";
        }

        private void V21SaveBundle()
        {
            if (_recording || _testing || _pendingTest != null) return;
            var approved = _v21Evidence.Where(e => e.UserApproved && e.BeforePng != null &&
                e.AfterPng != null).ToList();
            if (approved.Count == 0)
            {
                _status.Text = "Không có ảnh được duyệt. Chỉ lưu log JSON nếu không gửi ảnh.";
                return;
            }
            if (MessageBox.Show(this,
                "Lưu " + approved.Count + " lượt ảnh ĐÃ ĐƯỢC ANH KIỂM TRA cùng log tọa độ? " +
                "Chỉ các vùng trò chơi được duyệt mới vào ZIP. Kiểm tra lại ZIP trước khi gửi.",
                "Xác nhận lưu dữ liệu cục bộ",
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
            using (var dialog = new SaveFileDialog
            {
                Filter = "ZIP chẩn đoán (*.zip)|*.zip",
                FileName = "puzzle-diagnostic-v21.zip",
                AddExtension = true
            })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    var log = new Dictionary<string, object>
                    {
                        ["schema"] = "supra-puzzle-diagnostic-v21",
                        ["privacy"] = "owner-reviewed puzzle ROI only; numeric metadata, no URL/user/password/token/cookies",
                        ["test_count"] = _tests.Count,
                        ["tests"] = _tests,
                        ["drag_count"] = _drags.Count,
                        ["drags"] = _drags
                    };
                    V21AddReportMetadata(log);
                    using (var file = File.Create(dialog.FileName))
                    using (var archive = new ZipArchive(file, ZipArchiveMode.Create))
                    {
                        V21WriteEntry(archive, "puzzle-diagnostic-v21.json",
                            Encoding.UTF8.GetBytes(_json.Serialize(log)));
                        foreach (var e in approved)
                        {
                            var prefix = "attempt-" + e.Number.ToString("D2");
                            V21WriteEntry(archive, prefix + "-before.png", e.BeforePng);
                            V21WriteEntry(archive, prefix + "-after.png", e.AfterPng);
                        }
                    }
                    _status.Text = "Đã lưu ZIP tại vị trí anh chọn. Không tự gửi dữ liệu.";
                }
                catch (Exception)
                {
                    _status.Text = "Không thể lưu ZIP. Kiểm tra quyền ghi hoặc ổ đĩa.";
                }
            }
        }

        private static void V21WriteEntry(ZipArchive zip, string name, byte[] bytes)
        {
            var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
            using (var output = entry.Open()) output.Write(bytes, 0, bytes.Length);
        }

        // Deterministic Windows-native smoke for ROI crop and ZIP bytes (synthetic pixels only).
        internal static bool V21ImageSmoke()
        {
            using (var sample = new Bitmap(320, 220))
            using (var screenshot = new MemoryStream())
            {
                using (var g = Graphics.FromImage(sample)) g.Clear(Color.SteelBlue);
                sample.Save(screenshot, ImageFormat.Png);
                var crop = V21CropPng(screenshot.ToArray(), new Rectangle(75, 40, 140, 105));
                using (var croppedStream = new MemoryStream(crop))
                using (var decoded = new Bitmap(croppedStream))
                {
                    if (decoded.Width != 140 || decoded.Height != 105) return false;
                }
                using (var zipBytes = new MemoryStream())
                {
                    using (var zip = new ZipArchive(zipBytes, ZipArchiveMode.Create, true))
                        V21WriteEntry(zip, "attempt-01-before.png", crop);
                    zipBytes.Position = 0;
                    using (var zip = new ZipArchive(zipBytes, ZipArchiveMode.Read, true))
                    {
                        var entry = zip.GetEntry("attempt-01-before.png");
                        return entry != null && entry.Length == crop.Length;
                    }
                }
            }
        }

        private void V21ClearImages()
        {
            foreach (var e in _v21Evidence) { e.BeforePng = null; e.AfterPng = null; }
            _v21Evidence.Clear();
            _v21Active = null;
            _v21Region = Rectangle.Empty;
        }
    }

    internal sealed class V21ImageReview : Form
    {
        internal bool Approved { get; private set; }
        internal Point? Source { get; private set; }
        internal Point? Slot { get; private set; }
        internal Point? AfterPoint { get; private set; }

        private readonly Bitmap _before, _after;
        private readonly PictureBox _left = new PictureBox { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom };
        private readonly PictureBox _right = new PictureBox { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom };
        private readonly Label _instruction = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };

        internal V21ImageReview(byte[] before, byte[] after)
        {
            using (var ms = new MemoryStream(before))
            using (var decoded = new Bitmap(ms)) _before = new Bitmap(decoded);
            using (var ms = new MemoryStream(after))
            using (var decoded = new Bitmap(ms)) _after = new Bitmap(decoded);
            Text = "Xác nhận ảnh an toàn — đánh dấu tâm mảnh ghép và đích đúng";
            Width = 1050; Height = 580;
            MinimumSize = new Size(860, 430);
            StartPosition = FormStartPosition.CenterParent;
            var grid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1 };
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            _left.Image = _before;
            _right.Image = _after;
            grid.Controls.Add(_left, 0, 0);
            grid.Controls.Add(_right, 1, 0);
            var reset = new Button { Text = "Đánh dấu lại", Width = 110 };
            var skip = new Button { Text = "Bỏ ảnh lượt này", Width = 125, DialogResult = DialogResult.Cancel };
            var save = new Button { Text = "Xác nhận ảnh an toàn", Width = 185 };
            var buttons = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, WrapContents = false
            };
            buttons.Controls.Add(save);
            buttons.Controls.Add(skip);
            buttons.Controls.Add(reset);
            var root = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1 };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 47));
            root.Controls.Add(_instruction, 0, 0);
            root.Controls.Add(grid, 0, 1);
            root.Controls.Add(buttons, 0, 2);
            Controls.Add(root);
            _instruction.Text = "Ảnh TRƯỚC (trái): click tâm mảnh ghép, sau đó click tâm chỗ khớp. " +
                "Ảnh SAU (phải): click tâm mảnh ghép thực tế nếu còn nhìn thấy.";
            _left.MouseClick += (sender, args) =>
            {
                var pt = V21MapPoint(_left, _before, args.Location);
                if (!pt.HasValue) return;
                if (!Source.HasValue) Source = pt;
                else if (!Slot.HasValue) Slot = pt;
                else { Source = pt; Slot = null; }
                _left.Invalidate();
            };
            _right.MouseClick += (sender, args) =>
            {
                AfterPoint = V21MapPoint(_right, _after, args.Location);
                _right.Invalidate();
            };
            _left.Paint += (sender, args) =>
            {
                V21DrawPoint(args.Graphics, _left, _before, Source, Pens.Red);
                V21DrawPoint(args.Graphics, _left, _before, Slot, Pens.LimeGreen);
            };
            _right.Paint += (sender, args) => V21DrawPoint(
                args.Graphics, _right, _after, AfterPoint, Pens.Blue);
            reset.Click += (sender, args) =>
            {
                Source = Slot = AfterPoint = null;
                _left.Invalidate(); _right.Invalidate();
            };
            save.Click += (sender, args) =>
            {
                if (!Source.HasValue || !Slot.HasValue)
                {
                    MessageBox.Show(this, "Cần click tâm mảnh ghép và tâm đích trên ảnh TRƯỚC.");
                    return;
                }
                if (MessageBox.Show(this,
                    "Đã kiểm tra CẢ HAI ảnh chỉ chứa trò chơi và không có thông tin nhạy cảm?",
                    "Xác nhận bảo mật", MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning) != DialogResult.Yes) return;
                Approved = true;
                DialogResult = DialogResult.OK;
                Close();
            };
        }

        private static Point? V21MapPoint(PictureBox box, Bitmap image, Point mouse)
        {
            var scale = Math.Min((double)box.ClientSize.Width / image.Width,
                                 (double)box.ClientSize.Height / image.Height);
            if (scale <= 0) return null;
            var dx = (box.ClientSize.Width - image.Width * scale) / 2;
            var dy = (box.ClientSize.Height - image.Height * scale) / 2;
            var x = (mouse.X - dx) / scale;
            var y = (mouse.Y - dy) / scale;
            if (x < 0 || y < 0 || x >= image.Width || y >= image.Height) return null;
            return new Point((int)Math.Round(x), (int)Math.Round(y));
        }

        private static void V21DrawPoint(Graphics g, PictureBox box, Bitmap image, Point? p, Pen pen)
        {
            if (!p.HasValue) return;
            var scale = Math.Min((double)box.ClientSize.Width / image.Width,
                                 (double)box.ClientSize.Height / image.Height);
            var x = (int)Math.Round((box.ClientSize.Width - image.Width * scale) / 2 + p.Value.X * scale);
            var y = (int)Math.Round((box.ClientSize.Height - image.Height * scale) / 2 + p.Value.Y * scale);
            g.DrawEllipse(pen, x - 6, y - 6, 12, 12);
            g.DrawLine(pen, x - 11, y, x + 11, y);
            g.DrawLine(pen, x, y - 11, x, y + 11);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) { _before.Dispose(); _after.Dispose(); }
            base.Dispose(disposing);
        }
    }
}
