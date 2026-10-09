using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace SupraSkuRecorder
{
    // Local workbook validation, with no service or Agent access.
    // Never write actual SKU names, site rows or downloaded contents into public logs.
    internal sealed class SkuWorkbookSummary
    {
        internal int DataRows;
        internal int UniqueSkus;
        internal int RepeatedRows;
        internal int ConflictingNames;
        internal int InvalidRows;
        internal int HeaderRow;
        internal string SiteAlias = "unverified";
        internal string Digest = "";
        internal bool SafeToPreview;
        internal string Failure = "";
    }

    internal static class SkuWorkbookAudit
    {
        internal const long MaxWorkbookBytes = 50L * 1024 * 1024;
        internal const int MaxDataRows = 50000;
        private static readonly XNamespace N =
            "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

        private static XmlReaderSettings ReaderSettings() => new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            MaxCharactersInDocument = 160_000_000,
            IgnoreComments = true,
            IgnoreProcessingInstructions = true
        };

        internal static SkuWorkbookSummary Inspect(string path)
        {
            var result = new SkuWorkbookSummary();
            if (string.IsNullOrEmpty(path) ||
                !string.Equals(Path.GetExtension(path), ".xlsx", StringComparison.OrdinalIgnoreCase))
                return Reject(result, "requires_xlsx");
            var file = new FileInfo(path);
            if (!file.Exists || file.Length == 0 || file.Length > MaxWorkbookBytes)
                return Reject(result, "invalid_file_size");
            try
            {
                using (var hash = SHA256.Create())
                using (var input = File.OpenRead(path))
                    result.Digest = BitConverter.ToString(hash.ComputeHash(input))
                        .Replace("-", "").ToLowerInvariant();

                using (var zip = ZipFile.OpenRead(path))
                {
                    if (zip.Entries.Count > 500) return Reject(result, "entry_count_limit");
                    // Only a bounded OOXML workbook, never macros or external-link processing.
                    var sheet = zip.GetEntry("xl/worksheets/sheet1.xml");
                    var workbook = zip.GetEntry("xl/workbook.xml");
                    if (sheet == null || workbook == null ||
                        sheet.Length > 130_000_000 || workbook.Length > 1_000_000)
                        return Reject(result, "invalid_ooxml_sheet");
                    var strings = SharedStrings(zip);
                    var names = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
                    var headerFound = false;
                    var skuColumn = "";
                    var nameColumn = "";
                    var siteColumn = "";
                    using (var stream = sheet.Open())
                    using (var reader = XmlReader.Create(stream, ReaderSettings()))
                    {
                        while (!reader.EOF)
                        {
                            if (reader.NodeType != XmlNodeType.Element || reader.LocalName != "row")
                            {
                                reader.Read();
                                continue;
                            }
                            var row = (XElement)XNode.ReadFrom(reader);
                            int rowNum;
                            if (!int.TryParse((string)row.Attribute("r"), out rowNum) || rowNum < 1)
                                return Reject(result, "invalid_row_position");
                            if (rowNum > MaxDataRows + 20)
                                return Reject(result, "row_limit");
                            var fields = ReadRow(row, strings);
                            if (!headerFound)
                            {
                                if (rowNum > 20) return Reject(result, "missing_header");
                                foreach (var item in fields)
                                {
                                    var value = NormalizeHeader(item.Value);
                                    if (value == "sku" || value == "ma sku" || value == "sku code")
                                        skuColumn = item.Key;
                                    if (value == "ten san pham" || value == "product name")
                                        nameColumn = item.Key;
                                    if (value == "dc site") siteColumn = item.Key;
                                }
                                if (skuColumn.Length > 0 && nameColumn.Length > 0 &&
                                    skuColumn != nameColumn)
                                {
                                    headerFound = true;
                                    result.HeaderRow = rowNum;
                                }
                                continue;
                            }

                            var sku = Cell(fields, skuColumn).Trim();
                            var productName = Cell(fields, nameColumn).Trim();
                            if (sku.Length == 0 && productName.Length == 0) continue;
                            result.DataRows++;
                            if (result.DataRows > MaxDataRows) return Reject(result, "row_limit");
                            if (sku.Length == 0 || productName.Length == 0 ||
                                sku.Length > 128 || productName.Length > 500 ||
                                sku.StartsWith("=", StringComparison.Ordinal))
                            {
                                result.InvalidRows++;
                                continue;
                            }
                            // The Owner's source is DC 1291 - Urban only.
                            // Fail closed rather than import an unrecognized warehouse.
                            if (siteColumn.Length == 0)
                                return Reject(result, "missing_site_column");
                            var site = Cell(fields, siteColumn).Trim();
                            if (!string.Equals(site, "1291 - Urban", StringComparison.OrdinalIgnoreCase))
                                return Reject(result, "unexpected_dc_site");
                            result.SiteAlias = "hy1_1291";
                            HashSet<string> variants;
                            if (!names.TryGetValue(sku, out variants))
                            {
                                variants = new HashSet<string>(StringComparer.Ordinal);
                                names.Add(sku, variants);
                            }
                            else result.RepeatedRows++;
                            variants.Add(productName);
                        }
                    }
                    if (!headerFound) return Reject(result, "missing_header");
                    result.UniqueSkus = names.Count;
                    result.ConflictingNames = names.Values.Count(set => set.Count > 1);
                    if (result.UniqueSkus == 0 || result.InvalidRows > 0)
                        return Reject(result, "invalid_sku_rows");
                    if (result.ConflictingNames > 0)
                        return Reject(result, "source_name_conflict");
                    result.SafeToPreview = true;
                    return result;
                }
            }
            catch (InvalidDataException) { return Reject(result, "invalid_archive"); }
            catch (XmlException) { return Reject(result, "invalid_xml"); }
            catch (IOException) { return Reject(result, "io_error"); }
            catch (UnauthorizedAccessException) { return Reject(result, "access_denied"); }
            catch (Exception) { return Reject(result, "unrecognized_error"); }
        }

        private static SkuWorkbookSummary Reject(SkuWorkbookSummary summary, string reason)
        {
            summary.SafeToPreview = false;
            summary.Failure = reason;
            return summary;
        }

        private static List<string> SharedStrings(ZipArchive zip)
        {
            var entry = zip.GetEntry("xl/sharedStrings.xml");
            if (entry == null) return new List<string>();
            if (entry.Length > 45_000_000) throw new InvalidDataException();
            var strings = new List<string>();
            using (var reader = XmlReader.Create(entry.Open(), ReaderSettings()))
            {
                while (!reader.EOF)
                {
                    if (reader.NodeType != XmlNodeType.Element || reader.LocalName != "si")
                    {
                        reader.Read();
                        continue;
                    }
                    if (strings.Count >= 600000) throw new InvalidDataException();
                    var node = (XElement)XNode.ReadFrom(reader);
                    var value = string.Concat(node.Descendants(N + "t")
                        .Select(x => x.Value));
                    if (value.Length > 5000) throw new InvalidDataException();
                    strings.Add(value);
                }
            }
            return strings;
        }

        private static Dictionary<string, string> ReadRow(XElement row, List<string> shared)
        {
            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var cell in row.Elements(N + "c"))
            {
                var reference = (string)cell.Attribute("r") ?? "";
                var column = new string(reference.TakeWhile(char.IsLetter).ToArray());
                if (column.Length == 0 || column.Length > 3) continue;
                var type = (string)cell.Attribute("t") ?? "";
                var raw = (string)cell.Element(N + "v") ?? "";
                string value;
                if (type == "s")
                {
                    int index;
                    if (!int.TryParse(raw, out index) || index < 0 || index >= shared.Count)
                        throw new InvalidDataException("Invalid sharedString index.");
                    value = shared[index];
                }
                else if (type == "inlineStr")
                    value = string.Concat(cell.Descendants(N + "t").Select(t => t.Value));
                else if (cell.Element(N + "f") != null)
                    throw new InvalidDataException("Formula-backed values are not import proof.");
                else
                    value = raw;
                map[column] = value;
            }
            return map;
        }

        private static string Cell(Dictionary<string, string> fields, string key)
        {
            string value;
            return key != null && fields.TryGetValue(key, out value) ? value : "";
        }

        private static string NormalizeHeader(string input)
        {
            var unicode = (input ?? "").Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder();
            foreach (var c in unicode)
            {
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) ==
                    System.Globalization.UnicodeCategory.NonSpacingMark) continue;
                builder.Append(c == '\u0111' ? 'd' : c);
            }
            return string.Join(" ", builder.ToString().Split(
                (char[])null, StringSplitOptions.RemoveEmptyEntries));
        }
    }
}
