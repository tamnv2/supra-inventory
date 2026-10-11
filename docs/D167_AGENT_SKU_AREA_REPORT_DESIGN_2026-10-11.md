# D167 — PRIMARY Agent SKU daily sync + LTA/Shelving provenance + reporting redesign

> **Status: PROPOSED DESIGN / repo-source verified, NOT CODE READY, NOT DEPLOYED.** Owner on 2026-10-11 prioritizes these linked features before returning to the remaining Web operational UI corrections. D167 remains open, D05/D07 were omitted from PR #555 and are now ACTIVE FOR DESIGN, NOT RUNTIME. This is not approval to execute WMS automation or deploy; the Owner's CODE READY and release gates remain separate. Use only registered Inventory Beta resources. Stable, Launcher, WMS mutation and stock/bin operations are out of scope.

## A. Verified baseline and explicit technical hazards

- Current main baseline `8ccb0177481e89e1fdc86e9e03670138c0412135`; PR #555 Beta Web/InventoryCore deployed via workflow 38109855709, schema 17/17 and Operational 7/7. Android signed vc105 and Windows Agent v125 unchanged by PR #555; live installation unknown.
- `relay-agent/SupraConfirmBrowser.cs` has an Agent-owned authenticated managed WebView2 process, CONFIRM navigation, ready state and serialized browser state gate. `FirestoreAgentLeaderCoordinator.cs` owns PRIMARY, generation and standby election. No production daily SKU export state machine exists.
- `experiments/d167-sku-sync-test/SkuSyncFlow.cs` and `SkuWorkbook.cs` implement **separate browser/login**, temporary allowlisted request authentication/signature inside standalone test, export XLSX, parse SKU/name ONLY, 1,000-SKU preview/import chunks and sparse sample readback. **It is not a safe normal Agent implementation**: no source area parse, no same managed-browser context, no global HA daily job and no complete import readback.
- `service/src/business-api.ts` restricts `POST /api/admin/skus/import` to Admin/Root/PickPack roles but requires an interactive WEB/ANDROID session through `requireUser`/`interactiveSessionError`. A normal AGENT token does not satisfy that interactive route; DO NOT spoof `WEB` or steal an existing Web session. New narrowly authorized AGENT SKU sync route and service-verified generation/identity need a code change.
- `service/src/sku-import-core.ts` has dry-run, name-change guard, 2,000-item chunks and an idempotency key per actor; its preview is computed before its write transaction and **is not a durable multi-chunk, version-fenced atomic job**. A new job-level manifest/preview/commit CAS is needed; do not assume caller preview prevents concurrent Web edits.
- `service/src/business-core.ts` dashboard mixes ticket event dates, batch first-report dates, resolution dates and live all-time pending; Web dashboard `web/src/operational-app.ts` counts `SYSTEM_TIMEOUT` automatic Skip but does not separate `SYSTEM_DAY_END`, whereas Excel `web/src/report-excel.ts` merges the two. New reports must make cohorts and sources consistent across UI/API/Excel.
- `web/src/operational-app.ts:3926+` currently correctly paginates Excel over all filtered batches and Picker tickets, with hard caps. Retain complete filtered export, not just current visible page.
- The original WMS XLSX containing **validated location columns and actual HY1 LTA/Shelving examples is not accessible/verified in this review**; parser currently discards every non-SKU/name column. **NO invented field names/position parsing**. Verifying the real exported XLSX schema is a technical P0 gate before area-classification code/field PASS.
- Resource authority: `ops/project-scope.json` D167 allows existing managed-browser READ-ONLY WMS SKU export and coarse area history **inside Inventory Beta** only; WMS session headers/cookies/signing material cannot be replayed outside that user-controlled managed browser.

## B. Complete target flow — one daily job, never interfere with Confirm Picklist

