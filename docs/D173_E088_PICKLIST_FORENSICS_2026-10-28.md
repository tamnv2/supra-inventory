# D173-E088 — PickList forensic 14–28/10/2026; P2/P3 DO backlog (28/10/2026)

## Owner directive / gates
Owner explicitly: (1) move previous E085 DO P2 HTTP disconnect/Duration and P3 unnecessary DO Requests to **BACKLOG/PENDING EVIDENCE**, (2) deeply investigate recurring PDA PickList confirmations, including erroneous PDA local time/timezone, repeat instant failures after first WMS uncertainty, and cases requiring Agent/Web manual confirmation, using ~14 days logs. This is **READ-ONLY FORENSICS + DOCS ONLY**. No apk/EXE, Worker, Firestore Rules/data, WMS automation, durable guard, provider schedule, D172, or Stable mutation permitted by this command. P2/P3 must not be silently implemented. D172 remains independent PENDING/HOLD, Stable OWNER-GATED.

## Evidence coverage and quality
- Drive contains Agent session/checkpoint/manual/error logs named by 2026-10-14 through 2026-10-28 (14 complete days 14–27, partial 28). Read representative **one largest relevant host log/day**, plus targeted exceptions. Overlapping checkpoints/sessions exist; day totals from such logs are **not fleet totals**, and partial day/log gaps invalidate an unbiased daily incidence rate. PickFace logs are separate WMS product, not automatically Inventory Relay; don't conflate. 25th sampled VPS file too short to give usable PickList business count. PDA-generated Android runtime logs were **not found** in connected Drive search: exact PDA device sequence, displayed app error, timezone setting, SDK token exceptions and actual client UID remain FIELD UNVERIFIED.
- Project repo (main 2026-10-28) source inspected: `android/.../RelayPocClient.kt`, `OperatingScheduleStore.kt`, `PickerController.kt`, `firebase/firestore.rules`, `relay-agent/{FirestoreConfirmationTransport,D160ConfirmPipeline,SupraConfirmBrowser,SupraConfirmBrowserD160}.cs`.
- All findings below are sanitized, contain no raw request IDs, PL codes, employee names, device IDs, personnel records, tokens, session strings or private Drive locators. Timestamps are illustrative clock time, **not** evidence that the same secret PickList persisted unless further identifier correlation is performed privately.

## Finding F1 — PDA client epoch 12h/24h behind SERVER-created time; WMS FOUND -> rapid REQUEST_EXPIRED (STRONG EVENT EVIDENCE)
Android sends `client_sent_at_ms = System.currentTimeMillis()`, **plus** `created_at = FieldValue.serverTimestamp()`. Firestore `relay_poc_jobs` create Rules require `created_at == request.time` and `client_sent_at_ms is int >=0`, but DO NOT assert equality of those timestamps. Server therefore accepts a job when local PDA clock is wrong. Agent source telemetry separately records `max_created_age_ms` and `max_client_age_ms`.

Detailed correlated actual logs (single chosen machine/file, not a global count):
| Date/time VN | Server-created age at HANDOFF | PDA-client timestamp age | Browser result | Agent outcome |
|---|---:|---:|---|---|
| 16/10 20:25:41 | 411 ms | 43,168,839 ms (~12h) | FOUND 1/1 | REQUEST_EXPIRED, no WMS mutation, ACK 412ms |
| 17/10 09:31:06 | 9,061 ms | 86,416,757 ms (~24h) | FOUND 1/1 | REQUEST_EXPIRED, ACK 260ms |
| 19/10 16:44:25 | 261 ms | 43,178,810 ms (~12h) | FOUND 1/1 | REQUEST_EXPIRED, ACK 429ms |
| 20/10 15:10:02 | 274 ms | 43,202,648 ms (~12h) | FOUND 1/1 | REQUEST_EXPIRED, ACK 345ms |
| 20/10 15:10:05 | 359 ms | 43,202,612 ms (~12h) | FOUND 1/1 | REQUEST_EXPIRED, ACK 388ms |

