using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // E090: lightweight vector symbols for every provider metric (no network/font assets).
    internal sealed class D173E090UsageGlyph : Control
    {
        internal string MetricId = "";
        internal D173E090UsageGlyph() {
            DoubleBuffered=true;
            SetStyle(ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer,true);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g=e.Graphics;
            g.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            var x=Math.Max(2,(Width-18)/2);
            var y=Math.Max(2,(Height-18)/2);
            var id=MetricId??"";
            using(var pen=new Pen(ForeColor,1.5f))
            using(var brush=new SolidBrush(ForeColor))
            {
                if(id.StartsWith("cf_",StringComparison.Ordinal) ||
                    id=="cloudflare") {
                    // Cloud + database bars represent shared Workers/DO counters.
                    g.DrawArc(pen,x,y+6,11,9,155,220);
                    g.DrawArc(pen,x+6,y+2,10,12,160,220);
                    g.DrawLine(pen,x+2,y+15,x+17,y+15);
                    if(id.Contains("rows")||id.Contains("storage")) {
                        g.DrawLine(pen,x+5,y+11,x+5,y+16);
                        g.DrawLine(pen,x+9,y+10,x+9,y+16);
                    }
                } else if(id.StartsWith("firestore_",StringComparison.Ordinal) ||
                          id.StartsWith("rtdb_",StringComparison.Ordinal) ||
                          id=="firebase") {
                    // Firebase-family flame, closed polygon.
                    g.FillPolygon(brush,new []{
                        new Point(x+9,y+1),new Point(x+15,y+12),
                        new Point(x+11,y+18),new Point(x+4,y+15),
                        new Point(x+2,y+10),new Point(x+7,y+13)});
                } else {
                    // Google/APIs: four-panel service grid.
                    for(var row=0;row<2;row++)
                        for(var col=0;col<2;col++)
                            g.DrawRectangle(pen,x+2+col*9,y+2+row*9,6,6);
                }
            }
        }
    }

    // D173-E089: WinForms-native card-only read-only VPS Usage view.
    // No provider calls, timers, business mutations, credentials or mock samples.
    internal sealed partial class AgentForm
    {
        private sealed class E089Card
        {
            internal string Id;
            internal Panel Shell;
            internal TableLayoutPanel Layout;
            internal Label Caption, Number, Scope, Targets, CycleTargets, Forecast, Alert, SourceTime;
            internal Panel BarTrack, BarFill, CycleBarTrack, CycleBarFill;
            internal double? DayRatio, CycleRatio;
            internal D173E090UsageGlyph Icon;
            internal E079NativeSparkline Spark;
        }

        private readonly Dictionary<string,E089Card> _e089Cards =
            new Dictionary<string,E089Card>(StringComparer.Ordinal);
        private readonly List<Label> _e089Headings = new List<Label>();
        private readonly List<Panel> _e090GroupRows = new List<Panel>();
        private FlowLayoutPanel _e089Flow;
        private Label _e089Header, _e089Info;
        private bool _e089Active;

        private static readonly string[][] E089MetricGroups = {
            new[] {"cf_do_requests","cf_do_rows_read","cf_do_rows_written",
                "cf_worker_requests","cf_do_duration","cf_worker_cpu",
                "cf_emails_sent","cf_do_sql_storage"},
            new[] {"firestore_reads","firestore_writes","firestore_deletes",
                "firestore_connections","firestore_listeners","firestore_rules",
                "firestore_storage","rtdb_api_hits","rtdb_https_requests",
                "rtdb_connections","rtdb_monthly_sent","rtdb_sent_bytes",
                "rtdb_payload_bytes","rtdb_protocol_bytes",
                "rtdb_storage_bytes","rtdb_rules"},
            new[] {"cloud_run_requests","cloud_run_billable_time","fcm_requests",
                "auth_identity_requests","auth_secure_requests","drive_requests",
                "sheets_requests"}
        };

        private static Label E089Label(string text,float size,bool strong=false)
        {
            return new Label { Text=text, AutoEllipsis=true, Dock=DockStyle.Fill,
                TextAlign=ContentAlignment.MiddleLeft, Margin=Padding.Empty,
                Font=new Font("Segoe UI",size,strong?FontStyle.Bold:FontStyle.Regular) };
        }

        private void InitializeD173E089UsageCards()
        {
            _e089Flow=new FlowLayoutPanel {Dock=DockStyle.Fill,AutoScroll=true,
                FlowDirection=FlowDirection.LeftToRight,WrapContents=true,
                Padding=new Padding(12,9,9,15),Margin=Padding.Empty};
            _d173VpsUsagePage.Controls.Add(_e089Flow);
            _e089Header=E089Label("Giám sát Usage  ·  06:00 → hiện tại  ·  dự báo đến 22:00",15,true);
            _e089Header.Height=41;
            _e089Header.Dock=DockStyle.None;
            _e089Flow.Controls.Add(_e089Header);
            _e089Flow.SetFlowBreak(_e089Header,true);
            _e089Info=E089Label("Chưa có mẫu nguồn. Chỉ theo dõi Agent vps.",9);
            _e089Info.Height=46;_e089Info.Dock=DockStyle.None;
            _e089Flow.Controls.Add(_e089Info);
            _e089Flow.SetFlowBreak(_e089Info,true);
            var headings=new[]{"Cloudflare  ·  Workers / Durable Objects",
                "Firebase  ·  Firestore / Realtime Database",
                "Google / Other  ·  API / Cloud Run"};
            for(var group=0;group<E089MetricGroups.Length;group++)
            {
                var title=E089Label(headings[group],11,true);
                title.Height=32;title.Dock=DockStyle.None;
                title.Margin=new Padding(4,8,4,2);
                var groupRow=new Panel {Width=900,Height=32,Margin=new Padding(4,8,4,2)};
                title.Dock=DockStyle.Fill;
                groupRow.Controls.Add(title);
                groupRow.Controls.Add(new D173E090UsageGlyph {
                    MetricId=group==0?"cloudflare":group==1?"firebase":"google",
                    Dock=DockStyle.Left,Width=28,ForeColor=Color.FromArgb(0,164,149)
                });
                _e089Flow.Controls.Add(groupRow);
                _e089Flow.SetFlowBreak(groupRow,true);
                _e089Headings.Add(title);
                _e090GroupRows.Add(groupRow);
                foreach(var id in E089MetricGroups[group])
                {
                    var card=E089NewCard(id);
                    _e089Cards[id]=card;
                    _e089Flow.Controls.Add(card.Shell);
                    if(id==E089MetricGroups[group].Last())
                        _e089Flow.SetFlowBreak(card.Shell,true);
                }
            }
            _e089Flow.SizeChanged+=(sender,args)=>E089Relayout();
            _e089Active=true;
            E089Relayout();
            E089ApplyTheme(D173IsDarkThemeActive());
        }

        private E089Card E089NewCard(string id)
        {
            var card=new E089Card {Id=id};
            card.Shell=new Panel {Name="UsageCard_"+id,Width=281,Height=294,
                Padding=new Padding(10,5,10,7),Margin=new Padding(4)};
            var table=new TableLayoutPanel {Dock=DockStyle.Fill,
                ColumnCount=1,RowCount=10,Margin=Padding.Empty,Padding=Padding.Empty};
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
            foreach(var h in new[]{28f,32f,18f,57f,30f,13f,24f,13f,22f,25f})
                table.RowStyles.Add(new RowStyle(SizeType.Absolute,h));
            card.Caption=E089Label(id+" · Sync ...",8,true);
            card.Number=E089Label("Chưa có số liệu",16,true);
            card.Scope=E089Label("Chưa xác minh nguồn",7.4f);
            card.Spark=new E079NativeSparkline {Dock=DockStyle.Fill};
            card.Targets=E089Label("Ngày: chưa xác thực",7.6f);
            card.CycleTargets=E089Label("Chu kỳ: chưa xác thực",7.6f);
            card.BarTrack=new Panel {Dock=DockStyle.Fill,Margin=new Padding(0,4,0,3)};
            card.BarFill=new Panel {Dock=DockStyle.Left,Width=0};
            card.BarTrack.Controls.Add(card.BarFill);
            card.CycleBarTrack=new Panel {Dock=DockStyle.Fill,Margin=new Padding(0,4,0,3)};
            card.CycleBarFill=new Panel {Dock=DockStyle.Left,Width=0};
            card.CycleBarTrack.Controls.Add(card.CycleBarFill);
            card.Forecast=E089Label("Dự kiến 22:00: chưa đủ mẫu",7.6f);
            card.Alert=E089Label("Chưa đủ nguồn",8f,true);
            card.SourceTime=E089Label("Mẫu nguồn: chưa có",7f);
            var titleRow=new Panel {Dock=DockStyle.Fill,Margin=Padding.Empty};
            card.Caption.Dock=DockStyle.Fill;
            card.Icon=new D173E090UsageGlyph {
                MetricId=id,Dock=DockStyle.Left,Width=24,
                ForeColor=Color.FromArgb(0,164,149)
            };
            titleRow.Controls.Add(card.Caption);
            titleRow.Controls.Add(card.Icon);
            table.Controls.Add(titleRow,0,0);
            table.Controls.Add(card.Number,0,1);
            table.Controls.Add(card.Scope,0,2);
            table.Controls.Add(card.Spark,0,3);
            table.Controls.Add(card.Targets,0,4);
            table.Controls.Add(card.BarTrack,0,5);
            table.Controls.Add(card.CycleTargets,0,6);
            table.Controls.Add(card.CycleBarTrack,0,7);
            // Last row combines forecast, inline alert and freshness by text.
            card.Forecast.TextAlign=ContentAlignment.MiddleLeft;
            table.Controls.Add(card.Forecast,0,8);
            var footer=new Panel {Dock=DockStyle.Fill};
            card.Alert.Dock=DockStyle.Left;card.Alert.Width=122;
            card.SourceTime.Dock=DockStyle.Fill;
            footer.Controls.Add(card.SourceTime);
            footer.Controls.Add(card.Alert);
            table.Controls.Add(footer,0,9);
            card.Layout=table;
            card.Shell.Controls.Add(table);
            card.BarTrack.Resize+=(sender,args)=>E089UpdateBars(card,card.DayRatio,card.CycleRatio);
            card.CycleBarTrack.Resize+=(sender,args)=>E089UpdateBars(card,card.DayRatio,card.CycleRatio);
            return card;
        }

        private void E089Relayout()
        {
            if(_e089Flow==null||_e089Flow.IsDisposed)return;
            var available=Math.Max(380,_e089Flow.ClientSize.Width-
                _e089Flow.Padding.Horizontal-25);
            var columns=available>=1060?4:available>=800?3:2;
            var itemWidth=Math.Max(165,(available/columns)-9);
            _e089Flow.SuspendLayout();
            try
            {
                _e089Header.Width=available;
                _e089Info.Width=available;
                foreach(var row in _e090GroupRows)row.Width=available;
                foreach(var card in _e089Cards.Values)card.Shell.Width=itemWidth;
            }
            finally{_e089Flow.ResumeLayout(true);}
        }

        private static void E093SetCycleRowVisible(E089Card card,bool visible)
        {
            if(card.Layout==null)return;
            card.CycleTargets.Visible=visible;
            card.CycleBarTrack.Visible=visible;
            card.Layout.RowStyles[6].Height=visible?24f:0f;
            card.Layout.RowStyles[7].Height=visible?13f:0f;
            card.Shell.Height=visible?294:257;
        }

        private static bool E089Gauge(string id)
        {
            return new[]{"firestore_connections","firestore_listeners","firestore_storage",
                "rtdb_connections","rtdb_monthly_sent","rtdb_storage_bytes"}
                .Contains(id);
        }

        private static bool E089Sample(Dictionary<string,object> metric,
            object item,out DateTime local,out double amount)
        {
            local=DateTime.MinValue;amount=0;
            var m=D160UsageJson.Map(item);
            var stamp=D173UsageParseUtc(D160UsageJson.String(m,"at"));
            if(stamp==DateTime.MinValue)return false;
            var raw=D160UsageJson.String(m,"value");
            if(!double.TryParse(raw,NumberStyles.Any,CultureInfo.InvariantCulture,
                    out amount)||double.IsNaN(amount)||double.IsInfinity(amount)||
                amount<0)return false;
            local=stamp.AddHours(7);
            return true;
        }

        private static double? E089Sum(Dictionary<string,object> metric,
            DateTime begin,DateTime end,bool gauge)
        {
            var source=D160UsageJson.List(D160UsageJson.Value(metric,"points"));
            if(source==null)return null;
            double value=0;bool found=false;
            DateTime latest=DateTime.MinValue;
            foreach(var item in source)
            {
                DateTime time;double amount;
                if(!E089Sample(metric,item,out time,out amount))continue;
                if(time<begin||time>end)continue;
                if(gauge){if(time>=latest){latest=time;value=amount;found=true;}}
                else{value+=amount;found=true;}
            }
            return found?(double?)value:null;
        }

        private DateTime E089End(DateTime day,DateTime now)
        {
            var normal=day.Date.AddHours(22);
            var coordinator=_leaderCoordinator;
            if(coordinator==null)return normal;
            var schedule=new AgentBusinessSchedule("");
            var key=schedule.ScheduleKey(day.Date.AddHours(22));
            var timestamp=coordinator.SharedRelayOverrideUntilMs;
            if(timestamp<=0)return normal;
            var currentKey=schedule.ScheduleKey(now);
            if(!string.Equals(key,currentKey,StringComparison.Ordinal))return normal;
            DateTime date;
            try{date=DateTimeOffset.FromUnixTimeMilliseconds(timestamp)
                    .ToOffset(TimeSpan.FromHours(7)).DateTime;}
            catch{return normal;}
            // This timestamp comes from the existing CAS-controlled fleet schedule.
            // Cancellation closes forecast but retains already incurred overtime.
            // CANCEL_OVERTIME retains its CAS cancellation instant as
            // relay_override_until_ms, so incurred overtime is not discarded.
            // Forecast ends at that instant instead of projecting further.
            if(date>normal && date<=day.Date.AddDays(1).AddHours(5))
                return date;
            return normal;
        }

        private static double? E089Forecast(Dictionary<string,object> metric,
            DateTime shiftStart,DateTime now,DateTime horizon,double? observed)
        {
            if(!observed.HasValue||now<shiftStart||E089Gauge(
                    D160UsageJson.String(metric,"id")))return null;
            if(now>=horizon)return observed;
            var points=new List<DateTime>();
            foreach(var item in D160UsageJson.List(
                D160UsageJson.Value(metric,"points"))??new object[0])
            {
                DateTime sample;double value;
                if(!E089Sample(metric,item,out sample,out value))continue;
                if(sample>=shiftStart && sample<=now)points.Add(sample);
            }
            if(points.Count<12||(now-shiftStart).TotalMinutes<60)return null;
            points.Sort();
            if((points.Last()-points.First()).TotalMinutes<40 ||
                (now-points.Last()).TotalMinutes>90)return null;
            for(var i=1;i<points.Count;i++)
                if((points[i]-points[i-1]).TotalMinutes>90)return null;
            var hours=(now-shiftStart).TotalHours;
            if(hours<=0)return null;
            return observed.Value+(observed.Value/hours)*(horizon-now).TotalHours;
        }

        private static int E089CycleDays(Dictionary<string,Dictionary<string,object>> metrics)
        {
            Dictionary<string,object> billing;
            if(!metrics.TryGetValue("cf_do_sql_storage",out billing))return 0;
            DateTime start,end;
            if(!DateTime.TryParse(D160UsageJson.String(billing,"cycle_start"),out start)||
                !DateTime.TryParse(D160UsageJson.String(billing,"cycle_end"),out end))return 0;
            var days=(int)(end.Date-start.Date).TotalDays;
            return days>=28&&days<=32?days:0;
        }

        private bool E093CycleWindow(out DateTime begin,out DateTime end)
        {
            begin=DateTime.MinValue;end=DateTime.MinValue;
            if(_d173VpsSnapshotCycle==null)return false;
            var collected=D173UsageParseUtc(D160UsageJson.String(
                _d173VpsSnapshotCycle,"collected_at"));
            if(collected==DateTime.MinValue||
                (DateTime.UtcNow-collected).TotalHours>36)return false;
            var rows=D160UsageJson.List(D160UsageJson.Value(
                _d173VpsSnapshotCycle,"items"));
            foreach(var row in rows??new object[0])
            {
                var metric=D160UsageJson.Map(row);
                if(D160UsageJson.String(metric,"id")!="cf_do_sql_storage")continue;
                begin=D173UsageParseUtc(D160UsageJson.String(metric,"cycle_start"));
                end=D173UsageParseUtc(D160UsageJson.String(metric,"cycle_end"));
                var days=(end-begin).TotalDays;
                // Partial UTC boundary days cannot be represented by daily buckets.
                return begin!=DateTime.MinValue&&end!=DateTime.MinValue&&
                    begin.TimeOfDay==TimeSpan.Zero&&end.TimeOfDay==TimeSpan.Zero&&
                    days>=28&&days<=32&&
                    DateTime.UtcNow>=begin&&DateTime.UtcNow<end;
            }
            return false;
        }

        private double? E093CycleUsed(string id,DateTime begin)
        {
            var items=D160UsageJson.List(D160UsageJson.Value(
                _d173VpsSnapshotCycle,"items"));
            foreach(var item in items??new object[0])
            {
                var metric=D160UsageJson.Map(item);
                if(D160UsageJson.String(metric,"id")!=id)continue;
                if(D160UsageJson.String(metric,"status")!="OK")return null;
                var days=new Dictionary<DateTime,double>();
                foreach(var p in D160UsageJson.List(D160UsageJson.Value(
                    metric,"points"))??new object[0])
                {
                    var sample=D160UsageJson.Map(p);
                    var at=D173UsageParseUtc(D160UsageJson.String(sample,"at"));
                    double value;
                    if(at==DateTime.MinValue||at.Date<begin.Date||
                        at.Date>DateTime.UtcNow.Date)continue;
                    if(!double.TryParse(D160UsageJson.String(sample,"value"),
                        NumberStyles.Any,CultureInfo.InvariantCulture,out value)||
                        double.IsNaN(value)||double.IsInfinity(value)||value<0||
                        days.ContainsKey(at.Date))return null;
                    days[at.Date]=value;
                }
                var total=0d;
                for(var date=begin.Date;date<=DateTime.UtcNow.Date;
                    date=date.AddDays(1))
                {
                    double value;
                    if(!days.TryGetValue(date,out value))return null;
                    total+=value;
                }
                return total;
            }
            return null;
        }

        private static double? E089Target(string id,int cycleDays)
        {
            if(id=="firestore_reads")return 50000d;
            if(id=="firestore_writes"||id=="firestore_deletes")return 20000d;
            double included;
            if(cycleDays>0 && D173IncludedSharedCycleReference.TryGetValue(
                id,out included) && !id.Equals("cf_do_sql_storage",StringComparison.Ordinal))
                return included*0.5d/cycleDays;
            return null;
        }

        private static string E089Severity(double ratio)
        {
            if(ratio>=1)return "VƯỢT";
            if(ratio>=0.95)return "NGUY CƠ";
            if(ratio>=0.85)return "CẢNH BÁO";
            if(ratio>=0.7)return "CHÚ Ý";
            return "OK";
        }

        private static Color E089RiskColor(double? ratio)
        {
            if(!ratio.HasValue)return Color.FromArgb(133,150,166);
            if(ratio.Value>=0.95)return Color.FromArgb(228,82,92);
            if(ratio.Value>=0.7)return Color.FromArgb(230,160,58);
            return Color.FromArgb(16,175,156);
        }

        private void E089UpdateBars(E089Card card,double? day,double? cycle)
        {
            if(card.BarTrack.IsDisposed||card.CycleBarTrack.IsDisposed)return;
            card.DayRatio=day;
            card.CycleRatio=cycle;
            card.BarFill.Width=day.HasValue?
                (int)Math.Round(Math.Min(1d,Math.Max(0d,day.Value))*
                    card.BarTrack.ClientSize.Width):0;
            card.CycleBarFill.Width=cycle.HasValue?
                (int)Math.Round(Math.Min(1d,Math.Max(0d,cycle.Value))*
                    card.CycleBarTrack.ClientSize.Width):0;
        }

        private void E089Render()
        {
            if(!_e089Active||_d173VpsSnapshot24h==null)return;
            var data=D160UsageJson.List(D160UsageJson.Value(_d173VpsSnapshot24h,"items"));
            if(data==null)return;
            var byId=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
            foreach(var obj in data)
            {
                var map=D160UsageJson.Map(obj);
                var id=D160UsageJson.String(map,"id");
                if(id.Length>0)byId[id]=map;
            }
            var now=DateTime.UtcNow.AddHours(7);
            var operationalDay=now.Hour<5?now.Date.AddDays(-1):now.Date;
            var start=operationalDay.AddHours(6);
            var end=E089End(operationalDay,now);
            var actualEnd=now<end?now:end;
            DateTime cycleBegin,cycleEnd;
            var cycleKnown=E093CycleWindow(out cycleBegin,out cycleEnd);
            var cycleDays=cycleKnown?(int)(cycleEnd-cycleBegin).TotalDays:0;
            _e089Header.Text="Giám sát Usage  ·  "+
                start.ToString("dd/MM HH:mm")+" → "+
                (now<start?"chưa vào ca":actualEnd.ToString("HH:mm"))+
                "  ·  dự báo đến "+end.ToString("dd/MM HH:mm")+
                (end>operationalDay.AddHours(22)?" (tăng ca)":"");
            _e089Info.Text="Số theo ca không thay thế tổng billing/quota Provider. "+
                "Cloudflare dùng chung · Firestore quota ngày Pacific · "+
                "Nguồn cập nhật: "+D160UsageJson.String(_d173VpsSnapshot24h,"collected_at");
            foreach(var card in _e089Cards.Values)
            {
                Dictionary<string,object> metric;
                if(!byId.TryGetValue(card.Id,out metric))
                {
                    card.Number.Text="N/A";
                    card.Caption.Text=card.Id;
                    card.Shell.Tag="NO_DATA";
                    card.Forecast.Text="Dự kiến: chưa có nguồn";
                    card.Targets.Text="Ngày: chưa có nguồn";
                    card.CycleTargets.Text="Chu kỳ: chưa có nguồn";
                    E093SetCycleRowVisible(card,false);
                    card.Alert.Text="NO_DATA";
                    card.Scope.Text="Không có dữ liệu API";
                    card.SourceTime.Text="Mẫu: —";
                    card.Spark.Samples=new double[0];card.Spark.Invalidate();
                    E089UpdateBars(card,null,null);
                    continue;
                }
                var status=D160UsageJson.String(metric,"status");
                var name=D160UsageJson.String(metric,"label");
                var unit=D160UsageJson.String(metric,"unit");
                var cadence=D173ConfiguredSyncMinutes(card.Id,metric);
                card.Caption.Text=name+"  ·  Sync "+cadence+" phút";
                card.Scope.Text=D160UsageJson.String(metric,"scope")+
                    (E089Gauge(card.Id)?" · Mức hiện tại":" · Ca từ 06:00");
                card.Scope.Tag="Biểu đồ/tổng ca từ 06:00; cảnh báo theo quota ngày Provider, "+
                    "không loại chi phí nền ngoài ca khỏi billing.";
                var valid=status=="OK"||status=="BILLING_PERIOD";
                var gauge=E089Gauge(card.Id);
                var amount=valid&&now>=start?E089Sum(metric,start,actualEnd,gauge):null;
                if(card.Id=="cf_do_sql_storage")
                {
                    amount=null;
                    var billing=D160UsageJson.Value(metric,"total");
                    if(valid&&billing!=null)
                    {
                        double raw;
                        if(double.TryParse(Convert.ToString(billing,CultureInfo.InvariantCulture),
                            NumberStyles.Any,CultureInfo.InvariantCulture,out raw))
                            amount=raw;
                    }
                }
                card.Number.Text=amount.HasValue?D173UsageNum(amount.Value,unit):"N/A";
                var trend=new List<double>();
                foreach(var item in D160UsageJson.List(
                    D160UsageJson.Value(metric,"points"))??new object[0])
                {
                    DateTime sample;double sampleValue;
                    if(E089Sample(metric,item,out sample,out sampleValue)&&
                        sample>=start&&sample<=actualEnd)trend.Add(sampleValue);
                }
                card.Spark.Samples=valid?trend.ToArray():new double[0];
                card.Spark.Invalidate();
                var target=valid?E089Target(card.Id,cycleDays):null;
                double? ratio=null;
                if(target.HasValue&&target.Value>0&&amount.HasValue)
                {
                    if(card.Id=="firestore_reads"||card.Id=="firestore_writes"||
                        card.Id=="firestore_deletes")
                    {
                        // Firestore quotas reset at midnight Pacific. Never
                        // report the 06:00-VN subset as a full quota-day percentage.
                        // The provider's 24h time-series includes the current
                        // Pacific day, even when it crosses Vietnam midnight.
                        try
                        {
                            var tz=TimeZoneInfo.FindSystemTimeZoneById("Pacific Standard Time");
                            var pacific=TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,tz);
                            var midnight=DateTime.SpecifyKind(pacific.Date,
                                DateTimeKind.Unspecified);
                            var startUtc=TimeZoneInfo.ConvertTimeToUtc(midnight,tz);
                            var startVn=startUtc.AddHours(7);
                            var quotaUsed=E089Sum(metric,startVn,now,false);
                            ratio=quotaUsed.HasValue?quotaUsed.Value/target.Value:(double?)null;
                        }
                        catch(TimeZoneNotFoundException){ratio=null;}
                        catch(InvalidTimeZoneException){ratio=null;}
                    }
                    else
                    {
                        // Cloudflare has a cycle-based allowance, but the per-day
                        // progress uses the full local calendar day (00:00-now).
                        // Do NOT divide a 06:00-only subtotal by a whole-day target:
                        // doing so silently hides real off-shift usage.
                        var dayActual=E089Sum(metric,operationalDay.Date,now,false);
                        ratio=dayActual.HasValue?dayActual.Value/target.Value:(double?)null;
                    }
                }
                double? cycleRatio=null;
                double included;
                if(cycleKnown && card.Id.StartsWith("cf_",StringComparison.Ordinal) &&
                    card.Id!="cf_do_sql_storage" && !gauge &&
                    D173IncludedSharedCycleReference.TryGetValue(card.Id,out included))
                {
                    var used=E093CycleUsed(card.Id,cycleBegin);
                    var allowance=included*0.5d;
                    if(used.HasValue && allowance>0)
                    {
                        cycleRatio=used.Value/allowance;
                        card.CycleTargets.Text="Kỳ: "+
                            D173UsageNum(used.Value,unit)+" / "+
                            D173UsageNum(allowance,unit)+" · "+
                            D173VpsPercent(used.Value,allowance);
                    }
                    else card.CycleTargets.Text="Kỳ: thiếu mẫu từ đầu chu kỳ";
                }
                else card.CycleTargets.Text=
                    card.Id.StartsWith("cf_",StringComparison.Ordinal) &&
                    card.Id!="cf_do_sql_storage" && !gauge ?
                    "Kỳ: chưa xác thực chu kỳ" : "Kỳ: không áp dụng";
                if(card.Id=="rtdb_monthly_sent")
                {
                    Dictionary<string,object> limitMetric;
                    if(byId.TryGetValue("rtdb_monthly_sent_limit",out limitMetric) &&
                        D160UsageJson.String(limitMetric,"status")=="OK")
                    {
                        var actual=E089Sum(metric,now.AddDays(-1),now,true);
                        var limit=E089Sum(limitMetric,now.AddDays(-1),now,true);
                        if(actual.HasValue&&limit.HasValue&&limit.Value>0)
                        {
                            cycleRatio=actual.Value/limit.Value;
                            card.CycleTargets.Text="Tháng RTDB: "+
                                D173UsageNum(actual.Value,unit)+" / "+
                                D173UsageNum(limit.Value,unit)+" · "+
                                D173VpsPercent(actual.Value,limit.Value);
                        }
                    }
                }
                E093SetCycleRowVisible(card,
                    (card.Id.StartsWith("cf_",StringComparison.Ordinal) &&
                     D173IncludedSharedCycleReference.ContainsKey(card.Id) &&
                     card.Id!="cf_do_sql_storage" &&
                     card.Id!="cf_d1_storage") ||
                    (card.Id=="rtdb_monthly_sent"&&cycleRatio.HasValue));
                card.Targets.Text="Ngày: "+(target.HasValue ?
                    (ratio.HasValue?D173UsageNum(ratio.Value*target.Value,unit):
                        "Chưa đủ mẫu")+" / "+
                    D173UsageNum(target.Value,unit)+" · "+
                    (ratio.HasValue?D173VpsPercent(ratio.Value*target.Value,
                        target.Value):"N/A") : "Không có target xác thực");
                var projected=valid&&!gauge?E089Forecast(metric,start,now,end,amount):null;
                card.Forecast.Text="Dự kiến "+end.ToString("HH:mm")+": "+
                    (projected.HasValue?D173UsageNum(projected.Value,unit):"Chưa đủ mẫu");
                double? projectedRatio=null;
                if(projected.HasValue&&target.HasValue&&target.Value>0)
                {
                    if(card.Id.StartsWith("cf_",StringComparison.Ordinal))
                    {
                        var outsideBeforeShift=E089Sum(metric,operationalDay.Date,start,false);
                        // Forecast is for 06:00-to-cutoff; pre-shift usage remains
                        // in the day's cost. With incomplete off-shift samples,
                        // no authoritative projected quota percentage is asserted.
                        if(outsideBeforeShift.HasValue)
                            projectedRatio=(projected.Value+outsideBeforeShift.Value)/target.Value;
                    }
                }
                var greatest=ratio;
                if(cycleRatio.HasValue && (!greatest.HasValue ||
                    cycleRatio.Value>greatest.Value))greatest=cycleRatio;
                if(projectedRatio.HasValue && (!greatest.HasValue ||
                    projectedRatio.Value>greatest.Value))
                    greatest=projectedRatio;
                card.Alert.Text=ratio.HasValue?
                    E089Severity(greatest.Value)+" "+D173VpsPercent(
                        ratio.Value*100d,100d):
                    (valid?"Không có %":"NO_DATA");
                if(projectedRatio.HasValue && projectedRatio.Value>=0.7d &&
                    (!ratio.HasValue||projectedRatio.Value>ratio.Value))
                    card.Forecast.Text+=" · Dự báo "+E089Severity(projectedRatio.Value);
                card.Alert.ForeColor=E089RiskColor(greatest);
                card.BarFill.BackColor=E089RiskColor(ratio);
                card.CycleBarFill.BackColor=E089RiskColor(cycleRatio);
                E089UpdateBars(card,ratio,cycleRatio);
                var rawStamp=D160UsageJson.String(metric,"latest_at");
                var localStamp=D173UsageParseUtc(rawStamp);
                card.SourceTime.Text=localStamp!=DateTime.MinValue?
                    "Mẫu: "+localStamp.AddHours(7).ToString("HH:mm dd/MM",
                        CultureInfo.GetCultureInfo("vi-VN")):"Mẫu: chưa có";
                card.Shell.Tag=status;
            }
            E089ApplyTheme(D173IsDarkThemeActive());
        }

        private void E089ApplyTheme(bool dark)
        {
            if(!_e089Active||_e089Flow==null||_e089Flow.IsDisposed)return;
            var bg=dark?Color.FromArgb(10,20,36):Color.FromArgb(242,247,252);
            var cardBg=dark?Color.FromArgb(18,35,57):Color.White;
            var fg=dark?Color.FromArgb(232,241,254):Color.FromArgb(24,44,69);
            var muted=dark?Color.FromArgb(162,181,201):Color.FromArgb(91,109,129);
            _e089Flow.BackColor=bg;
            _e089Header.ForeColor=fg;_e089Info.ForeColor=muted;
            foreach(var heading in _e089Headings)heading.ForeColor=fg;
            foreach(var metric in _e089Cards.Values)
            {
                var sourceStatus=Convert.ToString(metric.Shell.Tag)??"";
                var noSource=sourceStatus!="OK"&&sourceStatus!="BILLING_PERIOD";
                var dim=dark?Color.FromArgb(103,121,145):Color.FromArgb(153,165,178);
                metric.Shell.BackColor=noSource?
                    (dark?Color.FromArgb(15,29,45):Color.FromArgb(241,244,247)):cardBg;
                metric.Icon.ForeColor=noSource?dim:Color.FromArgb(0,164,149);
                metric.Icon.Invalidate();
                metric.Caption.ForeColor=noSource?dim:fg;
                metric.Number.ForeColor=noSource?dim:
                    (dark?Color.FromArgb(25,225,197):Color.FromArgb(22,98,164));
                metric.Scope.ForeColor=noSource?dim:muted;
                metric.Targets.ForeColor=noSource?dim:fg;
                metric.CycleTargets.ForeColor=noSource?dim:fg;
                metric.Forecast.ForeColor=noSource?dim:fg;
                metric.Alert.ForeColor=noSource?dim:metric.Alert.ForeColor;
                metric.SourceTime.ForeColor=noSource?dim:muted;
                metric.Spark.BackColor=metric.Shell.BackColor;
                metric.BarTrack.BackColor=dark?Color.FromArgb(47,68,93):Color.FromArgb(218,229,238);
                metric.CycleBarTrack.BackColor=metric.BarTrack.BackColor;
            }
        }
    }
}
