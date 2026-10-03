using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class SupraBrowserBulkConfirmResult
    {
        internal string Result = "CONFIRM_ERROR";
        internal string Detail = "";
        internal long ElapsedMs;
        internal bool FinalClicked;
        internal bool RecoveryReloaded;
        internal int TargetCount;
    }

    internal sealed partial class SupraConfirmBrowser
    {
        internal SupraBrowserBulkConfirmResult ConfirmManyExact(IEnumerable<string> fullPickListCodes, int terminalWaitMs = 3500, bool allowPreFinalRecovery = true)
        {
            var started = Stopwatch.StartNew();
            var result = new SupraBrowserBulkConfirmResult();
            var codes = (fullPickListCodes ?? new string[0])
                .Select(value => (value ?? "").Trim().ToUpperInvariant())
                .Where(value => Regex.IsMatch(value, "^PL[0-9]+$"))
                .Distinct(StringComparer.Ordinal)
                .ToList();
            result.TargetCount = codes.Count;
            if (codes.Count == 0 || codes.Count > 15)
            {
                result.Result = "EXACT_CODE_NOT_RESOLVED";
                result.Detail = codes.Count > 15 ? "BULK_LIMIT_EXCEEDED" : "NO_EXACT_CODE";
                return result;
            }

            lock (_gate)
            {
                ThrowIfDisposed();
                EnsureReadyNoLock();
                EnsurePageSize100NoLock();
                LogD160DiagnosticPageStateNoLock("PRE_CONFIRM_WAVE");
                LogD160DiagnosticTargetSnapshotNoLock("PRE_CONFIRM_WAVE", codes);

                var token = Guid.NewGuid().ToString("N");
                var step = EvaluateD160BulkMutationNoLock(codes, token);
                var stepResult = String(step, "result");
                var finalClicked = Bool(step, "finalClicked");
                _log("D160_DIAG CONFIRM_STEP phase=INITIAL result=" + D160DiagnosticTelemetry.SafeReason(stepResult) +
                     " targets=" + codes.Count +
                     " selected=" + Math.Max(0, Int(step, "selectedCount")) +
                     " baseline_terminals=" + Math.Max(0, Int(step, "baselineTerminalCount")) +
                     " final_clicked=" + D160DiagnosticTelemetry.Flag(finalClicked) +
                     " epoch=" + D160DiagnosticTelemetry.PageEpoch +
                     " dirty_before=" + D160DiagnosticTelemetry.Flag(D160DiagnosticTelemetry.DirtyAfterConfirm));

                if (!finalClicked && allowPreFinalRecovery && ShouldReloadBeforeFinalClick(stepResult))
                {
                    result.RecoveryReloaded = true;
                    _log("SUPRA_BROWSER d160_bulk_recovery=START reason=" + stepResult + " targets=" + codes.Count);
                    IssueConfirmReloadNowNoLock("d160_bulk_" + SafeReason(stepResult));
                    if (WaitForForcedConfirmReloadNoLock(TimeSpan.FromMilliseconds(5000)))
                    {
                        EnsurePageSize100NoLock();
                        ClickExactButtonNoLock(SearchText);
                        Thread.Sleep(700);
                        token = Guid.NewGuid().ToString("N");
                        step = EvaluateD160BulkMutationNoLock(codes, token);
                        stepResult = String(step, "result");
                        finalClicked = Bool(step, "finalClicked");
                        _log("D160_DIAG CONFIRM_STEP phase=RECOVERY result=" + D160DiagnosticTelemetry.SafeReason(stepResult) +
                             " targets=" + codes.Count +
                             " selected=" + Math.Max(0, Int(step, "selectedCount")) +
                             " baseline_terminals=" + Math.Max(0, Int(step, "baselineTerminalCount")) +
                             " final_clicked=" + D160DiagnosticTelemetry.Flag(finalClicked) +
                             " epoch=" + D160DiagnosticTelemetry.PageEpoch);
                    }
                    _log("SUPRA_BROWSER d160_bulk_recovery=END result=" + stepResult +
                         " final_clicked=" + (finalClicked ? "1" : "0"));
                }

                if (!finalClicked)
                {
                    result.Result = "CONFIRM_REJECTED";
                    result.Detail = string.IsNullOrWhiteSpace(stepResult) ? "BULK_PRE_FINAL_FAILURE" : stepResult;
                    started.Stop();
                    result.ElapsedMs = started.ElapsedMilliseconds;
                    _log("SUPRA_BROWSER d160_bulk result=" + result.Result +
                         " phase=pre_final detail=" + result.Detail +
                         " targets=" + codes.Count +
                         " recovery_reload=" + (result.RecoveryReloaded ? "1" : "0"));
                    return result;
                }

                result.FinalClicked = true;
                D160DiagnosticTelemetry.MarkFinalClick();
                var boundedTerminalWaitMs = Math.Max(800, Math.Min(4500, terminalWaitMs));
                var terminalStarted = Stopwatch.StartNew();
                var terminalSamples = 0;
                var terminalExceptions = 0;
                var maxFreshSuccess = 0;
                var maxFreshError = 0;
                var maxVisibleTerminal = 0;
                var maxSameBaseline = 0;
                var maxMutatedBaseline = 0;
                var maxNewTerminal = 0;
                var firstSignalMs = -1L;
                var deadline = DateTime.UtcNow.AddMilliseconds(boundedTerminalWaitMs);
                while (DateTime.UtcNow < deadline)
                {
                    Thread.Sleep(120);
                    try
                    {
                        var postRaw = EvaluateJsonNoLock(BuildD160PostConfirmScript(token));
                        var post = _json.DeserializeObject(postRaw) as Dictionary<string, object>;
                        if (post == null) continue;
                        terminalSamples++;
                        maxFreshSuccess = Math.Max(maxFreshSuccess, Int(post, "freshSuccessCount"));
                        maxFreshError = Math.Max(maxFreshError, Int(post, "freshErrorCount"));
                        maxVisibleTerminal = Math.Max(maxVisibleTerminal, Int(post, "visibleTerminalCount"));
                        maxSameBaseline = Math.Max(maxSameBaseline, Int(post, "sameBaselineCount"));
                        maxMutatedBaseline = Math.Max(maxMutatedBaseline, Int(post, "mutatedBaselineCount"));
                        maxNewTerminal = Math.Max(maxNewTerminal, Int(post, "newTerminalCount"));
                        if (Bool(post, "success"))
                        {
                            if (firstSignalMs < 0) firstSignalMs = terminalStarted.ElapsedMilliseconds;
                            result.Result = "CONFIRMED";
                            result.Detail = "FRESH_SUCCESS_SURFACE";
                            break;
                        }
                        if (Bool(post, "rejected"))
                        {
                            if (firstSignalMs < 0) firstSignalMs = terminalStarted.ElapsedMilliseconds;
                            // After the final business click an error surface is useful
                            // evidence, but for a multi-row mutation it does not prove
                            // that zero rows changed. Keep the outcome uncertain and the
                            // confirmation guards closed to prevent a duplicate retry.
                            result.Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                            result.Detail = "FRESH_ERROR_SURFACE_POST_CLICK";
                            break;
                        }
                    }
                    catch
                    {
                        terminalExceptions++;
                        // Navigation/reload after the final WMS click is expected. It is
                        // never itself treated as business success.
                    }
                }

                if (string.IsNullOrWhiteSpace(result.Result) || result.Result == "CONFIRM_ERROR")
                {
                    result.Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                    result.Detail = "NO_FRESH_TERMINAL_SURFACE";
                }
                else
                {
                    WaitForD160CleanUiNoLock(TimeSpan.FromMilliseconds(900));
                }

                LogD160DiagnosticTargetSnapshotNoLock("POST_TERMINAL", codes);
                _log("D160_DIAG TERMINAL result=" + D160DiagnosticTelemetry.SafeReason(result.Result) +
                     " detail=" + D160DiagnosticTelemetry.SafeReason(result.Detail) +
                     " targets=" + codes.Count +
                     " wait_budget_ms=" + boundedTerminalWaitMs +
                     " elapsed_ms=" + terminalStarted.ElapsedMilliseconds +
                     " samples=" + terminalSamples +
                     " exceptions=" + terminalExceptions +
                     " first_signal_ms=" + firstSignalMs +
                     " fresh_success_max=" + maxFreshSuccess +
                     " fresh_error_max=" + maxFreshError +
                     " visible_terminal_max=" + maxVisibleTerminal +
                     " same_baseline_max=" + maxSameBaseline +
                     " mutated_baseline_max=" + maxMutatedBaseline +
                     " new_terminal_max=" + maxNewTerminal +
                     " epoch=" + D160DiagnosticTelemetry.PageEpoch +
                     " dirty_after_confirm=" + D160DiagnosticTelemetry.Flag(D160DiagnosticTelemetry.DirtyAfterConfirm));
            }

            started.Stop();
            result.ElapsedMs = started.ElapsedMilliseconds;
            _log("SUPRA_BROWSER d160_bulk result=" + result.Result +
                 " detail=" + result.Detail +
                 " targets=" + result.TargetCount +
                 " final_clicked=" + (result.FinalClicked ? "1" : "0") +
                 " recovery_reload=" + (result.RecoveryReloaded ? "1" : "0") +
                 " ms=" + result.ElapsedMs +
                 " direct_api=false session_extract=false");
            return result;
        }

        private Dictionary<string, object> EvaluateD160BulkMutationNoLock(List<string> codes, string token)
        {
            var raw = EvaluateJsonNoLock(BuildD160BulkMutationScript(codes, token));
            return _json.DeserializeObject(raw) as Dictionary<string, object>
                ?? new Dictionary<string, object>(StringComparer.Ordinal);
        }

        private static bool ShouldReloadBeforeFinalClick(string result)
        {
            switch (result ?? "")
            {
                case "DIRTY_DIALOG_PRECLICK":
                case "FOREIGN_SELECTION":
                case "TARGET_PRECHECKED":
                case "CONFIRM_DIALOG_NOT_FOUND":
                case "CONFIRM_DIALOG_AMBIGUOUS":
                case "CONFIRM_DIALOG_TITLE_MISMATCH":
                case "CONFIRM_DIALOG_BODY_MISMATCH":
                case "CONFIRM_DIALOG_BUTTON_NOT_UNIQUE":
                case "CONFIRM_DIALOG_CLOSE_NOT_UNIQUE":
                case "CONFIRM_DIALOG_BUTTON_DISABLED":
                    return true;
                default:
                    return false;
            }
        }

        private void WaitForD160CleanUiNoLock(TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow.Add(timeout);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var raw = EvaluateJsonNoLock(BuildD160CleanUiScript());
                    var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                    if (map != null && Bool(map, "clean")) return;
                }
                catch { }
                Thread.Sleep(120);
            }
        }

        private static string BuildD160BulkMutationScript(List<string> codes, string token)
        {
            var jsCodes = string.Join(",", codes.Select(code => "'" + JavaScriptString(code) + "'"));
            var jsToken = JavaScriptString(token);
            return @"(async () => {
              const targets = new Set([" + jsCodes + @"]);
              const token = '" + jsToken + @"';
              const norm = v => String(v || '').replace(/[\u200B-\u200D\uFEFF]/g,' ').replace(/\s+/g,' ').trim();
              const fold = v => norm(v).toLowerCase();
              const txt = e => norm((e && (e.innerText || e.value || e.textContent)) || '');
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
              const pathOk = location.hostname === 'wms-supra.winmart.vn' && location.pathname.indexOf('" + ConfirmPath + @"') >= 0;
              if (!pathOk) return JSON.stringify({result:'PAGE_NOT_READY', finalClicked:false});

              const dialogSelector = '[role=dialog],.modal-dialog,.modal-content,.mat-dialog-container,.mat-mdc-dialog-container,.ant-modal,.swal2-popup';
              const preDialogs = docs.flatMap(d => [...d.querySelectorAll(dialogSelector)]).filter(visible);
              if (preDialogs.length > 0) return JSON.stringify({result:'DIRTY_DIALOG_PRECLICK', count:preDialogs.length, finalClicked:false});

              const rows = docs.flatMap(d => [...d.querySelectorAll('tr,[role=row]')]).filter(visible);
              const rowsFor = code => rows.filter(row => {
                const found = [...new Set((((row.innerText || row.textContent) || '').toUpperCase().match(/\bPL[0-9]+\b/g) || []))];
                return found.includes(code);
              });
              const selected = [];
              for (const code of targets) {
                const matches = rowsFor(code);
                if (matches.length === 0) return JSON.stringify({result:'ROW_NOT_FOUND', code:code, finalClicked:false});
                if (matches.length !== 1) return JSON.stringify({result:'ROW_AMBIGUOUS', code:code, count:matches.length, finalClicked:false});
                const row = matches[0];
                const native = [...row.querySelectorAll('input[type=checkbox]')].filter(e => visible(e) && !e.disabled);
                const roles = native.length ? [] : [...row.querySelectorAll('[role=checkbox]')].filter(e =>
                  visible(e) && e.getAttribute('aria-disabled') !== 'true');
                const boxes = native.length ? native : roles;
                if (boxes.length !== 1) return JSON.stringify({result:'CHECKBOX_NOT_UNIQUE', code:code, count:boxes.length, finalClicked:false});
                const box = boxes[0];
                const checked = () => native.length ? !!box.checked : box.getAttribute('aria-checked') === 'true';
                if (checked()) return JSON.stringify({result:'TARGET_PRECHECKED', code:code, finalClicked:false});
                selected.push({code:code,row:row,box:box,checked:checked});
              }

              const allChecked = docs.flatMap(d => [...d.querySelectorAll('input[type=checkbox]:checked,[role=checkbox][aria-checked=true]')]).filter(visible);
              for (const box of allChecked) {
                const row = box.closest('tr,[role=row]');
                if (!row) continue;
                const rowCodes = [...new Set((((row.innerText || row.textContent) || '').toUpperCase().match(/\bPL[0-9]+\b/g) || []))];
                // Header/select-all/framework checkboxes do not represent a PickList row.
                // Only another checked data row with a real PL code is a foreign selection.
                if (rowCodes.length === 0) continue;
                if (!rowCodes.some(code => targets.has(code)))
                  return JSON.stringify({result:'FOREIGN_SELECTION', finalClicked:false});
              }

              for (const item of selected) item.box.click();
              const checkboxDeadline = Date.now() + 1400;
              while (Date.now() < checkboxDeadline) {
                if (selected.every(item => item.checked())) break;
                await new Promise(r => setTimeout(r, 50));
              }
              if (!selected.every(item => item.checked()))
                return JSON.stringify({result:'CHECKBOX_VERIFY_FAILED', finalClicked:false});

              for (const item of selected) {
                const current = rowsFor(item.code);
                if (current.length !== 1) return JSON.stringify({result:'ROW_CHANGED', code:item.code, finalClicked:false});
              }

              const semantic = d => [...d.querySelectorAll('button,input[type=button],input[type=submit],a,[role=button]')];
              let confirmButtons = [];
              const confirmDeadline = Date.now() + 1400;
              do {
                confirmButtons = docs.flatMap(semantic).filter(e => visible(e) && txt(e) === '" + ConfirmText + @"');
                if (confirmButtons.length === 1 && !confirmButtons[0].disabled && confirmButtons[0].getAttribute('aria-disabled') !== 'true') break;
                await new Promise(r => setTimeout(r, 70));
              } while (Date.now() < confirmDeadline);
              if (confirmButtons.length !== 1) return JSON.stringify({result:'CONFIRM_BUTTON_NOT_UNIQUE', count:confirmButtons.length, finalClicked:false});
              if (confirmButtons[0].disabled || confirmButtons[0].getAttribute('aria-disabled') === 'true')
                return JSON.stringify({result:'CONFIRM_BUTTON_DISABLED', finalClicked:false});

              const terminalSelector = '.toast-success,.alert-success,.swal2-success,.toast-error,.alert-danger,.alert-error,.swal2-error,[role=alert]';
              for (const d of docs) for (const node of [...d.querySelectorAll(terminalSelector)].filter(visible)) {
                node.setAttribute('data-supra-d160-baseline', token);
                node.setAttribute('data-supra-d160-baseline-text', norm(node.innerText || node.textContent || ''));
              }

              confirmButtons[0].click();

              const dialogTitle = '" + ConfirmDialogTitle + @"';
              const dialogBody = '" + ConfirmDialogBody + @"';
              const dialogConfirmText = '" + ConfirmDialogButtonText + @"';
              const dialogCloseText = '" + ConfirmDialogCloseText + @"';
              const exact = (e, value) => fold(txt(e)) === fold(value);
              const semanticButtons = root => [...root.querySelectorAll('button,input[type=button],input[type=submit],a,[role=button]')].filter(visible);
              const exactVisibleDescendants = (root, value) => [root, ...root.querySelectorAll('*')].filter(e =>
                visible(e) && exact(e, value) && ![...e.children].some(child => visible(child) && exact(child, value)));
              const resolveDialog = () => {
                const candidates = new Set();
                for (const d of docs) {
                  for (const node of [...d.querySelectorAll(dialogSelector)].filter(visible)) candidates.add(node);
                  const titleLeaves = [...d.querySelectorAll('body *')].filter(e =>
                    visible(e) && exact(e, dialogTitle) && ![...e.children].some(child => visible(child) && exact(child, dialogTitle)));
                  for (const title of titleLeaves) {
                    let node = title.parentElement, depth = 0;
                    while (node && depth++ < 8) {
                      if (!visible(node)) { node = node.parentElement; continue; }
                      const bodyOk = exactVisibleDescendants(node, dialogBody).length === 1;
                      const actions = semanticButtons(node);
                      if (bodyOk &&
                          actions.filter(e => exact(e, dialogConfirmText)).length === 1 &&
                          actions.filter(e => exact(e, dialogCloseText)).length === 1) {
                        candidates.add(node); break;
                      }
                      node = node.parentElement;
                    }
                  }
                }
                let matches = [...candidates].filter(root =>
                  visible(root) &&
                  exactVisibleDescendants(root, dialogTitle).length === 1 &&
                  exactVisibleDescendants(root, dialogBody).length === 1);
                matches = matches.filter(root => !matches.some(other => other !== root && root.contains(other)));
                if (matches.length === 0) return {result:'WAIT'};
                if (matches.length !== 1) return {result:'CONFIRM_DIALOG_AMBIGUOUS', count:matches.length};
                const dialog = matches[0];
                if (exactVisibleDescendants(dialog, dialogTitle).length !== 1) return {result:'CONFIRM_DIALOG_TITLE_MISMATCH'};
                if (exactVisibleDescendants(dialog, dialogBody).length !== 1) return {result:'CONFIRM_DIALOG_BODY_MISMATCH'};
                const actions = semanticButtons(dialog);
                const yes = actions.filter(e => exact(e, dialogConfirmText));
                const close = actions.filter(e => exact(e, dialogCloseText));
                if (yes.length !== 1) return {result:'CONFIRM_DIALOG_BUTTON_NOT_UNIQUE', count:yes.length};
                if (close.length !== 1) return {result:'CONFIRM_DIALOG_CLOSE_NOT_UNIQUE', count:close.length};
                if (yes[0].disabled || yes[0].getAttribute('aria-disabled') === 'true') return {result:'CONFIRM_DIALOG_BUTTON_DISABLED'};
                return {result:'READY',button:yes[0]};
              };

              const dialogDeadline = Date.now() + 2200;
              let dialogState = {result:'WAIT'};
              do {
                dialogState = resolveDialog();
                if (dialogState.result !== 'WAIT') break;
                await new Promise(r => setTimeout(r, 70));
              } while (Date.now() < dialogDeadline);
              if (dialogState.result === 'WAIT') return JSON.stringify({result:'CONFIRM_DIALOG_NOT_FOUND', finalClicked:false});
              if (dialogState.result !== 'READY') return JSON.stringify({result:dialogState.result,count:dialogState.count || 0,finalClicked:false});

              let baselineTerminalCount = 0;
              for (const d of docs) for (const node of [...d.querySelectorAll(terminalSelector)].filter(visible)) {
                baselineTerminalCount++;
                node.setAttribute('data-supra-d160-baseline', token);
                node.setAttribute('data-supra-d160-baseline-text', norm(node.innerText || node.textContent || ''));
              }
              dialogState.button.click();
              return JSON.stringify({
                result:'CLICKED',
                stage:'DIALOG_CONFIRMED',
                finalClicked:true,
                selectedCount:selected.length,
                baselineTerminalCount:baselineTerminalCount
              });
            })()";
        }

        private static string BuildD160PostConfirmScript(string token)
        {
            var escaped = JavaScriptString(token);
            return @"(() => {
              const token = '" + escaped + @"';
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
              const norm = v => String(v || '').replace(/[\u200B-\u200D\uFEFF]/g,' ').replace(/\s+/g,' ').trim();
              const terminalSelector = '.toast-success,.alert-success,.swal2-success,.toast-error,.alert-danger,.alert-error,.swal2-error,[role=alert]';
              const allTerminal = docs.flatMap(d => [...d.querySelectorAll(terminalSelector)]).filter(visible);
              const fresh = selector => docs.flatMap(d => [...d.querySelectorAll(selector)])
                .filter(visible)
                .filter(e => {
                  if (e.getAttribute('data-supra-d160-baseline') !== token) return true;
                  const before = e.getAttribute('data-supra-d160-baseline-text') || '';
                  const now = norm(e.innerText || e.textContent || '');
                  return now !== before;
                });
              const success = fresh('.toast-success,.alert-success,.swal2-success,[role=alert]');
              const errors = fresh('.toast-error,.alert-danger,.alert-error,.swal2-error,[role=alert]');
              const sameBaseline = allTerminal.filter(e => {
                if (e.getAttribute('data-supra-d160-baseline') !== token) return false;
                const before = e.getAttribute('data-supra-d160-baseline-text') || '';
                const now = norm(e.innerText || e.textContent || '');
                return now === before;
              });
              const mutatedBaseline = allTerminal.filter(e => {
                if (e.getAttribute('data-supra-d160-baseline') !== token) return false;
                const before = e.getAttribute('data-supra-d160-baseline-text') || '';
                const now = norm(e.innerText || e.textContent || '');
                return now !== before;
              });
              const newTerminal = allTerminal.filter(e => e.getAttribute('data-supra-d160-baseline') !== token);
              const successText = success.map(e => (e.innerText || e.textContent || '')).join(' ').toLowerCase();
              const errorText = errors.map(e => (e.innerText || e.textContent || '')).join(' ').toLowerCase();
              const successWord = successText.includes('thành công') || successText.includes('success');
              const rejectWord = errorText.includes('thất bại') || errorText.includes('không thể') || errorText.includes('error');
              return JSON.stringify({
                success:successWord,
                rejected:rejectWord,
                freshSuccessCount:success.length,
                freshErrorCount:errors.length,
                visibleTerminalCount:allTerminal.length,
                sameBaselineCount:sameBaseline.length,
                mutatedBaselineCount:mutatedBaseline.length,
                newTerminalCount:newTerminal.length
              });
            })()";
        }

        private static string BuildD160CleanUiScript()
        {
            return @"(() => {
              const visible = e => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
              const dialogs = [...document.querySelectorAll('[role=dialog],.modal-dialog,.modal-content,.mat-dialog-container,.mat-mdc-dialog-container,.ant-modal,.swal2-popup')].filter(visible);
              const pathOk = location.hostname === 'wms-supra.winmart.vn' && location.pathname.indexOf('" + ConfirmPath + @"') >= 0;
              return JSON.stringify({clean:pathOk && dialogs.length === 0});
            })()";
        }
    }
}
