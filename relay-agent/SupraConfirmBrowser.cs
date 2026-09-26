using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class SupraBrowserState
    {
        internal bool Ready;
        internal bool Hidden;
        internal string State = "NOT_OPEN";
        internal string Url = "";
        internal string Browser = "";
        internal int SearchCount;
        internal int ConfirmCount;
        internal int ConfirmVisibleCount;
        internal int TableCount;
        internal int FrameCount;
    }

    internal sealed class SupraBrowserSearchResult
    {
        internal string Result = "LOOKUP_ERROR";
        internal readonly List<string> Matches = new List<string>();
        internal readonly List<string> MissingFragments = new List<string>();
        internal readonly List<string> AmbiguousFragments = new List<string>();
        internal readonly Dictionary<string, List<string>> Candidates =
            new Dictionary<string, List<string>>(StringComparer.Ordinal);
        internal long ElapsedMs;
        internal bool SearchClicked;
    }

    internal sealed class SupraBrowserConfirmResult
    {
        internal string Result = "CONFIRM_ERROR";
        internal string Detail = "";
        internal long ElapsedMs;
    }

    // D126: browser UI adapter. It intentionally enables only Page/Runtime domains.
    // It never enables Network, reads cookies/storage, inspects requests, or calls Supra APIs.
    internal sealed class SupraConfirmBrowser : IDisposable
    {
        private sealed class BrowserCandidate
        {
            internal string Name;
            internal string Path;
            internal string ProfileKey;
        }

        private readonly Action<string> _log;
        private readonly object _gate = new object();
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private Process _process;
        private ClientWebSocket _socket;
        private int _port;
        private int _nextCommandId;
        private bool _hidden;
        private string _browserName = "";
        private string _targetUrl = "";
        private bool _disposed;

        private const string ConfirmPath = "/sft3/app/saleorder/auto-pickpack-confirm";
        private const string SearchText = "Tìm kiếm";
        private const string ConfirmText = "Xác nhận lấy lại hàng";

        internal SupraConfirmBrowser(Action<string> log)
        {
            _log = log ?? (_ => { });
        }

        internal SupraBrowserState OpenOrShow()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (!IsConnectedNoLock())
                    StartNoLock();
                else
                    NavigateConfirmNoLock();

                ShowNoLock();
            }
            return WaitForReady(TimeSpan.FromSeconds(2));
        }

        internal SupraBrowserState WaitForReady(TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow.Add(timeout <= TimeSpan.Zero ? TimeSpan.FromMilliseconds(1) : timeout);
            SupraBrowserState last = null;
            do
            {
                try
                {
                    last = RefreshState();
                    if (last.Ready) return last;
                }
                catch (Exception ex)
                {
                    last = new SupraBrowserState { Ready = false, Hidden = _hidden, State = "BROWSER_ERROR" };
                    _log("SUPRA_BROWSER readiness fail type=" + ex.GetType().Name);
                }
                Thread.Sleep(250);
            }
            while (DateTime.UtcNow < deadline);
            return last ?? new SupraBrowserState { Ready = false, Hidden = _hidden, State = "NOT_OPEN" };
        }

        internal SupraBrowserState RefreshState()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (!IsConnectedNoLock())
                    return new SupraBrowserState { Ready = false, Hidden = _hidden, State = "NOT_OPEN", Browser = _browserName };

                var raw = EvaluateJsonNoLock(BuildReadinessScript());
                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (map == null)
                    return new SupraBrowserState { Ready = false, Hidden = _hidden, State = "DOM_UNAVAILABLE", Browser = _browserName };

                return new SupraBrowserState
                {
                    Ready = Bool(map, "ready"),
                    Hidden = _hidden,
                    State = String(map, "state"),
                    Url = String(map, "url"),
                    Browser = _browserName,
                    SearchCount = Int(map, "searchCount"),
                    ConfirmCount = Int(map, "confirmCount"),
                    ConfirmVisibleCount = Int(map, "confirmVisibleCount"),
                    TableCount = Int(map, "tableCount"),
                    FrameCount = Int(map, "frameCount")
                };
            }
        }

        internal bool IsReady()
        {
            try { return RefreshState().Ready; }
            catch { return false; }
        }

        internal void Hide()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (!IsConnectedNoLock()) return;
                SetBrowserWindowsVisibleNoLock(false);
                _hidden = true;
                _log("SUPRA_BROWSER visibility=HIDDEN taskbar=true process_alive=true");
            }
        }

        internal void Show()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (!IsConnectedNoLock()) StartNoLock();
                ShowNoLock();
            }
        }

        internal SupraBrowserSearchResult SearchMany(IEnumerable<string> fragments, bool allowOneSearchClick)
        {
            var started = Stopwatch.StartNew();
            var terms = NormalizeFragments(fragments);
            var output = new SupraBrowserSearchResult();
            if (terms.Count == 0)
            {
                output.Result = "LOOKUP_ERROR";
                return output;
            }

            lock (_gate)
            {
                ThrowIfDisposed();
                EnsureReadyNoLock();
                var scan = ScanNoLock(terms);
                if (NeedsSearchRetry(scan) && allowOneSearchClick)
                {
                    ClickExactButtonNoLock(SearchText);
                    output.SearchClicked = true;
                    var deadline = DateTime.UtcNow.AddSeconds(8);
                    SupraBrowserSearchResult latest = scan;
                    while (DateTime.UtcNow < deadline)
                    {
                        Thread.Sleep(300);
                        EnsureReadyNoLock();
                        latest = ScanNoLock(terms);
                        if (!NeedsSearchRetry(latest)) break;
                    }
                    scan = latest;
                }

                CopySearch(scan, output);
            }

            started.Stop();
            output.ElapsedMs = started.ElapsedMilliseconds;
            _log("SUPRA_BROWSER search result=" + output.Result +
                 " terms=" + terms.Count +
                 " matches=" + output.Matches.Count +
                 " ambiguous=" + output.AmbiguousFragments.Count +
                 " missing=" + output.MissingFragments.Count +
                 " ui_search_click=" + (output.SearchClicked ? "1" : "0"));
            return output;
        }

        internal SupraBrowserConfirmResult ConfirmExact(string fullPickListCode)
        {
            var started = Stopwatch.StartNew();
            var result = new SupraBrowserConfirmResult();
            var code = (fullPickListCode ?? "").Trim().ToUpperInvariant();
            if (!Regex.IsMatch(code, "^PL[0-9]+$"))
            {
                result.Result = "EXACT_CODE_NOT_RESOLVED";
                result.Detail = "PickListCode invalid";
                return result;
            }

            lock (_gate)
            {
                ThrowIfDisposed();
                EnsureReadyNoLock();

                var mutationScript = BuildMutationScript(code);
                var raw = EvaluateJsonNoLock(mutationScript);
                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                var stepResult = map == null ? "DOM_ERROR" : String(map, "result");

                if (!string.Equals(stepResult, "CLICKED", StringComparison.Ordinal))
                {
                    result.Result = MapDomFailure(stepResult);
                    result.Detail = stepResult;
                    started.Stop();
                    result.ElapsedMs = started.ElapsedMilliseconds;
                    _log("SUPRA_BROWSER confirm result=" + result.Result + " phase=pre_click detail=" + stepResult);
                    return result;
                }

                // Only DOM state is observed after the exact semantic click.
                // A visible success surface or disappearance of the exact row is trusted;
                // otherwise the outcome is uncertain and the confirmation guard stays closed.
                var deadline = DateTime.UtcNow.AddSeconds(8);
                var rowMissingSamples = 0;
                var rowMissingSinceUtc = DateTime.MinValue;
                while (DateTime.UtcNow < deadline)
                {
                    Thread.Sleep(350);
                    string postRaw;
                    try { postRaw = EvaluateJsonNoLock(BuildPostConfirmScript(code)); }
                    catch
                    {
                        continue;
                    }

                    var post = _json.DeserializeObject(postRaw) as Dictionary<string, object>;
                    if (post == null) continue;
                    if (Bool(post, "success"))
                    {
                        result.Result = "CONFIRMED";
                        result.Detail = String(post, "signal");
                        break;
                    }
                    if (Bool(post, "rejected"))
                    {
                        result.Result = "CONFIRM_REJECTED";
                        result.Detail = String(post, "signal");
                        break;
                    }

                    if (Bool(post, "rowMissing"))
                    {
                        if (rowMissingSamples == 0) rowMissingSinceUtc = DateTime.UtcNow;
                        rowMissingSamples++;
                        if (rowMissingSamples >= 3 &&
                            DateTime.UtcNow - rowMissingSinceUtc >= TimeSpan.FromMilliseconds(700))
                        {
                            result.Result = "CONFIRMED";
                            result.Detail = "ROW_REMOVED_STABLE";
                            break;
                        }
                    }
                    else
                    {
                        rowMissingSamples = 0;
                        rowMissingSinceUtc = DateTime.MinValue;
                    }
                }

                if (string.IsNullOrWhiteSpace(result.Result) || result.Result == "CONFIRM_ERROR")
                {
                    result.Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                    result.Detail = "No trustworthy terminal DOM signal";
                }
            }

            started.Stop();
            result.ElapsedMs = started.ElapsedMilliseconds;
            _log("SUPRA_BROWSER confirm result=" + result.Result +
                 " ms=" + result.ElapsedMs +
                 " direct_api=false session_extract=false");
            return result;
        }

        private void StartNoLock()
        {
            DisposeSocketNoLock();

            var browser = FindSupportedBrowser();
            if (browser == null)
                throw new InvalidOperationException("Không tìm thấy Microsoft Edge hoặc Google Chrome.");

            _port = FindFreeLoopbackPort();
            var profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SUPRA Inventory", "ConfirmBrowser", browser.ProfileKey);
            Directory.CreateDirectory(profileDir);

            var args =
                "--remote-debugging-address=127.0.0.1 " +
                "--remote-debugging-port=" + _port + " " +
                "--user-data-dir=\"" + profileDir.Replace("\"", "") + "\" " +
                "--no-first-run --no-default-browser-check " +
                "--new-window \"" + AgentConfig.WmsPicklistConfirmUiReferenceUrl + "\"";

            _process = Process.Start(new ProcessStartInfo
            {
                FileName = browser.Path,
                Arguments = args,
                UseShellExecute = true
            });
            if (_process == null)
                throw new InvalidOperationException("Không mở được " + browser.Name + ".");

            _browserName = browser.Name;
            _targetUrl = WaitForPageTarget(_port, TimeSpan.FromSeconds(20));

            _socket = new ClientWebSocket();
            _socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
            _socket.ConnectAsync(new Uri(_targetUrl), CancellationToken.None).GetAwaiter().GetResult();

            CommandNoLock("Runtime.enable", null, TimeSpan.FromSeconds(5));
            CommandNoLock("Page.enable", null, TimeSpan.FromSeconds(5));
            _hidden = false;
            _log("SUPRA_BROWSER start browser=" + _browserName +
                 " loopback=127.0.0.1 profile=dedicated session_extract=false network_domain=false");
        }

        private void NavigateConfirmNoLock()
        {
            CommandNoLock("Page.navigate", new Dictionary<string, object>
            {
                { "url", AgentConfig.WmsPicklistConfirmUiReferenceUrl }
            }, TimeSpan.FromSeconds(5));
        }

        private void EnsureReadyNoLock()
        {
            if (!IsConnectedNoLock())
                throw new InvalidOperationException("Chưa mở trình duyệt Confirm PickList.");
            var raw = EvaluateJsonNoLock(BuildReadinessScript());
            var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
            if (map == null || !Bool(map, "ready"))
                throw new InvalidOperationException("Web Confirm chưa sẵn sàng. Hãy mở đúng trang và đăng nhập Supra.");
        }

        private SupraBrowserSearchResult ScanNoLock(List<string> terms)
        {
            var raw = EvaluateJsonNoLock(BuildScanScript(terms));
            var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
            var result = new SupraBrowserSearchResult();
            if (map == null)
            {
                result.Result = "LOOKUP_ERROR";
                return result;
            }

            var rows = map.TryGetValue("candidates", out var candidateObj)
                ? candidateObj as Dictionary<string, object>
                : null;

            foreach (var term in terms)
            {
                var candidates = new List<string>();
                if (rows != null && rows.TryGetValue(term, out var rawCandidates))
                {
                    var arr = rawCandidates as object[];
                    if (arr != null)
                    {
                        foreach (var item in arr)
                        {
                            var code = Convert.ToString(item) ?? "";
                            if (Regex.IsMatch(code, "^PL[0-9]+$") &&
                                !candidates.Exists(x => string.Equals(x, code, StringComparison.OrdinalIgnoreCase)))
                                candidates.Add(code);
                        }
                    }
                }
                result.Candidates[term] = candidates;
                if (candidates.Count == 0) result.MissingFragments.Add(term);
                else if (candidates.Count > 1) result.AmbiguousFragments.Add(term);
                else result.Matches.Add(candidates[0]);
            }

            if (result.AmbiguousFragments.Count > 0) result.Result = "AMBIGUOUS";
            else if (result.Matches.Count > 0) result.Result = "FOUND";
            else result.Result = "NOT_FOUND";
            return result;
        }

        private void ClickExactButtonNoLock(string text)
        {
            var raw = EvaluateJsonNoLock(BuildClickButtonScript(text));
            var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
            var count = map == null ? 0 : Int(map, "count");
            var clicked = map != null && Bool(map, "clicked");
            if (count != 1 || !clicked)
                throw new InvalidOperationException("Không xác định duy nhất nút " + text + " trên Web Confirm.");
        }

        private string EvaluateJsonNoLock(string expression)
        {
            var response = CommandNoLock("Runtime.evaluate", new Dictionary<string, object>
            {
                { "expression", expression },
                { "returnByValue", true },
                { "awaitPromise", true }
            }, TimeSpan.FromSeconds(12));

            var root = _json.DeserializeObject(response) as Dictionary<string, object>;
            var result = root != null && root.TryGetValue("result", out var resultObj)
                ? resultObj as Dictionary<string, object>
                : null;
            var nested = result != null && result.TryGetValue("result", out var nestedObj)
                ? nestedObj as Dictionary<string, object>
                : null;
            var value = nested != null && nested.TryGetValue("value", out var valueObj)
                ? Convert.ToString(valueObj)
                : null;
            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException("Không đọc được kết quả DOM từ Web Confirm.");
            return value;
        }

        private string CommandNoLock(string method, Dictionary<string, object> parameters, TimeSpan timeout)
        {
            if (_socket == null || _socket.State != WebSocketState.Open)
                throw new InvalidOperationException("Kết nối trình duyệt không sẵn sàng.");

            var id = ++_nextCommandId;
            var command = new Dictionary<string, object>
            {
                { "id", id },
                { "method", method }
            };
            if (parameters != null) command["params"] = parameters;
            Send(_socket, _json.Serialize(command));

            var deadline = DateTime.UtcNow.Add(timeout);
            while (DateTime.UtcNow < deadline)
            {
                var raw = Receive(_socket, deadline - DateTime.UtcNow);
                if (raw == null) continue;
                Dictionary<string, object> message;
                try { message = _json.DeserializeObject(raw) as Dictionary<string, object>; }
                catch { continue; }
                if (message == null) continue;

                if (message.TryGetValue("method", out var eventMethodObj) &&
                    string.Equals(Convert.ToString(eventMethodObj), "Page.javascriptDialogOpening", StringComparison.Ordinal))
                {
                    // D126 never auto-accepts an unknown browser dialog.
                    try
                    {
                        var dismiss = new Dictionary<string, object>
                        {
                            { "id", ++_nextCommandId },
                            { "method", "Page.handleJavaScriptDialog" },
                            { "params", new Dictionary<string, object> { { "accept", false } } }
                        };
                        Send(_socket, _json.Serialize(dismiss));
                    }
                    catch { }
                    _log("SUPRA_BROWSER javascript_dialog=dismissed fail_closed=true");
                    continue;
                }

                if (!message.TryGetValue("id", out var messageIdObj)) continue;
                if (Convert.ToInt32(messageIdObj) != id) continue;
                if (message.ContainsKey("error"))
                    throw new InvalidOperationException("Lệnh DOM trình duyệt bị từ chối.");
                return raw;
            }
            throw new TimeoutException("Quá thời gian chờ phản hồi trình duyệt.");
        }

        private bool IsConnectedNoLock()
        {
            return _socket != null && _socket.State == WebSocketState.Open &&
                   _process != null && !_process.HasExited;
        }

        private void ShowNoLock()
        {
            SetBrowserWindowsVisibleNoLock(true);
            _hidden = false;
        }

        private void SetBrowserWindowsVisibleNoLock(bool visible)
        {
            if (_process == null || _process.HasExited) return;
            var pid = _process.Id;
            EnumWindows((hWnd, _) =>
            {
                GetWindowThreadProcessId(hWnd, out var windowPid);
                if (windowPid != (uint)pid) return true;
                if (!IsWindowVisible(hWnd) && visible)
                    ShowWindow(hWnd, SW_SHOW);
                else if (visible)
                {
                    ShowWindow(hWnd, SW_RESTORE);
                    SetForegroundWindow(hWnd);
                }
                else
                    ShowWindow(hWnd, SW_HIDE);
                return true;
            }, IntPtr.Zero);
        }

        private static bool NeedsSearchRetry(SupraBrowserSearchResult result)
        {
            return result != null && result.MissingFragments.Count > 0 &&
                   result.AmbiguousFragments.Count == 0;
        }

        private static void CopySearch(SupraBrowserSearchResult source, SupraBrowserSearchResult target)
        {
            target.Result = source.Result;
            target.Matches.AddRange(source.Matches);
            target.MissingFragments.AddRange(source.MissingFragments);
            target.AmbiguousFragments.AddRange(source.AmbiguousFragments);
            foreach (var pair in source.Candidates)
                target.Candidates[pair.Key] = new List<string>(pair.Value);
        }

        private static List<string> NormalizeFragments(IEnumerable<string> values)
        {
            var output = new List<string>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var raw in values ?? new string[0])
            {
                var value = (raw ?? "").Trim();
                if (!Regex.IsMatch(value, "^[0-9]{3,20}$")) continue;
                if (seen.Add(value)) output.Add(value);
            }
            return output;
        }

        private static string MapDomFailure(string value)
        {
            switch (value ?? "")
            {
                case "ROW_NOT_FOUND": return "EXACT_CODE_NOT_RESOLVED";
                case "ROW_AMBIGUOUS": return "AMBIGUOUS_PICKLIST";
                case "CHECKBOX_NOT_UNIQUE":
                case "CHECKBOX_DISABLED":
                case "CHECKBOX_VERIFY_FAILED":
                case "CONFIRM_BUTTON_NOT_UNIQUE":
                case "CONFIRM_BUTTON_DISABLED":
                case "PAGE_NOT_READY":
                    return "CONFIRM_REJECTED";
                default:
                    return "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
            }
        }

        private static string BuildReadinessScript()
        {
            return @"(() => {
              const norm = v => (v || '').replace(/\s+/g,' ').trim();
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
              const semantic = d => [...d.querySelectorAll('button,input[type=button],input[type=submit],a,[role=button]')];
              const controls = docs.flatMap(semantic);
              const search = controls.filter(e => visible(e) && txt(e) === 'Tìm kiếm');
              const confirm = controls.filter(e => txt(e) === 'Xác nhận lấy lại hàng');
              const confirmVisible = confirm.filter(visible);
              const tableSurfaces = docs.flatMap(d => [...d.querySelectorAll('table,[role=grid],[role=table]')]).filter(visible);
              const rowSurfaces = docs.flatMap(d => [...d.querySelectorAll('tr,[role=row]')]).filter(visible);
              const pathOk = location.hostname === 'wms-supra.winmart.vn' && location.pathname.indexOf('" + ConfirmPath + @"') >= 0;
              const tableOk = tableSurfaces.length > 0 || rowSurfaces.length > 0;
              const ready = pathOk && tableOk && search.length === 1 && confirm.length === 1;
              let state = 'WRONG_PAGE';
              if (pathOk && !ready) state = (search.length > 0 || confirm.length > 0 || tableOk) ? 'CONFIRM_DOM_PARTIAL' : 'LOGIN_OR_DOM_NOT_READY';
              if (ready) state = 'READY';
              return JSON.stringify({
                ready,
                state,
                url: location.origin + location.pathname,
                searchCount: search.length,
                confirmCount: confirm.length,
                confirmVisibleCount: confirmVisible.length,
                tableCount: tableSurfaces.length || rowSurfaces.length,
                frameCount: Math.max(0, docs.length - 1)
              });
            })()";
        }

        private string BuildScanScript(List<string> terms)
        {
            var termsJson = _json.Serialize(terms);
            return @"(() => {
              const terms = " + termsJson + @";
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
              const candidates = {};
              for (const term of terms) candidates[term] = [];
              for (const row of rows) {
                const text = ((row.innerText || row.textContent) || '').toUpperCase();
                const codes = [...new Set(text.match(/\bPL[0-9]+\b/g) || [])];
                for (const code of codes) {
                  if (!/^PL[0-9]+$/.test(code)) continue;
                  for (const term of terms) {
                    if (code.endsWith(term) && !candidates[term].includes(code))
                      candidates[term].push(code);
                  }
                }
              }
              return JSON.stringify({candidates});
            })()";
        }

        private static string BuildClickButtonScript(string text)
        {
            var escaped = JavaScriptString(text);
            return @"(() => {
              const target = '" + escaped + @"';
              const norm = v => (v || '').replace(/\s+/g,' ').trim();
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
              const buttons = docs.flatMap(d => [...d.querySelectorAll('button,input[type=button],input[type=submit],a,[role=button]')])
                .filter(e => visible(e) && txt(e) === target && !e.disabled && e.getAttribute('aria-disabled') !== 'true');
              if (buttons.length === 1) buttons[0].click();
              return JSON.stringify({count: buttons.length, clicked: buttons.length === 1});
            })()";
        }

        private static string BuildMutationScript(string code)
        {
            var escaped = JavaScriptString(code);
            return @"(async () => {
              const code = '" + escaped + @"';
              const norm = v => (v || '').replace(/\s+/g,' ').trim();
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
              if (!pathOk) return JSON.stringify({result:'PAGE_NOT_READY'});
              const allRows = () => docs.flatMap(d => [...d.querySelectorAll('tr,[role=row]')]).filter(visible);
              const resolveRows = () => allRows().filter(row => {
                const codes = [...new Set((((row.innerText || row.textContent) || '').toUpperCase().match(/\bPL[0-9]+\b/g) || []))];
                return codes.includes(code);
              });
              let rows = resolveRows();
              if (rows.length === 0) return JSON.stringify({result:'ROW_NOT_FOUND'});
              if (rows.length !== 1) return JSON.stringify({result:'ROW_AMBIGUOUS'});
              let row = rows[0];
              const native = [...row.querySelectorAll('input[type=checkbox]')].filter(e => !e.disabled);
              const roles = native.length ? [] : [...row.querySelectorAll('[role=checkbox]')].filter(e => e.getAttribute('aria-disabled') !== 'true');
              const boxes = native.length ? native : roles;
              if (boxes.length !== 1) return JSON.stringify({result:'CHECKBOX_NOT_UNIQUE', count:boxes.length});
              const box = boxes[0];
              if (box.disabled || box.getAttribute('aria-disabled') === 'true') return JSON.stringify({result:'CHECKBOX_DISABLED'});
              const isChecked = () => native.length ? !!box.checked : box.getAttribute('aria-checked') === 'true';
              if (!isChecked()) box.click();
              const checkboxDeadline = Date.now() + 1200;
              while (!isChecked() && Date.now() < checkboxDeadline) await new Promise(r => setTimeout(r, 60));
              if (!isChecked()) return JSON.stringify({result:'CHECKBOX_VERIFY_FAILED'});

              rows = resolveRows();
              if (rows.length === 0) return JSON.stringify({result:'ROW_NOT_FOUND'});
              if (rows.length !== 1) return JSON.stringify({result:'ROW_AMBIGUOUS'});
              row = rows[0];
              const codesAgain = [...new Set((((row.innerText || row.textContent) || '').toUpperCase().match(/\bPL[0-9]+\b/g) || []))];
              if (!codesAgain.includes(code)) return JSON.stringify({result:'ROW_CHANGED'});

              const semantic = d => [...d.querySelectorAll('button,input[type=button],input[type=submit],a,[role=button]')];
              let confirmButtons = [];
              const confirmDeadline = Date.now() + 1600;
              do {
                confirmButtons = docs.flatMap(semantic).filter(e => visible(e) && txt(e) === '" + ConfirmText + @"');
                if (confirmButtons.length === 1 && !confirmButtons[0].disabled && confirmButtons[0].getAttribute('aria-disabled') !== 'true') break;
                await new Promise(r => setTimeout(r, 80));
              } while (Date.now() < confirmDeadline);
              if (confirmButtons.length !== 1) return JSON.stringify({result:'CONFIRM_BUTTON_NOT_UNIQUE', count:confirmButtons.length});
              const confirm = confirmButtons[0];
              if (confirm.disabled || confirm.getAttribute('aria-disabled') === 'true') return JSON.stringify({result:'CONFIRM_BUTTON_DISABLED'});
              confirm.click();
              return JSON.stringify({result:'CLICKED'});
            })()";
        }

        private static string BuildPostConfirmScript(string code)
        {
            var escaped = JavaScriptString(code);
            return @"(() => {
              const code = '" + escaped + @"';
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
              const rows = docs.flatMap(d => [...d.querySelectorAll('tr,[role=row]')]).filter(visible).filter(row => {
                const codes = [...new Set((((row.innerText || row.textContent) || '').toUpperCase().match(/\bPL[0-9]+\b/g) || []))];
                return codes.includes(code);
              });
              const successNodes = docs.flatMap(d => [...d.querySelectorAll('.toast-success,.alert-success,.swal2-success,[role=alert]')]).filter(visible);
              const successText = successNodes.map(e => (e.innerText || e.textContent || '')).join(' ').toLowerCase();
              const dangerNodes = docs.flatMap(d => [...d.querySelectorAll('.toast-error,.alert-danger,.alert-error,.swal2-error,[role=alert]')]).filter(visible);
              const dangerText = dangerNodes.map(e => (e.innerText || e.textContent || '')).join(' ').toLowerCase();
              const successWord = successText.includes('thành công') || successText.includes('success');
              const rejectWord = dangerText.includes('thất bại') || dangerText.includes('không thể') || dangerText.includes('error');
              if (successWord) return JSON.stringify({success:true,rejected:false,rowMissing:false,signal:'SUCCESS_SURFACE'});
              if (rejectWord) return JSON.stringify({success:false,rejected:true,rowMissing:false,signal:'ERROR_SURFACE'});
              if (rows.length === 0) return JSON.stringify({success:false,rejected:false,rowMissing:true,signal:'ROW_REMOVED'});
              return JSON.stringify({success:false,rejected:false,rowMissing:false,signal:'PENDING'});
            })()";
        }

        private static string JavaScriptString(string value)
        {
            return (value ?? "")
                .Replace("\\", "\\\\")
                .Replace("'", "\\'")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        private static BrowserCandidate FindSupportedBrowser()
        {
            var pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            var pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var candidates = new[]
            {
                new BrowserCandidate { Name = "Microsoft Edge", ProfileKey = "edge", Path = Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe") },
                new BrowserCandidate { Name = "Microsoft Edge", ProfileKey = "edge", Path = Path.Combine(pf, "Microsoft", "Edge", "Application", "msedge.exe") },
                new BrowserCandidate { Name = "Microsoft Edge", ProfileKey = "edge", Path = Path.Combine(local, "Microsoft", "Edge", "Application", "msedge.exe") },
                new BrowserCandidate { Name = "Google Chrome", ProfileKey = "chrome", Path = Path.Combine(pf, "Google", "Chrome", "Application", "chrome.exe") },
                new BrowserCandidate { Name = "Google Chrome", ProfileKey = "chrome", Path = Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe") },
                new BrowserCandidate { Name = "Google Chrome", ProfileKey = "chrome", Path = Path.Combine(local, "Google", "Chrome", "Application", "chrome.exe") }
            };
            foreach (var candidate in candidates)
                if (!string.IsNullOrWhiteSpace(candidate.Path) && File.Exists(candidate.Path)) return candidate;
            return null;
        }

        private static int FindFreeLoopbackPort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        private static string WaitForPageTarget(int port, TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow.Add(timeout);
            Exception last = null;
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/json/list");
                    req.Method = "GET";
                    req.Proxy = null;
                    req.Timeout = 1500;
                    using (var response = (HttpWebResponse)req.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream()))
                    {
                        var raw = reader.ReadToEnd();
                        var items = new JavaScriptSerializer().DeserializeObject(raw) as object[];
                        if (items != null)
                        {
                            string fallback = null;
                            foreach (var item in items)
                            {
                                var map = item as Dictionary<string, object>;
                                if (map == null) continue;
                                if (!string.Equals(String(map, "type"), "page", StringComparison.OrdinalIgnoreCase)) continue;
                                var ws = String(map, "webSocketDebuggerUrl");
                                if (string.IsNullOrWhiteSpace(ws)) continue;
                                if (fallback == null) fallback = ws;
                                var url = String(map, "url");
                                if (url.IndexOf("wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase) >= 0)
                                    return ws;
                            }
                            if (!string.IsNullOrWhiteSpace(fallback)) return fallback;
                        }
                    }
                }
                catch (Exception ex) { last = ex; }
                Thread.Sleep(250);
            }
            throw new InvalidOperationException("Trình duyệt đã mở nhưng Agent không kết nối được DevTools loopback.", last);
        }

        private static void Send(ClientWebSocket socket, string value)
        {
            var bytes = Encoding.UTF8.GetBytes(value);
            socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None)
                .GetAwaiter().GetResult();
        }

        private static string Receive(ClientWebSocket socket, TimeSpan timeout)
        {
            if (timeout <= TimeSpan.Zero) return null;
            using (var cts = new CancellationTokenSource(timeout))
            using (var buffer = new MemoryStream())
            {
                try
                {
                    var chunk = new byte[16 * 1024];
                    while (true)
                    {
                        var result = socket.ReceiveAsync(new ArraySegment<byte>(chunk), cts.Token).GetAwaiter().GetResult();
                        if (result.MessageType == WebSocketMessageType.Close) return null;
                        if (result.Count > 0) buffer.Write(chunk, 0, result.Count);
                        if (result.EndOfMessage) break;
                    }
                    return Encoding.UTF8.GetString(buffer.ToArray());
                }
                catch (OperationCanceledException) { return null; }
            }
        }

        private static bool Bool(Dictionary<string, object> map, string key)
        {
            return map != null && map.TryGetValue(key, out var value) && Convert.ToBoolean(value);
        }

        private static int Int(Dictionary<string, object> map, string key)
        {
            if (map == null || !map.TryGetValue(key, out var value) || value == null) return 0;
            return Convert.ToInt32(value);
        }

        private static string String(Dictionary<string, object> map, string key)
        {
            return map != null && map.TryGetValue(key, out var value) ? Convert.ToString(value) ?? "" : "";
        }

        private void DisposeSocketNoLock()
        {
            try { if (_socket != null) _socket.Dispose(); } catch { }
            _socket = null;
        }

        public void Dispose()
        {
            lock (_gate)
            {
                if (_disposed) return;
                _disposed = true;
                DisposeSocketNoLock();
                try
                {
                    if (_process != null && !_process.HasExited)
                        _process.CloseMainWindow();
                }
                catch { }
                _process = null;
            }
        }

        private void ThrowIfDisposed()
        {
            if (_disposed) throw new ObjectDisposedException(nameof(SupraConfirmBrowser));
        }

        private const int SW_HIDE = 0;
        private const int SW_SHOW = 5;
        private const int SW_RESTORE = 9;

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);
    }
}
