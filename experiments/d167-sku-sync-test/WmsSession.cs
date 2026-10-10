using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace D167SkuSyncTest
{
    // Controls ONLY an Edge process/profile launched by this standalone tester.
    // Secrets captured from the user's own authorized WMS session are RAM-only.
    internal sealed class WmsSession : IDisposable
    {
        private readonly object gate = new object();
        private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
        private readonly Action<string> log;
        private ClientWebSocket socket;
        private CancellationTokenSource stop;
        private Process browser;
        private int port;
        private int seq;
        private Dictionary<string, string> headers;
        private readonly Dictionary<string, bool> allowedRequests = new Dictionary<string, bool>();
        private readonly Dictionary<string, Dictionary<string, object>> pendingExtraInfo =
            new Dictionary<string, Dictionary<string, object>>();

        internal WmsSession(Action<string> note) { log = note; }
        internal bool IsOpen { get { return browser != null && !browser.HasExited; } }

        internal void Open()
        {
            if (IsOpen) return;
            var edge = new[] {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe")
            }.FirstOrDefault(File.Exists);
            if (edge == null) throw new AppError("EDGE_NOT_INSTALLED");
            port = FreePort();
            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SUPRA Inventory", "D167-SKU-Test", "supra-browser");
            Directory.CreateDirectory(profile);
            var args = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" + port +
                " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check" +
                " --new-window \"https://wms-supra.winmart.vn/sft3/app/dashboard\"";
            browser = Process.Start(new ProcessStartInfo(edge, args) { UseShellExecute = true });
            if (browser == null) throw new AppError("EDGE_START_FAILED");
            lock (gate) { headers = null; allowedRequests.Clear(); pendingExtraInfo.Clear(); }
            var target = WaitTarget(TimeSpan.FromSeconds(15));
            socket = new ClientWebSocket();
            socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(15);
            socket.ConnectAsync(new Uri(target), CancellationToken.None).GetAwaiter().GetResult();
            stop = new CancellationTokenSource();
            Task.Run(() => Pump(stop.Token));
            Send("Network.enable", new Dictionary<string, object> {
                { "maxTotalBufferSize", 2 * 1024 * 1024 },
                { "maxResourceBufferSize", 1024 * 1024 }
            });
            Send("Page.enable", new Dictionary<string, object>());
        }

        internal Dictionary<string, string> AuthorizedRequestHeaders()
        {
            if (!IsOpen || socket == null) throw new AppError("SUPRA_BROWSER_NOT_READY");
            Dictionary<string, string> current = Snapshot();
            if (current != null) return current;
            // Request one normal WMS UI reload in the tester's browser.
            // Authentication is still performed interactively by the user.
            Send("Page.reload", new Dictionary<string, object>{{"ignoreCache", false}});
            for (int i=0;i<120;i++)
            {
                Thread.Sleep(250);
                current = Snapshot();
                if (current != null) return current;
            }
            throw new AppError("SUPRA_AUTH_HEADERS_NOT_OBSERVED__NAVIGATE_WMS_PAGE_AND_RETRY");
        }

        private Dictionary<string,string> Snapshot()
        {
            lock (gate) return headers == null ? null : new Dictionary<string,string>(headers, StringComparer.OrdinalIgnoreCase);
        }

        private static int FreePort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var p = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return p;
        }

        private string WaitTarget(TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow.Add(timeout);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/json/list");
                    req.Proxy = null;
                    req.Timeout = 1000;
                    using (var response = (HttpWebResponse)req.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream()))
                    {
                        var arr = json.DeserializeObject(reader.ReadToEnd()) as object[];
                        if (arr != null)
                        {
                            string fallback = null;
                            foreach (var o in arr)
                            {
                                var item = o as Dictionary<string,object>;
                                if (item == null || S(item,"type") != "page") continue;
                                var ws = S(item,"webSocketDebuggerUrl");
                                if (String.IsNullOrWhiteSpace(ws)) continue;
                                if (fallback == null) fallback = ws;
                                if (S(item,"url").Contains("wms-supra.winmart.vn")) return ws;
                            }
                            if (fallback != null) return fallback;
                        }
                    }
                }
                catch (WebException) { }
                catch (InvalidOperationException) { }
                Thread.Sleep(200);
            }
            throw new AppError("SUPRA_DEVTOOLS_CONNECT_TIMEOUT");
        }

        private void Send(string method, Dictionary<string,object> parameters)
        {
            var wire = json.Serialize(new Dictionary<string,object> {
                { "id", Interlocked.Increment(ref seq) }, { "method",method }, { "params",parameters }
            });
            var bytes = Encoding.UTF8.GetBytes(wire);
            // Commands from UI startup and one worker call only.
            lock (gate)
                socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None)
                    .GetAwaiter().GetResult();
        }

        private async Task Pump(CancellationToken token)
        {
            try
            {
                var buffer = new byte[65536];
                while (!token.IsCancellationRequested && socket != null && socket.State == WebSocketState.Open)
                {
                    using (var stream = new MemoryStream())
                    {
                        WebSocketReceiveResult recv;
                        do
                        {
                            recv = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                            if (recv.MessageType == WebSocketMessageType.Close) return;
                            stream.Write(buffer,0,recv.Count);
                            if (stream.Length > 4*1024*1024) throw new AppError("CDP_MESSAGE_TOO_LARGE");
                        } while (!recv.EndOfMessage);
                        var eventText = Encoding.UTF8.GetString(stream.ToArray());
                        Observe(eventText);
                    }
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { log("SUPRA giám sát phiên ngắt: " + ex.GetType().Name); }
        }

        private void Observe(string data)
        {
            try
            {
                var root = json.DeserializeObject(data) as Dictionary<string,object>;
                if (root == null) return;
                var method = S(root,"method");
                var param = D(root,"params");
                if (param == null) return;
                var id = S(param,"requestId");
                if (method == "Network.requestWillBeSent")
                {
                    var request = D(param,"request");
                    var uriText = request == null ? "" : S(request,"url");
                    Uri url;
                    var allowed = Uri.TryCreate(uriText, UriKind.Absolute, out url) &&
                        url.Scheme == "https" &&
                        String.Equals(url.Host,"api-supra.winmart.vn",StringComparison.OrdinalIgnoreCase);
                    Dictionary<string,object> pending = null;
                    lock(gate)
                    {
                        if (!String.IsNullOrWhiteSpace(id))
                        {
                            allowedRequests[id] = allowed;
                            pendingExtraInfo.TryGetValue(id, out pending);
                            pendingExtraInfo.Remove(id);
                            if (allowedRequests.Count > 2500) allowedRequests.Clear();
                        }
                    }
                    if (allowed)
                    {
                        ObserveHeaders(D(request,"headers"));
                        if (pending != null) ObserveHeaders(pending);
                    }
                }
                else if (method == "Network.requestWillBeSentExtraInfo")
                {
                    bool allowed = false;
                    bool known;
                    var raw = D(param,"headers");
                    lock(gate)
                    {
                        known = allowedRequests.TryGetValue(id,out allowed);
                        if (!known && !String.IsNullOrWhiteSpace(id) && raw != null)
                        {
                            pendingExtraInfo[id] = raw;
                            if (pendingExtraInfo.Count > 2500) pendingExtraInfo.Clear();
                        }
                    }
                    if (known && allowed) ObserveHeaders(raw);
                }
            }
            catch (Exception) { /* A malformed unrelated WMS event is not an auth failure. */ }
        }

        private void ObserveHeaders(Dictionary<string,object> raw)
        {
            if (raw == null) return;
            var possible = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            var whitelist = new HashSet<string>(new [] {
                "authorization","token","apisid","appid","sid","scid",
                "usid","warehouse","x-geo-region","x-signature","x-signature-nonce"
            },StringComparer.OrdinalIgnoreCase);
            foreach (var pair in raw)
                if (whitelist.Contains(pair.Key) && pair.Value != null)
                    possible[pair.Key] = Convert.ToString(pair.Value);
            var hasAuth = possible.ContainsKey("authorization") || possible.ContainsKey("token");
            if (!hasAuth) return;
            lock (gate)
            {
                if (headers == null) headers = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
                foreach(var kv in possible) headers[kv.Key] = kv.Value;
            }
        }

        private static Dictionary<string,object> D(Dictionary<string,object> map, string key)
        {
            object val; return map != null && map.TryGetValue(key,out val) ? val as Dictionary<string,object> : null;
        }
        private static string S(Dictionary<string,object> map, string key)
        {
            object val; return map != null && map.TryGetValue(key,out val) && val != null ? Convert.ToString(val) : "";
        }

        public void Dispose()
        {
            try { if (stop != null) stop.Cancel(); } catch {}
            try { if (socket != null) socket.Dispose(); } catch {}
            try { if (stop != null) stop.Dispose(); } catch {}
            // No termination of any browser process; user's separate WMS login window remains controlled by them.
        }
    }
}
