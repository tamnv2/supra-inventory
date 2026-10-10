using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Xml.Linq;

namespace D167SkuSyncTest
{
    internal sealed class SkuRow
    {
        internal string Sku;
        internal string ProductName;
    }

    internal static class SkuWorkbook
    {
        private static readonly XNamespace SpreadsheetNs =
            "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        private const int MaxRows = 50000;

        internal static List<SkuRow> Parse(byte[] xlsx)
        {
            if (xlsx == null || xlsx.Length < 4 ||
                xlsx[0] != 0x50 || xlsx[1] != 0x4b)
                throw new AppError("SUPRA_RESPONSE_NOT_XLSX");
            using (var ms = new MemoryStream(xlsx))
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Read, true))
            {
                var sheet = zip.GetEntry("xl/worksheets/sheet1.xml");
                if (sheet == null) throw new AppError("XLSX_FIRST_SHEET_NOT_FOUND");
                var shared = ReadSharedStrings(zip);
                var items = new Dictionary<string,string>(StringComparer.Ordinal);
                var headerFound = false;
                var skuCol = -1;
                var nameCol = -1;
                var rows = 0;
                using (var stream = sheet.Open())
                {
                    var readerSettings = new System.Xml.XmlReaderSettings {
                        DtdProcessing = System.Xml.DtdProcessing.Prohibit, XmlResolver = null
                    };
                    XDocument document;
                    using (var xmlReader = System.Xml.XmlReader.Create(stream, readerSettings))
                        document = XDocument.Load(xmlReader);
                    foreach (var row in document.Descendants(SpreadsheetNs + "row"))
                    {
                        var cells = Cells(row, shared);
                        if (!headerFound)
                        {
                            var possibleSku = -1;
                            var possibleName = -1;
                            foreach (var pair in cells)
                            {
                                var label = NormalizeHeader(pair.Value);
                                if (label == "sku" || label == "ma sku" || label == "sku code" ||
                                    label == "item sku" || label == "ma hang")
                                    possibleSku = pair.Key;
                                if (label == "ten san pham" || label == "ten sp" ||
                                    label == "product name" || label == "ten hang" || label == "san pham")
                                    possibleName = pair.Key;
                            }
                            if (possibleSku >= 0 && possibleName >= 0 && possibleSku != possibleName)
                            {
                                skuCol = possibleSku;
                                nameCol = possibleName;
                                headerFound = true;
                            }
                            else if (Int32.TryParse((string)row.Attribute("r"),out var rowIndex) && rowIndex >= 20)
                                throw new AppError("XLSX_SKU_NAME_HEADERS_NOT_FOUND");
                            continue;
                        }
                        rows++;
                        if (rows > MaxRows) throw new AppError("XLSX_ROW_LIMIT_EXCEEDED");
                        string sku, name;
                        cells.TryGetValue(skuCol, out sku);
                        cells.TryGetValue(nameCol, out name);
                        sku = (sku ?? "").Trim();
                        name = System.Text.RegularExpressions.Regex.Replace((name ?? "").Trim(), @"\s+", " ");
                        if (sku.Length == 0 && name.Length == 0) continue;
                        if (sku.Length < 1 || name.Length < 1 || sku.Length > 128 || name.Length > 500 ||
                            sku.IndexOf('E') >= 0 && sku.Any(Char.IsDigit) &&
                                System.Text.RegularExpressions.Regex.IsMatch(sku, @"^[\d.]+[Ee][+-]?\d+$"))
                            throw new AppError("XLSX_INVALID_SKU_OR_NAME_ROW_" + rows);
                        string existing;
                        if (items.TryGetValue(sku, out existing))
                        {
                            if (!String.Equals(existing,name,StringComparison.Ordinal))
                                throw new AppError("XLSX_DIFFERENT_NAMES_FOR_ONE_SKU_ROW_" + rows);
                        }
                        else items.Add(sku,name);
                    }
                }
                if (!headerFound) throw new AppError("XLSX_MISSING_SKU_NAME_HEADERS");
                if (items.Count == 0) throw new AppError("XLSX_NO_VALID_SKU");
                return items.Select(x => new SkuRow { Sku=x.Key, ProductName=x.Value }).ToList();
            }
        }

        private static Dictionary<int,string> Cells(XElement row, List<string> shared)
        {
            var output = new Dictionary<int,string>();
            foreach (var cell in row.Elements(SpreadsheetNs+"c"))
            {
                var address = (string)cell.Attribute("r") ?? "";
                var column = 0;
                foreach (var ch in address)
                {
                    if (!Char.IsLetter(ch)) break;
                    column = column*26 + (Char.ToUpperInvariant(ch)-'A'+1);
                }
                column--;
                if (column < 0) continue;
                var type = (string)cell.Attribute("t") ?? "";
                var text = type == "inlineStr"
                    ? String.Concat(cell.Descendants(SpreadsheetNs+"t").Select(x=>x.Value))
                    : (string)cell.Element(SpreadsheetNs+"v") ?? "";
                if (type == "s")
                {
                    int index;
                    if (!Int32.TryParse(text, out index) || index < 0 || index >= shared.Count)
                        throw new AppError("XLSX_SHARED_STRING_INVALID");
                    text = shared[index];
                }
                output[column] = text;
            }
            return output;
        }

        private static List<string> ReadSharedStrings(ZipArchive zip)
        {
            var entry = zip.GetEntry("xl/sharedStrings.xml");
            var values = new List<string>();
            if (entry == null) return values;
            using (var stream = entry.Open())
            {
                var doc = XDocument.Load(stream);
                foreach (var si in doc.Descendants(SpreadsheetNs+"si"))
                    values.Add(String.Concat(si.Descendants(SpreadsheetNs+"t").Select(t=>t.Value)));
            }
            return values;
        }

        private static string NormalizeHeader(string s)
        {
            var value = (s ?? "").Trim().ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormD);
            var buffer = new System.Text.StringBuilder();
            foreach(var ch in value)
            {
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) !=
                    System.Globalization.UnicodeCategory.NonSpacingMark)
                    buffer.Append(ch == 'đ' ? 'd' : ch);
            }
            return System.Text.RegularExpressions.Regex.Replace(buffer.ToString().Normalize(
                System.Text.NormalizationForm.FormC),@"\s+"," ");
        }
    }
}
