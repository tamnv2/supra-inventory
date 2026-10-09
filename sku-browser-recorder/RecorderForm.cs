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
        internal const string WmsStart = "https://wms-supra.winmart.vn/sft3/app/report/bin-inventory";
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
                Dock = DockStyle.Top, Height = 48, ColumnCount = 8, RowCount = 1,
                Padding = new Padding(6)
            };
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 125));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 125));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
            bar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            AddButton(bar, 0, "Bin Inventory", () => Navigate(WmsStart));
            AddButton(bar, 1, "Inventory Beta", () => Navigate(InventoryStart));
            AddButton(bar, 2, "Xuất log ZIP", Export);
            AddButton(bar, 3, "Dừng / Tiếp", () =>
            {
                recording = !recording;
                log.Write("RECORDING_TOGGLE", recording ? "enabled" : "disabled", "manual");
                status.Text = recording ? "Đang ghi lại thao tác" : "Đã tạm dừng ghi";
            });
            AddButton(bar, 4, "Quét nút SKU", () => { _ = CaptureSkuUiAsync(); });
            AddButton(bar, 5, "Kiểm tra Excel", SelectSkuWorkbook);
            AddButton(bar, 6, "Thử Tìm→Export", () => { _ = StartManualSkuExportAsync(); });
            bar.Controls.Add(status, 7, 0);
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
            log.Write("EVIDENCE_EXPORT_START", "zip", "manual");
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var local = Path.Combine(Environment.GetFolderPath(
                Environment.SpecialFolder.LocalApplicationData), "SUPRA", "SKU-Recorder", "Exports");
            var attempts = new List<string>();
            string output = null;
            string destinationAlias = "";
            foreach (var target in new[]
            {
                new { Folder = desktop, Alias = "desktop" },
                new { Folder = local, Alias = "local_backup" }
            })
            {
                try
                {
                    output = log.ExportZip(target.Folder);
                    destinationAlias = target.Alias;
                    break;
                }
                catch (Exception ex)
                {
                    // Classification only: never expose exception messages, which may
                    // contain local profile paths or filesystem names.
                    var category = ex is UnauthorizedAccessException ? "permission_denied" :
                        ex is IOException ? "file_io" :
                        ex is ArgumentException ? "invalid_path" : "unexpected";
                    log.Write("EVIDENCE_EXPORT_RETRY", target.Alias, category,
                        unchecked((uint)ex.HResult));
                    attempts.Add(target.Alias + ": " + category +
                        " (0x" + ex.HResult.ToString("X8") + ")");
                }
            }
            if (output == null)
            {
                log.Write("EVIDENCE_EXPORT_FAILED", "zip", "all_locations_failed");
                MessageBox.Show("Không thể lưu ZIP ở Desktop hoặc thư mục dự phòng.\n" +
                    string.Join("\n", attempts) +
                    "\n\nNhật ký JSONL gốc vẫn được giữ trong thư mục dữ liệu người dùng.",
                    "SKU Recorder - lỗi xuất log", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            log.Write("EVIDENCE_EXPORTED", destinationAlias, "success");
            status.Text = "Đã xuất ZIP: " + destinationAlias;
            MessageBox.Show("Đã xuất ZIP thành công:\n" + output +
                "\n\nMỗi lần xuất sẽ tạo tệp mới, không ghi đè ZIP trước đó." +
                "\nDữ liệu chỉ ghi nhận thao tác và tải tệp, chưa xác minh SKU được Service nhập.",
                "SKU Recorder", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

    }
}