1. **Eligible** only after VN 05:00; Agent signed in under its existing `AGENT` identity and authorized role, elected PRIMARY with matching current HA generation, confirm-critical work idle or safely isolated, owned managed browser genuinely WMS READY. Reuse existing Agent wake/leader/ready/business-schedule signals; at most one date-bound eligibility wake (NOT another tight poll, heartbeat or periodic Firebase listener). Agent starting late in day may still run that VN day's job.
2. **Claim** `(VN_date, job_key=HY1_SKU_MASTER)` in authoritative InventoryCore DO, atomically acquire a short fenced lease `(job_id, lease_owner, generation, expiry, expected_state)`; SERVER re-verifies AGENT auth, privileged role, lead-generation proof and sequence for every mutation. Old PRIMARY callbacks after failover must be rejected. STANDBYs never perform WMS export while a PRIMARY owns a healthy lease.
3. **Export** in an independent hidden WMS tab/page of the **SAME currently authenticated managed Agent WebView2 browser/profile**, with its own navigation/download lifecycle, never navigate away from/reload/resize the Confirm tab. Prefer existing WMS UI's authorized read-only Export and a strictly scoped in-browser download; if cross-origin response cannot legally/technically be downloaded without copying session auth to an external HTTP client, STOP with `WMS_EXPORT_BOUNDARY_BLOCKED` and report evidence. Never copy/replay cookies, tokens, HMAC keys/headers to Windows HttpClient, Worker, disk logs or GitHub. Never automate Web Inventory UI clicks for upload: use authenticated Inventory API.
4. **Read/validate** XLSX locally in bounded memory, schema/header/version aware (not hardcoded to first worksheet where unsupported). Preserve string/leading-zero SKU, normalize Unicode, trim name/area, de-duplicate identical rows. Separate (a) SKU/name validation and (b) optional trusted area source validation; missing/ambiguous area must not invent classifications. Reject truncated/empty/unexpected file, corrupted ZIP, wrong site, missing columns, duplicated same SKU with conflicting names or uncontrolled export query filters. Compute safe canonical fingerprint over normalized business fields (no credentials). Do not treat disappeared SKU as deletion.
5. **Stage** read-only upload chunks into a server-side `sku_sync_staging` job whose row count/fingerprint must match the manifest; no visible SKU catalog mutations yet. Server computes complete plan: NEW, UNCHANGED, RENAME_REQUIRES_APPROVAL, INVALID/CONFLICT, AREA_CHANGED, AREA_UNKNOWN. Treat identical repeated file as zero business writes. Add a source count/age anomaly gate (e.g. suspiciously large decrease) as **proposed configurable threshold**, never silently approve a truncated export.
6. **Approve** new valid SKU automatically. An existing SKU with a changed product name must be shown *ON Agent*, with old/new text, counts and source timestamp; privileged Agent operator explicitly confirms the exact fingerprint/expected catalog revision once, or rejects/defers. No modal should block WMS confirm or lock the current PRIMARY role. Rename approval cannot be inherited by a changed file or a new fingerprint. If approval absent, leave old names and current catalog unchanged; record pending state, never mark DONE. If Web admin edits meanwhile, re-preview and reapprove if necessary.
7. **Commit** only after authoritative one-job revalidation (current lease, generation, source hash, catalog revisions, approval), in a bounded atomic SQL transaction if performance proofs show it safe for 5,000 SKUs. Stage rows in chunks to avoid oversized API payloads, but do **not** treat per-chunk success as full job DONE. If 5,000-row one-transaction exceed DO runtime constraints, design a separately tested versioned-catalog pointer/visibility barrier and rollback strategy BEFORE production. Update only NEW/RENAMED; unchanged SKU must produce zero catalog updates, no deletion; write area history only on first verified observation or actual verified area change.
8. **Verify** ALL staged SKUs vs the durable catalog (server counts/hash/full readback, not three sample SKUs), area interval invariants and audit receipt before setting exactly ONE `DONE` for VN day. Any HTTP timeout after commit must be resolved by querying immutable job/commit receipt; never blind repeat mutations.
9. **Publish status** Agent section with last successful VN day/time, role, number read/new/unchanged/renamed/deferred, classification known/UNKNOWN, warnings and retry action. Web Quản lý SKU can read latest status. Send one bounded non-sensitive status event on terminal transition; do not push 2,500 per-SKU events, refresh/reconnect every PDA or increase Agent heartbeat.
10. **Failover/recovery:** lease expires and next PRIMARY resumes from server staged manifest; it re-downloads once if the trusted staged content is missing and compares same fingerprint. Old leader cannot approve/commit after generation change. Once DONE exists, no Agent on any PC may re-run that day without a distinct audited Owner override (new job/version). If unable to complete by day's end, carry FAILED/DEFERRED with actual timestamps; next day's job is distinct. Avoid sync during actively running WMS confirmation, unstable HA or shift freeze.

