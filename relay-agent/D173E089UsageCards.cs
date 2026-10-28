using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // D173-E089: WinForms-native card-only read-only VPS Usage view.
    // No provider calls, timers, business mutations, credentials or mock samples.
    internal sealed partial class AgentForm
    {
        private sealed class E089Card
        {
            internal string Id;
            internal Panel Shell;
            internal Label Caption, Number, Scope, Targets, Forecast, Alert, SourceTime;
            internal Panel BarTrack, BarFill;
            internal E079NativeSparkline Spark;
        }

        private readonly Dictionary<string,E089Card> _e089Cards =
            new Dictionary<string,E089Card>(StringComparer.Ordinal);
        private readonly List<Label> _e089Headings = new List<Label>();
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
                _e089Flow.Controls.Add(title);
                _e089Flow.SetFlowBreak(title,true);
                _e089Headings.Add(title);
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
            card.Shell=new Panel {Name="UsageCard_"+id,Width=281,Height=242,
                Padding=new Padding(10,5,10,7),Margin=new Padding(4)};
            var table=new TableLayoutPanel {Dock=DockStyle.Fill,
                ColumnCount=1,RowCount=8,Margin=Padding.Empty,Padding=Padding.Empty};
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
            foreach(var h in new[]{28f,32f,18f,57f,38f,13f,22f,25f})
                table.RowStyles.Add(new RowStyle(SizeType.Absolute,h));
            card.Caption=E089Label(id+" · Sync ...",8,true);
            card.Number=E089Label("Chưa có số liệu",16,true);
            card.Scope=E089Label("Chưa xác minh nguồn",7.4f);
            card.Spark=new E079NativeSparkline {Dock=DockStyle.Fill};
            card.Targets=E089Label("Target ngày: —      Target kỳ: —",7.6f);
            card.BarTrack=new Panel {Dock=DockStyle.Fill,Margin=new Padding(0,4,0,3)};
            card.BarFill=new Panel {Dock=DockStyle.Left,Width=0};
            card.BarTrack.Controls.Add(card.BarFill);
            card.Forecast=E089Label("Dự kiến 22:00: chưa đủ mẫu",7.6f);
            card.Alert=E089Label("Chưa đủ nguồn",8f,true);
            card.SourceTime=E089Label("Mẫu nguồn: chưa có",7f);
            table.Controls.Add(card.Caption,0,0);
            table.Controls.Add(card.Number,0,1);
            table.Controls.Add(card.Scope,0,2);
            table.Controls.Add(card.Spark,0,3);
            table.Controls.Add(card.Targets,0,4);
            table.Controls.Add(card.BarTrack,0,5);
            // Last row combines forecast, inline alert and freshness by text.
            card.Forecast.TextAlign=ContentAlignment.MiddleLeft;
            table.Controls.Add(card.Forecast,0,6);
            var footer=new Panel {Dock=DockStyle.Fill};
            card.Alert.Dock=DockStyle.Left;card.Alert.Width=122;
            card.SourceTime.Dock=DockStyle.Fill;
            footer.Controls.Add(card.SourceTime);
            footer.Controls.Add(card.Alert);
            table.Controls.Add(footer,0,7);
            card.Shell.Controls.Add(table);
            card.BarTrack.Resize+=(sender,args)=>E089UpdateBar(card,null);
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
                foreach(var heading in _e089Headings)heading.Width=available;
                foreach(var card in _e089Cards.Values)card.Shell.Width=itemWidth;
            }
            finally{_e089Flow.ResumeLayout(true);}
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

        private void E089UpdateBar(E089Card card,double? ratio)
        {
            if(card.BarTrack.IsDisposed)return;
            var width=card.BarTrack.ClientSize.Width;
            card.BarFill.Width=ratio.HasValue?
                (int)Math.Round(Math.Min(1d,Math.Max(0d,ratio.Value))*width):0;
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
            var cycleDays=E089CycleDays(byId);
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
                    card.Number.Text="Chưa có dữ liệu";
                    card.Caption.Text=card.Id;
                    card.Forecast.Text="Dự kiến: chưa có nguồn";
                    card.Targets.Text="Target ngày: — · Kỳ: —";
                    card.Alert.Text="NO_DATA";
                    card.Scope.Text="Không có dữ liệu API";
                    card.SourceTime.Text="Mẫu: —";
                    card.Spark.Samples=new double[0];card.Spark.Invalidate();
                    E089UpdateBar(card,null);
                    continue;
                }
                var status=D160UsageJson.String(metric,"status");
                var name=D160UsageJson.String(metric,"label");
                var unit=D160UsageJson.String(metric,"unit");
                var cadence=D173ConfiguredSyncMinutes(card.Id,metric);
                card.Caption.Text=name+"  ·  Sync "+cadence+" phút";
                card.Scope.Text=D160UsageJson.String(metric,"scope")+
                    (E089Gauge(card.Id)?" · Mức hiện tại":" · Theo ca");
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
                    else ratio=amount.Value/target.Value;
                }
                var cycle="—";
                double included;
                if(cycleDays>0&&D173IncludedSharedCycleReference.TryGetValue(
                    card.Id,out included))
                    cycle=D173UsageNum(included*0.5d,unit)+" (quy hoạch)";
                else if(card.Id=="firestore_reads"||card.Id=="firestore_writes"||
                        card.Id=="firestore_deletes")
                {
                    var pacificNow=TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
                        TimeZoneInfo.FindSystemTimeZoneById("Pacific Standard Time"));
                    cycle=D173UsageNum(target.Value*DateTime.DaysInMonth(
                        pacificNow.Year,pacificNow.Month),unit)+" (tham chiếu)";
                }
                card.Targets.Text="Ngày: "+(target.HasValue?
                    D173UsageNum(target.Value,unit):"Không áp dụng")+
                    "    Kỳ: "+cycle;
                var projected=valid&&!gauge?E089Forecast(metric,start,now,end,amount):null;
                card.Forecast.Text="Dự kiến "+end.ToString("HH:mm")+": "+
                    (projected.HasValue?D173UsageNum(projected.Value,unit):"Chưa đủ mẫu");
                var projectedRatio=projected.HasValue&&target.HasValue&&target.Value>0?
                    (double?)(projected.Value/target.Value):null;
                var greatest=ratio;
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
                card.BarFill.BackColor=E089RiskColor(greatest);
                E089UpdateBar(card,ratio);
                card.SourceTime.Text="Mẫu: "+(D160UsageJson.String(metric,"latest_at")??
                    "").Replace("T"," ").Replace("Z","");
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
                metric.Shell.BackColor=cardBg;
                metric.Caption.ForeColor=fg;
                metric.Number.ForeColor=dark?Color.FromArgb(25,225,197):Color.FromArgb(22,98,164);
                metric.Scope.ForeColor=muted;
                metric.Targets.ForeColor=fg;
                metric.Forecast.ForeColor=fg;
                metric.SourceTime.ForeColor=muted;
                metric.Spark.BackColor=cardBg;
                metric.BarTrack.BackColor=dark?Color.FromArgb(47,68,93):Color.FromArgb(218,229,238);
            }
        }
    }
}
