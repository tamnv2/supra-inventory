using System;
using System.Diagnostics;
using System.Net;
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
    }
}
