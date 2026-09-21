using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class WmsExactPicklistResult
    {
        internal string Result = "LOOKUP_ERROR";
        internal string PickListCode = "";
        internal string Route = "NONE";
        internal int StatusCode;
        internal long ElapsedMs;
        internal int MatchCount;
    }

    // Post-FOUND identity resolver only. Primary existence lookup remains the D084
    // all-date Content-empty cache path. This resolver obtains the exact full
    // PickListCode before any mutation and fails closed on 0 or >1 exact matches.
    internal static class WmsExactPicklistResolver
    {
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };

        internal static WmsExactPicklistResult Resolve(WmsSessionSnapshot session, string suffix)
        {
            if (session == null || !session.IsValidHy1())
                return new WmsExactPicklistResult { Result = "WMS_SESSION_REQUIRED" };
            if (string.IsNullOrWhiteSpace(suffix) || suffix.Length != 5)
                throw new ArgumentException("Picklist suffix must contain exactly five digits.", "suffix");

            var matches = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            long elapsed = 0;
            string lastRoute = "NONE";
            var lastHttp = 0;

            for (var page = 1; page <= 10000; page++)
            {
                var filter = new Dictionary<string, object>
                {
                    { "WarehouseCode", "HY1" }, { "WarehouseSiteId", "" }, { "ClientCode", "WIN" },
                    { "FromDate", "" }, { "ToDate", "" }, { "Content", "" },
                    { "Employee", "" }, { "IsAllowSkipped", "" }
                };
                var sort = new Dictionary<string, object> { { "CreatedDate", "desc" } };
                var url = AgentConfig.WmsPicklistLookupUrl +
                    "?filter=" + Uri.EscapeDataString(Json.Serialize(filter)) +
                    "&page=" + page + "&limit=100&PageIndex=" + page +
                    "&RecordsPerPage=100&regionCode=null&sort=" + Uri.EscapeDataString(Json.Serialize(sort));

                var result = Send(url, session);
                elapsed += result.ElapsedMs;
                lastRoute = result.Route;
                lastHttp = result.StatusCode;
                if (result.Result != "PASS")
                    return Build(result.Result, "", lastRoute, lastHttp, elapsed, matches.Count);

                var codes = new List<string>();
                try { CollectCodes(Json.DeserializeObject(result.Body ?? ""), codes, 0); }
                catch { return Build("SCHEMA_UNSUPPORTED", "", lastRoute, lastHttp, elapsed, matches.Count); }

                foreach (var code in codes)
                    if (ValidCode(code) && code.EndsWith(suffix, StringComparison.Ordinal))
                        matches.Add(code.Trim());

                if (matches.Count > 1)
                    return Build("AMBIGUOUS_PICKLIST", "", lastRoute, lastHttp, elapsed, matches.Count);
                if (codes.Count < 100) break;
            }

            if (matches.Count != 1)
                return Build(matches.Count == 0 ? "EXACT_CODE_NOT_RESOLVED" : "AMBIGUOUS_PICKLIST",
                    "", lastRoute, lastHttp, elapsed, matches.Count);

            string exact = "";
            foreach (var code in matches) { exact = code; break; }
            return Build("FOUND", exact, lastRoute, lastHttp, elapsed, 1);
        }

        private sealed class HttpResult
        {
            internal string Result;
            internal string Route;
            internal int StatusCode;
            internal long ElapsedMs;
            internal string Body;
        }

        private static HttpResult Send(string url, WmsSessionSnapshot session)
        {
            var target = new Uri(url);
            var routes = new List<Tuple<string, IWebProxy>>();
            try
            {
                var system = WebRequest.GetSystemWebProxy();
                if (system != null)
                {
                    system.Credentials = CredentialCache.DefaultNetworkCredentials;
                    routes.Add(Tuple.Create("WINDOWS", (IWebProxy)system));
                }
            }
            catch { }
            routes.Add(Tuple.Create("DIRECT", (IWebProxy)null));
            try
            {
                routes.Add(Tuple.Create("CORP_FALLBACK",
                    (IWebProxy)new WebProxy(AgentConfig.CorporateProxyFallback)
                    { Credentials = CredentialCache.DefaultNetworkCredentials }));
            }
            catch { }

            HttpResult last = null;
            foreach (var route in routes)
            {
                last = SendOne(target, session, route.Item1, route.Item2);
                AgentDiagnostics.Write("WMS exact-resolve result=" + last.Result +
                    " route=" + last.Route + " http=" + last.StatusCode +
                    " ms=" + last.ElapsedMs + " suffix=redacted");
                if (last.Result == "TRANSPORT_FAIL" || last.Result == "PROXY_AUTH_REQUIRED") continue;
                return last;
            }
            return last ?? new HttpResult { Result = "TRANSPORT_FAIL", Route = "NONE" };
        }

        private static HttpResult SendOne(Uri url, WmsSessionSnapshot session, string route, IWebProxy proxy)
        {
            var sw = Stopwatch.StartNew();
            HttpWebResponse response = null;
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "GET";
                request.Proxy = proxy;
                request.Timeout = 15000;
                request.ReadWriteTimeout = 30000;
                request.KeepAlive = false;
                request.Accept = "application/json, text/plain, */*";
                request.ContentType = "application/json";
                request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36";
                ApplySessionHeaders(request, session);
                var signature = Signature(AgentConfig.WmsPicklistLookupSignPath);
                request.Headers["X-Signature"] = signature.Item1;
                request.Headers["X-Signature-Nonce"] = signature.Item2;

                response = (HttpWebResponse)request.GetResponse();
                var body = Read(response.GetResponseStream());
                sw.Stop();
                return new HttpResult { Result = Classify((int)response.StatusCode, body), Route = route,
                    StatusCode = (int)response.StatusCode, ElapsedMs = sw.ElapsedMilliseconds, Body = body };
            }
            catch (WebException ex)
            {
                response = ex.Response as HttpWebResponse;
                sw.Stop();
                if (response == null) return new HttpResult { Result = "TRANSPORT_FAIL", Route = route, ElapsedMs = sw.ElapsedMilliseconds };
                var body = "";
                try { body = Read(response.GetResponseStream()); } catch { }
                return new HttpResult { Result = Classify((int)response.StatusCode, body), Route = route,
                    StatusCode = (int)response.StatusCode, ElapsedMs = sw.ElapsedMilliseconds, Body = body };
            }
            finally { try { if (response != null) response.Dispose(); } catch { } }
        }

        private static void CollectCodes(object node, List<string> codes, int depth)
        {
            if (node == null || depth > 32) return;
            var map = node as Dictionary<string, object>;
            if (map != null)
            {
                foreach (var pair in map)
                {
                    if (string.Equals(pair.Key, "PickListCode", StringComparison.OrdinalIgnoreCase))
                    {
                        var value = Convert.ToString(pair.Value);
                        if (!string.IsNullOrWhiteSpace(value)) codes.Add(value);
                    }
                    CollectCodes(pair.Value, codes, depth + 1);
                }
                return;
            }
            var list = node as ArrayList;
            if (list != null) foreach (var item in list) CollectCodes(item, codes, depth + 1);
        }

        private static bool ValidCode(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            var text = value.Trim();
            if (text.Length < 7 || !text.StartsWith("PL", StringComparison.OrdinalIgnoreCase)) return false;
            for (var i = 2; i < text.Length; i++) if (text[i] < '0' || text[i] > '9') return false;
            return true;
        }

        private static WmsExactPicklistResult Build(string result, string code, string route, int http, long ms, int count)
        {
            return new WmsExactPicklistResult { Result = result, PickListCode = code ?? "", Route = route ?? "NONE",
                StatusCode = http, ElapsedMs = Math.Max(0L, ms), MatchCount = Math.Max(0, count) };
        }

        private static void ApplySessionHeaders(HttpWebRequest request, WmsSessionSnapshot s)
        {
            request.Headers[HttpRequestHeader.Authorization] = s.Authorization;
            request.Headers["Token"] = s.Token; request.Headers["APISID"] = s.APISID;
            request.Headers["AppID"] = string.IsNullOrWhiteSpace(s.AppID) ? "unknown" : s.AppID;
            request.Headers["SID"] = s.SID; request.Headers["SCID"] = s.SCID; request.Headers["USID"] = s.USID;
            request.Headers["Warehouse"] = string.IsNullOrWhiteSpace(s.Warehouse) ? "HY1" : s.Warehouse;
            if (!string.IsNullOrWhiteSpace(s.XGeoRegion)) request.Headers["X-Geo-Region"] = s.XGeoRegion;
            request.Headers["Origin"] = string.IsNullOrWhiteSpace(s.Origin) ? AgentConfig.WmsOrigin : s.Origin;
            request.Referer = string.IsNullOrWhiteSpace(s.Referer) ? AgentConfig.WmsReferer : s.Referer;
        }

        private static Tuple<string, string> Signature(string path)
        {
            const string prefix = "910";
            var a = RandomText(10); var b = RandomText(4);
            var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            byte[] hash;
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(prefix + ts + b)))
                hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(a + "|" + path));
            var hex = new StringBuilder();
            foreach (var item in hash) hex.Append(item.ToString("x2"));
            return Tuple.Create(prefix + hex, a + b + ts);
        }

        private static string RandomText(int length)
        {
            const string alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
            var bytes = new byte[length];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            var chars = new char[length];
            for (var i = 0; i < length; i++) chars[i] = alphabet[bytes[i] % alphabet.Length];
            return new string(chars);
        }

        private static string Read(Stream stream)
        {
            if (stream == null) return "";
            using (var output = new MemoryStream())
            {
                var buffer = new byte[8192];
                while (output.Length < 1024 * 1024)
                {
                    var read = stream.Read(buffer, 0, Math.Min(buffer.Length, 1024 * 1024 - (int)output.Length));
                    if (read <= 0) break;
                    output.Write(buffer, 0, read);
                }
                return Encoding.UTF8.GetString(output.ToArray());
            }
        }

        private static string Classify(int status, string body)
        {
            if (!string.IsNullOrWhiteSpace(body) &&
                (body.IndexOf("URLBlocked.html", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 body.IndexOf("/mwg-internal/", StringComparison.OrdinalIgnoreCase) >= 0))
                return "PROXY_BLOCK";
            if (status >= 200 && status < 300) return "PASS";
            if (status == 401) return "SESSION_EXPIRED";
            if (status == 403) return "FORBIDDEN";
            if (status == 407) return "PROXY_AUTH_REQUIRED";
            if (status == 429) return "RATE_LIMITED";
            if (status >= 500) return "SERVER_ERROR";
            return "HTTP_ERROR";
        }
    }
}
