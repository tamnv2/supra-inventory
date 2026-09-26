using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class WmsSkuCatalogItem
    {
        internal string Sku;
        internal string ProductName;
    }

    internal sealed class WmsSkuCatalogResult
    {
        internal List<WmsSkuCatalogItem> Items = new List<WmsSkuCatalogItem>();
        internal int RawSkuRows;
        internal int SourceTotal;
        internal string RequestVariant;
    }

    internal static class WmsSkuCatalogClient
    {
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer
        {
            MaxJsonLength = 32 * 1024 * 1024,
            RecursionLimit = 256
        };

        private static readonly string[] SkuKeys =
        {
            "sku", "skucode", "codesku", "itemcode", "productcode", "mahang", "masp", "mahanghoa"
        };

        private static readonly string[] NameKeys =
        {
            "productname", "itemname", "skuname", "productdescription", "description",
            "tenhang", "tensanpham", "tenhanghoa"
        };

        internal static WmsSkuCatalogResult Download(
            WmsSessionSnapshot session,
            Action<string> log,
            Action<string> progress = null)
        {
            if (progress != null) progress("Đang đọc danh mục SKU từ Supra...");
            var variants = new[]
            {
                "?Page=1&PageSize=5000",
                "?page=1&pageSize=5000",
                "?PageIndex=1&PageSize=5000",
                ""
            };

            Exception last = null;
            foreach (var suffix in variants)
            {
                try
                {
                    if (progress != null)
                        progress(suffix.Length == 0
                            ? "Đang kiểm tra dữ liệu SKU từ Supra..."
                            : "Đang tải danh mục SKU từ Supra...");
                    var raw = WmsReadOnlyClient.GetSignedJson(
                        AgentConfig.WmsBinStocksUrl + suffix,
                        AgentConfig.WmsBinStocksSignPath,
                        session);
                    var parsed = Parse(raw, suffix.Length == 0 ? "default" : suffix);
                    if (parsed.Items.Count == 0)
                        throw new InvalidOperationException("Supra Tồn Bin không trả được SKU + tên sản phẩm.");

                    if (parsed.SourceTotal > 0 && parsed.RawSkuRows < parsed.SourceTotal)
                        throw new InvalidOperationException(
                            "Supra Tồn Bin còn trang chưa tải: " + parsed.RawSkuRows + "/" + parsed.SourceTotal + ".");

                    // Fail closed on common default page boundaries if the response does not
                    // expose a total. This prevents importing a silently truncated first page.
                    if (parsed.SourceTotal <= 0 &&
                        (parsed.RawSkuRows == 20 || parsed.RawSkuRows == 50 || parsed.RawSkuRows == 100 ||
                         parsed.RawSkuRows == 200 || parsed.RawSkuRows == 500 || parsed.RawSkuRows == 1000))
                        throw new InvalidOperationException(
                            "Chưa xác minh được phân trang Tồn Bin; từ chối cập nhật SKU một phần.");

                    if (progress != null)
                        progress("Đã đọc " + parsed.Items.Count.ToString("N0") + " SKU từ Supra.");
                    if (log != null)
                        log("SKU_SYNC WMS read=PASS variant=" + parsed.RequestVariant +
                            " raw_sku_rows=" + parsed.RawSkuRows +
                            " unique_sku=" + parsed.Items.Count +
                            " source_total=" + parsed.SourceTotal +
                            " stock_fields=discarded");
                    return parsed;
                }
                catch (Exception ex)
                {
                    last = ex;
                    if (log != null)
                        log("SKU_SYNC WMS variant_fail=" +
                            (suffix.Length == 0 ? "default" : SafeVariant(suffix)) +
                            " type=" + ex.GetType().Name +
                            " detail=" + SafeMessage(ex));
                }
            }

            throw new InvalidOperationException(
                "Không tải được danh mục SKU đầy đủ từ Supra Tồn Bin. Không có dữ liệu nào được cập nhật.",
                last);
        }

        private static WmsSkuCatalogResult Parse(string raw, string variant)
        {
            object rootObject;
            try { rootObject = Json.DeserializeObject(raw); }
            catch { throw new InvalidOperationException("Supra Tồn Bin trả JSON không hợp lệ."); }

            var result = new WmsSkuCatalogResult
            {
                RequestVariant = variant,
                SourceTotal = FindTotalCount(rootObject, 0)
            };
            var skuNames = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            var seenSkuRows = new HashSet<string>(StringComparer.Ordinal);
            Walk(rootObject, skuNames, seenSkuRows, result);

            var missingName = new List<string>();
            foreach (var entry in skuNames)
            {
                if (entry.Value.Count == 0)
                {
                    missingName.Add(entry.Key);
                    continue;
                }
                if (entry.Value.Count > 1)
                    throw new InvalidOperationException(
                        "Supra trả nhiều tên khác nhau cho SKU " + SafeSku(entry.Key) + "; cần kiểm tra trước khi cập nhật.");

                string name = null;
                foreach (var candidate in entry.Value) { name = candidate; break; }
                if (string.IsNullOrWhiteSpace(name))
                {
                    missingName.Add(entry.Key);
                    continue;
                }
                result.Items.Add(new WmsSkuCatalogItem { Sku = entry.Key, ProductName = name });
            }

            if (missingName.Count > 0)
                throw new InvalidOperationException(
                    "Supra Tồn Bin thiếu tên sản phẩm cho " + missingName.Count +
                    " SKU; từ chối cập nhật danh mục một phần.");

            result.Items.Sort((a, b) => string.Compare(a.Sku, b.Sku, StringComparison.OrdinalIgnoreCase));
            return result;
        }

        private static void Walk(
            object node,
            Dictionary<string, HashSet<string>> skuNames,
            HashSet<string> seenSkuRows,
            WmsSkuCatalogResult result)
        {
            var map = node as Dictionary<string, object>;
            if (map != null)
            {
                var sku = ReadAny(map, SkuKeys);
                if (!string.IsNullOrWhiteSpace(sku))
                {
                    sku = sku.Trim();
                    if (sku.Length <= 128)
                    {
                        var rowIdentity = sku + "|" + RuntimeHelpersSafeIdentity(map);
                        if (seenSkuRows.Add(rowIdentity)) result.RawSkuRows++;

                        HashSet<string> names;
                        if (!skuNames.TryGetValue(sku, out names))
                        {
                            names = new HashSet<string>(StringComparer.CurrentCultureIgnoreCase);
                            skuNames[sku] = names;
                        }
                        var name = ReadAny(map, NameKeys);
                        if (!string.IsNullOrWhiteSpace(name))
                        {
                            name = CollapseWhitespace(name);
                            if (name.Length <= 500) names.Add(name);
                        }
                    }
                }

                foreach (var value in map.Values) Walk(value, skuNames, seenSkuRows, result);
                return;
            }

            var list = node as IEnumerable;
            if (list == null || node is string) return;
            foreach (var item in list) Walk(item, skuNames, seenSkuRows, result);
        }

        private static string RuntimeHelpersSafeIdentity(Dictionary<string, object> map)
        {
            // Raw row count is used only for pagination completeness checks. A small
            // deterministic signature avoids counting the same wrapper recursively.
            var sb = new StringBuilder();
            var count = 0;
            foreach (var entry in map)
            {
                if (count++ >= 8) break;
                sb.Append(NormalizeKey(entry.Key)).Append('=');
                if (entry.Value == null || entry.Value is string || entry.Value.GetType().IsPrimitive)
                    sb.Append(Convert.ToString(entry.Value, CultureInfo.InvariantCulture));
                sb.Append(';');
            }
            return sb.ToString();
        }

        private static int FindTotalCount(object node, int depth)
        {
            if (depth > 2) return 0;
            var map = node as Dictionary<string, object>;
            if (map == null) return 0;

            foreach (var entry in map)
            {
                var key = NormalizeKey(entry.Key);
                if (key == "totalcount" || key == "totalrecords" || key == "recordstotal" || key == "totalitems")
                {
                    int parsed;
                    if (int.TryParse(Convert.ToString(entry.Value, CultureInfo.InvariantCulture), out parsed) && parsed > 0)
                        return parsed;
                }
            }

            foreach (var entry in map)
            {
                if (entry.Value is Dictionary<string, object>)
                {
                    var nested = FindTotalCount(entry.Value, depth + 1);
                    if (nested > 0) return nested;
                }
            }
            return 0;
        }

        private static string ReadAny(Dictionary<string, object> map, string[] keys)
        {
            foreach (var entry in map)
            {
                var normalized = NormalizeKey(entry.Key);
                foreach (var wanted in keys)
                {
                    if (!string.Equals(normalized, wanted, StringComparison.Ordinal)) continue;
                    var value = Convert.ToString(entry.Value, CultureInfo.InvariantCulture);
                    return value == null ? "" : value.Trim();
                }
            }
            return "";
        }

        private static string NormalizeKey(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var decomposed = value.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(decomposed.Length);
            foreach (var ch in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
                if (char.IsLetterOrDigit(ch)) sb.Append(char.ToLowerInvariant(ch));
            }
            return sb.ToString()
                .Replace("đ", "d");
        }

        private static string CollapseWhitespace(string value)
        {
            var sb = new StringBuilder();
            var pendingSpace = false;
            foreach (var ch in value.Trim())
            {
                if (char.IsWhiteSpace(ch))
                {
                    pendingSpace = sb.Length > 0;
                    continue;
                }
                if (pendingSpace) sb.Append(' ');
                pendingSpace = false;
                sb.Append(ch);
            }
            return sb.ToString();
        }

        private static string SafeVariant(string value)
        {
            return value.Replace("&", ",").Replace("?", "");
        }

        private static string SafeSku(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "unknown";
            return value.Length <= 32 ? value : value.Substring(0, 32);
        }

        private static string SafeMessage(Exception ex)
        {
            var text = ex == null ? "unknown" : ex.Message;
            if (string.IsNullOrWhiteSpace(text)) return "unknown";
            text = text.Replace("\r", " ").Replace("\n", " ").Trim();
            return text.Length <= 180 ? text : text.Substring(0, 180);
        }
    }
}
