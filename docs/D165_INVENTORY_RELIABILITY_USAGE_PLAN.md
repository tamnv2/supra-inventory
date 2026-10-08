# D165 — Inventory Reliability, Realtime and Usage Optimization Plan

Status: **IMPLEMENTATION STARTED — OWNER EXPLICIT START 2026-10-07**  
Recorded: 2026-10-06  
Inventory accepted base: **D163 Owner PASS**  
Parallel workstream note: **D164 PDA Management remains independent and field-pending under `ops/pda-management-state.json`. D165 is recorded as a dormant proposal and does not replace the current D164 change-control slot.**  
Stable: **OWNER-GATED — untouched**.

## 1. Owner instruction and hard stop

The Owner approved the complete D165 proposal after reviewing D163 live behavior, all 2026-10-06 Báo hàng logs, and refreshed Cloudflare/Firebase/GCP usage screenshots.

The proposal-only recording gate was satisfied on 2026-10-07 by a fresh authority bootstrap and explicit Owner start. Implementation remains subject to the following guards:
- use branch → PR → authority/continuity/component gates → merge;
- keep D164 PDA Management isolated;
- change only scoped Beta Inventory resources;
- keep Stable untouched unless separately Owner-authorized;
- preserve every realtime/speed/stability acceptance invariant in this document.

That required fresh-bootstrap/re-verification occurred on 2026-10-07 and the Owner explicitly started D165. This document remains the implementation contract.

## 2. Primary objective

Reduce avoidable provider usage while preserving at least the current level of:
- realtime UI updates;
- realtime receipt and processing of business events;
- PickList processing latency;
- failover safety;
- business correctness;
- session / authorization safety;
- operational stability.

Usage optimization must never trade away current speed, realtime behavior or correctness merely to save quota.

A usage family with very low utilization may increase modestly when that directly reduces a more constrained usage family and the trade remains comfortably inside the shared account budget.

## 3. 2026-10-06 evidence baseline

### 3.1 Cloudflare / Durable Objects

Owner-provided billing and 24-hour metrics show approximately:
- Worker invocations: ~45.67k / 24h;
- Worker subrequests: ~67.31k / 24h, materially lower than the prior D161/D162 baseline;
- Worker errors: 0;
- Durable Object account-period compute requests: ~175.34k on the displayed shared billing view;
- Durable Object SQL storage rows read: ~62.9M;
- Durable Object SQL storage rows written: ~114.8k account-period / ~62k on the shown 24-hour graph;
- Durable Object storage: ~14.9 MB;
- CPU, memory and compute-duration usage remain low relative to their displayed included envelopes.

The $5 Workers account is shared with other projects. D165 therefore adopts an **internal Inventory budget**, not merely the provider hard limit.

Planning target for Inventory after D165:
- target DO compute requests attributable to Inventory: **<=150k–200k/month under representative load**;
- no implementation may assume the full shared-account allowance belongs to Inventory.

### 3.2 Firestore / Firebase

Owner evidence shows approximately:
- Firestore reads: ~15k / 24h;
- Firestore writes: ~9k / 24h;
- deletes: low;
- realtime listeners: peak ~76;
- active connections: peak ~40;
- RTDB storage/download use: effectively near zero;
- FCM, Token Service, Drive, Sheets, Functions and Monitoring usage are low enough that no aggressive reduction is justified.

Current Agent source confirms:
- PRIMARY lease heartbeat: 10 seconds;
- failover threshold: 15 seconds;
- NEXT_A repeatedly reads the Firestore lease to detect PRIMARY failure.

This HA liveness loop is a large non-business contributor to Firestore reads/writes.

### 3.3 Logs

The complete 2026-10-06 Báo hàng log set was split into two daily folders. The second set also contained a duplicate Android scheduled bundle with the same bundle identity/content.

Observed defects / noise:
- repeated expected `PRESENCE_ACK_CONTROL = SUPERSEDED` / `FAILED_PRECONDITION` events with no transport-health impact;
- Android catalog synchronization failures such as 501/2501 and 0/2501;
- Web session-lost presence refresh loop producing repeated unauthenticated attempts;
- forced Agent Kích User field test did not reliably produce the expected Android final logout log;
- Agent single/all kick and call UI status can remain stale until another action.

