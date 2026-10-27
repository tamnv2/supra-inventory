using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // D173-E079: native Windows dashboard, no provider calls and no mock usage values.
    internal sealed partial class AgentForm
    {
        private sealed class E079Meter
        {
            internal string Id;
            internal Label Value, Target, Percent, Status;
            internal Panel Track, Fill;
            internal double? Ratio;
        }
        private readonly Dictionary<string,E079Meter> _e079Meters =
            new Dictionary<string,E079Meter>(StringComparer.Ordinal);

        private Label E079Text(string value,float size=9f,bool strong=false)
        {
            return E069Label(value,size,strong);
        }
        private Control E079Icon(string glyph, Color accent)
        {
            var icon=new E079NativeGlyph {Dock=DockStyle.Left,
                Width=34,Symbol=glyph,Accent=accent,
                Tag="D173E079Icon"};
            return icon;
        }
        private void E079Heading(int row,string glyph,string name,string subtitle)
        {
            var area=new Panel{Dock=DockStyle.Fill,Padding=new Padding(7,1,7,1)};
            var title=E079Text("  "+name+"    "+subtitle,11.8f,true);
            title.Dock=DockStyle.Fill;
            area.Controls.Add(title);
            area.Controls.Add(E079Icon(glyph,Color.DeepSkyBlue));
            _d173ApprovedRoot.Controls.Add(area,0,row);
        }
        private E079Meter E079AddMeter(TableLayoutPanel row,int index,
            string id,string glyph,string title)
        {
            var card=E069Card(row,index,8);
            var layout=new TableLayoutPanel {
                Dock=DockStyle.Fill,ColumnCount=1,RowCount=5,Padding=Padding.Empty
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
            foreach(var h in new[]{26f,29f,26f,19f,26f})
                layout.RowStyles.Add(new RowStyle(SizeType.Absolute,h));
            var header=new Panel{Dock=DockStyle.Fill};
            var caption=E079Text(title,8.7f,true);
            caption.Dock=DockStyle.Fill;
            header.Controls.Add(caption);
            header.Controls.Add(E079Icon(glyph,Color.CornflowerBlue));
            layout.Controls.Add(header,0,0);
            var value=E079Text("N/A",12.2f,true);
            var target=E079Text("Hạn mức: chưa xác thực",8f);
            layout.Controls.Add(value,0,1);
            layout.Controls.Add(target,0,2);
            var track=new Panel{Dock=DockStyle.Fill,Height=12,
                Margin=new Padding(1,5,34,3),BackColor=Color.FromArgb(40,65,93)};
            var fill=new Panel{Dock=DockStyle.Left,Width=0,BackColor=Color.FromArgb(31,205,175)};
            track.Controls.Add(fill);
            layout.Controls.Add(track,0,3);
            var line=new Panel{Dock=DockStyle.Fill};
            var status=E079Text("Chưa đủ nguồn",7.8f);
            line.Controls.Add(status);
            var percent=E079Text("N/A",8.2f,true);
            percent.Dock=DockStyle.Right;percent.Width=70;
            percent.TextAlign=ContentAlignment.MiddleRight;
            line.Controls.Add(percent);
            layout.Controls.Add(line,0,4);
            card.Controls.Add(layout);
            var meter=new E079Meter {Id=id,Value=value,Target=target,
                Percent=percent,Status=status,Track=track,Fill=fill};
            track.Resize+=(s,e)=>E079UpdateMeterBar(meter);
            _e079Meters[id]=meter;
            return meter;
        }
        private void E079UpdateMeterBar(E079Meter meter)
        {
            if(meter.Track.IsDisposed)return;
            var ratio=meter.Ratio;
            meter.Fill.Width=ratio.HasValue
                ? Math.Max(0,(int)Math.Round(meter.Track.ClientSize.Width*
                    Math.Min(1d,Math.Max(0d,ratio.Value)))):0;
        }
        private void E079SetMeter(string id,Dictionary<string,object> source,double? target,
            string timeframe)
        {
            E079Meter meter;
            if(!_e079Meters.TryGetValue(id,out meter))return;
            if(source==null || D160UsageJson.String(source,"status")!="OK")
            {
                meter.Value.Text="N/A";
                meter.Target.Text="Thiếu số liệu nguồn";
                meter.Percent.Text="N/A";
                meter.Status.Text="Chưa đủ nguồn";
                meter.Ratio=null;E079UpdateMeterBar(meter);return;
            }
            var unit=D160UsageJson.String(source,"unit");
            // Do not confuse rolling window aggregate with daily business totals.
            double? used=timeframe=="NGAY"?D173TodaySum(source):(double?)null;
            if(!used.HasValue && timeframe=="KHOANG")
            {
                double number;
                if(double.TryParse(D160UsageJson.String(source,"total"),
                    NumberStyles.Any,CultureInfo.InvariantCulture,out number))
                    used=number;
            }
            if(!used.HasValue)
            {
                meter.Value.Text="N/A";
                meter.Target.Text="Thiếu mẫu "+(timeframe=="NGAY"?"ngày":"khoảng");
                meter.Percent.Text="N/A";
                meter.Status.Text="Không suy diễn dữ liệu";
                meter.Ratio=null;E079UpdateMeterBar(meter);return;
            }
            meter.Value.Text=D173UsageNum(used.Value,unit);
            if(target.HasValue && target.Value>0)
            {
                meter.Target.Text="Target "+(timeframe=="NGAY"?"ngày":"khoảng")+
                    ": "+D173UsageNum(target.Value,unit);
                meter.Ratio=used.Value/target.Value;
                meter.Percent.Text=D173VpsPercent(used.Value,target.Value);
                var p=meter.Ratio.Value*100;
                meter.Status.Text=p>=100?"VƯỢT "+(p-100).ToString("N1",
                    CultureInfo.GetCultureInfo("vi-VN"))+"%":D173VpsSeverity(p);
            }
            else
            {
                meter.Target.Text="Chưa xác thực hạn mức "+(timeframe=="NGAY"?"ngày":"khoảng");
                meter.Ratio=null;meter.Percent.Text="N/A";
                meter.Status.Text="Có số liệu · không có target";
            }
            E079UpdateMeterBar(meter);
        }
        private void E079RefreshMeters(Dictionary<string,Dictionary<string,object>> latest)
        {
            foreach(var key in _e079Meters.Keys.ToList())
            {
                Dictionary<string,object> metric;
                latest.TryGetValue(key,out metric);
                double included;
                var cf=D173IncludedSharedCycleReference.TryGetValue(key,out included);
                var fire=key=="firestore_reads"?50000d:
                    (key=="firestore_writes"||key=="firestore_deletes"?20000d:0d);
                var target=cf?included*0.5d/30d:fire>0?fire:(double?)null;
                var span=key=="cloud_run_requests"||key=="rtdb_https_requests"||
                    key=="drive_requests"||key=="sheets_requests"?"KHOANG":"NGAY";
                E079SetMeter(key,metric,target,span);
            }
            E079RepaintMeters(D173IsDarkThemeActive());
        }
        private void E079RepaintMeters(bool dark)
        {
            var colorTrack=dark?Color.FromArgb(38,64,91):Color.FromArgb(213,226,240);
            foreach(var metric in _e079Meters.Values)
            {
                if(metric.Track.IsDisposed)continue;
                metric.Track.BackColor=colorTrack;
                var p=metric.Ratio.HasValue?metric.Ratio.Value*100:0;
                var severity=p>=100?Color.FromArgb(247,94,111):
                    p>=85?Color.FromArgb(255,161,49):
                    p>=70?Color.FromArgb(245,196,71):
                    Color.FromArgb(37,195,165);
                metric.Fill.BackColor=severity;
                metric.Percent.ForeColor=metric.Ratio.HasValue?severity:
                    (dark?Color.FromArgb(155,175,199):Color.Gray);
                metric.Status.ForeColor=metric.Ratio.HasValue?severity:
                    (dark?Color.FromArgb(155,175,199):Color.Gray);
                E079UpdateMeterBar(metric);
            }
        }
        private void E079GrowGrid()
        {
            if(_d173ApprovedRoot==null||_d173ApprovedRoot.RowCount!=14)return;
            var height=Math.Max(290,_d173VpsUsageGrid.ColumnHeadersHeight+
                _d173VpsUsageGrid.Rows.Count*_d173VpsUsageGrid.RowTemplate.Height+12);
            _d173ApprovedRoot.RowStyles[12].Height=height;
            var total=_d173ApprovedRoot.RowStyles.Cast<RowStyle>().Sum(style=>style.Height);
            _d173ApprovedRoot.Height=(int)total+24;
        }
        private void InitializeD173E079UsageUi()
        {
            _d173VpsUsagePage.Padding=Padding.Empty;
            _d173ApprovedViewport=new Panel {Name="D173UsageScrollableViewport",
                Dock=DockStyle.Fill,AutoScroll=true,Padding=Padding.Empty};
            _d173VpsUsagePage.Controls.Add(_d173ApprovedViewport);
            _d173ApprovedRoot=new TableLayoutPanel {Dock=DockStyle.None,AutoSize=false,
                RowCount=14,ColumnCount=1,Padding=new Padding(11,6,11,12),
                Margin=Padding.Empty};
            _d173ApprovedRoot.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
            var heights=new[]{54f,24f,38f,105f,180f,38f,188f,38f,182f,32f,102f,42f,420f,12f};
            foreach(var h in heights)_d173ApprovedRoot.RowStyles.Add(
                new RowStyle(SizeType.Absolute,h));
            _d173ApprovedRoot.Height=1460;
            _d173ApprovedRoot.Width=1380;
            _d173ApprovedViewport.Controls.Add(_d173ApprovedRoot);
            _d173ApprovedViewport.Resize+=(sender,args)=>{
                if(!_d173ApprovedRoot.IsDisposed)
                    _d173ApprovedRoot.Width=Math.Max(1100,
                        _d173ApprovedViewport.ClientSize.Width-22);
            };
            _d173UsageWheelRouter=new D173E075UsageWheelRouter(_d173VpsUsagePage,
                _d173ApprovedViewport,()=>_mainTabs.SelectedTab==_d173VpsUsagePage);
            Application.AddMessageFilter(_d173UsageWheelRouter);
            Disposed+=(sender,args)=>{if(_d173UsageWheelRouter!=null)
                Application.RemoveMessageFilter(_d173UsageWheelRouter);};
            var header=E069Row(2);
            header.Controls.Add(E079Text("Giám sát Usage",16f,true),0,0);
            var controls=new FlowLayoutPanel{Dock=DockStyle.Fill,
                FlowDirection=FlowDirection.RightToLeft,WrapContents=false};
            var cycle=new Button{Text="Chu kỳ billing",Width=126,Height=30,
                Margin=new Padding(4,9,4,0),FlatStyle=FlatStyle.Flat};
            cycle.Click+=(s,e)=>_d173VpsUsageState.Text=
                "Chu kỳ billing N/A · chưa có kỳ nguồn xác thực";
            controls.Controls.Add(cycle);
            foreach(var w in new[]{"30d","7d","24h"})
            {
                var window=w;
                var button=new Button{Text=w=="24h"?"24 giờ":w=="7d"?"7 ngày":"30 ngày",
                    Width=90,Height=30,Margin=new Padding(4,9,4,0),
                    FlatStyle=FlatStyle.Flat};
                button.Click+=(s,e)=>SelectD173VpsUsageWindow(window);
                _d173VpsRangeButtons[window]=button;
                controls.Controls.Add(button);
            }
            header.Controls.Add(controls,1,0);
            _d173ApprovedRoot.Controls.Add(header,0,0);
            _d173ApprovedSource=E079Text("Nguồn: đang đồng bộ · N/A không phải 0",8.5f);
            _d173ApprovedRoot.Controls.Add(_d173ApprovedSource,0,1);
            E079Heading(2,"☁","Cloudflare","Workers / Durable Objects / D1");
            var summary=E069Row(5);
            var names=new[]{"Gói chung cố định","Cảnh báo theo ngày",
                "Chu kỳ billing","Firebase · hôm nay","Nguồn Cloudflare"};
            for(var i=0;i<5;i++)
            {
                var card=E069Card(summary,i,10);
                var lay=new TableLayoutPanel {Dock=DockStyle.Fill,ColumnCount=1,RowCount=2};
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,40));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,60));
                lay.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
                lay.Controls.Add(E079Text(names[i],8.1f,true),0,0);
                _d173VpsKpiLabels[i]=E079Text(i==0?"5 USD / tháng":"N/A",13f,true);
                lay.Controls.Add(_d173VpsKpiLabels[i],0,1);
                card.Controls.Add(lay);
            }
            _d173ApprovedRoot.Controls.Add(summary,0,3);
            var cloud=E069Row(5);
            string[] cIds={"cf_worker_requests","cf_do_requests","cf_do_rows_read",
                "cf_worker_cpu","cf_do_rows_written"};
            string[] cNames={"Workers Requests","DO Compute Requests",
                "DO SQL Rows Read","Workers CPU","DO Rows Written"};
            string[] cIcons={"♧","⬡","▤","▣","▥"};
            for(var i=0;i<cIds.Length;i++)
            {
                E079AddMeter(cloud,i,cIds[i],cIcons[i],cNames[i]);
                if(i<4)
                {
                    _d173ApprovedQuotaInfo[i]=E079Text("",7.5f);
                    _d173ApprovedQuota[i]=E079Text("",7.5f);
                }
            }
            _d173ApprovedRoot.Controls.Add(cloud,0,4);
            E079Heading(5,"◆","Firebase","Firestore: Reads / Writes / Deletes");
            var firebase=E069Row(4);
            var fcard=E069Card(firebase,0,10);
            var flay=new TableLayoutPanel {Dock=DockStyle.Fill,RowCount=2,ColumnCount=1};
            flay.RowStyles.Add(new RowStyle(SizeType.Absolute,25));
            flay.RowStyles.Add(new RowStyle(SizeType.Percent,100));
            flay.Controls.Add(E079Text("Firestore · % sử dụng theo ngày",8.5f,true),0,0);
            _d173ApprovedPlots[1]=new D173E069UsageGraphic{Dock=DockStyle.Fill,Mode=1};
            flay.Controls.Add(_d173ApprovedPlots[1],0,1);
            fcard.Controls.Add(flay);
            string[] fIds={"firestore_reads","firestore_writes","firestore_deletes"};
            string[] fNames={"Reads","Writes","Deletes"};
            for(var i=0;i<3;i++)E079AddMeter(firebase,i+1,fIds[i],
                i==2?"▧":"▤",fNames[i]);
            _d173ApprovedRoot.Controls.Add(firebase,0,6);
            E079Heading(7,"◈","Google / Other","Cloud Run / RTDB / Drive API / Sheets API");
            var google=E069Row(4);
            string[] gIds={"cloud_run_requests","rtdb_https_requests",
                "drive_requests","sheets_requests"};
            string[] gNames={"Cloud Run","RTDB HTTPS","Drive API","Sheets API"};
            string[] gIcons={"☁","▤","△","▥"};
            for(var i=0;i<4;i++)E079AddMeter(google,i,gIds[i],gIcons[i],gNames[i]);
            _d173ApprovedRoot.Controls.Add(google,0,8);
            _d173ApprovedRoot.Controls.Add(E079Text("Cảnh báo trọng điểm theo nguồn",10f,true),0,9);
            var alerts=E069Row(4);
            string[] alertNames={"Cloudflare · ngày","Cloudflare · kỳ billing",
                "Firebase · ngày","Kết quả WMS xác nhận"};
            for(var i=0;i<4;i++)
            {
                var card=E069Card(alerts,i,10);
                var lay=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=2,ColumnCount=1};
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,35));
                lay.RowStyles.Add(new RowStyle(SizeType.Percent,65));
                lay.Controls.Add(E079Text(alertNames[i],8.5f,true),0,0);
                if(i<3)
                {
                    _d173ApprovedForecast[i]=E079Text("N/A",10f,true);
                    lay.Controls.Add(_d173ApprovedForecast[i],0,1);
                }
                else lay.Controls.Add(E079Text(
                    "Checkbox không sẵn sàng + cùng dòng có 'Xác nhận lấy lại hàng': "+
                    "đã xác nhận, quay lại SFT / SFT 3.",8f),0,1);
                card.Controls.Add(lay);
            }
            _d173ApprovedRoot.Controls.Add(alerts,0,10);
            // Preserve legacy read-only render sink labels (no redundant panels).
            for(var i=0;i<4;i++)
                _d173ApprovedAnalysis[i]=E079Text("",8f);
            var tableHeader=E069Row(2);
            tableHeader.Controls.Add(E079Text("Chi tiết usage theo dịch vụ",10f,true),0,0);
            var search=new FlowLayoutPanel{Dock=DockStyle.Fill,
                FlowDirection=FlowDirection.RightToLeft,WrapContents=false};
            _d173ApprovedSearch=new TextBox{Width=180,Margin=new Padding(4,10,4,0)};
            _d173ApprovedSearch.TextChanged+=(s,e)=>{
                _d173ApprovedSearchText=_d173ApprovedSearch.Text;RenderD173VpsUsage();};
            search.Controls.Add(_d173ApprovedSearch);
            _d173ApprovedFilter=new ComboBox{Width=132,DropDownStyle=ComboBoxStyle.DropDownList,
                Margin=new Padding(4,9,4,0)};
            _d173ApprovedFilter.Items.AddRange(new object[]{
                "Tất cả nguồn","Cloudflare","Firestore","Google","RTDB"});
            _d173ApprovedFilter.SelectedIndex=0;
            _d173ApprovedFilter.SelectedIndexChanged+=(s,e)=>{
                _d173ApprovedFilterValue=Convert.ToString(_d173ApprovedFilter.SelectedItem);
                RenderD173VpsUsage();};
            search.Controls.Add(_d173ApprovedFilter);
            _d173ApprovedStatus=new ComboBox{Width=130,
                DropDownStyle=ComboBoxStyle.DropDownList,Margin=new Padding(4,9,4,0)};
            _d173ApprovedStatus.Items.AddRange(new object[]{
                "Tất cả trạng thái","Có số liệu","Chưa đủ nguồn"});
            _d173ApprovedStatus.SelectedIndex=0;
            _d173ApprovedStatus.SelectedIndexChanged+=(s,e)=>{
                _d173ApprovedStatusValue=Convert.ToString(_d173ApprovedStatus.SelectedItem);
                RenderD173VpsUsage();};
            search.Controls.Add(_d173ApprovedStatus);
            tableHeader.Controls.Add(search,1,0);
            _d173ApprovedRoot.Controls.Add(tableHeader,0,11);
            _d173VpsUsageGrid.Dock=DockStyle.Fill;
            _d173VpsUsageGrid.ReadOnly=true;
            _d173VpsUsageGrid.RowHeadersVisible=false;
            _d173VpsUsageGrid.AllowUserToAddRows=false;
            _d173VpsUsageGrid.AllowUserToDeleteRows=false;
            _d173VpsUsageGrid.MultiSelect=false;
            _d173VpsUsageGrid.AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.None;
            _d173VpsUsageGrid.ScrollBars=ScrollBars.Horizontal;
            _d173VpsUsageGrid.Columns.Clear();
            string[] cols={"usage","scope","source","value","today",
                "limit","percentage","dayForecast","status"};
            string[] titles={"Chỉ số","Phạm vi","Nguồn","Tổng trong khoảng",
                "Hôm nay","Target ngày","% ngày","Dự báo","Trạng thái"};
            int[] widths={205,168,130,130,125,138,90,165,130};
            for(var i=0;i<cols.Length;i++)
                _d173VpsUsageGrid.Columns.Add(new DataGridViewTextBoxColumn{
                    Name=cols[i],HeaderText=titles[i],Width=widths[i],
                    SortMode=DataGridViewColumnSortMode.NotSortable});
            _d173ApprovedRoot.Controls.Add(_d173VpsUsageGrid,0,12);
            _d173ApprovedRoot.Controls.Add(E079Text("",7f),0,13);
            E079GrowGrid();
            ApplyD173ApprovedUsageTheme(D173IsDarkThemeActive());
        }
    }
}
