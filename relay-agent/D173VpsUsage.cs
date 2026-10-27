using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // Existing WinForms Agent shell extension only; there is no standalone Usage EXE.
    internal sealed partial class AgentForm
    {
        private readonly TabPage _d173VpsUsagePage = new TabPage("Giám sát Usage");
        private readonly System.Windows.Forms.Timer _d173VpsUsageClock = new System.Windows.Forms.Timer();
        private readonly Label _d173VpsUsageState = new Label();
        private readonly Label _d173VpsUsageBudget = new Label();
        private readonly Label _d173VpsUsageDaily = new Label();
        private readonly DataGridView _d173VpsUsageGrid = new DataGridView();
        private readonly Dictionary<string, D173UsagePlot> _d173VpsPlots =
            new Dictionary<string, D173UsagePlot>(StringComparer.Ordinal);
        private readonly Dictionary<string, Button> _d173VpsRangeButtons =
            new Dictionary<string, Button>(StringComparer.Ordinal);
        private Dictionary<string, object> _d173VpsSnapshot24h;
        private Dictionary<string, object> _d173VpsSelectedSnapshot;
        private string _d173VpsSelectedWindow = "24h";
        private string _d173VpsLastBoundary = "";
        private int _d173VpsRefreshInFlight;
        private int _d173VpsGeneration;
        private bool _d173VpsUsageAuthenticated;

        private void InitializeD173VpsUsage()
        {
            // Not inserted into _mainTabs until exact VPS login is verified.
            _d173VpsUsagePage.Padding = new Padding(8);
            _d173VpsUsagePage.AutoScroll = false;
            var root = new TableLayoutPanel {
                Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4,
                Padding = new Padding(8), Margin = Padding.Empty
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 46f));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 86f));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 48f));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 52f));
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            _d173VpsUsagePage.Controls.Add(root);

            var heading = new Panel { Dock = DockStyle.Fill };
            var label = new Label {
                Text = "Giám sát Usage · VPS", Left = 6, Top = 3, Width = 255,
                Font = new Font("Segoe UI Semibold", 13f, FontStyle.Bold),
                Height = 29
            };
            heading.Controls.Add(label);
            _d173VpsUsageState.Left = 270;
            _d173VpsUsageState.Top = 9;
            _d173VpsUsageState.Width = 510;
            _d173VpsUsageState.Height = 28;
            _d173VpsUsageState.Text = "Chờ dữ liệu nhà cung cấp · chưa đồng bộ";
            _d173VpsUsageState.AutoEllipsis = true;
            heading.Controls.Add(_d173VpsUsageState);
            var rangeBar = new FlowLayoutPanel {
                Dock = DockStyle.Right, Width = 330, FlowDirection = FlowDirection.RightToLeft,
                WrapContents = false
            };
            foreach (var range in new[]{"30d","7d","24h"})
            {
                var code = range;
                var button = new Button {
                    Text = range == "24h" ? "24 giờ" : range == "7d" ? "7 ngày" : "30 ngày",
                    Width = 100, Height = 31, Margin = new Padding(3),
                    FlatStyle = FlatStyle.Flat
                };
                button.Click += (s,e) => SelectD173VpsUsageWindow(code);
                _d173VpsRangeButtons[code] = button;
                rangeBar.Controls.Add(button);
            }
            heading.Controls.Add(rangeBar);
            root.Controls.Add(heading,0,0);

            var summaries = new TableLayoutPanel {
                Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1,
                Padding = Padding.Empty, Margin = Padding.Empty
            };
            summaries.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
            summaries.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
            var budgetCard = new D173BufferedCardPanel {Dock=DockStyle.Fill,Margin=new Padding(3)};
            var dailyCard = new D173BufferedCardPanel {Dock=DockStyle.Fill,Margin=new Padding(3)};
            _d173VpsUsageBudget.Dock = DockStyle.Fill;
            _d173VpsUsageBudget.Padding = new Padding(12,8,6,6);
            _d173VpsUsageBudget.Text =
                "Target chu kỳ: 30% các pool Cloudflare thực sự dùng chung; không chia phí gói 5 USD cho riêng Inventory. Quỹ dự phòng tăng thêm chung: 5 USD.";
            _d173VpsUsageDaily.Dock = DockStyle.Fill;
            _d173VpsUsageDaily.Padding = new Padding(12,8,6,6);
            _d173VpsUsageDaily.Text = "Hạn mức ngày: Firestore 50.000 Reads, 20.000 Writes, 20.000 Deletes · Email Service 3.000/ngày (chung). Drive/Sheets không có target ngày giả.";
            budgetCard.Controls.Add(_d173VpsUsageBudget);
            dailyCard.Controls.Add(_d173VpsUsageDaily);
            summaries.Controls.Add(budgetCard,0,0);
            summaries.Controls.Add(dailyCard,1,0);
            root.Controls.Add(summaries,0,1);

            var charts = new TableLayoutPanel {
                Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2,
                Margin = Padding.Empty, Padding = new Padding(1)
            };
            charts.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
            charts.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
            charts.RowStyles.Add(new RowStyle(SizeType.Percent,50));
            charts.RowStyles.Add(new RowStyle(SizeType.Percent,50));
            AddD173UsagePlot(charts,"Cloudflare · DO & Workers",0,0,
                new[]{"cf_do_requests","cf_worker_requests","cf_do_rows_read"});
            AddD173UsagePlot(charts,"Cloudflare · CPU / Storage Operations",1,0,
                new[]{"cf_worker_cpu","cf_do_rows_written","cf_do_duration"});
            AddD173UsagePlot(charts,"Firestore · Reads / Writes",0,1,
                new[]{"firestore_reads","firestore_writes","firestore_deletes"});
            AddD173UsagePlot(charts,"Realtime Database · Traffic",1,1,
                new[]{"rtdb_sent_bytes","rtdb_payload_bytes","rtdb_protocol_bytes"});
            root.Controls.Add(charts,0,2);

            _d173VpsUsageGrid.Dock = DockStyle.Fill;
            _d173VpsUsageGrid.ReadOnly = true;
            _d173VpsUsageGrid.AllowUserToAddRows = false;
            _d173VpsUsageGrid.AllowUserToDeleteRows = false;
            _d173VpsUsageGrid.RowHeadersVisible = false;
            _d173VpsUsageGrid.AllowUserToResizeRows = false;
            _d173VpsUsageGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _d173VpsUsageGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            _d173VpsUsageGrid.ColumnHeadersHeight = 32;
            _d173VpsUsageGrid.Columns.Add("usage","Usage");
            _d173VpsUsageGrid.Columns.Add("scope","Phạm vi");
            _d173VpsUsageGrid.Columns.Add("value","Giá trị");
            _d173VpsUsageGrid.Columns.Add("today","Hôm nay");
            _d173VpsUsageGrid.Columns.Add("limit","Hạn mức ngày");
            _d173VpsUsageGrid.Columns.Add("cycleTarget","Target kỳ 30%*");
            _d173VpsUsageGrid.Columns.Add("percentage","% ngày");
            _d173VpsUsageGrid.Columns.Add("updated","Dữ liệu đến");
            _d173VpsUsageGrid.Columns.Add("status","Trạng thái");
            _d173VpsUsageGrid.Columns["usage"].FillWeight = 165;
            _d173VpsUsageGrid.Columns["scope"].FillWeight = 95;
            _d173VpsUsageGrid.Columns["value"].FillWeight = 90;
            _d173VpsUsageGrid.Columns["today"].FillWeight = 85;
            _d173VpsUsageGrid.Columns["limit"].FillWeight = 90;
            _d173VpsUsageGrid.Columns["percentage"].FillWeight = 70;
            _d173VpsUsageGrid.Columns["cycleTarget"].FillWeight = 125;
            _d173VpsUsageGrid.Columns["updated"].FillWeight = 112;
            _d173VpsUsageGrid.Columns["status"].FillWeight = 100;
            root.Controls.Add(_d173VpsUsageGrid,0,3);

            _d173VpsUsageClock.Interval = 30_000;
            _d173VpsUsageClock.Tick += (s,e) => TryD173VpsUsageBoundary();
            Disposed += (s,e) => { _d173VpsUsageClock.Stop(); _d173VpsUsageClock.Dispose(); };
        }

        private void AddD173UsagePlot(TableLayoutPanel host,string title,int col,int row,string[] ids)
        {
            var plot = new D173UsagePlot {
                Dock=DockStyle.Fill, Margin=new Padding(3), Title=title, MetricIds=ids,
                PaletteProvider=() => D173Sample2Colors(D173IsDarkThemeActive())
            };
            _d173VpsPlots[title]=plot;
            host.Controls.Add(plot,col,row);
        }

        private bool D173VpsUserAllowed(bool authenticated, string loginName,string appUserId)
        {
            // Fail closed: exact operator login only; a generic ADMIN or a machine named VPS
            // can never satisfy this check. Server separately verifies employee_code==vps.
            return authenticated &&
                string.Equals(CleanAgentUsername(loginName).Trim(),"vps",
                              StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(appUserId);
        }

        private void UpdateD173VpsUsageVisibility(bool authenticated,string loginName,string appUserId)
        {
            var allowed=D173VpsUserAllowed(authenticated,loginName,appUserId);
            if(allowed==_d173VpsUsageAuthenticated)return;
            _d173VpsUsageAuthenticated=allowed;
            Interlocked.Increment(ref _d173VpsGeneration);
            if(allowed)
            {
                if(!_mainTabs.TabPages.Contains(_d173VpsUsagePage))
                    _mainTabs.TabPages.Add(_d173VpsUsagePage);
                _d173VpsUsageClock.Start();
                TryD173VpsUsageRefresh("24h",true);
            }
            else
            {
                _d173VpsUsageClock.Stop();
                _d173VpsLastBoundary="";
                _d173VpsSnapshot24h=null;
                _d173VpsSelectedSnapshot=null;
                if(_mainTabs.SelectedTab==_d173VpsUsagePage) _mainTabs.SelectedTab=_overviewPage;
                if(_mainTabs.TabPages.Contains(_d173VpsUsagePage))
                    _mainTabs.TabPages.Remove(_d173VpsUsagePage);
                _d173VpsUsageGrid.Rows.Clear();
                _d173VpsUsageState.Text="Chưa đăng nhập VPS";
                foreach(var plot in _d173VpsPlots.Values){plot.Series.Clear();plot.Invalidate();}
            }
            RefreshD173E038Sidebar();
            ApplyD173AppWideTheme(force:true);
        }

        private void TryD173VpsUsageBoundary()
        {
            if(!_d173VpsUsageAuthenticated)return;
            var now=DateTime.Now;
            if(now.Minute%5!=0)return;
            var key=now.ToString("yyyyMMddHHmm",CultureInfo.InvariantCulture);
            if(string.Equals(_d173VpsLastBoundary,key,StringComparison.Ordinal))return;
            _d173VpsLastBoundary=key;
            // The 24h window always refreshes daily targets; 7d/30d refresh only on
            // selection, avoiding a second 36-metric provider sweep every five minutes.
            TryD173VpsUsageRefresh("24h",false);
        }

        private void SelectD173VpsUsageWindow(string window)
        {
            if(!_d173VpsUsageAuthenticated||!new[]{"24h","7d","30d"}.Contains(window))return;
            _d173VpsSelectedWindow=window;
            foreach(var kv in _d173VpsRangeButtons)
            {
                kv.Value.BackColor=kv.Key==window?D173Sample2Colors(D173IsDarkThemeActive()).Accent:
                    D173Sample2Colors(D173IsDarkThemeActive()).Surface;
                kv.Value.ForeColor=kv.Key==window?Color.White:D173Sample2Colors(D173IsDarkThemeActive()).Text;
            }
            if(window=="24h"&&_d173VpsSnapshot24h!=null)
            {
                _d173VpsSelectedSnapshot=_d173VpsSnapshot24h;
                RenderD173VpsUsage();
            }
            else
            {
                var path=D173VpsCachePath(window);
                try {
                    if(File.Exists(path))
                    {
                        _d173VpsSelectedSnapshot=D160UsageJson.Map(
                            new JavaScriptSerializer{MaxJsonLength=12*1024*1024}.DeserializeObject(File.ReadAllText(path)));
                        RenderD173VpsUsage();
                    }
                } catch {/* no local snapshot */}
                TryD173VpsUsageRefresh(window,true);
            }
        }

        private static string D173VpsCachePath(string window)
        {
            return Path.Combine(RelayDataDir,"usage-vps-"+window+".json");
        }

        private void TryD173VpsUsageRefresh(string window,bool manual)
        {
            if(!_d173VpsUsageAuthenticated)return;
            if(Interlocked.CompareExchange(ref _d173VpsRefreshInFlight,1,0)!=0)return;
            var generation=_d173VpsGeneration;
            _d173VpsUsageState.Text="Đang đồng bộ · "+window+" · không ảnh hưởng WMS";
            Task.Run(()=>{
                Dictionary<string,object> response=null;
                string failure=null;
                try
                {
                    var session=SnapshotSession();
                    if(!D173VpsUserAllowed(true,session.LoginName,session.AppUserId))
                        throw new InvalidOperationException("VPS_SESSION_REQUIRED");
                    // Read-only token; never persist ID token, password or provider token.
                    var endpoint=AgentConfig.ApiBaseUrl+"/api/agent/vps-usage?window="+Uri.EscapeDataString(window);
                    var request=(HttpWebRequest)WebRequest.Create(endpoint);
                    request.Method="GET";
                    request.Timeout=35000;
                    request.ReadWriteTimeout=35000;
                    request.Headers[HttpRequestHeader.Authorization]="Bearer "+session.IdToken;
                    request.Accept="application/json";
                    using(var reply=(HttpWebResponse)request.GetResponse())
                    using(var reader=new StreamReader(reply.GetResponseStream()))
                    {
                        var raw=reader.ReadToEnd();
                        response=D160UsageJson.Map(
                            new JavaScriptSerializer{MaxJsonLength=12*1024*1024}.DeserializeObject(raw));
                        if(D160UsageJson.String(response,"schema")!="D173_VPS_USAGE_V1")
                            throw new InvalidOperationException("VPS_USAGE_SCHEMA_MISMATCH");
                    }
                    // A complete result can be cached locally without secrets or user data.
                    Directory.CreateDirectory(RelayDataDir);
                    var target=D173VpsCachePath(window);
                    var tmp=target+".tmp";
                    File.WriteAllText(tmp,new JavaScriptSerializer{MaxJsonLength=12*1024*1024}.Serialize(response));
                    if(File.Exists(target))File.Delete(target);
                    File.Move(tmp,target);
                }
                catch(Exception ex){failure=ex is WebException?"PROVIDER_HTTP_OR_TIMEOUT":ex.GetType().Name;}
                finally{Interlocked.Exchange(ref _d173VpsRefreshInFlight,0);}
                Ui(()=>{
                    if(!_d173VpsUsageAuthenticated||generation!=_d173VpsGeneration||IsDisposed)return;
                    if(response!=null)
                    {
                        if(window=="24h")_d173VpsSnapshot24h=response;
                        if(window==_d173VpsSelectedWindow)
                        {
                            _d173VpsSelectedSnapshot=response;
                            RenderD173VpsUsage();
                        }
                    }
                    else _d173VpsUsageState.Text="Dữ liệu nguồn chậm hoặc lỗi "+failure+
                        " · giữ số liệu lần trước · không tác động nghiệp vụ";
                });
            });
        }

        private static readonly Dictionary<string, double> D173IncludedSharedCycleReference =
            new Dictionary<string,double>(StringComparer.Ordinal) {
                { "cf_do_requests", 1000000d },
                { "cf_do_duration", 400000d },
                { "cf_do_rows_read", 25000000000d },
                { "cf_do_rows_written", 50000000d },
                { "cf_worker_requests", 10000000d },
                { "cf_worker_cpu", 30000000000d }, // Worker metrics in microseconds; paid CPU allowance 30M ms.
                { "cf_d1_rows_read", 25000000000d },
                { "cf_d1_storage", 5368709120d },
                { "cf_do_sql_storage", 5368709120d }
            };
        // Historical provider-included limits, never a provider-enforced cap for
        // Inventory. For shared account pools, Inventory planning is 30%;
        // account-wide usage is NOT an attributable Inventory numerator.
        private static string D173VpsCycleTarget(string id,string unit)
        {
            double accountIncluded;
            if(!D173IncludedSharedCycleReference.TryGetValue(id,out accountIncluded))
                return "N/A";
            return D173UsageNum(accountIncluded*0.30,unit)+" (30% chung)";
        }

        private static string D173UsageNum(object item,string unit)
        {
            if(item==null)return "N/A";
            double v;
            if(!double.TryParse(Convert.ToString(item,CultureInfo.InvariantCulture),
                 NumberStyles.Any,CultureInfo.InvariantCulture,out v))return "N/A";
            if(unit=="bytes")return v>=1073741824?(v/1073741824).ToString("N2",CultureInfo.GetCultureInfo("vi-VN"))+" GB":
                v>=1048576?(v/1048576).ToString("N2",CultureInfo.GetCultureInfo("vi-VN"))+" MB":
                v.ToString("N0",CultureInfo.GetCultureInfo("vi-VN"))+" B";
            return v.ToString(v==Math.Floor(v)?"N0":"N2",CultureInfo.GetCultureInfo("vi-VN"));
        }
        private static DateTime D173UsageParseUtc(string raw)
        {
            DateTime d;
            return DateTime.TryParse(raw,CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|
                DateTimeStyles.AdjustToUniversal,out d)?d:DateTime.MinValue;
        }

        private double? D173TodaySum(Dictionary<string,object> metric)
        {
            var pts=D160UsageJson.List(D160UsageJson.Value(metric,"points"));
            if(pts==null)return null;
            var today=DateTime.UtcNow.AddHours(7).Date;
            double sum=0;
            bool found=false;
            foreach(var p in pts)
            {
                var row=D160UsageJson.Map(p);
                var at=D173UsageParseUtc(D160UsageJson.String(row,"at"));
                if(at==DateTime.MinValue||at.AddHours(7).Date!=today)continue;
                double value;
                if(double.TryParse(D160UsageJson.String(row,"value"),NumberStyles.Any,
                    CultureInfo.InvariantCulture,out value))
                {sum+=value;found=true;}
            }
            return found?(double?)sum:null;
        }

        private void RenderD173VpsUsage()
        {
            if(_d173VpsSelectedSnapshot==null)return;
            var rows=D160UsageJson.List(D160UsageJson.Value(_d173VpsSelectedSnapshot,"items"));
            var cache24=D160UsageJson.List(D160UsageJson.Value(_d173VpsSnapshot24h,"items"));
            var daily=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
            if(cache24!=null)foreach(var e in cache24)
            {
                var val=D160UsageJson.Map(e);
                var id=D160UsageJson.String(val,"id");
                if(!string.IsNullOrWhiteSpace(id))daily[id]=val;
            }
            _d173VpsUsageGrid.SuspendLayout();
            try{
                _d173VpsUsageGrid.Rows.Clear();
                var plotData=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
                if(rows!=null)foreach(var obj in rows)
                {
                    var metric=D160UsageJson.Map(obj);
                    var id=D160UsageJson.String(metric,"id");
                    var label=D160UsageJson.String(metric,"label");
                    var source=D160UsageJson.String(metric,"scope");
                    var unit=D160UsageJson.String(metric,"unit");
                    var status=D160UsageJson.String(metric,"status");
                    var value=D173UsageNum(D160UsageJson.Value(metric,"total"),unit);
                    var updated=D160UsageJson.String(metric,"latest_at");
                    var limit="N/A";
                    var percent="N/A";
                    var used="N/A";
                    Dictionary<string,object> d;
                    if(daily.TryGetValue(id,out d)&&
                       (id=="firestore_reads"||id=="firestore_writes"||id=="firestore_deletes"||id=="cf_emails_sent"))
                    {
                        var sum=D173TodaySum(d);
                        if(sum.HasValue)
                        {
                            used=D173UsageNum(sum.Value,unit);
                            var target=id=="firestore_reads"?50000:id=="cf_emails_sent"?3000:20000;
                            limit=D173UsageNum(target,unit);
                            percent=(sum.Value*100.0/target).ToString("N1",
                                CultureInfo.GetCultureInfo("vi-VN"))+"%";
                        }
                    }
                    var rowIndex=_d173VpsUsageGrid.Rows.Add(label,source,value,used,limit,
                        D173VpsCycleTarget(id,unit),percent,
                        updated.Length>=16?updated.Substring(0,16):updated,status);
                    if(status!="OK"&&status!="BILLING_PERIOD")
                        _d173VpsUsageGrid.Rows[rowIndex].DefaultCellStyle.ForeColor=
                            Color.FromArgb(184,108,38);
                    if(percent!="N/A")
                    {
                        double pct;
                        if(double.TryParse(percent.TrimEnd('%').Replace(',','.'),
                            NumberStyles.Any,CultureInfo.InvariantCulture,out pct) && pct>=70)
                        {
                            _d173VpsUsageGrid.Rows[rowIndex].Cells["percentage"].Style.ForeColor=
                                pct>=95?Color.FromArgb(211,55,55):pct>=85?
                                Color.FromArgb(190,91,32):Color.FromArgb(153,123,29);
                            _d173VpsUsageGrid.Rows[rowIndex].Cells["percentage"].Style.Font=
                                new Font("Segoe UI",9f,FontStyle.Bold);
                        }
                    }
                    plotData[id]=metric;
                }
                foreach(var plot in _d173VpsPlots.Values)
                {
                    plot.Series.Clear();
                    foreach(var id in plot.MetricIds)
                    {
                        Dictionary<string,object> metric;
                        if(!plotData.TryGetValue(id,out metric))continue;
                        if(D160UsageJson.String(metric,"status")!="OK")continue;
                        var pts=new List<double>();
                        foreach(var row in D160UsageJson.List(D160UsageJson.Value(metric,"points"))??new object[0])
                        {
                            double v;
                            if(double.TryParse(D160UsageJson.String(D160UsageJson.Map(row),"value"),
                                NumberStyles.Any,CultureInfo.InvariantCulture,out v))pts.Add(v);
                        }
                        if(pts.Count>0)plot.Series.Add(new D173UsageSeries{
                            Name=D160UsageJson.String(metric,"label"),
                            Values=pts.ToArray()
                        });
                    }
                    plot.Invalidate();
                }
                _d173VpsUsageState.Text="Đồng bộ: "+D160UsageJson.String(_d173VpsSelectedSnapshot,"collected_at")+
                    " · "+rows?.Count()+" chỉ số · nguồn có thể trễ · N/A không phải 0";
            }
            finally{_d173VpsUsageGrid.ResumeLayout();}
        }
    }

    internal sealed class D173UsageSeries
    {
        internal string Name;
        internal double[] Values;
    }
    internal sealed class D173UsagePlot : Panel
    {
        internal string Title;
        internal string[] MetricIds;
        internal readonly List<D173UsageSeries> Series=new List<D173UsageSeries>();
        internal Func<object> PaletteProvider;
        internal D173UsagePlot()
        {
            DoubleBuffered=true;
            ResizeRedraw=true;
            Padding=new Padding(9);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g=e.Graphics;
            var dark=Parent!=null&&Parent.BackColor.GetBrightness()<0.5f;
            var fg=dark?Color.FromArgb(228,236,247):Color.FromArgb(37,56,80);
            var axis=dark?Color.FromArgb(52,68,90):Color.FromArgb(220,229,238);
            using(var titleFont=new Font("Segoe UI Semibold",9f,FontStyle.Bold))
                g.DrawString(Title??"",titleFont,new SolidBrush(fg),new PointF(10,6));
            var area=new Rectangle(28,34,Math.Max(20,Width-42),Math.Max(12,Height-59));
            if(Series.Count==0){
                g.DrawString("N/A · Chưa có điểm dữ liệu có thể kiểm chứng",
                    Font,new SolidBrush(fg),new PointF(10,42));return;
            }
            for(int i=0;i<4;i++)
            {
                var y=area.Top+i*area.Height/3f;
                using(var pen=new Pen(axis,1f))
                    g.DrawLine(pen,area.Left,y,area.Right,y);
            }
            // Each line normalized individually. Legend declares this comparison
            // is shape-only, not a shared numeric axis for unlike units.
            Color[] palette={Color.FromArgb(0,142,136),Color.FromArgb(76,132,230),
                             Color.FromArgb(227,141,50)};
            for(int i=0;i<Series.Count;i++)
            {
                var vals=Series[i].Values;
                if(vals==null||vals.Length<2)continue;
                var max=Math.Max(vals.Max(),0.0001);
                using(var pen=new Pen(palette[i%palette.Length],1.8f))
                {
                    var points=new PointF[vals.Length];
                    for(int p=0;p<vals.Length;p++)
                        points[p]=new PointF(area.Left+(float)p/(vals.Length-1)*area.Width,
                            area.Bottom-(float)(vals[p]/max)*area.Height);
                    g.DrawLines(pen,points);
                }
                using(var brush=new SolidBrush(palette[i%palette.Length]))
                    g.FillRectangle(brush,8+i*110,Height-15,6,6);
                using(var legendFont=new Font("Segoe UI",7f))
                using(var brush=new SolidBrush(fg))
                    g.DrawString(Series[i].Name.Length>15?Series[i].Name.Substring(0,15):Series[i].Name,
                        legendFont,brush,17+i*110,Height-19);
            }
        }
    }
}
