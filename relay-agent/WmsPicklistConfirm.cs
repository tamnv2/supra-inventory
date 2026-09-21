using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class WmsPicklistConfirmResult
    {
        internal string Result = "CONFIRM_ERROR";
        internal string Route = "NONE";
        internal int StatusCode;
        internal long ElapsedMs;
    }

    internal static class WmsPicklistConfirmClient
    {
        private sealed class Route
        {
            internal string Name;
            internal IWebProxy Proxy;
        }

        private static readonly object ConfirmGate = new object();
        private static readonly Dictionary<string, DateTime> RecentSuccess =
            new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static readonly TimeSpan RecentSuccessWindow = TimeSpan.FromMinutes(2);

        internal static WmsPicklistConfirmResult Confirm(WmsSessionSnapshot session, string pickListCode)
        {
            if (session == null || !session.IsValidHy1())
                return new WmsPicklistConfirmResult { Result = "WMS_SESSION_REQUIRED" };
            ValidateCode(pickListCode);

            lock (ConfirmGate)
            {
                DateTime successAt;
                if (RecentSuccess.TryGetValue(pickListCode, out successAt) &&
                    DateTime.UtcNow - successAt <= RecentSuccessWindow)
                    return new WmsPicklistConfirmResult { Result = "CONFIRMED", Route = "RECENT_SUCCESS_GUARD", StatusCode = 200 };

                PurgeOldSuccesses();
                var payload = Json.Serialize(new Dictionary<string, object>
                {
                    { "PickListCodes", new[] { pickListCode } },
                    { "IsAllowSkipped", true },
                    { "RemainSkip", 1 },
                    { "WarehouseCode", "HY1" },
                    { "EnableDCSite", false }
                });

                WmsPicklistConfirmResult last = null;
                foreach (var route in BuildRoutes(new Uri(AgentConfig.WmsPicklistConfirmUrl)))
                {
                    last = SendOne(session, route, payload);
                    AgentDiagnostics.Write(
                        "WMS picklist-confirm result=" + last.Result +
                        " route=" + last.Route +
                        " http=" + last.StatusCode +
                        " ms=" + last.ElapsedMs +
                        " picklist=redacted session_values=redacted");
                    if (last.Result == "TRANSPORT_FAIL" || last.Result == "PROXY_AUTH_REQUIRED") continue;
                    if (last.Result == "CONFIRMED") RecentSuccess[pickListCode] = DateTime.UtcNow;
                    return last;
                }
                return last ?? new WmsPicklistConfirmResult { Result = "TRANSPORT_FAIL" };
            }
        }

        private static WmsPicklistConfirmResult SendOne(WmsSessionSnapshot session, Route route, string payload)
        {
            var started = Stopwatch.StartNew();
            HttpWebResponse response = null;
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(AgentConfig.WmsPicklistConfirmUrl);
                request.Method = "POST";
                request.Proxy = route.Proxy;
                request.Timeout = 15000;
                request.ReadWriteTimeout = 30000;
                request.AllowAutoRedirect = false;
                request.KeepAlive = false;
                request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36";
                request.Accept = "application/json, text/plain, */*";
                request.ContentType = "application/json";
                ApplySessionHeaders(request, session);
                var signature = CreateSignature(AgentConfig.WmsPicklistConfirmSignPath);
                request.Headers["X-Signature"] = signature.Item1;
                request.Headers["X-Signature-Nonce"] = signature.Item2;

                var bytes = Encoding.UTF8.GetBytes(payload);
                request.ContentLength = bytes.Length;
                using (var output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);

                response = (HttpWebResponse)request.GetResponse();
                var body = ReadBounded(response.GetResponseStream(), 256 * 1024);
                started.Stop();
                var status = (int)response.StatusCode;
                return new WmsPicklistConfirmResult
                {
                    Result = Classify(status, body),
                    Route = route.Name,
                    StatusCode = status,
                    ElapsedMs = started.ElapsedMilliseconds
                };
            }
            catch (WebException ex)
            {
                response = ex.Response as HttpWebResponse;
                started.Stop();
                if (response == null)
                    return new WmsPicklistConfirmResult { Result = "TRANSPORT_FAIL", Route = route.Name, ElapsedMs = started.ElapsedMilliseconds };

                var status = (int)response.StatusCode;
                var body = "";
                try { body = ReadBounded(response.GetResponseStream(), 256 * 1024); } catch { }
                return new WmsPicklistConfirmResult
                {
                    Result = Classify(status, body),
                    Route = route.Name,
                    StatusCode = status,
                    ElapsedMs = started.ElapsedMilliseconds
                };
            }
            finally
            {
                try { if (response != null) response.Dispose(); } catch { }
            }
        }

        private static string Classify(int status, string body)
        {
            if (LooksLikeProxyBlock(body)) return "PROXY_BLOCK";

            if (status >= 200 && status < 300)
            {
                bool? businessStatus = TryReadBusinessStatus(body);
                if (businessStatus == true) return "CONFIRMED";
                if (businessStatus == false) return "CONFIRM_REJECTED";

                // A 2xx transport response without a trustworthy business Status=true
                // cannot be reported as success because the WMS mutation outcome is uncertain.
                return "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
            }

            if (status == 401) return "SESSION_EXPIRED";
            if (status == 403) return "FORBIDDEN";
            if (status == 407) return "PROXY_AUTH_REQUIRED";
            if (status == 408) return "TIMEOUT";
            if (status == 409) return "CONFIRM_CONFLICT";
            if (status == 429) return "RATE_LIMITED";
            if (status >= 500) return "SERVER_ERROR";
            if (status == 400 || status == 422) return "CONFIRM_REJECTED";
            return "CONFIRM_HTTP_ERROR";
        }

        private static bool? TryReadBusinessStatus(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return null;
            try
            {
                var root = Json.DeserializeObject(body) as Dictionary<string, object>;
                if (root == null) return null;
                object raw;
                if (!root.TryGetValue("Status", out raw) || raw == null) return null;
                if (raw is bool) return (bool)raw;

                bool parsed;
                return bool.TryParse(Convert.ToString(raw), out parsed) ? parsed : (bool?)null;
            }
            catch
            {
                return null;
            }
        }

        private static void ValidateCode(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length < 7 ||
                !value.StartsWith("PL", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("PickListCode không hợp lệ.", "pickListCode");
            for (var i = 2; i < value.Length; i++)
                if (value[i] < '0' || value[i] > '9')
                    throw new ArgumentException("PickListCode không hợp lệ.", "pickListCode");
        }

        private static void PurgeOldSuccesses()
        {
            var cutoff = DateTime.UtcNow - RecentSuccessWindow;
            var expired = new List<string>();
            foreach (var pair in RecentSuccess) if (pair.Value < cutoff) expired.Add(pair.Key);
            foreach (var key in expired) RecentSuccess.Remove(key);
        }

        private static void ApplySessionHeaders(HttpWebRequest request, WmsSessionSnapshot session)
        {
            request.Headers[HttpRequestHeader.Authorization] = session.Authorization;
            request.Headers["Token"] = session.Token;
            request.Headers["APISID"] = session.APISID;
            request.Headers["AppID"] = string.IsNullOrWhiteSpace(session.AppID) ? "unknown" : session.AppID;
            request.Headers["SID"] = session.SID;
            request.Headers["SCID"] = session.SCID;
            request.Headers["USID"] = session.USID;
            request.Headers["Warehouse"] = string.IsNullOrWhiteSpace(session.Warehouse) ? "HY1" : session.Warehouse;
            if (!string.IsNullOrWhiteSpace(session.XGeoRegion)) request.Headers["X-Geo-Region"] = session.XGeoRegion;
            request.Headers["Origin"] = string.IsNullOrWhiteSpace(session.Origin) ? AgentConfig.WmsOrigin : session.Origin;
            request.Referer = string.IsNullOrWhiteSpace(session.Referer) ? AgentConfig.WmsReferer : session.Referer;
        }

        private static Tuple<string, string> CreateSignature(string signPath)
        {
            const string prefix = "910";
            var r10 = RandomAlphaNumeric(10);
            var r4 = RandomAlphaNumeric(4);
            var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            var key = Encoding.UTF8.GetBytes(prefix + ts + r4);
            var message = Encoding.UTF8.GetBytes(r10 + "|" + signPath);
            byte[] hash;
            using (var hmac = new HMACSHA256(key)) hash = hmac.ComputeHash(message);
            var hex = new StringBuilder(hash.Length * 2);
            foreach (var item in hash) hex.Append(item.ToString("x2"));
            return Tuple.Create(prefix + hex, r10 + r4 + ts);
        }

        private static string RandomAlphaNumeric(int length)
        {
            const string alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
            var bytes = new byte[length];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            var output = new char[length];
            for (var i = 0; i < length; i++) output[i] = alphabet[bytes[i] % alphabet.Length];
            return new string(output);
        }

        private static List<Route> BuildRoutes(Uri target)
        {
            var routes = new List<Route>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var system = WebRequest.GetSystemWebProxy();
                if (system != null)
                {
                    system.Credentials = CredentialCache.DefaultNetworkCredentials;
                    AddRoute(routes, seen, "WINDOWS", system, target);
                }
            }
            catch { }

            var env = Environment.GetEnvironmentVariable("HTTPS_PROXY");
            if (string.IsNullOrWhiteSpace(env)) env = Environment.GetEnvironmentVariable("HTTP_PROXY");
            Uri envUri;
            if (!string.IsNullOrWhiteSpace(env) && Uri.TryCreate(env, UriKind.Absolute, out envUri))
                AddRoute(routes, seen, "ENV", new WebProxy(envUri) { Credentials = CredentialCache.DefaultNetworkCredentials }, target);
            AddRoute(routes, seen, "DIRECT", null, target);
            try
            {
                AddRoute(routes, seen, "CORP_FALLBACK",
                    new WebProxy(AgentConfig.CorporateProxyFallback) { Credentials = CredentialCache.DefaultNetworkCredentials }, target);
            }
            catch { }
            return routes;
        }

        private static void AddRoute(List<Route> routes, HashSet<string> seen, string name, IWebProxy proxy, Uri target)
        {
            var key = "DIRECT";
            if (proxy != null)
            {
                try
                {
                    var resolved = proxy.GetProxy(target);
                    if (resolved != null && resolved != target) key = resolved.Scheme + "://" + resolved.Host + ":" + resolved.Port;
                }
                catch { key = name; }
            }
            if (!seen.Add(key)) return;
            routes.Add(new Route { Name = name, Proxy = proxy });
        }

        private static string ReadBounded(Stream stream, int maxBytes)
        {
            if (stream == null) return "";
            using (var output = new MemoryStream())
            {
                var buffer = new byte[8192];
                while (output.Length < maxBytes)
                {
                    var remaining = maxBytes - (int)output.Length;
                    var read = stream.Read(buffer, 0, Math.Min(buffer.Length, remaining));
                    if (read <= 0) break;
                    output.Write(buffer, 0, read);
                }
                return Encoding.UTF8.GetString(output.ToArray());
            }
        }

        internal static bool SelfTestResponseSemantics()
        {
            return string.Equals(
                       Classify(200, "{\"Status\":true,\"Data\":{}}"),
                       "CONFIRMED",
                       StringComparison.Ordinal) &&
                   string.Equals(
                       Classify(200, "{\"Status\":false,\"Data\":{}}"),
                       "CONFIRM_REJECTED",
                       StringComparison.Ordinal) &&
                   string.Equals(
                       Classify(200, "{\"Data\":{}}"),
                       "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                       StringComparison.Ordinal);
        }

        private static bool LooksLikeProxyBlock(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return false;
            return body.IndexOf("Cảnh báo truy cập Website", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   body.IndexOf("URLBlocked.html", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   body.IndexOf("/mwg-internal/", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   body.IndexOf("Block All Other connect form Store", StringComparison.OrdinalIgnoreCase) >= 0;
        }
    }
}
