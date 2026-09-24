# REALTIME_NOTIFICATIONS — Canonical synchronization and notification rules

Status: **CANONICAL PRODUCT SPEC**.

## Authority

Business state is authoritative in Worker + `InventoryCore` SQLite. WebSocket/FCM/ACK telemetry are delivery/synchronization channels; they never become a second transaction store.

There is no offline business mutation mode. A disconnected client may display the last known read-only state but must not queue/create a business report or claim later success.

## Monotonic realtime event stream

InventoryCore maintains a monotonic sequence for foreground business synchronization.

Every realtime business event used by clients carries at least:
- `seq` — monotonic sequence;
- `event_id` / event identity;
- `event` / business event type;
- `scopes` — affected read models;
- `batch_id` where applicable;
- `batch_version` where applicable;
- bounded event metadata/snapshot data needed to patch the affected view;
- server timestamp.

`report_events`/audit remain durable business history. A dedicated sequenced realtime event read model may be used so existing historical event IDs do not have to be rewritten.

## Foreground WebSocket

- WebSocket is the foreground channel for Web and Android/PDA.
- Authentication uses a short-lived one-time ticket issued only after authenticated session validation.
- InventoryCore uses hibernatable WebSocket handling and tags by role/user/client.
- Business transaction commits first; broadcast failure must not roll back a successful business mutation.
- Client tracks the highest contiguous `last_seq` it has applied.
- Normal events update/patch only affected operational state; do not simulate a full page reload or click a refresh button as normal realtime logic.
- Duplicate/already-applied `seq` is ignored idempotently.
- If `seq > last_seq + 1`, client requests bounded delta events after `last_seq` and applies them in order.
- On reconnect, client first attempts bounded delta recovery from `last_seq`; if recovery is impossible/truncated/expired, it performs an authoritative reconcile and resumes from the current server cursor.
- Full-page reload is never synchronization logic.

## Delta API semantics

Authenticated clients may request a bounded event delta after a known sequence.

Response exposes:
- `after_seq`;
- ordered `events`;
- `latest_seq`;
- whether the requested gap was fully recoverable (`complete` or equivalent);
- bounded server limit/cursor metadata.

Role/user authorization still applies to returned event payload. Delta endpoints must not leak unrelated user-sensitive data.

## Critical Picker result lifecycle

`HAS_STOCK` and `SKIP_ALLOWED` are critical Picker results.

For each affected Picker/result event, track delivery/interaction stages separately:
1. authoritative result/notification event created;
2. FCM/server delivery attempt/acceptance metadata where available;
3. client `RECEIVED` timestamp;
4. client `DISPLAYED` timestamp;
5. explicit user `ACKNOWLEDGED` timestamp.

Rules:
- identity key includes target Picker + notification event + batch/version;
- updates are idempotent and monotonic (later stages cannot be erased by earlier replay);
- `ACKNOWLEDGED` is explicit user action, not inferred merely from opening the app;
- foreground WebSocket delivery can create the same receipt/ACK flow without requiring FCM first;
- business resolution/correction succeeds independently from any notification/ACK failure;
- Reporter/Admin may see aggregate ACK progress when useful, but unacknowledged users do not reopen the resolved batch.

## Background FCM

- FCM HTTP v1 is background best-effort delivery.
- Device registration is authenticated.
- Resolution/correction notifications target affected Picker users; new reports may target Reporter/Admin/Root as implemented.
- Critical Picker FCM data includes event/batch/version identity sufficient for the app to correlate receipt/ACK with server state.
- Report withdrawal does not require noisy FCM unless a later Owner decision changes it.
- FCM failure does not change business transaction success.
- Invalid/unregistered tokens should be disabled/removed when the provider response makes that determinable.

## D070 timing notifications and automatic Skip

Timing is server-authoritative and has three ordered thresholds: `warning < escalation < auto_skip`.

