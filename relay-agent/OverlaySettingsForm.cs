using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed class OverlaySettingsForm : Form
    {
        private readonly StatusOverlayForm _overlay;
        private readonly TrackBar _opacity = new TrackBar();
        private readonly Label _opacityValue = new Label();
        private readonly CheckBox _visible = new CheckBox();
        private readonly CheckBox _locked = new CheckBox();
        private readonly NumericUpDown _width = new NumericUpDown();
        private readonly NumericUpDown _height = new NumericUpDown();
        private readonly Button _backgroundColor = new Button();
        private readonly Button _textColor = new Button();
        private readonly Dictionary<string, CheckBox> _displayChecks = new Dictionary<string, CheckBox>();

        internal OverlaySettingsForm(StatusOverlayForm overlay)
        {
            if (overlay == null) throw new ArgumentNullException("overlay");
            _overlay = overlay;
            var options = overlay.DisplaySettings;

            Text = "Cài đặt bảng nổi";
            Width = 650;
            Height = 680;
            MinimumSize = new Size(650, 680);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            Font = new Font("Segoe UI", 9F);
            BackColor = Color.White;

            var title = new Label
            {
                Left = 20, Top = 16, Width = 590, Height = 28,
                Text = "Tùy chọn hiển thị Overlay",
                Font = new Font("Segoe UI Semibold", 12F, FontStyle.Bold)
            };
            Controls.Add(title);
            Controls.Add(new Label
            {
                Left = 20, Top = 45, Width = 590, Height = 36,
                Text = "Mỗi thông tin được hiển thị thành một ô riêng để đọc nhanh. Tất cả lựa chọn được lưu cho Windows user hiện tại.",
                ForeColor = Color.DimGray
            });

            _visible.SetBounds(20, 88, 270, 25);
            _visible.Text = "Bật hiển thị Overlay";
            _visible.Checked = _overlay.OverlayVisible;
            _visible.CheckedChanged += (s, e) => _overlay.SetOverlayVisible(_visible.Checked);
            Controls.Add(_visible);

            _locked.SetBounds(310, 88, 310, 25);
            _locked.Text = "Khóa vị trí/kích thước + click-through";
            _locked.Checked = _overlay.IsLocked;
            _locked.CheckedChanged += (s, e) =>
            {
                _overlay.SetLocked(_locked.Checked);
                RefreshEditState();
            };
            Controls.Add(_locked);

            var appearance = new GroupBox
            {
                Left = 20, Top = 122, Width = 600, Height = 145,
                Text = "Kích thước & màu sắc"
            };
            Controls.Add(appearance);

            appearance.Controls.Add(new Label { Left = 16, Top = 28, Width = 90, Height = 22, Text = "Chiều rộng" });
            _width.SetBounds(105, 24, 95, 28);
            _width.Minimum = 120;
            _width.Maximum = 7680;
            _width.Value = Math.Max(_width.Minimum, Math.Min(_width.Maximum, _overlay.OverlayWidth));
            _width.ValueChanged += (s, e) => { if (!_locked.Checked) _overlay.SetOverlaySize((int)_width.Value, (int)_height.Value); };
            appearance.Controls.Add(_width);

            appearance.Controls.Add(new Label { Left = 220, Top = 28, Width = 80, Height = 22, Text = "Chiều cao" });
            _height.SetBounds(300, 24, 95, 28);
            _height.Minimum = 32;
            _height.Maximum = 4320;
            _height.Value = Math.Max(_height.Minimum, Math.Min(_height.Maximum, _overlay.OverlayHeight));
            _height.ValueChanged += (s, e) => { if (!_locked.Checked) _overlay.SetOverlaySize((int)_width.Value, (int)_height.Value); };
            appearance.Controls.Add(_height);

            appearance.Controls.Add(new Label { Left = 16, Top = 68, Width = 105, Height = 22, Text = "Độ trong của nền bảng nổi" });
            _opacity.SetBounds(118, 60, 360, 42);
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
            appearance.Controls.Add(_opacity);

            _opacityValue.SetBounds(490, 66, 70, 24);
            _opacityValue.TextAlign = ContentAlignment.MiddleRight;
            appearance.Controls.Add(_opacityValue);
            RefreshOpacityText();

            _backgroundColor.SetBounds(16, 104, 180, 30);
            _backgroundColor.Text = "Màu nền...";
            _backgroundColor.Click += (s, e) =>
            {
                using (var dialog = new ColorDialog { FullOpen = true, AnyColor = true, Color = _overlay.OverlayBackgroundColor })
                {
                    if (dialog.ShowDialog(this) == DialogResult.OK) _overlay.SetBackgroundColor(dialog.Color);
                }
                RefreshColorButtons();
            };
            appearance.Controls.Add(_backgroundColor);

            _textColor.SetBounds(214, 104, 180, 30);
            _textColor.Text = "Màu chữ...";
            _textColor.Click += (s, e) =>
            {
                using (var dialog = new ColorDialog { FullOpen = true, AnyColor = true, Color = _overlay.OverlayTextColor })
                {
                    if (dialog.ShowDialog(this) == DialogResult.OK) _overlay.SetTextColor(dialog.Color);
                }
                RefreshColorButtons();
            };
            appearance.Controls.Add(_textColor);

            var laptop = BuildChecklistGroup("Trạng thái hệ thống", 20, 280, 290, 260, new[]
            {
                new Tuple<string,string,bool>("laptop_group", "Hiển thị nhóm trạng thái", options.ShowLaptopGroup),
                new Tuple<string,string,bool>("cpu", "Vai trò PRIMARY/STANDBY/FROZEN", options.ShowCpu),
                new Tuple<string,string,bool>("memory", "Trạng thái Firestore", options.ShowMemory),
                new Tuple<string,string,bool>("disk", "Trạng thái WMS", options.ShowDisk),
                new Tuple<string,string,bool>("network", "Phiên bản Agent", options.ShowNetwork),
                new Tuple<string,string,bool>("internet", "Trạng thái nghiệp vụ", options.ShowInternet),
                new Tuple<string,string,bool>("gpu", "Số PickList trong cache", options.ShowGpu),
            });
            Controls.Add(laptop);

            var agent = BuildChecklistGroup("Hiệu năng & lưu lượng", 330, 280, 290, 260, new[]
            {
                new Tuple<string,string,bool>("agent_group", "Hiển thị nhóm hiệu năng", options.ShowAgentGroup),
                new Tuple<string,string,bool>("agent_online", "CPU tiến trình Agent", options.ShowAgentOnline),
                new Tuple<string,string,bool>("agent_state", "RAM và thời gian chạy · tách 2 ô", options.ShowAgentState),
                new Tuple<string,string,bool>("pda_requests", "Yêu cầu PDA và đang chờ · tách 2 ô", options.ShowPdaRequests),
                new Tuple<string,string,bool>("agent_responses", "Xác nhận OK và lỗi · tách 2 ô", options.ShowAgentResponses),
                new Tuple<string,string,bool>("wms_session", "Agent online và thời điểm cập nhật · tách 2 ô", options.ShowWmsSession),
            });
            Controls.Add(agent);

            var help = new Label();
            help.Name = "help";
            help.SetBounds(20, 552, 600, 54);
            help.ForeColor = Color.DimGray;
            Controls.Add(help);

            var defaults = new Button();
            defaults.SetBounds(20, 612, 150, 32);
            defaults.Text = "Chọn mặc định";
            defaults.Click += (s, e) => RestoreDefaultChecks();
            Controls.Add(defaults);

            var close = new Button();
            close.SetBounds(520, 612, 100, 32);
            close.Text = "Đóng";
            close.Click += (s, e) => Close();
            Controls.Add(close);

            RefreshColorButtons();
            RefreshEditState();
        }

        private GroupBox BuildChecklistGroup(string title, int left, int top, int width, int height, Tuple<string,string,bool>[] items)
        {
            var group = new GroupBox { Left = left, Top = top, Width = width, Height = height, Text = title };
            var y = 26;
            foreach (var item in items)
            {
                var check = new CheckBox
                {
                    Left = 14,
                    Top = y,
                    Width = width - 28,
                    Height = 27,
                    Text = item.Item2,
                    Checked = item.Item3
                };
                var key = item.Item1;
                check.CheckedChanged += (s, e) =>
                {
                    ApplyDisplayOption(key, check.Checked);
                    RefreshChecklistState();
                };
                _displayChecks[key] = check;
                group.Controls.Add(check);
                y += 31;
            }
            return group;
        }

        private void ApplyDisplayOption(string key, bool value)
        {
            var options = _overlay.DisplaySettings;
            switch (key)
            {
                case "laptop_group": options.ShowLaptopGroup = value; break;
                case "cpu": options.ShowCpu = value; break;
                case "memory": options.ShowMemory = value; break;
                case "disk": options.ShowDisk = value; break;
                case "network": options.ShowNetwork = value; break;
                case "internet": options.ShowInternet = value; break;
                case "gpu": options.ShowGpu = value; break;
                case "agent_group": options.ShowAgentGroup = value; break;
                case "agent_online": options.ShowAgentOnline = value; break;
                case "agent_state": options.ShowAgentState = value; break;
                case "pda_requests": options.ShowPdaRequests = value; break;
                case "agent_responses": options.ShowAgentResponses = value; break;
                case "wms_session": options.ShowWmsSession = value; break;
            }
            _overlay.SaveDisplaySettings();
        }

        private void RefreshChecklistState()
        {
            var laptopEnabled = !_displayChecks.ContainsKey("laptop_group") || _displayChecks["laptop_group"].Checked;
            foreach (var key in new[] { "cpu", "memory", "disk", "network", "internet", "gpu" })
                if (_displayChecks.ContainsKey(key)) _displayChecks[key].Enabled = laptopEnabled;

            var agentEnabled = !_displayChecks.ContainsKey("agent_group") || _displayChecks["agent_group"].Checked;
            foreach (var key in new[] { "agent_online", "agent_state", "pda_requests", "agent_responses", "wms_session" })
                if (_displayChecks.ContainsKey(key)) _displayChecks[key].Enabled = agentEnabled;
        }

        private void RestoreDefaultChecks()
        {
            foreach (var check in _displayChecks.Values) check.Checked = true;
            _visible.Checked = true;
            _locked.Checked = true;
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
                    ? "Đang khóa: overlay không nhận chuột; click đi xuyên xuống ứng dụng phía dưới. Mở khóa để kéo hoặc resize."
                    : "Đang mở khóa: kéo để đổi vị trí; kéo mép/góc hoặc nhập Rộng/Cao. Checklist và màu sắc áp dụng ngay.";
            }
            RefreshChecklistState();
        }

        private static Color Contrast(Color color)
        {
            var luminance = 0.299 * color.R + 0.587 * color.G + 0.114 * color.B;
            return luminance > 150 ? Color.Black : Color.White;
        }

        internal void PrepareEmbedded()
        {
            TopLevel = false;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            MinimumSize = Size.Empty;
            Dock = DockStyle.Fill;
            AutoScroll = true;
            foreach (Control control in Controls)
            {
                var button = control as Button;
                if (button != null && string.Equals(button.Text, "Đóng", StringComparison.Ordinal))
                    button.Visible = false;
            }
        }

        private static int ClampPercent(int value) { return Math.Max(35, Math.Min(100, value)); }
    }
}
