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

## D118 — Overtime decision reconciliation

- Any authenticated Agent may submit an unresolved overtime decision through existing Firestore coordination state.
- During decision windows each Agent refreshes shared schedule state independently; near the boundary refresh becomes bounded-fast so a decision made on another machine is reconciled before freeze/continue evaluation.
- A conflicting second decision is never last-write-wins; it must display the existing authoritative decision.
- This control reconciliation introduces no business queue polling and no WMS health polling.

## D119 — Event-driven Picker presence and critical PDA commands

- Picker operational presence is event-driven, not heartbeat-driven. It derives from a valid Android session plus registered Android notification device and is removed on logout/session replacement/disable/expiry.
- A compact Firestore presence projection is allowed for Office-capable Agent reads. PRIMARY uses a bounded near-realtime refresh; non-primary Agents use coarse refresh (target around 30 minutes). No 500-PDA periodic heartbeat is permitted.
- High-priority FCM remains the background wake mechanism. No persistent 05:00–23:00 socket or foreground service is kept merely for waiting.
- The alert/session window is server-authoritative at 05:00–23:00 Asia/Ho_Chi_Minh. Android login/refresh and new Android business mutations are denied while closed; the client schedules best-effort logout against the server-reported boundary.
- Quản trị Invent/Root Web may explicitly extend the App/PDA window in one-hour increments. An active extension adds one hour; if the normal window is already closed and no extension is active, an explicit late-overtime action starts one hour from server time.
- Xác nhận đơn remains its accepted Firestore request/ACK path, but the Android client checks the same server window before creating a new request document.
- Critical shortage alerts may request a transient overlay when the user has granted Android's display-over-other-apps permission. If unavailable, the accepted high-importance notification path remains the fallback.
- Healthy-path delivery may target approximately 3 seconds but is not represented as a hard Android/FCM guarantee. Telemetry distinguishes server send, FCM receive and display.
- Picker-contact commands are additive, idempotent, TTL-bounded and server-authorized. FCM tokens remain private service data and are never exposed in Agent-readable documents.
- Xác nhận đơn keeps the accepted Firestore request/ACK workflow and is not converted into the new shortage/alert path.

## D120 — Single cross-app Picker result surface and durable acknowledgement

- FCM remains the background wake path. D120 adds no Android polling or heartbeat.
- Only authoritative Picker result events carrying a `result_event_id` may project the canonical red/blue `overlay_alert` surface over other apps. Agent-to-Picker locked commands remain their existing separate command overlay.
- `report_created`, SLA warning/escalation and summary notices remain normal Android notifications; they do not create a competing full-screen result UI.
- Result FCM payload contains bounded business display data (`sku`, `product_name`, `resolution`) plus the existing result-event correlation. Secrets/tokens are forbidden.
- While a cross-app result overlay owns an unacknowledged result event, the Picker controller must not open the same in-app result dialog. If overlay permission is unavailable, existing notification → in-app result fallback remains.
- Pressing **XÁC NHẬN ĐÃ NHẬN** acknowledges the existing result event only. A network/session failure leaves a durable local ACK retry marker; authenticated App resume retries it. This transport recovery must never recreate the shortage resolution or replay any WMS mutation.

## D125 — Office Firebase bridge after PickList retirement

- The Firestore PickList request/ACK/confirmation path is retired from the target product model.
- Firestore may be reused for Office-reachable Inventory projections, commands, presence and notification support where the Office network can reach Google/Firebase.
- InventoryCore/Worker remains authoritative for Báo hàng business state; Firestore must not become a parallel transaction authority.
- Office bridge messages must be bounded, role-scoped, idempotent where necessary and must not contain Supra/WMS session material.
- Existing FCM delivery for Báo hàng and approved Picker-contact commands remains available where still required.
- Legacy PickList relay/HA/guard collections may remain until implementation cleanup, but no new WMS work may be initiated through them under D125.

## D126 — Existing PickList relay retained; browser performs the business action

D126 supersedes the D125 retirement of the Firestore PickList relay before that retirement was implemented.

