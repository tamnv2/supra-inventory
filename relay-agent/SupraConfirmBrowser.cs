using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
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
        internal int SearchExactCount;
        internal int SearchDecoratedCount;
        internal int ConfirmCount;
        internal int ConfirmVisibleCount;
        internal int TableCount;
        internal int FrameCount;
        internal bool PageLoaded;
        internal bool LoginMarkerDetected;
        internal string NavigationType = "";
    }

    internal sealed class BrowserResourceSnapshot
    {
        internal bool Available;
        internal string Browser = "";
        internal double CpuPercent;
        internal long WorkingSetBytes;
        internal int ProcessCount;
        internal TimeSpan RunningFor;
    }

    internal sealed class SupraBrowserSearchResult
    {
        internal string Result = "LOOKUP_ERROR";
        internal readonly List<string> Matches = new List<string>();
        internal readonly List<string> MissingFragments = new List<string>();
        internal readonly List<string> AmbiguousFragments = new List<string>();
        internal readonly List<string> UnselectableFragments = new List<string>();
        internal readonly List<string> StateChangedFragments = new List<string>();
        internal readonly Dictionary<string, List<string>> Candidates =
            new Dictionary<string, List<string>>(StringComparer.Ordinal);
        internal long ElapsedMs;
        internal bool SearchClicked;
        internal bool RecoveryReloaded;
        internal string DomFingerprint = "";
        internal int PicklistCodeCount;
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

        private enum BrowserLaunchMode
        {
            None,
            Agent,
            Desktop
        }

        private readonly Action<string> _log;
        private readonly object _gate = new object();
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private Process _process;
        private ClientWebSocket _socket;
        private int _port;
        private int _nextCommandId;
        private bool _hidden;
        private bool _manualVisibilityOverride;
        private string _browserName = "";
        private string _targetUrl = "";
        private BrowserLaunchMode _launchMode = BrowserLaunchMode.None;
        private int _confirmRouteRetryCount;
        private bool _loginMarkerObserved;
        private string _loadedNonConfirmObservedUrl = "";
        private DateTime _loadedNonConfirmObservedAtUtc = DateTime.MinValue;
        private DateTime _confirmRetryIssuedAtUtc = DateTime.MinValue;
        private int _dashboardAccessAttemptCount;
        private bool _dashboardAccessFailed;
        private bool _dashboardWmsTargetAttached;
        private DateTime _dashboardAccessIssuedAtUtc = DateTime.MinValue;
        private bool _confirmReloadRequired;
        private bool _confirmReloadIssued;
        private bool _confirmReloadVerified;
        private DateTime _confirmReloadIssuedAtUtc = DateTime.MinValue;
        private DateTime _confirmReloadStableSinceUtc = DateTime.MinValue;
        private DateTime _confirmArrivalObservedAtUtc = DateTime.MinValue;
        private string _confirmArrivalUrl = "";
        private bool _emptyDataRecoveryUsed;
        private bool _disposed;
        private TimeSpan _resourceCpuTotal = TimeSpan.Zero;
        private DateTime _resourceSampleAtUtc = DateTime.MinValue;
        private int _resourceRootPid;

        private const string WmsHost = "wms-supra.winmart.vn";
        private const string AuthDashboardHost = "auth-supra.winmart.vn";
        private const string AuthDashboardPath = "/dashboard";
        private const string SessionPath = "/sft3/session";
        private const string WmsAppDashboardPath = "/sft3/app/dashboard";
        private const string ConfirmPath = "/sft3/app/saleorder/auto-pickpack-confirm";
        private const string DashboardArrowPath = "m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z";
        private const string LoginMarkerText = "Lưu thông tin đăng nhập";
        private const string SearchText = "Tìm kiếm";
        private const string ConfirmText = "Xác nhận lấy lại hàng";
        private const string ConfirmDialogTitle = "XÁC NHẬN LẤY LẠI HÀNG";
        private const string ConfirmDialogBody = "Bạn có chắc chắn cho phép lấy hàng lại không?";
        private const string ConfirmDialogButtonText = "Xác nhận";
        private const string ConfirmDialogCloseText = "Đóng";
        private const string PageSizeLabel = "Số dòng mỗi trang";
        private const string PageSizeTarget = "100";

        internal SupraConfirmBrowser(Action<string> log)
        {
            _log = log ?? (_ => { });
        }

        internal SupraBrowserState OpenOrShowAgent()
        {
            return OpenOrShow(BrowserLaunchMode.Agent);
        }

        internal SupraBrowserState OpenOrShowDesktop()
        {
            return OpenOrShow(BrowserLaunchMode.Desktop);
        }

        internal SupraBrowserState OpenAgentBackground()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (_launchMode != BrowserLaunchMode.Agent)
                {
                    StopManagedBrowserNoLock();
                    StartNoLock(BrowserLaunchMode.Agent);
                }
                else if (!IsConnectedNoLock() && !TryReconnectNoLock())
                {
                    StopManagedBrowserNoLock();
                    StartNoLock(BrowserLaunchMode.Agent);
                }

                ResetDirectConfirmRecoveryNoLock();
                _manualVisibilityOverride = false;
                NavigateConfirmNoLock();
                SetBrowserWindowsVisibleNoLock(false);
                _hidden = true;
                _log("SUPRA_BROWSER direct_confirm=INITIAL_NAVIGATE mode=AGENT background=true");
                return new SupraBrowserState
                {
                    Ready = false,
                    Hidden = true,
                    State = "LOADING",
                    Browser = _browserName
                };
            }
        }

        internal bool IsAgentOwnedMode()
        {
            lock (_gate) return _launchMode == BrowserLaunchMode.Agent;
        }

        internal bool IsDesktopSelected()
        {
            lock (_gate) return _launchMode == BrowserLaunchMode.Desktop;
        }

        internal bool HasActiveBrowser()
        {
            lock (_gate) return _launchMode != BrowserLaunchMode.None;
        }

        internal string ActiveModeLabel()
        {
            lock (_gate)
            {
                if (_launchMode == BrowserLaunchMode.Agent) return "Web Agent";
                if (_launchMode == BrowserLaunchMode.Desktop) return "Web Desktop";
                return "";
            }
        }

        internal void StopManagedBrowser()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                StopManagedBrowserNoLock();
                _launchMode = BrowserLaunchMode.None;
                _browserName = "";
                _hidden = false;
                _manualVisibilityOverride = false;
                _log("SUPRA_BROWSER stopped_by_operator=true");
            }
        }

        private SupraBrowserState OpenOrShow(BrowserLaunchMode mode)
        {
            lock (_gate)
            {
                ThrowIfDisposed();

                if (_launchMode != mode)
                {
                    StopManagedBrowserNoLock();
                    StartNoLock(mode);
                }
                else if (!IsConnectedNoLock() && !TryReconnectNoLock())
                {
                    StopManagedBrowserNoLock();
                    StartNoLock(mode);
                }

                ResetDirectConfirmRecoveryNoLock();
                _manualVisibilityOverride = true;
                NavigateConfirmNoLock();
                _log("SUPRA_BROWSER direct_confirm=INITIAL_NAVIGATE mode=" +
                     (mode == BrowserLaunchMode.Agent ? "AGENT" : "DESKTOP"));
                ShowNoLock();
            }
            return WaitForReady(TimeSpan.FromSeconds(12));
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
                if (!IsConnectedNoLock() && !TryReconnectNoLock())
                    return new SupraBrowserState { Ready = false, Hidden = _hidden, State = "NOT_OPEN", Browser = _browserName };

                var raw = EvaluateJsonNoLock(BuildReadinessScript());
                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (map == null)
                    return new SupraBrowserState { Ready = false, Hidden = _hidden, State = "DOM_UNAVAILABLE", Browser = _browserName };

                var state = new SupraBrowserState
                {
                    Ready = Bool(map, "ready"),
                    Hidden = _hidden,
                    State = String(map, "state"),
                    Url = String(map, "url"),
                    Browser = _browserName,
                    SearchCount = Int(map, "searchCount"),
                    SearchExactCount = Int(map, "searchExactCount"),
                    SearchDecoratedCount = Int(map, "searchDecoratedCount"),
                    ConfirmCount = Int(map, "confirmCount"),
                    ConfirmVisibleCount = Int(map, "confirmVisibleCount"),
                    TableCount = Int(map, "tableCount"),
                    FrameCount = Int(map, "frameCount"),
                    PageLoaded = Bool(map, "pageLoaded"),
                    LoginMarkerDetected = Bool(map, "loginMarker"),
                    NavigationType = String(map, "navigationType")
                };

                // D137: the first DOM-complete arrival at Confirm is not sufficient proof
                // that WMS data is hydrated. Require one normal browser reload (F5
                // semantics) and a stable READY DOM after that reload before exposing
                // operational readiness.
                var reloadBarrierActive = ApplyConfirmReloadBarrierNoLock(state);
                if (!reloadBarrierActive && state.Ready)
                {
                    ResetDirectConfirmRecoveryNoLock();
                }
                else if (!reloadBarrierActive && TryRecoverConfirmRouteNoLock(state))
                {
                    state.State = _dashboardAccessAttemptCount > 0 &&
                                  _confirmRouteRetryCount == 0
                        ? "DASHBOARD_ACCESS_CLICK"
                        : "AUTO_RETRY_CONFIRM";
                }
                else if (_launchMode == BrowserLaunchMode.Agent &&
                         _dashboardAccessFailed)
                {
                    state.State = "DASHBOARD_ACCESS_FAILED";
                }
                else if (_launchMode == BrowserLaunchMode.Agent &&
                         state.PageLoaded &&
                         !state.LoginMarkerDetected &&
                         _confirmRouteRetryCount >= 1 &&
                         _confirmRetryIssuedAtUtc != DateTime.MinValue &&
                         DateTime.UtcNow - _confirmRetryIssuedAtUtc >= TimeSpan.FromSeconds(3) &&
                         !string.IsNullOrWhiteSpace(state.Url) &&
                         state.Url.IndexOf(ConfirmPath, StringComparison.OrdinalIgnoreCase) < 0)
                {
                    state.State = "CONFIRM_RETRY_EXHAUSTED";
                }

                // D128: Agent-owned WebView2 remains background-only except when the
                // exact login marker requires the operator to enter credentials.
                if (_launchMode == BrowserLaunchMode.Agent)
                {
                    if (state.LoginMarkerDetected && _hidden)
                    {
                        ShowNoLock();
                        state.Hidden = false;
                    }
                    else if (state.Ready && !_hidden && !_manualVisibilityOverride)
                    {
                        SetBrowserWindowsVisibleNoLock(false);
                        _hidden = true;
                        state.Hidden = true;
                    }
                }

                return state;
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
                _manualVisibilityOverride = false;
                _log("SUPRA_BROWSER visibility=HIDDEN taskbar=true process_alive=true");
            }
        }

        internal void Show()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (!IsConnectedNoLock())
                {
                    if (!TryReconnectNoLock())
                    {
                        var mode = _launchMode;
                        if (mode == BrowserLaunchMode.None)
                            throw new InvalidOperationException("Chưa chọn trình duyệt Agent hoặc Desktop.");
                        StopManagedBrowserNoLock();
                        StartNoLock(mode);
                    }
                }
                ShowNoLock();
                _manualVisibilityOverride = true;
            }
        }

        internal BrowserResourceSnapshot SampleResourceUsage()
        {
            lock (_gate)
            {
                var output = new BrowserResourceSnapshot { Browser = _browserName ?? "" };
                if (_disposed || _process == null) return output;

                int rootPid;
                DateTime rootStarted;
                try
                {
                    if (_process.HasExited) return output;
                    rootPid = _process.Id;
                    rootStarted = _process.StartTime;
                }
                catch { return output; }

                var ids = ProcessTreeIds(rootPid);
                if (!ids.Contains(rootPid)) ids.Add(rootPid);

                long workingSet = 0L;
                var totalCpu = TimeSpan.Zero;
                var count = 0;
                foreach (var pid in ids)
                {
                    try
                    {
                        using (var process = Process.GetProcessById(pid))
                        {
                            if (process.HasExited) continue;
                            totalCpu += process.TotalProcessorTime;
                            workingSet += Math.Max(0L, process.WorkingSet64);
                            count++;
                        }
                    }
                    catch { }
                }

                var now = DateTime.UtcNow;
                double cpu = 0d;
                if (_resourceRootPid == rootPid &&
                    _resourceSampleAtUtc != DateTime.MinValue &&
                    now > _resourceSampleAtUtc &&
                    totalCpu >= _resourceCpuTotal)
                {
                    var elapsedMs = (now - _resourceSampleAtUtc).TotalMilliseconds;
                    var cpuMs = (totalCpu - _resourceCpuTotal).TotalMilliseconds;
                    if (elapsedMs > 0d)
                        cpu = Math.Max(0d, Math.Min(100d,
                            cpuMs / elapsedMs / Math.Max(1, Environment.ProcessorCount) * 100d));
                }

                _resourceRootPid = rootPid;
                _resourceCpuTotal = totalCpu;
                _resourceSampleAtUtc = now;

                output.Available = count > 0;
                output.CpuPercent = cpu;
                output.WorkingSetBytes = workingSet;
                output.ProcessCount = count;
                output.RunningFor = DateTime.Now > rootStarted ? DateTime.Now - rootStarted : TimeSpan.Zero;
                return output;
            }
        }

        private static HashSet<int> ProcessTreeIds(int rootPid)
        {
            var parentByPid = SnapshotParentProcessIds();
            var output = new HashSet<int> { rootPid };
            var changed = true;
            while (changed)
            {
                changed = false;
                foreach (var pair in parentByPid)
                {
                    if (output.Contains(pair.Key) || !output.Contains(pair.Value)) continue;
                    output.Add(pair.Key);
                    changed = true;
                }
            }
            return output;
        }

        private static Dictionary<int, int> SnapshotParentProcessIds()
        {
            var output = new Dictionary<int, int>();
            var snapshot = CreateToolhelp32Snapshot(Th32csSnapProcess, 0);
            if (snapshot == InvalidHandleValue) return output;
            try
            {
                var entry = new ProcessEntry32();
                entry.dwSize = (uint)Marshal.SizeOf(typeof(ProcessEntry32));
                if (!Process32First(snapshot, ref entry)) return output;
                do
                {
                    output[(int)entry.th32ProcessID] = (int)entry.th32ParentProcessID;
                    entry.dwSize = (uint)Marshal.SizeOf(typeof(ProcessEntry32));
                }
                while (Process32Next(snapshot, ref entry));
            }
            finally
            {
                CloseHandle(snapshot);
            }
            return output;
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
                EnsurePageSize100NoLock();
                var scan = ScanNoLock(terms);
                if (NeedsSearchRetry(scan) && allowOneSearchClick)
                {
                    ClickExactButtonNoLock(SearchText);
                    output.SearchClicked = true;
                    // D135: DOM retry is local-only and must not increase Firestore usage.
                    // Positive/ambiguous results return immediately. A persistent miss may
                    // settle early only after multiple identical DOM samples; 4.5s remains
                    // the hard safety bound for unusually slow WMS rendering.
                    var deadline = DateTime.UtcNow.AddMilliseconds(4500);
                    var settleNotBefore = DateTime.UtcNow.AddMilliseconds(900);
                    var initialDomFingerprint = scan.DomFingerprint ?? "";
                    var domChangedAfterSearch = false;
                    var stableMissSamples = 0;
                    var lastMissFingerprint = "";
                    SupraBrowserSearchResult latest = scan;
                    while (DateTime.UtcNow < deadline)
                    {
                        Thread.Sleep(200);
                        EnsureReadyNoLock();
                        latest = ScanNoLock(terms);
                        if (!NeedsSearchRetry(latest)) break;

                        if (!string.Equals(latest.DomFingerprint ?? "", initialDomFingerprint, StringComparison.Ordinal))
                            domChangedAfterSearch = true;

                        var unselectableOnly =
                            latest.UnselectableFragments.Count > 0 &&
                            latest.MissingFragments.Count == 0 &&
                            latest.AmbiguousFragments.Count == 0;
                        if ((domChangedAfterSearch || unselectableOnly) &&
                            DateTime.UtcNow >= settleNotBefore)
                        {
                            var fingerprint = SearchFingerprint(latest);
                            if (string.Equals(fingerprint, lastMissFingerprint, StringComparison.Ordinal))
                                stableMissSamples++;
                            else
                            {
                                lastMissFingerprint = fingerprint;
                                stableMissSamples = 1;
                            }
                            if (stableMissSamples >= 4) break;
                        }
                    }
                    scan = latest;
                }

                // D137 hotfix: v78 proved that the Confirm shell may be READY while its
                // PickList table is still empty. If the first real search sees zero PL
                // codes in the entire table, perform one bounded browser reload and retry
                // locally. This adds no Firestore/provider operation and never loops.
                if (allowOneSearchClick && NeedsSearchRetry(scan) &&
                    scan.PicklistCodeCount == 0 && !_emptyDataRecoveryUsed)
                {
                    _emptyDataRecoveryUsed = true;
                    _log("SUPRA_BROWSER empty_data_self_heal=START first_search_zero_picklist_codes=true");
                    IssueConfirmReloadNowNoLock("empty_table_after_search");
                    if (WaitForForcedConfirmReloadNoLock(TimeSpan.FromSeconds(10)))
                    {
                        EnsurePageSize100NoLock();
                        ClickExactButtonNoLock(SearchText);
                        output.SearchClicked = true;
                        var healDeadline = DateTime.UtcNow.AddMilliseconds(4500);
                        var healed = ScanNoLock(terms);
                        while (DateTime.UtcNow < healDeadline && NeedsSearchRetry(healed))
                        {
                            Thread.Sleep(200);
                            healed = ScanNoLock(terms);
                            if (healed.PicklistCodeCount > 0) break;
                        }
                        scan = healed;
                        _log("SUPRA_BROWSER empty_data_self_heal=END picklist_codes=" +
                             scan.PicklistCodeCount + " result=" + scan.Result);
                    }
                }

                // D152: a unique PickList whose checkbox is still unavailable after the
                // existing Search retry gets one bounded top-level reload. This is an
                // exception-only local browser recovery: no Firestore/provider operation,
                // no loop and no mutation. Preserve the pre-reload exact code so a row
                // that disappears/changes cannot be misclassified as a fresh NOT_FOUND.
                if (allowOneSearchClick &&
                    scan.UnselectableFragments.Count > 0 &&
                    scan.AmbiguousFragments.Count == 0)
                {
                    var beforeRecovery = new Dictionary<string, string>(StringComparer.Ordinal);
                    foreach (var term in scan.UnselectableFragments)
                    {
                        List<string> candidates;
                        if (scan.Candidates.TryGetValue(term, out candidates) &&
                            candidates != null && candidates.Count == 1)
                            beforeRecovery[term] = candidates[0];
                    }

                    if (beforeRecovery.Count > 0)
                    {
                        output.RecoveryReloaded = true;
                        _log("SUPRA_BROWSER checkbox_recovery=START terms=" + beforeRecovery.Count +
                             " reason=unique_row_checkbox_not_ready");
                        IssueConfirmReloadNowNoLock("checkbox_not_ready_after_search");
                        if (WaitForForcedConfirmReloadNoLock(TimeSpan.FromMilliseconds(4500)))
                        {
                            EnsurePageSize100NoLock();
                            ClickExactButtonNoLock(SearchText);
                            output.SearchClicked = true;
                            var recoveryDeadline = DateTime.UtcNow.AddMilliseconds(1800);
                            var settleNotBeforeRecovery = DateTime.UtcNow.AddMilliseconds(600);
                            var recovered = ScanNoLock(terms);
                            while (DateTime.UtcNow < recoveryDeadline)
                            {
                                if (DateTime.UtcNow >= settleNotBeforeRecovery &&
                                    CheckboxRecoverySettled(beforeRecovery, recovered))
                                    break;
                                Thread.Sleep(180);
                                recovered = ScanNoLock(terms);
                            }

                            foreach (var pair in beforeRecovery)
                            {
                                List<string> after;
                                if (!recovered.Candidates.TryGetValue(pair.Key, out after) ||
                                    after == null || after.Count == 0 ||
                                    (after.Count == 1 &&
                                     !string.Equals(after[0], pair.Value, StringComparison.OrdinalIgnoreCase)))
                                {
                                    if (!recovered.StateChangedFragments.Contains(pair.Key))
                                        recovered.StateChangedFragments.Add(pair.Key);
                                }
                            }
                            scan = recovered;
                        }
                        _log("SUPRA_BROWSER checkbox_recovery=END ready=" +
                             (scan.UnselectableFragments.Count == 0 ? "1" : "0") +
                             " state_changed=" + scan.StateChangedFragments.Count +
                             " unselectable=" + scan.UnselectableFragments.Count);
                    }
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
                 " unselectable=" + output.UnselectableFragments.Count +
                 " state_changed=" + output.StateChangedFragments.Count +
                 " recovery_reload=" + (output.RecoveryReloaded ? "1" : "0") +
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
                EnsurePageSize100NoLock();

                var mutationScript = BuildMutationScript(code);
                var raw = EvaluateJsonNoLock(mutationScript);
                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                var stepResult = map == null ? "DOM_ERROR" : String(map, "result");
                var stepStage = map == null ? "" : String(map, "stage");

                if (!string.Equals(stepResult, "CLICKED", StringComparison.Ordinal))
                {
                    result.Result = MapDomFailure(stepResult);
                    result.Detail = stepResult;
                    started.Stop();
                    result.ElapsedMs = started.ElapsedMilliseconds;
                    _log("SUPRA_BROWSER confirm result=" + result.Result + " phase=pre_click detail=" + stepResult);
                    return result;
                }

                _log("SUPRA_BROWSER confirm guard stage=" + (string.IsNullOrWhiteSpace(stepStage) ? "UNKNOWN" : stepStage) +
                     " dialog_required=true");

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
                    // D152: after the existing 8s passive observation, perform exactly one
                    // read-only Search refresh. Never click Confirm again. Stable removal
                    // of the exact row after that refresh is trusted as terminal success.
                    try
                    {
                        if (ExactRowMissingAfterOneSearchNoLock(
                            code, TimeSpan.FromMilliseconds(1800), "post_confirm_timeout"))
                        {
                            result.Result = "CONFIRMED";
                            result.Detail = "ROW_REMOVED_AFTER_SEARCH_REFRESH";
                        }
                    }
                    catch (Exception ex)
                    {
                        _log("SUPRA_BROWSER confirm verify_search=DEFER type=" + ex.GetType().Name);
                    }
                }

                if (string.IsNullOrWhiteSpace(result.Result) || result.Result == "CONFIRM_ERROR")
                {
                    result.Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                    result.Detail = "POST_CONFIRM_TIMEOUT_AFTER_SEARCH_REFRESH";
                }
            }

            started.Stop();
            result.ElapsedMs = started.ElapsedMilliseconds;
            _log("SUPRA_BROWSER confirm result=" + result.Result +
                 " ms=" + result.ElapsedMs +
                 " direct_api=false session_extract=false");
            return result;
        }

        internal SupraBrowserConfirmResult VerifyExactAfterUncertain(string fullPickListCode)
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
                EnsurePageSize100NoLock();
                try
                {
                    if (ExactRowMissingAfterOneSearchNoLock(
                        code, TimeSpan.FromMilliseconds(1800), "existing_uncertain_guard"))
                    {
                        result.Result = "CONFIRMED";
                        result.Detail = "VERIFY_ONLY_ROW_REMOVED_STABLE";
                    }
                    else
                    {
                        result.Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                        result.Detail = "VERIFY_ONLY_ROW_STILL_PRESENT_OR_UNSTABLE";
                    }
                }
                catch (Exception ex)
                {
                    result.Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
                    result.Detail = "VERIFY_ONLY_SEARCH_UNAVAILABLE";
                    _log("SUPRA_BROWSER verify_only=DEFER type=" + ex.GetType().Name);
                }
            }

            started.Stop();
            result.ElapsedMs = started.ElapsedMilliseconds;
            _log("SUPRA_BROWSER verify_only result=" + result.Result +
                 " ms=" + result.ElapsedMs +
                 " mutation=false search_refresh_once=true");
            return result;
        }

        private void StartNoLock(BrowserLaunchMode mode)
        {
            DisposeSocketNoLock();

            if (mode == BrowserLaunchMode.Agent)
            {
                string ownedHost;
                string fixedRuntime;
                if (!AgentBrowserBundle.TryGetReady(out ownedHost, out fixedRuntime))
                    throw new InvalidOperationException("Trình duyệt Agent chưa khả dụng. Hãy tải trình duyệt Agent trước.");

                try
                {
                    StartOwnedWebView2NoLock(ownedHost, fixedRuntime);
                    _launchMode = BrowserLaunchMode.Agent;
                    return;
                }
                catch (Exception ex)
                {
                    _log("SUPRA_BROWSER owned_webview2=FAILED type=" + ex.GetType().Name +
                         " detail=" + AgentDiagnostics.Sanitize(ex.Message) +
                         " auto_fallback=false");
                    StopManagedBrowserNoLock();
                    throw;
                }
            }

            if (mode == BrowserLaunchMode.Desktop)
            {
                StartLegacyBrowserNoLock();
                _launchMode = BrowserLaunchMode.Desktop;
                return;
            }

            throw new InvalidOperationException("Chưa chọn loại trình duyệt.");
        }

        private void StartOwnedWebView2NoLock(string hostExe, string fixedRuntime)
        {
            _port = FindFreeLoopbackPort();
            var profileDir = Path.Combine(
                AgentBrowserStorage.CurrentRoot,
                "webview2-fixed-profile");
            Directory.CreateDirectory(profileDir);

            var args =
                "--url=\"" + AgentConfig.WmsPicklistConfirmUiReferenceUrl.Replace("\"", "") + "\" " +
                "--profile=\"" + profileDir.Replace("\"", "") + "\" " +
                "--runtime=\"" + fixedRuntime.Replace("\"", "") + "\" " +
                "--debug-port=" + _port;

            _process = Process.Start(new ProcessStartInfo
            {
                FileName = hostExe,
                Arguments = args,
                UseShellExecute = false,
                WorkingDirectory = Path.GetDirectoryName(hostExe) ?? ""
            });
            if (_process == null) throw new InvalidOperationException("Không mở được Agent WebView2.");

            _browserName = "Agent WebView2 Fixed";
            AttachDevToolsNoLock(TimeSpan.FromSeconds(25));
            _hidden = false;
            _log("SUPRA_BROWSER start browser=AGENT_WEBVIEW2_FIXED loopback=127.0.0.1 profile=dedicated auto_fallback=false session_extract=false network_domain=false");
        }

        private void StartLegacyBrowserNoLock()
        {
            var browser = FindSupportedBrowser();
            if (browser == null)
                throw new InvalidOperationException("Không tìm thấy Agent WebView2, Microsoft Edge hoặc Google Chrome.");

            _port = FindFreeLoopbackPort();
            var profileDir = Path.Combine(
                AgentBrowserStorage.CurrentRoot,
                browser.ProfileKey);
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
            AttachDevToolsNoLock(TimeSpan.FromSeconds(20));
            _hidden = false;
            _log("SUPRA_BROWSER start browser=" + _browserName +
                 " loopback=127.0.0.1 profile=dedicated launch=DESKTOP session_extract=false network_domain=false");
        }

        private void AttachDevToolsNoLock(TimeSpan timeout)
        {
            _targetUrl = WaitForPageTarget(_port, timeout);
            _socket = new ClientWebSocket();
            _socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
            _socket.ConnectAsync(new Uri(_targetUrl), CancellationToken.None).GetAwaiter().GetResult();
            CommandNoLock("Runtime.enable", null, TimeSpan.FromSeconds(5));
            CommandNoLock("Page.enable", null, TimeSpan.FromSeconds(5));
        }

        private void NavigateConfirmNoLock()
        {
            ResetConfirmReloadGateNoLock();
            CommandNoLock("Page.navigate", new Dictionary<string, object>
            {
                { "url", AgentConfig.WmsPicklistConfirmUiReferenceUrl }
            }, TimeSpan.FromSeconds(5));
            _log("SUPRA_BROWSER confirm_reload=WAIT_FINAL_CONFIRM settle_ms=3000 reason=canonical_confirm_navigation");
        }

        private void ResetConfirmReloadGateNoLock()
        {
            _confirmReloadRequired = false;
            _confirmReloadIssued = false;
            _confirmReloadVerified = false;
            _confirmReloadIssuedAtUtc = DateTime.MinValue;
            _confirmReloadStableSinceUtc = DateTime.MinValue;
            _confirmArrivalObservedAtUtc = DateTime.MinValue;
            _confirmArrivalUrl = "";
            _emptyDataRecoveryUsed = false;
        }

        private void ResetConfirmArrivalObservationNoLock()
        {
            if (_confirmReloadIssued) return;
            _confirmReloadRequired = false;
            _confirmArrivalObservedAtUtc = DateTime.MinValue;
            _confirmArrivalUrl = "";
            _confirmReloadStableSinceUtc = DateTime.MinValue;
        }

        private void IssueConfirmReloadNowNoLock(string reason)
        {
            _confirmReloadRequired = true;
            _confirmReloadIssued = true;
            _confirmReloadVerified = false;
            _confirmReloadIssuedAtUtc = DateTime.UtcNow;
            _confirmReloadStableSinceUtc = DateTime.MinValue;
            CommandNoLock("Page.reload", new Dictionary<string, object>
            {
                { "ignoreCache", false }
            }, TimeSpan.FromSeconds(5));
            _log("SUPRA_BROWSER confirm_reload=ISSUED method=Page.reload ignore_cache=false reason=" + reason);
        }

        private bool ApplyConfirmReloadBarrierNoLock(SupraBrowserState state)
        {
            if (state == null || state.LoginMarkerDetected || string.IsNullOrWhiteSpace(state.Url) ||
                state.Url.IndexOf(ConfirmPath, StringComparison.OrdinalIgnoreCase) < 0)
            {
                ResetConfirmArrivalObservationNoLock();
                return false;
            }

            if (_confirmReloadVerified) return false;

            if (!state.PageLoaded)
            {
                state.Ready = false;
                state.State = _confirmReloadIssued ? "CONFIRM_REFRESHING" : "CONFIRM_SETTLING";
                return true;
            }

            var now = DateTime.UtcNow;
            if (_confirmArrivalObservedAtUtc == DateTime.MinValue ||
                !string.Equals(_confirmArrivalUrl, state.Url, StringComparison.Ordinal))
            {
                _confirmArrivalObservedAtUtc = now;
                _confirmArrivalUrl = state.Url;
                _confirmReloadRequired = true;
                _confirmReloadIssued = false;
                _confirmReloadIssuedAtUtc = DateTime.MinValue;
                _confirmReloadStableSinceUtc = DateTime.MinValue;
                state.Ready = false;
                state.State = "CONFIRM_SETTLING";
                _log("SUPRA_BROWSER confirm_reload=ARMED reason=stable_final_confirm settle_ms=3000 normal_f5=true");
                return true;
            }

            if (!_confirmReloadIssued)
            {
                // D137 hotfix: v78 reloaded only ~0.6s after the final WMS child appeared.
                // That can reload the visual shell before the authenticated WMS data
                // bootstrap settles. Hold the same final Confirm document for 3s first.
                if (now - _confirmArrivalObservedAtUtc < TimeSpan.FromSeconds(3))
                {
                    state.Ready = false;
                    state.State = "CONFIRM_SETTLING";
                    return true;
                }

                if (string.Equals(state.NavigationType, "reload", StringComparison.OrdinalIgnoreCase))
                {
                    _confirmReloadIssued = true;
                    _confirmReloadIssuedAtUtc = now;
                    _confirmReloadStableSinceUtc = DateTime.MinValue;
                    _log("SUPRA_BROWSER confirm_reload=MANUAL_OR_EXISTING_RELOAD observed_after_settle=true");
                }
                else
                {
                    IssueConfirmReloadNowNoLock("final_confirm_settled");
                    state.Ready = false;
                    state.State = "CONFIRM_REFRESHING";
                    return true;
                }
            }

            var realReload = string.Equals(state.NavigationType, "reload", StringComparison.OrdinalIgnoreCase);
            if (!realReload || !state.Ready)
            {
                _confirmReloadStableSinceUtc = DateTime.MinValue;
                state.Ready = false;
                state.State = realReload ? "CONFIRM_RELOAD_VERIFY" : "CONFIRM_REFRESHING";
                return true;
            }

            if (_confirmReloadStableSinceUtc == DateTime.MinValue)
            {
                _confirmReloadStableSinceUtc = now;
                state.Ready = false;
                state.State = "CONFIRM_RELOAD_VERIFY";
                return true;
            }

            if (now - _confirmReloadStableSinceUtc < TimeSpan.FromMilliseconds(1200))
            {
                state.Ready = false;
                state.State = "CONFIRM_RELOAD_VERIFY";
                return true;
            }

            _confirmReloadRequired = false;
            _confirmReloadIssued = false;
            _confirmReloadVerified = true;
            _confirmReloadIssuedAtUtc = DateTime.MinValue;
            _confirmReloadStableSinceUtc = DateTime.MinValue;
            _log("SUPRA_BROWSER confirm_reload=PASS navigation_type=reload settle_before_ms=3000 stable_after_ms=1200 data_dom_ready=true");
            return false;
        }

        private bool WaitForForcedConfirmReloadNoLock(TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow.Add(timeout);
            var stableSince = DateTime.MinValue;
            while (DateTime.UtcNow < deadline)
            {
                Thread.Sleep(250);
                var raw = EvaluateJsonNoLock(BuildReadinessScript());
                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                var loaded = map != null && Bool(map, "pageLoaded");
                var ready = map != null && Bool(map, "ready");
                var nav = map == null ? "" : String(map, "navigationType");
                var url = map == null ? "" : String(map, "url");
                var onConfirm = url.IndexOf(ConfirmPath, StringComparison.OrdinalIgnoreCase) >= 0;
                if (loaded && ready && onConfirm &&
                    string.Equals(nav, "reload", StringComparison.OrdinalIgnoreCase))
                {
                    if (stableSince == DateTime.MinValue) stableSince = DateTime.UtcNow;
                    if (DateTime.UtcNow - stableSince >= TimeSpan.FromMilliseconds(1200))
                    {
                        _confirmReloadRequired = false;
                        _confirmReloadIssued = false;
                        _confirmReloadVerified = true;
                        _confirmReloadIssuedAtUtc = DateTime.MinValue;
                        _confirmReloadStableSinceUtc = DateTime.MinValue;
                        _confirmArrivalObservedAtUtc = DateTime.UtcNow;
                        _confirmArrivalUrl = url;
                        _log("SUPRA_BROWSER confirm_reload=SELF_HEAL_PASS navigation_type=reload stable_after_ms=1200");
                        return true;
                    }
                }
                else
                {
                    stableSince = DateTime.MinValue;
                }
            }
            _log("SUPRA_BROWSER confirm_reload=SELF_HEAL_TIMEOUT fail_closed=true");
            return false;
        }

        private bool TryReconnectNoLock()
        {
            if (_port <= 0 || _process == null || _process.HasExited) return false;
            try
            {
                DisposeSocketNoLock();
                _targetUrl = WaitForPageTarget(_port, TimeSpan.FromSeconds(4));
                _socket = new ClientWebSocket();
                _socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
                _socket.ConnectAsync(new Uri(_targetUrl), CancellationToken.None).GetAwaiter().GetResult();
                CommandNoLock("Runtime.enable", null, TimeSpan.FromSeconds(5));
                CommandNoLock("Page.enable", null, TimeSpan.FromSeconds(5));
                _log("SUPRA_BROWSER devtools=reconnected loopback=127.0.0.1 session_extract=false network_domain=false");
                return true;
            }
            catch (Exception ex)
            {
                DisposeSocketNoLock();
                _log("SUPRA_BROWSER devtools=reconnect_fail type=" + ex.GetType().Name);
                return false;
            }
        }

        private void ReconnectToWmsPageTargetNoLock(TimeSpan timeout)
        {
            DisposeSocketNoLock();
            _targetUrl = WaitForPageTarget(_port, timeout, true);
            _socket = new ClientWebSocket();
            _socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
            _socket.ConnectAsync(new Uri(_targetUrl), CancellationToken.None).GetAwaiter().GetResult();
            CommandNoLock("Runtime.enable", null, TimeSpan.FromSeconds(5));
            CommandNoLock("Page.enable", null, TimeSpan.FromSeconds(5));
        }

        private void StopManagedBrowserNoLock()
        {
            DisposeSocketNoLock();
            if (_process == null) return;
            try
            {
                if (!_process.HasExited)
                {
                    try { _process.CloseMainWindow(); } catch { }
                    try { _process.WaitForExit(1200); } catch { }
                    if (!_process.HasExited)
                    {
                        try { _process.Kill(); } catch { }
                        try { _process.WaitForExit(1200); } catch { }
                    }
                }
            }
            catch { }
            _process = null;
            _resourceRootPid = 0;
            _resourceCpuTotal = TimeSpan.Zero;
            _resourceSampleAtUtc = DateTime.MinValue;
            _port = 0;
            _targetUrl = "";
            ResetDirectConfirmRecoveryNoLock();
            ResetConfirmReloadGateNoLock();
        }

        private void EnsureReadyNoLock()
        {
            if (!IsConnectedNoLock())
                throw new InvalidOperationException("Chưa mở trình duyệt Confirm PickList.");
            if (_confirmReloadRequired || !_confirmReloadVerified)
                throw new InvalidOperationException("Web Confirm đang hoàn tất bước làm mới dữ liệu trước khi cho phép xử lý PickList.");
            var raw = EvaluateJsonNoLock(BuildReadinessScript());
            var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
            if (map == null || !Bool(map, "ready") ||
                !string.Equals(String(map, "navigationType"), "reload", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Web Confirm chưa sẵn sàng sau bước làm mới dữ liệu. Hãy chờ Agent xác nhận sẵn sàng.");
        }

        private void ResetDirectConfirmRecoveryNoLock()
        {
            _confirmRouteRetryCount = 0;
            _loginMarkerObserved = false;
            _loadedNonConfirmObservedUrl = "";
            _loadedNonConfirmObservedAtUtc = DateTime.MinValue;
            _confirmRetryIssuedAtUtc = DateTime.MinValue;
            _dashboardAccessAttemptCount = 0;
            _dashboardAccessFailed = false;
            _dashboardWmsTargetAttached = false;
            _dashboardAccessIssuedAtUtc = DateTime.MinValue;
        }

        private void ResetRouteObservationNoLock()
        {
            _loadedNonConfirmObservedUrl = "";
            _loadedNonConfirmObservedAtUtc = DateTime.MinValue;
        }

        private static bool IsAuthDashboardUrl(string value)
        {
            Uri uri;
            if (!Uri.TryCreate(value ?? "", UriKind.Absolute, out uri)) return false;
            return string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(uri.Host, AuthDashboardHost, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(uri.AbsolutePath.TrimEnd('/'), AuthDashboardPath, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsWmsSessionTransitionUrl(string value)
        {
            Uri uri;
            if (!Uri.TryCreate(value ?? "", UriKind.Absolute, out uri)) return false;
            if (!string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(uri.Host, WmsHost, StringComparison.OrdinalIgnoreCase))
                return false;

            var path = uri.AbsolutePath.TrimEnd('/');
            return string.Equals(path, SessionPath, StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(path, "/sft3", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsWmsAppDashboardUrl(string value)
        {
            Uri uri;
            if (!Uri.TryCreate(value ?? "", UriKind.Absolute, out uri)) return false;
            return string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(uri.Host, WmsHost, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(uri.AbsolutePath.TrimEnd('/'), WmsAppDashboardPath, StringComparison.OrdinalIgnoreCase);
        }

        private bool IssueDashboardAccessClickNoLock(string reason)
        {
            if (_dashboardAccessAttemptCount >= 1)
            {
                _dashboardAccessFailed = true;
                _log("SUPRA_BROWSER dashboard_access=REFUSED reason=already_attempted no_loop=true");
                return false;
            }

            _dashboardAccessAttemptCount = 1;
            _dashboardAccessFailed = false;
            _dashboardWmsTargetAttached = false;
            _dashboardAccessIssuedAtUtc = DateTime.UtcNow;
            ResetRouteObservationNoLock();

            var raw = EvaluateJsonNoLock(BuildDashboardAccessClickScript());
            var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
            var result = map == null ? "DOM_ERROR" : String(map, "result");
            var reasonCode = map == null ? "DOM_ERROR" : String(map, "reason");
            var arrows = map == null ? 0 : Int(map, "arrows");
            var targets = map == null ? 0 : Int(map, "targets");

            _log("SUPRA_BROWSER dashboard_access=" + result +
                 " reason=" + reason +
                 " selector_reason=" + (string.IsNullOrWhiteSpace(reasonCode) ? "UNKNOWN" : reasonCode) +
                 " arrows=" + arrows +
                 " targets=" + targets +
                 " method=DOM_CLICK popup_semantics=preserve");

            if (!string.Equals(result, "CLICKED", StringComparison.Ordinal))
            {
                _dashboardAccessFailed = true;
                return false;
            }

            try
            {
                ReconnectToWmsPageTargetNoLock(TimeSpan.FromSeconds(8));
                _dashboardWmsTargetAttached = true;
                _log("SUPRA_BROWSER dashboard_popup=ATTACHED devtools_target=WMS child_context=true");
                return true;
            }
            catch (Exception ex)
            {
                _dashboardAccessFailed = true;
                _log("SUPRA_BROWSER dashboard_popup=ATTACH_FAILED type=" + ex.GetType().Name +
                     " no_direct_session_fallback=true");
                return false;
            }
        }

        private void IssueDirectConfirmRetryNoLock(string sourceUrl, string reason)
        {
            _confirmRouteRetryCount = 1;
            _confirmRetryIssuedAtUtc = DateTime.UtcNow;
            ResetRouteObservationNoLock();
            NavigateConfirmNoLock();
            _log("SUPRA_BROWSER route_recovery=DIRECT_CONFIRM_RETRY retry=1 reason=" + reason +
                 " source_host_unrestricted=true");
        }

        private bool TryRecoverConfirmRouteNoLock(SupraBrowserState state)
        {
            if (_launchMode != BrowserLaunchMode.Agent || state == null || state.Ready)
                return false;

            if (state.LoginMarkerDetected)
            {
                if (!_loginMarkerObserved)
                    _log("SUPRA_BROWSER login_marker=DETECTED awaiting_user=true route_recovery=paused");

                _loginMarkerObserved = true;
                _confirmRouteRetryCount = 0;
                _confirmRetryIssuedAtUtc = DateTime.MinValue;
                _dashboardAccessAttemptCount = 0;
                _dashboardAccessFailed = false;
                _dashboardWmsTargetAttached = false;
                _dashboardAccessIssuedAtUtc = DateTime.MinValue;
                ResetRouteObservationNoLock();
                return false;
            }

            var loginJustCleared = false;
            if (_loginMarkerObserved)
            {
                _loginMarkerObserved = false;
                _confirmRouteRetryCount = 0;
                _confirmRetryIssuedAtUtc = DateTime.MinValue;
                _dashboardAccessAttemptCount = 0;
                _dashboardAccessFailed = false;
                _dashboardWmsTargetAttached = false;
                _dashboardAccessIssuedAtUtc = DateTime.MinValue;
                ResetRouteObservationNoLock();
                loginJustCleared = true;
                _log("SUPRA_BROWSER login_marker=CLEARED route_recovery=rearmed");
            }

            if (!state.PageLoaded || string.IsNullOrWhiteSpace(state.Url))
                return false;
            if (state.Url.IndexOf(ConfirmPath, StringComparison.OrdinalIgnoreCase) >= 0)
                return false;

            var now = DateTime.UtcNow;

            // Preserve the already field-proven login path: after the visible login marker
            // clears, retry the canonical Confirm URL once. If that later settles back on
            // auth Dashboard, the dashboard-click recovery below gets one bounded attempt.
            if (loginJustCleared)
            {
                IssueDirectConfirmRetryNoLock(state.Url, "login_marker_cleared");
                return true;
            }

            if (_dashboardAccessAttemptCount > 0)
            {
                if (_dashboardAccessFailed)
                    return false;

                if (!_dashboardWmsTargetAttached)
                {
                    if (_dashboardAccessIssuedAtUtc != DateTime.MinValue &&
                        now - _dashboardAccessIssuedAtUtc < TimeSpan.FromSeconds(8))
                        return true;

                    _dashboardAccessFailed = true;
                    _log("SUPRA_BROWSER dashboard_popup=ATTACH_TIMEOUT no_loop=true");
                    return false;
                }

                if (IsWmsAppDashboardUrl(state.Url))
                {
                    if (_confirmRouteRetryCount == 0)
                    {
                        IssueDirectConfirmRetryNoLock(state.Url, "dashboard_popup_sft3_ready");
                        _log("SUPRA_BROWSER dashboard_popup=SFT3_READY confirm_next=true");
                    }
                    return true;
                }

                if (IsWmsSessionTransitionUrl(state.Url) ||
                    now - _dashboardAccessIssuedAtUtc < TimeSpan.FromSeconds(12))
                {
                    return true;
                }

                _dashboardAccessFailed = true;
                _log("SUPRA_BROWSER dashboard_popup=FLOW_TIMEOUT no_loop=true");
                return false;
            }

            // Let a fully loaded non-Confirm page settle before deciding whether it is the
            // auth Dashboard or another transient SSO destination.
            if (!string.Equals(_loadedNonConfirmObservedUrl, state.Url, StringComparison.Ordinal))
            {
                _loadedNonConfirmObservedUrl = state.Url;
                _loadedNonConfirmObservedAtUtc = now;
                return false;
            }

            if (_loadedNonConfirmObservedAtUtc == DateTime.MinValue ||
                now - _loadedNonConfirmObservedAtUtc < TimeSpan.FromMilliseconds(750))
                return false;

            if (IsAuthDashboardUrl(state.Url))
            {
                // If a direct Confirm retry was just issued after login, give that normal
                // navigation a short grace before clicking Dashboard.
                if (_confirmRouteRetryCount >= 1 &&
                    _confirmRetryIssuedAtUtc != DateTime.MinValue &&
                    now - _confirmRetryIssuedAtUtc < TimeSpan.FromSeconds(3))
                    return true;

                return IssueDashboardAccessClickNoLock(
                    _confirmRouteRetryCount >= 1
                        ? "confirm_retry_returned_auth_dashboard"
                        : "initial_confirm_returned_auth_dashboard");
            }

            if (_confirmRouteRetryCount >= 1)
            {
                return _confirmRetryIssuedAtUtc != DateTime.MinValue &&
                       now - _confirmRetryIssuedAtUtc < TimeSpan.FromSeconds(3);
            }

            IssueDirectConfirmRetryNoLock(state.Url, "stable_loaded_non_login_non_confirm");
            return true;
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

            result.DomFingerprint = String(map, "domFingerprint");
            result.PicklistCodeCount = Int(map, "allCodeCount");
            var rows = map.TryGetValue("candidates", out var candidateObj)
                ? candidateObj as Dictionary<string, object>
                : null;
            var selectableRows = map.TryGetValue("selectable", out var selectableObj)
                ? selectableObj as Dictionary<string, object>
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
                else
                {
                    result.Matches.Add(candidates[0]);
                    var selectableCodes = new List<string>();
                    object rawSelectable;
                    var arr = selectableRows != null && selectableRows.TryGetValue(term, out rawSelectable)
                        ? rawSelectable as object[]
                        : null;
                    if (arr != null)
                    {
                        foreach (var item in arr)
                        {
                            var code = Convert.ToString(item) ?? "";
                            if (!string.IsNullOrWhiteSpace(code)) selectableCodes.Add(code);
                        }
                    }
                    if (!selectableCodes.Exists(x => string.Equals(x, candidates[0], StringComparison.OrdinalIgnoreCase)))
                        result.UnselectableFragments.Add(term);
                }
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
            return result != null &&
                   (result.MissingFragments.Count > 0 || result.UnselectableFragments.Count > 0) &&
                   result.AmbiguousFragments.Count == 0;
        }

        private static bool CheckboxRecoverySettled(
            Dictionary<string, string> beforeRecovery,
            SupraBrowserSearchResult result)
        {
            if (result == null) return false;
            foreach (var pair in beforeRecovery)
            {
                List<string> candidates;
                if (!result.Candidates.TryGetValue(pair.Key, out candidates) ||
                    candidates == null || candidates.Count == 0)
                    continue;
                if (candidates.Count != 1)
                    continue;
                if (!string.Equals(candidates[0], pair.Value, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (result.UnselectableFragments.Exists(
                    x => string.Equals(x, pair.Key, StringComparison.Ordinal)))
                    return false;
            }
            return true;
        }

        private bool ExactRowMissingAfterOneSearchNoLock(
            string code,
            TimeSpan timeout,
            string reason)
        {
            ClickExactButtonNoLock(SearchText);
            _log("SUPRA_BROWSER verify_search=START reason=" + reason +
                 " mutation=false confirm_click=false");
            var deadline = DateTime.UtcNow.Add(timeout);
            var rowMissingSamples = 0;
            var rowMissingSinceUtc = DateTime.MinValue;
            while (DateTime.UtcNow < deadline)
            {
                Thread.Sleep(200);
                var raw = EvaluateJsonNoLock(BuildPostConfirmScript(code));
                var post = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (post == null) continue;
                if (Bool(post, "rowMissing"))
                {
                    if (rowMissingSamples == 0) rowMissingSinceUtc = DateTime.UtcNow;
                    rowMissingSamples++;
                    if (rowMissingSamples >= 3 &&
                        DateTime.UtcNow - rowMissingSinceUtc >= TimeSpan.FromMilliseconds(600))
                    {
                        _log("SUPRA_BROWSER verify_search=ROW_REMOVED_STABLE reason=" + reason);
                        return true;
                    }
                }
                else
                {
                    rowMissingSamples = 0;
                    rowMissingSinceUtc = DateTime.MinValue;
                }
            }
            _log("SUPRA_BROWSER verify_search=ROW_PRESENT_OR_UNSTABLE reason=" + reason);
            return false;
        }

        private static string SearchFingerprint(SupraBrowserSearchResult result)
        {
            if (result == null) return "NULL";
            var parts = new List<string>
            {
                result.Result ?? "",
                "M:" + string.Join(",", result.MissingFragments.ToArray()),
                "A:" + string.Join(",", result.AmbiguousFragments.ToArray()),
                "U:" + string.Join(",", result.UnselectableFragments.ToArray()),
                "D:" + (result.DomFingerprint ?? "")
            };
            foreach (var pair in result.Candidates.OrderBy(x => x.Key, StringComparer.Ordinal))
            {
                var values = pair.Value == null ? new string[0] : pair.Value.OrderBy(x => x, StringComparer.Ordinal).ToArray();
                parts.Add(pair.Key + "=" + string.Join(",", values));
            }
            return string.Join("|", parts.ToArray());
        }

        private static void CopySearch(SupraBrowserSearchResult source, SupraBrowserSearchResult target)
        {
            target.Result = source.Result;
            target.PicklistCodeCount = source.PicklistCodeCount;
            target.Matches.AddRange(source.Matches);
            target.MissingFragments.AddRange(source.MissingFragments);
            target.AmbiguousFragments.AddRange(source.AmbiguousFragments);
            target.UnselectableFragments.AddRange(source.UnselectableFragments);
            target.StateChangedFragments.AddRange(source.StateChangedFragments);
            target.RecoveryReloaded = target.RecoveryReloaded || source.RecoveryReloaded;
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
                case "CONFIRM_DIALOG_NOT_FOUND":
                case "CONFIRM_DIALOG_AMBIGUOUS":
                case "CONFIRM_DIALOG_TITLE_MISMATCH":
                case "CONFIRM_DIALOG_BODY_MISMATCH":
                case "CONFIRM_DIALOG_BUTTON_NOT_UNIQUE":
                case "CONFIRM_DIALOG_BUTTON_DISABLED":
                case "CONFIRM_DIALOG_CLOSE_NOT_UNIQUE":
                case "PAGE_NOT_READY":
                    return "CONFIRM_REJECTED";
                default:
                    return "CONFIRM_IN_PROGRESS_OR_UNCERTAIN";
            }
        }

        private void EnsurePageSize100NoLock()
        {
            var raw = EvaluateJsonNoLock(BuildEnsurePageSize100Script());
            var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
            var result = map == null ? "DOM_ERROR" : String(map, "result");
            if (string.Equals(result, "ALREADY_100", StringComparison.Ordinal) ||
                string.Equals(result, "CHANGED_100", StringComparison.Ordinal))
                return;
            throw new InvalidOperationException("Không đặt được Số dòng mỗi trang = 100 · " + result);
        }

        private static string BuildEnsurePageSize100Script()
        {
            return @"(async () => {
              const norm = v => String(v || '').replace(/\s+/g,' ').trim();
              const fold = v => norm(v).toLowerCase();
              const visible = e => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
              const docs = [];
              const seenDocs = new Set();
              const addDoc = d => {
                if (!d || seenDocs.has(d) || docs.length >= 8) return;
                seenDocs.add(d); docs.push(d);
                for (const frame of [...d.querySelectorAll('iframe')]) {
                  try { if (frame.contentDocument) addDoc(frame.contentDocument); } catch (_) {}
                }
              };
              addDoc(document);

              const labelText = '" + PageSizeLabel + @"';
              const targetText = '" + PageSizeTarget + @"';
              const controlSelector = 'select,[role=combobox],mat-select,.mat-select-trigger,.mat-mdc-select-trigger';
              const allowed = /^(5|7|10|25|50|100)$/;
              const leaves = docs.flatMap(d => [...d.querySelectorAll('body *')]).filter(e =>
                visible(e) && fold(e.innerText || e.textContent) === fold(labelText) &&
                ![...e.children].some(child => visible(child) && fold(child.innerText || child.textContent) === fold(labelText)));

              if (!leaves.length) return JSON.stringify({result:'PAGE_SIZE_LABEL_NOT_FOUND'});

              const candidates = [];
              const seenControls = new Set();
              for (const label of leaves) {
                let host = label.parentElement;
                for (let depth = 1; host && depth <= 8; depth++, host = host.parentElement) {
                  const controls = [...host.querySelectorAll(controlSelector)].filter(visible);
                  for (const control of controls) {
                    if (seenControls.has(control)) continue;
                    const value = norm(control.value || control.innerText || control.textContent);
                    const aria = norm(control.getAttribute && (control.getAttribute('aria-label') || control.getAttribute('title')));
                    const semantic = allowed.test(value) ||
                      fold(aria).includes(fold(labelText)) ||
                      fold(host.innerText || host.textContent).includes(fold(labelText));
                    if (!semantic) continue;
                    seenControls.add(control);
                    candidates.push({control,depth,value});
                  }
                  if (candidates.some(x => x.depth === depth)) break;
                }
              }

              if (!candidates.length) return JSON.stringify({result:'PAGE_SIZE_CONTROL_NOT_FOUND',labels:leaves.length});

              candidates.sort((a,b) => a.depth - b.depth);
              const setNative = control => {
                const options = [...control.options].filter(o =>
                  norm(o.value) === targetText || norm(o.textContent) === targetText);
                if (options.length !== 1) return false;
                control.value = options[0].value;
                control.dispatchEvent(new Event('input',{bubbles:true}));
                control.dispatchEvent(new Event('change',{bubbles:true}));
                return true;
              };

              const current = control => norm(control.value || control.innerText || control.textContent);
              for (const candidate of candidates) {
                const control = candidate.control;
                if (/(^|\s)100(\s|$)/.test(current(control)))
                  return JSON.stringify({result:'ALREADY_100',candidates:candidates.length});

                let changed = false;
                if (control.tagName && control.tagName.toLowerCase() === 'select') {
                  changed = setNative(control);
                } else {
                  try { control.click(); } catch (_) { continue; }
                  let option = null;
                  const deadline = Date.now() + 2500;
                  do {
                    const options = docs.flatMap(d => [...d.querySelectorAll('[role=option],mat-option,.mat-option,.mat-mdc-option')])
                      .filter(e => visible(e) && norm(e.innerText || e.textContent) === targetText);
                    if (options.length) { option = options[0]; break; }
                    await new Promise(r => setTimeout(r,80));
                  } while (Date.now() < deadline);
                  if (option) {
                    option.click();
                    changed = true;
                  }
                }

                if (!changed) continue;
                const verifyDeadline = Date.now() + 4500;
                do {
                  await new Promise(r => setTimeout(r,100));
                  if (/(^|\s)100(\s|$)/.test(current(control))) {
                    await new Promise(r => setTimeout(r,300));
                    return JSON.stringify({result:'CHANGED_100',candidates:candidates.length});
                  }
                } while (Date.now() < verifyDeadline);
              }

              return JSON.stringify({
                result:'PAGE_SIZE_100_VERIFY_FAILED',
                labels:leaves.length,
                candidates:candidates.length,
                values:candidates.map(x => current(x.control)).slice(0,6)
              });
            })()";
        }

        private string BuildDashboardAccessClickScript()
        {
            var arrowJson = _json.Serialize(DashboardArrowPath);
            return @"(() => {
              const arrowPath = " + arrowJson + @";
              const fold = value => (value || '')
                .normalize('NFC')
                .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
              const visible = e => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
              const docs = [];
              const seen = new Set();
              const addDoc = d => {
                if (!d || seen.has(d) || docs.length >= 8) return;
                seen.add(d);
                docs.push(d);
                for (const frame of [...d.querySelectorAll('iframe,frame')]) {
                  try { if (frame.contentDocument) addDoc(frame.contentDocument); } catch (_) {}
                }
              };
              addDoc(document);

              const candidates = [];
              let arrows = 0;
              for (const d of docs) {
                for (const path of [...d.querySelectorAll('path')]) {
                  if (path.getAttribute('d') !== arrowPath) continue;
                  const svg = path.closest('svg');
                  if (!svg || !visible(svg)) continue;
                  arrows++;
                  const button = path.closest('button,[role=button],a');
                  if (!button || !visible(button) || button.disabled ||
                      button.getAttribute('aria-disabled') === 'true') continue;

                  let best = null;
                  let node = button;
                  for (let depth = 0; node && depth < 10; depth++, node = node.parentElement) {
                    if (!visible(node)) continue;
                    const text = fold(node.innerText || node.textContent);
                    if (!text.includes('sft3')) continue;
                    if (!(text.includes('kho hưng yên 1') || text.includes('hy1'))) continue;
                    const rect = node.getBoundingClientRect();
                    const area = Math.max(1, rect.width * rect.height);
                    if (!best || area < best.area) best = { area };
                  }

                  candidates.push({
                    button,
                    area: best ? best.area : Number.MAX_VALUE,
                    matched: !!best
                  });
                }
              }

              const matched = candidates.filter(x => x.matched);
              let chosen = null;
              let reason = 'NOT_FOUND';

              if (matched.length === 1) {
                chosen = matched[0];
                reason = 'HY1_SFT3_UNIQUE';
              } else if (matched.length > 1) {
                const min = Math.min(...matched.map(x => x.area));
                const smallest = matched.filter(x => x.area <= min * 1.05);
                if (smallest.length === 1) {
                  chosen = smallest[0];
                  reason = 'HY1_SFT3_SMALLEST_CARD';
                } else {
                  reason = 'HY1_SFT3_AMBIGUOUS';
                }
              } else if (candidates.length === 1) {
                chosen = candidates[0];
                reason = 'UNIQUE_ARROW_FALLBACK';
              } else if (candidates.length > 1) {
                reason = 'ARROW_AMBIGUOUS';
              }

              if (!chosen) {
                return JSON.stringify({
                  result: 'TARGET_NOT_UNIQUE',
                  reason,
                  arrows,
                  targets: matched.length,
                  docs: docs.length
                });
              }

              chosen.button.focus({ preventScroll: true });
              chosen.button.click();

              return JSON.stringify({
                result: 'CLICKED',
                reason,
                arrows,
                targets: matched.length,
                docs: docs.length
              });
            })()";
        }

        private static string BuildReadinessScript()
        {
            return @"(() => {
              const norm = v => {
                const raw = String(v || '');
                const unicode = raw.normalize ? raw.normalize('NFC') : raw;
                return unicode.replace(/[\u200B-\u200D\uFEFF]/g,' ').replace(/\s+/g,' ').trim();
              };
              const fold = v => norm(v).toLowerCase();
              const txt = e => norm((e && (e.innerText || e.value || e.textContent)) || '');
              const names = e => !e ? [] : [
                e.innerText, e.value, e.textContent,
                e.getAttribute && e.getAttribute('aria-label'),
                e.getAttribute && e.getAttribute('title')
              ].map(norm).filter(Boolean);
              const decorationOnly = value => {
                let extra = fold(value);
                extra = extra.replace(/\b(search|magnify|magnifying|glass|find|icon)\b/g,' ');
                extra = extra.replace(/[^a-z0-9à-ỹ]+/g,'');
                return extra.length === 0;
              };
              const labelKind = (e, target) => {
                const wanted = fold(target);
                let decorated = false;
                for (const value of names(e)) {
                  const current = fold(value);
                  if (current === wanted) return 2;
                  const at = current.indexOf(wanted);
                  if (at < 0 || current.indexOf(wanted, at + wanted.length) >= 0) continue;
                  const extra = current.slice(0, at) + ' ' + current.slice(at + wanted.length);
                  if (decorationOnly(extra)) decorated = true;
                }
                return decorated ? 1 : 0;
              };
              const named = (e, target) => labelKind(e, target) > 0;
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
              const semanticSelector = 'button,input[type=button],input[type=submit],a,[role=button]';
              const semantic = d => [...d.querySelectorAll(semanticSelector)];
              const controls = docs.flatMap(semantic);
              const searchSemantic = controls.filter(e => visible(e) && named(e, 'Tìm kiếm'));
              const searchLeaf = docs.flatMap(d => [...d.querySelectorAll('body *')]).filter(e =>
                visible(e) && named(e, 'Tìm kiếm') &&
                ![...e.children].some(child => visible(child) && named(child, 'Tìm kiếm')));
              const searchSet = new Set(searchSemantic);
              for (const leaf of searchLeaf) searchSet.add(leaf.closest(semanticSelector) || leaf);
              const search = [...searchSet].filter(visible);
              const searchExact = search.filter(e => labelKind(e, 'Tìm kiếm') === 2);
              const searchDecorated = search.filter(e => labelKind(e, 'Tìm kiếm') === 1);
              const confirm = controls.filter(e => names(e).some(v => fold(v) === fold('Xác nhận lấy lại hàng')));
              const confirmVisible = confirm.filter(visible);
              const tableSurfaces = docs.flatMap(d => [...d.querySelectorAll('table,[role=grid],[role=table]')]).filter(visible);
              const rowSurfaces = docs.flatMap(d => [...d.querySelectorAll('tr,[role=row]')]).filter(visible);
              const loginMarker = docs.flatMap(d => [...d.querySelectorAll('body *')]).some(e =>
                visible(e) && fold(txt(e)) === fold('" + LoginMarkerText + @"'));
              const pageLoaded = document.readyState === 'complete';
              const navigationEntries = (performance && performance.getEntriesByType)
                ? performance.getEntriesByType('navigation') : [];
              const navigationType = navigationEntries && navigationEntries.length
                ? String(navigationEntries[navigationEntries.length - 1].type || '') : '';
              const pathOk = location.hostname === 'wms-supra.winmart.vn' && location.pathname.indexOf('" + ConfirmPath + @"') >= 0;
              const tableOk = tableSurfaces.length > 0 || rowSurfaces.length > 0;
              const ready = pathOk && tableOk && search.length === 1 && confirm.length === 1;
              let state = 'WRONG_PAGE';
              if (loginMarker) state = 'LOGIN_REQUIRED';
              else if (pathOk && !ready) state = (search.length > 0 || confirm.length > 0 || tableOk) ? 'CONFIRM_DOM_PARTIAL' : 'LOGIN_OR_DOM_NOT_READY';
              if (ready) state = 'READY';
              return JSON.stringify({
                ready,
                state,
                pageLoaded,
                loginMarker,
                navigationType,
                url: location.origin + location.pathname + location.hash,
                searchCount: search.length,
                searchExactCount: searchExact.length,
                searchDecoratedCount: searchDecorated.length,
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
              const selectable = {};
              const allCodes = [];
              for (const term of terms) { candidates[term] = []; selectable[term] = []; }
              for (const row of rows) {
                const text = ((row.innerText || row.textContent) || '').toUpperCase();
                const codes = [...new Set(text.match(/\bPL[0-9]+\b/g) || [])];
                for (const code of codes) if (!allCodes.includes(code)) allCodes.push(code);
                if (!codes.length) continue;
                const native = [...row.querySelectorAll('input[type=checkbox]')];
                const roles = native.length ? [] : [...row.querySelectorAll('[role=checkbox]')];
                const boxes = native.length ? native : roles;
                const boxReady = boxes.length === 1 &&
                  !boxes[0].disabled &&
                  boxes[0].getAttribute('aria-disabled') !== 'true';
                for (const code of codes) {
                  if (!/^PL[0-9]+$/.test(code)) continue;
                  for (const term of terms) {
                    if (!code.endsWith(term)) continue;
                    if (!candidates[term].includes(code)) candidates[term].push(code);
                    if (boxReady && !selectable[term].includes(code)) selectable[term].push(code);
                  }
                }
              }
              allCodes.sort();
              const domFingerprint = rows.length + ':' + allCodes.join(',');
              return JSON.stringify({candidates,selectable,domFingerprint,allCodeCount:allCodes.length});
            })()";
        }

        private static string BuildClickButtonScript(string text)
        {
            var escaped = JavaScriptString(text);
            return @"(() => {
              const target = '" + escaped + @"';
              const norm = v => {
                const raw = String(v || '');
                const unicode = raw.normalize ? raw.normalize('NFC') : raw;
                return unicode.replace(/[\u200B-\u200D\uFEFF]/g,' ').replace(/\s+/g,' ').trim();
              };
              const fold = v => norm(v).toLowerCase();
              const names = e => !e ? [] : [
                e.innerText, e.value, e.textContent,
                e.getAttribute && e.getAttribute('aria-label'),
                e.getAttribute && e.getAttribute('title')
              ].map(norm).filter(Boolean);
              const decorationOnly = value => {
                let extra = fold(value);
                extra = extra.replace(/\b(search|magnify|magnifying|glass|find|icon)\b/g,' ');
                extra = extra.replace(/[^a-z0-9à-ỹ]+/g,'');
                return extra.length === 0;
              };
              const named = (e, value) => names(e).some(candidate => {
                const wanted = fold(value);
                const current = fold(candidate);
                if (current === wanted) return true;
                const at = current.indexOf(wanted);
                if (at < 0 || current.indexOf(wanted, at + wanted.length) >= 0) return false;
                const extra = current.slice(0, at) + ' ' + current.slice(at + wanted.length);
                return decorationOnly(extra);
              });
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
              const semanticSelector = 'button,input[type=button],input[type=submit],a,[role=button]';
              const semantic = docs.flatMap(d => [...d.querySelectorAll(semanticSelector)])
                .filter(e => visible(e) && named(e, target));
              const leaf = docs.flatMap(d => [...d.querySelectorAll('body *')]).filter(e =>
                visible(e) && named(e, target) &&
                ![...e.children].some(child => visible(child) && named(child, target)));
              const targets = new Set(semantic);
              for (const e of leaf) targets.add(e.closest(semanticSelector) || e);
              const buttons = [...targets].filter(e =>
                visible(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true');
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

              const dialogTitle = '" + ConfirmDialogTitle + @"';
              const dialogBody = '" + ConfirmDialogBody + @"';
              const dialogConfirmText = '" + ConfirmDialogButtonText + @"';
              const dialogCloseText = '" + ConfirmDialogCloseText + @"';
              const fold = v => norm(v).toLowerCase();
              const exact = (e, value) => fold(txt(e)) === fold(value);
              const semanticButtons = root => [...root.querySelectorAll('button,input[type=button],input[type=submit],a,[role=button]')].filter(visible);
              const exactVisibleDescendants = (root, value) => {
                const nodes = [root, ...root.querySelectorAll('*')];
                return nodes.filter(e =>
                  visible(e) && exact(e, value) &&
                  ![...e.children].some(child => visible(child) && exact(child, value)));
              };
              const dialogSelector = '[role=dialog],.modal-dialog,.modal-content,.mat-dialog-container,.mat-mdc-dialog-container,.ant-modal,.swal2-popup';
              const resolveDialog = () => {
                const candidates = new Set();
                for (const d of docs) {
                  for (const node of [...d.querySelectorAll(dialogSelector)].filter(visible)) candidates.add(node);
                  const titleLeaves = [...d.querySelectorAll('body *')].filter(e =>
                    visible(e) && exact(e, dialogTitle) &&
                    ![...e.children].some(child => visible(child) && exact(child, dialogTitle)));
                  for (const title of titleLeaves) {
                    let node = title.parentElement;
                    let depth = 0;
                    while (node && depth++ < 8) {
                      if (!visible(node)) { node = node.parentElement; continue; }
                      const bodyOk = exactVisibleDescendants(node, dialogBody).length === 1;
                      const actions = semanticButtons(node);
                      const confirmCount = actions.filter(e => exact(e, dialogConfirmText)).length;
                      const closeCount = actions.filter(e => exact(e, dialogCloseText)).length;
                      if (bodyOk && confirmCount === 1 && closeCount === 1) {
                        candidates.add(node);
                        break;
                      }
                      node = node.parentElement;
                    }
                  }
                }

                let matches = [...candidates].filter(root =>
                  visible(root) &&
                  exactVisibleDescendants(root, dialogTitle).length === 1 &&
                  exactVisibleDescendants(root, dialogBody).length === 1);
                matches = matches.filter(root =>
                  !matches.some(other => other !== root && root.contains(other)));
                if (matches.length === 0) return {result:'WAIT'};
                if (matches.length !== 1) return {result:'CONFIRM_DIALOG_AMBIGUOUS', count:matches.length};

                const dialog = matches[0];
                const titleCount = exactVisibleDescendants(dialog, dialogTitle).length;
                if (titleCount !== 1) return {result:'CONFIRM_DIALOG_TITLE_MISMATCH', count:titleCount};
                const bodyCount = exactVisibleDescendants(dialog, dialogBody).length;
                if (bodyCount !== 1) return {result:'CONFIRM_DIALOG_BODY_MISMATCH', count:bodyCount};

                const actions = semanticButtons(dialog);
                const dialogConfirm = actions.filter(e => exact(e, dialogConfirmText));
                const dialogClose = actions.filter(e => exact(e, dialogCloseText));
                if (dialogConfirm.length !== 1) return {result:'CONFIRM_DIALOG_BUTTON_NOT_UNIQUE', count:dialogConfirm.length};
                if (dialogClose.length !== 1) return {result:'CONFIRM_DIALOG_CLOSE_NOT_UNIQUE', count:dialogClose.length};
                if (dialogConfirm[0].disabled || dialogConfirm[0].getAttribute('aria-disabled') === 'true')
                  return {result:'CONFIRM_DIALOG_BUTTON_DISABLED'};
                return {result:'READY', button:dialogConfirm[0]};
              };

              const dialogDeadline = Date.now() + 2500;
              let dialogState = {result:'WAIT'};
              do {
                dialogState = resolveDialog();
                if (dialogState.result !== 'WAIT') break;
                await new Promise(r => setTimeout(r, 80));
              } while (Date.now() < dialogDeadline);

              if (dialogState.result === 'WAIT') return JSON.stringify({result:'CONFIRM_DIALOG_NOT_FOUND'});
              if (dialogState.result !== 'READY') return JSON.stringify({result:dialogState.result, count:dialogState.count || 0});
              dialogState.button.click();
              return JSON.stringify({result:'CLICKED', stage:'DIALOG_CONFIRMED'});
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
            return WaitForPageTarget(port, timeout, false);
        }

        private static string WaitForPageTarget(int port, TimeSpan timeout, bool requireWms)
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
                                Uri pageUri;
                                if (Uri.TryCreate(url, UriKind.Absolute, out pageUri) &&
                                    string.Equals(pageUri.Scheme, "https", StringComparison.OrdinalIgnoreCase) &&
                                    string.Equals(pageUri.Host, WmsHost, StringComparison.OrdinalIgnoreCase))
                                    return ws;
                            }
                            if (!requireWms && !string.IsNullOrWhiteSpace(fallback)) return fallback;
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
                StopManagedBrowserNoLock();
            }
        }

        private void ThrowIfDisposed()
        {
            if (_disposed) throw new ObjectDisposedException(nameof(SupraConfirmBrowser));
        }

        private const uint Th32csSnapProcess = 0x00000002;
        private static readonly IntPtr InvalidHandleValue = new IntPtr(-1);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct ProcessEntry32
        {
            internal uint dwSize;
            internal uint cntUsage;
            internal uint th32ProcessID;
            internal IntPtr th32DefaultHeapID;
            internal uint th32ModuleID;
            internal uint cntThreads;
            internal uint th32ParentProcessID;
            internal int pcPriClassBase;
            internal uint dwFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
            internal string szExeFile;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern bool Process32First(IntPtr hSnapshot, ref ProcessEntry32 lppe);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern bool Process32Next(IntPtr hSnapshot, ref ProcessEntry32 lppe);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr hObject);

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