- Warning: server emits one idempotent warning transition per eligible batch; Reporter/Admin/Root receive foreground indication and a bounded background alert. Picker does not require a warning toast.
- Escalation: server emits one idempotent overdue transition per eligible batch; Reporter/Admin/Root and currently affected Picker(s) receive the higher alert.
- Multiple same-level transitions processed together may be grouped for Reporter/Admin/Root background notification to avoid alert storms. Exact Picker critical result identity is never grouped.
- No sound is required.
- Warning/escalation remain attention signals and do not change D007 queue ordering.
- If automatic Skip is disabled, the third threshold remains configured/displayable but performs no resolution.
- If enabled, service authority may create `SKIP_ALLOWED` at the third threshold. There is no Picker resolve API.
- `FIRST_REPORT`: the batch deadline is anchored to the first report; all active Picker tickets receive the service timeout result together.
- `PER_PICKER`: each ticket deadline is anchored to that Picker's report; only that Picker receives the timeout result/ACK target. The batch remains pending for other active Pickers and finalizes when none remain.
- Automatic result source is `SYSTEM_TIMEOUT`; normal Reporter result source remains distinguishable.
- Automatic result retains the existing five-minute Skip→Có hàng correction path.
- All transition/result events are audited, idempotent and delivered through the existing realtime sequence + FCM result lifecycle.
- Durable Object Alarm drives deadlines; client-side timers are display-only and no polling loop is required.
- Existing work is not retroactively given an automatic deadline on first D070 activation/re-enable/mode switch; disable cancels pending automatic deadlines.

Legacy two-threshold configuration never silently enables auto-Skip.

## Recurrence events

A new same-SKU episode after a resolved episode is represented by a new batch with recurrence metadata (`previous_batch_id` or equivalent). Realtime may surface a recurrence marker, but never mutates the previous finalized batch back to pending.

## Authenticated online presence (D063)

- Realtime presence is derived from currently open authenticated WebSocket connections accepted by `InventoryCore`.
- A user is online only while a valid authenticated realtime connection is active. Account `ACTIVE` status alone is not presence.
- Logout, session invalidation, explicit role change closure and socket disconnect remove that connection from presence.
- Multiple concurrent connections for the same user under the same effective role count as one online user for that role; session count may be higher than user count.
- Admin/Root may read aggregate presence totals by effective role and client type for operational overview. Picker/Reporter do not receive a global presence directory.
- Presence is ephemeral and is not historical attendance/timekeeping data.


## Acceptance state

Technical registration/delivery foundation from the previous baseline is not enough for this rebaseline. Acceptance now requires:
- event sequence generation and ordered delta API;
- Web and Android sequence-gap recovery;
- no normal refresh-click/full-page synchronization behavior;
- critical receipt/display/ACK API + UI flow;
- FCM correlation metadata;
- Beta runtime smoke for the above.

Physical logged-in PDA delivery/display/explicit ACK remains a separate field acceptance level after technical PASS.
## Result-event projection integrity

Critical result payload is immutable per `result_event_id`.

- A correction creates a new result event/version; it must not rewrite the earlier event's resolution, timestamp, SKU/product snapshot or ACK identity.
- Picker delta/WebSocket projection is scoped to the authenticated Picker principal. A Picker must not receive another Picker's ticket, actor identity, employee code, ACK state or aggregate operational detail merely because both tickets belong to the same batch.
- Picker realtime frames expose only Picker-relevant scopes and a role-projected snapshot; Reporter/Admin/Root may receive the broader operational projection allowed by RBAC.
- Event `batch_version` is the version captured when the event was emitted. A newer current batch version may be exposed separately but must not replace the historical event version.
- Result notification targets are the exact result-event targets; a Picker withdrawn before resolution is not a result/FCM target.
## Global scan cursor and applied cursor

The realtime sequence is global to InventoryCore. A role-authorized client stream is therefore not required to contain numerically contiguous event sequences.

Server delta contract:
- `cursor_seq` is the highest global sequence position the server scanned for that page, including rows filtered out by role/user projection.
- `has_more` means additional global rows remain after `cursor_seq`.
- `stream_epoch` identifies the current realtime sequence epoch.
- `retained_from_seq` is the oldest retained global sequence when history exists.
- `resync_required` explicitly distinguishes an unrecoverable cursor/epoch/retention condition from ordinary pagination.
- `resync_reason` identifies at least epoch change, cursor ahead of stream, or cursor before retained history.
- `complete` may remain only as backward-compatible pagination metadata; new clients must use `has_more` and `resync_required`.

