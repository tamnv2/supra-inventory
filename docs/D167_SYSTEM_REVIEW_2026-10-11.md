# D167 — Repo-first whole-system reconciliation & Usage optimization review

**Review date:** 2026-10-11 (VN). **Authority:** current `main` after PR #550/#551, `ops/project-state.json`, `docs/D167_BACKLOG.md`, `docs/OWNER_DECISIONS.md`, `docs/D166_USAGE_AUDIT_2026-10-06_08.md`, source paths below. **Purpose:** evidence-backed analysis and proposed next actions. No new runtime/code implementation or D167 Owner PASS authorized by this document.

## 1. Authoritative release boundary

- Last Owner-accepted release base: **D166 LIMITED PASS** (no newly reported deployment errors only).
- **D167 technical Beta release:** PR #550 merge `9bcff631fed9c3bde6f164b223da94968e0e700a`; integration checks 20/20; main 15/15. Existing Worker/Web/DO deploy #38088441632 PASS, Apps Script Gateway #38088441588 PASS; signed Android **beta-vc105** #38088441571 and Agent **relay-agent-v125** #38088441614 release/channel PASS. Receipt PR #551.
- **No evidence** of device fleet actually installed at vc105/v125, version floor 105, complete field result, billed usage reduction or Owner D167 PASS. **Stable remains OWNER-GATED.**
- `experiments/d167-sku-sync-test/*` source was included in PR #550, but it is **not** the standard Agent/OTA; Owner screenshot demonstrates limited standalone one-click Beta SKU+name test (2,492 distinct; 5 new; 2,487 unchanged; 3/3 preview/apply; 3 sampled readbacks), not daily unattended primary-Agent SKU sync, complete readback or any location import.
- Older headings in backlog/specs that say A–F PROPOSAL ONLY or D167 NO DEPLOY are historical checkpoints; **PR #550/#551 supersede them for source/technical Beta deployment status**, NOT for field PASS or unresolved business rules.

Evidence confidence meanings: **CODE PROVEN** = actual source path + merged source; **RELEASE PROVEN** = CI/deploy/channel receipt, not installed; **FIELD REPORTED** = app screenshot/log, not independent database reconciliation; **BILLING PENDING** = provider-authoritative comparable measurements absent.

## 2. Classification of 15 inherited D167 groups

