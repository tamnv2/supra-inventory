using System.Linq;
using System;
using System.Diagnostics;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace SupraInventoryRelayAgent
{
    // Network transport helper only: never stores credentials, creates profiles,
    // bridges corporate networks, changes Windows proxy or touches WMS mutations.
    // A saved profile must first be explicitly chosen on the local Agent PC.
    internal static class D168NetworkRoute
    {
        private const string LocalKey=@"Software\SupraInventory\RelayAgent";
        private const string WorkerProfileValue="ApprovedWorkerWifiProfile";
        private const string WorkerProfilesValue="ApprovedWorkerWifiProfiles";
        private const string OfficeProfilesValue="KnownOfficeWifiProfiles";
        private static readonly Regex SafeProfile=new Regex(
            @"^[\p{L}\p{N} ._+@()#-]{1,64}$",RegexOptions.Compiled);

        // All network choices are local Windows-saved profiles. No scanning or
        // credential collection is done by the Agent; no profile is created.
        internal static string[] SavedProfiles()
        {
            try
            {
                using(var process=new Process {
                    StartInfo=new ProcessStartInfo {
                        FileName="netsh.exe",Arguments="wlan show profiles",
                        UseShellExecute=false,CreateNoWindow=true,
                        RedirectStandardOutput=true,WindowStyle=ProcessWindowStyle.Hidden
                    }
                })
                {
                    if(!process.Start())return new string[0];
                    var stdout=process.StandardOutput.ReadToEndAsync();
                    if(!process.WaitForExit(6000))
                    {
                        try { process.Kill(); } catch { }
                        return new string[0];
                    }
                    if(process.ExitCode!=0 || !stdout.Wait(2000))
                        return new string[0];
                    var found=new System.Collections.Generic.List<string>();
                    foreach(var line in stdout.Result.Split(new[]{'\r','\n'},
                        StringSplitOptions.RemoveEmptyEntries))
                    {
                        // English and Vietnamese Windows netsh profile labels.
                        // Do not parse "User profiles" headings or network names.
                        var match=Regex.Match(line,
                            @"(?i)^\s*(?:All User Profile|Current User Profile|Hồ sơ tất cả người dùng|Hồ sơ người dùng hiện tại)\s*:\s*(.+?)\s*$");
                        if(!match.Success)continue;
                        var name=match.Groups[1].Value.Trim();
                        if(ValidProfile(name) &&
                           !found.Contains(name,StringComparer.OrdinalIgnoreCase))
                            found.Add(name);
                    }
                    return found.ToArray();
                }
            }
            catch { return new string[0]; }
        }

        internal static string[] ApprovedProfiles()
        {
            try
            {
                using(var key=Registry.CurrentUser.OpenSubKey(LocalKey,false))
                {
                    if(key==null)return new string[0];
                    var profiles=key.GetValue(WorkerProfilesValue) as string[];
                    if(profiles!=null)
                        return profiles.Where(ValidProfile)
                            .Distinct(StringComparer.OrdinalIgnoreCase).Take(6).ToArray();
                    // Keep an already-approved single-profile setting after update.
                    var legacy=Convert.ToString(key.GetValue(WorkerProfileValue,""))??"";
                    return ValidProfile(legacy)?new[]{legacy}:new string[0];
                }
            }
            catch { return new string[0]; }
        }

        // User-approved local classification; never log SSID or credentials.
        internal static string[] OfficeProfiles()
        {
            try
            {
                using(var key=Registry.CurrentUser.OpenSubKey(LocalKey,false))
                {
                    var profiles=key==null ? null : key.GetValue(OfficeProfilesValue) as string[];
                    return (profiles??new string[0]).Where(ValidProfile)
                        .Distinct(StringComparer.OrdinalIgnoreCase).Take(6).ToArray();
                }
            }
            catch { return new string[0]; }
        }

        internal static bool SaveOfficeProfiles(
            System.Collections.Generic.IEnumerable<string> selected)
        {
            var values=(selected??new string[0]).Select(x=>(x??"").Trim()).ToArray();
            if(values.Length>6 || values.Any(x=>!ValidProfile(x)) ||
                values.Distinct(StringComparer.OrdinalIgnoreCase).Count()!=values.Length ||
                values.Any(x=>!HasSavedProfile(x)) ||
                values.Any(x=>ApprovedProfiles().Contains(x,StringComparer.OrdinalIgnoreCase)))
                return false;
            try
            {
                using(var key=Registry.CurrentUser.CreateSubKey(LocalKey,true))
                {
                    if(key==null)return false;
                    key.SetValue(OfficeProfilesValue,values,RegistryValueKind.MultiString);
                }
                return true;
            }
            catch { return false; }
        }

        // Unknown includes VPS Ethernet/multi-NIC/unclassified SSID.
        // Never assume RTDB is reachable when there is no explicit evidence.
        // Classification is a hint for optional RTDB only, never PRIMARY authority.
        // netsh can block for up to eight seconds; avoid spawning it in each HA cycle.
        // A network event invalidates immediately; five seconds is the maximum stale hint.
        private static readonly object NetworkModeCacheGate = new object();
        private static string _cachedNetworkMode = "UNKNOWN";
        private static long _networkModeCacheUntilMs;
        private static int _networkModeEpoch;

        internal static void NotifyNetworkChange()
        {
            Interlocked.Increment(ref _networkModeEpoch);
            lock (NetworkModeCacheGate) _networkModeCacheUntilMs = 0;
        }

        internal static string CurrentNetworkMode()
        {
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var epoch = Volatile.Read(ref _networkModeEpoch);
            lock (NetworkModeCacheGate)
            {
                if (nowMs < _networkModeCacheUntilMs)
                    return _cachedNetworkMode;
            }

            var profile = CurrentProfile();
            var mode = "UNKNOWN";
            if (ValidProfile(profile))
            {
                if (OfficeProfiles().Contains(profile, StringComparer.OrdinalIgnoreCase))
                    mode = "OFFICE";
                else if (ApprovedProfiles().Contains(profile, StringComparer.OrdinalIgnoreCase))
                    mode = "INTERNET";
            }

            lock (NetworkModeCacheGate)
            {
                if (epoch == _networkModeEpoch)
                {
                    _cachedNetworkMode = mode;
                    _networkModeCacheUntilMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 5000;
                }
                else
                {
                    // Never cache a classification collected across a network transition.
                    _cachedNetworkMode = "UNKNOWN";
                    _networkModeCacheUntilMs = 0;
                }
                return _cachedNetworkMode;
            }
        }

        internal static string ApprovedProfile()
        {
            return ApprovedProfiles().FirstOrDefault()??"";
        }

        internal static bool SaveApprovedProfiles(
            System.Collections.Generic.IEnumerable<string> selected)
        {
            var values=(selected??new string[0])
                .Select(x=>(x??"").Trim()).ToArray();
            if(values.Length>6 || values.Any(x=>!ValidProfile(x)) ||
               values.Distinct(StringComparer.OrdinalIgnoreCase).Count()!=values.Length)
                return false;
            // A saved profile may be absent from the current radio scan: only
            // Windows-local saved-profile validation is required.
            if(values.Any(x=>!HasSavedProfile(x)) ||
               values.Any(x=>OfficeProfiles().Contains(x,StringComparer.OrdinalIgnoreCase)))return false;
            try
            {
                using(var key=Registry.CurrentUser.CreateSubKey(LocalKey,true))
                {
                    if(key==null)return false;
                    key.SetValue(WorkerProfilesValue,values,RegistryValueKind.MultiString);
                    key.DeleteValue(WorkerProfileValue,false);
                }
                return true;
            }
            catch { return false; }
        }

        internal static bool SaveApprovedProfile(string name)
        {
            return SaveApprovedProfiles(new[]{name});
        }

        internal static bool ValidProfile(string name)
        {
            return !string.IsNullOrWhiteSpace(name) && SafeProfile.IsMatch(name);
        }

        internal static bool HasSavedProfile(string name)
        {
            return ValidProfile(name) && RunWlan("wlan show profile name=\""+name+"\"",5000);
        }

        internal static bool ConnectSavedProfile(string name)
        {
            return HasSavedProfile(name) &&
                RunWlan("wlan connect name=\""+name+"\"",10000);
        }

        private static bool RunWlan(string arguments,int timeoutMs)
        {
            try
            {
                var process=new Process {
                    StartInfo=new ProcessStartInfo {
                        FileName="netsh.exe",Arguments=arguments,
                        UseShellExecute=false,CreateNoWindow=true,
                        WindowStyle=ProcessWindowStyle.Hidden
                    }
                };
                using(process)
                {
                    if(!process.Start()) return false;
                    if(!process.WaitForExit(timeoutMs))
                    {
                        try { process.Kill(); } catch { }
                        return false;
                    }
                    return process.ExitCode==0;
                }
            }
            catch { return false; }
        }

        // Single-shot authorized probe; no /health migration, no SKU/DO state writes.
        internal static string ProbeWorker(string idToken)
        {
            if(string.IsNullOrWhiteSpace(idToken))return "AUTH_REQUIRED";
            try
            {
                var target=new Uri(AgentConfig.ApiBaseUrl.TrimEnd('/')+
                    "/api/agent/d168/network-capability");
                if(target.Scheme!=Uri.UriSchemeHttps ||
                    !string.Equals(target.Host,"inventory.supra.cc.cd",
                        StringComparison.OrdinalIgnoreCase))return "TARGET_REJECTED";
                var request=(HttpWebRequest)WebRequest.Create(target);
                request.Method="GET";
                request.Timeout=5500;
                request.ReadWriteTimeout=5500;
                request.AllowAutoRedirect=false;
                request.Headers[HttpRequestHeader.Authorization]="Bearer "+idToken;
                using(var response=(HttpWebResponse)request.GetResponse())
                    return response.StatusCode==HttpStatusCode.OK?"READY":"HTTP_OTHER";
            }
            catch(WebException e)
            {
                using(var response=e.Response as HttpWebResponse)
                {
                    if(response!=null)
                    {
                        if(response.StatusCode==HttpStatusCode.Unauthorized)return "AUTH_REJECTED";
                        if(response.StatusCode==HttpStatusCode.Forbidden)return "ACCESS_REJECTED";
                        if((int)response.StatusCode==429)return "QUOTA";
                        if((int)response.StatusCode>=500)return "SERVICE_UNAVAILABLE";
                    }
                }
                switch(e.Status)
                {
                    case WebExceptionStatus.ConnectFailure:
                    case WebExceptionStatus.NameResolutionFailure:
                    case WebExceptionStatus.ProxyNameResolutionFailure:
                    case WebExceptionStatus.Timeout:
                        return "NETWORK_UNREACHABLE";
                    default:return "NETWORK_UNCERTAIN";
                }
            }
            catch { return "NETWORK_UNCERTAIN"; }
        }

        // Cheap local preflight before touching the read-only WMS export.
        // It never changes networks or sends any provider request.
        internal static bool HasApprovedFallback()
        {
            var original=CurrentProfile();
            return ValidProfile(original) && HasSavedProfile(original) &&
                ApprovedProfiles().Any(target=>ValidProfile(target) &&
                    !string.Equals(target,original,StringComparison.OrdinalIgnoreCase) &&
                    HasSavedProfile(target));
        }

        private static bool RestoreOriginalProfile(string name)
        {
            if(string.IsNullOrWhiteSpace(name))return true;
            if(!string.Equals(CurrentProfile(),name,StringComparison.Ordinal) &&
                !ConnectSavedProfile(name))return false;
            for(var attempt=0;attempt<8;attempt++)
            {
                if(string.Equals(CurrentProfile(),name,StringComparison.Ordinal))return true;
                Thread.Sleep(750);
            }
            return false;
        }

        // The caller must preserve confirmation and HA safety while holding this
        // route. Never persist or log the previously connected SSID/profile.
        private static readonly object NetworkSessionLock = new object();

        internal sealed class WorkerSession : IDisposable
        {
            private readonly string restoreProfile;
            private readonly Action<string> log;
            private bool disposed;
            internal bool DidSwitch { get { return !string.IsNullOrEmpty(restoreProfile); } }
            internal WorkerSession(string original,Action<string> logger)
            {
                restoreProfile=original;
                log=logger ?? delegate {};
            }
            public void Dispose()
            {
                if(disposed)return;
                disposed=true;
                try
                {
                    if(!RestoreOriginalProfile(restoreProfile))
                    {
                        log("D168_NETWORK restore=FAILED");
                        throw new InvalidOperationException("D167_NETWORK_RESTORE_FAILED");
                    }
                }
                finally { Monitor.Exit(NetworkSessionLock); }
            }
        }

        private static string CurrentProfile()
        {
            try
            {
                var process=new Process {
                    StartInfo=new ProcessStartInfo {
                        FileName="netsh.exe",Arguments="wlan show interfaces",
                        UseShellExecute=false,CreateNoWindow=true,
                        RedirectStandardOutput=true
                    }
                };
                using(process)
                {
                    if(!process.Start())return "";
                    Task<string> output=process.StandardOutput.ReadToEndAsync();
                    if(!process.WaitForExit(5000))
                    {
                        try { process.Kill(); } catch { }
                        return "";
                    }
                    if(process.ExitCode!=0 || !output.Wait(3000))return "";
                    var profiles=Regex.Matches(output.Result,
                        @"(?im)^\s*(?:Profile|Hồ sơ)\s*:\s*([^\r\n]+)");
                    if(profiles.Count!=1)return ""; // multiple adapters: fail closed
                    var name=profiles[0].Groups[1].Value.Trim();
                    return ValidProfile(name) ? name : "";
                }
            }
            catch { return ""; }
        }

        internal static WorkerSession OpenWorkerSession(string idToken,
            Func<bool> canSwitch,Func<bool> requestNetworkPermission,
            Action<string> log)
        {
            if(!Monitor.TryEnter(NetworkSessionLock))
                throw new InvalidOperationException("D167_NETWORK_SWITCH_ALREADY_RUNNING");
            var original="";
            try
            {
                // One user-action/job scoped request, not a background poll.
                var readiness=ProbeWorker(idToken);
                if(readiness=="READY")return new WorkerSession("",log);
                if(readiness!="NETWORK_UNREACHABLE")
                    throw new InvalidOperationException("D167_WORKER_UNAVAILABLE_NO_SAFE_SWITCH");
                var targets=ApprovedProfiles();
                original=CurrentProfile();
                if(!ValidProfile(original) || !HasSavedProfile(original) ||
                    !targets.Any(target=>ValidProfile(target) &&
                        !string.Equals(target,original,StringComparison.OrdinalIgnoreCase) &&
                        HasSavedProfile(target)))
                    throw new InvalidOperationException("D167_NETWORK_PROFILES_NOT_APPROVED");
                if(canSwitch==null || !canSwitch())
                    throw new InvalidOperationException("D167_NETWORK_SWITCH_BUSY");
                if(requestNetworkPermission==null || !requestNetworkPermission())
                    throw new InvalidOperationException("D167_NETWORK_SWITCH_DEFERRED");
                var attempted=0;
                foreach(var target in targets)
                {
                    if(string.Equals(target,original,StringComparison.OrdinalIgnoreCase) ||
                        !HasSavedProfile(target))continue;
                    if(!canSwitch())
                        throw new InvalidOperationException("D167_NETWORK_SWITCH_BUSY");
                    attempted++;
                    // No credentials or Wi-Fi names go to telemetry.
                    (log??delegate{}).Invoke("D168_NETWORK fallback_try="+attempted);
                    if(ConnectSavedProfile(target))
                    {
                        for(var attempt=0;attempt<3;attempt++)
                        {
                            if(!canSwitch())
                                throw new InvalidOperationException("D167_NETWORK_SWITCH_BUSY");
                            if(string.Equals(CurrentProfile(),target,
                                    StringComparison.OrdinalIgnoreCase))
                            {
                                var result=ProbeWorker(idToken);
                                if(result=="READY")
                                    return new WorkerSession(original,log);
                                if(result=="AUTH_REJECTED" || result=="ACCESS_REJECTED" ||
                                   result=="QUOTA" || result=="SERVICE_UNAVAILABLE")
                                    throw new InvalidOperationException("D167_WORKER_UNAVAILABLE_NO_SAFE_SWITCH");
                            }
                            Thread.Sleep(1500);
                        }
                    }
                    // The next candidate may only be tried after an actual
                    // readback of the original Windows WLAN profile.
                    if(!RestoreOriginalProfile(original))
                        throw new InvalidOperationException("D167_NETWORK_RESTORE_FAILED");
                }
                throw new InvalidOperationException("D167_NETWORK_WORKER_NOT_READY");
            }
            catch
            {
                if(!RestoreOriginalProfile(original))
                    (log ?? delegate {}).Invoke("D168_NETWORK restore=FAILED");
                Monitor.Exit(NetworkSessionLock);
                throw;
            }
        }
    }
}
