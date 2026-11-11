using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SupraPuzzleRecorder
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            // CI smoke does not start WebView2 or a persistent browser process.
            if (args.Length == 1 && args[0] == "--startup-smoke") return;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new RecorderForm());
        }
    }

    internal sealed class RecorderForm : Form
    {
        private readonly WebView2 _browser = new WebView2();
        private readonly TextBox _url = new TextBox();
        private readonly Button _open = new Button { Text = "Mở URL" };
        private readonly Button _start = new Button { Text = "Bắt đầu", Enabled = false };
        private readonly Button _stop = new Button { Text = "Kết thúc", Enabled = false };
        private readonly Button _export = new Button { Text = "Lưu log", Enabled = false };
        private readonly Button _crop = new Button { Text = "Chụp vùng trò chơi", Enabled = false };
        private readonly Label _status = new Label { Text = "Đang khởi tạo WebView2 ...", AutoEllipsis = true };
        private readonly List<Dictionary<string, object>> _drags = new List<Dictionary<string, object>>();
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer { MaxJsonLength = 2 * 1024 * 1024 };
        private readonly string _profileRoot = Path.Combine(Path.GetTempPath(), "SUPRA-Puzzle-Recorder-V1", Guid.NewGuid().ToString("N"));
        private bool _recording;
        private int _count;

        internal RecorderForm()
        {
            Text = "SUPRA | Puzzle Recorder V1 — Chỉ ghi thao tác kéo";
            Width = 1200;
            Height = 800;
            MinimumSize = new Size(850, 520);
            StartPosition = FormStartPosition.CenterScreen;
            var toolbar = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 1, ColumnCount = 6, Padding = new Padding(6), Height = 44 };
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            for (var i = 0; i < 5; i++) toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, i == 4 ? 155 : 92));
            _url.Dock = DockStyle.Fill;
            _url.Text = "https://";
            toolbar.Controls.Add(_url, 0, 0);
            var actions = new[] { _open, _start, _stop, _export, _crop };
            for (var i = 0; i < actions.Length; i++)
            {
                actions[i].Dock = DockStyle.Fill;
                toolbar.Controls.Add(actions[i], i + 1, 0);
            }
            var root = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1 };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
            _browser.Dock = DockStyle.Fill;
            _browser.CreationProperties = new CoreWebView2CreationProperties
            {
                UserDataFolder = _profileRoot,
                ProfileName = "PuzzleRecorder",
                IsInPrivateModeEnabled = true
            };
            _status.Dock = DockStyle.Fill;
            _status.TextAlign = ContentAlignment.MiddleLeft;
            root.Controls.Add(toolbar, 0, 0);
            root.Controls.Add(_browser, 0, 1);
            root.Controls.Add(_status, 0, 2);
            Controls.Add(root);
            _url.KeyDown += (sender, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Navigate(); } };
            _open.Click += (sender, e) => Navigate();
            _start.Click += (sender, e) => StartRecording();
            _stop.Click += (sender, e) => StopRecording();
            _export.Click += (sender, e) => ExportLog();
            _crop.Click += async (sender, e) => await CaptureCropAsync();
            Shown += async (sender, e) => await InitializeAsync();
        }

        private async System.Threading.Tasks.Task InitializeAsync()
        {
            try
            {
                await _browser.EnsureCoreWebView2Async();
                _browser.CoreWebView2.Profile.IsPasswordAutosaveEnabled = false;
                _browser.CoreWebView2.Profile.IsGeneralAutofillEnabled = false;
                _browser.CoreWebView2.Settings.IsWebMessageEnabled = true;
                _browser.CoreWebView2.WebMessageReceived += (sender, args) => ReadMessage(args.WebMessageAsJson);
                _browser.CoreWebView2.FrameCreated += (sender, args) =>
                {
                    args.Frame.WebMessageReceived += (frame, message) => ReadMessage(message.WebMessageAsJson);
                };
                _browser.CoreWebView2.NewWindowRequested += (sender, args) =>
                {
                    args.Handled = true;
                    if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) && IsWebUrl(uri))
                        _browser.CoreWebView2.Navigate(uri.AbsoluteUri);
                };
                using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("RecorderScript.js"))
                using (var reader = new StreamReader(resource ?? throw new InvalidOperationException("Missing recorder script")))
                    await _browser.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(reader.ReadToEnd());
                _start.Enabled = true;
                _crop.Enabled = true;
                _status.Text = "Sẵn sàng. Đăng nhập nếu cần; chỉ ấn Bắt đầu khi trò chơi xuất hiện.";
            }
            catch (Exception)
            {
                _status.Text = "Không khởi tạo được WebView2. Kiểm tra Microsoft Edge WebView2 Runtime.";
                MessageBox.Show(this, "Không thể khởi tạo WebView2 Runtime.", "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static bool IsWebUrl(Uri uri) => uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;

        private void Navigate()
        {
            if (_browser.CoreWebView2 == null) return;
            if (!Uri.TryCreate(_url.Text.Trim(), UriKind.Absolute, out var uri) || !IsWebUrl(uri))
            {
                MessageBox.Show(this, "Chỉ hỗ trợ URL http:// hoặc https://", "URL không hợp lệ");
                return;
            }
            // URLs are used for navigation only. They are never copied into the session log.
            _browser.CoreWebView2.Navigate(uri.AbsoluteUri);
            _status.Text = "Đang mở trang (URL không được ghi log).";
        }

        private void StartRecording()
        {
            _drags.Clear();
            _count = 0;
            _recording = true;
            _start.Enabled = false;
            _stop.Enabled = true;
            _export.Enabled = false;
            _status.Text = "ĐANG GHI: chỉ các thao tác kéo chuột, không ghi phím gõ, URL, hình ảnh hoặc dữ liệu đăng nhập.";
        }

        private void StopRecording()
        {
            _recording = false;
            _start.Enabled = true;
            _stop.Enabled = false;
            _export.Enabled = true;
            _status.Text = $"Đã kết thúc. Ghi nhận {_count} lần kéo. Lưu log để gửi phân tích.";
        }

        private void ReadMessage(string raw)
        {
            if (!_recording || _drags.Count >= 60 || raw == null || raw.Length > 16000) return;
            try
            {
                var input = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (input == null || !input.TryGetValue("kind", out var kind) || (string)kind != "supra-drag-v1") return;
                var size = ReadPair(input, "viewport", 20000);
                var samples = input["points"] as object[];
                if (size == null || samples == null || samples.Length < 2 || samples.Length > 121) return;
                var rows = new List<int[]>();
                foreach (var sample in samples)
                {
                    if (!(sample is object[] values) || values.Length != 3) return;
                    var x = SafeInt(values[0], 20000);
                    var y = SafeInt(values[1], 20000);
                    var t = SafeInt(values[2], 3600000);
                    if (x == null || y == null || t == null) return;
                    rows.Add(new[] { x.Value, y.Value, t.Value });
                }
                var frame = input.TryGetValue("frame", out var rawFrame) && rawFrame as string == "child" ? "child" : "main";
                var scale = input.TryGetValue("scale", out var rawScale) ? Convert.ToDouble(rawScale) : 1;
                if (scale < 0.5 || scale > 10) scale = 1;
                _drags.Add(new Dictionary<string, object>
                {
                    ["viewport_css_px"] = size,
                    ["device_pixel_ratio"] = Math.Round(scale, 2),
                    ["frame"] = frame,
                    ["points_x_y_ms"] = rows
                });
                _count++;
                _status.Text = $"ĐANG GHI: {_count} lần kéo (không ghi nội dung trang).";
            }
            catch (Exception) { /* Untrusted page messages are ignored; never log raw payloads. */ }
        }

        private static int? SafeInt(object value, int limit)
        {
            try
            {
                var d = Convert.ToDouble(value);
                if (double.IsNaN(d) || double.IsInfinity(d) || Math.Abs(d) > limit) return null;
                return (int)Math.Round(d);
            }
            catch (Exception) { return null; }
        }

        private static int[] ReadPair(Dictionary<string, object> input, string key, int limit)
        {
            if (!input.TryGetValue(key, out var value) || !(value is object[] arr) || arr.Length != 2) return null;
            var a = SafeInt(arr[0], limit);
            var b = SafeInt(arr[1], limit);
            return a.HasValue && b.HasValue ? new[] { a.Value, b.Value } : null;
        }

        private void ExportLog()
        {
            if (_recording) return;
            using (var dialog = new SaveFileDialog
            {
                Filter = "JSON an toàn (*.json)|*.json", FileName = "puzzle-drag-v1.json", AddExtension = true
            })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                var output = new Dictionary<string, object>
                {
                    ["schema"] = "supra-puzzle-drag-v1",
                    ["privacy"] = "geometry-only; no URL, user, password, token, typed characters, cookies or DOM content",
                    ["drag_count"] = _drags.Count,
                    ["drags"] = _drags
                };
                File.WriteAllText(dialog.FileName, _json.Serialize(output), new UTF8Encoding(false));
                _status.Text = "Đã lưu log cục bộ theo vị trí anh chọn. Không tự gửi dữ liệu.";
            }
        }

        private async System.Threading.Tasks.Task CaptureCropAsync()
        {
            if (_browser.CoreWebView2 == null) return;
            _crop.Enabled = false;
            try
            {
                using (var data = new MemoryStream())
                {
                    await _browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, data);
                    data.Position = 0;
                    using (var image = Image.FromStream(data))
                    using (var cropper = new CropForm(new Bitmap(image)))
                    {
                        if (cropper.ShowDialog(this) != DialogResult.OK || cropper.Cropped == null) return;
                        using (var save = new SaveFileDialog { Filter = "PNG (*.png)|*.png", FileName = "puzzle-only.png", AddExtension = true })
                        {
                            if (save.ShowDialog(this) != DialogResult.OK) return;
                            using (var crop = cropper.Cropped) crop.Save(save.FileName, System.Drawing.Imaging.ImageFormat.Png);
                            _status.Text = "Đã lưu phần ảnh anh chọn. Kiểm tra ảnh trước khi gửi để tránh lộ thông tin.";
                        }
                    }
                }
            }
            catch (Exception) { _status.Text = "Không thể chụp vùng trò chơi trên trang hiện tại."; }
            finally { _crop.Enabled = true; }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            _recording = false;
            _drags.Clear();
            _browser.Dispose();
            try { if (Directory.Exists(_profileRoot)) Directory.Delete(_profileRoot, true); }
            catch (IOException) { /* Browser subprocess may still be closing. InPrivate remains enabled. */ }
            catch (UnauthorizedAccessException) { /* No credential-bearing logs are written by the app. */ }
            base.OnFormClosed(e);
        }
    }

    internal sealed class CropForm : Form
    {
        private readonly Bitmap _source;
        private readonly PictureBox _preview = new PictureBox { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom };
        private Point _anchor;
        private Rectangle _selection;
        private bool _dragging;
        internal Bitmap Cropped { get; private set; }

        internal CropForm(Bitmap image)
        {
            _source = image;
            Text = "Chỉ chọn VÙNG TRÒ CHƠI (không chọn nội dung tài khoản)";
            Width = 1000;
            Height = 750;
            var ok = new Button { Text = "Lưu phần đã chọn", Dock = DockStyle.Right, Width = 165 };
            var bottom = new Panel { Dock = DockStyle.Bottom, Height = 42 };
            bottom.Controls.Add(ok);
            Controls.Add(_preview);
            Controls.Add(bottom);
            _preview.Image = _source;
            _preview.MouseDown += (sender, e) => { _anchor = e.Location; _dragging = true; _selection = Rectangle.Empty; };
            _preview.MouseMove += (sender, e) =>
            {
                if (!_dragging) return;
                _selection = Rectangle.FromLTRB(Math.Min(_anchor.X, e.X), Math.Min(_anchor.Y, e.Y),
                    Math.Max(_anchor.X, e.X), Math.Max(_anchor.Y, e.Y));
                _preview.Invalidate();
            };
            _preview.MouseUp += (sender, e) => { _dragging = false; _preview.Invalidate(); };
            _preview.Paint += (sender, e) =>
            {
                if (_selection.Width > 2 && _selection.Height > 2)
                    using (var pen = new Pen(Color.Red, 2)) e.Graphics.DrawRectangle(pen, _selection);
            };
            ok.Click += (sender, e) => SaveSelection();
        }

        private void SaveSelection()
        {
            var scale = Math.Min((double)_preview.ClientSize.Width / _source.Width,
                (double)_preview.ClientSize.Height / _source.Height);
            var shownW = _source.Width * scale;
            var shownH = _source.Height * scale;
            var offsetX = (_preview.ClientSize.Width - shownW) / 2;
            var offsetY = (_preview.ClientSize.Height - shownH) / 2;
            var x1 = Math.Max(0, Math.Min(_source.Width, (int)Math.Floor((_selection.Left - offsetX) / scale)));
            var y1 = Math.Max(0, Math.Min(_source.Height, (int)Math.Floor((_selection.Top - offsetY) / scale)));
            var x2 = Math.Max(0, Math.Min(_source.Width, (int)Math.Ceiling((_selection.Right - offsetX) / scale)));
            var y2 = Math.Max(0, Math.Min(_source.Height, (int)Math.Ceiling((_selection.Bottom - offsetY) / scale)));
            if (x2 - x1 < 15 || y2 - y1 < 15)
            {
                MessageBox.Show(this, "Kéo để chọn vùng trò chơi đủ lớn.");
                return;
            }
            Cropped = _source.Clone(new Rectangle(x1, y1, x2 - x1, y2 - y1), _source.PixelFormat);
            DialogResult = DialogResult.OK;
            Close();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) _source.Dispose();
            base.Dispose(disposing);
        }
    }
}