| ID | Item | Code/release class | Remaining blocker / evidence | Recommended next path |
| --- | --- | --- | --- | --- |
| USAGE-ROOT-CAUSE | Firestore read/write and Worker/DO SQL cost | D166/D167 diagnostics DEPLOYED; optimization NOT PROVEN | Provider billed-per-hour + matched workload + precise attribution; DO 15 SQL cursor samples are process-local not billed totals | P0 measure then reduce proven highest-waste hot path |
| CROSS-METER-OPTIMIZATION | Real redistribution across lower-utilized meter/provider | POLICY/ANALYSIS ONLY, no executable change | Equivalent business authority, free-tier/cost/security/performance evidence | Compare no-change/direct-fix/cross-meter alternatives; no literal quota transfer |
| HA-LEADER | PRIMARY takeover/failover, RTDB SSE, stale Firestore lease | Safety changes & local HA diagnostics RELEASED in Agent v125/Service | Multi-Agent takeover, 403/stream error reason, generation fence and real WMS/ACK timelines | P0 field HA regression; optimize only after lease/path breakdown |
| ACK-CONFIRM-LATENCY | Android 404 retry storm, Activity BadToken and confirm speed | Fix RELEASED signed vc105; field unverified | Real account-switch + 404 quarantine, 408/409 retry, crash-free dialog and p50/p95/p99 confirm | P0 MT90/DT50 targeted retest, no premature success claim |
| USAGE-ZIP-EVIDENCE | Agent on-demand ZIP/time bucket/NO_DATA | v125/Gateway/DO manual snapshot RELEASED | Physical ZIP coverage, source age, N/A vs 0, real billing comparison | P0 export after activity; one explicit Owner click, no background poll |
| DRIVE-LOG-CANONICAL | One canonical VN-day folder across Web/Android/Agent | Earlier D166 archive changes RELEASED; field-only pending | 2-OAuth identities, idempotency, actual Drive confirmation before local prune, old duplicate folders | P1 multi-device correlation and Drive readback; no destructive dedup without approval |
| LAUNCHER-LOG-SERVICE | Launcher upload via Inventory Beta backend | Inventory-side investigation/evidence only, no D167 Launcher APK mutation | Actual Launcher request, service buffer, Drive receipt, local timestamps | P1 capture matched sample, separate repo changes require own scope/approval |
| OTA-FLEET | Android/Agent mandatory update | vc105/v125 RELEASED/channel; installed device counts UNKNOWN | Older Android without gate, currently active Agent vs standby, minimum floor NOT 105 | P1 safe staged installation proof; do not assume automatic forced update |
| WEB-TABS-HISTORY | 5 Web tabs/date filter | Current five tabs + date controls RELEASED; TRUE historical PENDING/OVERDUE-as-of NOT IMPLEMENTED | Define historical state semantics and event/snapshot coverage, query/range quota | P1 owner selects historical semantics; test bounded indexed reads |
| RESULT-CORRECTION | Same setting for HAS_STOCK/SKIP_ALLOWED edit | D166 source RELEASED | Initial result-publication deadline, no reset on correction, stale UI, Picker ACK and 5 tabs | P1 end-to-end version/time/role regression |
| NEW-PICKER-DEFAULT-ON | New Picker reporting enabled | D166 source RELEASED | HR new vs existing, disabled existing user, contractor changes and retries | P1 field HR account matrix |
| PRIVACY-OBSERVABILITY | Forensic log/trace safety | D166/D167 diagnostics RELEASED | Agent/Web/Android raw negative scan, dropped metrics/clock/coverage | P1 verify raw ZIP redaction, keep local aggregation bounded |
| CI-CD-OWNER-GATE | CODE READY then owner-gated merge/deploy | POLICY MERGED; **technical enforcement NOT CODED** | Workflow triggers, rerun/dispatch, immutable SHA+scope approval check | **READY FOR PROPOSED CODE**, no live trigger until Owner instruction |
| AGENT-AUTO-SKU | Supra export→Inventory auto daily sync | Standalone test source in main/field screenshot PASS narrow test; **main Agent daily scheduler/import NOT CODED/DEPLOYED** | WMS export rights for main Agent, session boundary, conflict approval, idempotency, rollback | Design after independent app proof; no silent auto-WMS/API reuse |
| AS-OF-LOCATION-REPORT | LTA/Shelving at report date | **NOT CODED/DEPLOYED** | Reliable location history/source and project scope currently excludes bin/location management | Research/read-only proposal first; no invented backfill |

## 3. D167 six supplemental A–F (distinct from inherited 15)

| Item | Technical release evidence | Field gaps / business risks | Action |
| --- | --- | --- | --- |
| A Web result/date UX | Web `web/src/operational-app.ts` merged/released | Duplicate filters removed? presets, manual inclusive dates, 5 tabs, mobile viewport, Web request count | Field visual + API filter retest; one active tab read |
| B HR partial-sheet settle | `service/src/hr-event-sync.ts` incomplete 3-field `WAITING_FOR_COMPLETION` → persistent `HARD_BLOCK` logic released | Two editors, successive fingerprints, lost Watch events, contractor-empty policy, last valid snapshot | Field and unit matrix; verify no accidental staff disable |
| C custom VN log dates | `service/src/runtime-logs-core.ts`, `web/src/operational-app.ts`, Android log UI release | Pagination, 90-day actual retention, inclusive VN bounds, invalid/reversed ranges | Bounded manual fetch proof, no silent longer retention |
| D last successful login | `service/src/user-management-core.ts`, Web/Android surfaces released | Success vs refresh, WEB vs ANDROID, user switch, no per-heartbeat write | Check durable timestamp from real login and logout |
| E Reporter meal choice and auto-skip pause | `service/src/meal-break-core.ts`, `service/src/sla-automation.ts`, Web/Android source RELEASED | CAS cross-reporter, missing confirmation, wrong-minute auto-skip, mobile notification, 10:55/17:55 VN | **P0 policy decision + daytime field scenarios** |
| F PER_PICKER overdue +30/+60 and 03:00 day close | `service/src/d167-overdue-core.ts`, Worker alarms, Web/Android source RELEASED | OPEN ticket eligibility, midnight new report, duplicate/replayed ACK, correct business day, batch/race/50 cap | **P0 source contradiction to resolve and regression-test** |

