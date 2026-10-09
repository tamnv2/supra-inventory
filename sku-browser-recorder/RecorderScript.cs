namespace SupraSkuRecorder
{
    internal static class RecorderScript
    {
        // No freeform text or keyboard content is sent outside the page.
        // Only fixed aliases, safe extensions and byte lengths leave this script.
        internal const string Value = @"
(() => {
  if (window.__supraSkuRecorderInstalled) return;
  window.__supraSkuRecorderInstalled = true;
  const rules = [
    ['SKU_SYNC','đồng bộ'],['SKU_SYNC','synchronize'],
    ['DOWNLOAD','tải xuống'],['DOWNLOAD','tải file'],['DOWNLOAD','download'],
    ['EXPORT','xuất excel'],['EXPORT','xuất file'],['EXPORT','export'],
    ['UPLOAD','tải lên'],['UPLOAD','upload'],['IMPORT','nhập sku'],['IMPORT','import'],
    ['FILE_SELECT','chọn tệp'],['FILE_SELECT','chọn file'],
    ['NEXT','tiếp tục'],['SUBMIT','xác nhận'],['SAVE','lưu'],
    ['REFRESH','làm mới'],['SEARCH','tìm kiếm']
  ];
  function send(kind, code, ext, size) {
    try { window.chrome.webview.postMessage(JSON.stringify({
      kind: kind, code: code, ext: ext || 'none', size: size || 0
    })); } catch (_) {}
  }
  document.addEventListener('click', e => {
    const element = e.target && e.target.closest &&
      e.target.closest('button,a,[role=button],input[type=button],input[type=submit]');
    if (!element) return;
    const text = String(element.innerText || element.getAttribute('aria-label') ||
      element.getAttribute('title') || element.value || '')
      .normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    if (text.length > 100) return;
    const rule = rules.find(r => text === r[1] || text.startsWith(r[1] + ' '));
    if (rule) send('ui', rule[0], 'none', 0);
  }, true);
  document.addEventListener('change', e => {
    const element = e.target;
    if (!element || element.type !== 'file' || !element.files) return;
    const file = element.files[0];
    if (!file) return;
    const m = String(file.name).match(/\.[a-z0-9]{1,6}$/i);
    const ext = m ? m[0].toLowerCase() : '';
    send('file','UPLOAD_SELECTED',
      ['.xlsx','.xls','.csv','.zip'].includes(ext) ? ext.slice(1) : 'other',
      Math.min(Math.max(0, Number(file.size) || 0), 1000000000));
  }, true);
})();";
    }
}
