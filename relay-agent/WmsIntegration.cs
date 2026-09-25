using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class WmsSessionSnapshot
    {
        internal string Authorization;
        internal string Token;
        internal string APISID;
        internal string AppID;
        internal string SID;
        internal string SCID;
        internal string USID;
        internal string Warehouse;
        internal string XGeoRegion;
        internal string Origin;
        internal string Referer;
        internal DateTime CapturedUtc;

        internal bool IsValidHy1()
        {
            return !string.IsNullOrWhiteSpace(Authorization) &&
                   !string.IsNullOrWhiteSpace(Token) &&
                   !string.IsNullOrWhiteSpace(APISID) &&
                   !string.IsNullOrWhiteSpace(SID) &&
                   !string.IsNullOrWhiteSpace(SCID) &&
                   !string.IsNullOrWhiteSpace(USID) &&
                   USID.StartsWith("hy1", StringComparison.OrdinalIgnoreCase);
        }
    }

    internal sealed class WmsProbeResult
    {
        internal string Name;
        internal string Result;
        internal string Route;
        internal int StatusCode;
        internal long ElapsedMs;
        internal string Host;

        internal string Summary()
        {
            return Name + "=" + Result +
                   (StatusCode > 0 ? "(" + StatusCode + ")" : "") +
                   (string.IsNullOrWhiteSpace(Route) ? "" : "/" + Route) +
                   (ElapsedMs >= 0 ? "/" + ElapsedMs + "ms" : "");
        }
    }

    internal static class WmsBrowserCapture
    {
        private sealed class BrowserCandidate
        {
            internal string Name;
            internal string Path;
            internal string ProfileKey;
        }

        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static readonly string[] RequiredHeaders =
        {
            "Authorization", "Token", "APISID", "SID", "SCID", "USID"
        };

        internal static WmsSessionSnapshot CaptureSession(int timeoutSeconds, Action<string> progress)
        {
            var browser = FindSupportedBrowser();
            if (browser == null)
                throw new InvalidOperationException("Không tìm thấy Microsoft Edge hoặc Google Chrome. Cần ít nhất một trình duyệt Chromium được hỗ trợ để Agent tự lấy phiên WMS.");

            var port = FindFreeLoopbackPort();
            var profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SUPRA Inventory", "WmsBrowser", browser.ProfileKey);
            Directory.CreateDirectory(profileDir);

            var args =
                "--remote-debugging-address=127.0.0.1 " +
                "--remote-debugging-port=" + port + " " +
                "--user-data-dir=\"" + profileDir.Replace("\"", "") + "\" " +
                "--no-first-run --no-default-browser-check " +
                "--new-window \"" + AgentConfig.WmsUiUrl + "\"";

            var process = Process.Start(new ProcessStartInfo
            {
                FileName = browser.Path,
                Arguments = args,
                UseShellExecute = true
            });
            if (process == null)
                throw new InvalidOperationException("Không mở được " + browser.Name + " cho phiên WMS.");

            AgentDiagnostics.Write("WMS browser-start loopback=127.0.0.1 profile=dedicated browser=" + browser.Name);
            if (progress != null)
                progress("Đã mở " + browser.Name + " WMS riêng. Có tối đa 5 phút để đăng nhập nếu được yêu cầu; Agent đang tự lấy phiên.");

            ClientWebSocket socket = null;
            try
            {
                var target = WaitForPageTarget(port, TimeSpan.FromSeconds(20));
                socket = new ClientWebSocket();
                socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
                socket.ConnectAsync(new Uri(target), CancellationToken.None).GetAwaiter().GetResult();
                Send(socket, "{\"id\":1,\"method\":\"Network.enable\"}");

                var requestHosts = new Dictionary<string, bool>(StringComparer.Ordinal);
                var pendingExtraHeaders = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
                var captured = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var deadline = DateTime.UtcNow.AddSeconds(Math.Max(30, timeoutSeconds));

                while (DateTime.UtcNow < deadline)
                {
                    var remaining = deadline - DateTime.UtcNow;
                    var message = Receive(socket, remaining);
                    if (message == null) continue;

                    Dictionary<string, object> evt;
                    try { evt = Json.DeserializeObject(message) as Dictionary<string, object>; }
                    catch { continue; }
                    if (evt == null) continue;

                    object methodValue;
                    if (!evt.TryGetValue("method", out methodValue)) continue;
                    var method = Convert.ToString(methodValue);

                    object paramsValue;
                    var parameters = evt.TryGetValue("params", out paramsValue) ? paramsValue as Dictionary<string, object> : null;
                    if (parameters == null) continue;

                    if (string.Equals(method, "Network.requestWillBeSent", StringComparison.Ordinal))
                    {
                        var requestId = StringValue(parameters, "requestId");
                        object requestValue;
                        var request = parameters.TryGetValue("request", out requestValue) ? requestValue as Dictionary<string, object> : null;
                        if (request == null) continue;
                        var url = StringValue(request, "url");
                        if (!IsSupraApiUrl(url)) continue;

                        if (!string.IsNullOrWhiteSpace(requestId))
                            requestHosts[requestId] = true;

                        MergeHeaders(captured, HeaderMap(request));
                        Dictionary<string, object> pending;
                        if (!string.IsNullOrWhiteSpace(requestId) && pendingExtraHeaders.TryGetValue(requestId, out pending))
                        {
                            MergeHeaders(captured, pending);
                            pendingExtraHeaders.Remove(requestId);
                        }
                    }
                    else if (string.Equals(method, "Network.requestWillBeSentExtraInfo", StringComparison.Ordinal))
                    {
                        var requestId = StringValue(parameters, "requestId");
                        object headersValue;
                        var headers = parameters.TryGetValue("headers", out headersValue) ? headersValue as Dictionary<string, object> : null;
                        if (headers == null || string.IsNullOrWhiteSpace(requestId)) continue;

                        if (requestHosts.ContainsKey(requestId))
                            MergeHeaders(captured, headers);
                        else
                            pendingExtraHeaders[requestId] = headers;
                    }

                    if (HasRequired(captured))
                    {
                        var snapshot = BuildSnapshot(captured);
                        if (!snapshot.IsValidHy1())
                            throw new InvalidOperationException("Đã bắt được phiên nhưng USID không thuộc HY1.");

                        AgentDiagnostics.Write(
                            "WMS session-capture PASS host=api-supra.winmart.vn headers=" +
                            string.Join(",", RequiredHeaders) +
                            " usid_scope=HY1 values=redacted");
                        if (progress != null)
                            progress("Tự lấy phiên WMS PASS (HY1). Không lưu giá trị phiên vào log/GitHub.");
                        TryCloseBrowser(socket, process);
                        socket = null;
                        return snapshot;
                    }
                }

                var missing = MissingHeaders(captured);
                AgentDiagnostics.Write("WMS session-capture TIMEOUT missing=" + string.Join(",", missing) + " values=redacted");
                throw new TimeoutException(
                    "Chưa bắt được phiên WMS hợp lệ. Hãy đăng nhập WMS và mở một màn hình có tải dữ liệu Supra. Thiếu: " +
                    string.Join(", ", missing));
            }
            finally
            {
                if (socket != null)
                {
                    TryCloseBrowser(socket, process);
                    try { socket.Dispose(); } catch { }
                }
            }
        }

        private static BrowserCandidate FindSupportedBrowser()
        {
            var pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            var pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            var candidates = new[]
            {
                new BrowserCandidate { Name = "Microsoft Edge", ProfileKey = "edge", Path = Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe") },
                new BrowserCandidate { Name = "Microsoft Edge", ProfileKey = "edge", Path = Path.Combine(pf, "Microsoft", "Edge", "Application", "msedge.exe") },
                new BrowserCandidate { Name = "Microsoft Edge", ProfileKey = "edge", Path = Path.Combine(local, "Microsoft", "Edge", "Application", "msedge.exe") },
                new BrowserCandidate { Name = "Google Chrome", ProfileKey = "chrome", Path = Path.Combine(pf, "Google", "Chrome", "Application", "chrome.exe") },
                new BrowserCandidate { Name = "Google Chrome", ProfileKey = "chrome", Path = Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe") },
                new BrowserCandidate { Name = "Google Chrome", ProfileKey = "chrome", Path = Path.Combine(local, "Google", "Chrome", "Application", "chrome.exe") }
            };

            foreach (var candidate in candidates)
                if (!string.IsNullOrWhiteSpace(candidate.Path) && File.Exists(candidate.Path)) return candidate;
            return null;
        }

        private static int FindFreeLoopbackPort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        private static string WaitForPageTarget(int port, TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow.Add(timeout);
            Exception last = null;
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/json/list");
                    req.Method = "GET";
                    req.Proxy = null;
                    req.Timeout = 1500;
                    using (var response = (HttpWebResponse)req.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream()))
                    {
                        var raw = reader.ReadToEnd();
                        var items = Json.DeserializeObject(raw) as object[];
                        if (items != null)
                        {
                            string fallback = null;
                            foreach (var item in items)
                            {
                                var map = item as Dictionary<string, object>;
                                if (map == null) continue;
                                if (!string.Equals(StringValue(map, "type"), "page", StringComparison.OrdinalIgnoreCase)) continue;
                                var ws = StringValue(map, "webSocketDebuggerUrl");
                                if (string.IsNullOrWhiteSpace(ws)) continue;
                                if (fallback == null) fallback = ws;
                                var url = StringValue(map, "url");
                                if (url.IndexOf("wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase) >= 0)
                                    return ws;
                            }
                            if (!string.IsNullOrWhiteSpace(fallback)) return fallback;
                        }
                    }
                }
                catch (Exception ex)
                {
                    last = ex;
                }
                Thread.Sleep(250);
            }
            throw new InvalidOperationException("Trình duyệt WMS đã mở nhưng Agent không kết nối được DevTools loopback.", last);
        }

        private static void Send(ClientWebSocket socket, string value)
        {
            var bytes = Encoding.UTF8.GetBytes(value);
            socket.SendAsync(
                new ArraySegment<byte>(bytes),
                WebSocketMessageType.Text,
                true,
                CancellationToken.None).GetAwaiter().GetResult();
        }

        private static string Receive(ClientWebSocket socket, TimeSpan timeout)
        {
            if (timeout <= TimeSpan.Zero) return null;
            using (var cts = new CancellationTokenSource(timeout))
            using (var buffer = new MemoryStream())
            {
                try
                {
                    var chunk = new byte[16 * 1024];
                    while (true)
                    {
                        var result = socket.ReceiveAsync(new ArraySegment<byte>(chunk), cts.Token).GetAwaiter().GetResult();
                        if (result.MessageType == WebSocketMessageType.Close) return null;
                        if (result.Count > 0) buffer.Write(chunk, 0, result.Count);
                        if (result.EndOfMessage) break;
                    }
                    return Encoding.UTF8.GetString(buffer.ToArray());
                }
                catch (OperationCanceledException)
                {
                    return null;
                }
            }
        }

        private static Dictionary<string, object> HeaderMap(Dictionary<string, object> request)
        {
            object value;
            return request.TryGetValue("headers", out value)
                ? value as Dictionary<string, object>
                : null;
        }

        private static void MergeHeaders(Dictionary<string, string> target, Dictionary<string, object> headers)
        {
            if (headers == null) return;
            foreach (var pair in headers)
            {
                var value = Convert.ToString(pair.Value);
                if (!string.IsNullOrWhiteSpace(value))
                    target[pair.Key] = value;
            }
        }

        private static bool HasRequired(Dictionary<string, string> headers)
        {
            string authorization, token;
            headers.TryGetValue("Authorization", out authorization);
            headers.TryGetValue("Token", out token);
            if (string.IsNullOrWhiteSpace(authorization)) authorization = token;
            if (string.IsNullOrWhiteSpace(token)) token = authorization;
            if (string.IsNullOrWhiteSpace(authorization) || string.IsNullOrWhiteSpace(token)) return false;

            foreach (var key in new[] { "APISID", "SID", "SCID", "USID" })
            {
                string value;
                if (!headers.TryGetValue(key, out value) || string.IsNullOrWhiteSpace(value)) return false;
            }
            return true;
        }

        private static string[] MissingHeaders(Dictionary<string, string> headers)
        {
            var missing = new List<string>();
            string authorization, token;
            headers.TryGetValue("Authorization", out authorization);
            headers.TryGetValue("Token", out token);
            if (string.IsNullOrWhiteSpace(authorization) && string.IsNullOrWhiteSpace(token))
            {
                missing.Add("Authorization");
                missing.Add("Token");
            }
            foreach (var key in new[] { "APISID", "SID", "SCID", "USID" })
            {
                string value;
                if (!headers.TryGetValue(key, out value) || string.IsNullOrWhiteSpace(value)) missing.Add(key);
            }
            return missing.ToArray();
        }

        private static WmsSessionSnapshot BuildSnapshot(Dictionary<string, string> headers)
        {
            string authorization, token, value;
            headers.TryGetValue("Authorization", out authorization);
            headers.TryGetValue("Token", out token);
            if (string.IsNullOrWhiteSpace(authorization)) authorization = token;
            if (string.IsNullOrWhiteSpace(token)) token = authorization;

            var snapshot = new WmsSessionSnapshot
            {
                Authorization = authorization ?? "",
                Token = token ?? "",
                CapturedUtc = DateTime.UtcNow
            };
            snapshot.APISID = headers.TryGetValue("APISID", out value) ? value : "";
            snapshot.AppID = headers.TryGetValue("AppID", out value) ? value : "unknown";
            snapshot.SID = headers.TryGetValue("SID", out value) ? value : "";
            snapshot.SCID = headers.TryGetValue("SCID", out value) ? value : "";
            snapshot.USID = headers.TryGetValue("USID", out value) ? value : "";
            snapshot.Warehouse = headers.TryGetValue("Warehouse", out value) ? value : "HY1";
            snapshot.XGeoRegion = headers.TryGetValue("X-Geo-Region", out value) ? value : "";
            snapshot.Origin = headers.TryGetValue("Origin", out value) ? value : AgentConfig.WmsOrigin;
            snapshot.Referer = headers.TryGetValue("Referer", out value) ? value : AgentConfig.WmsReferer;
            return snapshot;
        }

        private static bool IsSupraApiUrl(string url)
        {
            Uri uri;
            return Uri.TryCreate(url, UriKind.Absolute, out uri) &&
                   string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(uri.Host, "api-supra.winmart.vn", StringComparison.OrdinalIgnoreCase);
        }

        private static string StringValue(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) : "";
        }

        private static void TryCloseBrowser(ClientWebSocket socket, Process process)
        {
            try
            {
                if (socket != null && socket.State == WebSocketState.Open)
                    Send(socket, "{\"id\":9999,\"method\":\"Browser.close\"}");
            }
            catch { }
            try
            {
                if (socket != null) socket.Dispose();
            }
            catch { }
            try
            {
                if (process != null && !process.HasExited)
                    process.CloseMainWindow();
            }
            catch { }
        }
    }

    internal static class WmsReadOnlyClient
    {
        private sealed class Route
        {
            internal string Name;
            internal IWebProxy Proxy;
        }

        internal static WmsProbeResult ProbeUi()
        {
            return SendAcrossRoutes(
                "WMS_UI",
                AgentConfig.WmsUiUrl,
                null,
                null,
                false);
        }

        internal static WmsProbeResult ProbeApi(WmsSessionSnapshot session)
        {
            if (session == null || !session.IsValidHy1())
                throw new InvalidOperationException("Chưa có phiên WMS HY1 hợp lệ trong RAM.");

            return SendAcrossRoutes(
                "SUPRA_API",
                AgentConfig.WmsApiProbeUrl,
                AgentConfig.WmsApiProbeSignPath,
                session,
                true);
        }

        internal static string GetSignedJson(
            string url,
            string signPath,
            WmsSessionSnapshot session,
            int maxBytes = 16 * 1024 * 1024)
        {
            if (session == null || !session.IsValidHy1())
                throw new InvalidOperationException("Chưa có phiên WMS HY1 hợp lệ trong RAM.");
            if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(signPath))
                throw new InvalidOperationException("Thiếu endpoint WMS read-only.");
            if (maxBytes < 1024 || maxBytes > 32 * 1024 * 1024)
                throw new InvalidOperationException("Giới hạn dữ liệu WMS không hợp lệ.");

            Exception lastTransport = null;
            foreach (var route in BuildRoutes(new Uri(url)))
            {
                var started = Stopwatch.StartNew();
                var uri = new Uri(url);
                var request = (HttpWebRequest)WebRequest.Create(uri);
                request.Method = "GET";
                request.Proxy = route.Proxy;
                request.Timeout = 20000;
                request.ReadWriteTimeout = 40000;
                request.AllowAutoRedirect = false;
                request.KeepAlive = false;
                request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";
                request.Accept = "application/json, text/plain, */*";
                ApplySessionHeaders(request, session);
                var signature = CreateSignature(signPath);
                request.Headers["X-Signature"] = signature.Item1;
                request.Headers["X-Signature-Nonce"] = signature.Item2;

                try
                {
                    using (var response = (HttpWebResponse)request.GetResponse())
                    {
                        var status = (int)response.StatusCode;
                        var body = ReadBoundedBody(response.GetResponseStream(), maxBytes);
                        started.Stop();
                        AgentDiagnostics.Write(
                            "WMS READ PASS host=" + uri.Host +
                            " path=" + signPath +
                            " route=" + route.Name +
                            " http=" + status +
                            " bytes=" + Encoding.UTF8.GetByteCount(body) +
                            " ms=" + started.ElapsedMilliseconds +
                            " session_values=redacted");
                        if (status < 200 || status >= 300)
                            throw new InvalidOperationException("WMS read HTTP " + status + ".");
                        if (LooksLikeProxyBlock(body))
                            throw new InvalidOperationException("WMS read bị proxy chặn.");
                        return body;
                    }
                }
                catch (WebException ex)
                {
                    started.Stop();
                    var response = ex.Response as HttpWebResponse;
                    if (response == null)
                    {
                        lastTransport = ex;
                        AgentDiagnostics.Write(
                            "WMS READ transport_fail host=" + uri.Host +
                            " path=" + signPath +
                            " route=" + route.Name +
                            " type=" + ex.Status +
                            " session_values=redacted");
                        continue;
                    }

                    var status = (int)response.StatusCode;
                    try { response.Dispose(); } catch { }
                    if (status == 407)
                    {
                        lastTransport = ex;
                        continue;
                    }
                    if (status == 401)
                        throw new InvalidOperationException("Phiên Supra WMS đã hết hạn.");
                    if (status == 403)
                        throw new InvalidOperationException("Supra WMS từ chối quyền đọc dữ liệu.");
                    throw new InvalidOperationException("WMS read HTTP " + status + ".");
                }
            }

            throw new InvalidOperationException(
                "Không kết nối được API Supra qua các route được phép.",
                lastTransport);
        }

        private static string ReadBoundedBody(Stream stream, int maxBytes)
        {
            if (stream == null) return "";
            using (var buffer = new MemoryStream())
            {
                var chunk = new byte[8192];
                while (true)
                {
                    var read = stream.Read(chunk, 0, chunk.Length);
                    if (read <= 0) break;
                    if (buffer.Length + read > maxBytes)
                        throw new InvalidOperationException("Dữ liệu WMS vượt giới hạn an toàn.");
                    buffer.Write(chunk, 0, read);
                }
                return Encoding.UTF8.GetString(buffer.ToArray());
            }
        }

        private static WmsProbeResult SendAcrossRoutes(
            string name,
            string url,
            string signPath,
            WmsSessionSnapshot session,
            bool signed)
        {
            WmsProbeResult last = null;
            foreach (var route in BuildRoutes(new Uri(url)))
            {
                var result = SendOne(name, url, signPath, session, signed, route);
                last = result;
                AgentDiagnostics.Write(
                    "WMS probe name=" + name +
                    " result=" + result.Result +
                    " route=" + result.Route +
                    " http=" + result.StatusCode +
                    " host=" + result.Host +
                    " ms=" + result.ElapsedMs +
                    " session_values=redacted");

                if (string.Equals(result.Result, "TRANSPORT_FAIL", StringComparison.Ordinal) ||
                    string.Equals(result.Result, "PROXY_AUTH_REQUIRED", StringComparison.Ordinal))
                    continue;
                return result;
            }
            return last ?? new WmsProbeResult
            {
                Name = name,
                Result = "TRANSPORT_FAIL",
                Route = "NONE",
                StatusCode = 0,
                ElapsedMs = -1,
                Host = new Uri(url).Host
            };
        }

        private static WmsProbeResult SendOne(
            string name,
            string url,
            string signPath,
            WmsSessionSnapshot session,
            bool signed,
            Route route)
        {
            var started = Stopwatch.StartNew();
            var uri = new Uri(url);
            var request = (HttpWebRequest)WebRequest.Create(uri);
            request.Method = "GET";
            request.Proxy = route.Proxy;
            request.Timeout = 15000;
            request.ReadWriteTimeout = 30000;
            request.AllowAutoRedirect = false;
            request.KeepAlive = false;
            request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";
            request.Accept = "application/json, text/plain, */*";

            if (signed)
            {
                ApplySessionHeaders(request, session);
                var signature = CreateSignature(signPath);
                request.Headers["X-Signature"] = signature.Item1;
                request.Headers["X-Signature-Nonce"] = signature.Item2;
            }

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    var sample = ReadSample(response.GetResponseStream());
                    started.Stop();
                    return ResultFromHttp(name, route.Name, uri.Host, (int)response.StatusCode, started.ElapsedMilliseconds, sample);
                }
            }
            catch (WebException ex)
            {
                started.Stop();
                var response = ex.Response as HttpWebResponse;
                if (response == null)
                {
                    return new WmsProbeResult
                    {
                        Name = name,
                        Result = "TRANSPORT_FAIL",
                        Route = route.Name,
                        StatusCode = 0,
                        ElapsedMs = started.ElapsedMilliseconds,
                        Host = uri.Host
                    };
                }

                var status = (int)response.StatusCode;
                var sample = "";
                try
                {
                    using (response)
                        sample = ReadSample(response.GetResponseStream());
                }
                catch { }
                return ResultFromHttp(name, route.Name, uri.Host, status, started.ElapsedMilliseconds, sample);
            }
        }

        private static WmsProbeResult ResultFromHttp(
            string name,
            string route,
            string host,
            int status,
            long elapsedMs,
            string sample)
        {
            var result = "HTTP_ERROR";
            if (LooksLikeProxyBlock(sample)) result = "PROXY_BLOCK";
            else if (status >= 200 && status < 300) result = "PASS";
            else if (status == 401) result = "SESSION_EXPIRED";
            else if (status == 403) result = "FORBIDDEN";
            else if (status == 407) result = "PROXY_AUTH_REQUIRED";
            else if (status == 408) result = "TIMEOUT";
            else if (status == 429) result = "RATE_LIMITED";
            else if (status >= 500) result = "SERVER_ERROR";
            else if (status >= 300 && status < 400) result = "REACHABLE_REDIRECT";
            else if (status == 400) result = "BAD_REQUEST";

            return new WmsProbeResult
            {
                Name = name,
                Result = result,
                Route = route,
                StatusCode = status,
                ElapsedMs = elapsedMs,
                Host = host
            };
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
            {
                var proxy = new WebProxy(envUri) { Credentials = CredentialCache.DefaultNetworkCredentials };
                AddRoute(routes, seen, "ENV", proxy, target);
            }

            AddRoute(routes, seen, "DIRECT", null, target);

            try
            {
                var fallback = new WebProxy(AgentConfig.CorporateProxyFallback)
                {
                    Credentials = CredentialCache.DefaultNetworkCredentials
                };
                AddRoute(routes, seen, "CORP_FALLBACK", fallback, target);
            }
            catch { }

            return routes;
        }

        private static void AddRoute(
            List<Route> routes,
            HashSet<string> seen,
            string name,
            IWebProxy proxy,
            Uri target)
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
                catch
                {
                    key = name;
                }
            }
            if (!seen.Add(key)) return;
            routes.Add(new Route { Name = name, Proxy = proxy });
        }

        private static string ReadSample(Stream stream)
        {
            if (stream == null) return "";
            try
            {
                using (var reader = new StreamReader(stream))
                {
                    var buffer = new char[4096];
                    var read = reader.ReadBlock(buffer, 0, buffer.Length);
                    return read <= 0 ? "" : new string(buffer, 0, read);
                }
            }
            catch { return ""; }
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