### Proposed job state machine

`WAIT_ELIGIBLE -> CLAIMED -> WAIT_WMS_READY -> EXPORTING -> VALIDATING -> STAGED -> PREVIEWED -> (WAIT_RENAME_APPROVAL) -> COMMITTING -> VERIFYING -> DONE`

Alternative terminal states: `NO_AUTH`, `WMS_NOT_READY`, `SCHEMA_UNVERIFIED`, `SOURCE_CONFLICT`, `RENAMES_REJECTED`, `HA_FENCED`, `RETRYABLE`, `PARTIAL_COMMIT_BLOCKED`, `FAILED`. State owner = InventoryCore; Agent UI is only a consumer/operator.

### Scenarios and safe responses

| Scenario | Required result |
| --- | --- |
| Multiple Agents simultaneously become PRIMARY / failover mid-export or approval | CAS single lease + generation fence; old PRIMARY denied; new owner can resume. |
| Agent starts before 05:00 / after 05:00 / after midday | Use existing schedule signal or ready event; never run before VN 05:00; late startup still eligible that day. |
| WMS login expires or Export page unavailable | No credential replay/external HttpClient fallback; show concise reason, retry only on WMS-ready/new-role/manual operator event. |
| WMS export slow while Picker confirms Picklists | Download in isolated tab, low priority; cancellation and confirm latency take precedence. |
| File incomplete, 0 rows, suspicious count, wrong site, schema changed | Reject full job; preserve catalog and last successful history. |
| One SKU repeated same name vs different name | Identical rows dedup; conflicting names block source before any write. |
| Newly appearing SKU | Auto-create after validation; no Agent approval needed. |
| Existing SKU same name | No DB update; no SKU notification blast. |
| Changed name, Agent does not approve | Hold in WAIT_RENAME_APPROVAL; preserve old name and prior areas. |
| Agent approves then Web changes name / user loses role | Source/catalog CAS stale -> refuse commit and require new preview/approval. |
| SKU absent in new export | Never delete/disable; record `not_seen` metric only, not an absence proof. |
| Timeout between commit and ACK / duplicated job retry | Query durable job receipt; same fingerprint/idempotent result, never duplicate history. |
| SKU with two area rows or invalid/missing classification | Internal `AREA_AMBIGUOUS` / `AREA_UNVERIFIED` evidence; report UNKNOWN, never choose one area arbitrarily. |
| WMS file contains SKU/name but no reliable area | Permit SKU/name processing; disable area timeline ingestion with explicit reason; report all pre-observation UNKNOWN. |
| Agent offline/service 5xx/429 | Recover via bounded backoff triggered by existing events; no offline write queue or broad retries. |
| End of day or 03:00 day close overlaps sync | Job uses its own VN date/source timestamp; report historical area is bound to report time, not job completion or 03:00 close. |

## C. LTA / SHELVING temporal fact contract

