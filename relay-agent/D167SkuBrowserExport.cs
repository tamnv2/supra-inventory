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

        internal static D167SkuWorkbook Export(SupraConfirmBrowser browser, Func<bool> stillPrimary)
        {
            if (browser == null || stillPrimary == null || !stillPrimary())
                throw new InvalidOperationException("D167_NOT_READY_PRIMARY");
            // Host must be D167-aware. A missing side page/download causes a
            // visible fail-closed result, NEVER navigation away from Confirm.
            var port = browser.OpenD167HiddenSkuExportPage();
            var deadline = DateTime.UtcNow.AddSeconds(105);
            var wsUrl = FindSidePage(port, deadline);
            var folder = Path.Combine(AgentBrowserStorage.CurrentRoot, "D167SkuDownloads");
            Directory.CreateDirectory(folder);
            var previous = new HashSet<string>(Directory.GetFiles(folder, "D167_BIN_INVENTORY_*.xlsx"),
                StringComparer.OrdinalIgnoreCase);
            using (var socket = new ClientWebSocket())
            {
                socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
                socket.ConnectAsync(new Uri(wsUrl), CancellationToken.None).GetAwaiter().GetResult();
                Command(socket, "Runtime.enable", null, TimeSpan.FromSeconds(5), 1);
                WaitUiReady(socket, deadline, stillPrimary);
                // Follow the actual application's menu rather than guessing
                // an unsupported /report URL. The child is a separate browser.
                ClickOneExactNavigation(socket, "bin inventory", 80);
                WaitBinInventoryUi(socket, deadline, stillPrimary);
                ClickOneExact(socket, "tim kiem", 2);
                // Search is a required first step; never download a prior
                // cached report without reissuing the current-page Search.
                Thread.Sleep(1500);
                if (!stillPrimary()) throw new InvalidOperationException("D167_LOST_PRIMARY");
                ClickOneExact(socket, "export", 3);
                var path = WaitCompleteXlsx(folder, previous, deadline, stillPrimary);
                try
                {
                    var bytes = File.ReadAllBytes(path);
                    return D167SkuWorkbook.Parse(bytes);
                }
                finally
                {
                    // Raw WMS export includes internal location data; never
                    // retain it after parsing normalized, bounded SKU metadata.
                    try { File.Delete(path); } catch { }
                    // Close only this side page. Keep the managed Confirm tab alive
                    // across all three WMS exports and avoid accumulating hidden tabs.
                    try { Command(socket, "Page.close", null, TimeSpan.FromSeconds(4), 950); }
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

        private static void WaitUiReady(ClientWebSocket socket, DateTime deadline, Func<bool> primary)
        {
            var tries = 0;
            while (DateTime.UtcNow < deadline && tries++ < 50)
            {
                if (!primary()) throw new InvalidOperationException("D167_LOST_PRIMARY");
                var status = Evaluate(socket,
                    "(() => JSON.stringify({path:location.pathname,hash:location.hash,ready:document.readyState,links:Array.from(document.querySelectorAll('a,button,[role=menuitem]')).length}))()",
                    100 + tries);
                var obj = Json.DeserializeObject(status) as Dictionary<string, object>;
                if (obj != null && Value(obj,"path")==SidePath &&
                    Value(obj,"hash")==Marker && Value(obj,"ready")=="complete" &&
                    Convert.ToInt32(obj["links"])>0) return;
                Thread.Sleep(350);
            }
            throw new InvalidOperationException("D167_BIN_INVENTORY_NOT_READY");
        }

        private static void ClickOneExactNavigation(ClientWebSocket socket,string name,int id)
        {
            var script = "(() => {" +
                "const norm=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase().replace(/\\s+/g,' ');" +
                "const v=Array.from(document.querySelectorAll('a,button,[role=menuitem]')).filter(x=>norm(x.innerText)===" +
                Json.Serialize(name) + "&&!x.disabled&&x.offsetParent!==null);" +
                "if(v.length!==1)return JSON.stringify({count:v.length,clicked:false});" +
                "v[0].click();return JSON.stringify({count:1,clicked:true});})()";
            var found=Json.DeserializeObject(Evaluate(socket,script,id)) as Dictionary<string,object>;
            if(found==null || Convert.ToInt32(found["count"])!=1 ||
                !Convert.ToBoolean(found["clicked"]))
                throw new InvalidOperationException("D167_BIN_INVENTORY_MENU_NOT_UNIQUE");
        }

        private static void WaitBinInventoryUi(ClientWebSocket socket,DateTime deadline,
            Func<bool> primary)
        {
            for(var tries=0;DateTime.UtcNow<deadline&&tries<80;tries++)
            {
                if(!primary())throw new InvalidOperationException("D167_LOST_PRIMARY");
                var script = "(() => {const norm=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase().replace(/\\s+/g,' ');" +
                    "const b=Array.from(document.querySelectorAll('button')).filter(x=>x.offsetParent!==null&&!x.disabled).map(x=>norm(x.innerText));" +
                    "return JSON.stringify({host:location.hostname,search:b.filter(x=>x==='tim kiem').length,export:b.filter(x=>x==='export').length});})()";
                var result=Json.DeserializeObject(Evaluate(socket,script,200+tries)) as Dictionary<string,object>;
                if(result!=null &&
                    string.Equals(Value(result,"host"),"wms-supra.winmart.vn",StringComparison.OrdinalIgnoreCase) &&
                    Convert.ToInt32(result["search"])==1 &&
                    Convert.ToInt32(result["export"])==1)return;
                Thread.Sleep(400);
            }
            throw new InvalidOperationException("D167_BIN_INVENTORY_UI_NOT_VERIFIED");
        }

        private static void ClickOneExact(ClientWebSocket socket, string name, int id)
        {
            // Exact normalized visible button text, one target only. No generic
            // XPath/first button, no Confirm-page action, no write operation.
            var script = "(() => {" +
                "const norm=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase().replace(/\\s+/g,' ');" +
                "const v=Array.from(document.querySelectorAll('button')).filter(b=>norm(b.textContent)===" +
                Json.Serialize(name) + "&&!b.disabled&&b.offsetParent!==null);" +
                "if(v.length!==1)return JSON.stringify({count:v.length,clicked:false});" +
                "v[0].click();return JSON.stringify({count:1,clicked:true});})()";
            var info = Json.DeserializeObject(Evaluate(socket,script,id)) as Dictionary<string, object>;
            if (info == null || Convert.ToInt32(info["count"]) != 1 ||
                !Convert.ToBoolean(info["clicked"]))
                throw new InvalidOperationException("D167_BIN_UI_BUTTON_NOT_UNIQUE_" + name.ToUpperInvariant());
        }

        private static string WaitCompleteXlsx(string folder, HashSet<string> previous,
            DateTime deadline, Func<bool> stillPrimary)
        {
            string candidate = null;
            long last = -1;
            int stable = 0;
            while (DateTime.UtcNow < deadline)
            {
                if (!stillPrimary()) throw new InvalidOperationException("D167_LOST_PRIMARY");
                var newPaths = Directory.GetFiles(folder, "D167_BIN_INVENTORY_*.xlsx")
                    .Where(x => !previous.Contains(x)).ToArray();
                if (newPaths.Length > 1) throw new InvalidOperationException("D167_MULTIPLE_EXPORT_FILES");
                if (newPaths.Length == 1)
                {
                    var file = new FileInfo(newPaths[0]);
                    if (candidate == newPaths[0] && file.Length == last && file.Length > 1000 &&
                        file.Length < 15_000_000) stable++;
                    else stable = 0;
                    candidate = newPaths[0];
                    last = file.Length;
                    if (stable >= 3)
                    {
                        // Parsing will still reject incomplete ZIP, bad site,
                        // conflicting SKU, unsupported or truncated workbook.
                        return candidate;
                    }
                }
                Thread.Sleep(400);
            }
            throw new TimeoutException("D167_SKU_EXPORT_DOWNLOAD_TIMEOUT");
        }

        private static string Evaluate(ClientWebSocket socket,string expression,int id)
        {
            var response = Command(socket,"Runtime.evaluate",
                new Dictionary<string, object> {
                    {"expression",expression}, {"returnByValue",true},
                    {"awaitPromise",true}, {"userGesture",true}
                },TimeSpan.FromSeconds(12),id);
            var root=Json.DeserializeObject(response) as Dictionary<string,object>;
            object outer,nested,value;
            var result=root!=null && root.TryGetValue("result",out outer)
                ? outer as Dictionary<string,object> : null;
            var item=result!=null && result.TryGetValue("result",out nested)
                ? nested as Dictionary<string,object> : null;
            if (item==null || !item.TryGetValue("value",out value) || value==null)
                throw new InvalidOperationException("D167_BIN_UI_EVAL_UNAVAILABLE");
            return Convert.ToString(value);
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
