using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SupraSkuRecorder
{
    internal sealed partial class RecorderForm : Form
    {
        internal const string WmsHost = "wms-supra.winmart.vn";
        internal const string AuthHost = "auth-supra.winmart.vn";
        internal const string InventoryHost = "inventory-beta.supra.cc.cd";
        internal const string WmsStart = "https://wms-supra.winmart.vn/";
        internal const string InventoryStart = "https://inventory-beta.supra.cc.cd/";
        internal readonly WebView2 browser = new WebView2 { Dock = DockStyle.Fill };
        internal readonly SafeEventLog log = new SafeEventLog();
        internal readonly List<Form> popups = new List<Form>();
        internal CoreWebView2Environment environment;
        private Process agentHost;
        private bool ready;
        internal bool recording = true;
        private readonly Label status = new Label
        {
            AutoSize = false, Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft, Text = "Chưa kết nối Agent WebView2"
        };

        internal RecorderForm()
        {
            Text = "SUPRA SKU Recorder — D166 (ghi nhận thao tác)";
            Width = 1200; Height = 800;
            StartPosition = FormStartPosition.CenterScreen;
            var bar = new TableLayoutPanel
            {
                Dock = DockStyle.Top, Height = 48, ColumnCount = 5, RowCount = 1,
                Padding = new Padding(6)
            };
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 140));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            AddButton(bar, 0, "Mở Supra", () => Navigate(WmsStart));
            AddButton(bar, 1, "Inventory Beta", () => Navigate(InventoryStart));
            AddButton(bar, 2, "Xuất log ZIP", Export);
            AddButton(bar, 3, "Dừng / Tiếp", () =>
            {
                recording = !recording;
                log.Write("RECORDING_TOGGLE", recording ? "enabled" : "disabled", "manual");
                status.Text = recording ? "Đang ghi lại thao tác" : "Đã tạm dừng ghi";
            });
            bar.Controls.Add(status, 4, 0);
            Controls.Add(browser);
            Controls.Add(bar);
            Shown += async (sender, args) => await Initialize();
            FormClosed += (sender, args) =>
            {
                foreach (var popup in popups.ToArray())
                    try { popup.Close(); } catch { }
                if (agentHost != null) agentHost.Dispose();
                log.Dispose();
            };
        }

        private static void AddButton(TableLayoutPanel bar, int column,
            string title, Action action)
        {
            var button = new Button { Dock = DockStyle.Fill, Text = title };
            button.Click += (s, e) => action();
            bar.Controls.Add(button, column, 0);
        }

        private async Task Initialize()
        {
            try
            {
                // No direct Agent control API: read only the local host's launch
                // options to join its existing WebView2 process with exact settings.
                var agent = AgentBrowserIdentity.Find();
                agentHost = Process.GetProcessById(agent.HostPid);
                agentHost.EnableRaisingEvents = true;
                agentHost.Exited += (s, e) =>
                {
                    try { if (IsHandleCreated) BeginInvoke((Action)(() => Close())); }
                    catch { }
                };
                var options = new CoreWebView2EnvironmentOptions(
                    "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" +
                    agent.DebugPort);
                environment = await CoreWebView2Environment.CreateAsync(
                    agent.Runtime, agent.Profile, options);
                await browser.EnsureCoreWebView2Async(environment);
                await Hook(browser);
                if (agentHost.HasExited)
                    throw new InvalidOperationException("Agent browser đã kết thúc");
                ready = true;
                status.Text = "Dùng chung phiên WebView2 · chỉ quan sát";
                log.Write("SESSION_JOINED", "agent_profile", "shared_webview2");
                browser.CoreWebView2.Navigate(WmsStart);
            }
            catch
            {
                log.Write("SESSION_JOIN_FAILED", "webview2", "unavailable");
                MessageBox.Show("Không thể kết nối phiên WebView2 của Agent. " +
                    "Mở Agent và Web Agent trước; chỉ chạy một phiên Agent trên máy. " +
                    "Không được sao chép profile đăng nhập để khắc phục.",
                    "SKU Recorder", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Close();
            }
        }

        private void Navigate(string url)
        {
            if (!ready || browser.CoreWebView2 == null) return;
            browser.CoreWebView2.Navigate(url);
        }

        internal void Log(string evt, string category, string detail, long number = 0)
        {
            if (recording) log.Write(evt, category, detail, number);
        }

        private void Export()
        {
            try
            {
                log.Write("EVIDENCE_EXPORTED", "zip", "manual");
                var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                var path = Path.Combine(desktop, "SUPRA_SKU_Recorder_" + log.RunId + ".zip");
                log.ExportZip(path);
                status.Text = "Đã xuất ZIP trên Desktop";
                MessageBox.Show("Đã xuất ZIP. Log chỉ ghi nhận thao tác giao diện " +
                    "và tải file, không xác nhận việc import thành công trên server.",
                    "SKU Recorder", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch
            {
                log.Write("EVIDENCE_EXPORT_FAILED", "zip", "io_error");
                MessageBox.Show("Không xuất được ZIP. Kiểm tra quyền ghi Desktop " +
                    "và đảm bảo không có ZIP trùng tên.", "SKU Recorder");
            }
        }
    }
}
