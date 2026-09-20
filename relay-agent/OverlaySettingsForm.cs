using System;
using System.Drawing;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed class OverlaySettingsForm : Form
    {
        private readonly StatusOverlayForm _overlay;
        private readonly TrackBar _opacity = new TrackBar();
        private readonly Label _opacityValue = new Label();
        private readonly CheckBox _locked = new CheckBox();
        private readonly NumericUpDown _width = new NumericUpDown();
        private readonly NumericUpDown _height = new NumericUpDown();
        private readonly Button _backgroundColor = new Button();
        private readonly Button _textColor = new Button();

        internal OverlaySettingsForm(StatusOverlayForm overlay)
        {
            if (overlay == null) throw new ArgumentNullException("overlay");
            _overlay = overlay;

            Text = "Cài đặt bảng nổi";
            Width = 470;
            Height = 410;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            Font = new Font("Segoe UI", 9F);

            Controls.Add(new Label { Left = 18, Top = 18, Width = 330, Height = 22, Text = "Độ trong của nền bảng nổi" });
            _opacity.SetBounds(16, 42, 350, 42);
            _opacity.Minimum = 35;
            _opacity.Maximum = 100;
            _opacity.TickFrequency = 5;
            _opacity.SmallChange = 5;
            _opacity.LargeChange = 10;
            _opacity.Value = ClampPercent((int)Math.Round(_overlay.OverlayOpacity * 100.0));
            _opacity.Scroll += (s, e) =>
            {
                _overlay.SetOverlayOpacity(_opacity.Value / 100.0);
                RefreshOpacityText();
            };
            Controls.Add(_opacity);
            _opacityValue.SetBounds(374, 48, 58, 24);
            _opacityValue.TextAlign = ContentAlignment.MiddleRight;
            Controls.Add(_opacityValue);
            RefreshOpacityText();

            _locked.SetBounds(18, 96, 410, 26);
            _locked.Text = "Khóa vị trí/kích thước và cho chuột xuyên qua bảng nổi";
            _locked.Checked = _overlay.IsLocked;
            _locked.CheckedChanged += (s, e) =>
            {
                _overlay.SetLocked(_locked.Checked);
                RefreshEditState();
            };
            Controls.Add(_locked);

            Controls.Add(new Label { Left = 18, Top = 140, Width = 100, Height = 22, Text = "Chiều rộng" });
            _width.SetBounds(118, 136, 100, 28);
            _width.Minimum = 420;
            _width.Maximum = 1600;
            _width.Value = Math.Max(_width.Minimum, Math.Min(_width.Maximum, _overlay.OverlayWidth));
            _width.ValueChanged += (s, e) => { if (!_locked.Checked) _overlay.SetOverlaySize((int)_width.Value, (int)_height.Value); };
            Controls.Add(_width);

            Controls.Add(new Label { Left = 238, Top = 140, Width = 90, Height = 22, Text = "Chiều cao" });
            _height.SetBounds(328, 136, 100, 28);
            _height.Minimum = 64;
            _height.Maximum = 360;
            _height.Value = Math.Max(_height.Minimum, Math.Min(_height.Maximum, _overlay.OverlayHeight));
            _height.ValueChanged += (s, e) => { if (!_locked.Checked) _overlay.SetOverlaySize((int)_width.Value, (int)_height.Value); };
            Controls.Add(_height);

            _backgroundColor.SetBounds(18, 184, 190, 34);
            _backgroundColor.Text = "Chọn màu nền...";
            _backgroundColor.Click += (s, e) =>
            {
                using (var dialog = new ColorDialog { FullOpen = true, AnyColor = true, Color = _overlay.OverlayBackgroundColor })
                {
                    if (dialog.ShowDialog(this) == DialogResult.OK) _overlay.SetBackgroundColor(dialog.Color);
                }
                RefreshColorButtons();
            };
            Controls.Add(_backgroundColor);

            _textColor.SetBounds(238, 184, 190, 34);
            _textColor.Text = "Chọn màu chữ...";
            _textColor.Click += (s, e) =>
            {
                using (var dialog = new ColorDialog { FullOpen = true, AnyColor = true, Color = _overlay.OverlayTextColor })
                {
                    if (dialog.ShowDialog(this) == DialogResult.OK) _overlay.SetTextColor(dialog.Color);
                }
                RefreshColorButtons();
            };
            Controls.Add(_textColor);

            var help = new Label();
            help.Name = "help";
            help.SetBounds(18, 238, 410, 76);
            help.ForeColor = Color.DimGray;
            Controls.Add(help);

            var close = new Button();
            close.SetBounds(338, 326, 90, 30);
            close.Text = "Đóng";
            close.Click += (s, e) => Close();
            Controls.Add(close);

            RefreshColorButtons();
            RefreshEditState();
        }

        private void RefreshOpacityText() { _opacityValue.Text = _opacity.Value + "%"; }

        private void RefreshColorButtons()
        {
            _backgroundColor.BackColor = _overlay.OverlayBackgroundColor;
            _backgroundColor.ForeColor = Contrast(_overlay.OverlayBackgroundColor);
            _textColor.BackColor = _overlay.OverlayTextColor;
            _textColor.ForeColor = Contrast(_overlay.OverlayTextColor);
        }

        private void RefreshEditState()
        {
            var editable = !_locked.Checked;
            _width.Enabled = editable;
            _height.Enabled = editable;
            var help = Controls["help"] as Label;
            if (help != null)
            {
                help.Text = _locked.Checked
                    ? "Đang khóa: bảng nổi chỉ hiển thị thông tin; chuột đi xuyên qua đối tượng phía dưới. Mở khóa để kéo hoặc thay đổi kích thước."
                    : "Đang mở khóa: kéo bảng nổi để đổi vị trí; kéo mép/góc hoặc nhập Rộng/Cao để đổi kích thước. Màu nền và màu chữ có thể chọn toàn bộ bảng màu.";
            }
        }

        private static Color Contrast(Color color)
        {
            var luminance = (0.299 * color.R + 0.587 * color.G + 0.114 * color.B);
            return luminance > 150 ? Color.Black : Color.White;
        }

        private static int ClampPercent(int value) { return Math.Max(35, Math.Min(100, value)); }
    }
}