- Keep the existing bounded Firestore PDA request/ACK transport, anti-spam, confirmation guard, Agent HA/ownership and result delivery semantics.
- Replace only the business adapter behind the owning Agent: no direct WMS lookup/confirm API and no captured Supra session. The Agent resolves and confirms against the rendered managed-browser DOM.
- PDA jobs may auto-confirm after a unique guarded DOM match; manual Agent searches continue to wait for the Agent operator confirmation action.
- ACK is written only after the browser action reaches a bounded trustworthy terminal outcome. Uncertain UI state must not be reported as success and must not trigger blind retry.
- No browser cookie/token/header/signature/session material may enter Firestore, logs or ACK payloads.
- `sku_sync_jobs` is retired from active use; existing Báo hàng FCM and Picker-contact notification paths remain unchanged.

## D127 — Event-driven Picker presence projection

- D127 supersedes D119/D120 only for Agent consumption cadence. Android continues using the accepted hibernatable realtime socket; no PDA heartbeat is added.
- Socket connect, explicit logout/device/session lifecycle change and socket close/error rebuild the compact authoritative Picker projection. The service also emits a **single-slot** `ANDROID_PRESENCE_V1` control job using the existing Firestore relay collection. A new event overwrites the same control document instead of building an unbounded event queue.
- Only the elected PRIMARY consumes near-realtime presence events. A fresh Agent login, PRIMARY takeover, relay recovery or entry into the 05:00 operating window may perform one direct compact-projection snapshot read.
- Unexpected disconnect is presentation-graced for 180 seconds. Explicit logout/session/device removal is immediate. Reconnect within grace restores `PDA_READY` without row flicker.
- 23:00 without an active extension closes the displayed Picker list; 05:00 opens a new display window. The 14:00 shift boundary does not force logout.
- Periodic Agent UI timers make zero Picker-presence or Picker-alert provider reads. Fleet metrics retain the separate 30-minute hard throttle.
- Open Picker contact commands are queried server-side for `PENDING/SENT` only; historical resolved commands are never scanned as part of presence refresh.


## D129 Firestore quota-hardening invariants

D129 does not change the selected Firestore PDA↔Agent carrier or D117 latency/failover cadence.

- Confirmation polling remains **PRIMARY 4s idle / 2s bounded-hot** with fresh-only PENDING query; STANDBY/FROZEN perform no business queue polling.
- PRIMARY lease remains 7 seconds and STANDBY takeover remains 10 seconds.
- Picker presence stays **ACTIVE_ANDROID_EVENT_DRIVEN**. UI refresh never becomes a 15s/60s presence query loop. READY/grace presentation is local on top of the event-driven projection.
- Durable fleet metrics remain observability-only. UI redraw/tab refresh cannot force a checkpoint. A PRIMARY with no local request/response delta skips the provider checkpoint attempt where a current snapshot is already available; the fleet client also skips unchanged durable writes after tail reconciliation.
- Overtime/schedule UI ticks do not add a separate periodic roles/schedule Firestore read. Shared schedule fields already carried by existing role/lease coordination are used; explicit schedule conflicts may perform one bounded authoritative refresh.
- All Firestore REST attempts pass through a **local-only quota counter**. It may log 70/85/95% reference-threshold warnings and per-component counts, but the counter itself does not read/write Firebase, Drive or any other provider.
- Reference thresholds are conservative public no-cost quota reference points only; runtime code must not treat them as proof of the current billing plan or as a hard business cutoff.
- Replacing REST polling with a streaming listener is deferred to a separate Office field POC. No listener is activated by D129.


## D130 — relay self-recovery and Android connection recovery

- Firestore remains the sole PDA↔Agent confirmation carrier. No Cloudflare/RTDB/Apps Script fallback is introduced.
- PRIMARY confirmation polling remains 4 seconds idle / 2 seconds hot. A failed poll must return to the loop within a bounded retry window; a callback/UI/log failure may not terminate business polling.
- Agent owns a supervisor around the Firestore confirmation transport. Unexpected transport-loop exit restarts automatically with bounded backoff while preserving cancellation and HA fencing.
- Confirmation safe-read failure is bounded to two 4-second attempts rather than three 12-second attempts. This applies to the confirmation queue path only; HA cadence remains unchanged.
- Android confirmation create recovery keeps the same request/document id. An uncertain write is verified from Firestore server state and may be retried once with the same id. There is no second logical request and no overwrite of a late ACK.
- Android terminal confirmation wait remains 20 seconds.
- Android realtime WebSocket connection attempts have a 12-second handshake watchdog. A stuck CONNECTING attempt is cancelled and reconnects through existing bounded backoff.
- Online Picker authority remains an active Android realtime socket. Login/device registration alone does not count as online. Recovery of a stuck socket must not require app restart.
- No periodic Picker-presence heartbeat/poll is added. Existing event-driven projection and 180-second Agent-side transient disconnect grace remain.


