using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace SupraInventoryRelayAgent
{
    // D167 bounded, read-only parser for the real HY1 REPORT BIN INVENTORY XLSX.
    // NO browser session material, cookies, tokens, WMS API, stock quantity or
    // bin management data is retained. Source validation must precede any import.
    internal sealed class D167SkuSnapshotItem
    {
        internal string Sku = "";
        internal string ProductName = "";
        internal string Area = "UNKNOWN";
        internal bool AreaVerified;
        internal string AreaReason = "NO_SOURCE_YET";
    }
    internal sealed class D167SkuWorkbook
    {
        internal readonly List<D167SkuSnapshotItem> Items;
        internal readonly string Fingerprint;
        internal readonly int SourceRows;
        internal readonly int PickableRows;
        private D167SkuWorkbook(List<D167SkuSnapshotItem> items, string fingerprint, int rows, int pickable)
        {
            Items = items; Fingerprint = fingerprint; SourceRows = rows; PickableRows = pickable;
        }
        private const int MaxRows = 50_000;
        private const int MaxSourceBytes = 15_000_000;
        private const int MaxXmlBytes = 60_000_000;
        private const string ExpectedSite = "1291 - Urban";
        private static readonly XNamespace NS =
            "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

        private sealed class Group
        {
            internal string Name;
            internal HashSet<string> Areas = new HashSet<string>(StringComparer.Ordinal);
            internal bool InvalidArea;
            internal int Pickable;
        }

        internal static D167SkuWorkbook Parse(byte[] bytes)
        {
            if (bytes == null || bytes.Length < 8 || bytes.Length > MaxSourceBytes ||
                bytes[0] != 0x50 || bytes[1] != 0x4b)
                throw new InvalidDataException("D167_WMS_SOURCE_NOT_XLSX");
            using (var input = new MemoryStream(bytes, false))
            using (var zip = new ZipArchive(input, ZipArchiveMode.Read))
            {
                var xml = zip.GetEntry("xl/worksheets/sheet1.xml");
                if (xml == null || xml.Length > MaxXmlBytes) throw new InvalidDataException("D167_WMS_SHEET_UNSUPPORTED");
                var shared = ReadShared(zip);
                XDocument document;
                using (var stream = xml.Open())
                using (var reader = System.Xml.XmlReader.Create(stream,
                    new System.Xml.XmlReaderSettings
                    {
                        DtdProcessing = System.Xml.DtdProcessing.Prohibit,
                        XmlResolver = null
                    }))
                    document = XDocument.Load(reader);
                var rows = document.Descendants(NS + "row").ToList();
                if (rows.Count < 2 || rows.Count > MaxRows + 1)
                    throw new InvalidDataException("D167_WMS_ROW_COUNT_INVALID");
                var headers = ReadCells(rows[0], shared).ToDictionary(x => Normalize(x.Value), x => x.Key,
                    StringComparer.Ordinal);
                foreach (var key in new[] { "sku", "ten san pham", "dc site", "ma vtlt", "tinh chat lt" })
                    if (!headers.ContainsKey(key)) throw new InvalidDataException("D167_WMS_HEADER_MISSING_" + key);
                var groups = new Dictionary<string, Group>(StringComparer.Ordinal);
                var sourceCount = 0;
                var pickableCount = 0;
                foreach (var source in rows.Skip(1))
                {
                    var cells = ReadCells(source, shared);
                    Func<string, string> field = key =>
                    {
                        string value;
                        return cells.TryGetValue(headers[key], out value) ? (value ?? "").Trim() : "";
                    };
                    var sku = field("sku");
                    var name = Regex.Replace(field("ten san pham"), @"\s+", " ").Normalize(NormalizationForm.FormC);
                    if (sku.Length == 0 && name.Length == 0) continue;
                    sourceCount += 1;
                    if (sku.Length == 0 || sku.Length > 128 || name.Length == 0 ||
                        name.Length > 500 || Regex.IsMatch(sku, @"^[\d.]+[eE][+-]?\d+$"))
                        throw new InvalidDataException("D167_WMS_BAD_SKU_NAME");
                    if (!string.Equals(field("dc site"), ExpectedSite, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("D167_WMS_WRONG_SITE");
                    Group g;
                    if (!groups.TryGetValue(sku, out g)) { g = new Group { Name = name }; groups.Add(sku, g); }
                    if (!string.Equals(g.Name, name, StringComparison.Ordinal))
                        throw new InvalidDataException("D167_WMS_SKU_NAME_CONFLICT");
                    if (string.Equals(field("tinh chat lt"), "Có thể lấy hàng", StringComparison.OrdinalIgnoreCase))
                    {
                        pickableCount += 1; g.Pickable += 1;
                        var area = Classify(field("ma vtlt"));
                        if (area == "UNKNOWN") g.InvalidArea = true;
                        else g.Areas.Add(area);
                    }
                }
                if (sourceCount == 0 || groups.Count == 0 || groups.Count > 5_000)
                    throw new InvalidDataException("D167_WMS_INVALID_CATALOG_SIZE");
                var items = groups.OrderBy(x => x.Key, StringComparer.Ordinal).Select(pair =>
                {
                    var g = pair.Value;
                    var valid = !g.InvalidArea && g.Areas.Count <= 1;
                    var area = valid && g.Areas.Count == 1 ? g.Areas.First() : "UNKNOWN";
                    var reason = g.InvalidArea ? "INVALID_PICKABLE_LOCATION"
                        : g.Areas.Count > 1 ? "MULTIPLE_AREA"
                        : g.Pickable == 0 ? "NO_PICKABLE_LOCATION" : "VERIFIED";
                    return new D167SkuSnapshotItem
                    {
                        Sku = pair.Key, ProductName = g.Name, Area = area,
                        AreaVerified = valid, AreaReason = reason
                    };
                }).ToList();
                using (var sha = SHA256.Create())
                {
                    // Same fingerprint contract must be reused by the staging Service.
                    var canonical = string.Join("\n", items.Select(x =>
                        x.Sku + "\t" + x.ProductName + "\t" + x.Area + "\t" +
                        (x.AreaVerified ? "1" : "0") + "\t" + x.AreaReason));
                    var digest = sha.ComputeHash(Encoding.UTF8.GetBytes(canonical));
                    var fingerprint = BitConverter.ToString(digest).Replace("-", "").ToLowerInvariant();
                    return new D167SkuWorkbook(items, fingerprint, sourceCount, pickableCount);
                }
            }
        }

        private static string Classify(string location)
        {
            var value = (location ?? "").Trim().ToUpperInvariant();
            if (value == "LTA" || value.StartsWith("LTA.", StringComparison.Ordinal)) return "LTA";
            return Regex.IsMatch(value, @"^\d{1,3}\.\d{1,3}\.\d{1,3}$") ? "SHELVING" : "UNKNOWN";
        }
        private static string Normalize(string value)
        {
            var decomp = (value ?? "").Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var b = new StringBuilder();
            foreach (var c in decomp)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    b.Append(c == 'đ' ? 'd' : c);
            return Regex.Replace(b.ToString().Normalize(NormalizationForm.FormC), @"\s+", " ");
        }
        private static List<string> ReadShared(ZipArchive zip)
        {
            var entry = zip.GetEntry("xl/sharedStrings.xml");
            var strings = new List<string>();
            if (entry == null) return strings;
            if (entry.Length > MaxXmlBytes) throw new InvalidDataException("D167_WMS_SHARED_XML_OVERSIZE");
            XDocument doc;
            using (var stream = entry.Open()) doc = XDocument.Load(stream);
            foreach (var x in doc.Descendants(NS + "si"))
                strings.Add(string.Concat(x.Descendants(NS + "t").Select(t => t.Value)));
            return strings;
        }
        private static Dictionary<int, string> ReadCells(XElement row, List<string> shared)
        {
            var cells = new Dictionary<int, string>();
            foreach (var cell in row.Elements(NS + "c"))
            {
                var addr = (string)cell.Attribute("r") ?? "";
                var index = 0;
                foreach (var c in addr)
                {
                    if (!char.IsLetter(c)) break;
                    index = 26 * index + char.ToUpperInvariant(c) - 'A' + 1;
                }
                index -= 1;
                if (index < 0) continue;
                var t = (string)cell.Attribute("t") ?? "";
                var value = t == "inlineStr"
                    ? string.Concat(cell.Descendants(NS + "t").Select(x => x.Value))
                    : ((string)cell.Element(NS + "v") ?? "");
                if (t == "s")
                {
                    int n;
                    if (!int.TryParse(value, out n) || n < 0 || n >= shared.Count)
                        throw new InvalidDataException("D167_WMS_SHARED_STRING_OOB");
                    value = shared[n];
                }
                cells[index] = value;
            }
            return cells;
        }
    }
}
