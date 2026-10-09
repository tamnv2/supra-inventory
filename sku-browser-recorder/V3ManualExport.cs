using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraSkuRecorder
{
    internal sealed partial class RecorderForm
    {
        private readonly SemaphoreSlim _skuUiExportLock = new SemaphoreSlim(1, 1);
        private TaskCompletionSource<string> _skuFileDownload;

        // Bounded, deliberate foreground UI interaction only. This test tool is
        // not the production PRIMARY daily scheduler and cannot mutate Inventory.
        private const string BinSnapshot = @"
(() => {
  if (location.hostname !== 'wms-supra.winmart.vn' ||
      location.pathname !== '/sft3/app/report/bin-inventory')
    return JSON.stringify({state:'wrong_page'});
  const normalize = v => String(v || '').normalize('NFC')
    .replace(/\s+/g,' ').trim().toLowerCase();
  const visible = e => e.getBoundingClientRect &&
    e.getBoundingClientRect().width > 0 &&
    e.getBoundingClientRect().height > 0 && !e.disabled;
  const buttons = [...document.querySelectorAll('button,[role=button],a')]
    .filter(visible).slice(0,200);
  const labels = buttons.map(x => normalize(x.innerText ||
    x.getAttribute('aria-label') || x.getAttribute('title') || ''));
  const search = labels.filter(x => x === 'tìm kiếm' || x === 'search').length;
  const exportButton = labels.filter(x => x === 'export' || x === 'xuất excel').length;
  const busy = !!document.querySelector(
    '.ant-spin-spinning,.MuiCircularProgress-root,[aria-busy=true],.ag-overlay-loading-center');
  const rows = document.querySelectorAll(
    'table tbody tr,.ant-table-row,.ag-center-cols-container .ag-row').length;
  return JSON.stringify({state:'ok',search,exportButton,busy,rows});
})()";
        private const string BinClick = @"
(action => {
  if (location.hostname !== 'wms-supra.winmart.vn' ||
      location.pathname !== '/sft3/app/report/bin-inventory')
    return 'wrong_page';
  const normalize = v => String(v || '').normalize('NFC')
    .replace(/\s+/g,' ').trim().toLowerCase();
  const visible = e => e.getBoundingClientRect &&
    e.getBoundingClientRect().width > 0 &&
    e.getBoundingClientRect().height > 0 && !e.disabled;
  const items = [...document.querySelectorAll('button,[role=button],a')]
    .filter(visible).filter(el => {
      const text = normalize(el.innerText || el.getAttribute('aria-label') ||
        el.getAttribute('title') || '');
      return action === 'search' ? (text === 'tìm kiếm' || text === 'search')
        : (text === 'export' || text === 'xuất excel');
    });
  if (items.length !== 1) return 'not_unique_' + items.length;
  items[0].click();
  return 'clicked';
})";

        private async Task StartManualSkuExportAsync()
        {
            if (!_skuUiExportLock.Wait(0))
            {
                Log("SKU_UI_DEFER", "operation", "already_running");
                return;
            }
            try
            {
                if (!ready || browser.CoreWebView2 == null)
                {
                    ShowSkuUiMessage("Trình duyệt chưa sẵn sàng.");
                    return;
                }
                var initial = await ReadSkuUiStatus();
                if (initial.state != "ok" || initial.search != 1 || initial.exportButton != 1)
                {
                    Log("SKU_UI_BLOCKED", "button_map", "unavailable");
                    ShowSkuUiMessage("Trang Bin Inventory chưa có đúng một nút Tìm Kiếm và Export. " +
                        "Dừng để tránh thao tác nhầm. Hãy mở đúng trang, đăng nhập Supra và thử lại.");
                    return;
                }

                var clicked = await ExecuteSkuClick("search");
                if (clicked != "clicked")
                {
                    Log("SKU_SEARCH_FAILED", "ui", "not_unique");
                    ShowSkuUiMessage("Không thể ấn Tìm Kiếm an toàn.");
                    return;
                }
                Log("SKU_SEARCH_CLICKED", "bin_inventory", "manual_test");

                // Never click Export immediately after Search. Allow a bounded
                // response settling interval and reject ambiguous page state.
                int stable = 0;
                int previousRows = -1;
                for (int attempt = 0; attempt < 24; attempt++)
                {
                    await Task.Delay(700);
                    var current = await ReadSkuUiStatus();
                    if (current.state != "ok")
                        throw new InvalidOperationException("sku_page_lost");
                    if (current.busy || current.rows < 1 || current.exportButton != 1)
                    {
                        stable = 0;
                        previousRows = -1;
                        continue;
                    }
                    stable = current.rows == previousRows ? stable + 1 : 0;
                    previousRows = current.rows;
                    if (stable >= 3 && attempt >= 4) break;
                }
                if (stable < 3)
                {
                    Log("SKU_EXPORT_BLOCKED", "ui", "search_unsettled");
                    ShowSkuUiMessage("Báo cáo chưa ổn định sau Tìm Kiếm. Không tự Export.");
                    return;
                }
                // A one-shot download watcher catches WebView2 downloads only,
                // and never captures network headers, cookies or body traffic.
                _skuFileDownload = new TaskCompletionSource<string>(
                    TaskCreationOptions.RunContinuationsAsynchronously);
                var exported = await ExecuteSkuClick("export");
                if (exported != "clicked")
                {
                    Log("SKU_EXPORT_FAILED", "ui", "not_unique");
                    ShowSkuUiMessage("Không thể ấn Export an toàn.");
                    return;
                }
                Log("SKU_EXPORT_CLICKED", "bin_inventory", "manual_test");
                var completed = await Task.WhenAny(_skuFileDownload.Task, Task.Delay(120000));
                if (completed != _skuFileDownload.Task ||
                    _skuFileDownload.Task.IsFaulted ||
                    _skuFileDownload.Task.IsCanceled)
                {
                    Log("SKU_EXPORT_FAILED", "download", "timeout_or_interrupted");
                    ShowSkuUiMessage("Export không hoàn tất trong thời gian giới hạn.");
                    return;
                }
                var localFile = await _skuFileDownload.Task;
                Log("SKU_DOWNLOAD_COMPLETED", "xlsx", "local_file_only");
                await InspectSkuFileAsync(localFile, "downloaded");
            }
            catch (Exception)
            {
                Log("SKU_UI_FAILED", "ui", "unexpected");
                ShowSkuUiMessage("Không hoàn thành được Tìm Kiếm → Export an toàn. " +
                    "Xem log mã lỗi (không chứa dữ liệu SKU) và thử thao tác thủ công.");
            }
            finally
            {
                _skuFileDownload = null;
                _skuUiExportLock.Release();
            }
        }

        private void CaptureDownloadCompletion(string path, bool success)
        {
            var target = _skuFileDownload;
            if (target == null) return;
            if (!success || !string.Equals(System.IO.Path.GetExtension(path),
                ".xlsx", StringComparison.OrdinalIgnoreCase))
                target.TrySetException(new InvalidOperationException("download_unavailable"));
            else target.TrySetResult(path);
        }

        private async Task<(string state, int search, int exportButton, bool busy, int rows)> ReadSkuUiStatus()
        {
            var payload = await browser.CoreWebView2.ExecuteScriptAsync(BinSnapshot);
            var raw = JsonSerializer.Deserialize<string>(payload);
            using (var doc = JsonDocument.Parse(raw ?? "{}"))
            {
                var o = doc.RootElement;
                if (!o.TryGetProperty("state", out var st) || st.GetString() != "ok")
                    return ("wrong_page", 0, 0, true, 0);
                int Number(string key)
                {
                    JsonElement e;
                    return o.TryGetProperty(key, out e) && e.TryGetInt32(out int n) ? n : 0;
                }
                var busy = o.TryGetProperty("busy", out var b) && b.ValueKind == JsonValueKind.True;
                return ("ok", Number("search"), Number("exportButton"), busy, Number("rows"));
            }
        }

        private async Task<string> ExecuteSkuClick(string operation)
        {
            var js = BinClick + "('" + (operation == "search" ? "search" : "export") + "')";
            var raw = await browser.CoreWebView2.ExecuteScriptAsync(js);
            return JsonSerializer.Deserialize<string>(raw) ?? "";
        }

        private void ShowSkuUiMessage(string message)
        {
            if (!IsDisposed) MessageBox.Show(this, message, "D166 SKU V3 - kiểm tra giao diện",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