## D131 — Firestore-only free-tier PDA↔Agent HA

D131 supersedes D117/D130 cadence values only where explicitly stated below. Firestore remains the only PickList request/ACK carrier; Cloudflare is not a second confirmation relay.

### Fleet roles and liveness
- Fleet capacity target is up to 20 Agents.
- Exactly one PRIMARY consumes PENDING / ANDROID_CONFIRM_V1 jobs.
- One business-hibernating NEXT_A watches the compact coordination lease and may take over after expiry.
- One business-hibernating NEXT_B is the secondary candidate at coarser cadence.
- Remaining Agents are DEEP_HIBERNATE.
- NEXT_A, NEXT_B and DEEP_HIBERNATE perform zero business queue queries.
- Initial lease target: PRIMARY heartbeat every 8 seconds, lease expiry 12 seconds. Candidate wakeups should be scheduled from the observed lease_until rather than blind rapid polling.
- Promotion is conditional/fenced by generation. A stale Agent may not process WMS/DOM business work.

### Business queue and burst handling
- PRIMARY operational polling target is 3 seconds while 05:00–23:00 relay is open.
- A real multi-job result may open a short bounded hot/drain window; idle polling must not become permanently faster.
- Query limit is at least 100 so a 40-PDA simultaneous burst can be collected in one query.
- One logical Android request id remains authoritative through create, Agent processing and ACK.
- Burst processing deduplicates request ids and may group exact suffix work into a managed-browser DOM batch when the rendered page supports safe multi-row resolution/selection/confirmation.
- No direct WMS API, auth/session extraction or hidden network replay is allowed.

### Operating window
- Base PDA↔Agent relay window is 05:00–23:00 Asia/Ho_Chi_Minh.
- Without an explicit shared overtime extension, all business queue polling and PDA confirmation work stop at 23:00 and resume locally at 05:00.
- Overtime state reuses the existing bounded shared coordination mechanism; repeated local UI ticks do not create extra provider reads/writes.

### PDA activity projection
- Do not add a PDA heartbeat.
- Authenticated Android login/realtime connect is the add signal; explicit logout/session/device replacement is immediate remove; unexpected disconnect keeps bounded grace.
- A PickList request refreshes PRIMARY-local last activity for that PDA using the already-read job and therefore adds zero provider operation.
- 05:00 entry/PRIMARY takeover may perform one bounded projection snapshot; normal UI timers perform no presence read.

### Exact cross-Agent counters
- Durable relay job state is the received/confirmed/error counter authority; RAM is cache-only.
- A compact durable daily summary/checkpoint carries the latest counters and metrics_checkpoint_at. It is updated only when terminal work is durably committed, preferably once per completed batch.
- Takeover reads the checkpoint and reconciles one bounded request tail newer than the checkpoint, deduplicated by request id, then resumes from the exact reconstructed value.
- Hibernating Agents display counters from their most recent coordination read with an age indicator.

### Firestore no-cost engineering budget
D131 engineering targets per provider quota day:
- reads <= 42,000;
- writes <= 15,000;
- deletes <= 2,000;
- storage <= 0.75 GiB;
- monthly outbound <= 8 GiB.

Quota accounting must use the Firestore quota reset day in America/Los_Angeles. If a soft budget is approached, degrade nonessential fleet/UI refresh first; do not silently remove generation fencing, terminal ACK safety or freshness filtering.


### D131 refinement — 20-Agent coarse fleet sync and durable counters

This subsection supersedes conflicting D131 max-6/RAM-counter wording above.