Client contract:
- keep an **applied cursor**, not merely the highest sequence received or scanned;
- apply/refresh the affected authoritative read model first, then persist the returned page/socket cursor only after that application succeeds;
- a failed read-model fetch leaves the applied cursor unchanged and marks recovery dirty so retry occurs even if no later realtime event arrives;
- serialize realtime application per authenticated session so overlapping callbacks cannot acknowledge state out of order;
- a global sequence gap may contain only events belonging to other principals and must be recovered through delta scanning rather than treated as missing authorized data;
- page-budget exhaustion schedules bounded continuation/recovery; it never marks unseen pages as applied.

## Android correlated background-delivery contract

- Android background FCM uses high-priority **data messages** for operational notifications so the app's `FirebaseMessagingService` receives the correlation payload and owns local notification presentation.
- The data payload carries bounded presentation text plus `event`, `result_event_id`, `batch_id`, `event_seq` and `batch_version` where applicable.
- `onNewToken` stores the rotated token locally; the next authenticated app lifecycle registers the latest token against the current device/user.
- A received critical `result_event_id` is retained locally until the authenticated Picker can report at least `RECEIVED`; opening/resuming the app reconciles that signal with authoritative state.
- Provider acceptance/failure is recorded separately from client receipt/display/ACK. Provider acceptance is never treated as Picker acknowledgement.
- Delivery-attempt telemetry is bounded and correlated to event/device/user where known.
- Provider responses that identify an invalid/unregistered token disable that token from later targeting.
- Foreground WebSocket/delta remains the live synchronization channel; FCM is not a second business-state transport.

## Timing clock progression without polling

- Reporter queue responses include authoritative `server_now`, `warning_at`, `escalation_at`, and where applicable the next automatic-Skip deadline.
- Web and Android calibrate local presentation time from `server_now` and may advance waiting labels locally.
- Local ticking is presentation-only: it never grants Skip, mutates state or changes queue priority.
- Durable Object Alarm performs authoritative warning/escalation/automatic-Skip transitions even when no client is open.
- Any subsequent authoritative response replaces local presentation state.


### D070 runtime alarm availability guard

D070 authoritative deadline transitions must not create a tight alarm loop or depend on downstream notification delivery.

- If a batch is first observed only after the escalation threshold, the warning stage is consumed without emitting a late warning; this prevents the already-past warning deadline from being re-scheduled indefinitely.
- Catch-up processing per alarm is bounded and the minimum re-arm delay is one second. Minute-level business thresholds and result semantics are unchanged.
- Authoritative database transitions and the next alarm schedule occur before best-effort realtime/FCM delivery.
- Realtime/FCM provider failure must not throw an already-committed alarm and cause platform retry storms. Clients recover from authoritative state through normal cursor/reconcile reads.
- Exact Picker result targeting, grouped Reporter/Admin/Root notices, correction rules and Stable OWNER-GATE remain unchanged.


### D072 no system-status monitoring loop

- Normal Web runtime must not poll `/api/admin/system-status`.
- No 60-second system-status timer exists after D072.
- Normal admin system-status API access is disabled before any InventoryCore/provider metric collection.
- Beta load-test snapshot remains temporary/gated and uses core-only metrics; it must not refresh Google Drive or GitHub provider usage.
- Realtime business synchronization, header connectivity state and runtime logs remain unchanged.


## D073 — Firebase relay POC channel

The D073 test channel is independent from InventoryCore business realtime and exists only to prove PDA ↔ Office-laptop transport.

- Beta RTDB instance: `supra-inventory-beta-default-rtdb`, location `asia-southeast1`.
- Path: `relay_poc/{firebase_uid}/jobs/{request_id}`.
- Both PDA and the POC Agent authenticate with Firebase ID tokens; Rules require `auth.uid == {firebase_uid}`.
- Request fields are bounded to test metadata: `request_id`, five-digit `suffix`, `status=PENDING`, client send timestamp and source marker.
- Agent may PATCH only test response metadata such as `status=ACK`, machine identifier, current SSID label and ACK timestamps.
- Never store passwords, WMS cookies/tokens, Firebase refresh tokens, access tokens, private keys or company-system credentials in RTDB.
- The Android client measures end-to-end round-trip locally and deletes the test job after ACK/timeout.
- The Agent uses REST streaming/SSE (`Accept: text/event-stream`) so Office transport is tested without LAN connectivity to the PDA.
- This channel must not be reused as an offline mutation queue for Báo hàng.