- Source must prove actual column header + normalized value/bin pattern and site. **Do not assume any non-LTA row means Shelving.** Unit of truth is SKU **coarse area as observed by trusted WMS export**. If one SKU is simultaneously in both areas with no authoritative Picker-specific location, classify aggregate report attribution `UNKNOWN` and show internal reason `MULTIPLE_AREA` until Owner explicitly decides alternate split attribution. Neither exact bin nor stock quantity is stored.
- New InventoryCore schema proposal:
  - `sku_sync_jobs(day_vn, job_key, job_id, lease_generation, source_fingerprint, state, counts_json, expected_catalog_revision, actor, committed_at, verified_at)` plus append-only transition/audit event.
  - `sku_sync_staging(job_id, sku, normalized_name, validated_area_or_null, source_row_hash, validation_reason)` with TTL after verified DONE/FAILED; never put raw WMS auth/file in public logs.
  - `sku_area_intervals(sku, area ENUM LTA|SHELVING, effective_from_utc, effective_to_utc_nullable, first_observed_job, source_fingerprint, recorded_at_utc, evidence_quality)` with unique SKU/open-interval and nonoverlap guards.
  - `sku_area_current(sku, area_or_unknown, first_observed_at, last_validated_at, interval_id_nullable)` as small indexed helper only if actual SQL profiling shows it's cheaper; avoid redundant writes for unchanged areas.
  - Attach `area_at_first_report` + `area_source_interval_id` to a batch; attach `area_at_picker_report` + evidence timestamp/reason to ticket at creation (or use a bounded indexed interval join for legacy data, with immutable result).
- At first verified area observation, open interval at **actual verified observation time**, not guessed WMS movement time. At detected move from LTA to Shelving or inverse, end preceding interval and open a new one **at observed commit timestamp**. Same area/no change -> zero interval writes. Prior to first area proof = UNKNOWN. Existing historical tickets/batches before first proof are UNKNOWN, not retroactively assigned.
- If the export no longer includes a previously known SKU, do not close its area interval on absence alone. If a row has ambiguous area, **do not forge a new known interval**; expose `AREA_UNVERIFIED` and `last_confirmed_at`; report consumers must distinguish stale evidence from fresh observation. Historical attribution remains to the last demonstrably valid interval only within clearly displayed evidence limitations.
- Report `LTA / SHELVING / UNKNOWN` filters always use **area at the report's immutable timestamp** (batch:first report, ticket:own report) rather than current SKU location. Area is independent of whether status is PENDING, HAS_STOCK, SKIP_ALLOWED or CLOSED. Corrections and 03:00 auto-close do not rewrite area attribution.
- UNKNOWN has reason codes `NO_SOURCE_YET`, `MISSING_AREA_COLUMN`, `INVALID_FORMAT`, `MULTIPLE_AREA`, `AFTER_LAST_VERIFIED_UNCERTAIN` as appropriate. Unknown is **evidence missing**, not a third WMS location; labels are simple `Chưa xác định` in Web reports.
- Indexes should support `(sku, effective_from_utc DESC)` as-of join and `(business_day_vn, area_at_first_report, status)` for batch reporting; no O(n SKU history) scan per report row, no per-PDA WMS/area lookup, no provider-metric polling.

## D. Unified reporting contract — two distinct views, one authoritative model

### Definition of reporting time/grain

- **Operational summary (business cohort):** select VN days `N..M` inclusive by `report_batches.business_day_vn`. One batch = one SKU shortage episode on one day. **Final status is the status known at report-generated-as-of time**, clearly display this time. A day N batch auto-closed at 03:00 N+1 still counts in day N's outcome, with actual `resolved_at` retained at N+1.
- **Ticket detail:** each Picker report is a distinct ticket, with its own report timestamp, report-day, ACK status/elapsed time and `area_at_picker_report`. Show batch and ticket quantities separately; don't add batch counts as if they are picker reports.
- **Real-time live KPIs:** current PENDING/OVERDUE regardless of chosen historical range MUST be labeled `Hiện tại` and visually separated from selected-period totals. No historical as-of reconstruction of the two live tabs (Owner explicitly rejected this).
- **Resolution throughput (optional distinct section):** count actions performed on date N by actual `resolved_at`, never silently add this to day-N business cohort. Avoid mixing these cohort definitions within one KPI row or Excel.
- **Skip provenance:** split `REPORTER` human, `SYSTEM_TIMEOUT` SLA, `SYSTEM_DAY_END` Inventory missed 03:00, `REPORTER_CORRECTION` corrected result (with original event history if needed). `SYSTEM_DAY_END` MUST NOT be called `quá hạn`; current UI and Excel definitions diverge. Preserve first/last resolution, source and correction trail.
- **Unique SKU:** distinct SKU across selected report batch cohort; **Picker affected:** distinct Picker account across cohort tickets; **lượt báo:** count ticket records, **đợt báo:** count batch. State change after period does not silently shift cohort to a different business day.
- **Area grain:** summary result counts by batch's first-report area, ticket detail counts by Picker ticket area. If 1 SKU has 2 daily batches across days, each belongs to its own report-day/location observation. Do not sum per-area unique SKU and claim the result is distinct overall when one SKU appears in multiple groups.

