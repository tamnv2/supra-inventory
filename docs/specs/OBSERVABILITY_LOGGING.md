# OBSERVABILITY & SUPPORT LOGGING — D161

Status: **OWNER-APPROVED D161 REQUIREMENTS / IMPLEMENTATION ACTIVE — PHASE 0A PASS / PHASE 0 SAFETY PASS**.

This specification defines the D161 observability and support-log model for **Web, Android/PDA and Windows Agent**. It extends the existing D161 unified support-log lifecycle. Where this document adds capture/schema/correlation requirements, it is authoritative for D161. Existing daily Drive archive, Drive-confirmed pruning, global log collection, Beta resource scope and Stable guard remain in force unless explicitly superseded here.

The exact Owner command `bắt đầu D161 tiến hành` was received on 2026-10-04. Phase 0A and Phase 0 Safety are PASS; feature-bearing D161 implementation is active. D160 behavior remains the rescue/accepted base until explicit Owner field acceptance.

## 1. Goals

D161 logging must make it possible to reconstruct, with bounded uncertainty:

- what the user/client attempted;
- which version/build/device/session handled it;
- which server/provider path was used;
- every major stage and latency contribution;
- retries, dedupe, recovery and fail-closed decisions;
- realtime/connectivity/HA/schedule transitions;
- business outcome and durable acknowledgement;
- whether evidence was dropped, compacted, still local, buffered server-side or archived to Drive.

The design is for diagnosis, performance optimization, usage analysis and regression detection. It must not become a new business transport, polling loop or provider-write stream.

## 2. Non-goals

Logging must not:

- create offline business behavior or an offline mutation outbox;
- add per-event Firestore/Drive/Google writes;
- add provider polling/listener cadence;
- capture raw secrets/session material;
- capture raw HTML, screenshots, clipboard contents or full HTTP request/response bodies;
- change business outcome solely because logging failed.

## 3. Common event envelope — schema v2

Every platform should emit the same logical envelope, using only fields meaningful to that event:

- `schema_version=2`
- `event_id`: local unique ID for the event.
- `sequence`: monotonically increasing sequence within the current process/journal generation.
- `generated_at_utc`: client event time in UTC.
- `monotonic_ms`: elapsed monotonic time since current process/app start where available.
- `received_at_utc`: trusted server/archive receive time when the event/bundle reaches server infrastructure.
- `source`: `WEB | ANDROID | AGENT`.
- `environment`: `BETA` for D161 implementation unless later authority changes it.
- `app_version` / `build`: Web Version, Android vc/build, or Agent runtime version/build.
- `device_instance_id`: stable application-generated identifier or existing Agent instance identifier; never a hardware serial.
- `device_label`: bounded non-secret operational label when useful.
- `process_id` or process generation where useful; no OS user credential.
- `session_generation`: application session generation when already available.
- `role`: PICKER/REPORTER/ADMIN/ROOT or Agent authenticated role when applicable.
- `actor_id`: application user ID / employee code only when operationally required; never password, display-name contact data or authentication credential. Pre-login typed username is not logged as input content.
- `trace_id`: cross-component business/support correlation ID.
- `span_id` and optional `parent_span_id`: local stage correlation when useful.
- `component`: stable component name.
- `category`: lifecycle/auth/network/api/realtime/ui/business/confirm/wms/ha/schedule/update/logging/performance/storage/etc.
- `event_name`: stable machine-readable event.
- `phase`: optional stable phase/stage.
- `outcome`: PASS/FAIL/DEFER/SUPERSEDED/UNCERTAIN/CONFIRMED/etc.
- `duration_ms`: stage duration when measured.
- `attempt`: retry/attempt number when relevant.
- `provider` and `operation`: safe provider/operation names, never auth headers or secrets.
- `metrics`: bounded numeric counters/timings.
- `data`: bounded allow-listed structured detail.
- `message`: optional sanitized human-readable summary.

Storage-level severity may remain compatible with the existing INFO/ERROR path. Richer classification such as warning/fatal/incident is carried in category/outcome/importance fields rather than forcing an unsafe destructive schema migration.

## 4. Correlation rules

### 4.1 Business trace IDs

Use an already-existing business/request identity whenever available; do not create provider operations just to obtain one.

- PickList confirmation: Firestore `request_id` is the end-to-end trace key from Android → Firestore transport → Agent → ACK → Android.
- Shortage report/resolution: use the authoritative report/event identity.
- Global support-log collection: use the global `request_id`.
- Update/install: one local update operation ID per explicit check/download/install flow.
- Login/logout/session restore: one local session operation ID.

### 4.2 Sequence and gap detection

Every persisted journal maintains a monotonic sequence. Every bundle records:

- `first_sequence`
- `last_sequence`
- `event_count`
- `dropped_event_count`
- `compacted_repeat_count`

If a bounded journal must evict low-priority data, it emits/retains a `LOG_BUFFER_DROP` summary so analysis can distinguish “no event happened” from “evidence was lost due to capacity”.

### 4.3 Clock handling

Cross-device analysis must never rely on wall-clock timestamps alone.

- Keep client UTC time.
- Keep monotonic elapsed time for stage duration.
- Keep trusted server/archive `received_at_utc`.
- Reuse an already-known server offset/version when a component has one; do not add a network call solely for clock synchronization.
- Logs should record `clock_offset_ms` only when derived from an existing trusted exchange.

## 5. Security, privacy and redaction

Logging is allow-list first and regex-redaction second. Client and trusted server/archive layers both sanitize.

Never record:

- passwords or password field contents;
- Authorization/Bearer headers;
- Firebase/Google/WMS access, ID, refresh or session tokens;
- cookies or browser session material;
- OAuth client secrets, API keys, private keys, service-account JSON;
- Android signing/keystore material or Windows signing material;
- raw company-WMS session/request headers;
- raw HTML/DOM dumps, screenshots, clipboard contents;
- raw HTTP request/response bodies by default;
- full PickList codes or PickList suffixes;
- raw query parameter values;
- Wi-Fi SSID/BSSID, MAC address or local/public IP address;
- arbitrary text typed into form inputs.

Additional rules:

- PickList values are represented by request_id and/or a one-way bounded fingerprint, never the raw PL value.
- URL logging uses route/path plus query-key names only; query values are excluded.
- Exception stacks are permitted only after path/session/secret sanitization. Local OS user-home names should be stripped.
- Web DOM telemetry records semantic control identity/action, not field values.
- Android device information is limited to model/OS/app/runtime capability needed for diagnosis; no hardware serial/IMEI.
- No secret or sensitive runtime payload may be committed to the public repository.

## 6. Capture policy: preserve useful evidence without provider spam

### 6.1 Local-first journal

Web, Android and Agent collect structured evidence locally/in memory first. Recording an event itself causes **zero provider write**.

Business/auth/error/confirm/recovery events are never sampled away. Noisy UI/performance repetitions may be compacted using:

- stable fingerprint;
- first occurrence time;
- last occurrence time;
- repeat count;
- bounded sample of durations.

Immediate upload suppression affects only upload frequency; it must not silently erase the local incident history.

### 6.2 Upload/seal boundaries

Use existing channels and bounded triggers:

- crash/fatal error: immediate best-effort seal/upload;
- significant error/incident: immediate best-effort, fingerprint/debounce protected;
- PickList `UNCERTAIN`, unexpected `CONFLICT`, recovery timeout or HA safety anomaly: incident boundary eligible for immediate bundle;
- logout/session end: final session bundle;
- manual support request: immediate bundle;
- global support-log request: unsynced evidence + current snapshot;
- Agent: existing dirty/size checkpoint plus 21:45 boundary;
- Android: no return to four full periodic INFO uploads; keep local journal and use logout/error/crash/manual/global plus one bounded end-of-day safety checkpoint when authenticated and unsynced useful evidence exists;
- Web: keep bounded scheduled support checkpoints plus error/manual/global collection; new persistent incident journal may survive reload.

No new polling loop is authorized.

## 7. Bundle envelope and Drive archive

Each uploaded bundle contains:

- schema version;
- bundle ID;
- source/platform;
- kind: `error | crash | incident | session | checkpoint | manual | global`;
- device/instance identifier;
- app/build version;
- first/last generated time;
- first/last sequence;
- event count;
- dropped/compacted counters;
- content hash;
- events and current bounded snapshot.

Archive rules remain:

- parent: existing scoped `Inventory/Beta/Logs`;
- trusted archive layer resolves `YYYY-MM-DD` using actual archive date in `Asia/Ho_Chi_Minh`;
- clients never independently list/create daily folders;
- duplicate detection stays inside the resolved day folder;
- Android/Agent local evidence is pruned only after positive `DRIVE_SYNCED` confirmation;
- intermediate Worker/Core/Firestore acceptance is not prune authority.

Recommended file pattern is collision-safe and analysis-friendly, for example:
`<kind>_<source>_<device-alias>_<yyyyMMdd_HHmmss>_<bundle-short-id>.jsonl`
or an equivalent JSON bundle where current compatibility requires it.

The exact extension may stay platform-compatible, but the inner event schema must be v2 and machine-parseable.

## 8. Web observability

Web must preserve the current runtime-logger strengths and extend them with cross-platform correlation and reload-surviving incident context.

Capture at minimum:

### Lifecycle/session/auth
- logger initialized;
- Web version/build;
- page start/visibility/background/foreground;
- login start/result without credential values;
- restored session result;
- token/session refresh result and duration;
- role/session-generation changes;
- logout start/stage/result;
- session invalidation/replacement reason.

### API
For every business API call:
- safe route name/path;
- method;
- trace/request ID when available;
- start/end;
- HTTP status;
- duration;
- retry number/retry reason;
- request/response byte counts when cheaply available;
- error class/code;
- no headers/body/query values.

### Realtime
- websocket/connect status;
- reconnect reason/count;
- subscription/scope version;
- last event age/lag;
- gap/dedupe/resync decisions;
- server version/event identity where already present;
- time from server event to UI apply.

### UI/business
- semantic click/submit/change action name, never typed values;
- navigation/section changes;
- date preset chosen and resulting authoritative date range;
- report/resolution/SKIP correction actions and result;
- HR-sync workflow decisions/threshold path;
- permissions/settings changes;
- render duration for major tables/cards/dialogs;
- count of rows/entities rendered, not full table contents.

### Performance
- navigation/paint timings;
- long tasks;
- slow API/resource paths using safe URL summaries;
- viewport/basic browser capability;
- JS memory when supported;
- DOM/table row counts;
- application state summary counts/statuses, not secret/raw business payload dumps.

### Persistence
D161 permits a bounded diagnostics-only Web journal that survives reload/crash (for example IndexedDB or equivalent bounded storage). Target size is roughly 0.5–1 MiB, implementation may choose the smallest reliable bound. This does **not** create offline business mode.

The existing one-error pending slot must not remain the only reload-surviving evidence; multiple unsent incidents need bounded FIFO preservation.

## 9. Android/PDA observability

