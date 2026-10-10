using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace D167SkuSyncTest
{
    // The Inventory identity is authenticated independently by the existing Beta Worker.
    // Never read files, process memory or refresh tokens belonging to the main Agent.
    internal sealed class InventoryClient
    {
        private const string Beta = "https://inventory-beta.supra.cc.cd";
        private readonly JavaScriptSerializer serializer =
            new JavaScriptSerializer { MaxJsonLength = 25 * 1024 * 1024 };
        private readonly object guard = new object();
        private string idToken, refreshToken;
        private DateTime expires;
        private string role;
        internal bool IsAuthenticated { get { lock (guard) return !String.IsNullOrWhiteSpace(refreshToken); } }
        internal string Role { get { lock (guard) return role; } }

        internal string Login(string username, string password, bool asAgent, bool forceWeb)
        {
            var path = asAgent ? "/api/auth/privileged-agent-login" : "/api/auth/login";
            var body = asAgent
                ? new Dictionary<string, object> { { "username", username }, { "password", password } }
                : new Dictionary<string, object> {
                    { "username", username }, { "password", password }, { "client_type", "WEB" },
                    { "device_id", "d167-sku-test-" + Environment.MachineName.ToLowerInvariant() },
                    { "force", forceWeb }
                  };
            var json = Fetch("POST", path, serializer.Serialize(body), null);
            var user = Dict(json,"user");
            var nextRole = Str(user,"role");
            if (nextRole != "ADMIN" && nextRole != "PICKPACK_ADMIN" && nextRole != "ROOT")
                throw new AppError("INVENTORY_ROLE_NOT_ALLOWED");
            if (asAgent && nextRole != "ADMIN" && nextRole != "PICKPACK_ADMIN")
                throw new AppError("INVENTORY_AGENT_ROLE_NOT_ALLOWED");
            var nextId = Str(json,"id_token");
            var nextRefresh = Str(json,"refresh_token");
            if (nextId.Length == 0 || nextRefresh.Length == 0)
                throw new AppError("INVENTORY_LOGIN_MISSING_TOKEN");
            lock (guard)
            {
                idToken = nextId; refreshToken = nextRefresh;
                expires = DateTime.UtcNow.AddSeconds(Math.Max(60, Num(json,"expires_in")));
                role = nextRole;
            }
            return nextRole;
        }

        private string Bearer()
        {
            string refresh;
            lock (guard)
            {
                if (String.IsNullOrWhiteSpace(idToken)) throw new AppError("INVENTORY_NOT_SIGNED_IN");
                if (DateTime.UtcNow.AddMinutes(3) < expires) return idToken;
                refresh = refreshToken;
            }
            var response = Fetch("POST","/api/auth/refresh",
                serializer.Serialize(new Dictionary<string,object>{{"refresh_token",refresh}}),null);
            var nextId = Str(response,"id_token");
            var nextRefresh = Str(response,"refresh_token");
            if (String.IsNullOrWhiteSpace(nextId) || String.IsNullOrWhiteSpace(nextRefresh))
                throw new AppError("INVENTORY_SESSION_EXPIRED");
            lock(guard)
            {
                idToken = nextId; refreshToken = nextRefresh;
                expires = DateTime.UtcNow.AddSeconds(Math.Max(60,Num(response,"expires_in")));
                return idToken;
            }
        }

        internal Dictionary<string,object> PreviewOrImport(List<SkuRow> items, string sourceHash,
            string requestId, bool preview, bool allowNameChanges)
        {
            var body = new Dictionary<string,object> {
                {"items",items.Select(x=>new Dictionary<string,object>{
                    {"sku",x.Sku},{"product_name",x.ProductName}
                }).ToArray()},
                {"request_id",requestId},
                {"source_hash",sourceHash},
                {"dry_run",preview},
                {"confirm_name_changes",allowNameChanges}
            };
            // No automatic retries of the write path. request_id supports safe reconciliation.
            return Fetch("POST","/api/admin/skus/import",serializer.Serialize(body),Bearer());
        }

        internal bool VerifyStoredSku(SkuRow expected)
        {
            var result = Fetch("GET","/api/skus?query=" + Uri.EscapeDataString(expected.Sku) +
                "&limit=100&offset=0",null,Bearer());
            var items = result.ContainsKey("items") ? result["items"] as object[] : null;
            return items != null && items.Any(item => {
                var row = item as Dictionary<string,object>;
                return row != null && Str(row,"sku") == expected.Sku &&
                    Str(row,"product_name") == expected.ProductName;
            });
        }

        private Dictionary<string,object> Fetch(string method, string path, string payload, string bearer)
        {
            var uri = new Uri(Beta + path);
            var req = (HttpWebRequest)WebRequest.Create(uri);
            req.Method = method;
            req.Timeout = 30000;
            req.ReadWriteTimeout = 30000;
            req.AllowAutoRedirect = false;
            req.Accept = "application/json";
            if (!String.IsNullOrWhiteSpace(bearer)) req.Headers["Authorization"] = "Bearer " + bearer;
            if (payload != null)
            {
                req.ContentType = "application/json";
                var bytes = Encoding.UTF8.GetBytes(payload);
                using (var body = req.GetRequestStream()) body.Write(bytes,0,bytes.Length);
            }
            try
            {
                using (var response = (HttpWebResponse)req.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                    return Deserialize(reader.ReadToEnd());
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response == null) throw new AppError("INVENTORY_NETWORK_" + ex.Status);
                var status = (int)response.StatusCode;
                var err = "";
                try
                {
                    using(response)
                    using(var sr = new StreamReader(response.GetResponseStream()))
                        err = Str(Deserialize(sr.ReadToEnd()),"error");
                }
                catch {}
                if (err == "SESSION_ACTIVE_OTHER_DEVICE")
                    throw new AppError("WEB_SESSION_CONFLICT__CHECK_ALLOW_REPLACE_WEB_IF_INTENDED");
                throw new AppError("INVENTORY_HTTP_" + status + "_" + SafeCode(err));
            }
        }

        private Dictionary<string,object> Deserialize(string s)
        {
            try { return serializer.DeserializeObject(s) as Dictionary<string,object> ??
                    throw new AppError("INVENTORY_INVALID_RESPONSE"); }
            catch (ArgumentException) { throw new AppError("INVENTORY_JSON_INVALID"); }
        }

        internal static Dictionary<string,object> Dict(Dictionary<string,object> obj,string key)
        {
            object raw; return obj != null && obj.TryGetValue(key,out raw) ?
                raw as Dictionary<string,object> : null;
        }
        internal static string Str(Dictionary<string,object> obj,string key)
        {
            object raw; return obj != null && obj.TryGetValue(key,out raw) && raw != null ?
                Convert.ToString(raw) : "";
        }
        internal static int Num(Dictionary<string,object> obj,string key)
        {
            int n; return Int32.TryParse(Str(obj,key),out n) ? n : 0;
        }
        private static string SafeCode(string s)
        {
            return new string((s ?? "").Where(c=>Char.IsLetterOrDigit(c)||c=='_').Take(64).ToArray());
        }
    }
}
