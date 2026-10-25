using System;
using System.Drawing;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly TabPage _d173PerformancePage = new TabPage("Hiệu năng");
        private readonly System.Windows.Forms.Timer _d173PerformanceRefresh = new System.Windows.Forms.Timer();
        private readonly Label[] _d173PerformanceLabels = new Label[5];
        private readonly D173ResourceSparkline[] _d173PerformanceCharts = new D173ResourceSparkline[5];
        private bool _d173PerformanceInitialized;

        private void InitializeD173PerformancePage()
        {
            if (_d173PerformanceInitialized || _mainTabs == null) return;
            _d173PerformanceInitialized = true;
            _d173PerformancePage.BackColor = Color.FromArgb(243, 246, 248);
            var root = new TableLayoutPanel {
                Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 6,
                Padding = new Padding(12), BackColor = Color.FromArgb(243, 246, 248)
            };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 34f));
            for (int i = 0; i < 5; i++)
                root.RowStyles.Add(new RowStyle(SizeType.Percent, 20f));
            root.Controls.Add(new Label {
                Dock = DockStyle.Fill, Text = "HIỆU NĂNG DESKTOP · 60 MẪU GẦN NHẤT",
                Font = new Font("Segoe UI Semibold", 12f, FontStyle.Bold),
                ForeColor = Color.FromArgb(31, 51, 73),
                TextAlign = ContentAlignment.MiddleLeft
            }, 0, 0);
            var names = new[] { "CPU", "Bộ nhớ RAM", "GPU", "Ổ đĩa", "Mạng" };
            for (int i = 0; i < names.Length; i++)
            {
                var index = i;
                var row = new TableLayoutPanel {
                    Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1,
                    BackColor = Color.White, Margin = new Padding(0, 3, 0, 3),
                    Padding = new Padding(12, 6, 12, 6)
                };
                row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24f));
                row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 76f));
                var label = new Label {
                    Text = names[i] + " · Đang thu thập",
                    Dock = DockStyle.Fill,
                    TextAlign = ContentAlignment.MiddleLeft,
                    Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                    ForeColor = Color.FromArgb(40, 60, 82),
                    AutoEllipsis = true
                };
                var chart = new D173ResourceSparkline { Dock = DockStyle.Fill };
                chart.AutoScale = index == 4; // Mbps has no fixed 0..100% upper bound.
                _d173PerformanceLabels[i] = label;
                _d173PerformanceCharts[i] = chart;
                row.Controls.Add(label, 0, 0);
                row.Controls.Add(chart, 1, 0);
                root.Controls.Add(row, 0, i + 1);
            }
            _d173PerformancePage.Controls.Add(root);
            _mainTabs.TabPages.Add(_d173PerformancePage);
            _d173PerformanceRefresh.Interval = 5000; // Default local-only 5s, selectable 1/2/5/10s on Overview.
            _d173PerformanceRefresh.Tick += (sender, args) =>
            {
                if (IsDisposed || !Visible || WindowState == FormWindowState.Minimized ||
                    _mainTabs.SelectedTab != _d173PerformancePage) return;
                if (Interlocked.CompareExchange(ref _trayMonitorRefreshRunning, 1L, 0L) != 0L) return;
                Task.Run(() =>
                {
                    try {
                        var value = _systemMonitor.Sample();
                        Ui(() => ApplyD173DesktopMetrics(value));
                    } catch {
                        // Local performance counters may be unavailable on restricted Windows.
                    } finally {
                        Interlocked.Exchange(ref _trayMonitorRefreshRunning, 0L);
                    }
                });
            };
            _d173PerformanceRefresh.Start();
            FormClosed += (sender, args) => {
                _d173PerformanceRefresh.Stop();
                _d173PerformanceRefresh.Dispose();
            };
        }

        private void ApplyD173DetailedMetrics(SystemMetrics metrics)
        {
            if (!_d173PerformanceInitialized || metrics == null ||
                _mainTabs.SelectedTab != _d173PerformancePage) return;
            var ramPercent = metrics.RamTotalBytes > 0 ?
                metrics.RamUsedBytes * 100.0 / metrics.RamTotalBytes : -1;
            var networkMbps = Math.Max(0, metrics.NetworkDownMbps) +
                Math.Max(0, metrics.NetworkUpMbps);
            var values = new[] {
                metrics.CpuPercent, ramPercent, metrics.GpuPercent,
                metrics.DiskPercent, networkMbps
            };
            var titles = new[] {
                "CPU · " + D173Metric(metrics.CpuPercent),
                "RAM · " + (metrics.RamUsedBytes / 1073741824.0).ToString("0.0") +
                    " / " + (metrics.RamTotalBytes / 1073741824.0).ToString("0.0") + " GB",
                "GPU · " + D173Metric(metrics.GpuPercent),
                "Ổ đĩa · " + D173Metric(metrics.DiskPercent),
                "Mạng · ↓" + D173Metric(metrics.NetworkDownMbps," Mb/s") +
                    " ↑" + D173Metric(metrics.NetworkUpMbps," Mb/s")
            };
            for (int i = 0; i < 5; i++) {
                var label = _d173PerformanceLabels[i];
                var chart = _d173PerformanceCharts[i];
                if (label != null && !label.IsDisposed) label.Text = titles[i];
                if (chart != null && !chart.IsDisposed) chart.Push(values[i]);
            }
        }
    }
}