## 4. Three concrete high-risk findings from main source (NOT claimed production incidents)

### P0-F1 — New-VN-day SKU batching contradicts existing unique index (CODE PROVEN)

`service/src/business-core.ts` creates **`idx_pending_batch_sku` unique on `report_batches(sku) WHERE status='PENDING'`** (near line 242), but the D167 report-create path (near lines 417–457) intentionally retrieves a PENDING batch **only for today's VN day** and creates a new PENDING batch when no current-day batch exists. If an older day-N batch for the same SKU is still PENDING after midnight, creating a day-(N+1) PENDING batch **conflicts with the unique index**. Existing same-Picker open-ticket lookup also rejects repeated SKU independently of day. `service/src/core.ts` still invokes `initializeBusinessSchema` at DO init; no corresponding index migration/drop found in reviewed `core.ts`, `business-core.ts`, `d167-overdue-core.ts`, or `index.ts`. **Source-level incompatibility is proven; whether a user hit it in production requires request/DO error evidence**.

**Proposed repair (Owner approval required):** first choose explicit day-isolated business-episode behavior, then design a safe SQLite indexed migration preserving uniqueness **per SKU and VN business day** or a compatibility-safe alternative. Define cross-day same-Picker OPEN ticket behavior before relaxing the old guard. Atomic transaction, idempotency, weekday/timezone migration, rollback, and two concurrent Picker clients must be tested. No direct index deletion or live schema change from this analysis. Candidate affected components: DO schema/report-create, per-picker ticket checks, midnight alarm, overdue/queue counts, Web/Android status, event/FCM/ACK and reports.

### P0-F2 — Missing meal choice already pauses auto-skip for one hour (CODE PROVEN, Owner exception decision PENDING)

`service/src/meal-break-core.ts` `slotFor(..., choice=null)` returns **11:00–12:00 or 18:00–19:00**; `mealWindowsBetween` selects this fallback absent a Reporter selection, and `mealAdjustedDeadline` excludes that entire hour. `getMealChoiceState` explicitly reports `AUTO_SKIP_PAUSED_DURING_FULL_CANDIDATE_HOUR`. The D167 decision ledger still calls this *unconfirmed fallback policy* requiring Owner selection. Consequently the live-source behavior is broader than the intended selected **30-minute** meal break. This can delay auto-skip up to an extra 30 minutes; it is NOT proof any Picker abused the break.

**Recommend Owner choose fail-closed policy:** keep current safe hold temporarily or use a tighter fallback with explicit escalation to Admin/Root after a deadline; never silently auto-skip during an unconfirmed meal in a way that encourages misuse. Once chosen, use one server-authoritative event/alarm and atomic recalculation of pending deadlines; no per-PDA polling. Test early/late choice, missed prompt, off-shift Reporter, reboot, Client time drift, manual HAS_STOCK/SKIP/correction separation.

### P0-F3 — 03:00 day close currently operates on ALL tickets of an eligible batch (CODE PROVEN, cross-day protection blocked by F1)

