using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal static class WmsSessionStore
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("SUPRA.Inventory.WmsSession.v1");

        internal static void Save(string path, WmsSessionSnapshot session)
        {
            if (session == null || !session.IsValidHy1())
                throw new InvalidOperationException("WMS session is not valid for storage.");

            var payload = new Dictionary<string, object>
            {
                { "schema_version", 1 },
                { "authorization", session.Authorization ?? "" },
                { "token", session.Token ?? "" },
                { "apisid", session.APISID ?? "" },
                { "appid", session.AppID ?? "" },
                { "sid", session.SID ?? "" },
                { "scid", session.SCID ?? "" },
                { "usid", session.USID ?? "" },
                { "warehouse", session.Warehouse ?? "" },
                { "x_geo_region", session.XGeoRegion ?? "" },
                { "origin", session.Origin ?? "" },
                { "referer", session.Referer ?? "" },
                { "captured_utc", session.CapturedUtc.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture) },
                { "validated_utc", DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture) }
            };

            var plain = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(payload));
            byte[] encrypted = null;
            try
            {
                encrypted = ProtectedData.Protect(plain, Entropy, DataProtectionScope.CurrentUser);
                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                var temp = path + ".tmp";
                File.WriteAllBytes(temp, encrypted);
                if (File.Exists(path))
                {
                    try
                    {
                        File.Replace(temp, path, null);
                    }
                    catch
                    {
                        File.Delete(path);
                        File.Move(temp, path);
                    }
                }
                else
                {
                    File.Move(temp, path);
                }
            }
            finally
            {
                if (plain != null) Array.Clear(plain, 0, plain.Length);
                if (encrypted != null) Array.Clear(encrypted, 0, encrypted.Length);
            }
        }

        internal static WmsSessionSnapshot Load(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return null;

            byte[] encrypted = null;
            byte[] plain = null;
            try
            {
                encrypted = File.ReadAllBytes(path);
                plain = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
                var map = new JavaScriptSerializer().DeserializeObject(Encoding.UTF8.GetString(plain)) as Dictionary<string, object>;
                if (map == null) throw new InvalidOperationException("Encrypted WMS session file has an invalid payload.");

                var session = new WmsSessionSnapshot
                {
                    Authorization = Read(map, "authorization"),
                    Token = Read(map, "token"),
                    APISID = Read(map, "apisid"),
                    AppID = Read(map, "appid"),
                    SID = Read(map, "sid"),
                    SCID = Read(map, "scid"),
                    USID = Read(map, "usid"),
                    Warehouse = Read(map, "warehouse"),
                    XGeoRegion = Read(map, "x_geo_region"),
                    Origin = Read(map, "origin"),
                    Referer = Read(map, "referer"),
                    CapturedUtc = ParseUtc(Read(map, "captured_utc"))
                };

                if (!session.IsValidHy1())
                    throw new InvalidOperationException("Encrypted WMS session file is incomplete.");
                return session;
            }
            finally
            {
                if (plain != null) Array.Clear(plain, 0, plain.Length);
                if (encrypted != null) Array.Clear(encrypted, 0, encrypted.Length);
            }
        }

        internal static void Clear(string path)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(path) && File.Exists(path)) File.Delete(path);
                var temp = path + ".tmp";
                if (!string.IsNullOrWhiteSpace(path) && File.Exists(temp)) File.Delete(temp);
            }
            catch { }
        }

        private static string Read(Dictionary<string, object> map, string key)
        {
            object value;
            return map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static DateTime ParseUtc(string value)
        {
            DateTime parsed;
            if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out parsed))
                return parsed.ToUniversalTime();
            return DateTime.MinValue;
        }
    }
}
