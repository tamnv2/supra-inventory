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