## D074 — Relay identity and diagnostics repair

- RTDB path stays `relay_poc/{firebase_uid}/jobs/{request_id}`; `{firebase_uid}` is derived from the verified Firebase ID-token subject (`sub`) by each client.
- Android application `user_id` and Firebase UID are distinct concepts and must never be assumed equal for relay authorization.
- Windows refresh-token exchange may update the ID token, but the RTDB path key is re-derived from the refreshed token subject.
- A 403 response after successful HTTPS reachability is classified as `RTDB_PERMISSION_DENIED`; diagnostics must include method, host/path without query credentials, HTTP status, elapsed time, Firebase error text, token audience and a bounded hash/fingerprint of UID where useful. Raw tokens and passwords are forbidden from logs.
- Windows Agent keeps a local run log under the current-user application-data directory and offers an explicit open-log action for field support.


## D075 — Shared ADMIN relay queue

D075 replaces the D074 per-Firebase-UID relay tree with a shared Beta transport queue:

`relay_poc/jobs/{request_id}`

Each PENDING job contains request id, five-digit suffix, source, Picker Firebase UID, Picker application user id and client timestamp. The owning Picker can wait on the exact job path. ADMIN Agents may subscribe at the shared `jobs` collection. ACK adds the ADMIN application user id, machine, persistent Agent instance id, network and timestamps. Rules enforce first-PENDING→ACK ownership so parallel Agents cannot overwrite a prior ACK.

The shared queue remains a transport POC only and is not an offline business queue.

## D078 — Relay transport discovery

D078 does not change the active D075 relay transport. It adds field diagnostics to decide which Google-hosted transport, if any, can replace RTDB for the Office-side Agent. Candidate order is Firestore REST first, Apps Script web/API second, with Sheets/Drive only as lower-priority fallbacks because they require polling/Workspace OAuth and are not realtime relay primitives.

Until Owner field evidence is collected, RTDB remains the implemented Beta POC transport and no new relay resource is authoritative.

## D082 — Relay result metadata

The existing D075 shared RTDB relay remains the home-test transport. D082 does not create a new provider or offline queue.

Agent ACK may add only bounded lookup metadata:
- `lookup_status` — allow-listed classification (`FOUND`, `NOT_FOUND`, session/transport/permission/schema/error classifications);
- `lookup_matches` — bounded numeric count;
- `lookup_ms` — bounded lookup latency;
- `lookup_route` — safe route label;
- `lookup_http` — HTTP status code.

No full Picklist identifier, WMS response body, WMS session value, signature/nonce, password or credential is stored in RTDB. The five-digit suffix remains the already approved bounded POC request value. First-writer ADMIN ACK ownership remains unchanged.

## D085 relay availability/failover signal

The confirmation-path relay uses a bounded Agent heartbeat/leader record for operational availability. It is not a second business store and does not alter Báo hàng realtime semantics.

- Active Agent heartbeat interval: 3 seconds.
- Failover threshold: 10 seconds.
- PDA may read leader availability and job `SWITCHING` state to present no-Agent/failover guidance.
- No Agent availability signal may authorize WMS mutation.



## D087 minimal Agent presence

The temporary Beta relay may maintain a small ADMIN-only presence set solely to render total online Agents.

- Each running authenticated Agent writes its own bounded presence no more often than every 30 seconds.
- Each Agent reads the bounded presence set no more often than every 60 seconds and counts entries fresh within 90 seconds.
- Presence contains no PDA request/response counters, Picklist suffix, password/token/session value or WMS payload.
- Per-machine APK received/Agent response overlay counters are RAM-only; there is no global counter synchronization.
- This presence optimization does not select or approve the final D078 transport and does not change the D085 3-second leader heartbeat required for 10-second failover.

