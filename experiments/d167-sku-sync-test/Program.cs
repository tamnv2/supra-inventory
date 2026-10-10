using System;
using System.Drawing;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace D167SkuSyncTest
{
    internal static class Program
    {
        private const string PipeName = "Supra.Inventory.D167SkuTest";
        [STAThread]
        private static int Main(string[] args)
        {
            if (args.Length == 1 && args[0] == "--self-test") return SelfTest();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SyncForm());
            return 0;
        }

        private static int SelfTest()
        {
            var server = Task.Run(() => {
                using (var pipe = new NamedPipeServerStream(PipeName, PipeDirection.InOut, 1))
                {
                    pipe.WaitForConnection();
                    using (var reader = new StreamReader(pipe, Encoding.UTF8, false, 1024, true))
                    using (var writer = new StreamWriter(pipe, new UTF8Encoding(false), 1024, true) { AutoFlush = true })
                    {
                        var command = reader.ReadLine();
                        if (!command.Contains("SKU_EXPORT_IMPORT")) throw new Exception("Bad request");
                        writer.WriteLine("{\"status\":\"TEST_ACK\",\"downloaded\":false,\"uploaded\":false}");
                    }
                }
            });
            var reply = SendCommand("self-test");
            server.GetAwaiter().GetResult();
            if (!reply.Contains("TEST_ACK")) return 2;
            Console.WriteLine("D167 IPC contract self-test PASS; no live service mutation");
            return 0;
        }

        private static string SendCommand(string runId)
        {
            // No cross-process credential access. Only an explicitly authorized local
            // Agent bridge may execute WMS export and Service import on the user's behalf.
            using (var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.InOut))
            {
                pipe.Connect(3000);
                pipe.ReadTimeout = 15000;
                pipe.WriteTimeout = 3000;
                using (var reader = new StreamReader(pipe, Encoding.UTF8, false, 1024, true))
                using (var writer = new StreamWriter(pipe, new UTF8Encoding(false), 1024, true) { AutoFlush = true })
                {
                    var request = new JavaScriptSerializer().Serialize(new {
                        version = 1,
                        operation = "SKU_EXPORT_IMPORT",
                        request_id = runId,
                        source = "D167_ISOLATED_TEST",
                        sku_name_only = true
                    });
                    writer.WriteLine(request);
                    var result = reader.ReadLine();
                    if (String.IsNullOrWhiteSpace(result)) throw new IOException("No broker response");
                    return result;
                }
            }
        }

        private sealed class SyncForm : Form
        {
            private readonly Button button = new Button();
            private readonly TextBox output = new TextBox();
            internal SyncForm()
            {
                Text = "D167 - Agent test đồng bộ SKU (độc lập)";
                Width = 650;
                Height = 345;
                StartPosition = FormStartPosition.CenterScreen;
                Font = new Font("Segoe UI", 10);
                Controls.Add(new Label {
                    Left = 18, Top = 18, Width = 585, Height = 48,
                    Text = "Bản kiểm thử độc lập; không thay đổi Agent chính.\r\nChỉ SKU + Tên sản phẩm; không xử lý vị trí."
                });
                button.SetBounds(18, 80, 200, 45);
                button.Text = "ĐỒNG BỘ SKU";
                button.Click += async (s, e) => await Execute();
                Controls.Add(button);
                output.SetBounds(18, 140, 585, 145);
                output.Multiline = true; output.ScrollBars = ScrollBars.Vertical;
                output.ReadOnly = true; output.Anchor = AnchorStyles.Left | AnchorStyles.Top | AnchorStyles.Right | AnchorStyles.Bottom;
                Controls.Add(output);
                Write("Sẵn sàng. Chưa có bằng chứng kết nối Main Agent/Service.");
            }

            private async Task Execute()
            {
                button.Enabled = false;
                Write("Đang yêu cầu Agent chính thực hiện một lượt xuất và nhập SKU...");
                try
                {
                    var result = await Task.Run(() => SendCommand(Guid.NewGuid().ToString("N")));
                    var obj = new JavaScriptSerializer().DeserializeObject(result) as System.Collections.Generic.Dictionary<string, object>;
                    object status, downloaded, uploaded;
                    if (obj == null || !obj.TryGetValue("status", out status) ||
                        !obj.TryGetValue("downloaded", out downloaded) || !obj.TryGetValue("uploaded", out uploaded))
                        throw new InvalidDataException("Invalid broker receipt");
                    var saved = Boolean.TryParse(Convert.ToString(downloaded), out var d) && d;
                    var committed = Boolean.TryParse(Convert.ToString(uploaded), out var u) && u;
                    if (String.Equals(Convert.ToString(status), "DONE", StringComparison.Ordinal) && saved && committed)
                        Write("ĐÃ XÁC NHẬN: WMS export và Inventory Service import đều thành công.");
                    else
                        Write("CHƯA HOÀN TẤT: " + Convert.ToString(status) + " · đã tải=" + saved + " · đã nhập=" + committed);
                }
                catch (TimeoutException) { Write("CHƯA KẾT NỐI: Agent chính không có giao diện chia sẻ phiên được cấp quyền."); }
                catch (IOException) { Write("CHƯA KẾT NỐI: chưa có dịch vụ giao tiếp nội bộ phù hợp."); }
                catch (Exception ex) { Write("LỖI: " + ex.GetType().Name + ". Không tuyên bố đã cập nhật Service."); }
                finally { button.Enabled = true; }
            }

            private void Write(string text) => output.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + text + Environment.NewLine);
        }
    }
}