### 3.4 Current speed guard

The accepted current Agent/PickList path must remain the baseline. Representative 2026-10-06 log correlation showed approximately:
- processing P50 ~3.3s;
- P90 ~5.7s;
- P95 ~6.7s;
- highest observed ~11.7s;
- Firestore ACK P50 ~452ms;
- ACK P95 ~960ms.

D165 must not materially regress these figures under comparable load.

---

# 4. D165 functional scope

## D165-A — One canonical daily Logs folder

All Báo hàng logs from:
- Android APK;
- Web;
- Windows Agent

must resolve to exactly one canonical child folder per Asia/Ho_Chi_Minh date under the already scoped Beta Logs parent.

Requirements:
1. Agent Apps Script and Worker archive paths use one canonical daily-folder identity contract.
2. Folder find/create must be race-safe.
3. Existing clients never list/create Drive folders directly.
4. `bundle_id` is the idempotency key for archive acceptance; filename is not authority.
5. Concurrent duplicate uploads of the same bundle produce at most one Drive artifact.
6. No new polling or heartbeat is introduced.
7. Historical duplicate folders may be consolidated only after runtime fix is deployed and readback proves the canonical target.

## D165-B — User-facing release notes

App and Agent update manifests must include a bounded user-facing release summary.

Rules:
- text is intended for ordinary operational users;
- describe visible fixes/features in simple Vietnamese;
- do not expose endpoints, IDs, secrets, auth internals, vulnerabilities, private diagnostics, Owner-only instructions, AI reasoning, PR/branch/change-control details or sensitive architecture;
- release note travels in the already-read version/update manifest; no new background request cadence;
- Agent automatic update behavior must not be blocked waiting for release-note acknowledgement;
- manual update may show the note before update; after automatic update the Agent may show “Đã cập nhật” plus the approved note.

## D165-C — Reporter tab “Quá hạn” for PER_PICKER only

This feature applies **only when `auto_skip_mode = PER_PICKER`**.

`FIRST_REPORT` behavior is explicitly unchanged in D165 and will be designed separately later.

### Semantics

A Picker ticket becomes “Quá hạn” when it has reached the configured auto-skip point and `auto_skip_allowed_at` has been committed.

One SKU may simultaneously appear in:
- **Đang xử lý** for Picker tickets that are still waiting; and
- **Quá hạn** for Picker tickets that have already been auto-allowed to skip.

The SKU is grouped independently in each view, but both views refer to the same open batch.

### Critical PER_PICKER change

Current behavior may close the whole batch as `SKIP_ALLOWED` when the final Picker reaches auto-skip.

D165 PER_PICKER must instead:
- continue granting each Picker auto-skip at its own deadline;
- keep the batch `PENDING` for Invent review;
- keep the SKU visible in Quá hạn;
- allow later Picker reports for the same SKU to join the same pending batch;
- close the batch only when Invent explicitly resolves it.

### Actions from Quá hạn

**Đã có hàng**
- resolves the SKU to HAS_STOCK;
- applies to all relevant Picker tickets in both Quá hạn and Đang xử lý;
- Pickers who previously received system auto-skip must receive the corrected HAS_STOCK result because the final business result changed;
- previous timeout history remains auditable and is not deleted.

**Cho phép Skip**
- sends a new Skip result only to Picker tickets that are still in Đang xử lý;
- Picker tickets already in Quá hạn do not receive a duplicate Skip notification;
- if no waiting Picker remains, the batch may be finalized without duplicate FCM/ACK fan-out.

## D165-D — Correct HAS_STOCK result

The correction source is **the “Đã có hàng” result**, not the Skip tab.

For a HAS_STOCK result, Web adds:
- **Sửa - Đang xử lý**
- **Sửa - Cho phép Skip**

Both require two explicit confirmations. The second confirmation must clearly state that a result already announced to Pickers is being changed.

### HAS_STOCK -> PENDING

