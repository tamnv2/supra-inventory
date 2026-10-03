using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace SupraInventoryRelayAgent
{
    /// <summary>
    /// D160 post-PASS diagnostic-only local telemetry helpers.
    /// No provider I/O, polling, business mutation or raw PickList/session material.
    /// </summary>
    internal static class D160DiagnosticTelemetry
    {
        private static long _pageEpoch;
        private static long _lastReloadIssuedMs;
        private static long _lastReloadPassMs;
        private static int _dirtyAfterConfirm;
        private static string _lastReloadReason = "";

        internal static long PageEpoch { get { return Math.Max(0L, Interlocked.Read(ref _pageEpoch)); } }
        internal static bool DirtyAfterConfirm { get { return Volatile.Read(ref _dirtyAfterConfirm) != 0; } }

        internal static long BeginReload(string reason)
        {
            var now = NowMs();
            Interlocked.Exchange(ref _lastReloadIssuedMs, now);
            Interlocked.Exchange(ref _dirtyAfterConfirm, 0);
            _lastReloadReason = SafeReason(reason);
            return Interlocked.Increment(ref _pageEpoch);
        }

        internal static void MarkReloadPass()
        {
            Interlocked.Exchange(ref _lastReloadPassMs, NowMs());
            Interlocked.Exchange(ref _dirtyAfterConfirm, 0);
        }

        internal static void MarkFinalClick()
        {
            Interlocked.Exchange(ref _dirtyAfterConfirm, 1);
        }

        internal static long ReloadAgeMs
        {
            get
            {
                var last = Interlocked.Read(ref _lastReloadPassMs);
                return last <= 0 ? -1L : Math.Max(0L, NowMs() - last);
            }
        }

        internal static long ReloadIssuedAgeMs
        {
            get
            {
                var last = Interlocked.Read(ref _lastReloadIssuedMs);
                return last <= 0 ? -1L : Math.Max(0L, NowMs() - last);
            }
        }

        internal static string LastReloadReason { get { return _lastReloadReason ?? ""; } }

        internal static string SafeHash(string value)
        {
            if (string.IsNullOrEmpty(value)) return "none";
            try
            {
                using (var sha = SHA256.Create())
                {
                    var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
                    var sb = new StringBuilder();
                    for (var i = 0; i < 6 && i < hash.Length; i++)
                        sb.Append(hash[i].ToString("x2"));
                    return sb.ToString();
                }
            }
            catch
            {
                return "hash_error";
            }
        }

        internal static string SafeReason(string value)
        {
            var raw = (value ?? "unknown").Trim();
            if (raw.Length == 0) raw = "unknown";
            var sb = new StringBuilder();
            foreach (var ch in raw)
            {
                if (char.IsLetterOrDigit(ch) || ch == '_' || ch == '-')
                    sb.Append(ch);
                else if (ch == ' ')
                    sb.Append('_');
                if (sb.Length >= 48) break;
            }
            return sb.Length == 0 ? "unknown" : sb.ToString();
        }

        internal static string Flag(bool value) { return value ? "1" : "0"; }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }

    internal sealed partial class SupraConfirmBrowser
    {
        private Dictionary<string, object> D160DiagnosticPageStateNoLock()
        {
            try
            {
                var raw = EvaluateJsonNoLock(BuildD160DiagnosticPageStateScript());
                return _json.DeserializeObject(raw) as Dictionary<string, object>
                    ?? new Dictionary<string, object>(StringComparer.Ordinal);
            }
            catch
            {
                return new Dictionary<string, object>(StringComparer.Ordinal);
            }
        }

        private void LogD160DiagnosticPageStateNoLock(string stage, long elapsedMs = -1L)
        {
            var map = D160DiagnosticPageStateNoLock();
            _log("D160_DIAG WMS_PAGE stage=" + D160DiagnosticTelemetry.SafeReason(stage) +
                 " epoch=" + D160DiagnosticTelemetry.PageEpoch +
                 " dirty_after_confirm=" + D160DiagnosticTelemetry.Flag(D160DiagnosticTelemetry.DirtyAfterConfirm) +
                 " reload_age_ms=" + D160DiagnosticTelemetry.ReloadAgeMs +
                 " reload_reason=" + D160DiagnosticTelemetry.LastReloadReason +
                 " page_size=" + SafeDiagnosticValue(String(map, "pageSize")) +
                 " rows=" + Math.Max(0, Int(map, "rowCount")) +
                 " picklist_codes=" + Math.Max(0, Int(map, "picklistCodeCount")) +
                 " checkboxes=" + Math.Max(0, Int(map, "checkboxCount")) +
                 " checkbox_disabled=" + Math.Max(0, Int(map, "disabledCheckboxCount")) +
                 " dialogs=" + Math.Max(0, Int(map, "dialogCount")) +
                 " success_surfaces=" + Math.Max(0, Int(map, "successSurfaceCount")) +
                 " error_surfaces=" + Math.Max(0, Int(map, "errorSurfaceCount")) +
                 (elapsedMs >= 0 ? " elapsed_ms=" + elapsedMs : ""));
        }

        private void LogD160DiagnosticTargetSnapshotNoLock(string stage, List<string> codes)
        {
            if (codes == null || codes.Count == 0) return;
            try
            {
                var raw = EvaluateJsonNoLock(BuildD160DiagnosticTargetStateScript(codes));
                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                var items = map != null && map.TryGetValue("targets", out var targetObj)
                    ? targetObj as object[]
                    : null;
                var parts = new List<string>();
                if (items != null)
                {
                    for (var i = 0; i < items.Length && i < 15; i++)
                    {
                        var item = items[i] as Dictionary<string, object>;
                        if (item == null) continue;
                        parts.Add(
                            i + ":m" + Math.Max(0, Int(item, "matches")) +
                            "c" + Math.Max(0, Int(item, "checkboxes")) +
                            "e" + Math.Max(0, Int(item, "enabled")) +
                            "k" + Math.Max(0, Int(item, "checked")) +
                            "r" + Math.Max(0, Int(item, "confirmedMarker")) +
                            "b" + Math.Max(0, Int(item, "markerBeforeCheckbox")));
                    }
                }
                _log("D160_DIAG WMS_TARGET stage=" + D160DiagnosticTelemetry.SafeReason(stage) +
                     " epoch=" + D160DiagnosticTelemetry.PageEpoch +
                     " dirty_after_confirm=" + D160DiagnosticTelemetry.Flag(D160DiagnosticTelemetry.DirtyAfterConfirm) +
                     " targets=" + codes.Count +
                     " states=" + (parts.Count == 0 ? "none" : string.Join(",", parts.ToArray())));
            }
            catch (Exception ex)
            {
                _log("D160_DIAG WMS_TARGET stage=" + D160DiagnosticTelemetry.SafeReason(stage) +
                     " snapshot=UNAVAILABLE type=" + ex.GetType().Name);
            }
        }

        private static string SafeDiagnosticValue(string value)
        {
            var raw = (value ?? "").Trim();
            if (raw.Length == 0) return "unknown";
            foreach (var ch in raw)
                if (!(char.IsLetterOrDigit(ch) || ch == '_' || ch == '-')) return "unknown";
            return raw.Length <= 24 ? raw : raw.Substring(0, 24);
        }

        private static string BuildD160DiagnosticPageStateScript()
        {
            return @"(() => {
              const norm = v => String(v || '').replace(/[\u200B-\u200D\uFEFF]/g,' ').replace(/\s+/g,' ').trim();
              const visible = e => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
              const docs = [];
              const seen = new Set();
              const addDoc = d => {
                if (!d || seen.has(d) || docs.length >= 8) return;
                seen.add(d); docs.push(d);
                for (const frame of [...d.querySelectorAll('iframe')]) {
                  try { if (frame.contentDocument) addDoc(frame.contentDocument); } catch (_) {}
                }
              };
              addDoc(document);
              const rows = docs.flatMap(d => [...d.querySelectorAll('tr,[role=row]')]).filter(visible);
              const codes = new Set();
              for (const row of rows) {
                const found = ((row.innerText || row.textContent || '').toUpperCase().match(/\bPL[0-9]+\b/g) || []);
                for (const code of found) codes.add(code);
              }
              const boxes = docs.flatMap(d => [...d.querySelectorAll('input[type=checkbox],[role=checkbox]')]).filter(visible);
              const disabled = boxes.filter(e => e.disabled || e.getAttribute('aria-disabled') === 'true');
              const dialogs = docs.flatMap(d => [...d.querySelectorAll('[role=dialog],.modal-dialog,.modal-content,.mat-dialog-container,.mat-mdc-dialog-container,.ant-modal,.swal2-popup')]).filter(visible);
              const success = docs.flatMap(d => [...d.querySelectorAll('.toast-success,.alert-success,.swal2-success,[role=alert]')]).filter(visible);
              const errors = docs.flatMap(d => [...d.querySelectorAll('.toast-error,.alert-danger,.alert-error,.swal2-error,[role=alert]')]).filter(visible);

              let pageSize = 'unknown';
              const labels = docs.flatMap(d => [...d.querySelectorAll('body *')]).filter(e => visible(e) && norm(e.innerText || e.textContent) === 'Số dòng mỗi trang');
              const allowed = /^(5|7|10|25|50|100)$/;
              for (const label of labels) {
                let host = label.parentElement;
                for (let depth = 0; host && depth < 8; depth++, host = host.parentElement) {
                  const controls = [...host.querySelectorAll('select,[role=combobox],mat-select,.mat-select-trigger,.mat-mdc-select-trigger')].filter(visible);
                  for (const control of controls) {
                    const current = norm(control.value || control.innerText || control.textContent);
                    const match = current.match(/(?:^|\s)(5|7|10|25|50|100)(?:\s|$)/);
                    if (match && allowed.test(match[1])) { pageSize = match[1]; break; }
                  }
                  if (pageSize !== 'unknown') break;
                }
                if (pageSize !== 'unknown') break;
              }
              return JSON.stringify({
                pageSize,
                rowCount:rows.length,
                picklistCodeCount:codes.size,
                checkboxCount:boxes.length,
                disabledCheckboxCount:disabled.length,
                dialogCount:dialogs.length,
                successSurfaceCount:success.length,
                errorSurfaceCount:errors.length
              });
            })()";
        }

        private static string BuildD160DiagnosticTargetStateScript(List<string> codes)
        {
            var jsCodes = string.Join(",", (codes ?? new List<string>()).Select(code => "'" + JavaScriptString(code) + "'"));
            return @"(() => {
              const targets = [" + jsCodes + @"];
              const norm = v => String(v || '').replace(/[\u200B-\u200D\uFEFF]/g,' ').replace(/\s+/g,' ').trim();
              const visible = e => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
              const docs = [];
              const seen = new Set();
              const addDoc = d => {
                if (!d || seen.has(d) || docs.length >= 8) return;
                seen.add(d); docs.push(d);
                for (const frame of [...d.querySelectorAll('iframe')]) {
                  try { if (frame.contentDocument) addDoc(frame.contentDocument); } catch (_) {}
                }
              };
              addDoc(document);
              const rows = docs.flatMap(d => [...d.querySelectorAll('tr,[role=row]')]).filter(visible);
              const out = [];
              for (const code of targets) {
                const matches = rows.filter(row => {
                  const found = [...new Set(((row.innerText || row.textContent || '').toUpperCase().match(/\bPL[0-9]+\b/g) || []))];
                  return found.includes(code);
                });
                let checkboxes = 0, enabled = 0, checked = 0, confirmedMarker = 0, markerBeforeCheckbox = 0;
                for (const row of matches) {
                  const boxes = [...row.querySelectorAll('input[type=checkbox],[role=checkbox]')].filter(visible);
                  checkboxes += boxes.length;
                  enabled += boxes.filter(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true').length;
                  checked += boxes.filter(e => e.checked || e.getAttribute('aria-checked') === 'true').length;
                  const leaves = [...row.querySelectorAll('*')].filter(e =>
                    visible(e) &&
                    norm(e.innerText || e.textContent) === 'Xác nhận lấy lại hàng' &&
                    !e.matches('button,a,[role=button],input[type=button],input[type=submit]') &&
                    ![...e.children].some(child => visible(child) && norm(child.innerText || child.textContent) === 'Xác nhận lấy lại hàng'));
                  confirmedMarker += leaves.length;
                  const firstBox = boxes.length ? boxes[0] : null;
                  if (firstBox) {
                    markerBeforeCheckbox += leaves.filter(marker =>
                      !!(marker.compareDocumentPosition(firstBox) & Node.DOCUMENT_POSITION_FOLLOWING)).length;
                  }
                }
                out.push({matches:matches.length,checkboxes,enabled,checked,confirmedMarker,markerBeforeCheckbox});
              }
              return JSON.stringify({targets:out});
            })()";
        }
    }
}
