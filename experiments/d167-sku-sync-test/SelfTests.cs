using System;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace D167SkuSyncTest
{
    internal static class SelfTests
    {
        internal static int Run()
        {
            var valid = MakeWorkbook(
                "<row r='1'><c r='A1' t='inlineStr'><is><t>SKU</t></is></c>"+
                "<c r='B1' t='inlineStr'><is><t>Tên sản phẩm</t></is></c></row>"+
                "<row r='2'><c r='A2' t='inlineStr'><is><t>000123</t></is></c>"+
                "<c r='B2' t='inlineStr'><is><t>Sản phẩm A</t></is></c></row>"+
                "<row r='3'><c r='A3' t='inlineStr'><is><t>000123</t></is></c>"+
                "<c r='B3' t='inlineStr'><is><t>Sản phẩm A</t></is></c></row>"+
                "<row r='4'><c r='A4' t='inlineStr'><is><t>333444</t></is></c>"+
                "<c r='B4' t='inlineStr'><is><t>Sản phẩm B</t></is></c></row>");
            var items = SkuWorkbook.Parse(valid);
            if(items.Count!=2 || items[0].Sku!="000123" || items[1].ProductName!="Sản phẩm B")
                throw new AppError("OFFLINE_XLSX_DEDUPE_LOSS");
            var mismatch = MakeWorkbook(
                "<row r='1'><c r='A1' t='inlineStr'><is><t>SKU</t></is></c>"+
                "<c r='B1' t='inlineStr'><is><t>Tên sản phẩm</t></is></c></row>"+
                "<row r='2'><c r='A2' t='inlineStr'><is><t>000123</t></is></c>"+
                "<c r='B2' t='inlineStr'><is><t>Tên cũ</t></is></c></row>"+
                "<row r='3'><c r='A3' t='inlineStr'><is><t>000123</t></is></c>"+
                "<c r='B3' t='inlineStr'><is><t>Tên mới</t></is></c></row>");
            bool rejected=false;
            try { SkuWorkbook.Parse(mismatch); }
            catch(AppError) { rejected=true; }
            if(!rejected) throw new AppError("OFFLINE_CONFLICT_NOT_REJECTED");
            Console.WriteLine("D167 OFFLINE PASS: XLSX UTF8/leading zero/dedupe/name-conflict; no live API access");
            return 0;
        }

        private static byte[] MakeWorkbook(string rows)
        {
            using (var mem = new MemoryStream())
            {
                using (var zip = new ZipArchive(mem,ZipArchiveMode.Create,true))
                {
                    var entry=zip.CreateEntry("xl/worksheets/sheet1.xml");
                    using(var stream=entry.Open())
                    using(var writer=new StreamWriter(stream,new UTF8Encoding(false)))
                        writer.Write("<worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><sheetData>"+
                            rows+"</sheetData></worksheet>");
                }
                return mem.ToArray();
            }
        }
    }
}
