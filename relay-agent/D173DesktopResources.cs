using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Management;
using System.Net.NetworkInformation;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // Purely local read-only performance view. No service calls, no polling timer.
    internal sealed class D173ResourceSparkline : Control
    {
        private readonly Queue<float> history = new Queue<float>();
        internal D173ResourceSparkline()
        {
            Dock = DockStyle.Fill;
            BackColor = Color.FromArgb(248, 250, 252);
            DoubleBuffered = true;
        }
        internal void Push(double value)
        {
            if (!Visible || value < 0) return;
            history.Enqueue((float)Math.Max(0, Math.Min(100, value)));
            while (history.Count > 60) history.Dequeue();
            Invalidate();
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var values = history.ToArray();
            if (values.Length < 2 || Width < 4 || Height < 4) return;
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using (var pen = new Pen(Color.FromArgb(22, 119, 210), 1.9f))
            {
                var points = values.Select((value, index) =>
                    new PointF(index * Math.Max(1, Width - 3) / (float)Math.Max(1, values.Length - 1),
                        (Height - 4) * (100f - value) / 100f + 2f)).ToArray();
                e.Graphics.DrawLines(pen, points);
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
        private readonly Label _d173DesktopProcess = new Label();
        private readonly Label _d173DesktopHardware = new Label();
        private readonly D173ResourceSparkline _d173CpuTrend = new D173ResourceSparkline();
        private readonly D173ResourceSparkline _d173GpuTrend = new D173ResourceSparkline();

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
            // A genuine AntdUI surface; the existing WinForms operational controls
            // remain intact until regression-proven, avoiding a WMS/HA behavior rewrite.
            var panel = new AntdUI.Panel { Dock = DockStyle.Fill,
                BackColor = Color.White, Margin = new Padding(8, 0, 0, 8) };
            var grid = new TableLayoutPanel { Dock = DockStyle.Fill,
                ColumnCount = 2, RowCount = 8, Padding = new Padding(8, 6, 8, 6) };
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42f));
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 34f));
            for (var i = 1; i < 8; i++) grid.RowStyles.Add(new RowStyle(SizeType.Percent, 100f / 7));
            var heading = D173InfoLabel("TÀI NGUYÊN DESKTOP");
            heading.Font = new Font("Segoe UI Semibold", 11.5f, FontStyle.Bold);
            heading.ForeColor = Color.FromArgb(23, 42, 78);
            grid.Controls.Add(heading, 0, 0);
            grid.SetColumnSpan(heading, 2);
            grid.Controls.Add(_d173DesktopCpu, 0, 1); grid.Controls.Add(_d173CpuTrend, 1, 1);
            grid.Controls.Add(_d173DesktopGpu, 0, 2); grid.Controls.Add(_d173GpuTrend, 1, 2);
            grid.Controls.Add(_d173DesktopRam, 0, 3);
            grid.Controls.Add(_d173DesktopDisk, 0, 4);
            grid.Controls.Add(_d173DesktopNetwork, 0, 5); grid.SetColumnSpan(_d173DesktopNetwork, 2);
            grid.Controls.Add(_d173DesktopProcess, 0, 6); grid.SetColumnSpan(_d173DesktopProcess, 2);
            grid.Controls.Add(_d173DesktopHardware, 0, 7); grid.SetColumnSpan(_d173DesktopHardware, 2);
            foreach (var label in new[] {_d173DesktopCpu,_d173DesktopGpu,_d173DesktopRam,
                _d173DesktopDisk,_d173DesktopNetwork,_d173DesktopProcess,_d173DesktopHardware})
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
            // Hardware names are queried once in the background, never logged and
            // never part of a cloud telemetry payload.
            Shown += (sender, args) => Task.Run(() =>
            {
                var cpu = D173WmiName("Win32_Processor");
                var gpu = D173WmiName("Win32_VideoController");
                if (!IsDisposed && IsHandleCreated) {
                    try { BeginInvoke(new Action(() => {
                        if (!_d173DesktopHardware.IsDisposed)
                            _d173DesktopHardware.Text = "CPU: " + cpu + " | GPU: " + gpu;
                    })); } catch { }
                }
            });
            return panel;
        }

        private static string D173WmiName(string className)
        {
            try {
                using (var search = new ManagementObjectSearcher("SELECT Name FROM " + className))
                using (var rows = search.Get()) {
                    foreach (ManagementBaseObject row in rows)
                        return (Convert.ToString(row["Name"]) ?? "Không xác định").Trim();
                }
            } catch { }
            return "Không xác định";
        }

        private static string D173Metric(double value, string unit = "%")
        {
            return value < 0 || double.IsNaN(value) ? "N/A" : value.ToString("0.#") + unit;
        }

        private void ApplyD173DesktopMetrics(SystemMetrics value)
        {
            if (value == null || _d173DesktopCpu.IsDisposed || !_d173DesktopCpu.IsHandleCreated) return;
            if (!Visible || _mainTabs.SelectedTab != _overviewPage) return;
            _d173DesktopCpu.Text = "CPU " + D173Metric(value.CpuPercent) +
                (value.CurrentMhz > 0 ? " · " + (value.CurrentMhz / 1000.0).ToString("0.00") + " GHz" : "");
            _d173DesktopGpu.Text = "GPU " + D173Metric(value.GpuPercent);
            _d173DesktopRam.Text = "RAM " +
                (value.RamUsedBytes / 1073741824.0).ToString("0.0") + "/" +
                (value.RamTotalBytes / 1073741824.0).ToString("0.0") + " GB";
            _d173DesktopDisk.Text = "Ổ đĩa " + D173Metric(value.DiskPercent);
            _d173DesktopNetwork.Text = "Mạng: " + value.NetworkKind +
                " · Internet " + (!value.InternetKnown ? "N/A" : value.InternetConnected ? "ON" : "OFF") +
                " · ↓" + D173Metric(value.NetworkDownMbps, " Mb/s") +
                " ↑" + D173Metric(value.NetworkUpMbps, " Mb/s");
            _d173DesktopProcess.Text = "Agent CPU " + D173Metric(value.ProcessCpuPercent) +
                " · RAM " + (value.ProcessWorkingSetBytes / 1048576.0).ToString("0") + " MiB";
            _d173CpuTrend.Push(value.CpuPercent);
            _d173GpuTrend.Push(value.GpuPercent);
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
                _autoSizeAgentColumnsButton.SetBounds(349, 90, Math.Max(68, width - 359), 29);
                _autoSizeAgentColumnsButton.Text = width < 515 ? "Cột" : "Cột tự động";
                const int fleetTop = 125;
                _agentFleetGrid.SetBounds(10, fleetTop, Math.Max(300, width - 20),
                    Math.Max(46, host.ClientSize.Height - fleetTop - 8));
            }
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
                    table.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(239, 244, 249);
                    table.ColumnHeadersDefaultCellStyle.ForeColor = Color.FromArgb(34, 52, 70);
                    table.GridColor = Color.FromArgb(228, 235, 241);
                    table.DefaultCellStyle.SelectionBackColor = Color.FromArgb(225, 239, 254);
                    table.DefaultCellStyle.SelectionForeColor = Color.FromArgb(25, 47, 77);
                }
                ApplyD173AntdUiTheme(child);
            }
        }
    }
}
