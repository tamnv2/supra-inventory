using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Net.NetworkInformation;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // Avoid erasing all six desktop rows whenever one metric label changes.
    internal sealed class D173BufferedTableLayoutPanel : TableLayoutPanel
    {
        internal D173BufferedTableLayoutPanel()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint |
                     ControlStyles.OptimizedDoubleBuffer |
                     ControlStyles.ResizeRedraw, true);
        }
    }

    // Purely local read-only performance view. No service calls, no polling timer.
    internal sealed class D173ResourceSparkline : Control
    {
        private readonly Queue<float> history = new Queue<float>();
        private readonly Queue<float> uploadHistory = new Queue<float>();
        internal bool NetworkPair { get; set; }
        internal bool AutoScale { get; set; }
        internal D173ResourceSparkline()
        {
            Dock = DockStyle.Fill;
            BackColor = Color.White;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        }
        internal void Push(double value)
        {
            if (!Visible || value < 0) return;
            history.Enqueue((float)Math.Max(0, AutoScale ? value : Math.Min(100, value)));
            while (history.Count > 60) history.Dequeue();
            Invalidate();
        }
        internal void PushNetwork(double download, double upload)
        {
            if (!Visible || download < 0 || upload < 0) return;
            uploadHistory.Enqueue((float)upload);
            while (uploadHistory.Count > 60) uploadHistory.Dequeue();
            Push(download);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            if (Width < 30 || Height < 25) return;
            var values = history.ToArray();
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var dark = BackColor.GetBrightness() < 0.38f;
            var grid = dark ? Color.FromArgb(55, 155, 173, 194) :
                Color.FromArgb(55, 101, 119, 141);
            var accent = Color.FromArgb(0, 142, 136);
            var top = 7f;
            var bottom = Math.Max(top + 1f, Height - 8f);
            using (var gridPen = new Pen(grid, 1f) { DashStyle = DashStyle.Dot })
            {
                for (var i = 1; i < 4; i++)
                {
                    var y = top + (bottom - top) * i / 4f;
                    g.DrawLine(gridPen, 5f, y, Width - 5f, y);
                }
            }
            if (values.Length < 2) return;
            var uploadValues = NetworkPair ? uploadHistory.ToArray() : new float[0];
            var maxValue = uploadValues.Length == 0 ? values.Max() : Math.Max(values.Max(), uploadValues.Max());
            var max = AutoScale ? Math.Max(1f, maxValue * 1.10f) : 100f;
            var usable = Math.Max(1f, bottom - top);
            var points = values.Select((value, i) =>
                new PointF(5f + i * (Width - 10f) / Math.Max(59f, values.Length - 1f),
                    bottom - (float)Math.Min(1.0, value / max) * usable)).ToArray();
            var polygon = new PointF[points.Length + 2];
            polygon[0] = new PointF(points[0].X, bottom);
            Array.Copy(points, 0, polygon, 1, points.Length);
            polygon[polygon.Length - 1] = new PointF(points[points.Length - 1].X, bottom);
            using (var fill = new SolidBrush(Color.FromArgb(dark ? 42 : 26, accent)))
                g.FillPolygon(fill, polygon);
            using (var pen = new Pen(accent, 2f))
                g.DrawLines(pen, points);
            using (var dot = new SolidBrush(accent))
                g.FillEllipse(dot, points[points.Length - 1].X - 2.5f,
                    points[points.Length - 1].Y - 2.5f, 5f, 5f);
            if (uploadValues.Length > 1)
            {
                var up = uploadValues.Select((value, i) =>
                    new PointF(5f + i * (Width - 10f) / Math.Max(59f, uploadValues.Length - 1f),
                        bottom - (float)Math.Min(1.0, value / max) * usable)).ToArray();
                var uploadAccent = Color.FromArgb(66, 125, 220);
                using (var pen = new Pen(uploadAccent, 2f)) g.DrawLines(pen, up);
                using (var dot = new SolidBrush(uploadAccent))
                    g.FillEllipse(dot, up[up.Length - 1].X - 2.5f, up[up.Length - 1].Y - 2.5f, 5f, 5f);
            }
        }
    }

    internal sealed partial class AgentForm
    {
        private readonly Label _d173DesktopCpu = new Label();
        private readonly Label _d173DesktopGpu = new Label();
        private readonly Label _d173DesktopRam = new Label();
        private readonly Label _d173DesktopDisk = new Label();
        private readonly Label _d173DesktopNetwork = new Label();
        private readonly D173ResourceSparkline _d173CpuTrend = new D173ResourceSparkline();
        private readonly D173ResourceSparkline _d173GpuTrend = new D173ResourceSparkline();
        private readonly D173ResourceSparkline _d173RamTrend = new D173ResourceSparkline();
        private readonly D173ResourceSparkline _d173DiskTrend = new D173ResourceSparkline();
        private readonly D173ResourceSparkline _d173NetworkTrend = new D173ResourceSparkline { AutoScale = true, NetworkPair = true };
        private readonly ComboBox _d173RefreshSelector = new ComboBox();


        private static Label D173InfoLabel(string text)
        {
            return new Label {
                Text = text, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft,
                ForeColor = Color.FromArgb(50, 65, 81), Font = new Font("Segoe UI", 9f),
                AutoEllipsis = true, Margin = new Padding(6, 2, 4, 2)
            };
        }

        private Control CreateD173DesktopCard()
        {
            // Same shared Sample2 border as the operational cards; local metrics only.
            var panel = NewCard(0, 0, 400, 320);
            panel.Dock = DockStyle.Fill;
            panel.Margin = new Padding(8, 0, 0, 8);
            var grid = new D173BufferedTableLayoutPanel { Dock = DockStyle.Fill,
                ColumnCount = 2, RowCount = 6, Padding = new Padding(12, 9, 12, 9) };
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42f));
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 34f));
            for (var i = 1; i < 6; i++) grid.RowStyles.Add(new RowStyle(SizeType.Percent, 20f));
            var heading = D173InfoLabel("TÀI NGUYÊN DESKTOP");
            heading.Font = new Font("Segoe UI Semibold", 11.5f, FontStyle.Bold);
            heading.ForeColor = Color.FromArgb(23, 42, 78);
            grid.Controls.Add(heading, 0, 0);
            _d173RefreshSelector.Name = "D173LocalSamplingInterval";
            _d173RefreshSelector.DropDownStyle = ComboBoxStyle.DropDownList;
            _d173RefreshSelector.Items.AddRange(new object[] { "1 giây", "2 giây", "5 giây", "10 giây" });
            _d173RefreshSelector.SelectedIndex = 2; // keep existing 5s Overview resource sampling
            _d173RefreshSelector.Dock = DockStyle.Right;
            _d173RefreshSelector.Width = 94;
            _d173RefreshSelector.Font = new Font("Segoe UI", 8.5f);
            _d173RefreshSelector.SelectedIndexChanged += (sender, args) =>
            {
                var seconds = new[] { 1, 2, 5, 10 }[Math.Max(0, _d173RefreshSelector.SelectedIndex)];
                _trayMonitorTimer.Interval = seconds * 1000;
                _d173PerformanceRefresh.Interval = seconds * 1000;
            };
            grid.Controls.Add(_d173RefreshSelector, 1, 0);
            grid.Controls.Add(_d173DesktopCpu, 0, 1); grid.Controls.Add(_d173CpuTrend, 1, 1);
            grid.Controls.Add(_d173DesktopGpu, 0, 2); grid.Controls.Add(_d173GpuTrend, 1, 2);
            grid.Controls.Add(_d173DesktopRam, 0, 3); grid.Controls.Add(_d173RamTrend, 1, 3);
            grid.Controls.Add(_d173DesktopDisk, 0, 4); grid.Controls.Add(_d173DiskTrend, 1, 4);
            grid.Controls.Add(_d173DesktopNetwork, 0, 5); grid.Controls.Add(_d173NetworkTrend, 1, 5);
            foreach (var label in new[] {_d173DesktopCpu,_d173DesktopGpu,_d173DesktopRam,
                _d173DesktopDisk,_d173DesktopNetwork})
            {
                label.Dock = DockStyle.Fill;
                label.TextAlign = ContentAlignment.MiddleLeft;
                label.Font = new Font("Segoe UI", 9f);
                label.ForeColor = Color.FromArgb(50,65,81);
                label.AutoEllipsis = true;
                label.Margin = new Padding(6, 1, 2, 1);
                label.Text = "Đang đọc tài nguyên...";
            }
            panel.Controls.Add(grid);
            // The settings page and all tabs already exist by the first Shown event.
            // Defer the optional metrics tab until the existing startup-smoke
            // has validated the original authenticated WMS/Picker tabs.
            Shown += (sender, args) => BeginInvoke(new Action(() => {
                if (!IsDisposed) {
                    InitializeD173PerformancePage();
                    ApplyD173AppWideTheme(force: true);
                }
            }));
            Shown += (sender, args) => InitializeD173ThemeControlsOnce();
            return panel;
        }

        private static string D173Metric(double value, string unit = "%")
        {
            return value < 0 || double.IsNaN(value) ? "N/A" : value.ToString("0.#") + unit;
        }

        private void ApplyD173DesktopMetrics(SystemMetrics value)
        {
            if (value == null || _d173DesktopCpu.IsDisposed || !_d173DesktopCpu.IsHandleCreated) return;
            if (!Visible || WindowState == FormWindowState.Minimized) return;
            if (_mainTabs.SelectedTab == _d173PerformancePage) {
                ApplyD173DetailedMetrics(value);
                return;
            }
            if (_mainTabs.SelectedTab != _overviewPage) return;
            _d173DesktopCpu.Text = "CPU " + D173Metric(value.CpuPercent) +
                (value.CurrentMhz > 0 ? " · " + (value.CurrentMhz / 1000.0).ToString("0.00") + " GHz" : "");
            _d173DesktopGpu.Text = "GPU " + D173Metric(value.GpuPercent);
            _d173DesktopRam.Text = "RAM " +
                (value.RamUsedBytes / 1073741824.0).ToString("0.0") + "/" +
                (value.RamTotalBytes / 1073741824.0).ToString("0.0") + " GB";
            _d173DesktopDisk.Text = "Ổ đĩa " + D173Metric(value.DiskPercent);
            _d173DesktopNetwork.Text = "Mạng ↓" + D173Metric(value.NetworkDownMbps, " Mb/s") +
                " ↑" + D173Metric(value.NetworkUpMbps, " Mb/s");
            _d173CpuTrend.Push(value.CpuPercent);
            _d173GpuTrend.Push(value.GpuPercent);
            _d173RamTrend.Push(value.RamTotalBytes > 0
                ? 100.0 * value.RamUsedBytes / value.RamTotalBytes : -1);
            _d173DiskTrend.Push(value.DiskPercent);
            _d173NetworkTrend.PushNetwork(Math.Max(0, value.NetworkDownMbps),
                Math.Max(0, value.NetworkUpMbps));
        }

        // Keep login, update, tray and column controls reachable in the new
        // 2-column overview, including a 1000px-wide ordinary Windows window.
        // Pure layout adjustment: no Agent, WMS, network or auth operation.
        private void ApplyD173CompactAgentAuthLayout(Control host, bool authenticated)
        {
            if (host == null || host.IsDisposed) return;
            var width = host.ClientSize.Width;
            if (width < 360) return;
            var userLabel = host.Controls["agent-auth-user-label"];
            var passwordLabel = host.Controls["agent-auth-password-label"];
            if (width >= 900)
            {
                if (!authenticated)
                {
                    if (userLabel != null) userLabel.SetBounds(16, 64, 220, 18);
                    if (passwordLabel != null) passwordLabel.SetBounds(288, 64, 102, 18);
                    _username.SetBounds(16, 82, 260, 27);
                    _password.SetBounds(288, 82, 200, 27);
                    _pair.SetBounds(500, 80, 108, 31);
                    _manualUpdate.SetBounds(736, 80, 150, 31);
                    _background.SetBounds(886, 80, 120, 31);
                }
                if (authenticated)
                    ApplyD173E038AgentToolbar(host, true, _d150PrimaryTakeoverButton.Visible);
                return;
            }
            if (!authenticated)
            {
                var column = Math.Max(150, (width - 36) / 2);
                if (userLabel != null) userLabel.SetBounds(12, 49, column, 18);
                if (passwordLabel != null) passwordLabel.SetBounds(24 + column, 49, column, 18);
                _username.SetBounds(12, 68, column, 27);
                _password.SetBounds(24 + column, 68, column, 27);
                _pair.SetBounds(12, 108, 92, 30);
                _manualUpdate.SetBounds(111, 108, Math.Min(143, Math.Max(100, width - 274)), 30);
                _background.SetBounds(Math.Min(261, width - 128), 108, 116, 30);
            }
            else
            {
                _logout.SetBounds(10, 90, 85, 29);
                _manualUpdate.SetBounds(100, 90, 129, 29);
                _background.SetBounds(234, 90, 110, 29);
                ApplyD173E038AgentToolbar(host, authenticated, _d150PrimaryTakeoverButton.Visible);
            }
        }

        // D173-E038: two clean action rows. No overlapped Auto size / takeover,
        // even on the smallest supported fullscreen desktop.
        private void ApplyD173E038AgentToolbar(Control host, bool authenticated, bool takeoverVisible)
        {
            if (host == null || host.IsDisposed || !authenticated) return;
            const int gap = 6;
            var w = Math.Max(370, host.ClientSize.Width);
            var usable = Math.Max(330, w - 24);
            var small = usable < 420;
            var first = small ? 83 : 100;
            var third = small ? 100 : 124;
            var second = Math.Max(112, Math.Min(156, usable - first - third - gap * 2));
            var row = 91;
            _logout.SetBounds(12, row, first, 29);
            _manualUpdate.SetBounds(12 + first + gap, row, second, 29);
            _background.SetBounds(12 + first + gap + second + gap, row, third, 29);
            var secondRow = 125;
            var auto = Math.Min(180, (usable - gap) / (takeoverVisible ? 2 : 1));
            _autoSizeAgentColumnsButton.Text = _autoSizeColumnsEnabled ? "Tự căn cột: Bật" : "Tự căn cột: Tắt";
            _autoSizeAgentColumnsButton.AutoSize = false;
            _autoSizeAgentColumnsButton.SetBounds(12, secondRow,
                takeoverVisible ? auto : Math.Min(230, usable), 28);
            if (takeoverVisible)
                _d150PrimaryTakeoverButton.SetBounds(12 + auto + gap, secondRow,
                    Math.Min(155, usable - auto - gap), 28);
            const int fleetTop = 161;
            _agentFleetGrid.SetBounds(12, fleetTop, Math.Max(300, w - 24),
                Math.Max(43, host.ClientSize.Height - fleetTop - 8));
            _agentFleetGrid.Anchor = AnchorStyles.Top | AnchorStyles.Bottom |
                AnchorStyles.Left | AnchorStyles.Right;
        }

        private static void ApplyD173AntdUiTheme(Control root)
        {
            if (root == null) return;
            foreach (Control child in root.Controls)
            {
                var button = child as System.Windows.Forms.Button;
                if (button != null) {
                    button.FlatStyle = FlatStyle.Flat;
                    button.FlatAppearance.BorderSize = 0;
                    button.UseVisualStyleBackColor = false;
                }
                var table = child as DataGridView;
                if (table != null) {
                    table.EnableHeadersVisualStyles = false;
                    // D173-E043: palette is applied after Shown and on
                    // each theme transition; do not hardcode light-only grid colors.
                }
                ApplyD173AntdUiTheme(child);
            }
        }
    }
}