Requirements:
- reopen the batch;
- preserve immutable audit/history of the old HAS_STOCK decision;
- send an explicit corrected-state notification to affected Pickers;
- require the same critical acknowledgement behavior as normal result notifications;
- reset the per-Picker automatic-skip deadline from the correction time using the current configured policy so an old expired deadline cannot immediately auto-skip the reopened item;
- maintain version/concurrency guards so two Invent users cannot silently overwrite one another.

### HAS_STOCK -> SKIP_ALLOWED

Requirements:
- preserve the previous HAS_STOCK history;
- create a new corrected result;
- notify affected Pickers with a clear “kết quả đã được điều chỉnh” message;
- require acknowledgement;
- avoid duplicate delivery to a Picker whose final corrected result was already delivered idempotently.

D165 does not add a general `SKIP_ALLOWED -> ...` correction flow.

## D165-E — Protect SLA / processing-time configuration changes

Changing processing-time / auto-skip configuration is a critical operation.

On Save:
1. show a high-severity warning that the change can make Picker skip eligibility earlier/later;
2. require the current password of the currently authenticated user;
3. verify the password server-side;
4. only after successful verification may the configuration commit;
5. password must never be stored in localStorage, logs, audit metadata or provider diagnostics;
6. audit records actor + before/after configuration + time, but never the password;
7. preserve existing authorization roles; this is an additional re-authentication guard, not a replacement for RBAC.

## D165-F — Agent UI and forced logout repairs

### Kick all does not refresh list
After authoritative bulk revoke succeeds:
- remove the revoked generations from the Agent in-memory Picker list immediately;
- render the new list locally;
- do not issue an extra Firestore/API query solely to refresh UI;
- preserve a Picker that legitimately re-logged in with a newer generation.

### Single kick / call status remains stuck
Messages such as “Đã kích…” / “Đã gọi…” become temporary local UI notices.

After a bounded display time, restore the normal current status, e.g. active Picker count and PRIMARY/fleet state.

This is UI-local only and creates zero provider operations.

### Forced Kích User logout log continuity
When Android receives an authoritative revoke:
1. finalize and persist the sanitized session-end bundle locally before clearing the session;
2. attempt the D163 permitted final `INFO/session_end_logout` upload;
3. if network/archive is not confirmed, retain a pending local final bundle;
4. retry only through the existing bounded log-delivery mechanisms, not a new heartbeat;
5. dedupe using `bundle_id`;
6. never preserve passwords/tokens in the bundle;
7. business authority remains revoked immediately. Logging grace never restores business authorization.

## D165-G — Android catalog single-flight synchronization

Only one full/delta catalog synchronization may mutate the shared staging area at a time.

When a second trigger arrives while sync is active:
- join/coalesce into the current sync or mark one bounded follow-up;
- do not clear/stage the same catalog concurrently;
- do not run multiple full catalog downloads in parallel;
- preserve realtime catalog-change signaling;
- reduce API reads rather than increase them.

This addresses observed partial catalog results such as 501/2501 and 0/2501.

## D165-H — Stop Web business refresh after session loss

Web must stop protected periodic/background operations immediately after session loss / replacement.

Specifically:
- presence refresh must first require a valid local session;
- AUTH_REQUIRED / SESSION_REPLACED transitions should cause one controlled session transition, not repeated 30-second error calls;
- no change to valid-session presence cadence is authorized by D165.

## D165-I — Expected SUPERSEDED conflicts are diagnostics, not archive errors

Keep optimistic concurrency / CAS exactly as the safety mechanism requires.

When `PRESENCE_ACK_CONTROL` loses a legitimate race and the newer state is authoritative:
- keep a bounded local diagnostic counter;
- do not upload a dedicated ERROR bundle for every expected SUPERSEDED result;
- promote to ERROR only on real divergence, repeated convergence failure or transport-health impact.

---

# 5. D165 usage optimization scope

## D165-U1 — Realtime row patch instead of full visible-list reload

Normal Web realtime events must patch the affected in-memory row/model directly whenever the event/snapshot is sufficient.

Current anti-pattern to remove:
`realtime event -> full queue/recent API read -> Durable Object -> SQL -> repaint`.

