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
                // When a standby exists, preserve this request as PENDING so
                // a genuine generation-fenced takeover can recover it. Never
                // ACK an irreversible "not ready" result while failover is
                // still possible, and never claim a WMS business success.
                var standbyMayRecover = _leaderCoordinator != null &&
                    _leaderCoordinator.OnlineAgents.Any(item => item != null &&
                        item.WmsReady &&
                        (string.Equals(item.AgentInstanceId,
                            _leaderCoordinator.CurrentStandbyId, StringComparison.Ordinal) ||
                         string.Equals(item.AgentInstanceId,
                            _leaderCoordinator.CurrentNextBId, StringComparison.Ordinal)));
                foreach (var work in works.Where(work => !outcomes.ContainsKey(work.RequestId)))
                {
                    var outcome = D160Outcome(
                        work, D173E140IsWebLoginRequired() ? "WMS_LOGIN_REQUIRED" : "WMS_SESSION_REQUIRED",
                        "WEB_CONFIRM_NOT_READY", "BROWSER_DOM", "", 0L, 0);
                    outcome.ShouldAck = !standbyMayRecover;
                    outcomes[work.RequestId] = outcome;
                }
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

                    if (exactStillSame && !selectable && recovered != null &&
                        recovered.AlreadyConfirmedFragments.Contains(work.Suffix ?? ""))
                    {
                        outcomes[work.RequestId] = D160Outcome(work,
                            "ALREADY_CONFIRMED", "BROWSER_DOM+SAME_ROW_RECLAIM_ACTION",
                            "BROWSER_DOM", item.Code, recovered.ElapsedMs, 1);
                        continue;
                    }
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
                    // E140: exactly one matching row, unavailable checkbox.
                    // The reclaim action on that SAME row is positive proof of
                    // prior confirmation; otherwise the PickList is not ready.
                    outcomes[work.RequestId] = D160Outcome(
                        work,
                        search.AlreadyConfirmedFragments.Contains(work.Suffix ?? "")
                            ? "ALREADY_CONFIRMED" : "PICKLIST_NOT_READY",
                        "BROWSER_DOM+E140_EXACT_SAME_ROW_CHECKBOX",
                        "BROWSER_DOM", code, search.ElapsedMs, 1);
                    continue;
                }

                ready.Add(new D160ReadyTarget { Work = work, Code = code });
            }
        }


        // E140 Owner-approved trial: each new Picker request is independently
        // evaluated from WMS. Do not read/write the old full-PickList guard.
        // A request ID is still processed/ACKed only once by the transport.
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
                var target = new D160MutationTarget { Code = group.Key };
                target.Works.AddRange(works);
                targets.Add(target);
            }
            if (targets.Count == 0) return 0;

            // Keep PRIMARY role+generation fencing even though business duplicate
            // guarding is disabled. A stale Agent must never write to WMS.
            var fenceOk = false;
            try
            {
                fenceOk = _leaderCoordinator != null &&
                    _leaderCoordinator.VerifyPrimaryBeforeMutation(session);
            }
            catch (Exception ex)
            {
                Log("D173_E140 primary_mutation_fence failure=" + ex.GetType().Name);
            }
            if (!fenceOk)
            {
                foreach (var target in targets)
                    foreach (var work in target.Works)
                    {
                        var blocked = D160Outcome(
                            work, "WMS_SESSION_REQUIRED", "PRIMARY_GENERATION_CHANGED",
                            "ROLE_GENERATION_FENCE", target.Code, searchMs, 1);
                        blocked.ShouldAck = false;
                        outcomes[work.RequestId] = blocked;
                    }
                return 0;
            }

            SupraBrowserBulkConfirmResult browser;
            try
            {
                var maxRequestAgeMs = targets.SelectMany(t => t.Works)
                    .Select(D160RequestAgeMs).DefaultIfEmpty(0L).Max();
                var verifiedRecovery = targets.Any(t => t.Works.Any(w => w.RecoveryAuthorized));
                var ackBudgetLimitMs = verifiedRecovery ? 34000L : 17500L;
                var terminalWaitMs = (int)Math.Max(800L,
                    Math.Min(5200L, ackBudgetLimitMs - maxRequestAgeMs - 4500L));
                Log("D173_E140 NO_PERSISTENT_GUARD wave=" + wave +
                    " requests=" + targets.Sum(t => t.Works.Count) +
                    " unique_targets=" + targets.Count +
                    " wait_ms=" + terminalWaitMs +
                    " max_request_age_ms=" + maxRequestAgeMs);
                browser = _supraBrowser.ConfirmManyExact(
                    targets.Select(t => t.Code), terminalWaitMs,
                    maxRequestAgeMs < 6000L);
            }
            catch (Exception ex)
            {
                browser = new SupraBrowserBulkConfirmResult
                {
                    Result = "WMS_CONFIRM_RESPONSE_MISSING",
                    Detail = "BROWSER_EXCEPTION_" + ex.GetType().Name
                };
                Log("D173_E140 WMS_CONFIRM exception=" + ex.GetType().Name +
                    " click_stage=UNVERIFIED");
            }

            // E093 verify-only: when the final click is proven and the response
            // is absent, inspect one exact fresh row for the reclaim action.
            // This never sends a second business click.
            if (browser.FinalClicked && targets.Count == 1 &&
                string.Equals(browser.Result, "WMS_CONFIRM_RESPONSE_MISSING",
                    StringComparison.Ordinal))
            {
                var sole = targets[0];
                var suffix = sole.Works.Count > 0 ? sole.Works[0].Suffix : "";
                if (_supraBrowser.VerifyExactAlreadyConfirmedReadOnly(sole.Code, suffix))
                {
                    browser.Result = "ALREADY_CONFIRMED";
                    browser.Detail = "E140_EXACT_SAME_ROW_RECLAIM_PROOF";
                }
            }

            foreach (var target in targets)
            {
                foreach (var work in target.Works)
                {
                    var outcome = D160Outcome(
                        work,
                        !browser.FinalClicked &&
                            string.Equals(browser.Result, "CONFIRM_REJECTED", StringComparison.Ordinal)
                            ? "WMS_CONFIRM_ACTION_UNAVAILABLE" :
                            (browser.Result ?? "WMS_CONFIRM_RESPONSE_MISSING"),
                        "BROWSER_DOM+E140_NO_PERSISTENT_GUARD+D160_BULK_" + wave +
                        (browser.RecoveryReloaded ? "+UI_RECOVERY_RELOAD" : "") +
                        (browser.FinalClicked ? "+FINAL_CLICK" : "+PRE_FINAL"),
                        "BROWSER_DOM",
                        target.Code,
                        Math.Max(0L, searchMs) + Math.Max(0L, browser.ElapsedMs),
                        1);
                    outcomes[work.RequestId] = outcome;
                }
            }
            AgentDiagnostics.WriteAudit(
                "D173_E140_CONFIRM no_guard=1 wave=" + wave +
                " request_count=" + targets.Sum(t => t.Works.Count) +
                " unique_picklists=" + targets.Count +
                " result=" + (browser.Result ?? "WMS_CONFIRM_RESPONSE_MISSING") +
                " detail=" + (browser.Detail ?? "") +
                " final_clicked=" + (browser.FinalClicked ? "1" : "0") +
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
            // D171: Firestore Rules bind created_at to request.time; client clock is diagnostic only.
            // Preserve existing twelve-second and recovery mutation fences.
            if (work.CreatedAtMs <= 0) return long.MaxValue;
            return Math.Max(0L, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - work.CreatedAtMs);
        }

        private static bool D160CanStartMutation(FirestoreConfirmationWorkItem work)
        {
            return D160RequestAgeMs(work) < (work != null && work.RecoveryAuthorized ? 29000L : 12000L);
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
                RecordD158ConfirmOutcome(string.Equals(outcome.Result, "CONFIRMED", StringComparison.Ordinal) ||
                    string.Equals(outcome.Result, "ALREADY_CONFIRMED", StringComparison.Ordinal));
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
