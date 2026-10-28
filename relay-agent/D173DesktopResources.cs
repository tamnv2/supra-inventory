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
    // Double buffering prevents native card backgrounds from flashing between
    // each child control's invalidation. No WebView2 HWND is reparented here.
    internal sealed class D173BufferedCardPanel : Panel
    {
        internal D173BufferedCardPanel()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint |
                     ControlStyles.OptimizedDoubleBuffer, true);
        }
    }

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
        // Hold the auto-scale across samples. Re-scaling all points every second
        // made a stable network graph appear to flash after a single spike.
        private float displayedNetworkScale = 1f;
        internal bool NetworkPair { get; set; }
        internal bool AutoScale { get; set; }
        internal D173ResourceSparkline()
        {
            Dock = DockStyle.Fill;
            BackColor = Color.White;
            DoubleBuffered = true;
            SetStyle(ControlStyles.Opaque | ControlStyles.AllPaintingInWmPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
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
            // With Opaque all pixels are painted once into the same offscreen buffer.
            // Avoid Windows background erase followed by a second chart redraw.
            g.Clear(BackColor);
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
            if (AutoScale)
                displayedNetworkScale = Math.Max(1f,
                    Math.Max(maxValue * 1.10f, displayedNetworkScale * 0.98f));
            var max = AutoScale ? displayedNetworkScale : 100f;
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

    // Native local icon: no external icon/font fetch and no provider usage.
    internal sealed class D173ResourceGlyph : Control
    {
        internal int Kind;
        internal D173ResourceGlyph()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint |
                     ControlStyles.OptimizedDoubleBuffer, true);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var x = Math.Max(2, (Width - 22) / 2);
            var y = Math.Max(2, (Height - 22) / 2);
            using (var p = new Pen(ForeColor, 1.7f))
            {
                if (Kind == 0) {
                    g.DrawRectangle(p,x+4,y+4,14,14);
                    for (int i=5;i<=17;i+=4) {
                        g.DrawLine(p,x,y+i,x+4,y+i);
                        g.DrawLine(p,x+18,y+i,x+22,y+i);
                    }
                } else if (Kind == 1) {
                    g.DrawRectangle(p,x+2,y+6,18,12);
                    for(int i=6;i<=16;i+=5)g.DrawLine(p,x+i,y+8,x+i,y+16);
                } else if (Kind == 2) {
                    g.DrawRectangle(p,x+2,y+5,18,14);
                    g.DrawEllipse(p,x+7,y+9,8,7);
                } else if (Kind == 3) {
                    g.DrawArc(p,x+2,y+6,18,13,205,130);
                    g.DrawArc(p,x+6,y+10,10,8,205,130);
                    using(var brush=new SolidBrush(ForeColor))
                        g.FillEllipse(brush,x+10,y+18,2,2);
                } else {
                    g.DrawRectangle(p,x+2,y+5,18,14);
                    g.DrawLine(p,x+6,y+10,x+16,y+10);
                    g.DrawLine(p,x+6,y+14,x+13,y+14);
                }
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
            _d173RefreshSelector.SelectedIndex = 0; // E090: 1-second local-only sampling by default
            _trayMonitorTimer.Interval = 1000;
            _d173PerformanceRefresh.Interval = 1000;
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
            var resourceLabels = new[] {
                _d173DesktopCpu, _d173DesktopRam, _d173DesktopDisk,
                _d173DesktopNetwork, _d173DesktopGpu
            };
            var resourceTrends = new[] {
                _d173CpuTrend, _d173RamTrend, _d173DiskTrend,
                _d173NetworkTrend, _d173GpuTrend
            };
            for (var i = 0; i < resourceLabels.Length; i++) {
                var row = new D173BufferedCardPanel {Dock = DockStyle.Fill, Margin = Padding.Empty};
                resourceLabels[i].Dock = DockStyle.Fill;
                row.Controls.Add(resourceLabels[i]);
                row.Controls.Add(new D173ResourceGlyph {
                    Kind = i, Dock = DockStyle.Left, Width = 30,
                    ForeColor = Color.FromArgb(0, 142, 136)
                });
                grid.Controls.Add(row, 0, i + 1);
                grid.Controls.Add(resourceTrends[i], 1, i + 1);
            }
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
            // E090: no second Performance tab or independent resource refresh timer.
            // The Overview uses the existing local SystemMonitor sampling stream.
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
            if (_mainTabs.SelectedTab != _overviewPage) return;
            // Update only changed labels; never relayout/recreate the selector at each tick.
            SetD173MetricText(_d173DesktopCpu, "CPU  " + D173Metric(value.CpuPercent) +
                (value.CurrentMhz > 0 ? " · " + (value.CurrentMhz / 1000.0).ToString("0.00") + " GHz" : ""));
            SetD173MetricText(_d173DesktopGpu, "GPU  " + D173Metric(value.GpuPercent));
            SetD173MetricText(_d173DesktopRam, "Bộ nhớ  " +
                (value.RamUsedBytes / 1073741824.0).ToString("0.0") + "/" +
                (value.RamTotalBytes / 1073741824.0).ToString("0.0") + " GB");
            SetD173MetricText(_d173DesktopDisk, "Ổ đĩa  " + D173Metric(value.DiskPercent));
            SetD173MetricText(_d173DesktopNetwork, "Mạng  ↓" + D173Metric(value.NetworkDownMbps, " Mb/s") +
                " ↑" + D173Metric(value.NetworkUpMbps, " Mb/s"));
            _d173CpuTrend.Push(value.CpuPercent);
            _d173GpuTrend.Push(value.GpuPercent);
            _d173RamTrend.Push(value.RamTotalBytes > 0
                ? 100.0 * value.RamUsedBytes / value.RamTotalBytes : -1);
            _d173DiskTrend.Push(value.DiskPercent);
            _d173NetworkTrend.PushNetwork(Math.Max(0, value.NetworkDownMbps),
                Math.Max(0, value.NetworkUpMbps));
        }

        private static void SetD173MetricText(Label label, string text)
        {
            if (!string.Equals(label.Text, text, StringComparison.Ordinal))
                label.Text = text;
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

        // E096: the four existing Agent actions share one row, even on narrow RDP.
        // E095 always-on auto columns no longer consume a toolbar slot.
        private void ApplyD173E038AgentToolbar(Control host, bool authenticated, bool takeoverVisible)
        {
            if (host == null || host.IsDisposed || !authenticated) return;
            const int gap = 4;
            var width = Math.Max(360, host.ClientSize.Width);
            var usable = Math.Max(336, width - 24);
            var compact = usable < 540;
            var first = compact ? 70 : 88;
            var second = compact ? Math.Max(85,Math.Min(118,(usable-3*gap)/4)) : 145;
            var third = compact ? Math.Max(80,Math.Min(112,(usable-3*gap)/4)) : 124;
            var fourth = Math.Max(0,usable-first-second-third-3*gap);
            const int row = 91;
            _manualUpdate.Text = compact ? "Cập nhật" : "Kiểm tra cập nhật";
            _background.Text = compact ? "Ẩn xuống nền" : "Chuyển xuống nền";
            _d150PrimaryTakeoverButton.Text = compact ? "Chuyển chính" : "Chuyển Agent chính";
            _autoSizeAgentColumnsButton.Visible = false;
            foreach (var button in new[] {_logout, _manualUpdate, _background, _d150PrimaryTakeoverButton})
            {
                button.AutoSize = false;
                var fontSize = compact ? 7.4f : 8.2f;
                if (Math.Abs(button.Font.Size-fontSize) > 0.1f)
                    button.Font = new Font("Segoe UI",fontSize);
            }
            var x = 12;
            SetD173BoundsIfChanged(_logout,x,row,first,29);x+=first+gap;
            SetD173BoundsIfChanged(_manualUpdate,x,row,second,29);x+=second+gap;
            SetD173BoundsIfChanged(_background,x,row,third,29);x+=third+gap;
            if(takeoverVisible)
                SetD173BoundsIfChanged(_d150PrimaryTakeoverButton,x,row,
                    Math.Min(fourth,Math.Max(0,width-x-12)),29);
            if (_afterHoursLayoutVisible == true && _afterHoursPanel.Visible)
                ApplyAfterHoursAgentLayout(true);
            else
            {
                const int fleetTop=128;
                SetD173BoundsIfChanged(_agentFleetGrid,12,fleetTop,
                    Math.Max(300,width-24),Math.Max(43,host.ClientSize.Height-fleetTop-8));
            }
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