Android keeps a bounded persistent journal, target order of magnitude **1–2 MiB**, with crash-safe append/rotation and sequence/gap metadata.

Capture at minimum:

### App lifecycle and device runtime
- process/app start, resume, pause/background, stop;
- app versionCode/versionName;
- Android version, device model, screen class;
- process uptime and bounded memory snapshot at significant boundaries;
- app restart/previous unclean exit;
- network type/state transitions without SSID/IP/MAC.

### Login/session/role
- login start/result and latency;
- restore-session start/result;
- token/session refresh and generation;
- role/capability reconciliation;
- shortage-reporting permission/capability state changes;
- logout confirmation/start/network-cleanup stages/local completion;
- forced logout/session revoke reason.

### Required Android permissions/readiness
- notification permission status;
- overlay permission;
- DND access;
- battery-optimization/Doze-relevant state when it affects alert delivery;
- permission test result and duration;
- notification/full-screen/overlay fallback chosen.

### API/realtime/FCM
- safe API route/method/status/duration/retry;
- realtime connect/reconnect/last-event-age;
- FCM receive type/message class, app foreground/background state, processing latency;
- notification/overlay display attempt/result;
- acknowledgement/drain result;
- no notification payload body beyond allow-listed IDs/status.

### Business flows
- SKU cache sync start/result/count/version/duration;
- shortage report start/result;
- reporter resolve/skip/correction;
- picker withdraw;
- schedule apply/reconcile/source/version;
- update-check/download/verify/install stages;
- UI render/action timing for major screens.

### PickList confirmation
Android must log the end-to-end request timeline using the same Firestore `request_id` as trace ID:

- button/action accepted;
- local validation result;
- request create start/pass/uncertain/recovery;
- Firestore auth/token repair stages;
- listener opened/error/reconnected;
- ACK first observed;
- final-read fallback if used;
- decoded terminal outcome;
- total RTT/E2E;
- timeout/fallback guidance;
- retry attempt and whether it reused the same request ID;
- no raw PickList suffix/code.

## 10. Windows Agent observability

Agent keeps the accepted complete local diagnostic stream, but D161 should make the canonical event lines structured/machine-parseable while retaining concise human-readable messages.

### Agent lifecycle/runtime
- process start/version/build/machine alias/instance ID;
- login/session restore/refresh/logout;
- browser/runtime/profile readiness;
- CPU/RAM/process/browser health snapshots at significant boundaries, not a high-frequency provider stream;
- update manual-check/download/verify/replace stages;
- log pending/seal/upload/Drive confirmation state.

### Firestore/transport/realtime
- listener open/connect/reconnect/close;
- REST fallback query start/end;
- safe-read attempt/route/classification;
- pending payload count;
- listener-vs-REST dedupe;
- transport online/offline;
- auth refresh/recovery;
- canonical Firestore error code, HTTP code and operation;
- quota-guard decision;
- provider-operation counters at existing checkpoints.

### HA/role
- role/generation before and after refresh;
- lease/primary/standby transition reason;
- handoff start/result;
- generation fence result;
- transport-health impact classification;
- stale/precondition/superseded classification;
- WMS readiness separately from schedule/control-plane state.

### WMS/browser
No raw HTML or PickList values. Capture:

- page epoch;
- canonical route state;
- navigation type;
- reload issued/reason/elapsed;
- reload soft barrier/extension/hard timeout;
- DOM ready;
- data hydrated;
- page size;
- visible row count;
- PickList-code count;
- checkbox count/disabled count;
- dialog count;
- success/error terminal-surface counts;
- browser reconnect state;
- last successful reload age;
- D157 health/reload clock state.

### PickList confirmation critical path

For every batch/wave, capture:

1. **QUEUE/HANDOFF**
   - jobs received;
   - max created/client age;
   - listener/REST source;
   - local handoff duration.

2. **BROWSER GATE**
   - operational-ready result;
   - request-age remaining budget;
   - handler pre-search duration.

3. **IMMEDIATE SCAN / CLASSIFICATION**
   - READY/MISSING/AMBIGUOUS/UNSELECTABLE/STATE_CHANGED/UNAVAILABLE counts;
   - no raw PL;
   - per-request classification correlated by request_id.

4. **FAST WAVE**
   - targets, dedupe/group count;
   - time to mutation preparation;
   - early terminal/ACK count.

5. **DEFERRED SEARCH/RECOVERY**
   - Search click count;
   - search duration;
   - DOM changed/stable;
   - one shared deferred recovery classification;
   - reload reason/timing;
   - post-reload hydration/page-size result.

6. **RATE LIMIT**
   - check duration;
   - clear/update duration;
   - strike/lock decision without credential data.

7. **CONFIRMATION GUARD**
   - claim/read duration;
   - acquired/already-confirmed/in-progress/uncertain;
   - guard release only for safe pre-final failure;
   - provider error classification.

8. **PRIMARY/GENERATION FENCE**
   - role/generation before mutation;
   - verification duration;
   - pass/block reason.

9. **MUTATION BUDGET**
   - max request age;
   - remaining E2E budget;
   - whether recovery/final mutation is still allowed;
   - 12-second mutation safety fence decision.

10. **WMS MUTATION**
    - target count;
    - exact-row count;
    - checkbox select duration/verification result;
    - foreign/stale/prechecked classification;
    - confirm-button wait duration;
    - dialog-ready duration;
    - one final business click timestamp.

11. **TERMINAL PROOF**
    - wait budget;
    - elapsed;
    - sample count;
    - first-signal latency;
    - fresh success/error surface counts;
    - same/mutated baseline terminal counts;
    - confirmed-marker target count;
    - final proof source: `FRESH_SUCCESS_SURFACE | ROW_CONFIRMED_MARKER | FRESH_ERROR | NO_PROOF`;
    - no row-disappearance success inference.