## D089 — Service reachability is not realtime reachability

- **Dịch vụ** represents authenticated HTTP/API availability.
- **Đồng bộ** represents realtime/WebSocket transport state.
- Realtime `offline` or `reconnecting` must never set HTTP service state to unavailable.
- A successful authenticated API response marks the service reachable.
- Browser/network offline may mark service unavailable.
- The Web may truthfully show `Dịch vụ: Hoạt động | Đồng bộ: Mất realtime` when APIs work but the realtime channel is down.
- D089 does not add quota-heavy provider polling; realtime reconnect remains bounded/event-driven.

## D090 confirmation relay transport constraint

For the separate Picker `Xác nhận đơn` / Windows Agent workstream only:

- Office transport discovery no longer tests or proposes the Cloudflare Worker/custom project host; Owner field evidence defines Office as internal-Supra plus selected-Google reachability.
- Firebase RTDB is not a valid Office carrier because the corporate proxy repeatedly blocks it with HTTP 403.
- Google-hosted candidates may be evaluated only after their host is reachable. Host reachability alone is not relay acceptance.
- Firestore is the preferred next candidate inherited from D078. A Beta proof must validate authenticated request creation/claim/result delivery, sticky ACTIVE Agent semantics, approximately 10-second failover, no-Agent state, bounded retries/idempotency, and quota-safe heartbeat/listen behavior before it can replace RTDB.
- Apps Script, Sheets and Drive remain fallback research candidates, not selected realtime authorities.
- The normal Báo hàng realtime architecture is unchanged. This exception does not create offline business mode or authorize WMS mutation.

## D091 Firestore field transport implementation

D091 turns the D090 preferred candidate into a bounded Beta field proof.

- Android creates exactly one authenticated document in `relay_poc_jobs`, polls only that document while awaiting ACK, then deletes its own test document.
- The Windows Agent polls the bounded relay collection every 3 seconds only while its relay listener is active and ACKs a valid `PENDING / ANDROID_D091` job.
- Firestore REST uses `Authorization: Bearer <Firebase ID token>`; Firestore Security Rules enforce PICKER create/get/delete ownership and real-base ADMIN list/update authority.
- The field ACK is `TRANSPORT_ONLY`. It proves connectivity/audit identity and must not be presented as a WMS Picklist result.
- D091 intentionally does not implement Firestore HA. D085 sticky ACTIVE/10-second failover remains a required later gate if Firestore E2E passes. The final design must avoid a naive per-Agent 3-second Firestore write heartbeat.
- No automatic RTDB or Cloudflare fallback is allowed during D091 field acceptance because it would create a false Firestore PASS.

## D092 Firestore confirmation lifecycle

The selected Office carrier for `Xác nhận lấy lại đơn` is Cloud Firestore. It remains separate from the normal Báo hàng realtime/InventoryCore channel.

- Request source is `ANDROID_CONFIRM_V1` and contains only request id, five-digit suffix, Picker identity and client timestamp.
- Job state is `PENDING → PROCESSING → ACK`. A real ADMIN Agent may claim `PENDING → PROCESSING` only through a conditional Firestore write; only the owning ADMIN may complete `PROCESSING → ACK`.
- Only the Firestore sticky ACTIVE Agent polls the job collection. Standby Agents maintain bounded coordination/presence but do not poll/process business jobs.
- The PDA polls only its own request document while awaiting completion. It may conditionally delete a job only while it is still demonstrably `PENDING`; it must not delete a `PROCESSING` job.
- ACK contains bounded result/timing/cache/rate metadata only. It never contains the full PickListCode, raw WMS response, WMS session/header values, signature/nonce, password or other credentials.
- Firestore collections `relay_poc_rate_limits`, `relay_poc_coordination`, `relay_poc_agents` and `relay_poc_confirm_guards` are real-base-ADMIN-only support state. They are not an offline business store.
- Confirmation guard document ids are non-reversible hashes of the full PickListCode. `CONFIRMED` makes retries idempotent; an uncertain/in-progress guard fails closed instead of replaying WMS mutation.

