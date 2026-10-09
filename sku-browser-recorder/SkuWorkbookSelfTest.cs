using System;
using System.IO;
using System.IO.Compression;
using System.Text;
namespace SupraSkuRecorder
{
    internal static class SkuWorkbookSelfTest
    {
        private const string Ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        internal static int Run()
        {
            var file = Path.Combine(Path.GetTempPath(),
                "d166-sku-parse-" + Guid.NewGuid().ToString("N") + ".xlsx");
            try
            {
                WriteSample(file, false, false);
                var ok = SkuWorkbookAudit.Inspect(file);
                if (!ok.SafeToPreview || ok.DataRows != 3 ||
                    ok.UniqueSkus != 2 || ok.RepeatedRows != 1 ||
                    ok.ConflictingNames != 0 || ok.SiteAlias != "hy1_1291")
                    throw new InvalidDataException("Unexpected unique/dedupe/warehouse guard.");
                WriteSample(file, true, false);
                var conflict = SkuWorkbookAudit.Inspect(file);
                if (conflict.SafeToPreview || conflict.ConflictingNames != 1 ||
                    conflict.Failure != "source_name_conflict")
                    throw new InvalidDataException("Duplicate name-conflict not blocked.");
                WriteSample(file, false, true);
                var warehouse = SkuWorkbookAudit.Inspect(file);
                if (warehouse.SafeToPreview || warehouse.Failure != "unexpected_dc_site")
                    throw new InvalidDataException("Foreign warehouse not blocked.");
                Console.WriteLine("D166_SKU_OOXML_VALIDATE_DEDUPE_CONFLICT_SITE=PASS");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("D166_SKU_SELFTEST_FAIL_TYPE=" + ex.GetType().Name);
                return 1;
            }
            finally { try { File.Delete(file); } catch { } }
        }

        private static void WriteSample(string file, bool conflicting, bool otherWarehouse)
        {
            if (File.Exists(file)) File.Delete(file);
            using (var zip = ZipFile.Open(file, ZipArchiveMode.Create))
            {
                Put(zip, "xl/workbook.xml",
                    "<workbook xmlns='" + Ns + "'><sheets><sheet name='Report' sheetId='1'/></sheets></workbook>");
                Put(zip, "xl/sharedStrings.xml",
                    "<sst xmlns='" + Ns + "'>" +
                    "<si><t>SKU</t></si><si><t>Tên sản phẩm</t></si>" +
                    "<si><t>DC Site</t></si><si><t>1291 - Urban</t></si>" +
                    "<si><t>SKU-TEST-0001</t></si><si><t>Synthetic Test Product</t></si>" +
                    "<si><t>SKU-TEST-0002</t></si><si><t>Synthetic Test Product B</t></si>" +
                    "<si><t>Synthetic Test Product Changed</t></si>" +
                    "<si><t>OTHER DC</t></si><si><t>Khách hàng</t></si><si><t>WIN</t></si></sst>");
                Put(zip, "xl/worksheets/sheet1.xml",
                    "<worksheet xmlns='" + Ns + "'><sheetData>" +
                    Row(1, Cell("A1", 10) + Cell("B1", 2) + Cell("C1", 0) + Cell("D1", 1)) +
                    Row(2, Cell("A2", 11) + Cell("B2", otherWarehouse ? 9 : 3) + Cell("C2", 4) + Cell("D2", 5)) +
                    Row(3, Cell("A3", 11) + Cell("B3", 3) + Cell("C3", 4) + Cell("D3", conflicting ? 8 : 5)) +
                    Row(4, Cell("A4", 11) + Cell("B4", 3) + Cell("C4", 6) + Cell("D4", 7)) +
                    "</sheetData></worksheet>");
            }
        }
        private static string Row(int index, string cells) => "<row r='" + index + "'>" + cells + "</row>";
        private static string Cell(string address, int sharedIndex) =>
            "<c r='" + address + "' t='s'><v>" + sharedIndex + "</v></c>";
        private static void Put(ZipArchive zip, string path, string xml)
        {
            var entry = zip.CreateEntry(path);
            using (var output = new StreamWriter(entry.Open(), new UTF8Encoding(false)))
                output.Write(xml);
        }
    }
}