12. **POST TERMINAL CLEANUP**
    - clean-UI wait duration;
    - dirty state;
    - whether cleanup is on or off the critical ACK path.

13. **DURABLE ACK**
    - ACK start/end duration;
    - attempt count;
    - conditional-lost/recovered status;
    - durable result.

14. **TOTAL**
    - end-to-end total;
    - queue age;
    - batch duration;
    - result;
    - whether any evidence gap/drop occurred.

This stage breakdown is required so future optimization can identify whether latency belongs to queueing, rate-limit, WMS search, guard, HA fence, WMS dialog/terminal, cleanup or ACK.

## 11. D161 PickList optimization contract to protect with logging

Observability must explicitly prove these Owner-approved requirements:

- immediate DOM scan separates FAST READY from unresolved requests before slow Search/recovery;
- one ambiguous request never suppresses Search/recovery for a different missing/unselectable request;
- READY/other terminal outcomes receive early durable ACK before deferred recovery;
- unresolved requests share bounded recovery; no per-request F5 loop;
- max 15 is a ceiling, never an intentional “wait until batch fills” delay;
- duplicate listener/REST/batch deliveries do not cause duplicate WMS mutation;
- requests resolving to the same full PickList are grouped to one mutation target;
- recent terminal request dedupe remains effective;
- zero/unhydrated WMS data is `WMS_DATA_UNAVAILABLE`, never true NOT_FOUND/strike;
- WMS health proof requires a real hydrated/valid proof, not merely a responsive shell;
- multiple deadline gates preserve the 12-second mutation fence close to real WMS mutation;
- terminal observation remains passive and one-click-only;
- confirmed-marker proof and no-row-inference rules remain;
- schedule/control-plane state is distinguishable from temporary WMS mutation readiness;
- normal target remains 5–10 seconds E2E and hard PDA bound remains 20 seconds.

## 12. Upload backpressure and anti-spam

- Repeated identical incidents are fingerprinted.
- Local journals keep bounded evidence/counters even when immediate uploads are suppressed.
- Bundle suppression records `repeat_count`, first/last occurrence and the reason upload was suppressed.
- ERROR/business/confirm safety evidence has priority over low-value INFO/UI metrics when a journal is full.
- A failed older pending bundle blocks destructive prune of later evidence where ordering matters.
- Upload housekeeping cannot recursively trigger another upload boundary.

## 13. Global support-log collection

Existing D161 authority remains:

- only exact authenticated Agent logins `admin` and `tamnv2` expose the command;
- the Agent command is presented on the visible Settings Logs card and must not be hosted only on a detached page;
- backend revalidates authorization;
- one request has request_id, issued time, TTL and dedupe;
- only currently authenticated Web/Android/Agent clients respond;
- responders send unsynced evidence plus a current snapshot;
- Android/Agent use bounded jitter to avoid fleet burst;
- no per-device Firestore ACK write;
- Drive/archive arrival plus local diagnostics prove completion.

D161 v2 adds that every responder stamps the global request ID into the bundle `trace_id`, making one collection queryable across platforms.

## 14. Acceptance requirements

D161 must provide automated/fixture proof for:

- secret/redaction corpus: every banned credential/session/PL pattern is removed on client and server/archive layers;
- sequence/gap/drop accounting;
- Web reload retains bounded incident context;
- Android crash/restart retains bounded pre-crash context;
- Agent complete stream remains available locally if upload fails;
- intermediate buffer acceptance does not prune Android/Agent local evidence;
- Drive-synced confirmation permits prune;
- duplicate incidents do not cause one Drive file per repeated line;
- global collection correlates Web/Android/Agent by one request_id without per-device ACK writes;
- no logging feature increases Firestore/Google/WMS polling/listener cadence;
- business requests continue when logging is unavailable except where an existing mandatory safety/audit rule explicitly says otherwise;
- mixed-batch PickList fixtures and burst fixtures expose stage timings needed to verify the confirm contract.

## 15. Resource boundary

This design reuses existing scoped Beta resources and existing log archive/control paths. It authorizes **no new provider resource now**.

If D161 implementation proves that an additional persistent Firebase/Google/Cloudflare resource is unavoidable, stop that resource mutation, reconcile `ops/project-scope.json` and `ops/resource-registry.json`, perform impact/security/quota review and obtain Owner authority before provisioning.

Stable remains OWNER-GATED.


## 16. D161 integrity hardening approved 2026-10-04

### 16.1 Cross-platform archive idempotency
- Every sealable bundle has an immutable bundle_id.
- A logical boundary that can be re-entered (logout/session end, scheduled slot, Agent checkpoint/error boundary, global request) also carries a stable boundary_id or slot key.
- Trusted archive commit dedupes by logical bundle identity, not filename. Retry of an already archived bundle must converge to the existing durable object and DRIVE_SYNCED result without creating a duplicate Drive object.
- Web scheduled support checkpoints use a logical slot key rather than timestamped filename equality, so reload/re-entry cannot archive the same slot twice.
- Client-side single-flight is still required; server/archive idempotency is the final duplicate barrier.