D092 does not change Web/PDA shortage-notification semantics described elsewhere in this spec.


## D097 — quota-safe Firestore confirmation delivery

For Picker `Xác nhận đơn` only:

- Android creates one authenticated `ANDROID_CONFIRM_V1` Firestore job and listens only to that exact document.
- Firestore offline persistence is disabled for this business transport; no offline confirmation mutation queue is allowed.
- Listener lifetime is bounded to the request window. The first unresolved 10 seconds are PRIMARY time; after that the UI may show standby failover. Terminal automatic wait is 30 seconds.
- PRIMARY business polling is 5 seconds; STANDBY is 10 seconds; FROZEN Agents do not poll business jobs.
- Firestore job lifecycle is direct `PENDING → ACK`; D097 removes the quota-heavy `PROCESSING` claim write.
- ACK is conditional against the document version read by the Agent. A competing Agent that loses the conditional ACK must not create a second authoritative result.
- WMS mutation is still protected separately by the hashed full-PickListCode confirmation guard. The first guard creation is the durable mutation authorization; the retained originating ACK proves confirmed idempotency without a second guard-confirm write.
- Network-address changes start a bounded Windows transition state and staged default/system proxy refresh. Transient DNS/proxy loss preserves the assigned Agent role rather than declaring an immediate failover.
- Requests older than 30 seconds are skipped as new automatic work and require specialist handling.


## D098 — Web realtime session repair and Cloudflare budget ceiling

- Web HTTP API and WebSocket realtime use the same `supra_inventory_interactive_session_v2` authority. The legacy `supra_inventory_beta_session_v1` lookup is forbidden.
- Realtime stays on the InventoryCore hibernatable Durable Object WebSocket; Báo hàng is not migrated to Firestore.
- Normal realtime is push-first. Client polling is not a substitute for a healthy socket.
- Reconnect uses bounded exponential backoff with jitter. Reconnect/ticket loops must not create a request storm.
- After reconnect, client resumes by last applied sequence and bounded delta recovery; authoritative full reconcile is used only when sequence retention/epoch requires it.
- Server-originated realtime events are role/user scoped and must never weaken RBAC merely to close a sequence gap.
- Inventory's design maximum must project to no more than **35% of each included Workers Paid $5 metric** (Worker requests/CPU, Durable Object requests/duration/SQLite rows/storage as applicable). A metric above 35% fails D098 quota acceptance even when other metrics are lower.
- Hibernation and event-driven delivery are required to preserve the budget. Normal runtime must not add system/provider polling solely for monitoring.
- This Cloudflare budget is independent from the later Firestore PRIMARY/STANDBY quota optimization workstream.

## D101 — Agent HA visibility and quota-safe counts

- D097 HA remains request-driven: PRIMARY handles immediately, STANDBY becomes eligible to take over only when a pending confirmation request is at least 10 seconds old, and FROZEN does not poll business jobs.
- Lack of PDA work does not trigger a high-frequency liveness heartbeat merely to rotate PRIMARY. The UI must explain this so a STANDBY/FROZEN observation is not mistaken for a missing business path.
- Agent fleet counts are derived from the existing bounded Firestore presence data and refreshed at low frequency. D101 must not introduce fast global Agent polling.
- Web realtime presence continues to count only interactive `WEB` and `ANDROID` clients. Agent sessions are a separate Firebase/Firestore channel and must not contribute to Web `Người đang online` totals.
## D102 — Agent fleet refresh and after-hours notices

- The Agent fleet UI uses bounded Firestore presence metadata plus the authoritative coordination role snapshot. It must not create per-second/global presence polling.
- PRIMARY and STANDBY role metadata refresh every 60 seconds; FROZEN every 5 minutes. Startup performs four additional 5-second convergence cycles.
- Presence writes are every 15 minutes, fleet reads every 30 minutes, freshness is 40 minutes, with a bounded immediate refresh request when Tổng quan is opened.
- The 21:30 after-hours warning is a local Windows/Agent notification and repeats every 5 minutes until a decision. It does not require a Firestore write per warning.
- While the 22:00–05:00 business gate is paused, the Firestore confirmation transport performs no pending-job query. The local gate may recheck frequently because those checks are local and quota-free.
- D097 Android one-document listener, 5s/10s PRIMARY/STANDBY job polling and 10-second request failover are otherwise unchanged.