- Fleet capacity target is up to 20 Agents: exactly one PRIMARY, one NEXT_A, one NEXT_B and the remainder DEEP_HIBERNATE for business-provider work.
- Only PRIMARY queries PENDING business jobs. Deep Agents never subscribe to or poll the business queue.
- All Agents keep their managed WebView2 Confirm page/profile warm for local/manual PickList work. Non-primary hibernation disables relay business work, high-frequency DOM scans, provider refresh and background resource sampling; it does not shut down the prepared browser.
- NEXT_A alone receives the fastest lease/failover observation. NEXT_B is coarser. Deep Agents do not listen to each 10-second lease update.
- Durable job documents, not RAM, are the daily counter authority.
- Terminal job state carries the fields required for audit and count reconstruction. Daily summary/checkpoint state is stored inside the existing coordination collection and updated only when terminal work is durably committed, preferably once per completed browser batch.
- New PRIMARY immediately verifies/reconstructs the daily summary from a bounded tail; if summary confidence is uncertain, use current-day Firestore count aggregations rather than scanning every document payload.
- Non-primary presentation reads one compact fleet/counter snapshot at most every 10 minutes while the Agent is open. Foreground/open/manual refresh may perform one immediate bounded read.
- Do not create realtime counter listeners on every Agent.


### D131 final adaptive cadence and specialist-call state

- PRIMARY confirmation queue cadence is 3 seconds while at least one operational PDA is active, 15 seconds while the 05:00–23:00 relay window is open with zero active PDA, and a bounded short hot/drain cadence after a real burst.
- PRIMARY lease heartbeat is 10 seconds and failover expiry is 15 seconds. NEXT_A alone owns the fast lease watch; NEXT_B is coarse and DEEP_HIBERNATE Agents have zero business queue polling.
- picker_presence_projection/current remains the event-driven PDA-presence authority. The former relay_poc_jobs/picker_presence_current pseudo-job is removed so presence changes never enter the business confirmation queue.
- picker_active_calls/{picker_user_id} is the durable active specialist-call authority. FCM is a fast delivery/close signal only; Android also observes its own exact active-call document so unresolved calls restore after restart and resolved calls converge closed.


### D132 Picker presence delivery repair

- `picker_presence_projection/current` remains the durable current snapshot with schema 3 / `ACTIVE_ANDROID_EVENT_DRIVEN`.
- Presence state changes additionally overwrite one fixed `relay_poc_jobs/picker_presence_current` control document with source `ANDROID_PRESENCE_V1`. This is a single-slot event signal, not a history queue and not a per-PDA heartbeat.
- Only PRIMARY consumes the existing PENDING business query. Presence control ACK is conditional on document updateTime and must not increment daily PickList received/confirmed/error counters.
- A real `ANDROID_CONFIRM_V1` request is an implicit zero-extra-write activity refresh for that Picker on PRIMARY.
- Non-primary Agents never poll the business queue. Bringing an Agent window to foreground may issue one bounded projection refresh, rate-limited locally, to reconcile the operator view.
- Login/logout/device/socket changes continue to update the projection from authoritative Android realtime/session state.

## D133 alert delivery, acknowledgement and permission contract

- Picker active-call delivery is dual-path: Firestore picker_active_calls/{app_user_id} is the reconciled state and FCM picker_command is the fast path. Android must never attach the Firestore listener under a different Firebase user than the current Picker session.
- A restored Picker session that has no in-memory relay custom token must refresh the Android session once and then establish FirebaseAuth before attaching the active-call listener.
- Gọi về bàn CV is visually bounded to **60 seconds maximum**. FCM TTL is 60 seconds and the Android overlay independently enforces the same local safety TTL. A resolved event from the originating Agent clears it earlier.
- Result overlays (HAS_STOCK / SKIP_ALLOWED) use local-first acknowledgement: persist the result-event id in the existing local pending-ACK store, dismiss the overlay immediately, then attempt the server acknowledgement. Pending ACK is retried on Activity resume and on the existing one-minute runtime tick while the Activity remains alive. This queue is acknowledgement metadata only; it must never create or mutate a Báo hàng report offline.
- Android operational access is blocked until app notifications are enabled and the SYSTEM_ALERT_WINDOW special permission (**Hiển thị trên ứng dụng khác**) is granted. On Android 13+ the POST_NOTIFICATIONS runtime permission is also required. There is no “Để sau” bypass.
- The active-call Firebase Functions are part of the Beta deployment set: pickerActiveCallCreated and pickerActiveCallResolved.

## D134 — Explicit PDA session authority and compact Agent fleet stream