### Tổng quan — proposed composition

1. Header: VN-day inclusive range, timestamp of report generation, current SKU source timestamp/freshness and known-area coverage `LTA/Shelving/Chưa xác định`.
2. Business cohort KPIs: total Picker reports, shortage batches, distinct SKU, distinct Picker, resolved batches, average duration, `SYSTEM_TIMEOUT` count, `SYSTEM_DAY_END` count, human Skip count, HAS_STOCK and WITHDRAWN. Denominator and unit visible.
3. Area split table: `LTA | Shelving | Chưa xác định` rows; columns `Đợt báo, Lượt báo, SKU khác nhau, Picker, Đã có hàng, Skip bởi người, Auto SLA, Chốt 03:00, Thu hồi, TG xử lý`. Clicking area opens **the same-filter** detail.
4. Trends: per VN report day by report first occurrence vs number of Picker reports; output mix by area and source; top repeated SKU by area. Show sample/source-age and UNKNOWN coverage so dashboard doesn't suggest unsupported history.
5. Live-only operation strip (separate): currently pending, currently overdue, currently active Picker/Reporter, current WMS SKU last update; no fake historical pending/overdue.
6. Cross-check footnote and export: `Tổng đợt = LTA + Shelving + UNKNOWN`, `Đã xử lý + Đang xử lý/Chưa chốt + Đã thu hồi = Tổng đợt` under same as-of cohort, with exclusions/edge state explicitly classified.

### Báo cáo chi tiết — proposed composition

1. Common filters: VN from/to, area `Tất cả / LTA / Shelving / Chưa xác định`, status, actor/source `REPORTER/SYSTEM_TIMEOUT/SYSTEM_DAY_END/CORRECTION`, SKU/name, Picker/Reporter code where role-authorized. Reuse date toolbar behavior already approved; **Web operations layout changes still deferred by Owner priority**.
2. One row per batch: day VN, SKU/name (snapshot at report time), first report, area at that time and confidence, number of Picker tickets, newest outcome, who/which source resolved, resolved_at, duration, 03:00 performed/scheduled when applicable, correction history and ACK progress.
3. Expand batch for rows per Picker: Picker employee code/name (role filtered), own area/report timestamp, ticket result, event_id and received/displayed/ack times; sample original/successful outcome for resolved corrections. No mixing current SKU area into old report records.
4. Drill into SKU read-only timeline: known LTA↔Shelving changes `effective_from/effective_to`, first observation, evidence status/source job and UNKNOWN before; NO exact bin, WMS live API query or stock level.
5. Export Excel with full filtered pagination, server-side consistent query revision/as-of timestamp, sheets `Tổng quan`, `Theo khu vực`, `Đợt báo`, `Chi tiết Picker`, `Lịch sử khu vực SKU` (filtered) and `Nguồn dữ liệu`. Preserve existing audit/ACK/export columns and 60-day query range limits unless separately approved; do not export only visible page. Guard 100k-row caps and never produce misleading partial Excel.

### Reporting implementation requirement

Build shared server-side `report_scope(from_vn,to_vn,area,status,as_of)` and one SQL-tested metric definition/reusable query builder for the Dashboard, Detail, Excel (plus consistent filters and explicit units). Prefer index-backed bounded grouped SQL and one cross-check suite rather than N+1 per SKU/Picker lookups or client-side recomputation from partially loaded result pages. Under load, consider a transactionally invalidated daily aggregate only **if** direct indexed SQL still burns too many actual billed rows; retain raw canonical batch/ticket data.

## E. Authority, cost, non-regression and tests

