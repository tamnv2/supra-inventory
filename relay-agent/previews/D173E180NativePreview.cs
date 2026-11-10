// D173-E180 REVIEW ONLY: genuine WinForms executable layout; no production calls.
// Source-aligned control types: TableLayoutPanel, Panel, DataGridView, TabControl, Buttons,
// TextBox, ComboBox. References: Program.cs, D119AgentFeatures.cs, D173DesktopResources.cs.
using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using System.IO;
namespace SupraInventoryRelayAgent.NativePreview {
 internal class App : Form {
 static readonly Color Teal=Color.FromArgb(0,144,139),Text=Color.FromArgb(32,55,73),Gray=Color.FromArgb(111,129,146),Bg=Color.FromArgb(246,248,250),Line=Color.FromArgb(220,230,236);
 Panel upper,agent,web,pick,res; TableLayoutPanel cols,mid; TabControl tabs; DataGridView roster; CheckBox rosterTech; string reviewMode; int mode;
 static Label Label(string s,int size,bool strong=false) {return new Label{Text=s,ForeColor=strong?Text:Gray,Font=new Font("Segoe UI",size,strong?FontStyle.Bold:FontStyle.Regular),Dock=DockStyle.Fill,AutoEllipsis=true,TextAlign=ContentAlignment.MiddleLeft};}
 static TableLayoutPanel Table(int nc,int nr) {return new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=nc,RowCount=nr,Margin=Padding.Empty,Padding=Padding.Empty,AutoScroll=false,GrowStyle=TableLayoutPanelGrowStyle.FixedSize};}
 static Panel Card(){return new Panel{Dock=DockStyle.Fill,Padding=new Padding(11),BackColor=Color.White,BorderStyle=BorderStyle.FixedSingle,Margin=new Padding(5)};}
 static Button Btn(string s,bool active=false) {var b=new Button{Text=s,Dock=DockStyle.Fill,FlatStyle=FlatStyle.Flat,BackColor=active?Teal:Color.FromArgb(242,246,249),ForeColor=active?Color.White:Text,Font=new Font("Segoe UI",8),Margin=new Padding(2),UseVisualStyleBackColor=false};b.FlatAppearance.BorderColor=active?Teal:Line;return b;}
 static DataGridView Grid(bool vertical){var g=new DataGridView{Dock=DockStyle.Fill,BackgroundColor=Color.White,BorderStyle=BorderStyle.None,RowHeadersVisible=false,AllowUserToAddRows=false,AllowUserToDeleteRows=false,ReadOnly=true,AllowUserToResizeRows=false,AllowUserToResizeColumns=false,ColumnHeadersHeight=27,ColumnHeadersHeightSizeMode=DataGridViewColumnHeadersHeightSizeMode.DisableResizing,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill,ScrollBars=vertical?ScrollBars.Vertical:ScrollBars.None,EnableHeadersVisualStyles=false,GridColor=Line,Font=new Font("Segoe UI",8),RowTemplate={Height=30},ColumnHeadersDefaultCellStyle={BackColor=Color.FromArgb(239,245,248),ForeColor=Gray,Font=new Font("Segoe UI",8,FontStyle.Bold)},DefaultCellStyle={ForeColor=Text,SelectionBackColor=Color.FromArgb(228,242,246),SelectionForeColor=Text}};g.SelectionChanged+=(s,e)=>g.ClearSelection();return g;}
 static void Col(DataGridView g,string name,float weight,bool button=false){DataGridViewColumn c=button?(DataGridViewColumn)new DataGridViewButtonColumn():new DataGridViewTextBoxColumn();c.HeaderText=name;c.FillWeight=weight;c.MinimumWidth=36;c.SortMode=DataGridViewColumnSortMode.NotSortable;g.Columns.Add(c);}
 public App(int w,int h,string selected) {
  Font=new Font("Segoe UI",9);BackColor=Bg;FormBorderStyle=FormBorderStyle.None;ClientSize=new Size(w,h);AutoScaleMode=AutoScaleMode.None;reviewMode=selected;
  var root=Table(2,1);root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,195));root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));root.RowStyles.Add(new RowStyle(SizeType.Percent,100));Controls.Add(root);
  root.Controls.Add(Side(),0,0);
  var page=Table(1,3);page.RowStyles.Add(new RowStyle(SizeType.Absolute,56));page.RowStyles.Add(new RowStyle(SizeType.Percent,100));page.RowStyles.Add(new RowStyle(SizeType.Absolute,20));page.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));root.Controls.Add(page,1,0);
  var header=Table(2,2);header.Margin=new Padding(10,4,10,0);header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,60));header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,40));header.RowStyles.Add(new RowStyle(SizeType.Absolute,29));header.RowStyles.Add(new RowStyle(SizeType.Absolute,19));
  header.Controls.Add(Label("Tổng quan vận hành",14,true),0,0);header.Controls.Add(Label("Agent · Web Confirm · PickList · Phiên hoạt động",8),0,1);
  header.Controls.Add(new Label{Text="● Agent sẵn sàng    ● Web sẵn sàng    ● Mạng đầy đủ",ForeColor=Teal,Font=new Font("Segoe UI",8,FontStyle.Bold),TextAlign=ContentAlignment.MiddleRight,Dock=DockStyle.Fill},1,0);
  header.Controls.Add(new Label{Text="WINFORMS THỰC · DỮ LIỆU MINH HỌA · KHÔNG KẾT NỐI",ForeColor=Gray,Font=new Font("Segoe UI",7.5f),TextAlign=ContentAlignment.MiddleRight,Dock=DockStyle.Fill},1,1);page.Controls.Add(header,0,0);
  var overview=Table(1,2);overview.Margin=new Padding(6,0,6,0);overview.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));overview.RowStyles.Add(new RowStyle(SizeType.Percent,50));overview.RowStyles.Add(new RowStyle(SizeType.Percent,50));page.Controls.Add(overview,0,1);
  upper=new Panel{Dock=DockStyle.Fill,AutoScroll=false};overview.Controls.Add(upper,0,0);overview.Controls.Add(Roster(),0,1);
  page.Controls.Add(new Label{Text="BẢN REVIEW WINFORMS · CHƯA TRIỂN KHAI AGENT · FIELD / OWNER PENDING",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleRight,ForeColor=Gray,Font=new Font("Segoe UI",7.3f)},0,2);
  agent=Agent();web=Web();pick=Pick();res=Resource();
  cols=Table(3,1);cols.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,44));cols.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,35));cols.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,21));cols.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  mid=Table(1,2);mid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));mid.RowStyles.Add(new RowStyle(SizeType.Percent,54));mid.RowStyles.Add(new RowStyle(SizeType.Percent,46));
  tabs=new TabControl{Dock=DockStyle.Fill,Visible=false,Margin=new Padding(5),Font=new Font("Segoe UI",9),Padding=new Point(10,5)};
  foreach(string n in new[]{"Hệ thống Agent","Web Confirm","Xử lý PickList","Tài nguyên Desktop"})tabs.TabPages.Add(n);
  upper.Controls.Add(cols);upper.Controls.Add(tabs);upper.Resize+=(s,e)=>Arrange();Arrange();
  if(mode==2){if(selected=="pick")tabs.SelectedIndex=2;if(selected=="web")tabs.SelectedIndex=1;}
 }
 Panel Side(){
  var p=new Panel{Dock=DockStyle.Fill,BackColor=Color.White,Padding=new Padding(8),BorderStyle=BorderStyle.FixedSingle};
  var brand=new Panel{Dock=DockStyle.Top,Height=67};
  brand.Controls.Add(new Label{Text="SUPRA Agent",Font=new Font("Segoe UI",14,FontStyle.Bold),ForeColor=Teal,Location=new Point(8,4),Size=new Size(170,32)});
  brand.Controls.Add(new Label{Text="Pick Pack 1291",Font=new Font("Segoe UI",8),ForeColor=Gray,Location=new Point(8,35),Size=new Size(160,18)});
  var nav=new Panel{Dock=DockStyle.Top,Height=275};
  string[] names={"Tổng quan vận hành","Đồng bộ danh mục SKU","Trình duyệt xác nhận","Lịch sử PickList","Giám sát mức sử dụng"};
  for(int i=0;i<5;i++){var b=Btn(names[i],i==0);b.Dock=DockStyle.None;b.TextAlign=ContentAlignment.MiddleLeft;b.SetBounds(3,6+i*53,171,43);nav.Controls.Add(b);}
  var bottom=new Panel{Dock=DockStyle.Bottom,Height=205};var bt=Table(1,7);bt.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));foreach(int sz in new[]{22,32,33,33,24,35})bt.RowStyles.Add(new RowStyle(SizeType.Absolute,sz));bt.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  bt.Controls.Add(Label("TIỆN ÍCH NHANH",8,true),0,0);bt.Controls.Add(new CheckBox{Text="Tự khởi động Windows",Checked=true,Dock=DockStyle.Fill,Font=new Font("Segoe UI",8)},0,1);
  bt.Controls.Add(Btn("Chọn mạng"),0,2);bt.Controls.Add(Btn("Log"),0,3);bt.Controls.Add(Label("GIAO DIỆN",8,true),0,4);
  var modeBar=Table(3,1);for(int i=0;i<3;i++)modeBar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,33.333f));modeBar.RowStyles.Add(new RowStyle(SizeType.Percent,100));modeBar.Controls.Add(Btn("Sáng",true),0,0);modeBar.Controls.Add(Btn("Auto"),1,0);modeBar.Controls.Add(Btn("Tối"),2,0);bt.Controls.Add(modeBar,0,5);bt.Controls.Add(Label("Agent178 · Review native",7),0,6);bottom.Controls.Add(bt);
  p.Controls.Add(bottom);p.Controls.Add(nav);p.Controls.Add(brand);return p;
 }
 Panel Agent(){
  var p=Card();
  var t=Table(1,9);t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
  foreach(int h in new[]{23,16,16,16,28,24,18})t.RowStyles.Add(new RowStyle(SizeType.Absolute,h));
  t.RowStyles.Add(new RowStyle(SizeType.Percent,100));t.RowStyles.Add(new RowStyle(SizeType.Absolute,15));
  t.Controls.Add(Label("HỆ THỐNG AGENT  |  Sẵn sàng  |  admin  |  Quản trị Pick Pack",10,true),0,0);
  t.Controls.Add(Label("Tài khoản quản trị: admin · PRIMARY · Dự phòng: 2",8),0,1);
  t.Controls.Add(Label("Chế độ nhận tin từ PDA: NEXT-B · Relay: NEXT-B · Không đọc queue PDA",8),0,2);
  t.Controls.Add(Label("CPU: 0,2%  |  RAM: 112 MB  |  Thời gian chạy: 00:02:32",8),0,3);
  var actions=Table(5,1);
  for(int i=0;i<5;i++) actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,20F));
  actions.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  string[] a={"Đăng xuất","Cập nhật","Xuống nền","Chuyển chính","Tắt Agent"};
  for(int i=0;i<a.Length;i++) actions.Controls.Add(Btn(a[i],false),i,0);
  t.Controls.Add(actions,0,4);
  var network=Table(2,1);
  network.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,62));
  network.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,38));
  network.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  network.Controls.Add(new Label{Text="Mạng: Mạng đầy đủ  |  Wi-Fi: WiFi-Mesh",Dock=DockStyle.Fill,Font=new Font("Segoe UI",8),ForeColor=Teal,TextAlign=ContentAlignment.MiddleLeft},0,0);
  network.Controls.Add(Btn("Làm mới phân loại mạng"),1,0);
  t.Controls.Add(network,0,5);
  t.Controls.Add(Label("DANH SÁCH AGENT  ·  3 máy  |  Dữ liệu đồng bộ realtime",8,true),0,6);
  var fleet=Grid(false);
  fleet.RowTemplate.Height=23;fleet.ColumnHeadersHeight=21;
  foreach(var c in new[]{
     new {n="Tài khoản",w=16f},new {n="Máy",w=24f},new {n="Vai trò",w=13f},
     new {n="Web Confirm",w=18f},new {n="Phiên bản",w=12f},new {n="Cập nhật",w=17f}})
     Col(fleet,c.n,c.w);
  fleet.Rows.Add("admin","VPS","PRIMARY","Sẵn sàng","178","vừa xong");
  fleet.Rows.Add("admin","21-TAMNV2-L","NEXT_A","Sẵn sàng","178","1 phút");
  fleet.Rows.Add("admin","ADMIN-PC","NEXT_B","Sẵn sàng","178","2 phút");
  fleet.DefaultCellStyle.WrapMode=DataGridViewTriState.True;
  foreach(DataGridViewRow row in fleet.Rows)row.Height=23;
  if(reviewMode=="overtime"){
    var block=Table(1,2);
    block.RowStyles.Add(new RowStyle(SizeType.Absolute,32));
    block.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    block.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
    var overtime=Table(4,1);
    overtime.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    for(int k=0;k<4;k++)overtime.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,25));
    string[] overtimeActions={"Tăng ca thêm 1 giờ","Đúng giờ về","Huỷ tăng ca","Bật sớm trước 05:45"};
    for(int k=0;k<4;k++)overtime.Controls.Add(Btn(overtimeActions[k]),k,0);
    block.Controls.Add(overtime,0,0);
    block.Controls.Add(fleet,0,1);
    t.Controls.Add(block,0,7);
    t.Controls.Add(Label("Tăng ca đang chờ quyết định · thông tin và nút đầy đủ theo bản 177.",7),0,8);
  }else{
    t.Controls.Add(fleet,0,7);
    t.Controls.Add(Label("Tăng ca: Không phát sinh · Khi kích hoạt sẽ hiển thị đủ 4 nút nghiệp vụ.",7),0,8);
  }
  p.Controls.Add(t);return p;
}
 Panel Web(){
  var p=Card();
  var t=Table(1,9);t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
  foreach(int h in new[]{22,17,30,28,25,17,20,17})t.RowStyles.Add(new RowStyle(SizeType.Absolute,h));
  t.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  t.Controls.Add(Label("ĐĂNG NHẬP SUPRA  |  Web Agent  |  Sẵn sàng",10,true),0,0);
  t.Controls.Add(Label("CPU 0,9% · RAM 609 MB · Tiến trình: 8 · Thời gian chạy: 00:02:31",8),0,1);
  var primary=Table(2,1);primary.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));primary.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));primary.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  primary.Controls.Add(Btn("Tắt Web Agent"),0,0);
  primary.Controls.Add(Btn("Chuyển sang Web Desktop"),1,0);
  t.Controls.Add(primary,0,2);
  var helpers=Table(3,1);foreach(int w in new[]{23,41,36})helpers.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,w));helpers.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  helpers.Controls.Add(Btn("Kiểm tra"),0,0);
  helpers.Controls.Add(Btn("Tải trình duyệt Agent"),1,0);
  helpers.Controls.Add(Btn("Bảo vệ Web"),2,0);t.Controls.Add(helpers,0,3);
  var folders=Table(2,1);folders.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,58));folders.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,42));folders.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  folders.Controls.Add(Btn("Mở thư mục dữ liệu"),0,0);
  folders.Controls.Add(Btn("Đổi nơi lưu"),1,0);t.Controls.Add(folders,0,4);
  var status1=Table(2,1);status1.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));status1.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));status1.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  status1.Controls.Add(Label("Web Confirm: Đang hoạt động",8),0,0);
  status1.Controls.Add(Label("HY1 · Trình duyệt đã mở",8),1,0);t.Controls.Add(status1,0,5);
  var status2=Table(3,1);status2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,49));status2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,28));status2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,23));status2.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  status2.Controls.Add(Label("Trình duyệt Agent: Fixed 157.0.4341.42",8),0,0);
  status2.Controls.Add(Label("Bundle: Đã tải 100%",8),1,0);
  status2.Controls.Add(new ProgressBar{Value=100,Minimum=0,Maximum=100,Dock=DockStyle.Fill,Margin=new Padding(1,3,1,3)},2,0);
  t.Controls.Add(status2,0,6);
  var status3=Table(2,1);status3.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));status3.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));status3.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  status3.Controls.Add(Label("Dữ liệu Agent: 1,07 GB",8),0,0);
  status3.Controls.Add(Label("Runtime cài đặt: 0 B · Cache 329,1 MB",8),1,0);t.Controls.Add(status3,0,7);
  t.Controls.Add(Label("Web Agent đang khả dụng · WebView2 Fixed 157.0.4341.42",8),0,8);
  p.Controls.Add(t);return p;
}
 Panel Pick(){
  var p=Card();
  var t=Table(1,5);t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
  t.RowStyles.Add(new RowStyle(SizeType.Absolute,24));
  t.RowStyles.Add(new RowStyle(SizeType.Absolute,33));
  t.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  t.RowStyles.Add(new RowStyle(SizeType.Absolute,20));
  t.RowStyles.Add(new RowStyle(SizeType.Absolute,16));
  t.Controls.Add(Label("XỬ LÝ PICKLIST  |  Sẵn sàng",10,true),0,0);
  var q=Table(3,1);q.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,47));q.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,21));q.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,32));q.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  q.Controls.Add(new TextBox{Text="123456, 789012",Font=new Font("Segoe UI",8),Dock=DockStyle.Fill,Margin=new Padding(2,4,2,4)},0,0);
  q.Controls.Add(Btn("Tìm kiếm",true),1,0);
  q.Controls.Add(Btn("Xác nhận tất cả"),2,0);t.Controls.Add(q,0,1);
  var results=Grid(false);results.ColumnHeadersHeight=22;results.RowTemplate.Height=26;
  Col(results,"PickList",45);Col(results,"Thao tác",22,true);Col(results,"Trạng thái",33);
  results.Rows.Add("123456","Xác nhận","Chờ xác nhận");
  results.Rows.Add("789012","Xác nhận","Chờ xác nhận");
  t.Controls.Add(results,0,2);
  t.Controls.Add(Label("Trạng thái: Đã tìm thấy 2 PickList hợp lệ",8,true),0,3);
  t.Controls.Add(Label("Mã có thể dài hơn 3 số; nhiều mã ngăn cách bằng dấu phẩy.",7),0,4);
  p.Controls.Add(t);return p;
}
 Panel Resource(){
  var p=Card();var t=Table(1,6);t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));t.RowStyles.Add(new RowStyle(SizeType.Absolute,39));for(int i=0;i<5;i++)t.RowStyles.Add(new RowStyle(SizeType.Percent,20));
  var hdr=Table(2,1);hdr.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,71));hdr.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,29));hdr.RowStyles.Add(new RowStyle(SizeType.Percent,100));hdr.Controls.Add(Label("Tài nguyên Desktop",10,true),0,0);var cb=new ComboBox{Dock=DockStyle.Fill,DropDownStyle=ComboBoxStyle.DropDownList,Margin=new Padding(0,6,0,7),Font=new Font("Segoe UI",8)};cb.Items.AddRange(new object[]{"1 giây","2 giây","5 giây","10 giây"});cb.SelectedIndex=0;hdr.Controls.Add(cb,1,0);t.Controls.Add(hdr,0,0);
  string[] metric={"CPU 6,9% · 1,8 GHz","Bộ nhớ 10,3/15,6 GB","Ổ đĩa 0,9%","Mạng 0,1 / 0,2 Mb/s","GPU 0,4%"};
  for(int i=0;i<5;i++){var row=Table(2,1);row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,54));row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,46));row.RowStyles.Add(new RowStyle(SizeType.Percent,100));row.Margin=new Padding(0,2,0,2);row.Controls.Add(Label(metric[i],8),0,0);row.Controls.Add(new Trend(i),1,0);t.Controls.Add(row,0,i+1);}p.Controls.Add(t);return p;
 }
 class Trend:Control {int series;public Trend(int i){series=i;Dock=DockStyle.Fill;BackColor=Color.White;DoubleBuffered=true;}protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);if(Width<15||Height<10)return;var g=e.Graphics;g.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;using(var gr=new Pen(Line))for(int j=1;j<4;j++)g.DrawLine(gr,0,j*Height/4,Width,j*Height/4);Point[] pts=Enumerable.Range(0,24).Select(j=>new Point(2+j*(Width-5)/23,Height-7-(int)((series==3&&j%7==0?0.8:series==1?0.35:0.08+(j%6)*0.017)*(Height-14)))).ToArray();using(var p=new Pen(Teal,2))g.DrawLines(p,pts);}}
 Panel Roster(){
  var card=Card();card.Padding=new Padding(10,5,10,8);
  var t=Table(1,5);t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
  foreach(int h in new[]{30,34,36,32})t.RowStyles.Add(new RowStyle(SizeType.Absolute,h));
  t.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  var hdr=Table(2,1);hdr.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,84));hdr.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,16));hdr.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  hdr.Controls.Add(Label("Danh sách phiên hoạt động",11,true),0,0);
  hdr.Controls.Add(new Label{Text="37 phiên · realtime",ForeColor=Teal,Font=new Font("Segoe UI",8,FontStyle.Bold),Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleRight},1,0);
  t.Controls.Add(hdr,0,0);
  var fil=Table(5,1);fil.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  for(int i=0;i<5;i++)fil.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,20));
  string[] fn={"Tất cả (37)","Agent (3)","Web (4)","PDA Picker (28)","PDA Reporter (2)"};
  for(int i=0;i<5;i++)fil.Controls.Add(Btn(fn[i],i==0),i,0);t.Controls.Add(fil,0,1);
  var act=Table(5,1);act.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  foreach(int v in new[]{19,20,20,20,21})act.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,v));
  rosterTech=new CheckBox{Text="Cột kỹ thuật",Checked=true,Font=new Font("Segoe UI",8),Dock=DockStyle.Fill};
  act.Controls.Add(rosterTech,0,0);
  foreach(var pair in new[]{new {n="Làm mới dữ liệu",i=1},new {n="Kết thúc gọi 60s",i=2},new {n="Liên hệ nhóm",i=3},new {n="Kích toàn bộ user",i=4}})
    act.Controls.Add(Btn(pair.n),pair.i,0);
  t.Controls.Add(act,0,2);
  var find=Table(2,1);find.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,65));find.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,35));find.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  var search=Table(2,1);search.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,200));search.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));search.RowStyles.Add(new RowStyle(SizeType.Percent,100));
  search.Controls.Add(Label("Tìm MNV / họ tên / nhà thầu",8),0,0);
  search.Controls.Add(new TextBox{Dock=DockStyle.Fill,Margin=new Padding(3,4,20,3),Font=new Font("Segoe UI",8)},1,0);
  find.Controls.Add(search,0,0);
  find.Controls.Add(new Label{Text="Thông tin & nút đủ như Agent177 · Bộ lọc theo quyền",Dock=DockStyle.Fill,ForeColor=Gray,Font=new Font("Segoe UI",8),TextAlign=ContentAlignment.MiddleRight},1,0);
  t.Controls.Add(find,0,3);
  roster=Grid(true);
  roster.RowTemplate.Height=43;roster.ColumnHeadersHeight=32;
  roster.DefaultCellStyle.WrapMode=DataGridViewTriState.True;
  // Native adaptive grouped fields (0..2). Contains ALL original screen values on compact screens.
  Col(roster,"Nhân sự · MNV · Nhà thầu",24);
  Col(roster,"Phiên bản · Kênh · Đăng nhập",19);
  Col(roster,"Hoạt động · Nguồn / ID",24);
  // Native Agent177 screen columns (3..11); never discard any business field.
  Col(roster,"Nhân sự",19);
  Col(roster,"Phiên bản / Kênh",13);
  Col(roster,"Đăng nhập",9);
  Col(roster,"Hoạt động gần nhất",18);
  Col(roster,"Trạng thái",17);
  Col(roster,"Nguồn / ID",8);
  Col(roster,"Kích User",6,true);
  Col(roster,"Chuyên viên",7,true);
  Col(roster,"Kết thúc",3,true);
  for(int i=0;i<37;i++){
    var emp="NV - "+(42000+i)+" - Nhân sự mẫu "+(char)('A'+i%8)+" (Picker)";
    var contractor=(i%2==0?"Inhouse":"Nhà thầu A");
    var client="vc128 · 0.2.0-beta.128 · PDA Picker";
    var login="10/11 08:"+(i%60).ToString("00");
    var activity="PickList xác nhận thành công · 09:"+(i%60).ToString("00")+" 10/11/2026";
    var state="Phiên PDA ghi nhận · Có thể liên hệ";
    var technical="D161_DIRECT · "+(100+i);
    roster.Rows.Add(
      emp+"\n"+contractor,
      client+"\n"+login,
      activity+"\nNguồn/ID: "+technical,
      emp,
      client,
      login,
      activity,
      state,
      technical,
      "Kích User","Liên hệ picker","Kết thúc");
  }
  t.Controls.Add(roster,0,4);card.Controls.Add(t);
  rosterTech.CheckedChanged+=(sender,args)=>ConfigureRosterColumns();
  return card;
 }
 void ConfigureRosterColumns(){
  if(roster==null||roster.Columns.Count<12)return;
  bool compact=ClientSize.Width<1400;
  for(int i=0;i<12;i++)
    roster.Columns[i].Visible=compact
      ? (i<=2||i==7||i>=9)
      : (i>=3&&(i!=8||rosterTech.Checked));
  roster.ScrollBars=ScrollBars.Vertical;
  roster.DefaultCellStyle.WrapMode=DataGridViewTriState.True;
  for(int i=0;i<12;i++)
    roster.Columns[i].MinimumWidth=36;
  float[] wide={0,0,0,19,13,9,19,18,8,5,5,4};
  float[] narrow={23,20,25,0,0,0,0,12,0,7,8,5};
  for(int i=0;i<12;i++)
    if(roster.Columns[i].Visible)roster.Columns[i].FillWeight=compact?narrow[i]:wide[i];
  roster.RowTemplate.Height=compact?60:41;
  foreach(DataGridViewRow row in roster.Rows)
    row.Height=compact?60:41;
 }
 void Arrange(){
  if(upper==null||cols==null||tabs==null)return;
  bool wide=upper.ClientSize.Width>=1240;
  int next=wide?1:2;
  if(next!=mode){
    mode=next;upper.SuspendLayout();cols.SuspendLayout();mid.SuspendLayout();
    if(wide){
      foreach(TabPage pg in tabs.TabPages)pg.Controls.Clear();
      cols.Controls.Clear();mid.Controls.Clear();
      mid.Controls.Add(web,0,0);mid.Controls.Add(pick,0,1);
      cols.Controls.Add(agent,0,0);cols.Controls.Add(mid,1,0);cols.Controls.Add(res,2,0);
      cols.Visible=true;tabs.Visible=false;
    }else{
      mid.Controls.Clear();cols.Controls.Clear();
      tabs.TabPages[0].Controls.Add(agent);
      tabs.TabPages[1].Controls.Add(web);
      tabs.TabPages[2].Controls.Add(pick);
      tabs.TabPages[3].Controls.Add(res);
      cols.Visible=false;tabs.Visible=true;
    }
    mid.ResumeLayout(true);cols.ResumeLayout(true);upper.ResumeLayout(true);
  }
  ConfigureRosterColumns();
 }
 [STAThread] static int Main(string[] args) {
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  int w=int.Parse(args[0]),h=int.Parse(args[1]);string selected=args[2],file=args[3];
  try {
    using(var form=new App(w,h,selected)) {
      form.MaximumSize=new Size(Math.Max(2400,w),Math.Max(1600,h));
      form.Show(); Application.DoEvents();
      form.ClientSize=new Size(w,h);
      form.PerformLayout();Application.DoEvents();
      using(var bmp=new Bitmap(w,h)) {
        form.DrawToBitmap(bmp,new Rectangle(0,0,w,h));
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(file)));
        bmp.Save(file,System.Drawing.Imaging.ImageFormat.Png);
      }
      var diagnostic="client="+form.ClientSize+" upper="+form.upper.ClientSize+
        " mode="+form.mode+" target="+(form.upper.ClientSize.Width>=1240?1:2)+
        " upper_scroll="+form.upper.AutoScroll+" roster_scroll="+form.roster.ScrollBars;
      File.WriteAllText(file+".state.txt",diagnostic);
      if(form.upper.AutoScroll || form.roster.ScrollBars!=ScrollBars.Vertical ||
         form.mode!=(form.upper.ClientSize.Width>=1240?1:2))return 42;
    }
    return 0;
  } catch(Exception ex) {
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(file)));
    File.WriteAllText(file+".error.txt",ex.ToString());
    return 43;
  }
 }
 }
}