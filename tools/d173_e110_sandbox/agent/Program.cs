using System;
using System.Drawing;
using System.Net.Http;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;
using System.Threading;
using System.Threading.Tasks;

namespace SupraM2LabAgent;

internal static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new LabForm());
    }
}

public sealed class LabForm : Form
{
    // Fixed to localhost only. No WMS, Firestore, production host, OTA or Agent settings.
    private const string Api = "http://127.0.0.1:9897/command?uid=agent1&gen=1";
    private const string SocketApi = "ws://127.0.0.1:9897/socket?uid=agent1&gen=1";
    private static readonly HttpClient Client = new() {Timeout=TimeSpan.FromSeconds(6)};
    private readonly TextBox console = new(){Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Dock=DockStyle.Fill,Font=new Font("Consolas",10)};
    private readonly TextBox sku=new(){Text="SKU-004",Width=110};
    private readonly TextBox name=new(){Text="Hàng test",Width=140};
    private readonly TextBox location=new(){Text="D04",Width=80};
    private readonly TextBox message=new(){Text="Thông báo thử nghiệm",Width=210};
    private readonly ComboBox target=new(){Width=110,DropDownStyle=ComboBoxStyle.DropDownList};
    private readonly Label connection=new(){AutoSize=true,Text="Chưa kết nối",ForeColor=Color.DarkOrange};
    private readonly CancellationTokenSource lifetime = new();
    private ClientWebSocket? socket;
    public LabForm()
    {
        Text="SUPRA — M2 LAB AGENT (KHÔNG PRODUCTION)";
        Width=940;Height=680;MinimumSize=new Size(760,570);
        BackColor=Color.FromArgb(242,246,251);
        var outer=new TableLayoutPanel(){Dock=DockStyle.Fill,ColumnCount=1,RowCount=4,Padding=new Padding(16)};
        outer.RowStyles.Add(new RowStyle(SizeType.Absolute,55));
        outer.RowStyles.Add(new RowStyle(SizeType.Absolute,103));
        outer.RowStyles.Add(new RowStyle(SizeType.Absolute,102));
        outer.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        Controls.Add(outer);
        var header=new FlowLayoutPanel(){Dock=DockStyle.Fill};
        header.Controls.Add(new Label(){Text="SUPRA M2 · AGENT CLOUD LAB",Font=new Font("Segoe UI",16,FontStyle.Bold),AutoSize=true,Padding=new Padding(0,0,12,0)});
        header.Controls.Add(new Label(){Text="TEST LOCAL ONLY",ForeColor=Color.DarkRed,AutoSize=true,Padding=new Padding(12,10,12,0)});
        header.Controls.Add(connection); outer.Controls.Add(header,0,0);
        var skuRow=new FlowLayoutPanel(){Dock=DockStyle.Fill,AutoScroll=true};
        skuRow.Controls.Add(lbl("SKU:"));skuRow.Controls.Add(sku);skuRow.Controls.Add(lbl("Tên:"));skuRow.Controls.Add(name);
        skuRow.Controls.Add(lbl("Vị trí:"));skuRow.Controls.Add(location);
        skuRow.Controls.Add(btn("Cập nhật SKU",async()=>await Command("SKU_SYNC",new {sku=sku.Text,name=name.Text,location=location.Text})));
        skuRow.Controls.Add(btn("Danh sách",async()=>await Command("SNAPSHOT",new {})));
        skuRow.Controls.Add(btn("Usage LAB",async()=>await Command("METERS",new {})));
        outer.Controls.Add(skuRow,0,1);
        var chatRow=new FlowLayoutPanel(){Dock=DockStyle.Fill,AutoScroll=true};
        target.Items.AddRange(new object[]{"p1","p2"});target.SelectedIndex=0;
        chatRow.Controls.Add(lbl("Picker:"));chatRow.Controls.Add(target);
        chatRow.Controls.Add(lbl("Tin nhắn:"));chatRow.Controls.Add(message);
        chatRow.Controls.Add(btn("Gửi tin",async()=>await Command("CHAT",new {target=target.Text,message=message.Text})));
        chatRow.Controls.Add(btn("Gọi CV",async()=>await Command("CALL_CV",new {target=target.Text})));
        chatRow.Controls.Add(btn("Kết nối lại",async()=>await Reconnect()));
        outer.Controls.Add(chatRow,0,2);
        outer.Controls.Add(console,0,3);
        Log("Chỉ làm việc với 127.0.0.1:9897. Không có tài khoản/cấu hình Production.");
        Shown+=async (_,__)=>await Reconnect();
        FormClosing+=(_,__)=>{lifetime.Cancel(); try {socket?.Abort();}catch{} socket?.Dispose();};
    }
    private static Label lbl(string text)=>new(){Text=text,AutoSize=true,Padding=new Padding(0,8,0,0)};
    private Button btn(string text,Func<Task> run)
    {
        var b=new Button(){Text=text,AutoSize=true,Height=34,Padding=new Padding(5,0,5,0)};
        b.Click+=async (_,__)=>{b.Enabled=false;try{await run();}catch(Exception e){Log("Lỗi: "+e.GetType().Name);}finally{if(!IsDisposed)b.Enabled=true;}};
        return b;
    }
    private void Log(string line)
    {
        if(IsDisposed)return;
        if(InvokeRequired){BeginInvoke(new Action<string>(Log),line);return;}
        console.AppendText(DateTime.Now.ToString("HH:mm:ss")+" "+line+Environment.NewLine);
    }
    private async Task Command(string operation, object args)
    {
        var body=JsonSerializer.Serialize(new{request_id=Guid.NewGuid().ToString("N"),operation,args});
        using var payload=new StringContent(body,Encoding.UTF8,"application/json");
        try
        {
            var response=await Client.PostAsync(Api,payload,lifetime.Token);
            var data=await response.Content.ReadAsStringAsync(lifetime.Token);
            Log(operation+" → "+data);
        }
        catch(Exception e)when(e is HttpRequestException or TaskCanceledException)
        {Log("Không kết nối được LOCAL Worker: "+e.GetType().Name);}
    }
    private async Task Reconnect()
    {
        if(socket is not null){try{socket.Abort();socket.Dispose();}catch{}}
        socket=new ClientWebSocket();
        try {
            await socket.ConnectAsync(new Uri(SocketApi),lifetime.Token);
            connection.Text=" · WS local kết nối";connection.ForeColor=Color.ForestGreen;
            Log("WebSocket local đã kết nối; Agent Cloud (mô phỏng)");
            var current=socket;
            _=Task.Run(async()=>{
                var buffer=new byte[8192];
                while(current.State==WebSocketState.Open&&!lifetime.IsCancellationRequested){
                    try{
                        var result=await current.ReceiveAsync(new ArraySegment<byte>(buffer),lifetime.Token);
                        if(result.MessageType==WebSocketMessageType.Close)break;
                        var text=Encoding.UTF8.GetString(buffer,0,result.Count);
                        Log("WS "+text);
                    }catch(Exception e)when(e is WebSocketException or OperationCanceledException){break;}
                }
            });
        } catch(Exception e)when(e is WebSocketException or HttpRequestException or OperationCanceledException){
            connection.Text=" · Không có local Worker";connection.ForeColor=Color.DarkRed;
            Log("WS lỗi "+e.GetType().Name+"; HTTP vẫn có thể thử khi server mở");
        }
    }
}
