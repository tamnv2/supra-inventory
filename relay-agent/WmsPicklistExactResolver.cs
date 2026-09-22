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
            var results = ResolveMany(session, new[] { suffix });
            WmsExactPicklistResult result;
            return results.TryGetValue((suffix ?? "").Trim(), out result)
                ? result
                : Build("EXACT_CODE_NOT_RESOLVED", "", "NONE", 0, 0L, 0);
        }

        internal static Dictionary<string, WmsExactPicklistResult> ResolveMany(
            WmsSessionSnapshot session,
            IEnumerable<string> suffixes)
        {
            if (session == null || !session.IsValidHy1())
                throw new InvalidOperationException("WMS session is required.");

            var targets = new List<string>();
            var targetSet = new HashSet<string>(StringComparer.Ordinal);
            foreach (var raw in suffixes ?? new string[0])
            {
                var suffix = (raw ?? "").Trim();
                if (suffix.Length != 4 && suffix.Length != 5)
                    throw new ArgumentException("Picklist suffix must contain four digits; five-digit legacy jobs remain compatible during rollout.", "suffixes");
                foreach (var ch in suffix)
                    if (ch < '0' || ch > '9')
                        throw new ArgumentException("Picklist suffix must contain digits only.", "suffixes");
                if (targetSet.Add(suffix)) targets.Add(suffix);
            }
            if (targets.Count == 0)
                throw new ArgumentException("At least one Picklist suffix is required.", "suffixes");
            if (targets.Count > 12)
                throw new ArgumentException("At most 12 Picklist suffixes can be resolved per batch.", "suffixes");

            var matches = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
            foreach (var suffix in targets)
                matches[suffix] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            long elapsed = 0L;
            var lastRoute = "NONE";
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

                var http = Send(url, session);
                elapsed += http.ElapsedMs;
                lastRoute = http.Route;
                lastHttp = http.StatusCode;

                if (!string.Equals(http.Result, "PASS", StringComparison.Ordinal))
                {
                    var failed = new Dictionary<string, WmsExactPicklistResult>(StringComparer.Ordinal);
                    foreach (var suffix in targets)
                        failed[suffix] = Build(http.Result, "", lastRoute, lastHttp, elapsed, matches[suffix].Count);
                    return failed;
                }

                var codes = new List<string>();
                try { CollectCodes(Json.DeserializeObject(http.Body ?? ""), codes, 0); }
                catch
                {
                    var failed = new Dictionary<string, WmsExactPicklistResult>(StringComparer.Ordinal);
                    foreach (var suffix in targets)
                        failed[suffix] = Build("SCHEMA_UNSUPPORTED", "", lastRoute, lastHttp, elapsed, matches[suffix].Count);
                    return failed;
                }

                AgentDiagnostics.Write(
                    "WMS exact-resolve-batch parse=PASS page=" + page +
                    " targets=" + targets.Count +
                    " picklist_codes=" + codes.Count +
                    " values=redacted");

                foreach (var code in codes)
                {
                    if (!ValidCode(code)) continue;
                    var trimmed = code.Trim();
                    foreach (var target in targets)
                    {
                        if (trimmed.Length < target.Length) continue;
                        if (!trimmed.EndsWith(target, StringComparison.Ordinal)) continue;
                        HashSet<string> bucket;
                        if (matches.TryGetValue(target, out bucket))
                            bucket.Add(trimmed);
                    }
                }

                if (codes.Count < 100) break;
            }

            var results = new Dictionary<string, WmsExactPicklistResult>(StringComparer.Ordinal);
            foreach (var suffix in targets)
            {
                var bucket = matches[suffix];
                if (bucket.Count == 0)
                {
                    results[suffix] = Build("EXACT_CODE_NOT_RESOLVED", "", lastRoute, lastHttp, elapsed, 0);
                    continue;
                }
                if (bucket.Count > 1)
                {
                    results[suffix] = Build("AMBIGUOUS_PICKLIST", "", lastRoute, lastHttp, elapsed, bucket.Count);
                    continue;
                }
                var exact = "";
                foreach (var code in bucket) { exact = code; break; }
                results[suffix] = Build("FOUND", exact, lastRoute, lastHttp, elapsed, 1);
            }
            return results;
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

            // JavaScriptSerializer returns JSON arrays as object[] on .NET Framework.
            // Accept any non-string IEnumerable so this resolver matches the proven
            // WmsPicklistLookup parser instead of silently treating arrays as empty.
            if (node is string) return;
            var enumerable = node as IEnumerable;
            if (enumerable == null) return;
            foreach (var item in enumerable)
                CollectCodes(item, codes, depth + 1);
        }

        internal static bool SelfTestJsonArrayParsing()
        {
            var codes = new List<string>();
            CollectCodes(
                Json.DeserializeObject("{\"Status\":true,\"Data\":[{\"PickListCode\":\"PL2601012345\"}]}"),
                codes,
                0);
            return codes.Count == 1 &&
                   string.Equals(codes[0], "PL2601012345", StringComparison.Ordinal);
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
