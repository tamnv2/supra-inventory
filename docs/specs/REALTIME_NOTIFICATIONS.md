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

## SLA notifications

SLA is warning/escalation only:
- server derives SLA state from explicit saved thresholds and authoritative time;
- entering warning/escalated state may produce foreground/UI notification and bounded background alert to the appropriate Reporter/Admin/Root audience;
- SLA never calls `HAS_STOCK`, `SKIP_ALLOWED` or another resolution mutation.

If thresholds are not configured, state is explicitly `UNCONFIGURED`; no hidden legacy default is inferred.

## Recurrence events

A new same-SKU episode after a resolved episode is represented by a new batch with recurrence metadata (`previous_batch_id` or equivalent). Realtime may surface a recurrence marker, but never mutates the previous finalized batch back to pending.

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
