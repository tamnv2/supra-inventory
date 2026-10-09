using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraSkuRecorder
{
    internal sealed partial class RecorderForm
    {
        private int _skuAuditRunning;

        private void SelectSkuWorkbook()
        {
            using (var picker = new OpenFileDialog
            {
                Title = "Chọn file Bin Inventory để kiểm tra an toàn",
                Filter = "Bin Inventory Excel (*.xlsx)|*.xlsx",
                Multiselect = false,
                CheckFileExists = true
            })
            {
                if (picker.ShowDialog(this) != DialogResult.OK) return;
                _ = InspectSkuFileAsync(picker.FileName, "manual");
            }
        }

        private async Task InspectSkuFileAsync(string filename, string source)
        {
            if (Interlocked.CompareExchange(ref _skuAuditRunning, 1, 0) != 0)
            {
                Log("SKU_FILE_AUDIT_DEFER", "file", "already_running");
                return;
            }
            try
            {
                Log("SKU_FILE_AUDIT_START", "xlsx", source);
                // CPU/file parsing runs outside WebView2/Confirm UI thread.
                var result = await Task.Run(() => SkuWorkbookAudit.Inspect(filename));
                Log(result.SafeToPreview ? "SKU_FILE_AUDIT_PASS" : "SKU_FILE_AUDIT_FAIL",
                    result.SafeToPreview ? "hy1_1291" : "file_validation",
                    result.SafeToPreview ? "validated" : SafeFailureAlias(result.Failure),
                    result.UniqueSkus);
                Log("SKU_FILE_ROW_COUNT", "xlsx", "total_rows", result.DataRows);
                Log("SKU_FILE_DUPLICATES", "xlsx", "repeated_rows", result.RepeatedRows);
                Log("SKU_FILE_CONFLICTS", "xlsx", "name_variants", result.ConflictingNames);
                if (IsDisposed || Disposing) return;
                var summary = "Tổng dòng: " + result.DataRows.ToString("N0") +
                    "\nSKU duy nhất: " + result.UniqueSkus.ToString("N0") +
                    "\nDòng lặp theo SKU: " + result.RepeatedRows.ToString("N0") +
                    "\nSKU khác tên trong file: " + result.ConflictingNames.ToString("N0") +
                    "\nDòng không hợp lệ: " + result.InvalidRows.ToString("N0");
                if (result.SafeToPreview)
                {
                    status.Text = "Đã kiểm tra: " + result.UniqueSkus.ToString("N0") + " SKU";
                    MessageBox.Show(this, "Kiểm tra file thành công.\n" + summary +
                        "\n\nBản V3 preflight chưa ghi dữ liệu lên Service.",
                        "D166 SKU — kiểm tra Excel", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else
                {
                    status.Text = "Kiểm tra file chưa đạt";
                    MessageBox.Show(this,
                        "File chưa đạt yêu cầu: " + SafeFailureAlias(result.Failure) +
                        "\n" + summary + "\nKhông gửi lên Service.",
                        "D166 SKU — từ chối file", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
            catch
            {
                Log("SKU_FILE_AUDIT_FAIL", "xlsx", "unexpected");
            }
            finally { Interlocked.Exchange(ref _skuAuditRunning, 0); }
        }

        private static string SafeFailureAlias(string failure)
        {
            switch (failure)
            {
                case "invalid_file_size":
                case "requires_xlsx":
                case "entry_count_limit":
                case "invalid_ooxml_sheet":
                case "invalid_row_position":
                case "row_limit":
                case "missing_header":
                case "missing_site_column":
                case "unexpected_dc_site":
                case "invalid_sku_rows":
                case "source_name_conflict":
                case "invalid_archive":
                case "invalid_xml":
                case "io_error":
                case "access_denied":
                    return failure;
                default: return "validation_error";
            }
        }
    }
}