| Surface | Exact intended impact | Forbidden/regression guard |
|---|---|---|
| Windows PRIMARY Agent | Daily eligible schedule, same WMS-managed browser additional hidden export page, Agent-confirm rename and status, HA generation fence | No confirm-tab navigation, no session export, no new fast timer, no queue/HA latency regression |
| Inventory Beta Worker + InventoryCore SQLite | Privileged AGENT SKU job API, fenced ledger/staging, atomic catalog publish, area intervals and report-grain queries | Root/Admin/PickPack RBAC, Web manual SKU upload coexistence, bounded SQL/CPU, no stock/bin management |
| Web Quản lý SKU + Tổng quan/Báo cáo | Job status/rename audit, as-of area analytics and coherent export | Do not redesign operations five-tab UI in this workstream; preserve current VN date logs |
| Android Picker/Reporter | Continue using existing SKU master realtime update and result ACK | No WMS calls, per-area polling, background timers or UI update required unless API contract regression proves otherwise |
| Firebase Auth/Firestore/RTDB/FCM | Reuse Agent AGENT auth and existing HA coordinator/notification pipes; no new per-SKU or per-PDA write | Avoid false Firebase WEB session login/switch; no new provider collection without Owner resource approval |
| WMS Supra | Read-only export from authorized browser | No Confirm API, inventory mutation, WMS token/header export |
| Drive/Sheets/Launcher/Stable | No changes in this design | Must stay out of new scope; operational exports remain where already authorized |

**Usage alternatives to compare before code authorization:**
- O0: Continue manual SKU import (lowest new provider usage, highest Owner effort, no automated area history). Retain fallback even if new job is implemented.
- O1 **recommended:** one Agent/WMS read-only export after 05:00/day; compare normalized source diff locally, upload staged chunks on existing Beta API, write only real SKU/name/area changes; DO indexed on-demand reports and existing wake/events. Estimated new cadence is **one WMS export per successful VN day**, at most a handful of small API calls per 2k–5k rows; actual Cloudflare CPU/SQL rows and WMS bytes must be measured, not fabricated.
- O2: write full daily snapshot to Drive/Firestore/Sheets then synchronize from there. Adds storage, network, writes and cross-provider consistency/permissions with no demonstrated speed/accuracy advantage; **do not choose by default** absent measured cost case.

**Must run in CODE READY branch/CI:** realistic exported XLSX layout/schema fixture (synthetic safe data), 0/2.5k/5k SKU, 1k chunks, missing/duplicate/conflicting names, multi-area and untrusted bin values, 05:00 VN and DST-free UTC conversion, missing/expired WMS login, 6-Agent lease contention/leader generation takeover at every state boundary, race with Web manual rename and role revocation, bounded retries/offline denial, 03:00 day-close, immutable report classification, N vs N+1, 60-day range, multi-Picker, edit corrections, auth/RBAC, cross-source report reconciliation and full Excel pagination. Tests must verify no delta to normal Picklist p95/p99, existing ACK/FCM/HA behavior and no new periodic Firestore/DO queries.
**After separately Owner-approved Beta deployment:** real controlled Agent/WMS export proof, provider health and live AGENT job auth, full catalog readback and source reconciliation, source field mapping in real file, actual LTA↔Shelving observation over multiple days, load and comparable-shift Cloudflare/Firebase meter proof, real Picker/Reporter ACK and HA takeover. No claim of Owner field PASS until observed.

## F. Unresolved technical evidence (must not be invented)

1. Exact export XLSX area/location header(s), values and whether one SKU may physically be listed in multiple areas. Prior uploaded source file is referenced in conversation history but was **not available in the current retrievable Project/library data**. Need to validate its columns before area classifier is called CODE READY.
2. Managed Agent WebView2 support for an isolated hidden additional tab/session export without disrupting Confirm; test within the same authorized browser process/profile, and verify safe in-browser download/CORS behavior. No guaranteed working implementation from the standalone separate-browser test.
3. Per-SKU multi-area business attribution: recommended default `UNKNOWN` with explicit ambiguity reason, not false division into LTA/Shelving; if Owner wants allocation by position or by Picker's actual location, that would require separately verified source fields and new rules.
4. Atomic 5,000-row catalog + temporal interval migration's actual DO CPU/SQLite write cost and rollback; choose atomic staged commit only after benchmarks. No production assumption of write budget.
5. Employee role allowed to approve rename in Agent; recommend current authorized Agent administrator with independent explicit approval and audited identity, not arbitrary WMS session user.
6. If day N source does not arrive and day N+1 file first observed at 05:00, **do not retrospectively attach N+1 area's label to N's reports**.