## D104 — Batch transport/quota behavior

- D104 does not increase Firestore polling frequency. PRIMARY remains 5 seconds, STANDBY 10 seconds and FROZEN does not poll business jobs.
- A single poll may return multiple eligible PENDING jobs. Up to 12 are processed as one logical batch so cache lookup, exact resolution and WMS mutation can be shared.
- No extra Firestore query is added merely to wait for more jobs. Jobs arriving after a poll are handled by the next normal poll.
- WMS confirmation uses chunks of at most 10 exact full PickListCodes. Firestore confirmation guards and conditional ACKs remain per PickList/job, so transport observability and Android correlation do not become batch-global.
- Manual comma-search uses the same single-flight cache refresh coordinator; one user action cannot trigger one WMS refresh per search term.

## D105 — Four-digit Firestore confirmation compatibility

- New Android requests keep source `ANDROID_CONFIRM_V1` and the existing snapshot listener semantics; only suffix length changes from 5 to 4.
- Firestore Rules admit 4-digit current requests and bounded 5-digit legacy requests during beta-vc62 → beta-vc63 rollout. This is compatibility only; beta-vc63 UI itself emits exactly 4 digits.
- D097 PRIMARY/STANDBY polling and the 30-second Android listener window are unchanged.
- No extra Firestore reads/writes are introduced by D105.

## D109 global SLA configuration propagation

- SLA warning/escalation/automatic-Skip settings remain one server-authoritative `app_config` value shared by the whole system. They are never stored as per-user browser preferences.
- A successful Admin/Root SLA update emits a bounded realtime scope for `sla_settings` (and affected reporter queue state). An active SLA page reconciles from the authoritative server value.
- This propagation is event-driven; D109 does not add background SLA polling.
- Existing deadline semantics, D070 modes and D098 realtime budget guards remain unchanged.

## D110 Android Reporter local clock and reconciliation

- Android Reporter calibrates presentation time from the queue response `server_now`.
- Waiting-minute/SLA labels are recomputed locally at the next calibrated minute boundary and then once per minute while the Reporter screen exists.
- The local ticker makes **zero** network/provider calls and performs no business mutation. It is presentation-only and stops with the Reporter controller.
- Reporter queue/recent data continue to reconcile only on initial load, authoritative realtime scopes and bounded post-mutation reconciliation; no new polling loop is introduced.
- The manual Reporter refresh control is removed.

## D111 — Android scoped reads do not add polling

D111 changes only the row set returned by existing Android reconciliation requests. The App adds `scope=APP_TODAY_OPEN` to the existing Picker-report and Reporter-recent reads; it does not introduce a new endpoint, timer, provider listener, or polling cadence. Reporter pending realtime scopes continue to refresh the unresolved queue, and Reporter recent / Picker report scopes reconcile the bounded today-plus-unresolved projection. The local SLA minute ticker still performs zero network/provider calls.

## D112 — New-shortage Web notice

- A committed `REPORT_CREATED` realtime frame is sufficient for authorized Web operator roles to show an immediate in-page toast.
- When the Web page is hidden and Browser Notification permission is already granted, the same event may create a background browser notification.
- Same-SKU events are locally coalesced within a short bounded window to avoid notification spam. This is presentation-only and never changes report/batch grouping.
- D112 adds no polling. Authoritative reconciliation remains the existing sequenced realtime/delta path.

## D113 — Pending-count notification badge

D113 keeps D112 `REPORT_CREATED` realtime delivery unchanged and adds a local Web navigation badge for **Xử lý báo hàng** using the already loaded authoritative Reporter queue. New reports continue to produce the existing foreground toast and, when an authorized tab is hidden and browser permission is granted, a Browser Notification. The badge is updated during existing queue reconciliation; D113 introduces no polling loop, faster provider cadence or additional Firestore reads/writes.


## D114 — Global Web queue badge realtime reconciliation

