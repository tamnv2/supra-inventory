using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

namespace D167SkuSyncTest
{
    internal sealed class SkuSyncFlow
    {
        private const string ExportUrl =
            "https://api-supra.winmart.vn/sft3-hy1/api/v1/report/stock/exportBinStocks" +
            "?FromWH=true&Content=&ClientCode=WIN&WhCode=HY1&WarehouseSiteId=1291&PickupMethod=&IsConsign=false";
        private const string SignPath = "/api/v1/report/stock/exportBinStocks";
        private readonly WmsSession wms;
        private readonly InventoryClient inventory;
        private readonly Action<string> note;
        internal SkuSyncFlow(WmsSession browser, InventoryClient service, Action<string> logger)
        {
            wms=browser; inventory=service; note=logger;
        }

        internal void Run()
        {
            note("Bước 1/5: kiểm tra phiên Supra trong trình duyệt test riêng...");
            var credentials = wms.AuthorizedRequestHeaders();
            note("Supra: có headers của phiên WMS đã đăng nhập; không xuất token vào file hoặc log.");
            note("Bước 2/5: gửi GET exportBinStocks HY1, tạo nonce/chữ ký mới...");
            var bytes = Export(credentials);
            note("SUPRA EXPORT HTTP 200, nhận " + bytes.Length + " bytes XLSX.");
            var destination = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                "D167_REPORT_BIN_INVENTORY_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".xlsx");
            File.WriteAllBytes(destination,bytes);
            note("Đã lưu file vào Desktop: " + Path.GetFileName(destination));

            note("Bước 3/5: đọc SKU và Tên sản phẩm, không đọc/ghi vị trí...");
            var sku = SkuWorkbook.Parse(bytes);
            note("File hợp lệ: " + sku.Count + " SKU khác nhau.");
            if (sku.Count > 50000) throw new AppError("SKU_COUNT_TOO_LARGE");

            string hash;
            using(var sha = SHA256.Create())
                hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();
            var requestBase = "d167-test-" + Guid.NewGuid().ToString("N");
            var chunks = sku.Select((x,i)=>new { Item=x, Index=i })
                .GroupBy(x=>x.Index/1000).Select(g=>g.Select(x=>x.Item).ToList()).ToList();
            note("Bước 4/5: preview " + chunks.Count + " lô với Service Beta...");
            var conflicts = 0;
            var predicted = 0;
            for(int i=0;i<chunks.Count;i++)
            {
                var plan = inventory.PreviewOrImport(chunks[i],hash,requestBase+"-"+i,true,false);
                if (InventoryClient.Str(plan,"status")!="preview")
                    throw new AppError("SERVICE_PREVIEW_INVALID_CHUNK_"+(i+1));
                conflicts += InventoryClient.Num(plan,"conflict_count");
                predicted += InventoryClient.Num(plan,"inserted");
            }
            note("PREVIEW PASS: " + chunks.Count + " lô; mới=" + predicted + "; khác tên=" + conflicts + ".");
            var allowNameChanges = false;
            if (conflicts>0)
            {
                var answer = MessageBox.Show(
                    "Service nhận thấy "+conflicts+" SKU có tên sản phẩm khác dữ liệu hiện hành.\n"+
                    "Muốn tiếp tục cập nhật tên theo file Supra? Chọn No để dừng không ghi dữ liệu.",
                    "D167 - Xác nhận đổi tên SKU",MessageBoxButtons.YesNo,MessageBoxIcon.Warning);
                if (answer!=DialogResult.Yes) throw new AppError("SKU_NAME_CONFLICT_CANCELLED_NO_WRITE");
                allowNameChanges = true;
            }

            note("Bước 5/5: nhập thật từng lô lên Inventory Service Beta...");
            var inserted=0; var updated=0; var unchanged=0;
            for(int i=0;i<chunks.Count;i++)
            {
                Dictionary<string,object> result;
                try
                {
                    result = inventory.PreviewOrImport(chunks[i],hash,requestBase+"-"+i,
                        false,allowNameChanges);
                }
                catch(Exception ex)
                {
                    // A failed HTTP response does not prove server rollback.
                    note("IMPORT PARTIAL/UNCERTAIN: " + i + " lô trước đã gửi thành công. Không tự retry lô đang lỗi.");
                    throw new AppError("SERVICE_APPLY_UNCERTAIN_CHUNK_"+(i+1)+"_"+ex.GetType().Name);
                }
                if (InventoryClient.Str(result,"status")!="imported" ||
                    InventoryClient.Num(result,"total")!=chunks[i].Count)
                    throw new AppError("SERVICE_COMMIT_RECEIPT_INVALID_CHUNK_"+(i+1));
                inserted+=InventoryClient.Num(result,"inserted");
                updated+=InventoryClient.Num(result,"updated");
                unchanged+=InventoryClient.Num(result,"unchanged");
                note("Service đã commit lô "+(i+1)+"/"+chunks.Count+": "+
                    InventoryClient.Num(result,"inserted")+" SKU mới, "+
                    InventoryClient.Num(result,"updated")+" đổi tên.");
            }

            note("Đọc lại dữ liệu thực tế từ /api/skus...");
            var checks = new [] { sku[0], sku[sku.Count/2], sku[sku.Count-1] }
                .GroupBy(x=>x.Sku).Select(g=>g.First()).ToList();
            foreach(var expected in checks)
                if (!inventory.VerifyStoredSku(expected))
                    throw new AppError("SERVICE_READBACK_MISMATCH_SKU");
            note("ĐỐI SOÁT PASS: "+checks.Count+" SKU mẫu trùng mã/tên đã gửi.");
            note("DONE - ĐÃ GHI THẬT VÀO INVENTORY BETA: "+
                "tổng="+sku.Count+"; mới="+inserted+"; đổi tên="+updated+
                "; không đổi="+unchanged+". Không thay đổi vị trí.");
        }