Critically, at 20/10 15:10:02 `D160_DIAG QUEUE phase=BROWSER_GATE max_request_age_ms=43,202,954` mirrors **client epoch**, not `server-created` age 274ms; `D160_12S_MUTATION_FENCE` falsely expires the new request. Observed same symptom on 16/17/19. Thus a historical Agent runtime path **used untrusted PDA/client time for the 12s business mutation fence**, causing deterministic fast false-negative when PDA clock differs.

**Important source/runtime discrepancy:** current **main** `relay-agent/D160ConfirmPipeline.cs` has `D160RequestAgeMs(work)` based on `work.CreatedAtMs` (Firestore server `created_at`), and comments “client clock is diagnostic only”. Therefore historical log establishes the **old installed Agent's problem**, NOT proof that **current installed Agent153** still uses client clock. Determine exact historical source/deploy version and test on Agent153 before any new code change. The user toggled both auto time and auto timezone together, so this cannot isolate timezone alone; an incorrect epoch (12h/24h) is evidenced, whereas timezone *label alone* does not change Unix epoch. Clock drift may also perturb token verification, Android operating schedule/cache/lock countdown but those secondary impacts are not independently proven. The Android 20/35s elapsed timer uses `SystemClock.elapsedRealtime`, immune to wall-clock offset.

## Finding F2 — post-final-click uncertain WMS leads to persistent confirmation guard and very-fast HTTP409 next attempts (CONFIRMED CONTROL FLOW)
`relay-agent/D160ConfirmPipeline.cs`: `_confirmationGuard.TryBegin` returns `InProgressOrUncertain` on re-attempt after final click without conclusive WMS terminal success. Agent then emits `CONFIRM_IN_PROGRESS_OR_UNCERTAIN`, `cache=BROWSER_DOM+GUARD+D160_NO_ROW_INFERENCE`, HTTP409, `mutation_waves=0` and one legitimate Firestore ACK. This is **deliberate fail-closed idempotency protection**, NOT transient network transport corruption; do **not** delete/shorten guards or blindly auto-retry WMS final mutation.

Sanitized 27 Oct sequence on VPS:
- 06:17:56: one WMS confirmed job (do **not** imply same PL as following).
- 06:18:13: different request WMS bulk final-click attempted; outcome `CONFIRM_IN_PROGRESS_OR_UNCERTAIN`, ACK 366ms; WMS success not proved.
- 06:18:26, 06:18:51, 06:19:37: matching error **pattern**, `D160_NO_ROW_INFERENCE`, HTTP409, `mutation_waves=0`, ACK ~254/284/411ms; request business 1.0–1.5s (not every whole PDA RTT ~0.3s).
- Similar signature 24 Oct 06:14 and 26 Oct 06:51. Status persisted after new requests because guard/release requires authoritative proof. Individual raw PL codes and request IDs are not in report; correlation of **same exact PL** or success of later manual Web still needs protected incident-level comparison.

`SupraConfirmBrowserD160.cs` conservatively returns UNCERTAIN on fresh WMS error surface after irreversible click or inability to prove final success. The guard is kept to prevent duplicate mutation. Manual Agent/SFT/Website may have a different visual/proof context, but “Web manual later succeeds” is user observation, not verified by paired WMS event logs.

## F3 — independent operational categories
- WMS `NOT_FOUND`, missing/not-loaded results, disabled checkboxes, `CONFIRM_CONFLICT`, `WMS_DATA_UNAVAILABLE`, `WMS_SESSION_REQUIRED` coexist across days (e.g. 23/10 WMS page 30 disabled of 39 checkboxes). Some NOT_FOUND could be genuine wrong suffix; not proven failures.
- `PICKER_LOCKED` after repeated NOT_FOUND is a rate-control path, not universally the “unknown” error. Local Android lock UX uses wall-clock `System.currentTimeMillis`; clock drift merits scenario test but not unsafe bypass.
- Sporadic Firestore 403/auth/stream reconnect appears, yet a server-ACK `REQUEST_EXPIRED` or HTTP409 WMS guard is a business decision, not a network timeout. Correlate separately.