### 16.2 Canonical severity/outcome semantics
- CONFIRMED and other expected business-success terminals are INFO/business evidence and do not create an immediate error bundle.
- Proven stale CAS/update-precondition conflicts are SUPERSEDED and do not degrade transport health.
- Temporary updater DNS/timeout/HTTP/channel-unavailable outcomes are DEFER/WARN; they remain locally recorded/compacted and do not by themselves create an immediate ERROR archive.
- Signer/hash/integrity mismatch, duplicate-mutation safety risk, confirmation-guard violation, post-click unsafe state, crash/fatal and comparable safety failures retain ERROR/INCIDENT/FATAL treatment.
- Repeated connectivity incidents are fingerprinted and compacted with first/last/repeat counters.

### 16.3 Confirm trace completeness
Once Agent has accepted/claimed a PickList request, its structured trace must converge to one explicit end class: ACKED_TERMINAL, SAFE_ABORT_PRE_MUTATION, UNCERTAIN_POST_MUTATION, HANDOFF, EXPIRED, or TRACE_GAP_DETECTED.

TRACE_GAP_DETECTED means evidence is incomplete. It never proves a business result, never releases a post-final confirmation guard and never authorizes a second WMS mutation.

### 16.4 Web journal session-generation isolation
Reload-surviving Web incident context is scoped to one authenticated session generation. Logout, account replacement or authoritative session-generation replacement rotates the journal. Old evidence may be archived under its original session identity but cannot be attached to the next user.

## D161 field-retest diagnostic completeness — WMS-not-ready and Agent control failures

For a PDA confirmation request observed by an authenticated Agent, local History and structured diagnostics must never remain blank merely because Web Confirm is not ready. The request trace records ingress and converges to the explicit pre-mutation terminal **WMS_SESSION_REQUIRED / WEB_CONFIRM_NOT_READY**, rendered to operators as **Web Agent chưa sẵn sàng**. Other known pre-mutation failures use bounded human-readable reasons rather than an empty result.

Agent bulk-revoke and Usage failures must preserve a bounded non-sensitive error code/class sufficient to distinguish authentication/session-contract failure from provider/network failure. Secrets, tokens and raw PickList values remain excluded. These diagnostics create no per-event provider write.



## D162 — usage telemetry policy

D162 measures comparable-load efficiency rather than raw daily totals. Required evidence is:
- external HTTP request count versus Durable Object request count;
- Durable Object storage rows read;
- Firestore reads/writes;
- Reporter queue/recent request counts;
- Agent listener payload versus REST watchdog/fallback reads;
- p50/p90 latency and transport/reconnect failures.

Repeated expected 4xx classes must be aggregated by route/status/error code when additional telemetry is added. D162 must not create a per-request provider log write or a new heartbeat solely for measurement.

## D163 — forced Picker logout final-log continuity

- A server-authoritative **Kích User** invalidates the Android Picker session immediately; business/realtime authority is never delayed to wait for logging.
- Android `beta-vc97` already routes the revoke signal through the normal logout pipeline and emits the existing `INFO / session_end_logout` bundle.
- The Worker may accept that final bundle after revoke only when all of these are true:
  - Firebase identity is an Android session;
  - the account base role is PICKER;
  - the token generation is exactly one less than the current authoritative Android generation;
  - source is `ANDROID`, severity is `INFO`, and reason is exactly `session_end_logout`;
  - the request is the runtime-log upload route.
- This exception never applies to business APIs, other log reasons, older generations, non-Picker roles, Web or Agent sessions.
- The accepted bundle follows the existing sanitization, InventoryCore-first persistence, logical boundary/bundle idempotency and archive retry rules. No new polling, heartbeat or provider write cadence is introduced.

## D165 log archive and noise controls

Status: implementation complete on the D165 Beta change set; automated technical validation PASS. Field/usage acceptance remains Owner-gated.

All Báo hàng Android/Web/Agent archive bundles must resolve to one canonical `YYYY-MM-DD` child under the scoped Beta Logs parent using Asia/Ho_Chi_Minh.

D165 requires:
- shared canonical folder identity across Worker and Agent Apps Script paths;
- race-safe find/create;
- `bundle_id` idempotency before Drive artifact creation;
- duplicate filename/content does not create a second archive artifact;
- Kích User persists the Android sanitized final session-end bundle locally before session cleanup and retries only through existing bounded delivery mechanisms;
- expected `SUPERSEDED` optimistic-concurrency losses with no health impact are aggregated diagnostics, not one ERROR archive per occurrence.

No password, token, WMS session material or other sensitive value may enter logs.

D165 does not add a logging heartbeat or per-event provider write cadence.

### D165 RTDB HA field-repair diagnostics (08/10)

The existing Agent local journal may record transition-only RTDB observer/write failure and recovery with a bounded non-sensitive `HTTP_<status>` or `NETWORK_<WebExceptionStatus>` failure class. Do not log request URLs, URL query parameters, ID tokens, Firebase credential content, passwords or payloads. Repeated RTDB SSE failures must not emit a new HA-coordinator wake every retry. No extra Firebase/Firestore request, listener, heartbeat, log upload or provider write may be introduced for this diagnostic. Evaluate usage by comparable active-PDA/confirmation intervals and component-specific fallbacks; PR/CI evidence does not prove billed-read reduction.

### 2026-10-08 — Accepted D165 log and instrumentation baseline / prospective D166 post-shift analysis

Owner has accepted D165 as deployed with Agent `v120` and current Android/Web logs. This **does not mean** existing RTDB SSE, Firestore fallback and unexpected PRIMARY role changes have passed reliability or quota analysis. For future D166, first ingest Owner-supplied Agent/Android/Web logs and hourly Firebase/Cloudflare usage after 22:00 Vietnam time, align records by **event timestamps** across the 06:00–22:00 shift (not archive upload time), correlate handoffs, RTDB failures, Firestore role/lease checks, active PDA and PickList volume, and classify verified causes versus hypotheses. Do not add polling, upload schedules, request logging or new telemetry providers without approved D166 impact/resource review. D166 is not opened by this D165 PASS-only continuity update.

