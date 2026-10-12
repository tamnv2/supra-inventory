using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    // ONLY the Owner-registered read-only Bin Inventory XLSX export.
    // WMS session headers exist in this local method's RAM only; no persistence,
    // telemetry, HTTP-forwarding to Inventory or secrets in exception messages.
    internal static class D167SkuDirectExport
    {
        private const string Host = "api-supra.winmart.vn";
        private const string SignPath = "/api/v1/report/stock/exportBinStocks";
        private const string ExportUrl =
            "https://api-supra.winmart.vn/sft3-hy1/api/v1/report/stock/exportBinStocks" +
            "?FromWH=true&Content=&ClientCode=WIN&WhCode=HY1&WarehouseSiteId=1291&PickupMethod=&IsConsign=false";
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static readonly HashSet<string> Allowed = new HashSet<string>(
            new[] { "authorization", "token", "apisid", "appid", "sid", "scid",
                    "usid", "warehouse", "x-geo-region" },
            StringComparer.OrdinalIgnoreCase);

        internal static Dictionary<string, string> CaptureAuthorizedHeaders(
            ClientWebSocket socket, DateTime deadline, Func<bool> stillPrimary)
        {
            var headers = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            var observed = new HashSet<string>(StringComparer.Ordinal);
            var early = new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
            DateTime? firstAuth = null;
            while (DateTime.UtcNow < deadline)
            {
                if (!stillPrimary()) throw new InvalidOperationException("D167_LOST_PRIMARY");
                if (firstAuth.HasValue && (DateTime.UtcNow - firstAuth.Value).TotalMilliseconds >= 1800)
                    break;
                using (var cancel = new CancellationTokenSource(TimeSpan.FromMilliseconds(1600)))
                using (var stream = new MemoryStream())
                {
                    try
                    {
                        var buffer = new byte[32768];
                        WebSocketReceiveResult read;
                        do
                        {
                            read = socket.ReceiveAsync(new ArraySegment<byte>(buffer),
                                cancel.Token).GetAwaiter().GetResult();
                            if (read.MessageType == WebSocketMessageType.Close)
                                throw new InvalidOperationException("D167_WMS_SIDE_TAB_CLOSED");
                            stream.Write(buffer, 0, read.Count);
                            if (stream.Length > 1024*1024)
                                throw new InvalidDataException("D167_CDP_MESSAGE_OVERSIZE");
                        } while (!read.EndOfMessage);
                    }
                    catch (OperationCanceledException) { continue; }
                    Dictionary<string,object> root;
                    try
                    {
                        root = Json.DeserializeObject(Encoding.UTF8.GetString(stream.ToArray()))
                            as Dictionary<string,object>;
                    }
                    catch { continue; }
                    if (root == null) continue;
                    var method = Field(root, "method");
                    var args = Child(root, "params");
                    var id = Field(args, "requestId");
                    if (String.IsNullOrWhiteSpace(id)) continue;
                    if (method == "Network.requestWillBeSent")
                    {
                        var request = Child(args, "request");
                        Uri uri;
                        var allowed = Uri.TryCreate(Field(request, "url"), UriKind.Absolute, out uri) &&
                            uri.Scheme == Uri.UriSchemeHttps &&
                            String.Equals(uri.Host, Host, StringComparison.OrdinalIgnoreCase);
                        if (!allowed) continue;
                        observed.Add(id);
                        CopyAllowed(Child(request, "headers"), headers);
                        Dictionary<string,object> pending;
                        if (early.TryGetValue(id,out pending))
                        {
                            CopyAllowed(pending,headers);
                            early.Remove(id);
                        }
                    }
                    else if (method == "Network.requestWillBeSentExtraInfo")
                    {
                        var raw = Child(args, "headers");
                        if (observed.Contains(id)) CopyAllowed(raw,headers);
                        else if (raw != null && early.Count < 128) early[id] = raw;
                    }
                    if ((headers.ContainsKey("authorization") || headers.ContainsKey("token"))
                        && !firstAuth.HasValue) firstAuth = DateTime.UtcNow;
                }
            }
            if (!headers.ContainsKey("authorization") && !headers.ContainsKey("token"))
                throw new InvalidOperationException("D167_WMS_AUTH_TRAFFIC_NOT_OBSERVED");
            return headers;
        }

        internal static byte[] DownloadReadOnly(
            Dictionary<string,string> headers,Func<bool> stillPrimary)
        {
            if (headers == null || !stillPrimary())
                throw new InvalidOperationException("D167_WMS_READ_NOT_AUTHORIZED");
            // Protocol proven by the Owner's isolated D167 read-only exporter.
            // Construct a fresh nonce/signature for this one GET; do not reuse
            // request signatures or save auth material outside process RAM.
            var nonceA = Nonce(10);
            var nonceB = Nonce(4);
            var time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            var key = "910" + time + nonceB;
            string signature;
            using (var hmac = new HMACSHA256(Encoding.ASCII.GetBytes(key)))
            {
                signature = "910" + BitConverter.ToString(hmac.ComputeHash(
                    Encoding.ASCII.GetBytes(nonceA+"|"+SignPath)))
                    .Replace("-", "").ToLowerInvariant();
            }
            var uri = new Uri(ExportUrl);
            if (uri.Scheme != Uri.UriSchemeHttps ||
                !String.Equals(uri.Host,Host,StringComparison.OrdinalIgnoreCase) ||
                !String.Equals(uri.AbsolutePath,
                    "/sft3-hy1"+SignPath,StringComparison.Ordinal))
                throw new InvalidOperationException("D167_WMS_EXPORT_URL_NOT_ALLOWLISTED");
            var req = (HttpWebRequest)WebRequest.Create(uri);
            req.Method="GET";
            req.Accept="application/json, text/plain, */*";
            req.UserAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36";
            req.Referer="https://wms-supra.winmart.vn/";
            req.Headers["Origin"]="https://wms-supra.winmart.vn";
            req.AllowAutoRedirect=false;
            req.Timeout=100000;
            req.ReadWriteTimeout=100000;
            var proxy=WebRequest.GetSystemWebProxy();
            if(proxy!=null)proxy.Credentials=CredentialCache.DefaultNetworkCredentials;
            req.Proxy=proxy;
            foreach(var name in Allowed)
            {
                string value;
                if(headers.TryGetValue(name,out value) && !String.IsNullOrWhiteSpace(value))
                    req.Headers[name]=value;
            }
            req.Headers["x-signature"]=signature;
            req.Headers["x-signature-nonce"]=nonceA+nonceB+time;
            try
            {
                using(var resp=(HttpWebResponse)req.GetResponse())
                using(var input=resp.GetResponseStream())
                using(var output=new MemoryStream())
                {
                    if(resp.StatusCode!=HttpStatusCode.OK)
                        throw new InvalidOperationException("D167_WMS_EXPORT_NOT_200");
                    var buffer=new byte[65536];
                    int read;
                    while((read=input.Read(buffer,0,buffer.Length))>0)
                    {
                        if(!stillPrimary())throw new InvalidOperationException("D167_LOST_PRIMARY");
                        if(output.Length+read>45L*1024*1024)
                            throw new InvalidDataException("D167_WMS_XLSX_TOO_LARGE");
                        output.Write(buffer,0,read);
                    }
                    var bytes=output.ToArray();
                    if(bytes.Length<4 || bytes[0]!=0x50 || bytes[1]!=0x4b)
                        throw new InvalidDataException("D167_WMS_NOT_XLSX");
                    return bytes;
                }
            }
            catch (WebException e)
            {
                // Log only the numeric status; never stringify provider bodies,
                // request URLs, authorization headers, cookies or signatures.
                var http=e.Response as HttpWebResponse;
                var code=http==null ? "NETWORK_"+e.Status.ToString().ToUpperInvariant() :
                    "HTTP_"+((int)http.StatusCode).ToString();
                throw new InvalidOperationException("D167_WMS_EXPORT_"+code);
            }
        }

        private static string Nonce(int length)
        {
            const string alphabet="abcdefghijklmnopqrstuvwxyz0123456789";
            var data=new byte[length];
            using(var rng=RandomNumberGenerator.Create())rng.GetBytes(data);
            return new string(data.Select(x=>alphabet[x%alphabet.Length]).ToArray());
        }
        private static string Field(Dictionary<string,object> map,string key)
        {
            object value;
            return map!=null && map.TryGetValue(key,out value) && value!=null
                ? Convert.ToString(value) : "";
        }
        private static Dictionary<string,object> Child(Dictionary<string,object> map,string key)
        {
            object value;
            return map!=null && map.TryGetValue(key,out value)
                ? value as Dictionary<string,object> : null;
        }
        private static void CopyAllowed(Dictionary<string,object> source,Dictionary<string,string> target)
        {
            if(source == null)return;
            foreach(var item in source)
                if(Allowed.Contains(item.Key) && item.Value != null)
                    target[item.Key]=Convert.ToString(item.Value);
        }
    }
}
