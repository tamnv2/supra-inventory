using System;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace D167SkuSyncTest
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            if (args.Length == 1 && args[0] == "--self-test")
                return SelfTests.Run();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            return 0;
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly Button openSupra = new Button();
        private readonly Button signIn = new Button();
        private readonly Button sync = new Button();
        private readonly TextBox user = new TextBox();
        private readonly TextBox password = new TextBox();
        private readonly CheckBox forceWeb = new CheckBox();
        private readonly CheckBox agentChannel = new CheckBox();
        private readonly Label info = new Label();
        private readonly TextBox log = new TextBox();
        private readonly WmsSession wms;
        private readonly InventoryClient inventory = new InventoryClient();
        private bool running;

        internal MainForm()
        {
            Text = "SUPRA Inventory - D167 Test đồng bộ SKU (ĐỘC LẬP)";
            Width = 800; Height = 610;
            MinimumSize = new Size(730, 550);
            Font = new Font("Segoe UI", 9.5f);
            StartPosition = FormStartPosition.CenterScreen;
            FormClosing += (s,e) => wms.Dispose();
            wms = new WmsSession(Write);

            var headline = new Label { Left = 20, Top = 12, Width = 735, Height = 45,
                Text = "KIỂM TRA ĐỒNG BỘ SKU - BETA\nĐăng nhập hai hệ thống riêng, sau đó chỉ cần nhấn ĐỒNG BỘ SKU.",
                Font = new Font("Segoe UI", 10f, FontStyle.Bold) };
            Controls.Add(headline);

            openSupra.SetBounds(20, 68, 250, 40); openSupra.Text = "1. MỞ & ĐĂNG NHẬP SUPRA";
            openSupra.Click += (s,e) => {
                try { wms.Open(); Write("Đã mở trình duyệt Supra riêng. Đăng nhập theo WMS, giữ trang mở."); }
                catch (Exception ex) { Write("MỞ SUPRA THẤT BẠI: " + ex.GetType().Name); }
            };
            Controls.Add(openSupra);
            Controls.Add(new Label { Left = 288, Top = 76, Width = 460, Height = 30,
                Text = "Không sử dụng hoặc điều khiển phiên Confirm của Agent chính." });

            Controls.Add(new Label { Left = 20, Top = 128, Width = 150, Text = "Tài khoản Inventory:" });
            user.SetBounds(170, 122, 220, 28); Controls.Add(user);
            Controls.Add(new Label { Left = 405, Top = 128, Width = 90, Text = "Mật khẩu / OTP:" });
            password.SetBounds(502, 122, 238, 28); password.UseSystemPasswordChar = true; Controls.Add(password);

            agentChannel.SetBounds(20, 162, 220, 28);
            agentChannel.Text = "Phiên AGENT riêng (đặc quyền)";
            agentChannel.Checked = false; Controls.Add(agentChannel);
            forceWeb.SetBounds(250, 162, 490, 28);
            forceWeb.Text = "Cho phép thay thế phiên WEB khác nếu bị báo xung đột";
            Controls.Add(forceWeb);

            signIn.SetBounds(20, 200, 250, 40); signIn.Text = "2. ĐĂNG NHẬP INVENTORY";
            signIn.Click += async (s,e) => await SignIn();
            Controls.Add(signIn);
            info.SetBounds(290, 200, 454, 42);
            info.Text = "Chưa đăng nhập Inventory"; Controls.Add(info);

            sync.SetBounds(20, 270, 250, 55); sync.Text = "3. ĐỒNG BỘ SKU";
            sync.Font = new Font("Segoe UI", 11, FontStyle.Bold);
            sync.Click += async (s,e) => await Sync();
            Controls.Add(sync);
            Controls.Add(new Label { Left = 290, Top = 273, Width = 445, Height = 55,
                Text = "Tải XLSX → lấy SKU + tên → preview tất cả lô → ghi Beta Service → kiểm tra lại. Không đồng bộ vị trí." });
            log.SetBounds(20, 345, 720, 210);
            log.Multiline = true; log.ReadOnly = true; log.ScrollBars = ScrollBars.Vertical;
            log.Anchor = AnchorStyles.Left | AnchorStyles.Top | AnchorStyles.Right | AnchorStyles.Bottom;
            Controls.Add(log);
            Write("Bản test biệt lập. Mặc định WEB: có thể xung đột phiên WEB hiện tại; không tự cưỡng chế đăng nhập.");
            Write("AGENT chỉ dùng khi Beta Service đã được duyệt triển khai route nhập SKU cho Agent.");
        }

        private async Task SignIn()
        {
            if (running) return;
            var u = user.Text.Trim();
            var secret = password.Text;
            var special = agentChannel.Checked;
            var force = forceWeb.Checked;
            if (u.Length == 0 || secret.Length == 0) { Write("Cần nhập tài khoản và mật khẩu/mã một lần."); return; }
            running = true; SetButtons(false);
            try
            {
                var role = await Task.Run(() => inventory.Login(u, secret, special, force));
                info.Text = "Inventory đã đăng nhập: " + role + (special ? " / AGENT" : " / WEB");
                Write("INVENTORY LOGIN PASS: " + role + (special ? " / AGENT" : " / WEB"));
            }
            catch (AppError ex)
            {
                Write("INVENTORY LOGIN FAIL: " + ex.Code);
            }
            catch (Exception ex) { Write("INVENTORY LOGIN FAIL: " + ex.GetType().Name); }
            finally
            {
                password.Clear(); running = false; SetButtons(true);
            }
        }

        private async Task Sync()
        {
            if (running) return;
            if (!inventory.IsAuthenticated) { Write("DỪNG: chưa đăng nhập Inventory."); return; }
            if (!wms.IsOpen) { Write("DỪNG: chưa mở và đăng nhập Supra."); return; }
            running = true; SetButtons(false);
            try
            {
                await Task.Run(() => new SkuSyncFlow(wms, inventory, Write).Run());
            }
            catch (AppError ex) { Write("SYNC FAIL: " + ex.Code); }
            catch (Exception ex) { Write("SYNC FAIL: " + ex.GetType().Name); }
            finally { running = false; SetButtons(true); }
        }

        private void SetButtons(bool enabled)
        {
            if (InvokeRequired) { BeginInvoke(new Action<bool>(SetButtons), enabled); return; }
            sync.Enabled = enabled; signIn.Enabled = enabled; openSupra.Enabled = enabled;
        }
        private void Write(string message)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action<string>(Write), message); return; }
            // Intentionally no raw HTTP response bodies, cookie/header/token or credentials.
            log.AppendText(DateTime.Now.ToString("HH:mm:ss") + " " + message + Environment.NewLine);
        }
    }

    internal sealed class AppError : Exception
    {
        internal string Code { get; private set; }
        internal AppError(string code) : base(code) { Code = code; }
    }
}