Target:
`realtime event -> validated snapshot/delta -> patch exact SKU/result -> repaint`.

Rules:
- queue badge and recent badge continue using existing realtime delta/transition metadata;
- visible queue/recent row is inserted/updated/removed from the event snapshot where safe;
- full list load remains mandatory on initial tab open, login/F5, real cursor gap, epoch change, integrity uncertainty or missing required event data;
- no guessed state when event data is insufficient.

Expected effect:
- lower DO compute requests;
- much lower SQLite rows read;
- equal or faster UI update.

## D165-U2 — SQL indexes for hot read models

Add only indexes proven to match existing/D165 query predicates.

Candidate indexed access paths:
- effective recent-result time + status;
- Picker history by `picker_user_id + reported_at`;
- Picker history fallback by `picker_employee_code + reported_at`;
- acknowledgement lookup by `batch_id + target_user_id + created_at`;
- PER_PICKER overdue lookup for open tickets with `auto_skip_allowed_at IS NOT NULL`;
- any expression index used for an existing `COALESCE(resolved_at, updated_at)` predicate when query-plan proof shows benefit.

Trade policy:
- modest extra DO SQL writes/storage are explicitly allowed;
- no broad speculative indexes;
- query-plan / regression evidence is required.

## D165-U3 — Delta-first reconnect, full reconcile only for a real gap

A transport disconnect alone does not imply lost authoritative data.

After reconnect:
- continue from the persisted cursor/epoch;
- replay missing deltas;
- if cursor/epoch continuity is valid, do not full-reload all visible data;
- full reconcile only for actual gap, epoch mismatch, cursor invalidity, incomplete replay or integrity uncertainty;
- concurrent reconcile triggers must join/coalesce into one in-flight reconciliation.

Do not slow reconnect backoff merely to save usage.

## D165-U4 — Move Agent HA liveness heartbeat to existing Beta RTDB

D165 proposes reuse of the already scoped Beta RTDB **only for Agent HA liveness**, not as Báo hàng business transaction storage and not as WMS authority.

Target model:
- PRIMARY publishes a tiny liveness record approximately every current 10 seconds;
- NEXT_A observes the liveness key through RTDB realtime subscription;
- 15-second failover objective remains unchanged;
- Firestore remains the authoritative PRIMARY/generation/role state;
- before takeover or WMS mutation, existing Firestore generation/PRIMARY fences remain mandatory;
- if RTDB is unavailable/unhealthy/uncertain, Agent falls back to the currently accepted Firestore lease mechanism;
- no WMS session data, PickList business payload, passwords or secrets are written to RTDB.

This deliberately increases a currently near-unused RTDB usage family to reduce Firestore lease reads/writes without weakening failover.

Implementation requires:
- exact RTDB path/rules design;
- Beta RTDB Rules validation/deploy through the existing scoped automation;
- no Stable rule/dependency change.

## D165-U5 — Only current PRIMARY may ACK the presence-control slot

Retain the ACK contract required by D162.

However, expected redundant contenders must not all attempt the same terminal write.

Target:
- only the current authoritative PRIMARY/generation may commit the presence-control ACK;
- standby agents listen/converge but do not race terminal ACK writes;
- after failover the new authoritative generation becomes the writer;
- ambiguity fails closed to current safe behavior until authority is resolved.

No new polling/read cadence is allowed.

## D165-U6 — Reduce provider and archive noise from expected conflicts

This combines with D165-I:
- aggregate expected concurrency losses;
- no per-event Drive upload for health-neutral expected conflicts;
- preserve enough sanitized evidence to diagnose real convergence failures.

## D165-U7 — Materialized batch summaries / transactional counters

Use the very low DO SQL write/storage usage to reduce repeated COUNT/JOIN reads.

Candidate authoritative summary fields maintained in the same business transaction:
- waiting/open Picker count;
- overdue Picker count;
- total Picker count where useful;
- ACK target count;
- acknowledged count;
- other bounded counters only when they eliminate an observed hot correlated query.