- Android socket lifecycle is not Picker presence authority. Socket connect, close, error or temporary realtime disconnect must not add/remove Picker presence and must not trigger presence projection writes.
- Picker presence is derived from the current Android session generation plus registered Android notification device. Explicit login/device registration adds or refreshes; explicit logout/device removal removes.
- A valid `ANDROID_CONFIRM_V1` PickList carrying the authenticated `app_session_generation` may repair delayed presence with source `PICKLIST`. A kicked generation is rejected by Firestore Rules before job creation.
- `picker_session_controls/<firebase_uid>` is the bounded revocation fence. The current PDA listens only to its own document and returns to login when `revoked_generation >= app_session_generation`.
- `relay_poc_coordination/agent_sync` is one compact fleet document. Authenticated Agents listen to that single document regardless of PRIMARY/Replay/deep-hibernate role. Call/Kick changes publish immediately; PRIMARY performs a five-minute reconciliation of presence, active calls, durable counters and at most 10 Agent entries.
- Liên hệ picker uses `picker_active_calls/<user_id>` with an exact 60-second `lock_until_ms`. Reuse after RESOLVED/expiry is conditional on Firestore update-time. FCM is fast delivery and the exact-document listener is convergence/recovery.
- Transient listener/DNS failures are logged and retried without repeated user-facing technical popups.
- Stable remains OWNER-GATED.

## D135 processing-Agent counter immediacy and local-first result surface

- Durable `relay_poc_coordination/daily_<business_day>` counters remain the cross-process authority.
- After a PRIMARY Agent successfully commits the terminal job ACK and daily-summary increment in the existing atomic Firestore commit, that same Agent may apply the known received/confirmed/error delta directly to its local presentation. This is display state only and creates no additional provider operation.
- The processing Agent overlay and **Hôm nay toàn cụm** surface therefore update immediately after durable ACK. A later compact/durable snapshot merges monotonically and cannot visually move the displayed daily counters backward.
- Non-processing / deep-hibernate Agents keep the existing D134 compact-listener and periodic-reconciliation behavior. D135 does not add realtime counter listeners to the fleet and does not change PRIMARY 3s/15s/1s adaptive queue cadence or the D134 five-minute reconciliation bound.
- Both Android result surfaces — cross-app `CriticalOverlayService` and the in-app Picker result dialog — follow the same local-first acknowledgement contract: persist pending ACK metadata, dismiss immediately, then attempt network acknowledgement. Logout, session revocation, account change or connectivity loss cannot make the result surface a blocking network gate.
- The 60-second specialist-call TTL remains an internal safety bound only; the Picker-facing call overlay does not advertise the automatic-close timer.
- The originating Agent reserves the call action locally as soon as the operator confirms it, before the asynchronous shared-state write. Shared call authority and the full 60-second fleet lock remain unchanged.

## D142 Android 11 critical-alert delivery/readiness

For the Owner-supported warehouse PDA baseline (**Newland NLS-MT90 Android 11** and **Urovo DT50 Android 11**):

- background transaction/result delivery remains the existing **data-only FCM HTTP v1** path; urgent Android messages retain `priority=high`;
- FCM is still best-effort delivery after authoritative business commit and does not become a second business-state authority;
- before login/business use, Android locally verifies app notifications, overlay capability, DND Notification Policy Access, battery-optimization exemption, and a dedicated critical notification channel at `IMPORTANCE_HIGH` that `canBypassDnd()`;
- the critical channel ID is `inventory_critical_alert_v2`; it is created/configured for DND bypass only after Notification Policy Access is granted, avoiding creation of a permanently under-configured channel before permission exists;
- critical Picker result / specialist-command delivery keeps the existing overlay and local-first acknowledgement semantics. Android 11 full-screen intent is an additional bounded wake/fallback layer, not a replacement business surface;
- `CriticalWakeActivity` may turn the screen on/show over lock screen only for a received critical alert and must self-finish after a short bounded window. It must not hold a wake lock or create a background keepalive;
- no permission polling, alert polling or new always-on service is allowed. Readiness is re-evaluated on app start/resume and when returning from Settings;
- if a required alert setting is missing, login/business operation is blocked until the local readiness gate passes. The UI links the user to the closest official Android Settings screen and automatically rechecks on return;
- platform Force Stop, device power-off and total network loss are not claimed as bypassable conditions.

Stable remains OWNER-GATED.

## D143 Picker contact and Android readiness notification rules

