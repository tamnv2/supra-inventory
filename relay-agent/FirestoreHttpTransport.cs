using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace SupraInventoryRelayAgent
{
    /// <summary>
    /// Shared Firestore REST transport for the Beta PDA ↔ Agent carrier.
    /// Uses the proven Windows default proxy path first (the same route as D091/manual
    /// Firestore probes), then a fresh system-proxy snapshot only for a bounded retry
    /// of safe reads. It never uses the WMS corporate fallback proxy and never bypasses
    /// company filtering.
    /// </summary>
    internal static class FirestoreHttpTransport
    {
        private static long _lastNetworkChangeMs;

        internal static void NotifyNetworkChange()
        {
            Interlocked.Exchange(ref _lastNetworkChangeMs, NowMs());
        }

        internal static bool IsNetworkTransitioning
        {
            get
            {
                var last = Interlocked.Read(ref _lastNetworkChangeMs);
                return last > 0 && NowMs() - last < 20000L;
            }
        }
        internal static string SendJson(
            string method,
            string url,
            string token,
            string body,
            string userAgent,
            int timeoutMs,
            bool retrySafeRead,
            Action<string> log,
            string component)
        {
            var attempts = retrySafeRead ? 3 : 1;
            WebException last = null;

            for (var attempt = 1; attempt <= attempts; attempt++)
            {
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = method;
                request.Accept = "application/json";
                request.ContentType = "application/json; charset=utf-8";
                request.UserAgent = userAgent;
                request.Timeout = timeoutMs;
                request.ReadWriteTimeout = timeoutMs;
                request.KeepAlive = false;
                request.Headers[HttpRequestHeader.Authorization] = "Bearer " + token;

                var route = attempt == 2
                    ? ApplyFreshSystemProxy(request, url)
                    : ApplyDefaultWindowsProxy(request, url);
                try
                {
                    if (body != null)
                    {
                        var bytes = Encoding.UTF8.GetBytes(body);
                        request.ContentLength = bytes.Length;
                        using (var output = request.GetRequestStream())
                            output.Write(bytes, 0, bytes.Length);
                    }

                    using (var response = (HttpWebResponse)request.GetResponse())
                    using (var stream = response.GetResponseStream())
                    using (var reader = stream == null ? null : new StreamReader(stream))
                        return reader == null ? "" : reader.ReadToEnd();
                }
                catch (WebException ex)
                {
                    last = ex;
                    if (attempt < attempts && IsTransient(ex))
                    {
                        if (log != null)
                            log("FIRESTORE transport retry component=" + Safe(component) +
                                " method=" + Safe(method) +
                                " reason=" + ex.Status +
                                " route=" + route +
                                " transition=" + (IsNetworkTransitioning ? "true" : "false") +
                                " attempt=" + attempt + "/" + attempts);
                        Thread.Sleep(attempt == 1 ? 350 : 900);
                        continue;
                    }
                    throw;
                }
            }

            throw last ?? new WebException("Firestore request failed.");
        }

        internal static bool IsTransient(WebException ex)
        {
            if (ex == null) return false;
            switch (ex.Status)
            {
                case WebExceptionStatus.NameResolutionFailure:
                case WebExceptionStatus.ProxyNameResolutionFailure:
                case WebExceptionStatus.ConnectFailure:
                case WebExceptionStatus.Timeout:
                case WebExceptionStatus.ConnectionClosed:
                case WebExceptionStatus.ReceiveFailure:
                case WebExceptionStatus.SendFailure:
                    return true;
                default:
                    return false;
            }
        }

        internal static string Describe(WebException ex)
        {
            if (ex == null) return "unknown";
            var response = ex.Response as HttpWebResponse;
            if (response == null)
                return "status=0 web_exception=" + ex.Status;

            var status = (int)response.StatusCode;
            var host = response.ResponseUri == null ? "" : response.ResponseUri.Host;
            try { response.Dispose(); } catch { }
            return "http=" + status + " host=" + Safe(host) + " web_exception=" + ex.Status;
        }

        private static string ApplyDefaultWindowsProxy(HttpWebRequest request, string url)
        {
            try
            {
                var proxy = WebRequest.DefaultWebProxy;
                if (proxy == null)
                {
                    request.Proxy = null;
                    return "DEFAULT:DIRECT";
                }

                proxy.Credentials = CredentialCache.DefaultNetworkCredentials;
                request.Proxy = proxy;
                return "DEFAULT:" + DescribeProxy(proxy, url);
            }
            catch
            {
                return "DEFAULT:AUTO";
            }
        }

        private static string ApplyFreshSystemProxy(HttpWebRequest request, string url)
        {
            try
            {
                var proxy = WebRequest.GetSystemWebProxy();
                if (proxy == null)
                {
                    request.Proxy = null;
                    return "SYSTEM:DIRECT";
                }

                proxy.Credentials = CredentialCache.DefaultNetworkCredentials;
                request.Proxy = proxy;
                return "SYSTEM:" + DescribeProxy(proxy, url);
            }
            catch
            {
                request.Proxy = WebRequest.DefaultWebProxy;
                return "SYSTEM:FALLBACK_DEFAULT";
            }
        }

        private static string DescribeProxy(IWebProxy proxy, string url)
        {
            try
            {
                var target = new Uri(url);
                var proxyUri = proxy.GetProxy(target);
                if (proxyUri == null || proxyUri == target) return "DIRECT";
                return proxyUri.Scheme + "://" + proxyUri.Host + ":" + proxyUri.Port;
            }
            catch
            {
                return "AUTO";
            }
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        private static string Safe(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var next = value.Trim();
            return next.Length <= 96 ? next : next.Substring(0, 96);
        }
    }
}