## Representative single-log outcomes (NOT daily fleet totals)
| 2026 Oct day | sampled Agent responses | CONFIRMED | NOT_FOUND | UNCERTAIN | CONFLICT | EXPIRED | other |
|---|---:|---:|---:|---:|---:|---:|---:|
|14|243|224|14|2|3|0|0|
|15|193|170|12|3|5|0|3|
|16|224|198|18|1|3|3|1|
|17|290|236|15|5|14|20|0|
|18|9|0|9|0|0|0|0|
|19|377|326|24|5|15|5|2|
|20|627|559|52|0|3|9|4|
|21|189|172|11|0|2|4|0|
|22|259|235|20|2|0|0|2|
|23|300|279|13|2|3|0|3|
|24|333|299|11|8|10|0|5|
|25|0|0|0|0|0|0|0|
|26|301|272|21|5|3|0|0|
|27|166|149|9|5|3|0|0|

Nonrepresentative by construction: selected single host and windows, 18/25 sample impoverished. Do not use these numbers for global error rate. 28 Oct partial raw data not sufficient.

## Root cause verification and repair scope proposals — NOT IMPLEMENTED
Priority P1a: reconcile **historic vs current Agent release binary/source** for D160 age source (client vs server) and reproduce wrong clock ±12h, ±24h, UTC+7 manual/automatic on real test PDA, with WMS sandbox or mocked mutation. Require `serverCreatedAtMs` authoritative for **all** expiry/mutation/recovery paths, not client time; if Agent153 already fixed, classify prior failures historic and do NOT re-edit code. Neither bypass 12s server-age fence nor relax Firebase Rules/auth.
P1b: reproduce two-stage final click → uncertain → repeat HTTP409, capture terminal WMS proof, guard ID lifecycle/state **privately without PL/UID secrets**, show safe authorized **VERIFY_ONLY** reconciliation or supervised manual confirmation. Must not rerun WMS mutation on uncertain click, erase guard, or fabricate `CONFIRMED`. Distinguish “confirmed elsewhere” via same-row explicit authoritative control from stale DOM; no field proof yet.
P1c: show distinct user-facing messages for `REQUEST_EXPIRED`, `CONFIRM_IN_PROGRESS_OR_UNCERTAIN`, `WMS_SESSION_REQUIRED`, `PICKER_LOCKED` and Firestore auth errors (current PickerController has explicit mappings); identify installed Android version and exact unknown error string before proposing APK update. Diagnose login/token/clock skew separately.
P2: investigate disabled checkbox/empty WMS DOM and manual browser completion; do not auto-click “reclaim” or bypass WMS.
Data to correlate safely: App build/client local timestamp vs Firestore serverCreated; monotonic latency; Agent build/source SHA; hashed request correlate (not public); code-only result/cache/http; guard status/acquired/retire; WMS page epoch/pre+post terminal signals; manual WMS action outcomes. Reuse existing logs, avoid new high-frequency polling/usage.

## Existing unrelated DO backlog requested by Owner
- **D173-E085-P2 HTTP clientDisconnected & DO Duration**: BACKLOG_PENDING_MORE_PROVIDER_ROUTE_DATA, no Worker changes. 26 vs 27 Oct increases accounted primarily by clientDisconnected and traffic; only scoped, demonstrated cancellation/Alarm/hibernation problem may be repaired, preserve realtime/ACK/HA.
- **D173-E085-P3 unwanted DO Compute Requests / double-hop**: BACKLOG_PENDING_ROUTE_NORMALIZED_EVIDENCE; DO/Worker ratio did not worsen in prior comparison. Do not consolidate identity/RBAC/session-generation DO calls, throttle or cache until exact per-operation volume, correctness and D172 regressions prove improvement.
- Completed E086 P1 WebSocket Hibernation worker source+health unchanged; FIELD/OWNER remains pending.

## Gates
**READONLY DRIVE/REPO ANALYSIS PASS with documented source-to-runtime discrepancy and representative incident proof. Not all device/host logs reviewed exhaustively, no Android raw logs available. CODE/CI/RELEASE of *new PickList fix*: NOT STARTED / NOT APPROVED; FIELD and OWNER PASS PENDING.** Do not merge D172 or Stable. Further corrections require new Owner approval for components and separate branch/PR/CI/signed release.
