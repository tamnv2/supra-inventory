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

        internal OverlaySettingsForm(StatusOverlayForm overlay)
        {
            if (overlay == null) throw new ArgumentNullException("overlay");
            _overlay = overlay;

            Text = "Cài đặt bảng nổi";
            Width = 390;
            Height = 235;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            Font = new Font("Segoe UI", 9F);

            Controls.Add(new Label
            {
                Left = 18,
                Top = 18,
                Width = 330,
                Height = 22,
                Text = "Độ trong của nền bảng nổi"
            });

            _opacity.SetBounds(16, 42, 290, 42);
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

            _opacityValue.SetBounds(312, 48, 58, 24);
            _opacityValue.TextAlign = ContentAlignment.MiddleRight;
            Controls.Add(_opacityValue);
            RefreshOpacityText();

            _locked.SetBounds(18, 96, 340, 26);
            _locked.Text = "Khóa vị trí và cho chuột xuyên qua bảng nổi";
            _locked.Checked = _overlay.IsLocked;
            _locked.CheckedChanged += (s, e) =>
            {
                _overlay.SetLocked(_locked.Checked);
                RefreshHelp();
            };
            Controls.Add(_locked);

            var help = new Label();
            help.Name = "help";
            help.SetBounds(18, 128, 338, 42);
            help.ForeColor = Color.DimGray;
            Controls.Add(help);

            var close = new Button();
            close.SetBounds(268, 174, 90, 30);
            close.Text = "Đóng";
            close.Click += (s, e) => Close();
            Controls.Add(close);

            RefreshHelp();
        }

        private void RefreshOpacityText()
        {
            _opacityValue.Text = _opacity.Value + "%";
        }

        private void RefreshHelp()
        {
            var help = Controls["help"] as Label;
            if (help == null) return;
            help.Text = _locked.Checked
                ? "Đang khóa: không thể kéo/chọn bảng nổi; chuột đi xuyên qua ứng dụng phía dưới."
                : "Đang mở khóa: giữ chuột trái trên bảng nổi để kéo sang vị trí mong muốn.";
        }

        private static int ClampPercent(int value)
        {
            return Math.Max(35, Math.Min(100, value));
        }
    }
}