Requirements:
- source-of-truth mutation and summary update occur atomically;
- migration/backfill must be deterministic and verifiable;
- summaries are never asynchronously “eventually corrected” for a hot business decision;
- if summary integrity is uncertain, fail closed to authoritative exact query and repair/rebuild.

Trade accepted:
- DO rows written may increase materially from the current very low baseline if it yields a much larger rows-read reduction;
- write amplification must remain bounded and measured.

## D165-U8 — Android realtime delta/scope application

Current Android behavior refreshes too broadly:
- Picker `picker_reports` realtime can call a refresh that loads both reports and results;
- Reporter `reporter_queue` or `reporter_recent` can refresh both queue and recent.

D165 target:
1. separate queue and recent refresh scopes;
2. apply exact realtime snapshot/delta to local RAM/UI when sufficient;
3. Picker report events patch only affected report state;
4. result events patch only affected result state;
5. Reporter queue event patches queue only;
6. Reporter recent event patches recent only;
7. full API refresh only on initial load, actual gap, missing/incompatible event data or integrity uncertainty.

This must reduce Worker/DO requests and DO rows read while making normal UI updates faster.

---

# 6. Usage trade policy

## Explicitly acceptable increases

### DO SQL rows written
May increase to maintain indexes and transactional summary counters.

Reason: current write usage is tiny relative to read usage, while repeated correlated reads are expensive.

### Worker/DO CPU, memory and compute duration
May increase modestly for safe in-memory caching of:
- SLA config;
- realtime stream metadata;
- reporter counters;
- recently used immutable/validated projections.

SQLite remains authority. Cache loss/restart must be harmless.

### RTDB
May increase from its near-zero baseline for HA liveness only, bounded tiny payloads and one realtime subscriber family.

### Firestore reads
A small bounded increase is allowed only if it directly prevents a larger write storm or is required for authoritative takeover verification. No periodic read increase is accepted.

## Not authorized in D165

- new periodic polling to simulate realtime;
- slower realtime solely to save quota;
- increasing normal FCM delivery fan-out;
- reducing accepted Firestore listener responsiveness;
- weakening WMS/PRIMARY/generation fences;
- moving hot authoritative business state to D1;
- moving Báo hàng business transactions to RTDB;
- using KV as business authority;
- introducing a new provider solely for quota optimization.

---

# 7. Deferred optimization outside D165

D1 currently has very low usage and large displayed allowance, so it is a possible future cold-read sink.

**D165 does not migrate history/reporting to D1.**

After D165 24-hour representative field evidence, a later Owner-reviewed change may consider moving only cold/closed read-heavy data such as:
- prior-day history;
- long-range reporting;
- exports;
- immutable audit/result history

to D1 or another read model.

Hot queue, overdue, result acknowledgement, realtime cursor, session authority and business mutation remain outside that future cold-history proposal unless separately approved.

---

# 8. Internal shared-account budget targets

Because the Cloudflare $5 account serves multiple projects, D165 adopts conservative internal targets.

Under comparable Inventory load after stabilization:
- Inventory-attributable DO compute requests: target **<=150k–200k/month**;
- DO storage rows read: **>=70% reduction from the ~63M/day observed baseline**, target **<20M/day** and continue lower if measurable without regression;
- DO rows written: permitted to rise for indexed/materialized summaries, but no uncontrolled write loop;
- Firestore writes: target **<=3k/day**;
- Firestore reads: target **<=10k/day**, preferred **<=8k/day**;
- RTDB: bounded small-MB/day class, far below the displayed daily download allowance;
- Firestore API error rate: target <1% absent a real provider/network incident;
- Worker runtime errors: 0.

These are acceptance targets, not permission to optimize by degrading business behavior.

---

# 9. Realtime / speed / stability acceptance invariants

D165 fails if any optimization causes:
- report/result delivery slower in normal path;
- queue/result badge becoming polling-based;
- missing Picker result;
- duplicate result;
- duplicate WMS mutation;
- stale session authorization;
- failover slower than the accepted 15-second objective;
- normal PickList latency materially worse than the 2026-10-06 baseline;
- loss of notification acknowledgement semantics;
- new silent inconsistency between batch summaries and transactional truth.