- Agent chat uses the existing `picker_alerts` / FCM data-only path with command type `CHAT_MESSAGE`; message payload is server/rules bounded to 200 characters.
- Chat FCM remains Android high priority like other urgent Picker commands. It does not add polling, a wake loop or a new persistent service.
- Chat display is local-ack only: **Xác nhận** dismisses the active overlay/service state without writing acknowledgement status back to Firestore/Worker. No close push is required because there is no Agent-side Kết thúc operation for chat.
- Existing direct `CALL_SPECIALIST` remains distinct: it uses the shared active-call lock and may be resolved by the originating Agent.
- D143 readiness UI adds a manual **Kiểm tra cấp quyền** fallback but retains automatic on-resume checks and D142's event-driven battery policy.

## D144 — Picker chat direct delivery

- `picker_session_controls/<firebase_uid>` carries the current `CHAT_MESSAGE` in addition to session revocation.
- Chat is limited to 200 characters and expires after at most 30 minutes.
- Android receives chat from the existing per-Picker Firestore snapshot listener. FCM remains a compatibility fast path using the same alert id.
- Full-screen chat uses the specialist title, message, and “Hãy đọc kĩ và thực hiện theo!”.
- Picker **Xác nhận** dismisses only on the PDA; no remote acknowledgement is written.
- Late duplicate FCM for a locally dismissed chat is ignored.
- Existing `picker_active_calls` direct-call lock and resolve behavior is unchanged.
- Agent chat entry is a modal editor isolated from periodic Agent UI refresh timers while open; it adds no polling or provider write loop.
## D146 — SKU catalog invalidation signal

- `sku_catalog_updated` is a non-alert invalidation event for authenticated operational clients.
- Web SKU import emits realtime scope `sku_catalog` for foreground convergence and sends a silent FCM data event for Android background/resume convergence.
- The FCM event carries no SKU master payload and must not show a notification, overlay, sound or vibration. Android marks a local refresh-pending flag and fetches authoritative catalog data through the existing authenticated API.
- This signal does not alter the critical-alert channel, specialist call/chat delivery, D142 notification-readiness contract, or existing realtime backoff.

## D148 sequential Android overlay queue

- Existing FCM `report_created` may surface on Reporter/Admin Android as an adaptive cross-app overlay using the already-required overlay permission. Payload continues to carry event id, SKU and product name; authoritative business state remains InventoryCore.
- Overlay priority is deterministic: Picker/specialist command first, then Picker result, then Reporter/Admin report-created information. Equal-priority alerts are FIFO.
- Overlay identity is the existing alert/event id. Duplicate ids already active or queued are ignored.
- Only one overlay is active. A higher-priority command may preempt a lower-priority alert; the interrupted alert is re-queued instead of discarded.
- Result events are marked as owned by the overlay queue while waiting so the foreground in-app result dialog cannot race the same event.
- **XÁC NHẬN ĐÃ NHẬN**, chat **XÁC NHẬN**, or report-created **OK** affects only the active queue item. The next item is rendered afterward.
- Result acknowledgement remains local-first and network acknowledgement remains retryable. Expiry/remote clear without acknowledgement releases overlay ownership so authoritative result reconciliation can surface it later.
- A clear signal with a missing alert id must never wipe unrelated queued shortage/result alerts.
- No polling, wake loop or provider read cadence is added.

## D149 operating-schedule delivery

The current operating schedule is a low-frequency state change, not a polling workload.

- Canonical Agent boundary decisions remain CAS-protected. Only a successful state change updates the dedicated current-state projection `relay_poc_coordination/operating_schedule`.
- Never attach a schedule Function trigger to hot `roles`, generation lease or `agent_sync` documents.
- The exact current-state projection emits one idempotent data-only FCM schedule signal when its version changes. Android ignores duplicate or older versions.
- FCM is an accelerator only. A PDA that was powered off, offline, logged out or replaced must recover the latest current state without replaying missed messages.
- When Worker is reachable, Android cold-start/login/reconnect obtains the current schedule from the existing Worker/InventoryCore path. Do not add a Firestore read in the normal recovery path.
- If Worker is unavailable and an Android Firebase session is still valid, one exact GET of the schedule projection is allowed as bounded outage fallback. No collection list, listener or retry loop is permitted.
- Closed schedule state blocks new schedule-governed actions but does not itself invalidate a valid login/session.
- Schedule payload contains no secret/user-specific data: schedule key/version, decision/source, effective open-until, normal window and server/update timestamps only.
- D140 streaming routing, exponential retry, permanent-error circuit and HA-trio listener limits remain unchanged.