- `REPORT_CREATED` / reporter-queue realtime frames remain the trigger; no timer/polling cadence is added.
- REPORTER/ADMIN/ROOT refresh the authoritative reporter queue when a reporter-queue/recent scope changes even if the active Web section is not **Xử lý báo hàng**.
- The global **Xử lý báo hàng** navigation badge updates from that authoritative queue immediately after the event-driven refresh.
- Existing foreground toast and hidden-tab Browser Notification behavior is preserved and independent from the badge refresh.


## D115 — Confirmation latency and ACK reliability

D115 supersedes only the PRIMARY polling cadence of the earlier D097/D104/D114 confirmation transport contract.

- Healthy PRIMARY business polling is **2 seconds**. STANDBY remains **10 seconds** and may process only a request old enough for the existing 10-second takeover rule. FROZEN does not poll business jobs.
- The faster cadence is restricted to the one elected PRIMARY while business processing is enabled. Android remains listener-driven and adds no polling cadence.
- No PROCESSING/claim write is introduced. PENDING → ACK remains the single terminal job update and uses the existing conditional update-time guard.
- Android request cleanup is asynchronous and UID-scoped. It must not execute synchronously before a new job create.
- A timed-out Android listener performs one bounded server read of the same request before returning the 30-second specialist-desk fallback.
- Agent ACK recovery may retry/verify only the Firestore ACK. The WMS confirmation handler is executed once per guarded business attempt; ACK retry must never resend the WMS mutation.
- On an uncertain ACK write, Agent checks the job document. If terminal ACK is already visible, delivery is considered recovered; otherwise bounded retry may continue.
- Latency telemetry is redacted and includes queue age, business batch time and ACK time. It must not contain the entered PickList suffix/full code, credentials, tokens or WMS session material.
- Healthy-path acceptance target: without failover or external WMS/network degradation, Android request creation through terminal Android result should be **<5,000 ms**.
- SQLite remains 11 and Stable remains OWNER-GATED.

## D116 — Quota-balanced Firestore confirmation cadence

- D116 supersedes only the D115 PRIMARY interval: PRIMARY confirmation polling is **3 seconds**, STANDBY remains **10 seconds**, request failover remains **10 seconds**, and FROZEN performs no business-job polling.
- Only the single elected PRIMARY may run the 3-second business query, and only while business processing is enabled. Quiet-hours pause still suppresses pending-job queries.
- Android remains listener-driven for its one request document and gains no polling loop. The D115 bounded final server ACK read remains terminal-timeout recovery only.
- No PROCESSING state/write, no global/coalescing wait query, no extra provider, no new Firestore collection and no faster presence heartbeat are permitted.
- The 3-second cadence is deliberately bounded between D115's 2-second latency-first setting and the older 5-second quota-first setting. Healthy-primary field acceptance remains **<5,000 ms**; failure of that target fails D116 field acceptance.
- Selected-SKU affected-Picker visibility on Web is InventoryCore/Web presentation behavior using the existing prefetch/cache and must not alter this Firestore cadence.

## D117 — Agent fleet liveness and operating-window notices

- Agent HA liveness for the PDA confirmation path is Firestore-only.
- PRIMARY emits a generation-scoped lease every 7s. STANDBY uses that lease as the proactive death detector; FROZEN does not observe business jobs.
- A lease timeout at 10s is independent of PDA request creation. Role changes are fenced by generation before WMS mutation.
- WMS is not used as a periodic heartbeat and must never be probed on the 7s lease cadence.
- 21:30 and later HH:30 overtime warnings are local PRIMARY UI/tray notices every 5m until the upcoming boundary is decided. They create no WMS traffic.
- Fleet schedule decisions are propagated through existing Firestore coordination state. Outside the active relay window, PDA relay is frozen while direct/manual Agent operations remain available.

### D117 final control propagation

- Schedule state is piggybacked on the existing generation-scoped PRIMARY lease; this does not create a new provider, collection or business polling path.
- A schedule decision forces an immediate PRIMARY lease write. STANDBY therefore receives late overtime/stop state through its existing lease read.
- FROZEN control-role refresh is 30s outside relay operation solely for early-start topology convergence; it does not query the PDA business queue.