Normal event paths should become equal or faster because full reloads are removed.

---

# 10. Component impact

### Service / InventoryCore
Planned:
- PER_PICKER overdue semantics;
- HAS_STOCK correction transitions;
- SLA re-auth validation;
- realtime event snapshots/deltas sufficient for row patch;
- materialized summary counters;
- query/index changes;
- log archive idempotency/daily folder rules.

### Web
Planned:
- Quá hạn tab;
- HAS_STOCK correction UX with two confirmations;
- critical SLA save confirmation/password;
- exact row patch;
- delta-first reconnect;
- session-lost request stop.

### Android Báo hàng
Planned:
- corrected-result notifications and ACK;
- forced-kick final log persistence;
- catalog single-flight;
- realtime scope/delta patch;
- release notes.

### Windows Agent
Planned:
- local list refresh after kick;
- temporary operation notices;
- RTDB HA liveness with Firestore authority/fallback;
- PRIMARY-only presence-control ACK;
- expected-conflict diagnostic suppression;
- release notes.

### Apps Script / Drive logging
Planned:
- one canonical date folder;
- race-safe find/create;
- bundle-id dedupe.

### Provider configuration
Proposal only:
- reuse existing scoped Beta RTDB and update Rules only when implementation is explicitly started;
- no new provider resource;
- Stable unchanged.

---

# 11. Required implementation sequencing after future Owner start

When the Owner later explicitly starts D165, do not implement all risky changes at once without gates.

Recommended sequence:
1. fresh bootstrap + verify D164/shared-boundary state;
2. create implementation branch from then-current main;
3. add regression tests/usage guards first;
4. implement log/session/catalog/Agent local fixes;
5. implement Web/Android delta patch + SQL indexes/materialized summaries;
6. implement PER_PICKER overdue/correction/SLA re-auth;
7. implement RTDB HA liveness with Firestore fallback and Rules;
8. authority + continuity + component tests PASS;
9. PR review/merge;
10. Beta-only deploy/releases;
11. representative 24-hour usage and field verification;
12. Owner explicit D165 PASS required before promotion.

Any field failure remains D165 repair. No D166 escape.

---

# 12. Verification checklist for the Owner’s next session

Before code starts, verify at minimum:
- D165 is still proposal-only and source/runtime are unchanged by this record;
- D164 PDA Management state has not been accidentally merged into Báo hàng D165 scope;
- FIRST_REPORT is unchanged;
- correction source is HAS_STOCK only;
- Quá hạn semantics are PER_PICKER only;
- SLA save requires current-account password;
- RTDB is liveness only, Firestore remains authority and fallback;
- no new polling/listener family is added except the RTDB liveness listener replacing Firestore lease polling;
- D1 cold-history offload is deferred;
- internal Inventory DO request budget is <=150k–200k/month target;
- usage targets and performance invariants remain acceptable.

Only after that verification and a new explicit Owner start command may runtime implementation begin.

## 2026-10-08 — D165 field-repair continuation: RTDB role parity and Agent v120

Observed 08/10 billed Firestore reads ~3.8–4.1k/hour under active load, with RTDB unavailable and Firestore lease fallback events in Agent logs. Source audit found mismatch: Agent sessions may be `PICKPACK_ADMIN`, while Beta RTDB `ha_liveness` rules allowed only `ADMIN`. This source-level defect is confirmed; exact attribution of billed Reads needs post-fix Monitoring.

Owner authorized a low-risk staged repair: extend only the existing Beta `ha_liveness` rules to authenticated AGENT matching ADMIN or PICKPACK_ADMIN role/base-role, and stop repeated SSE transport failures from waking the HA coordinator every second after the initial health transition. Keep failover safety, Firestore authority, 10s PRIMARY heartbeat, existing fallback and realtime/WMS/ACK pipeline unchanged. Agent v120 is manual-update only. Owner installs on NEXT_A first, validates, explicitly transfers PRIMARY when no in-flight confirmations, validates confirmation/ACK, then updates remaining Agents. No Android, Web, Worker, Stable or new resource mutation. Technical/CI/deploy and Owner field/usage PASS are distinct.