        private static byte[] Export(Dictionary<string,string> credentials)
        {
            var nonce10 = RandomAlphaNumeric(10);
            var nonce4 = RandomAlphaNumeric(4);
            var time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            var signPrefix="910";
            var key = signPrefix+time+nonce4;
            var message = nonce10+"|"+SignPath;
            string signature;
            using(var sha = new HMACSHA256(Encoding.ASCII.GetBytes(key)))
                signature = signPrefix + BitConverter.ToString(
                    sha.ComputeHash(Encoding.ASCII.GetBytes(message))).Replace("-","").ToLowerInvariant();
            var nonce = nonce10+nonce4+time;

            var req=(HttpWebRequest)WebRequest.Create(ExportUrl);
            req.Method="GET";
            req.Accept="application/json, text/plain, */*";
            req.UserAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36";
            req.Referer="https://wms-supra.winmart.vn/";
            req.Headers["Origin"]="https://wms-supra.winmart.vn";
            req.AllowAutoRedirect=false;
            req.Timeout=180000;req.ReadWriteTimeout=180000;
            var proxy=WebRequest.GetSystemWebProxy();
            if(proxy!=null) proxy.Credentials=CredentialCache.DefaultNetworkCredentials;
            req.Proxy=proxy;
            foreach(var k in new [] { "authorization","token","apisid","appid","sid","scid",
                        "usid","warehouse","x-geo-region" })
            {
                string value;
                if(credentials.TryGetValue(k,out value) && !String.IsNullOrWhiteSpace(value))
                    req.Headers[k]=value;
            }
            req.Headers["x-signature"]=signature;
            req.Headers["x-signature-nonce"]=nonce;
            try
            {
                using(var response=(HttpWebResponse)req.GetResponse())
                {
                    if (response.StatusCode!=HttpStatusCode.OK)
                        throw new AppError("SUPRA_EXPORT_HTTP_"+(int)response.StatusCode);
                    using(var input=response.GetResponseStream())
                    using(var output=new MemoryStream())
                    {
                        var buffer=new byte[65536];int n;
                        while((n=input.Read(buffer,0,buffer.Length))>0)
                        {
                            if (output.Length+n>45L*1024*1024)
                                throw new AppError("SUPRA_EXPORT_FILE_TOO_LARGE");
                            output.Write(buffer,0,n);
                        }
                        var data=output.ToArray();
                        if(data.Length<4||data[0]!=0x50||data[1]!=0x4b)
                            throw new AppError("SUPRA_EXPORT_RETURNED_NON_XLSX");
                        return data;
                    }
                }
            }
            catch(WebException ex)
            {
                var response=ex.Response as HttpWebResponse;
                if(response!=null)
                {
                    var status=(int)response.StatusCode;
                    response.Dispose();
                    throw new AppError("SUPRA_EXPORT_HTTP_"+status);
                }
                throw new AppError("SUPRA_EXPORT_NETWORK_"+ex.Status);
            }
        }

        private static string RandomAlphaNumeric(int count)
        {
            const string chars="abcdefghijklmnopqrstuvwxyz0123456789";
            var bytes=new byte[count];
            using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);
            return new string(bytes.Select(b=>chars[b%chars.Length]).ToArray());
        }
    }
}