### 2026-10-08 — SUPRA Shared Quota Governance (documentation-only)

Owner-approved alert policy: independently track each genuinely shared provider metric and Google Cloud USD 10/month **soft** budget, with 30/30/30/10 accounting and 70/85/95% warnings plus 100% escalation. Reports show project attribution, provider quota/billing-cycle clock, local Vietnam rendering, usage slope/forecast, source, and last-known freshness. On missing or delayed data show unavailable rather than zero. Deduplicate alerts and avoid new provider polling, log storms, scheduled per-client reads or background writes. Central reserve use and paid overruns require Owner decision. Do **not** cut critical logs, Picker notification ACK, Picklist confirmations, HA, or realtime as an automatic quota action. This is a policy specification, not authorization to add dashboards, alerts, probes, provider billing resources or runtime code. See `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`.

### 2026-10-08 — D166 Usage ZIP proposal gate (NOT IMPLEMENTED)

Owner requested research first on an Agent-only on-demand local Usage ZIP export for AI review. Existing support-log upload remains a separate explicit button and is not triggered by Usage export. Candidate ZIP must carry source/provenance, exact UTC/VN selected window, provider quota resets, freshness, partial/missing reason, and sanitized aggregates only — never secrets, WMS session state, employee/Picker identifiers or raw log dumps. No new regular polling, provider write, GitHub key, Cloudflare credential, Apps Script deployment or other service access is authorized. See `docs/D166_USAGE_EVIDENCE_EXPORT_PROPOSAL.md` before seeking implementation approval.

### D166 — Owner-approved on-demand Usage ZIP scope (2026-10-08)

The earlier proposal-only limitation is superseded by explicit Owner authorization to implement combined phases A+B and enable phase C evidence correlation. Agent Usage export is **manual click-only** and isolated from D165 WMS/HA/ACK traffic. The existing Beta Apps Script Gateway may read Google Monitoring aggregates for scoped Firestore, RTDB network bytes, Firebase Auth/FCM, Cloud Run and Sheets/Drive API, plus one Drive `about.get` storage snapshot. No Firestore document writes/reads, provider token embedded in EXE, recurring export, cloud storage upload, mass Drive scan or WMS-session collection is authorized. Cloudflare and Billing without independently verified low-cost authorized API use **dashboard links and manual screenshots**. Every ZIP must label N/A, missing series, delayed metrics, local-vs-provider quota-day and invoice-vs-usage distinction. Provider requests and local ZIP creation shall not block the confirm pipeline. The manually collected Agent/Web/Android logs are a separate source for D166 phase C analysis.

### D166 Cloudflare read-only evidence candidate — pending secure credential provisioning

The manual Agent Usage ZIP v122 candidate can include exact scoped `supra-inventory-beta` Workers Analytics, account-labeled Durable Object aggregate trends, and account-level Cloudflare Billable Usage records, when an authorized server-side token is configured. No new monitoring timer, business Firestore document traffic, Worker route or DO mutation; no fallback secrets in EXE. Source provenance, sampled/truncated/late data, provider-day versus VN day and mixed-account attribution are mandatory. No raw account/namespace metadata, credentials or billing payment data are exported. Account DO measurements cannot be attributed to Inventory. The Owner-created GitHub secret alone does not populate Apps Script Script Properties; API wiring is blocked pending verified secure provisioning and no production readiness is implied.

### D166 Worker-Beta Cloudflare Usage bridge (Owner approved)

Only manual D166 ZIP generation calls existing Apps Script Gateway, which forwards the Firebase ID token to a single new Beta Worker POST `/api/agent/d166/usage`. Worker checks project environment, live Agent credentials/roles/exact privileged login and time window before any Cloudflare upstream request. The Cloudflare read-only token exists only in GitHub Beta Environment until GitHub Actions installs it as **Worker runtime secret**; no new Apps Script properties. Worker API calls are bounded to an hourly-filtered single GraphQL query and one account billing query per explicit action (not a scheduled monitor). The exact Worker `supra-inventory-beta` is the only attributable script; DO account aggregate is blocked without InventoryCore namespace; billing remains shared account and is separated in ZIP. Never expose token, source account identifiers, payment data or unscoped project resources. Preserve existing D160 15-minute tab cache independently, HA/WMS/ACK, Firebase/RTDB, no new automatic polling or provider write. Missing/truncated/delayed sections are not zero. Runtime and Owner field PASS required before broader rollout.

### D166 Cloudflare Usage bridge verified deployment receipt

The scoped Beta Worker + existing Apps Script Gateway CI/deploy is technically PASS (Worker run `37816448917`; Gateway run `37815507761`; Agent v122 run `37815507718`). One prior unauthorized probe returned HTTP 404, repaired under D166 with post-secret source/env readback and bounded 10×5s auth retry, now `401 AUTH_REQUIRED`. Cloudflare token preflight and Worker secret name readback passed; **this is not proof of real privileged Analytics/Billing fetch**, which requires Agent field ZIP with per-section status and freshness. Keep DO namespace fail-closed, account Billing unattributed, no automatic polling, no secret logging/ZIP.

### D166 v122 on-demand ZIP field repair — 2026-10-09

