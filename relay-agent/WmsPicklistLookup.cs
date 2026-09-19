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
                   " picklist_codes=" + CandidateFieldCount;
        }
    }

    internal sealed class WmsPicklistSnapshotResult
    {
        internal string Result;
        internal string Route;
        internal int StatusCode;
        internal long ElapsedMs;
        internal int CandidateFieldCount;
        internal string SchemaFields;
        internal HashSet<string> TrailingFiveSuffixes = new HashSet<string>(StringComparer.Ordinal);
    }

    internal static class WmsPicklistLookupClient
    {
        private const int PageSize = 100;
        private const int AbsolutePageGuard = 10000;

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
            internal int PickListCodeCount;
            internal int ValidPickListCodeCount;
            internal int? TotalCount;
            internal int RecordCollectionCount = -1;
            internal readonly HashSet<string> SchemaFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            internal readonly HashSet<string> TrailingFiveSuffixes = new HashSet<string>(StringComparer.Ordinal);
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

            ValidateSuffix(suffix);

            long totalElapsedMs = 0;
            var totalPickListCodes = 0;
            var totalMatches = 0;
            var allFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string lastRoute = "NONE";
            var lastHttp = 0;
            string previousBodyFingerprint = null;

            for (var page = 1; page <= AbsolutePageGuard; page++)
            {
                var url = BuildLookupUrl(page);
                var payload = SendPage(url, session, page, ref totalElapsedMs);
                if (payload == null)
                    return new WmsPicklistLookupResult
                    {
                        Result = "TRANSPORT_FAIL",
                        Route = lastRoute,
                        StatusCode = lastHttp,
                        ElapsedMs = totalElapsedMs,
                        MatchCount = totalMatches,
                        CandidateFieldCount = totalPickListCodes
                    };

                lastRoute = payload.Route;
                lastHttp = payload.StatusCode;

                if (payload.Result != "PASS")
                    return new WmsPicklistLookupResult
                    {
                        Result = payload.Result,
                        Route = payload.Route,
                        StatusCode = payload.StatusCode,
                        ElapsedMs = totalElapsedMs,
                        MatchCount = totalMatches,
                        CandidateFieldCount = totalPickListCodes
                    };

                ResponseAnalysis analysis;
                try
                {
                    analysis = AnalyzePage(payload.Body, suffix);
                }
                catch (Exception ex)
                {
                    AgentDiagnostics.Write(
                        "WMS picklist-schema page=" + page +
                        " parse_fail=" + ex.GetType().Name +
                        " response_values=redacted");
                    return new WmsPicklistLookupResult
                    {
                        Result = "SCHEMA_UNSUPPORTED",
                        Route = payload.Route,
                        StatusCode = payload.StatusCode,
                        ElapsedMs = totalElapsedMs,
                        MatchCount = totalMatches,
                        CandidateFieldCount = totalPickListCodes
                    };
                }

                foreach (var field in analysis.SchemaFields)
                    if (allFields.Count < 80) allFields.Add(field);

                totalPickListCodes += analysis.PickListCodeCount;
                totalMatches += analysis.MatchCount;

                AgentDiagnostics.Write(
                    "WMS picklist-page page=" + page +
                    " result=PASS" +
                    " total=" + (analysis.TotalCount.HasValue ? analysis.TotalCount.Value.ToString() : "unknown") +
                    " records=" + analysis.RecordCollectionCount +
                    " picklist_codes=" + analysis.PickListCodeCount +
                    " valid_picklist_codes=" + analysis.ValidPickListCodeCount +
                    " matches=" + analysis.MatchCount +
                    " values=redacted");

                if (analysis.MatchCount > 0)
                    return BuildResult(
                        "FOUND",
                        payload,
                        totalElapsedMs,
                        totalMatches,
                        totalPickListCodes,
                        allFields);

                if (analysis.TotalCount.HasValue && analysis.TotalCount.Value == 0)
                    return BuildResult(
                        "NOT_FOUND",
                        payload,
                        totalElapsedMs,
                        0,
                        totalPickListCodes,
                        allFields);

                if (analysis.PickListCodeCount == 0)
                {
                    if (analysis.RecordCollectionCount == 0)
                        return BuildResult(
                            "NOT_FOUND",
                            payload,
                            totalElapsedMs,
                            0,
                            totalPickListCodes,
                            allFields);

                    AgentDiagnostics.Write(
                        "WMS picklist-schema result=SCHEMA_UNSUPPORTED reason=missing_exact_PickListCode page=" +
                        page + " values=redacted");
                    return BuildResult(
                        "SCHEMA_UNSUPPORTED",
                        payload,
                        totalElapsedMs,
                        0,
                        totalPickListCodes,
                        allFields);
                }

                if (analysis.ValidPickListCodeCount == 0)
                {
                    AgentDiagnostics.Write(
                        "WMS picklist-schema result=SCHEMA_UNSUPPORTED reason=PickListCode_format_unexpected page=" +
                        page + " values=redacted");
                    return BuildResult(
                        "SCHEMA_UNSUPPORTED",
                        payload,
                        totalElapsedMs,
                        0,
                        totalPickListCodes,
                        allFields);
                }

                if (IsLastPage(page, analysis))
                    return BuildResult(
                        "NOT_FOUND",
                        payload,
                        totalElapsedMs,
                        0,
                        totalPickListCodes,
                        allFields);

                var fingerprint = BodyFingerprint(payload.Body);
                if (page > 1 && !string.IsNullOrWhiteSpace(previousBodyFingerprint) &&
                    string.Equals(previousBodyFingerprint, fingerprint, StringComparison.Ordinal))
                {
                    AgentDiagnostics.Write(
                        "WMS picklist-pagination result=SCHEMA_UNSUPPORTED reason=repeated_page page=" +
                        page + " values=redacted");
                    return BuildResult(
                        "SCHEMA_UNSUPPORTED",
                        payload,
                        totalElapsedMs,
                        0,
                        totalPickListCodes,
                        allFields);
                }

                previousBodyFingerprint = fingerprint;
            }

            AgentDiagnostics.Write(
                "WMS picklist-pagination result=SCHEMA_UNSUPPORTED reason=absolute_page_guard values=redacted");
            return new WmsPicklistLookupResult
            {
                Result = "SCHEMA_UNSUPPORTED",
                Route = lastRoute,
                StatusCode = lastHttp,
                ElapsedMs = totalElapsedMs,
                MatchCount = totalMatches,
                CandidateFieldCount = totalPickListCodes,
                SchemaFields = JoinSafeFields(allFields)
            };
        }

        internal static WmsPicklistSnapshotResult LoadSnapshot(WmsSessionSnapshot session)
        {
            if (session == null || !session.IsValidHy1())
                return new WmsPicklistSnapshotResult
                {
                    Result = "WMS_SESSION_REQUIRED",
                    Route = "NONE",
                    StatusCode = 0,
                    ElapsedMs = 0
                };

            long totalElapsedMs = 0;
            var totalPickListCodes = 0;
            var allFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var suffixes = new HashSet<string>(StringComparer.Ordinal);
            string lastRoute = "NONE";
            var lastHttp = 0;
            string previousBodyFingerprint = null;

            for (var page = 1; page <= AbsolutePageGuard; page++)
            {
                var url = BuildLookupUrl(page);
                var payload = SendPage(url, session, page, ref totalElapsedMs);
                if (payload == null)
                    return SnapshotResult("TRANSPORT_FAIL", lastRoute, lastHttp, totalElapsedMs, totalPickListCodes, allFields, suffixes);

                lastRoute = payload.Route;
                lastHttp = payload.StatusCode;
                if (payload.Result != "PASS")
                    return SnapshotResult(payload.Result, payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);

                ResponseAnalysis analysis;
                try
                {
                    analysis = AnalyzePage(payload.Body, null);
                }
                catch (Exception ex)
                {
                    AgentDiagnostics.Write(
                        "WMS picklist-cache page=" + page +
                        " parse_fail=" + ex.GetType().Name +
                        " response_values=redacted");
                    return SnapshotResult("SCHEMA_UNSUPPORTED", payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);
                }

                foreach (var field in analysis.SchemaFields)
                    if (allFields.Count < 80) allFields.Add(field);
                foreach (var trailing in analysis.TrailingFiveSuffixes)
                    suffixes.Add(trailing);
                totalPickListCodes += analysis.PickListCodeCount;

                AgentDiagnostics.Write(
                    "WMS picklist-cache page=" + page +
                    " result=PASS" +
                    " total=" + (analysis.TotalCount.HasValue ? analysis.TotalCount.Value.ToString() : "unknown") +
                    " records=" + analysis.RecordCollectionCount +
                    " picklist_codes=" + analysis.PickListCodeCount +
                    " valid_picklist_codes=" + analysis.ValidPickListCodeCount +
                    " cached_suffixes=" + suffixes.Count +
                    " values=redacted");

                if (analysis.TotalCount.HasValue && analysis.TotalCount.Value == 0)
                    return SnapshotResult("PASS", payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);

                if (analysis.PickListCodeCount == 0)
                {
                    if (analysis.RecordCollectionCount == 0)
                        return SnapshotResult("PASS", payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);

                    AgentDiagnostics.Write(
                        "WMS picklist-cache result=SCHEMA_UNSUPPORTED reason=missing_exact_PickListCode page=" +
                        page + " values=redacted");
                    return SnapshotResult("SCHEMA_UNSUPPORTED", payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);
                }

                if (analysis.ValidPickListCodeCount == 0)
                {
                    AgentDiagnostics.Write(
                        "WMS picklist-cache result=SCHEMA_UNSUPPORTED reason=PickListCode_format_unexpected page=" +
                        page + " values=redacted");
                    return SnapshotResult("SCHEMA_UNSUPPORTED", payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);
                }

                if (IsLastPage(page, analysis))
                    return SnapshotResult("PASS", payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);

                var fingerprint = BodyFingerprint(payload.Body);
                if (page > 1 && !string.IsNullOrWhiteSpace(previousBodyFingerprint) &&
                    string.Equals(previousBodyFingerprint, fingerprint, StringComparison.Ordinal))
                {
                    AgentDiagnostics.Write(
                        "WMS picklist-cache result=SCHEMA_UNSUPPORTED reason=repeated_page page=" +
                        page + " values=redacted");
                    return SnapshotResult("SCHEMA_UNSUPPORTED", payload.Route, payload.StatusCode, totalElapsedMs, totalPickListCodes, allFields, suffixes);
                }

                previousBodyFingerprint = fingerprint;
            }

            AgentDiagnostics.Write(
                "WMS picklist-cache result=SCHEMA_UNSUPPORTED reason=absolute_page_guard values=redacted");
            return SnapshotResult("SCHEMA_UNSUPPORTED", lastRoute, lastHttp, totalElapsedMs, totalPickListCodes, allFields, suffixes);
        }

        private static WmsPicklistSnapshotResult SnapshotResult(
            string result,
            string route,
            int statusCode,
            long elapsedMs,
            int pickListCodeCount,
            HashSet<string> fields,
            HashSet<string> suffixes)
        {
            return new WmsPicklistSnapshotResult
            {
                Result = result,
                Route = route,
                StatusCode = statusCode,
                ElapsedMs = elapsedMs,
                CandidateFieldCount = pickListCodeCount,
                SchemaFields = JoinSafeFields(fields),
                TrailingFiveSuffixes = new HashSet<string>(suffixes ?? new HashSet<string>(), StringComparer.Ordinal)
            };
        }

        private static void ValidateSuffix(string suffix)
        {
            if (string.IsNullOrWhiteSpace(suffix) || suffix.Length != 5)
                throw new ArgumentException("Picklist suffix must contain exactly five digits.", "suffix");
            foreach (var ch in suffix)
                if (ch < '0' || ch > '9')
                    throw new ArgumentException("Picklist suffix must contain exactly five digits.", "suffix");
        }

        private static string BuildLookupUrl(int page)
        {
            var filter = new Dictionary<string, object>
            {
                { "WarehouseCode", "HY1" },
                { "WarehouseSiteId", "" },
                { "ClientCode", "WIN" },
                { "FromDate", "" },
                { "ToDate", "" },
                { "Content", "" },
                { "Employee", "" },
                { "IsAllowSkipped", "" }
            };
            var sort = new Dictionary<string, object> { { "CreatedDate", "desc" } };
            return AgentConfig.WmsPicklistLookupUrl +
                   "?filter=" + Uri.EscapeDataString(Json.Serialize(filter)) +
                   "&page=" + page +
                   "&limit=" + PageSize +
                   "&PageIndex=" + page +
                   "&RecordsPerPage=" + PageSize +
                   "&regionCode=null" +
                   "&sort=" + Uri.EscapeDataString(Json.Serialize(sort));
        }

        private static HttpPayload SendPage(string url, WmsSessionSnapshot session, int page, ref long totalElapsedMs)
        {
            HttpPayload last = null;
            foreach (var route in BuildRoutes(new Uri(url)))
            {
                var payload = SendOne(url, session, route);
                last = payload;
                totalElapsedMs += Math.Max(0, payload.ElapsedMs);

                AgentDiagnostics.Write(
                    "WMS picklist-lookup result=" + payload.Result +
                    " route=" + payload.Route +
                    " http=" + payload.StatusCode +
                    " ms=" + payload.ElapsedMs +
                    " page=" + page +
                    " limit=" + PageSize +
                    " query=no_date_content_empty session_values=redacted");

                if (payload.Result == "TRANSPORT_FAIL" || payload.Result == "PROXY_AUTH_REQUIRED")
                    continue;

                return payload;
            }
            return last;
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

        private static ResponseAnalysis AnalyzePage(string body, string suffix)
        {
            var root = Json.DeserializeObject(body ?? "");
            var analysis = new ResponseAnalysis();
            AnalyzeNode(root, null, suffix, analysis, 0);
            return analysis;
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
                        if (TryInt(pair.Value, out total) && total >= 0)
                            result.TotalCount = total;
                    }

                    if (string.Equals(field, "PickListCode", StringComparison.OrdinalIgnoreCase))
                    {
                        var value = pair.Value == null ? "" : Convert.ToString(pair.Value);
                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            result.PickListCodeCount++;
                            if (IsValidPickListCode(value))
                            {
                                result.ValidPickListCodeCount++;
                                var trailing = TrailingFiveDigits(value);
                                if (!string.IsNullOrWhiteSpace(trailing))
                                    result.TrailingFiveSuffixes.Add(trailing);
                                if (!string.IsNullOrWhiteSpace(suffix) && trailing == suffix)
                                    result.MatchCount++;
                            }
                        }
                    }

                    AnalyzeNode(pair.Value, field, suffix, result, depth + 1);
                }
                return;
            }

            var array = node as object[];
            if (array != null)
            {
                if (IsRecordCollectionField(key))
                    result.RecordCollectionCount = Math.Max(result.RecordCollectionCount, array.Length);
                foreach (var item in array)
                    AnalyzeNode(item, key, suffix, result, depth + 1);
                return;
            }

            var list = node as ArrayList;
            if (list != null)
            {
                if (IsRecordCollectionField(key))
                    result.RecordCollectionCount = Math.Max(result.RecordCollectionCount, list.Count);
                foreach (var item in list)
                    AnalyzeNode(item, key, suffix, result, depth + 1);
            }
        }

        private static bool IsLastPage(int page, ResponseAnalysis analysis)
        {
            if (analysis.TotalCount.HasValue)
                return page * PageSize >= analysis.TotalCount.Value;

            if (analysis.RecordCollectionCount >= 0)
                return Math.Max(analysis.RecordCollectionCount, analysis.PickListCodeCount) < PageSize;

            return analysis.PickListCodeCount < PageSize;
        }

        private static bool IsRecordCollectionField(string field)
        {
            if (string.IsNullOrWhiteSpace(field)) return true;
            var normalized = NormalizeField(field);
            return normalized == "data" ||
                   normalized == "items" ||
                   normalized == "records" ||
                   normalized == "rows" ||
                   normalized == "results" ||
                   normalized == "result" ||
                   normalized == "list";
        }

        private static bool IsTotalField(string normalized)
        {
            return normalized == "total" ||
                   normalized == "totalcount" ||
                   normalized == "totalrecords" ||
                   normalized == "recordcount" ||
                   normalized == "recordscount";
        }

        private static bool IsValidPickListCode(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            var text = value.Trim();
            if (text.Length < 7 || !text.StartsWith("PL", StringComparison.OrdinalIgnoreCase))
                return false;

            for (var i = 2; i < text.Length; i++)
                if (text[i] < '0' || text[i] > '9')
                    return false;
            return true;
        }

        private static string TrailingFiveDigits(string value)
        {
            if (!IsValidPickListCode(value)) return "";
            var text = value.Trim();
            return text.Substring(text.Length - 5, 5);
        }

        private static WmsPicklistLookupResult BuildResult(
            string result,
            HttpPayload payload,
            long elapsedMs,
            int matchCount,
            int pickListCodeCount,
            HashSet<string> fields)
        {
            return new WmsPicklistLookupResult
            {
                Result = result,
                Route = payload.Route,
                StatusCode = payload.StatusCode,
                ElapsedMs = elapsedMs,
                MatchCount = matchCount,
                CandidateFieldCount = pickListCodeCount,
                SchemaFields = JoinSafeFields(fields)
            };
        }

        private static string JoinSafeFields(HashSet<string> source)
        {
            var fields = new List<string>(source);
            fields.Sort(StringComparer.OrdinalIgnoreCase);
            if (fields.Count > 30) fields.RemoveRange(30, fields.Count - 30);
            return string.Join(",", fields.ToArray());
        }

        private static string BodyFingerprint(string body)
        {
            using (var sha = SHA256.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(body ?? "");
                var hash = sha.ComputeHash(bytes);
                var sb = new StringBuilder(hash.Length * 2);
                foreach (var item in hash) sb.Append(item.ToString("x2"));
                return sb.ToString();
            }
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
