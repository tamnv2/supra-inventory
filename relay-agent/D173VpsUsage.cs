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

        // D173-E069: Owner-approved HTML design is the fixed visual/layout contract.
        // All native controls are constructed in D173E069ApprovedUsageUi.cs.
        private void InitializeD173VpsUsage()
        {
            InitializeD173E079UsageUi();
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
            if(unit=="bytes")return v>=1073741824?(v/1073741824).ToString("N0",CultureInfo.GetCultureInfo("vi-VN"))+" GB":
                v>=1048576?(v/1048576).ToString("N0",CultureInfo.GetCultureInfo("vi-VN"))+" MB":
                v.ToString("N0",CultureInfo.GetCultureInfo("vi-VN"))+" B";
            return v.ToString("N0",CultureInfo.GetCultureInfo("vi-VN"));
        }
        private static DateTime D173UsageParseUtc(string raw)
        {
            DateTime d;
            return DateTime.TryParse(raw,CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|
                DateTimeStyles.AdjustToUniversal,out d)?d:DateTime.MinValue;
        }

        // Server-provided poll interval is an API schedule, not a promise of a new provider sample.
        private static int D173ConfiguredSyncMinutes(string id,Dictionary<string,object> metric)
        {
            int minutes;
            var raw=D160UsageJson.String(metric,"sync_minutes");
            if(int.TryParse(raw,NumberStyles.Integer,CultureInfo.InvariantCulture,out minutes)
                && minutes>=5 && minutes<=1440)return minutes;
            if(id=="cf_do_sql_storage")return 1440;
            if(id=="firestore_reads"||id=="firestore_writes"||id=="firestore_deletes"||
               id=="cf_do_requests"||id=="cf_do_duration"||id=="cf_do_rows_read"||
               id=="cf_do_rows_written"||id=="cf_worker_requests"||id=="cf_worker_cpu")return 5;
            if(id=="cf_d1_rows_read"||id=="rtdb_https_requests"||id=="rtdb_api_hits")return 15;
            if(id=="drive_requests"||id=="sheets_requests"||id=="fcm_requests"||
               id=="auth_identity_requests"||id=="auth_secure_requests"||
               id=="cf_emails_sent"||id.StartsWith("cloud_run_",StringComparison.Ordinal))
                return 30;
            return 60;
        }
        private static bool D173UsageIsGauge(string id)
        {
            return new[]{"firestore_connections","firestore_listeners","firestore_storage",
                "cloud_run_instances","rtdb_connections","rtdb_monthly_sent",
                "rtdb_monthly_sent_limit","rtdb_storage_bytes","cf_d1_storage"}
                .Contains(id);
        }
        private double? D173TodaySum(Dictionary<string,object> metric)
        {
            var pts=D160UsageJson.List(D160UsageJson.Value(metric,"points"));
            if(pts==null)return null;
            var today=DateTime.UtcNow.AddHours(7).Date;
            double sum=0;
            bool found=false;
            var gauge=D173UsageIsGauge(D160UsageJson.String(metric,"id"));
            var last=DateTime.MinValue;
            foreach(var p in pts)
            {
                var row=D160UsageJson.Map(p);
                var at=D173UsageParseUtc(D160UsageJson.String(row,"at"));
                if(at==DateTime.MinValue||at.AddHours(7).Date!=today)continue;
                double value;
                if(double.TryParse(D160UsageJson.String(row,"value"),NumberStyles.Any,
                    CultureInfo.InvariantCulture,out value))
                {
                    if(gauge){if(at>last){last=at;sum=value;found=true;}}
                    else {sum+=value;found=true;}
                }
            }
            return found?(double?)sum:null;
        }

        // A prediction is shown only when actual 5-minute bucket coverage is
        // adequate. 00–06h (03:00 close and 05:00 SKU) is counted as baseload;
        // it is never multiplied by active-shift 06–22h hours.
        private double? D173ApprovedShiftForecast(Dictionary<string,object> metric)
        {
            if(metric==null || D160UsageJson.String(metric,"status")!="OK"||
                D173UsageIsGauge(D160UsageJson.String(metric,"id")))return null;
            var local=DateTime.UtcNow.AddHours(7);
            var start=local.Date.AddHours(6);
            var end=local.Date.AddHours(22);
            if(local<start)return null;
            var points=D160UsageJson.List(D160UsageJson.Value(metric,"points"));
            if(points==null)return null;
            var observed=new List<DateTime>();
            double midnight=0, shift=0;
            foreach(var item in points)
            {
                var p=D160UsageJson.Map(item);
                var stamp=D173UsageParseUtc(D160UsageJson.String(p,"at"));
                if(stamp==DateTime.MinValue)continue;
                var t=stamp.AddHours(7);
                double val;
                if(!double.TryParse(D160UsageJson.String(p,"value"),
                    NumberStyles.Any,CultureInfo.InvariantCulture,out val) || val<0)
                    return null;
                if(t.Date!=local.Date || t>local)continue;
                if(t<start)midnight+=val;
                else if(t<=end){shift+=val;observed.Add(t);}
            }
            if(local>=end)return midnight+shift;
            if(observed.Count<12 || (local-start).TotalHours<1)return null;
            observed.Sort();
            if((observed[observed.Count-1]-observed[0]).TotalMinutes<40)return null;
            // Missing source buckets must not silently be treated as 0.
            for(var i=1;i<observed.Count;i++)
                if((observed[i]-observed[i-1]).TotalMinutes>90)return null;
            if((local-observed[observed.Count-1]).TotalMinutes>90)return null;
            return midnight+shift+
                Math.Max(0d,shift/(local-start).TotalHours*(end-local).TotalHours);
        }

        private void RenderD173VpsUsage()
        {
            if(_d173VpsSelectedSnapshot==null ||
                _d173ApprovedRoot==null || _d173ApprovedRoot.IsDisposed)return;
            var rows=D160UsageJson.List(D160UsageJson.Value(_d173VpsSelectedSnapshot,"items"));
            var live=D160UsageJson.List(D160UsageJson.Value(_d173VpsSnapshot24h,"items"));
            var latest=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
            foreach(var entry in live??new object[0])
            {
                var data=D160UsageJson.Map(entry);
                var id=D160UsageJson.String(data,"id");
                if(id.Length>0)latest[id]=data;
            }
            var known=0;
            var attention=0;
            var accounted=new[]{"firestore_reads","firestore_writes","firestore_deletes"};
            var limits=new[]{50000d,20000d,20000d};
            var rates=new string[3];
            var sums=new string[3];
            var forecasts=new string[3];
            for(var i=0;i<3;i++)
            {
                sums[i]="N/A";rates[i]="N/A";forecasts[i]="N/A";
                Dictionary<string,object> metric;
                if(!latest.TryGetValue(accounted[i],out metric) ||
                    D160UsageJson.String(metric,"status")!="OK")continue;
                var actual=D173TodaySum(metric);
                if(!actual.HasValue)continue;
                known++;
                sums[i]=D173UsageNum(actual.Value,"operations");
                rates[i]=D173VpsPercent(actual.Value,limits[i]);
                var projected=D173ApprovedShiftForecast(metric);
                if(projected.HasValue)
                    forecasts[i]=D173UsageNum(projected.Value,"operations")+
                        " ("+D173VpsPercent(projected.Value,limits[i])+")";
                if(Math.Max(actual.Value,projected??actual.Value)*100d/limits[i]>=70)
                    attention++;
            }
            // Cloudflare allowance is account-wide, *not* an attributable
            // Inventory numerator. The half-quota is an internal planning mark.
            var cfIds=new[]{"cf_worker_requests","cf_do_requests",
                "cf_do_rows_read","cf_worker_cpu"};
            var cfNames=new[]{"Workers Requests","DO Compute Requests",
                "DO SQL Rows Read","Workers CPU"};
            var cfKnown=0;var cfDailyAlerts=0;var cfForecastAlerts=0;
            for(var i=0;i<cfIds.Length;i++)
            {
                double included;
                if(!D173IncludedSharedCycleReference.TryGetValue(
                    cfIds[i],out included) || included<=0)continue;
                var unit=cfIds[i]=="cf_worker_cpu"?"microseconds":"operations";
                var dayTarget=included*0.5d/30d;
                Dictionary<string,object> metric;
                if(!latest.TryGetValue(cfIds[i],out metric) ||
                    D160UsageJson.String(metric,"status")!="OK")
                {
                    _d173ApprovedQuotaInfo[i].Text=
                        "Hôm nay: N/A · Dự báo: N/A\nKỳ billing: N/A · Thiếu nguồn";
                    continue;
                }
                var actual=D173TodaySum(metric);
                if(!actual.HasValue)
                {
                    _d173ApprovedQuotaInfo[i].Text=
                        "Hôm nay: N/A · Dự báo: N/A\nKỳ billing: N/A · Thiếu mẫu ngày";
                    continue;
                }
                cfKnown++;
                var predicted=D173ApprovedShiftForecast(metric);
                var actualPct=actual.Value*100d/dayTarget;
                var forecastPct=predicted.HasValue?predicted.Value*100d/dayTarget:(double?)null;
                if(actualPct>=70)cfDailyAlerts++;
                if(forecastPct>=70)cfForecastAlerts++;
                _d173ApprovedQuotaInfo[i].Text=
                    "Ngày: "+D173UsageNum(actual.Value,unit)+
                    " / "+D173UsageNum(dayTarget,unit)+
                    " ("+D173VpsPercent(actual.Value,dayTarget)+")"+
                    "\nDự báo ngày: "+(predicted.HasValue?
                        D173UsageNum(predicted.Value,unit)+" ("+
                            D173VpsPercent(predicted.Value,dayTarget)+")":"N/A")+
                    "\nChu kỳ billing: N/A · "+D173VpsSeverity(
                        Math.Max(actualPct,forecastPct??actualPct));
            }
            _d173VpsKpiLabels[0].Text="5 USD / tháng";
            _d173VpsKpiLabels[1].Text=cfKnown==0?"N/A":
                cfDailyAlerts+"/"+cfKnown+" ≥ 70%";
            Dictionary<string,object> billing;
            var billingLabel="Chưa xác thực kỳ";
            if(latest.TryGetValue("cf_do_sql_storage",out billing))
            {
                var begin=D160UsageJson.String(billing,"cycle_start");
                var finish=D160UsageJson.String(billing,"cycle_end");
                if(begin.Length>=10 && finish.Length>=10)
                {
                    DateTime first,last;
                    if(DateTime.TryParse(begin,CultureInfo.InvariantCulture,
                            DateTimeStyles.AssumeUniversal,out first) &&
                       DateTime.TryParse(finish,CultureInfo.InvariantCulture,
                            DateTimeStyles.AssumeUniversal,out last) && last>first)
                        billingLabel=first.ToString("dd/MM",CultureInfo.InvariantCulture)+
                            "–"+last.ToString("dd/MM",CultureInfo.InvariantCulture);
                }
            }
            _d173VpsKpiLabels[2].Text=billingLabel;
            _d173VpsKpiLabels[3].Text=known==0?"N/A":
                attention+"/"+known+" ≥ 70%";
            _d173VpsKpiLabels[4].Text=cfKnown+"/"+cfIds.Length+
                " Cloudflare";
            if(_d173ApprovedPlots[1]!=null)
            {
                for(var i=0;i<3;i++)
                {
                    double v;
                    var valid=double.TryParse(rates[i].TrimEnd('%').Replace(',','.'),
                        NumberStyles.Any,CultureInfo.InvariantCulture,out v);
                    _d173ApprovedPlots[1].Percents[i]=valid?(double?)v:null;
                }
                _d173ApprovedPlots[1].Invalidate();
            }
            if(_d173ApprovedPlots[3]!=null)_d173ApprovedPlots[3].Invalidate();
            _d173ApprovedAnalysis[1].Text="Reads: "+sums[0]+" · "+rates[0]+
                "\nWrites: "+sums[1]+" · "+rates[1]+
                "\nDeletes: "+sums[2]+" · "+rates[2];
            var apiCodes=new[]{"cloud_run_requests","rtdb_https_requests",
                "drive_requests","sheets_requests"};
            var apiLabels=new[]{"Cloud Run","RTDB HTTPS","Drive API","Sheets API"};
            var apiText=new List<string>();
            for(var i=0;i<apiCodes.Length;i++)
            {
                Dictionary<string,object> metric;
                apiText.Add(apiLabels[i]+": "+
                    (latest.TryGetValue(apiCodes[i],out metric) &&
                     D160UsageJson.String(metric,"status")=="OK" ?
                     D173UsageNum(D160UsageJson.Value(metric,"total"),
                         D160UsageJson.String(metric,"unit")):"N/A"));
            }
            _d173ApprovedAnalysis[2].Text=string.Join("\n",apiText)+
                "\n\nKhông quy totals thành usage hôm nay";
            _d173ApprovedAnalysis[3].Text=
                "00:00–06:00 · 06:00–14:00 · 14:00–22:00\n"+
                "Dự báo hiển thị khi đủ mẫu theo giờ.";
            _d173ApprovedForecast[0].Text=cfKnown==0?
                "N/A · thiếu nguồn":cfDailyAlerts+" cảnh báo thực tế · "+
                    cfForecastAlerts+" cảnh báo dự báo";
            _d173ApprovedForecast[1].Text=
                "N/A · chưa có kỳ billing xác thực";
            _d173ApprovedForecast[2].Text=known==0?"N/A · thiếu nguồn":
                attention+"/"+known+" ≥ 70%";
            _d173ApprovedSource.Text="Cập nhật: "+
                D160UsageJson.String(_d173VpsSelectedSnapshot,"collected_at")+
                " · Cloudflare: tài khoản chung · Firestore: hạn mức ngày";
            // Do not reset scroll when a source snapshot replaces table rows.
            var priorFirstRow=-1;
            var priorHorizontal=_d173VpsUsageGrid.HorizontalScrollingOffset;
            var priorOuter=_d173ApprovedViewport==null?0:
                -_d173ApprovedViewport.AutoScrollPosition.Y;
            try{priorFirstRow=_d173VpsUsageGrid.FirstDisplayedScrollingRowIndex;}
            catch(InvalidOperationException){}
            _d173VpsUsageGrid.SuspendLayout();
            try
            {
                _d173VpsUsageGrid.Rows.Clear();
                foreach(var obj in rows??new object[0])
                {
                    var metric=D160UsageJson.Map(obj);
                    var id=D160UsageJson.String(metric,"id");
                    var label=D160UsageJson.String(metric,"label");
                    var provider=D160UsageJson.String(metric,"provider");
                    var scope=D160UsageJson.String(metric,"scope");
                    var status=D160UsageJson.String(metric,"status");
                    if(_d173ApprovedStatusValue=="Có số liệu" && status!="OK")
                        continue;
                    if(_d173ApprovedStatusValue=="Chưa đủ nguồn" && status=="OK")
                        continue;
                    if(_d173ApprovedSearchText.Length>0 && label.IndexOf(
                        _d173ApprovedSearchText,StringComparison.CurrentCultureIgnoreCase)<0)
                        continue;
                    if(_d173ApprovedFilterValue!="Tất cả nguồn" &&
                        !(provider.IndexOf(_d173ApprovedFilterValue,
                            StringComparison.OrdinalIgnoreCase)>=0 ||
                          scope.IndexOf(_d173ApprovedFilterValue,
                            StringComparison.OrdinalIgnoreCase)>=0 ||
                          (_d173ApprovedFilterValue=="Firestore" &&
                            id.StartsWith("firestore_",StringComparison.Ordinal))))
                        continue;
                    var unit=D160UsageJson.String(metric,"unit");
                    var today="N/A";var target="N/A";var percent="N/A";
                    var prediction="N/A";var risk="N/A · chưa đủ nguồn";
                    Dictionary<string,object> d;
                    if(latest.TryGetValue(id,out d) &&
                        D160UsageJson.String(d,"status")=="OK")
                    {
                        var used=D173TodaySum(d);
                        if(used.HasValue)
                        {
                            today=D173UsageNum(used.Value,unit);
                            double limit=0;
                            if(id=="firestore_reads")limit=50000;
                            else if(id=="firestore_writes"||id=="firestore_deletes")limit=20000;
                            else if(id=="cf_emails_sent")limit=3000;
                            else if(id.StartsWith("cf_",StringComparison.Ordinal))
                            {
                                double included;
                                if(D173IncludedSharedCycleReference.TryGetValue(
                                    id,out included))limit=id=="cf_d1_storage"?included*0.5d:included*0.5d/30d;
                            }
                            if(limit>0)
                            {
                                target=D173UsageNum(limit,unit);
                                percent=D173VpsPercent(used.Value,limit);
                                var projected=D173ApprovedShiftForecast(d);
                                if(projected.HasValue)
                                {
                                    prediction=D173UsageNum(projected.Value,unit)+
                                        " ("+D173VpsPercent(projected.Value,limit)+")";
                                    risk=D173VpsSeverity(Math.Max(projected.Value,
                                        used.Value)*100d/limit);
                                }
                                else risk=D173VpsSeverity(used.Value*100d/limit)+
                                    " · dự báo N/A";
                            }
                        }
                    }
                    double sharedTarget;
                    var cycle=D173IncludedSharedCycleReference.TryGetValue(id,out sharedTarget)
                        ? D173UsageNum(sharedTarget*0.50,unit)+" (quy hoạch)":"N/A";
                    if(cycle!="N/A" && scope=="CF_ACCOUNT_SHARED")
                        risk += " · TK chung";
                    var v=D173UsageNum(D160UsageJson.Value(metric,"total"),unit);
                    var time=D160UsageJson.String(metric,"latest_at");
                    var displayScope=scope=="CF_ACCOUNT_SHARED" ?
                        "Cloudflare · TK chung":scope;
                    var displayForecast=prediction=="N/A"?"N/A":
                        prediction+(risk.StartsWith("OK")?"":" · "+risk);
                    var cadence=D173ConfiguredSyncMinutes(id,metric);
                    var shownLabel=label+" · Sync "+cadence.ToString(CultureInfo.InvariantCulture)+" phút/lần";
                    var successAt=D160UsageJson.String(metric,"last_success_at");
                    var sourceAge=D160UsageJson.String(metric,"latest_at");
                    var lastSource=string.IsNullOrEmpty(sourceAge)?"Chưa có mẫu":sourceAge;
                    var rowIndex=_d173VpsUsageGrid.Rows.Add(shownLabel,displayScope,
                        provider,v,today,target,percent,displayForecast,status);
                    _d173VpsUsageGrid.Rows[rowIndex].Cells[0].ToolTipText=
                        "Đọc nguồn mỗi "+cadence+" phút · Lần đọc thành công: "+
                        (string.IsNullOrWhiteSpace(successAt)?"Chưa có":successAt)+
                        " · Mẫu mới nhất: "+lastSource;
                    if(status!="OK" && status!="BILLING_PERIOD")
                        _d173VpsUsageGrid.Rows[rowIndex].DefaultCellStyle.ForeColor=
                            Color.FromArgb(165,117,60);
                }
                _d173VpsUsageState.Text="Đồng bộ: "+
                    D160UsageJson.String(_d173VpsSelectedSnapshot,"collected_at")+
                    " · "+(rows==null?0:rows.Count()).ToString(CultureInfo.InvariantCulture)+
                    " chỉ số · nguồn có thể trễ";
                E079RefreshMeters(latest);
                E079GrowGrid();
                ApplyD173ApprovedUsageTheme(D173IsDarkThemeActive());
            }
            finally
            {
                _d173VpsUsageGrid.ResumeLayout();
                if(priorFirstRow>=0 && _d173VpsUsageGrid.RowCount>0)
                {
                    try{
                        _d173VpsUsageGrid.FirstDisplayedScrollingRowIndex=
                            Math.Min(priorFirstRow,_d173VpsUsageGrid.RowCount-1);
                    }
                    catch(InvalidOperationException){}
                }
                try{_d173VpsUsageGrid.HorizontalScrollingOffset=priorHorizontal;}
                catch(ArgumentOutOfRangeException){}
                if(_d173ApprovedViewport!=null &&
                   !_d173ApprovedViewport.IsDisposed)
                    _d173ApprovedViewport.AutoScrollPosition=new Point(0,priorOuter);
            }
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
            DateTime stamp;
            if(!DateTime.TryParse(raw,CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,
                out stamp))return raw.Length>=5 ? raw.Substring(0,5) : raw;
            // Provider buckets are UTC. Only display labels are shifted to
            // Vietnam time; data points and billing cycles retain source time.
            if(raw.Length==10)
                return stamp.ToString("dd/MM",CultureInfo.InvariantCulture);
            return stamp.AddHours(7).ToString("HH:mm",CultureInfo.InvariantCulture);
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
