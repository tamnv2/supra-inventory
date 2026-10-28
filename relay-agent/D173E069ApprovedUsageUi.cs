using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // D173-E072 Agent-only release: keep native UI behavior identical while
    // replaying complete Agent CI after Gateway/Firestore isolation gate repair.
    // D173-E071 release-only: unchanged native Usage logic; replay full Agent CI
    // after fixing signed-release UTF-8 source guard on Windows (no provider calls).
    // D173-E069 Owner-approved native visual structure: 5 + 4 + 4 + 3 + data table.
    internal sealed partial class AgentForm
    {
        private TableLayoutPanel _d173ApprovedRoot;
        private Panel _d173ApprovedViewport;
        private D173E075UsageWheelRouter _d173UsageWheelRouter;
        private readonly Label[] _d173ApprovedQuotaInfo = new Label[4];
        private readonly Label[] _d173ApprovedQuota = new Label[4];
        private readonly Label[] _d173ApprovedForecast = new Label[3];
        private readonly Label[] _d173ApprovedAnalysis = new Label[4];
        private readonly D173E069UsageGraphic[] _d173ApprovedPlots = new D173E069UsageGraphic[4];
        private readonly List<Panel> _d173ApprovedCards = new List<Panel>();
        private readonly List<Label> _d173ApprovedTexts = new List<Label>();
        private TextBox _d173ApprovedSearch;
        private ComboBox _d173ApprovedFilter;
        private ComboBox _d173ApprovedStatus;
        private string _d173ApprovedSearchText = "";
        private string _d173ApprovedFilterValue = "Tất cả nguồn";
        private string _d173ApprovedStatusValue = "Tất cả trạng thái";
        private Label _d173ApprovedSource;

        private Label E069Label(string text, float size=9f,bool bold=false)
        {
            var c=new Label {Text=text,Dock=DockStyle.Fill,AutoEllipsis=true,
                BackColor=Color.Transparent,TextAlign=ContentAlignment.MiddleLeft,
                Font=new Font("Segoe UI",size,bold?FontStyle.Bold:FontStyle.Regular)};
            _d173ApprovedTexts.Add(c);
            return c;
        }
        private TableLayoutPanel E069Row(int columns)
        {
            var t=new TableLayoutPanel {Dock=DockStyle.Fill,ColumnCount=columns,
                RowCount=1,Padding=Padding.Empty,Margin=Padding.Empty};
            t.RowStyles.Add(new RowStyle(SizeType.Percent,100f));
            for(var i=0;i<columns;i++)
                t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100f/columns));
            return t;
        }
        private Panel E069Card(TableLayoutPanel host,int index,int pad=12)
        {
            var p=new D173BufferedCardPanel {
                Dock=DockStyle.Fill,Tag="D173Sample2Card",
                Margin=new Padding(5,2,5,4),Padding=new Padding(pad,5,pad,5), AutoScroll=true,
                BorderStyle=BorderStyle.FixedSingle};
            host.Controls.Add(p,index,0);
            _d173ApprovedCards.Add(p);
            return p;
        }
        private void E069Section(int row,string title)
        {
            _d173ApprovedRoot.Controls.Add(E069Label(title,10f,true),0,row);
        }
        private void InitializeD173ApprovedUsageUi()
        {
            _d173VpsUsagePage.Padding=Padding.Empty;
            _d173ApprovedViewport=new Panel {
                Name="D173UsageScrollableViewport",Dock=DockStyle.Fill,AutoScroll=true,
                Margin=Padding.Empty,Padding=Padding.Empty};
            _d173VpsUsagePage.Controls.Add(_d173ApprovedViewport);
            _d173ApprovedRoot=new TableLayoutPanel {
                Dock=DockStyle.None,AutoSize=false,RowCount=13,ColumnCount=1,
                Padding=new Padding(12,10,12,8),Margin=Padding.Empty};
            _d173ApprovedRoot.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100f));
            float[] sizes={53,30,25,106,25,160,25,210,25,96,38,282,15};
            for(var i=0;i<sizes.Length;i++)
                _d173ApprovedRoot.RowStyles.Add(new RowStyle(SizeType.Absolute,sizes[i]));
            _d173ApprovedRoot.Height=1112;
            _d173ApprovedViewport.Controls.Add(_d173ApprovedRoot);
            _d173ApprovedViewport.Resize+=(sender,args)=>{
                if(_d173ApprovedRoot!=null&&!_d173ApprovedRoot.IsDisposed)
                    _d173ApprovedRoot.Width=Math.Max(1000,
                        _d173ApprovedViewport.ClientSize.Width-22);
            };
            _d173ApprovedRoot.Width=1280;
            _d173UsageWheelRouter=new D173E075UsageWheelRouter(_d173VpsUsagePage,
                _d173ApprovedViewport,()=>_mainTabs.SelectedTab==_d173VpsUsagePage);
            Application.AddMessageFilter(_d173UsageWheelRouter);
            Disposed+=(sender,args)=>{
                if(_d173UsageWheelRouter!=null)
                    Application.RemoveMessageFilter(_d173UsageWheelRouter);
            };
            var header=E069Row(2);
            var t=E069Label("Giám sát Usage — Cloudflare / Firebase / Google",15f,true);
            header.Controls.Add(t,0,0);
            var bar=new FlowLayoutPanel {Dock=DockStyle.Fill,FlowDirection=FlowDirection.LeftToRight,
                WrapContents=false};
            foreach(var w in new[]{"24h","7d","30d"})
            {
                var window=w;
                var button=new Button{Text=w=="24h"?"24 giờ":w=="7d"?"7 ngày":"30 ngày",
                    Width=82,Height=30,Margin=new Padding(3,7,3,0),FlatStyle=FlatStyle.Flat};
                button.Click+=(s,e)=>SelectD173VpsUsageWindow(window);
                _d173VpsRangeButtons[window]=button;
                bar.Controls.Add(button);
            }
            var billing=new Button {Text="Chu kỳ billing",Width=111,Height=30,
                Margin=new Padding(3,7,3,0),FlatStyle=FlatStyle.Flat};
            billing.Click+=(s,e)=>_d173VpsUsageState.Text=
                "Chu kỳ billing chưa có nguồn xác thực · dữ liệu N/A";
            bar.Controls.Add(billing);
            header.Controls.Add(bar,1,0);
            _d173ApprovedRoot.Controls.Add(header,0,0);
            _d173ApprovedSource=E069Label("NGUỒN: đang đồng bộ · N/A không phải 0",8f);
            _d173ApprovedRoot.Controls.Add(_d173ApprovedSource,0,1);
            E069Section(2,"Tổng quan Cloudflare — tài khoản chung");

            var kpis=E069Row(5);
            string[] labels={"Cloudflare · gói cố định","Cloudflare · cảnh báo ngày",
                "Cloudflare · kỳ billing","Firestore · hôm nay","Trạng thái nguồn"};
            for(var i=0;i<5;i++)
            {
                var p=E069Card(kpis,i);
                var lay=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=1,RowCount=3};
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,29));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,41));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,30));
                lay.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
                lay.Controls.Add(E069Label(labels[i],8.1f,true),0,0);
                _d173VpsKpiLabels[i]=E069Label(i==0?"5 USD / tháng":"N/A",15f,true);
                lay.Controls.Add(_d173VpsKpiLabels[i],0,1);
                lay.Controls.Add(E069Label(i==0?"Gói chung · 50% quota nội bộ":
                    "Số liệu và nguồn xác thực",7.7f),0,2);
                p.Controls.Add(lay);
            }
            _d173ApprovedRoot.Controls.Add(kpis,0,3);
            E069Section(4,"Cloudflare — quota, tiêu thụ ngày và chu kỳ billing");

            var quotas=E069Row(4);
            string[] names={"Workers Requests","DO Compute Requests","DO SQL Rows Read","Workers CPU"};
            string[] targets={"5.000.000 req/kỳ","500.000 req/kỳ",
                "12,5 tỷ rows/kỳ","15 triệu ms/kỳ"};
            string[] notes={"100% gói: 10 triệu · Worker/shared",
                "100% gói: 1 triệu · tài khoản chung",
                "100% gói: 25 tỷ · tài khoản chung",
                "100% gói: 30 triệu ms · Worker/shared"};
            for(var i=0;i<4;i++)
            {
                var p=E069Card(quotas,i);
                var lay=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=1,RowCount=3};
                lay.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,24));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,34));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,42));
                lay.Controls.Add(E069Label(names[i],8.5f,true),0,0);
                _d173ApprovedQuota[i]=E069Label(targets[i],13.5f,true);
                lay.Controls.Add(_d173ApprovedQuota[i],0,1);
                _d173ApprovedQuotaInfo[i]=E069Label(
                    "Hôm nay: N/A  ·  Dự báo: N/A\nKỳ billing: N/A  ·  Cảnh báo: thiếu nguồn",8.2f);
                lay.Controls.Add(_d173ApprovedQuotaInfo[i],0,2);
                p.Controls.Add(lay);
            }
            _d173ApprovedRoot.Controls.Add(quotas,0,5);
            E069Section(6,"Xu hướng, lịch sử và cảnh báo");

            var charts=E069Row(4);
            string[] chartTitles={"DO Rows Read · lịch sử đối chiếu",
                "Firestore · theo ngày","Các API khác · từ nguồn",
                "Dự báo đến 22:00 · theo ca"};
            string[] chartText={
                "23/10: ~731 triệu rows /24h\n26/10: ~645 triệu rows /24h\n\n"+
                "Ảnh lịch sử được xác minh.",
                "Reads: N/A\nWrites: N/A\nDeletes: N/A\n\n"+
                "Ngưỡng: 70 · 85 · 95 · 100%",
                "Cloud Run: N/A\nRTDB HTTPS: N/A\nDrive API: N/A\nSheets API: N/A\n\n"+
                "Không suy diễn là số trong ngày",
                "06:00  ·  14:00  ·  18:00  ·  22:00\n\n"+
                "Dự báo: N/A\nChưa đủ profile ca & ngoài ca"
            };
            for(var i=0;i<4;i++)
            {
                var p=E069Card(charts,i);
                var lay=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=2,ColumnCount=1};
                lay.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100f));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,20));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,80));
                lay.Controls.Add(E069Label(chartTitles[i],8.5f,true),0,0);
                _d173ApprovedAnalysis[i]=E069Label(chartText[i],8.3f);
                if(i==0 || i==1 || i==3)
                {
                    var plot=new D173E069UsageGraphic{Dock=DockStyle.Fill,Mode=i};
                    _d173ApprovedPlots[i]=plot;
                    lay.Controls.Add(plot,0,1);
                }
                else lay.Controls.Add(_d173ApprovedAnalysis[i],0,1);
                p.Controls.Add(lay);
            }
            _d173ApprovedRoot.Controls.Add(charts,0,7);
            E069Section(8,"Tổng hợp cảnh báo");

            var forecasts=E069Row(3);
            string[] forecastNames={"Cloudflare · ngày","Cloudflare · chu kỳ billing",
                "Firestore · ngày"};
            for(var i=0;i<3;i++)
            {
                var p=E069Card(forecasts,i);
                var lay=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=1,RowCount=2};
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,42));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,58));
                lay.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
                lay.Controls.Add(E069Label(forecastNames[i],8.5f,true),0,0);
                _d173ApprovedForecast[i]=E069Label(i==2?"Chưa đủ nguồn":"N/A",12.7f,true);
                lay.Controls.Add(_d173ApprovedForecast[i],0,1);
                p.Controls.Add(lay);
            }
            _d173ApprovedRoot.Controls.Add(forecasts,0,9);

            var tableHeader=E069Row(2);
            tableHeader.Controls.Add(E069Label("Bảng chỉ số chi tiết · dữ liệu từ nguồn",10f,true),0,0);
            var searchRow=new FlowLayoutPanel {Dock=DockStyle.Fill,
                FlowDirection=FlowDirection.RightToLeft,WrapContents=false};
            _d173ApprovedSearch=new TextBox{Width=185,Margin=new Padding(4,8,4,0)};
            _d173ApprovedSearch.TextChanged+=(s,e)=>{
                _d173ApprovedSearchText=_d173ApprovedSearch.Text;RenderD173VpsUsage();};
            searchRow.Controls.Add(_d173ApprovedSearch);
            _d173ApprovedFilter=new ComboBox{Width=148,DropDownStyle=ComboBoxStyle.DropDownList,
                Margin=new Padding(4,7,4,0)};
            _d173ApprovedFilter.Items.AddRange(new object[]{
                "Tất cả nguồn","Cloudflare","Firestore","Google","RTDB"});
            _d173ApprovedFilter.SelectedIndex=0;
            _d173ApprovedFilter.SelectedIndexChanged+=(s,e)=>{
                _d173ApprovedFilterValue=Convert.ToString(_d173ApprovedFilter.SelectedItem);
                RenderD173VpsUsage();};
            searchRow.Controls.Add(_d173ApprovedFilter);
            _d173ApprovedStatus=new ComboBox{Width=148,
                DropDownStyle=ComboBoxStyle.DropDownList,Margin=new Padding(4,7,4,0)};
            _d173ApprovedStatus.Items.AddRange(new object[]{
                "Tất cả trạng thái","Có số liệu","Chưa đủ nguồn"});
            _d173ApprovedStatus.SelectedIndex=0;
            _d173ApprovedStatus.SelectedIndexChanged+=(s,e)=>{
                _d173ApprovedStatusValue=Convert.ToString(_d173ApprovedStatus.SelectedItem);
                RenderD173VpsUsage();};
            searchRow.Controls.Add(_d173ApprovedStatus);
            tableHeader.Controls.Add(searchRow,1,0);
            _d173ApprovedRoot.Controls.Add(tableHeader,0,10);
            _d173VpsUsageGrid.Dock=DockStyle.Fill;
            _d173VpsUsageGrid.ReadOnly=true;
            _d173VpsUsageGrid.RowHeadersVisible=false;
            _d173VpsUsageGrid.MultiSelect=false;
            _d173VpsUsageGrid.AllowUserToAddRows=false;
            _d173VpsUsageGrid.AllowUserToDeleteRows=false;
            _d173VpsUsageGrid.AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.None;
            _d173VpsUsageGrid.ScrollBars=ScrollBars.Both;
            _d173VpsUsageGrid.Columns.Clear();
            string[] cols={"usage","scope","source","value","today",
                "limit","percentage","dayForecast","status"};
            string[] titles={"Chỉ số","Phạm vi","Nguồn","Tổng trong khoảng",
                "Hôm nay","Target ngày","% ngày","Dự báo","Trạng thái"};
            int[] widths={210,170,150,145,123,138,95,170,135};
            for(var i=0;i<cols.Length;i++)
                _d173VpsUsageGrid.Columns.Add(new DataGridViewTextBoxColumn{
                    Name=cols[i],HeaderText=titles[i],Width=widths[i],
                    SortMode=DataGridViewColumnSortMode.NotSortable});
            _d173ApprovedRoot.Controls.Add(_d173VpsUsageGrid,0,11);
            _d173ApprovedRoot.Controls.Add(E069Label("",7.3f),0,12);
            ApplyD173ApprovedUsageTheme(D173IsDarkThemeActive());
        }

        internal bool D173ApprovedUsageVisualSmoke()
        {
            try
            {
                if(_e089Active)
                {
                    if(_e089Flow==null || !_e089Flow.AutoScroll ||
                        _e089Cards.Count<20 || _e089Header==null ||
                        _e089Cards.Values.Any(c=>c.Spark==null ||
                            c.Targets==null || c.BarTrack==null ||
                            c.Forecast==null || c.Alert==null))
                        return false;
                    // Both themes and the exact WinForms control tree are
                    // exercised without logging in or querying any provider.
                    foreach(var dark in new[]{false,true})
                        E089ApplyTheme(dark);
                    E089ApplyTheme(D173IsDarkThemeActive());
                    return true;
                }
                if(_d173ApprovedRoot==null ||
                    _d173ApprovedRoot.RowCount!=14 ||
                    _d173VpsKpiLabels.Length!=5 ||
                    _d173ApprovedQuota.Length!=4 ||
                    _d173ApprovedAnalysis.Length!=4 ||
                    _d173ApprovedForecast.Length!=3 ||
                    _d173ApprovedCards.Count!=22 ||
                    _d173VpsUsageGrid.Columns.Count!=9 ||
                    _d173VpsUsageGrid.AutoSizeColumnsMode!=
                        DataGridViewAutoSizeColumnsMode.None ||
                    _d173ApprovedRoot.RowStyles[3].Height!=105 ||
                    _d173ApprovedRoot.RowStyles[4].Height!=180 ||
                    _d173ApprovedRoot.RowStyles[6].Height!=188 ||
                    _d173ApprovedRoot.RowStyles[10].Height!=102 ||
                    _d173ApprovedViewport==null || !_d173ApprovedViewport.AutoScroll ||
                    _d173ApprovedQuotaInfo[0]==null ||
                    _e079Meters.Count!=12 ||
                    _d173VpsUsageGrid.ScrollBars!=ScrollBars.Horizontal)
                    return false;
                var folder=Environment.GetEnvironmentVariable("D173_SCREENSHOT_DIR");
                if(!string.IsNullOrWhiteSpace(folder))
                {
                    // Offline no-VPS-session screenshot has N/A values; never
                    // serialize credentials, provider token or real Picker data.
                    System.IO.Directory.CreateDirectory(folder);
                    // CI Windows virtual display is ~1024px wide. Capture the
                    // actual native Usage control tree at the approved 1376px
                    // content viewport without resizing the operational shell.
                    // This is a native offscreen layout test, NOT physical FIELD.
                    var selected=_mainTabs.SelectedTab;
                    var temporary=!_mainTabs.TabPages.Contains(_d173VpsUsagePage);
                    var previousDock=_d173ApprovedRoot.Dock;
                    var previousBounds=_d173ApprovedRoot.Bounds;
                    try
                    {
                        if(temporary)_mainTabs.TabPages.Add(_d173VpsUsagePage);
                        _mainTabs.SelectedTab=_d173VpsUsagePage;
                        _d173ApprovedRoot.Dock=DockStyle.None;
                        _d173ApprovedRoot.Bounds=new Rectangle(0,0,1376,900);
                        _d173ApprovedRoot.PerformLayout();
                        foreach(var theme in new[]{false,true})
                        {
                            ApplyD173ApprovedUsageTheme(theme);
                            _d173ApprovedRoot.PerformLayout();
                            using(var bmp=new Bitmap(_d173ApprovedRoot.Width,
                                _d173ApprovedRoot.Height))
                            {
                                _d173ApprovedRoot.DrawToBitmap(bmp,
                                    new Rectangle(0,0,bmp.Width,bmp.Height));
                                bmp.Save(System.IO.Path.Combine(folder,
                                    theme?"Agent152_Native_Dark.png":
                                          "Agent152_Native_Light.png"),
                                    System.Drawing.Imaging.ImageFormat.Png);
                            }
                        }
                    }
                    finally
                    {
                        _d173ApprovedRoot.Dock=previousDock;
                        _d173ApprovedRoot.Bounds=previousBounds;
                        ApplyD173ApprovedUsageTheme(D173IsDarkThemeActive());
                        if(selected!=null && _mainTabs.TabPages.Contains(selected))
                            _mainTabs.SelectedTab=selected;
                        if(temporary)_mainTabs.TabPages.Remove(_d173VpsUsagePage);
                    }
                }
                return true;
            }
            catch(Exception ex)
            {
                Log("D173 E069 visual_smoke_error="+ex.GetType().Name);
                return false;
            }
        }

        private void E069ThemeNestedControls(Control root,Color background,
            Color card,Color foreground)
        {
            foreach(Control child in root.Controls)
            {
                if(child is TableLayoutPanel || child is FlowLayoutPanel)
                {
                    // Nested layouts are opaque in WinForms: a transparent label
                    // otherwise inherits their default LIGHT background in DARK.
                    var parentCard=child.Parent as Panel;
                    child.BackColor=parentCard!=null &&
                        _d173ApprovedCards.Contains(parentCard)?card:background;
                }
                else if(child is Panel)
                {
                    var panel=(Panel)child;
                    panel.BackColor=D173Sample2InsideCard(panel)?card:background;
                }
                else if(child is Button)
                {
                    child.BackColor=card;
                    child.ForeColor=foreground;
                    ((Button)child).UseVisualStyleBackColor=false;
                }
                else if(child is TextBox || child is ComboBox)
                {
                    child.BackColor=card;
                    child.ForeColor=foreground;
                }
                E069ThemeNestedControls(child,background,card,foreground);
            }
        }

        private void ApplyD173ApprovedUsageTheme(bool dark)
        {
            if(_d173ApprovedRoot==null || _d173ApprovedRoot.IsDisposed)return;
            var bg=dark?Color.FromArgb(10,20,36):Color.FromArgb(243,246,250);
            var fg=dark?Color.FromArgb(234,242,255):Color.FromArgb(20,34,58);
            var card=dark?Color.FromArgb(18,34,56):Color.White;
            var border=dark?Color.FromArgb(41,61,87):Color.FromArgb(220,229,240);
            var blue=dark?Color.FromArgb(103,168,255):Color.FromArgb(37,99,235);
            _d173VpsUsagePage.BackColor=bg;
            _d173ApprovedViewport.BackColor=bg;
            _d173ApprovedRoot.BackColor=bg;
            foreach(var p in _d173ApprovedCards)if(!p.IsDisposed)p.BackColor=card;
            E069ThemeNestedControls(_d173ApprovedRoot,bg,card,fg);
            foreach(var c in _d173ApprovedTexts)if(!c.IsDisposed)
            {c.BackColor=Color.Transparent;c.ForeColor=fg;}
            foreach(var plot in _d173ApprovedPlots)
                if(plot!=null&&!plot.IsDisposed)
                {plot.BackColor=card;plot.ForeColor=fg;plot.Invalidate();}
            _d173VpsUsageGrid.BackgroundColor=card;
            _d173VpsUsageGrid.EnableHeadersVisualStyles=false;
            _d173VpsUsageGrid.GridColor=border;
            _d173VpsUsageGrid.ColumnHeadersDefaultCellStyle.BackColor=bg;
            _d173VpsUsageGrid.ColumnHeadersDefaultCellStyle.ForeColor=fg;
            _d173VpsUsageGrid.DefaultCellStyle.BackColor=card;
            _d173VpsUsageGrid.DefaultCellStyle.ForeColor=fg;
            _d173VpsUsageGrid.DefaultCellStyle.SelectionBackColor=blue;
            _d173VpsUsageGrid.DefaultCellStyle.SelectionForeColor=Color.White;
            _d173VpsUsageGrid.AlternatingRowsDefaultCellStyle.BackColor=bg;
            _d173VpsUsageGrid.AlternatingRowsDefaultCellStyle.ForeColor=fg;
            E079RepaintMeters(dark);
            foreach(var pair in _d173VpsRangeButtons)
            {pair.Value.UseVisualStyleBackColor=false;
             pair.Value.BackColor=pair.Key==_d173VpsSelectedWindow?blue:card;
             pair.Value.ForeColor=pair.Key==_d173VpsSelectedWindow?Color.White:fg;}
        }
    }

    // Unlike the previous 0-100% shape-only charts, every graph here has
    // explicit units and timestamp / quota origin from the approved sample.
    internal sealed class D173E069UsageGraphic : Control
    {
        internal int Mode;
        internal readonly double?[] Percents=new double?[3];
        internal string SourceTime="N/A";
        internal D173E069UsageGraphic()
        {
            DoubleBuffered=true;
            SetStyle(ControlStyles.AllPaintingInWmPaint|
                ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g=e.Graphics;
            g.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            bool dark=BackColor.GetBrightness()<0.45f;
            var text=dark?Color.FromArgb(155,174,198):Color.FromArgb(102,117,140);
            var ink=dark?Color.FromArgb(234,242,255):Color.FromArgb(20,34,58);
            var grid=dark?Color.FromArgb(41,61,87):Color.FromArgb(220,229,240);
            var blue=dark?Color.FromArgb(103,168,255):Color.FromArgb(37,99,235);
            var teal=dark?Color.FromArgb(50,200,174):Color.FromArgb(0,155,132);
            using(var f=new Font("Segoe UI",8f))
            using(var small=new Font("Segoe UI",7f))
            using(var muted=new SolidBrush(text))
            using(var writing=new SolidBrush(ink))
            using(var pen=new Pen(grid,1f))
            {
                if(Mode==0)
                {
                    var top=9f;var bottom=Math.Max(45f,Height-28f);
                    var left=43f;var right=Math.Max(left+45,Width-12f);
                    for(int i=0;i<=3;i++)
                    {
                        var y=top+(bottom-top)*i/3f;
                        g.DrawLine(pen,left,y,right,y);
                        g.DrawString(i==3?"0":(750-i*250)+"M",small,muted,0,y-7);
                    }
                    float[] values={731,645};string[] dates={"23/10","26/10"};
                    for(int i=0;i<2;i++)
                    {
                        var center=left+(i==0?0.29f:0.72f)*(right-left);
                        var h=values[i]/750f*(bottom-top);
                        using(var bar=new SolidBrush(i==0?blue:teal))
                            g.FillRectangle(bar,center-25,bottom-h,50,h);
                        g.DrawString("~"+values[i].ToString("0")+"M",f,writing,
                            center-25,bottom-h-17);
                        g.DrawString(dates[i],f,muted,center-20,bottom+2);
                    }
                    g.DrawString("LỊCH SỬ · không phải hiện tại",small,muted,0,Height-14);
                }
                else if(Mode==1)
                {
                    var items=new[]{"Reads","Writes","Deletes"};
                    for(int i=0;i<3;i++)
                    {
                        var y=16+i*37f;
                        g.DrawString(items[i],f,muted,0,y);
                        var x=58f;var w=Math.Max(50f,Width-123f);
                        using(var bg=new SolidBrush(grid))
                            g.FillRectangle(bg,x,y+3,w,11);
                        if(Percents[i].HasValue)
                        {
                            using(var fill=new SolidBrush(i==0?blue:i==1?teal:
                                Color.FromArgb(229,162,82)))
                                g.FillRectangle(fill,x,y+3,
                                    w*(float)Math.Min(100,Percents[i].Value)/100f,11);
                            g.DrawString(Percents[i].Value.ToString("N1",
                                CultureInfo.GetCultureInfo("vi-VN"))+"%",f,writing,x+w+5,y);
                        }
                        else g.DrawString("N/A",f,muted,x+w+5,y);
                    }
                    g.DrawString("0%                              100% quota ngày",
                        small,muted,1,Height-15);
                }
                else
                {
                    float x=10,w=Math.Max(50,Width-25f);
                    var t=DateTime.UtcNow.AddHours(7);
                    var ratio=(float)Math.Max(0,Math.Min(1,(t.TimeOfDay.TotalHours-6)/16d));
                    using(var bar=new SolidBrush(grid))g.FillRectangle(bar,x,27,w,12);
                    using(var fill=new SolidBrush(teal))g.FillRectangle(fill,x,27,w*ratio,12);
                    g.DrawString("06:00",small,muted,x,44);
                    g.DrawString("14:00",small,muted,x+w/2-13,44);
                    g.DrawString("22:00",small,muted,x+w-30,44);
                    g.DrawString("Dự báo: N/A nếu nguồn theo giờ thiếu",
                        f,writing,6,Height-43);
                    g.DrawString("Ngoài ca 00–06h được tách riêng",small,muted,6,Height-24);
                }
            }
        }
    }
}
