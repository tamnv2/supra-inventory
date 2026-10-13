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
        private static readonly Regex SafeProfile=new Regex(
            @"^[\p{L}\p{N} ._+-]{1,64}$",RegexOptions.Compiled);

        internal static string ApprovedProfile()
        {
            try
            {
                using(var key=Registry.CurrentUser.OpenSubKey(LocalKey,false))
                    return Convert.ToString(key==null ? "" : key.GetValue(WorkerProfileValue,"")) ?? "";
            }
            catch { return ""; }
        }

        internal static bool SaveApprovedProfile(string name)
        {
            var value=(name??"").Trim();
            if(!ValidProfile(value) || !HasSavedProfile(value))return false;
            try
            {
                using(var key=Registry.CurrentUser.CreateSubKey(LocalKey,true))
                {
                    if(key==null)return false;
                    key.SetValue(WorkerProfileValue,value,RegistryValueKind.String);
                }
                return true;
            }
            catch { return false; }
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
                    !string.Equals(target.Host,"inventory-beta.supra.cc.cd",
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

        // The caller must preserve confirmation and HA safety while holding this
        // route. Never persist or log the previously connected SSID/profile.
        private static readonly object NetworkSessionLock = new object();

        internal sealed class WorkerSession : IDisposable
        {
            private readonly string restoreProfile;
            private readonly Action<string> log;
            private bool disposed;
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
                    if(!string.IsNullOrEmpty(restoreProfile) &&
                        (!ConnectSavedProfile(restoreProfile) ||
                         !string.Equals(CurrentProfile(),restoreProfile,StringComparison.Ordinal)))
                        log("D168_NETWORK restore=FAILED");
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
                var target=ApprovedProfile();
                original=CurrentProfile();
                if(!ValidProfile(target) || !ValidProfile(original) ||
                    string.Equals(target,original,StringComparison.Ordinal) ||
                    !HasSavedProfile(original) || !HasSavedProfile(target))
                    throw new InvalidOperationException("D167_NETWORK_PROFILES_NOT_APPROVED");
                if(canSwitch==null || !canSwitch())
                    throw new InvalidOperationException("D167_NETWORK_SWITCH_BUSY");
                if(requestNetworkPermission==null || !requestNetworkPermission())
                    throw new InvalidOperationException("D167_NETWORK_SWITCH_DEFERRED");
                if(!canSwitch())
                    throw new InvalidOperationException("D167_NETWORK_SWITCH_BUSY");
                if(!ConnectSavedProfile(target))
                    throw new InvalidOperationException("D167_NETWORK_SWITCH_FAILED");
                for(var attempt=0;attempt<3;attempt++)
                {
                    if(!canSwitch())
                        throw new InvalidOperationException("D167_NETWORK_SWITCH_BUSY");
                    if(string.Equals(CurrentProfile(),target,StringComparison.Ordinal) &&
                        ProbeWorker(idToken)=="READY")
                        return new WorkerSession(original,log);
                    Thread.Sleep(1500);
                }
                throw new InvalidOperationException("D167_NETWORK_WORKER_NOT_READY");
            }
            catch
            {
                if(!string.IsNullOrEmpty(original) &&
                   !string.Equals(CurrentProfile(),original,StringComparison.Ordinal) &&
                   (!ConnectSavedProfile(original) ||
                    !string.Equals(CurrentProfile(),original,StringComparison.Ordinal)))
                    (log ?? delegate {}).Invoke("D168_NETWORK restore=FAILED");
                Monitor.Exit(NetworkSessionLock);
                throw;
            }
        }
    }
}