On three manual clicks Agent reported `D166_PROVIDER_NOT_READY` while Gateway produced no usable JSON for ZIP. The Gateway D166 hourly Cloudflare aggregation references the missing `d166CloudflareNumber_` parser; restore it without altering the existing monitoring cadence, picklist confirm, business writes or Cloudflare polling volume. Null/missing, nonnumeric, negative and nonfinite metric values remain null (not zero); actual valid zero must remain zero. If Cloudflare returns 403/429/unavailable, complete the available provider ZIP with explicit status instead of treating the whole export as failed. CI must execute the actual Apps Script D166 export using mocked Cloudflare success and provider failure, preserving checksum/local-only Agent ZIP implementation. Owner field ZIP retry required; no field PASS yet.


### D166 Owner-approved zero-extra-call forensic audit (Agent v123, Android, Web; 09/10/2026)

**Scope:** new log fields and their local-only aggregation, with no service/HA business mutation. See `docs/D166_USAGE_AUDIT_2026-10-06_08.md`. v122 is the Owner-selected next Agent baseline. v123 must inherit its WMS/Firestore/RTDB behavior exactly. Existing versioned App/Web logging surfaces may gain bounded data only.

**Agent:** use existing `FirestoreQuotaGuard.Record` local estimates by method/component and VN hour; track REST attempts/elapsed/outcome in RAM after each existing attempt, never log a request/response body, URL with IDs, API secrets or token. `D166_USAGE_AUDIT` is a bounded header in the current Agent sealed log, with local process/partial-day source labeling, not provider billing. If source counters overflow, emit explicit overflow count. Do not conflate `Listen` callback delivery, REST operations and billed document reads.

**Android:** count existing HTTP attempt/status/elapsed by allowlisted route family in RAM (0 extra network/storage operation); report bounded journal window, sequence and dropped event count in existing local/manual/global-support bundle. Keep valid JSON on 16KB fallback instead of truncating serialized text; never upgrade from support-error into business crash. Counters reset on process restart; label partial uptime.

**Web:** aggregate already captured API/realtime/status/long task metrics only when the existing support bundle is constructed; preserve existing event listener and scheduled-log cadence. Do not retain new raw payload/headers/URL parameters. Never put credential/private/account numbers in public GitHub.

**Verification:** Agent/WMS/HA/ACK fields unchanged; compile & feature guards PASS; Android debug/release compile, Web typecheck and existing regressions PASS; no new import of provider SDK or periodic task; prove manual/scheduled upload counts unchanged; record median/P95 local CPU/heap/battery impact via representative field testing, and check bundle byte overhead bounded. Strictly zero new *provider requests and document operations*; a new field necessarily adds bounded payload bytes. Report N/A/unknown when billed Firestore Read attribution cannot be inferred from local estimates. Preserve Beta only, Stable OWNER-GATED.

**Provider drill-down needed before ANY fix:** Agent per-component Firestore GET/RunQuery/listener initial/relisten/lease poll/ACK and RTDB fallback, with hourly PDA-hours and Picklist throughput, compare provider Firestore 06/08/09 daily billable readings and GCP API method. User-facing bug/behavior changes are not authorized by this log-only scope.


## D166 — Duplicate daily Logs folders: source investigation and safe repair backlog (09/10/2026)

Status: **Owner requirement recorded, analysis/risk only. No code or provider mutation approved.** The D165 one-folder-per-Vietnam-day specification remains authoritative and field duplicate reports mean it is not yet proven operationally.

- Inspect both known folder creators: Worker `service/src/runtime-logs.ts#resolveRuntimeLogDailyFolder` and Apps Script `ops/apps-script/agent-log-gateway/Code.gs#resolveDailyLogFolder_`; their LIST→CREATE→re-LIST convergence, local 6-hour caches and script-only lock are not cross-system atomic guarantees. The exact real-world duplicate trigger must be established with provider folder IDs, parent IDs, timestamps, creator actor, source logs and deployed revisions before claiming root cause.
- Verify all archive entrypoints (Agent direct Gateway and fallback drain; Android/Web Worker), timezone midnight, delayed retry and distinct `BETA_LOG_FOLDER_ID` vs `LOGS_FOLDER_ID` scope consistency. Follow the existing canonical Beta Logs parent; no new folder/root in another project.
- Repair design must ensure a single authoritative daily folder ID and safe race/idempotent behavior across both writers, while keeping bounded Drive API operations and archived `bundle_id` semantics. Do not return `DRIVE_SYNCED` on intermediate staging or prune local evidence prematurely.
- Historical duplicates: audit and stage a non-destructive merge plan with file ID/hash/bundle identity before any move/delete. No automatic trash of pre-existing populated folder; Owner approval is required for cleanup.
- Add tests for cross-path simultaneous first upload, errors/races, 00:00 VN, cache expiration, network retries, Drive readback, no loss/duplication and no additional scheduled polling or impact to Picklist/ACK.

Reference: `docs/D166_APPROVED_BACKLOG.md` / `D166-LOG-FOLDER-DUPLICATE`. Stable Owner-gated.


### D166 Launcher on-demand buffer diagnostics (09/10/2026)