## D150 Agent coordination and quota-safety refinement

D150 preserves the accepted D149 schedule plus D140/D131 confirmation HA timings. It changes only how non-business coordination reads are sourced and how support-log failure paths are bounded.

- Only PRIMARY queries the fresh Agent presence projection. The query is server-filtered by the existing heartbeat freshness window and bounded to the compact fleet size.
- NEXT-A and NEXT-B use the existing role-limited `agent_sync` realtime listener. DEEP has no listener and exact-reads the one compact `agent_sync` document at a 10-minute cadence; focus recovery remains bounded and must not become a fast polling loop.
- `picker_active_calls` reconciliation queries only unexpired lock documents and then validates ACTIVE state locally. Historical/resolved calls are not repeatedly listed.
- Manual PRIMARY takeover is limited in the Agent UI/runtime to login usernames `tamnv2` and `admin`. It requires replay open + Web Confirm ready, then uses roles-document CAS and a new generation. Existing pre-WMS-mutation generation verification remains authoritative.
- PRIMARY queue 3s active / 15s inactive / 1s bounded HOT, 10s lease heartbeat and 15s failover remain protected.
- Agent support-log delivery uses commit-last multipart semantics: intermediate `DIRECT_PART` writes do not start assembly; the final `DIRECT_PENDING` part is the single assembly trigger. Repeated same-fingerprint errors are locally suppressed/bounded while crash remains immediate.
- No provider Usage polling, new Firestore collection, Android polling or Stable runtime is introduced.



## D151 adaptive Android critical-alert delivery

For supported Android 11+ clients, device model and firmware are diagnostic metadata only and must never select the production alert path.

Operational readiness is split into:
- **hard readiness**: app notifications enabled (including runtime notification permission where applicable), `SYSTEM_ALERT_WINDOW` granted, and battery optimization exemption active;
- **native enhancement**: Notification Policy access is truly granted and the critical high-importance channel reports `canBypassDnd() == true`.

Delivery modes:
- **NATIVE_DND** — hard readiness is satisfied and Android exposes real DND policy + bypass-channel capability;
- **OVERLAY_COMPAT** — hard readiness is satisfied but DND policy/channel bypass is unavailable, broken or unsupported by the OEM build.

Both modes use the existing data-only high-priority FCM event, the same overlay priority/FIFO queue and the same local-first acknowledgement semantics. Overlay remains the canonical visible business surface. Notification/full-screen intent is a fallback only and must be capability-checked on Android versions that expose `canUseFullScreenIntent()`.

For a critical overlay event while the display is off or keyguard is active, the app may launch the existing bounded wake Activity to request screen-on/show-when-locked before or alongside overlay presentation. This path is event-driven only: no WakeLock, polling, periodic permission check, heartbeat, new listener or always-on service is allowed.

Failure of OEM DND policy access alone must not block login when hard readiness is satisfied. Failure of Notification, Overlay or battery-exemption hard readiness still blocks operational startup.


## D153 quota-safe Picker presence projection

- `picker_presence_projection/current` remains the authoritative Firestore projection consumed by Agent. D153 adds no new listener or transport.
- InventoryCore durably records the last successfully projected **semantic** Picker state. Volatile diagnostic timestamps are excluded. Repeated identical registration/recovery calls therefore create zero Firestore projection/control writes after acknowledgement.
- Projection acknowledgement is commit-after-success: if the Firestore projection/control write fails, InventoryCore does not mark that semantic state current, so a later ordinary registration can repair it.
- `picker_notification_targets/<user>` follows the same desired-state/acknowledged-state rule. Same device/platform/token/enabled state is not rewritten; failed mirror delivery remains retryable.
- The existing fixed-slot `picker_presence_current` control/ACK path remains. Explicit logout/revoke may attach bounded removed-session metadata so PickList fallback removal is user/session-specific.
- PickList fallback is one-shot and session-generation fenced; it is not last-seen/heartbeat traffic.
- D150/D131 queue, lease, failover and listener cadence remain unchanged. No Android polling or additional realtime listener is added.
