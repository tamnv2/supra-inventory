using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    // D167: Same managed WebView2 profile, separate hidden tab, UI-only WMS
    // read. No cookie/header/token observer, no signed HTTP client, no mutation.
    internal static class D167SkuBrowserExport
    {
        private const string SidePath = "/sft3/app/saleorder/auto-pickpack-confirm";
        private const string Marker = "#d167-sku-readonly";
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

        // Owner 2026-10-12: no UI Search/Export automation for SKU. The
        // existing managed browser supplies an ephemeral authorized WMS API
        // request context; a separate, allowlisted GET downloads the workbook.
        // The Confirm Picklist page is never navigated, reloaded or clicked.
        internal static D167SkuWorkbook Export(SupraConfirmBrowser browser, Func<bool> stillPrimary)
        {
            if (browser == null || stillPrimary == null || !stillPrimary())
                throw new InvalidOperationException("D167_NOT_READY_PRIMARY");
            var port = browser.OpenD167HiddenSkuExportPage();
            var deadline = DateTime.UtcNow.AddSeconds(105);
            var wsUrl = FindSidePage(port, deadline);
            using (var socket = new ClientWebSocket())
            {
                try
                {
                    socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
                    socket.ConnectAsync(new Uri(wsUrl), CancellationToken.None).GetAwaiter().GetResult();
                    Command(socket, "Network.enable", null, TimeSpan.FromSeconds(5), 1);
                    // This reload affects ONLY the isolated hidden side tab.
                    // It must never touch the live Confirm tab or WMS mutation API.
                    Command(socket, "Page.reload", new Dictionary<string, object> {
                        { "ignoreCache", false }
                    }, TimeSpan.FromSeconds(5), 2);
                    var headers = D167SkuDirectExport.CaptureAuthorizedHeaders(socket,
                        deadline, stillPrimary);
                    if (!stillPrimary()) throw new InvalidOperationException("D167_LOST_PRIMARY");
                    var data = D167SkuDirectExport.DownloadReadOnly(headers, stillPrimary);
                    return D167SkuWorkbook.Parse(data);
                }
                finally
                {
                    try
                    {
                        if (socket.State == WebSocketState.Open)
                            Command(socket, "Page.close", null, TimeSpan.FromSeconds(4), 950);
                    }
                    catch { }
                }
            }
        }

        private static string FindSidePage(int port, DateTime deadline)
        {
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create(
                        "http://127.0.0.1:" + port + "/json/list");
                    request.Proxy = null;
                    request.Method = "GET";
                    request.Timeout = 1200;
                    using (var response = (HttpWebResponse)request.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream()))
                    {
                        var targets = Json.DeserializeObject(reader.ReadToEnd()) as object[];
                        foreach (var entry in targets ?? new object[0])
                        {
                            var t = entry as Dictionary<string, object>;
                            if (t == null || Value(t, "type") != "page") continue;
                            Uri page, socket;
                            if (!Uri.TryCreate(Value(t, "url"), UriKind.Absolute, out page) ||
                                page.Scheme != "https" ||
                                !string.Equals(page.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase) ||
                                !string.Equals(page.AbsolutePath,SidePath,StringComparison.OrdinalIgnoreCase) ||
                                !string.Equals(page.Fragment,Marker,StringComparison.Ordinal))
                                continue;
                            var target = Value(t, "webSocketDebuggerUrl");
                            if (!Uri.TryCreate(target, UriKind.Absolute, out socket) ||
                                socket.Scheme != "ws" || socket.Port != port ||
                                !IPAddress.IsLoopback(Dns.GetHostAddresses(socket.Host).FirstOrDefault() ??
                                    IPAddress.None))
                                throw new InvalidOperationException("D167_UNSAFE_CDP_TARGET");
                            return target;
                        }
                    }
                }
                catch (WebException) { }
                Thread.Sleep(300);
            }
            throw new TimeoutException("D167_HIDDEN_BIN_INVENTORY_TARGET_UNAVAILABLE");
        }

        private static string Command(ClientWebSocket socket,string method,
            Dictionary<string, object> parameters,TimeSpan timeout,int id)
        {
            var message=new Dictionary<string,object>{{"id",id},{"method",method}};
            if (parameters!=null) message["params"]=parameters;
            var bytes=Encoding.UTF8.GetBytes(Json.Serialize(message));
            socket.SendAsync(new ArraySegment<byte>(bytes),WebSocketMessageType.Text,true,
                CancellationToken.None).GetAwaiter().GetResult();
            var deadline=DateTime.UtcNow.Add(timeout);
            while (DateTime.UtcNow<deadline)
            {
                using (var cts=new CancellationTokenSource(deadline-DateTime.UtcNow))
                using (var data=new MemoryStream())
                {
                    var buffer=new byte[16384];
                    try
                    {
                        WebSocketReceiveResult got;
                        do
                        {
                            got=socket.ReceiveAsync(new ArraySegment<byte>(buffer),cts.Token)
                                .GetAwaiter().GetResult();
                            if (got.MessageType==WebSocketMessageType.Close)
                                throw new IOException("D167_BROWSER_CLOSED");
                            data.Write(buffer,0,got.Count);
                            if (data.Length>1024*1024) throw new IOException("D167_CDP_REPLY_OVERSIZE");
                        } while(!got.EndOfMessage);
                    }
                    catch(OperationCanceledException) { continue; }
                    Dictionary<string,object> obj;
                    try { obj=Json.DeserializeObject(Encoding.UTF8.GetString(data.ToArray()))
                        as Dictionary<string,object>; }
                    catch { continue; }
                    if (obj==null || !obj.ContainsKey("id") ||
                        Convert.ToInt32(obj["id"])!=id) continue;
                    if(obj.ContainsKey("error")) throw new IOException("D167_BROWSER_COMMAND_REJECTED");
                    return Encoding.UTF8.GetString(data.ToArray());
                }
            }
            throw new TimeoutException("D167_BROWSER_COMMAND_TIMEOUT");
        }

        private static string Value(Dictionary<string,object> map,string key)
        {
            object item;
            return map!=null && map.TryGetValue(key,out item) && item!=null
                ? Convert.ToString(item) : "";
        }
    }
}