- A **ROOT real base-role** can explicitly inspect the existing last-seven-day Launcher runtime-log buffer through Beta Web Nhật ký / Log Android. Worker/InventoryCore return only counts of received / Drive-synced / pending / pending-with-error, first/last timestamp and sanitized error **classes** from at most 30 recent failed archive records; no raw log content, filenames, DeviceKeys, Drive file IDs, employee identifiers or OAuth credentials.
- Each user click additionally performs one metadata GET against the **already-configured** Launcher Drive folder using the **Worker's existing Drive OAuth refresh token**, reporting safe permission/status categories only. The OAuth check confirms folder metadata access/capability, not actual file archival.
- Do not auto-query on Web navigation, tab change, refresh or a recurring timer. Existing Web/Android/Agent realtime, support-log cadence, retention, transfer and archive paths remain unchanged. No new provider resources, no Drive mutations.
- Launcher logical date matching in server initial archive and queued retry is corrected to parse `YYYY-MM-DD`, not to silently interpret it as last-event date. Separate D166 duplicate folder write-race backlog remains owner-gated and unchanged.
- See `docs/D166_LAUNCHER_LOG_SERVICE_DIAGNOSTICS.md`. Field PASS requires owner-authenticated response, cause classification, actual Drive file creation/visibility and PDA `DRIVE_SYNCED` confirmation; CI is not runtime proof.


### D166 SQL Usage instrumentation — initial diagnostic candidate

Measure only three suspected DO SELECT hot paths via already-executed cursor counters. Save bounded aggregated per-hour metrics in DO isolate memory, not SQL/Firestore/R2/RTDB; no extra timers or reads/writes. Label measurements `ISOLATE_PROCESS_LOCAL_RESTART_RESETS__ESTIMATE_NOT_BILLING`. Existing authorized on-demand system metrics returns `d166_sql_diagnostics` with only query ID, 24–36h buckets, execution count, rows-read, rows-written, max and simple elapsed ms. Never collect query arguments, SQL result rows, SKU, PL, personnel, tokens, device IDs or raw errors. Do not mistake these partial counters for total Cloudflare DO account billing. Verify nonzero provider reports match relative trend only; expand coverage after safe sampling demonstrates hotspots.


### D166 integrated observability contract — staged Beta candidate, 2026-10-10

Integration PR #541 composes the initial three-query SQL instrumentation with the additional allowlisted `RECENT_STATUS_TOTALS` and `RECENT_ACK_TOTALS` queries (five total; measured existing cursors only). `d166_sql_diagnostics` returns bounded in-isolate hourly aggregates, execution count, cursor rowsRead/rowsWritten and elapsed sample measures: **PROCESS_LOCAL / RESTART_RESETS / ESTIMATE_NOT_BILLING**, not provider-authoritative billing, costs or claims of reduction. Reject SQL bind values/result rows and identifiable arguments. The approved Android ACK telemetry separates known HTTP 400/404/408/409/422 and whitelisted business error code families in bounded RAM, reports dropped/sampled counts, and never logs response text, SKU/PL or user/device identifiers.

The runtime-log path should converge through one InventoryCore/Worker canonical Vietnam-day folder authority; the existing Agent Apps Script transport may request the ID only via authenticated Beta Worker endpoint and must not independently list/create another folder. Web/Android use the same authority. Drive upload success and remote file confirmation remain preconditions before local log deletion. A principal access mismatch is an explicit partial failure with local retry—not an excuse to create duplicate dated folders. Historical duplicate folders are preserved pending separate Owner audit.

This is a branch-only technical candidate, not field proof that source captures are sanitized end-to-end. Before D166 Owner PASS, perform raw-export negative-PII scans across Agent/Web/Android, record bounded coverage gaps and upload results under existing log cadence only; no extra scheduled provider reads, no per-event remote writes and no added Android wakeups. After live quota sampling, decide DO/Firestore optimization with evidence under the same D166 gate. Stable OWNER-GATED.


### D167 — Owner-authorized code-only targeted attribution (10/10)

Continue D166 audit streams; do not create new scheduled request, heartbeat, Firebase listener, Firestore/RTDB read/write or per-event provider logging. Agent local bounded `d167_ha_events` counters add RTDB SSE/heartbeat error class, liveness freshness, PRIMARY lease fallback and takeover probe result to existing sealed audit. No tokens, URLs, WMS state, Picker/PL, raw provider response or trace identifiers are added.

InventoryCore D166 in-RAM SQL cursor samples expand from 5 to 15 allowlisted read queries, with executions/rowsRead/rowsWritten/latency and explicit restart/reset limitations. New DO ingress route diagnostics use *fixed family labels* only. Both snapshots are provided by the existing privileged Beta Worker/Gateway into the **Owner-clicked** Agent Usage ZIP via one extra read-only DO request per click, with no SQL at the diagnostic endpoint, no added timer or provider account analytics query. This source reports process-local estimates, not complete billable 24h rows; missing instance samples and provider Billing must be labeled unknown rather than zero.

The Gateway now groups hourly Monitoring by a valid provider interval start when available and otherwise the previous end-minus-1ms fallback; exports `NO_DATA` counts and warnings separately from failures. Partial/misaligned provider buckets are explicitly labeled and must be tested with synthetic 59:59/00:00 boundary fixtures. The D167 code-ready branch stays unmerged/undeployed until Owner approval.

## 2026-10-11 — Cross-provider diagnosis-first optimization guard

Every quota/performance proposal must use current Agent/Web/Android/Worker/DO/Firestore/RTDB/Drive source traces and a comparable-shift provider meter ledger, not merely local `D166_USAGE_AUDIT` or `d167_ha_events` counters. New SQL 15-ID and DO route samples and v125 manual ZIP are process-local estimates; total provider charge must come from actual matching provider billing/time-series, marking failed/no-data/missing as unknown. Assess no-change, direct hot-path optimization, and equivalent safe cross-meter reassignment, including local CPU, API/query cost and log bytes; never weaken realtime/HA/ACK/latency/security to meet a soft metric. Diagnose differences across all coupled clients, with bounded privacy-safe trace correlation and no new monitoring timer/provider writes. Detailed matrix: `docs/D167_SYSTEM_REVIEW_2026-10-11.md`.