## G. Proposed implementation split and permission boundary

- **Track P0:** Capture/validate WMS real export schema + in-managed-browser WMS export feasibility (code tests/CI only once Owner says `chạy code`); fail closed if proof absent. This is a dependency for reliable area history.
- **Track P1:** Implement AGENT-auth daily fenced ledger/staging, atomic catalog plan/approve/commit/readback, safe HA and event-driven schedule. Backend + Agent tests together, not standalone import only.
- **Track P2:** Implement temporal area history and immutable report-time classification once P0 real location evidence is verified. Never backfill undocumented old periods.
- **Track P3:** Reconcile server Dashboard and Detail cohort/source definitions, extend area filtering, detailed rows and full Excel; cross-check exact parity at all 3 endpoints.
- **Track P4:** End-to-end non-regression and usage test, owner-gated Beta release of exact affected Agent+Worker+Web scope only after explicit `duyệt triển khai`; Android only if proven changes are actually required; Stable separate authorization.

**Approval ledger:** Existing D167 D05/D06/D07 business rules are Owner-locked, current turn selects implementation planning priority. The detailed mechanics above are explicitly **recommended/subject to source proof**, NOT newly claimed Owner decisions, and **no executable source edit or provider deploy is authorized by this planning receipt**.

## 2026-10-11 21:33 VN — AUTHORITATIVE OWNER SUPERSESSION: three daily SKU jobs

This addendum supersedes original sections describing **one WMS export/one DONE for the entire day**, universal Agent rename approval, and no daily active roster. Owner approved:
- `INITIAL_05`: after 05:00 upon PRIMARY/WMS ready, a fully validated FULL SNAPSHOT builds/replaces the active roster for that VN shift-day. Source-absent SKU hidden, NOT deleted. Normal changed cross-day names/area from complete trusted WMS source automatically accepted.
- `DELTA_12`: stable randomized target 12:00–12:15; `DELTA_19`: stable randomized target 19:00–19:15. Each downloads fresh read-only WMS source in the same managed Agent browser; applies only per-SKU new/changed name/verified coarse area; missing SKU in later source does NOT hide active roster.
- Exactly one `DONE` per `(VN day, slot)`, with immutable receipt even when zero SKU fields changed; server-coordinated target selection, HA generation lease, abort/coalesce stale attempts, no repeated source writes or provider polling. If morning FULL is still missing when next slot is eligible, establish FULL first, never DELTA against yesterday's set.
- Manual Web uploads default PATCH with explicit separate FULL REPLACE; same-day conflicting Web vs Agent changes to an overlapping field require CAS/preview/privileged approval. WMS source unchanged since prior WMS observation cannot silently revert Web manual edits.
- First-slot FULL only hides absent SKU, never erases records/history/open tickets; no-op per normalized SKU/name/coarse-area leads to zero SKU-row mutations. A complete reliable file with zero pickable locations gives UNKNOWN; absent/malformed area headers or partial source cannot erase existing location. Keep temporal area-as-of-report history, no backdating.
- Implement diff-based active-set membership (writes only membership symmetric difference), stable source fingerprint/slots, one-shot local scheduling on existing readiness and HA signals, atomic publication and complete readback. Protect WMS Confirm and avoid new Firebase/DO timers.

The binding Owner decision and scenario/acceptance details are in `docs/D167_OWNER_DECISIONS_D01_D10_2026-10-11.md`. Current content above is historical design except compatible security/HA/area-report requirements. **DOCS/SPEC ONLY: no CODE READY, Beta runtime deploy, or Stable change.**
