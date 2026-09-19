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
    internal sealed class WmsPicklistLookupResult
    {
        internal string Result;
        internal string Route;
        internal int StatusCode;
        internal long ElapsedMs;
        internal int MatchCount;
        internal int CandidateFieldCount;
        internal string SchemaFields;

        internal string Summary()
        {
            return "PICKLIST_LOOKUP=" + Result +
                   (StatusCode > 0 ? "(" + StatusCode + ")" : "") +
                   (string.IsNullOrWhiteSpace(Route) ? "" : "/" + Route) +
                   "/" + ElapsedMs + "ms" +
                   " matches=" + MatchCount +
                   " candidate_fields=" + CandidateFieldCount;
        }
    }

    internal static class WmsPicklistLookupClient
    {
        private sealed class Route
        {
            internal string Name;
            internal IWebProxy Proxy;
        }

        private sealed class HttpPayload
        {
            internal string Result;
            internal string Route;
            internal int StatusCode;
            internal long ElapsedMs;
            internal string Body;
        }

        private sealed class ResponseAnalysis
        {
            internal int MatchCount;
            internal int CandidateFieldCount;
            internal int? TotalCount;
            internal readonly HashSet<string> SchemaFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };

        internal static WmsPicklistLookupResult Lookup(WmsSessionSnapshot session, string suffix)
        {
            if (session == null || !session.IsValidHy1())
                return new WmsPicklistLookupResult
                {
                    Result = "WMS_SESSION_REQUIRED",
                    Route = "NONE",
                    StatusCode = 0,
                    ElapsedMs = 0
                };

            if (string.IsNullOrWhiteSpace(suffix) || suffix.Length != 5)
                throw new ArgumentException("Picklist suffix must contain exactly five digits.", "suffix");
            foreach (var ch in suffix)
                if (ch < '0' || ch > '9')
                    throw new ArgumentException("Picklist suffix must contain exactly five digits.", "suffix");

            var url = BuildLookupUrl(suffix);
            HttpPayload last = null;
            foreach (var route in BuildRoutes(new Uri(url)))
            {
                var payload = SendOne(url, session, route);
                last = payload;

                AgentDiagnostics.Write(
                    "WMS picklist-lookup result=" + payload.Result +
                    " route=" + payload.Route +
                    " http=" + payload.StatusCode +
                    " ms=" + payload.ElapsedMs +
                    " query=content_5_digits_redacted session_values=redacted");

                if (payload.Result == "TRANSPORT_FAIL" || payload.Result == "PROXY_AUTH_REQUIRED")
                    continue;

                if (payload.Result != "PASS")
                    return new WmsPicklistLookupResult
                    {
                        Result = payload.Result,
                        Route = payload.Route,
                        StatusCode = payload.StatusCode,
                        ElapsedMs = payload.ElapsedMs,
                        MatchCount = 0,
                        CandidateFieldCount = 0
                    };

                return AnalyzeSuccessfulResponse(payload, suffix);
            }

            return new WmsPicklistLookupResult
            {
                Result = last == null ? "TRANSPORT_FAIL" : last.Result,
                Route = last == null ? "NONE" : last.Route,
                StatusCode = last == null ? 0 : last.StatusCode,
                ElapsedMs = last == null ? -1 : last.ElapsedMs
            };
        }

        private static string BuildLookupUrl(string suffix)
        {
            var today = DateTime.Now.Date;
            var monthStart = new DateTime(today.Year, today.Month, 1);
            var filter = new Dictionary<string, object>
            {
                { "WarehouseCode", "HY1" },
                { "WarehouseSiteId", "" },
                { "ClientCode", "WIN" },
                { "FromDate", monthStart.ToString("yyyy-MM-dd") },
                { "ToDate", today.ToString("yyyy-MM-dd") },
                { "Content", suffix },
                { "Employee", "" },
                { "IsAllowSkipped", "" }
            };
            var sort = new Dictionary<string, object> { { "CreatedDate", "desc" } };
            return AgentConfig.WmsPicklistLookupUrl +
                   "?filter=" + Uri.EscapeDataString(Json.Serialize(filter)) +
                   "&page=1&limit=100&PageIndex=1&RecordsPerPage=100" +
                   "&regionCode=null" +
                   "&sort=" + Uri.EscapeDataString(Json.Serialize(sort));
        }

        private static HttpPayload SendOne(string url, WmsSessionSnapshot session, Route route)
        {
            var started = Stopwatch.StartNew();
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Proxy = route.Proxy;
            request.Timeout = 15000;
            request.ReadWriteTimeout = 30000;
            request.AllowAutoRedirect = false;
            request.KeepAlive = false;
            request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36";
            request.Accept = "application/json, text/plain, */*";
            request.ContentType = "application/json";

            ApplySessionHeaders(request, session);
            var signature = CreateSignature(AgentConfig.WmsPicklistLookupSignPath);
            request.Headers["X-Signature"] = signature.Item1;
            request.Headers["X-Signature-Nonce"] = signature.Item2;

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    var body = ReadBounded(response.GetResponseStream(), 1024 * 1024);
                    started.Stop();
                    return new HttpPayload
                    {
                        Result = Classify((int)response.StatusCode, body),
                        Route = route.Name,
                        StatusCode = (int)response.StatusCode,
                        ElapsedMs = started.ElapsedMilliseconds,
                        Body = body
                    };
                }
            }
            catch (WebException ex)
            {
                started.Stop();
                var response = ex.Response as HttpWebResponse;
                if (response == null)
                {
                    return new HttpPayload
                    {
                        Result = "TRANSPORT_FAIL",
                        Route = route.Name,
                        StatusCode = 0,
                        ElapsedMs = started.ElapsedMilliseconds,
                        Body = ""
                    };
                }

                var status = (int)response.StatusCode;
                var body = "";
                try
                {
                    using (response)
                        body = ReadBounded(response.GetResponseStream(), 128 * 1024);
                }
                catch { }

                return new HttpPayload
                {
                    Result = Classify(status, body),
                    Route = route.Name,
                    StatusCode = status,
                    ElapsedMs = started.ElapsedMilliseconds,
                    Body = body
                };
            }
        }

        private static WmsPicklistLookupResult AnalyzeSuccessfulResponse(HttpPayload payload, string suffix)
        {
            ResponseAnalysis analysis;
            try
            {
                var root = Json.DeserializeObject(payload.Body ?? "");
                analysis = new ResponseAnalysis();
                AnalyzeNode(root, null, suffix, analysis, 0);
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write("WMS picklist-schema parse_fail=" + ex.GetType().Name + " response_values=redacted");
                return new WmsPicklistLookupResult
                {
                    Result = "SCHEMA_UNSUPPORTED",
                    Route = payload.Route,
                    StatusCode = payload.StatusCode,
                    ElapsedMs = payload.ElapsedMs
                };
            }

            var fields = new List<string>(analysis.SchemaFields);
            fields.Sort(StringComparer.OrdinalIgnoreCase);
            if (fields.Count > 30) fields.RemoveRange(30, fields.Count - 30);
            var safeFields = string.Join(",", fields.ToArray());

            var result = analysis.MatchCount > 0
                ? "FOUND"
                : analysis.CandidateFieldCount > 0 || (analysis.TotalCount.HasValue && analysis.TotalCount.Value == 0)
                    ? "NOT_FOUND"
                    : "SCHEMA_UNSUPPORTED";

            AgentDiagnostics.Write(
                "WMS picklist-schema result=" + result +
                " total=" + (analysis.TotalCount.HasValue ? analysis.TotalCount.Value.ToString() : "unknown") +
                " candidate_fields=" + analysis.CandidateFieldCount +
                " matches=" + analysis.MatchCount +
                " fields=" + safeFields +
                " values=redacted");

            return new WmsPicklistLookupResult
            {
                Result = result,
                Route = payload.Route,
                StatusCode = payload.StatusCode,
                ElapsedMs = payload.ElapsedMs,
                MatchCount = analysis.MatchCount,
                CandidateFieldCount = analysis.CandidateFieldCount,
                SchemaFields = safeFields
            };
        }

        private static void AnalyzeNode(object node, string key, string suffix, ResponseAnalysis result, int depth)
        {
            if (node == null || depth > 12) return;

            var map = node as Dictionary<string, object>;
            if (map != null)
            {
                foreach (var pair in map)
                {
                    var field = pair.Key ?? "";
                    if (!string.IsNullOrWhiteSpace(field) && result.SchemaFields.Count < 80)
                        result.SchemaFields.Add(SafeFieldName(field));

                    var normalized = NormalizeField(field);
                    if (!result.TotalCount.HasValue && IsTotalField(normalized))
                    {
                        int total;
                        if (TryInt(pair.Value, out total) && total >= 0) result.TotalCount = total;
                    }

                    if (IsPicklistIdentityField(normalized))
                    {
                        var value = pair.Value == null ? "" : Convert.ToString(pair.Value);
                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            result.CandidateFieldCount++;
                            if (TrailingFiveDigits(value) == suffix) result.MatchCount++;
                        }
                    }

                    AnalyzeNode(pair.Value, field, suffix, result, depth + 1);
                }
                return;
            }

            var array = node as object[];
            if (array != null)
            {
                foreach (var item in array)
                    AnalyzeNode(item, key, suffix, result, depth + 1);
                return;
            }

            var list = node as ArrayList;
            if (list != null)
            {
                foreach (var item in list)
                    AnalyzeNode(item, key, suffix, result, depth + 1);
            }
        }

        private static bool IsPicklistIdentityField(string normalized)
        {
            if (string.IsNullOrWhiteSpace(normalized) || normalized.IndexOf("picklist", StringComparison.Ordinal) < 0)
                return false;
            if (normalized.IndexOf("status", StringComparison.Ordinal) >= 0 ||
                normalized.IndexOf("date", StringComparison.Ordinal) >= 0 ||
                normalized.IndexOf("time", StringComparison.Ordinal) >= 0 ||
                normalized.IndexOf("allow", StringComparison.Ordinal) >= 0)
                return false;

            return normalized == "picklist" ||
                   normalized.IndexOf("code", StringComparison.Ordinal) >= 0 ||
                   normalized.IndexOf("number", StringComparison.Ordinal) >= 0 ||
                   normalized.EndsWith("no", StringComparison.Ordinal) ||
                   normalized.IndexOf("id", StringComparison.Ordinal) >= 0;
        }

        private static bool IsTotalField(string normalized)
        {
            return normalized == "total" ||
                   normalized == "totalcount" ||
                   normalized == "totalrecords" ||
                   normalized == "recordcount" ||
                   normalized == "recordscount";
        }

        private static string TrailingFiveDigits(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var text = value.Trim();
            var end = text.Length - 1;
            while (end >= 0 && char.IsWhiteSpace(text[end])) end--;
            if (end < 4) return "";

            var digits = new char[5];
            for (var i = 4; i >= 0; i--)
            {
                var ch = text[end - (4 - i)];
                if (ch < '0' || ch > '9') return "";
                digits[i] = ch;
            }
            return new string(digits);
        }

        private static string NormalizeField(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var sb = new StringBuilder();
            foreach (var ch in value.ToLowerInvariant())
                if (char.IsLetterOrDigit(ch)) sb.Append(ch);
            return sb.ToString();
        }

        private static string SafeFieldName(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var sb = new StringBuilder();
            foreach (var ch in value)
            {
                if (char.IsLetterOrDigit(ch) || ch == '_' || ch == '-')
                    sb.Append(ch);
                if (sb.Length >= 64) break;
            }
            return sb.ToString();
        }

        private static bool TryInt(object value, out int result)
        {
            result = 0;
            if (value == null) return false;
            if (value is int) { result = (int)value; return true; }
            if (value is long)
            {
                var longValue = (long)value;
                if (longValue < int.MinValue || longValue > int.MaxValue) return false;
                result = (int)longValue;
                return true;
            }
            return int.TryParse(Convert.ToString(value), out result);
        }

        private static string Classify(int status, string body)
        {
            if (LooksLikeProxyBlock(body)) return "PROXY_BLOCK";
            if (status >= 200 && status < 300) return "PASS";
            if (status == 401) return "SESSION_EXPIRED";
            if (status == 403) return "FORBIDDEN";
            if (status == 407) return "PROXY_AUTH_REQUIRED";
            if (status == 408) return "TIMEOUT";
            if (status == 429) return "RATE_LIMITED";
            if (status >= 500) return "SERVER_ERROR";
            if (status >= 300 && status < 400) return "REACHABLE_REDIRECT";
            if (status == 400) return "BAD_REQUEST";
            return "HTTP_ERROR";
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
            if (!string.IsNullOrWhiteSpace(session.XGeoRegion))
                request.Headers["X-Geo-Region"] = session.XGeoRegion;
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
            using (var hmac = new HMACSHA256(key))
                hash = hmac.ComputeHash(message);

            var hex = new StringBuilder(hash.Length * 2);
            foreach (var item in hash) hex.Append(item.ToString("x2"));
            return Tuple.Create(prefix + hex, r10 + r4 + ts);
        }

        private static string RandomAlphaNumeric(int length)
        {
            const string alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
            var bytes = new byte[length];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(bytes);
            var output = new char[length];
            for (var i = 0; i < length; i++)
                output[i] = alphabet[bytes[i] % alphabet.Length];
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
                AddRoute(
                    routes,
                    seen,
                    "CORP_FALLBACK",
                    new WebProxy(AgentConfig.CorporateProxyFallback) { Credentials = CredentialCache.DefaultNetworkCredentials },
                    target);
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
                    if (resolved != null && resolved != target)
                        key = resolved.Scheme + "://" + resolved.Host + ":" + resolved.Port;
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
