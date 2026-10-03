using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private sealed class D160ReadyTarget
        {
            internal FirestoreConfirmationWorkItem Work;
            internal string Code = "";
        }

        private sealed class D160MutationTarget
        {
            internal string Code = "";
            internal FirestoreConfirmationGuardDecision Guard;
            internal readonly List<FirestoreConfirmationWorkItem> Works = new List<FirestoreConfirmationWorkItem>();
        }

        private Dictionary<string, FirestoreConfirmationOutcome> ProcessFirestoreConfirmationsD160(
            List<FirestoreConfirmationWorkItem> input,
            Action<string, FirestoreConfirmationOutcome> terminalCallback)
        {
            var outcomes = new Dictionary<string, FirestoreConfirmationOutcome>(StringComparer.Ordinal);
            if (input == null || input.Count == 0) return outcomes;

            var works = input
                .Where(work => work != null && !string.IsNullOrWhiteSpace(work.RequestId))
                .GroupBy(work => work.RequestId, StringComparer.Ordinal)
                .Select(group => group.First())
                .Take(FirestoreConfirmationTransport.MaxConcurrentJobs)
                .ToList();
            if (works.Count == 0) return outcomes;
            var diagnosticBatchStarted = Stopwatch.StartNew();

            foreach (var work in works)
            {
                EnrichD160WorkFromPickerMemory(work);
                RecordD160PickerHistoryRequest(work);
            }

            var appSession = SnapshotSession();
            foreach (var work in works)
            {
                var rate = _firestoreRateLimiter.Check(appSession, work.PickerUid, work.PickerUserId);
                if (!rate.IsLocked) continue;
                outcomes[work.RequestId] = new FirestoreConfirmationOutcome
                {
                    Result = "PICKER_LOCKED",
                    CacheMode = "RATE_LIMIT",
                    Route = "NONE",
                    Rate = rate,
                    PickerContractorName = work.PickerContractorName ?? ""
                };
            }

            if (!HasReadyConfirmBrowser())
            {
                foreach (var work in works.Where(work => !outcomes.ContainsKey(work.RequestId)))
                    outcomes[work.RequestId] = D160Outcome(
                        work, "WMS_SESSION_REQUIRED", "WEB_CONFIRM_NOT_READY", "BROWSER_DOM", "", 0L, 0);
                FinalizeD160Outcomes(works, outcomes, 0, null);
                EmitD160TerminalOutcomes(outcomes, terminalCallback, null);
                return outcomes;
            }

            var eligible = works.Where(work => !outcomes.ContainsKey(work.RequestId)).ToList();
            var maxAgeAtBrowserGate = works.Select(D160RequestAgeMs).DefaultIfEmpty(0L).Max();
            Log("D160_DIAG QUEUE phase=BROWSER_GATE jobs=" + works.Count +
                " eligible=" + eligible.Count +
                " max_request_age_ms=" + maxAgeAtBrowserGate +
                " handler_pre_search_ms=" + diagnosticBatchStarted.ElapsedMilliseconds);
            SupraBrowserSearchResult search;
            try
            {
                search = eligible.Count == 0
                    ? new SupraBrowserSearchResult { Result = "NOT_FOUND" }
                    : _supraBrowser.SearchMany(eligible.Select(work => work.Suffix), true, false, false);
                if (eligible.Count > 0) MarkD157WmsProof();
            }
            catch (Exception ex)
            {
                foreach (var work in eligible)
                    outcomes[work.RequestId] = D160Outcome(
                        work, "LOOKUP_ERROR", "BROWSER_DOM_ERROR", "BROWSER_DOM", "", 0L, 0);
                Log("D160 FIRESTORE browser fast-search fail type=" + ex.GetType().Name);
                FinalizeD160Outcomes(works, outcomes, 0, null);
                EmitD160TerminalOutcomes(outcomes, terminalCallback, null);
                return outcomes;
            }

            var ready = new List<D160ReadyTarget>();
            var deferred = new List<D160ReadyTarget>();
            D160ClassifyFastSearch(appSession, eligible, search, outcomes, ready, deferred);
            var maxAgeAtClassify = works.Select(D160RequestAgeMs).DefaultIfEmpty(0L).Max();
            Log("D160_DIAG BATCH phase=CLASSIFIED jobs=" + works.Count +
                " eligible=" + eligible.Count +
                " ready=" + ready.Count +
                " deferred=" + deferred.Count +
                " immediate_outcomes=" + outcomes.Count +
                " max_request_age_ms=" + maxAgeAtClassify +
                " search_ms=" + Math.Max(0L, search.ElapsedMs) +
                " page_epoch=" + D160DiagnosticTelemetry.PageEpoch +
                " page_dirty=" + D160DiagnosticTelemetry.Flag(D160DiagnosticTelemetry.DirtyAfterConfirm));

            var mutationWaves = 0;
            if (ready.Count > 0)
                mutationWaves += D160MutateReady(appSession, ready, search.ElapsedMs, outcomes, "FAST");

            // READY / true NOT_FOUND / ambiguous / rate-limited outcomes are terminal
            // independently. Persist/ACK them before any slow checkbox recovery starts.
            var deferredRequestIds = new HashSet<string>(
                deferred.Select(item => item.Work == null ? "" : (item.Work.RequestId ?? ""))
                    .Where(value => !string.IsNullOrWhiteSpace(value)),
                StringComparer.Ordinal);
            EmitD160TerminalOutcomes(outcomes, terminalCallback, deferredRequestIds);

            // Recovery is deliberately second. A slow/unselectable PickList never delays
            // selection/mutation of the READY subset. One shared SearchMany recovery may
            // issue the existing real Page.reload; there is no per-request reload loop.
            if (deferred.Count > 0 && D160HasRecoveryBudget(deferred.Select(item => item.Work)))
            {
                SupraBrowserSearchResult recovered = null;
                try
                {
                    recovered = _supraBrowser.SearchMany(
                        deferred.Select(item => item.Work.Suffix), true, true, true);
                    MarkD157WmsProof();
                }
                catch (Exception ex)
                {
                    Log("D160 FIRESTORE checkbox recovery fail type=" + ex.GetType().Name);
                }

                var recoveredReady = new List<D160ReadyTarget>();
                foreach (var item in deferred)
                {
                    var work = item.Work;
                    List<string> candidates = null;
                    if (recovered != null)
                        recovered.Candidates.TryGetValue(work.Suffix ?? "", out candidates);
                    candidates = candidates ?? new List<string>();

                    var exactStillSame = candidates.Count == 1 &&
                        string.Equals(candidates[0], item.Code, StringComparison.OrdinalIgnoreCase);
                    var selectable = recovered != null &&
                        !recovered.UnselectableFragments.Exists(x =>
                            string.Equals(x, work.Suffix ?? "", StringComparison.Ordinal)) &&
                        !recovered.StateChangedFragments.Exists(x =>
                            string.Equals(x, work.Suffix ?? "", StringComparison.Ordinal));

                    if (exactStillSame && selectable && D160CanStartMutation(work))
                    {
                        recoveredReady.Add(new D160ReadyTarget { Work = work, Code = item.Code });
                        continue;
                    }

                    outcomes[work.RequestId] = D160Outcome(
                        work,
                        D160CanStartMutation(work) ? "CONFIRM_CONFLICT" : "REQUEST_EXPIRED",
                        "BROWSER_DOM+RECOVERY+CHECKBOX_NOT_READY",
                        "BROWSER_DOM",
                        exactStillSame ? item.Code : "",
                        recovered == null ? 0L : recovered.ElapsedMs,
                        candidates.Count);
                }

                if (recoveredReady.Count > 0)
                    mutationWaves += D160MutateReady(
                        appSession,
                        recoveredReady,
                        recovered == null ? 0L : recovered.ElapsedMs,
                        outcomes,
                        "RECOVERY");
            }
            else
            {
                foreach (var item in deferred)
                    if (!outcomes.ContainsKey(item.Work.RequestId))
                        outcomes[item.Work.RequestId] = D160Outcome(
                            item.Work,
                            "CONFIRM_CONFLICT",
                            "BROWSER_DOM+RECOVERY_BUDGET_EXHAUSTED",
                            "BROWSER_DOM",
                            item.Code,
                            search.ElapsedMs,
                            1);
            }

            FinalizeD160Outcomes(works, outcomes, mutationWaves, search);
            EmitD160TerminalOutcomes(outcomes, terminalCallback, null);
            var diagnosticSummary = string.Join(",", outcomes.Values
                .Where(value => value != null)
                .GroupBy(value => value.Result ?? "UNKNOWN", StringComparer.Ordinal)
                .OrderBy(group => group.Key, StringComparer.Ordinal)
                .Select(group => D160DiagnosticTelemetry.SafeReason(group.Key) + ":" + group.Count())
                .ToArray());
            Log("D160_DIAG BATCH phase=END jobs=" + works.Count +
                " mutation_waves=" + mutationWaves +
                " outcomes=" + outcomes.Count +
                " result_counts=" + (diagnosticSummary.Length == 0 ? "none" : diagnosticSummary) +
                " elapsed_ms=" + diagnosticBatchStarted.ElapsedMilliseconds +
                " page_epoch=" + D160DiagnosticTelemetry.PageEpoch +
                " page_dirty=" + D160DiagnosticTelemetry.Flag(D160DiagnosticTelemetry.DirtyAfterConfirm));
            return outcomes;
        }

        private static void EmitD160TerminalOutcomes(
            Dictionary<string, FirestoreConfirmationOutcome> outcomes,
            Action<string, FirestoreConfirmationOutcome> terminalCallback,
            HashSet<string> skipRequestIds)
        {
            if (terminalCallback == null || outcomes == null) return;
            foreach (var pair in outcomes)
            {
                if (skipRequestIds != null && skipRequestIds.Contains(pair.Key)) continue;
                var outcome = pair.Value;
                if (outcome == null || !outcome.ShouldAck) continue;
                terminalCallback(pair.Key, outcome);
            }
        }

        private void D160ClassifyFastSearch(
            AgentSession session,
            List<FirestoreConfirmationWorkItem> eligible,
            SupraBrowserSearchResult search,
            Dictionary<string, FirestoreConfirmationOutcome> outcomes,
            List<D160ReadyTarget> ready,
            List<D160ReadyTarget> deferred)
        {
            foreach (var work in eligible)
            {
                List<string> candidates;
                if (!search.Candidates.TryGetValue(work.Suffix ?? "", out candidates))
                    candidates = new List<string>();

                if (search.StateChangedFragments.Exists(x =>
                    string.Equals(x, work.Suffix ?? "", StringComparison.Ordinal)))
                {
                    outcomes[work.RequestId] = D160Outcome(
                        work, "CONFIRM_CONFLICT", "BROWSER_DOM+STATE_CHANGED", "BROWSER_DOM",
                        candidates.Count == 1 ? candidates[0] : "", search.ElapsedMs, candidates.Count);
                    continue;
                }

                if (candidates.Count == 0)
                {
                    // D160: an entirely empty/unhydrated WMS table is a technical
                    // availability condition. It must not create a Picker strike.
                    if (search.PicklistCodeCount == 0)
                    {
                        outcomes[work.RequestId] = D160Outcome(
                            work, "WMS_DATA_UNAVAILABLE", "BROWSER_DOM+ZERO_TABLE", "BROWSER_DOM",
                            "", search.ElapsedMs, 0);
                        continue;
                    }

                    var rate = _firestoreRateLimiter.RecordNotFound(
                        session, work.PickerUid, work.PickerUserId, work.RequestId);
                    var miss = D160Outcome(
                        work,
                        rate.IsLocked ? "PICKER_LOCKED" : "NOT_FOUND",
                        "BROWSER_DOM" + (search.SearchClicked ? "+SEARCH_CLICK" : ""),
                        "BROWSER_DOM",
                        "",
                        search.ElapsedMs,
                        0);
                    miss.Rate = rate;
                    outcomes[work.RequestId] = miss;
                    continue;
                }

                if (candidates.Count != 1)
                {
                    var ambiguous = D160Outcome(
                        work, "AMBIGUOUS_PICKLIST", "BROWSER_DOM", "BROWSER_DOM",
                        "", search.ElapsedMs, candidates.Count);
                    ambiguous.Candidates.AddRange(candidates);
                    outcomes[work.RequestId] = ambiguous;
                    continue;
                }

                var code = candidates[0];
                _firestoreRateLimiter.ClearFound(session, work.PickerUid);
                if (!D160CanStartMutation(work))
                {
                    outcomes[work.RequestId] = D160Outcome(
                        work, "REQUEST_EXPIRED", "BROWSER_DOM+D160_12S_MUTATION_FENCE",
                        "BROWSER_DOM", code, search.ElapsedMs, 1);
                    continue;
                }

                if (search.UnselectableFragments.Exists(x =>
                    string.Equals(x, work.Suffix ?? "", StringComparison.Ordinal)))
                {
                    deferred.Add(new D160ReadyTarget { Work = work, Code = code });
                    continue;
                }

                ready.Add(new D160ReadyTarget { Work = work, Code = code });
            }
        }

        private int D160MutateReady(
            AgentSession session,
            List<D160ReadyTarget> ready,
            long searchMs,
            Dictionary<string, FirestoreConfirmationOutcome> outcomes,
            string wave)
        {
            var targets = new List<D160MutationTarget>();
            foreach (var group in ready
                .Where(item => item != null && item.Work != null && !string.IsNullOrWhiteSpace(item.Code))
                .GroupBy(item => item.Code, StringComparer.OrdinalIgnoreCase))
            {
                var works = group.Select(item => item.Work).ToList();
                if (works.Any(work => !D160CanStartMutation(work)))
                {
                    foreach (var work in works)
                        outcomes[work.RequestId] = D160Outcome(
                            work, "REQUEST_EXPIRED", "D160_12S_MUTATION_FENCE",
                            "BROWSER_DOM", group.Key, searchMs, 1);
                    continue;
                }

                var representative = works[0];
                var guard = _confirmationGuard.TryBegin(
                    session, group.Key, representative.RequestId, _agentInstanceId, representative.PickerUid);

                if (guard.AlreadyConfirmed)
                {
                    foreach (var work in works)
                    {
                        var done = D160Outcome(
                            work, "CONFIRMED", "BROWSER_DOM+IDEMPOTENT",
                            "FIRESTORE_CONFIRM_GUARD", group.Key, searchMs, 1);
                        done.Http = 200;
                        done.GuardId = guard.GuardId;
                        done.RetireAtMs = guard.RetireAtMs;
                        outcomes[work.RequestId] = done;
                    }
                    continue;
                }

                if (!guard.Acquired || guard.InProgressOrUncertain)
                {
                    foreach (var work in works)
                    {
                        var uncertain = D160Outcome(
                            work, "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                            "BROWSER_DOM+GUARD+D160_NO_ROW_INFERENCE",
                            "FIRESTORE_CONFIRM_GUARD", group.Key, searchMs, 1);
                        uncertain.Http = 409;
                        uncertain.GuardId = guard.GuardId;
                        uncertain.RetireAtMs = guard.RetireAtMs;
                        outcomes[work.RequestId] = uncertain;
                    }
                    continue;
                }

                var target = new D160MutationTarget { Code = group.Key, Guard = guard };
                target.Works.AddRange(works);
                targets.Add(target);
            }

            if (targets.Count == 0) return 0;

            var fenceOk = false;
            try
            {
                fenceOk = _leaderCoordinator != null &&
                          _leaderCoordinator.VerifyPrimaryBeforeMutation(session);
            }
            catch (Exception ex)
            {
                Log("D160 FIRESTORE generation fence error type=" + ex.GetType().Name);
            }

            if (!fenceOk)
            {
                foreach (var target in targets)
                {
                    _confirmationGuard.ReleaseSafeFailure(session, target.Guard.GuardId);
                    foreach (var work in target.Works)
                    {
                        var blocked = D160Outcome(
                            work, "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                            "BROWSER_DOM+ROLE_GENERATION_FENCE",
                            "ROLE_GENERATION_FENCE", target.Code, searchMs, 1);
                        blocked.GuardId = target.Guard.GuardId;
                        blocked.RetireAtMs = target.Guard.RetireAtMs;
                        blocked.ShouldAck = false;
                        outcomes[work.RequestId] = blocked;
                    }
                }
                return 0;
            }

            SupraBrowserBulkConfirmResult browser;
            try
            {
                var maxRequestAgeMs = targets
                    .SelectMany(target => target.Works)
                    .Select(D160RequestAgeMs)
                    .DefaultIfEmpty(0L)
                    .Max();
                var terminalWaitMs = (int)Math.Max(
                    800L,
                    Math.Min(5200L, 17500L - maxRequestAgeMs - 4500L));
                var allowPreFinalRecovery = maxRequestAgeMs < 6000L;
                Log("D160_DIAG MUTATION_BUDGET wave=" + wave +
                    " max_request_age_ms=" + maxRequestAgeMs +
                    " terminal_wait_ms=" + terminalWaitMs +
                    " allow_pre_final_recovery=" + D160DiagnosticTelemetry.Flag(allowPreFinalRecovery) +
                    " mutation_fence_ms=12000");
                browser = _supraBrowser.ConfirmManyExact(
                    targets.Select(target => target.Code),
                    terminalWaitMs,
                    allowPreFinalRecovery);
            }
            catch (Exception ex)
            {
                browser = new SupraBrowserBulkConfirmResult
                {
                    Result = "CONFIRM_IN_PROGRESS_OR_UNCERTAIN",
                    Detail = "BULK_EXCEPTION_" + ex.GetType().Name,
                    FinalClicked = true
                };
                Log("D160 FIRESTORE bulk confirm uncertain type=" + ex.GetType().Name);
            }

            var confirmed = string.Equals(browser.Result, "CONFIRMED", StringComparison.Ordinal);
            // D160 fail-closed: after the final WMS dialog click, even a fresh error
            // surface does not prove that a multi-row provider mutation had zero partial
            // success. Never release a post-click guard; only failures before the final
            // business click are safe to retry.
            var safeFailure = !browser.FinalClicked;

            foreach (var target in targets)
            {
                if (confirmed)
                    _confirmationGuard.MarkLocalConfirmed(target.Guard.GuardId);
                else if (safeFailure)
                    _confirmationGuard.ReleaseSafeFailure(session, target.Guard.GuardId);

                foreach (var work in target.Works)
                {
                    var outcome = D160Outcome(
                        work,
                        !browser.FinalClicked &&
                        string.Equals(browser.Result, "CONFIRM_REJECTED", StringComparison.Ordinal)
                            ? "CONFIRM_CONFLICT"
                            : (browser.Result ?? "CONFIRM_ERROR"),
                        "BROWSER_DOM+GUARD+D160_BULK_" + wave +
                        (browser.RecoveryReloaded ? "+UI_RECOVERY_RELOAD" : "") +
                        (browser.FinalClicked ? "+FINAL_CLICK" : "+PRE_FINAL"),
                        "BROWSER_DOM",
                        target.Code,
                        Math.Max(0L, searchMs) + Math.Max(0L, browser.ElapsedMs),
                        1);
                    outcome.GuardId = target.Guard.GuardId;
                    outcome.RetireAtMs = target.Guard.RetireAtMs;
                    outcomes[work.RequestId] = outcome;
                }
            }

            AgentDiagnostics.WriteAudit(
                "D160_BULK_CONFIRM wave=" + wave +
                " request_count=" + targets.Sum(target => target.Works.Count) +
                " unique_picklists=" + targets.Count +
                " result=" + (browser.Result ?? "CONFIRM_ERROR") +
                " detail=" + (browser.Detail ?? "") +
                " final_click=" + (browser.FinalClicked ? "1" : "0") +
                " recovery_reload=" + (browser.RecoveryReloaded ? "1" : "0"));
            return 1;
        }

        private FirestoreConfirmationOutcome D160Outcome(
            FirestoreConfirmationWorkItem work,
            string result,
            string cacheMode,
            string route,
            string fullCode,
            long operationMs,
            int matches)
        {
            return new FirestoreConfirmationOutcome
            {
                Result = result ?? "CONFIRM_ERROR",
                CacheMode = cacheMode ?? "NONE",
                Route = route ?? "NONE",
                OperationMs = Math.Max(0L, operationMs),
                Matches = Math.Max(0, matches),
                Rate = new PickerRateDecision(),
                ResolvedPickListCode = fullCode ?? "",
                PickerContractorName = work == null ? "" : (work.PickerContractorName ?? "")
            };
        }

        private static long D160RequestAgeMs(FirestoreConfirmationWorkItem work)
        {
            if (work == null) return long.MaxValue;
            var sent = work.ClientSentAtMs > 0 ? work.ClientSentAtMs : work.CreatedAtMs;
            if (sent <= 0) return long.MaxValue;
            return Math.Max(0L, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - sent);
        }

        private static bool D160CanStartMutation(FirestoreConfirmationWorkItem work)
        {
            return D160RequestAgeMs(work) < 12000L;
        }

        private static bool D160HasRecoveryBudget(IEnumerable<FirestoreConfirmationWorkItem> works)
        {
            var maxAge = (works ?? new FirestoreConfirmationWorkItem[0])
                .Select(D160RequestAgeMs)
                .DefaultIfEmpty(long.MaxValue)
                .Max();
            // Recovery may include a real top-level reload. Do not start it late enough
            // to consume the ACK reserve near the 20-second PDA hard bound.
            return maxAge < 6500L;
        }

        private void FinalizeD160Outcomes(
            List<FirestoreConfirmationWorkItem> works,
            Dictionary<string, FirestoreConfirmationOutcome> outcomes,
            int mutationWaves,
            SupraBrowserSearchResult search)
        {
            foreach (var work in works)
            {
                FirestoreConfirmationOutcome outcome;
                if (!outcomes.TryGetValue(work.RequestId, out outcome) || outcome == null)
                {
                    outcome = D160Outcome(
                        work, "CONFIRM_ERROR", "D160_NO_OUTCOME", "BROWSER_DOM", "", 0L, 0);
                    outcomes[work.RequestId] = outcome;
                }

                RecordD160PickerHistoryOutcome(work, outcome);
                RecordD158ConfirmOutcome(string.Equals(outcome.Result, "CONFIRMED", StringComparison.Ordinal));
            }

            Ui(() => RefreshAgentRequestMetrics());
            AgentDiagnostics.WriteAudit(
                "PDA_CONFIRM_BATCH_D160 jobs=" + works.Count +
                " mutation_waves=" + mutationWaves +
                " max_batch=" + FirestoreConfirmationTransport.MaxConcurrentJobs +
                " search_click=" + (search != null && search.SearchClicked ? "1" : "0") +
                " recovery_reload=" + (search != null && search.RecoveryReloaded ? "1" : "0") +
                " row_disappearance_evidence=false fresh_terminal_surface=true");
        }

        private void EnrichD160WorkFromPickerMemory(FirestoreConfirmationWorkItem work)
        {
            if (work == null || !string.IsNullOrWhiteSpace(work.PickerContractorName)) return;
            try
            {
                Func<string> read = () =>
                {
                    var picker = _pickerOnlineSnapshot.FirstOrDefault(item =>
                        item != null &&
                        string.Equals(item.UserId, work.PickerUserId ?? "", StringComparison.Ordinal));
                    if (picker == null && _agentSyncSnapshot != null)
                    {
                        picker = _agentSyncSnapshot.Pickers.FirstOrDefault(item =>
                            item != null &&
                            string.Equals(item.UserId, work.PickerUserId ?? "", StringComparison.Ordinal));
                    }
                    return picker == null ? "" : (picker.ContractorName ?? "");
                };
                work.PickerContractorName = InvokeRequired
                    ? Convert.ToString(Invoke(read))
                    : read();
            }
            catch { work.PickerContractorName = ""; }
        }
    }
}
