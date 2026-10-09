using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace SupraSkuRecorder
{
    internal sealed partial class RecorderForm
    {
        // Diagnostic-only DOM map: never reads input values, tables, raw labels,
        // URLs, request traffic, cookie/session state, or document content.
        // Helps establish field evidence before a future V3 auto-click selector.
        private const string V3ProbeJs = @"
(() => {
  const onSku = location.hostname === 'wms-supra.winmart.vn'
    && location.pathname === '/sft3/app/report/bin-inventory';
  if (!onSku) return JSON.stringify({reason:'outside_bin_inventory',controls:[]});
  const norm = value => String(value || '').normalize('NFC')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const alias = value => {
    const v = norm(value);
    if (v === 'đồng bộ' || v === 'cập nhật' || v === 'synchronize' || v === 'sync') return 'sync';
    if (v === 'tải excel' || v === 'xuất excel' || v === 'export excel') return 'excel';
    if (v === 'tải xuống' || v === 'download' || v === 'tải file') return 'download';
    if (v === 'xuất' || v === 'export') return 'export';
    if (v === 'tìm kiếm' || v === 'search') return 'search';
    if (v === 'xác nhận' || v === 'confirm') return 'confirm';
    return 'other';
  };
  const digest = value => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++)
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
    return hash.toString(16).padStart(8,'0');
  };
  const items = [...document.querySelectorAll('button,a,[role=button]')]
    .filter(e => e.getBoundingClientRect && e.getBoundingClientRect().width > 0
      && e.getBoundingClientRect().height > 0).slice(0, 160);
  const controls = items.map((e, index) => {
    const raw = e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || '';
    const classes = String(e.className && typeof e.className === 'string' ? e.className : '')
      .split(/\s+/).filter(c => /^[a-zA-Z][a-zA-Z0-9_-]{0,48}$/.test(c)).slice(0,6).join('.');
    const kind = (e.tagName || '').toLowerCase();
    const signature = digest(kind + '|' + classes + '|' + index);
    return {index,kind,alias:alias(raw),signature};
  });
  return JSON.stringify({reason:'mapped',controls, count:items.length});
})();";

        private async Task CaptureSkuUiAsync()
        {
            if (!ready || browser.CoreWebView2 == null)
            {
                Log("DOM_PROBE_BLOCKED", "webview2", "not_ready");
                return;
            }
            try
            {
                var encoded = await browser.CoreWebView2.ExecuteScriptAsync(V3ProbeJs);
                var json = JsonSerializer.Deserialize<string>(encoded);
                using (var root = JsonDocument.Parse(json ?? "{}"))
                {
                    var obj = root.RootElement;
                    var reason = obj.TryGetProperty("reason", out var reasonValue)
                        ? reasonValue.GetString() ?? "unknown" : "unknown";
                    if (reason != "mapped")
                    {
                        Log("DOM_PROBE_BLOCKED", "page", "outside_bin_inventory");
                        MessageBox.Show("Hãy mở trang Bin Inventory và chờ tải xong rồi quét lại.",
                            "V3 kiểm tra giao diện");
                        return;
                    }
                    if (!obj.TryGetProperty("controls", out var controls) ||
                        controls.ValueKind != JsonValueKind.Array) return;
                    var total = 0;
                    foreach (var control in controls.EnumerateArray())
                    {
                        if (total >= 160) break;
                        var kind = control.GetProperty("kind").GetString() ?? "";
                        var alias = control.GetProperty("alias").GetString() ?? "";
                        var signature = control.GetProperty("signature").GetString() ?? "";
                        var index = control.GetProperty("index").GetInt32();
                        if (index < 0 || index > 159 || signature.Length != 8 ||
                            !System.Text.RegularExpressions.Regex.IsMatch(signature, "^[a-f0-9]{8}$") ||
                            !new[] { "button", "a" }.Contains(kind) &&
                            kind != "div" && kind != "span")
                            continue;
                        if (!new[] { "sync", "excel", "download", "export",
                            "search", "confirm", "other" }.Contains(alias)) continue;
                        Log("DOM_CONTROL", alias, kind + "_" + signature, index);
                        total++;
                    }
                    Log("DOM_PROBE_DONE", "bin_inventory", "controls", total);
                    MessageBox.Show("Đã ghi bản đồ " + total + " điều khiển giao diện (không có nội dung SKU/mật khẩu).\n" +
                        "Anh thao tác đồng bộ và tải Excel như bình thường, sau đó xuất ZIP để xác nhận đúng vị trí nút.",
                        "V3 kiểm tra giao diện");
                }
            }
            catch (Exception)
            {
                Log("DOM_PROBE_FAILED", "webview2", "script_error");
                MessageBox.Show("Không đọc được cấu trúc điều khiển giao diện Bin Inventory.",
                    "V3 kiểm tra giao diện");
            }
        }
    }
}
