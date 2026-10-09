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
  const digest = value => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++)
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
    return hash.toString(16).padStart(8, '0');
  };
  const actionAlias = value => {
    const v = String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    if (['đồng bộ','cập nhật','sync','synchronize'].includes(v)) return 'sync';
    if (['tải excel','xuất excel','export excel'].includes(v)) return 'excel';
    if (['download','tải xuống','tải file'].includes(v)) return 'download';
    if (['xuất','export'].includes(v)) return 'export';
    if (['tìm kiếm','search'].includes(v)) return 'search';
    if (['xác nhận','confirm'].includes(v)) return 'confirm';
    return 'other';
  };
  document.addEventListener('click', e => {
    if (location.hostname !== 'wms-supra.winmart.vn' ||
        location.pathname !== '/sft3/app/report/bin-inventory') return;
    const el = e.target && e.target.closest &&
      e.target.closest('button,a,[role=button]');
    if (!el) return;
    const visible = [...document.querySelectorAll('button,a,[role=button]')]
      .filter(node => node.getBoundingClientRect && node.getBoundingClientRect().width > 0 &&
        node.getBoundingClientRect().height > 0).slice(0,160);
    const index = visible.indexOf(el);
    if (index < 0 || index > 159) return;
    const kind = (el.tagName || '').toLowerCase();
    const classes = String(el.className && typeof el.className === 'string' ? el.className : '')
      .split(/\s+/).filter(c => /^[a-zA-Z][a-zA-Z0-9_-]{0,48}$/.test(c)).slice(0,6).join('.');
    const signature = digest(kind + '|' + classes + '|' + index);
    const title = el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '';
    send('trace', actionAlias(title), kind + '_' + signature, index);
  }, true);
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
