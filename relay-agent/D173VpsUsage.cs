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
        private readonly Label[] _d173VpsKpiLabels = new Label[5];
        private readonly Label[] _d173VpsDailyLabels = new Label[4];
        private Dictionary<string, object> _d173VpsSnapshot30d;
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
                Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 5,
                Padding = new Padding(8), Margin = Padding.Empty
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 46f));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 105f));
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

            // KPI cards share actual provider snapshot state; unlike reference mockups,
            // unknown billing charges/quotas are never populated with sample numbers.
            var summaries = new TableLayoutPanel {
                Dock = DockStyle.Fill, ColumnCount = 5, RowCount = 1,
                Padding = Padding.Empty, Margin = Padding.Empty
            };
            for (var i=0;i<5;i++)
            {
                summaries.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,20f));
                _d173VpsKpiLabels[i] = D173NewUsageCard(summaries,i,0, i==0 ?
                    _d173VpsUsageBudget : new Label());
            }
            _d173VpsKpiLabels[0].Text = "Cloudflare gói 5 USD/tháng · phân bổ Báo hàng 50%";
            _d173VpsKpiLabels[1].Text = "Google/Firebase · quota riêng (không chia gói 5 USD)";
            _d173VpsKpiLabels[2].Text = "Chỉ số thực · đang kiểm tra";
            _d173VpsKpiLabels[3].Text = "Dự báo cảnh báo · đang tính";
            _d173VpsKpiLabels[4].Text = "Nguồn dữ liệu · đang chờ";
            root.Controls.Add(summaries,0,1);

            var dailyCards = new TableLayoutPanel {
                Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 1,
                Padding = Padding.Empty, Margin = Padding.Empty
            };
            for (var i=0;i<4;i++)
            {
                dailyCards.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,25f));
                _d173VpsDailyLabels[i] = D173NewUsageCard(dailyCards,i,0,i==0 ?
                    _d173VpsUsageDaily : new Label());
            }
            _d173VpsDailyLabels[0].Text = "Firestore Reads · chờ số liệu";
            _d173VpsDailyLabels[1].Text = "Firestore Writes · chờ số liệu";
            _d173VpsDailyLabels[2].Text = "Firestore Deletes · chờ số liệu";
            _d173VpsDailyLabels[3].Text = "Cloudflare Emails · target 3.000/ngày (chung)";
            root.Controls.Add(dailyCards,0,2);

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
            root.Controls.Add(charts,0,3);

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
            _d173VpsUsageGrid.Columns.Add("cycleTarget","Target kỳ 50%*");
            _d173VpsUsageGrid.Columns.Add("percentage","% ngày");
            _d173VpsUsageGrid.Columns.Add("dayForecast","Dự báo ngày");
            _d173VpsUsageGrid.Columns.Add("monthForecast","Dự báo tháng");
            _d173VpsUsageGrid.Columns.Add("alert","Cảnh báo");
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
            root.Controls.Add(_d173VpsUsageGrid,0,4);

            _d173VpsUsageClock.Interval = 30_000;
            _d173VpsUsageClock.Tick += (s,e) => TryD173VpsUsageBoundary();
            Disposed += (s,e) => { _d173VpsUsageClock.Stop(); _d173VpsUsageClock.Dispose(); };
        }

        private static Label D173NewUsageCard(TableLayoutPanel host,int col,int row,Label label)
        {
            var card=new D173BufferedCardPanel {Dock=DockStyle.Fill,Margin=new Padding(3)};
            label.Dock=DockStyle.Fill;
            label.Padding=new Padding(11,8,8,6);
            label.Font=new Font("Segoe UI",9f,FontStyle.Bold);
            label.AutoEllipsis=true;
            card.Controls.Add(label);
            host.Controls.Add(card,col,row);
            return label;
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
                // Snapshot files are account-usage only; never persist sessions or tokens.
                TryD173RestoreVpsUsageCache();
                TryD173VpsUsageRefresh("24h",true);
            }
            else
            {
                _d173VpsUsageClock.Stop();
                _d173VpsLastBoundary="";
                _d173VpsSnapshot24h=null;
                _d173VpsSnapshot30d=null;
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
                // Prevent provider reload on repeated tab switching inside 5 minutes.
                if(File.Exists(path) &&
                    (DateTime.UtcNow-File.GetLastWriteTimeUtc(path)).TotalMinutes<5)
                    return;
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
                    if(window=="30d")
                        File.Copy(target,Path.Combine(RelayDataDir,
                            "usage-vps-cycle-"+DateTime.UtcNow.ToString("yyyyMMdd",
                            CultureInfo.InvariantCulture)+".json"),true);
                }
                catch(Exception ex){failure=ex is WebException?"PROVIDER_HTTP_OR_TIMEOUT":ex.GetType().Name;}
                finally{Interlocked.Exchange(ref _d173VpsRefreshInFlight,0);}
                Ui(()=>{
                    if(!_d173VpsUsageAuthenticated||generation!=_d173VpsGeneration||IsDisposed)return;
                    if(response!=null)
                    {
                        if(window=="24h")_d173VpsSnapshot24h=response;
                        if(window=="30d")_d173VpsSnapshot30d=response;
                        if(window==_d173VpsSelectedWindow)
                        {
                            _d173VpsSelectedSnapshot=response;
                            RenderD173VpsUsage();
                        }
                        else if(window=="30d" && _d173VpsSelectedSnapshot!=null)
                            RenderD173VpsUsage();
                        // One 30d provider sample per day supports month-to-date estimates.
                        // No extra polling loop or timer is created.
                        if(window=="24h" && D173VpsNeedsCycleRefresh())
                            TryD173VpsUsageRefresh("30d",false);
                    }
                    else _d173VpsUsageState.Text="Dữ liệu nguồn chậm hoặc lỗi "+failure+
                        " · giữ số liệu lần trước · không tác động nghiệp vụ";
                });
            });
        }

        private void TryD173RestoreVpsUsageCache()
        {
            foreach (var window in new[] {"24h","30d"})
            {
                try
                {
                    var path=D173VpsCachePath(window);
                    if(!File.Exists(path))continue;
                    var data=D160UsageJson.Map(
                        new JavaScriptSerializer{MaxJsonLength=12*1024*1024}
                            .DeserializeObject(File.ReadAllText(path)));
                    if(D160UsageJson.String(data,"schema")!="D173_VPS_USAGE_V1")continue;
                    if(window=="24h")
                    {
                        _d173VpsSnapshot24h=data;
                        _d173VpsSelectedSnapshot=data;
                    }
                    else _d173VpsSnapshot30d=data;
                }
                catch(Exception ex){Log("D173 USAGE cache_read_error="+ex.GetType().Name);}
            }
            if(_d173VpsSelectedSnapshot!=null)RenderD173VpsUsage();
        }

        private static bool D173VpsNeedsCycleRefresh()
        {
            try
            {
                var p=D173VpsCachePath("30d");
                return !File.Exists(p) ||
                    (DateTime.UtcNow-File.GetLastWriteTimeUtc(p)).TotalHours>=24;
            }
            catch{return false;}
        }

        private static double? D173VpsDailyForecast(double current)
        {
            var now=DateTime.UtcNow.AddHours(7);
            var start=now.Date.AddHours(6);
            var end=now.Date.AddHours(22);
            if(now>=end)return current;
            var observed=(now-start).TotalHours;
            if(observed<0.5)return null;
            return Math.Max(current,current*(16d/observed));
        }

        private static double? D173VpsArchivedFirstDay(string id,DateTime monthStart)
        {
            // On the 31st the moving 30d provider window omits part of day one.
            // Recover ONLY that complete UTC day from a real snapshot captured
            // on day two; missing archive means forecast unavailable.
            try
            {
                var path=Path.Combine(RelayDataDir,"usage-vps-cycle-"+
                    monthStart.AddDays(1).ToString("yyyyMMdd",CultureInfo.InvariantCulture)+".json");
                if(!File.Exists(path))return null;
                var archive=D160UsageJson.Map(
                    new JavaScriptSerializer{MaxJsonLength=12*1024*1024}
                        .DeserializeObject(File.ReadAllText(path)));
                if(D160UsageJson.String(archive,"schema")!="D173_VPS_USAGE_V1")
                    return null;
                var collected=D173UsageParseUtc(D160UsageJson.String(archive,"collected_at"));
                if(collected.Date!=monthStart.AddDays(1).Date)return null;
                foreach(var item in D160UsageJson.List(D160UsageJson.Value(archive,"items")) ??
                    new object[0])
                {
                    var metric=D160UsageJson.Map(item);
                    if(D160UsageJson.String(metric,"id")!=id ||
                        D160UsageJson.String(metric,"status")!="OK")continue;
                    foreach(var itemPoint in D160UsageJson.List(
                        D160UsageJson.Value(metric,"points")) ?? new object[0])
                    {
                        var p=D160UsageJson.Map(itemPoint);
                        if(D173UsageParseUtc(D160UsageJson.String(p,"at")).Date !=
                            monthStart.Date)continue;
                        double v;
                        if(double.TryParse(D160UsageJson.String(p,"value"),
                            NumberStyles.Any,CultureInfo.InvariantCulture,out v))
                            return v;
                    }
                }
            }
            catch { /* Missing or malformed local archive: never estimate from it. */ }
            return null;
        }

        private double? D173VpsMonthForecast(string id)
        {
            if(_d173VpsSnapshot30d==null)return null;
            var now=DateTime.UtcNow;
            var monthStart=new DateTime(now.Year,now.Month,1,0,0,0,DateTimeKind.Utc);
            var elapsed=(now-monthStart).TotalDays;
            // A 30-day rolling sample cannot give a full calendar-month denominator
            // late in a 31-day month; do not silently omit day one.
            if(elapsed<1.5)return null;
            var dayOne=elapsed>=30d ? D173VpsArchivedFirstDay(id,monthStart) : null;
            if(elapsed>=30d && !dayOne.HasValue)return null;
            var collected=D173UsageParseUtc(D160UsageJson.String(
                _d173VpsSnapshot30d,"collected_at"));
            if(collected==DateTime.MinValue ||
                (now-collected).TotalHours>36)return null;
            var rows=D160UsageJson.List(D160UsageJson.Value(_d173VpsSnapshot30d,"items"));
            if(rows==null)return null;
            foreach(var item in rows)
            {
                var metric=D160UsageJson.Map(item);
                if(D160UsageJson.String(metric,"id")!=id ||
                    D160UsageJson.String(metric,"status")!="OK")continue;
                double total=dayOne??0d;
                var found=dayOne.HasValue;
                foreach(var p in D160UsageJson.List(D160UsageJson.Value(metric,"points")) ??
                    new object[0])
                {
                    var sample=D160UsageJson.Map(p);
                    var stamp=D173UsageParseUtc(D160UsageJson.String(sample,"at"));
                    double v;
                    if(stamp<(dayOne.HasValue?monthStart.AddDays(1):monthStart) ||
                       stamp>now ||
                       !double.TryParse(D160UsageJson.String(sample,"value"),
                         NumberStyles.Any,CultureInfo.InvariantCulture,out v))continue;
                    found=true;
                    total+=v;
                }
                return found?(double?)(total/elapsed*
                    DateTime.DaysInMonth(now.Year,now.Month)):null;
            }
            return null;
        }

        private static string D173VpsSeverity(double percent)
        {
            if(percent>=100)return "VƯỢT TARGET";
            if(percent>=95)return "KHẨN CẤP";
            if(percent>=85)return "CAO";
            if(percent>=70)return "THEO DÕI";
            return "OK";
        }

        private static string D173VpsPercent(double used,double limit)
        {
            return (used/limit*100d).ToString("N1",
                CultureInfo.GetCultureInfo("vi-VN"))+"%";
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
                { "cf_do_sql_storage", 5d } // Included 5 GB-month; not stored bytes.
            };
        // Historical provider-included limits, never a provider-enforced cap for
        // Inventory. For shared account pools, Inventory planning is 50%;
        // account-wide usage is NOT an attributable Inventory numerator.
        private static string D173VpsCycleTarget(string id,string unit)
        {
            double accountIncluded;
            if(!D173IncludedSharedCycleReference.TryGetValue(id,out accountIncluded))
                return "N/A";
            return D173UsageNum(accountIncluded*0.50,unit)+" (50% gói)";
        }

        private static string D173UsageNum(object item,string unit)
        {
            if(item==null)return "N/A";
            double v;
            if(!double.TryParse(Convert.ToString(item,CultureInfo.InvariantCulture),
                 NumberStyles.Any,CultureInfo.InvariantCulture,out v))return "N/A";
            if(unit=="microseconds")return (v/1000d).ToString("N0",CultureInfo.GetCultureInfo("vi-VN"))+" ms";
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
                var alerts=0;
                var observed=0;
                var dailyCardId=new[]{"firestore_reads","firestore_writes",
                    "firestore_deletes","cf_emails_sent"};
                var dailyCardLabel=new[]{"Firestore Reads","Firestore Writes",
                    "Firestore Deletes","Cloudflare Emails"};
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
                    var dayForecast="N/A";
                    var monthForecast="N/A";
                    var alert="Chưa đủ dữ liệu";
                    double? predictedPercent=null;
                    var warned=false;
                    Dictionary<string,object> d;
                    if(status=="OK")observed++;
                    if(daily.TryGetValue(id,out d) &&
                        (id=="firestore_reads" || id=="firestore_writes" ||
                         id=="firestore_deletes" || id=="cf_emails_sent") &&
                        D160UsageJson.String(d,"status")=="OK")
                    {
                        var sum=D173TodaySum(d);
                        if(sum.HasValue)
                        {
                            used=D173UsageNum(sum.Value,unit);
                            var target=id=="firestore_reads"?50000:
                                id=="cf_emails_sent"?3000:20000;
                            limit=D173UsageNum(target,unit);
                            percent=D173VpsPercent(sum.Value,target);
                            var forecast=D173VpsDailyForecast(sum.Value);
                            if(forecast.HasValue)
                            {
                                predictedPercent=forecast.Value*100d/target;
                                dayForecast=D173UsageNum(forecast.Value,unit)+
                                    " ("+D173VpsPercent(forecast.Value,target)+")";
                                alert=D173VpsSeverity(Math.Max(predictedPercent.Value,
                                    sum.Value*100d/target));
                            }
                            else alert=D173VpsSeverity(sum.Value*100d/target);
                            var cardIndex=Array.IndexOf(dailyCardId,id);
                            if(cardIndex>=0)
                                _d173VpsDailyLabels[cardIndex].Text =
                                    dailyCardLabel[cardIndex]+"\nHôm nay: "+used+
                                    " / "+limit+" ("+percent+")\n"+
                                    "Dự báo 06–22h: "+dayForecast+" · "+alert;
                        }
                    }
                    double cycleTarget;
                    if(D173IncludedSharedCycleReference.TryGetValue(id,out cycleTarget)
                        && status=="OK" &&
                        id!="cf_d1_storage" && id!="cf_do_sql_storage")
                    {
                        // Cloudflare account included pools are shared. CF_WORKER rows
                        // may reflect only this Worker: do not call it account-wide spend.
                        var forecast=D173VpsMonthForecast(id);
                        if(forecast.HasValue)
                        {
                            var projectTarget=cycleTarget*0.50d;
                            monthForecast=D173UsageNum(forecast.Value,unit)+
                                " ("+D173VpsPercent(forecast.Value,projectTarget)+
                                " / target 50%)";
                            var monthSeverity=D173VpsSeverity(
                                forecast.Value*100d/projectTarget);
                            if(monthSeverity!="OK")
                            {
                                alert=monthSeverity+" · dự báo tháng";
                                if(forecast.Value*100d/projectTarget>=70)warned=true;
                            }
                        }
                        else if(alert=="Chưa đủ dữ liệu")
                            alert="N/A · chưa đủ chu kỳ";
                    }
                    if(predictedPercent.HasValue && predictedPercent.Value>=70)
                        warned=true;
                    if(warned)alerts++;
                    var rowIndex=_d173VpsUsageGrid.Rows.Add(label,source,value,used,limit,
                        D173VpsCycleTarget(id,unit),percent,dayForecast,monthForecast,
                        alert,updated.Length>=16?updated.Substring(0,16):updated,status);
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
                    if(alert.StartsWith("CAO")||alert.StartsWith("KHẨN")||
                        alert.StartsWith("VƯỢT"))
                        _d173VpsUsageGrid.Rows[rowIndex].Cells["alert"].Style.ForeColor=
                            Color.FromArgb(211,55,55);
                    plotData[id]=metric;
                }
                _d173VpsKpiLabels[0].Text="CLOUDFLARE · GÓI 5 USD/THÁNG\n"+
                    "Báo hàng: 50% định mức chung\n"+
                    "≈ 2,50 USD phí nền phân bổ · không phải mức phí thực";
                _d173VpsKpiLabels[1].Text="GOOGLE / FIREBASE\n"+
                    "Quota theo từng dịch vụ, không chia phí Cloudflare\n"+
                    "Chi phí Google: N/A khi chưa có billing nguồn";
                _d173VpsKpiLabels[2].Text="CHỈ SỐ CÓ DỮ LIỆU\n"+
                    observed.ToString(CultureInfo.InvariantCulture)+" / "+
                    (rows==null?0:rows.Count()).ToString(CultureInfo.InvariantCulture)+
                    " nguồn trạng thái OK";
                _d173VpsKpiLabels[3].Text="CẢNH BÁO DỰ BÁO\n"+
                    alerts.ToString(CultureInfo.InvariantCulture)+
                    " chỉ số tiệm cận/vượt 70%\nNgưỡng: 70 / 85 / 95 / 100% target";
                _d173VpsKpiLabels[4].Text="NGUỒN DỮ LIỆU THỰC\n"+
                    D160UsageJson.String(_d173VpsSelectedSnapshot,"collected_at")+
                    "\nCập nhật 5 phút · nguồn có thể trễ";
                foreach(var plot in _d173VpsPlots.Values)
                {
                    plot.Series.Clear();
                    foreach(var id in plot.MetricIds)
                    {
                        Dictionary<string,object> metric;
                        if(!plotData.TryGetValue(id,out metric))continue;
                        if(D160UsageJson.String(metric,"status")!="OK")continue;
                        var pts=new List<double>();
                        var stamps=new List<string>();
                        foreach(var row in D160UsageJson.List(D160UsageJson.Value(metric,"points"))??new object[0])
                        {
                            var point=D160UsageJson.Map(row);
                            double v;
                            if(double.TryParse(D160UsageJson.String(point,"value"),
                                NumberStyles.Any,CultureInfo.InvariantCulture,out v))
                            {
                                pts.Add(v);
                                stamps.Add(D160UsageJson.String(point,"at"));
                            }
                        }
                        if(pts.Count>0)plot.Series.Add(new D173UsageSeries{
                            Name=D160UsageJson.String(metric,"label"),
                            Values=pts.ToArray(),
                            Unit=D160UsageJson.String(metric,"unit"),
                            FirstTime=stamps[0],
                            LastTime=stamps[stamps.Count-1]
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
        internal string FirstTime;
        internal string LastTime;
        internal string Unit;
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
        private static string AxisStamp(string raw)
        {
            if(string.IsNullOrWhiteSpace(raw))return "--";
            return raw.Length>=16 ? raw.Substring(11,5) :
                raw.Length>=10 ? raw.Substring(5,5) : raw;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g=e.Graphics;
            var dark=Parent!=null&&Parent.BackColor.GetBrightness()<0.5f;
            var fg=dark?Color.FromArgb(228,236,247):Color.FromArgb(37,56,80);
            var muted=dark?Color.FromArgb(155,173,194):Color.FromArgb(90,108,130);
            var axis=dark?Color.FromArgb(52,68,90):Color.FromArgb(220,229,238);
            var area=new Rectangle(47,39,Math.Max(20,Width-61),
                Math.Max(12,Height-94));
            using(var titleFont=new Font("Segoe UI Semibold",9f,FontStyle.Bold))
            using(var brush=new SolidBrush(fg))
                g.DrawString(Title??"",titleFont,brush,new PointF(10,6));
            if(Series.Count==0)
            {
                using(var brush=new SolidBrush(muted))
                    g.DrawString("N/A · Chưa có dữ liệu nguồn xác thực",
                        Font,brush,new PointF(11,44));
                return;
            }
            using(var legendFont=new Font("Segoe UI",7f))
            using(var brush=new SolidBrush(muted))
            {
                // Mixed-unit metrics are normalized individually; never put
                // unrelated counts, microseconds and rows on one fake numeric axis.
                g.DrawString("100%",legendFont,brush,3,area.Top-4);
                g.DrawString("50%",legendFont,brush,9,area.Top+area.Height/2f-4);
                g.DrawString("0%",legendFont,brush,12,area.Bottom-8);
                g.DrawString("Thang tương đối / từng chỉ số",legendFont,brush,
                    Math.Max(47,Width-214),Height-32);
                var first=Series.FirstOrDefault(z=>!string.IsNullOrWhiteSpace(z.FirstTime));
                if(first!=null)
                {
                    g.DrawString(AxisStamp(first.FirstTime),legendFont,brush,
                        area.Left,area.Bottom+3);
                    var right=AxisStamp(first.LastTime);
                    g.DrawString(right,legendFont,brush,
                        area.Right-Math.Max(30,right.Length*5),area.Bottom+3);
                }
            }
            for(int i=0;i<3;i++)
            {
                var y=area.Top+i*area.Height/2f;
                using(var pen=new Pen(axis,1f))
                    g.DrawLine(pen,area.Left,y,area.Right,y);
            }
            Color[] palette={Color.FromArgb(0,142,136),Color.FromArgb(76,132,230),
                             Color.FromArgb(227,141,50)};
            for(int i=0;i<Series.Count;i++)
            {
                var series=Series[i];
                var vals=series.Values;
                if(vals==null||vals.Length==0)continue;
                var max=Math.Max(vals.Max(),0.0001);
                using(var pen=new Pen(palette[i%palette.Length],1.8f))
                {
                    var points=new PointF[vals.Length];
                    for(int p=0;p<vals.Length;p++)
                        points[p]=new PointF(area.Left+(float)p/Math.Max(1,vals.Length-1)*area.Width,
                            area.Bottom-(float)(vals[p]/max)*area.Height);
                    if(points.Length>1)g.DrawLines(pen,points);
                    else g.DrawEllipse(pen,points[0].X-2,points[0].Y-2,4,4);
                }
                using(var marker=new SolidBrush(palette[i%palette.Length]))
                    g.FillRectangle(marker,8+i*145,Height-17,6,6);
                var last=vals[vals.Length-1].ToString("N0",CultureInfo.GetCultureInfo("vi-VN"));
                var name=series.Name??"";
                if(name.Length>13)name=name.Substring(0,13);
                using(var font=new Font("Segoe UI",7f))
                using(var brush=new SolidBrush(fg))
                    g.DrawString(name+": "+last,font,brush,17+i*145,Height-22);
            }
        }
    }
}