`service/src/d167-overdue-core.ts` `processD167DayClose` filters the parent batch by first-report day/overdue-open existence but updates all its OPEN tickets using `WHERE batch_id=?` and resolves remaining nonoverdue OPEN tickets with `SYSTEM_DAY_END`. This reflects the Owner's proposed stronger batch-level finalization, but if an N+1 ticket shares a day-N batch it could be resolved early. The D167 report-create change tries to separate new-day batches, yet **F1 blocks reliable separate PENDING creation under the existing unique index**. First reconcile schema and business semantics; then confirm at 03:00 that only eligible day-N ticket population is affected. Test 23:59/00:00/02:59/03:00 races, human resolution at alarm time, outage catch-up, first overdue immutable origin, >50 eligible batches, event counters and targeted Picker notification.

## 5. Usage evidence and alternatives — no fabricated reduction

### Observed baseline (not comparable-normalized as billed shift)

`docs/D166_USAGE_AUDIT_2026-10-06_08.md` reports the Owner's 08/10 screenshots as approximately **Firestore 23K document reads and 4.5K writes**, **DO 78M SQL rows read**, **67.32K Workers**, **~11K RTDB Rules denied**. The same review observed 1,453 successful Agent `QUERY_FRESH_ONLY` polls (1,390 empty), 226 RTDB SSE unavailable incidents and frequent lease fallbacks. These are heterogeneous screenshot windows/process-log samples; they are **not** a 2026-10-11 measured change or direct billing attribution. D167 deployed expanded forensic data, not proven saved usage. Cloudflare 08/10 account-wide included rows-read ratio was very low versus that day's internal target; optimize actual constraints and total cost, not only the biggest raw number.

### Alternative matrix (each requires same-load proof)

| Option | Mechanism | Why / risk | Recommendation |
| --- | --- | --- | --- |
| O0 Verify only | Use v125 on-demand ZIP, source-freshness marker, provider per-hour screenshots; correlate active PDA/Agent, Picklists, alerts | No service changes; critical to isolate actual billing; process-local stats incomplete | **Do first in parallel with P0 correctness investigation** |
| O1 Reduce needless Firestore requests | Compare REST empty watchdog, active listener health and fallback lease; dedupe control/presence reads and repair proven reconnect storm | 1,390 empty sample is a measurable component, NOT full 23K explanation. Overaggressive removal may worsen 10–15s failover or ACK | **First code optimization candidate after trace**; preserve safety fallback |
| O2 Reduce DO SQL rows | Rank new 15 allowlisted cursor query IDs by `rowsRead × frequency`; use indexes/bounded counters/snapshots only on verified hot queries | Extra indexes or materialized counters increase rows written & complexity; process snapshots not billed | **Second candidate after per-query samples** |
| O3 Safe cross-meter event aggregation | On service transaction, reuse committed delta stream and client RAM aggregate; existing RTDB/WS events when authoritative and compatible; no switch to Sheets for transactions | Could reduce duplicate queries but raise fan-out/bandwidth and gap-recovery risk; not all Firestore operations are safely replaceable | **Conditional experiment** only after equivalent correctness/latency/load and free-tier cost proof |
| O4 Reduce cost of diagnostics | Existing manual ZIP and coarse local counters instead of log writes on every request; normalize/batch provider measurements | Slight ZIP byte/CPU growth; removing forensic fields too early loses root-cause evidence | Keep bounded/opt-in, prune *after confirmed archive* only |

**Optimization hard gates:** one active PRIMARY, safe WMS confirmation, exact result ACK, UI realtime freshness (measure observed event-to-render p95), end-to-end confirm p95/p99 non-degradation, no increased crash/retry/FCM loss, no role bypass, mixed-version compatibility, total incremental monthly spend within currently authorized plan. No provider/quota rebalance unless measured benefit remains after normalization. Compare baseline vs two representative equivalent shifts with explicit confidence; repeat when workloads differ.

## 6. What can be coded vs what needs more evidence

