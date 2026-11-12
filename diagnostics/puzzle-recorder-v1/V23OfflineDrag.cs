using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraPuzzleRecorder
{
    // Local synthetic scene only: never reads a WMS page or sends browser input.
    internal sealed class V23OfflineDragForm : Form
    {
        private const int StartX = 110;
        private const int TargetX = 440;
        private const int PieceY = 150;
        private const int Side = 60;
        private readonly NumericUpDown _offsetX = new NumericUpDown { Minimum = -15, Maximum = 15, Width = 65 };
        private readonly NumericUpDown _offsetY = new NumericUpDown { Minimum = -15, Maximum = 15, Width = 65 };
        private readonly Button _run = new Button { Text = "Mô phỏng kéo", Width = 125 };
        private readonly Button _export = new Button { Text = "Lưu kết quả", Width = 120, Enabled = false };
        private readonly Label _result = new Label { AutoSize = true, Padding = new Padding(10, 6, 0, 0) };
        private readonly TestCanvas _canvas = new TestCanvas { Dock = DockStyle.Fill };
        private readonly Timer _timer = new Timer { Interval = 35 };
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private int _step;
        private int _pieceX = StartX;
        private int _predictedDx;
        private bool _passed;

        internal V23OfflineDragForm()
        {
            Text = "V2.3 — Mô phỏng kéo trên hình GIẢ LẬP, không truy cập WMS";
            Size = new Size(800, 460);
            MinimumSize = new Size(740, 430);
            StartPosition = FormStartPosition.CenterParent;
            var toolbar = new FlowLayoutPanel
            {
                Dock = DockStyle.Top, Height = 45, WrapContents = false, Padding = new Padding(6)
            };
            toolbar.Controls.Add(new Label { Text = "Lệch vùng X (px)", AutoSize = true, Padding = new Padding(0, 8, 0, 0) });
            toolbar.Controls.Add(_offsetX);
            toolbar.Controls.Add(new Label { Text = "Lệch vùng Y (px)", AutoSize = true, Padding = new Padding(8, 8, 0, 0) });
            toolbar.Controls.Add(_offsetY);
            toolbar.Controls.Add(_run);
            toolbar.Controls.Add(_export);
            var bottom = new Label
            {
                Text = "Hình giả lập trong bộ nhớ. Vùng nét đứt có thể lệch ±15 px. Không có CAPTCHA/WMS hoặc lệnh chuột trình duyệt.",
                Dock = DockStyle.Bottom, Height = 35, AutoEllipsis = true
            };
            _result.Text = "Thay đổi độ lệch X/Y, sau đó nhấn Mô phỏng kéo.";
            var info = new Panel { Dock = DockStyle.Bottom, Height = 38 };
            info.Controls.Add(_result);
            Controls.Add(_canvas);
            Controls.Add(info);
            Controls.Add(bottom);
            Controls.Add(toolbar);
            _canvas.Paint += DrawScene;
            _offsetX.ValueChanged += (sender, args) => ResetScene();
            _offsetY.ValueChanged += (sender, args) => ResetScene();
            _run.Click += (sender, args) => StartSimulation();
            _export.Click += (sender, args) => ExportResult();
            _timer.Tick += (sender, args) => NextStep();
            FormClosed += (sender, args) => { _timer.Stop(); _timer.Dispose(); };
        }

        private static Rectangle RegionForOffset(int dx, int dy)
        {
            return new Rectangle(70 + dx, 110 + dy, 480, 170);
        }

        internal static bool TryPlan(Rectangle roi, Rectangle source, Rectangle target, out int delta)
        {
            delta = 0;
            if (roi.Width <= 0 || roi.Height <= 0 ||
                !roi.Contains(source) || !roi.Contains(target)) return false;
            delta = target.X + target.Width / 2 - (source.X + source.Width / 2);
            return delta > 0;
        }

        internal static bool NativeSmoke()
        {
            var source = new Rectangle(StartX, PieceY, Side, Side);
            var target = new Rectangle(TargetX, PieceY, Side, Side);
            foreach (var offset in new[] { -15, 0, 15 })
            {
                if (!TryPlan(RegionForOffset(offset, offset), source, target, out var delta)
                    || delta != 330) return false;
            }
            return !TryPlan(new Rectangle(200, 110, 200, 170), source, target, out _);
        }

        private void ResetScene()
        {
            _timer.Stop();
            _step = 0;
            _pieceX = StartX;
            _export.Enabled = false;
            _run.Enabled = true;
            _result.Text = "Chỉ kiểm tra ảnh giả lập; chưa chạy kéo.";
            _canvas.Invalidate();
        }

        private void StartSimulation()
        {
            var roi = RegionForOffset((int)_offsetX.Value, (int)_offsetY.Value);
            if (!TryPlan(roi, new Rectangle(StartX, PieceY, Side, Side),
                new Rectangle(TargetX, PieceY, Side, Side), out _predictedDx))
            {
                _result.Text = "FAIL: vùng chọn không chứa đủ nguồn và đích.";
                return;
            }
            _pieceX = StartX;
            _step = 0;
            _run.Enabled = false;
            _timer.Start();
        }

        private void NextStep()
        {
            _step++;
            _pieceX = StartX + (int)Math.Round(_predictedDx * Math.Min(20, _step) / 20.0);
            _canvas.Invalidate();
            if (_step < 20) return;
            _timer.Stop();
            _passed = Math.Abs(_pieceX - TargetX) <= 1;
            _result.Text = (_passed ? "SIM PASS" : "SIM FAIL") + ": cần kéo " +
                (TargetX - StartX) + " px, đã mô phỏng " + (_pieceX - StartX) + " px.";
            _run.Enabled = true;
            _export.Enabled = true;
        }

        private void DrawScene(object sender, PaintEventArgs e)
        {
            e.Graphics.Clear(Color.White);
            var roi = RegionForOffset((int)_offsetX.Value, (int)_offsetY.Value);
            using (var outline = new Pen(Color.DarkOrange, 2) { DashStyle = System.Drawing.Drawing2D.DashStyle.Dash })
                e.Graphics.DrawRectangle(outline, roi);
            using (var track = new Pen(Color.LightGray, 3))
                e.Graphics.DrawLine(track, StartX + 30, PieceY + 30, TargetX + 30, PieceY + 30);
            using (var target = new Pen(Color.ForestGreen, 4))
                e.Graphics.DrawRectangle(target, TargetX, PieceY, Side, Side);
            using (var brush = new SolidBrush(Color.SteelBlue))
                e.Graphics.FillRectangle(brush, _pieceX, PieceY, Side, Side);
            e.Graphics.DrawString("SOURCE", Font, Brushes.DimGray, StartX, PieceY - 25);
            e.Graphics.DrawString("TARGET", Font, Brushes.DimGray, TargetX, PieceY - 25);
        }

        private void ExportResult()
        {
            using (var dialog = new SaveFileDialog
            {
                Filter = "JSON mô phỏng (*.json)|*.json", FileName = "puzzle-simulation-v23.json",
                AddExtension = true
            })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                var roi = RegionForOffset((int)_offsetX.Value, (int)_offsetY.Value);
                var data = new Dictionary<string, object>
                {
                    ["schema"] = "supra-puzzle-synthetic-v23",
                    ["synthetic_only"] = true,
                    ["browser_input_sent"] = false,
                    ["roi_xywh"] = new[] { roi.X, roi.Y, roi.Width, roi.Height },
                    ["synthetic_expected_dx"] = TargetX - StartX,
                    ["synthetic_simulated_dx"] = _pieceX - StartX,
                    ["synthetic_pass"] = _passed
                };
                File.WriteAllText(dialog.FileName, _json.Serialize(data), new UTF8Encoding(false));
                _result.Text = "Đã lưu JSON mô phỏng; không có dữ liệu WMS.";
            }
        }

        private sealed class TestCanvas : Control
        {
            internal TestCanvas()
            {
                DoubleBuffered = true;
                BackColor = Color.White;
            }
        }
    }
}