- **SOURCE PROVEN, suitable for narrow fix proposal NOW, but no new executable code authorization from this document:** F1 SQLite day-isolation/index conflict; F2 missing-choice fallback discrepancy after explicit Owner business choice; F3 03:00 day-boundary semantics after F1; CI/CD enforcement (code-ready exact SHA + scope Owner-gated main deployment); stale spec-status reconciliation (documentation).
- **RELEASED: verify before re-code:** A–F UI/business, Android vc105 404/BadToken, Agent v125 HA/Usage, HR, last login, Picker default, result correction, logs, OTA. Source changes are no substitute for observed outcomes.
- **SOURCE/LOG INSUFFICIENT for justified usage or reliability rewrite:** exact billed Firestore/DO cost driver, RTDB Rules deny path/auth, HA true field failover, confirmed ACK latency, Device installed counts, Drive two-identity folder integrity, Launcher receive→Drive.
- **REQUIRES DESIGN/SCOPE/OWNER DECISION before business code:** automatic daily primary-Agent Supra SKU export/import (standalone test does not grant main Agent session/API rights); historical LTA/Shelving area analytics (scope excludes location/bin inventory); historical PENDING/OVERDUE as-of (define reconstruction authority/retention); fallback Auto Skip policy when Reporter does not confirm.

## 7. Proposed execution order (not authorization)

1. **P0 business integrity:** authorize a code-only fix design and migration tests for F1/F3, choose F2 missing-choice policy, make comprehensive cross-module regression matrix (DO + Android + Web + notification + 03:00).
2. **P0 diagnostics/quality:** safely field-test vc105/v125 and manual ZIP on staged Agent standby/PDA. Collect comparable provider readings and source-vs-billed attribution. Do not disrupt in-flight WMS confirm.
3. **P1 minimize actual waste:** only after identifying top billed component choose O1/O2/O3 with expected per-meter deltas, owner-reviewed code+deploy scope, rollback and field A/B shifts.
4. **P1 field validation:** A–D, reminder/meal state, cross-identity Logs, OTA fleet and Picker default. Fix a field-failed item under D167, not a new D-number.
5. **P2 capabilities/design:** CI/CD hardening, Web historical as-of, standard Agent daily SKU synchronization and LTA/Shelving location model each with its own dependency/permission review, still inside D167 serial gate as applicable.

**Ready proof request (when available):** v125 Usage ZIP+existing sanitized Agent runtime logs 06:00–22:00 VN; matching Firestore/RTDB and Cloudflare Worker/DO billed/time-series readings; version counts on designated PDA/Agent; exact activity timestamps around HA handoff, 00:00/03:00 and meal prompts; Web/Android event and error outcomes; Drive verified archive IDs without private identifiers. Unknown data stays PENDING; do not require immediate manual intervention just to complete this documentation review.

## 8. Change-control receipt

This file records Owner-requested **analysis/reconciliation only** under open D167. Cross-component review rules are recorded in `AGENTS.md`, `docs/OPERATING_PROTOCOL.md`, `docs/OWNER_DECISIONS.md`, and `docs/specs/ACCEPTANCE_TESTING.md`; implementation state is separately tracked in `ops/project-state.json`. No WMS/Inventory provider calls, new source feature, quotas, billing or Stable state are modified. Branch→PR→authority + continuity CI required; docs-only merge allowed only if demonstrably no runtime deploy side effect. Full D167 Owner business acceptance remains PENDING.


## Update: Owner locked D01–D10 after this evidence review

This is an earlier analysis baseline. The later, controlling decisions are in `docs/D167_OWNER_DECISIONS_D01_D10_2026-10-11.md`: use Web/Excel HR instead of GSheet account sync; default late 30-minute meals; 03:00 close ALL day-N PENDING whether or not overdue; independent next-day SKU/Picker reports; daily PRIMARY SKU job after 05:00 in the managed browser; new SKU automatically, rename requires Agent confirmation and absent remains; only LTA/Shelving temporal area, UNKNOWN before verified history; low-overhead logs and no Launcher mutation; staged code-only followed by scoped Owner Beta deployment. Proposed historical Pending/Overdue reconstruction and full-hour meal hold are superseded. Runtime source still needs to be changed under a later code instruction.
